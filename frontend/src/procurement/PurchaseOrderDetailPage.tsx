import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { messageOf, stateTone } from '../masterdata/MasterDataParts';
import { PageHeader } from '../shell/AppShell';
import { ConfirmDialog } from '../ui/Overlay';
import { Button, Card, EmptyState } from '../ui/primitives';
import { displayMoney } from '../product/stockItemApi';
import { approvePurchaseOrder, cancelPurchaseOrder, displayQuantity, fetchPurchaseOrder, recordSupplierShipment, sendPurchaseOrder } from './purchaseApi';
import type { PurchaseOrderDetail } from './purchaseApi';

/**
 * One Purchase Order: its header, lines and the complete history of what was done to it (`PRC-026`).
 *
 * <p>🔴 Every act is offered only where the lifecycle allows it AND the person holds its capability; the server refuses
 * regardless (`PRJ-120`). Approving is its own capability and never the creator's (`INV-29.1`), the Owner excepted
 * (`PRC-069`) - the server decides and its refusal is shown in place. The supplier's shipment is a fact a person RECORDS
 * (`PRC-024`); after it the order can be neither amended nor cancelled here (`PRC-023`).
 */
const ACTION_LABEL: Record<string, string> = {
  CREATED: 'Created', AMENDED: 'Amended', APPROVED: 'Approved', SENT: 'Marked as sent', SUPPLIER_SHIPPED: 'Supplier shipped', CANCELLED: 'Cancelled',
};

export default function PurchaseOrderDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayManage = permissions.includes('procurement.purchase-order.manage');
  const mayApprove = permissions.includes('procurement.purchase-order.approve');
  const mayReceive = permissions.includes('procurement.goods-receipt.record');

  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [dialog, setDialog] = useState<'cancel' | 'shipped' | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!id) return;
    try {
      setDetail(await fetchPurchaseOrder(id));
      setError(null);
    } catch (cause) {
      setError(messageOf(cause, 'The purchase order could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const act = async (run: () => Promise<void>, done: string): Promise<void> => {
    try {
      await run();
      setNotice({ tone: 'ok', text: done });
      await load();
    } catch (cause) {
      setNotice({ tone: 'error', text: messageOf(cause, 'refused') });
    }
  };

  if (loading) return <Card><EmptyState title="Loading…" guidance="Fetching the purchase order." /></Card>;
  if (error || !detail) return <Card><EmptyState title="Purchase order not available" guidance={error ?? 'It may not exist, or you may not have access.'} /></Card>;

  const o = detail.order;
  const tone = stateTone(o.status === 'DRAFT' ? 'AWAITING' : o.status);

  return (
    <>
      <PageHeader
        title={o.poNumber}
        subtitle={`${o.supplierName} · raised ${o.orderDate}`}
        breadcrumb={<><span>Inventory</span><span>/</span><Link to="/purchasing/purchases" style={{ color: 'inherit' }}>Purchasing</Link><span>/</span><span style={{ fontWeight: 600 }}>{o.poNumber}</span></>}
        badge={<span data-testid="po-status" style={{ fontSize: '12px', fontWeight: 650, padding: '3px 10px', borderRadius: '999px', background: tone.bg, color: tone.fg }}>{tone.label}</span>}
        actions={
          <>
            <Button variant="secondary" size="page-header" onClick={() => navigate(`/purchasing/purchases/${o.id}/print`)} testId="po-print-open">Print / PDF</Button>
            {mayReceive && ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(o.status) ? <Button variant="primary" size="page-header" onClick={() => navigate(`/purchasing/receipts/new?order=${o.id}`)} testId="po-receive">Record goods received</Button> : null}
            {mayApprove && o.status === 'DRAFT' ? <Button variant="primary" size="page-header" onClick={() => void act(() => approvePurchaseOrder(o.id), 'Approved.')} testId="po-approve">Approve</Button> : null}
            {mayManage && o.status === 'APPROVED' ? <Button variant="primary" size="page-header" onClick={() => void act(() => sendPurchaseOrder(o.id), 'Marked as sent to the supplier.')} testId="po-send">Mark as sent</Button> : null}
            {mayManage && o.amendable ? <Button variant="secondary" size="page-header" onClick={() => navigate(`/purchasing/purchases/${o.id}/edit`)} testId="po-edit">{o.status === 'DRAFT' ? 'Edit' : 'Amend'}</Button> : null}
            {mayManage && (o.status === 'APPROVED' || o.status === 'SENT') && !o.supplierShipped ? <Button variant="secondary" size="page-header" onClick={() => setDialog('shipped')} testId="po-shipped">Record supplier shipment</Button> : null}
            {mayManage && o.cancellable ? <Button variant="secondary" size="page-header" onClick={() => setDialog('cancel')} testId="po-cancel">Cancel order</Button> : null}
          </>
        }
      />

      {notice ? (
        <div role={notice.tone === 'error' ? 'alert' : 'status'} data-testid="po-notice"
          style={{ marginBottom: 'var(--space-4)', padding: '10px 14px', borderRadius: 'var(--radius-control)', fontSize: '13px', fontWeight: 600,
            background: notice.tone === 'error' ? 'var(--color-status-cancelled-bg)' : 'var(--color-status-confirmed-bg)',
            color: notice.tone === 'error' ? 'var(--color-status-cancelled-fg)' : 'var(--color-status-confirmed-fg)' }}>
          {notice.text}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '16px' }}>
        {[
          ['SUPPLIER', o.supplierName], ['ORDER VALUE', `${o.currency} ${displayMoney(o.total)}`],
          ['EXPECTED', o.expectedDate ?? '—'], ['SUPPLIER REFERENCE', o.supplierOrderReference ?? '—'],
          ['CREATED BY', o.createdBy ?? '—'], ['APPROVED BY', o.approvedBy ?? 'Not yet approved'],
          ['SUPPLIER SHIPMENT', o.supplierShipped ? 'Shipped or confirmed - cannot be amended' : 'Not shipped'], ['RECEIVED', `${o.linesReceived} of ${o.lines} line${o.lines === 1 ? '' : 's'}`],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-card)', boxShadow: 'var(--elevation-card)', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>{label}</div>
            <div style={{ fontSize: '13.5px', fontWeight: 650, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
          </div>
        ))}
      </div>

      <Card>
        <div data-testid="po-items" style={{ padding: '6px 0' }}>
          {detail.items.map((i) => (
            <div key={i.id} data-testid="po-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--color-border-card)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-mono)' }}>{i.sku}</div>
              </div>
              <div style={{ width: '110px', textAlign: 'right' }}><div style={cap}>ORDERED</div><div className="tabular-nums" style={val}>{displayQuantity(i.quantityOrdered)}</div></div>
              <div style={{ width: '110px', textAlign: 'right' }}><div style={cap}>RECEIVED</div><div className="tabular-nums" style={val}>{displayQuantity(i.quantityReceived)}</div></div>
              <div style={{ width: '130px', textAlign: 'right' }}><div style={cap}>UNIT COST</div><div className="tabular-nums" style={val}>{displayMoney(i.unitCost)}</div></div>
              <div style={{ width: '140px', textAlign: 'right' }}><div style={cap}>LINE TOTAL</div><div className="tabular-nums" style={{ ...val, fontWeight: 800 }}>{displayMoney(i.lineTotal)}</div></div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)', margin: '22px 0 10px' }}>HISTORY</div>
      <div data-testid="po-history" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[...detail.history].reverse().map((h, index) => (
          <div key={index} data-testid="po-history-entry" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 14px', borderRadius: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border-card)' }}>
            <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-ink)', marginTop: '6px', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{ACTION_LABEL[h.action] ?? h.action}{h.actedBy ? ` · ${h.actedBy}` : ''}</div>
              {h.reason ? <div style={{ fontSize: '12.5px', marginTop: '2px' }}>Reason: {h.reason}</div> : null}
              {h.detail ? <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{h.detail}</div> : null}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}>{new Date(h.actedAt).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {dialog === 'shipped' ? (
        <ConfirmDialog title="Record supplier shipment" consequence="Record that the supplier has shipped or confirmed shipment. From then on this order can no longer be amended here - changes are resolved by agreement with the supplier. It can still be cancelled until goods are received."
          confirmLabel="Record shipment" testId="po-shipped-dialog" onCancel={() => setDialog(null)}
          onConfirm={() => { setDialog(null); void act(() => recordSupplierShipment(o.id), 'The supplier’s shipment is recorded.'); }} />
      ) : null}
      {dialog === 'cancel' ? (
        <CancelDialog order={detail} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); setNotice({ tone: 'ok', text }); void load(); }} />
      ) : null}
    </>
  );
}

const cap: React.CSSProperties = { fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-demoted)' };
const val: React.CSSProperties = { fontSize: '13px', fontWeight: 650, marginTop: '2px' };

function CancelDialog({ order, onClose, onDone }: { readonly order: PurchaseOrderDetail; readonly onClose: () => void; readonly onDone: (message: string) => void }): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = order.order.status === 'DRAFT';
  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await cancelPurchaseOrder(order.order.id, { reason, supplierAgreed: agreed, version: order.order.version });
      onDone(`${order.order.poNumber} is cancelled. Its number is kept.`);
    } catch (cause) {
      setError(messageOf(cause, 'The order could not be cancelled.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog title={`Cancel ${order.order.poNumber}`} consequence="The order number is kept and the cancellation is recorded with who and why. An approved order is cancelled only with the supplier’s agreement, and only until goods are received."
      confirmLabel="Cancel order" cancelLabel="Keep order" destructive busy={busy} error={error} testId="po-cancel-dialog"
      confirmDisabled={reason.trim() === '' || (!draft && !agreed)} confirmDisabledReason={reason.trim() === '' ? 'Say why - a cancellation records a reason.' : 'Confirm the supplier agreed.'}
      onConfirm={() => void submit()} onCancel={onClose}>
      <div style={{ display: 'grid', gap: '12px' }}>
        <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px' }}>
          <span style={{ fontWeight: 600 }}>Reason</span>
          <input data-testid="po-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)}
            style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit' }} />
        </label>
        {!draft ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
            <input type="checkbox" data-testid="po-cancel-agreed" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            The supplier agreed to the cancellation
          </label>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
