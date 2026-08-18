/**
 * PROVIDER TEXT, MADE READABLE — FOR DISPLAY ONLY.
 *
 * <p>🔴 A MARKETPLACE WRITES ITS OWN MARKUP AND TRIOLOO MIRRORS IT AS RECEIVED. Daraz returns
 * descriptions and attributes as HTML fragments — `<ul><li>Processor : Intel&reg; Core&trade;
 * i5-7500</li></ul>`, sometimes with inline `style="…"`. Rendered as-is it reads as tag soup,
 * and a single attribute can make a comparison row taller than the screen.
 *
 * <p>🔴 THIS CHANGES NOTHING THAT IS STORED. `PRD-181` keeps the reported side a MIRRORED
 * EXTERNAL FACT, and `DZC-031.h` already fixed how it is persisted. This module is the last
 * step before pixels and nothing else: the database keeps the provider's bytes exactly as they
 * arrived, and every rule that compares intent against reported still compares the raw values.
 *
 * <p>🔴 IT NEVER EXECUTES PROVIDER MARKUP. There is no `dangerouslySetInnerHTML` anywhere in
 * this codebase and this module does not introduce one: it is a pure string-to-string
 * transform whose output is rendered as TEXT. ⚠ That is a security property, not a style
 * preference — a marketplace description is untrusted input written by a third party.
 */

/**
 * The entities a marketplace actually emits in product copy.
 *
 * <p>⚠ DELIBERATELY A SMALL, EXPLICIT SET. A general entity decoder would happily turn
 * `&lt;script&gt;` back into a live-looking tag; these are the ones that make real copy
 * readable and nothing more. `&lt;`/`&gt;`/`&amp;` are included because the provider escapes
 * ordinary punctuation with them, and the result is still rendered as text.
 */
const ENTITIES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&reg;': '®',
  '&trade;': '™',
  '&copy;': '©',
  '&deg;': '°',
  '&times;': '×',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&bull;': '•',
  '&middot;': '·',
};

/** Tags that end a line of readable copy rather than sitting inside one. */
const BLOCK_END = /<\/(p|div|li|ul|ol|tr|h[1-6]|table|section|article)\s*>/gi;

/** Tags that break a line where they appear. */
const LINE_BREAK = /<br\s*\/?>/gi;

/** A list item opens a bullet. */
const LIST_ITEM = /<li[^>]*>/gi;

/** Any remaining well-formed tag. ⚠ Requires a letter after `<`, so `A < B` survives intact. */
const ANY_TAG = /<\/?[a-zA-Z][^>]*>/g;

/**
 * Turns one provider value into readable plain text.
 *
 * <p>✅ Returns the input unchanged when there is no markup in it — the overwhelmingly common
 * case, and the one where doing nothing is exactly right.
 *
 * <p>🔴 THE RESULT IS FOR READING, NOT FOR COMPARING. Never write it back, never send it, and
 * never use it to decide whether two values differ: `PRD-181` compares what was stored.
 */
export function readableProviderText(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  /* ✅ Nothing that looks like markup or an entity — leave the operator's own words alone. */
  if (!/[<&]/.test(value)) {
    return value;
  }

  let text = value;

  /*
    ⚠ INLINE STYLE AND SCRIPT-ISH ATTRIBUTES GO FIRST, while the tag is still intact and the
    boundaries are unambiguous. Their CONTENT is never displayed.
  */
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  text = text.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  text = text.replace(LINE_BREAK, '\n');
  text = text.replace(BLOCK_END, '\n');
  text = text.replace(LIST_ITEM, '\n• ');
  text = text.replace(ANY_TAG, '');

  /* Entities last: decoding earlier could manufacture a tag out of `&lt;div&gt;`. */
  for (const [entity, character] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(character);
  }
  /* ⚠ Numeric entities are decoded only in the printable-ASCII range, for the same reason. */
  text = text.replace(/&#(\d{2,4});/g, (whole, code: string) => {
    const point = Number(code);
    return point >= 32 && point <= 126 ? String.fromCharCode(point) : whole;
  });

  /* Tidy the shape: no runaway blank lines, no trailing spaces, no empty bullets. */
  return text
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(?:\s*•\s*)?\n?/, (m) => (m.includes('•') ? '' : m))
    .trim();
}

/**
 * Whether a value is long enough that it must be CONTAINED rather than allowed to set the
 * height of whatever row it sits in.
 *
 * <p>⚠ The threshold is a LAYOUT judgement, not a business one. A marketplace description runs
 * to hundreds of characters and would otherwise make one comparison row taller than the rest
 * of the page put together.
 */
export function isLongProviderText(value: string | null): boolean {
  return value !== null && (value.length > 160 || value.includes('\n'));
}
