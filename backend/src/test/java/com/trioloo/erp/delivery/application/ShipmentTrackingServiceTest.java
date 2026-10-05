package com.trioloo.erp.delivery.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.delivery.domain.ShipmentState;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastTransport;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "integration.steadfast.api-key=test-key-not-a-secret",
        "integration.steadfast.secret-key=test-secret-not-a-secret"})
@DisplayName("Shipment tracking")
class ShipmentTrackingServiceTest {

    private static final List<SteadfastTransport.Response> REPLIES = new ArrayList<>();
    private static final List<String> GETS = new ArrayList<>();

    @TestConfiguration
    static class StubTransport {
        @Bean
        @Primary
        SteadfastTransport steadfastTransport() {
            return new SteadfastTransport() {
                @Override
                public Response get(String url, Map<String, String> headers) {
                    GETS.add(url);
                    return REPLIES.isEmpty()
                            ? new Response(200, "{\"status\":200,\"consignment_id\":\"123\",\"tracking_code\":\"ABC\",\"delivery_status\":\"in_review\"}")
                            : REPLIES.removeFirst();
                }

                @Override
                public Response post(String url, String body, Map<String, String> headers) {
                    return new Response(200, "{}");
                }
            };
        }
    }

    @Autowired
    private ShipmentTrackingService tracking;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID orderId;
    private UUID shipmentId;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        REPLIES.clear();
        GETS.clear();
        clean();
        actorId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                """, actorId, "tracking-tester-" + actorId, "Tracking Tester",
                Timestamp.from(Instant.now()), Timestamp.from(Instant.now()));
        orderId = seedOrder();
        shipmentId = seedShipment(orderId, ShipmentState.BOOKED);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
    }

    @Test
    @DisplayName("logs a tracking event only when the courier's word changes (V39)")
    void logsTrackingEventsOnChange() {
        actingWith(DeliveryPermissions.SHIPMENT_TRACK);

        tracking.refreshForOrder(orderId);   // in_review: first observation
        tracking.refreshForOrder(orderId);   // in_review again: nothing new
        REPLIES.add(new SteadfastTransport.Response(200,
                "{\"status\":200,\"consignment_id\":\"123\",\"tracking_code\":\"ABC\",\"delivery_status\":\"delivered\"}"));
        tracking.refreshForOrder(orderId);   // delivered: a change

        assertThat(jdbc.queryForList(
                "SELECT provider_status_raw FROM shipment_tracking_event WHERE shipment_id = ? ORDER BY observed_at, id",
                String.class, shipmentId)).containsExactly("in_review", "delivered");
    }

    @Test
    @DisplayName("refreshes the active shipment for an order")
    void refreshesActiveShipmentForOrder() {
        actingWith(DeliveryPermissions.SHIPMENT_TRACK);

        ShipmentTrackingService.Tracked result = tracking.refreshForOrder(orderId);

        assertThat(result.shipmentId()).isEqualTo(shipmentId);
        assertThat(result.providerStatusRaw()).isEqualTo("in_review");
        assertThat(result.translated()).isTrue();
        assertThat(GETS).hasSize(1);
        assertThat(jdbc.queryForObject(
                "SELECT provider_status_raw FROM shipment WHERE id = ?", String.class, shipmentId))
                .isEqualTo("in_review");
    }

    @Test
    @DisplayName("refuses without delivery.shipment.track")
    void requiresTrackPermission() {
        actingWith(DeliveryPermissions.SHIPMENT_BOOK);

        assertThatThrownBy(() -> tracking.refreshForOrder(orderId))
                .isInstanceOf(AccessDeniedByPermissionException.class);
        assertThat(GETS).isEmpty();
    }

    @Test
    @DisplayName("refuses when an order has no active shipment")
    void refusesWithoutActiveShipment() {
        actingWith(DeliveryPermissions.SHIPMENT_TRACK);
        jdbc.update("UPDATE shipment SET state = ? WHERE id = ?",
                ShipmentState.RETURNED_TO_WAREHOUSE.name(), shipmentId);

        assertThatThrownBy(() -> tracking.refreshForOrder(orderId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no active shipment");
        assertThat(GETS).isEmpty();
    }

    private UUID seedOrder() {
        UUID instanceId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', 'ACTIVE', 'BANGLADESH')
                """, instanceId, "TRACK-SHOP-" + instanceId, "Tracking Test Shop");
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_order (
                    id, channel_instance_id, external_order_id, ownership, statuses_json,
                    canonical_statuses_json, price, customer_first_name, shipping_phone,
                    shipping_address1, imported_at, last_seen_at, trioloo_invoice_number)
                VALUES (?, ?, ?, 'API_MANAGED', '[]'::jsonb, '[]'::jsonb, ?, ?, ?, ?, now(), now(), ?)
                """, id, instanceId, "TRACK-" + id, new BigDecimal("1500.00"),
                "Tracking Customer", "01700000000", "House 1, Dhaka", "TR-TRACK-0001");
        return id;
    }

    private UUID seedShipment(UUID orderId, ShipmentState state) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO shipment (
                    id, channel_order_id, trioloo_invoice_number, state,
                    recipient_name, recipient_phone, recipient_address, cod_amount,
                    item_description, consignment_id, tracking_code, created_at, updated_at)
                VALUES (?, ?, 'TR-TRACK-0001', ?, 'Tracking Customer', '01700000000',
                        'House 1, Dhaka', ?, 'Test item', 'C123', 'OLD', now(), now())
                """, id, orderId, state.name(), new BigDecimal("1500.00"));
        return id;
    }

    private void actingWith(String... permissions) {
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new AccessUserDetails(actorId, "tracking-tester", "Tracking Tester",
                "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }

    private void clean() {
        jdbc.update("DELETE FROM shipment WHERE trioloo_invoice_number LIKE 'TR-TRACK-%'");
        jdbc.update("DELETE FROM channel_order WHERE external_order_id LIKE 'TRACK-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'tracking-tester-%'");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'TRACK-SHOP-%'");
    }
}