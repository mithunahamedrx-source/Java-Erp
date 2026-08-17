package com.trioloo.erp.integration.domain;

/**
 * {@code API-068} — the connection condition of one Channel Instance.
 *
 * <p>🔴 EXACTLY FOUR, AND NO MORE. {@code SCS-043.a} — "connection unavailable" is a
 * PRESENTATION state produced by a failed read, not a fifth condition, and therefore has no
 * constant here and no value in the database.
 *
 * <p>🔴 {@code SCS-043.b} — no {@code TOKEN_EXPIRED}, no provider error code, no OAuth
 * internal. The business-facing vocabulary is these four words.
 *
 * <p>🔴 This is NOT the configuration lifecycle ({@code SYS-108}) and is never derived from
 * it, nor it from this ({@code SCS-040}).
 */
public enum ConnectionState {

    /**
     * Never authorised.
     *
     * <p>⚠ This is what the ABSENCE of a connection record means. Nothing stores it at
     * creation, so no shop ever carries a fabricated connection fact.
     */
    NOT_CONNECTED,

    /** Trioloo can work against this account on the channel. */
    CONNECTED,

    /**
     * The channel no longer accepts the authorisation.
     *
     * <p>🔴 {@code SCS-043} — the shop, its Listings and its BINDING are unchanged. Renewal
     * is as the SAME account ({@code INV-16.6}).
     */
    REAUTH_REQUIRED,

    /** The channel refused the last attempt; authorisation must be renewed. */
    ERROR
}
