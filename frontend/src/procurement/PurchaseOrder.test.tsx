import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import PurchasingPage from './PurchasingPage';
import PurchaseOrderDetailPage from './PurchaseOrderDetailPage';
import PurchaseOrderFormPage from './PurchaseOrderFormPage';
import PurchaseOrderPrintPage from './PurchaseOrderPrintPage';
import { whatsAppNumber } from './purchaseOrderPdf';
import SupplierLedgerPage from './SupplierLedgerPage';
import { lineTotal, sumTotals } from './purchaseApi';

/** Purchase Orders - exact money arithmetic, the list, the lifecycle actions and the capability gates. */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ORDER = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'p1', poNumber: 'PO-2026-0001', supplierId: 's1', supplierName: 'Star Tech Ltd', orderDate: '2026-10-06', expectedDate: null,
  currency: 'BDT', supplierOrderReference: null, status: 'DRAFT', lines: 1, total: '7000.0000', supplierShipped: false, amendable: true,
  createdBy: 'mithun', approvedBy: null, cancellable: true, linesReceived: 0, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z', version: 1, ...over,
});
const DETAIL = (order: Record<string, unknown>) => ({
  order,
  items: [{ id: 'i1', lineNumber: 1, productVariantId: 'v1', sku: 'SKU-1', name: 'SSD 512GB', quantityOrdered: '10.0000', quantityReceived: '0.0000',
    unitCost: '700.0000', lineTotal: '7000.0000', currency: 'BDT', expectedDate: null }],
  supplier: { name: 'Star Tech Ltd', contactName: 'Ashraful', phone: '01711-204488', email: null, address: 'Dhaka' },
  history: [{ action: 'CREATED', reason: null, detail: null, actedBy: 'mithun', actedAt: '2026-10-06T00:00:00Z' }],
});

function stub(permissions: string[], order: Record<string, unknown>, calls: string[] = []): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/api/auth/me')) return json({ id: 'u', username: 'm', fullName: 'M', roles: [], permissions });
    if (url.includes('/api/auth/csrf')) return new Response(null, { status: 204 });
    if (init?.method === 'POST') return new Response(null, { status: 204 });
    if (url.includes('/api/product/stock-items')) return json({ content: [{ id: 'v1', inventorySku: 'SKU-1', technicalName: 'SSD 512GB', inventoryCategory: 'SSD', physicalStock: '3', availableQuantity: '3', outOfStock: false, discontinued: false, recordStatus: 'DRAFT', referenceCost: '700.0000' }], totalElements: 1, page: 0, size: 8, totalPages: 1 });
    if (/suppliers\/s1\/ledger/.test(url)) return json({ supplier: { id: 's1', name: 'Star Tech Ltd', contactName: 'Ashraful', phone: '01711-204488', email: null, address: 'Dhaka', currency: 'BDT' }, from: null, to: null, orders: 1, totalOrdered: '7000.0000', outstandingBalance: null,
      entries: [{ date: '2026-10-06', type: 'PURCHASE_ORDER', reference: 'PO-2026-0001', documentId: 'p1', description: 'Purchase order - commitment, not yet owed', status: 'APPROVED', memo: true, debit: null, credit: null, ordered: '7000.0000' }] });
    if (url.includes('/api/procurement/suppliers')) return json({ content: [], totalElements: 0, page: 0, size: 100, totalPages: 1, kpis: {} });
    if (/purchase-orders\/p1/.test(url)) return json(DETAIL(order));
    if (url.includes('/api/procurement/purchase-orders'))
      return json({ content: [order], totalElements: 1, page: 0, size: 10, totalPages: 1, kpis: { orders: 1, open: 1, awaitingApproval: 1, amendable: 1, cancelled: 0 } });
    return json({});
  }));
}

function renderAt(path: string): void {
  render(
    <AuthProvider>
      <PageActionsProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/purchasing/purchases" element={<PurchasingPage tab="orders" />} />
            <Route path="/purchasing/purchases/new" element={<PurchaseOrderFormPage mode="create" />} />
            <Route path="/purchasing/purchases/:id" element={<PurchaseOrderDetailPage />} />
            <Route path="/purchasing/purchases/:id/print" element={<PurchaseOrderPrintPage />} />
            <Route path="/purchasing/suppliers/:id/ledger" element={<SupplierLedgerPage />} />
            <Route path="/purchasing/receipts" element={<PurchasingPage tab="receipts" />} />
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

describe('Purchase Order arithmetic', () => {
  it('computes line and order totals exactly, never through a floating point number', () => {
    expect(lineTotal('3', '0.1')).toBe('0.3');
    expect(lineTotal('10', '700.50')).toBe('7005');
    expect(lineTotal('abc', '1')).toBeNull();
    expect(sumTotals(['0.1', '0.2'])).toBe('0.3');
    expect(sumTotals(['1', null])).toBeNull();
  });
});

describe('Purchase Orders list', () => {
  it('shows the order card and offers New purchase order only to those who may manage', async () => {
    stub(['procurement.purchase-order.view', 'procurement.purchase-order.manage'], ORDER());
    renderAt('/purchasing/purchases');
    expect(await screen.findByTestId('po-card-PO-2026-0001')).toBeTruthy();
    expect(await screen.findByTestId('new-po')).toBeTruthy();
    // It is a page-header action (UX-045), not a toolbar control.
    expect(screen.getByTestId('new-po').closest('[data-testid="master-toolbar"]')).toBeNull();
  });

  it('hides New purchase order without the manage capability', async () => {
    stub(['procurement.purchase-order.view'], ORDER());
    renderAt('/purchasing/purchases');
    await screen.findByTestId('po-card-PO-2026-0001');
    expect(screen.queryByTestId('new-po')).toBeNull();
  });

});

describe('Purchase Order detail', () => {
  it('offers Approve only with the approve capability and posts it', async () => {
    const calls: string[] = [];
    stub(['procurement.purchase-order.view', 'procurement.purchase-order.approve'], ORDER(), calls);
    renderAt('/purchasing/purchases/p1');
    fireEvent.click(await screen.findByTestId('po-approve'));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/p1/approve'))).toBe(true));
    expect(screen.queryByTestId('po-edit')).toBeNull();
  });

  it('does not offer Approve to a manager without the approve capability', async () => {
    stub(['procurement.purchase-order.view', 'procurement.purchase-order.manage'], ORDER());
    renderAt('/purchasing/purchases/p1');
    await screen.findByTestId('po-items');
    expect(screen.queryByTestId('po-approve')).toBeNull();
    expect(screen.getByTestId('po-edit')).toBeTruthy();
  });

  it('offers no amendment once the supplier has shipped, but cancelling stays open until goods arrive', async () => {
    stub(['procurement.purchase-order.view', 'procurement.purchase-order.manage'], ORDER({ status: 'APPROVED', supplierShipped: true, amendable: false }));
    renderAt('/purchasing/purchases/p1');
    await screen.findByTestId('po-items');
    expect(screen.queryByTestId('po-edit')).toBeNull();
    expect(screen.getByTestId('po-cancel')).toBeTruthy();
    expect(screen.queryByTestId('po-shipped')).toBeNull();
  });
});

describe('Purchase Order form', () => {
  it('keeps Create disabled until a supplier and a line exist', async () => {
    stub(['procurement.purchase-order.manage'], ORDER());
    renderAt('/purchasing/purchases/new');
    const save = (await screen.findByTestId('po-save')) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByTestId('po-problem').textContent).toContain('supplier');
  });
  it('never offers discontinued items, shows the taka summary and has no currency choice', async () => {
    const calls: string[] = [];
    stub(['procurement.purchase-order.manage'], ORDER(), calls);
    renderAt('/purchasing/purchases/new');
    expect(screen.queryByTestId('po-currency')).toBeNull();
    fireEvent.change(await screen.findByTestId('po-product-search'), { target: { value: 'ssd' } });
    fireEvent.click(await screen.findByTestId('po-product-result'));
    expect(calls.some((x) => x.includes('/api/product/stock-items') && x.includes('discontinued=false') && !x.includes('status='))).toBe(true);
    fireEvent.change(screen.getByTestId('po-qty-0'), { target: { value: '4' } });
    expect(screen.getByTestId('po-total').textContent).toContain('2800.00');
    expect(screen.getByTestId('po-sum-lines').textContent).toBe('1');
    expect(screen.getByTestId('po-sum-units').textContent).toBe('4');
  });
  it('lists products from the dropdown arrow without typing, and follows the order date with the expected delivery', async () => {
    stub(['procurement.purchase-order.manage'], ORDER());
    renderAt('/purchasing/purchases/new');
    fireEvent.click(await screen.findByTestId('po-product-toggle'));
    expect(await screen.findByTestId('po-product-result')).toBeTruthy();
    fireEvent.change(screen.getByTestId('po-order-date'), { target: { value: '2026-10-20' } });
    expect((screen.getByTestId('po-expected-date') as HTMLInputElement).value).toBe('2026-10-20');
    expect(screen.getByTestId('po-back').textContent).toBe('Back to Purchasing');
  });
  it('renders the printable with its supplier and total, and offers print, PDF and WhatsApp', async () => {
    stub(['procurement.purchase-order.view'], ORDER());
    renderAt('/purchasing/purchases/p1/print');
    expect((await screen.findByTestId('po-sheet-number')).textContent).toBe('PO-2026-0001');
    expect(screen.getByTestId('po-sheet').textContent).toContain('Star Tech Ltd');
    expect(screen.getByTestId('po-sheet').textContent).toContain('7000.00');
    for (const id of ['po-print', 'po-download-pdf', 'po-share-whatsapp']) expect(screen.getByTestId(id)).toBeTruthy();
  });

  it('turns a saved Bangladeshi number into a WhatsApp number', () => {
    expect(whatsAppNumber('01711-204488')).toBe('8801711204488');
    expect(whatsAppNumber('+880 1711 204488')).toBe('8801711204488');
    expect(whatsAppNumber(null)).toBeNull();
    expect(whatsAppNumber('12')).toBeNull();
  });
  it('shows the supplier ledger with a withheld balance, refetches on a filter and prints what the filters select', async () => {
    const calls: string[] = [];
    stub(['procurement.supplier.view'], ORDER(), calls);
    renderAt('/purchasing/suppliers/s1/ledger');
    expect(await screen.findByTestId('ledger-row')).toBeTruthy();
    expect(screen.getByTestId('master-kpi-balance').textContent).toContain('—');
    expect(screen.getByTestId('ledger-print')).toBeTruthy();
    fireEvent.change(screen.getByTestId('ledger-from'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(calls.some((c) => c.includes('/ledger?') && c.includes('from=2026-10-01'))).toBe(true));
    await waitFor(() => expect(screen.getByTestId('ledger-sheet-filters').textContent).toContain('2026-10-01'));
    expect(screen.getAllByTestId('ledger-sheet-row')).toHaveLength(1);
  });
});
