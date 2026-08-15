package com.trioloo.erp.product.domain;

/**
 * The minimal media lifecycle, {@code PRD-169}.
 *
 * <p>⚠ Deliberately two values. No {@code DRAFT}, no {@code PENDING} and no approval state,
 * because no canonical source establishes one.
 *
 * <p>🔴 Referenced media is never destructively hard-deleted in ordinary business operation
 * ({@code PRD-169.b}, {@code INV-105.3}) — archived, never deleted.
 */
public enum MediaLifecycle {
    ACTIVE,
    ARCHIVED
}
