import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../shell/AppShell';
import { Button, EmptyState, SegmentedControl, Select, buttonStyle } from '../ui/primitives';
import OrderCard from './OrderCard';
import { ApiError } from '../platform/api';
import { fetchChannelOrderSummary, listChannelOrders } from './orderApi';
import type { ChannelOrderFilters, ChannelOrderRow, ChannelOrderSummary } from './orderApi';
import { ORDER_STATUS_TABS, displayMoney, displayStatus } from './orderView';
import { buildOrderCsv, orderCsvFilename } from './orderCsv';
import { ORDER_LIFECYCLE_ROLE, semanticRoleOf } from '../design/semanticRole';

/**
 * FRAME 01 - Order Dashboard / List.
 *
 * Read-only `API_MANAGED` Orders first slice (`OSC-061`). The approved capture fixes a
 * card-list workspace, not a table (`OSC-030`). Undecided KPI/status controls stay out of
 * the operator UI until their business rules are ratified.
 */
/**
 * The sentinel for "no filter on this dimension".
 *
 * ⚠ `SegmentedControl` holds one selected value and an empty string is a legitimate search
 * term elsewhere, so the unfiltered option carries an explicit name rather than `''`. It never
 * reaches the API: it is translated to `undefined` before the request is built.
 */
const ALL = '__ALL__';

export default function OrdersPage(): React.JSX.Element {
  const [items, setItems] = useState<readonly ChannelOrderRow[]>([]);
  const [summary, setSummary] = useState<ChannelOrderSummary | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<ChannelOrderFilters>({});
  const [page, setPage] = useState(0);
  /*
    ⚠ FIVE PER PAGE IS A PRODUCT-OWNER DECISION (`OSC-058.c`), not a viewport response. `RULE 7.3.a`
    and `UX-266` forbid page size changing with zoom or width, and it does not: this is a constant.
  */
  const [size] = useState(5);
  /*
    🔴 SELECTION SURVIVES PAGING AND NOTHING ELSE (`OSC-058.d`, product owner, 2026-08-24).
    Turning the page is NAVIGATION within one result set; changing a filter, a tab or the search
    REPLACES the result set, and a tick that outlived that would leave the operator holding records
    they can no longer see — the mistake `PRM-025`'s per-record authorisation exists to prevent.

    ⚠ IT HOLDS WHOLE ROWS, NOT IDS, AND THAT IS WHAT MAKES CROSS-PAGE EXPORT HONEST. With five
    orders a page, an operator who ticks rows on pages 1, 2 and 3 has selected records that are no
    longer loaded. Keeping only ids would force a refetch — or, worse, silently export the twelve
    the browser still happened to hold.
  */
  const [selected, setSelected] = useState<ReadonlyMap<string, ChannelOrderRow>>(new Map());
  const [exporting, setExporting] = useState(false);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  /*
    The channel options are held separately from `summary` so they survive a failed or empty
    reload. Rebuilding them from every response would make the control the operator just used
    flicker or vanish underneath them.
  */
  const [channelOptions, setChannelOptions] = useState<
    readonly { readonly channelType: string; readonly orderCount: number }[]
  >([]);
  const [shopOptions, setShopOptions] = useState<
    readonly {
      readonly channelInstanceId: string;
      readonly code: string;
      readonly name: string | null;
      readonly orderCount: number;
    }[]
  >([]);
  /*
    ⚠ A status with no entry is ABSENT from the map, so its segment renders NO count rather than
    a fabricated `0` (`SYS-034`, `OSC-045`). A status the server reports as `0` renders `0`.
  */
  const statusCounts = new Map<string, number>(
    (summary?.statusCounts ?? []).map((entry) => [entry.status, entry.orderCount]),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [orders, totals] = await Promise.all([
        listChannelOrders(filters, page, size),
        fetchChannelOrderSummary(filters),
      ]);
      setItems(orders.content);
      setTotalElements(orders.totalElements);
      setTotalPages(orders.totalPages);
      setSummary(totals);
      setChannelOptions(totals.channelTypes ?? []);
      setShopOptions(totals.shops ?? []);
    } catch (cause) {
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        setError(cause instanceof Error ? cause.message : 'Orders could not be loaded.');
      }
      setItems([]);
      setSelected(new Map());
      setSummary(null);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, size]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = (): void => {
    setPage(0);
    setFilters((current) => ({ ...current, search: searchDraft.trim() || undefined }));
  };

  /*
    The search applies as the operator types, after a short pause.

    ⚠ The superseded implementation applied ONLY on Enter, with no button and no other
    affordance, so the field read as dead — it was reported as "not working". Enter still
    applies immediately through the form's submit; this simply stops the field from looking
    inert when nobody presses it.

    🔴 This is an input debounce and nothing else. It changes no page size, no record count and
    no permission (`RULE 7.3.a`), and it reads no viewport (`UX-266`).
  */
  /*
    THE SELECTION IS CLEARED BY A FILTER, A TAB OR A SEARCH - AND NOT BY PAGING.
    That is the whole distinction the owner drew (`OSC-058.d`), and it is keyed on `filters`
    rather than on the fetch, so turning the page never reaches it. A tick that outlived a filter
    change would leave the operator holding records the new result set does not contain, and
    Export would then write rows that contradict the screen.
  */
  useEffect(() => {
    setSelected(new Map());
  }, [filters]);

  const setSelectedFor = useCallback((order: ChannelOrderRow, next: boolean) => {
    setSelected((current) => {
      const updated = new Map(current);
      if (next) {
        updated.set(order.id, order);
      } else {
        updated.delete(order.id);
      }
      return updated;
    });
  }, []);

  /*
    SELECT ALL MEANS THIS PAGE (`OSC-058.d`). The owner asked for exactly that, and it is also
    the only honest reading: a control that silently ticked 158 records the operator has never
    seen would claim a review that did not happen.
  */
  const pageAllSelected = items.length > 0 && items.every((order) => selected.has(order.id));
  const togglePage = useCallback((next: boolean) => {
    setSelected((current) => {
      const updated = new Map(current);
      for (const order of items) {
        if (next) {
          updated.set(order.id, order);
        } else {
          updated.delete(order.id);
        }
      }
      return updated;
    });
  }, [items]);

  /*
    EXPORT SCOPE IS RESOLVED HERE, AND NEVER FROM THE VISIBLE PAGE (`UX-044.b`).
    A selection exports exactly what was ticked. NO selection exports the ACTIVE RESULT SET under
    the current search and filters (`UX-044.a`) - which means fetching every matching record, not
    the five on screen. Exporting five because the browser shows five is the silent truncation
    `UX-044.b` names outright, and at this page size it would be a near-total one.
  */
  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const scope = selected.size > 0 ? 'selected' : 'all';
      const rows = selected.size > 0
        ? [...selected.values()]
        : await collectActiveResultSet(filters, totalElements);
      download(buildOrderCsv(rows), orderCsvFilename(scope, rows.length, new Date()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The export could not be produced.');
    } finally {
      setExporting(false);
    }
  }, [selected, filters, totalElements]);

  useEffect(() => {
    const pending = searchDraft.trim() || undefined;
    if (pending === filters.search) {
      return;
    }
    const timer = setTimeout(() => {
      setPage(0);
      setFilters((current) => ({ ...current, search: pending }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, filters.search]);

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="All channels - operational workspace"
        actions={
          /*
            `UX-016` / `UX-045` - these act on the SURFACE, not on one record, so they belong in
            the page-header action region. `UX-045`'s own examples are "Add Item - Import - Export".

            `RULE 3.11` - EXACTLY ONE PRIMARY, and the dark button is rightmost. Create Order is
            that one; Export and Print are secondary. `RULE 3.11.d` fixes the compact page-header
            geometry, which `buttonStyle('...', 'header')` already carries.

            `UX-045.f` - the icons never replace the visible label.
          */
          <div style={headerActionsStyle}>
            <Button
              variant="secondary"
              size="page-header"
              onClick={() => void exportCsv()}
              disabled={exporting || loading || forbidden}
              testId="orders-export"
            >
              {exporting ? 'Exporting...' : exportLabel(selected.size)}
            </Button>

            {/*
              UNBLOCKED 2026-08-24. `OSC-058.b` refused this because `PRN-023` sources the Sales
              Invoice printable from an `E-039` record whose content `INV-39.2` requires
              snapshotted, and none existed. `V22` creates it, `SalesInvoiceService` fills it and
              `InvoicePage` renders it.

              It opens ONE selected order's invoice. `PRM-025` requires each record authorised
              individually with per-record results (`SYS-073`), and `GAP-034` still records no
              permitted-bulk-transition inventory - so `Print invoices` in bulk stays unbuilt.
            */}
            <Button
              variant="secondary"
              size="page-header"
              disabled={selected.size !== 1}
              describedBy={selected.size === 1 ? undefined : 'orders-print-reason'}
              testId="orders-print"
              onClick={() => {
                const only = [...selected.keys()][0];
                if (only) {
                  window.open(`/sales/orders/${only}/invoice`, '_blank', 'noopener');
                }
              }}
            >
              Print
            </Button>

            {/*
              BLOCKED - MISSING CANONICAL BUSINESS RULE. `PRM-091` ratifies exactly two Order
              capability codes and states that NEITHER grants Order mutation; `PRM-089.b` is a
              spelling rule and not a generator, so no create permission may be minted here.
              `GAP-035` and `GAP-023` leave the modal's own behaviour unspecified. `OSC-058.a`.
            */}
            <Button
              variant="primary"
              size="page-header"
              disabled
              describedBy="orders-create-reason"
              testId="orders-create"
            >
              Create Order
            </Button>
          </div>
        }
      />

      {/*
        `Button.describedBy` points at VISIBLE text, deliberately: a disabled action's reason is
        never tooltip-only, because a tooltip is unreachable by keyboard and invisible on touch.
      */}
      <p style={blockedReasonStyle}>
        <span id="orders-print-reason">
          <strong>Print</strong> opens the invoice for <strong>one</strong> selected order.
          Bulk printing stays unavailable: <code>PRM-025</code> requires each record authorised
          individually and <code>GAP-034</code> records no permitted bulk-action inventory.
        </span>{' '}
        <span id="orders-create-reason">
          <strong>Create Order</strong> is unavailable: no Order-creation capability is ratified
          (<code>PRM-091</code> grants view and sync only, and neither grants Order mutation).
        </span>
      </p>

      <SummaryStrip summary={summary} loading={loading} unavailable={forbidden || error !== null} />

      {/*
        🔴 `RULE 3.13` — the list status tabs ARE the canonical segmented control, and
        `RULE 5.2` requires it to be REUSED rather than re-cut: one container with
        `overflow: hidden`, `width: fit-content`, a permanently-present ink-filled active
        segment (`RULE 8.6.c`), and NO per-tab pill, gap or border.

        🔴 `UX-266` names tabs explicitly among the structural UI that DOES NOT WRAP, and
        `UX-265` forbids `overflow-x: auto` as the escape. The row therefore stays one row and
        participates in the one coherent workspace canvas above the guaranteed band (`UX-264`).
      */}
      <div className="operational-row" style={controlRowStyle}>
        <span style={filterLabelStyle}>STATUS</span>
        <SegmentedControl
          options={ORDER_STATUS_TABS.map((tab) => ({
            value: tab.value ?? ALL,
            label: tab.label,
            count: tab.value === null ? summary?.totalOrders : statusCounts.get(tab.value),
            /*
              🔴 The role comes from `semanticRole.ts`, the one source of semantic-role truth
              (`RULE 3.3.d`). It is NEVER derived from the label text here.
            */
            countTone:
              tab.value === null ? 'neutral' : semanticRoleOf(ORDER_LIFECYCLE_ROLE, tab.value),
          }))}
          value={filters.status ?? ALL}
          onChange={(next) => {
            setPage(0);
            setFilters((current) => ({ ...current, status: next === ALL ? undefined : next }));
          }}
        />
      </div>

      <div className="operational-row" style={controlRowStyle}>
        {/*
          ⚠ THE SEARCH SITS FIRST AND IS DELIBERATELY NARROW — a product-owner composition
          decision, 2026-08-23. It no longer stretches to fill the row: a `240px` flexible field
          swallowed every pixel the other controls did not claim, which is what pushed the
          period filter out of reach and made the row look like a search bar with decorations.
          🔴 `flexShrink: 0` keeps it from being squeezed instead, because `UX-266` forbids the
          row solving width pressure by reshaping itself.
        */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
          style={{ flex: '0 0 auto' }}
        >
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Order no., ref, customer"
            aria-label="Search orders"
            style={searchStyle}
          />
        </form>
        <span style={filterLabelStyle}>CHANNEL</span>
        {/*
          🔴 THE CHANNEL OPTIONS COME FROM THE SERVER, NOT FROM A LIST IN THE BROWSER.
          The superseded implementation hard-coded `Daraz · Website · Walk-in · Phone` and
          DISABLED every one of them, so the control could not be clicked at all. A fixed list
          here would also be a second register of a set `SYS-108` owns, offering filters that can
          only ever return nothing.

          ⚠ `UX-273.d` — showing `Daraz` is presentation; the canonical value stays the channel
          type, and nothing branches on the label.
        */}
        <SegmentedControl
          options={[
            { value: ALL, label: 'All channels' },
            ...channelOptions.map((option) => ({
              value: option.channelType,
              label: displayStatus(option.channelType),
            })),
          ]}
          value={filters.channelType ?? ALL}
          onChange={(next) => {
            setPage(0);
            setFilters((current) => ({ ...current, channelType: next === ALL ? undefined : next }));
          }}
        />
        {/*
          🔴 `BR-002` — every order records its channel type AND its channel INSTANCE, and
          "Daraz" is never a sufficient attribution: settlement arrives per shop and margin
          differs per shop. The channel control above cannot answer "which shop"; this does.

          ⚠ A SELECT, not a segmented control, and deliberately. `RULE 3.13` gives the segmented
          control to status, channel and period — three CLOSED sets. Shops are an OPEN set:
          `BR-128` already records seven Daraz seller accounts as seven independent
          counterparties, and seven segments would break `UX-266`'s no-wrap contract on this row.
          `RULE 3.18` geometry applies to the select instead.
        */}
        <span style={filterLabelStyle}>SHOP</span>
        <div style={{ flex: '0 0 auto', width: '196px' }}>
          <Select
            value={filters.channelInstanceId ?? ALL}
            onChange={(next) => {
              setPage(0);
              setFilters((current) => ({
                ...current,
                channelInstanceId: next === ALL ? undefined : next,
              }));
            }}
          >
            <option value={ALL}>All shops</option>
            {shopOptions.map((shop) => (
              <option key={shop.channelInstanceId} value={shop.channelInstanceId}>
                {(shop.name ?? shop.code) + ' · ' + shop.orderCount}
              </option>
            ))}
          </Select>
        </div>
        <span style={filterLabelStyle}>PERIOD</span>
        {/*
          🔴 THE PERIOD FILTER USES THE SAME TIMESTAMP THE `Today's orders` CARD COUNTS — the
          moment the order entered THIS system — because two period bases on one screen is the
          exact defect `GAP-004` recorded when it asked what boundary the shipped `This month`
          KPI used and found no answer.

          🔴 `Day` · `Month` · `Year` are CALENDAR boundaries in `Asia/Dhaka` (`TEC-050`,
          `TEC-052`). ⚠ No rolling window is offered: no rolling-period concept exists anywhere
          in the corpus, so `last 30 days` would be inventing what `Month` means.

          ✅ `RULE 3.13` names the period filter as a third use of this same segmented control,
          and `RULE 5.2` requires it to be the same component — which it is.
        */}
        <SegmentedControl
          options={[
            { value: ALL, label: 'All time' },
            { value: 'DAY', label: 'Day' },
            { value: 'MONTH', label: 'Month' },
            { value: 'YEAR', label: 'Year' },
          ]}
          value={filters.period ?? ALL}
          onChange={(next) => {
            setPage(0);
            setFilters((current) => ({ ...current, period: next === ALL ? undefined : next }));
          }}
        />
        <div style={{ flex: 1, minWidth: 'var(--space-3)' }} />
        <button
          type="button"
          onClick={() => {
            setSearchDraft('');
            setFilters({});
            setPage(0);
          }}
          style={resetStyle}
        >
          Reset
        </button>
      </div>

      {loading ? (
        <OrdersSurface>
          <EmptyState title="Loading orders..." guidance="Fetching channel orders already imported into Trioloo." />
        </OrdersSurface>
      ) : forbidden ? (
        <OrdersSurface>
          <EmptyState title="Orders are not available" guidance="Your role does not include order.channel-order.view." />
        </OrdersSurface>
      ) : error ? (
        <OrdersSurface>
          <EmptyState title="Orders could not be loaded" guidance={error} />
        </OrdersSurface>
      ) : items.length === 0 ? (
        <OrdersSurface>
          <EmptyState title="No orders imported yet" guidance="Run the approved Daraz order pull, then this workspace will show the imported channel orders." />
        </OrdersSurface>
      ) : (
        <div style={orderListStyle}>
          {/*
            The select-all lives WITH the list it acts on, not in the page header. `UX-045.c` and
            `UX-016` keep record-scoped controls out of page-level positions, and this one scopes
            to the five rows below it.
          */}
          <div className="operational-row" style={selectAllRowStyle}>
            <label style={selectAllLabelStyle}>
              <input
                type="checkbox"
                checked={pageAllSelected}
                onChange={(event) => togglePage(event.target.checked)}
                style={{ width: '15px', height: '15px', margin: 0, accentColor: 'var(--color-ink)', cursor: 'pointer' }}
                data-testid="orders-select-page"
              />
              Select all on this page
            </label>
            {selected.size > 0 ? (
              <>
                {/*
                  The count states the WHOLE selection, which may span pages the operator is no
                  longer looking at. Showing only the ticks visible here would understate what
                  Export is about to write.
                */}
                <span style={selectionCountStyle} data-testid="orders-selection-count">
                  {selected.size} selected
                </span>
                <button type="button" style={clearSelectionStyle} onClick={() => setSelected(new Map())}>
                  Clear selection
                </button>
              </>
            ) : null}
          </div>
          {items.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={selected.has(order.id)}
              onSelectedChange={(next) => setSelectedFor(order, next)}
            />
          ))}
        </div>
      )}

      <div style={paginationStyle}>
        <span>
          Showing {totalElements === 0 ? '0' : `${page * size + 1}-${Math.min((page + 1) * size, totalElements)}`} of {totalElements} orders
          {summary ? ` · ${summary.totalItems} item${summary.totalItems === 1 ? '' : 's'}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={dateChipStyle}>{size} per page</span>
          {/* A button whose accessible name is "‹" tells a screen-reader user nothing. */}
          <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} style={pagerButtonStyle}>‹</button>
          <span style={activePageStyle}>{page + 1}</span>
          <button
            type="button"
            aria-label="Next page"
            disabled={totalPages === 0 || page + 1 >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            style={pagerButtonStyle}
          >
            ›
          </button>
        </div>
      </div>
    </>
  );
}

function OrdersSurface({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  // The same separation the card list gets, so an empty workspace does not sit tighter than a
  // full one and the page does not shift when the first order arrives.
  return <section style={{ ...ordersSurfaceStyle, marginTop: 'var(--space-7)' }}>{children}</section>;
}

/**
 * The four summary cards, ratified by the product owner on 2026-08-23.
 *
 * 🔴 Each figure is server-computed and rendered as received (`TEC-095`). Nothing here adds,
 * subtracts or rounds, and `Total collectable` never passes through a `Number` (`OSC-043`).
 *
 * 🔴 A figure the server could not supply renders as an explicit absence, never as `0`
 * (`OSC-045`, `SYS-034`, `BR-134`) — a real zero and an unavailable figure must not look alike.
 */
function SummaryStrip({
  summary,
  loading,
  unavailable,
}: {
  readonly summary: ChannelOrderSummary | null;
  readonly loading: boolean;
  readonly unavailable: boolean;
}): React.JSX.Element {
  const figure = (value: number | null | undefined): string =>
    loading ? '—' : unavailable || value === null || value === undefined ? 'Not available' : String(value);

  return (
    <div style={summaryStripStyle} data-testid="order-summary-strip">
      <SummaryCard label="Total orders" value={figure(summary?.totalOrders)} />
      <SummaryCard label="Today's orders" value={figure(summary?.todaysOrders)} note="Placed today · Asia/Dhaka" />
      <SummaryCard
        label="Today's dispatched"
        value={figure(summary?.todaysDispatched)}
        note="First observed dispatched today"
      />
      <SummaryCard
        label="Total collectable"
        value={
          loading
            ? '—'
            : unavailable
              ? 'Not available'
              : (displayMoney(summary?.totalCollectable ?? null) ?? 'Not available')
        }
        note="Delivered, not yet received"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}): React.JSX.Element {
  return (
    <article style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div className="tabular-nums" style={summaryValueStyle}>
        {value}
      </div>
      {note ? <div style={summaryNoteStyle}>{note}</div> : null}
    </article>
  );
}

/*
  The order collection. `marginTop` separates the card list from the control row above it: the
  controls are chrome, the cards are the record set, and they read as one block without it.
*/
const orderListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--space-6)',
  marginTop: 'var(--space-7)',
};

const ordersSurfaceStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  overflow: 'hidden',
};

const summaryStripStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 'var(--space-5)',
  marginTop: 'var(--space-7)',
};

const summaryCardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  padding: '13px 17px',
  minWidth: 0,
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 750,
  color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: '5px',
  fontSize: '22px',
  fontWeight: 800,
  color: 'var(--color-heading-ink)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryNoteStyle: React.CSSProperties = {
  marginTop: '3px',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/*
  One control row shape, used by BOTH the status row and the channel row.

  🔴 `UX-266` names tabs and filter/control rows among the structural UI that does not wrap, and
  `.operational-row` carries the `flex-wrap: nowrap !important` safety net that `RULE 7.4` and
  `UX-060` already established for every such row. 🔴 No `overflow-x` is declared here — `UX-265`
  forbids it as a responsive solution, and above the guaranteed 80%–110% band the row moves with
  the one coherent workspace canvas instead (`UX-263`, `UX-264`).
*/
const controlRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-6)',
  minWidth: 0,
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 750,
  color: 'var(--color-text-muted)',
  letterSpacing: '0',
  flexShrink: 0,
};

/*
  `RULE 3.18` — the approved search input geometry: `34px` / `9px` radius / `13px` text. Only
  the WIDTH is set here, and it is fixed rather than flexible so the field never grows to swallow
  the row (product-owner decision, 2026-08-23).
*/
const searchStyle: React.CSSProperties = {
  width: '232px',
  height: '34px',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  padding: '0 13px',
  font: 'inherit',
  fontSize: '13px',
};

const dateChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '34px',
  padding: '0 13px',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--color-text-muted)',
  background: 'var(--color-surface)',
  fontSize: '13px',
  whiteSpace: 'nowrap',
};

const resetStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
};











const paginationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 'var(--space-7)',
  color: 'var(--color-text-muted)',
  fontSize: '13px',
};

const pagerButtonStyle: React.CSSProperties = {
  ...buttonStyle('secondary', 'row-action'),
  width: '34px',
  padding: 0,
};

const activePageStyle: React.CSSProperties = {
  display: 'inline-flex',
  width: '34px',
  height: '34px',
  borderRadius: 'var(--radius-control)',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-ink)',
  color: 'var(--color-surface)',
  fontWeight: 800,
};

/**
 * Fetches the ACTIVE RESULT SET for export - every record under the current search and filters.
 *
 * `UX-044.a` - the operator exports what they are looking at, which is the FILTERED SET and not
 * the page. `UX-044.b` - pagination never defines export scope.
 *
 * It pages through the existing list endpoint rather than adding an unbounded one: a request for
 * "everything" with no ceiling is how an export becomes an outage. The page size here is an
 * export-transport detail and has nothing to do with the five rows the workspace displays.
 */
async function collectActiveResultSet(
  filters: ChannelOrderFilters,
  expected: number,
): Promise<readonly ChannelOrderRow[]> {
  const TRANSPORT_PAGE = 200;
  const MAX_PAGES = 200;
  const collected: ChannelOrderRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await listChannelOrders(filters, page, TRANSPORT_PAGE);
    collected.push(...result.content);
    if (collected.length >= result.totalElements || result.content.length === 0) {
      break;
    }
  }
  /*
    A partial export is reported, never written. `SYS-073` and `RPT-047` require partial success to
    be reported per record and never hidden inside an aggregate - and a CSV that is quietly short
    is the purest form of that failure, because it looks complete.
  */
  if (expected > 0 && collected.length < expected) {
    throw new Error(
      `The export read ${collected.length} of ${expected} orders and was stopped rather than `
      + 'written incomplete. Narrow the filter and try again.',
    );
  }
  return collected;
}

/**
 * Hands the CSV to the browser.
 *
 * The BOM is deliberate: without it Excel opens UTF-8 as the local codepage, and every Bangla
 * customer name and every taka sign in the file turns to mojibake on the operator's machine.
 */
function download(csv: string, filename: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * `UX-044.c` - an all-records export is a DELIBERATE choice, never a silent default. The label
 * says which one is about to happen, so the operator is not told after the fact by a filename.
 */
function exportLabel(selectedCount: number): string {
  return selectedCount > 0 ? `Export ${selectedCount}` : 'Export all';
}

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexShrink: 0,
};

const blockedReasonStyle: React.CSSProperties = {
  margin: '0 0 var(--space-6)',
  fontSize: '12px',
  lineHeight: 1.6,
  color: 'var(--color-text-muted)',
};

const selectAllRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  minWidth: 0,
};

const selectAllLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const selectionCountStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  whiteSpace: 'nowrap',
};

const clearSelectionStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-link)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
