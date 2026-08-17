package com.trioloo.erp.integration.infrastructure.crypto;

import com.trioloo.erp.integration.domain.TokenKind;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 🔴 THE SUBSTITUTION TESTS ARE THE POINT OF THIS CLASS.
 *
 * <p>AES-GCM's tag proves a ciphertext is intact under a key. It does NOT prove the ciphertext
 * belongs where it was found. Every shop's material is protected by the same master key, so
 * without contextual additional authenticated data a blob could be copied from one shop's row
 * into another's — or from the access-token column into the refresh-token column — and would
 * decrypt perfectly. The shop would then transact against another seller's marketplace account.
 *
 * <p>⚠ A GREEN ROUND-TRIP TEST WOULD NOT NOTICE ANY OF THAT. These do.
 */
class ChannelCredentialCipherTest {

    private static final String KEY_V1 = "dHJpb2xvby10ZXN0LWtleS1ub3QtYS1zZWNyZXQhISE=";
    private static final String KEY_V2 = "dHJpb2xvby10ZXN0LWtleS1UV08tbm90LXNlY3JldCE=";
    /** A third, distinct key deliberately published under VERSION 1 — see the wrong-key test. */
    private static final String OTHER_KEY_V1 = "YW5vdGhlci10ZXN0LWtleS1zdGlsbC1ub3Qtc2VjISE=";

    private static final UUID SHOP_A = UUID.fromString("aaaaaaaa-0000-0000-0000-000000000001");
    private static final UUID SHOP_B = UUID.fromString("bbbbbbbb-0000-0000-0000-000000000002");

    private static final String ACCESS_PLAINTEXT = "access-token-value-for-testing-only";
    private static final String REFRESH_PLAINTEXT = "refresh-token-value-for-testing-only";

    private final ChannelCredentialCipher cipher = new ChannelCredentialCipher(
            new CredentialEncryptionKeys("1:" + KEY_V1 + ",2:" + KEY_V2, "1"));

    private final ChannelCredentialCipher otherDeployment = new ChannelCredentialCipher(
            new CredentialEncryptionKeys("1:" + OTHER_KEY_V1, "1"));

    // ------------------------------------------------------------------ round trip

    @Test
    @DisplayName("an access token round-trips for its own shop")
    void accessTokenRoundTrip() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);
        assertThat(cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, blob))
                .isEqualTo(ACCESS_PLAINTEXT);
    }

    @Test
    @DisplayName("a refresh token round-trips for its own shop")
    void refreshTokenRoundTrip() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.REFRESH_TOKEN, (short) 1, REFRESH_PLAINTEXT);
        assertThat(cipher.decrypt(SHOP_A, TokenKind.REFRESH_TOKEN, (short) 1, blob))
                .isEqualTo(REFRESH_PLAINTEXT);
    }

    // ------------------------------------------------------------------ substitution

    @Nested
    @DisplayName("context substitution")
    class Substitution {

        /** 🔴 The cross-shop attack: one master key, two shops, a copied row. */
        @Test
        @DisplayName("shop A's ciphertext cannot be decrypted as shop B's, on the same key")
        void crossShopSubstitutionFails() {
            byte[] shopA = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

            assertThatThrownBy(() -> cipher.decrypt(SHOP_B, TokenKind.ACCESS_TOKEN, (short) 1, shopA))
                    .isInstanceOf(CredentialDecryptionException.class);
        }

        /** 🔴 The column-swap attack: a valid blob moved between token columns of one row. */
        @Test
        @DisplayName("an access-token ciphertext cannot be decrypted as a refresh token")
        void tokenKindSubstitutionFails() {
            byte[] access = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

            assertThatThrownBy(() -> cipher.decrypt(SHOP_A, TokenKind.REFRESH_TOKEN, (short) 1, access))
                    .isInstanceOf(CredentialDecryptionException.class);
        }

        @Test
        @DisplayName("a refresh-token ciphertext cannot be decrypted as an access token")
        void reverseTokenKindSubstitutionFails() {
            byte[] refresh = cipher.encrypt(SHOP_A, TokenKind.REFRESH_TOKEN, (short) 1, REFRESH_PLAINTEXT);

            assertThatThrownBy(() -> cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, refresh))
                    .isInstanceOf(CredentialDecryptionException.class);
        }
    }

    // ------------------------------------------------------------------ tampering

    @Test
    @DisplayName("mutating the ciphertext body fails authentication")
    void ciphertextMutationFails() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);
        blob[1 + ChannelCredentialCipher.IV_BYTES] ^= 0x01;   // first ciphertext byte

        assertThatThrownBy(() -> cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, blob))
                .isInstanceOf(CredentialDecryptionException.class);
    }

    @Test
    @DisplayName("mutating the GCM tag fails authentication")
    void tagMutationFails() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);
        blob[blob.length - 1] ^= 0x01;                        // last tag byte

        assertThatThrownBy(() -> cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, blob))
                .isInstanceOf(CredentialDecryptionException.class);
    }

    @Test
    @DisplayName("mutating the IV fails authentication")
    void ivMutationFails() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);
        blob[1] ^= 0x01;

        assertThatThrownBy(() -> cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, blob))
                .isInstanceOf(CredentialDecryptionException.class);
    }

    @Test
    @DisplayName("an unknown scheme version is refused rather than guessed at")
    void unknownSchemeVersionFails() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);
        blob[0] = (byte) 0x7F;

        assertThatThrownBy(() -> cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, blob))
                .isInstanceOf(CredentialDecryptionException.class);
    }

    // ------------------------------------------------------------------ keys

    @Test
    @DisplayName("a different deployment's key cannot read this deployment's ciphertext")
    void wrongKeyFails() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

        assertThatThrownBy(() ->
                otherDeployment.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, blob))
                .isInstanceOf(CredentialDecryptionException.class);
    }

    /**
     * 🔴 THE DOWNGRADE ATTACK. {@code encryption_key_version} is a plain database column. If it
     * were merely a lookup hint, rewriting it would make the application decrypt under a
     * different — possibly retired or weaker — key. It is bound into the AAD, so the tag fails.
     */
    @Test
    @DisplayName("rewriting the stored key version fails authentication instead of selecting another key")
    void rewrittenKeyVersionFails() {
        byte[] encryptedUnderV1 = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

        /* Both key versions are configured, so v2's key is genuinely available. The failure is
           the AAD binding, not a missing key. */
        assertThatThrownBy(() ->
                cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 2, encryptedUnderV1))
                .isInstanceOf(CredentialDecryptionException.class);
    }

    @Test
    @DisplayName("an unconfigured key version is refused")
    void unconfiguredKeyVersionFails() {
        assertThatThrownBy(() ->
                cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 99, ACCESS_PLAINTEXT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ------------------------------------------------------------------ blob hygiene

    @Test
    @DisplayName("encrypting the same value twice produces different blobs")
    void ivIsFreshEveryTime() {
        byte[] first = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);
        byte[] second = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

        assertThat(first).isNotEqualTo(second);
        /* Specifically the IV, which is what must never repeat under one key. */
        assertThat(java.util.Arrays.copyOfRange(first, 1, 1 + ChannelCredentialCipher.IV_BYTES))
                .isNotEqualTo(java.util.Arrays.copyOfRange(second, 1, 1 + ChannelCredentialCipher.IV_BYTES));
        /* Both still decrypt — freshness is not achieved by breaking correctness. */
        assertThat(cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, first))
                .isEqualTo(ACCESS_PLAINTEXT);
        assertThat(cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, second))
                .isEqualTo(ACCESS_PLAINTEXT);
    }

    @Test
    @DisplayName("the stored blob contains no plaintext")
    void blobCarriesNoPlaintext() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

        String asLatin1 = new String(blob, StandardCharsets.ISO_8859_1);
        assertThat(asLatin1).doesNotContain(ACCESS_PLAINTEXT);
        /* And no recognisable fragment of it either. */
        assertThat(asLatin1).doesNotContain("access-token");
    }

    @Test
    @DisplayName("the blob is framed as scheme ‖ iv ‖ sealed")
    void blobFraming() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

        assertThat(blob[0]).isEqualTo(ChannelCredentialCipher.SCHEME_VERSION);
        /* scheme + iv + ciphertext(= plaintext length) + 16-byte tag. */
        assertThat(blob).hasSize(1 + ChannelCredentialCipher.IV_BYTES
                + ACCESS_PLAINTEXT.getBytes(StandardCharsets.UTF_8).length + 16);
    }

    // ------------------------------------------------------------------ AAD layout

    /**
     * The AAD is part of the ON-DISK FORMAT: every stored credential is bound to these exact
     * bytes. Changing the layout without incrementing {@code AAD_VERSION} would silently make
     * every existing row undecryptable, so the layout is pinned here rather than left implicit.
     */
    @Test
    @DisplayName("the additional authenticated data is exactly 21 fixed-width bytes in the ratified order")
    void aadLayoutIsPinned() {
        byte[] aad = ChannelCredentialCipher.additionalData(SHOP_A, TokenKind.REFRESH_TOKEN, (short) 258);

        assertThat(aad).hasSize(ChannelCredentialCipher.AAD_BYTES).hasSize(21);
        assertThat(aad[0]).isEqualTo(ChannelCredentialCipher.AAD_VERSION);
        assertThat(aad[1]).isEqualTo(ChannelCredentialCipher.SCHEME_VERSION);
        /* key_version 258 = 0x0102, big-endian. */
        assertThat(aad[2]).isEqualTo((byte) 0x01);
        assertThat(aad[3]).isEqualTo((byte) 0x02);
        /* UUID, most-significant bits first. */
        assertThat(java.util.Arrays.copyOfRange(aad, 4, 20))
                .isEqualTo(java.nio.ByteBuffer.allocate(16)
                        .putLong(SHOP_A.getMostSignificantBits())
                        .putLong(SHOP_A.getLeastSignificantBits())
                        .array());
        assertThat(aad[20]).isEqualTo((byte) 2);   // REFRESH_TOKEN
    }

    /** 🔴 Reordering the enum must never change a code; ordinal() would. */
    @Test
    @DisplayName("token kind codes are stable and independent of declaration order")
    void tokenKindCodesAreStable() {
        assertThat(TokenKind.ACCESS_TOKEN.code()).isEqualTo((byte) 1);
        assertThat(TokenKind.REFRESH_TOKEN.code()).isEqualTo((byte) 2);
    }

    @Test
    @DisplayName("distinct contexts never produce the same additional authenticated data")
    void aadIsUnambiguous() {
        assertThat(ChannelCredentialCipher.additionalData(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1))
                .isNotEqualTo(ChannelCredentialCipher.additionalData(SHOP_B, TokenKind.ACCESS_TOKEN, (short) 1))
                .isNotEqualTo(ChannelCredentialCipher.additionalData(SHOP_A, TokenKind.REFRESH_TOKEN, (short) 1))
                .isNotEqualTo(ChannelCredentialCipher.additionalData(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 2));
    }

    // ------------------------------------------------------------------ failure hygiene

    @Test
    @DisplayName("a decryption failure carries no material and no cause")
    void failureLeaksNothing() {
        byte[] blob = cipher.encrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, ACCESS_PLAINTEXT);

        assertThatThrownBy(() -> cipher.decrypt(SHOP_B, TokenKind.ACCESS_TOKEN, (short) 1, blob))
                .isInstanceOf(CredentialDecryptionException.class)
                .hasNoCause()
                .satisfies(e -> {
                    assertThat(e.getMessage()).doesNotContain(ACCESS_PLAINTEXT);
                    assertThat(e.getMessage()).doesNotContain(SHOP_A.toString());
                    assertThat(e.getMessage()).doesNotContain(SHOP_B.toString());
                });
    }

    @Test
    @DisplayName("a truncated blob is refused rather than parsed")
    void truncatedBlobFails() {
        assertThatThrownBy(() ->
                cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, new byte[]{1, 2, 3}))
                .isInstanceOf(CredentialDecryptionException.class);
        assertThatThrownBy(() ->
                cipher.decrypt(SHOP_A, TokenKind.ACCESS_TOKEN, (short) 1, null))
                .isInstanceOf(CredentialDecryptionException.class);
    }
}
