package com.trioloo.erp.product.application;

import com.trioloo.erp.product.domain.ActivityKind;
import com.trioloo.erp.product.domain.MediaRole;
import com.trioloo.erp.product.domain.OperationKind;
import com.trioloo.erp.product.domain.OperationOutcome;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read models for the Listings workspace.
 *
 * <p>🔴 Money crosses as a STRING, never a JSON number ({@code TEC-015}, {@code PRJ-045}).
 * The client renders it and performs no arithmetic on it ({@code TEC-095}).
 *
 * <p>🔴 Every reported fact travels with its readable flag so the client can say
 * "Not readable from this channel" rather than showing an empty value ({@code API-063.c}).
 */
public final class ListingViews {

    private ListingViews() {
    }

    /**
     * One orderable channel SKU, {@code E-106} / {@code PRD-190}.
     *
     * <p>🔴 The mapping is per SKU ({@code INV-106.2}); {@code sellableProductId} is null
     * exactly when this orderable unit is unmapped.
     */
    public record SkuView(UUID id,
                          String channelSku,
                          UUID sellableProductId,
                          String sellableSku,
                          String sellableName,
                          String salePrice,
                          String promotionPrice,
                          Instant promotionStartsAt,
                          Instant promotionEndsAt,
                          /**
                           * 🔴 {@code PRD-199.d} — DERIVED at read time from the clock, never
                           * stored. It is the promotion while the window is open and the base
                           * Sale Price at every other moment.
                           */
                          String effectiveSellingPrice,
                          boolean promotionActive,
                          String listingStock,
                          String reportedSalePrice,
                          boolean reportedSalePriceReadable,
                          String reportedPromotionPrice,
                          boolean reportedPromotionPriceReadable,
                          Instant reportedPromotionStartsAt,
                          Instant reportedPromotionEndsAt,
                          boolean reportedPromotionWindowReadable,
                          String reportedStock,
                          boolean reportedStockReadable,
                          /**
                           * 🔴 {@code PRD-201.c} — the package facts belong to the ORDERABLE
                           * unit, because that is what a courier collects. Weight is
                           * KILOGRAMS and dimensions CENTIMETRES ({@code PRD-201.e}); a null
                           * is ABSENT and never zero ({@code PRD-201.f}).
                           */
                          String packageWeightKg,
                          String packageLengthCm,
                          String packageWidthCm,
                          String packageHeightCm,
                          String packageContent,
                          String variationLabel,
                          int position) {

        public boolean mapped() {
            return sellableProductId != null;
        }
    }

    /**
     * One media reference in an effective, master or intended set.
     *
     * <p>{@code source} states WHERE the reference came from so the UI can show a fallback
     * honestly: {@code LISTING_INTENDED}, {@code SELLABLE_MASTER} or {@code CHANNEL_REPORTED}.
     */
    public record MediaView(UUID id,
                            UUID mediaAssetId,
                            String storageReference,
                            MediaRole role,
                            int position,
                            String source) {

        public static final String LISTING_INTENDED = "LISTING_INTENDED";
        public static final String SELLABLE_MASTER = "SELLABLE_MASTER";
        public static final String CHANNEL_REPORTED = "CHANNEL_REPORTED";
    }

    /**
     * The three media concepts a listing carries, {@code PRD-182}.
     *
     * <p>🔴 {@code effectiveIsFallback} is DERIVED ({@code PRD-170.a}): true when the listing
     * holds no override and the effective set therefore comes from the mapped Sellable
     * Product. The fallback is never materialised as listing-owned rows
     * ({@code PRD-170.b}).
     */
    public record MediaSetView(List<MediaView> master,
                               List<MediaView> intended,
                               List<MediaView> reported,
                               List<MediaView> effective,
                               boolean effectiveIsFallback,
                               boolean reportedOrderReliable) {
    }

    /** A neutral channel attribute pair, {@code PRD-192}. */
    public record AttributeView(UUID id,
                                String attributeKey,
                                String intendedValue,
                                String reportedValue,
                                boolean reportedReadable,
                                boolean writable,
                                int position) {
    }

    /**
     * One row of the intended-versus-reported comparison, {@code PRD-181}.
     *
     * <p>{@code state} is one of {@code ALIGNED}, {@code DIVERGED}, {@code NOT_READABLE},
     * {@code UNSENT} or {@code MANUAL_REQUIRED} — the five cases the surface must keep
     * visually distinct.
     *
     * <p>🔴 {@code UNSENT} is NOT divergence ({@code PRD-185.d}). The reported value is still
     * correct for the last push, so Accept Marketplace is not offered for it.
     *
     * <p>🔴 {@code MANUAL_REQUIRED} is NOT a failure and NOT agreement ({@code SYS-025}). It
     * says no trustworthy deterministic comparison exists for this fact ({@code PRD-183.e}),
     * so a person must compare it and no automatic resolution is offered.
     */
    public record ComparisonRow(String fieldKey,
                                String label,
                                String intendedValue,
                                String reportedValue,
                                boolean reportedReadable,
                                String state,
                                boolean resolvable) {

        public static final String ALIGNED = "ALIGNED";
        public static final String DIVERGED = "DIVERGED";
        public static final String NOT_READABLE = "NOT_READABLE";
        public static final String UNSENT = "UNSENT";
        public static final String MANUAL_REQUIRED = "MANUAL_REQUIRED";
    }

    /** One activity entry, {@code PRD-129} as extended by {@code PRD-186.e}. */
    public record ActivityView(UUID id,
                               ActivityKind entryKind,
                               String summary,
                               String fieldKey,
                               String beforeValue,
                               String afterValue,
                               String source,
                               String actorName,
                               UUID operationId,
                               UUID batchId,
                               Instant occurredAt) {
    }

    /** One {@code E-107} operation record. */
    public record OperationView(UUID id,
                                UUID channelListingId,
                                String listingTitle,
                                String externalListingId,
                                String channelName,
                                UUID batchId,
                                OperationKind operationKind,
                                OperationOutcome outcome,
                                String detail,
                                String adapterProvenance,
                                String requestedByName,
                                Instant requestedAt,
                                Instant completedAt) {

        public boolean retryable() {
            return outcome != null && outcome.isRetryable();
        }
    }

    /**
     * An {@code E-108} batch and its DERIVED tally.
     *
     * <p>🔴 {@code INV-108.2} — every count here is computed by grouping members at read
     * time. None is stored ({@code DB-001}).
     */
    public record BatchView(UUID id,
                            OperationKind operationKind,
                            String scopeDescription,
                            String requestedByName,
                            Instant requestedAt,
                            Instant completedAt,
                            long requested,
                            long succeeded,
                            long failed,
                            long manualRequired,
                            long diverged,
                            long inFlight) {
    }

    /** One field's declared capability for one channel instance, {@code API-063}. */
    public record CapabilityView(String fieldKey,
                                 boolean readable,
                                 boolean writable) {
    }

    /**
     * A channel instance plus whether an adapter actually serves it.
     *
     * <p>🔴 {@code adapterAvailable} is reported honestly. Where false, refresh and push are
     * not offered and the UI says why rather than failing on click.
     */
    public record ChannelView(UUID id,
                              String code,
                              String name,
                              String channelType,
                              boolean adapterAvailable,
                              long knownListings,
                              Instant lastSyncAt,
                              List<CapabilityView> capabilities) {
    }

    /**
     * An advisory mapping suggestion, {@code PRD-179}.
     *
     * <p>🔴 {@code basis} states the EVIDENCE, e.g. "Exact channel SKU match". There is
     * deliberately NO confidence score ({@code PRD-179.d}, {@code PRD-146}), and nothing
     * here is ever applied without explicit operator confirmation ({@code PRD-179.b}).
     */
    public record MappingSuggestionView(UUID sellableProductId,
                                        String sellableSku,
                                        String sellableName,
                                        String basis,
                                        boolean exact) {
    }
}
