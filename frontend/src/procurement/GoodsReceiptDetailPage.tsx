import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { messageOf } from '../masterdata/MasterDataParts';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { displayMoney } from '../product/stockItemApi';
import { displayQuantity } from './purchaseApi';
import { discrepancyLabel, fetchGoodsReceipt } from './receiptApi';
import type { GoodsReceiptDetail } from './receiptApi';

/**
 * One goods receipt: what arrived, what was accepted into stock at what cost, and what was held and why (`PRC-030`, `PRC-034`).
 *
 * <p>A receipt is a record of one decision and has no state and no edit (`PRC-037`); a wrong one is corrected by a linked
 * adjustment, which does not exist yet. It RENDERS and decides nothing. Who recorded it and who accepted it are first-class
 * facts captured when each happened (`PRC-007`, `AGV-001`).
 */
const cap: React.CSSProperties = { fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-demoted)' };
const val: React.CSSProperties = { fontSize: '13px', fontWeight: 650, marginTop: '2px' };

export default function GoodsReceiptDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<GoodsReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGoodsReceipt(id).then(setDetail).catch((cause) => setError(messageOf(cause, 'The goods receipt could not be loaded.')));
  }, [id]);

  if (error) return <Card><EmptyState title="Goods receipt not available" guidance={error} /></Card>;
  if (!detail) return <Card><EmptyState title="Loading…" guidance="Fetching the goods receipt." /></Card>;

  const r = detail.receipt;
  return (
    <>
      <PageHeader
        title={r.receiptNumber}
        subtitle={`${r.supplierName} · received ${r.receivedDate}`}
        breadcrumb={<><span>Inventory</span><span>/</span><Link to="/purchasing/receipts" style={{ color: 'inherit' }}>Purchasing</Link><span>/</span><span style={{ fontWeight: 600 }}>{r.receiptNumber}</span></>}
        actions={
          <>
            {r.purchaseOrderId ? <Button variant="secondary" size="page-header" onClick={() => navigate(`/purchasing/purchases/${r.purchaseOrderId}`)} testId="gr-open-order">Open {r.poNumber}</Button> : null}
            <Button variant="secondary" size="page-header" onClick={() => navigate('/purchasing/receipts')} testId="gr-detail-back">Back to Purchasing</Button>
          </>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '16px' }}>
        {[
          ['SUPPLIER', r.supplierName], ['PURCHASE ORDER', r.poNumber ?? 'None - direct purchase'],
          ['SUPPLIER INVOICE / CHALLAN', r.supplierInvoiceReference ?? '—'], ['RECEIVED INTO', detail.warehouseName ?? 'Not stated'],
          ['RECORDED BY', r.recordedBy ?? '—'], ['ACCEPTED BY', r.acceptedBy ?? 'Nothing accepted'],
          ['UNITS ACCEPTED', `${displayQuantity(r.unitsAccepted)} of ${displayQuantity(r.unitsReceived)}`], ['ACCEPTED VALUE', `৳ ${displayMoney(r.acceptedValue)}`],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-card)', boxShadow: 'var(--elevation-card)', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>{label}</div>
            <div style={{ fontSize: '13.5px', fontWeight: 650, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
          </div>
        ))}
      </div>
      {detail.note ? <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Note: {detail.note}</div> : null}

      <Card>
        <div data-testid="gr-items" style={{ padding: '6px 0' }}>
          {detail.items.map((i) => (
            <div key={i.id} data-testid="gr-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--color-border-card)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                  <span style={{ fontFamily: 'var(--font-family-mono)' }}>{i.sku}</span>{i.poLineNumber !== null ? ` · order line ${i.poLineNumber}` : ''}
                  {i.discrepancyType ? <span data-testid="gr-item-issue" style={{ marginLeft: '8px', fontWeight: 700, color: 'var(--color-status-pending-fg)' }}>{discrepancyLabel(i.discrepancyType)}{i.discrepancyNote ? ` - ${i.discrepancyNote}` : ''}</span> : null}
                </div>
              </div>
              <div style={{ width: '100px', textAlign: 'right' }}><div style={cap}>RECEIVED</div><div className="tabular-nums" style={val}>{displayQuantity(i.quantityReceived)}</div></div>
              <div style={{ width: '100px', textAlign: 'right' }}><div style={cap}>ACCEPTED</div><div className="tabular-nums" style={val}>{displayQuantity(i.quantityAccepted)}</div></div>
              <div style={{ width: '120px', textAlign: 'right' }}><div style={cap}>UNIT COST</div><div className="tabular-nums" style={val}>{displayMoney(i.unitCost)}</div></div>
              <div style={{ width: '130px', textAlign: 'right' }}><div style={cap}>ACCEPTED VALUE</div><div className="tabular-nums" style={{ ...val, fontWeight: 800 }}>{displayMoney(i.acceptedValue)}</div></div>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        Accepted goods entered stock when this receipt was recorded, at the cost shown. Goods not accepted are held, are not for sale and enter no cost.
        A supplier payable is not created yet.
      </div>
    </>
  );
}
