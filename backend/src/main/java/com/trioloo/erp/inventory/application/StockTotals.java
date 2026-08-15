package com.trioloo.erp.inventory.application;

import java.math.BigDecimal;

/**
 * Aggregate quantities over a result set, derived at query time.
 *
 * <p>🔴 Never stored, never cached as authority ({@code IVN-002}).
 */
public record StockTotals(BigDecimal physical, BigDecimal available, long outOfStockCount) {

    public static StockTotals zero() {
        return new StockTotals(BigDecimal.ZERO, BigDecimal.ZERO, 0L);
    }
}
