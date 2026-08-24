-- =====================================================================================
-- V21 - E-037 Shipment, and the courier booking record.
--
-- Scope:
--   ONE physical movement of goods toward a customer, in SM-4. No tracking-event
--   table (E-038), no proof of delivery, no claim, no SM-1 Order state change.
--
-- Canonical basis:
--   E-037 / DLV-018  A shipment is an entity in its own right, NOT an attribute of the
--                    order (BR-027, INV-37.1).
--   BR-023 as amended / INV-37.2  An order has at most ONE ACTIVE shipment. Successive
--                    shipments across fulfilment attempts remain normal - an RTO'd
--                    parcel re-sent IS a second shipment. What is withdrawn is
--                    CONCURRENCY, not multiplicity.
--   DLV-020 / INV-37.3  Each shipment carries its own independent state.
--   DLV-023          The address on a shipment is a SNAPSHOT. Changing a customer's
--                    address later never rewrites where a past parcel went.
--   DLV-013 / BR-076 Steadfast is the only courier and is assigned automatically.
--                    There is no courier selection step and none is modelled.
--   SM-4             Fourteen ratified states, external authority (DLV-025).
--
-- 🔴 THIS MIGRATION CHANGES NO SM-1 ORDER STATE, AND THAT IS DELIBERATE.
--    GAP-139 records that OM 6.2 lists COURIER_BOOKED as an SM-1 state while
--    STATE_MACHINE_ARCHITECTURE 5.2 and 5.4 do not have it at all. Two canonical
--    documents disagree, so the Order side is left untouched until one ratification
--    settles it. SM-4's BOOKED is unambiguous, so the shipment side proceeds.
-- =====================================================================================

CREATE TABLE shipment (
    id                      uuid          NOT NULL DEFAULT gen_random_uuid(),
    channel_order_id        uuid          NOT NULL REFERENCES channel_order (id),

    -- ⚠ The Trioloo invoice number sent to the courier as its `invoice` field
    -- (OSC-057, STF-010.b). It is the merchant reference the provider echoes back and
    -- the key /status_by_invoice reads by.
    trioloo_invoice_number  varchar(40)   NOT NULL,

    -- 🔴 SM-4. The courier is system of record for outcome (DLV-025), so this column
    -- records what Trioloo has been TOLD, never what it inferred.
    state                   varchar(32)   NOT NULL,

    -- The provider's own identifiers, from the booking response (STF-010).
    consignment_id          varchar(80),
    tracking_code           varchar(80),

    -- 🔴 DLV-023 - the address SNAPSHOT. Not a foreign key to the customer's current
    -- address: "the address at dispatch" is a snapshotted value (SYS-017, DB-023).
    recipient_name          varchar(255)  NOT NULL,
    recipient_phone         varchar(64)   NOT NULL,
    recipient_address       text          NOT NULL,

    -- 💰 DB-079 / TEC-015 - money is never float. COD is what the courier is asked to
    -- collect, and it is NOT the order total by definition: BR-035 keeps collection and
    -- receipt separate facts.
    cod_amount              numeric(19, 2) NOT NULL,

    note                    text,
    item_description        text,

    -- AGV-001 / DLV-011 - P6, every delivery action is attributable, captured at the
    -- moment the authoritative action occurs and never reconstructed from a log.
    booked_at               timestamptz,
    booked_by               uuid REFERENCES operational_user_profile (id),

    -- The provider's raw word, retained as received (DLV-037, AUD-009, SYS-046).
    -- 🔴 NOT translated to SM-4 here: STF-011 records that no delivery_status value has
    -- ever been observed, so no mapping exists and none is guessed (BR-007, SYS-034).
    provider_status_raw     varchar(120),
    provider_status_seen_at timestamptz,

    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_at              timestamptz   NOT NULL DEFAULT now(),
    version                 bigint        NOT NULL DEFAULT 0,

    CONSTRAINT shipment_pk PRIMARY KEY (id),
    CONSTRAINT shipment_state_known CHECK (state IN (
        'CREATED', 'BOOKED', 'AWAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_HUB',
        'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'RETURNING',
        'RETURNED_TO_WAREHOUSE', 'LOST', 'DAMAGED', 'CANCELLED')),
    -- ⚠ AGV-001 - a booking moment without its actor is an unattributable act.
    CONSTRAINT shipment_booking_attributed CHECK (
        (booked_at IS NULL AND booked_by IS NULL) OR (booked_at IS NOT NULL AND booked_by IS NOT NULL))
);

COMMENT ON TABLE shipment IS
    'E-037 Shipment - one physical movement of goods toward a customer, in SM-4. '
    'An entity in its own right, never an attribute of the order (INV-37.1).';

-- 🔴 ONE INVOICE BOOKS EXACTLY ONCE. The product owner''s rule, 2026-08-24, and the
--    ERP''s own guarantee rather than a hope that the provider enforces it: STF-010.b
--    records that duplicate-`invoice` behaviour at Steadfast is UNKNOWN, and a silent
--    second parcel would violate BR-023 at the courier, where the ERP can neither see
--    it nor undo it.
--
-- ⚠ It is a UNIQUE INDEX and not a UNIQUE CONSTRAINT on the column, because the
--    guarantee is about BOOKINGS: a row that never reached the courier holds no
--    consignment and must not consume the invoice.
CREATE UNIQUE INDEX ux_shipment_booked_invoice
    ON shipment (trioloo_invoice_number)
 WHERE consignment_id IS NOT NULL;

-- 🔴 BR-023 as amended / INV-37.2 - AT MOST ONE ACTIVE SHIPMENT PER ORDER, enforced in
--    the database rather than by the booking service alone. Two concurrent bookings
--    would otherwise both pass an application-level check and both succeed.
--
-- ⚠ MULTIPLICITY IS PRESERVED: the partial index covers only states in which a shipment
--    is still live. A RETURNED_TO_WAREHOUSE or CANCELLED parcel leaves the index, so an
--    RTO'd order can be re-sent as a SECOND shipment - which BD-442 explicitly keeps
--    normal while withdrawing concurrency.
CREATE UNIQUE INDEX ux_shipment_one_active_per_order
    ON shipment (channel_order_id)
 WHERE state NOT IN ('DELIVERED', 'RETURNED_TO_WAREHOUSE', 'LOST', 'DAMAGED', 'CANCELLED');

CREATE INDEX shipment_order_idx ON shipment (channel_order_id);
CREATE INDEX shipment_consignment_idx ON shipment (consignment_id);
CREATE INDEX shipment_state_idx ON shipment (state);
