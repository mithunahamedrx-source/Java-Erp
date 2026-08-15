package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.inventory.application.StockPosition;
import com.trioloo.erp.inventory.application.StockPositionQuery;
import com.trioloo.erp.inventorycosting.application.ValuationQuery;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantEntity;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Composes the Stock Items read model from three canonical owners.
 *
 * <p>🔴 OWNERSHIP IS NOT TRANSFERRED BY COMPOSITION ({@code DOC-005}). Product supplies
 * {@code E-020} identity; Inventory supplies the derived position; Inventory Costing supplies
 * the valuation. This service asks each owner and assembles the answer — it computes no
 * quantity of its own and stores nothing.
 *
 * <p>🔴 Authorisation is enforced HERE, on every entry point ({@code PRM-004}). The frontend
 * hiding a control is an affordance, never a control ({@code PRJ-120}).
 */
@Service
public class StockItemQueryService {

    private final ProductVariantRepository variants;
    private final StockPositionQuery positions;
    private final ValuationQuery valuations;
    private final CurrentActor currentActor;

    public StockItemQueryService(ProductVariantRepository variants,
                                 StockPositionQuery positions,
                                 ValuationQuery valuations,
                                 CurrentActor currentActor) {
        this.variants = variants;
        this.positions = positions;
        this.valuations = valuations;
        this.currentActor = currentActor;
    }

    /** Whether the actor may see cost-sensitive valuation ({@code ICO-038}). */
    public boolean maySeeValuation() {
        return currentActor.current()
                .map(actor -> actor.hasPermission(ProductPermissions.VALUATION_VIEW))
                .orElse(false);
    }

    private Actor requireViewer() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.STOCK_ITEM_VIEW)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.STOCK_ITEM_VIEW);
        }
        return actor;
    }

    @Transactional(readOnly = true)
    public Page<StockItemView> list(StockItemFilter filter, Pageable pageable) {
        requireViewer();

        // The Out-of-Stock filter is a predicate over a DERIVED value, so it cannot be a SQL
        // WHERE clause on product_variant. The matching set is resolved first, then paged -
        // which also keeps the page and the summary describing the same population.
        if (filter.outOfStockOnly()) {
            List<StockItemView> matching = allMatching(filter);
            return page(matching, pageable);
        }

        Page<ProductVariantEntity> found = variants.search(filter.search(), filter.status(),
                filter.category(), filter.brand(), filter.serializationPolicy(),
                filter.componentClass(), pageable);
        return new PageImpl<>(compose(found.getContent()), pageable, found.getTotalElements());
    }

    /**
     * Every record matching the ACTIVE filters, unpaged.
     *
     * <p>🔴 The basis for the summary and for CSV export. {@code UX-044.b} — pagination is
     * presentation and never defines scope.
     */
    @Transactional(readOnly = true)
    public List<StockItemView> allMatching(StockItemFilter filter) {
        requireViewer();
        List<StockItemView> composed = compose(variants.searchAll(filter.search(), filter.status(),
                filter.category(), filter.brand(), filter.serializationPolicy(),
                filter.componentClass()));
        if (!filter.outOfStockOnly()) {
            return composed;
        }
        return composed.stream().filter(StockItemView::outOfStock).toList();
    }

    @Transactional(readOnly = true)
    public StockItemView detail(UUID id) {
        requireViewer();
        ProductVariantEntity entity = variants.findById(id)
                .orElseThrow(() -> new StockItemNotFoundException(id));
        return compose(List.of(entity)).getFirst();
    }

    /**
     * The five summary values.
     *
     * <p>🔴 Filter-aware and pagination-independent. {@code totalStockValue} is {@code null}
     * for an actor without {@code inventory-costing.valuation.view} — absent, never zero.
     */
    @Transactional(readOnly = true)
    public StockItemSummary summary(StockItemFilter filter) {
        List<StockItemView> matching = allMatching(filter);

        BigDecimal physical = BigDecimal.ZERO;
        BigDecimal available = BigDecimal.ZERO;
        long outOfStock = 0L;
        BigDecimal value = BigDecimal.ZERO;

        for (StockItemView item : matching) {
            physical = physical.add(item.physicalStock());
            available = available.add(item.availableQuantity());
            if (item.outOfStock()) {
                outOfStock++;
            }
            if (item.stockValue() != null) {
                value = value.add(item.stockValue());
            }
        }

        return new StockItemSummary(matching.size(), physical, available, outOfStock,
                maySeeValuation() ? value : null);
    }

    /**
     * Composes identity + position + (authorised) valuation.
     *
     * <p>Two aggregate queries serve the whole page regardless of its size — there is no
     * per-row lookup and therefore no N+1.
     */
    private List<StockItemView> compose(List<ProductVariantEntity> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = entities.stream().map(ProductVariantEntity::getId).toList();

        Map<UUID, StockPosition> byVariant = positions.positionsFor(ids);

        // 🔴 The costing port is not called at all for an unauthorised actor. Fetching and then
        // discarding would put a restricted figure in memory on a request that may not have it.
        boolean valuationVisible = maySeeValuation();
        Map<UUID, BigDecimal> costs = valuationVisible
                ? valuations.weightedAverageCostFor(ids)
                : Map.of();

        List<StockItemView> views = new ArrayList<>(entities.size());
        for (ProductVariantEntity e : entities) {
            StockPosition position = byVariant.getOrDefault(e.getId(), StockPosition.empty(e.getId()));
            BigDecimal unitCost = valuationVisible ? costs.get(e.getId()) : null;

            // Item Stock Value uses the SAME semantics as Total Stock Value: physical quantity
            // valued at the canonical weighted average cost. No second calculation exists.
            // Where no acquisition cost is known the value is null, not zero (SYS-034).
            BigDecimal stockValue = unitCost == null ? null : position.physical().multiply(unitCost);

            views.add(new StockItemView(e.getId(), e.getInventorySku(), e.getTechnicalName(),
                    e.getBrand(), e.getInventoryCategory(), e.getUnitOfMeasure(), e.getBarcode(),
                    e.getSerializationPolicy(), e.getComponentClass(), e.getRecordStatus(),
                    position.physical(), position.available(), position.outOfStock(),
                    unitCost, stockValue, e.getUpdatedAt(), e.getVersion()));
        }
        return views;
    }

    private Page<StockItemView> page(List<StockItemView> all, Pageable pageable) {
        List<StockItemView> sorted = new ArrayList<>(all);
        sorted.sort(Comparator.comparing(StockItemView::inventorySku, String.CASE_INSENSITIVE_ORDER));
        int from = (int) Math.min(pageable.getOffset(), sorted.size());
        int to = Math.min(from + pageable.getPageSize(), sorted.size());
        return new PageImpl<>(sorted.subList(from, to), pageable, sorted.size());
    }
}
