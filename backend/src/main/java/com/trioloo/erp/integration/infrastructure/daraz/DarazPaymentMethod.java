package com.trioloo.erp.integration.infrastructure.daraz;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Translates Daraz's {@code payment_method} token into an operator-readable name.
 *
 * <p>🔴 THE TRANSLATION LIVES IN THE ADAPTER, WHICH IS THE ONLY PLACE IT MAY ({@code BR-005}) —
 * <em>channel-specific logic exists only in adapters, and no downstream stage may contain
 * channel-conditional behaviour</em>. ⚠ A `switch` on {@code GNBKASH_TOKEN_EBANK} in a query
 * service or a React component would be exactly that, and would have to be repeated for the next
 * channel.
 *
 * <p>🔴 THE RAW VALUE IS NEVER OVERWRITTEN. {@code BR-171} keeps an externally-authoritative fact
 * distinguished and {@code SYS-046} retains the received payload as evidence, so this produces a
 * SECOND value beside the provider's own — the same shape as {@code statuses_json} beside
 * {@code canonical_statuses_json}.
 *
 * <p>⚠ ONLY UNAMBIGUOUS BRANDS ARE TRANSLATED. Where the provider's token names a brand outright
 * the reading is not a judgement; where it encodes a product — a bank's instalment plan — naming it
 * is a business decision and the raw value stands instead. {@code SYS-034}: an untranslated value
 * shows what the channel said rather than a label Trioloo invented.
 */
public final class DarazPaymentMethod {

    private static final Map<String, String> READABLE = Map.of(
            // The product owner's decision, 2026-08-24.
            "GNBKASH_TOKEN_EBANK", "bKash",
            "MIXEDCARD", "Card",
            /*
              ⚠ Translated by the SAME test as bKash: the provider's token names the wallet brand
              outright, so reading it is transcription rather than interpretation.
            */
            "WALLET_NAGADBD", "Nagad",
            // ✅ Already readable, and mapped so the surface has one source rather than a
            // pass-through path that behaves differently.
            "COD", "Cash on Delivery");

    private DarazPaymentMethod() {
    }

    /**
     * @return the readable name, or empty where the provider's token names a PRODUCT rather than a
     *         brand — {@code EASTERN_BANK_MANUAL_IPP} and {@code LANKABANGLA_FINANCE_MANUAL_IPP}
     *         are instalment plans, and what to call one is a business decision this does not take.
     */
    public static Optional<String> readable(String providerValue) {
        if (providerValue == null || providerValue.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(READABLE.get(providerValue.trim().toUpperCase(Locale.ROOT)));
    }

    /** ⚠ The readable name where one exists, otherwise the provider's own word, unaltered. */
    public static String forDisplay(String providerValue) {
        if (providerValue == null || providerValue.isBlank()) {
            return null;
        }
        return readable(providerValue).orElse(providerValue.trim());
    }
}
