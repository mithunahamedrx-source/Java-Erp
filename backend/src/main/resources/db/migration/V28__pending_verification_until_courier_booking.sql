-- =====================================================================================
-- V28 - An order stays PENDING_VERIFICATION until it is sent to the courier.
--
-- Product-owner correction, 2026-10-05, superseding the auto-confirmation V26 introduced
-- the day before: a new order (Daraz pending or manual) is PENDING VERIFICATION. Sending it
-- to Steadfast moves it to READY TO SHIP, and "Ready to ship means confirmed". A restored
-- order returns to PENDING VERIFICATION (BR-012).
--
-- Canonical basis:
--   BR-012   A restored order re-enters verification; it never resumes at its prior stage.
--   BR-164 / BR-166  Nobody confirmed these orders, so no confirmation is recorded for them.
--   BR-171   The marketplace mirror is never rewritten; the ERP's reading is DERIVED.
--   DLV-025  The courier is system of record for the parcel; with NO shipment the
--            marketplace mirror stands (Daraz orders keep following Daraz).
--
-- 🔴 V26 AND V27 ARE NOT EDITED (PRJ-081). This migration corrects their effect.
-- 🔴 The 'AUTO_CONFIRMED' marks V26 wrote are CLEARED: leaving a recorded confirmation on an
--    order the owner says was never confirmed would be a false fact (SYS-034). The columns
--    stay; nothing writes them any more, and 'HUMAN' remains admitted for a future ratified
--    confirmation act.
-- =====================================================================================

UPDATE channel_order
   SET confirmed_at = NULL, confirmation_mode = NULL, confirmation_reason = NULL
 WHERE confirmation_mode = 'AUTO_CONFIRMED';

-- Effective status, redefined (V27's body is superseded; V27 itself is untouched).
--   1. An ERP cancellation that has not been restored            -> CANCELLED
--   2. The marketplace says CANCELLED and Trioloo has NOT restored -> the mirror stands
--   3. The latest non-cancelled SHIPMENT reports an outcome         -> the Order follows it
--   4. Trioloo restored a marketplace-cancelled order               -> PENDING_VERIFICATION
--   5. Otherwise the untouched mirror (a Daraz order follows Daraz when there is no shipment)
CREATE OR REPLACE FUNCTION channel_order_effective_statuses(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN o.cancelled_at IS NOT NULL
             AND (o.restored_at IS NULL OR o.cancelled_at > o.restored_at)
            THEN '["CANCELLED"]'::jsonb
        WHEN o.restored_at IS NULL
             AND o.canonical_statuses_json @> '["CANCELLED"]'::jsonb
            THEN o.canonical_statuses_json
        WHEN sh.mapped IS NOT NULL
            THEN jsonb_build_array(sh.mapped)
        WHEN o.restored_at IS NOT NULL
             AND o.canonical_statuses_json @> '["CANCELLED"]'::jsonb
            THEN '["PENDING_VERIFICATION"]'::jsonb
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
