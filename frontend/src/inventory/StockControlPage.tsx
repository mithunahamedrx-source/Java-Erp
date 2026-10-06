import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterSelect, KpiStrip, Pager, RecordCard, SearchBox, Toolbar, useDebounced, useRemoteList } from '../masterdata/MasterDataParts';
import { PageHeader } from '../shell/AppShell';
import { Card, EmptyState } from '../ui/primitives';
import { displayMoney, fetchSummary, listStockItems } from '../product/stockItemApi';

/**
 * Stock Control - Inventory -> Stock Control (`UX-024`, `/inventory/stock`). For now the STOCK POSITION of every Stock Item:
 * what is on hand, what is available to sell, and what it is worth. Every figure is DERIVED by Inventory from movements and
 * is never stored (`DB-001`); this page only reads it.
 *
 * <p>🔴 Movements, reservations, adjustments and transfers are not built yet, so nothing here changes stock. Stock enters
 * with goods receipts, which are the next step. The value is the weighted-average cost where one exists, else the
 * owner-entered reference cost (`PRD-206`), and is shown only to those with valuation authority.
 */
const PAGE_SIZE = 10;

export default function StockControlPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebounced(searchDraft);
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(0);

  const summary = useRemoteList(() => fetchSummary({ status: 'ACTIVE' }), []);
  const list = useRemoteList(
    () => listStockItems({ search, status: 'ACTIVE', inStockOnly: position === 'in', outOfStockOnly: position === 'out' }, page, PAGE_SIZE, 'stock', 'DESC'),
    [search, position, page],
  );
  const rows = list.data?.content ?? [];
  const s = summary.data;

  return (
    <>
      <PageHeader title="Stock Control" subtitle="Stock position of every Stock Item - derived from movements, never typed in" />
      <KpiStrip kpis={[
        { key: 'items', label: 'STOCK ITEMS', value: s?.totalStockItems ?? '—' },
        { key: 'on-hand', label: 'ON HAND', value: s?.physicalStockUnits ?? '—' },
        { key: 'available', label: 'AVAILABLE', value: s?.availableUnits ?? '—' },
      ]} />
      <Toolbar>
        <SearchBox testId="stock-search" value={searchDraft} onChange={(v) => { setSearchDraft(v); setPage(0); }} placeholder="Search name, SKU or barcode" />
        <FilterSelect label="Position" testId="stock-filter-position" value={position} onChange={(v) => { setPosition(v); setPage(0); }}
          options={[['in', 'In stock'], ['out', 'Out of stock']]} />
      </Toolbar>

      {list.forbidden ? <Card><EmptyState title="You do not have access to stock" guidance="Viewing stock needs the product stock-item view capability." /></Card>
        : list.loading ? <Card><EmptyState title="Loading stock…" guidance="Fetching the current positions." /></Card>
        : list.error ? <Card><EmptyState title="Stock could not be loaded" guidance={list.error} /></Card>
        : rows.length === 0 ? <Card><EmptyState title="No stock items match" guidance="Clear the search or the filter." /></Card>
        : (
          <div data-testid="stock-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rows.map((i) => (
              <div key={i.id} onClick={() => navigate(`/inventory/products/stock/${i.id}`)} style={{ cursor: 'pointer' }}>
                <RecordCard
                  testId={`stock-card-${i.inventorySku}`}
                  title={i.technicalName}
                  meta={`${i.inventorySku}${i.inventoryCategory ? ` · ${i.inventoryCategory}` : ''}`}
                  columns={[
                    { label: 'ON HAND', value: i.physicalStock },
                    { label: 'AVAILABLE', value: i.availableQuantity },
                    ...(i.stockValue !== undefined ? [{ label: 'STOCK VALUE', value: i.stockValue === null ? '—' : displayMoney(i.stockValue) }] : []),
                  ]}
                  state={i.outOfStock ? 'OUT_OF_STOCK' : 'IN_STOCK'}
                  faded={i.discontinued}
                />
              </div>
            ))}
          </div>
        )}
      <Pager page={page} totalPages={list.data?.totalPages ?? 1} total={list.data?.totalElements ?? 0} size={PAGE_SIZE} onPage={setPage} />
    </>
  );
}
