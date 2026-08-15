-- =====================================================================================
-- V9 - Channel Listing promotion price
--
-- 🔴 PRD-199 SUPERSEDES PRD-197. A Listing carries ONE base selling price and an
--    OPTIONAL, TIME-BOUNDED promotion:
--
--        Sale Price       - the normal, base selling price (PRD-199.a)
--        Promotion Price  - a temporary selling price, in force only while its window
--                           is open (PRD-199.b)
--        Promotion Starts - window open  (PRD-199.c)
--        Promotion Ends   - window close (PRD-199.c)
--
-- 🔴 PRD-199.d - THE EFFECTIVE SELLING PRICE IS DERIVED AT READ TIME FROM THE CLOCK and is
--    NEVER stored (DB-001). No column here holds "the current price", and no scheduled job
--    flips one: a job that has not run yet would leave the ERP asserting a price that is
--    not in force.
--
-- 🔴 PRD-199.f - MRP IS NO LONGER A CANONICAL LISTING PRICE. Its columns are RETAINED,
--    unread, and are NOT migrated into promotion_price. A historical MRP was entered by a
--    person as a reference price; asserting it as a promotion price would manufacture a
--    promotion nobody scheduled (PRD-199.k). Only its enforcement is withdrawn.
--
-- ⚠ DB-079 / TEC-015 - money is numeric(19,2). It is never float, never double, and never
--    a JavaScript Number at any boundary.
--
-- 🔴 SYS-034 / API-063.c - every REPORTED twin carries its own readable flag. `false` means
--    the adapter could not read the field AT ALL. That is NOT an empty value, NOT zero, and
--    NOT "there is no promotion" - a channel that reported nothing has not told us there
--    is none.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Listing level
-- -------------------------------------------------------------------------------------

-- 🔴 PRD-199.k - MRP is no longer maintained, so the rule that constrained it against the
--    Sale Price is withdrawn. The COLUMN and its data stay exactly where they are.
ALTER TABLE channel_listing
    DROP CONSTRAINT IF EXISTS channel_listing_mrp_not_below_sale_price;

ALTER TABLE channel_listing
    ADD COLUMN promotion_price                  numeric(19, 2),
    ADD COLUMN promotion_starts_at              timestamptz,
    ADD COLUMN promotion_ends_at                timestamptz,
    ADD COLUMN reported_promotion_price         numeric(19, 2),
    ADD COLUMN reported_promotion_price_readable boolean NOT NULL DEFAULT false,
    ADD COLUMN reported_promotion_starts_at     timestamptz,
    ADD COLUMN reported_promotion_ends_at       timestamptz,
    ADD COLUMN reported_promotion_window_readable boolean NOT NULL DEFAULT false;

ALTER TABLE channel_listing
    ADD CONSTRAINT channel_listing_promotion_price_non_negative
        CHECK (promotion_price IS NULL OR promotion_price >= 0),
    ADD CONSTRAINT channel_listing_reported_promotion_price_non_negative
        CHECK (reported_promotion_price IS NULL OR reported_promotion_price >= 0),
    -- 🔴 PRD-199.e - PROMOTION PRICE <= SALE PRICE. Equality is VALID and means the
    --    promotion offers no reduction, which is an ordinary thing to schedule. Either
    --    value may still be absent, which is not a violation.
    ADD CONSTRAINT channel_listing_promotion_not_above_sale_price
        CHECK (promotion_price IS NULL OR sale_price IS NULL
               OR promotion_price <= sale_price),
    -- 🔴 PRD-199.c - a promotion price REQUIRES both bounds. A promotion price with no
    --    window would be a permanent second price, which is the ambiguity PRD-199 removes.
    ADD CONSTRAINT channel_listing_promotion_window_complete
        CHECK (promotion_price IS NULL
               OR (promotion_starts_at IS NOT NULL AND promotion_ends_at IS NOT NULL)),
    ADD CONSTRAINT channel_listing_promotion_window_ordered
        CHECK (promotion_starts_at IS NULL OR promotion_ends_at IS NULL
               OR promotion_ends_at > promotion_starts_at);

COMMENT ON COLUMN channel_listing.sale_price IS
    'Intended Sale Price - the NORMAL base selling price (PRD-199.a). Formerly channel_price.';
COMMENT ON COLUMN channel_listing.promotion_price IS
    'Intended Promotion Price - a TEMPORARY selling price, in force only while the window '
    'is open (PRD-199.b). <= sale_price (PRD-199.e). The EFFECTIVE price is derived at read '
    'time and is never stored (PRD-199.d).';
COMMENT ON COLUMN channel_listing.promotion_starts_at IS
    'Promotion window open (PRD-199.c). Required whenever promotion_price is present.';
COMMENT ON COLUMN channel_listing.promotion_ends_at IS
    'Promotion window close (PRD-199.c). Must be later than promotion_starts_at.';
COMMENT ON COLUMN channel_listing.reported_promotion_price_readable IS
    'SYS-034 - false means the adapter could not READ the promotion price at all. It is '
    'never rendered or stored as zero, and never as "there is no promotion".';
COMMENT ON COLUMN channel_listing.reported_promotion_window_readable IS
    'SYS-034 - false means the adapter could not READ the promotion window at all.';
COMMENT ON COLUMN channel_listing.mrp IS
    'SUPERSEDED by PRD-199. MRP is NO LONGER a canonical Channel Listing price and is not '
    'read, written, compared or pushed. Retained unchanged under DOC-009 because a person '
    'entered it; it is never reinterpreted as a promotion price (PRD-199.k).';

-- -------------------------------------------------------------------------------------
-- Orderable channel SKU
--
-- 🔴 PRD-199.i / INV-106.3 - the commercial pricing attaches to the ORDERABLE SKU. A
--    non-variation listing has exactly one and therefore one promotion; a variation listing
--    may carry a different promotion per orderable SKU.
-- -------------------------------------------------------------------------------------

ALTER TABLE channel_listing_sku
    DROP CONSTRAINT IF EXISTS channel_listing_sku_mrp_not_below_sale_price;

ALTER TABLE channel_listing_sku
    ADD COLUMN promotion_price                  numeric(19, 2),
    ADD COLUMN promotion_starts_at              timestamptz,
    ADD COLUMN promotion_ends_at                timestamptz,
    ADD COLUMN reported_promotion_price         numeric(19, 2),
    ADD COLUMN reported_promotion_price_readable boolean NOT NULL DEFAULT false,
    ADD COLUMN reported_promotion_starts_at     timestamptz,
    ADD COLUMN reported_promotion_ends_at       timestamptz,
    ADD COLUMN reported_promotion_window_readable boolean NOT NULL DEFAULT false;

ALTER TABLE channel_listing_sku
    ADD CONSTRAINT channel_listing_sku_promotion_price_non_negative
        CHECK (promotion_price IS NULL OR promotion_price >= 0),
    ADD CONSTRAINT channel_listing_sku_reported_promotion_price_non_negative
        CHECK (reported_promotion_price IS NULL OR reported_promotion_price >= 0),
    ADD CONSTRAINT channel_listing_sku_promotion_not_above_sale_price
        CHECK (promotion_price IS NULL OR sale_price IS NULL
               OR promotion_price <= sale_price),
    ADD CONSTRAINT channel_listing_sku_promotion_window_complete
        CHECK (promotion_price IS NULL
               OR (promotion_starts_at IS NOT NULL AND promotion_ends_at IS NOT NULL)),
    ADD CONSTRAINT channel_listing_sku_promotion_window_ordered
        CHECK (promotion_starts_at IS NULL OR promotion_ends_at IS NULL
               OR promotion_ends_at > promotion_starts_at);

COMMENT ON COLUMN channel_listing_sku.sale_price IS
    'Intended Sale Price for this orderable SKU - the NORMAL base selling price '
    '(PRD-199.a, INV-106.3). Formerly channel_price.';
COMMENT ON COLUMN channel_listing_sku.promotion_price IS
    'Intended Promotion Price for this orderable SKU (PRD-199.b, INV-106.3).';
COMMENT ON COLUMN channel_listing_sku.mrp IS
    'SUPERSEDED by PRD-199. Retained unread under DOC-009; never reinterpreted as a '
    'promotion price (PRD-199.k).';

-- -------------------------------------------------------------------------------------
-- Adapter capability
--
-- 🔴 PRD-199.h - capability is declared per channel INSTANCE, per field and per direction.
--    The base price and the promotion are SEPARATE declarable fields: a marketplace may
--    support one and not the other. Nothing is seeded here, because an undeclared
--    capability is UNKNOWN and must never default to "supported" (API-063).
--
-- ⚠ No data change: channel_adapter_capability is keyed by field_key, so 'promotion_price'
--   and 'promotion_window' are simply two more keys it can carry. The retired 'mrp' key is
--   left in place where a channel already declared one - a declaration is a record of what
--   an adapter said, not a Trioloo assertion.
-- -------------------------------------------------------------------------------------
