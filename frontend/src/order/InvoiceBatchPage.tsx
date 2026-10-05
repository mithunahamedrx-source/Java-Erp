import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button } from '../ui/primitives';
import { ApiError, apiRequest } from '../platform/api';
import { InvoiceSheet, PRINT_CSS } from './InvoicePage';
import type { InvoiceView } from './InvoicePage';

/**
 * Print the invoices of several selected orders in ONE print job — one A4 sheet each.
 *
 * Owner instruction, 2026-10-05: the bulk "Print invoices" works for any number of selected orders. Each order's
 * invoice is issued when it has none (the same on-demand rule as the single page, `BR-192`; `INV-39.1` — never
 * reissued), then every sheet is drawn by the SAME `InvoiceSheet` the single page uses and the print dialog opens once.
 *
 * 🔴 AN ORDER WHOSE INVOICE CANNOT BE PREPARED IS REPORTED BY NAME and the rest still print; nothing is skipped silently.
 */
type Prepared = { readonly id: string; readonly invoice: InvoiceView | null; readonly problem: string | null };

async function prepare(id: string): Promise<Prepared> {
  const url = `/api/accounting/orders/${encodeURIComponent(id)}/invoice`;
  try {
    return { id, invoice: await apiRequest<InvoiceView>(url), problem: null };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) {
      try {
        await apiRequest(url, { method: 'POST' });
        return { id, invoice: await apiRequest<InvoiceView>(url), problem: null };
      } catch (issueCause) {
        return { id, invoice: null, problem: issueCause instanceof Error ? issueCause.message : 'The invoice could not be issued.' };
      }
    }
    if (cause instanceof ApiError && cause.isForbidden) {
      return { id, invoice: null, problem: 'You cannot view or issue invoices (accounting.sales-invoice.view / .issue).' };
    }
    return { id, invoice: null, problem: cause instanceof Error ? cause.message : 'The invoice could not be loaded.' };
  }
}

export default function InvoiceBatchPage(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const ids = (location.state as { ids?: string[] } | null)?.ids ?? [];
  const [prepared, setPrepared] = useState<readonly Prepared[] | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const done: Prepared[] = [];
      for (const id of ids) {
        done.push(await prepare(id));
      }
      if (live) {
        setPrepared(done);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = (prepared ?? []).filter((p) => p.invoice !== null);
  const failed = (prepared ?? []).filter((p) => p.invoice === null);

  useEffect(() => {
    if (prepared && ready.length > 0) {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  const header = (
    <PageHeader
      title="Print invoices"
      breadcrumb={
        <>
          <span>Sales &amp; Orders</span>
          <span>/</span>
          <Link to="/sales/orders" style={{ color: 'inherit' }}>Orders</Link>
          <span>/</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Invoices</span>
        </>
      }
      subtitle={`${ids.length} order${ids.length === 1 ? '' : 's'} · one A4 sheet each`}
      actions={
        <>
          <Button variant="secondary" size="page-header" onClick={() => navigate('/sales/orders')} testId="invoice-batch-back">
            Back to orders
          </Button>
          <Button variant="primary" size="page-header" onClick={() => window.print()} disabled={ready.length === 0} testId="invoice-batch-print">
            Print
          </Button>
        </>
      }
    />
  );

  if (ids.length === 0) {
    return (
      <>
        {header}
        <p style={{ padding: 'var(--space-6)' }}>No orders were chosen. Select orders on the Orders page, then choose Print invoices.</p>
      </>
    );
  }
  if (!prepared) {
    return (
      <>
        {header}
        <p style={{ padding: 'var(--space-6)' }} data-testid="invoice-batch-preparing">Preparing {ids.length} invoice{ids.length === 1 ? '' : 's'}…</p>
      </>
    );
  }

  return (
    <>
      <style>{PRINT_CSS}</style>
      {/* Every sheet but the last ends its page, so each invoice starts on a fresh A4. */}
      <style>{'@media print { .invoice-batch-sheet:not(:last-child) { break-after: page; page-break-after: always; } }'}</style>
      <div className="invoice-no-print">
        {header}
        {failed.length > 0 ? (
          <div style={{ padding: 'var(--space-4) var(--space-6)' }} data-testid="invoice-batch-failed">
            <strong>{failed.length} invoice{failed.length === 1 ? '' : 's'} could not be prepared and will not print:</strong>
            <ul>
              {failed.map((f) => (
                <li key={f.id}>{f.id}: {f.problem}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="invoice-page" data-testid="invoice-batch" style={{ display: 'grid', gap: 'var(--space-6)', justifyItems: 'center', padding: 'var(--space-6)' }}>
        {ready.map((p) => (
          <div key={p.id} className="invoice-batch-sheet">
            <InvoiceSheet invoice={p.invoice as InvoiceView} />
          </div>
        ))}
      </div>
    </>
  );
}
