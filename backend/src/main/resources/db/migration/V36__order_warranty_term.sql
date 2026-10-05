-- =====================================================================================
-- V36 - An order may carry ONE warranty term, chosen on New order and printed on the invoice.
--
-- Product-owner instruction, 2026-10-05: "add 7 days warranty to 12 years warranty on the create order
-- page and the warranty line will show on the invoice." Recorded as BR-197.
--
-- The term is a CODE from a closed list (7 days, 15 days, 1/3/6 months, 1-12 years). NULL means no
-- order-level term was chosen - never a stand-in value (SYS-034). No money, no accounting effect: the
-- warranty CHARGE stays unrecorded and WARRANTY_REPAIR_ARCHITECTURE.md still owns warranty policy.
-- =====================================================================================
ALTER TABLE channel_order
    ADD COLUMN warranty_term varchar(8);

ALTER TABLE channel_order
    ADD CONSTRAINT channel_order_warranty_term_recognised CHECK (
        warranty_term IS NULL
        OR warranty_term IN ('D7', 'D15', 'M1', 'M3', 'M6',
                             'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12'));
