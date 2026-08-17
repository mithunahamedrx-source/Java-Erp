-- =====================================================================================
-- V11 — Shops & Channels.
--
-- Closes the persistence half of GAP-133. Every column here exists because a RATIFIED
-- rule requires the fact, and the rule is named beside it. Nothing is added "for later".
--
-- 🔴 ADDITIVE ONLY. V1–V10 are applied and immutable; this file touches none of them and
-- drops nothing. Every new column is NULLABLE because six existing channel_instance rows
-- predate these facts and SYS-034 forbids inventing a value to satisfy NOT NULL.
--
-- 🔴 NO SECRET LIVES HERE. No app key, app secret, access token, refresh token or raw
-- provider payload has a column in this migration, in channel_instance or in
-- channel_connection (API-070, SCS-052). The credential store remains Integration's and
-- is not created by this file.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- E-016 Channel Instance — the System-owned shop record (DM-084.b).
-- -------------------------------------------------------------------------------------

-- INV-16.7 — the market the account operates in. Operator input at creation, FIXED once
-- an account is bound (SCS-030).
ALTER TABLE channel_instance ADD COLUMN market varchar(80);

-- INV-16.5 / INV-16.6 — the AUTHORITATIVE binding identity, reported by the channel and
-- 🔴 NEVER typed by an operator. The mismatch test in SCS-044 is made against this and
-- against nothing else.
ALTER TABLE channel_instance ADD COLUMN external_account_identity varchar(160);

-- INV-16.14 / SCS-041 — a SECOND remote fact, distinct from the identity above and never
-- collapsed into it. 🔴 Never used for binding or for mismatch checking. Optional even
-- when bound: not every channel exposes an address.
ALTER TABLE channel_instance ADD COLUMN external_link varchar(500);

-- INV-16.15 / SCS-042 — first-class operational audit facts, captured at the moment of
-- the authoritative act and 🔴 never reconstructed from a log or guessed at render time.
--
-- bound_at and authorised_at are DIFFERENT facts: re-authorising the SAME account renews
-- the authorisation and does not re-bind, so bound_at is stable across renewals.
ALTER TABLE channel_instance ADD COLUMN bound_at timestamptz;
ALTER TABLE channel_instance ADD COLUMN authorised_at timestamptz;

-- SCS-042 / SCS-051 — the DRAFT → ACTIVE transition and the ERP actor who performed it.
-- AGV-001 — attribution is captured by the transition itself.
ALTER TABLE channel_instance ADD COLUMN activated_at timestamptz;
ALTER TABLE channel_instance ADD COLUMN activated_by uuid
    REFERENCES operational_user_profile (id);

-- INV-16.6 — one remote account belongs to one shop. A second shop claiming the same
-- account on the same channel type is the rebind SCS-044 rejects, enforced here as well
-- as in the application service.
CREATE UNIQUE INDEX channel_instance_bound_account_unique
    ON channel_instance (channel_type, external_account_identity)
    WHERE external_account_identity IS NOT NULL;

-- INV-15.4 — Channel Type is a CLOSED SET and free text is forbidden. The set is
-- E-015's recognised set as refined 2026-08-15; the registry UI exposes a subset of it
-- (SCS-092.b), which this constraint deliberately does not encode.
--
-- ⚠ The two existing rows already hold DARAZ and WEBSITE and satisfy this.
ALTER TABLE channel_instance ADD CONSTRAINT channel_instance_type_recognised
    CHECK (channel_type IN ('DARAZ', 'WEBSITE', 'SHOPIFY', 'WOOCOMMERCE',
                            'FACEBOOK', 'WHATSAPP', 'PHONE', 'WALKIN'));

-- SCS-051 — activation attribution is a pair. A record may have neither, but never one
-- half: an activation time with no actor is exactly the unattributable write AGV-001
-- exists to prevent.
ALTER TABLE channel_instance ADD CONSTRAINT channel_instance_activation_paired
    CHECK ((activated_at IS NULL) = (activated_by IS NULL));

-- INV-16.14 — the link is remote-derived on authorisation, so it cannot exist before an
-- account is bound.
ALTER TABLE channel_instance ADD CONSTRAINT channel_instance_link_requires_binding
    CHECK (external_link IS NULL OR external_account_identity IS NOT NULL);

COMMENT ON COLUMN channel_instance.external_account_identity IS
    'INV-16.5 — the authoritative remote account this shop is bound to, reported by the '
    'channel and never typed. The SCS-044 mismatch test reads this column.';
COMMENT ON COLUMN channel_instance.external_link IS
    'INV-16.14 — a second, distinct remote fact: where the shop can be opened on the '
    'channel. Never identity, never used for binding, and optional even when bound.';

-- -------------------------------------------------------------------------------------
-- The connection record — INTEGRATION-OWNED (API-068, API-069).
--
-- 🔴 SEPARATE TABLE ON PURPOSE. Configuration lifecycle and connection condition are two
-- independent facts (SCS-040), owned by two different modules, and readable
-- independently — which is what lets the shop render in full when the connection cannot
-- be read at all (SCS-043.a).
--
-- 🔴 ABSENCE IS THE ANSWER, NOT A STORED DEFAULT. A shop with no row here has never been
-- authorised, which is exactly NOT_CONNECTED (SCS-043). No row is written at creation,
-- so no fabricated connection fact ever exists.
-- -------------------------------------------------------------------------------------
CREATE TABLE channel_connection (
    channel_instance_id uuid        NOT NULL,
    state               varchar(24) NOT NULL,
    -- SCS-042 — when the condition was last ACTUALLY OBSERVED. 🔴 A page load is not an
    -- observation; nothing writes this column at render time.
    last_checked_at     timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT channel_connection_pkey PRIMARY KEY (channel_instance_id),
    CONSTRAINT channel_connection_instance_fk
        FOREIGN KEY (channel_instance_id) REFERENCES channel_instance (id),
    -- API-068 — the four canonical conditions. 🔴 There is no UNREADABLE value: that is a
    -- presentation state produced by a failed READ, never a durable condition (SCS-043.a).
    CONSTRAINT channel_connection_state_check
        CHECK (state IN ('CONNECTED', 'NOT_CONNECTED', 'REAUTH_REQUIRED', 'ERROR'))
);

COMMENT ON TABLE channel_connection IS
    'API-068 connection condition for one E-016 Channel Instance, owned by Integration. '
    'Absence means never authorised (NOT_CONNECTED). Holds no credential of any kind.';

-- -------------------------------------------------------------------------------------
-- PRM-090 — the four capability codes, transcribed verbatim from PERMISSION_ARCHITECTURE.
-- 🔴 PRM-089.f — implementation may never coin a permission code. Each is INDEPENDENT:
-- manage never implies lifecycle, and neither implies authorize (PRM-090.a).
-- -------------------------------------------------------------------------------------
INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'system.channel-instance.view',
     'View Shops & Channels; view non-secret shop, account and connection-summary facts. '
     'Grants no change, no lifecycle act and no authorisation (PRM-090).'),
    (gen_random_uuid(), 'system.channel-instance.manage',
     'Create and update mutable local Channel Instance metadata. Grants no lifecycle '
     'authority and no authorisation authority (PRM-090).'),
    (gen_random_uuid(), 'system.channel-instance.lifecycle',
     'Perform Channel Instance configuration lifecycle transitions (SYS-108). Grants no '
     'OAuth or authorisation authority (PRM-090).'),
    (gen_random_uuid(), 'integration.channel-connection.authorize',
     'Initiate and re-initiate external authorisation for a Channel Instance (API-069.a). '
     'Grants no ordinary shop metadata management (PRM-090).');
