import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FormBox, messageOf } from '../masterdata/MasterDataParts';
import { listSuppliers, listWarehouses } from '../masterdata/masterDataApi';
import type { Supplier, Warehouse } from '../masterdata/masterDataApi';
import { PageHeader } from '../shell/AppShell';
import { Button, Card } from '../ui/primitives';
import { displayMoney } from '../product/stockItemApi';
import type { StockItem } from '../product/stockItemApi';
import { ProductPicker } from './PurchaseOrderFormPage';
import { displayQuantity, lineTotal, sumTotals } from './purchaseApi';
import { DISCREPANCIES, isShort, minQuantity, orderLines, receivableOrders, recordGoodsReceipt } from './receiptApi';
import type { ReceivableOrder } from './receiptApi';

/**
 * Record goods received. A PAGE, never a modal: it is a multi-line workflow (`UX-151`).
 *
 * <p>Receiving is line-level and partial receiving is normal (`PRC-030`): each line says how much ARRIVED and how much is
 * ACCEPTED. Accepted quantity enters stock at its cost; the rest is held, explained by one of four discrepancy types and enters
 * nothing (`PRC-034`, `PRC-038`). A purchase order is optional - a direct purchase is first-class (`PRC-018`) - and where one is
 * chosen, accepted quantity can never exceed what is still to come (`PRC-040`).
 *
 * <p>Deciding what is accepted is its own capability (`PRC-036`): someone who may only record sees accepted fixed at zero.
 * Quantities and costs are typed as TEXT and sent as text; the value shown is exact (`BigInt`) and the server decides (`TEC-015`).
 * A receipt creates no supplier payable yet (`PRC-047`).
 */
type Line = {
  key: number; purchaseOrderItemId: string | null; productVariantId: string; sku: string; name: string; remaining: string | null;
  received: string; accepted: string; unitCost: string; discrepancy: string; note: string;
};

let nextKey = 1;

const label: React.CSSProperties = { fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' };
const selectStyle: React.CSSProperties = { height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)', width: '100%', boxSizing: 'border-box' };
const numberInput: React.CSSProperties = { height: '36px', borderRadius: '9px', padding: '0 10px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', textAlign: 'right', boxSizing: 'border-box', background: 'var(--color-surface)' };
const tiny: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: 'var(--color-text-demoted)' };

export default function GoodsReceiptFormPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayAccept = permissions.includes('procurement.goods-receipt.accept');

  const [suppliers, setSuppliers] = useState<readonly Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<readonly Warehouse[]>([]);
  const [orders, setOrders] = useState<readonly ReceivableOrder[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [orderId, setOrderId] = useState(params.get('order') ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [invoice, setInvoice] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<readonly Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listSuppliers({ page: 0, size: 100 }).then((p) => setSuppliers(p.content.filter((s) => s.recordStatus === 'ACTIVE'))).catch(() => setSuppliers([]));
    void listWarehouses({ status: 'ACTIVE', page: 0, size: 50 }).then((p) => setWarehouses(p.content)).catch(() => setWarehouses([]));
  }, []);

  // Orders that can still receive goods - all of them until a supplier is chosen, then that supplier's.
  useEffect(() => {
    void receivableOrders(supplierId || undefined).then(setOrders).catch(() => setOrders([]));
  }, [supplierId]);

  // Choosing an order brings its supplier and its lines, each at what is still to come.
  useEffect(() => {
    if (!orderId) return;
    let live = true;
    void orderLines(orderId).then((rows) => {
      if (!live) return;
      setLines(rows.filter((r) => r.remaining !== '0' && !/^0+(\.0+)?$/.test(r.remaining)).map((r) => ({
        key: nextKey++, purchaseOrderItemId: r.purchaseOrderItemId, productVariantId: r.productVariantId, sku: r.sku, name: r.name,
        remaining: r.remaining, received: displayQuantity(r.remaining), accepted: mayAccept ? displayQuantity(r.remaining) : '0',
        unitCost: displayMoney(r.unitCost), discrepancy: '', note: '',
      })));
    }).catch((cause) => { if (live) setError(messageOf(cause, 'The order lines could not be loaded.')); });
    return () => { live = false; };
  }, [orderId, mayAccept]);

  useEffect(() => {
    if (!orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (order && order.supplierId !== supplierId) setSupplierId(order.supplierId);
  }, [orderId, orders, supplierId]);

  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const change = (key: number, patch: Partial<Line>): void => setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addProduct = (item: StockItem): void => {
    if (orderId) { setError('This receipt is against a purchase order - its lines come from the order. Choose "No purchase order" to receive other goods.'); return; }
    if (lines.some((l) => l.productVariantId === item.id)) { setError(`${item.inventorySku} is already on this receipt.`); return; }
    setError(null);
    setLines((current) => [...current, { key: nextKey++, purchaseOrderItemId: null, productVariantId: item.id, sku: item.inventorySku, name: item.technicalName,
      remaining: null, received: '1', accepted: mayAccept ? '1' : '0', unitCost: item.referenceCost ? displayMoney(item.referenceCost) : '', discrepancy: '', note: '' }]);
  };

  const acceptedValue = lines.map((l) => lineTotal(l.accepted, l.unitCost));
  const total = lines.length > 0 ? sumTotals(acceptedValue) : '0';
  const unitsReceived = sumQuantities(lines.map((l) => l.received));
  const unitsAccepted = sumQuantities(lines.map((l) => l.accepted));
  const issues = lines.filter((l) => isShort(l.received, l.accepted)).length;

  const problem = ((): string | null => {
    if (supplierId === '') return 'Choose the supplier.';
    if (lines.length === 0) return orderId ? 'Nothing is left to receive on this order.' : 'Add at least one product.';
    for (const l of lines) {
      if (lineTotal(l.received, l.unitCost) === null || /^0*\.?0*$/.test(l.received.trim())) return `${l.sku}: enter the quantity received and the unit cost.`;
      if (lineTotal(l.accepted, '0') === null) return `${l.sku}: the accepted quantity must be a number.`;
      if (compare(l.accepted, l.received) > 0) return `${l.sku}: accepted cannot be more than received.`;
      if (l.remaining !== null && compare(l.accepted, l.remaining) > 0) return `${l.sku}: only ${displayQuantity(l.remaining)} is still to come - accept up to that.`;
      if (isShort(l.received, l.accepted) && l.discrepancy === '') return `${l.sku}: say why the rest is not accepted.`;
    }
    return null;
  })();

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const created = await recordGoodsReceipt({
        supplierId, purchaseOrderId: orderId || null, warehouseId: warehouseId || null, receivedDate: receivedDate || null,
        supplierInvoiceReference: invoice || null, note: note || null,
        items: lines.map((l) => ({
          purchaseOrderItemId: l.purchaseOrderItemId, productVariantId: l.productVariantId, quantityReceived: l.received.trim(),
          quantityAccepted: (l.accepted || '0').trim(), unitCost: l.unitCost.trim(),
          discrepancyType: isShort(l.received, l.accepted) ? l.discrepancy : null, discrepancyNote: isShort(l.received, l.accepted) ? l.note || null : null,
        })),
      });
      void navigate(`/purchasing/receipts/${created.id}`);
    } catch (cause) {
      setError(messageOf(cause, 'The receipt could not be recorded.'));
    } finally {
      setBusy(false);
    }
  };

  const section = (title: string, hint?: string): React.JSX.Element => (
    <div style={{ padding: '18px 22px 10px' }}>
      <div style={{ fontSize: '14px', fontWeight: 750 }}>{title}</div>
      {hint ? <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{hint}</div> : null}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Record goods received"
        breadcrumb={<><span>Inventory</span><span>/</span><Link to="/purchasing/receipts" style={{ color: 'inherit' }}>Purchasing</Link><span>/</span><span style={{ fontWeight: 600 }}>Goods receipt</span></>}
        subtitle="What arrived, line by line - and what is accepted into stock"
        actions={<Button variant="secondary" size="page-header" onClick={() => navigate('/purchasing/receipts')} testId="gr-back">Back to Purchasing</Button>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '16px', minWidth: 0 }}>
          <Card>
            {section('Receipt details', 'Who delivered it and against which order, if any')}
            <div style={{ padding: '0 22px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
              <FormBox label="Supplier" testId="gr-supplier" value={supplierId} onChange={setSupplierId} required>
                <select data-testid="gr-supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setOrderId(''); setLines([]); }} style={selectStyle}>
                  <option value="">Choose a supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormBox>
              <FormBox label="Purchase order" testId="gr-order" value={orderId} onChange={setOrderId} hint="Optional - a purchase without an order is recorded here too">
                <select data-testid="gr-order" value={orderId} onChange={(event) => { setOrderId(event.target.value); setLines([]); setError(null); }} style={selectStyle}>
                  <option value="">No purchase order (direct purchase)</option>
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.poNumber} · {o.supplierName}</option>)}
                </select>
              </FormBox>
              <FormBox label="Received on" testId="gr-date" value={receivedDate} onChange={setReceivedDate} type="date" hint="Today if left empty" />
              <FormBox label="Supplier invoice / challan no." testId="gr-invoice" value={invoice} onChange={setInvoice} hint="Evidence only - what you accept decides what is owed" />
              {warehouses.length > 0 ? (
                <FormBox label="Received into" testId="gr-warehouse" value={warehouseId} onChange={setWarehouseId} wide>
                  <select data-testid="gr-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} style={selectStyle}>
                    <option value="">Not stated</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </FormBox>
              ) : null}
              <FormBox label="Note" testId="gr-note" value={note} onChange={setNote} wide />
            </div>
          </Card>

          <Card>
            {section('Goods', orderId ? 'The order’s lines, each at what is still to come' : 'Search a Stock Item to add it')}
            <div style={{ padding: '0 22px 18px' }}>
              {orderId ? null : <ProductPicker onPick={addProduct} />}
              {lines.length === 0 ? (
                <div data-testid="gr-no-lines" style={{ margin: '14px 0 4px', padding: '28px 16px', borderRadius: '12px', border: '1px dashed var(--color-border-control)', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                  {orderId ? 'Nothing is left to receive on this order.' : 'No goods yet - search a product above to add it.'}
                </div>
              ) : (
                <div data-testid="gr-lines" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                  {lines.map((l, index) => {
                    const short = isShort(l.received, l.accepted);
                    return (
                      <div key={l.key} data-testid="gr-line" style={{ padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--color-border-card)', background: 'var(--color-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'nowrap' }}>
                          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                              <span style={{ fontFamily: 'var(--font-family-mono)' }}>{l.sku}</span>{l.remaining !== null ? ` · ${displayQuantity(l.remaining)} still to come` : ''}
                            </div>
                          </div>
                          <label style={{ display: 'grid', gap: '2px', flexShrink: 0 }}>
                            <span style={tiny}>RECEIVED</span>
                            <input data-testid={`gr-received-${index}`} aria-label={`Received ${l.sku}`} value={l.received} inputMode="decimal" style={{ ...numberInput, width: '84px' }}
                              onChange={(event) => { const v = event.target.value; change(l.key, { received: v, accepted: mayAccept ? minQuantity(l.accepted === l.received ? v : l.accepted, v) : '0' }); }} />
                          </label>
                          <label style={{ display: 'grid', gap: '2px', flexShrink: 0 }}>
                            <span style={tiny}>ACCEPTED</span>
                            <input data-testid={`gr-accepted-${index}`} aria-label={`Accepted ${l.sku}`} value={l.accepted} inputMode="decimal" disabled={!mayAccept}
                              onChange={(event) => change(l.key, { accepted: event.target.value })} style={{ ...numberInput, width: '84px' }} />
                          </label>
                          <label style={{ display: 'grid', gap: '2px', flexShrink: 0 }}>
                            <span style={tiny}>UNIT COST (৳)</span>
                            <input data-testid={`gr-cost-${index}`} aria-label={`Unit cost ${l.sku}`} value={l.unitCost} inputMode="decimal" onChange={(event) => change(l.key, { unitCost: event.target.value })} style={{ ...numberInput, width: '110px' }} />
                          </label>
                          <div style={{ width: '112px', textAlign: 'right', flexShrink: 0 }}>
                            <div style={tiny}>ACCEPTED VALUE</div>
                            <div className="tabular-nums" data-testid={`gr-value-${index}`} style={{ fontSize: '14px', fontWeight: 750, marginTop: '6px' }}>{acceptedValue[index] ? displayMoney(acceptedValue[index]) : '—'}</div>
                          </div>
                          {orderId ? <span style={{ width: '20px', flexShrink: 0 }} /> : (
                            <button type="button" aria-label={`Remove ${l.sku}`} data-testid={`gr-remove-${index}`} onClick={() => setLines((current) => current.filter((x) => x.key !== l.key))}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '20px', lineHeight: 1, color: 'var(--color-text-secondary)', flexShrink: 0 }}>×</button>
                          )}
                        </div>
                        {short ? (
                          <div data-testid={`gr-issue-${index}`} style={{ display: 'flex', gap: '12px', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--color-border-card)', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 650, flexShrink: 0 }}>Not accepted - why?</span>
                            <select data-testid={`gr-discrepancy-${index}`} value={l.discrepancy} onChange={(event) => change(l.key, { discrepancy: event.target.value })} style={{ ...selectStyle, width: '180px' }}>
                              <option value="">Choose a reason</option>
                              {DISCREPANCIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                            </select>
                            <input aria-label={`Note ${l.sku}`} placeholder="Note (optional)" value={l.note} onChange={(event) => change(l.key, { note: event.target.value })}
                              style={{ ...selectStyle, flex: 1, width: 'auto' }} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        <aside data-testid="gr-summary" style={{ position: 'sticky', top: '16px', display: 'grid', gap: '14px' }}>
          <Card>
            <div style={{ padding: '18px 20px', display: 'grid', gap: '12px' }}>
              <div style={label}>RECEIPT SUMMARY</div>
              <SummaryRow k="Lines" v={String(lines.length)} />
              <SummaryRow k="Units received" v={unitsReceived ?? '—'} testId="gr-sum-received" />
              <SummaryRow k="Units accepted" v={unitsAccepted ?? '—'} testId="gr-sum-accepted" />
              <SummaryRow k="Lines with a discrepancy" v={String(issues)} />
              <div style={{ borderTop: '1px solid var(--color-border-card)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '13px', fontWeight: 650 }}>Accepted value</span>
                <span className="tabular-nums" data-testid="gr-total" style={{ fontSize: '20px', fontWeight: 850 }}>৳ {total ? displayMoney(total) : '—'}</span>
              </div>
            </div>
          </Card>
          <Card>
            <div style={{ padding: '18px 20px', display: 'grid', gap: '8px', fontSize: '13px' }}>
              <div style={label}>SUPPLIER</div>
              {supplier ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{supplier.name}</div>
                  {supplier.contactName ? <SummaryRow k="Contact" v={supplier.contactName} /> : null}
                  {supplier.phone ? <SummaryRow k="Phone" v={supplier.phone} /> : null}
                </>
              ) : <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>No supplier chosen yet.</div>}
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: '6px' }}>
                {mayAccept ? 'Accepted goods enter stock now, at the cost shown, and feed the average cost. Anything not accepted is held and enters nothing. No payable is created yet.'
                  : 'You may record what arrived, but accepting goods into stock needs the accept capability - accepted stays at zero.'}
              </div>
            </div>
          </Card>
          {error ? <div role="alert" data-testid="gr-error" style={{ color: 'var(--color-destructive)', fontSize: '12.5px', fontWeight: 600 }}>{error}</div> : null}
          <div style={{ display: 'grid', gap: '8px' }}>
            <Button variant="primary" size="button" onClick={() => void save()} disabled={busy || problem !== null} testId="gr-save">{busy ? 'Recording…' : 'Record goods receipt'}</Button>
            {problem ? <span data-testid="gr-problem" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{problem}</span> : null}
            <Link to="/purchasing/receipts" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center' }}>Cancel</Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function SummaryRow({ k, v, testId }: { readonly k: string; readonly v: string; readonly testId?: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
      <span data-testid={testId} className="tabular-nums" style={{ fontWeight: 650, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  );
}

const scaled = (t: string): bigint | null => {
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(t.trim());
  return m ? BigInt((m[1] ?? '0') + (m[2] ?? '').padEnd(4, '0')) : null;
};

/** -1, 0 or 1; an unreadable quantity compares as zero. */
function compare(a: string, b: string): number {
  const x = scaled(a) ?? 0n;
  const y = scaled(b) ?? 0n;
  return x < y ? -1 : x > y ? 1 : 0;
}

function sumQuantities(values: readonly string[]): string | null {
  let sum = 0n;
  for (const v of values) {
    const s = scaled(v);
    if (s === null) return null;
    sum += s;
  }
  const digits = sum.toString().padStart(5, '0');
  const fraction = digits.slice(-4).replace(/0+$/, '');
  return fraction ? `${digits.slice(0, -4)}.${fraction}` : digits.slice(0, -4);
}
