package com.trioloo.erp.procurement.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Goods receipts - acceptance writes stock and cost, partial receiving, the separate accept capability, and the cancel window. Isolated test DB only. */
@SpringBootTest
class GoodsReceiptTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PurchaseOrderService orders;
    @Autowired private GoodsReceiptService receipts;

    private UUID creator;
    private UUID approver;
    private UUID supplierId;
    private UUID itemA;

    private static final String[] MAKER = {PurchaseOrderService.VIEW, PurchaseOrderService.MANAGE};
    private static final String[] APPROVER = {PurchaseOrderService.VIEW, PurchaseOrderService.APPROVE};
    private static final String[] RECEIVER = {GoodsReceiptService.VIEW, GoodsReceiptService.RECORD, GoodsReceiptService.ACCEPT, PurchaseOrderService.VIEW};
    private static final String[] RECORD_ONLY = {GoodsReceiptService.VIEW, GoodsReceiptService.RECORD};

    @BeforeEach
    void setUp() {
        wipe();
        var fixtures = new AccessFixtures(jdbc, passwordEncoder);
        fixtures.clear();
        creator = fixtures.createProfile("gr-creator", "x", AccountLifecycleState.ACTIVE);
        approver = fixtures.createProfile("gr-approver", "x", AccountLifecycleState.ACTIVE);
        supplierId = UUID.randomUUID();
        jdbc.update("INSERT INTO supplier (id, name, currency, created_by, updated_by) VALUES (?, 'Star Tech Ltd', 'BDT', ?, ?)", supplierId, creator, creator);
        itemA = UUID.randomUUID();
        jdbc.update("INSERT INTO product_variant (id, inventory_sku, technical_name, unit_of_measure, record_status, created_by, updated_by) VALUES (?, 'GR-SKU-A', 'Intel Core i7-860', 'pcs', 'ACTIVE', ?, ?)",
                itemA, creator, creator);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        wipe();
    }

    private void wipe() {
        jdbc.update("DELETE FROM goods_receipt_item");
        jdbc.update("DELETE FROM goods_receipt");
        jdbc.update("DELETE FROM inventory_movement WHERE movement_type = 'GOODS_RECEIPT_ACCEPTED'");
        jdbc.update("DELETE FROM purchase_order_history");
        jdbc.update("DELETE FROM purchase_order_item");
        jdbc.update("DELETE FROM purchase_order");
        jdbc.update("DELETE FROM document_number_counter");
        jdbc.update("DELETE FROM supplier");
        jdbc.update("DELETE FROM product_variant");
    }

    private void actingAs(UUID actor, String... permissions) {
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actor, "gr-user", "GR User", "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }

    /** An approved order for 10 units at 700.00. */
    private UUID approvedOrder() {
        actingAs(creator, MAKER);
        UUID id = orders.create(new PurchaseOrderService.Input(supplierId, LocalDate.of(2026, 10, 6), null, null, null,
                List.of(new PurchaseOrderService.ItemInput(itemA, new BigDecimal("10"), new BigDecimal("700"), null)), null, null, null));
        actingAs(approver, APPROVER);
        orders.approve(id);
        return id;
    }

    private UUID orderItem(UUID order) {
        return jdbc.queryForObject("SELECT id FROM purchase_order_item WHERE purchase_order_id = ?", UUID.class, order);
    }

    private GoodsReceiptService.Input against(UUID order, String received, String accepted, String cost, String discrepancy) {
        return new GoodsReceiptService.Input(supplierId, order, null, LocalDate.now(), "INV-77", null,
                List.of(new GoodsReceiptService.ItemInput(orderItem(order), itemA, new BigDecimal(received), new BigDecimal(accepted),
                        new BigDecimal(cost), discrepancy, null)));
    }

    private BigDecimal stock() {
        return jdbc.queryForObject("SELECT coalesce(sum(quantity), 0) FROM inventory_movement WHERE product_variant_id = ?", BigDecimal.class, itemA);
    }

    @Test
    @DisplayName("PRC-030/PRC-046 - accepting writes a movement carrying the cost; partial receiving moves the order to partially received, then received")
    void acceptanceWritesStockAndCost() {
        UUID order = approvedOrder();
        actingAs(creator, RECEIVER);
        UUID first = receipts.record(against(order, "6", "6", "700", null));
        assertThat(stock()).isEqualByComparingTo("6");
        assertThat(jdbc.queryForObject("SELECT unit_cost FROM inventory_movement WHERE product_variant_id = ?", BigDecimal.class, itemA)).isEqualByComparingTo("700");
        assertThat(receipts.detail(first).receipt().receiptNumber()).startsWith("GR-");
        assertThat(receipts.detail(first).receipt().acceptedBy()).isNotNull();
        assertThat(jdbc.queryForObject("SELECT status FROM purchase_order WHERE id = ?", String.class, order)).isEqualTo("PARTIALLY_RECEIVED");

        receipts.record(against(order, "4", "4", "710", null));
        assertThat(stock()).isEqualByComparingTo("10");
        assertThat(jdbc.queryForObject("SELECT status FROM purchase_order WHERE id = ?", String.class, order)).isEqualTo("RECEIVED");
        // The order shows what has come in, and the history records both receipts.
        actingAs(creator, MAKER);
        assertThat(orders.detail(order).items().getFirst().quantityReceived()).isEqualByComparingTo("10");
        assertThat(orders.detail(order).history()).extracting(PurchaseOrderService.HistoryEntry::action).contains("RECEIVED");
    }

    @Test
    @DisplayName("PRC-040 - accepted quantity never exceeds what is still to come, and goods not accepted are explained and enter no stock")
    void excessAndIssues() {
        UUID order = approvedOrder();
        actingAs(creator, RECEIVER);
        assertThatThrownBy(() -> receipts.record(against(order, "12", "12", "700", "EXCESS"))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("still to come");
        assertThatThrownBy(() -> receipts.record(against(order, "5", "3", "700", null))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("reason");
        receipts.record(against(order, "2", "0", "700", "DAMAGED"));
        assertThat(stock()).isEqualByComparingTo("0");
        receipts.record(against(order, "12", "10", "700", "EXCESS"));
        assertThat(stock()).isEqualByComparingTo("10");
    }

    @Test
    @DisplayName("PRC-036 - recording and accepting are separate: a person who may only record can record what arrived but accept nothing")
    void acceptIsItsOwnCapability() {
        UUID order = approvedOrder();
        actingAs(creator, RECORD_ONLY);
        assertThatThrownBy(() -> receipts.record(against(order, "3", "3", "700", null))).isInstanceOf(AccessDeniedByPermissionException.class);
        receipts.record(against(order, "3", "0", "700", "SHORTAGE"));
        assertThat(stock()).isEqualByComparingTo("0");
        actingAs(creator, GoodsReceiptService.VIEW);
        assertThatThrownBy(() -> receipts.record(against(order, "1", "0", "700", "DAMAGED"))).isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("PRC-018 - a direct purchase needs no purchase order, and an order that is not approved cannot receive")
    void directPurchaseAndUnapprovedOrder() {
        actingAs(creator, RECEIVER);
        receipts.record(new GoodsReceiptService.Input(supplierId, null, null, LocalDate.now(), null, "walk-in", List.of(
                new GoodsReceiptService.ItemInput(null, itemA, new BigDecimal("5"), new BigDecimal("5"), new BigDecimal("650"), null, null))));
        assertThat(stock()).isEqualByComparingTo("5");

        actingAs(creator, MAKER);
        UUID draft = orders.create(new PurchaseOrderService.Input(supplierId, LocalDate.of(2026, 10, 6), null, null, null,
                List.of(new PurchaseOrderService.ItemInput(itemA, new BigDecimal("2"), new BigDecimal("700"), null)), null, null, null));
        actingAs(creator, RECEIVER);
        assertThatThrownBy(() -> receipts.record(against(draft, "2", "2", "700", null))).isInstanceOf(IllegalStateException.class).hasMessageContaining("approved");
    }

    @Test
    @DisplayName("The purchase search suggests what is bought most: live orders and direct receipts count, cancelled orders do not")
    void popularProducts() {
        UUID kept = approvedOrder();
        actingAs(creator, MAKER);
        UUID cancelled = approvedOrder();
        actingAs(creator, MAKER);
        orders.cancel(cancelled, new PurchaseOrderService.CancelInput("Not needed", true, null));
        actingAs(creator, RECEIVER);
        var popular = orders.popularProducts(10);
        assertThat(popular).hasSize(1);
        assertThat(popular.getFirst().id()).isEqualTo(itemA);
        assertThat(popular.getFirst().purchases()).isEqualTo(1);
        assertThat(popular.getFirst().units()).isEqualByComparingTo("10");
        receipts.record(new GoodsReceiptService.Input(supplierId, null, null, LocalDate.now(), null, null, List.of(
                new GoodsReceiptService.ItemInput(null, itemA, new BigDecimal("3"), new BigDecimal("3"), new BigDecimal("650"), null, null))));
        assertThat(orders.popularProducts(10).getFirst().purchases()).isEqualTo(2);
        actingAs(creator, "procurement.supplier.view");
        assertThatThrownBy(() -> orders.popularProducts(10)).isInstanceOf(AccessDeniedByPermissionException.class);
        assertThat(kept).isNotNull();
    }

    @Test
    @DisplayName("PRC-071.f - an order can be cancelled until goods are received, even after the supplier shipped, and never after")
    void cancelUntilReceived() {
        UUID shipped = approvedOrder();
        actingAs(creator, MAKER);
        orders.recordSupplierShipment(shipped);
        assertThat(orders.detail(shipped).order().cancellable()).isTrue();
        long version = orders.detail(shipped).order().version();
        orders.cancel(shipped, new PurchaseOrderService.CancelInput("Supplier could not deliver", true, version));
        assertThat(jdbc.queryForObject("SELECT status FROM purchase_order WHERE id = ?", String.class, shipped)).isEqualTo("CANCELLED");

        UUID received = approvedOrder();
        actingAs(creator, RECEIVER);
        receipts.record(against(received, "1", "1", "700", null));
        actingAs(creator, MAKER);
        assertThat(orders.detail(received).order().cancellable()).isFalse();
        long v = orders.detail(received).order().version();
        assertThatThrownBy(() -> orders.cancel(received, new PurchaseOrderService.CancelInput("changed my mind", true, v)))
                .isInstanceOf(IllegalStateException.class);
    }
}
