import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FormBox, messageOf, useDebounced } from '../masterdata/MasterDataParts';
import { listSuppliers } from '../masterdata/masterDataApi';
import type { Supplier } from '../masterdata/masterDataApi';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { displayMoney, listStockItems } from '../product/stockItemApi';
import type { StockItem } from '../product/stockItemApi';
import { createPurchaseOrder, displayQuantity, fetchPurchaseOrder, lineTotal, sumTotals, updatePurchaseOrder } from './purchaseApi';
import type { PurchaseOrderDetail } from './purchaseApi';

/**
 * Create or amend a Purchase Order. A PAGE, never a modal: it is a multi-line workflow (`UX-151`).
 *
 * <p>Lines are Product Variants - Stock Items - never sellable products (`PRC-032`, `INV-66.1`). Quantity and unit cost are
 * typed as TEXT and sent as text; totals shown while typing are exact (`BigInt`) and the server recomputes (`TEC-015`).
 * A unit cost is never rounded for the person (`DB-079`). Every order is in taka: the business buys in BDT only, so there is
 * no currency to choose.
 *
 * <p>The search never offers a DISCONTINUED or archived Stock Item (`PRD-207`): buying something the business has stopped
 * selling is almost always a mistake. The right-hand summary only restates what has been typed; it decides nothing.
 *
 * <p>Once an order is approved, an amendment needs a reason and the supplier's agreement (`PRC-023`, `PRC-026`).
 */
type Line = { key: number; productVariantId: string; sku: string; name: string; category: string | null; onHand: string; quantity: string; unitCost: string };

const CURRENCY = 'BDT';
let nextKey = 1;

const label: React.CSSProperties = { fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' };
const selectStyle: React.CSSProperties = { height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)', width: '100%', boxSizing: 'border-box' };
const numberInput: React.CSSProperties = { height: '36px', borderRadius: '9px', padding: '0 10px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', textAlign: 'right', boxSizing: 'border-box', background: 'var(--color-surface)' };

export default function PurchaseOrderFormPage({ mode }: { readonly mode: 'create' | 'edit' }): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<readonly Supplier[]>([]);
  const [loaded, setLoaded] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<readonly Line[]>([]);
  const [reason, setReason] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listSuppliers({ page: 0, size: 100 }).then((p) => setSuppliers(p.content.filter((s) => s.recordStatus === 'ACTIVE'))).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    setLoading(true);
    fetchPurchaseOrder(id).then((detail) => {
      setLoaded(detail);
      setSupplierId(detail.order.supplierId);
      setOrderDate(detail.order.orderDate);
      setExpectedDate(detail.order.expectedDate ?? '');
      setReference(detail.order.supplierOrderReference ?? '');
      setLines(detail.items.map((i) => ({ key: nextKey++, productVariantId: i.productVariantId, sku: i.sku, name: i.name, category: null, onHand: '',
        quantity: displayQuantity(i.quantityOrdered), unitCost: displayMoney(i.unitCost) })));
    }).catch((cause) => setError(messageOf(cause, 'The order could not be loaded.'))).finally(() => setLoading(false));
  }, [id, mode]);

  // The expected delivery follows the order date until the person sets a different one themselves.
  const changeOrderDate = (value: string): void => {
    if (expectedDate === '' || expectedDate === orderDate) setExpectedDate(value);
    setOrderDate(value);
  };

  const approved = loaded != null && loaded.order.status !== 'DRAFT';
  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;

  const totals = lines.map((l) => lineTotal(l.quantity, l.unitCost));
  const orderTotal = lines.length > 0 ? sumTotals(totals) : '0';
  const units = sumUnits(lines);

  const addProduct = (item: StockItem): void => {
    if (lines.some((l) => l.productVariantId === item.id)) {
      setError(`${item.inventorySku} is already on this order. Change its quantity instead.`);
      return;
    }
    setError(null);
    setLines((current) => [...current, { key: nextKey++, productVariantId: item.id, sku: item.inventorySku, name: item.technicalName,
      category: item.inventoryCategory, onHand: item.physicalStock, quantity: '1', unitCost: item.referenceCost ? displayMoney(item.referenceCost) : '' }]);
  };
  const change = (key: number, patch: Partial<Line>): void => setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const problem = ((): string | null => {
    if (supplierId === '') return 'Choose the supplier.';
    if (lines.length === 0) return 'Add at least one product.';
    if (lines.some((l) => lineTotal(l.quantity, l.unitCost) === null || /^0*\.?0*$/.test(l.quantity.trim()))) return 'Every line needs a quantity above zero and a unit cost.';
    if (approved && reason.trim() === '') return 'An approved order is changed only with a reason.';
    if (approved && !agreed) return 'An approved order is changed only with the supplier’s agreement - confirm they agreed.';
    return null;
  })();

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        supplierId, orderDate: orderDate || null, expectedDate: expectedDate || null, currency: CURRENCY,
        supplierOrderReference: reference || null,
        items: lines.map((l) => ({ productVariantId: l.productVariantId, quantity: l.quantity.trim(), unitCost: l.unitCost.trim() })),
        reason: approved ? reason : null, supplierAgreed: approved ? agreed : null, version: loaded?.order.version ?? null,
      };
      if (mode === 'create') {
        const created = await createPurchaseOrder(body);
        void navigate(`/purchasing/purchases/${created.id}`);
      } else if (id) {
        await updatePurchaseOrder(id, body);
        void navigate(`/purchasing/purchases/${id}`);
      }
    } catch (cause) {
      setError(messageOf(cause, 'The order could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card><EmptyState title="Loading…" guidance="Fetching the purchase order." /></Card>;
  if (mode === 'edit' && loaded && !loaded.order.amendable) {
    return <Card><EmptyState title="This order can no longer be amended" guidance="Once the supplier has shipped, or the order is closed or cancelled, it is resolved by agreement with the supplier and the outcome recorded." /></Card>;
  }

  const section = (title: string, hint?: string): React.JSX.Element => (
    <div style={{ padding: '18px 22px 10px' }}>
      <div style={{ fontSize: '14px', fontWeight: 750 }}>{title}</div>
      {hint ? <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{hint}</div> : null}
    </div>
  );

  return (
    <>
      <PageHeader
        title={mode === 'create' ? 'New purchase order' : `Amend ${loaded?.order.poNumber ?? 'purchase order'}`}
        breadcrumb={<><span>Inventory</span><span>/</span><Link to="/purchasing/purchases" style={{ color: 'inherit' }}>Purchasing</Link><span>/</span><span style={{ fontWeight: 600 }}>{mode === 'create' ? 'New' : 'Amend'}</span></>}
        subtitle="Procurement buys Stock Items - physical things - never sellable products"
        actions={<Button variant="secondary" size="page-header" onClick={() => navigate(mode === 'edit' && id ? `/purchasing/purchases/${id}` : '/purchasing/purchases')} testId="po-back">{mode === 'edit' ? 'Back to order' : 'Back to Purchasing'}</Button>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '20px', alignItems: 'start' }}>
        {/* ------------------------------------------------------------------ main column */}
        <div style={{ display: 'grid', gap: '16px', minWidth: 0 }}>
          <Card>
            {section('Order details', 'Who you are buying from and when')}
            <div style={{ padding: '0 22px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
              <FormBox label="Supplier" testId="po-supplier" value={supplierId} onChange={setSupplierId} required>
                <select data-testid="po-supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} style={selectStyle}>
                  <option value="">Choose a supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormBox>
              <FormBox label="Supplier’s own reference" testId="po-reference" value={reference} onChange={setReference} hint="Their quotation or invoice number" />
              <FormBox label="Order date" testId="po-order-date" value={orderDate} onChange={changeOrderDate} type="date" hint="Today if left empty; the expected delivery follows it" />
              <FormBox label="Expected delivery" testId="po-expected-date" value={expectedDate} onChange={setExpectedDate} type="date" hint="When you expect the goods" />
            </div>
          </Card>

          <Card>
            {section('Products', 'Search a Stock Item to add it. Discontinued and archived items are not offered.')}
            <div style={{ padding: '0 22px 18px' }}>
              <ProductPicker onPick={addProduct} />
              {lines.length === 0 ? (
                <div data-testid="po-no-lines" style={{ margin: '14px 0 4px', padding: '28px 16px', borderRadius: '12px', border: '1px dashed var(--color-border-control)', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                  No lines yet - search a product above to add it.
                </div>
              ) : (
                <div data-testid="po-lines" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                  {lines.map((l, index) => (
                    <div key={l.key} data-testid="po-line" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--color-border-card)', background: 'var(--color-surface)', flexWrap: 'nowrap' }}>
                      <span aria-hidden="true" style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-tab-container)', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ fontFamily: 'var(--font-family-mono)' }}>{l.sku}</span>{l.category ? ` · ${l.category}` : ''}{l.onHand !== '' ? ` · ${displayQuantity(l.onHand)} on hand` : ''}
                        </div>
                      </div>
                      <label style={{ display: 'grid', gap: '2px', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-demoted)' }}>QUANTITY</span>
                        <input data-testid={`po-qty-${index}`} aria-label={`Quantity of ${l.sku}`} value={l.quantity} onChange={(event) => change(l.key, { quantity: event.target.value })} style={{ ...numberInput, width: '88px' }} inputMode="decimal" />
                      </label>
                      <label style={{ display: 'grid', gap: '2px', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-demoted)' }}>UNIT COST (৳)</span>
                        <input data-testid={`po-cost-${index}`} aria-label={`Unit cost of ${l.sku}`} value={l.unitCost} onChange={(event) => change(l.key, { unitCost: event.target.value })} style={{ ...numberInput, width: '120px' }} inputMode="decimal" />
                      </label>
                      <div style={{ width: '124px', textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-demoted)' }}>LINE TOTAL</div>
                        <div className="tabular-nums" data-testid={`po-line-total-${index}`} style={{ fontSize: '14px', fontWeight: 750, marginTop: '6px' }}>{totals[index] ? displayMoney(totals[index]) : '—'}</div>
                      </div>
                      <button type="button" aria-label={`Remove ${l.sku}`} data-testid={`po-remove-${index}`} onClick={() => setLines((current) => current.filter((x) => x.key !== l.key))}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '20px', lineHeight: 1, color: 'var(--color-text-secondary)', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {approved ? (
            <Card>
              {section('Changing an approved order', 'The supplier has to agree, and the reason is kept in the order’s history')}
              <div style={{ padding: '0 22px 20px', display: 'grid', gap: '12px' }}>
                <FormBox label="Reason for the change" testId="po-reason" value={reason} onChange={setReason} required wide />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                  <input type="checkbox" data-testid="po-agreed" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                  The supplier agreed to this change
                </label>
              </div>
            </Card>
          ) : null}
        </div>

        {/* ------------------------------------------------------------------ summary sidebar */}
        <aside data-testid="po-summary" style={{ position: 'sticky', top: '16px', display: 'grid', gap: '14px' }}>
          <Card>
            <div style={{ padding: '18px 20px', display: 'grid', gap: '14px' }}>
              <div style={label}>ORDER SUMMARY</div>
              <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                <Row k="Lines" v={String(lines.length)} testId="po-sum-lines" />
                <Row k="Total units" v={units ?? '—'} testId="po-sum-units" />
                <Row k="Currency" v={`${CURRENCY} (taka)`} />
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-card)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '13px', fontWeight: 650 }}>Order value</span>
                <span className="tabular-nums" data-testid="po-total" style={{ fontSize: '20px', fontWeight: 850 }}>৳ {orderTotal ? displayMoney(orderTotal) : '—'}</span>
              </div>
              {lines.length > 0 ? (
                <div data-testid="po-sum-lines-list" style={{ display: 'grid', gap: '6px', borderTop: '1px solid var(--color-border-card)', paddingTop: '12px' }}>
                  {lines.map((l, i) => (
                    <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }}>
                      <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-text-secondary)' }}>{l.quantity || '0'} × {l.sku}</span>
                      <span className="tabular-nums" style={{ fontWeight: 650, flexShrink: 0 }}>{totals[i] ? displayMoney(totals[i]) : '—'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div style={{ padding: '18px 20px', display: 'grid', gap: '10px' }}>
              <div style={label}>SUPPLIER</div>
              {supplier ? (
                <div data-testid="po-sum-supplier" style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{supplier.name}</div>
                  {supplier.contactName ? <Row k="Contact" v={supplier.contactName} /> : null}
                  {supplier.phone ? <Row k="Phone" v={supplier.phone} /> : null}
                  {supplier.email ? <Row k="Email" v={supplier.email} /> : null}
                  {supplier.address ? <Row k="Address" v={supplier.address} /> : null}
                </div>
              ) : <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>No supplier chosen yet.</div>}
            </div>
          </Card>

          <Card>
            <div style={{ padding: '18px 20px', display: 'grid', gap: '8px', fontSize: '13px' }}>
              <div style={label}>DATES &amp; APPROVAL</div>
              <Row k="Order date" v={orderDate || 'Today'} />
              <Row k="Expected" v={expectedDate || 'Not set'} />
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: '4px' }}>
                {approved ? 'This order is approved. A change needs the supplier’s agreement and is recorded with its reason.'
                  : 'A new order waits for approval. Someone other than its creator approves it - the Owner may approve their own. It writes no stock and no payable.'}
              </div>
            </div>
          </Card>

          {error ? <div role="alert" data-testid="po-error" style={{ color: 'var(--color-destructive)', fontSize: '12.5px', fontWeight: 600 }}>{error}</div> : null}
          <div style={{ display: 'grid', gap: '8px' }}>
            <Button variant="primary" size="button" onClick={() => void save()} disabled={busy || problem !== null} testId="po-save">{busy ? 'Saving…' : mode === 'create' ? 'Create order' : 'Save changes'}</Button>
            {problem ? <span data-testid="po-problem" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{problem}</span> : null}
            <Link to={mode === 'edit' && id ? `/purchasing/purchases/${id}` : '/purchasing/purchases'} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center' }}>Cancel</Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ k, v, testId }: { readonly k: string; readonly v: string; readonly testId?: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
      <span data-testid={testId} className="tabular-nums" style={{ fontWeight: 650, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  );
}

/** Sum of the quantities typed, exactly; `null` while any is not a number. */
function sumUnits(lines: readonly Line[]): string | null {
  let sum = 0n;
  for (const l of lines) {
    const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(l.quantity.trim());
    if (!m) return null;
    sum += BigInt((m[1] ?? '0') + (m[2] ?? '').padEnd(4, '0'));
  }
  const digits = sum.toString().padStart(5, '0');
  const fraction = digits.slice(-4).replace(/0+$/, '');
  return fraction ? `${digits.slice(0, -4)}.${fraction}` : digits.slice(0, -4);
}

/** Searches the Stock Items by word and offers the matches; choosing one adds it as a line. Discontinued items are never offered. */
function ProductPicker({ onPick }: { readonly onPick: (item: StockItem) => void }): React.JSX.Element {
  const [text, setText] = useState('');
  const query = useDebounced(text);
  const [results, setResults] = useState<readonly StockItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [closest, setClosest] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Any typing searches; the arrow lists the first products without typing.
    if (query.trim().length < 1 && !open) {
      setResults([]);
      setSearched(false);
      return;
    }
    let live = true;
    void listStockItems({ search: query.trim(), status: 'ACTIVE', discontinued: 'hide' }, 0, 12, 'technicalName', 'ASC').then((page) => {
      // When nothing matches exactly the server offers the closest items; they are shown, labelled, so the person can still find what they mean.
      if (live) { setResults(page.content.filter((i) => !i.discontinued && i.recordStatus === 'ACTIVE')); setClosest(page.recommended === true); setSearched(true); }
    }).catch(() => { if (live) { setResults([]); setSearched(true); } });
    return () => { live = false; };
  }, [query, open]);

  return (
    <div style={{ position: 'relative' }}>
      <input data-testid="po-product-search" value={text} onChange={(event) => { setText(event.target.value); setOpen(false); }} placeholder="Search a product by name, SKU or barcode" aria-label="Search a product"
        style={{ width: '100%', height: '40px', borderRadius: '10px', padding: '0 40px 0 14px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--color-surface)' }} />
      <button type="button" data-testid="po-product-toggle" aria-label="Show products" aria-expanded={open} onClick={() => { setText(''); setOpen((v) => !v); }}
        style={{ position: 'absolute', right: '4px', top: '4px', width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {results.length > 0 ? (
        <div data-testid="po-product-results" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '44px', background: 'var(--color-surface)', border: '1px solid var(--color-border-card)', borderRadius: '10px', boxShadow: '0 12px 30px oklch(0 0 0 / 0.12)', overflow: 'hidden' }}>
          {closest ? <div data-testid="po-product-closest" style={{ padding: '8px 14px', fontSize: '11.5px', fontWeight: 700, background: 'var(--color-tab-container)', color: 'var(--color-text-secondary)' }}>No exact match - closest products</div> : null}
          {results.map((item) => (
            <button key={item.id} type="button" data-testid="po-product-result" onClick={() => { onPick(item); setText(''); setResults([]); setOpen(false); }}
              style={{ display: 'flex', width: '100%', gap: '12px', alignItems: 'center', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--color-border-card)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '11.5px', fontWeight: 700, width: '90px', flexShrink: 0 }}>{item.inventorySku}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.technicalName}</span>
              <span className="tabular-nums" style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                {displayQuantity(item.physicalStock)} on hand{item.referenceCost ? ` · ৳ ${displayMoney(item.referenceCost)}` : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {searched && results.length === 0 && (query.trim().length >= 1) ? <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>Nothing close to that. Discontinued items are not offered.</div> : null}
    </div>
  );
}
