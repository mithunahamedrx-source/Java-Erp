import { apiRequest } from '../platform/api';

export type DecimalValue = string | number | null;

export type ChannelOrderPage<T> = {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
};

export type ChannelOrderSummary = {
  readonly totalOrders: number;
  readonly pendingOrders: number;
  readonly readyToShipOrders: number;
  readonly deliveredOrders: number;
  readonly totalItems: number;
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
  readonly statuses: readonly string[];
  readonly providerCreatedAt: string | null;
  readonly providerUpdatedAt: string | null;
  readonly lastSeenAt: string | null;
  readonly price: DecimalValue;
  readonly paymentMethod: string | null;
  readonly itemsCount: number | null;
  readonly customerFirstName: string | null;
  readonly customerLastName: string | null;
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
