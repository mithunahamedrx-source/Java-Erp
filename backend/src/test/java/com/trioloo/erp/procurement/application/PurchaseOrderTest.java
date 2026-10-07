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

/** Purchase Orders - numbering, the approval rule and its Owner exception, the change window, history. Isolated test DB only. */
@SpringBootTest
class PurchaseOrderTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PurchaseOrderService orders;

    private UUID creator;
    private UUID approver;
    private UUID owner;
    private UUID supplierId;
    private UUID itemA;
    private UUID itemB;

    private static final String[] MAKER = {PurchaseOrderService.VIEW, PurchaseOrderService.MANAGE};
    private static final String[] APPROVER = {PurchaseOrderService.VIEW, PurchaseOrderService.APPROVE};

    @BeforeEach
    void setUp() {
        wipe();
        var fixtures = new AccessFixtures(jdbc, passwordEncoder);
        fixtures.clear();
        creator = fixtures.createProfile("po-creator", "x", AccountLifecycleState.ACTIVE);
        approver = fixtures.createProfile("po-approver", "x", AccountLifecycleState.ACTIVE);
        owner = fixtures.createProfile("po-owner", "x", AccountLifecycleState.ACTIVE);
        jdbc.update("UPDATE operational_user_profile SET owner_designated_at = now(), owner_designation_origin = 'INITIAL_BOOTSTRAP' WHERE id = ?", owner);
        supplierId = UUID.randomUUID();
        jdbc.update("INSERT INTO supplier (id, name, currency, created_by, updated_by) VALUES (?, 'Star Tech Ltd', 'BDT', ?, ?)", supplierId, creator, creator);
        itemA = variant("PO-SKU-A", "Intel Core i7-860 Legacy Desktop Processor", "ACTIVE");
        itemB = variant("PO-SKU-B", "Kingston FURY Beast 16GB DDR4", "ACTIVE");
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

    private UUID variant(String sku, String name, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO product_variant (id, inventory_sku, technical_name, unit_of_measure, record_status, created_by, updated_by) VALUES (?, ?, ?, 'pcs', ?, ?, ?)",
                id, sku, name, status, creator, creator);
        return id;
    }

    private void actingAs(UUID actor, String... permissions) {
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actor, "po-user", "PO User", "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }

    private PurchaseOrderService.Input draft(UUID... variants) {
        List<PurchaseOrderService.ItemInput> lines = Arrays.stream(variants)
                .map(v -> new PurchaseOrderService.ItemInput(v, new BigDecimal("4"), new BigDecimal("700.50"), null)).toList();
        return new PurchaseOrderService.Input(supplierId, LocalDate.of(2026, 10, 6), LocalDate.of(2026, 10, 20), null, "SUP-REF-9", lines, null, null, null);
    }

    private UUID approvedOrder() {
        actingAs(creator, MAKER);
        UUID id = orders.create(draft(itemA, itemB));
        actingAs(approver, APPROVER);
        orders.approve(id);
        actingAs(creator, MAKER);
        return id;
    }

    @Test
    @DisplayName("PRC-022 — numbers run forward per year and are never reused, even after a cancellation")
    void numbersAreStableAndNeverReused() {
        actingAs(creator, MAKER);
        UUID first = orders.create(draft(itemA));
        UUID second = orders.create(draft(itemB));
        assertThat(orders.detail(first).order().poNumber()).isEqualTo("PO-2026-0001");
        assertThat(orders.detail(second).order().poNumber()).isEqualTo("PO-2026-0002");

        orders.cancel(second, new PurchaseOrderService.CancelInput("Ordered by mistake", null, null));
        UUID third = orders.create(draft(itemA));
        assertThat(orders.detail(third).order().poNumber()).isEqualTo("PO-2026-0003");
        assertThat(orders.detail(second).order().poNumber()).isEqualTo("PO-2026-0002");
        assertThat(orders.detail(second).order().status()).isEqualTo("CANCELLED");
    }

    @Test
    @DisplayName("A new order is a draft in the supplier's currency; total is quantity x unit cost, never rounded; nothing is received")
    void createDraft() {
        actingAs(creator, MAKER);
        UUID id = orders.create(draft(itemA, itemB));
        var detail = orders.detail(id);
        assertThat(detail.order().status()).isEqualTo("DRAFT");
        assertThat(detail.order().currency()).isEqualTo("BDT");
        assertThat(detail.order().lines()).isEqualTo(2);
        assertThat(detail.order().total()).isEqualByComparingTo("5604.00");
        assertThat(detail.items()).allSatisfy(i -> assertThat(i.quantityReceived()).isEqualByComparingTo("0"));
        assertThat(detail.history()).extracting(PurchaseOrderService.HistoryEntry::action).containsExactly("CREATED");
        // The order is a commitment: it writes no movement and no stock.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement", Integer.class)).isZero();
    }

    @Test
    @DisplayName("Lines are validated: at least one, no archived product, no duplicate, positive quantity, cost to four places")
    void lineValidation() {
        actingAs(creator, MAKER);
        UUID archived = variant("PO-SKU-X", "Old item", "ARCHIVED");
        assertThatThrownBy(() -> orders.create(draft())).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("at least one line");
        assertThatThrownBy(() -> orders.create(draft(itemA, itemA))).hasMessageContaining("two lines");
        assertThatThrownBy(() -> orders.create(draft(archived))).isInstanceOf(IllegalStateException.class).hasMessageContaining("archived");
        assertThatThrownBy(() -> orders.create(new PurchaseOrderService.Input(supplierId, null, null, null, null,
                List.of(new PurchaseOrderService.ItemInput(itemA, BigDecimal.ZERO, BigDecimal.ONE, null)), null, null, null)))
                .hasMessageContaining("above zero");
        assertThatThrownBy(() -> orders.create(new PurchaseOrderService.Input(supplierId, null, null, null, null,
                List.of(new PurchaseOrderService.ItemInput(itemA, BigDecimal.ONE, new BigDecimal("1.23456"), null)), null, null, null)))
                .hasMessageContaining("4 decimal places");
        jdbc.update("UPDATE supplier SET record_status = 'ARCHIVED' WHERE id = ?", supplierId);
        assertThatThrownBy(() -> orders.create(draft(itemA))).isInstanceOf(IllegalStateException.class).hasMessageContaining("not active");
    }

    @Test
    @DisplayName("INV-29.1 — a creator cannot approve their own order; someone else can; the Owner may approve their own (PRC-069), both recorded")
    void approvalRule() {
        actingAs(creator, PurchaseOrderService.VIEW, PurchaseOrderService.MANAGE, PurchaseOrderService.APPROVE);
        UUID own = orders.create(draft(itemA));
        assertThatThrownBy(() -> orders.approve(own)).isInstanceOf(IllegalStateException.class).hasMessageContaining("someone else must approve");

        actingAs(approver, APPROVER);
        orders.approve(own);
        var approved = orders.detail(own);
        assertThat(approved.order().status()).isEqualTo("APPROVED");
        assertThat(jdbc.queryForObject("SELECT approved_by FROM purchase_order WHERE id = ?", UUID.class, own)).isEqualTo(approver);

        actingAs(owner, PurchaseOrderService.VIEW, PurchaseOrderService.MANAGE, PurchaseOrderService.APPROVE);
        UUID ownersOrder = orders.create(draft(itemB));
        orders.approve(ownersOrder);
        assertThat(jdbc.queryForObject("SELECT created_by = approved_by FROM purchase_order WHERE id = ?", Boolean.class, ownersOrder)).isTrue();
        assertThat(orders.detail(ownersOrder).history()).extracting(PurchaseOrderService.HistoryEntry::action).containsExactly("CREATED", "APPROVED");
        assertThat(orders.detail(ownersOrder).history().get(1).detail()).contains("PRC-069");
    }

    @Test
    @DisplayName("Approving needs its own capability, and an order with no draft state or lines cannot be approved twice")
    void approvalNeedsItsOwnCapability() {
        actingAs(creator, MAKER);
        UUID id = orders.create(draft(itemA));
        assertThatThrownBy(() -> orders.approve(id)).isInstanceOf(AccessDeniedByPermissionException.class);
        actingAs(approver, APPROVER);
        orders.approve(id);
        assertThatThrownBy(() -> orders.approve(id)).isInstanceOf(IllegalStateException.class).hasMessageContaining("draft");
        actingAs(approver, PurchaseOrderService.VIEW);
        assertThatThrownBy(() -> orders.create(draft(itemA))).isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("PRC-023/026 — a draft is edited freely; an approved order only with a reason and the supplier's agreement, and the change is logged")
    void amendmentRules() {
        actingAs(creator, MAKER);
        UUID id = orders.create(draft(itemA));
        long v = orders.detail(id).order().version();
        orders.update(id, new PurchaseOrderService.Input(supplierId, null, null, null, "NEW-REF", draft(itemA, itemB).items(), null, null, v));
        assertThat(orders.detail(id).items()).hasSize(2);
        assertThat(orders.detail(id).history()).hasSize(1); // a draft edit is not an amendment

        UUID approved = approvedOrder();
        long av = orders.detail(approved).order().version();
        var lines = List.of(new PurchaseOrderService.ItemInput(itemA, new BigDecimal("10"), new BigDecimal("700"), null));
        assertThatThrownBy(() -> orders.update(approved, new PurchaseOrderService.Input(supplierId, null, null, null, null, lines, null, true, av)))
                .hasMessageContaining("reason");
        assertThatThrownBy(() -> orders.update(approved, new PurchaseOrderService.Input(supplierId, null, null, null, null, lines, "Price renegotiated", false, av)))
                .hasMessageContaining("supplier's agreement");
        orders.update(approved, new PurchaseOrderService.Input(supplierId, null, null, null, null, lines, "Price renegotiated", true, av));
        var after = orders.detail(approved);
        assertThat(after.order().total()).isEqualByComparingTo("7000.00");
        assertThat(after.history()).extracting(PurchaseOrderService.HistoryEntry::action).containsExactly("CREATED", "APPROVED", "AMENDED");
        assertThat(after.history().get(2).reason()).isEqualTo("Price renegotiated");
        assertThat(after.history().get(2).detail()).contains("5604").contains("7000");
        // A stale version is refused.
        assertThatThrownBy(() -> orders.update(approved, new PurchaseOrderService.Input(supplierId, null, null, null, null, lines, "Again", true, av)))
                .hasMessageContaining("changed by someone else");
    }

    @Test
    @DisplayName("PRC-023/024 — once the supplier has shipped (as a person records it) the order can no longer be amended, but it can still be cancelled until goods arrive")
    void changeWindowClosesWhenGoodsMove() {
        UUID id = approvedOrder();
        orders.send(id);
        assertThat(orders.detail(id).order().status()).isEqualTo("SENT");
        assertThat(orders.detail(id).order().amendable()).isTrue();

        orders.recordSupplierShipment(id);
        var shipped = orders.detail(id);
        assertThat(shipped.order().supplierShipped()).isTrue();
        assertThat(shipped.order().amendable()).isFalse();
        assertThatThrownBy(() -> orders.update(id, new PurchaseOrderService.Input(supplierId, null, null, null, null, draft(itemA).items(), "x", true, null)))
                .hasMessageContaining("no longer be amended");
        assertThatThrownBy(() -> orders.recordSupplierShipment(id)).hasMessageContaining("already recorded");
        assertThat(shipped.history()).extracting(PurchaseOrderService.HistoryEntry::action).containsExactly("CREATED", "APPROVED", "SENT", "SUPPLIER_SHIPPED");
        // PRC-071.f (owner decision 2026-10-07): cancelling stays open until goods are RECEIVED, whether or not the supplier shipped.
        assertThat(shipped.order().cancellable()).isTrue();
        orders.cancel(id, new PurchaseOrderService.CancelInput("Changed mind", true, null));
        assertThat(orders.detail(id).order().status()).isEqualTo("CANCELLED");
    }

    @Test
    @DisplayName("Cancelling records why; an approved order also needs the supplier's agreement; the number and history survive")
    void cancellation() {
        UUID id = approvedOrder();
        assertThatThrownBy(() -> orders.cancel(id, new PurchaseOrderService.CancelInput(null, true, null))).hasMessageContaining("why");
        assertThatThrownBy(() -> orders.cancel(id, new PurchaseOrderService.CancelInput("Not needed", false, null))).hasMessageContaining("supplier's agreement");
        orders.cancel(id, new PurchaseOrderService.CancelInput("Not needed", true, null));
        var cancelled = orders.detail(id);
        assertThat(cancelled.order().status()).isEqualTo("CANCELLED");
        assertThat(cancelled.history()).extracting(PurchaseOrderService.HistoryEntry::action).containsExactly("CREATED", "APPROVED", "CANCELLED");
        assertThatThrownBy(() -> orders.cancel(id, new PurchaseOrderService.CancelInput("Again", true, null))).hasMessageContaining("cancelled");
        assertThatThrownBy(() -> orders.send(id)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("The list searches by number, supplier and item, filters, summarises and pages ten at a time")
    void listing() {
        actingAs(creator, MAKER);
        for (int i = 0; i < 12; i++) {
            orders.create(draft(i % 2 == 0 ? itemA : itemB));
        }
        var first = orders.list(null, null, null, null, 0, 10);
        assertThat(first.content()).hasSize(10);
        assertThat(first.totalElements()).isEqualTo(12);
        assertThat(first.kpis().awaitingApproval()).isEqualTo(12);
        assertThat(first.kpis().amendable()).isEqualTo(12);
        assertThat(orders.list(null, null, null, null, 1, 10).content()).hasSize(2);
        assertThat(orders.list("po-2026-0003", null, null, null, 0, 10).content()).hasSize(1);
        assertThat(orders.list("kingston", null, null, null, 0, 10).content()).hasSize(6);
        assertThat(orders.list("star tech", "DRAFT", supplierId, false, 0, 10).totalElements()).isEqualTo(12);
        assertThat(orders.list(null, "APPROVED", null, null, 0, 10).content()).isEmpty();
    }

    @Test
    @DisplayName("No capability sees nothing")
    void gated() {
        actingAs(creator);
        assertThatThrownBy(() -> orders.list(null, null, null, null, 0, 10)).isInstanceOf(AccessDeniedByPermissionException.class);
        assertThatThrownBy(() -> orders.detail(UUID.randomUUID())).isInstanceOf(AccessDeniedByPermissionException.class);
    }
}
