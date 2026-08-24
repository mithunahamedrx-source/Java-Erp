import { Link } from 'react-router-dom';
import type { ChannelOrderRow } from './orderApi';
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
 * <p>🔴 BUILT FROM THE APPROVED `Order Card DS` DESIGN. Its composition, geometry and typography
 * are transcribed, not designed: the three-band card (identity header · line and economics ·
 * document strip), every size, weight, radius and gap.
 *
 * <p>✅ EVERY COLOUR RESOLVED TO AN EXISTING CANONICAL TOKEN. The design was authored from the
 * same token matrix, so `RULE 15.1`'s prohibition on eye-matched colours and hex substitutes cost
 * nothing to honour — each `oklch(…)` in the source is a token this file names instead
 * (`OSC-041`). ⚠ ONE exception is recorded at `RECEIVED_LABEL` below.
 *
 * <p>🔴 WHERE THE DESIGN SHOWS A FIGURE THE SYSTEM DOES NOT HOLD, THE FIGURE IS NOT DRAWN. The
 * mock is populated with sample data; a mock's sample values are not evidence of a business fact
 * (`design-reference/README.md`). Cost, Charges, Received and Margin are all UNKNOWN for an
 * imported order, and `INV-32.4` / `BR-007` / `SYS-034` require unknown to render as unknown —
 * never as `৳0`. `E-032` records the exact defect this prevents: a line that showed `Margin ৳0`
 * when the margin was in fact unknown.
 *
 * <p>🔴 THE `Not Released` CHIP IS NOT RENDERED. `BR-080` WITHDREW `NOT_RELEASED` outright — *"the
 * state is not to be implemented"* — so the design's second chip is a visual pattern to keep and a
 * business claim to discard. The slot carries the `SM-5` PAYMENT POSITION instead (`OSC-056.e`),
 * which is a real fact this order holds and the one an operator reads a card to find.
 *
 * <p>🔴 THE AUTHORITY CHIP IS NOT ON THE CARD, BY THE OWNER'S DECISION (`OSC-056.d`). `UX-183`
 * requires the authority to be legible in business language and `BR-174`'s actor and timestamp to
 * be *"visible on inspection"* — INSPECTION, which is `FRAME 02`. `OrderDetailPage.tsx` carries it
 * in both its header badge and its fact list, so the fact is not lost, only moved off a list card
 * where every imported order reads the same.
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
          ⚠ THE CHECKBOX SELECTS; IT DOES NOT PROMISE A BULK ACTION. `PRM-025` requires every
          record to be authorised individually with per-record results (`SYS-073`), and `GAP-034`
          records that NO permitted-bulk-transition inventory exists — so no bulk bar is drawn
          and none is implied. Selection is a reading aid until the owner ratifies what may be
          done to a set (`OSC-057.c`).

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
        <Link to={`/sales/orders/${order.id}`} style={customerLinkStyle}>
          {customerName(order)}
        </Link>
        {/* ⚠ An absent contact says so. It never renders as an empty gap. */}
        <span className="tabular-nums" style={metaStyle}>
          · {order.shippingPhone || 'Contact not recorded'}
        </span>
        <span style={{ ...metaStyle, color: 'var(--color-text-demoted)', marginLeft: 'var(--space-6)' }}>
          {displayMoment(order.providerCreatedAt, true)}
        </span>
        {/*
          🔴 THE EXTERNAL CLUSTER — SHOP, THE MARKETPLACE'S OWN ORDER ID, THE MARKETPLACE'S OWN WORD.
          `BR-002` — channel type is never sufficient attribution, so the INSTANCE is named.
          `UX-185` requires an externally-authoritative fact to be VISIBLY EXTERNAL, and here that
          is carried by GROUPING rather than by a prefix word: the chip sits inside the marketplace's
          own identity, between the shop that reported it and the id that shop gave it.
          `UX-182` — the two statuses are never MERGED into one chip, and they are not: this one is
          outlined and lower-case, the ERP's is filled and semantic, and they never touch.
        */}
        <span style={{ ...metaStyle, marginLeft: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {order.channelName ?? 'Shop not recorded'} ·{' '}
          <span style={monoStyle}>{order.externalOrderId}</span>
          <span style={externalChipStyle} title="The marketplace's own status for this order, as it reported it (BR-171).">
            {reported}
          </span>
        </span>

        <div style={headerRightStyle}>
          <span style={chipStyle(role)}>
            {canonical ? canonicalStatusLabel(canonical) : 'Status not translated'}
          </span>
          {/*
            🔴 NOT the design's `Not Released` chip — `BR-080` withdrew that state. This slot
            carries the `SM-5` PAYMENT POSITION, derived only where `SM-5` itself makes the
            derivation automatic. See `paymentPosition` for why nothing past `DUE` is ever claimed.
          */}
          <span style={chipStyle(paymentRole)} title={payment.title}>{payment.label}</span>
          <Divider height={16} />
          <span style={metaStyle}>{order.paymentMethod || 'Payment not recorded'}</span>
          <Divider height={16} />
          {/*
            🔴 THE TRIOLOO INVOICE NUMBER — top right, after the payment-method divider, bold and
            upper-case (`OSC-057.b`). `PRN-013` / `INV-39.1`: ONE sequence, never reused, and once
            issued never regenerated, which `V19` enforces with a table trigger rather than trusting
            the application.

            ⚠ THE `order_number` COLUMN IS DELIBERATELY NOT SHOWN HERE. It holds a COPY of Daraz's
            own id on all 158 production rows — `order_number = external_order_id` for every one —
            so rendering it would print the marketplace's number twice and dress the second copy as
            a Trioloo reference. This is the first Trioloo-issued human-facing number the order has
            ever had (`PRN-014`).

            ⚠ An unissued number says so rather than showing a blank (`BR-134`, `SYS-034`).
          */}
          <span style={invoiceNumberStyle} data-testid="order-invoice-number">
            {order.triolooInvoiceNumber ? `INV: ${order.triolooInvoiceNumber}` : 'INVOICE NOT ISSUED'}
          </span>
        </div>
      </div>

      {/* ── Band 2 — the line, its economics, its actions ───────────────── */}
      <div className="operational-row" style={bodyStyle}>
        <div style={lineBlockStyle}>
          <span style={thumbnailStyle} aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <div style={productNameStyle}>
              {order.itemName || 'Item name not recorded'}{' '}
              <span style={qtyStyle}>· {order.itemsCount ?? 0} item{order.itemsCount === 1 ? '' : 's'}</span>
            </div>
            {/*
              🔴 EVERY EXTERNAL IDENTIFIER NAMES THE PARTY THAT ISSUED IT (`DB-013`, and
              `OSC-030`'s required data says so outright — *external references with their issuing
              party*). ⚠ THIS CARD PREVIOUSLY DID NOT, and once a courier exists the omission stops
              being cosmetic: `Tracking` was Daraz's code, the shipment now carries STEADFAST's, and
              two parties may legitimately issue the same string. An operator who cannot tell whose
              number they are reading cannot tell who to ask about the parcel.

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
                      {' · '}Steadfast tracking{' '}
                      <span style={monoStyle}>{order.courierTrackingCode}</span>
                    </>
                  ) : null}
                </>
              ) : (
                'Courier not booked'
              )}
            </div>
          </div>
        </div>

        {/*
          ⚠ THE FIVE ECONOMIC FIGURES ARE ONE BLOCK, AND KEEPING THEM SO IS THE POINT OF THIS
          WRAPPER. `Received` and `Margin` previously sat against the action buttons because the
          demoted group carried `margin: 0 auto` and pushed itself to the middle, splitting the
          economics in two. 🔴 A figure adjacent to a button reads as that button's subject, and
          `§3.15`'s hierarchy is DEMOTED-then-PRIMARY across one run — not two groups separated by
          the width of the card.
        */}
        <div style={economicsStyle} data-testid="order-economics">
          {/*
            🔴 THE DEMOTED FIGURES. Sale is real — it is what the marketplace reported. Cost and
            Charges are NOT held for an imported order, and `INV-32.4` requires an unknown cost to
            render UNKNOWN rather than zero. The design's `৳0` is sample data, not a fact.
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
          `SYS-034` forbids summing unknowns as zeros. The design's green figure equals its Sale
          figure, which is precisely the misreading `E-032` recorded from live experience.
        */}
          <div style={primaryGroupStyle}>
            <Primary label="Received" value="Unknown" />
            <Primary label="Margin" value="Unknown" />
          </div>
        </div>

        {/*
          🔴 THE ECONOMICS AND THE ACTIONS ARE SEPARATED BY A RULE, NOT BY A GAP. `Margin` is the
          figure an operator's eye lands on last, and a button pressed against it reads as that
          button acting ON it. The divider states the boundary the spacing alone only implied.
        */}
        <Divider height={30} />

        <div style={actionsStyle}>
          <Link to={`/sales/orders/${order.id}`} style={buttonStyle}>
            View
          </Link>
          {/*
            ⚠ `More Actions` IS RENDERED BY THE OWNER'S DECISION (`OSC-056.f`), AND IT CARRIES NO
            ACTIONS YET. `OSC-051.b` withholds a future write control until the owner ratifies the
            missing rule AND the slice can show a real permitted action; the first condition is met
            and the SECOND IS NOT. 🔴 So it does not pretend: it is marked `aria-disabled`, it is not
            a menu that opens on nothing, and its title says plainly that the actions are not built.
            An operator who clicks it learns the truth rather than meeting silence.
          */}
          <button
            type="button"
            style={moreActionsStyle}
            aria-disabled="true"
            data-testid="order-more-actions"
            title="No order action is built yet. Amend, release, hold, cancel and push are each either outside this read-only slice or blocked in OSC-050."
          >
            More Actions
            <ChevronIcon />
          </button>
        </div>
      </div>

      {/* ── Band 3 — document, destination, note ────────────────────────── */}
      <div className="operational-row" style={stripStyle}>
        {/*
          ⚠ THE INVOICE NUMBER IS NOT PRINTED HERE. The owner's decision (`OSC-056.g`) is that this
          element becomes the PRINTABLE INVOICE action, and an action does not caption itself with
          the identifier of the document it would produce. 🔴 The number is not lost — `FRAME 02`
          carries it as a fact of the order, which is where an identifier belongs.
        */}
        <span style={invoiceStyle}>
          <DownloadIcon />
          INVOICE
        </span>
        <Divider height={14} />
        <span style={addressStyle}>
          <PinIcon />
          {order.shippingLine || 'Delivery address not recorded'}
        </span>
        <span style={noteStyle}>
          Note:{' '}
          <span style={noteValueStyle}>{order.buyerNote || 'none'}</span>
        </span>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ pieces */

function Demoted({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
  return (
    <div style={{ paddingRight: 'var(--space-3)' }}>
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
        ⚠ The design paints Margin with the positive token. It is deliberately NOT painted here:
        `--color-positive` states a gain, and an UNKNOWN margin has not been shown to be one
        (`RULE 3.14.a.a` — a value takes the role its meaning deserves, never the one it resembles).
      */}
      <div className="tabular-nums" style={primaryValueStyle}>
        {value}
      </div>
    </div>
  );
}

function Divider({ height }: { readonly height: number }): React.JSX.Element {
  return <span aria-hidden="true" style={{ width: '1px', height: `${height}px`, background: 'var(--color-divider-vertical)' }} />;
}

function PersonIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-stroke-nav)"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function DownloadIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-stroke-header)"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 21h14" />
    </svg>
  );
}

function ChevronIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PinIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-stroke-nav)"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
         style={{ flexShrink: 0 }}>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ styles */

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  overflow: 'hidden',
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

const customerLinkStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '14px',
  color: 'var(--color-link)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const metaStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: '12px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const monoStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '11.5px',
};

const headerRightStyle: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  flexShrink: 0,
};

function chipStyle(tone: string): React.CSSProperties {
  return {
    background: `var(--color-semantic-${tone}-bg)`,
    color: `var(--color-semantic-${tone}-fg)`,
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px var(--space-3)',
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
  border: '1px solid var(--color-border-card)',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-control)',
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
  fontFamily: 'ui-monospace, monospace',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

/*
  ⚠ SIZED IN `px` AND NOT TOKENISED, DELIBERATELY. `DESIGN_CONSTITUTION.md` carries no control-size
  token for a checkbox and `UX-260` forbids inventing a component specification; 15px matches the
  28px avatar's optical weight beside it. `accentColor` paints the native control with the canonical
  ink rather than the browser's blue, which is the one part `RULE 15.1` does reach.
*/
const checkboxStyle: React.CSSProperties = {
  width: '15px',
  height: '15px',
  margin: 0,
  accentColor: 'var(--color-ink)',
  cursor: 'pointer',
  flexShrink: 0,
};


const bodyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: 'var(--space-4) var(--space-6)',
  minWidth: 0,
};

const lineBlockStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  width: '400px',
  flexShrink: 1,
  minWidth: 0,
};

const thumbnailStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-divider-light)',
  border: '1px solid var(--color-border-card)',
  flexShrink: 0,
};

const productNameStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const qtyStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--color-text-demoted)',
  whiteSpace: 'nowrap',
};

const subLineStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  color: 'var(--color-text-demoted)',
  marginTop: '3px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/*
  ⚠ THE AUTO MARGIN LIVES HERE, ON THE WHOLE ECONOMIC RUN, AND NOT ON HALF OF IT. Putting it on
  the demoted group centred that group alone and left `Received`/`Margin` pinned against the
  action buttons — which is what the product owner reported, 2026-08-24.
*/
const economicsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  marginLeft: 'auto',
  flexShrink: 0,
  minWidth: 'max-content',
};

const demotedGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  flexShrink: 0,
  minWidth: 'max-content',
  paddingRight: 'var(--space-4)',
  borderRight: '1px solid var(--color-border-card)',
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
  alignItems: 'flex-start',
  gap: 'var(--space-7)',
  flexShrink: 0,
  paddingLeft: 'var(--space-4)',
};

/*
  ⚠ THE ONE PLACE THE DESIGN CARRIES A VALUE NO TOKEN HOLDS. Its Received/Margin labels are
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

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  marginLeft: 'var(--space-7)',
};

const buttonStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-secondary-button)',
  color: 'var(--color-secondary-text)',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  height: '32px',
  padding: '0 var(--space-5)',
  borderRadius: 'var(--radius-control)',
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
};

/*
  ⚠ IT LOOKS LIKE ITS SIBLING AND IS DIMMED, WHICH IS THE HONEST COMBINATION. Matching `buttonStyle`
  keeps the design's pairing; the muted ink and `not-allowed` cursor keep the promise small until a
  real action exists to put behind it (`OSC-056.f`).
*/
const moreActionsStyle: React.CSSProperties = {
  ...buttonStyle,
  color: 'var(--color-text-muted)',
  cursor: 'not-allowed',
  gap: 'var(--space-2)',
};

const stripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  padding: '7px var(--space-6)',
  borderTop: '1px solid var(--color-divider-light)',
  background: 'var(--color-strip)',
  minWidth: 0,
};

const invoiceStyle: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'var(--color-ink)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexShrink: 0,
};

const addressStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const noteStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--color-text-demoted)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const noteValueStyle: React.CSSProperties = {
  color: 'var(--color-text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '200px',
};
