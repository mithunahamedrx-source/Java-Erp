import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FilterSelect, FormBox, KpiStrip, Pager, RecordCard, SearchBox, Toolbar, messageOf, useDebounced, useRemoteList } from '../masterdata/MasterDataParts';
import { listSuppliers, saveSupplier } from '../masterdata/masterDataApi';
import type { RecordStatus, Supplier } from '../masterdata/masterDataApi';
import { displayMoney } from '../product/stockItemApi';
import { PageHeader } from '../shell/AppShell';
import { ConfirmDialog } from '../ui/Overlay';
import type { MenuAction } from '../ui/Overlay';
import { Button, Card, EmptyState } from '../ui/primitives';

/**
 * Suppliers (`E-025`) - Inventory -> Suppliers, drawn from the owner's design reference (`suppliers:directory`).
 *
 * <p>A supplier is a SIMPLE PARTY RECORD (`PRC-008`). Payment terms and lead times are not here (`GAP-079` is open), and
 * purchase history, outstanding balance and advance held are DERIVED from purchase orders and payables (`PRC-009`),
 * which do not exist yet - so those columns are left out rather than shown as zero (`UX-080`).
 *
 * <p>🔴 No delete: a supplier referenced by history is archived (`PRC-011`). Changing one needs
 * `procurement.supplier.manage`; the affordance is hidden without it and the server refuses regardless (`PRJ-120`).
 */
const PAGE_SIZE = 10;

export default function SuppliersPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayManage = permissions.includes('procurement.supplier.manage');

  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebounced(searchDraft);
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const [activity, setActivity] = useState('');
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const list = useRemoteList(() => listSuppliers({ search, status, currency, activity, period, page, size: PAGE_SIZE }), [search, status, currency, activity, period, page]);

  const setRecordStatus = async (s: Supplier, next: RecordStatus): Promise<void> => {
    try {
      await saveSupplier(s.id, {
        name: s.name, contactName: s.contactName, phone: s.phone, email: s.email, address: s.address, currency: s.currency,
        externalReference: s.externalReference, activeFrom: s.activeFrom, activeUntil: s.activeUntil, recordStatus: next, version: s.version,
      });
      setNotice({ tone: 'ok', text: `${s.name}: ${next === 'ARCHIVED' ? 'archived' : 'now active'}.` });
      list.reload();
    } catch (cause) {
      setNotice({ tone: 'error', text: `${s.name}: ${messageOf(cause, 'refused')}` });
    }
  };

  const menuFor = (s: Supplier): readonly MenuAction[] => {
    // The ledger is a read: whoever may see suppliers may open it (PRC-052).
    const ledger: MenuAction = { label: 'Supplier ledger', testId: 'supplier-menu-ledger', onSelect: () => navigate(`/purchasing/suppliers/${s.id}/ledger`) };
    if (!mayManage) return [ledger];
    return [
      ledger,
      { label: 'Edit', testId: 'supplier-menu-edit', onSelect: () => setEditing(s), separatorBefore: true },
      s.recordStatus === 'ARCHIVED'
        ? { label: 'Restore', testId: 'supplier-menu-restore', onSelect: () => void setRecordStatus(s, 'ACTIVE') }
        : { label: 'Archive', testId: 'supplier-menu-archive', destructive: true, separatorBefore: true, onSelect: () => void setRecordStatus(s, 'ARCHIVED') },
    ];
  };

  const rows = list.data?.content ?? [];
  const kpis = list.data?.kpis;
  const filtered = search !== '' || status !== '' || currency !== '' || activity !== '' || period !== '';
  const total = list.data?.totalElements ?? 0;

  const header = useMemo(() => (
    <PageHeader
      title="Suppliers"
      subtitle="A supplier is a party record - no sourcing terms, per-product pricing or catalogue"
      actions={mayManage ? <Button variant="primary" size="page-header" onClick={() => setEditing('new')} testId="new-supplier">New supplier</Button> : undefined}
    />
  ), [mayManage]);

  if (list.forbidden) {
    return <>{header}<Card><EmptyState title="You do not have access to Suppliers" guidance="Viewing suppliers needs the procurement.supplier.view capability. Ask an administrator to grant it." /></Card></>;
  }

  return (
    <>
      {header}
      <KpiStrip kpis={[
        { key: 'suppliers', label: 'SUPPLIERS', value: kpis?.suppliers ?? '—' },
        { key: 'active', label: 'ACTIVE', value: kpis?.active ?? '—' },
        { key: 'purchase', label: 'TOTAL PURCHASE', value: kpis ? `${kpis.purchaseCurrency} ${displayMoney(kpis.totalPurchase)}` : '—' },
        { key: 'due', label: 'TOTAL DUE', value: kpis?.totalDue != null ? `${kpis.purchaseCurrency} ${displayMoney(kpis.totalDue)}` : '—' },
      ]} />
      <Toolbar>
        <SearchBox testId="supplier-search" value={searchDraft} onChange={(v) => { setSearchDraft(v); setPage(0); }} placeholder="Search supplier name, contact, phone or reference" />
        <FilterSelect label="Record state" testId="supplier-filter-status" value={status} onChange={(v) => { setStatus(v); setPage(0); }}
          options={[['ACTIVE', 'Active'], ['ARCHIVED', 'Archived']]} />
        <FilterSelect label="Currency" testId="supplier-filter-currency" value={currency} onChange={(v) => { setCurrency(v); setPage(0); }}
          options={[['BDT', 'BDT'], ['USD', 'USD'], ['CNY', 'CNY']]} />
        <FilterSelect label="Purchases" testId="supplier-filter-activity" value={activity} onChange={(v) => { setActivity(v); setPage(0); }}
          options={[['with-orders', 'With orders'], ['without-orders', 'Without orders']]} />
        <FilterSelect label="Period" testId="supplier-filter-period" value={period} onChange={(v) => { setPeriod(v); setPage(0); }}
          options={[['today', 'Today'], ['week', 'This week'], ['month', 'This month']]} />
      </Toolbar>

      {notice ? (
        <div role={notice.tone === 'error' ? 'alert' : 'status'} data-testid="master-notice"
          style={{ marginBottom: 'var(--space-4)', padding: '10px 14px', borderRadius: 'var(--radius-control)', fontSize: '13px', fontWeight: 600,
            background: notice.tone === 'error' ? 'var(--color-status-cancelled-bg)' : 'var(--color-status-confirmed-bg)',
            color: notice.tone === 'error' ? 'var(--color-status-cancelled-fg)' : 'var(--color-status-confirmed-fg)' }}>
          {notice.text}
        </div>
      ) : null}

      {list.loading ? (
        <Card><EmptyState title="Loading suppliers…" guidance="Fetching the current list from the server." /></Card>
      ) : list.error ? (
        <Card><EmptyState title="Suppliers could not be loaded" guidance={list.error} /></Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? 'No suppliers match these filters' : 'No suppliers yet'}
            guidance={filtered ? 'Clear the search or the filter to see every supplier.' : mayManage ? 'Choose New supplier to add the first one.' : 'Nothing is shown because no supplier has been added.'}
          />
        </Card>
      ) : (
        <div data-testid="supplier-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map((s) => (
            <RecordCard
              key={s.id}
              testId={`supplier-card-${s.name}`}
              title={s.name}
              meta={[s.address, s.activeFrom ? `Active from ${s.activeFrom}` : null].filter(Boolean).join(' · ') || null}
              columns={[
                { label: 'CONTACT', value: [s.contactName, s.phone].filter(Boolean).join(' · ') || '—' },
                { label: 'EMAIL', value: s.email ?? '—' },
                { label: 'TOTAL PURCHASE ORDERS', value: `${s.currency} ${displayMoney(s.totalPurchaseValue ?? '0')}` },
                { label: 'SUPPLIER DUE', value: '—' },
              ]}
              state={s.recordStatus}
              stateNote={s.recordStatus === 'ARCHIVED' ? 'Archived, never deleted' : undefined}
              faded={s.recordStatus === 'ARCHIVED'}
              actions={menuFor(s)}
            />
          ))}
        </div>
      )}
      <Pager page={page} totalPages={list.data?.totalPages ?? 1} total={total} size={PAGE_SIZE} onPage={setPage} />

      {editing ? (
        <SupplierDialog
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setNotice({ tone: 'ok', text }); list.reload(); }}
        />
      ) : null}
    </>
  );
}

function SupplierDialog({ supplier, onClose, onSaved }: {
  readonly supplier: Supplier | null; readonly onClose: () => void; readonly onSaved: (message: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(supplier?.name ?? '');
  const [contactName, setContactName] = useState(supplier?.contactName ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [currency, setCurrency] = useState(supplier?.currency ?? 'BDT');
  const [reference, setReference] = useState(supplier?.externalReference ?? '');
  const [activeFrom, setActiveFrom] = useState(supplier?.activeFrom ?? '');
  const [activeUntil, setActiveUntil] = useState(supplier?.activeUntil ?? '');
  const [status, setStatus] = useState<string>(supplier?.recordStatus ?? 'ACTIVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await saveSupplier(supplier?.id ?? null, {
        name, contactName: contactName || null, phone: phone || null, email: email || null, address: address || null,
        currency: currency || null, externalReference: reference || null, activeFrom: activeFrom || null, activeUntil: activeUntil || null,
        recordStatus: status, version: supplier?.version ?? null,
      });
      onSaved(supplier ? `${name}: saved.` : `${name}: added.`);
    } catch (cause) {
      setError(messageOf(cause, 'The supplier could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title={supplier ? `Edit ${supplier.name}` : 'New supplier'}
      consequence="A supplier is a party record. Payment terms and lead times are not recorded here yet, and a supplier is archived, never deleted."
      confirmLabel="Save"
      busy={busy}
      error={error}
      width="600px"
      testId="supplier-dialog"
      confirmDisabled={name.trim() === ''}
      confirmDisabledReason="The supplier's name is required."
      onConfirm={() => void save()}
      onCancel={onClose}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3) var(--space-4)' }}>
        <FormBox label="Name" testId="supplier-name" value={name} onChange={setName} wide required />
        <FormBox label="Contact person" testId="supplier-contact" value={contactName} onChange={setContactName} />
        <FormBox label="Phone" testId="supplier-phone" value={phone} onChange={setPhone} />
        <FormBox label="Email" testId="supplier-email" value={email} onChange={setEmail} />
        <FormBox label="Currency" testId="supplier-currency" value={currency} onChange={setCurrency} hint="Three letters, for example BDT" />
        <FormBox label="Address" testId="supplier-address" value={address} onChange={setAddress} wide />
        <FormBox label="Reference identifier" testId="supplier-reference" value={reference} onChange={setReference} hint="The supplier's own code for us, or ours for them" />
        <FormBox label="Status" testId="supplier-status" value={status} onChange={setStatus}>
          <select data-testid="supplier-status" value={status} onChange={(event) => setStatus(event.target.value)}
            style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)' }}>
            {['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DRAFT'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormBox>
        <FormBox label="Active from" testId="supplier-from" value={activeFrom} onChange={setActiveFrom} type="date" />
        <FormBox label="Active until" testId="supplier-until" value={activeUntil} onChange={setActiveUntil} type="date" />
      </div>
    </ConfirmDialog>
  );
}
