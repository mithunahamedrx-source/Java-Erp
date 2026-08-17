package com.trioloo.erp.integration.infrastructure.daraz;

/**
 * A Daraz request could not be completed at all — DNS, connection, timeout, TLS.
 *
 * <p>🔴 A TRANSPORT FAULT IS NEVER AN AUTHORISATION VERDICT ({@code DZC-011}). It proves nothing
 * about whether the seller's authorisation is still good, so it must never become
 * {@code REAUTH_REQUIRED}; it is an {@code ERROR}.
 *
 * <p>⚠ The cause is not chained: a client exception can quote the request URI, which carries the
 * signed query and, on seller-scoped calls, the access token.
 */
public class DarazTransportException extends RuntimeException {

    public DarazTransportException(String message) {
        super(message, null, false, false);
    }
}
