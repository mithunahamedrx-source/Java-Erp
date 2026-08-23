package com.trioloo.erp.order.application;

/**
 * The ratified Order MVP capability codes.
 *
 * <p>🔴 These are NOT invented here. {@code PRM-091} names both and {@code PRM-089} fixes the
 * {@code <owning-module>.<resource>.<action>} shape they are written in. Implementation may never
 * coin a permission code ({@code PRM-089.f}), and {@code PRM-003} denies what was never granted.
 *
 * <p>🔴 THE TWO ARE INDEPENDENT. VIEW NEVER IMPLIES SYNC AND SYNC NEVER IMPLIES VIEW
 * ({@code PRM-091.a}). ⚠ A channel-scoped run consumes external quota and rewrites the mirrored
 * side wholesale; reading one order on screen does not. This mirrors
 * {@code product.channel-listing.view} / {@code .sync} deliberately ({@code PRD-196.d}).
 *
 * <p>🔴 NEITHER GRANTS ORDER MUTATION, INVENTORY MOVEMENT, PAYMENT OR SETTLEMENT ACTION, SHIPMENT
 * ACTION, OR ANY MARKETPLACE WRITE ({@code PRM-091.b}). ⚠ Stated positively because an inbound pull
 * LOOKS like a large act and is not one: it mirrors an external fact ({@code OM §3.5},
 * {@code BR-168}) and touches nothing Trioloo owns.
 *
 * <p>🔴 No wildcard exists, in any segment ({@code PRM-089.c}), and no role name is ever the
 * security rule ({@code PRM-004}, {@code PRM-068}).
 */
public final class OrderPermissions {

    /**
     * {@code PRM-091} — READ-ONLY Orders dashboard and Order detail: view, search, filter, list
     * and read detail.
     *
     * <p>🔴 It grants no change to an Order, no inbound pull and no outbound act.
     */
    public static final String CHANNEL_ORDER_VIEW = "order.channel-order.view";

    /**
     * {@code PRM-091} — INITIATE AN INBOUND CHANNEL-ORDER PULL.
     *
     * <p>🔴 ONE CODE FOR ONE ACT AT THREE WINDOWS ({@code PRM-091.c}): the probe, an incremental
     * read and a historical backfill are the same inbound read with different bounds. ⚠ No separate
     * backfill or probe capability is created — {@code PRM-089.b} is a spelling rule, not a
     * generator.
     *
     * <p>🔴 It confers no viewing authority and no marketplace write, including
     * {@code SetInvoiceNumber} ({@code DZC-044.a}).
     */
    public static final String CHANNEL_ORDER_SYNC = "order.channel-order.sync";

    /**
     * {@code PRM-093} — CREATE A MANUAL ORDER, the direct-channel capture {@code OM §22} calls
     * <em>manual order capture</em>.
     *
     * <p>✅ THE ORDER STARTS AT {@code PENDING_VERIFICATION} — the product owner's decision,
     * 2026-08-24 — which is also the state a channel order arrives in ({@code OM §7.4},
     * {@code §7.8}). ⚠ A manual order and an imported one therefore enter the SAME human
     * verification queue, and no state is skipped because a person typed it.
     *
     * <p>🔴 CREATION IS NOT CONFIRMATION ({@code PRM-093.b}). This code ends at
     * {@code PENDING_VERIFICATION} and stops; advancing is a separate act with separate authority,
     * and nothing here may write {@code Confirmed By} / {@code Confirmed At} ({@code BR-176}).
     *
     * <p>🔴 A manual order is {@code ERP_MANAGED} from creation ({@code BR-168}) — there is no
     * marketplace to hold authority over it and no takeover occurs ({@code BR-169}).
     */
    public static final String ORDER_CREATE = "order.order.create";

    private OrderPermissions() {
    }
}
