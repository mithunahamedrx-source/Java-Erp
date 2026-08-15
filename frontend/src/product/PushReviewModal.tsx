import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../ui/Overlay';
import {
  confirmPushReview,
  fetchPushReview,
  type ChannelListingSku,
  type ComparisonRow,
  type PreflightDimension,
  type PreflightItem,
  type PushReview,
} from './channelListingApi';

/**
 * FRAME 15 — Push Review, `PRD-185` / `PRD-186` / `PRD-188`.
 *
 * <p>🔴 THIS IS THE BOUNDARY BETWEEN LOCAL INTENT AND REMOTE MUTATION, and it is the ONLY
 * surface in Listings that carries an outbound act. Add, Edit, Media, Mapping and the SKU
 * section save locally and offer no Push at any authority (`UX-271.c`) — an outbound control
 * beside a local editor invites the belief that saving publishes.
 *
 * <p>🔴 ONE LISTING, ONE SHOP (`INV-108.4`). The review targets exactly this Listing's channel
 * and shop. No sibling Listing, no sibling shop, no mapping fan-out and no batch selection:
 * everything shown and everything confirmable belongs to this record alone.
 *
 * <p>🔴 IT REVIEWS PERSISTED INTENT. The projection is fetched from the server, so an unsaved
 * editor draft can never be reviewed or sent (`PRD-185.a`).
 *
 * <p>🔴 NO ADAPTER SHIPS IN THIS RELEASE, so the outbound action is DISABLED with its reason in
 * visible footer text. Nothing here fakes a push, a response, an external identifier, a
 * timestamp or a cleared unsent condition.
 *
 * <p>⚠ `RULE 3.6.d` — every panel below uses the ordinary neutral container. Outbound
 * capability is carried by the action, the labels, the preflight and the copy, never by a
 * heavier frame.
 */
export function PushReviewModal({
  listingId,
  onClose,
}: {
  readonly listingId: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  const [review, setReview] = useState<PushReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchPushReview(listingId)
      .then((r) => live && setReview(r))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [listingId]);

  if (error && !review) {
    return (
      <ConfirmDialog
        title="Review before sending"
        consequence={error}
        confirmLabel="Close"
        cancelLabel="Cancel"
        testId="push-review"
        width="560px"
        onConfirm={onClose}
        onCancel={onClose}
      />
    );
  }
  if (!review) {
    return (
      <ConfirmDialog
        title="Review before sending"
        consequence="Reading the saved Listing…"
        confirmLabel="Cancel"
        cancelLabel="Cancel"
        testId="push-review"
        width="560px"
        onConfirm={onClose}
        onCancel={onClose}
      />
    );
  }

  const first = review.mode === 'FIRST_PUBLICATION';

  /*
    🔴 §54 — the consequence names exactly ONE Listing on ONE shop. It never implies that
    sibling Listings, other shops or SKUs on other Listings are affected, because a batch
    reading of this sentence is how an operator changes more than they meant to.
  */
  const consequence = first
    ? `Creates this Listing on ${review.channelName ?? 'the selected shop'}. `
      + 'The channel issues its identifier when it accepts the Listing.'
    : `Updates this Listing on ${review.channelName ?? 'the selected shop'}`
      + `${review.externalListingId ? ` (${review.externalListingId})` : ''}. `
      + 'No other Listing and no other shop is changed.';

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await confirmPushReview(listingId, review.reviewVersion);
      onClose();
    } catch (e) {
      // ⚠ Shown IN PLACE. A refused confirmation must not close the modal, or the operator
      //   never learns why nothing happened.
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      // 🔴 §17 — the two modes never share wording. "Push" on a Listing the channel has
      //    never seen would describe an update to something that does not exist.
      title={first ? 'Review & Publish' : 'Review & Push'}
      consequence={consequence}
      confirmLabel={
        review.executable
          ? first
            ? 'Publish Listing'
            : 'Confirm Push'
          : first
            ? 'Publish unavailable'
            : 'Push unavailable'
      }
      cancelLabel="Cancel"
      testId="push-review"
      width="760px"
      busy={busy}
      error={error}
      confirmDisabled={!review.executable}
      confirmDisabledReason={review.executionBlockedReason ?? undefined}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
        <Target review={review} />
        <Preflight items={review.preflight} />
        <Fields review={review} />
        {review.skus.length > 1 && <Skus skus={review.skus} />}
        <Media review={review} />
        <Content review={review} />
      </div>
    </ConfirmDialog>
  );
}

// =====================================================================================
// Target and state
// =====================================================================================

/**
 * Who this act targets and where the Listing stands, `UX-271.b`.
 *
 * <p>🔴 THE STATE DIMENSIONS ARE SEPARATE CARRIERS. Mapping, comparison, the unsent condition
 * and publication lifecycle have different owners and can all be true at once — an unmapped
 * Listing may also be diverged and also have unsent changes. One merged badge could only ever
 * name one of them, and the operator would act on the one it happened to pick.
 */
function Target({ review }: { readonly review: PushReview }): React.JSX.Element {
  const first = review.mode === 'FIRST_PUBLICATION';
  return (
    <section style={panel} data-testid="push-review-target">
      <div style={panelHead}>
        <span style={panelTitle}>Target</span>
        <span style={quietChip} data-testid="push-review-mode">
          {first ? 'FIRST PUBLICATION' : 'EXISTING LISTING UPDATE'}
        </span>
      </div>
      <dl style={grid}>
        <Fact label="Listing" value={review.listingTitle ?? '—'} testId="push-review-title" />
        <Fact label="Channel / Shop" value={review.channelName ?? '—'} />
        {/*
          🔴 `PRD-188.b` / `§39.10.k` — a Listing the channel has not accepted HAS NO
          identifier, and says so. Nothing substitutes the Seller SKU, a local UUID or an
          invented value for one, and no marketplace-issued SKU identity is shown at all
          because the domain model does not define one.
        */}
        <Fact
          label="Channel Listing ID"
          value={review.externalListingId ?? 'Not published — no channel identifier yet'}
          testId="push-review-external-id"
        />
        <Fact
          label="Orderable SKUs"
          value={
            review.skuCount === 1
              ? '1 SKU'
              : `${review.skuCount} SKUs · ${review.mappedSkuCount} mapped`
          }
        />
      </dl>
      <div style={carriers} data-testid="push-review-carriers">
        {/* 🔴 Mapping — its own dimension. `PRD-178` makes UNMAPPED valid, not an error. */}
        <span style={quietChip}>
          {review.mappedSkuCount === 0
            ? 'UNMAPPED'
            : review.mappedSkuCount < review.skuCount
              ? `${review.mappedSkuCount} OF ${review.skuCount} MAPPED`
              : 'MAPPED'}
        </span>
        {/* 🔴 Comparison — a DIFFERENT dimension, and may be true at the same time. */}
        {review.divergedFieldCount > 0 && (
          <span style={strongChip} data-testid="push-review-diverged">
            DIVERGED · {review.divergedFieldCount}
          </span>
        )}
        {/*
          🔴 `PRD-185.d` — UNSENT is a LOCAL revision fact, never divergence. Opening this
          review does not clear it, cancelling does not clear it, and only a genuinely
          successful push for this exact revision ever will.
        */}
        {review.unsentLocalChanges && (
          <span style={quietChip} data-testid="push-review-unsent">
            UNSENT LOCAL CHANGES
          </span>
        )}
        {review.publicationIntent && (
          <span style={quietChip}>INTENT · {review.publicationIntent}</span>
        )}
      </div>
      {review.divergedFieldCount > 0 && (
        /*
          🔴 `PRD-183` — reviewing does not resolve divergence. The two directions are
          opposite acts and are never merged into one ambiguous button: sending preserves ERP
          intent, and adopting the marketplace value belongs to the comparison surface.
        */
        <p style={note} data-testid="push-review-diverged-note">
          Sending preserves the ERP intent below and attempts to write it to the channel. To
          adopt the marketplace value instead, use Accept marketplace on the comparison — this
          review never resolves a divergence.
        </p>
      )}
    </section>
  );
}

// =====================================================================================
// Preflight
// =====================================================================================

const DIMENSION_LABEL: Record<PreflightDimension, string> = {
  LOCAL_VALIDATION: 'Local validation',
  MAPPING: 'Mapping and business readiness',
  ADAPTER_CAPABILITY: 'Adapter capability',
  MARKETPLACE_SCHEMA: 'Marketplace validation',
};

/**
 * The four dimensions, kept apart, `UX-271.b`.
 *
 * <p>🔴 A BLOCKING item blocks the WHOLE Listing (`§40`). A blocked orderable SKU is never
 * quietly dropped so the rest can be sent: partial remote SKU mutation is not a capability
 * this system has, and half-updating a marketplace with nobody aware of it is worse than
 * sending nothing.
 *
 * <p>⚠ A recommendation is reported and never enforced. Making every blank optional field
 * blocking would turn a legitimate ERP-first Listing into an error state (`PRD-188.a`).
 */
function Preflight({ items }: { readonly items: readonly PreflightItem[] }): React.JSX.Element {
  const blocking = items.filter((i) => i.blocking);
  const dimensions = (['LOCAL_VALIDATION', 'MAPPING', 'ADAPTER_CAPABILITY', 'MARKETPLACE_SCHEMA'] as const)
    .map((d) => ({ dimension: d, items: items.filter((i) => i.dimension === d) }))
    .filter((g) => g.items.length > 0);

  return (
    <section style={panel} data-testid="push-review-preflight">
      <div style={panelHead}>
        <span style={panelTitle}>Preflight</span>
        <span style={blocking.length > 0 ? strongChip : quietChip} data-testid="push-review-preflight-summary">
          {blocking.length === 0
            ? 'NO BLOCKERS'
            : `${blocking.length} BLOCKING`}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {dimensions.map((group) => (
          <div key={group.dimension}>
            <div style={dimensionLabel}>{DIMENSION_LABEL[group.dimension]}</div>
            {group.items.map((item) => (
              <div
                key={item.text}
                data-testid={`preflight-${item.blocking ? 'blocking' : 'recommendation'}`}
                style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '2px 0' }}
              >
                {/*
                  🔴 `RULE 8.4` — monochrome. The distinction is carried by the marker and its
                  weight, never by colour alone: `!` blocks, `·` is an ordinary note.
                */}
                <span
                  aria-hidden="true"
                  style={{
                    fontWeight: item.blocking ? 800 : 400,
                    color: item.blocking ? 'var(--color-heading-ink)' : 'var(--color-placeholder)',
                    lineHeight: 1.6,
                  }}
                >
                  {item.blocking ? '!' : '·'}
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    lineHeight: 1.6,
                    color: item.blocking ? 'var(--color-heading-ink)' : 'var(--color-text-secondary)',
                    fontWeight: item.blocking ? 600 : 400,
                  }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// =====================================================================================
// Fields — what the channel reports now, and what would be sent
// =====================================================================================

/**
 * The Frame's three-column comparison, `§49`.
 *
 * <p>🔴 CONCISE, not a second comparison surface. It reuses the one comparison engine and
 * shows only what the operator needs to approve an outbound act.
 *
 * <p>🔴 `UX-271.d` — on a variation Listing the commercial rows are NOT shown here, because
 * price and stock belong to the orderable units (`INV-106.2`). Showing the parent figure
 * would present a number that is not what the channel will receive.
 */
function Fields({ review }: { readonly review: PushReview }): React.JSX.Element {
  const commercial = ['sale_price', 'promotion_price', 'promotion_window', 'listing_stock'];
  const rows = review.fields.filter(
    (f) => !(review.perSkuCommercials && commercial.includes(f.fieldKey)),
  );

  return (
    <section style={panel} data-testid="push-review-fields">
      <div style={panelHead}>
        <span style={panelTitle}>Outbound facts</span>
        {review.perSkuCommercials && (
          <span style={quietChip}>PRICE AND STOCK PER SKU</span>
        )}
      </div>
      <div style={fieldTable} role="table" aria-label="Outbound facts">
        <div style={fieldHeadRow} role="row">
          <span role="columnheader" style={fieldHead}>Field</span>
          {/* 🔴 `UX-271.a` — provider-neutral. The Frame said "On Daraz now". */}
          <span role="columnheader" style={fieldHead}>Marketplace now</span>
          <span role="columnheader" style={fieldHead}>Will be sent</span>
        </div>
        {rows.map((row) => (
          <FieldRow key={row.fieldKey} row={row} />
        ))}
      </div>
    </section>
  );
}

function FieldRow({ row }: { readonly row: ComparisonRow }): React.JSX.Element {
  return (
    <div style={fieldRow} role="row" data-testid={`push-review-field-${row.fieldKey}`}>
      <span role="cell" style={fieldName}>
        {row.label}
      </span>
      {/*
        🔴 `§50` / `SYS-034` — an unreadable reported fact says NOT READABLE. It is never
        blank, never zero and never quietly counted as agreement: "matches" would be a claim
        nobody made.
      */}
      <span role="cell" style={fieldValue}>
        {row.reportedReadable ? (
          row.reportedValue ?? <span style={absent}>Not set</span>
        ) : (
          <span style={quietChip} data-testid={`not-readable-${row.fieldKey}`}>
            NOT READABLE
          </span>
        )}
      </span>
      <span role="cell" style={{ ...fieldValue, display: 'flex', gap: '7px', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
          {row.intendedValue ?? <span style={absent}>Not set</span>}
        </span>
        {/*
          🔴 The comparison state is its OWN carrier and is never merged into the value.
          `MANUAL_REQUIRED` is a normal state (`SYS-025`), not a failure and not agreement.
        */}
        {row.state !== 'ALIGNED' && row.state !== 'NOT_READABLE' && (
          <span style={row.state === 'DIVERGED' ? strongChip : quietChip}>
            {row.state === 'UNSENT' ? 'UNSENT' : row.state.replace('_', ' ')}
          </span>
        )}
      </span>
    </div>
  );
}

// =====================================================================================
// Variations
// =====================================================================================

/**
 * Per-SKU outbound facts, `INV-106.2` / `UX-271.d`.
 *
 * <p>🔴 EVERY VALUE COMES FROM ITS OWN SKU. No cell is filled from the parent Listing and no
 * sibling's value is borrowed — a price shown against the wrong unit is a price a customer
 * could be charged.
 *
 * <p>🔴 `§39.10.k` — the identity shown is the SELLER-owned Channel SKU, correctly labelled.
 * The domain model defines no marketplace-issued SKU identifier, so none is displayed and
 * nothing is substituted for one.
 */
function Skus({ skus }: { readonly skus: readonly ChannelListingSku[] }): React.JSX.Element {
  return (
    <section style={panel} data-testid="push-review-skus">
      <div style={panelHead}>
        <span style={panelTitle}>Variations · {skus.length} orderable SKUs</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {skus.map((sku) => (
          <div key={sku.id} style={skuRow} data-testid={`push-review-sku-${sku.channelSku ?? sku.id}`}>
            <div style={{ minWidth: 0 }}>
              <div style={skuIdentity}>{sku.channelSku ?? 'No Seller SKU'}</div>
              <div style={skuLabel}>{sku.variationLabel ?? 'No variation label'}</div>
            </div>
            {/* 🔴 `PRD-199` — Sale Price. The Frame said "Channel price"; `UX-271.a` keeps
                the canonical name. MRP is retired and appears nowhere. */}
            <SkuFact label="Sale Price" value={sku.salePrice} />
            <SkuFact label="Listing Stock" value={sku.listingStock} />
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={quietChip}>{sku.sellableProductId ? 'MAPPED' : 'UNMAPPED'}</span>
              {sku.promotionPrice && (
                /* ⚠ `PRD-199.d` — ACTIVE only when canonical state says so. A scheduled
                   promotion is never drawn as if it were already running. */
                <span style={quietChip}>
                  {sku.promotionActive ? 'PROMOTION ACTIVE' : 'PROMOTION SCHEDULED'}
                </span>
              )}
            </div>
            <div style={parcel} data-testid={`push-review-sku-parcel-${sku.channelSku ?? sku.id}`}>
              <span style={parcelLabel}>PARCEL</span>
              {/* 🔴 `PRD-201.c` — the parcel belongs to the orderable unit, because that is
                  what a courier collects. Never the parent's carton. */}
              {sku.packageWeightKg || sku.packageLengthCm ? (
                <span>
                  {sku.packageWeightKg ? `${sku.packageWeightKg} kg` : 'Weight not measured'}
                  {sku.packageLengthCm && sku.packageWidthCm && sku.packageHeightCm
                    ? ` · ${sku.packageLengthCm} × ${sku.packageWidthCm} × ${sku.packageHeightCm} cm`
                    : ''}
                  {sku.packageContent ? ` · ${sku.packageContent}` : ''}
                </span>
              ) : (
                <span style={absent}>Not measured</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkuFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}): React.JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={factLabel}>{label}</div>
      <div style={factValue}>{value ?? <span style={absent}>Not set</span>}</div>
    </div>
  );
}

// =====================================================================================
// Media and content
// =====================================================================================

/**
 * The EFFECTIVE intended media, `PRD-170`.
 *
 * <p>🔴 ALL-OR-NOTHING: the Listing's own override where it holds one, otherwise the mapped
 * Sellable Product's master set. The fallback is DERIVED at send time and never materialised,
 * and the two sets are never blended.
 *
 * <p>🔴 Marketplace-reported media is NOT the outbound set and is deliberately absent here.
 */
function Media({ review }: { readonly review: PushReview }): React.JSX.Element {
  return (
    <section style={panel} data-testid="push-review-media">
      <div style={panelHead}>
        <span style={panelTitle}>Effective intended media</span>
        <span style={quietChip} data-testid="push-review-media-origin">
          {review.effectiveMedia.length === 0
            ? 'NONE'
            : review.mediaIsFallback
              ? 'PRODUCT MASTER'
              : 'LISTING OVERRIDE'}
        </span>
      </div>
      {review.effectiveMedia.length === 0 ? (
        <p style={note}>
          No effective media. Nothing would be sent for images.
        </p>
      ) : (
        <p style={note} data-testid="push-review-media-count">
          {review.effectiveMedia.length} image{review.effectiveMedia.length === 1 ? '' : 's'}
          {review.mediaIsFallback
            ? ' from the mapped Sellable Product’s master set, in master order.'
            : ' from this Listing’s own override, in the authored order.'}
        </p>
      )}
    </section>
  );
}

/**
 * Language content, `PRD-202`.
 *
 * <p>🔴 `PRD-202.c` — a DERIVED fallback and an EXPLICIT override are different facts and are
 * never conflated. A blank Bangla override is COMPLETE, not missing: the English content is
 * what a Bangla reader will actually see, and the fallback is never materialised as stored
 * Bangla text.
 */
function Content({ review }: { readonly review: PushReview }): React.JSX.Element {
  return (
    <section style={panel} data-testid="push-review-content">
      <div style={panelHead}>
        <span style={panelTitle}>Content</span>
      </div>
      <dl style={grid}>
        <Fact
          label="Bangla content"
          testId="push-review-bangla"
          value={
            review.banglaOverridePresent
              ? 'Explicit Bangla override — sent as authored'
              : 'No Bangla override — the English content will be used'
          }
        />
        <Fact
          label="Highlights"
          testId="push-review-highlights"
          value={
            review.highlights.length === 0
              ? 'None'
              : `${review.highlights.length} highlight${review.highlights.length === 1 ? '' : 's'}, in authored order`
          }
        />
      </dl>
      {review.highlights.length > 0 && (
        /* 🔴 `PRD-198.b` — ORDER IS MEANING, so the set is listed in order rather than
           flattened into one string that would hide it. */
        <ol style={highlightList}>
          {review.highlights.map((h, i) => (
            <li key={`${i}-${h}`} style={{ marginTop: '2px' }}>
              {h}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Fact({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}): React.JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={factLabel}>{label}</dt>
      <dd style={factValue} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

// =====================================================================================
// Style
// =====================================================================================

/**
 * 🔴 `RULE 3.6.d` — ONE container treatment for every panel. Nothing here changes its border,
 * fill or elevation to signal capability; the outbound act is carried by the footer action,
 * the preflight and the copy.
 */
const panel: React.CSSProperties = {
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-card-small)',
  background: 'var(--color-surface)',
  padding: '12px 13px',
};

const panelHead: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  marginBottom: '10px',
};

const panelTitle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-heading-ink)',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '10px 16px',
  margin: 0,
};

const factLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--color-placeholder)',
};

const factValue: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-primary)',
  margin: '3px 0 0',
  lineHeight: 1.5,
  wordBreak: 'break-word',
};

const carriers: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '11px',
  paddingTop: '10px',
  borderTop: '1px solid var(--color-divider-inner)',
};

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '18px',
  padding: '0 6px',
  borderRadius: 'var(--radius-control-small)',
  fontSize: '9.5px',
  fontWeight: 700,
  letterSpacing: '.05em',
  whiteSpace: 'nowrap',
};

const quietChip: React.CSSProperties = {
  ...chipBase,
  border: '1px solid var(--color-divider-inner)',
  color: 'var(--color-text-secondary)',
};

/** ⚠ A strong TYPE, not a strong container — `UX-269` keeps the panel border neutral. */
const strongChip: React.CSSProperties = {
  ...chipBase,
  border: '1.5px solid var(--color-ink)',
  color: 'var(--color-heading-ink)',
  fontWeight: 800,
};

const dimensionLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--color-placeholder)',
  marginBottom: '3px',
};

const fieldTable: React.CSSProperties = { display: 'flex', flexDirection: 'column' };

/**
 * 🔴 `RULE 7.2` — a structured operational row does NOT wrap into a second line at any zoom.
 * The columns hold their proportions and long values clip inside their own cell.
 */
const fieldRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(96px, 1.1fr) minmax(0, 1.4fr) minmax(0, 1.7fr)',
  gap: '12px',
  alignItems: 'baseline',
  padding: '7px 0',
  borderTop: '1px solid var(--color-divider-inner)',
};

const fieldHeadRow: React.CSSProperties = { ...fieldRow, borderTop: 'none', paddingTop: 0 };

const fieldHead: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--color-placeholder)',
};

const fieldName: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 600,
  color: 'var(--color-heading-ink)',
};

const fieldValue: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.55,
  minWidth: 0,
  wordBreak: 'break-word',
};

const absent: React.CSSProperties = { color: 'var(--color-placeholder)' };

const skuRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 1.4fr) minmax(0, .8fr) minmax(0, .8fr) minmax(0, 1fr)',
  gap: '10px 12px',
  alignItems: 'start',
  padding: '10px',
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control)',
};

const skuIdentity: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--color-heading-ink)',
  wordBreak: 'break-word',
};

const skuLabel: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-text-secondary)',
  marginTop: '2px',
};

/** ⚠ Spans the row under its own label — the parcel belongs to the SKU, not to a column. */
const parcel: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  gap: '8px',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  marginTop: '2px',
  paddingTop: '8px',
  borderTop: '1px solid var(--color-divider-inner)',
  fontSize: '11px',
  color: 'var(--color-text-secondary)',
};

const parcelLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.05em',
  color: 'var(--color-placeholder)',
};

const note: React.CSSProperties = {
  fontSize: '11.5px',
  lineHeight: 1.6,
  color: 'var(--color-text-secondary)',
  margin: '8px 0 0',
};

const highlightList: React.CSSProperties = {
  margin: '9px 0 0',
  paddingLeft: '18px',
  fontSize: '11.5px',
  lineHeight: 1.6,
  color: 'var(--color-text-secondary)',
};
