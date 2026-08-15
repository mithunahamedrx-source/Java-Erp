package com.trioloo.erp.product.application;

/**
 * The five ratified Listings summary facts.
 *
 * <p>Total Listings · Unmapped · Diverged · Unsent Local Changes · Manual Required.
 *
 * <p>🔴 Counted by the DATABASE over the authorised filtered result set, independent of
 * visible-page pagination ({@code UX-044}). The browser never counts a 3000+ corpus
 * ({@code PRD-174.b}).
 *
 * <p>🔴 No count whose basis is undefined is exposed ({@code UX-037.g}) — there is
 * deliberately no last-sync or non-active tile here.
 */
public record ChannelListingSummary(long totalListings,
                                    long unmappedListings,
                                    long divergedListings,
                                    long unsentChangeListings,
                                    long manualRequiredListings) {

    public static ChannelListingSummary empty() {
        return new ChannelListingSummary(0, 0, 0, 0, 0);
    }
}
