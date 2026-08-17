import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingBatchEditPage from './ChannelListingBatchEditPage';

/**
 * FRAME 17 — Batch edit, local intent only and capability-aware.
 *
 * <p>🔴 THE CLAIM UNDER TEST IS TWOFOLD. Every component of the approved frame is present —
 * and the operators the pack draws that NO canonical rule defines cannot be applied.
 * A screen that quietly dropped them would misreport the design; a screen that quietly ran
 * them would invent a monetary formula.
 */

const CHANNELS = [
  {
    id: 'ch-daraz-a', code: 'DRZ-A', name: 'Zeon Mart · Daraz', channelType: 'DARAZ',
    adapterAvailable: false, knownListings: 2, lastSyncAt: null,
    capabilities: [
      { fieldKey: 'sale_price', readable: true, writable: true },
      { fieldKey: 'title', readable: true, writable: true },
      { fieldKey: 'listing_stock', readable: true, writable: true },
      { fieldKey: 'publication_intent', readable: true, writable: true },
      { fieldKey: 'channel_category', readable: true, writable: true },
      { fieldKey: 'media', readable: true, writable: true },
      { fieldKey: 'attributes', readable: true, writable: true },
    ],
  },
  {
    id: 'ch-web', code: 'WEB', name: 'Zeon Mart Website', channelType: 'WEBSITE',
    adapterAvailable: false, knownListings: 1, lastSyncAt: null,
    // ⚠ Deliberately narrower: the website accepts no category and no attributes.
    capabilities: [
      { fieldKey: 'sale_price', readable: true, writable: true },
      { fieldKey: 'title', readable: true, writable: true },
      { fieldKey: 'publication_intent', readable: true, writable: true },
      { fieldKey: 'media', readable: true, writable: true },
    ],
  },
];

function listing(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'l-1',
    channelInstanceId: 'ch-daraz-a',
    channelInstance: 'Zeon Mart · Daraz',
    externalListingId: 'DRZ-87720113',
    intendedTitle: 'Hi-Power 22 Inch IPS Monitor',
    intendedDescription: null,
    intendedChannelCategory: null,
    salePrice: '12500.00',
    promotionPrice: null,
    promotionStartsAt: null,
    promotionEndsAt: null,
    listingStock: '4',
    publicationIntent: 'PUBLISHED',
    mappingState: 'MAPPED',
    skuCount: 1,
    version: 3,
    ...over,
  };
}

const SELECTION = [
  listing({ id: 'l-1' }),
  listing({ id: 'l-2', skuCount: 4 }),
  listing({ id: 'l-3', channelInstanceId: 'ch-web', channelInstance: 'Zeon Mart Website' }),
  listing({ id: 'l-4', mappingState: 'UNMAPPED', intendedTitle: null }),
];

let puts: { url: string; body: unknown }[] = [];

function stubApi(selection: readonly unknown[] = SELECTION): void {
  puts = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'PUT') {
      puts.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
      return new Response(null, { status: 204 });
    }
    if (url.includes('/channels')) {
      return new Response(JSON.stringify(CHANNELS), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/session')) {
      return new Response(JSON.stringify({
        username: 'operator', fullName: 'Operator', lifecycleState: 'ACTIVE',
        permissions: ['product.channel-listing.view', 'product.channel-listing.manage'],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const match = /channel-listings\/(l-\d)/.exec(url);
    if (match) {
      const found = selection.find((row) => (row as { id: string }).id === match[1]);
      return new Response(JSON.stringify(found), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }));
}

function renderPage(ids = 'l-1,l-2,l-3,l-4'): void {
  render(
    <MemoryRouter initialEntries={[`/inventory/products/listings/batch-edit?ids=${ids}`]}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/batch-edit" element={<ChannelListingBatchEditPage />} />
            <Route path="/inventory/products/listings" element={<div>Workspace</div>} />
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

const FIELDS = [
  'channel-price', 'listing-stock', 'title', 'channel-category',
  'attributes', 'publication-intent', 'media',
] as const;

// ================================================================ composition

describe('FRAME 17 composition', () => {
  it('renders every component the approved frame shows', async () => {
    renderPage();
    await screen.findByTestId('listing-batch-edit');

    /* Header and its two actions. */
    expect(screen.getByRole('heading', { name: 'Batch edit' })).toBeTruthy();
    expect(screen.getByText('Back to workspace')).toBeTruthy();
    expect(screen.getByTestId('batch-edit-apply')).toBeTruthy();

    /* The five-fact strip, the legend, the per-channel sidebar, the footer. */
    expect(screen.getByTestId('batch-edit-summary-strip')).toBeTruthy();
    expect(screen.getByTestId('batch-capability-legend')).toBeTruthy();
    expect(screen.getByTestId('batch-selection-by-channel')).toBeTruthy();
    expect(screen.getByTestId('batch-edit-consequence')).toBeTruthy();
  });

  it('renders all seven field rows, in the frame’s order', async () => {
    renderPage();
    await screen.findByTestId('batch-field-channel-price');
    FIELDS.forEach((key) => expect(screen.getByTestId(`batch-field-${key}`)).toBeTruthy());

    /* Read the rows back in DOM order — the frame's sequence is a requirement, not incidental. */
    const inDomOrder = [...document.querySelectorAll('[data-testid^="batch-field-"]')].map((node) =>
      (node.getAttribute('data-testid') ?? '').replace('batch-field-', ''),
    );
    expect(inDomOrder).toEqual([...FIELDS]);
  });

  it('carries the frame’s three column headings', async () => {
    renderPage();
    await screen.findByTestId('batch-field-title');
    expect(screen.getByText('Field')).toBeTruthy();
    expect(screen.getByText('Change to apply')).toBeTruthy();
    expect(screen.getByText('Applies to')).toBeTruthy();
  });

  it('states the capability legend in the frame’s own words', async () => {
    renderPage();
    const legend = await screen.findByTestId('batch-capability-legend');
    expect(legend.textContent).toContain('Every selected channel accepts the field.');
    expect(legend.textContent).toContain('Editable, applied only where accepted. The count states where.');
    expect(legend.textContent).toContain('rather than silently dropped later');
  });
});

// ================================================================ the five facts

describe('the summary strip', () => {
  it('derives all five facts from the selection that arrived', async () => {
    renderPage();
    await screen.findByTestId('batch-edit-summary-strip');
    /* 4 selected · 2 channels · 1 variation (skuCount 4) · 1 unmapped · 3 will receive. */
    expect(screen.getByTestId('batch-summary-selected').textContent).toContain('4');
    expect(screen.getByTestId('batch-summary-channels').textContent).toContain('2');
    expect(screen.getByTestId('batch-summary-variation').textContent).toContain('1');
    expect(screen.getByTestId('batch-summary-unmapped').textContent).toContain('1');
    expect(screen.getByTestId('batch-summary-will-receive').textContent).toContain('3');
  });

  it('says the scope in the header, and never widens it', async () => {
    renderPage();
    const scope = await screen.findByTestId('batch-edit-scope');
    expect(scope.textContent).toContain('4 listings selected across 2 channels');
    expect(scope.textContent).toContain('stores them in Trioloo only');
  });
});

// ================================================ capability, per PRD-125

describe('capability awareness', () => {
  it('reports a field every selected channel accepts as supported for all', async () => {
    renderPage();
    await screen.findByTestId('batch-capability-title');
    expect(screen.getByTestId('batch-capability-title').textContent).toBe('Supported for all');
    expect(screen.getByTestId('batch-reach-title').textContent).toBe('4 of 4');
  });

  it('reports a field only some channels accept as a subset, and counts the reach', async () => {
    renderPage();
    await screen.findByTestId('batch-capability-channel-category');
    /* The website channel declares no category: 3 of 4 listings can receive it. */
    expect(screen.getByTestId('batch-capability-channel-category').textContent).toBe('Supported for subset');
    expect(screen.getByTestId('batch-reach-channel-category').textContent).toBe('3 of 4');
  });

  it('never assumes channels of one type behave alike', async () => {
    renderPage();
    await screen.findByTestId('batch-reach-attributes');
    /* Attributes: accepted by Daraz, refused by the website — a per-INSTANCE declaration. */
    expect(screen.getByTestId('batch-reach-attributes').textContent).toBe('3 of 4');
  });
});

// ==================================== unratified operators are present but inert

describe('unratified transformation operators', () => {
  it('shows the percentage operators the pack draws, and disables them', async () => {
    renderPage();
    const select = await screen.findByTestId('batch-operator-channel-price');
    const options = [...select.querySelectorAll('option')];
    const labels = options.map((option) => option.textContent ?? '');

    /* 🔴 PRESENT — the design is not silently edited. */
    expect(labels.some((label) => label.startsWith('Decrease by %'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Increase by %'))).toBe(true);

    /* 🔴 AND INERT — no rule defines what they would compute. */
    const decrease = options.find((option) => (option.textContent ?? '').startsWith('Decrease by %'));
    expect((decrease as HTMLOptionElement).disabled).toBe(true);
    expect(decrease?.textContent).toContain('unavailable');
  });

  it('shows the title suffix operator, and disables it', async () => {
    renderPage();
    const select = await screen.findByTestId('batch-operator-title');
    const append = [...select.querySelectorAll('option')]
      .find((option) => (option.textContent ?? '').startsWith('Append suffix'));
    expect(append).toBeTruthy();
    expect((append as HTMLOptionElement).disabled).toBe(true);
  });

  it('shows the media append operator, and disables it', async () => {
    renderPage();
    const select = await screen.findByTestId('batch-operator-media');
    const append = [...select.querySelectorAll('option')]
      .find((option) => (option.textContent ?? '').startsWith('Append image'));
    expect(append).toBeTruthy();
    expect((append as HTMLOptionElement).disabled).toBe(true);
  });

  it('names the unavailable operators in plain words beside the control', async () => {
    renderPage();
    const hint = await screen.findByTestId('batch-unavailable-channel-price');
    expect(hint.textContent).toContain('Decrease by %');
    expect(hint.textContent).toContain('is not available yet');
  });

  it('🔴 cannot be applied even if an unratified operator is forced onto the select', async () => {
    renderPage();
    const select = await screen.findByTestId('batch-operator-channel-price');
    /* Bypass the disabled option exactly as a tampered client would. */
    fireEvent.change(select, { target: { value: 'DECREASE_PERCENT' } });

    const apply = screen.getByTestId('batch-edit-apply') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    await waitFor(() => expect(puts).toHaveLength(0));
  });

  it('🔴 performs no arithmetic anywhere — no computed price ever reaches the API', async () => {
    renderPage();
    await screen.findByTestId('batch-operator-channel-price');
    fireEvent.change(screen.getByTestId('batch-operator-channel-price'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByTestId('batch-value-channel-price'), { target: { value: '11875.00' } });
    fireEvent.click(screen.getByTestId('batch-edit-apply'));

    await waitFor(() => expect(puts.length).toBeGreaterThan(0));
    /* The string the operator typed, byte for byte — never a derived figure. */
    puts.forEach((put) => expect((put.body as { salePrice: string }).salePrice).toBe('11875.00'));
  });
});

// ================================================ ratified set-to-value behaviour

describe('ratified set-to-value', () => {
  it('applies a set price locally to every mapped Listing', async () => {
    renderPage();
    await screen.findByTestId('batch-operator-channel-price');
    fireEvent.change(screen.getByTestId('batch-operator-channel-price'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByTestId('batch-value-channel-price'), { target: { value: '9999.00' } });
    fireEvent.click(screen.getByTestId('batch-edit-apply'));

    /* 3 mapped listings written; the unmapped one is not. */
    await waitFor(() => expect(puts).toHaveLength(3));
    expect(puts.every((put) => put.url.includes('/channel-listings/'))).toBe(true);
  });

  it('leaves a field on No change completely alone', async () => {
    renderPage();
    await screen.findByTestId('batch-operator-channel-price');
    fireEvent.change(screen.getByTestId('batch-operator-channel-price'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByTestId('batch-value-channel-price'), { target: { value: '9999.00' } });
    fireEvent.click(screen.getByTestId('batch-edit-apply'));

    await waitFor(() => expect(puts).toHaveLength(3));
    /* ⚠ Blank never means "clear": the original title survives untouched. */
    puts.forEach((put) => {
      const body = put.body as { intendedTitle: string | null; publicationIntent: string };
      expect(body.intendedTitle).toBe('Hi-Power 22 Inch IPS Monitor');
      expect(body.publicationIntent).toBe('PUBLISHED');
    });
  });

  it('refuses to apply when nothing has been set', async () => {
    renderPage();
    await screen.findByTestId('batch-edit-apply');
    const apply = screen.getByTestId('batch-edit-apply') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    await waitFor(() => expect(puts).toHaveLength(0));
  });

  it('never batch-edits the promotion price or its window', async () => {
    renderPage();
    await screen.findByTestId('batch-field-channel-price');
    /* `PRD-199.c` — the window is part of the price; one window across a selection would
       schedule an offer nobody reviewed per listing. There is no control for it at all. */
    expect(screen.queryByTestId('batch-field-promotion-price')).toBeNull();
    expect(screen.queryByTestId('batch-operator-promotion-price')).toBeNull();
  });
});

// ================================================================ PRD-185

describe('local only', () => {
  it('excludes unmapped Listings and says so', async () => {
    renderPage();
    const footer = await screen.findByTestId('batch-edit-consequence');
    expect(footer.textContent).toContain('Apply stores changes locally');
    expect(footer.textContent).toContain('Nothing is sent to any marketplace by this step');
    expect(screen.getByTestId('batch-unmapped-excluded').textContent)
      .toContain('1 unmapped listings are excluded');
  });

  it('🔴 triggers no push, sync, refresh or discovery call of any kind', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if ((init?.method ?? 'GET') === 'PUT') return new Response(null, { status: 204 });
      if (url.includes('/channels')) {
        return new Response(JSON.stringify(CHANNELS), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const match = /channel-listings\/(l-\d)/.exec(url);
      if (match) {
        const found = SELECTION.find((row) => (row as { id: string }).id === match[1]);
        return new Response(JSON.stringify(found), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }));

    renderPage();
    await screen.findByTestId('batch-operator-channel-price');
    fireEvent.change(screen.getByTestId('batch-operator-channel-price'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByTestId('batch-value-channel-price'), { target: { value: '100.00' } });
    fireEvent.click(screen.getByTestId('batch-edit-apply'));
    await waitFor(() => expect(calls.some((call) => call.startsWith('PUT'))).toBe(true));

    ['push', 'sync', 'refresh', 'discover', 'operations', 'batches'].forEach((forbidden) => {
      expect(calls.some((call) => call.includes(forbidden))).toBe(false);
    });
  });

  it('offers no save-and-publish path', async () => {
    renderPage();
    await screen.findByTestId('batch-edit-apply');
    expect(screen.queryByText(/publish/i)).toBeNull();
    expect(screen.queryByText(/push updates/i)).toBeNull();
  });
});

// ================================================================ empty state

describe('no selection', () => {
  it('says nothing is selected rather than rendering an empty frame', async () => {
    renderPage('');
    expect(await screen.findByText('Nothing selected')).toBeTruthy();
    expect(screen.queryByTestId('batch-edit-summary-strip')).toBeNull();
  });
});
