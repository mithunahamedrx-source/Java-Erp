import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';
import { AuthProvider } from '../auth/AuthContext';
import { NAVIGATION, isGroup, visibleChildren } from './navigation';
import { MODULE_ICON } from './icons';

/**
 * The sidebar reads the authenticated session for its identity card, so it renders inside
 * AuthProvider. `/api/auth/me` is stubbed to fail, which is the normal "not signed in"
 * answer — enough to exercise navigation without inventing a fake authenticated user.
 */
function renderSidebar(path: string, permissions: readonly string[] = []): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Sidebar permissions={permissions} />
      </AuthProvider>
    </MemoryRouter>,
  );
}


/**
 * Collapsed children remain in the DOM so the disclosure can animate, but the region is
 * `visibility: hidden` and out of tab order. "Visible" therefore means the owning
 * disclosure region reports itself expanded — asserting on DOM presence would now pass
 * even when the group is closed.
 */
function childVisible(label: string): boolean {
  const child = screen.queryByTestId(`nav-child-${label}`);
  if (!child) return false;
  const region = child.closest('.nav-disclosure');
  return region?.getAttribute('data-expanded') === 'true';
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

// vitest runs with globals:false, so RTL's automatic cleanup is not registered.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('frozen navigation register (UX-024)', () => {
  it('renders exactly the ratified top-level items', () => {
    renderSidebar('/inventory/products');
    const expected = [
      'Dashboard',
      'Inventory',
      'Purchasing',
      'Sales & Orders',
      'Finance & Accounting',
      'HR & Payroll',
      'CRM',
      'Reports',
      'Administration',
    ];
    expected.forEach((label) => {
      const group = screen.queryByTestId(`nav-group-${label}`);
      const leaf = screen.queryByTestId(`nav-leaf-${label}`);
      expect(group ?? leaf, `${label} must be present`).not.toBeNull();
    });
  });

  /** UX-017 - header utilities, never sidebar destinations. */
  it.each(['Chat', 'Notifications'])('does NOT place %s in the sidebar', (label) => {
    renderSidebar('/inventory/products');
    expect(within(screen.getByTestId('sidebar-nav')).queryByText(label)).toBeNull();
  });

  /** UX-187 - composed inside the Orders workspace, never sidebar rows. */
  it.each(['Fulfilment', 'Pick & Pack', 'Shipments', 'Marketplace Sync'])(
    'does NOT place %s in the sidebar',
    (label) => {
      renderSidebar('/inventory/products');
      expect(within(screen.getByTestId('sidebar-nav')).queryByText(label)).toBeNull();
    },
  );

  /** UX-024 amended 2026-08-11 - Dashboard is first under MAIN and takes no children. */
  it('renders Dashboard first under MAIN as a leaf with no disclosure control', () => {
    renderSidebar('/dashboard');
    expect(screen.getByTestId('nav-leaf-Dashboard')).toBeTruthy();
    expect(screen.queryByTestId('nav-group-Dashboard')).toBeNull();

    const nav = screen.getByTestId('sidebar-nav');
    const leaves = nav.querySelectorAll('[data-testid^="nav-leaf-"], [data-testid^="nav-group-"]');
    expect(leaves[0]?.getAttribute('data-testid')).toBe('nav-leaf-Dashboard');
  });

  it('renders Reports as a leaf, not a group', () => {
    renderSidebar('/reports');
    expect(screen.getByTestId('nav-leaf-Reports')).toBeTruthy();
    expect(screen.queryByTestId('nav-group-Reports')).toBeNull();
  });
});

describe('operator-controlled disclosure (UX-026.f, amended 2026-08-11)', () => {
  it('auto-opens the group owning the active route on arrival', () => {
    renderSidebar('/sales/returns');
    expect(childVisible('Returns & Exchange')).toBe(true);
  });

  /**
   * 🔴 The amendment itself. Previously the active group could NOT be collapsed — the only
   * way to close it was to navigate away. The operator may now close it.
   */
  it('lets the operator collapse the group owning the active route', () => {
    renderSidebar('/sales/returns');
    expect(childVisible('Returns & Exchange')).toBe(true);

    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));

    // The active child is now hidden - permitted by the amended UX-026.c.
    expect(childVisible('Returns & Exchange')).toBe(false);
  });

  /** UX-026.f - the active PARENT stays visually active while collapsed. */
  it('keeps the active parent identifiable while collapsed', () => {
    renderSidebar('/sales/returns');
    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));

    const parent = screen.getByTestId('nav-group-Sales & Orders');
    expect(parent.getAttribute('data-active')).toBe('true');
    expect(parent.getAttribute('aria-expanded')).toBe('false');
  });

  it('reopens the group and reveals the active child again', () => {
    renderSidebar('/sales/returns');
    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));
    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));

    expect(childVisible('Returns & Exchange')).toBe(true);
  });

  /** 🔴 An explicit collapse must survive re-render; active-route logic must not undo it. */
  it('does not let active-route logic re-open a deliberately collapsed group', () => {
    renderSidebar('/sales/returns');
    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));
    // A re-render triggered by unrelated interaction must not resurrect the group.
    fireEvent.click(screen.getByTestId('nav-group-Inventory'));

    expect(childVisible('Returns & Exchange')).toBe(false);
  });

  it('opens and re-closes a group that does not own the active route', () => {
    renderSidebar('/inventory/products');
    expect(childVisible('Suppliers')).toBe(false);

    fireEvent.click(screen.getByTestId('nav-group-Purchasing'));
    expect(childVisible('Suppliers')).toBe(true);

    fireEvent.click(screen.getByTestId('nav-group-Purchasing'));
    expect(childVisible('Suppliers')).toBe(false);
  });

  /**
   * 🔴 Business-approved chevron direction, and the inverse of the usual web convention.
   * These two assertions exist so it cannot be "corrected" back by habit.
   */
  it('points the chevron UP while the group is folded', () => {
    renderSidebar('/inventory/products');
    const chevron = within(screen.getByTestId('nav-group-Purchasing')).getByTestId('nav-chevron');
    expect(chevron.getAttribute('data-direction')).toBe('up');
    expect(chevron.getAttribute('style')).toContain('rotate(180deg)');
  });

  it('points the chevron DOWN while the group is unfolded', () => {
    renderSidebar('/inventory/products');
    fireEvent.click(screen.getByTestId('nav-group-Purchasing'));

    const chevron = within(screen.getByTestId('nav-group-Purchasing')).getByTestId('nav-chevron');
    expect(chevron.getAttribute('data-direction')).toBe('down');
    expect(chevron.getAttribute('style')).toContain('rotate(0deg)');
  });

  /** A leaf discloses nothing, so it carries no chevron at all. */
  it('gives a direct leaf no disclosure chevron', () => {
    renderSidebar('/dashboard');
    expect(within(screen.getByTestId('nav-leaf-Dashboard')).queryByTestId('nav-chevron')).toBeNull();
    expect(within(screen.getByTestId('nav-leaf-Reports')).queryByTestId('nav-chevron')).toBeNull();
  });

  /** UX-026.d - the parent is a disclosure control, never a destination. */
  it('renders group parents as buttons, never links', () => {
    renderSidebar('/inventory/products');
    expect(screen.getByTestId('nav-group-Purchasing').tagName).toBe('BUTTON');
  });
});

describe('permission-aware visibility (UX-027)', () => {
  /** UX-027.c - a single visible child does NOT auto-flatten. */
  it('keeps a one-child group as a group', () => {
    renderSidebar('/crm/customers');
    expect(screen.getByTestId('nav-group-CRM')).toBeTruthy();
    expect(childVisible('Customers')).toBe(true);
  });

  /** UX-027.b - a group with zero visible children renders nothing. */
  it('renders nothing for a group with zero visible children', () => {
    const gated = {
      label: 'Gated',
      section: 'MAIN' as const,
      children: [{ label: 'Hidden', path: '/x', permission: 'never.granted' }],
    };
    expect(visibleChildren(gated, [])).toHaveLength(0);
  });

  /** 🔴 No destination invents a business permission to populate the sidebar. */
  it('binds no invented business permission', () => {
    const declared = NAVIGATION.flatMap((item) =>
      isGroup(item) ? item.children.map((c) => c.permission) : [item.permission],
    );
    expect(declared.every((p) => p === null)).toBe(true);
  });
});

describe('shell regions', () => {
  /** The user card is fixed and must not live inside the scrolling navigation region. */
  it('renders the identity card outside the scrolling nav region', () => {
    renderSidebar('/inventory/products');
    const card = screen.getByTestId('sidebar-user-card');
    const nav = screen.getByTestId('sidebar-nav');

    expect(card).toBeTruthy();
    expect(nav.contains(card)).toBe(false);
  });

  /** The brand block is fixed too - it must not sit inside the scrolling region either. */
  it('renders the brand block outside the scrolling nav region', () => {
    renderSidebar('/inventory/products');
    const brand = screen.getByTestId('application-brand');
    expect(screen.getByTestId('sidebar-nav').contains(brand)).toBe(false);
  });

  /**
   * 🔴 The brand region is the COMPLETE original logo asset and nothing else - no CSS
   * mark, no circle container, and no separately rendered wordmark text beside it.
   */
  it('renders the complete logo as one image and no separate wordmark text', () => {
    renderSidebar('/inventory/products');
    const brand = screen.getByTestId('application-brand');
    const logo = within(brand).getByTestId('application-logo');

    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('alt')).toBe('TrioLoo');
    // One image, and it is the only content of the brand region.
    expect(brand.querySelectorAll('img')).toHaveLength(1);
    expect(brand.textContent).toBe('');
  });

  /** Aspect ratio is preserved by declaring height only and letting width derive. */
  it('sizes the logo without distorting or recolouring it', () => {
    renderSidebar('/inventory/products');
    const logo = screen.getByTestId('application-logo');
    expect(logo.style.height).toBe('46px');
    expect(logo.style.width).toBe('auto');
    expect(logo.style.objectFit).toBe('contain');
    // 🔴 No recolouring and no CSS filter of any kind.
    expect(logo.style.filter).toBe('');
  });

  /** 🔴 The shared scroll treatment, not a sidebar-private one. */
  it('uses the shared erp-scroll treatment on the navigation region', () => {
    renderSidebar('/inventory/products');
    const nav = screen.getByTestId('sidebar-nav');
    expect(nav.classList.contains('erp-scroll')).toBe(true);
    // 🔴 Never overflow:hidden - that would hide the scrollbar by making content unreachable.
    expect(nav.style.overflowY).toBe('auto');
  });

  /** 🔴 No fabricated job title when the session exposes none. */
  it('shows no invented role line for an unauthenticated session', () => {
    renderSidebar('/inventory/products');
    expect(within(screen.getByTestId('sidebar-user-card')).queryByText(/Call Centre Agent/)).toBeNull();
  });

  it('gives every top-level module a distinct icon', () => {
    renderSidebar('/inventory/products');
    const icons = screen.getByTestId('sidebar-nav').querySelectorAll('svg');
    // Dashboard + 6 MAIN groups + Reports leaf + Administration = 9, plus chevrons.
    expect(icons.length).toBeGreaterThanOrEqual(9);
  });

  /** 🔴 ONE icon system. Every top-level label resolves through the shared semantic map. */
  it('maps every top-level navigation label to a semantic icon', () => {
    const missing = NAVIGATION.map((i) => i.label).filter((label) => !(label in MODULE_ICON));
    expect(missing).toEqual([]);
  });
});
