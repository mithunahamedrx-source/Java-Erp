package com.trioloo.erp.product.application;

/**
 * The ratified P1 capability codes.
 *
 * <p>🔴 These are NOT invented here. They are transcribed from the owning architecture:
 * {@code PRD-154} names the two Product codes, {@code ICO-038} names the valuation code, and
 * {@code PRM-089} fixes the {@code <owning-module>.<resource>.<action>} shape they are written
 * in. Implementation may never coin a permission code ({@code PRM-089.f}).
 *
 * <p>🔴 No wildcard exists, in any segment ({@code PRM-089.c}), and no role name is ever the
 * security rule ({@code PRM-004}, {@code PRM-068}).
 */
public final class ProductPermissions {

    /** {@code PRD-154} — view, search, filter, list, read detail and EXPORT Stock Items. */
    public static final String STOCK_ITEM_VIEW = "product.stock-item.view";

    /** {@code PRD-154} — create, and update where the Product lifecycle permits. */
    public static final String STOCK_ITEM_MANAGE = "product.stock-item.manage";

    /**
     * {@code ICO-038} — cost-sensitive valuation. READ-ONLY: it grants no authority to mutate
     * weighted average cost or any costing fact.
     *
     * <p>⚠ Deliberately independent of the two above. An operator may fully manage Stock Items
     * and still see no cost — {@code PRD-098} applied.
     */
    public static final String VALUATION_VIEW = "inventory-costing.valuation.view";

    /** {@code PRD-155} — view, search, filter, list, read detail and EXPORT Sellable Products. */
    public static final String SELLABLE_PRODUCT_VIEW = "product.sellable-product.view";

    /**
     * {@code PRD-155} — create and update a Sellable Product where the lifecycle permits, and
     * author a DRAFT Build Template version, its BOM lines and bundle membership.
     *
     * <p>🔴 It does NOT confer {@link #BUILD_TEMPLATE_ACTIVATE}. Authoring a draft and
     * activating one are different acts with different blast radii ({@code PRD-155.c},
     * {@code PRD-147.d}).
     */
    public static final String SELLABLE_PRODUCT_MANAGE = "product.sellable-product.manage";

    /**
     * {@code PRD-155} — activate a Build Template version, superseding the previous one.
     *
     * <p>🔴 THE APPROVAL-BEARING AUTHORITY of {@code PRD §24}, and nothing more is built around
     * it: {@code PRD-147.c} ruled the act needs no additional business capability, so no
     * approval-request entity, approver role or two-step state exists ({@code PRD-155.b}).
     * Activation is audited through first-class attribution ({@code PRD-092}).
     */
    public static final String BUILD_TEMPLATE_ACTIVATE = "product.build-template.activate";

    /** {@code PRD-162} - view, search, filter, list, read detail and EXPORT Channel Listings. */
    public static final String CHANNEL_LISTING_VIEW = "product.channel-listing.view";

    /**
     * {@code PRD-162}, bounded by {@code PRD-196.f} — LOCAL acts only.
     *
     * <p>Creating a listing, editing intended content, mapping, media, publication intent,
     * local save and CSV import.
     *
     * <p>🔴 {@code PRD-196.a} — this NEVER implies {@link #CHANNEL_LISTING_PUBLISH}. That
     * separation is the rule's whole purpose: local editing authority must not silently
     * carry the authority to change what customers see on seven marketplaces. Channel-owned
     * mirror facts remain unwritable through it ({@code PRD-162.b}).
     */
    public static final String CHANNEL_LISTING_MANAGE = "product.channel-listing.manage";

    /**
     * {@code PRD-196} — OUTBOUND MARKETPLACE MUTATION.
     *
     * <p>Push update, remote create/publish, withdraw and Push ERP Version.
     *
     * <p>🔴 {@code PRD-196.b} — required for EVERY outbound act at EVERY scope: single,
     * batch and divergence resolution alike ({@code PRM-004}, {@code PRD-131}).
     */
    public static final String CHANNEL_LISTING_PUBLISH = "product.channel-listing.publish";

    /**
     * {@code PRD-196} — request inbound discovery or refresh.
     *
     * <p>🔴 {@code PRD-196.d} — confers NO outbound authority. It is separate because a
     * channel-scoped run over thousands of listings consumes external quota and rewrites the
     * reported side wholesale — a materially different act from editing one listing's title.
     */
    public static final String CHANNEL_LISTING_SYNC = "product.channel-listing.sync";

    private ProductPermissions() {
    }
}
