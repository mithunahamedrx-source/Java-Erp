package com.trioloo.erp.product.domain;

import java.util.List;

/**
 * The canonical field keys adapter capability is declared against, {@code PRD-125},
 * {@code API-063}.
 *
 * <p>⚠ Capability is declared per channel INSTANCE, per field and per direction. It is
 * never a property of a channel TYPE — "all Daraz shops behave alike" is exactly the
 * universal statement {@code PRD-125} refuses.
 *
 * <p>🔴 These are the neutral BUSINESS facts a listing carries. No channel field name,
 * endpoint or payload key appears here ({@code API-062.d}).
 */
public final class ListingFieldKey {

    public static final String TITLE = "title";
    public static final String DESCRIPTION = "description";
    /**
     * 🔴 {@code PRD-199.h} — the base price and the promotion are SEPARATE declarable fields.
     * A marketplace may support one and not the other, in either direction, so they are never
     * declared or sent as a single "price" capability.
     *
     * <p>⚠ {@code PRD-199.f} — there is deliberately NO {@code mrp} key. {@code PRD-197} is
     * superseded and MRP is not a Channel Listing price, so it is not declarable, not
     * comparable and not sendable.
     */
    public static final String SALE_PRICE = "sale_price";
    /** {@code PRD-199.b} — the optional temporary selling price. */
    public static final String PROMOTION_PRICE = "promotion_price";
    /**
     * {@code PRD-199.c} — the window, declared as ONE capability.
     *
     * <p>⚠ A channel that can carry a promotion at all can carry both of its bounds; a start
     * without an end is not a state any marketplace offers, so splitting the declaration
     * would invent a capability nobody has.
     */
    public static final String PROMOTION_WINDOW = "promotion_window";
    public static final String LISTING_STOCK = "listing_stock";
    public static final String MEDIA = "media";
    public static final String CHANNEL_CATEGORY = "channel_category";
    public static final String ATTRIBUTES = "attributes";
    public static final String ORDERABLE_SKUS = "orderable_skus";

    /**
     * 🔴 Publication intent is Trioloo's alone and has NO reported counterpart — the
     * channel's counterpart is listing STATUS ({@code PRD-128}, {@code PRD-181}). It is
     * listed so a capability row may declare whether the channel accepts a publish or
     * withdraw request at all, never so that intent may be read back.
     */
    public static final String PUBLICATION_INTENT = "publication_intent";

    private static final List<String> ALL = List.of(
            TITLE, DESCRIPTION, SALE_PRICE, PROMOTION_PRICE, PROMOTION_WINDOW,
            LISTING_STOCK, MEDIA,
            CHANNEL_CATEGORY, ATTRIBUTES, ORDERABLE_SKUS, PUBLICATION_INTENT);

    /** Every declarable field key, in the order operators read them. */
    public static List<String> all() {
        return ALL;
    }

    /** Whether the supplied key is one this system knows how to declare capability for. */
    public static boolean isKnown(String key) {
        return key != null && ALL.contains(key);
    }

    private ListingFieldKey() {
    }
}
