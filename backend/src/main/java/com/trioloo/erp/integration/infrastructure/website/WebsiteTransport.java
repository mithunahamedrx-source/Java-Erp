package com.trioloo.erp.integration.infrastructure.website;

import java.util.Map;

/**
 * The storefront HTTP boundary. It interprets nothing about the body and returns the status rather than
 * throwing on it, so the caller decides what a given status means at a given endpoint.
 */
public interface WebsiteTransport {

    Response get(String url, Map<String, String> headers);

    Response patch(String url, String body, Map<String, String> headers);

    record Response(int status, String body) {
    }
}
