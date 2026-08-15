package com.trioloo.erp.inventorycosting.infrastructure.persistence;

import com.trioloo.erp.inventorycosting.application.ValuationQuery;
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
 * Weighted average cost, derived from acquisition movements ({@code ICO-001}).
 *
 * <p>🔴 BigDecimal and NUMERIC throughout. No {@code double} or {@code float} touches a
 * monetary value anywhere in this class ({@code TEC-010}, {@code PRJ-040}).
 *
 * <p>🔴 {@code DB-079} is the SOLE rounding owner. Nothing here rounds: the weighted average is
 * carried at full division scale and the caller does not re-round it either. Premature rounding
 * inside an aggregation is precisely what {@code DB-079} exists to prevent.
 */
@Repository
public class WeightedAverageCostRepository implements ValuationQuery {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, BigDecimal> weightedAverageCostFor(Collection<UUID> productVariantIds) {
        Map<UUID, BigDecimal> costs = new HashMap<>();
        if (productVariantIds.isEmpty()) {
            return costs;
        }

        // Weighted average over acquisition movements: Σ(qty × unit_cost) / Σ(qty).
        // A variant with no acquisition is simply absent from the result - SYS-034, an
        // unknown cost is unknown rather than zero, and it must not be summed as zero.
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery(
                        "SELECT m.product_variant_id, "
                                + "       SUM(m.quantity * m.unit_cost) / NULLIF(SUM(m.quantity), 0) "
                                + "FROM inventory_movement m "
                                + "WHERE m.unit_cost IS NOT NULL AND m.quantity > 0 "
                                + "  AND m.product_variant_id IN (:ids) "
                                + "GROUP BY m.product_variant_id")
                .setParameter("ids", productVariantIds)
                .getResultList();

        for (Object[] row : rows) {
            BigDecimal cost = (BigDecimal) row[1];
            if (cost != null) {
                costs.put((UUID) row[0], cost);
            }
        }
        return costs;
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal totalValuationFor(Collection<UUID> productVariantIds) {
        if (productVariantIds.isEmpty()) {
            return BigDecimal.ZERO;
        }

        // Σ(physical quantity × weighted average unit cost), evaluated in the database in
        // NUMERIC arithmetic. A variant with no acquisition cost contributes nothing rather
        // than contributing zero-valued stock: an unknown cost is unknown (SYS-034), and
        // ICO-006 refuses inventory entry without an acquisition cost in the first place.
        Object result = entityManager.createNativeQuery(
                        "SELECT COALESCE(SUM(position.physical * wac.unit_cost), 0) "
                                + "FROM (SELECT m.product_variant_id AS id, SUM(m.quantity) AS physical "
                                + "        FROM inventory_movement m "
                                + "       WHERE m.product_variant_id IN (:ids) "
                                + "       GROUP BY m.product_variant_id) position "
                                + "JOIN (SELECT m.product_variant_id AS id, "
                                + "             SUM(m.quantity * m.unit_cost) / NULLIF(SUM(m.quantity), 0) AS unit_cost "
                                + "        FROM inventory_movement m "
                                + "       WHERE m.unit_cost IS NOT NULL AND m.quantity > 0 "
                                + "         AND m.product_variant_id IN (:ids) "
                                + "       GROUP BY m.product_variant_id) wac ON wac.id = position.id")
                .setParameter("ids", productVariantIds)
                .getSingleResult();

        return result == null ? BigDecimal.ZERO : (BigDecimal) result;
    }
}
