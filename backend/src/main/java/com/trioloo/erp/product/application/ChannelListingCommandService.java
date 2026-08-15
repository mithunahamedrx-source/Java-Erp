package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.ActivityKind;
import com.trioloo.erp.product.domain.ListingFieldKey;
import com.trioloo.erp.product.domain.LocalLifecycle;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingActivityEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingActivityRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingHighlightEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingHighlightRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuRepository;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductEntity;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Every LOCAL Channel Listing write.
 *
 * <p>🔴 {@code PRD-185} — SAVE IS NOT PUSH. Nothing in this service contacts a channel. A save
 * records intent and stamps {@code intendedContentUpdatedAt}; the outbound attempt is a
 * separate, separately-permissioned operation ({@code API-064.a}). This is the single most
 * important boundary in the feature, and it is enforced structurally: this class has no
 * adapter dependency at all.
 *
 * <p>🔴 {@code PRD-178} / {@code INV-106.2} — mapping is per ORDERABLE SKU and is always
 * EXPLICIT. There is no fuzzy match, no automatic mapping and no automatic Sellable Product
 * creation ({@code PRD-179.c}).
 */
@Service
public class ChannelListingCommandService {

    /** ⚠ The activity source. A local save is always attributable to the ERP, never a channel. */
    private static final String SOURCE_ERP = "ERP";

    /**
     * {@code PRD-200.e} — the provenance of a field the operator accepted from an assistant.
     *
     * <p>🔴 THE ACTOR REMAINS THE PERSON WHO ACCEPTED IT. This marks HOW the value was
     * arrived at, never WHO is answerable for it: a suggestion nobody accepted changed
     * nothing, and a person is accountable for what reaches a customer.
     *
     * <p>🔴 {@code PRD-200.n} — it describes ONE REVISION and does not propagate. A later
     * manual edit of the same field is recorded as an ordinary manual change, because the
     * client marks only the fields it accepted from a candidate on that save.
     */
    private static final String SOURCE_AI_ASSISTED = "AI_ASSISTED";

    /**
     * {@code PRD-202.b} — the two authored languages.
     *
     * <p>🔴 {@code PRD-202.k} — there is no third. Admitting one is a business decision.
     */
    private static final String LANGUAGE_EN = "EN";
    private static final String LANGUAGE_BN = "BN";

    private final ChannelListingRepository listings;
    private final ChannelListingSkuRepository skus;
    private final ChannelListingHighlightRepository highlights;
    private final ChannelListingActivityRepository activities;
    private final ChannelInstanceRepository channels;
    private final SellableProductRepository sellables;
    private final CurrentActor currentActor;
    private final Clock clock;

    public ChannelListingCommandService(ChannelListingRepository listings,
                                        ChannelListingSkuRepository skus,
                                        ChannelListingHighlightRepository highlights,
                                        ChannelListingActivityRepository activities,
                                        ChannelInstanceRepository channels,
                                        SellableProductRepository sellables,
                                        CurrentActor currentActor,
                                        Clock clock) {
        this.listings = listings;
        this.skus = skus;
        this.highlights = highlights;
        this.activities = activities;
        this.channels = channels;
        this.sellables = sellables;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    // =================================================================================
    // Create
    // =================================================================================

    @Transactional
    public UUID create(ChannelListingInput input) {
        Actor actor = requireManager();
        return createInternal(input, actor.id(), Instant.now(clock));
    }

    /**
     * Creates an ERP-first {@code DRAFT}, {@code PRD-188.a}.
     *
     * <p>🔴 {@code external_listing_id} is NOT required. A channel cannot have issued an
     * identifier for a listing that does not exist there yet ({@code PRD-188.b}); demanding
     * one would force the operator to invent channel-owned data ({@code DB-046}).
     *
     * <p>🔴 The Sellable Product mapping is NOT required either — an unmapped Listing is a
     * legitimate, first-class state ({@code PRD-178}), not a validation failure.
     */
    UUID createInternal(ChannelListingInput input, UUID actorId, Instant now) {
        ChannelInstanceEntity channel = resolveChannel(input.channelInstance());
        String external = trimToNull(input.externalListingId());
        if (external != null
                && listings.existsByChannelInstanceIdAndExternalListingIdIgnoreCase(channel.getId(), external)) {
            throw new ChannelListingValidationException("external_listing_id",
                    "External listing id '" + external + "' already exists for channel instance "
                            + channel.getCode() + ".");
        }
        SellableProductEntity sellable = input.mappedSellableSku() == null
                ? null : resolveSellable(input.mappedSellableSku());

        ChannelListingEntity listing = new ChannelListingEntity(UUID.randomUUID(), channel.getId(),
                external, external == null ? LocalLifecycle.DRAFT : LocalLifecycle.PUBLISHED,
                actorId, now);
        // 🔴 `INV-106.1` — creation produces exactly ONE orderable unit, so the
        // listing-level commercial figures are unambiguous and are always written.
        applyIntendedFields(listing, input, true);
        listing.markIntendedContentChanged(actorId, now);
        listings.save(listing);

        // INV-106.1 — a Listing always has at least one orderable unit. For an ERP-first
        // listing that is the single default SKU; a discovered multi-variation listing gets
        // the rest from readback (PRD-190.b).
        ChannelListingSkuEntity sku = new ChannelListingSkuEntity(UUID.randomUUID(), listing.getId(),
                trimToNull(input.channelSku()), 0, actorId, now);
        if (sellable != null) {
            sku.setSellableProductId(sellable.getId());
        }
        sku.setSalePrice(requireNonNegative(input.salePrice(), "sale_price",
                "Sale Price cannot be negative."));
        sku.setPromotionPrice(requireNonNegative(input.promotionPrice(), "promotion_price",
                "Promotion Price cannot be negative."));
        sku.setPromotionStartsAt(input.promotionStartsAt());
        sku.setPromotionEndsAt(input.promotionEndsAt());
        requirePromotionIsCoherent(sku.getPromotionPrice(), sku.getSalePrice(),
                sku.getPromotionStartsAt(), sku.getPromotionEndsAt());
        sku.setPublishedMarketplaceStock(requireNonNegative(input.publishedMarketplaceStock(),
                "published_marketplace_stock", "Published marketplace stock cannot be negative."));
        applyPackage(sku, input);
        skus.save(sku);

        applyHighlights(listing.getId(), LANGUAGE_EN, input.highlights(), actorId, now, input.aiAssistedFields());
        applyHighlights(listing.getId(), LANGUAGE_BN, input.highlightsBn(), actorId, now, input.aiAssistedFields());

        recordChange(listing.getId(), "local_lifecycle", null, listing.getLocalLifecycle().name(),
                "Listing created in the ERP.", actorId, now);
        if (sellable != null) {
            recordChange(listing.getId(), "mapped_sellable_product", null, sellable.getSellableSku(),
                    "SKU " + label(sku) + " mapped to Sellable Product "
                            + sellable.getSellableSku() + ".", actorId, now);
        }
        return listing.getId();
    }

    // =================================================================================
    // Local intended save
    // =================================================================================

    @Transactional
    public void update(UUID id, ChannelListingInput input, Long expectedVersion) {
        Actor actor = requireManager();
        updateInternal(id, input, expectedVersion, actor.id(), Instant.now(clock));
    }

    void updateInternal(UUID id, ChannelListingInput input, Long expectedVersion,
                        UUID actorId, Instant now) {
        ChannelListingEntity listing = require(id);
        requireVersion(listing, expectedVersion);
        /*
          🔴 {@code INV-106.2} / {@code INV-106.3} — PRICE, STOCK AND PARCEL BELONG TO THE
          ORDERABLE UNIT. On a SINGLE-SKU listing the listing-level figures and the unit's are
          the same fact, so an edit must reach both. On a VARIATION listing they are several
          different facts and there is no single listing-level answer, so a listing-level edit
          is IGNORED rather than allowed to overwrite one arbitrary interpretation. Those
          figures are edited per SKU.
        */
        boolean singleSku = skus.findByChannelListingIdOrderByPositionAsc(id).size() == 1;
        if (input.channelInstance() != null) {
            ChannelInstanceEntity channel = resolveChannel(input.channelInstance());
            if (!channel.getId().equals(listing.getChannelInstanceId())) {
                throw new ChannelListingValidationException("channel_instance",
                        "Channel instance is part of Listing identity and cannot be changed.");
            }
        }
        // PRD-188.c / DB-046 — the identifier is channel-owned. It may be filled in for a
        // draft that has none, but it is never retyped over one the channel already issued.
        String external = trimToNull(input.externalListingId());
        if (external != null && listing.getExternalListingId() != null
                && !external.equalsIgnoreCase(listing.getExternalListingId())) {
            throw new ChannelListingValidationException("external_listing_id",
                    "External listing id is channel-owned and cannot be changed once issued.");
        }
        if (input.mappedSellableSku() != null) {
            List<ChannelListingSkuEntity> owned = skus.findByChannelListingIdOrderByPositionAsc(id);
            if (owned.size() != 1) {
                throw new ChannelListingValidationException("mapped_sellable_sku",
                        "This Listing has " + owned.size() + " orderable SKUs. Map each SKU "
                                + "individually — a single mapping would be ambiguous.");
            }
            ChannelListingSkuEntity sku = owned.getFirst();
            SellableProductEntity sellable = resolveSellable(input.mappedSellableSku());
            String before = describeMapping(sku);
            sku.setSellableProductId(sellable.getId());
            sku.touch(actorId, now);
            skus.save(sku);
            recordChange(id, "mapped_sellable_product", before, sellable.getSellableSku(),
                    "SKU " + label(sku) + " mapped to Sellable Product "
                            + sellable.getSellableSku() + ".", actorId, now);
        }
        if (external != null && listing.getExternalListingId() == null) {
            listing.assignExternalListingId(external, now);
            recordChange(id, "external_listing_id", null, external,
                    "Channel identifier recorded.", actorId, now);
        }
        /*
          🔴 RATIFIED — THE SELLER / CHANNEL SKU IS IMMUTABLE ONCE REMOTE IDENTITY EXISTS.
          Before the marketplace has issued this listing an identity the SKU is a purely local
          label and may be corrected freely. Afterwards it is how the channel and the ERP agree
          WHICH orderable unit is which, so renaming it would silently re-point a live unit.
          Changing it then is a relist / identity-management workflow, never an ordinary edit.

          ⚠ Enforced HERE, in the backend. The read-only field on the form is presentation;
          this is the rule.
        */
        String sellerSku = trimToNull(input.channelSku());
        if (sellerSku != null && singleSku) {
            ChannelListingSkuEntity unit = skus.findByChannelListingIdOrderByPositionAsc(id).getFirst();
            if (!sameText(unit.getChannelSku(), sellerSku)) {
                if (listing.getExternalListingId() != null) {
                    throw new ChannelListingValidationException("channel_sku",
                            "Seller SKU cannot be changed once the marketplace has issued this "
                                    + "listing an identity. Changing it requires a relist.");
                }
                String before = unit.getChannelSku();
                unit.setChannelSku(sellerSku);
                unit.touch(actorId, now);
                skus.save(unit);
                recordChange(id, "channel_sku", before, sellerSku,
                        "Seller SKU edited. Not sent to the channel.", actorId, now);
            }
        }
        for (FieldChange change : applyIntendedFields(listing, input, singleSku)) {
            recordChange(id, change.key(), change.before(), change.after(),
                    "Intended " + change.key() + " edited. Not sent to the channel.",
                    actorId, now, provenanceOf(change.key(), input.aiAssistedFields()));
        }
        // 🔴 `INV-106.3` / `PRD-029` — for a SINGLE-SKU listing the listing-level commercial
        // figures and the orderable unit's are the same fact, so the edit must reach both.
        // Leaving them to disagree would make the workspace show a price the operator never
        // typed. A multi-SKU listing is deliberately untouched: there the figures belong to
        // each orderable unit and are edited per SKU.
        applyToSingleSku(id, sku -> {
            sku.setSalePrice(listing.getSalePrice());
            sku.setPromotionPrice(listing.getPromotionPrice());
            sku.setPromotionStartsAt(listing.getPromotionStartsAt());
            sku.setPromotionEndsAt(listing.getPromotionEndsAt());
            sku.setPublishedMarketplaceStock(listing.getPublishedMarketplaceStock());
            // 🔴 `PRD-201.c` — the package facts live on the ORDERABLE unit, and creation is
            // not the only moment a parcel gets weighed. An edit that accepted them and wrote
            // nothing would silently discard a measurement the operator had just taken.
            String parcelBefore = describeParcel(sku);
            applyPackage(sku, input);
            String parcelAfter = describeParcel(sku);
            if (!sameText(parcelBefore, parcelAfter)) {
                recordChange(id, "package", parcelBefore, parcelAfter,
                        "Package facts edited. Not sent to the channel.", actorId, now);
            }
        }, actorId, now);
        applyHighlights(id, LANGUAGE_EN, input.highlights(), actorId, now, input.aiAssistedFields());
        applyHighlights(id, LANGUAGE_BN, input.highlightsBn(), actorId, now, input.aiAssistedFields());
        listing.markIntendedContentChanged(actorId, now);
        listings.save(listing);
    }

    // =================================================================================
    // Mapping — PRD-178, PRD-179
    // =================================================================================

    /**
     * Maps ONE orderable SKU to ONE Sellable Product, {@code INV-106.2}.
     *
     * <p>🔴 Explicit and operator-confirmed. Suggestions are never applied automatically
     * ({@code PRD-179.b}), and an unresolvable SKU never silently creates a Sellable Product
     * ({@code PRD-179.c}).
     */
    @Transactional
    public void mapSku(UUID skuId, String sellableSku, Long expectedVersion) {
        Actor actor = requireManager();
        Instant now = Instant.now(clock);
        ChannelListingSkuEntity sku = skus.findById(skuId)
                .orElseThrow(() -> new ChannelListingValidationException("sku_id",
                        "No Channel Listing SKU with id " + skuId + "."));
        if (expectedVersion != null && sku.getVersion() != expectedVersion) {
            throw new ChannelListingValidationException("version",
                    "This SKU was changed by someone else. Reload and try again.");
        }
        SellableProductEntity sellable = resolveSellable(sellableSku);
        String before = describeMapping(sku);
        sku.setSellableProductId(sellable.getId());
        sku.touch(actor.id(), now);
        skus.save(sku);
        recordChange(sku.getChannelListingId(), "mapped_sellable_product", before,
                sellable.getSellableSku(), "SKU " + label(sku) + " mapped to Sellable Product "
                        + sellable.getSellableSku() + ".", actor.id(), now);
    }

    /**
     * Clears a SKU mapping, returning it to {@code UNMAPPED}.
     *
     * <p>⚠ This changes an ERP-side mapping only. It is not a channel operation and does not
     * delete anything on the marketplace ({@code PRD-178.d}).
     */
    @Transactional
    public void unmapSku(UUID skuId, Long expectedVersion) {
        Actor actor = requireManager();
        Instant now = Instant.now(clock);
        ChannelListingSkuEntity sku = skus.findById(skuId)
                .orElseThrow(() -> new ChannelListingValidationException("sku_id",
                        "No Channel Listing SKU with id " + skuId + "."));
        if (expectedVersion != null && sku.getVersion() != expectedVersion) {
            throw new ChannelListingValidationException("version",
                    "This SKU was changed by someone else. Reload and try again.");
        }
        String before = describeMapping(sku);
        sku.setSellableProductId(null);
        sku.touch(actor.id(), now);
        skus.save(sku);
        recordChange(sku.getChannelListingId(), "mapped_sellable_product", before, null,
                "SKU " + label(sku) + " unmapped.", actor.id(), now);
    }

    /** Sets the intended per-SKU commercial figures. {@code INV-106.3}, {@code INV-106.4}. */
    @Transactional
    public void updateSku(UUID skuId, BigDecimal salePrice, BigDecimal promotionPrice,
                          Instant promotionStartsAt, Instant promotionEndsAt,
                          BigDecimal publishedStock, Long expectedVersion) {
        Actor actor = requireManager();
        Instant now = Instant.now(clock);
        ChannelListingSkuEntity sku = skus.findById(skuId)
                .orElseThrow(() -> new ChannelListingValidationException("sku_id",
                        "No Channel Listing SKU with id " + skuId + "."));
        if (expectedVersion != null && sku.getVersion() != expectedVersion) {
            throw new ChannelListingValidationException("version",
                    "This SKU was changed by someone else. Reload and try again.");
        }
        String salePriceBefore = text(sku.getSalePrice());
        String promotionBefore = text(sku.getPromotionPrice());
        String startsBefore = text(sku.getPromotionStartsAt());
        String endsBefore = text(sku.getPromotionEndsAt());
        String stockBefore = text(sku.getPublishedMarketplaceStock());
        sku.setSalePrice(requireNonNegative(salePrice, "sale_price",
                "Sale Price cannot be negative."));
        sku.setPromotionPrice(requireNonNegative(promotionPrice, "promotion_price",
                "Promotion Price cannot be negative."));
        sku.setPromotionStartsAt(promotionStartsAt);
        sku.setPromotionEndsAt(promotionEndsAt);
        requirePromotionIsCoherent(sku.getPromotionPrice(), sku.getSalePrice(),
                sku.getPromotionStartsAt(), sku.getPromotionEndsAt());
        // INV-106.4 — MANUAL. Never derived from an Inventory position (PRD-193).
        sku.setPublishedMarketplaceStock(requireNonNegative(publishedStock,
                "published_marketplace_stock", "Published marketplace stock cannot be negative."));
        sku.touch(actor.id(), now);
        skus.save(sku);

        ChannelListingEntity listing = require(sku.getChannelListingId());
        listing.markIntendedContentChanged(actor.id(), now);
        listings.save(listing);
        // 🔴 PRD-199.j / PRD-095 - the Sale Price, the Promotion Price and each window
        // bound are recorded as SEPARATE field-level facts. Collapsing them into one
        // "price changed" entry would lose which figure actually moved.
        if (!sameMoney(salePriceBefore, text(sku.getSalePrice()))) {
            recordChange(listing.getId(), ListingFieldKey.SALE_PRICE, salePriceBefore,
                    text(sku.getSalePrice()), "SKU " + label(sku)
                            + " Sale Price edited. Not sent to the channel.", actor.id(), now);
        }
        if (!sameMoney(promotionBefore, text(sku.getPromotionPrice()))) {
            recordChange(listing.getId(), ListingFieldKey.PROMOTION_PRICE, promotionBefore,
                    text(sku.getPromotionPrice()), "SKU " + label(sku)
                            + " Promotion Price edited. Not sent to the channel.", actor.id(), now);
        }
        if (!sameText(startsBefore, text(sku.getPromotionStartsAt()))
                || !sameText(endsBefore, text(sku.getPromotionEndsAt()))) {
            recordChange(listing.getId(), ListingFieldKey.PROMOTION_WINDOW,
                    window(startsBefore, endsBefore),
                    window(text(sku.getPromotionStartsAt()), text(sku.getPromotionEndsAt())),
                    "SKU " + label(sku) + " promotion window edited. Not sent to the channel.",
                    actor.id(), now);
        }
        if (!sameMoney(stockBefore, text(sku.getPublishedMarketplaceStock()))) {
            recordChange(listing.getId(), ListingFieldKey.LISTING_STOCK, stockBefore,
                    text(sku.getPublishedMarketplaceStock()), "SKU " + label(sku)
                            + " published stock edited. Not sent to the channel.", actor.id(), now);
        }
    }

    /**
     * Replaces this Listing's OWN ordered highlights, {@code PRD-198.d}.
     *
     * <p>🔴 {@code PRD-198.c} — ALL-OR-NOTHING, exactly as media resolves ({@code PRD-170}).
     * Any row at all means the Listing holds its own set and that set is the effective one;
     * NO rows means the effective highlights fall back to the mapped Sellable Product's master
     * set. There is no per-slot merge, and the fallback is NEVER copied into these rows.
     *
     * <p>🔴 Three inputs, three different meanings, and they are never conflated:
     *
     * <ul>
     *   <li>{@code null} — the caller said nothing about highlights. Existing rows survive
     *       untouched, so a partial save can never silently discard authored copy.
     *   <li>empty — the caller CLEARED the override. The rows go and the master fallback
     *       resumes.
     *   <li>non-empty — this is now the ordered set, in exactly this order.
     * </ul>
     *
     * <p>🔴 {@code PRD-198.b} — {@code position} is the AUTHORED sequence, taken from the
     * order supplied. It is never re-sorted, never alphabetised and never inferred from
     * insertion or identifier order.
     *
     * <p>⚠ {@code PRD-198.f} — NO length, count or truncation rule is ratified, so none is
     * invented here. Only blank text is refused, because a blank highlight is not content.
     */
    private void applyHighlights(UUID listingId, String language, List<String> supplied,
                                 UUID actorId, Instant now, List<String> aiAssistedFields) {
        if (supplied == null) {
            return;
        }
        List<String> cleaned = new ArrayList<>();
        for (String text : supplied) {
            String trimmed = trimToNull(text);
            if (trimmed == null) {
                throw new ChannelListingValidationException("highlights",
                        "A highlight cannot be blank. Remove it instead.");
            }
            cleaned.add(trimmed);
        }

        List<ChannelListingHighlightEntity> existing =
                highlights.findByChannelListingIdAndLanguageOrderByPositionAsc(listingId, language);
        List<String> before = existing.stream()
                .map(ChannelListingHighlightEntity::getHighlightText).toList();
        if (before.equals(cleaned)) {
            // Nothing moved. A no-op save must not manufacture an activity entry.
            return;
        }

        highlights.deleteAll(existing);
        // ⚠ The unique (channel_listing_id, language, position) constraint is satisfied only
        // once the old rows are gone, so the delete is flushed before the new positions land.
        highlights.flush();
        for (int position = 0; position < cleaned.size(); position++) {
            highlights.save(new ChannelListingHighlightEntity(UUID.randomUUID(), listingId,
                    language, position, cleaned.get(position), actorId, now));
        }

        // 🔴 PRD-202.j - an English change and a Bangla change are SEPARATE field-level
        // facts, so the language is part of the key rather than a note inside the summary.
        String fieldKey = LANGUAGE_EN.equals(language) ? "highlights" : "highlights_bn";
        recordChangeWithProvenance(listingId, fieldKey, summarise(before), summarise(cleaned),
                cleaned.isEmpty()
                        ? (LANGUAGE_EN.equals(language)
                            ? "Listing highlights cleared. The Sellable Product master set applies again."
                            : "Bangla highlights cleared. The English highlights apply again.")
                        : (LANGUAGE_EN.equals(language) ? "Listing highlights set to " : "Bangla highlights set to ")
                                + cleaned.size()
                                + (cleaned.size() == 1 ? " entry." : " entries, in this order."),
                actorId, now, aiAssistedFields);
    }

    /** ⚠ A named overload so the highlight call site reads as provenance-aware. */
    private void recordChangeWithProvenance(UUID listingId, String fieldKey, String before,
                                            String after, String summary, UUID actorId,
                                            Instant now, List<String> aiAssistedFields) {
        recordChange(listingId, fieldKey, before, after, summary, actorId, now,
                provenanceOf(fieldKey, aiAssistedFields));
    }

    /** ⚠ A readable BEFORE/AFTER for the activity trail. Never the storage representation. */
    private static String summarise(List<String> texts) {
        return texts.isEmpty() ? null : String.join(" \u00b7 ", texts);
    }

    // =================================================================================
    // Accept Marketplace — PRD-183
    // =================================================================================

    /**
     * Adopts the channel-REPORTED value of one field as the ERP intent, {@code PRD-183}.
     *
     * <p>🔴 An EXPLICIT, per-field operator decision. Divergence is never resolved
     * automatically in either direction ({@code PRD-183.c}), and a value the adapter could
     * not read can never be accepted — there is nothing to accept ({@code SYS-034}).
     */
    @Transactional
    public void acceptMarketplaceValue(UUID listingId, String field) {
        Actor actor = requireManager();
        Instant now = Instant.now(clock);
        ChannelListingEntity listing = require(listingId);
        String key = field == null ? "" : field.trim();
        String before;
        String after;
        switch (key) {
            case ListingFieldKey.TITLE -> {
                requireReadable(listing.isReportedTitleReadable(), "Title");
                before = listing.getIntendedTitle();
                after = listing.getChannelReportedTitle();
                listing.setIntendedTitle(after);
            }
            case ListingFieldKey.DESCRIPTION -> {
                requireReadable(listing.isReportedDescriptionReadable(), "Description");
                before = listing.getIntendedDescription();
                after = listing.getReportedDescription();
                listing.setIntendedDescription(after);
            }
            case ListingFieldKey.SALE_PRICE -> {
                requireReadable(listing.isReportedSalePriceReadable(), "Sale Price");
                before = text(listing.getSalePrice());
                after = text(listing.getReportedSalePrice());
                listing.setSalePrice(listing.getReportedSalePrice());
                // 🔴 PRD-199.e holds even when adopting a channel value. Accepting a base
                // price BELOW the scheduled promotion is refused, never silently reordered:
                // the operator chose both figures and only they know which was wrong.
                requirePromotionIsCoherent(listing.getPromotionPrice(), listing.getSalePrice(),
                        listing.getPromotionStartsAt(), listing.getPromotionEndsAt());
                applyToSingleSku(listingId, sku -> sku.setSalePrice(listing.getReportedSalePrice()),
                        actor.id(), now);
            }
            case ListingFieldKey.PROMOTION_PRICE -> {
                requireReadable(listing.isReportedPromotionPriceReadable(), "Promotion Price");
                before = text(listing.getPromotionPrice());
                after = text(listing.getReportedPromotionPrice());
                listing.setPromotionPrice(listing.getReportedPromotionPrice());
                requirePromotionIsCoherent(listing.getPromotionPrice(), listing.getSalePrice(),
                        listing.getPromotionStartsAt(), listing.getPromotionEndsAt());
                applyToSingleSku(listingId,
                        sku -> sku.setPromotionPrice(listing.getReportedPromotionPrice()),
                        actor.id(), now);
            }
            case ListingFieldKey.PROMOTION_WINDOW -> {
                requireReadable(listing.isReportedPromotionWindowReadable(), "Promotion window");
                before = window(text(listing.getPromotionStartsAt()),
                        text(listing.getPromotionEndsAt()));
                listing.setPromotionStartsAt(listing.getReportedPromotionStartsAt());
                listing.setPromotionEndsAt(listing.getReportedPromotionEndsAt());
                after = window(text(listing.getPromotionStartsAt()),
                        text(listing.getPromotionEndsAt()));
                requirePromotionIsCoherent(listing.getPromotionPrice(), listing.getSalePrice(),
                        listing.getPromotionStartsAt(), listing.getPromotionEndsAt());
                applyToSingleSku(listingId, sku -> {
                    sku.setPromotionStartsAt(listing.getReportedPromotionStartsAt());
                    sku.setPromotionEndsAt(listing.getReportedPromotionEndsAt());
                }, actor.id(), now);
            }
            case ListingFieldKey.LISTING_STOCK -> {
                requireReadable(listing.isReportedStockReadable(), "Listing stock");
                before = text(listing.getPublishedMarketplaceStock());
                after = text(listing.getReportedStock());
                listing.setPublishedMarketplaceStock(listing.getReportedStock());
                applyToSingleSku(listingId,
                        sku -> sku.setPublishedMarketplaceStock(listing.getReportedStock()),
                        actor.id(), now);
            }
            case ListingFieldKey.CHANNEL_CATEGORY -> {
                requireReadable(listing.isReportedChannelCategoryReadable(), "Channel category");
                before = listing.getIntendedChannelCategory();
                after = listing.getReportedChannelCategory();
                listing.setIntendedChannelCategory(after);
            }
            default -> throw new ChannelListingValidationException("field",
                    "'" + key + "' is not an acceptable Listing field.");
        }
        // PRD-183.b — accepting makes intent equal to what the channel already holds, so the
        // ERP owes the channel nothing. Stamping the push time is what clears the derived
        // unsent condition without inventing a remote operation.
        listing.markIntendedContentChanged(actor.id(), now);
        listing.recordSuccessfulPush(now);
        listings.save(listing);
        recordChange(listingId, key, before, after,
                "Accepted the marketplace value for " + key + ".", actor.id(), now);
    }

    // =================================================================================
    // Internals
    // =================================================================================

    /**
     * Applies the intended surface and reports which facts actually moved.
     *
     * <p>Only genuine changes are returned, so the activity history records edits rather than
     * every save ({@code PRD-129}).
     */
    /**
     * Writes the listing-level intended content.
     *
     * @param commercial whether the PER-ORDERABLE-UNIT figures — price, promotion window and
     *     listing stock — may be written from this listing-level edit. False on a VARIATION
     *     listing, where they belong to each SKU separately ({@code INV-106.2}) and one
     *     listing-level value could only stand for an arbitrary one of them.
     */
    private List<FieldChange> applyIntendedFields(ChannelListingEntity listing,
                                                  ChannelListingInput input,
                                                  boolean commercial) {
        List<FieldChange> changes = new ArrayList<>();
        String title = trimToNull(input.intendedTitle());
        if (!sameText(listing.getIntendedTitle(), title)) {
            changes.add(new FieldChange(ListingFieldKey.TITLE, listing.getIntendedTitle(), title));
        }
        listing.setIntendedTitle(title);

        String description = trimToNull(input.intendedDescription());
        if (!sameText(listing.getIntendedDescription(), description)) {
            changes.add(new FieldChange(ListingFieldKey.DESCRIPTION,
                    listing.getIntendedDescription(), description));
        }
        listing.setIntendedDescription(description);

        // 🔴 `INV-106.2` — listing-level commercial figures, written only where they mean
        // something: a listing with exactly one orderable unit.
        if (commercial) {
            BigDecimal salePrice = requireNonNegative(input.salePrice(), "sale_price",
                    "Sale Price cannot be negative.");
            BigDecimal promotionPrice = requireNonNegative(input.promotionPrice(), "promotion_price",
                    "Promotion Price cannot be negative.");
            requirePromotionIsCoherent(promotionPrice, salePrice,
                    input.promotionStartsAt(), input.promotionEndsAt());
            if (!sameMoney(text(listing.getSalePrice()), text(salePrice))) {
                changes.add(new FieldChange(ListingFieldKey.SALE_PRICE,
                        text(listing.getSalePrice()), text(salePrice)));
            }
            listing.setSalePrice(salePrice);
            if (!sameMoney(text(listing.getPromotionPrice()), text(promotionPrice))) {
                changes.add(new FieldChange(ListingFieldKey.PROMOTION_PRICE,
                        text(listing.getPromotionPrice()), text(promotionPrice)));
            }
            listing.setPromotionPrice(promotionPrice);
            // 🔴 PRD-199.j - the window is one operator-meaningful fact with two bounds, so it is
            // recorded as one entry naming both. It is never folded into the price change.
            String windowBefore = window(text(listing.getPromotionStartsAt()),
                    text(listing.getPromotionEndsAt()));
            listing.setPromotionStartsAt(input.promotionStartsAt());
            listing.setPromotionEndsAt(input.promotionEndsAt());
            String windowAfter = window(text(listing.getPromotionStartsAt()),
                    text(listing.getPromotionEndsAt()));
            if (!sameText(windowBefore, windowAfter)) {
                changes.add(new FieldChange(ListingFieldKey.PROMOTION_WINDOW, windowBefore, windowAfter));
            }

            // INV-106.4 / PRD-193 — MANUAL. There is no automatic Inventory→Listing stock sync.
            BigDecimal stock = requireNonNegative(input.publishedMarketplaceStock(),
                    "published_marketplace_stock", "Published marketplace stock cannot be negative.");
            if (!sameMoney(text(listing.getPublishedMarketplaceStock()), text(stock))) {
                changes.add(new FieldChange(ListingFieldKey.LISTING_STOCK,
                        text(listing.getPublishedMarketplaceStock()), text(stock)));
            }
            listing.setPublishedMarketplaceStock(stock);
        }

        /*
          🔴 PRD-202.b/.e - the Bangla override is OPTIONAL and a blank one is an ABSENT one.
          `trimToNull` is what makes whitespace fall back rather than shadow the English
          content with nothing, and it is why no English value is ever copied across.

          🔴 PRD-202.j - each language is its own field-level fact.
        */
        String titleBn = trimToNull(input.intendedTitleBn());
        if (!sameText(listing.getIntendedTitleBn(), titleBn)) {
            changes.add(new FieldChange("intended_title_bn", listing.getIntendedTitleBn(), titleBn));
        }
        listing.setIntendedTitleBn(titleBn);

        String descriptionBn = trimToNull(input.intendedDescriptionBn());
        if (!sameText(listing.getIntendedDescriptionBn(), descriptionBn)) {
            changes.add(new FieldChange("intended_description_bn",
                    listing.getIntendedDescriptionBn(), descriptionBn));
        }
        listing.setIntendedDescriptionBn(descriptionBn);

        String intent = trimToNull(input.publicationIntent());
        if (!sameText(listing.getPublicationIntent(), intent)) {
            changes.add(new FieldChange(ListingFieldKey.PUBLICATION_INTENT,
                    listing.getPublicationIntent(), intent));
        }
        listing.setPublicationIntent(intent);

        // PRD-192 — the channel category is adapter-owned vocabulary mirrored as text. The
        // ERP owns no marketplace taxonomy of its own.
        String category = trimToNull(input.intendedChannelCategory());
        if (!sameText(listing.getIntendedChannelCategory(), category)) {
            changes.add(new FieldChange(ListingFieldKey.CHANNEL_CATEGORY,
                    listing.getIntendedChannelCategory(), category));
        }
        listing.setIntendedChannelCategory(category);
        listing.setIntendedChannelCategoryRef(trimToNull(input.intendedChannelCategoryRef()));
        return changes;
    }

    private void applyToSingleSku(UUID listingId, Consumer<ChannelListingSkuEntity> mutation,
                                  UUID actorId, Instant now) {
        List<ChannelListingSkuEntity> owned = skus.findByChannelListingIdOrderByPositionAsc(listingId);
        if (owned.size() != 1) {
            return; // Multi-SKU listings are accepted per SKU, never in bulk from the listing.
        }
        ChannelListingSkuEntity sku = owned.getFirst();
        mutation.accept(sku);
        sku.touch(actorId, now);
        skus.save(sku);
    }

    /**
     * Records a local {@code FIELD_CHANGE}, {@code PRD-129}.
     *
     * <p>🔴 {@code PRJ-091} — actor and time are captured HERE, where the authoritative action
     * occurs, and are never reconstructed afterwards from logs.
     */
    private void recordChange(UUID listingId, String fieldKey, String before, String after,
                              String summary, UUID actorId, Instant now) {
        recordChange(listingId, fieldKey, before, after, summary, actorId, now, SOURCE_ERP);
    }

    /**
     * The same field-level fact, carrying its provenance.
     *
     * <p>🔴 {@code PRD-200.e} — an accepted AI candidate is an ORDINARY field change with an
     * ordinary actor. Nothing about the entry's shape changes; only its {@code source} says
     * how the words were arrived at.
     */
    private void recordChange(UUID listingId, String fieldKey, String before, String after,
                              String summary, UUID actorId, Instant now, String source) {
        activities.save(new ChannelListingActivityEntity(UUID.randomUUID(), listingId,
                ActivityKind.FIELD_CHANGE, summary, source, actorId, now)
                .withChange(fieldKey, before, after));
    }

    /**
     * 🔴 {@code PRD-200.n} — provenance describes THIS save's changes and nothing else.
     *
     * <p>⚠ A field is AI-assisted only when the client says the operator accepted a candidate
     * for it ON THIS SAVE. A field edited by hand afterwards is manual, even though an older
     * revision of it came from an assistant — continuing to label it AI would misreport a
     * human's own words back to them.
     */
    private static String provenanceOf(String fieldKey, List<String> aiAssistedFields) {
        return aiAssistedFields != null && aiAssistedFields.contains(fieldKey)
                ? SOURCE_AI_ASSISTED : SOURCE_ERP;
    }

    /** A fact that genuinely moved during a local save. */
    private record FieldChange(String key, String before, String after) {
    }

    /**
     * The mapping as an operator can read it, for the activity trail.
     *
     * <p>🔴 THE SELLABLE SKU, NEVER THE UUID. {@code PRD-179.e} records mapping, re-mapping
     * and un-mapping on the listing's history, and a history entry reading
     * {@code 7a8a2eac-… → null} tells the person auditing it nothing about which product was
     * unmapped. The identifier they know is the Sellable SKU.
     *
     * <p>⚠ Falls back to the id only if the product cannot be resolved — an unreadable
     * reference is still better recorded than dropped ({@code SYS-034}).
     */
    private String describeMapping(ChannelListingSkuEntity sku) {
        UUID mapped = sku.getSellableProductId();
        if (mapped == null) {
            return null;
        }
        return sellables.findById(mapped)
                .map(SellableProductEntity::getSellableSku)
                .orElseGet(mapped::toString);
    }

    private static String text(BigDecimal value) {
        // TEC-015 / PRJ-045 — money leaves the domain as an exact decimal string, never a
        // binary floating point value.
        return value == null ? null : value.toPlainString();
    }

    private static boolean sameText(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }

    /**
     * 🔴 {@code PRJ-043} — {@code compareTo}, never {@code equals}. {@code 10} and
     * {@code 10.00} are the same amount and a scale difference must never be reported as an
     * edit.
     */
    private static boolean sameMoney(String a, String b) {
        if (a == null || b == null) {
            return a == null && b == null;
        }
        return new BigDecimal(a).compareTo(new BigDecimal(b)) == 0;
    }

    private ChannelListingEntity require(UUID id) {
        return listings.findById(id).orElseThrow(() -> new ChannelListingNotFoundException(id));
    }

    private static void requireVersion(ChannelListingEntity listing, Long expectedVersion) {
        if (expectedVersion != null && listing.getVersion() != expectedVersion) {
            throw new ChannelListingValidationException("version",
                    "This Channel Listing was changed by someone else. Reload and try again.");
        }
    }

    private static void requireReadable(boolean readable, String label) {
        if (!readable) {
            throw new ChannelListingValidationException("field",
                    label + " was not readable from the channel, so there is no marketplace "
                            + "value to accept.");
        }
    }

    private ChannelInstanceEntity resolveChannel(String code) {
        requireText(code, "channel_instance", "Channel instance is required.");
        ChannelInstanceEntity channel = channels.findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new ChannelListingValidationException("channel_instance",
                        "No registered Channel Instance '" + code.trim() + "'."));
        if (channel.getRecordStatus() != RecordStatus.ACTIVE) {
            throw new ChannelListingValidationException("channel_instance",
                    "Channel Instance '" + channel.getCode() + "' is " + channel.getRecordStatus()
                            + " and cannot receive a new Listing.");
        }
        return channel;
    }

    private SellableProductEntity resolveSellable(String sku) {
        requireText(sku, "mapped_sellable_sku", "Mapped Sellable SKU is required.");
        return sellables.findBySellableSkuIgnoreCase(sku.trim())
                .orElseThrow(() -> new ChannelListingValidationException("mapped_sellable_sku",
                        "No Sellable Product with SKU '" + sku.trim()
                                + "'. The mapping must resolve explicitly."));
    }

    private Actor requireManager() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.CHANNEL_LISTING_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.CHANNEL_LISTING_MANAGE);
        }
        return actor;
    }

    private static String label(ChannelListingSkuEntity sku) {
        if (sku.getChannelSku() != null) {
            return sku.getChannelSku();
        }
        return sku.getVariationLabel() == null ? "#" + (sku.getPosition() + 1) : sku.getVariationLabel();
    }

    /**
     * 🔴 {@code PRD-199.e} - the Promotion Price must not be above the Sale Price.
     *
     * <p>✅ EQUALITY IS VALID and means simply that no discount is being offered.
     *
     * <p>🔴 The values are NEVER silently swapped. A refusal tells the operator that what
     * they typed is wrong; a swap would quietly publish a price they did not choose.
     * Either value may still be ABSENT, which is not a violation.
     *
     * <p>🔴 {@code PRJ-043} - compared with {@code compareTo}, never {@code equals}, so
     * {@code 1200} and {@code 1200.00} are correctly the same amount.
     */
    /**
     * The package publishing facts, {@code PRD-201}.
     *
     * <p>🔴 {@code PRD-201.b} — recorded UNCONDITIONALLY. No channel, adapter or declared
     * schema is consulted: a marketplace requirement is a reason to SEND these, never a
     * precondition for writing them down.
     *
     * <p>🔴 {@code PRD-201.f} — an unset fact stays NULL. It is never coerced to zero, which
     * would turn an unweighed parcel into a parcel weighing nothing.
     */
    private void applyPackage(ChannelListingSkuEntity sku, ChannelListingInput input) {
        sku.setPackageWeightKg(requirePositiveOrAbsent(input.packageWeightKg(),
                "package_weight_kg", "Package weight"));
        sku.setPackageLengthCm(requirePositiveOrAbsent(input.packageLengthCm(),
                "package_length_cm", "Package length"));
        sku.setPackageWidthCm(requirePositiveOrAbsent(input.packageWidthCm(),
                "package_width_cm", "Package width"));
        sku.setPackageHeightCm(requirePositiveOrAbsent(input.packageHeightCm(),
                "package_height_cm", "Package height"));
        sku.setPackageContent(trimToNull(input.packageContent()));
    }

    /**
     * The parcel as ONE operator-meaningful fact, for the activity entry.
     *
     * <p>⚠ Weight, the three sides and the contents are read together — a courier quote needs
     * all of them — so they are recorded as one change rather than five. {@code PRD-201.f}:
     * an absent measurement reads as {@code —}, never as zero.
     */
    private static String describeParcel(ChannelListingSkuEntity sku) {
        String dimensions = sku.getPackageLengthCm() == null && sku.getPackageWidthCm() == null
                && sku.getPackageHeightCm() == null
                ? "—"
                : text(sku.getPackageLengthCm()) + "×" + text(sku.getPackageWidthCm())
                        + "×" + text(sku.getPackageHeightCm()) + " cm";
        String weight = sku.getPackageWeightKg() == null
                ? "—" : text(sku.getPackageWeightKg()) + " kg";
        String content = sku.getPackageContent() == null ? "—" : sku.getPackageContent();
        if ("—".equals(dimensions) && "—".equals(weight) && "—".equals(content)) {
            return null;
        }
        return weight + " · " + dimensions + " · " + content;
    }

    /**
     * 🔴 {@code PRD-201.f} — ABSENT is fine; ZERO is not.
     *
     * <p>⚠ A parcel with a zero side does not exist, and a parcel weighing 0 kg is a claim
     * rather than a gap. Refusing both keeps "not measured" and "measured as nothing" apart.
     */
    private static BigDecimal requirePositiveOrAbsent(BigDecimal value, String field, String label) {
        if (value != null && value.signum() <= 0) {
            throw new ChannelListingValidationException(field,
                    label + " must be greater than zero. Leave it empty if it is not known.");
        }
        return value;
    }

    /**
     * The whole of {@code PRD-199.c} and {@code PRD-199.e}, in one place.
     *
     * <p>🔴 A promotion price may never sit ABOVE the base Sale Price — a "promotion" that
     * costs more is not one. Equality is VALID: a promotion that offers no reduction is an
     * ordinary thing to schedule.
     *
     * <p>🔴 A promotion price REQUIRES both window bounds, and the close must be LATER than
     * the open. A promotion price with no window would be a permanent second price, which is
     * precisely the ambiguity {@code PRD-199} exists to remove.
     *
     * <p>🔴 NOTHING IS SILENTLY SWAPPED OR CLEARED. The operator entered these values and
     * only they know which one was the mistake ({@code SYS-032}, {@code PRJ-200}).
     */
    private static void requirePromotionIsCoherent(BigDecimal promotionPrice,
                                                   BigDecimal salePrice,
                                                   Instant startsAt,
                                                   Instant endsAt) {
        if (promotionPrice != null && salePrice != null
                // PRJ-043 - compareTo, never equals: 1200.00 and 1200 are the same money.
                && promotionPrice.compareTo(salePrice) > 0) {
            throw new ChannelListingValidationException("promotion_price",
                    "Promotion Price (" + promotionPrice.toPlainString() + ") cannot be above "
                            + "the Sale Price (" + salePrice.toPlainString() + "). The Sale "
                            + "Price is the normal price; the Promotion Price is the temporary "
                            + "one it is reduced to.");
        }
        if (promotionPrice != null && (startsAt == null || endsAt == null)) {
            throw new ChannelListingValidationException("promotion_window",
                    "A Promotion Price needs both Promotion Starts and Promotion Ends. "
                            + "Without a window it would be a permanent second price.");
        }
        if (startsAt != null && endsAt != null && !endsAt.isAfter(startsAt)) {
            throw new ChannelListingValidationException("promotion_ends_at",
                    "Promotion Ends must be later than Promotion Starts.");
        }
    }

    /** ⚠ A readable BEFORE/AFTER for one window. Never the storage representation. */
    private static String window(String startsAt, String endsAt) {
        return startsAt == null && endsAt == null ? null
                : (startsAt == null ? "?" : startsAt) + " \u2192 " + (endsAt == null ? "?" : endsAt);
    }

    /** ⚠ {@code null}-safe text of an instant, for the activity trail only. */
    private static String text(Instant value) {
        return value == null ? null : value.toString();
    }

    private static BigDecimal requireNonNegative(BigDecimal value, String field, String message) {
        // PRJ-043 — signum, never equals. Scale must not decide a monetary comparison.
        if (value != null && value.signum() < 0) {
            throw new ChannelListingValidationException(field, message);
        }
        return value;
    }

    private static void requireText(String value, String field, String message) {
        if (value == null || value.isBlank()) {
            throw new ChannelListingValidationException(field, message);
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * The LOCAL editable surface of a Channel Listing.
     *
     * <p>🔴 Every component is ERP-intended. No channel-REPORTED value is writable here — the
     * reported side belongs to inbound readback alone ({@code PRD-181.a}).
     */
    public record ChannelListingInput(String channelInstance,
                                      String externalListingId,
                                      String channelSku,
                                      String mappedSellableSku,
                                      String intendedTitle,
                                      String intendedDescription,
                                      BigDecimal salePrice,
                                      /*
                                        🔴 `PRD-199.b` — the OPTIONAL temporary selling price
                                        and its REQUIRED window. `MRP` is gone: `PRD-199`
                                        supersedes `PRD-197` and MRP is no longer a Listing
                                        price this system maintains.
                                      */
                                      BigDecimal promotionPrice,
                                      Instant promotionStartsAt,
                                      Instant promotionEndsAt,
                                      BigDecimal publishedMarketplaceStock,
                                      String publicationIntent,
                                      String intendedChannelCategory,
                                      String intendedChannelCategoryRef,
                                      /*
                                        🔴 `PRD-198.d` — the Listing's OWN ordered highlights.
                                        `null` leaves them untouched; an EMPTY list clears the
                                        override and restores the master fallback.
                                      */
                                      List<String> highlights,
                                      /*
                                        🔴 `PRD-202.b` — the OPTIONAL Bangla overrides. `null`
                                        leaves them untouched; a BLANK one is an ABSENT one and
                                        falls back to English. No English value is ever copied
                                        into them (`PRD-202.d`).
                                      */
                                      String intendedTitleBn,
                                      String intendedDescriptionBn,
                                      List<String> highlightsBn,
                                      /*
                                        🔴 `PRD-201` — the package publishing facts. Authorable
                                        with no channel, adapter or schema (`PRD-201.b`), and
                                        recorded against the ORDERABLE SKU (`PRD-201.c`).
                                        Weight is KILOGRAMS, dimensions CENTIMETRES
                                        (`PRD-201.e`).
                                      */
                                      BigDecimal packageWeightKg,
                                      BigDecimal packageLengthCm,
                                      BigDecimal packageWidthCm,
                                      BigDecimal packageHeightCm,
                                      String packageContent,
                                      /*
                                        🔴 `PRD-200.e`/`.n` — the field keys the operator
                                        accepted from an AI candidate ON THIS SAVE. It marks
                                        HOW the words were arrived at; the ACTOR is still the
                                        person. It does not propagate to later manual edits.
                                      */
                                      List<String> aiAssistedFields) {
    }
}
