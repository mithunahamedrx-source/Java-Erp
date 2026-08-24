package com.trioloo.erp.order.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Manual order capture — {@code PRM-093}, {@code OM §22}, {@code BR-168}.
 */
@SpringBootTest
@DisplayName("Manual order capture")
class ManualOrderServiceTest {

    @Autowired
    private ManualOrderService orders;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID shopId;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        clean();
        actorId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, 'ACTIVE', now(), now())
                """, actorId, "manual-tester-" + actorId, "Manual Tester");
        shopId = UUID.randomUUID();
        // ⚠ A DIRECT channel. `channel_instance` already ratifies PHONE alongside DARAZ, and
        // `OM §3.5` calls these the direct channels — so a manual order is a direct-channel
        // order rather than a different entity.
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'PHONE', 'ACTIVE', 'BANGLADESH')
                """, shopId, "MANUAL-SHOP-" + shopId, "Phone Orders");
        actingWith(OrderPermissions.ORDER_CREATE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
    }

    @Test
    @DisplayName("creates the order in PENDING_VERIFICATION and stops there")
    void createsInPendingVerification() {
        ManualOrderService.Created created = orders.create(order());

        /*
          ✅ The product owner's decision, 2026-08-24, and also the state a channel order arrives
          in (OM §7.4, §7.8) - so a manual order and an imported one enter the SAME verification
          queue and no state is skipped because a person typed it.
        */
        assertThat(created.canonicalStatus()).isEqualTo("PENDING_VERIFICATION");

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT ownership, canonical_statuses_json::text AS canon, statuses_json::text AS raw "
                        + "FROM channel_order WHERE id = ?", created.id());
        assertThat(row.get("canon")).asString().contains("PENDING_VERIFICATION");
        // 🔴 BR-168 — a direct-channel order is ERP_MANAGED from creation. There is no marketplace
        // to hold authority over it and no takeover occurs (BR-169).
        assertThat(row.get("ownership")).isEqualTo("ERP_MANAGED");
        // 🔴 BR-171 / SYS-034 — no marketplace said anything about this order, so its external
        // status array is EMPTY rather than carrying a fabricated word.
        assertThat(row.get("raw")).isEqualTo("[]");
    }

    @Test
    @DisplayName("issues a Trioloo invoice number from the one sequence")
    void issuesFromTheOneSequence() {
        ManualOrderService.Created first = orders.create(order());
        ManualOrderService.Created second = orders.create(order());

        // ✅ BD-443 / INV-39.1 — ONE sequence for the whole business, shared with the import path.
        // A manual order does not get a parallel numbering scheme.
        assertThat(first.invoiceNumber()).matches("TR[0-9]{4,}");
        assertThat(second.invoiceNumber()).isNotEqualTo(first.invoiceNumber());
    }

    @Test
    @DisplayName("captures the staff-entered price on the line and never re-derives it")
    void capturesTheStaffPrice() {
        ManualOrderService.Created created = orders.create(order());

        /*
          ✅ PRD-139 — on a manual order STAFF determine the price. BR-145 — it is captured at
          ORDER LINE creation and preserved. 🔴 BR-148 forecloses the dangerous reading: a manual
          price below the Ideal / Recommended Selling Price is NOT a discount, so nothing here
          compares, warns or routes for approval.
        */
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT item_name, item_price, paid_price FROM channel_order_item "
                        + "WHERE channel_order_id = ? ORDER BY external_order_item_id", created.id());
        assertThat(lines).hasSize(2);
        assertThat((BigDecimal) lines.getFirst().get("item_price")).isEqualByComparingTo("1200.50");
        assertThat((BigDecimal) lines.getFirst().get("paid_price")).isEqualByComparingTo("1200.50");
    }

    @Test
    @DisplayName("refuses without order.order.create")
    void requiresThePermission() {
        // 🔴 PRM-004 — enforced in the application service. PRM-091's view and sync grant nothing
        // here: both state outright that neither confers Order mutation.
        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW, OrderPermissions.CHANNEL_ORDER_SYNC);

        assertThatThrownBy(() -> orders.create(order()))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("refuses an order with no shop")
    void requiresAShop() {
        // 🔴 BR-002 — channel type alone is never sufficient attribution; the INSTANCE is named.
        // Settlement arrives per shop and margin differs per shop.
        assertThatThrownBy(() -> orders.create(new ManualOrderService.NewOrder(
                null, "A", "B", "017", "addr", "Dhaka", "COD", null,
                new BigDecimal("10"), List.of(line(1, "X", "10")))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("BR-002");
    }

    @Test
    @DisplayName("refuses an order with no lines, and a negative price")
    void refusesEmptyAndNegative() {
        assertThatThrownBy(() -> orders.create(new ManualOrderService.NewOrder(
                shopId, "A", "B", "017", "addr", "Dhaka", "COD", null,
                BigDecimal.ZERO, List.of())))
                .isInstanceOf(IllegalArgumentException.class);

        // ⚠ ZERO IS PERMITTED AND NEGATIVE IS NOT. A free item is a real business case; a negative
        // price is not a price, and no discount mechanism exists here (BR-148).
        assertThatThrownBy(() -> orders.create(new ManualOrderService.NewOrder(
                shopId, "A", "B", "017", "addr", "Dhaka", "COD", null,
                BigDecimal.ZERO, List.of(line(1, "X", "-5")))))
                .isInstanceOf(IllegalArgumentException.class);

        ManualOrderService.Created free = orders.create(new ManualOrderService.NewOrder(
                shopId, "A", "B", "017", "addr", "Dhaka", "COD", null,
                BigDecimal.ZERO, List.of(line(1, "Free gift", "0"))));
        assertThat(free.invoiceNumber()).isNotBlank();
    }

    @Test
    @DisplayName("appears in the Orders workspace beside imported orders")
    void appearsInTheWorkspace() {
        ManualOrderService.Created created = orders.create(order());

        // ✅ It is a direct-channel order, not a separate entity, so the one workspace shows both.
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_order WHERE id = ? AND channel_instance_id = ?",
                Integer.class, created.id(), shopId)).isEqualTo(1);
    }

    /* ------------------------------------------------------------------ fixtures */

    private ManualOrderService.NewOrder order() {
        return new ManualOrderService.NewOrder(
                shopId, "Rahim", "Uddin", "01700000000", "House 5, Dhanmondi", "Dhaka",
                "Cash on Delivery", "Call before delivery", new BigDecimal("1500.50"),
                List.of(line(1, "Keyboard", "1200.50"), line(2, "Mouse", "300.00")));
    }

    private static ManualOrderService.NewOrderLine line(int number, String name, String price) {
        return new ManualOrderService.NewOrderLine(number, name, null, new BigDecimal(price));
    }

    private void actingWith(String... permissions) {
        var principal = new AccessUserDetails(actorId, "manual-tester", "Manual Tester",
                "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null,
                        Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_order_item WHERE channel_order_id IN "
                + "(SELECT id FROM channel_order WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'MANUAL-SHOP-%'))");
        jdbc.update("DELETE FROM channel_order WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'MANUAL-SHOP-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'MANUAL-SHOP-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'manual-tester-%'");
    }
}
