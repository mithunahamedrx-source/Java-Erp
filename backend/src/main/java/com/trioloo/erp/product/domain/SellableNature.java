package com.trioloo.erp.product.domain;

/**
 * {@code PRD-008} — the three canonical natures of an {@code E-058} Sellable Product.
 *
 * <p>🔴 EXACTLY THREE. No fourth value may be added: {@code PRD-021} gives each nature its own
 * resolution mechanism and {@code PRD-023} its own availability derivation, so a new nature
 * would be a new business rule, not an enum entry.
 *
 * <p>🔴 {@code INV-58.3} / {@code PRD-070} — NATURE IS IMMUTABLE. A {@code SIMPLE} product never
 * becomes {@code ASSEMBLED}; that is a NEW product, because its cost basis, availability
 * derivation, warranty model and return handling all change.
 */
public enum SellableNature {

    /** {@code PRD-021} — resolves to ONE Inventory Product with a quantity per sale unit. */
    SIMPLE,

    /** {@code PRD-021}, {@code PRD-081} — resolves to ONE {@code ACTIVE} Build Template version. */
    ASSEMBLED,

    /** {@code PRD-021}, {@code PRD-047} — resolves to an ordered list of member Sellable Products. */
    BUNDLE
}
