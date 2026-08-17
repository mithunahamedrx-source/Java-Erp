package com.trioloo.erp.system.domain;

import java.util.Locale;
import java.util.Optional;

/**
 * {@code INV-16.7} — the market a Channel Instance operates in.
 *
 * <p>🔴 A CLOSED, ERP-SUPPLIED SET. Ratified 2026-08-15. Market is BUSINESS CONFIGURATION,
 * and free text is forbidden: an operator types no market, and the API accepts none.
 *
 * <p>🔴 THE CURRENT SET HAS EXACTLY ONE MEMBER, {@link #BANGLADESH}, because that is the only
 * value the approved design shows. ⚠ ADDING A MEMBER IS A CANONICAL AMENDMENT, NOT AN
 * IMPLEMENTATION CHOICE. India, Pakistan, Global, International and every other plausible
 * value are absent DELIBERATELY — inventing one would be exactly the business invention
 * {@code CLAUDE.md §5} forbids.
 *
 * <p>🔴 IT IS NOT THE CHANNEL TYPE AND NEVER DERIVED FROM IT ({@code E-015}). A Daraz shop and
 * a Shopify shop may both operate in Bangladesh; the two facts stay separate.
 *
 * <p>⚠ {@code INV-16.7} — an integration MAY read it when choosing provider-specific
 * behaviour; the domain models no such behaviour, and nothing in this module branches on it.
 */
public enum MarketCode {

    /** 🔴 The ONLY member of the current set. */
    BANGLADESH("Bangladesh");

    private final String label;

    MarketCode(String label) {
        this.label = label;
    }

    /** How operators read it. 🔴 Never parsed, never persisted, never a business key. */
    public String label() {
        return label;
    }

    /**
     * Resolves a submitted or stored value, or empty when it is not recognised.
     *
     * <p>🔴 EMPTY IS A REJECTION, NEVER A FALLBACK. Normalising arbitrary text into
     * {@code BANGLADESH} would silently turn an operator's mistake into a business fact.
     */
    public static Optional<MarketCode> resolve(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String normalised = raw.trim().toUpperCase(Locale.ROOT);
        for (MarketCode candidate : values()) {
            if (candidate.name().equals(normalised)) {
                return Optional.of(candidate);
            }
        }
        return Optional.empty();
    }
}
