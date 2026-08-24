import { describe, expect, it } from 'vitest';
import { splitName, sumMinorUnits } from './NewOrderPage';

/**
 * The order total on the capture page.
 *
 * 🔴 THIS IS THE LAST PLACE A ROUNDING ARTEFACT COULD ENTER UNNOTICED. The figure becomes the
 * order's price, and then the invoice's subtotal, and then a `INV-39.2` snapshot that is meant to
 * reproduce exactly years later. `TEC-015` / `DB-079` — money is never a JavaScript number.
 */
describe('order total', () => {
  it('sums without floating-point error', () => {
    // 🔴 THE CASE THAT NAMES THE WHOLE RULE. `0.1 + 0.2` in JavaScript is
    // `0.30000000000000004`, and a total built with `reduce((s, n) => s + Number(n))` would put
    // an amount nobody typed onto a customer's invoice.
    expect(sumMinorUnits(['0.10', '0.20'])).toBe('0.30');
    expect(Number('0.1') + Number('0.2')).not.toBe(0.3);
  });

  it('keeps large amounts exact', () => {
    // ⚠ Trioloo sells televisions and desktops; these are ordinary line values, not extremes.
    expect(sumMinorUnits(['95000.00', '62000.00', '28500.50'])).toBe('185500.50');
  });

  it('treats an unfinished line as nothing rather than as zero-priced', () => {
    // ⚠ A half-typed row must not drag the total. An empty or partial input contributes nothing
    // until it is a number.
    expect(sumMinorUnits(['100.00', '', '  ', 'abc'])).toBe('100.00');
  });

  it('handles a whole number and a single decimal place', () => {
    expect(sumMinorUnits(['1200', '0.5'])).toBe('1200.50');
  });

  it('is zero when nothing has been entered', () => {
    // ⚠ A genuine 0.00, which is what an empty capture form legitimately totals.
    expect(sumMinorUnits([])).toBe('0.00');
  });
});

/**
 * One typed name into the two columns the order snapshot holds.
 *
 * ⚠ `channel_order` carries `customer_first_name` and `customer_last_name`; the prototype's
 * capture form asks for ONE name. The split happens here rather than by asking an operator to
 * parse their own customer, and `ManualOrderService.validate` refuses an order with neither.
 */
describe('customer name capture', () => {
  it('keeps a multi-part name intact rather than discarding the middle', () => {
    // ⚠ THE CASE THAT DECIDES THE RULE. A Bangladeshi name commonly has three parts, and a
    // last-token split would drop `Ahmed` from `Mohammad Rifat Ahmed` entirely.
    expect(splitName('Mohammad Rifat Ahmed')).toEqual({ first: 'Mohammad', last: 'Rifat Ahmed' });
  });

  it('puts a single name in the first column, where validation looks', () => {
    expect(splitName('Rifat')).toEqual({ first: 'Rifat', last: '' });
  });

  it('normalises stray spacing rather than creating an empty part', () => {
    expect(splitName('  Rifat   Hasan  ')).toEqual({ first: 'Rifat', last: 'Hasan' });
  });

  it('returns two empty parts for an empty field, so the server refuses rather than storing a blank name', () => {
    expect(splitName('   ')).toEqual({ first: '', last: '' });
  });
});
