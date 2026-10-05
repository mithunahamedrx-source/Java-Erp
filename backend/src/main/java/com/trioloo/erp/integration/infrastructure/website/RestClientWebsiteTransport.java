package com.trioloo.erp.integration.infrastructure.website;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;
import java.util.function.Supplier;

/**
 * The production storefront transport.
 *
 * <p>🔴 NEITHER THE URL NOR THE HEADERS ARE EVER LOGGED OR CHAINED INTO AN EXCEPTION. Every request carries the
 * shared ERP key as a header, and a client exception's own message quotes the request it failed on.
 */
@Component
public class RestClientWebsiteTransport implements WebsiteTransport {

    private final RestClient client = RestClient.create();

    @Override
    public Response get(String url, Map<String, String> headers) {
        return send(() -> {
            var request = client.get().uri(url);
            headers.forEach(request::header);
            return request.retrieve().toEntity(String.class);
        });
    }

    @Override
    public Response patch(String url, String body, Map<String, String> headers) {
        return send(() -> {
            var request = client.patch().uri(url).header("Content-Type", "application/json")
                    .body(body == null ? "" : body);
            headers.forEach(request::header);
            return request.retrieve().toEntity(String.class);
        });
    }

    private Response send(Supplier<ResponseEntity<String>> call) {
        try {
            var response = call.get();
            return new Response(response.getStatusCode().value(), response.getBody());
        } catch (RestClientResponseException e) {
            return new Response(e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (RuntimeException e) {
            // 🔴 No response at all. The cause is NOT chained - its message quotes the URL.
            throw new WebsiteException("The website request could not be completed.");
        }
    }
}
