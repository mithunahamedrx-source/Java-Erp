package com.trioloo.erp.product.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * A channel attribute carried by a listing, {@code PRD-192}.
 *
 * <p>🔴 Never Stock Item technical truth ({@code PRD-192.b}). A marketplace attribute is
 * what the channel needs to publish a listing; {@code E-020}'s technical identity is what
 * the business knows about the physical thing, and a channel form field never redefines it.
 *
 * <p>⚠ Deliberately a NEUTRAL key/value pair. The channel-specific schema, requiredness and
 * validation are adapter capability ({@code PRD-192.d}) and are NOT modelled here.
 */
@Entity
@Table(name = "channel_listing_attribute")
public class ChannelListingAttributeEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_listing_id", nullable = false)
    private UUID channelListingId;

    @Column(name = "attribute_key", nullable = false, length = 160)
    private String attributeKey;

    @Column(name = "intended_value", length = 1024)
    private String intendedValue;

    @Column(name = "reported_value", length = 1024)
    private String reportedValue;

    /** {@code API-063.c} — false means the adapter did not return the field at all. */
    @Column(name = "reported_readable", nullable = false)
    private boolean reportedReadable;

    @Column(name = "position", nullable = false)
    private int position;

    protected ChannelListingAttributeEntity() {
    }

    public ChannelListingAttributeEntity(UUID id, UUID channelListingId, String attributeKey,
                                         String intendedValue, int position) {
        this.id = id;
        this.channelListingId = channelListingId;
        this.attributeKey = attributeKey;
        this.intendedValue = intendedValue;
        this.position = position;
    }

    /** {@code PRD-181.a} — inbound readback writes the reported side only. */
    public void applyReported(String value, boolean readable) {
        this.reportedValue = value;
        this.reportedReadable = readable;
    }

    public UUID getId() { return id; }
    public UUID getChannelListingId() { return channelListingId; }
    public String getAttributeKey() { return attributeKey; }
    public String getIntendedValue() { return intendedValue; }
    public void setIntendedValue(String v) { intendedValue = v; }
    public String getReportedValue() { return reportedValue; }
    public boolean isReportedReadable() { return reportedReadable; }
    public int getPosition() { return position; }
    public void setPosition(int v) { position = v; }
}
