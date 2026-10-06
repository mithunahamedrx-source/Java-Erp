import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FilterSelect, KpiStrip, Pager, RecordCard, SearchBox, Toolbar, useDebounced, useRemoteList } from '../masterdata/MasterDataParts';
import { listSuppliers } from '../masterdata/masterDataApi';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { displayMoney } from '../product/stockItemApi';
import { STATUS_LABEL, listPurchaseOrders } from './purchaseApi';
import type { PurchaseOrder } from './purchaseApi';

/**
 * Purchasing - Inventory -> Purchasing (`UX-033`), the owner's design reference `purchasing:orders`: Purchase Orders and
 * Goods Receipts are separate records on separate tabs. Only Purchase Orders exist so far.
 *
 * <p>🔴 A purchase order is OPTIONAL - a receipt may exist without one (`PRC-017`, `PRC-018`) - and it is a commitment,
 * not stock and not a liability. Received quantities are derived from receipts and none exist yet, so they read "0".
 * Changing orders needs `procurement.purchase-order.manage`; approving is its own capability.
 */
const PAGE_SIZE = 10;

export default function PurchasingPage({ tab }: { readonly tab: 'orders' | 'receipts' }): React.JSX.Element {
  return (
    <>
      <PageHeader title="Purchasing" subtitle={tab === 'orders' ? 'A purchase order is optional - a receipt may exist without one' : 'Stock enters at receipt, and the payable at acceptance'} />
      <div data-testid="purchasing-tabs" style={{ display: 'flex', gap: '6px', padding: '5px', borderRadius: '12px', background: 'var(--color-tab-container)', width: 'fit-content', marginBottom: 'var(--space-7)' }}>
        {([['orders', 'Purchase Orders', '/purchasing/purchases'], ['receipts', 'Goods Receipts', '/purchasing/receipts']] as const).map(([id, label, path]) => (
          <Link key={id} to={path} data-testid={`purchasing-tab-${id}`} className="state-transition"
            style={{ display: 'inline-flex', alignItems: 'center', height: '36px', padding: '0 16px', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
              background: tab === id ? 'var(--color-surface)' : 'transparent', boxShadow: tab === id ? 'var(--elevation-active-tab)' : 'none',
              color: tab === id ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
            {label}
          </Link>
        ))}
      </div>
      {tab === 'orders' ? <OrdersTab /> : (
        <Card>
          <EmptyState title="Goods receipts are not built yet" guidance="Receiving stock - and with it stock levels and cost - is the next step. Nothing is shown here because no receipt can be recorded yet." />
        </Card>
      )}
    </>
  );
}

function shipmentNote(o: PurchaseOrder): string {
  if (o.status === 'CANCELLED') return 'Cancelled';
  if (o.supplierShipped) return 'Locked - supplier shipped';
  if (o.amendable) return 'Amendable';
  return '-';
}

function OrdersTab(): React.JSX.Element {
  const { session } = useAuth();
  const navigate = useNavigate();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayManage = permissions.includes('procurement.purchase-order.manage');

  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebounced(searchDraft);
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [shipped, setShipped] = useState('');
  const [page, setPage] = useState(0);

  const suppliers = useRemoteList(() => listSuppliers({ page: 0, size: 100 }), []);
  const list = useRemoteList(() => listPurchaseOrders({ search, status, supplierId, shipped, page, size: PAGE_SIZE }), [search, status, supplierId, shipped, page]);
  const supplierOptions = useMemo(() => (suppliers.data?.content ?? []).map((s) => [s.id, s.name] as const), [suppliers.data]);

  const rows = list.data?.content ?? [];
  const kpis = list.data?.kpis;
  const filtered = search !== '' || status !== '' || supplierId !== '' || shipped !== '';

  if (list.forbidden) {
    return <Card><EmptyState title="You do not have access to Purchase Orders" guidance="Viewing purchase orders needs the procurement.purchase-order.view capability. Ask an administrator to grant it." /></Card>;
  }
  return (
    <>
      <KpiStrip kpis={[
        { key: 'orders', label: 'PURCHASE ORDERS', value: kpis?.orders ?? '—' }, { key: 'open', label: 'OPEN', value: kpis?.open ?? '—' },
        { key: 'awaiting', label: 'AWAITING APPROVAL', value: kpis?.awaitingApproval ?? '—' }, { key: 'amendable', label: 'AMENDABLE', value: kpis?.amendable ?? '—' },
        { key: 'cancelled', label: 'CANCELLED', value: kpis?.cancelled ?? '—' },
      ]} />
      <Toolbar>
        <SearchBox testId="po-search" value={searchDraft} onChange={(v) => { setSearchDraft(v); setPage(0); }} placeholder="Search PO number, supplier or item" />
        <FilterSelect label="Status" testId="po-filter-status" value={status} onChange={(v) => { setStatus(v); setPage(0); }}
          options={[['DRAFT', 'Awaiting approval'], ['APPROVED', 'Approved'], ['SENT', 'Sent'], ['CANCELLED', 'Cancelled']]} />
        <FilterSelect label="Supplier" testId="po-filter-supplier" value={supplierId} onChange={(v) => { setSupplierId(v); setPage(0); }} options={supplierOptions} />
        <FilterSelect label="Supplier shipment" testId="po-filter-shipped" value={shipped} onChange={(v) => { setShipped(v); setPage(0); }}
          options={[['false', 'Not shipped'], ['true', 'Shipped or confirmed']]} />
        <div style={{ flex: 1 }} />
        {mayManage ? <Button variant="primary" size="page-header" onClick={() => navigate('/purchasing/purchases/new')} testId="new-po">New purchase order</Button> : null}
      </Toolbar>

      {list.loading ? <Card><EmptyState title="Loading purchase orders…" guidance="Fetching the current list from the server." /></Card>
        : list.error ? <Card><EmptyState title="Purchase orders could not be loaded" guidance={list.error} /></Card>
        : rows.length === 0 ? (
          <Card><EmptyState title={filtered ? 'No purchase orders match these filters' : 'No purchase orders yet'}
            guidance={filtered ? 'Clear the search or the filters.' : mayManage ? 'Choose New purchase order to raise the first one.' : 'Nothing is shown because none has been raised.'} /></Card>
        ) : (
          <div data-testid="po-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rows.map((o) => (
              <div key={o.id} onClick={() => navigate(`/purchasing/purchases/${o.id}`)} style={{ cursor: 'pointer' }}>
                <RecordCard
                  testId={`po-card-${o.poNumber}`}
                  title={o.poNumber}
                  meta={`Raised ${o.orderDate} · ${o.lines} line${o.lines === 1 ? '' : 's'}${o.createdBy ? ` · ${o.createdBy}` : ''}`}
                  columns={[
                    { label: 'SUPPLIER', value: o.supplierName },
                    { label: 'SUPPLIER SHIPMENT', value: shipmentNote(o) },
                    { label: 'ORDER VALUE', value: `${o.currency} ${displayMoney(o.total)}` },
                    { label: 'RECEIVED', value: `0 of ${o.lines} line${o.lines === 1 ? '' : 's'}` },
                  ]}
                  state={o.status === 'DRAFT' ? 'AWAITING' : o.status}
                  stateNote={o.status === 'DRAFT' ? 'Approver is never the creator' : o.status === 'CANCELLED' ? 'Cancellation recorded' : undefined}
                  faded={o.status === 'CANCELLED'}
                />
              </div>
            ))}
          </div>
        )}
      <Pager page={page} totalPages={list.data?.totalPages ?? 1} total={list.data?.totalElements ?? 0} size={PAGE_SIZE} onPage={setPage} />
      <span style={{ display: 'none' }}>{STATUS_LABEL['DRAFT']}</span>
    </>
  );
}
