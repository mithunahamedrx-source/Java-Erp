import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import PurchasingPage from './PurchasingPage';
import GoodsReceiptFormPage from './GoodsReceiptFormPage';
import GoodsReceiptDetailPage from './GoodsReceiptDetailPage';
import { isShort, minQuantity } from './receiptApi';

/** Goods receipts - the list, recording against an order, the separate accept capability, and the receipt record. */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const RECEIPT = {
  id: 'g1', receiptNumber: 'GR-2026-0001', supplierId: 's1', supplierName: 'Star Tech Ltd', purchaseOrderId: 'p1', poNumber: 'PO-2026-0001',
  receivedDate: '2026-10-07', supplierInvoiceReference: 'INV-77', lines: 1, unitsReceived: '6.0000', unitsAccepted: '5.0000', hasIssues: true,
  acceptedValue: '3500.0000', currency: 'BDT', recordedBy: 'Mithun', acceptedBy: 'Mithun', recordedAt: '2026-10-07T00:00:00Z',
};

function stub(permissions: string[], calls: string[] = []): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url} ${typeof init?.body === 'string' ? init.body : ''}`.trim());
    if (url.includes('/api/auth/me')) return json({ id: 'u', username: 'm', fullName: 'M', roles: [], permissions });
    if (url.includes('/api/auth/csrf')) return new Response(null, { status: 204 });
    if (init?.method === 'POST') return json({ id: 'g1' }, 201);
    if (url.includes('/goods-receipts/receivable-orders')) return json([{ id: 'p1', poNumber: 'PO-2026-0001', supplierId: 's1', supplierName: 'Star Tech Ltd', orderDate: '2026-10-06', status: 'APPROVED' }]);
    if (url.includes('/goods-receipts/order-lines/p1')) return json([{ purchaseOrderItemId: 'i1', lineNumber: 1, productVariantId: 'v1', sku: 'SKU-1', name: 'SSD 512GB', ordered: '10.0000', accepted: '4.0000', remaining: '6.0000', unitCost: '700.0000' }]);
    if (url.includes('/goods-receipts/g1')) return json({ receipt: RECEIPT, warehouseName: 'Main Warehouse', note: null, items: [{ id: 'x', lineNumber: 1, productVariantId: 'v1', sku: 'SKU-1', name: 'SSD 512GB', poLineNumber: 1, quantityReceived: '6.0000', quantityAccepted: '5.0000', unitCost: '700.0000', acceptedValue: '3500.0000', discrepancyType: 'DAMAGED', discrepancyNote: 'Box crushed' }] });
    if (url.includes('/api/procurement/goods-receipts')) return json({ content: [RECEIPT], totalElements: 1, page: 0, size: 10, totalPages: 1, kpis: { receipts: 1, lines: 1, unitsAccepted: '5.0000', withIssues: 1 } });
    if (url.includes('/api/procurement/suppliers')) return json({ content: [{ id: 's1', name: 'Star Tech Ltd', contactName: 'A', phone: '017', email: null, address: null, currency: 'BDT', externalReference: null, activeFrom: null, activeUntil: null, recordStatus: 'ACTIVE', createdAt: '', updatedAt: '', version: 1 }], totalElements: 1, page: 0, size: 100, totalPages: 1, kpis: {} });
    if (url.includes('/api/warehouse/warehouses')) return json({ content: [], totalElements: 0, page: 0, size: 50, totalPages: 1, kpis: {} });
    return json({});
  }));
}

function renderAt(path: string): void {
  render(
    <AuthProvider>
      <PageActionsProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/purchasing/receipts" element={<PurchasingPage tab="receipts" />} />
            <Route path="/purchasing/receipts/new" element={<GoodsReceiptFormPage />} />
            <Route path="/purchasing/receipts/:id" element={<GoodsReceiptDetailPage />} />
          </Routes>
        </MemoryRouter>
      </PageActionsProvider>
    </AuthProvider>,
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Goods receipt arithmetic', () => {
  it('compares quantities exactly', () => {
    expect(minQuantity('6', '4.5')).toBe('4.5');
    expect(isShort('6', '5')).toBe(true);
    expect(isShort('6', '6.0000')).toBe(false);
  });
});

describe('Goods Receipts list', () => {
  it('shows the receipt card with its discrepancy and a header action only to those who may record', async () => {
    stub(['procurement.goods-receipt.view', 'procurement.goods-receipt.record']);
    renderAt('/purchasing/receipts');
    expect(await screen.findByTestId('gr-card-GR-2026-0001')).toBeTruthy();
    expect(screen.getByTestId('gr-card-GR-2026-0001').textContent).toContain('DISCREPANCY');
    expect(await screen.findByTestId('new-receipt')).toBeTruthy();
  });

  it('offers no way to record to someone who may only view', async () => {
    stub(['procurement.goods-receipt.view']);
    renderAt('/purchasing/receipts');
    await screen.findByTestId('gr-card-GR-2026-0001');
    expect(screen.queryByTestId('new-receipt')).toBeNull();
  });
});

describe('Record goods received', () => {
  it('brings the order\'s lines at what is still to come and records them', async () => {
    const calls: string[] = [];
    stub(['procurement.goods-receipt.view', 'procurement.goods-receipt.record', 'procurement.goods-receipt.accept'], calls);
    renderAt('/purchasing/receipts/new?order=p1');
    expect(await screen.findByTestId('gr-line')).toBeTruthy();
    await waitFor(() => expect((screen.getByTestId('gr-accepted-0') as HTMLInputElement).value).toBe('6'));
    expect((screen.getByTestId('gr-received-0') as HTMLInputElement).value).toBe('6');
    expect(screen.getByTestId('gr-total').textContent).toContain('4200.00');
    await waitFor(() => expect((screen.getByTestId('gr-save') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('gr-save'));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST') && c.includes('"purchaseOrderId":"p1"') && c.includes('"quantityAccepted":"6"'))).toBe(true));
  });

  it('asks why goods are not accepted before it will record them', async () => {
    stub(['procurement.goods-receipt.record', 'procurement.goods-receipt.accept']);
    renderAt('/purchasing/receipts/new?order=p1');
    await screen.findByTestId('gr-line');
    await waitFor(() => expect((screen.getByTestId('gr-accepted-0') as HTMLInputElement).value).toBe('6'));
    fireEvent.change(screen.getByTestId('gr-accepted-0'), { target: { value: '5' } });
    expect(await screen.findByTestId('gr-issue-0')).toBeTruthy();
    expect((screen.getByTestId('gr-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('gr-discrepancy-0'), { target: { value: 'DAMAGED' } });
    expect((screen.getByTestId('gr-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('fixes accepted at zero for someone who may record but not accept', async () => {
    stub(['procurement.goods-receipt.record']);
    renderAt('/purchasing/receipts/new?order=p1');
    await screen.findByTestId('gr-line');
    const accepted = screen.getByTestId('gr-accepted-0') as HTMLInputElement;
    expect(accepted.value).toBe('0');
    expect(accepted.disabled).toBe(true);
  });
});

describe('Goods receipt record', () => {
  it('shows what was received, accepted and held, and why', async () => {
    stub(['procurement.goods-receipt.view']);
    renderAt('/purchasing/receipts/g1');
    expect(await screen.findByTestId('gr-item')).toBeTruthy();
    expect(screen.getByTestId('gr-item-issue').textContent).toContain('Damaged');
    expect(screen.getByTestId('gr-items').textContent).toContain('3500.00');
  });
});
