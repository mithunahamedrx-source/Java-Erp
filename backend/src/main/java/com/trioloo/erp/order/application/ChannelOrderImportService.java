package com.trioloo.erp.order.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class ChannelOrderImportService {

    public static final int DEFAULT_PAGE_SIZE = 100;
    private static final String DARAZ = "DARAZ";

    private final JdbcTemplate jdbc;
    private final ChannelInstanceRepository channels;
    private final ChannelConnectionRepository connections;
    private final List<ChannelOrderProvider> providers;
    private final CurrentActor currentActor;
    private final ObjectMapper json = new ObjectMapper();
    private final Clock clock;

    /** {@code BR-181.c} — admitting {@code DRAFT} shops, off by default. See the gate below. */
    private final boolean admitDraftShops;

    public ChannelOrderImportService(JdbcTemplate jdbc,
                                     ChannelInstanceRepository channels,
                                     ChannelConnectionRepository connections,
                                     List<ChannelOrderProvider> providers,
                                     CurrentActor currentActor,
                                     Clock clock,
                                     @org.springframework.beans.factory.annotation.Value(
                                             "${trioloo.order.pull.admit-draft-shops:false}")
                                     boolean admitDraftShops) {
        this.jdbc = jdbc;
        this.channels = channels;
        this.connections = connections;
        this.providers = providers == null ? List.of() : List.copyOf(providers);
        this.currentActor = currentActor;
        this.clock = clock == null ? Clock.systemUTC() : clock;
        this.admitDraftShops = admitDraftShops;
    }

    @Transactional
    public ImportOutcome importWindow(UUID channelInstanceId, Instant createdAfter, Instant createdBefore,
                                      int requestedPageSize) {
        requireSync();
        return readCreatedWindow(channelInstanceId, createdAfter, createdBefore, requestedPageSize);
    }

    /**
     * The creation-window read, performed by the scheduler.
     *
     * <p>🔴 NOT A PERMISSION BYPASS, AND NOT PUBLIC. {@code SMA §5.4} registers {@code EVT-002
     * Order.Imported} as <em>Automatic / Scheduled</em>, performed by the <em>Channel adapter</em>;
     * {@code PRM-091}'s capability gates what an OPERATOR may initiate. This method is
     * package-private and is reachable only from {@link ChannelOrderPullService}, which is the
     * one caller that attributes the run to {@code SYSTEM} ({@code AGV-001}).
     */
    @Transactional
    ImportOutcome importWindowAsSystem(UUID channelInstanceId, Instant createdAfter, Instant createdBefore) {
        return readCreatedWindow(channelInstanceId, createdAfter, createdBefore, DEFAULT_PAGE_SIZE);
    }

    /**
     * The incremental update-watermark read ({@code BR-179.c}), performed by the scheduler.
     *
     * <p>⚠ The caller has already applied the {@code BR-179.d} overlap; this reads the window it
     * is given. Duplicates the overlap produces are absorbed by the {@code order_id} upsert.
     */
    @Transactional
    ImportOutcome importUpdatedSinceAsSystem(UUID channelInstanceId, Instant updatedAfter) {
        ChannelInstanceEntity channel = requireActiveDarazShop(channelInstanceId);
        ChannelOrderProvider provider = providerFor(channel.getChannelType());
        if (updatedAfter == null) {
            throw new ChannelOrderImportException("An update watermark is required.");
        }
        return drain(channelInstanceId, provider, DEFAULT_PAGE_SIZE,
                (offset, size) -> provider.listOrdersUpdatedSince(channelInstanceId, updatedAfter, offset, size));
    }

    private ImportOutcome readCreatedWindow(UUID channelInstanceId, Instant createdAfter,
                                            Instant createdBefore, int requestedPageSize) {
        ChannelInstanceEntity channel = requireActiveDarazShop(channelInstanceId);
        ChannelOrderProvider provider = providerFor(channel.getChannelType());
        Window window = window(createdAfter, createdBefore);
        int pageSize = pageSize(requestedPageSize);
        return drain(channelInstanceId, provider, pageSize,
                (offset, size) -> provider.listOrders(channelInstanceId, window.after(), window.before(), offset, size));
    }

    /**
     * Pages through a provider read, absorbing each page as it arrives.
     *
     * <p>🔴 {@code BR-182.a} — THERE IS NO IN-JOB RETRY LOOP. Against an UNPUBLISHED rate limit
     * ({@code DZC-050.b}), an in-job retry is the behaviour most likely to turn a transient
     * failure into a throttle. ✅ {@code BR-182.b} — nothing is lost by waiting: the next cycle is
     * one cadence away and the read is idempotent by {@code order_id}.
     *
     * <p>🔴 {@code BR-182.c} — PARTIAL SUCCESS IS RETAINED. A failed page never rolls back pages
     * already imported ({@code INV-108.1}); discarding good pages because a later one failed would
     * throw away work the provider may not serve again.
     */
    private ImportOutcome drain(UUID channelInstanceId, ChannelOrderProvider provider,
                                int pageSize, PageReader reader) {

        int offset = 0;
        int pagesRead = 0;
        int ordersSeen = 0;
        int ordersCreated = 0;
        int ordersUpdated = 0;
        int itemsSeen = 0;
        int itemsCreated = 0;
        int itemsUpdated = 0;

        while (true) {
            ChannelOrderProvider.Page page;
            try {
                page = reader.read(offset, pageSize);
            } catch (RuntimeException e) {
                return new ImportOutcome(false, pagesRead, ordersSeen, ordersCreated, ordersUpdated,
                        itemsSeen, itemsCreated, itemsUpdated, "Provider page failed: " + e.getClass().getSimpleName());
            }
            pagesRead++;
            List<ChannelOrderSnapshot> orders = page.orders();
            for (ChannelOrderSnapshot order : orders) {
                Upsert orderResult = upsertOrder(channelInstanceId, order, provider);
                ordersSeen++;
                if (orderResult.created()) {
                    ordersCreated++;
                } else {
                    ordersUpdated++;
                }
                for (ChannelOrderItemSnapshot item : order.items()) {
                    Upsert itemResult = upsertItem(orderResult.id(), item);
                    itemsSeen++;
                    if (itemResult.created()) {
                        itemsCreated++;
                    } else {
                        itemsUpdated++;
                    }
                }
            }

            if (orders.isEmpty() || offset + orders.size() >= page.countTotal()) {
                return new ImportOutcome(true, pagesRead, ordersSeen, ordersCreated, ordersUpdated,
                        itemsSeen, itemsCreated, itemsUpdated, null);
            }
            offset += orders.size();
        }
    }

    private void requireSync() {
        if (currentActor.current().filter(a -> a.hasPermission(OrderPermissions.CHANNEL_ORDER_SYNC)).isEmpty()) {
            throw new AccessDeniedByPermissionException(OrderPermissions.CHANNEL_ORDER_SYNC);
        }
    }

    private ChannelInstanceEntity requireActiveDarazShop(UUID channelInstanceId) {
        if (channelInstanceId == null) {
            throw new ChannelOrderImportException("A channel instance id is required.");
        }
        ChannelInstanceEntity channel = channels.findById(channelInstanceId)
                .orElseThrow(() -> new ChannelOrderImportException("No registered shop with that id."));
        if (!DARAZ.equalsIgnoreCase(channel.getChannelType())) {
            throw new ChannelOrderImportException("This shop is not Daraz.");
        }
        /*
          🔴 THE SAME BR-181 GATE THE SCHEDULER APPLIES, ENFORCED AGAIN HERE.

          ⚠ It is not redundant. The scheduler decides WHICH shops to sweep; this service is also
          reachable directly by an operator, and a gate that lives only in the caller is not a gate.

          ✅ Both read ONE configuration value, so the rule cannot be open in one path and closed in
          the other — which is exactly the defect this comment was written after: widening the
          scheduler alone left this check refusing every DRAFT shop, and the sweep failed on a
          two-minute loop until it was found.
        */
        if (channel.getRecordStatus() != RecordStatus.ACTIVE
                && !(admitDraftShops && channel.getRecordStatus() == RecordStatus.DRAFT)) {
            throw new ChannelOrderImportException("This Daraz shop is not ACTIVE.");
        }
        ConnectionState state = connections.findByChannelInstanceIdIn(List.of(channelInstanceId))
                .stream().map(c -> c.getState()).findFirst().orElse(null);
        if (state != ConnectionState.CONNECTED) {
            throw new ChannelOrderImportException("This Daraz shop is not connected.");
        }
        return channel;
    }

    private ChannelOrderProvider providerFor(String channelType) {
        return providers.stream()
                .filter(p -> p.channelType().equalsIgnoreCase(channelType))
                .findFirst()
                .orElseThrow(() -> new ChannelOrderImportException("No order provider is configured for this shop."));
    }

    private static Window window(Instant createdAfter, Instant createdBefore) {
        if (createdAfter == null || createdBefore == null || !createdBefore.isAfter(createdAfter)) {
            throw new ChannelOrderImportException("A bounded created-time window is required.");
        }
        return new Window(createdAfter, createdBefore);
    }

    private static int pageSize(int requested) {
        if (requested <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(requested, DEFAULT_PAGE_SIZE);
    }

    private Upsert upsertOrder(UUID channelInstanceId, ChannelOrderSnapshot order,
                               ChannelOrderProvider provider) {
        if (order == null || blank(order.externalOrderId())) {
            throw new ChannelOrderImportException("The provider returned an order with no external identity.");
        }
        Instant now = Instant.now(clock);
        // §4.3 / BR-005 - the ADAPTER converts channel status names into canonical ones. This
        // service never inspects a channel's vocabulary and carries no channel-conditional branch.
        List<CanonicalOrderStatus> canonical = provider.canonicalStatuses(order.statuses());
        UUID id = Optional.ofNullable(jdbc.queryForObject("""
                INSERT INTO channel_order (
                    channel_instance_id, external_order_id, order_number, ownership, statuses_json,
                    canonical_statuses_json, dispatch_observed_at,
                    provider_created_at, provider_updated_at, imported_at, last_seen_at,
                    price, shipping_fee, shipping_fee_original, shipping_fee_discount_platform,
                    shipping_fee_discount_seller, voucher, voucher_platform, voucher_seller,
                    cash_payment_fee, payment_method, voucher_code, items_count,
                    promised_shipping_times, warehouse_code, delivery_info, buyer_note, remarks,
                    gift_option, gift_message, national_registration_number1, branch_number, tax_code,
                    extra_attributes, customer_first_name, customer_last_name,
                    billing_first_name, billing_last_name, billing_phone, billing_phone2,
                    billing_address1, billing_address2, billing_address3, billing_address4,
                    billing_address5, billing_city, billing_post_code, billing_country,
                    shipping_first_name, shipping_last_name, shipping_phone, shipping_phone2,
                    shipping_address1, shipping_address2, shipping_address3, shipping_address4,
                    shipping_address5, shipping_city, shipping_post_code, shipping_country
                ) VALUES (
                    ?, ?, ?, 'API_MANAGED', CAST(? AS jsonb),
                    CAST(? AS jsonb), ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                ON CONFLICT (channel_instance_id, external_order_id) DO UPDATE SET
                    order_number = EXCLUDED.order_number,
                    statuses_json = EXCLUDED.statuses_json,
                    canonical_statuses_json = EXCLUDED.canonical_statuses_json,
                    -- Written ONCE, on the first poll that observes DISPATCHED, and never
                    -- rewritten afterwards. COALESCE keeps the earliest observation, so a later
                    -- cycle that still reports DISPATCHED cannot move the moment.
                    dispatch_observed_at = COALESCE(channel_order.dispatch_observed_at,
                                                    EXCLUDED.dispatch_observed_at),
                    provider_created_at = EXCLUDED.provider_created_at,
                    provider_updated_at = EXCLUDED.provider_updated_at,
                    last_seen_at = EXCLUDED.last_seen_at,
                    price = EXCLUDED.price,
                    shipping_fee = EXCLUDED.shipping_fee,
                    shipping_fee_original = EXCLUDED.shipping_fee_original,
                    shipping_fee_discount_platform = EXCLUDED.shipping_fee_discount_platform,
                    shipping_fee_discount_seller = EXCLUDED.shipping_fee_discount_seller,
                    voucher = EXCLUDED.voucher,
                    voucher_platform = EXCLUDED.voucher_platform,
                    voucher_seller = EXCLUDED.voucher_seller,
                    cash_payment_fee = EXCLUDED.cash_payment_fee,
                    payment_method = EXCLUDED.payment_method,
                    voucher_code = EXCLUDED.voucher_code,
                    items_count = EXCLUDED.items_count,
                    promised_shipping_times = EXCLUDED.promised_shipping_times,
                    warehouse_code = EXCLUDED.warehouse_code,
                    delivery_info = EXCLUDED.delivery_info,
                    buyer_note = EXCLUDED.buyer_note,
                    remarks = EXCLUDED.remarks,
                    gift_option = EXCLUDED.gift_option,
                    gift_message = EXCLUDED.gift_message,
                    national_registration_number1 = EXCLUDED.national_registration_number1,
                    branch_number = EXCLUDED.branch_number,
                    tax_code = EXCLUDED.tax_code,
                    extra_attributes = EXCLUDED.extra_attributes,
                    customer_first_name = EXCLUDED.customer_first_name,
                    customer_last_name = EXCLUDED.customer_last_name,
                    billing_first_name = EXCLUDED.billing_first_name,
                    billing_last_name = EXCLUDED.billing_last_name,
                    billing_phone = EXCLUDED.billing_phone,
                    billing_phone2 = EXCLUDED.billing_phone2,
                    billing_address1 = EXCLUDED.billing_address1,
                    billing_address2 = EXCLUDED.billing_address2,
                    billing_address3 = EXCLUDED.billing_address3,
                    billing_address4 = EXCLUDED.billing_address4,
                    billing_address5 = EXCLUDED.billing_address5,
                    billing_city = EXCLUDED.billing_city,
                    billing_post_code = EXCLUDED.billing_post_code,
                    billing_country = EXCLUDED.billing_country,
                    shipping_first_name = EXCLUDED.shipping_first_name,
                    shipping_last_name = EXCLUDED.shipping_last_name,
                    shipping_phone = EXCLUDED.shipping_phone,
                    shipping_phone2 = EXCLUDED.shipping_phone2,
                    shipping_address1 = EXCLUDED.shipping_address1,
                    shipping_address2 = EXCLUDED.shipping_address2,
                    shipping_address3 = EXCLUDED.shipping_address3,
                    shipping_address4 = EXCLUDED.shipping_address4,
                    shipping_address5 = EXCLUDED.shipping_address5,
                    shipping_city = EXCLUDED.shipping_city,
                    shipping_post_code = EXCLUDED.shipping_post_code,
                    shipping_country = EXCLUDED.shipping_country,
                    version = channel_order.version + 1
                RETURNING id
                """, UUID.class,
                channelInstanceId, order.externalOrderId(), order.orderNumber(), statuses(order.statuses()),
                canonicalStatuses(canonical),
                canonical.contains(CanonicalOrderStatus.DISPATCHED) ? ts(now) : null,
                ts(order.providerCreatedAt()), ts(order.providerUpdatedAt()), ts(now), ts(now),
                order.price(), order.shippingFee(), order.shippingFeeOriginal(), order.shippingFeeDiscountPlatform(),
                order.shippingFeeDiscountSeller(), order.voucher(), order.voucherPlatform(), order.voucherSeller(),
                order.cashPaymentFee(), order.paymentMethod(), order.voucherCode(), order.itemsCount(),
                order.promisedShippingTimes(), order.warehouseCode(), order.deliveryInfo(), order.buyerNote(), order.remarks(),
                order.giftOption(), order.giftMessage(), order.nationalRegistrationNumber1(), order.branchNumber(),
                order.taxCode(), order.extraAttributes(), order.customerFirstName(), order.customerLastName(),
                first(order.billingAddress()), last(order.billingAddress()), phone(order.billingAddress()), phone2(order.billingAddress()),
                address1(order.billingAddress()), address2(order.billingAddress()), address3(order.billingAddress()),
                address4(order.billingAddress()), address5(order.billingAddress()), city(order.billingAddress()),
                postCode(order.billingAddress()), country(order.billingAddress()),
                first(order.shippingAddress()), last(order.shippingAddress()), phone(order.shippingAddress()), phone2(order.shippingAddress()),
                address1(order.shippingAddress()), address2(order.shippingAddress()), address3(order.shippingAddress()),
                address4(order.shippingAddress()), address5(order.shippingAddress()), city(order.shippingAddress()),
                postCode(order.shippingAddress()), country(order.shippingAddress()))).orElseThrow();
        issueInvoiceNumber(id);

        return new Upsert(id, jdbc.queryForObject("""
                SELECT version = 0 FROM channel_order WHERE id = ?
                """, Boolean.class, id) == Boolean.TRUE);
    }

    /**
     * Issues the Trioloo invoice number, once, to an order that has none.
     *
     * <p>🔴 {@code PRN-013} / {@code INV-39.1} — ONE sequence, NEVER REUSED, and once issued a
     * number is never regenerated. {@code V19}'s trigger refuses any change at the table, so this
     * method is the ISSUING path rather than the guarantee.
     *
     * <p>🔴 THIS IS A SEPARATE STATEMENT, AND THAT IS THE WHOLE POINT. The obvious
     * implementation — a column {@code DEFAULT nextval(…)} — is wrong here, and expensively so:
     * PostgreSQL evaluates a DEFAULT for the PROPOSED row of an {@code INSERT … ON CONFLICT}
     * BEFORE it discovers the conflict, so every re-import poll of an order that already has a
     * number would still burn a sequence value. At the deployed {@code PT2M} cadence over 158
     * orders that is roughly 113,000 wasted values a day, and the numbering would run away from
     * {@code TR0001} within hours. ⚠ A {@code BEFORE INSERT} trigger has the same defect.
     *
     * <p>✅ {@code nextval} is inside the {@code SET}, so it is evaluated ONLY for a row the
     * {@code WHERE} actually matches. A re-imported order matches nothing and consumes nothing.
     *
     * <p>⚠ NUMBERS ARE ISSUE-ORDERED, NOT DATE-ORDERED, AND THAT IS NOT A DEFECT. {@code V19}
     * backfilled the existing orders oldest to newest; an order imported LATER takes the next
     * number even if the marketplace created it earlier. Re-sorting to keep the sequence in date
     * order would mean reissuing numbers, which {@code DB-012} and the owner's instruction both
     * forbid outright.
     */
    private void issueInvoiceNumber(UUID orderId) {
        jdbc.update("""
                UPDATE channel_order
                   SET trioloo_invoice_number =
                           'TR' || lpad(nextval('trioloo_invoice_number_seq')::text, 4, '0')
                 WHERE id = ?
                   AND trioloo_invoice_number IS NULL
                """, orderId);
    }

    private Upsert upsertItem(UUID orderId, ChannelOrderItemSnapshot item) {
        if (item == null || blank(item.externalOrderItemId())) {
            throw new ChannelOrderImportException("The provider returned an item with no external identity.");
        }
        Instant now = Instant.now(clock);
        UUID id = Optional.ofNullable(jdbc.queryForObject("""
                INSERT INTO channel_order_item (
                    channel_order_id, external_order_item_id, external_order_id, sku, shop_sku, sku_id,
                    item_name, variation, item_price, paid_price, status, reason, tracking_code,
                    shipment_provider, shipping_provider_type, invoice_number, purchase_order_id,
                    digital_delivery_info, provider_created_at, provider_updated_at, imported_at, last_seen_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                ON CONFLICT (channel_order_id, external_order_item_id) DO UPDATE SET
                    external_order_id = EXCLUDED.external_order_id,
                    sku = EXCLUDED.sku,
                    shop_sku = EXCLUDED.shop_sku,
                    sku_id = EXCLUDED.sku_id,
                    item_name = EXCLUDED.item_name,
                    variation = EXCLUDED.variation,
                    item_price = EXCLUDED.item_price,
                    paid_price = EXCLUDED.paid_price,
                    status = EXCLUDED.status,
                    reason = EXCLUDED.reason,
                    tracking_code = EXCLUDED.tracking_code,
                    shipment_provider = EXCLUDED.shipment_provider,
                    shipping_provider_type = EXCLUDED.shipping_provider_type,
                    invoice_number = EXCLUDED.invoice_number,
                    purchase_order_id = EXCLUDED.purchase_order_id,
                    digital_delivery_info = EXCLUDED.digital_delivery_info,
                    provider_created_at = EXCLUDED.provider_created_at,
                    provider_updated_at = EXCLUDED.provider_updated_at,
                    last_seen_at = EXCLUDED.last_seen_at,
                    version = channel_order_item.version + 1
                RETURNING id
                """, UUID.class,
                orderId, item.externalOrderItemId(), item.externalOrderId(), item.sku(), item.shopSku(), item.skuId(),
                item.name(), item.variation(), item.itemPrice(), item.paidPrice(), item.status(), item.reason(),
                item.trackingCode(), item.shipmentProvider(), item.shippingProviderType(), item.invoiceNumber(),
                item.purchaseOrderId(), item.digitalDeliveryInfo(), ts(item.providerCreatedAt()),
                ts(item.providerUpdatedAt()), ts(now), ts(now))).orElseThrow();
        return new Upsert(id, jdbc.queryForObject("""
                SELECT version = 0 FROM channel_order_item WHERE id = ?
                """, Boolean.class, id) == Boolean.TRUE);
    }

    private String statuses(List<String> statuses) {
        try {
            return json.writeValueAsString(statuses == null ? List.of() : statuses);
        } catch (Exception e) {
            throw new IllegalStateException("Order status serialisation failed.");
        }
    }

    /** Serialises canonical statuses by NAME, so the stored value is the ratified vocabulary. */
    private String canonicalStatuses(List<CanonicalOrderStatus> statuses) {
        List<String> names = statuses == null
                ? List.of()
                : statuses.stream().map(CanonicalOrderStatus::name).toList();
        try {
            return json.writeValueAsString(names);
        } catch (Exception e) {
            throw new IllegalStateException("Canonical order status serialisation failed.");
        }
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String first(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.firstName(); }
    private static String last(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.lastName(); }
    private static String phone(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.phone(); }
    private static String phone2(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.phone2(); }
    private static String address1(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.address1(); }
    private static String address2(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.address2(); }
    private static String address3(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.address3(); }
    private static String address4(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.address4(); }
    private static String address5(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.address5(); }
    private static String city(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.city(); }
    private static String postCode(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.postCode(); }
    private static String country(ChannelOrderSnapshot.AddressSnapshot a) { return a == null ? null : a.country(); }

    /** One page read, so the paging, absorption and failure discipline is written once. */
    @FunctionalInterface
    private interface PageReader {
        ChannelOrderProvider.Page read(int offset, int limit);
    }

    private record Window(Instant after, Instant before) {}

    private record Upsert(UUID id, boolean created) {}

    public record ImportOutcome(boolean complete, int pagesRead, int ordersSeen, int ordersCreated,
                                int ordersUpdated, int itemsSeen, int itemsCreated, int itemsUpdated,
                                String failureDetail) {
    }
}
