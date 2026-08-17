package com.trioloo.erp.integration.application;

/**
 * The connection condition could not be read.
 *
 * <p>🔴 {@code SCS-043.a} — THIS IS NOT A FIFTH CONNECTION STATE. It says that Integration
 * has no answer right now, which is a different claim from any of {@code API-068}'s four
 * conditions. Callers report "not known" and keep rendering the shop's own record
 * ({@code SYS-034}, {@code API-069}).
 *
 * <p>🔴 Its message is business-facing. No provider payload, endpoint, status code or
 * exception chain from a remote system is carried in it ({@code API-070}).
 */
public class ConnectionUnavailableException extends RuntimeException {

    public ConnectionUnavailableException(String message) {
        super(message);
    }
}
