-- =====================================================================================
-- V35 - PENDING CANCELLATION: an ERP cancellation of a MARKETPLACE order waits for the marketplace.
--
-- Product-owner instruction, 2026-10-05: an order cancelled in the ERP that came from Daraz (or
-- another marketplace) sits in PENDING CANCELLATION until the marketplace itself reports it
-- cancelled; the marketplace's word is final, and only then does it become CANCELLED. An order
-- with no marketplace behind it (phone, walk-in, website) has nobody to wait for, so an ERP
-- cancellation is final at once.
--
-- Canonical basis: BR-171 (the marketplace mirror is never rewritten; the ERP reading is derived),
-- BR-186 - BR-188 (cancel / restore), BR-196 (this rule). V28 is NOT edited (PRJ-081); the
-- function is redefined here, identical to V28 except for its first branch.
-- =====================================================================================
CREATE OR REPLACE FUNCTION channel_order_effective_statuses(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN o.cancelled_at IS NOT NULL
             AND (o.restored_at IS NULL OR o.cancelled_at > o.restored_at)
            THEN CASE
                     WHEN o.canonical_statuses_json @> '["CANCELLED"]'::jsonb
                          OR ci.channel_type IN ('PHONE', 'WALKIN', 'WEBSITE')
                         THEN '["CANCELLED"]'::jsonb
                     ELSE '["PENDING_CANCELLATION"]'::jsonb
                 END
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
      JOIN channel_instance ci ON ci.id = o.channel_instance_id
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
