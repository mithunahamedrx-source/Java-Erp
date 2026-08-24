-- =====================================================================================
-- V25 - The operator-readable payment method.
--
-- Scope:
--   ONE derived display column, filled by the adapter's translation. No change to the
--   provider's own value, no accounting effect, no payment state.
--
-- Canonical basis:
--   BR-005   Channel-specific logic exists ONLY in adapters. The translation belongs in
--            DarazPaymentMethod; this column is where its result is kept so no downstream
--            stage has to know a Daraz token.
--   BR-171   Externally-authoritative facts continue to sync and stay DISTINGUISHED from
--            Trioloo's own reading.
--   SYS-046  The raw received value is retained as evidence.
--
-- 🔴 `payment_method` IS NOT OVERWRITTEN, AND THAT IS THE WHOLE SHAPE OF THIS CHANGE.
--    The provider's word stays exactly as received and the readable name sits beside it -
--    the same pattern as statuses_json beside canonical_statuses_json.
--
-- ⚠ ONLY UNAMBIGUOUS BRANDS ARE TRANSLATED. EASTERN_BANK_MANUAL_IPP and
--    LANKABANGLA_FINANCE_MANUAL_IPP name a bank's INSTALMENT PRODUCT rather than a brand,
--    and what to call one is a business decision. They keep their raw value and are
--    reported rather than guessed (SYS-034).
-- =====================================================================================

ALTER TABLE channel_order
    ADD COLUMN payment_method_readable varchar(160);

COMMENT ON COLUMN channel_order.payment_method_readable IS
    'BR-005 - the adapter''s readable translation of payment_method. DERIVED: the provider''s '
    'own value in payment_method is authoritative and is never overwritten (BR-171, SYS-046).';

-- Backfill. The same four mappings DarazPaymentMethod holds, and no others: a value the
-- adapter refuses to translate must stay NULL here too, or the two would disagree.
UPDATE channel_order SET payment_method_readable = CASE upper(trim(payment_method))
    WHEN 'GNBKASH_TOKEN_EBANK' THEN 'bKash'
    WHEN 'MIXEDCARD'           THEN 'Card'
    WHEN 'WALLET_NAGADBD'      THEN 'Nagad'
    WHEN 'COD'                 THEN 'Cash on Delivery'
    ELSE NULL
  END
 WHERE payment_method IS NOT NULL AND trim(payment_method) <> '';
