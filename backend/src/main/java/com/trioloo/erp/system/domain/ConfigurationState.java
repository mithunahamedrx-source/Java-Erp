package com.trioloo.erp.system.domain;

/**
 * {@code SYS-108} — the CONFIGURATION lifecycle of an {@code E-016} Channel Instance.
 *
 * <p>🔴 THIS IS NOT THE CONNECTION CONDITION. {@code SCS-040} keeps the two apart on purpose:
 * a shop can be {@code ACTIVE} with a broken connection, and {@code DRAFT} with a working one.
 * They are owned by different modules and neither is derived from the other.
 *
 * <p>⚠ {@code SCS-051.e} — {@code SUSPENDED} and {@code ARCHIVED} are canonical and
 * displayable even though no control produces them in this release. The states are not
 * removed to match the absence of a button.
 */
public enum ConfigurationState {

    /** Registered but not yet approved for business use. Listings cannot target it. */
    DRAFT,
    /** An ordinary operational target for new Listings ({@code SCS-051.d}). */
    ACTIVE,
    /** Canonical and displayable; no control produces it in this release. */
    SUSPENDED,
    /** Canonical and displayable; {@code INV-16.10} — archival is never a hard delete. */
    ARCHIVED
}
