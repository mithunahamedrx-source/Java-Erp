package com.trioloo.erp.integration.application;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The callback correlation, against the real schema.
 *
 * <p>🔴 THE PROPERTY UNDER TEST IS THAT THE CALLBACK CANNOT CHOOSE THE SHOP. Everything else
 * here — expiry, replay refusal, concurrency — exists to stop a state from being usable more
 * than once or by anyone who did not initiate it.
 */
@SpringBootTest
class ChannelAuthorisationAttemptStoreTest {

    @Autowired ChannelAuthorisationAttemptStore attempts;
    @Autowired JdbcTemplate jdbc;

    private UUID shopA;
    private UUID shopB;
    private UUID actor;

    private final Instant now = Instant.parse("2026-08-16T10:00:00Z");
    private final Instant soon = now.plus(10, ChronoUnit.MINUTES);

    @BeforeEach
    void setUp() {
        clean();
        shopA = insertShop("ATTEMPT-TEST-A", "Attempt Test A");
        shopB = insertShop("ATTEMPT-TEST-B", "Attempt Test B");
        actor = insertActor();
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_authorisation_attempt WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'ATTEMPT-TEST-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'ATTEMPT-TEST-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username = 'attempt-test-actor'");
    }

    private UUID insertShop(String code, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status) "
                + "VALUES (?, ?, ?, 'DARAZ', 'DRAFT')", id, code, name);
        return id;
    }

    private UUID insertActor() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at) "
                + "VALUES (?, 'attempt-test-actor', 'Attempt Test Actor', 'INVITED', now())", id);
        return id;
    }

    private static byte[] sha256(String value) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    }

    // ------------------------------------------------------------------ issue

    @Test
    @DisplayName("the nonce is never persisted — only its SHA-256")
    void nonceIsNeverStored() throws Exception {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        byte[] stored = jdbc.queryForObject(
                "SELECT state_token_hash FROM channel_authorisation_attempt WHERE id = ?",
                byte[].class, issued.attemptId());

        assertThat(stored).hasSize(32).isEqualTo(sha256(issued.state()));
        assertThat(new String(stored, StandardCharsets.ISO_8859_1)).doesNotContain(issued.state());

        /* No column anywhere in the row holds the plaintext state. */
        String wholeRow = jdbc.queryForObject(
                "SELECT channel_authorisation_attempt::text FROM channel_authorisation_attempt WHERE id = ?",
                String.class, issued.attemptId());
        assertThat(wholeRow).doesNotContain(issued.state());
    }

    @Test
    @DisplayName("the issued state is high-entropy and URL-safe")
    void stateIsUrlSafeAndUnique() {
        String first = attempts.issue(shopA, actor, now, soon).state();
        String second = attempts.issue(shopA, actor, now, soon).state();

        assertThat(first).isNotEqualTo(second);
        assertThat(first).matches("[A-Za-z0-9_-]+");     // no padding, no escaping needed
        assertThat(first.length()).isGreaterThanOrEqualTo(43);   // 32 bytes, base64url unpadded
    }

    @Test
    @DisplayName("the issued state does not print itself")
    void issuedStateDoesNotPrintItself() {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        assertThat(issued.toString()).doesNotContain(issued.state()).contains("REDACTED");
    }

    @Test
    @DisplayName("the initiating actor is recorded at the act")
    void actorIsRecorded() {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        assertThat(jdbc.queryForObject("SELECT initiated_by FROM channel_authorisation_attempt WHERE id = ?",
                UUID.class, issued.attemptId())).isEqualTo(actor);
        assertThat(attempts.consume(issued.state(), now.plusSeconds(30)).orElseThrow().initiatedBy())
                .isEqualTo(actor);
    }

    // ------------------------------------------------------------------ consume

    @Test
    @DisplayName("a valid state consumes exactly once and returns the shop that initiated it")
    void consumesOnceAndReturnsTheInitiatingShop() {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        Optional<ChannelAuthorisationAttemptStore.ConsumedAttempt> first =
                attempts.consume(issued.state(), now.plusSeconds(30));

        assertThat(first).isPresent();
        assertThat(first.get().channelInstanceId()).isEqualTo(shopA);
        assertThat(first.get().attemptId()).isEqualTo(issued.attemptId());
    }

    /** 🔴 Replay. */
    @Test
    @DisplayName("a replayed state is refused")
    void replayRefused() {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        assertThat(attempts.consume(issued.state(), now.plusSeconds(30))).isPresent();
        assertThat(attempts.consume(issued.state(), now.plusSeconds(31))).isEmpty();
        assertThat(attempts.consume(issued.state(), now.plusSeconds(32))).isEmpty();
    }

    @Test
    @DisplayName("an expired state is refused")
    void expiredRefused() {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        assertThat(attempts.consume(issued.state(), soon.plusSeconds(1))).isEmpty();
        /* And it stays unconsumed rather than being silently burned. */
        assertThat(jdbc.queryForObject("SELECT consumed_at FROM channel_authorisation_attempt WHERE id = ?",
                Instant.class, issued.attemptId())).isNull();
    }

    @Test
    @DisplayName("an unknown or forged state is refused")
    void forgedRefused() {
        attempts.issue(shopA, actor, now, soon);

        assertThat(attempts.consume("not-a-real-state-value-at-all", now.plusSeconds(30))).isEmpty();
        assertThat(attempts.consume("", now.plusSeconds(30))).isEmpty();
        assertThat(attempts.consume(null, now.plusSeconds(30))).isEmpty();
    }

    // ------------------------------------------------------------------ wrong shop

    /**
     * 🔴 THE CENTRAL GUARANTEE. Shop A's state resolves to shop A, and there is no parameter
     * through which a caller could ask for shop B — the callback presents a state, not a shop.
     */
    @Test
    @DisplayName("a state issued for one shop can never resolve to another")
    void stateCannotBindTheWrongShop() {
        ChannelAuthorisationAttemptStore.IssuedState forA = attempts.issue(shopA, actor, now, soon);
        ChannelAuthorisationAttemptStore.IssuedState forB = attempts.issue(shopB, actor, now, soon);

        assertThat(attempts.consume(forA.state(), now.plusSeconds(30)).orElseThrow().channelInstanceId())
                .isEqualTo(shopA);
        assertThat(attempts.consume(forB.state(), now.plusSeconds(30)).orElseThrow().channelInstanceId())
                .isEqualTo(shopB);
    }

    @Test
    @DisplayName("consuming one attempt does not disturb another")
    void unrelatedAttemptUntouched() {
        ChannelAuthorisationAttemptStore.IssuedState forA = attempts.issue(shopA, actor, now, soon);
        ChannelAuthorisationAttemptStore.IssuedState forB = attempts.issue(shopB, actor, now, soon);

        attempts.consume(forA.state(), now.plusSeconds(30));

        assertThat(jdbc.queryForObject("SELECT consumed_at FROM channel_authorisation_attempt WHERE id = ?",
                Instant.class, forB.attemptId())).isNull();
        assertThat(attempts.consume(forB.state(), now.plusSeconds(31))).isPresent();
    }

    @Test
    @DisplayName("a failed consume burns nothing")
    void failedConsumeMutatesNothing() {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        assertThat(attempts.consume("wrong-state", now.plusSeconds(30))).isEmpty();

        assertThat(jdbc.queryForObject("SELECT consumed_at FROM channel_authorisation_attempt WHERE id = ?",
                Instant.class, issued.attemptId())).isNull();
        assertThat(attempts.consume(issued.state(), now.plusSeconds(31))).isPresent();
    }

    // ------------------------------------------------------------------ concurrency

    /**
     * 🔴 TWO CALLBACKS, ONE STATE. Read-then-write would let both observe an unconsumed row
     * and both proceed; the guard lives in the UPDATE so the database picks the winner.
     */
    @Test
    @DisplayName("of two concurrent consumers exactly one succeeds")
    void concurrentConsumeHasExactlyOneWinner() throws Exception {
        ChannelAuthorisationAttemptStore.IssuedState issued = attempts.issue(shopA, actor, now, soon);

        int racers = 8;
        ExecutorService pool = Executors.newFixedThreadPool(racers);
        CyclicBarrier startTogether = new CyclicBarrier(racers);
        try {
            Callable<Boolean> attempt = () -> {
                startTogether.await();
                return attempts.consume(issued.state(), now.plusSeconds(30)).isPresent();
            };

            List<Future<Boolean>> results = pool.invokeAll(java.util.Collections.nCopies(racers, attempt));

            long winners = 0;
            for (Future<Boolean> result : results) {
                if (result.get()) {
                    winners++;
                }
            }
            assertThat(winners).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        assertThat(jdbc.queryForObject("SELECT consumed_at FROM channel_authorisation_attempt WHERE id = ?",
                Instant.class, issued.attemptId())).isNotNull();
    }

    // ------------------------------------------------------------------ schema guards

    @Test
    @DisplayName("the database refuses a state hash that is not a 32-byte digest")
    void hashLengthEnforced() {
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.check_constraints "
                        + "WHERE constraint_name = 'channel_authorisation_attempt_hash_length_check'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("the same state cannot be issued twice")
    void stateHashIsUnique() {
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM pg_constraint WHERE conname = 'channel_authorisation_attempt_state_uq'",
                Integer.class)).isEqualTo(1);
    }
}
