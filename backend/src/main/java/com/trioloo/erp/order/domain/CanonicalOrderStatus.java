package com.trioloo.erp.order.domain;

/**
 * The canonical order status vocabulary.
 *
 * <p>These are the principal order states ratified at {@code ORDER_MANAGEMENT_ARCHITECTURE.md}
 * §6.2 and {@code STATE_MACHINE_ARCHITECTURE.md} §5.2 ({@code SM-1}). The names and meanings
 * are transcribed, never authored here.
 *
 * <p>🔴 This enum is the CANONICAL VOCABULARY a channel adapter translates INTO. §4.3 makes
 * translation an adapter responsibility — <em>"Translation — Convert channel vocabulary into
 * canonical vocabulary (status names, payment methods, address formats)"</em> — and
 * {@code BR-005} keeps channel-specific logic out of every downstream stage. Nothing in this
 * package may branch on a channel.
 *
 * <p>⚠ A canonical status carried on an imported order is the MIRROR of the marketplace's own
 * status, which §3.5 makes the marketplace's system of record while the order is
 * {@code API_MANAGED} ({@code BR-003}). It is a distinct fact from the ERP's own operational
 * lifecycle position, and {@code BR-171} / {@code UX-182} require the two to stay
 * distinguishable and never be merged into one field.
 *
 * <p>🔴 {@code DRAFT} is deliberately absent: {@code GAP-023} records the {@code DRAFT}
 * lifecycle as BLOCKED — MISSING CANONICAL BUSINESS RULE, and a value is not created here to
 * fill the space ({@code OSC-050}, {@code CLAUDE.md} §5).
 */
public enum CanonicalOrderStatus {

    /** Awaiting the verification decision (§6.2). The arrival state for channel ingestion (§7.8). */
    PENDING_VERIFICATION,

    /** Verified and accepted; not yet committed to stock (§6.2). */
    CONFIRMED,

    /** Authorised to consume inventory; queued to warehouse (§6.2). */
    RELEASED,

    /** Picking and packing under way (§6.2). */
    IN_FULFILLMENT,

    /** Packed, awaiting carrier handover — RTS (§6.2). ⚠ Never Return-To-Seller ({@code BR-079}). */
    READY_TO_SHIP,

    /** Handed to the carrier (§6.2). */
    DISPATCHED,

    /** Received by the customer (§6.2). */
    DELIVERED,

    /** Delivery attempted and failed (§6.2). Not terminal. */
    FAILED_DELIVERY,

    /** Goods came back to Trioloo (§6.2). */
    RETURNED,

    /** Progress deliberately suspended (§6.2). */
    ON_HOLD,

    /** Terminated before delivery (§6.2). */
    CANCELLED,

    /** All sub-processes terminal; commercially complete (§6.2, {@code BR-010}). */
    CLOSED;

    /**
     * Resolves a stored canonical status name, or {@code null} where the value is not one.
     *
     * <p>🔴 An unrecognised value is NOT coerced into the nearest match. A channel value the
     * adapter declined to translate stays untranslated and is rendered as the external fact it
     * is ({@code BR-134}, {@code SYS-034} — absent is not empty, and unknown is not a guess).
     */
    public static CanonicalOrderStatus resolve(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        for (CanonicalOrderStatus status : values()) {
            if (status.name().equalsIgnoreCase(name.trim())) {
                return status;
            }
        }
        return null;
    }
}
