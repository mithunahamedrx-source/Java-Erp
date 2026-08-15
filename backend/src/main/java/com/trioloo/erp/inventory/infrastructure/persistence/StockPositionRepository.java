package com.trioloo.erp.inventory.infrastructure.persistence;

import com.trioloo.erp.inventory.application.StockPosition;
import com.trioloo.erp.inventory.application.StockPositionQuery;
import com.trioloo.erp.inventory.application.StockTotals;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Derives inventory positions from movements and reservations.
 *
 * <p>🔴 {@code DB-001} — the quantity is the computation. Two aggregate queries serve any
 * number of variants, so composing a page of Stock Items costs two round trips rather than one
 * per row: there is no N+1 here.
 *
 * <p>{@code IVN-016} — movements are append-only, so a position is a pure function of history
 * and needs no cache to be correct.
 */
@Repository
public class StockPositionRepository implements StockPositionQuery {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, StockPosition> positionsFor(Collection<UUID> productVariantIds) {
        Map<UUID, StockPosition> positions = new HashMap<>();
        if (productVariantIds.isEmpty()) {
            return positions;
        }

        Map<UUID, BigDecimal> physical = sum(
                "SELECT m.product_variant_id, COALESCE(SUM(m.quantity), 0) FROM inventory_movement m "
                        + "WHERE m.product_variant_id IN (:ids) GROUP BY m.product_variant_id",
                productVariantIds);

        Map<UUID, BigDecimal> reserved = sum(
                "SELECT r.product_variant_id, COALESCE(SUM(r.quantity), 0) FROM stock_reservation r "
                        + "WHERE r.released_at IS NULL AND r.product_variant_id IN (:ids) "
                        + "GROUP BY r.product_variant_id",
                productVariantIds);

        // A variant absent from both aggregates has no movements at all. That is a truthful
        // zero position, not missing data - and it is the ordinary case before any module
        // capable of creating a movement exists.
        for (UUID id : productVariantIds) {
            positions.put(id, new StockPosition(id,
                    physical.getOrDefault(id, BigDecimal.ZERO),
                    reserved.getOrDefault(id, BigDecimal.ZERO)));
        }
        return positions;
    }

    @Override
    @Transactional(readOnly = true)
    public StockTotals totalsFor(Collection<UUID> productVariantIds) {
        if (productVariantIds.isEmpty()) {
            return StockTotals.zero();
        }
        Map<UUID, StockPosition> positions = positionsFor(productVariantIds);

        BigDecimal physical = BigDecimal.ZERO;
        BigDecimal available = BigDecimal.ZERO;
        long outOfStock = 0L;
        for (StockPosition position : positions.values()) {
            physical = physical.add(position.physical());
            available = available.add(position.available());
            if (position.outOfStock()) {
                outOfStock++;
            }
        }
        return new StockTotals(physical, available, outOfStock);
    }

    @SuppressWarnings("unchecked")
    private Map<UUID, BigDecimal> sum(String sql, Collection<UUID> ids) {
        List<Object[]> rows = entityManager.createNativeQuery(sql)
                .setParameter("ids", ids)
                .getResultList();
        Map<UUID, BigDecimal> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put((UUID) row[0], (BigDecimal) row[1]);
        }
        return result;
    }
}
