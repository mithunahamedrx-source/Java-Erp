package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.RecordStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** E-016 Channel Instance registered reference, consumed by E-059. */
@Entity
@Table(name = "channel_instance")
public class ChannelInstanceEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", nullable = false, length = 80)
    private String code;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "channel_type", nullable = false, length = 80)
    private String channelType;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_status", nullable = false, length = 16)
    private RecordStatus recordStatus;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ChannelInstanceEntity() {
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getChannelType() { return channelType; }
    public RecordStatus getRecordStatus() { return recordStatus; }
}
