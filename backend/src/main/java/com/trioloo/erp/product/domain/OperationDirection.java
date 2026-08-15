package com.trioloo.erp.product.domain;

/** Whether an operation reads from the channel or writes to it, {@code PRD-125}. */
public enum OperationDirection {
    INBOUND,
    OUTBOUND
}
