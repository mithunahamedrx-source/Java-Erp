-- Trioloo ERP - Access identity and authority.
--
-- Implements the persistence required for authentication, current-actor resolution and
-- permission enforcement. Nothing else.
--
-- Owning architecture: PERMISSION_ARCHITECTURE.md and ACCESS_GOVERNANCE_ARCHITECTURE.md.
-- Authentication MECHANISM (credential storage, session transport) is an engineering
-- deliverable by API-044 / AGV 2.2 / PRM 2.2. The MEANING below is canonical.
--
-- Deliberately absent: no default Owner, no default Administrator, no seed user, no demo
-- credential. GAP-120 / GAP-121 / GAP-122 remain open go-live concerns and are NOT
-- resolved by this migration.

-- =====================================================================================
-- E-077 Operational User Profile - the operational identity of every authenticated actor
-- (AGV-006). Supersedes E-006 (DM-068). Permission/Access-Governance owned; HR extends it
-- through E-090 and owns no authentication identity.
-- =====================================================================================
CREATE TABLE operational_user_profile (
    id               uuid        PRIMARY KEY,
    username         varchar(100) NOT NULL,
    full_name        varchar(200) NOT NULL,

    -- AGV/PRM 7.1 canonical lifecycle. Deliberately NOT a boolean: INVITED, SUSPENDED,
    -- DISABLED and EXPIRED are canonically distinct states with distinct consequences.
    lifecycle_state  varchar(20) NOT NULL,

    created_at       timestamptz NOT NULL,

    -- Records the INVITED -> ACTIVE transition moment (first successful sign-in).
    -- Attribution is captured when the authoritative action occurs (AGV-001), never
    -- reconstructed later from logs.
    activated_at     timestamptz,

    CONSTRAINT operational_user_profile_username_unique UNIQUE (username),
    CONSTRAINT operational_user_profile_lifecycle_state_check
        CHECK (lifecycle_state IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED')),
    -- An ACTIVE profile must carry the moment it became ACTIVE.
    CONSTRAINT operational_user_profile_activated_when_active
        CHECK (lifecycle_state <> 'ACTIVE' OR activated_at IS NOT NULL)
);

COMMENT ON TABLE operational_user_profile IS
    'E-077 Operational User Profile. PRM-021: a user record is NEVER deleted - DISABLED removes access, not history.';

-- =====================================================================================
-- Credential storage - technical, engineering-owned, deliberately SEPARATE from identity.
-- Keeping the hash out of the profile table means no identity read can ever leak it.
-- =====================================================================================
CREATE TABLE user_credential (
    user_id       uuid        PRIMARY KEY REFERENCES operational_user_profile (id),
    -- Spring Security DelegatingPasswordEncoder format, e.g. {bcrypt}$2a$... Never plaintext.
    password_hash varchar(255) NOT NULL,
    updated_at    timestamptz  NOT NULL
);

-- =====================================================================================
-- Permission - the unit of authority. PRM P3: deny by default.
-- =====================================================================================
CREATE TABLE permission (
    id          uuid         PRIMARY KEY,
    code        varchar(120) NOT NULL,
    description varchar(400) NOT NULL,
    CONSTRAINT permission_code_unique UNIQUE (code)
);

-- =====================================================================================
-- Role - configuration, not structure (SYS-013). The baseline set in PRM 6.1 is a
-- starting point, not a fixed list. AGV 13.4: Administrator is a ROLE, not a mode - it
-- holds exactly the permissions granted to it here and nothing more.
-- =====================================================================================
CREATE TABLE role (
    id   uuid         PRIMARY KEY,
    code varchar(120) NOT NULL,
    name varchar(200) NOT NULL,
    CONSTRAINT role_code_unique UNIQUE (code)
);

CREATE TABLE role_permission (
    role_id       uuid NOT NULL REFERENCES role (id),
    permission_id uuid NOT NULL REFERENCES permission (id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_role (
    user_id uuid NOT NULL REFERENCES operational_user_profile (id),
    role_id uuid NOT NULL REFERENCES role (id),
    PRIMARY KEY (user_id, role_id)
);

-- =====================================================================================
-- Permission override - AGV-022 / AGV-023. Exceptional adjustment only, never the primary
-- administration method. Overrides may GRANT or REVOKE; the revoke direction is what
-- prevents role proliferation.
--
-- AGV-024: an override may control WHETHER a user performs an action; it may NEVER carry a
-- percentage or amount. There is deliberately no magnitude column here - BD-275's
-- prohibition on per-user discount limits could otherwise return through this table.
-- =====================================================================================
CREATE TABLE user_permission_override (
    id              uuid         PRIMARY KEY,
    user_id         uuid         NOT NULL REFERENCES operational_user_profile (id),
    permission_id   uuid         NOT NULL REFERENCES permission (id),

    direction       varchar(10)  NOT NULL,   -- GRANT | REVOKE  (AGV-023)
    override_type   varchar(10)  NOT NULL,   -- PERMANENT | TEMPORARY (AGV-022)
    status          varchar(20)  NOT NULL,   -- SM-17: ACTIVE | REVIEW_REQUIRED | REMOVED | EXPIRED

    business_reason varchar(500) NOT NULL,   -- AGV 11.2 recorded fields
    granted_by      uuid         NOT NULL REFERENCES operational_user_profile (id),
    granted_at      timestamptz  NOT NULL,
    effective_from  timestamptz  NOT NULL,
    expires_at      timestamptz,             -- TEMPORARY requires a validity period

    CONSTRAINT user_permission_override_direction_check CHECK (direction IN ('GRANT', 'REVOKE')),
    CONSTRAINT user_permission_override_type_check CHECK (override_type IN ('PERMANENT', 'TEMPORARY')),
    CONSTRAINT user_permission_override_status_check
        CHECK (status IN ('ACTIVE', 'REVIEW_REQUIRED', 'REMOVED', 'EXPIRED')),
    -- AGV-022: a TEMPORARY override requires a validity period; PERMANENT names the
    -- absence of an expiry condition.
    CONSTRAINT user_permission_override_temporary_needs_expiry
        CHECK (override_type <> 'TEMPORARY' OR expires_at IS NOT NULL)
);

CREATE INDEX user_permission_override_user_idx ON user_permission_override (user_id);

-- =====================================================================================
-- Scope assignment - AGV-018 makes Scope one of the four components of effective
-- authority, so the model would misrepresent canon without it.
--
-- AGV-024: scope BOUNDS authority; it never grants it. AGV 10.3: scope is designed for
-- growth and is NOT active today - so this table is created for structural fidelity and
-- is deliberately NOT consulted by permission resolution in this step. Activating it
-- requires the dimension extensibility that GAP-098 still tracks.
-- =====================================================================================
CREATE TABLE user_scope_assignment (
    id         uuid         PRIMARY KEY,
    user_id    uuid         NOT NULL REFERENCES operational_user_profile (id),
    dimension  varchar(60)  NOT NULL,
    value      varchar(200) NOT NULL,
    CONSTRAINT user_scope_assignment_unique UNIQUE (user_id, dimension, value)
);

COMMENT ON TABLE user_scope_assignment IS
    'AGV-018 component. Bounds authority, never grants it (AGV-024). NOT active in V1 (AGV 10.3) and not consulted by permission resolution.';
