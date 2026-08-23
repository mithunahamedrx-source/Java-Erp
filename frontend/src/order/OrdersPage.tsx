import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, EmptyState, buttonStyle } from '../ui/primitives';
import { ApiError } from '../platform/api';
import { fetchChannelOrderSummary, listChannelOrders } from './orderApi';
import type { ChannelOrderFilters, ChannelOrderRow, ChannelOrderSummary } from './orderApi';
import { BlockedMarker, StatusBadge, toneForStatus } from './OrderBadges';
import {
  ORDER_ROW_COLUMNS,
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

const STATUS_TABS = [
  'All',
  'Pending verification',
  'Confirmed',
  'Released',
  'In fulfilment',
  'Ready to ship',
  'Dispatched',
  'Delivered',
  'Failed delivery',
  'On hold',
  'Cancelled',
  'Closed',
] as const;

/**
 * FRAME 01 - Order Dashboard / List.
 *
 * Read-only `API_MANAGED` Orders first slice (`OSC-061`). The approved capture fixes a
 * card-list workspace, not a table (`OSC-030`), and blocked KPI/status semantics keep their
 * geometry while stating the missing rule instead of inventing one (`OSC-051`).
 */
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

  const headerActions = useMemo(
    () => (
      <>
        <Button size="page-header" disabled describedBy="orders-export-unavailable">Export</Button>
        <Button size="page-header" variant="primary" disabled describedBy="orders-new-unavailable">New order</Button>
      </>
    ),
    [],
  );

  const applySearch = (): void => {
    setPage(0);
    setFilters((current) => ({ ...current, search: searchDraft.trim() || undefined }));
  };

  return (
    <>
      <PageHeader title="Orders" subtitle="All channels · operational workspace" actions={headerActions} />
      <div id="orders-export-unavailable" style={srOnly}>Export is not in the Orders MVP.</div>
      <div id="orders-new-unavailable" style={srOnly}>Manual order capture is not designed in this pack.</div>

      <section style={blockedKpiStyle} data-testid="orders-kpi-blocked">
        <BlockedMarker>BLOCKED — MISSING CANONICAL BUSINESS RULE</BlockedMarker>
        <span>KPI row · GAP-004 — the four shipped KPIs are undefined. Geometry is fixed; no KPI is invented.</span>
      </section>

      <div style={tabsStyle} aria-label="Order states">
        {STATUS_TABS.map((tab) => (
          <button key={tab} type="button" disabled={tab !== 'All'} style={tabStyle(tab === 'All')}>
            {tab}
          </button>
        ))}
      </div>
      <div style={blockedLineStyle}>
        <BlockedMarker>BLOCKED — MISSING CANONICAL BUSINESS RULE</BlockedMarker>
        <span>
          Legacy label mapping · GAP-017 — tabs are named for ratified SM-1 states. Shipped, RTS, Pending and B2C Pending
          have no canonical state set.
        </span>
      </div>

      <div style={filterRowStyle}>
        <span style={filterLabelStyle}>FILTER</span>
        <div style={segmentStyle}>
          {['All channels', 'Daraz', 'Website', 'Walk-in', 'Phone'].map((label) => (
            <button key={label} type="button" disabled={label !== 'All channels'} style={segmentButtonStyle(label === 'All channels')}>
              {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
          style={{ minWidth: 0, flex: '1 1 320px' }}
        >
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Order no., marketplace ref, customer"
            aria-label="Search orders"
            style={searchStyle}
          />
        </form>
        <span style={dateChipStyle}>Captured · last 30 days</span>
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
          <EmptyState title="No imported orders yet" guidance="Run an approved inbound pull before this workspace can show channel orders." />
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

function OrderCard({ order }: { readonly order: ChannelOrderRow }): React.JSX.Element {
  const status = primaryStatus(order.statuses);
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
          <StatusBadge tone={toneForStatus(status)}>{displayStatus(status)}</StatusBadge>
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

const blockedKpiStyle: React.CSSProperties = {
  minHeight: '84px',
  border: '1px dashed var(--color-text-demoted)',
  borderRadius: 'var(--radius-panel)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3)',
  color: 'var(--color-text-muted)',
  fontSize: '12.5px',
  marginBottom: 'var(--space-6)',
};

const tabsStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  padding: '4px',
  maxWidth: '100%',
  overflow: 'hidden',
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    height: '31px',
    padding: '0 12px',
    border: 'none',
    borderRadius: 'var(--radius-control-small)',
    background: active ? 'var(--color-ink)' : 'transparent',
    color: active ? 'var(--color-surface)' : 'var(--color-text-secondary)',
    fontWeight: active ? 750 : 550,
    fontSize: '13px',
    whiteSpace: 'nowrap',
    cursor: active ? 'default' : 'not-allowed',
  };
}

const blockedLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  margin: 'var(--space-3) 0 var(--space-5)',
  color: 'var(--color-text-muted)',
  fontSize: '12px',
};

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  marginBottom: 'var(--space-6)',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 750,
  color: 'var(--color-text-muted)',
  letterSpacing: '0',
};

const segmentStyle: React.CSSProperties = {
  display: 'inline-flex',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  overflow: 'hidden',
  background: 'var(--color-surface)',
};

function segmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: '32px',
    border: 'none',
    borderRight: active ? 'none' : '1px solid var(--color-divider-light)',
    background: active ? 'var(--color-ink)' : 'transparent',
    color: active ? 'var(--color-surface)' : 'var(--color-text-secondary)',
    fontSize: '13px',
    fontWeight: active ? 750 : 500,
    padding: '0 14px',
    cursor: active ? 'default' : 'not-allowed',
  };
}

const searchStyle: React.CSSProperties = {
  width: '100%',
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

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
