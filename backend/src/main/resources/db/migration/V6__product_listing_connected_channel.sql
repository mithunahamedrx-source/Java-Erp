-- =====================================================================================
-- V6 - Stage P3 repair. Connected Channel Listings.
--
-- Owning architecture:
--   PRODUCT_ARCHITECTURE.md §38 - PRD-163..PRD-172  commercial content and media
--   PRODUCT_ARCHITECTURE.md §39 - PRD-173..PRD-196  connected listings
--   DOMAIN_MODEL.md            - E-105 Media Asset, E-106 Channel Listing SKU,
--                                E-107 Channel Listing Operation, E-108 Operation Batch,
--                                DM-082, DM-083, INV-58.7..9, INV-59.1/2/6..11, INV-106.*
--   API_ARCHITECTURE.md §23B   - API-062..API-067 neutral adapter ports
--
-- 🔴 V3, V4 and V5 are applied and are NOT edited (PRJ-081). Every change below is
--    additive or a constraint relaxation; no historical row is rewritten (PRJ-082).
--
-- 🔴 NO STORAGE TECHNOLOGY IS SELECTED (TEC-105). media_asset.storage_reference
--    identifies media and is never evidence that a provider was chosen.
--
-- 🔴 NO DERIVED POSITION IS STORED (DB-001). Mapping state, unsent-change state,
--    effective media and batch aggregate outcomes are all computed on read.
--
-- 🔴 No business data is seeded. No listing, media asset, operation or grant.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- PRD-178 / INV-59.1 - UNMAPPED is a valid condition.
--
-- V5 made sellable_product_id NOT NULL, which made API discovery impossible: a listing
-- cannot be required to know its Sellable Product before anyone has decided what it is.
--
-- 🔴 The mapping does not merely become optional - it MOVES to the orderable channel SKU
--    (PRD-190.d, INV-106.2). The column below is retained for history and is no longer
--    authoritative; channel_listing_sku.sellable_product_id supersedes it.
-- -------------------------------------------------------------------------------------
ALTER TABLE channel_listing ALTER COLUMN sellable_product_id DROP NOT NULL;

COMMENT ON COLUMN channel_listing.sellable_product_id IS
    'SUPERSEDED by channel_listing_sku.sellable_product_id (PRD-190.d, INV-106.2). Retained '
    'for history under PRJ-083; never written by application code after V6.';


-- -------------------------------------------------------------------------------------
-- PRD-188 / INV-59.2 - the external identifier may be ABSENT before a successful remote
-- creation. A channel cannot issue an identifier for a listing that does not exist yet.
--
-- Uniqueness once assigned is UNCHANGED - it simply becomes a partial unique index so
-- that many un-published drafts can coexist on one channel instance.
-- -------------------------------------------------------------------------------------
ALTER TABLE channel_listing ALTER COLUMN external_listing_id DROP NOT NULL;

ALTER TABLE channel_listing DROP CONSTRAINT channel_listing_external_unique_per_instance;

CREATE UNIQUE INDEX channel_listing_external_unique_per_instance
    ON channel_listing (channel_instance_id, external_listing_id)
    WHERE external_listing_id IS NOT NULL;


-- -------------------------------------------------------------------------------------
-- PRD-181 / INV-59.9 - intended and reported are a capability-aware PAIR.
--
-- 🔴 Every reported_* column below is written ONLY by inbound readback. A pull never
--    writes an intended value (PRD-181.a, API-062.c).
--
-- ⚠ A reported column that is NULL means the adapter did not return the field. That is
--   NOT an empty value and is never rendered as one (SYS-034, API-063.c). The paired
--   *_reported_readable flag distinguishes "read as empty" from "not readable at all".
-- -------------------------------------------------------------------------------------
ALTER TABLE channel_listing
    ADD COLUMN intended_description        text,
    ADD COLUMN reported_description        text,
    ADD COLUMN reported_description_readable boolean NOT NULL DEFAULT false,
    ADD COLUMN reported_price              numeric(19, 2),
    ADD COLUMN reported_price_readable     boolean NOT NULL DEFAULT false,
    ADD COLUMN reported_stock              numeric(19, 4),
    ADD COLUMN reported_stock_readable     boolean NOT NULL DEFAULT false,
    ADD COLUMN reported_title_readable     boolean NOT NULL DEFAULT false,

    -- PRD-191 - the channel's own taxonomy reference. 🔴 Product never owns the tree.
    ADD COLUMN intended_channel_category   varchar(400),
    ADD COLUMN intended_channel_category_ref varchar(160),
    ADD COLUMN reported_channel_category   varchar(400),
    ADD COLUMN reported_channel_category_readable boolean NOT NULL DEFAULT false,

    -- PRD-188 - the ERP-side publication lifecycle, distinct from the channel-owned
    -- listing_status. 🔴 A listing awaiting first publication is neither diverged nor
    -- failed (PRD-188.d), so it needs its own state rather than a misused sync state.
    ADD COLUMN local_lifecycle             varchar(24) NOT NULL DEFAULT 'PUBLISHED',

    -- PRD-185.c - the unsent-change condition is DERIVED by comparing these two stamps.
    -- 🔴 It is NEVER a stored mutable flag (DB-001).
    ADD COLUMN intended_content_updated_at timestamptz,
    ADD COLUMN last_successful_push_at     timestamptz,

    -- PRD-177 - the last time a run actually RETURNED this listing. Absence from a later
    -- run never changes reported status; this only records when it was last seen.
    ADD COLUMN last_seen_in_discovery_at   timestamptz,

    ADD CONSTRAINT channel_listing_local_lifecycle_check
        CHECK (local_lifecycle IN ('DRAFT', 'PENDING_PUBLICATION', 'PUBLISHED', 'WITHDRAWN'));

COMMENT ON COLUMN channel_listing.local_lifecycle IS
    'PRD-188 ERP-side publication lifecycle. DISTINCT from listing_status, which is '
    'channel-owned (PRD-128). A DRAFT has never been sent and has no external identifier.';

COMMENT ON COLUMN channel_listing.last_seen_in_discovery_at IS
    'PRD-177 - records when a discovery run last RETURNED this listing. 🔴 Absence from a '
    'run is never, by itself, a destructive state change.';


-- -------------------------------------------------------------------------------------
-- E-106 Channel Listing SKU (PRD-190, DM-083, INV-106.*).
--
-- The ORDERABLE unit - what a customer can actually buy on the channel.
--
-- 🔴 INV-106.2 - THE ORDERABLE SKU IS THE MAPPING UNIT. Zero Sellable Products while
--    UNMAPPED, exactly one once MAPPED. Several SKUs MAY map to the same Sellable
--    Product; one SKU NEVER maps to two - enforced by the single nullable column.
-- 🔴 INV-106.3 - channel price and published marketplace stock attach HERE. For a
--    single-SKU listing that is indistinguishable from the listing itself, which is why
--    PRD-029 and PRD-126 were correct and remain so.
-- 🔴 INV-106.5 - this confers NO variant structure on E-058.
-- 🔴 INV-106.6 - this is NOT E-020 Product Variant. variation_label is the channel's own
--    reported label; the axis schema is adapter-owned (PRD-190.g) and is NOT modelled.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_sku (
    id                          uuid           NOT NULL DEFAULT gen_random_uuid(),
    channel_listing_id          uuid           NOT NULL REFERENCES channel_listing (id),

    -- The channel's own SKU identifier. Absent on an ERP-first draft until authored.
    channel_sku                 varchar(160),

    -- INV-106.2 - zero or one. 🔴 Never a join table; two mappings must be unrepresentable.
    sellable_product_id         uuid           REFERENCES sellable_product (id),

    -- INV-106.3 / PRD-193 - channel-facing commercial figures.
    -- 🔴 published_marketplace_stock is MANUAL and is never derived from Inventory.
    channel_price               numeric(19, 2),
    published_marketplace_stock numeric(19, 4),

    reported_price              numeric(19, 2),
    reported_price_readable     boolean        NOT NULL DEFAULT false,
    reported_stock              numeric(19, 4),
    reported_stock_readable     boolean        NOT NULL DEFAULT false,

    -- INV-106.6 - the channel's reported variation label, e.g. "16GB RAM · 512GB SSD".
    -- 🔴 Opaque to Product. No option/axis decomposition is stored.
    variation_label             varchar(400),

    position                    integer        NOT NULL DEFAULT 0,

    created_at                  timestamptz    NOT NULL DEFAULT now(),
    created_by                  uuid           NOT NULL REFERENCES operational_user_profile (id),
    updated_at                  timestamptz    NOT NULL DEFAULT now(),
    updated_by                  uuid           NOT NULL REFERENCES operational_user_profile (id),
    version                     bigint         NOT NULL DEFAULT 0,

    CONSTRAINT channel_listing_sku_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_sku_price_non_negative
        CHECK (channel_price IS NULL OR channel_price >= 0),
    CONSTRAINT channel_listing_sku_stock_non_negative
        CHECK (published_marketplace_stock IS NULL OR published_marketplace_stock >= 0),
    CONSTRAINT channel_listing_sku_reported_price_non_negative
        CHECK (reported_price IS NULL OR reported_price >= 0)
);

COMMENT ON TABLE channel_listing_sku IS
    'E-106 Channel Listing SKU (PRD-190). The ORDERABLE unit and the MAPPING unit. '
    '🔴 INV-106.5: confers no variant structure on E-058. 🔴 INV-106.6: NOT E-020.';

CREATE INDEX channel_listing_sku_listing_idx  ON channel_listing_sku (channel_listing_id);
CREATE INDEX channel_listing_sku_sellable_idx ON channel_listing_sku (sellable_product_id);

-- A channel SKU identifier is unique within its listing where one is present.
CREATE UNIQUE INDEX channel_listing_sku_code_unique
    ON channel_listing_sku (channel_listing_id, LOWER(channel_sku))
    WHERE channel_sku IS NOT NULL;


-- -------------------------------------------------------------------------------------
-- INV-106.1 backfill - every existing listing becomes a single-SKU listing, which is the
-- degenerate case and the shape of every listing held today (PRD-190.a).
--
-- ⚠ PRJ-082 - this ADDS rows carrying the values V5 already held. It rewrites no history
--   and loses nothing: the superseded columns stay exactly as they were.
-- -------------------------------------------------------------------------------------
INSERT INTO channel_listing_sku (channel_listing_id, sellable_product_id, channel_price,
                                 published_marketplace_stock, position,
                                 created_at, created_by, updated_at, updated_by)
SELECT l.id, l.sellable_product_id, l.channel_price, l.published_marketplace_stock, 0,
       l.created_at, l.created_by, l.updated_at, l.updated_by
FROM channel_listing l;


-- -------------------------------------------------------------------------------------
-- E-105 Media Asset (PRD-167, DM-082, INV-105.*).
--
-- 🔴 INV-105.1 - this is NOT E-054 Attachment and is never used as evidence. The boundary
--    is PURPOSE, not file type: an image is not evidence merely because it is an image.
--    E-054's unaltered-as-received and retention rules are NOT inherited here.
-- 🔴 INV-105.5 - carries no storage technology, provider or URL scheme as a business fact.
--    storage_reference IDENTIFIES the media and nothing more (TEC-105).
-- 🔴 INV-105.6 - holds NO role and NO order. Both belong to the REFERENCE, so one asset
--    may be PRIMARY for one product and GALLERY for another.
-- 🔴 INV-105.7 - no retention duration and no purge schedule is defined.
-- -------------------------------------------------------------------------------------
CREATE TABLE media_asset (
    id                uuid         NOT NULL DEFAULT gen_random_uuid(),

    -- INV-105.5 - sufficient to IDENTIFY the media. NOT a provider selection.
    storage_reference varchar(1024) NOT NULL,
    media_type        varchar(120),
    descriptive_text  varchar(400),

    -- PRD-169 - deliberately two values. No draft, pending or approval state.
    lifecycle_status  varchar(16)  NOT NULL DEFAULT 'ACTIVE',

    created_at        timestamptz  NOT NULL DEFAULT now(),
    created_by        uuid         NOT NULL REFERENCES operational_user_profile (id),

    CONSTRAINT media_asset_pkey PRIMARY KEY (id),
    CONSTRAINT media_asset_reference_not_blank CHECK (length(trim(storage_reference)) > 0),
    CONSTRAINT media_asset_lifecycle_check CHECK (lifecycle_status IN ('ACTIVE', 'ARCHIVED'))
);

COMMENT ON TABLE media_asset IS
    'E-105 Media Asset (PRD-167). Product-owned reusable COMMERCIAL media. '
    '🔴 NOT E-054 Attachment - the boundary is purpose, not file type (INV-105.1). '
    '🔴 Carries no storage technology (INV-105.5, TEC-105).';

CREATE INDEX media_asset_lifecycle_idx ON media_asset (lifecycle_status);


-- -------------------------------------------------------------------------------------
-- E-058 master media references (PRD-168, INV-58.7).
--
-- 🔴 At most ONE PRIMARY per Sellable Product - enforced by a partial unique index so no
--    application path can produce two (INV-58.7).
-- 🔴 PRIMARY is OPTIONAL and is never auto-selected (PRD-168.b, PRD-168.c). Nothing in
--    this schema promotes a GALLERY row.
-- 🔴 Order is EXPLICIT and never inferred from insertion order (PRD-168.d).
-- -------------------------------------------------------------------------------------
CREATE TABLE sellable_product_media (
    id                  uuid    NOT NULL DEFAULT gen_random_uuid(),
    sellable_product_id uuid    NOT NULL REFERENCES sellable_product (id),
    media_asset_id      uuid    NOT NULL REFERENCES media_asset (id),
    media_role          varchar(16) NOT NULL,
    position            integer NOT NULL DEFAULT 0,

    CONSTRAINT sellable_product_media_pkey PRIMARY KEY (id),
    CONSTRAINT sellable_product_media_role_check CHECK (media_role IN ('PRIMARY', 'GALLERY')),
    CONSTRAINT sellable_product_media_once UNIQUE (sellable_product_id, media_asset_id)
);

CREATE UNIQUE INDEX sellable_product_media_one_primary_idx
    ON sellable_product_media (sellable_product_id)
    WHERE media_role = 'PRIMARY';

CREATE INDEX sellable_product_media_product_idx ON sellable_product_media (sellable_product_id);


-- -------------------------------------------------------------------------------------
-- E-059 INTENDED listing media (PRD-170).
--
-- 🔴 An ALL-OR-NOTHING override set (PRD-170.d). Where no row exists for a listing the
--    effective media DERIVES from the mapped Sellable Product (PRD-170).
-- 🔴 The fallback is NEVER materialised here (PRD-170.b) - copying master rows would make
--    a fallback indistinguishable from a deliberate override the moment the master changed.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_intended_media (
    id                 uuid    NOT NULL DEFAULT gen_random_uuid(),
    channel_listing_id uuid    NOT NULL REFERENCES channel_listing (id),
    media_asset_id     uuid    NOT NULL REFERENCES media_asset (id),
    media_role         varchar(16) NOT NULL,
    position           integer NOT NULL DEFAULT 0,

    CONSTRAINT channel_listing_intended_media_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_intended_media_role_check
        CHECK (media_role IN ('PRIMARY', 'GALLERY')),
    CONSTRAINT channel_listing_intended_media_once
        UNIQUE (channel_listing_id, media_asset_id)
);

CREATE UNIQUE INDEX channel_listing_intended_media_one_primary_idx
    ON channel_listing_intended_media (channel_listing_id)
    WHERE media_role = 'PRIMARY';

CREATE INDEX channel_listing_intended_media_listing_idx
    ON channel_listing_intended_media (channel_listing_id);


-- -------------------------------------------------------------------------------------
-- E-059 CHANNEL-REPORTED media (PRD-182, INV-59.10).
--
-- 🔴 NOT E-105 Media Asset (PRD-182.b). Ingesting a marketplace image does not make it
--    Trioloo's authored asset, so a reported image is a MIRRORED EXTERNAL REFERENCE and
--    deliberately holds no media_asset_id.
-- 🔴 Never writes into E-058 master media, silently or otherwise (PRD-182.c).
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_reported_media (
    id                 uuid          NOT NULL DEFAULT gen_random_uuid(),
    channel_listing_id uuid          NOT NULL REFERENCES channel_listing (id),
    external_reference varchar(1024) NOT NULL,
    position           integer       NOT NULL DEFAULT 0,
    reported_at        timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT channel_listing_reported_media_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_reported_media_ref_not_blank
        CHECK (length(trim(external_reference)) > 0)
);

COMMENT ON TABLE channel_listing_reported_media IS
    'PRD-182 channel-reported media. 🔴 A mirrored external reference, NOT an E-105 asset '
    '(PRD-182.b), and it never writes into E-058 master media (PRD-182.c).';

CREATE INDEX channel_listing_reported_media_listing_idx
    ON channel_listing_reported_media (channel_listing_id);


-- -------------------------------------------------------------------------------------
-- PRD-192 - channel attributes, intended and reported.
--
-- 🔴 Never Stock Item technical truth (PRD-192.b). A marketplace attribute is what the
--    channel needs to publish a listing; E-020's technical identity is a different fact.
-- ⚠ Deliberately a NEUTRAL key/value pair. The channel-specific schema, requiredness and
--   validation are adapter capability (PRD-192.d) and are NOT modelled here.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_attribute (
    id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
    channel_listing_id uuid        NOT NULL REFERENCES channel_listing (id),
    attribute_key      varchar(160) NOT NULL,
    intended_value     varchar(1024),
    reported_value     varchar(1024),
    reported_readable  boolean     NOT NULL DEFAULT false,
    position           integer     NOT NULL DEFAULT 0,

    CONSTRAINT channel_listing_attribute_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_attribute_key_not_blank
        CHECK (length(trim(attribute_key)) > 0),
    CONSTRAINT channel_listing_attribute_once
        UNIQUE (channel_listing_id, attribute_key)
);

CREATE INDEX channel_listing_attribute_listing_idx
    ON channel_listing_attribute (channel_listing_id);


-- -------------------------------------------------------------------------------------
-- PRD-125 / API-063 - adapter capability declared per FIELD and per DIRECTION.
--
-- ⚠ Capability varies by channel instance, by field and by direction. It is NEVER a
--   property of a channel TYPE: "all Daraz shops behave alike" is exactly the universal
--   statement PRD-125 refuses.
-- 🔴 An absent row means the capability is UNDECLARED - not that it is supported.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_adapter_capability (
    id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
    channel_instance_id uuid        NOT NULL REFERENCES channel_instance (id),
    field_key           varchar(80) NOT NULL,
    readable            boolean     NOT NULL DEFAULT false,
    writable            boolean     NOT NULL DEFAULT false,

    CONSTRAINT channel_adapter_capability_pkey PRIMARY KEY (id),
    CONSTRAINT channel_adapter_capability_once
        UNIQUE (channel_instance_id, field_key)
);

COMMENT ON TABLE channel_adapter_capability IS
    'PRD-125 / API-063 field-level adapter capability. 🔴 Declared per channel INSTANCE, '
    'never per channel type. An absent row means UNDECLARED, not supported.';


-- -------------------------------------------------------------------------------------
-- E-108 Channel Listing Operation Batch (PRD-186, DM-083, INV-108.*).
--
-- 🔴 INV-108.2 - the aggregate outcome is DERIVED from members and is NEVER stored. There
--    is deliberately no succeeded/failed counter column below (DB-001).
-- 🔴 INV-108.4 - scope is an EXPLICIT selection. A batch never expands itself to sibling
--    listings sharing a Sellable Product.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_operation_batch (
    id             uuid        NOT NULL DEFAULT gen_random_uuid(),
    operation_kind varchar(32) NOT NULL,
    requested_by   uuid        NOT NULL REFERENCES operational_user_profile (id),
    requested_at   timestamptz NOT NULL DEFAULT now(),
    completed_at   timestamptz,

    -- INV-108.4 - a human-readable record of the explicit selection that produced it.
    scope_description varchar(600),

    CONSTRAINT channel_listing_operation_batch_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_operation_batch_kind_check
        CHECK (operation_kind IN ('DISCOVER', 'REFRESH', 'PUSH_UPDATE', 'PUBLISH_CREATE', 'WITHDRAW'))
);

COMMENT ON TABLE channel_listing_operation_batch IS
    'E-108 (PRD-186). 🔴 INV-108.1: NOT atomic across an external party - partial success '
    'is normal. 🔴 INV-108.2: aggregate outcome DERIVED from members, never stored.';


-- -------------------------------------------------------------------------------------
-- E-107 Channel Listing Operation (PRD-186, DM-083, INV-107.*).
--
-- 🔴 INV-107.1 - ONE record per listing per requested remote act. Outcomes are retained
--    individually and are NEVER collapsed into an aggregate.
-- 🔴 INV-107.2 - a failed sibling never makes a succeeded record appear failed.
-- 🔴 INV-107.4 - never carries or duplicates the SYSTEM-owned listing sync state. An
--    operation is an attempt with an outcome; sync state is the listing's standing
--    position relative to the channel (SYS §7.1, PRD-185.d).
-- 🔴 INV-107.5 - attribution captured at write time, never reconstructed (PRJ-130).
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_operation (
    id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
    channel_listing_id uuid        NOT NULL REFERENCES channel_listing (id),
    batch_id           uuid        REFERENCES channel_listing_operation_batch (id),

    operation_kind     varchar(32) NOT NULL,
    direction          varchar(16) NOT NULL,
    outcome            varchar(24) NOT NULL DEFAULT 'REQUESTED',

    -- The operator-facing reason. 🔴 Never a generic failure string (PRJ-200).
    detail             varchar(1200),

    -- SYS-046 / API-029 - what the adapter reported, from whom, when, in what form.
    adapter_provenance varchar(1200),

    requested_by       uuid        NOT NULL REFERENCES operational_user_profile (id),
    requested_at       timestamptz NOT NULL DEFAULT now(),
    completed_at       timestamptz,

    CONSTRAINT channel_listing_operation_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_operation_kind_check
        CHECK (operation_kind IN ('DISCOVER', 'REFRESH', 'PUSH_UPDATE', 'PUBLISH_CREATE', 'WITHDRAW')),
    CONSTRAINT channel_listing_operation_direction_check
        CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    CONSTRAINT channel_listing_operation_outcome_check
        CHECK (outcome IN ('REQUESTED', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED',
                           'MANUAL_REQUIRED', 'DIVERGED'))
);

COMMENT ON TABLE channel_listing_operation IS
    'E-107 (PRD-186). One record per listing per requested remote act. 🔴 INV-107.1: '
    'outcomes never collapsed. 🔴 INV-107.4: never duplicates the SYSTEM-owned sync state.';

CREATE INDEX channel_listing_operation_listing_idx ON channel_listing_operation (channel_listing_id);
CREATE INDEX channel_listing_operation_batch_idx   ON channel_listing_operation (batch_id);
CREATE INDEX channel_listing_operation_outcome_idx ON channel_listing_operation (outcome);


-- -------------------------------------------------------------------------------------
-- PRD-129 as extended by PRD-186.e - the listing's activity history.
--
-- THREE kinds share one chronology:
--   FIELD_CHANGE   - a local intended edit, with before/after (DB-068, PRD-091)
--   CHANNEL_EVENT  - an occurrence with NO before value: suspension, rejection, policy
--                    violation. Recording only field changes would lose precisely the
--                    events that matter most (PRD-129).
--   OPERATION      - a requested act with an outcome, which is neither of the above.
--
-- ✅ This is an ACTIVITY log, not an audit log (AUD-001, INV-107.3), and it replaces no
--    audit obligation (PRD-095, AUD §12.2).
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_activity (
    id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
    channel_listing_id uuid        NOT NULL REFERENCES channel_listing (id),
    entry_kind         varchar(20) NOT NULL,

    summary            varchar(600) NOT NULL,
    field_key          varchar(120),
    before_value       varchar(1024),
    after_value        varchar(1024),

    -- "Daraz adapter", "Batch edit", "Scheduled sync" - the operational origin.
    source             varchar(160),

    -- NULL actor means the marketplace or the scheduler acted, not a person.
    actor_id           uuid        REFERENCES operational_user_profile (id),
    operation_id       uuid        REFERENCES channel_listing_operation (id),
    batch_id           uuid        REFERENCES channel_listing_operation_batch (id),
    occurred_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT channel_listing_activity_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_activity_kind_check
        CHECK (entry_kind IN ('FIELD_CHANGE', 'CHANNEL_EVENT', 'OPERATION'))
);

CREATE INDEX channel_listing_activity_listing_idx
    ON channel_listing_activity (channel_listing_id, occurred_at DESC);


-- -------------------------------------------------------------------------------------
-- PRD-196 - the outbound and synchronisation capability codes.
--
-- Derived from PRM-089's <owning-module>.<resource>.<action> shape and named by the
-- owning module (PRM-007). 🔴 Implementation may never coin a code (PRM-089.f).
--
-- 🔴 THE FOUR ARE INDEPENDENT. `manage` NEVER implies `publish` (PRD-196.a): local
--    editing authority must not silently carry the authority to change what customers
--    see on seven marketplaces.
--
-- 🔴 DEFINITIONS ONLY - NO GRANT IS CREATED. PRM-003: absence of a grant is a denial.
-- -------------------------------------------------------------------------------------
INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'product.channel-listing.publish',
     'OUTBOUND MARKETPLACE MUTATION - push an update, publish a new listing, withdraw one, '
     'and Push ERP Version at single or batch scope. Required for every outbound act at '
     'every scope; never implied by manage (PRD-196).'),
    (gen_random_uuid(), 'product.channel-listing.sync',
     'Request inbound discovery or refresh for a channel instance, a listing or a selection. '
     'Confers NO outbound authority (PRD-196.d).');
