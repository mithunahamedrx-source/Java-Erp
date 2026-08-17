-- =====================================================================================
-- V13 — the Owner authority designation.
--
-- Closes the persistence half of GAP-120. `AGV-037` ratified Owner as an authority
-- DESIGNATION CARRIED ON THE OPERATIONAL USER PROFILE — explicitly not a role in the role
-- catalogue, not a permission override, and not a scope grant — but nothing ever persisted
-- it, so the designation could not be expressed at all.
--
-- 🔴 ADDITIVE ONLY. V1–V12 are applied history and are untouched. Every column is NULLABLE:
-- an existing profile is NOT an Owner, and nothing here backfills one.
--
-- 🔴 NO OWNER, NO CREDENTIAL AND NO ROLE IS SEEDED. `AGV-038` reserves granting Owner status
-- to an existing Owner; the FIRST one is created by an explicit, one-time, server-side
-- application command and never by a migration. A migration that seeded a privileged
-- account would be exactly the default credential this architecture refuses to have.
-- =====================================================================================

-- WHEN this profile became an Owner. NULL means it is not one (`AGV-039` — the designation
-- is not reachable through role assignment, scope grant or permission override, so this
-- column is the only place it lives).
ALTER TABLE operational_user_profile ADD COLUMN owner_designated_at timestamptz;

-- WHO designated it. `AGV-038` — Owner status is granted by an existing authorised Owner.
-- 🔴 NULL FOR THE FIRST OWNER, AND THAT IS THE POINT: at initial bootstrap no prior Owner
-- exists, so naming one would be a lie in audit data. The origin column below carries the
-- honest distinction instead.
ALTER TABLE operational_user_profile ADD COLUMN owner_designated_by uuid
    REFERENCES operational_user_profile (id);

-- HOW the designation arose (`AGV-041` — every grant is an explicit, auditable act).
ALTER TABLE operational_user_profile ADD COLUMN owner_designation_origin varchar(24);

ALTER TABLE operational_user_profile ADD CONSTRAINT operational_user_profile_owner_origin_check
    CHECK (owner_designation_origin IN ('INITIAL_BOOTSTRAP', 'OWNER_GRANT'));

-- The designation is all-or-nothing: a time without an origin, or an origin without a time,
-- is a half-written privileged fact.
ALTER TABLE operational_user_profile ADD CONSTRAINT operational_user_profile_owner_designation_paired
    CHECK ((owner_designated_at IS NULL) = (owner_designation_origin IS NULL));

-- 🔴 TRUTHFUL PROVENANCE, ENFORCED BY THE DATABASE.
--   INITIAL_BOOTSTRAP → there was no prior Owner, so there MUST be no designating Owner.
--   OWNER_GRANT       → `AGV-038` requires an existing Owner, so one MUST be named.
-- This is what stops a future implementation from quietly recording the first Owner as
-- having designated itself.
ALTER TABLE operational_user_profile ADD CONSTRAINT operational_user_profile_owner_provenance_honest
    CHECK (
        owner_designation_origin IS NULL
        OR (owner_designation_origin = 'INITIAL_BOOTSTRAP' AND owner_designated_by IS NULL)
        OR (owner_designation_origin = 'OWNER_GRANT'       AND owner_designated_by IS NOT NULL)
    );

-- 🔴 THE ONE-TIME GUARD, AT THE ONLY LAYER THAT CANNOT BE RACED. At most one profile may
-- ever carry INITIAL_BOOTSTRAP, so two concurrent bootstrap processes cannot both succeed:
-- one commits, the other fails on this index. `TEC-002`'s single authoritative database is
-- what makes this sufficient — no external lock service is introduced (`TEC-065`).
-- ⚠ It deliberately does NOT limit Owners overall: `AGV-038` expects an Owner to designate
-- further Owners, and those carry OWNER_GRANT.
CREATE UNIQUE INDEX operational_user_profile_single_initial_owner
    ON operational_user_profile ((owner_designation_origin))
    WHERE owner_designation_origin = 'INITIAL_BOOTSTRAP';

COMMENT ON COLUMN operational_user_profile.owner_designated_at IS
    'AGV-037 — the Owner authority designation. NULL means this profile is not an Owner. '
    'Owner is never a role, an override or a scope grant (AGV-039).';
COMMENT ON COLUMN operational_user_profile.owner_designation_origin IS
    'AGV-041 — how the designation arose. INITIAL_BOOTSTRAP is the one-time first Owner and '
    'carries no designating Owner because none existed; OWNER_GRANT requires one (AGV-038).';
