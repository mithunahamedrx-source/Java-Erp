package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.ListingStatus;
import com.trioloo.erp.product.domain.LocalLifecycle;
import com.trioloo.erp.product.domain.SyncState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-059} Channel Listing — one channel instance's representation of one Sellable
 * Product, and the spine of the connected Listings workspace ({@code PRD-173}).
 *
 * <p>🔴 {@code INV-59.9} — for every marketplace-editable fact the adapter can read, the
 * INTENDED and REPORTED values are held SEPARATELY. Inbound readback writes the reported
 * side only and never overwrites intent ({@code PRD-181.a}).
 *
 * <p>🔴 {@code INV-59.11} — a local save changes intended content only and NEVER constitutes
 * a remote operation ({@code PRD-185}). The unsent-change condition is DERIVED by comparing
 * {@code intendedContentUpdatedAt} against {@code lastSuccessfulPushAt}; it is never a
 * stored mutable flag ({@code DB-001}).
 *
 * <p>🔴 {@code INV-59.1} — the Sellable Product mapping lives on {@code E-106}, not here.
 * The legacy column is retained for history and is never written after V6.
 */
@Entity
@Table(name = "channel_listing")
public class ChannelListingEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /**
     * 🔴 SUPERSEDED by {@code channel_listing_sku.sellable_product_id} ({@code PRD-190.d},
     * {@code INV-106.2}). Retained for history under {@code PRJ-083}; never written by
     * application code after V6.
     */
    @Column(name = "sellable_product_id", insertable = false, updatable = false)
    private UUID legacySellableProductId;

    @Column(name = "channel_instance_id", nullable = false)
    private UUID channelInstanceId;

    /**
     * {@code INV-59.2} — AT MOST ONE, and it MAY BE ABSENT before a successful remote
     * creation ({@code PRD-188.b}). A channel cannot issue an identifier for a listing that
     * does not exist yet.
     */
    @Column(name = "external_listing_id", length = 160)
    private String externalListingId;

    @Column(name = "intended_title")
    private String intendedTitle;

    @Column(name = "intended_description")
    private String intendedDescription;

    /**
     * {@code PRD-202.b} — the OPTIONAL Bangla overrides.
     *
     * <p>🔴 {@code PRD-202.c}/{@code .d} — the EFFECTIVE Bangla is DERIVED: the override
     * where one exists, otherwise the English content. The fallback is NEVER materialised
     * here — copying English in would freeze a translation nobody wrote, and a later English
     * edit would silently stop reaching Bangla readers.
     *
     * <p>🔴 {@code PRD-202.g} — one-directional. English is never derived from Bangla.
     */
    @Column(name = "intended_title_bn")
    private String intendedTitleBn;

    @Column(name = "intended_description_bn")
    private String intendedDescriptionBn;

    /**
     * ⚠ Listing-level pricing is retained for the single-SKU convenience read. The
     * AUTHORITATIVE per-orderable-SKU figures live on {@code E-106} ({@code INV-106.3}).
     *
     * <p>{@code PRD-199.a} — the NORMAL, base selling price: what the customer pays whenever
     * no promotion is running.
     */
    @Column(name = "sale_price", precision = 19, scale = 2)
    private BigDecimal salePrice;

    /**
     * {@code PRD-199.b} — the OPTIONAL temporary selling price.
     *
     * <p>🔴 In force ONLY while its window is open. The EFFECTIVE selling price is DERIVED
     * at read time from the clock and is never stored ({@code PRD-199.d}, {@code DB-001}) —
     * there is deliberately no "current price" column for a stale job to leave wrong.
     *
     * <p>🔴 {@code PRD-199.e} — never above {@link #salePrice}. Equality is valid.
     */
    @Column(name = "promotion_price", precision = 19, scale = 2)
    private BigDecimal promotionPrice;

    /** {@code PRD-199.c} — required whenever {@link #promotionPrice} is present. */
    @Column(name = "promotion_starts_at")
    private Instant promotionStartsAt;

    /** {@code PRD-199.c} — required with a promotion price, and later than the start. */
    @Column(name = "promotion_ends_at")
    private Instant promotionEndsAt;

    @Column(name = "published_marketplace_stock", precision = 19, scale = 4)
    private BigDecimal publishedMarketplaceStock;

    @Column(name = "publication_intent", length = 80)
    private String publicationIntent;

    @Column(name = "intended_channel_category", length = 400)
    private String intendedChannelCategory;

    @Column(name = "intended_channel_category_ref", length = 160)
    private String intendedChannelCategoryRef;

    // ---------------------------------------------------------------------------------
    // REPORTED side. 🔴 Written ONLY by inbound readback (PRD-181.a, API-062.c).
    //
    // ⚠ A null value with its readable flag false means the adapter did not return the
    //   field at all. That is NOT an empty value and is never rendered as one
    //   (SYS-034, API-063.c).
    // ---------------------------------------------------------------------------------

    @Column(name = "channel_reported_title")
    private String channelReportedTitle;

    @Column(name = "reported_title_readable", nullable = false)
    private boolean reportedTitleReadable;

    @Column(name = "reported_description")
    private String reportedDescription;

    @Column(name = "reported_description_readable", nullable = false)
    private boolean reportedDescriptionReadable;

    @Column(name = "reported_sale_price", precision = 19, scale = 2)
    private BigDecimal reportedSalePrice;

    @Column(name = "reported_sale_price_readable", nullable = false)
    private boolean reportedSalePriceReadable;

    @Column(name = "reported_promotion_price", precision = 19, scale = 2)
    private BigDecimal reportedPromotionPrice;

    /**
     * 🔴 {@code SYS-034} — {@code false} means the adapter could not READ the promotion
     * price at all. ⚠ That is NOT zero and NOT "there is no promotion": a channel that
     * reported nothing has not told us there is none.
     */
    @Column(name = "reported_promotion_price_readable", nullable = false)
    private boolean reportedPromotionPriceReadable;

    @Column(name = "reported_promotion_starts_at")
    private Instant reportedPromotionStartsAt;

    @Column(name = "reported_promotion_ends_at")
    private Instant reportedPromotionEndsAt;

    @Column(name = "reported_promotion_window_readable", nullable = false)
    private boolean reportedPromotionWindowReadable;

    @Column(name = "reported_stock", precision = 19, scale = 4)
    private BigDecimal reportedStock;

    @Column(name = "reported_stock_readable", nullable = false)
    private boolean reportedStockReadable;

    @Column(name = "reported_channel_category", length = 400)
    private String reportedChannelCategory;

    @Column(name = "reported_channel_category_readable", nullable = false)
    private boolean reportedChannelCategoryReadable;

    /** {@code PRD-188} — the ERP-side lifecycle, distinct from the channel-owned status. */
    @Enumerated(EnumType.STRING)
    @Column(name = "local_lifecycle", nullable = false, length = 24)
    private LocalLifecycle localLifecycle = LocalLifecycle.PUBLISHED;

    /** {@code PRD-185.c} — half of the DERIVED unsent-change condition. */
    @Column(name = "intended_content_updated_at")
    private Instant intendedContentUpdatedAt;

    /** {@code PRD-185.c} — the other half. */
    @Column(name = "last_successful_push_at")
    private Instant lastSuccessfulPushAt;

    /**
     * {@code PRD-177} — when a discovery run last RETURNED this listing.
     *
     * <p>🔴 Absence from a later run is never, by itself, a destructive state change.
     */
    @Column(name = "last_seen_in_discovery_at")
    private Instant lastSeenInDiscoveryAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "listing_status", length = 32)
    private ListingStatus listingStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "sync_state", nullable = false, length = 32)
    private SyncState syncState = SyncState.PENDING;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected ChannelListingEntity() {
    }

    /**
     * Creates a listing. {@code externalListingId} is deliberately nullable: an ERP-first
     * draft has none until the channel issues one ({@code PRD-188.b}).
     *
     * <p>🔴 No Sellable Product is taken here — the mapping belongs to {@code E-106}
     * ({@code INV-106.2}), and a freshly discovered listing is {@code UNMAPPED}
     * ({@code PRD-178}).
     */
    public ChannelListingEntity(UUID id, UUID channelInstanceId, String externalListingId,
                                LocalLifecycle localLifecycle, UUID actorId, Instant now) {
        this.id = id;
        this.channelInstanceId = channelInstanceId;
        this.externalListingId = externalListingId;
        this.localLifecycle = localLifecycle;
        this.createdAt = now;
        this.createdBy = actorId;
        this.updatedAt = now;
        this.updatedBy = actorId;
    }

    public void touch(UUID actorId, Instant now) {
        updatedBy = actorId;
        updatedAt = now;
    }

    /**
     * Marks intended content as edited, {@code PRD-185.c}.
     *
     * <p>🔴 This is what makes a save LOCAL. It stamps intent and never contacts a channel
     * ({@code PRD-185.a}, {@code API-064.a}).
     */
    public void markIntendedContentChanged(UUID actorId, Instant now) {
        this.intendedContentUpdatedAt = now;
        touch(actorId, now);
    }

    /**
     * {@code PRD-185.c} — the DERIVED unsent-change condition.
     *
     * <p>Intended content edited after the last successful outbound operation. 🔴 Never a
     * stored flag ({@code DB-001}), and deliberately NOT the sync state: {@code PENDING}
     * means an attempt is owed to the counterparty, which a purely local edit is not
     * ({@code PRD-185.d}).
     */
    public boolean hasUnsentLocalChanges() {
        if (intendedContentUpdatedAt == null) {
            return false;
        }
        return lastSuccessfulPushAt == null || intendedContentUpdatedAt.isAfter(lastSuccessfulPushAt);
    }

    /** Records that an outbound push succeeded, clearing the derived unsent condition. */
    public void recordSuccessfulPush(Instant now) {
        this.lastSuccessfulPushAt = now;
    }

    /**
     * Applies the channel identifier the marketplace issued on first publication,
     * {@code PRD-188.c}.
     *
     * <p>🔴 Mirrored exactly as received ({@code DB-046}) and never typed by an operator.
     */
    public void assignExternalListingId(String value, Instant now) {
        this.externalListingId = value;
        this.localLifecycle = LocalLifecycle.PUBLISHED;
        this.lastSuccessfulPushAt = now;
    }

    /**
     * Applies inbound reported values, {@code PRD-181.a} / {@code INV-59.9}.
     *
     * <p>🔴 Writes the REPORTED side only. No intended value is touched here, which is the
     * single most important property of readback: overwriting intent would destroy the
     * operator's unsent edit and make {@code DIVERGED} undetectable.
     */
    public void applyReportedContent(String title, boolean titleReadable,
                                     String description, boolean descriptionReadable,
                                     BigDecimal salePrice, boolean salePriceReadable,
                                     BigDecimal promotionPrice, boolean promotionPriceReadable,
                                     Instant promotionStartsAt, Instant promotionEndsAt,
                                     boolean promotionWindowReadable,
                                     BigDecimal stock, boolean stockReadable,
                                     String category, boolean categoryReadable) {
        this.channelReportedTitle = title;
        this.reportedTitleReadable = titleReadable;
        this.reportedDescription = description;
        this.reportedDescriptionReadable = descriptionReadable;
        this.reportedSalePrice = salePrice;
        this.reportedSalePriceReadable = salePriceReadable;
        this.reportedPromotionPrice = promotionPrice;
        this.reportedPromotionPriceReadable = promotionPriceReadable;
        this.reportedPromotionStartsAt = promotionStartsAt;
        this.reportedPromotionEndsAt = promotionEndsAt;
        this.reportedPromotionWindowReadable = promotionWindowReadable;
        this.reportedStock = stock;
        this.reportedStockReadable = stockReadable;
        this.reportedChannelCategory = category;
        this.reportedChannelCategoryReadable = categoryReadable;
    }

    /**
     * Records the channel-owned status a run reported, {@code PRD-176}.
     *
     * <p>🔴 Only ever called with a status the channel EXPLICITLY reported. Absence from a
     * run never reaches this method ({@code PRD-177.a}).
     */
    public void applyReportedStatus(ListingStatus status) {
        this.listingStatus = status;
    }

    public void recordSeenInDiscovery(Instant now) {
        this.lastSeenInDiscoveryAt = now;
    }

    public void applySyncState(SyncState state, Instant now) {
        this.syncState = state;
        this.lastSyncAt = now;
    }

    public UUID getId() { return id; }
    public UUID getLegacySellableProductId() { return legacySellableProductId; }
    public UUID getChannelInstanceId() { return channelInstanceId; }
    public String getExternalListingId() { return externalListingId; }
    public String getIntendedTitle() { return intendedTitle; }
    public void setIntendedTitle(String v) { intendedTitle = v; }
    public String getIntendedDescription() { return intendedDescription; }
    public void setIntendedDescription(String v) { intendedDescription = v; }
    public BigDecimal getSalePrice() { return salePrice; }
    public void setSalePrice(BigDecimal v) { salePrice = v; }
    public String getIntendedTitleBn() { return intendedTitleBn; }
    public void setIntendedTitleBn(String v) { intendedTitleBn = v; }
    public String getIntendedDescriptionBn() { return intendedDescriptionBn; }
    public void setIntendedDescriptionBn(String v) { intendedDescriptionBn = v; }

    /**
     * The EFFECTIVE Bangla title, {@code PRD-202.c}.
     *
     * <p>⚠ {@code PRD-202.e} — a blank override is an ABSENT one: whitespace is not content,
     * so it falls back exactly as an empty field does.
     */
    public String effectiveTitleBn() {
        return effectiveBangla(intendedTitleBn, intendedTitle);
    }

    /** The EFFECTIVE Bangla description, {@code PRD-202.c}. */
    public String effectiveDescriptionBn() {
        return effectiveBangla(intendedDescriptionBn, intendedDescription);
    }

    /**
     * 🔴 {@code PRD-202.d} — DERIVED AT READ TIME, never stored. This method is the whole
     * of the fallback: there is no column holding the resolved value, so an English edit
     * reaches Bangla readers the instant it is saved.
     */
    private static String effectiveBangla(String override, String english) {
        return override == null || override.isBlank() ? english : override;
    }

    public BigDecimal getPromotionPrice() { return promotionPrice; }
    public void setPromotionPrice(BigDecimal v) { promotionPrice = v; }
    public Instant getPromotionStartsAt() { return promotionStartsAt; }
    public void setPromotionStartsAt(Instant v) { promotionStartsAt = v; }
    public Instant getPromotionEndsAt() { return promotionEndsAt; }
    public void setPromotionEndsAt(Instant v) { promotionEndsAt = v; }
    public BigDecimal getReportedPromotionPrice() { return reportedPromotionPrice; }
    public boolean isReportedPromotionPriceReadable() { return reportedPromotionPriceReadable; }
    public Instant getReportedPromotionStartsAt() { return reportedPromotionStartsAt; }
    public Instant getReportedPromotionEndsAt() { return reportedPromotionEndsAt; }
    public boolean isReportedPromotionWindowReadable() { return reportedPromotionWindowReadable; }

    /**
     * The EFFECTIVE selling price at {@code now}, {@code PRD-199.d}.
     *
     * <p>🔴 DERIVED, never stored. The promotion applies only while its window is open; at
     * every other moment the base Sale Price is what the customer pays.
     *
     * <p>⚠ The window is treated as INCLUSIVE of its start and EXCLUSIVE of its end, so a
     * promotion ending at 23:59:59 is over at 23:59:59 and never overlaps the next one.
     */
    public BigDecimal effectiveSellingPriceAt(Instant now) {
        return promotionActiveAt(now) ? promotionPrice : salePrice;
    }

    /** Whether the promotion window is open at {@code now}, {@code PRD-199.d}. */
    public boolean promotionActiveAt(Instant now) {
        if (promotionPrice == null || promotionStartsAt == null || promotionEndsAt == null) {
            return false;
        }
        return !now.isBefore(promotionStartsAt) && now.isBefore(promotionEndsAt);
    }

    public BigDecimal getPublishedMarketplaceStock() { return publishedMarketplaceStock; }
    public void setPublishedMarketplaceStock(BigDecimal v) { publishedMarketplaceStock = v; }
    public String getPublicationIntent() { return publicationIntent; }
    public void setPublicationIntent(String v) { publicationIntent = v; }
    public String getIntendedChannelCategory() { return intendedChannelCategory; }
    public void setIntendedChannelCategory(String v) { intendedChannelCategory = v; }
    public String getIntendedChannelCategoryRef() { return intendedChannelCategoryRef; }
    public void setIntendedChannelCategoryRef(String v) { intendedChannelCategoryRef = v; }

    public String getChannelReportedTitle() { return channelReportedTitle; }
    public boolean isReportedTitleReadable() { return reportedTitleReadable; }
    public String getReportedDescription() { return reportedDescription; }
    public boolean isReportedDescriptionReadable() { return reportedDescriptionReadable; }
    public BigDecimal getReportedSalePrice() { return reportedSalePrice; }
    public boolean isReportedSalePriceReadable() { return reportedSalePriceReadable; }
    public BigDecimal getReportedStock() { return reportedStock; }
    public boolean isReportedStockReadable() { return reportedStockReadable; }
    public String getReportedChannelCategory() { return reportedChannelCategory; }
    public boolean isReportedChannelCategoryReadable() { return reportedChannelCategoryReadable; }

    public LocalLifecycle getLocalLifecycle() { return localLifecycle; }
    public void setLocalLifecycle(LocalLifecycle v) { localLifecycle = v; }
    public Instant getIntendedContentUpdatedAt() { return intendedContentUpdatedAt; }
    public Instant getLastSuccessfulPushAt() { return lastSuccessfulPushAt; }
    public Instant getLastSeenInDiscoveryAt() { return lastSeenInDiscoveryAt; }

    public ListingStatus getListingStatus() { return listingStatus; }
    public SyncState getSyncState() { return syncState; }
    public Instant getLastSyncAt() { return lastSyncAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
