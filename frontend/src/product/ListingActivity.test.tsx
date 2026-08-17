import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ListingActivityPage from './ListingActivityPage';

/**
 * FRAME 21 — Activity and operation history.
 *
 * <p>🔴 THE CLAIM UNDER TEST is that this surface READS a chronology Trioloo already holds and
 * invents nothing: no fabricated outcome, no colour standing in for the type column, and no
 * call that could reach a marketplace.
 */

const LISTING = {
  id: 'l-1',
  channelInstanceId: 'ch-1',
  channelInstance: 'Zeon Tech · Daraz',
  externalListingId: 'LST-001938',
  intendedTitle: 'Hi-Power 22 Inch IPS Monitor',
  intendedDescription: null,
  intendedChannelCategory: null,
  salePrice: '10900.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  listingStock: '4',
  publicationIntent: 'PUBLISHED',
  mappingState: 'MAPPED',
  skuCount: 1,
  version: 2,
};

const OPERATIONS = [
  {
    id: 'op-1', channelListingId: 'l-1', listingTitle: null, externalListingId: null,
    channelName: 'Zeon Tech · Daraz', batchId: null, operationKind: 'REFRESH',
    outcome: 'SUCCEEDED', detail: null, adapterProvenance: 'Daraz adapter',
    requestedByName: 'A. Rahman', requestedAt: '2026-08-13T10:44:00Z', completedAt: '2026-08-13T10:44:30Z',
  },
];

const ENTRIES = [
  {
    id: 'a-1', entryKind: 'OPERATION',
    summary: 'Refresh completed — reported price now ৳ 10,900',
    fieldKey: null, beforeValue: null, afterValue: null,
    source: 'Daraz adapter', actorName: 'A. Rahman',
    operationId: 'op-1', batchId: null, occurredAt: '2026-08-13T10:44:00Z',
  },
  {
    id: 'a-2', entryKind: 'CHANNEL_EVENT',
    summary: 'Reported price changed from ৳ 11,200 to ৳ 10,900 — listing became diverged',
    fieldKey: 'sale_price', beforeValue: null, afterValue: null,
    source: 'Daraz', actorName: null,
    operationId: null, batchId: null, occurredAt: '2026-08-13T08:15:00Z',
  },
  {
    id: 'a-3', entryKind: 'FIELD_CHANGE',
    summary: 'Channel price edited',
    fieldKey: 'sale_price', beforeValue: '৳ 10,900', afterValue: '৳ 11,200',
    source: 'Batch edit', actorName: 'S. Karim',
    operationId: null, batchId: 'b-1', occurredAt: '2026-07-28T15:47:00Z',
  },
];

let calls: string[] = [];

function stubApi(entries: readonly unknown[] = ENTRIES, totalElements = 64, totalPages = 8): void {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const json = (body: unknown): Response =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

    if (url.includes('/activity')) {
      const kind = new URL(url, 'http://x').searchParams.get('kind') ?? '';
      const filtered = kind === '' ? entries : entries.filter((e) => (e as { entryKind: string }).entryKind === kind);
      return json({ content: filtered, page: 0, size: 9, totalElements, totalPages });
    }
    if (url.includes('/operations')) return json(OPERATIONS);
    if (url.includes('/session')) {
      return json({
        username: 'operator', fullName: 'Operator', lifecycleState: 'ACTIVE',
        permissions: ['product.channel-listing.view'],
      });
    }
    if (url.includes('channel-listings/l-1')) return json(LISTING);
    return json({});
  }));
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings/l-1/activity']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/:id/activity" element={<ListingActivityPage />} />
            <Route path="/inventory/products/listings/:id" element={<div>Listing detail</div>} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => stubApi());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ================================================================ composition

describe('FRAME 21 composition', () => {
  it('renders every component the approved frame shows', async () => {
    renderPage();
    await screen.findByTestId('listing-activity');

    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByTestId('activity-subject')).toBeTruthy();
    expect(screen.getByTestId('activity-back')).toBeTruthy();
    expect(screen.getByTestId('activity-filters')).toBeTruthy();
    expect(screen.getByTestId('activity-header-row')).toBeTruthy();
    expect(screen.getByTestId('activity-paging')).toBeTruthy();
    expect(screen.getByTestId('activity-footnote')).toBeTruthy();
  });

  it('names the subject as the frame does — title, channel, external id', async () => {
    renderPage();
    const subject = await screen.findByTestId('activity-subject');
    expect(subject.textContent).toBe('Hi-Power 22 Inch IPS Monitor · Zeon Tech · Daraz · LST-001938');
  });

  it('carries the frame’s six column headings, in order', async () => {
    renderPage();
    const header = await screen.findByTestId('activity-header-row');
    expect([...header.children].map((cell) => cell.textContent))
      .toEqual(['Time', 'Type', 'What happened', 'Source', 'Actor', 'Outcome']);
  });

  it('offers the frame’s four type filters', async () => {
    renderPage();
    const filters = await screen.findByTestId('activity-filters');
    ['All', 'Field changes', 'Channel events', 'Operations'].forEach((label) =>
      expect(filters.textContent).toContain(label),
    );
  });

  it('states the frame’s footnote verbatim', async () => {
    renderPage();
    const note = await screen.findByTestId('activity-footnote');
    expect(note.textContent).toContain('Three kinds share one chronology, separated by the type column');
    expect(note.textContent).toContain('rather than by colour or iconography');
  });
});

// ================================================ real data, nothing invented

describe('the chronology', () => {
  it('renders the three kinds on one timeline', async () => {
    renderPage();
    await screen.findByTestId('activity-row-a-1');
    expect(screen.getByTestId('activity-type-a-1').textContent).toBe('OPERATION');
    expect(screen.getByTestId('activity-type-a-2').textContent).toBe('CHANNEL EVENT');
    expect(screen.getByTestId('activity-type-a-3').textContent).toBe('FIELD CHANGE');
  });

  it('shows a field change with its before → after pair', async () => {
    renderPage();
    const row = await screen.findByTestId('activity-row-a-3');
    expect(row.textContent).toContain('Channel price edited · ৳ 10,900 → ৳ 11,200');
  });

  it('reads an operation’s outcome from the operation record, not from the entry', async () => {
    renderPage();
    await screen.findByTestId('activity-outcome-a-1');
    /* op-1 really carries SUCCEEDED — the row reflects it rather than inventing a verdict. */
    expect(screen.getByTestId('activity-outcome-a-1').textContent).toBe('SUCCEEDED');
  });

  it('marks a field change Local, which is true of its kind', async () => {
    renderPage();
    await screen.findByTestId('activity-outcome-a-3');
    expect(screen.getByTestId('activity-outcome-a-3').textContent).toBe('Local');
  });

  it('🔴 leaves a channel event’s outcome unavailable rather than fabricating one', async () => {
    renderPage();
    await screen.findByTestId('activity-outcome-a-2');
    /* No persisted field carries a marketplace verdict. The frame prints "DIVERGED" here;
       inventing that would be a fabricated business fact. */
    expect(screen.getByTestId('activity-outcome-a-2').textContent).toBe('—');
  });

  it('attributes a channel event to the marketplace, not to a person', async () => {
    renderPage();
    const row = await screen.findByTestId('activity-row-a-2');
    expect(row.textContent).toContain('Marketplace');
  });

  it('🔴 carries no semantic pill, tone or icon in any row', async () => {
    renderPage();
    const row = await screen.findByTestId('activity-row-a-1');
    /* The frame separates kinds by the TYPE COLUMN, explicitly not by colour or iconography. */
    expect(row.querySelector('svg')).toBeNull();
    expect(row.querySelector('[data-status-pill]')).toBeNull();
    expect(row.innerHTML).not.toContain('--color-semantic');
    expect(row.innerHTML).not.toContain('--color-status');
  });
});

// ================================================================ filtering and paging

describe('filters and paging', () => {
  it('narrows the chronology to one kind', async () => {
    renderPage();
    await screen.findByTestId('activity-row-a-1');
    fireEvent.click(screen.getByText('Field changes'));

    await waitFor(() => expect(screen.queryByTestId('activity-row-a-1')).toBeNull());
    expect(screen.getByTestId('activity-row-a-3')).toBeTruthy();
    expect(calls.some((call) => call.includes('kind=FIELD_CHANGE'))).toBe(true);
  });

  it('states the range and total the way the frame does', async () => {
    renderPage();
    const paging = await screen.findByTestId('activity-paging');
    expect(paging.textContent).toContain('1–3 of 64 entries');
  });

  it('disables Prev on the first page and Next on the last', async () => {
    renderPage();
    await screen.findByTestId('activity-paging');
    expect((screen.getByTestId('activity-prev') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('activity-next') as HTMLButtonElement).disabled).toBe(false);

    cleanup();
    stubApi(ENTRIES, 3, 1);
    renderPage();
    await screen.findByTestId('activity-paging');
    expect((screen.getByTestId('activity-next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks the server for the next page rather than slicing in the browser', async () => {
    renderPage();
    await screen.findByTestId('activity-paging');
    fireEvent.click(screen.getByTestId('activity-next'));
    await waitFor(() => expect(calls.some((call) => call.includes('page=1'))).toBe(true));
  });
});

// ================================================================ empty states

describe('empty history', () => {
  it('renders the empty state when nothing has happened yet', async () => {
    stubApi([], 0, 0);
    renderPage();
    expect(await screen.findByText('Nothing has happened to this listing yet')).toBeTruthy();
    expect(screen.getByTestId('activity-paging').textContent).toContain('No entries');
  });

  it('keeps the frame’s structure visible when empty', async () => {
    stubApi([], 0, 0);
    renderPage();
    await screen.findByText('Nothing has happened to this listing yet');
    /* ⚠ The columns and filters stay: an empty history is a state of the frame, not its absence. */
    expect(screen.getByTestId('activity-header-row')).toBeTruthy();
    expect(screen.getByTestId('activity-filters')).toBeTruthy();
    expect(screen.getByTestId('activity-footnote')).toBeTruthy();
  });

  it('says something different when a filter is what emptied the list', async () => {
    stubApi([ENTRIES[0]], 1, 1);
    renderPage();
    await screen.findByTestId('activity-row-a-1');
    fireEvent.click(screen.getByText('Field changes'));
    expect(await screen.findByText('No entries of this kind')).toBeTruthy();
  });
});

// ================================================================ read-only

describe('this surface only reads', () => {
  it('🔴 triggers no push, sync, refresh, discovery or publish call', async () => {
    renderPage();
    await screen.findByTestId('activity-row-a-1');
    fireEvent.click(screen.getByText('Operations'));
    await waitFor(() => expect(calls.some((call) => call.includes('kind=OPERATION'))).toBe(true));

    /* Every call is a GET, and none of them is an action. */
    expect(calls.every((call) => call.startsWith('GET'))).toBe(true);
    ['push', 'sync', 'discover', 'publish', 'refresh-listing', 'import'].forEach((forbidden) => {
      expect(calls.some((call) => call.includes(forbidden))).toBe(false);
    });
  });

  it('offers no action that could reach a marketplace', async () => {
    renderPage();
    await screen.findByTestId('listing-activity');
    expect(screen.queryByText(/push/i)).toBeNull();
    expect(screen.queryByText(/sync now/i)).toBeNull();
    expect(screen.queryByText(/publish/i)).toBeNull();
  });
});
