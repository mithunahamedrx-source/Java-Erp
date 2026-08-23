package com.trioloo.erp.integration.infrastructure.steadfast;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Steadfast merchant credentials and base address, from deployment configuration only.
 *
 * <p>🔴 THE CREDENTIAL IS PER MERCHANT ACCOUNT, NOT PER SHOP ({@code STF-003.d}). Trioloo runs four
 * Daraz shops against ONE Steadfast account, so unlike a Daraz seller authorisation this does NOT
 * hang off {@code channel_instance}. It is application configuration, the way
 * {@code DarazProperties} holds the App Key — ⚠ and the two must never be conflated.
 *
 * <p>🔴 THE KEYS ARE STATIC AND NEVER EXPIRE ({@code STF-003.a}), WHICH MAKES THEM MORE DANGEROUS
 * THAN AN OAUTH TOKEN, NOT LESS. A Daraz access token rots on its own; a leaked Steadfast key stays
 * valid until a human rotates it in the provider's panel. {@link #toString()} is overridden for
 * exactly that reason — a configuration object is the kind of thing that ends up in a debug log
 * ({@code DEP-021.d}).
 *
 * <p>⚠ ABSENCE IS NOT AN ERROR AT STARTUP, DELIBERATELY. No Steadfast operation is wired to a user
 * action yet, so a deployment that has not configured the courier must still boot. The requirement
 * is enforced where configuration is actually {@linkplain #require() needed}.
 */
@Component
public class SteadfastProperties {

    /**
     * ⚠ {@code STF-001} — THE HOST IS {@code portal.packzy.com}, NOT THE BRAND DOMAIN.
     * The merchant brand and the API host are different companies' domains, and an egress rule,
     * allow-list or certificate pin written against {@code steadfast.com.bd} will fail. The default
     * is spelled out here so a deployment that forgets to set it still reaches the right place.
     */
    static final String DEFAULT_BASE_URL = "https://portal.packzy.com/api/v1";

    private final String apiKey;
    private final String secretKey;
    private final String baseUrl;

    public SteadfastProperties(
            @Value("${integration.steadfast.api-key:}") String apiKey,
            @Value("${integration.steadfast.secret-key:}") String secretKey,
            @Value("${integration.steadfast.base-url:" + DEFAULT_BASE_URL + "}") String baseUrl) {
        this.apiKey = trimToNull(apiKey);
        this.secretKey = trimToNull(secretKey);
        String trimmedBase = trimToNull(baseUrl);
        this.baseUrl = trimmedBase == null ? DEFAULT_BASE_URL : stripTrailingSlash(trimmedBase);
    }

    public boolean isConfigured() {
        return apiKey != null && secretKey != null;
    }

    public String baseUrl() {
        return baseUrl;
    }

    String apiKey() {
        return require().apiKey;
    }

    String secretKey() {
        return require().secretKey;
    }

    /**
     * ⚠ Fails by NAME, so an unconfigured deployment reports which variable is missing rather than
     * surfacing an authentication error from the provider that means something else entirely
     * ({@code STF-007} — a Steadfast {@code 401} is not reliably an authentication failure).
     */
    public SteadfastProperties require() {
        if (apiKey == null || secretKey == null) {
            throw new SteadfastConfigurationException(
                    "Steadfast is not configured. Set integration.steadfast.api-key and "
                            + "integration.steadfast.secret-key in the deployment environment.");
        }
        return this;
    }

    /**
     * 🔴 NEITHER KEY APPEARS HERE, AND THAT IS THE ENTIRE POINT OF OVERRIDING THIS.
     */
    @Override
    public String toString() {
        return "SteadfastProperties[baseUrl=" + baseUrl + ", configured=" + isConfigured() + "]";
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
