/**
 * HOW A CHANNEL ATTRIBUTE IS NAMED AND ORDERED FOR THE OPERATOR — DISPLAY ONLY.
 *
 * <p>🔴 A MARKETPLACE NAMES ITS FIELDS FOR ITSELF, NOT FOR THE SELLER. Daraz returns
 * `description`, `description_en`, `short_description` and `short_description_en`, and an
 * operator reading those four side by side cannot tell which is the main copy, which is the
 * English one, or which are the bullet highlights. The seller knows; the field name does not
 * say.
 *
 * <p>🔴 THIS RENAMES A LABEL. IT DOES NOT MAP A FIELD. The stored `attribute_key` is exactly
 * what Daraz sent and is never rewritten, no value moves anywhere, and no Trioloo concept is
 * claimed. ⚠ In particular `short_description` is NOT mapped to Trioloo's Highlights
 * (`PRD-198`): highlights are an ordered authored list with NO reported side in the schema at
 * all, so a real mapping would need a canonical rule and a migration, not a label.
 *
 * <p>⚠ THE RAW KEY STAYS VISIBLE beside the friendly name, so an operator can always tell
 * which marketplace field they are looking at.
 */

/**
 * Operator-facing names for the Daraz content attributes, supplied by the seller.
 *
 * <p>⚠ ONLY KEYS WHOSE MEANING THE SELLER HAS STATED APPEAR HERE. An unlisted attribute keeps
 * the marketplace's own name rather than being given an invented one.
 */
const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  description: 'Main Description',
  description_en: 'Product Description',
  short_description: 'Highlight Bn',
  short_description_en: 'Highlight En',
};

/**
 * The order the seller reads them in: the long copy first, then the two highlight sets.
 *
 * <p>⚠ Anything not named here keeps its existing relative order AFTER these, so adding a
 * marketplace attribute never silently reshuffles the ones above it.
 */
const DISPLAY_ORDER: readonly string[] = [
  'description',
  'description_en',
  'short_description',
  'short_description_en',
];

/** The bare attribute key, with the `attribute:` row prefix removed if present. */
export function attributeKeyOf(fieldKey: string): string {
  return fieldKey.startsWith('attribute:') ? fieldKey.slice('attribute:'.length) : fieldKey;
}

/**
 * The operator-facing name for a row.
 *
 * <p>🔴 ONLY ATTRIBUTE ROWS ARE RENAMED. A first-class fact — Title, Sale Price, Listing stock —
 * already carries a proper label from the server, and that label always wins. ⚠ Without the
 * fallback this would have replaced "Sale Price" with the raw key `sale_price`.
 */
export function attributeDisplayLabel(fieldKey: string, fallbackLabel?: string): string {
  return DISPLAY_NAMES[attributeKeyOf(fieldKey)] ?? fallbackLabel ?? fieldKey;
}

/** Whether this attribute carries a seller-supplied name — used to show the raw key beside it. */
export function hasDisplayName(fieldKeyOrLabel: string): boolean {
  return attributeKeyOf(fieldKeyOrLabel) in DISPLAY_NAMES;
}

/**
 * Attribute rows in the order the seller reads them.
 *
 * <p>✅ STABLE. Named attributes come first in the stated order; everything else keeps the
 * order the server sent, which is the listing's own attribute position.
 */
export function orderAttributes<T extends { readonly fieldKey: string }>(
  rows: readonly T[],
): readonly T[] {
  const rank = (row: T): number => {
    const index = DISPLAY_ORDER.indexOf(attributeKeyOf(row.fieldKey));
    return index === -1 ? DISPLAY_ORDER.length : index;
  };
  /* ⚠ A stable sort: equal ranks keep their incoming order. */
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
    .map(({ row }) => row);
}
