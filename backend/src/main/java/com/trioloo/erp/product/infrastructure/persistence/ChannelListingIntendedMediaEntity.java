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
 * {@code E-059} INTENDED listing media, {@code PRD-170} / {@code INV-59.6}.
 *
 * <p>🔴 An ALL-OR-NOTHING override set ({@code PRD-170.d}). Where no row exists for a
 * listing the effective media DERIVES from the mapped Sellable Product.
 *
 * <p>🔴 The fallback is NEVER materialised here ({@code PRD-170.b}) — copying master rows
 * would make a fallback indistinguishable from a deliberate override the moment the
 * master changed.
 */
@Entity
@Table(name = "channel_listing_intended_media")
public class ChannelListingIntendedMediaEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_listing_id", nullable = false)
    private UUID channelListingId;

    @Column(name = "media_asset_id", nullable = false)
    private UUID mediaAssetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_role", nullable = false, length = 16)
    private MediaRole mediaRole = MediaRole.GALLERY;

    @Column(name = "position", nullable = false)
    private int position;

    protected ChannelListingIntendedMediaEntity() {
    }

    public ChannelListingIntendedMediaEntity(UUID id, UUID channelListingId, UUID mediaAssetId,
                                             MediaRole mediaRole, int position) {
        this.id = id;
        this.channelListingId = channelListingId;
        this.mediaAssetId = mediaAssetId;
        this.mediaRole = mediaRole;
        this.position = position;
    }

    public UUID getId() { return id; }
    public UUID getChannelListingId() { return channelListingId; }
    public UUID getMediaAssetId() { return mediaAssetId; }
    public MediaRole getMediaRole() { return mediaRole; }
    public void setMediaRole(MediaRole v) { mediaRole = v; }
    public int getPosition() { return position; }
    public void setPosition(int v) { position = v; }
}
