import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StockItemCard, StockItemSummaryStrip } from './StockItemCard';
import { exportUrl, fetchSummary, listStockItems } from './stockItemApi';
import type { StockItem, StockItemFilters, StockItemSummary } from './stockItemApi';
import { ApiError } from '../platform/api';
import { useAuth } from '../auth/AuthContext';
import { usePageActions } from '../shell/PageActions';
import { ACTION_ICON, ACTION_ICON_SIZE, ACTION_ICON_STROKE } from '../shell/icons';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';

/**
 * Inventory → Products → Stock Items.
 *
 * <p>Archetype B composition: header and tabs (owner: `ProductWorkspace`) → summary strip →
 * toolbar → CARD results → pagination.
 *
 * <p>🔴 Results are CARDS, never a table (`§3.15`). 🔴 The summary is fetched separately
 * because it is pagination-independent (`UX-044.b`). 🔴 Export follows the active filters, not
 * the visible page.
 */
export default function StockItemsPage(): React.JSX.Element {
  const { session } = useAuth();

  /**
   * 🔴 An AFFORDANCE ONLY (`UX-014`, `PRJ-120`). Hiding a control is a usability decision;
   * the backend refuses regardless, and `StockItemCommandService` requires the same capability
   * on every entry point. A user who reaches `/new` by URL is still refused there.
   *
   * ⚠ Hidden rather than DISABLED: `RULE 3.18.e` records that disabled is NOT
   * permission-restricted, and the two must not borrow one another's treatment.
   */
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayManage = permissions.includes('product.stock-item.manage');
  const ExportIcon = ACTION_ICON.export;
  const ImportIcon = ACTION_ICON.import;

  const [filters, setFilters] = useState<StockItemFilters>({});
  const [searchDraft, setSearchDraft] = useState('');
  const [items, setItems] = useState<readonly StockItem[]>([]);
  const [summary, setSummary] = useState<StockItemSummary | null>(null);
  const [page, setPage] = useState(0);
  const [size] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [pageResult, summaryResult] = await Promise.all([
        listStockItems(filters, page, size, 'inventorySku', 'ASC'),
        fetchSummary(filters),
      ]);
      setItems(pageResult.content);
      setTotalPages(pageResult.totalPages);
      setTotalElements(pageResult.totalElements);
      setSummary(summaryResult);
    } catch (cause) {
      // UX-112 - a permission refusal, a business refusal and a system error are different
      // states with different remedies, and are never collapsed into one message.
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        setError(cause instanceof Error ? cause.message : 'Stock Items could not be loaded.');
      }
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page, size]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilter = (patch: Partial<StockItemFilters>): void => {
    setPage(0);
    setFilters((current) => ({ ...current, ...patch }));
  };

  /**
   * LEVEL 1 — PAGE ACTIONS (`UX-045`). They act on the surface, so they belong in the
   * page-header action region (`UX-016`), never in the dataset toolbar below.
   *
   * <p>§3.8 order: secondary actions first, exactly ONE dark-filled primary, rightmost of the
   * group and therefore closest to the utility separator.
   */
  usePageActions(
    <>
      <a data-testid="export-csv" href={exportUrl(filters)} style={headerSecondary}>
        <ExportIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
        Export
      </a>
      {mayManage && (
        <Link data-testid="import-csv" to="/inventory/products/stock/import" style={headerSecondary}>
          <ImportIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
          Import
        </Link>
      )}
      {mayManage && (
        <Link data-testid="create-stock-item" to="/inventory/products/stock/new" style={headerPrimary}>
          + Add Item
        </Link>
      )}
    </>,
    [mayManage, JSON.stringify(filters)],
  );

  const filtersActive = useMemo(
    () => Object.entries(filters).some(([, value]) => value !== undefined && value !== '' && value !== false),
    [filters],
  );

  if (forbidden) {
    return (
      <Card>
        <EmptyState
          title="You do not have access to Stock Items"
          guidance="Viewing Stock Items requires a capability your account has not been granted. Ask an administrator to grant it."
        />
      </Card>
    );
  }

  return (
    <>
      <StockItemSummaryStrip summary={summary} />

      {/* Toolbar - canonical controls only (UX-039.a). */}
      <div
        data-testid="stock-items-toolbar"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'nowrap' }}
      >
        <input
          data-testid="stock-search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyFilter({ search: searchDraft });
          }}
          onBlur={() => applyFilter({ search: searchDraft })}
          placeholder="Search name, SKU or barcode"
          aria-label="Search Stock Items"
          style={{
            height: 'var(--control-height-form)',
            width: '280px',
            borderRadius: 'var(--radius-control)',
            border: '1px solid var(--color-border-control)',
            padding: '0 12px',
            fontSize: '13px',
            fontFamily: 'inherit',
            background: 'var(--color-surface)',
          }}
        />

        <Select label="Status" testId="filter-status" value={filters.status ?? ''}
          onChange={(v) => applyFilter({ status: v as StockItemFilters['status'] })}
          options={['', 'DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']} />

        <Select label="Serialization" testId="filter-serialization" value={filters.serializationPolicy ?? ''}
          onChange={(v) => applyFilter({ serializationPolicy: v as StockItemFilters['serializationPolicy'] })}
          options={['', 'NOT_SERIALIZED', 'SERIALIZED']} />

        <label
          data-testid="filter-out-of-stock"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '13px' }}
        >
          <input
            type="checkbox"
            checked={filters.outOfStockOnly ?? false}
            onChange={(event) => applyFilter({ outOfStockOnly: event.target.checked })}
            style={{ width: '16px', height: '16px', accentColor: 'var(--color-ink)' }}
          />
          Out of stock only
        </label>

      </div>

      {/* Results - CARDS. 🔴 Never a table. */}
      {loading ? (
        <Card>
          <EmptyState title="Loading Stock Items…" guidance="Fetching the current result set from the server." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState title="Stock Items could not be loaded" guidance={error} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtersActive ? 'No Stock Items match these filters' : 'No Stock Items exist yet'}
            guidance={
              filtersActive
                ? 'Adjust the search or filters above to widen the result set.'
                : 'Create a Stock Item, or import a CSV file. Nothing is shown here because no records exist.'
            }
          />
        </Card>
      ) : (
        /*
          UX-263-UX-266 - operational cards participate in one coherent workspace canvas.
          The rows scroll inside their own container while the page header, tabs, summary,
          filters and pagination stay fixed and visible, and 🔴 the page never becomes a
          horizontal child scroller.

          OperationalRegion is the ratified shared primitive: it owns no `overflow-x`,
          the hidden-chrome treatment (RULE 3.20) and the mandatory UX-073 / UX-074
          discoverability affordance. Nothing Product-specific is introduced here.
        */
        <OperationalRegion>
          <div
            data-testid="stock-item-results"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            {items.map((item) => (
              <StockItemCard key={item.id} item={item} />
            ))}
          </div>
        </OperationalRegion>
      )}

      {/* §3.16 pagination. 🔴 Affects visible cards only - never the summary or the export. */}
      {!loading && items.length > 0 && (
        <div
          data-testid="stock-pagination"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-7)' }}
        >
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {page * size + 1}–{Math.min((page + 1) * size, totalElements)} of {totalElements}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" data-testid="page-prev" disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))} style={pageButton}>‹</button>
            <button type="button" data-testid="page-next" disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)} style={pageButton}>›</button>
          </div>
        </div>
      )}
    </>
  );
}

/** §3.8 header button — height `40px`, padding `0 18px`, radius `10px`, `13.5px`. */
const headerSecondary: React.CSSProperties = {
  ...buttonStyle('secondary', 'page-header'),
  gap: 'var(--space-2)',
  textDecoration: 'none',
};

/** 🔴 Exactly ONE dark-filled primary per header (`RULE 3.11`, `04-page-header.png`). */
const headerPrimary: React.CSSProperties = {
  ...buttonStyle('primary', 'page-header'),
  textDecoration: 'none',
};

const pageButton: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '9px',
  border: '1px solid var(--color-border-control)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-muted)',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

function Select({
  label,
  testId,
  value,
  onChange,
  options,
}: {
  readonly label: string;
  readonly testId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
}): React.JSX.Element {
  return (
    <select
      data-testid={testId}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        height: 'var(--control-height-row-action)',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--color-border-control)',
        padding: '0 8px',
        fontSize: '13px',
        fontFamily: 'inherit',
        background: 'var(--color-surface)',
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option === '' ? `${label}: all` : option}
        </option>
      ))}
    </select>
  );
}
