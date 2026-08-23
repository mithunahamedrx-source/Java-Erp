package com.trioloo.erp.order.application;

import java.util.UUID;

public class ChannelOrderNotFoundException extends RuntimeException {

    public ChannelOrderNotFoundException(UUID id) {
        super("No Channel Order with id " + id + ".");
    }
}
