package com.trioloo.erp.product.application.ai;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import com.trioloo.erp.product.application.ProductPermissions;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Turns a Listing into an authoring context and asks the port for candidates.
 *
 * <p>🔴 THIS SERVICE WRITES NOTHING. It has no repository, no entity and no transaction: a
 * generation is a read plus a question, and the answer comes back as text the operator has
 * not yet accepted ({@code PRD-200.a}, {@code PRD-200.o}).
 *
 * <p>🔴 {@code PRD-200.g} — it reports ABSENT FACTS EXPLICITLY. An assistant that is not told
 * a warranty period is unknown will invent one, and a fabricated specification in front of a
 * customer is the failure this whole rule exists to prevent.
 *
 * <p>🔴 Authoring is a MANAGE act ({@code PRD-196.a}). Asking for a suggestion is part of
 * writing listing content, and it never implies publish authority.
 */
@Service
public class ListingAiAuthoringService {

    private final ListingAiAuthoringPort port;
    private final CurrentActor currentActor;

    public ListingAiAuthoringService(ListingAiAuthoringPort port, CurrentActor currentActor) {
        this.port = port;
        this.currentActor = currentActor;
    }

    /** ⚠ {@code PRD-200.r} — whether an assistant exists at all, answered honestly. */
    public boolean isConfigured() {
        requireManager();
        return port.isConfigured();
    }

    /**
     * 🔴 {@code PRD-196.a} — asking for a suggestion is part of AUTHORING listing content,
     * so it needs manage. It never implies publish authority.
     */
    private void requireManager() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.CHANNEL_LISTING_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.CHANNEL_LISTING_MANAGE);
        }
    }

    /**
     * Produces candidates for one request.
     *
     * <p>🔴 The caller's supplied facts are passed through as FACTS, and everything the caller
     * left blank is named as ABSENT. Nothing is defaulted, inferred or filled in on the way.
     */
    public ListingAiAuthoringPort.AuthoringCandidates generate(
            ListingAiAuthoringPort.AuthoringKind kind,
            String language,
            String instruction,
            Map<String, String> suppliedFacts,
            List<String> adapterConstraints) {

        requireManager();

        Map<String, String> facts = new LinkedHashMap<>();
        List<String> absent = new ArrayList<>();
        if (suppliedFacts != null) {
            suppliedFacts.forEach((key, value) -> {
                if (value == null || value.isBlank()) {
                    // 🔴 PRD-200.g - stated as MISSING, never omitted silently and never guessed.
                    absent.add(key);
                } else {
                    facts.put(key, value);
                }
            });
        }

        return port.generate(new ListingAiAuthoringPort.AuthoringRequest(
                kind, language, instruction,
                new ListingAiAuthoringPort.ListingAuthoringContext(
                        Map.copyOf(facts), List.copyOf(absent),
                        adapterConstraints == null ? List.of() : List.copyOf(adapterConstraints))));
    }
}
