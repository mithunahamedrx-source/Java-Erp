package com.trioloo.erp.system.application;

import java.util.UUID;

public class ShopNotFoundException extends RuntimeException {

    public ShopNotFoundException(UUID id) {
        super("No shop exists with the identifier " + id + ".");
    }
}
