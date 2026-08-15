package com.trioloo.erp.product.domain;

/**
 * The outcome of one requested remote act against one listing, {@code PRD-186.b}.
 *
 * <p>🔴 {@code INV-107.1} — retained per listing and NEVER collapsed into an aggregate.
 * {@code INV-107.2} — a failed sibling never makes a succeeded record appear failed.
 *
 * <p>⚠ {@code MANUAL_REQUIRED} is a NORMAL state, not a failure ({@code SYS-025}), and
 * {@code DIVERGED} is always an exception ({@code SYS-026}). They must never be presented
 * alike ({@code UX-038.c}).
 */
public enum OperationOutcome {
    REQUESTED,
    IN_PROGRESS,
    SUCCEEDED,
    FAILED,
    MANUAL_REQUIRED,
    DIVERGED;

    /** Whether the act finished, in any outcome. */
    public boolean isTerminal() {
        return this != REQUESTED && this != IN_PROGRESS;
    }

    /**
     * Whether a retry may target this member, {@code PRD-186.d}.
     *
     * <p>🔴 {@code MANUAL_REQUIRED} and {@code DIVERGED} are deliberately NOT retried — a
     * person must decide the outcome first.
     */
    public boolean isRetryable() {
        return this == FAILED;
    }
}
