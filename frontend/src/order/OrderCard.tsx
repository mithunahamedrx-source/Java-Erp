import { Link } from 'react-router-dom';
import type { ChannelOrderRow } from './orderApi';
import { ORDER_LIFECYCLE_ROLE, semanticRoleOf } from '../design/semanticRole';
import {
  canonicalStatus,
  canonicalStatusLabel,
  customerName,
  displayMoment,
  displayMoney,
  orderTitle,
  ownershipLabel,
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
 * business claim to discard. The slot carries the ORDER AUTHORITY instead (`BR-168`, `UX-183`),
 * which is a real fact this order holds.
 */
export default function OrderCard({ order }: { readonly order: ChannelOrderRow }): React.JSX.Element {
  /*
    🔴 TWO STATUSES, TWO OWNERS, NEVER MERGED (`BR-171`, `UX-182`, `OSC-036`). The header chip
    carries the canonical lifecycle reading; the marketplace's own word rides beside the shop name.
  */
  const canonical = canonicalStatus(order.canonicalStatuses);
  const reported = primaryStatus(order.statuses);
  const role = canonical ? semanticRoleOf(ORDER_LIFECYCLE_ROLE, canonical) : 'neutral';

  return (
    <article style={cardStyle} data-testid="order-card">
      {/* ── Band 1 — identity, time, origin, state ─────────────────────── */}
      <div className="operational-row" style={headerStyle}>
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
        {/* `BR-002` — channel type is never sufficient; the INSTANCE is named. */}
        <span style={{ ...metaStyle, marginLeft: 'var(--space-6)' }}>
          {order.channelName ?? 'Shop not recorded'} ·{' '}
          <span style={monoStyle}>{order.externalOrderId}</span>
        </span>

        <div style={headerRightStyle}>
          <span style={chipStyle(role)}>
            {canonical ? canonicalStatusLabel(canonical) : 'Status not translated'}
          </span>
          {/*
            🔴 NOT the design's `Not Released` chip — `BR-080` withdrew that state. This slot
            carries the AUTHORITY state, in business language (`UX-183`): "the marketplace still
            updates this order" versus "Trioloo now controls it".
          */}
          <span style={chipStyle('neutral')}>{ownershipLabel(order.ownership)}</span>
          <Divider height={16} />
          <span style={metaStyle}>{order.paymentMethod || 'Payment not recorded'}</span>
          <Divider height={16} />
          <span style={orderNumberStyle}>{orderTitle(order)}</span>
          {/*
            🔴 THE MARKETPLACE'S OWN WORD, NAMED AS SUCH. `BR-171` requires the external status to
            stay visibly distinct from the ERP's operational reading, and an unlabelled `· pending`
            beside the order number would leave the reader guessing which system said it.
          */}
          <span style={{ ...metaStyle, fontSize: '11.5px' }}>Marketplace · {reported}</span>
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
              ⚠ `purchase_order_id` is what Daraz publishes; it is NOT relabelled "Parcel" because
              `DZC-047.c` names a separate `package_id` this slice does not import (`UX-271.a` — a
              visual reference never renames a canonical fact).
            */}
            <div style={subLineStyle}>
              Purchase order <span style={monoStyle}>{order.purchaseOrderId || 'not recorded'}</span>
            </div>
            <div style={subLineStyle}>
              Tracking <span style={monoStyle}>{order.trackingCode || 'not recorded'}</span>
            </div>
          </div>
        </div>

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

        <div style={actionsStyle}>
          <Link to={`/sales/orders/${order.id}`} style={buttonStyle}>
            View
          </Link>
          {/*
            🔴 NO `More Actions` CONTROL. Every action it would open — amend, release, hold,
            cancel, push — is either outside this read-only slice or blocked in `OSC-050`, and
            `OSC-051.b` forbids rendering a future write control. A disabled menu advertises
            authority the operator does not have.
          */}
        </div>
      </div>

      {/* ── Band 3 — document, destination, note ────────────────────────── */}
      <div className="operational-row" style={stripStyle}>
        <span style={invoiceStyle}>
          <DownloadIcon />
          INVOICE
        </span>
        <span style={monoStyle}>{order.invoiceNumber || 'not issued'}</span>
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

const orderNumberStyle: React.CSSProperties = {
  color: 'var(--color-text-primary)',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '13px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
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

const demotedGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  flexShrink: 0,
  minWidth: 'max-content',
  margin: '0 auto',
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
  paddingLeft: 'var(--space-1)',
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
