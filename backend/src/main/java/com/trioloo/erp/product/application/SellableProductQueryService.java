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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Composes the Sellable Products read model.
 *
 * <p>🔴 Authorisation is enforced HERE, on every entry point ({@code PRM-004},
 * {@code PRD-155}). The frontend hiding a control is an affordance, never a control
 * ({@code PRJ-120}) — an actor reaching this service by URL or by API is refused identically.
 *
 * <p>🔴 OWNERSHIP IS NOT TRANSFERRED BY COMPOSITION ({@code DOC-005}). Product supplies
 * {@code E-058}, {@code E-060}/{@code E-061} and {@code E-063}; Inventory supplies the
 * component positions that {@link SellableAvailabilityService} derives availability from.
 */
@Service
public class SellableProductQueryService {

    private final SellableProductRepository sellables;
    private final BuildTemplateRepository templates;
    private final BomLineRepository bomLines;
    private final BundleMemberRepository bundleMembers;
    private final ProductVariantRepository variants;
    private final SellableAvailabilityService availability;
    private final CurrentActor currentActor;

    public SellableProductQueryService(SellableProductRepository sellables,
                                       BuildTemplateRepository templates,
                                       BomLineRepository bomLines,
                                       BundleMemberRepository bundleMembers,
                                       ProductVariantRepository variants,
                                       SellableAvailabilityService availability,
                                       CurrentActor currentActor) {
        this.sellables = sellables;
        this.templates = templates;
        this.bomLines = bomLines;
        this.bundleMembers = bundleMembers;
        this.variants = variants;
        this.availability = availability;
        this.currentActor = currentActor;
    }

    private Actor requireViewer() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.SELLABLE_PRODUCT_VIEW)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.SELLABLE_PRODUCT_VIEW);
        }
        return actor;
    }

    @Transactional(readOnly = true)
    public Page<SellableProductView> list(SellableProductFilter filter, Pageable pageable) {
        requireViewer();
        Page<SellableProductEntity> found = sellables.search(filter.search(), filter.nature(),
                filter.status(), filter.sellableCategory(), pageable);
        return new PageImpl<>(compose(found.getContent()), pageable, found.getTotalElements());
    }

    /**
     * Every record matching the ACTIVE filters, unpaged.
     *
     * <p>🔴 The basis for the summary and for CSV export. {@code UX-044.b} — pagination is
     * presentation and never defines scope.
     */
    @Transactional(readOnly = true)
    public List<SellableProductView> allMatching(SellableProductFilter filter) {
        requireViewer();
        return compose(sellables.searchAll(filter.search(), filter.nature(), filter.status(),
                filter.sellableCategory()));
    }

    @Transactional(readOnly = true)
    public SellableProductView detail(UUID id) {
        requireViewer();
        SellableProductEntity entity = sellables.findById(id)
                .orElseThrow(() -> new SellableProductNotFoundException(id));
        return compose(List.of(entity)).getFirst();
    }

    /**
     * The five summary values ({@code UX-037}, {@code UX-044.b}).
     *
     * <p>🔴 Counted over the filtered set, never over the visible page, and never read from a
     * stored counter.
     */
    @Transactional(readOnly = true)
    public SellableProductSummary summary(SellableProductFilter filter) {
        requireViewer();
        List<SellableProductEntity> matching = sellables.searchAll(filter.search(), filter.nature(),
                filter.status(), filter.sellableCategory());

        long simple = 0;
        long assembled = 0;
        long bundle = 0;
        long active = 0;
        for (SellableProductEntity e : matching) {
            switch (e.getNature()) {
                case SIMPLE -> simple++;
                case ASSEMBLED -> assembled++;
                case BUNDLE -> bundle++;
            }
            if (e.getRecordStatus() == RecordStatus.ACTIVE) {
                active++;
            }
        }
        return new SellableProductSummary(matching.size(), simple, assembled, bundle, active);
    }

    // ------------------------------------------------------------------ build definition

    /**
     * Every Build Template version of one Sellable Product, newest first.
     *
     * <p>🔴 {@code PRD-068} — {@code SUPERSEDED} versions are INCLUDED. They are retained
     * permanently because As-Built Records reference them, and hiding them from the operator
     * would misrepresent the record.
     */
    @Transactional(readOnly = true)
    public List<BuildTemplateView> buildTemplates(UUID sellableProductId) {
        requireViewer();
        SellableProductEntity product = sellables.findById(sellableProductId)
                .orElseThrow(() -> new SellableProductNotFoundException(sellableProductId));
        if (product.getNature() != SellableNature.ASSEMBLED) {
            // Not an error state — a SIMPLE or BUNDLE product legitimately has none.
            return List.of();
        }

        List<BuildTemplateEntity> versions =
                templates.findBySellableProductIdOrderByVersionNumberDesc(sellableProductId);
        if (versions.isEmpty()) {
            return List.of();
        }

        Map<UUID, List<BomLineEntity>> linesByTemplate = new HashMap<>();
        for (BomLineEntity line : bomLines.findByBuildTemplateIdIn(
                versions.stream().map(BuildTemplateEntity::getId).toList())) {
            linesByTemplate.computeIfAbsent(line.getBuildTemplateId(), k -> new ArrayList<>()).add(line);
        }

        Map<UUID, ProductVariantEntity> variantById = new HashMap<>();
        List<UUID> variantIds = linesByTemplate.values().stream()
                .flatMap(List::stream).map(BomLineEntity::getProductVariantId).distinct().toList();
        for (ProductVariantEntity v : variants.findAllById(variantIds)) {
            variantById.put(v.getId(), v);
        }

        List<BuildTemplateView> views = new ArrayList<>();
        for (BuildTemplateEntity template : versions) {
            List<BomLineView> lines = linesByTemplate.getOrDefault(template.getId(), List.of()).stream()
                    .sorted((a, b) -> Integer.compare(a.getPosition(), b.getPosition()))
                    .map(line -> {
                        ProductVariantEntity v = variantById.get(line.getProductVariantId());
                        return new BomLineView(line.getId(), line.getProductVariantId(),
                                v == null ? null : v.getInventorySku(),
                                v == null ? null : v.getTechnicalName(),
                                v == null ? null : v.getUnitOfMeasure(),
                                line.getQuantityRequired(), line.getComponentRole(),
                                line.isOptional(), line.getSubstitutionGroup(), line.getPosition());
                    })
                    .toList();
            views.add(new BuildTemplateView(template.getId(), template.getVersionNumber(),
                    template.getTemplateStatus(), template.getEffectiveFrom(), template.getEffectiveTo(),
                    template.getAssemblyNotes(), template.getActivatedAt(), template.getActivatedBy(),
                    lines, template.getVersion()));
        }
        return views;
    }

    /** The bundle's members, in their declared order ({@code PRD-021} — an ORDERED list). */
    @Transactional(readOnly = true)
    public List<BundleMemberView> bundleMembers(UUID bundleId) {
        requireViewer();
        SellableProductEntity product = sellables.findById(bundleId)
                .orElseThrow(() -> new SellableProductNotFoundException(bundleId));
        if (product.getNature() != SellableNature.BUNDLE) {
            return List.of();
        }

        List<BundleMemberEntity> members = bundleMembers.findByBundleIdOrderByPositionAsc(bundleId);
        if (members.isEmpty()) {
            return List.of();
        }
        Map<UUID, SellableProductEntity> byId = new HashMap<>();
        for (SellableProductEntity m : sellables.findByIdIn(
                members.stream().map(BundleMemberEntity::getMemberSellableId).toList())) {
            byId.put(m.getId(), m);
        }
        return members.stream().map(member -> {
            SellableProductEntity m = byId.get(member.getMemberSellableId());
            return new BundleMemberView(member.getId(), member.getMemberSellableId(),
                    m == null ? null : m.getSellableSku(), m == null ? null : m.getName(),
                    m == null ? null : m.getNature(), member.getQuantity(), member.isOptional(),
                    member.getPriceAllocationBasis(), member.getPosition());
        }).toList();
    }

    // ------------------------------------------------------------------ composition

    private List<SellableProductView> compose(List<SellableProductEntity> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }

        Map<UUID, SellableAvailability> derived = availability.availabilityFor(entities);

        // Resolution-target labels, each fetched in bulk. No per-row lookup anywhere.
        List<UUID> resolutionTargets = entities.stream()
                .flatMap(e -> java.util.stream.Stream.of(
                        e.getSimpleTargetVariantId(), e.getAssembledFinishedVariantId()))
                .filter(java.util.Objects::nonNull).distinct().toList();
        Map<UUID, ProductVariantEntity> variantById = new HashMap<>();
        for (ProductVariantEntity v : variants.findAllById(resolutionTargets)) {
            variantById.put(v.getId(), v);
        }

        List<UUID> assembledIds = entities.stream()
                .filter(e -> e.getNature() == SellableNature.ASSEMBLED)
                .map(SellableProductEntity::getId).toList();
        Map<UUID, BuildTemplateEntity> activeTemplate = new HashMap<>();
        Map<UUID, Long> requiredLines = new HashMap<>();
        if (!assembledIds.isEmpty()) {
            for (BuildTemplateEntity t : templates.findActiveFor(assembledIds)) {
                activeTemplate.put(t.getSellableProductId(), t);
            }
            for (BomLineEntity line : bomLines.findByBuildTemplateIdIn(
                    activeTemplate.values().stream().map(BuildTemplateEntity::getId).toList())) {
                if (!line.isOptional()) {
                    requiredLines.merge(line.getBuildTemplateId(), 1L, Long::sum);
                }
            }
        }

        List<UUID> bundleIds = entities.stream()
                .filter(e -> e.getNature() == SellableNature.BUNDLE)
                .map(SellableProductEntity::getId).toList();
        Map<UUID, Integer> memberCounts = new HashMap<>();
        if (!bundleIds.isEmpty()) {
            for (BundleMemberEntity m : bundleMembers.findByBundleIdIn(bundleIds)) {
                memberCounts.merge(m.getBundleId(), 1, Integer::sum);
            }
        }

        List<SellableProductView> views = new ArrayList<>(entities.size());
        for (SellableProductEntity e : entities) {
            SellableAvailability a = derived.getOrDefault(e.getId(),
                    SellableAvailability.unresolved("Availability could not be derived."));

            ProductVariantEntity target = e.getSimpleTargetVariantId() == null
                    ? null : variantById.get(e.getSimpleTargetVariantId());
            ProductVariantEntity finished = e.getAssembledFinishedVariantId() == null
                    ? null : variantById.get(e.getAssembledFinishedVariantId());
            BuildTemplateEntity template = activeTemplate.get(e.getId());

            views.add(new SellableProductView(e.getId(), e.getSellableSku(), e.getName(),
                    e.getNature(), e.getDescription(), e.getSellableCategory(),
                    e.getWarrantyPackage(), e.getRecordStatus(),
                    e.getSimpleTargetVariantId(),
                    target == null ? null : target.getInventorySku(),
                    target == null ? null : target.getTechnicalName(),
                    e.getSimpleQuantityPerSaleUnit(),
                    e.getAssembledFinishedVariantId(),
                    finished == null ? null : finished.getInventorySku(),
                    finished == null ? null : finished.getTechnicalName(),
                    template == null ? null : template.getId(),
                    template == null ? null : template.getVersionNumber(),
                    template == null ? null
                            : requiredLines.getOrDefault(template.getId(), 0L).intValue(),
                    e.getNature() == SellableNature.BUNDLE
                            ? memberCounts.getOrDefault(e.getId(), 0) : null,
                    a.sellableUnits(), a.constrainedBy(), a.unresolvedReason(),
                    e.getUpdatedAt(), e.getVersion()));
        }
        return views;
    }

    // ------------------------------------------------------------------ view types

    /** One Build Template version and its lines ({@code E-060} + {@code E-061}). */
    public record BuildTemplateView(UUID id,
                                    int versionNumber,
                                    BuildTemplateStatus status,
                                    Instant effectiveFrom,
                                    Instant effectiveTo,
                                    String assemblyNotes,
                                    Instant activatedAt,
                                    UUID activatedBy,
                                    List<BomLineView> lines,
                                    long version) {
    }

    /** One BOM line, resolved to its {@code E-020} component ({@code INV-61.1}). */
    public record BomLineView(UUID id,
                              UUID productVariantId,
                              String inventorySku,
                              String technicalName,
                              String unitOfMeasure,
                              BigDecimal quantityRequired,
                              String componentRole,
                              boolean optional,
                              String substitutionGroup,
                              int position) {
    }

    /** One bundle member, resolved to its member Sellable Product ({@code INV-63.1}). */
    public record BundleMemberView(UUID id,
                                   UUID memberSellableId,
                                   String memberSellableSku,
                                   String memberName,
                                   SellableNature memberNature,
                                   BigDecimal quantity,
                                   boolean optional,
                                   String priceAllocationBasis,
                                   int position) {
    }
}
