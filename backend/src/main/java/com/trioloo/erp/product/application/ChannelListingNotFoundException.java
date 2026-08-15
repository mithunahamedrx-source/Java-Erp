package com.trioloo.erp.product.application;

import java.util.UUID;

public class ChannelListingNotFoundException extends RuntimeException {
    public ChannelListingNotFoundException(UUID id) {
        super("No Channel Listing with id " + id + ".");
    }
}
