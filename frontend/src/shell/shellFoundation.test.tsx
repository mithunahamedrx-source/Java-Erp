import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import HeaderUtilities from './HeaderUtilities';
import PageContentTransition from './PageContentTransition';
import AppShell from './AppShell';
import { APPLICATION_BRAND } from './brand';
import { DISCLOSURE_ROTATION, MODULE_ICON, UTILITY_ICON } from './icons';
/*
 * The shipped stylesheet, read as text. Vitest stubs CSS imports, so it is read from disk
 * rather than imported - the assertions must see the real file, not an empty stub.
 */
const GLOBAL_CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');
const TOKENS_CSS = readFileSync(resolve(process.cwd(), 'src/design/tokens.css'), 'utf-8');

/** The ordinary authenticated fixture, so each test varies only what it is about. */
function stubUser(): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions: [],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
}
const SRC_DIR = resolve(process.cwd(), 'src');

/** Declarations only. Prose in comments must not satisfy - or break - a rule assertion. */
const CSS_DECLARATIONS = GLOBAL_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

function readSourceFiles(dir: string): string {
  return readdirSync(dir)
    .flatMap((entry) => {
      if (entry.includes('.test.')) {
        return '';
      }
      const path = resolve(dir, entry);
      if (statSync(path).isDirectory()) {
        return readSourceFiles(path);
      }
      if (
        !(path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.css')) ||
        /\.test\.[tj]sx?$/.test(path)
      ) {
        return '';
      }
      return readFileSync(path, 'utf-8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    })
    .join('\n');
}

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

  it('keeps Chat and Notifications on the white utility surface', () => {
    renderUtilities();
    for (const testId of ['utility-chat', 'utility-notifications']) {
      const control = screen.getByTestId(testId);
      expect(control.style.background).toContain('var(--color-surface)');
      expect(control.getAttribute('style')).not.toContain('border: 1px');
      expect(control.style.borderStyle).not.toBe('solid');
      expect(control.style.boxShadow).toContain('var(--elevation-card)');
    }
  });

  /**
   * 🔴 `RULE 3.8.a.c` v2.13.0 — THE ACCOUNT CARD. The trigger is avatar + display name +
   * chevron, and the WHOLE card opens the menu. Superseded: the avatar-only button.
   */
  it('renders the account card as avatar, display name and chevron', async () => {
    stubUser();
    renderUtilities();

    const card = screen.getByTestId('utility-profile');
    await waitFor(() => expect(screen.getByTestId('account-name').textContent).toBe('Dev User'));
    expect(screen.getByTestId('account-avatar').textContent).toBe('DE');
    expect(card.querySelector('.lucide-chevron-down')).toBeTruthy();
    expect(card.getAttribute('aria-haspopup')).toBe('menu');
    expect(card.getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * 🔴 `RULE 3.8.a` — THE AVATAR IS CARRIED IN, NOT REPLACED. Its v2.12.0 geometry is
   * preserved exactly inside the card: 36px, true circle, ink fill, thin neutral ring.
   */
  it('preserves the approved avatar geometry inside the card', async () => {
    stubUser();
    renderUtilities();

    await waitFor(() => expect(screen.getByTestId('account-avatar').textContent).toBe('DE'));
    const avatar = screen.getByTestId('account-avatar');
    expect(avatar.style.width).toBe('36px');
    expect(avatar.style.height).toBe('36px');
    expect(avatar.style.borderRadius).toBe('50%');
    expect(avatar.style.background).toContain('var(--color-ink)');
    expect(avatar.style.color).toContain('var(--color-surface)');
    expect(avatar.style.border).toContain('1px solid var(--color-avatar-ring)');
    expect(avatar.style.border).not.toContain('var(--color-ink)');
  });

  /** ⚠ The display name comes from the SESSION, never a literal, and never an identifier. */
  it('falls back to the username when no display name exists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: '9f1c4b90-0000-4000-8000-000000000000',
      username: 'devuser', fullName: null, roles: [], permissions: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    renderUtilities();

    await waitFor(() => expect(screen.getByTestId('account-name').textContent).toBe('devuser'));
    // 🔴 The internal identifier is never rendered.
    expect(screen.getByTestId('utility-profile').textContent).not.toContain('9f1c4b90');
  });

  /** ⚠ A long name ELLIPSISES; it never wraps the header or pushes the chevron out. */
  it('truncates a long display name instead of breaking the header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'dev', username: 'devuser',
      fullName: 'Md. Arefin Rahman Mithun Chowdhury', roles: [], permissions: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    renderUtilities();

    await waitFor(() => expect(screen.getByTestId('account-name')).toBeTruthy());
    const name = screen.getByTestId('account-name');
    expect(name.style.textOverflow).toBe('ellipsis');
    expect(name.style.whiteSpace).toBe('nowrap');
    expect(name.style.overflow).toBe('hidden');
    expect(name.style.maxWidth).toBe('132px');
    // The avatar and the chevron survive the long name.
    expect(screen.getByTestId('account-avatar')).toBeTruthy();
    expect(screen.getByTestId('utility-profile').querySelector('.lucide-chevron-down')).toBeTruthy();
  });

  /** 🔴 The chevron turns on the SAME state as the menu, so the two cannot disagree. */
  it('rotates the chevron with the menu state', async () => {
    stubUser();
    renderUtilities();

    const card = screen.getByTestId('utility-profile');
    await waitFor(() => expect(screen.getByTestId('account-name')).toBeTruthy());
    const chevron = (): HTMLElement => card.querySelector('.lucide-chevron-down') as HTMLElement;
    expect(chevron().style.transform).toBe('rotate(0deg)');

    card.click();
    await waitFor(() => expect(screen.getByTestId('profile-menu')).toBeTruthy());
    expect(chevron().style.transform).toBe('rotate(180deg)');
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  /** ⚠ The menu is an ELEVATED surface and uses the shared arrival motion, not its own. */
  it('gives the account menu the shared overlay motion and elevation', async () => {
    stubUser();
    renderUtilities();
    await waitFor(() => expect(screen.getByTestId('account-name')).toBeTruthy());
    screen.getByTestId('utility-profile').click();

    await waitFor(() => expect(screen.getByTestId('profile-menu')).toBeTruthy());
    const menu = screen.getByTestId('profile-menu');
    expect(menu.className).toContain('overlay-enter');
    expect(menu.style.boxShadow).toContain('var(--elevation-overlay)');
    expect(menu.style.border).toContain('var(--color-border-control)');
    expect(menu.style.border).not.toContain('var(--color-ink)');
    // Anchored to the card's right edge, immediately below it.
    expect(menu.style.right).toBe('0px');
  });

  /** ⚠ Chat and Notifications are a DIFFERENT KIND of control and keep their own geometry. */
  it('does not enlarge Chat and Notifications to match the avatar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    renderUtilities();

    for (const testId of ['utility-chat', 'utility-notifications']) {
      const control = screen.getByTestId(testId);
      expect(control.style.width).toBe('34px');
      expect(control.style.height).toBe('34px');
    }
  });

  it('dismisses the profile menu on outside pointer and Escape, then reopens normally', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'dev',
      username: 'devuser',
      fullName: 'Dev User',
      roles: [],
      permissions: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    renderUtilities();

    const trigger = screen.getByTestId('utility-profile');
    fireEvent.click(trigger);
    expect(screen.getByTestId('profile-menu')).toBeTruthy();

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByTestId('profile-menu')).toBeNull());

    fireEvent.click(trigger);
    expect(screen.getByTestId('profile-menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('profile-menu')).toBeNull());

    fireEvent.click(trigger);
    expect(screen.getByTestId('profile-menu')).toBeTruthy();
  });

  it('keeps internal profile-menu interaction usable and logout wired', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/logout')) {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({
        id: 'dev',
        username: 'devuser',
        fullName: 'Dev User',
        roles: [],
        permissions: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetch);

    renderUtilities();

    fireEvent.click(screen.getByTestId('utility-profile'));
    const menu = screen.getByTestId('profile-menu');
    fireEvent.pointerDown(menu);
    expect(screen.getByTestId('profile-menu')).toBeTruthy();

    fireEvent.click(screen.getByTestId('sign-out'));
    await waitFor(() =>
      expect(fetch.mock.calls.some(([input]) => String(input).includes('/api/auth/logout'))).toBe(true));
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

  /**
   * 🔴 THE SHELL SITS OUTSIDE THE ANIMATED BOUNDARY. The sidebar, brand block, user card
   * and header utilities must never re-enter on navigation — an ERP that flickers its own
   * furniture every time a page changes feels unstable, however brief the animation.
   */
  it('keeps the persistent shell outside the animated boundary', () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </MemoryRouter>,
    );

    const boundary = screen.getByTestId('page-content-transition');
    expect(boundary.contains(screen.getByTestId('application-brand'))).toBe(false);
    expect(boundary.contains(screen.getByTestId('sidebar-nav'))).toBe(false);
    expect(boundary.contains(screen.getByTestId('sidebar-user-card'))).toBe(false);
    // And the boundary itself lives INSIDE the scrolling content region.
    expect(screen.getByTestId('content-region').contains(boundary)).toBe(true);
  });

  /**
   * 🔴 KEYED ON THE ROUTE, NOT ON RENDER COUNT. A data refresh, a keystroke or a validation
   * change must never replay the page animation; only a real navigation may.
   */
  it('replays only when the route actually changes', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/reports']}>
        <PageContentTransition>
          <div data-testid="routed-content">content</div>
        </PageContentTransition>
      </MemoryRouter>,
    );
    const first = screen.getByTestId('page-content-transition');

    // A rerender at the SAME route keeps the very same element — no remount, no replay.
    rerender(
      <MemoryRouter initialEntries={['/reports']}>
        <PageContentTransition>
          <div data-testid="routed-content">refreshed</div>
        </PageContentTransition>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('page-content-transition')).toBe(first);
    expect(screen.getByTestId('routed-content').textContent).toBe('refreshed');
  });

  /** ⚠ There is exactly ONE transition boundary in the application, not one per module. */
  it('declares a single shared boundary', () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId('page-content-transition')).toHaveLength(1);
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

  /**
   * 🔴 `RULE 3.21.f` v2.13.0 — ONE SHARED SCALE. Durations are named tokens now, so a
   * component can pick a speed but cannot invent one. Superseded: two local literals.
   */
  it('drives every motion primitive from the shared duration scale', () => {
    expect(TOKENS_CSS).toContain('--motion-fast: 120ms');
    expect(TOKENS_CSS).toContain('--motion-standard: 150ms');
    expect(TOKENS_CSS).toContain('--motion-page: 160ms');
    // ⚠ Disclosure is an ALIAS of the page duration, not a fourth number.
    expect(GLOBAL_CSS).toContain('--disclosure-duration: var(--motion-page)');
    expect(GLOBAL_CSS).toContain('animation: page-content-enter var(--motion-page)');
    // 🔴 No component may hard-code a duration alongside the scale.
    expect(GLOBAL_CSS).not.toMatch(/animation:[^;]*\b1\d\dms/);
  });

  /** RULE 15.3 - text is never transform-scaled, so no motion primitive may use scale(). */
  it('uses no scale() in any motion primitive', () => {
    expect(CSS_DECLARATIONS).not.toContain('scale(');
  });

  it('contains no component-level horizontal scroll affordance or zoom hack', () => {
    const sources = readSourceFiles(SRC_DIR);
    expect(sources).not.toMatch(/overflowX:\s*['"`]auto['"`]/);
    expect(sources).not.toMatch(/overflow-x:\s*auto/);
    expect(sources).not.toMatch(/Scroll horizontally/i);
    expect(sources).not.toMatch(/ResizeObserver/);
    expect(sources).not.toMatch(/transform:\s*['"`]?scale/);
    expect(sources).not.toMatch(/(^|[^a-zA-Z-])zoom\s*:/);
    expect(sources).not.toMatch(/innerWidth|outerWidth|devicePixelRatio|screen\.width|matchMedia/);
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
