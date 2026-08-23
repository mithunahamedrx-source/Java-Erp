import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { fetchChannelOrder } from './orderApi';
import type { AddressView, ChannelOrderDetail, ChannelOrderItemRow } from './orderApi';
import { BlockedMarker, StatusBadge, toneForStatus } from './OrderBadges';
import {
  addressLines,
  customerName,
  detailMeta,
  displayMoment,
  displayMoney,
  displayStatus,
  firstRecorded,
  itemLabel,
  orderTitle,
  ownershipLabel,
  primaryStatus,
} from './orderView';

const DETAIL_TABS = ['Overview', 'Fulfilment', 'Payment', 'Activity'] as const;

/**
 * FRAME 02, FRAME 03, FRAME 04, FRAME 05, FRAME 06, FRAME 07 AND FRAME 08 - Order Detail.
 *
 * The first Orders detail slice is read-only over imported channel orders (`OSC-061`). Panels
 * render stored snapshots only (`OSC-032`, `OSC-033`), keep lifecycle rows independent
 * (`OSC-031`), and mark unresolved actions rather than offering invented controls.
 */
export default function OrderDetailPage(): React.JSX.Element {
  const { id } = useParams();
  const [order, setOrder] = useState<ChannelOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setOrder(await fetchChannelOrder(id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Order could not be loaded.');
      setOrder(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !order) {
    return (
      <>
        <PageHeader title="Order" subtitle="Sales & Orders · Orders" />
        <Card>
          <EmptyState title="Order could not be loaded" guidance={error} />
        </Card>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <PageHeader title="Order" subtitle="Sales & Orders · Orders" />
        <Card>
          <EmptyState title="Loading order..." guidance="Fetching the imported channel order." />
        </Card>
      </>
    );
  }

  const status = primaryStatus(order.statuses);
  const headerActions = (
    <>
      <Button size="page-header" disabled describedBy="orders-amend-unavailable">Amend</Button>
      <Button size="page-header" disabled describedBy="orders-hold-unavailable">Release hold</Button>
      <Button size="page-header" variant="primary" disabled describedBy="orders-release-unavailable">Release to warehouse</Button>
    </>
  );

  return (
    <>
      <PageHeader
        title={`Order ${orderTitle(order)}`}
        subtitle={detailMeta(order)}
        actions={headerActions}
      />
      <div id="orders-amend-unavailable" style={srOnly}>Amend is not part of the read-only Orders slice.</div>
      <div id="orders-hold-unavailable" style={srOnly}>Hold release is not ratified for this slice.</div>
      <div id="orders-release-unavailable" style={srOnly}>Warehouse release is not ratified for this slice.</div>

      <div style={breadcrumbStyle}>
        <Link to="/sales/orders" style={{ color: 'var(--color-text-muted)' }}>Sales & Orders</Link>
        <span>/</span>
        <Link to="/sales/orders" style={{ color: 'var(--color-text-muted)' }}>Orders</Link>
        <span>/</span>
        <strong>{orderTitle(order)}</strong>
        <StatusBadge tone={toneForStatus(status)}>{displayStatus(status)}</StatusBadge>
        <StatusBadge>{ownershipLabel(order.ownership)}</StatusBadge>
      </div>

      <div style={tabsStyle}>
        {DETAIL_TABS.map((tab) => (
          <button key={tab} type="button" disabled={tab !== 'Overview'} style={tabStyle(tab === 'Overview')}>
            {tab}
          </button>
        ))}
      </div>

      <div style={detailGridStyle}>
        <main style={{ display: 'grid', gap: 'var(--space-7)', minWidth: 0 }}>
          <Panel title="Customer" tag="API-managed snapshot">
            <div style={twoColumnFactsStyle}>
              <Fact label="Name" value={customerName(order)} />
              <Fact label="Contact" value={contactValue(order.shippingAddress ?? order.billingAddress)} />
              <Fact label="Delivery address" value={addressValue(order.shippingAddress)} />
              <Fact label="Customer type" value="Channel customer" />
              <Fact label="Snapshot taken" value={displayMoment(order.providerCreatedAt)} />
              <Fact label="Notes" value={<><BlockedMarker>BLOCKED — MISSING CANONICAL BUSINESS RULE</BlockedMarker> <span>Order notes · GAP-066</span></>} />
            </div>
          </Panel>

          <Panel title="Items" tag={`${order.items.length} line${order.items.length === 1 ? '' : 's'} · qty not recorded`}>
            <div>
              {order.items.length === 0 ? (
                <EmptyState title="No item rows recorded" guidance="The order header was imported without item detail." />
              ) : (
                order.items.map((item) => <ItemRow key={item.id} item={item} />)
              )}
            </div>
            <div style={panelFooterNoteStyle}>
              <BlockedMarker>BLOCKED — MISSING CANONICAL BUSINESS RULE</BlockedMarker>
              <span>Line-level cancel · GAP-025 — undefined after release; no per-line control is drawn.</span>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Goods value</div>
                <strong className="tabular-nums">{displayMoney(order.price)}</strong>
              </div>
            </div>
          </Panel>

          <Panel title="Fulfilment & shipment" tag="Read-only">
            <div style={twoColumnFactsStyle}>
              <Fact label="Fulfilment state" value="Not progressed in Trioloo" />
              <Fact label="Warehouse" value={order.warehouseCode || 'Not recorded'} />
              <Fact label="Shipment" value={firstRecorded(order.items, (item) => item.trackingCode) || 'No tracking code recorded'} />
              <Fact label="Courier" value={firstRecorded(order.items, (item) => item.shipmentProvider) || 'Not recorded'} />
              <Fact label="Delivery info" value={order.deliveryInfo || 'Not recorded'} />
              <Fact label="Promised shipping" value={order.promisedShippingTimes || 'Not recorded'} />
            </div>
          </Panel>

          <Panel title="Activity" tag="Projection of the activity log — complete by construction">
            <div style={activityListStyle}>
              <ActivityRow title="Imported from channel" detail={`${order.channelName ?? 'Channel'} · ${displayMoment(order.importedAt)}`} time={displayMoment(order.importedAt, true)} />
              <ActivityRow title="Channel last reported this order" detail={order.statuses.map(displayStatus).join(', ') || 'Status not recorded'} time={displayMoment(order.lastSeenAt, true)} />
            </div>
            <div style={panelFooterNoteStyle}>
              <BlockedMarker>BLOCKED — MISSING CANONICAL BUSINESS RULE</BlockedMarker>
              <span>Ageing and SLA markers · GAP-024 — no residency threshold exists for these states.</span>
            </div>
          </Panel>
        </main>

        <aside style={rightRailStyle}>
          <RailCard title="Status">
            <StatusLine label="Order" value={displayStatus(status)} tone={toneForStatus(status)} />
            <StatusLine label="Verification" value="Pending verification" tone="pending" />
            <StatusLine label="Fulfilment" value="Not started" />
            <StatusLine label="Shipment" value={firstRecorded(order.items, (item) => item.trackingCode) ? 'Tracking recorded' : 'Not created'} />
            <StatusLine label="Payment" value={order.paymentMethod || 'Not recorded'} tone={order.paymentMethod ? 'pending' : 'neutral'} />
            <StatusLine label="Inventory" value="Not reserved" />
            <StatusLine label="Return" value="None" />
            <StatusLine label="Exchange" value="None" />
            <p style={railHelpStyle}>Each lifecycle is independent and never collapses into one status.</p>
          </RailCard>

          <RailCard title="Order summary">
            <MoneyLine label="Goods value" value={displayMoney(order.price)} />
            <MoneyLine label="Shipping fee" value={displayMoney(order.shippingFee)} />
            <MoneyLine label="Voucher" value={displayMoney(order.voucher)} />
            <MoneyLine label="Cash payment fee" value={displayMoney(order.cashPaymentFee)} />
            <div style={railDividerStyle} />
            <MoneyLine label="Order total" value={displayMoney(order.price)} strong />
            <MoneyLine label="Received" value="Not recorded" />
            <MoneyLine label="Outstanding" value="Not recorded" />
          </RailCard>

          <RailCard title="Payment">
            <Fact label="Collection mode" value={order.paymentMethod || 'Not recorded'} compact />
            <Fact label="Voucher code" value={order.voucherCode || 'None'} compact />
            <div style={railDividerStyle} />
            <BlockedMarker>BLOCKED — MISSING CANONICAL BUSINESS RULE</BlockedMarker>
            <p style={railHelpStyle}>Mark reconciled · GAP-019 residual — no control is offered.</p>
          </RailCard>

          <RailCard title="Channel references">
            <Fact label="Channel" value={order.channelName ?? 'Channel not recorded'} compact />
            <Fact label="Authority" value={ownershipLabel(order.ownership)} compact />
            <Fact label="External order ID" value={order.externalOrderId} compact />
            <Fact label="Order number" value={order.orderNumber || 'Not recorded'} compact />
            <Fact label="Tracking / AWB" value={firstRecorded(order.items, (item) => item.trackingCode) || 'None'} compact />
            <p style={railHelpStyle}>Marketplace facts remain external facts at takeover.</p>
          </RailCard>
        </aside>
      </div>
    </>
  );
}

function Panel({ title, tag, children }: { readonly title: string; readonly tag?: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section style={panelStyle}>
      <header style={panelHeaderStyle}>
        <h2 style={panelTitleStyle}>{title}</h2>
        {tag && <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{tag}</span>}
      </header>
      <div style={{ padding: '22px' }}>{children}</div>
    </section>
  );
}

function RailCard({ title, children }: { readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section style={railCardStyle}>
      <h3 style={railTitleStyle}>{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value, compact = false }: { readonly label: string; readonly value: React.ReactNode; readonly compact?: boolean }): React.JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: compact ? '11px' : '12px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: compact ? '13px' : '14px', color: 'var(--color-heading-ink)', lineHeight: 1.35 }}>{value}</div>
    </div>
  );
}

function ItemRow({ item }: { readonly item: ChannelOrderItemRow }): React.JSX.Element {
  return (
    <div style={itemRowStyle} className="operational-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0 }}>
        <div style={thumbnailStyle} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          <div style={itemTitleStyle}>{itemLabel(item)}</div>
          <div style={mutedLineStyle}>SKU {item.shopSku || item.sku || 'Not recorded'} {item.variation ? `· ${item.variation}` : ''}</div>
        </div>
      </div>
      <Metric label="Status" value={displayStatus(item.status)} />
      <Metric label="Unit price" value={displayMoney(item.itemPrice)} />
      <Metric label="Paid price" value={displayMoney(item.paidPrice)} strong />
    </div>
  );
}

function Metric({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }): React.JSX.Element {
  return (
    <div style={{ textAlign: 'right', minWidth: 0 }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: strong ? '14px' : '13px', fontWeight: strong ? 750 : 500, color: 'var(--color-heading-ink)' }}>{value}</div>
    </div>
  );
}

function StatusLine({ label, value, tone = 'neutral' }: { readonly label: string; readonly value: string; readonly tone?: Parameters<typeof StatusBadge>[0]['tone'] }): React.JSX.Element {
  return (
    <div style={statusLineStyle}>
      <span>{label}</span>
      <StatusBadge tone={tone}>{value}</StatusBadge>
    </div>
  );
}

function MoneyLine({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }): React.JSX.Element {
  return (
    <div style={moneyLineStyle}>
      <span>{label}</span>
      <strong className="tabular-nums" style={{ fontWeight: strong ? 800 : 500, color: strong ? 'var(--color-heading-ink)' : 'var(--color-text-primary)' }}>{value}</strong>
    </div>
  );
}

function ActivityRow({ title, detail, time }: { readonly title: string; readonly detail: string; readonly time: string }): React.JSX.Element {
  return (
    <div style={activityRowStyle}>
      <span style={activityDotStyle} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 650, color: 'var(--color-heading-ink)' }}>{title}</div>
        <div style={mutedLineStyle}>{detail}</div>
      </div>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{time}</span>
    </div>
  );
}

function contactValue(address: AddressView | null | undefined): string {
  return address?.phone || address?.phone2 || 'Not recorded';
}

function addressValue(address: AddressView | null | undefined): string {
  const lines = addressLines(address).filter((line) => !/^\+/.test(line));
  return lines.length > 0 ? lines.join(', ') : 'Not recorded';
}

const breadcrumbStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  color: 'var(--color-text-muted)',
  fontSize: '12px',
  marginTop: '-18px',
  marginBottom: 'var(--space-6)',
};

const tabsStyle: React.CSSProperties = {
  display: 'inline-flex',
  background: 'var(--color-divider-light)',
  borderRadius: 'var(--radius-card-small)',
  padding: '4px',
  marginBottom: 'var(--space-7)',
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    height: '36px',
    minWidth: '92px',
    border: 'none',
    borderRadius: 'var(--radius-control)',
    background: active ? 'var(--color-surface)' : 'transparent',
    boxShadow: active ? 'var(--elevation-active-tab)' : 'none',
    color: active ? 'var(--color-heading-ink)' : 'var(--color-text-secondary)',
    fontSize: '13px',
    fontWeight: active ? 700 : 550,
    cursor: active ? 'default' : 'not-allowed',
  };
}

const detailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 380px',
  gap: 'var(--space-7)',
  alignItems: 'start',
};

const rightRailStyle: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--space-6)',
  position: 'sticky',
  top: '0',
};

const panelStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  overflow: 'hidden',
};

const panelHeaderStyle: React.CSSProperties = {
  height: '58px',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: '0 22px',
  borderBottom: '1px solid var(--color-divider-inner)',
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--color-heading-ink)',
  fontSize: '16px',
  fontWeight: 800,
};

const twoColumnFactsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: '22px 48px',
};

const panelFooterNoteStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  color: 'var(--color-text-muted)',
  fontSize: '12px',
  paddingTop: 'var(--space-6)',
  marginTop: 'var(--space-6)',
  borderTop: '1px solid var(--color-divider-inner)',
};

const itemRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(120px, 0.4fr) minmax(120px, 0.4fr) minmax(120px, 0.4fr)',
  gap: 'var(--space-6)',
  alignItems: 'center',
  minHeight: '74px',
  borderBottom: '1px solid var(--color-divider-inner)',
};

const thumbnailStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-divider-light)',
  flexShrink: 0,
};

const itemTitleStyle: React.CSSProperties = {
  color: 'var(--color-heading-ink)',
  fontSize: '14px',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const mutedLineStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '12px',
  marginTop: '4px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const railCardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  padding: '20px',
};

const railTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  color: 'var(--color-heading-ink)',
  fontSize: '14px',
  fontWeight: 800,
};

const statusLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  color: 'var(--color-text-muted)',
  fontSize: '13px',
  marginBottom: '13px',
};

const railHelpStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '12px',
  lineHeight: 1.35,
  margin: '12px 0 0',
};

const railDividerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--color-divider-inner)',
  margin: '12px 0',
};

const moneyLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-5)',
  color: 'var(--color-text-muted)',
  fontSize: '13px',
  marginBottom: '11px',
};

const activityListStyle: React.CSSProperties = {
  display: 'grid',
};

const activityRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  padding: '12px 0',
  borderBottom: '1px solid var(--color-divider-inner)',
};

const activityDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '999px',
  background: 'var(--color-ink)',
  marginTop: '5px',
  flexShrink: 0,
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
