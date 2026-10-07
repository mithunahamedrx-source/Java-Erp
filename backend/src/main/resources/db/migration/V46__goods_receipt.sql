-- E-030 Goods Receipt (PRC-003, PRC-030, PRC-036, PRC-071) - the record of what arrived and what was accepted.
--
-- 🔴 It carries NO state machine (PRC-037): it records an acceptance decision per line and nothing changes afterwards.
-- 🔴 Stock enters through inventory_movement (IVN-038, type GOODS_RECEIPT_ACCEPTED), never through a figure kept here, and
--    the cost is the unit cost on that movement (ICO-001, ICO-033, PRC-046). Nothing is stored for a stock level or a
--    weighted average (DB-001).
-- 🔴 No supplier payable is created by this migration or by a receipt in this slice: the payable follows later (PRC-047).
-- Rows are append-only. A wrong receipt is corrected by a linked adjustment, never edited (DB-002, PRC-006).

CREATE TABLE goods_receipt (
    id                         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    -- PRC-071.a - GR-YYYY-NNNN from document_number_counter, never reused.
    receipt_number             varchar(32)  NOT NULL,
    supplier_id                uuid         NOT NULL REFERENCES supplier (id),
    -- PRC-003 / PRC-018 - a purchase order is optional: a direct purchase is first-class.
    purchase_order_id          uuid REFERENCES purchase_order (id),
    warehouse_id               uuid REFERENCES warehouse (id),
    received_date              date         NOT NULL,
    supplier_invoice_reference varchar(120),
    note                       varchar(1000),
    currency                   varchar(3)   NOT NULL DEFAULT 'BDT',
    -- AGV-001 - first-class actor facts captured when the act happens, never reconstructed.
    recorded_by                uuid         NOT NULL REFERENCES operational_user_profile (id),
    recorded_at                timestamptz  NOT NULL DEFAULT now(),
    accepted_by                uuid REFERENCES operational_user_profile (id),
    accepted_at                timestamptz,
    CONSTRAINT goods_receipt_number_unique UNIQUE (receipt_number),
    CONSTRAINT goods_receipt_currency_shape CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT goods_receipt_acceptance_stated_together CHECK ((accepted_by IS NULL) = (accepted_at IS NULL))
);
CREATE INDEX goods_receipt_supplier_idx ON goods_receipt (supplier_id);
CREATE INDEX goods_receipt_order_idx ON goods_receipt (purchase_order_id);
CREATE INDEX goods_receipt_date_idx ON goods_receipt (received_date);

CREATE TABLE goods_receipt_item (
    id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id    uuid           NOT NULL REFERENCES goods_receipt (id),
    line_number         int            NOT NULL,
    -- E-066 is the granularity at which goods are ordered, received and costed (PRC-031); null on a direct purchase.
    purchase_order_item_id uuid REFERENCES purchase_order_item (id),
    -- INV-66.1 - Product Variants, never Sellable Products.
    product_variant_id  uuid           NOT NULL REFERENCES product_variant (id),
    quantity_received   numeric(19, 4) NOT NULL,
    -- PRC-030 - acceptance is per line, and partial. The remainder is held, not sellable, owing nothing (PRC-034).
    quantity_accepted   numeric(19, 4) NOT NULL,
    -- DB-079 / PRC-044 - the supplier's price, never rounded for the person.
    unit_cost           numeric(19, 4) NOT NULL,
    -- PRC-038 - the four established discrepancy types.
    discrepancy_type    varchar(16),
    discrepancy_note    varchar(500),
    -- The movement this acceptance wrote (IVN-015); null where nothing was accepted.
    inventory_movement_id uuid REFERENCES inventory_movement (id),
    CONSTRAINT goods_receipt_item_line_unique UNIQUE (goods_receipt_id, line_number),
    CONSTRAINT goods_receipt_item_received_positive CHECK (quantity_received > 0),
    CONSTRAINT goods_receipt_item_accepted_within CHECK (quantity_accepted >= 0 AND quantity_accepted <= quantity_received),
    CONSTRAINT goods_receipt_item_cost_nonneg CHECK (unit_cost >= 0),
    CONSTRAINT goods_receipt_item_discrepancy_check
        CHECK (discrepancy_type IS NULL OR discrepancy_type IN ('SHORTAGE', 'WRONG_ITEM', 'DAMAGED', 'EXCESS')),
    -- PRC-034 - goods not accepted are explained; nothing is silently left over.
    CONSTRAINT goods_receipt_item_issue_explained CHECK (quantity_accepted = quantity_received OR discrepancy_type IS NOT NULL),
    CONSTRAINT goods_receipt_item_accepted_has_movement CHECK ((quantity_accepted > 0) = (inventory_movement_id IS NOT NULL))
);
CREATE INDEX goods_receipt_item_order_item_idx ON goods_receipt_item (purchase_order_item_id);
CREATE INDEX goods_receipt_item_variant_idx ON goods_receipt_item (product_variant_id);

-- The order's history gains the receipt (PRC-026).
ALTER TABLE purchase_order_history DROP CONSTRAINT purchase_order_history_action_check;
ALTER TABLE purchase_order_history ADD CONSTRAINT purchase_order_history_action_check
    CHECK (action IN ('CREATED', 'AMENDED', 'APPROVED', 'SENT', 'SUPPLIER_SHIPPED', 'CANCELLED', 'RECEIVED'));

-- PRM-101 - capabilities, transcribed in the owner's approval of 2026-10-06. Recording what arrived and deciding what is
-- accepted are different acts (PRC-036). The Owner holds them automatically (AGV-033).
INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'procurement.goods-receipt.view', 'View goods receipts (E-030). Grants no change.'),
    (gen_random_uuid(), 'procurement.goods-receipt.record',
     'Record that goods arrived, line by line, with any discrepancy. Does not decide acceptance: accepting is its own capability.'),
    (gen_random_uuid(), 'procurement.goods-receipt.accept',
     'Decide that received goods are accepted into stock at their cost (PRC-036). Grants no payment and no supplier return.');
