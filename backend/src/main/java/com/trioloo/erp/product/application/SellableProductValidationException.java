package com.trioloo.erp.product.application;

/**
 * A business validation refusal on the sellable layer.
 *
 * <p>⚠ Distinct from a permission denial and from a not-found: {@code UX-112} keeps
 * unavailable, forbidden and invalid as different states with different remedies, and
 * collapsing them would tell an operator to ask for access when the real fix is to correct a
 * field.
 */
public class SellableProductValidationException extends RuntimeException {

    private final String field;

    public SellableProductValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String field() {
        return field;
    }
}
