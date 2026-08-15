package com.trioloo.erp.product.domain;

/**
 * The ERP-side publication lifecycle of a Channel Listing, {@code PRD-188}.
 *
 * <p>🔴 DISTINCT from {@link ListingStatus}, which is channel-owned ({@code PRD-128}). A
 * listing awaiting its first publication has no channel status at all.
 *
 * <p>🔴 {@code PRD-188.d} — a listing awaiting publication is NOT a divergence and NOT a
 * failure. It has no counterpart to differ from, which is exactly why this state exists
 * rather than a misused {@link SyncState}.
 */
public enum LocalLifecycle {

    /** Authored in ERP, never sent. Carries no external listing identifier. */
    DRAFT,

    /** Publication requested; the channel has not yet returned an identifier. */
    PENDING_PUBLICATION,

    /** Live on the channel, or discovered from it. */
    PUBLISHED,

    /** Withdrawn from the channel by an explicit outbound act. */
    WITHDRAWN;

    /** Whether an outbound content update is meaningful for a listing in this state. */
    public boolean acceptsContentPush() {
        return this == PUBLISHED;
    }
}
