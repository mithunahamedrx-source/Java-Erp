/**
 * The ONE definition of navigation active hierarchy.
 *
 * <p>Every sidebar row — group parent, direct leaf, child destination — resolves its
 * appearance here. 🔴 No module, page or route may define its own active-navigation styling;
 * that is exactly the duplication this module exists to prevent.
 *
 * <p>Geometry is transcribed from `DESIGN_CONSTITUTION` §3.7 (nav row `34px` / padding `0 8px`
 * / radius `8px` / margin-bottom `1px` / gap `9px`; child row `28px` / `padding-left: 32px` /
 * radius `7px` / margin `1px 0`, **no icon**).
 *
 * <p>🔴 COLOUR: only tokens already declared in `design/tokens.css`, which transcribes the
 * frozen Article III palette. No colour is invented here, and no page-specific colour exists
 * anywhere in the application.
 *
 * <h3>How the three states are told apart</h3>
 *
 * <p><b>ACTIVE PARENT GROUP</b> — the darker canonical fill `--color-nav-active-parent`
 * (`oklch(0.93 0 0)`), label at weight <b>700</b> in `--color-heading-ink`, and its semantic
 * module icon switches to ink at the `2px` active stroke §3.7 prescribes. It is a full-height
 * `34px` row carrying an icon.
 *
 * <p><b>SELECTED CHILD</b> — the lighter canonical fill `--color-nav-active-child`
 * (`oklch(0.95 0 0)`), label at weight <b>600</b> in `--color-ink`, on a shorter `28px` row
 * indented to `32px` with <b>no icon at all</b>. Group emphasis versus destination
 * identification therefore differ in fill, weight, row height, indentation and icon presence
 * simultaneously — they are never the same treatment.
 *
 * <p><b>INACTIVE CHILD</b> — quiet: no background pill whatsoever, label in
 * `--color-nav-label` at weight 500.
 *
 * <p>⚠ REPORTED LIMIT: at colour level the frozen palette supplies exactly two neutral nav
 * fills, `0.93` and `0.95` — a deliberately small delta. Everything above is what the ratified
 * tokens can express; a stronger colour-level separation would require a new token, which this
 * implementation task is not authorised to invent.
 */

import type { CSSProperties } from 'react';

/** Shared to the group parent button and the direct leaf link — both are top-level rows. */
export function topLevelRowStyle(isActive: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    width: '100%',
    height: '34px',
    padding: '0 8px',
    borderRadius: '8px',
    marginBottom: '1px',
    fontSize: '12.5px',
    fontFamily: 'inherit',
    textAlign: 'left',
    textDecoration: 'none',
    // ACTIVE PARENT: strongest group-level emphasis the frozen palette allows.
    fontWeight: isActive ? 700 : 500,
    color: isActive ? 'var(--color-heading-ink)' : 'var(--color-nav-label)',
    background: isActive ? 'var(--color-nav-active-parent)' : 'transparent',
  };
}

/** The semantic module icon follows the row's active state (§3.7 active stroke `2px`). */
export function moduleIconAppearance(isActive: boolean): { strokeWidth: number; color: string } {
  return {
    strokeWidth: isActive ? 2 : 1.5,
    color: isActive ? 'var(--color-ink)' : 'var(--color-icon-stroke-nav)',
  };
}

/** A child destination inside a group. §3.7: 28px, indented, radius 7px, NO icon. */
export function childRowStyle(isActive: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    height: '28px',
    paddingLeft: '32px',
    margin: '1px 0',
    borderRadius: '7px',
    fontSize: '12px',
    textDecoration: 'none',
    // SELECTED CHILD: identifies the exact destination, deliberately lighter than the
    // parent's group-level emphasis.
    fontWeight: isActive ? 600 : 500,
    color: isActive ? 'var(--color-ink)' : 'var(--color-nav-label)',
    // INACTIVE CHILD: quiet. No pill, no fill, nothing.
    background: isActive ? 'var(--color-nav-active-child)' : 'transparent',
  };
}

/** Section heading (`MAIN` / `ADMIN`). §3.7 — 10px / 700 / 0.07em upper. */
export function sectionLabelStyle(first: boolean): CSSProperties {
  return {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary)',
    padding: '0 8px',
    margin: first ? '6px 0 5px' : '14px 0 5px',
  };
}
