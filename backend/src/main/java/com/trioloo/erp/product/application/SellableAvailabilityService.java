package com.trioloo.erp.product.application;

import com.trioloo.erp.inventory.application.StockPosition;
import com.trioloo.erp.inventory.application.StockPositionQuery;
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
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Derives sellable availability from the resolution target — {@code PRD-023}, {@code PRD-024}.
 *
 * <h2>The three derivations, transcribed rather than designed</h2>
 * <ul>
 *   <li>{@code SIMPLE} — mapped Inventory Product available ÷ quantity per sale unit</li>
 *   <li>{@code ASSEMBLED} — the MINIMUM, across all BOM lines, of
 *       (component available ÷ quantity required)</li>
 *   <li>{@code BUNDLE} — the minimum across member availabilities ÷ member quantities</li>
 * </ul>
 *
 * <p>🔴 {@code PRD-024} — the derivation accounts for RESERVATIONS, not merely stock on hand.
 * It consumes {@link StockPosition#available()}, which is physical minus active reservations,
 * so components already committed to other orders are correctly unavailable.
 *
 * <p>{@code PRD-033} — an OPTIONAL BOM line does not constrain buildability. The base
 * configuration is buildable without it, so optional lines are excluded from the minimum.
 * Optional bundle members are treated the same way.
 *
 * <h2>ASSEMBLED is ready-built plus buildable</h2>
 *
 * <p>{@code PRD-156} identifies the finished {@code E-020} variant for ready-built units, and
 * {@code PRD-159} combines that Inventory available quantity with the existing BOM-derived
 * buildable term. Creating or linking that finished variant creates no stock; with no
 * movements, the ready-built term is truthfully zero.
 *
 * <h2>🔴 Nothing here is persisted</h2>
 * <p>No balance, no cache, no {@code sellable_stock}, no {@code buildable_balance}
 * ({@code INV-58.1}, {@code INV-58.4}, {@code DB-001}, {@code IVN-002}).
 */
@Service
public class SellableAvailabilityService {

    private final SellableProductRepository sellables;
    private final BuildTemplateRepository templates;
    private final BomLineRepository bomLines;
    private final BundleMemberRepository bundleMembers;
    private final ProductVariantRepository variants;
    private final StockPositionQuery positions;

    public SellableAvailabilityService(SellableProductRepository sellables,
                                       BuildTemplateRepository templates,
                                       BomLineRepository bomLines,
                                       BundleMemberRepository bundleMembers,
                                       ProductVariantRepository variants,
                                       StockPositionQuery positions) {
        this.sellables = sellables;
        this.templates = templates;
        this.bomLines = bomLines;
        this.bundleMembers = bundleMembers;
        this.variants = variants;
        this.positions = positions;
    }

    /**
     * Availability for a whole page of Sellable Products.
     *
     * <p>Bulk by construction: templates, lines, members, member products and stock positions
     * are each fetched once for the entire set, so a page of any size costs a fixed number of
     * round trips. There is no per-row lookup and therefore no N+1.
     */
    @Transactional(readOnly = true)
    public Map<UUID, SellableAvailability> availabilityFor(List<SellableProductEntity> subjects) {
        if (subjects.isEmpty()) {
            return Map.of();
        }

        // ---------------------------------------------------------------- gather
        // PRD-048 bounds this at ONE level: a member is never itself a bundle, so resolving
        // members can never recurse and no cycle is possible.
        Map<UUID, SellableProductEntity> known = new LinkedHashMap<>();
        for (SellableProductEntity subject : subjects) {
            known.put(subject.getId(), subject);
        }

        List<UUID> bundleIds = subjects.stream()
                .filter(s -> s.getNature() == SellableNature.BUNDLE)
                .map(SellableProductEntity::getId)
                .toList();

        Map<UUID, List<BundleMemberEntity>> membersByBundle = new HashMap<>();
        if (!bundleIds.isEmpty()) {
            for (BundleMemberEntity member : bundleMembers.findByBundleIdIn(bundleIds)) {
                membersByBundle.computeIfAbsent(member.getBundleId(), k -> new ArrayList<>()).add(member);
            }
        }

        // Members may not be in the requested page; they still need resolving.
        List<UUID> missingMembers = membersByBundle.values().stream()
                .flatMap(List::stream)
                .map(BundleMemberEntity::getMemberSellableId)
                .filter(id -> !known.containsKey(id))
                .distinct()
                .toList();
        if (!missingMembers.isEmpty()) {
            for (SellableProductEntity member : sellables.findByIdIn(missingMembers)) {
                known.put(member.getId(), member);
            }
        }

        List<UUID> assembledIds = known.values().stream()
                .filter(s -> s.getNature() == SellableNature.ASSEMBLED)
                .map(SellableProductEntity::getId)
                .toList();

        Map<UUID, BuildTemplateEntity> activeTemplateBySellable = new HashMap<>();
        if (!assembledIds.isEmpty()) {
            for (BuildTemplateEntity template : templates.findActiveFor(assembledIds)) {
                activeTemplateBySellable.put(template.getSellableProductId(), template);
            }
        }

        Map<UUID, List<BomLineEntity>> linesByTemplate = new HashMap<>();
        List<UUID> templateIds = activeTemplateBySellable.values().stream()
                .map(BuildTemplateEntity::getId).toList();
        if (!templateIds.isEmpty()) {
            for (BomLineEntity line : bomLines.findByBuildTemplateIdIn(templateIds)) {
                linesByTemplate.computeIfAbsent(line.getBuildTemplateId(), k -> new ArrayList<>()).add(line);
            }
        }

        // Every physical component this derivation touches, resolved in one position query.
        Set<UUID> variantIds = new HashSet<>();
        for (SellableProductEntity s : known.values()) {
            if (s.getSimpleTargetVariantId() != null) {
                variantIds.add(s.getSimpleTargetVariantId());
            }
            if (s.getAssembledFinishedVariantId() != null) {
                variantIds.add(s.getAssembledFinishedVariantId());
            }
        }
        linesByTemplate.values().forEach(lines ->
                lines.forEach(line -> variantIds.add(line.getProductVariantId())));

        Map<UUID, StockPosition> stock = variantIds.isEmpty()
                ? Map.of() : positions.positionsFor(variantIds);
        Map<UUID, String> variantLabel = new HashMap<>();
        if (!variantIds.isEmpty()) {
            for (ProductVariantEntity v : variants.findAllById(variantIds)) {
                variantLabel.put(v.getId(), v.getInventorySku());
            }
        }

        // ------------------------------------------------- pass 1: SIMPLE and ASSEMBLED
        Map<UUID, SellableAvailability> resolved = new HashMap<>();
        for (SellableProductEntity s : known.values()) {
            switch (s.getNature()) {
                case SIMPLE -> resolved.put(s.getId(), simpleAvailability(s, stock, variantLabel));
                case ASSEMBLED -> resolved.put(s.getId(), assembledAvailability(
                        s, activeTemplateBySellable, linesByTemplate, stock, variantLabel));
                case BUNDLE -> { /* pass 2 — it depends on its members. */ }
            }
        }

        // ------------------------------------------------------------ pass 2: BUNDLE
        for (UUID bundleId : bundleIds) {
            resolved.put(bundleId, bundleAvailability(
                    membersByBundle.getOrDefault(bundleId, List.of()), known, resolved));
        }

        // Only the subjects asked for are returned; members resolved along the way are working
        // state, not results.
        Map<UUID, SellableAvailability> answer = new LinkedHashMap<>();
        for (SellableProductEntity subject : subjects) {
            answer.put(subject.getId(), resolved.getOrDefault(subject.getId(),
                    SellableAvailability.unresolved("Availability could not be derived.")));
        }
        return answer;
    }

    /** {@code PRD-023} — mapped Inventory Product available ÷ quantity per sale unit. */
    private SellableAvailability simpleAvailability(SellableProductEntity product,
                                                    Map<UUID, StockPosition> stock,
                                                    Map<UUID, String> variantLabel) {
        UUID variantId = product.getSimpleTargetVariantId();
        BigDecimal perUnit = product.getSimpleQuantityPerSaleUnit();
        if (variantId == null || perUnit == null || perUnit.signum() <= 0) {
            return SellableAvailability.unresolved(
                    "No Stock Item is mapped, so availability cannot be derived (PRD-021).");
        }
        StockPosition position = stock.getOrDefault(variantId, StockPosition.empty(variantId));
        return SellableAvailability.of(saleUnits(position.available(), perUnit),
                variantLabel.get(variantId));
    }

    /**
     * {@code PRD-159} - ASSEMBLED availability is the finished variant ready-built Inventory
     * available quantity plus the BOM-derived buildable term from {@code PRD-023}.
     */
    private SellableAvailability assembledAvailability(SellableProductEntity product,
                                                       Map<UUID, BuildTemplateEntity> activeTemplates,
                                                       Map<UUID, List<BomLineEntity>> linesByTemplate,
                                                       Map<UUID, StockPosition> stock,
                                                       Map<UUID, String> variantLabel) {
        BuildTemplateEntity template = activeTemplates.get(product.getId());
        UUID finishedVariantId = product.getAssembledFinishedVariantId();
        if (finishedVariantId == null) {
            return SellableAvailability.unresolved(
                    "No finished Stock Item is mapped, so availability cannot be derived (PRD-156).");
        }
        if (template == null) {
            // 🔴 NOT ZERO. PRD-081 requires an ACTIVE version; without one the product has no
            // resolution target at all, which is a different statement from "none buildable".
            return SellableAvailability.unresolved(
                    "No ACTIVE Build Template version, so availability cannot be derived (PRD-081).");
        }

        List<BomLineEntity> lines = linesByTemplate.getOrDefault(template.getId(), List.of()).stream()
                // PRD-033 — an optional line does not constrain buildability.
                .filter(line -> !line.isOptional())
                .toList();
        if (lines.isEmpty()) {
            return SellableAvailability.unresolved(
                    "Build Template v" + template.getVersionNumber()
                            + " has no required component lines (INV-60.2).");
        }

        BigDecimal minimum = null;
        String constrainedBy = null;
        for (BomLineEntity line : lines) {
            StockPosition position = stock.getOrDefault(line.getProductVariantId(),
                    StockPosition.empty(line.getProductVariantId()));
            BigDecimal buildable = saleUnits(position.available(), line.getQuantityRequired());
            if (minimum == null || buildable.compareTo(minimum) < 0) {
                minimum = buildable;
                constrainedBy = variantLabel.get(line.getProductVariantId());
            }
        }
        BigDecimal readyBuilt = stock.getOrDefault(finishedVariantId,
                StockPosition.empty(finishedVariantId)).available();
        return SellableAvailability.of(readyBuilt.add(minimum),
                readyBuilt.signum() > 0 ? variantLabel.get(finishedVariantId) : constrainedBy);
    }

    /** {@code PRD-023}, {@code PRD-049} — the minimum across members ÷ member quantities. */
    private SellableAvailability bundleAvailability(List<BundleMemberEntity> members,
                                                    Map<UUID, SellableProductEntity> known,
                                                    Map<UUID, SellableAvailability> resolved) {
        List<BundleMemberEntity> required = members.stream().filter(m -> !m.isOptional()).toList();
        if (required.isEmpty()) {
            return SellableAvailability.unresolved(
                    "No required members are defined, so availability cannot be derived (PRD-021).");
        }

        BigDecimal minimum = null;
        String constrainedBy = null;
        for (BundleMemberEntity member : required) {
            SellableAvailability memberAvailability = resolved.get(member.getMemberSellableId());
            if (memberAvailability == null || !memberAvailability.resolvable()) {
                // 🔴 One unresolvable member makes the BUNDLE unresolvable. Treating it as zero
                // would state a falsehood about the whole bundle (SYS-034).
                SellableProductEntity m = known.get(member.getMemberSellableId());
                return SellableAvailability.unresolved(
                        "Member " + (m == null ? "" : m.getSellableSku())
                                + " has no derivable availability, so the bundle has none.");
            }
            BigDecimal units = saleUnits(memberAvailability.sellableUnits(), member.getQuantity());
            if (minimum == null || units.compareTo(minimum) < 0) {
                minimum = units;
                constrainedBy = known.containsKey(member.getMemberSellableId())
                        ? known.get(member.getMemberSellableId()).getSellableSku() : null;
            }
        }
        return SellableAvailability.of(minimum, constrainedBy);
    }

    /**
     * Whole sale units from a quantity and a per-unit requirement.
     *
     * <p>{@code FLOOR} rather than truncation: a partial unit cannot be sold, and flooring is
     * the conservative direction on both signs. ⚠ A NEGATIVE result is preserved rather than
     * clamped — {@code BD-441} confirms availability may go negative through deliberate
     * over-publication, and hiding that would misreport the exposure the business knowingly
     * carries ({@code PG-6} as amended).
     */
    private static BigDecimal saleUnits(BigDecimal available, BigDecimal perUnit) {
        return available.divide(perUnit, 0, RoundingMode.FLOOR);
    }
}
