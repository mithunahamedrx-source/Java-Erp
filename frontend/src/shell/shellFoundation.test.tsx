import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import HeaderUtilities from './HeaderUtilities';
import PageContentTransition from './PageContentTransition';
import { APPLICATION_BRAND } from './brand';
import { DISCLOSURE_ROTATION, MODULE_ICON, UTILITY_ICON } from './icons';
/*
 * The shipped stylesheet, read as text. Vitest stubs CSS imports, so it is read from disk
 * rather than imported - the assertions must see the real file, not an empty stub.
 */
const GLOBAL_CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');

/** Declarations only. Prose in comments must not satisfy - or break - a rule assertion. */
const CSS_DECLARATIONS = GLOBAL_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('global header utilities (UX-017)', () => {
  function renderUtilities(): void {
    render(
      <MemoryRouter>
        <AuthProvider>
          <HeaderUtilities />
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  /** Every icon-only control must be identifiable by assistive technology, not by shape. */
  it.each([
    ['utility-chat', 'Chat'],
    ['utility-notifications', 'Notifications'],
    ['utility-profile', 'User menu'],
  ])('gives %s an accessible label', (testId, label) => {
    renderUtilities();
    expect(screen.getByTestId(testId).getAttribute('aria-label')).toBe(label);
  });

  it('renders Chat and Notifications as real buttons carrying an icon', () => {
    renderUtilities();
    for (const testId of ['utility-chat', 'utility-notifications']) {
      const control = screen.getByTestId(testId);
      expect(control.tagName).toBe('BUTTON');
      expect(control.querySelector('svg')).not.toBeNull();
    }
  });

  /** 🔴 No fabricated unread state. No badge, no dot, no count anywhere in the cluster. */
  it('shows no unread count or notification state', () => {
    renderUtilities();
    // The avatar legitimately carries the operator's initials; nothing else renders text, and
    // 🔴 no digit may appear anywhere - a count would be invented business data.
    expect(screen.getByTestId('utility-cluster').textContent).toMatch(/^[^0-9]*$/);
    for (const testId of ['utility-chat', 'utility-notifications']) {
      expect(screen.getByTestId(testId).textContent).toBe('');
    }
  });
});

describe('global page content transition', () => {
  it('wraps routed content in the single shared transition boundary', () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <PageContentTransition>
          <div data-testid="routed-content">content</div>
        </PageContentTransition>
      </MemoryRouter>,
    );

    const boundary = screen.getByTestId('page-content-transition');
    expect(boundary.classList.contains('page-content-transition')).toBe(true);
    expect(boundary.contains(screen.getByTestId('routed-content'))).toBe(true);
  });
});

/**
 * These read the shipped stylesheet directly. jsdom does not run animations, so asserting on
 * the declarations is the honest way to prove the global treatments exist and are global —
 * rather than claiming a visual behaviour no test actually exercised.
 */
describe('global CSS foundation', () => {
  it('declares exactly one scrollbar treatment', () => {
    expect(GLOBAL_CSS).toContain('.erp-scroll');
    expect(GLOBAL_CSS).toContain('.erp-scroll::-webkit-scrollbar');
    // 🔴 One implementation only - no per-module scrollbar CSS.
    expect(GLOBAL_CSS.match(/::-webkit-scrollbar/g)).toHaveLength(1);
  });

  it('honours prefers-reduced-motion for both motion primitives', () => {
    const block = GLOBAL_CSS.slice(GLOBAL_CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('.nav-disclosure');
    expect(block).toContain('.nav-chevron');
    expect(block).toContain('.page-content-transition');
  });

  it('keeps disclosure and page motion inside the approved bands', () => {
    expect(GLOBAL_CSS).toContain('--disclosure-duration: 160ms');
    expect(GLOBAL_CSS).toContain('--page-transition-duration: 150ms');
  });

  /** RULE 15.3 - text is never transform-scaled, so no motion primitive may use scale(). */
  it('uses no scale() in any motion primitive', () => {
    expect(CSS_DECLARATIONS).not.toContain('scale(');
  });
});

describe('global brand and icon system', () => {
  it('spells the application brand exactly once, canonically', () => {
    expect(APPLICATION_BRAND).toBe('TrioLoo');
  });

  it('resolves header utility icons from the shared icon module', () => {
    expect(Object.keys(UTILITY_ICON).sort()).toEqual(['chat', 'notifications', 'profile']);
    expect(Object.values(UTILITY_ICON).every((icon) => typeof icon === 'object' || typeof icon === 'function')).toBe(
      true,
    );
  });

  it('gives every module a distinct icon component', () => {
    const icons = Object.values(MODULE_ICON);
    expect(new Set(icons).size).toBe(icons.length);
  });

  /** 🔴 CLOSED points DOWN, OPEN points UP — recorded so it cannot drift back. */
  it('fixes the disclosure rotation contract', () => {
    expect(DISCLOSURE_ROTATION.closed).toBe('rotate(0deg)');
    expect(DISCLOSURE_ROTATION.open).toBe('rotate(180deg)');
  });
});
