package com.trioloo.erp.product.application.channel;

import java.util.List;

/**
 * One page of a channel enumeration, {@code PRD-175} / {@code API-066}.
 *
 * <p>🔴 {@code API-066.a} — the cursor is the ADAPTER's business. Product never interprets
 * it; it only hands it back to ask for more.
 *
 * <p>🔴 {@code API-066.b} — {@code complete} is load-bearing. A truncated or failed
 * enumeration MUST report {@code complete=false}, because {@code PRD-177}'s
 * absence-is-not-deletion guarantee depends entirely on the adapter being honest about it.
 * A run that stopped early must never let the core conclude that unseen listings are gone.
 */
public record DiscoveryPage(List<ReportedListingSnapshot> listings,
                            String nextCursor,
                            boolean complete,
                            String incompleteReason) {

    public boolean hasMore() {
        return nextCursor != null && !nextCursor.isBlank();
    }
}
