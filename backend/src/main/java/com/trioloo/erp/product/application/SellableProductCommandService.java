package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.BuildTemplateStatus;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import com.trioloo.erp.product.infrastructure.persistence.BomLineEntity;
import com.trioloo.erp.product.infrastructure.persistence.BomLineRepository;
import com.trioloo.erp.product.infrastructure.persistence.BuildTemplateEntity;
import com.trioloo.erp.product.infrastructure.persistence.BuildTemplateRepository;
import com.trioloo.erp.product.infrastructure.persistence.BundleMemberEntity;
import com.trioloo.erp.product.infrastructure.persistence.BundleMemberRepository;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantEntity;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantRepository;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductEntity;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Create and update Sellable Products, author reusable build definitions, and author bundle
 * membership.
 *
 * <p>🔴 Every entry point requires {@code product.sellable-product.manage} ({@code PRD-155},
 * {@code PRM-004}) — EXCEPT {@link #activateBuildTemplate}, which requires
 * {@code product.build-template.activate} because {@code PRD §24} puts activation on its own
 * row and {@code PRD-147.d} insists it is a distinct act.
 *
 * <p>🔴 NO STOCK IS EVER WRITTEN HERE. Creating a Sellable Product, activating a template or
 * defining a bundle creates no movement, no balance, no opening position and no finished unit
 * ({@code DB-001}, {@code IVN-002}). Defining a bundle in particular is a CATALOGUE act, never
 * a physical one.
 */
@Service
public class SellableProductCommandService {

    private final SellableProductRepository sellables;
    private final BuildTemplateRepository templates;
    private final BomLineRepository bomLines;
    private final BundleMemberRepository bundleMembers;
    private final ProductVariantRepository variants;
    private final CurrentActor currentActor;
    private final Clock clock;

    public SellableProductCommandService(SellableProductRepository sellables,
                                         BuildTemplateRepository templates,
                                         BomLineRepository bomLines,
                                         BundleMemberRepository bundleMembers,
                                         ProductVariantRepository variants,
                                         CurrentActor currentActor,
                                         Clock clock) {
        this.sellables = sellables;
        this.templates = templates;
        this.bomLines = bomLines;
        this.bundleMembers = bundleMembers;
        this.variants = variants;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    private Actor requireManager() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.SELLABLE_PRODUCT_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.SELLABLE_PRODUCT_MANAGE);
        }
        return actor;
    }

    // ================================================================== E-058

    @Transactional
    public UUID create(SellableProductInput input) {
        Actor actor = requireManager();
        return createInternal(input, actor.id(), Instant.now(clock));
    }

    /** Shared with CSV import so ONE code path enforces the same rules for both entry points. */
    UUID createInternal(SellableProductInput input, UUID actorId, Instant now) {
        requireText(input.sellableSku(), "sellable_sku", "Sellable SKU is required.");
        requireText(input.name(), "name", "Name is required.");
        if (input.nature() == null) {
            throw new SellableProductValidationException("nature",
                    "Nature is required and must be SIMPLE, ASSEMBLED or BUNDLE (PRD-008).");
        }

        // PRD-013's discipline applied to the sellable identifier space: uniqueness is
        // unconditional and survives archival, so a retired SKU is never reissued.
        if (sellables.existsBySellableSkuIgnoreCase(input.sellableSku().trim())) {
            throw new SellableProductValidationException("sellable_sku",
                    "Sellable SKU '" + input.sellableSku().trim() + "' already exists.");
        }

        SellableProductEntity entity = new SellableProductEntity(UUID.randomUUID(),
                input.sellableSku().trim(), input.name().trim(), input.nature(), actorId, now);

        applyCommonFields(entity, input);
        applyResolutionTarget(entity, input, true);
        entity.setRecordStatus(input.recordStatus() == null ? RecordStatus.DRAFT : input.recordStatus());
        guardLifecycle(entity);
        return sellables.save(entity).getId();
    }

    @Transactional
    public void update(UUID id, SellableProductInput input, Long expectedVersion) {
        Actor actor = requireManager();
        updateInternal(id, input, expectedVersion, actor.id(), Instant.now(clock));
    }

    void updateInternal(UUID id, SellableProductInput input, Long expectedVersion,
                        UUID actorId, Instant now) {
        SellableProductEntity entity = sellables.findById(id)
                .orElseThrow(() -> new SellableProductNotFoundException(id));

        if (expectedVersion != null && entity.getVersion() != expectedVersion) {
            throw new SellableProductValidationException("version",
                    "This Sellable Product was changed by someone else. Reload and try again.");
        }

        // 🔴 INV-58.3 / PRD-070 — NATURE IS IMMUTABLE. A SIMPLE product does not become
        // ASSEMBLED; that is a NEW product, because its cost basis, availability derivation,
        // warranty model and return handling all change. An attempt is an ERROR, never a
        // silent rewrite (PRD-150.a, PRD-152.e).
        if (input.nature() != null && input.nature() != entity.getNature()) {
            throw new SellableProductValidationException("nature",
                    "Nature is immutable (PRD-070). '" + entity.getSellableSku() + "' is "
                            + entity.getNature() + " and cannot become " + input.nature()
                            + ". Create a new Sellable Product instead.");
        }

        // The Sellable SKU is identity. Rewriting it would silently repoint every historical
        // reference (PRD-011, PRD-013).
        if (input.sellableSku() != null
                && !input.sellableSku().trim().equalsIgnoreCase(entity.getSellableSku())) {
            throw new SellableProductValidationException("sellable_sku",
                    "Sellable SKU is immutable (PRD-011). Create a new Sellable Product instead.");
        }

        if (input.name() != null) {
            if (input.name().isBlank()) {
                throw new SellableProductValidationException("name", "Name cannot be blank.");
            }
            entity.setName(input.name().trim());
        }
        applyCommonFields(entity, input);
        applyResolutionTarget(entity, input, false);
        if (input.recordStatus() != null) {
            entity.setRecordStatus(input.recordStatus());
        }
        guardLifecycle(entity);
        entity.touch(actorId, now);
        sellables.save(entity);
    }

    private void applyCommonFields(SellableProductEntity entity, SellableProductInput input) {
        entity.setDescription(trimToNull(input.description()));
        entity.setSellableCategory(trimToNull(input.sellableCategory()));
        entity.setWarrantyPackage(trimToNull(input.warrantyPackage()));
    }

    /**
     * {@code INV-58.2} / {@code PRD-080} — the resolution target must be CONSISTENT with the
     * declared nature, and {@code PRD-021} gives each nature exactly one mechanism.
     *
     * <p>🔴 An {@code ASSEMBLED} or {@code BUNDLE} product may never carry a SIMPLE target: that
     * would give it two resolution mechanisms, which {@code PRD-021} forbids.
     */
    private void applyResolutionTarget(SellableProductEntity entity, SellableProductInput input,
                                       boolean creating) {
        if (entity.getNature() == SellableNature.SIMPLE) {
            if (input.assembledFinishedInventorySku() != null) {
                throw new SellableProductValidationException("assembled_finished_inventory_sku",
                        "Only an ASSEMBLED Sellable Product has a finished Stock Item identity "
                                + "(PRD-156). " + entity.getSellableSku() + " is SIMPLE.");
            }
            if (input.simpleTargetInventorySku() != null) {
                String sku = input.simpleTargetInventorySku().trim();
                // 🔴 PRD-056 / PRD-146 — EXPLICIT resolution by stable identifier. Title text may
                // rank and suggest; it may never identify. There is no fuzzy match here.
                ProductVariantEntity variant = variants.findByInventorySkuIgnoreCase(sku)
                        .orElseThrow(() -> new SellableProductValidationException(
                                "simple_target_inventory_sku",
                                "No Stock Item with Inventory SKU '" + sku + "'. The mapping must resolve "
                                        + "explicitly; a name is never identity (PRD-056)."));
                entity.setSimpleTargetVariantId(variant.getId());
            }
            if (input.simpleQuantityPerSaleUnit() != null) {
                if (input.simpleQuantityPerSaleUnit().signum() <= 0) {
                    throw new SellableProductValidationException("simple_quantity_per_sale_unit",
                            "Quantity per sale unit must be positive.");
                }
                entity.setSimpleQuantityPerSaleUnit(input.simpleQuantityPerSaleUnit());
            } else if (creating) {
                // PRD-150 marks it create-required for SIMPLE. One unit is not assumed.
                throw new SellableProductValidationException("simple_quantity_per_sale_unit",
                        "A SIMPLE Sellable Product requires simple_quantity_per_sale_unit (PRD-021).");
            }

            if (creating && entity.getSimpleTargetVariantId() == null) {
                throw new SellableProductValidationException("simple_target_inventory_sku",
                        "A SIMPLE Sellable Product requires an explicit Stock Item mapping (PRD-021).");
            }
            return;
        }

        if (entity.getNature() == SellableNature.ASSEMBLED) {
            if (input.simpleTargetInventorySku() != null || input.simpleQuantityPerSaleUnit() != null) {
                throw new SellableProductValidationException("simple_target_inventory_sku",
                        "Only a SIMPLE Sellable Product resolves to a Stock Item (PRD-021). "
                                + entity.getSellableSku() + " is " + entity.getNature() + ".");
            }
            entity.setSimpleTargetVariantId(null);
            entity.setSimpleQuantityPerSaleUnit(null);
            if (input.assembledFinishedInventorySku() != null) {
                String sku = input.assembledFinishedInventorySku().trim();
                ProductVariantEntity variant = variants.findByInventorySkuIgnoreCase(sku)
                        .orElseThrow(() -> new SellableProductValidationException(
                                "assembled_finished_inventory_sku",
                                "No Stock Item with Inventory SKU '" + sku + "'. The ASSEMBLED finished "
                                        + "variant must resolve explicitly (PRD-156)."));
                if (!creating && entity.getAssembledFinishedVariantId() != null
                        && !entity.getAssembledFinishedVariantId().equals(variant.getId())) {
                    throw new SellableProductValidationException("assembled_finished_inventory_sku",
                            "The ASSEMBLED finished Stock Item identity is immutable (PRD-161). "
                                    + "Create a new Sellable Product instead.");
                }
                entity.setAssembledFinishedVariantId(variant.getId());
            } else if (creating) {
                throw new SellableProductValidationException("assembled_finished_inventory_sku",
                        "An ASSEMBLED Sellable Product requires assembled_finished_inventory_sku "
                                + "(PRD-156).");
            }
            return;
        }

        if (input.simpleTargetInventorySku() != null || input.simpleQuantityPerSaleUnit() != null) {
            throw new SellableProductValidationException("simple_target_inventory_sku",
                    "Only a SIMPLE Sellable Product resolves to a Stock Item (PRD-021). "
                            + entity.getSellableSku() + " is BUNDLE.");
        }
        if (input.assembledFinishedInventorySku() != null) {
            throw new SellableProductValidationException("assembled_finished_inventory_sku",
                    "Only an ASSEMBLED Sellable Product has a finished Stock Item identity "
                            + "(PRD-156). " + entity.getSellableSku() + " is BUNDLE.");
        }
        entity.setSimpleTargetVariantId(null);
        entity.setSimpleQuantityPerSaleUnit(null);
        entity.setAssembledFinishedVariantId(null);
    }

    /**
     * {@code PRD-081} / {@code INV-58.5} and {@code PRD-021}, enforced at the point they become
     * meaningful.
     *
     * <p>⚠ The invariants are checked when a product enters {@code ACTIVE} rather than at
     * creation, because a resolution target cannot exist before the record it belongs to. An
     * {@code ASSEMBLED} product must be created before its Build Template can reference it, and
     * {@code SYS §7.1}'s own {@code DRAFT → ACTIVE: approved} transition is exactly where a
     * record stops being a work in progress. 🔴 This places a canonical rule; it does not
     * weaken one — a {@code DRAFT} product is not sellable and no order line may reach it.
     */
    private void guardLifecycle(SellableProductEntity entity) {
        if (entity.getRecordStatus() != RecordStatus.ACTIVE) {
            return;
        }
        switch (entity.getNature()) {
            case ASSEMBLED -> {
                if (entity.getAssembledFinishedVariantId() == null) {
                    throw new SellableProductValidationException("record_status",
                            "An ASSEMBLED Sellable Product must resolve to its finished Stock Item "
                                    + "identity before it can become ACTIVE (PRD-156).");
                }
                if (templates.findBySellableProductIdAndTemplateStatus(
                        entity.getId(), BuildTemplateStatus.ACTIVE).isEmpty()) {
                    throw new SellableProductValidationException("record_status",
                            "An ASSEMBLED Sellable Product must reference exactly one ACTIVE Build "
                                    + "Template version before it can become ACTIVE (PRD-081).");
                }
            }
            case BUNDLE -> {
                boolean hasRequiredMember = bundleMembers.findByBundleIdOrderByPositionAsc(entity.getId())
                        .stream().anyMatch(m -> !m.isOptional());
                if (!hasRequiredMember) {
                    throw new SellableProductValidationException("record_status",
                            "A BUNDLE must have at least one required member before it can become "
                                    + "ACTIVE (PRD-021, PRD-047).");
                }
            }
            case SIMPLE -> {
                if (entity.getSimpleTargetVariantId() == null) {
                    throw new SellableProductValidationException("record_status",
                            "A SIMPLE Sellable Product must resolve to a Stock Item (PRD-021).");
                }
            }
        }
    }

    // ================================================================== E-060 / E-061

    /**
     * Creates the next {@code DRAFT} Build Template version.
     *
     * <p>🔴 {@code PRD-069} — a change is ALWAYS a new version. There is no path that edits an
     * {@code ACTIVE} version, because editing in place would rewrite what past units were built
     * from. An existing draft is returned rather than a second one created, so a product never
     * accumulates parallel drafts.
     */
    @Transactional
    public UUID createDraftBuildTemplate(UUID sellableProductId) {
        Actor actor = requireManager();
        SellableProductEntity product = sellables.findById(sellableProductId)
                .orElseThrow(() -> new SellableProductNotFoundException(sellableProductId));
        if (product.getNature() != SellableNature.ASSEMBLED) {
            throw new SellableProductValidationException("nature",
                    "Only an ASSEMBLED Sellable Product has a Build Template (PRD-021).");
        }

        Optional<BuildTemplateEntity> existingDraft = templates
                .findBySellableProductIdOrderByVersionNumberDesc(sellableProductId).stream()
                .filter(t -> t.getTemplateStatus() == BuildTemplateStatus.DRAFT)
                .findFirst();
        if (existingDraft.isPresent()) {
            return existingDraft.get().getId();
        }

        Instant now = Instant.now(clock);
        int next = templates.highestVersionNumber(sellableProductId) + 1;
        BuildTemplateEntity draft = new BuildTemplateEntity(UUID.randomUUID(), sellableProductId,
                next, actor.id(), now);
        return templates.save(draft).getId();
    }

    /** Adds one {@code E-061} line. 🔴 Only to a {@code DRAFT} version ({@code PRD-069}). */
    @Transactional
    public UUID addBomLine(UUID templateId, BomLineInput input) {
        Actor actor = requireManager();
        BuildTemplateEntity template = editableTemplate(templateId);

        requireText(input.inventorySku(), "inventory_sku", "A component Inventory SKU is required.");
        if (input.quantityRequired() == null || input.quantityRequired().signum() <= 0) {
            throw new SellableProductValidationException("quantity_required",
                    "Quantity required must be positive (INV-61.2).");
        }

        // 🔴 INV-61.1 / PRD-032 — a BOM line references a PRODUCT VARIANT, never a Sellable
        // Product. Resolution is against the Inventory SKU space only, so a Sellable SKU
        // simply does not resolve here.
        ProductVariantEntity variant = variants.findByInventorySkuIgnoreCase(input.inventorySku().trim())
                .orElseThrow(() -> new SellableProductValidationException("inventory_sku",
                        "No Stock Item with Inventory SKU '" + input.inventorySku().trim()
                                + "'. A BOM line references a physical component (PRD-032)."));

        // INV-61.3 — a template references an ACTIVE variant.
        if (variant.getRecordStatus() != RecordStatus.ACTIVE) {
            throw new SellableProductValidationException("inventory_sku",
                    "Stock Item '" + variant.getInventorySku() + "' is " + variant.getRecordStatus()
                            + ". A BOM line must reference an ACTIVE Stock Item (INV-61.3).");
        }

        List<BomLineEntity> existing = bomLines.findByBuildTemplateIdOrderByPositionAsc(templateId);
        if (existing.stream().anyMatch(l -> l.getProductVariantId().equals(variant.getId()))) {
            throw new SellableProductValidationException("inventory_sku",
                    "'" + variant.getInventorySku() + "' is already a line on this version. "
                            + "Change its quantity instead of adding it twice.");
        }

        BomLineEntity line = new BomLineEntity(UUID.randomUUID(), templateId, variant.getId(),
                input.quantityRequired());
        line.setComponentRole(trimToNull(input.componentRole()));
        line.setOptional(input.optional());
        line.setSubstitutionGroup(trimToNull(input.substitutionGroup()));
        line.setPosition(existing.size());
        UUID id = bomLines.save(line).getId();
        template.touch(actor.id(), Instant.now(clock));
        templates.save(template);
        return id;
    }

    /** Removes one line from a {@code DRAFT} version. */
    @Transactional
    public void removeBomLine(UUID templateId, UUID lineId) {
        Actor actor = requireManager();
        BuildTemplateEntity template = editableTemplate(templateId);
        BomLineEntity line = bomLines.findById(lineId)
                .orElseThrow(() -> new SellableProductValidationException("line", "No such BOM line."));
        if (!line.getBuildTemplateId().equals(templateId)) {
            throw new SellableProductValidationException("line",
                    "That BOM line belongs to a different Build Template version.");
        }
        bomLines.delete(line);
        template.touch(actor.id(), Instant.now(clock));
        templates.save(template);
    }

    /**
     * {@code DRAFT → ACTIVE}, superseding the version it replaces.
     *
     * <p>🔴 REQUIRES {@code product.build-template.activate}, NOT {@code manage}
     * ({@code PRD-155}). {@code PRD §24} places activation on its own row because its blast
     * radius is every future build, and {@code PRD-147.d} keeps it a distinct act.
     *
     * <p>🔴 {@code PRD-092} — activation is audited through first-class attribution captured
     * here, never reconstructed from logs. ⚠ NO approval-request record, approver assignment or
     * two-step state is created: {@code PRD-147.c} ruled the act needs no additional business
     * capability, and inventing a workflow would be {@code UX-006}.
     */
    @Transactional
    public void activateBuildTemplate(UUID templateId) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.BUILD_TEMPLATE_ACTIVATE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.BUILD_TEMPLATE_ACTIVATE);
        }

        BuildTemplateEntity draft = templates.findById(templateId)
                .orElseThrow(() -> new SellableProductValidationException("template",
                        "No such Build Template version."));
        if (draft.getTemplateStatus() != BuildTemplateStatus.DRAFT) {
            throw new SellableProductValidationException("template",
                    "Only a DRAFT version can be activated. This one is " + draft.getTemplateStatus()
                            + ", and a version is never reactivated (PRD-068, PRD-069).");
        }

        // INV-60.2 / PRD-082 — a template must contain at least one non-optional BOM line.
        if (bomLines.countByBuildTemplateIdAndOptionalFalse(templateId) == 0) {
            throw new SellableProductValidationException("template",
                    "A Build Template version must contain at least one required (non-optional) "
                            + "BOM line before it can be activated (PRD-082, INV-60.2).");
        }

        Instant now = Instant.now(clock);

        // INV-60.1 / PRD-067 — exactly ONE ACTIVE version per Sellable Product. The previous
        // one is SUPERSEDED, never deleted: As-Built Records reference it (PRD-068).
        templates.findBySellableProductIdAndTemplateStatus(
                        draft.getSellableProductId(), BuildTemplateStatus.ACTIVE)
                .ifPresent(current -> {
                    current.supersede(actor.id(), now);
                    templates.saveAndFlush(current);
                });

        draft.activate(actor.id(), now);
        templates.save(draft);
    }

    private BuildTemplateEntity editableTemplate(UUID templateId) {
        BuildTemplateEntity template = templates.findById(templateId)
                .orElseThrow(() -> new SellableProductValidationException("template",
                        "No such Build Template version."));
        if (!template.isEditable()) {
            throw new SellableProductValidationException("template",
                    "Version " + template.getVersionNumber() + " is " + template.getTemplateStatus()
                            + " and cannot be edited. Changing a template creates a NEW version "
                            + "(PRD-069).");
        }
        return template;
    }

    // ================================================================== E-063

    /**
     * Adds one bundle member.
     *
     * <p>🔴 {@code PRD-048} / {@code INV-63.2} — NO MEMBER IS ITSELF A BUNDLE. One level only,
     * which is what keeps availability derivation and pricing from exploding combinatorially.
     */
    @Transactional
    public UUID addBundleMember(UUID bundleId, BundleMemberInput input) {
        Actor actor = requireManager();
        SellableProductEntity bundle = sellables.findById(bundleId)
                .orElseThrow(() -> new SellableProductNotFoundException(bundleId));
        if (bundle.getNature() != SellableNature.BUNDLE) {
            throw new SellableProductValidationException("nature",
                    "Only a BUNDLE Sellable Product has members (PRD-021).");
        }
        requireText(input.memberSellableSku(), "member_sellable_sku", "A member Sellable SKU is required.");
        if (input.quantity() == null || input.quantity().signum() <= 0) {
            throw new SellableProductValidationException("quantity", "Member quantity must be positive.");
        }

        SellableProductEntity member = sellables
                .findBySellableSkuIgnoreCase(input.memberSellableSku().trim())
                .orElseThrow(() -> new SellableProductValidationException("member_sellable_sku",
                        "No Sellable Product with SKU '" + input.memberSellableSku().trim() + "'."));

        if (member.getId().equals(bundleId)) {
            throw new SellableProductValidationException("member_sellable_sku",
                    "A bundle cannot contain itself.");
        }
        if (member.getNature() == SellableNature.BUNDLE) {
            throw new SellableProductValidationException("member_sellable_sku",
                    "'" + member.getSellableSku() + "' is a BUNDLE. Bundle nesting is limited to one "
                            + "level (PRD-048).");
        }

        List<BundleMemberEntity> existing = bundleMembers.findByBundleIdOrderByPositionAsc(bundleId);
        if (existing.stream().anyMatch(m -> m.getMemberSellableId().equals(member.getId()))) {
            throw new SellableProductValidationException("member_sellable_sku",
                    "'" + member.getSellableSku() + "' is already a member. Change its quantity "
                            + "instead of adding it twice.");
        }

        BundleMemberEntity entity = new BundleMemberEntity(UUID.randomUUID(), bundleId,
                member.getId(), input.quantity());
        entity.setOptional(input.optional());
        entity.setPriceAllocationBasis(trimToNull(input.priceAllocationBasis()));
        entity.setPosition(existing.size());
        UUID id = bundleMembers.save(entity).getId();
        bundle.touch(actor.id(), Instant.now(clock));
        sellables.save(bundle);
        return id;
    }

    @Transactional
    public void removeBundleMember(UUID bundleId, UUID memberId) {
        Actor actor = requireManager();
        SellableProductEntity bundle = sellables.findById(bundleId)
                .orElseThrow(() -> new SellableProductNotFoundException(bundleId));
        BundleMemberEntity member = bundleMembers.findById(memberId)
                .orElseThrow(() -> new SellableProductValidationException("member", "No such member."));
        if (!member.getBundleId().equals(bundleId)) {
            throw new SellableProductValidationException("member",
                    "That member belongs to a different bundle.");
        }
        bundleMembers.delete(member);
        bundle.touch(actor.id(), Instant.now(clock));
        sellables.save(bundle);
    }

    // ------------------------------------------------------------------ helpers

    private static void requireText(String value, String field, String message) {
        if (value == null || value.isBlank()) {
            throw new SellableProductValidationException(field, message);
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    // ------------------------------------------------------------------ inputs

    /**
     * The mutable Sellable Product fields, and only those.
     *
     * <p>🔴 There is no price, cost, margin, stock, availability or listing field here, and
     * there never may be. A client cannot ask this service to write any of them, because the
     * request has nowhere to put them.
     */
    public record SellableProductInput(String sellableSku,
                                       String name,
                                       SellableNature nature,
                                       String description,
                                       String sellableCategory,
                                       String warrantyPackage,
                                       RecordStatus recordStatus,
                                       String simpleTargetInventorySku,
                                       BigDecimal simpleQuantityPerSaleUnit,
                                       String assembledFinishedInventorySku) {
    }

    /** One {@code E-061} line. 🔴 Identified by INVENTORY SKU — a physical component. */
    public record BomLineInput(String inventorySku,
                               BigDecimal quantityRequired,
                               String componentRole,
                               boolean optional,
                               String substitutionGroup) {
    }

    /** One {@code E-063} member. 🔴 Identified by SELLABLE SKU — members are Sellable Products. */
    public record BundleMemberInput(String memberSellableSku,
                                    BigDecimal quantity,
                                    boolean optional,
                                    String priceAllocationBasis) {
    }
}
