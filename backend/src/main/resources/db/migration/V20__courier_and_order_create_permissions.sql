-- =====================================================================================
-- V20 - The courier, shipment and order-creation capability codes.
--
-- Scope:
--   Permission codes ONLY. No shipment table, no order-creation path, no courier
--   adapter wiring, no grant to any user.
--
-- Canonical basis:
--   PRM-092  delivery.shipment.book / .track / .cancel and payment.courier-remittance.view
--   PRM-093  order.order.create
--   PRM-089  <owning-module>.<resource>.<action>; a code exists only where a canonical
--            capability does, and implementation may never coin one.
--
-- 🔴 SEEDING A CODE IS NOT GRANTING IT. PRM-003 denies what was never granted, and
--    PRM-081.b forbids a deployment making a screen visible by handing out authority.
--    Every code below lands with ZERO holders. An authorised person grants them.
--
-- ⚠ GAP-138.g is what this closes: DLV §22 has required every dispatch to be
--    permissioned and attributable (DLV-011, AGV-001, AUD-004) since ratification, and
--    no code existed to enforce it with.
-- =====================================================================================

INSERT INTO permission (id, code, description) VALUES
    -- 🔴 Booking spends money and dispatches a rider. It is independent of tracking and
    -- of cancellation - PRM-092.b makes the three codes a set, never a ladder.
    (gen_random_uuid(), 'delivery.shipment.book',
     'Book a consignment with the courier and hand the shipment over; grants no tracking, '
     'no cancellation, no Order state change and no payment or settlement action (PRM-092).'),

    (gen_random_uuid(), 'delivery.shipment.track',
     'Read and refresh courier tracking, and record tracking events; grants no booking, '
     'no cancellation and no Order mutation (PRM-092).'),

    -- ⚠ PRM-092.c - cancelling a CONSIGNMENT is not cancelling the ORDER. A code that
    -- quietly did both would let a courier-desk operator cancel a sale (OM §6.4).
    (gen_random_uuid(), 'delivery.shipment.cancel',
     'Cancel a booked consignment with the courier; does NOT cancel the Order, which is a '
     'separate act with separate authority under OM 6.4 (PRM-092).'),

    -- 🔴 The module segment is `payment`, NOT `delivery`. PAY-022 and DLV §23 both place
    -- E-042 Remittance Batch with Payment, and PRM-089.a requires the OWNING module to
    -- name the code, because that is the module that enforces it.
    (gen_random_uuid(), 'payment.courier-remittance.view',
     'Read the courier remittance feed - what the courier says it has remitted. Grants no '
     'advance of SM-5, no acceptance of a deduction and no recording of receipt: BR-035 and '
     'SMA-079 make COLLECTED_BY_INTERMEDIARY to RECEIVED a manual Accounts act because a '
     'courier statement is not receipt (PRM-092.d).'),

    -- ✅ PRM-093 - a manual order starts at PENDING_VERIFICATION, the same state an
    -- imported order arrives in, so both enter the same human verification queue.
    -- 🔴 Creation is NOT confirmation: this code stops at PENDING_VERIFICATION.
    (gen_random_uuid(), 'order.order.create',
     'Create a manual order (OM 22 manual order capture). The order starts at '
     'PENDING_VERIFICATION and is ERP_MANAGED from creation (BR-168). Grants no amendment, '
     'confirmation, release, hold or cancellation, no channel-order act, and no inventory, '
     'payment or shipment action (PRM-093).');
