-- =====================================================================================
-- V26 - Order auto-confirmation record, and the order's EFFECTIVE status.
--
-- Product-owner decision, 2026-10-03 (ORDER_MANAGEMENT_ARCHITECTURE.md section 30,
-- BR-184): Trioloo operates NO human verification queue. Every order is CONFIRMED BY
-- POLICY the moment it arrives, and the confirmation is RECORDED rather than skipped.
--
-- Canonical basis:
--   BR-014   Every order receives a verification decision; "not required" IS a decision,
--            recorded with its reason. This migration stores exactly that.
--   BR-166   An AUTO_CONFIRMED order has NO human Confirmed By and none is fabricated.
--            confirmed_by stays NULL for AUTO_CONFIRMED, enforced by CHECK below.
--   BR-167   The human-versus-auto distinction is a RECORDED PROPERTY, not an inference
--            from a null - hence confirmation_mode.
--   BR-164   Attribution is never retrofitted. The backfill below stamps the mode and the
--            moment of THIS MIGRATION and invents no actor.
--   BR-171   The marketplace's status is an EXTERNAL FACT and is never rewritten by the
--            ERP. canonical_statuses_json is left exactly as the adapter wrote it; the
--            ERP's reading of the order is DERIVED beside it (DB-001, no stored duplicate).
--   BR-065/066 Machines are independent and talk by event; the Shipment machine's
--            reported outcome moves the Order (STATE_MACHINE_ARCHITECTURE 5.4:
--            DISPATCHED->DELIVERED, DISPATCHED->FAILED_DELIVERY are "Courier report").
--
-- 🔴 NO HUMAN CONFIRMATION PATH IS CREATED. No `order.order.confirm` capability is
--    ratified and PRM-089.f forbids coining one, so 'HUMAN' is admitted by the CHECK
--    only so the column's meaning is complete; nothing writes it.
-- =====================================================================================

ALTER TABLE channel_order
    ADD COLUMN confirmed_at         timestamptz,
    ADD COLUMN confirmed_by         uuid REFERENCES operational_user_profile (id),
    ADD COLUMN confirmation_mode    varchar(20),
    ADD COLUMN confirmation_reason  varchar(80);

ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_confirmation_consistent CHECK (
        -- unconfirmed: nothing recorded
        (confirmation_mode IS NULL AND confirmed_at IS NULL AND confirmed_by IS NULL
            AND confirmation_reason IS NULL)
        -- BR-166: automatic confirmation has NO human actor and states its reason
        OR (confirmation_mode = 'AUTO_CONFIRMED' AND confirmed_at IS NOT NULL
            AND confirmed_by IS NULL AND confirmation_reason IS NOT NULL)
        -- BR-163: a human confirmation names its actor
        OR (confirmation_mode = 'HUMAN' AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)
    );

COMMENT ON COLUMN channel_order.confirmation_mode IS
    'BR-167 - AUTO_CONFIRMED (policy, no human) or HUMAN. NULL = not yet confirmed.';
COMMENT ON COLUMN channel_order.confirmation_reason IS
    'BR-014 - why verification was not required. VERIFICATION_NOT_REQUIRED = owner policy '
    '2026-10-03 (OM section 30, BR-184).';

-- Orders already awaiting verification are confirmed by the same policy. confirmed_by is
-- left NULL: nobody confirmed them (BR-164, BR-166).
UPDATE channel_order
   SET confirmed_at = now(),
       confirmation_mode = 'AUTO_CONFIRMED',
       confirmation_reason = 'VERIFICATION_NOT_REQUIRED'
 WHERE canonical_statuses_json @> '["PENDING_VERIFICATION"]'::jsonb
   AND confirmed_at IS NULL;

-- -------------------------------------------------------------------------------------
-- The order's EFFECTIVE canonical statuses - what the workspace tabs, counts and cards
-- read. DERIVED, never stored (DB-001): storing it would make a second copy of the
-- marketplace mirror that drifts the moment either input changes.
--
-- Precedence, highest first:
--   1. The marketplace says CANCELLED -> stays CANCELLED. An in-flight parcel on a
--      cancelled order is a return-workflow question (BR-011, OM 6.5) that nothing here
--      may paper over by showing "Dispatched".
--   2. The latest non-cancelled SHIPMENT reports an outcome -> the Order follows it.
--      DLV-025: the courier is system of record for the parcel.
--        BOOKED, AWAITING_PICKUP                          -> COURIER_BOOKED
--        PICKED_UP, IN_TRANSIT, AT_HUB, OUT_FOR_DELIVERY  -> DISPATCHED
--        DELIVERY_ATTEMPTED, RETURNING                    -> FAILED_DELIVERY
--        DELIVERED                                        -> DELIVERED
--        RETURNED_TO_WAREHOUSE                            -> RETURNED
--      CREATED (a slot claimed, no courier contact), LOST and DAMAGED map to NOTHING:
--      DLV-027 admits LOST only on the courier's official confirmation and no Order
--      consequence is ratified for it (SYS-034 - unknown is not a value).
--   3. Confirmed by policy while the mirror still says PENDING_VERIFICATION -> CONFIRMED.
--   4. Otherwise the marketplace mirror, untouched.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION channel_order_effective_statuses(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN o.canonical_statuses_json @> '["CANCELLED"]'::jsonb
            THEN o.canonical_statuses_json
        WHEN sh.mapped IS NOT NULL
            THEN jsonb_build_array(sh.mapped)
        WHEN o.confirmed_at IS NOT NULL
             AND o.canonical_statuses_json @> '["PENDING_VERIFICATION"]'::jsonb
            THEN (o.canonical_statuses_json - 'PENDING_VERIFICATION') || '["CONFIRMED"]'::jsonb
        ELSE o.canonical_statuses_json
    END
      FROM channel_order o
      LEFT JOIN LATERAL (
            SELECT CASE s.state
                       WHEN 'BOOKED'                THEN 'COURIER_BOOKED'
                       WHEN 'AWAITING_PICKUP'       THEN 'COURIER_BOOKED'
                       WHEN 'PICKED_UP'             THEN 'DISPATCHED'
                       WHEN 'IN_TRANSIT'            THEN 'DISPATCHED'
                       WHEN 'AT_HUB'                THEN 'DISPATCHED'
                       WHEN 'OUT_FOR_DELIVERY'      THEN 'DISPATCHED'
                       WHEN 'DELIVERY_ATTEMPTED'    THEN 'FAILED_DELIVERY'
                       WHEN 'RETURNING'             THEN 'FAILED_DELIVERY'
                       WHEN 'DELIVERED'             THEN 'DELIVERED'
                       WHEN 'RETURNED_TO_WAREHOUSE' THEN 'RETURNED'
                       ELSE NULL
                   END AS mapped
              FROM shipment s
             WHERE s.channel_order_id = o.id
               AND s.state <> 'CANCELLED'
             ORDER BY s.created_at DESC
             LIMIT 1
      ) sh ON true
     WHERE o.id = p_order_id
$$;

COMMENT ON FUNCTION channel_order_effective_statuses(uuid) IS
    'Derived (DB-001) SM-1 reading of an order: marketplace CANCELLED, else the latest '
    'shipment outcome (DLV-025), else auto-confirmation, else the untouched marketplace '
    'mirror (BR-171). Never stored.';
