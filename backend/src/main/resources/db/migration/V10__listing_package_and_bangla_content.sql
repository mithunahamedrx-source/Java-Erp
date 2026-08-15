-- =====================================================================================
-- V10 - Listing package publishing facts (PRD-201) and Bangla content override (PRD-202)
--
-- 🔴 PRD-201 - the five package facts are LOCAL Trioloo publishing intent and are
--    AUTHORABLE with no channel, no adapter and no declared schema (PRD-201.b). A
--    marketplace requirement is a reason to SEND them, never a precondition for recording
--    them.
--
-- 🔴 PRD-201.c / INV-106.10 - they attach to the ORDERABLE CHANNEL SKU (E-106), exactly as
--    price and stock do (INV-106.3). The orderable unit is what a courier collects, so a
--    listing-level parcel would be a fiction the moment two variants ship differently. A
--    non-variation listing has exactly one SKU and therefore exactly one set.
--
-- 🔴 PRD-201.e - UNITS ARE FIXED AND STORED ONCE: weight in KILOGRAMS, dimensions in
--    CENTIMETRES. A channel needing grams, pounds or inches converts in its adapter
--    (API-062.d) - a per-channel unit in the core would make one parcel two sizes.
--
-- 🔴 PRD-201.d - these are the SHIPPING CARTON as this channel is told about it, including
--    wrapping and filler. They are NOT the product's measured size and NEVER derive from an
--    Inventory quantity or position (PRD-193, INV-106.4).
--
-- 🔴 PRD-201.f / SYS-034 - every column is NULLABLE and an unset value is ABSENT. It is
--    never written, read or sent as zero: a parcel weighing 0 kg is a claim, an unweighed
--    parcel is a gap.
--
-- 🔴 PRD-202 - Bangla is an OPTIONAL OVERRIDE on title, description and highlights. The
--    EFFECTIVE Bangla is DERIVED at read time - the override where one exists, otherwise the
--    English content - and is NEVER materialised here (PRD-202.d, DB-001). No English value
--    is copied into a Bangla column by this migration or by any later write.
--
-- 🔴 PRD-202.a - EXISTING CONTENT IS ENGLISH CONTENT. Nothing is moved, renamed or
--    reinterpreted; the columns that hold intended title, description and highlights today
--    keep holding exactly what they held before.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Package publishing facts, on the orderable channel SKU
--
-- ⚠ numeric(19, 3) - three decimal places carries grams (0.001 kg) and millimetres
--   (0.1 cm) without ever reaching for a float. DB-079's prohibition on binary floating
--   point is about representing decimal quantities exactly, and applies here as it does to
--   money.
-- -------------------------------------------------------------------------------------

ALTER TABLE channel_listing_sku
    ADD COLUMN package_weight_kg  numeric(19, 3),
    ADD COLUMN package_length_cm  numeric(19, 3),
    ADD COLUMN package_width_cm   numeric(19, 3),
    ADD COLUMN package_height_cm  numeric(19, 3),
    ADD COLUMN package_content    varchar(2000);

ALTER TABLE channel_listing_sku
    -- 🔴 A dimension may be ABSENT, but a recorded one is never negative or zero: a parcel
    --    with a zero side does not exist, and storing one would publish a false size.
    ADD CONSTRAINT channel_listing_sku_package_weight_positive
        CHECK (package_weight_kg IS NULL OR package_weight_kg > 0),
    ADD CONSTRAINT channel_listing_sku_package_length_positive
        CHECK (package_length_cm IS NULL OR package_length_cm > 0),
    ADD CONSTRAINT channel_listing_sku_package_width_positive
        CHECK (package_width_cm IS NULL OR package_width_cm > 0),
    ADD CONSTRAINT channel_listing_sku_package_height_positive
        CHECK (package_height_cm IS NULL OR package_height_cm > 0),
    -- ⚠ Blank text is not content. An operator who cleared the box authored nothing, and
    --   storing '' would make "no package content" and "empty package content" two states.
    ADD CONSTRAINT channel_listing_sku_package_content_not_blank
        CHECK (package_content IS NULL OR length(trim(package_content)) > 0);

COMMENT ON COLUMN channel_listing_sku.package_weight_kg IS
    'PRD-201.a - intended package weight in KILOGRAMS (PRD-201.e). The shipping carton as '
    'the channel is told about it, not the product size (PRD-201.d). NULL is ABSENT, never '
    'zero (PRD-201.f).';
COMMENT ON COLUMN channel_listing_sku.package_length_cm IS
    'PRD-201.a - intended package length in CENTIMETRES (PRD-201.e).';
COMMENT ON COLUMN channel_listing_sku.package_width_cm IS
    'PRD-201.a - intended package width in CENTIMETRES (PRD-201.e).';
COMMENT ON COLUMN channel_listing_sku.package_height_cm IS
    'PRD-201.a - intended package height in CENTIMETRES (PRD-201.e).';
COMMENT ON COLUMN channel_listing_sku.package_content IS
    'PRD-201.a - what the buyer receives in the box, authored as text.';

-- -------------------------------------------------------------------------------------
-- Bangla content override, beside the English content it falls back to
--
-- 🔴 PRD-202.d - NOTHING IS BACKFILLED. Copying English into these columns would freeze a
--    translation nobody wrote, and a later English edit would silently stop reaching Bangla
--    readers. The fallback is resolved on read.
-- -------------------------------------------------------------------------------------

ALTER TABLE channel_listing
    -- ⚠ varchar(255) matches intended_title exactly (V5). An override that could hold
    --   more than the value it overrides would be a second, larger truth.
    ADD COLUMN intended_title_bn       varchar(255),
    ADD COLUMN intended_description_bn text;

ALTER TABLE channel_listing
    -- ⚠ PRD-202.e - whitespace is not content, so a blank override is refused rather than
    --   stored as a value that would shadow the English content with nothing.
    ADD CONSTRAINT channel_listing_intended_title_bn_not_blank
        CHECK (intended_title_bn IS NULL OR length(trim(intended_title_bn)) > 0),
    ADD CONSTRAINT channel_listing_intended_description_bn_not_blank
        CHECK (intended_description_bn IS NULL OR length(trim(intended_description_bn)) > 0);

COMMENT ON COLUMN channel_listing.intended_title IS
    'PRD-202.a - the ENGLISH intended title, and the primary authoring value. Unchanged by '
    'V10: what it held before IS the English content.';
COMMENT ON COLUMN channel_listing.intended_title_bn IS
    'PRD-202.b - OPTIONAL Bangla override. NULL means the effective Bangla title is the '
    'English one, derived at read time and never materialised (PRD-202.c, PRD-202.d).';
COMMENT ON COLUMN channel_listing.intended_description_bn IS
    'PRD-202.b - OPTIONAL Bangla override for the description. NULL falls back to English.';

-- -------------------------------------------------------------------------------------
-- Bangla highlights
--
-- 🔴 PRD-202.f - highlights fall back as a WHOLE SET, all-or-nothing, exactly as PRD-198.c
--    resolves a listing's own set against the Sellable Product master set. There is no
--    per-line merge: a half-translated list in marketplace order reads as a mistake.
--
-- ⚠ The language lives on the ROW rather than in a second table, so one ordered set per
--   language shares the position semantics PRD-198.b already ratified. The unique
--   constraint therefore becomes (listing, language, position).
-- -------------------------------------------------------------------------------------

ALTER TABLE channel_listing_highlight
    ADD COLUMN language varchar(2) NOT NULL DEFAULT 'EN';

ALTER TABLE channel_listing_highlight
    ADD CONSTRAINT channel_listing_highlight_language_check
        CHECK (language IN ('EN', 'BN'));

-- 🔴 PRD-202.a - every existing highlight IS English content. The DEFAULT above has already
--    said so for the rows on disk; the default is then dropped so no future write inherits
--    a language it did not state.
ALTER TABLE channel_listing_highlight
    ALTER COLUMN language DROP DEFAULT;

ALTER TABLE channel_listing_highlight
    DROP CONSTRAINT IF EXISTS channel_listing_highlight_position_unique;

ALTER TABLE channel_listing_highlight
    ADD CONSTRAINT channel_listing_highlight_language_position_unique
        UNIQUE (channel_listing_id, language, position);

COMMENT ON COLUMN channel_listing_highlight.language IS
    'PRD-202.b - EN or BN. Existing rows are EN (PRD-202.a). A BN set that exists is the '
    'effective Bangla set entirely; where none exists the EN set is used entirely '
    '(PRD-202.f). The fallback is never copied into BN rows (PRD-202.d).';
