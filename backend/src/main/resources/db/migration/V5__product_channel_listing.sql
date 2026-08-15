-- =====================================================================================
-- V5 - Stage P3. Product Channel Listing (E-059).
--
-- Scope:
--   Product-owned listing records only. No marketplace sync engine, no channel adapter, no
--   channel management UI, no fake listings, and no seeded channel instances.
-- =====================================================================================

CREATE TABLE channel_instance (
    id            uuid         NOT NULL DEFAULT gen_random_uuid(),
    code          varchar(80)  NOT NULL,
    name          varchar(160) NOT NULL,
    channel_type  varchar(80)  NOT NULL,
    record_status varchar(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT channel_instance_pkey PRIMARY KEY (id),
    CONSTRAINT channel_instance_code_unique UNIQUE (code),
    CONSTRAINT channel_instance_code_not_blank CHECK (length(trim(code)) > 0),
    CONSTRAINT channel_instance_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT channel_instance_type_not_blank CHECK (length(trim(channel_type)) > 0),
    CONSTRAINT channel_instance_status_check
        CHECK (record_status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);

COMMENT ON TABLE channel_instance IS
    'E-016 Channel Instance registered reference. V5 adds the minimum persistence required '
    'for E-059 to resolve its channel instance. No channel configuration UI, adapter, '
    'credentials or seed data is created.';

CREATE TABLE channel_listing (
    id                            uuid           NOT NULL DEFAULT gen_random_uuid(),
    sellable_product_id           uuid           NOT NULL REFERENCES sellable_product (id),
    channel_instance_id           uuid           NOT NULL REFERENCES channel_instance (id),
    external_listing_id           varchar(160)   NOT NULL,

    intended_title                varchar(255),
    channel_price                 numeric(19, 2),
    published_marketplace_stock   numeric(19, 4),
    publication_intent            varchar(80),

    channel_reported_title        varchar(255),
    listing_status                varchar(32),
    sync_state                    varchar(32)    NOT NULL DEFAULT 'PENDING',
    last_sync_at                  timestamptz,

    created_at                    timestamptz    NOT NULL DEFAULT now(),
    created_by                    uuid           NOT NULL REFERENCES operational_user_profile (id),
    updated_at                    timestamptz    NOT NULL DEFAULT now(),
    updated_by                    uuid           NOT NULL REFERENCES operational_user_profile (id),
    version                       bigint         NOT NULL DEFAULT 0,

    CONSTRAINT channel_listing_pkey PRIMARY KEY (id),
    CONSTRAINT channel_listing_external_not_blank CHECK (length(trim(external_listing_id)) > 0),
    CONSTRAINT channel_listing_external_unique_per_instance
        UNIQUE (channel_instance_id, external_listing_id),
    CONSTRAINT channel_listing_price_non_negative
        CHECK (channel_price IS NULL OR channel_price >= 0),
    CONSTRAINT channel_listing_published_stock_non_negative
        CHECK (published_marketplace_stock IS NULL OR published_marketplace_stock >= 0),
    CONSTRAINT channel_listing_status_check
        CHECK (listing_status IS NULL OR listing_status IN ('ACTIVE', 'SUSPENDED', 'REJECTED')),
    CONSTRAINT channel_listing_sync_state_check
        CHECK (sync_state IN ('PENDING', 'IN_PROGRESS', 'SYNCED', 'FAILED',
                              'MANUAL_REQUIRED', 'DIVERGED'))
);

COMMENT ON TABLE channel_listing IS
    'E-059 Channel Listing. One channel instance representation of one E-058 Sellable '
    'Product. External listing identifiers are unique within the issuing channel instance, '
    'not globally. Channel-owned fields are mirrored and read-only through Product commands.';

CREATE INDEX channel_listing_sellable_idx ON channel_listing (sellable_product_id);
CREATE INDEX channel_listing_channel_idx ON channel_listing (channel_instance_id);
CREATE INDEX channel_listing_status_idx ON channel_listing (listing_status);
CREATE INDEX channel_listing_sync_state_idx ON channel_listing (sync_state);

INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'product.channel-listing.view',
     'View, search, filter, list, read detail and export authorised Channel Listing facts (PRD-162).'),
    (gen_random_uuid(), 'product.channel-listing.manage',
     'Create a Channel Listing and update Product-owned listing facts where the lifecycle permits; '
     'CSV import consumes this capability and adds no separate CSV authority (PRD-162).');
