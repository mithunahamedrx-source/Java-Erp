import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { EmptyState, SegmentedControl, StatusPill, buttonStyle } from '../ui/primitives';
import { ApiError } from '../platform/api';
import { fetchChannelOrderSummary, listChannelOrders } from './orderApi';
import type { ChannelOrderFilters, ChannelOrderRow, ChannelOrderSummary } from './orderApi';
import { StatusBadge } from './OrderBadges';
import { ORDER_LIFECYCLE_ROLE, semanticRoleOf } from '../design/semanticRole';
import {
  ORDER_ROW_COLUMNS,
  ORDER_STATUS_TABS,
  canonicalStatus,
  canonicalStatusLabel,
  channelSubtitle,
  customerName,
  displayMoment,
  displayMoney,
  displayStatus,
  orderTitle,
  ownershipLabel,
  pageHeaderButton,
  primaryStatus,
} from './orderView';

/**
 * FRAME 01 - Order Dashboard / List.
 *
 * Read-only `API_MANAGED` Orders first slice (`OSC-061`). The approved capture fixes a
 * card-list workspace, not a table (`OSC-030`). Undecided KPI/status controls stay out of
 * the operator UI until their business rules are ratified.
 */
/**
 * The sentinel for "no filter on this dimension".
 *
 * ⚠ `SegmentedControl` holds one selected value and an empty string is a legitimate search
 * term elsewhere, so the unfiltered option carries an explicit name rather than `''`. It never
 * reaches the API: it is translated to `undefined` before the request is built.
 */
const ALL = '__ALL__';

export default function OrdersPage(): React.JSX.Element {
  const [items, setItems] = useState<readonly ChannelOrderRow[]>([]);
  const [summary, setSummary] = useState<ChannelOrderSummary | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<ChannelOrderFilters>({});
  const [page, setPage] = useState(0);
  const [size] = useState(50);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  /*
    The channel options are held separately from `summary` so they survive a failed or empty
    reload. Rebuilding them from every response would make the control the operator just used
    flicker or vanish underneath them.
  */
  const [channelOptions, setChannelOptions] = useState<
    readonly { readonly channelType: string; readonly orderCount: number }[]
  >([]);
  /*
    ⚠ A status with no entry is ABSENT from the map, so its segment renders NO count rather than
    a fabricated `0` (`SYS-034`, `OSC-045`). A status the server reports as `0` renders `0`.
  */
  const statusCounts = new Map<string, number>(
    (summary?.statusCounts ?? []).map((entry) => [entry.status, entry.orderCount]),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [orders, totals] = await Promise.all([
        listChannelOrders(filters, page, size),
        fetchChannelOrderSummary(filters),
      ]);
      setItems(orders.content);
      setTotalElements(orders.totalElements);
      setTotalPages(orders.totalPages);
      setSummary(totals);
      setChannelOptions(totals.channelTypes ?? []);
    } catch (cause) {
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        setError(cause instanceof Error ? cause.message : 'Orders could not be loaded.');
      }
      setItems([]);
      setSummary(null);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, size]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = (): void => {
    setPage(0);
    setFilters((current) => ({ ...current, search: searchDraft.trim() || undefined }));
  };

  /*
    The search applies as the operator types, after a short pause.

    ⚠ The superseded implementation applied ONLY on Enter, with no button and no other
    affordance, so the field read as dead — it was reported as "not working". Enter still
    applies immediately through the form's submit; this simply stops the field from looking
    inert when nobody presses it.

    🔴 This is an input debounce and nothing else. It changes no page size, no record count and
    no permission (`RULE 7.3.a`), and it reads no viewport (`UX-266`).
  */
  useEffect(() => {
    const pending = searchDraft.trim() || undefined;
    if (pending === filters.search) {
      return;
    }
    const timer = setTimeout(() => {
      setPage(0);
      setFilters((current) => ({ ...current, search: pending }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, filters.search]);

  return (
    <>
      <PageHeader title="Orders" subtitle="All channels · operational workspace" />

      <SummaryStrip summary={summary} loading={loading} unavailable={forbidden || error !== null} />

      {/*
        🔴 `RULE 3.13` — the list status tabs ARE the canonical segmented control, and
        `RULE 5.2` requires it to be REUSED rather than re-cut: one container with
        `overflow: hidden`, `width: fit-content`, a permanently-present ink-filled active
        segment (`RULE 8.6.c`), and NO per-tab pill, gap or border.

        🔴 `UX-266` names tabs explicitly among the structural UI that DOES NOT WRAP, and
        `UX-265` forbids `overflow-x: auto` as the escape. The row therefore stays one row and
        participates in the one coherent workspace canvas above the guaranteed band (`UX-264`).
      */}
      <div className="operational-row" style={controlRowStyle}>
        <span style={filterLabelStyle}>STATUS</span>
        <SegmentedControl
          options={ORDER_STATUS_TABS.map((tab) => ({
            value: tab.value ?? ALL,
            label: tab.label,
            count: tab.value === null ? summary?.totalOrders : statusCounts.get(tab.value),
            /*
              🔴 The role comes from `semanticRole.ts`, the one source of semantic-role truth
              (`RULE 3.3.d`). It is NEVER derived from the label text here.
            */
            countTone:
              tab.value === null ? 'neutral' : semanticRoleOf(ORDER_LIFECYCLE_ROLE, tab.value),
          }))}
          value={filters.status ?? ALL}
          onChange={(next) => {
            setPage(0);
            setFilters((current) => ({ ...current, status: next === ALL ? undefined : next }));
          }}
        />
      </div>

      <div className="operational-row" style={controlRowStyle}>
        {/*
          ⚠ THE SEARCH SITS FIRST AND IS DELIBERATELY NARROW — a product-owner composition
          decision, 2026-08-23. It no longer stretches to fill the row: a `240px` flexible field
          swallowed every pixel the other controls did not claim, which is what pushed the
          period filter out of reach and made the row look like a search bar with decorations.
          🔴 `flexShrink: 0` keeps it from being squeezed instead, because `UX-266` forbids the
          row solving width pressure by reshaping itself.
        */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
          style={{ flex: '0 0 auto' }}
        >
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Order no., ref, customer"
            aria-label="Search orders"
            style={searchStyle}
          />
        </form>
        <span style={filterLabelStyle}>CHANNEL</span>
        {/*
          🔴 THE CHANNEL OPTIONS COME FROM THE SERVER, NOT FROM A LIST IN THE BROWSER.
          The superseded implementation hard-coded `Daraz · Website · Walk-in · Phone` and
          DISABLED every one of them, so the control could not be clicked at all. A fixed list
          here would also be a second register of a set `SYS-108` owns, offering filters that can
          only ever return nothing.

          ⚠ `UX-273.d` — showing `Daraz` is presentation; the canonical value stays the channel
          type, and nothing branches on the label.
        */}
        <SegmentedControl
          options={[
            { value: ALL, label: 'All channels' },
            ...channelOptions.map((option) => ({
              value: option.channelType,
              label: displayStatus(option.channelType),
            })),
          ]}
          value={filters.channelType ?? ALL}
          onChange={(next) => {
            setPage(0);
            setFilters((current) => ({ ...current, channelType: next === ALL ? undefined : next }));
          }}
        />
        <span style={filterLabelStyle}>PERIOD</span>
        {/*
          🔴 THE PERIOD FILTER USES THE SAME TIMESTAMP THE `Today's orders` CARD COUNTS — the
          moment the order entered THIS system — because two period bases on one screen is the
          exact defect `GAP-004` recorded when it asked what boundary the shipped `This month`
          KPI used and found no answer.

          🔴 `Day` · `Month` · `Year` are CALENDAR boundaries in `Asia/Dhaka` (`TEC-050`,
          `TEC-052`). ⚠ No rolling window is offered: no rolling-period concept exists anywhere
          in the corpus, so `last 30 days` would be inventing what `Month` means.

          ✅ `RULE 3.13` names the period filter as a third use of this same segmented control,
          and `RULE 5.2` requires it to be the same component — which it is.
        */}
        <SegmentedControl
          options={[
            { value: ALL, label: 'All time' },
            { value: 'DAY', label: 'Day' },
            { value: 'MONTH', label: 'Month' },
            { value: 'YEAR', label: 'Year' },
          ]}
          value={filters.period ?? ALL}
          onChange={(next) => {
            setPage(0);
            setFilters((current) => ({ ...current, period: next === ALL ? undefined : next }));
          }}
        />
        <div style={{ flex: 1, minWidth: 'var(--space-3)' }} />
        <button
          type="button"
          onClick={() => {
            setSearchDraft('');
            setFilters({});
            setPage(0);
          }}
          style={resetStyle}
        >
          Reset
        </button>
      </div>

      {loading ? (
        <OrdersSurface>
          <EmptyState title="Loading orders..." guidance="Fetching channel orders already imported into Trioloo." />
        </OrdersSurface>
      ) : forbidden ? (
        <OrdersSurface>
          <EmptyState title="Orders are not available" guidance="Your role does not include order.channel-order.view." />
        </OrdersSurface>
      ) : error ? (
        <OrdersSurface>
          <EmptyState title="Orders could not be loaded" guidance={error} />
        </OrdersSurface>
      ) : items.length === 0 ? (
        <OrdersSurface>
          <EmptyState title="No orders imported yet" guidance="Run the approved Daraz order pull, then this workspace will show the imported channel orders." />
        </OrdersSurface>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          {items.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      <div style={paginationStyle}>
        <span>
          Showing {totalElements === 0 ? '0' : `${page * size + 1}-${Math.min((page + 1) * size, totalElements)}`} of {totalElements} orders
          {summary ? ` · ${summary.totalItems} item${summary.totalItems === 1 ? '' : 's'}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={dateChipStyle}>{size} per page</span>
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} style={pagerButtonStyle}>‹</button>
          <span style={activePageStyle}>{page + 1}</span>
          <button
            type="button"
            disabled={totalPages === 0 || page + 1 >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            style={pagerButtonStyle}
          >
            ›
          </button>
        </div>
      </div>
    </>
  );
}

function OrdersSurface({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <section style={ordersSurfaceStyle}>{children}</section>;
}

/**
 * The four summary cards, ratified by the product owner on 2026-08-23.
 *
 * 🔴 Each figure is server-computed and rendered as received (`TEC-095`). Nothing here adds,
 * subtracts or rounds, and `Total collectable` never passes through a `Number` (`OSC-043`).
 *
 * 🔴 A figure the server could not supply renders as an explicit absence, never as `0`
 * (`OSC-045`, `SYS-034`, `BR-134`) — a real zero and an unavailable figure must not look alike.
 */
function SummaryStrip({
  summary,
  loading,
  unavailable,
}: {
  readonly summary: ChannelOrderSummary | null;
  readonly loading: boolean;
  readonly unavailable: boolean;
}): React.JSX.Element {
  const figure = (value: number | null | undefined): string =>
    loading ? '—' : unavailable || value === null || value === undefined ? 'Not available' : String(value);

  return (
    <div style={summaryStripStyle} data-testid="order-summary-strip">
      <SummaryCard label="Total orders" value={figure(summary?.totalOrders)} />
      <SummaryCard label="Today's orders" value={figure(summary?.todaysOrders)} note="Imported today · Asia/Dhaka" />
      <SummaryCard
        label="Today's dispatched"
        value={figure(summary?.todaysDispatched)}
        note="First observed dispatched today"
      />
      <SummaryCard
        label="Total collectable"
        value={
          loading
            ? '—'
            : unavailable
              ? 'Not available'
              : (displayMoney(summary?.totalCollectable ?? null) ?? 'Not available')
        }
        note="Delivered, not yet received"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}): React.JSX.Element {
  return (
    <article style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div className="tabular-nums" style={summaryValueStyle}>
        {value}
      </div>
      {note ? <div style={summaryNoteStyle}>{note}</div> : null}
    </article>
  );
}

function OrderCard({ order }: { readonly order: ChannelOrderRow }): React.JSX.Element {
  // 🔴 TWO STATUSES, TWO OWNERS, NEVER RECONCILED INTO ONE (`BR-171`, `UX-182`, `OSC-036`).
  // The canonical lifecycle reading and the marketplace's own report are rendered as separate,
  // separately labelled facts, and `Marketplace: Cancelled` beside a canonical state is a
  // legitimate reading rather than a contradiction to resolve.
  const canonical = canonicalStatus(order.canonicalStatuses);
  const reported = primaryStatus(order.statuses);
  return (
    <article style={orderCardStyle} data-testid="order-card">
      <div style={orderTopRowStyle}>
        <div style={avatarStyle} aria-hidden="true">{customerName(order).slice(0, 2).toUpperCase()}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
            <Link to={`/sales/orders/${order.id}`} style={orderLinkStyle}>{orderTitle(order)}</Link>
            <span style={customerStyle}>{customerName(order)}</span>
          </div>
          <div style={mutedLineStyle}>{channelSubtitle(order)}</div>
        </div>
        <div style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '12px' }}>
          <div>Captured</div>
          <strong style={{ color: 'var(--color-text-primary)', fontWeight: 650 }}>{displayMoment(order.providerCreatedAt, true)}</strong>
        </div>
        <StatusBadge>{ownershipLabel(order.ownership)}</StatusBadge>
      </div>
      <div style={orderMiddleRowStyle} className="operational-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0 }}>
          <div style={thumbnailStyle} aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <div style={itemTitleStyle}>{order.itemsCount ?? 0} imported item{order.itemsCount === 1 ? '' : 's'}</div>
            <div style={mutedLineStyle}>Payment · {order.paymentMethod || 'Not recorded'}</div>
          </div>
        </div>
        <Metric label="Cost" value="Not recorded" />
        <Metric label="Received" value="Not recorded" />
        <Metric label="Sale" value={displayMoney(order.price)} strong />
      </div>
      <div style={orderFooterStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
          {/*
            An order the adapter could translate nothing for says so. It does NOT borrow the
            marketplace's own word and present it as a canonical state (`BR-134`, `SYS-034`).
          */}
          {canonical ? (
            <StatusPill tone={semanticRoleOf(ORDER_LIFECYCLE_ROLE, canonical)}>
              {canonicalStatusLabel(canonical)}
            </StatusPill>
          ) : (
            <StatusBadge>Status not translated</StatusBadge>
          )}
          <StatusBadge>Marketplace · {reported === 'Not recorded' ? 'Not recorded' : reported}</StatusBadge>
          <StatusBadge>Payment · {order.paymentMethod || 'Not recorded'}</StatusBadge>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 650 }}>INVOICE</span>
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          <Link to={`/sales/orders/${order.id}`} style={{ ...buttonStyle('secondary', 'row-action'), ...pageHeaderButton }}>
            View
          </Link>
          <button type="button" disabled style={buttonStyle('secondary', 'row-action')}>More</button>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }): React.JSX.Element {
  return (
    <div style={{ textAlign: 'right', minWidth: 0 }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: strong ? '16px' : '13px', fontWeight: strong ? 800 : 500, color: 'var(--color-heading-ink)' }}>
        {value}
      </div>
    </div>
  );
}

const ordersSurfaceStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  overflow: 'hidden',
};

/*
  The KPI region the approved capture fixes at `82px`. 🔴 `RULE 7.4` / `UX-266` — a structured
  region does not wrap, so the four cards stay four across and the page never scrolls
  horizontally: each cell is `minmax(0, 1fr)` and its content ellipsises instead.
*/
const summaryStripStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 'var(--space-5)',
  marginTop: 'var(--space-7)',
};

const summaryCardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  padding: '13px 17px',
  minWidth: 0,
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 750,
  color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: '5px',
  fontSize: '22px',
  fontWeight: 800,
  color: 'var(--color-heading-ink)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryNoteStyle: React.CSSProperties = {
  marginTop: '3px',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/*
  One control row shape, used by BOTH the status row and the channel row.

  🔴 `UX-266` names tabs and filter/control rows among the structural UI that does not wrap, and
  `.operational-row` carries the `flex-wrap: nowrap !important` safety net that `RULE 7.4` and
  `UX-060` already established for every such row. 🔴 No `overflow-x` is declared here — `UX-265`
  forbids it as a responsive solution, and above the guaranteed 80%–110% band the row moves with
  the one coherent workspace canvas instead (`UX-263`, `UX-264`).
*/
const controlRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-6)',
  minWidth: 0,
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 750,
  color: 'var(--color-text-muted)',
  letterSpacing: '0',
  flexShrink: 0,
};

/*
  `RULE 3.18` — the approved search input geometry: `34px` / `9px` radius / `13px` text. Only
  the WIDTH is set here, and it is fixed rather than flexible so the field never grows to swallow
  the row (product-owner decision, 2026-08-23).
*/
const searchStyle: React.CSSProperties = {
  width: '232px',
  height: '34px',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  padding: '0 13px',
  font: 'inherit',
  fontSize: '13px',
};

const dateChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '34px',
  padding: '0 13px',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--color-text-muted)',
  background: 'var(--color-surface)',
  fontSize: '13px',
  whiteSpace: 'nowrap',
};

const resetStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
};

const orderCardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  overflow: 'hidden',
};

const orderTopRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: '14px 17px',
};

const avatarStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-status-neutral-bg)',
  color: 'var(--color-status-neutral-fg)',
  fontWeight: 750,
  fontSize: '11px',
  flexShrink: 0,
};

const orderLinkStyle: React.CSSProperties = {
  color: 'var(--color-heading-ink)',
  fontWeight: 800,
  fontSize: '13px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const customerStyle: React.CSSProperties = {
  color: 'var(--color-heading-ink)',
  fontSize: '13px',
  fontWeight: 650,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const mutedLineStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '12px',
  marginTop: '3px',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const orderMiddleRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: ORDER_ROW_COLUMNS,
  gap: 'var(--space-6)',
  alignItems: 'center',
  padding: '13px 17px',
  borderTop: '1px solid var(--color-divider-inner)',
};

const thumbnailStyle: React.CSSProperties = {
  width: '42px',
  height: '42px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-divider-light)',
  flexShrink: 0,
};

const itemTitleStyle: React.CSSProperties = {
  color: 'var(--color-heading-ink)',
  fontSize: '14px',
  fontWeight: 650,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const orderFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-5)',
  padding: '12px 17px',
  background: 'var(--color-divider-light)',
  borderTop: '1px solid var(--color-divider-inner)',
};

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 'var(--space-7)',
  color: 'var(--color-text-muted)',
  fontSize: '13px',
};

const pagerButtonStyle: React.CSSProperties = {
  ...buttonStyle('secondary', 'row-action'),
  width: '34px',
  padding: 0,
};

const activePageStyle: React.CSSProperties = {
  display: 'inline-flex',
  width: '34px',
  height: '34px',
  borderRadius: 'var(--radius-control)',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-ink)',
  color: 'var(--color-surface)',
  fontWeight: 800,
};
