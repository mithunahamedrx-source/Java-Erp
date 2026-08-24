-- =====================================================================================
-- V22 - E-039 Sales Invoice, and its snapshot.
--
-- Scope:
--   The invoice RECORD and its snapshotted content. No printable rendering, no PDF, no
--   accounting posting, no tax calculation, no payment term.
--
-- Canonical basis:
--   INV-39.1 / BD-443  ONE Sales Invoice entity, ONE number sequence, never reused, a
--                      cancelled number retired. No second invoice entity may be created.
--   INV-39.2           Content is SNAPSHOTTED so the invoice stays reproducible years
--                      later.
--   PRN-022            Every printable has exactly ONE deterministic authoritative
--                      source, and the rendering never becomes that source.
--   PRN-023            Sales Invoice - class A, source E-039, SNAPSHOT required.
--   DB-023 / SYS-017   A snapshot is taken at the authoritative moment and is never
--                      rewritten by later changes to the records it copied.
--   OSC-057            The number already exists on channel_order and is immutable.
--
-- 🔴 THIS MIGRATION RESOLVES THE HALF OF GAP-035 THAT BLOCKED `Print`. OSC-058.b refused
--    the Print action because PRN-023 sources the printable from an E-039 record whose
--    content INV-39.2 requires snapshotted, and no such record existed. It does now.
--
-- 🔴 IT DOES NOT RESOLVE THE TAX HALF. GAP-003 supplies no rate, no BIN, no Mushak
--    requirement and no calculation. The columns below can HOLD a tax figure; nothing
--    here computes one, and the design's `vatRate = 7.5` is sample data sitting beside
--    sample Lenovo and Samsung line items (design-reference/TrioLoo Invoice.md §4).
-- =====================================================================================

CREATE TABLE sales_invoice (
    id                      uuid          NOT NULL DEFAULT gen_random_uuid(),
    channel_order_id        uuid          NOT NULL REFERENCES channel_order (id),

    -- 🔴 THE ONE SEQUENCE (INV-39.1). Not re-issued here: OSC-057 already assigned it to
    -- the order and V19's trigger makes it immutable. The invoice ADOPTS the number the
    -- order carries, so a number can never disagree between the two.
    invoice_number          varchar(40)   NOT NULL,

    issued_at               timestamptz   NOT NULL,
    -- AGV-001 - captured at the authoritative act, never reconstructed.
    issued_by               uuid          NOT NULL REFERENCES operational_user_profile (id),

    -- ─────────────────────────────────────────────────────────────────────────────────
    -- THE SNAPSHOT (INV-39.2). Every column below is a COPY taken at issue.
    -- 🔴 NONE OF IT IS A FOREIGN KEY TO A LIVE RECORD. A customer who moves house must not
    --    change where a past invoice says the goods went, and a product renamed next year
    --    must not rename itself on last year's document.
    -- ─────────────────────────────────────────────────────────────────────────────────
    customer_name           varchar(255)  NOT NULL,
    customer_phone          varchar(64),
    customer_address        text,
    -- ⚠ DB-013 - external references are stored WITH their issuing party, so the document
    -- can say who to ask. `external_order_reference` is Daraz's; `consignment_reference`
    -- is Steadfast's; they are never merged into one "reference" column.
    external_order_reference varchar(80),
    consignment_reference    varchar(80),

    -- 💰 DB-079 / TEC-015 - numeric, never float.
    subtotal                numeric(19, 2) NOT NULL,
    delivery_charge         numeric(19, 2),

    -- ⚠ NULLABLE, AND THAT IS THE HONEST SHAPE. The product owner ratified that the
    -- invoice CARRIES VAT (2026-08-24) and BD-307 permits displaying it while the ERP
    -- maintains no VAT accounts. 🔴 GAP-003 still supplies no RATE, so an invoice issued
    -- before the rate is ratified holds NULL - which renders as "not applied" rather than
    -- as a confident zero (SYS-034 - unknown is not a value, and 0% is a claim).
    tax_rate_percent        numeric(6, 3),
    tax_amount              numeric(19, 2),

    total                   numeric(19, 2) NOT NULL,

    -- The line snapshot. jsonb rather than a child table because INV-39.2's requirement is
    -- REPRODUCIBILITY, not queryability: these lines are never aggregated, joined or
    -- reported on. E-032 Order Item remains the queryable record.
    lines_json              jsonb         NOT NULL DEFAULT '[]'::jsonb,

    created_at              timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT sales_invoice_pk PRIMARY KEY (id),
    -- 🔴 INV-39.1 - the number is never reused, and one order yields one invoice.
    CONSTRAINT sales_invoice_number_unique UNIQUE (invoice_number),
    CONSTRAINT sales_invoice_one_per_order UNIQUE (channel_order_id),
    -- ⚠ A rate without an amount, or an amount without a rate, is a half-stated tax fact.
    CONSTRAINT sales_invoice_tax_stated_together CHECK (
        (tax_rate_percent IS NULL AND tax_amount IS NULL)
        OR (tax_rate_percent IS NOT NULL AND tax_amount IS NOT NULL))
);

COMMENT ON TABLE sales_invoice IS
    'E-039 Sales Invoice. Content is SNAPSHOTTED at issue (INV-39.2) so the document '
    'renders identically years later. PRN-022 - this is the printable''s one authoritative '
    'source, and the rendering never becomes that source.';

COMMENT ON COLUMN sales_invoice.tax_rate_percent IS
    'NULL until GAP-003 ratifies a rate. NULL renders as "not applied", never as 0% - '
    'SYS-034, and a zero rate is a claim rather than an absence.';

CREATE INDEX sales_invoice_order_idx ON sales_invoice (channel_order_id);
CREATE INDEX sales_invoice_issued_at_idx ON sales_invoice (issued_at);
