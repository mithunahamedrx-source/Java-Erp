import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button } from '../ui/primitives';
import { ApiError, apiRequest } from '../platform/api';
import { formatMoneyForDisplay } from '../platform/money';
import { formatMoment } from '../platform/datetime';
import logoUrl from '../assets/brand/trioloo-logo-black.png';
import { warrantyTermLabel } from './orderApi';

/**
 * The Sales Invoice printable — `PRN-023`, `OSC-059`.
 *
 * 🔴 IT RENDERS THE `E-039` SNAPSHOT AND COMPUTES NOTHING. `PRN-022` — every printable has exactly
 * one deterministic authoritative source, and the rendering never becomes that source. ⚠ Every
 * figure below is a stored column: no total is re-added, no tax is re-applied, no address is
 * re-read. That is what makes the document reproducible years later (`INV-39.2`), and it is why a
 * later tax-rate change cannot restate an invoice a customer already holds.
 *
 * 🔴 THE TYPEFACE IS NOT `Manrope`, DELIBERATELY. `DESIGN_CONSTITUTION.md` fixes Manrope for the
 * APPLICATION UI; `DOCUMENT_ARCHITECTURE.md` §15 decides no typography for printables at all, so
 * the document face was genuinely undecided and the approved design proposes these two
 * (`design-reference/TrioLoo Invoice.md` §1).
 *
 * 🔴 THE PROTOTYPE'S *"What prints on this invoice"* CONTROL IS NOT BUILT, AND ITS ABSENCE IS THE
 * RULE RATHER THAN AN OMISSION. That control lets an operator swap the order's own lines for a
 * marketplace listing's title and edit the printed quantities and prices, recomputing the subtotal
 * and the balance due from the result. ⚠ `PRN-022` makes the rendering the one thing that is NEVER
 * the source, and `INV-39.2` requires the content snapshotted so the document stays reproducible
 * years later — a printable that recomputed from operator-edited lines would print a figure the
 * `E-039` record does not hold, and would print a different one next year.
 *
 * ✅ THE PAGE SITS IN THE APPLICATION SHELL, WITH ITS BREADCRUMB AND ITS BACK BUTTON, AND THE
 * SHEET DOES NOT. The chrome is `invoice-no-print`; what reaches paper is the A4 sheet alone.
 */

/** Where the operator came from, so `Back` returns there rather than guessing (prototype §P4). */
export type InvoiceOrigin = 'list' | 'detail';
export default function InvoicePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  /*
    ⚠ THE ORIGIN IS CARRIED BY THE NAVIGATION, NOT GUESSED FROM HISTORY. `navigate(-1)` would send
    an operator who arrived by pasting a link somewhere outside the application entirely, and a
    fixed destination would strand the one who came from the workspace.
  */
  const origin: InvoiceOrigin =
    (location.state as { from?: InvoiceOrigin } | null)?.from === 'list' ? 'list' : 'detail';
  // Set by the Print actions: the operator asked to PRINT, so the print dialog opens once the sheet is ready.
  const autoPrint = (location.state as { autoPrint?: boolean } | null)?.autoPrint === true;
  const backTo = origin === 'list' ? '/sales/orders' : `/sales/orders/${id}`;
  const backLabel = origin === 'list' ? 'Back to orders' : 'Back to order';
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  /*
    🔴 THREE OUTCOMES, THREE ANSWERS — AND CONFLATING THEM WAS A REAL DEFECT.
    This page previously rendered "No invoice has been issued for this order yet" for EVERY
    failure, so a `403` from an operator who simply lacks `accounting.sales-invoice.view` was
    reported as a fact about the ORDER. ⚠ That is precisely the fabrication `SYS-034` forbids:
    a permission refusal and a business absence are different facts with different owners, and
    only one of them is `BR-134`'s "absent is not empty".
  */
  const [outcome, setOutcome] = useState<'loading' | 'issued' | 'not-issued' | 'forbidden' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    setOutcome('loading');
    try {
      setInvoice(await apiRequest<InvoiceView>(`/api/accounting/orders/${id}/invoice`));
      setError(null);
      setOutcome('issued');
    } catch (cause) {
      setInvoice(null);
      if (cause instanceof ApiError && cause.status === 404) {
        // ✅ `BR-134` — the ONLY case that is genuinely a fact about the order.
        setOutcome('not-issued');
      } else if (cause instanceof ApiError && cause.isForbidden) {
        setOutcome('forbidden');
      } else {
        setError(cause instanceof Error ? cause.message : 'The invoice could not be loaded.');
        setOutcome('failed');
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
    ✅ OWNER DECISION, 2026-10-05: EVERY ORDER'S INVOICE IS PRINTABLE — AND "PRINT INVOICE" MEANS PRINT.
    The invoice document (E-039) did not exist for most orders, so "Print invoice" led to a page that
    said so. The page now ISSUES THE INVOICE ITSELF when none exists, then shows it, and the Print
    actions open the print dialog once it is ready.

    ⚠ THE SNAPSHOT IS OF THE ORDER AS IT IS WHEN THE INVOICE IS FIRST OPENED (INV-39.2), and an issued
    invoice is never reissued (INV-39.1). Edit the order BEFORE printing its invoice.
    🔴 It is attempted ONCE per visit, so a refusal (permission, a failure) is reported and not retried
    in a loop; the button below remains for a deliberate second attempt.
  */
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [printWhenReady, setPrintWhenReady] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  const issue = useCallback(async (print: boolean) => {
    if (!id) {
      return;
    }
    setIssuing(true);
    setIssueError(null);
    try {
      await apiRequest(`/api/accounting/orders/${id}/invoice`, { method: 'POST' });
      setPrintWhenReady(print);
      await load();
    } catch (cause) {
      setIssueError(
        cause instanceof ApiError && cause.isForbidden
          ? 'You cannot issue invoices. The capability accounting.sales-invoice.issue is held by nobody until an authorised person grants it.'
          : cause instanceof Error ? cause.message : 'The invoice could not be issued.',
      );
    } finally {
      setIssuing(false);
    }
  }, [id, load]);

  useEffect(() => {
    if (outcome === 'not-issued' && !autoTried) {
      setAutoTried(true);
      void issue(autoPrint);
    }
  }, [outcome, autoTried, autoPrint, issue]);

  useEffect(() => {
    if (printWhenReady && outcome === 'issued') {
      setPrintWhenReady(false);
      // Let the sheet paint before the print dialog captures it.
      setTimeout(() => window.print(), 150);
    }
  }, [printWhenReady, outcome]);

  const header = (title: string, number: string | null): React.JSX.Element => (
    <PageHeader
      title={title}
      breadcrumb={
        <>
          <span>Sales &amp; Orders</span>
          <span>/</span>
          <Link to="/sales/orders" style={crumbLinkStyle}>Orders</Link>
          <span>/</span>
          <Link to={`/sales/orders/${id}`} style={crumbLinkStyle}>{number ?? 'Order'}</Link>
          <span>/</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Invoice</span>
        </>
      }
      subtitle="Renders the invoice snapshot taken at issue · nothing on this page is recalculated"
      actions={
        <>
          {/*
            🔴 THE BACK BUTTON RETURNS WHERE THE OPERATOR CAME FROM, AND IT IS A ROUTE, NOT
            `history.back()`. `RULE 3.11` — exactly one primary, and Print is it, rightmost.
          */}
          <Button variant="secondary" size="page-header" onClick={() => navigate(backTo)} testId="invoice-back">
            {backLabel}
          </Button>
          <Button variant="primary" size="page-header" onClick={() => window.print()} testId="invoice-print">
            <PrinterIcon />
            Print
          </Button>
        </>
      }
    />
  );

  if (outcome === 'loading') {
    return (
      <>
        {header('Sales invoice', null)}
        <p style={messageStyle}>Loading the invoice…</p>
      </>
    );
  }

  /*
    🔴 A PERMISSION REFUSAL IS NOT A FACT ABOUT THE ORDER. `PRM-003` denies what was never
    granted and `PRM-081.b` forbids a deployment handing out authority, so `V23` seeded
    `accounting.sales-invoice.view` with ZERO holders — deliberately. ⚠ An operator meeting this
    has not found a broken invoice; they have found an ungranted capability, and only an
    authorised person may grant it (`PRM-094`).
  */
  if (outcome === 'forbidden') {
    return (
      <>
        {header('Sales invoice', null)}
        <div style={messageStyle} data-testid="invoice-forbidden">
          <strong>You cannot view invoices.</strong>
          <p style={reasonStyle}>
            Your role does not include <code>accounting.sales-invoice.view</code>. The capability
            exists and is held by nobody until an authorised person grants it — seeding a
            permission is not granting it (<code>PRM-003</code>, <code>PRM-081.b</code>). Nothing
            is wrong with this order.
          </p>
        </div>
      </>
    );
  }

  if (outcome === 'failed') {
    return (
      <>
        {header('Sales invoice', null)}
        <div style={messageStyle} data-testid="invoice-failed">
          <strong>The invoice could not be loaded.</strong>
          <p style={reasonStyle}>{error}</p>
        </div>
      </>
    );
  }

  if ((outcome === 'not-issued' || !invoice) && !issueError && (issuing || !autoTried)) {
    return (
      <>
        {header('Sales invoice', null)}
        <p style={messageStyle} data-testid="invoice-preparing">Preparing the invoice…</p>
      </>
    );
  }

  if (outcome === 'not-issued' || !invoice) {
    return (
      <>
        {header('Sales invoice', null)}
        <div style={messageStyle} data-testid="invoice-absent">
          <strong>The invoice could not be prepared.</strong>
          <p style={reasonStyle}>
            The order already has its Trioloo invoice number. Issuing creates the printable invoice
            from the order <em>as it is now</em> — customer, address, lines and totals are fixed on
            the invoice and do not change if the order is edited later. Edit the order first if it
            needs correcting.
          </p>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="primary" size="page-header" onClick={() => void issue(true)} disabled={issuing} testId="invoice-issue">
              {issuing ? 'Issuing…' : 'Try again and print'}
            </Button>
          </div>
          {issueError ? <p style={{ ...reasonStyle, color: 'var(--color-destructive)' }} data-testid="invoice-issue-error">{issueError}</p> : null}
        </div>
      </>
    );
  }

  return (
    <>
      {/*
        🔴 PRINT CSS IS SCOPED TO THIS PAGE AND EXISTS ONLY HERE. The sheet is A4 at 96dpi
        (794×1123), which is the geometry the approved design fixes — a printable is paginated and
        its columns are fixed by the sheet, so `RULE 7.4`'s operational-row rules do not govern it.
      */}
      <style>{PRINT_CSS}</style>

      <div className="invoice-no-print">{header(`Sales invoice ${invoice.invoiceNumber}`, invoice.invoiceNumber)}</div>

      <div className="invoice-page" style={pageStyle}>
        <article style={sheetStyle} data-testid="invoice-sheet">
          {/* ── Header ─────────────────────────────────────────────── */}
          <div style={headerStyle}>
            <div>
              {/* The complete approved logo as ONE image (ApplicationBrand's rule): never redrawn, never
                  cropped, no text beside it. Height only, so the 643x184 ratio cannot be distorted. */}
              <img src={logoUrl} alt="Trioloo" style={{ height: '50px', width: 'auto', display: 'block' }} data-testid="invoice-logo" />
              <div style={sellerStyle}>
                R.B Tower 4th Floor (Lift-3), 56/9, Panthapath, Dhaka-1205, Bangladesh<br />
                {/* Owner instruction 2026-10-05: ONE number, shown with its icons instead of the words Call / WhatsApp. */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} data-testid="invoice-contact">
                  <PhoneIcon /> 01963-956474
                  <span style={{ margin: '0 6px', color: '#9a9a9a' }}>·</span>
                  <WhatsAppIcon /> 01963-956474
                </span><br />
                trioloobd@gmail.com &nbsp;·&nbsp; contract@trioloo.com.bd
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '18px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Status chips from design reference */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 13px',
                    borderRadius: '999px',
                    background: '#fdecec',
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#c12d2b' }}></span>
                    <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.4px', color: '#c12d2b' }}>Due</span>
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 13px',
                    borderRadius: '999px',
                    background: invoice.consignmentReference ? '#e8f0fe' : '#fef3e2',
                  }}>
                    <span style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: invoice.consignmentReference ? '#2f6df0' : '#e08a16',
                    }}></span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      letterSpacing: '0.4px',
                      color: invoice.consignmentReference ? '#1f55c4' : '#b56a09',
                    }}>
                      {invoice.consignmentReference ? 'Shipped' : 'Processing'}
                    </span>
                  </div>
                </div>
                <div style={invoiceWordStyle}>Invoice</div>
              </div>
              <div style={refBlockStyle}>
                {/*
                  ✅ THE TRIOLOO NUMBER IS THE IDENTITY AND SITS FIRST; the courier booking and the
                  marketplace order number are REFERENCES after it — the product owner's ordering.
                  🔴 EACH NAMES ITS ISSUING PARTY (`DB-013`): two parties may legitimately issue the
                  same string, and the design's unlabelled `Parcel ID.` is exactly that ambiguity.
                */}
                <Ref label="No." value={invoice.invoiceNumber} strong />
                <Ref label="Parcel ID." value={invoice.consignmentReference} />
                <Ref label="Order Ref." value={invoice.externalOrderReference} />
                <Ref label="Date" value={formatMoment(invoice.issuedAt) ?? '—'} />
              </div>
            </div>
          </div>

          {/* ── Bill to + bank ─────────────────────────────────────── */}
          <div style={billRowStyle}>
            <div style={{ flex: 1 }}>
              <div style={sectionLabelStyle}>Bill To</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
                <span style={customerNameStyle}>{invoice.customerName}</span>
              </div>
              <div style={sellerStyle}>
                {invoice.customerAddress || 'Address not recorded'}<br />
                {invoice.customerPhone || 'Contact not recorded'}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={sectionLabelStyle}>Bank Details</div>
              <table style={{ borderCollapse: 'collapse', fontSize: '13px', lineHeight: 1.6 }}>
                <tbody>
                  <BankRow label="Bank" value="Al-Arafah Islami Bank PLC" />
                  <BankRow label="Branch" value="Panthapath, Dhaka" />
                  <BankRow label="A/C Name" value="TRIOLOO" />
                  <BankRow label="A/C No." value="0841020007385" mono />
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Items ──────────────────────────────────────────────── */}
          <div style={{ padding: '0 48px' }}>
            <table style={itemsTableStyle}>
              <thead>
                <tr style={{ background: '#3f444d' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Item Description</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '60px' }}>Qty</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '120px' }}>Unit Price</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '120px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line, index) => (
                  <tr key={`${line.sku ?? line.name ?? 'line'}-${index}`} style={itemRowStyle}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>
                        {line.name || 'Item not recorded'}
                      </div>
                      {line.sku ? <div style={skuStyle}>SKU: {line.sku}</div> : null}
                    </td>
                    <td style={{ textAlign: 'center', padding: '16px 12px', fontSize: '14px', color: '#4a4a4a' }}>
                      {line.quantity}
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px', fontSize: '14px', color: '#4a4a4a' }}>
                      {money(line.unitPrice)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px', fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
                      {money(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totals + Warranty/Note ──────────────────────────────── */}
          <div style={totalsRowStyle}>
            <div style={{ flex: 1, paddingTop: '2px' }}>
              <div style={sectionLabelStyle}>Warranty &amp; Policies</div>
              <ul style={{
                margin: '0 0 20px',
                paddingLeft: '16px',
                fontSize: '11.5px',
                color: '#555555',
                lineHeight: 1.7,
                textAlign: 'justify',
              }}>
                {warrantyTermLabel(invoice.warrantyTerm) ? (
                  <li data-testid="invoice-warranty" style={{ paddingLeft: '2px', fontWeight: 600 }}>
                    Warranty: {warrantyTermLabel(invoice.warrantyTerm)}.
                  </li>
                ) : (
                  <li style={{ paddingLeft: '2px' }}>All televisions and computers carry a minimum 3-year manufacturer's warranty.</li>
                )}
                <li style={{ paddingLeft: '2px' }}>Returns are accepted within 7 days with product replacement.</li>
                <li style={{ paddingLeft: '2px' }}>Warranty void if seal is broken or physical/liquid damage occurs.</li>
              </ul>
              {/* The note is the one typed on the order; nothing is printed when there is none. */}
              {invoice.note?.trim() ? (
                <>
                  <div style={sectionLabelStyle}>Note</div>
                  <div data-testid="invoice-note" style={noteStyle}>{invoice.note}</div>
                </>
              ) : null}
            </div>
            <div data-testid="invoice-totals" style={{ width: '340px', fontVariantNumeric: 'tabular-nums' }}>
              <TotalRow label="Subtotal" value={money(invoice.subtotal)} />
              {/* Owner instruction 2026-10-05 (BR-127): the advance sits straight after the subtotal. */}
              {invoice.advanceReceived ? (
                <TotalRow label="Advance received" value={`- ${money(invoice.advanceReceived)}`} testId="invoice-advance" />
              ) : null}
              <TotalRow label="Delivery &amp; Handling" value={money(invoice.deliveryCharge)} />
              {/*
                ✅ 0% IS A RATE AND IS PRINTED AS ONE — the product owner ratified it, and
                `BD-307` permits VAT to be DISPLAYED while the ERP maintains no VAT accounts.
                🔴 A NULL rate would mean nobody had decided, and the line says so rather than
                printing a `0%` nobody chose (`SYS-034`).
              */}
              <TotalRow
                label={invoice.taxRatePercent === null
                  ? 'VAT / Tax'
                  : `VAT / Tax (${trimRate(invoice.taxRatePercent)}%)`}
                value={invoice.taxRatePercent === null ? 'Not applied' : money(invoice.taxAmount)}
                bordered
              />
              <div style={balanceDueStyle}>
                <span style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontSize: '14px',
                  letterSpacing: '0.5px',
                  fontWeight: 500,
                }}>
                  Balance Due
                </span>
                <span
                  style={{
                    fontFamily: "'Space Grotesk', system-ui, sans-serif",
                    fontSize: '22px',
                    fontWeight: 700,
                  }}
                  data-testid="invoice-total"
                >
                  {money(invoice.balanceDue ?? invoice.total)}
                </span>
              </div>
            </div>
          </div>

          <div style={footerStyle}>
            <div style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: '15px',
              fontWeight: 600,
            }}>
              Thank you for your purchase.
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>www.trioloo.com.bd</div>
          </div>
        </article>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function PhoneIcon(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Call" role="img">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function WhatsAppIcon(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1ea952" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="WhatsApp" role="img">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <path d="M9.5 8.8c.3 2.1 2.6 4.6 4.9 5l1-1.2-1.6-.9-.7.6c-.7-.3-1.5-1-1.8-1.8l.6-.7-.9-1.6z" fill="#1ea952" stroke="none" />
    </svg>
  );
}

function Ref({ label, value, strong }: {
  readonly label: string;
  readonly value: string | null;
  readonly strong?: boolean;
}): React.JSX.Element | null {
  // ⚠ A reference the order does not have is omitted rather than printed empty. An unbooked
  // order has no consignment, and a blank line beside a label reads as a missing value.
  if (!value) {
    return null;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
      <span style={{ color: '#9a9a9a' }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: '#111111' }}>{value}</span>
    </div>
  );
}

function BankRow({ label, value, mono }: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}): React.JSX.Element {
  return (
    <tr>
      <td style={{ color: '#9a9a9a', padding: '1px 14px 1px 0', verticalAlign: 'top' }}>{label}</td>
      <td style={{ color: '#1a1a1a', fontWeight: mono ? 600 : 500, letterSpacing: mono ? '0.3px' : undefined }}>
        {value}
      </td>
    </tr>
  );
}

function TotalRow({ label, value, bordered, testId }: {
  readonly label: string;
  readonly value: string;
  readonly bordered?: boolean;
  readonly testId?: string;
}): React.JSX.Element {
  return (
    <div data-testid={testId} style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: bordered ? '9px 16px 13px' : '9px 16px',
      fontSize: '14px',
      color: '#555555',
      borderBottom: bordered ? '1px solid #e4e4e4' : undefined,
    }}>
      <span>{label}</span>
      <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{value}</span>
    </div>
  );
}

/**
 * 🔴 THE AUTHORITATIVE DECIMAL STRING IS FORMATTED, NEVER PARSED. `TEC-015` / `OSC-043` — a money
 * value that round-trips through a JavaScript number is no longer the exact amount, and an invoice
 * is the last place that may happen.
 */
function money(value: string | null): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return formatMoneyForDisplay(value) ?? '—';
}

/** `0.000` prints as `0`, `15.000` as `15`, and `7.500` as `7.5`. */
function trimRate(rate: string | number): string {
  return String(rate).replace(/\.?0+$/, '') || '0';
}

type InvoiceLine = {
  readonly name: string | null;
  readonly sku: string | null;
  readonly quantity: number;
  readonly unitPrice: string | null;
  readonly lineTotal: string | null;
};

type InvoiceView = {
  readonly invoiceNumber: string;
  readonly issuedAt: string;
  readonly customerName: string;
  readonly customerPhone: string | null;
  readonly customerAddress: string | null;
  readonly externalOrderReference: string | null;
  readonly consignmentReference: string | null;
  readonly subtotal: string;
  readonly deliveryCharge: string | null;
  /** ⚠ `null` means no rate is configured — nobody has decided (`SYS-034`), not zero. */
  readonly taxRatePercent: string | null;
  readonly taxAmount: string | null;
  readonly total: string;
  /** `BR-127` — money received before delivery; `null` = none recorded. */
  readonly advanceReceived?: string | null;
  /** `INV-39.2` — total less the advance, fixed at issue; `null` = the total is the balance. */
  readonly balanceDue?: string | null;
  readonly lines: readonly InvoiceLine[];
  /** BR-197 — D7 .. Y12, or null. */
  readonly warrantyTerm?: string | null;
  /** The note typed on the order, or null. */
  readonly note?: string | null;
};

/* ------------------------------------------------------------------ styles */

/**
 * ⚠ THE ONLY PLACE IN THE APPLICATION WITH PRINT CSS, AND IT IS SCOPED TO THIS PAGE.
 * `@page` sets A4 with no browser margin so the sheet's own 48px padding is the margin — otherwise
 * the document prints inside two margins and loses its geometry.
 */
const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

@media print {
  @page { size: A4; margin: 0; }
  html, body { height: auto !important; background: #ffffff !important; }

  /* The application shell is a 100vh box that scrolls inside itself. On paper it must be an ordinary
     block, or it clips the sheet at the first screenful and then leaves a blank second page behind. */
  .app-shell-root, .app-shell-column {
    display: block !important; height: auto !important; overflow: visible !important;
    background: #ffffff !important;
  }
  aside, nav, header.app-header, [data-testid="page-header"], .invoice-no-print { display: none !important; }
  [data-testid="content-region"], [data-testid="main-workspace"], .invoice-page {
    display: block !important; height: auto !important; overflow: visible !important;
    padding: 0 !important; margin: 0 !important; width: auto !important;
    min-width: 0 !important; max-width: none !important;
  }
  * { animation: none !important; transform: none !important; }

  /* The sheet flows from the top-left corner. Its height is its CONTENT, so a short invoice is exactly
     one page and a long one continues onto the next — never a forced second page. */
  [data-testid="invoice-sheet"] {
    width: 210mm !important; min-height: 0 !important; margin: 0 !important;
    box-shadow: none !important; border-radius: 0 !important; overflow: visible !important;
  }
  /* The black table header and the black Balance Due block are BACKGROUNDS, which browsers drop from
     print unless told otherwise; without them the white text on them vanishes. */
  [data-testid="invoice-sheet"], [data-testid="invoice-sheet"] * {
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  /* A row or the totals block is never cut in half; the table header repeats on a second page. */
  [data-testid="invoice-sheet"] tr { break-inside: avoid; }
  [data-testid="invoice-sheet"] thead { display: table-header-group; }
  [data-testid="invoice-totals"] { break-inside: avoid; }
}
`;

/*
  ⚠ THE SHEET SITS ON THE APPLICATION BACKGROUND, NOT IN A GREY BOX OF ITS OWN. It previously
  painted `#f0f0f0` behind itself, which put a second, slightly different grey inside the page's
  own `--color-app-background` and read as a panel the document was trapped in.
*/
const pageStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};

function PrinterIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9V4h12v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 16h10v4H7z" />
    </svg>
  );
}

const crumbLinkStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  textDecoration: 'underline',
};

/** A4 at 96dpi, which is what the approved design fixes. */
const sheetStyle: React.CSSProperties = {
  width: '794px',
  minHeight: '1123px',
  background: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
  borderRadius: '6px',
  overflow: 'hidden',
  fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
  color: '#1a1a1a',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '36px 48px 28px',
  borderBottom: '1px solid #e4e4e4',
};


const sellerStyle: React.CSSProperties = {
  fontSize: '12.5px',
  color: '#555555',
  lineHeight: 1.65,
  marginTop: '14px',
};

const invoiceWordStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '13px',
  letterSpacing: '3px',
  color: '#111111',
  textTransform: 'uppercase',
};

const refBlockStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#4a4a4a',
  marginTop: '12px',
  lineHeight: 1.7,
};

const billRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '48px',
  padding: '28px 48px 24px',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: '#9a9a9a',
  fontWeight: 600,
  marginBottom: '12px',
};

const customerNameStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '15px',
  color: '#111111',
};

const itemsTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  overflow: 'hidden',
};

const thStyle: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: '#ffffff',
  fontWeight: 600,
  padding: '14px 16px',
};

const itemRowStyle: React.CSSProperties = {
  background: '#ffffff',
  borderBottom: '1px solid #f0f0f0',
  // ⚠ A row must not split across a page break, or its figures orphan from its description.
  breakInside: 'avoid',
};

const skuStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: '#9a9a9a',
  marginTop: '3px',
};

const totalsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '40px',
  padding: '24px 48px 8px',
  alignItems: 'flex-start',
};

const noteStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: '#555555',
  lineHeight: 1.7,
  textAlign: 'justify',
};

const balanceDueStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  marginTop: '14px',
  background: '#3f444d',
  color: '#ffffff',
  borderRadius: '6px',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '24px 48px',
  marginTop: '20px',
  background: '#f7f7f7',
  borderTop: '1px solid #e4e4e4',
  color: '#111111',
};

const messageStyle: React.CSSProperties = {
  padding: 'var(--space-8)',
  fontSize: '14px',
  color: 'var(--color-text-primary)',
  maxWidth: '640px',
};

const reasonStyle: React.CSSProperties = {
  margin: 'var(--space-3) 0 0',
  fontSize: '13px',
  lineHeight: 1.6,
  color: 'var(--color-text-muted)',
};
