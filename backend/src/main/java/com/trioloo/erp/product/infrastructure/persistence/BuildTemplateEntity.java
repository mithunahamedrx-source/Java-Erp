package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.BuildTemplateStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-060} Build Template — the VERSIONED definition of what goes into an
 * {@code ASSEMBLED} Sellable Product ({@code PRD §11.2}).
 *
 * <p>🔴 {@code INV-60.3} / {@code PRD-069} — CHANGING A TEMPLATE CREATES A NEW VERSION. It never
 * edits the {@code ACTIVE} one, because editing in place would rewrite what past units were
 * built from. BOM lines are therefore mutable only while {@link #templateStatus} is
 * {@code DRAFT}.
 *
 * <p>🔴 {@code INV-60.4} / {@code PRD-068} — a superseded version is retained PERMANENTLY. No
 * delete path exists.
 *
 * <p>🔴 {@code PRD-092} — activation is AUDITED. {@link #activatedBy} and {@link #activatedAt}
 * are first-class facts captured when the authoritative act occurs, never reconstructed from
 * logs ({@code AGV-001}).
 */
@Entity
@Table(name = "build_template")
public class BuildTemplateEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "sellable_product_id", nullable = false, updatable = false)
    private UUID sellableProductId;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    /** {@code PRD §11.2} — the effective period. Set when the version is activated. */
    @Column(name = "effective_from")
    private Instant effectiveFrom;

    @Column(name = "effective_to")
    private Instant effectiveTo;

    @Enumerated(EnumType.STRING)
    @Column(name = "template_status", nullable = false, length = 16)
    private BuildTemplateStatus templateStatus = BuildTemplateStatus.DRAFT;

    @Column(name = "assembly_notes")
    private String assemblyNotes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "activated_by")
    private UUID activatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected BuildTemplateEntity() {
        // JPA
    }

    public BuildTemplateEntity(UUID id, UUID sellableProductId, int versionNumber,
                               UUID actorId, Instant now) {
        this.id = id;
        this.sellableProductId = sellableProductId;
        this.versionNumber = versionNumber;
        this.createdAt = now;
        this.createdBy = actorId;
        this.updatedAt = now;
        this.updatedBy = actorId;
    }

    /**
     * {@code DRAFT → ACTIVE}. 🔴 The approval-bearing act of {@code PRD §24}, audited by
     * {@code PRD-092}. Authority is checked by the command service before this is called.
     */
    public void activate(UUID actorId, Instant now) {
        this.templateStatus = BuildTemplateStatus.ACTIVE;
        this.effectiveFrom = now;
        this.activatedAt = now;
        this.activatedBy = actorId;
        touch(actorId, now);
    }

    /** {@code ACTIVE → SUPERSEDED}. 🔴 Retained permanently — never deleted ({@code PRD-068}). */
    public void supersede(UUID actorId, Instant now) {
        this.templateStatus = BuildTemplateStatus.SUPERSEDED;
        this.effectiveTo = now;
        touch(actorId, now);
    }

    public void touch(UUID actorId, Instant now) {
        this.updatedBy = actorId;
        this.updatedAt = now;
    }

    /** 🔴 {@code PRD-069} — content may be authored ONLY while the version is a draft. */
    public boolean isEditable() {
        return templateStatus == BuildTemplateStatus.DRAFT;
    }

    public UUID getId() { return id; }
    public UUID getSellableProductId() { return sellableProductId; }
    public int getVersionNumber() { return versionNumber; }
    public Instant getEffectiveFrom() { return effectiveFrom; }
    public Instant getEffectiveTo() { return effectiveTo; }
    public BuildTemplateStatus getTemplateStatus() { return templateStatus; }
    public String getAssemblyNotes() { return assemblyNotes; }
    public void setAssemblyNotes(String v) { this.assemblyNotes = v; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getActivatedAt() { return activatedAt; }
    public UUID getActivatedBy() { return activatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UUID getUpdatedBy() { return updatedBy; }
    public long getVersion() { return version; }
}
