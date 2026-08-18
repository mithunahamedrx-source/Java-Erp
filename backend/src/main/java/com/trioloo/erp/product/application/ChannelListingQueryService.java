package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.application.channel.ChannelAdapterRegistry;
import com.trioloo.erp.product.domain.ListingFieldKey;
import com.trioloo.erp.product.domain.MappingState;
import com.trioloo.erp.product.domain.SyncState;
import com.trioloo.erp.product.application.channel.ChannelCapabilityDeclaration;
import com.trioloo.erp.product.infrastructure.persistence.ChannelAdapterCapabilityEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelAdapterCapabilityRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingAttributeEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingAttributeRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingHighlightEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingHighlightRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingIntendedMediaEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingIntendedMediaRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingReportedMediaEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingReportedMediaRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuRepository;
import com.trioloo.erp.product.infrastructure.persistence.MediaAssetEntity;
import com.trioloo.erp.product.infrastructure.persistence.MediaAssetRepository;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductEntity;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductMediaEntity;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductMediaRepository;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Reads the Listings workspace.
 *
 * <p>🔴 Every list, count and selection scope is resolved SERVER-SIDE ({@code TEC-096},
 * {@code PRD-174}). The corpus is 3000+ listings across several channel instances and the
 * browser never receives it whole.
 *
 * <p>🔴 Mapping state, unsent-change state, effective price/stock and divergence counts are
 * all DERIVED here and never read from a stored column ({@code DB-001}).
 */
@Service
public class ChannelListingQueryService {

    private final ChannelListingRepository listings;
    private final ChannelListingSkuRepository skus;
    private final ChannelInstanceRepository channels;
    private final SellableProductRepository sellables;
    private final ChannelListingAttributeRepository attributes;
    private final ChannelListingHighlightRepository highlights;
    private final ChannelListingIntendedMediaRepository intendedMedia;
    private final ChannelListingReportedMediaRepository reportedMedia;
    private final SellableProductMediaRepository masterMedia;
    private final MediaAssetRepository assets;
    private final ChannelAdapterCapabilityRepository capabilities;
    /** {@code PRD-202.b} — the Bangla row marker. {@code PRD-202.k}: there is no third. */
    private static final String LANGUAGE_BN = "BN";

    private final ChannelAdapterRegistry adapters;
    private final CurrentActor currentActor;
    /**
     * 🔴 {@code PRD-199.d} — the EFFECTIVE selling price is derived from the CLOCK at read
     * time. The clock is injected rather than read statically so a test can place a
     * promotion window before, around and after "now" without waiting for real time.
     */
    private final Clock clock;

    public ChannelListingQueryService(ChannelListingRepository listings,
                                      ChannelListingSkuRepository skus,
                                      ChannelInstanceRepository channels,
                                      SellableProductRepository sellables,
                                      ChannelListingAttributeRepository attributes,
                                      ChannelListingHighlightRepository highlights,
                                      ChannelListingIntendedMediaRepository intendedMedia,
                                      ChannelListingReportedMediaRepository reportedMedia,
                                      SellableProductMediaRepository masterMedia,
                                      MediaAssetRepository assets,
                                      ChannelAdapterCapabilityRepository capabilities,
                                      ChannelAdapterRegistry adapters,
                                      CurrentActor currentActor,
                                      Clock clock) {
        this.listings = listings;
        this.skus = skus;
        this.channels = channels;
        this.sellables = sellables;
        this.attributes = attributes;
        this.highlights = highlights;
        this.intendedMedia = intendedMedia;
        this.reportedMedia = reportedMedia;
        this.masterMedia = masterMedia;
        this.assets = assets;
        this.capabilities = capabilities;
        this.adapters = adapters;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<ChannelListingView> list(ChannelListingFilter filter, Pageable pageable) {
        requireViewer();
        Page<ChannelListingEntity> found = apply(filter, pageable);
        return new PageImpl<>(compose(found.getContent()), pageable, found.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ChannelListingView detail(UUID id) {
        requireViewer();
        ChannelListingEntity listing = listings.findById(id)
                .orElseThrow(() -> new ChannelListingNotFoundException(id));
        return compose(List.of(listing)).getFirst();
    }

    /**
     * Advisory mapping suggestions for ONE orderable channel SKU, {@code PRD-179}.
     *
     * <p>🔴 DETERMINISTIC EVIDENCE ONLY. The single basis implemented is an EXACT match
     * between the channel's Seller SKU and a Sellable SKU ({@code PRD-179.a}) — an identity
     * two systems already agree on, not a resemblance. {@code PRD-179.d} / {@code PRD-146}:
     * there is NO confidence score, and none is invented to fill the gap.
     *
     * <p>🔴 SUGGESTING IS NOT MAPPING ({@code PRD-179.b}). This method reads; it writes
     * nothing, and the returned rows become a mapping only through
     * {@link ChannelListingCommandService#mapSku} after an explicit operator confirmation.
     *
     * <p>⚠ Title and content similarity are PERMITTED by {@code PRD-179.a} and are
     * deliberately NOT implemented. A near-name on a catalogue where two products differ by a
     * graphics card and several thousand taka is exactly the wrong thing to put in front of
     * someone about to confirm ({@code PRD-179.d}).
     *
     * <p>⚠ VIEW authority is enough to be shown advice; changing the mapping needs MANAGE.
     */
    @Transactional(readOnly = true)
    public List<ListingViews.MappingSuggestionView> mappingSuggestions(UUID skuId) {
        requireViewer();
        ChannelListingSkuEntity sku = skus.findById(skuId)
                .orElseThrow(() -> new ChannelListingValidationException("sku_id",
                        "No Channel Listing SKU with id " + skuId + "."));
        String sellerSku = sku.getChannelSku();
        if (sellerSku == null || sellerSku.isBlank()) {
            // ⚠ No identifier to match on is not a failure; it is simply no evidence.
            return List.of();
        }
        return sellables.findBySellableSkuIgnoreCase(sellerSku.trim())
                .filter(s -> !s.getId().equals(sku.getSellableProductId()))
                .map(s -> List.of(new ListingViews.MappingSuggestionView(
                        s.getId(), s.getSellableSku(), s.getName(),
                        "Exact seller SKU match", true)))
                .orElseGet(List::of);
    }

    /**
     * The five ratified summary facts, counted by the database ({@code UX-044}).
     *
     * <p>🔴 Independent of visible-page pagination. Exporting or counting only the visible
     * page would be the silent truncation {@code UX-044.b} forbids.
     */
    @Transactional(readOnly = true)
    public ChannelListingSummary summary(ChannelListingFilter f) {
        requireViewer();
        List<Object[]> rows = listings.summarise(blankToNull(f.search()),
                blankToNull(f.channelInstance()), f.listingStatus(), f.syncState(),
                f.lifecycle(), blankToNull(f.publicationIntent()), f.sellableProductId(),
                f.mapped(), f.divergedOnly(), f.unsentOnly());
        if (rows.isEmpty() || rows.getFirst() == null) {
            return ChannelListingSummary.empty();
        }
        Object[] r = rows.getFirst();
        return new ChannelListingSummary(asLong(r[0]), asLong(r[1]), asLong(r[2]),
                asLong(r[3]), asLong(r[4]));
    }

    /**
     * Resolves a filter-scoped selection, {@code PRD-187.c}.
     *
     * <p>🔴 Returns IDENTIFIERS and a channel tally, never rows. "Select all 1,842 matching
     * current filters" is held as a filter definition on the server; the browser never
     * renders later pages to represent it ({@code PRD-174.b}).
     *
     * <p>🔴 Listings in other shops that merely share a Sellable Product are NEVER added
     * ({@code PRD-187.c}, {@code INV-108.4}) — nothing here widens the operator's selection.
     */
    @Transactional(readOnly = true)
    public SelectionScope selectionScope(ChannelListingFilter f) {
        requireViewer();
        List<UUID> ids = listings.searchIds(blankToNull(f.search()),
                blankToNull(f.channelInstance()), f.listingStatus(), f.syncState(),
                f.lifecycle(), blankToNull(f.publicationIntent()), f.sellableProductId(),
                f.mapped(), f.divergedOnly(), f.unsentOnly());
        // 🔴 The breakdown is aggregated by the DATABASE over the same predicate, in the same
        // transaction, so the per-channel figures always sum to the selection they describe.
        List<Object[]> tally = listings.countByChannel(blankToNull(f.search()),
                blankToNull(f.channelInstance()), f.listingStatus(), f.syncState(),
                f.lifecycle(), blankToNull(f.publicationIntent()), f.sellableProductId(),
                f.mapped(), f.divergedOnly(), f.unsentOnly());
        List<ChannelSelectionCount> byChannel = tally.stream()
                .map(row -> new ChannelSelectionCount((String) row[0], (Long) row[1]))
                .toList();
        return new SelectionScope(ids, byChannel.stream().map(ChannelSelectionCount::channelName).toList(),
                byChannel);
    }

    /** Channel instances with their declared capability and adapter availability. */
    @Transactional(readOnly = true)
    public List<ListingViews.ChannelView> channels() {
        requireViewer();
        List<ChannelInstanceEntity> all = channels.findAll();
        Map<UUID, List<ChannelAdapterCapabilityEntity>> capsByChannel = new HashMap<>();
        for (ChannelAdapterCapabilityEntity cap : capabilities.findByChannelInstanceIdIn(
                all.stream().map(ChannelInstanceEntity::getId).toList())) {
            capsByChannel.computeIfAbsent(cap.getChannelInstanceId(), k -> new ArrayList<>())
                    .add(cap);
        }
        List<ListingViews.ChannelView> views = new ArrayList<>();
        for (ChannelInstanceEntity c : all) {
            List<ChannelListingEntity> known = listings.findByChannelInstanceId(c.getId());
            views.add(new ListingViews.ChannelView(c.getId(), c.getCode(), c.getName(),
                    c.getChannelType(),
                    adapters.hasAdapterFor(c.getChannelType()),
                    known.size(),
                    known.stream().map(ChannelListingEntity::getLastSyncAt)
                            .filter(Objects::nonNull).max(java.time.Instant::compareTo)
                            .orElse(null),
                    capabilityViews(c, capsByChannel.get(c.getId()))));
        }
        return views;
    }

    /**
     * The intended-versus-reported comparison, {@code PRD-181}.
     *
     * <p>🔴 Five distinct cases, never conflated: ALIGNED, DIVERGED, NOT_READABLE, UNSENT
     * and MANUAL_REQUIRED.
     * A field the adapter cannot read is {@code NOT_READABLE} and is never shown as empty or
     * zero ({@code API-063.c}); an unsent local edit is {@code UNSENT} and is NOT divergence
     * ({@code PRD-185.d}), so Accept Marketplace is not offered for it.
     */
    @Transactional(readOnly = true)
    public List<ListingViews.ComparisonRow> comparison(UUID listingId) {
        requireViewer();
        ChannelListingEntity l = listings.findById(listingId)
                .orElseThrow(() -> new ChannelListingNotFoundException(listingId));
        return comparisonRows(l, attributes.findByChannelListingIdOrderByPositionAsc(listingId));
    }

    // -----------------------------------------------------------------------------------
    // composition
    // -----------------------------------------------------------------------------------

    private Page<ChannelListingEntity> apply(ChannelListingFilter f, Pageable pageable) {
        return listings.search(blankToNull(f.search()), blankToNull(f.channelInstance()),
                f.listingStatus(), f.syncState(), f.lifecycle(),
                blankToNull(f.publicationIntent()), f.sellableProductId(), f.mapped(),
                f.divergedOnly(), f.unsentOnly(), pageable);
    }

    List<ChannelListingView> compose(List<ChannelListingEntity> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        // 🔴 ONE instant for the whole page. Reading the clock per row could place two
        // listings on opposite sides of a promotion boundary within a single response.
        Instant now = Instant.now(clock);
        List<UUID> listingIds = entities.stream().map(ChannelListingEntity::getId).toList();

        Map<UUID, ChannelInstanceEntity> channelById = new HashMap<>();
        for (ChannelInstanceEntity c : channels.findAllById(entities.stream()
                .map(ChannelListingEntity::getChannelInstanceId).distinct().toList())) {
            channelById.put(c.getId(), c);
        }

        Map<UUID, List<ChannelListingSkuEntity>> skusByListing = new HashMap<>();
        Set<UUID> sellableIds = new HashSet<>();
        for (ChannelListingSkuEntity sku : skus.findByChannelListingIdInOrderByPositionAsc(listingIds)) {
            skusByListing.computeIfAbsent(sku.getChannelListingId(), k -> new ArrayList<>())
                    .add(sku);
            if (sku.getSellableProductId() != null) {
                sellableIds.add(sku.getSellableProductId());
            }
        }

        Map<UUID, SellableProductEntity> sellableById = new HashMap<>();
        if (!sellableIds.isEmpty()) {
            for (SellableProductEntity s : sellables.findByIdIn(List.copyOf(sellableIds))) {
                sellableById.put(s.getId(), s);
            }
        }

        Map<UUID, String> primaryMedia = resolvePrimaryMedia(listingIds, skusByListing);

        /*
          🔴 PRD-198.c - the EFFECTIVE highlights are DERIVED. A listing that holds its own
          ordered set uses it; one that holds none falls back to the mapped Sellable
          Product's master set. ALL-OR-NOTHING, and the fallback is never materialised.

          ⚠ PRD-198.g - the master set is not persisted yet, so the fallback currently
          resolves to empty. The resolution rule below is written for the real model, not
          for that gap, so nothing changes here when the master set arrives.
        */
        Map<UUID, List<String>> ownHighlights = new HashMap<>();
        Map<UUID, List<String>> ownHighlightsBn = new HashMap<>();
        for (ChannelListingHighlightEntity h
                : highlights.findByChannelListingIdInOrderByPositionAsc(listingIds)) {
            // 🔴 PRD-202.f - the two sets are kept APART. Merging them into one list and
            // filtering later is exactly the per-line blend the rule forbids.
            Map<UUID, List<String>> target =
                    LANGUAGE_BN.equals(h.getLanguage()) ? ownHighlightsBn : ownHighlights;
            target.computeIfAbsent(h.getChannelListingId(), k -> new ArrayList<>())
                    .add(h.getHighlightText());
        }

        List<ChannelListingView> out = new ArrayList<>();
        for (ChannelListingEntity e : entities) {
            ChannelInstanceEntity channel = channelById.get(e.getChannelInstanceId());
            List<ChannelListingSkuEntity> listingSkus =
                    skusByListing.getOrDefault(e.getId(), List.of());

            List<ListingViews.SkuView> skuViews = new ArrayList<>();
            long mapped = 0;
            BigDecimal lowest = null;
            BigDecimal lowestBase = null;
            BigDecimal lowestPromotion = null;
            Instant lowestPromotionStartsAt = null;
            Instant lowestPromotionEndsAt = null;
            BigDecimal stockSum = null;
            for (ChannelListingSkuEntity k : listingSkus) {
                SellableProductEntity s = k.getSellableProductId() == null ? null
                        : sellableById.get(k.getSellableProductId());
                if (k.isMapped()) {
                    mapped++;
                }
                /*
                  🔴 PRD-199.d - the workspace shows the EFFECTIVE selling price: what a
                  customer would pay right now. That is the promotion where its window is
                  open and the Sale Price everywhere else, DERIVED here from the clock and
                  never read from a stored column.

                  🔴 The whole commercial group is taken from ONE orderable SKU. Picking the
                  lowest effective price from one SKU and the promotion window from another
                  would describe an offer no single orderable unit actually has.
                */
                BigDecimal effective = k.effectiveSellingPriceAt(now);
                if (effective != null && (lowest == null || effective.compareTo(lowest) < 0)) {
                    lowest = effective;
                    lowestBase = k.getSalePrice();
                    lowestPromotion = k.getPromotionPrice();
                    lowestPromotionStartsAt = k.getPromotionStartsAt();
                    lowestPromotionEndsAt = k.getPromotionEndsAt();
                }
                if (k.getPublishedMarketplaceStock() != null) {
                    stockSum = stockSum == null ? k.getPublishedMarketplaceStock()
                            : stockSum.add(k.getPublishedMarketplaceStock());
                }
                skuViews.add(new ListingViews.SkuView(k.getId(), k.getChannelSku(),
                        k.getSellableProductId(),
                        s == null ? null : s.getSellableSku(),
                        s == null ? null : s.getName(),
                        money(k.getSalePrice()), money(k.getPromotionPrice()),
                        k.getPromotionStartsAt(), k.getPromotionEndsAt(),
                        // 🔴 PRD-199.d - DERIVED at read time, never stored.
                        money(k.effectiveSellingPriceAt(now)), k.promotionActiveAt(now),
                        decimal(k.getPublishedMarketplaceStock()),
                        money(k.getReportedSalePrice()), k.isReportedSalePriceReadable(),
                        money(k.getReportedPromotionPrice()), k.isReportedPromotionPriceReadable(),
                        k.getReportedPromotionStartsAt(), k.getReportedPromotionEndsAt(),
                        k.isReportedPromotionWindowReadable(),
                        decimal(k.getReportedStock()), k.isReportedStockReadable(),
                        // 🔴 PRD-201 - kilograms and centimetres, as strings (TEC-015 applies
                        // to every exact decimal, not only to money).
                        decimal(k.getPackageWeightKg()), decimal(k.getPackageLengthCm()),
                        decimal(k.getPackageWidthCm()), decimal(k.getPackageHeightCm()),
                        k.getPackageContent(),
                        k.getVariationLabel(), k.getPosition()));
            }

            // PRD-178 - derived from the orderable SKUs, never stored.
            MappingState mappingState;
            if (listingSkus.isEmpty() || mapped == 0) {
                mappingState = MappingState.UNMAPPED;
            } else if (mapped == listingSkus.size()) {
                mappingState = MappingState.MAPPED;
            } else {
                mappingState = MappingState.PARTIALLY_MAPPED;
            }

            // The single-SKU convenience read. On a variation listing there is deliberately
            // no single Sellable Product to name (PRD-190.e).
            UUID singleSellableId = listingSkus.size() == 1
                    ? listingSkus.getFirst().getSellableProductId() : null;
            SellableProductEntity single = singleSellableId == null ? null
                    : sellableById.get(singleSellableId);

            String channelType = channel == null ? null : channel.getChannelType();

            out.add(new ChannelListingView(e.getId(),
                    e.getChannelInstanceId(),
                    channel == null ? null : channel.getCode(),
                    channel == null ? null : channel.getName(),
                    channelType,
                    channelType != null && adapters.hasAdapterFor(channelType),
                    /*
                      🔴 A SEPARATE FACT FROM "an adapter exists". An adapter that declares no
                      readable listing fact cannot be read back, and naming that as a missing
                      adapter would send the operator to look for an integration already there
                      ({@code API-063}, {@code PRD-125}).
                    */
                    channelType != null && channel != null
                            && adapters.declaresReadableListingFacts(channelType, channel.getId()),
                    e.getExternalListingId(),
                    mappingState,
                    listingSkus.size(),
                    mapped,
                    singleSellableId,
                    single == null ? null : single.getSellableSku(),
                    single == null ? null : single.getName(),
                    e.getIntendedTitle(),
                    e.getIntendedDescription(),
                    e.getIntendedTitleBn(),
                    e.getIntendedDescriptionBn(),
                    // 🔴 PRD-202.c - DERIVED, never stored.
                    e.effectiveTitleBn(),
                    e.effectiveDescriptionBn(),
                    money(lowest != null ? lowestBase : e.getSalePrice()),
                    money(lowest != null ? lowestPromotion : e.getPromotionPrice()),
                    lowest != null ? lowestPromotionStartsAt : e.getPromotionStartsAt(),
                    lowest != null ? lowestPromotionEndsAt : e.getPromotionEndsAt(),
                    money(lowest != null ? lowest : e.effectiveSellingPriceAt(now)),
                    lowest != null
                        ? (lowestPromotion != null && lowest.compareTo(lowestPromotion) == 0)
                        : e.promotionActiveAt(now),
                    listingSkus.size() > 1,
                    decimal(stockSum != null ? stockSum : e.getPublishedMarketplaceStock()),
                    e.getPublicationIntent(),
                    e.getIntendedChannelCategory(),
                    e.getChannelReportedTitle(), e.isReportedTitleReadable(),
                    e.getReportedDescription(), e.isReportedDescriptionReadable(),
                    money(e.getReportedSalePrice()), e.isReportedSalePriceReadable(),
                    money(e.getReportedPromotionPrice()), e.isReportedPromotionPriceReadable(),
                    e.getReportedPromotionStartsAt(), e.getReportedPromotionEndsAt(),
                    e.isReportedPromotionWindowReadable(),
                    decimal(e.getReportedStock()), e.isReportedStockReadable(),
                    e.getReportedChannelCategory(), e.isReportedChannelCategoryReadable(),
                    e.getListingStatus(),
                    e.getSyncState(),
                    e.getLocalLifecycle(),
                    e.hasUnsentLocalChanges(),
                    divergedFactCount(e),
                    primaryMedia.get(e.getId()),
                    ownHighlights.getOrDefault(e.getId(), List.of()),
                    !ownHighlights.containsKey(e.getId()),
                    ownHighlightsBn.getOrDefault(e.getId(), List.of()),
                    /*
                      🔴 PRD-202.f - ALL-OR-NOTHING. A Bangla set that exists is the effective
                      Bangla set entirely; where none exists the English set is used entirely,
                      and it is DERIVED here rather than copied into BN rows (PRD-202.d).
                    */
                    ownHighlightsBn.containsKey(e.getId())
                        ? ownHighlightsBn.get(e.getId())
                        : ownHighlights.getOrDefault(e.getId(), List.of()),
                    !ownHighlightsBn.containsKey(e.getId()),
                    e.getLastSyncAt(),
                    e.getLastSeenInDiscoveryAt(),
                    e.getLastSuccessfulPushAt(),
                    e.getUpdatedAt(),
                    e.getVersion(),
                    skuViews));
        }
        return out;
    }

    /**
     * Resolves each listing's effective primary media reference, {@code PRD-170}.
     *
     * <p>🔴 Listing override wins whole; otherwise the mapped Sellable Product's master set
     * supplies it. A missing image is an ORDINARY case ({@code PRD-168.b}) and simply yields
     * null — the client renders the ratified empty block, never a placeholder illustration.
     */
    private Map<UUID, String> resolvePrimaryMedia(
            List<UUID> listingIds, Map<UUID, List<ChannelListingSkuEntity>> skusByListing) {

        Map<UUID, String> result = new HashMap<>();
        Map<UUID, List<ChannelListingIntendedMediaEntity>> overrides = new HashMap<>();
        Set<UUID> assetIds = new HashSet<>();
        for (ChannelListingIntendedMediaEntity m
                : intendedMedia.findByChannelListingIdInOrderByPositionAsc(listingIds)) {
            overrides.computeIfAbsent(m.getChannelListingId(), k -> new ArrayList<>()).add(m);
            assetIds.add(m.getMediaAssetId());
        }

        Set<UUID> sellableIds = new HashSet<>();
        for (UUID id : listingIds) {
            if (overrides.containsKey(id)) {
                continue;
            }
            for (ChannelListingSkuEntity k : skusByListing.getOrDefault(id, List.of())) {
                if (k.getSellableProductId() != null) {
                    sellableIds.add(k.getSellableProductId());
                    break;
                }
            }
        }

        Map<UUID, List<SellableProductMediaEntity>> masterBySellable = new HashMap<>();
        if (!sellableIds.isEmpty()) {
            for (SellableProductMediaEntity m
                    : masterMedia.findBySellableProductIdInOrderByPositionAsc(List.copyOf(sellableIds))) {
                masterBySellable.computeIfAbsent(m.getSellableProductId(), k -> new ArrayList<>())
                        .add(m);
                assetIds.add(m.getMediaAssetId());
            }
        }

        Map<UUID, MediaAssetEntity> assetById = new HashMap<>();
        if (!assetIds.isEmpty()) {
            for (MediaAssetEntity a : assets.findByIdIn(List.copyOf(assetIds))) {
                assetById.put(a.getId(), a);
            }
        }

        for (UUID id : listingIds) {
            List<ChannelListingIntendedMediaEntity> ov = overrides.get(id);
            if (ov != null && !ov.isEmpty()) {
                result.put(id, reference(assetById, ov.getFirst().getMediaAssetId()));
                continue;
            }
            for (ChannelListingSkuEntity k : skusByListing.getOrDefault(id, List.of())) {
                if (k.getSellableProductId() == null) {
                    continue;
                }
                List<SellableProductMediaEntity> master =
                        masterBySellable.get(k.getSellableProductId());
                if (master != null && !master.isEmpty()) {
                    result.put(id, reference(assetById, master.getFirst().getMediaAssetId()));
                }
                break;
            }
        }
        return result;
    }

    private String reference(Map<UUID, MediaAssetEntity> assetById, UUID assetId) {
        MediaAssetEntity a = assetById.get(assetId);
        return a == null ? null : a.getStorageReference();
    }

    /**
     * Counts deterministically differing facts, {@code PRD-183.b}.
     *
     * <p>🔴 A fact counts ONLY where the adapter actually read it. An unreadable field is
     * never a divergence ({@code PRD-183.d}) — a false divergence on every listing is worse
     * than no divergence detection at all.
     */
    private int divergedFactCount(ChannelListingEntity e) {
        int count = 0;
        if (e.isReportedTitleReadable() && differs(e.getIntendedTitle(), e.getChannelReportedTitle())) {
            count++;
        }
        if (e.isReportedDescriptionReadable()
                && differs(e.getIntendedDescription(), e.getReportedDescription())) {
            count++;
        }
        if (e.isReportedPromotionPriceReadable()
                && differs(e.getPromotionPrice(), e.getReportedPromotionPrice())) {
            count++;
        }
        if (e.isReportedPromotionWindowReadable()
                && (differs(e.getPromotionStartsAt(), e.getReportedPromotionStartsAt())
                    || differs(e.getPromotionEndsAt(), e.getReportedPromotionEndsAt()))) {
            count++;
        }
        if (e.isReportedSalePriceReadable() && differs(e.getSalePrice(), e.getReportedSalePrice())) {
            count++;
        }
        if (e.isReportedStockReadable()
                && differs(e.getPublishedMarketplaceStock(), e.getReportedStock())) {
            count++;
        }
        if (e.isReportedChannelCategoryReadable()
                && differs(e.getIntendedChannelCategory(), e.getReportedChannelCategory())) {
            count++;
        }
        return count;
    }

    List<ListingViews.ComparisonRow> comparisonRows(ChannelListingEntity l,
                                                    List<ChannelListingAttributeEntity> attrs) {
        List<ListingViews.ComparisonRow> rows = new ArrayList<>();
        boolean unsent = l.hasUnsentLocalChanges();

        rows.add(row(ListingFieldKey.TITLE, "Title", l.getIntendedTitle(),
                l.getChannelReportedTitle(), l.isReportedTitleReadable(), unsent));
        rows.add(row(ListingFieldKey.DESCRIPTION, "Description", l.getIntendedDescription(),
                l.getReportedDescription(), l.isReportedDescriptionReadable(), unsent));
        /*
          🔴 PRD-199.b - the base price and the promotion price are SEPARATE comparable facts.
          The discount between them is an OUTCOME and is never a row of its own (DB-001), and
          neither is the EFFECTIVE price: it is derived from these, so comparing it would
          report the same disagreement twice.
        */
        rows.add(row(ListingFieldKey.SALE_PRICE, "Sale Price", money(l.getSalePrice()),
                money(l.getReportedSalePrice()), l.isReportedSalePriceReadable(), unsent));
        rows.add(row(ListingFieldKey.PROMOTION_PRICE, "Promotion Price",
                money(l.getPromotionPrice()), money(l.getReportedPromotionPrice()),
                l.isReportedPromotionPriceReadable(), unsent));
        /*
          🔴 PRD-199.c - the window is ONE fact with two bounds, compared as one row. Two rows
          would let a listing show "start diverged, end aligned", which describes no state a
          marketplace can actually be in.

          ⚠ SYS-034 - where the channel did not report a window at all, this is NOT_READABLE.
          It is never rendered as "no promotion": a channel that reported nothing has not
          told us there is none.
        */
        rows.add(row(ListingFieldKey.PROMOTION_WINDOW, "Promotion window",
                windowText(l.getPromotionStartsAt(), l.getPromotionEndsAt()),
                windowText(l.getReportedPromotionStartsAt(), l.getReportedPromotionEndsAt()),
                l.isReportedPromotionWindowReadable(), unsent));
        rows.add(row(ListingFieldKey.LISTING_STOCK, "Listing stock",
                decimal(l.getPublishedMarketplaceStock()), decimal(l.getReportedStock()),
                l.isReportedStockReadable(), unsent));
        rows.add(row(ListingFieldKey.CHANNEL_CATEGORY, "Channel category",
                l.getIntendedChannelCategory(), l.getReportedChannelCategory(),
                l.isReportedChannelCategoryReadable(), unsent));
        rows.add(mediaRow(l));

        for (ChannelListingAttributeEntity a : attrs) {
            rows.add(row("attribute:" + a.getAttributeKey(), a.getAttributeKey(),
                    a.getIntendedValue(), a.getReportedValue(), a.isReportedReadable(), unsent));
        }
        return rows;
    }

    /**
     * The media comparison row, {@code PRD-183}.
     *
     * <p>🔴 {@code PRD-183.b} and {@code PRD-183.d} — media contributes to {@code DIVERGED}
     * ONLY on a RELIABLE basis: deterministic identity or order the adapter reports
     * consistently. No adapter declares one, so media never produces a divergence here and
     * the row settles {@code MANUAL_REQUIRED} — a NORMAL state ({@code PRD-183.e},
     * {@code SYS-025}), which is neither a failure nor agreement.
     *
     * <p>🔴 {@code PRD-183.c} — no visual, perceptual or image-similarity comparison exists.
     * Counts are reported AS counts and are never read as sameness: five images on each side
     * is not evidence that they are the same five, in the same order.
     */
    private ListingViews.ComparisonRow mediaRow(ChannelListingEntity l) {
        int intendedCount = effectiveMediaCount(l);
        String intended = intendedCount + (intendedCount == 1 ? " image" : " images");

        List<ChannelListingReportedMediaEntity> reported =
                reportedMedia.findByChannelListingIdOrderByPositionAsc(l.getId());
        if (reported.isEmpty()) {
            // 🔴 SYS-034 - the channel returned no media references. That is ABSENCE, and it
            // is never rendered as "no images" or compared against the intended count.
            return new ListingViews.ComparisonRow(ListingFieldKey.MEDIA, "Media order",
                    intended, null, false, ListingViews.ComparisonRow.NOT_READABLE, false);
        }
        return new ListingViews.ComparisonRow(ListingFieldKey.MEDIA, "Media order", intended,
                reported.size() + (reported.size() == 1 ? " image" : " images")
                        + " · order not reliably readable",
                true, ListingViews.ComparisonRow.MANUAL_REQUIRED, false);
    }

    /**
     * The count of media this listing intends to show, {@code PRD-170}.
     *
     * <p>🔴 ALL-OR-NOTHING. Any override at all replaces the master set entirely; a listing
     * holding none falls back to the mapped Sellable Product's master set, and the fallback
     * is never materialised.
     */
    private int effectiveMediaCount(ChannelListingEntity l) {
        List<ChannelListingIntendedMediaEntity> overrides =
                intendedMedia.findByChannelListingIdOrderByPositionAsc(l.getId());
        if (!overrides.isEmpty()) {
            return overrides.size();
        }
        for (ChannelListingSkuEntity k
                : skus.findByChannelListingIdInOrderByPositionAsc(List.of(l.getId()))) {
            if (k.getSellableProductId() != null) {
                return masterMedia.findBySellableProductIdInOrderByPositionAsc(
                        List.of(k.getSellableProductId())).size();
            }
        }
        return 0;
    }

    private ListingViews.ComparisonRow row(String key, String label, String intended,
                                           String reported, boolean readable, boolean unsent) {
        String state;
        boolean resolvable;
        if (!readable) {
            // API-063.c - the channel returned nothing for this field. Never "empty".
            state = ListingViews.ComparisonRow.NOT_READABLE;
            resolvable = false;
        } else if (differs(intended, reported)) {
            // PRD-185.d - an unsent local edit explains the difference and is NOT divergence,
            // so Accept Marketplace is deliberately not offered for it.
            state = unsent ? ListingViews.ComparisonRow.UNSENT
                    : ListingViews.ComparisonRow.DIVERGED;
            resolvable = !unsent;
        } else {
            state = ListingViews.ComparisonRow.ALIGNED;
            resolvable = false;
        }
        return new ListingViews.ComparisonRow(key, label, intended, reported, readable, state,
                resolvable);
    }

    /**
     * What this channel instance declares it can read and write, per field.
     *
     * <p>🔴 THE ADAPTER IS THE DECLARING AUTHORITY ({@code API-063.a}, {@code PRD-125}), and it
     * is asked directly. ⚠ A STORED ROW IS A PERSISTED COPY OF A DECLARATION, NOT A SECOND
     * SOURCE OF TRUTH — nothing in this system writes one, so reading the table alone reported
     * every field UNDECLARED for a channel whose adapter had just successfully read nine
     * listings. The operator saw "what it can read or write is unknown" beside real data.
     *
     * <p>✅ A stored row still WINS where one exists, so a per-instance override remains
     * possible without asking the adapter to know about it.
     *
     * <p>🔴 ABSENT IS STILL NO SUPPORT, NEVER ASSUMED SUPPORT. A channel with no adapter, or an
     * adapter that names no field, declares nothing — exactly as before.
     */
    private List<ListingViews.CapabilityView> capabilityViews(
            ChannelInstanceEntity channel,
            List<ChannelAdapterCapabilityEntity> caps) {
        Map<String, ChannelAdapterCapabilityEntity> byKey = new HashMap<>();
        if (caps != null) {
            caps.forEach(c -> byKey.put(c.getFieldKey(), c));
        }
        ChannelCapabilityDeclaration declared = adapters.forChannelType(channel.getChannelType())
                .map(adapter -> adapter.declareCapability(channel.getId()))
                .orElse(null);

        List<ListingViews.CapabilityView> out = new ArrayList<>();
        for (String key : ListingFieldKey.all()) {
            ChannelAdapterCapabilityEntity stored = byKey.get(key);
            if (stored != null) {
                out.add(new ListingViews.CapabilityView(key, stored.isReadable(), stored.isWritable()));
                continue;
            }
            ChannelCapabilityDeclaration.FieldCapability live =
                    declared == null ? null : declared.forField(key);
            out.add(new ListingViews.CapabilityView(key,
                    live != null && live.readable(),
                    live != null && live.writable()));
        }
        return out;
    }

    /**
     * One promotion window, as the operator reads it.
     *
     * <p>⚠ Presentation only. Both bounds are stored as instants; this exists so the
     * comparison can treat the window as the single fact {@code PRD-199.c} makes it.
     */
    private static String windowText(Instant startsAt, Instant endsAt) {
        return startsAt == null && endsAt == null ? null
                : (startsAt == null ? "?" : startsAt.toString())
                        + " \u2192 " + (endsAt == null ? "?" : endsAt.toString());
    }

    private static boolean differs(Object a, Object b) {
        if (a instanceof BigDecimal left && b instanceof BigDecimal right) {
            // PRJ-043 - compareTo, never equals: 2.50 and 2.5 are the same money.
            return left.compareTo(right) != 0;
        }
        String left = a == null ? null : a.toString();
        String right = b == null ? null : b.toString();
        if (left == null && right == null) {
            return false;
        }
        if (left == null || right == null) {
            return true;
        }
        return !left.trim().equals(right.trim());
    }

    private Actor requireViewer() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.CHANNEL_LISTING_VIEW)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.CHANNEL_LISTING_VIEW);
        }
        return actor;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static long asLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    static String money(BigDecimal value) {
        return value == null ? null : value.toPlainString();
    }

    static String decimal(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros().toPlainString();
    }

    /**
     * A resolved filter-scoped selection.
     *
     * <p>🔴 Identifiers and a channel tally only ({@code PRD-187.c}).
     */
    /**
     * The server-side selection scope for one filter, {@code UX-044}.
     *
     * <p>🔴 {@code byChannel} is aggregated by the DATABASE over the SAME predicate that
     * produced {@code listingIds}, so the breakdown and the total can never disagree. It
     * exists because a batch may span shops and the operator must see that before reviewing
     * it — it is NOT an invitation to fan out ({@code PRD-187.b}).
     *
     * <p>⚠ {@code channelNames} is retained so existing callers keep working; it is exactly
     * the names in {@code byChannel}, in the same order.
     */
    public record SelectionScope(List<UUID> listingIds,
                                 List<String> channelNames,
                                 List<ChannelSelectionCount> byChannel) {
    }

    /** One channel's share of a filter-scoped selection. */
    public record ChannelSelectionCount(String channelName, long selected) {
    }
}
