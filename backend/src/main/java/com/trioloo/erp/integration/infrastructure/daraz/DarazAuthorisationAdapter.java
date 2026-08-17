package com.trioloo.erp.integration.infrastructure.daraz;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.trioloo.erp.integration.application.ChannelAuthorisationPort;
import com.trioloo.erp.integration.application.ChannelCredentialStore;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Daraz seller authorisation: the redirect out, and the code exchange back.
 *
 * <p>Per {@code DZC-001}–{@code DZC-010}: Bangladesh authorises at
 * {@code https://api.daraz.com.bd/oauth/authorize} and calls REST APIs at
 * {@code https://api.daraz.com.bd/rest}, using OAuth 2.0 "code for token". The seller signs in on
 * Daraz's own page — 🔴 their credentials never touch Trioloo.
 *
 * <p>🔴 ONE ADAPTER SERVES MANY SHOPS ({@code API-071}). Every method takes an explicit
 * {@code channelInstanceId} and holds no per-shop state, so seven Daraz shops are seven scoped
 * authorisations rather than one adapter quietly reusing whichever account signed in last.
 */
@Component
public class DarazAuthorisationAdapter implements ChannelAuthorisationPort {

    /** {@code DZC-001} — the Bangladesh authorisation origin (a browser destination). */
    static final String BANGLADESH_AUTHORIZE_URL = "https://api.daraz.com.bd/oauth/authorize";

    /** {@code DZC-001} — the Bangladesh REST gateway (signed API calls). */
    static final String BANGLADESH_REST_BASE = "https://api.daraz.com.bd/rest";

    /** {@code DZC-004} — the documented token-creation API. */
    static final String TOKEN_CREATE_PATH = "/auth/token/create";

    /**
     * {@code DZC-010} — the venture whose {@code country_user_info} entry carries our identity.
     *
     * <p>⚠ A cross-border token returns SEVERAL entries. Taking the first would bind a Bangladesh
     * shop to another venture's store, so the entry is selected by country explicitly.
     */
    static final String BANGLADESH_COUNTRY = "bd";

    private final DarazProperties properties;
    private final DarazRequestSigner signer;
    private final DarazTransport transport;
    private final Clock clock;
    private final ObjectMapper json = new ObjectMapper();

    public DarazAuthorisationAdapter(DarazProperties properties,
                                     DarazRequestSigner signer,
                                     DarazTransport transport,
                                     Clock clock) {
        this.properties = properties;
        this.signer = signer;
        this.transport = transport;
        this.clock = clock;
    }

    @Override
    public ChannelTypeCode channelType() {
        return ChannelTypeCode.DARAZ;
    }

    // ================================================================= initiate

    /**
     * <p>🔴 FIVE PARAMETERS, EACH DELIBERATE. Daraz documents {@code client_id},
     * {@code redirect_uri} and {@code response_type} as required, and {@code force_auth},
     * {@code state}, {@code uuid} and {@code country} as optional.
     *
     * <p>✅ {@code state} is optional to Daraz but MANDATORY here — without it the callback carries
     * nothing that says which shop was authorised ({@code DZC-003}).
     *
     * <p>✅ {@code force_auth=true} is sent BECAUSE TRIOLOO CONNECTS SEVERAL DARAZ SHOPS. Without
     * it, a seller who is already signed in to one account in that browser can be authorised
     * straight through on the NEXT shop, silently binding it to the wrong seller. Forcing a fresh
     * sign-in is what makes the multi-shop case safe.
     *
     * <p>⚠ {@code uuid} and {@code country} are NOT sent: neither has a value this flow can derive
     * from a documented rule, and inventing one is how a parameter comes to mean something nobody
     * intended.
     *
     * <p>🔴 THE APP SECRET IS NEVER IN THIS URL, and neither is the shop id — the authorisation
     * request is a browser redirect the seller can read, and the callback must never be able to
     * name its own shop.
     */
    @Override
    public URI authorizationUri(UUID channelInstanceId, String state) {
        if (channelInstanceId == null) {
            throw new IllegalArgumentException("A channel instance is required to authorise.");
        }
        if (state == null || state.isBlank()) {
            throw new IllegalArgumentException("An authorisation state is required.");
        }
        DarazProperties.Configured configured = properties.require();

        /*
          UriComponentsBuilder encodes each value exactly once. 🔴 The redirect URI must reach Daraz
          byte-identical to the one registered on the App Console; hand-concatenation and
          double-encoding are both silent failures that surface only as a provider rejection.
        */
        return UriComponentsBuilder.fromUriString(BANGLADESH_AUTHORIZE_URL)
                .queryParam("response_type", "code")
                .queryParam("force_auth", "true")
                .queryParam("client_id", configured.appKey())
                .queryParam("redirect_uri", configured.redirectUri())
                .queryParam("state", state)
                .build()
                .encode()
                .toUri();
    }

    // ================================================================= complete

    /**
     * Exchanges the authorisation code, and reads the account identity out of the response.
     *
     * <p>🔴 THE AUTHORISATION CODE IS NEVER PERSISTED OR LOGGED. It is used once, here, and
     * discarded with the local variable.
     *
     * <p>🔴 STRICTER THAN THE DATABASE, ON PURPOSE ({@code DZC-006}). {@code channel_credential}
     * permits a NULL expiry because it is provider-neutral; Daraz always supplies both durations,
     * so a response missing either is refused rather than stored as "unknown".
     */
    @Override
    public Optional<ChannelAuthorisationPort.AuthorisedAccount> exchange(UUID channelInstanceId, String code) {
        if (channelInstanceId == null) {
            throw new IllegalArgumentException("A channel instance is required to authorise.");
        }
        if (code == null || code.isBlank()) {
            return Optional.empty();   // The seller did not complete authorisation.
        }
        DarazProperties.Configured configured = properties.require();

        Instant now = clock.instant();
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", configured.appKey());
        params.put("timestamp", Long.toString(now.toEpochMilli()));   // DZC-009 — epoch millis
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("code", code);

        String signature = signer.sign(TOKEN_CREATE_PATH, params, null, configured.appSecret());

        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(BANGLADESH_REST_BASE + TOKEN_CREATE_PATH);
        params.forEach(uri::queryParam);
        uri.queryParam(DarazRequestSigner.SIGNATURE_PARAMETER, signature);

        JsonNode body = parse(transport.get(uri.build().encode().toUri()));

        /*
          ⚠ Daraz reports application failures inside an HTTP 200, so the envelope is checked
          rather than the status. A success response for token creation carries no `code` field at
          all; a failure carries a non-zero one.
        */
        JsonNode envelopeCode = body.get("code");
        if (envelopeCode != null && !envelopeCode.asText("").isEmpty() && !"0".equals(envelopeCode.asText())) {
            throw new DarazProtocolException("the token request was refused", envelopeCode.asText());
        }

        String accessToken = required(body, "access_token");
        String refreshToken = required(body, "refresh_token");
        Instant accessExpiry = now.plusSeconds(requiredSeconds(body, "expires_in"));
        Instant refreshExpiry = now.plusSeconds(requiredSeconds(body, "refresh_expires_in"));

        String sellerId = bangladeshSellerId(body);

        return Optional.of(new ChannelAuthorisationPort.AuthorisedAccount(
                sellerId,
                null,   // INV-16.14 — Daraz reports no storefront address here; none is invented.
                new ChannelCredentialStore.ProviderCredential(
                        accessToken, accessExpiry, refreshToken, refreshExpiry)));
    }

    /**
     * {@code DZC-010} — the authoritative binding identity.
     *
     * <p>🔴 REFUSED RATHER THAN SUBSTITUTED. If no Bangladesh entry is present the authorisation
     * fails: binding a Bangladesh shop to another venture's store, or falling back to the account
     * email, would corrupt the one fact {@code INV-16.6} tests every reauthorisation against.
     */
    private String bangladeshSellerId(JsonNode body) {
        JsonNode entries = body.get("country_user_info");
        if (entries == null || !entries.isArray() || entries.isEmpty()) {
            throw new DarazProtocolException("the token response carried no country_user_info");
        }
        for (JsonNode entry : entries) {
            JsonNode country = entry.get("country");
            if (country != null && BANGLADESH_COUNTRY.equalsIgnoreCase(country.asText(""))) {
                JsonNode sellerId = entry.get("seller_id");
                if (sellerId == null || sellerId.asText("").isBlank()) {
                    throw new DarazProtocolException("the Bangladesh account carried no seller_id");
                }
                return sellerId.asText();
            }
        }
        throw new DarazProtocolException("the token response carried no Bangladesh account");
    }

    private JsonNode parse(String body) {
        if (body == null || body.isBlank()) {
            throw new DarazProtocolException("the response was empty");
        }
        try {
            return json.readTree(body);
        } catch (Exception e) {
            /* 🔴 Not chained and the body is not quoted: it contains tokens. */
            throw new DarazProtocolException("the response was not valid JSON");
        }
    }

    private static String required(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || value.asText("").isBlank()) {
            throw new DarazProtocolException("the token response omitted " + field);
        }
        return value.asText();
    }

    private static long requiredSeconds(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || !value.canConvertToLong()) {
            throw new DarazProtocolException("the token response omitted " + field);
        }
        long seconds = value.asLong();
        if (seconds <= 0) {
            /*
              ⚠ DZC-005 — `refresh_expires_in = 0` means NOT REFRESHABLE, which is a credential
              Trioloo cannot maintain. Refusing it at the door is honest; storing it would produce a
              shop that silently becomes unusable.
            */
            throw new DarazProtocolException(field + " was not a usable duration");
        }
        return seconds;
    }
}
