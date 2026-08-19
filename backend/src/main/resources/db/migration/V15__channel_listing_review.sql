-- =====================================================================================
-- V15 — Channel-reported product reviews, and the window Trioloo has already collected.
--
-- Storage for the Daraz Product Review API recorded as DZC-032. It adds no adapter, no
-- schedule and no screen: this file is storage and nothing else.
--
-- 🔴 ADDITIVE ONLY. V1–V14 are applied and immutable; this file touches none of them,
-- alters no existing row, drops nothing and seeds nothing.
--
-- 🔴 A REVIEW IS A MIRRORED EXTERNAL FACT (PRD-181). It is written by a channel read and
-- is never authored, edited or pushed. There is deliberately no intended counterpart: a
-- seller does not decide what a buyer wrote.
--
-- 🔴 THIS IS WHY THE TABLE HOLDS REVIEWS RATHER THAN A COUNT. Daraz publishes only 90 days
-- of review history and serves it 7 days at a time (DZC-032.d), so a lifetime total cannot
-- be READ. By storing each review under its own provider identity, Trioloo ACCUMULATES what
-- Daraz forgets, and the count becomes a fact this system owns rather than one it re-asks
-- for. ⚠ It is still a count of what has been COLLECTED, never a claim about all time.
--
-- 🔴 RATINGS ARE TEXT, NOT NUMBERS. The provider's own sample returns every rating as a
-- string, and TEC-015 keeps a mirrored external value in the form it arrived. Averaging is
-- a read-time derivation (DB-001) and no average is stored.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- One review, exactly as the channel reported it.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_review (
    id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
    channel_listing_id  uuid        NOT NULL REFERENCES channel_listing (id),

    -- 🔴 The provider's own review identity. It is what makes a repeated read idempotent:
    --    the same review collected twice is the same row, never a second one.
    external_review_id  varchar(80) NOT NULL,

    -- ⚠ The item id the channel reported ON THE REVIEW. Retained as received rather than
    --   assumed equal to the listing's own external id, so a mismatch stays visible.
    reported_product_id varchar(80),

    -- 🔴 Mirrored as TEXT (TEC-015). Absent is NULL and never zero: a rating the channel
    --    did not return is unknown, not bad (SYS-034).
    overall_rating      varchar(16),
    product_rating      varchar(16),
    seller_rating       varchar(16),
    logistics_rating    varchar(16),

    -- ⚠ Unbounded: a buyer writes as much as they like, and DZC-031.h's lesson is that a
    --   provider text column must not be the thing that fails a read.
    review_content      text,
    seller_reply        text,

    review_type         varchar(40),
    reported_order_id   varchar(80),

    -- The channel's own creation time for the review.
    reviewed_at         timestamptz,

    -- 🔴 WHEN TRIOLOO FIRST SAW IT. Never updated, so the collection window is auditable
    --    and a re-read cannot rewrite history.
    first_seen_at       timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT channel_listing_review_pkey PRIMARY KEY (id),

    -- 🔴 IDEMPOTENCY (PRJ-110, API-064.b). One provider review is one row per listing, so a
    --    repeated weekly window can never duplicate what it already collected.
    CONSTRAINT channel_listing_review_identity_unique
        UNIQUE (channel_listing_id, external_review_id),

    CONSTRAINT channel_listing_review_id_not_blank
        CHECK (length(btrim(external_review_id)) > 0)
);

CREATE INDEX channel_listing_review_listing_idx
    ON channel_listing_review (channel_listing_id, reviewed_at DESC);


-- -------------------------------------------------------------------------------------
-- How far the review collection has actually reached, per listing.
--
-- 🔴 A WATERMARK, NOT A SCHEDULE. It records what HAS been collected; it decides nothing
--    about when the next run happens. ⚠ Without it a weekly run cannot tell a gap it has
--    never covered from a week that genuinely had no reviews — and PRD-177's discipline
--    applies here too: absence is not evidence.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_listing_review_window (
    channel_listing_id  uuid        NOT NULL REFERENCES channel_listing (id),

    -- The oldest and newest points the collection has covered for this listing.
    collected_from      timestamptz,
    collected_through   timestamptz,

    last_run_at         timestamptz,
    -- ⚠ The channel's own refusal, kept verbatim-safe: a reason, never a provider payload.
    last_run_detail     varchar(600),

    CONSTRAINT channel_listing_review_window_pkey PRIMARY KEY (channel_listing_id),
    CONSTRAINT channel_listing_review_window_order
        CHECK (collected_from IS NULL OR collected_through IS NULL
               OR collected_through >= collected_from)
);
