package com.trioloo.erp.integration.infrastructure.daraz;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;

/**
 * Application-level Daraz credentials and endpoints, from deployment configuration only.
 *
 * <p>🔴 THESE ARE APPLICATION CREDENTIALS, NOT A SELLER'S. The App Key and App Secret identify
 * TRIOLOO to Daraz. Per-shop seller authorisation material is an entirely different thing and
 * lives encrypted in {@code channel_credential} ({@code API-069}, {@code TEC-119}) — the two
 * must never be conflated or stored together.
 *
 * <p>🔴 THE APP SECRET NEVER LEAVES THIS BOUNDARY ({@code API-070.a}). It is not persisted, not
 * projected through any API, not exposed to the frontend, and not printed — {@link #toString()}
 * is overridden precisely because a configuration object is the kind of thing that ends up in a
 * debug log.
 *
 * <p>⚠ ABSENCE IS NOT AN ERROR AT STARTUP, AND THAT IS DELIBERATE. No Daraz operation exists
 * yet, so an environment that has not configured Daraz has nothing to protect and must still
 * boot. Requirements are enforced at the moment configuration is actually {@linkplain
 * #require() needed}, so a deployment that never touches Daraz is never held hostage by it —
 * while an attempt to USE Daraz unconfigured fails immediately and by name.
 */
@Component
public class DarazProperties {

    private final String appKey;
    private final String appSecret;
    private final String redirectUri;

    public DarazProperties(
            @Value("${integration.daraz.app-key:}") String appKey,
            @Value("${integration.daraz.app-secret:}") String appSecret,
            @Value("${integration.daraz.oauth-redirect-uri:}") String redirectUri) {
        this.appKey = trimToNull(appKey);
        this.appSecret = trimToNull(appSecret);
        this.redirectUri = trimToNull(redirectUri);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Whether every required value is present. ⚠ Says nothing about whether they are CORRECT. */
    public boolean isConfigured() {
        return appKey != null && appSecret != null && redirectUri != null;
    }

    /**
     * Validates and returns the configuration, for the moment a Daraz operation actually needs it.
     *
     * @throws DarazConfigurationException naming ONLY the missing or malformed variable — 🔴 never
     *                                     its value, because this message reaches logs and
     *                                     operators.
     */
    public Configured require() {
        if (appKey == null) {
            throw new DarazConfigurationException("DARAZ_APP_KEY");
        }
        if (appSecret == null) {
            throw new DarazConfigurationException("DARAZ_APP_SECRET");
        }
        if (redirectUri == null) {
            throw new DarazConfigurationException("DARAZ_OAUTH_REDIRECT_URI");
        }

        /*
          The redirect URI must be absolute and HTTPS: Daraz sends an authorisation code to it,
          and a plaintext or relative destination would leak or simply never arrive.
          ⚠ NO HOSTNAME IS CHECKED HERE. Pinning user.trioloo.com into Java would make the
          application refuse to run anywhere else, including these tests.
        */
        URI parsed;
        try {
            parsed = URI.create(redirectUri);
        } catch (IllegalArgumentException e) {
            throw new DarazConfigurationException("DARAZ_OAUTH_REDIRECT_URI",
                    "is not a valid URI");
        }
        if (!parsed.isAbsolute() || parsed.getHost() == null) {
            throw new DarazConfigurationException("DARAZ_OAUTH_REDIRECT_URI",
                    "must be an absolute URI including a host");
        }
        if (!"https".equalsIgnoreCase(parsed.getScheme())) {
            throw new DarazConfigurationException("DARAZ_OAUTH_REDIRECT_URI",
                    "must use https");
        }

        return new Configured(appKey, appSecret, redirectUri);
    }

    /**
     * A validated configuration.
     *
     * <p>⚠ Holding this means holding the App Secret. It exists to be handed to the signer and
     * then dropped — never stored, never logged, never returned.
     */
    public record Configured(String appKey, String appSecret, String redirectUri) {

        /** 🔴 The App Secret is never printed, not even partially. */
        @Override
        public String toString() {
            return "DarazProperties.Configured[appKey=" + appKey
                    + ", redirectUri=" + redirectUri + ", appSecret=REDACTED]";
        }
    }

    /** 🔴 Never prints a configured value — only which NAME is at fault. */
    @Override
    public String toString() {
        return "DarazProperties[configured=" + isConfigured() + "]";
    }
}
