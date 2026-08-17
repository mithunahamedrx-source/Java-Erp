package com.trioloo.erp.system.application;

/**
 * {@code PRM-003} — a denial names the CAPABILITY that was required, never the record, its
 * existence or its contents.
 */
public class ShopAccessDeniedException extends RuntimeException {

    private final String requiredPermission;

    public ShopAccessDeniedException(String requiredPermission) {
        super("This action requires the capability " + requiredPermission + ".");
        this.requiredPermission = requiredPermission;
    }

    public String requiredPermission() {
        return requiredPermission;
    }
}
