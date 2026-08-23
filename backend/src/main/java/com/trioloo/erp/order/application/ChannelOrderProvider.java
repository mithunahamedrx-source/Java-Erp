package com.trioloo.erp.order.application;

import com.trioloo.erp.order.domain.CanonicalOrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ChannelOrderProvider {

    String channelType();

    /**
     * Orders CREATED inside a bounded window — the backfill read.
     *
     * <p>🔴 {@code BR-178.d} — a caller never asks for the whole three months at once. A request
     * that SILENTLY TRUNCATES produces an incomplete backfill with no signal that it happened.
     */
    Page listOrders(UUID channelInstanceId, Instant createdAfter, Instant createdBefore,
                    int offset, int limit);

    /**
     * Orders UPDATED since a watermark — the incremental read.
     *
     * <p>🔴 {@code BR-179.c} — the ordinary cadence read is by UPDATE watermark, not by creation
     * time, because {@code update_after} with {@code updated_at} ordering is what the protocol
     * offers ({@code DZC-049.c}). An order created last week and cancelled this morning is
     * invisible to a creation-window read and is exactly what this one exists to catch.
     *
     * <p>⚠ The caller applies the OVERLAP ({@code BR-179.d}); this method reads the window it is
     * given and nothing more.
     */
    Page listOrdersUpdatedSince(UUID channelInstanceId, Instant updatedAfter, int offset, int limit);

    /**
     * Translates this channel's own status vocabulary into the canonical one.
     *
     * <p>🔴 This is the §4.3 adapter responsibility stated verbatim — <em>"Translation —
     * Convert channel vocabulary into canonical vocabulary (status names, payment methods,
     * address formats)"</em> — and it lives here because {@code BR-005} forbids any downstream
     * stage from carrying channel-conditional behaviour. The Order module never learns what a
     * Daraz status string is.
     *
     * <p>⚠ A value this adapter cannot translate is OMITTED rather than approximated. The raw
     * channel statuses are retained separately and unchanged ({@code BR-173}), so declining to
     * translate loses nothing and inventing a mapping would ({@code BR-134}, {@code SYS-034}).
     *
     * @param channelStatuses the channel's own status values, exactly as reported
     * @return the canonical equivalents, in the order given, with untranslatable values dropped
     */
    List<CanonicalOrderStatus> canonicalStatuses(List<String> channelStatuses);

    record Page(int countTotal, int count, List<ChannelOrderSnapshot> orders) {
        public Page {
            orders = orders == null ? List.of() : List.copyOf(orders);
        }
    }
}
