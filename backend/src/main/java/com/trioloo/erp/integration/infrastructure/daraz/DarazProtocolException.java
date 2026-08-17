package com.trioloo.erp.integration.infrastructure.daraz;

/**
 * Daraz answered, but the answer is not one this integration can act on.
 *
 * <p>Covers a non-zero envelope {@code code}, an unparseable body, and a token response missing
 * data the Daraz contract requires ({@code DZC-006}).
 *
 * <p>🔴 THE PROVIDER'S OWN TEXT IS NOT REPEATED. A Daraz error message can echo request
 * parameters, which on seller-scoped calls include the access token. Only a short classification
 * and, where present, the provider's error CODE are carried — never the message, never the body.
 */
public class DarazProtocolException extends RuntimeException {

    private final String providerCode;

    public DarazProtocolException(String problem, String providerCode) {
        super("Daraz rejected the request: " + problem
                + (providerCode == null ? "" : " (provider code " + providerCode + ")"),
                null, false, false);
        this.providerCode = providerCode;
    }

    public DarazProtocolException(String problem) {
        this(problem, null);
    }

    /** The provider's error code, when it gave one. */
    public String providerCode() {
        return providerCode;
    }
}
