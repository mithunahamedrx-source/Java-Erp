package com.trioloo.erp.product.domain;

/**
 * The master record lifecycle, {@code SYS §7.1}.
 *
 * <p>🔴 {@code PRD-062} — a product referenced by any historical order is ARCHIVED, never
 * deleted. {@code PRD-063} — {@code ARCHIVED} prevents NEW references; existing references
 * remain permanently valid.
 */
public enum RecordStatus {
    DRAFT,
    ACTIVE,
    SUSPENDED,
    ARCHIVED;

    /** Whether a new reference may be created against a record in this state. */
    public boolean acceptsNewReferences() {
        return this == ACTIVE;
    }
}
