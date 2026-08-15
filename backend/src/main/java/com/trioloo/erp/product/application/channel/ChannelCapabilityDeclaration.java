package com.trioloo.erp.product.application.channel;

import java.util.Map;

/**
 * What one adapter declares it can do for one channel instance, {@code API-063} /
 * {@code PRD-125}.
 *
 * <p>Keyed by {@code ListingFieldKey}. 🔴 An ABSENT key means UNDECLARED, not supported.
 *
 * <p>⚠ Declared per channel INSTANCE, never per channel type ({@code PRD-125}).
 */
public record ChannelCapabilityDeclaration(Map<String, FieldCapability> fields) {

    /** Per-field, per-direction support. */
    public record FieldCapability(boolean readable, boolean writable) {

        public static FieldCapability none() {
            return new FieldCapability(false, false);
        }
    }

    /** 🔴 Undeclared resolves to no support, never to assumed support. */
    public FieldCapability forField(String fieldKey) {
        return fields.getOrDefault(fieldKey, FieldCapability.none());
    }
}
