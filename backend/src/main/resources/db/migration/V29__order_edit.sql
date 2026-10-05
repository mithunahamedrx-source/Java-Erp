-- =====================================================================================
-- V29 - Edit an order before dispatch, and the amendment record.
--
-- Product-owner instruction, 2026-10-05: every order can be edited until it is dispatched,
-- from the Orders More Actions menu. PRM-096 ratifies `order.order.edit` on that
-- instruction (the standing-authorisation route PRM-094 and PRM-095 took).
--
-- Canonical basis:
--   OM 7.9           Amendment authority: address, contact, quantity, product and price.
--   BR-058 / OM 15.3 Every amendment records before-value, after-value, reason and actor.
--                    That is `channel_order_amendment` - one row per changed field.
--   BR-169 / BR-174  Editing is a meaningful manual action: an API_MANAGED order becomes
--                    ERP_MANAGED, with cause, actor and moment recorded.
--   BR-170           For an ERP_MANAGED order the marketplace NEVER overwrites Trioloo's
--                    operational data. The order-level fields were protected in the
--                    ingestion path already; the LINE fields are protected by this change.
--   BR-060 / BR-061  Records are reversed, never erased: the amendment table refuses
--                    UPDATE and DELETE at the table.
--   BR-146           A later change never silently rewrites a line - here the change is
--                    deliberate, authorised and recorded.
--
-- ⚠ OWNER DECISION ON THE BOUNDARY: BR-082 stopped changes at COURIER_BOOKED; the owner
--   moves the boundary to DISPATCH. A consignment already booked is NOT updated at the
--   courier (no modification endpoint is known - STF-016 found none); the operator is told.
-- =====================================================================================

CREATE TABLE channel_order_amendment (
    id               uuid         NOT NULL DEFAULT gen_random_uuid(),
    channel_order_id uuid         NOT NULL REFERENCES channel_order (id),
    field            varchar(80)  NOT NULL,
    before_value     text,
    after_value      text,
    reason           text         NOT NULL,
    amended_by       uuid         NOT NULL REFERENCES operational_user_profile (id),
    amended_at       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT channel_order_amendment_pk PRIMARY KEY (id),
    CONSTRAINT channel_order_amendment_reason_present CHECK (length(trim(reason)) > 0)
);

CREATE INDEX channel_order_amendment_order_idx
    ON channel_order_amendment (channel_order_id, amended_at);

COMMENT ON TABLE channel_order_amendment IS
    'BR-058 - one row per changed field of an order: before, after, reason, actor, moment. '
    'Append-only (BR-060).';

CREATE FUNCTION channel_order_amendment_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'channel_order_amendment is append-only (BR-060, BR-061)';
END
$$;

CREATE TRIGGER channel_order_amendment_no_change
    BEFORE UPDATE OR DELETE ON channel_order_amendment
    FOR EACH ROW EXECUTE FUNCTION channel_order_amendment_immutable();

INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'order.order.edit',
     'Edit an order before dispatch: recipient, phone, address, line descriptions and prices, '
     'and the order total, with a reason (OM 7.9). Grants no cancellation, no restoration, no '
     'courier booking, no marketplace write and no inventory, payment or refund action (PRM-096).');
