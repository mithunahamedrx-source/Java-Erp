package com.trioloo.erp.integration.infrastructure.steadfast;

import java.util.Map;

/**
 * The Steadfast HTTP boundary.
 *
 * <p>🔴 IT INTERPRETS NOTHING ABOUT THE BODY. {@code STF-004} recorded three different {@code
 * status} shapes across three endpoints in a single session, so judging the envelope is the
 * adapter's job and cannot be pushed down here.
 */
public interface SteadfastTransport {

    /**
     * @return the response body, and the HTTP status that carried it.
     */
    Response get(String url, Map<String, String> headers);

    record Response(int status, String body) {
    }
}
