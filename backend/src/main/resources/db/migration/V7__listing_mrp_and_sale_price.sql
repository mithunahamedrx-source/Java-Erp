-- =====================================================================================
-- V7 - Listing commercial price model: MRP and Sale Price
--
-- 🔴 PRD-197 - a Listing carries TWO editable commercial monetary values and no more:
--      MRP        - the reference / list price
--      Sale Price - the price the Listing is actually offered at
--    There is NO third "discount price". Discount amount and discount percentage are
--    DERIVED from these two at read time and are never stored (DB-001, PRD-197.d).
--
-- 🔴 INV-106.3 as amended - both attach to the ORDERABLE channel SKU. The listing-level
--    columns remain the single-SKU convenience read, exactly as channel_price was.
--
-- 🔴 COMPATIBILITY (PRD-197.f). The superseded `channel_price` was, by PRD-138, "what
--    Trioloo publishes" - the price the listing is offered at. That is Sale Price, so the
--    column is RENAMED rather than dropped and no value is lost or reinterpreted.
--    Where no historical MRP exists, MRP is seeded EQUAL to Sale Price, which asserts
--    exactly what the old data said: a price, with no discount claim. Seeding a higher
--    MRP would manufacture a discount that nobody entered.
--
-- ⚠ V6 and every earlier migration are UNTOUCHED (PRJ-080).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Channel Listing - the single-SKU convenience read
-- -------------------------------------------------------------------------------------

ALTER TABLE channel_listing DROP CONSTRAINT IF EXISTS channel_listing_price_non_negative;

ALTER TABLE channel_listing RENAME COLUMN channel_price TO sale_price;
ALTER TABLE channel_listing RENAME COLUMN reported_price TO reported_sale_price;
ALTER TABLE channel_listing RENAME COLUMN reported_price_readable TO reported_sale_price_readable;

ALTER TABLE channel_listing
    ADD COLUMN mrp                     numeric(19, 2),
    ADD COLUMN reported_mrp            numeric(19, 2),
    -- 🔴 SYS-034 / API-063.c - false means the adapter could not read the field AT ALL.
    -- That is NOT an empty value and is never rendered or stored as zero.
    ADD COLUMN reported_mrp_readable   boolean NOT NULL DEFAULT false;

UPDATE channel_listing SET mrp = sale_price WHERE mrp IS NULL AND sale_price IS NOT NULL;

ALTER TABLE channel_listing
    ADD CONSTRAINT channel_listing_sale_price_non_negative
        CHECK (sale_price IS NULL OR sale_price >= 0),
    ADD CONSTRAINT channel_listing_mrp_non_negative
        CHECK (mrp IS NULL OR mrp >= 0),
    ADD CONSTRAINT channel_listing_reported_mrp_non_negative
        CHECK (reported_mrp IS NULL OR reported_mrp >= 0),
    -- 🔴 PRD-197.c - MRP >= Sale Price. Equality is VALID and means no discount is being
    -- offered. Either value may still be absent, which is not a violation.
    ADD CONSTRAINT channel_listing_mrp_not_below_sale_price
        CHECK (mrp IS NULL OR sale_price IS NULL OR mrp >= sale_price);

-- ⚠ NO constraint relates reported MRP to reported Sale Price. Those are the CHANNEL's
-- values, mirrored as observed (PRD-181.a). Refusing to record what a marketplace
-- actually shows would make the divergence it proves undetectable.

COMMENT ON COLUMN channel_listing.sale_price IS
    'Intended Sale Price - the price the Listing is offered at (PRD-197.b). Formerly channel_price.';
COMMENT ON COLUMN channel_listing.mrp IS
    'Intended MRP - the reference / list price (PRD-197.a). MRP >= sale_price (PRD-197.c).';

-- -------------------------------------------------------------------------------------
-- E-106 Channel Listing SKU - where the prices AUTHORITATIVELY live
-- -------------------------------------------------------------------------------------

ALTER TABLE channel_listing_sku DROP CONSTRAINT IF EXISTS channel_listing_sku_price_non_negative;
ALTER TABLE channel_listing_sku DROP CONSTRAINT IF EXISTS channel_listing_sku_reported_price_non_negative;

ALTER TABLE channel_listing_sku RENAME COLUMN channel_price TO sale_price;
ALTER TABLE channel_listing_sku RENAME COLUMN reported_price TO reported_sale_price;
ALTER TABLE channel_listing_sku RENAME COLUMN reported_price_readable TO reported_sale_price_readable;

ALTER TABLE channel_listing_sku
    ADD COLUMN mrp                     numeric(19, 2),
    ADD COLUMN reported_mrp            numeric(19, 2),
    ADD COLUMN reported_mrp_readable   boolean NOT NULL DEFAULT false;

UPDATE channel_listing_sku SET mrp = sale_price WHERE mrp IS NULL AND sale_price IS NOT NULL;

ALTER TABLE channel_listing_sku
    ADD CONSTRAINT channel_listing_sku_sale_price_non_negative
        CHECK (sale_price IS NULL OR sale_price >= 0),
    ADD CONSTRAINT channel_listing_sku_mrp_non_negative
        CHECK (mrp IS NULL OR mrp >= 0),
    ADD CONSTRAINT channel_listing_sku_reported_sale_price_non_negative
        CHECK (reported_sale_price IS NULL OR reported_sale_price >= 0),
    ADD CONSTRAINT channel_listing_sku_reported_mrp_non_negative
        CHECK (reported_mrp IS NULL OR reported_mrp >= 0),
    ADD CONSTRAINT channel_listing_sku_mrp_not_below_sale_price
        CHECK (mrp IS NULL OR sale_price IS NULL OR mrp >= sale_price);

COMMENT ON COLUMN channel_listing_sku.sale_price IS
    'Intended Sale Price for this orderable SKU (PRD-197.b, INV-106.3). Formerly channel_price.';
COMMENT ON COLUMN channel_listing_sku.mrp IS
    'Intended MRP for this orderable SKU (PRD-197.a, INV-106.3).';

-- -------------------------------------------------------------------------------------
-- Adapter capability
--
-- 🔴 PRD-125 / PRD-197.e - capability is declared per channel INSTANCE, per field and per
--    direction. MRP and Sale Price are SEPARATE declarable fields: a marketplace may
--    support one and not the other. Nothing is seeded here, because an undeclared
--    capability is UNKNOWN and must never default to "supported".
-- -------------------------------------------------------------------------------------

-- No data change required: channel_adapter_capability is already keyed by field_key, and
-- 'mrp' / 'sale_price' are simply two more keys it can carry.
