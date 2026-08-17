package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.domain.TokenKind;
import com.trioloo.erp.integration.infrastructure.crypto.ChannelCredentialCipher;
import com.trioloo.erp.integration.infrastructure.crypto.CredentialDecryptionException;
import com.trioloo.erp.integration.infrastructure.crypto.CredentialEncryptionKeys;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelCredentialRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The credential store against the real schema.
 *
 * <p>🔴 THE DATABASE IS PART OF THE CONTRACT HERE, not a detail behind it. The one-credential
 * rule is a primary key, the refresh-expiry rule is a CHECK, and both are asserted by trying
 * to violate them rather than by trusting the Java that normally prevents it.
 */
@SpringBootTest
class ChannelCredentialStoreTest {

    /** Both versions exist in test configuration, so rotation can actually be exercised. */
    private static final String TEST_KEYS =
            "1:dHJpb2xvby10ZXN0LWtleS1ub3QtYS1zZWNyZXQhISE=,2:dHJpb2xvby10ZXN0LWtleS1UV08tbm90LXNlY3JldCE=";

    private static final String ACCESS = "access-token-plaintext-for-testing";
    private static final String REFRESH = "refresh-token-plaintext-for-testing";

    @Autowired ChannelCredentialStore store;
    @Autowired ChannelCredentialRepository credentials;
    @Autowired JdbcTemplate jdbc;

    private UUID shopA;
    private UUID shopB;

    private final Instant now = Instant.parse("2026-08-16T10:00:00Z");

    @BeforeEach
    void setUp() {
        clean();
        shopA = insertShop("CRED-TEST-A", "Credential Test A");
        shopB = insertShop("CRED-TEST-B", "Credential Test B");
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_credential WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'CRED-TEST-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'CRED-TEST-%'");
    }

    private UUID insertShop(String code, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status) "
                + "VALUES (?, ?, ?, 'DARAZ', 'DRAFT')", id, code, name);
        return id;
    }

    private ChannelCredentialStore storeWithActiveKey(String activeVersion) {
        return new ChannelCredentialStore(credentials,
                new ChannelCredentialCipher(new CredentialEncryptionKeys(TEST_KEYS, activeVersion)));
    }

    // ------------------------------------------------------------------ round trip

    @Test
    @DisplayName("material round-trips through the database")
    void roundTrip() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(
                ACCESS, now.plus(2, ChronoUnit.HOURS), REFRESH, now.plus(30, ChronoUnit.DAYS)), now);

        Optional<ChannelCredentialStore.ProviderCredential> loaded = store.load(shopA);

        assertThat(loaded).isPresent();
        assertThat(loaded.get().accessToken()).isEqualTo(ACCESS);
        assertThat(loaded.get().refreshToken()).isEqualTo(REFRESH);
        assertThat(loaded.get().accessTokenExpiresAt()).isEqualTo(now.plus(2, ChronoUnit.HOURS));
        assertThat(loaded.get().refreshTokenExpiresAt()).isEqualTo(now.plus(30, ChronoUnit.DAYS));
    }

    @Test
    @DisplayName("absent material reads as empty, never as a fabricated credential")
    void absentIsEmpty() {
        assertThat(store.load(shopA)).isEmpty();
    }

    // ------------------------------------------------------------------ the stored bytes

    /** 🔴 The claim the whole design rests on, checked against the actual column. */
    @Test
    @DisplayName("no plaintext token reaches the database")
    void databaseHoldsNoPlaintext() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(
                ACCESS, now.plusSeconds(3600), REFRESH, now.plusSeconds(86400)), now);

        byte[] accessBytes = jdbc.queryForObject(
                "SELECT access_token_cipher FROM channel_credential WHERE channel_instance_id = ?",
                byte[].class, shopA);
        byte[] refreshBytes = jdbc.queryForObject(
                "SELECT refresh_token_cipher FROM channel_credential WHERE channel_instance_id = ?",
                byte[].class, shopA);

        assertThat(new String(accessBytes, StandardCharsets.ISO_8859_1)).doesNotContain(ACCESS);
        assertThat(new String(refreshBytes, StandardCharsets.ISO_8859_1)).doesNotContain(REFRESH);
        assertThat(accessBytes).isNotEqualTo(refreshBytes);
    }

    // ------------------------------------------------------------------ cardinality and scope

    @Test
    @DisplayName("one Channel Instance holds at most one credential; writing again replaces it")
    void oneCredentialPerInstance() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(
                ACCESS, null, null, null), now);
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(
                "second-access-token", null, null, null), now.plusSeconds(60));

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_credential WHERE channel_instance_id = ?", Integer.class, shopA))
                .isEqualTo(1);
        assertThat(store.load(shopA).orElseThrow().accessToken()).isEqualTo("second-access-token");
    }

    @Test
    @DisplayName("one shop's credential is never visible as another's")
    void scopedStrictlyByInstance() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential("shop-a-token", null, null, null), now);

        assertThat(store.load(shopB)).isEmpty();
        assertThat(store.load(shopA).orElseThrow().accessToken()).isEqualTo("shop-a-token");
    }

    /** 🔴 Cross-shop substitution, performed at the database exactly as an attacker would. */
    @Test
    @DisplayName("a ciphertext copied into another shop's row cannot be decrypted")
    void copiedRowFailsToDecrypt() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, null, null), now);
        store.put(shopB, new ChannelCredentialStore.ProviderCredential("shop-b-token", null, null, null), now);

        jdbc.update("UPDATE channel_credential SET access_token_cipher = "
                + "(SELECT access_token_cipher FROM channel_credential WHERE channel_instance_id = ?) "
                + "WHERE channel_instance_id = ?", shopA, shopB);

        assertThatThrownBy(() -> store.load(shopB)).isInstanceOf(CredentialDecryptionException.class);
        /* Shop A is untouched and still works. */
        assertThat(store.load(shopA).orElseThrow().accessToken()).isEqualTo(ACCESS);
    }

    /** 🔴 The column swap, likewise at the database. */
    @Test
    @DisplayName("an access ciphertext moved into the refresh column cannot be decrypted")
    void swappedColumnFailsToDecrypt() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, REFRESH, null), now);

        jdbc.update("UPDATE channel_credential SET refresh_token_cipher = access_token_cipher "
                + "WHERE channel_instance_id = ?", shopA);

        assertThatThrownBy(() -> store.load(shopA)).isInstanceOf(CredentialDecryptionException.class);
    }

    @Test
    @DisplayName("rewriting the stored key version fails authentication")
    void rewrittenKeyVersionFails() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, null, null), now);

        jdbc.update("UPDATE channel_credential SET encryption_key_version = 2 "
                + "WHERE channel_instance_id = ?", shopA);

        assertThatThrownBy(() -> store.load(shopA)).isInstanceOf(CredentialDecryptionException.class);
    }

    // ------------------------------------------------------------------ expiry semantics

    @Test
    @DisplayName("an unknown access-token expiry is permitted")
    void accessExpiryMayBeUnknown() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, null, null), now);

        assertThat(store.load(shopA).orElseThrow().accessTokenExpiresAt()).isNull();
    }

    @Test
    @DisplayName("a refresh token may exist with an unknown expiry")
    void refreshTokenMayHaveUnknownExpiry() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, REFRESH, null), now);

        ChannelCredentialStore.ProviderCredential loaded = store.load(shopA).orElseThrow();
        assertThat(loaded.refreshToken()).isEqualTo(REFRESH);
        assertThat(loaded.refreshTokenExpiresAt()).isNull();
    }

    /** ⚠ The one-directional CHECK, verified at the database rather than only in Java. */
    @Test
    @DisplayName("the database refuses a refresh expiry with no refresh token")
    void refreshExpiryWithoutTokenRejectedByDatabase() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, null, null), now);

        assertThatThrownBy(() -> jdbc.update(
                "UPDATE channel_credential SET refresh_token_expires_at = now() "
                        + "WHERE channel_instance_id = ?", shopA))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("the application refuses the same incoherent combination before the database sees it")
    void refreshExpiryWithoutTokenRejectedByApplication() {
        assertThatThrownBy(() -> new ChannelCredentialStore.ProviderCredential(
                ACCESS, null, null, now.plusSeconds(60)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ------------------------------------------------------------------ refresh vs authorisation

    @Test
    @DisplayName("a silent refresh records refreshed_at; an authorisation clears it")
    void refreshedAtSemantics() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, REFRESH, null), now);
        assertThat(jdbc.queryForObject("SELECT refreshed_at FROM channel_credential WHERE channel_instance_id = ?",
                Instant.class, shopA)).isNull();

        store.putRefreshed(shopA, new ChannelCredentialStore.ProviderCredential(
                "rotated-access", null, REFRESH, null), now.plusSeconds(3600));
        assertThat(jdbc.queryForObject("SELECT refreshed_at FROM channel_credential WHERE channel_instance_id = ?",
                Instant.class, shopA)).isEqualTo(now.plusSeconds(3600));

        /* A reauthorisation is not a rotation: the mechanical marker resets. */
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(
                "reauthorised-access", null, REFRESH, null), now.plusSeconds(7200));
        assertThat(jdbc.queryForObject("SELECT refreshed_at FROM channel_credential WHERE channel_instance_id = ?",
                Instant.class, shopA)).isNull();
    }

    // ------------------------------------------------------------------ key rotation

    /**
     * 🔴 THE ONE-VERSION-PER-ROW INVARIANT. After the active key moves, touching a row must
     * migrate EVERYTHING in it — otherwise the row carries one version number describing two
     * different keys, and the refresh token becomes permanently unreadable.
     */
    @Test
    @DisplayName("touching a row after the active key changes re-encrypts every token under the new key")
    void rotationMigratesTheWholeRow() {
        ChannelCredentialStore underV1 = storeWithActiveKey("1");
        ChannelCredentialStore underV2 = storeWithActiveKey("2");

        underV1.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, REFRESH, null), now);
        assertThat(jdbc.queryForObject("SELECT encryption_key_version FROM channel_credential "
                + "WHERE channel_instance_id = ?", Short.class, shopA)).isEqualTo((short) 1);

        byte[] v1Access = jdbc.queryForObject("SELECT access_token_cipher FROM channel_credential "
                + "WHERE channel_instance_id = ?", byte[].class, shopA);

        /* A mutation performed while v2 is active: read under v1, write back under v2. */
        ChannelCredentialStore.ProviderCredential carried = underV1.load(shopA).orElseThrow();
        underV2.putRefreshed(shopA, carried, now.plusSeconds(60));

        assertThat(jdbc.queryForObject("SELECT encryption_key_version FROM channel_credential "
                + "WHERE channel_instance_id = ?", Short.class, shopA)).isEqualTo((short) 2);

        /* BOTH tokens still read correctly, which only holds if both were re-encrypted. */
        ChannelCredentialStore.ProviderCredential afterRotation = underV2.load(shopA).orElseThrow();
        assertThat(afterRotation.accessToken()).isEqualTo(ACCESS);
        assertThat(afterRotation.refreshToken()).isEqualTo(REFRESH);

        /* And the old v1 ciphertext cannot be pushed back into the now-v2 row. */
        jdbc.update("UPDATE channel_credential SET access_token_cipher = ? WHERE channel_instance_id = ?",
                v1Access, shopA);
        assertThatThrownBy(() -> underV2.load(shopA)).isInstanceOf(CredentialDecryptionException.class);
    }

    // ------------------------------------------------------------------ disconnect

    @Test
    @DisplayName("disconnect destroys the credential and leaves the shop and its history intact")
    void disconnectDeletesOnlyTheCredential() {
        store.put(shopA, new ChannelCredentialStore.ProviderCredential(ACCESS, null, REFRESH, null), now);
        jdbc.update("UPDATE channel_instance SET external_account_identity = 'seller-123', "
                + "bound_at = now(), authorised_at = now() WHERE id = ?", shopA);

        assertThat(store.delete(shopA)).isTrue();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_credential "
                + "WHERE channel_instance_id = ?", Integer.class, shopA)).isZero();
        assertThat(store.load(shopA)).isEmpty();

        /* INV-16.10 — the shop and its binding facts survive. */
        assertThat(jdbc.queryForObject("SELECT external_account_identity FROM channel_instance WHERE id = ?",
                String.class, shopA)).isEqualTo("seller-123");
        assertThat(jdbc.queryForObject("SELECT bound_at FROM channel_instance WHERE id = ?",
                Instant.class, shopA)).isNotNull();
    }

    @Test
    @DisplayName("disconnecting a shop that has no credential reports nothing to destroy")
    void disconnectWithoutCredential() {
        assertThat(store.delete(shopA)).isFalse();
    }

    // ------------------------------------------------------------------ secret hygiene

    @Test
    @DisplayName("the credential record does not print its own contents")
    void credentialDoesNotPrintItself() {
        ChannelCredentialStore.ProviderCredential credential =
                new ChannelCredentialStore.ProviderCredential(ACCESS, null, REFRESH, null);

        assertThat(credential.toString()).doesNotContain(ACCESS).doesNotContain(REFRESH);
        assertThat(credential.toString()).isEqualTo("ProviderCredential[REDACTED]");
    }

    @Test
    @DisplayName("the token kinds stored are distinguishable, so a swap is detectable")
    void tokenKindsAreDistinct() {
        assertThat(TokenKind.ACCESS_TOKEN.code()).isNotEqualTo(TokenKind.REFRESH_TOKEN.code());
    }
}
