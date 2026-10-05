import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import InvoiceBatchPage from './InvoiceBatchPage';

/**
 * Bulk "Print invoices" — several orders, ONE print job, one A4 sheet each (owner, 2026-10-05).
 * An order whose invoice does not exist yet is issued first (BR-192); one that cannot be prepared is named.
 */
const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const invoice = (number: string): unknown => ({
  invoiceNumber: number, issuedAt: '2026-10-05T10:00:00Z', customerName: `Customer ${number}`,
  customerPhone: null, customerAddress: null, externalOrderReference: null, consignmentReference: null,
  subtotal: '100.00', deliveryCharge: null, taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [],
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Print invoices for a selection', () => {
  it('prepares each invoice (issuing a missing one), draws one sheet per order, names one that failed, and prints once', async () => {
    const issued = new Set<string>(['a']);
    const print = vi.fn();
    vi.stubGlobal('print', print);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/auth/me')) {
          return json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: [] }, 200);
        }
        const match = /orders\/([^/]+)\/invoice/.exec(url);
        const id = match?.[1] ?? '';
        if (init?.method === 'POST') {
          if (id === 'c') return json({ message: 'Order c has no lines.' }, 409);
          issued.add(id);
          return json({}, 200);
        }
        if (id === 'c') return json({ message: 'none' }, 404);
        return issued.has(id) ? json(invoice(`TR-${id}`), 200) : json({ message: 'none' }, 404);
      }),
    );
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={[{ pathname: '/sales/orders/invoices', state: { ids: ['a', 'b', 'c'] } }]}>
            <Routes>
              <Route path="/sales/orders/invoices" element={<InvoiceBatchPage />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getAllByTestId('invoice-sheet')).toHaveLength(2));
    expect(screen.getByTestId('invoice-batch').textContent).toContain('Customer TR-a');
    expect(screen.getByTestId('invoice-batch').textContent).toContain('Customer TR-b');
    // The one that could not be prepared is named, and is not silently dropped.
    expect(screen.getByTestId('invoice-batch-failed').textContent).toContain('c: ');
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('says so when nothing was chosen', () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: [] }, 200)));
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={['/sales/orders/invoices']}>
            <Routes>
              <Route path="/sales/orders/invoices" element={<InvoiceBatchPage />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );
    expect(screen.getByText(/No orders were chosen/)).not.toBeNull();
  });
});
