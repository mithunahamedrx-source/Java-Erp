package com.trioloo.erp.integration.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * The CURRENT provider authorisation material of one Channel Instance, as stored.
 *
 * <p>🔴 CIPHERTEXT ONLY. This class never holds, accepts or returns a plaintext token; it is
 * the storage shape and nothing more. Decryption happens in the credential store, against the
 * owner and material kind, and the plaintext never travels back through here.
 *
 * <p>🔴 ONE KEY VERSION FOR THE WHOLE ROW. Both ciphertexts, where present, are encrypted
 * under {@link #encryptionKeyVersion}. Mixed-version rows are forbidden, which is why
 * {@link #replaceMaterial} takes every field together and there is no per-field setter: a
 * setter would make it possible to rotate one token and leave the other behind, and the row
 * would then hold one version number describing two different keys.
 *
 * <p>⚠ No account identity lives here. The bound seller identity is
 * {@code channel_instance.external_account_identity} and stays the single authority
 * ({@code INV-16.5}, {@code API-070.c}); a convenience copy would be a second identity able
 * to disagree with the first.
 */
@Entity
@Table(name = "channel_credential")
public class ChannelCredentialEntity {

    @Id
    @Column(name = "channel_instance_id", nullable = false, updatable = false)
    private UUID channelInstanceId;

    @Column(name = "access_token_cipher", nullable = false)
    private byte[] accessTokenCipher;

    @Column(name = "refresh_token_cipher")
    private byte[] refreshTokenCipher;

    /** ⚠ NULL means the provider did not report an expiry, not that the token never expires. */
    @Column(name = "access_token_expires_at")
    private Instant accessTokenExpiresAt;

    @Column(name = "refresh_token_expires_at")
    private Instant refreshTokenExpiresAt;

    @Column(name = "encryption_key_version", nullable = false)
    private short encryptionKeyVersion;

    /** 🔴 A silent refresh moves this — never {@code channel_instance.authorised_at}. */
    @Column(name = "refreshed_at")
    private Instant refreshedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ChannelCredentialEntity() {
    }

    public static ChannelCredentialEntity of(UUID channelInstanceId,
                                             byte[] accessTokenCipher,
                                             byte[] refreshTokenCipher,
                                             Instant accessTokenExpiresAt,
                                             Instant refreshTokenExpiresAt,
                                             short encryptionKeyVersion,
                                             Instant refreshedAt,
                                             Instant at) {
        ChannelCredentialEntity entity = new ChannelCredentialEntity();
        entity.channelInstanceId = channelInstanceId;
        entity.replaceMaterial(accessTokenCipher, refreshTokenCipher,
                accessTokenExpiresAt, refreshTokenExpiresAt, encryptionKeyVersion, refreshedAt, at);
        return entity;
    }

    /**
     * Replaces every piece of material at once, under one key version.
     *
     * <p>🔴 ALL-OR-NOTHING BY SIGNATURE. This is the only mutator, so the row cannot end up
     * holding an access token under one key and a refresh token under another.
     */
    public void replaceMaterial(byte[] accessTokenCipher,
                                byte[] refreshTokenCipher,
                                Instant accessTokenExpiresAt,
                                Instant refreshTokenExpiresAt,
                                short encryptionKeyVersion,
                                Instant refreshedAt,
                                Instant at) {
        if (accessTokenCipher == null || accessTokenCipher.length == 0) {
            throw new IllegalArgumentException("An access token ciphertext is required.");
        }
        if (refreshTokenCipher != null && refreshTokenCipher.length == 0) {
            throw new IllegalArgumentException("A refresh token ciphertext, when present, cannot be empty.");
        }
        /* Mirrors the database CHECK. An expiry describing a token that does not exist is
           incoherent; a token whose expiry was never reported is legitimate. */
        if (refreshTokenExpiresAt != null && refreshTokenCipher == null) {
            throw new IllegalArgumentException(
                    "A refresh token expiry cannot be recorded without a refresh token.");
        }
        if (encryptionKeyVersion < 1) {
            throw new IllegalArgumentException("The encryption key version must be positive.");
        }
        this.accessTokenCipher = accessTokenCipher;
        this.refreshTokenCipher = refreshTokenCipher;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
        this.encryptionKeyVersion = encryptionKeyVersion;
        this.refreshedAt = refreshedAt;
        this.updatedAt = at;
    }

    public UUID getChannelInstanceId() { return channelInstanceId; }
    public byte[] getAccessTokenCipher() { return accessTokenCipher; }
    public byte[] getRefreshTokenCipher() { return refreshTokenCipher; }
    public Instant getAccessTokenExpiresAt() { return accessTokenExpiresAt; }
    public Instant getRefreshTokenExpiresAt() { return refreshTokenExpiresAt; }
    public short getEncryptionKeyVersion() { return encryptionKeyVersion; }
    public Instant getRefreshedAt() { return refreshedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
