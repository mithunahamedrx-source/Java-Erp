-- =====================================================================================
-- V14 — Integration-owned provider credential storage and OAuth callback correlation.
--
-- Closes the PERSISTENCE half of the provider-authorisation gap left open by GAP-133.
-- It adds no adapter, no OAuth client, no callback route and no provider protocol: this
-- file is storage and nothing else.
--
-- 🔴 ADDITIVE ONLY. V1–V13 are applied and immutable; this file touches none of them,
-- alters no existing row, drops nothing and seeds nothing.
--
-- 🔴 NO SECRET IS WRITTEN BY THIS FILE. It creates the PLACE where Integration keeps
-- encrypted authorisation material (API-069, API-070.b). No app key, app secret, access
-- token, refresh token or raw provider payload appears here as a value, and the encryption
-- key itself never enters the database at all — it is supplied to the application through
-- production environment configuration and lives nowhere in this schema or its backups.
--
-- 🔴 CIPHERTEXT ONLY. Both token columns are bytea and hold AES-256-GCM output. Plaintext
-- has no column, no default and no path into this schema.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- channel_credential — the CURRENT provider authorisation material of one Channel
-- Instance. Integration-owned (API-069); the business record never sees it (API-070.a).
-- -------------------------------------------------------------------------------------

CREATE TABLE channel_credential (
    -- API-068.d / AGV-016 — ONE credential set per Channel Instance. The primary key IS
    -- that invariant: a second current credential for the same shop cannot be inserted.
    -- 🔴 Seven Daraz shops are SEVEN scoped credentials, never one actor holding seven.
    channel_instance_id      uuid        NOT NULL,

    -- The encrypted access token. NOT NULL because a credential row without one is
    -- meaningless — there would be nothing to authorise with.
    access_token_cipher      bytea       NOT NULL,

    -- The encrypted refresh token, where the provider issues one. NULLABLE because this
    -- table is PROVIDER-NEUTRAL: not every provider returns a refresh token, and encoding
    -- one provider's habit as a universal constraint would be a lie about the others.
    refresh_token_cipher     bytea,

    -- ⚠ EXPIRY MAY BE UNKNOWN, WHICH IS NOT THE SAME AS ABSENT. A provider that does not
    -- report an expiry leaves this NULL and the adapter refreshes REACTIVELY instead of
    -- proactively. SYS-034 — an unknown fact stays unknown; a fabricated expiry would make
    -- the application discard a working token or trust a dead one.
    --
    -- 🔴 THE TWO EXPIRIES ARE INDEPENDENT FACTS and are never derived from one another.
    access_token_expires_at  timestamptz,
    refresh_token_expires_at timestamptz,

    -- Which key/scheme pair decrypts THIS ROW. Without it, rotating the encryption key
    -- would require decrypting every row at once.
    --
    -- 🔴 ONE VERSION FOR THE WHOLE ROW. Every present ciphertext in this row is encrypted
    -- under this version. Mixed-version rows are forbidden: any mutation after the active
    -- key changes re-encrypts ALL present material and updates this column atomically.
    -- ⚠ This column is also bound into the GCM additional authenticated data, so rewriting
    -- it in the database causes authentication to FAIL rather than silently selecting a
    -- different key.
    encryption_key_version   smallint    NOT NULL,

    -- When this material was last SILENTLY ROTATED by a token refresh. NULL = never.
    -- 🔴 A refresh is NOT an authorisation act: it must never move channel_instance's
    -- authorised_at, which INV-16.15 reserves for an authorisation actually established or
    -- renewed by the operator. Integration keeps its own mechanical timestamp here.
    refreshed_at             timestamptz,

    updated_at               timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT channel_credential_pkey PRIMARY KEY (channel_instance_id),

    -- 🔴 NO CASCADE, DELIBERATELY. INV-16.10 forbids hard-deleting a Channel Instance, so
    -- a cascade would encode a deletion event that cannot legitimately occur. Disconnect
    -- deletes THIS row explicitly and leaves the shop and its binding history intact.
    CONSTRAINT channel_credential_instance_fk
        FOREIGN KEY (channel_instance_id) REFERENCES channel_instance (id),

    CONSTRAINT channel_credential_key_version_check
        CHECK (encryption_key_version >= 1),

    -- ⚠ ONE-DIRECTIONAL, AND THE DIRECTION MATTERS. An expiry describing a refresh token
    -- that does not exist is incoherent and is refused. The converse is PERMITTED: a
    -- refresh token whose expiry the provider never reported is a legitimate state.
    CONSTRAINT channel_credential_refresh_expiry_check
        CHECK (refresh_token_expires_at IS NULL OR refresh_token_cipher IS NOT NULL),

    -- An empty ciphertext is not encryption. These catch a truncated or defaulted write
    -- at the database rather than at the first attempt to use the credential.
    CONSTRAINT channel_credential_access_cipher_check
        CHECK (octet_length(access_token_cipher) > 0),
    CONSTRAINT channel_credential_refresh_cipher_check
        CHECK (refresh_token_cipher IS NULL OR octet_length(refresh_token_cipher) > 0)
);

COMMENT ON TABLE channel_credential IS
    'API-069 / API-070 — Integration-owned provider authorisation material for one Channel '
    'Instance. Ciphertext only (AES-256-GCM); the encryption key is supplied by environment '
    'configuration and never appears in this database. No secret is ever projected to a '
    'business API, a frontend, browser storage or a log.';

COMMENT ON COLUMN channel_credential.encryption_key_version IS
    'The key/scheme version that encrypted EVERY present ciphertext in this row. Also bound '
    'into the GCM additional authenticated data, so tampering with this value fails '
    'authentication instead of selecting another key.';

COMMENT ON COLUMN channel_credential.access_token_expires_at IS
    'When the access token expires, WHERE THE PROVIDER REPORTED IT. NULL means the expiry is '
    'unknown, not that the token never expires (SYS-034). Provider-specific requirements — '
    'Daraz supplies both durations — are enforced by that provider''s adapter, not here.';

COMMENT ON COLUMN channel_credential.refreshed_at IS
    'When this material was last silently rotated by a token refresh. NULL = never. A refresh '
    'is not an authorisation act and never moves channel_instance.authorised_at (INV-16.15).';


-- -------------------------------------------------------------------------------------
-- channel_authorisation_attempt — one-time, expiring OAuth callback correlation.
--
-- 🔴 THE CALLBACK NEVER CHOOSES THE SHOP. The Channel Instance is recorded HERE when the
-- operator starts authorisation, and the returning callback can only resolve the shop that
-- was bound at initiation. A forged or swapped callback parameter cannot redirect a
-- successful authorisation onto a different shop.
-- -------------------------------------------------------------------------------------

CREATE TABLE channel_authorisation_attempt (
    id                  uuid        NOT NULL,

    -- 🔴 THE HASH, NEVER THE NONCE. The state value handed to the provider is not stored:
    -- only its SHA-256. A leaked database backup therefore cannot be used to forge a
    -- callback, because the value the provider will return cannot be recovered from it.
    state_token_hash    bytea       NOT NULL,

    -- The shop this attempt belongs to — the wrong-shop protection, as a column.
    channel_instance_id uuid        NOT NULL,

    -- Who started it. Attribution captured AT THE ACT, never reconstructed from logs.
    initiated_by        uuid        NOT NULL,

    created_at          timestamptz NOT NULL DEFAULT now(),

    -- Short-lived by design: an authorisation redirect that has not returned within its
    -- window is abandoned, not indefinitely resumable.
    expires_at          timestamptz NOT NULL,

    -- 🔴 NULL = NOT YET CONSUMED. This column IS the one-time semantic. Consumption is a
    -- single conditional UPDATE, so of two concurrent callbacks exactly one can win and the
    -- loser is refused — replay refusal is a database guarantee, not application etiquette.
    consumed_at         timestamptz,

    CONSTRAINT channel_authorisation_attempt_pkey PRIMARY KEY (id),

    CONSTRAINT channel_authorisation_attempt_state_uq UNIQUE (state_token_hash),

    CONSTRAINT channel_authorisation_attempt_instance_fk
        FOREIGN KEY (channel_instance_id) REFERENCES channel_instance (id),

    CONSTRAINT channel_authorisation_attempt_actor_fk
        FOREIGN KEY (initiated_by) REFERENCES operational_user_profile (id),

    -- SHA-256 is exactly 32 bytes. A different length means something other than the
    -- ratified hash was written.
    CONSTRAINT channel_authorisation_attempt_hash_length_check
        CHECK (octet_length(state_token_hash) = 32),

    CONSTRAINT channel_authorisation_attempt_window_check
        CHECK (expires_at > created_at),

    CONSTRAINT channel_authorisation_attempt_consumed_check
        CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

COMMENT ON TABLE channel_authorisation_attempt IS
    'One-time, expiring correlation between an authorisation redirect and the Channel '
    'Instance that initiated it. Only the SHA-256 of the state nonce is stored. The callback '
    'never selects the shop; this row does.';

COMMENT ON COLUMN channel_authorisation_attempt.state_token_hash IS
    'SHA-256 of the state nonce. 🔴 The nonce itself is never persisted, so a database dump '
    'cannot be used to forge a callback.';
