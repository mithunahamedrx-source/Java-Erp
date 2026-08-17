package com.trioloo.erp.integration.application;

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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Daraz authorisation flow end to end, with several shops connected at once.
 *
 * <p>🔴 THIS IS THE MULTI-SHOP SAFETY TEST. Trioloo connects more than one Daraz seller account,
 * and every one of them comes back through the SAME callback URL. The only thing that decides which
 * shop a returning authorisation belongs to is the stored one-time state. These prove a callback
 * cannot be steered onto a sibling shop, and that each shop ends up with its own credential.
 *
 * <p>⚠ NO MARKETPLACE IS CONTACTED — the transport is a controlled double and the App Key/Secret
 * are obvious fakes.
 */
@SpringBootTest
class DarazAuthorisationFlowTest {

    /** Swapped per test to shape what "Daraz" returns. */
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
                    "https://example.test/api/integration/daraz/callback");
        }

        @Bean
        @Primary
        DarazTransport fakeTransport() {
            return uri -> tokenResponse;
        }
    }

    @Autowired ChannelAuthorisationService authorisation;
    @Autowired ChannelAuthorisationAttemptStore attempts;
    @Autowired ChannelCredentialStore credentials;
    @Autowired JdbcTemplate jdbc;

    private UUID shopA;
    private UUID shopB;
    private UUID actor;

    /*
      ⚠ REAL TIME, NOT A FIXED INSTANT. The service consumes the attempt with the application's own
      clock, and the schema enforces consumed_at >= created_at. A pinned instant in the future makes
      every completion violate that CHECK — which is the constraint doing exactly its job.
    */
    private Instant now() {
        return Instant.now();
    }

    @BeforeEach
    void setUp() {
        clean();
        shopA = insertShop("FLOW-TEST-A", "Flow Test A");
        shopB = insertShop("FLOW-TEST-B", "Flow Test B");
        actor = insertActor();
        tokenResponse = tokenFor("BD-SELLER-A");
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_authorisation_attempt WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'FLOW-TEST-%')");
        jdbc.update("DELETE FROM channel_credential WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'FLOW-TEST-%')");
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'FLOW-TEST-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'FLOW-TEST-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username = 'flow-test-actor'");
    }

    private UUID insertShop(String code, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status, market) "
                + "VALUES (?, ?, ?, 'DARAZ', 'DRAFT', 'BANGLADESH')", id, code, name);
        return id;
    }

    private UUID insertActor() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at) "
                + "VALUES (?, 'flow-test-actor', 'Flow Test Actor', 'INVITED', now())", id);
        return id;
    }

    /** Issues a real attempt for one shop, exactly as initiate does. */
    private String stateFor(UUID shopId) {
        Instant issuedAt = now();
        return attempts.issue(shopId, actor, issuedAt, issuedAt.plus(10, ChronoUnit.MINUTES)).state();
    }

    private String connectionOf(UUID shopId) {
        return jdbc.queryForObject(
                "SELECT coalesce(max(state), 'NONE') FROM channel_connection WHERE channel_instance_id = ?",
                String.class, shopId);
    }

    // ================================================================= happy path

    @Test
    @DisplayName("a completed authorisation binds the seller, stores the credential and connects")
    void completionBindsAndConnects() {
        var result = authorisation.complete("the-code", stateFor(shopA));

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.AUTHORISED);
        assertThat(result.channelInstanceId()).isEqualTo(shopA);
        assertThat(result.boundAccount()).isEqualTo("BD-SELLER-A");

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("BD-SELLER-A");
        assertThat(jdbc.queryForObject("SELECT bound_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isNotNull();
        assertThat(jdbc.queryForObject("SELECT authorised_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isNotNull();
        assertThat(connectionOf(shopA)).isEqualTo("CONNECTED");

        /* 🔴 The credential is encrypted and belongs to this shop alone. */
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("access-for-BD-SELLER-A");
    }

    /** 🔴 Connecting is not activating — the configuration lifecycle is a separate axis (SYS-108). */
    @Test
    @DisplayName("authorisation never activates the shop")
    void authorisationNeverActivates() {
        authorisation.complete("the-code", stateFor(shopA));

        assertThat(jdbc.queryForObject("SELECT record_status FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("DRAFT");
        assertThat(jdbc.queryForObject("SELECT activated_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isNull();
    }

    // ================================================================= multi-shop isolation

    /**
     * 🔴 THE CENTRAL MULTI-SHOP GUARANTEE. Two Daraz shops, two states, one callback URL. Each
     * completion must land on its own shop and nowhere else.
     */
    @Test
    @DisplayName("each shop's state resolves to its own shop and its own credential")
    void everyShopKeepsItsOwnAuthorisation() {
        tokenResponse = tokenFor("BD-SELLER-A");
        var a = authorisation.complete("code-a", stateFor(shopA));

        tokenResponse = tokenFor("BD-SELLER-B");
        var b = authorisation.complete("code-b", stateFor(shopB));

        assertThat(a.channelInstanceId()).isEqualTo(shopA);
        assertThat(b.channelInstanceId()).isEqualTo(shopB);

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("BD-SELLER-A");
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopB)).isEqualTo("BD-SELLER-B");

        /* Separate encrypted rows, separate material — never one adapter reusing the last login. */
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("access-for-BD-SELLER-A");
        assertThat(credentials.load(shopB).orElseThrow().accessToken()).isEqualTo("access-for-BD-SELLER-B");
    }

    @Test
    @DisplayName("completing one shop leaves the other completely untouched")
    void oneCompletionDoesNotDisturbSiblings() {
        authorisation.complete("code-a", stateFor(shopA));

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopB)).isNull();
        assertThat(credentials.load(shopB)).isEmpty();
        assertThat(connectionOf(shopB)).isEqualTo("NONE");
    }

    // ================================================================= state discipline

    @Test
    @DisplayName("a replayed state cannot authorise twice")
    void replayIsRefused() {
        String state = stateFor(shopA);

        assertThat(authorisation.complete("code", state).outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.AUTHORISED);

        var replay = authorisation.complete("code", state);
        assertThat(replay.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.NOT_COMPLETED);
        assertThat(replay.channelInstanceId()).isNull();
    }

    @Test
    @DisplayName("an expired state is refused")
    void expiredIsRefused() {
        /* Issued and expired entirely in the past, so the consume guard rejects it on time. */
        Instant issuedAt = now().minus(30, ChronoUnit.MINUTES);
        String state = attempts.issue(shopA, actor, issuedAt,
                issuedAt.plus(1, ChronoUnit.MINUTES)).state();
        assertThat(authorisation.complete("code", state).outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.NOT_COMPLETED);
        assertThat(credentials.load(shopA)).isEmpty();
    }

    @Test
    @DisplayName("a forged, unknown or absent state is refused and binds nothing")
    void forgedIsRefused() {
        for (String bad : new String[]{"totally-made-up-state", "", null}) {
            var result = authorisation.complete("code", bad);
            assertThat(result.outcome())
                    .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.NOT_COMPLETED);
            assertThat(result.channelInstanceId()).isNull();
        }
        assertThat(credentials.load(shopA)).isEmpty();
        assertThat(credentials.load(shopB)).isEmpty();
    }

    @Test
    @DisplayName("a seller who declines spends the state but changes nothing")
    void declinedAuthorisationChangesNothing() {
        String state = stateFor(shopA);

        var result = authorisation.complete(null, state);

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.NOT_COMPLETED);
        assertThat(result.channelInstanceId()).isEqualTo(shopA);
        assertThat(credentials.load(shopA)).isEmpty();
        assertThat(connectionOf(shopA)).isEqualTo("NONE");

        /* ⚠ Spent, not reusable — an abandoned attempt must not be replayable. */
        assertThat(authorisation.complete("a-code", state).channelInstanceId()).isNull();
    }

    // ================================================================= identity protection

    /**
     * 🔴 {@code SCS-044} / {@code INV-16.6} — a different seller cannot take over a bound shop, and
     * the existing credential survives the attempt.
     */
    @Test
    @DisplayName("a different seller cannot rebind the shop, and the stored credential is preserved")
    void identityMismatchPreservesEverything() {
        tokenResponse = tokenFor("BD-SELLER-A");
        authorisation.complete("code", stateFor(shopA));
        Instant boundAt = jdbc.queryForObject(
                "SELECT bound_at FROM channel_instance WHERE id = ?", Instant.class, shopA);

        tokenResponse = tokenFor("BD-SOMEONE-ELSE");
        var result = authorisation.complete("code", stateFor(shopA));

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.DIFFERENT_ACCOUNT);
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("BD-SELLER-A");
        assertThat(jdbc.queryForObject("SELECT bound_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isEqualTo(boundAt);
        /* 🔴 The provisional credential was discarded; the original is intact. */
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("access-for-BD-SELLER-A");
    }

    @Test
    @DisplayName("re-authorising the same seller rotates the credential and keeps bound_at stable")
    void sameSellerRotatesCredential() {
        authorisation.complete("code", stateFor(shopA));
        Instant boundAt = jdbc.queryForObject(
                "SELECT bound_at FROM channel_instance WHERE id = ?", Instant.class, shopA);

        tokenResponse = """
                {"access_token":"rotated-access","refresh_token":"rotated-refresh",
                 "expires_in":259200,"refresh_expires_in":604800,
                 "country_user_info":[{"country":"bd","seller_id":"BD-SELLER-A","user_id":1}]}""";
        var again = authorisation.complete("code2", stateFor(shopA));

        assertThat(again.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.AUTHORISED);
        assertThat(again.firstBinding()).isFalse();
        assertThat(jdbc.queryForObject("SELECT bound_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isEqualTo(boundAt);
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("rotated-access");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_credential WHERE channel_instance_id = ?",
                Integer.class, shopA)).isEqualTo(1);
    }

    /** 🔴 A shop the provider cannot identify as Bangladeshi is never bound. */
    @Test
    @DisplayName("a token with no Bangladesh seller id binds nothing")
    void missingBangladeshSellerBindsNothing() {
        tokenResponse = """
                {"access_token":"a","refresh_token":"r","expires_in":100,"refresh_expires_in":200,
                 "country_user_info":[{"country":"sg","seller_id":"SG-1","user_id":1}]}""";

        String state = stateFor(shopA);
        try {
            authorisation.complete("code", state);
        } catch (RuntimeException expected) {
            /* The adapter refuses; what matters is that nothing was written. */
        }

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isNull();
        assertThat(credentials.load(shopA)).isEmpty();
        assertThat(connectionOf(shopA)).isEqualTo("NONE");
    }
}
