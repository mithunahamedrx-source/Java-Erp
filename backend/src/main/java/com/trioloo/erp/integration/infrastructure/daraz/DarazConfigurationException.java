package com.trioloo.erp.integration.infrastructure.daraz;

/**
 * Daraz was asked to do something before it was configured to do it.
 *
 * <p>🔴 THE MESSAGE NAMES THE VARIABLE, NEVER ITS VALUE. An operator needs to know that
 * {@code DARAZ_APP_SECRET} is missing; nobody needs to see what it was set to, and this text
 * reaches logs and issue trackers.
 *
 * <p>⚠ This is a CONFIGURATION fault, not a business outcome. It must never be presented to an
 * operator as "the seller must authorise again" — nothing about the seller is wrong.
 */
public class DarazConfigurationException extends RuntimeException {

    private final String variableName;

    public DarazConfigurationException(String variableName) {
        super("Daraz integration is not configured: " + variableName + " is missing.");
        this.variableName = variableName;
    }

    public DarazConfigurationException(String variableName, String problem) {
        super("Daraz integration is misconfigured: " + variableName + " " + problem + ".");
        this.variableName = variableName;
    }

    /** Which variable is at fault. */
    public String variableName() {
        return variableName;
    }
}
