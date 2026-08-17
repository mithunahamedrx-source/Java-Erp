import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../shell/AppShell';
import { ApiError } from '../platform/api';
import { Notice, buttonStyle } from '../ui/primitives';
import { ColumnLabel, ConfigurationText, ConnectionChip, ExternalLinkCell, SHOP_ROW_COLUMNS } from './ShopChrome';
import { ShopFilterBar } from './ShopFilterBar';
import { ShopFormModal } from './ShopFormModal';
import { ShopSummaryStrip } from './ShopSummaryStrip';
import { fetchChannelTypeOptions, fetchMarketOptions, fetchShopSummary, listShops } from './shopApi';
import type { ChannelTypeOption, MarketOption, ShopFilters, ShopRow, ShopSummary } from './shopApi';

/**
 * `SC-W` — the Shops & Channels workspace (`SCS-010`, route `/administration/shops`).
 *
 * <p>🔴 `SCS-025` — FOUR STATES, all four approved: populated, empty, loading and retrieval
 * failure. A read failure says that NOTHING CHANGED and that this is a read failure rather
 * than evidence that shops are missing — it never implies the corpus is empty.
 *
 * <p>🔴 `SCS-024.d` — opening a row routes to the detail page. NO PER-ROW ACTION MENU EXISTS;
 * every act happens there.
 *
 * <p>🔴 `SCS-050.c` — hiding `Add Shop` is an affordance, never authorisation. The backend
 * refuses regardless of what this component renders.
 */
export default function ShopsWorkspacePage(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  /* 🔴 `PRM-090.a` — read independently. MANAGE never implies lifecycle or authorize. */
  const mayManage = permissions.includes('system.channel-instance.manage');

  const [filters, setFilters] = useState<ShopFilters>({});
  const [searchDraft, setSearchDraft] = useState('');
  const [rows, setRows] = useState<readonly ShopRow[]>([]);
  const [summary, setSummary] = useState<ShopSummary | null>(null);
  const [channelTypes, setChannelTypes] = useState<readonly ChannelTypeOption[]>([]);
  const [markets, setMarkets] = useState<readonly MarketOption[]>([]);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  /**
   * `SC-F` is a MODAL — its openness is component state, never a URL (`SCS-010`).
   *
   * <p>⚠ It may also be opened by ROUTER STATE, which the identity-mismatch result uses to
   * offer *Add a shop for that account* (`SCS-044`). 🔴 Router state is not addressable and
   * creates no route, so the no-route rule holds.
   */
  const [adding, setAdding] = useState(
    () => (location.state as { addShop?: boolean } | null)?.addShop === true,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [page, strip] = await Promise.all([listShops(filters), fetchShopSummary(filters)]);
      setRows(page.content);
      setTotalRegistered(page.totalRegistered);
      setSummary(strip);
      setForbidden(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true);
      } else {
        /*
          🔴 `SCS-025.c` — a READ failure. The message says nothing changed, so the operator
          does not read an empty screen as "the shops are gone".
        */
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Trioloo could not read the shop list.',
        );
      }
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    /* 🔴 `SCS-030.b` / `INV-16.7` — both closed sets come from the server; the browser
       keeps no copy of either, so neither can drift from what the backend accepts. */
    fetchChannelTypeOptions()
      .then(setChannelTypes)
      .catch(() => setChannelTypes([]));
    fetchMarketOptions()
      .then(setMarkets)
      .catch(() => setMarkets([]));
  }, []);

  const addShop = mayManage ? (
    <button
      type="button"
      data-testid="add-shop"
      /* 🔴 `SCS-010` — opens the MODAL. It navigates nowhere and creates no route. */
      onClick={() => setAdding(true)}
      style={buttonStyle('primary', 'page-header')}
    >
      Add Shop
    </button>
  ) : null;

  return (
    <div>
      <PageHeader
        title="Shops & Channels"
        subtitle="Each record is one external operating shop or account. Open a shop to connect it and make it available to Listings."
        actions={addShop}
      />

      {forbidden && (
        <Notice tone="danger" title="You do not have access to Shops & Channels" testId="shops-forbidden">
          This destination requires the <code>system.channel-instance.view</code> capability.
        </Notice>
      )}

      {!forbidden && (
        <>
          {summary && <ShopSummaryStrip summary={summary} />}

          {/*
            ⚠ The controls stay mounted through loading and failure so the operator's search
            and filters survive a retry — losing them on every error would punish the reader
            for a fault that was not theirs.
          */}
          <ShopFilterBar
            filters={filters}
            searchDraft={searchDraft}
            channelTypes={channelTypes}
            showing={rows.length}
            totalRegistered={totalRegistered}
            onSearchDraft={setSearchDraft}
            onSearchCommit={() =>
              setFilters((current) =>
                (current.search ?? '') === searchDraft.trim()
                  ? current
                  : { ...current, search: searchDraft.trim() || undefined },
              )
            }
            onFilterChange={setFilters}
            onClear={() =>
              /* `SCS-023.b` — every filter returns to all; SEARCH IS LEFT UNTOUCHED. */
              setFilters((current) => ({ search: current.search }))
            }
          />

          <ShopListHeader />

          {loading && <LoadingRows />}

          {!loading && loadError && <RetrievalFailure message={loadError} onRetry={() => void load()} />}

          {!loading && !loadError && rows.length === 0 && (
            <EmptyWorkspace filtered={filters.search !== undefined || hasFilter(filters)} action={addShop} />
          )}

          {!loading && !loadError && rows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {rows.map((row) => (
                <ShopListRow key={row.id} row={row} onOpen={() => navigate(`/administration/shops/${row.id}`)} />
              ))}
            </div>
          )}
        </>
      )}

      {adding && (
        <ShopFormModal
          mode="add"
          channelTypes={channelTypes}
          markets={markets}
          onCancel={() => setAdding(false)}
          /* 🔴 `SCS-030.f` — a CREATED shop routes to its detail page, where Connect lives. */
          onSaved={(id) => {
            setAdding(false);
            navigate(`/administration/shops/${id}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * The height of a populated row's CONTENT box, above the 13px padding and 1px border.
 *
 * <p>⚠ It is set by the tallest cell a row can carry — the shop name's line box. The loading
 * skeleton reserves exactly this so the list does not jump when the real rows replace it
 * (`SCS-025.b`), and `ShopsWorkspace.test.tsx` asserts the two heights agree.
 */
const SHOP_ROW_CONTENT_HEIGHT = '25px';

function hasFilter(filters: ShopFilters): boolean {
  return Boolean(filters.channelType || filters.connection || filters.configuration);
}

/** `SCS-024` — the approved column order. */
function ShopListHeader(): React.JSX.Element {
  return (
    <div
      data-testid="shop-list-header"
      style={{
        display: 'grid',
        gridTemplateColumns: SHOP_ROW_COLUMNS,
        gap: '16px',
        alignItems: 'center',
        padding: '14px 14px 9px',
        marginTop: '16px',
        borderBottom: '1px solid var(--color-divider-inner)',
      }}
    >
      <ColumnLabel>Shop</ColumnLabel>
      <ColumnLabel>Channel type</ColumnLabel>
      <ColumnLabel>Configuration</ColumnLabel>
      <ColumnLabel>Connection</ColumnLabel>
      <ColumnLabel>External link</ColumnLabel>
      <div />
    </div>
  );
}

/**
 * One shop.
 *
 * <p>🔴 `RULE 7.8.b` / `UX-272` — A STRUCTURED OPERATIONAL ROW DOES NOT WRAP. The grid keeps
 * its columns at every zoom; cells truncate, the row never reflows into a second line.
 *
 * <p>🔴 `SCS-024.a` — the shop's OWN NAME is the primary identity. A row reading only its
 * channel type would identify nothing (`INV-16.11`).
 */
function ShopListRow({ row, onOpen }: { readonly row: ShopRow; readonly onOpen: () => void }): React.JSX.Element {
  return (
    <div
      data-testid="shop-row"
      data-shop-code={row.code}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: SHOP_ROW_COLUMNS,
        gap: '16px',
        alignItems: 'center',
        padding: '13px 14px',
        border: '1px solid var(--color-divider-inner)',
        borderRadius: '10px',
        background: 'var(--color-surface)',
        cursor: 'pointer',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '13.5px',
            fontWeight: 700,
            color: 'var(--color-heading-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.name}
        </div>
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {row.channelTypeLabel}
      </div>
      {/* 🔴 `SCS-024.b` — two columns, two carriers. Never collapsed into one status. */}
      <div style={{ minWidth: 0 }}>
        <ConfigurationText configuration={row.configuration} />
      </div>
      <div style={{ minWidth: 0 }}>
        <ConnectionChip connection={row.connection} />
      </div>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <ExternalLinkCell externalLink={row.externalLink} bound={row.bound} />
      </div>
      {/* `SCS-024.d` — an affordance that OPENS the shop. 🔴 Not a menu. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--color-text-demoted)' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="m6 3 5 5-5 5" />
        </svg>
      </div>
    </div>
  );
}

/** `SCS-025.b` — LOADING PRESERVES ROW GEOMETRY AND GUESSES NO STATE TEXT. */
function LoadingRows(): React.JSX.Element {
  return (
    <div data-testid="shops-loading" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: SHOP_ROW_COLUMNS,
            gap: '16px',
            alignItems: 'center',
            /* Identical padding and border to a real row, so nothing shifts on arrival. */
            padding: '13px 14px',
            border: '1px solid var(--color-divider-inner)',
            borderRadius: '10px',
            background: 'var(--color-surface)',
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            /*
              🔴 `SCS-025.b` — GEOMETRY IS PRESERVED, so nothing shifts when the rows arrive.
              The wrapper carries the real row's content height (`SHOP_ROW_CONTENT_HEIGHT`);
              the bar inside is only the placeholder mark. Sizing the bar alone produced a
              41px skeleton against a 53px row, which is a jump the operator sees.
            */
            <div
              key={cell}
              style={{ height: SHOP_ROW_CONTENT_HEIGHT, display: 'flex', alignItems: 'center', minWidth: 0 }}
            >
              <div style={{ height: '13px', borderRadius: '4px', background: 'var(--color-strip)', width: '100%' }} />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only" aria-live="polite">
        Loading shops
      </span>
    </div>
  );
}

/**
 * `SCS-025.a` — the empty state EXPLAINS WHAT A SHOP IS.
 *
 * <p>🔴 Not presented as integration setup, and no key or secret appears anywhere in it.
 */
function EmptyWorkspace({
  filtered,
  action,
}: {
  readonly filtered: boolean;
  readonly action: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-testid="shops-empty"
      style={{
        marginTop: '10px',
        padding: '38px 24px',
        border: '1px solid var(--color-divider-inner)',
        borderRadius: '10px',
        background: 'var(--color-surface)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
        {filtered ? 'No shops match these filters' : 'No shops registered yet'}
      </div>
      <div
        style={{
          fontSize: '12.5px',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
          maxWidth: '560px',
          margin: '8px auto 0',
        }}
      >
        {filtered
          ? /* ⚠ `SCS-022.b` — an empty result is an ORDINARY OUTCOME, not an error. */
            'Nothing matches the current search and filters. Clearing them shows every registered shop.'
          : 'A shop is one exact account on one marketplace or website — several accounts on the same channel are normal, so name each one for the business that operates it. Register the shop first, then connect it to its account.'}
      </div>
      {!filtered && action && <div style={{ marginTop: '18px' }}>{action}</div>}
    </div>
  );
}

/**
 * `SCS-025.c` — the retrieval failure.
 *
 * <p>🔴 It states that NOTHING HAS CHANGED and that this is a read failure rather than a sign
 * that shops are missing — the distinction an operator needs before acting.
 */
function RetrievalFailure({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}): React.JSX.Element {
  return (
    <div data-testid="shops-load-error" style={{ marginTop: '10px' }}>
      <Notice tone="danger" title="Shops could not be loaded">
        Trioloo could not read the shop list. Nothing has been changed — this is a read failure, not a sign that
        shops are missing.
        <div style={{ marginTop: '10px' }}>
          <button type="button" data-testid="shops-retry" onClick={onRetry} style={buttonStyle('secondary', 'button')}>
            Try again
          </button>
        </div>
      </Notice>
      <span className="sr-only">{message}</span>
    </div>
  );
}
