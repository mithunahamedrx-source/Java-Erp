package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.ActivityKind;
import com.trioloo.erp.product.domain.MediaRole;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingActivityEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingActivityRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingIntendedMediaEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingIntendedMediaRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingReportedMediaEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingReportedMediaRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuRepository;
import com.trioloo.erp.product.infrastructure.persistence.MediaAssetEntity;
import com.trioloo.erp.product.infrastructure.persistence.MediaAssetRepository;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductMediaEntity;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductMediaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Media for Sellable Products and Channel Listings, {@code PRD-167} – {@code PRD-171},
 * {@code PRD-182}.
 *
 * <p>🔴 THE EFFECTIVE-MEDIA RULE ({@code PRD-170}) is the heart of this service: a listing
 * that holds ANY intended media uses ITS OWN SET; otherwise the effective set DERIVES from
 * the mapped Sellable Product's master media.
 *
 * <p>🔴 The fallback is computed on read and is NEVER materialised as listing-owned rows
 * ({@code PRD-170.b}). Copying master rows would make a fallback indistinguishable from a
 * deliberate override the moment the master changed.
 *
 * <p>🔴 {@code PRD-171.a} — this resolution is not display-only. It is what a future adapter
 * would publish, so outbound payload construction uses exactly the same method.
 */
@Service
public class ChannelListingMediaService {

    private final ChannelListingRepository listings;
    private final ChannelListingSkuRepository skus;
    private final ChannelListingIntendedMediaRepository intendedMedia;
    private final ChannelListingReportedMediaRepository reportedMedia;
    private final SellableProductMediaRepository masterMedia;
    private final MediaAssetRepository assets;
    private final ChannelListingActivityRepository activity;
    private final CurrentActor currentActor;
    private final Clock clock;

    public ChannelListingMediaService(ChannelListingRepository listings,
                                      ChannelListingSkuRepository skus,
                                      ChannelListingIntendedMediaRepository intendedMedia,
                                      ChannelListingReportedMediaRepository reportedMedia,
                                      SellableProductMediaRepository masterMedia,
                                      MediaAssetRepository assets,
                                      ChannelListingActivityRepository activity,
                                      CurrentActor currentActor,
                                      Clock clock) {
        this.listings = listings;
        this.skus = skus;
        this.intendedMedia = intendedMedia;
        this.reportedMedia = reportedMedia;
        this.masterMedia = masterMedia;
        this.assets = assets;
        this.activity = activity;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    /**
     * The three media concepts plus the derived effective set, {@code PRD-182}.
     *
     * <p>🔴 Master media is READ-ONLY here. Nothing on the listing media surface can change
     * {@code E-058}'s master set ({@code PRD-184.c}).
     */
    @Transactional(readOnly = true)
    public ListingViews.MediaSetView mediaSet(UUID listingId) {
        requireViewer();
        ChannelListingEntity listing = listings.findById(listingId)
                .orElseThrow(() -> new ChannelListingNotFoundException(listingId));

        List<ChannelListingIntendedMediaEntity> overrides =
                intendedMedia.findByChannelListingIdOrderByPositionAsc(listingId);
        List<SellableProductMediaEntity> master = masterMediaFor(listing);
        List<ChannelListingReportedMediaEntity> reported =
                reportedMedia.findByChannelListingIdOrderByPositionAsc(listingId);

        Map<UUID, MediaAssetEntity> assetById = loadAssets(overrides, master);

        List<ListingViews.MediaView> masterViews = master.stream()
                .map(m -> toView(m.getId(), m.getMediaAssetId(), assetById, m.getMediaRole(),
                        m.getPosition(), ListingViews.MediaView.SELLABLE_MASTER))
                .toList();

        List<ListingViews.MediaView> intendedViews = overrides.stream()
                .map(m -> toView(m.getId(), m.getMediaAssetId(), assetById, m.getMediaRole(),
                        m.getPosition(), ListingViews.MediaView.LISTING_INTENDED))
                .toList();

        List<ListingViews.MediaView> reportedViews = new ArrayList<>();
        for (ChannelListingReportedMediaEntity r : reported) {
            reportedViews.add(new ListingViews.MediaView(r.getId(), null,
                    r.getExternalReference(), MediaRole.GALLERY, r.getPosition(),
                    ListingViews.MediaView.CHANNEL_REPORTED));
        }

        // PRD-170 - ALL-OR-NOTHING. Any override at all replaces the master set entirely;
        // there is deliberately no per-slot merge and no positional blending (PRD-170.d).
        boolean fallback = intendedViews.isEmpty();
        List<ListingViews.MediaView> effective = fallback ? masterViews : intendedViews;

        return new ListingViews.MediaSetView(masterViews, intendedViews, reportedViews,
                effective, fallback, false);
    }

    /**
     * The effective intended media references for an outbound payload, {@code PRD-171.a}.
     *
     * <p>🔴 Uses the SAME resolution as the read model. A listing relying on fallback would
     * otherwise display the product's images and publish nothing — two different answers to
     * one question.
     */
    @Transactional(readOnly = true)
    public List<String> effectiveMediaReferences(ChannelListingEntity listing) {
        List<ChannelListingIntendedMediaEntity> overrides =
                intendedMedia.findByChannelListingIdOrderByPositionAsc(listing.getId());
        if (!overrides.isEmpty()) {
            Map<UUID, MediaAssetEntity> byId = indexAssets(
                    overrides.stream().map(ChannelListingIntendedMediaEntity::getMediaAssetId).toList());
            return overrides.stream()
                    .map(o -> byId.get(o.getMediaAssetId()))
                    .filter(a -> a != null)
                    .map(MediaAssetEntity::getStorageReference)
                    .toList();
        }
        List<SellableProductMediaEntity> master = masterMediaFor(listing);
        Map<UUID, MediaAssetEntity> byId = indexAssets(
                master.stream().map(SellableProductMediaEntity::getMediaAssetId).toList());
        return master.stream()
                .map(m -> byId.get(m.getMediaAssetId()))
                .filter(a -> a != null)
                .map(MediaAssetEntity::getStorageReference)
                .toList();
    }

    /**
     * Replaces the listing's intended media override, {@code PRD-170.d}.
     *
     * <p>🔴 At most ONE {@code PRIMARY} ({@code PRD-168.a}); {@code PRIMARY} is OPTIONAL and
     * is NEVER auto-selected ({@code PRD-168.b}, {@code PRD-168.c}). Order is EXPLICIT and
     * comes from the supplied sequence, never from insertion order ({@code PRD-168.d}).
     *
     * <p>🔴 Saving media is LOCAL. Nothing here contacts a channel ({@code PRD-185.a}).
     */
    @Transactional
    public void replaceIntendedMedia(UUID listingId, List<IntendedMediaInput> items) {
        Actor actor = requireManager();
        Instant now = clock.instant();
        ChannelListingEntity listing = listings.findById(listingId)
                .orElseThrow(() -> new ChannelListingNotFoundException(listingId));

        long primaries = items.stream().filter(IntendedMediaInput::primary).count();
        if (primaries > 1) {
            throw new ChannelListingValidationException(
                    "A listing may have at most one primary image. " + primaries
                            + " were supplied.");
        }
        for (IntendedMediaInput item : items) {
            if (!assets.existsById(item.mediaAssetId())) {
                throw new ChannelListingValidationException(
                        "Media asset " + item.mediaAssetId() + " does not exist.");
            }
        }

        int before = intendedMedia.findByChannelListingIdOrderByPositionAsc(listingId).size();
        intendedMedia.deleteByChannelListingId(listingId);
        intendedMedia.flush();

        int position = 0;
        for (IntendedMediaInput item : items) {
            intendedMedia.save(new ChannelListingIntendedMediaEntity(UUID.randomUUID(),
                    listingId, item.mediaAssetId(),
                    item.primary() ? MediaRole.PRIMARY : MediaRole.GALLERY, position++));
        }

        listing.markIntendedContentChanged(actor.id(), now);
        listings.save(listing);

        activity.save(new ChannelListingActivityEntity(UUID.randomUUID(), listingId,
                ActivityKind.FIELD_CHANGE,
                items.isEmpty()
                        ? "Listing media override removed — using Sellable Product media"
                        : "Intended media set to " + items.size() + " image(s)",
                "Media editor", actor.id(), now)
                .withChange("media", before + " image(s)", items.size() + " image(s)"));
    }

    /**
     * Adopts the channel-reported media as the listing's intended media, {@code PRD-184.b}.
     *
     * <p>🔴 {@code PRD-182.c} / {@code PRD-184.c} — this affects LISTING intended media only.
     * {@code E-058} master media is NEVER modified. A marketplace-side edit on one shop must
     * not rewrite the master content every other channel inherits.
     *
     * <p>🔴 A reported reference is a mirrored external fact, so adopting it MINTS a new
     * {@code E-105} asset owned by Product rather than pretending the mirror was already one
     * ({@code PRD-182.b}).
     */
    @Transactional
    public void acceptReportedMedia(UUID listingId) {
        Actor actor = requireManager();
        Instant now = clock.instant();
        ChannelListingEntity listing = listings.findById(listingId)
                .orElseThrow(() -> new ChannelListingNotFoundException(listingId));

        List<ChannelListingReportedMediaEntity> reported =
                reportedMedia.findByChannelListingIdOrderByPositionAsc(listingId);
        if (reported.isEmpty()) {
            throw new ChannelListingValidationException(
                    "The channel has reported no media for this listing, so there is nothing "
                            + "to accept.");
        }

        intendedMedia.deleteByChannelListingId(listingId);
        intendedMedia.flush();

        int position = 0;
        for (ChannelListingReportedMediaEntity r : reported) {
            MediaAssetEntity asset = assets.save(new MediaAssetEntity(UUID.randomUUID(),
                    r.getExternalReference(), null,
                    "Adopted from channel-reported media", actor.id(), now));
            intendedMedia.save(new ChannelListingIntendedMediaEntity(UUID.randomUUID(),
                    listingId, asset.getId(), MediaRole.GALLERY, position++));
        }

        listing.markIntendedContentChanged(actor.id(), now);
        listings.save(listing);

        activity.save(new ChannelListingActivityEntity(UUID.randomUUID(), listingId,
                ActivityKind.OPERATION,
                "Accept Marketplace applied to media — " + reported.size()
                        + " reported image(s) adopted as intended media",
                "Divergence resolution", actor.id(), now));
    }

    /** Registers a reusable {@code E-105} asset, {@code PRD-167.b}. */
    @Transactional
    public UUID registerAsset(String storageReference, String mediaType, String description) {
        Actor actor = requireManager();
        if (storageReference == null || storageReference.isBlank()) {
            throw new ChannelListingValidationException("A media reference is required.");
        }
        MediaAssetEntity asset = assets.save(new MediaAssetEntity(UUID.randomUUID(),
                storageReference.trim(), mediaType, description, actor.id(), clock.instant()));
        return asset.getId();
    }

    private List<SellableProductMediaEntity> masterMediaFor(ChannelListingEntity listing) {
        // PRD-170 - the fallback follows the MAPPED Sellable Product. For an UNMAPPED listing
        // there is no fallback source at all: only listing intended media can define outbound
        // media intent, which is exactly what an empty list expresses here.
        List<ChannelListingSkuEntity> listingSkus =
                skus.findByChannelListingIdOrderByPositionAsc(listing.getId());
        UUID sellableProductId = listingSkus.stream()
                .map(ChannelListingSkuEntity::getSellableProductId)
                .filter(id -> id != null)
                .findFirst()
                .orElse(null);
        if (sellableProductId == null) {
            return List.of();
        }
        return masterMedia.findBySellableProductIdOrderByPositionAsc(sellableProductId);
    }

    private Map<UUID, MediaAssetEntity> loadAssets(
            List<ChannelListingIntendedMediaEntity> overrides,
            List<SellableProductMediaEntity> master) {
        List<UUID> ids = new ArrayList<>();
        overrides.forEach(o -> ids.add(o.getMediaAssetId()));
        master.forEach(m -> ids.add(m.getMediaAssetId()));
        return indexAssets(ids);
    }

    private Map<UUID, MediaAssetEntity> indexAssets(List<UUID> ids) {
        Map<UUID, MediaAssetEntity> byId = new HashMap<>();
        if (ids.isEmpty()) {
            return byId;
        }
        for (MediaAssetEntity asset : assets.findByIdIn(ids.stream().distinct().toList())) {
            byId.put(asset.getId(), asset);
        }
        return byId;
    }

    private ListingViews.MediaView toView(UUID id, UUID assetId,
                                          Map<UUID, MediaAssetEntity> assetById,
                                          MediaRole role, int position, String source) {
        MediaAssetEntity asset = assetById.get(assetId);
        return new ListingViews.MediaView(id, assetId,
                asset == null ? null : asset.getStorageReference(), role, position, source);
    }

    /** Sorts a media view list by explicit position ({@code PRD-168.d}). */
    static Comparator<ListingViews.MediaView> byPosition() {
        return Comparator.comparingInt(ListingViews.MediaView::position);
    }

    private Actor requireViewer() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.CHANNEL_LISTING_VIEW)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.CHANNEL_LISTING_VIEW);
        }
        return actor;
    }

    /**
     * 🔴 Media editing is a LOCAL act and needs {@code manage}, never {@code publish}
     * ({@code PRD-196.a}).
     */
    private Actor requireManager() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.CHANNEL_LISTING_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.CHANNEL_LISTING_MANAGE);
        }
        return actor;
    }

    /** One intended media entry as the operator ordered it. */
    public record IntendedMediaInput(UUID mediaAssetId, boolean primary) {
    }
}
