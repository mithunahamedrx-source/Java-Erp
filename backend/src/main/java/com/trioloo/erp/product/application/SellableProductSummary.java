package com.trioloo.erp.product.application;

/**
 * The five operational summary values for the Sellable Products workspace.
 *
 * <p>🔴 Derived at query time over the ACTIVE search and filters, and PAGINATION-INDEPENDENT
 * ({@code UX-044.b}). A summary describing only the visible page would be a different and
 * misleading statement.
 *
 * <p>🔴 NEVER PERSISTED. There is no counter column, no cached total and no materialised view.
 *
 * <p>⚠ {@code activeSellableProducts} counts {@code record_status = ACTIVE} — the canonical
 * {@code SYS §7.1} master record state, verified before use rather than assumed. It is NOT an
 * invented notion of "live", "published" or "sellable now": publication is an {@code E-059}
 * concern ({@code PRD-128}) and availability is a derived figure, not a status.
 *
 * <p>⚠ No trend, percentage, comparison, chart or revenue figure accompanies these
 * ({@code UX-037.e}, {@code UX-080}).
 */
public record SellableProductSummary(long totalSellableProducts,
                                     long simpleCount,
                                     long assembledCount,
                                     long bundleCount,
                                     long activeSellableProducts) {
}
