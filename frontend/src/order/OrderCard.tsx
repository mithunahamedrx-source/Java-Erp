import { Link, useNavigate } from 'react-router-dom';
import type { ChannelOrderRow } from './orderApi';
import { ActionMenu } from '../ui/Overlay';
import type { MenuAction } from '../ui/Overlay';
import { ORDER_LIFECYCLE_ROLE, PAYMENT_POSITION_ROLE, semanticRoleOf } from '../design/semanticRole';
import {
  canonicalStatus,
  canonicalStatusLabel,
  customerName,
  displayMoment,
  displayMoney,
  paymentPosition,
  primaryStatus,
} from './orderView';

/**
 * FRAME 01 — the Orders card.
 *
 * <p>🔴 BUILT FROM THE `Order Module` PROTOTYPE (`design-reference/Order module prototype/`).
 * Its composition, geometry and typography are transcribed, not designed: the three-band card
 * (identity header · line, centred economics and actions · document strip), every size, weight,
 * radius and gap.
 *
 * <p>✅ EVERY COLOUR RESOLVED TO AN EXISTING CANONICAL TOKEN. The prototype was authored from the
 * same token matrix, so `RULE 15.1`'s prohibition on eye-matched colours and hex substitutes cost
 * nothing to honour — each `oklch(…)` in the source is a token this file names instead
 * (`OSC-041`). ⚠ TWO exceptions are recorded at `primaryLabelStyle` and `invoiceStyle` below.
 *
 * <p>🔴 WHERE THE PROTOTYPE SHOWS A FIGURE THE SYSTEM DOES NOT HOLD, THE FIGURE IS NOT DRAWN.
 * The prototype is populated with sample data, and the brief it was built from says so outright:
 * *"Any number you invent is a VISUAL PATTERN, not a business fact. I will keep your composition
 * and discard your figures"* (`ORDER_MODULE_PAGE_CONTRACT.md` §7.1). Cost, Charges, Received and
 * Margin are all UNKNOWN for an imported order, and `INV-32.4` / `BR-007` / `SYS-034` require
 * unknown to render as unknown — never as `৳0`. `E-032` records the exact defect this prevents.
 *
 * <p>🔴 THE `Not Released` CHIP IS NOT RENDERED. `BR-080` WITHDREW `NOT_RELEASED` outright — *"the
 * state is not to be implemented"*. The slot carries the `SM-5` PAYMENT POSITION instead
 * (`OSC-056.e`), which is a real fact this order holds and the one an operator reads a card to find.
 *
 * <p>🔴 THE AUTHORITY CHIP IS NOT ON THE CARD, BY THE OWNER'S DECISION (`OSC-056.d`). `UX-183`
 * requires the authority to be legible in business language and `BR-174`'s actor and timestamp to
 * be *"visible on inspection"* — INSPECTION, which is `FRAME 02`. `OrderDetailPage.tsx` carries it
 * on both its Overview and its Marketplace panel, so the fact is not lost, only moved off a list
 * card where every imported order reads the same.
 */
export default function OrderCard({
  order,
  selected,
  onSelectedChange,
}: {
  readonly order: ChannelOrderRow;
  readonly selected: boolean;
  readonly onSelectedChange: (selected: boolean) => void;
}): React.JSX.Element {
  const navigate = useNavigate();

  /*
    🔴 TWO STATUSES, TWO OWNERS, NEVER MERGED (`BR-171`, `UX-182`, `OSC-036`). The header chip
    carries the canonical lifecycle reading; the marketplace's own word rides beside the shop name.
  */
  const canonical = canonicalStatus(order.canonicalStatuses);
  const reported = primaryStatus(order.statuses);
  const role = canonical ? semanticRoleOf(ORDER_LIFECYCLE_ROLE, canonical) : 'neutral';
  const payment = paymentPosition(canonical);
  const paymentRole = semanticRoleOf(PAYMENT_POSITION_ROLE, payment.state);

  return (
    <article style={cardStyle} data-testid="order-card">
      {/* ── Band 1 — identity, time, origin, state ─────────────────────── */}
      <div className="operational-row" style={headerStyle}>
        {/*
          🔴 The accessible name carries the CUSTOMER, not "row 3". A screen-reader user choosing
          between fourteen checkboxes named "Select order" has been told nothing.
        */}
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
          style={checkboxStyle}
          data-testid="order-select"
          aria-label={`Select order ${order.triolooInvoiceNumber ?? order.externalOrderId} for ${customerName(order)}`}
        />
        <span style={avatarStyle} aria-hidden="true">
          <PersonIcon />
        </span>

        {/*
          🔴 THE IDENTITY RUN — CUSTOMER, CONTACT, TIME, THEN THE MARKETPLACE'S OWN CLUSTER.
          `BR-002` — channel type is never sufficient attribution, so the INSTANCE is named.
          `UX-185` requires an externally-authoritative fact to be VISIBLY EXTERNAL, and here that
          is carried by GROUPING rather than by a prefix word: the chip sits inside the marketplace's
          own identity, between the shop that reported it and the id that shop gave it.
          `UX-182` — the two statuses are never MERGED into one chip, and they are not: this one is
          outlined, the ERP's is filled and semantic, and they never touch.
        */}
        <div style={identityRunStyle}>
          <Link to={`/sales/orders/${order.id}`} style={customerLinkStyle}>
            {customerName(order)}
          </Link>
          {/* ⚠ An absent contact says so. It never renders as an empty gap (`BR-134`). */}
          <span className="tabular-nums" style={metaStyle}>
            {order.shippingPhone || 'Contact not recorded'}
          </span>
          <span style={metaStyle}>{displayMoment(order.providerCreatedAt, true)}</span>
          <span style={metaStyle}>{order.channelName ?? 'Shop not recorded'}</span>
          <span style={externalIdStyle}>{order.externalOrderId}</span>
          <span
            style={externalChipStyle}
            title="The marketplace's own status for this order, as it reported it (BR-171)."
          >
            {reported}
          </span>
        </div>

        <span style={chipStyle(role)}>
          {canonical ? canonicalStatusLabel(canonical) : 'Status not translated'}
        </span>
        {/*
          🔴 NOT the prototype's `Not Released` chip — `BR-080` withdrew that state. This slot
          carries the `SM-5` PAYMENT POSITION, derived only where `SM-5` itself makes the
          derivation automatic. See `paymentPosition` for why nothing past `DUE` is ever claimed.
        */}
        <span style={chipStyle(paymentRole)} title={payment.title}>{payment.label}</span>
        <span style={{ ...metaStyle, flexShrink: 0 }}>{order.paymentMethod || 'Payment not recorded'}</span>
        <Divider height={20} />
        {/*
          🔴 THE TRIOLOO INVOICE NUMBER — top right, after the payment-method divider, bold
          (`OSC-057.b`). `PRN-013` / `INV-39.1`: ONE sequence, never reused, and once issued never
          regenerated, which `V19` enforces with a table trigger rather than trusting the
          application.

          ⚠ THE `order_number` COLUMN IS DELIBERATELY NOT SHOWN HERE. It holds a COPY of Daraz's
          own id on all 158 production rows, so rendering it would print the marketplace's number
          twice and dress the second copy as a Trioloo reference (`PRN-014`).
        */}
        <span style={invoiceNumberStyle} data-testid="order-invoice-number">
          {order.triolooInvoiceNumber ? `INV: ${order.triolooInvoiceNumber}` : 'INVOICE NOT ISSUED'}
        </span>
      </div>

      {/* ── Band 2 — the line, its economics, its actions ───────────────── */}
      <div className="operational-row" style={bodyStyle}>
        <span style={thumbnailStyle} aria-hidden="true" />
        <div style={lineBlockStyle}>
          <div style={productNameStyle}>
            {order.itemName || 'Item name not recorded'}{' '}
            <span style={qtyStyle}>· {order.itemsCount ?? 0} item{order.itemsCount === 1 ? '' : 's'}</span>
          </div>
          {/*
            🔴 EVERY EXTERNAL IDENTIFIER NAMES THE PARTY THAT ISSUED IT (`DB-013`, and `OSC-030`'s
            required data says so outright — *external references with their issuing party*). Once
            a courier exists the omission stops being cosmetic: `Tracking` was Daraz's code, the
            shipment now carries STEADFAST's, and two parties may legitimately issue the same
            string. An operator who cannot tell whose number they are reading cannot tell who to
            ask about the parcel.

            ⚠ `purchase_order_id` is what Daraz publishes; it is NOT relabelled "Parcel" because
            `DZC-047.c` names a separate `package_id` this slice does not import (`UX-271.a`).
          */}
          <div style={subLineStyle}>
            Daraz PO <span style={monoStyle}>{order.purchaseOrderId || 'not recorded'}</span>
            {' · '}
            Daraz tracking <span style={monoStyle}>{order.trackingCode || 'not recorded'}</span>
          </div>
          {/*
            ✅ THE BOOKING, WHEN ONE EXISTS (product owner, 2026-08-24). 🔴 An order with no
            consignment says so rather than rendering a blank: `BR-134` — absent is not empty, and
            `FRAME 06` requires the shipment state or an explicit "not created".
          */}
          <div style={subLineStyle} data-testid="order-courier-line">
            {order.courierConsignmentId ? (
              <>
                Steadfast booking{' '}
                <span style={{ ...monoStyle, color: 'var(--color-text-primary)', fontWeight: 700 }}>
                  {order.courierConsignmentId}
                </span>
                {order.courierTrackingCode ? (
                  <>
                    {' · '}Steadfast tracking <span style={monoStyle}>{order.courierTrackingCode}</span>
                  </>
                ) : null}
              </>
            ) : (
              'Courier not booked'
            )}
          </div>
        </div>

        {/*
          ⚠ THE FIVE ECONOMIC FIGURES ARE ONE BLOCK, CENTRED IN THE SPACE THE LINE AND THE ACTIONS
          LEAVE. 🔴 A figure adjacent to a button reads as that button's subject, and `§3.15`'s
          hierarchy is DEMOTED-then-PRIMARY across ONE run — not two groups separated by the width
          of the card. The centring is done by a `flex: 1` carrier rather than by an auto margin on
          half the figures, which is what previously split the run in two.
        */}
        <div style={economicsCarrierStyle}>
          <div style={economicsStyle} data-testid="order-economics">
            {/*
              🔴 THE DEMOTED FIGURES. Sale is real — it is what the marketplace reported. Cost and
              Charges are NOT held for an imported order, and `INV-32.4` requires an unknown cost to
              render UNKNOWN rather than zero. The prototype's figures are sample data, not facts.
            */}
            <div style={demotedGroupStyle}>
              <Demoted label="Sale" value={displayMoney(order.price)} />
              <Demoted label="Cost" value="Unknown" />
              <Demoted label="Charges" value="Unknown" />
            </div>

            {/*
              🔴 RECEIVED AND MARGIN ARE UNKNOWN, AND THAT IS THE POINT OF THIS CARD.
              `BR-033` — the obligation follows DELIVERED goods; no receipt, remittance or settlement
              record exists in this slice, so nothing has been received.
              `BR-007` — an order whose cost is unknown has a margin that is UNKNOWN, not zero, and
              `SYS-034` forbids summing unknowns as zeros.
            */}
            <div style={primaryGroupStyle}>
              <Primary label="Received" value="Unknown" />
              <Primary label="Margin" value="Unknown" />
            </div>
          </div>
        </div>

        <div style={actionsStyle}>
          <Link to={`/sales/orders/${order.id}`} style={buttonStyle}>
            View
          </Link>
          {/*
            ⚠ `More Actions` CARRIES THE PROTOTYPE'S ITEM LIST, AND THE ITEMS THAT WOULD CHANGE THE
            ORDER ARE OFFERED DIMMED WITH THEIR REASON. `OSC-056.f` requires the control; `PRM-025`
            requires each record authorised individually; `GAP-034` records that NO permitted-action
            inventory exists yet; and the Steadfast booking itself is `ORDER_MODULE_ROADMAP.md`
            Phase 2 — NEXT, not built.

            🔴 THE MENU DOES NOT PRETEND. The prototype's mutating items post a message saying the
            act was recorded; nothing here is recorded, so nothing here says it was. A dimmed item
            with its precondition named is the presentation `ActionMenu` already fixes for exactly
            this case, and it keeps the composition the prototype drew.
          */}
          <ActionMenu
            label="More Actions"
            menuWidth="264px"
            testId="order-actions-menu"
            triggerTestId="order-more-actions"
            actions={moreActions(order, canonical, navigate)}
          />
        </div>
      </div>

      {/* ── Band 3 — document, destination, note ────────────────────────── */}
      <div className="operational-row" style={stripStyle}>
        {/*
          ⚠ THE INVOICE NUMBER IS NOT PRINTED HERE. The owner's decision (`OSC-056.g`) is that this
          element is the PRINTABLE INVOICE action, and an action does not caption itself with the
          identifier of the document it would produce. 🔴 The number is not lost — it is on band 1
          as a fact of the order, which is where an identifier belongs.
        */}
        <Link to={`/sales/orders/${order.id}/invoice`} state={{ from: 'list' }} style={invoiceStyle} data-testid="order-invoice-action">
          <DownloadIcon />
          INVOICE
        </Link>
        <span style={addressStyle}>
          <PinIcon />
          {order.shippingLine || 'Delivery address not recorded'}
        </span>
        <div style={noteCarrierStyle}>
          <Divider height={14} />
          <span style={noteStyle}>
            Note: <span style={noteValueStyle}>{order.buyerNote || 'none'}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------------------- actions */

/**
 * The row menu, item for item as the prototype draws it.
 *
 * <p>🔴 NAVIGATION IS REAL; MUTATION IS DIMMED. `Open order`, `Print invoice`, `View activity`
 * and `Open shipment` all reach surfaces this application holds, so they are offered. Every item
 * that would CHANGE the order is dimmed with the precondition that is not met, because none of
 * them has a ratified permitted-action inventory (`GAP-034`), a transition endpoint, or — for the
 * courier booking — a built provider path (`ORDER_MODULE_ROADMAP.md` Phase 2).
 *
 * <p>⚠ THE ITEMS STILL DEPEND ON THE ORDER'S STATE, exactly as the prototype's do. `Amend`,
 * `Release to warehouse` and `Cancel order` appear ONLY pre-dispatch — `BR-011` makes `Cancel`
 * ABSENT rather than disabled after dispatch, which is a different thing from the dimming above
 * and is honoured by omitting the item entirely.
 */
function moreActions(
  order: ChannelOrderRow,
  canonical: string | null,
  navigate: ReturnType<typeof useNavigate>,
): readonly MenuAction[] {
  const preDispatch = PRE_DISPATCH.has(canonical ?? '');
  const booked = Boolean(order.courierConsignmentId);
  const items: MenuAction[] = [
    {
      label: 'Open order',
      description: 'The full record and its eight lifecycles',
      onSelect: () => navigate(`/sales/orders/${order.id}`),
    },
    {
      label: 'Print invoice',
      description: `Opens the invoice snapshot for ${order.triolooInvoiceNumber ?? 'this order'}`,
      onSelect: () => navigate(`/sales/orders/${order.id}/invoice`, { state: { from: 'list' } }),
    },
    {
      label: 'View activity',
      description: 'From-state, to-state, actor and reason',
      onSelect: () => navigate(`/sales/orders/${order.id}?panel=Activity`),
    },
  ];
  if (booked) {
    items.push({
      label: 'Open shipment',
      description: 'Courier record and tracking events',
      onSelect: () => navigate(`/sales/orders/${order.id}?panel=Fulfilment`),
    });
  }

  if (preDispatch) {
    items.push({
      label: 'Amend order',
      description: 'Permitted before dispatch only',
      separatorBefore: true,
      disabled: true,
      reason: 'No amendment endpoint exists. OM §7.9 permits it pre-dispatch; nothing implements it yet.',
      onSelect: () => undefined,
    });
    items.push({
      label: 'Release to warehouse',
      description: 'Manual and permissioned',
      disabled: true,
      reason: 'BR-081 makes release a manual permissioned act. No transition endpoint is built.',
      onSelect: () => undefined,
    });
  }

  items.push({
    label: 'Send to Steadfast',
    description: booked
      ? `Already booked as ${order.courierConsignmentId} · resending is refused`
      : 'Books the courier for this order · Steadfast is the only courier and is assigned for you',
    separatorBefore: !preDispatch,
    disabled: true,
    reason: booked
      ? 'BR-023 allows one active shipment per order, so a second booking is refused.'
      : 'Courier booking is ORDER_MODULE_ROADMAP Phase 2 and is not built. A booking is real, costs money and dispatches a rider.',
    onSelect: () => undefined,
  });
  items.push({
    label: 'Place hold',
    description: 'Names you as the actor; holds never expire on their own',
    disabled: true,
    reason: 'No hold endpoint exists. BR-151 prohibits hold ageing, expiry and auto-release.',
    onSelect: () => undefined,
  });

  /*
    🔴 `BR-011` — `Cancel` IS ABSENT AFTER DISPATCH, NOT DISABLED. A dimmed item still advertises
    an operation; the rule is that the operation does not exist on a dispatched order.
  */
  if (preDispatch) {
    items.push({
      label: 'Cancel order',
      description: 'Pre-dispatch only',
      separatorBefore: true,
      destructive: true,
      disabled: true,
      reason: 'No cancellation endpoint exists. PRM-025 requires per-record authority before one is offered.',
      onSelect: () => undefined,
    });
  }
  return items;
}

/** The `SM-1` states `BR-011` treats as pre-dispatch. */
const PRE_DISPATCH: ReadonlySet<string> = new Set([
  'PENDING_VERIFICATION',
  'CONFIRMED',
  'RELEASED',
  'IN_FULFILLMENT',
  'READY_TO_SHIP',
  'COURIER_BOOKED',
]);

/* ------------------------------------------------------------------ pieces */

function Demoted({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
  return (
    <div>
      <div style={demotedLabelStyle}>{label}</div>
      <div className="tabular-nums" style={demotedValueStyle}>
        {value}
      </div>
    </div>
  );
}

function Primary({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
  return (
    <div>
      <div style={primaryLabelStyle}>{label}</div>
      {/*
        ⚠ The prototype paints a KNOWN margin with the positive token and an unknown one muted. Here
        the margin is always unknown, so it is never painted: `--color-positive` states a gain, and
        an UNKNOWN margin has not been shown to be one (`RULE 3.14.a.a` — a value takes the role its
        meaning deserves, never the one it resembles).
      */}
      <div className="tabular-nums" style={primaryValueStyle}>
        {value}
      </div>
    </div>
  );
}

function Divider({ height }: { readonly height: number }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{ width: '1px', height: `${height}px`, background: 'var(--color-divider-vertical)', flexShrink: 0 }}
    />
  );
}

function PersonIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-stroke-nav)"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="9" r="3.2" />
      <path d="M5.5 20c1.4-2.7 3.8-4 6.5-4s5.1 1.3 6.5 4" />
    </svg>
  );
}

function DownloadIcon(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 4v10" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function PinIcon(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-stroke-nav)"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ styles */

/*
  ⚠ NO `overflow: hidden`, AND THAT IS DELIBERATE. The band-2 row menu is anchored inside this
  card; a clipping card would cut the menu off at the card's own edge. The three bands already
  carry the corner radii they need.
*/
const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
};

/*
  🔴 `RULE 7.4` / `UX-266` — every band of this card is a structured operational row and does not
  wrap. `.operational-row` carries the `flex-wrap: nowrap !important` safety net, and each band
  sets `minWidth: 0` so a long name ellipsises instead of forcing the row wider.
*/
const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: '10px var(--space-6)',
  borderBottom: '1px solid var(--color-divider-light)',
  minWidth: 0,
};

/*
  ⚠ SIZED IN `px` AND NOT TOKENISED, DELIBERATELY. `DESIGN_CONSTITUTION.md` carries no control-size
  token for a checkbox and `UX-260` forbids inventing a component specification. `accentColor`
  paints the native control with the canonical ink rather than the browser's blue.
*/
const checkboxStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  margin: 0,
  accentColor: 'var(--color-ink)',
  cursor: 'pointer',
  flexShrink: 0,
};

const avatarStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  background: 'var(--color-divider-light)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

/*
  The identity run takes the slack, so the state cluster to its right stays pinned and every card
  in the list aligns on it regardless of how long a customer name or a shop name runs.
*/
const identityRunStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minWidth: 0,
  overflow: 'hidden',
  flex: 1,
};

const customerLinkStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '14px',
  color: 'var(--color-text-primary)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const metaStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '12.5px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const externalIdStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: '13px',
  color: 'var(--color-text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: '11.5px',
};

function chipStyle(tone: string): React.CSSProperties {
  return {
    display: 'inline-flex',
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

/*
  🔴 THE MARKETPLACE'S CHIP IS DELIBERATELY NOT A SEMANTIC CHIP. `chipStyle` paints a filled
  `--color-semantic-*` pair and states the ERP's own reading; this one is an OUTLINE in muted ink,
  so the two can never be mistaken for the same class of fact (`UX-182` — never merged) and the
  external one stays visibly external (`UX-185`).

  ⚠ The word is printed as the marketplace spelled it. It is NOT title-cased, mapped or tidied:
  `BR-171` keeps it an external fact, and `BR-005` puts vocabulary translation in the adapter,
  which has already produced the canonical chip beside it.
*/
const externalChipStyle: React.CSSProperties = {
  display: 'inline-flex',
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

/*
  ⚠ UPPER-CASE BY `textTransform`, NOT BY UPPER-CASING THE DATA. The stored number is `TR0001` and
  stays that way; a surface that capitalised the VALUE would make the displayed text differ from
  the one a person types into search.
*/
const invoiceNumberStyle: React.CSSProperties = {
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-family-mono)',
  fontSize: '13px',
  fontWeight: 700,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: 'var(--space-4) var(--space-6)',
  minWidth: 0,
};

const thumbnailStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-divider-light)',
  flexShrink: 0,
};

const lineBlockStyle: React.CSSProperties = {
  minWidth: '200px',
  maxWidth: '320px',
};

const productNameStyle: React.CSSProperties = {
  fontSize: '13.5px',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const qtyStyle: React.CSSProperties = {
  fontSize: '13.5px',
  fontWeight: 400,
  color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
};

const subLineStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--color-text-demoted)',
  marginTop: '2px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/*
  ⚠ THE CARRIER TAKES THE SLACK; THE RUN ITSELF STAYS INTACT. Centring by `justifyContent` on a
  `flex: 1` carrier keeps the five figures as ONE block — the earlier defect was an auto margin on
  half of them, which pushed `Received`/`Margin` against the buttons and split the run in two.
*/
const economicsCarrierStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  minWidth: 0,
};

const economicsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexShrink: 0,
  minWidth: 'max-content',
};

const demotedGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  paddingRight: 'var(--space-4)',
  borderRight: '1px solid var(--color-border-card)',
  flexShrink: 0,
  minWidth: 'max-content',
};

const demotedLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  color: 'var(--color-text-demoted)',
};

const demotedValueStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
};

const primaryGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-8)',
  paddingLeft: '2px',
  flexShrink: 0,
};

/*
  ⚠ THE ONE PLACE THE PROTOTYPE CARRIES A VALUE NO TOKEN HOLDS. Its Received/Margin labels are
  `oklch(0.55 0.015 290)`; the nearest ratified token is `--color-text-muted` at `oklch(0.5 …)`.
  `RULE 15.1` forbids hard-coding the substitute, so the TOKEN is used and the one-step difference
  is recorded here rather than smuggled in as a literal.
*/
const primaryLabelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
};

const primaryValueStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
};

/*
  ⚠ THE `36px` RIGHT MARGIN IS THE PROTOTYPE'S, AND IT IS NOT A SPACING TOKEN. It reserves the
  gutter the anchored row menu opens into, so the menu does not sit flush against the card edge.
  `RULE 15.1` governs COLOUR; a layout offset the prototype fixes is transcribed as it stands.
*/
const actionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  marginRight: '36px',
};

const buttonStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-secondary-button)',
  color: 'var(--color-secondary-text)',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  height: 'var(--control-height-row-action)',
  padding: '0 var(--space-5)',
  borderRadius: 'var(--radius-control)',
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
};

const stripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  padding: '7px var(--space-6)',
  borderTop: '1px solid var(--color-divider-light)',
  background: 'var(--color-strip)',
  borderRadius: '0 0 var(--radius-panel) var(--radius-panel)',
  minWidth: 0,
};

/*
  ⚠ THE SECOND RECORDED TOKEN SUBSTITUTION. The prototype's INVOICE action is
  `oklch(0.42 0.14 250)`, which is exactly `--color-status-dispatched-fg`. No ACTION token holds
  that value — `--color-link` is ink and `--color-link-hover` is violet — so the token whose value
  matches is named rather than the literal being hard-coded (`RULE 15.1`). ⚠ Recorded as owed: the
  token's NAME says status and its use here is an action.
*/
const invoiceStyle: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'var(--color-status-dispatched-fg)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexShrink: 0,
  textDecoration: 'none',
};

const addressStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const noteCarrierStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-5)',
  minWidth: 0,
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-demoted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const noteValueStyle: React.CSSProperties = {
  color: 'var(--color-text-demoted)',
};
