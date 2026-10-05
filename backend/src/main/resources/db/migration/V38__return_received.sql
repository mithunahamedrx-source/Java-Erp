-- =====================================================================================
-- V38 - RETURN RECEIVED: the failed-delivery parcel is back with us.
--
-- Product-owner instruction, 2026-10-05: on a Failed delivery order an operator records "Return Received"
-- in a popup - who received the parcel and a note - and the order moves to RETURNED. Recorded as BR-199.
--
-- The courier is system of record for the parcel (DLV-025); this does NOT rewrite the shipment. It is
-- Trioloo's own fact - who received the goods and when - captured first-class when the act happens
-- (AGV-001), and the effective status reads RETURNED from it. No stock, refund or payment effect.
-- =====================================================================================
ALTER TABLE channel_order
    ADD COLUMN return_received_at     timestamptz,
    ADD COLUMN return_received_by     uuid REFERENCES operational_user_profile (id),
    ADD COLUMN return_recorded_by     uuid REFERENCES operational_user_profile (id),
    ADD COLUMN return_received_note   text;

ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_return_received_stated_together CHECK (
        (return_received_at IS NULL AND return_received_by IS NULL AND return_recorded_by IS NULL)
        OR (return_received_at IS NOT NULL AND return_received_by IS NOT NULL AND return_recorded_by IS NOT NULL));

INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'order.order.receive-return',
     'Record that a failed-delivery parcel came back, who received it and a note, moving the order to '
     'Returned (BR-199). Grants no refund, no stock movement, no courier write and no cancellation.');

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
        WHEN o.return_received_at IS NOT NULL
            THEN '["RETURNED"]'::jsonb
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
