package com.trioloo.erp.product.application;

/**
 * Raised when the actor lacks the capability an action requires.
 *
 * <p>{@code PRM-003} — absence of a grant is a denial. The message names the capability so an
 * operator can be told what to request, without leaking whether the subject exists.
 */
public class AccessDeniedByPermissionException extends RuntimeException {

    private final String requiredPermission;

    public AccessDeniedByPermissionException(String requiredPermission) {
        super("This action requires the capability: " + requiredPermission);
        this.requiredPermission = requiredPermission;
    }

    public String requiredPermission() {
        return requiredPermission;
    }
}
