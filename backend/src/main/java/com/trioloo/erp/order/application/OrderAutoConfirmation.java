package com.trioloo.erp.order.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Confirms an order by POLICY at the moment it arrives — {@code BR-014}, {@code BR-184}.
 *
 * <p>✅ PRODUCT-OWNER DECISION, 2026-10-03: Trioloo runs no human verification queue. {@code BR-014}
 * already permits this without amendment — <em>"'Not required' is itself a decision, recorded with
 * its reason"</em> — so the decision is RECORDED here rather than skipped.
 *
 * <p>🔴 NO HUMAN CONFIRMER IS FABRICATED ({@code BR-166}). {@code confirmed_by} is left null and
 * the mode is {@code AUTO_CONFIRMED}, so the human-versus-auto distinction is a recorded property
 * ({@code BR-167}) and not an inference from a null. {@code V26}'s CHECK makes the opposite
 * unstorable.
 *
 * <p>⚠ IT IS NOT A TAKEOVER. {@code BR-169} lists viewing and ingestion as non-meaningful, and a
 * system confirmation is neither a person's manual verification nor a manual confirmation, so an
 * {@code API_MANAGED} order stays {@code API_MANAGED}.
 *
 * <p>⚠ IT IS IDEMPOTENT. The {@code WHERE} matches only an order still awaiting verification that
 * has no confirmation, so a re-poll of an already-confirmed order writes nothing and the first
 * confirmation moment is never moved.
 *
 * <p>🔴 IT TOUCHES NO INVENTORY, PAYMENT OR SHIPMENT. Confirmation reserving stock is {@code BR-096}'s
 * and is not built in this slice ({@code PRM-093.e}, {@code BR-153}).
 */
@Component
public class OrderAutoConfirmation {

    /** {@code BR-014} — the recorded reason. */
    public static final String REASON = "VERIFICATION_NOT_REQUIRED";

    /** {@code BR-167} — the recorded mode. */
    public static final String MODE = "AUTO_CONFIRMED";

    private final JdbcTemplate jdbc;

    public OrderAutoConfirmation(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** @return {@code true} if THIS call recorded the confirmation. */
    public boolean confirmIfAwaitingVerification(UUID orderId) {
        return jdbc.update("""
                UPDATE channel_order
                   SET confirmed_at = now(),
                       confirmation_mode = ?,
                       confirmation_reason = ?
                 WHERE id = ?
                   AND confirmed_at IS NULL
                   AND canonical_statuses_json @> '["PENDING_VERIFICATION"]'::jsonb
                """, MODE, REASON, orderId) > 0;
    }
}
