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
    private OrderAutoConfirmation autoConfirmation;
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
    @DisplayName("confirms the order by policy, records it, and fabricates no human confirmer")
    void confirmsByPolicy() {
        ManualOrderService.Created created = orders.create(order());

        /*
          ✅ Owner decision 2026-10-03 (BR-184): no human verification queue. BR-014 already
          permits it - "not required" is itself a decision, recorded with its reason - so the
          order is CONFIRMED and the decision is on the record.
        */
        assertThat(created.canonicalStatus()).isEqualTo("CONFIRMED");

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT ownership, canonical_statuses_json::text AS canon, statuses_json::text AS raw, "
                        + "confirmation_mode, confirmation_reason, confirmed_at, confirmed_by, "
                        + "channel_order_effective_statuses(id)::text AS effective "
                        + "FROM channel_order WHERE id = ?", created.id());
        // The marketplace-style mirror is left exactly as written (BR-171); the ERP reading is derived.
        assertThat(row.get("canon")).asString().contains("PENDING_VERIFICATION");
        assertThat(row.get("effective")).asString().contains("CONFIRMED")
                .doesNotContain("PENDING_VERIFICATION");
        assertThat(row.get("confirmation_mode")).isEqualTo("AUTO_CONFIRMED");
        assertThat(row.get("confirmation_reason")).isEqualTo("VERIFICATION_NOT_REQUIRED");
        assertThat(row.get("confirmed_at")).isNotNull();
        // 🔴 BR-166 - no human Confirmed By is invented.
        assertThat(row.get("confirmed_by")).isNull();
        // 🔴 BR-168 — a direct-channel order is ERP_MANAGED from creation (no takeover, BR-169).
        assertThat(row.get("ownership")).isEqualTo("ERP_MANAGED");
        // 🔴 BR-171 / SYS-034 — no marketplace said anything, so the external array is EMPTY.
        assertThat(row.get("raw")).isEqualTo("[]");
    }

    @Test
    @DisplayName("the order follows its shipment: booked, delivered, and CANCELLED is never overridden")
    void followsTheShipment() {
        ManualOrderService.Created created = orders.create(order());

        assertThat(effective(created.id())).isEqualTo("[\"CONFIRMED\"]");

        UUID shipment = insertShipment(created, "BOOKED");
        assertThat(effective(created.id())).isEqualTo("[\"COURIER_BOOKED\"]");

        // DLV-025 - the courier is system of record for the parcel's outcome.
        jdbc.update("UPDATE shipment SET state = 'DELIVERED' WHERE id = ?", shipment);
        assertThat(effective(created.id())).isEqualTo("[\"DELIVERED\"]");

        // A shipment state with no ratified Order consequence maps to nothing (DLV-027, SYS-034):
        // the order falls back to its confirmation instead of inventing a reading.
        jdbc.update("UPDATE shipment SET state = 'LOST' WHERE id = ?", shipment);
        assertThat(effective(created.id())).isEqualTo("[\"CONFIRMED\"]");

        // A cancelled parcel is not the order's reading either.
        jdbc.update("UPDATE shipment SET state = 'CANCELLED' WHERE id = ?", shipment);
        assertThat(effective(created.id())).isEqualTo("[\"CONFIRMED\"]");

        // 🔴 A marketplace CANCELLED is never painted over by a shipment (BR-011, OM 6.5).
        jdbc.update("UPDATE shipment SET state = 'IN_TRANSIT' WHERE id = ?", shipment);
        jdbc.update("UPDATE channel_order SET canonical_statuses_json = '[\"CANCELLED\"]'::jsonb "
                + "WHERE id = ?", created.id());
        assertThat(effective(created.id())).isEqualTo("[\"CANCELLED\"]");
    }

    @Test
    @DisplayName("auto-confirmation is idempotent and never moves the first confirmation")
    void autoConfirmationIsIdempotent() {
        ManualOrderService.Created created = orders.create(order());
        Object first = jdbc.queryForObject(
                "SELECT confirmed_at FROM channel_order WHERE id = ?", Object.class, created.id());

        assertThat(autoConfirmation.confirmIfAwaitingVerification(created.id())).isFalse();

        Object after = jdbc.queryForObject(
                "SELECT confirmed_at FROM channel_order WHERE id = ?", Object.class, created.id());
        assertThat(after).isEqualTo(first);
    }

    @Test
    @DisplayName("the schema refuses an automatic confirmation that names a human")
    void schemaRefusesFabricatedConfirmer() {
        ManualOrderService.Created created = orders.create(order());
        UUID someone = actorId;
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE channel_order SET confirmed_by = ? WHERE id = ?", someone, created.id()))
                .hasMessageContaining("channel_order_confirmation_consistent");
    }

    private String effective(UUID orderId) {
        return jdbc.queryForObject(
                "SELECT channel_order_effective_statuses(?)::text", String.class, orderId)
                .replace(" ", "");
    }

    private UUID insertShipment(ManualOrderService.Created created, String state) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO shipment (id, channel_order_id, trioloo_invoice_number, state,
                                      consignment_id, recipient_name, recipient_phone,
                                      recipient_address, cod_amount)
                VALUES (?, ?, ?, ?, ?, 'Test', '01700000000', 'Test address', 100.00)
                """, id, created.id(), created.invoiceNumber(), state, "C-" + id);
        return id;
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
        jdbc.update("DELETE FROM shipment WHERE channel_order_id IN "
                + "(SELECT id FROM channel_order WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'MANUAL-SHOP-%'))");
        jdbc.update("DELETE FROM channel_order_item WHERE channel_order_id IN "
                + "(SELECT id FROM channel_order WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'MANUAL-SHOP-%'))");
        jdbc.update("DELETE FROM channel_order WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'MANUAL-SHOP-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'MANUAL-SHOP-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'manual-tester-%'");
    }
}
