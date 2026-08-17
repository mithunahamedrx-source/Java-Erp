package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.integration.application.ChannelAuthorisationPort;
import com.trioloo.erp.integration.application.ChannelCredentialStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The Daraz adapter — redirect out, and code exchange back.
 *
 * <p>🔴 NO MARKETPLACE IS CONTACTED. The transport is a controlled double, so the entire protocol
 * surface is proven without a seller account, a real App Secret, or a live request.
 */
class DarazAuthorisationAdapterTest {

    private static final String KEY = "000000-test-app-key";
    private static final String SECRET = "test-app-secret-not-a-real-value";
    private static final String REDIRECT = "https://example.test/api/integration/daraz/callback";
    private static final UUID SHOP = UUID.fromString("aaaaaaaa-0000-0000-0000-000000000001");
    private static final String STATE = "AbCd-1234_state-value";

    private static final Instant NOW = Instant.parse("2026-08-17T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    /** A complete, well-formed Bangladesh token response. Values are obvious fakes. */
    private static final String VALID_TOKEN = """
            {"access_token":"test-access-token","refresh_token":"test-refresh-token",
             "expires_in":259200,"refresh_expires_in":604800,
             "account":"seller@example.test","account_platform":"seller_center","country":"bd",
             "country_user_info":[{"country":"bd","seller_id":"BD-SELLER-1","user_id":101}]}""";

    private URI captured;

    private DarazAuthorisationAdapter adapter(String body) {
        return adapter(KEY, SECRET, REDIRECT, body);
    }

    private DarazAuthorisationAdapter adapter(String key, String secret, String redirect, String body) {
        DarazTransport transport = uri -> {
            captured = uri;
            return body;
        };
        return new DarazAuthorisationAdapter(
                new DarazProperties(key, secret, redirect), new DarazRequestSigner(), transport, clock);
    }

    private static Map<String, String> query(URI uri) {
        Map<String, String> params = new HashMap<>();
        String raw = uri.getRawQuery();
        if (raw == null) {
            return params;
        }
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            params.put(URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8),
                    URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
        }
        return params;
    }

    // ================================================================= authorisation URL

    @Test
    @DisplayName("the destination is the official Bangladesh authorisation origin")
    void officialBangladeshHost() {
        URI uri = adapter(VALID_TOKEN).authorizationUri(SHOP, STATE);

        assertThat(uri.getScheme()).isEqualTo("https");
        assertThat(uri.getHost()).isEqualTo("api.daraz.com.bd");
        assertThat(uri.getPath()).isEqualTo("/oauth/authorize");
    }

    /**
     * 🔴 {@code force_auth=true} IS WHAT MAKES SEVERAL DARAZ SHOPS SAFE. Without it a seller already
     * signed in to one account can be authorised straight through on the NEXT shop, binding it to
     * the wrong seller with no visible error.
     */
    @Test
    @DisplayName("exactly the five intended parameters are sent, including force_auth")
    void exactlyTheIntendedParameters() {
        Map<String, String> params = query(adapter(VALID_TOKEN).authorizationUri(SHOP, STATE));

        assertThat(params).containsOnlyKeys("response_type", "force_auth", "client_id", "redirect_uri", "state");
        assertThat(params).containsEntry("response_type", "code");
        assertThat(params).containsEntry("force_auth", "true");
        assertThat(params).containsEntry("client_id", KEY);
        assertThat(params).containsEntry("redirect_uri", REDIRECT);
        assertThat(params).containsEntry("state", STATE);
        /* ⚠ Optional parameters we cannot derive a value for are absent, not guessed. */
        assertThat(params).doesNotContainKeys("uuid", "country");
    }

    @Test
    @DisplayName("the redirect URI and state round-trip unchanged, with no double-encoding")
    void encodingIsExact() {
        URI uri = adapter(VALID_TOKEN).authorizationUri(SHOP, STATE);

        assertThat(query(uri)).containsEntry("redirect_uri", REDIRECT).containsEntry("state", STATE);
        assertThat(uri.getRawQuery()).doesNotContain("%25");
    }

    @Test
    @DisplayName("neither the App Secret nor the shop id ever reaches the authorisation URL")
    void nothingPrivateInTheUrl() {
        URI uri = adapter(VALID_TOKEN).authorizationUri(SHOP, STATE);

        assertThat(uri.toString()).doesNotContain(SECRET).doesNotContain(SHOP.toString());
    }

    @Test
    @DisplayName("missing Daraz configuration fails by variable name before any URL is built")
    void missingConfigurationFailsSafely() {
        assertThatThrownBy(() -> adapter("", SECRET, REDIRECT, VALID_TOKEN).authorizationUri(SHOP, STATE))
                .isInstanceOf(DarazConfigurationException.class)
                .hasMessageContaining("DARAZ_APP_KEY");
    }

    // ================================================================= token exchange

    @Test
    @DisplayName("a valid exchange yields the Bangladesh seller id as the binding identity")
    void exchangeYieldsBangladeshSellerId() {
        Optional<ChannelAuthorisationPort.AuthorisedAccount> account =
                adapter(VALID_TOKEN).exchange(SHOP, "the-code");

        assertThat(account).isPresent();
        assertThat(account.get().accountIdentity()).isEqualTo("BD-SELLER-1");
        /* INV-16.14 — Daraz reports no storefront address here, so none is invented. */
        assertThat(account.get().link()).isNull();
    }

    @Test
    @DisplayName("both token lifetimes become absolute instants, independently")
    void expiriesAreAbsoluteAndIndependent() {
        ChannelCredentialStore.ProviderCredential credential =
                adapter(VALID_TOKEN).exchange(SHOP, "the-code").orElseThrow().credential();

        assertThat(credential.accessToken()).isEqualTo("test-access-token");
        assertThat(credential.refreshToken()).isEqualTo("test-refresh-token");
        assertThat(credential.accessTokenExpiresAt()).isEqualTo(NOW.plusSeconds(259200));
        assertThat(credential.refreshTokenExpiresAt()).isEqualTo(NOW.plusSeconds(604800));
        assertThat(credential.accessTokenExpiresAt()).isNotEqualTo(credential.refreshTokenExpiresAt());
    }

    /** 🔴 A cross-border token carries several ventures; the wrong one would bind the wrong store. */
    @Test
    @DisplayName("the Bangladesh entry is selected explicitly, never the first one")
    void bangladeshEntryIsSelectedExplicitly() {
        String crossBorder = """
                {"access_token":"a","refresh_token":"r","expires_in":100,"refresh_expires_in":200,
                 "country_user_info":[{"country":"sg","seller_id":"SG-1","user_id":1},
                                      {"country":"bd","seller_id":"BD-2","user_id":2}]}""";

        assertThat(adapter(crossBorder).exchange(SHOP, "c").orElseThrow().accountIdentity())
                .isEqualTo("BD-2");
    }

    @Test
    @DisplayName("a token with no Bangladesh account is refused, never substituted")
    void missingBangladeshAccountIsRefused() {
        String noBd = """
                {"access_token":"a","refresh_token":"r","expires_in":100,"refresh_expires_in":200,
                 "account":"seller@example.test",
                 "country_user_info":[{"country":"sg","seller_id":"SG-1","user_id":1}]}""";

        assertThatThrownBy(() -> adapter(noBd).exchange(SHOP, "c"))
                .isInstanceOf(DarazProtocolException.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.type(DarazProtocolException.class))
                .extracting(DarazProtocolException::reason)
                .isEqualTo(DarazProtocolException.Reason.MISSING_BD_ACCOUNT);
    }

    @Test
    @DisplayName("a Bangladesh entry without a seller id is refused")
    void missingSellerIdIsRefused() {
        String noSeller = """
                {"access_token":"a","refresh_token":"r","expires_in":100,"refresh_expires_in":200,
                 "country_user_info":[{"country":"bd","user_id":2}]}""";

        assertThatThrownBy(() -> adapter(noSeller).exchange(SHOP, "c"))
                .isInstanceOf(DarazProtocolException.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.type(DarazProtocolException.class))
                .extracting(DarazProtocolException::reason)
                .isEqualTo(DarazProtocolException.Reason.MISSING_SELLER_ID);
    }

    /** 🔴 {@code DZC-006} — the adapter is stricter than the provider-neutral database. */
    @Test
    @DisplayName("a token response missing any required field is refused")
    void incompleteTokenResponsesAreRefused() {
        record Case(String field, String body) { }
        var cases = new Case[]{
                new Case("access_token", """
                        {"refresh_token":"r","expires_in":1,"refresh_expires_in":2,
                         "country_user_info":[{"country":"bd","seller_id":"S"}]}"""),
                new Case("refresh_token", """
                        {"access_token":"a","expires_in":1,"refresh_expires_in":2,
                         "country_user_info":[{"country":"bd","seller_id":"S"}]}"""),
                new Case("expires_in", """
                        {"access_token":"a","refresh_token":"r","refresh_expires_in":2,
                         "country_user_info":[{"country":"bd","seller_id":"S"}]}"""),
                new Case("refresh_expires_in", """
                        {"access_token":"a","refresh_token":"r","expires_in":1,
                         "country_user_info":[{"country":"bd","seller_id":"S"}]}"""),
        };

        for (Case c : cases) {
            assertThatThrownBy(() -> adapter(c.body()).exchange(SHOP, "code"))
                    .as("missing %s", c.field())
                    .isInstanceOf(DarazProtocolException.class)
                    .hasMessageContaining(c.field());
        }
    }

    /** ⚠ {@code DZC-005} — zero means NOT REFRESHABLE, which is a credential we cannot maintain. */
    @Test
    @DisplayName("a non-refreshable token is refused rather than stored")
    void nonRefreshableTokenIsRefused() {
        String zero = """
                {"access_token":"a","refresh_token":"r","expires_in":100,"refresh_expires_in":0,
                 "country_user_info":[{"country":"bd","seller_id":"S"}]}""";

        assertThatThrownBy(() -> adapter(zero).exchange(SHOP, "c"))
                .isInstanceOf(DarazProtocolException.class)
                .hasMessageContaining("refresh_expires_in");
    }

    /** ⚠ Daraz reports application failures inside an HTTP 200, so the envelope is what counts. */
    @Test
    @DisplayName("a non-zero envelope code is refused even though the transport succeeded")
    void nonZeroEnvelopeCodeIsRefused() {
        String failure = """
                {"code":"IllegalAccessToken","type":"ISV","message":"something the provider said",
                 "request_id":"abc123"}""";

        assertThatThrownBy(() -> adapter(failure).exchange(SHOP, "c"))
                .isInstanceOf(DarazProtocolException.class)
                .hasMessageContaining("IllegalAccessToken")
                /* 🔴 The provider's own message is NOT repeated — it can echo request parameters. */
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("something the provider said"));
    }

    @Test
    @DisplayName("an unparseable body is refused without quoting it")
    void unparseableBodyIsRefused() {
        assertThatThrownBy(() -> adapter("not json at all").exchange(SHOP, "c"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("not json"));
        assertThatThrownBy(() -> adapter("").exchange(SHOP, "c"))
                .isInstanceOf(DarazProtocolException.class);
    }

    @Test
    @DisplayName("a missing code is 'the seller did not finish', not an error")
    void missingCodeIsNotCompleted() {
        assertThat(adapter(VALID_TOKEN).exchange(SHOP, null)).isEmpty();
        assertThat(adapter(VALID_TOKEN).exchange(SHOP, "  ")).isEmpty();
    }

    // ================================================================= the signed request

    @Test
    @DisplayName("the exchange is a signed call to the Bangladesh REST gateway")
    void exchangeIsSignedAgainstTheRestGateway() {
        adapter(VALID_TOKEN).exchange(SHOP, "the-code");

        assertThat(captured.getHost()).isEqualTo("api.daraz.com.bd");
        assertThat(captured.getPath()).isEqualTo("/rest/auth/token/create");

        Map<String, String> params = query(captured);
        assertThat(params).containsEntry("app_key", KEY);
        assertThat(params).containsEntry("sign_method", "sha256");
        assertThat(params).containsEntry("code", "the-code");
        assertThat(params.get("timestamp")).isEqualTo(Long.toString(NOW.toEpochMilli()));
        assertThat(params.get("sign")).hasSize(64).matches("[0-9A-F]{64}");

        /* 🔴 The App Secret keys the signature; it is never transmitted. */
        assertThat(captured.toString()).doesNotContain(SECRET);
    }

    @Test
    @DisplayName("the adapter declares Daraz")
    void declaresDaraz() {
        assertThat(adapter(VALID_TOKEN).channelType())
                .isEqualTo(com.trioloo.erp.system.domain.ChannelTypeCode.DARAZ);
    }

    // ================================================================= safe diagnostics

    /** Readable JSON fixtures without text-block quoting pitfalls. */
    private static String json(String singleQuoted) {
        return singleQuoted.replace('\'', '"');
    }

    /**
     * 🔴 THE REGRESSION MATRIX FOR THE LIVE INCIDENT. A production failure logged
     * {@code providerCode=null} and nothing else, which matched eight different causes at once.
     * Each of them must now name itself.
     */
    @Test
    @DisplayName("every failure classifies itself with a distinct, safe reason")
    void everyFailureHasItsOwnReason() {
        record Case(DarazProtocolException.Reason reason, String field, String body) { }

        String bd = "'country_user_info':[{'country':'bd','seller_id':'S'}]";
        var cases = new Case[]{
                new Case(DarazProtocolException.Reason.EMPTY_RESPONSE, null, ""),
                new Case(DarazProtocolException.Reason.NON_JSON, null, "not json at all"),
                new Case(DarazProtocolException.Reason.MALFORMED_RESPONSE, null, "[1,2,3]"),
                new Case(DarazProtocolException.Reason.ENVELOPE_CODE, null,
                        json("{'code':'IllegalAccessToken','type':'ISV','request_id':'r-1'}")),
                new Case(DarazProtocolException.Reason.MISSING_FIELD, "access_token",
                        json("{'refresh_token':'r','expires_in':1,'refresh_expires_in':2," + bd + "}")),
                new Case(DarazProtocolException.Reason.MISSING_FIELD, "refresh_token",
                        json("{'access_token':'a','expires_in':1,'refresh_expires_in':2," + bd + "}")),
                new Case(DarazProtocolException.Reason.MISSING_FIELD, "expires_in",
                        json("{'access_token':'a','refresh_token':'r','refresh_expires_in':2," + bd + "}")),
                new Case(DarazProtocolException.Reason.MISSING_FIELD, "refresh_expires_in",
                        json("{'access_token':'a','refresh_token':'r','expires_in':1," + bd + "}")),
                new Case(DarazProtocolException.Reason.UNUSABLE_DURATION, "refresh_expires_in",
                        json("{'access_token':'a','refresh_token':'r','expires_in':1,"
                                + "'refresh_expires_in':0," + bd + "}")),
                new Case(DarazProtocolException.Reason.MISSING_COUNTRY_USER_INFO, "country_user_info",
                        json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2}")),
                new Case(DarazProtocolException.Reason.MISSING_BD_ACCOUNT, "country_user_info",
                        json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                                + "'country_user_info':[{'country':'sg','seller_id':'SG-1'}]}")),
                new Case(DarazProtocolException.Reason.MISSING_SELLER_ID, "seller_id",
                        json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                                + "'country_user_info':[{'country':'bd','user_id':2}]}")),
        };

        for (Case c : cases) {
            assertThatThrownBy(() -> adapter(c.body()).exchange(SHOP, "code"))
                    .as("reason %s", c.reason())
                    .isInstanceOf(DarazProtocolException.class)
                    .satisfies(e -> {
                        DarazProtocolException p = (DarazProtocolException) e;
                        assertThat(p.reason()).isEqualTo(c.reason());
                        assertThat(p.field()).isEqualTo(c.field());
                    });
        }
    }

    /** 🔴 A field NAME identifies the fault; a field VALUE would leak a token. */
    @Test
    @DisplayName("field carries only a field name, never a value")
    void fieldIsANameNotAValue() {
        String body = json("{'access_token':'super-secret-access','refresh_token':'super-secret-refresh',"
                + "'expires_in':1,'refresh_expires_in':0,"
                + "'country_user_info':[{'country':'bd','seller_id':'BD-1'}]}");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.field()).isEqualTo("refresh_expires_in");
                    assertThat(p.getMessage()).doesNotContain("super-secret-access");
                    assertThat(p.getMessage()).doesNotContain("super-secret-refresh");
                });
    }

    @Test
    @DisplayName("the provider's request id and type are captured when present")
    void requestIdAndTypeAreCaptured() {
        String body = json("{'code':'IncompleteSignature','type':'ISV','message':'echoed parameters',"
                + "'request_id':'0be6fdce15200450346451004'}");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.requestId()).isEqualTo("0be6fdce15200450346451004");
                    assertThat(p.providerType()).isEqualTo("ISV");
                    assertThat(p.providerCode()).isEqualTo("IncompleteSignature");
                    /* 🔴 The provider's own message is never carried. */
                    assertThat(p.getMessage()).doesNotContain("echoed parameters");
                });
    }

    /**
     * ✅ THE DIAGNOSTIC THAT SETTLES THE OPEN QUESTION. A wrapped payload and a flat one become
     * distinguishable from the log alone, without the body ever being printed.
     */
    @Test
    @DisplayName("topLevelFields lists names only, and reveals a wrapped payload")
    void topLevelFieldsAreNamesOnly() {
        String wrapped = json("{'code':'0','request_id':'r-9','data':{'access_token':'super-secret-access',"
                + "'refresh_token':'super-secret-refresh','expires_in':1,'refresh_expires_in':2}}");

        assertThatThrownBy(() -> adapter(wrapped).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.MISSING_FIELD);
                    assertThat(p.field()).isEqualTo("access_token");
                    assertThat(p.topLevelFields()).containsExactlyInAnyOrder("code", "request_id", "data");
                    /* 🔴 Names only — no value from inside `data` appears. */
                    assertThat(p.topLevelFields().toString()).doesNotContain("super-secret");
                });
    }

    @Test
    @DisplayName("a flat payload reports flat field names")
    void flatPayloadReportsFlatNames() {
        String flat = json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2}");

        assertThatThrownBy(() -> adapter(flat).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> assertThat(((DarazProtocolException) e).topLevelFields())
                        .contains("access_token", "refresh_token")
                        .doesNotContain("data"));
    }
}
