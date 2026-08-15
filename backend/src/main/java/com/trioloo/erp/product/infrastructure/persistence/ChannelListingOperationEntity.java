package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.OperationDirection;
import com.trioloo.erp.product.domain.OperationKind;
import com.trioloo.erp.product.domain.OperationOutcome;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-107} Channel Listing Operation — one requested remote act against ONE listing,
 * and its outcome ({@code PRD-186}, {@code DM-083}).
 *
 * <p>🔴 {@code INV-107.1} — one record per listing per requested act. Per-listing outcomes
 * are retained individually and are NEVER collapsed into an aggregate.
 *
 * <p>🔴 {@code INV-107.2} — a failed sibling never makes a succeeded record appear failed.
 *
 * <p>🔴 {@code INV-107.4} — this never carries or duplicates the SYSTEM-owned listing sync
 * state ({@code SYS §7.1}, {@code PRD-185.d}). An operation is an ATTEMPT WITH AN OUTCOME;
 * the sync state is the listing's standing position relative to the channel.
 *
 * <p>🔴 {@code INV-107.5} — attribution is captured at write time and is never reconstructed
 * ({@code PRJ-130}, {@code INV-77.1}).
 */
@Entity
@Table(name = "channel_listing_operation")
public class ChannelListingOperationEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_listing_id", nullable = false, updatable = false)
    private UUID channelListingId;

    @Column(name = "batch_id", updatable = false)
    private UUID batchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_kind", nullable = false, length = 32)
    private OperationKind operationKind;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 16)
    private OperationDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 24)
    private OperationOutcome outcome = OperationOutcome.REQUESTED;

    /** The operator-facing reason. 🔴 Never a generic failure string ({@code PRJ-200}). */
    @Column(name = "detail", length = 1200)
    private String detail;

    /** {@code SYS-046} / {@code API-029} — what the adapter reported, from whom, when. */
    @Column(name = "adapter_provenance", length = 1200)
    private String adapterProvenance;

    @Column(name = "requested_by", nullable = false, updatable = false)
    private UUID requestedBy;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private Instant requestedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected ChannelListingOperationEntity() {
    }

    public ChannelListingOperationEntity(UUID id, UUID channelListingId, UUID batchId,
                                         OperationKind operationKind,
                                         OperationDirection direction,
                                         UUID actorId, Instant now) {
        this.id = id;
        this.channelListingId = channelListingId;
        this.batchId = batchId;
        this.operationKind = operationKind;
        this.direction = direction;
        this.requestedBy = actorId;
        this.requestedAt = now;
    }

    /** Records a terminal outcome for this listing alone ({@code INV-107.2}). */
    public void settle(OperationOutcome outcome, String detail, String provenance, Instant now) {
        this.outcome = outcome;
        this.detail = detail;
        this.adapterProvenance = provenance;
        this.completedAt = now;
    }

    public UUID getId() { return id; }
    public UUID getChannelListingId() { return channelListingId; }
    public UUID getBatchId() { return batchId; }
    public OperationKind getOperationKind() { return operationKind; }
    public OperationDirection getDirection() { return direction; }
    public OperationOutcome getOutcome() { return outcome; }
    public String getDetail() { return detail; }
    public String getAdapterProvenance() { return adapterProvenance; }
    public UUID getRequestedBy() { return requestedBy; }
    public Instant getRequestedAt() { return requestedAt; }
    public Instant getCompletedAt() { return completedAt; }
}
