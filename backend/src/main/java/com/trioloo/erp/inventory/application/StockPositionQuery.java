package com.trioloo.erp.inventory.application;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * The port through which other modules ask Inventory for derived positions.
 *
 * <p>🔴 Ownership boundary ({@code IVN-000}, {@code DOC-005}). Product owns {@code E-020};
 * Inventory owns what moved and what is available. Product composes a read model by ASKING —
 * it never reads the movement tables itself and never acquires a balance column.
 */
public interface StockPositionQuery {

    /** Positions for the given variants. A variant with no movements yields a truthful zero. */
    Map<UUID, StockPosition> positionsFor(Collection<UUID> productVariantIds);

    /** Aggregate physical and reserved totals across a set of variants, derived not stored. */
    StockTotals totalsFor(Collection<UUID> productVariantIds);
}
