import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../platform/api';
import { useAuth } from '../auth/AuthContext';
import { usePageActions } from '../shell/PageActions';
import { ACTION_ICON, ACTION_ICON_SIZE, ACTION_ICON_STROKE } from '../shell/icons';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';
import { ChannelListingCard, ChannelListingListHeader, ChannelListingSummaryStrip } from './ChannelListingCard';
import { MappingModal } from './MappingModal';
import { PushReviewModal } from './PushReviewModal';
import { ListingRefreshState, useListingRefresh } from './ListingRefreshState';
import { ChannelListingSkeleton, ListingsBanner, ListingsNotice } from './ChannelListingStates';
import type { MenuAction } from '../ui/Overlay';
import { formatMoment } from '../platform/datetime';
import {
  channelListingExportUrl,
  fetchChannelListingSummary,
  fetchChannels,
  fetchSelectionScope,
  listChannelListings,
  requestOperation,
} from './channelListingApi';
import type {
  ChannelListing,
  ChannelListingFilters,
  ChannelListingSummary,
  ChannelSelectionCount,
  ChannelView,
  OperationKind,
} from './channelListingApi';

/**
 * ⚠ DEVELOPMENT ONLY. `import.meta.env.DEV` is statically false in a production build, so
 * every branch guarded by it — and this table — is removed by the bundler.
 *
 * <p>🔴 It exists so a reviewer can SEE each Frame 03 condition without mutating dev business
 * data. It selects an already-implemented panel and what the filter controls display. It
 * changes no request, no persistence and no business rule, and it is reachable only by typing
 * the parameter: there is no production control, link or navigation for it anywhere.
 */
type DevState =
  | 'loading'
  | 'error'
  | 'empty'
  | 'noActiveDiscovery'
  | 'noUnmapped'
  /**
   * ⚠ Shrinks the page so more matching Listings exist than one page shows, which is what
   * makes the Frame 04 all-matching progression reachable on a small dev fixture. The
   * selection it produces is entirely REAL — only the page size is reduced.
   */
  | 'smallPage';

/** Which Frame 03 empty condition applies. */
type EmptyReason = 'none-yet' | 'no-unmapped' | 'channel-none' | 'filtered';

/**
 * The connected Listings workspace.
 *
 * 🔴 `TEC-096` / `PRD-174.b` — search, every filter, sorting, counting and "select all
 * matching" are resolved by the SERVER. The browser never filters or counts a 3000+ corpus.
 *
 * 🔴 UNMAPPED is a FILTER and a STATE, never a fourth tab. The Products workspace carries
 * exactly three entity-class tabs.
 */
export default function ChannelListingsPage(): React.JSX.Element {
  const { session } = useAuth();
  const navigate = useNavigate();
  const ExportIcon = ACTION_ICON.export;
  const ImportIcon = ACTION_ICON.import;
  const SyncNowIcon = ACTION_ICON.syncNow;
  const AddIcon = ACTION_ICON.add;
  const SearchIcon = ACTION_ICON.search;
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayManage = permissions.includes('product.channel-listing.manage');
  // 🔴 `PRD-196.a` — MANAGE NEVER IMPLIES PUBLISH. These are read independently, and the
  // backend enforces both regardless: frontend hiding is not authorization.
  const mayPublish = permissions.includes('product.channel-listing.publish');
  const maySync = permissions.includes('product.channel-listing.sync');

  const [filters, setFilters] = useState<ChannelListingFilters>({});
  const [searchDraft, setSearchDraft] = useState('');
  const [items, setItems] = useState<readonly ChannelListing[]>([]);
  const [summary, setSummary] = useState<ChannelListingSummary | null>(null);
  const [channels, setChannels] = useState<readonly ChannelView[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  /**
   * 🔴 Frame 04 — TWO DIFFERENT SCOPES, and the operator always knows which one is active.
   *
   * `page` is exactly the rows ticked on the visible page. `all-matching` is the CURRENT
   * FILTER SNAPSHOT evaluated on the server; it is held as a filter definition plus a count,
   * never as thousands of rows in the browser. Ticking the header checkbox NEVER promotes
   * one into the other — that is always a separate, explicit action.
   */
  const [scope, setScope] = useState<'page' | 'all-matching'>('page');
  const [matchingChannels, setMatchingChannels] = useState<readonly ChannelSelectionCount[]>([]);
  /** The filters the all-matching selection was captured against. */
  const [scopeSnapshot, setScopeSnapshot] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  /**
   * 🔴 Frame 03 §11 — TWO DIFFERENT FAILURES, never collapsed into one.
   *
   * `loadError` means the workspace query itself failed, so there is no list to show.
   * `operationError` means an action failed while the list is intact — it becomes a BANNER
   * above the list and the already-loaded Listings stay visible. A remote failure must never
   * blank out local canonical data.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The unfiltered corpus size, so the filtered-empty state can say how many DO exist. */
  const [totalAll, setTotalAll] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  /**
   * Which listing the Mapping modal is resolving, if any.
   *
   * ⚠ Held as the LISTING, not an id: the modal needs its orderable SKUs, and re-deriving them
   * would mean another read for data already on screen.
   */
  const [mappingFor, setMappingFor] = useState<ChannelListing | null>(null);
  /** 🔴 Frame 15 targets exactly ONE listing. There is no batch review and no fan-out. */
  const [pushReviewFor, setPushReviewFor] = useState<string | null>(null);
  /**
   * 🔴 Frame 16 — ONE Listing's inbound refresh, reported where that Listing is.
   *
   * ⚠ Frame 20 owns Sync Now; the batch path below is untouched by this.
   */
  const refresh = useListingRefresh();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setForbidden(false);
    try {
      const [pageResult, summaryResult] = await Promise.all([
        listChannelListings(filters, page, size),
        fetchChannelListingSummary(filters),
      ]);
      setItems(pageResult.content);
      setTotalPages(pageResult.totalPages);
      setTotalElements(pageResult.totalElements);
      setSummary(summaryResult);
    } catch (cause) {
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        setLoadError(cause instanceof Error ? cause.message : 'Listings could not be loaded.');
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

  useEffect(() => {
    fetchChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
    // 🔴 Frame 03 EMPTY 2 states how many Listings DO exist. That is the UNFILTERED count,
    // so it is fetched once rather than derived from the filtered page.
    fetchChannelListingSummary({})
      .then((all) => setTotalAll(all.totalListings))
      .catch(() => setTotalAll(null));
  }, []);

  /**
   * ⚠ DEVELOPMENT ONLY. `import.meta.env.DEV` is statically false in a production build, so
   * this branch and its query parameter are stripped entirely by the bundler.
   *
   * <p>It exists because two Frame 03 states cannot be reproduced from real data by clicking:
   * a slow response, and a failed workspace query. Everything else is reachable through
   * ordinary filters. It changes presentation ONLY and never touches a request or a rule.
   */
  // ⚠ DEV only: reduce the page size so the wider-scope control has something to offer.
  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('__devState') === 'smallPage') {
      setSize(2);
    }
  }, []);

  const devState = import.meta.env.DEV
    ? (new URLSearchParams(window.location.search).get('__devState') as DevState | null)
    : null;

  /**
   * 🔴 The dev override is PRESENTATION ONLY. It never touches `filters`, so every request
   * the page makes is exactly the request it would make without it — same URL, same
   * server-side filtering, same persistence. It only decides which already-implemented
   * panel is shown, and what the filter controls DISPLAY so the reason is legible.
   */
  const devEmptyReason: EmptyReason | null = !import.meta.env.DEV
    ? null
    : devState === 'empty'
      ? 'none-yet'
      : devState === 'noActiveDiscovery'
        ? 'channel-none'
        : devState === 'noUnmapped'
          ? 'no-unmapped'
          : null;

  /** What the filter controls should DISPLAY. Real filters win; the override only fills in. */
  const shownMapping = devState === 'noUnmapped' ? 'false' : filters.mapped === undefined ? '' : String(filters.mapped);
  const shownChannel = devState === 'noActiveDiscovery' ? (channels[0]?.code ?? '') : filters.channelInstance ?? '';

  const applyFilter = (patch: Partial<ChannelListingFilters>): void => {
    setPage(0);
    // 🔴 Frame 04 — a filter change INVALIDATES the selection. An all-matching selection is
    // a claim about one filter set; silently carrying it into a different result set would
    // let the operator act on Listings they never saw or chose.
    clearSelection();
    setFilters((current) => ({ ...current, ...patch }));
  };

  const clearSelection = (): void => {
    setSelected([]);
    setScope('page');
    setMatchingChannels([]);
    setScopeSnapshot(null);
    setNotice(null);
  };

  const toggleSelect = (id: string, isSelected: boolean): void => {
    // ⚠ Touching one row drops back to page scope: the all-matching claim is no longer true.
    setScope('page');
    setScopeSnapshot(null);
    setMatchingChannels([]);
    setSelected((current) =>
      isSelected ? [...current, id] : current.filter((candidate) => candidate !== id),
    );
  };

  /**
   * 🔴 `UX-044` — "select all matching" is resolved SERVER-SIDE against the same filter the
   * workspace is showing. The browser never enumerates the corpus to build a batch.
   */
  const selectAllMatching = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const resolved = await fetchSelectionScope(filters);
      setSelected(resolved.listingIds);
      // 🔴 The channel breakdown is kept because a batch may span shops, and the review step
      // must be able to say so. Nothing is ever fanned out to sibling shops (PRD-187.b).
      setMatchingChannels(resolved.byChannel);
      setScope('all-matching');
      setScopeSnapshot(JSON.stringify(filters));
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : 'The selection could not be resolved.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * 🔴 `INV-108.4` — the scope is exactly what is selected. A batch never expands itself to
   * sibling listings that happen to share a Sellable Product.
   */
  const runOperation = async (kind: OperationKind, only?: string): Promise<void> => {
    const targets = only ? [only] : selected;
    if (targets.length === 0) {
      return;
    }
    /*
      🔴 A last guard before anything leaves the browser: an all-matching selection is only
      valid for the filter set it was captured against. If the filters have moved since, the
      operator would be acting on a result set they never chose, so it is refused rather than
      sent.
    */
    if (!only && scope === 'all-matching' && scopeSnapshot !== JSON.stringify(filters)) {
      clearSelection();
      setOperationError(
        'The filters changed after this selection was made, so it no longer describes the same '
          + 'Listings. The selection has been cleared — reselect and try again.',
      );
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await requestOperation(kind, targets, `${kind} on ${targets.length} Listing${targets.length === 1 ? '' : 's'}`);
      navigate(`/inventory/products/listings/batches/${result.batchId}`);
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : 'The operation could not be requested.');
    } finally {
      setBusy(false);
    }
  };

  /*
   * ⚠ Discovery is NOT run from the workspace. Frame 01 carries the channel operation
   * CONTEXT only; the act itself belongs to Sync Now, reached from the locked page header.
   */

  /**
   * The LOCKED Listings page-header action region.
   *
   * <p>🔴 The labels are fixed business vocabulary: Export · Import · Sync Now · Add Listing.
   * "Sync" and "Create Listing" are NOT the approved labels and must not reappear.
   *
   * <p>🔴 Neutral actions stay white/subtle; the SINGLE primary business action is dark and
   * rightmost (`§3.8`). Icons are semantic and resolved from the one icon registry — the page
   * chooses no glyph of its own.
   *
   * <p>⚠ Placement belongs to the shell. This publishes what the surface can do and knows
   * nothing about where it renders (`UX-016.b`).
   */
  usePageActions(
    <>
      <a data-testid="listing-export-csv" href={channelListingExportUrl(filters)} style={headerSecondary}>
        <ExportIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
        Export
      </a>
      {mayManage && (
        <Link data-testid="listing-import-csv" to="/inventory/products/listings/import" style={headerSecondary}>
          <ImportIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
          Import
        </Link>
      )}
      {/*
        🔴 `PRD-196.a` — Sync Now reaches a channel, so it appears only for an operator who
        holds publish or sync authority. The backend refuses regardless.
      */}
      {(mayPublish || maySync) && (
        <Link data-testid="listing-sync-now" to="/inventory/products/listings/sync" style={headerSecondary}>
          <SyncNowIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
          Sync Now
        </Link>
      )}
      {mayManage && (
        <Link data-testid="create-channel-listing" to="/inventory/products/listings/new" style={headerPrimary}>
          <AddIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
          Add Listing
        </Link>
      )}
    </>,
    [mayManage, mayPublish, maySync, JSON.stringify(filters)],
  );

  /**
   * ⚠ `mapped: false` is a REAL filter — it means "at least one orderable SKU is unmapped"
   * (`PRD-178`). Only the two boolean toggles use false to mean "off", so they are the only
   * ones a false value may exclude. Counting `mapped: false` as inactive under-reported the
   * filter context that Frame 03 requires the operator to see.
   */
  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => {
        if (value === undefined || value === '') {
          return false;
        }
        if (key === 'divergedOnly' || key === 'unsentOnly') {
          return value === true;
        }
        return true;
      }).length,
    [filters],
  );
  const filtersActive = activeFilterCount > 0;

  /** Anyone who can act on a selection may build one. */
  const maySelect = mayManage || mayPublish || maySync;

  /**
   * Which Frame 03 empty state applies, when the result set is empty.
   *
   * <p>🔴 The four are genuinely different conditions and must never share one message.
   * "No Listings yet" is a statement about the ERP; the other three are statements about the
   * operator's current filter scope.
   */
  const emptyReason = useMemo<EmptyReason>(() => {
    if (!filtersActive && (totalAll ?? totalElements) === 0) {
      return 'none-yet';
    }
    // 🔴 mapped === false is exactly "at least one orderable SKU is unmapped" (PRD-178).
    if (filters.mapped === false) {
      return 'no-unmapped';
    }
    const channel = channels.find((c) => c.code === filters.channelInstance);
    if (channel && channel.knownListings === 0) {
      return 'channel-none';
    }
    return 'filtered';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersActive, totalAll, totalElements, filters.mapped, filters.channelInstance, channels]);

  const clearFilters = (): void => {
    setSearchDraft('');
    setPage(0);
    setSelected([]);
    setFilters({});
  };

  const selectedChannel = channels.find((c) => c.code === shownChannel);

  /** ⚠ The count the operator reads, including whatever the dev override is displaying. */
  const shownFilterCount = activeFilterCount + (devEmptyReason ? 1 : 0);

  /**
   * 🔴 Frame 04 "Select This Page" — the CURRENT PAGE ONLY. If the page shows 5 of 612
   * matching Listings, this selects 5.
   */
  const selectAllVisible = (allSelected: boolean): void => {
    setScope('page');
    setScopeSnapshot(null);
    setMatchingChannels([]);
    setSelected(allSelected ? items.map((item) => item.id) : []);
    setNotice(null);
  };

  /**
   * FRAME 05 — the row's own menu, composed against the operator's real authority.
   *
   * <p>🔴 THE TWO REFUSALS ARE DIFFERENT AND ARE PRESENTED DIFFERENTLY.
   *
   * <ul>
   *   <li>NO PERMISSION → the action is OMITTED, and a single note says why. A disabled
   *       control still advertises authority the operator does not have, and Frame 05 is
   *       explicit that no dead Push control is rendered anywhere.
   *   <li>PRECONDITION or CHANNEL CAPABILITY unmet → the action is DIMMED with a one-line
   *       reason, because its absence would simply be confusing. The operator HAS the
   *       authority; the listing or the channel is not ready.
   * </ul>
   *
   * <p>🔴 `PRD-196.a` — MANAGE NEVER IMPLIES PUBLISH. The backend refuses regardless; this
   * only decides what is honest to offer.
   */
  const rowMenu = (item: ChannelListing): { actions: MenuAction[]; note?: string } => {
    const actions: MenuAction[] = [];
    const detail = `/inventory/products/listings/${item.id}`;
    const diverged = item.syncState === 'DIVERGED';
    const unmapped = item.mappedSkuCount === 0;

    actions.push({ label: 'View', testId: 'menu-view', onSelect: () => navigate(detail) });

    // A diverged row's first question is always "what differs?", so the comparison leads.
    if (diverged) {
      actions.push({
        label: 'Compare intended vs reported',
        testId: 'menu-compare',
        emphasis: true,
        onSelect: () => navigate(detail),
      });
    }

    if (mayManage) {
      actions.push({ label: 'Edit', testId: 'menu-edit', emphasis: !diverged && !unmapped, onSelect: () => navigate(`${detail}/edit`) });
      /*
        🔴 MAPPING IS REACHABLE FROM THE WORKSPACE. An operator must never have to open the
        Listing merely to map it.

        ⚠ `INV-106.2` — mapping belongs to the ORDERABLE SKU. A multi-SKU listing therefore
        routes into the per-SKU workflow rather than pretending one listing-level choice can
        overwrite every SKU. Sibling SKUs are never auto-mapped.
      */
      actions.push({
        label: unmapped ? 'Map to Sellable Product' : 'Change Mapping',
        testId: unmapped ? 'menu-map' : 'menu-change-mapping',
        emphasis: unmapped,
        // 🔴 Opens Frame 12 IN PLACE. Mapping never costs the operator their filters, their
        //    page or their selection (§25) — leaving the workspace to map would.
        onSelect: () => setMappingFor(item),
      });
    }

    if (maySync) {
      // ⚠ CAPABILITY, not authority — the operator may sync, but there is nothing to read.
      const noRemote = item.externalListingId === null;
      const noAdapter = !item.adapterAvailable;
      actions.push({
        label: 'Refresh',
        testId: 'menu-refresh',
        separatorBefore: true,
        disabled: noRemote || noAdapter || item.adapterReadsListings === false,
        reason: noRemote
          ? 'This listing has not been published yet, so the channel has nothing to read back.'
          : noAdapter
            ? 'No marketplace adapter is configured for this channel.'
            // 🔴 The adapter EXISTS and declares it can read nothing — a different cause
            //    with a different remedy, so it is never worded as a missing adapter.
            : 'The marketplace adapter for this channel reports no readable Listing facts.',
        /*
          🔴 ONE LISTING, AND THE ROW STAYS IN PLACE. This is the single-Listing inbound read
          (`PRD-189.c`), reported inline beneath the row it concerns — not a redirect to the
          batch page, which describes a different act with a different scope.
        */
        onSelect: () => void refresh.run(item.id),
      });
    }

    if (mayPublish) {
      /*
        🔴 THIS OPENS THE REVIEW; IT DOES NOT PUSH. Frame 15 is the dedicated outbound
        boundary (`UX-271.c`), and an outbound act is reachable only after the operator has
        seen exactly what would be sent.

        🔴 IT IS DELIBERATELY NOT DIMMED FOR AN ABSENT ADAPTER OR AN UNMAPPED LISTING. Both
        remain true and both still prevent execution — but they are now PREFLIGHT findings
        inside the review, where the operator can read WHY, in which of the four dimensions,
        and what the listing would otherwise have sent. Dimming the entry point here would
        hide the explanation behind a one-line tooltip and leave the operator with no way to
        inspect a listing they cannot yet publish.
      */
      actions.push({
        label: item.externalListingId ? 'Review & Push' : 'Review & Publish',
        testId: 'menu-push',
        separatorBefore: !maySync,
        onSelect: () => setPushReviewFor(item.id),
      });
    }

    return {
      actions,
      // One note, stating the authority the role lacks — never a disabled control.
      note: !mayPublish ? 'Push is not available to your role.' : undefined,
    };
  };

  /**
   * Which row currently owns the Frame 16 inline state.
   *
   * ⚠ Held until dismissed, so a REFUSED or FAILED read — which has no result to read an id
   * from — still appears beside the row it concerns rather than nowhere at all.
   */
  const refreshTarget = refresh.targetId;

  const pageSelectedCount = items.filter((item) => selected.includes(item.id)).length;
  const allOnPageSelected = items.length > 0 && pageSelectedCount === items.length;
  /** More matching Listings exist than this page shows, so the wider scope is offerable. */
  const moreBeyondPage = totalElements > items.length;

  /**
   * The Frame's right-hand meta slot.
   *
   * <p>🔴 Truthful, and only ever about facts the system actually holds. There is no ratified
   * automatic sync schedule, so none is claimed (`UX-037.g`), and an absent adapter is stated
   * rather than hidden.
   */
  const channelContext = useMemo(() => {
    if (channels.length === 0) {
      return 'No Channel Instances registered';
    }
    const withoutAdapter = channels.filter((channel) => !channel.adapterAvailable);
    if (withoutAdapter.length === channels.length) {
      return `${channels.length} channel${channels.length === 1 ? '' : 's'} · no marketplace adapter configured`;
    }
    if (withoutAdapter.length > 0) {
      return `${channels.length} channels · ${withoutAdapter.length} without an adapter`;
    }
    return `${channels.length} channel${channels.length === 1 ? '' : 's'} connected`;
  }, [channels]);

  if (forbidden) {
    return (
      <Card>
        <EmptyState
          title="You do not have access to Listings"
          guidance="Viewing Listings requires a capability your account has not been granted. Ask an administrator to grant it."
        />
      </Card>
    );
  }

  return (
    <>
      <ChannelListingSummaryStrip summary={summary} />

      {/*
        FRAME 01 controls row — a fixed six-column grid, NOT a wrapping flex strip. The search
        field takes the remaining width; every other control keeps its assigned column, which
        is what stops the row from restructuring at zoom.

        🔴 Every dimension is still applied SERVER-SIDE (`TEC-096`). This is a visual repair,
        not a behavioural one.
      */}
      <div
        data-testid="channel-listings-toolbar"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 150px 132px 132px 118px 118px',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-6)',
          alignItems: 'center',
        }}
      >
        <div style={searchShell}>
          <SearchIcon size={14} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--color-placeholder)', flexShrink: 0 }} />
          <input
            data-testid="listing-search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilter({ search: searchDraft });
            }}
            onBlur={() => applyFilter({ search: searchDraft })}
            placeholder="Search title, listing ID, channel SKU or Sellable SKU"
            aria-label="Search Listings"
            style={searchInput}
          />
        </div>
        <Select
          label="Channel"
          testId="filter-channel-instance"
          value={shownChannel}
          onChange={(v) => applyFilter({ channelInstance: v })}
          options={[['', 'Channel: all'], ...channels.map((c) => [c.code, c.name] as const)]}
        />
        {/*
          🔴 UNMAPPED is a FILTER, not a tab. `mapped=false` means at least one orderable SKU
          is unmapped, which is exactly UNMAPPED or PARTIALLY_MAPPED (`PRD-178`).
        */}
        <Select
          label="Mapping"
          testId="filter-mapping"
          value={shownMapping}
          onChange={(v) => applyFilter({ mapped: v === '' ? undefined : v === 'true' })}
          options={[['', 'Mapping: all'], ['false', 'Not fully mapped'], ['true', 'Fully mapped']]}
        />
        <Select
          label="Status"
          testId="filter-listing-status"
          value={filters.listingStatus ?? ''}
          onChange={(v) => applyFilter({ listingStatus: v as ChannelListingFilters['listingStatus'] })}
          options={[['', 'Status: all'], ['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended'], ['REJECTED', 'Rejected']]}
        />
        <Select
          label="Sync state"
          testId="filter-sync-state"
          value={filters.syncState ?? ''}
          onChange={(v) => applyFilter({ syncState: v as ChannelListingFilters['syncState'] })}
          options={[
            ['', 'Sync: all'],
            ['PENDING', 'Pending'],
            ['IN_PROGRESS', 'In progress'],
            ['SYNCED', 'Synced'],
            ['FAILED', 'Failed'],
            ['MANUAL_REQUIRED', 'Manual required'],
            ['DIVERGED', 'Diverged'],
          ]}
        />
        <Select
          label="Lifecycle"
          testId="filter-lifecycle"
          value={filters.lifecycle ?? ''}
          onChange={(v) => applyFilter({ lifecycle: v as ChannelListingFilters['lifecycle'] })}
          options={[
            ['', 'Lifecycle: all'],
            ['DRAFT', 'Draft'],
            ['PENDING_PUBLICATION', 'Pending publication'],
            ['PUBLISHED', 'Published'],
            ['WITHDRAWN', 'Withdrawn'],
          ]}
        />
      </div>

      {/*
        FRAME 01 active-filter row. The two boolean dimensions are TOGGLE CHIPS here rather
        than checkboxes, which is what removes the stray native controls from the grid while
        keeping both dimensions reachable.
      */}
      <div
        data-testid="listing-active-filters"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '11px', flexWrap: 'nowrap' }}
      >
        <span style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {shownFilterCount === 0 ? 'No filters' : `${shownFilterCount} filter${shownFilterCount === 1 ? '' : 's'}`}
        </span>
        <FilterChip
          testId="filter-diverged"
          label="Diverged"
          active={filters.divergedOnly === true}
          onToggle={(next) => applyFilter({ divergedOnly: next || undefined })}
        />
        <FilterChip
          testId="filter-unsent"
          label="Unsent Local Changes"
          active={filters.unsentOnly === true}
          onToggle={(next) => applyFilter({ unsentOnly: next || undefined })}
        />
        {activeFilterCount > 0 && (
          <button
            type="button"
            data-testid="listing-clear-filters"
            onClick={clearFilters}
            style={clearAllStyle}
          >
            Clear all
          </button>
        )}
        {/*
          🔴 The Frame's right-hand meta slot. It states the CHANNEL OPERATION CONTEXT
          truthfully — `UX-037.g` forbids a figure whose basis is undefined, and there is no
          ratified automatic sync schedule to name, so none is invented here.
        */}
        <span
          data-testid="listing-channel-context"
          style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {channelContext}
        </span>
      </div>

      {(selected.length > 0 || notice) && (
        <div
          data-testid="listing-selection-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-5)',
            flexWrap: 'nowrap',
            // 🔴 Frame 04 — the filter-scoped bar takes the ink border because it is a claim
            // about Listings the operator cannot see; page scope stays quiet and grey.
            background: scope === 'all-matching' ? 'var(--color-surface)' : 'var(--color-strip)',
            border:
              scope === 'all-matching'
                ? '1.5px solid var(--color-ink)'
                : '1px solid var(--color-border-control)',
            borderRadius: 'var(--radius-card-small)',
            padding: scope === 'all-matching' ? '13px 15px' : '12px 14px',
            marginTop: 'var(--space-3)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div data-testid="listing-selected-count" style={{ fontSize: '13px', fontWeight: scope === 'all-matching' ? 800 : 700, color: 'var(--color-heading-ink)', whiteSpace: 'nowrap' }}>
              {scope === 'all-matching'
                ? `${selected.length} listings selected`
                : `${selected.length} listing${selected.length === 1 ? '' : 's'} selected on this page`}
            </div>
            {scope === 'all-matching' && (
              // 🔴 The scope is stated in words: which filter set, and evaluated where.
              <div data-testid="listing-selection-scope" style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                across {matchingChannels.length} channel{matchingChannels.length === 1 ? '' : 's'} · matches the
                current filter set, evaluated on the server
              </div>
            )}
          </div>

          {/*
            🔴 THE PROGRESSION IS ALWAYS EXPLICIT. Ticking the header checkbox selects the
            page; reaching every matching Listing is this separate control, and it names the
            real server-side count so the scope can never be mistaken.
          */}
          {scope === 'page' && allOnPageSelected && moreBeyondPage && (
            <button
              type="button"
              data-testid="listing-select-all-matching"
              onClick={() => void selectAllMatching()}
              disabled={busy}
              style={{ ...secondaryRowAction, border: '1px solid var(--color-ink)', fontWeight: 700, color: 'var(--color-heading-ink)' }}
            >
              Select all {totalElements} listings matching current filters
            </button>
          )}
          {scope === 'all-matching' && (
            <button type="button" data-testid="listing-select-page-only" onClick={() => selectAllVisible(true)} disabled={busy} style={secondaryRowAction}>
              Select this page only ({items.length})
            </button>
          )}

          <button type="button" data-testid="listing-clear-selection" onClick={clearSelection} style={clearAllStyle}>
            {scope === 'all-matching' ? 'Clear selection' : 'Clear'}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            {/*
              🔴 `PRD-196.a` — a role without publish sees NO dead Push control. It is told
              once, in words, why the action is absent.
            */}
            {!mayPublish && (
              <span data-testid="listing-push-authority-note" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}>
                Push requires product.channel-listing.publish
              </span>
            )}
            {mayManage && (
              <Link
                data-testid="listing-batch-edit"
                to={`/inventory/products/listings/batch-edit?ids=${selected.join(',')}`}
                style={{ ...(mayPublish ? secondaryRowAction : primaryRowAction), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                Batch Edit
              </Link>
            )}
            {maySync && (
              <button type="button" data-testid="listing-batch-refresh" onClick={() => void runOperation('REFRESH')} disabled={busy} style={secondaryRowAction}>
                Refresh Selected
              </button>
            )}
            {mayPublish && (
              <button type="button" data-testid="listing-batch-push" onClick={() => void runOperation('PUSH_UPDATE')} disabled={busy} style={primaryRowAction}>
                Review &amp; Push Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/*
        🔴 Frame 04 — the per-channel breakdown of a filter-scoped selection. A batch may
        span shops and the operator must see that BEFORE reviewing it. Nothing here fans out
        to sibling shops that merely share a Sellable Product (`PRD-187.b`).
      */}
      {scope === 'all-matching' && matchingChannels.length > 0 && (
        <div
          data-testid="listing-selection-channels"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(matchingChannels.length, 4)}, minmax(0, 1fr))`, gap: '10px', marginTop: '10px' }}
        >
          {matchingChannels.map((channel) => (
            <div key={channel.channelName} data-testid={`selection-channel-${channel.channelName}`} style={{ border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-control)', padding: '10px 12px', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {channel.channelName}
              </div>
              {/* 🔴 The count is the SERVER's, over the captured filter — never counted here. */}
              <div className="tabular-nums" style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {channel.selected} selected
              </div>
            </div>
          ))}
        </div>
      )}

      {scope === 'all-matching' && (
        <div data-testid="listing-selection-explainer" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', marginTop: '10px', lineHeight: 1.7 }}>
          Selection is held as a filter definition, not as {selected.length} rows in the browser.
          Listings in other shops that share a Sellable Product are never added to the selection.
        </div>
      )}

      {/*
        🔴 Frame 03 — an operational failure is a BANNER above the list, and the list stays
        usable beneath it. Local canonical Listings are never blanked out because a remote
        act failed.
      */}
      {operationError && (
        <ListingsBanner
          testId="listing-operation-error"
          emphasis
          title="The requested operation could not be completed"
          body={operationError}
          action={
            <button type="button" data-testid="listing-dismiss-operation-error" onClick={() => setOperationError(null)} style={secondaryRowAction}>
              Dismiss
            </button>
          }
        />
      )}

      {/*
        ⚠ The channel discovery ACTION lives on the Sync Now page, reached from the locked
        page header. Frame 01 carries only the channel operation CONTEXT, in the meta slot
        above — a standalone button row here is not part of the approved composition.
      */}

      {/*
        🔴 Frame 03 precedence. A failed workspace QUERY replaces the list, because there is
        no list. Everything else keeps the workspace's own geometry.
      */}
      {loadError || devState === 'error' ? (
        <ListingsNotice
          testId="listing-load-error"
          emphasis
          title="Listings could not be loaded"
          body={`${loadError ?? 'The Listings service did not respond.'} Your filters are unchanged. Nothing has been altered.`}
          actions={
            <button type="button" data-testid="listing-retry" onClick={() => void load()} style={secondaryRowAction}>
              Retry
            </button>
          }
        />
      ) : loading || devState === 'loading' ? (
        <OperationalRegion>
          <ChannelListingListHeader allSelected={false} />
          <ChannelListingSkeleton />
        </OperationalRegion>
      ) : items.length === 0 || devEmptyReason !== null ? (
        <>
          {(devEmptyReason ?? emptyReason) === 'none-yet' && (
            <ListingsNotice
              testId="listing-empty-none-yet"
              title="No listings yet"
              body="Nothing has been discovered from a channel and nothing has been created in the ERP. Run a sync to read existing marketplace listings, or add a listing from the ERP."
              actions={
                <>
                  {(mayPublish || maySync) && (
                    <Link data-testid="empty-sync-now" to="/inventory/products/listings/sync" style={{ ...primaryRowAction, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      Sync Now
                    </Link>
                  )}
                  {mayManage && (
                    <Link data-testid="empty-add-listing" to="/inventory/products/listings/new" style={{ ...secondaryRowAction, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      + Add Listing
                    </Link>
                  )}
                </>
              }
            />
          )}

          {(devEmptyReason ?? emptyReason) === 'no-unmapped' && (
            // ✅ A POSITIVE operational result — everything in scope is mapped. It must never
            // read as "no Listings", and it never suggests creating a Sellable Product.
            <ListingsNotice
              testId="listing-empty-no-unmapped"
              title="No unmapped listings"
              body="Every listing in the current filter scope is mapped to a Sellable Product."
              actions={
                <button type="button" data-testid="empty-show-all-listings" onClick={() => applyFilter({ mapped: undefined })} style={secondaryRowAction}>
                  Show all listings
                </button>
              }
            />
          )}

          {(devEmptyReason ?? emptyReason) === 'channel-none' && (
            // 🔴 PRD-177 — absence from a run is NOT deletion and NOT a status change. The
            // copy says so explicitly, because this is exactly where an operator would
            // otherwise assume the channel removed something.
            <ListingsNotice
              testId="listing-empty-channel-none"
              title={`${selectedChannel?.name ?? 'This channel'} returned no active listings`}
              body={`${
                selectedChannel?.lastSyncAt
                  ? `The last discovery run completed on ${formatMoment(selectedChannel.lastSyncAt)} and returned no discoverable active listings for this scope. `
                  : 'No discovery run has returned a discoverable active listing for this scope yet. '
              }Previously known listings keep their previously reported status and remain visible — absence from a discovery run is not a status change, a withdrawal or a deletion.`}
              actions={
                <button type="button" data-testid="empty-show-all-statuses" onClick={() => applyFilter({ listingStatus: '', lifecycle: '', syncState: '' })} style={secondaryRowAction}>
                  Show all statuses
                </button>
              }
            />
          )}

          {(devEmptyReason ?? emptyReason) === 'filtered' && (
            <ListingsNotice
              testId="listing-empty-filtered"
              title="No listings match these filters"
              body={`${totalAll === null ? 'Listings exist' : `${totalAll} listing${totalAll === 1 ? '' : 's'} exist`}. None match the filters applied above together.`}
              actions={
                <button type="button" data-testid="empty-clear-filters" onClick={clearFilters} style={secondaryRowAction}>
                  Clear all filters
                </button>
              }
            />
          )}
        </>
      ) : (
        <OperationalRegion>
          <ChannelListingListHeader
            allSelected={allOnPageSelected}
            someSelected={pageSelectedCount > 0}
            onSelectAllVisible={maySelect ? selectAllVisible : undefined}
          />
          {/* Frame 01: hairline rows at an 8px rhythm — a compact operational card-list. */}
          <div data-testid="channel-listing-results" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-3)' }}>
            {items.map((item) => {
              const menu = rowMenu(item);
              return (
                <div key={item.id}>
                  <ChannelListingCard
                    item={item}
                    selected={selected.includes(item.id)}
                    onSelectChange={maySelect ? toggleSelect : undefined}
                    menuActions={menu.actions}
                    menuNote={menu.note}
                  />
                  {/*
                    🔴 THE ROW STAYS IN PLACE. Frame 16 is inline operation feedback attached to
                    the Listing it concerns; it never replaces the workspace, never becomes a
                    page-wide loader and never reorders the result set.
                  */}
                  {refreshTarget === item.id && (
                    <ListingRefreshState
                      state={refresh.state}
                      result={refresh.result}
                      error={refresh.error}
                      listingTitle={item.intendedTitle ?? item.channelReportedTitle ?? 'Untitled listing'}
                      channelName={item.channelName}
                      onDismiss={refresh.dismiss}
                      onRetry={() => void refresh.run(item.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </OperationalRegion>
      )}

      {/* 🔴 Frame 03 — no misleading Prev/1/Next above an empty or failed result set. */}
      {!loading && !loadError && !devState && items.length > 0 && (
        <div
          data-testid="listing-pagination"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-7)' }}
        >
          {/*
            🔴 Page size and record count never change because of viewport or zoom. Both are
            SERVER facts rendered verbatim, and the range is stated against the active filters
            so the operator knows what the total counts.
          */}
          <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
            {page * size + 1}–{Math.min((page + 1) * size, totalElements)} of {totalElements} matching
            current filters
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button type="button" data-testid="listing-page-prev" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={pageStep(page === 0)}>
              Prev
            </button>
            {pageWindow(page, totalPages).map((entry, index) =>
              entry === null ? (
                <span key={`gap-${index}`} style={{ fontSize: '12.5px', color: 'var(--color-placeholder)', padding: '0 2px' }}>
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  data-testid={`listing-page-${entry + 1}`}
                  aria-current={entry === page ? 'page' : undefined}
                  onClick={() => setPage(entry)}
                  style={pageNumber(entry === page)}
                >
                  {entry + 1}
                </button>
              ),
            )}
            <button type="button" data-testid="listing-page-next" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={pageStep(page + 1 >= totalPages)}>
              Next
            </button>
          </div>
        </div>
      )}

      {pushReviewFor && (
        /*
          🔴 ONE SHARED IMPLEMENTATION. The workspace row menu and the Listing Detail page
          open the SAME modal, so the outbound boundary cannot drift between two surfaces.

          ⚠ Closing re-reads nothing by itself: a review that changed no state has nothing
          to refresh, and refetching would imply it did.
        */
        <PushReviewModal listingId={pushReviewFor} onClose={() => setPushReviewFor(null)} />
      )}

      {mappingFor && (
        <MappingModal
          listing={mappingFor}
          onClose={() => setMappingFor(null)}
          /*
            ⚠ Re-queries with the CURRENT filters, page and size, so a listing that no longer
            matches a "not fully mapped" filter leaves the result set honestly (§39) while
            everything the operator set up stays exactly as it was.
          */
          onMapped={() => void load()}
        />
      )}
    </>
  );
}


// ---------------------------------------------------------------------------------------
// FRAME 01 control geometry.
//
// 🔴 Every value below resolves to an EXISTING ratified token. Frame 01 introduces no new
// colour, radius or spacing — its greys map onto the palette the application already has.
// ---------------------------------------------------------------------------------------

const CONTROL_HEIGHT = '38px';

const searchShell: React.CSSProperties = {
  height: CONTROL_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  padding: '0 12px',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  minWidth: 0,
};

const searchInput: React.CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: '13px',
  fontFamily: 'inherit',
  color: 'var(--color-text-primary)',
};

const selectStyle: React.CSSProperties = {
  height: CONTROL_HEIGHT,
  width: '100%',
  minWidth: 0,
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--color-border-control)',
  padding: '0 11px',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  color: 'var(--color-text-secondary)',
  background: 'var(--color-surface)',
};

const headerSecondary: React.CSSProperties = {
  ...buttonStyle('secondary', 'page-header'),
  gap: 'var(--space-2)',
  textDecoration: 'none',
};

/** 🔴 Exactly ONE dark-filled primary per header (`RULE 3.11`), and it sits rightmost. */
const headerPrimary: React.CSSProperties = {
  ...buttonStyle('primary', 'page-header'),
  gap: 'var(--space-2)',
  textDecoration: 'none',
};

const secondaryRowAction: React.CSSProperties = { ...buttonStyle('secondary', 'row-action'), padding: '0 12px', whiteSpace: 'nowrap', flexShrink: 0 };
const primaryRowAction: React.CSSProperties = { ...buttonStyle('primary', 'row-action'), padding: '0 12px', whiteSpace: 'nowrap', flexShrink: 0 };

const clearAllStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: '11.5px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--color-text-muted)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** Frame 01 pagination: a bordered step control, disabled reading as demoted rather than gone. */
function pageStep(disabled: boolean): React.CSSProperties {
  return {
    height: '32px',
    padding: '0 11px',
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--color-border-control)',
    borderRadius: 'var(--radius-control-small)',
    background: 'var(--color-surface)',
    fontSize: '12.5px',
    fontWeight: disabled ? 400 : 600,
    fontFamily: 'inherit',
    color: disabled ? 'var(--color-placeholder)' : 'var(--color-text-primary)',
    cursor: disabled ? 'default' : 'pointer',
    whiteSpace: 'nowrap',
  };
}

/** 🔴 The current page is the ONLY dark-filled control in the pagination cluster. */
function pageNumber(current: boolean): React.CSSProperties {
  return {
    height: '32px',
    minWidth: '32px',
    padding: '0 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: current ? '1px solid var(--color-ink)' : '1px solid var(--color-border-control)',
    borderRadius: 'var(--radius-control-small)',
    background: current ? 'var(--color-ink)' : 'var(--color-surface)',
    color: current ? 'var(--color-surface)' : 'var(--color-text-primary)',
    fontSize: '12.5px',
    fontWeight: current ? 700 : 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
}

/**
 * The Frame 01 page window: first pages, an ellipsis, then the last page.
 *
 * <p>⚠ Returns `null` for the gap. The window is bounded so the cluster keeps a fixed width
 * however many pages the server reports — 37 pages must not widen the row.
 */
function pageWindow(current: number, total: number): readonly (number | null)[] {
  if (total <= 1) {
    return [0];
  }
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages: (number | null)[] = [];
  const near = [current - 1, current, current + 1].filter((p) => p > 0 && p < total - 1);
  const first = near.at(0);
  const last = near.at(-1);
  pages.push(0);
  if (first === undefined) {
    pages.push(null);
  } else {
    if (first > 1) {
      pages.push(null);
    }
    pages.push(...near);
    if (last !== undefined && last < total - 2) {
      pages.push(null);
    }
  }
  pages.push(total - 1);
  return pages;
}

/** A Frame 01 filter select. The label is carried by the "all" option, as the Frame shows. */
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
  readonly options: readonly (readonly [string, string])[];
}): React.JSX.Element {
  return (
    <select
      data-testid={testId}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ ...selectStyle, color: value === '' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', fontWeight: value === '' ? 400 : 600 }}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}

/**
 * A boolean filter dimension, as a Frame 01 chip.
 *
 * <p>🔴 `RULE 8.4` — the active state is carried by the ink border AND the pressed state, not
 * by colour alone.
 */
function FilterChip({
  testId,
  label,
  active,
  onToggle,
}: {
  readonly testId: string;
  readonly label: string;
  readonly active: boolean;
  readonly onToggle: (active: boolean) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={() => onToggle(!active)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '24px',
        padding: '0 9px',
        border: active ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-control)',
        borderRadius: 'var(--radius-control-small)',
        background: 'var(--color-surface)',
        fontSize: '11.5px',
        fontWeight: active ? 700 : 600,
        fontFamily: 'inherit',
        color: active ? 'var(--color-heading-ink)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
      {active && <span aria-hidden="true" style={{ color: 'var(--color-placeholder)' }}>×</span>}
    </button>
  );
}
