import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ShopsWorkspacePage from './ShopsWorkspacePage';
import type { ShopRow, ShopSummary } from './shopApi';

/**
 * FRAME 01 — the Shops & Channels workspace, as a surface.
 *
 * <p>🔴 THE CLAIMS UNDER TEST are that the four approved states render, that configuration and
 * connection stay two carriers, that an unreadable connection never reads as NOT CONNECTED,
 * and that no secret or unbuilt-domain figure can appear.
 *
 * <p>🔴 The filters and search are asserted to become REQUEST PARAMETERS. A test that only
 * checked the visible rows would pass on a client-side filter, which `TEC-096` forbids.
 */

const CONNECTED: ShopRow = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'CHN-000114',
  name: 'Zeon Mart · Daraz',
  channelType: 'DARAZ',
  channelTypeLabel: 'Daraz',
  configuration: 'ACTIVE',
  connection: 'CONNECTED',
  externalLink: 'https://daraz.example/zeonmart',
  bound: true,
};

const UNBOUND: ShopRow = {
  id: '22222222-2222-2222-2222-222222222222',
  code: 'CHN-000300',
  name: 'Friday PC · Daraz',
  channelType: 'DARAZ',
  channelTypeLabel: 'Daraz',
  configuration: 'DRAFT',
  connection: 'NOT_CONNECTED',
  externalLink: null,
  bound: false,
};

/** 🔴 The case the contract is built around: suspended AND still connected. */
const SUSPENDED_BUT_CONNECTED: ShopRow = {
  id: '33333333-3333-3333-3333-333333333333',
  code: 'CHN-000500',
  name: 'MME Website',
  channelType: 'WEBSITE',
  channelTypeLabel: 'Website',
  configuration: 'SUSPENDED',
  connection: 'CONNECTED',
  externalLink: 'https://mme.example',
  bound: true,
};

const SUMMARY: ShopSummary = {
  allShops: {
    channelTypeCount: 2,
    shopCount: 3,
    configurationSplit: [
      { key: 'ACTIVE', label: 'Active', count: 1 },
      { key: 'DRAFT', label: 'Draft', count: 1 },
      { key: 'SUSPENDED', label: 'Suspended', count: 1 },
    ],
  },
  channelTypes: [
    {
      channelType: 'DARAZ',
      label: 'Daraz',
      shopCount: 2,
      attentionCount: 1,
      connectionSplit: [
        { key: 'CONNECTED', label: 'Connected', count: 1 },
        { key: 'NOT_CONNECTED', label: 'Not connected', count: 1 },
      ],
    },
    {
      channelType: 'WEBSITE',
      label: 'Website',
      shopCount: 1,
      attentionCount: 0,
      connectionSplit: [{ key: 'CONNECTED', label: 'Connected', count: 1 }],
    },
  ],
  connectionKnown: true,
};

let requestedUrls: string[] = [];

function stubApi(
  permissions: readonly string[] = ['system.channel-instance.view', 'system.channel-instance.manage'],
  options: {
    readonly content?: readonly ShopRow[];
    readonly summary?: ShopSummary;
    readonly failList?: boolean;
    readonly forbidList?: boolean;
    readonly neverResolveList?: boolean;
    readonly totalRegistered?: number;
  } = {},
): void {
  requestedUrls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      const json = (body: unknown): Response =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/me')) {
        return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions });
      }
      if (url.includes('/channel-types')) {
        return json([
          { code: 'DARAZ', label: 'Daraz' },
          { code: 'WEBSITE', label: 'Website' },
          { code: 'SHOPIFY', label: 'Shopify' },
          { code: 'WOOCOMMERCE', label: 'WooCommerce' },
        ]);
      }
      if (url.includes('/summary')) {
        if (options.forbidList) return new Response('{"message":"denied"}', { status: 403 });
        if (options.failList) return new Response('{"message":"upstream down"}', { status: 500 });
        return json(options.summary ?? SUMMARY);
      }
      if (url.includes('/api/system/shops')) {
        if (options.neverResolveList) return new Promise<Response>(() => {});
        if (options.forbidList) return new Response('{"message":"denied"}', { status: 403 });
        if (options.failList) return new Response('{"message":"upstream down"}', { status: 500 });
        const content = options.content ?? [CONNECTED, UNBOUND, SUSPENDED_BUT_CONNECTED];
        return json({
          content,
          page: 0,
          size: 50,
          totalElements: content.length,
          totalPages: content.length === 0 ? 0 : 1,
          totalRegistered: options.totalRegistered ?? content.length,
        });
      }
      return json({});
    }),
  );
}

function renderWorkspace(): void {
  render(
    <MemoryRouter initialEntries={['/administration/shops']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/administration/shops" element={<ShopsWorkspacePage />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SC-W — the workspace', () => {
  it('SCS-024 renders the approved columns and one row per shop', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));

    const header = screen.getByTestId('shop-list-header');
    expect(header.textContent).toContain('Shop');
    expect(header.textContent).toContain('Channel type');
    expect(header.textContent).toContain('Configuration');
    expect(header.textContent).toContain('Connection');
    expect(header.textContent).toContain('External link');
  });

  /** 🔴 `SCS-024.a` — the shop's OWN name identifies the row, not its channel type. */
  it('SCS-024.a the shop name is the primary identity', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByText('Zeon Mart · Daraz')).toBeTruthy());
  });

  /**
   * 🔴 `SCS-024.b` — TWO COLUMNS, TWO CARRIERS. This is the test that fails if anyone
   * collapses configuration and connection into one status.
   */
  it('SCS-024.b configuration and connection are separate and independently valued', async () => {
    stubApi(['system.channel-instance.view'], { content: [SUSPENDED_BUT_CONNECTED] });
    renderWorkspace();

    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(1));
    const row = screen.getByTestId('shop-row');
    expect(within(row).getByTestId('configuration-text').textContent).toBe('SUSPENDED');
    expect(within(row).getByTestId('connection-chip').getAttribute('data-connection')).toBe('CONNECTED');
  });

  /** `SCS-024.c` — absence is stated, never left blank. */
  it('SCS-024.c an unbound shop states that nothing is bound', async () => {
    stubApi(['system.channel-instance.view'], { content: [UNBOUND] });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('external-link').textContent).toBe('Not yet bound'));
  });

  /**
   * 🔴 `SCS-043.a` — AN UNREADABLE CONNECTION IS NOT `NOT_CONNECTED`. The chip says so in the
   * approved words and the row still renders in full.
   */
  it('SCS-043.a an unreadable connection never reads as NOT CONNECTED', async () => {
    stubApi(['system.channel-instance.view'], { content: [{ ...CONNECTED, connection: null }] });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('connection-chip')).toBeTruthy());
    const chip = screen.getByTestId('connection-chip');
    expect(chip.textContent).toBe('CONNECTION UNAVAILABLE');
    expect(chip.textContent).not.toContain('NOT CONNECTED');
    // 🔴 The rest of the row is Trioloo's own record and is still accurate.
    expect(screen.getByText('Zeon Mart · Daraz')).toBeTruthy();
  });

  /** 🔴 `SCS-024.d` — no per-row action menu exists anywhere on this surface. */
  it('SCS-024.d there is no per-row action menu', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));
    expect(screen.queryByTestId('row-action-menu')).toBeNull();
    expect(document.body.textContent).not.toContain('⋯');
  });
});

describe('SCS-020 / SCS-021 — the summary strip', () => {
  it('SCS-020 renders an all-shops card plus one card per channel type present', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('shop-summary-strip')).toBeTruthy());
    const strip = screen.getByTestId('shop-summary-strip');
    expect(strip.textContent).toContain('All shops');
    expect(strip.textContent).toContain('2 channel types');
    expect(screen.getByTestId('summary-card-DARAZ')).toBeTruthy();
    expect(screen.getByTestId('summary-card-WEBSITE')).toBeTruthy();
  });

  it('SCS-021 states the attention count in the approved words', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByTestId('summary-card-DARAZ').textContent).toContain('1 needs attention'),
    );
  });

  /** 🔴 `SCS-020.b` — a condition with no shops produces NO LINE, never a zero. */
  it('SCS-020.b a zero is never rendered as a line', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('summary-card-WEBSITE')).toBeTruthy());
    const website = screen.getByTestId('summary-card-WEBSITE');
    expect(website.textContent).toContain('Connected');
    expect(website.textContent).not.toContain('Connection error');
    expect(website.textContent).not.toContain('Not connected');
    // A zero attention figure is stated by its absence, not by "0 need attention".
    expect(website.textContent).not.toContain('0 need');
  });

  /**
   * 🔴 `SCS-020.c` / `SCS-061` — NO UNBUILT-DOMAIN FIGURE, AND NEVER A ZERO. A zero would be
   * a business claim the system cannot make.
   */
  it('SCS-061 no order, return, message, settlement or listing figure appears', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('shop-summary-strip')).toBeTruthy());
    const text = screen.getByTestId('shop-summary-strip').textContent ?? '';
    for (const forbidden of ['Orders', 'Returns', 'Messages', 'Settlement', 'Listings', 'Revenue']) {
      expect(text).not.toContain(forbidden);
    }
  });

  /** 🔴 `SYS-034` — with the connection unreadable, no attention figure is claimed at all. */
  it('SYS-034 an unreadable connection withholds the attention figure', async () => {
    stubApi(['system.channel-instance.view'], {
      summary: {
        allShops: { channelTypeCount: 1, shopCount: 1, configurationSplit: [{ key: 'ACTIVE', label: 'Active', count: 1 }] },
        channelTypes: [
          { channelType: 'DARAZ', label: 'Daraz', shopCount: 1, attentionCount: null, connectionSplit: [] },
        ],
        connectionKnown: false,
      },
    });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('summary-card-DARAZ')).toBeTruthy());
    const card = screen.getByTestId('summary-card-DARAZ');
    expect(card.textContent).not.toContain('attention');
    expect(card.textContent).toContain('Connection state not available just now.');
  });
});

describe('SCS-022 / SCS-023 — search and filters', () => {
  /** 🔴 `TEC-096` — the SERVER resolves it. The proof is that it reaches the request. */
  it('SCS-022 search becomes a server query parameter', async () => {
    stubApi();
    renderWorkspace();
    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));

    fireEvent.change(screen.getByTestId('shop-search'), { target: { value: 'Zeon' } });
    fireEvent.keyDown(screen.getByTestId('shop-search'), { key: 'Enter' });

    await waitFor(() => expect(requestedUrls.some((url) => url.includes('search=Zeon'))).toBe(true));
  });

  it('SCS-022 the placeholder states the ratified search scope', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByTestId('shop-search').getAttribute('placeholder')).toBe(
        'Search shop name, code or link',
      ),
    );
  });

  it('SCS-023 each filter becomes a server query parameter', async () => {
    stubApi();
    renderWorkspace();
    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));

    fireEvent.change(screen.getByTestId('filter-channel'), { target: { value: 'DARAZ' } });
    await waitFor(() => expect(requestedUrls.some((url) => url.includes('channelType=DARAZ'))).toBe(true));

    fireEvent.change(screen.getByTestId('filter-connection'), { target: { value: 'ERROR' } });
    await waitFor(() => expect(requestedUrls.some((url) => url.includes('connection=ERROR'))).toBe(true));

    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DRAFT' } });
    await waitFor(() => expect(requestedUrls.some((url) => url.includes('configuration=DRAFT'))).toBe(true));
  });

  /** `SCS-023.b` — a count, a removable token, and Clear. */
  it('SCS-023.b active filters are counted, individually removable, and clearable', async () => {
    stubApi();
    renderWorkspace();
    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));

    fireEvent.change(screen.getByTestId('filter-channel'), { target: { value: 'DARAZ' } });
    await waitFor(() => expect(screen.getByTestId('filter-count').textContent).toBe('1 filter'));
    expect(screen.getByTestId('filter-token-channelType').textContent).toContain('Channel: Daraz');

    fireEvent.click(screen.getByTestId('filter-token-channelType'));
    await waitFor(() => expect(screen.queryByTestId('filter-count')).toBeNull());
  });

  /** 🔴 `SCS-023.b` — Clear returns every filter to all and LEAVES SEARCH UNTOUCHED. */
  it('SCS-023.b Clear resets the filters but not the search', async () => {
    stubApi();
    renderWorkspace();
    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));

    fireEvent.change(screen.getByTestId('shop-search'), { target: { value: 'Zeon' } });
    fireEvent.keyDown(screen.getByTestId('shop-search'), { key: 'Enter' });
    fireEvent.change(screen.getByTestId('filter-channel'), { target: { value: 'DARAZ' } });
    await waitFor(() => expect(screen.getByTestId('filter-clear')).toBeTruthy());

    requestedUrls = [];
    fireEvent.click(screen.getByTestId('filter-clear'));

    await waitFor(() => expect(screen.queryByTestId('filter-count')).toBeNull());
    const listCall = requestedUrls.find((url) => url.includes('/api/system/shops?'));
    expect(listCall).toContain('search=Zeon');
    expect(listCall).not.toContain('channelType');
  });

  it('SCS-023.c the result count is matched against total registered', async () => {
    stubApi(['system.channel-instance.view'], { content: [CONNECTED], totalRegistered: 6 });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('result-count').textContent).toBe('Showing 1 of 6 shops'));
  });

  /** 🔴 `SCS-023.d` — no advanced-filter drawer, date filter or saved view exists. */
  it('SCS-023.d no advanced filter, date filter or saved view is offered', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));
    const text = document.body.textContent ?? '';
    for (const forbidden of ['Advanced', 'Saved view', 'Date range', 'More filters']) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('SCS-025 — the four workspace states', () => {
  it('SCS-025.b loading preserves row geometry and guesses no state text', async () => {
    stubApi(['system.channel-instance.view'], { neverResolveList: true });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('shops-loading')).toBeTruthy());
    const skeleton = screen.getByTestId('shops-loading');
    for (const guessed of ['CONNECTED', 'NOT CONNECTED', 'ACTIVE', 'DRAFT']) {
      expect(skeleton.textContent).not.toContain(guessed);
    }
  });

  /**
   * 🔴 `SCS-025.b` — the skeleton must share the populated row's box, or the list JUMPS when
   * the data arrives. jsdom does not lay out, so the structural properties are asserted:
   * the same column tracks, the same padding and the same border.
   */
  it('SCS-025.b the skeleton row shares the populated row box exactly', async () => {
    stubApi(['system.channel-instance.view'], { neverResolveList: true });
    renderWorkspace();
    await waitFor(() => expect(screen.getByTestId('shops-loading')).toBeTruthy());
    const skeleton = (screen.getByTestId('shops-loading').firstElementChild as HTMLElement).style;

    cleanup();
    vi.unstubAllGlobals();
    stubApi(['system.channel-instance.view'], { content: [CONNECTED] });
    renderWorkspace();
    await waitFor(() => expect(screen.getByTestId('shop-row')).toBeTruthy());
    const real = screen.getByTestId('shop-row').style;

    expect(skeleton.gridTemplateColumns).toBe(real.gridTemplateColumns);
    expect(skeleton.padding).toBe(real.padding);
    expect(skeleton.border).toBe(real.border);
    expect(skeleton.gap).toBe(real.gap);
  });

  /** `SCS-025.a` — the empty state EXPLAINS WHAT A SHOP IS and offers Add Shop. */
  it('SCS-025.a the empty state explains what a shop is', async () => {
    stubApi(['system.channel-instance.view', 'system.channel-instance.manage'], { content: [] });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('shops-empty')).toBeTruthy());
    const empty = screen.getByTestId('shops-empty');
    expect(empty.textContent).toContain('No shops registered yet');
    expect(empty.textContent).toContain('one exact account on one marketplace or website');
    // 🔴 Not integration setup. No key, no secret.
    expect(empty.textContent).not.toContain('App Key');
    expect(empty.textContent).not.toContain('Secret');
  });

  /**
   * 🔴 `SCS-025.c` — the failure states that NOTHING CHANGED and that this is a READ failure,
   * so an operator cannot read it as "the shops are gone".
   */
  it('SCS-025.c a retrieval failure says nothing changed and offers Try again', async () => {
    stubApi(['system.channel-instance.view'], { failList: true });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('shops-load-error')).toBeTruthy());
    const error = screen.getByTestId('shops-load-error');
    expect(error.textContent).toContain('Nothing has been changed');
    expect(error.textContent).toContain('read failure, not a sign that shops are missing');
    expect(screen.getByTestId('shops-retry')).toBeTruthy();
  });

  it('SCS-025.c Try again re-runs the read', async () => {
    stubApi(['system.channel-instance.view'], { failList: true });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('shops-retry')).toBeTruthy());
    requestedUrls = [];
    fireEvent.click(screen.getByTestId('shops-retry'));

    await waitFor(() => expect(requestedUrls.some((url) => url.includes('/api/system/shops'))).toBe(true));
  });
});

describe('SCS-050 — permission affordances', () => {
  /** 🔴 An affordance only. `SCS-050.c` — the backend refuses regardless. */
  it('SCS-050 Add Shop is omitted without the manage capability', async () => {
    stubApi(['system.channel-instance.view'], {});
    renderWorkspace();

    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));
    expect(screen.queryByTestId('add-shop')).toBeNull();
  });

  it('SCS-050 Add Shop appears with the manage capability', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('add-shop')).toBeTruthy());
  });

  it('PRM-003 a refused read reports the missing capability rather than an empty list', async () => {
    stubApi(['system.channel-instance.manage'], { forbidList: true });
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('shops-forbidden')).toBeTruthy());
    expect(screen.queryByTestId('shops-empty')).toBeNull();
  });
});

describe('SCS-052 / SCS-053 — what may never appear', () => {
  it('SCS-052 no secret of any kind is rendered', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));
    const text = document.body.textContent ?? '';
    for (const secret of ['App Secret', 'App Key', 'Access token', 'Refresh token', 'Password']) {
      expect(text).not.toContain(secret);
    }
  });

  /** 🔴 `SCS-053` — no delete, and no Product-owned synchronisation act, at any authority. */
  it('SCS-053 no delete, refresh, push or sync control exists on the workspace', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getAllByTestId('shop-row')).toHaveLength(3));
    const text = document.body.textContent ?? '';
    for (const forbidden of ['Delete', 'Refresh', 'Push', 'Sync Now', 'Review & Push']) {
      expect(text).not.toContain(forbidden);
    }
  });
});
