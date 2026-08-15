package com.trioloo.erp.product.domain;

/**
 * The three kinds of entry a listing's activity history carries, {@code PRD-129} as
 * extended by {@code PRD-186.e}.
 *
 * <p>✅ An ACTIVITY log, not an audit log ({@code AUD-001}, {@code INV-107.3}). It replaces
 * no audit obligation ({@code PRD-095}, {@code AUD §12.2}).
 */
public enum ActivityKind {

    /** A local intended edit, carrying before and after values. */
    FIELD_CHANGE,

    /**
     * An occurrence with NO before value — suspension, rejection, policy violation.
     *
     * <p>⚠ Recording only field changes would lose precisely the events that matter most
     * ({@code PRD-129}).
     */
    CHANNEL_EVENT,

    /** A requested act with an outcome, which is neither of the above ({@code PRD-186.e}). */
    OPERATION
}
