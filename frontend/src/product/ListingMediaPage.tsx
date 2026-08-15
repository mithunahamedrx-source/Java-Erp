import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../shell/AppShell';
import { ACTION_ICON, ACTION_ICON_SIZE, ACTION_ICON_STROKE } from '../shell/icons';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { ConfirmDialog } from '../ui/Overlay';
import { formatMoment } from '../platform/datetime';
import {
  acceptReportedMedia,
  fetchChannelListing,
  fetchMedia,
  replaceMedia,
} from './channelListingApi';
import type { ChannelListing, MediaSetView, MediaView } from './channelListingApi';

/**
 * FRAME 13 — Manage Media.
 *
 * <p>🔴 THREE MEDIA TRUTHS, NEVER COLLAPSED INTO ONE GALLERY (`PRD-182`):
 *
 * <ul>
 *   <li><b>A · Sellable Product master</b> — `E-058`-owned, reusable on every channel,
 *       READ-ONLY here. Nothing on this page can change it (`PRD-184.c`).</li>
 *   <li><b>B · Listing intended</b> — this listing's own override. The only editable set.</li>
 *   <li><b>C · Marketplace reported</b> — mirrored channel evidence, READ-ONLY, never an
 *       `E-105` asset (`PRD-182.b`).</li>
 * </ul>
 *
 * <p>🔴 `PRD-170` — EFFECTIVE MEDIA IS ALL-OR-NOTHING. Any override at all replaces the
 * master set entirely; there is no per-slot merge. The fallback is DERIVED on read and is
 * never materialised as listing-owned rows (`PRD-170.b`) — opening this page creates nothing.
 *
 * <p>🔴 `PRD-185` — EVERY ACTION HERE IS LOCAL. Saving media records ERP intent and stops: it
 * does not push, publish, refresh or contact the marketplace, and it needs no adapter.
 */

/** One row of the editable draft: an asset reference plus its explicit position and role. */
type DraftItem = {
  readonly mediaAssetId: string;
  readonly storageReference: string;
  readonly primary: boolean;
};

export default function ListingMediaPage(): React.JSX.Element {
  const { id } = useParams();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  // 🔴 `PRD-196.a` — organising LOCAL media needs manage. It never needs publish.
  const mayManage = permissions.includes('product.channel-listing.manage');

  const [listing, setListing] = useState<ChannelListing | null>(null);
  const [media, setMedia] = useState<MediaSetView | null>(null);
  const [draft, setDraft] = useState<readonly DraftItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ readonly replacing: number | null } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const load = useCallback(async (): Promise<void> => {
    if (!id) return;
    try {
      const [found, set] = await Promise.all([fetchChannelListing(id), fetchMedia(id)]);
      setListing(found);
      setMedia(set);
      /*
        🔴 THE DRAFT IS SEEDED FROM THE OVERRIDE ONLY, NEVER FROM THE FALLBACK. Seeding it
        with master media would turn opening this page into creating an override — exactly
        what `PRD-170.b` forbids.
      */
      setDraft(set.intended.map(toDraft));
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'The media could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const original = useMemo(() => (media?.intended ?? []).map(toDraft), [media]);
  const dirty = useMemo(
    () => draft !== null && !sameSet(draft, original),
    [draft, original],
  );

  /** 🔴 `PRD-170` — derived here exactly as the server derives it, never guessed. */
  const overrideExists = (draft?.length ?? 0) > 0;
  const savedOverrideExists = original.length > 0;
  const effective: readonly MediaView[] = overrideExists
    ? (draft ?? []).map((d, index) => asView(d, index))
    : media?.master ?? [];

  const save = async (): Promise<void> => {
    if (!id || draft === null) return;
    setBusy(true);
    setFailure(null);
    try {
      await replaceMedia(id, draft.map((d) => ({ mediaAssetId: d.mediaAssetId, primary: d.primary })));
      setNotice(draft.length === 0
        ? 'Override removed. This listing uses the Sellable Product media again.'
        : `Intended media saved — ${draft.length} image${draft.length === 1 ? '' : 's'}.`);
      await load();
    } catch (cause) {
      /*
        🔴 THE DRAFT SURVIVES A FAILURE. Reloading would silently discard the operator's
        ordering and primary choice — the work they would have to redo to retry.
      */
      setFailure(cause instanceof Error ? cause.message : 'The media could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const acceptMarketplace = async (): Promise<void> => {
    if (!id) return;
    setBusy(true);
    setFailure(null);
    try {
      await acceptReportedMedia(id);
      setNotice('Marketplace media adopted as this listing’s intended media.');
      await load();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'The marketplace media could not be accepted.');
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ draft edits
  const setItems = (next: readonly DraftItem[]): void => { setDraft(next); setNotice(null); };

  const move = (index: number, by: -1 | 1): void => {
    if (!draft) return;
    const target = index + by;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setItems(next);
    // ⚠ Focus follows the item, so a keyboard reorder does not lose the operator's place.
    requestAnimationFrame(() => itemRefs.current[item!.mediaAssetId]?.focus());
  };

  /** 🔴 `PRD-168.a`/`.b` — at most one primary, and it is OPTIONAL. Toggling clears it. */
  const togglePrimary = (index: number): void => {
    if (!draft) return;
    const wasPrimary = draft[index]!.primary;
    setItems(draft.map((item, i) => ({ ...item, primary: !wasPrimary && i === index })));
  };

  const remove = (index: number): void => {
    if (!draft) return;
    setItems(draft.filter((_, i) => i !== index));
  };

  const addAsset = (asset: MediaView): void => {
    if (!draft) return;
    const item: DraftItem = {
      mediaAssetId: asset.mediaAssetId!,
      storageReference: asset.storageReference,
      // 🔴 `PRD-168.c` — NEVER auto-primary. A newly added image is an ordinary gallery item.
      primary: false,
    };
    if (picker?.replacing !== null && picker?.replacing !== undefined) {
      const at = picker.replacing;
      // ⚠ Replace keeps the slot's POSITION and its primary flag — it swaps the asset only.
      setItems(draft.map((d, i) => (i === at ? { ...item, primary: d.primary } : d)));
    } else {
      setItems([...draft, item]);
    }
    setPicker(null);
  };

  /**
   * 🔴 `PRD-170.c` — CREATING AN OVERRIDE IS AN EXPLICIT OPERATOR ACT, and it starts EMPTY.
   *
   * <p>⚠ It deliberately does NOT pre-copy the master set. Canon does not authorise
   * materialising the fallback, and a copy made at open time would silently stop tracking the
   * master the moment Products changed it — a divergence nobody chose.
   */
  const createOverride = (): void => { setItems([]); setPicker({ replacing: null }); };

  // ------------------------------------------------------------------ render
  if (loading) {
    return (
      <>
        <PageHeader title="Manage Media" subtitle="Products · Listings" />
        <Card><EmptyState title="Loading media…" guidance="Fetching this listing's media." /></Card>
      </>
    );
  }

  if (loadError !== null || !listing || !media || draft === null) {
    return (
      <>
        <PageHeader title="Manage Media" subtitle="Products · Listings" />
        <Card>
          {/* 🔴 `SYS-034` — unreadable is not empty. The page says so rather than showing a
              blank editor an operator might author into. */}
          <EmptyState
            title="This listing's media could not be loaded"
            guidance={loadError ?? 'No listing with that identifier is readable here.'}
          />
        </Card>
      </>
    );
  }

  const identity = [
    listing.intendedTitle ?? listing.channelReportedTitle ?? 'Untitled listing',
    listing.channelName ?? listing.channelInstance,
    listing.externalListingId ?? 'Not published',
  ].join(' · ');

  const BackIcon = ACTION_ICON.back;

  return (
    <>
      <PageHeader
        title="Manage Media"
        subtitle={identity}
        actions={
          <Link
            data-testid="media-back"
            to={`/inventory/products/listings/${listing.id}`}
            style={{ ...buttonStyle('secondary', 'page-header'), textDecoration: 'none', gap: '6px' }}
          >
            <BackIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
            Back to Listing
          </Link>
        }
      />

      {/*
        🔴 THE ONE SENTENCE THAT KEEPS THIS PAGE HONEST (`PRD-185`). An operator who believes
        these edits reach the marketplace will not use the page correctly.
      */}
      <div data-testid="media-local-note" style={noteBar}>
        Changes are saved to this listing only. Nothing here contacts
        {' '}{listing.channelName ?? 'the channel'}.
      </div>

      {notice && <div data-testid="media-notice" style={{ ...noteBar, marginTop: '10px' }}>{notice}</div>}
      {failure && <div data-testid="media-error" style={{ ...noteBar, marginTop: '10px', color: 'var(--color-destructive)' }}>{failure}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px' }}>
        {/* ------------------------------------------------------------ A · master */}
        <section data-testid="media-master" style={panel}>
          <PanelHead title="A · Sellable Product master" badge="READ ONLY" />
          <p style={panelNote}>
            {listing.mappedSellableSku
              ? `Owned by ${listing.mappedSellableSku}. Reusable across every channel.`
              : 'This listing is not mapped to a Sellable Product, so there is no master set to inherit.'}
          </p>
          <Thumbnails items={media.master} testId="media-master-grid" empty="No master media" />
          <p style={panelNote}>
            {media.master.length} image{media.master.length === 1 ? '' : 's'}. Nothing on this
            page can change them.
          </p>
        </section>

        {/* ----------------------------------------------------- B · listing intended */}
        {/*
          🔴 `UX-269` — THE CONTAINER BORDER IS NEUTRAL, LIKE EVERY OTHER PANEL. A `1.5px`
          ink frame was drafted here to mark the editable column and REMOVED: the locked global
          rule reserves ink framing for nothing ordinary, and "you may edit this" is ordinary.
          Superseded: `border: '1.5px solid var(--color-ink)'`.

          ⚠ THE DISTINCTION IS NOT WEAKENED. Editability is carried by the EDITABLE badge, the
          per-item controls, the helper text and the footer — the things an operator actually
          reads — while master and reported carry READ ONLY and have no controls at all.
        */}
        <section data-testid="media-intended" style={panel}>
          <PanelHead title="B · Listing intended" badge={mayManage ? 'EDITABLE' : 'READ ONLY'} strong />
          <p style={panelNote}>
            {overrideExists
              ? `Channel-specific override for ${listing.channelName ?? listing.channelInstance}.`
              : 'No override on this listing.'}
          </p>

          {overrideExists ? (
            <div data-testid="media-intended-items" style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '11px' }}>
              {draft.map((item, index) => (
                <DraftRow
                  key={item.mediaAssetId}
                  item={item}
                  index={index}
                  total={draft.length}
                  disabled={!mayManage || busy}
                  registerRef={(el) => { itemRefs.current[item.mediaAssetId] = el; }}
                  onMove={move}
                  onTogglePrimary={togglePrimary}
                  onRemove={remove}
                  onReplace={() => setPicker({ replacing: index })}
                />
              ))}
            </div>
          ) : (
            <div data-testid="media-no-override" style={{ ...emptyBlock, marginTop: '11px' }}>
              This listing has no media of its own.
            </div>
          )}

          {mayManage && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '11px' }}>
              <button type="button" data-testid="media-add" disabled={busy} onClick={() => setPicker({ replacing: null })} style={smallAction}>
                Add
              </button>
              {savedOverrideExists && (
                <button type="button" data-testid="media-clear-override" disabled={busy} onClick={() => setClearing(true)} style={smallAction}>
                  Remove override and use master media
                </button>
              )}
            </div>
          )}

          {/* 🔴 The primary rule, stated where the operator is about to set one. */}
          <p style={panelNote}>
            This override replaces master media on this listing. At most one image can be
            primary; primary is optional and is never assigned automatically.
          </p>
        </section>

        {/* --------------------------------------------------- C · marketplace reported */}
        <section data-testid="media-reported" style={panel}>
          <PanelHead title="C · Marketplace reported" badge="READ ONLY" />
          <p style={panelNote}>
            {reportedProvenance(listing, media)}
          </p>
          <Thumbnails
            items={media.reported}
            testId="media-reported-grid"
            /*
              🔴 `SYS-034` — UNREADABLE IS NOT EMPTY, and neither is "never read". Absence is
              never presented as the channel having no images (`PRD-177`).
            */
            empty={listing.adapterAvailable
              ? listing.lastSyncAt
                ? 'The channel returned no images'
                : 'Not read from this channel yet'
              : 'Not readable from this channel'}
          />
          <p style={panelNote}>
            {media.reported.length > 0
              ? `${media.reported.length} image${media.reported.length === 1 ? '' : 's'}. Order as returned by the API, which this channel does not guarantee.`
              : 'No marketplace adapter is configured, so the channel’s media cannot be read.'}
          </p>
        </section>
      </div>

      {/* ------------------------------------------------------------- comparison */}
      <section data-testid="media-comparison" style={{ ...panel, marginTop: '16px', borderColor: 'var(--color-border-control)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-heading-ink)' }}>Media comparison</div>
          {/*
            🔴 `PRD-183` — MANUAL_REQUIRED, NOT DIVERGED. Where image order cannot be trusted
            the system says a person must look; it never manufactures a divergence from an
            unreliable ordering, and never claims a match from unreadable media.
          */}
          <span data-testid="media-comparison-state" style={chip}>
            {media.reportedOrderReliable ? 'DETERMINISTIC' : 'MANUAL REQUIRED'}
          </span>
        </div>
        <p style={{ ...panelNote, marginTop: '8px', color: 'var(--color-text-primary)' }}>
          {comparisonSentence(listing, media)}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
          <div>
            <div style={columnLabel}>ERP INTENDED · {effective.length}</div>
            <Strip items={effective} testId="media-compare-intended" />
          </div>
          <div>
            <div style={columnLabel}>MARKETPLACE REPORTED · {media.reported.length}</div>
            <Strip items={media.reported} testId="media-compare-reported" />
          </div>
        </div>

        <p style={panelNote}>
          Where a difference can be determined deterministically — an image present on one side
          only — it is marked. Ordering differences alone are not claimed on this channel.
        </p>

        <div style={{ display: 'flex', gap: '9px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="media-accept-marketplace"
            disabled={!mayManage || busy || media.reported.length === 0}
            onClick={() => void acceptMarketplace()}
            style={smallAction}
          >
            Accept Marketplace
          </button>
          {/*
            🔴 THERE IS NO PUSH ON THIS PAGE, AT ANY AUTHORITY. A `Push ERP Version` link was
            drafted here and REMOVED: Frame 13 manages LOCAL intended media, and an outbound
            act placed beside the media editor invites the belief that saving media publishes
            it. Holding `product.channel-listing.publish` changes nothing here.

            ⚠ Pushing remains its own workflow on its own surface. This page's complete set of
            actions is the local ones: Add, Replace, Remove, Reorder, Set primary, Accept
            Marketplace, Cancel and Save media.
          */}
          <span style={{ ...panelNote, margin: 0 }}>
            Accept Marketplace changes this listing&rsquo;s intended media. Sellable Product
            master media is never modified.
          </span>
        </div>
      </section>

      {/* --------------------------------------------------------------- fallback */}
      {!overrideExists && (
        <section data-testid="media-fallback" style={{ ...panel, marginTop: '16px' }}>
          <div style={columnLabel}>Fallback state — no override on this listing</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px', flexWrap: 'wrap' }}>
            <Strip items={media.master} testId="media-fallback-strip" />
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                {media.master.length > 0 ? 'Using Sellable Product media' : 'No intended media'}
              </div>
              <p style={{ ...panelNote, marginTop: '3px' }}>
                {media.master.length > 0
                  ? `These ${media.master.length} image${media.master.length === 1 ? '' : 's'} are what will be sent on the next push. They are shown once, not duplicated into a listing-owned set.`
                  : 'Neither this listing nor its Sellable Product holds any media.'}
              </p>
            </div>
            {mayManage && (
              <button type="button" data-testid="media-create-override" disabled={busy} onClick={createOverride} style={{ ...smallAction, border: '1px solid var(--color-ink)', fontWeight: 700 }}>
                Create listing override
              </button>
            )}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------------- footer */}
      {mayManage && (
        <div style={footer}>
          <span style={{ ...panelNote, margin: 0 }}>Changes are saved to this listing only</span>
          <div style={{ display: 'flex', gap: '9px' }}>
            <button
              type="button"
              data-testid="media-cancel"
              disabled={busy || !dirty}
              onClick={() => setDraft(original)}
              style={buttonStyle('secondary', 'page-header')}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="media-save"
              disabled={busy || !dirty}
              onClick={() => void save()}
              style={buttonStyle('primary', 'page-header')}
            >
              {busy ? 'Saving…' : 'Save media'}
            </button>
          </div>
        </div>
      )}

      {!mayManage && (
        <div data-testid="media-view-only" style={{ ...noteBar, marginTop: '16px' }}>
          You can see this listing&rsquo;s media but not change it. Editing needs the
          product.channel-listing.manage authority.
        </div>
      )}

      {picker && (
        <AssetPicker
          master={media.master}
          alreadyChosen={draft.map((d) => d.mediaAssetId)}
          replacing={picker.replacing !== null}
          onChoose={addAsset}
          onClose={() => setPicker(null)}
        />
      )}

      {clearing && (
        <ConfirmDialog
          testId="media-clear-dialog"
          title="Remove this listing's media override?"
          consequence={`The listing will again use the Sellable Product master media${media.master.length > 0 ? ` — ${media.master.length} image${media.master.length === 1 ? '' : 's'}` : ''}. Sellable Product media is not changed, and nothing is sent to ${listing.channelName ?? 'the channel'}.`}
          confirmLabel="Use Sellable Product media"
          busy={busy}
          onCancel={() => setClearing(false)}
          onConfirm={() => {
            setClearing(false);
            setDraft([]);
            void (async () => {
              setBusy(true);
              setFailure(null);
              try {
                await replaceMedia(listing.id, []);
                setNotice('Override removed. This listing uses the Sellable Product media again.');
                await load();
              } catch (cause) {
                setFailure(cause instanceof Error ? cause.message : 'The override could not be removed.');
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
    </>
  );
}

/** One editable media row: thumbnail, order, role and its own controls. */
function DraftRow({
  item, index, total, disabled, registerRef, onMove, onTogglePrimary, onRemove, onReplace,
}: {
  readonly item: DraftItem;
  readonly index: number;
  readonly total: number;
  readonly disabled: boolean;
  readonly registerRef: (el: HTMLButtonElement | null) => void;
  readonly onMove: (index: number, by: -1 | 1) => void;
  readonly onTogglePrimary: (index: number) => void;
  readonly onRemove: (index: number) => void;
  readonly onReplace: () => void;
}): React.JSX.Element {
  return (
    <div data-testid={`media-item-${index}`} style={itemRow}>
      <Thumb reference={item.storageReference} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-demoted)' }}>#{index + 1}</span>
          {/* 🔴 The role is shown per item and is never implied by position. */}
          <span data-testid={`media-item-role-${index}`} style={item.primary ? primaryChip : roleChip}>
            {item.primary ? 'PRIMARY' : 'GALLERY'}
          </span>
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--color-text-demoted)', fontFamily: 'var(--font-family-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
          {item.storageReference}
        </div>
      </div>
      {/*
        🔴 `RULE 44` — ORDER IS BUSINESS DATA AND IS KEYBOARD-REACHABLE. These buttons are the
        primary reorder mechanism, not a fallback behind a drag interaction.
      */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button ref={registerRef} type="button" data-testid={`media-up-${index}`} aria-label={`Move image ${index + 1} earlier`} disabled={disabled || index === 0} onClick={() => onMove(index, -1)} style={iconAction}>↑</button>
        <button type="button" data-testid={`media-down-${index}`} aria-label={`Move image ${index + 1} later`} disabled={disabled || index === total - 1} onClick={() => onMove(index, 1)} style={iconAction}>↓</button>
        <button type="button" data-testid={`media-primary-${index}`} aria-pressed={item.primary} disabled={disabled} onClick={() => onTogglePrimary(index)} style={iconAction}>
          {item.primary ? 'Unset' : 'Primary'}
        </button>
        <button type="button" data-testid={`media-replace-${index}`} aria-label={`Replace image ${index + 1}`} disabled={disabled} onClick={onReplace} style={iconAction}>Replace</button>
        <button type="button" data-testid={`media-remove-${index}`} aria-label={`Remove image ${index + 1}`} disabled={disabled} onClick={() => onRemove(index)} style={iconAction}>Remove</button>
      </div>
    </div>
  );
}

/**
 * Choosing an existing `E-105` asset.
 *
 * <p>🔴 SELECTION, NOT UPLOAD. `TEC-105` selects no storage technology and the platform has no
 * binary upload path, so a file picker here would be a control that cannot persist what it
 * accepts. The honest surface is choosing from assets that already exist.
 *
 * <p>🔴 `PRD-170.b` — master media is OFFERED, never bulk-copied. The operator picks one.
 */
function AssetPicker({
  master, alreadyChosen, replacing, onChoose, onClose,
}: {
  readonly master: readonly MediaView[];
  readonly alreadyChosen: readonly string[];
  readonly replacing: boolean;
  readonly onChoose: (asset: MediaView) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const available = master.filter((m) => m.mediaAssetId !== null
    && (replacing || !alreadyChosen.includes(m.mediaAssetId)));

  return (
    <ConfirmDialog
      testId="media-picker"
      width="560px"
      title={replacing ? 'Replace with which image?' : 'Add an image to this listing'}
      consequence="Choose from the Sellable Product's media. Adding an image here changes this listing only — the Sellable Product's own set is not modified."
      confirmLabel="Done"
      cancelLabel="Cancel"
      onCancel={onClose}
      onConfirm={onClose}
    >
      <div style={{ marginTop: '12px' }}>
        {available.length === 0 ? (
          /*
            ⚠ AN HONEST DEAD END, NOT A DISGUISED UPLOADER. With no storage provider there is
            nothing else this page can offer, and saying so is better than a control that
            silently fails.
          */
          <div data-testid="media-picker-empty" style={emptyBlock}>
            <div style={{ fontWeight: 700, color: 'var(--color-heading-ink)' }}>
              No further Sellable Product media to add
            </div>
            <div style={{ marginTop: '4px' }}>
              Media is added to the Sellable Product first. Trioloo has no media upload yet, so
              images cannot be uploaded from this page.
            </div>
          </div>
        ) : (
          <div data-testid="media-picker-options" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {available.map((asset, index) => (
              <button
                key={asset.mediaAssetId}
                type="button"
                data-testid={`media-picker-option-${index}`}
                onClick={() => onChoose(asset)}
                style={itemRow}
              >
                <Thumb reference={asset.storageReference} size={40} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {asset.role === 'PRIMARY' ? 'Master primary' : 'Master gallery'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--color-text-demoted)', fontFamily: 'var(--font-family-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.storageReference}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}

/** A compact grid of read-only thumbnails, or the canonical empty block. */
function Thumbnails({
  items, testId, empty,
}: {
  readonly items: readonly MediaView[];
  readonly testId: string;
  readonly empty: string;
}): React.JSX.Element {
  if (items.length === 0) {
    return <div data-testid={`${testId}-empty`} style={{ ...emptyBlock, marginTop: '11px' }}>{empty}</div>;
  }
  return (
    <div data-testid={testId} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '11px' }}>
      {items.map((item) => (
        <div key={item.id ?? item.storageReference} style={{ position: 'relative' }}>
          <Thumb reference={item.storageReference} square />
          {item.role === 'PRIMARY' && <span style={primaryBadge}>PRIMARY</span>}
        </div>
      ))}
    </div>
  );
}

/** A horizontal run of small thumbnails, for the comparison and fallback strips. */
function Strip({ items, testId }: { readonly items: readonly MediaView[]; readonly testId: string }): React.JSX.Element {
  if (items.length === 0) {
    return <div data-testid={`${testId}-empty`} style={{ ...emptyBlock, marginTop: '8px' }}>None</div>;
  }
  return (
    <div data-testid={testId} style={{ display: 'flex', gap: '7px', marginTop: '8px', flexWrap: 'wrap' }}>
      {items.map((item) => <Thumb key={item.id ?? item.storageReference} reference={item.storageReference} size={52} />)}
    </div>
  );
}

/**
 * One thumbnail.
 *
 * <p>🔴 `RULE 3.15.a.d` — a reference that cannot be RENDERED shows the canonical neutral
 * block. No broken-image glyph, no placeholder illustration, no invented external URL, and no
 * decorative stock photography.
 *
 * <p>⚠ `TEC-105` selects no storage technology, so a reference is only attempted as an image
 * when it is self-evidently one — an http(s) URL or a data URI. Anything else is an opaque
 * identifier and is drawn as the neutral block with its reference shown as its title.
 */
function Thumb({
  reference, size = 0, square = false,
}: {
  readonly reference: string;
  readonly size?: number;
  readonly square?: boolean;
}): React.JSX.Element {
  const [broken, setBroken] = useState(false);
  const renderable = /^(https?:\/\/|data:image\/)/i.test(reference) && !broken;
  const box: React.CSSProperties = {
    ...(square ? { width: '100%', aspectRatio: '1' } : { width: `${size}px`, height: `${size}px` }),
    borderRadius: 'var(--radius-control)',
    background: 'var(--color-divider-light)',
    flexShrink: 0,
    objectFit: 'cover',
    display: 'block',
  };
  if (!renderable) {
    return <div aria-hidden="true" title={reference} data-testid="media-thumb-neutral" style={box} />;
  }
  return (
    <img
      src={reference}
      alt=""
      title={reference}
      data-testid="media-thumb-image"
      onError={() => setBroken(true)}
      style={box}
    />
  );
}

function PanelHead({ title, badge, strong = false }: { readonly title: string; readonly badge: string; readonly strong?: boolean }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-heading-ink)' }}>{title}</div>
      <span style={{ fontSize: '10px', letterSpacing: '.06em', fontWeight: strong ? 800 : 700, color: strong ? 'var(--color-ink)' : 'var(--color-text-demoted)' }}>
        {badge}
      </span>
    </div>
  );
}

/** ⚠ Says WHY there is nothing, which is different from saying there is nothing. */
function reportedProvenance(listing: ChannelListing, media: MediaSetView): string {
  if (!listing.adapterAvailable) {
    return `No adapter is configured for ${listing.channelName ?? 'this channel'}, so its media cannot be read.`;
  }
  if (!listing.lastSyncAt) {
    return 'This listing has not been read back from the channel yet.';
  }
  return `What ${listing.channelName ?? 'the channel'} currently shows. Read ${formatMoment(listing.lastSyncAt)}. ${media.reported.length} image${media.reported.length === 1 ? '' : 's'}.`;
}

/** 🔴 `PRD-183` — never a divergence claim built on an ordering the channel does not promise. */
function comparisonSentence(listing: ChannelListing, media: MediaSetView): string {
  if (!listing.adapterAvailable) {
    return `No marketplace adapter is configured, so ${listing.channelName ?? 'the channel'}'s media cannot be read and the two sets cannot be compared. This is a missing capability, not a difference.`;
  }
  if (media.reported.length === 0) {
    return 'Nothing has been read back from this channel, so there is nothing to compare against.';
  }
  if (!media.reportedOrderReliable) {
    return `${listing.channelName ?? 'This channel'} does not return a reliable image order for this listing, so Trioloo cannot decide whether the sets differ. This needs a person to look, and is not reported as divergence.`;
  }
  return 'Image order is reliable on this channel, so a difference can be determined deterministically.';
}

const toDraft = (view: MediaView): DraftItem => ({
  mediaAssetId: view.mediaAssetId ?? '',
  storageReference: view.storageReference,
  primary: view.role === 'PRIMARY',
});

const asView = (item: DraftItem, position: number): MediaView => ({
  id: null,
  mediaAssetId: item.mediaAssetId,
  storageReference: item.storageReference,
  role: item.primary ? 'PRIMARY' : 'GALLERY',
  position,
  source: 'LISTING_INTENDED',
});

/** ⚠ Order and primary are both part of the value, so a reorder alone counts as a change. */
function sameSet(a: readonly DraftItem[], b: readonly DraftItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.mediaAssetId === b[i]!.mediaAssetId && item.primary === b[i]!.primary);
}

const panel: React.CSSProperties = {
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-card-small)',
  background: 'var(--color-surface)',
  padding: '16px 18px',
  minWidth: 0,
};

const panelNote: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.6,
  margin: '10px 0 0',
};

const noteBar: React.CSSProperties = {
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-strip)',
  padding: '10px 13px',
  fontSize: '12px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.6,
};

const emptyBlock: React.CSSProperties = {
  border: '1px dashed var(--color-border-secondary-button)',
  borderRadius: 'var(--radius-control)',
  padding: '16px 12px',
  textAlign: 'center',
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.6,
};

const itemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  padding: '8px 10px',
  font: 'inherit',
  cursor: 'pointer',
  minWidth: 0,
};

const smallAction: React.CSSProperties = {
  ...buttonStyle('secondary', 'row-action'),
  fontSize: '11.5px',
  height: '28px',
  padding: '0 10px',
  border: '1px solid var(--color-divider-inner)',
  boxShadow: 'none',
};

const iconAction: React.CSSProperties = {
  ...smallAction,
  height: '26px',
  padding: '0 7px',
  fontSize: '11px',
};

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '19px',
  padding: '0 7px',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control-small)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.05em',
  color: 'var(--color-text-secondary)',
};

const roleChip: React.CSSProperties = { ...chip, height: '17px', fontSize: '9.5px' };
const primaryChip: React.CSSProperties = {
  ...roleChip,
  border: '1px solid var(--color-ink)',
  color: 'var(--color-ink)',
  fontWeight: 800,
};

const primaryBadge: React.CSSProperties = {
  position: 'absolute',
  left: '5px',
  bottom: '5px',
  height: '16px',
  padding: '0 5px',
  background: 'var(--color-ink)',
  color: 'var(--color-surface)',
  borderRadius: '4px',
  fontSize: '9px',
  fontWeight: 800,
  letterSpacing: '.05em',
  display: 'flex',
  alignItems: 'center',
};

const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};

const footer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '16px',
  padding: '13px 18px',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-card-small)',
  background: 'var(--color-surface)',
  flexWrap: 'wrap',
};
