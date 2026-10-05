-- =====================================================================================
-- V27 - Cancel an order, restore a cancelled order, and the authority-change record.
--
-- Product-owner instruction, 2026-10-05: the Orders More Actions menu must be able to
-- CANCEL an order and RESTORE a cancelled one. PRM-095 ratifies the two capability codes
-- on that instruction (the same standing-authorisation route PRM-094 took).
--
-- Canonical basis:
--   OM 6.4 / BR-011   Cancellation is available until dispatch; afterwards the instrument
--                     is a return. BR-016 - every cancellation records a reason from a
--                     controlled vocabulary (BD-035).
--   OM 6.5 / BR-012   A restored order re-enters verification and re-checks stock; it
--                     never resumes at its prior stage. Under BR-184 re-verification is
--                     automatic, so a restored order reads CONFIRMED.
--   BR-169 / BR-172   Cancelling or restoring is a MEANINGFUL manual action: an
--                     API_MANAGED order becomes ERP_MANAGED immediately, and a later
--                     marketplace payload still reporting `cancelled` does not undo it.
--   BR-171 / BR-173   The marketplace's status is an external fact. It is NEVER rewritten:
--                     the stale `cancelled` stays as evidence, and the ERP's reading is
--                     DERIVED beside it.
--   BR-174            The authority state, the causing action, the actor and the moment
--                     are all recorded. Authority never transfers silently.
--   BR-061            Records are reversed, never erased: a restore sits beside the
--                     cancellation it reverses; neither row of facts is deleted.
--   PRM-081.b/PRM-003 The new codes are seeded with ZERO holders.
--
-- 🔴 NEITHER ACT WRITES TO THE MARKETPLACE. No outbound Orders behaviour is ratified
--    (OSC-036, DZC-044.a), so Daraz is not told. The screen says so.
-- =====================================================================================

ALTER TABLE channel_order
    ADD COLUMN authority_cause       varchar(40),
    ADD COLUMN authority_changed_at  timestamptz,
    ADD COLUMN authority_changed_by  uuid REFERENCES operational_user_profile (id),
    ADD COLUMN cancelled_at          timestamptz,
    ADD COLUMN cancelled_by          uuid REFERENCES operational_user_profile (id),
    ADD COLUMN cancel_reason         varchar(40),
    ADD COLUMN cancel_note           text,
    ADD COLUMN restored_at           timestamptz,
    ADD COLUMN restored_by           uuid REFERENCES operational_user_profile (id);

-- A cancellation is attributable and reasoned or it does not exist (BR-016, AGV-001).
ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_cancel_consistent CHECK (
        (cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL AND cancel_note IS NULL)
        OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancel_reason IS NOT NULL)
    ),
    -- BD-035 - the eight reasons Trioloo can give. The ninth, "the marketplace cancels the
    -- order", is the marketplace's act and arrives as the mirror, never as a Trioloo choice.
    ADD CONSTRAINT channel_order_cancel_reason_known CHECK (
        cancel_reason IS NULL OR cancel_reason IN (
            'CUSTOMER_UNREACHABLE', 'CUSTOMER_REQUESTED', 'CHANGED_MIND',
            'ADDRESS_INCORRECT', 'PHONE_INCORRECT', 'PRODUCT_UNAVAILABLE',
            'CHANGE_NOT_FULFILLABLE', 'DUPLICATE_ORDER')
    ),
    ADD CONSTRAINT channel_order_restore_consistent CHECK (
        (restored_at IS NULL AND restored_by IS NULL)
        OR (restored_at IS NOT NULL AND restored_by IS NOT NULL)
    ),
    ADD CONSTRAINT channel_order_authority_change_consistent CHECK (
        (authority_cause IS NULL AND authority_changed_at IS NULL AND authority_changed_by IS NULL)
        OR (authority_cause IS NOT NULL AND authority_changed_at IS NOT NULL
            AND authority_changed_by IS NOT NULL)
    );

COMMENT ON COLUMN channel_order.authority_cause IS
    'BR-174 - the ACT that moved the order to ERP_MANAGED (CANCELLED_BY_TRIOLOO or '
    'RESTORED_BY_TRIOLOO). NULL for an order that was ERP_MANAGED from creation (BR-169).';

INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'order.order.cancel',
     'Cancel an order before dispatch with a reason from the controlled vocabulary (BR-011, '
     'BR-016). Grants no restoration, no courier cancellation, no marketplace write and no '
     'inventory, payment or refund action (PRM-095).'),
    (gen_random_uuid(), 'order.order.restore',
     'Restore a cancelled order so it re-enters the lifecycle (BR-012, BR-172). Grants no '
     'cancellation, no courier booking, no marketplace write and no inventory, payment or '
     'refund action (PRM-095).');

-- -------------------------------------------------------------------------------------
-- The EFFECTIVE status, redefined (supersedes V26's body; V26 itself is untouched).
--
--   1. An ERP cancellation that has not been restored -> CANCELLED.
--   2. The marketplace says CANCELLED and Trioloo has NOT restored -> the mirror stands.
--   3. The latest non-cancelled SHIPMENT reports an outcome -> the Order follows it.
--   4. Trioloo restored a marketplace-cancelled order -> CONFIRMED (BR-012 + BR-184).
--   5. Confirmed by policy while the mirror says PENDING_VERIFICATION -> CONFIRMED.
--   6. Otherwise the untouched mirror.
-- -------------------------------------------------------------------------------------
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
            THEN '["CONFIRMED"]'::jsonb
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
