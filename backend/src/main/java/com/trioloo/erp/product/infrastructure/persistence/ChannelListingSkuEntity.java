package com.trioloo.erp.product.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-106} Channel Listing SKU — the ORDERABLE unit of a Channel Listing
 * ({@code PRD-190}, {@code DM-083}).
 *
 * <p>🔴 {@code INV-106.2} — THE ORDERABLE SKU IS THE MAPPING UNIT. It maps to ZERO Sellable
 * Products while {@code UNMAPPED} and exactly ONE once {@code MAPPED}. Several SKUs MAY map
 * to the same Sellable Product; one SKU NEVER maps to two — which is why this is a single
 * nullable column and never a join table.
 *
 * <p>🔴 {@code INV-106.3} — channel price and published marketplace stock attach HERE. For a
 * single-SKU listing that is indistinguishable from the listing itself, which is why
 * {@code PRD-029} and {@code PRD-126} were correct and remain so.
 *
 * <p>🔴 {@code INV-106.4} — published marketplace stock is MANUAL and is never derived from
 * Inventory ({@code PRD-193}).
 *
 * <p>🔴 {@code INV-106.5} — confers NO variant structure on {@code E-058}.
 * {@code INV-106.6} — this is NOT {@code E-020} Product Variant; the variation label is the
 * channel's own reported text and the axis schema is adapter-owned ({@code PRD-190.g}).
 */
@Entity
@Table(name = "channel_listing_sku")
public class ChannelListingSkuEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_listing_id", nullable = false)
    private UUID channelListingId;

    @Column(name = "channel_sku", length = 160)
    private String channelSku;

    /** {@code INV-106.2} — zero or one. Never a collection. */
    @Column(name = "sellable_product_id")
    private UUID sellableProductId;

    /** {@code PRD-197.b} — the price this orderable SKU is actually offered at. */
    @Column(name = "sale_price", precision = 19, scale = 2)
    private BigDecimal salePrice;

    /**
     * {@code PRD-201.a} — the package publishing facts, on the ORDERABLE unit.
     *
     * <p>🔴 {@code PRD-201.c} — they attach HERE rather than to the Listing because the
     * orderable SKU is what a courier actually collects. A listing-level parcel becomes a
     * fiction the moment two variants ship differently.
     *
     * <p>🔴 {@code PRD-201.e} — weight is KILOGRAMS and dimensions are CENTIMETRES, stored
     * once. A channel needing other units converts in its adapter.
     *
     * <p>🔴 {@code PRD-201.d} — this is the SHIPPING CARTON, including wrapping and filler.
     * It is NOT the product's measured size and never derives from an Inventory quantity.
     *
     * <p>🔴 {@code PRD-201.f} — an unset value is ABSENT, never zero.
     */
    @Column(name = "package_weight_kg", precision = 19, scale = 3)
    private BigDecimal packageWeightKg;

    @Column(name = "package_length_cm", precision = 19, scale = 3)
    private BigDecimal packageLengthCm;

    @Column(name = "package_width_cm", precision = 19, scale = 3)
    private BigDecimal packageWidthCm;

    @Column(name = "package_height_cm", precision = 19, scale = 3)
    private BigDecimal packageHeightCm;

    /** {@code PRD-201.a} — what the buyer receives, authored as text. */
    @Column(name = "package_content", length = 2000)
    private String packageContent;

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

    @Column(name = "variation_label", length = 400)
    private String variationLabel;

    @Column(name = "position", nullable = false)
    private int position;

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

    protected ChannelListingSkuEntity() {
    }

    public ChannelListingSkuEntity(UUID id, UUID channelListingId, String channelSku,
                                   int position, UUID actorId, Instant now) {
        this.id = id;
        this.channelListingId = channelListingId;
        this.channelSku = channelSku;
        this.position = position;
        this.createdAt = now;
        this.createdBy = actorId;
        this.updatedAt = now;
        this.updatedBy = actorId;
    }

    public void touch(UUID actorId, Instant now) {
        this.updatedBy = actorId;
        this.updatedAt = now;
    }

    /** {@code INV-106.2} — whether this orderable unit resolves to a Sellable Product. */
    public boolean isMapped() {
        return sellableProductId != null;
    }

    /**
     * Applies inbound reported values, {@code PRD-181.a}.
     *
     * <p>🔴 Writes the REPORTED side only. Intended values are never touched by readback.
     * A {@code null} with the readable flag {@code false} means the adapter did not return
     * the field at all, which is NOT an empty value ({@code API-063.c}).
     */
    public void applyReported(BigDecimal salePrice, boolean salePriceReadable,
                              BigDecimal promotionPrice, boolean promotionPriceReadable,
                              Instant promotionStartsAt, Instant promotionEndsAt,
                              boolean promotionWindowReadable,
                              BigDecimal stock, boolean stockReadable,
                              String label) {
        this.reportedSalePrice = salePrice;
        this.reportedSalePriceReadable = salePriceReadable;
        this.reportedPromotionPrice = promotionPrice;
        this.reportedPromotionPriceReadable = promotionPriceReadable;
        this.reportedPromotionStartsAt = promotionStartsAt;
        this.reportedPromotionEndsAt = promotionEndsAt;
        this.reportedPromotionWindowReadable = promotionWindowReadable;
        this.reportedStock = stock;
        this.reportedStockReadable = stockReadable;
        if (label != null) {
            this.variationLabel = label;
        }
    }

    public UUID getId() { return id; }
    public UUID getChannelListingId() { return channelListingId; }
    public String getChannelSku() { return channelSku; }
    public void setChannelSku(String v) { channelSku = v; }
    public UUID getSellableProductId() { return sellableProductId; }
    public void setSellableProductId(UUID v) { sellableProductId = v; }
    public BigDecimal getSalePrice() { return salePrice; }
    public void setSalePrice(BigDecimal v) { salePrice = v; }
    public BigDecimal getPackageWeightKg() { return packageWeightKg; }
    public void setPackageWeightKg(BigDecimal v) { packageWeightKg = v; }
    public BigDecimal getPackageLengthCm() { return packageLengthCm; }
    public void setPackageLengthCm(BigDecimal v) { packageLengthCm = v; }
    public BigDecimal getPackageWidthCm() { return packageWidthCm; }
    public void setPackageWidthCm(BigDecimal v) { packageWidthCm = v; }
    public BigDecimal getPackageHeightCm() { return packageHeightCm; }
    public void setPackageHeightCm(BigDecimal v) { packageHeightCm = v; }
    public String getPackageContent() { return packageContent; }
    public void setPackageContent(String v) { packageContent = v; }

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
    public BigDecimal getReportedSalePrice() { return reportedSalePrice; }
    public boolean isReportedSalePriceReadable() { return reportedSalePriceReadable; }
    public BigDecimal getReportedStock() { return reportedStock; }
    public boolean isReportedStockReadable() { return reportedStockReadable; }
    public String getVariationLabel() { return variationLabel; }
    public void setVariationLabel(String v) { variationLabel = v; }
    public int getPosition() { return position; }
    public void setPosition(int v) { position = v; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
