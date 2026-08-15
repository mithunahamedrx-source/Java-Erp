package com.trioloo.erp.product.application.channel;

import com.trioloo.erp.product.domain.ListingStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * What an adapter OBSERVED on the channel for one listing, {@code API-062.a}.
 *
 * <p>🔴 This lands on the REPORTED side only. It never writes Product-owned intent
 * ({@code API-062.c}, {@code PRD-181.a}).
 *
 * <p>🔴 Each fact carries its own {@code *Readable} flag. {@code false} means the adapter
 * could not read the field AT ALL — not that the channel shows nothing ({@code API-063.c}).
 * Coalescing the two would manufacture a divergence on every listing.
 */
public record ReportedListingSnapshot(

        String externalListingId,

        String title,
        boolean titleReadable,

        String description,
        boolean descriptionReadable,

        BigDecimal salePrice,
        boolean salePriceReadable,

        /**
         * 🔴 {@code PRD-197.e} — reported SEPARATELY from the Sale Price. A channel that
         * exposes one and not the other must be able to say so, and an unreadable value
         * stays unreadable rather than borrowing its sibling ({@code SYS-034}).
         */
        BigDecimal promotionPrice,
        /**
         * 🔴 {@code SYS-034} — {@code false} means the adapter could not READ the promotion
         * price. ⚠ It NEVER means the channel has no promotion: absence of a report is not a
         * report of absence.
         */
        boolean promotionPriceReadable,
        Instant promotionStartsAt,
        Instant promotionEndsAt,
        boolean promotionWindowReadable,

        BigDecimal stock,
        boolean stockReadable,

        String channelCategory,
        boolean channelCategoryReadable,

        /**
         * 🔴 Only ever a status the channel EXPLICITLY reported ({@code PRD-177.b}). An
         * adapter must never synthesise one from absence.
         */
        ListingStatus listingStatus,

        /** Neutral attribute values the channel returned, keyed by attribute name. */
        Map<String, String> attributes,

        /**
         * Ordered media references the channel reports, {@code PRD-182}.
         *
         * <p>🔴 Mirrored external references, NOT {@code E-105} assets ({@code PRD-182.b}).
         */
        List<String> mediaReferences,

        /**
         * Whether media order is RELIABLY readable on this channel, {@code PRD-183.b}.
         *
         * <p>🔴 When false, media alone must not produce {@code DIVERGED} ({@code PRD-183.d})
         * — a false divergence on every listing is worse than none at all.
         */
        boolean mediaOrderReliable,

        List<ReportedSkuSnapshot> skus) {
}
