import { describe, expect, it } from 'vitest';
import { isLongProviderText, readableProviderText } from './providerText';

/**
 * PROVIDER TEXT MADE READABLE — DISPLAY ONLY.
 *
 * <p>🔴 THE DEFECT THIS EXISTS FOR was visible in production: a Daraz `short_description`
 * rendered as `<ul> <li>Processor : Intel&reg; Core&trade; i5-7500 7th Gen Processor</li> …`,
 * which turned the Intended-vs-Reported table into tag soup and made one row taller than the
 * rest of the page.
 *
 * <p>🔴 IT IS A PURE STRING TRANSFORM. Nothing here executes markup — the output is rendered
 * as TEXT, and a marketplace description is untrusted third-party input.
 */
describe('readableProviderText', () => {
  it('returns plain text untouched', () => {
    expect(readableProviderText('Intel Core i5 7500 Desktop PC')).toBe('Intel Core i5 7500 Desktop PC');
  });

  it('returns null for null', () => {
    expect(readableProviderText(null)).toBeNull();
  });

  /** 🔴 THE PRODUCTION VALUE, in the shape the first live pull actually returned. */
  it('renders a marketplace list as readable lines, not tags', () => {
    const raw = '<ul> <li>Processor : Intel&reg; Core&trade; i5-7500 7th Gen Processor</li> '
      + '<li>RAM : 8GB DDR4 Any Brands</li> <li>Graphics: Intel 2GB Built In&nbsp;</li> </ul>';
    const out = readableProviderText(raw) ?? '';

    expect(out).not.toMatch(/<[a-z]/i);
    expect(out).not.toContain('&reg;');
    expect(out).not.toContain('&nbsp;');
    expect(out).toContain('Processor : Intel® Core™ i5-7500 7th Gen Processor');
    expect(out).toContain('RAM : 8GB DDR4 Any Brands');
    expect(out).toContain('•');
  });

  it('decodes the entities a marketplace actually writes', () => {
    expect(readableProviderText('A&nbsp;B')).toBe('A B');
    expect(readableProviderText('Intel&reg;')).toBe('Intel®');
    expect(readableProviderText('Core&trade;')).toBe('Core™');
    expect(readableProviderText('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(readableProviderText('5&deg;C')).toBe('5°C');
    expect(readableProviderText('it&#39;s')).toBe("it's");
  });

  /** 🔴 Inline style is presentation the provider owns, and it is never shown to an operator. */
  it('removes inline style fragments', () => {
    const out = readableProviderText('<div style="font-size:14px; color:#f00">Warranty</div>') ?? '';
    expect(out).toBe('Warranty');
    expect(out).not.toContain('font-size');
    expect(out).not.toContain('#f00');
  });

  /** 🔴 A script or style block's CONTENT is never surfaced as copy. */
  it('drops script and style blocks entirely', () => {
    expect(readableProviderText('<script>alert(1)</script>Real copy')).toBe('Real copy');
    expect(readableProviderText('<style>.x{color:red}</style>Real copy')).toBe('Real copy');
  });

  /**
   * 🔴 NOTHING IS EXECUTED, AND NOTHING BECOMES EXECUTABLE. Entities are decoded AFTER tags are
   * stripped, so an escaped tag cannot be reassembled into a live-looking one.
   */
  it('never reassembles an escaped tag into markup', () => {
    const out = readableProviderText('&lt;script&gt;alert(1)&lt;/script&gt;') ?? '';
    /* The text is shown as text — it is not, and never becomes, a tag. */
    expect(out).toContain('script');
    expect(out).toContain('alert(1)');
  });

  /** ⚠ Ordinary punctuation survives: `A < B` is arithmetic, not a tag. */
  it('leaves a bare less-than alone', () => {
    expect(readableProviderText('Weight < 2 kg')).toBe('Weight < 2 kg');
  });

  it('turns breaks and paragraphs into line breaks', () => {
    expect(readableProviderText('One<br/>Two')).toBe('One\nTwo');
    expect(readableProviderText('<p>One</p><p>Two</p>')).toBe('One\nTwo');
  });

  /**
   * ⚠ A PARAGRAPH BREAK IS STRUCTURE AND IS KEPT; only RUNAWAY blank space is capped. Four
   * blank lines between two blocks become one blank line, not none — collapsing them entirely
   * would run separate paragraphs together.
   */
  it('caps runaway blank lines while keeping the paragraph break', () => {
    expect(readableProviderText('<div>A</div>\n\n\n\n<div>B</div>')).toBe('A\n\nB');
    expect(readableProviderText('<div>A</div><div>B</div>')).toBe('A\nB');
  });
});

describe('isLongProviderText', () => {
  it('treats a short value as short', () => {
    expect(isLongProviderText('8GB DDR4')).toBe(false);
  });

  it('treats a paragraph as long', () => {
    expect(isLongProviderText('x'.repeat(200))).toBe(true);
  });

  /** ⚠ A multi-line value sets row height even when it is not many characters. */
  it('treats a multi-line value as long', () => {
    expect(isLongProviderText('• A\n• B')).toBe(true);
  });

  it('treats null as short', () => {
    expect(isLongProviderText(null)).toBe(false);
  });
});
