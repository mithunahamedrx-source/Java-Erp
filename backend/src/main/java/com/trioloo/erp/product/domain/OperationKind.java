package com.trioloo.erp.product.domain;

/**
 * The remote acts an operation may represent, {@code PRD-186.a}.
 *
 * <p>🔴 Product states the BUSINESS act. How an adapter performs it — endpoint, payload,
 * pagination, retry — is adapter-owned and never appears here ({@code PRD-194.a}).
 */
public enum OperationKind {

    /** Enumerate a channel's ACTIVE listings, {@code PRD-175}. */
    DISCOVER,

    /** Re-read one or more known listings, {@code PRD-189.c}. */
    REFRESH,

    /** Send intended values for an existing listing, {@code PRD-171}. */
    PUSH_UPDATE,

    /** Create the listing remotely for the first time, {@code PRD-188}. */
    PUBLISH_CREATE,

    /** Withdraw the listing from the channel. */
    WITHDRAW;

    /** Whether this act mutates the marketplace and therefore requires publish authority. */
    public boolean isOutbound() {
        return this == PUSH_UPDATE || this == PUBLISH_CREATE || this == WITHDRAW;
    }
}
