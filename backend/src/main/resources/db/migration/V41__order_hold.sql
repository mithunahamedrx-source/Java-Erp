-- =====================================================================================
-- V41 - PLACE HOLD / RELEASE HOLD: progress deliberately suspended (OM 6.2 ON_HOLD).
--
-- Product-owner instruction, 2026-10-05: the bulk and per-order "Place hold" work. Recorded as BR-204.
--
-- A hold is the ERP's own act, attributed to the person (AGV-001), and BR-151 stands: it NEVER expires, ages or
-- releases itself - only a person releases it. While held the effective status reads ON_HOLD. The act changes no
-- authority (it is not one of BR-169's meaningful actions) and tells no channel. Each place / release is also
-- written to the append-only amendment log (field = 'hold') so the history survives the release.
-- =====================================================================================
ALTER TABLE channel_order
    ADD COLUMN hold_at   timestamptz,
    ADD COLUMN hold_by   uuid REFERENCES operational_user_profile (id),
    ADD COLUMN hold_note text;

ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_hold_stated_together CHECK (
        (hold_at IS NULL AND hold_by IS NULL AND hold_note IS NULL)
        OR (hold_at IS NOT NULL AND hold_by IS NOT NULL));

INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'order.order.hold',
     'Place a pre-dispatch order on hold and release it (BR-204, BR-151). Grants no cancellation, no courier booking, '
     'no editing and no marketplace write.');

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
        WHEN o.hold_at IS NOT NULL AND o.return_received_at IS NULL
            THEN '["ON_HOLD"]'::jsonb
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
