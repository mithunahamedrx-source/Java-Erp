-- =====================================================================================
-- V34 - A quantity on an order line.
--
-- Product-owner instruction, 2026-10-05: the Edit order form takes a Qty per product line.
--
-- Canonical basis:
--   OM 7.9           Amendment authority names QUANTITY (decrease / increase) as a change an
--                    order may take before dispatch. No column held one until now.
--   E-032 / DZC-045  Daraz publishes ONE ORDER-ITEM ROW PER UNIT, not a quantity. Existing
--                    rows are therefore quantity 1 - which is what they always were - and a
--                    re-pull never changes the column (the pull does not write it).
--   BR-145           The unit price is the snapshot; the line value is unit price x quantity.
--   INV-39.2         The invoice snapshots the quantity and the line total at issue.
--
-- ⚠ A QUANTITY DOES NOT RE-DERIVE THE ORDER TOTAL (INV-31.7 - the total is the order's own
--   figure). The edit form suggests a new total when a quantity or price changes, and the
--   operator can overwrite it.
-- 🔴 No inventory effect: nothing reserves or releases stock on a quantity change (BR-153,
--   PRM-093.e).
-- =====================================================================================

ALTER TABLE channel_order_item
    ADD COLUMN quantity integer NOT NULL DEFAULT 1;

ALTER TABLE channel_order_item
    ADD CONSTRAINT channel_order_item_quantity_positive CHECK (quantity >= 1);

COMMENT ON COLUMN channel_order_item.quantity IS
    'Units on this line. 1 for every row imported from Daraz (one row per unit, DZC-045) and for a '
    'manually captured line until it is edited (OM 7.9).';
