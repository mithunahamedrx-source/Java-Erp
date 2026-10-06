import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import SuppliersPage from '../procurement/SuppliersPage';
import WarehousesPage from '../warehouse/WarehousesPage';

/**
 * Suppliers, Warehouses and Stock Locations - the list archetype, the capability gates and the writes. Fixtures exist only
 * inside this file and are served through a stubbed `fetch`.
 */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SUPPLIER = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 's1', name: 'Star Tech Ltd', contactName: 'Ashraful Alam', phone: '01711-204488', email: 'a@example.test', address: 'Dhaka',
  currency: 'BDT', externalReference: 'REF-1', activeFrom: null, activeUntil: null, recordStatus: 'ACTIVE',
  createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z', version: 3, ...over,
});
const WAREHOUSE = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'w1', identifier: 'WH-MAIN', name: 'Main Warehouse', address: 'Dhanmondi 7A', recordStatus: 'ACTIVE', locations: 2,
  quarantineLocations: 1, updatedAt: '2026-10-06T00:00:00Z', version: 1, ...over,
});
const LOCATION = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'l1', warehouseId: 'w1', warehouseName: 'Main Warehouse', identifier: 'MAIN-QUARANTINE', description: 'Returned goods pending QC',
  locationType: 'QUARANTINE', sellable: false, recordStatus: 'ACTIVE', updatedAt: '2026-10-06T00:00:00Z', version: 2, ...over,
});

const page = (content: unknown[], kpis: unknown) => ({ content, totalElements: content.length, page: 0, size: 10, totalPages: 1, kpis });

function stub(options: { permissions: string[]; suppliers?: unknown[]; warehouses?: unknown[]; locations?: unknown[]; forbid?: boolean }, calls: string[] = []): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url} ${typeof init?.body === 'string' ? init.body : ''}`.trim());
    if (url.includes('/api/auth/me')) return json({ id: 'u', username: 'm', fullName: 'M', roles: [], permissions: options.permissions });
    if (url.includes('/api/auth/csrf')) return new Response(null, { status: 204 });
    if (options.forbid) return json({ message: 'denied' }, 403);
    if (init?.method === 'POST') return json({ id: 'new' }, 201);
    if (init?.method === 'PUT') return new Response(null, { status: 204 });
    if (url.includes('/api/procurement/suppliers')) return json(page(options.suppliers ?? [], { suppliers: 48, active: 44, archived: 4 }));
    if (url.includes('/api/warehouse/warehouses')) return json(page(options.warehouses ?? [], { warehouses: 1, active: 1, archived: 0, locations: 2, quarantineLocations: 1 }));
    if (url.includes('/api/warehouse/locations')) return json(page(options.locations ?? [], { locations: 2, storage: 1, quarantine: 1, buildStaging: 0, scrap: 0 }));
    return json({});
  }));
}

function renderAt(path: string): void {
  render(
    <AuthProvider>
      <PageActionsProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/purchasing/suppliers" element={<SuppliersPage />} />
            <Route path="/inventory/warehouses" element={<WarehousesPage tab="warehouses" />} />
            <Route path="/inventory/warehouses/locations" element={<WarehousesPage tab="locations" />} />
          </Routes>
        </MemoryRouter>
      </PageActionsProvider>
    </AuthProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Suppliers', () => {
  it('lists supplier cards with their contact, currency and reference, and the summary strip', async () => {
    stub({ permissions: ['procurement.supplier.view'], suppliers: [SUPPLIER()] });
    renderAt('/purchasing/suppliers');
    await waitFor(() => expect(screen.getByTestId('supplier-card-Star Tech Ltd')).toBeTruthy());
    const card = screen.getByTestId('supplier-card-Star Tech Ltd');
    expect(card.textContent).toContain('Ashraful Alam · 01711-204488');
    expect(card.textContent).toContain('BDT');
    expect(card.textContent).toContain('TOTAL PURCHASE ORDERS');
    expect(card.textContent).toContain('SUPPLIER DUE');
    expect(screen.getByTestId('master-kpi-suppliers').textContent).toContain('48');
    // Derived figures that cannot exist yet are left out, never shown as zero (UX-080, PRC-009).
    expect(card.textContent).not.toMatch(/ADVANCE|PURCHASE HISTORY/);
  });

  it('hides every way to change a supplier from someone who may only view', async () => {
    stub({ permissions: ['procurement.supplier.view'], suppliers: [SUPPLIER()] });
    renderAt('/purchasing/suppliers');
    await waitFor(() => expect(screen.getByTestId('supplier-card-Star Tech Ltd')).toBeTruthy());
    expect(screen.queryByTestId('new-supplier')).toBeNull();
    expect(screen.queryByTestId('record-actions')).toBeNull();
  });

  it('refuses plainly when the viewer lacks the capability', async () => {
    stub({ permissions: [], forbid: true });
    renderAt('/purchasing/suppliers');
    await waitFor(() => expect(screen.getByText('You do not have access to Suppliers')).toBeTruthy());
  });

  it('searches by what is typed, after a pause, and filters by state', async () => {
    const calls: string[] = [];
    stub({ permissions: ['procurement.supplier.view'], suppliers: [SUPPLIER()] }, calls);
    renderAt('/purchasing/suppliers');
    await waitFor(() => expect(screen.getByTestId('supplier-search')).toBeTruthy());
    fireEvent.change(screen.getByTestId('supplier-search'), { target: { value: 'star' } });
    await waitFor(() => expect(calls.some((c) => c.includes('/api/procurement/suppliers?') && c.includes('search=star'))).toBe(true));
    fireEvent.change(screen.getByTestId('supplier-filter-status'), { target: { value: 'ARCHIVED' } });
    await waitFor(() => expect(calls.some((c) => c.includes('status=ARCHIVED'))).toBe(true));
  });

  it('adds a supplier from the dialog, sending only what was typed', async () => {
    const calls: string[] = [];
    stub({ permissions: ['procurement.supplier.view', 'procurement.supplier.manage'], suppliers: [] }, calls);
    renderAt('/purchasing/suppliers');
    await waitFor(() => expect(screen.getByText('No suppliers yet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('new-supplier'));
    await waitFor(() => expect(screen.getByTestId('supplier-dialog')).toBeTruthy());
    fireEvent.change(screen.getByTestId('supplier-name'), { target: { value: 'Ryans Computers' } });
    fireEvent.change(screen.getByTestId('supplier-phone'), { target: { value: '01819-773311' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST') && c.includes('/api/procurement/suppliers'))).toBe(true));
    const post = calls.find((c) => c.startsWith('POST') && c.includes('/api/procurement/suppliers')) ?? '';
    expect(post).toContain('"name":"Ryans Computers"');
    expect(post).toContain('"phone":"01819-773311"');
    expect(post).toContain('"recordStatus":"ACTIVE"');
    await waitFor(() => expect(screen.getByTestId('master-notice').textContent).toContain('Ryans Computers: added.'));
  });

  it('archives a supplier from its menu with the version it was read at, and never deletes', async () => {
    const calls: string[] = [];
    stub({ permissions: ['procurement.supplier.view', 'procurement.supplier.manage'], suppliers: [SUPPLIER()] }, calls);
    renderAt('/purchasing/suppliers');
    await waitFor(() => expect(screen.getByTestId('record-actions')).toBeTruthy());
    fireEvent.click(screen.getByTestId('record-actions'));
    fireEvent.click(screen.getByTestId('supplier-menu-archive'));
    await waitFor(() => expect(calls.some((c) => c.startsWith('PUT') && c.includes('/api/procurement/suppliers/s1'))).toBe(true));
    const put = calls.find((c) => c.startsWith('PUT')) ?? '';
    expect(put).toContain('"recordStatus":"ARCHIVED"');
    expect(put).toContain('"version":3');
    expect(calls.some((c) => c.startsWith('DELETE'))).toBe(false);
  });

  it('fades an archived supplier but keeps its state visible', async () => {
    stub({ permissions: ['procurement.supplier.view'], suppliers: [SUPPLIER({ recordStatus: 'ARCHIVED' })] });
    renderAt('/purchasing/suppliers');
    await waitFor(() => expect(screen.getByTestId('record-state').textContent).toBe('ARCHIVED'));
    expect(screen.getByTestId('record-title').parentElement!.style.opacity).toBe('0.5');
  });
});

describe('Warehouses and Stock Locations', () => {
  it('lists the warehouse with identifier and location counts, and offers both tabs', async () => {
    stub({ permissions: ['warehouse.warehouse.view'], warehouses: [WAREHOUSE()] });
    renderAt('/inventory/warehouses');
    await waitFor(() => expect(screen.getByTestId('warehouse-card-WH-MAIN')).toBeTruthy());
    const card = screen.getByTestId('warehouse-card-WH-MAIN');
    expect(card.textContent).toContain('Main Warehouse');
    expect(card.textContent).toContain('Dhanmondi 7A');
    expect(card.textContent).toContain('WH-MAIN');
    expect(screen.getByTestId('warehouse-tab-locations').getAttribute('href')).toBe('/inventory/warehouses/locations');
    expect(screen.queryByTestId('new-warehouse')).toBeNull();
  });

  it('adds the warehouse from the dialog', async () => {
    const calls: string[] = [];
    stub({ permissions: ['warehouse.warehouse.view', 'warehouse.warehouse.manage'], warehouses: [] }, calls);
    renderAt('/inventory/warehouses');
    await waitFor(() => expect(screen.getByText('No warehouses yet')).toBeTruthy());
    fireEvent.click(await screen.findByTestId('new-warehouse'));
    await waitFor(() => expect(screen.getByTestId('warehouse-dialog')).toBeTruthy());
    fireEvent.change(screen.getByTestId('warehouse-identifier'), { target: { value: 'WH-MAIN' } });
    fireEvent.change(screen.getByTestId('warehouse-name'), { target: { value: 'Main Warehouse' } });
    fireEvent.change(screen.getByTestId('warehouse-address'), { target: { value: 'Dhanmondi 7A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST') && c.includes('/api/warehouse/warehouses'))).toBe(true));
    const post = calls.find((c) => c.startsWith('POST') && c.includes('/api/warehouse/warehouses')) ?? '';
    expect(post).toContain('"identifier":"WH-MAIN"');
    expect(post).toContain('"address":"Dhanmondi 7A"');
  });

  it('shows a quarantine location as never sellable, and filters by type', async () => {
    const calls: string[] = [];
    stub({ permissions: ['warehouse.warehouse.view', 'warehouse.stock-location.view'], warehouses: [WAREHOUSE()], locations: [LOCATION()] }, calls);
    renderAt('/inventory/warehouses/locations');
    await waitFor(() => expect(screen.getByTestId('location-card-MAIN-QUARANTINE')).toBeTruthy());
    const card = screen.getByTestId('location-card-MAIN-QUARANTINE');
    expect(card.textContent).toContain('Quarantine');
    expect(card.textContent).toContain('Never');
    expect(card.textContent).toContain('Physical expression of QC Pending');
    fireEvent.change(screen.getByTestId('location-filter-type'), { target: { value: 'QUARANTINE' } });
    await waitFor(() => expect(calls.some((c) => c.includes('/api/warehouse/locations?') && c.includes('type=QUARANTINE'))).toBe(true));
  });

  it('adds a location inside an active warehouse; the type is chosen once and sellability is not an input', async () => {
    const calls: string[] = [];
    stub({ permissions: ['warehouse.warehouse.view', 'warehouse.stock-location.view', 'warehouse.stock-location.manage'], warehouses: [WAREHOUSE()], locations: [] }, calls);
    renderAt('/inventory/warehouses/locations');
    await waitFor(() => expect(screen.getByText('No stock locations yet')).toBeTruthy());
    fireEvent.click(await screen.findByTestId('new-location'));
    await waitFor(() => expect(screen.getByTestId('location-dialog')).toBeTruthy());
    expect(screen.getByTestId('location-dialog').querySelector('input[type=checkbox]')).toBeNull(); // sellability is never an input
    fireEvent.change(screen.getByTestId('location-identifier'), { target: { value: 'main-storage-a' } });
    fireEvent.change(screen.getByTestId('location-type'), { target: { value: 'STORAGE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST') && c.includes('/api/warehouse/locations'))).toBe(true));
    const post = calls.find((c) => c.startsWith('POST') && c.includes('/api/warehouse/locations')) ?? '';
    expect(post).toContain('"warehouseId":"w1"');
    expect(post).toContain('"locationType":"STORAGE"');
    expect(post).not.toContain('sellable');
  });

  it('refuses plainly when the locations capability is missing', async () => {
    stub({ permissions: ['warehouse.warehouse.view'], forbid: true });
    renderAt('/inventory/warehouses/locations');
    await waitFor(() => expect(screen.getByText('You do not have access to Stock Locations')).toBeTruthy());
  });
});
