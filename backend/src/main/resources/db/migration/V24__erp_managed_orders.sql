-- =====================================================================================
-- V24 - Admit ERP_MANAGED orders.
--
-- 🔴 V16's constraint allowed `API_MANAGED` ALONE, and it was RIGHT when it was written:
--    the only orders that existed were marketplace mirrors, and a narrow constraint is
--    how a schema refuses to hold a state nothing could legitimately produce.
--
-- ✅ BR-168 - an Order is API_MANAGED or ERP_MANAGED, and DIRECT-CHANNEL ORDERS ARE
--    ERP_MANAGED FROM CREATION. PRM-093 now ratifies manual order capture, so the second
--    value has a legitimate producer for the first time.
--
-- 🔴 THE APPLIED MIGRATION IS NOT EDITED (PRJ-081). Editing V16 would change its checksum
--    and Flyway would refuse to start - correctly. The constraint is REPLACED here, and
--    V16 remains the accurate record of what was true when it was written.
--
-- ⚠ NO THIRD VALUE IS ADMITTED. BR-168 names exactly two authority states, and PRM-089.b's
--    principle applies to schema as much as to permissions: a constraint does not acquire
--    room for a value because one might exist later.
-- =====================================================================================

ALTER TABLE channel_order DROP CONSTRAINT channel_order_ownership_check;

ALTER TABLE channel_order ADD CONSTRAINT channel_order_ownership_check
    CHECK (ownership IN ('API_MANAGED', 'ERP_MANAGED'));

COMMENT ON COLUMN channel_order.ownership IS
    'BR-168 - API_MANAGED (the marketplace still updates this order) or ERP_MANAGED '
    '(Trioloo controls it; marketplace updates will not overwrite it). A direct-channel '
    'order is ERP_MANAGED from creation and no takeover occurs (BR-169).';
