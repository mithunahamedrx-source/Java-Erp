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

    /**
     * Performs a signed POST and returns the response body.
     *
     * <p>🔴 {@code DZC-029} — SOME DARAZ APIS ARE POST, AND THIS EXISTS FOR THEM.
     * {@code /product/item/get}, the single-listing read, is documented as a POST; a GET-only
     * transport cannot reach it at all.
     *
     * <p>🔴 THE CONTENT TYPE IS THE CALLER'S, AND THAT IS DELIBERATE. {@code DZC-021} records
     * that the reference does NOT publish which content type these endpoints expect, so this
     * transport refuses to pick one on the provider's behalf. It is a pipe: it sends the bytes it
     * is given, under the header it is told, and judges nothing.
     *
     * <p>⚠ THE URI IS ALREADY SIGNED BY THE CALLER, exactly as {@link #get} expects. Signing spans
     * the api path, the parameters AND the body ({@code DZC-008}), so only the caller — which holds
     * all three — can produce a correct signature.
     *
     * @param body        the exact bytes to send, already included in the signature. A null body is
     *                    sent as empty rather than rejected: {@code DZC-008} allows a POST with no
     *                    body, and the signature simply spans nothing extra.
     * @param contentType the media type to declare, e.g. {@code application/json}.
     * @throws DarazTransportException when the request could not be completed at all — 🔴 a
     *                                 transport fault, never an authorisation verdict.
     */
    String post(URI uri, String body, String contentType);
}
