package com.trioloo.erp.integration.infrastructure.steadfast;

/**
 * A Steadfast call did not produce a usable response.
 *
 * <p>🔴 THE STATUS IS CARRIED; THE BODY AND THE URI ARE NOT. Every Steadfast request sends the
 * merchant key as a plain header ({@code STF-003.b}), so an exception that quoted the request
 * would put a long-lived credential into the log ({@code DEP-021.d}).
 *
 * <p>⚠ {@code status} is {@code 0} when NO response arrived at all, which is a different fact from
 * a response with a bad status and is what lets an operator tell an outage from a refusal.
 */
public class SteadfastTransportException extends RuntimeException {

    private final int status;

    public SteadfastTransportException(String message) {
        this(message, 0);
    }

    public SteadfastTransportException(String message, int status) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }

    public boolean reachedProvider() {
        return status != 0;
    }
}
