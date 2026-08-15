/**
 * DISPLAY-ONLY money formatting.
 *
 * 🔴 `TEC-015` / `PRJ-045` — money crosses the API as an exact decimal STRING and stays a
 * string here. Nothing in this module parses it into a JavaScript `Number`: the IEEE-754
 * double cannot represent decimal money exactly, and a value that has been through one is no
 * longer the authoritative amount. Every operation below is string manipulation.
 *
 * 🔴 This module NEVER performs arithmetic, comparison, rounding or aggregation. It changes
 * how an amount is READ, never what it IS. Formatting precision is not calculation precision.
 *
 * ⚠ Persistence, API values and backend monetary semantics are untouched by anything here.
 */

/** The presentation symbol. ⚠ A glyph for display; it is not a currency data model. */
const TAKA = '৳';

/**
 * Groups an integer digit string in thousands.
 *
 * <p>Pure string work — the digits are never interpreted as a number.
 */
function groupThousands(digits: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      out += ',';
    }
    out += digits[i];
  }
  return out;
}

/**
 * Formats an authoritative decimal string for display, e.g. {@code "11200.00"} → {@code "৳ 11,200"}.
 *
 * <p>A fractional part that is entirely zeros is dropped, because Frame 01 presents whole
 * amounts without one. 🔴 A NON-zero fraction is always kept — silently dropping paise would
 * show the operator an amount that is not the one on record.
 *
 * <p>Returns {@code null} for a null/blank input so callers can render an explicit absence
 * rather than a misleading {@code ৳ 0}.
 */
export function formatMoneyForDisplay(amount: string | null | undefined): string | null {
  if (amount === null || amount === undefined) {
    return null;
  }
  const raw = amount.trim();
  if (raw === '') {
    return null;
  }

  // ⚠ Anything that is not a plain decimal is passed through untouched rather than being
  // reshaped into something that looks authoritative but is not.
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    return raw;
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = '0', fraction] = unsigned.split('.');

  const grouped = groupThousands(whole);
  const keepFraction = fraction !== undefined && /[1-9]/.test(fraction);
  const body = keepFraction ? `${grouped}.${fraction}` : grouped;

  return `${negative ? '-' : ''}${TAKA} ${body}`;
}

/**
 * Whether a Promotion Price represents a real reduction against the Sale Price.
 *
 * 🔴 `PRD-199.b` — the discount is the OUTCOME of the base price and the promotion price, and
 * is never a stored third value (`DB-001`). This answers only "is the promotion actually a
 * reduction", which is all the workspace needs; it deliberately computes no amount and no
 * percentage, because neither is displayed in Frame 01.
 *
 * ⚠ It says nothing about WHETHER the promotion is in force. That is the window's business,
 * and the server decides it from the clock (`PRD-199.d`).
 *
 * 🔴 String comparison only — the amounts are compared digit by digit after aligning their
 * decimal places, so no IEEE-754 double is involved.
 */
export function hasDiscount(
  salePrice: string | null | undefined,
  promotionPrice: string | null | undefined,
): boolean {
  if (!salePrice || !promotionPrice) {
    return false;
  }
  const a = salePrice.trim();
  const b = promotionPrice.trim();
  if (!/^-?\d+(\.\d+)?$/.test(a) || !/^-?\d+(\.\d+)?$/.test(b)) {
    return false;
  }
  return compareDecimalStrings(a, b) > 0;
}

/** Compares two plain decimal strings. Returns >0, 0 or <0. No number parsing. */
export function compareDecimalStrings(a: string, b: string): number {
  const negA = a.startsWith('-');
  const negB = b.startsWith('-');
  if (negA !== negB) {
    return negA ? -1 : 1;
  }
  const [aw = '0', af = ''] = (negA ? a.slice(1) : a).split('.');
  const [bw = '0', bf = ''] = (negB ? b.slice(1) : b).split('.');

  const width = Math.max(aw.length, bw.length);
  const wholeCmp = aw.padStart(width, '0').localeCompare(bw.padStart(width, '0'));
  if (wholeCmp !== 0) {
    return negA ? -wholeCmp : wholeCmp;
  }
  const scale = Math.max(af.length, bf.length);
  const fracCmp = af.padEnd(scale, '0').localeCompare(bf.padEnd(scale, '0'));
  return negA ? -fracCmp : fracCmp;
}
