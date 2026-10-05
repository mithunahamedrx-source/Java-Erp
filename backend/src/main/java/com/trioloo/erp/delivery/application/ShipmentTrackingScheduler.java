package com.trioloo.erp.delivery.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * The scheduled courier-status pull — {@code DLV-031}, {@code BR-029}, {@code BR-182}.
 *
 * <p>✅ WHY IT EXISTS. Without it a delivered parcel stays {@code Ready to ship} until a person
 * presses refresh on that one order, which is not an end-to-end workflow. {@code DLV-031} makes pull
 * one of three permanent mechanisms; the manual refresh stays as the other path ({@code BR-070}).
 *
 * <p>🔴 OFF UNLESS {@code trioloo.delivery.tracking.enabled=true}. A read against the live courier
 * account is not something a test, a diagnostic launch or a laptop should start on its own — the
 * same stance {@code OrderPullSchedulingConfiguration} takes for the Daraz pull.
 *
 * <p>🔴 THE CADENCE IS CONFIGURATION ({@code SYS-013}) AND CONSERVATIVE BY CHOICE. No rate limit is
 * published for Steadfast ({@code STF-011}'s sibling gap), so thirty minutes is a starting point and
 * tightening it is a change made on evidence ({@code BR-179.e}'s reasoning).
 *
 * <p>🔴 NO IN-JOB RETRY ({@code BR-182.a}). One shipment's failure is logged and the sweep moves on;
 * the next cycle is one cadence away and the read is idempotent. {@code STF-007}: a {@code 401}
 * from a status read is "not ours / not found", never a credential failure, so a missing status
 * changes nothing (see {@link ShipmentTrackingService}).
 */
@Component
@ConditionalOnProperty(name = "trioloo.delivery.tracking.enabled", havingValue = "true")
public class ShipmentTrackingScheduler {

    private static final Logger log = LoggerFactory.getLogger(ShipmentTrackingScheduler.class);

    private final ShipmentTrackingService tracking;
    private final String cadence;

    public ShipmentTrackingScheduler(
            ShipmentTrackingService tracking,
            @Value("${trioloo.delivery.tracking.interval:PT30M}") String cadence) {
        this.tracking = tracking;
        this.cadence = cadence;
    }

    @Scheduled(fixedDelayString = "${trioloo.delivery.tracking.interval:PT30M}",
               initialDelayString = "${trioloo.delivery.tracking.initial-delay:PT2M}")
    public void sweep() {
        List<UUID> ids;
        try {
            ids = tracking.activeBookedShipmentIds();
        } catch (RuntimeException e) {
            log.warn("Courier tracking sweep could not list active shipments: {}", e.toString());
            return;
        }
        if (ids.isEmpty()) {
            log.info("Courier tracking sweep: no booked shipment is awaiting an outcome.");
            return;
        }
        log.info("Courier tracking sweep starting for {} shipment(s) at cadence {} (DLV-031).",
                ids.size(), cadence);
        for (UUID id : ids) {
            try {
                ShipmentTrackingService.Tracked result = tracking.refreshAsSystem(id);
                log.info("Courier tracking shipment={} state={} courierWord={} translated={}",
                        id, result.state(), result.providerStatusRaw(), result.translated());
            } catch (RuntimeException e) {
                log.warn("Courier tracking failed for shipment {}: {}. Retried next cycle (BR-182).",
                        id, e.toString());
            }
        }
    }

    /** Turns the scheduler on, and ONLY when courier tracking is enabled. */
    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(name = "trioloo.delivery.tracking.enabled", havingValue = "true")
    static class SchedulingConfiguration {
    }
}
