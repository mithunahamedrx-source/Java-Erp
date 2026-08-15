package com.trioloo.erp.product.application;

import com.trioloo.erp.product.domain.ListingStatus;
import com.trioloo.erp.product.domain.LocalLifecycle;
import com.trioloo.erp.product.domain.MappingState;
import com.trioloo.erp.product.domain.SyncState;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One Channel Listing as the workspace reads it.
 *
 * <p>🔴 Four INDEPENDENT state dimensions travel separately and are never merged into one
 * column ({@code UX-038}, {@code PRD-151.c}): the channel-owned {@link #listingStatus}, the
 * integration {@link #syncState}, Trioloo's {@link #publicationIntent} and the DERIVED
 * {@link #hasUnsentLocalChanges}.
 *
 * <p>🔴 {@code hasUnsentLocalChanges} is computed, never stored ({@code PRD-185.c}). It is
 * NOT the sync state: {@code PENDING} means an attempt is owed to the counterparty, which a
 * purely local edit is not ({@code PRD-185.d}).
 *
 * <p>🔴 Money is a STRING ({@code TEC-015}).
 */
public record ChannelListingView(UUID id,

                                 UUID channelInstanceId,
                                 String channelInstance,
                                 String channelName,
                                 String channelType,
                                 boolean adapterAvailable,

                                 /**
                                  * 🔴 Whether the adapter declares that ANY listing fact can be
                                  * READ for this channel instance, {@code API-063} /
                                  * {@code PRD-125}.
                                  *
                                  * <p>⚠ DISTINCT FROM {@code adapterAvailable}. An adapter that
                                  * exists but reports nothing readable has the same effect on
                                  * Refresh and a completely different cause, so the two are
                                  * never collapsed into one flag.
                                  *
                                  * <p>⚠ PARTIAL COUNTS AS READABLE: one readable fact makes a
                                  * read worth performing, and the rest stay
                                  * {@code NOT_READABLE} afterwards.
                                  */
                                 boolean adapterReadsListings,

                                 /** {@code INV-59.2} — absent before first publication. */
                                 String externalListingId,

                                 MappingState mappingState,
                                 long skuCount,
                                 long mappedSkuCount,

                                 /** Convenience for the single-SKU case only. */
                                 UUID sellableProductId,
                                 String mappedSellableSku,
                                 String sellableName,

                                 /**
                                  * {@code PRD-202.a} — the ENGLISH content, and the primary
                                  * authoring value.
                                  */
                                 String intendedTitle,
                                 String intendedDescription,

                                 /**
                                  * {@code PRD-202.b} — the OPTIONAL Bangla overrides, exactly
                                  * as authored. ⚠ Null means none was written; it does NOT
                                  * mean the Bangla content is empty.
                                  */
                                 String intendedTitleBn,
                                 String intendedDescriptionBn,

                                 /**
                                  * 🔴 {@code PRD-202.c} — the EFFECTIVE Bangla, DERIVED at read
                                  * time: the override where one exists, otherwise the English
                                  * content. It is never stored ({@code PRD-202.d}), so an
                                  * English edit reaches Bangla readers immediately.
                                  */
                                 String effectiveTitleBn,
                                 String effectiveDescriptionBn,

                                 /**
                                  * {@code PRD-199.a} — the NORMAL base selling price. Taken
                                  * from the SKU with the lowest EFFECTIVE price, or the only
                                  * one.
                                  */
                                 String salePrice,

                                 /**
                                  * {@code PRD-199.b} — the optional temporary selling price,
                                  * taken from the same SKU the base price came from so the
                                  * offer is never assembled from two different SKUs.
                                  */
                                 String promotionPrice,
                                 Instant promotionStartsAt,
                                 Instant promotionEndsAt,

                                 /**
                                  * 🔴 {@code PRD-199.d} — what a customer would pay RIGHT NOW.
                                  * DERIVED from the clock at read time and never stored.
                                  */
                                 String effectiveSellingPrice,
                                 boolean promotionActive,

                                 boolean priceIsFrom,
                                 /** Summed across orderable SKUs. */
                                 String listingStock,

                                 String publicationIntent,
                                 String intendedChannelCategory,

                                 String channelReportedTitle,
                                 boolean reportedTitleReadable,
                                 String reportedDescription,
                                 boolean reportedDescriptionReadable,
                                 String reportedSalePrice,
                                 boolean reportedSalePriceReadable,
                                 String reportedPromotionPrice,
                                 boolean reportedPromotionPriceReadable,
                                 Instant reportedPromotionStartsAt,
                                 Instant reportedPromotionEndsAt,
                                 boolean reportedPromotionWindowReadable,
                                 String reportedStock,
                                 boolean reportedStockReadable,
                                 String reportedChannelCategory,
                                 boolean reportedChannelCategoryReadable,

                                 ListingStatus listingStatus,
                                 SyncState syncState,
                                 LocalLifecycle localLifecycle,

                                 /** {@code PRD-185.c} — derived, never stored. */
                                 boolean hasUnsentLocalChanges,

                                 /** {@code PRD-183} — how many facts deterministically differ. */
                                 int divergedFactCount,

                                 String primaryMediaReference,

                                 /**
                                  * {@code PRD-198.c} — the EFFECTIVE highlights, in authored
                                  * order. The Listing's own set where it holds one, otherwise
                                  * the mapped Sellable Product's master set.
                                  *
                                  * <p>🔴 The fallback is resolved at read time and is never
                                  * materialised as listing-owned rows.
                                  */
                                 List<String> highlights,

                                 /** {@code PRD-198.c} — true when the effective set is the fallback. */
                                 boolean highlightsAreFallback,

                                 /**
                                  * {@code PRD-202.f} — the Bangla set as authored, and the
                                  * EFFECTIVE one after ALL-OR-NOTHING fallback.
                                  *
                                  * <p>🔴 {@code highlightsBnAreFallback} says the effective
                                  * Bangla list IS the English list. ⚠ There is no per-line
                                  * merge: a half-translated list would read as a mistake.
                                  */
                                 List<String> highlightsBn,
                                 List<String> effectiveHighlightsBn,
                                 boolean highlightsBnAreFallback,


                                 Instant lastSyncAt,
                                 Instant lastSeenInDiscoveryAt,
                                 Instant lastSuccessfulPushAt,
                                 Instant updatedAt,
                                 long version,

                                 List<ListingViews.SkuView> skus) {
}
