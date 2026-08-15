package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-058} Sellable Product — the commercial offering an order line refers to
 * ({@code PRD-022}).
 *
 * <p>🔴 {@code INV-58.1} / {@code PRD-003} — THIS ENTITY NEVER HOLDS STOCK, AND NO QUANTITY
 * FIELD MAY EVER BE ADDED. No {@code sellableStock}, no {@code buildableBalance}, no
 * {@code bundleStock}, no {@code availableQuantity}, no {@code readyBuilt}.
 * {@code INV-58.4} / {@code PRD-023}: availability is DERIVED from the resolution target at
 * query time and is never stored, and never taken from a marketplace figure.
 *
 * <p>🔴 Equally absent, and deliberately: channel price ({@code E-059} owns it —
 * {@code PRD-029}, {@code PRD §10.4}), listing count (no canonical counting basis —
 * {@code PRD-150}, {@code UX-037.f}), cost, margin, profit ({@code PRD-123}, {@code GAP-112}),
 * and any image URL ({@code UX-037.g} — image data ownership is not canonical).
 *
 * <p>🔴 {@code INV-58.3} / {@code PRD-070} — {@link #nature} has NO setter. Immutability is
 * expressed in the type, not merely checked in a service.
 */
@Entity
@Table(name = "sellable_product")
public class SellableProductEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** {@code PRD-011} — a SEPARATE identifier space from the Inventory SKU. */
    @Column(name = "sellable_sku", nullable = false, length = 64)
    private String sellableSku;

    /** {@code PRD-017} — MARKET-FACING. Never the technical name. */
    @Column(name = "name", nullable = false, length = 255)
    private String name;

    /**
     * {@code PRD-008}. 🔴 Deliberately {@code updatable = false} AND without a setter — the
     * ORM cannot write it after insert even if a future caller tries.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "nature", nullable = false, length = 16, updatable = false)
    private SellableNature nature;

    @Column(name = "description")
    private String description;

    /** {@code PRD-016} — a SEPARATE tree from the inventory category. */
    @Column(name = "sellable_category", length = 120)
    private String sellableCategory;

    /**
     * {@code PRD-132} — the declared {@code E-070} Warranty Package reference.
     *
     * <p>⚠ Text, not a foreign key: {@code E-070} is not implemented, and creating the entity
     * to satisfy a column would be scope this stage does not carry.
     */
    @Column(name = "warranty_package", length = 120)
    private String warrantyPackage;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_status", nullable = false, length = 16)
    private RecordStatus recordStatus = RecordStatus.DRAFT;

    /** {@code PRD-021} {@code SIMPLE} resolution — a REFERENCE to {@code E-020}, never a copy. */
    @Column(name = "simple_target_variant_id")
    private UUID simpleTargetVariantId;

    @Column(name = "simple_quantity_per_sale_unit", precision = 19, scale = 4)
    private BigDecimal simpleQuantityPerSaleUnit;

    /**
     * PRD-156 ASSEMBLED finished-unit identity: the E-020 variant under which ready-built
     * units are physically held. This is a reference only, never a Product-owned balance.
     */
    @Column(name = "assembled_finished_variant_id", updatable = false)
    private UUID assembledFinishedVariantId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** {@code AGV-001} — attribution captured at write time, never reconstructed. */
    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected SellableProductEntity() {
        // JPA
    }

    public SellableProductEntity(UUID id, String sellableSku, String name, SellableNature nature,
                                 UUID actorId, Instant now) {
        this.id = id;
        this.sellableSku = sellableSku;
        this.name = name;
        this.nature = nature;
        this.createdAt = now;
        this.createdBy = actorId;
        this.updatedAt = now;
        this.updatedBy = actorId;
    }

    public void touch(UUID actorId, Instant now) {
        this.updatedBy = actorId;
        this.updatedAt = now;
    }

    public UUID getId() { return id; }
    public String getSellableSku() { return sellableSku; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }

    /** 🔴 {@code PRD-070} — read only. There is deliberately no {@code setNature}. */
    public SellableNature getNature() { return nature; }

    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public String getSellableCategory() { return sellableCategory; }
    public void setSellableCategory(String v) { this.sellableCategory = v; }
    public String getWarrantyPackage() { return warrantyPackage; }
    public void setWarrantyPackage(String v) { this.warrantyPackage = v; }
    public RecordStatus getRecordStatus() { return recordStatus; }
    public void setRecordStatus(RecordStatus v) { this.recordStatus = v; }
    public UUID getSimpleTargetVariantId() { return simpleTargetVariantId; }
    public void setSimpleTargetVariantId(UUID v) { this.simpleTargetVariantId = v; }
    public BigDecimal getSimpleQuantityPerSaleUnit() { return simpleQuantityPerSaleUnit; }
    public void setSimpleQuantityPerSaleUnit(BigDecimal v) { this.simpleQuantityPerSaleUnit = v; }
    public UUID getAssembledFinishedVariantId() { return assembledFinishedVariantId; }
    public void setAssembledFinishedVariantId(UUID v) { this.assembledFinishedVariantId = v; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UUID getUpdatedBy() { return updatedBy; }
    public long getVersion() { return version; }
}
