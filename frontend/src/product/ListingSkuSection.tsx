import { Link } from 'react-router-dom';
import { formatMoneyForDisplay } from '../platform/money';
import { formatShortMoment } from '../platform/datetime';
import { isSkuMapped } from './channelListingApi';
import type { ChannelListing, ChannelListingSku } from './channelListingApi';

/**
 * FRAME 14 — Variations / Channel SKUs.
 *
 * <p>🔴 `INV-106.2` / `PRD-190` — THE ORDERABLE UNIT IS THE `E-106` CHANNEL LISTING SKU, and
 * it owns its own price, promotion, listing stock, parcel and mapping. A variation listing
 * holds several, each independently true; nothing here averages, sums or borrows a
 * listing-level figure to fill a per-SKU column.
 *
 * <p>🔴 `INV-106.6` — THE VARIATION LABEL IS THE CHANNEL'S OWN STRING AND IS OPAQUE. Trioloo
 * stores no option/axis decomposition, creates no ERP variant hierarchy on the Sellable
 * Product, and NEVER parses a label or a Seller SKU into `Colour` / `Size` dimensions.
 *
 * <p>🔴 READ ONLY. This is a Detail projection: it issues no command, creates no activity and
 * cannot make a listing carry unsent changes. Writing happens in the authoring form
 * (`PRD-185`) and in the mapping workflow (`PRD-179`), both reached by handoff.
 */
export function ListingSkuSection({
  item, mayManage, onMapSku,
}: {
  readonly item: ChannelListing;
  readonly mayManage: boolean;
  /** Opens the PASS 12 Mapping Modal. 🔴 There is no second mapping implementation. */
  readonly onMapSku: () => void;
}): React.JSX.Element {
  const skus = item.skus ?? [];
  const variation = skus.length > 1;
  const unmapped = skus.filter((s) => !isSkuMapped(s)).length;

  if (skus.length === 0) {
    /*
      ⚠ `INV-106.1` says a listing always has at least one orderable unit, so an empty list is
      a READ that did not carry them — not a listing without SKUs. It is stated as such.
    */
    return (
      <div data-testid="sku-none" style={emptyBlock}>
        No orderable channel SKU was returned for this listing.
      </div>
    );
  }

  return (
    <>
      {/* ---------------------------------------------------------------- actions */}
      {mayManage && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {/*
            🔴 THE SAME MAPPING MODAL AS PASS 12. Frame 14 opens it; it never re-implements
            mapping, and the modal itself keeps each SKU's decision separate.
          */}
          {unmapped > 0 && (
            <button type="button" data-testid="sku-map-unmapped" onClick={onMapSku} style={action}>
              {variation ? `Map ${unmapped} unmapped SKU${unmapped === 1 ? '' : 's'}` : 'Map to Sellable Product'}
            </button>
          )}
          {/*
            ⚠ A HANDOFF, NOT A SECOND EDITOR (§22). The authoring form is the write surface;
            Detail states the truth and sends the operator there.
          */}
          <Link data-testid="sku-edit" to={`/inventory/products/listings/${item.id}/edit`} style={{ ...action, textDecoration: 'none' }}>
            {variation ? 'Edit SKUs' : 'Edit Listing'}
          </Link>
        </div>
      )}

      {variation ? <VariationTable skus={skus} /> : <SingleSku sku={skus[0]!} />}

      {/* ---------------------------------------------------------------- totals */}
      {variation && (
        <div data-testid="sku-totals" style={totals}>
          {/*
            ⚠ A TOTAL IS A TOTAL, NEVER A PER-SKU TRUTH. Listing stock sums because units add
            up; price does not, so it is stated as a RANGE — an average price would describe
            a product nobody can buy.
          */}
          <span>Listing stock total <strong>{stockTotal(skus)}</strong></span>
          <span>Price range <strong>{priceRange(skus)}</strong></span>
          <span>Mapping <strong>{skus.length - unmapped} of {skus.length} mapped</strong></span>
        </div>
      )}

      <p data-testid="sku-variation-note" style={note}>
        {variation
          ? 'The values in the second column are the channel’s own variation labels as reported by the adapter. Trioloo does not model them as ERP variants and does not create a variant hierarchy on the Sellable Product.'
          : 'This listing has one orderable channel SKU, so no variation controls are shown. Price, listing stock and parcel belong to that unit.'}
      </p>
    </>
  );
}

/**
 * Case A — a non-variation listing.
 *
 * <p>⚠ The SAME orderable unit, shown compactly. It is deliberately NOT a listing-level
 * pseudo-SKU: the facts come from the `E-106` row exactly as they do for a variation.
 */
function SingleSku({ sku }: { readonly sku: ChannelListingSku }): React.JSX.Element {
  return (
    <div data-testid={`detail-sku-${sku.id}`} style={singleCard}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
        <Fact label="Channel SKU" mono value={sku.channelSku} missing="Not set" />
        {/*
          ⚠ LABELLED `Sale Price`, NOT the Design's `Channel price`. `PRD-199` names this fact
          Sale Price, every other Listings surface says Sale Price, and `Channel price` is
          SUPERSEDED vocabulary a PASS 06 test explicitly guards against. Where a visual
          reference and business architecture disagree, architecture wins.
        */}
        <div style={{ minWidth: 0 }}>
          <Fact label="Sale Price" value={formatMoneyForDisplay(sku.salePrice)} missing="Not set" numeric />
          {/*
            ⚠ The channel's own figure sits with the intended one here exactly as it does in
            the variation table, so a single-SKU listing is not a poorer view of the same fact.
          */}
          <ReportedPrice sku={sku} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Fact label="Listing stock" value={sku.listingStock} missing="Not set" numeric />
          <ReportedStock sku={sku} />
        </div>
        <Fact label="Sellable Product" value={sku.sellableName ?? sku.sellableSku} missing="Unmapped" />
      </div>
      <Promotion sku={sku} />
      <Parcel sku={sku} />
      <div style={{ marginTop: '11px' }}><StateCarriers sku={sku} /></div>
    </div>
  );
}

/**
 * Case B — a variation listing.
 *
 * <p>🔴 ONE ROW PER ORDERABLE UNIT, scannable side by side. The operator compares SKU,
 * variation label, price, stock, product and state WITHOUT opening anything: `§36` forbids
 * hiding the meaningful facts behind accordions.
 */
function VariationTable({ skus }: { readonly skus: readonly ChannelListingSku[] }): React.JSX.Element {
  return (
    <div data-testid="sku-variation-table">
      <div style={{ ...row, paddingBottom: '7px', borderBottom: '1px solid var(--color-divider-inner)' }}>
        <div style={columnLabel}>Channel SKU</div>
        <div style={columnLabel}>Channel-reported values</div>
        <div style={{ ...columnLabel, textAlign: 'right' }}>Sale Price</div>
        <div style={{ ...columnLabel, textAlign: 'right' }}>Listing stock</div>
        <div style={columnLabel}>Sellable Product</div>
        <div style={columnLabel}>State</div>
      </div>
      {/*
        ⚠ RENDERED IN THE PERSISTED ORDER. `position` is business order and is never re-sorted
        alphabetically or by price, so the list reads the same on every load (§27).
      */}
      {skus.map((sku) => (
        <div key={sku.id} data-testid={`detail-sku-${sku.id}`} style={{ ...row, padding: '11px 0', fontSize: '12.5px', alignItems: 'start' }}>
          <div style={{ fontFamily: 'var(--font-family-mono)', ...clip }} title={sku.channelSku ?? undefined}>
            {sku.channelSku ?? '—'}
          </div>
          <div style={{ minWidth: 0 }}>
            {/* 🔴 The channel's own opaque label. Never decomposed, never invented. */}
            {sku.variationLabel
              ? <span data-testid={`sku-variation-${sku.id}`} style={{ overflowWrap: 'anywhere' }}>{sku.variationLabel}</span>
              : <span data-testid={`sku-variation-${sku.id}`} style={muted}>No variation label reported</span>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div className="tabular-nums" style={{ fontWeight: 600 }}>
              {formatMoneyForDisplay(sku.salePrice) ?? '—'}
            </div>
            <ReportedPrice sku={sku} />
            <PromotionInline sku={sku} />
          </div>
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div className="tabular-nums" style={{ fontWeight: 600 }}>{sku.listingStock ?? '—'}</div>
            <ReportedStock sku={sku} />
          </div>
          <div style={{ minWidth: 0 }}>
            {isSkuMapped(sku)
              ? <span style={clip} title={sku.sellableName ?? undefined}>{sku.sellableName ?? sku.sellableSku}</span>
              : <span style={muted}>—</span>}
          </div>
          <div><StateCarriers sku={sku} /></div>
          {/*
            🔴 `PRD-201.c` — THE PARCEL IS THE SKU'S OWN FACT AND IS LABELLED AS ONE. It was
            first drawn inside the Sellable Product cell, where it read as a property of the
            PRODUCT; it now spans the row under its own label so its owner is unambiguous.
          */}
          <Parcel sku={sku} compact />
        </div>
      ))}
    </div>
  );
}

/**
 * 🔴 THE STATE DIMENSIONS STAY SEPARATE (`UX-038`, `§18`). Mapping, comparison and the local
 * unsent condition are three different facts with three different owners: a mapped SKU may be
 * diverged, and an unmapped one may have unsent changes. They are never merged into one badge.
 *
 * <p>🔴 `UX-269` — the carriers are chips. Nothing here frames the row in ink.
 */
function StateCarriers({ sku }: { readonly sku: ChannelListingSku }): React.JSX.Element {
  const comparison = compareSku(sku);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {isSkuMapped(sku)
        ? <span data-testid={`sku-state-mapped-${sku.id}`} style={quietChip}>MAPPED</span>
        : <span data-testid={`detail-sku-unmapped-${sku.id}`} style={dashedChip}>UNMAPPED</span>}
      {comparison && (
        <span data-testid={`sku-state-${comparison.kind.toLowerCase()}-${sku.id}`} style={comparison.strong ? strongChip : quietChip}>
          {comparison.label}
        </span>
      )}
    </div>
  );
}

/**
 * The per-SKU comparison verdict.
 *
 * <p>🔴 UNREADABLE IS NEVER "MATCHES" AND NEVER "DIFFERS" (`SYS-034`, `PRD-183`). Where the
 * channel could not be read, the honest answer is that no comparison exists — a claim either
 * way would be manufactured from absence.
 */
function compareSku(sku: ChannelListingSku): { kind: string; label: string; strong: boolean } | null {
  const priceUnreadable = sku.reportedSalePrice === null && !sku.reportedSalePriceReadable;
  const stockUnreadable = sku.reportedStock === null && !sku.reportedStockReadable;
  if (priceUnreadable && stockUnreadable) {
    return { kind: 'unreadable', label: 'NOT READABLE', strong: false };
  }
  const priceDiffers = sku.reportedSalePriceReadable && sku.reportedSalePrice !== null
    && sku.salePrice !== null && sku.reportedSalePrice !== sku.salePrice;
  const stockDiffers = sku.reportedStockReadable && sku.reportedStock !== null
    && sku.listingStock !== null && sku.reportedStock !== sku.listingStock;
  if (priceDiffers || stockDiffers) {
    // 🔴 A DETERMINISTIC difference on a readable value — this one is real.
    return { kind: 'diverged', label: 'DIVERGED', strong: true };
  }
  if (sku.reportedSalePriceReadable && sku.reportedSalePrice !== null) {
    return { kind: 'aligned', label: 'ALIGNED', strong: false };
  }
  return null;
}

/** ⚠ Shown only when the channel actually reported a DIFFERENT readable figure. */
function ReportedPrice({ sku }: { readonly sku: ChannelListingSku }): React.JSX.Element | null {
  if (!sku.reportedSalePriceReadable || sku.reportedSalePrice === null) return null;
  if (sku.reportedSalePrice === sku.salePrice) return null;
  return (
    <div data-testid={`sku-reported-price-${sku.id}`} className="tabular-nums" style={muted}>
      reported {formatMoneyForDisplay(sku.reportedSalePrice)}
    </div>
  );
}

function ReportedStock({ sku }: { readonly sku: ChannelListingSku }): React.JSX.Element | null {
  if (!sku.reportedStockReadable || sku.reportedStock === null) return null;
  if (sku.reportedStock === sku.listingStock) return null;
  return (
    <div data-testid={`sku-reported-stock-${sku.id}`} className="tabular-nums" style={muted}>
      reported {sku.reportedStock}
    </div>
  );
}

/**
 * 🔴 `PRD-199` — the SALE PRICE is the normal price and the promotion is a TIME-BOUNDED
 * second one. `promotionActive` is DERIVED SERVER-SIDE from the clock, so a scheduled
 * promotion is never drawn as if it were running.
 *
 * <p>🔴 MRP IS RETIRED and appears nowhere.
 */
function PromotionInline({ sku }: { readonly sku: ChannelListingSku }): React.JSX.Element | null {
  if (sku.promotionPrice === null) return null;
  return (
    <div data-testid={`sku-promotion-${sku.id}`} className="tabular-nums" style={muted}>
      {sku.promotionActive ? 'promo now ' : 'promo '}
      {formatMoneyForDisplay(sku.promotionPrice)}
      {sku.promotionStartsAt && sku.promotionEndsAt && (
        <> · {formatShortMoment(sku.promotionStartsAt)} – {formatShortMoment(sku.promotionEndsAt)}</>
      )}
    </div>
  );
}

function Promotion({ sku }: { readonly sku: ChannelListingSku }): React.JSX.Element | null {
  if (sku.promotionPrice === null) return null;
  return (
    <div data-testid={`sku-promotion-${sku.id}`} style={{ ...note, marginTop: '10px' }}>
      <strong>{sku.promotionActive ? 'Promotion running' : 'Promotion scheduled'}</strong>
      {' — '}{formatMoneyForDisplay(sku.promotionPrice)} against a Sale Price of
      {' '}{formatMoneyForDisplay(sku.salePrice)}
      {sku.promotionStartsAt && sku.promotionEndsAt && (
        <> · {formatShortMoment(sku.promotionStartsAt)} to {formatShortMoment(sku.promotionEndsAt)}</>
      )}
    </div>
  );
}

/**
 * 🔴 `PRD-201.c` — THE PARCEL BELONGS TO THE ORDERABLE UNIT, because that is what a courier
 * collects. A variation listing has one parcel per SKU and never a listing-level one.
 *
 * <p>🔴 `PRD-201.f` — an unset measurement is ABSENT, never zero.
 */
function Parcel({ sku, compact = false }: { readonly sku: ChannelListingSku; readonly compact?: boolean }): React.JSX.Element | null {
  const dimensions = sku.packageLengthCm && sku.packageWidthCm && sku.packageHeightCm
    ? `${sku.packageLengthCm} × ${sku.packageWidthCm} × ${sku.packageHeightCm} cm`
    : null;
  const weight = sku.packageWeightKg ? `${sku.packageWeightKg} kg` : null;
  const parts = [weight, dimensions].filter(Boolean);

  if (compact) {
    if (parts.length === 0 && !sku.packageContent) return null;
    return (
      <div
        data-testid={`sku-parcel-${sku.id}`}
        // Spans the whole row, beneath its own columns.
        style={{ ...muted, gridColumn: '1 / -1', marginTop: '2px', overflowWrap: 'anywhere' }}
      >
        <span style={{ fontWeight: 700, letterSpacing: '.05em' }}>PARCEL </span>
        {parts.join(' · ')}
        {sku.packageContent && <> · {sku.packageContent}</>}
      </div>
    );
  }

  return (
    <div data-testid={`sku-parcel-${sku.id}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-divider-inner)' }}>
      <Fact label="Parcel" value={parts.length > 0 ? parts.join(' · ') : null} missing="Not measured" />
      <Fact label="What's in the box" value={sku.packageContent} missing="Not recorded" />
    </div>
  );
}

function Fact({
  label, value, missing, mono = false, numeric = false,
}: {
  readonly label: string;
  readonly value: string | null | undefined;
  readonly missing: string;
  readonly mono?: boolean;
  readonly numeric?: boolean;
}): React.JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={columnLabel}>{label}</div>
      <div
        className={numeric ? 'tabular-nums' : undefined}
        style={{
          fontSize: '12.5px',
          fontWeight: value ? 600 : 400,
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-demoted)',
          fontFamily: mono ? 'var(--font-family-mono)' : undefined,
          marginTop: '3px',
          overflowWrap: 'anywhere',
        }}
      >
        {value || missing}
      </div>
    </div>
  );
}

/** ⚠ Summed as EXACT DECIMAL STRINGS. Listing stock never becomes a JavaScript number. */
function stockTotal(skus: readonly ChannelListingSku[]): string {
  const values = skus.map((s) => s.listingStock).filter((v): v is string => v !== null);
  if (values.length === 0) return '—';
  const scale = Math.max(...values.map((v) => (v.split('.')[1] ?? '').length));
  const asUnits = values.map((v) => {
    const [whole, fraction = ''] = v.split('.');
    return BigInt((whole ?? '0') + fraction.padEnd(scale, '0'));
  });
  const sum = asUnits.reduce((a, b) => a + b, 0n).toString().padStart(scale + 1, '0');
  return scale === 0 ? sum : `${sum.slice(0, -scale)}.${sum.slice(-scale)}`.replace(/\.?0+$/, '');
}

/** 🔴 A RANGE, never an average. `TEC-015` — compared as decimal strings, never as numbers. */
function priceRange(skus: readonly ChannelListingSku[]): string {
  const prices = skus.map((s) => s.salePrice).filter((v): v is string => v !== null);
  if (prices.length === 0) return '—';
  const sorted = [...prices].sort(compareDecimal);
  const low = formatMoneyForDisplay(sorted[0]!);
  const high = formatMoneyForDisplay(sorted[sorted.length - 1]!);
  return low === high ? `${low}` : `${low} – ${high}`;
}

function compareDecimal(a: string, b: string): number {
  const [aw, af = ''] = a.split('.');
  const [bw, bf = ''] = b.split('.');
  const scale = Math.max(af.length, bf.length);
  const av = BigInt((aw ?? '0') + af.padEnd(scale, '0'));
  const bv = BigInt((bw ?? '0') + bf.padEnd(scale, '0'));
  return av === bv ? 0 : av < bv ? -1 : 1;
}

const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.1fr 1.2fr 0.9fr 0.7fr 1.2fr 120px',
  gap: '12px',
  minWidth: 0,
};

const singleCard: React.CSSProperties = {
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control)',
  padding: '14px 16px',
  minWidth: 0,
};

const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};

const muted: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-demoted)' };

const note: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.6,
  margin: '12px 0 0',
};

const totals: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '18px',
  marginTop: '12px',
  paddingTop: '11px',
  borderTop: '1px solid var(--color-divider-inner)',
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
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

/** ⚠ Strong TYPE, not a strong container. `UX-269` keeps the row's own border neutral. */
const strongChip: React.CSSProperties = {
  ...chipBase,
  border: '1.5px solid var(--color-ink)',
  color: 'var(--color-heading-ink)',
  fontWeight: 800,
};

const dashedChip: React.CSSProperties = {
  ...chipBase,
  border: '1px dashed var(--color-border-secondary-button)',
  color: 'var(--color-text-secondary)',
};

const action: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '28px',
  padding: '0 10px',
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control-small)',
  background: 'var(--color-surface)',
  fontSize: '11.5px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--color-secondary-text)',
  cursor: 'pointer',
};

const emptyBlock: React.CSSProperties = {
  border: '1px dashed var(--color-border-secondary-button)',
  borderRadius: 'var(--radius-control)',
  padding: '16px 12px',
  textAlign: 'center',
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
};

const clip: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};
