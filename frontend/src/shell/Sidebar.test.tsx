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
      // 🔴 `Purchasing` is deliberately ABSENT — UX-024 as amended has no such parent.
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
    expect(childVisible('Orders')).toBe(false);

    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));
    expect(childVisible('Orders')).toBe(true);

    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));
    expect(childVisible('Orders')).toBe(false);
  });

  /**
   * 🔴 Business-approved chevron direction, INVERTED 2026-08-11: closed points DOWN, open
   * points UP. These two assertions pin it so it cannot drift back.
   */
  it('points the chevron DOWN while the group is folded', () => {
    renderSidebar('/inventory/products');
    const chevron = within(screen.getByTestId('nav-group-Sales & Orders')).getByTestId('nav-chevron');
    expect(chevron.getAttribute('data-direction')).toBe('down');
    expect(chevron.getAttribute('style')).toContain('rotate(0deg)');
  });

  it('points the chevron UP while the group is unfolded', () => {
    renderSidebar('/inventory/products');
    fireEvent.click(screen.getByTestId('nav-group-Sales & Orders'));

    const chevron = within(screen.getByTestId('nav-group-Sales & Orders')).getByTestId('nav-chevron');
    expect(chevron.getAttribute('data-direction')).toBe('up');
    expect(chevron.getAttribute('style')).toContain('rotate(180deg)');
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
    expect(screen.getByTestId('nav-group-Inventory').tagName).toBe('BUTTON');
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
  /**
   * 🔴 `RULE 3.7.c` v2.13.0 — THE MARK IS SECONDARY TO THE WORKSPACE: ~10% smaller and
   * softened to 0.86. Superseded: 40px at full opacity.
   */
  it('sizes the logo without distorting or recolouring it', () => {
    renderSidebar('/inventory/products');
    const logo = screen.getByTestId('application-logo');
    expect(logo.style.height).toBe('36px');
    // ⚠ Only height is declared, so the 643 × 184 aspect ratio cannot be distorted.
    expect(logo.style.width).toBe('auto');
    expect(logo.style.objectFit).toBe('contain');
    expect(logo.style.opacity).toBe('0.86');
    // 🔴 No recolouring and no CSS filter of any kind.
    expect(logo.style.filter).toBe('');
  });

  /** ⚠ Hierarchy, not decoration: the brand region gains no container of its own. */
  it('gives the brand region no card, border, shadow or panel', () => {
    renderSidebar('/inventory/products');
    const brand = screen.getByTestId('application-brand');
    expect(brand.style.background).toBe('');
    expect(brand.style.boxShadow).toBe('');
    expect(brand.style.borderRadius).toBe('');
    // The one hairline that separates the block from the nav is kept.
    expect(brand.style.borderBottom).toContain('var(--color-divider-inner)');
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
    // Dashboard + 5 MAIN groups + Reports leaf + Administration = 8, plus chevrons.
    // 🔴 Was 9 while `Purchasing` was a parent; UX-024 as amended removed that group.
    expect(icons.length).toBeGreaterThanOrEqual(8);
  });

  /** 🔴 ONE icon system. Every top-level label resolves through the shared semantic map. */
  it('maps every top-level navigation label to a semantic icon', () => {
    const missing = NAVIGATION.map((i) => i.label).filter((label) => !(label in MODULE_ICON));
    expect(missing).toEqual([]);
  });
});

/**
 * `UX-024` as amended 2026-08-11 — INVENTORY NAVIGATION CONSOLIDATION.
 *
 * 🔴 These tests pin COMPOSITION AND ORDER. They deliberately assert nothing about ownership
 * being transferred, because `UX-025` guarantees the opposite: a shared parent row is a place
 * to click and moves no domain, aggregate, transaction boundary or authority.
 */
describe('inventory navigation consolidation (UX-024 amended, UX-025)', () => {
  it('has no standalone Purchasing parent anywhere in the sidebar', () => {
    renderSidebar('/inventory/products');
    expect(screen.queryByTestId('nav-group-Purchasing')).toBeNull();
    expect(screen.queryByTestId('nav-leaf-Purchasing')).toBeNull();
  });

  /** 🔴 The register itself, not just what happens to render. */
  it('declares no Purchasing group in the navigation register', () => {
    expect(NAVIGATION.some((item) => item.label === 'Purchasing')).toBe(false);
  });

  it('gives Inventory exactly five children in the ratified order', () => {
    const inventory = NAVIGATION.find((item) => item.label === 'Inventory');
    expect(inventory && isGroup(inventory)).toBe(true);
    const children = (inventory as { children: readonly { label: string }[] }).children;
    expect(children.map((c) => c.label)).toEqual([
      'Products',
      'Stock Control',
      'Purchasing',
      'Suppliers',
      'Warehouses',
    ]);
  });

  it('renders the five Inventory children in that order in the DOM', () => {
    renderSidebar('/inventory/products');
    const region = screen.getByTestId('nav-disclosure-Inventory');
    const rendered = Array.from(region.querySelectorAll('[data-testid^="nav-child-"]')).map((node) =>
      node.getAttribute('data-testid'),
    );
    expect(rendered).toEqual([
      'nav-child-Products',
      'nav-child-Stock Control',
      'nav-child-Purchasing',
      'nav-child-Suppliers',
      'nav-child-Warehouses',
    ]);
  });

  it('does not render the old Stock or Purchases sidebar labels', () => {
    renderSidebar('/inventory/products');
    const inventoryRegion = screen.getByTestId('nav-disclosure-Inventory');
    const childLabels = Array.from(inventoryRegion.querySelectorAll('[data-testid^="nav-child-"]')).map((node) =>
      node.textContent,
    );
    expect(childLabels).not.toContain('Stock');
    expect(childLabels).not.toContain('Purchases');
  });

  /** 🔴 A move, not a copy. A duplicated destination would be two places to click one thing. */
  it.each(['Purchasing', 'Suppliers'])('renders %s exactly once', (label) => {
    renderSidebar('/inventory/products');
    expect(screen.queryAllByTestId(`nav-child-${label}`)).toHaveLength(1);
  });

  it.each([
    ['/purchasing/purchases', 'Purchasing'],
    ['/purchasing/suppliers', 'Suppliers'],
  ])('marks Inventory active on %s', (path, label) => {
    renderSidebar(path);
    expect(screen.getByTestId('nav-group-Inventory').getAttribute('data-active')).toBe('true');
    expect(childVisible(label)).toBe(true);
  });

  /**
   * 🔴 THE OWNERSHIP SAFEGUARD (`UX-025`). The destinations keep their Procurement-owned
   * paths: the URL still names the owning module, so nothing in the address suggests
   * Inventory acquired procurement.
   */
  it('keeps the purchasing destinations on their Procurement-owned paths', () => {
    const inventory = NAVIGATION.find((item) => item.label === 'Inventory');
    const children = (inventory as { children: readonly { label: string; path: string }[] }).children;
    expect(children.find((c) => c.label === 'Purchasing')?.path).toBe('/purchasing/purchases');
    expect(children.find((c) => c.label === 'Suppliers')?.path).toBe('/purchasing/suppliers');
  });

  /** 🔴 No `inventory.purchases.*` / `inventory.suppliers.*` code invented (`PRM-089`). */
  it('creates no Inventory-owned purchasing permission code', () => {
    const declared = NAVIGATION.flatMap((item) =>
      isGroup(item) ? item.children.map((c) => c.permission) : [item.permission],
    );
    expect(declared.every((p) => p === null)).toBe(true);
    const source = JSON.stringify(NAVIGATION);
    expect(source).not.toMatch(/inventory\.(purchases|suppliers)/);
  });

  /**
   * 🔴 No role-name security shortcut and no wildcard.
   *
   * <p>⚠ Asserted over the AUTHORITY fields only. The `ADMIN` section label is the ratified
   * `UX-024` navigation section and is not a role test — matching it would be a false positive.
   */
  it('uses no role-name shortcut and no wildcard authority', () => {
    const authorities = NAVIGATION.flatMap((item) =>
      isGroup(item) ? item.children.map((c) => c.permission) : [item.permission],
    );
    for (const authority of authorities) {
      expect(authority === null || !/hasRole|ROLE_|\*/.test(authority)).toBe(true);
    }
  });

  /** UX-027 - a relocated child stays permission-aware exactly as before. */
  it('still hides a permission-gated child and keeps the rest', () => {
    const gated = {
      label: 'Inventory',
      section: 'MAIN' as const,
      children: [
        { label: 'Products', path: '/inventory/products', permission: null },
        { label: 'Purchasing', path: '/purchasing/purchases', permission: 'never.granted' },
      ],
    };
    expect(visibleChildren(gated, []).map((c) => c.label)).toEqual(['Products']);
    expect(visibleChildren(gated, ['never.granted']).map((c) => c.label)).toEqual([
      'Products',
      'Purchasing',
    ]);
  });

  /** 🔴 Two levels only (`RULE 4.3.a`) - five children add no third level. */
  it('adds no third navigation level', () => {
    renderSidebar('/inventory/products');
    const region = screen.getByTestId('nav-disclosure-Inventory');
    expect(region.querySelectorAll('.nav-disclosure')).toHaveLength(0);
  });

  /** 🔴 The entity-class tabs are workspace tabs and never sidebar destinations. */
  it.each(['Stock Items', 'Sellable Products', 'Listings'])(
    'does NOT create a %s sidebar child',
    (label) => {
      renderSidebar('/inventory/products');
      expect(screen.queryByTestId(`nav-child-${label}`)).toBeNull();
    },
  );

  /** 🔴 `Products` and `Stock` are different destinations; neither absorbs the other. */
  it('keeps Products and Stock Control as separate destinations', () => {
    renderSidebar('/inventory/products');
    const products = screen.getByTestId('nav-child-Products');
    const stock = screen.getByTestId('nav-child-Stock Control');
    expect(products.getAttribute('href')).toBe('/inventory/products');
    expect(stock.getAttribute('href')).toBe('/inventory/stock');
    expect(products).not.toBe(stock);
  });

  it.each(['/inventory/products', '/inventory/products/stock', '/inventory/products/sellable', '/inventory/products/listings'])(
    'keeps Products active and Stock Control inactive on %s',
    (path) => {
      renderSidebar(path);
      expect(screen.getByTestId('nav-child-Products').getAttribute('aria-current')).toBe('page');
      expect(screen.getByTestId('nav-child-Stock Control').getAttribute('aria-current')).toBeNull();
      expect(screen.getByTestId('nav-group-Inventory').getAttribute('data-active')).toBe('true');
    },
  );

  it('makes Stock Control active and Products inactive on the Stock Control destination', () => {
    renderSidebar('/inventory/stock');
    expect(screen.getByTestId('nav-child-Stock Control').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('nav-child-Products').getAttribute('aria-current')).toBeNull();
    expect(screen.getByTestId('nav-group-Inventory').getAttribute('data-active')).toBe('true');
  });
});
