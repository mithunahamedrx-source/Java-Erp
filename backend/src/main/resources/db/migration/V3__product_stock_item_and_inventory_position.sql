-- =====================================================================================
-- V3 - Product Stock Item (E-020) and the minimum Inventory position foundation.
--
-- Owning architecture:
--   PRODUCT_ARCHITECTURE.md   - E-020 Product Variant / Inventory Product (PRD-015)
--   INVENTORY_ARCHITECTURE.md - movements and derived positions (IVN-002, IVN-015)
--   INVENTORY_COSTING         - valuation (ICO-001 weighted average cost)
--
-- 🔴 DB-001 / IVN-002 - NO STOCK FIGURE IS STORED. There is deliberately no
--    stock_quantity, current_balance, on_hand, available_balance, stock_value or
--    out_of_stock column anywhere below. Every quantity and every valuation is
--    DERIVED from movements at query time.
--
-- 🔴 No business data is seeded. No product, warehouse, movement, opening stock or
--    role grant is created. GAP-109 (opening balances) is untouched.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- E-020 Product Variant - the "Inventory Product" / Stock Item (PRD-015).
-- PRODUCT-owned. Inventory owns movements AGAINST it; it is not the stock ledger.
-- -------------------------------------------------------------------------------------
CREATE TABLE product_variant (
    id                   uuid         NOT NULL DEFAULT gen_random_uuid(),

    -- PRD-011 - Inventory SKU is a separate identifier space from the Sellable SKU.
    -- PRD-013 - a retired SKU is never reissued, so uniqueness is unconditional and
    -- survives archival.
    inventory_sku        varchar(64)  NOT NULL,

    -- PRD-017 - precise and technical. Never the market-facing name.
    technical_name       varchar(255) NOT NULL,

    brand                varchar(120),
    inventory_category   varchar(120),

    -- DB-040 - quantity is always expressed in the component's unit of measure.
    unit_of_measure      varchar(32)  NOT NULL,

    -- §8.3 identity. Text, never numeric: API-058 requires leading zeros to survive.
    barcode              varchar(64),

    -- PRD-106 - serial recording is optional and never mandatory.
    serialization_policy varchar(24)  NOT NULL DEFAULT 'NOT_SERIALIZED',

    -- §8.4 - component items only.
    component_class      varchar(48),

    -- SYS §7.1 master record lifecycle. PRD-062: archived, never deleted.
    record_status        varchar(16)  NOT NULL DEFAULT 'DRAFT',

    -- AGV-001 - attribution captured at write time, never reconstructed from logs.
    created_at           timestamptz  NOT NULL DEFAULT now(),
    created_by           uuid         NOT NULL REFERENCES operational_user_profile (id),
    updated_at           timestamptz  NOT NULL DEFAULT now(),
    updated_by           uuid         NOT NULL REFERENCES operational_user_profile (id),

    -- Optimistic concurrency: a bulk CSV import and an interactive edit can collide.
    version              bigint       NOT NULL DEFAULT 0,

    CONSTRAINT product_variant_pkey PRIMARY KEY (id),
    CONSTRAINT product_variant_sku_unique UNIQUE (inventory_sku),
    CONSTRAINT product_variant_status_check
        CHECK (record_status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT product_variant_serialization_check
        CHECK (serialization_policy IN ('NOT_SERIALIZED', 'SERIALIZED')),
    CONSTRAINT product_variant_sku_not_blank CHECK (length(trim(inventory_sku)) > 0),
    CONSTRAINT product_variant_name_not_blank CHECK (length(trim(technical_name)) > 0),
    CONSTRAINT product_variant_uom_not_blank CHECK (length(trim(unit_of_measure)) > 0)
);

COMMENT ON TABLE product_variant IS
    'E-020 Product Variant / Inventory Product (PRD-015). Product-owned. 🔴 Holds NO stock '
    'figure and NO valuation - both derive from inventory_movement per DB-001 / IVN-002.';

-- Canonical query support: the Stock Items workspace filters on status, category and
-- brand, and searches on SKU, technical name and barcode (PRD-149, UX-039.a).
CREATE INDEX product_variant_status_idx   ON product_variant (record_status);
CREATE INDEX product_variant_category_idx ON product_variant (inventory_category);
CREATE INDEX product_variant_brand_idx    ON product_variant (brand);
CREATE INDEX product_variant_barcode_idx  ON product_variant (barcode);
CREATE INDEX product_variant_name_idx     ON product_variant (lower(technical_name));


-- -------------------------------------------------------------------------------------
-- E-028 Inventory Movement - the authoritative inventory fact (IVN-015).
--
-- 🔴 IVN-016 - append-only and permanent. There is no UPDATE or DELETE path, and
--    IVN-005 forbids editing a historical movement: correction is by a new adjustment.
--
-- 🔴 IVN-017 - the movement-type set is CLOSED. The CHECK below enumerates exactly the
--    ratified set and adds nothing. No module implemented in P1 can create a movement,
--    so this table is legitimately empty and every position derives to a truthful zero.
-- -------------------------------------------------------------------------------------
CREATE TABLE inventory_movement (
    id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
    product_variant_id uuid        NOT NULL REFERENCES product_variant (id),

    -- Signed. Positive is into inventory, negative is out. The quantity is the fact;
    -- the balance is the computation (IVN-015).
    quantity           numeric(19, 4) NOT NULL,

    movement_type      varchar(48) NOT NULL,
    occurred_at        timestamptz NOT NULL DEFAULT now(),

    -- IVN-036 - every movement is attributable to an Operational User Profile.
    recorded_by        uuid        NOT NULL REFERENCES operational_user_profile (id),

    -- ICO-001 weighted average cost is derived from acquisition movements. Unit cost is
    -- recorded on the movement that acquired the stock; it is NEVER maintained on the
    -- product (ICO-002). NULL where the movement is not an acquisition.
    unit_cost          numeric(19, 4),

    CONSTRAINT inventory_movement_pkey PRIMARY KEY (id),
    CONSTRAINT inventory_movement_quantity_nonzero CHECK (quantity <> 0),
    CONSTRAINT inventory_movement_unit_cost_nonnegative CHECK (unit_cost IS NULL OR unit_cost >= 0),
    CONSTRAINT inventory_movement_type_check CHECK (movement_type IN (
        'GOODS_RECEIPT_ACCEPTED',
        'SALE_DELIVERED',
        'BUILD_CONSUMED_COMPONENT',
        'BUILD_COMPLETED',
        'RETURN_RECEIVED',
        'QC_DISPOSITION_EXECUTED',
        'EXCHANGE_REPLACEMENT',
        'WARRANTY_REPLACEMENT',
        'REPAIR_CONSUMED_COMPONENT',
        'TRADE_IN_COMPONENT_CREATED',
        'STOCK_ADJUSTMENT',
        'SCRAP'
    ))
);

COMMENT ON TABLE inventory_movement IS
    'E-028 Inventory Movement (IVN-015). Append-only and permanent (IVN-016). 🔴 The '
    'movement is the record; the quantity is the computation. The type set is IVN-017''s '
    'closed set and nothing was added to it.';

CREATE INDEX inventory_movement_variant_idx ON inventory_movement (product_variant_id);
CREATE INDEX inventory_movement_occurred_idx ON inventory_movement (occurred_at);


-- -------------------------------------------------------------------------------------
-- E-027 Stock Reservation - IVN-012's "Reserved" condition, IVN-014 reserved at order
-- confirmation. Available Quantity = physical - active reservations.
--
-- No module implemented in P1 creates a reservation, so this table is legitimately
-- empty and Available equals Physical until Orders exist.
-- -------------------------------------------------------------------------------------
CREATE TABLE stock_reservation (
    id                 uuid           NOT NULL DEFAULT gen_random_uuid(),
    product_variant_id uuid           NOT NULL REFERENCES product_variant (id),
    quantity           numeric(19, 4) NOT NULL,
    reserved_at        timestamptz    NOT NULL DEFAULT now(),
    reserved_by        uuid           NOT NULL REFERENCES operational_user_profile (id),
    released_at        timestamptz,

    CONSTRAINT stock_reservation_pkey PRIMARY KEY (id),
    CONSTRAINT stock_reservation_quantity_positive CHECK (quantity > 0)
);

COMMENT ON TABLE stock_reservation IS
    'E-027 Stock Reservation. Reserved is one of exactly three not-sellable conditions '
    '(IVN-012); IVN-013 forbids inventing a fourth.';

CREATE INDEX stock_reservation_variant_idx ON stock_reservation (product_variant_id)
    WHERE released_at IS NULL;


-- -------------------------------------------------------------------------------------
-- Permission catalogue entries for the three P1 capabilities.
--
-- PRM-089 naming convention; named by their OWNING modules at PRD-154 and ICO-038.
--
-- 🔴 DEFINITIONS ONLY - NO GRANT IS CREATED. No role receives these, no user receives
--    these. PRM-003: absence of a grant is a denial, so the system starts closed and
--    authority is configured deliberately. This creates no superuser and touches
--    GAP-120 / GAP-121 / GAP-122 not at all.
-- -------------------------------------------------------------------------------------
INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'product.stock-item.view',
     'View, search, filter, list, read detail and export authorised Stock Item facts (PRD-154).'),
    (gen_random_uuid(), 'product.stock-item.manage',
     'Create a Stock Item and update it where the Product lifecycle permits (PRD-154).'),
    (gen_random_uuid(), 'inventory-costing.valuation.view',
     'View and export cost-sensitive inventory valuation: item Stock Value, Total Stock Value '
     'and weighted average cost where the contract permits. Read-only (ICO-038).');
