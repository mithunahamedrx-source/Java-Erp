package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SerializationPolicy;
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
 * {@code E-020} Product Variant — the Inventory Product / Stock Item ({@code PRD-015}).
 *
 * <p>🔴 THERE IS NO STOCK FIELD ON THIS ENTITY, AND THERE NEVER MAY BE. No quantity, no
 * balance, no availability, no valuation, no out-of-stock flag ({@code DB-001},
 * {@code IVN-002}, {@code IVN-055.b}). Those are derived by Inventory and Inventory Costing
 * and composed into a read model — the product is not the stock ledger.
 *
 * <p>🔴 Equally absent, and deliberately: reorder level, minimum/maximum stock, supplier,
 * selling price, margin, tax, tags, image URL. None is canonical for {@code E-020}, so none
 * exists ({@code UX-006}, {@code DOC-024}).
 */
@Entity
@Table(name = "product_variant")
public class ProductVariantEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** {@code PRD-011} — a separate identifier space from the Sellable SKU. */
    @Column(name = "inventory_sku", nullable = false, length = 64)
    private String inventorySku;

    /** {@code PRD-017} — precise and technical, never the market-facing name. */
    @Column(name = "technical_name", nullable = false, length = 255)
    private String technicalName;

    @Column(name = "brand", length = 120)
    private String brand;

    @Column(name = "inventory_category", length = 120)
    private String inventoryCategory;

    @Column(name = "unit_of_measure", nullable = false, length = 32)
    private String unitOfMeasure;

    @Column(name = "barcode", length = 64)
    private String barcode;

    @Enumerated(EnumType.STRING)
    @Column(name = "serialization_policy", nullable = false, length = 24)
    private SerializationPolicy serializationPolicy = SerializationPolicy.NOT_SERIALIZED;

    @Column(name = "component_class", length = 48)
    private String componentClass;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_status", nullable = false, length = 16)
    private RecordStatus recordStatus = RecordStatus.DRAFT;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** {@code AGV-001} — attribution captured at write time. */
    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected ProductVariantEntity() {
        // JPA
    }

    public ProductVariantEntity(UUID id, String inventorySku, String technicalName,
                                String unitOfMeasure, UUID actorId, Instant now) {
        this.id = id;
        this.inventorySku = inventorySku;
        this.technicalName = technicalName;
        this.unitOfMeasure = unitOfMeasure;
        this.createdAt = now;
        this.createdBy = actorId;
        this.updatedAt = now;
        this.updatedBy = actorId;
    }

    /** Records who changed the record and when — never reconstructed afterwards. */
    public void touch(UUID actorId, Instant now) {
        this.updatedBy = actorId;
        this.updatedAt = now;
    }

    public UUID getId() { return id; }
    public String getInventorySku() { return inventorySku; }
    public String getTechnicalName() { return technicalName; }
    public void setTechnicalName(String v) { this.technicalName = v; }
    public String getBrand() { return brand; }
    public void setBrand(String v) { this.brand = v; }
    public String getInventoryCategory() { return inventoryCategory; }
    public void setInventoryCategory(String v) { this.inventoryCategory = v; }
    public String getUnitOfMeasure() { return unitOfMeasure; }
    public void setUnitOfMeasure(String v) { this.unitOfMeasure = v; }
    public String getBarcode() { return barcode; }
    public void setBarcode(String v) { this.barcode = v; }
    public SerializationPolicy getSerializationPolicy() { return serializationPolicy; }
    public void setSerializationPolicy(SerializationPolicy v) { this.serializationPolicy = v; }
    public String getComponentClass() { return componentClass; }
    public void setComponentClass(String v) { this.componentClass = v; }
    public RecordStatus getRecordStatus() { return recordStatus; }
    public void setRecordStatus(RecordStatus v) { this.recordStatus = v; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UUID getUpdatedBy() { return updatedBy; }
    public long getVersion() { return version; }
}
