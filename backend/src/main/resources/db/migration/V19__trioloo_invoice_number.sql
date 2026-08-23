-- =====================================================================================
-- V19 - The Trioloo-issued invoice number.
--
-- Scope:
--   ONE never-reused sequence, one immutable human-facing number per Channel Order,
--   backfilled oldest to newest. No invoice DOCUMENT, no invoice content, no issue
--   date, no customer snapshot, no totals, no print action, no accounting posting.
--
-- Canonical basis:
--   PRN-013  Sales Invoice numbering is preserved exactly: ONE sequence, never reused,
--            a cancelled number retired.
--   INV-39.1 / BD-443  ONE Sales Invoice entity with ONE number sequence. A SECOND
--            invoice numbering sequence may NOT be created. This is that one sequence,
--            not a rival to it.
--   DB-012   Business identifiers are unique within their company scope and are never
--            reused, including after cancellation or voiding.
--   DB-050   Two processes issuing an invoice number must not produce the same number.
--   PRN-014  An internal entity reference is not a human-facing document number. The
--            order already has `id` and it already carries Daraz's `external_order_id`;
--            neither is a Trioloo-issued human-facing number, and this is.
--
-- Product owner's decision, 2026-08-24:
--   Every existing and future order receives one, none is skipped, none is ever
--   regenerated, numbering starts at TR0001 and runs oldest to newest.
--
-- REPORTED, NOT RESOLVED (GAP-035):
--   `E-039 Sales Invoice` is an ENTITY with an issue date, a customer snapshot, line
--   detail and totals, and `INV-39.2` requires that content be snapshotted so the
--   invoice stays reproducible years later. NONE of that is created here. This
--   migration issues the NUMBER ahead of the DOCUMENT, at the owner's instruction.
--   `GAP-035` stays open and is now open in a narrower place: what an invoice CONTAINS
--   and WHEN it is issued, no longer how it is numbered.
-- =====================================================================================

-- 🔴 THE ONE SEQUENCE. `INV-39.1` permits exactly one and `BD-443` prohibits a second,
-- so it is named for the business fact rather than for the table it currently serves.
CREATE SEQUENCE trioloo_invoice_number_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;

COMMENT ON SEQUENCE trioloo_invoice_number_seq IS
    'PRN-013 / INV-39.1 - the single Sales Invoice number sequence. Never reused. '
    'NO CYCLE is deliberate: a wrapped sequence would re-issue a retired number, which '
    'DB-012 forbids outright.';

ALTER TABLE channel_order
    ADD COLUMN trioloo_invoice_number varchar(40);

COMMENT ON COLUMN channel_order.trioloo_invoice_number IS
    'The Trioloo-issued human-facing invoice number, e.g. TR0001. Immutable once set '
    '(enforced by trg_channel_order_invoice_number_immutable). DISTINCT from the '
    'marketplace invoice number on channel_order_item, which is an external fact under '
    'BR-171 and stays where it is.';

-- ─────────────────────────────────────────────────────────────────────────────────────
-- Backfill: oldest to newest, no order skipped.
--
-- ⚠ THE ORDERING KEY IS A TOTAL ORDER, DELIBERATELY. `provider_created_at` alone is not:
-- production holds a group of orders sharing one timestamp to the second, and a
-- non-deterministic ORDER BY would make the numbering depend on the plan chosen. The
-- tie-break chain ends in `external_order_id`, which is unique per shop, so the result
-- is reproducible.
--
-- ⚠ `NULLS LAST` is a decision, not a default. An order whose marketplace timestamp
-- could not be read is not thereby the oldest (SYS-034 - unknown is not a value), so it
-- sorts after every order whose age IS known. Production currently holds none.
-- ─────────────────────────────────────────────────────────────────────────────────────
WITH ordered AS (
    SELECT id,
           row_number() OVER (
               ORDER BY provider_created_at ASC NULLS LAST,
                        imported_at ASC,
                        external_order_id ASC
           ) AS seq
      FROM channel_order
)
UPDATE channel_order o
   SET trioloo_invoice_number = 'TR' || lpad(ordered.seq::text, 4, '0')
  FROM ordered
 WHERE o.id = ordered.id;

-- Advance the sequence past everything the backfill consumed, so the next issued number
-- continues the run instead of colliding with it.
SELECT setval('trioloo_invoice_number_seq',
              GREATEST((SELECT count(*) FROM channel_order), 1),
              (SELECT count(*) FROM channel_order) > 0);

-- 🔴 UNIQUENESS IS ENFORCED BY THE DATABASE, NOT BY THE ISSUING CODE. `DB-050` states
-- the requirement as a correctness property independent of technology: two processes
-- issuing a number must not produce the same one. A sequence makes collision unlikely;
-- this index makes it impossible.
CREATE UNIQUE INDEX ux_channel_order_trioloo_invoice_number
    ON channel_order (trioloo_invoice_number)
 WHERE trioloo_invoice_number IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────────────
-- 🔴 NEVER REGENERATED. The owner's instruction was explicit, and an application-side
-- guard is not the same promise: a migration, a repair script, a console session or a
-- future ON CONFLICT clause could each overwrite one. This refuses at the table.
--
-- ✅ NULL -> value is permitted; that is issuance. value -> same value is permitted; an
-- untouched column in a wide UPDATE must not raise. Everything else raises.
-- ─────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION channel_order_invoice_number_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.trioloo_invoice_number IS NOT NULL
       AND NEW.trioloo_invoice_number IS DISTINCT FROM OLD.trioloo_invoice_number THEN
        RAISE EXCEPTION
            'PRN-013/DB-012: invoice number % is issued and immutable; it cannot be '
            'changed to % or cleared. A retired number is never reused and never '
            'regenerated.',
            OLD.trioloo_invoice_number, NEW.trioloo_invoice_number
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_channel_order_invoice_number_immutable
    BEFORE UPDATE ON channel_order
    FOR EACH ROW
    EXECUTE FUNCTION channel_order_invoice_number_immutable();
