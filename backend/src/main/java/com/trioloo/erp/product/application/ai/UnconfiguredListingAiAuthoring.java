package com.trioloo.erp.product.application.ai;

/**
 * What the port resolves to while no AI Integration capability is installed.
 *
 * <p>🔴 {@code PRD-200.r} — an unconfigured provider is an ORDINARY, HONEST STATE. This bean
 * says so and does nothing else. It never fabricates a candidate locally, never returns
 * canned copy, and never lets the UI imply an assistant exists.
 *
 * <p>⚠ Registered as the FALLBACK in {@link ListingAiAuthoringConfiguration}; the moment a
 * real AI Integration supplies its own {@link ListingAiAuthoringPort}, this one steps aside.
 * Product does not learn which one arrived, which is the whole point of {@code PRD-200.q}.
 */
public class UnconfiguredListingAiAuthoring implements ListingAiAuthoringPort {

    @Override
    public boolean isConfigured() {
        return false;
    }

    @Override
    public AuthoringCandidates generate(AuthoringRequest request) {
        throw new AiAuthoringUnavailableException(
                "AI authoring is not configured. Content can still be written by hand.");
    }
}
