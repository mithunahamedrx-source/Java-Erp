package com.trioloo.erp.integration.infrastructure.steadfast;

/** Steadfast was asked to act while unconfigured. A local fault, never a provider fault. */
public class SteadfastConfigurationException extends RuntimeException {
    public SteadfastConfigurationException(String message) {
        super(message);
    }
}
