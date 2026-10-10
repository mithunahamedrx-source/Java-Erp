-- =====================================================================================
-- V47 - The discount on a Sales Invoice.
--
-- Product-owner instruction, 2026-10-10: an order from the Zeon Tech website that used a voucher printed an invoice
-- whose total ignored the discount - the order said 20,700, the bill said 21,700 - and the bill said nothing about why.
-- The bill must subtract the discount and show it, with the voucher code.
--
-- Canonical basis:
--   INV-39.2   The invoice SNAPSHOTS every figure at issue: the discount and its code are document figures, copied
--              once, never recomputed by the page (PRN-022).
--   BR-092..   A discount is a reduction from an original price, recorded openly; this is the seller-funded voucher
--              the channel reported (channel_order.voucher_seller), not a new kind of discount.
--   DB-079     numeric, never float.
--
-- An invoice issued before this migration has NULL here and prints exactly as it did: an issued invoice is never
-- reissued (INV-39.1), so a past bill is not silently restated.
-- =====================================================================================

ALTER TABLE sales_invoice
    ADD COLUMN discount      numeric(19, 2),
    ADD COLUMN discount_code varchar(80);

ALTER TABLE sales_invoice
    ADD CONSTRAINT sales_invoice_discount_positive CHECK (discount IS NULL OR discount > 0);

COMMENT ON COLUMN sales_invoice.discount IS
    'A seller voucher taken off the subtotal, fixed at issue (INV-39.2). NULL = no discount.';
COMMENT ON COLUMN sales_invoice.discount_code IS
    'The voucher code behind the discount, as the channel reported it, or NULL.';
