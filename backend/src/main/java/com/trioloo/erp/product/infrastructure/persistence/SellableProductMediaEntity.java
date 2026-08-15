package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.MediaRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * {@code E-058} master media reference, {@code PRD-168} / {@code INV-58.7}.
 *
 * <p>🔴 At most ONE {@code PRIMARY} per Sellable Product — the database enforces it with a
 * partial unique index so no application path can produce two.
 *
 * <p>🔴 {@code PRIMARY} is OPTIONAL and is never auto-selected ({@code PRD-168.b},
 * {@code PRD-168.c}). Order is EXPLICIT and never inferred from insertion order
 * ({@code PRD-168.d}).
 */
@Entity
@Table(name = "sellable_product_media")
public class SellableProductMediaEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "sellable_product_id", nullable = false)
    private UUID sellableProductId;

    @Column(name = "media_asset_id", nullable = false)
    private UUID mediaAssetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_role", nullable = false, length = 16)
    private MediaRole mediaRole = MediaRole.GALLERY;

    @Column(name = "position", nullable = false)
    private int position;

    protected SellableProductMediaEntity() {
    }

    public SellableProductMediaEntity(UUID id, UUID sellableProductId, UUID mediaAssetId,
                                      MediaRole mediaRole, int position) {
        this.id = id;
        this.sellableProductId = sellableProductId;
        this.mediaAssetId = mediaAssetId;
        this.mediaRole = mediaRole;
        this.position = position;
    }

    public UUID getId() { return id; }
    public UUID getSellableProductId() { return sellableProductId; }
    public UUID getMediaAssetId() { return mediaAssetId; }
    public MediaRole getMediaRole() { return mediaRole; }
    public void setMediaRole(MediaRole v) { mediaRole = v; }
    public int getPosition() { return position; }
    public void setPosition(int v) { position = v; }
}
