-- =====================================================================================
-- V8 - Channel Listing highlights
--
-- 🔴 PRD-198 - a Channel Listing may carry its OWN ordered, channel-facing highlights.
--    PRD-164 is extended, not replaced: the Sellable Product keeps its master set, and the
--    EFFECTIVE highlights are DERIVED - the Listing's own ordered set where it holds one,
--    otherwise the mapped Sellable Product's master set (PRD-198.c).
--
-- 🔴 ALL-OR-NOTHING, exactly as media resolves (PRD-170). There is no per-slot merge, and
--    the fallback is NEVER materialised as listing-owned rows - which is precisely why this
--    table holds only what the operator actually authored for this listing.
--
-- 🔴 PRD-164.b / PRD-198.b - ORDER IS EXPLICIT. `position` is the authored sequence and is
--    never inferred from insertion order, identifier order or storage order.
--
-- ⚠ PRD-198.f - NO length, count or truncation rule is ratified, so none is imposed here.
--
-- ⚠ V7 and every earlier migration are UNTOUCHED (PRJ-080).
-- =====================================================================================

CREATE TABLE channel_listing_highlight (
    id                  uuid         NOT NULL,
    channel_listing_id  uuid         NOT NULL,

    -- 🔴 The authored marketing sequence. It must survive a re-save unchanged.
    position            integer      NOT NULL,
    highlight_text      text         NOT NULL,

    created_at          timestamptz  NOT NULL,
    created_by          uuid         NOT NULL,
    updated_at          timestamptz  NOT NULL,
    updated_by          uuid         NOT NULL,
    version             bigint       NOT NULL DEFAULT 0,

    CONSTRAINT channel_listing_highlight_pk PRIMARY KEY (id),
    CONSTRAINT channel_listing_highlight_listing_fk
        FOREIGN KEY (channel_listing_id) REFERENCES channel_listing (id),
    CONSTRAINT channel_listing_highlight_position_non_negative
        CHECK (position >= 0),
    -- ⚠ A highlight with no text is not a highlight. Blank rows would render as gaps in a
    -- sequence the operator deliberately ordered.
    CONSTRAINT channel_listing_highlight_text_not_blank
        CHECK (length(btrim(highlight_text)) > 0),
    -- 🔴 One highlight per position per listing, so the authored order is unambiguous.
    CONSTRAINT channel_listing_highlight_position_unique
        UNIQUE (channel_listing_id, position)
);

CREATE INDEX channel_listing_highlight_listing_idx
    ON channel_listing_highlight (channel_listing_id, position);

COMMENT ON TABLE channel_listing_highlight IS
    'PRD-198 - a Channel Listing''s OWN intended highlights. Absence means the effective set '
    'falls back to the mapped Sellable Product master set; the fallback is never copied here.';
COMMENT ON COLUMN channel_listing_highlight.position IS
    'PRD-164.b / PRD-198.b - the explicit authored order. Never inferred.';
