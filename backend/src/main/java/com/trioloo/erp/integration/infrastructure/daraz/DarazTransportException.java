package com.trioloo.erp.integration.infrastructure.daraz;

/**
 * A Daraz request did not produce a usable response at the transport layer.
 *
 * <p>🔴 A TRANSPORT FAULT IS NEVER AN AUTHORISATION VERDICT ({@code DZC-011}). It proves nothing
 * about whether the seller's authorisation is still good, so it must never become
 * {@code REAUTH_REQUIRED}; it is an {@code ERROR}.
 *
 * <p>⚠ TWO FAILURES THAT LOOK ALIKE AND ARE NOT. An HTTP 500 from Daraz and a DNS failure both used
 * to arrive here indistinguishably, which made a provider outage impossible to tell from a
 * networking fault. {@link #httpStatus} is present for the first and null for the second.
 *
 * <p>🔴 The status code is safe to log; the body is not, and is never captured. The cause is not
 * chained either — a client exception can quote the signed request URI.
 */
public class DarazTransportException extends RuntimeException {

    private final Integer httpStatus;

    /** A response arrived, with a status this integration cannot use. */
    public DarazTransportException(String message, int httpStatus) {
        super(message, null, false, false);
        this.httpStatus = httpStatus;
    }

    /** No usable response at all — DNS, connection refused, TLS, timeout. */
    public DarazTransportException(String message) {
        super(message, null, false, false);
        this.httpStatus = null;
    }

    /** The HTTP status when one was received, otherwise {@code null}. */
    public Integer httpStatus() {
        return httpStatus;
    }

    /** ✅ Distinguishes "the provider answered badly" from "the provider was not reached". */
    public boolean isHttpStatusFailure() {
        return httpStatus != null;
    }
}
