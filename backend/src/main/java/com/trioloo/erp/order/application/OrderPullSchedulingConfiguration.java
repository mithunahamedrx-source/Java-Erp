package com.trioloo.erp.order.application;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns Spring's scheduler on, and ONLY when Channel Order polling is enabled.
 *
 * <p>🔴 Scoped deliberately rather than enabled application-wide. Scheduling is switched on by
 * the one feature that needs it, so no future component acquires a background timer merely
 * because the application happened to have a scheduler running.
 *
 * <p>⚠ It is OFF unless {@code trioloo.order.pull.enabled=true}. A read against a live seller
 * account is not something a test, a diagnostic launch or a developer's laptop should start on
 * its own.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "trioloo.order.pull.enabled", havingValue = "true")
public class OrderPullSchedulingConfiguration {
}
