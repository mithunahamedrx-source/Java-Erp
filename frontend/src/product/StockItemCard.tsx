import { Link } from 'react-router-dom';
import { buttonStyle } from '../ui/primitives';
import type { StockItem, StockItemSummary } from './stockItemApi';

/**
 * The Stock Items operational summary strip — five compact cards.
 *
 * <p>⚠ An operational summary, NOT a dashboard. There is no chart, no percentage change, no
 * trend arrow, no revenue, margin or sales statistic — `UX-080` forbids inventing a metric and
 * none of those is canonical here.
 *
 * <p>🔴 Total Stock Value is OMITTED ENTIRELY when the actor lacks
 * `inventory-costing.valuation.view`. It is never rendered as `৳0`, because permission denied
 * is not a measured zero (`ICO-038.a`, `SYS-034`).
 */
export function StockItemSummaryStrip({
  summary,
}: {
  readonly summary: StockItemSummary | null;
}): React.JSX.Element {
  const valuationVisible = summary != null && summary.totalStockValue != null;

  const cards: { key: string; label: string; value: string }[] = [
    { key: 'total-stock-items', label: 'Total Stock Items', value: summary ? String(summary.totalStockItems) : '—' },
    { key: 'physical-stock-units', label: 'Physical Stock Units', value: summary ? summary.physicalStockUnits : '—' },
    { key: 'available-units', label: 'Available Units', value: summary ? summary.availableUnits : '—' },
    { key: 'out-of-stock-items', label: 'Out of Stock Items', value: summary ? String(summary.outOfStockItems) : '—' },
  ];

  if (valuationVisible) {
    cards.push({ key: 'total-stock-value', label: 'Total Stock Value', value: summary!.totalStockValue! });
  }

  return (
    <div
      data-testid="stock-summary-strip"
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

/**
 * The row participates in the shared coherent workspace canvas.
 *
 * <p>`RULE 7.5` — when the minimum usable composition exceeds the available viewport, content
 * extends beyond the visible area and `OperationalRegion` scrolls it. 🔴 Structural wrapping is
 * never the answer, so the row declares a floor rather than collapsing through it.
 *
 * <p>⚠ This is NOT a breakpoint. It triggers no media query and changes no layout, no field,
 * no record count and no action — `RULE 7.10` and `RULE 7.3.a` are untouched. It is the width
 * below which the ratified composition stops being readable, which is exactly the quantity
 * `RULE 7.5` names.
 *
 * <p>Derived by adding the row's fixed parts, not chosen: card padding `32` + thumbnail `38` +
 * five `12px` gaps `60` + identity floor `180` + status `~80` + metric group `171`
 * (`74 + 10 + 74` plus `12` padding and its `1px` rule) + valuation `132` + action group `~172`
 * at its widest, when the out-of-stock indicator is present.
 */
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: 'var(--color-status-confirmed-bg)', fg: 'var(--color-status-confirmed-fg)' },
  DRAFT: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' },
  SUSPENDED: { bg: 'var(--color-status-pending-bg)', fg: 'var(--color-status-pending-fg)' },
  ARCHIVED: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' },
};

/**
 * ONE Stock Item = ONE compact full-width horizontal operational card.
 *
 * <p>🔴 NOT a table row, NOT an ecommerce tile, NOT an image-led catalogue card. `§3.15`
 * records that the approved collection is a card list, and `RULE 3.15.a.c` prohibits an image
 * tile.
 *
 * <p>🔴 `RULE 7.4` / `UX-060` — the row never wraps structurally. Identity flexes and
 * truncates; quantity, valuation and action regions are fixed-width and hold their positions
 * at 100% and 80% zoom alike. No `transform: scale`, no viewport detection, no `flex-wrap`.
 *
 * <p>🔴 Stock Value is presented as INVENTORY VALUATION, beside the quantities it derives
 * from — never in a price or revenue position. It is omitted when withheld, never zeroed.
 */
export function StockItemCard({ item }: { readonly item: StockItem }): React.JSX.Element {
  const status = STATUS_STYLE[item.recordStatus] ?? NEUTRAL_STATUS;

  return (
    <div
      data-testid={`stock-item-card-${item.inventorySku}`}
      className="operational-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        // 🔴 RULE 7.4 / UX-060 - the structure is stable and never wraps.
        flexWrap: 'nowrap',
        // RULE 7.5 - hold the composition and let OperationalRegion scroll, rather than
        // squeezing the row until the record action leaves the usable content region.
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
        §3.15 product-row thumbnail geometry — 38×38, radius 9px. RULE 3.15.a: the GEOMETRY is
        canonical, the image DATA MODEL is not. 🔴 This is composition only and is never
        evidence that an image field exists. A missing image uses the ratified empty block.
      */}
      <div
        aria-hidden="true"
        data-testid="stock-item-thumb"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '9px',
          background: 'var(--color-status-neutral-bg)',
          flexShrink: 0,
        }}
      />

      {/* IDENTITY — the scan anchor. Flexes and truncates; never wraps. */}
      {/*
        Shrink priority 1 - the identity region absorbs flexible width first and ellipsises,
        so the factual metrics, the status and the record action keep their positions.
        `min-width` is a floor rather than a fixed width: below it the row stops shrinking and
        the region scrolls instead (RULE 7.5).
      */}
      <div style={{ minWidth: '140px', flex: '1 1 auto', overflow: 'hidden' }}>
        <Link
          to={`/inventory/products/stock/${item.id}`}
          data-testid="stock-item-name"
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
          {item.technicalName}
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
          <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700 }}>{item.inventorySku}</span>
          {item.inventoryCategory ? ` · ${item.inventoryCategory}` : ''}
          {item.brand ? ` · ${item.brand}` : ''}
        </div>
      </div>

      {/* CLASSIFICATION — conditional, and only where a canonical fact exists. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
        {item.serializationPolicy === 'SERIALIZED' && (
          <span
            data-testid="serialized-badge"
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-text-secondary)',
            }}
          >
            SERIALIZED
          </span>
        )}
        <span
          data-testid="stock-item-status"
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
      </div>

      {/* INVENTORY POSITION — derived, never stored. Fixed width so columns stay aligned. */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          paddingRight: 'var(--space-3)',
          borderRight: '1px solid var(--color-border-card)',
          flexShrink: 0,
        }}
      >
        <Metric label="Physical" value={item.physicalStock} unit={item.unitOfMeasure} />
        <Metric label="Available" value={item.availableQuantity} unit={item.unitOfMeasure} emphasise />
      </div>

      {/* VALUATION — present only where authorised. 🔴 Absent, never ৳0. */}
      <div style={{ width: '108px', textAlign: 'right', flexShrink: 0 }}>
        {item.stockValue != null ? (
          <>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>Stock Value</div>
            <div
              className="tabular-nums"
              data-testid="stock-item-value"
              style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}
            >
              {item.stockValue}
            </div>
          </>
        ) : null}
      </div>

      {/* STATE + ACTIONS — always reachable, never pushed off the row. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
        {item.outOfStock && (
          <span
            data-testid="out-of-stock-indicator"
            style={{
              display: 'inline-flex',
              fontSize: '12px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'var(--color-status-cancelled-bg)',
              color: 'var(--color-status-cancelled-fg)',
              whiteSpace: 'nowrap',
            }}
          >
            Out of stock
          </span>
        )}
        <Link
          to={`/inventory/products/stock/${item.id}`}
          data-testid="stock-item-view"
          style={{ ...buttonStyle('secondary', 'row-action'), padding: '0 14px', textDecoration: 'none' }}
        >
          View
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  emphasise = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly emphasise?: boolean;
}): React.JSX.Element {
  return (
    <div style={{ textAlign: 'right', minWidth: '62px' }}>
      <div style={{ fontSize: '10px', color: 'var(--color-text-demoted)' }}>{label}</div>
      <div
        className="tabular-nums"
        style={{
          fontSize: emphasise ? '15px' : '12px',
          fontWeight: emphasise ? 700 : 600,
          color: emphasise ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {value} <span style={{ fontSize: '10px', fontWeight: 500 }}>{unit}</span>
      </div>
    </div>
  );
}
