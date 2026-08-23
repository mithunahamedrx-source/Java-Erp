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

export function displayMoney(value: DecimalValue): string {
  if (value === null || value === undefined) {
    return 'Not recorded';
  }
  return formatMoneyForDisplay(String(value)) ?? 'Not recorded';
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
