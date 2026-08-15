package com.trioloo.erp.product.application;

import java.util.UUID;

/** The requested Stock Item does not exist. */
public class StockItemNotFoundException extends RuntimeException {
    public StockItemNotFoundException(UUID id) {
        super("No Stock Item with id " + id);
    }
}
