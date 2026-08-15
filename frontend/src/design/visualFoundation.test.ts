import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * THE GLOBAL VISUAL FOUNDATION — asserted against the SHARED SOURCES, not a rendered page.
 *
 * <p>🔴 These read `tokens.css` and `index.css` directly and on purpose. The four rules under
 * test are GLOBAL: they hold because one token and one stylesheet say so, and the failure
 * mode they guard against is a module quietly reintroducing an ink outline of its own. A
 * component test would prove one screen; this proves the source every screen inherits.
 */

// ⚠ Resolved from the project root: vitest runs there, and `import.meta.url` is not a file
//   URL after transform.
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
const tokens = read('src/design/tokens.css');
const base = read('src/index.css');

/**
 * ⚠ Comments stripped. The prose in these files DISCUSSES `outline: none` in order to forbid
 * it, and a raw text search cannot tell an explanation from a declaration.
 */
const declarations = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declared value of one custom property, ignoring comments. */
function token(name: string): string {
  const match = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(tokens);
  if (!match) throw new Error(`token ${name} is not declared`);
  return match[1]!.trim();
}

/** OKLCH lightness, the only component these rules actually reason about. */
function lightness(value: string): number {
  const match = /oklch\(\s*([0-9.]+)/.exec(value);
  if (!match) throw new Error(`not an oklch value: ${value}`);
  return Number(match[1]);
}

describe('workspace ground', () => {
  /**
   * 🔴 `RULE 3.4.a` — the page is a step DEEPER than white, so a white surface separates by
   * ground contrast. Before this, both were within 0.015 lightness and cards floated.
   */
  it('is deeper than the white content surface', () => {
    const app = lightness(token('--color-app-background'));
    expect(app).toBeLessThan(0.98);
    // ⚠ And not so deep that the ERP reads as dark grey — this is a light enterprise UI.
    expect(app).toBeGreaterThan(0.94);
  });

  it('keeps the ordinary content surface pure white', () => {
    expect(token('--color-surface')).toBe('#ffffff');
  });
});

describe('focus indication', () => {
  /**
   * 🔴 `RULE 6.0.c` — THE GLOBAL RING IS NEUTRAL GREY, NOT INK. A near-black ring is what made
   * a clicked text field look framed in black, because browsers match `:focus-visible` on text
   * inputs for mouse focus too.
   */
  it('uses the neutral focus-ring token, never ink', () => {
    const rule = /:focus-visible\s*\{[^}]*\}/.exec(declarations(base))?.[0] ?? '';
    expect(rule).toContain('var(--color-focus-ring)');
    expect(rule).not.toContain('var(--color-ink)');
  });

  it('declares a focus ring that is grey rather than black', () => {
    const ring = token('--color-focus-ring');
    const l = lightness(ring);
    // Mid grey: clearly not ink (0.2), clearly not invisible.
    expect(l).toBeGreaterThan(0.5);
    expect(l).toBeLessThan(0.75);
    // 🔴 Neutral: no chroma, so it can never read as brand, blue or destructive.
    expect(ring).toMatch(/oklch\(\s*[0-9.]+\s+0\s+0\s*\)/);
  });

  /**
   * 🔴 `RULE 6.0.c.d` — REMOVING focus indication remains prohibited. Quieting it is the whole
   * change; suppressing it would be a WCAG 2.2 failure, not a refinement.
   */
  it('never suppresses focus anywhere in the global base', () => {
    expect(declarations(base)).not.toMatch(/outline:\s*none/);
    expect(declarations(base)).not.toMatch(/outline:\s*0\b/);
  });

  it('still keeps a separator for controls whose own fill is ink', () => {
    expect(base).toMatch(/button:focus-visible\s*\{[^}]*var\(--color-surface\)/);
  });
});

describe('elevation policy', () => {
  /**
   * 🔴 `RULE 3.6` — exactly three elevations, and the ordinary card contact shadow stays
   * imperceptible. Surface separation comes from the ground, never from stacking shadows.
   */
  it('keeps the ordinary card elevation effectively imperceptible', () => {
    const card = token('--elevation-card');
    const alpha = Number(/\/\s*([0-9.]+)\s*\)/.exec(card)?.[1]);
    expect(alpha).toBeLessThanOrEqual(0.05);
  });

  /** ⚠ The overlay elevation is for detached surfaces and stays clearly stronger. */
  it('keeps a distinct, stronger elevation for detached overlays', () => {
    const overlay = token('--elevation-overlay');
    expect(overlay).toContain('24px');
    expect(Number(/\/\s*([0-9.]+)\s*\)/.exec(overlay)?.[1])).toBeGreaterThan(0.05);
  });

  it('declares no fourth elevation', () => {
    const declared = tokens.match(/^\s*--elevation-[a-z-]+:/gm) ?? [];
    expect(declared.length).toBe(3);
  });
});

describe('no module reintroduces an ink focus frame', () => {
  /**
   * 🔴 THE REGRESSION THIS EXISTS TO CATCH. A page adding its own `:focus { border: ink }`
   * would win by specificity and quietly undo the global rule for one module only.
   */
  it('declares focus styling in exactly one place', () => {
    const focusRules = declarations(base).match(/:focus[a-z-]*\s*\{/g) ?? [];
    expect(focusRules.length).toBe(2); // :focus-visible and button:focus-visible
  });
});

// =====================================================================================
// GLOBAL SHELL POLISH — motion scale, compact geometry, one route boundary
// =====================================================================================

describe('the shared motion scale', () => {
  /**
   * 🔴 `RULE 3.21.f` — THREE DURATIONS AND TWO EASINGS, AND NO MORE. The failure mode this
   * guards is 127ms in one component and 183ms in another: a system that no longer feels
   * like one product.
   */
  it('declares exactly three durations and two easings', () => {
    expect(token('--motion-fast')).toBe('120ms');
    expect(token('--motion-standard')).toBe('150ms');
    expect(token('--motion-page')).toBe('160ms');
    expect(token('--ease-standard')).toContain('cubic-bezier');
    expect(token('--ease-out')).toContain('cubic-bezier');
    expect((tokens.match(/^\s*--motion-[a-z-]+:/gm) ?? []).length).toBe(3);
  });

  /** ⚠ Every animation consumes a token. None hard-codes its own millisecond value. */
  it('never hard-codes a duration beside the scale', () => {
    const css = declarations(base);
    expect(css).not.toMatch(/animation:[^;]*\b\d{2,4}ms/);
    expect(css).not.toMatch(/transition:[^;]*\b\d{2,4}ms/);
  });

  /**
   * 🔴 `RULE 15.3` — text is NEVER transform-scaled, because scaling resamples glyphs. A
   * 0.98 grow was drafted for the account menu and removed for exactly this reason.
   */
  it('uses no scale() in any motion primitive', () => {
    expect(declarations(base)).not.toContain('scale(');
  });

  /** 🔴 Compositor-friendly only: opacity and transform, never layout properties. */
  it('animates only opacity and transform', () => {
    const keyframes = declarations(base).match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const frame of keyframes) {
      expect(frame).not.toMatch(/\b(width|height|margin|padding|top|left|filter)\s*:/);
    }
  });

  /**
   * 🔴 `RULE 3.21.b` — reduced motion is MANDATORY and covers every primitive, including the
   * ones added by this pass. Functionality is preserved; only movement is removed.
   */
  it('answers prefers-reduced-motion for every primitive', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)[\s\S]*$/.exec(base)?.[0] ?? '';
    for (const primitive of [
      '.nav-disclosure', '.nav-chevron', '.state-transition',
      '.page-content-transition', '.overlay-enter',
    ]) {
      expect(block).toContain(primitive);
    }
  });
});

describe('compact header geometry', () => {
  /**
   * 🔴 `RULE 3.11.d` — the page-header action is no longer the largest control in the ERP.
   * Prominence comes from fill, position and label, not from geometry.
   */
  it('uses the compact page-header action height', () => {
    expect(token('--control-height-page-header-button')).toBe('36px');
  });

  /** ⚠ Still a comfortable desktop target — compact is not small. */
  it('keeps every control height within desktop ergonomics', () => {
    for (const name of [
      '--control-height-form', '--control-height-row-action',
      '--control-height-button', '--control-height-page-header-button',
    ]) {
      const px = Number(token(name).replace('px', ''));
      expect(px).toBeGreaterThanOrEqual(32);
      expect(px).toBeLessThanOrEqual(40);
    }
  });
});
