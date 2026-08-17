package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProtocolException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    /**
     * The LOCAL Bangladesh shape: no {@code country_user_info}, one {@code user_info}, venture named
     * only at the top level. 🔴 This is what production actually returned.
     */
    private static String localTokenFor(String sellerId) {
        return """
                {"access_token":"access-for-%s","refresh_token":"refresh-for-%s",
                 "expires_in":259200,"refresh_expires_in":604800,"country":"bd",
                 "account":"seller@example.test","account_platform":"seller_center",
                 "user_info":{"country":"bd","user_id":7,"seller_id":"%s","short_code":"SC-9"},
                 "code":"0","request_id":"req-1"}"""
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

    /**
     * 🔴 A shop the provider cannot identify as Bangladeshi is never bound — AND THE FAILURE IS LOUD.
     *
     * <p>⚠ THIS TEST PREVIOUSLY HID THE PRODUCTION BUG. It wrapped the call in {@code try/catch} and
     * asserted only that nothing was written — which a transaction rollback satisfies trivially. It
     * therefore passed while the real system silently rolled back the state consumption and logged
     * nothing. The exception is now asserted, and so is the consumption.
     */
    @Test
    @DisplayName("a token with no Bangladesh seller id is refused loudly and binds nothing")
    void missingBangladeshSellerIsRefusedLoudly() {
        tokenResponse = """
                {"access_token":"a","refresh_token":"r","expires_in":100,"refresh_expires_in":200,
                 "country_user_info":[{"country":"sg","seller_id":"SG-1","user_id":1}]}""";

        String state = stateFor(shopA);

        assertThatThrownBy(() -> authorisation.complete("code", state))
                .isInstanceOf(DarazProtocolException.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.type(DarazProtocolException.class))
                .extracting(DarazProtocolException::reason)
                .isEqualTo(DarazProtocolException.Reason.MISSING_BD_ACCOUNT);

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isNull();
        assertThat(credentials.load(shopA)).isEmpty();
        assertThat(connectionOf(shopA)).isEqualTo("NONE");
    }

    /**
     * 🔴 PATCH B — THE STATE IS BURNED EVEN WHEN THE EXCHANGE FAILS.
     *
     * <p>⚠ THIS IS THE REGRESSION TEST FOR THE LIVE INCIDENT. Consumption used to share the
     * caller's transaction, so a failing token exchange rolled {@code consumed_at} back. Production
     * showed five untouched attempts while every callback had in fact reached the provider — the
     * evidence erased itself, and the state stayed replayable.
     */
    @Test
    @DisplayName("a failed token exchange still consumes the state, and it cannot be replayed")
    void failedExchangeBurnsTheStateAndStoresNothing() {
        tokenResponse = """
                {"code":"IllegalAccessToken","type":"ISV","message":"provider text","request_id":"r1"}""";

        String state = stateFor(shopA);

        assertThatThrownBy(() -> authorisation.complete("the-code", state))
                .isInstanceOf(DarazProtocolException.class);

        /* 🔴 Consumed despite the failure — the outer rollback must not reach it. */
        assertThat(jdbc.queryForObject(
                "SELECT consumed_at FROM channel_authorisation_attempt "
                        + "WHERE channel_instance_id = ? ORDER BY created_at DESC LIMIT 1",
                Instant.class, shopA)).isNotNull();

        /* 🔴 And nothing was bound or stored. */
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isNull();
        assertThat(credentials.load(shopA)).isEmpty();
        assertThat(connectionOf(shopA)).isEqualTo("NONE");

        /* 🔴 The same state is now spent — replay is refused. */
        tokenResponse = tokenFor("BD-SELLER-A");
        var replay = authorisation.complete("the-code", state);
        assertThat(replay.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.NOT_COMPLETED);
        assertThat(replay.channelInstanceId()).isNull();
        assertThat(credentials.load(shopA)).isEmpty();
    }

    // ============================================== DZC-010 local Bangladesh seller

    /**
     * 🔴 THE PRODUCTION CASE, END TO END. The live seller returned no {@code country_user_info} at
     * all, so this is the path a real Bangladesh shop actually takes to CONNECTED.
     */
    @Test
    @DisplayName("a local seller binds from user_info.seller_id, stores its credential and connects")
    void localSellerBindsAndConnects() {
        tokenResponse = localTokenFor("BD-LOCAL-1");

        var result = authorisation.complete("the-code", stateFor(shopA));

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.AUTHORISED);
        assertThat(result.channelInstanceId()).isEqualTo(shopA);
        assertThat(result.boundAccount()).isEqualTo("BD-LOCAL-1");
        assertThat(result.firstBinding()).isTrue();

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("BD-LOCAL-1");
        assertThat(jdbc.queryForObject("SELECT bound_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isNotNull();
        assertThat(connectionOf(shopA)).isEqualTo("CONNECTED");
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("access-for-BD-LOCAL-1");

        /* 🔴 The account email was present in the response and is NOT what was bound. */
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isNotEqualTo("seller@example.test");
    }

    @Test
    @DisplayName("re-authorising the same local seller renews the credential and keeps bound_at stable")
    void localSellerReauthorisationRenews() {
        tokenResponse = localTokenFor("BD-LOCAL-1");
        authorisation.complete("code", stateFor(shopA));
        Instant boundAt = jdbc.queryForObject(
                "SELECT bound_at FROM channel_instance WHERE id = ?", Instant.class, shopA);

        tokenResponse = localTokenFor("BD-LOCAL-1").replace("access-for-BD-LOCAL-1", "renewed-access");
        var again = authorisation.complete("code2", stateFor(shopA));

        assertThat(again.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.AUTHORISED);
        assertThat(again.firstBinding()).isFalse();
        assertThat(jdbc.queryForObject("SELECT bound_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isEqualTo(boundAt);
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("renewed-access");
        /* 🔴 Renewed in place — never a second credential row for one shop. */
        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_credential WHERE channel_instance_id = ?",
                Integer.class, shopA)).isEqualTo(1);
    }

    /** 🔴 INV-16.6 over the local path: a different seller must not silently take over the shop. */
    @Test
    @DisplayName("a different local seller is refused and the original binding survives intact")
    void differentLocalSellerIsRefused() {
        tokenResponse = localTokenFor("BD-LOCAL-1");
        authorisation.complete("code", stateFor(shopA));

        tokenResponse = localTokenFor("BD-LOCAL-2");
        var result = authorisation.complete("code2", stateFor(shopA));

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.DIFFERENT_ACCOUNT);
        assertThat(result.boundAccount()).isEqualTo("BD-LOCAL-1");
        assertThat(result.attemptedAccount()).isEqualTo("BD-LOCAL-2");

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("BD-LOCAL-1");
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("access-for-BD-LOCAL-1");
    }

    /**
     * 🔴 V11's unique index, reached through the local path. One Daraz store belongs to ONE shop —
     * otherwise two shops would sync the same seller's products against each other.
     */
    @Test
    @DisplayName("a local seller already claimed by another shop is refused")
    void localSellerClaimedByAnotherShopIsRefused() {
        tokenResponse = localTokenFor("BD-LOCAL-1");
        authorisation.complete("code", stateFor(shopA));

        var result = authorisation.complete("code2", stateFor(shopB));

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.CLAIMED_BY_ANOTHER_SHOP);
        assertThat(result.attemptedAccount()).isEqualTo("BD-LOCAL-1");

        /* 🔴 Shop B gained nothing, and shop A lost nothing. */
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopB)).isNull();
        assertThat(credentials.load(shopB)).isEmpty();
        assertThat(connectionOf(shopB)).isEqualTo("NONE");
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("BD-LOCAL-1");
    }

    /** 🔴 THE VENTURE GUARD, END TO END: a foreign local seller binds nothing and stores nothing. */
    @Test
    @DisplayName("a local seller from another venture is refused and nothing is written")
    void foreignLocalSellerIsRefused() {
        tokenResponse = localTokenFor("SG-LOCAL-1").replace("\"country\":\"bd\"", "\"country\":\"sg\"");

        String state = stateFor(shopA);

        assertThatThrownBy(() -> authorisation.complete("code", state))
                .isInstanceOf(DarazProtocolException.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.type(DarazProtocolException.class))
                .extracting(DarazProtocolException::reason)
                .isEqualTo(DarazProtocolException.Reason.MISSING_BD_ACCOUNT);

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isNull();
        assertThat(credentials.load(shopA)).isEmpty();
        assertThat(connectionOf(shopA)).isEqualTo("NONE");
    }

    /** ⚠ A local response with no usable seller id stores nothing, and still burns the state. */
    @Test
    @DisplayName("a local response with no seller_id binds nothing and consumes the state")
    void localSellerWithoutSellerIdStoresNothing() {
        tokenResponse = """
                {"access_token":"a","refresh_token":"r","expires_in":100,"refresh_expires_in":200,
                 "country":"bd","account":"seller@example.test",
                 "user_info":{"country":"bd","user_id":7,"short_code":"SC-9"}}""";

        String state = stateFor(shopA);

        assertThatThrownBy(() -> authorisation.complete("code", state))
                .isInstanceOf(DarazProtocolException.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.type(DarazProtocolException.class))
                .extracting(DarazProtocolException::reason)
                .isEqualTo(DarazProtocolException.Reason.MISSING_SELLER_ID);

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isNull();
        assertThat(credentials.load(shopA)).isEmpty();
        assertThat(connectionOf(shopA)).isEqualTo("NONE");
        assertThat(jdbc.queryForObject(
                "SELECT consumed_at FROM channel_authorisation_attempt "
                        + "WHERE channel_instance_id = ? ORDER BY created_at DESC LIMIT 1",
                Instant.class, shopA)).isNotNull();
    }

    /** ✅ A local seller and a cross-border seller are two shops, isolated from each other. */
    @Test
    @DisplayName("local and cross-border shops each keep their own seller and credential")
    void bothShapesCoexistAcrossShops() {
        tokenResponse = localTokenFor("BD-LOCAL-1");
        authorisation.complete("c1", stateFor(shopA));

        tokenResponse = tokenFor("BD-SELLER-B");
        authorisation.complete("c2", stateFor(shopB));

        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("BD-LOCAL-1");
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopB)).isEqualTo("BD-SELLER-B");
        assertThat(credentials.load(shopA).orElseThrow().accessToken()).isEqualTo("access-for-BD-LOCAL-1");
        assertThat(credentials.load(shopB).orElseThrow().accessToken()).isEqualTo("access-for-BD-SELLER-B");
    }
}
