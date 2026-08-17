package com.trioloo.erp.integration.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One authorisation redirect, awaiting its callback.
 *
 * <p>🔴 THIS ROW — NOT THE CALLBACK — DECIDES WHICH SHOP WAS AUTHORISED. The Channel Instance
 * is written when the operator starts the flow, so a callback that arrives with a substituted
 * or invented shop parameter cannot steer a successful authorisation onto a different shop.
 * The callback proves only that it holds the state; this row says what that state was for.
 *
 * <p>🔴 THE NONCE ITSELF IS NEVER STORED — only its SHA-256. Someone holding a database backup
 * therefore cannot reconstruct the value the provider will return and forge a callback with it.
 */
@Entity
@Table(name = "channel_authorisation_attempt")
public class ChannelAuthorisationAttemptEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "state_token_hash", nullable = false, updatable = false)
    private byte[] stateTokenHash;

    @Column(name = "channel_instance_id", nullable = false, updatable = false)
    private UUID channelInstanceId;

    @Column(name = "initiated_by", nullable = false, updatable = false)
    private UUID initiatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    /** 🔴 NULL = not yet consumed. The one-time semantic lives in this column. */
    @Column(name = "consumed_at")
    private Instant consumedAt;

    protected ChannelAuthorisationAttemptEntity() {
    }

    public static ChannelAuthorisationAttemptEntity issued(UUID id,
                                                           byte[] stateTokenHash,
                                                           UUID channelInstanceId,
                                                           UUID initiatedBy,
                                                           Instant createdAt,
                                                           Instant expiresAt) {
        if (stateTokenHash == null || stateTokenHash.length != 32) {
            throw new IllegalArgumentException("The state token hash must be a 32-byte SHA-256 digest.");
        }
        if (!expiresAt.isAfter(createdAt)) {
            throw new IllegalArgumentException("An authorisation attempt must expire after it is created.");
        }
        ChannelAuthorisationAttemptEntity entity = new ChannelAuthorisationAttemptEntity();
        entity.id = id;
        entity.stateTokenHash = stateTokenHash;
        entity.channelInstanceId = channelInstanceId;
        entity.initiatedBy = initiatedBy;
        entity.createdAt = createdAt;
        entity.expiresAt = expiresAt;
        entity.consumedAt = null;
        return entity;
    }

    public UUID getId() { return id; }
    public byte[] getStateTokenHash() { return stateTokenHash; }
    public UUID getChannelInstanceId() { return channelInstanceId; }
    public UUID getInitiatedBy() { return initiatedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getConsumedAt() { return consumedAt; }
}
