package com.trioloo.erp.order.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * The scheduled Channel Order sweep — {@code BR-179}, {@code BR-180}, {@code BR-181}.
 *
 * <p>🔴 THE CADENCE IS CONFIGURATION, NEVER HARD-CODED ({@code BR-179.a}, {@code SYS-013}).
 * FIFTEEN MINUTES IS THE RATIFIED DEFAULT, not a constant, and it is expressed here as a
 * property default so a deployment can change it without a code change.
 *
 * <p>⚠ {@code BR-179.b} — the default is deliberately NOT the five minutes the legacy system
 * shows. {@code BD-018} records ~5 minutes as OBSERVED LEGACY BEHAVIOUR and {@code §7.8}
 * restates it as ARRIVAL LATENCY carrying no rule number: a legacy latency is not a business
 * requirement, and an imported order lands in {@code PENDING_VERIFICATION} for human
 * verification measured in minutes to days ({@code §7.4}).
 *
 * <p>🔴 {@code BR-179.e} — NO RATE LIMIT IS PUBLISHED ({@code DZC-050.b}). The cadence is
 * therefore CONSERVATIVE BY CHOICE, and tightening it is a configuration change made ON
 * EVIDENCE, never a default.
 */
@Component
@ConditionalOnProperty(name = "trioloo.order.pull.enabled", havingValue = "true")
public class ChannelOrderPullScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChannelOrderPullScheduler.class);

    private final ChannelOrderPullService pulls;
    private final String configuredCadence;

    public ChannelOrderPullScheduler(
            ChannelOrderPullService pulls,
            @Value("${trioloo.order.pull.interval:PT15M}") String configuredCadence) {
        this.pulls = pulls;
        this.configuredCadence = configuredCadence;
    }

    /**
     * One sweep. It launches one job per eligible shop and returns.
     *
     * <p>🔴 {@code BR-180} — ONE PULL JOB TARGETS EXACTLY ONE EXPLICIT CHANNEL INSTANCE. Every
     * job carries an explicit {@code channelInstanceId} and NO SHARED OR AMBIENT "CURRENT SHOP"
     * CONTEXT MAY EXIST ({@code API-071.b}): an ambient current-shop variable is the exact
     * mechanism by which one seller's authorisation reads another's data, which {@code AGV-016}
     * forbids.
     *
     * <p>🔴 {@code BR-180.c} — fan-out is a SCHEDULING act, never a widened job, and one shop's
     * failure, throttle or lapsed authorisation cannot stall another. That is why each shop is
     * wrapped individually here: {@code INV-108.1} makes partial success the normal outcome.
     */
    @Scheduled(fixedDelayString = "${trioloo.order.pull.interval:PT15M}",
               initialDelayString = "${trioloo.order.pull.initial-delay:PT1M}")
    public void sweep() {
        List<UUID> shops;
        try {
            shops = pulls.eligibleShops();
        } catch (RuntimeException e) {
            log.warn("Channel order sweep could not resolve eligible shops: {}", e.toString());
            return;
        }
        if (shops.isEmpty()) {
            /*
              ⚠ INFO, NOT DEBUG, AND DELIBERATELY SO. At debug this read as total silence, which
              is indistinguishable from "the scheduler never started" — and that ambiguity cost
              real time during this feature's own bring-up. An eligibility result is a FACT about
              why nothing was read, and BR-181 makes it a rule-driven fact rather than an error.
            */
            log.info("Channel order sweep: no eligible shop. BR-181 admits ACTIVE Daraz shops "
                    + "whose connection is CONNECTED; a DRAFT shop is excluded even when connected, "
                    + "and an unauthorised shop has no credential to read with.");
            return;
        }

        log.info("Channel order sweep starting for {} shop(s) at cadence {} (BR-179).",
                shops.size(), configuredCadence);
        for (UUID shop : shops) {
            try {
                ChannelOrderPullService.PullOutcome outcome = pulls.pullAsSystem(shop);
                log.info("Channel order pull [{}] shop={} complete={} seen={} created={} updated={} — {}",
                        outcome.kind(), shop, outcome.complete(), outcome.imported().ordersSeen(),
                        outcome.imported().ordersCreated(), outcome.imported().ordersUpdated(),
                        outcome.detail());
            } catch (RuntimeException e) {
                // 🔴 BR-180.c — one shop's failure never stalls another, so the loop continues.
                // ⚠ BR-182.a — and it is NOT retried here. The next cycle is one cadence away.
                log.warn("Channel order pull failed for shop {}: {}. Recorded; retried next cycle "
                        + "(BR-182).", shop, e.toString());
            }
        }
    }
}
