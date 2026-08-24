import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button } from '../ui/primitives';
import { apiRequest } from '../platform/api';
import { formatMoneyForDisplay } from '../platform/money';
import { formatMoment } from '../platform/datetime';

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
  const backTo = origin === 'list' ? '/sales/orders' : `/sales/orders/${id}`;
  const backLabel = origin === 'list' ? 'Back to orders' : 'Back to order';
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      setInvoice(await apiRequest<InvoiceView>(`/api/accounting/orders/${id}/invoice`));
      setError(null);
    } catch (cause) {
      setInvoice(null);
      setError(cause instanceof Error ? cause.message : 'The invoice could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (loading) {
    return (
      <>
        {header('Sales invoice', null)}
        <p style={messageStyle}>Loading the invoice…</p>
      </>
    );
  }
  if (error || !invoice) {
    /*
      ⚠ AN UNISSUED INVOICE IS AN ANSWER, NOT A FAULT (`BR-134`). Most orders have none, and the
      page says so rather than showing an empty document that looks like a rendering failure.
    */
    return (
      <>
        {header('Sales invoice', null)}
        <p style={messageStyle} data-testid="invoice-absent">
          No invoice has been issued for this order yet.
        </p>
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

      <div style={pageStyle}>
        <article style={sheetStyle} data-testid="invoice-sheet">
          {/* ── Header ─────────────────────────────────────────────── */}
          <div style={headerStyle}>
            <div>
              <div style={logoSlotStyle}>TRIOLOO</div>
              <div style={sellerStyle}>
                R.B Tower 4th Floor (Lift-3), 56/9, Panthapath, Dhaka-1205, Bangladesh<br />
                01805-026454 · 01805-026465 · 01894-830932<br />
                trioloobd@gmail.com · contract@trioloo.com.bd
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={invoiceWordStyle}>INVOICE</div>
              <div style={refBlockStyle}>
                {/*
                  ✅ THE TRIOLOO NUMBER IS THE IDENTITY AND SITS FIRST; the courier booking and the
                  marketplace order number are REFERENCES after it — the product owner's ordering.
                  🔴 EACH NAMES ITS ISSUING PARTY (`DB-013`): two parties may legitimately issue the
                  same string, and the design's unlabelled `Parcel ID.` is exactly that ambiguity.
                */}
                <Ref label="No." value={invoice.invoiceNumber} strong />
                <Ref label="Steadfast booking" value={invoice.consignmentReference} />
                <Ref label="Daraz order" value={invoice.externalOrderReference} />
                <Ref label="Date" value={formatMoment(invoice.issuedAt) ?? '—'} />
              </div>
            </div>
          </div>

          {/* ── Bill to + bank ─────────────────────────────────────── */}
          <div style={billRowStyle}>
            <div style={{ flex: 1 }}>
              <div style={sectionLabelStyle}>Bill To</div>
              <div style={customerNameStyle}>{invoice.customerName}</div>
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
                <tr style={{ background: '#111111' }}>
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

          {/* ── Totals ─────────────────────────────────────────────── */}
          <div style={totalsRowStyle}>
            <div style={{ flex: 1, paddingTop: '2px' }}>
              <div style={sectionLabelStyle}>Note</div>
              <div style={noteStyle}>
                Physically damaged and burned items will not be covered under warranty.
              </div>
            </div>
            <div style={{ width: '340px', fontVariantNumeric: 'tabular-nums' }}>
              <TotalRow label="Subtotal" value={money(invoice.subtotal)} />
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
                <span style={{ fontSize: '14px', letterSpacing: '0.5px', fontWeight: 500 }}>Balance Due</span>
                <span style={{ fontSize: '22px', fontWeight: 700 }} data-testid="invoice-total">
                  {money(invoice.total)}
                </span>
              </div>
            </div>
          </div>

          <div style={footerStyle}>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Thank you for your purchase.</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>www.trioloo.com.bd</div>
          </div>
        </article>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

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

function TotalRow({ label, value, bordered }: {
  readonly label: string;
  readonly value: string;
  readonly bordered?: boolean;
}): React.JSX.Element {
  return (
    <div style={{
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
function trimRate(rate: string): string {
  return rate.replace(/\.?0+$/, '') || '0';
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
  readonly lines: readonly InvoiceLine[];
};

/* ------------------------------------------------------------------ styles */

/**
 * ⚠ THE ONLY PLACE IN THE APPLICATION WITH PRINT CSS, AND IT IS SCOPED TO THIS PAGE.
 * `@page` sets A4 with no browser margin so the sheet's own 48px padding is the margin — otherwise
 * the document prints inside two margins and loses its geometry.
 */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0; }
  body { background: #ffffff !important; }
  .invoice-no-print { display: none !important; }
  /* The shell is not part of the document. */
  nav, aside, header.app-header, [data-testid="page-header"] { display: none !important; }
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

const logoSlotStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '2px',
  color: '#111111',
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
  background: '#111111',
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
  color: 'var(--color-text-secondary)',
};
