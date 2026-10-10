import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

  function renderIssuing(opts: { autoPrint: boolean; issueStatus?: number }): {
    readonly calls: { url: string; method: string }[];
    readonly print: ReturnType<typeof vi.fn>;
  } {
    const calls: { url: string; method: string }[] = [];
    let issued = false;
    const print = vi.fn();
    vi.stubGlobal('print', print);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ url, method });
        if (url.includes('/api/auth/me')) {
          return json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: [] }, 200);
        }
        if (method === 'POST') {
          if (opts.issueStatus && opts.issueStatus !== 201) {
            return json({ message: 'refused' }, opts.issueStatus);
          }
          issued = true;
          return json({ id: 'x' }, 201);
        }
        return issued
          ? json({
              invoiceNumber: 'TR0200', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Walk-in',
              customerPhone: null, customerAddress: null, externalOrderReference: null,
              consignmentReference: null, subtotal: '5000.00', deliveryCharge: null,
              taxRatePercent: '0.000', taxAmount: '0.00', total: '5000.00',
              lines: [{ name: 'Keyboard', sku: null, quantity: 1, unitPrice: '5000.00', lineTotal: '5000.00' }],
            }, 200)
          : json({ message: 'not found' }, 404);
      }),
    );
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={[{ pathname: `/sales/orders/${ORDER_ID}/invoice`, state: { from: 'list', autoPrint: opts.autoPrint } }]}>
            <Routes>
              <Route path="/sales/orders/:id/invoice" element={<InvoicePage />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );
    return { calls, print };
  }

  it('prepares an unissued invoice by itself, once, and prints it when the operator asked to print', async () => {
    // Owner decision 2026-10-05: "Print invoice" means print - no intermediate button to press.
    const { calls, print } = renderIssuing({ autoPrint: true });

    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(screen.getByTestId('invoice-total').textContent).toContain('5,000');
    await waitFor(() => expect(print).toHaveBeenCalled());
  });

  it('prepares the invoice but does not open the print dialog when the page was not reached by Print', async () => {
    const { print } = renderIssuing({ autoPrint: false });

    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    // The Print button is still there for the operator; nothing prints on its own.
    expect(print).not.toHaveBeenCalled();
  });

  it('reports a refused issue instead of looping, and keeps a deliberate retry', async () => {
    const { calls } = renderIssuing({ autoPrint: true, issueStatus: 403 });

    expect(await screen.findByTestId('invoice-issue-error')).not.toBeNull();
    expect(screen.getByText(/You cannot issue invoices/)).not.toBeNull();
    // Attempted ONCE, not retried in a loop.
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(screen.getByTestId('invoice-issue').textContent).toContain('Try again');
  });

  it('does not crash when the tax rate arrives as a JSON number', async () => {
    // A server that sends 0.000 as a number blanked the whole page (trim on a number). The page
    // must survive it whatever the wire format.
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0001', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: null, subtotal: '100.00', deliveryCharge: null,
          taxRatePercent: 0, taxAmount: '0.00', total: '100.00', lines: [],
        },
        200,
      ),
    );
    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    expect(screen.getByText(/VAT \/ Tax \(0%\)/)).not.toBeNull();
  });

  it('shows Advance received straight after the subtotal, and the balance as Balance Due', async () => {
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0300', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: null, subtotal: '1500.00', deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '1500.00',
          advanceReceived: '500.00', balanceDue: '1000.00',
          lines: [{ name: 'Keyboard', sku: null, quantity: 1, unitPrice: '1500.00', lineTotal: '1500.00' }],
        },
        200,
      ),
    );
    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    const advance = screen.getByTestId('invoice-advance');
    expect(advance.textContent).toContain('Advance received');
    expect(advance.textContent).toContain('500');
    // It sits immediately after the subtotal row.
    const subtotal = screen.getByText('Subtotal').parentElement as HTMLElement;
    expect(subtotal.nextElementSibling).toBe(advance);
    // Balance Due is the SERVER's balance, not a browser subtraction (TEC-095).
    expect(screen.getByTestId('invoice-total').textContent).toContain('1,000');
  });

  it('prints the order warranty term, and falls back to the standing policy line when none was chosen (BR-197)', async () => {
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0302', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: null, subtotal: '100.00', deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [], warrantyTerm: 'Y2',
        },
        200,
      ),
    );
    expect((await screen.findByTestId('invoice-warranty')).textContent).toContain('Warranty: 2 years');
    // No note was typed on the order, so nothing is printed under Note.
    expect(screen.queryByTestId('invoice-note')).toBeNull();
  });

  it('prints the Steadfast Parcel ID in the reference block and, large, under the thank-you line once booked', async () => {
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0303', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: '287650820', subtotal: '100.00', deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [],
        },
        200,
      ),
    );
    const sheet = await screen.findByTestId('invoice-sheet');
    expect(sheet.textContent).toContain('287650820');
    const footer = screen.getByTestId('invoice-footer-parcel');
    expect(footer.textContent).toBe('Steadfast Parcel ID287650820');
    expect(screen.getByTestId('invoice-footer-parcel-number').textContent).toBe('287650820');
    expect(screen.getByTestId('invoice-footer-websites').textContent).toContain('www.zeontechbd.com');
    // It sits under the thank-you line, not beside it.
    expect(footer.parentElement?.textContent).toContain('Thank you for your purchase.');
    expect(footer.textContent).not.toContain('Thank you');
  });

  it('puts the invoice number first and big, then ONE reference: the Parcel ID when booked, else the order reference', async () => {
    renderWith(() => json({
          invoiceNumber: 'TR0305', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: '688454214304139',
          consignmentReference: '287650820', subtotal: '100.00', deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [],
        }, 200));
    const sheet = await screen.findByTestId('invoice-sheet');
    const hero = screen.getByTestId('invoice-number-hero');
    expect(hero.textContent).toBe('Invoice NoTR0305');
    expect(sheet.textContent).toContain('Parcel ID287650820');
    expect(sheet.textContent).not.toContain('Order Ref.');
    cleanup();

    renderWith(() => json({
          invoiceNumber: 'TR0305', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: '688454214304139',
          consignmentReference: null, subtotal: '100.00', deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [],
        }, 200));
    const unbooked = await screen.findByTestId('invoice-sheet');
    expect(unbooked.textContent).toContain('Order Ref.688454214304139');
    expect(unbooked.textContent).not.toContain('Parcel ID');
  });

  it('prints no parcel line in the footer when the order is not booked', async () => {
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0304', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: null, subtotal: '100.00', deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [],
        },
        200,
      ),
    );
    await screen.findByTestId('invoice-sheet');
    expect(screen.queryByTestId('invoice-footer-parcel')).toBeNull();
  });

  it('shows no Advance row when none was recorded', async () => {
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0301', issuedAt: '2026-10-05T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: null, subtotal: '100.00', deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [],
        },
        200,
      ),
    );
    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    expect(screen.queryByTestId('invoice-advance')).toBeNull();
    expect(screen.getByTestId('invoice-total').textContent).toContain('100');
  });

  it('prints a voucher discount with its code straight after the subtotal, and none when there is none', async () => {
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0303', issuedAt: '2026-10-10T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: null, subtotal: '21700.00', discount: '1000.00', discountCode: 'SAVE1000',
          deliveryCharge: '0.00', taxRatePercent: '0.000', taxAmount: '0.00', total: '20700.00',
          lines: [{ name: 'Desktop PC', sku: 'ZT053G', quantity: 1, unitPrice: '21700.00', lineTotal: '21700.00' }],
        },
        200,
      ),
    );
    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    const discount = screen.getByTestId('invoice-discount');
    expect(discount.textContent).toContain('Discount (SAVE1000)');
    expect(discount.textContent).toContain('- ');
    expect(discount.textContent).toContain('1,000');
    // It sits immediately after the subtotal row, and the total is the stored figure (subtotal - discount).
    const subtotal = screen.getByText('Subtotal').parentElement as HTMLElement;
    expect(subtotal.nextElementSibling).toBe(discount);
    expect(screen.getByTestId('invoice-total').textContent).toContain('20,700');
  });

  it('shows no Discount row on an invoice without one', async () => {
    renderWith(() =>
      json(
        {
          invoiceNumber: 'TR0304', issuedAt: '2026-10-10T10:00:00Z', customerName: 'Demo',
          customerPhone: null, customerAddress: null, externalOrderReference: null,
          consignmentReference: null, subtotal: '100.00', discount: null, discountCode: null, deliveryCharge: null,
          taxRatePercent: '0.000', taxAmount: '0.00', total: '100.00', lines: [],
        },
        200,
      ),
    );
    expect(await screen.findByTestId('invoice-sheet')).not.toBeNull();
    expect(screen.queryByTestId('invoice-discount')).toBeNull();
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
    // Owner 2026-10-05: the real logo is on the invoice, and no source chip sits beside the customer's name.
    expect(screen.getByTestId('invoice-logo').getAttribute('alt')).toBe('Trioloo');
    expect(screen.queryByText('Daraz')).toBeNull();
    expect(screen.queryByText('Direct')).toBeNull();
  });

  it('sends the operator back where they came from', async () => {
    // ⚠ The back button is a ROUTE, not `history.back()`: an operator who arrived by pasting a
    // link would otherwise be sent outside the application entirely.
    renderWith(() => json({ message: 'not found' }, 404));

    expect((await screen.findByTestId('invoice-back')).textContent).toContain('Back to order');
  });
});
