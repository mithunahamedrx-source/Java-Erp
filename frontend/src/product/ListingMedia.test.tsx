import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ListingMediaPage from './ListingMediaPage';

/**
 * FRAME 13 — Manage Media.
 *
 * <p>🔴 The claims under test are the three that make this page truthful: the three media
 * concepts never collapse into one gallery (`PRD-182`), the fallback is DERIVED and never
 * materialised (`PRD-170.b`), and every action is LOCAL (`PRD-185`).
 */

const MASTER = [
  { id: 'm1', mediaAssetId: 'a1', storageReference: 'https://cdn.example/master-1.jpg', role: 'PRIMARY', position: 0, source: 'SELLABLE_MASTER' },
  { id: 'm2', mediaAssetId: 'a2', storageReference: 'https://cdn.example/master-2.jpg', role: 'GALLERY', position: 1, source: 'SELLABLE_MASTER' },
  { id: 'm3', mediaAssetId: 'a3', storageReference: 'opaque-reference-3', role: 'GALLERY', position: 2, source: 'SELLABLE_MASTER' },
];

const REPORTED = [
  { id: 'r1', mediaAssetId: null, storageReference: 'https://daraz.example/1.jpg', role: 'GALLERY', position: 0, source: 'CHANNEL_REPORTED' },
  { id: 'r2', mediaAssetId: null, storageReference: 'https://daraz.example/2.jpg', role: 'GALLERY', position: 1, source: 'CHANNEL_REPORTED' },
];

const LISTING = {
  id: 'L-1',
  channelInstanceId: 'ch-1',
  channelInstance: 'DARAZ-A',
  channelName: 'Daraz account A',
  channelType: 'DARAZ',
  adapterAvailable: false,
  externalListingId: 'DRZ-88121740',
  mappingState: 'MAPPED',
  skuCount: 1,
  mappedSkuCount: 1,
  sellableProductId: 'sp-1',
  mappedSellableSku: 'SP-005512',
  sellableName: 'Vention AACBG HDMI Cable 1.5m',
  intendedTitle: 'Vention AACBG HDMI Cable 1.5m',
  intendedDescription: null,
  intendedTitleBn: null,
  intendedDescriptionBn: null,
  effectiveTitleBn: null,
  effectiveDescriptionBn: null,
  salePrice: '640.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: '640.00',
  promotionActive: false,
  priceIsFrom: false,
  listingStock: '210',
  publicationIntent: 'PUBLISH',
  intendedChannelCategory: null,
  channelReportedTitle: null,
  reportedTitleReadable: true,
  reportedDescription: null,
  reportedDescriptionReadable: true,
  reportedSalePrice: null,
  reportedSalePriceReadable: true,
  reportedPromotionPrice: null,
  reportedPromotionPriceReadable: true,
  reportedPromotionStartsAt: null,
  reportedPromotionEndsAt: null,
  reportedPromotionWindowReadable: true,
  reportedStock: null,
  reportedStockReadable: true,
  reportedChannelCategory: null,
  reportedChannelCategoryReadable: true,
  listingStatus: 'ACTIVE',
  syncState: 'MANUAL_REQUIRED',
  localLifecycle: 'PUBLISHED',
  hasUnsentLocalChanges: false,
  divergedFactCount: 0,
  primaryMediaReference: null,
  highlights: [],
  highlightsAreFallback: true,
  highlightsBn: [],
  effectiveHighlightsBn: [],
  highlightsBnAreFallback: true,
  lastSyncAt: null,
  lastSeenInDiscoveryAt: null,
  lastSuccessfulPushAt: null,
  updatedAt: '2026-08-14T02:41:21Z',
  version: 4,
  skus: [],
};

let sent: { url: string; method: string; body: unknown }[] = [];
let mediaSet: Record<string, unknown>;
let listing: Record<string, unknown>;
let failWrites: string | null = null;

function stubApi(permissions: readonly string[] = [
  'product.channel-listing.view',
  'product.channel-listing.manage',
]): void {
  sent = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET');
    const json = (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (method !== 'GET') {
      sent.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (failWrites) return json({ message: failWrites }, 409);
      return new Response(null, { status: 204 });
    }
    if (url.includes('/api/auth/me')) {
      return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions });
    }
    if (url.includes('/media')) return json(mediaSet);
    if (/\/channel-listings\/[^/]+$/.test(url)) return json(listing);
    return json({});
  }));
}

function setMedia(intended: unknown[], options: Partial<{ master: unknown[]; reported: unknown[]; orderReliable: boolean }> = {}): void {
  const master = options.master ?? MASTER;
  const reported = options.reported ?? REPORTED;
  mediaSet = {
    master,
    intended,
    reported,
    effective: intended.length > 0 ? intended : master,
    effectiveIsFallback: intended.length === 0,
    reportedOrderReliable: options.orderReliable ?? false,
  };
}

function renderMedia(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings/L-1/media']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/:id/media" element={<ListingMediaPage />} />
            <Route path="/inventory/products/listings/:id" element={<div data-testid="landed-on-detail" />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function loaded(): Promise<void> {
  renderMedia();
  await waitFor(() => expect(screen.getByTestId('media-master')).toBeTruthy());
}

/** Every clickable thing on the page whose label offers an OUTBOUND act. */
const outboundControls = (): string[] =>
  [...document.querySelectorAll('button, a')]
    .map((el) => el.textContent?.trim() ?? '')
    .filter((label) => /push|publish/i.test(label));

const override = (n: number): unknown[] => MASTER.slice(0, n).map((m, i) => ({
  ...m, id: `i${i}`, role: i === 0 ? 'PRIMARY' : 'GALLERY', position: i, source: 'LISTING_INTENDED',
}));

beforeEach(() => {
  listing = { ...LISTING };
  failWrites = null;
  setMedia([]);
  stubApi();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// =====================================================================================
// The three media concepts
// =====================================================================================

describe('Frame 13 — three media truths', () => {
  it('shows master, listing intended and marketplace reported as separate sections', async () => {
    await loaded();
    expect(screen.getByTestId('media-master')).toBeTruthy();
    expect(screen.getByTestId('media-intended')).toBeTruthy();
    expect(screen.getByTestId('media-reported')).toBeTruthy();
  });

  it('marks master and reported read-only, and only the listing set editable', async () => {
    await loaded();
    expect(screen.getByTestId('media-master').textContent).toContain('READ ONLY');
    expect(screen.getByTestId('media-reported').textContent).toContain('READ ONLY');
    expect(screen.getByTestId('media-intended').textContent).toContain('EDITABLE');
    expect(screen.getByTestId('media-master').textContent).toContain('Nothing on this page can change them');
  });

  it('names the owning Sellable Product for the master set', async () => {
    await loaded();
    expect(screen.getByTestId('media-master').textContent).toContain('SP-005512');
  });
});

// =====================================================================================
// Effective media and the fallback — PRD-170
// =====================================================================================

describe('Frame 13 — effective media', () => {
  it('falls back to master media when the listing holds no override', async () => {
    await loaded();
    expect(screen.getByTestId('media-fallback').textContent).toContain('Using Sellable Product media');
    expect(screen.getByTestId('media-no-override')).toBeTruthy();
  });

  /** 🔴 `PRD-170.b` — opening the page must not create an override. */
  it('materialises nothing merely by opening the page', async () => {
    await loaded();
    expect(sent).toEqual([]);
    expect(screen.queryByTestId('media-intended-items')).toBeNull();
  });

  it('says the fallback images are what a push would send, shown once', async () => {
    await loaded();
    expect(screen.getByTestId('media-fallback').textContent)
      .toContain('not duplicated into a listing-owned set');
  });

  it('uses the override entirely once one exists, never a merge', async () => {
    setMedia(override(2));
    await loaded();
    expect(screen.queryByTestId('media-fallback')).toBeNull();
    expect(screen.getAllByTestId(/^media-item-\d+$/)).toHaveLength(2);
    // 🔴 ALL-OR-NOTHING: the third master image does not leak into the effective set.
    expect(screen.getByTestId('media-compare-intended').children).toHaveLength(2);
  });

  it('creates an override explicitly, and starts it empty', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('media-create-override'));
    // ⚠ It offers a picker rather than silently copying the master set.
    await waitFor(() => expect(screen.getByTestId('media-picker')).toBeTruthy());
    expect(sent).toEqual([]);
  });
});

// =====================================================================================
// Primary and ordering — PRD-168
// =====================================================================================

describe('Frame 13 — primary and order', () => {
  it('never assigns primary automatically when an image is added', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('media-create-override'));
    await waitFor(() => expect(screen.getByTestId('media-picker')).toBeTruthy());
    fireEvent.click(screen.getByTestId('media-picker-option-0'));

    await waitFor(() => expect(screen.getByTestId('media-item-0')).toBeTruthy());
    expect(screen.getByTestId('media-item-role-0').textContent).toBe('GALLERY');
  });

  it('allows at most one primary and lets it be cleared', async () => {
    setMedia(override(3));
    await loaded();
    expect(screen.getByTestId('media-item-role-0').textContent).toBe('PRIMARY');

    fireEvent.click(screen.getByTestId('media-primary-1'));
    expect(screen.getByTestId('media-item-role-0').textContent).toBe('GALLERY');
    expect(screen.getByTestId('media-item-role-1').textContent).toBe('PRIMARY');

    // 🔴 Primary is OPTIONAL — toggling the same one off leaves none.
    //    Scoped to the LISTING panel: the master panel legitimately shows its own primary.
    fireEvent.click(screen.getByTestId('media-primary-1'));
    for (const index of [0, 1, 2]) {
      expect(screen.getByTestId(`media-item-role-${index}`).textContent).toBe('GALLERY');
    }
  });

  it('states the primary rule where the operator sets one', async () => {
    await loaded();
    expect(screen.getByTestId('media-intended').textContent)
      .toContain('primary is optional and is never assigned automatically');
  });

  /** 🔴 Order is business data and must be reachable without a mouse. */
  it('reorders with keyboard-accessible controls', async () => {
    setMedia(override(3));
    await loaded();
    // ⚠ Compared by REFERENCE, not row text: the row prints its own position, which is
    //   exactly what a reorder changes.
    const reference = (index: number): string =>
      screen.getByTestId(`media-item-${index}`).textContent?.match(/master-\d\.jpg|opaque-\S+/)?.[0] ?? '';
    const wasFirst = reference(0);
    fireEvent.click(screen.getByTestId('media-down-0'));
    expect(reference(1)).toBe(wasFirst);
  });

  it('labels each reorder control for assistive technology', async () => {
    setMedia(override(2));
    await loaded();
    expect(screen.getByTestId('media-up-1').getAttribute('aria-label')).toBe('Move image 2 earlier');
    expect(screen.getByTestId('media-down-0').getAttribute('aria-label')).toBe('Move image 1 later');
  });

  it('disables the reorder controls at the ends of the set', async () => {
    setMedia(override(2));
    await loaded();
    expect((screen.getByTestId('media-up-0') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('media-down-1') as HTMLButtonElement).disabled).toBe(true);
  });

  it('persists the explicit order in the saved sequence', async () => {
    setMedia(override(3));
    await loaded();
    fireEvent.click(screen.getByTestId('media-down-0'));
    fireEvent.click(screen.getByTestId('media-save'));

    await waitFor(() => expect(sent.length).toBe(1));
    const body = sent[0]!.body as { items: { mediaAssetId: string }[] };
    expect(body.items.map((i) => i.mediaAssetId)).toEqual(['a2', 'a1', 'a3']);
  });
});

// =====================================================================================
// Reported media — read-only, and unreadable is not empty
// =====================================================================================

describe('Frame 13 — marketplace reported', () => {
  it('offers no way to edit reported media', async () => {
    await loaded();
    const reported = screen.getByTestId('media-reported');
    expect(reported.querySelectorAll('button')).toHaveLength(0);
  });

  /** 🔴 `SYS-034` — unreadable is NOT empty, and neither is never-read. */
  it('says media is not readable rather than absent when no adapter exists', async () => {
    setMedia([], { reported: [] });
    await loaded();
    expect(screen.getByTestId('media-reported-grid-empty').textContent)
      .toBe('Not readable from this channel');
    expect(screen.getByTestId('media-reported').textContent).toContain('cannot be read');
  });

  it('distinguishes never-read from returned-nothing when an adapter exists', async () => {
    listing = { ...LISTING, adapterAvailable: true };
    setMedia([], { reported: [] });
    await loaded();
    expect(screen.getByTestId('media-reported-grid-empty').textContent)
      .toBe('Not read from this channel yet');

    cleanup();
    listing = { ...LISTING, adapterAvailable: true, lastSyncAt: '2026-08-14T02:41:21Z' };
    setMedia([], { reported: [] });
    await loaded();
    expect(screen.getByTestId('media-reported-grid-empty').textContent)
      .toBe('The channel returned no images');
  });

  it('warns that the reported order is not guaranteed', async () => {
    await loaded();
    expect(screen.getByTestId('media-reported').textContent)
      .toContain('which this channel does not guarantee');
  });
});

// =====================================================================================
// Comparison — PRD-183
// =====================================================================================

describe('Frame 13 — media comparison', () => {
  /** 🔴 Never a divergence built on an ordering the channel does not promise. */
  it('reports MANUAL REQUIRED when the order cannot be trusted', async () => {
    await loaded();
    expect(screen.getByTestId('media-comparison-state').textContent).toBe('MANUAL REQUIRED');
    expect(screen.getByTestId('media-comparison').textContent).not.toContain('DIVERGED');
  });

  it('says a missing adapter is a missing capability, not a difference', async () => {
    await loaded();
    expect(screen.getByTestId('media-comparison').textContent)
      .toContain('This is a missing capability, not a difference');
  });

  it('claims a deterministic comparison only where the order is reliable', async () => {
    setMedia([], { orderReliable: true });
    listing = { ...LISTING, adapterAvailable: true, lastSyncAt: '2026-08-14T02:41:21Z' };
    await loaded();
    expect(screen.getByTestId('media-comparison-state').textContent).toBe('DETERMINISTIC');
  });

  it('never claims ordering differences on an unreliable channel', async () => {
    await loaded();
    expect(screen.getByTestId('media-comparison').textContent)
      .toContain('Ordering differences alone are not claimed on this channel');
  });

  it('states that Accept Marketplace never modifies master media', async () => {
    await loaded();
    expect(screen.getByTestId('media-comparison').textContent)
      .toContain('Sellable Product master media is never modified');
  });

  it('cannot accept marketplace media when the channel reported none', async () => {
    setMedia([], { reported: [] });
    await loaded();
    expect((screen.getByTestId('media-accept-marketplace') as HTMLButtonElement).disabled).toBe(true);
  });
});

// =====================================================================================
// Local-only — PRD-185
// =====================================================================================

describe('Frame 13 — every action is local', () => {
  it('says so, on the page', async () => {
    await loaded();
    expect(screen.getByTestId('media-local-note').textContent)
      .toContain('Changes are saved to this listing only');
  });

  it('saves media with one local PUT and nothing else', async () => {
    setMedia(override(2));
    await loaded();
    fireEvent.click(screen.getByTestId('media-remove-1'));
    fireEvent.click(screen.getByTestId('media-save'));

    await waitFor(() => expect(sent.length).toBe(1));
    expect(sent[0]!.method).toBe('PUT');
    expect(sent[0]!.url).toContain('/channel-listings/L-1/media');
    for (const forbidden of ['/operations', '/publish', '/refresh', '/sync']) {
      expect(sent[0]!.url).not.toContain(forbidden);
    }
  });

  it('works with no adapter configured', async () => {
    setMedia(override(2));
    await loaded();
    expect((screen.getByTestId('media-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('media-down-0'));
    // 🔴 A missing adapter never blocks local media work (§34).
    expect((screen.getByTestId('media-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('never offers Save & Push, Push or Publish on this page', async () => {
    setMedia(override(2));
    await loaded();
    expect(outboundControls()).toEqual([]);
  });

  /** ⚠ And not in the fallback state either, where the word "push" does appear in prose. */
  it('offers no outbound control in the fallback state', async () => {
    await loaded();
    expect(screen.getByTestId('media-fallback').textContent).toContain('sent on the next push');
    expect(outboundControls()).toEqual([]);
  });

  /** 🔴 Clearing the override is an explicit, confirmed act with a stated consequence. */
  it('confirms before returning to the master set', async () => {
    setMedia(override(2));
    await loaded();
    fireEvent.click(screen.getByTestId('media-clear-override'));

    await waitFor(() => expect(screen.getByTestId('media-clear-dialog')).toBeTruthy());
    const dialog = screen.getByTestId('media-clear-dialog').textContent ?? '';
    expect(dialog).toContain('use the Sellable Product master media');
    expect(dialog).toContain('Sellable Product media is not changed');
    expect(sent).toEqual([]);
  });

  it('clears the override by sending an empty set', async () => {
    setMedia(override(2));
    await loaded();
    fireEvent.click(screen.getByTestId('media-clear-override'));
    await waitFor(() => expect(screen.getByTestId('media-clear-dialog')).toBeTruthy());
    const buttons = [...screen.getByTestId('media-clear-dialog').querySelectorAll('button')];
    fireEvent.click(buttons[buttons.length - 1]!);

    await waitFor(() => expect(sent.length).toBe(1));
    expect((sent[0]!.body as { items: unknown[] }).items).toEqual([]);
  });
});

// =====================================================================================
// Permissions
// =====================================================================================

describe('Frame 13 — authority', () => {
  it('lets a view-only operator see media but change nothing', async () => {
    stubApi(['product.channel-listing.view']);
    setMedia(override(2));
    await loaded();

    expect(screen.getByTestId('media-master')).toBeTruthy();
    expect(screen.getByTestId('media-view-only')).toBeTruthy();
    expect(screen.queryByTestId('media-save')).toBeNull();
    expect(screen.queryByTestId('media-add')).toBeNull();
    expect(screen.queryByTestId('media-create-override')).toBeNull();
    expect(screen.getByTestId('media-intended').textContent).toContain('READ ONLY');
  });

  /** 🔴 `PRD-196.a` — organising local media never requires publish authority. */
  it('lets manage alone do the whole job', async () => {
    setMedia(override(2));
    await loaded();
    expect(screen.getByTestId('media-save')).toBeTruthy();
    expect(screen.queryByTestId('media-push')).toBeNull();
  });

  /**
   * 🔴 NO PUSH ON THIS PAGE, AT ANY AUTHORITY. Frame 13 manages LOCAL intended media; an
   * outbound act sitting beside the media editor invites the belief that saving publishes.
   */
  it('never offers Push, even to an operator holding publish authority', async () => {
    stubApi(['product.channel-listing.view', 'product.channel-listing.manage', 'product.channel-listing.publish']);
    setMedia(override(2));
    await loaded();

    expect(screen.queryByTestId('media-push')).toBeNull();
    /*
      ⚠ Asserted on CONTROLS, not prose. The fallback panel legitimately says "sent on the
      next push" as an explanation; what must not exist is anything clickable that does it.
    */
    expect(outboundControls()).toEqual([]);
    // The local controls are all still there.
    expect(screen.getByTestId('media-save')).toBeTruthy();
    expect(screen.getByTestId('media-accept-marketplace')).toBeTruthy();
  });

  /**
   * 🔴 `UX-269` — NO INK FRAME ON AN ORDINARY PANEL. All three columns share the neutral
   * container border; editability is carried by the badge, the controls and the helper text.
   */
  it('gives all three panels the same neutral container border', async () => {
    setMedia(override(2));
    await loaded();

    for (const id of ['media-master', 'media-intended', 'media-reported']) {
      const panel = screen.getByTestId(id);
      expect(panel.style.border).toContain('var(--color-border-card)');
      expect(panel.style.border).not.toContain('var(--color-ink)');
      expect(panel.style.boxShadow).toBe('');
    }
  });

  /** ⚠ And the distinction survives without it. */
  it('still separates editable from read-only without a frame', async () => {
    setMedia(override(2));
    await loaded();

    expect(screen.getByTestId('media-intended').textContent).toContain('EDITABLE');
    expect(screen.getByTestId('media-master').textContent).toContain('READ ONLY');
    expect(screen.getByTestId('media-reported').textContent).toContain('READ ONLY');
    // Only the editable column carries controls.
    expect(screen.getByTestId('media-master').querySelectorAll('button')).toHaveLength(0);
    expect(screen.getByTestId('media-reported').querySelectorAll('button')).toHaveLength(0);
    expect(screen.getByTestId('media-intended').querySelectorAll('button').length).toBeGreaterThan(0);
  });
});

// =====================================================================================
// Failure and thumbnails
// =====================================================================================

describe('Frame 13 — failure and rendering', () => {
  it('keeps the operator’s work when a save fails', async () => {
    failWrites = 'This listing was changed by someone else. Reload and try again.';
    setMedia(override(3));
    await loaded();
    fireEvent.click(screen.getByTestId('media-down-0'));
    fireEvent.click(screen.getByTestId('media-save'));

    await waitFor(() => expect(screen.getByTestId('media-error')).toBeTruthy());
    expect(screen.getByTestId('media-error').textContent).toContain('changed by someone else');
    // 🔴 The reordering survives, so a retry does not mean redoing the work.
    expect(screen.getAllByTestId(/^media-item-\d+$/)).toHaveLength(3);
    expect((screen.getByTestId('media-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('says the media could not be loaded rather than showing a blank editor', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions: ['product.channel-listing.view', 'product.channel-listing.manage'] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ message: 'You cannot read this Listing.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }));
    renderMedia();
    await waitFor(() => expect(screen.getByText(/could not be loaded/i)).toBeTruthy());
    expect(screen.queryByTestId('media-intended')).toBeNull();
  });

  /** 🔴 An unrenderable reference gets the neutral block — never a broken-image glyph. */
  it('draws the canonical neutral block for a non-renderable reference', async () => {
    setMedia([]);
    await loaded();
    const neutral = screen.getAllByTestId('media-thumb-neutral');
    // `opaque-reference-3` is not a URL, so it can only be the neutral block.
    expect(neutral.length).toBeGreaterThan(0);
    expect(neutral[0]!.getAttribute('title')).toBeTruthy();
  });

  it('offers no uploader, because no storage provider exists', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('media-create-override'));
    await waitFor(() => expect(screen.getByTestId('media-picker')).toBeTruthy());
    // 🔴 `TEC-105` — a file input here would accept bytes nothing could persist.
    expect(screen.getByTestId('media-picker').querySelector('input[type="file"]')).toBeNull();
  });

  it('says plainly that images cannot be uploaded when nothing is left to add', async () => {
    setMedia(override(3));
    await loaded();
    fireEvent.click(screen.getByTestId('media-add'));
    await waitFor(() => expect(screen.getByTestId('media-picker-empty')).toBeTruthy());
    expect(screen.getByTestId('media-picker-empty').textContent)
      .toContain('no media upload yet');
  });
});
