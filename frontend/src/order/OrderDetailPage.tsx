import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, DetailTabs, EmptyState } from '../ui/primitives';
import type { SemanticTone } from '../ui/primitives';
import { fetchChannelOrder } from './orderApi';
import type { AddressView, ChannelOrderDetail, ChannelOrderItemRow } from './orderApi';
import { ORDER_LIFECYCLE_ROLE, PAYMENT_POSITION_ROLE, semanticRoleOf } from '../design/semanticRole';
import {
  addressLines,
  canonicalStatus,
  canonicalStatusLabel,
  customerName,
  displayMoment,
  displayMoney,
  displayStatus,
  itemLabel,
  orderTitle,
  paymentPosition,
  primaryStatus,
} from './orderView';

/**
 * FRAME 02 — Order detail, with `FRAME 03`–`FRAME 09` as its PANELS.
 *
 * <p>🔴 `OSC-020.a` — `FRAME 03` THROUGH `FRAME 09` ARE PANELS OF THIS SURFACE, NOT SEPARATE
 * ROUTES. Designing or routing nine pages would build a structure the contract forbids.
 *
 * <p>🔴 `OSC-031` — ONE ROW PER LIFECYCLE, NEVER MERGED. A single merged status field is the
 * failure `OM §18.1` exists to prevent, and the Overview panel's eight rows are the whole point
 * of this page.
 *
 * <p>🔴 EVERY PANEL RENDERS STORED SNAPSHOTS AND NOTHING ELSE (`OSC-032`, `OSC-033`). The
 * prototype this page is transcribed from is populated with sample data — a picker's name, a pick
 * task, a tracking timeline, an activity log. 🔴 NONE OF THOSE RECORDS EXISTS. `SYS-034` and
 * `BR-134` require an absent fact to say so in words, so each is rendered as its absence and the
 * panel says which record would hold it. ⚠ Printing the prototype's sample values would be the
 * single most damaging thing this file could do: an operator would read a picker, a warehouse and
 * a delivery scan that never happened.
 *
 * <p>🔴 `BR-164` — `Confirmed By` IS NEVER DERIVED. Not from an assigned agent, not from the
 * current owner, not from audit history. Its ABSENCE is the fact (`BR-166`, `UX-181`).
 */

const PANELS: readonly string[] = [
  'Overview',
  'Items',
  'Buyer',
  'Payment',
  'Fulfilment',
  'Marketplace',
  'Activity',
  'Exceptions',
];

export default function OrderDetailPage(): React.JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ChannelOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  /*
    ⚠ THE ACTIVE PANEL LIVES IN THE URL, NOT ONLY IN STATE. The workspace's row menu deep-links
    straight to `Activity` and `Fulfilment`, and a panel that could only be reached by clicking
    would make those two menu items lie.
  */
  const [params, setParams] = useSearchParams();
  const requested = params.get('panel');
  const panel = requested && PANELS.includes(requested) ? requested : 'Overview';

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
        <Section title="Order could not be loaded">
          <EmptyState title="Order could not be loaded" guidance={error} />
        </Section>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <PageHeader title="Order" subtitle="Sales & Orders · Orders" />
        <Section title="Order">
          <EmptyState title="Loading order…" guidance="Fetching the imported channel order." />
        </Section>
      </>
    );
  }

  /*
    🔴 TWO STATUSES, TWO OWNERS (`BR-171`, `UX-182`, `OSC-036`). `canonical` is the ERP-vocabulary
    mirror the adapter produced; `reported` is the marketplace's own word. The surface renders
    both and never presents the second as the order's lifecycle state.
  */
  const canonical = canonicalStatus(order.canonicalStatuses);
  const reported = primaryStatus(order.statuses);
  const role = canonical ? semanticRoleOf(ORDER_LIFECYCLE_ROLE, canonical) : 'neutral';
  const name = order.triolooInvoiceNumber ?? orderTitle(order);
  const channel = displayStatus(order.channelType) || 'Channel not recorded';
  const direct = order.ownership === 'ERP_MANAGED';

  return (
    <>
      <PageHeader
        title={`Order ${name}`}
        breadcrumb={
          <>
            <span>Sales &amp; Orders</span>
            <span>/</span>
            <Link to="/sales/orders" style={crumbLinkStyle}>Orders</Link>
            <span>/</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{name}</span>
          </>
        }
        badge={
          <span style={chipStyle(role)}>
            {canonical ? canonicalStatusLabel(canonical) : 'Status not translated'}
          </span>
        }
        subtitle={[
          `Captured from ${channel}`,
          order.channelName ?? 'Shop not recorded',
          displayMoment(order.providerCreatedAt),
        ].join(' · ')}
        actions={
          <>
            <Button
              variant="secondary"
              size="page-header"
              onClick={() => navigate(`/sales/orders/${order.id}/invoice`, { state: { from: 'detail' } })}
              testId="order-print-invoice"
            >
              <PrinterIcon />
              Print invoice
            </Button>
            {/*
              🔴 DIMMED, NOT FAKED. `BR-151` prohibits hold ageing, expiry and auto-release, and
              `PRM-025` requires per-record authority — but the decisive fact is simpler: no hold
              endpoint exists. A control that appeared to place a hold and placed none would be
              worse than no control at all.
            */}
            <Button
              variant="secondary"
              size="page-header"
              disabled
              describedBy="order-hold-reason"
              testId="order-place-hold"
            >
              Place hold
            </Button>
            {/* `RULE 3.11` — exactly one primary, and it is rightmost. */}
            <Button
              variant="primary"
              size="page-header"
              onClick={() => setParams({ panel: 'Fulfilment' })}
              testId="order-open-shipment"
            >
              Open shipment
            </Button>
          </>
        }
      />

      <p style={reasonStyle} id="order-hold-reason">
        <strong>Place hold</strong> is unavailable: no hold endpoint exists, and <code>GAP-034</code>{' '}
        records no permitted-action inventory. A hold names the actor who placed it and never
        expires, ages or releases itself (<code>BR-151</code>).
      </p>

      <div style={{ marginBottom: 'var(--space-7)' }}>
        <DetailTabs
          options={PANELS}
          value={panel}
          onChange={(next) => setParams(next === 'Overview' ? {} : { panel: next })}
          testId="order-panels"
        />
      </div>

      {panel === 'Overview' && <Overview order={order} canonical={canonical} reported={reported} channel={channel} direct={direct} />}
      {panel === 'Items' && <Items order={order} />}
      {panel === 'Buyer' && <Buyer order={order} />}
      {panel === 'Payment' && <Payment order={order} canonical={canonical} />}
      {panel === 'Fulfilment' && <Fulfilment order={order} />}
      {panel === 'Marketplace' && <Marketplace order={order} canonical={canonical} reported={reported} channel={channel} direct={direct} />}
      {panel === 'Activity' && <Activity order={order} canonical={canonical} reported={reported} channel={channel} />}
      {panel === 'Exceptions' && <Exceptions />}
    </>
  );
}

/* ---------------------------------------------------------------- Overview */

/**
 * `FRAME 02` — the eight lifecycle rows and the capture facts.
 *
 * <p>🔴 SIX OF THE EIGHT MACHINES HAVE NO RECORD IN THIS SYSTEM, AND EACH SAYS SO. `SM-2`
 * verification, `SM-3` fulfilment, `SM-6` inventory, `SM-7` return and `SM-8` exchange have no
 * stored state; `SM-4` has one only once a consignment is booked. ⚠ The prototype fills all eight
 * with sample states, and reproducing that would tell an operator the goods were picked and
 * packed by a named person on a date nothing recorded.
 *
 * <p>✅ TWO ARE REAL. `SM-1` is the adapter's canonical mirror, and `SM-5` is the derivation
 * `OM §11.3` and `EVT-013` make automatic from delivery alone — the same one `Total collectable`
 * already makes.
 */
function Overview({
  order,
  canonical,
  reported,
  channel,
  direct,
}: {
  readonly order: ChannelOrderDetail;
  readonly canonical: string | null;
  readonly reported: string;
  readonly channel: string;
  readonly direct: boolean;
}): React.JSX.Element {
  const payment = paymentPosition(canonical);
  const lifecycle: readonly LifecycleRow[] = [
    {
      name: 'Order',
      machine: 'SM-1',
      state: canonical ? canonicalStatusLabel(canonical) : 'Status not translated',
      tone: canonical ? semanticRoleOf(ORDER_LIFECYCLE_ROLE, canonical) : 'neutral',
      meta: `Last observed ${displayMoment(order.lastSeenAt)} · ${
        direct ? 'captured in Trioloo' : `mirrored from ${channel} by the channel adapter`
      }`,
    },
    {
      name: 'Verification',
      machine: 'SM-2',
      state: 'Not recorded',
      tone: 'neutral',
      // 🔴 BR-164 / BR-166 — never derived, and its absence is the fact.
      meta: 'No verification record is held. A confirmer is never inferred from an agent, an owner or the audit history.',
    },
    {
      name: 'Fulfilment',
      machine: 'SM-3',
      state: 'Not recorded',
      tone: 'neutral',
      meta: 'No pick task, warehouse release or picker is recorded against this order.',
    },
    {
      name: 'Shipment',
      machine: 'SM-4',
      state: order.shipmentState ? displayStatus(order.shipmentState) : 'Not created',
      tone: 'neutral',
      meta: order.courierConsignmentId
        ? `Steadfast booking ${order.courierConsignmentId}`
        : 'No consignment has been booked, so no shipment exists to hold a state.',
    },
    {
      name: 'Payment',
      machine: 'SM-5',
      state: payment.label,
      tone: semanticRoleOf(PAYMENT_POSITION_ROLE, payment.state),
      meta: payment.title,
    },
    {
      name: 'Inventory',
      machine: 'SM-6',
      state: 'Not recorded',
      tone: 'neutral',
      meta: 'No reservation or movement is recorded. A shortage is a condition of the stock, never of the order (GAP-016).',
    },
    {
      name: 'Return',
      machine: 'SM-7',
      state: 'No return raised',
      tone: 'neutral',
      meta: 'Nothing is recorded against this order.',
    },
    {
      name: 'Exchange',
      machine: 'SM-8',
      state: 'No exchange raised',
      tone: 'neutral',
      meta: 'Nothing is recorded against this order.',
    },
  ];

  return (
    <div style={splitStyle}>
      <div style={columnStyle}>
        <Section title="Lifecycle" meta="Eight independent state machines · never merged">
          <div style={{ padding: '6px 22px 14px' }}>
            {lifecycle.map((row) => (
              <div key={row.machine} className="operational-row" style={lifecycleRowStyle}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)' }}>{row.machine}</div>
                </div>
                <span style={chipStyle(row.tone)}>{row.state}</span>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{row.meta}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Capture and confirmation" body>
          <FieldGrid
            fields={[
              { label: 'Capture channel', value: `${channel} · shop ${order.channelName ?? 'not recorded'}` },
              { label: 'Captured at', value: displayMoment(order.providerCreatedAt) },
              /*
                🔴 `BR-164` — `Confirmed By` IS NEVER DERIVED, AND ITS ABSENCE IS THE FACT.
                `BR-176` forbids the sync path writing it; no other path writes it either, so the
                honest value is that nothing recorded a confirmer.
              */
              { label: 'Confirmed by', value: 'Not recorded — no confirmer is held for this order', muted: true },
              { label: 'Confirmed at', value: 'Not recorded', muted: true },
              { label: `${channel} order id`, value: order.externalOrderId, mono: true },
              { label: 'Imported at', value: displayMoment(order.importedAt) },
            ]}
          />
        </Section>
      </div>

      <div style={columnStyle}>
        <AuthorityCard channel={channel} direct={direct} />

        <RailCard title="Order summary">
          <SummaryRow label="Goods total" value={displayMoney(order.price)} />
          <SummaryRow label="Delivery and handling" value={displayMoney(order.shippingFee)} />
          {/*
            🔴 UNKNOWN IS THE WORD, NEVER `0` (`INV-32.4`, `SYS-034`). A blank or a zero sums in a
            reader's head; the word cannot. `BR-007` — an order whose cost is unknown has a margin
            that is unknown, not zero.
          */}
          <SummaryRow label="Channel charges" value="Unknown" muted />
          <SummaryRow label="Cost of goods" value="Unknown" muted />
          <SummaryRow label="Received to date" value="Unknown" muted />
          {/* 🔴 `BR-067` — realised margin is not shown as settled before closure. */}
          <SummaryRow label="Realised margin" value="Not settled until closure" muted last />
        </RailCard>

        <RailCard title="Marketplace's own status">
          {direct ? (
            <p style={railTextStyle}>
              This is a direct-channel order. No marketplace holds a record of it, so there is no
              external status to show beside Trioloo's.
            </p>
          ) : (
            <>
              <span style={outlineChipStyle}>{channel}: {reported}</span>
              <p style={railTextStyle}>
                Last reported {displayMoment(order.lastSeenAt)}. This is the marketplace's fact about
                its own record and is held separately from the Trioloo lifecycle.
              </p>
            </>
          )}
        </RailCard>
      </div>
    </div>
  );
}

/**
 * `BR-174` — the authority, with the causing action, actor and time WHERE A TAKEOVER OCCURRED.
 *
 * <p>🔴 NO TAKEOVER RECORD EXISTS, so the card says so rather than inventing an actor and a
 * timestamp. ⚠ `BR-175` — the transition is ONE-WAY in V1, which is stated here because
 * `UX-184` requires the consequence to be legible BEFORE anyone acts, not after.
 */
function AuthorityCard({
  channel,
  direct,
}: {
  readonly channel: string;
  readonly direct: boolean;
}): React.JSX.Element {
  return (
    <RailCard title="Authority">
      <span style={neutralChipStyle}>
        {direct ? 'Trioloo owns this order' : `${channel} still updates this order`}
      </span>
      <p style={railTextStyle}>
        {direct
          ? `This order was captured in Trioloo and is ERP-managed from creation (BR-168). There is no marketplace to hold authority over it and no takeover occurs.`
          : `${channel} remains the source of the order's own record, and Trioloo holds the operational lifecycle beside it. No takeover is recorded against this order.`}
      </p>
      <div style={railDividerStyle} />
      <p style={{ ...railTextStyle, fontSize: '12.5px' }}>
        Editing the buyer snapshot or an address moves authority to Trioloo. In V1 that move is one
        way and cannot be undone (<code>BR-175</code>). No edit control is offered on this build.
      </p>
    </RailCard>
  );
}

/* ------------------------------------------------------------------- Items */

/**
 * `FRAME 03` — the lines, with the snapshots captured when each was created.
 *
 * <p>🔴 A LATER PRICE CHANGE NEVER REWRITES A RENDERED LINE (`BR-146`). Every figure here is the
 * stored snapshot, and nothing on this panel recomputes.
 *
 * <p>🔴 `INV-32.1` — the reference shown is a Sellable Product, never a Product Variant directly.
 * ⚠ NO LINE ON AN IMPORTED ORDER CARRIES ONE. The channel order item holds the marketplace's own
 * SKU and name and nothing else, so every line is NOT CATALOGUED and the order is ECONOMICALLY
 * INCOMPLETE (`INV-31.5`, `BR-007`) — which is exactly why cost and margin read Unknown here and
 * on the workspace card. `INV-32.4` — an unknown cost is never rendered as `0`.
 */
function Items({ order }: { readonly order: ChannelOrderDetail }): React.JSX.Element {
  return (
    <div style={columnStyle}>
      <div style={banner}>
        <span style={bannerMarkStyle} aria-hidden="true" />
        <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.55 }}>
          <strong>Economically incomplete.</strong> No line on this order carries a Sellable Product
          reference, so cost and margin cannot be computed for it. The lines are still sold and
          shipped, and the order is not defective.
        </div>
      </div>

      <Section title="Items" meta="Prices are the snapshots captured when each line was created">
        <div style={itemHeaderStyle}>
          <div>Line</div>
          <div style={right}>Qty</div>
          <div style={right}>Unit price snapshot</div>
          <div style={right}>Cost snapshot</div>
          <div style={right}>Line value</div>
        </div>
        {order.items.length === 0 ? (
          <div style={{ padding: '22px' }}>
            <EmptyState title="No item rows recorded" guidance="The order header was imported without item detail." />
          </div>
        ) : (
          order.items.map((item) => <ItemRow key={item.id} item={item} />)
        )}
        <div style={itemFooterStyle}>
          <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
            {order.items.length} line{order.items.length === 1 ? '' : 's'} · quantity not recorded
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
            <div style={right}>
              <div style={footerLabelStyle}>Goods total</div>
              <div className="tabular-nums" style={footerValueStyle}>{displayMoney(order.price)}</div>
            </div>
            <div style={right}>
              <div style={footerLabelStyle}>Margin</div>
              <div className="tabular-nums" style={{ ...footerValueStyle, color: 'var(--color-text-muted)' }}>Unknown</div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function ItemRow({ item }: { readonly item: ChannelOrderItemRow }): React.JSX.Element {
  return (
    <div className="operational-row" style={itemRowStyle}>
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', minWidth: 0 }}>
        <span style={itemThumbnailStyle} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {itemLabel(item)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
            SKU {item.shopSku || item.sku || 'not recorded'}
            {item.variation ? ` · ${item.variation}` : ''}
          </div>
          {/*
            ⚠ THE BADGE STATES WHAT IS HELD, NOT A JUDGEMENT. `Not catalogued` here means the line
            carries no Sellable Product reference — which is true of every imported line — and it
            is amber because it is the reason the order's economics are incomplete, not because
            anything is wrong with the sale.
          */}
          <span style={{ ...outlineChipStyle, ...warningChipStyle, marginTop: '6px' }}>Not catalogued</span>
        </div>
      </div>
      <div style={{ ...right, fontSize: '14px', color: 'var(--color-text-muted)' }}>Not recorded</div>
      <div className="tabular-nums" style={{ ...right, fontSize: '14px', color: 'var(--color-text-primary)' }}>
        {displayMoney(item.itemPrice)}
      </div>
      <div style={{ ...right, fontSize: '14px', color: 'var(--color-text-muted)' }}>Unknown</div>
      <div className="tabular-nums" style={{ ...right, fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {displayMoney(item.paidPrice)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Buyer */

/**
 * `FRAME 04` — the buyer as the ORDER recorded them.
 *
 * <p>🔴 `INV-31.7` — THE SNAPSHOT, NEVER A LIVE CUSTOMER LOOKUP. A renderer that re-read the
 * customer would show this year's address on last year's order.
 *
 * <p>🔴 `BR-169` / `UX-184` / `BR-082` — editing an address on a marketplace order moves authority
 * to Trioloo, that move is ONE-WAY in V1, and no control at all is offered after `COURIER_BOOKED`.
 * ⚠ No edit endpoint exists on this build, so the panel offers no control and says why.
 */
function Buyer({ order }: { readonly order: ChannelOrderDetail }): React.JSX.Element {
  const address = order.shippingAddress ?? order.billingAddress;
  return (
    <div style={splitStyle}>
      <Section
        title="Buyer snapshot"
        meta={`Taken ${displayMoment(order.providerCreatedAt)} · not a live customer lookup`}
        body
      >
        <FieldGrid
          fields={[
            { label: 'Name on the order', value: customerName(order) },
            { label: 'Phone', value: order.shippingPhone || address?.phone || 'Contact not recorded', muted: !order.shippingPhone && !address?.phone },
            { label: 'Alternate contact', value: address?.phone2 || 'Contact not recorded', muted: !address?.phone2 },
            { label: 'Customer type', value: 'Not recorded', muted: true },
            { label: 'Delivery address', value: addressValue(order.shippingAddress), full: true },
            { label: 'Credit terms', value: 'No credit terms recorded', muted: true },
            { label: 'Customer record', value: 'Not linked to a customer record', muted: true },
          ]}
        />
      </Section>
      <RailCard title="Editing this snapshot">
        <p style={{ ...railTextStyle, marginTop: 0, color: 'var(--color-text-primary)' }}>
          No edit control is offered. Changing an address or a contact is not built on this slice.
        </p>
        <div style={railDividerStyle} />
        <p style={railTextStyle}>
          Before courier booking, changing an address or contact on a marketplace order moves
          authority to Trioloo (<code>BR-169</code>). That move is one way in V1, and the consequence
          is stated before the change is made, never after (<code>UX-184</code>). After{' '}
          <code>COURIER_BOOKED</code> no control exists at all (<code>BR-082</code>).
        </p>
      </RailCard>
    </div>
  );
}

/* ----------------------------------------------------------------- Payment */

/**
 * `FRAME 05` — the payment position and what is owed.
 *
 * <p>🔴 NO `Mark reconciled` CONTROL (`GAP-019` residual — the transition mode is `UNDECIDED`),
 * no per-portion receivable or refund (`BR-160`), and no due receivable on an undelivered order
 * (`BR-033`).
 *
 * <p>⚠ AN ORDER MAY SIT `DELIVERED` FOR WEEKS AWAITING SETTLEMENT AND THAT IS CORRECT
 * (`OM §18.4`). 🔴 It is never presented as a backlog or an exception, which is what the footer
 * note exists to say.
 */
function Payment({
  order,
  canonical,
}: {
  readonly order: ChannelOrderDetail;
  readonly canonical: string | null;
}): React.JSX.Element {
  const payment = paymentPosition(canonical);
  return (
    <div style={splitStyle}>
      <Section
        title="Payment"
        badge={<span style={chipStyle(semanticRoleOf(PAYMENT_POSITION_ROLE, payment.state))}>{payment.label}</span>}
        body
        footer={
          <>
            {payment.title} An order may sit delivered for weeks awaiting channel settlement, and
            that is the normal course rather than a backlog.
          </>
        }
      >
        <FieldGrid
          fields={[
            { label: 'Collection mode', value: order.paymentMethod || 'Not recorded', muted: !order.paymentMethod },
            { label: 'Settlement', value: 'Not recorded — no settlement record exists', muted: true },
            { label: 'Order value', value: displayMoney(order.price) },
            { label: 'Received to date', value: 'Unknown', muted: true },
            { label: 'Outstanding', value: 'Unknown', muted: true },
            /* 🔴 `BR-067` — realised margin is not settled until closure. */
            { label: 'Realised margin', value: 'Not settled until the order closes', muted: true },
          ]}
        />
      </Section>
      <RailCard title="Receipts">
        <p style={{ ...railTextStyle, marginTop: 0 }}>
          No receipt is recorded against this order. Money held by a courier or a marketplace is not
          money received by Trioloo (<code>BR-035</code>), so a collection at the doorstep reaches
          Trioloo through channel settlement rather than as a counter payment.
        </p>
      </RailCard>
    </div>
  );
}

/* -------------------------------------------------------------- Fulfilment */

/**
 * `FRAME 06` — fulfilment, shipment and tracking.
 *
 * <p>🔴 NO SPLIT OR PARTIAL SHIPMENT AFFORDANCE (`BR-158`, `BR-159` — one order is one parcel per
 * attempt) and 🔴 NO COURIER SELECTION (`BR-076` — Steadfast only, auto-assigned).
 *
 * <p>⚠ THE PICKING FACTS ARE NOT HELD. The prototype shows a warehouse, a picker, a pick task and
 * a discrepancy; no such record exists, and `BR-155`'s distinction — a hold for a pick discrepancy
 * is correct, a hold for known unavailability is not — cannot be rendered from nothing. Each field
 * states its absence.
 */
function Fulfilment({ order }: { readonly order: ChannelOrderDetail }): React.JSX.Element {
  const booked = Boolean(order.courierConsignmentId);
  return (
    <div style={splitStyle}>
      <div style={columnStyle}>
        <Section
          title="Fulfilment"
          badge={<span style={neutralChipStyle}>Not recorded</span>}
          body
        >
          <FieldGrid
            fields={[
              { label: 'Warehouse', value: order.warehouseCode || 'Not recorded', muted: !order.warehouseCode },
              { label: 'Picker', value: 'Not recorded', muted: true },
              { label: 'Released to warehouse', value: 'Not recorded', muted: true },
              { label: 'Pick task', value: 'Not recorded', muted: true },
              {
                label: 'Pick discrepancies',
                value: 'No pick discrepancy is recorded. A shortage renders as visibility and never gates progression (OSC-038).',
                muted: true,
                full: true,
              },
            ]}
          />
        </Section>

        <Section
          title="Shipment"
          badge={
            <span style={neutralChipStyle}>
              {order.shipmentState ? displayStatus(order.shipmentState) : 'Not created'}
            </span>
          }
          body
        >
          <FieldGrid
            fields={[
              {
                label: 'Courier',
                value: booked ? 'Steadfast · assigned automatically' : 'Not booked',
                muted: !booked,
              },
              {
                label: 'Parcel',
                // 🔴 `BR-023` — an order holds at most ONE active shipment; one parcel per attempt.
                value: booked ? 'One parcel for this attempt' : 'No parcel exists',
                muted: !booked,
              },
              /* 🔴 `DB-013` — every external identifier names its ISSUING PARTY. */
              { label: 'Steadfast booking id', value: order.courierConsignmentId || 'Not booked', mono: booked, muted: !booked },
              { label: 'Steadfast tracking (AWB)', value: order.courierTrackingCode || 'Not issued', mono: Boolean(order.courierTrackingCode), muted: !order.courierTrackingCode },
              { label: 'Handover acknowledgement', value: 'Not recorded', muted: true },
              { label: 'Promised shipping', value: order.promisedShippingTimes || 'Not recorded', muted: !order.promisedShippingTimes },
              { label: 'Delivery info', value: order.deliveryInfo || 'Not recorded', muted: !order.deliveryInfo, full: true },
            ]}
          />
        </Section>

        <Section
          title="Tracking"
          meta={
            order.courierTrackingCode
              ? `Steadfast tracking (AWB) ${order.courierTrackingCode}`
              : 'No tracking code has been issued'
          }
        >
          <div style={{ padding: '22px' }}>
            {/*
              🔴 NO TRACKING EVENT STORE EXISTS. The prototype draws a connected timeline of
              courier scans; reproducing it would print delivery movements that never happened.
              `ORDER_MODULE_ROADMAP.md` Phase 3 blocks the `SM-4` status mapping on observing the
              provider's real vocabulary, and `BR-007` / `SYS-034` forbid coercing an unknown one.
            */}
            <EmptyState
              title="No tracking event is recorded"
              guidance="Courier tracking events are not imported on this build. An unknown courier status is never coerced into a Trioloo state (BR-007), and LOST is entered only on the courier's own confirmation (DLV-027)."
            />
          </div>
        </Section>
      </div>

      <RailCard title="Stock position">
        <SummaryRow label="Reserved" value="Not recorded" muted />
        <SummaryRow label="Deducted" value="Not recorded" muted />
        <SummaryRow label="Not catalogued" value={`${order.items.length} line${order.items.length === 1 ? '' : 's'}`} last />
        <p style={railTextStyle}>
          No line carries a Sellable Product reference, so no line has a stock effect. A shortage is
          a condition of the stock and never of the order (<code>GAP-016</code>).
        </p>
      </RailCard>
    </div>
  );
}

/* ------------------------------------------------------------- Marketplace */

/**
 * `FRAME 07` — the external facts, each with the party that issued it.
 *
 * <p>🔴 NO PUSH, RESEND OR RE-SYNC CONTROL. No outbound Orders behaviour is ratified, and
 * `BR-172` forbids anything that would let an external `Cancelled` re-cancel an `ERP_MANAGED`
 * order. ✅ `BR-173` — ERP authority NEVER deletes external history.
 */
function Marketplace({
  order,
  canonical,
  reported,
  channel,
  direct,
}: {
  readonly order: ChannelOrderDetail;
  readonly canonical: string | null;
  readonly reported: string;
  readonly channel: string;
  readonly direct: boolean;
}): React.JSX.Element {
  return (
    <div style={splitStyle}>
      <Section
        title="Marketplace reference"
        meta="External facts, each shown with the party that issued it"
        body
        footer={
          <>
            Trioloo sends nothing back to {channel} from this screen. External history is kept as it
            was received, whichever system holds authority (<code>BR-173</code>).
          </>
        }
      >
        <FieldGrid
          fields={[
            { label: 'Channel type', value: channel },
            /* 🔴 `BR-002` — the INSTANCE, because settlement arrives per shop. */
            { label: 'Channel instance', value: order.channelName ?? 'Shop not recorded', muted: !order.channelName },
            { label: `${channel} order id`, value: order.externalOrderId, mono: true },
            { label: `${channel} tracking`, value: order.trackingCode || 'Not recorded', mono: Boolean(order.trackingCode), muted: !order.trackingCode },
            { label: `${channel} PO`, value: order.purchaseOrderId || 'Not recorded', mono: Boolean(order.purchaseOrderId), muted: !order.purchaseOrderId },
            { label: `${channel} invoice number`, value: order.invoiceNumber || 'Not recorded', mono: Boolean(order.invoiceNumber), muted: !order.invoiceNumber },
            { label: 'Steadfast tracking (AWB)', value: order.courierTrackingCode || 'Not issued', mono: Boolean(order.courierTrackingCode), muted: !order.courierTrackingCode },
            { label: 'Imported at', value: displayMoment(order.importedAt) },
          ]}
        />
      </Section>
      <div style={columnStyle}>
        <RailCard title="Two statuses, two owners">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={ownerRowStyle}>
              <span style={ownerLabelStyle}>{direct ? 'No marketplace' : `${channel} says`}</span>
              <span style={outlineChipStyle}>{direct ? 'No external record' : reported}</span>
            </div>
            <div style={ownerRowStyle}>
              <span style={ownerLabelStyle}>Trioloo says</span>
              <span style={chipStyle(canonical ? semanticRoleOf(ORDER_LIFECYCLE_ROLE, canonical) : 'neutral')}>
                {canonical ? canonicalStatusLabel(canonical) : 'Status not translated'}
              </span>
            </div>
          </div>
          <p style={railTextStyle}>
            The two are separate records of separate systems. They may disagree without either being
            wrong (<code>BR-171</code>, <code>UX-182</code>).
          </p>
        </RailCard>
        <AuthorityCard channel={channel} direct={direct} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Activity */

/**
 * `FRAME 08` — a PROJECTION of the Activity Log, in operator language.
 *
 * <p>🔴 THE ACTIVITY LOG IS NOT BUILT, AND THIS PANEL SAYS SO RATHER THAN SIMULATING ONE.
 * `INV-34.1` makes the timeline a projection of that log and `INV-34.2` makes it complete by
 * construction — a timeline assembled here from whatever columns happened to be present would
 * satisfy neither, and would silently omit every act nobody thought to reconstruct.
 *
 * <p>✅ THE TWO ENTRIES BELOW ARE EVIDENCED BY STORED TIMESTAMPS on the order row itself, and each
 * names its machine, its actor and its reason. ⚠ No from-state is claimed where none is recorded:
 * `BR-058` requires from-state, to-state, actor, timestamp and reason, and inventing the first two
 * to complete the shape would be the fabrication the rule exists to prevent.
 *
 * <p>⚠ NO AGEING OR SLA MARKER (`GAP-024`). ✅ The Activity Log is not the Audit Log (`OM §15.2`).
 */
function Activity({
  order,
  canonical,
  reported,
  channel,
}: {
  readonly order: ChannelOrderDetail;
  readonly canonical: string | null;
  readonly reported: string;
  readonly channel: string;
}): React.JSX.Element {
  const direct = order.ownership === 'ERP_MANAGED';
  const entries: readonly ActivityEntry[] = [
    {
      act: direct ? 'Order captured in Trioloo' : `Order imported from ${channel}`,
      machine: 'SM-1 Order',
      transition: `From-state not recorded → ${canonical ? canonicalStatusLabel(canonical) : 'not translated'}`,
      actor: direct ? 'Trioloo, manual capture' : `System, ${channel} adapter`,
      at: displayMoment(order.importedAt),
      reason: direct
        ? 'Direct-channel capture. Creation is not confirmation (PRM-093.b).'
        : 'Scheduled channel import.',
    },
    ...(direct
      ? []
      : [
          {
            act: `${channel} last reported this order`,
            machine: `External, ${channel}`,
            transition: `Reported as ${reported}`,
            actor: channel,
            at: displayMoment(order.lastSeenAt),
            reason: 'External fact, recorded without altering the Trioloo state (BR-171, BR-173).',
          },
        ]),
  ];

  return (
    <Section title="Activity" meta="A projection of the activity log · one entry per act on this order">
      <div style={{ padding: '10px 22px 22px' }}>
        {entries.map((entry) => (
          <div key={entry.act} style={activityRowStyle}>
            <span style={activityDotStyle} aria-hidden="true" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={activityHeadStyle}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{entry.act}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{entry.at}</div>
              </div>
              <div style={activityMetaStyle}>{entry.machine} · {entry.transition} · {entry.actor}</div>
              <div style={activityMetaStyle}>{entry.reason}</div>
            </div>
          </div>
        ))}
        <p style={{ ...railTextStyle, marginBottom: 0 }}>
          These are the acts this build records. No Activity Log store exists yet, so the timeline
          cannot yet be complete by construction (<code>INV-34.1</code>, <code>INV-34.2</code>), and
          the missing entries are owed rather than reconstructed. ⚠ A bulk act would render one
          entry per order, never one for the batch (<code>AUD-028</code>).
        </p>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- Exceptions */

/**
 * `FRAME 09` — open exceptions and holds.
 *
 * <p>🔴 `OSC-038` — AN EXCEPTION IS SURFACED FOR VISIBILITY AND NEVER GATES PROGRESSION. The
 * discovery record states this nine times, and it is the rule an operations screen is most likely
 * to break by adding a well-meant block. Nothing on this panel blocks anything.
 *
 * <p>🔴 `BR-151` — HOLD DURATION, AGEING, SLA, AUTO-CANCELLATION AND AUTO-RELEASE ARE EACH
 * EXPLICITLY PROHIBITED, not merely omitted. No countdown, no "N days on hold", no expiry.
 */
function Exceptions(): React.JSX.Element {
  return (
    <div style={columnStyle}>
      <Section title="Open exceptions" meta="Surfaced for visibility · progression is never gated">
        <div style={{ padding: '22px' }}>
          <EmptyState
            title="No exception is recorded against this order"
            guidance="An exception carries its cause, the person who raised it, the time, and the authority required to close it. None is held for this order, and its absence never means one was cleared."
          />
        </div>
      </Section>
      <Section title="Holds">
        <div style={{ padding: '22px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
            No hold is placed on this order.
          </div>
          <p style={{ ...railTextStyle, marginBottom: 0 }}>
            A hold names the actor who placed it and its effect on the reservation. Holds do not
            expire, age or release themselves, and an order is never cancelled automatically
            (<code>BR-151</code>). Releasing a reserved quantity releases a SPECIFIED quantity only
            (<code>BR-152</code>).
          </p>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

type LifecycleRow = {
  readonly name: string;
  readonly machine: string;
  readonly state: string;
  readonly tone: SemanticTone;
  readonly meta: string;
};

type ActivityEntry = {
  readonly act: string;
  readonly machine: string;
  readonly transition: string;
  readonly actor: string;
  readonly at: string;
  readonly reason: string;
};

type FieldSpec = {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
  readonly muted?: boolean;
  readonly full?: boolean;
};

function Section({
  title,
  meta,
  badge,
  body,
  footer,
  children,
}: {
  readonly title: string;
  readonly meta?: string;
  readonly badge?: React.ReactNode;
  /** `body` wraps the children in the panel's own `22px` padding. */
  readonly body?: boolean;
  readonly footer?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section style={panelStyle}>
      <header style={panelHeaderStyle}>
        <h2 style={panelTitleStyle}>{title}</h2>
        {badge}
        {meta && <span style={panelMetaStyle}>{meta}</span>}
      </header>
      {body ? <div style={{ padding: '22px' }}>{children}</div> : children}
      {footer && <div style={panelFooterStyle}>{footer}</div>}
    </section>
  );
}

/** `RULE 3.18.g` — the two-column `1fr 1fr` reference composition at `18px 32px`. */
function FieldGrid({ fields }: { readonly fields: readonly FieldSpec[] }): React.JSX.Element {
  return (
    <div style={fieldGridStyle}>
      {fields.map((field) => (
        <div key={field.label} style={field.full ? { gridColumn: '1 / -1' } : undefined}>
          <div style={fieldLabelStyle}>{field.label}</div>
          <div
            className={field.mono ? undefined : 'tabular-nums'}
            style={{
              fontSize: field.mono ? '13px' : '14px',
              fontFamily: field.mono ? 'var(--font-family-mono)' : undefined,
              color: field.muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              lineHeight: 1.45,
            }}
          >
            {field.value}
          </div>
        </div>
      ))}
    </div>
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

function SummaryRow({
  label,
  value,
  muted,
  last,
}: {
  readonly label: string;
  readonly value: string;
  readonly muted?: boolean;
  readonly last?: boolean;
}): React.JSX.Element {
  return (
    <div style={{ ...summaryRowStyle, borderBottom: last ? 'none' : summaryRowStyle.borderBottom }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        className="tabular-nums"
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PrinterIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9V4h12v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 16h10v4H7z" />
    </svg>
  );
}

function addressValue(address: AddressView | null | undefined): string {
  const lines = addressLines(address).filter((line) => !/^\+/.test(line));
  return lines.length > 0 ? lines.join(', ') : 'Delivery address not recorded';
}

/* ------------------------------------------------------------------ styles */

/*
  🔴 `minmax(0, 1fr)` ON THE MAIN COLUMN, NOT `1fr`. A grid track's default `min-width: auto`
  refuses to shrink below its content, which is how a long identifier in a panel pushes the whole
  two-column layout wider than the page. `UX-265` forbids answering that with a scrollbar.
*/
const splitStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 372px',
  gap: 'var(--space-7)',
  alignItems: 'start',
};

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-7)',
  minWidth: 0,
};

const panelStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
};

const panelHeaderStyle: React.CSSProperties = {
  minHeight: '58px',
  padding: '0 22px',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  borderBottom: '1px solid var(--color-divider-inner)',
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '15.5px',
  fontWeight: 700,
  color: 'var(--color-heading-ink)',
};

const panelMetaStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  textAlign: 'right',
};

const panelFooterStyle: React.CSSProperties = {
  padding: '16px 22px',
  background: 'var(--color-strip)',
  borderTop: '1px solid var(--color-divider-light)',
  borderRadius: '0 0 var(--radius-panel) var(--radius-panel)',
  fontSize: '12.5px',
  lineHeight: 1.55,
  color: 'var(--color-text-muted)',
};

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  rowGap: '18px',
  columnGap: '32px',
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  marginBottom: 'var(--space-1)',
};

const lifecycleRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '172px 186px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 'var(--space-6)',
  padding: '13px 0',
  borderBottom: '1px solid var(--color-divider-light)',
};

function chipStyle(tone: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    width: 'fit-content',
    background: `var(--color-semantic-${tone}-bg)`,
    color: `var(--color-semantic-${tone}-fg)`,
    fontSize: '12px',
    fontWeight: 600,
    padding: '3px var(--space-3)',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

const neutralChipStyle: React.CSSProperties = chipStyle('neutral');

/*
  🔴 THE EXTERNAL CHIP IS AN OUTLINE, NEVER A SEMANTIC FILL (`UX-182`, `UX-185`). A filled chip
  states the ERP's own reading of a state; this one carries somebody else's word about their own
  record, and the two must never be mistakable for one class of fact.
*/
const outlineChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  border: '1px solid var(--color-border-card)',
  background: 'var(--color-surface)',
  color: 'var(--color-status-neutral-fg)',
  fontSize: '12px',
  fontWeight: 600,
  padding: '3px var(--space-3)',
  borderRadius: '999px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const warningChipStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--color-semantic-warning-bg)',
  color: 'var(--color-semantic-warning-fg)',
};

const railCardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  padding: 'var(--space-7)',
};

const railTitleStyle: React.CSSProperties = {
  margin: '0 0 var(--space-4)',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--color-heading-ink)',
};

const railTextStyle: React.CSSProperties = {
  margin: 'var(--space-4) 0 0',
  fontSize: '13px',
  lineHeight: 1.55,
  color: 'var(--color-text-muted)',
};

const railDividerStyle: React.CSSProperties = {
  height: '1px',
  background: 'var(--color-divider-light)',
  margin: 'var(--space-5) 0',
};

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  padding: '9px 0',
  borderBottom: '1px solid var(--color-divider-light)',
};

const ownerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
};

const ownerLabelStyle: React.CSSProperties = {
  fontSize: '12.5px',
  color: 'var(--color-text-muted)',
};

const banner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-4)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  padding: 'var(--space-5) 18px',
};

/*
  ⚠ AN OUTLINE MARK, NOT A FILLED DOT. `RULE 3.3.c` reserves the FILLED semantic treatments for
  states; this is a reading mark on an explanatory banner and takes the warning outline only.
*/
const bannerMarkStyle: React.CSSProperties = {
  flexShrink: 0,
  width: '13px',
  height: '13px',
  marginTop: '2px',
  borderRadius: '50%',
  border: '1.5px solid var(--color-semantic-warning-fg)',
};

const ITEM_COLUMNS = 'minmax(0, 1fr) 96px 132px 132px 132px';

const itemHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: ITEM_COLUMNS,
  gap: 'var(--space-6)',
  padding: 'var(--space-4) 22px',
  borderBottom: '1px solid var(--color-divider-light)',
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
};

const itemRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: ITEM_COLUMNS,
  gap: 'var(--space-6)',
  padding: 'var(--space-6) 22px',
  borderBottom: '1px solid var(--color-divider-light)',
  alignItems: 'center',
};

const itemThumbnailStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: 'var(--radius-card-small)',
  background: 'var(--color-divider-light)',
  flexShrink: 0,
};

const itemFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-8)',
  padding: 'var(--space-6) 22px',
  background: 'var(--color-strip)',
  borderRadius: '0 0 var(--radius-panel) var(--radius-panel)',
};

const footerLabelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
};

const footerValueStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
};

const right: React.CSSProperties = { textAlign: 'right' };

const activityRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-4)',
  padding: 'var(--space-4) 0',
  borderBottom: '1px solid var(--color-divider-light)',
};

const activityDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'var(--color-ink)',
  marginTop: 'var(--space-2)',
  flexShrink: 0,
};

const activityHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 'var(--space-6)',
};

const activityMetaStyle: React.CSSProperties = {
  fontSize: '12.5px',
  color: 'var(--color-text-muted)',
  marginTop: '3px',
};

const crumbLinkStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  textDecoration: 'underline',
};

const reasonStyle: React.CSSProperties = {
  margin: '0 0 var(--space-6)',
  fontSize: '12px',
  lineHeight: 1.6,
  color: 'var(--color-text-muted)',
};
