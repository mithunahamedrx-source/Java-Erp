package com.trioloo.erp.product.application;

import java.util.UUID;

/** The requested Sellable Product does not exist. */
public class SellableProductNotFoundException extends RuntimeException {
    public SellableProductNotFoundException(UUID id) {
        super("No Sellable Product with id " + id);
    }
}
