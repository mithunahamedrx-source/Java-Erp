-- =====================================================================================
-- V16 - Channel Order import snapshots.
--
-- Scope:
--   Inbound, API-managed marketplace order snapshots only. No scheduler, no webhook,
--   no canonical ERP order lifecycle progression, no customer master write, no inventory
--   movement, no payment settlement and no shipment action.
-- =====================================================================================

CREATE TABLE channel_order (
    id                                      uuid          NOT NULL DEFAULT gen_random_uuid(),
    channel_instance_id                     uuid          NOT NULL REFERENCES channel_instance (id),
    external_order_id                       varchar(80)   NOT NULL,
    order_number                            varchar(120),
    ownership                               varchar(32)   NOT NULL DEFAULT 'API_MANAGED',

    statuses_json                           jsonb         NOT NULL DEFAULT '[]'::jsonb,
    provider_created_at                     timestamptz,
    provider_updated_at                     timestamptz,
    imported_at                             timestamptz   NOT NULL DEFAULT now(),
    last_seen_at                            timestamptz   NOT NULL DEFAULT now(),

    price                                   numeric(19, 2),
    shipping_fee                            numeric(19, 2),
    shipping_fee_original                   numeric(19, 2),
    shipping_fee_discount_platform          numeric(19, 2),
    shipping_fee_discount_seller            numeric(19, 2),
    voucher                                 numeric(19, 2),
    voucher_platform                        numeric(19, 2),
    voucher_seller                          numeric(19, 2),
    cash_payment_fee                        numeric(19, 2),

    payment_method                          varchar(160),
    voucher_code                            varchar(160),
    items_count                             integer,
    promised_shipping_times                 varchar(255),
    warehouse_code                          varchar(120),
    delivery_info                           varchar(255),
    buyer_note                              text,
    remarks                                 text,
    gift_option                             varchar(80),
    gift_message                            text,
    national_registration_number1           varchar(160),
    branch_number                           varchar(160),
    tax_code                                varchar(160),
    extra_attributes                        text,

    customer_first_name                     varchar(255),
    customer_last_name                      varchar(255),

    billing_first_name                      varchar(255),
    billing_last_name                       varchar(255),
    billing_phone                           varchar(80),
    billing_phone2                          varchar(80),
    billing_address1                        text,
    billing_address2                        text,
    billing_address3                        text,
    billing_address4                        text,
    billing_address5                        text,
    billing_city                            varchar(160),
    billing_post_code                       varchar(80),
    billing_country                         varchar(120),

    shipping_first_name                     varchar(255),
    shipping_last_name                      varchar(255),
    shipping_phone                          varchar(80),
    shipping_phone2                         varchar(80),
    shipping_address1                       text,
    shipping_address2                       text,
    shipping_address3                       text,
    shipping_address4                       text,
    shipping_address5                       text,
    shipping_city                           varchar(160),
    shipping_post_code                      varchar(80),
    shipping_country                        varchar(120),

    version                                 bigint        NOT NULL DEFAULT 0,

    CONSTRAINT channel_order_pkey PRIMARY KEY (id),
    CONSTRAINT channel_order_external_not_blank CHECK (length(trim(external_order_id)) > 0),
    CONSTRAINT channel_order_identity_unique UNIQUE (channel_instance_id, external_order_id),
    CONSTRAINT channel_order_ownership_check CHECK (ownership IN ('API_MANAGED')),
    CONSTRAINT channel_order_money_non_negative CHECK (
        (price IS NULL OR price >= 0)
        AND (shipping_fee IS NULL OR shipping_fee >= 0)
        AND (shipping_fee_original IS NULL OR shipping_fee_original >= 0)
        AND (shipping_fee_discount_platform IS NULL OR shipping_fee_discount_platform >= 0)
        AND (shipping_fee_discount_seller IS NULL OR shipping_fee_discount_seller >= 0)
        AND (voucher IS NULL OR voucher >= 0)
        AND (voucher_platform IS NULL OR voucher_platform >= 0)
        AND (voucher_seller IS NULL OR voucher_seller >= 0)
        AND (cash_payment_fee IS NULL OR cash_payment_fee >= 0)
    ),
    CONSTRAINT channel_order_items_count_non_negative CHECK (items_count IS NULL OR items_count >= 0)
);

COMMENT ON TABLE channel_order IS
    'Inbound channel order snapshot. API_MANAGED only in the MVP: it mirrors what the channel '
    'reported and does not create product, inventory, payment, settlement or shipment effects.';

CREATE INDEX channel_order_channel_idx ON channel_order (channel_instance_id);
CREATE INDEX channel_order_external_idx ON channel_order (external_order_id);
CREATE INDEX channel_order_provider_updated_idx ON channel_order (provider_updated_at);
CREATE INDEX channel_order_seen_idx ON channel_order (last_seen_at);
CREATE INDEX channel_order_imported_idx ON channel_order (imported_at);
CREATE INDEX channel_order_statuses_idx ON channel_order USING gin (statuses_json);

CREATE TABLE channel_order_item (
    id                       uuid          NOT NULL DEFAULT gen_random_uuid(),
    channel_order_id          uuid          NOT NULL REFERENCES channel_order (id),
    external_order_item_id    varchar(80)   NOT NULL,
    external_order_id         varchar(80)   NOT NULL,

    sku                       varchar(160),
    shop_sku                  varchar(160),
    sku_id                    varchar(120),
    item_name                 text,
    variation                 varchar(255),
    item_price                numeric(19, 2),
    paid_price                numeric(19, 2),
    status                    varchar(80),
    reason                    varchar(255),
    tracking_code             varchar(160),
    shipment_provider         varchar(160),
    shipping_provider_type    varchar(80),
    invoice_number            varchar(160),
    purchase_order_id         varchar(160),
    digital_delivery_info     text,
    provider_created_at       timestamptz,
    provider_updated_at       timestamptz,

    imported_at               timestamptz   NOT NULL DEFAULT now(),
    last_seen_at              timestamptz   NOT NULL DEFAULT now(),
    version                   bigint        NOT NULL DEFAULT 0,

    CONSTRAINT channel_order_item_pkey PRIMARY KEY (id),
    CONSTRAINT channel_order_item_external_not_blank CHECK (length(trim(external_order_item_id)) > 0),
    CONSTRAINT channel_order_item_identity_unique UNIQUE (channel_order_id, external_order_item_id),
    CONSTRAINT channel_order_item_money_non_negative CHECK (
        (item_price IS NULL OR item_price >= 0)
        AND (paid_price IS NULL OR paid_price >= 0)
    )
);

COMMENT ON TABLE channel_order_item IS
    'Inbound channel order item snapshot. It is idempotent under one channel order and carries '
    'no product, inventory, shipment or settlement authority.';

CREATE INDEX channel_order_item_order_idx ON channel_order_item (channel_order_id);
CREATE INDEX channel_order_item_external_order_idx ON channel_order_item (external_order_id);
CREATE INDEX channel_order_item_sku_idx ON channel_order_item (sku);
CREATE INDEX channel_order_item_shop_sku_idx ON channel_order_item (shop_sku);
CREATE INDEX channel_order_item_status_idx ON channel_order_item (status);

INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'order.channel-order.view',
     'View read-only inbound Channel Order dashboard and detail facts (PRM-091).'),
    (gen_random_uuid(), 'order.channel-order.sync',
     'Initiate inbound Channel Order pull, probe, incremental poll or backfill; grants no Order mutation, '
     'inventory movement, payment or settlement action, shipment action or marketplace write (PRM-091).');
