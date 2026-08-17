import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ProductWorkspace from './ProductWorkspace';
import ChannelListingsPage from './ChannelListingsPage';
import { ChannelListingCard } from './ChannelListingCard';
import type { ChannelListing, ChannelListingSummary } from './channelListingApi';

const LISTING: ChannelListing = {
  id: '11111111-1111-1111-1111-111111111111',
  channelInstanceId: '33333333-3333-3333-3333-333333333333',
  channelInstance: 'DARAZ-A',
  channelName: 'Daraz account A',
  channelType: 'DARAZ',
  adapterAvailable: false,
  externalListingId: '88231',
  mappingState: 'MAPPED',
  skuCount: 1,
  mappedSkuCount: 1,
  sellableProductId: '22222222-2222-2222-2222-222222222222',
  mappedSellableSku: 'SEL-PC-1',
  sellableName: 'Gaming PC',
  intendedTitle: 'Gaming PC listing title with enough text to test truncation without wrapping',
  intendedDescription: null,
  intendedTitleBn: null,
  intendedDescriptionBn: null,
  effectiveTitleBn: 'Gaming PC listing title with enough text to test truncation without wrapping',
  effectiveDescriptionBn: null,
  salePrice: '32500.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: '32500.00',
  promotionActive: false,
  priceIsFrom: false,
  listingStock: '12',
  publicationIntent: 'PUBLISH',
  intendedChannelCategory: null,
  channelReportedTitle: 'Reported title',
  reportedTitleReadable: true,
  reportedDescription: null,
  reportedDescriptionReadable: false,
  reportedSalePrice: null,
  reportedSalePriceReadable: false,
  reportedPromotionPrice: null,
  reportedPromotionPriceReadable: false,
  reportedPromotionStartsAt: null,
  reportedPromotionEndsAt: null,
  reportedPromotionWindowReadable: false,
  reportedStock: null,
  reportedStockReadable: false,
  reportedChannelCategory: null,
  reportedChannelCategoryReadable: false,
  listingStatus: 'ACTIVE',
  syncState: 'DIVERGED',
  localLifecycle: 'PUBLISHED',
  hasUnsentLocalChanges: true,
  divergedFactCount: 1,
  primaryMediaReference: null,
  highlights: [],
  highlightsAreFallback: true,
  highlightsBn: [],
  effectiveHighlightsBn: [],
  highlightsBnAreFallback: true,
  lastSyncAt: '2026-08-12T00:00:00Z',
  lastSeenInDiscoveryAt: null,
  lastSuccessfulPushAt: null,
  updatedAt: '2026-08-12T00:00:00Z',
  version: 0,
  skus: [],
};

/** 🔴 An UNMAPPED, never-published Listing — a first-class state, not an error. */
const UNMAPPED: ChannelListing = {
  ...LISTING,
  id: '44444444-4444-4444-4444-444444444444',
  // ⚠ A real orderable SKU: `INV-106.1` — every listing has at least one, and the mapping
  //   workflow attaches to it rather than to the listing.
  skus: [{
    id: 'sku-unmapped-1', channelSku: 'ZM-MON-19', sellableProductId: null, sellableSku: null,
    sellableName: null, salePrice: '8450.00', promotionPrice: null, promotionStartsAt: null,
    promotionEndsAt: null, effectiveSellingPrice: '8450.00', promotionActive: false,
    listingStock: '4', reportedSalePrice: null, reportedSalePriceReadable: true,
    reportedPromotionPrice: null, reportedPromotionPriceReadable: true,
    reportedPromotionStartsAt: null, reportedPromotionEndsAt: null,
    reportedPromotionWindowReadable: true, reportedStock: null, reportedStockReadable: true,
    packageWeightKg: null, packageLengthCm: null, packageWidthCm: null, packageHeightCm: null,
    packageContent: null, variationLabel: null, position: 0,
  }],
  externalListingId: null,
  mappingState: 'UNMAPPED',
  mappedSkuCount: 0,
  sellableProductId: null,
  mappedSellableSku: null,
  sellableName: null,
  // 🔴 A Listing the channel has never seen cannot have a channel-reported status.
  listingStatus: null,
  syncState: 'PENDING',
  localLifecycle: 'DRAFT',
  hasUnsentLocalChanges: false,
};

const SUMMARY: ChannelListingSummary = {
  totalListings: 1,
  unmappedListings: 1,
  divergedListings: 1,
  unsentChangeListings: 1,
  manualRequiredListings: 0,
};

function stubApi(
  permissions: readonly string[] = ['product.channel-listing.view', 'product.channel-listing.manage'],
  options: {
    readonly content?: readonly ChannelListing[];
    readonly channels?: readonly unknown[];
    readonly failList?: boolean;
    readonly neverResolveList?: boolean;
    readonly summary?: ChannelListingSummary;
    readonly totalElements?: number;
  } = {},
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown): Response =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/me')) {
        return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions });
      }
      if (url.includes('/summary')) return json(options.summary ?? SUMMARY);
      if (url.includes('/selection-scope'))
        return json({
          listingIds: ['a', 'b', 'c', 'd', 'e'],
          channelNames: ['Daraz account A', 'Trioloo Website'],
          byChannel: [
            { channelName: 'Daraz account A', selected: 3 },
            { channelName: 'Trioloo Website', selected: 2 },
          ],
        });
      if (url.includes('/channels')) return json(options.channels ?? []);
      if (url.includes('/channel-listings')) {
        if (options.neverResolveList) return new Promise<Response>(() => {});
        if (options.failList) return new Response('{"message":"upstream down"}', { status: 500 });
        const content = options.content ?? [LISTING];
        return json({
          content,
          page: 0,
          size: 50,
          totalElements: options.totalElements ?? content.length,
          totalPages: content.length === 0 ? 0 : 1,
        });
      }
      return json({});
    }),
  );
}

function renderListings(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products" element={<ProductWorkspace />}>
              <Route path="listings" element={<ChannelListingsPage />} />
            </Route>
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

describe('Channel Listings workspace', () => {
  it('renders Listings as the active Product tab with cards and no primary table', async () => {
    stubApi();
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    const tabs = screen.getByTestId('product-entity-tabs');
    expect(within(tabs).getByTestId('product-tab-Listings').getAttribute('style')).toContain('--elevation-active-tab');
    expect(document.querySelectorAll('table, thead, tbody, tr, td')).toHaveLength(0);
    expect(screen.getByTestId('channel-listing-card-88231')).toBeTruthy();
    // Frame 01 shows the shop name in the Channel / Shop column.
    expect(screen.getByTestId('listing-channel').textContent).toContain('Daraz account A');
    expect(screen.getByTestId('listing-external-id').textContent).toContain('88231');
    expect(screen.getByTestId('listing-sellable').textContent).toContain('SEL-PC-1');
    // BDT display formatting — grouped, symbol-prefixed, zero fraction dropped.
    expect(screen.getByTestId('listing-sale-price').textContent).toContain('৳ 32,500');
    // 🔴 PRD-199.d — with no promotion running the effective price IS the Sale Price, and
    // no reference line is drawn beneath it.
    expect(screen.queryByTestId('listing-price-note')).toBeNull();
    expect(screen.getByTestId('listing-status').textContent).toContain('ACTIVE');
  });

  it('renders the five ratified summary facts and manage-only header actions', async () => {
    stubApi(['product.channel-listing.view']);
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-summary-strip')).toBeTruthy());
    expect(screen.getByTestId('listing-summary-strip').children).toHaveLength(5);
    expect(screen.getByTestId('summary-total-listings').textContent).toContain('Total Listings');
    expect(screen.getByTestId('summary-unmapped-listings').textContent).toContain('Unmapped');
    expect(screen.getByTestId('summary-diverged-listings').textContent).toContain('Diverged');
    expect(screen.getByTestId('summary-unsent-listings').textContent).toContain('Unsent Local Changes');

    // 🔴 Frame 01 surface: white tile, hairline border, 10px radius, NO elevation. The white
    // must be declared — an unset background inherits the tinted page ground and the card
    // loses its separation.
    for (const key of ['total-listings', 'unmapped-listings', 'diverged-listings', 'unsent-listings', 'manual-required-listings']) {
      const tile = screen.getByTestId(`summary-${key}`).getAttribute('style') ?? '';
      expect(tile).toContain('background: var(--color-surface)');
      expect(tile).toContain('border: 1px solid var(--color-border-card)');
      expect(tile).toContain('border-radius: var(--radius-card-small)');
      expect(tile).not.toContain('box-shadow');
      expect(tile).not.toContain('elevation');
    }
    expect(screen.getByTestId('listing-export-csv')).toBeTruthy();
    expect(screen.queryByTestId('listing-import-csv')).toBeNull();
    expect(screen.queryByTestId('create-channel-listing')).toBeNull();
  });

  /**
   * 🔴 THE LOCKED PAGE-HEADER ACTION REGION.
   *
   * <p>Export · Import · Sync Now · Add Listing, in that order, with the single dark primary
   * rightmost. "Sync" and "Create Listing" are NOT the approved labels — this pins them out
   * so they cannot drift back in.
   */
  it('renders the locked page-header actions with semantic icons', async () => {
    stubApi([
      'product.channel-listing.view',
      'product.channel-listing.manage',
      'product.channel-listing.publish',
    ]);
    renderListings();

    // The header actions are published once the session resolves, so wait for the primary.
    await waitFor(() => expect(screen.getByTestId('create-channel-listing')).toBeTruthy());
    const exportAction = screen.getByTestId('listing-export-csv');
    const importAction = screen.getByTestId('listing-import-csv');
    const syncAction = screen.getByTestId('listing-sync-now');
    const addAction = screen.getByTestId('create-channel-listing');

    expect(exportAction.textContent).toBe('Export');
    expect(importAction.textContent).toBe('Import');
    expect(syncAction.textContent).toBe('Sync Now');
    expect(addAction.textContent).toBe('Add Listing');

    // 🔴 The superseded labels must never return.
    expect(syncAction.textContent).not.toBe('Sync');
    expect(addAction.textContent).not.toContain('Create');

    // Every action carries a semantic Lucide glyph, not a typed character.
    for (const action of [exportAction, importAction, syncAction, addAction]) {
      expect(action.querySelector('svg')).toBeTruthy();
    }

    // 🔴 Exactly ONE dark primary, and it is last in the region.
    const region = addAction.parentElement;
    const actions = [...(region?.children ?? [])];
    expect(actions[actions.length - 1]).toBe(addAction);
    expect(addAction.getAttribute('style')).not.toEqual(exportAction.getAttribute('style'));
  });

  /**
   * 🔴 `PRD-196.a` — MANAGE NEVER IMPLIES PUBLISH. The push action must not appear for an
   * operator who only holds manage. The backend refuses it regardless, but showing it would
   * promise authority the operator does not have.
   */
  it('does not offer Push updates to an operator holding only manage', async () => {
    stubApi(['product.channel-listing.view', 'product.channel-listing.manage']);
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    screen.getByTestId('listing-select').click();
    await waitFor(() => expect(screen.getByTestId('listing-selection-bar')).toBeTruthy());
    expect(screen.queryByTestId('listing-batch-push')).toBeNull();
    expect(screen.queryByTestId('listing-batch-refresh')).toBeNull();
    expect(screen.getByTestId('listing-batch-edit')).toBeTruthy();
  });

  it('offers Push updates once publish authority is held', async () => {
    stubApi([
      'product.channel-listing.view',
      'product.channel-listing.manage',
      'product.channel-listing.publish',
    ]);
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    screen.getByTestId('listing-select').click();
    await waitFor(() => expect(screen.getByTestId('listing-batch-push')).toBeTruthy());
  });

  it('keeps long Listing titles within the operational row composition', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    const card = screen.getByTestId('channel-listing-card-88231');
    expect(card.getAttribute('style')).toContain('width: 100%');
    expect(card.getAttribute('style')).toContain('min-width: 0');
    // 🔴 A structured operational row is a FIXED grid. It cannot wrap, because a grid with a
    // declared column template has nowhere to wrap to — which is stronger than nowrap on a
    // flex row and is what Frame 01 specifies.
    expect(card.getAttribute('style')).toContain('display: grid');
    expect(card.getAttribute('style')).toContain('grid-template-columns');
    expect(screen.getByTestId('listing-title').getAttribute('style')).toContain('text-overflow: ellipsis');
  });

  /**
   * 🔴 The row must never grow wider than its own box.
   *
   * ⚠ A flex item defaults to `min-width: auto` and refuses to shrink below its content. The
   * title cell is the only flexible one, so if it carries any minimum the row overflows and
   * clips the row action — which is exactly what happened before this was pinned. There is no
   * component-level horizontal scroller to hide it behind.
   */
  it('lets the flexible Listing cell shrink so the row never exceeds its own box', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    // Frame 01 gives the Listing column `minmax(0, 2.4fr)`. The `0` minimum is load-bearing:
    // a grid track defaults to `auto`, refuses to shrink below its content, and would push
    // the row past its own box and clip the row action.
    const card = screen.getByTestId('channel-listing-card-88231');
    expect(card.getAttribute('style')).toContain('minmax(0, 2.4fr)');
    expect(screen.getByTestId('listing-title').parentElement?.getAttribute('style')).toContain('min-width: 0');
  });

  /**
   * 🔴 `RULE 3.3.d` — integration states now take their RATIFIED SEMANTIC ROLE, and the text
   * label remains MANDATORY (`RULE 8.4`).
   *
   * <p>⚠ SUPERSEDES the v1 assertion that this chip is monochrome: `RULE 3.14.a.b`'s neutral
   * holding pattern waited for exactly this mapping. `DIVERGED` is WARNING because `SYS-026`
   * makes it a recoverable exception owing the operator a decision — never `danger`.
   */
  it('carries integration state in its semantic role with a mandatory label', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    const diverged = screen.getByTestId('listing-state-diverged');
    expect(diverged.textContent).toContain('DIVERGED');
    // 🔴 The WARNING role, from the shared token — never a page-local colour.
    const style = diverged.getAttribute('style') ?? '';
    expect(style).toContain('--color-semantic-warning');
    // 🔴 Mapped by MEANING: a recoverable exception is not a failure.
    for (const wrong of ['semantic-danger', 'semantic-success']) {
      expect(style).not.toContain(wrong);
    }
  });

  /**
   * 🔴 `PRD-185.d` — an unsent local change is a SEPARATE fact from the sync state and is
   * shown separately. Merging them would tell the operator the ERP owes the channel an
   * attempt when it does not.
   */
  it('shows unsent local changes separately from the sync state', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    // 🔴 Two SEPARATE carriers in the State column, weighted differently — never merged
    // into one verdict.
    expect(screen.getByTestId('listing-unsent').textContent).toContain('UNSENT');
    expect(screen.getByTestId('listing-state-diverged').textContent).toContain('DIVERGED');
    // 🔴 The cell is height-bounded, so coexisting states can never grow the row.
    expect(screen.getByTestId('listing-state').getAttribute('style')).toContain('height: 38px');
  });

  /**
   * 🔴 `PRD-178` / `PRD-188.b` — an unmapped, never-published Listing renders as a normal
   * row that states both facts plainly. Neither is a blank cell and neither is an error.
   */
  it('renders an unmapped, unpublished Listing as a first-class row', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={UNMAPPED} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-external-id').textContent).toContain('Not published');
    // Frame 01 carries mapping in the Sellable Product column as its own dashed carrier,
    // not as one more pill in a chain.
    expect(screen.getByTestId('listing-unmapped').textContent).toContain('UNMAPPED');
    // With no channel-reported status, the ERP lifecycle stands in the status slot rather
    // than leaving a blank that would read as "the channel says nothing is wrong".
    expect(screen.getByTestId('listing-status').textContent).toContain('DRAFT');
  });

  /**
   * 🔴 `PRD-199.d` — THE EFFECTIVE PRICE IS PRIMARY. It is what the customer actually pays
   * right now, so it keeps the full type size while the price it was reduced from is the
   * demoted reference line.
   */
  it('gives the effective price primary emphasis and the base price secondary', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={{
          ...LISTING,
          promotionPrice: '29900.00',
          promotionStartsAt: '2026-08-20T00:00:00Z',
          promotionEndsAt: '2026-08-31T23:59:00Z',
          effectiveSellingPrice: '29900.00',
          promotionActive: true,
        }} />
      </MemoryRouter>,
    );
    const effective = screen.getByTestId('listing-sale-price');
    const note = screen.getByTestId('listing-price-note');
    expect(effective.textContent).toBe('৳ 29,900');
    expect(note.textContent).toBe('was ৳ 32,500');
    // The reference line is smaller and demoted; the effective price inherits the cell weight.
    expect(note.getAttribute('style')).toContain('font-size: 10.5px');
    expect(note.getAttribute('style')).toContain('--color-placeholder');
    expect(effective.getAttribute('style')).toBeNull();
  });

  /**
   * 🔴 `PRD-199.d` — the workspace shows what a customer would pay RIGHT NOW. With no
   * promotion running that is the Sale Price, and no reference line is drawn: repeating the
   * figure would imply a saving that does not exist.
   */
  it('shows the Sale Price and no reference line when no promotion is running', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-sale-price').textContent).toBe('৳ 32,500');
    expect(screen.queryByTestId('listing-price-note')).toBeNull();
  });

  /**
   * 🔴 `PRD-199.d` — while the window is OPEN the effective price is the promotion, and
   * the base price is shown as what it was reduced from.
   */
  it('shows the promotion price while the promotion is running', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={{
          ...LISTING,
          promotionPrice: '29900.00',
          promotionStartsAt: '2026-08-20T00:00:00Z',
          promotionEndsAt: '2026-08-31T23:59:00Z',
          effectiveSellingPrice: '29900.00',
          promotionActive: true,
        }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-sale-price').textContent).toBe('৳ 29,900');
    expect(screen.getByTestId('listing-price-note').textContent).toContain('was ৳ 32,500');
  });

  /**
   * ⚠ SCHEDULED IS NOT RUNNING. A promotion that has not started must not show its price as
   * what the customer pays — that would misquote the shop.
   */
  it('keeps a scheduled promotion out of the effective price', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={{
          ...LISTING,
          promotionPrice: '29900.00',
          promotionStartsAt: '2026-09-20T00:00:00Z',
          promotionEndsAt: '2026-09-30T23:59:00Z',
          effectiveSellingPrice: '32500.00',
          promotionActive: false,
        }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-sale-price').textContent).toBe('৳ 32,500');
    expect(screen.getByTestId('listing-price-note').textContent).toContain('promo scheduled');
    expect(screen.getByTestId('listing-price-note').textContent).not.toContain('was');
  });

  /** ⚠ A promotion equal to the base price offers no reduction, so none is claimed. */
  it('claims no reduction when the promotion equals the Sale Price', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={{
          ...LISTING,
          promotionPrice: '32500',
          effectiveSellingPrice: '32500.00',
          promotionActive: true,
        }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-price-note').textContent).not.toContain('was');
  });

  /** 🔴 `PRD-199.f` — MRP is not a Listing price and never appears on the card. */
  it('never shows MRP, Regular Price or Discount Price', () => {
    const { container } = render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    for (const retired of ['MRP', 'Regular Price', 'Discount Price']) {
      expect(container.textContent).not.toContain(retired);
    }
  });

  // ===================================================================================
  // FRAME 02 — Listing card anatomy
  // ===================================================================================

  /**
   * 🔴 Frame 02 — "At most one exception chip per row; DIVERGED outranks MANUAL REQUIRED."
   * The two can never both be true, because `syncState` is a single enum value.
   */
  it('renders at most one exception chip, with DIVERGED as the strongest carrier', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-state-diverged').textContent).toBe('DIVERGED · 1');
    expect(screen.queryByTestId('listing-state-manual')).toBeNull();
    // DIVERGED stays the heaviest carrier — now by its semantic role at weight 800.
    const style = screen.getByTestId('listing-state-diverged').getAttribute('style') ?? '';
    expect(style).toContain('--color-semantic-warning');
    expect(style).toContain('font-weight: 800');
  });

  /** 🔴 MANUAL REQUIRED is a NORMAL condition, so its carrier stays weaker than DIVERGED. */
  it('gives MANUAL REQUIRED a lighter carrier than DIVERGED', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={{ ...LISTING, syncState: 'MANUAL_REQUIRED', hasUnsentLocalChanges: false }} />
      </MemoryRouter>,
    );
    const style = screen.getByTestId('listing-state-manual').getAttribute('style') ?? '';
    // 🔴 `SYS-025` — a NORMAL state needing a person: warning, and explicitly NOT danger.
    expect(style).toContain('--color-semantic-warning');
    expect(style).not.toContain('semantic-danger');
    // Still the lighter of the two carriers: no weight-800 emphasis.
    expect(style).not.toContain('font-weight: 800');
  });

  /** 🔴 Frame 02 — a DIVERGED listing also takes the ink border on the card itself. */
  /**
   * 🔴 `UX-269` — THE CONTAINER BORDER IS NEUTRAL WHATEVER THE RECORD SAYS. A DIVERGED row is
   * not an error box; its strength lives in the state carrier, which is where state is read.
   */
  it('gives a diverged card the ordinary neutral container border', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    const card = screen.getByTestId('channel-listing-card-88231').getAttribute('style') ?? '';
    expect(card).toContain('1px solid var(--color-border-card)');
    expect(card).not.toContain('var(--color-ink)');
  });

  /** 🔴 DIVERGED loses no strength: the chip keeps the 1.5px ink boundary and weight 800. */
  it('keeps DIVERGED strongest through its own state carrier', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    const chip = screen.getByTestId('listing-state-diverged');
    expect(chip.textContent).toContain('DIVERGED');
    expect(chip.getAttribute('style')).toContain('--color-semantic-warning');
    expect(chip.style.fontWeight).toBe('800');
  });

  /** 🔴 Frame 02 — status is uppercase caps with NO container; sync is quiet metadata. */
  it('carries status as bare caps and sync state as quiet metadata', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={{ ...LISTING, syncState: 'SYNCED', hasUnsentLocalChanges: false }} />
      </MemoryRouter>,
    );
    const status = screen.getByTestId('listing-status');
    expect(status.textContent).toBe('ACTIVE');
    /*
      🔴 STILL BARE CAPS. Frame 02's form is LOCKED, so the semantic role is carried by the
      FOREGROUND only — a tint or border here would change geometry rather than tone.
    */
    const statusStyle = status.getAttribute('style') ?? '';
    expect(statusStyle).not.toContain('border');
    expect(statusStyle).not.toContain('background');
    // ✅ ACTIVE is live on the channel — the success role, as text colour.
    expect(statusStyle).toContain('--color-semantic-success-fg');
    expect(screen.getByTestId('listing-sync-state').getAttribute('style')).toContain('font-size: 11px');
  });

  /**
   * 🔴 `PRD-128` — publication intent is Trioloo's own decision, shown only when it is NOT
   * the ordinary published intent. The common case carries no chip at all.
   */
  it('shows a publication-intent chip only when the intent is not published', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ChannelListingCard item={{ ...LISTING, publicationIntent: 'PUBLISH' }} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('listing-publication-intent')).toBeNull();
    unmount();

    render(
      <MemoryRouter>
        <ChannelListingCard item={{ ...LISTING, publicationIntent: 'HOLD' }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-publication-intent').textContent).toBe('HOLD');
  });

  /** 🔴 Frame 02 — the card carries NO buttons except the anchored ⋯ menu trigger. */
  it('carries the anchored menu affordance and no other row buttons', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} menuActions={[{ label: 'View', onSelect: () => {} }]} />
      </MemoryRouter>,
    );
    const card = screen.getByTestId('channel-listing-card-88231');
    // Exactly one button: the menu trigger.
    expect(card.querySelectorAll('button')).toHaveLength(1);
    const trigger = screen.getByTestId('listing-menu-trigger');
    expect(trigger.textContent).toBe('⋯');
    expect(trigger.getAttribute('style')).toContain('width: 26px');
    expect(trigger.getAttribute('style')).toContain('height: 26px');
    expect(trigger.getAttribute('aria-label')).toContain('Actions for listing');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  });

  /** ⚠ The truncated title stays reachable rather than being allowed to grow the row. */
  it('exposes the full title through the tooltip when it truncates', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-title').getAttribute('title')).toBe(LISTING.intendedTitle);
  });

  /** 🔴 Frame 02 — a missing image is a plain neutral block. No icon, no caption. */
  it('renders the canonical neutral block for a missing thumbnail', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    const thumb = screen.getByTestId('listing-thumbnail');
    expect(thumb.getAttribute('style')).toContain('width: 38px');
    expect(thumb.getAttribute('style')).toContain('height: 38px');
    expect(thumb.getAttribute('style')).toContain('border-radius: var(--radius-control)');
    expect(thumb.textContent).toBe('');
    expect(thumb.querySelector('svg, img')).toBeNull();
  });

  /**
   * 🔴 Frame 02 — on a multi-SKU listing the orderable SKU count replaces the channel SKU,
   * and the mapping column states how many are mapped.
   */
  it('states orderable SKU count and mapped count on a variation listing', () => {
    render(
      <MemoryRouter>
        <ChannelListingCard
          item={{ ...LISTING, skuCount: 4, mappedSkuCount: 3, priceIsFrom: true }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('listing-external-id').textContent).toContain('4 orderable SKUs');
    expect(screen.getByTestId('listing-sellable').textContent).toContain('3 of 4 SKUs mapped');
    expect(screen.getByTestId('listing-sellable').textContent).toContain('1 unmapped SKU');
    // 🔴 Every qualifier shares ONE sub-line, so the price cell never grows the row.
    expect(screen.getByTestId('listing-price-note').textContent).toBe('from');
  });

  // ===================================================================================
  // FRAME 03 — loading, empty and operational conditions
  // ===================================================================================

  /**
   * 🔴 Frame 03 — "final geometry preserved". Loading uses REAL 62px rows on the REAL column
   * grid, so nothing shifts when the data arrives.
   */
  it('renders skeleton rows that preserve the final list geometry while loading', async () => {
    stubApi(undefined, { neverResolveList: true });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-skeleton')).toBeTruthy());
    const rows = screen.getAllByTestId('listing-skeleton-row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const style = row.getAttribute('style') ?? '';
      expect(style).toContain('height: 62px');
      expect(style).toContain('grid-template-columns');
    }
    // The list header keeps its place, so the columns do not jump into existence.
    expect(screen.getByTestId('listing-list-header')).toBeTruthy();
    // 🔴 The locked summary strip survives the loading state.
    expect(screen.getByTestId('listing-summary-strip')).toBeTruthy();
  });

  /** 🔴 A statement about the ERP — not about filters. Offers Sync Now and Add Listing. */
  it('shows the no-listings-yet state with sync and add actions', async () => {
    stubApi(
      ['product.channel-listing.view', 'product.channel-listing.manage', 'product.channel-listing.sync'],
      { content: [], summary: { ...SUMMARY, totalListings: 0 } },
    );
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-empty-none-yet')).toBeTruthy());
    expect(screen.getByTestId('listing-empty-none-yet').textContent).toContain('No listings yet');
    expect(screen.getByTestId('empty-sync-now')).toBeTruthy();
    expect(screen.getByTestId('empty-add-listing')).toBeTruthy();
    // 🔴 Never offer to clear filters when filters are not the reason.
    expect(screen.queryByTestId('empty-clear-filters')).toBeNull();
    // 🔴 No misleading pagination over an empty result set.
    expect(screen.queryByTestId('listing-pagination')).toBeNull();
  });

  /**
   * 🔴 A different condition entirely: Listings DO exist, the filters excluded them. It says
   * how many exist and offers to clear the filters — never to create a Listing.
   */
  it('shows the filtered-empty state with the unfiltered count and a clear action', async () => {
    stubApi(undefined, { content: [], summary: { ...SUMMARY, totalListings: 42 } });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listings-toolbar')).toBeTruthy());
    screen.getByTestId('filter-diverged').click();

    await waitFor(() => expect(screen.getByTestId('listing-empty-filtered')).toBeTruthy());
    const panel = screen.getByTestId('listing-empty-filtered');
    expect(panel.textContent).toContain('No listings match these filters');
    expect(panel.textContent).toContain('42 listings exist');
    expect(screen.getByTestId('empty-clear-filters')).toBeTruthy();
    // 🔴 The filters that produced the empty result stay visible and are not auto-reset.
    expect(screen.getByTestId('filter-diverged').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('empty-add-listing')).toBeNull();
  });

  /**
   * 🔴 `PRD-177` — absence from a discovery run is NOT deletion and NOT a status change, and
   * the copy has to say so where an operator would otherwise assume the opposite.
   */
  it('shows the channel-returned-nothing state without implying deletion', async () => {
    stubApi(undefined, {
      content: [],
      summary: { ...SUMMARY, totalListings: 42 },
      channels: [
        {
          id: 'c1',
          code: 'DARAZ-A',
          name: 'Daraz account A',
          channelType: 'DARAZ',
          adapterAvailable: false,
          knownListings: 0,
          lastSyncAt: null,
          capabilities: [],
        },
      ],
    });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('filter-channel-instance')).toBeTruthy());
    const select = screen.getByTestId('filter-channel-instance') as HTMLSelectElement;
    select.value = 'DARAZ-A';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(screen.getByTestId('listing-empty-channel-none')).toBeTruthy());
    const panel = screen.getByTestId('listing-empty-channel-none');
    expect(panel.textContent).toContain('Daraz account A returned no active listings');
    // 🔴 PRD-177 stated in the operator's own words, and none of the three wrong readings.
    expect(panel.textContent).toContain('absence from a discovery run is not a status change');
    expect(panel.textContent).toContain('withdrawal');
    expect(panel.textContent).not.toContain('deleted');
    expect(screen.getByTestId('empty-show-all-statuses')).toBeTruthy();
  });

  /** ✅ A POSITIVE result — everything in scope is mapped. Never "No listings yet". */
  it('shows the no-unmapped-listings state as a positive result', async () => {
    stubApi(undefined, { content: [], summary: { ...SUMMARY, totalListings: 42 } });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('filter-mapping')).toBeTruthy());
    const mapping = screen.getByTestId('filter-mapping') as HTMLSelectElement;
    mapping.value = 'false';
    mapping.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(screen.getByTestId('listing-empty-no-unmapped')).toBeTruthy());
    const panel = screen.getByTestId('listing-empty-no-unmapped');
    expect(panel.textContent).toContain('No unmapped listings');
    expect(panel.textContent).not.toContain('No listings yet');
    expect(screen.getByTestId('empty-show-all-listings')).toBeTruthy();
  });

  /** 🔴 A failed workspace QUERY replaces the list, offers Retry, and changes no filter. */
  it('shows the workspace query error with a retry action', async () => {
    stubApi(undefined, { failList: true });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-load-error')).toBeTruthy());
    expect(screen.getByTestId('listing-load-error').textContent).toContain('Listings could not be loaded');
    expect(screen.getByTestId('listing-load-error').textContent).toContain('Nothing has been altered');
    expect(screen.getByTestId('listing-retry')).toBeTruthy();
    expect(screen.queryByTestId('listing-pagination')).toBeNull();
    // 🔴 The locked tabs survive a failure.
    expect(screen.getByTestId('product-entity-tabs')).toBeTruthy();
  });

  /**
   * 🔴 An absent adapter is a CAPABILITY condition, not an application failure. It is stated
   * in the workspace meta line and never rendered as an error panel.
   */
  it('does not present a missing adapter as an application failure', async () => {
    stubApi(undefined, {
      channels: [
        {
          id: 'c1',
          code: 'DARAZ-A',
          name: 'Daraz account A',
          channelType: 'DARAZ',
          adapterAvailable: false,
          knownListings: 5,
          lastSyncAt: null,
          capabilities: [],
        },
      ],
    });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    expect(screen.getByTestId('listing-channel-context').textContent).toContain('no marketplace adapter configured');
    expect(screen.queryByTestId('listing-load-error')).toBeNull();
    expect(screen.queryByTestId('listing-operation-error')).toBeNull();
  });

  /**
   * 🔴 Frame 03 — a remote failure is a BANNER and the list stays usable. Local canonical
   * Listings are never blanked out because an operation failed.
   */
  it('keeps already-loaded Listings visible when a remote operation fails', async () => {
    stubApi([
      'product.channel-listing.view',
      'product.channel-listing.manage',
      'product.channel-listing.publish',
    ]);
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    screen.getByTestId('listing-select').click();
    await waitFor(() => expect(screen.getByTestId('listing-batch-push')).toBeTruthy());

    // The operations endpoint returns an empty object, so no batchId comes back.
    screen.getByTestId('listing-batch-push').click();

    // 🔴 Whatever the outcome, the list must survive: this is the rule under test.
    await waitFor(() => expect(screen.getByTestId('channel-listing-card-88231')).toBeTruthy());
    expect(screen.getByTestId('channel-listing-results')).toBeTruthy();
    expect(screen.queryByTestId('listing-load-error')).toBeNull();
  });

  /** 🔴 When data returns, the workspace is exactly the locked PASS 01 / PASS 02 structure. */
  it('returns to the locked populated structure when data is present', async () => {
    stubApi();
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    expect(screen.queryByTestId('listing-skeleton')).toBeNull();
    expect(screen.queryByTestId('listing-empty-none-yet')).toBeNull();
    expect(screen.queryByTestId('listing-load-error')).toBeNull();
    expect(screen.getByTestId('listing-summary-strip').children).toHaveLength(5);
    expect(screen.getByTestId('listing-list-header')).toBeTruthy();
    expect(screen.getByTestId('listing-pagination')).toBeTruthy();
    expect(screen.getByTestId('channel-listing-card-88231').getAttribute('style')).toContain('grid-template-columns');
  });

  // ===================================================================================
  // FRAME 04 — selection scope
  // ===================================================================================

  /** 🔴 Selecting one row selects that row only, and touches no filter or business state. */
  it('selects a single Listing without altering filters', async () => {
    stubApi();
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    screen.getByTestId('listing-select').click();

    await waitFor(() => expect(screen.getByTestId('listing-selected-count')).toBeTruthy());
    expect(screen.getByTestId('listing-selected-count').textContent).toBe('1 listing selected on this page');
    expect(screen.getByTestId('listing-active-filters').textContent).toContain('No filters');

    // Deselect returns the workspace to its normal state.
    screen.getByTestId('listing-select').click();
    await waitFor(() => expect(screen.queryByTestId('listing-selection-bar')).toBeNull());
  });

  /**
   * 🔴 Frame 04 — "Ticking the header checkbox never extends selection past the visible
   * page." With one page of results there is nothing further to offer.
   */
  it('selects only the current page from the header checkbox', async () => {
    stubApi();
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-select-all-visible')).toBeTruthy());
    const header = screen.getByTestId('listing-select-all-visible') as HTMLInputElement;
    expect(header.getAttribute('aria-label')).toBe('Select this page');

    header.click();
    await waitFor(() => expect(screen.getByTestId('listing-selected-count')).toBeTruthy());
    expect(screen.getByTestId('listing-selected-count').textContent).toContain('on this page');
    // 🔴 Everything matching already fits this page, so the wider scope is not offered.
    expect(screen.queryByTestId('listing-select-all-matching')).toBeNull();
  });

  /** 🔴 The header checkbox is indeterminate while only part of the page is selected. */
  it('shows the header checkbox as indeterminate for a partial page selection', async () => {
    stubApi(undefined, { content: [LISTING, UNMAPPED] });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    screen.getAllByTestId('listing-select')[0]?.click();

    await waitFor(() => expect(screen.getByTestId('listing-selection-bar')).toBeTruthy());
    const header = screen.getByTestId('listing-select-all-visible') as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);
  });

  /**
   * 🔴 Frame 04 — the wider scope is a SEPARATE explicit action, named with the real
   * server-side count, and only offered once the page itself is fully selected.
   */
  it('offers all-matching selection only after the page is selected, naming the real count', async () => {
    stubApi(undefined, { totalElements: 612 });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-select-all-visible')).toBeTruthy());
    expect(screen.queryByTestId('listing-select-all-matching')).toBeNull();

    screen.getByTestId('listing-select-all-visible').click();
    await waitFor(() => expect(screen.getByTestId('listing-select-all-matching')).toBeTruthy());
    expect(screen.getByTestId('listing-select-all-matching').textContent)
      .toBe('Select all 612 listings matching current filters');
  });

  /** 🔴 The two scopes are different claims and say so in different words. */
  it('distinguishes page scope from filter-scoped selection', async () => {
    stubApi(undefined, { totalElements: 612 });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-select-all-visible')).toBeTruthy());
    screen.getByTestId('listing-select-all-visible').click();
    await waitFor(() => expect(screen.getByTestId('listing-select-all-matching')).toBeTruthy());
    screen.getByTestId('listing-select-all-matching').click();

    await waitFor(() => expect(screen.getByTestId('listing-selection-scope')).toBeTruthy());
    expect(screen.getByTestId('listing-selected-count').textContent).not.toContain('on this page');
    expect(screen.getByTestId('listing-selection-scope').textContent)
      .toContain('matches the current filter set, evaluated on the server');
    // 🔴 The selection is a filter definition, not rows held in the browser.
    expect(screen.getByTestId('listing-selection-explainer').textContent)
      .toContain('held as a filter definition');
    // 🔴 Multi-channel context WITH server-side counts, preserved for the review step.
    expect(screen.getByTestId('listing-selection-channels')).toBeTruthy();
    expect(screen.getByTestId('selection-channel-Daraz account A').textContent).toContain('3 selected');
    expect(screen.getByTestId('selection-channel-Trioloo Website').textContent).toContain('2 selected');
    // The breakdown sums to the total the bar states.
    expect(screen.getByTestId('listing-selected-count').textContent).toContain('5 listings selected');
    expect(screen.getByTestId('listing-selection-scope').textContent).toContain('across 2 channels');
    // And the way back to page scope is offered.
    expect(screen.getByTestId('listing-select-page-only')).toBeTruthy();
  });

  /**
   * 🔴 Frame 04 — changing a filter INVALIDATES the selection. Carrying an all-matching
   * claim into a different result set would let the operator act on Listings never chosen.
   */
  it('clears a filter-scoped selection when the filters change', async () => {
    stubApi(undefined, { totalElements: 612 });
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-select-all-visible')).toBeTruthy());
    screen.getByTestId('listing-select-all-visible').click();
    await waitFor(() => expect(screen.getByTestId('listing-select-all-matching')).toBeTruthy());
    screen.getByTestId('listing-select-all-matching').click();
    await waitFor(() => expect(screen.getByTestId('listing-selection-scope')).toBeTruthy());

    screen.getByTestId('filter-diverged').click();
    await waitFor(() => expect(screen.queryByTestId('listing-selection-bar')).toBeNull());
  });

  /** 🔴 Clearing selection restores the workspace and touches no filter or page. */
  it('clears selection without clearing filters', async () => {
    stubApi();
    renderListings();

    await waitFor(() => expect(screen.getByTestId('filter-diverged')).toBeTruthy());
    screen.getByTestId('filter-diverged').click();
    await waitFor(() => expect(screen.getByTestId('filter-diverged').getAttribute('aria-pressed')).toBe('true'));

    screen.getByTestId('listing-select').click();
    await waitFor(() => expect(screen.getByTestId('listing-clear-selection')).toBeTruthy());
    screen.getByTestId('listing-clear-selection').click();

    await waitFor(() => expect(screen.queryByTestId('listing-selection-bar')).toBeNull());
    // 🔴 The filter survives.
    expect(screen.getByTestId('filter-diverged').getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * 🔴 THE FRAME 02 CARRYOVER FIX. Selection is INTERACTION state and DIVERGED is BUSINESS
   * state; they must never share a visual. Both remain legible on a row that is both.
   */
  it('does not give a selected card the DIVERGED treatment', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ChannelListingCard item={{ ...LISTING, syncState: 'SYNCED' }} selected onSelectChange={() => {}} />
      </MemoryRouter>,
    );
    const selectedOnly = screen.getByTestId('channel-listing-card-88231').getAttribute('style') ?? '';
    expect(selectedOnly).toContain('1px solid var(--color-border-control)');
    expect(selectedOnly).not.toContain('1.5px solid var(--color-ink)');
    unmount();

    // Selected AND diverged: selection owns the border, divergence keeps its own chip.
    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} selected onSelectChange={() => {}} />
      </MemoryRouter>,
    );
    const both = screen.getByTestId('channel-listing-card-88231').getAttribute('style') ?? '';
    expect(both).toContain('1px solid var(--color-border-control)');
    expect(screen.getByTestId('listing-state-diverged').textContent).toContain('DIVERGED');
  });

  /** 🔴 An unselected diverged row keeps the Frame 02 ink border. */
  /** 🔴 `UX-269` — neither selection nor divergence puts an ink frame around a row. */
  it('never frames a row in ink, selected or diverged', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('channel-listing-card-88231').getAttribute('style'))
      .not.toContain('var(--color-ink)');
    unmount();

    render(
      <MemoryRouter>
        <ChannelListingCard item={LISTING} selected />
      </MemoryRouter>,
    );
    const selected = screen.getByTestId('channel-listing-card-88231').getAttribute('style') ?? '';
    expect(selected).toContain('1px solid var(--color-border-control)');
    expect(selected).not.toContain('var(--color-ink)');
  });

  /** 🔴 `PRD-196.a` — batch actions follow real authority, and no dead Push is rendered. */
  it('offers only the batch actions the role actually holds', async () => {
    stubApi(['product.channel-listing.view', 'product.channel-listing.manage']);
    renderListings();

    await waitFor(() => expect(screen.getByTestId('channel-listing-results')).toBeTruthy());
    screen.getByTestId('listing-select').click();
    await waitFor(() => expect(screen.getByTestId('listing-selection-bar')).toBeTruthy());

    expect(screen.getByTestId('listing-batch-edit').textContent).toBe('Batch Edit');
    expect(screen.queryByTestId('listing-batch-push')).toBeNull();
    expect(screen.queryByTestId('listing-batch-refresh')).toBeNull();
    // Stated once, in words, instead of a disabled control.
    expect(screen.getByTestId('listing-push-authority-note').textContent)
      .toContain('product.channel-listing.publish');
  });

  // ===================================================================================
  // FRAME 05 — row menu + permissions
  // ===================================================================================

  const openMenu = async (): Promise<void> => {
    await waitFor(() => expect(screen.getAllByTestId('listing-menu-trigger')[0]).toBeTruthy());
    screen.getAllByTestId('listing-menu-trigger')[0]?.click();
    await waitFor(() => expect(screen.getByTestId('listing-menu')).toBeTruthy());
  };

  /** 🔴 The ⋯ opens that row's menu, and does not touch the row's selection. */
  it('opens the row menu without changing selection', async () => {
    stubApi();
    renderListings();
    await openMenu();

    expect(screen.getByTestId('listing-menu').getAttribute('role')).toBe('menu');
    // 🔴 Opening a menu is not selecting a row.
    expect(screen.queryByTestId('listing-selection-bar')).toBeNull();
  });

  /** 🔴 Escape closes the menu. */
  it('closes the row menu on Escape', async () => {
    stubApi();
    renderListings();
    await openMenu();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitFor(() => expect(screen.queryByTestId('listing-menu')).toBeNull());
  });

  /** 🔴 A click outside closes the menu. */
  it('closes the row menu on an outside click', async () => {
    stubApi();
    renderListings();
    await openMenu();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await waitFor(() => expect(screen.queryByTestId('listing-menu')).toBeNull());
  });

  /** 🔴 Selecting a row never opens its menu. */
  it('does not open the menu when a row is selected', async () => {
    stubApi();
    renderListings();

    await waitFor(() => expect(screen.getByTestId('listing-select')).toBeTruthy());
    screen.getByTestId('listing-select').click();
    await waitFor(() => expect(screen.getByTestId('listing-selection-bar')).toBeTruthy());
    expect(screen.queryByTestId('listing-menu')).toBeNull();
  });

  /**
   * 🔴 `PRD-196.a` — MANAGE NEVER IMPLIES PUBLISH. Push is OMITTED, not disabled, and the
   * role is told why once.
   */
  it('omits Push for a manage-only role and states why', async () => {
    stubApi(['product.channel-listing.view', 'product.channel-listing.manage']);
    renderListings();
    await openMenu();

    expect(screen.getByTestId('menu-view')).toBeTruthy();
    expect(screen.getByTestId('menu-edit')).toBeTruthy();
    // 🔴 No dead Push control anywhere.
    expect(screen.queryByTestId('menu-push')).toBeNull();
    expect(screen.queryByTestId('menu-refresh')).toBeNull();
    expect(screen.getByTestId('action-menu-note').textContent).toContain('Push is not available to your role');
  });

  /** 🔴 A view-only role sees no local mutation either. */
  it('omits Edit and Map for a view-only role', async () => {
    stubApi(['product.channel-listing.view']);
    renderListings();
    await openMenu();

    expect(screen.getByTestId('menu-view')).toBeTruthy();
    expect(screen.queryByTestId('menu-edit')).toBeNull();
    expect(screen.queryByTestId('menu-map')).toBeNull();
    expect(screen.queryByTestId('menu-change-mapping')).toBeNull();
  });

  /**
   * 🔴 CAPABILITY IS NOT PERMISSION. The operator HAS publish and sync; the channel has no
   * adapter. Refresh is DIMMED WITH A REASON, never omitted as if unauthorised.
   *
   * <p>🔴 PUSH IS DIFFERENT NOW, AND DELIBERATELY SO. Since Frame 15 it opens a REVIEW rather
   * than dispatching, and a review of a listing that cannot yet be sent is exactly what an
   * operator needs — so the entry stays available and the absent adapter is reported inside,
   * as an `ADAPTER_CAPABILITY` preflight blocker with the whole review still readable.
   * Dimming it here would hide that explanation behind a tooltip.
   */
  it('dims Refresh for a channel with no adapter but still offers the review', async () => {
    stubApi([
      'product.channel-listing.view',
      'product.channel-listing.manage',
      'product.channel-listing.publish',
      'product.channel-listing.sync',
    ]);
    renderListings();
    await openMenu();

    const refresh = screen.getByTestId('menu-refresh') as HTMLButtonElement;
    const push = screen.getByTestId('menu-push') as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
    // 🔴 Still a CAPABILITY statement, not an authority one.
    expect(screen.getByTestId('listing-menu').textContent).toContain('No marketplace adapter is configured');
    expect(screen.queryByTestId('action-menu-note')).toBeNull();
    // 🔴 The review opens; execution is refused inside it, where the reason is legible.
    expect(push.disabled).toBe(false);
  });

  /** 🔴 UNMAPPED offers Map; a mapped listing offers Change Mapping. */
  it('offers Map for an unmapped listing and Change Mapping for a mapped one', async () => {
    stubApi(['product.channel-listing.view', 'product.channel-listing.manage'], { content: [UNMAPPED] });
    const { unmount } = render(
      <MemoryRouter initialEntries={['/inventory/products/listings']}>
        <AuthProvider>
          <PageActionsProvider>
            <Routes>
              <Route path="/inventory/products" element={<ProductWorkspace />}>
                <Route path="listings" element={<ChannelListingsPage />} />
              </Route>
            </Routes>
          </PageActionsProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    await openMenu();
    expect(screen.getByTestId('menu-map').textContent).toBe('Map to Sellable Product');
    expect(screen.queryByTestId('menu-change-mapping')).toBeNull();
    unmount();
    vi.unstubAllGlobals();

    stubApi(['product.channel-listing.view', 'product.channel-listing.manage'], {
      content: [{ ...LISTING, mappedSkuCount: 1 }],
    });
    renderListings();
    await openMenu();
    expect(screen.getByTestId('menu-change-mapping').textContent).toBe('Change Mapping');
    expect(screen.queryByTestId('menu-map')).toBeNull();
  });

  /**
   * 🔴 An unmapped listing still OPENS the review, and the mapping consequence is reported
   * inside it in the `MAPPING` dimension.
   *
   * <p>⚠ `PRD-178` — UNMAPPED IS A VALID STATE. The old tooltip read as though mapping were
   * an outbound requirement canon states; it is not. The truthful consequence is narrower —
   * an unmapped unit has no Sellable Product to derive Product-owned values or master media
   * from — and it belongs in the review beside the other three dimensions.
   *
   * <p>🔴 A never-published listing also uses FIRST-PUBLICATION wording; "Push" would
   * describe an update to something the channel has never seen.
   */
  it('offers the review on an unmapped listing, with first-publication wording', async () => {
    stubApi(
      ['product.channel-listing.view', 'product.channel-listing.manage', 'product.channel-listing.publish'],
      { content: [UNMAPPED] },
    );
    renderListings();
    await openMenu();

    const push = screen.getByTestId('menu-push') as HTMLButtonElement;
    expect(push.disabled).toBe(false);
    expect(push.textContent).toBe('Review & Publish');
  });

  /** 🔴 A never-published listing has no remote identity, so Refresh cannot read anything. */
  it('dims Refresh when the listing has no channel identity', async () => {
    stubApi(['product.channel-listing.view', 'product.channel-listing.sync'], { content: [UNMAPPED] });
    renderListings();
    await openMenu();

    const refresh = screen.getByTestId('menu-refresh') as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
    expect(screen.getByTestId('listing-menu').textContent).toContain('has not been published yet');
  });

  /** 🔴 A diverged row leads with the comparison, which is its first real question. */
  it('leads a diverged row menu with the comparison entry', async () => {
    stubApi();
    renderListings();
    await openMenu();

    expect(screen.getByTestId('menu-compare').textContent).toBe('Compare intended vs reported');
  });
});

// =====================================================================================
// FRAME 11 + 12 — unmapped state and the mapping handoff
// =====================================================================================

describe('Frames 11 + 12 — mapping from the workspace', () => {
  const openMenu = async (): Promise<void> => {
    await waitFor(() => expect(screen.getAllByTestId('listing-menu-trigger')[0]).toBeTruthy());
    screen.getAllByTestId('listing-menu-trigger')[0]?.click();
    await waitFor(() => expect(screen.getByTestId('listing-menu')).toBeTruthy());
  };

  /** 🔴 `PRD-178` — the dashed carrier, its own dimension, not an error treatment (§37). */
  it('shows UNMAPPED as a restrained state, never a failure', async () => {
    stubApi(undefined, { content: [UNMAPPED] });
    renderListings();
    await waitFor(() => expect(screen.getByTestId('listing-unmapped')).toBeTruthy());

    const chip = screen.getByTestId('listing-unmapped');
    expect(chip.textContent).toContain('UNMAPPED');
    expect(chip.style.border).toContain('dashed');
    expect(chip.style.color).not.toContain('destructive');
  });

  /** 🔴 §5 — the aggregate is the truth. One mapped SKU never makes a listing mapped. */
  it('reports a partial mapping as a count, not as mapped', async () => {
    stubApi(undefined, { content: [{ ...UNMAPPED, skuCount: 2, mappedSkuCount: 1 }] });
    renderListings();
    await waitFor(() => expect(screen.getByTestId('listing-sellable')).toBeTruthy());

    const cell = screen.getByTestId('listing-sellable').textContent ?? '';
    expect(cell).toContain('1 of 2 SKUs mapped');
    expect(cell).toContain('1 unmapped SKU');
  });

  /** 🔴 §25 — mapping opens IN PLACE. The workspace is never left merely to map. */
  it('opens the Mapping modal from the row menu without navigating', async () => {
    stubApi(undefined, { content: [UNMAPPED] });
    renderListings();
    await openMenu();

    fireEvent.click(screen.getByTestId('menu-map'));
    await waitFor(() => expect(screen.getByTestId('mapping-modal')).toBeTruthy());
    // The workspace is still mounted underneath — nothing navigated away.
    expect(screen.getByTestId('channel-listing-results')).toBeTruthy();
  });

  it('closes the modal back to the same workspace', async () => {
    stubApi(undefined, { content: [UNMAPPED] });
    renderListings();
    await openMenu();
    fireEvent.click(screen.getByTestId('menu-map'));
    await waitFor(() => expect(screen.getByTestId('mapping-modal')).toBeTruthy());

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('mapping-modal')).toBeNull());
    expect(screen.getByTestId('channel-listing-results')).toBeTruthy();
  });

  /** 🔴 §24 — view alone may SEE mapping state but never change it. */
  it('offers no mapping action without manage authority', async () => {
    stubApi(['product.channel-listing.view'], { content: [UNMAPPED] });
    renderListings();
    await waitFor(() => expect(screen.getByTestId('listing-unmapped')).toBeTruthy());
    await openMenu();

    expect(screen.queryByTestId('menu-map')).toBeNull();
    expect(screen.queryByTestId('menu-change-mapping')).toBeNull();
  });
});
