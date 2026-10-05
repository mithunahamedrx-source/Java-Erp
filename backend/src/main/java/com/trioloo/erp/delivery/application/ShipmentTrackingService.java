package com.trioloo.erp.delivery.application;

import com.trioloo.erp.delivery.domain.ShipmentState;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastCourierClient;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastDeliveryStatus;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Refreshes one shipment's status from the courier — {@code PRM-092}, {@code DLV-031},
 * {@code DLV-025}.
 *
 * <p>🔴 THE COURIER IS SYSTEM OF RECORD FOR OUTCOME ({@code DLV-025}), SO THIS RECORDS AND NEVER
 * COMPUTES. Nothing here infers a state from elapsed time, from the previous state, or from what
 * "should" have happened next.
 *
 * <p>🔴 IT IS A PULL, AND PULL IS ONLY ONE OF THE THREE MECHANISMS {@code DLV-031} REQUIRES.
 * ⚠ Push is not built because {@code STF} found no webhook evidence at all, and manual entry has
 * no surface yet. Both remain owed.
 *
 * <p>⚠ THE RAW PROVIDER WORD IS ALWAYS STORED, WHETHER OR NOT IT TRANSLATES ({@code DLV-037},
 * {@code AUD-009}, {@code SYS-046} — raw courier status retained as received). An untranslatable
 * status still tells the operator exactly what the courier said.
 */
@Service
public class ShipmentTrackingService {

    private static final Logger log = LoggerFactory.getLogger(ShipmentTrackingService.class);

    private final JdbcTemplate jdbc;
    private final SteadfastCourierClient courier;
    private final Clock clock;

    private final com.trioloo.erp.order.application.OrderWritebackService writeback;

    public ShipmentTrackingService(JdbcTemplate jdbc, SteadfastCourierClient courier, Clock clock,
                                   com.trioloo.erp.order.application.OrderWritebackService writeback) {
        this.jdbc = jdbc;
        this.courier = courier;
        this.clock = clock;
        this.writeback = writeback;
    }

    /**
     * Resolves the currently active shipment from an order card/detail action, then refreshes it.
     * BR-023 allows at most one active shipment per order, so this endpoint has one visible target.
     */
    @Transactional
    public Tracked refreshForOrder(UUID channelOrderId) {
        requireTrackingAuthority();
        UUID shipmentId = Optional.ofNullable(jdbc.query("""
                SELECT id
                  FROM shipment
                 WHERE channel_order_id = ?
                   AND state NOT IN (?, ?, ?, ?, ?)
                 ORDER BY created_at DESC
                 LIMIT 1
                """, rs -> rs.next() ? (UUID) rs.getObject("id") : null,
                channelOrderId,
                ShipmentState.DELIVERED.name(),
                ShipmentState.RETURNED_TO_WAREHOUSE.name(),
                ShipmentState.LOST.name(),
                ShipmentState.DAMAGED.name(),
                ShipmentState.CANCELLED.name()))
                .orElseThrow(() -> new IllegalArgumentException(
                        "Order " + channelOrderId + " has no active shipment to track."));
        return refreshLoaded(shipmentId);
    }

    @Transactional
    public Tracked refresh(UUID shipmentId) {
        requireTrackingAuthority();

        return refreshLoaded(shipmentId);
    }

    /**
     * The scheduled pull's entry point — a NAMED SYSTEM ACTOR, not a person ({@code BR-059}).
     *
     * <p>🔴 Only {@link ShipmentTrackingScheduler} calls it; no controller exposes it, so it is not
     * a way around {@code delivery.shipment.track} for a human caller ({@code PRM-004}).
     */
    @Transactional
    public Tracked refreshAsSystem(UUID shipmentId) {
        return refreshLoaded(shipmentId);
    }

    /**
     * Shipments the courier still owns the outcome of: booked and not yet in a settled state.
     *
     * <p>⚠ {@code CREATED} rows are excluded — a claimed slot with no consignment has nothing to
     * read, and {@code STF-007} makes a status read of an unknown invoice indistinguishable from a
     * foreign one.
     */
    @Transactional(readOnly = true)
    public java.util.List<UUID> activeBookedShipmentIds() {
        return jdbc.query("""
                SELECT id
                  FROM shipment
                 WHERE consignment_id IS NOT NULL
                   AND state NOT IN (?, ?, ?, ?, ?)
                 ORDER BY updated_at ASC
                """, (rs, n) -> (UUID) rs.getObject("id"),
                ShipmentState.DELIVERED.name(), ShipmentState.RETURNED_TO_WAREHOUSE.name(),
                ShipmentState.LOST.name(), ShipmentState.DAMAGED.name(),
                ShipmentState.CANCELLED.name());
    }

    private Tracked refreshLoaded(UUID shipmentId) {
        Shipment shipment = load(shipmentId);
        if (shipment.invoiceNumber() == null) {
            throw new IllegalStateException(
                    "Shipment " + shipmentId + " carries no invoice reference to track by.");
        }

        Optional<SteadfastCourierClient.ConsignmentStatus> reported =
                courier.statusByInvoice(shipment.invoiceNumber());

        if (reported.isEmpty()) {
            /*
              🔴 NOT FOUND IS NOT AN ERROR AND IS NOT A STATE CHANGE. STF-007 — Steadfast answers
              401 for a consignment that is not ours OR does not exist, using a valid credential.
              ⚠ Writing anything here would let a lookup failure move a real shipment's state.
            */
            return new Tracked(shipmentId, shipment.state(), null, false,
                    "The courier returned no status for this invoice. Nothing was changed.");
        }

        String raw = reported.get().deliveryStatus();
        Instant now = Instant.now(clock);

        if (raw != null && !SteadfastDeliveryStatus.isPublishedValue(raw)) {
            /*
              ⚠ A VALUE OUTSIDE THE PROVIDER'S OWN PUBLISHED VOCABULARY IS A DIFFERENT AND MORE
              INTERESTING FACT than a deliberate refusal - the provider has changed something. It
              is logged once, with the value, because the value is not sensitive and knowing it is
              how the mapping gets extended correctly rather than guessed at.
            */
            log.warn("Steadfast reported delivery_status '{}', which is outside its published "
                    + "vocabulary. It is stored raw and left untranslated (STF-011, BR-007).", raw);
        }

        Optional<ShipmentState> translated = SteadfastDeliveryStatus.toShipmentState(raw);

        translated.ifPresentOrElse(
                state -> jdbc.update("""
                        UPDATE shipment
                           SET state = ?, provider_status_raw = ?, provider_status_seen_at = ?,
                               tracking_code = coalesce(?, tracking_code),
                               consignment_id = coalesce(consignment_id, ?),
                               updated_at = ?, version = version + 1
                         WHERE id = ?
                        """, state.name(), raw, Timestamp.from(now),
                        reported.get().trackingCode(), reported.get().consignmentId(),
                        Timestamp.from(now), shipmentId),
                /*
                  🔴 THE RAW WORD IS STILL RECORDED WHEN THE STATE IS NOT. DLV-037 requires the
                  courier's status retained as received, and an operator who can see
                  "the courier says: pending" is better served than one shown a stale state with
                  no explanation.
                */
                () -> jdbc.update("""
                        UPDATE shipment
                           SET provider_status_raw = ?, provider_status_seen_at = ?,
                               tracking_code = coalesce(?, tracking_code),
                               updated_at = ?, version = version + 1
                         WHERE id = ?
                        """, raw, Timestamp.from(now), reported.get().trackingCode(),
                        Timestamp.from(now), shipmentId));

        /*
          V39 - an event is logged when the courier's word CHANGES (or none was logged yet), so a sweep that
          finds the same status every fifteen minutes adds nothing. The raw word is kept as received.
        */
        jdbc.update("""
                INSERT INTO shipment_tracking_event (shipment_id, observed_at, event_type, provider_status_raw, shipment_state)
                SELECT ?, ?, 'STATUS', ?, ?
                 WHERE NOT EXISTS (
                        SELECT 1 FROM shipment_tracking_event e
                         WHERE e.shipment_id = ?
                           AND e.provider_status_raw IS NOT DISTINCT FROM ?
                           AND e.id = (SELECT id FROM shipment_tracking_event
                                        WHERE shipment_id = ? ORDER BY observed_at DESC, id DESC LIMIT 1))
                """, shipmentId, Timestamp.from(now), raw, translated.map(Enum::name).orElse(null),
                shipmentId, raw, shipmentId);

        /*
          ✅ SM-4 PICKED_UP "Emit Order.Dispatched" (STATE_MACHINE_ARCHITECTURE 8.6). The ERP's own
          first observation of the order in flight is written ONCE and never rewritten
          (OSC-053.c) - it feeds "Today's dispatched". Only states that mean the parcel has left
          Trioloo count; BOOKED does not.
        */
        translated.filter(ShipmentTrackingService::inFlight).ifPresent(state -> jdbc.update("""
                UPDATE channel_order
                   SET dispatch_observed_at = coalesce(dispatch_observed_at, ?)
                 WHERE id = (SELECT channel_order_id FROM shipment WHERE id = ?)
                """, Timestamp.from(now), shipmentId));

        /*
          BR-202 - a website order follows its parcel: in flight -> SHIPPED, delivered -> DELIVERED. Only on a CHANGE of
          state (a sweep that finds the same word writes nothing), and best effort: the courier's word is already
          recorded, so a refused write is logged and never undoes it. States the site has no word for are skipped.
        */
        translated.filter(state -> !state.name().equals(shipment.state())).ifPresent(state -> {
            com.trioloo.erp.order.domain.CanonicalOrderStatus target = inFlight(state)
                    ? com.trioloo.erp.order.domain.CanonicalOrderStatus.DISPATCHED
                    : state == ShipmentState.DELIVERED ? com.trioloo.erp.order.domain.CanonicalOrderStatus.DELIVERED : null;
            if (target != null) {
                UUID orderId = jdbc.queryForObject("SELECT channel_order_id FROM shipment WHERE id = ?", UUID.class, shipmentId);
                writeback.publish(orderId, target, target == com.trioloo.erp.order.domain.CanonicalOrderStatus.DELIVERED
                        ? "marked delivered" : "marked shipped");
            }
        });

        return new Tracked(
                shipmentId,
                translated.map(Enum::name).orElse(shipment.state()),
                raw,
                translated.isPresent(),
                translated.isPresent()
                        ? null
                        : SteadfastDeliveryStatus.refusalReason(raw).orElse(
                                "The courier reported a status outside its published vocabulary."));
    }

    /**
     * 🔴 {@code PRM-004} — enforced here, in the application service.
     *
     * <p>⚠ {@code PRM-092.b} makes book, track and cancel INDEPENDENT. Holding
     * {@code delivery.shipment.book} grants nothing here, and that is not pedantry: tracking is a
     * read a call-centre operator legitimately needs while booking spends money.
     */
    private void requireTrackingAuthority() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> DeliveryPermissions.SHIPMENT_TRACK.equals(g.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedByPermissionException(DeliveryPermissions.SHIPMENT_TRACK);
        }
    }

    private static boolean inFlight(ShipmentState state) {
        return state == ShipmentState.PICKED_UP || state == ShipmentState.IN_TRANSIT
                || state == ShipmentState.AT_HUB || state == ShipmentState.OUT_FOR_DELIVERY;
    }

    private Shipment load(UUID shipmentId) {
        return Optional.ofNullable(jdbc.query("""
                SELECT trioloo_invoice_number, state FROM shipment WHERE id = ?
                """, rs -> rs.next()
                        ? new Shipment(rs.getString("trioloo_invoice_number"), rs.getString("state"))
                        : null,
                shipmentId))
                .orElseThrow(() -> new IllegalArgumentException("Shipment " + shipmentId + " does not exist."));
    }

    private record Shipment(String invoiceNumber, String state) {
    }

    /**
     * @param translated {@code false} where the courier's word has no honest {@code SM-4} reading.
     * @param note       why it was not translated, or why nothing changed.
     */
    public record Tracked(UUID shipmentId, String state, String providerStatusRaw,
                          boolean translated, String note) {
    }
}
