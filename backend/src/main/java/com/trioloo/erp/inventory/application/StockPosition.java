package com.trioloo.erp.inventory.application;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A derived inventory position for one Product Variant.
 *
 * <p>🔴 {@code IVN-002} / {@code DB-001} — NO stock figure is stored. Every value here is
 * computed from {@code inventory_movement} and {@code stock_reservation} at query time. This
 * record is a read model; it is never persisted and never cached as authority.
 *
 * <p>{@code IVN-007} — three quantities answer three different questions. Physical is what is
 * held; Available is what may be committed; Published Marketplace Stock is a per-shop manual
 * decision owned by {@code E-059} and deliberately absent here.
 */
public record StockPosition(UUID productVariantId, BigDecimal physical, BigDecimal reserved) {

    public static StockPosition empty(UUID productVariantId) {
        return new StockPosition(productVariantId, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    /** {@code IVN-012} — Reserved is one of exactly three not-sellable conditions. */
    public BigDecimal available() {
        return physical.subtract(reserved);
    }

    /**
     * {@code IVN-055} — the canonical Out-of-Stock predicate, {@code available_quantity <= 0}.
     *
     * <p>🔴 The ONE definition. Summary counts, the filter, the query, the card and the tests
     * all evaluate this method; a second definition anywhere is a defect.
     *
     * <p>⚠ It reads AVAILABLE only. Physical 5, fully reserved, is out of stock — deliberately,
     * because the operator cannot sell it. {@code <=} rather than {@code =} because deliberate
     * over-publication may drive availability negative ({@code BD-441}).
     */
    public boolean outOfStock() {
        return available().signum() <= 0;
    }
}
