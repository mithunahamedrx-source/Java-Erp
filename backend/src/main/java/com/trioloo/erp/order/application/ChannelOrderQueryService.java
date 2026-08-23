package com.trioloo.erp.order.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ChannelOrderQueryService {

    private static final int MAX_PAGE_SIZE = 200;

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;
    private final ObjectMapper json = new ObjectMapper();

    public ChannelOrderQueryService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    @Transactional(readOnly = true)
    public Page<ChannelOrderRow> list(Filter filter, Pageable pageable) {
        requireViewer();
        Filter f = filter == null ? new Filter(null, null, null) : filter;
        int size = Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE);
        int page = Math.max(pageable.getPageNumber(), 0);
        long offset = (long) page * size;
        String where = where(f);
        Object[] args = args(f);
        List<ChannelOrderRow> rows = jdbc.query("""
                SELECT o.id, o.channel_instance_id, ci.name AS channel_name,
                       o.external_order_id, o.order_number, o.ownership, o.statuses_json::text,
                       o.provider_created_at, o.provider_updated_at, o.last_seen_at,
                       o.price, o.payment_method, o.items_count, o.customer_first_name, o.customer_last_name
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where + """
                 ORDER BY o.provider_created_at DESC NULLS LAST, o.imported_at DESC, o.external_order_id ASC
                 LIMIT ? OFFSET ?
                """, append(args, size, offset), (rs, rowNum) -> row(rs));
        Long total = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where, args, Long.class);
        return new PageImpl<>(rows, pageable, total == null ? 0 : total);
    }

    @Transactional(readOnly = true)
    public Summary summary(Filter filter) {
        requireViewer();
        Filter f = filter == null ? new Filter(null, null, null) : filter;
        String where = where(f);
        Object[] args = args(f);
        Long total = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where, args, Long.class);
        Long pending = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where + statusClause(where, "pending"), append(args, "pending"), Long.class);
        Long readyToShip = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where + statusClause(where, "ready_to_ship"), append(args, "ready_to_ship"), Long.class);
        Long delivered = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where + statusClause(where, "delivered"), append(args, "delivered"), Long.class);
        Long items = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order_item i
                  JOIN channel_order o ON o.id = i.channel_order_id
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where, args, Long.class);
        return new Summary(n(total), n(pending), n(readyToShip), n(delivered), n(items));
    }

    @Transactional(readOnly = true)
    public ChannelOrderDetail detail(UUID id) {
        requireViewer();
        List<ChannelOrderDetail> found = jdbc.query("""
                SELECT o.*, ci.name AS channel_name, ci.channel_type
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                 WHERE o.id = ?
                """, (rs, rowNum) -> detail(rs), id);
        ChannelOrderDetail detail = found.stream().findFirst()
                .orElseThrow(() -> new ChannelOrderNotFoundException(id));
        List<ChannelOrderItemRow> items = jdbc.query("""
                SELECT id, external_order_item_id, external_order_id, sku, shop_sku, sku_id,
                       item_name, variation, item_price, paid_price, status, reason,
                       tracking_code, shipment_provider, shipping_provider_type, invoice_number,
                       purchase_order_id, digital_delivery_info, provider_created_at, provider_updated_at
                  FROM channel_order_item
                 WHERE channel_order_id = ?
                 ORDER BY external_order_item_id ASC
                """, (rs, rowNum) -> item(rs), id);
        return detail.withItems(items);
    }

    private void requireViewer() {
        if (currentActor.current().filter(a -> a.hasPermission(OrderPermissions.CHANNEL_ORDER_VIEW)).isEmpty()) {
            throw new AccessDeniedByPermissionException(OrderPermissions.CHANNEL_ORDER_VIEW);
        }
    }

    private String where(Filter f) {
        StringBuilder sql = new StringBuilder(" WHERE 1 = 1");
        if (f.channelInstanceId() != null) {
            sql.append(" AND o.channel_instance_id = ?");
        }
        if (present(f.status())) {
            sql.append(" AND o.statuses_json ?? ?");
        }
        if (present(f.search())) {
            sql.append("""
                     AND (
                       lower(o.external_order_id) LIKE ?
                       OR lower(coalesce(o.order_number, '')) LIKE ?
                       OR lower(coalesce(o.customer_first_name, '') || ' ' || coalesce(o.customer_last_name, '')) LIKE ?
                     )
                    """);
        }
        return sql.toString();
    }

    private Object[] args(Filter f) {
        java.util.ArrayList<Object> values = new java.util.ArrayList<>();
        if (f.channelInstanceId() != null) {
            values.add(f.channelInstanceId());
        }
        if (present(f.status())) {
            values.add(f.status().trim());
        }
        if (present(f.search())) {
            String needle = "%" + f.search().trim().toLowerCase() + "%";
            values.add(needle);
            values.add(needle);
            values.add(needle);
        }
        return values.toArray();
    }

    private static String statusClause(String currentWhere, String ignored) {
        return currentWhere.contains(" WHERE ") ? " AND o.statuses_json ?? ?" : " WHERE o.statuses_json ?? ?";
    }

    private ChannelOrderRow row(ResultSet rs) throws SQLException {
        return new ChannelOrderRow(
                uuid(rs, "id"), uuid(rs, "channel_instance_id"), rs.getString("channel_name"),
                rs.getString("external_order_id"), rs.getString("order_number"), rs.getString("ownership"),
                statuses(rs.getString("statuses_json")), instant(rs, "provider_created_at"),
                instant(rs, "provider_updated_at"), instant(rs, "last_seen_at"),
                rs.getBigDecimal("price"), rs.getString("payment_method"), integer(rs, "items_count"),
                rs.getString("customer_first_name"), rs.getString("customer_last_name"));
    }

    private ChannelOrderDetail detail(ResultSet rs) throws SQLException {
        return new ChannelOrderDetail(
                uuid(rs, "id"), uuid(rs, "channel_instance_id"), rs.getString("channel_name"),
                rs.getString("channel_type"), rs.getString("external_order_id"),
                rs.getString("order_number"), rs.getString("ownership"),
                statuses(rs.getString("statuses_json")), instant(rs, "provider_created_at"),
                instant(rs, "provider_updated_at"), instant(rs, "imported_at"), instant(rs, "last_seen_at"),
                rs.getBigDecimal("price"), rs.getBigDecimal("shipping_fee"),
                rs.getBigDecimal("shipping_fee_original"), rs.getBigDecimal("shipping_fee_discount_platform"),
                rs.getBigDecimal("shipping_fee_discount_seller"), rs.getBigDecimal("voucher"),
                rs.getBigDecimal("voucher_platform"), rs.getBigDecimal("voucher_seller"),
                rs.getBigDecimal("cash_payment_fee"), rs.getString("payment_method"),
                rs.getString("voucher_code"), integer(rs, "items_count"), rs.getString("promised_shipping_times"),
                rs.getString("warehouse_code"), rs.getString("delivery_info"), rs.getString("buyer_note"),
                rs.getString("remarks"), rs.getString("gift_option"), rs.getString("gift_message"),
                rs.getString("national_registration_number1"), rs.getString("branch_number"),
                rs.getString("tax_code"), rs.getString("extra_attributes"),
                rs.getString("customer_first_name"), rs.getString("customer_last_name"),
                address(rs, "billing"), address(rs, "shipping"), List.of());
    }

    private ChannelOrderItemRow item(ResultSet rs) throws SQLException {
        return new ChannelOrderItemRow(uuid(rs, "id"), rs.getString("external_order_item_id"),
                rs.getString("external_order_id"), rs.getString("sku"), rs.getString("shop_sku"),
                rs.getString("sku_id"), rs.getString("item_name"), rs.getString("variation"),
                rs.getBigDecimal("item_price"), rs.getBigDecimal("paid_price"), rs.getString("status"),
                rs.getString("reason"), rs.getString("tracking_code"), rs.getString("shipment_provider"),
                rs.getString("shipping_provider_type"), rs.getString("invoice_number"),
                rs.getString("purchase_order_id"), rs.getString("digital_delivery_info"),
                instant(rs, "provider_created_at"), instant(rs, "provider_updated_at"));
    }

    private AddressView address(ResultSet rs, String prefix) throws SQLException {
        return new AddressView(rs.getString(prefix + "_first_name"), rs.getString(prefix + "_last_name"),
                rs.getString(prefix + "_phone"), rs.getString(prefix + "_phone2"),
                rs.getString(prefix + "_address1"), rs.getString(prefix + "_address2"),
                rs.getString(prefix + "_address3"), rs.getString(prefix + "_address4"),
                rs.getString(prefix + "_address5"), rs.getString(prefix + "_city"),
                rs.getString(prefix + "_post_code"), rs.getString(prefix + "_country"));
    }

    private List<String> statuses(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return json.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static UUID uuid(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        return value instanceof UUID id ? id : null;
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp ts = rs.getTimestamp(column);
        return ts == null ? null : ts.toInstant();
    }

    private static Integer integer(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private static long n(Long value) {
        return value == null ? 0 : value;
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    private static Object[] append(Object[] base, Object... suffix) {
        Object[] combined = java.util.Arrays.copyOf(base, base.length + suffix.length);
        System.arraycopy(suffix, 0, combined, base.length, suffix.length);
        return combined;
    }

    public record Filter(UUID channelInstanceId, String status, String search) {}

    public record Summary(long totalOrders, long pendingOrders, long readyToShipOrders,
                          long deliveredOrders, long totalItems) {}

    public record ChannelOrderRow(UUID id, UUID channelInstanceId, String channelName,
                                  String externalOrderId, String orderNumber, String ownership,
                                  List<String> statuses, Instant providerCreatedAt,
                                  Instant providerUpdatedAt, Instant lastSeenAt,
                                  BigDecimal price, String paymentMethod, Integer itemsCount,
                                  String customerFirstName, String customerLastName) {}

    public record ChannelOrderDetail(UUID id, UUID channelInstanceId, String channelName,
                                     String channelType, String externalOrderId, String orderNumber,
                                     String ownership, List<String> statuses, Instant providerCreatedAt,
                                     Instant providerUpdatedAt, Instant importedAt, Instant lastSeenAt,
                                     BigDecimal price, BigDecimal shippingFee,
                                     BigDecimal shippingFeeOriginal, BigDecimal shippingFeeDiscountPlatform,
                                     BigDecimal shippingFeeDiscountSeller, BigDecimal voucher,
                                     BigDecimal voucherPlatform, BigDecimal voucherSeller,
                                     BigDecimal cashPaymentFee, String paymentMethod, String voucherCode,
                                     Integer itemsCount, String promisedShippingTimes,
                                     String warehouseCode, String deliveryInfo, String buyerNote,
                                     String remarks, String giftOption, String giftMessage,
                                     String nationalRegistrationNumber1, String branchNumber,
                                     String taxCode, String extraAttributes, String customerFirstName,
                                     String customerLastName, AddressView billingAddress,
                                     AddressView shippingAddress, List<ChannelOrderItemRow> items) {
        ChannelOrderDetail withItems(List<ChannelOrderItemRow> items) {
            return new ChannelOrderDetail(id, channelInstanceId, channelName, channelType,
                    externalOrderId, orderNumber, ownership, statuses, providerCreatedAt,
                    providerUpdatedAt, importedAt, lastSeenAt, price, shippingFee,
                    shippingFeeOriginal, shippingFeeDiscountPlatform, shippingFeeDiscountSeller,
                    voucher, voucherPlatform, voucherSeller, cashPaymentFee, paymentMethod,
                    voucherCode, itemsCount, promisedShippingTimes, warehouseCode, deliveryInfo,
                    buyerNote, remarks, giftOption, giftMessage, nationalRegistrationNumber1,
                    branchNumber, taxCode, extraAttributes, customerFirstName, customerLastName,
                    billingAddress, shippingAddress, items == null ? List.of() : List.copyOf(items));
        }
    }

    public record AddressView(String firstName, String lastName, String phone, String phone2,
                              String address1, String address2, String address3, String address4,
                              String address5, String city, String postCode, String country) {}

    public record ChannelOrderItemRow(UUID id, String externalOrderItemId, String externalOrderId,
                                      String sku, String shopSku, String skuId, String name,
                                      String variation, BigDecimal itemPrice, BigDecimal paidPrice,
                                      String status, String reason, String trackingCode,
                                      String shipmentProvider, String shippingProviderType,
                                      String invoiceNumber, String purchaseOrderId,
                                      String digitalDeliveryInfo, Instant providerCreatedAt,
                                      Instant providerUpdatedAt) {}
}
