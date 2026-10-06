-- =====================================================================================
-- V43 - NOTIFICATION, first slice (NOTIFICATION_ARCHITECTURE v1.2.1; owner decision 2026-10-06).
--
-- Three separate things, never one (NOT-001, BD-382):
--   notification            E-055  the communication - WHAT people are told. Evidence only (NOT-001).
--   notification_recipient         PER-RECIPIENT engagement: viewed / dismissed (NOT-015, NOT-018). A row also IS the
--                                  INTENDED recipient (NOT-009), so "never attempted" and "failed" stay distinguishable.
--   notification_delivery   E-080  one row per delivery ATTEMPT (NOT-017) - history, never a mutated field (DB-001).
--
-- The business event is permanent and independent of this table (NOT-002): nothing here is the record of an order.
-- subject_order_id is a plain reference with NO foreign key on purpose - a notification is emitted in its own
-- transaction (failure isolation, P6) and may be written before the source transaction has committed.
--
-- Ongoing Conditions (on hold, waiting for the marketplace, delivery failed, connection problem) are NOT stored here:
-- they are queries over current state (NOT-013).
-- =====================================================================================
CREATE TABLE notification (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    type_code        varchar(48)  NOT NULL,
    category         varchar(24)  NOT NULL,
    priority         varchar(12)  NOT NULL,
    mandatory        boolean      NOT NULL,
    title            varchar(200) NOT NULL,
    body             varchar(600),
    subject_order_id uuid,
    -- One Business Event generates its notification ONCE (NOT-004 / "Generated once").
    dedupe_key       varchar(200) NOT NULL,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT notification_dedupe_unique UNIQUE (dedupe_key),
    CONSTRAINT notification_category_check CHECK (category IN ('INFORMATION', 'ACTION_REQUIRED')),
    CONSTRAINT notification_priority_check CHECK (priority IN ('LOW', 'NORMAL', 'HIGH'))
);

CREATE INDEX notification_created_idx ON notification (created_at DESC);

CREATE TABLE notification_recipient (
    notification_id uuid        NOT NULL REFERENCES notification (id) ON DELETE CASCADE,
    recipient_id    uuid        NOT NULL REFERENCES operational_user_profile (id),
    viewed_at       timestamptz,
    dismissed_at    timestamptz,
    PRIMARY KEY (notification_id, recipient_id)
);

CREATE INDEX notification_recipient_user_idx ON notification_recipient (recipient_id);

CREATE TABLE notification_delivery (
    id              bigserial    PRIMARY KEY,
    notification_id uuid         NOT NULL REFERENCES notification (id) ON DELETE CASCADE,
    recipient_id    uuid         NOT NULL REFERENCES operational_user_profile (id),
    channel         varchar(24)  NOT NULL,
    attempted_at    timestamptz  NOT NULL DEFAULT now(),
    outcome         varchar(12)  NOT NULL,
    failure_detail  text,
    CONSTRAINT notification_delivery_channel_check CHECK (channel IN ('IN_APP')),
    CONSTRAINT notification_delivery_outcome_check CHECK (outcome IN ('PENDING', 'SUCCEEDED', 'FAILED'))
);

CREATE INDEX notification_delivery_notification_idx ON notification_delivery (notification_id);
