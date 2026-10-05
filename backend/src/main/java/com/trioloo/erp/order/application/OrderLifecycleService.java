package com.trioloo.erp.order.application;

import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Cancel an order, and restore a cancelled one — {@code OM §6.4}, {@code §6.5}, {@code PRM-095}.
 *
 * <p>✅ BUILT ON THE OWNER'S INSTRUCTION, 2026-10-05: the Orders More Actions menu must cancel and
 * restore. {@code PRM-095} ratifies {@code order.order.cancel} and {@code order.order.restore} on
 * that instruction; neither grants the other, and neither writes to the marketplace.
 *
 * <p>🔴 BOTH ARE MEANINGFUL MANUAL ACTIONS ({@code BR-169}). An {@code API_MANAGED} order becomes
 * {@code ERP_MANAGED} immediately, with the causing act, actor and moment recorded
 * ({@code BR-174}); the move is one-way in V1 ({@code BR-175}). {@code BR-172}: a later marketplace
 * payload still reporting {@code cancelled} does not undo a restoration.
 *
 * <p>🔴 THE MARKETPLACE'S STATUS IS NEVER REWRITTEN ({@code BR-171}, {@code BR-173}). The stale
 * word stays as evidence; the ERP's reading is DERIVED ({@code channel_order_effective_statuses}).
 *
 * <p>🔴 NO OUTBOUND WRITE EXISTS. Daraz is not told ({@code OSC-036}, {@code DZC-044.a}) — the
 * operator is, in the response, so they can act in Seller Center.
 *
 * <p>⚠ CANCEL IS REFUSED WHILE A LIVE COURIER SHIPMENT EXISTS. {@code STF-016}: a booking cannot be
 * withdrawn by API, so the consignment must be cancelled in the Steadfast panel first; a tracking
 * refresh then records it. Cancelling the Order while a rider is on the way would create exactly the
 * parcel-in-the-network state {@code BR-011} says is not a cancellation.
 *
 * <p>🔴 NO INVENTORY EFFECT. {@code GAP-020} leaves unpack/restock/void-label ordering unspecified
 * and this slice reserves nothing ({@code BR-096} is not built), so there is nothing to release and
 * nothing is invented. {@code BR-012}'s stock re-check on restore has nothing to check for the same
 * reason.
 */
@Service
public class OrderLifecycleService {

    /** {@code BD-035} — the eight reasons Trioloo can give; the ninth is the marketplace's own act. */
    public static final Set<String> CANCEL_REASONS = Set.of(
            "CUSTOMER_UNREACHABLE", "CUSTOMER_REQUESTED", "CHANGED_MIND", "ADDRESS_INCORRECT",
            "PHONE_INCORRECT", "PRODUCT_UNAVAILABLE", "CHANGE_NOT_FULFILLABLE", "DUPLICATE_ORDER");

    /** {@code BR-011} — the states from which cancellation is still available. */
    private static final Set<String> PRE_DISPATCH = Set.of(
            "PENDING_VERIFICATION", "CONFIRMED", "RELEASED", "IN_FULFILLMENT", "READY_TO_SHIP",
            "COURIER_BOOKED");

    private final JdbcTemplate jdbc;
    private final OrderAutoConfirmation autoConfirmation;

    public OrderLifecycleService(JdbcTemplate jdbc, OrderAutoConfirmation autoConfirmation) {
        this.jdbc = jdbc;
        this.autoConfirmation = autoConfirmation;
    }

    @Transactional
    public Outcome cancel(UUID orderId, String reason, String note) {
        UUID actor = require(OrderPermissions.ORDER_CANCEL);
        if (reason == null || !CANCEL_REASONS.contains(reason)) {
            // BR-016 — a controlled vocabulary; free text alone is insufficient.
            throw new IllegalArgumentException(
                    "A cancellation needs a reason from the list (BR-016): " + String.join(", ",
                            CANCEL_REASONS.stream().sorted().toList()) + ".");
        }
        OrderState state = load(orderId);

        if (state.effective().contains("CANCELLED")) {
            throw new IllegalStateException("This order is already cancelled.");
        }
        if (state.effective().stream().noneMatch(PRE_DISPATCH::contains)) {
            // BR-011 — after dispatch the correct instrument is a return, not a cancellation.
            throw new IllegalStateException(
                    "This order is past the point where it can be cancelled (BR-011). Once goods are "
                            + "with the courier the instrument is a return, not a cancellation.");
        }
        if (state.liveShipment()) {
            throw new IllegalStateException(
                    "This order has a live Steadfast shipment. Steadfast cannot be cancelled from here "
                            + "(STF-016): cancel the consignment in the Steadfast panel, refresh tracking, "
                            + "then cancel the order.");
        }

        jdbc.update("""
                UPDATE channel_order
                   SET cancelled_at = now(), cancelled_by = ?, cancel_reason = ?, cancel_note = ?,
                       ownership = 'ERP_MANAGED',
                       authority_cause = CASE WHEN ownership = 'API_MANAGED'
                                              THEN 'CANCELLED_BY_TRIOLOO' ELSE authority_cause END,
                       authority_changed_at = CASE WHEN ownership = 'API_MANAGED'
                                                   THEN now() ELSE authority_changed_at END,
                       authority_changed_by = CASE WHEN ownership = 'API_MANAGED'
                                                   THEN ? ELSE authority_changed_by END,
                       version = version + 1
                 WHERE id = ?
                """, actor, reason, blankToNull(note), actor, orderId);

        return new Outcome(orderId, "CANCELLED", marketplaceNote(state, "cancelled"));
    }

    @Transactional
    public Outcome restore(UUID orderId) {
        UUID actor = require(OrderPermissions.ORDER_RESTORE);
        OrderState state = load(orderId);

        if (!state.effective().contains("CANCELLED")) {
            throw new IllegalStateException("Only a cancelled order can be restored.");
        }

        jdbc.update("""
                UPDATE channel_order
                   SET restored_at = now(), restored_by = ?,
                       ownership = 'ERP_MANAGED',
                       authority_cause = CASE WHEN ownership = 'API_MANAGED'
                                              THEN 'RESTORED_BY_TRIOLOO' ELSE authority_cause END,
                       authority_changed_at = CASE WHEN ownership = 'API_MANAGED'
                                                   THEN now() ELSE authority_changed_at END,
                       authority_changed_by = CASE WHEN ownership = 'API_MANAGED'
                                                   THEN ? ELSE authority_changed_by END,
                       version = version + 1
                 WHERE id = ?
                """, actor, actor, orderId);
        /*
          BR-012 — the restored order RE-ENTERS verification. BR-184 makes verification automatic, so
          it is confirmed by policy again if it never was; an existing confirmation is kept (its
          moment is not rewritten) and no human confirmer is invented (BR-166).
        */
        jdbc.update("""
                UPDATE channel_order
                   SET confirmed_at = now(), confirmation_mode = ?, confirmation_reason = ?
                 WHERE id = ? AND confirmed_at IS NULL
                """, OrderAutoConfirmation.MODE, OrderAutoConfirmation.REASON, orderId);

        return new Outcome(orderId, "CONFIRMED", marketplaceNote(state, "restored"));
    }

    private static String marketplaceNote(OrderState state, String verb) {
        return state.apiManaged()
                ? "Trioloo now controls this order and marketplace updates will not overwrite it "
                        + "(BR-172). The marketplace is not told: the order was " + verb
                        + " here only, so update it in the seller panel too."
                : null;
    }

    private OrderState load(UUID orderId) {
        List<OrderState> found = jdbc.query("""
                SELECT o.ownership,
                       channel_order_effective_statuses(o.id)::text AS effective,
                       EXISTS (SELECT 1 FROM shipment s
                                WHERE s.channel_order_id = o.id
                                  AND s.consignment_id IS NOT NULL
                                  AND s.state NOT IN ('DELIVERED', 'RETURNED_TO_WAREHOUSE', 'LOST',
                                                      'DAMAGED', 'CANCELLED')) AS live_shipment
                  FROM channel_order o WHERE o.id = ?
                """, (rs, n) -> new OrderState(
                        "API_MANAGED".equals(rs.getString("ownership")),
                        parse(rs.getString("effective")), rs.getBoolean("live_shipment")), orderId);
        return found.stream().findFirst().orElseThrow(
                () -> new IllegalArgumentException("Order " + orderId + " does not exist."));
    }

    private static List<String> parse(String json) {
        if (json == null) {
            return List.of();
        }
        return java.util.Arrays.stream(json.replaceAll("[\\[\\]\"\\s]", "").split(","))
                .filter(s -> !s.isEmpty()).toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** 🔴 {@code PRM-004} — the gate is here, in the application service. */
    private UUID require(String permission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> permission.equals(g.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedByPermissionException(permission);
        }
        if (!(auth.getPrincipal() instanceof AccessUserDetails details)) {
            throw new IllegalStateException("The acting user could not be identified (AGV-001).");
        }
        return details.getProfileId();
    }

    private record OrderState(boolean apiManaged, List<String> effective, boolean liveShipment) {
    }

    /** @param marketplaceNote what the operator must still do outside Trioloo, or {@code null}. */
    public record Outcome(UUID orderId, String canonicalStatus, String marketplaceNote) {
    }
}
