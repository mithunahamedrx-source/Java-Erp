package com.trioloo.erp.integration.infrastructure.daraz;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeType;
import tools.jackson.databind.ObjectMapper;
import com.trioloo.erp.integration.application.ChannelAuthorisationPort;
import com.trioloo.erp.integration.application.ChannelCredentialStore;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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
     * {@code DZC-010} — the only venture this integration will bind a shop to.
     *
     * <p>⚠ IT GUARDS BOTH RESPONSE SHAPES, DIFFERENTLY. On a cross-border token it selects the
     * Bangladesh entry out of SEVERAL in {@code country_user_info} — taking the first would bind a
     * Bangladesh shop to another venture's store. On a local-seller token there is only one account,
     * so it is matched against the TOP-LEVEL {@code country} instead.
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
          ✅ THE SAFE SHAPE OF THE RESPONSE, captured once and attached to every failure below.
          🔴 NAMES ONLY — no value from the body is ever read into it. This is what makes a wrapped
          payload ({@code [code, data, request_id]}) distinguishable from a flat one without anyone
          printing the body.
        */
        DarazResponseShape shape = new DarazResponseShape(topLevelFieldNames(body), containerShapes(body));
        String requestId = text(body, "request_id");
        String providerType = text(body, "type");

        /*
          ⚠ Daraz reports application failures inside an HTTP 200, so the envelope is checked rather
          than the status. A success response for token creation carries no `code` field at all; a
          failure carries a non-zero one.
        */
        JsonNode envelopeCode = body.get("code");
        if (envelopeCode != null && !envelopeCode.asText("").isEmpty() && !"0".equals(envelopeCode.asText())) {
            throw new DarazProtocolException(DarazProtocolException.Reason.ENVELOPE_CODE,
                    null, envelopeCode.asText(), providerType, requestId, shape);
        }

        String accessToken = required(body, "access_token", providerType, requestId, shape);
        String refreshToken = required(body, "refresh_token", providerType, requestId, shape);
        Instant accessExpiry = now.plusSeconds(requiredSeconds(body, "expires_in", providerType, requestId, shape));
        Instant refreshExpiry = now.plusSeconds(
                requiredSeconds(body, "refresh_expires_in", providerType, requestId, shape));

        String sellerId = bangladeshSellerId(body, providerType, requestId, shape);

        return Optional.of(new ChannelAuthorisationPort.AuthorisedAccount(
                sellerId,
                null,   // INV-16.14 — Daraz reports no storefront address here; none is invented.
                new ChannelCredentialStore.ProviderCredential(
                        accessToken, accessExpiry, refreshToken, refreshExpiry)));
    }

    /**
     * The container fields whose one-level shape is worth knowing when identity extraction fails.
     *
     * <p>⚠ AN ALLOW-LIST, NOT EVERYTHING. Descending into arbitrary fields would eventually walk
     * into one holding a token; these three are the containers the token contract can plausibly
     * carry identity in.
     */
    private static final List<String> DIAGNOSTIC_CONTAINERS =
            List.of("user_info", "country_user_info", "data");

    /**
     * Describes each allow-listed container by TYPE and, one level down, by FIELD NAME.
     *
     * <p>🔴 NO VALUE IS EVER READ. For an object this yields {@code OBJECT[seller_id,user_id]}; for
     * an array of objects, the first element's names; for a scalar, only its type. Absent
     * containers are reported as {@code ABSENT} so the log distinguishes "not there" from "empty".
     */
    private static Map<String, String> containerShapes(JsonNode body) {
        Map<String, String> shapes = new LinkedHashMap<>();
        for (String name : DIAGNOSTIC_CONTAINERS) {
            shapes.put(name, describeNode(body == null ? null : body.get(name)));
        }
        return shapes;
    }

    private static String describeNode(JsonNode node) {
        if (node == null) {
            return "ABSENT";
        }
        if (node.isObject()) {
            return "OBJECT" + fieldNamesOf(node);
        }
        if (node.isArray()) {
            if (node.isEmpty()) {
                return "ARRAY<EMPTY>";
            }
            JsonNode first = node.get(0);
            return first != null && first.isObject()
                    ? "ARRAY<OBJECT>" + fieldNamesOf(first)
                    : "ARRAY<" + scalarTypeOf(first) + ">";
        }
        return scalarTypeOf(node);
    }

    /** 🔴 Names only, joined. Never a value. */
    private static String fieldNamesOf(JsonNode object) {
        List<String> names = new ArrayList<>();
        object.properties().forEach(entry -> names.add(entry.getKey()));
        return "[" + String.join(",", names) + "]";
    }

    /** ⚠ Jackson's own node type, so the vocabulary cannot drift from the parser. */
    private static String scalarTypeOf(JsonNode node) {
        if (node == null) {
            return "UNKNOWN";
        }
        JsonNodeType type = node.getNodeType();
        return switch (type) {
            case STRING -> "STRING";
            case NUMBER -> "NUMBER";
            case BOOLEAN -> "BOOLEAN";
            case NULL -> "NULL";
            case OBJECT -> "OBJECT";
            case ARRAY -> "ARRAY";
            default -> "UNKNOWN";
        };
    }

    /** 🔴 Field NAMES only. No value is read. */
    private static List<String> topLevelFieldNames(JsonNode body) {
        List<String> names = new ArrayList<>();
        if (body != null && body.isObject()) {
            body.properties().forEach(entry -> names.add(entry.getKey()));
        }
        return names;
    }

    /** Reads a short, safe scalar the provider uses to classify its own response. */
    private static String text(JsonNode body, String field) {
        JsonNode value = body == null ? null : body.get(field);
        return value == null || value.asText("").isBlank() ? null : value.asText();
    }

    /**
     * {@code DZC-010} — the authoritative binding identity, on either of the two observed shapes.
     *
     * <p>🔴 TWO SHAPES, ONE IDENTITY MEANING. The documentation only ever described
     * {@code country_user_info}, an array carrying one entry per venture — which is what a
     * CROSS-BORDER seller receives. A live Bangladesh LOCAL seller returns no such array at all;
     * it returns a single {@code user_info} object and a top-level {@code country}. Both carry the
     * same fact: the seller id of the store being authorised.
     *
     * <p>🔴 REFUSED RATHER THAN SUBSTITUTED, ON BOTH PATHS. If neither shape yields a seller id the
     * authorisation fails. Falling back to the account email, {@code user_id}, {@code short_code}
     * or the venture code would corrupt the one fact {@code INV-16.6} tests every reauthorisation
     * against — and {@code V11}'s unique index would then permanently block the operator's second
     * Daraz shop.
     */
    private String bangladeshSellerId(JsonNode body, String providerType, String requestId,
                                      DarazResponseShape shape) {
        JsonNode entries = body.get("country_user_info");

        /*
          The documented path, UNCHANGED. A cross-border token carries several ventures, so the
          Bangladesh entry is selected explicitly — taking the first would bind a Bangladesh shop to
          another venture's store.
        */
        if (entries != null && entries.isArray() && !entries.isEmpty()) {
            for (JsonNode entry : entries) {
                JsonNode country = entry.get("country");
                if (country != null && BANGLADESH_COUNTRY.equalsIgnoreCase(country.asText(""))) {
                    JsonNode sellerId = entry.get("seller_id");
                    if (sellerId == null || sellerId.asText("").isBlank()) {
                        throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_SELLER_ID,
                                "seller_id", null, providerType, requestId, shape);
                    }
                    return sellerId.asText();
                }
            }
            throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_BD_ACCOUNT,
                    "country_user_info", null, providerType, requestId, shape);
        }

        return localSellerId(body, providerType, requestId, shape);
    }

    /**
     * The local-seller path: no {@code country_user_info}, one {@code user_info} object.
     *
     * <p>🔴 THE TOP-LEVEL {@code country} IS THE VENTURE GUARD, AND IT IS NOT OPTIONAL. On the
     * documented path each entry carries its own {@code country}, so Bangladesh can be picked out
     * of several. Here there is only one account in the response and nothing inside
     * {@code user_info} says which venture it belongs to — so the top-level field is the ONLY thing
     * standing between a Bangladesh shop and a seller from another venture. Absent or non-Bangladesh
     * is refused.
     */
    private String localSellerId(JsonNode body, String providerType, String requestId,
                                 DarazResponseShape shape) {
        JsonNode country = body.get("country");
        if (country == null || !BANGLADESH_COUNTRY.equalsIgnoreCase(country.asText(""))) {
            throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_BD_ACCOUNT,
                    "country", null, providerType, requestId, shape);
        }

        JsonNode userInfo = body.get("user_info");
        if (userInfo == null || !userInfo.isObject()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_FIELD,
                    "user_info", null, providerType, requestId, shape);
        }

        /*
          🔴 seller_id AND NOTHING ELSE. user_info was observed to also carry country, user_id and
          short_code; none of them is the store identity. user_id identifies a LOGIN, short_code is a
          display handle, and country is the venture we just checked.
        */
        JsonNode sellerId = userInfo.get("seller_id");
        if (sellerId == null || sellerId.asText("").isBlank()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_SELLER_ID,
                    "seller_id", null, providerType, requestId, shape);
        }
        return sellerId.asText();
    }

    private JsonNode parse(String body) {
        if (body == null || body.isBlank()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.EMPTY_RESPONSE);
        }
        try {
            JsonNode parsed = json.readTree(body);
            if (parsed == null || !parsed.isObject()) {
                /* JSON, but not an object — no field can be read from it. */
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
        long seconds = value.asLong();
        if (seconds <= 0) {
            /*
              ⚠ DZC-005 — `refresh_expires_in = 0` means NOT REFRESHABLE, which is a credential
              Trioloo cannot maintain. Refusing it at the door is honest; storing it would produce a
              shop that silently becomes unusable.
            */
            throw new DarazProtocolException(DarazProtocolException.Reason.UNUSABLE_DURATION,
                    field, null, providerType, requestId, shape);
        }
        return seconds;
    }
}
