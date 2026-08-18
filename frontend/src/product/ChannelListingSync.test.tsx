import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingSyncPage from './ChannelListingSyncPage';

/**
 * FRAME 20 — Sync Now, and the shared operation result.
 *
 * <p>🔴 THE CENTRAL CLAIM is that the surface reports what the SERVER RECORDED. Every figure
 * on the result comes from the discovery outcome or from the batch's own derived tally
 * (`INV-108.2`); the four the pack draws that a discovery run does not track render as
 * UNAVAILABLE rather than as invented numbers (`LSC-034`).
 *
 * <p>🔴 THE SECOND CLAIM is that this surface reads and never writes. `PRD-189.e` — sync never
 * pushes — so no outbound endpoint is reachable, and one click produces exactly one request.
 *
 * <p>⚠ NO MARKETPLACE IS CONTACTED. `fetch` is stubbed; nothing here reaches Daraz.
 */

const CHANNELS = [
  {
    id: 'ch-1', code: 'RYZEN', name: 'Ryzen Builder', channelType: 'DARAZ',
    adapterAvailable: true, knownListings: 9, lastSyncAt: null, capabilities: [],
  },
  {
    id: 'ch-2', code: 'WEB', name: 'Friday PC Website', channelType: 'WEBSITE',
    adapterAvailable: false, knownListings: 0, lastSyncAt: null, capabilities: [],
  },
];

/** The production shape of 2026-08-18: nine returned, none newly recorded, complete. */
const OUTCOME = {
  batchId: 'c2612c2b-c124-4168-a4cd-eb21a8bac345',
  listingsSeen: 9,
  listingsCreated: 0,
  complete: true,
  incompleteReason: null,
};

const BATCH = {
  id: OUTCOME.batchId,
  operationKind: 'DISCOVER',
  scopeDescription: 'Discovery on Ryzen Builder',
  requestedByName: 'Mithun Ahamed',
  requestedAt: '2026-08-18T17:40:12Z',
  completedAt: '2026-08-18T17:40:15Z',
  requested: 9,
  succeeded: 9,
  failed: 0,
  manualRequired: 0,
  diverged: 0,
  inFlight: 0,
};

const MEMBERS = Array.from({ length: 9 }, (_, i) => ({
  id: `op-${i + 1}`,
  channelListingId: `L-${i + 1}`,
  listingTitle: null,
  externalListingId: `2446139${80 + i}`,
  channelName: 'Ryzen Builder',
  batchId: OUTCOME.batchId,
  operationKind: 'DISCOVER',
  outcome: 'SUCCEEDED',
  detail: 'Reported values re-read on a Listing already known. 1 orderable SKU and 9 attributes reported.',
  adapterProvenance: 'DARAZ',
  requestedByName: 'Mithun Ahamed',
  requestedAt: '2026-08-18T17:40:12Z',
  completedAt: '2026-08-18T17:40:15Z',
}));

let calls: { url: string; method: string }[] = [];
let outcomeResponse: unknown = OUTCOME;
let discoveryStatus = 200;

function stubApi(permissions: readonly string[] = [
  'product.channel-listing.view',
  'product.channel-listing.sync',
]): void {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: String(init?.method ?? 'GET') });
    const json = (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/api/auth/me')) {
      return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions });
    }
    if (url.includes('/discovery')) {
      if (discoveryStatus !== 200) return json({ message: 'The channel refused the read.' }, discoveryStatus);
      return json(outcomeResponse);
    }
    if (url.includes('/members')) {
      return json({ content: MEMBERS, page: 0, size: 200, totalElements: 9, totalPages: 1 });
    }
    if (/\/operations\/batches\/[^/]+$/.test(url)) return json(BATCH);
    if (url.includes('/channels')) return json(CHANNELS);
    return json({});
  }));
}

function renderSync(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings/sync']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/sync" element={<ChannelListingSyncPage />} />
            <Route path="/inventory/products/listings" element={<div data-testid="landed-on-workspace" />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function loaded(): Promise<void> {
  renderSync();
  await waitFor(() => expect(screen.getByTestId('sync-request')).toBeTruthy());
}

/** Chooses Ryzen Builder and starts the one run. */
async function runSync(): Promise<void> {
  await loaded();
  fireEvent.click(screen.getByTestId('sync-choose-RYZEN'));
  fireEvent.click(screen.getByTestId('sync-start'));
  await waitFor(() => expect(screen.getByTestId('sync-result')).toBeTruthy());
}

const discoveryCalls = (): { url: string; method: string }[] =>
  calls.filter((c) => c.url.includes('/discovery'));

describe('Frame 20 — the Sync Now request surface', () => {
  beforeEach(() => { outcomeResponse = OUTCOME; discoveryStatus = 200; stubApi(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  /** 🔴 Every component the approved pack draws for the request half is present. */
  it('renders every component of the Sync Now surface', async () => {
    await loaded();
    expect(screen.getByTestId('sync-channel-RYZEN')).toBeTruthy();
    expect(screen.getByTestId('sync-channel-WEB')).toBeTruthy();
    /* The scope is stated twice: as the selection's own label, and as the note below it. */
    expect(screen.getByText('One channel per manual sync')).toBeTruthy();
    expect(screen.getByTestId('sync-scope-note').textContent)
      .toContain('reads one channel instance');
    expect(screen.getByTestId('sync-explainer').textContent).toContain('Discovers active listings');
    expect(screen.getByTestId('sync-explainer').textContent).toContain('Leaves ERP intended values');
    expect(screen.getByTestId('sync-never-pushes').textContent).toContain('never pushes');
    expect(screen.getByTestId('sync-footnote').textContent).toContain('Absence alone is not treated as deletion');
    expect(screen.getByTestId('sync-cancel')).toBeTruthy();
    expect(screen.getByTestId('sync-start')).toBeTruthy();
  });

  /** 🔴 `PRD-189.b` — one channel per manual sync, enforced by a radio group. */
  it('offers a single-choice channel selection', async () => {
    await loaded();
    const ryzen = screen.getByTestId('sync-choose-RYZEN') as HTMLInputElement;
    expect(ryzen.type).toBe('radio');
    expect(ryzen.name).toBe('sync-channel');
  });

  /** ⚠ CAPABILITY, NOT AUTHORITY — an adapter with nothing readable cannot be chosen. */
  it('disables a channel whose adapter reports no readable data', async () => {
    await loaded();
    expect((screen.getByTestId('sync-choose-WEB') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('sync-channel-WEB').textContent)
      .toContain('This adapter reports no readable data');
  });

  /** ✅ The known-listing count is the server's, and the read time is only shown if recorded. */
  it('shows known listings and states when no read time exists', async () => {
    await loaded();
    const row = screen.getByTestId('sync-channel-RYZEN').textContent ?? '';
    expect(row).toContain('9 known listings');
    /* 🔴 `INV-107.4` / `GAP-134` — discovery does not write a sync time, so none is invented. */
    expect(row).toContain('no read time recorded');
  });

  /**
   * 🔴 `PRD-189.a` RATIFIES A MONTHLY CADENCE BUT NO SCHEDULER EXISTS. The pack prints a
   * "last automatic run" time; fabricating one would state a fact Trioloo does not hold.
   */
  it('does not fabricate a last automatic run time', async () => {
    await loaded();
    expect(screen.getByTestId('sync-automatic-unavailable').textContent)
      .toContain('no automatic run has been recorded yet');
  });

  /** 🔴 Nothing is startable until a channel is chosen. */
  it('cannot start until a channel is selected', async () => {
    await loaded();
    expect((screen.getByTestId('sync-start') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('sync-choose-RYZEN'));
    expect((screen.getByTestId('sync-start') as HTMLButtonElement).disabled).toBe(false);
  });

  /** 🔴 `PRD-196.a` — no sync authority, no control at all rather than a dead one. */
  it('offers no start control without sync authority', async () => {
    stubApi(['product.channel-listing.view']);
    await loaded();
    expect(screen.queryByTestId('sync-start')).toBeNull();
    expect(screen.getByTestId('sync-no-permission')).toBeTruthy();
  });
});

describe('Frame 20 — the run', () => {
  beforeEach(() => { outcomeResponse = OUTCOME; discoveryStatus = 200; stubApi(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  /** 🔴 ONE CLICK, ONE REQUEST, against the endpoint that already exists. */
  it('calls the discovery endpoint exactly once', async () => {
    await runSync();
    const made = discoveryCalls();
    expect(made).toHaveLength(1);
    expect(made[0]?.method).toBe('POST');
    expect(made[0]?.url).toContain('/api/product/channel-listings/discovery');
  });

  /** 🔴 `PRD-189.e` — sync reads. No outbound act is reachable from this surface. */
  it('calls no push, publish, withdraw or retry endpoint', async () => {
    await runSync();
    const forbidden = calls.filter((c) =>
      /\/(push|publish|withdraw|accept-marketplace|retry)/.test(c.url));
    expect(forbidden).toHaveLength(0);
    /* ✅ And every non-discovery call it did make was a read. */
    expect(calls.filter((c) => c.method !== 'GET' && !c.url.includes('/discovery'))).toHaveLength(0);
  });

  /** 🔴 A second click cannot start a second read of the same catalogue. */
  it('does not start a second run while one is in flight', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('sync-choose-RYZEN'));
    const start = screen.getByTestId('sync-start');
    fireEvent.click(start);
    fireEvent.click(start);
    await waitFor(() => expect(screen.getByTestId('sync-result')).toBeTruthy());
    expect(discoveryCalls()).toHaveLength(1);
  });

  /** ⚠ A refused run reports the refusal and records no result surface. */
  it('reports a refusal without showing a result', async () => {
    discoveryStatus = 500;
    await loaded();
    fireEvent.click(screen.getByTestId('sync-choose-RYZEN'));
    fireEvent.click(screen.getByTestId('sync-start'));
    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeTruthy());
    expect(screen.queryByTestId('sync-result')).toBeNull();
  });
});

describe('Frame 20 — the result surface', () => {
  beforeEach(() => { outcomeResponse = OUTCOME; discoveryStatus = 200; stubApi(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  /** ✅ The three real tiles come from the run's own figures. */
  it('renders the real tallies from the discovery outcome', async () => {
    await runSync();
    expect(screen.getByTestId('sync-tile-discovered').textContent).toContain('9');
    expect(screen.getByTestId('sync-tile-refreshed').textContent).toContain('9');
    expect(screen.getByTestId('sync-tile-imported').textContent).toContain('0');
  });

  /** ✅ Manual-required and errors are DERIVED by the server from the batch's members. */
  it('renders manual-required and errors from the batch tally', async () => {
    await runSync();
    expect(screen.getByTestId('sync-tile-manual').textContent).toContain('0');
    expect(screen.getByTestId('sync-tile-errors').textContent).toContain('0');
  });

  /**
   * 🔴 `LSC-034` — WHAT IS NOT TRACKED IS NOT INVENTED. A discovery run compares nothing field
   * by field and concludes nothing from absence, so both tiles state that instead of a number.
   */
  it('renders untracked metrics as unavailable rather than fabricating them', async () => {
    await runSync();
    expect(screen.getByTestId('sync-tile-changes').textContent).toContain('—');
    expect(screen.getByTestId('sync-tile-not-returned').textContent).toContain('—');
    expect(screen.getByTestId('sync-tile-changes').textContent).not.toMatch(/\d/);
    expect(screen.getByTestId('sync-tile-not-returned').textContent).not.toMatch(/\d/);
    expect(screen.getByTestId('sync-unavailable-note').textContent)
      .toContain('not recorded by a discovery run');
  });

  /** ✅ The completion state and the absence guarantee are both stated. */
  it('states completion and the absence-is-not-deletion guarantee', async () => {
    await runSync();
    const banner = screen.getByTestId('sync-status-complete');
    expect(banner.textContent).toContain('Completed');
    expect(banner.textContent).toContain('absence alone is not treated as deletion');
  });

  /** 🔴 `API-066.b` — a truncated run says so, and names the reason it was given. */
  it('reports an incomplete run as incomplete with its reason', async () => {
    outcomeResponse = {
      ...OUTCOME,
      complete: false,
      incompleteReason: 'The channel returned a full page carrying no update time.',
    };
    await runSync();
    const banner = screen.getByTestId('sync-status-partial');
    expect(banner.textContent).toContain('Completed partially');
    expect(banner.textContent).toContain('no update time');
    expect(banner.textContent).toContain('Nothing was withdrawn or deleted');
    /* ⚠ `PRD-186.d` — retry targets FAILED members, and a discovery run records none. */
    expect(screen.getByTestId('sync-retry-unavailable').textContent).toContain('nothing to retry');
  });

  /**
   * 🔴 `PRD-186.a`/`.b` — one record per Listing, retained individually. The table is the
   * per-listing evidence the production run actually produced.
   */
  it('renders one row per listing from the recorded operations', async () => {
    await runSync();
    MEMBERS.forEach((m) => expect(screen.getByTestId(`sync-member-${m.id}`)).toBeTruthy());
    const first = screen.getByTestId('sync-member-op-1').textContent ?? '';
    expect(first).toContain('DISCOVER');
    expect(first).toContain('SUCCEEDED');
    expect(first).toContain('1 orderable SKU');
  });

  /**
   * 🔴 THE UI IMPLIES NO CREATION. Nine listings returned and none newly recorded must read as
   * nine refreshed and zero imported — never as nine new records.
   */
  it('implies no duplicate listing or product creation', async () => {
    await runSync();
    expect(screen.getByTestId('sync-tile-imported').textContent).toContain('0');
    expect(screen.getByTestId('sync-member-op-1').textContent).toContain('already known');
    /* ✅ Nine rows for nine listings — the run did not double them. */
    expect(screen.getAllByTestId(/^sync-member-/)).toHaveLength(9);
  });

  /** ⚠ A Listing with no authored title falls back to its channel identifier, never name_en. */
  it('falls back to the external identifier when no title is authored', async () => {
    await runSync();
    expect(screen.getByTestId('sync-member-op-1').textContent).toContain('24461398');
  });
});
