package com.trioloo.erp.product.application;

import java.math.BigDecimal;

/**
 * The DERIVED sellable availability of one {@code E-058} Sellable Product ({@code PRD-023}).
 *
 * <p>🔴 {@code INV-58.4} — NEVER STORED, never cached as authority, and never taken from a
 * marketplace figure. This record is computed at query time from the resolution target and
 * discarded.
 *
 * <p>🔴 {@code UX-036} — THIS IS NOT A STOCK ITEM FIGURE. {@code E-020}'s Physical Stock and
 * Available Quantity are Inventory-owned facts about a physical thing; this is a
 * SELLABLE-LAYER answer to *how many of this offering can we sell*. The two are different
 * figures with different owners and are never one field.
 *
 * @param sellableUnits how many sale units can be offered. 🔴 {@code null} means NOT
 *                      RESOLVABLE — never {@code 0}. {@code SYS-034} forbids presenting an
 *                      unavailable figure as zero: *no active Build Template* and *zero
 *                      buildable* are different statements with different remedies.
 * @param constrainedBy the limiting component or member, where one constrains. ⚠ Explanatory
 *                      only; it is never a second availability figure.
 * @param unresolvedReason why the figure could not be derived. Present exactly when
 *                        {@code sellableUnits} is {@code null}.
 */
public record SellableAvailability(BigDecimal sellableUnits,
                                   String constrainedBy,
                                   String unresolvedReason) {

    public static SellableAvailability of(BigDecimal units, String constrainedBy) {
        return new SellableAvailability(units, constrainedBy, null);
    }

    /** 🔴 The honest answer when the resolution target cannot be followed. Never zero. */
    public static SellableAvailability unresolved(String reason) {
        return new SellableAvailability(null, null, reason);
    }

    public boolean resolvable() {
        return sellableUnits != null;
    }
}
