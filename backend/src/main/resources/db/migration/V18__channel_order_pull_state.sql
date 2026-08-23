-- =====================================================================================
-- V18 - Managed Channel Order ingestion: per-shop pull state, and a fact per run.
--
-- Scope:
--   The MVP operating rules ratified at ORDER_MANAGEMENT_ARCHITECTURE.md §29
--   (BR-178 - BR-183). No webhook, no order write to any marketplace, no shipment or
--   fulfilment action, no inventory movement, no settlement.
-- =====================================================================================

-- One row per channel instance. It is the ONLY place the ingestion position is held.
CREATE TABLE channel_order_pull_state (
    channel_instance_id      uuid          NOT NULL REFERENCES channel_instance (id),

    -- BR-179.c - the incremental read is by UPDATE watermark, because `update_after` with
    -- `updated_at` ordering is what the protocol offers (DZC-049.c).
    --
    -- 🔴 BR-179.d - the watermark is applied with an OVERLAP and the overlap is deduplicated
    -- by order_id. This is NOT a tuning choice: no cursor exists (DZC-049.d), and
    -- `update_after` inclusivity and timezone are UNSTATED by the provider (DZC-050.e), so a
    -- non-overlapping watermark can silently miss an order at the boundary.
    update_watermark         timestamptz,

    -- BR-178 - the initial backfill walks BACKWARD in seven-day chunks to a three-month cap.
    -- `backfill_cursor` is how far back it has reached; when it meets `backfill_floor` or the
    -- provider refuses, the backfill is done.
    backfill_floor           timestamptz,
    backfill_cursor          timestamptz,
    backfill_complete        boolean       NOT NULL DEFAULT false,

    -- 🔴 BR-178.c / BR-178.e - a provider refusal STOPS the backfill and is REPORTED. It is
    -- never retried blind, because the refusal is the ANSWER: it names the retention boundary
    -- the provider does not publish (DZC-050.a). The discovered limit is recorded here so it
    -- can be carried into DZC §12 by a human, and it is never inferred.
    backfill_refused_at      timestamptz,
    backfill_refused_from    timestamptz,
    backfill_refusal_detail  text,

    last_run_at              timestamptz,
    version                  bigint        NOT NULL DEFAULT 0,

    CONSTRAINT channel_order_pull_state_pkey PRIMARY KEY (channel_instance_id)
);

COMMENT ON TABLE channel_order_pull_state IS
    'Per-shop Channel Order ingestion position (OM §29). Holds the incremental update '
    'watermark and the backward backfill cursor. One row per channel instance - BR-180.b '
    'forbids any shared or ambient current-shop context.';

-- A fact per run. BR-182.d - a failure is RECORDED AS A FACT, not merely logged and forgotten.
CREATE TABLE channel_order_pull_run (
    id                       uuid          NOT NULL DEFAULT gen_random_uuid(),
    channel_instance_id      uuid          NOT NULL REFERENCES channel_instance (id),

    -- BOUNDARY_PROBE opens a backfill (BR-178.b); BACKFILL_CHUNK is one seven-day window
    -- (BR-178.a); INCREMENTAL is the ordinary cadence read (BR-179).
    kind                     varchar(32)   NOT NULL,
    window_from              timestamptz,
    window_to                timestamptz,

    started_at               timestamptz   NOT NULL DEFAULT now(),
    finished_at              timestamptz,
    complete                 boolean       NOT NULL DEFAULT false,

    pages_read               integer       NOT NULL DEFAULT 0,
    orders_seen              integer       NOT NULL DEFAULT 0,
    orders_created           integer       NOT NULL DEFAULT 0,
    orders_updated           integer       NOT NULL DEFAULT 0,
    items_seen               integer       NOT NULL DEFAULT 0,
    failure_detail           text,

    -- 🔴 AGV-001 / BR-174 - attribution is captured WHEN THE ACTION OCCURS, never
    -- reconstructed afterwards. A scheduled run records SYSTEM; an operator-initiated run
    -- records the operator, who must hold order.channel-order.sync (PRM-091).
    initiated_by             varchar(32)   NOT NULL,
    initiated_by_user_id     uuid,

    CONSTRAINT channel_order_pull_run_pkey PRIMARY KEY (id),
    CONSTRAINT channel_order_pull_run_kind_check
        CHECK (kind IN ('BOUNDARY_PROBE', 'BACKFILL_CHUNK', 'INCREMENTAL')),
    CONSTRAINT channel_order_pull_run_initiator_check
        CHECK (initiated_by IN ('SYSTEM', 'OPERATOR')),
    -- An operator-initiated run without an operator would be unattributable (AGV-001).
    CONSTRAINT channel_order_pull_run_operator_attributed
        CHECK (initiated_by <> 'OPERATOR' OR initiated_by_user_id IS NOT NULL)
);

COMMENT ON TABLE channel_order_pull_run IS
    'One record per Channel Order pull run, successful or not (BR-182.d). Partial success is '
    'retained: BR-182.c forbids a failed page rolling back pages already imported.';

CREATE INDEX channel_order_pull_run_channel_idx
    ON channel_order_pull_run (channel_instance_id, started_at DESC);
CREATE INDEX channel_order_pull_run_incomplete_idx
    ON channel_order_pull_run (channel_instance_id) WHERE complete = false;
