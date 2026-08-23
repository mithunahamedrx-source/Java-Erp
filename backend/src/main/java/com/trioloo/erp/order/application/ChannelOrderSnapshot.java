package com.trioloo.erp.order.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ChannelOrderSnapshot(
        String externalOrderId,
        String orderNumber,
        Instant providerCreatedAt,
        Instant providerUpdatedAt,
        BigDecimal price,
        BigDecimal shippingFee,
        BigDecimal shippingFeeOriginal,
        BigDecimal shippingFeeDiscountPlatform,
        BigDecimal shippingFeeDiscountSeller,
        BigDecimal voucher,
        BigDecimal voucherPlatform,
        BigDecimal voucherSeller,
        BigDecimal cashPaymentFee,
        String paymentMethod,
        String voucherCode,
        Integer itemsCount,
        List<String> statuses,
        String promisedShippingTimes,
        String warehouseCode,
        String deliveryInfo,
        String buyerNote,
        String remarks,
        String giftOption,
        String giftMessage,
        String nationalRegistrationNumber1,
        String branchNumber,
        String taxCode,
        String extraAttributes,
        String customerFirstName,
        String customerLastName,
        AddressSnapshot billingAddress,
        AddressSnapshot shippingAddress,
        List<ChannelOrderItemSnapshot> items) {

    public ChannelOrderSnapshot {
        statuses = statuses == null ? List.of() : List.copyOf(statuses);
        items = items == null ? List.of() : List.copyOf(items);
    }

    public record AddressSnapshot(
            String firstName,
            String lastName,
            String phone,
            String phone2,
            String address1,
            String address2,
            String address3,
            String address4,
            String address5,
            String city,
            String postCode,
            String country) {
    }
}
