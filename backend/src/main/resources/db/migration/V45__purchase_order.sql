-- =====================================================================================
-- V45 - PURCHASE ORDER (E-029) AND PURCHASE ORDER ITEM (E-066).
--
-- Owner decision, 2026-10-06: build Purchase Order first; supplier payable is shown later, when Accounts exists.
-- Recorded as PRC-068 (Purchase Order), PRC-069 (Owner may approve own order) and PRM-100 (capabilities).
--
-- 🔴 A purchase order is a COMMITMENT, not stock and not a liability: stock enters at goods receipt and the payable is
-- created at acceptance (PRC-017, BR-105, BR-109), so this migration writes neither. quantity_received is therefore NOT
-- stored - it is derived from receipt lines (DB-001) and does not exist yet.
--
-- 🔴 The PO number is stable and never reused (PRC-022, INV-29.3): it comes from a counter that only moves forward, and a
-- cancelled order keeps its number. 🔴 Every approval, amendment, shipment record and cancellation is appended to
-- purchase_order_history with who, when and why (PRC-026) - there is no update or delete path for it.
-- =====================================================================================
CREATE TABLE document_number_counter (
    kind        varchar(24) NOT NULL,
    year        int         NOT NULL,
    last_number int         NOT NULL DEFAULT 0,
    PRIMARY KEY (kind, year)
);

CREATE TABLE purchase_order (
    id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number                varchar(32)  NOT NULL,
    supplier_id              uuid         NOT NULL REFERENCES supplier (id),
    order_date               date         NOT NULL,
    expected_date            date,
    currency                 varchar(3)   NOT NULL,
    supplier_order_reference varchar(120),
    status                   varchar(24)  NOT NULL DEFAULT 'DRAFT',
    -- INV-29.1 / PRM-072 - the approval record: who and when, kept apart from who created the order.
    approved_by              uuid REFERENCES operational_user_profile (id),
    approved_at              timestamptz,
    sent_at                  timestamptz,
    -- PRC-024 / SMA-033 - the supplier's shipment state is MIRRORED, never owned: a person records what the supplier said.
    supplier_shipped_at      timestamptz,
    supplier_shipped_by      uuid REFERENCES operational_user_profile (id),
    cancelled_at             timestamptz,
    cancelled_by             uuid REFERENCES operational_user_profile (id),
    created_at               timestamptz  NOT NULL DEFAULT now(),
    created_by               uuid         NOT NULL REFERENCES operational_user_profile (id),
    updated_at               timestamptz  NOT NULL DEFAULT now(),
    updated_by               uuid         NOT NULL REFERENCES operational_user_profile (id),
    version                  bigint       NOT NULL DEFAULT 0,
    CONSTRAINT purchase_order_number_unique UNIQUE (po_number),
    CONSTRAINT purchase_order_status_check
        CHECK (status IN ('DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED')),
    CONSTRAINT purchase_order_currency_shape CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT purchase_order_dates_ordered CHECK (expected_date IS NULL OR expected_date >= order_date),
    CONSTRAINT purchase_order_approval_stated_together CHECK ((approved_by IS NULL) = (approved_at IS NULL)),
    CONSTRAINT purchase_order_cancel_stated_together CHECK ((cancelled_by IS NULL) = (cancelled_at IS NULL)),
    CONSTRAINT purchase_order_cancelled_has_stamp CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);
CREATE INDEX purchase_order_supplier_idx ON purchase_order (supplier_id);
CREATE INDEX purchase_order_status_idx ON purchase_order (status);

CREATE TABLE purchase_order_item (
    id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid           NOT NULL REFERENCES purchase_order (id),
    line_number       int            NOT NULL,
    -- INV-66.1 - procurement buys physical things (Product Variants), never sellable products.
    product_variant_id uuid          NOT NULL REFERENCES product_variant (id),
    quantity_ordered  numeric(19, 4) NOT NULL,
    -- INV-66.3 / DB-036 - the unit cost carries its currency (always the order's), and is never rounded for the person.
    unit_cost         numeric(19, 4) NOT NULL,
    currency          varchar(3)     NOT NULL,
    expected_date     date,
    CONSTRAINT purchase_order_item_line_unique UNIQUE (purchase_order_id, line_number),
    CONSTRAINT purchase_order_item_quantity_positive CHECK (quantity_ordered > 0),
    CONSTRAINT purchase_order_item_cost_nonneg CHECK (unit_cost >= 0)
);
CREATE INDEX purchase_order_item_variant_idx ON purchase_order_item (product_variant_id);

CREATE TABLE purchase_order_history (
    id                bigserial    PRIMARY KEY,
    purchase_order_id uuid         NOT NULL REFERENCES purchase_order (id),
    action            varchar(24)  NOT NULL,
    reason            varchar(500),
    detail            text,
    acted_by          uuid         NOT NULL REFERENCES operational_user_profile (id),
    acted_at          timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT purchase_order_history_action_check
        CHECK (action IN ('CREATED', 'AMENDED', 'APPROVED', 'SENT', 'SUPPLIER_SHIPPED', 'CANCELLED'))
);
CREATE INDEX purchase_order_history_order_idx ON purchase_order_history (purchase_order_id, acted_at);

-- PRM-100 - capabilities, transcribed in the owner's approval of 2026-10-06. Approve is its own capability (PRM-006,
-- INV-29.1): creating and approving are different acts. The Owner holds them all automatically (AGV-033).
INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'procurement.purchase-order.view', 'View purchase orders (E-029). Grants no change.'),
    (gen_random_uuid(), 'procurement.purchase-order.manage',
     'Create and amend purchase orders, mark them sent, record the supplier''s shipment, and cancel. Never approval.'),
    (gen_random_uuid(), 'procurement.purchase-order.approve',
     'Approve a purchase order. 🔴 Never its own creator, except the Owner (PRC-069). Grants no creation and no receipt.');
