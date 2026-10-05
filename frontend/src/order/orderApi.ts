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
  /** The SOURCE of the order: DARAZ, WEBSITE, PHONE, WALKIN ... */
  readonly channelType?: string | null;
  readonly externalOrderId: string;
  readonly orderNumber: string | null;
  /**
   * The Trioloo-issued invoice number, e.g. `TR0001` (`PRN-013`, `INV-39.1`).
   *
   * 🔴 NOT `invoiceNumber` — that name belongs to the MARKETPLACE's invoice number on this
   * same row, which `BR-171` keeps as an external fact. Two numbers, two owners, never
   * conflated (`PRN-014`).
   *
   * ⚠ Nullable in the type because the column is nullable: an order written before `V19`
   * and not yet issued one would have none. `V19` backfilled every existing row and the
   * import path issues one on creation, so in practice it is always present.
   */
  readonly triolooInvoiceNumber: string | null;
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
  /**
   * The courier's own identifiers — issued by STEADFAST, not by the marketplace.
   *
   * 🔴 `trackingCode` above is DARAZ's. `DB-013` — an external identifier is only meaningful
   * alongside the party that issued it, and two parties may legitimately issue the same string.
   * Merging them would leave the card unable to say who to ask about a parcel.
   *
   * ⚠ Null until a consignment is booked, and null again once the shipment settles: the row
   * carries the ACTIVE shipment only (`BR-023`, `BD-442`).
   */
  readonly courierConsignmentId: string | null;
  readonly courierTrackingCode: string | null;
  readonly shipmentState: string | null;
  /** `V30`/`V32` — a recorded attribute of how the order was captured: WALK_IN, MARKETPLACE, WEBSITE or absent. */
  readonly orderTag?: string | null;
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
  /** `V34` — units on this line; 1 for every Daraz row. */
  readonly quantity?: number;
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
  /** `BR-167` — `AUTO_CONFIRMED` or `HUMAN`; `null` = not yet confirmed. */
  readonly confirmationMode: string | null;
  readonly confirmedAt: string | null;
  /** `BR-014` — why verification was not required. */
  readonly confirmationReason: string | null;
  /** `BR-127` — money received before delivery; `null` = none recorded. A STRING, never parsed. */
  readonly advanceReceived?: string | null;
  readonly warrantyTerm?: string | null;
  /** `V32` — the user the sale is attributed to; `null` = not recorded. */
  readonly soldByName?: string | null;
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

/** The lists the New order form chooses from (shops and users) — gated by `order.order.create`. */
export type CaptureOptions = {
  readonly shops: readonly { readonly id: string; readonly code: string; readonly name: string | null; readonly channelType: string }[];
  readonly users: readonly { readonly id: string; readonly fullName: string }[];
};

export function fetchCaptureOptions(): Promise<CaptureOptions> {
  return apiRequest<CaptureOptions>('/api/order/orders/capture-options');
}

/** `V32` — the owner's three order types, a recorded attribute of how the order was captured. */
export const ORDER_TYPES: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'WALK_IN', label: 'Walk-in order' },
  { value: 'MARKETPLACE', label: 'Marketplace order' },
  { value: 'WEBSITE', label: 'Website order' },
];

/** BR-197 — the order-level warranty term, 7 days to 12 years. The code is stored; the label is printed. */
export const WARRANTY_TERMS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'D7', label: '7 days' },
  { value: 'D15', label: '15 days' },
  { value: 'M1', label: '1 month' },
  { value: 'M3', label: '3 months' },
  { value: 'M6', label: '6 months' },
  ...Array.from({ length: 12 }, (_, index) => ({
    value: `Y${index + 1}`,
    label: index === 0 ? '1 year' : `${index + 1} years`,
  })),
];

export function warrantyTermLabel(code: string | null | undefined): string | null {
  return WARRANTY_TERMS.find((term) => term.value === code)?.label ?? null;
}

/** The order's source as the operator reads it. A type with no ratified label shows its own word, title-cased. */
export function sourceLabel(channelType: string | null | undefined): string | null {
  if (!channelType) {
    return null;
  }
  switch (channelType.toUpperCase()) {
    case 'DARAZ': return 'Daraz';
    case 'WEBSITE': return 'Website';
    case 'PHONE': return 'Phone';
    case 'WALKIN': return 'Walk-in';
    default: return channelType.charAt(0).toUpperCase() + channelType.slice(1).toLowerCase();
  }
}

export function orderTypeLabel(tag: string | null | undefined): string | null {
  return ORDER_TYPES.find((type) => type.value === tag)?.label ?? null;
}

/** `V39` — what the courier has told us, oldest first. Steadfast publishes no scan history: these are observations. */
export type TrackingEvent = {
  readonly observedAt: string;
  readonly eventType: 'BOOKED' | 'STATUS';
  readonly providerStatusRaw: string | null;
  readonly shipmentState: string | null;
};

export function fetchTrackingEvents(orderId: string): Promise<readonly TrackingEvent[]> {
  return apiRequest<readonly TrackingEvent[]>(`/api/order/channel-orders/${encodeURIComponent(orderId)}/tracking-events`);
}

export function fetchChannelOrder(id: string): Promise<ChannelOrderDetail> {
  return apiRequest<ChannelOrderDetail>(`/api/order/channel-orders/${encodeURIComponent(id)}`);
}

export type ShipmentBookingResult = {
  readonly shipmentId: string;
  readonly consignmentId: string | null;
  readonly trackingCode: string | null;
  readonly providerStatusRaw: string | null;
};

export type ShipmentTrackingResult = {
  readonly shipmentId: string;
  readonly state: string;
  readonly providerStatusRaw: string | null;
  readonly translated: boolean;
  readonly note: string | null;
};

export function bookOrderShipment(orderId: string): Promise<ShipmentBookingResult> {
  return apiRequest<ShipmentBookingResult>(
    `/api/delivery/orders/${encodeURIComponent(orderId)}/shipment-booking`,
    { method: 'POST' },
  );
}

export function refreshOrderTracking(orderId: string): Promise<ShipmentTrackingResult> {
  return apiRequest<ShipmentTrackingResult>(
    `/api/delivery/orders/${encodeURIComponent(orderId)}/tracking-refresh`,
    { method: 'POST' },
  );
}

/** `BD-035` — the eight reasons Trioloo can give; the ninth is the marketplace's own act. */
export const CANCEL_REASONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'CUSTOMER_UNREACHABLE', label: 'Customer cannot be contacted' },
  { value: 'CUSTOMER_REQUESTED', label: 'Customer requested cancellation' },
  { value: 'CHANGED_MIND', label: 'Customer changed their mind' },
  { value: 'ADDRESS_INCORRECT', label: 'Delivery address incorrect or incomplete' },
  { value: 'PHONE_INCORRECT', label: 'Phone number incorrect or unreachable' },
  { value: 'PRODUCT_UNAVAILABLE', label: 'Product unavailable or out of stock' },
  { value: 'CHANGE_NOT_FULFILLABLE', label: 'Requested changes cannot be fulfilled' },
  { value: 'DUPLICATE_ORDER', label: 'Duplicate order' },
];

export type OrderLifecycleResult = {
  readonly orderId: string;
  readonly canonicalStatus: string;
  /** What the operator must still do outside Trioloo, or `null`. */
  readonly marketplaceNote: string | null;
};

export function cancelOrder(orderId: string, reason: string, note: string): Promise<OrderLifecycleResult> {
  return apiRequest<OrderLifecycleResult>(`/api/order/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason, note }),
  });
}

export function restoreOrder(orderId: string): Promise<OrderLifecycleResult> {
  return apiRequest<OrderLifecycleResult>(`/api/order/orders/${encodeURIComponent(orderId)}/restore`, {
    method: 'POST',
  });
}

/** `BR-204` — suspend a pre-dispatch order (never expires; only a person releases it). */
export function holdOrder(orderId: string, note: string): Promise<OrderLifecycleResult> {
  return apiRequest<OrderLifecycleResult>(`/api/order/orders/${encodeURIComponent(orderId)}/hold`, {
    method: 'POST',
    body: JSON.stringify({ note: note.trim() || null }),
  });
}

export function releaseHold(orderId: string): Promise<OrderLifecycleResult> {
  return apiRequest<OrderLifecycleResult>(`/api/order/orders/${encodeURIComponent(orderId)}/release-hold`, {
    method: 'POST',
  });
}

/** `BR-199` — the failed-delivery parcel is back: who received it, and a note. */
export function receiveReturn(orderId: string, receivedBy: string | null, note: string): Promise<OrderLifecycleResult> {
  return apiRequest<OrderLifecycleResult>(`/api/order/orders/${encodeURIComponent(orderId)}/return-received`, {
    method: 'POST',
    body: JSON.stringify({ receivedBy, note: note.trim() || null }),
  });
}

export type EditOrderPayload = {
  /** Optional note (owner, 2026-10-05). */
  readonly reason: string | null;
  readonly recipientName: string;
  readonly phone: string;
  /** ONE full address, city and post code included. */
  readonly address: string;
  /** Money crosses as a STRING and is never parsed in the browser (`TEC-015`). */
  readonly total: string | null;
  /** `null` = leave the advance as it is; `"0"` = clear it; otherwise the new amount. */
  readonly advanceReceived: string | null;
  /** BR-197 — `null` = unchanged; `"NONE"` = clear; otherwise a term code. */
  readonly warrantyTerm?: string | null;
  readonly lines: readonly {
    readonly id: string;
    readonly name: string;
    readonly quantity: number;
    readonly unitPrice: string | null;
  }[];
};

export type EditOrderResult = {
  readonly orderId: string;
  readonly fieldsChanged: number;
  /** What the operator must still do outside Trioloo, or `null`. */
  readonly note: string | null;
};

export function editOrder(orderId: string, payload: EditOrderPayload): Promise<EditOrderResult> {
  return apiRequest<EditOrderResult>(`/api/order/orders/${encodeURIComponent(orderId)}/edit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
