package com.trioloo.erp.product.application;

import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;

/**
 * The ratified V1 Sellable Products filter set — {@code UX-039.a}.
 *
 * <p>Canon lists exactly four: search on <b>name · Sellable SKU</b> ({@code PRD-011},
 * {@code PRD-017}) · <b>nature</b> ({@code PRD-008}) · <b>record status</b> ({@code SYS §7.1})
 * · <b>has / has no Listing</b> ({@code PRD-028}).
 *
 * <p>⚠ {@code sellableCategory} is present as a canonical Product field ({@code PRD-016}) used
 * by the API's own query surface; it is not offered as a workspace filter control, because
 * {@code UX-039.a} does not list one for this tab.
 *
 * <p>🔴 THE LISTING FILTER IS DELIBERATELY ABSENT FROM THIS RECORD. {@code E-059} has no
 * persistence in this stage, so a *has / has no Listing* control could only ever answer from
 * fabricated data. An always-empty filter that silently matches everything is worse than no
 * filter, because it looks like a working control. It is reported, not faked.
 *
 * <p>🔴 NOT ADDED, and not because they were forgotten: supplier (a procurement attribute,
 * {@code PRD §6.2}), price, margin, stock level, tags, tax ({@code GAP-003}), channel category
 * ({@code PRDU-13} open).
 */
public record SellableProductFilter(String search,
                                    SellableNature nature,
                                    RecordStatus status,
                                    String sellableCategory) {

    public static SellableProductFilter none() {
        return new SellableProductFilter(null, null, null, null);
    }

    /** Blank query strings are treated as absent so an empty search box matches everything. */
    public SellableProductFilter {
        search = blankToNull(search);
        sellableCategory = blankToNull(sellableCategory);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
