import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FilterSelect, FormBox, KpiStrip, Pager, RecordCard, SearchBox, Toolbar, messageOf, useDebounced, useRemoteList } from '../masterdata/MasterDataParts';
import { LOCATION_TYPES, listLocations, listWarehouses, locationTypeLabel, saveLocation, saveWarehouse } from '../masterdata/masterDataApi';
import type { RecordStatus, StockLocation, Warehouse } from '../masterdata/masterDataApi';
import { PageHeader } from '../shell/AppShell';
import { usePageActions } from '../shell/PageActions';
import { ConfirmDialog } from '../ui/Overlay';
import type { MenuAction } from '../ui/Overlay';
import { Button, Card, EmptyState } from '../ui/primitives';

/**
 * Warehouses (`E-004`) and Stock Locations (`E-005`) - Inventory -> Warehouses, two tabs as the owner's design
 * reference draws them (`warehouses:warehouses`, `warehouses:locations`).
 *
 * <p>The business has ONE warehouse today, so this stays deliberately light: a list, a form, archive. Stock figures
 * (stock lines, build jobs) are not shown - stock is derived from movements and is not attributed to a location yet
 * (`DB-001`); a figure that cannot be derived is left out rather than shown as zero (`UX-080`).
 *
 * <p>🔴 No delete (`INV-4.3`). 🔴 A location's sellability follows its type and is never chosen (`WHS-008`), and its type is
 * fixed once made. Each tab needs its own view / manage capability; the affordance is hidden without it and the server
 * refuses regardless (`PRJ-120`).
 */
const PAGE_SIZE = 10;

export default function WarehousesPage({ tab }: { readonly tab: 'warehouses' | 'locations' }): React.JSX.Element {
  return (
    <>
      <PageHeader title="Warehouses" subtitle={tab === 'warehouses' ? 'Stock exists only within a warehouse' : 'Sellability is a property of the location, not a stock state'} />
      <div data-testid="warehouse-tabs" style={{ display: 'flex', gap: '6px', padding: '5px', borderRadius: '12px', background: 'var(--color-tab-container)', width: 'fit-content', marginBottom: 'var(--space-7)' }}>
        {([['warehouses', 'Warehouses', '/inventory/warehouses'], ['locations', 'Stock Locations', '/inventory/warehouses/locations']] as const).map(([id, label, path]) => (
          <Link key={id} to={path} data-testid={`warehouse-tab-${id}`} className="state-transition"
            style={{ display: 'inline-flex', alignItems: 'center', height: '36px', padding: '0 16px', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
              background: tab === id ? 'var(--color-surface)' : 'transparent', boxShadow: tab === id ? 'var(--elevation-active-tab)' : 'none',
              color: tab === id ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
            {label}
          </Link>
        ))}
      </div>
      {tab === 'warehouses' ? <WarehousesTab /> : <LocationsTab />}
    </>
  );
}

function useManage(code: string): boolean {
  const { session } = useAuth();
  return (session.status === 'authenticated' ? session.user.permissions : []).includes(code);
}

function Notice({ notice }: { readonly notice: { tone: 'ok' | 'error'; text: string } | null }): React.JSX.Element | null {
  if (!notice) return null;
  return (
    <div role={notice.tone === 'error' ? 'alert' : 'status'} data-testid="master-notice"
      style={{ marginBottom: 'var(--space-4)', padding: '10px 14px', borderRadius: 'var(--radius-control)', fontSize: '13px', fontWeight: 600,
        background: notice.tone === 'error' ? 'var(--color-status-cancelled-bg)' : 'var(--color-status-confirmed-bg)',
        color: notice.tone === 'error' ? 'var(--color-status-cancelled-fg)' : 'var(--color-status-confirmed-fg)' }}>
      {notice.text}
    </div>
  );
}

function statusSelect(testId: string, value: string, set: (v: string) => void): React.JSX.Element {
  return (
    <select data-testid={testId} value={value} onChange={(event) => set(event.target.value)}
      style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)' }}>
      {['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DRAFT'].map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

/* ----------------------------------------------------------------------------------------- Warehouses tab */

function WarehousesTab(): React.JSX.Element {
  const mayManage = useManage('warehouse.warehouse.manage');
  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebounced(searchDraft);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const list = useRemoteList(() => listWarehouses({ search, status, page, size: PAGE_SIZE }), [search, status, page]);

  const setRecordStatus = async (w: Warehouse, next: RecordStatus): Promise<void> => {
    try {
      await saveWarehouse(w.id, { name: w.name, address: w.address, recordStatus: next, version: w.version });
      setNotice({ tone: 'ok', text: `${w.name}: ${next === 'ARCHIVED' ? 'archived' : 'now active'}.` });
      list.reload();
    } catch (cause) {
      setNotice({ tone: 'error', text: `${w.name}: ${messageOf(cause, 'refused')}` });
    }
  };
  const menuFor = (w: Warehouse): readonly MenuAction[] => !mayManage ? [] : [
    { label: 'Edit', testId: 'warehouse-menu-edit', onSelect: () => setEditing(w) },
    w.recordStatus === 'ARCHIVED'
      ? { label: 'Restore', testId: 'warehouse-menu-restore', onSelect: () => void setRecordStatus(w, 'ACTIVE') }
      : { label: 'Archive', testId: 'warehouse-menu-archive', destructive: true, separatorBefore: true, onSelect: () => void setRecordStatus(w, 'ARCHIVED') },
  ];

  const rows = list.data?.content ?? [];
  const kpis = list.data?.kpis;
  const filtered = search !== '' || status !== '';

  usePageActions(
    mayManage ? <Button variant="primary" size="page-header" onClick={() => setEditing('new')} testId="new-warehouse">New warehouse</Button> : null,
    [mayManage],
  );

  if (list.forbidden) {
    return <Card><EmptyState title="You do not have access to Warehouses" guidance="Viewing warehouses needs the warehouse.warehouse.view capability. Ask an administrator to grant it." /></Card>;
  }
  return (
    <>
      <KpiStrip kpis={[
        { key: 'warehouses', label: 'WAREHOUSES', value: kpis?.warehouses ?? '—' }, { key: 'active', label: 'ACTIVE', value: kpis?.active ?? '—' },
        { key: 'archived', label: 'ARCHIVED', value: kpis?.archived ?? '—' }, { key: 'locations', label: 'STOCK LOCATIONS', value: kpis?.locations ?? '—' },
        { key: 'quarantine', label: 'QUARANTINE LOCATIONS', value: kpis?.quarantineLocations ?? '—' },
      ]} />
      <Toolbar>
        <SearchBox testId="warehouse-search" value={searchDraft} onChange={(v) => { setSearchDraft(v); setPage(0); }} placeholder="Search warehouse name, identifier or address" />
        <FilterSelect label="Record state" testId="warehouse-filter-status" value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={[['ACTIVE', 'Active'], ['ARCHIVED', 'Archived']]} />
      </Toolbar>
      <Notice notice={notice} />
      {list.loading ? <Card><EmptyState title="Loading warehouses…" guidance="Fetching the current list from the server." /></Card>
        : list.error ? <Card><EmptyState title="Warehouses could not be loaded" guidance={list.error} /></Card>
        : rows.length === 0 ? (
          <Card><EmptyState title={filtered ? 'No warehouses match these filters' : 'No warehouses yet'}
            guidance={filtered ? 'Clear the search or the filter.' : mayManage ? 'Choose New warehouse to add your first one.' : 'Nothing is shown because none has been added.'} /></Card>
        ) : (
          <div data-testid="warehouse-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rows.map((w) => (
              <RecordCard key={w.id} testId={`warehouse-card-${w.identifier}`} title={w.name} meta={w.address}
                columns={[
                  { label: 'IDENTIFIER', value: w.identifier },
                  { label: 'LOCATIONS', value: w.locations },
                  { label: 'QUARANTINE', value: w.quarantineLocations },
                ]}
                state={w.recordStatus} stateNote={w.recordStatus === 'ARCHIVED' ? 'Archived, never deleted' : undefined}
                faded={w.recordStatus === 'ARCHIVED'} actions={menuFor(w)} />
            ))}
          </div>
        )}
      <Pager page={page} totalPages={list.data?.totalPages ?? 1} total={list.data?.totalElements ?? 0} size={PAGE_SIZE} onPage={setPage} />
      {editing ? <WarehouseDialog warehouse={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
        onSaved={(text) => { setEditing(null); setNotice({ tone: 'ok', text }); list.reload(); }} /> : null}
    </>
  );
}

function WarehouseDialog({ warehouse, onClose, onSaved }: { readonly warehouse: Warehouse | null; readonly onClose: () => void; readonly onSaved: (m: string) => void }): React.JSX.Element {
  const [identifier, setIdentifier] = useState(warehouse?.identifier ?? '');
  const [name, setName] = useState(warehouse?.name ?? '');
  const [address, setAddress] = useState(warehouse?.address ?? '');
  const [status, setStatus] = useState<string>(warehouse?.recordStatus ?? 'ACTIVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      await saveWarehouse(warehouse?.id ?? null, { identifier, name, address: address || null, recordStatus: status, version: warehouse?.version ?? null });
      onSaved(warehouse ? `${name}: saved.` : `${name}: added.`);
    } catch (cause) { setError(messageOf(cause, 'The warehouse could not be saved.')); } finally { setBusy(false); }
  };
  return (
    <ConfirmDialog title={warehouse ? `Edit ${warehouse.name}` : 'New warehouse'}
      consequence="Stock exists only within a warehouse. A warehouse is archived, never deleted." confirmLabel="Save" busy={busy} error={error}
      width="520px" testId="warehouse-dialog" confirmDisabled={name.trim() === '' || (!warehouse && identifier.trim() === '')}
      confirmDisabledReason="Name and identifier are required." onConfirm={() => void save()} onCancel={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3) var(--space-4)' }}>
        {warehouse ? <FormBox label="Identifier" testId="warehouse-identifier" value={identifier} onChange={() => undefined} hint="Fixed once made"><div data-testid="warehouse-identifier" style={{ height: '36px', display: 'flex', alignItems: 'center', fontWeight: 700 }}>{identifier}</div></FormBox>
          : <FormBox label="Identifier" testId="warehouse-identifier" value={identifier} onChange={setIdentifier} required hint="For example WH-MAIN" />}
        <FormBox label="Name" testId="warehouse-name" value={name} onChange={setName} required />
        <FormBox label="Address" testId="warehouse-address" value={address} onChange={setAddress} wide />
        <FormBox label="Status" testId="warehouse-status" value={status} onChange={setStatus}>{statusSelect('warehouse-status', status, setStatus)}</FormBox>
      </div>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------------------------ Stock Locations tab */

function LocationsTab(): React.JSX.Element {
  const mayManage = useManage('warehouse.stock-location.manage');
  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebounced(searchDraft);
  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('');
  const [sellable, setSellable] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<StockLocation | 'new' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const warehouses = useRemoteList(() => listWarehouses({ page: 0, size: 100 }), []);
  const list = useRemoteList(() => listLocations({ search, warehouseId, type, sellable, page, size: PAGE_SIZE }), [search, warehouseId, type, sellable, page]);
  const warehouseOptions = useMemo(() => (warehouses.data?.content ?? []).map((w) => [w.id, w.name] as const), [warehouses.data]);

  const setRecordStatus = async (l: StockLocation, next: RecordStatus): Promise<void> => {
    try {
      await saveLocation(l.id, { description: l.description, recordStatus: next, version: l.version });
      setNotice({ tone: 'ok', text: `${l.identifier}: ${next === 'ARCHIVED' ? 'archived' : 'now active'}.` });
      list.reload();
    } catch (cause) {
      setNotice({ tone: 'error', text: `${l.identifier}: ${messageOf(cause, 'refused')}` });
    }
  };
  const menuFor = (l: StockLocation): readonly MenuAction[] => !mayManage ? [] : [
    { label: 'Edit', testId: 'location-menu-edit', onSelect: () => setEditing(l) },
    l.recordStatus === 'ARCHIVED'
      ? { label: 'Restore', testId: 'location-menu-restore', onSelect: () => void setRecordStatus(l, 'ACTIVE') }
      : { label: 'Archive', testId: 'location-menu-archive', destructive: true, separatorBefore: true, onSelect: () => void setRecordStatus(l, 'ARCHIVED') },
  ];

  const rows = list.data?.content ?? [];
  const kpis = list.data?.kpis;
  const filtered = search !== '' || warehouseId !== '' || type !== '' || sellable !== '';

  usePageActions(
    mayManage ? <Button variant="primary" size="page-header" onClick={() => setEditing('new')} testId="new-location">New location</Button> : null,
    [mayManage],
  );

  if (list.forbidden) {
    return <Card><EmptyState title="You do not have access to Stock Locations" guidance="Viewing locations needs the warehouse.stock-location.view capability. Ask an administrator to grant it." /></Card>;
  }
  return (
    <>
      <KpiStrip kpis={[
        { key: 'locations', label: 'STOCK LOCATIONS', value: kpis?.locations ?? '—' }, { key: 'storage', label: 'STORAGE', value: kpis?.storage ?? '—' },
        { key: 'quarantine', label: 'QUARANTINE', value: kpis?.quarantine ?? '—' }, { key: 'build', label: 'BUILD STAGING', value: kpis?.buildStaging ?? '—' },
        { key: 'scrap', label: 'SCRAP', value: kpis?.scrap ?? '—' },
      ]} />
      <Toolbar>
        <SearchBox testId="location-search" value={searchDraft} onChange={(v) => { setSearchDraft(v); setPage(0); }} placeholder="Search location identifier or description" />
        <FilterSelect label="Warehouse" testId="location-filter-warehouse" value={warehouseId} onChange={(v) => { setWarehouseId(v); setPage(0); }} options={warehouseOptions} />
        <FilterSelect label="Type" testId="location-filter-type" value={type} onChange={(v) => { setType(v); setPage(0); }} options={LOCATION_TYPES} />
        <FilterSelect label="Sellable" testId="location-filter-sellable" value={sellable} onChange={(v) => { setSellable(v); setPage(0); }} options={[['true', 'Sellable'], ['false', 'Not sellable']]} />
      </Toolbar>
      <Notice notice={notice} />
      {list.loading ? <Card><EmptyState title="Loading locations…" guidance="Fetching the current list from the server." /></Card>
        : list.error ? <Card><EmptyState title="Locations could not be loaded" guidance={list.error} /></Card>
        : rows.length === 0 ? (
          <Card><EmptyState title={filtered ? 'No locations match these filters' : 'No stock locations yet'}
            guidance={filtered ? 'Clear the search or the filters.' : mayManage ? 'Choose New location to add one inside a warehouse.' : 'Nothing is shown because none has been added.'} /></Card>
        ) : (
          <div data-testid="location-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rows.map((l) => (
              <RecordCard key={l.id} testId={`location-card-${l.identifier}`} title={l.identifier} meta={l.description}
                columns={[
                  { label: 'WAREHOUSE', value: l.warehouseName },
                  { label: 'TYPE', value: locationTypeLabel(l.locationType) },
                  { label: 'SELLABLE', value: l.locationType === 'QUARANTINE' ? 'Never' : l.sellable ? 'Yes' : '—' },
                ]}
                state={l.recordStatus} stateNote={l.locationType === 'QUARANTINE' ? 'Physical expression of QC Pending' : l.sellable ? 'Sellable position' : 'Not established as sellable'}
                faded={l.recordStatus === 'ARCHIVED'} actions={menuFor(l)} />
            ))}
          </div>
        )}
      <Pager page={page} totalPages={list.data?.totalPages ?? 1} total={list.data?.totalElements ?? 0} size={PAGE_SIZE} onPage={setPage} />
      {editing ? <LocationDialog location={editing === 'new' ? null : editing} warehouses={warehouses.data?.content ?? []} onClose={() => setEditing(null)}
        onSaved={(text) => { setEditing(null); setNotice({ tone: 'ok', text }); list.reload(); }} /> : null}
    </>
  );
}

function LocationDialog({ location, warehouses, onClose, onSaved }: {
  readonly location: StockLocation | null; readonly warehouses: readonly Warehouse[]; readonly onClose: () => void; readonly onSaved: (m: string) => void;
}): React.JSX.Element {
  const active = warehouses.filter((w) => w.recordStatus === 'ACTIVE');
  const [warehouseId, setWarehouseId] = useState(location?.warehouseId ?? active[0]?.id ?? '');
  const [identifier, setIdentifier] = useState(location?.identifier ?? '');
  const [description, setDescription] = useState(location?.description ?? '');
  const [type, setType] = useState<string>(location?.locationType ?? 'STORAGE');
  const [status, setStatus] = useState<string>(location?.recordStatus ?? 'ACTIVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select: React.CSSProperties = { height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)' };
  const save = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      await saveLocation(location?.id ?? null, location
        ? { description: description || null, recordStatus: status, version: location.version }
        : { warehouseId, identifier, description: description || null, locationType: type, recordStatus: status });
      onSaved(location ? `${location.identifier}: saved.` : `${identifier.toUpperCase()}: added.`);
    } catch (cause) { setError(messageOf(cause, 'The location could not be saved.')); } finally { setBusy(false); }
  };
  return (
    <ConfirmDialog title={location ? `Edit ${location.identifier}` : 'New stock location'}
      consequence="Sellability follows the type - only Storage is sellable, Quarantine never is - and the type cannot be changed once made. A location is archived, never deleted."
      confirmLabel="Save" busy={busy} error={error} width="560px" testId="location-dialog"
      confirmDisabled={!location && (identifier.trim() === '' || warehouseId === '')} confirmDisabledReason="Choose a warehouse and give the location an identifier."
      onConfirm={() => void save()} onCancel={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3) var(--space-4)' }}>
        {location ? <FormBox label="Identifier" testId="location-identifier" value={identifier} onChange={() => undefined} hint="Fixed once made"><div data-testid="location-identifier" style={{ height: '36px', display: 'flex', alignItems: 'center', fontWeight: 700 }}>{identifier}</div></FormBox>
          : <FormBox label="Identifier" testId="location-identifier" value={identifier} onChange={setIdentifier} required hint="For example MAIN-STORAGE-A" />}
        <FormBox label="Warehouse" testId="location-warehouse" value={warehouseId} onChange={setWarehouseId} required>
          {location ? <div style={{ height: '36px', display: 'flex', alignItems: 'center', fontWeight: 600 }}>{location.warehouseName}</div>
            : <select data-testid="location-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} style={select}>
                {active.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>}
        </FormBox>
        <FormBox label="Type" testId="location-type" value={type} onChange={setType} required hint={location ? 'Fixed once made' : undefined}>
          {location ? <div style={{ height: '36px', display: 'flex', alignItems: 'center', fontWeight: 600 }}>{locationTypeLabel(location.locationType)}</div>
            : <select data-testid="location-type" value={type} onChange={(event) => setType(event.target.value)} style={select}>
                {LOCATION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>}
        </FormBox>
        <FormBox label="Status" testId="location-status" value={status} onChange={setStatus}>{statusSelect('location-status', status, setStatus)}</FormBox>
        <FormBox label="Description" testId="location-description" value={description} onChange={setDescription} wide />
      </div>
    </ConfirmDialog>
  );
}
