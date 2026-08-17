-- =====================================================================================
-- V12 — Market is a closed, ERP-supplied set.
--
-- 🔴 V11 IS ALREADY APPLIED and is therefore immutable, like V1–V10. It added the
-- `market` column with no value constraint, because canon ratified no value set at the
-- time; the set was ratified afterwards, so the constraint arrives here instead.
--
-- 🔴 ADDITIVE ONLY. No column is dropped, no row is rewritten, nothing is backfilled.
-- =====================================================================================

-- INV-16.7 — the recognised set, ratified 2026-08-15, with exactly one current member.
-- 🔴 FREE TEXT IS FORBIDDEN. Adding a member here is a CANONICAL AMENDMENT and a further
-- migration, never an implementation convenience.
--
-- ⚠ NULL IS PERMITTED, AND THAT IS NOT A LOOPHOLE. Two channel_instance rows predate this
-- feature and genuinely have no recorded market. SYS-034 — an unknown fact stays unknown;
-- backfilling them with 'BANGLADESH' would fabricate a business attribution nobody made.
-- New shops cannot reach this state: the application requires a market on creation.
ALTER TABLE channel_instance ADD CONSTRAINT channel_instance_market_recognised
    CHECK (market IS NULL OR market IN ('BANGLADESH'));

COMMENT ON COLUMN channel_instance.market IS
    'INV-16.7 — the operating market of this Channel Instance, from the closed ERP-supplied '
    'set. Business configuration; never free text, never the channel type, never a provider '
    'or transport fact. NULL means no market was ever recorded, not that one was assumed.';
