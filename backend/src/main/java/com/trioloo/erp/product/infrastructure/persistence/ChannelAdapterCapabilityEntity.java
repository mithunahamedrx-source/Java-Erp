package com.trioloo.erp.product.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * Adapter capability declared per channel instance, per field and per direction
 * ({@code PRD-125}, {@code API-063}).
 *
 * <p>⚠ Capability is NEVER a property of a channel TYPE. "All Daraz shops behave alike" is
 * exactly the universal statement {@code PRD-125} refuses: two shops on the same
 * marketplace may declare different field support.
 *
 * <p>🔴 An ABSENT row means the capability is UNDECLARED — not that it is supported. A field
 * the adapter cannot write is {@code MANUAL_REQUIRED}, a normal state, not a failure
 * ({@code SYS-025}, {@code API-063.b}).
 */
@Entity
@Table(name = "channel_adapter_capability")
public class ChannelAdapterCapabilityEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_instance_id", nullable = false)
    private UUID channelInstanceId;

    @Column(name = "field_key", nullable = false, length = 80)
    private String fieldKey;

    @Column(name = "readable", nullable = false)
    private boolean readable;

    @Column(name = "writable", nullable = false)
    private boolean writable;

    protected ChannelAdapterCapabilityEntity() {
    }

    public ChannelAdapterCapabilityEntity(UUID id, UUID channelInstanceId, String fieldKey,
                                          boolean readable, boolean writable) {
        this.id = id;
        this.channelInstanceId = channelInstanceId;
        this.fieldKey = fieldKey;
        this.readable = readable;
        this.writable = writable;
    }

    public UUID getId() { return id; }
    public UUID getChannelInstanceId() { return channelInstanceId; }
    public String getFieldKey() { return fieldKey; }
    public boolean isReadable() { return readable; }
    public void setReadable(boolean v) { readable = v; }
    public boolean isWritable() { return writable; }
    public void setWritable(boolean v) { writable = v; }
}
