package com.trioloo.erp.integration.infrastructure.steadfast;

/**
 * The provider answered, and the answer could not be understood.
 *
 * <p>⚠ DISTINCT FROM {@link SteadfastTransportException}, which means the call did not complete.
 * Collapsing the two makes a provider outage look identical to a payload the adapter cannot read,
 * and those need different operator responses.
 */
public class SteadfastProtocolException extends RuntimeException {
    public SteadfastProtocolException(String message) {
        super(message);
    }
}
