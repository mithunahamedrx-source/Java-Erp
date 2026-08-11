-- Trioloo ERP - Flyway baseline.
--
-- Purpose: establish the Flyway schema history against the authoritative PostgreSQL
-- database and prove migration wiring. Nothing else.
--
-- This migration deliberately creates NO tables.
--
--   * No speculative business tables. Business schema arrives with the module that owns
--     it, in its own migration (PRJ-081).
--   * No stored balance columns. DB-001 derives positions from movements and CP-12
--     forbids a second stored copy; a balance column here would be a defect on day one.
--   * No demo or seed data. No opening balances - GAP-109 remains an open go-live
--     concern and must not be answered by an implementation default.
--   * No bootstrap user, role or permission row. Access Governance and the first-Owner
--     bootstrap (GAP-120) are unresolved and must not be invented here.
--
-- Schema evolution is owned by Flyway (PRJ-080). An applied migration is never edited;
-- corrections are new migrations (PRJ-081).

DO $$
BEGIN
    RAISE NOTICE 'Trioloo ERP baseline applied - FREEZE-V1-2026-08-11. No business schema.';
END $$;
