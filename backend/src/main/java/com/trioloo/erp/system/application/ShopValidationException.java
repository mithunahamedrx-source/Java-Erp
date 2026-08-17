package com.trioloo.erp.system.application;

/**
 * {@code SCS-030.e} — validation belongs to the FIELD it concerns, so the failure carries the
 * field name and the message the operator reads under it. There is no summary banner.
 */
public class ShopValidationException extends RuntimeException {

    private final String field;

    public ShopValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String field() {
        return field;
    }
}
