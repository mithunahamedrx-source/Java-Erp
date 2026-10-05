-- =====================================================================================
-- V32 - The order's type (how it was captured) and who sold it.
--
-- Product-owner instruction, 2026-10-05: New order carries, in one row, a "Customer type"
-- (Walk-in order / Marketplace order / Website order), the Shop, and "Sold by" - a user.
--
-- Canonical basis:
--   OM 3.1 / BR-001  The order is attributed by channel TYPE and INSTANCE (BR-002); the
--                    instance is the shop. The "customer type" below is a further recorded
--                    ATTRIBUTE of how the order was captured and nothing branches on it.
--   CLAUDE.md 8 / AGV-001  Attribution is a first-class fact captured when the authoritative
--                    act occurs: `sold_by` names the user the sale is attributed to, chosen at
--                    creation (defaulting to the creator in the UI), never reconstructed.
--
-- ⚠ NAMING, RECORDED RATHER THAN SETTLED: `CUSTOMER_ARCHITECTURE.md` already uses "customer
--   type" for individual / corporate / reseller. The owner's list here is an ORDER-SOURCE
--   attribute, so it is stored as `order_tag` (V30) and must not be confused with that
--   classification, which no column holds on the order.
-- 🔴 `sold_by` CREATES NO COMMISSION RULE. Sales Commission is HR & Payroll's and is blocked
--   (GAP-123/GAP-124); this records the attribution and nothing more.
-- =====================================================================================

ALTER TABLE channel_order DROP CONSTRAINT channel_order_tag_known;

ALTER TABLE channel_order ADD CONSTRAINT channel_order_tag_known
    CHECK (order_tag IS NULL OR order_tag IN ('WALK_IN', 'MARKETPLACE', 'WEBSITE'));

ALTER TABLE channel_order
    ADD COLUMN sold_by uuid REFERENCES operational_user_profile (id);

COMMENT ON COLUMN channel_order.sold_by IS
    'The user the sale is attributed to, chosen at creation. NULL = not recorded (imported orders). '
    'Attribution only - no commission rule exists (GAP-123/GAP-124).';
