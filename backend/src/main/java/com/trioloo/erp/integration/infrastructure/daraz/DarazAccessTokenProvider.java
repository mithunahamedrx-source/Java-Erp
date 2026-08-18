package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.integration.application.ChannelCredentialStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Supplies a usable Daraz access token, refreshing on demand — {@code DZC-030}.
 *
 * <p>🔴 THE CREDENTIAL EXPIRES, AND THAT IS WHY THIS EXISTS. A Daraz access token lasts about 30
 * days. Without this, the connection gate's result — a bound seller, a credential encrypted at rest
 * — simply stops working one morning with no warning and no recovery path short of asking the
 * seller to authorise again.
 *
 * <p>🔴 ON DEMAND, NOT SCHEDULED. This refreshes immediately before a call that needs a token, and
 * nothing here runs on a timer. {@code DZC-030} records that a scheduler is a NEW operational
 * behaviour and is deliberately not assumed.
 *
 * <p>🔴 IF THE TOKEN CANNOT BE MADE USABLE, THE CALLER GETS AN EXCEPTION AND NOT A TOKEN
 * ({@code DZC-030.c}). There is no "try the listing API anyway and see": a call on a token believed
 * dead produces a provider error that looks like a protocol fault and sends the next reader down
 * the wrong path entirely.
 *
 * <p>🔴 REFRESH NEVER REBINDS IDENTITY. {@code /auth/token/refresh} is expected to mirror creation's
 * response, which carries account and seller identity — and NONE of it is read here. The bound
 * {@code external_account_identity} was decided once, at authorisation, under {@code DZC-010};
 * re-deriving it on every refresh would let a provider change silently move a shop to another
 * seller. This class reads exactly four fields and writes exactly two tokens and two expiries.
 */
@Component
public class DarazAccessTokenProvider {

    /** {@code DZC-030} — the refresh API, alongside creation under the System category. */
    static final String TOKEN_REFRESH_PATH = "/auth/token/refresh";

    private final DarazProperties properties;
    private final DarazRequestSigner signer;
    private final DarazTransport transport;
    private final ChannelCredentialStore credentials;
    private final Clock clock;
    private final Duration refreshMargin;
    private final ObjectMapper json = new ObjectMapper();

    public DarazAccessTokenProvider(DarazProperties properties,
                                    DarazRequestSigner signer,
                                    DarazTransport transport,
                                    ChannelCredentialStore credentials,
                                    Clock clock,
                                    /*
                                      ⚠ A MARGIN, NOT A DEADLINE. Refreshing exactly at expiry races
                                      the provider's own clock, and ±7200s of permitted skew
                                      (`DZC-009`) means "not yet expired" here can be "expired"
                                      there. A day is far wider than the skew and far narrower than
                                      the 30-day life, so it costs at most one extra refresh a day.
                                    */
                                    @Value("${integration.daraz.token-refresh-margin:PT24H}")
                                    Duration refreshMargin) {
        this.properties = properties;
        this.signer = signer;
        this.transport = transport;
        this.credentials = credentials;
        this.clock = clock;
        this.refreshMargin = refreshMargin;
    }

    /**
     * Returns an access token that is usable now, refreshing first if it is not.
     *
     * @throws DarazCredentialException when no usable token can be produced. 🔴 Its
     *                                  {@code reauthorisationRequired} flag is the caller's
     *                                  classification ({@code DZC-011}); the caller must NOT infer
     *                                  one from the message.
     */
    public String accessTokenFor(UUID channelInstanceId) {
        if (channelInstanceId == null) {
            throw new IllegalArgumentException("A channel instance is required.");
        }
        ChannelCredentialStore.ProviderCredential current = credentials.load(channelInstanceId)
                .orElseThrow(() -> DarazCredentialException.reauthorisationRequired(
                        "This shop holds no Daraz credential. The seller must authorise it."));

        Instant now = clock.instant();
        if (usableWithoutRefresh(current, now)) {
            /* ✅ THE COMMON CASE COSTS NOTHING. No signing, no request, no provider contact. */
            return current.accessToken();
        }
        return refresh(channelInstanceId, current, now);
    }

    /**
     * ⚠ AN UNKNOWN EXPIRY IS TREATED AS "REFRESH", NOT AS "FINE". {@code channel_credential} permits
     * a null expiry because it is provider-neutral ({@code TEC-119}); a token whose life we cannot
     * prove is exactly the one we must not gamble a listing call on.
     */
    private boolean usableWithoutRefresh(ChannelCredentialStore.ProviderCredential credential, Instant now) {
        Instant expiresAt = credential.accessTokenExpiresAt();
        return expiresAt != null && now.isBefore(expiresAt.minus(refreshMargin));
    }

    private String refresh(UUID channelInstanceId,
                           ChannelCredentialStore.ProviderCredential current,
                           Instant now) {
        /*
          🔴 `DZC-011` — the two LOCAL, deterministic reauthorisation facts, checked before any
          request. Daraz publishes no error codes for these APIs, so evidence that survives a round
          trip is scarce; evidence we already hold is not.
        */
        if (current.refreshToken() == null) {
            throw DarazCredentialException.reauthorisationRequired(
                    "This Daraz credential carries no refresh token, so it cannot be renewed. "
                            + "The seller must authorise the shop again.");
        }
        if (current.refreshTokenExpiresAt() != null && !now.isBefore(current.refreshTokenExpiresAt())) {
            throw DarazCredentialException.reauthorisationRequired(
                    "This Daraz refresh token has expired, so the access token cannot be renewed. "
                            + "The seller must authorise the shop again.");
        }

        DarazProperties.Configured configured = properties.require();

        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", configured.appKey());
        params.put("timestamp", Long.toString(now.toEpochMilli()));   // DZC-009 — epoch millis
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("refresh_token", current.refreshToken());

        String signature = signer.sign(TOKEN_REFRESH_PATH, params, null, configured.appSecret());

        UriComponentsBuilder uri = UriComponentsBuilder
                .fromUriString(DarazAuthorisationAdapter.BANGLADESH_REST_BASE + TOKEN_REFRESH_PATH);
        params.forEach(uri::queryParam);
        uri.queryParam(DarazRequestSigner.SIGNATURE_PARAMETER, signature);

        /*
          ⚠ A GET, MIRRORING CREATION. `/auth/token/create` is a GET and is verified against the live
          provider; the reference does not separately publish a method for refresh. Mirroring the
          verified sibling is the non-guessing choice.
        */
        JsonNode body = parse(transport.get(uri.build().encode().toUri()));

        DarazResponseShape shape = new DarazResponseShape(topLevelFieldNames(body), Map.of());
        String requestId = text(body, "request_id");
        String providerType = text(body, "type");

        JsonNode envelopeCode = body.get("code");
        if (envelopeCode != null && !envelopeCode.asText("").isEmpty() && !"0".equals(envelopeCode.asText())) {
            /*
              🔴 `DZC-011` — an unclassified non-zero code is ERROR, never REAUTH_REQUIRED. Daraz
              publishes no code that means "the seller must authorise again", so treating one as if
              it did would be inventing the very mapping the rule refuses to invent.
            */
            throw new DarazProtocolException(DarazProtocolException.Reason.ENVELOPE_CODE,
                    null, envelopeCode.asText(), providerType, requestId, shape);
        }

        String accessToken = required(body, "access_token", providerType, requestId, shape);
        String refreshToken = required(body, "refresh_token", providerType, requestId, shape);
        long accessSeconds = requiredSeconds(body, "expires_in", providerType, requestId, shape);
        long refreshSeconds = requiredSeconds(body, "refresh_expires_in", providerType, requestId, shape);

        /*
          🔴 `DZC-011` — refresh_expires_in = 0 is DOCUMENTED to mean the access token cannot be
          refreshed. It is the one provider-supplied fact that genuinely identifies the credential
          as finished, so it is the one that earns REAUTH_REQUIRED.
        */
        if (refreshSeconds == 0) {
            throw DarazCredentialException.reauthorisationRequired(
                    "Daraz reports this credential can no longer be refreshed. "
                            + "The seller must authorise the shop again.");
        }
        if (accessSeconds <= 0 || refreshSeconds < 0) {
            throw new DarazProtocolException(DarazProtocolException.Reason.UNUSABLE_DURATION,
                    accessSeconds <= 0 ? "expires_in" : "refresh_expires_in",
                    null, providerType, requestId, shape);
        }

        ChannelCredentialStore.ProviderCredential renewed = new ChannelCredentialStore.ProviderCredential(
                accessToken, now.plusSeconds(accessSeconds), refreshToken, now.plusSeconds(refreshSeconds));

        /* 🔴 Written against the SAME channel instance it was loaded for. */
        credentials.putRefreshed(channelInstanceId, renewed, now);
        return accessToken;
    }

    // ================================================================= safe parsing

    private JsonNode parse(String body) {
        if (body == null || body.isBlank()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.EMPTY_RESPONSE);
        }
        try {
            JsonNode parsed = json.readTree(body);
            if (parsed == null || !parsed.isObject()) {
                throw new DarazProtocolException(DarazProtocolException.Reason.MALFORMED_RESPONSE);
            }
            return parsed;
        } catch (DarazProtocolException e) {
            throw e;
        } catch (Exception e) {
            /* 🔴 Not chained and the body is not quoted: it contains tokens. */
            throw new DarazProtocolException(DarazProtocolException.Reason.NON_JSON);
        }
    }

    /** 🔴 Field NAMES only. No value is read. */
    private static List<String> topLevelFieldNames(JsonNode body) {
        List<String> names = new ArrayList<>();
        if (body != null && body.isObject()) {
            body.properties().forEach(entry -> names.add(entry.getKey()));
        }
        return names;
    }

    private static String text(JsonNode body, String field) {
        JsonNode value = body == null ? null : body.get(field);
        return value == null || value.asText("").isBlank() ? null : value.asText();
    }

    private static String required(JsonNode body, String field, String providerType,
                                   String requestId, DarazResponseShape shape) {
        JsonNode value = body.get(field);
        if (value == null || value.asText("").isBlank()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_FIELD,
                    field, null, providerType, requestId, shape);
        }
        return value.asText();
    }

    private static long requiredSeconds(JsonNode body, String field, String providerType,
                                        String requestId, DarazResponseShape shape) {
        JsonNode value = body.get(field);
        if (value == null || !value.canConvertToLong()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_FIELD,
                    field, null, providerType, requestId, shape);
        }
        return value.asLong();
    }
}
