package com.trioloo.erp.product.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-059} CHANNEL-REPORTED media, {@code PRD-182} / {@code INV-59.10}.
 *
 * <p>🔴 NOT {@code E-105} Media Asset ({@code PRD-182.b}). Ingesting a marketplace image
 * does not make it Trioloo's authored asset, so this is a MIRRORED EXTERNAL REFERENCE and
 * deliberately holds no media asset identifier.
 *
 * <p>🔴 It never writes into {@code E-058} master media ({@code PRD-182.c}) and never
 * writes into intended media automatically ({@code PRD-182.d}).
 */
@Entity
@Table(name = "channel_listing_reported_media")
public class ChannelListingReportedMediaEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_listing_id", nullable = false)
    private UUID channelListingId;

    @Column(name = "external_reference", nullable = false, length = 1024)
    private String externalReference;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "reported_at", nullable = false)
    private Instant reportedAt;

    protected ChannelListingReportedMediaEntity() {
    }

    public ChannelListingReportedMediaEntity(UUID id, UUID channelListingId,
                                             String externalReference, int position,
                                             Instant reportedAt) {
        this.id = id;
        this.channelListingId = channelListingId;
        this.externalReference = externalReference;
        this.position = position;
        this.reportedAt = reportedAt;
    }

    public UUID getId() { return id; }
    public UUID getChannelListingId() { return channelListingId; }
    public String getExternalReference() { return externalReference; }
    public int getPosition() { return position; }
    public Instant getReportedAt() { return reportedAt; }
}
