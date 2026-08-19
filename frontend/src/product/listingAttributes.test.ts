import { describe, expect, it } from 'vitest';
import {
  attributeDisplayLabel,
  attributeKeyOf,
  hasDisplayName,
  orderAttributes,
} from './listingAttributes';

/**
 * CHANNEL ATTRIBUTES, NAMED AND ORDERED FOR THE OPERATOR — DISPLAY ONLY.
 *
 * <p>🔴 THE STORED KEY NEVER CHANGES. Daraz's `short_description` stays `short_description` in
 * the database; only what the operator READS is the seller's own name for it.
 *
 * <p>🔴 NO TRIOLOO CONCEPT IS CLAIMED. `short_description` is NOT mapped to `PRD-198`
 * Highlights — highlights are an ordered authored list with no reported side in the schema, so
 * a real mapping needs a canonical rule and a migration, not a label.
 */
describe('attributeDisplayLabel', () => {
  it('names the four content attributes the way the seller reads them', () => {
    expect(attributeDisplayLabel('attribute:description')).toBe('Main Description');
    expect(attributeDisplayLabel('attribute:description_en')).toBe('Product Description');
    expect(attributeDisplayLabel('attribute:short_description')).toBe('Highlight Bn');
    expect(attributeDisplayLabel('attribute:short_description_en')).toBe('Highlight En');
  });

  it('works with or without the row prefix', () => {
    expect(attributeDisplayLabel('short_description_en')).toBe('Highlight En');
    expect(attributeKeyOf('attribute:brand')).toBe('brand');
    expect(attributeKeyOf('brand')).toBe('brand');
  });

  /** ⚠ An attribute the seller has not named keeps the marketplace's own name. */
  it('leaves an unnamed marketplace attribute alone', () => {
    expect(attributeDisplayLabel('attribute:warranty_type', 'warranty_type')).toBe('warranty_type');
    expect(hasDisplayName('attribute:warranty_type')).toBe(false);
    expect(hasDisplayName('attribute:description')).toBe(true);
  });

  /**
   * 🔴 THE REGRESSION THIS GUARDS. A first-class fact already carries a proper server label,
   * and renaming by key alone would have shown the operator `sale_price` instead of
   * "Sale Price".
   */
  it('never overrides the label of a first-class fact', () => {
    expect(attributeDisplayLabel('sale_price', 'Sale Price')).toBe('Sale Price');
    expect(attributeDisplayLabel('title', 'Title')).toBe('Title');
    expect(attributeDisplayLabel('listing_stock', 'Listing stock')).toBe('Listing stock');
  });
});

describe('orderAttributes', () => {
  const row = (fieldKey: string) => ({ fieldKey });

  it('puts the content attributes first, in the order the seller reads them', () => {
    const ordered = orderAttributes([
      row('attribute:brand'),
      row('attribute:short_description_en'),
      row('attribute:description'),
      row('attribute:warranty'),
      row('attribute:short_description'),
      row('attribute:description_en'),
    ]);
    expect(ordered.map((r) => r.fieldKey)).toEqual([
      'attribute:description',
      'attribute:description_en',
      'attribute:short_description',
      'attribute:short_description_en',
      'attribute:brand',
      'attribute:warranty',
    ]);
  });

  /** ✅ STABLE — unnamed attributes keep the order the server sent them in. */
  it('keeps unnamed attributes in their incoming order', () => {
    const ordered = orderAttributes([
      row('attribute:zeta'), row('attribute:alpha'), row('attribute:mid'),
    ]);
    expect(ordered.map((r) => r.fieldKey)).toEqual([
      'attribute:zeta', 'attribute:alpha', 'attribute:mid',
    ]);
  });

  it('does not lose or duplicate a row', () => {
    const input = [row('attribute:a'), row('attribute:description'), row('attribute:b')];
    expect(orderAttributes(input)).toHaveLength(3);
  });

  it('handles an empty set', () => {
    expect(orderAttributes([])).toEqual([]);
  });
});
