import type { CSSProperties } from 'react';
import { formatMoment, formatShortMoment } from '../platform/datetime';
import { formatMoneyForDisplay } from '../platform/money';
import type { AddressView, ChannelOrderDetail, ChannelOrderItemRow, ChannelOrderRow, DecimalValue } from './orderApi';

export const ORDER_ROW_COLUMNS = 'minmax(0, 1.45fr) minmax(130px, 0.55fr) minmax(130px, 0.55fr) minmax(150px, 0.7fr)';

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

export function firstRecorded<T>(items: readonly T[], pick: (item: T) => string | null | undefined): string | null {
  for (const item of items) {
    const value = pick(item);
    if (value && value.trim()) {
      return value;
    }
  }
  return null;
}

export function itemLabel(item: ChannelOrderItemRow): string {
  return item.name || item.shopSku || item.sku || item.externalOrderItemId || 'Order item';
}

export function ownershipLabel(value: string | null | undefined): string {
  return value === 'API_MANAGED' ? 'API-managed' : value === 'ERP_MANAGED' ? 'ERP-managed' : displayStatus(value);
}

export function channelSubtitle(order: ChannelOrderRow): string {
  const parts = [
    order.channelName ?? 'Channel not recorded',
    order.externalOrderId ? `External ${order.externalOrderId}` : null,
    `${order.itemsCount ?? 0} item${order.itemsCount === 1 ? '' : 's'}`,
  ];
  return parts.filter(Boolean).join(' · ');
}

export function detailMeta(order: ChannelOrderDetail): string {
  return [
    order.channelName ?? 'Channel not recorded',
    order.channelType ?? null,
    order.providerCreatedAt ? `captured ${displayMoment(order.providerCreatedAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export const pageHeaderButton: CSSProperties = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
