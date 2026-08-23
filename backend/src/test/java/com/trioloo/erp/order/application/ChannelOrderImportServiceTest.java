package com.trioloo.erp.order.application;

import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
            };
        }
    }

    @Autowired private ChannelOrderImportService service;
    @Autowired private ChannelConnectionRepository connections;
    @Autowired private JdbcTemplate jdbc;

    private UUID shop;

    @BeforeEach
    void setUp() {
        clean();
        PAGES.clear();
        OFFSETS.clear();
        LIMITS.clear();
        failure = null;
        shop = insertShop("ORDER-IMPORT-A", "ACTIVE");
        connections.save(ChannelConnectionEntity.observed(shop, ConnectionState.CONNECTED, Instant.now()));
    }

    @AfterEach
    void tearDown() {
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

    private static ChannelOrderSnapshot order(String orderId, String itemId) {
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
                List.of("pending"),
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
