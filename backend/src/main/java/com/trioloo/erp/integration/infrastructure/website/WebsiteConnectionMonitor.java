package com.trioloo.erp.integration.infrastructure.website;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Records whether the storefront can be reached with the ERP key, as the connection condition the Shops & Channels
 * screen shows (API-068, SCS-042).
 *
 * <p>🔴 A CONDITION IS ONLY WRITTEN FROM AN ACTUAL OBSERVATION. The check makes one small read against the site; the
 * result is stored with the moment it was observed. Nothing here holds a credential: the key lives in deployment
 * configuration, and {@code channel_connection} holds no secret.
 *
 * <p>⚠ ONE KEY SERVES THE ONE STOREFRONT, so every non-archived WEBSITE shop shares its condition. A second site
 * would need its own key and its own configuration.
 */
@Component
public class WebsiteConnectionMonitor {

    private static final Logger log = LoggerFactory.getLogger(WebsiteConnectionMonitor.class);

    private final JdbcTemplate jdbc;
    private final WebsiteProperties properties;
    private final WebsiteTransport transport;

    public WebsiteConnectionMonitor(JdbcTemplate jdbc, WebsiteProperties properties, WebsiteTransport transport) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.transport = transport;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStart() {
        check();
    }

    @Scheduled(fixedDelayString = "${integration.website.check-interval:PT5M}", initialDelayString = "PT5M")
    public void check() {
        try {
            List<UUID> shops = jdbc.queryForList("""
                    SELECT id FROM channel_instance
                     WHERE upper(channel_type) = 'WEBSITE' AND upper(record_status) <> 'ARCHIVED'
                    """, UUID.class);
            if (shops.isEmpty()) {
                return;
            }
            String state = observe();
            Timestamp now = Timestamp.from(Instant.now());
            for (UUID shop : shops) {
                jdbc.update("""
                        INSERT INTO channel_connection (channel_instance_id, state, last_checked_at, updated_at)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT (channel_instance_id)
                        DO UPDATE SET state = EXCLUDED.state, last_checked_at = EXCLUDED.last_checked_at,
                                      updated_at = EXCLUDED.updated_at
                        """, shop, state, now, now);
            }
        } catch (RuntimeException e) {
            // Never let a monitoring failure reach startup or the scheduler thread.
            log.warn("Website connection check failed: {}", e.getClass().getSimpleName());
        }
    }

    private String observe() {
        if (!properties.isConfigured()) {
            return "NOT_CONNECTED";
        }
        try {
            WebsiteTransport.Response response = transport.get(
                    properties.baseUrl() + "/erp/orders?updatedAfter=" + Instant.now().toString(),
                    Map.of("X-ERP-Key", properties.erpKey(), "Accept", "application/json"));
            return switch (response.status()) {
                case 200 -> "CONNECTED";
                case 401 -> "REAUTH_REQUIRED";
                case 503 -> "NOT_CONNECTED";
                default -> "ERROR";
            };
        } catch (WebsiteException e) {
            return "ERROR";
        }
    }
}
