import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingBatchPage from './ChannelListingBatchPage';

/**
 * FRAME 19 — Batch result and retry, per-listing outcomes.
 *
 * <p>🔴 THE INBOUND HALF IS UNDER TEST, AND ONLY THAT. The page reads a REAL recorded batch —
 * the shape production produced on 2026-08-18: a `DISCOVER` run with nine successful members
 * and no failures. Its outbound half — a push result, a failed member, a retry that resends —
 * cannot exist until an outbound adapter and a documented Daraz write protocol do (`LSC-051`).
 *
 * <p>🔴 NOTHING HERE FABRICATES A FAILURE. There is no fixture with an invented `FAILED` or
 * `DIVERGED` member, because production has never produced one and a screen proven against
 * imaginary outcomes proves nothing about the real ones.
 *
 * <p>⚠ NO MARKETPLACE IS CONTACTED. `fetch` is stubbed.
 */

const BATCH = {
  id: 'c2612c2b-c124-4168-a4cd-eb21a8bac345',
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
  batchId: BATCH.id,
  operationKind: 'DISCOVER',
  outcome: 'SUCCEEDED',
  detail: 'Reported values re-read on a Listing already known. 1 orderable SKU and 9 attributes reported.',
  adapterProvenance: 'DARAZ',
  requestedByName: 'Mithun Ahamed',
  requestedAt: '2026-08-18T17:40:12Z',
  completedAt: '2026-08-18T17:40:15Z',
}));

let calls: { url: string; method: string }[] = [];
let batchResponse: unknown = BATCH;

function stubApi(permissions: readonly string[] = [
  'product.channel-listing.view',
  'product.channel-listing.sync',
]): void {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: String(init?.method ?? 'GET') });
    const json = (body: unknown): Response =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/api/auth/me')) {
      return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions });
    }
    if (url.includes('/members')) {
      const outcome = new URL(url, 'http://x').searchParams.get('outcome');
      /* ⚠ The SERVER filters. A filter with no matching member returns an empty page. */
      const content = !outcome || outcome === 'SUCCEEDED' ? MEMBERS : [];
      return json({ content, page: 0, size: 50, totalElements: content.length, totalPages: content.length ? 1 : 0 });
    }
    if (/\/operations\/batches\/[^/]+$/.test(url)) return json(batchResponse);
    return json({});
  }));
}

function renderBatch(): void {
  render(
    <MemoryRouter initialEntries={[`/inventory/products/listings/batches/${BATCH.id}`]}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/batches/:batchId" element={<ChannelListingBatchPage />} />
            <Route path="/inventory/products/listings" element={<div data-testid="landed-on-workspace" />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function loaded(): Promise<void> {
  renderBatch();
  await waitFor(() => expect(screen.getByTestId('listing-batch')).toBeTruthy());
}

describe('Frame 19 — a real DISCOVER batch', () => {
  beforeEach(() => { batchResponse = BATCH; stubApi(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  /**
   * 🔴 THE TITLE NAMES THE ACT THAT RAN. The pack prints "Push result"; printing that over an
   * inbound run would describe an outbound act Trioloo has never performed.
   */
  it('names the run by its real kind, not the pack’s push example', async () => {
    await loaded();
    expect(document.body.textContent).toContain('Discovery result');
    expect(document.body.textContent).not.toContain('Push result');
  });

  /** ✅ The subject line carries who ran it and when it started and completed. */
  it('states the subject, actor and both times', async () => {
    await loaded();
    const subject = screen.getByTestId('batch-subject').textContent ?? '';
    expect(subject).toContain('Discovery on Ryzen Builder');
    expect(subject).toContain('Mithun Ahamed');
    expect(subject).toContain('started');
    expect(subject).toContain('completed');
  });

  /** ✅ `INV-108.2` — every count is the server's, derived from the members. */
  it('renders the summary strip from the server tally', async () => {
    await loaded();
    expect(screen.getByTestId('batch-requested').textContent).toContain('9');
    expect(screen.getByTestId('batch-succeeded').textContent).toContain('9');
    expect(screen.getByTestId('batch-failed').textContent).toContain('0');
    expect(screen.getByTestId('batch-manual-required').textContent).toContain('0');
    expect(screen.getByTestId('batch-diverged').textContent).toContain('0');
  });

  /** 🔴 `INV-107.1`/`.2` — the strip is an aggregate, and the frame says so in words. */
  it('states that the summary is an aggregate', async () => {
    await loaded();
    expect(screen.getByTestId('batch-aggregate-note').textContent)
      .toContain('Each Listing keeps its own outcome');
  });

  /** 🔴 `PRD-186.a`/`.b` — one row per recorded operation, never collapsed. */
  it('renders one row per member', async () => {
    await loaded();
    MEMBERS.forEach((m) => expect(screen.getByTestId(`batch-member-${m.id}`)).toBeTruthy());
    expect(screen.getAllByTestId(/^batch-member-/)).toHaveLength(9);
    const first = screen.getByTestId('batch-member-op-1').textContent ?? '';
    expect(first).toContain('SUCCEEDED');
    expect(first).toContain('1 orderable SKU');
    /* ⚠ No authored title, so the channel identifier stands in — never an attribute. */
    expect(first).toContain('24461398');
  });

  /** ✅ The tabs carry the server's counts and drive a server-side filter. */
  it('filters on the server through tabs that carry their counts', async () => {
    await loaded();
    expect(screen.getByTestId('batch-filter-all').textContent).toContain('All 9');
    expect(screen.getByTestId('batch-filter-SUCCEEDED').textContent).toContain('Successful 9');
    expect(screen.getByTestId('batch-filter-FAILED').textContent).toContain('Failed 0');

    fireEvent.click(screen.getByTestId('batch-filter-FAILED'));
    await waitFor(() => expect(calls.some((c) => c.url.includes('outcome=FAILED'))).toBe(true));
    /* 🔴 An empty filter shows an empty state — it never invents a member. */
    await waitFor(() => expect(screen.queryAllByTestId(/^batch-member-/)).toHaveLength(0));
  });

  /** ✅ Paging reports the server's totals in the frame's wording. */
  it('reports the result range from the server totals', async () => {
    await loaded();
    expect(document.body.textContent).toContain('of 9 results');
    expect(screen.getByTestId('batch-page-prev')).toBeTruthy();
    expect(screen.getByTestId('batch-page-next')).toBeTruthy();
  });
});

describe('Frame 19 — what is not available', () => {
  beforeEach(() => { batchResponse = BATCH; stubApi(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  /**
   * 🔴 `PRD-186.d` — retry addresses FAILED members, and an inbound run records none. The
   * control is therefore absent rather than rendered as a button that can address nothing.
   */
  it('offers no retry when the run recorded no failures', async () => {
    await loaded();
    expect(screen.queryByTestId('batch-retry-failed')).toBeNull();
    expect(screen.getByTestId('batch-actions-unavailable').textContent)
      .toContain('this run recorded none');
  });

  /** 🔴 The pack's "Export result" has no endpoint, and says so instead of doing nothing. */
  it('states that exporting a run is unavailable', async () => {
    await loaded();
    expect(screen.getByTestId('batch-actions-unavailable').textContent)
      .toContain('Exporting a run is not available');
  });

  /**
   * 🔴 NO OUTBOUND CALL IS REACHABLE FROM THIS SCREEN. It reads a batch and its members; it
   * never pushes, publishes, withdraws or accepts.
   */
  it('calls no push, publish, withdraw or accept endpoint', async () => {
    await loaded();
    expect(calls.filter((c) => /\/(push|publish|withdraw|accept-marketplace|discovery)/.test(c.url)))
      .toHaveLength(0);
    /* ✅ And every request it made was a read. */
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  /** ⚠ No Daraz host is ever contacted from the browser. */
  it('contacts no marketplace host', async () => {
    await loaded();
    expect(calls.filter((c) => /daraz|lazada/i.test(c.url))).toHaveLength(0);
  });
});
