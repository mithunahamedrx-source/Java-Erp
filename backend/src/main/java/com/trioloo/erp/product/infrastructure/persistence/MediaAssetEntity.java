package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.MediaLifecycle;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-105} Media Asset — reusable authored COMMERCIAL media, Product-owned
 * ({@code DM-082}).
 *
 * <p>🔴 {@code INV-105.1} — this is NOT {@code E-054} Attachment and is never used as
 * evidence. The boundary is PURPOSE, not file type: an image is not evidence merely
 * because it is an image.
 *
 * <p>🔴 {@code INV-105.5} — carries no storage technology, provider or URL scheme as a
 * business fact. The storage reference IDENTIFIES the media and nothing more
 * ({@code TEC-105}).
 *
 * <p>🔴 {@code INV-105.6} — holds NO role and NO order. Both belong to the REFERENCE, so
 * one asset may be PRIMARY for one product and GALLERY for another.
 */
@Entity
@Table(name = "media_asset")
public class MediaAssetEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "storage_reference", nullable = false, length = 1024)
    private String storageReference;

    @Column(name = "media_type", length = 120)
    private String mediaType;

    @Column(name = "descriptive_text", length = 400)
    private String descriptiveText;

    @Enumerated(EnumType.STRING)
    @Column(name = "lifecycle_status", nullable = false, length = 16)
    private MediaLifecycle lifecycleStatus = MediaLifecycle.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    protected MediaAssetEntity() {
    }

    public MediaAssetEntity(UUID id, String storageReference, String mediaType,
                            String descriptiveText, UUID actorId, Instant now) {
        this.id = id;
        this.storageReference = storageReference;
        this.mediaType = mediaType;
        this.descriptiveText = descriptiveText;
        this.createdAt = now;
        this.createdBy = actorId;
    }

    /**
     * {@code PRD-169.b} / {@code INV-105.3} — archived, never deleted. There is deliberately
     * no delete path on this entity.
     */
    public void archive() {
        lifecycleStatus = MediaLifecycle.ARCHIVED;
    }

    public UUID getId() { return id; }
    public String getStorageReference() { return storageReference; }
    public String getMediaType() { return mediaType; }
    public String getDescriptiveText() { return descriptiveText; }
    public void setDescriptiveText(String v) { descriptiveText = v; }
    public MediaLifecycle getLifecycleStatus() { return lifecycleStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getCreatedBy() { return createdBy; }
}
