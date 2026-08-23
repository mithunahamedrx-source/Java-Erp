package com.trioloo.erp.integration.infrastructure.steadfast;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;

/**
 * The production Steadfast transport.
 *
 * <p>🔴 IT RETURNS THE STATUS ALONGSIDE THE BODY INSTEAD OF THROWING ON A BAD ONE, AND THAT IS THE
 * WHOLE REASON IT DIFFERS FROM THE DARAZ TRANSPORT. {@code STF-007} recorded that Steadfast
 * answers {@code 401 Unauthorized Access} for a consignment that merely belongs to somebody else,
 * or an invoice that exists nowhere, using the same credential that returned {@code 200} seconds
 * earlier. A transport that threw on {@code 401} would force every caller to treat "parcel not
 * found" as "our credential is broken".
 *
 * <p>⚠ IT STILL DISTINGUISHES AN UNREACHABLE HOST FROM A BAD STATUS. Those collapse into one
 * opaque failure if nobody separates them, and then a provider outage looks like a DNS problem.
 *
 * <p>🔴 NEITHER THE URL NOR THE HEADERS ARE EVER LOGGED OR CHAINED INTO AN EXCEPTION. Every request
 * carries the merchant's long-lived key as a plain header ({@code STF-003.b}), and a client
 * exception's own message quotes the request it failed on.
 */
@Component
public class RestClientSteadfastTransport implements SteadfastTransport {

    private final RestClient client = RestClient.create();

    @Override
    public Response get(String url, Map<String, String> headers) {
        try {
            var request = client.get().uri(url);
            headers.forEach(request::header);
            var response = request.retrieve().toEntity(String.class);
            return new Response(response.getStatusCode().value(), response.getBody());
        } catch (RestClientResponseException e) {
            /*
              A response DID arrive and its status is one `retrieve()` treats as an error — which
              for this provider includes the routine "not yours / not found" 401. The status and
              body are handed back rather than thrown, because only the caller knows whether this
              status is a failure at THIS endpoint (STF-007.e).
            */
            return new Response(e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (RuntimeException e) {
            // 🔴 No response at all. The cause is NOT chained — its message quotes the URL.
            throw new SteadfastTransportException("The Steadfast request could not be completed.");
        }
    }
}
