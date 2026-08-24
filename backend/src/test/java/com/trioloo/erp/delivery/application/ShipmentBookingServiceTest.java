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

/**
 * Booking a consignment — {@code PRM-092}, {@code BR-023}, {@code STF-013}.
 *
 * <p>🔴 THE CENTRAL TEST HERE IS {@link #refusesASecondBooking}. {@code STF-013} settled by live
 * experiment that <b>Steadfast does NOT enforce {@code invoice} uniqueness</b> — the same payload
 * twice produced two real consignments, two riders and two charges, with no warning. ⚠ Everything
 * that stops that happening to a customer order lives in Trioloo, so it is tested here.
 */
/*
  ⚠ DUMMY CREDENTIALS, AND THEY ARE NOT A SECRET. The transport is stubbed, so nothing reaches
  Steadfast. They exist because SteadfastProperties.require() correctly refuses to act unconfigured
  (STF-003) - and that refusal firing here would test the guard rather than the booking.
  🔴 A real key never enters this repository (DEP-021.b).
*/
@SpringBootTest(properties = {
        "integration.steadfast.api-key=test-key-not-a-secret",
        "integration.steadfast.secret-key=test-secret-not-a-secret"})
@DisplayName("Shipment booking")
class ShipmentBookingServiceTest {

    private static final List<SteadfastTransport.Response> REPLIES = new ArrayList<>();
    private static final List<String> POSTED = new ArrayList<>();

    @TestConfiguration
    static class StubTransport {
        @Bean
        @Primary
        SteadfastTransport steadfastTransport() {
            return new SteadfastTransport() {
                @Override
                public Response get(String url, Map<String, String> headers) {
                    return new Response(200, "{}");
                }

                @Override
                public Response post(String url, String body, Map<String, String> headers) {
                    POSTED.add(body);
                    return REPLIES.isEmpty()
                            ? new Response(200, "{\"consignment\":{\"consignment_id\":1,\"tracking_code\":\"T\"}}")
                            : REPLIES.removeFirst();
                }
            };
        }
    }

    @Autowired
    private ShipmentBookingService bookings;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID orderId;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        REPLIES.clear();
        POSTED.clear();
        clean();
        actorId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                """, actorId, "booking-tester-" + actorId, "Booking Tester",
                Timestamp.from(Instant.now()), Timestamp.from(Instant.now()));
        orderId = seedOrder("TR-BOOK-0001");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
    }

    @Test
    @DisplayName("books once and records the courier's own identifiers")
    void booksOnce() {
        actingWith(DeliveryPermissions.SHIPMENT_BOOK);
        REPLIES.add(new SteadfastTransport.Response(200,
                "{\"status\":200,\"consignment\":{\"consignment_id\":287650820,"
                        + "\"tracking_code\":\"SFR260824STA026172BD\",\"status\":\"in_review\"}}"));

        ShipmentBookingService.Booked booked = bookings.book(orderId);

        assertThat(booked.consignmentId()).isEqualTo("287650820");
        assertThat(booked.trackingCode()).isEqualTo("SFR260824STA026172BD");
        // ⚠ STF-015 — the provider's raw word, retained as received (DLV-037) and NOT translated
        // into SM-4. One observed value is not a vocabulary.
        assertThat(booked.providerStatusRaw()).isEqualTo("in_review");

        assertThat(state(booked.shipmentId())).isEqualTo(ShipmentState.BOOKED.name());
        // ✅ OSC-057 — the Trioloo invoice number is what the courier is given, because it is
        // unique, immutable and never reused (PRN-013, DB-012).
        assertThat(POSTED.getFirst()).contains("\"invoice\":\"TR-BOOK-0001\"");
    }

    @Test
    @DisplayName("🔴 refuses a second booking for the same order")
    void refusesASecondBooking() {
        /*
          🔴 THE TEST THIS CLASS EXISTS FOR. STF-013: sending the same payload to Steadfast twice
          produced consignments 287650820 AND 287650821 — both HTTP 200, both "created
          successfully", nothing in the second response indicating a duplicate. The provider will
          happily dispatch a second rider.

          ⚠ BR-023 as amended allows an order AT MOST ONE ACTIVE shipment. Since the courier does
          not enforce it, this is the only place it can be enforced at all.
        */
        actingWith(DeliveryPermissions.SHIPMENT_BOOK);
        bookings.book(orderId);
        int postsAfterFirst = POSTED.size();

        assertThatThrownBy(() -> bookings.book(orderId))
                .isInstanceOf(ShipmentBookingService.ShipmentAlreadyBookedException.class)
                .hasMessageContaining("BR-023");

        // 🔴 AND THE COURIER WAS NEVER CALLED A SECOND TIME. Refusing after the call would mean a
        // real parcel already exists — the refusal has to happen BEFORE the provider is reached.
        assertThat(POSTED).hasSize(postsAfterFirst);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM shipment WHERE channel_order_id = ?", Integer.class, orderId))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("allows a second shipment once the first has settled")
    void allowsReshipAfterSettlement() {
        /*
          ⚠ BD-442 withdrew CONCURRENCY, not MULTIPLICITY. An RTO'd parcel re-sent IS a second
          shipment, and a rule that blocked it would make a returned order permanently unshippable.
        */
        actingWith(DeliveryPermissions.SHIPMENT_BOOK);
        ShipmentBookingService.Booked first = bookings.book(orderId);

        jdbc.update("UPDATE shipment SET state = ? WHERE id = ?",
                ShipmentState.RETURNED_TO_WAREHOUSE.name(), first.shipmentId());

        // ⚠ The invoice index still binds on a BOOKED consignment, so the re-ship needs its own
        // reference. This asserts the ACTIVE-shipment rule releases, which is the BD-442 point.
        jdbc.update("UPDATE shipment SET consignment_id = NULL WHERE id = ?", first.shipmentId());

        ShipmentBookingService.Booked second = bookings.book(orderId);
        assertThat(second.shipmentId()).isNotEqualTo(first.shipmentId());
    }

    @Test
    @DisplayName("refuses without delivery.shipment.book")
    void requiresThePermission() {
        // 🔴 PRM-004 — the gate is in the application service. PRM-092 makes book, track and
        // cancel independent, so holding `track` grants nothing here.
        actingWith(DeliveryPermissions.SHIPMENT_TRACK);

        assertThatThrownBy(() -> bookings.book(orderId))
                .isInstanceOf(AccessDeniedByPermissionException.class);
        assertThat(POSTED).isEmpty();
    }

    @Test
    @DisplayName("refuses when unauthenticated, and calls no courier")
    void refusesUnauthenticated() {
        assertThatThrownBy(() -> bookings.book(orderId))
                .isInstanceOf(AccessDeniedByPermissionException.class);
        assertThat(POSTED).isEmpty();
    }

    @Test
    @DisplayName("records who booked and when")
    void recordsAttribution() {
        actingWith(DeliveryPermissions.SHIPMENT_BOOK);
        ShipmentBookingService.Booked booked = bookings.book(orderId);

        // ✅ AGV-001 / DLV-011 (P6) — captured AT the authoritative action, never reconstructed
        // from a log. V21's CHECK constraint refuses a moment without an actor.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT booked_by, booked_at FROM shipment WHERE id = ?", booked.shipmentId());
        assertThat(row.get("booked_by")).isEqualTo(actorId);
        assertThat(row.get("booked_at")).isNotNull();
    }

    @Test
    @DisplayName("refuses to book an order that has no Trioloo invoice number")
    void refusesWithoutAnInvoiceNumber() {
        UUID unnumbered = seedOrder(null);
        actingWith(DeliveryPermissions.SHIPMENT_BOOK);

        // ⚠ The invoice is the only thread back from a consignment to an order, and
        // /status_by_invoice is how a lost booking is recovered (STF-013.c).
        assertThatThrownBy(() -> bookings.book(unnumbered))
                .isInstanceOf(ShipmentBookingService.ShipmentBookingRefusedException.class)
                .hasMessageContaining("OSC-057");
        assertThat(POSTED).isEmpty();
    }

    /* ------------------------------------------------------------------ fixtures */

    private String state(UUID shipmentId) {
        return jdbc.queryForObject("SELECT state FROM shipment WHERE id = ?", String.class, shipmentId);
    }

    private UUID seedOrder(String invoiceNumber) {
        // ⚠ Seeds its own shop rather than borrowing one. Other suites delete `channel_instance`
        // rows, and the shared test database keeps that between classes — the same order-dependence
        // that made the first CourierPermissionSeedTest pass alone and fail in a full run.
        UUID instanceId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', 'ACTIVE', 'BANGLADESH')
                """, instanceId, "BOOK-SHOP-" + instanceId, "Booking Test Shop");
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_order (
                    id, channel_instance_id, external_order_id, ownership, statuses_json,
                    canonical_statuses_json, price, customer_first_name, customer_last_name,
                    shipping_phone, shipping_address1, shipping_city, imported_at, last_seen_at)
                VALUES (?, ?, ?, 'API_MANAGED', '[]'::jsonb, '[]'::jsonb, ?, ?, ?, ?, ?, ?, now(), now())
                """, id, instanceId, "BOOK-" + id, new BigDecimal("1500.00"),
                "Booking", "Customer", "01700000000", "House 1, Banani", "Dhaka");
        // ⚠ Set directly: V19's trigger makes the number immutable ONCE SET, and NULL -> value is
        // permitted, which is issuance.
        if (invoiceNumber != null) {
            jdbc.update("UPDATE channel_order SET trioloo_invoice_number = ? WHERE id = ?",
                    invoiceNumber, id);
        }
        return id;
    }

    private void actingWith(String... permissions) {
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new AccessUserDetails(actorId, "booking-tester", "Booking Tester",
                "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }

    private void clean() {
        jdbc.update("DELETE FROM shipment WHERE trioloo_invoice_number LIKE 'TR-BOOK-%' OR trioloo_invoice_number IS NULL");
        jdbc.update("DELETE FROM channel_order_item WHERE external_order_id LIKE 'BOOK-%'");
        jdbc.update("DELETE FROM channel_order WHERE external_order_id LIKE 'BOOK-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'booking-tester-%'");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'BOOK-SHOP-%'");
    }
}
