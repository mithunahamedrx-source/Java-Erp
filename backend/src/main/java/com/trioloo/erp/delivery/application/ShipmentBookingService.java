package com.trioloo.erp.delivery.application;

import com.trioloo.erp.delivery.domain.ShipmentState;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastCourierClient;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Books one consignment with the courier — {@code DLV-013}, {@code PRM-092}, {@code BR-023}.
 *
 * <p>🔴 THE ONCE-ONLY GUARANTEE IS THE POINT OF THIS CLASS, AND IT IS NOT A CONVENIENCE.
 * {@code STF-013} settled it with a live test: <b>Steadfast does NOT enforce {@code invoice}
 * uniqueness.</b> The same payload sent twice, seconds apart, produced two distinct consignments —
 * both {@code HTTP 200}, both <em>"created successfully"</em>, with nothing in the second response
 * indicating a duplicate. ⚠ So {@code BR-023}'s <em>at most one ACTIVE shipment</em> cannot be
 * delegated to the provider: the ERP's guarantee is the only one there is.
 *
 * <p>🔴 THE CHECK IS THE DATABASE'S, NOT THIS METHOD'S. {@code V21} carries a unique index on a
 * booked invoice and another on an active shipment per order. ⚠ An application-level
 * "does one already exist?" read would let two concurrent callers both pass it and both dispatch a
 * rider — which is exactly the failure {@code DB-050} names as a correctness requirement
 * independent of technology.
 *
 * <p>🔴 THE RESERVATION IS WRITTEN BEFORE THE COURIER IS CALLED, AND THAT ORDERING IS DELIBERATE.
 * Calling first and inserting afterwards would mean a duplicate is only detected once a second
 * real parcel already exists. ⚠ {@code STF-013.c} — a booking that times out may already have
 * created a consignment, so the safe recovery is to READ, never to re-send.
 */
@Service
public class ShipmentBookingService {

    private final JdbcTemplate jdbc;
    private final SteadfastCourierClient courier;
    private final Clock clock;

    public ShipmentBookingService(JdbcTemplate jdbc, SteadfastCourierClient courier, Clock clock) {
        this.jdbc = jdbc;
        this.courier = courier;
        this.clock = clock;
    }

    /**
     * @throws AccessDeniedByPermissionException without {@code delivery.shipment.book}
     * @throws ShipmentAlreadyBookedException    if this order or invoice already has one
     */
    @Transactional
    public Booked book(UUID channelOrderId) {
        UUID actor = requireBookingAuthority();

        OrderForBooking order = loadOrder(channelOrderId);

        /*
          🔴 THE INVOICE MUST EXIST BEFORE A PARCEL DOES. OSC-057 makes the Trioloo number unique,
          immutable and never reused (PRN-013, DB-012), which is precisely what an external
          idempotency key has to be. ⚠ Booking against a null reference would hand the courier an
          empty `invoice` and destroy the only thread back from a consignment to an order.
        */
        if (order.invoiceNumber() == null || order.invoiceNumber().isBlank()) {
            throw new ShipmentBookingRefusedException(
                    "Order " + channelOrderId + " has no Trioloo invoice number, so there is no "
                            + "reference to book against (OSC-057).");
        }

        Instant now = Instant.now(clock);

        /*
          🔴 CLAIM THE SLOT FIRST. The insert carries no consignment id yet, so the booked-invoice
          index does not bite — but `ux_shipment_one_active_per_order` does, and it is what stops a
          second concurrent caller from ever reaching the courier.
        */
        UUID shipmentId = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO shipment (
                        id, channel_order_id, trioloo_invoice_number, state,
                        recipient_name, recipient_phone, recipient_address, cod_amount,
                        item_description, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    shipmentId, channelOrderId, order.invoiceNumber(), ShipmentState.CREATED.name(),
                    order.recipientName(), order.recipientPhone(), order.recipientAddress(),
                    order.codAmount(), order.itemDescription(),
                    Timestamp.from(now), Timestamp.from(now));
        } catch (DuplicateKeyException e) {
            /*
              ⚠ REFUSED, NOT RETRIED, AND NOT REPORTED AS A SYSTEM FAULT. An order that already has
              an active shipment is a business condition (BR-023), not an error — and the operator
              needs to be told which shipment, not shown a constraint name.
            */
            throw new ShipmentAlreadyBookedException(
                    "Order " + channelOrderId + " already has an active shipment. BR-023 allows at "
                            + "most one, and Steadfast does not enforce this itself (STF-013).");
        }

        SteadfastCourierClient.Booking booking = courier.book(
                new SteadfastCourierClient.BookingRequest(
                        order.invoiceNumber(),
                        order.recipientName(),
                        order.recipientPhone(),
                        order.recipientAddress(),
                        order.codAmount(),
                        null,
                        order.itemDescription()));

        /*
          ✅ AGV-001 / DLV-011 — the actor and the moment are captured AT the authoritative action,
          never reconstructed from a log afterwards.

          ⚠ The provider's raw word is retained as received (DLV-037, AUD-009, SYS-046) and is NOT
          translated: STF-015 observed exactly one value, `in_review`, and one value is not a
          vocabulary. BR-007 and SYS-034 forbid coercing it into an SM-4 state.
        */
        jdbc.update("""
                UPDATE shipment
                   SET state = ?, consignment_id = ?, tracking_code = ?,
                       provider_status_raw = ?, provider_status_seen_at = ?,
                       booked_at = ?, booked_by = ?, updated_at = ?, version = version + 1
                 WHERE id = ?
                """,
                ShipmentState.BOOKED.name(), booking.consignmentId(), booking.trackingCode(),
                booking.providerStatusRaw(), Timestamp.from(now),
                Timestamp.from(now), actor, Timestamp.from(now), shipmentId);

        return new Booked(shipmentId, booking.consignmentId(), booking.trackingCode(),
                booking.providerStatusRaw());
    }

    /**
     * 🔴 {@code PRM-004} — THE GATE IS HERE, IN THE APPLICATION SERVICE, AND NOT IN A CONTROLLER
     * ANNOTATION OR A HIDDEN BUTTON. A hidden control is not an authorisation control.
     *
     * <p>🔴 {@code PRM-089.c} — NO WILDCARD IS ACCEPTED, and {@code PRM-004} forbids a role-name
     * test ever being the security rule.
     */
    private UUID requireBookingAuthority() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(granted -> DeliveryPermissions.SHIPMENT_BOOK.equals(granted.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedByPermissionException(DeliveryPermissions.SHIPMENT_BOOK);
        }
        return actorId(auth);
    }

    private static UUID actorId(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof com.trioloo.erp.access.infrastructure.security.AccessUserDetails details) {
            return details.getProfileId();
        }
        /*
          🔴 AGV-001 — an unattributable booking is refused rather than recorded with a null actor.
          V21's CHECK constraint would reject it anyway; failing here says WHY.
        */
        throw new ShipmentBookingRefusedException(
                "The booking actor could not be identified, and a delivery action must be "
                        + "attributable (AGV-001, DLV-011).");
    }

    private OrderForBooking loadOrder(UUID channelOrderId) {
        return Optional.ofNullable(jdbc.query("""
                SELECT o.trioloo_invoice_number, o.price,
                       coalesce(o.shipping_first_name, o.customer_first_name) AS first_name,
                       coalesce(o.shipping_last_name, o.customer_last_name)  AS last_name,
                       o.shipping_phone,
                       concat_ws(', ', nullif(o.shipping_address1, ''), nullif(o.shipping_address3, ''),
                                 nullif(o.shipping_city, ''), nullif(o.shipping_post_code, '')) AS address,
                       (SELECT i.item_name FROM channel_order_item i
                         WHERE i.channel_order_id = o.id ORDER BY i.imported_at LIMIT 1) AS item_name
                  FROM channel_order o
                 WHERE o.id = ?
                """, rs -> {
            if (!rs.next()) {
                return null;
            }
            String name = ((rs.getString("first_name") == null ? "" : rs.getString("first_name")) + " "
                    + (rs.getString("last_name") == null ? "" : rs.getString("last_name"))).trim();
            BigDecimal price = rs.getBigDecimal("price");
            return new OrderForBooking(
                    rs.getString("trioloo_invoice_number"),
                    name.isEmpty() ? "Customer not recorded" : name,
                    rs.getString("shipping_phone"),
                    rs.getString("address"),
                    // 💰 COD is what the courier is asked to collect. TEC-015 / DB-079 — never a
                    // float, and ZERO is a real amount rather than a stand-in for unknown.
                    price == null ? BigDecimal.ZERO : price,
                    rs.getString("item_name"));
        }, channelOrderId)).orElseThrow(() -> new ShipmentBookingRefusedException(
                "Order " + channelOrderId + " does not exist."));
    }

    private record OrderForBooking(String invoiceNumber, String recipientName, String recipientPhone,
                                   String recipientAddress, BigDecimal codAmount,
                                   String itemDescription) {
    }

    public record Booked(UUID shipmentId, String consignmentId, String trackingCode,
                         String providerStatusRaw) {
    }

    /** ⚠ A business condition under {@code BR-023}, not a system fault. */
    public static class ShipmentAlreadyBookedException extends RuntimeException {
        public ShipmentAlreadyBookedException(String message) {
            super(message);
        }
    }

    public static class ShipmentBookingRefusedException extends RuntimeException {
        public ShipmentBookingRefusedException(String message) {
            super(message);
        }
    }
}
