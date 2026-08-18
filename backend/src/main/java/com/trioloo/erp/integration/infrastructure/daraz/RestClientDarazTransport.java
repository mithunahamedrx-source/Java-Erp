package com.trioloo.erp.integration.infrastructure.daraz;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;

/**
 * The production Daraz transport.
 *
 * <p>🔴 IT INTERPRETS NOTHING ABOUT THE BODY. Daraz reports application failures inside an HTTP 200
 * ({@code DZC-011}), so this returns the body untouched and lets the adapter judge the envelope. A
 * transport that threw on status alone would hide exactly the failures that matter.
 *
 * <p>⚠ IT DOES, HOWEVER, DISTINGUISH A BAD STATUS FROM AN UNREACHABLE HOST. Both used to collapse
 * into one opaque failure, which made a provider outage look identical to a DNS problem.
 *
 * <p>🔴 NEITHER THE URI NOR THE BODY IS EVER LOGGED OR CAPTURED. The signed query carries the App
 * Key and, on seller-scoped calls, the access token; the body carries tokens outright.
 */
@Component
public class RestClientDarazTransport implements DarazTransport {

    private final RestClient client = RestClient.create();

    @Override
    public String get(URI uri) {
        return send(() -> client.get().uri(uri).retrieve().body(String.class));
    }

    /**
     * 🔴 {@code DZC-029} — the POST half, and it differs from {@link #get} in exactly one way:
     * it carries a body and declares a content type. Everything else — no interpretation of the
     * payload, the same status-versus-unreachable split, the same silence about the URI — is
     * deliberately identical, so no endpoint can acquire special error behaviour by being a POST.
     *
     * <p>⚠ THE MEDIA TYPE IS PARSED BEFORE THE CALL. An unusable content type is a programming
     * fault, not a provider fault, and reporting it as "could not be completed" would blame the
     * marketplace for a local mistake.
     */
    @Override
    public String post(URI uri, String body, String contentType) {
        MediaType mediaType = MediaType.parseMediaType(contentType);
        String payload = body == null ? "" : body;
        return send(() -> client.post()
                .uri(uri)
                .contentType(mediaType)
                .body(payload)
                .retrieve()
                .body(String.class));
    }

    /**
     * The one place a Daraz call's failure is classified.
     *
     * <p>🔴 GET AND POST SHARE IT SO THEY CANNOT DRIFT APART. Two copies of this logic would
     * eventually disagree about what "reached" means, and the diagnostics built on that distinction
     * would quietly stop being comparable.
     */
    private String send(java.util.function.Supplier<String> call) {
        try {
            return call.get();
        } catch (RestClientResponseException e) {
            /*
              A response DID arrive; only its status is unusable. The status is safe to carry — the
              body is not, and is deliberately dropped.
            */
            throw new DarazTransportException(
                    "The Daraz request returned an unusable HTTP status.", e.getStatusCode().value());
        } catch (RuntimeException e) {
            /*
              🔴 No response at all. The cause is not chained: a client exception's message quotes
              the request URI, which is signed and may carry a token.
            */
            throw new DarazTransportException("The Daraz request could not be completed.");
        }
    }
}
