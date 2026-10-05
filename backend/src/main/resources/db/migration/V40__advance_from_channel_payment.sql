-- =====================================================================================
-- V40 - AN ADVANCE MAY COME FROM THE CHANNEL'S OWN PAYMENT, NOT ONLY FROM A PERSON.
--
-- Product-owner instruction, 2026-10-05: "only the DUE amount goes to Steadfast." A website order that the customer
-- already paid online (bKash / Nagad / bank, payment status PAID) must reach the courier with a collect-on-delivery
-- amount of zero, or the customer pays twice at the door. The existing mechanism does exactly that: the courier is
-- asked to collect the price less the advance (BR-127, BR-035). So the online payment is recorded AS the advance.
--
-- BR-127 / AGV-001 require an advance to name who recorded it. An import has no person, so it names its SOURCE
-- instead, the way a scheduled sweep is a NAMED SYSTEM ACTOR (BR-059): advance_source = 'CHANNEL_PAYMENT'.
-- A person who later edits the advance replaces the source with their own name.
-- =====================================================================================
ALTER TABLE channel_order
    ADD COLUMN advance_source varchar(24);

ALTER TABLE channel_order
    DROP CONSTRAINT channel_order_advance_consistent;

ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_advance_consistent CHECK (
        (advance_received IS NULL AND advance_recorded_at IS NULL AND advance_recorded_by IS NULL
             AND advance_source IS NULL)
        OR (advance_received IS NOT NULL AND advance_received > 0 AND advance_recorded_at IS NOT NULL
             AND ((advance_recorded_by IS NOT NULL AND advance_source IS NULL)
                  OR (advance_recorded_by IS NULL AND advance_source = 'CHANNEL_PAYMENT')))
    );

COMMENT ON COLUMN channel_order.advance_source IS
    'BR-203 - set instead of advance_recorded_by when the channel itself reported the payment (a website order paid '
    'online). NULL when a person recorded the advance.';
