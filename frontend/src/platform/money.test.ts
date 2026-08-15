import { describe, expect, it } from 'vitest';
import { formatMoneyForDisplay } from './money';

/**
 * 🔴 `TEC-015` — these pin DISPLAY behaviour on the authoritative decimal string. Nothing
 * here may go through a JavaScript number, so the tests include amounts a double cannot
 * represent exactly.
 */
describe('formatMoneyForDisplay', () => {
  it('renders the approved BDT display for whole amounts', () => {
    expect(formatMoneyForDisplay('11200.00')).toBe('৳ 11,200');
    expect(formatMoneyForDisplay('8450.00')).toBe('৳ 8,450');
    expect(formatMoneyForDisplay('640.00')).toBe('৳ 640');
    expect(formatMoneyForDisplay('46900.00')).toBe('৳ 46,900');
    expect(formatMoneyForDisplay('31000.00')).toBe('৳ 31,000');
  });

  it('groups in thousands without touching the digits', () => {
    expect(formatMoneyForDisplay('1000000.00')).toBe('৳ 1,000,000');
    expect(formatMoneyForDisplay('100.00')).toBe('৳ 100');
    expect(formatMoneyForDisplay('0.00')).toBe('৳ 0');
  });

  /** 🔴 Dropping a non-zero fraction would show an amount that is not the one on record. */
  it('keeps a non-zero fraction exactly as supplied', () => {
    expect(formatMoneyForDisplay('640.50')).toBe('৳ 640.50');
    expect(formatMoneyForDisplay('1234.05')).toBe('৳ 1,234.05');
  });

  /**
   * 🔴 The proof that no float is involved: 0.1 + 0.2 and long precision survive intact,
   * which they would not if the string had been parsed into a double.
   */
  it('preserves precision a double would destroy', () => {
    expect(formatMoneyForDisplay('9007199254740993.01')).toBe('৳ 9,007,199,254,740,993.01');
    expect(formatMoneyForDisplay('0.30000000000000004')).toBe('৳ 0.30000000000000004');
  });

  it('handles absence and negatives without inventing a value', () => {
    expect(formatMoneyForDisplay(null)).toBeNull();
    expect(formatMoneyForDisplay(undefined)).toBeNull();
    expect(formatMoneyForDisplay('   ')).toBeNull();
    expect(formatMoneyForDisplay('-2500.00')).toBe('-৳ 2,500');
  });

  /** ⚠ Anything that is not a plain decimal is passed through, never reshaped. */
  it('passes through a value it does not recognise', () => {
    expect(formatMoneyForDisplay('n/a')).toBe('n/a');
  });
});
