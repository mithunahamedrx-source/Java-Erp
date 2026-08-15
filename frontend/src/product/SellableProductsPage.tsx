import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SellableProductCard, SellableProductSummaryStrip } from './SellableProductCard';
import {
  fetchSellableSummary,
  listSellableProducts,
  sellableExportUrl,
} from './sellableProductApi';
import type {
  SellableProduct,
  SellableProductFilters,
  SellableProductSummary,
} from './sellableProductApi';
import { ApiError } from '../platform/api';
import { useAuth } from '../auth/AuthContext';
import { usePageActions } from '../shell/PageActions';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';

/**
 * Inventory → Products → Sellable Products.
 *
 * <p>Archetype B composition: header and tabs (owner: `ProductWorkspace`) → summary strip →
 * toolbar → CARD results → pagination.
 *
 * <p>🔴 Results are CARDS, never a table (`§3.15`, `UX-037.d`). 🔴 The summary is fetched
 * separately because it is pagination-independent (`UX-044.b`). 🔴 Export follows the active
 * filters, not the visible page.
 *
 * <p>🔴 `UX-039` — this tab carries its OWN toolbar and its OWN primary action. There is no
 * shared `+ Add Product` across the three entity classes.
 */
export default function SellableProductsPage(): React.JSX.Element {
  const { session } = useAuth();

  /**
   * 🔴 An AFFORDANCE ONLY (`UX-014`, `PRJ-120`). The backend refuses regardless, and
   * `SellableProductCommandService` requires the same capability on every entry point — a user
   * who reaches `/new` by URL is still refused there.
   */
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayManage = permissions.includes('product.sellable-product.manage');

  const [filters, setFilters] = useState<SellableProductFilters>({});
  const [searchDraft, setSearchDraft] = useState('');
  const [items, setItems] = useState<readonly SellableProduct[]>([]);
  const [summary, setSummary] = useState<SellableProductSummary | null>(null);
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
        listSellableProducts(filters, page, size, 'sellableSku', 'ASC'),
        fetchSellableSummary(filters),
      ]);
      setItems(pageResult.content);
      setTotalPages(pageResult.totalPages);
      setTotalElements(pageResult.totalElements);
      setSummary(summaryResult);
    } catch (cause) {
      // UX-112 — a permission refusal, a business refusal and a system error are different
      // states with different remedies, and are never collapsed into one message.
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        setError(cause instanceof Error ? cause.message : 'Sellable Products could not be loaded.');
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

  const applyFilter = (patch: Partial<SellableProductFilters>): void => {
    setPage(0);
    setFilters((current) => ({ ...current, ...patch }));
  };

  /**
   * LEVEL 1 — PAGE ACTIONS (`UX-045`), published into the shared page-header action region
   * (`UX-016`). 🔴 Never into the dataset toolbar below.
   *
   * <p>§3.8 order: secondary actions first, exactly ONE dark-filled primary, rightmost.
   * `UX-039.b` names this tab's primary action: **Create Sellable Product**.
   */
  usePageActions(
    <>
      <a data-testid="sellable-export-csv" href={sellableExportUrl(filters)} style={headerSecondary}>
        Export
      </a>
      {mayManage && (
        <Link data-testid="sellable-import-csv" to="/inventory/products/sellable/import" style={headerSecondary}>
          Import
        </Link>
      )}
      {mayManage && (
        <Link data-testid="create-sellable-product" to="/inventory/products/sellable/new" style={headerPrimary}>
          Create Sellable Product
        </Link>
      )}
    </>,
    [mayManage, JSON.stringify(filters)],
  );

  const filtersActive = useMemo(
    () => Object.entries(filters).some(([, value]) => value !== undefined && value !== ''),
    [filters],
  );

  if (forbidden) {
    return (
      <Card>
        <EmptyState
          title="You do not have access to Sellable Products"
          guidance="Viewing Sellable Products requires a capability your account has not been granted. Ask an administrator to grant it."
        />
      </Card>
    );
  }

  return (
    <>
      <SellableProductSummaryStrip summary={summary} />

      {/*
        Toolbar — canonical controls only (`UX-039.a`): search on name and Sellable SKU,
        nature, record status.

        🔴 The ratified filter set also names *has / has no Listing*. It is DELIBERATELY ABSENT
        here rather than rendered inert: `E-059` has no persistence in this stage, so the
        control could only answer from fabricated data. An always-empty filter that silently
        matches everything is worse than no filter, because it looks like it works.
      */}
      <div
        data-testid="sellable-products-toolbar"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'nowrap' }}
      >
        <input
          data-testid="sellable-search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyFilter({ search: searchDraft });
          }}
          onBlur={() => applyFilter({ search: searchDraft })}
          placeholder="Search name or Sellable SKU"
          aria-label="Search Sellable Products"
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

        <Select label="Nature" testId="filter-nature" value={filters.nature ?? ''}
          onChange={(v) => applyFilter({ nature: v as SellableProductFilters['nature'] })}
          options={['', 'SIMPLE', 'ASSEMBLED', 'BUNDLE']} />

        <Select label="Status" testId="filter-sellable-status" value={filters.status ?? ''}
          onChange={(v) => applyFilter({ status: v as SellableProductFilters['status'] })}
          options={['', 'DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']} />
      </div>

      {/* Results — CARDS. 🔴 Never a table. */}
      {loading ? (
        <Card>
          <EmptyState title="Loading Sellable Products…" guidance="Fetching the current result set from the server." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState title="Sellable Products could not be loaded" guidance={error} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtersActive ? 'No Sellable Products match these filters' : 'No Sellable Products exist yet'}
            guidance={
              filtersActive
                ? 'Adjust the search or filters above to widen the result set.'
                : 'Create a Sellable Product, or import a CSV file. Nothing is shown here because no records exist.'
            }
          />
        </Card>
      ) : (
        /*
          UX-263-UX-266 — operational cards participate in one coherent workspace canvas.
          `OperationalRegion` owns no horizontal child scroller. Nothing Product-tab-specific
          is introduced.
        */
        <OperationalRegion>
          <div
            data-testid="sellable-product-results"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            {items.map((item) => (
              <SellableProductCard key={item.id} item={item} />
            ))}
          </div>
        </OperationalRegion>
      )}

      {/* §3.16 pagination. 🔴 Affects visible cards only — never the summary or the export. */}
      {!loading && items.length > 0 && (
        <div
          data-testid="sellable-pagination"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-7)' }}
        >
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {page * size + 1}–{Math.min((page + 1) * size, totalElements)} of {totalElements}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" data-testid="sellable-page-prev" disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))} style={pageButton}>‹</button>
            <button type="button" data-testid="sellable-page-next" disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)} style={pageButton}>›</button>
          </div>
        </div>
      )}
    </>
  );
}

/** §3.8 header button — height `40px`, padding `0 18px`, radius `10px`, `13.5px`. */
const headerSecondary: React.CSSProperties = { ...buttonStyle('secondary', 'page-header'), textDecoration: 'none' };

/** 🔴 Exactly ONE dark-filled primary per header (`RULE 3.11`). */
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
