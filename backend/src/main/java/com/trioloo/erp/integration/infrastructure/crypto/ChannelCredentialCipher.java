package com.trioloo.erp.integration.infrastructure.crypto;

import com.trioloo.erp.integration.domain.TokenKind;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.UUID;

/**
 * Encrypts and decrypts provider authorisation material, bound to the context it belongs to.
 *
 * <p>🔴 THE CONTEXT IS NOT DECORATION — IT IS THE SECURITY PROPERTY. AES-GCM's tag proves a
 * ciphertext is intact under a key; it says nothing about WHERE that ciphertext belongs.
 * Every shop's material is protected by the same master key, so without additional
 * authenticated data an attacker with database write access could copy shop A's access-token
 * blob into shop B's row and it would decrypt perfectly — shop B would then transact against
 * shop A's marketplace account. Binding the owner and the material kind into the AAD is what
 * makes that substitution fail.
 *
 * <p><strong>AAD — exactly 21 fixed-width bytes, big-endian.</strong>
 * <pre>
 *   0        aad_version         u8
 *   1        scheme_version      u8
 *   2..3     key_version         u16
 *   4..19    channel_instance_id 16 bytes, MSB then LSB
 *   20       token_kind          u8   (1 = ACCESS_TOKEN, 2 = REFRESH_TOKEN)
 * </pre>
 * ⚠ EVERY FIELD IS FIXED-WIDTH, so no delimiter is needed and no two distinct contexts can
 * encode to the same bytes. Ambiguous string concatenation — the usual way this is done — is
 * exactly how {@code "1" + "23"} and {@code "12" + "3"} become the same AAD.
 *
 * <p>Binding {@code key_version} means the database column that SELECTS the key cannot be
 * rewritten to point at another key: the tag fails instead.
 *
 * <p><strong>Stored blob:</strong> {@code scheme_version(1) ‖ iv(12) ‖ ciphertext ‖ tag(16)}.
 * The key version is NOT the blob's authority — the column is, so a rotation sweep can find
 * rows without opening them — but it is authenticated through the AAD.
 *
 * <p>🔴 NO PLAINTEXT IS LOGGED, RETURNED IN AN EXCEPTION, OR RETAINED. Every failure is the
 * same opaque {@link CredentialDecryptionException}: distinguishing "wrong key" from "wrong
 * shop" from "tampered" would hand an attacker an oracle.
 */
@Component
public class ChannelCredentialCipher {

    /** The AAD layout version. 🔴 Increment when the layout changes; never reuse. */
    static final byte AAD_VERSION = 1;

    /** The blob framing / algorithm version. */
    static final byte SCHEME_VERSION = 1;

    static final int AAD_BYTES = 21;
    static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private final CredentialEncryptionKeys keys;
    private final SecureRandom random = new SecureRandom();

    public ChannelCredentialCipher(CredentialEncryptionKeys keys) {
        this.keys = keys;
    }

    /** The version new material must be written under. */
    public short activeKeyVersion() {
        return keys.activeVersion();
    }

    /**
     * Encrypts one piece of material for one owner.
     *
     * <p>⚠ The key version is an ARGUMENT rather than read from configuration inside this
     * method, so that a caller writing several tokens into one row can guarantee they all
     * share one version — the invariant the schema depends on.
     */
    public byte[] encrypt(UUID channelInstanceId, TokenKind kind, short keyVersion, String plaintext) {
        if (channelInstanceId == null || kind == null || plaintext == null) {
            throw new IllegalArgumentException("Channel instance, token kind and plaintext are all required.");
        }

        byte[] iv = new byte[IV_BYTES];
        random.nextBytes(iv);

        byte[] plainBytes = plaintext.getBytes(StandardCharsets.UTF_8);
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, keys.keyFor(keyVersion), new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(additionalData(channelInstanceId, kind, keyVersion));
            byte[] sealed = cipher.doFinal(plainBytes);

            return ByteBuffer.allocate(1 + IV_BYTES + sealed.length)
                    .put(SCHEME_VERSION)
                    .put(iv)
                    .put(sealed)
                    .array();
        } catch (GeneralSecurityException e) {
            /* 🔴 Not chained: a provider exception can echo the input it choked on. */
            throw new IllegalStateException("Integration credential encryption failed.");
        } finally {
            Arrays.fill(plainBytes, (byte) 0);
        }
    }

    /**
     * Decrypts one piece of material for one owner.
     *
     * @throws CredentialDecryptionException on ANY failure — wrong owner, wrong kind, wrong
     *                                       key, wrong version, tampered ciphertext or tag,
     *                                       or unreadable framing.
     */
    public String decrypt(UUID channelInstanceId, TokenKind kind, short keyVersion, byte[] blob) {
        if (channelInstanceId == null || kind == null) {
            throw new IllegalArgumentException("Channel instance and token kind are both required.");
        }
        if (blob == null || blob.length <= 1 + IV_BYTES) {
            throw new CredentialDecryptionException();
        }
        if (blob[0] != SCHEME_VERSION) {
            throw new CredentialDecryptionException();
        }

        byte[] iv = Arrays.copyOfRange(blob, 1, 1 + IV_BYTES);
        byte[] sealed = Arrays.copyOfRange(blob, 1 + IV_BYTES, blob.length);

        byte[] plainBytes = null;
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, keys.keyFor(keyVersion), new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(additionalData(channelInstanceId, kind, keyVersion));
            plainBytes = cipher.doFinal(sealed);
            return new String(plainBytes, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            /* One indistinguishable failure for every cause. No oracle, no material. */
            throw new CredentialDecryptionException();
        } finally {
            if (plainBytes != null) {
                Arrays.fill(plainBytes, (byte) 0);
            }
        }
    }

    /** The 21-byte context. Package-private so the layout itself can be asserted in tests. */
    static byte[] additionalData(UUID channelInstanceId, TokenKind kind, short keyVersion) {
        return ByteBuffer.allocate(AAD_BYTES)          // ByteBuffer is big-endian by default.
                .put(AAD_VERSION)
                .put(SCHEME_VERSION)
                .putShort(keyVersion)
                .putLong(channelInstanceId.getMostSignificantBits())
                .putLong(channelInstanceId.getLeastSignificantBits())
                .put(kind.code())
                .array();
    }
}
