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

    /**
     * The write half.
     *
     * <p>⚠ IT DIFFERS FROM {@link #get} IN EXACTLY ONE WAY - it carries a body. Everything
     * else, including returning the status rather than throwing on it, is deliberately identical,
     * so no endpoint can acquire special error behaviour by being a POST.
     */
    Response post(String url, String body, Map<String, String> headers);

    record Response(int status, String body) {
    }
}
