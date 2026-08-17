package com.trioloo.erp.integration.infrastructure.persistence;

import com.trioloo.erp.integration.domain.ConnectionState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code API-068} — the stored connection condition of one Channel Instance.
 *
 * <p>🔴 A ROW EXISTS ONLY ONCE SOMETHING REAL HAS HAPPENED. Registering a shop writes
 * nothing here; absence means never authorised, which is exactly {@code NOT_CONNECTED}. No
 * fabricated connection fact is ever created.
 *
 * <p>🔴 NO CREDENTIAL COLUMN EXISTS AND NONE MAY BE ADDED ({@code API-070}).
 */
@Entity
@Table(name = "channel_connection")
public class ChannelConnectionEntity {

    @Id
    @Column(name = "channel_instance_id", nullable = false, updatable = false)
    private UUID channelInstanceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 24)
    private ConnectionState state;

    /**
     * 🔴 {@code SCS-042.a} — when the condition was last ACTUALLY OBSERVED. Written only by
     * a genuine observation; a page load never reaches this column.
     */
    @Column(name = "last_checked_at")
    private Instant lastCheckedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ChannelConnectionEntity() {
    }

    public static ChannelConnectionEntity observed(UUID channelInstanceId, ConnectionState state,
                                                   Instant observedAt) {
        ChannelConnectionEntity entity = new ChannelConnectionEntity();
        entity.channelInstanceId = channelInstanceId;
        entity.state = state;
        entity.lastCheckedAt = observedAt;
        entity.updatedAt = observedAt;
        return entity;
    }

    public UUID getChannelInstanceId() { return channelInstanceId; }
    public ConnectionState getState() { return state; }
    public Instant getLastCheckedAt() { return lastCheckedAt; }

    /** Records a genuine observation. 🔴 The only path that moves {@link #lastCheckedAt}. */
    public void observe(ConnectionState newState, Instant observedAt) {
        this.state = newState;
        this.lastCheckedAt = observedAt;
        this.updatedAt = observedAt;
    }
}
