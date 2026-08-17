package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.domain.TokenKind;
import com.trioloo.erp.integration.infrastructure.crypto.ChannelCredentialCipher;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelCredentialEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelCredentialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * The only way provider authorisation material is stored or retrieved.
 *
 * <p>🔴 EVERY OPERATION IS SCOPED TO ONE EXPLICIT CHANNEL INSTANCE ({@code API-071.a}). There
 * is no "current shop" context to get wrong and no bulk read: an ambient current-account
 * variable is the precise mechanism by which shop A's authorisation ends up reading shop B's
 * data, which {@code AGV-016} forbids.
 *
 * <p>🔴 PLAINTEXT EXISTS ONLY IN THE CALLER'S HANDS AND ONLY MOMENTARILY. It is encrypted on
 * the way in and decrypted on the way out, against the owner and the material kind. It is
 * never logged, never projected through an API, never returned to a frontend
 * ({@code API-070.a}).
 *
 * <p>🔴 ONE KEY VERSION PER ROW, MAINTAINED BY CONSTRUCTION. Both writes take the COMPLETE
 * material and re-encrypt everything under the currently active key, so a row can never hold
 * an access token under one key and a refresh token under another. A partial update is done by
 * {@link #load} then write — which, when the active key has moved on, silently rotates the
 * whole row as a side effect of touching it. That is the intended rotation path: material
 * migrates to the new key as it is used, and no sweep has to open every row at once.
 */
@Service
public class ChannelCredentialStore {

    private final ChannelCredentialRepository credentials;
    private final ChannelCredentialCipher cipher;

    public ChannelCredentialStore(ChannelCredentialRepository credentials, ChannelCredentialCipher cipher) {
        this.credentials = credentials;
        this.cipher = cipher;
    }

    /**
     * The material of one shop, in plaintext.
     *
     * <p>⚠ A caller holding this is holding a live marketplace credential. It exists to be
     * handed to a signing client and then dropped — not stored, cached or logged.
     */
    public record ProviderCredential(String accessToken,
                                     Instant accessTokenExpiresAt,
                                     String refreshToken,
                                     Instant refreshTokenExpiresAt) {

        public ProviderCredential {
            if (accessToken == null || accessToken.isBlank()) {
                throw new IllegalArgumentException("An access token is required.");
            }
            if (refreshToken == null && refreshTokenExpiresAt != null) {
                throw new IllegalArgumentException(
                        "A refresh token expiry cannot be supplied without a refresh token.");
            }
            if (refreshToken != null && refreshToken.isBlank()) {
                throw new IllegalArgumentException("A refresh token, when present, cannot be blank.");
            }
        }

        /** ⚠ Guards against a credential reaching a log through an accidental interpolation. */
        @Override
        public String toString() {
            return "ProviderCredential[REDACTED]";
        }
    }

    /** Reads and decrypts the current material, if any. */
    @Transactional(readOnly = true)
    public Optional<ProviderCredential> load(UUID channelInstanceId) {
        return credentials.findById(channelInstanceId).map(entity -> {
            short version = entity.getEncryptionKeyVersion();
            String access = cipher.decrypt(channelInstanceId, TokenKind.ACCESS_TOKEN,
                    version, entity.getAccessTokenCipher());
            String refresh = entity.getRefreshTokenCipher() == null ? null
                    : cipher.decrypt(channelInstanceId, TokenKind.REFRESH_TOKEN,
                            version, entity.getRefreshTokenCipher());
            return new ProviderCredential(access, entity.getAccessTokenExpiresAt(),
                    refresh, entity.getRefreshTokenExpiresAt());
        });
    }

    /**
     * Stores material obtained by a genuine authorisation — first binding or reauthorisation.
     *
     * <p>⚠ {@code refreshed_at} is CLEARED, because an authorisation is not a silent rotation:
     * the row has never been refreshed since this material was granted.
     */
    @Transactional
    public void put(UUID channelInstanceId, ProviderCredential credential, Instant at) {
        write(channelInstanceId, credential, null, at);
    }

    /**
     * Stores material obtained by a silent token refresh.
     *
     * <p>🔴 This moves {@code refreshed_at} and NOTHING on the Channel Instance. A refresh is
     * mechanical; {@code channel_instance.authorised_at} belongs to an authorisation the
     * operator actually performed ({@code INV-16.15}).
     */
    @Transactional
    public void putRefreshed(UUID channelInstanceId, ProviderCredential credential, Instant at) {
        write(channelInstanceId, credential, at, at);
    }

    private void write(UUID channelInstanceId, ProviderCredential credential,
                       Instant refreshedAt, Instant at) {
        short version = cipher.activeKeyVersion();

        byte[] accessCipher = cipher.encrypt(channelInstanceId, TokenKind.ACCESS_TOKEN,
                version, credential.accessToken());
        byte[] refreshCipher = credential.refreshToken() == null ? null
                : cipher.encrypt(channelInstanceId, TokenKind.REFRESH_TOKEN,
                        version, credential.refreshToken());

        ChannelCredentialEntity entity = credentials.findById(channelInstanceId).orElse(null);
        if (entity == null) {
            entity = ChannelCredentialEntity.of(channelInstanceId, accessCipher, refreshCipher,
                    credential.accessTokenExpiresAt(), credential.refreshTokenExpiresAt(),
                    version, refreshedAt, at);
        } else {
            entity.replaceMaterial(accessCipher, refreshCipher,
                    credential.accessTokenExpiresAt(), credential.refreshTokenExpiresAt(),
                    version, refreshedAt, at);
        }
        credentials.save(entity);
    }

    /**
     * The disconnect primitive: the material is destroyed.
     *
     * <p>🔴 IT DELETES THE CREDENTIAL AND NOTHING ELSE. The Channel Instance, its bound
     * account identity, {@code bound_at} and {@code authorised_at} all survive — that is where
     * the history legitimately lives ({@code INV-16.10}). A revoked token has no business
     * value and keeping it is pure liability, so it is not archived.
     *
     * @return whether material existed to destroy.
     */
    @Transactional
    public boolean delete(UUID channelInstanceId) {
        if (!credentials.existsById(channelInstanceId)) {
            return false;
        }
        credentials.deleteById(channelInstanceId);
        return true;
    }
}
