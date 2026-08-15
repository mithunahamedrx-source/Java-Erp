package com.trioloo.erp.product.domain;

/** The shared integration sync lifecycle from System architecture. */
public enum SyncState {
    PENDING,
    IN_PROGRESS,
    SYNCED,
    FAILED,
    MANUAL_REQUIRED,
    DIVERGED
}
