import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import InvoicePage from './InvoicePage';

/**
 * The Sales Invoice printable — `PRN-023`, `OSC-059`.
 *
 * 🔴 THESE TESTS EXIST BECAUSE THE PAGE CONFLATED THREE OUTCOMES INTO ONE SENTENCE, AND THAT
 * CONFLATION REACHED PRODUCTION. Every failure — a permission refusal, a transport failure, a
 * genuinely unissued invoice — rendered *"No invoice has been issued for this order yet"*, which
 * states a fact about the ORDER. ⚠ An operator who simply lacked `accounting.sales-invoice.view`
 * was therefore told something false about their data, and the real cause was invisible.
 *
 * 🔴 `SYS-034` — a fact that is not known is never rendered as a fact that is known. A `403` and
 * a `404` have different owners and different remedies, and only the `404` is `BR-134`'s
 * "absent is not empty".
 */

const ORDER_ID = '11111111-1111-1111-1111-111111111111';

function renderWith(respond: (url: string) => Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // The shell's utility cluster resolves the signed-in identity; it is not what is under test.
      if (url.includes('/api/auth/me')) {
        return json({ id: 'dev', username: 'mithun', fullName: 'Mithun Ahamed', roles: [], permissions: [] }, 200);
      }
      return respond(url);
    }),
  );
  render(
    <AuthProvider>
      <PageActionsProvider>
        <MemoryRouter initialEntries={[`/sales/orders/${ORDER_ID}/invoice`]}>
          <Routes>
            <Route path="/sales/orders/:id/invoice" element={<InvoicePage />} />
          </Routes>
        </MemoryRouter>
      </PageActionsProvider>
    </AuthProvider>,
  );
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Sales invoice printable', () => {
  it('reports an ungranted capability as a permission refusal, never as a fact about the order', async () => {
    /*
      🔴 `V23` SEEDS `accounting.sales-invoice.view` WITH ZERO HOLDERS, DELIBERATELY. `PRM-003`
      denies what was never granted and `PRM-081.b` forbids a deployment handing out authority,
      so a `403` here is the SYSTEM WORKING — and the page must say which system said no.
    */
    renderWith(() => json({ message: 'accounting.sales-invoice.view' }, 403));

    expect(await screen.findByTestId('invoice-forbidden')).not.toBeNull();
    expect(screen.getByText(/accounting\.sales-invoice\.view/)).not.toBeNull();

    // 🔴 THE REGRESSION THIS FILE EXISTS FOR. A refusal must never claim the invoice is unissued.
    expect(screen.queryByTestId('invoice-absent')).toBeNull();
    expect(screen.queryByText(/No invoice has been issued/)).toBeNull();
  });

  it('reports a genuinely unissued invoice as an answer, and offers no control that would invent its trigger', async () => {
    // ⚠ `BR-134` — the ONE case that is genuinely a fact about the order. Most orders have none.
    renderWith(() => json({ message: 'not found' }, 404));

    expect(await screen.findByTestId('invoice-absent')).not.toBeNull();
    expect(screen.getByText(/No invoice has been issued for this order yet/)).not.toBeNull();

    /*
      🔴 NO `Issue invoice` CONTROL. The endpoint exists and `PRM-094` permissions it, but nothing
      in the corpus fixes WHEN an invoice is issued or by whom. `INV-39.2` snapshots the content,
      so issuing at the wrong moment preserves the wrong prices and address permanently — putting
      a button here would invent that trigger (`CLAUDE.md` §5).
    */
    expect(screen.queryByRole('button', { name: /Issue/i })).toBeNull();
  });

  it('reports a transport failure as a failure, not as an absence', async () => {
    renderWith(() => json({ message: 'upstream exploded' }, 500));

    expect(await screen.findByTestId('invoice-failed')).not.toBeNull();
    expect(screen.queryByTestId('invoice-absent')).toBeNull();
    expect(screen.queryByTestId('invoice-forbidden')).toBeNull();
  });

  it('renders the issued snapshot and recomputes nothing', async () => {
    /*
      🔴 `PRN-022` — the rendering NEVER becomes the source. Every figure below is a stored column.
      ⚠ The subtotal deliberately does NOT equal the lines here: a renderer that re-added them
      would silently "correct" the snapshot, which is exactly the defect `INV-39.2` guards against.
    */
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0158',
          issuedAt: '2026-08-19T10:00:00Z',
          customerName: 'Rifat Hasan',
          customerPhone: '+8801712334455',
          customerAddress: 'House 42, Banani, Dhaka',
          externalOrderReference: '447-1129384',
          consignmentReference: 'SF-90233118',
          subtotal: '66300.00',
          deliveryCharge: '130.00',
          taxRatePercent: '0.000',
          taxAmount: '0.00',
          total: '66430.00',
          lines: [
            { name: 'Intel Core i5 Gaming PC', sku: 'SP-10428', quantity: 1, unitPrice: '62500.00', lineTotal: '62500.00' },
          ],
        },
        200,
      ),
    );

    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    // ✅ The STORED total, rendered as received — not the sum of the one line above it.
    expect(screen.getByTestId('invoice-total').textContent).toContain('66,430');
    expect(screen.getByText('Intel Core i5 Gaming PC')).not.toBeNull();
    expect(screen.queryByTestId('invoice-absent')).toBeNull();
  });

  it('sends the operator back where they came from', async () => {
    // ⚠ The back button is a ROUTE, not `history.back()`: an operator who arrived by pasting a
    // link would otherwise be sent outside the application entirely.
    renderWith(() => json({ message: 'not found' }, 404));

    expect((await screen.findByTestId('invoice-back')).textContent).toContain('Back to order');
  });
});
