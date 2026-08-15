package com.trioloo.erp.inventorycosting.application;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * The port through which other modules ask Inventory Costing for valuation.
 *
 * <p>🔴 {@code ICO-000} / {@code DOC-005} — costing is owned here and nowhere else. Product
 * never computes a cost and never stores one ({@code ICO-002} — cost is derived from movements
 * and is never manually maintained).
 *
 * <p>🔴 {@code ICO-038} — every value returned by this port is cost-sensitive and requires
 * {@code inventory-costing.valuation.view}. Callers must not invoke it for an unauthorised
 * actor: absent is not zero.
 */
public interface ValuationQuery {

    /**
     * Weighted average unit cost per variant ({@code ICO-001}).
     *
     * <p>A variant with no acquisition movement is ABSENT from the map rather than mapped to
     * zero — {@code SYS-034}, an unknown cost is unknown, not zero.
     */
    Map<UUID, BigDecimal> weightedAverageCostFor(Collection<UUID> productVariantIds);

    /**
     * Total valuation across the given variants.
     *
     * <p>{@code Σ(physical quantity × weighted average cost)} — the business values what it
     * OWNS ({@code IVN-006}), at the canonical costing method ({@code ICO-001}).
     */
    BigDecimal totalValuationFor(Collection<UUID> productVariantIds);
}
