package com.trioloo.erp.order.application;

import java.math.BigDecimal;
import java.time.Instant;

public record ChannelOrderItemSnapshot(
        String externalOrderItemId,
        String externalOrderId,
        String sku,
        String shopSku,
        String skuId,
        String name,
        String variation,
        BigDecimal itemPrice,
        BigDecimal paidPrice,
        String status,
        String reason,
        String trackingCode,
        String shipmentProvider,
        String shippingProviderType,
        String invoiceNumber,
        String purchaseOrderId,
        String digitalDeliveryInfo,
        Instant providerCreatedAt,
        Instant providerUpdatedAt) {
}
