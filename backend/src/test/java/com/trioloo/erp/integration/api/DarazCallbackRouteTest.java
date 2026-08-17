package com.trioloo.erp.integration.api;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.trioloo.erp.integration.application.ChannelAuthorisationAttemptStore;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.stream.Collectors;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * The Daraz callback route, as the reviewer approved it.
 *
 * <p>🔴 THIS CLASS EXISTS TO STOP TWO APPROVED DECISIONS BEING SILENTLY UNDONE. Both were
 * implemented and commented, but neither was asserted anywhere, so either could have been reverted
 * by a well-meaning change with a green build:
 *
 * <ol>
 *   <li><strong>The callback is reachable without an ERP session.</strong> It is a redirect from
 *       Daraz's own site and cannot be assumed to carry a cookie. Someone tightening the security
 *       chain would break every Daraz connection, and nothing would have failed here.</li>
 *   <li><strong>The mismatch redirect carries {@code ?attempted=}.</strong> The frontend test
 *       supplies that parameter itself, so if the backend stopped sending it the frontend would
 *       still pass — and {@code SCS-044}'s sentence "you signed in as X, but this shop is bound to
 *       Y" would quietly lose half its meaning in production.</li>
 * </ol>
 *
 * <p>⚠ NO MARKETPLACE IS CONTACTED — the transport is a controlled double and the credentials are
 * obvious fakes.
 */
@SpringBootTest
class DarazCallbackRouteTest {

    /** The approved production route. */
    private static final String CALLBACK = "/api/integration/daraz/callback";

    private static volatile String tokenResponse = "";
    /** Set to make the controlled transport fail instead of answering. */
    private static volatile RuntimeException transportFailure = null;

    private static String tokenFor(String sellerId) {
        return """
                {"access_token":"access-for-%s","refresh_token":"refresh-for-%s",
                 "expires_in":259200,"refresh_expires_in":604800,
                 "country_user_info":[{"country":"bd","seller_id":"%s","user_id":1}]}"""
                .formatted(sellerId, sellerId, sellerId);
    }

    @TestConfiguration
    static class FakeDaraz {
        @Bean
        @Primary
        DarazProperties testDarazProperties() {
            return new DarazProperties("000000-test-app-key", "test-app-secret-not-a-real-value",
                    "https://example.test" + CALLBACK);
        }

        @Bean
        @Primary
        DarazTransport fakeTransport() {
            return uri -> {
                if (transportFailure != null) {
                    throw transportFailure;
                }
                return tokenResponse;
            };
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired ChannelAuthorisationAttemptStore attempts;
    @Autowired JdbcTemplate jdbc;

    private MockMvc mvc;
    private ListAppender<ILoggingEvent> logs;
    private Logger rootLogger;
    private UUID shop;
    private UUID actor;

    @BeforeEach
    void setUp() {
        /* 🔴 The real security chain, so permitAll is genuinely exercised rather than bypassed. */
        /* Capture everything the application logs during the callback. */
        logs = new ListAppender<>();
        logs.start();
        rootLogger = (Logger) org.slf4j.LoggerFactory.getLogger("com.trioloo");
        rootLogger.addAppender(logs);

        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        clean();
        shop = insertShop();
        actor = insertActor();
        tokenResponse = tokenFor("BD-SELLER-A");
        transportFailure = null;
    }

    @AfterEach
    void tearDown() {
        if (rootLogger != null && logs != null) {
            rootLogger.detachAppender(logs);
        }
        clean();
    }

    private String capturedLog() {
        return logs.list.stream()
                .map(e -> e.getLevel() + " " + e.getFormattedMessage())
                .collect(Collectors.joining(System.lineSeparator()));
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_authorisation_attempt WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'CB-TEST-%')");
        jdbc.update("DELETE FROM channel_credential WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'CB-TEST-%')");
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'CB-TEST-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'CB-TEST-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username = 'callback-test-actor'");
    }

    private UUID insertShop() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status, market) "
                + "VALUES (?, 'CB-TEST-A', 'Callback Test Shop', 'DARAZ', 'DRAFT', 'BANGLADESH')", id);
        return id;
    }

    private UUID insertActor() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at) "
                + "VALUES (?, 'callback-test-actor', 'Callback Test Actor', 'INVITED', now())", id);
        return id;
    }

    private String stateForShop() {
        Instant issuedAt = Instant.now();
        return attempts.issue(shop, actor, issuedAt, issuedAt.plus(10, ChronoUnit.MINUTES)).state();
    }

    private String locationOf(MvcResult result) {
        assertThat(result.getResponse().getStatus()).isEqualTo(302);
        return result.getResponse().getHeader("Location");
    }

    // ============================================================ APPROVAL 1 — permitAll

    /**
     * 🔴 APPROVED: the callback stays {@code permitAll}. The security boundary is the one-time,
     * expiring, shop-bound state — not a session cookie that a cross-site redirect may not carry.
     */
    @Test
    @DisplayName("APPROVED — the callback is reachable with no ERP session at all")
    void callbackIsReachableUnauthenticated() throws Exception {
        MvcResult result = mvc.perform(get(CALLBACK)
                .param("code", "some-code")
                .param("state", "an-unknown-state")).andReturn();

        /* 🔴 NOT 401 and NOT 403 — an unauthenticated provider redirect must be served. */
        assertThat(result.getResponse().getStatus()).isNotIn(401, 403);
        assertThat(result.getResponse().getStatus()).isEqualTo(302);
    }

    /** ⚠ Being reachable is not being usable: without a valid state it achieves nothing. */
    @Test
    @DisplayName("an unauthenticated caller without a valid state binds nothing")
    void reachableButUselessWithoutState() throws Exception {
        MvcResult result = mvc.perform(get(CALLBACK)
                .param("code", "c").param("state", "forged")).andReturn();

        assertThat(locationOf(result)).isEqualTo("/administration/shops?authorisation=NOT_COMPLETED");
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shop)).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_credential WHERE channel_instance_id = ?",
                Integer.class, shop)).isZero();
    }

    // ============================================================ APPROVAL 2 — ?attempted=

    /**
     * 🔴 APPROVED: the mismatch redirect carries the attempted seller identity. {@code SCS-041}
     * makes it a non-secret business fact, and {@code SCS-044} requires the notice to name BOTH
     * accounts. The reviewer accepted that it appears in history and access logs.
     */
    @Test
    @DisplayName("APPROVED — a mismatch redirect carries ?attempted= so SCS-044 can name both accounts")
    void mismatchCarriesAttemptedAccount() throws Exception {
        /* Bind the shop to one seller first. */
        mvc.perform(get(CALLBACK).param("code", "c1").param("state", stateForShop())).andReturn();
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shop)).isEqualTo("BD-SELLER-A");

        /* Now a DIFFERENT seller returns through the same callback. */
        tokenResponse = tokenFor("BD-SOMEONE-ELSE");
        MvcResult result = mvc.perform(get(CALLBACK)
                .param("code", "c2").param("state", stateForShop())).andReturn();

        String location = locationOf(result);
        assertThat(location).startsWith("/administration/shops/" + shop);
        assertThat(location).contains("authorisation=DIFFERENT_ACCOUNT");
        assertThat(location).contains("attempted=BD-SOMEONE-ELSE");

        /* 🔴 And the mismatch still changed nothing. */
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shop)).isEqualTo("BD-SELLER-A");
    }

    /** ⚠ It is carried ONLY when there is something to name — a success needs no attempted account. */
    @Test
    @DisplayName("a successful authorisation carries no attempted account")
    void successCarriesNoAttemptedAccount() throws Exception {
        MvcResult result = mvc.perform(get(CALLBACK)
                .param("code", "c").param("state", stateForShop())).andReturn();

        String location = locationOf(result);
        assertThat(location).isEqualTo("/administration/shops/" + shop + "?authorisation=AUTHORISED");
        assertThat(location).doesNotContain("attempted=");
    }

    // ============================================================ route and leakage

    /** 🔴 The exact route registered on the Daraz App Console. */
    @Test
    @DisplayName("the approved route returns the operator to the exact Shop Detail page")
    void approvedRouteReturnsToTheShop() throws Exception {
        MvcResult result = mvc.perform(get(CALLBACK)
                .param("code", "c").param("state", stateForShop())).andReturn();

        assertThat(locationOf(result)).startsWith("/administration/shops/" + shop);
    }

    /** 🔴 {@code API-070.a} — nothing secret survives the redirect. */
    @Test
    @DisplayName("no code, state or token ever reaches the browser")
    void nothingSecretIsRedirected() throws Exception {
        String state = stateForShop();

        MvcResult result = mvc.perform(get(CALLBACK)
                .param("code", "the-authorisation-code").param("state", state)).andReturn();

        String location = locationOf(result);
        assertThat(location).doesNotContain("the-authorisation-code");
        assertThat(location).doesNotContain(state);
        assertThat(location).doesNotContain("access-for-");
        assertThat(location).doesNotContain("refresh-for-");
        assertThat(location).doesNotContain("test-app-secret");
    }

    /** ⚠ A seller who declines arrives with nothing; that is an outcome, not a 400. */
    @Test
    @DisplayName("a declined authorisation is an honest outcome, not a rejected request")
    void declinedIsAnOutcomeNotAnError() throws Exception {
        MvcResult result = mvc.perform(get(CALLBACK).param("state", stateForShop())).andReturn();

        assertThat(locationOf(result))
                .isEqualTo("/administration/shops/" + shop + "?authorisation=NOT_COMPLETED");
    }

    // ============================================================ PATCH A — observability

    /**
     * 🔴 THE REGRESSION TEST FOR THE LIVE INCIDENT. Five real authorisations failed at the provider,
     * each returning 302, and the journal contained NOTHING — the exception handler redirected in
     * silence. There was literally nothing to diagnose from.
     */
    @Test
    @DisplayName("PATCH A — a provider failure is logged with its type and provider code")
    void providerFailureIsLogged() throws Exception {
        tokenResponse = """
                {"code":"IllegalAccessToken","type":"ISV","message":"provider text here","request_id":"r1"}""";

        mvc.perform(get(CALLBACK).param("code", "the-code").param("state", stateForShop())).andReturn();

        String captured = capturedLog();
        assertThat(captured).contains("DarazProtocolException");
        assertThat(captured).contains("IllegalAccessToken");
        assertThat(captured).contains("PROVIDER_ERROR");
        /* The shop is named by the service line that pairs with it. */
        assertThat(captured).contains(shop.toString());
    }

    @Test
    @DisplayName("PATCH A — every callback outcome is logged, success included")
    void outcomeIsAlwaysLogged() throws Exception {
        mvc.perform(get(CALLBACK).param("code", "c").param("state", stateForShop())).andReturn();

        assertThat(capturedLog()).contains("outcome=AUTHORISED");
        assertThat(capturedLog()).contains(shop.toString());
    }

    @Test
    @DisplayName("PATCH A — an unusable state is logged as unresolved, naming no shop")
    void unresolvedStateIsLogged() throws Exception {
        mvc.perform(get(CALLBACK).param("code", "c").param("state", "forged")).andReturn();

        assertThat(capturedLog()).contains("outcome=NOT_COMPLETED");
        assertThat(capturedLog()).contains("unresolved");
    }

    /**
     * 🔴 THE SECRET-HYGIENE GUARANTEE. Logs are read by people, shipped to aggregators and pasted
     * into issue trackers. Nothing that can authorise anything may appear in one.
     */
    @Test
    @DisplayName("PATCH A — no code, state, token, secret, body or provider URL is ever logged")
    void logsCarryNoSecrets() throws Exception {
        String state = stateForShop();
        tokenResponse = """
                {"access_token":"super-secret-access","refresh_token":"super-secret-refresh",
                 "expires_in":259200,"refresh_expires_in":604800,
                 "country_user_info":[{"country":"bd","seller_id":"BD-SELLER-A","user_id":1}]}""";

        mvc.perform(get(CALLBACK)
                .param("code", "the-authorisation-code").param("state", state)).andReturn();

        String captured = capturedLog();
        assertThat(captured).doesNotContain("the-authorisation-code");
        assertThat(captured).doesNotContain(state);
        assertThat(captured).doesNotContain("super-secret-access");
        assertThat(captured).doesNotContain("super-secret-refresh");
        assertThat(captured).doesNotContain("test-app-secret-not-a-real-value");
        assertThat(captured).doesNotContain("api.daraz.com.bd");
        assertThat(captured).doesNotContain("sign=");
    }

    @Test
    @DisplayName("PATCH A — a provider failure log repeats none of the provider's own message")
    void providerMessageIsNotEchoed() throws Exception {
        tokenResponse = """
                {"code":"IncompleteSignature","type":"ISV","message":"echoed request parameters here"}""";

        mvc.perform(get(CALLBACK).param("code", "c").param("state", stateForShop())).andReturn();

        assertThat(capturedLog()).doesNotContain("echoed request parameters here");
        assertThat(capturedLog()).contains("IncompleteSignature");
    }

    // ============================================================ PATCH B — the state is burned

    @Test
    @DisplayName("PATCH B — a provider failure through the callback still consumes the state")
    void providerFailureStillConsumesTheState() throws Exception {
        tokenResponse = """
                {"code":"IllegalAccessToken","type":"ISV","message":"m","request_id":"r"}""";

        mvc.perform(get(CALLBACK).param("code", "c").param("state", stateForShop())).andReturn();

        assertThat(jdbc.queryForObject(
                "SELECT consumed_at FROM channel_authorisation_attempt "
                        + "WHERE channel_instance_id = ? ORDER BY created_at DESC LIMIT 1",
                Instant.class, shop)).isNotNull();

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shop)).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_credential WHERE channel_instance_id = ?",
                Integer.class, shop)).isZero();
    }

    // ============================================================ safe diagnostics in the log

    /**
     * 🔴 THE REGRESSION TEST FOR THE SECOND INCIDENT. The live failure logged
     * {@code providerCode=null} and nothing else — a message that matched eight distinct causes and
     * identified none of them. The log must now name the fault exactly.
     */
    @Test
    @DisplayName("a provider failure logs reason, field, requestId and topLevelFields")
    void providerFailureLogsFullSafeDiagnostics() throws Exception {
        /* A wrapped payload — the exact shape ambiguity the live incident could not resolve. */
        tokenResponse = """
                {"code":"0","request_id":"0be6fdce15200450346451004",
                 "data":{"access_token":"super-secret-access","refresh_token":"super-secret-refresh",
                 "expires_in":259200,"refresh_expires_in":604800}}""";

        mvc.perform(get(CALLBACK).param("code", "the-code").param("state", stateForShop())).andReturn();

        String captured = capturedLog();
        assertThat(captured).contains("reason=MISSING_FIELD");
        assertThat(captured).contains("field=access_token");
        assertThat(captured).contains("requestId=0be6fdce15200450346451004");
        assertThat(captured).contains("topLevelFields=");
        assertThat(captured).contains("data");
        assertThat(captured).contains("outcome=PROVIDER_ERROR");
    }

    @Test
    @DisplayName("an envelope refusal logs its provider code and type")
    void envelopeRefusalLogsCodeAndType() throws Exception {
        tokenResponse = """
                {"code":"IllegalAccessToken","type":"ISV","message":"provider text",
                 "request_id":"r-77"}""";

        mvc.perform(get(CALLBACK).param("code", "c").param("state", stateForShop())).andReturn();

        String captured = capturedLog();
        assertThat(captured).contains("reason=ENVELOPE_CODE");
        assertThat(captured).contains("providerCode=IllegalAccessToken");
        assertThat(captured).contains("providerType=ISV");
        assertThat(captured).contains("requestId=r-77");
        /* The provider's own prose is never repeated. */
        assertThat(captured).doesNotContain("provider text");
    }

    @Test
    @DisplayName("a missing Bangladesh account names itself rather than looking like a null code")
    void missingBangladeshAccountIsNamed() throws Exception {
        tokenResponse = """
                {"access_token":"a","refresh_token":"r","expires_in":1,"refresh_expires_in":2,
                 "country_user_info":[{"country":"sg","seller_id":"SG-1"}]}""";

        mvc.perform(get(CALLBACK).param("code", "c").param("state", stateForShop())).andReturn();

        assertThat(capturedLog()).contains("reason=MISSING_BD_ACCOUNT");
        assertThat(capturedLog()).contains("field=country_user_info");
    }

    /** ⚠ A bad HTTP status and an unreachable host must not look the same in the journal. */
    @Test
    @DisplayName("a transport failure logs its HTTP status, and reachability, but no body")
    void transportFailureLogsStatus() throws Exception {
        transportFailure = new com.trioloo.erp.integration.infrastructure.daraz.DarazTransportException(
                "The Daraz request returned an unusable HTTP status.", 503);

        mvc.perform(get(CALLBACK).param("code", "c").param("state", stateForShop())).andReturn();

        String captured = capturedLog();
        assertThat(captured).contains("DarazTransportException");
        assertThat(captured).contains("httpStatus=503");
        assertThat(captured).contains("reached=true");
        assertThat(captured).contains("outcome=PROVIDER_ERROR");
    }

    @Test
    @DisplayName("an unreachable provider is distinguishable from a bad status")
    void unreachableProviderIsDistinguishable() throws Exception {
        transportFailure = new com.trioloo.erp.integration.infrastructure.daraz.DarazTransportException(
                "The Daraz request could not be completed.");

        mvc.perform(get(CALLBACK).param("code", "c").param("state", stateForShop())).andReturn();

        assertThat(capturedLog()).contains("httpStatus=null");
        assertThat(capturedLog()).contains("reached=false");
    }

    /**
     * 🔴 THE HYGIENE GUARANTEE, RE-ASSERTED OVER THE RICHER LOG. More diagnostic detail is exactly
     * when a secret is most likely to slip in.
     */
    @Test
    @DisplayName("the richer diagnostics still leak no token, code, state, secret, body or URL")
    void richerDiagnosticsStillLeakNothing() throws Exception {
        String state = stateForShop();
        tokenResponse = """
                {"code":"0","request_id":"r-1","data":{"access_token":"super-secret-access",
                 "refresh_token":"super-secret-refresh","expires_in":1,"refresh_expires_in":2}}""";

        mvc.perform(get(CALLBACK)
                .param("code", "the-authorisation-code").param("state", state)).andReturn();

        String captured = capturedLog();
        assertThat(captured).doesNotContain("the-authorisation-code");
        assertThat(captured).doesNotContain(state);
        assertThat(captured).doesNotContain("super-secret-access");
        assertThat(captured).doesNotContain("super-secret-refresh");
        assertThat(captured).doesNotContain("test-app-secret-not-a-real-value");
        assertThat(captured).doesNotContain("api.daraz.com.bd");
        assertThat(captured).doesNotContain("sign=");
        /* And no raw body: the JSON punctuation of the payload never appears. */
        assertThat(captured).doesNotContain("\"access_token\":");
    }
}
