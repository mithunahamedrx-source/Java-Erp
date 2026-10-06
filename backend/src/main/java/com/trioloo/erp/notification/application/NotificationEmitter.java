package com.trioloo.erp.notification.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Generates notifications from business events, for the people entitled to hear of them.
 *
 * <p>🔴 FAILURE ISOLATES ({@code P6}). A notification is communication evidence, never the record
 * ({@code NOT-001}); the order, the shipment and the sync are the record. Every method here runs in ITS OWN
 * transaction and swallows its own failure after logging it, so a notification fault can never roll back, delay or
 * fail the business act that raised it.
 *
 * <p>🔴 GENERATED ONCE. The caller supplies a dedupe key derived from the event (for example the order and the
 * parcel state), so a re-run of the same import or tracking sweep produces no second notification.
 *
 * <p>🔴 {@code NOT-009} - every INTENDED recipient is recorded, and each in-app delivery is an attempt row.
 */
@Service
public class NotificationEmitter {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmitter.class);

    /**
     * 🔴 An engineering guard, not a business rule: a freshly connected shop backfills months of history, and an
     * order that old is not news. Only an order created within this window raises "New order".
     */
    static final Duration FRESH_ORDER_WINDOW = Duration.ofDays(3);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate isolated;

    public NotificationEmitter(JdbcTemplate jdbc, PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        this.isolated = new TransactionTemplate(transactions);
        this.isolated.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** A new order arrived. Silent for an order old enough to be backfill. */
    public void newOrder(UUID orderId, UUID channelInstanceId, String orderReference, Instant providerCreatedAt) {
        if (providerCreatedAt != null && providerCreatedAt.isBefore(Instant.now().minus(FRESH_ORDER_WINDOW))) {
            return;
        }
        emit(NotificationType.NEW_ORDER, "NEW_ORDER:" + orderId, orderId,
                "New order " + orderReference, "From " + shopName(channelInstanceId) + ".");
    }

    /** The courier's word moved a parcel into a delivery-problem or return state. */
    public void shipmentProblem(NotificationType type, UUID orderId, String state) {
        String reference = orderReference(orderId);
        String title = type == NotificationType.RETURN_ARRIVED
                ? "Parcel returning - order " + reference
                : "Delivery failed - order " + reference;
        String body = type == NotificationType.RETURN_ARRIVED
                ? "The courier reports the parcel as " + readable(state) + ". Receive it when it arrives."
                : "The courier reports a delivery attempt that did not complete.";
        emit(type, type.name() + ":" + orderId + ":" + state, orderId, title, body);
    }

    private void emit(NotificationType type, String dedupeKey, UUID orderId, String title, String body) {
        try {
            isolated.executeWithoutResult(status -> {
                List<UUID> ids = jdbc.query("""
                        INSERT INTO notification (type_code, category, priority, mandatory, title, body, subject_order_id, dedupe_key)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (dedupe_key) DO NOTHING
                        RETURNING id
                        """, (rs, n) -> (UUID) rs.getObject("id"),
                        type.name(), type.category(), type.priority(), type.mandatory(),
                        truncate(title, 200), truncate(body, 600), orderId, dedupeKey);
                if (ids.isEmpty()) {
                    return; // already generated for this event
                }
                UUID notificationId = ids.getFirst();
                for (UUID recipient : recipientsHolding(type.audiencePermission())) {
                    jdbc.update("INSERT INTO notification_recipient (notification_id, recipient_id) VALUES (?, ?)",
                            notificationId, recipient);
                    // The in-app Center IS the delivery: the row existing is the attempt succeeding (NOT-017).
                    jdbc.update("""
                            INSERT INTO notification_delivery (notification_id, recipient_id, channel, outcome)
                            VALUES (?, ?, 'IN_APP', 'SUCCEEDED')
                            """, notificationId, recipient);
                }
            });
        } catch (RuntimeException e) {
            log.warn("Notification {} for {} could not be generated; the business act is unaffected.", type, dedupeKey, e);
        }
    }

    /**
     * Active people whose effective authority includes the permission: the Owner (holds every authority,
     * {@code AGV-033}), or a role carrying it, or an active GRANT override - minus an active REVOKE override
     * ({@code AGV-023}: REVOKE beats GRANT). The same composition {@code AuthorityResolution} applies.
     */
    List<UUID> recipientsHolding(String permissionCode) {
        return jdbc.query("""
                SELECT p.id
                  FROM operational_user_profile p
                 WHERE p.lifecycle_state = 'ACTIVE'
                   AND (
                        p.owner_designated_at IS NOT NULL
                        OR EXISTS (SELECT 1 FROM user_role ur
                                     JOIN role_permission rp ON rp.role_id = ur.role_id
                                     JOIN permission pm ON pm.id = rp.permission_id
                                    WHERE ur.user_id = p.id AND pm.code = ?)
                        OR EXISTS (SELECT 1 FROM user_permission_override o JOIN permission pm ON pm.id = o.permission_id
                                    WHERE o.user_id = p.id AND pm.code = ? AND o.direction = 'GRANT'
                                      AND o.status = 'ACTIVE' AND o.effective_from <= now()
                                      AND (o.expires_at IS NULL OR o.expires_at > now()))
                   )
                   AND NOT EXISTS (SELECT 1 FROM user_permission_override o JOIN permission pm ON pm.id = o.permission_id
                                    WHERE o.user_id = p.id AND pm.code = ? AND o.direction = 'REVOKE'
                                      AND o.status = 'ACTIVE' AND o.effective_from <= now()
                                      AND (o.expires_at IS NULL OR o.expires_at > now()))
                """, (rs, n) -> (UUID) rs.getObject("id"), permissionCode, permissionCode, permissionCode);
    }

    private String shopName(UUID channelInstanceId) {
        List<String> names = jdbc.queryForList("SELECT name FROM channel_instance WHERE id = ?", String.class, channelInstanceId);
        return names.isEmpty() ? "a shop" : names.getFirst();
    }

    private String orderReference(UUID orderId) {
        List<String> refs = jdbc.queryForList(
                "SELECT coalesce(trioloo_invoice_number, order_number, external_order_id) FROM channel_order WHERE id = ?",
                String.class, orderId);
        return refs.isEmpty() || refs.getFirst() == null ? orderId.toString() : refs.getFirst();
    }

    private static String readable(String state) {
        return state == null ? "" : state.toLowerCase().replace('_', ' ');
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
