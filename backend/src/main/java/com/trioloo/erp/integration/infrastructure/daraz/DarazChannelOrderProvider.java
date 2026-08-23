package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.order.application.ChannelOrderImportException;
import com.trioloo.erp.order.application.ChannelOrderItemSnapshot;
import com.trioloo.erp.order.application.ChannelOrderProvider;
import com.trioloo.erp.order.application.ChannelOrderSnapshot;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(prefix = "integration.daraz", name = {"app-key", "app-secret"})
public class DarazChannelOrderProvider implements ChannelOrderProvider {

    static final String ORDERS_GET_PATH = "/orders/get";
    static final String ORDERS_ITEMS_GET_PATH = "/orders/items/get";
    static final String PAGE_SIZE_PARAMETER = "limit";
    private static final String BANGLADESH_REST_BASE = "https://api.daraz.com.bd/rest";

    private final DarazProperties properties;
    private final DarazRequestSigner signer;
    private final DarazTransport transport;
    private final DarazAccessTokenProvider tokens;
    private final ObjectMapper json = new ObjectMapper();

    public DarazChannelOrderProvider(DarazProperties properties,
                                     DarazRequestSigner signer,
                                     DarazTransport transport,
                                     DarazAccessTokenProvider tokens) {
        this.properties = properties;
        this.signer = signer;
        this.transport = transport;
        this.tokens = tokens;
    }

    @Override
    public String channelType() {
        return DarazChannelAdapter.CHANNEL_TYPE;
    }

    @Override
    public Page listOrders(UUID channelInstanceId, Instant createdAfter, Instant createdBefore,
                           int offset, int limit) {
        return read(channelInstanceId, params -> {
            params.put("created_after", createdAfter.toString());
            params.put("created_before", createdBefore.toString());
            params.put("sort_by", "created_at");
            params.put("sort_direction", "ASC");
        }, offset, limit);
    }

    /**
     * The shared {@code /orders/get} read. Only the window parameters differ between the
     * backfill and the incremental poll, and factoring them out is what keeps the signing,
     * paging and item-hydration identical for both.
     */
    private Page read(UUID channelInstanceId, java.util.function.Consumer<Map<String, String>> window,
                      int offset, int limit) {
        String accessToken = tokens.accessTokenFor(channelInstanceId);
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", properties.require().appKey());
        params.put("timestamp", Long.toString(Instant.now().toEpochMilli()));
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("access_token", accessToken);
        window.accept(params);
        params.put("offset", Integer.toString(offset));
        params.put(PAGE_SIZE_PARAMETER, Integer.toString(Math.min(Math.max(limit, 1), 100)));

        String signature = signer.sign(ORDERS_GET_PATH, params, null, properties.require().appSecret());
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(BANGLADESH_REST_BASE + ORDERS_GET_PATH);
        params.forEach(uri::queryParam);
        uri.queryParam(DarazRequestSigner.SIGNATURE_PARAMETER, signature);

        Page page = parseOrders(transport.get(uri.build().encode().toUri()));
        if (page.orders().isEmpty()) {
            return page;
        }
        Map<String, List<ChannelOrderItemSnapshot>> items = fetchItems(accessToken, page.orders());
        return new Page(page.countTotal(), page.count(), page.orders().stream()
                .map(order -> withItems(order, items.getOrDefault(order.externalOrderId(), List.of())))
                .toList());
    }

    /**
     * The Daraz status vocabulary, translated into the canonical one.
     *
     * <p>🔴 THE KEYS ARE THE PROVIDER'S OWN SPELLING AND ARE NOT CORRECTED. {@code DZC-045.c}
     * publishes the set as {@code unpaid}, {@code pending}, {@code canceled},
     * {@code ready_to_ship}, {@code delivered}, {@code returned}, {@code shipped},
     * {@code failed}, and {@code DZC-045.c.i} records that {@code canceled} carries ONE
     * {@code l} — a corrected spelling would simply not match.
     *
     * <p>🔴 EACH ROW PAIRS MEANINGS, NOT NAMES. The canonical side is the state whose §6.2
     * <em>Meaning</em> column says the same thing:
     * <ul>
     *   <li>{@code unpaid}, {@code pending} → {@code PENDING_VERIFICATION} — §7.8 states
     *       outright that marketplace orders <em>"land in Pending Verification"</em>.</li>
     *   <li>{@code ready_to_ship} → {@code READY_TO_SHIP} — <em>"Packed, awaiting carrier
     *       handover"</em>; {@code SMA} §4 records that Daraz normally reaches RTS before
     *       shipment.</li>
     *   <li>{@code shipped} → {@code DISPATCHED} — <em>"Handed to the carrier"</em>.</li>
     *   <li>{@code delivered} → {@code DELIVERED} — <em>"Received by the customer"</em>.</li>
     *   <li>{@code failed} → {@code FAILED_DELIVERY} — <em>"Delivery attempted and failed"</em>.</li>
     *   <li>{@code returned} → {@code RETURNED} — <em>"Goods came back to Trioloo"</em>.</li>
     *   <li>{@code canceled} → {@code CANCELLED} — <em>"Terminated before delivery"</em>; §6.5
     *       governs external cancellation.</li>
     * </ul>
     *
     * <p>🔴 {@code topack} AND {@code toship} ARE DELIBERATELY ABSENT. {@code DZC-050.f} records
     * them as white-list-seller possibilities whose availability this codebase cannot read, so
     * they are never assumed. If one arrives it is retained raw and translated into nothing.
     *
     * <p>⚠ {@code CONFIRMED}, {@code RELEASED}, {@code IN_FULFILLMENT}, {@code ON_HOLD} and
     * {@code CLOSED} have no Daraz counterpart and none is manufactured. They are reached by
     * Trioloo's own acts, which this read-only slice does not perform.
     */
    private static final Map<String, CanonicalOrderStatus> DARAZ_STATUS_TO_CANONICAL = Map.of(
            "unpaid", CanonicalOrderStatus.PENDING_VERIFICATION,
            "pending", CanonicalOrderStatus.PENDING_VERIFICATION,
            "ready_to_ship", CanonicalOrderStatus.READY_TO_SHIP,
            "shipped", CanonicalOrderStatus.DISPATCHED,
            "delivered", CanonicalOrderStatus.DELIVERED,
            "failed", CanonicalOrderStatus.FAILED_DELIVERY,
            "returned", CanonicalOrderStatus.RETURNED,
            "canceled", CanonicalOrderStatus.CANCELLED);

    @Override
    public List<CanonicalOrderStatus> canonicalStatuses(List<String> channelStatuses) {
        if (channelStatuses == null) {
            return List.of();
        }
        List<CanonicalOrderStatus> canonical = new ArrayList<>();
        for (String reported : channelStatuses) {
            if (reported == null || reported.isBlank()) {
                continue;
            }
            CanonicalOrderStatus translated =
                    DARAZ_STATUS_TO_CANONICAL.get(reported.trim().toLowerCase(java.util.Locale.ROOT));
            // An untranslatable value is dropped, never approximated (BR-134, SYS-034). The raw
            // status survives untouched on the order (BR-173), so nothing is lost by declining.
            if (translated != null && !canonical.contains(translated)) {
                canonical.add(translated);
            }
        }
        return List.copyOf(canonical);
    }

    @Override
    public Page listOrdersUpdatedSince(UUID channelInstanceId, Instant updatedAfter, int offset, int limit) {
        // 🔴 DZC-049.c — `update_after` with `updated_at` ordering is what the protocol offers.
        // ⚠ Sorted ASC so paging walks forward through the window deterministically; DZC-049.d
        // records that no opaque cursor exists, so offset paging is the only mechanism.
        return read(channelInstanceId, params -> {
            params.put("update_after", updatedAfter.toString());
            params.put("sort_by", "updated_at");
            params.put("sort_direction", "ASC");
        }, offset, limit);
    }

    private Map<String, List<ChannelOrderItemSnapshot>> fetchItems(
            String accessToken, List<ChannelOrderSnapshot> orders) {
        String orderIds = orders.stream()
                .map(ChannelOrderSnapshot::externalOrderId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.joining(",", "[", "]"));
        if ("[]".equals(orderIds)) {
            return Map.of();
        }
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", properties.require().appKey());
        params.put("timestamp", Long.toString(Instant.now().toEpochMilli()));
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("access_token", accessToken);
        params.put("order_ids", orderIds);

        String signature = signer.sign(ORDERS_ITEMS_GET_PATH, params, null, properties.require().appSecret());
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(BANGLADESH_REST_BASE + ORDERS_ITEMS_GET_PATH);
        params.forEach(uri::queryParam);
        uri.queryParam(DarazRequestSigner.SIGNATURE_PARAMETER, signature);

        return parseItems(transport.get(uri.build().encode().toUri()));
    }

    private Page parseOrders(String body) {
        JsonNode root;
        try {
            root = json.readTree(body == null ? "" : body);
        } catch (Exception e) {
            throw new ChannelOrderImportException("Daraz returned a non-JSON order response.");
        }
        if (!"0".equals(text(root, "code"))) {
            throw new ChannelOrderImportException("Daraz refused the order read with code " + text(root, "code") + ".");
        }
        JsonNode data = root.get("data");
        if (data == null || !data.isObject()) {
            throw new ChannelOrderImportException("Daraz order response has no data node.");
        }
        List<ChannelOrderSnapshot> orders = new ArrayList<>();
        JsonNode nodes = data.get("orders");
        if (nodes != null && nodes.isArray()) {
            for (JsonNode order : nodes) {
                if (order != null && order.isObject()) {
                    orders.add(mapOrder(order));
                }
            }
        }
        return new Page(integer(data, "countTotal"), integer(data, "count"), orders);
    }

    private Map<String, List<ChannelOrderItemSnapshot>> parseItems(String body) {
        JsonNode root;
        try {
            root = json.readTree(body == null ? "" : body);
        } catch (Exception e) {
            throw new ChannelOrderImportException("Daraz returned a non-JSON order-item response.");
        }
        if (!"0".equals(text(root, "code"))) {
            throw new ChannelOrderImportException("Daraz refused the order-item read with code " + text(root, "code") + ".");
        }
        Map<String, List<ChannelOrderItemSnapshot>> items = new HashMap<>();
        collectItems(root.get("data"), null, items);
        return items;
    }

    private void collectItems(JsonNode node, String parentOrderId,
                              Map<String, List<ChannelOrderItemSnapshot>> items) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                collectItems(child, parentOrderId, items);
            }
            return;
        }
        if (!node.isObject()) {
            return;
        }
        String orderId = text(node, "order_id");
        String effectiveOrderId = orderId == null ? parentOrderId : orderId;
        for (String field : List.of("order_items", "items")) {
            JsonNode nested = node.get(field);
            if (nested != null && nested.isArray()) {
                for (JsonNode item : nested) {
                    addItem(item, effectiveOrderId, items);
                }
                return;
            }
        }
        if (node.has("order_item_id")) {
            addItem(node, effectiveOrderId, items);
        }
    }

    private void addItem(JsonNode node, String parentOrderId,
                         Map<String, List<ChannelOrderItemSnapshot>> items) {
        ChannelOrderItemSnapshot item = mapItem(node, parentOrderId);
        if (item.externalOrderId() == null || item.externalOrderItemId() == null) {
            return;
        }
        items.computeIfAbsent(item.externalOrderId(), ignored -> new ArrayList<>()).add(item);
    }

    private ChannelOrderSnapshot mapOrder(JsonNode order) {
        return new ChannelOrderSnapshot(
                text(order, "order_id"),
                text(order, "order_number"),
                instant(order, "created_at"),
                instant(order, "updated_at"),
                decimal(order, "price"),
                decimal(order, "shipping_fee"),
                decimal(order, "shipping_fee_original"),
                decimal(order, "shipping_fee_discount_platform"),
                decimal(order, "shipping_fee_discount_seller"),
                decimal(order, "voucher"),
                decimal(order, "voucher_platform"),
                decimal(order, "voucher_seller"),
                decimal(order, "cash_payment_fee"),
                text(order, "payment_method"),
                text(order, "voucher_code"),
                integerOrNull(order, "items_count"),
                strings(order.get("statuses")),
                text(order, "promised_shipping_times"),
                text(order, "warehouse_code"),
                text(order, "delivery_info"),
                text(order, "buyer_note"),
                text(order, "remarks"),
                text(order, "gift_option"),
                text(order, "gift_message"),
                text(order, "national_registration_number1"),
                text(order, "branch_number"),
                text(order, "tax_code"),
                order.has("extra_attributes") ? order.get("extra_attributes").toString() : null,
                text(order, "customer_first_name"),
                text(order, "customer_last_name"),
                address(order.get("address_billing")),
                address(order.get("address_shipping")),
                List.of());
    }

    private ChannelOrderItemSnapshot mapItem(JsonNode item, String parentOrderId) {
        String orderId = text(item, "order_id");
        return new ChannelOrderItemSnapshot(
                text(item, "order_item_id"),
                orderId == null ? parentOrderId : orderId,
                text(item, "sku"),
                text(item, "shop_sku"),
                text(item, "sku_id"),
                text(item, "name"),
                text(item, "variation"),
                decimal(item, "item_price"),
                decimal(item, "paid_price"),
                text(item, "status"),
                text(item, "reason"),
                text(item, "tracking_code"),
                text(item, "shipment_provider"),
                text(item, "shipping_provider_type"),
                text(item, "invoice_number"),
                text(item, "purchase_order_id"),
                text(item, "digital_delivery_info"),
                instant(item, "created_at"),
                instant(item, "updated_at"));
    }

    private static ChannelOrderSnapshot withItems(
            ChannelOrderSnapshot order, List<ChannelOrderItemSnapshot> items) {
        return new ChannelOrderSnapshot(
                order.externalOrderId(),
                order.orderNumber(),
                order.providerCreatedAt(),
                order.providerUpdatedAt(),
                order.price(),
                order.shippingFee(),
                order.shippingFeeOriginal(),
                order.shippingFeeDiscountPlatform(),
                order.shippingFeeDiscountSeller(),
                order.voucher(),
                order.voucherPlatform(),
                order.voucherSeller(),
                order.cashPaymentFee(),
                order.paymentMethod(),
                order.voucherCode(),
                order.itemsCount(),
                order.statuses(),
                order.promisedShippingTimes(),
                order.warehouseCode(),
                order.deliveryInfo(),
                order.buyerNote(),
                order.remarks(),
                order.giftOption(),
                order.giftMessage(),
                order.nationalRegistrationNumber1(),
                order.branchNumber(),
                order.taxCode(),
                order.extraAttributes(),
                order.customerFirstName(),
                order.customerLastName(),
                order.billingAddress(),
                order.shippingAddress(),
                items);
    }

    private static ChannelOrderSnapshot.AddressSnapshot address(JsonNode node) {
        if (node == null || !node.isObject()) {
            return null;
        }
        return new ChannelOrderSnapshot.AddressSnapshot(
                text(node, "first_name"),
                text(node, "last_name"),
                text(node, "phone"),
                text(node, "phone2"),
                text(node, "address1"),
                text(node, "address2"),
                text(node, "address3"),
                text(node, "address4"),
                text(node, "address5"),
                text(node, "city"),
                text(node, "post_code"),
                text(node, "country"));
    }

    private static List<String> strings(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (JsonNode value : node) {
            String text = value == null ? null : value.asText(null);
            if (text != null && !text.isBlank()) {
                out.add(text);
            }
        }
        return out;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        String text = value == null || value.isNull() ? null : value.asText(null);
        return text == null || text.isBlank() ? null : text;
    }

    private static BigDecimal decimal(JsonNode node, String field) {
        String text = text(node, field);
        if (text == null) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static Instant instant(JsonNode node, String field) {
        String text = text(node, field);
        if (text == null) {
            return null;
        }
        try {
            return Instant.parse(text);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static int integer(JsonNode node, String field) {
        Integer value = integerOrNull(node, field);
        return value == null ? 0 : value;
    }

    private static Integer integerOrNull(JsonNode node, String field) {
        String text = text(node, field);
        if (text == null) {
            return null;
        }
        try {
            return Integer.parseInt(text);
        } catch (RuntimeException e) {
            return null;
        }
    }
}
