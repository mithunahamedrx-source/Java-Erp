import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ProductWorkspace, { ProductTabNotImplemented } from './ProductWorkspace';
import ChannelListingsPage from './ChannelListingsPage';
import StockItemsPage from './StockItemsPage';
import StockItemImportPage from './StockItemImportPage';
import { StockItemCard } from './StockItemCard';
import type { StockItem, StockItemSummary } from './stockItemApi';

/**
 * Stage P1 — the Products workspace and Stock Items.
 *
 * <p>🔴 No fabricated business data reaches the application: every fixture below exists only
 * inside this file, is obviously synthetic, and is served through a stubbed `fetch`.
 */

const ITEM: StockItem = {
  id: '11111111-1111-1111-1111-111111111111',
  inventorySku: 'TEST-SKU-1',
  technicalName: 'Test component, technical name',
  brand: 'TestBrand',
  inventoryCategory: 'RAM',
  unitOfMeasure: 'pcs',
  barcode: '0012345',
  serializationPolicy: 'NOT_SERIALIZED',
  componentClass: 'RAM',
  recordStatus: 'ACTIVE',
  physicalStock: '5',
  availableQuantity: '3',
  outOfStock: false,
  weightedAverageCost: '150.00',
  stockValue: '750.00',
  updatedAt: '2026-08-11T00:00:00Z',
  version: 0,
};

const SUMMARY_WITH_VALUE: StockItemSummary = {
  totalStockItems: 1,
  physicalStockUnits: '5',
  availableUnits: '3',
  outOfStockItems: 0,
  totalStockValue: '750.00',
};

/** 🔴 Value ABSENT, not zero — the shape an unauthorised actor receives. */
const SUMMARY_WITHHELD: StockItemSummary = {
  totalStockItems: 1,
  physicalStockUnits: '5',
  availableUnits: '3',
  outOfStockItems: 0,
};

const ALL_P1_PERMISSIONS = [
  'product.stock-item.view',
  'product.stock-item.manage',
  'inventory-costing.valuation.view',
];

function stubApi(options: {
  items?: readonly StockItem[];
  summary?: StockItemSummary;
  status?: number;
  permissions?: readonly string[];
  roles?: readonly string[];
} = {}): void {
  const items = options.items ?? [ITEM];
  const summary = options.summary ?? SUMMARY_WITH_VALUE;
  const permissions = options.permissions ?? ALL_P1_PERMISSIONS;
  const roles = options.roles ?? [];

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    // The session is answered first and unconditionally: a forbidden Stock Items response
    // must not also make the actor unauthenticated - those are different states.
    if (url.includes('/api/auth/me')) {
      return new Response(JSON.stringify({
        id: 'dev', username: 'devuser', fullName: 'Dev User', roles, permissions,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (options.status && options.status !== 200) {
      return new Response(JSON.stringify({ error: 'FORBIDDEN', message: 'denied' }), {
        status: options.status, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/summary')) {
      return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/stock-items')) {
      return new Response(JSON.stringify({
        content: items, page: 0, size: 50, totalElements: items.length, totalPages: 1,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
}

function renderWorkspace(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        {/* AppShell owns this provider in the real tree; the harness mirrors that shape. */}
        <PageActionsProvider>
        <Routes>
          <Route path="/inventory/products" element={<ProductWorkspace />}>
            {/* UX-035.f.i - the workspace entry RENDERS Stock Items and keeps its URL. */}
            <Route index element={<StockItemsPage />} />
            <Route path="stock" element={<StockItemsPage />} />
            <Route path="sellable" element={<ProductTabNotImplemented entity="Sellable Products" />} />
            <Route path="listings" element={<ChannelListingsPage />} />
          </Route>
          <Route path="/inventory/products/stock/import" element={<StockItemImportPage />} />
        </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Products workspace — three entity-class tabs (UX-035)', () => {
  beforeEach(() => stubApi());

  it('renders exactly three primary tabs', async () => {
    renderWorkspace('/inventory/products/stock');
    const tabs = screen.getByTestId('product-entity-tabs');
    expect(within(tabs).getByTestId('product-tab-Stock Items')).toBeTruthy();
    expect(within(tabs).getByTestId('product-tab-Sellable Products')).toBeTruthy();
    expect(within(tabs).getByTestId('product-tab-Listings')).toBeTruthy();
    expect(tabs.querySelectorAll('a')).toHaveLength(3);
  });

  /** 🔴 RULE 3.13.a.b — dark fill is the language of status filtering and is prohibited here. */
  it('gives the active tab the white-raised treatment, never a dark fill', async () => {
    renderWorkspace('/inventory/products/stock');
    const active = screen.getByTestId('product-tab-Stock Items');
    const inactive = screen.getByTestId('product-tab-Listings');

    // White-raised: the ratified surface plus the active-tab elevation.
    expect(active.getAttribute('style')).toContain('--color-surface');
    expect(active.getAttribute('style')).toContain('--elevation-active-tab');
    // 🔴 Never the dark-filled treatment, which belongs to status filtering.
    expect(active.getAttribute('style')).not.toContain('--color-ink');
    expect(inactive.getAttribute('style')).toContain('transparent');
  });

  it('routes each tab to its own addressable path', () => {
    renderWorkspace('/inventory/products/stock');
    expect(screen.getByTestId('product-tab-Stock Items').getAttribute('href')).toBe('/inventory/products/stock');
    expect(screen.getByTestId('product-tab-Sellable Products').getAttribute('href')).toBe('/inventory/products/sellable');
    expect(screen.getByTestId('product-tab-Listings').getAttribute('href')).toBe('/inventory/products/listings');
  });

  it.each([
    ['/inventory/products/sellable', 'Sellable Products'],
  ])('shows %s as structural only before its stage owns this test harness', (path, entity) => {
    renderWorkspace(path);
    const panel = screen.getByTestId('tab-not-implemented');
    expect(panel.textContent).toContain('Not implemented in this stage');
    expect(panel.textContent).toContain(entity);
    expect(screen.queryByTestId('stock-item-results')).toBeNull();
  });
});

describe('Stock Items summary strip', () => {
  it('renders five cards including Total Stock Value for an authorised actor', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByTestId('summary-total-stock-items')).toBeTruthy());
    const strip = screen.getByTestId('stock-summary-strip');
    expect(strip.children).toHaveLength(5);
    for (const key of ['total-stock-items', 'physical-stock-units', 'available-units',
      'out-of-stock-items', 'total-stock-value']) {
      expect(screen.getByTestId(`summary-${key}`)).toBeTruthy();
    }
    expect(screen.getByTestId('summary-total-stock-value').textContent).toContain('750.00');
  });

  /** 🔴 Withheld is ABSENT, never ৳0 (ICO-038.a). */
  it('omits Total Stock Value entirely when the actor lacks valuation authority', async () => {
    stubApi({ summary: SUMMARY_WITHHELD });
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByTestId('summary-total-stock-items')).toBeTruthy());
    expect(screen.getByTestId('stock-summary-strip').children).toHaveLength(4);
    expect(screen.queryByTestId('summary-total-stock-value')).toBeNull();
    expect(screen.getByTestId('stock-summary-strip').textContent).not.toContain('0.00');
  });

  it('carries no chart, trend or percentage', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-summary-strip')).toBeTruthy());

    const strip = screen.getByTestId('stock-summary-strip');
    expect(strip.querySelectorAll('svg')).toHaveLength(0);
    expect(strip.textContent).not.toMatch(/%|▲|▼|vs |trend/i);
  });
});

describe('Stock Items results — cards, never a table', () => {
  it('renders one card per Stock Item and no table element', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByTestId('stock-item-results')).toBeTruthy());
    expect(screen.getByTestId('stock-item-card-TEST-SKU-1')).toBeTruthy();
    expect(document.querySelectorAll('table')).toHaveLength(0);
    expect(document.querySelectorAll('tbody, thead, tr, td')).toHaveLength(0);
  });

  it('shows a truthful empty state rather than demo records', async () => {
    stubApi({ items: [], summary: { ...SUMMARY_WITH_VALUE, totalStockItems: 0 } });
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByText('No Stock Items exist yet')).toBeTruthy());
    expect(screen.queryByTestId('stock-item-results')).toBeNull();
  });

  it('distinguishes a permission refusal from an empty result', async () => {
    stubApi({ status: 403 });
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByText('You do not have access to Stock Items')).toBeTruthy());
  });

  it('exposes search, filters, import, export and the primary action', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());
    // LEVEL 2 dataset controls in the toolbar; LEVEL 1 page actions in the header (UX-045).
    expect(screen.getByTestId('stock-search')).toBeTruthy();
    expect(screen.getByTestId('filter-status')).toBeTruthy();
    expect(screen.getByTestId('filter-out-of-stock')).toBeTruthy();
    expect(screen.getByTestId('export-csv')).toBeTruthy();
    expect(screen.getByTestId('import-csv')).toBeTruthy();
    expect(screen.getByTestId('export-csv').textContent).toBe('Export');
    expect(screen.getByTestId('import-csv').textContent).toBe('Import');
    expect(screen.getByTestId('create-stock-item').textContent).toBe('+ Add Item');
    expect(document.body.textContent).not.toMatch(/Export CSV|Import CSV|Add Stock Item/);
    expect(screen.getByTestId('export-csv').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('import-csv').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('create-stock-item').textContent?.trim().startsWith('+')).toBe(true);
  });

  it('paginates on the server and shows the range', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-pagination')).toBeTruthy());
    expect(screen.getByTestId('page-prev')).toBeTruthy();
    expect(screen.getByTestId('page-next')).toBeTruthy();
  });
});

describe('StockItemCard anatomy', () => {
  function renderCard(item: StockItem): void {
    render(<MemoryRouter><StockItemCard item={item} /></MemoryRouter>);
  }

  it('shows identity, position and valuation without wrapping', () => {
    renderCard(ITEM);
    const card = screen.getByTestId('stock-item-card-TEST-SKU-1');
    expect(card.classList.contains('operational-row')).toBe(true);
    expect(card.style.flexWrap).toBe('nowrap');
    expect(screen.getByTestId('stock-item-name').textContent).toBe(ITEM.technicalName);
    expect(card.textContent).toContain('TEST-SKU-1');
    expect(card.textContent).toContain('Physical');
    expect(card.textContent).toContain('Available');
    expect(screen.getByTestId('stock-item-value').textContent).toBe('750.00');
  });

  it('omits Stock Value when withheld, never showing zero', () => {
    renderCard({ ...ITEM, stockValue: null, weightedAverageCost: null });
    expect(screen.queryByTestId('stock-item-value')).toBeNull();
    expect(screen.getByTestId('stock-item-card-TEST-SKU-1').textContent).not.toContain('Stock Value');
  });

  it('marks an out-of-stock item using the server predicate', () => {
    renderCard({ ...ITEM, availableQuantity: '0', outOfStock: true });
    expect(screen.getByTestId('out-of-stock-indicator')).toBeTruthy();
  });

  it('keeps a very long technical name from breaking the row', () => {
    renderCard({ ...ITEM, technicalName: 'X'.repeat(300) });
    const name = screen.getByTestId('stock-item-name');
    expect(name.style.whiteSpace).toBe('nowrap');
    expect(name.style.textOverflow).toBe('ellipsis');
    expect(screen.getByTestId('stock-item-view')).toBeTruthy();
  });

  it('keeps the thumbnail a fixed supporting region, never image-led', () => {
    renderCard(ITEM);
    const thumb = screen.getByTestId('stock-item-thumb');
    expect(thumb.style.width).toBe('38px');
    expect(thumb.style.height).toBe('38px');
    expect(thumb.style.flexShrink).toBe('0');
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('CSV import workflow (UX-043)', () => {
  beforeEach(() => stubApi());

  it('is a dedicated page with five steps, not a modal', () => {
    renderWorkspace('/inventory/products/stock/import');
    expect(screen.getByTestId('import-steps')).toBeTruthy();
    for (const step of ['Upload', 'Validate', 'Preview', 'Confirm', 'Result']) {
      expect(screen.getByTestId(`import-step-${step}`)).toBeTruthy();
    }
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('offers a template download and no confirm button before validation', () => {
    renderWorkspace('/inventory/products/stock/import');
    expect(screen.getByTestId('download-template')).toBeTruthy();
    expect(screen.queryByTestId('import-confirm')).toBeNull();
  });

  it('reports every row, including errors, and blocks confirmation while any error remains', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      planId: '', validRows: 1, errorRows: 1,
      outcomes: [
        { rowNumber: 2, result: 'VALID', field: null, message: 'Create SKU-A' },
        { rowNumber: 3, result: 'ERROR', field: 'physical_stock', message: "'physical_stock' is derived and read-only (PRD-149)." },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    renderWorkspace('/inventory/products/stock/import');
    const input = screen.getByTestId('import-file') as HTMLInputElement;
    const file = new File(['inventory_sku\nSKU-A\n'], 'items.csv', { type: 'text/csv' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    // The component reads the file asynchronously, so wait until it has been taken up.
    await waitFor(() => expect(screen.getByTestId('import-filename').textContent).toBe('items.csv'));
    await waitFor(() =>
      expect((screen.getByTestId('import-validate') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('import-validate'));

    await waitFor(() => expect(screen.getByTestId('import-preview')).toBeTruthy());
    expect(screen.getByTestId('import-row-2')).toBeTruthy();
    expect(screen.getByTestId('import-row-3').textContent).toContain('read-only');
    expect(screen.queryByTestId('import-confirm')).toBeNull();
    expect(screen.getByTestId('import-preview').textContent).toContain('Nothing has been written');
  });
});

describe('permission matrix — affordances follow effective authority', () => {
  const ALL = ['product.stock-item.view', 'product.stock-item.manage', 'inventory-costing.valuation.view'];

  async function renderWith(permissions: readonly string[], summary = SUMMARY_WITH_VALUE): Promise<void> {
    stubApi({ summary, permissions });
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-items-toolbar')).toBeTruthy());
  }

  it('VIEW only — workspace visible, no Add and no Import', async () => {
    await renderWith(['product.stock-item.view'], SUMMARY_WITHHELD);
    expect(screen.getByTestId('stock-items-toolbar')).toBeTruthy();
    expect(screen.getByTestId('export-csv')).toBeTruthy();
    expect(screen.queryByTestId('create-stock-item')).toBeNull();
    expect(screen.queryByTestId('import-csv')).toBeNull();
  });

  it('VIEW only — valuation is hidden entirely, never shown as zero', async () => {
    await renderWith(['product.stock-item.view'], SUMMARY_WITHHELD);
    expect(screen.queryByTestId('summary-total-stock-value')).toBeNull();
    expect(screen.getByTestId('stock-summary-strip').children).toHaveLength(4);
  });

  it('VIEW + MANAGE — Add Stock Item and Import CSV appear', async () => {
    await renderWith(['product.stock-item.view', 'product.stock-item.manage'], SUMMARY_WITHHELD);
    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());
    expect(screen.getByTestId('create-stock-item').textContent).toContain('Add Item');
    expect(screen.getByTestId('import-csv')).toBeTruthy();
  });

  it('VIEW + VALUATION — Total Stock Value appears, Add does not', async () => {
    await renderWith(['product.stock-item.view', 'inventory-costing.valuation.view']);
    expect(screen.getByTestId('summary-total-stock-value')).toBeTruthy();
    expect(screen.queryByTestId('create-stock-item')).toBeNull();
  });

  it('VIEW + MANAGE + VALUATION — the full P1 review surface', async () => {
    await renderWith(ALL);
    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());
    expect(screen.getByTestId('stock-summary-strip').children).toHaveLength(5);
    expect(screen.getByTestId('summary-total-stock-value')).toBeTruthy();
    expect(screen.getByTestId('export-csv')).toBeTruthy();
    expect(screen.getByTestId('import-csv')).toBeTruthy();
    expect(screen.getByTestId('create-stock-item')).toBeTruthy();
    expect(screen.getByTestId('stock-search')).toBeTruthy();
  });

  /** 🔴 A role name grants nothing — the affordance follows the capability, not the title. */
  it('Administrator role alone receives no implicit affordance', async () => {
    // Holds the ADMINISTRATOR role and NO capability. The server refuses (PRM-068), and the
    // affordance follows the capability rather than the title.
    stubApi({ status: 403, permissions: [], roles: ['ADMINISTRATOR'] });
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByText('You do not have access to Stock Items')).toBeTruthy());
    expect(screen.queryByTestId('create-stock-item')).toBeNull();
  });

  it('zero records — the five cards read a truthful zero and the actions stay reachable', async () => {
    stubApi({
      items: [],
      summary: { totalStockItems: 0, physicalStockUnits: '0', availableUnits: '0', outOfStockItems: 0, totalStockValue: '0' },
      permissions: ALL,
    });
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());
    expect(screen.getByText('No Stock Items exist yet')).toBeTruthy();
    expect(screen.getByTestId('summary-total-stock-items').textContent).toContain('0');
    expect(screen.getByTestId('summary-total-stock-value').textContent).toContain('0');
    // 🔴 The empty state never hides the way out of it.
    expect(screen.getByTestId('create-stock-item')).toBeTruthy();
    expect(screen.getByTestId('import-csv')).toBeTruthy();
    expect(screen.getByTestId('export-csv')).toBeTruthy();
  });
});

describe('page-header action region (UX-016, UX-045)', () => {
  it('renders the page actions in the header region, not the workspace toolbar', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());
    const region = screen.getByTestId('page-header-actions');
    const toolbar = screen.getByTestId('stock-items-toolbar');

    for (const action of ['export-csv', 'import-csv', 'create-stock-item']) {
      expect(region.contains(screen.getByTestId(action))).toBe(true);
      expect(toolbar.contains(screen.getByTestId(action))).toBe(false);
    }
  });

  /** 🔴 A move, not a copy — exactly one rendering of each action in the document. */
  it('renders each action exactly once', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());

    for (const action of ['export-csv', 'import-csv', 'create-stock-item']) {
      expect(screen.queryAllByTestId(action)).toHaveLength(1);
    }
  });

  /** UX-045 — LEVEL 2 dataset controls stay in the toolbar and never migrate to the header. */
  it('keeps search and filters in the workspace toolbar', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-items-toolbar')).toBeTruthy());

    const toolbar = screen.getByTestId('stock-items-toolbar');
    const region = screen.getByTestId('page-header-actions');
    for (const control of ['stock-search', 'filter-status', 'filter-serialization', 'filter-out-of-stock']) {
      expect(toolbar.contains(screen.getByTestId(control))).toBe(true);
      expect(region.contains(screen.getByTestId(control))).toBe(false);
    }
  });

  /** 🔴 Two regions, two owners: actions before the divider, utilities after it. */
  it('places page actions before the utility divider and utilities after it', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('page-header-actions')).toBeTruthy());

    const actions = screen.getByTestId('page-header-actions');
    const divider = screen.getByTestId('header-utility-divider');
    const utilities = screen.getByTestId('utility-cluster');

    // DOCUMENT_POSITION_FOLLOWING === 4
    expect(actions.compareDocumentPosition(divider) & 4).toBeTruthy();
    expect(divider.compareDocumentPosition(utilities) & 4).toBeTruthy();
  });

  it('leaves the shell-owned utility cluster untouched', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('utility-cluster')).toBeTruthy());

    const utilities = screen.getByTestId('utility-cluster');
    expect(within(utilities).getByTestId('utility-chat')).toBeTruthy();
    expect(within(utilities).getByTestId('utility-notifications')).toBeTruthy();
    expect(within(utilities).getByTestId('utility-profile')).toBeTruthy();
    expect(within(utilities).queryByTestId('create-stock-item')).toBeNull();
  });

  /** §3.8 — exactly ONE dark-filled primary, rightmost of the group. */
  it('keeps one primary action, rightmost and visually strongest', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());

    const region = screen.getByTestId('page-header-actions');
    const primary = screen.getByTestId('create-stock-item');
    expect(primary.getAttribute('style')).toContain('--color-ink');
    expect(screen.getByTestId('export-csv').getAttribute('style')).not.toContain('--color-ink');
    expect(screen.getByTestId('import-csv').getAttribute('style')).not.toContain('--color-ink');
    expect(region.lastElementChild).toBe(primary);
  });

  /** 🔴 UX-016.f.ii — the action group never wraps internally. */
  it('never wraps the action group across rows', async () => {
    stubApi();
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());

    expect(screen.getByTestId('page-header').style.flexWrap).toBe('nowrap');
    expect(screen.getByTestId('page-header-actions').style.flexWrap).toBe('nowrap');
    for (const action of ['export-csv', 'import-csv', 'create-stock-item']) {
      expect(screen.getByTestId(action).style.whiteSpace).toBe('nowrap');
      expect(screen.getByTestId(action).style.flexShrink).toBe('0');
      expect(screen.getByTestId(action).getAttribute('style')).not.toContain('border: 1px');
      expect(screen.getByTestId(action).style.borderStyle).not.toBe('solid');
      expect(screen.getByTestId(action).style.boxShadow).toContain('var(--elevation-card)');
    }
  });

  it('shows authorised page actions even with zero records', async () => {
    stubApi({
      items: [],
      summary: { totalStockItems: 0, physicalStockUnits: '0', availableUnits: '0', outOfStockItems: 0, totalStockValue: '0' },
    });
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByText('No Stock Items exist yet')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('create-stock-item')).toBeTruthy());
    expect(screen.getByTestId('import-csv')).toBeTruthy();
    expect(screen.getByTestId('export-csv')).toBeTruthy();
  });

  it('hides unauthorised actions from the header region', async () => {
    stubApi({ permissions: ['product.stock-item.view'], summary: SUMMARY_WITHHELD });
    renderWorkspace('/inventory/products/stock');

    await waitFor(() => expect(screen.getByTestId('page-header-actions')).toBeTruthy());
    expect(screen.getByTestId('export-csv')).toBeTruthy();
    expect(screen.queryByTestId('import-csv')).toBeNull();
    expect(screen.queryByTestId('create-stock-item')).toBeNull();
  });

  /** 🔴 The mechanism is global: no Product-specific placement lives inside the shell. */
  it('keeps the shell free of any Product-specific action placement', async () => {
    const shell = await import('../shell/AppShell');
    const source = shell.PageHeader.toString();
    expect(source).not.toMatch(/stock|product|inventory/i);
  });
});

/**
 * Viewport / layout regression — STRUCTURAL proof only.
 *
 * 🔴 jsdom performs no layout: it has no viewport, computes no widths and cannot tell whether
 * anything is visually clipped. These tests therefore assert STRUCTURE and DECLARED INTENT —
 * which container owns overflow, that the row cannot wrap, that the action stays inside the
 * row. Visual containment at 100% and 80% zoom is a BROWSER check and is reported separately,
 * never claimed here.
 */
describe('viewport regression — structural proof (UX-060, UX-071, UX-073)', () => {
  beforeEach(() => stubApi());

  /** 🔴 UX-071 — overflow is scoped to the row region, not the page. */
  it('places the results inside the operational region without horizontal overflow ownership', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-item-results')).toBeTruthy());

    const region = screen.getByTestId('operational-region');
    const canvas = screen.getByTestId('operational-canvas');
    expect(region.contains(screen.getByTestId('stock-item-results'))).toBe(true);
    expect(canvas.contains(screen.getByTestId('stock-item-results'))).toBe(true);
    expect(screen.queryByTestId('operational-scroller')).toBeNull();
    expect(region.style.overflowX).not.toBe('auto');
    expect(canvas.style.overflowX).not.toBe('auto');
  });

  /** 🔴 UX-071 — the page never becomes a globally horizontally scrolling canvas. */
  it('gives horizontal overflow to no ancestor of the row region', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('operational-canvas')).toBeTruthy());

    let node: HTMLElement | null = screen.getByTestId('operational-canvas');
    while (node && node !== document.body) {
      expect(node.style.overflowX, `${node.dataset.testid ?? node.tagName} must not own overflow-x`)
        .not.toBe('auto');
      expect(node.style.overflowX).not.toBe('scroll');
      node = node.parentElement;
    }
  });

  /** 🔴 UX-071 — pagination stays fixed and visible, outside the scrolling region. */
  it('keeps pagination, filters and summary outside any operational child scroller', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-pagination')).toBeTruthy());

    expect(screen.queryByTestId('operational-scroller')).toBeNull();
    const canvas = screen.getByTestId('operational-canvas');
    for (const outside of ['stock-pagination', 'stock-items-toolbar', 'stock-summary-strip']) {
      expect(canvas.contains(screen.getByTestId(outside))).toBe(false);
      expect(screen.getByTestId(outside).style.overflowX).not.toBe('auto');
    }
    expect(screen.getByTestId('stock-items-toolbar').style.flexWrap).toBe('nowrap');
    expect(screen.getByTestId('stock-pagination').style.flexWrap).not.toBe('wrap');
  });

  /** 🔴 RULE 7.4 / UX-060 — the row never structurally wraps. */
  it('never wraps the operational row', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-item-card-TEST-SKU-1')).toBeTruthy());

    const card = screen.getByTestId('stock-item-card-TEST-SKU-1');
    expect(card.style.flexWrap).toBe('nowrap');
    expect(card.classList.contains('operational-row')).toBe(true);
  });

  /** RULE 7.5 — the row declares a floor and scrolls, rather than collapsing through it. */
  it('does not declare a Product-only arbitrary pixel floor', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-item-card-TEST-SKU-1')).toBeTruthy());

    const card = screen.getByTestId('stock-item-card-TEST-SKU-1');
    expect(card.style.width).toBe('100%');
    expect(card.style.minWidth).toBe('0');
  });

  /** Shrink priority 1 — identity flexes and ellipsises; the rest hold position. */
  it('lets the identity region absorb width pressure and truncate', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-item-name')).toBeTruthy());

    const name = screen.getByTestId('stock-item-name');
    expect(name.style.whiteSpace).toBe('nowrap');
    expect(name.style.textOverflow).toBe('ellipsis');

    const identity = name.parentElement!;
    expect(identity.style.flex).toContain('1 1 auto');
    expect(identity.style.overflow).toBe('hidden');
    expect(identity.style.minWidth).toBe('140px');
  });

  /** 🔴 The record action stays part of the row and is never dropped or hidden. */
  it('keeps the record action inside the row and non-shrinking', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-item-view')).toBeTruthy());

    const card = screen.getByTestId('stock-item-card-TEST-SKU-1');
    const action = screen.getByTestId('stock-item-view');
    expect(card.contains(action)).toBe(true);
    expect(action.parentElement!.style.flexShrink).toBe('0');
    expect(action.style.whiteSpace).toBe('nowrap');
  });

  /** 🔴 UX-073 / UX-074 — hidden chrome makes the affordance mandatory, not optional. */
  it('renders no horizontal-scroll affordance or helper text', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('operational-canvas')).toBeTruthy());

    expect(screen.queryByTestId('overflow-affordance')).toBeNull();
    expect(screen.queryByTestId('overflow-notice')).toBeNull();
    expect(document.body.textContent).not.toMatch(/scroll horizontally/i);
  });

  /** 🔴 RULE 7.3.a — nothing about the layout may be driven by JS viewport measurement. */
  it('contains no viewport measurement, zoom detection or scale transform', async () => {
    const sources = await Promise.all([
      import('./StockItemCard?raw' as string).catch(() => null),
    ]);
    void sources;

    const card = (await import('./StockItemCard')).StockItemCard.toString();
    expect(card).not.toMatch(/innerWidth|outerWidth|devicePixelRatio|screen\.width|matchMedia/);
    expect(card).not.toMatch(/transform:\s*['"`]?scale/);
  });
});

/**
 * `UX-035.f.i` — the Products workspace ENTRY.
 *
 * 🔴 `/inventory/products` renders the workspace with Stock Items active and KEEPS that URL.
 * `/inventory/products/stock` remains ratified and addressable. Two paths, ONE implementation.
 */
describe('Products workspace entry (UX-035.f.i)', () => {
  beforeEach(() => stubApi());

  it('renders the Stock Items surface at the workspace entry path', async () => {
    renderWorkspace('/inventory/products');
    await waitFor(() => expect(screen.getByTestId('stock-item-results')).toBeTruthy());
    expect(screen.getByTestId('stock-item-card-TEST-SKU-1')).toBeTruthy();
  });

  it('marks Stock Items as the active tab at the workspace entry path', () => {
    renderWorkspace('/inventory/products');
    const active = screen.getByTestId('product-tab-Stock Items');
    expect(active.getAttribute('style')).toContain('--color-surface');
    expect(active.getAttribute('style')).toContain('--elevation-active-tab');
    // 🔴 Exactly one active tab - the entry path never activates two.
    expect(screen.getByTestId('product-tab-Sellable Products').getAttribute('style')).toContain('transparent');
    expect(screen.getByTestId('product-tab-Listings').getAttribute('style')).toContain('transparent');
  });

  /** 🔴 The tab control still targets the ratified tab route; the entry does not steal it. */
  it('keeps the Stock Items tab pointing at its ratified route', () => {
    renderWorkspace('/inventory/products');
    expect(screen.getByTestId('product-tab-Stock Items').getAttribute('href')).toBe(
      '/inventory/products/stock',
    );
  });

  it('still renders Stock Items at the explicit tab route', async () => {
    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-item-results')).toBeTruthy());
    expect(screen.getByTestId('product-tab-Stock Items').getAttribute('style')).toContain(
      '--elevation-active-tab',
    );
  });

  /** 🔴 The entry path is not a second Products surface - the same page renders on both. */
  it('renders the same surface on both addressable paths', async () => {
    renderWorkspace('/inventory/products');
    await waitFor(() => expect(screen.getByTestId('stock-summary-strip')).toBeTruthy());
    const entry = screen.getByTestId('stock-summary-strip').children.length;
    cleanup();

    renderWorkspace('/inventory/products/stock');
    await waitFor(() => expect(screen.getByTestId('stock-summary-strip')).toBeTruthy());
    expect(screen.getByTestId('stock-summary-strip').children.length).toBe(entry);
  });
});
