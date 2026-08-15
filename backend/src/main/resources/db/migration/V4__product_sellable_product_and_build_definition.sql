-- =====================================================================================
-- V4 - Stage P2. Product Sellable Product (E-058) and the reusable build definition
--      (E-060 Build Template, E-061 BOM Line) plus bundle membership (E-063).
--
-- Owning architecture:
--   PRODUCT_ARCHITECTURE.md §9  - E-058 Sellable Product, PRD-021 resolution target
--   PRODUCT_ARCHITECTURE.md §37 - PRD-156 ASSEMBLED finished variant identity
--   PRODUCT_ARCHITECTURE.md §11 - E-060 Build Template, E-061 BOM Line
--   PRODUCT_ARCHITECTURE.md §12 - E-063 Bundle Member
--   DOMAIN_MODEL.md             - INV-58.*, INV-60.*, INV-61.*, INV-63.*
--   PRODUCT_ARCHITECTURE.md §36 - PRD-155 capability codes
--
-- 🔴 INV-58.1 / PRD-003 - A SELLABLE PRODUCT NEVER HOLDS STOCK. There is deliberately no
--    sellable_stock, buildable_balance, bundle_stock, available_quantity, ready_built or
--    any other quantity column below. INV-58.4 / PRD-023: availability is ALWAYS derived
--    from the resolution target at query time and is never stored.
--
-- 🔴 Equally absent, and deliberately: channel_price, marketplace_price, daraz_price,
--    website_price (channel price belongs to E-059 - PRD-029, PRD §10.4), listing_count
--    (PRD-150 - NOT EXPORTED, no canonical counting basis, UX-037.f), cost, margin,
--    profit (PRD-123, GAP-112), primary_image_url (image data ownership is NOT canonical
--    - UX-037.g).
--
-- 🔴 No business data is seeded. No product, template, bundle, movement or grant.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- E-058 Sellable Product - the commercial offering an order line refers to (PRD-022).
--
-- The RESOLUTION TARGET is determined by nature (PRD-021) and is deliberately modelled
-- three different ways rather than one generic pointer, because the three are different
-- kinds of relationship and INV-58.2 requires the target to be CONSISTENT with the
-- nature. A single polymorphic column would let an inconsistent pair be stored.
-- -------------------------------------------------------------------------------------
CREATE TABLE sellable_product (
    id                     uuid         NOT NULL DEFAULT gen_random_uuid(),

    -- PRD-011 - a SEPARATE identifier space from the Inventory SKU. PRD-013's
    -- never-reissued discipline applies here too, so uniqueness survives archival.
    sellable_sku           varchar(64)  NOT NULL,

    -- PRD-017 - MARKET-FACING. Never the technical name (PRD-149 vs PRD-150).
    name                   varchar(255) NOT NULL,

    -- PRD-008 / INV-58.3 - exactly three natures, and nature is IMMUTABLE. The CHECK is
    -- the last line of defence; the immutability rule is enforced in the command service
    -- because a database cannot express "may be set once, never changed" as cleanly.
    nature                 varchar(16)  NOT NULL,

    description            text,

    -- PRD-016 - a SEPARATE tree from the inventory category.
    sellable_category      varchar(120),

    -- PRD-132 - E-070 Warranty Package is not implemented; this carries the declared
    -- reference so PRD-150's column round-trips. 🔴 It is NOT a foreign key, because the
    -- entity it would reference does not exist yet and inventing it is out of scope.
    warranty_package       varchar(120),

    -- SYS §7.1 master record lifecycle. PRD-062: archived, never deleted.
    record_status          varchar(16)  NOT NULL DEFAULT 'DRAFT',

    -- PRD-021 SIMPLE resolution: ONE Inventory Product, with a quantity per sale unit.
    -- 🔴 This is a REFERENCE, never a copy. The Stock Item is not duplicated.
    simple_target_variant_id       uuid           REFERENCES product_variant (id),
    simple_quantity_per_sale_unit  numeric(19, 4),

    -- PRD-156 ASSEMBLED finished-unit identity: ONE Product Variant for ready-built
    -- units. 🔴 This creates NO stock, movement, WAC, warehouse balance or quantity.
    assembled_finished_variant_id uuid REFERENCES product_variant (id),

    -- 🔴 BUNDLE has NO column here - its target is the bundle_member list.

    created_at             timestamptz  NOT NULL DEFAULT now(),
    created_by             uuid         NOT NULL REFERENCES operational_user_profile (id),
    updated_at             timestamptz  NOT NULL DEFAULT now(),
    updated_by             uuid         NOT NULL REFERENCES operational_user_profile (id),
    version                bigint       NOT NULL DEFAULT 0,

    CONSTRAINT sellable_product_pkey PRIMARY KEY (id),
    CONSTRAINT sellable_product_sku_unique UNIQUE (sellable_sku),
    CONSTRAINT sellable_product_nature_check
        CHECK (nature IN ('SIMPLE', 'ASSEMBLED', 'BUNDLE')),
    CONSTRAINT sellable_product_status_check
        CHECK (record_status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT sellable_product_sku_not_blank CHECK (length(trim(sellable_sku)) > 0),
    CONSTRAINT sellable_product_name_not_blank CHECK (length(trim(name)) > 0),

    -- INV-58.2 / PRD-158 - relationship columns are nature-specific and exclusive.
    CONSTRAINT sellable_product_resolution_target_check CHECK (
        (nature =  'SIMPLE' AND simple_target_variant_id IS NOT NULL
                            AND simple_quantity_per_sale_unit IS NOT NULL
                            AND assembled_finished_variant_id IS NULL)
     OR (nature =  'ASSEMBLED' AND simple_target_variant_id IS NULL
                               AND simple_quantity_per_sale_unit IS NULL
                               AND assembled_finished_variant_id IS NOT NULL)
     OR (nature =  'BUNDLE' AND simple_target_variant_id IS NULL
                            AND simple_quantity_per_sale_unit IS NULL
                            AND assembled_finished_variant_id IS NULL)
    ),
    CONSTRAINT sellable_product_simple_quantity_positive
        CHECK (simple_quantity_per_sale_unit IS NULL OR simple_quantity_per_sale_unit > 0)
);

COMMENT ON TABLE sellable_product IS
    'E-058 Sellable Product (PRD §9). Product-owned. 🔴 Holds NO stock (INV-58.1) and NO '
    'availability (INV-58.4) - availability derives from the resolution target per PRD-023/PRD-159. '
    '🔴 Carries no channel price: that belongs to E-059 (PRD-029).';

CREATE INDEX sellable_product_nature_idx   ON sellable_product (nature);
CREATE INDEX sellable_product_status_idx   ON sellable_product (record_status);
CREATE INDEX sellable_product_category_idx ON sellable_product (sellable_category);
CREATE INDEX sellable_product_simple_target_idx ON sellable_product (simple_target_variant_id);
CREATE INDEX sellable_product_assembled_finished_idx ON sellable_product (assembled_finished_variant_id);


-- -------------------------------------------------------------------------------------
-- E-060 Build Template - the VERSIONED definition of what goes into an ASSEMBLED
-- Sellable Product (PRD §11.2).
--
-- Lifecycle DRAFT → ACTIVE → SUPERSEDED → WITHDRAWN.
--
-- 🔴 INV-60.3 / PRD-069 - changing a template CREATES A NEW VERSION; it never edits the
--    active one, because editing in place would rewrite what past units were built from.
-- 🔴 INV-60.4 / PRD-068 - superseded versions are retained PERMANENTLY. There is no
--    delete path and DB-003 forbids the past moving.
-- -------------------------------------------------------------------------------------
CREATE TABLE build_template (
    id                  uuid         NOT NULL DEFAULT gen_random_uuid(),
    sellable_product_id uuid         NOT NULL REFERENCES sellable_product (id),

    -- PRD §11.2 - version and effective period.
    version_number      integer      NOT NULL,
    effective_from      timestamptz,
    effective_to        timestamptz,

    template_status     varchar(16)  NOT NULL DEFAULT 'DRAFT',

    -- PRD §11.2 - assembly instructions reference and estimated effort. Free text: no
    -- canonical structure is defined for either, so none is invented.
    assembly_notes      text,

    created_at          timestamptz  NOT NULL DEFAULT now(),
    created_by          uuid         NOT NULL REFERENCES operational_user_profile (id),

    -- PRD-092 - version ACTIVATION is audited. 🔴 First-class attribution captured when
    -- the authoritative act occurs, never reconstructed from logs (AGV-001, AUD-004).
    activated_at        timestamptz,
    activated_by        uuid         REFERENCES operational_user_profile (id),

    updated_at          timestamptz  NOT NULL DEFAULT now(),
    updated_by          uuid         NOT NULL REFERENCES operational_user_profile (id),
    version             bigint       NOT NULL DEFAULT 0,

    CONSTRAINT build_template_pkey PRIMARY KEY (id),
    CONSTRAINT build_template_version_unique UNIQUE (sellable_product_id, version_number),
    CONSTRAINT build_template_status_check
        CHECK (template_status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'WITHDRAWN')),
    CONSTRAINT build_template_version_positive CHECK (version_number > 0),

    -- An activated version always carries both its effective start and its attribution.
    CONSTRAINT build_template_activation_attributed CHECK (
        (template_status = 'DRAFT' AND activated_at IS NULL AND activated_by IS NULL
                                   AND effective_from IS NULL)
     OR (template_status <> 'DRAFT' AND activated_at IS NOT NULL AND activated_by IS NOT NULL
                                    AND effective_from IS NOT NULL)
    )
);

COMMENT ON TABLE build_template IS
    'E-060 Build Template (PRD §11.2). Product-owned, VERSIONED. 🔴 PRD-069: a change is a '
    'new version, never an edit of the ACTIVE one. 🔴 PRD-068: superseded versions are kept '
    'permanently because As-Built Records reference them.';

-- INV-60.1 / PRD-067 - exactly ONE version is ACTIVE per Sellable Product. Enforced in
-- the database as a partial unique index so no application path can produce two.
CREATE UNIQUE INDEX build_template_one_active_idx
    ON build_template (sellable_product_id)
    WHERE template_status = 'ACTIVE';


-- -------------------------------------------------------------------------------------
-- E-061 BOM Line - one component requirement within a template version (PRD §11.3).
--
-- 🔴 INV-61.1 / PRD-032 - references a PRODUCT VARIANT, never a Sellable Product. A build
--    consumes physical things. The foreign key makes the wrong reference impossible.
-- 🔴 PRD-034 - SINGLE LEVEL. A line never resolves to another template, and there is no
--    column here that could express one.
-- -------------------------------------------------------------------------------------
CREATE TABLE bom_line (
    id                 uuid           NOT NULL DEFAULT gen_random_uuid(),
    build_template_id  uuid           NOT NULL REFERENCES build_template (id),

    -- INV-61.1 - a physical component (E-020), enforced by the reference itself.
    product_variant_id uuid           NOT NULL REFERENCES product_variant (id),

    -- INV-61.2 - positive, in the component's unit of measure (DB-040).
    quantity_required  numeric(19, 4) NOT NULL,

    -- PRD §11.3 - Processor, Motherboard, RAM, SSD, HDD, PSU, Case, Cooler, GPU. Stored
    -- as text rather than an enum: canon lists these as EXAMPLES of component role, and
    -- closing the set would be an invention.
    component_role     varchar(64),

    -- PRD-033 - optionality is a property of the LINE, not a separate template. An
    -- optional line does not constrain buildability.
    optional           boolean        NOT NULL DEFAULT false,

    -- E-064 Substitution Group is ADVISORY (DM v2.5.0) and is not implemented; the
    -- declared group name is carried so a template can record it without the entity.
    substitution_group varchar(120),

    position           integer        NOT NULL DEFAULT 0,

    CONSTRAINT bom_line_pkey PRIMARY KEY (id),
    CONSTRAINT bom_line_quantity_positive CHECK (quantity_required > 0),
    CONSTRAINT bom_line_component_once UNIQUE (build_template_id, product_variant_id)
);

COMMENT ON TABLE bom_line IS
    'E-061 BOM Line (PRD §11.3). 🔴 INV-61.1: references a Product Variant, NEVER a Sellable '
    'Product. 🔴 PRD-034: single-level - a line never resolves to another template.';

CREATE INDEX bom_line_template_idx ON bom_line (build_template_id);
CREATE INDEX bom_line_variant_idx  ON bom_line (product_variant_id);


-- -------------------------------------------------------------------------------------
-- E-063 Bundle Member - one member of a BUNDLE Sellable Product (PRD §12).
--
-- 🔴 INV-63.1 / PRD-047 - a member IS a Sellable Product, which may be SIMPLE or
--    ASSEMBLED. 🔴 INV-63.2 / PRD-048 - no member is itself a bundle; nesting is ONE
--    level. That is enforced in the command service, because a self-referencing CHECK
--    cannot read the referenced row's nature.
-- -------------------------------------------------------------------------------------
CREATE TABLE bundle_member (
    id                        uuid           NOT NULL DEFAULT gen_random_uuid(),
    bundle_id                 uuid           NOT NULL REFERENCES sellable_product (id),
    member_sellable_id        uuid           NOT NULL REFERENCES sellable_product (id),

    quantity                  numeric(19, 4) NOT NULL,
    optional                  boolean        NOT NULL DEFAULT false,

    -- PRD-053 - partial-return value derives from a DECLARED allocation basis, never the
    -- member's standalone price. The basis is recorded here; 🔴 no refund calculation,
    -- return policy or price is implemented, and PRD-051's policy remains untouched.
    price_allocation_basis    varchar(120),

    position                  integer        NOT NULL DEFAULT 0,

    CONSTRAINT bundle_member_pkey PRIMARY KEY (id),
    CONSTRAINT bundle_member_quantity_positive CHECK (quantity > 0),
    CONSTRAINT bundle_member_not_self CHECK (bundle_id <> member_sellable_id),
    CONSTRAINT bundle_member_once UNIQUE (bundle_id, member_sellable_id)
);

COMMENT ON TABLE bundle_member IS
    'E-063 Bundle Member (PRD §12). 🔴 PRD-048: one level of nesting - a bundle may not '
    'contain a bundle. 🔴 A bundle definition creates NO physical inventory and NO movement.';

CREATE INDEX bundle_member_bundle_idx ON bundle_member (bundle_id);
CREATE INDEX bundle_member_member_idx ON bundle_member (member_sellable_id);


-- -------------------------------------------------------------------------------------
-- Permission catalogue entries for the three P2 capabilities.
--
-- PRM-089 naming convention; named by the OWNING module at PRD-155.
--
-- 🔴 DEFINITIONS ONLY - NO GRANT IS CREATED. No role and no user receives these.
--    PRM-003: absence of a grant is a denial, so the system stays closed. This creates no
--    superuser and touches GAP-120 / GAP-121 / GAP-122 not at all.
-- -------------------------------------------------------------------------------------
INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'product.sellable-product.view',
     'View, search, filter, list, read detail and export authorised Sellable Product facts, '
     'including resolution target, Build Template versions and bundle members (PRD-155).'),
    (gen_random_uuid(), 'product.sellable-product.manage',
     'Create a Sellable Product and update it where the Product lifecycle permits; author a '
     'DRAFT Build Template version, its BOM lines, and bundle membership (PRD-155).'),
    (gen_random_uuid(), 'product.build-template.activate',
     'Activate a Build Template version - DRAFT to ACTIVE, superseding the previous one. The '
     'approval-bearing authority of PRD §24; audited per PRD-092 (PRD-155).');
