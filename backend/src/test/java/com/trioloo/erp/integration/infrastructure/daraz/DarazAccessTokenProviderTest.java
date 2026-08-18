package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.integration.application.ChannelCredentialStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * On-demand Daraz token refresh, {@code DZC-030}.
 *
 * <p>🔴 AGAINST THE REAL CREDENTIAL STORE AND THE REAL DATABASE, so "stored encrypted" and "stored
 * against the right shop" are observed facts rather than asserted intentions. Only the TRANSPORT is
 * a double — no marketplace is contacted, and no App Secret is real.
 */
@SpringBootTest
class DarazAccessTokenProviderTest {

    private static final String KEY = "000000-test-app-key";
    private static final String SECRET = "test-app-secret-not-a-real-value";
    private static final String REDIRECT = "https://example.test/api/integration/daraz/callback";

    private static final Instant NOW = Instant.parse("2026-08-18T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Autowired ChannelCredentialStore credentials;
    @Autowired JdbcTemplate jdbc;

    private UUID shop;
    private final AtomicReference<URI> captured = new AtomicReference<>();
    private final AtomicInteger calls = new AtomicInteger();
    private String response = "";
    private RuntimeException transportFailure;

    @BeforeEach
    void setUp() {
        clean();
        shop = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status, market) "
                + "VALUES (?, ?, ?, 'DARAZ', 'DRAFT', 'BANGLADESH')", shop, "TOK-TEST-A", "Token Test A");
        captured.set(null);
        calls.set(0);
        transportFailure = null;
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_credential WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'TOK-TEST-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'TOK-TEST-%'");
    }

    /** 🔴 GET-only, and it records what it was asked for so leak claims can be checked. */
    private DarazAccessTokenProvider provider() {
        return provider(Duration.ofHours(24));
    }

    private DarazAccessTokenProvider provider(Duration margin) {
        DarazTransport transport = new DarazTransport() {
            @Override
            public String get(URI uri) {
                calls.incrementAndGet();
                captured.set(uri);
                if (transportFailure != null) {
                    throw transportFailure;
                }
                return response;
            }

            @Override
            public String post(URI uri, String body, String contentType) {
                throw new UnsupportedOperationException("Token refresh is a GET.");
            }
        };
        return new DarazAccessTokenProvider(
                new DarazProperties(KEY, SECRET, REDIRECT), new DarazRequestSigner(),
                transport, credentials, clock, margin);
    }

    private void store(String access, Duration accessIn, String refresh, Duration refreshIn) {
        credentials.put(shop, new ChannelCredentialStore.ProviderCredential(
                access,
                accessIn == null ? null : NOW.plus(accessIn),
                refresh,
                refresh == null || refreshIn == null ? null : NOW.plus(refreshIn)), NOW);
    }

    private static String json(String singleQuoted) {
        return singleQuoted.replace('\'', '"');
    }

    private static final String GOOD_REFRESH = "{'access_token':'renewed-access','refresh_token':'renewed-refresh',"
            + "'expires_in':2592000,'refresh_expires_in':15552000,'request_id':'req-9'}";

    // ============================================================ the cheap path

    @Test
    @DisplayName("a token comfortably inside its life is returned untouched, with no provider call")
    void validTokenIsReturnedWithoutCalling() {
        store("living-access", Duration.ofDays(20), "living-refresh", Duration.ofDays(170));

        assertThat(provider().accessTokenFor(shop)).isEqualTo("living-access");
        /* 🔴 The common case must cost nothing: no signing, no request. */
        assertThat(calls.get()).isZero();
    }

    // ============================================================ when it refreshes

    @Test
    @DisplayName("a token inside the margin is refreshed and the renewed pair is stored")
    void insideMarginRefreshes() {
        store("expiring-access", Duration.ofHours(3), "living-refresh", Duration.ofDays(170));
        response = json(GOOD_REFRESH);

        assertThat(provider().accessTokenFor(shop)).isEqualTo("renewed-access");
        assertThat(calls.get()).isEqualTo(1);

        ChannelCredentialStore.ProviderCredential stored = credentials.load(shop).orElseThrow();
        assertThat(stored.accessToken()).isEqualTo("renewed-access");
        assertThat(stored.refreshToken()).isEqualTo("renewed-refresh");
        assertThat(stored.accessTokenExpiresAt()).isEqualTo(NOW.plusSeconds(2592000));
        assertThat(stored.refreshTokenExpiresAt()).isEqualTo(NOW.plusSeconds(15552000));
    }

    @Test
    @DisplayName("an already-expired access token is refreshed")
    void expiredAccessRefreshes() {
        store("dead-access", Duration.ofHours(-2), "living-refresh", Duration.ofDays(170));
        response = json(GOOD_REFRESH);

        assertThat(provider().accessTokenFor(shop)).isEqualTo("renewed-access");
        assertThat(calls.get()).isEqualTo(1);
    }

    /** ⚠ `TEC-119` permits a null expiry. A life we cannot prove is not a life we gamble on. */
    @Test
    @DisplayName("an unknown access-token expiry is refreshed rather than trusted")
    void unknownExpiryRefreshes() {
        store("mystery-access", null, "living-refresh", Duration.ofDays(170));
        response = json(GOOD_REFRESH);

        assertThat(provider().accessTokenFor(shop)).isEqualTo("renewed-access");
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("the margin is what decides, and it is configurable")
    void marginDecides() {
        store("access", Duration.ofHours(10), "refresh", Duration.ofDays(170));
        response = json(GOOD_REFRESH);

        /* A 1-hour margin leaves 10 hours comfortably inside. */
        assertThat(provider(Duration.ofHours(1)).accessTokenFor(shop)).isEqualTo("access");
        assertThat(calls.get()).isZero();

        /* A 24-hour margin does not. */
        assertThat(provider(Duration.ofHours(24)).accessTokenFor(shop)).isEqualTo("renewed-access");
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("the refreshed credential is stored encrypted, never as readable text")
    void storedEncrypted() {
        store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
        response = json(GOOD_REFRESH);
        provider().accessTokenFor(shop);

        byte[] access = jdbc.queryForObject(
                "SELECT access_token_cipher FROM channel_credential WHERE channel_instance_id = ?",
                byte[].class, shop);
        byte[] refresh = jdbc.queryForObject(
                "SELECT refresh_token_cipher FROM channel_credential WHERE channel_instance_id = ?",
                byte[].class, shop);
        assertThat(new String(access, StandardCharsets.UTF_8)).doesNotContain("renewed-access");
        assertThat(new String(refresh, StandardCharsets.UTF_8)).doesNotContain("renewed-refresh");
    }

    @Test
    @DisplayName("a refresh writes only the shop it was asked about")
    void refreshKeepsOwnership() {
        UUID other = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status, market) "
                + "VALUES (?, ?, ?, 'DARAZ', 'DRAFT', 'BANGLADESH')", other, "TOK-TEST-B", "Token Test B");
        credentials.put(other, new ChannelCredentialStore.ProviderCredential(
                "other-access", NOW.plus(Duration.ofDays(20)), "other-refresh", NOW.plus(Duration.ofDays(170))), NOW);

        store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
        response = json(GOOD_REFRESH);
        provider().accessTokenFor(shop);

        /* 🔴 The sibling shop is untouched. */
        assertThat(credentials.load(other).orElseThrow().accessToken()).isEqualTo("other-access");
        assertThat(credentials.load(shop).orElseThrow().accessToken()).isEqualTo("renewed-access");
    }

    // ============================================================ REAUTH_REQUIRED

    @Test
    @DisplayName("a shop with no credential requires reauthorisation")
    void noCredentialRequiresReauth() {
        assertThatThrownBy(() -> provider().accessTokenFor(shop))
                .isInstanceOf(DarazCredentialException.class)
                .satisfies(e -> assertThat(((DarazCredentialException) e).reauthorisationRequired()).isTrue());
        assertThat(calls.get()).isZero();
    }

    @Test
    @DisplayName("a credential with no refresh token requires reauthorisation, without calling")
    void noRefreshTokenRequiresReauth() {
        store("expiring-access", Duration.ofHours(1), null, null);

        assertThatThrownBy(() -> provider().accessTokenFor(shop))
                .isInstanceOf(DarazCredentialException.class)
                .satisfies(e -> assertThat(((DarazCredentialException) e).reauthorisationRequired()).isTrue());
        assertThat(calls.get()).isZero();
    }

    @Test
    @DisplayName("an expired refresh token requires reauthorisation, without calling")
    void expiredRefreshTokenRequiresReauth() {
        store("dead-access", Duration.ofHours(-2), "dead-refresh", Duration.ofHours(-1));

        assertThatThrownBy(() -> provider().accessTokenFor(shop))
                .isInstanceOf(DarazCredentialException.class)
                .satisfies(e -> assertThat(((DarazCredentialException) e).reauthorisationRequired()).isTrue());
        /* 🔴 `DZC-011` — a local time fact, so no round trip is wasted proving it. */
        assertThat(calls.get()).isZero();
    }

    @Test
    @DisplayName("refresh_expires_in = 0 requires reauthorisation and stores nothing")
    void zeroRefreshLifeRequiresReauth() {
        store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
        response = json("{'access_token':'a','refresh_token':'r','expires_in':2592000,'refresh_expires_in':0}");

        assertThatThrownBy(() -> provider().accessTokenFor(shop))
                .isInstanceOf(DarazCredentialException.class)
                .satisfies(e -> assertThat(((DarazCredentialException) e).reauthorisationRequired()).isTrue());
        /* The old credential survives untouched. */
        assertThat(credentials.load(shop).orElseThrow().accessToken()).isEqualTo("expiring-access");
    }

    // ============================================================ ERROR, not reauth

    /**
     * 🔴 `DZC-011`'S CENTRAL CORRECTION. An unclassified provider refusal must NOT send an operator
     * to disturb a seller — Daraz publishes no code meaning "authorise again".
     */
    @Test
    @DisplayName("an envelope code refusal is a protocol failure, never a reauthorisation prompt")
    void envelopeCodeIsNotReauth() {
        store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
        response = json("{'code':'IncompleteSignature','type':'ISV','message':'echoed text','request_id':'r-3'}");

        assertThatThrownBy(() -> provider().accessTokenFor(shop))
                .isInstanceOf(DarazProtocolException.class)
                .isNotInstanceOf(DarazCredentialException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.ENVELOPE_CODE);
                    assertThat(p.providerCode()).isEqualTo("IncompleteSignature");
                });
        assertThat(credentials.load(shop).orElseThrow().accessToken()).isEqualTo("expiring-access");
    }

    @Test
    @DisplayName("a missing required field refuses and stores nothing")
    void missingFieldRefuses() {
        record Case(String field, String body) { }
        var cases = new Case[]{
                new Case("access_token", "{'refresh_token':'r','expires_in':1,'refresh_expires_in':2}"),
                new Case("refresh_token", "{'access_token':'a','expires_in':1,'refresh_expires_in':2}"),
                new Case("expires_in", "{'access_token':'a','refresh_token':'r','refresh_expires_in':2}"),
                new Case("refresh_expires_in", "{'access_token':'a','refresh_token':'r','expires_in':1}"),
        };
        for (Case c : cases) {
            store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
            response = json(c.body());
            assertThatThrownBy(() -> provider().accessTokenFor(shop))
                    .as("missing %s", c.field())
                    .isInstanceOf(DarazProtocolException.class)
                    .satisfies(e -> assertThat(((DarazProtocolException) e).field()).isEqualTo(c.field()));
            assertThat(credentials.load(shop).orElseThrow().accessToken()).isEqualTo("expiring-access");
        }
    }

    @Test
    @DisplayName("an empty or non-JSON response refuses safely and stores nothing")
    void unusableBodyRefuses() {
        for (String body : new String[]{"", "   ", "not json at all", "[1,2,3]"}) {
            store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
            response = body;
            assertThatThrownBy(() -> provider().accessTokenFor(shop))
                    .as("body %s", body)
                    .isInstanceOf(DarazProtocolException.class);
            assertThat(credentials.load(shop).orElseThrow().accessToken()).isEqualTo("expiring-access");
        }
    }

    @Test
    @DisplayName("a transport failure propagates unchanged and stores nothing")
    void transportFailurePropagates() {
        store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
        transportFailure = new DarazTransportException("The Daraz request could not be completed.");

        assertThatThrownBy(() -> provider().accessTokenFor(shop))
                .isInstanceOf(DarazTransportException.class)
                .isNotInstanceOf(DarazCredentialException.class);
        assertThat(credentials.load(shop).orElseThrow().accessToken()).isEqualTo("expiring-access");
    }

    // ============================================================ the request itself

    @Test
    @DisplayName("the refresh request is signed and carries the refresh token and nothing else odd")
    void requestIsSignedCorrectly() {
        store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
        response = json(GOOD_REFRESH);
        provider().accessTokenFor(shop);

        String uri = captured.get().toString();
        assertThat(uri).startsWith("https://api.daraz.com.bd/rest/auth/token/refresh");
        assertThat(uri).contains("refresh_token=living-refresh");
        assertThat(uri).contains("sign_method=sha256");
        assertThat(uri).contains("sign=");
        /* 🔴 The App Secret is NEVER a parameter — only the signature derived from it. */
        assertThat(uri).doesNotContain(SECRET);
        /* 🔴 Refresh does not re-authorise: no code, no redirect. */
        assertThat(uri).doesNotContain("code=");
        assertThat(uri).doesNotContain("redirect_uri");
    }

    /** 🔴 Refresh must not rebind identity — it reads four fields and no seller identity at all. */
    @Test
    @DisplayName("a refresh response carrying identity fields changes no binding")
    void refreshNeverRebindsIdentity() {
        store("expiring-access", Duration.ofHours(1), "living-refresh", Duration.ofDays(170));
        jdbc.update("UPDATE channel_instance SET external_account_identity = ?, bound_at = now() WHERE id = ?",
                "BD-ORIGINAL", shop);
        response = json("{'access_token':'renewed-access','refresh_token':'renewed-refresh',"
                + "'expires_in':2592000,'refresh_expires_in':15552000,'country':'bd',"
                + "'user_info':{'seller_id':'BD-SOMEONE-ELSE'},'account':'other@example.test'}");

        provider().accessTokenFor(shop);

        assertThat(jdbc.queryForObject(
                "SELECT external_account_identity FROM channel_instance WHERE id = ?", String.class, shop))
                .isEqualTo("BD-ORIGINAL");
    }

    // ============================================================ leak hygiene

    @Test
    @DisplayName("🔴 no failure message carries a token, the secret, the signature or the URI")
    void failuresLeakNothing() {
        store("secret-access-value", Duration.ofHours(1), "secret-refresh-value", Duration.ofDays(170));
        response = json("{'code':'IllegalAccessToken','type':'ISV','message':'echoed request text',"
                + "'access_token':'leaked-token','request_id':'r-1'}");

        String message = messageOf();
        for (String secret : new String[]{
                "secret-access-value", "secret-refresh-value", "leaked-token", SECRET,
                "echoed request text", "api.daraz.com.bd", "sign=", "refresh_token="}) {
            assertThat(message).as("must not contain %s", secret).doesNotContain(secret);
        }
    }

    @Test
    @DisplayName("🔴 a reauthorisation refusal names no token either")
    void reauthMessageLeaksNothing() {
        store("secret-access-value", Duration.ofHours(-1), "secret-refresh-value", Duration.ofHours(-1));

        String message = messageOf();
        assertThat(message).doesNotContain("secret-access-value");
        assertThat(message).doesNotContain("secret-refresh-value");
        /* ✅ It still says what the operator must do. */
        assertThat(message).contains("authorise");
    }

    private String messageOf() {
        try {
            provider().accessTokenFor(shop);
            throw new AssertionError("expected a refusal");
        } catch (RuntimeException e) {
            return String.valueOf(e.getMessage());
        }
    }
}
