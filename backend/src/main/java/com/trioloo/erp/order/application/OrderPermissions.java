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

    private OrderPermissions() {
    }
}
