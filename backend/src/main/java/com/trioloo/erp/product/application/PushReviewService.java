package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.OperationKind;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * The outbound review, {@code PRD-185} / {@code PRD-186} / {@code PRD-188}.
 *
 * <p>🔴 SAVE IS NOT PUSH. {@link ChannelListingCommandService} records local intent and has no
 * adapter dependency at all. This service answers a different question — "what would be sent,
 * and can it be sent right now?" — and is the ONLY place a Listing outbound act is authorised
 * from a review ({@code PRD-185.a}, {@code UX-271.c}).
 *
 * <p>🔴 IT READS ONLY PERSISTED FACTS. An unsaved editor draft is not intent and never reaches
 * here; the operator saves first, and the review then represents exactly what the ERP holds.
 *
 * <p>🔴 ONE ENGINE, NOT A SECOND ONE ({@code UX-271.b} applied to readiness). The comparison
 * comes from {@link ChannelListingQueryService#comparison}, the effective media from
 * {@link ChannelListingMediaService#mediaSet}, and the per-SKU facts from the same
 * {@code E-106} projection the Variations section reads. Nothing is recomputed here, so
 * two surfaces cannot report different truths about one listing.
 *
 * <p>🔴 NO ADAPTER SHIPS IN THIS RELEASE. Review is fully available; EXECUTION IS NOT. The
 * confirmation refuses BEFORE any operation, batch or activity record is created, because a
 * recorded "push" that never contacted a marketplace is a lie the operator cannot detect.
 */
@Service
public class PushReviewService {

    private final ChannelListingQueryService listings;
    private final ChannelListingMediaService media;
    private final ChannelListingOperationService operations;
    private final CurrentActor currentActor;

    public PushReviewService(ChannelListingQueryService listings,
                             ChannelListingMediaService media,
                             ChannelListingOperationService operations,
                             CurrentActor currentActor) {
        this.listings = listings;
        this.media = media;
        this.operations = operations;
        this.currentActor = currentActor;
    }

    // =================================================================================
    // Review
    // =================================================================================

    /**
     * Composes the review for exactly ONE listing, {@code INV-108.4}.
     *
     * <p>🔴 {@code PRD-196.a} — requires {@code publish}. Reading a listing requires
     * {@code view}, which the composed reads below enforce; holding {@code view} or
     * {@code manage} alone therefore cannot reach the outbound review at all. MANAGE NEVER
     * IMPLIES PUBLISH.
     *
     * <p>🔴 ONE TRANSACTION, ONE VERSION. Every section is read inside this call, so the
     * returned {@code reviewVersion} describes the whole snapshot rather than the first
     * section that happened to be loaded.
     *
     * <p>⚠ The scope NEVER expands. No sibling listing, no sibling shop and no other channel
     * is read, joined or affected ({@code PRD-187.b}).
     */
    @Transactional(readOnly = true)
    public PushReviewView review(UUID listingId) {
        requirePublisher();

        ChannelListingView l = listings.detail(listingId);
        List<ListingViews.ComparisonRow> comparison = listings.comparison(listingId);
        ListingViews.MediaSetView mediaSet = media.mediaSet(listingId);

        boolean firstPublication = l.externalListingId() == null;
        // 🔴 INV-106.2 — on a variation listing the orderable units own price and stock, so
        //    no listing-level commercial figure may be presented as what will be sent.
        boolean perSkuCommercials = l.skuCount() > 1;

        List<PushReviewView.PreflightItem> preflight =
                preflight(l, mediaSet, firstPublication, perSkuCommercials);
        String blocked = firstBlockingReason(preflight);

        return new PushReviewView(l.id(),
                l.version(),
                firstPublication ? PushReviewView.FIRST_PUBLICATION
                        : PushReviewView.EXISTING_UPDATE,
                l.intendedTitle(),
                l.channelName(),
                l.channelType(),
                l.externalListingId(),
                (int) l.skuCount(),
                (int) l.mappedSkuCount(),
                l.hasUnsentLocalChanges(),
                l.divergedFactCount(),
                l.publicationIntent(),
                perSkuCommercials,
                // ⚠ Attribute rows travel WITH the field rows: they are the same comparison,
                //   and splitting them would let one list say ALIGNED while the other did not.
                comparison,
                l.skus(),
                mediaSet.effective(),
                mediaSet.effectiveIsFallback(),
                l.highlights() == null ? List.of() : l.highlights(),
                banglaAuthored(l),
                !banglaAuthored(l),
                preflight,
                blocked == null,
                blocked);
    }

    // =================================================================================
    // Preflight
    // =================================================================================

    /**
     * The four dimensions, kept apart, {@code UX-271.b}.
     *
     * <p>🔴 {@code PRD-188.a} — a RECOMMENDATION never blocks. Making every blank optional
     * field blocking would turn a legitimate ERP-first listing into an error state and teach
     * operators to ignore the list.
     */
    private List<PushReviewView.PreflightItem> preflight(ChannelListingView l,
                                                         ListingViews.MediaSetView mediaSet,
                                                         boolean firstPublication,
                                                         boolean perSkuCommercials) {
        List<PushReviewView.PreflightItem> items = new ArrayList<>();

        // ---- A. LOCAL VALIDATION -----------------------------------------------------
        /*
          🔴 THESE ARE EXACTLY THE RULES SAVE ALREADY REFUSES ON. Nothing stricter is invented
          here: a listing the ERP agreed to persist cannot become "invalid" merely because the
          operator asked to review it, and Edit readiness and this preflight therefore cannot
          contradict each other for the same persisted facts.
        */
        boolean titled = notBlank(l.intendedTitle());
        items.add(titled
                ? PushReviewView.PreflightItem.recommendation(
                        PushReviewView.PreflightItem.LOCAL_VALIDATION, "Listing title is set")
                : PushReviewView.PreflightItem.blocking(
                        PushReviewView.PreflightItem.LOCAL_VALIDATION,
                        "Listing title is required before this Listing can be sent"));

        /*
          ⚠ Sale Price is REPORTED, never locally blocked. PRD-188.a keeps a priced-later
          draft legitimate, and whether a marketplace refuses a listing without one is a
          MARKETPLACE_SCHEMA question no adapter is here to answer. Blocking it locally would
          invent a requirement canon does not state.
        */
        if (perSkuCommercials) {
            // 🔴 UX-271.d — per-unit truth. The listing-level figure is NOT what gets sent,
            //    so it is neither checked nor shown as if it were.
            long priced = l.skus().stream().filter(s -> notBlank(s.salePrice())).count();
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.LOCAL_VALIDATION,
                    priced + " of " + l.skuCount() + " orderable SKUs carry a Sale Price"));
        } else if (!notBlank(l.salePrice())) {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.LOCAL_VALIDATION, "No Sale Price is set"));
        }

        // ---- B. MAPPING / BUSINESS READINESS -----------------------------------------
        /*
          🔴 PRD-178 — UNMAPPED IS A VALID STATE, so mapping is REPORTED and never invented as
          an outbound blocker. ⚠ The real consequence is stated instead: an unmapped unit has
          no Sellable Product to derive master media or Product-owned values from.
        */
        if (l.skuCount() == 0) {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.MAPPING, "This Listing has no orderable SKUs"));
        } else if (l.mappedSkuCount() == l.skuCount()) {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.MAPPING,
                    l.skuCount() == 1 ? "The orderable SKU is mapped"
                            : "All " + l.skuCount() + " orderable SKUs are mapped"));
        } else {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.MAPPING,
                    l.mappedSkuCount() + " of " + l.skuCount() + " orderable SKUs mapped — "
                            + "unmapped SKUs carry no Product-derived values"));
        }

        if (mediaSet.effective().isEmpty()) {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.MAPPING,
                    "No effective media — nothing would be sent for images"));
        } else {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.MAPPING,
                    mediaSet.effective().size() + " image"
                            + (mediaSet.effective().size() == 1 ? "" : "s") + " would be sent"
                            + (mediaSet.effectiveIsFallback()
                                    ? ", from the mapped Sellable Product's master set" : "")));
        }

        // ---- C. ADAPTER CAPABILITY ---------------------------------------------------
        /*
          🔴 THE REAL EXECUTION BLOCKER, and the honest one. Nothing here simulates a channel:
          with no adapter there is no writable port, so the act cannot be attempted at all.
        */
        if (l.adapterAvailable()) {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.ADAPTER_CAPABILITY,
                    "An adapter is configured for " + l.channelName()));
        } else {
            items.add(PushReviewView.PreflightItem.blocking(
                    PushReviewView.PreflightItem.ADAPTER_CAPABILITY,
                    "No writable marketplace adapter is configured for " + l.channelName()
                            + ". The review is complete, but nothing can be sent."));
        }

        // ---- D. MARKETPLACE SCHEMA ---------------------------------------------------
        /*
          🔴 API-063.c applied to VALIDATION rather than to a value: an unevaluated dimension
          reports that it could not be evaluated. It NEVER reports "passed". Claiming a
          category or attribute set is acceptable without a schema to check it against is
          precisely the invention PRD-192 and PRD-193 forbid.
        */
        items.add(PushReviewView.PreflightItem.recommendation(
                PushReviewView.PreflightItem.MARKETPLACE_SCHEMA,
                l.adapterAvailable()
                        ? "Marketplace category and attribute validation runs when the act is sent"
                        : "Marketplace category and attribute validation cannot be completed — "
                                + "no channel schema is available to check against"));

        if (firstPublication) {
            items.add(PushReviewView.PreflightItem.recommendation(
                    PushReviewView.PreflightItem.MARKETPLACE_SCHEMA,
                    "This Listing has no channel identifier yet — the channel issues one when "
                            + "it accepts the listing"));
        }
        return items;
    }

    /**
     * 🔴 THE WHOLE LISTING IS THE UNIT. One blocking item blocks the entire confirmation; a
     * blocked orderable SKU is never silently dropped so the rest can be sent. Partial remote
     * SKU mutation is not a capability this system has, and pretending otherwise would leave
     * a marketplace half-updated with nobody aware of it ({@code INV-107.1}).
     */
    private static String firstBlockingReason(List<PushReviewView.PreflightItem> items) {
        return items.stream().filter(PushReviewView.PreflightItem::blocking)
                .map(PushReviewView.PreflightItem::text).findFirst().orElse(null);
    }

    // =================================================================================
    // Confirmation
    // =================================================================================

    /**
     * Dispatches the outbound act the review described, {@code PRD-186}.
     *
     * <p>🔴 THE GUARDS RUN IN THIS ORDER AND NONE OF THEM RECORDS ANYTHING. Permission, then
     * the reviewed version, then preflight, then the adapter. Only after all four does an
     * operation record come into existence, so a refused confirmation leaves no trace of an
     * attempt that never happened ({@code AUD-001} — the activity log records acts, not
     * intentions).
     *
     * <p>🔴 THE COMMAND TYPE IS DECIDED BY REMOTE IDENTITY, not by channel:
     * {@code PUBLISH_CREATE} when none exists ({@code PRD-188}), {@code PUSH_UPDATE} when one
     * does ({@code PRD-171}). Both are provider-neutral {@code OperationKind}s; no channel
     * name is branched on anywhere in this class.
     *
     * <p>⚠ In THIS release the adapter guard always refuses. That is the honest outcome, not
     * a placeholder: {@code UNSENT} stays exactly as it was, no lifecycle changes, no external
     * identifier is invented and no reported fact is fabricated from the request.
     */
    @Transactional
    public UUID confirm(UUID listingId, Long reviewVersion) {
        requirePublisher();
        PushReviewView review = review(listingId);

        /*
          🔴 STALE REVIEW. The operator approved a specific persisted revision; if the listing
          moved on, what they read is not what would be sent. Refused BEFORE dispatch — never
          "sent anyway because it was probably fine".
        */
        if (reviewVersion != null && review.reviewVersion() != reviewVersion) {
            throw new ChannelListingValidationException("reviewVersion",
                    "This Listing changed after the review was opened. Review the latest "
                            + "version before pushing.");
        }
        if (!review.executable()) {
            throw new ChannelListingValidationException("preflight",
                    review.executionBlockedReason());
        }
        OperationKind kind = PushReviewView.FIRST_PUBLICATION.equals(review.mode())
                ? OperationKind.PUBLISH_CREATE
                : OperationKind.PUSH_UPDATE;
        // ⚠ EXACTLY ONE LISTING. The existing operation path is reused unchanged, so a review
        //   confirmation and a workspace selection settle through identical semantics.
        return operations.request(kind, List.of(listingId),
                "Reviewed " + (kind == OperationKind.PUBLISH_CREATE ? "publication" : "push")
                        + " of " + review.listingTitle());
    }

    // =================================================================================
    // Helpers
    // =================================================================================

    /** ⚠ {@code PRD-202.c} — an authored override, as opposed to the English fallback. */
    private static boolean banglaAuthored(ChannelListingView l) {
        return notBlank(l.intendedTitleBn()) || notBlank(l.intendedDescriptionBn())
                || (l.highlightsBn() != null && !l.highlightsBn().isEmpty());
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private Actor requirePublisher() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.CHANNEL_LISTING_PUBLISH)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.CHANNEL_LISTING_PUBLISH);
        }
        return actor;
    }
}
