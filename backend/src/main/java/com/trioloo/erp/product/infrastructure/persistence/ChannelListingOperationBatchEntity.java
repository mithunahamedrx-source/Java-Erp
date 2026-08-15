package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.OperationKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-108} Channel Listing Operation Batch — the grouping of {@code E-107} records
 * produced by one requested bulk operation ({@code PRD-186}, {@code DM-083}).
 *
 * <p>🔴 {@code INV-108.1} — a batch is NOT atomic across an external party. Partial success
 * is the NORMAL outcome, not an anomaly. {@code API-060}'s atomic commit governs a LOCAL
 * file import and does not extend here.
 *
 * <p>🔴 {@code INV-108.2} — the aggregate outcome is DERIVED from its members and is NEVER
 * stored ({@code DB-001}). There is deliberately no succeeded/failed counter below.
 *
 * <p>🔴 {@code INV-108.4} — the scope is an EXPLICIT selection. A batch never expands itself
 * to sibling listings sharing a Sellable Product.
 */
@Entity
@Table(name = "channel_listing_operation_batch")
public class ChannelListingOperationBatchEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_kind", nullable = false, length = 32)
    private OperationKind operationKind;

    @Column(name = "requested_by", nullable = false, updatable = false)
    private UUID requestedBy;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private Instant requestedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "scope_description", length = 600)
    private String scopeDescription;

    protected ChannelListingOperationBatchEntity() {
    }

    public ChannelListingOperationBatchEntity(UUID id, OperationKind operationKind,
                                              String scopeDescription, UUID actorId,
                                              Instant now) {
        this.id = id;
        this.operationKind = operationKind;
        this.scopeDescription = scopeDescription;
        this.requestedBy = actorId;
        this.requestedAt = now;
    }

    public void complete(Instant now) {
        this.completedAt = now;
    }

    public UUID getId() { return id; }
    public OperationKind getOperationKind() { return operationKind; }
    public UUID getRequestedBy() { return requestedBy; }
    public Instant getRequestedAt() { return requestedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public String getScopeDescription() { return scopeDescription; }
}
