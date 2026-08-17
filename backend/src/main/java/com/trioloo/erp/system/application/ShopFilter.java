package com.trioloo.erp.system.application;

import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;

/**
 * {@code SCS-022} / {@code SCS-023} — the workspace query, in one shape.
 *
 * <p>🔴 EXACTLY THE APPROVED CONTROLS AND NO MORE: one free-text search over name, code and
 * link, and three single-select filters. {@code SCS-023.d} — no advanced-filter drawer, no
 * date filter, no saved view, and none may be added here later without ratification.
 *
 * <p>⚠ A null means "all" for that filter. All four combine as AND ({@code SCS-022.b}).
 */
public record ShopFilter(String search,
                         ChannelTypeCode channelType,
                         ConnectionState connection,
                         ConfigurationState configuration) {

    public ShopFilter {
        search = search == null || search.isBlank() ? null : search.trim();
    }

    public static ShopFilter unfiltered() {
        return new ShopFilter(null, null, null, null);
    }

    /** Whether any control is engaged — what the "N filter" count and `Clear` read. */
    public boolean anyFilterEngaged() {
        return channelType != null || connection != null || configuration != null;
    }
}
