package com.trioloo.erp.product.application;

import com.trioloo.erp.platform.money.MonetaryAmount;

import java.math.BigDecimal;

/**
 * The five operational summary values for the Stock Items workspace.
 *
 * <p>🔴 Derived at query time over the ACTIVE search and filters, and deliberately
 * PAGINATION-INDEPENDENT ({@code UX-044.b}). A summary that described only the visible page
 * would be a different, misleading statement.
 *
 * <p>🔴 {@code totalStockValue} is {@code null} when the actor lacks
 * {@code inventory-costing.valuation.view}. The field is then omitted from the response
 * entirely — absent, not zero ({@code ICO-038.a}).
 *
 * <p>⚠ No trend, percentage, comparison or chart accompanies these. This is an operational
 * summary strip, not a dashboard, and {@code UX-080} forbids inventing a metric.
 */
public record StockItemSummary(long totalStockItems,
                               BigDecimal physicalStockUnits,
                               BigDecimal availableUnits,
                               long outOfStockItems,
                               @MonetaryAmount BigDecimal totalStockValue) {
}
