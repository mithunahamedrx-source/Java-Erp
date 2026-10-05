-- =====================================================================================
-- V30 - An order tag, and the first tag: WALK_IN.
--
-- Product-owner instruction, 2026-10-05: an order created by filling only the quick item
-- line and a total price is a WALK-IN ORDER, and is tagged so.
--
-- Canonical basis:
--   OM 3.2 / 5.1.5  Walk-in is a ratified channel: manual capture at the counter, customer
--                   present, no shipment (fulfilment method SELF_PICKUP, DLV-022).
--   BR-001          Behaviour derives from attributes, never from channel identity - so the
--                   tag is a recorded ATTRIBUTE of the order, and nothing branches on it.
--   SYS-034         A customer who gave no name, phone or address is recorded as ABSENT, not
--                   as an invented value.
--
-- ⚠ THIS CREATES A LABEL AND NO LIFECYCLE. BR-013's compressed walk-in lifecycle (immediate
--   release, handover, settlement and closure) is NOT implemented by a tag, and no state is
--   skipped because of one. How a walk-in order completes is owed to the owner.
--
-- 🔴 ONE VALUE IS ADMITTED. A constraint does not acquire room for a tag because one might
--   exist later (the V24 reasoning); the next tag is its own migration.
-- =====================================================================================

ALTER TABLE channel_order
    ADD COLUMN order_tag varchar(20);

ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_tag_known CHECK (order_tag IS NULL OR order_tag IN ('WALK_IN'));

COMMENT ON COLUMN channel_order.order_tag IS
    'A recorded attribute of how the order was captured. WALK_IN = created from the quick item line '
    'and a total price, with the customer present (OM 5.1.5). A label only - it changes no state.';
