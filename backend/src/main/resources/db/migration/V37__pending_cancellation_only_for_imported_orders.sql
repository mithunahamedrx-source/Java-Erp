-- =====================================================================================
-- V37 - Pending cancellation applies ONLY to an order IMPORTED from a marketplace.
--
-- Product-owner correction, 2026-10-05: an ERP cancellation waits for the marketplace only when the
-- order came from the marketplace API (a Daraz order). Every other order - including one created by
-- hand under a Daraz SHOP - is cancelled directly. An order created in Trioloo carries an EMPTY
-- marketplace status history (BR-171, ManualOrderService), which is what tells the two apart.
-- V35 is NOT edited (PRJ-081); the function is redefined here.
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
                          -- an order made in Trioloo (even under a Daraz shop) has no marketplace status
                          -- history; there is nobody to wait for
                          OR jsonb_array_length(o.statuses_json) = 0
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
