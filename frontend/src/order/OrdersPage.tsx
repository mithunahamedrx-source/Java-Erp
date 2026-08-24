import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, EmptyState, SegmentedControl, Select, buttonStyle, srOnly } from '../ui/primitives';
import OrderCard from './OrderCard';
import { ApiError } from '../platform/api';
import { fetchChannelOrderSummary, listChannelOrders } from './orderApi';
import type { ChannelOrderFilters, ChannelOrderRow, ChannelOrderSummary } from './orderApi';
import { ORDER_STATUS_TABS, displayMoney, displayStatus } from './orderView';
import { buildOrderCsv, orderCsvFilename } from './orderCsv';
import { ORDER_LIFECYCLE_ROLE, semanticRoleOf } from '../design/semanticRole';

/**
 * FRAME 01 — Orders workspace.
 *
 * <p>🔴 BUILT FROM THE `Order Module` PROTOTYPE. The approved capture fixes a card-list
 * workspace, not a table (`OSC-030`, and `RULE 3.15` records the traditional data table as
 * `NOT USED`). Composition, geometry and order of controls are transcribed from the prototype;
 * every FIGURE comes from the server, and a figure the server does not hold renders as the word
 * (`ORDER_MODULE_PAGE_CONTRACT.md` §7.1 — *"I will keep your composition and discard your
 * figures"*).
 */

/**
 * The sentinel for "no filter on this dimension".
 *
 * ⚠ `SegmentedControl` holds one selected value and an empty string is a legitimate search
 * term elsewhere, so the unfiltered option carries an explicit name rather than `''`. It never
 * reaches the API: it is translated to `undefined` before the request is built.
 */
const ALL = '__ALL__';

/**
 * The page sizes the prototype's terminal region offers.
 *
 * <p>🔴 THIS IS NOT A VIEWPORT RESPONSE AND NEVER BECOMES ONE (`RULE 7.3.a`, `UX-266`). The size
 * changes only when an operator picks one, and nothing here reads the window. Five remains the
 * default the product owner fixed (`OSC-058.c`), and five is five at 80%, 100% and 110% zoom.
 */
const PAGE_SIZES: readonly number[] = [5, 25, 50, 100];

export default function OrdersPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [items, setItems] = useState<readonly ChannelOrderRow[]>([]);
  const [summary, setSummary] = useState<ChannelOrderSummary | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<ChannelOrderFilters>({});
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(5);
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
    The folding bulk region, and the transient line the workspace speaks through. The prototype
    opens the region on the first selection and closes it on Reset; both are reproduced below.
  */
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState('');
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
    THE SELECTION IS CLEARED BY A FILTER, A TAB OR A SEARCH — AND NOT BY PAGING.
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
    if (next) {
      setBulkOpen(true);
    }
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
    if (next) {
      setBulkOpen(true);
    }
  }, [items]);

  /*
    EXPORT SCOPE IS RESOLVED HERE, AND NEVER FROM THE VISIBLE PAGE (`UX-044.b`).
    A selection exports exactly what was ticked. NO selection exports the ACTIVE RESULT SET under
    the current search and filters (`UX-044.a`) — which means fetching every matching record, not
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

  /*
    The search applies as the operator types, after a short pause.

    ⚠ The superseded implementation applied ONLY on Enter, with no button and no other
    affordance, so the field read as dead — it was reported as "not working". Enter still
    applies immediately through the form's submit; this simply stops the field from looking
    inert when nobody presses it.

    🔴 This is an input debounce and nothing else. It changes no page size, no record count and
    no permission (`RULE 7.3.a`), and it reads no viewport (`UX-266`).
  */
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

  const onlySelectedId = selected.size === 1 ? [...selected.keys()][0] : undefined;

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="All channels · operational workspace"
        actions={
          /*
            `UX-016` / `UX-045` — these act on the SURFACE, not on one record, so they belong in
            the page-header action region. `RULE 3.11` — EXACTLY ONE PRIMARY, and the dark button
            is rightmost. `RULE 3.11.d` fixes the compact page-header geometry, which
            `buttonStyle('…', 'header')` already carries. `UX-045.f` — the icons never replace the
            visible label, and the prototype draws all three.
          */
          <div style={headerActionsStyle}>
            <Button
              variant="secondary"
              size="page-header"
              onClick={() => void exportCsv()}
              disabled={exporting || loading || forbidden}
              testId="orders-export"
            >
              <DownloadIcon />
              {exporting ? 'Exporting…' : exportLabel(selected.size)}
            </Button>

            {/*
              UNBLOCKED 2026-08-24. `OSC-058.b` refused this because `PRN-023` sources the Sales
              Invoice printable from an `E-039` record whose content `INV-39.2` requires
              snapshotted, and none existed. `V22` creates it, `SalesInvoiceService` fills it and
              `InvoicePage` renders it.

              It opens ONE selected order's invoice. `PRM-025` requires each record authorised
              individually with per-record results (`SYS-073`), and `GAP-034` still records no
              permitted-bulk-transition inventory — so `Print invoices` in bulk stays unbuilt.
            */}
            <Button
              variant="secondary"
              size="page-header"
              disabled={!onlySelectedId}
              describedBy={onlySelectedId ? undefined : 'orders-print-reason'}
              testId="orders-print"
              onClick={() => {
                if (onlySelectedId) {
                  navigate(`/sales/orders/${onlySelectedId}/invoice`, { state: { from: 'list' } });
                }
              }}
            >
              <PrinterIcon />
              Print
            </Button>

            {/*
              UNBLOCKED 2026-08-24. `OSC-058.a` refused this because no Order-mutation capability
              was ratified; `PRM-093` now ratifies `order.order.create`.

              🔴 IT NAVIGATES TO A PAGE, NOT A MODAL. `UX-151` — a workflow needing more than a
              bounded decision gets a PAGE — and capturing a customer, an address and any number of
              priced lines is not a bounded decision.
            */}
            <Button
              variant="primary"
              size="page-header"
              onClick={() => navigate('/sales/orders/new')}
              testId="orders-create"
            >
              <PlusIcon />
              Create Order
            </Button>
          </div>
        }
      />

      {/*
        🔴 THE REASONS ARE OFF THE LAYOUT AND STILL IN THE ACCESSIBILITY TREE (product owner,
        2026-08-25). The prototype draws no explanatory block here, and a standing paragraph of
        rule citations above the workspace is chrome an operator reads once and then scrolls past
        forever.

        ⚠ THEY ARE NOT DELETED, AND THE DISTINCTION IS THE WHOLE POINT. `Button.describedBy`
        resolves to these ids, so a screen-reader user who lands on the disabled `Print` still
        hears why. `srOnly` keeps the node rendered and exposed — unlike `display: none`, and
        unlike a `title`, which is unreachable by keyboard and invisible on touch.

        ✅ THE REASON IS ALSO EVIDENT WITHOUT THEM. `Print` enables the moment exactly one order
        is ticked, and the bulk region states the per-record rule in visible words where an
        operator meets it. Nothing here is the ONLY carrier of its meaning.
      */}
      <p style={srOnly}>
        <span id="orders-print-reason">
          <strong>Print</strong> opens the invoice for <strong>one</strong> selected order.
          Bulk printing stays unavailable: <code>PRM-025</code> requires each record authorised
          individually and <code>GAP-034</code> records no permitted bulk-action inventory.
        </span>{' '}
        <span id="orders-create-reason">
          <strong>Create Order</strong> captures a direct-channel order. It is created in
          <strong> Pending verification</strong> — the same state an imported order arrives in —
          and creating it does not confirm it (<code>PRM-093</code>).
        </span>
      </p>

      <SummaryStrip summary={summary} loading={loading} unavailable={forbidden || error !== null} />

      {/*
        🔴 `RULE 3.13` — the status tabs ARE the canonical segmented control, and `RULE 5.2`
        requires it to be REUSED rather than re-cut. The prototype draws them in the padded
        container variant with raised counts; that is a `variant` on the one component, not a
        second control copied beside it.

        🔴 `UX-266` names tabs explicitly among the structural UI that DOES NOT WRAP, and
        `UX-265` forbids `overflow-x: auto` as the escape.
      */}
      <div className="operational-row" style={statusRowStyle}>
        <span style={filterLabelStyle}>STATUS</span>
        <SegmentedControl
          variant="tabs"
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
          ⚠ THE SEARCH SITS FIRST AND IS DELIBERATELY FIXED-WIDTH. A flexible field swallowed every
          pixel the other controls did not claim, which is what pushed the period filter out of
          reach. 🔴 `flexShrink: 0` keeps it from being squeezed instead, because `UX-266` forbids
          the row solving width pressure by reshaping itself.
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
          🔴 THE CHANNEL OPTIONS COME FROM THE SERVER, NOT FROM A LIST IN THE BROWSER. A fixed list
          here would be a second register of a set `SYS-108` owns, offering filters that can only
          ever return nothing.

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

          ⚠ A SELECT, not a segmented control, and deliberately — the prototype draws it as one
          too. `RULE 3.13` gives the segmented control to status, channel and period — three
          CLOSED sets. Shops are an OPEN set, and seven segments would break `UX-266`'s no-wrap
          contract on this row.
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
          exact defect `GAP-004` recorded.

          🔴 `Day` · `Month` · `Year` are CALENDAR boundaries in `Asia/Dhaka` (`TEC-050`,
          `TEC-052`). ⚠ No rolling window is offered: no rolling-period concept exists anywhere
          in the corpus, so `last 30 days` would be inventing what `Month` means.
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
        <button
          type="button"
          onClick={() => setBulkOpen((open) => !open)}
          aria-expanded={bulkOpen}
          style={moreButtonStyle(bulkOpen)}
          data-testid="orders-bulk-toggle"
        >
          More
          <Caret open={bulkOpen} />
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchDraft('');
            setFilters({});
            setPage(0);
            setBulkOpen(false);
            setNotice('');
          }}
          style={resetStyle}
        >
          Reset
        </button>
        <div style={{ flex: 1, minWidth: 'var(--space-3)' }} />
      </div>

      {bulkOpen ? (
        <BulkRegion
          selectedCount={selected.size}
          onlySelectedId={onlySelectedId}
          exporting={exporting}
          onExport={() => void exportCsv()}
          onPrint={() => onlySelectedId && navigate(`/sales/orders/${onlySelectedId}/invoice`, { state: { from: 'list' } })}
          onClear={() => {
            setSelected(new Map());
            setNotice('');
          }}
        />
      ) : null}

      {notice ? (
        <div style={noticeStyle} data-testid="orders-notice">
          <span style={noticeDotStyle} aria-hidden="true" />
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', flex: 1 }}>{notice}</span>
          <button type="button" style={dismissStyle} onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      ) : null}

      {loading ? (
        <OrdersSurface>
          <EmptyState title="Loading orders…" guidance="Fetching channel orders already imported into Trioloo." />
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
        <>
          {/*
            The select-all lives WITH the list it acts on, not in the page header. `UX-045.c` and
            `UX-016` keep record-scoped controls out of page-level positions.
          */}
          <div className="operational-row" style={selectAllRowStyle}>
            <label style={selectAllLabelStyle}>
              <input
                type="checkbox"
                checked={pageAllSelected}
                onChange={(event) => togglePage(event.target.checked)}
                style={{ width: '16px', height: '16px', margin: 0, accentColor: 'var(--color-ink)', cursor: 'pointer' }}
                data-testid="orders-select-page"
              />
              Select all on this page
            </label>
            {selected.size > 0 ? (
              /*
                The count states the WHOLE selection, which may span pages the operator is no
                longer looking at. Showing only the ticks visible here would understate what
                Export is about to write.
              */
              <span style={selectionCountStyle} data-testid="orders-selection-count">
                {selected.size} selected
              </span>
            ) : null}
          </div>
          <div style={orderListStyle}>
            {items.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                selected={selected.has(order.id)}
                onSelectedChange={(next) => setSelectedFor(order, next)}
              />
            ))}
          </div>
        </>
      )}

      {/*
        `§3.16` — count left, controls right, sitting on the page background rather than in a card.
        🔴 Nothing here reads the viewport (`RULE 7.3.a`).
      */}
      <div style={paginationStyle}>
        <span>
          Showing {totalElements === 0 ? '0' : `${page * size + 1}–${Math.min((page + 1) * size, totalElements)}`} of {totalElements} orders
          {summary ? ` · ${summary.totalItems} item${summary.totalItems === 1 ? '' : 's'}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ width: '128px' }}>
            <Select
              value={String(size)}
              onChange={(next) => {
                setPage(0);
                setSize(Number(next));
              }}
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={String(option)}>
                  {option} per page
                </option>
              ))}
            </Select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {/* A button whose accessible name is "‹" tells a screen-reader user nothing. */}
            <button type="button" aria-label="Previous page" disabled={page === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))} style={pagerButtonStyle}>
              ‹
            </button>
            {pageWindow(page, totalPages).map((index) => (
              <button
                key={index}
                type="button"
                aria-label={`Page ${index + 1}`}
                aria-current={index === page ? 'page' : undefined}
                onClick={() => setPage(index)}
                style={index === page ? activePageStyle : pagerButtonStyle}
              >
                {index + 1}
              </button>
            ))}
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
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function OrdersSurface({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  // The same separation the card list gets, so an empty workspace does not sit tighter than a
  // full one and the page does not shift when the first order arrives.
  return <section style={{ ...ordersSurfaceStyle, marginTop: 'var(--space-7)' }}>{children}</section>;
}

/**
 * The folding bulk region — the prototype's `More` panel.
 *
 * <p>🔴 TWO ACTIONS ARE OFFERED AND FOUR ARE DIMMED, AND THE DIVIDE IS NOT COSMETIC.
 * `Export selected` and `Clear selection` act entirely inside this browser on records already
 * fetched, so they need no permitted-action inventory. `Print invoices`, `Send to Steadfast`,
 * `Place hold` and `Cancel orders` each ACT ON A RECORD, and `GAP-034` — carried as
 * `ORDER_MODULE_ROADMAP.md`'s open question 4, naming `Send to Steadfast` and `Print invoices`
 * by name — records that no inventory of permitted bulk transitions exists. `PRM-025` requires
 * every record authorised on its own.
 *
 * <p>⚠ `Print invoices` IS OFFERED FOR EXACTLY ONE SELECTED ORDER and dimmed for a set, which is
 * the same rule the page-header `Print` follows and the reason `OSC-058.b` gives.
 *
 * <p>✅ THE EXPLANATORY LINE IS THE PROTOTYPE'S OWN, VERBATIM. It already states the per-record
 * rule the dimming enforces.
 */
function BulkRegion({
  selectedCount,
  onlySelectedId,
  exporting,
  onExport,
  onPrint,
  onClear,
}: {
  readonly selectedCount: number;
  readonly onlySelectedId: string | undefined;
  readonly exporting: boolean;
  readonly onExport: () => void;
  readonly onPrint: () => void;
  readonly onClear: () => void;
}): React.JSX.Element {
  const none = selectedCount === 0;
  return (
    <div style={bulkPanelStyle} data-testid="orders-bulk-region">
      <div className="operational-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span style={{ ...filterLabelStyle, letterSpacing: '0.04em' }}>BULK ACTIONS</span>
        <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {none ? 'No order selected' : `${selectedCount} order${selectedCount === 1 ? '' : 's'} selected`}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <BulkButton label="Export selected" disabled={none || exporting} onClick={onExport} />
          <BulkButton
            label="Print invoices"
            disabled={!onlySelectedId}
            onClick={onPrint}
            title="Opens the invoice for one selected order. PRM-025 requires each record authorised individually and GAP-034 records no permitted bulk-action inventory."
          />
          <BulkButton
            label="Send to Steadfast"
            disabled
            title="Courier booking is ORDER_MODULE_ROADMAP Phase 2 and is not built. GAP-034 records no permitted bulk-action inventory."
          />
          <BulkButton
            label="Place hold"
            disabled
            title="No hold endpoint exists, and GAP-034 records no permitted bulk-action inventory."
          />
          <BulkButton
            label="Cancel orders"
            disabled
            destructive
            title="No cancellation endpoint exists. PRM-025 requires per-record authority before a set may be acted on."
          />
          <BulkButton label="Clear selection" disabled={none} onClick={onClear} />
        </div>
      </div>
      <p style={bulkNoteStyle}>
        Each selected order is authorised on its own, so an action may apply to some records and be
        refused on others. The result is reported per order, and the activity log records one entry
        per order rather than one for the batch.
      </p>
    </div>
  );
}

function BulkButton({
  label,
  disabled,
  destructive,
  onClick,
  title,
}: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly onClick?: () => void;
  readonly title?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        ...bulkButtonStyle,
        color: disabled
          ? 'var(--color-placeholder)'
          : destructive
            ? 'var(--color-destructive)'
            : 'var(--color-secondary-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/**
 * The four summary figures, ratified by the product owner (`OSC-053`).
 *
 * <p>🔴 Each figure is server-computed and rendered as received (`TEC-095`). Nothing here adds,
 * subtracts or rounds, and `Total collectable` never passes through a `Number` (`OSC-043`).
 *
 * <p>🔴 A figure the server could not supply renders as an explicit absence, never as `0`
 * (`OSC-045`, `SYS-034`, `BR-134`) — a real zero and an unavailable figure must not look alike.
 *
 * <p>⚠ THE ICON TILES TAKE RATIFIED SEMANTIC TOKENS, NOT THE PROTOTYPE'S LITERALS. The prototype
 * tints each tile with an alpha of a hue it states inline (`oklch(0.5 0.16 250 / 0.12)` and
 * friends); `RULE 15.1` forbids hard-coding a colour or eye-matching a substitute, and the
 * `--color-semantic-*` pairs already hold the same hues as ratified soft tint and foreground.
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
      <SummaryCard
        label="TOTAL ORDERS"
        value={figure(summary?.totalOrders)}
        note="All channels, all time"
        tint="var(--color-divider-light)"
        icon={<OrdersIcon />}
      />
      <SummaryCard
        label="TODAY'S ORDERS"
        value={figure(summary?.todaysOrders)}
        note="Placed today · Asia/Dhaka"
        tint="var(--color-semantic-info-bg)"
        icon={<CalendarIcon />}
      />
      <SummaryCard
        label="TODAY'S DISPATCHED"
        value={figure(summary?.todaysDispatched)}
        note="First observed dispatched today"
        tint="var(--color-semantic-warning-bg)"
        icon={<TruckIcon />}
      />
      <SummaryCard
        label="TOTAL COLLECTABLE"
        value={
          loading
            ? '—'
            : unavailable
              ? 'Not available'
              : (displayMoney(summary?.totalCollectable ?? null) ?? 'Not available')
        }
        note="Delivered, not yet received"
        tint="var(--color-semantic-success-bg)"
        icon={<CardIcon />}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tint,
  icon,
}: {
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly tint: string;
  readonly icon: React.ReactNode;
}): React.JSX.Element {
  return (
    <article style={summaryCardStyle}>
      <span style={{ ...summaryIconStyle, background: tint }} aria-hidden="true">
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={summaryLabelStyle}>{label}</div>
        <div className="tabular-nums" style={summaryValueStyle}>
          {value}
        </div>
        <div style={summaryNoteStyle}>{note}</div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------- icons */

function DownloadIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 4v10" /><path d="M8 11l4 4 4-4" /><path d="M5 19h14" />
    </svg>
  );
}

function PrinterIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9V4h12v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 16h10v4H7z" />
    </svg>
  );
}

function PlusIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

function Caret({ open }: { readonly open: boolean }): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"
         style={{ transform: open ? 'rotate(180deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function OrdersIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8" /><path d="M8 13h5" />
    </svg>
  );
}

function CalendarIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-semantic-info-fg)"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 10h16" />
    </svg>
  );
}

function TruckIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-semantic-warning-fg)"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="2" y="7" width="12" height="9" rx="1.5" /><path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.4" /><circle cx="17" cy="18" r="1.4" />
    </svg>
  );
}

function CardIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-semantic-success-fg)"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ styles */

const orderListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--space-5)',
  marginTop: 'var(--space-5)',
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
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--elevation-card)',
  minHeight: '82px',
  padding: 'var(--space-4) var(--space-5)',
  display: 'flex',
  gap: 'var(--space-4)',
  alignItems: 'flex-start',
  minWidth: 0,
};

const summaryIconStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: 'var(--radius-control-small)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: '10.5px',
  color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: '2px',
  fontSize: '19px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: '24px',
  color: 'var(--color-heading-ink)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryNoteStyle: React.CSSProperties = {
  fontSize: '10.5px',
  color: 'var(--color-text-demoted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/*
  One control row shape, used by BOTH the status row and the filter row.

  🔴 `UX-266` names tabs and filter/control rows among the structural UI that does not wrap, and
  `.operational-row` carries the `flex-wrap: nowrap !important` safety net that `RULE 7.4` and
  `UX-060` already established. 🔴 No `overflow-x` is declared — `UX-265` forbids it as a
  responsive solution.
*/
const controlRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-5)',
  minWidth: 0,
};

const statusRowStyle: React.CSSProperties = {
  ...controlRowStyle,
  marginTop: 'var(--space-7)',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  color: 'var(--color-text-muted)',
  flexShrink: 0,
};

/* `RULE 3.18` — the approved search input geometry: `34px` / `9px` radius / `13px` text. */
const searchStyle: React.CSSProperties = {
  width: '280px',
  height: 'var(--control-height-form)',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  padding: '0 var(--space-4)',
  font: 'inherit',
  fontSize: '13px',
};

function moreButtonStyle(open: boolean): React.CSSProperties {
  return {
    height: 'var(--control-height-form)',
    padding: '0 11px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid var(--color-border-secondary-button)',
    background: open ? 'var(--color-secondary-hover)' : 'var(--color-surface)',
    color: open ? 'var(--color-ink)' : 'var(--color-secondary-text)',
    font: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    cursor: 'pointer',
    flexShrink: 0,
  };
}

const resetStyle: React.CSSProperties = {
  height: 'var(--control-height-form)',
  padding: '0 var(--space-2)',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
  flexShrink: 0,
};

const bulkPanelStyle: React.CSSProperties = {
  padding: 'var(--space-5) var(--space-6)',
  marginTop: 'var(--space-5)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--elevation-card)',
};

const bulkButtonStyle: React.CSSProperties = {
  height: 'var(--control-height-row-action)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-secondary-button)',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const bulkNoteStyle: React.CSSProperties = {
  margin: 'var(--space-3) 0 0',
  fontSize: '12px',
  lineHeight: 1.55,
  color: 'var(--color-text-demoted)',
};

const noticeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: '11px var(--space-6)',
  marginTop: 'var(--space-5)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--elevation-card)',
};

const noticeDotStyle: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: 'var(--color-ink)',
  flexShrink: 0,
};

const dismissStyle: React.CSSProperties = {
  height: '28px',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-control-small)',
  border: '1px solid var(--color-border-control)',
  background: 'var(--color-surface)',
  color: 'var(--color-nav-label)',
  font: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
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
  width: '32px',
  height: '32px',
  padding: 0,
  border: '1px solid var(--color-border-control)',
};

const activePageStyle: React.CSSProperties = {
  display: 'inline-flex',
  width: '32px',
  height: '32px',
  borderRadius: 'var(--radius-control)',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'var(--color-ink)',
  color: 'var(--color-surface)',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexShrink: 0,
};

const selectAllRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  marginTop: 'var(--space-5)',
  minWidth: 0,
};

const selectAllLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontSize: '13px',
  color: 'var(--color-nav-label)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const selectionCountStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  whiteSpace: 'nowrap',
};

/* ----------------------------------------------------------------- helpers */

/**
 * The page numbers the pager draws — the prototype shows three.
 *
 * <p>⚠ It shows REAL page numbers and never a fixed `1 2 3`. A pager that always drew three
 * buttons would offer page 3 of a one-page result set.
 */
function pageWindow(page: number, totalPages: number): readonly number[] {
  if (totalPages <= 0) {
    return [0];
  }
  const start = Math.max(0, Math.min(page - 1, totalPages - 3));
  const window: number[] = [];
  for (let index = start; index < Math.min(start + 3, totalPages); index++) {
    window.push(index);
  }
  return window;
}

/**
 * Fetches the ACTIVE RESULT SET for export — every record under the current search and filters.
 *
 * `UX-044.a` — the operator exports what they are looking at, which is the FILTERED SET and not
 * the page. `UX-044.b` — pagination never defines export scope.
 *
 * It pages through the existing list endpoint rather than adding an unbounded one: a request for
 * "everything" with no ceiling is how an export becomes an outage.
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
    be reported per record and never hidden inside an aggregate — and a CSV that is quietly short
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
 * `UX-044.c` — an all-records export is a DELIBERATE choice, never a silent default. The label
 * says which one is about to happen, so the operator is not told after the fact by a filename.
 */
function exportLabel(selectedCount: number): string {
  return selectedCount > 0 ? `Export ${selectedCount}` : 'Export all';
}
