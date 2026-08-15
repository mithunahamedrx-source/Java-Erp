package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.ActivityKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A listing's activity history entry, {@code PRD-129} as extended by {@code PRD-186.e}.
 *
 * <p>Three kinds share one chronology: a local {@code FIELD_CHANGE} with before/after, a
 * {@code CHANNEL_EVENT} with NO before value, and an {@code OPERATION} — a requested act
 * with an outcome, which is neither of the other two.
 *
 * <p>✅ An ACTIVITY log, not an audit log ({@code AUD-001}, {@code INV-107.3}). It replaces
 * no audit obligation ({@code PRD-095}, {@code AUD §12.2}).
 */
@Entity
@Table(name = "channel_listing_activity")
public class ChannelListingActivityEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_listing_id", nullable = false, updatable = false)
    private UUID channelListingId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_kind", nullable = false, length = 20)
    private ActivityKind entryKind;

    @Column(name = "summary", nullable = false, length = 600)
    private String summary;

    @Column(name = "field_key", length = 120)
    private String fieldKey;

    @Column(name = "before_value", length = 1024)
    private String beforeValue;

    @Column(name = "after_value", length = 1024)
    private String afterValue;

    @Column(name = "source", length = 160)
    private String source;

    /** NULL means the marketplace or the scheduler acted, not a person. */
    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "operation_id")
    private UUID operationId;

    @Column(name = "batch_id")
    private UUID batchId;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected ChannelListingActivityEntity() {
    }

    public ChannelListingActivityEntity(UUID id, UUID channelListingId, ActivityKind entryKind,
                                        String summary, String source, UUID actorId,
                                        Instant occurredAt) {
        this.id = id;
        this.channelListingId = channelListingId;
        this.entryKind = entryKind;
        this.summary = summary;
        this.source = source;
        this.actorId = actorId;
        this.occurredAt = occurredAt;
    }

    /** Attaches before/after detail to a {@code FIELD_CHANGE} entry ({@code DB-068}). */
    public ChannelListingActivityEntity withChange(String fieldKey, String before, String after) {
        this.fieldKey = fieldKey;
        this.beforeValue = before;
        this.afterValue = after;
        return this;
    }

    /** Links an {@code OPERATION} entry to the record that produced it. */
    public ChannelListingActivityEntity withOperation(UUID operationId, UUID batchId) {
        this.operationId = operationId;
        this.batchId = batchId;
        return this;
    }

    public UUID getId() { return id; }
    public UUID getChannelListingId() { return channelListingId; }
    public ActivityKind getEntryKind() { return entryKind; }
    public String getSummary() { return summary; }
    public String getFieldKey() { return fieldKey; }
    public String getBeforeValue() { return beforeValue; }
    public String getAfterValue() { return afterValue; }
    public String getSource() { return source; }
    public UUID getActorId() { return actorId; }
    public UUID getOperationId() { return operationId; }
    public UUID getBatchId() { return batchId; }
    public Instant getOccurredAt() { return occurredAt; }
}
