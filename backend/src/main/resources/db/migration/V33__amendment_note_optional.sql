-- =====================================================================================
-- V33 - The reason for an edit becomes an OPTIONAL NOTE.
--
-- Product-owner instruction, 2026-10-05: when an order is edited the note is optional.
--
-- ⚠ THIS SUPERSEDES BR-190.c / V29's requirement that every edit state a reason. OM 7.9 and
--   BR-058 ask for a reason on every amendment; the owner has decided an edit needs none. What
--   stays mandatory is everything that makes the change ACCOUNTABLE: the field, the before
--   value, the after value, the actor and the moment. The note is context, not authority.
--
-- 🔴 V29 IS NOT EDITED (PRJ-081). Its NOT NULL and non-blank CHECK are replaced here.
-- =====================================================================================

ALTER TABLE channel_order_amendment DROP CONSTRAINT channel_order_amendment_reason_present;

ALTER TABLE channel_order_amendment ALTER COLUMN reason DROP NOT NULL;

-- A note, when given, is not blank: an empty string would read as a note that says nothing.
ALTER TABLE channel_order_amendment ADD CONSTRAINT channel_order_amendment_note_not_blank
    CHECK (reason IS NULL OR length(trim(reason)) > 0);

COMMENT ON COLUMN channel_order_amendment.reason IS
    'An optional note on the edit (V33). NULL = none given. The before and after values, the actor and the '
    'moment are what make an amendment accountable (BR-058), and those are mandatory.';
