import { useEffect, useMemo, useState } from 'react';
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
 * <p>Lines are Product Variants - Stock Items - never sellable products (`PRC-032`, `INV-66.1`). Quantity and unit cost
 * are typed as TEXT and sent as text; totals shown while typing are exact (`BigInt`), and the server recomputes
 * (`TEC-015`). A unit cost is never rounded for the person (`DB-079`).
 *
 * <p>Once an order is approved, an amendment needs a reason and the supplier's agreement (`PRC-023`, `PRC-026`); a draft
 * is edited freely. The supplier's currency is the default and each line carries it (`INV-66.3`).
 */
type Line = { key: number; productVariantId: string; sku: string; name: string; quantity: string; unitCost: string };

let nextKey = 1;

export default function PurchaseOrderFormPage({ mode }: { readonly mode: 'create' | 'edit' }): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<readonly Supplier[]>([]);
  const [loaded, setLoaded] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [currency, setCurrency] = useState('');
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
      setCurrency(detail.order.currency);
      setReference(detail.order.supplierOrderReference ?? '');
      setLines(detail.items.map((i) => ({ key: nextKey++, productVariantId: i.productVariantId, sku: i.sku, name: i.name,
        quantity: displayQuantity(i.quantityOrdered), unitCost: displayMoney(i.unitCost) })));
    }).catch((cause) => setError(messageOf(cause, 'The order could not be loaded.'))).finally(() => setLoading(false));
  }, [id, mode]);

  const approved = loaded != null && loaded.order.status !== 'DRAFT';
  const supplierCurrency = suppliers.find((s) => s.id === supplierId)?.currency;

  const totals = lines.map((l) => lineTotal(l.quantity, l.unitCost));
  const orderTotal = lines.length > 0 ? sumTotals(totals) : '0';

  const addProduct = (item: StockItem): void => {
    if (lines.some((l) => l.productVariantId === item.id)) {
      setError(`${item.inventorySku} is already on this order. Change its quantity instead.`);
      return;
    }
    setError(null);
    setLines((current) => [...current, { key: nextKey++, productVariantId: item.id, sku: item.inventorySku, name: item.technicalName,
      quantity: '1', unitCost: item.referenceCost ? displayMoney(item.referenceCost) : '' }]);
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
        supplierId, orderDate: orderDate || null, expectedDate: expectedDate || null, currency: currency || null,
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

  return (
    <>
      <PageHeader
        title={mode === 'create' ? 'New purchase order' : `Amend ${loaded?.order.poNumber ?? 'purchase order'}`}
        breadcrumb={<><span>Inventory</span><span>/</span><Link to="/purchasing/purchases" style={{ color: 'inherit' }}>Purchasing</Link><span>/</span><span style={{ fontWeight: 600 }}>{mode === 'create' ? 'New' : 'Amend'}</span></>}
        subtitle="Procurement buys Stock Items - physical things - never sellable products"
      />
      <Card>
        <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 24px' }}>
          <FormBox label="Supplier" testId="po-supplier" value={supplierId} onChange={setSupplierId} required>
            <select data-testid="po-supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setCurrency(''); }} style={selectStyle}>
              <option value="">Choose a supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormBox>
          <FormBox label="Order date" testId="po-order-date" value={orderDate} onChange={setOrderDate} type="date" hint="Today if left empty" />
          <FormBox label="Expected date" testId="po-expected-date" value={expectedDate} onChange={setExpectedDate} type="date" />
          <FormBox label="Currency" testId="po-currency" value={currency} onChange={setCurrency} hint={`Each line carries it - ${supplierCurrency ? `${supplierCurrency} if left empty` : 'the supplier’s if left empty'}`} />
          <FormBox label="Supplier order reference" testId="po-reference" value={reference} onChange={setReference} wide={false} />
        </div>

        <div style={{ padding: '0 22px 6px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>LINES</div>
        <div style={{ padding: '0 22px' }}>
          <ProductPicker onPick={addProduct} />
          {lines.length === 0 ? (
            <div data-testid="po-no-lines" style={{ padding: '18px 4px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>No lines yet - search a product above to add it.</div>
          ) : (
            <div data-testid="po-lines" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {lines.map((l, index) => (
                <div key={l.key} data-testid="po-line" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border-card)', flexWrap: 'nowrap' }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-mono)' }}>{l.sku}</div>
                  </div>
                  <label style={smallLabel}>Quantity
                    <input data-testid={`po-qty-${index}`} value={l.quantity} onChange={(event) => change(l.key, { quantity: event.target.value })} style={{ ...numberInput, width: '90px' }} inputMode="decimal" />
                  </label>
                  <label style={smallLabel}>Unit cost
                    <input data-testid={`po-cost-${index}`} value={l.unitCost} onChange={(event) => change(l.key, { unitCost: event.target.value })} style={{ ...numberInput, width: '120px' }} inputMode="decimal" />
                  </label>
                  <div style={{ width: '120px', textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-demoted)' }}>Line total</div>
                    <div className="tabular-nums" data-testid={`po-line-total-${index}`} style={{ fontSize: '13px', fontWeight: 700 }}>{totals[index] ? displayMoney(totals[index]) : '—'}</div>
                  </div>
                  <button type="button" aria-label={`Remove ${l.sku}`} data-testid={`po-remove-${index}`} onClick={() => setLines((current) => current.filter((x) => x.key !== l.key))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-secondary)' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 22px', fontSize: '14px' }}>
          <span style={{ fontWeight: 600, marginRight: '12px' }}>Order value</span>
          <span className="tabular-nums" data-testid="po-total" style={{ fontWeight: 850 }}>{currency || supplierCurrency || 'BDT'} {orderTotal ? displayMoney(orderTotal) : '—'}</span>
        </div>

        {approved ? (
          <div style={{ padding: '0 22px 16px', display: 'grid', gap: '12px' }}>
            <FormBox label="Reason for the change" testId="po-reason" value={reason} onChange={setReason} required wide />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
              <input type="checkbox" data-testid="po-agreed" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              The supplier agreed to this change
            </label>
          </div>
        ) : null}

        {error ? <div role="alert" data-testid="po-error" style={{ padding: '0 22px 14px', color: 'var(--color-destructive)', fontSize: '12.5px', fontWeight: 600 }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '0 22px 22px', alignItems: 'center' }}>
          <Button variant="primary" size="button" onClick={() => void save()} disabled={busy || problem !== null} testId="po-save">{busy ? 'Saving…' : mode === 'create' ? 'Create order' : 'Save changes'}</Button>
          <Link to={mode === 'edit' && id ? `/purchasing/purchases/${id}` : '/purchasing/purchases'} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Cancel</Link>
          {problem ? <span data-testid="po-problem" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{problem}</span> : null}
        </div>
      </Card>
    </>
  );
}

const selectStyle: React.CSSProperties = { height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)', width: '100%' };
const numberInput: React.CSSProperties = { height: '34px', borderRadius: '9px', padding: '0 10px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', textAlign: 'right', boxSizing: 'border-box' };
const smallLabel: React.CSSProperties = { display: 'grid', gap: '2px', fontSize: '10px', color: 'var(--color-text-demoted)', flexShrink: 0 };

/** Searches the Stock Items by word and offers the matches; choosing one adds it as a line. */
function ProductPicker({ onPick }: { readonly onPick: (item: StockItem) => void }): React.JSX.Element {
  const [text, setText] = useState('');
  const query = useDebounced(text);
  const [results, setResults] = useState<readonly StockItem[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let live = true;
    void listStockItems({ search: query }, 0, 8, 'technicalName', 'ASC').then((page) => {
      if (live) { setResults(page.content.filter((i) => i.recordStatus !== 'ARCHIVED')); setSearched(true); }
    }).catch(() => { if (live) { setResults([]); setSearched(true); } });
    return () => { live = false; };
  }, [query]);

  const hint = useMemo(() => (searched && results.length === 0 ? 'No product matches. Stock Items are created under Products.' : null), [searched, results]);

  return (
    <div style={{ position: 'relative' }}>
      <input data-testid="po-product-search" value={text} onChange={(event) => setText(event.target.value)} placeholder="Search a product by name or SKU to add a line" aria-label="Search a product"
        style={{ width: '100%', height: '38px', borderRadius: '10px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      {results.length > 0 ? (
        <div data-testid="po-product-results" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '42px', background: 'var(--color-surface)', border: '1px solid var(--color-border-card)', borderRadius: '10px', boxShadow: '0 12px 30px oklch(0 0 0 / 0.12)', overflow: 'hidden' }}>
          {results.map((item) => (
            <button key={item.id} type="button" data-testid="po-product-result" onClick={() => { onPick(item); setText(''); setResults([]); }}
              style={{ display: 'flex', width: '100%', gap: '12px', alignItems: 'center', padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--color-border-card)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '11.5px', fontWeight: 700, width: '90px', flexShrink: 0 }}>{item.inventorySku}</span>
              <span style={{ flex: 1, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.technicalName}</span>
            </button>
          ))}
        </div>
      ) : null}
      {hint ? <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>{hint}</div> : null}
    </div>
  );
}
