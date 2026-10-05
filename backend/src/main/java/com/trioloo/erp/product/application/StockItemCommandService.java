package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SerializationPolicy;
import com.trioloo.erp.product.infrastructure.persistence.BuildTemplateRepository;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantEntity;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Create and update Stock Items.
 *
 * <p>🔴 Every entry point requires {@code product.stock-item.manage} ({@code PRD-154},
 * {@code PRM-004}). Holding {@code view} never implies {@code manage}, and neither implies
 * valuation visibility.
 *
 * <p>🔴 NO STOCK IS EVER WRITTEN HERE. Creating or editing a Stock Item creates no movement,
 * no balance and no opening position ({@code DB-001}, {@code IVN-002}). {@code GAP-109}
 * remains untouched.
 */
@Service
public class StockItemCommandService {

    private final ProductVariantRepository variants;
    private final BuildTemplateRepository buildTemplates;
    private final CurrentActor currentActor;
    private final Clock clock;

    public StockItemCommandService(ProductVariantRepository variants,
                                   BuildTemplateRepository buildTemplates,
                                   CurrentActor currentActor, Clock clock) {
        this.variants = variants;
        this.buildTemplates = buildTemplates;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    private Actor requireManager() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.STOCK_ITEM_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.STOCK_ITEM_MANAGE);
        }
        return actor;
    }

    @Transactional
    public UUID create(StockItemInput input) {
        Actor actor = requireManager();
        return createInternal(input, actor.id(), Instant.now(clock));
    }

    /** Shared with CSV import so one code path enforces the same rules for both entry points. */
    UUID createInternal(StockItemInput input, UUID actorId, Instant now) {
        validate(input, true);
        guardReferenceCost(input);

        // PRD-013 - a retired SKU is never reissued, so uniqueness is checked against every
        // record regardless of lifecycle state, archived ones included.
        if (variants.existsByInventorySkuIgnoreCase(input.inventorySku())) {
            throw new StockItemValidationException("inventory_sku",
                    "Inventory SKU '" + input.inventorySku() + "' already exists. A SKU is never reissued (PRD-013).");
        }

        ProductVariantEntity entity = new ProductVariantEntity(UUID.randomUUID(),
                input.inventorySku().trim(), input.technicalName().trim(),
                input.unitOfMeasure().trim(), actorId, now);
        apply(entity, input);
        applyCostAndMark(entity, input, actorId, now);
        entity.setRecordStatus(input.recordStatus() == null ? RecordStatus.DRAFT : input.recordStatus());
        return variants.save(entity).getId();
    }

    @Transactional
    public void update(UUID id, StockItemInput input, Long expectedVersion) {
        Actor actor = requireManager();
        updateInternal(id, input, expectedVersion, actor.id(), Instant.now(clock));
    }

    void updateInternal(UUID id, StockItemInput input, Long expectedVersion, UUID actorId, Instant now) {
        validate(input, false);
        guardReferenceCost(input);
        ProductVariantEntity entity = variants.findById(id)
                .orElseThrow(() -> new StockItemNotFoundException(id));

        if (expectedVersion != null && entity.getVersion() != expectedVersion) {
            throw new StockItemValidationException("version",
                    "This Stock Item was changed by someone else. Reload and try again.");
        }

        // 🔴 The Inventory SKU is identity. PRD-011 and PRD-013 make it stable and never
        // reissued, so an update may not rewrite it - that would silently repoint every
        // historical reference. An import attempting it is an error, not a change (PRD-152.e).
        if (input.inventorySku() != null
                && !input.inventorySku().trim().equalsIgnoreCase(entity.getInventorySku())) {
            throw new StockItemValidationException("inventory_sku",
                    "Inventory SKU is immutable (PRD-011, PRD-013). Create a new Stock Item instead.");
        }

        apply(entity, input);
        applyCostAndMark(entity, input, actorId, now);
        if (input.recordStatus() != null) {
            guardArchival(entity, input.recordStatus());
            entity.setRecordStatus(input.recordStatus());
        }
        entity.touch(actorId, now);
        variants.save(entity);
    }

    /**
     * {@code PRD-065} — an Inventory Product cannot be archived while any ACTIVE Build Template
     * references it.
     *
     * <p>⚠ Added in Stage P2, when {@code E-060} first made the rule violable. It was
     * unenforceable rather than unwritten before: with no Build Template persistence there was
     * nothing to check against. 🔴 Enforced HERE rather than in the sellable layer, because
     * {@code E-020}'s lifecycle is a Stock Item concern and the refusal must reach every entry
     * point that can archive one, CSV import included.
     */
    private void guardArchival(ProductVariantEntity entity, RecordStatus requested) {
        if (requested != RecordStatus.ARCHIVED || entity.getRecordStatus() == RecordStatus.ARCHIVED) {
            return;
        }
        long activeUses = buildTemplates.countActiveUsesOfVariant(entity.getId());
        if (activeUses > 0) {
            throw new StockItemValidationException("record_status",
                    "'" + entity.getInventorySku() + "' cannot be archived: it is a component on "
                            + activeUses + " ACTIVE Build Template version(s) (PRD-065). Supersede "
                            + "those versions first.");
        }
    }

    /**
     * {@code PRD-206} — setting a reference cost is a cost-sensitive act: it needs
     * {@code inventory-costing.valuation.view} as well as {@code manage}. A person who may not see cost may not
     * write it either. Checked here so CSV import and the REST surface share one rule.
     */
    private void guardReferenceCost(StockItemInput input) {
        if (input.referenceCost() == null) {
            return;
        }
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.VALUATION_VIEW)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.VALUATION_VIEW);
        }
        if (input.referenceCost().signum() < 0) {
            throw new StockItemValidationException("reference_cost", "Reference cost cannot be negative.");
        }
        if (input.referenceCost().stripTrailingZeros().scale() > 4) {
            throw new StockItemValidationException("reference_cost",
                    "Reference cost holds at most 4 decimal places; it is never rounded for you (DB-079).");
        }
        if (input.referenceCost().precision() - input.referenceCost().scale() > 15) {
            throw new StockItemValidationException("reference_cost", "Reference cost is too large.");
        }
    }

    private void applyCostAndMark(ProductVariantEntity entity, StockItemInput input, UUID actorId, Instant now) {
        if (input.referenceCost() != null) {
            entity.setReferenceCost(input.referenceCost());
        }
        if (input.discontinued() != null) {
            entity.markDiscontinued(input.discontinued(), actorId, now);
        }
    }

    private void apply(ProductVariantEntity entity, StockItemInput input) {
        if (input.technicalName() != null) {
            entity.setTechnicalName(input.technicalName().trim());
        }
        if (input.unitOfMeasure() != null) {
            entity.setUnitOfMeasure(input.unitOfMeasure().trim());
        }
        entity.setBrand(trimToNull(input.brand()));
        entity.setInventoryCategory(trimToNull(input.inventoryCategory()));
        entity.setBarcode(trimToNull(input.barcode()));
        entity.setComponentClass(trimToNull(input.componentClass()));
        if (input.serializationPolicy() != null) {
            entity.setSerializationPolicy(input.serializationPolicy());
        }
    }

    private void validate(StockItemInput input, boolean creating) {
        if (creating) {
            requireText(input.inventorySku(), "inventory_sku", "Inventory SKU is required.");
            requireText(input.technicalName(), "technical_name", "Technical name is required.");
            requireText(input.unitOfMeasure(), "unit_of_measure", "Unit of measure is required.");
        } else {
            if (input.technicalName() != null && input.technicalName().isBlank()) {
                throw new StockItemValidationException("technical_name", "Technical name cannot be blank.");
            }
            if (input.unitOfMeasure() != null && input.unitOfMeasure().isBlank()) {
                throw new StockItemValidationException("unit_of_measure", "Unit of measure cannot be blank.");
            }
        }
    }

    private void requireText(String value, String field, String message) {
        if (value == null || value.isBlank()) {
            throw new StockItemValidationException(field, message);
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * The mutable Stock Item fields, and only those.
     *
     * <p>🔴 There is no quantity, valuation, supplier, price or reorder field here. The one cost-like
     * field is {@code referenceCost} ({@code PRD-206}): a figure the owner types, null meaning UNCHANGED.
     * {@code discontinued} ({@code PRD-207}) likewise: null means unchanged.
     */
    public record StockItemInput(String inventorySku,
                                 String technicalName,
                                 String brand,
                                 String inventoryCategory,
                                 String unitOfMeasure,
                                 String barcode,
                                 SerializationPolicy serializationPolicy,
                                 String componentClass,
                                 RecordStatus recordStatus,
                                 java.math.BigDecimal referenceCost,
                                 Boolean discontinued) {

        /** The original nine-field shape - neither cost nor discontinued mark is touched. */
        public StockItemInput(String inventorySku, String technicalName, String brand, String inventoryCategory,
                              String unitOfMeasure, String barcode, SerializationPolicy serializationPolicy,
                              String componentClass, RecordStatus recordStatus) {
            this(inventorySku, technicalName, brand, inventoryCategory, unitOfMeasure, barcode,
                    serializationPolicy, componentClass, recordStatus, null, null);
        }
    }
}
