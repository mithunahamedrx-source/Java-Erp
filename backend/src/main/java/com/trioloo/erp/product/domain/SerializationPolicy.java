package com.trioloo.erp.product.domain;

/**
 * {@code PRD-106} — component serials are recorded only where the build warrants it, and
 * desktop PCs are not serialized by default.
 *
 * <p>⚠ Serial recording is OPTIONAL and never mandatory ({@code BD-265}). This is a policy
 * declaration on the variant, not a promise that serials exist.
 */
public enum SerializationPolicy {
    NOT_SERIALIZED,
    SERIALIZED
}
