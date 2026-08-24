import { formatMoment, formatShortMoment } from '../platform/datetime';
import { formatMoneyForDisplay } from '../platform/money';
import type { AddressView, ChannelOrderItemRow, ChannelOrderRow, DecimalValue } from './orderApi';

export function customerName(order: Pick<ChannelOrderRow, 'customerFirstName' | 'customerLastName'>): string {
  return [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ').trim() || 'Customer not recorded';
}

export function orderTitle(order: Pick<ChannelOrderRow, 'orderNumber' | 'externalOrderId'>): string {
  return order.orderNumber || order.externalOrderId;
}

/**
 * Formats an authoritative monetary string for display.
 *
 * 🔴 The value is passed through UNCONVERTED. There is no `String(value)` coercion, because a
 * coercion is exactly what would let a JSON number arrive unnoticed and be rendered as though
 * it were the exact amount (`TEC-015`, `OSC-043`). `DecimalValue` admits no `number`.
 */
export function displayMoney(value: DecimalValue): string {
  if (value === null || value === undefined) {
    return 'Not recorded';
  }
  return formatMoneyForDisplay(value) ?? 'Not recorded';
}

export function displayMoment(value: string | null | undefined, compact = false): string {
  return (compact ? formatShortMoment(value) : formatMoment(value)) ?? 'Not recorded';
}

export function displayStatus(status: string | null | undefined): string {
  if (!status) {
    return 'Not recorded';
  }
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function primaryStatus(statuses: readonly string[]): string {
  return statuses[0] ?? 'Not recorded';
}

/**
 * The Orders status tabs.
 *
 * 🔴 EVERY TAB IS NAMED FOR A RATIFIED `SM-1` STATE (`OM §6.2`, `SMA §5.2`, `OSC-030.a`). No
 * label is invented and no legacy label is used: `GAP-017` records `Shipped`, `RTS`, `Pending`
 * and `B2C Pending` as having no canonical state set, and `BR-079` records that `RTS` alone is
 * ambiguous between `READY_TO_SHIP` and Return-To-Seller.
 *
 * 🔴 `DRAFT` IS DELIBERATELY ABSENT — `GAP-023` keeps the `DRAFT` lifecycle BLOCKED
 * (`OSC-050`), and a tab is not created to fill the space.
 *
 * ⚠ `Returned` is present because `OM §6.2` and `SMA §5.2` both ratify `RETURNED` as an `SM-1`
 * state and the channel reports it. `OSC-030.a`'s written tab list omits it; that omission is
 * reported to the contract's owner rather than treated as a prohibition.
 *
 * ⚠ Several tabs can only be empty in this read-only slice: `CONFIRMED`, `RELEASED`,
 * `IN_FULFILLMENT`, `ON_HOLD` and `CLOSED` are reached by Trioloo's own acts, and this slice
 * performs none of them. An empty tab is an honest fact, not a defect.
 */
export const ORDER_STATUS_TABS: readonly { readonly value: string | null; readonly label: string }[] = [
  { value: null, label: 'All' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'IN_FULFILLMENT', label: 'In fulfilment' },
  { value: 'READY_TO_SHIP', label: 'Ready to ship' },
  { value: 'COURIER_BOOKED', label: 'Courier booked' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'FAILED_DELIVERY', label: 'Failed delivery' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'CLOSED', label: 'Closed' },
];

/**
 * The canonical status to show on a card, or `null` where the adapter translated none.
 *
 * 🔴 Returns `null` rather than falling back to the raw channel status. The two are different
 * facts (`BR-171`) and substituting one for the other on a surface labelled with `SM-1` names
 * would state something the architecture does not.
 */
export function canonicalStatus(statuses: readonly string[]): string | null {
  return statuses.length > 0 ? (statuses[0] ?? null) : null;
}

/**
 * The operator-facing label for a canonical status.
 *
 * 🔴 ONE LABEL PER STATE, SHARED BY THE TAB AND THE CHIP. The names come from `OSC-030.a`,
 * which spells them in sentence case — including `In fulfilment` with one `l`, against the
 * `IN_FULFILLMENT` identifier. A surface that title-cased the identifier instead would show the
 * operator two different words for one state.
 *
 * ⚠ A value with no ratified label falls back to the generic formatter rather than rendering
 * blank, so an untranslated state is still legible.
 */
export function canonicalStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return 'Not recorded';
  }
  const tab = ORDER_STATUS_TABS.find((candidate) => candidate.value === status);
  return tab ? tab.label : displayStatus(status);
}

/**
 * The `SM-5` payment position an imported order can be shown to hold.
 *
 * 🔴 DERIVED FROM `SM-1`, AND ONLY WHERE `SM-5` ITSELF MAKES THE DERIVATION AUTOMATIC.
 * `SM-5`'s `NOT_DUE → DUE` transition is `Automatic — on delivery` (`EVT-013`), and `OM §11.3`
 * defines the two states by delivery alone: `NOT_DUE` is "goods not yet delivered", `DUE` is
 * "delivered; payment expected". Nothing is invented here — this is the SAME derivation the
 * shipped `Total collectable` figure already makes (`OSC-053`, `BR-033`).
 *
 * 🔴 EVERY STATE PAST `DUE` IS REFUSED, NOT GUESSED. `COLLECTED_BY_INTERMEDIARY`,
 * `PARTIALLY_RECEIVED`, `RECEIVED`, `RECONCILED`, `SHORT_SETTLED`, `OVER_SETTLED`, `REFUND_DUE`,
 * `REFUNDED` and `WRITTEN_OFF` each require an `E-040 Receivable` to have been collected,
 * matched or settled. No such record exists in this slice, so claiming one would be exactly the
 * fabrication `SYS-034` forbids.
 *
 * ⚠ `DUE` DOES NOT MEAN THE BUYER HAS NOT PAID. `BR-035` — money held by a courier or a
 * marketplace is not money received by Trioloo — so an order the buyer settled in cash on the
 * doorstep is still legitimately `DUE` until it reaches Trioloo.
 *
 * ⚠ `RETURNED` AND `CLOSED` ARE UNKNOWN RATHER THAN `NOT_DUE`, AND THAT IS THE CAREFUL CASE.
 * `OM §6.2` defines `RETURNED` as "goods came back to Trioloo", so they reached the buyer first
 * and a receivable may well have been raised; `SM-5` only reaches `REFUND_DUE` from `RECONCILED`,
 * which cannot be evidenced here. `CLOSED` means "all sub-processes terminal", so `SM-5` is at
 * one of three terminals and nothing held says which. 🔴 Calling either "not due" would state a
 * position the architecture does not support.
 *
 * ⚠ AN UNTRANSLATED `SM-1` STATE IS ALSO UNKNOWN. A payment position derived from a lifecycle
 * state nobody could read is not a position at all.
 */
export type PaymentPosition = {
  readonly state: 'NOT_DUE' | 'DUE' | 'UNKNOWN';
  readonly label: string;
  readonly title: string;
};

export function paymentPosition(canonical: string | null | undefined): PaymentPosition {
  if (canonical === 'DELIVERED') {
    return {
      state: 'DUE',
      label: 'Payment due',
      title: 'SM-5 DUE — delivered, payment expected. Money held by a courier or marketplace '
        + 'is not money received by Trioloo (BR-035).',
    };
  }
  if (canonical === 'RETURNED' || canonical === 'CLOSED' || !canonical) {
    return {
      state: 'UNKNOWN',
      label: 'Payment unknown',
      title: 'The SM-5 position cannot be derived from what this slice holds. No receivable, '
        + 'receipt, remittance or settlement record exists (SYS-034).',
    };
  }
  return {
    state: 'NOT_DUE',
    label: 'Payment not due',
    title: 'SM-5 NOT_DUE — goods not yet delivered. An obligation follows delivered goods and '
      + 'never ordered goods (BR-033).',
  };
}

export function addressLines(address: AddressView | null | undefined): readonly string[] {
  if (!address) {
    return [];
  }
  return [
    [address.firstName, address.lastName].filter(Boolean).join(' ').trim(),
    address.phone,
    address.phone2,
    address.address1,
    address.address2,
    address.address3,
    address.address4,
    address.address5,
    [address.city, address.postCode].filter(Boolean).join(' ').trim(),
    address.country,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

export function itemLabel(item: ChannelOrderItemRow): string {
  return item.name || item.shopSku || item.sku || item.externalOrderItemId || 'Order item';
}
