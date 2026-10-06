package com.trioloo.erp.notification.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.order.application.OrderPermissions;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * What the signed-in person sees in the bell and the Notification Center - their OWN notifications and the
 * Ongoing Conditions they are entitled to see.
 *
 * <p>🔴 SCOPE IS THE RECIPIENT ROW ({@code NOT-009}, {@code PRM-009}): every read and every state change is bound
 * to the actor's own recipient row, so one person can neither read nor dismiss another's. Engagement is per
 * recipient ({@code NOT-015}): dismissing hides it for this person only.
 *
 * <p>🔴 ONGOING CONDITIONS ARE QUERIES, NOT STORED ({@code NOT-013}). Nobody dismisses "on hold": releasing the
 * hold clears it. They are visible only to a person who holds the permission to act on their subject.
 */
@Service
public class NotificationQueryService {

    /** {@code system.channel-instance.view} - a person who may see shops may see their connection state. */
    static final String CHANNEL_INSTANCE_VIEW = "system.channel-instance.view";

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public NotificationQueryService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    public record Item(UUID id, String typeCode, String category, String priority, boolean mandatory, String title,
                       String body, UUID orderId, Instant createdAt, Instant viewedAt) {
    }

    public record Condition(String code, String title, String priority, boolean mandatory, long count,
                            List<ConditionItem> items) {
    }

    public record ConditionItem(UUID orderId, String reference) {
    }

    /** The newest notifications for this person; dismissed ones are hidden unless asked for. */
    @Transactional(readOnly = true)
    public List<Item> list(boolean unreadOnly, int limit) {
        Actor actor = currentActor.require();
        return jdbc.query("""
                SELECT n.id, n.type_code, n.category, n.priority, n.mandatory, n.title, n.body,
                       n.subject_order_id, n.created_at, r.viewed_at
                  FROM notification n
                  JOIN notification_recipient r ON r.notification_id = n.id
                 WHERE r.recipient_id = ? AND r.dismissed_at IS NULL
                   AND (? = false OR r.viewed_at IS NULL)
                 ORDER BY n.created_at DESC
                 LIMIT ?
                """, (rs, i) -> new Item((UUID) rs.getObject("id"), rs.getString("type_code"),
                        rs.getString("category"), rs.getString("priority"), rs.getBoolean("mandatory"),
                        rs.getString("title"), rs.getString("body"), (UUID) rs.getObject("subject_order_id"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("viewed_at") == null ? null : rs.getTimestamp("viewed_at").toInstant()),
                actor.id(), unreadOnly, Math.min(Math.max(limit, 1), 200));
    }

    /** Unread notifications plus current conditions - the number the bell shows. */
    @Transactional(readOnly = true)
    public long unreadCount() {
        Actor actor = currentActor.require();
        Long unread = jdbc.queryForObject("""
                SELECT count(*) FROM notification_recipient
                 WHERE recipient_id = ? AND dismissed_at IS NULL AND viewed_at IS NULL
                """, Long.class, actor.id());
        return unread == null ? 0 : unread;
    }

    @Transactional
    public void markViewed(UUID notificationId) {
        Actor actor = currentActor.require();
        jdbc.update("""
                UPDATE notification_recipient SET viewed_at = coalesce(viewed_at, now())
                 WHERE notification_id = ? AND recipient_id = ?
                """, notificationId, actor.id());
    }

    @Transactional
    public void markAllViewed() {
        Actor actor = currentActor.require();
        jdbc.update("""
                UPDATE notification_recipient SET viewed_at = now()
                 WHERE recipient_id = ? AND viewed_at IS NULL AND dismissed_at IS NULL
                """, actor.id());
    }

    /**
     * 🔴 Dismissal is the PERSON'S act and per recipient ({@code NOT-015}); it hides this notification for them only
     * and never ends any work. A mandatory notification cannot be dismissed ({@code NOT-014}).
     */
    @Transactional
    public void dismiss(UUID notificationId) {
        Actor actor = currentActor.require();
        jdbc.update("""
                UPDATE notification_recipient r
                   SET dismissed_at = now(), viewed_at = coalesce(viewed_at, now())
                  FROM notification n
                 WHERE n.id = r.notification_id AND r.notification_id = ? AND r.recipient_id = ?
                   AND n.mandatory = false
                """, notificationId, actor.id());
    }

    /**
     * The conditions that are true RIGHT NOW and that this person may act on. Each is a live query over order and
     * connection state; none is stored, and each clears itself when the state changes ({@code NOT-013}).
     */
    @Transactional(readOnly = true)
    public List<Condition> conditions() {
        Actor actor = currentActor.require();
        List<Condition> found = new ArrayList<>();
        if (actor.hasPermission(OrderPermissions.CHANNEL_ORDER_VIEW)) {
            addOrderCondition(found, "FAILED_DELIVERY", "Delivery failed - waiting for the parcel to come back", "HIGH",
                    "FAILED_DELIVERY");
            addOrderCondition(found, "PENDING_CANCELLATION", "Cancelled here - waiting for the marketplace to confirm",
                    "NORMAL", "PENDING_CANCELLATION");
            addOrderCondition(found, "ON_HOLD", "On hold - waiting for someone to release it", "NORMAL", "ON_HOLD");
        }
        if (actor.hasPermission(CHANNEL_INSTANCE_VIEW)) {
            List<ConditionItem> shops = jdbc.query("""
                    SELECT i.name FROM channel_connection c
                      JOIN channel_instance i ON i.id = c.channel_instance_id
                     WHERE c.state IN ('REAUTH_REQUIRED', 'ERROR') AND i.record_status = 'ACTIVE'
                     ORDER BY i.name
                    """, (rs, n) -> new ConditionItem(null, rs.getString("name")));
            if (!shops.isEmpty()) {
                // Mandatory: a broken connection silently stops orders arriving ("Marketplace Sync Failure", NOT-014).
                found.add(new Condition("CONNECTION_PROBLEM", "A shop connection needs attention", "HIGH", true,
                        shops.size(), shops.stream().limit(5).toList()));
            }
        }
        return found;
    }

    private void addOrderCondition(List<Condition> into, String code, String title, String priority, String status) {
        String filter = "channel_order_effective_statuses(o.id) @> '[\"" + status + "\"]'::jsonb";
        List<ConditionItem> items = jdbc.query(
                "SELECT o.id, coalesce(o.trioloo_invoice_number, o.order_number, o.external_order_id) AS ref"
                        + " FROM channel_order o WHERE " + filter + " ORDER BY o.imported_at DESC",
                (rs, n) -> new ConditionItem((UUID) rs.getObject("id"), rs.getString("ref")));
        if (!items.isEmpty()) {
            into.add(new Condition(code, title, priority, false, items.size(), items.stream().limit(5).toList()));
        }
    }
}
