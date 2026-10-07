import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import logoUrl from '../assets/brand/trioloo-logo-black.png';
import { PRINT_CSS } from '../order/InvoicePage';
import { FilterSelect, KpiStrip, messageOf, stateTone } from '../masterdata/MasterDataParts';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { displayMoney } from '../product/stockItemApi';
import { fetchSupplierLedger, LEDGER_TYPES } from './supplierLedgerApi';
import type { Ledger } from './supplierLedgerApi';

/**
 * The Supplier Ledger - a VIEW over existing records, never a record of its own (`PRC-052`, `SYS-090`, `DB-067`).
 *
 * <p>🔴 A purchase order is a commitment, not a liability (`PRC-068.e`), so orders appear as MEMO lines and never move the
 * balance. The money columns stay empty until goods receipts and supplier payments exist, and the outstanding balance is shown
 * as "—", never as zero (`PRC-067.b`).
 *
 * <p>Printing prints exactly what the filters on screen select - the same entries, the same dates - on an A4 sheet.
 */
const LEDGER_PRINT_CSS = `${PRINT_CSS.replaceAll('invoice-sheet', 'ledger-sheet').replaceAll('invoice-totals', 'ledger-totals')}
.ledger-print-only { display: none; }
@media print { .ledger-print-only { display: block !important; } .ledger-screen-only { display: none !important; } }`;

const ink = '#111111';
const grey = '#6b6b6b';
const rule = '#d9d9d9';

const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The dates a quick period stands for; weeks start on Monday, as on the Suppliers list. */
function periodDates(period: string): { from: string; to: string } {
  const today = new Date();
  if (period === 'today') return { from: isoDay(today), to: isoDay(today) };
  if (period === 'week') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: isoDay(monday), to: isoDay(today) };
  }
  if (period === 'month') return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDay(today) };
  return { from: '', to: '' };
}

const dateInput: React.CSSProperties = { height: '34px', borderRadius: '9px', padding: '0 10px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)' };
const th: React.CSSProperties = { padding: '9px 10px', fontSize: '11px', fontWeight: 600, textAlign: 'left' };
const num: React.CSSProperties = { textAlign: 'right' };

export default function SupplierLedgerPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let live = true;
    setLoading(true);
    fetchSupplierLedger(id, { from, to, type }).then((l) => { if (live) { setLedger(l); setError(null); } })
      .catch((cause) => { if (live) setError(messageOf(cause, 'The ledger could not be loaded.')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, from, to, type]);

  const filterText = useMemo(() => {
    const parts = [
      from || to ? `Dates: ${from || 'the beginning'} to ${to || 'today'}` : 'Dates: all',
      `Type: ${LEDGER_TYPES.find(([v]) => v === type)?.[1] ?? 'All types'}`,
    ];
    return parts.join('  ·  ');
  }, [from, to, type]);

  if (error && !ledger) return <Card><EmptyState title="Supplier ledger not available" guidance={error} /></Card>;
  if (!ledger) return <Card><EmptyState title="Loading…" guidance="Preparing the ledger." /></Card>;

  const s = ledger.supplier;
  const entries = ledger.entries;
  const today = isoDay(new Date());

  const choosePeriod = (value: string): void => {
    setPeriod(value);
    const d = periodDates(value);
    setFrom(d.from);
    setTo(d.to);
  };

  return (
    <>
      <style>{LEDGER_PRINT_CSS}</style>
      <PageHeader
        title="Supplier ledger"
        subtitle={s.name}
        breadcrumb={<><span>Inventory</span><span>/</span><span>Suppliers</span><span>/</span><span style={{ fontWeight: 600 }}>{s.name}</span></>}
        actions={
          <>
            <Button variant="secondary" size="page-header" onClick={() => navigate('/purchasing/suppliers')} testId="ledger-back">Back to Suppliers</Button>
            <Button variant="primary" size="page-header" onClick={() => window.print()} testId="ledger-print">Print ledger</Button>
          </>
        }
      />

      <div className="ledger-screen-only">
        <KpiStrip kpis={[
          { key: 'orders', label: 'ORDERS PLACED', value: ledger.orders },
          { key: 'ordered', label: 'TOTAL ORDERED', value: `${s.currency} ${displayMoney(ledger.totalOrdered)}` },
          { key: 'balance', label: 'OUTSTANDING BALANCE', value: ledger.outstandingBalance != null ? `${s.currency} ${displayMoney(ledger.outstandingBalance)}` : '—' },
        ]} />
        <div data-testid="ledger-filters" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'nowrap' }}>
          <FilterSelect label="Period" testId="ledger-filter-period" value={period} onChange={choosePeriod}
            options={[['today', 'Today'], ['week', 'This week'], ['month', 'This month']]} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>From
            <input type="date" data-testid="ledger-from" value={from} max={to || undefined} onChange={(e) => { setPeriod(''); setFrom(e.target.value); }} style={dateInput} />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>To
            <input type="date" data-testid="ledger-to" value={to} min={from || undefined} onChange={(e) => { setPeriod(''); setTo(e.target.value); }} style={dateInput} />
          </label>
          <FilterSelect label="Type" testId="ledger-filter-type" value={type} onChange={setType} options={LEDGER_TYPES.filter(([v]) => v !== '')} />
          {(from || to || type) ? (
            <button type="button" data-testid="ledger-clear" onClick={() => { setPeriod(''); setFrom(''); setTo(''); setType(''); }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>Clear filters</button>
          ) : null}
        </div>

        {loading ? <Card><EmptyState title="Loading…" guidance="Applying the filters." /></Card>
          : entries.length === 0 ? <Card><EmptyState title="No ledger entries" guidance={from || to || type ? 'Nothing matches these filters. Clear them to see every entry.' : 'No purchase order, receipt or payment has been recorded for this supplier yet.'} /></Card>
          : (
            <Card>
              <table data-testid="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-tab-container)' }}>
                    {['Date', 'Reference', 'Particulars', 'Status'].map((h) => <th key={h} style={th}>{h}</th>)}
                    {['Ordered (memo)', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} style={{ ...th, ...num }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const tone = stateTone(e.status === 'DRAFT' ? 'AWAITING' : e.status);
                    return (
                      <tr key={`${e.type}-${e.reference}`} data-testid="ledger-row" style={{ borderTop: '1px solid var(--color-border-card)', opacity: e.status === 'CANCELLED' ? 0.5 : 1 }}>
                        <td style={{ padding: '10px' }}>{e.date}</td>
                        <td style={{ padding: '10px', fontWeight: 650 }}>{e.reference}</td>
                        <td style={{ padding: '10px', color: 'var(--color-text-secondary)' }}>{e.description}</td>
                        <td style={{ padding: '10px' }}><span style={{ fontSize: '11px', fontWeight: 650, padding: '2px 8px', borderRadius: '999px', background: tone.bg, color: tone.fg }}>{tone.label}</span></td>
                        <td className="tabular-nums" style={{ padding: '10px', ...num }}>{displayMoney(e.ordered)}</td>
                        <td style={{ padding: '10px', ...num }}>—</td>
                        <td style={{ padding: '10px', ...num }}>—</td>
                        <td style={{ padding: '10px', ...num }}>—</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border-card)' }}>
                Purchase orders are commitments - they are listed for reference and do not change what is owed. Debit, credit and balance fill in once goods are received and payments are made.
              </div>
            </Card>
          )}
      </div>

      {/* ---------------------------------------------------------------- the A4 sheet: exactly what the filters select */}
      <div className="ledger-print-only invoice-page">
        <article data-testid="ledger-sheet"
          style={{ width: '794px', boxSizing: 'border-box', padding: '40px 44px', background: '#ffffff', color: ink, fontFamily: "'Hanken Grotesk', system-ui, sans-serif", fontSize: '12px', lineHeight: 1.45 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            <div>
              <img src={logoUrl} alt="Trioloo" style={{ height: '44px', width: 'auto', display: 'block' }} />
              <div style={{ marginTop: '8px', fontSize: '11px', color: grey }}>R.B Tower 4th Floor (Lift-3), 56/9, Panthapath, Dhaka-1205, Bangladesh<br />01963-956474 · trioloobd@gmail.com</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '22px', fontWeight: 700 }}>SUPPLIER LEDGER</div>
              <div style={{ fontSize: '11px', color: grey, marginTop: '4px' }}>Printed {today}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', margin: '22px 0 16px', padding: '14px 0', borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}` }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: grey }}>SUPPLIER</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{s.name}</div>
              <div style={{ color: grey }}>{[s.contactName, s.phone].filter(Boolean).join(' · ')}{s.address ? <><br />{s.address}</> : null}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: grey }}>
              <div style={{ fontWeight: 700, color: ink }}>Filters applied</div>
              <div data-testid="ledger-sheet-filters">{filterText}</div>
              <div>Currency: {s.currency}</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <thead>
              <tr style={{ background: ink, color: '#ffffff' }}>
                {['Date', 'Reference', 'Particulars'].map((h) => <th key={h} style={th}>{h}</th>)}
                {['Ordered (memo)', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} style={{ ...th, ...num }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '16px 10px', textAlign: 'center', color: grey }}>No entries for these filters.</td></tr>
              ) : entries.map((e) => (
                <tr key={`${e.type}-${e.reference}`} data-testid="ledger-sheet-row" style={{ borderBottom: `1px solid ${rule}` }}>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{e.date}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 650, whiteSpace: 'nowrap' }}>{e.reference}</td>
                  <td style={{ padding: '7px 10px' }}>{e.description}{e.status === 'CANCELLED' ? ' - cancelled' : ''}</td>
                  <td style={{ padding: '7px 10px', ...num }}>{displayMoney(e.ordered)}</td>
                  <td style={{ padding: '7px 10px', ...num }}>—</td>
                  <td style={{ padding: '7px 10px', ...num }}>—</td>
                  <td style={{ padding: '7px 10px', ...num }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div data-testid="ledger-totals" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <div style={{ width: '300px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: grey }}>Orders placed (not cancelled)</span><strong>{ledger.orders}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: grey }}>Total ordered (memo)</span><strong>{s.currency} {displayMoney(ledger.totalOrdered)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', marginTop: '6px', background: ink, color: '#ffffff', borderRadius: '6px' }}>
                <span>Outstanding balance</span><strong>{ledger.outstandingBalance != null ? `${s.currency} ${displayMoney(ledger.outstandingBalance)}` : '—'}</strong>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '18px', fontSize: '10.5px', color: grey }}>
            Purchase orders are commitments and do not change what is owed. Debit, credit and the outstanding balance are filled in from goods receipts and payments, which are not recorded yet.
          </div>
        </article>
      </div>
    </>
  );
}
