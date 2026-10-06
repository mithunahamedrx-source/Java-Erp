-- =====================================================================================
-- V44 - WAREHOUSE (E-004), STOCK LOCATION (E-005) AND SUPPLIER (E-025): the master data Inventory and Procurement stand on.
--
-- Owner decision, 2026-10-06: build the remaining Inventory modules in small tasks, master data first. Recorded as
-- WHS-074 (Warehouse), PRC-067 (Supplier) and PRM-099 (their capabilities).
--
-- 🔴 None of these holds a stock figure: stock exists only within a warehouse (INV-4.1) but is DERIVED from movements
-- (DB-001); nothing here is a balance. 🔴 Nothing is ever deleted: a record referenced by history is ARCHIVED (INV-4.3,
-- INV-25.2, SYS-024), so there is no delete path at all.
-- =====================================================================================
CREATE TABLE warehouse (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier    varchar(32)  NOT NULL,
    name          varchar(160) NOT NULL,
    address       varchar(400),
    record_status varchar(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    created_by    uuid         NOT NULL REFERENCES operational_user_profile (id),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    updated_by    uuid         NOT NULL REFERENCES operational_user_profile (id),
    version       bigint       NOT NULL DEFAULT 0,
    CONSTRAINT warehouse_status_check CHECK (record_status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT warehouse_identifier_not_blank CHECK (length(trim(identifier)) > 0),
    CONSTRAINT warehouse_name_not_blank CHECK (length(trim(name)) > 0)
);
CREATE UNIQUE INDEX warehouse_identifier_unique ON warehouse (lower(identifier));

CREATE TABLE stock_location (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id  uuid         NOT NULL REFERENCES warehouse (id),
    identifier    varchar(64)  NOT NULL,
    description   varchar(200),
    location_type varchar(24)  NOT NULL,
    -- INV-5.2 - the flag is authoritative. WHS-008: only Storage is established as sellable; Quarantine NEVER is; the
    -- other types are not established as sellable, so none is.
    sellable      boolean      NOT NULL,
    record_status varchar(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    created_by    uuid         NOT NULL REFERENCES operational_user_profile (id),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    updated_by    uuid         NOT NULL REFERENCES operational_user_profile (id),
    version       bigint       NOT NULL DEFAULT 0,
    CONSTRAINT stock_location_type_check
        CHECK (location_type IN ('STORAGE', 'STAGING', 'DESPATCH', 'QUARANTINE', 'SCRAP', 'BUILD_STAGING')),
    CONSTRAINT stock_location_sellable_by_type CHECK (sellable = (location_type = 'STORAGE')),
    CONSTRAINT stock_location_status_check CHECK (record_status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT stock_location_identifier_not_blank CHECK (length(trim(identifier)) > 0)
);
CREATE UNIQUE INDEX stock_location_identifier_unique ON stock_location (lower(identifier));
CREATE INDEX stock_location_warehouse_idx ON stock_location (warehouse_id);

CREATE TABLE supplier (
    id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name               varchar(200) NOT NULL,
    contact_name       varchar(160),
    phone              varchar(64),
    email              varchar(160),
    address            varchar(400),
    -- E-025 attribute "currency". Taka is the business currency; a supplier may name another.
    currency           varchar(3)   NOT NULL DEFAULT 'BDT',
    -- E-025 "supplier reference identifiers": how the supplier refers to us / their own code.
    external_reference varchar(120),
    -- E-025 "active period".
    active_from        date,
    active_until       date,
    record_status      varchar(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at         timestamptz  NOT NULL DEFAULT now(),
    created_by         uuid         NOT NULL REFERENCES operational_user_profile (id),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    updated_by         uuid         NOT NULL REFERENCES operational_user_profile (id),
    version            bigint       NOT NULL DEFAULT 0,
    CONSTRAINT supplier_status_check CHECK (record_status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT supplier_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT supplier_currency_shape CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT supplier_active_period_ordered CHECK (active_until IS NULL OR active_from IS NULL OR active_until >= active_from)
);
CREATE UNIQUE INDEX supplier_name_unique ON supplier (lower(name));

COMMENT ON TABLE supplier IS
    'E-025 Supplier - a SIMPLE PARTY RECORD (PRC-008). No payment terms or lead times: GAP-079 is open. No sourcing terms, price list or catalogue.';

-- PRM-099 - capabilities transcribed in the owner's approval of 2026-10-06; <module>.<resource>.<action> (PRM-089).
-- view never implies manage. The Owner holds every authority automatically (AGV-033).
INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'warehouse.warehouse.view', 'View warehouses (E-004). Grants no change.'),
    (gen_random_uuid(), 'warehouse.warehouse.manage', 'Create and change warehouses, and archive them. Grants no stock movement.'),
    (gen_random_uuid(), 'warehouse.stock-location.view', 'View stock locations (E-005). Grants no change.'),
    (gen_random_uuid(), 'warehouse.stock-location.manage', 'Create and change stock locations, and archive them. Grants no stock movement.'),
    (gen_random_uuid(), 'procurement.supplier.view', 'View suppliers (E-025). Grants no change and no payment.'),
    (gen_random_uuid(), 'procurement.supplier.manage', 'Create and change suppliers, and archive them. 🔴 Never together with approving payment to a supplier (PRC-010, INV-25.1).');
