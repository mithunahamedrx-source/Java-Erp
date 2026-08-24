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

    public ShipmentTrackingService(JdbcTemplate jdbc, SteadfastCourierClient courier, Clock clock) {
        this.jdbc = jdbc;
        this.courier = courier;
        this.clock = clock;
    }

    @Transactional
    public Tracked refresh(UUID shipmentId) {
        requireTrackingAuthority();

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
