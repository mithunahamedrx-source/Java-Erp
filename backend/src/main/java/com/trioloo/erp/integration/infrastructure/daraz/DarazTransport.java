package com.trioloo.erp.integration.infrastructure.daraz;

import java.net.URI;

/**
 * The single place a Daraz HTTP call actually leaves the process.
 *
 * <p>⚠ IT EXISTS SO TESTS NEVER TOUCH THE MARKETPLACE. Everything above it — signing, token
 * validation, identity extraction, binding — is exercised against a controlled double, so the
 * whole authorisation flow can be proven without a seller account, a real App Secret, or a single
 * live request.
 *
 * <p>🔴 IT RETURNS THE RAW BODY AND JUDGES NOTHING. Daraz reports application failures inside an
 * HTTP 200 ({@code DZC-011}), so a transport that threw on status alone would hide exactly the
 * errors that matter.
 */
public interface DarazTransport {

    /**
     * Performs a signed GET and returns the response body.
     *
     * @throws DarazTransportException when the request could not be completed at all — 🔴 a
     *                                 transport fault, never an authorisation verdict.
     */
    String get(URI uri);
}
