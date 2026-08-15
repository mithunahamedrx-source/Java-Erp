package com.trioloo.erp.product.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * {@code E-061} BOM Line — one component requirement within a template version
 * ({@code PRD §11.3}).
 *
 * <p>🔴 {@code INV-61.1} / {@code PRD-032} — {@link #productVariantId} references a PRODUCT
 * VARIANT, never a Sellable Product. A build consumes physical things; a Sellable Product
 * composed of other Sellable Products is a BUNDLE, not an assembly.
 *
 * <p>🔴 {@code PRD-034} — SINGLE LEVEL. There is deliberately no field here that could point at
 * another Build Template, so a multi-level BOM is unrepresentable rather than merely
 * discouraged.
 *
 * <p>{@code PRD-033} — {@link #optional} is a property of the LINE. An optional line does not
 * constrain buildability: the base configuration is buildable without it.
 */
@Entity
@Table(name = "bom_line")
public class BomLineEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "build_template_id", nullable = false, updatable = false)
    private UUID buildTemplateId;

    @Column(name = "product_variant_id", nullable = false)
    private UUID productVariantId;

    /** {@code INV-61.2} — positive, in the component's unit of measure ({@code DB-040}). */
    @Column(name = "quantity_required", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantityRequired;

    /**
     * {@code PRD §11.3} — {@code Processor}, {@code Motherboard}, {@code RAM} and the rest.
     *
     * <p>⚠ Free text rather than an enum: canon presents those nine as EXAMPLES of component
     * role, and closing the set would be an invention ({@code UX-006}).
     */
    @Column(name = "component_role", length = 64)
    private String componentRole;

    @Column(name = "optional", nullable = false)
    private boolean optional;

    /** {@code E-064} is ADVISORY and unimplemented; the declared group name is carried as text. */
    @Column(name = "substitution_group", length = 120)
    private String substitutionGroup;

    @Column(name = "position", nullable = false)
    private int position;

    protected BomLineEntity() {
        // JPA
    }

    public BomLineEntity(UUID id, UUID buildTemplateId, UUID productVariantId,
                         BigDecimal quantityRequired) {
        this.id = id;
        this.buildTemplateId = buildTemplateId;
        this.productVariantId = productVariantId;
        this.quantityRequired = quantityRequired;
    }

    public UUID getId() { return id; }
    public UUID getBuildTemplateId() { return buildTemplateId; }
    public UUID getProductVariantId() { return productVariantId; }
    public void setProductVariantId(UUID v) { this.productVariantId = v; }
    public BigDecimal getQuantityRequired() { return quantityRequired; }
    public void setQuantityRequired(BigDecimal v) { this.quantityRequired = v; }
    public String getComponentRole() { return componentRole; }
    public void setComponentRole(String v) { this.componentRole = v; }
    public boolean isOptional() { return optional; }
    public void setOptional(boolean v) { this.optional = v; }
    public String getSubstitutionGroup() { return substitutionGroup; }
    public void setSubstitutionGroup(String v) { this.substitutionGroup = v; }
    public int getPosition() { return position; }
    public void setPosition(int v) { this.position = v; }
}
