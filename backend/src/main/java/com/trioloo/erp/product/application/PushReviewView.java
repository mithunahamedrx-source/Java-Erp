package com.trioloo.erp.product.application;

import java.util.List;
import java.util.UUID;

/**
 * One coherent, provider-neutral answer to "what would be sent, and can it be sent now?",
 * {@code PRD-185} / {@code PRD-186} / {@code API-062}.
 *
 * <p>🔴 THIS IS THE LOCAL/REMOTE BOUNDARY MADE READABLE. Everything here is Trioloo's own
 * PERSISTED intent plus what the channel last reported. Nothing is an unsaved draft, nothing
 * is a marketplace payload, and nothing here has contacted a channel ({@code PRD-185.a}).
 *
 * <p>🔴 {@code API-062.d} — no channel field name, endpoint, payload key or credential
 * appears in this projection. An adapter translates these business facts into a remote
 * request later; the review deliberately shows the FACTS, not a request body.
 *
 * <p>🔴 {@code reviewVersion} is the listing's persisted version at the moment the review was
 * composed. Confirmation carries it back so an outbound act can never be dispatched from a
 * review the operator was reading while the listing changed underneath it.
 */
public record PushReviewView(UUID listingId,
                             /**
                              * 🔴 The stale-review token. Every section below was read inside
                              * ONE transaction at this version, so the review is a coherent
                              * snapshot rather than a composite of two different revisions.
                              */
                             long reviewVersion,
                             /** {@link #FIRST_PUBLICATION} or {@link #EXISTING_UPDATE}. */
                             String mode,
                             String listingTitle,
                             String channelName,
                             String channelType,
                             /**
                              * 🔴 {@code PRD-188.b} — null in {@code FIRST_PUBLICATION}. The
                              * channel issues this identifier on acceptance; the ERP never
                              * invents, reserves or predicts one.
                              */
                             String externalListingId,
                             int skuCount,
                             int mappedSkuCount,
                             /**
                              * 🔴 Its own dimension ({@code UX-271.b}) — a listing may be
                              * UNSENT and UNMAPPED and DIVERGED simultaneously. Derived from
                              * {@code PRD-185.c}, never stored as a flag.
                              */
                             boolean unsentLocalChanges,
                             int divergedFieldCount,
                             /** The listing's own publication intent, {@code PRD-128}. */
                             String publicationIntent,
                             /**
                              * 🔴 {@code INV-106.2} — true when the orderable units own the
                              * commercial facts, so no listing-level price or stock row may
                              * be presented as what will be sent ({@code UX-271.d}).
                              */
                             boolean perSkuCommercials,
                             List<ListingViews.ComparisonRow> fields,
                             List<ListingViews.SkuView> skus,
                             List<ListingViews.MediaView> effectiveMedia,
                             /**
                              * 🔴 {@code PRD-170} — true when the effective set is the mapped
                              * Sellable Product's master media rather than a listing override.
                              * The fallback is DERIVED at send time and never materialised.
                              */
                             boolean mediaIsFallback,
                             /**
                              * 🔴 {@code PRD-198.c} — the EFFECTIVE set in authored order.
                              * {@code PRD-198.b} — order is meaning, so it is never sorted,
                              * de-duplicated or flattened into one string here.
                              */
                             List<String> highlights,
                             boolean banglaOverridePresent,
                             /**
                              * 🔴 {@code PRD-202.c} — true when a Bangla reader will be shown
                              * the English content. That is COMPLETE, not missing; saying so
                              * is what stops the fallback being mistaken for an empty field.
                              */
                             boolean banglaFallsBackToEnglish,
                             List<PreflightItem> preflight,
                             /**
                              * 🔴 The single honest gate. False whenever ANY blocking
                              * preflight item stands, including the absent adapter.
                              */
                             boolean executable,
                             /**
                              * ⚠ Why execution is unavailable, in one plain sentence. Null
                              * when {@code executable} is true.
                              */
                             String executionBlockedReason) {

    /** {@code PRD-188} — no remote identity exists; the act would CREATE the listing. */
    public static final String FIRST_PUBLICATION = "FIRST_PUBLICATION";
    /** {@code PRD-171} — a remote identity exists; the act would UPDATE that exact listing. */
    public static final String EXISTING_UPDATE = "EXISTING_UPDATE";

    /**
     * One preflight finding, in exactly one dimension.
     *
     * <p>🔴 {@code UX-271.b} — the dimensions are NOT collapsed into a generic error. "Not
     * ready" hides whether the operator must type something, map something, or wait for an
     * adapter that does not exist yet, and those have completely different remedies.
     */
    public record PreflightItem(String dimension, boolean blocking, String text) {

        /** Structural truth the ERP owns and can check by itself. */
        public static final String LOCAL_VALIDATION = "LOCAL_VALIDATION";
        /** Whether the orderable units resolve to Sellable Products, {@code PRD-179}. */
        public static final String MAPPING = "MAPPING";
        /** What an adapter declares it can do for THIS channel instance, {@code PRD-125}. */
        public static final String ADAPTER_CAPABILITY = "ADAPTER_CAPABILITY";
        /**
         * 🔴 What the MARKETPLACE would refuse. Knowable only from a real category schema.
         * With no adapter this dimension reports that it CANNOT be evaluated — it never
         * reports "passed" ({@code API-063.c} applied to validation rather than to a value).
         */
        public static final String MARKETPLACE_SCHEMA = "MARKETPLACE_SCHEMA";

        public static PreflightItem blocking(String dimension, String text) {
            return new PreflightItem(dimension, true, text);
        }

        /** ⚠ A recommendation NEVER prevents an outbound act ({@code PRD-188.a}). */
        public static PreflightItem recommendation(String dimension, String text) {
            return new PreflightItem(dimension, false, text);
        }
    }
}
