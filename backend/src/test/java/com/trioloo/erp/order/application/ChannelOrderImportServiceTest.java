package com.trioloo.erp.order.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ChannelOrderImportServiceTest {

    private static final Instant AFTER = Instant.parse("2026-08-01T00:00:00Z");
    private static final Instant BEFORE = Instant.parse("2026-08-08T00:00:00Z");
    private static final List<ChannelOrderProvider.Page> PAGES = new ArrayList<>();
    private static RuntimeException failure;
    private static final List<Integer> OFFSETS = new ArrayList<>();
    private static final List<Integer> LIMITS = new ArrayList<>();

    @TestConfiguration
    static class ProviderConfig {
        @Bean
        ChannelOrderProvider channelOrderImportTestProvider() {
            return new ChannelOrderProvider() {
                @Override
                public String channelType() {
                    return "DARAZ";
                }

                @Override
                public Page listOrders(UUID channelInstanceId, Instant createdAfter, Instant createdBefore,
                                       int offset, int limit) {
                    OFFSETS.add(offset);
                    LIMITS.add(limit);
                    if (failure != null && offset > 0) {
                        throw failure;
                    }
                    int index = OFFSETS.size() - 1;
                    if (index >= PAGES.size()) {
                        return new Page(OFFSETS.size() - 1, 0, List.of());
                    }
                    return PAGES.get(index);
                }

                /**
                 * The incremental read is not exercised by THIS test — it is covered by
                 * {@code ChannelOrderPullServiceTest}, which owns the §29 window rules.
                 */
                @Override
                public Page listOrdersUpdatedSince(UUID channelInstanceId, Instant updatedAfter,
                                                   int offset, int limit) {
                    throw new UnsupportedOperationException(
                            "This fixture covers the creation-window read only.");
                }

                /**
                 * The §4.3 translation step, exercised with the real Daraz vocabulary.
                 *
                 * <p>🔴 The mapping under test belongs to {@code DarazChannelOrderProvider}; this
                 * stub carries only the two values these fixtures use, so the import path's
                 * handling of a canonical status is covered without this test asserting the
                 * adapter's own table.
                 */
                @Override
                public List<CanonicalOrderStatus> canonicalStatuses(List<String> channelStatuses) {
                    if (channelStatuses == null) {
                        return List.of();
                    }
                    List<CanonicalOrderStatus> canonical = new ArrayList<>();
                    for (String reported : channelStatuses) {
                        if ("pending".equalsIgnoreCase(reported)) {
                            canonical.add(CanonicalOrderStatus.PENDING_VERIFICATION);
                        } else if ("shipped".equalsIgnoreCase(reported)) {
                            canonical.add(CanonicalOrderStatus.DISPATCHED);
                        }
                    }
                    return List.copyOf(canonical);
                }
            };
        }
    }

    @Autowired private ChannelOrderImportService service;
    @Autowired private ChannelOrderQueryService queries;
    @Autowired private ChannelConnectionRepository connections;
    @Autowired private JdbcTemplate jdbc;

    private UUID shop;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        clean();
        PAGES.clear();
        OFFSETS.clear();
        LIMITS.clear();
        failure = null;
        actorId = UUID.randomUUID();
        actingWith(OrderPermissions.CHANNEL_ORDER_SYNC);
        shop = insertShop("ORDER-IMPORT-A", "ACTIVE");
        connections.save(ChannelConnectionEntity.observed(shop, ConnectionState.CONNECTED, Instant.now()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
        PAGES.clear();
        OFFSETS.clear();
        LIMITS.clear();
        failure = null;
    }

    @Test
    @DisplayName("imports a Daraz API-managed order header")
    void importsOrderHeader() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-100", "OI-100"))));

        ChannelOrderImportService.ImportOutcome outcome = service.importWindow(shop, AFTER, BEFORE, 100);

        assertThat(outcome.complete()).isTrue();
        assertThat(outcome.pagesRead()).isEqualTo(1);
        assertThat(outcome.ordersSeen()).isEqualTo(1);
        assertThat(outcome.ordersCreated()).isEqualTo(1);
        assertThat(outcome.itemsCreated()).isEqualTo(1);
        assertThat(count("channel_order")).isEqualTo(1);
        assertThat(count("channel_order_item")).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT ownership FROM channel_order WHERE external_order_id = 'O-100'
                """, String.class)).isEqualTo("API_MANAGED");
        assertThat(jdbc.queryForObject("""
                SELECT statuses_json::text FROM channel_order WHERE external_order_id = 'O-100'
                """, String.class)).contains("pending");
        assertThat(jdbc.queryForObject("""
                SELECT price FROM channel_order WHERE external_order_id = 'O-100'
                """, BigDecimal.class)).isEqualByComparingTo("104500.00");
    }

    @Test
    @DisplayName("requires sync permission to import")
    void requiresSyncPermission() {
        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-110", "OI-110"))));

        assertThatThrownBy(() -> service.importWindow(shop, AFTER, BEFORE, 100))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(OrderPermissions.CHANNEL_ORDER_SYNC);
        assertThat(OFFSETS).isEmpty();
        assertThat(count("channel_order")).isZero();
    }

    @Test
    @DisplayName("absorbs a repeated order by channel instance and order id")
    void repeatedImportUpdatesInsteadOfDuplicating() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-200", "OI-200"))));
        service.importWindow(shop, AFTER, BEFORE, 100);
        PAGES.clear();
        OFFSETS.clear();
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-200", "OI-200"))));

        ChannelOrderImportService.ImportOutcome outcome = service.importWindow(shop, AFTER, BEFORE, 100);

        assertThat(outcome.ordersCreated()).isZero();
        assertThat(outcome.ordersUpdated()).isEqualTo(1);
        assertThat(outcome.itemsCreated()).isZero();
        assertThat(outcome.itemsUpdated()).isEqualTo(1);
        assertThat(count("channel_order")).isEqualTo(1);
        assertThat(count("channel_order_item")).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT version FROM channel_order WHERE external_order_id = 'O-200'
                """, Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("paginates by offset and caps page size at 100")
    void paginatesByOffset() {
        PAGES.add(new ChannelOrderProvider.Page(2, 1, List.of(order("O-301", "OI-301"))));
        PAGES.add(new ChannelOrderProvider.Page(2, 1, List.of(order("O-302", "OI-302"))));

        ChannelOrderImportService.ImportOutcome outcome = service.importWindow(shop, AFTER, BEFORE, 200);

        assertThat(outcome.complete()).isTrue();
        assertThat(outcome.ordersSeen()).isEqualTo(2);
        assertThat(OFFSETS).containsExactly(0, 1);
        assertThat(LIMITS).containsExactly(100, 100);
    }

    @Test
    @DisplayName("keeps partial success when a later page fails")
    void keepsPartialSuccessWhenLaterPageFails() {
        PAGES.add(new ChannelOrderProvider.Page(2, 1, List.of(order("O-401", "OI-401"))));
        failure = new IllegalStateException("provider refused");

        ChannelOrderImportService.ImportOutcome outcome = service.importWindow(shop, AFTER, BEFORE, 100);

        assertThat(outcome.complete()).isFalse();
        assertThat(outcome.ordersSeen()).isEqualTo(1);
        assertThat(outcome.failureDetail()).contains("IllegalStateException");
        assertThat(count("channel_order")).isEqualTo(1);
    }

    @Test
    @DisplayName("refuses Draft shops")
    void refusesDraftShop() {
        UUID draft = insertShop("ORDER-IMPORT-DRAFT", "DRAFT");
        connections.save(ChannelConnectionEntity.observed(draft, ConnectionState.CONNECTED, Instant.now()));

        assertThatThrownBy(() -> service.importWindow(draft, AFTER, BEFORE, 100))
                .isInstanceOf(ChannelOrderImportException.class)
                .hasMessageContaining("not ACTIVE");
        assertThat(OFFSETS).isEmpty();
    }

    @Test
    @DisplayName("requires a bounded window")
    void requiresBoundedWindow() {
        assertThatThrownBy(() -> service.importWindow(shop, null, BEFORE, 100))
                .isInstanceOf(ChannelOrderImportException.class)
                .hasMessageContaining("bounded");
        assertThatThrownBy(() -> service.importWindow(shop, BEFORE, AFTER, 100))
                .isInstanceOf(ChannelOrderImportException.class)
                .hasMessageContaining("bounded");
        assertThat(OFFSETS).isEmpty();
    }

    @Test
    @DisplayName("does not touch product, inventory or listing-operation tables")
    void noSideEffectsOutsideOrderMirror() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-500", "OI-500"))));
        long productsBefore = count("sellable_product");
        long variantsBefore = count("product_variant");
        long movementsBefore = count("inventory_movement");
        long listingOperationsBefore = count("channel_listing_operation");

        service.importWindow(shop, AFTER, BEFORE, 100);

        assertThat(count("sellable_product")).isEqualTo(productsBefore);
        assertThat(count("product_variant")).isEqualTo(variantsBefore);
        assertThat(count("inventory_movement")).isEqualTo(movementsBefore);
        assertThat(count("channel_listing_operation")).isEqualTo(listingOperationsBefore);
    }

    @Test
    @DisplayName("lists imported API-managed orders for a viewer")
    void listsImportedOrdersForViewer() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-600", "OI-600"))));
        service.importWindow(shop, AFTER, BEFORE, 100);

        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);
        var page = queries.list(new ChannelOrderQueryService.Filter(shop, null, CanonicalOrderStatus.PENDING_VERIFICATION.name(), "ORD-O-600", null),
                PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().getFirst().externalOrderId()).isEqualTo("O-600");
        assertThat(page.getContent().getFirst().statuses()).containsExactly("pending");
        assertThat(page.getContent().getFirst().ownership()).isEqualTo("API_MANAGED");
    }

    @Test
    @DisplayName("summarises imported orders without inventory or settlement facts")
    void summarisesImportedOrders() {
        PAGES.add(new ChannelOrderProvider.Page(2, 2, List.of(
                order("O-701", "OI-701"),
                order("O-702", "OI-702"))));
        service.importWindow(shop, AFTER, BEFORE, 100);

        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);
        ChannelOrderQueryService.Summary summary =
                queries.summary(new ChannelOrderQueryService.Filter(shop, null, null, null, null));

        assertThat(summary.totalOrders()).isEqualTo(2);
        assertThat(summary.totalItems()).isEqualTo(2);

        // Imported in this run, so both fall on today's Asia/Dhaka business date (TEC-050).
        assertThat(summary.todaysOrders()).isEqualTo(2);

        // 🔴 Neither fixture reports `shipped`, so nothing was ever observed as DISPATCHED and
        // the figure is a REAL zero — not an absence dressed as one.
        assertThat(summary.todaysDispatched()).isZero();

        // 🔴 BR-033 / INV-32.5 — the obligation follows DELIVERED goods. Neither order is
        // delivered, so nothing is collectable, and an undelivered order contributes nothing
        // however large its price.
        assertThat(summary.totalCollectable()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("collects only delivered orders and stamps dispatch observation once")
    void collectableFollowsDeliveredGoodsAndDispatchIsObservedOnce() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-710", "OI-710", "shipped"))));
        service.importWindow(shop, AFTER, BEFORE, 100);

        Instant firstObservation = jdbc.queryForObject("""
                SELECT dispatch_observed_at FROM channel_order WHERE external_order_id = 'O-710'
                """, Instant.class);
        assertThat(firstObservation).isNotNull();

        // A second poll still reporting `shipped` must NOT move the moment the ERP first saw it.
        PAGES.clear();
        OFFSETS.clear();
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-710", "OI-710", "shipped"))));
        service.importWindow(shop, AFTER, BEFORE, 100);

        assertThat(jdbc.queryForObject("""
                SELECT dispatch_observed_at FROM channel_order WHERE external_order_id = 'O-710'
                """, Instant.class)).isEqualTo(firstObservation);

        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);
        ChannelOrderQueryService.Summary summary =
                queries.summary(new ChannelOrderQueryService.Filter(shop, null, null, null, null));

        assertThat(summary.todaysDispatched()).isEqualTo(1);
        // Dispatched is not delivered, so it is not yet collectable (BR-033).
        assertThat(summary.totalCollectable()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("offers a channel filter built from channels that actually have orders")
    void channelFacetIsDerivedFromRealOrders() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-730", "OI-730"))));
        service.importWindow(shop, AFTER, BEFORE, 100);

        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);
        ChannelOrderQueryService.Summary summary =
                queries.summary(new ChannelOrderQueryService.Filter(shop, null, null, null, null));

        // 🔴 The channel filter is built from THIS, never from a hard-coded browser list.
        assertThat(summary.channelTypes()).hasSize(1);
        assertThat(summary.channelTypes().getFirst().channelType()).isEqualTo("DARAZ");
        assertThat(summary.channelTypes().getFirst().orderCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("filters by canonical channel type and keeps the facet intact while filtered")
    void filtersByChannelTypeWithoutErasingTheFacet() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-740", "OI-740"))));
        service.importWindow(shop, AFTER, BEFORE, 100);

        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);
        var matched = queries.list(new ChannelOrderQueryService.Filter(null, "DARAZ", null, null, null),
                PageRequest.of(0, 20));
        assertThat(matched.getTotalElements()).isEqualTo(1);

        var unmatched = queries.list(new ChannelOrderQueryService.Filter(null, "WEBSITE", null, null, null),
                PageRequest.of(0, 20));
        assertThat(unmatched.getTotalElements()).isZero();

        // ⚠ The facet ignores the channel filter on purpose: a control that erased its own other
        // options the moment one was chosen would be unusable.
        ChannelOrderQueryService.Summary filtered =
                queries.summary(new ChannelOrderQueryService.Filter(null, "WEBSITE", null, null, null));
        assertThat(filtered.totalOrders()).isZero();
        assertThat(filtered.channelTypes()).extracting(ChannelOrderQueryService.ChannelTypeFacet::channelType)
                .contains("DARAZ");
    }

    @Test
    @DisplayName("translates the channel status into the canonical mirror without losing the raw one")
    void keepsRawAndCanonicalStatusAsTwoFacts() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-720", "OI-720", "shipped"))));
        service.importWindow(shop, AFTER, BEFORE, 100);

        // BR-173 — the marketplace's own word survives untouched.
        assertThat(jdbc.queryForObject("""
                SELECT statuses_json::text FROM channel_order WHERE external_order_id = 'O-720'
                """, String.class)).contains("shipped");
        // §4.3 / BR-005 — and the adapter's canonical translation sits beside it, not over it.
        assertThat(jdbc.queryForObject("""
                SELECT canonical_statuses_json::text FROM channel_order WHERE external_order_id = 'O-720'
                """, String.class)).contains("DISPATCHED");
    }

    @Test
    @DisplayName("returns detail with items for a viewer")
    void detailReturnsItemsForViewer() {
        PAGES.add(new ChannelOrderProvider.Page(1, 1, List.of(order("O-800", "OI-800"))));
        service.importWindow(shop, AFTER, BEFORE, 100);
        UUID orderId = jdbc.queryForObject("""
                SELECT id FROM channel_order WHERE external_order_id = 'O-800'
                """, UUID.class);

        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);
        ChannelOrderQueryService.ChannelOrderDetail detail = queries.detail(orderId);

        assertThat(detail.externalOrderId()).isEqualTo("O-800");
        assertThat(detail.billingAddress().phone()).isEqualTo("01700000000");
        assertThat(detail.items()).hasSize(1);
        assertThat(detail.items().getFirst().shopSku()).isEqualTo("ELT002-SHOP");
    }

    @Test
    @DisplayName("requires view permission to read imported orders")
    void queryRequiresViewPermission() {
        actingWith(OrderPermissions.CHANNEL_ORDER_SYNC);

        assertThatThrownBy(() -> queries.list(new ChannelOrderQueryService.Filter(null, null, null, null, null),
                PageRequest.of(0, 20)))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(OrderPermissions.CHANNEL_ORDER_VIEW);
    }

    private static ChannelOrderSnapshot order(String orderId, String itemId) {
        return order(orderId, itemId, "pending");
    }

    /** Same fixture with an explicit channel status, so a status-sensitive case can state one. */
    private static ChannelOrderSnapshot order(String orderId, String itemId, String channelStatus) {
        var address = new ChannelOrderSnapshot.AddressSnapshot(
                "Rashedul", "Islam", "01700000000", null, "House 42",
                null, null, null, null, "Dhaka", "1212", "Bangladesh");
        return new ChannelOrderSnapshot(
                orderId,
                "ORD-" + orderId,
                Instant.parse("2026-08-03T10:00:00Z"),
                Instant.parse("2026-08-03T10:30:00Z"),
                new BigDecimal("104500.00"),
                new BigDecimal("80.00"),
                new BigDecimal("100.00"),
                new BigDecimal("10.00"),
                new BigDecimal("10.00"),
                new BigDecimal("0.00"),
                new BigDecimal("0.00"),
                new BigDecimal("0.00"),
                new BigDecimal("0.00"),
                "COD",
                null,
                1,
                List.of(channelStatus),
                "standard",
                "BD-01",
                null,
                "buyer note",
                "remarks",
                "false",
                null,
                null,
                null,
                null,
                "{}",
                "Rashedul",
                "Islam",
                address,
                address,
                List.of(new ChannelOrderItemSnapshot(
                        itemId,
                        orderId,
                        "ELT002",
                        "ELT002-SHOP",
                        "SKU-1",
                        "Intel Core i5 PC",
                        null,
                        new BigDecimal("104500.00"),
                        new BigDecimal("104500.00"),
                        "pending",
                        null,
                        null,
                        null,
                        "STANDARD",
                        null,
                        null,
                        null,
                        Instant.parse("2026-08-03T10:00:00Z"),
                        Instant.parse("2026-08-03T10:30:00Z"))));
    }

    private UUID insertShop(String code, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', ?, 'BANGLADESH')
                """, id, code, code, status);
        return id;
    }

    private long count(String table) {
        Long value = jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
        return value == null ? 0L : value;
    }

    private void actingWith(String... permissions) {
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new AccessUserDetails(actorId, "order-tester", "Order Tester",
                "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void clean() {
        jdbc.update("""
                DELETE FROM channel_order_item WHERE channel_order_id IN (
                    SELECT id FROM channel_order WHERE channel_instance_id IN (
                        SELECT id FROM channel_instance WHERE code LIKE 'ORDER-IMPORT-%'
                    )
                )
                """);
        jdbc.update("""
                DELETE FROM channel_order WHERE channel_instance_id IN (
                    SELECT id FROM channel_instance WHERE code LIKE 'ORDER-IMPORT-%'
                )
                """);
        jdbc.update("""
                DELETE FROM channel_connection WHERE channel_instance_id IN (
                    SELECT id FROM channel_instance WHERE code LIKE 'ORDER-IMPORT-%'
                )
                """);
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'ORDER-IMPORT-%'");
    }
}
