package com.trioloo.erp.product.application;

import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SerializationPolicy;

/**
 * The ratified V1 Stock Items filter set ({@code UX-039.a}).
 *
 * <p>🔴 Every field traces to a canonical Product fact. Deliberately ABSENT, and not by
 * oversight: supplier (a procurement attribute, {@code PRD §6.2}), low-stock threshold
 * ({@code NOT-013} evaluates Low Stock as a condition, and no threshold field is canonical),
 * damaged, tags and tax ({@code GAP-003}).
 *
 * @param outOfStockOnly the {@code IVN-055} predicate applied as a filter — the SAME
 *                       definition the summary and the card use, never a second one.
 */
public record StockItemFilter(String search,
                              RecordStatus status,
                              String category,
                              String brand,
                              SerializationPolicy serializationPolicy,
                              String componentClass,
                              boolean outOfStockOnly) {

    public static StockItemFilter none() {
        return new StockItemFilter(null, null, null, null, null, null, false);
    }

    /** Blank query strings are treated as absent so an empty search box matches everything. */
    public StockItemFilter {
        search = blankToNull(search);
        category = blankToNull(category);
        brand = blankToNull(brand);
        componentClass = blankToNull(componentClass);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
