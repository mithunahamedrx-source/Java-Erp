package com.trioloo.erp.order.application;

public class ChannelOrderImportException extends RuntimeException {
    public ChannelOrderImportException(String message) {
        super(message, null, false, false);
    }
}
