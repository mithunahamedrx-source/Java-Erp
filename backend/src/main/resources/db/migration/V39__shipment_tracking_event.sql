-- =====================================================================================
-- V39 - THE TRACKING EVENT LOG: what the courier has told us, in order.
--
-- Product-owner instruction, 2026-10-05: once an order is booked with Steadfast, the booking and each later
-- Steadfast status change must appear under the order's Tracking section.
--
-- 🔴 Steadfast publishes no scan history - only the CURRENT delivery_status for an invoice (STF-011). So an
-- event here is an OBSERVATION: "at this moment Trioloo was told this". The raw word is kept as received
-- (DLV-037); the mapped SM-4 state is kept only where a mapping exists (BR-007). Rows are only ever added by
-- the application; they live and die with their shipment.
-- =====================================================================================
CREATE TABLE shipment_tracking_event (
    id                   uuid          NOT NULL DEFAULT gen_random_uuid(),
    shipment_id          uuid          NOT NULL REFERENCES shipment (id) ON DELETE CASCADE,
    observed_at          timestamptz   NOT NULL DEFAULT now(),
    event_type           varchar(16)   NOT NULL,
    provider_status_raw  varchar(120),
    shipment_state       varchar(32),
    CONSTRAINT shipment_tracking_event_pk PRIMARY KEY (id),
    CONSTRAINT shipment_tracking_event_type_known CHECK (event_type IN ('BOOKED', 'STATUS'))
);

CREATE INDEX shipment_tracking_event_shipment_idx ON shipment_tracking_event (shipment_id, observed_at);

-- Shipments booked before this log existed get their booking as the first event.
INSERT INTO shipment_tracking_event (shipment_id, observed_at, event_type, provider_status_raw, shipment_state)
SELECT id, booked_at, 'BOOKED', provider_status_raw, 'BOOKED'
  FROM shipment
 WHERE booked_at IS NOT NULL AND consignment_id IS NOT NULL;
