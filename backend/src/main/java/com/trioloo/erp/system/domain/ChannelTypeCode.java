package com.trioloo.erp.system.domain;

import java.util.Locale;
import java.util.Optional;

/**
 * {@code E-015} Channel Type — the recognised set, as refined 2026-08-15.
 *
 * <p>🔴 {@code INV-15.4} — THE SET IS CLOSED AND FREE TEXT IS FORBIDDEN. Adapter resolution
 * reads this value; an unrecognised one produces a shop that can never resolve an adapter.
 *
 * <p>🔴 {@code INV-15.3} — THIS ENUM IS NOT A LICENCE TO BRANCH ON IT. Integration may route
 * an adapter from a Channel Type; domain and business code may not derive behaviour from a
 * raw comparison against one. Nothing in this module does.
 *
 * <p>⚠ {@code INV-15.5} — {@code WEBSITE}, {@code SHOPIFY} and {@code WOOCOMMERCE} behave
 * alike on all four {@code OM §3.1} axes and are still three distinct types, because their
 * external integration contracts differ.
 *
 * <p>⚠ {@code SCS-092.b} — the registry UI exposes a SUBSET of this set. That is a surface
 * decision and is not encoded here: the set and its exposure are different facts.
 */
public enum ChannelTypeCode {

    /** The Daraz marketplace channel and adapter family. */
    DARAZ("Daraz"),
    /** A generic or bespoke first-party web sales channel, with no platform adapter family. */
    WEBSITE("Website"),
    /** A Shopify-backed web sales channel and adapter family ({@code INV-15.5}). */
    SHOPIFY("Shopify"),
    /** A WooCommerce-backed web sales channel and adapter family ({@code INV-15.5}). */
    WOOCOMMERCE("WooCommerce"),
    FACEBOOK("Facebook"),
    WHATSAPP("WhatsApp"),
    PHONE("Phone"),
    WALKIN("Walk-in");

    private final String label;

    ChannelTypeCode(String label) {
        this.label = label;
    }

    /** How operators read it. 🔴 Never parsed, and never a business key. */
    public String label() {
        return label;
    }

    /**
     * Resolves a stored or submitted value, or empty when it is not recognised.
     *
     * <p>🔴 Returning empty rather than a default is the point: {@code INV-15.4} makes an
     * unrecognised type a REJECTION, never a silent fallback to some "other" bucket.
     */
    public static Optional<ChannelTypeCode> resolve(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String normalised = raw.trim().toUpperCase(Locale.ROOT).replace("-", "").replace(" ", "");
        for (ChannelTypeCode candidate : values()) {
            if (candidate.name().equals(normalised)) {
                return Optional.of(candidate);
            }
        }
        return Optional.empty();
    }
}
