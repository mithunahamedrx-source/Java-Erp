-- =====================================================================================
-- V31 - Advance received on an order, and on its invoice.
--
-- Product-owner instruction, 2026-10-05: New order takes an ADVANCE RECEIVED amount, and the
-- invoice shows "Advance received" after the subtotal.
--
-- Canonical basis:
--   BR-127   Advances are neither revenue nor expense and never move a recognition point.
--            Money received before delivery is held as an advance balance and applied at the
--            event that creates the obligation (delivery, BR-116). So recording an advance
--            changes NO state and recognises nothing.
--   BR-035   Collection and settlement are separate. The courier collects the BALANCE only:
--            the COD amount sent to the courier is the total LESS the advance, or the customer
--            would pay twice. (ShipmentBookingService applies this.)
--   AGV-001  The actor and the moment are captured when the advance is recorded.
--   INV-39.2 The invoice SNAPSHOTS the advance and the balance due as document figures.
--   DB-001   `balance_due` on the INVOICE is a document figure fixed at issue (rounded once, as
--            the tax amount is). The ORDER stores no balance: it is derived (total - advance).
--
-- ⚠ THIS ANSWERS ONE HALF OF GAP-035: partial payment MAY be taken at creation. It does not
--   change SM-5: the payment position chip is still NOT_DUE before delivery (OSC-056.b), because
--   no E-040 Receivable or receipt record exists - the advance is a recorded fact on the order,
--   not a payment-machine state.
-- =====================================================================================

ALTER TABLE channel_order
    ADD COLUMN advance_received    numeric(19, 2),
    ADD COLUMN advance_recorded_at timestamptz,
    ADD COLUMN advance_recorded_by uuid REFERENCES operational_user_profile (id);

ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_advance_consistent CHECK (
        (advance_received IS NULL AND advance_recorded_at IS NULL AND advance_recorded_by IS NULL)
        OR (advance_received IS NOT NULL AND advance_received > 0
            AND advance_recorded_at IS NOT NULL AND advance_recorded_by IS NOT NULL)
    );

COMMENT ON COLUMN channel_order.advance_received IS
    'BR-127 - money received BEFORE delivery. NULL = none recorded (never 0). Recognises no revenue.';

ALTER TABLE sales_invoice
    ADD COLUMN advance_received numeric(19, 2),
    ADD COLUMN balance_due      numeric(19, 2);

ALTER TABLE sales_invoice
    ADD CONSTRAINT sales_invoice_advance_stated_together CHECK (
        (advance_received IS NULL AND balance_due IS NULL)
        OR (advance_received IS NOT NULL AND balance_due IS NOT NULL)
    );

COMMENT ON COLUMN sales_invoice.balance_due IS
    'INV-39.2 - total less the advance, fixed at issue. NULL where no advance was recorded; the '
    'document then shows the total as the balance.';
