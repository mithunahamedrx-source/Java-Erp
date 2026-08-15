import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ProductWorkspace from './ProductWorkspace';
import SellableProductFormPage from './SellableProductFormPage';
import SellableProductsPage from './SellableProductsPage';
import { SellableProductCard } from './SellableProductCard';
import type { SellableProduct, SellableProductSummary } from './sellableProductApi';

const SIMPLE: SellableProduct = {
  id: '11111111-1111-1111-1111-111111111111',
  sellableSku: 'SEL-SIMPLE-1',
  name: 'Simple sellable product',
  nature: 'SIMPLE',
  description: null,
  sellableCategory: 'Components',
  warrantyPackage: null,
  recordStatus: 'ACTIVE',
  simpleTargetVariantId: '22222222-2222-2222-2222-222222222222',
  simpleTargetInventorySku: 'INV-RAM-1',
  simpleTargetTechnicalName: 'RAM module',
  simpleQuantityPerSaleUnit: '2',
  assembledFinishedVariantId: null,
  assembledFinishedInventorySku: null,
  assembledFinishedTechnicalName: null,
  activeBuildTemplateId: null,
  activeBuildTemplateVersion: null,
  buildTemplateRequiredLineCount: null,
  bundleMemberCount: null,
  availableSaleUnits: '4',
  availabilityConstrainedBy: 'INV-RAM-1',
  availabilityUnresolvedReason: null,
  updatedAt: '2026-08-11T00:00:00Z',
  version: 0,
};

const ASSEMBLED: SellableProduct = {
  ...SIMPLE,
  id: '33333333-3333-3333-3333-333333333333',
  sellableSku: 'SEL-ASSEMBLED-1',
  name: 'Assembled sellable product',
  nature: 'ASSEMBLED',
  simpleTargetVariantId: null,
  simpleTargetInventorySku: null,
  simpleTargetTechnicalName: null,
  simpleQuantityPerSaleUnit: null,
  assembledFinishedVariantId: '66666666-6666-6666-6666-666666666666',
  assembledFinishedInventorySku: 'INV-PC-FIN',
  assembledFinishedTechnicalName: 'Finished gaming PC',
  activeBuildTemplateId: '44444444-4444-4444-4444-444444444444',
  activeBuildTemplateVersion: 3,
  buildTemplateRequiredLineCount: 2,
  availableSaleUnits: '7',
  availabilityConstrainedBy: 'INV-PC-FIN',
  availabilityUnresolvedReason: null,
};

const BUNDLE: SellableProduct = {
  ...SIMPLE,
  id: '55555555-5555-5555-5555-555555555555',
  sellableSku: 'SEL-BUNDLE-1',
  name: 'Bundle sellable product',
  nature: 'BUNDLE',
  simpleTargetVariantId: null,
  simpleTargetInventorySku: null,
  simpleTargetTechnicalName: null,
  simpleQuantityPerSaleUnit: null,
  activeBuildTemplateId: null,
  activeBuildTemplateVersion: null,
  buildTemplateRequiredLineCount: null,
  bundleMemberCount: 2,
  availableSaleUnits: '1',
  availabilityConstrainedBy: 'SEL-SIMPLE-1',
};

const SUMMARY: SellableProductSummary = {
  totalSellableProducts: 3,
  simpleCount: 1,
  assembledCount: 1,
  bundleCount: 1,
  activeSellableProducts: 2,
};

const VIEW = ['product.sellable-product.view'];
const MANAGE = ['product.sellable-product.view', 'product.sellable-product.manage'];

function stubApi(options: {
  items?: readonly SellableProduct[];
  summary?: SellableProductSummary;
  permissions?: readonly string[];
  status?: number;
} = {}): void {
  const items = options.items ?? [SIMPLE, ASSEMBLED, BUNDLE];
  const summary = options.summary ?? SUMMARY;
  const permissions = options.permissions ?? MANAGE;

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/auth/me')) {
      return new Response(JSON.stringify({
        id: 'dev',
        username: 'devuser',
        fullName: 'Dev User',
        roles: [],
        permissions,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (options.status && options.status !== 200) {
      return new Response(JSON.stringify({ error: 'FORBIDDEN', message: 'denied' }), {
        status: options.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/summary')) {
      return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/sellable-products')) {
      return new Response(JSON.stringify({
        content: items,
        page: 0,
        size: 50,
        totalElements: items.length,
        totalPages: 1,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
}

function renderWorkspace(path = '/inventory/products/sellable'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products" element={<ProductWorkspace />}>
              <Route path="sellable" element={<SellableProductsPage />} />
            </Route>
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

describe('Sellable Products workspace', () => {
  it('renders the functional Sellable Products tab and keeps Listings addressable', async () => {
    stubApi();
    renderWorkspace();

    const tabs = screen.getByTestId('product-entity-tabs');
    expect(within(tabs).getByTestId('product-tab-Stock Items')).toBeTruthy();
    expect(within(tabs).getByTestId('product-tab-Sellable Products').getAttribute('style')).toContain(
      '--elevation-active-tab',
    );
    expect(within(tabs).getByTestId('product-tab-Listings').getAttribute('href')).toBe(
      '/inventory/products/listings',
    );

    await waitFor(() => expect(screen.getByTestId('sellable-product-results')).toBeTruthy());
    expect(within(tabs).getByTestId('product-tab-Listings')).toBeTruthy();
  });

  it('renders exactly the ratified five operational summary facts', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('sellable-summary-strip')).toBeTruthy());
    const strip = screen.getByTestId('sellable-summary-strip');
    expect(strip.children).toHaveLength(5);
    expect(screen.getByTestId('summary-total-sellable-products').textContent).toContain('Total Sellable Products');
    expect(screen.getByTestId('summary-simple-count').textContent).toContain('SIMPLE');
    expect(screen.getByTestId('summary-assembled-count').textContent).toContain('ASSEMBLED');
    expect(screen.getByTestId('summary-bundle-count').textContent).toContain('BUNDLE');
    expect(screen.getByTestId('summary-active-sellable-products').textContent).toContain('Active Sellable Products');
    expect(strip.querySelectorAll('svg')).toHaveLength(0);
    expect(strip.textContent).not.toMatch(/%|trend|revenue|margin/i);
  });

  it('uses cards, not tables, and renders nature-specific resolution semantics', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('sellable-product-results')).toBeTruthy());
    expect(document.querySelectorAll('table, thead, tbody, tr, td')).toHaveLength(0);
    expect(screen.getByTestId('sellable-product-card-SEL-SIMPLE-1')).toBeTruthy();
    expect(screen.getByTestId('sellable-product-card-SEL-ASSEMBLED-1')).toBeTruthy();
    expect(screen.getByTestId('sellable-product-card-SEL-BUNDLE-1')).toBeTruthy();

    expect(screen.getByTestId('resolution-simple').textContent).toContain('INV-RAM-1');
    expect(screen.getByTestId('resolution-simple').textContent).toContain('2');
    expect(screen.getByTestId('resolution-assembled').textContent).toContain('v3');
    expect(screen.getByTestId('resolution-assembled').textContent).toContain('INV-PC-FIN');
    expect(screen.getByTestId('resolution-assembled').textContent).toContain('2 required components');
    expect(screen.getByTestId('resolution-bundle').textContent).toContain('2 members');
    expect(screen.getByTestId('sellable-product-card-SEL-ASSEMBLED-1').textContent).toContain('7');
  });

  it('keeps page actions in the header and gates manage-only affordances', async () => {
    stubApi({ permissions: VIEW });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('sellable-products-toolbar')).toBeTruthy());
    expect(screen.getByTestId('sellable-export-csv')).toBeTruthy();
    expect(screen.queryByTestId('sellable-import-csv')).toBeNull();
    expect(screen.queryByTestId('create-sellable-product')).toBeNull();
    cleanup();

    stubApi({ permissions: MANAGE });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('create-sellable-product')).toBeTruthy());
    const region = screen.getByTestId('page-header-actions');
    const toolbar = screen.getByTestId('sellable-products-toolbar');
    expect(region.contains(screen.getByTestId('sellable-export-csv'))).toBe(true);
    expect(region.contains(screen.getByTestId('sellable-import-csv'))).toBe(true);
    expect(region.contains(screen.getByTestId('create-sellable-product'))).toBe(true);
    expect(toolbar.contains(screen.getByTestId('sellable-search'))).toBe(true);
    expect(toolbar.contains(screen.getByTestId('filter-nature'))).toBe(true);
    expect(toolbar.contains(screen.getByTestId('filter-sellable-status'))).toBe(true);
    expect(screen.getByTestId('create-sellable-product').textContent).toContain('Create Sellable Product');
  });

  it('uses the coherent operational canvas and never wraps a row', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('operational-canvas')).toBeTruthy());
    const region = screen.getByTestId('operational-region');
    const canvas = screen.getByTestId('operational-canvas');
    expect(region.contains(screen.getByTestId('sellable-product-results'))).toBe(true);
    expect(canvas.contains(screen.getByTestId('sellable-product-results'))).toBe(true);
    expect(screen.queryByTestId('operational-scroller')).toBeNull();
    expect(canvas.contains(screen.getByTestId('sellable-summary-strip'))).toBe(false);
    expect(canvas.contains(screen.getByTestId('sellable-products-toolbar'))).toBe(false);
    expect(canvas.contains(screen.getByTestId('sellable-pagination'))).toBe(false);
    expect(screen.getByTestId('sellable-product-card-SEL-SIMPLE-1').style.flexWrap).toBe('nowrap');
  });

  it('distinguishes permission refusal from an empty result', async () => {
    stubApi({ status: 403 });
    renderWorkspace();
    await waitFor(() => expect(screen.getByText('You do not have access to Sellable Products')).toBeTruthy());
    expect(screen.queryByTestId('sellable-product-results')).toBeNull();
  });

  it('renders the ASSEMBLED create relationship to a finished Stock Item', () => {
    stubApi();
    render(
      <MemoryRouter initialEntries={['/inventory/products/sellable/new']}>
        <AuthProvider>
          <PageActionsProvider>
            <Routes>
              <Route path="/inventory/products/sellable/new" element={<SellableProductFormPage mode="create" />} />
            </Routes>
          </PageActionsProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByTestId('field-nature'), { target: { value: 'ASSEMBLED' } });

    expect(screen.getByTestId('field-assembledFinished')).toBeTruthy();
    expect(screen.getByTestId('assembled-note').textContent).toContain('finished Stock Item');
    expect(screen.queryByTestId('field-simpleTarget')).toBeNull();
  });
});

describe('SellableProductCard anatomy', () => {
  it('protects a long name with truncation while keeping fixed operational regions', () => {
    render(
      <MemoryRouter>
        <SellableProductCard item={{ ...SIMPLE, name: 'X'.repeat(300) }} />
      </MemoryRouter>,
    );

    const card = screen.getByTestId('sellable-product-card-SEL-SIMPLE-1');
    const name = screen.getByTestId('sellable-product-name');
    expect(card.classList.contains('operational-row')).toBe(true);
    expect(card.style.flexWrap).toBe('nowrap');
    expect(card.style.width).toBe('100%');
    expect(card.style.minWidth).toBe('0');
    expect(name.style.whiteSpace).toBe('nowrap');
    expect(name.style.textOverflow).toBe('ellipsis');
    expect(screen.getByTestId('sellable-product-view')).toBeTruthy();
  });
});
