-- =====================================================================================
-- V42 - STOCK ITEM REFERENCE COST AND DISCONTINUED MARK (PRD-206, PRD-207).
--
-- Product-owner instruction, 2026-10-05: before purchasing / goods receipt exists, the owner must see and change a
-- cost on every Stock Item. It is a REFERENCE cost - a figure the owner types, labelled as such. It is NOT the
-- weighted average cost (ICO-001): once Inventory Costing holds a weighted average for the item, that figure wins
-- everywhere and the reference cost is shown only as history. Nothing here writes stock, a movement or a balance.
--
-- A Stock Item can also be marked DISCONTINUED by a person. It is a mark, not a lifecycle state: the record, its
-- history and its references all stay valid. Attribution is captured when the mark is made (AGV-001).
-- =====================================================================================
ALTER TABLE product_variant
    ADD COLUMN reference_cost   numeric(19, 4),
    ADD COLUMN discontinued_at  timestamptz,
    ADD COLUMN discontinued_by  uuid REFERENCES operational_user_profile (id);

ALTER TABLE product_variant
    ADD CONSTRAINT product_variant_reference_cost_nonneg CHECK (reference_cost IS NULL OR reference_cost >= 0),
    ADD CONSTRAINT product_variant_discontinued_stated_together CHECK (
        (discontinued_at IS NULL AND discontinued_by IS NULL)
        OR (discontinued_at IS NOT NULL AND discontinued_by IS NOT NULL));

COMMENT ON COLUMN product_variant.reference_cost IS
    'PRD-206 owner-entered REFERENCE cost. Not weighted average cost (ICO-001); superseded by it once one exists.';
