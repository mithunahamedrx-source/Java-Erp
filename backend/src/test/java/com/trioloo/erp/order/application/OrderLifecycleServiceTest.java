package com.trioloo.erp.order.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.delivery.application.ShipmentBookingService;
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

import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cancel and restore — {@code PRM-095}, {@code OM §6.4}, {@code §6.5}, {@code BR-172}.
 */
@SpringBootTest
@DisplayName("Cancel and restore an order")
class OrderLifecycleServiceTest {

    @Autowired
    private OrderLifecycleService lifecycle;
    @Autowired
    private ShipmentBookingService bookings;
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
                """, actorId, "lifecycle-tester-" + actorId, "Lifecycle Tester");
        shopId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', 'ACTIVE', 'BANGLADESH')
                """, shopId, "LIFECYCLE-SHOP-" + shopId, "Lifecycle Shop");
        actingWith(OrderPermissions.ORDER_CANCEL, OrderPermissions.ORDER_RESTORE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
    }

    @Test
    @DisplayName("cancels a pre-dispatch order with a reason, takes authority, and never rewrites the marketplace status")
    void cancelsAndTakesAuthority() {
        UUID id = marketplaceOrder("[\"PENDING_VERIFICATION\"]");

        OrderLifecycleService.Outcome outcome = lifecycle.cancel(id, "CUSTOMER_REQUESTED", "  called us ");

        assertThat(outcome.canonicalStatus()).isEqualTo("CANCELLED");
        // BR-172 / the screen: Daraz is not told, and the operator is.
        assertThat(outcome.marketplaceNote()).contains("not told");
        Map<String, Object> row = row(id);
        assertThat(row.get("effective")).isEqualTo("[\"CANCELLED\"]");
        assertThat(row.get("cancel_reason")).isEqualTo("CUSTOMER_REQUESTED");
        assertThat(row.get("cancel_note")).isEqualTo("called us");
        assertThat(row.get("cancelled_by")).isEqualTo(actorId);
        // BR-169 / BR-174 — meaningful action: ERP_MANAGED, with cause, actor and moment.
        assertThat(row.get("ownership")).isEqualTo("ERP_MANAGED");
        assertThat(row.get("authority_cause")).isEqualTo("CANCELLED_BY_TRIOLOO");
        assertThat(row.get("authority_changed_by")).isEqualTo(actorId);
        // BR-171 — the marketplace mirror is untouched.
        assertThat(row.get("mirror")).isEqualTo("[\"PENDING_VERIFICATION\"]");
    }

    @Test
    @DisplayName("refuses a cancellation without a reason from the vocabulary")
    void requiresAReasonFromTheVocabulary() {
        UUID id = marketplaceOrder("[\"PENDING_VERIFICATION\"]");

        assertThatThrownBy(() -> lifecycle.cancel(id, null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> lifecycle.cancel(id, "BECAUSE", null)).isInstanceOf(IllegalArgumentException.class);
        // BD-035's ninth reason is the marketplace's own act, never a Trioloo choice.
        assertThatThrownBy(() -> lifecycle.cancel(id, "MARKETPLACE_CANCELLED", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("refuses to cancel after dispatch, while a courier shipment is live, or twice")
    void refusesOutsideTheWindow() {
        UUID dispatched = marketplaceOrder("[\"DISPATCHED\"]");
        assertThatThrownBy(() -> lifecycle.cancel(dispatched, "CHANGED_MIND", null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("BR-011");

        UUID booked = marketplaceOrder("[\"READY_TO_SHIP\"]");
        shipment(booked, "BOOKED");
        assertThatThrownBy(() -> lifecycle.cancel(booked, "CHANGED_MIND", null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Steadfast");
        // Once the consignment is cancelled at the courier and tracking records it, cancel is open.
        jdbc.update("UPDATE shipment SET state = 'CANCELLED' WHERE channel_order_id = ?", booked);
        assertThat(lifecycle.cancel(booked, "CHANGED_MIND", null).canonicalStatus()).isEqualTo("CANCELLED");

        assertThatThrownBy(() -> lifecycle.cancel(booked, "CHANGED_MIND", null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("already cancelled");
    }

    @Test
    @DisplayName("restores a marketplace-cancelled order: pending verification, ERP-managed, and the stale cancelled is kept as evidence")
    void restoresAMarketplaceCancelledOrder() {
        UUID id = marketplaceOrder("[\"CANCELLED\"]");
        assertThat(row(id).get("effective")).isEqualTo("[\"CANCELLED\"]");

        OrderLifecycleService.Outcome outcome = lifecycle.restore(id);

        assertThat(outcome.canonicalStatus()).isEqualTo("PENDING_VERIFICATION");
        Map<String, Object> row = row(id);
        // BR-012 — a restored order re-enters verification; nobody is recorded as confirming it (BR-166).
        assertThat(row.get("effective")).isEqualTo("[\"PENDING_VERIFICATION\"]");
        assertThat(row.get("confirmed_by")).isNull();
        // BR-172 — ERP_MANAGED immediately, caused by the restoration.
        assertThat(row.get("ownership")).isEqualTo("ERP_MANAGED");
        assertThat(row.get("authority_cause")).isEqualTo("RESTORED_BY_TRIOLOO");
        assertThat(row.get("restored_by")).isEqualTo(actorId);
        // BR-171 / BR-173 — the marketplace's word is retained, not erased.
        assertThat(row.get("mirror")).isEqualTo("[\"CANCELLED\"]");

        // And a restored order can be booked again, where a cancelled one could not.
        assertThatThrownBy(() -> lifecycle.restore(id)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("a restored order that Trioloo cancelled again reads CANCELLED; restoring once more reverses it (BR-061)")
    void cancelRestoreCancelRestore() {
        UUID id = marketplaceOrder("[\"PENDING_VERIFICATION\"]");
        lifecycle.cancel(id, "DUPLICATE_ORDER", null);
        lifecycle.restore(id);
        assertThat(row(id).get("effective")).isEqualTo("[\"PENDING_VERIFICATION\"]");

        // A second cancellation after the restore wins, because it is the later fact.
        lifecycle.cancel(id, "CHANGED_MIND", null);
        assertThat(row(id).get("effective")).isEqualTo("[\"CANCELLED\"]");
        lifecycle.restore(id);
        assertThat(row(id).get("effective")).isEqualTo("[\"PENDING_VERIFICATION\"]");
    }

    @Test
    @DisplayName("a cancelled order cannot be sent to Steadfast")
    void cancelledOrdersAreNotBooked() {
        UUID id = marketplaceOrder("[\"PENDING_VERIFICATION\"]");
        lifecycle.cancel(id, "CHANGED_MIND", null);
        actingWith(com.trioloo.erp.delivery.application.DeliveryPermissions.SHIPMENT_BOOK);

        assertThatThrownBy(() -> bookings.book(id))
                .isInstanceOf(ShipmentBookingService.ShipmentBookingRefusedException.class)
                .hasMessageContaining("cancelled");
    }

    @Test
    @DisplayName("keeps the two permissions independent and refuses without them")
    void permissionsAreIndependent() {
        UUID id = marketplaceOrder("[\"PENDING_VERIFICATION\"]");

        actingWith(OrderPermissions.ORDER_RESTORE);
        assertThatThrownBy(() -> lifecycle.cancel(id, "CHANGED_MIND", null))
                .isInstanceOf(AccessDeniedByPermissionException.class);

        actingWith(OrderPermissions.ORDER_CANCEL);
        assertThatThrownBy(() -> lifecycle.restore(id)).isInstanceOf(AccessDeniedByPermissionException.class);

        // PRM-091's view and sync grant nothing here.
        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW, OrderPermissions.CHANNEL_ORDER_SYNC);
        assertThatThrownBy(() -> lifecycle.cancel(id, "CHANGED_MIND", null))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("the schema refuses a cancellation with no reason or no actor")
    void schemaRefusesAnUnreasonedCancellation() {
        UUID id = marketplaceOrder("[\"PENDING_VERIFICATION\"]");
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE channel_order SET cancelled_at = now(), cancelled_by = ? WHERE id = ?", actorId, id))
                .hasMessageContaining("channel_order_cancel_consistent");
    }

    /* ------------------------------------------------------------------ fixtures */

    private Map<String, Object> row(UUID id) {
        return jdbc.queryForMap("""
                SELECT ownership, authority_cause, authority_changed_by, cancelled_by, cancel_reason,
                       cancel_note, restored_by, confirmation_mode, confirmed_by,
                       replace(channel_order_effective_statuses(id)::text, ' ', '') AS effective,
                       replace(canonical_statuses_json::text, ' ', '') AS mirror
                  FROM channel_order WHERE id = ?
                """, id);
    }

    private UUID marketplaceOrder(String canonicalJson) {
        UUID id = UUID.randomUUID();
        String ext = "LC-" + id;
        jdbc.update("""
                INSERT INTO channel_order (id, channel_instance_id, external_order_id, order_number,
                    trioloo_invoice_number, ownership, statuses_json, canonical_statuses_json,
                    price, shipping_first_name, shipping_phone, shipping_address1,
                    provider_created_at, imported_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, 'API_MANAGED', '[]'::jsonb, CAST(? AS jsonb), 100.00, 'Rahim',
                        '01700000000', 'Dhaka', now(), now(), now())
                """, id, shopId, ext, ext, "TR" + Math.abs(id.hashCode()), canonicalJson);
        return id;
    }

    private void shipment(UUID orderId, String state) {
        jdbc.update("""
                INSERT INTO shipment (id, channel_order_id, trioloo_invoice_number, state, consignment_id,
                                      recipient_name, recipient_phone, recipient_address, cod_amount)
                VALUES (gen_random_uuid(), ?, ?, ?, ?, 'T', '01700000000', 'Dhaka', 100.00)
                """, orderId, "TR" + Math.abs(orderId.hashCode()), state, "C-" + orderId);
    }

    private void actingWith(String... permissions) {
        var principal = new AccessUserDetails(actorId, "lifecycle-tester", "Lifecycle Tester",
                "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null,
                        Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }

    private void clean() {
        String shops = "(SELECT id FROM channel_instance WHERE code LIKE 'LIFECYCLE-SHOP-%')";
        jdbc.update("DELETE FROM shipment WHERE channel_order_id IN "
                + "(SELECT id FROM channel_order WHERE channel_instance_id IN " + shops + ")");
        jdbc.update("DELETE FROM channel_order_item WHERE channel_order_id IN "
                + "(SELECT id FROM channel_order WHERE channel_instance_id IN " + shops + ")");
        jdbc.update("DELETE FROM channel_order WHERE channel_instance_id IN " + shops);
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'LIFECYCLE-SHOP-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'lifecycle-tester-%'");
    }
}
