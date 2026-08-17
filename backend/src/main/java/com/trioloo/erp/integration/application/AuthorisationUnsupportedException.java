package com.trioloo.erp.integration.application;

/**
 * Trioloo cannot authorise this channel type yet.
 *
 * <p>🔴 {@code SCS-092.d} — MEMBERSHIP OF THE RECOGNISED SET IMPLIES NO ADAPTER, and this is
 * how the system says so. It is NOT a permission denial and NOT a business rule: the operator
 * may be perfectly entitled to authorise, and the channel type may be perfectly valid — the
 * integration simply does not exist yet ({@code GAP-133}).
 *
 * <p>🔴 The message is business-facing. No provider name, endpoint, payload or error code
 * appears in it ({@code API-070}).
 */
public class AuthorisationUnsupportedException extends RuntimeException {

    public AuthorisationUnsupportedException(String message) {
        super(message);
    }
}
