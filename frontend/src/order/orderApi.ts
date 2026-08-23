import { apiRequest } from '../platform/api';

/**
 * An authoritative monetary amount, as it crosses the API.
 *
 * 🔴 `TEC-015` / `DB-079` / `OSC-043` — money crosses as an exact decimal STRING, never a JSON
 * number, because JavaScript parses every JSON number as an IEEE-754 double and a value that
 * has been through one is no longer the authoritative amount. `number` is deliberately NOT in
 * this union: the type is what stops a server-side `@MonetaryAmount` omission from being
 * absorbed silently on this side (`PRJ-045`, `TEC-095`).
 */
export type DecimalValue = string | null;

export type ChannelOrderPage<T> = {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
};

/**
 * The four Orders workspace summary figures.
 *
 * 🔴 `totalCollectable` is an authoritative decimal STRING (`TEC-015`, `OSC-043`). It is never
 * parsed into a `Number` and no arithmetic is performed on it here (`TEC-095`).
 */
export type ChannelOrderSummary = {
  readonly totalOrders: number;
  readonly todaysOrders: number;
  readonly todaysDispatched: number;
  readonly totalCollectable: string | null;
  readonly totalItems: number;
  /**
   * The channel types that actually have orders, with counts.
   *
   * 🔴 The channel filter is built from THIS, never from a hard-coded list of channel names.
   * A browser-side list would be a second register of a set `SYS-108` owns, and it would offer
   * the operator a filter that can only ever return nothing.
   */
  readonly channelTypes: readonly { readonly channelType: string; readonly orderCount: number }[];
  /**
   * How many orders currently carry each canonical status.
   *
   * ⚠ Computed IGNORING the active status filter, so selecting one tab does not zero the rest.
   * 🔴 An order carrying several canonical statuses is counted under each, so these need not
   * sum to `totalOrders` — that is correct, not a defect.
   */
  readonly statusCounts: readonly { readonly status: string; readonly orderCount: number }[];
  /**
   * The shops that actually have orders.
   *
   * 🔴 `BR-002` — reporting, settlement and reconciliation all operate at INSTANCE level, and
   * "Daraz" is never a sufficient attribution because settlement arrives per shop and margin
   * differs per shop. The channel-type filter cannot answer "which shop"; this can.
   */
  readonly shops: readonly {
    readonly channelInstanceId: string;
    readonly code: string;
    readonly name: string | null;
    readonly orderCount: number;
  }[];
};

export type AddressView = {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly phone2: string | null;
  readonly address1: string | null;
  readonly address2: string | null;
  readonly address3: string | null;
  readonly address4: string | null;
  readonly address5: string | null;
  readonly city: string | null;
  readonly postCode: string | null;
  readonly country: string | null;
};

export type ChannelOrderRow = {
  readonly id: string;
  readonly channelInstanceId: string;
  readonly channelName: string | null;
  readonly externalOrderId: string;
  readonly orderNumber: string | null;
  readonly ownership: string;
  /** The marketplace's own status vocabulary, exactly as reported (`BR-173`). */
  readonly statuses: readonly string[];
  /**
   * The canonical (`SM-1`, `OM §6.2`) mirror the channel adapter produced (`§4.3`, `BR-005`).
   *
   * 🔴 A separate fact from `statuses` and never merged with it (`BR-171`, `UX-182`).
   */
  readonly canonicalStatuses: readonly string[];
  /** When THIS system first observed the order as `DISPATCHED` — not a marketplace fact. */
  readonly dispatchObservedAt: string | null;
  readonly providerCreatedAt: string | null;
  readonly providerUpdatedAt: string | null;
  readonly lastSeenAt: string | null;
  readonly price: DecimalValue;
  readonly paymentMethod: string | null;
  readonly itemsCount: number | null;
  readonly customerFirstName: string | null;
  readonly customerLastName: string | null;
  readonly shippingPhone: string | null;
  /** The delivery address as one line, joined only from parts Daraz documents (`DZC-045.f`). */
  readonly shippingLine: string | null;
  readonly buyerNote: string | null;
  readonly itemName: string | null;
  readonly trackingCode: string | null;
  readonly invoiceNumber: string | null;
  readonly purchaseOrderId: string | null;
};

export type ChannelOrderItemRow = {
  readonly id: string;
  readonly externalOrderItemId: string | null;
  readonly externalOrderId: string | null;
  readonly sku: string | null;
  readonly shopSku: string | null;
  readonly skuId: string | null;
  readonly name: string | null;
  readonly variation: string | null;
  readonly itemPrice: DecimalValue;
  readonly paidPrice: DecimalValue;
  readonly status: string | null;
  readonly reason: string | null;
  readonly trackingCode: string | null;
  readonly shipmentProvider: string | null;
  readonly shippingProviderType: string | null;
  readonly invoiceNumber: string | null;
  readonly purchaseOrderId: string | null;
  readonly digitalDeliveryInfo: string | null;
  readonly providerCreatedAt: string | null;
  readonly providerUpdatedAt: string | null;
};

export type ChannelOrderDetail = ChannelOrderRow & {
  readonly channelType: string | null;
  readonly importedAt: string | null;
  readonly shippingFee: DecimalValue;
  readonly shippingFeeOriginal: DecimalValue;
  readonly shippingFeeDiscountPlatform: DecimalValue;
  readonly shippingFeeDiscountSeller: DecimalValue;
  readonly voucher: DecimalValue;
  readonly voucherPlatform: DecimalValue;
  readonly voucherSeller: DecimalValue;
  readonly cashPaymentFee: DecimalValue;
  readonly voucherCode: string | null;
  readonly promisedShippingTimes: string | null;
  readonly warehouseCode: string | null;
  readonly deliveryInfo: string | null;
  readonly buyerNote: string | null;
  readonly remarks: string | null;
  readonly giftOption: string | null;
  readonly giftMessage: string | null;
  readonly nationalRegistrationNumber1: string | null;
  readonly branchNumber: string | null;
  readonly taxCode: string | null;
  readonly extraAttributes: string | null;
  readonly customerFirstName: string | null;
  readonly customerLastName: string | null;
  readonly billingAddress: AddressView | null;
  readonly shippingAddress: AddressView | null;
  readonly items: readonly ChannelOrderItemRow[];
};

export type ChannelOrderFilters = {
  readonly search?: string;
  readonly status?: string;
  /** Canonical channel type (`BR-002`), e.g. `DARAZ`. Never a display label. */
  readonly channelType?: string;
  /** `DAY` · `MONTH` · `YEAR` — calendar boundaries in `Asia/Dhaka` (`TEC-050`, `TEC-052`). */
  readonly period?: string;
  readonly channelInstanceId?: string;
};

function queryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }
  const rendered = query.toString();
  return rendered ? `?${rendered}` : '';
}

export function listChannelOrders(
  filters: ChannelOrderFilters,
  page: number,
  size: number,
): Promise<ChannelOrderPage<ChannelOrderRow>> {
  return apiRequest<ChannelOrderPage<ChannelOrderRow>>(
    `/api/order/channel-orders${queryString({ ...filters, page, size })}`,
  );
}

export function fetchChannelOrderSummary(filters: ChannelOrderFilters): Promise<ChannelOrderSummary> {
  return apiRequest<ChannelOrderSummary>(`/api/order/channel-orders/summary${queryString(filters)}`);
}

export function fetchChannelOrder(id: string): Promise<ChannelOrderDetail> {
  return apiRequest<ChannelOrderDetail>(`/api/order/channel-orders/${encodeURIComponent(id)}`);
}
