import { Link } from 'react-router-dom';
import { buttonStyle } from '../ui/primitives';
import type { SellableProduct, SellableProductSummary } from './sellableProductApi';

/**
 * The Sellable Products operational summary strip — five compact cards.
 *
 * <p>⚠ An operational summary, NOT a dashboard. No chart, no percentage, no trend, no revenue
 * and no margin — `UX-037.e` forbids a KPI strip on this workspace and `UX-080` forbids
 * inventing a metric.
 *
 * <p>🔴 `Active` counts `record_status = ACTIVE`, the canonical `SYS §7.1` master record state
 * verified before use. It is NOT an invented notion of "live", "published" or "sellable now":
 * publication is an `E-059` concern (`PRD-128`) and availability is a derived figure, not a
 * status.
 */
export function SellableProductSummaryStrip({
  summary,
}: {
  readonly summary: SellableProductSummary | null;
}): React.JSX.Element {
  const cards = [
    { key: 'total-sellable-products', label: 'Total Sellable Products', value: summary ? String(summary.totalSellableProducts) : '—' },
    { key: 'simple-count', label: 'SIMPLE', value: summary ? String(summary.simpleCount) : '—' },
    { key: 'assembled-count', label: 'ASSEMBLED', value: summary ? String(summary.assembledCount) : '—' },
    { key: 'bundle-count', label: 'BUNDLE', value: summary ? String(summary.bundleCount) : '—' },
    { key: 'active-sellable-products', label: 'Active Sellable Products', value: summary ? String(summary.activeSellableProducts) : '—' },
  ];

  return (
    <div
      data-testid="sellable-summary-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))`,
        gap: 'var(--space-5)',
        marginBottom: 'var(--space-6)',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.key}
          data-testid={`summary-${card.key}`}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--elevation-card)',
            padding: '12px 14px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: '10.5px',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.label}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '19px',
              lineHeight: '24px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--color-heading-ink)',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

const NEUTRAL_STATUS = { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' };

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: 'var(--color-status-confirmed-bg)', fg: 'var(--color-status-confirmed-fg)' },
  DRAFT: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' },
  SUSPENDED: { bg: 'var(--color-status-pending-bg)', fg: 'var(--color-status-pending-fg)' },
  ARCHIVED: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' },
};

/**
 * The row participates in the shared coherent workspace canvas.
 *
 * <p>`RULE 7.5` — when the minimum usable composition exceeds the viewport, content extends
 * beyond the visible area and `OperationalRegion` scrolls it. 🔴 Structural wrapping is never
 * the answer, so the row declares a floor rather than collapsing through it.
 *
 * <p>⚠ NOT a breakpoint. It triggers no media query and changes no layout, field, record count
 * or action — `RULE 7.10` and `RULE 7.3.a` are untouched.
 *
 * <p>Derived by adding this row's fixed parts, not copied from `StockItemCard`: card padding
 * `32` + thumbnail `38` + five `12px` gaps `60` + identity floor `200` + nature badge `~96` +
 * resolution region `220` + availability `132` + listing indicator `~110` + status `~80` +
 * action `~72`.
 */
const NATURE_LABEL: Record<string, string> = {
  SIMPLE: 'Simple',
  ASSEMBLED: 'Assembled',
  BUNDLE: 'Bundle',
};

/**
 * ONE Sellable Product = ONE compact full-width horizontal operational card (`UX-037.d`).
 *
 * <p>🔴 NOT a table row, NOT an ecommerce tile grid, NOT an image-led catalogue card.
 *
 * <p>🔴 `UX-037.a` — THERE IS NO GENERIC PRODUCT CARD. This card answers the Sellable layer's
 * own questions: *what do we sell · what nature is it · what does it resolve to · what
 * availability can it offer · what actions are available*. The RESOLUTION region renders
 * differently per nature by design; forcing all three natures into identical field semantics
 * for visual symmetry would reintroduce exactly the conflation `UX-035.a` forbids.
 *
 * <p>🔴 `RULE 7.4` / `UX-060` — the row never wraps structurally. Identity flexes and truncates;
 * every other region is fixed-width and holds position at 100% and 80% zoom alike. No
 * `transform: scale`, no viewport detection, no `flex-wrap`.
 *
 * <p>🔴 `UX-036` — the availability shown here is SELLABLE availability, derived from the
 * resolution target. It is never a Stock Item's physical or available quantity, and the two are
 * never one field.
 */
export function SellableProductCard({ item }: { readonly item: SellableProduct }): React.JSX.Element {
  const status = STATUS_STYLE[item.recordStatus] ?? NEUTRAL_STATUS;

  return (
    <div
      data-testid={`sellable-product-card-${item.sellableSku}`}
      className="operational-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        // 🔴 RULE 7.4 / UX-060 — the structure is stable and never wraps.
        flexWrap: 'nowrap',
        // RULE 7.5 — hold the composition and let OperationalRegion scroll.
        width: '100%',
        minWidth: 0,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--elevation-card)',
        padding: '12px 16px',
      }}
    >
      {/*
        §3.15 thumbnail geometry — 38×38, radius 9px. RULE 3.15.a / UX-037.g: the GEOMETRY is
        canonical, the image DATA MODEL is not. 🔴 Composition only, never evidence that an
        image field exists, and it never controls card height.
      */}
      <div
        aria-hidden="true"
        data-testid="sellable-product-thumb"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '9px',
          background: 'var(--color-status-neutral-bg)',
          flexShrink: 0,
        }}
      />

      {/* IDENTITY — the scan anchor. Shrink priority 1: flexes and ellipsises. */}
      <div style={{ minWidth: '150px', flex: '1 1 auto', overflow: 'hidden' }}>
        <Link
          to={`/inventory/products/sellable/${item.id}`}
          data-testid="sellable-product-name"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.name}
        </Link>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '2px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700 }}>{item.sellableSku}</span>
          {item.sellableCategory ? ` · ${item.sellableCategory}` : ''}
        </div>
      </div>

      {/*
        NATURE — the card's second question, and the one that decides how the rest reads.
        🔴 A NEUTRAL labelled carrier, never one of the five order-semantic status pairs:
        RULE 3.14.a keeps those to order semantics, and nature is not a status at all.
      */}
      <div style={{ width: '84px', flexShrink: 0 }}>
        <span
          data-testid="sellable-product-nature"
          style={{
            display: 'inline-flex',
            fontSize: '11.5px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            padding: '3px 10px',
            borderRadius: '999px',
            background: 'var(--color-status-neutral-bg)',
            color: 'var(--color-status-neutral-fg)',
            whiteSpace: 'nowrap',
          }}
        >
          {NATURE_LABEL[item.nature] ?? item.nature}
        </span>
      </div>

      {/* RESOLUTION TARGET — nature-specific by design (PRD-021). */}
      <div
        data-testid="sellable-product-resolution"
        style={{
          width: '180px',
          flexShrink: 0,
          overflow: 'hidden',
          paddingRight: 'var(--space-4)',
          borderRight: '1px solid var(--color-border-card)',
        }}
      >
        <ResolutionTarget item={item} />
      </div>

      {/* AVAILABILITY — derived from the resolution target, never stored (PRD-023). */}
      <div style={{ width: '112px', textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: 'var(--color-text-demoted)' }}>Sellable availability</div>
        {item.availableSaleUnits != null ? (
          <div
            className="tabular-nums"
            data-testid="sellable-availability"
            style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}
          >
            {item.availableSaleUnits} <span style={{ fontSize: '10px', fontWeight: 500 }}>units</span>
          </div>
        ) : (
          /*
            🔴 NOT ZERO. SYS-034 — an underivable figure is never presented as a measured zero.
            "No ACTIVE Build Template version" and "nothing buildable" are different statements
            with different remedies, and collapsing them would send the operator to the wrong one.
          */
          <div
            data-testid="sellable-availability-unresolved"
            title={item.availabilityUnresolvedReason ?? undefined}
            style={{
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Not derivable
          </div>
        )}
      </div>

      {/*
        LISTINGS — the card's fifth question.

        🔴 `E-059` has NO persistence in this stage, so there is no listing fact to report. A
        relationship indicator reading "0 listings" would be a fabricated business statement,
        and UX-037.f prohibits a listing-link COUNT outright even once the data exists. The
        surface states plainly that the module is not built.
      */}
      <div style={{ width: '98px', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: 'var(--color-text-demoted)' }}>Listings</div>
        <div
          data-testid="sellable-listings-indicator"
          style={{ fontSize: '12px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}
        >
          Not implemented
        </div>
      </div>

      {/* STATUS + ACTION — always reachable, never pushed off the row. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
        <span
          data-testid="sellable-product-status"
          style={{
            display: 'inline-flex',
            fontSize: '12px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '999px',
            background: status.bg,
            color: status.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {item.recordStatus}
        </span>
        <Link
          to={`/inventory/products/sellable/${item.id}`}
          data-testid="sellable-product-view"
          style={{ ...buttonStyle('secondary', 'row-action'), padding: '0 14px', textDecoration: 'none' }}
        >
          View
        </Link>
      </div>
    </div>
  );
}

/**
 * What this Sellable Product resolves to — `PRD-021`, one mechanism per nature.
 *
 * <p>🔴 The three renderings are deliberately NOT interchangeable. A `SIMPLE` product points at
 * a physical Stock Item; an `ASSEMBLED` one at a versioned Build Template; a `BUNDLE` at member
 * Sellable Products. Presenting them identically would assert an equivalence the three-layer
 * model denies.
 */
function ResolutionTarget({ item }: { readonly item: SellableProduct }): React.JSX.Element {
  const labelStyle: React.CSSProperties = { fontSize: '10px', color: 'var(--color-text-demoted)' };
  const valueStyle: React.CSSProperties = {
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  if (item.nature === 'SIMPLE') {
    return (
      <>
        <div style={labelStyle}>Stock Item</div>
        <div data-testid="resolution-simple" style={valueStyle}>
          {item.simpleTargetInventorySku ? (
            <>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700 }}>
                {item.simpleTargetInventorySku}
              </span>
              {item.simpleQuantityPerSaleUnit ? ` × ${item.simpleQuantityPerSaleUnit}` : ''}
            </>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Not mapped</span>
          )}
        </div>
      </>
    );
  }

  if (item.nature === 'ASSEMBLED') {
    return (
      <>
        <div style={labelStyle}>Finished + template</div>
        <div data-testid="resolution-assembled" style={valueStyle}>
          {item.assembledFinishedInventorySku ? (
            <>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700 }}>
                {item.assembledFinishedInventorySku}
              </span>
              {item.activeBuildTemplateVersion != null ? ` · v${item.activeBuildTemplateVersion}` : ''}
              {item.buildTemplateRequiredLineCount != null
                ? ` · ${item.buildTemplateRequiredLineCount} required component${
                    item.buildTemplateRequiredLineCount === 1 ? '' : 's'
                  }`
                : ''}
            </>
          ) : item.activeBuildTemplateVersion != null ? (
            <>
              v{item.activeBuildTemplateVersion}
              {item.buildTemplateRequiredLineCount != null
                ? ` · ${item.buildTemplateRequiredLineCount} required component${
                    item.buildTemplateRequiredLineCount === 1 ? '' : 's'
                  }`
                : ''}
            </>
          ) : (
            /* 🔴 PRD-081 — an ASSEMBLED product needs exactly one ACTIVE version. */
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>No active version</span>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div style={labelStyle}>Bundle members</div>
      <div data-testid="resolution-bundle" style={valueStyle}>
        {item.bundleMemberCount != null && item.bundleMemberCount > 0 ? (
          /*
            ✅ A member COUNT is permitted where the prohibited "used in N builds" is not: the
            counting basis IS canonical here — PRD-021 defines the target as an ordered list of
            member Sellable Products — so N is unambiguous (UX-037.f).
          */
          `${item.bundleMemberCount} member${item.bundleMemberCount === 1 ? '' : 's'}`
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>No members</span>
        )}
      </div>
    </>
  );
}
