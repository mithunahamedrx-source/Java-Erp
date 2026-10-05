package com.trioloo.erp.integration.infrastructure.website;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The Zeon Tech storefront's ERP endpoint and key, from deployment configuration only.
 *
 * <p>🔴 THE KEY IS THE SITE'S {@code ERP_API_KEY}, sent as {@code X-ERP-Key}. It is a long-lived shared
 * secret, so {@link #toString()} never prints it (DEP-021.d), and it is never logged.
 *
 * <p>⚠ THE STOREFRONT RUNS ON THE SAME SERVER AS THE ERP, so the default address is the loopback API,
 * which keeps order traffic off the public internet and out of Cloudflare.
 *
 * <p>⚠ ABSENCE IS NOT AN ERROR AT STARTUP: an environment without the website configured must still
 * boot (the way {@code SteadfastProperties} behaves). The requirement is enforced where the key is used.
 */
@Component
public class WebsiteProperties {

    static final String DEFAULT_BASE_URL = "http://127.0.0.1:4000/api/v1";

    private final String baseUrl;
    private final String erpKey;

    public WebsiteProperties(
            @Value("${integration.website.base-url:" + DEFAULT_BASE_URL + "}") String baseUrl,
            @Value("${integration.website.erp-key:}") String erpKey) {
        String trimmed = baseUrl == null ? "" : baseUrl.trim();
        this.baseUrl = trimmed.isEmpty() ? DEFAULT_BASE_URL
                : trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
        String key = erpKey == null ? "" : erpKey.trim();
        this.erpKey = key.isEmpty() ? null : key;
    }

    public boolean isConfigured() {
        return erpKey != null;
    }

    public String baseUrl() {
        return baseUrl;
    }

    String erpKey() {
        if (erpKey == null) {
            throw new WebsiteException(
                    "The website is not configured. Set integration.website.erp-key in the deployment environment.");
        }
        return erpKey;
    }

    @Override
    public String toString() {
        return "WebsiteProperties[baseUrl=" + baseUrl + ", configured=" + isConfigured() + "]";
    }
}
