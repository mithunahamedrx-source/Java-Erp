import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { ACTION_ICON, ACTION_ICON_SIZE, ACTION_ICON_STROKE } from '../shell/icons';
import { Notice, buttonStyle } from '../ui/primitives';
import { useAuth } from '../auth/AuthContext';
import { fetchChannels } from './channelListingApi';
import { listSellableProducts } from './sellableProductApi';
import type { CapabilityView, ChannelListing, ChannelView } from './channelListingApi';
import type { SellableProduct } from './sellableProductApi';
import { compareDecimalStrings, formatMoneyForDisplay } from '../platform/money';
import { formatMoment } from '../platform/datetime';
import { MappingModal } from './MappingModal';
import { ListingAiAssist } from './ListingAiAssist';
import type { AiAcceptance } from './ListingAiAssist';
import type { AiAuthoringKind } from './channelListingApi';

/**
 * FRAMES 09 AND 10 — the ONE listing authoring surface, in create and edit mode.
 *
 * <p>🔴 THERE IS ONE FORM, NOT TWO. Add and Edit are the same five sections, the same
 * controls, the same validation and the same readiness engine; only the identity block, the
 * submit verb and what the draft starts as differ. Two forms would drift, and the operator
 * would learn one screen twice.
 *
 * <p>🔴 THE RULE THIS SURFACE EXISTS TO HOLD: **saving is not publishing** (`PRD-185`).
 * Everything typed here becomes LOCAL Trioloo intent and stops. Nothing contacts a channel,
 * no external identifier is invented, and there is deliberately no "publish now": pushing
 * needs separate authority (`PRD-196.a`) and is a separate, later, explicit act.
 *
 * <p>🔴 A listing created here is legitimately `DRAFT`, `UNMAPPED` and unpublished. None of
 * those is a validation failure (`PRD-178`, `PRD-188.a`), so none blocks Save. Neither does an
 * incomplete MARKETPLACE requirement: those are reported as readiness, never as a refusal to
 * record local intent.
 *
 * <p>🔴 CAPABILITY IS NOT AUTHORITY, AND ABSENCE IS NOT EMPTINESS. Where the selected channel
 * has no adapter, the fields that depend on one say so in those words — never "unavailable",
 * which reads as a permission refusal, and never a fabricated category tree, attribute schema,
 * warranty option or package requirement.
 *
 * <p>⚠ SECTIONS B AND E DELIBERATELY HOLD NO INPUTS. A channel-category attribute schema, and
 * the package and warranty publishing requirements beside it, are DECLARED BY AN ADAPTER
 * (`API-063`, `PRD-125`). No adapter is configured, and no ratified Trioloo field represents
 * any of those facts locally, so the sections state the position rather than offering controls
 * that would write nowhere. The workflow position is real; the fields arrive with the
 * capability.
 */

/** ⚠ `PRD-128` — Trioloo's own intent. It is NEVER the channel's listing status. */
const PUBLICATION_INTENTS = [
  ['PUBLISH', 'Publish — Trioloo wants this listed'],
  ['HOLD', 'Hold — do not offer it for publication yet'],
] as const;

export type Draft = {
  channelInstance: string;
  mappedSellableSku: string;
  intendedTitle: string;
  intendedDescription: string;
  highlights: string;
  /** `PRD-202.b` — the OPTIONAL Bangla overrides. Blank means "fall back to English". */
  intendedTitleBn: string;
  intendedDescriptionBn: string;
  highlightsBn: string;
  /** `PRD-201.a` — kilograms and centimetres (`PRD-201.e`). */
  packageWeightKg: string;
  packageLengthCm: string;
  packageWidthCm: string;
  packageHeightCm: string;
  packageContent: string;
  salePrice: string;
  promotionPrice: string;
  promotionStartsAt: string;
  promotionEndsAt: string;
  publishedMarketplaceStock: string;
  publicationIntent: string;
  intendedChannelCategory: string;
  channelSku: string;
};

/**
 * 🔴 THE CREATE SEED, and the SHAPE EVERY EDIT MUST FILL. Because `Draft` is all strings,
 * `dirty` is a plain per-key comparison and an absent fact and a cleared field are the same
 * empty string — which is what "the operator has written nothing here" means.
 */
export const EMPTY: Draft = {
  channelInstance: '',
  mappedSellableSku: '',
  intendedTitle: '',
  intendedDescription: '',
  highlights: '',
  intendedTitleBn: '',
  intendedDescriptionBn: '',
  highlightsBn: '',
  packageWeightKg: '',
  packageLengthCm: '',
  packageWidthCm: '',
  packageHeightCm: '',
  packageContent: '',
  salePrice: '',
  promotionPrice: '',
  promotionStartsAt: '',
  promotionEndsAt: '',
  publishedMarketplaceStock: '',
  publicationIntent: 'PUBLISH',
  intendedChannelCategory: '',
  channelSku: '',
};

/**
 * 🔴 `PRD-198.b` — ONE HIGHLIGHT PER LINE, and the line order IS the authored order.
 *
 * <p>⚠ Blank lines are ignored rather than stored: a blank highlight is not content
 * (`PRD-198`), and an operator pressing Enter twice has not authored an empty selling point.
 *
 * <p>🔴 The textarea is an INPUT SHAPE, never the storage shape. Each surviving line becomes
 * one ordered canonical record; a single joined string would destroy the sequence the rule
 * exists to protect.
 */
export function highlightLines(text: string): readonly string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

/** What differs between creating a listing and editing one. Everything else is shared. */
export type AuthoringMode = {
  readonly kind: 'create' | 'edit';
  /** ⚠ Edit starts from the listing's CURRENT intended state, never from blanks. */
  readonly initial: Draft;
  /** The listing being edited, for identity and the after-saving panel. */
  readonly existing: ChannelListing | null;
  readonly onSubmit: (body: Record<string, unknown>) => Promise<void>;
  /**
   * Re-read the listing after a mapping was persisted.
   *
   * 🔴 MAPPING IS ITS OWN TRANSACTION (`PRD-179.c`). It is saved the moment it is confirmed,
   * independently of this form, so the page must refresh the listing WITHOUT rebuilding the
   * draft — the operator's unsaved typing has nothing to do with the mapping they just made.
   */
  readonly onMappingChanged?: () => void;
};

export function ListingAuthoringForm({ mode }: { readonly mode: AuthoringMode }): React.JSX.Element {
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  // 🔴 `PRD-196.a` — MANAGE NEVER IMPLIES PUBLISH, and authoring locally needs only manage.
  const mayManage = permissions.includes('product.channel-listing.manage');
  const editing = mode.kind === 'edit';

  const [channels, setChannels] = useState<readonly ChannelView[]>([]);
  const [draft, setDraft] = useState<Draft>(mode.initial);
  /*
    ⚠ OPEN WHEN THERE IS SOMETHING TO SHOW. A listing that already carries a promotion must
    not present it as an unmade decision hidden behind "Add promotion" — the operator would
    read the collapsed control as "no promotion" and be wrong.
  */
  const [promotionOpen, setPromotionOpen] = useState(mode.initial.promotionPrice.trim() !== '');
  /*
    ⚠ The modal is rendered INSIDE this component, so opening and closing it cannot remount the
    form. That is what keeps unsaved values intact across a mapping (§27).
  */
  const [mappingOpen, setMappingOpen] = useState(false);
  /**
   * ⚠ `PRD-202.a` — English is the primary authoring value, so the form opens in English.
   * Switching is a VIEW change: both languages stay in the draft, and nothing is copied
   * between them (`PRD-202.d`).
   */
  const [language, setLanguage] = useState<'EN' | 'BN'>('EN');
  const [aiOpen, setAiOpen] = useState(false);
  /**
   * 🔴 `PRD-200.e`/`.n` — the fields the operator accepted from a candidate ON THIS SAVE.
   * It travels with the save so the activity trail can say HOW the words were arrived at.
   *
   * 🔴 It does NOT propagate: typing over an accepted field removes it from this set, so a
   * later manual edit is recorded as the manual change it is.
   */
  const [aiAccepted, setAiAccepted] = useState<readonly string[]>([]);
  const [product, setProduct] = useState<SellableProduct | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    fetchChannels().then(setChannels).catch(() => setChannels([]));
  }, []);

  /**
   * 🔴 DIRTY IS DERIVED, NEVER TRACKED BY HAND. It compares what is on screen with what
   * was LOADED, so undoing an edit by retyping the original value correctly makes the form
   * clean again — a boolean flipped on the first keystroke never would.
   *
   * 🔴 Typing changes NOTHING that is persisted. The listing's stored `UNSENT` condition is
   * derived from a real save (`PRD-185.d`), so an abandoned edit leaves the database exactly
   * as it was.
   */
  const dirty = useMemo(
    () => (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== mode.initial[k]),
    [draft, mode.initial],
  );

  /**
   * ⚠ The ordinary browser guard, and only when there is something to lose. It is the
   * shared convention rather than a bespoke modal, so it behaves the way every other unsaved
   * page in a browser does.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /**
   * 🔴 `INV-106.2` — THE ORDERABLE SKU OWNS PRICE, STOCK AND PARCEL. On a variation
   * listing those figures belong to each unit separately, so a single listing-level control
   * could only ever write one of them — or, worse, write a listing-level figure the SKUs do
   * not carry. Editing them here is refused and handed to the per-SKU surface instead.
   *
   * ⚠ Creation is unaffected: a listing is created with exactly one orderable unit
   * (`INV-106.1`), so on Add the listing-level figures and the unit's are the same fact.
   */
  const skuCount = mode.existing?.skuCount ?? 1;
  const perSkuOnly = editing && skuCount > 1;

  /**
   * 🔴 REMOTE IDENTITY IS THE DIVIDING LINE, and the external listing ID is the evidence of
   * it (`PRD-188.b`): the channel issues one only when it has accepted the listing. Every
   * "already on the marketplace" decision on this page reads from this single fact, so the
   * lifecycle, the after-saving wording and the Seller SKU can never disagree.
   *
   * ⚠ NOT `localLifecycle`. A listing can sit in PENDING_PUBLICATION with no identifier yet;
   * that is still a listing the channel has never accepted.
   */
  const published = editing && (mode.existing?.externalListingId ?? null) !== null;

  /**
   * A listing the channel has content for and Trioloo has NO opinion about yet.
   *
   * <p>🔴 THIS IS THE ORDINARY SHAPE OF A DISCOVERED LISTING, NOT A FAULT. `PRD-181.a` — a
   * pull writes the REPORTED side only and never authors intent — so a listing that arrived
   * through discovery has every intended field empty until a person fills it in or explicitly
   * accepts the marketplace's values (`PRD-184.b`).
   *
   * <p>⚠ IT NO LONGER MEANS THE FORM IS BLANK. Under `PRD-204.c` a field with no local draft
   * opens on the marketplace's current value, so this now marks a listing whose content is the
   * CHANNEL'S rather than one the operator has written — which is what the notice says.
   */
  const unauthored = editing && mode.existing !== null
    && !mode.existing.intendedTitle
    && !mode.existing.intendedDescription
    && !mode.existing.salePrice
    && !mode.existing.promotionPrice
    && !mode.existing.listingStock
    && !mode.existing.intendedChannelCategory;

  /** Whether the channel actually reported anything worth showing beside the empty fields. */
  const hasReported = mode.existing !== null
    && (mode.existing.reportedTitleReadable
      || mode.existing.reportedDescriptionReadable
      || mode.existing.reportedSalePriceReadable
      || mode.existing.reportedStockReadable);

  /**
   * ⚠ Reported context is offered ONLY while the field is unauthored. Once a person has
   * written intent, the comparison surface (`FRAME 07`) owns the intended-versus-reported
   * question, and repeating it under every input would duplicate that screen inside this one.
   */
  const reportedFor = (value: string | null, readable: boolean, authored: string): string | undefined => {
    if (!editing || !readable || value === null || authored.trim() !== '') {
      return undefined;
    }
    return value;
  };

  /**
   * 🔴 RATIFIED RULE — the Seller / Channel SKU may be edited freely while the orderable unit
   * has NEVER acquired remote identity, and becomes immutable once it has. A variation listing
   * is locked regardless: it holds several Seller SKUs and this is one control.
   */
  const sellerSkuLocked = editing && (published || skuCount > 1);

  const channel = channels.find((c) => c.code === draft.channelInstance) ?? null;
  const highlights = highlightLines(draft.highlights);
  const highlightsBn = highlightLines(draft.highlightsBn);
  const activeHighlights = language === 'EN' ? highlights : highlightsBn;

  const set = (field: keyof Draft, value: string): void => {
    setDraft((current) => ({ ...current, [field]: value }));
    // 🔴 `PRD-200.n` — a hand edit makes the value the operator's own again.
    setAiAccepted((current) => (current.includes(field) ? current.filter((f) => f !== field) : current));
    // ⚠ Correcting a field clears ITS message only. Wiping the whole set would hide the
    // other problems the operator has not reached yet.
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  /**
   * 🔴 THE ONE VALIDATION ENGINE. Everything Listing Readiness reports as REQUIRED comes from
   * here, so what the sidebar says is missing is exactly what Save refuses on. Two engines
   * would eventually disagree, and one screen would tell the operator two different things.
   *
   * <p>⚠ It covers LOCAL structural truth only. Marketplace requirements are declared by an
   * adapter (`API-063`); none is configured, so none is enforced or invented here.
   */
  const validate = (): Readonly<Record<string, string>> => {
    const found: Record<string, string> = {};
    if (!draft.channelInstance) {
      found.channelInstance = 'Choose the one channel and shop this listing belongs to.';
    }
    if (!draft.intendedTitle.trim()) {
      found.intendedTitle = 'The channel-facing title is what shoppers see. Enter one.';
    }
    for (const [field, text] of [['salePrice', 'Sale Price'], ['promotionPrice', 'Promotion Price']] as const) {
      const value = draft[field].trim();
      if (value && !/^\d+(\.\d{1,2})?$/.test(value)) {
        found[field] = `${text} must be a plain amount, such as 1200 or 1200.50.`;
      }
    }
    /*
      🔴 `PRD-199.e` — the Promotion Price may never sit ABOVE the base Sale Price. A
      "promotion" that costs more is not one. Equality is valid. The amounts are compared as
      DECIMAL STRINGS (`TEC-015`); parsing them into a Number would be the same defect as
      storing one.
    */
    if (!found.salePrice && !found.promotionPrice
        && draft.salePrice.trim() && draft.promotionPrice.trim()
        && compareDecimalStrings(draft.promotionPrice.trim(), draft.salePrice.trim()) > 0) {
      // 🔴 Never silently swapped. The operator typed them; only they know which was wrong.
      found.promotionPrice = 'Promotion Price cannot be above the Sale Price. Equal values are fine.';
    }
    // 🔴 `PRD-199.c` — a promotion price REQUIRES both bounds, ordered.
    const starts = draft.promotionStartsAt.trim();
    const ends = draft.promotionEndsAt.trim();
    if (draft.promotionPrice.trim()) {
      if (!starts) {
        found.promotionStartsAt = 'A Promotion Price needs a start. Without a window it would never end.';
      }
      if (!ends) {
        found.promotionEndsAt = 'A Promotion Price needs an end. Without a window it would never end.';
      }
    }
    for (const [field, value] of [['promotionStartsAt', starts], ['promotionEndsAt', ends]] as const) {
      if (value && Number.isNaN(Date.parse(value))) {
        found[field] = 'Enter a date and time.';
      }
    }
    if (!found.promotionStartsAt && !found.promotionEndsAt && starts && ends
        && Date.parse(ends) <= Date.parse(starts)) {
      found.promotionEndsAt = 'Promotion Ends must be later than Promotion Starts.';
    }
    const stock = draft.publishedMarketplaceStock.trim();
    if (stock && !/^\d+$/.test(stock)) {
      found.publishedMarketplaceStock = 'Listing stock is a whole number of units.';
    }
    /*
      🔴 `PRD-201.f` — ABSENT is fine; ZERO is not. A parcel with a zero side does not exist
      and a parcel weighing 0 kg is a claim, so both are refused while "not measured" stays
      a perfectly ordinary answer.
    */
    for (const [field, text] of [
      ['packageWeightKg', 'Package weight'],
      ['packageLengthCm', 'Package length'],
      ['packageWidthCm', 'Package width'],
      ['packageHeightCm', 'Package height'],
    ] as const) {
      const value = draft[field].trim();
      if (value && !/^\d+(\.\d{1,3})?$/.test(value)) {
        found[field] = `${text} must be a plain number, such as 1.25.`;
      } else if (value && Number(value) === 0) {
        found[field] = `${text} must be greater than zero. Leave it empty if it is not known.`;
      }
    }
    return found;
  };

  const save = async (): Promise<void> => {
    const found = validate();
    setErrors(found);
    setFailure(null);
    const first = Object.keys(found)[0];
    if (first) {
      // 🔴 Nothing the operator typed is discarded, and the page moves to the first problem.
      const wrapper = fieldRefs.current[first];
      wrapper?.scrollIntoView({ block: 'center' });
      // ⚠ The ref holds the LABELLED GROUP, which is not focusable.
      wrapper?.querySelector<HTMLElement>('input, select, textarea')?.focus();
      return;
    }
    setBusy(true);
    try {
      await mode.onSubmit({
        channelInstance: draft.channelInstance,
        /*
          🔴 `PRD-188.b` — the channel issues the identifier when it accepts the listing.
          It is never typed and never invented, and EDIT never sends one either: an existing
          identifier is channel-owned and the backend refuses to have it retyped.
        */
        externalListingId: null,
        channelSku: draft.channelSku.trim() || null,
        mappedSellableSku: draft.mappedSellableSku.trim() || null,
        intendedTitle: draft.intendedTitle.trim() || null,
        intendedDescription: draft.intendedDescription.trim() || null,
        // 🔴 `TEC-015` — money crosses as the STRING the operator typed.
        salePrice: draft.salePrice.trim() || null,
        promotionPrice: draft.promotionPrice.trim() || null,
        promotionStartsAt: toInstant(draft.promotionStartsAt),
        promotionEndsAt: toInstant(draft.promotionEndsAt),
        publishedMarketplaceStock: draft.publishedMarketplaceStock.trim() || null,
        publicationIntent: draft.publicationIntent || null,
        intendedChannelCategory: draft.intendedChannelCategory.trim() || null,
        intendedChannelCategoryRef: null,
        // 🔴 `PRD-198.b` — one ordered record per line, in the authored order.
        highlights: [...highlights],
        /*
          🔴 `PRD-202.d` — the English value is NEVER copied across. A blank override is sent
          as null, and the server derives the effective Bangla on read.
        */
        intendedTitleBn: draft.intendedTitleBn.trim() || null,
        intendedDescriptionBn: draft.intendedDescriptionBn.trim() || null,
        highlightsBn: [...highlightLines(draft.highlightsBn)],
        /*
          🔴 `PRD-200.e` — provenance for THIS save. The ACTOR is still the person; this only
          records how the words were arrived at, and it never propagates to a later edit.
        */
        aiAssistedFields: [...aiAccepted],
        // 🔴 `PRD-201.e` — kilograms and centimetres, as the strings the operator typed.
        packageWeightKg: draft.packageWeightKg.trim() || null,
        packageLengthCm: draft.packageLengthCm.trim() || null,
        packageWidthCm: draft.packageWidthCm.trim() || null,
        packageHeightCm: draft.packageHeightCm.trim() || null,
        packageContent: draft.packageContent.trim() || null,
        // ⚠ Optimistic concurrency on edit; absent on create.
        version: mode.existing?.version ?? null,
      });
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'The listing could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * ⚠ Leaving with unsaved work asks first. With nothing changed it does not ask at all — a
   * confirmation for a no-op trains operators to dismiss confirmations.
   */
  const confirmDiscard = (): boolean =>
    !dirty || window.confirm('You have unsaved changes to this listing. Leave without saving?');

  const BackIcon = ACTION_ICON.back;
  const SaveIcon = ACTION_ICON.save;

  if (!mayManage) {
    return (
      <>
  <PageHeader title={editing ? 'Edit Listing' : 'Add Listing'} subtitle="Products · Listings" />
        <div data-testid="create-listing-forbidden" style={{ ...panel, padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
            {editing ? 'You cannot edit Listings' : 'You cannot create Listings'}
          </div>
          <p style={{ ...note, marginTop: '7px' }}>
            {editing ? 'Editing' : 'Creating'} a Listing records Trioloo's intended content and
            needs the product.channel-listing.manage authority. Ask an administrator for it.
          </p>
          <Link data-testid="create-listing-back" to="/inventory/products/listings" style={{ ...secondaryButton, marginTop: '14px' }}>
            Back to Listings
          </Link>
        </div>
      </>
    );
  }

  /**
   * 🔴 `PRD-200.a`/`.k` — ACCEPTANCE EDITS THE FORM AND STOPS. It does not save, and it
   * certainly does not push. The operator still has to press Save listing, and publishing is
   * a separate act after that.
   *
   * 🔴 `PRD-200.m` — only the candidates the operator selected are applied; the rest are
   * discarded without touching anything.
   */
  const acceptAiCandidates = (accepted: readonly AiAcceptance[]): void => {
    const fields: string[] = [];
    setDraft((current) => {
      const next = { ...current };
      for (const { kind, text } of accepted) {
        const field = fieldForKind(kind, language);
        next[field] = text;
        fields.push(field);
      }
      return next;
    });
    setAiAccepted((current) => [...new Set([...current, ...fields])]);
  };

  /*
    🔴 READINESS MUST READ THE LISTING, NOT THE PICKER. On EDIT the Sellable Product picker is
    not shown at all, so keying the mapping line off it reported every edited listing as
    unmapped — including ones that plainly were not. The listing's own counts are the truth,
    and they refresh the moment a mapping is confirmed (§38).
  */
  const mapping = editing && mode.existing
    ? { mapped: mode.existing.mappedSkuCount, total: mode.existing.skuCount }
    : { mapped: product === null ? 0 : 1, total: 1 };
  const readiness = deriveReadiness(draft, channel, product, highlights, highlightsBn, validate(), perSkuOnly, skuCount, mapping);

  return (
    <>
      <PageHeader
        title={editing ? 'Edit Listing' : 'Add Listing'}
        /*
          🔴 THE OPERATOR'S IDENTITY, NEVER THE UUID. On edit that is the shop, the channel's
          own identifier where it issued one, and the orderable units — the three facts that tell
          one listing from another. An unpublished listing says so rather than showing a blank
          where an identifier would be (`PRD-188.b`).
        */
        subtitle={editing ? editSubtitle(mode.existing) : 'Draft · not on the marketplace · no external listing ID yet'}
        actions={
          <>
            <Link
              data-testid="create-discard"
              to={editing && mode.existing
                ? `/inventory/products/listings/${mode.existing.id}`
                : '/inventory/products/listings'}
              onClick={(event) => { if (!confirmDiscard()) { event.preventDefault(); } }}
              style={headerSecondary}
            >
              <BackIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
              {editing ? 'Cancel' : 'Discard'}
            </Link>
            <button
              type="button"
              data-testid="create-save-header"
              /*
                ⚠ On edit with nothing changed there is nothing to write. Sending an update
                anyway would stamp a new intended-content time and invent an UNSENT condition out
                of a page visit.
              */
              disabled={busy || (editing && !dirty)}
              onClick={() => void save()}
              style={headerPrimary}
            >
              <SaveIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
              {busy ? 'Saving…' : editing ? 'Save draft' : 'Save listing'}
            </button>
          </>
        }
      />

      <form
        data-testid="create-listing-form"
        onSubmit={(event) => { event.preventDefault(); void save(); }}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--space-8)', alignItems: 'start' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/*
            🔴 `PRD-204.c` — THE FORM OPENED ON THE MARKETPLACE'S OWN VALUES, and says so. It used
            to open BLANK for a discovered listing, because it seeded from the intended side alone
            and a pull never authors intent (`PRD-181.a`). That forced every operator through the
            Accept Marketplace workflow in order to do ordinary editing.
          
            🔴 SAYING SO IS THE POINT. The operator must know these values came from the channel and
            that NOTHING has been recorded yet — opening a page writes nothing, and only their save
            creates a local draft (`PRD-204.c`, `PRD-204.f`).
          */}
          {/*
            🔴 `PRD-204.f`/`.g` — SAVE IS NOT PUSH, AND PUSH IS NOT AVAILABLE. Daraz declares no
            listing field writable (`API-063.a`) because no outbound write protocol is
            implemented, so every field here is LOCAL-ONLY today.
            ⚠ Saying it plainly is the requirement: an operator must never be able to believe a
            save reached the marketplace.
          */}
          {editing && (
            <Notice
              tone="info"
              title="Saved changes stay in Trioloo — push is not available yet"
              testId="edit-push-unavailable"
            >
              This channel does not declare any listing field writable, so nothing here can be
              sent to the marketplace. Your edits are saved locally against this Listing and are
              marked as unsent; sending them is a separate act that is not implemented yet.
            </Notice>
          )}

          {unauthored && hasReported && mode.existing && (
            <Notice
              tone="info"
              title="Editing the marketplace's current values"
              testId="edit-unauthored-notice"
            >
              These fields show what the channel reports it is showing right now. Nothing has been
              saved yet — opening this page records nothing. Change what you need and save, and your
              edits are kept as a local draft on this Listing.
            </Notice>
          )}

          {/* ================================================================ A */}
          <Section id="basic" title="Basic information">
            <Row>
              {editing ? (
                /*
                  🔴 CHANNEL IS LISTING IDENTITY AND IS NOT EDITABLE. The backend refuses to
                  change it, so a dropdown here would be a control that can only fail — and one
                  mis-click would read as a cross-shop reassignment.
                */
                <div style={{ minWidth: 0 }}>
                  <div style={label}>Channel / Shop</div>
                  {/*
                    ⚠ FROM THE LISTING, not from the channel list. The listing already carries
                    its shop's name, so the identity never flickers from code to name while a
                    second request is in flight.
                  */}
                  <div data-testid="edit-channel-readonly" style={readOnlyValue}>
                    {mode.existing?.channelName ?? channel?.name ?? draft.channelInstance}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--color-placeholder)', marginTop: '4px' }}>
                    Part of this listing&rsquo;s identity and cannot be changed
                  </div>
                </div>
              ) : (
              <Field label="Channel / Shop" error={errors.channelInstance} htmlFor="create-channel" refs={fieldRefs} name="channelInstance">
                {/*
                  🔴 ONE shop, chosen explicitly. Creating a listing for one Daraz account
                  never fans out to a sibling shop or the website: each is its own listing
                  with its own intent, and Trioloo does not decide that for the operator.
                */}
                <select
                  id="create-channel"
                  data-testid="field-channel-instance"
                  value={draft.channelInstance}
                  onChange={(event) => set('channelInstance', event.target.value)}
                  style={control(Boolean(errors.channelInstance))}
                >
                  <option value="">Choose a channel and shop</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </Field>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={label}>Adapter capabilities</div>
                <div data-testid="create-capabilities" style={note}>
                  {channel === null
                    ? 'Choose a channel to see what its adapter can carry.'
                    : describeCapabilities(channel)}
                </div>
              </div>
            </Row>

            {channel !== null && !channel.adapterAvailable && (
              /*
                ⚠ CAPABILITY, NOT AUTHORITY. An absent adapter does not stop local creation —
                a Trioloo-only listing is a legitimate record — so this is stated, not enforced.
              */
              <p data-testid="create-no-adapter" style={{ ...note, marginTop: '10px' }}>
                No marketplace adapter is configured for this channel. You can still create and
                keep this listing in Trioloo; it simply cannot be published until one is supplied.
              </p>
            )}

            <Divider />

            {editing && mode.existing && (
              <>
                <Divider />
                <Row>
                  <div style={{ minWidth: 0 }}>
                    <div style={label}>External listing ID</div>
                    {/*
                      🔴 CHANNEL-OWNED AND READ ONLY (`PRD-188.c`). It is never a text field:
                      an operator typing one would be inventing a marketplace fact.
                    */}
                    <div data-testid="edit-external-id" style={{ ...readOnlyValue, fontFamily: 'var(--font-family-mono)' }}>
                      {mode.existing.externalListingId ?? 'Not published'}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={label}>Mapping</div>
                    {/*
                      ⚠ A HANDOFF, not a control. Mapping is per orderable SKU and is its own
                      workflow; an uncontrolled dropdown here would map the wrong unit.
                    */}
                    <div data-testid="edit-mapping-summary" style={{ ...readOnlyValue, justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ overflowWrap: 'anywhere' }}>{describeMapping(mode.existing)}</span>
                      {/*
                        🔴 A COMPACT HANDOFF, never a dropdown in the form (§7). Mapping is an
                        explicit operation with its own confirmation and its own transaction —
                        an uncontrolled select here would make it a side effect of typing.
                      */}
                      {mayManage && (
                        <button
                          type="button"
                          data-testid="edit-open-mapping"
                          onClick={() => setMappingOpen(true)}
                          style={{ ...smallSecondary, flexShrink: 0 }}
                        >
                          {mode.existing.mappedSkuCount === 0 ? 'Map' : 'Change mapping'}
                        </button>
                      )}
                    </div>
                  </div>
                </Row>
              </>
            )}

            {/*
              🔴 ONE CONTENT LANGUAGE CONTROL FOR THE WHOLE PAGE. It decides which language
              the title, description and highlights are being authored in, and which language
              AI Assist writes in. A second switch elsewhere would let two halves of one form
              disagree about what the operator is writing.

              ⚠ `PRD-200` — AI Assist sits BESIDE it, not as a page action. Manual authoring is
              first-class and the dark primary remains Save listing.
            */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontWeight: 600 }}>
                  Content language
                </span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button type="button" data-testid="language-en" onClick={() => setLanguage('EN')} style={modeChip(language === 'EN')}>
                    English
                  </button>
                  <button type="button" data-testid="language-bn" onClick={() => setLanguage('BN')} style={modeChip(language === 'BN')}>
                    বাংলা
                  </button>
                </div>
              </div>
              <button type="button" data-testid="ai-assist-open" onClick={() => setAiOpen(true)} style={smallSecondary}>
                AI Assist
              </button>
            </div>

            <Field
              label="Listing title"
              error={errors.intendedTitle}
              htmlFor="create-title"
              refs={fieldRefs}
              name="intendedTitle"
              hint="What shoppers see on the channel"
              /*
                ⚠ MIRRORED AS RECEIVED. The channel's title is shown exactly as the channel
                reports it, in whatever language it was written — no translation, and no
                substitution from another attribute (`DZC-026`).
              */
              reported={reportedFor(
                mode.existing?.channelReportedTitle ?? null,
                mode.existing?.reportedTitleReadable ?? false,
                draft.intendedTitle,
              )}
            >
              <input
                id="create-title"
                data-testid="field-intended-title"
                value={draft.intendedTitle}
                onChange={(event) => set('intendedTitle', event.target.value)}
                style={control(Boolean(errors.intendedTitle))}
              />
            </Field>

            {language === 'BN' && (
              <div style={{ marginTop: '12px' }}>
                <div style={label}>Listing title — বাংলা</div>
                <input
                  data-testid="field-intended-title-bn"
                  aria-label="Listing title in Bangla"
                  value={draft.intendedTitleBn}
                  onChange={(event) => set('intendedTitleBn', event.target.value)}
                  style={control(false)}
                />
                <FallbackNote testId="title-bn-fallback" blank={!draft.intendedTitleBn.trim()} />
              </div>
            )}

            {!editing && (
            /*
              ⚠ MAPPING IS NOT AUTHORED HERE ON EDIT. An existing listing may carry several
              orderable SKUs, each mapped separately; one picker could only ever address the
              first, so edit hands off to the mapping workflow instead (see Mapping, above).
            */
            <div style={{ marginTop: '14px' }}>
              <div style={label}>Sellable Product</div>
              <SellableProductPicker
                chosen={product}
                onChoose={(chosen) => {
                  setProduct(chosen);
                  set('mappedSellableSku', chosen?.sellableSku ?? '');
                  /*
                    ⚠ Master content SEEDS the intended title when the operator has not written
                    one. It never overwrites what they wrote, and it is a copy from this moment
                    on: editing it changes this listing only, never the Sellable Product.
                  */
                  if (chosen && !draft.intendedTitle.trim()) {
                    set('intendedTitle', chosen.name);
                  }
                }}
              />
              <p style={{ ...note, marginTop: '8px' }}>
                One Sellable Product per orderable channel SKU. Leaving this empty is valid — an
                unmapped listing is an ordinary state, not an error — but ERP values cannot be
                pushed until it is mapped.
              </p>
            </div>
            )}

            <Divider />

            <div>
              <div style={label}>Channel category</div>
              {/*
                🔴 THE CATEGORY VOCABULARY BELONGS TO THE CHANNEL and is supplied by its
                adapter (`API-067`). Until a channel is chosen there is no vocabulary at all,
                so the field is inert and carries NO example path: a realistic-looking category
                sitting in a grey field is indistinguishable from loaded channel data.
              */}
              <input
                data-testid="field-channel-category"
                aria-label="Channel category"
                value={draft.intendedChannelCategory}
                disabled={channel === null}
                onChange={(event) => set('intendedChannelCategory', event.target.value)}
                style={{
                  ...control(false),
                  background: channel === null ? 'var(--color-strip)' : 'var(--color-surface)',
                  color: channel === null ? 'var(--color-placeholder)' : 'var(--color-text-primary)',
                }}
              />
              <p data-testid="create-category-note" style={{ ...note, marginTop: '7px' }}>
                {channel === null
                  ? 'Choose a channel and shop to load supported channel categories.'
                  : channel.adapterAvailable
                    ? 'Supplied by the channel adapter and owned by the channel, not by the Sellable Product.'
                    : 'This channel has no adapter, so no category tree can be loaded or browsed. What you type is kept as intended text and is not a channel category identifier.'}
              </p>
            </div>

            <Divider />

            <div>
              <div style={label}>Listing images</div>
              {/*
                🔴 `PRD-170` — effective media resolves ALL-OR-NOTHING: the listing's own
                override where it holds one, otherwise the mapped Sellable Product's master
                set. The fallback is never materialised, so creation copies nothing — and there
                is no listing to attach an override to until this form is saved.

                ⚠ `MediaRole` currently holds PRIMARY and GALLERY only. A promotion-image,
                description-image or video role is not in the ratified model, so none is
                offered here rather than drawn as an affordance that stores nothing.
              */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
                <div aria-hidden="true" data-testid="create-media-placeholder" style={mediaBlock} />
                <p data-testid="create-media-note" style={{ ...note, flex: 1 }}>
                  {product === null
                    ? 'With no Sellable Product mapped there is no master media to inherit. Images are added on the Listing once it exists.'
                    : `This listing will show ${product.name}'s media until you add a listing-specific override. Nothing is copied, and no image is promoted to primary automatically.`}
                </p>
              </div>
            </div>
          </Section>

          {/* ================================================================ B */}
          <Section id="specification" title="Product specification" meta={readiness.specificationMeta}>
            {/*
              🔴 `API-063` — an attribute schema is DECLARED by the adapter, per channel and
              per category. No adapter means no schema, and inventing controls for attributes
              nobody declared would teach the operator a marketplace that does not exist here.
            */}
            <p data-testid="create-specification-note" style={note}>
              {channel === null
                ? 'Choose a channel and shop, then a channel category, to load its specification schema. The adapter declares which attributes exist and which are required.'
                : channel.adapterAvailable
                  ? 'This channel declares a specification schema. Required attributes are shown first; the rest follow once the category is chosen.'
                  : 'No marketplace specification schema is available for this channel. Nothing is required here, and this does not block saving.'}
            </p>
          </Section>

          {/* ================================================================ C */}
          <Section
            id="commercial"
            title="Price, stock and variants"
            meta={
              /*
                ⚠ On EDIT these report what the listing IS. On ADD they report what creation
                produces — one orderable unit — rather than offering a choice the create path
                does not have.
              */
              <div style={{ display: 'flex', gap: '6px' }}>
                <span data-testid="sku-mode-single" style={modeChip(!perSkuOnly)}>Single SKU</span>
                <span data-testid="sku-mode-multiple" style={modeChip(perSkuOnly)}>
                  {perSkuOnly ? `${skuCount} SKUs` : 'Multiple SKUs'}
                </span>
              </div>
            }
          >
            {perSkuOnly && mode.existing && (
              <div data-testid="per-sku-only-notice" style={perSkuNotice}>
                <div style={{ fontWeight: 700, color: 'var(--color-heading-ink)', marginBottom: '4px' }}>
                  This listing has {skuCount} orderable SKUs
                </div>
                Price, stock and parcel belong to each SKU separately, so they are not edited
                here — one listing-level figure cannot stand for {skuCount} different ones. The
                content below is listing-wide and is still editable.
                <div style={{ marginTop: '9px' }}>
                  <Link to={`/inventory/products/listings/${mode.existing.id}`} style={{ ...smallSecondary, textDecoration: 'none' }}>
                    Edit each SKU
                  </Link>
                </div>
              </div>
            )}

            {/*
              🔴 `PRD-199` — ONE base price and an OPTIONAL, time-bounded promotion. There is
              no MRP, no Regular Price and no Discount Price: the discount is the OUTCOME of
              the two prices and is never stored as a competing third figure.
            */}
            <Row three>
              <Field label="Sale Price" error={errors.salePrice} htmlFor="create-sale-price" refs={fieldRefs} name="salePrice" hint="The normal price"
                reported={reportedFor(mode.existing?.reportedSalePrice ?? null, mode.existing?.reportedSalePriceReadable ?? false, draft.salePrice)}>
                <input
                  id="create-sale-price"
                  data-testid="field-sale-price"
                  disabled={perSkuOnly}
                  inputMode="decimal"
                  value={draft.salePrice}
                  onChange={(event) => set('salePrice', event.target.value)}
                  style={control(Boolean(errors.salePrice), perSkuOnly)}
                />
              </Field>
              <Field label="Listing stock" error={errors.publishedMarketplaceStock} htmlFor="create-stock" refs={fieldRefs} name="publishedMarketplaceStock" hint="Offered on this channel"
                reported={reportedFor(mode.existing?.reportedStock ?? null, mode.existing?.reportedStockReadable ?? false, draft.publishedMarketplaceStock)}>
                <input
                  id="create-stock"
                  data-testid="field-published-stock"
                  disabled={perSkuOnly}
                  inputMode="numeric"
                  value={draft.publishedMarketplaceStock}
                  onChange={(event) => set('publishedMarketplaceStock', event.target.value)}
                  style={control(Boolean(errors.publishedMarketplaceStock), perSkuOnly)}
                />
              </Field>
              <div style={{ minWidth: 0 }}>
                <div style={label}>Publication intent</div>
                <select
                  data-testid="field-publication-intent"
                  aria-label="Publication intent"
                  value={draft.publicationIntent}
                  onChange={(event) => set('publicationIntent', event.target.value)}
                  style={control(false)}
                >
                  {PUBLICATION_INTENTS.map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </div>
            </Row>

            {/*
              🔴 `PRD-193` — Listing stock is HELD ON THE LISTING and maintained by hand. It
              is not warehouse inventory, is not derived from a stock position, and changing it
              here changes stock nowhere else.
            */}
            <p data-testid="create-stock-note" style={{ ...note, marginTop: '8px' }}>
              Listing stock is held on the listing. Trioloo does not adjust it from warehouse
              inventory, and changing it here does not change stock anywhere else. Publication
              intent is Trioloo's own — it is not the channel's listing status.
            </p>

            <Divider />

            {/*
              ⚠ PROGRESSIVE DISCLOSURE. Most listings carry no promotion, and four empty
              controls on every one of them would imply a decision nobody is making. The
              canonical values stay one click away, and removing the promotion clears all three
              together — a stranded window would be a schedule for a price that does not exist.
            */}
            {!promotionOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
                <div style={{ ...label, marginBottom: 0, flexShrink: 0 }}>Promotion</div>
                <button
                  type="button"
                  data-testid="add-promotion"
                  disabled={perSkuOnly}
                  onClick={() => setPromotionOpen(true)}
                  style={perSkuOnly
                    ? { ...smallSecondary, color: 'var(--color-text-demoted)', cursor: 'not-allowed' }
                    : smallSecondary}
                >
                  Add promotion
                </button>
                <span style={{ ...note, minWidth: 0 }}>Optional. A temporary price for a fixed window.</span>
              </div>
            ) : (
              <div data-testid="promotion-fields">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ ...label, marginBottom: 0 }}>Promotion</div>
                  <button
                    type="button"
                    data-testid="remove-promotion"
                    onClick={() => {
                      setPromotionOpen(false);
                      setDraft((current) => ({ ...current, promotionPrice: '', promotionStartsAt: '', promotionEndsAt: '' }));
                      setErrors((current) => {
                        const next = { ...current };
                        delete next.promotionPrice;
                        delete next.promotionStartsAt;
                        delete next.promotionEndsAt;
                        return next;
                      });
                    }}
                    style={smallSecondary}
                  >
                    Remove promotion
                  </button>
                </div>
                <Row three>
                  <Field label="Promotion Price" error={errors.promotionPrice} htmlFor="create-promotion-price" refs={fieldRefs} name="promotionPrice" hint="Not above Sale Price"
                    reported={reportedFor(mode.existing?.reportedPromotionPrice ?? null, mode.existing?.reportedPromotionPriceReadable ?? false, draft.promotionPrice)}>
                    <input
                      id="create-promotion-price"
                      data-testid="field-promotion-price"
                      disabled={perSkuOnly}
                      inputMode="decimal"
                      value={draft.promotionPrice}
                      onChange={(event) => set('promotionPrice', event.target.value)}
                      style={control(Boolean(errors.promotionPrice), perSkuOnly)}
                    />
                  </Field>
                  <Field label="Promotion Starts" error={errors.promotionStartsAt} htmlFor="create-promotion-starts" refs={fieldRefs} name="promotionStartsAt">
                    <input
                      id="create-promotion-starts"
                      data-testid="field-promotion-starts"
                      disabled={perSkuOnly}
                      type="datetime-local"
                      value={draft.promotionStartsAt}
                      onChange={(event) => set('promotionStartsAt', event.target.value)}
                      style={control(Boolean(errors.promotionStartsAt), perSkuOnly)}
                    />
                  </Field>
                  <Field label="Promotion Ends" error={errors.promotionEndsAt} htmlFor="create-promotion-ends" refs={fieldRefs} name="promotionEndsAt">
                    <input
                      id="create-promotion-ends"
                      data-testid="field-promotion-ends"
                      disabled={perSkuOnly}
                      type="datetime-local"
                      value={draft.promotionEndsAt}
                      onChange={(event) => set('promotionEndsAt', event.target.value)}
                      style={control(Boolean(errors.promotionEndsAt), perSkuOnly)}
                    />
                  </Field>
                </Row>
              </div>
            )}

            {/*
              ⚠ A read-back of the OFFER in the money language, so a typo is visible here.

              🔴 SUPPRESSED on a variation listing. There is no single offer to read back —
              narrating one price as "the" price would contradict the notice above it.
            */}
            {!perSkuOnly && (
              <p data-testid="create-price-preview" style={{ ...note, marginTop: '9px' }}>
                {priceSentence(draft.salePrice, draft.promotionPrice)}
              </p>
            )}

            <Divider />

            {/*
              🔴 `INV-106.1` — a Listing always has at least one ORDERABLE unit, and that unit
              is an `E-106` Channel Listing SKU. It is never a Stock Item variant standing in
              for one, and a marketplace variation structure never creates Product variant axes.
            */}
            <Row>
              {sellerSkuLocked ? (
                /*
                  🔴 RATIFIED — SELLER SKU IS IMMUTABLE ONCE REMOTE IDENTITY EXISTS. It is how
                  the channel and the ERP agree which orderable unit is which, so renaming a
                  published one would silently re-point a live marketplace unit. Changing it
                  later is a relist / identity-management workflow, not an ordinary edit.

                  ⚠ A variation listing is locked here for a different reason: it has several
                  Seller SKUs and one control could only ever address the first.
                */
                <div style={{ minWidth: 0 }}>
                  <div style={label}>Seller SKU</div>
                  <div data-testid="edit-channel-sku-readonly" style={{ ...readOnlyValue, fontFamily: 'var(--font-family-mono)' }}>
                    {skuCount > 1
                      ? `${skuCount} orderable units`
                      : mode.existing?.skus[0]?.channelSku ?? 'Not set'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--color-placeholder)', marginTop: '4px' }}>
                    {skuCount > 1
                      ? 'Maintained per orderable unit on the Listing'
                      : 'Fixed once the marketplace issued this listing an identity'}
                  </div>
                </div>
              ) : (
              <Field label="Seller SKU" htmlFor="create-channel-sku" refs={fieldRefs} name="channelSku" hint="Your identifier for this orderable unit">
                <input
                  id="create-channel-sku"
                  data-testid="field-channel-sku"
                  value={draft.channelSku}
                  onChange={(event) => set('channelSku', event.target.value)}
                  style={{ ...control(false), fontFamily: 'var(--font-family-mono)' }}
                />
              </Field>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={label}>Orderable units</div>
                <p data-testid="create-sku-note" style={note}>
                  {!editing
                    ? 'Created with one orderable channel SKU carrying the commercial values above. A variation listing holds several, each with its own Seller SKU, figures and mapping; those are added on the Listing after it exists.'
                    : skuCount > 1
                      ? 'Seller SKUs, per-SKU figures and mapping are maintained on the Listing itself, where each orderable unit is addressed on its own.'
                      : published
                        ? 'This unit has a marketplace identity, so its Seller SKU is fixed. Per-SKU figures and mapping are maintained on the Listing.'
                        : 'This listing is not on the marketplace yet, so the Seller SKU can still be corrected. It becomes fixed once the channel issues an identity.'}
                </p>
              </div>
            </Row>
          </Section>

          {/* ================================================================ D */}
          <Section
            id="description"
            title="Product description"
            meta={
              /*
                ⚠ ONE language control only, and it lives in Basic information. This section
                follows it. A second switch here would let two halves of one form disagree
                about which language the operator is writing.
              */
              <span data-testid="description-language" style={{ fontSize: '11px', color: 'var(--color-text-demoted)' }}>
                {language === 'EN' ? 'English' : 'বাংলা'}
              </span>
            }
          >
            <div>
              <div style={label}>Description{language === 'BN' ? ' — বাংলা' : ''}</div>
              <textarea
                data-testid={language === 'EN' ? 'field-intended-description' : 'field-intended-description-bn'}
                aria-label={language === 'EN' ? 'Description' : 'Description in Bangla'}
                value={language === 'EN' ? draft.intendedDescription : draft.intendedDescriptionBn}
                onChange={(event) => set(language === 'EN' ? 'intendedDescription' : 'intendedDescriptionBn', event.target.value)}
                rows={5}
                style={{ ...control(false), height: '100px', padding: '9px 11px', lineHeight: 1.6, resize: 'vertical' }}
              />
              {language === 'BN' && (
                <FallbackNote testId="description-bn-fallback" blank={!draft.intendedDescriptionBn.trim()} />
              )}
              {/*
                ⚠ READ-ONLY CONTEXT, ENGLISH SIDE ONLY. The channel reports ONE description
                (`PRD-181`), so it is shown against the English field the pull's value
                corresponds to and never against the Bangla override (`PRD-202.b`).

                🔴 THE VALUE IS NOT TRUNCATED. A marketplace description is often long HTML;
                it is CLAMPED VISUALLY and scrolls, so what is shown is always the whole thing
                rather than a shortened version that would misstate what the channel said.
              */}
              {language === 'EN' && reportedFor(
                mode.existing?.reportedDescription ?? null,
                mode.existing?.reportedDescriptionReadable ?? false,
                draft.intendedDescription,
              ) && (
                <div
                  data-testid="reported-intendedDescription"
                  style={{
                    fontSize: '10.5px',
                    color: 'var(--color-text-secondary)',
                    marginTop: '4px',
                    maxHeight: '72px',
                    overflowY: 'auto',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <span style={{ color: 'var(--color-placeholder)' }}>Channel reports: </span>
                  {mode.existing?.reportedDescription}
                </div>
              )}
            </div>

            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                <div style={label}>Highlights{language === 'BN' ? ' — বাংলা' : ''}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-placeholder)' }}>
                  {activeHighlights.length === 0
                    ? 'Optional'
                    : `${activeHighlights.length} highlight${activeHighlights.length === 1 ? '' : 's'}`}
                </div>
              </div>
              {/*
                🔴 `PRD-198.b` — ONE PER LINE, and the line order IS the authored order. The
                textarea is an input shape; each surviving line becomes one ordered canonical
                record. Reordering is editing the lines.

                🔴 `PRD-202.f` — ONE BOX PER LANGUAGE, because the sets fall back
                ALL-OR-NOTHING. A shared box with mixed lines would be the per-line merge the
                rule forbids.
              */}
              <textarea
                data-testid={language === 'EN' ? 'field-highlights' : 'field-highlights-bn'}
                aria-label={language === 'EN' ? 'Highlights' : 'Highlights in Bangla'}
                value={language === 'EN' ? draft.highlights : draft.highlightsBn}
                onChange={(event) => set(language === 'EN' ? 'highlights' : 'highlightsBn', event.target.value)}
                rows={5}
                style={{ ...control(false), height: '100px', padding: '9px 11px', lineHeight: 1.7, resize: 'vertical' }}
              />
              {language === 'BN' ? (
                <FallbackNote testId="highlights-bn-fallback" blank={activeHighlights.length === 0} whole />
              ) : (
                <p style={{ ...note, marginTop: '6px' }}>
                  One highlight per line. Blank lines are ignored. Order is preserved. Channels
                  that accept no highlights receive the description only — the highlights are
                  kept, simply not sent.
                </p>
              )}
            </div>
          </Section>

          {/* ================================================================ E */}
          <Section id="shipping" title="Shipping and warranty">
            {/*
              🔴 `PRD-201.b` — THE PACKAGE FACTS ARE AUTHORABLE UNCONDITIONALLY. No channel,
              no adapter and no declared schema is consulted: a marketplace requirement is a
              reason to SEND a parcel weight, never a precondition for writing it down. They
              are never hidden behind a channel selection.

              🔴 `PRD-201.c` — they are recorded against the ORDERABLE SKU, which for this
              non-variation listing is the single SKU created below.

              🔴 `PRD-201.d` — this is the SHIPPING CARTON, including wrapping and filler. It
              is NOT the product's own measured size.
            */}
            <div style={label}>Package information</div>
            <Row three>
              <Field label="Package weight" error={errors.packageWeightKg} htmlFor="create-pkg-weight" refs={fieldRefs} name="packageWeightKg" hint="Kilograms">
                <input
                  id="create-pkg-weight"
                  data-testid="field-package-weight"
                  disabled={perSkuOnly}
                  inputMode="decimal"
                  value={draft.packageWeightKg}
                  onChange={(event) => set('packageWeightKg', event.target.value)}
                  style={control(Boolean(errors.packageWeightKg), perSkuOnly)}
                />
              </Field>
              <div />
              <div />
            </Row>

            <div style={{ marginTop: '12px' }}>
              <div style={label}>Package dimensions</div>
              {/* ⚠ One structured row: Length × Width × Height, all centimetres. */}
              <Row three>
                <Field label="Length" error={errors.packageLengthCm} htmlFor="create-pkg-length" refs={fieldRefs} name="packageLengthCm" hint="Centimetres">
                  <input
                    id="create-pkg-length"
                    data-testid="field-package-length"
                    disabled={perSkuOnly}
                    inputMode="decimal"
                    value={draft.packageLengthCm}
                    onChange={(event) => set('packageLengthCm', event.target.value)}
                    style={control(Boolean(errors.packageLengthCm), perSkuOnly)}
                  />
                </Field>
                <Field label="Width" error={errors.packageWidthCm} htmlFor="create-pkg-width" refs={fieldRefs} name="packageWidthCm" hint="Centimetres">
                  <input
                    id="create-pkg-width"
                    data-testid="field-package-width"
                    disabled={perSkuOnly}
                    inputMode="decimal"
                    value={draft.packageWidthCm}
                    onChange={(event) => set('packageWidthCm', event.target.value)}
                    style={control(Boolean(errors.packageWidthCm), perSkuOnly)}
                  />
                </Field>
                <Field label="Height" error={errors.packageHeightCm} htmlFor="create-pkg-height" refs={fieldRefs} name="packageHeightCm" hint="Centimetres">
                  <input
                    id="create-pkg-height"
                    data-testid="field-package-height"
                    disabled={perSkuOnly}
                    inputMode="decimal"
                    value={draft.packageHeightCm}
                    onChange={(event) => set('packageHeightCm', event.target.value)}
                    style={control(Boolean(errors.packageHeightCm), perSkuOnly)}
                  />
                </Field>
              </Row>
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={label}>What's in the box</div>
              <textarea
                data-testid="field-package-content"
                disabled={perSkuOnly}
                aria-label="What's in the box"
                value={draft.packageContent}
                onChange={(event) => set('packageContent', event.target.value)}
                rows={3}
                style={{ ...control(false, perSkuOnly), height: '64px', padding: '9px 11px', lineHeight: 1.6, resize: 'vertical' }}
              />
            </div>

            <p data-testid="create-package-note" style={{ ...note, marginTop: '8px' }}>
              Package information is stored with the Listing and used when a channel requires
              it. It describes the shipping carton, not the product's own size, and it is never
              derived from warehouse inventory.
            </p>

            <Divider />

            <div style={label}>Channel shipping and warranty requirements</div>
            {/*
              🔴 SEPARATE FROM THE ABOVE. Dangerous goods, warranty type, warranty period,
              warranty policy and return policy are PUBLISHING REQUIREMENTS declared by an
              adapter for a category (`API-063`, `PRD-125`). None is configured, so none is
              drawn — but that absence never hides the canonical package facts above it.

              🔴 Trioloo's own warranty domain (`E-070` Warranty Package) is Product master
              data and is NOT a channel warranty requirement. It is not surfaced here as one.
            */}
            <p data-testid="create-shipping-note" style={note}>
              {channel === null
                ? 'Choose a channel and category to load marketplace-specific shipping and warranty requirements.'
                : channel.adapterAvailable
                  ? 'This channel declares shipping and warranty requirements for the selected category.'
                  : 'No marketplace shipping/warranty schema is available for this channel. Nothing is required here, and this does not block saving.'}
            </p>
          </Section>
        </div>

        <ListingAiAssist
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          language={language}
          /*
            🔴 `PRD-200.f`/`.g` — ONLY what this Listing holds, and a blank value is reported
            to the assistant as ABSENT rather than dropped. That is what stops a warranty
            period nobody recorded coming back as "1 Year Warranty".
          */
          facts={{
            channel: channel?.name ?? null,
            channelType: channel?.channelType ?? null,
            channelCategory: draft.intendedChannelCategory || null,
            sellableProduct: product?.name ?? null,
            sellableSku: product?.sellableSku ?? null,
            title: draft.intendedTitle || null,
            description: draft.intendedDescription || null,
            highlights: highlights.join(' · ') || null,
            salePrice: draft.salePrice || null,
            promotionPrice: draft.promotionPrice || null,
            listingStock: draft.publishedMarketplaceStock || null,
            sellerSku: draft.channelSku || null,
            packageWeightKg: draft.packageWeightKg || null,
            packageContent: draft.packageContent || null,
          }}
          /*
            ⚠ `PRD-200` + §16 — real constraints only. With no adapter there are none, and the
            panel must not claim a marketplace optimised anything against invented rules.
          */
          adapterConstraints={channel?.adapterAvailable ? ['Channel category and attribute schema declared'] : []}
          current={{
            TITLE: language === 'EN' ? draft.intendedTitle : draft.intendedTitleBn,
            DESCRIPTION: language === 'EN' ? draft.intendedDescription : draft.intendedDescriptionBn,
            HIGHLIGHTS: language === 'EN' ? draft.highlights : draft.highlightsBn,
          }}
          onAccept={acceptAiCandidates}
        />

        {/* ============================================================ sidebar F */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: 'var(--space-6)', minWidth: 0 }}>
          <div style={{ ...panel, padding: '14px 16px' }}>
            <div style={panelLabel}>Listing readiness</div>
            {/*
              🔴 THE SAME ENGINE AS SAVE. Every REQUIRED line below is produced by `validate()`
              — the function Save refuses on — so the sidebar can never claim something is
              missing that Save accepts, or accept something Save refuses.

              ⚠ RECOMMENDED lines never block a local Draft (`PRD-188.a`). Marketplace
              readiness is reported, never enforced: no push preflight exists to consult yet,
              and inventing its rules here would create a second validation truth. Nothing is
              scored — a fabricated percentage is a number an operator can act on and a channel
              will ignore.
            */}
            <div data-testid="create-readiness" style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '11px' }}>
              {readiness.groups.map((group) => (
                <div key={group.title}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    {group.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {group.items.map((item) => (
                      <ReadinessLine key={item.text} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: '1px', background: 'var(--color-divider-inner)', margin: '13px 0' }} />
            <p data-testid="create-save-consequence" style={{ ...note, margin: 0 }}>
              {editing
                ? 'Saving stores your changes in Trioloo only. Nothing reaches '
                : 'Saving stores the listing in Trioloo only. Nothing reaches '}
              {channel?.name ?? 'the channel'} until you publish it.
            </p>
            {failure && (
              <p data-testid="create-listing-error" style={{ fontSize: '12px', color: 'var(--color-destructive)', margin: '10px 0 0', lineHeight: 1.5 }}>
                {failure}
              </p>
            )}
            <button
              type="submit"
              data-testid="create-save"
              disabled={busy || (editing && !dirty)}
              style={{ ...sidebarPrimary, marginTop: '11px' }}
            >
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Save listing'}
            </button>
          </div>

          {editing && mode.existing && (
            /*
              🔴 WHAT A SAVE WILL AND WILL NOT DO — stated for THIS listing, not in general.
              `PRD-185.d` — an edit makes the listing carry UNSENT local changes; it does NOT
              make it DIVERGED. Divergence is the channel reporting something different, which
              no local edit can cause.
            */
            <div style={{ ...panel, padding: '13px 16px' }}>
              <div style={panelLabel}>After saving</div>
              <div
                data-testid="edit-after-saving"
                style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginTop: '8px' }}
              >
                {!dirty
                  ? 'Nothing on this page has been saved yet.'
                  : published
                    ? 'Saving stores these changes in Trioloo and marks the listing as carrying unsent local changes, until a push succeeds.'
                    : 'Saving stores these changes in Trioloo. This listing is not on the marketplace yet, so there is nothing to send.'}
              </div>
              <p style={{ ...note, marginTop: '9px' }}>
                Saving never marks the listing diverged — divergence is
                {' '}{mode.existing.channelName ?? 'the channel'} reporting something different
                from what Trioloo intends.
              </p>
              {/*
                🔴 `SYS-034` / `PRD-185` — with no adapter there is nothing that could carry a
                push, and saying so is the honest answer. A greyed promise of a later update
                would be a claim about a capability that does not exist.
              */}
              <p data-testid="edit-push-availability" style={{ ...note, marginTop: '7px' }}>
                {!mode.existing.adapterAvailable
                  ? 'No adapter is configured for this channel, so a push cannot run at all right now.'
                  : 'Pushing is a separate, explicit act and needs its own authority.'}
              </p>
              <p data-testid="edit-last-push" style={{ ...note, marginTop: '7px' }}>
                {mode.existing.lastSuccessfulPushAt
                  ? `Last pushed ${formatMoment(mode.existing.lastSuccessfulPushAt)}`
                  : 'Never pushed'}
              </p>
            </div>
          )}

          <div style={{ ...panel, padding: '13px 16px' }}>
            <div style={panelLabel}>Lifecycle</div>
            {published && mode.existing ? (
              /*
                🔴 AN ALREADY-PUBLISHED LISTING IS NOT BEING CREATED. Showing it the
                first-publication path — DRAFT, then "the channel returns the external listing
                ID" — would describe a transition that already happened years of state ago, for
                a listing whose identifier is on screen. This is the UPDATE path.
              */
              <div data-testid="edit-lifecycle-update" style={lifecycleFlow}>
                Existing marketplace listing<br />
                → Edit Trioloo&rsquo;s intended values<br />
                → Save locally · <strong>UNSENT LOCAL CHANGES</strong><br />
                → Review<br />
                → Push update<br />
                → marketplace readback
              </div>
            ) : (
              /*
                🔴 ONLY a listing the channel has never accepted may show the first-publication
                path (`PRD-188.b`): it is the one case where an external identifier is still
                outstanding.
              */
              <div data-testid="edit-lifecycle-first-publication" style={lifecycleFlow}>
                {editing ? 'Local listing · ' : 'Save locally · '}<strong>DRAFT</strong><br />
                → Review<br />
                → Publish · <strong>PENDING PUBLICATION</strong><br />
                → the channel returns the external listing ID
              </div>
            )}
            <p style={{ ...note, marginTop: '9px' }}>
              {published
                ? 'Saving is local. It never contacts the channel, and it never marks the listing diverged.'
                : 'A listing waiting for its first publication is never marked diverged or failed. The external ID is never typed by hand.'}
            </p>
            {/*
              ⚠ THE CHANNEL'S OWN STATUS, kept SEPARATE from Trioloo's lifecycle (`UX-038`).
              They are independent dimensions and merging them into one line is exactly the
              confusion the four-dimension rule exists to prevent.
            */}
            {editing && mode.existing?.listingStatus && (
              <p data-testid="edit-channel-status" style={{ ...note, marginTop: '7px' }}>
                {mode.existing.channelName ?? 'The channel'} currently reports this listing as
                {' '}<strong>{mode.existing.listingStatus}</strong>.
              </p>
            )}
          </div>
        </div>
      </form>

      {mappingOpen && editing && mode.existing && (
        <MappingModal
          listing={mode.existing}
          onClose={() => setMappingOpen(false)}
          /*
            🔴 `PRD-185` / §28 — THE TRANSACTION BOUNDARIES STAY SEPARATE. The mapping is
            already persisted; this only asks the page to re-read it. It does NOT save the
            form, and Save changes will not touch the mapping.
          */
          onMapped={() => mode.onMappingChanged?.()}
        />
      )}
    </>
  );
}

// =====================================================================================
// Readiness
// =====================================================================================

type ReadinessItem = {
  readonly level: 'required' | 'recommended';
  readonly met: boolean;
  readonly text: string;
};
type ReadinessGroup = { readonly title: string; readonly items: readonly ReadinessItem[] };

/**
 * What the operator still owes, grouped by the section that owns it.
 *
 * <p>🔴 REQUIRED items are derived from `validate()` — the same function Save refuses on — so
 * the two halves of this screen cannot disagree.
 *
 * <p>🔴 RECOMMENDED items never block a local Draft. `PRD-188.a` makes an ERP-first draft a
 * legitimate record, so content quality is reported and never enforced.
 *
 * <p>⚠ Marketplace requirements are NOT scored and NOT invented. No push preflight exists to
 * consult; when one does, this function is where it plugs in, and the sidebar keeps agreeing
 * with Save because both read the one engine.
 */
function deriveReadiness(
  draft: Draft,
  channel: ChannelView | null,
  product: SellableProduct | null,
  highlights: readonly string[],
  highlightsBn: readonly string[],
  problems: Readonly<Record<string, string>>,
  /**
   * 🔴 On a VARIATION listing the listing-level commercial fields are not what gets saved
   * ({@code INV-106.2}). Ticking them would tell the operator a figure is ready when the
   * figure the channel will see lives on each SKU and was never inspected here.
   */
  perSkuOnly: boolean,
  skuCount: number,
  /** How many orderable SKUs are mapped, out of how many — the listing's own truth. */
  mapping: { readonly mapped: number; readonly total: number },
): { readonly groups: readonly ReadinessGroup[]; readonly specificationMeta: React.ReactNode } {
  const required = (key: string, text: string): ReadinessItem =>
    ({ level: 'required', met: !(key in problems), text });
  const advise = (met: boolean, text: string): ReadinessItem =>
    ({ level: 'recommended', met, text });

  const noSchema = channel === null || !channel.adapterAvailable;
  const specificationMeta = (
    <span data-testid="specification-meta" style={{ fontSize: '11px', color: 'var(--color-text-demoted)' }}>
      {noSchema ? 'No schema available' : 'Schema declared by the adapter'}
    </span>
  );

  return {
    specificationMeta,
    groups: [
      {
        title: 'Basic information',
        items: [
          required('channelInstance', draft.channelInstance ? 'Channel and shop selected' : 'Channel and shop not selected'),
          required('intendedTitle', draft.intendedTitle.trim() ? 'Listing title ready' : 'Listing title not entered'),
          /*
            🔴 `PRD-178` — UNMAPPED IS VALID, so this is ADVISORY and never blocks a save. The
            consequence is stated exactly once: Product-derived values cannot be pushed.

            ⚠ A variation listing reports the real count. "Mapped" on a listing where one of
            two SKUs resolves would be a lie the operator only discovers at push time.
          */
          advise(
            mapping.mapped === mapping.total && mapping.total > 0,
            mapping.total > 1
              ? mapping.mapped === mapping.total
                ? `All ${mapping.total} SKUs mapped`
                : `${mapping.mapped} of ${mapping.total} SKUs mapped — unmapped SKUs cannot push Product values`
              : mapping.mapped > 0
                ? `Mapped to ${product?.sellableSku ?? 'a Sellable Product'}`
                : 'Not mapped — valid, but cannot push until mapped',
          ),
          advise(Boolean(draft.intendedChannelCategory.trim()), draft.intendedChannelCategory.trim()
            ? 'Channel category set'
            : 'Channel category not set'),
        ],
      },
      {
        title: 'Product specification',
        // ⚠ Not a score. With no declared schema there is nothing to be complete against.
        items: [advise(!noSchema, noSchema
          ? 'No specification schema is declared for this channel'
          : 'Specification schema available')],
      },
      {
        title: 'Price, stock and variants',
        items: perSkuOnly
          // ⚠ ONE HONEST LINE instead of four ticks about figures this page cannot see.
          ? [advise(false, `Price, stock and Seller SKU are held on each of the ${skuCount} orderable SKUs`)]
          : [
            advise(Boolean(draft.salePrice.trim()), draft.salePrice.trim() ? 'Sale Price set' : 'Sale Price not set'),
            ...(draft.promotionPrice.trim()
              ? [required('promotionPrice', 'Promotion within the Sale Price'),
                 required('promotionStartsAt', 'Promotion start set'),
                 required('promotionEndsAt', 'Promotion end set and ordered')]
              : []),
            advise(Boolean(draft.publishedMarketplaceStock.trim()), draft.publishedMarketplaceStock.trim()
              ? 'Listing stock set' : 'Listing stock not set'),
            advise(Boolean(draft.channelSku.trim()), draft.channelSku.trim() ? 'Seller SKU set' : 'Seller SKU not set'),
          ],
      },
      {
        title: 'Product description',
        items: [
          advise(Boolean(draft.intendedDescription.trim()), draft.intendedDescription.trim()
            ? 'Description written' : 'Description not written'),
          advise(highlights.length > 0, highlights.length > 0
            ? `${highlights.length} highlight${highlights.length === 1 ? '' : 's'}`
            : 'No highlights — optional'),
          /*
            🔴 `PRD-202.c` — readiness reports the EFFECTIVE content, so a listing with no
            Bangla override is COMPLETE rather than missing something. Marking the blank
            override outstanding would invent a requirement the rule explicitly denies.
          */
          advise(true, draft.intendedTitleBn.trim() || draft.intendedDescriptionBn.trim()
              || highlightsBn.length > 0
            ? 'Bangla content authored'
            : 'Bangla content falls back to English'),
        ],
      },
      {
        title: 'Shipping and warranty',
        items: [
          /*
            🔴 `PRD-201.b` — the package facts are LOCAL and authorable unconditionally, so
            they carry their own readiness rather than waiting on a channel. They are
            RECOMMENDED here: no adapter declares them required, and `PRD-188.a` keeps a
            draft saveable without them.
          */
          // 🔴 `PRD-201.c` — the parcel is per orderable unit too. A variation listing has
          //    no single carton, so this page reports where the facts live.
          ...(perSkuOnly
            ? [advise(false, `Parcel facts are held on each of the ${skuCount} orderable SKUs`)]
            : [
              advise(Boolean(draft.packageWeightKg.trim()), draft.packageWeightKg.trim()
                ? 'Package weight set' : 'Package weight not set'),
              advise(hasAllDimensions(draft), hasAllDimensions(draft)
                ? 'Package dimensions set'
                : hasAnyDimension(draft) ? 'Package dimensions incomplete' : 'Package dimensions not set'),
              advise(Boolean(draft.packageContent.trim()), draft.packageContent.trim()
                ? 'Package content set' : 'Package content not set'),
            ]),
          advise(!noSchema, noSchema
            ? 'No channel-specific shipping or warranty schema available'
            : 'Requirements declared by the adapter'),
        ],
      },
    ],
  };
}

/**
 * The one sentence a Bangla field owes the operator when it is blank.
 *
 * <p>🔴 `PRD-202.c` — a blank override is not an empty listing: the English content is
 * what a Bangla reader will actually see. Saying so here is the difference between an
 * operator thinking the field is unfinished and knowing it is deliberately inherited.
 */
function FallbackNote({
  testId,
  blank,
  whole = false,
}: {
  readonly testId: string;
  readonly blank: boolean;
  readonly whole?: boolean;
}): React.JSX.Element {
  return (
    <p data-testid={testId} style={{ ...note, marginTop: '6px' }}>
      {blank
        ? whole
          // 🔴 `PRD-202.f` — the set falls back ENTIRELY. There is no per-line merge.
          ? 'Blank — the English highlights will be used, as a whole set.'
          : 'Blank — English content will be used.'
        : whole
          ? 'One highlight per line. Blank lines are ignored. Order is preserved.'
          : 'This overrides the English content for Bangla readers.'}
    </p>
  );
}

/**
 * Which draft field a candidate lands in, `PRD-202`.
 *
 * 🔴 The AUTHORING LANGUAGE decides it. A Bangla candidate accepted while writing Bangla
 * fills the Bangla override and never overwrites the English content it may have been
 * derived from (`PRD-202.g`).
 */
function fieldForKind(kind: AiAuthoringKind, language: 'EN' | 'BN'): keyof Draft {
  if (kind === 'TITLE') return language === 'EN' ? 'intendedTitle' : 'intendedTitleBn';
  if (kind === 'DESCRIPTION') return language === 'EN' ? 'intendedDescription' : 'intendedDescriptionBn';
  return language === 'EN' ? 'highlights' : 'highlightsBn';
}

/**
 * The operator-facing identity of the listing being edited.
 *
 * <p>🔴 Shop, channel identifier and orderable units — never the UUID. `PRD-188.b`: a
 * listing the channel has not accepted has no identifier, and says so.
 */
function editSubtitle(listing: ChannelListing | null): string {
  if (!listing) return 'Products · Listings';
  return [
    listing.channelName ?? listing.channelInstance,
    listing.externalListingId ?? 'Not published',
    listing.skuCount > 1 ? `${listing.skuCount} orderable SKUs` : listing.skus[0]?.channelSku ?? null,
  ].filter(Boolean).join(' · ');
}

/** ⚠ THE TRUTHFUL AGGREGATE. A partially mapped variation listing says exactly that. */
function describeMapping(listing: ChannelListing): string {
  if (listing.mappedSkuCount === 0) return 'Unmapped';
  if (listing.mappedSkuCount < listing.skuCount) {
    return `${listing.mappedSkuCount} of ${listing.skuCount} SKUs mapped`;
  }
  return listing.mappedSellableSku ?? `${listing.skuCount} SKUs mapped`;
}

/** ⚠ A carton needs all three sides; two of them describe nothing a courier can use. */
function hasAllDimensions(draft: Draft): boolean {
  return Boolean(draft.packageLengthCm.trim() && draft.packageWidthCm.trim() && draft.packageHeightCm.trim());
}
function hasAnyDimension(draft: Draft): boolean {
  return Boolean(draft.packageLengthCm.trim() || draft.packageWidthCm.trim() || draft.packageHeightCm.trim());
}

/**
 * One readiness line.
 *
 * <p>🔴 Monochrome. `RULE 8.4` forbids colour-only state and the ERP has no ratified
 * success/error badge for a readiness list, so the distinction is carried by the marker and
 * its weight — `✓` met, `!` a required item still owed, `·` an ordinary note.
 */
function ReadinessLine({ item }: { readonly item: ReadinessItem }): React.JSX.Element {
  const state = item.met ? 'ready' : item.level === 'required' ? 'outstanding' : 'note';
  return (
    <div data-testid={`readiness-${state}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{
          fontSize: '11.5px',
          fontWeight: state === 'note' ? 700 : 800,
          color: state === 'ready' ? 'var(--color-ink)' : 'var(--color-text-demoted)',
          width: '8px',
          flexShrink: 0,
        }}
      >
        {state === 'ready' ? '✓' : state === 'outstanding' ? '!' : '·'}
      </span>
      <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
        {item.text}
      </span>
    </div>
  );
}

// =====================================================================================
// Sellable Product
// =====================================================================================

/**
 * The creation-time Sellable Product selector.
 *
 * <p>🔴 `PRD-179.b` — a suggestion is ADVISORY. Nothing here maps automatically, nothing is
 * matched fuzzily on the operator's behalf, and no Sellable Product is ever created to make a
 * listing resolve.
 */
function SellableProductPicker({
  chosen,
  onChoose,
}: {
  readonly chosen: SellableProduct | null;
  readonly onChoose: (product: SellableProduct | null) => void;
}): React.JSX.Element {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<readonly SellableProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);

  const search = async (): Promise<void> => {
    setSearching(true);
    setFailed(false);
    try {
      const page = await listSellableProducts({ search: term.trim() }, 0, 6, 'sellableSku', 'ASC');
      setResults(page.content);
    } catch {
      // ⚠ A failed search and an empty result are DIFFERENT facts. Showing "nothing found"
      // for a request that never completed would be a quiet lie about the catalogue.
      setResults([]);
      setFailed(true);
    } finally {
      setSearched(true);
      setSearching(false);
    }
  };

  if (chosen) {
    return (
      <div
        data-testid="chosen-sellable-product"
        style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) 130px 84px', gap: '12px', alignItems: 'center', border: '1px solid var(--color-divider-inner)', borderRadius: 'var(--radius-control-small)', padding: '9px 11px', minWidth: 0 }}
      >
        {/* 🔴 `RULE 3.15.a` — the canonical neutral block. No placeholder art, no broken glyph. */}
        <div aria-hidden="true" style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-control-small)', background: 'var(--color-divider-light)' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}>
            {chosen.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', marginTop: '1px', fontFamily: 'var(--font-family-mono)' }}>
            {chosen.sellableSku}
          </div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: 0 }}>{chosen.nature}</div>
        <button type="button" data-testid="change-sellable-product" onClick={() => onChoose(null)} style={smallSecondary}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '9px' }}>
        <input
          data-testid="sellable-search"
          aria-label="Search Sellable Products"
          value={term}
          placeholder="Search by name or Sellable SKU"
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }}
          style={{ ...control(false), flex: 1 }}
        />
        <button type="button" data-testid="sellable-search-run" onClick={() => void search()} style={smallSecondary}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {searched && results.length === 0 && (
        <p data-testid="sellable-no-results" style={{ ...note, marginTop: '7px' }}>
          {failed
            ? 'The Sellable Product search could not be completed. Nothing has been mapped.'
            : term.trim()
              ? `No Sellable Product matches “${term.trim()}”. The listing can still be saved unmapped.`
              : 'No Sellable Products exist yet. The listing can still be saved unmapped.'}
        </p>
      )}
      {results.length > 0 && (
        <div data-testid="sellable-results" style={{ marginTop: '9px', border: '1px solid var(--color-divider-inner)', borderRadius: 'var(--radius-control-small)' }}>
          {results.map((result, index) => (
            <button
              key={result.id}
              type="button"
              data-testid={`sellable-result-${index}`}
              onClick={() => onChoose(result)}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 11px', border: 'none', borderTop: index === 0 ? 'none' : '1px solid var(--color-divider-light)', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 600, overflowWrap: 'anywhere' }}>{result.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontFamily: 'var(--font-family-mono)' }}>
                {result.sellableSku}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================================
// pieces
// =====================================================================================

function Section({
  id,
  title,
  meta,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly meta?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section data-testid={`create-section-${id}`} style={{ ...panel, padding: '15px 17px 17px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-heading-ink)', margin: 0, letterSpacing: '-0.005em' }}>
          {title}
        </h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

/** ⚠ Two or three even columns. Structured rows never wrap — `RULE 7.4`. */
function Row({ children, three = false }: { readonly children: React.ReactNode; readonly three?: boolean }): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: '14px', alignItems: 'start', minWidth: 0 }}>
      {children}
    </div>
  );
}

function Divider(): React.JSX.Element {
  return <div aria-hidden="true" style={{ height: '1px', background: 'var(--color-divider-inner)', margin: '14px 0' }} />;
}

/**
 * One labelled control, with its message attached TO IT.
 *
 * <p>🔴 A validation message belongs beside the field it is about, and is associated with it
 * for a screen reader. A single error block at the top of a five-section form tells an
 * operator that something is wrong and not where.
 */
function Field({
  label: text,
  hint,
  reported,
  error,
  htmlFor,
  name,
  refs,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  /**
   * 🔴 READ-ONLY CONTEXT, NEVER A VALUE THIS FIELD WILL SUBMIT. What the channel currently
   * reports for this same fact, shown so an operator authoring intent can see what they are
   * authoring against.
   *
   * ⚠ It is deliberately NOT placed in the input. `PRD-181.a` keeps intended and reported
   * separate, and `PRD-184.b` makes adopting a reported value an EXPLICIT operator act —
   * pre-filling the box would author intent by page load.
   */
  readonly reported?: string;
  readonly error?: string;
  readonly htmlFor: string;
  readonly name: string;
  readonly refs: React.RefObject<Record<string, HTMLElement | null>>;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div ref={(node) => { refs.current[name] = node; }} style={{ minWidth: 0 }}>
      <label htmlFor={htmlFor} style={label}>{text}</label>
      {children}
      {reported && (
        <div
          data-testid={`reported-${name}`}
          style={{
            fontSize: '10.5px',
            color: 'var(--color-text-secondary)',
            marginTop: '4px',
            overflowWrap: 'anywhere',
          }}
        >
          <span style={{ color: 'var(--color-placeholder)' }}>Channel reports: </span>
          {reported}
        </div>
      )}
      {hint && !error && (
        <div style={{ fontSize: '10.5px', color: 'var(--color-placeholder)', marginTop: '4px' }}>{hint}</div>
      )}
      {error && (
        <div data-testid={`error-${name}`} role="alert" style={{ fontSize: '11.5px', color: 'var(--color-destructive)', marginTop: '4px', lineHeight: 1.45 }}>
          {error}
        </div>
      )}
    </div>
  );
}

/** ⚠ Capability is DECLARED per field and direction. An absent declaration is no support. */
function describeCapabilities(channel: ChannelView): string {
  if (!channel.adapterAvailable) {
    return 'No adapter is configured, so this channel declares no capability at all.';
  }
  const writable = channel.capabilities.filter((c: CapabilityView) => c.writable).map((c) => c.fieldKey);
  return writable.length === 0
    ? 'This adapter declares no writable field yet.'
    : `Can send: ${writable.join(' · ')}`;
}

/**
 * 🔴 String money, read back in the display language. Never parsed into a Number.
 *
 * <p>⚠ It describes the OFFER, not the current price: whether the promotion is in force
 * depends on the clock and is the server's answer (`PRD-199.d`), not this form's.
 */
function priceSentence(salePrice: string, promotionPrice: string): string {
  const s = salePrice.trim();
  const p = promotionPrice.trim();
  if (!s && !p) {
    return 'No price set yet. A listing may be saved without one.';
  }
  if (!s) {
    return `Only a Promotion Price is set: ${formatMoneyForDisplay(p)}. A promotion reduces the Sale Price, so set that too.`;
  }
  if (!p) {
    return `${formatMoneyForDisplay(s)} at all times — no promotion scheduled.`;
  }
  const order = compareDecimalStrings(p, s);
  if (order === 0) {
    return `${formatMoneyForDisplay(s)} with no reduction — the Promotion Price equals the Sale Price, which is valid.`;
  }
  if (order > 0) {
    /*
      🔴 A promotion ABOVE the base price is not a promotion — it is a price rise. Narrating
      it as "reduced to" would state a saving the shopper would never get, so the pair is
      named as the contradiction it is.
    */
    return `Promotion Price ${formatMoneyForDisplay(p)} is above the Sale Price ${formatMoneyForDisplay(s)}. That is not a promotion and cannot be saved.`;
  }
  return `${formatMoneyForDisplay(s)} normally, ${formatMoneyForDisplay(p)} while the promotion runs.`;
}

/**
 * A `datetime-local` value as an ISO-8601 instant, or `null`.
 *
 * <p>⚠ The control yields wall-clock text with no offset. It is converted through the
 * operator's own timezone, which is what they meant when they typed it — the server is never
 * left to guess a zone.
 */
function toInstant(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const panel: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-card-small)',
};
const panelLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};
const label: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--color-text-demoted)',
  fontWeight: 600,
  marginBottom: '5px',
};
const note: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-demoted)',
  lineHeight: 1.55,
  margin: 0,
};
/** ⚠ States a constraint and offers the surface that CAN do it. Never a bare refusal. */
/** ⚠ One flow, one line height. The steps read as a sequence, not as prose. */
const lifecycleFlow: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.85,
  marginTop: '8px',
};

const perSkuNotice: React.CSSProperties = {
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-strip)',
  padding: '11px 13px',
  marginBottom: '14px',
  fontSize: '11.5px',
  lineHeight: 1.7,
  color: 'var(--color-text-secondary)',
};

/** ⚠ Reads as a value, not as a control — nothing here invites a click. */
const readOnlyValue: React.CSSProperties = {
  minHeight: 'var(--control-height-form)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 11px',
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control-small)',
  background: 'var(--color-strip)',
  fontSize: '12.5px',
  color: 'var(--color-text-secondary)',
  minWidth: 0,
};
const mediaBlock: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: 'var(--radius-control-small)',
  background: 'var(--color-divider-light)',
  flexShrink: 0,
};

function control(invalid: boolean, unavailable = false): React.CSSProperties {
  return {
    width: '100%',
    height: 'var(--control-height-form)',
    borderRadius: 'var(--radius-control-small)',
    // 🔴 An invalid field is marked on the field itself, not by colouring the page.
    border: `1px solid ${invalid ? 'var(--color-destructive)' : 'var(--color-border-form-control)'}`,
    padding: '0 11px',
    fontSize: '12.5px',
    fontFamily: 'inherit',
    /*
      🔴 AN UNAVAILABLE CONTROL MUST READ AS ONE. The custom background would otherwise
      override the browser's own disabled treatment and leave a dead field looking editable —
      an operator would type into it and watch nothing happen.
    */
    color: unavailable ? 'var(--color-text-demoted)' : 'var(--color-text-primary)',
    background: unavailable ? 'var(--color-strip)' : 'var(--color-surface)',
    cursor: unavailable ? 'not-allowed' : undefined,
    minWidth: 0,
  };
}

function modeChip(active: boolean): React.CSSProperties {
  return {
    height: '26px',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 10px',
    border: active ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-control)',
    borderRadius: 'var(--radius-control-small)',
    fontSize: '11.5px',
    fontWeight: active ? 700 : 600,
    color: active ? 'var(--color-heading-ink)' : 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  };
}

const headerSecondary: React.CSSProperties = { ...buttonStyle('secondary', 'page-header'), gap: 'var(--space-2)', textDecoration: 'none' };
const headerPrimary: React.CSSProperties = { ...buttonStyle('primary', 'page-header'), gap: 'var(--space-2)' };
const secondaryButton: React.CSSProperties = { ...buttonStyle('secondary', 'button'), textDecoration: 'none', display: 'inline-flex' };
const smallSecondary: React.CSSProperties = { ...buttonStyle('secondary', 'row-action'), fontSize: '11.5px' };
const sidebarPrimary: React.CSSProperties = { ...buttonStyle('primary', 'button'), width: '100%', justifyContent: 'center' };
