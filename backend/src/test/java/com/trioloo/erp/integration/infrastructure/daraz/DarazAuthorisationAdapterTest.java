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
                /* ⚠ Neither shape: no country_user_info AND no top-level country. */
                new Case(DarazProtocolException.Reason.MISSING_BD_ACCOUNT, "country",
                        json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2}")),
                new Case(DarazProtocolException.Reason.MISSING_FIELD, "user_info",
                        json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                                + "'country':'bd'}")),
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

    // ================================================================= container shape

    /**
     * 🔴 THE DIAGNOSTIC THE LIVE INCIDENT NEEDED. A real Bangladesh seller returned {@code user_info}
     * where the documentation only ever described {@code country_user_info}, and nothing in the log
     * could say what {@code user_info} held. Names one level down settle it without printing a token.
     */
    @Test
    @DisplayName("an object container reports its nested field names, never their values")
    void objectContainerReportsNestedNames() {
        String body = json("{'access_token':'super-secret-access','refresh_token':'super-secret-refresh',"
                + "'expires_in':1,'refresh_expires_in':2,"
                + "'user_info':{'seller_id':'BD-SECRET-99','user_id':4242,'name':'Ryzen Builder'}}");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.containers()).containsEntry("user_info", "OBJECT[seller_id,user_id,name]");
                    assertThat(p.containers()).containsEntry("country_user_info", "ABSENT");
                    assertThat(p.containers()).containsEntry("data", "ABSENT");
                    /* 🔴 Not one nested VALUE appears anywhere. */
                    String rendered = p.describeContainers();
                    assertThat(rendered).doesNotContain("BD-SECRET-99");
                    assertThat(rendered).doesNotContain("4242");
                    assertThat(rendered).doesNotContain("Ryzen Builder");
                    assertThat(rendered).doesNotContain("super-secret");
                    assertThat(p.getMessage()).doesNotContain("BD-SECRET-99");
                });
    }

    /**
     * 🔴 THE EXACT LIVE SHAPE, AND IT NOW BINDS. This is the response a real Bangladesh local
     * seller returned in production — no {@code country_user_info} anywhere, one {@code user_info}
     * object, and the venture named only at the top level.
     */
    @Test
    @DisplayName("the observed live local-seller shape binds using user_info.seller_id")
    void liveLocalShapeBinds() {
        assertThat(adapter(LIVE_LOCAL).exchange(SHOP, "code").orElseThrow().accountIdentity())
                .isEqualTo("BD-LOCAL-1");
    }

    @Test
    @DisplayName("an array container reports its element type and the first object's names")
    void arrayContainerReportsElementShape() {
        String body = json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                + "'country_user_info':[{'country':'sg','seller_id':'SG-SECRET'},"
                + "{'country':'my','seller_id':'MY-1'}]}");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.containers())
                            .containsEntry("country_user_info", "ARRAY<OBJECT>[country,seller_id]");
                    assertThat(p.describeContainers()).doesNotContain("SG-SECRET");
                });
    }

    @Test
    @DisplayName("scalar, null, empty-array and absent containers each report their own type")
    void everyNodeTypeIsReported() {
        record Case(String container, String expected, String body) { }
        var base = "'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2";
        var cases = new Case[]{
                new Case("user_info", "STRING", json("{" + base + ",'user_info':'a-string-value'}")),
                new Case("user_info", "NUMBER", json("{" + base + ",'user_info':12345}")),
                new Case("user_info", "BOOLEAN", json("{" + base + ",'user_info':true}")),
                new Case("user_info", "NULL", json("{" + base + ",'user_info':null}")),
                new Case("user_info", "ABSENT", json("{" + base + "}")),
                new Case("user_info", "OBJECT[]", json("{" + base + ",'user_info':{}}")),
                new Case("country_user_info", "ARRAY<EMPTY>", json("{" + base + ",'country_user_info':[]}")),
                new Case("country_user_info", "ARRAY<STRING>",
                        json("{" + base + ",'country_user_info':['x','y']}")),
                new Case("data", "OBJECT[access_token]", json("{" + base + ",'data':{'access_token':'v'}}")),
        };

        for (Case c : cases) {
            assertThatThrownBy(() -> adapter(c.body()).exchange(SHOP, "code"))
                    .as("%s -> %s", c.container(), c.expected())
                    .isInstanceOf(DarazProtocolException.class)
                    .satisfies(e -> assertThat(((DarazProtocolException) e).containers())
                            .containsEntry(c.container(), c.expected()));
        }
    }

    /** ⚠ A container of an unexpected type is refused, and its VALUE still never reaches the log. */
    @Test
    @DisplayName("a non-object user_info is refused and its value is not echoed")
    void nonObjectUserInfoIsRefusedSafely() {
        String body = json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                + "'country':'bd','user_info':'not-an-object'}");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.MISSING_FIELD);
                    assertThat(p.field()).isEqualTo("user_info");
                    assertThat(p.containers()).containsEntry("user_info", "STRING");
                    assertThat(p.describeContainers()).doesNotContain("not-an-object");
                });
    }

    /** ✅ A well-formed documented response is unaffected by any of this. */
    @Test
    @DisplayName("the documented shape still binds successfully")
    void documentedShapeStillWorks() {
        assertThat(adapter(VALID_TOKEN).exchange(SHOP, "the-code").orElseThrow().accountIdentity())
                .isEqualTo("BD-SELLER-1");
    }

    // ============================================== DZC-010 local Bangladesh seller

    /**
     * The live production shape, field-for-field. 🔴 Values are obvious fakes; the FIELD NAMES are
     * the evidence — {@code user_info} carrying {@code country}, {@code user_id}, {@code seller_id}
     * and {@code short_code}, with the venture named only at the top level.
     */
    private static final String LIVE_LOCAL = json(
            "{'access_token':'test-access','country':'bd','refresh_token':'test-refresh',"
                    + "'user_info':{'country':'bd','user_id':7,'seller_id':'BD-LOCAL-1','short_code':'SC-9'},"
                    + "'account_platform':'seller_center','refresh_expires_in':604800,'expires_in':259200,"
                    + "'account':'seller@example.test','code':'0','request_id':'req-1','_trace_id_':'t-1'}");

    /** Rebuilds the live shape with one field replaced, so each refusal differs in exactly one way. */
    private static String local(String userInfo, String country) {
        return json("{'access_token':'test-access','refresh_token':'test-refresh',"
                + "'refresh_expires_in':604800,'expires_in':259200,'account':'seller@example.test',"
                + (country == null ? "" : "'country':'" + country + "',")
                + (userInfo == null ? "" : "'user_info':" + userInfo + ",")
                + "'code':'0','request_id':'req-1'}");
    }

    @Test
    @DisplayName("the local Bangladesh shape binds using user_info.seller_id, with its credential")
    void localShapeBindsSellerId() {
        ChannelAuthorisationPort.AuthorisedAccount account =
                adapter(LIVE_LOCAL).exchange(SHOP, "the-code").orElseThrow();

        assertThat(account.accountIdentity()).isEqualTo("BD-LOCAL-1");
        /* ✅ The credential travels with it, unchanged by which identity path was taken. */
        ChannelCredentialStore.ProviderCredential credential = account.credential();
        assertThat(credential.accessToken()).isEqualTo("test-access");
        assertThat(credential.refreshToken()).isEqualTo("test-refresh");
        assertThat(credential.accessTokenExpiresAt()).isEqualTo(NOW.plusSeconds(259200));
        assertThat(credential.refreshTokenExpiresAt()).isEqualTo(NOW.plusSeconds(604800));
        /* 🔴 INV-16.14 — Daraz reports no storefront address here, and none is invented. */
        assertThat(account.link()).isNull();
    }

    /**
     * 🔴 THE VENTURE GUARD. A local response names exactly one account and nothing inside
     * {@code user_info} says which venture it belongs to, so the top-level {@code country} is the
     * only thing stopping a Singapore seller from being bound to a Bangladesh shop.
     */
    @Test
    @DisplayName("a local shape from another venture is refused on the top-level country")
    void localShapeWrongCountryRefuses() {
        String body = local("{'seller_id':'SG-LOCAL-1','user_id':7}", "sg");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.MISSING_BD_ACCOUNT);
                    assertThat(p.field()).isEqualTo("country");
                });
    }

    /** ⚠ ABSENT IS NOT PERMISSIVE. No country means the guard cannot be satisfied, so it refuses. */
    @Test
    @DisplayName("a local shape with no top-level country is refused, not assumed Bangladeshi")
    void localShapeMissingCountryRefuses() {
        String body = local("{'seller_id':'BD-LOCAL-1','user_id':7}", null);

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.MISSING_BD_ACCOUNT);
                    assertThat(p.field()).isEqualTo("country");
                });
    }

    @Test
    @DisplayName("a non-object or absent user_info is refused by field name")
    void localShapeUnusableUserInfoRefuses() {
        record Case(String label, String body) { }
        var cases = new Case[]{
                new Case("string", local("'a-string'", "bd")),
                new Case("number", local("12345", "bd")),
                new Case("array", local("[{'seller_id':'BD-1'}]", "bd")),
                new Case("null", local("null", "bd")),
                new Case("absent", local(null, "bd")),
        };

        for (Case c : cases) {
            assertThatThrownBy(() -> adapter(c.body()).exchange(SHOP, "code"))
                    .as("user_info as %s", c.label())
                    .isInstanceOf(DarazProtocolException.class)
                    .satisfies(e -> {
                        DarazProtocolException p = (DarazProtocolException) e;
                        assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.MISSING_FIELD);
                        assertThat(p.field()).isEqualTo("user_info");
                    });
        }
    }

    @Test
    @DisplayName("a local shape with a missing, blank or whitespace seller_id is refused")
    void localShapeUnusableSellerIdRefuses() {
        record Case(String label, String body) { }
        var cases = new Case[]{
                new Case("missing", local("{'user_id':7,'short_code':'SC-9'}", "bd")),
                new Case("empty", local("{'seller_id':'','user_id':7}", "bd")),
                new Case("whitespace", local("{'seller_id':'   ','user_id':7}", "bd")),
                new Case("null", local("{'seller_id':null,'user_id':7}", "bd")),
                new Case("empty user_info", local("{}", "bd")),
        };

        for (Case c : cases) {
            assertThatThrownBy(() -> adapter(c.body()).exchange(SHOP, "code"))
                    .as("seller_id %s", c.label())
                    .isInstanceOf(DarazProtocolException.class)
                    .satisfies(e -> {
                        DarazProtocolException p = (DarazProtocolException) e;
                        assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.MISSING_SELLER_ID);
                        assertThat(p.field()).isEqualTo("seller_id");
                    });
        }
    }

    /**
     * 🔴 THE ACCOUNT EMAIL IS NOT AN IDENTITY, AND ITS PRESENCE CHANGES NOTHING. It is a LOGIN,
     * not a store: one login can hold several stores, and a seller can change it. Binding to it would
     * make {@code INV-16.6}'s "same seller?" test answer the wrong question forever.
     */
    @Test
    @DisplayName("account and email are ignored as identity even when present")
    void accountIsNeverIdentity() {
        String body = local("{'seller_id':'BD-LOCAL-1','email':'other@example.test'}", "bd");

        String identity = adapter(body).exchange(SHOP, "code").orElseThrow().accountIdentity();

        assertThat(identity).isEqualTo("BD-LOCAL-1");
        assertThat(identity).isNotEqualTo("seller@example.test");
        assertThat(identity).isNotEqualTo("other@example.test");
    }

    /**
     * ⚠ {@code user_id} IS A LOGIN AND {@code short_code} IS A DISPLAY HANDLE. Both sit right beside
     * {@code seller_id} in the live response, and neither is the store.
     */
    @Test
    @DisplayName("user_id and short_code are never used as identity, even when seller_id is absent")
    void neighbouringFieldsAreNeverIdentity() {
        /* Present alongside seller_id: ignored. */
        assertThat(adapter(LIVE_LOCAL).exchange(SHOP, "code").orElseThrow().accountIdentity())
                .isEqualTo("BD-LOCAL-1")
                .isNotEqualTo("7")
                .isNotEqualTo("SC-9");

        /* Present WITHOUT seller_id: still refused rather than substituted. */
        String body = local("{'user_id':7,'short_code':'SC-9','country':'bd'}", "bd");
        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> assertThat(((DarazProtocolException) e).reason())
                        .isEqualTo(DarazProtocolException.Reason.MISSING_SELLER_ID));
    }

    /**
     * ✅ THE DOCUMENTED PATH IS UNTOUCHED AND STILL WINS. When both shapes arrive, the per-entry
     * Bangladesh selection decides — {@code user_info} is the FALLBACK for responses that carry no
     * array, never an override of one.
     */
    @Test
    @DisplayName("country_user_info still decides when both shapes are present")
    void documentedPathStillWins() {
        String body = json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                + "'country':'bd','user_info':{'seller_id':'FROM-USER-INFO'},"
                + "'country_user_info':[{'country':'sg','seller_id':'SG-1'},"
                + "{'country':'bd','seller_id':'FROM-COUNTRY-USER-INFO'}]}");

        assertThat(adapter(body).exchange(SHOP, "code").orElseThrow().accountIdentity())
                .isEqualTo("FROM-COUNTRY-USER-INFO");
    }

    /**
     * ⚠ An array that is present but unusable falls through to the local path rather than failing
     * outright — an empty array carries no Bangladesh entry to select.
     */
    @Test
    @DisplayName("an empty country_user_info falls through to the local path")
    void emptyArrayFallsThroughToLocal() {
        String body = json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                + "'country':'bd','country_user_info':[],'user_info':{'seller_id':'BD-LOCAL-1'}}");

        assertThat(adapter(body).exchange(SHOP, "code").orElseThrow().accountIdentity())
                .isEqualTo("BD-LOCAL-1");
    }

    /** ⚠ A cross-border array WITHOUT a Bangladesh entry still refuses; it does not fall through. */
    @Test
    @DisplayName("a populated cross-border array is not rescued by user_info")
    void crossBorderArrayIsNotRescuedByUserInfo() {
        String body = json("{'access_token':'a','refresh_token':'r','expires_in':1,'refresh_expires_in':2,"
                + "'country':'bd','user_info':{'seller_id':'BD-LOCAL-1'},"
                + "'country_user_info':[{'country':'sg','seller_id':'SG-1'}]}");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.MISSING_BD_ACCOUNT);
                    assertThat(p.field()).isEqualTo("country_user_info");
                });
    }

    /** ✅ Country matching follows the repo's existing style on both paths. */
    @Test
    @DisplayName("the country guard is case-insensitive, as it already was per entry")
    void countryGuardIsCaseInsensitive() {
        assertThat(adapter(local("{'seller_id':'BD-LOCAL-1'}", "BD")).exchange(SHOP, "code")
                .orElseThrow().accountIdentity()).isEqualTo("BD-LOCAL-1");
    }

    /** ⚠ Daraz has been observed to send seller ids both quoted and bare. Both must bind alike. */
    @Test
    @DisplayName("a numeric seller_id binds to its digits")
    void numericSellerIdBinds() {
        assertThat(adapter(local("{'seller_id':1001,'user_id':7}", "bd")).exchange(SHOP, "code")
                .orElseThrow().accountIdentity()).isEqualTo("1001");
    }

    /** 🔴 A refusal on the local path leaks nothing either. */
    @Test
    @DisplayName("a local-path refusal carries names and types only, never values")
    void localRefusalLeaksNothing() {
        String body = json("{'access_token':'super-secret-access','refresh_token':'super-secret-refresh',"
                + "'expires_in':1,'refresh_expires_in':2,'country':'bd',"
                + "'account':'seller@example.test','user_info':{'user_id':4242,'short_code':'SC-SECRET'}}");

        assertThatThrownBy(() -> adapter(body).exchange(SHOP, "code"))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.containers()).containsEntry("user_info", "OBJECT[user_id,short_code]");
                    String rendered = p.describeContainers() + " " + p.getMessage() + " " + p.topLevelFields();
                    assertThat(rendered).doesNotContain("super-secret");
                    assertThat(rendered).doesNotContain("4242");
                    assertThat(rendered).doesNotContain("SC-SECRET");
                    assertThat(rendered).doesNotContain("seller@example.test");
                });
    }
}
