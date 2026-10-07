import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FilterSelect, KpiStrip, Pager, RecordCard, SearchBox, Toolbar, useDebounced, useRemoteList } from '../masterdata/MasterDataParts';
import { listSuppliers } from '../masterdata/masterDataApi';
import { PageHeader } from '../shell/AppShell';
import { usePageActions } from '../shell/PageActions';
import { Button, Card, EmptyState } from '../ui/primitives';
import { displayMoney } from '../product/stockItemApi';
import { displayQuantity } from './purchaseApi';
import { listPurchaseOrders } from './purchaseApi';
import { listGoodsReceipts } from './receiptApi';
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
      {tab === 'orders' ? <OrdersTab /> : <ReceiptsTab />}
    </>
  );
}

function ReceiptsTab(): React.JSX.Element {
  const { session } = useAuth();
  const navigate = useNavigate();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayRecord = permissions.includes('procurement.goods-receipt.record');

  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebounced(searchDraft);
  const [supplierId, setSupplierId] = useState('');
  const [issues, setIssues] = useState('');
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(0);

  // Level 1 page action (UX-045): the one dark primary sits in the page header.
  usePageActions(
    mayRecord ? <Button variant="primary" size="page-header" onClick={() => navigate('/purchasing/receipts/new')} testId="new-receipt">Record goods received</Button> : null,
    [mayRecord],
  );

  const suppliers = useRemoteList(() => listSuppliers({ page: 0, size: 100 }), []);
  const dates = useMemo(() => periodRange(period), [period]);
  const list = useRemoteList(() => listGoodsReceipts({ search, supplierId, issues, from: dates.from, to: dates.to, page, size: PAGE_SIZE }), [search, supplierId, issues, dates, page]);
  const supplierOptions = useMemo(() => (suppliers.data?.content ?? []).map((s) => [s.id, s.name] as const), [suppliers.data]);
  const rows = list.data?.content ?? [];
  const kpis = list.data?.kpis;
  const filtered = search !== '' || supplierId !== '' || issues !== '' || period !== '';

  if (list.forbidden) {
    return <Card><EmptyState title="You do not have access to Goods Receipts" guidance="Viewing goods receipts needs the procurement.goods-receipt.view capability. Ask an administrator to grant it." /></Card>;
  }
  return (
    <>
      <KpiStrip kpis={[
        { key: 'receipts', label: 'GOODS RECEIPTS', value: kpis?.receipts ?? '—' }, { key: 'lines', label: 'LINES RECEIVED', value: kpis?.lines ?? '—' },
        { key: 'accepted', label: 'UNITS ACCEPTED', value: kpis ? displayQuantity(kpis.unitsAccepted) : '—' }, { key: 'issues', label: 'WITH A DISCREPANCY', value: kpis?.withIssues ?? '—' },
      ]} />
      <Toolbar>
        <SearchBox testId="gr-search" value={searchDraft} onChange={(v) => { setSearchDraft(v); setPage(0); }} placeholder="Search receipt, supplier, order, invoice or item" />
        <FilterSelect label="Supplier" testId="gr-filter-supplier" value={supplierId} onChange={(v) => { setSupplierId(v); setPage(0); }} options={supplierOptions} />
        <FilterSelect label="Discrepancy" testId="gr-filter-issues" value={issues} onChange={(v) => { setIssues(v); setPage(0); }} options={[['true', 'With a discrepancy'], ['false', 'Clean']]} />
        <FilterSelect label="Period" testId="gr-filter-period" value={period} onChange={(v) => { setPeriod(v); setPage(0); }} options={[['today', 'Today'], ['week', 'This week'], ['month', 'This month']]} />
      </Toolbar>
      {list.loading ? <Card><EmptyState title="Loading goods receipts…" guidance="Fetching the current list from the server." /></Card>
        : list.error ? <Card><EmptyState title="Goods receipts could not be loaded" guidance={list.error} /></Card>
        : rows.length === 0 ? (
          <Card><EmptyState title={filtered ? 'No goods receipts match these filters' : 'No goods received yet'}
            guidance={filtered ? 'Clear the search or the filters.' : mayRecord ? 'Choose Record goods received when a delivery arrives.' : 'Nothing is shown because none has been recorded.'} /></Card>
        ) : (
          <div data-testid="gr-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rows.map((g) => (
              <div key={g.id} onClick={() => navigate(`/purchasing/receipts/${g.id}`)} style={{ cursor: 'pointer' }}>
                <RecordCard
                  testId={`gr-card-${g.receiptNumber}`}
                  title={g.receiptNumber}
                  meta={`Received ${g.receivedDate} · ${g.lines} line${g.lines === 1 ? '' : 's'}${g.recordedBy ? ` · ${g.recordedBy}` : ''}`}
                  columns={[
                    { label: 'SUPPLIER', value: g.supplierName },
                    { label: 'PURCHASE ORDER', value: g.poNumber ?? 'Direct purchase' },
                    { label: 'UNITS ACCEPTED', value: `${displayQuantity(g.unitsAccepted)} of ${displayQuantity(g.unitsReceived)}` },
                    { label: 'ACCEPTED VALUE', value: `৳ ${displayMoney(g.acceptedValue)}` },
                  ]}
                  state={g.hasIssues ? 'AWAITING' : 'RECEIVED'}
                  stateLabel={g.hasIssues ? 'DISCREPANCY' : 'RECEIVED'}
                />
              </div>
            ))}
          </div>
        )}
      <Pager page={page} totalPages={list.data?.totalPages ?? 1} total={list.data?.totalElements ?? 0} size={PAGE_SIZE} onPage={setPage} />
    </>
  );
}

function periodRange(period: string): { from: string; to: string } {
  const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  if (period === 'today') return { from: iso(today), to: iso(today) };
  if (period === 'week') { const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); return { from: iso(monday), to: iso(today) }; }
  if (period === 'month') return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
  return { from: '', to: '' };
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

  // Level 1 page action (UX-045): the one dark primary sits in the page header, never in the dataset toolbar.
  usePageActions(
    mayManage ? <Button variant="primary" size="page-header" onClick={() => navigate('/purchasing/purchases/new')} testId="new-po">New purchase order</Button> : null,
    [mayManage],
  );

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
                    { label: 'RECEIVED', value: `${o.linesReceived} of ${o.lines} line${o.lines === 1 ? '' : 's'}` },
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
    </>
  );
}
