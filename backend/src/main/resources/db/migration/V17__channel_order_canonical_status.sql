-- =====================================================================================
-- V17 - Canonical order status mirror, and the ERP's own dispatch observation.
--
-- Scope:
--   Two additive columns on channel_order. No table is created, no column is dropped,
--   no value is rewritten, and V16's raw statuses_json is untouched.
--
-- Why two status columns and not one:
--   BR-173 - ERP authority never deletes external history. statuses_json keeps the
--   marketplace's own vocabulary exactly as reported, forever.
--   §4.3 / BR-005 - converting that vocabulary into canonical status names is the channel
--   adapter's responsibility, performed once at the ingestion boundary.
--   BR-171 / UX-182 - the marketplace's status and Trioloo's operational reading are two
--   facts with two owners and are never merged into one field.
-- =====================================================================================

-- The canonical mirror of the marketplace's reported status (§3.5 - marketplace order
-- existence AND STATUS is the marketplace's system of record while API_MANAGED; BR-003).
-- Values are CanonicalOrderStatus names, i.e. the SM-1 states ratified at OM §6.2.
-- An empty array means the adapter translated nothing, which is a fact, not a zero.
ALTER TABLE channel_order
    ADD COLUMN canonical_statuses_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN channel_order.canonical_statuses_json IS
    'Canonical (SM-1, OM §6.2) mirror of the marketplace status, translated by the channel '
    'adapter at ingestion (§4.3, BR-005). statuses_json retains the raw channel vocabulary '
    'unchanged (BR-173). An untranslatable channel value is absent here, never approximated.';

-- The moment the ERP FIRST OBSERVED this order as DISPATCHED.
--
-- 🔴 THIS IS AN ERP OBSERVATION AND IS NOT A MARKETPLACE FACT. DZC-045.e and DZC-047.c
-- enumerate every field Daraz publishes and NONE of them is a dispatch timestamp, so the
-- moment of carrier handover is not readable. What is recorded here is the instant this
-- system first saw the order carrying DISPATCHED - captured when it occurs and never
-- reconstructed afterwards from provider_updated_at, which moves for unrelated reasons.
--
-- ⚠ It is written ONCE and never rewritten: a later poll that still reports DISPATCHED
-- does not restamp it.
ALTER TABLE channel_order
    ADD COLUMN dispatch_observed_at timestamptz;

COMMENT ON COLUMN channel_order.dispatch_observed_at IS
    'When THIS SYSTEM first observed the order as canonically DISPATCHED. An ERP observation, '
    'not a marketplace fact - Daraz publishes no dispatch timestamp (DZC-045.e, DZC-047.c). '
    'Written once, never rewritten.';

CREATE INDEX channel_order_canonical_statuses_idx
    ON channel_order USING gin (canonical_statuses_json);

CREATE INDEX channel_order_dispatch_observed_idx
    ON channel_order (dispatch_observed_at);
