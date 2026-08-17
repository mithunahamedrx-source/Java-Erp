package com.trioloo.erp.integration.api;

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
            return uri -> tokenResponse;
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired ChannelAuthorisationAttemptStore attempts;
    @Autowired JdbcTemplate jdbc;

    private MockMvc mvc;
    private UUID shop;
    private UUID actor;

    @BeforeEach
    void setUp() {
        /* 🔴 The real security chain, so permitAll is genuinely exercised rather than bypassed. */
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        clean();
        shop = insertShop();
        actor = insertActor();
        tokenResponse = tokenFor("BD-SELLER-A");
    }

    @AfterEach
    void tearDown() {
        clean();
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
}
