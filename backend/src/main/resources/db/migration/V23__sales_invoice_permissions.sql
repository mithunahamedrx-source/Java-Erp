-- =====================================================================================
-- V23 - The Sales Invoice capability codes (PRM-094).
--
-- 🔴 SEEDING IS NOT GRANTING. PRM-003 denies what was never granted and PRM-081.b forbids
--    a deployment handing out authority. Both land with ZERO holders.
-- =====================================================================================

INSERT INTO permission (id, code, description) VALUES
    (gen_random_uuid(), 'accounting.sales-invoice.view',
     'Read an issued Sales Invoice and its INV-39.2 snapshot, including rendering it for '
     'print. Grants no issuing, no cancellation and no accounting posting (PRM-094).'),

    -- ⚠ Issuing is a WRITE and viewing is not. An invoice carries commercial and legal
    -- weight: the person who prints one for a customer is not necessarily the person
    -- authorised to create one (PRM-094.a).
    (gen_random_uuid(), 'accounting.sales-invoice.issue',
     'Issue the Sales Invoice for an order, taking the INV-39.2 snapshot. Grants no '
     'viewing, no re-issue, no cancellation - INV-39.1 keeps one sequence, never reused, '
     'and a cancelled number is retired rather than recycled (DB-012) - and no payment, '
     'receipt or settlement act (PRM-094).');
