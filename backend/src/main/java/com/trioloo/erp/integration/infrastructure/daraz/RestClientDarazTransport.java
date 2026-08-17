package com.trioloo.erp.integration.infrastructure.daraz;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URI;

/**
 * The production Daraz transport.
 *
 * <p>🔴 IT INTERPRETS NOTHING. Daraz reports application failures inside an HTTP 200
 * ({@code DZC-011}), so this returns the body untouched and lets the adapter judge the envelope. A
 * transport that threw on status alone would hide exactly the failures that matter.
 *
 * <p>🔴 NEITHER THE URI NOR THE BODY IS EVER LOGGED. The signed query carries the App Key and, on
 * seller-scoped calls, the access token; the body carries tokens outright.
 */
@Component
public class RestClientDarazTransport implements DarazTransport {

    private final RestClient client = RestClient.create();

    @Override
    public String get(URI uri) {
        try {
            return client.get().uri(uri).retrieve().body(String.class);
        } catch (RuntimeException e) {
            /*
              🔴 The cause is deliberately not chained: a client exception's message quotes the
              request URI, which is signed and may carry a token.
            */
            throw new DarazTransportException("The Daraz request could not be completed.");
        }
    }
}
