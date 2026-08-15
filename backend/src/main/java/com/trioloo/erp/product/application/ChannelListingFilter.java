package com.trioloo.erp.product.application;

import com.trioloo.erp.product.domain.ListingStatus;
import com.trioloo.erp.product.domain.LocalLifecycle;
import com.trioloo.erp.product.domain.SyncState;

import java.util.UUID;

/**
 * The canonical Listings filter dimensions, {@code PRD-174.c}.
 *
 * <p>Each field is traceable to a ratified fact: channel instance ({@code PRD-028}), mapping
 * state ({@code PRD-178}), listing status ({@code PRD-128}), sync state ({@code SYS §7.1}),
 * divergence ({@code PRD-030}), unsent local changes ({@code PRD-185.c}), publication intent,
 * mapped Sellable Product and the ERP lifecycle ({@code PRD-188}).
 *
 * <p>🔴 Every dimension is applied SERVER-SIDE ({@code TEC-096}). The browser never filters a
 * 3000+ corpus ({@code PRD-174.b}).
 *
 * <p>{@code mapped} is deliberately a {@link Boolean}: null means "either", true means every
 * orderable SKU is mapped, false means at least one is not — which is exactly
 * {@code UNMAPPED} or {@code PARTIALLY_MAPPED} ({@code PRD-178}).
 */
public record ChannelListingFilter(String search,
                                   String channelInstance,
                                   ListingStatus listingStatus,
                                   SyncState syncState,
                                   LocalLifecycle lifecycle,
                                   String publicationIntent,
                                   UUID sellableProductId,
                                   Boolean mapped,
                                   boolean divergedOnly,
                                   boolean unsentOnly) {

    /** The unfiltered workspace. */
    public static ChannelListingFilter none() {
        return new ChannelListingFilter(null, null, null, null, null, null, null, null,
                false, false);
    }
}
