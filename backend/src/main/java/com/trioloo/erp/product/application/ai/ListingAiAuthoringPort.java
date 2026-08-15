package com.trioloo.erp.product.application.ai;

import java.util.List;
import java.util.Map;

/**
 * The Product domain's view of an AI authoring assistant, {@code PRD-200.q}.
 *
 * <p>🔴 PROVIDER-NEUTRAL BY CONSTRUCTION. No vendor name, credential, model identifier,
 * prompt template, timeout, retry policy or provider payload shape appears here or anywhere
 * behind it in Product. Those belong to a separate AI Integration capability, exactly as
 * channel transport belongs to an adapter ({@code API-062.d}).
 *
 * <p>🔴 WHAT THIS PORT RETURNS IS A CANDIDATE, NEVER A WRITE ({@code PRD-200.a}). Nothing
 * reachable through it can save a Listing, push to a channel, change a mapping, a channel, a
 * category, or touch reported marketplace truth. The port has no method that could: it
 * returns text and stops.
 *
 * <p>🔴 {@code PRD-200.g} — the caller supplies only facts the Listing ACTUALLY HOLDS, and
 * states which are ABSENT. An assistant is never handed a guess and must not supply one.
 */
public interface ListingAiAuthoringPort {

    /**
     * Whether an assistant is configured at all.
     *
     * <p>⚠ {@code PRD-200.r} — an unconfigured provider is an ordinary, honest state. The UI
     * says so and manual authoring is unaffected; nothing is fabricated locally to stand in.
     */
    boolean isConfigured();

    /**
     * Produces candidate text for one authoring request.
     *
     * @throws AiAuthoringUnavailableException when no provider is configured, or the
     *     configured one could not be reached. 🔴 A failure NEVER alters the Listing.
     */
    AuthoringCandidates generate(AuthoringRequest request);

    /**
     * What the operator asked for.
     *
     * @param kind which content is wanted
     * @param language the authoring language the candidate must be written in
     *     ({@code PRD-202}); the assistant never chooses it
     * @param instruction an optional free-text operator instruction. ⚠ It is passed through
     *     as the operator's words and is never interpreted as a business rule.
     * @param context the structured Listing facts, and only those ({@code PRD-200.f})
     */
    record AuthoringRequest(AuthoringKind kind,
                            String language,
                            String instruction,
                            ListingAuthoringContext context) {
    }

    /**
     * The structured authoring context, {@code PRD-200.f}.
     *
     * <p>🔴 {@code PRD-200.g} — {@link #absentFacts} names what the Listing does NOT hold, so
     * the assistant is TOLD a value is unavailable rather than left to infer one. A warranty
     * period nobody recorded must never come back as "1 Year Warranty".
     *
     * <p>⚠ {@code facts} carries only Listing-scoped commercial and content facts. No
     * credential, actor, permission, cost or unrelated application data crosses this line.
     */
    record ListingAuthoringContext(Map<String, String> facts,
                                   List<String> absentFacts,
                                   List<String> adapterConstraints) {
    }

    /**
     * One or more candidates, keyed by what they are for.
     *
     * <p>🔴 {@code PRD-200.m} — a set MAY BE ACCEPTED IN PART. The keys exist precisely so the
     * operator can take the title and refuse the description; the set is not a transaction.
     */
    record AuthoringCandidates(Map<AuthoringKind, String> candidates) {
    }

    /** What may be asked for. ⚠ Media generation is {@code PRD-203}'s and is not here yet. */
    enum AuthoringKind {
        TITLE,
        HIGHLIGHTS,
        DESCRIPTION
    }
}
