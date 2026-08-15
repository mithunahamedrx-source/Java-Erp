package com.trioloo.erp.product.application;

/**
 * A business validation refusal.
 *
 * <p>⚠ Distinct from a permission denial and from a not-found: {@code UX-112} keeps
 * unavailable, forbidden and invalid as different states with different remedies.
 */
public class StockItemValidationException extends RuntimeException {

    private final String field;

    public StockItemValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String field() {
        return field;
    }
}
