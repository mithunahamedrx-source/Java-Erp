import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingDetailPage from './ChannelListingDetailPage';
import type { ChannelListing, ComparisonRow } from './channelListingApi';

/** FRAME 06 — the Listing Detail full page. */

const LISTING: ChannelListing = {
  id: '11111111-1111-1111-1111-111111111111',
  channelInstanceId: '33333333-3333-3333-3333-333333333333',
  channelInstance: 'DARAZ-A',
  channelName: 'Daraz account A',
  channelType: 'DARAZ',
  adapterAvailable: false,
  externalListingId: 'DRZ-87720113',
  mappingState: 'MAPPED',
  skuCount: 1,
  mappedSkuCount: 1,
  sellableProductId: '22222222-2222-2222-2222-222222222222',
  mappedSellableSku: 'SP-003377',
  sellableName: 'Hi-Power 22 IPS Monitor',
  intendedTitle: 'Hi-Power 22 Inch IPS Monitor',
  intendedDescription: 'A monitor.',
  intendedTitleBn: null,
  intendedDescriptionBn: null,
  effectiveTitleBn: 'Hi-Power 22 Inch IPS Monitor',
  effectiveDescriptionBn: 'A monitor.',
  salePrice: '11200.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: '11200.00',
  promotionActive: false,
  priceIsFrom: false,
  listingStock: '31',
  publicationIntent: 'PUBLISH',
  intendedChannelCategory: 'Electronics > Monitors',
  channelReportedTitle: 'Hi-Power 22 Inch IPS Monitor',
  reportedTitleReadable: true,
  reportedDescription: null,
  reportedDescriptionReadable: false,
  reportedSalePrice: '10900.00',
  reportedSalePriceReadable: true,
  reportedPromotionPrice: null,
  reportedPromotionPriceReadable: false,
  reportedPromotionStartsAt: null,
  reportedPromotionEndsAt: null,
  reportedPromotionWindowReadable: false,
  reportedStock: '31',
  reportedStockReadable: true,
  reportedChannelCategory: null,
  reportedChannelCategoryReadable: false,
  listingStatus: 'ACTIVE',
  syncState: 'DIVERGED',
  localLifecycle: 'PUBLISHED',
  hasUnsentLocalChanges: false,
  divergedFactCount: 1,
  primaryMediaReference: null,
  highlights: ['4K UHD resolution', 'Google TV with built-in streaming apps', 'Three HDMI inputs'],
  highlightsAreFallback: false,
  highlightsBn: [],
  effectiveHighlightsBn: [],
  highlightsBnAreFallback: true,
  lastSyncAt: '2026-08-13T08:15:00Z',
  lastSeenInDiscoveryAt: null,
  lastSuccessfulPushAt: '2026-07-28T16:04:00Z',
  updatedAt: '2026-08-13T08:15:00Z',
  version: 0,
  skus: [
    {
      id: 'sku-1',
      channelSku: 'ZT-MON-22IPS',
      sellableProductId: '22222222-2222-2222-2222-222222222222',
      sellableSku: 'SP-003377',
      sellableName: 'Hi-Power 22 IPS Monitor',
      salePrice: '11200.00',
      promotionPrice: null,
      promotionStartsAt: null,
      promotionEndsAt: null,
      effectiveSellingPrice: '11200.00',
      promotionActive: false,
      listingStock: '31',
      reportedSalePrice: '10900.00',
      reportedSalePriceReadable: true,
      reportedPromotionPrice: null,
      reportedPromotionPriceReadable: false,
      reportedPromotionStartsAt: null,
      reportedPromotionEndsAt: null,
      reportedPromotionWindowReadable: false,
      reportedStock: '31',
      reportedStockReadable: true,
      packageWeightKg: null,
      packageLengthCm: null,
      packageWidthCm: null,
      packageHeightCm: null,
      packageContent: null,
      variationLabel: null,
      position: 0,
    },
  ],
};

const COMPARISON: readonly ComparisonRow[] = [
  { fieldKey: 'sale_price', label: 'Sale Price', intendedValue: '11200.00', reportedValue: '10900.00', reportedReadable: true, state: 'DIVERGED', resolvable: true },
  { fieldKey: 'promotion_price', label: 'Promotion Price', intendedValue: null, reportedValue: null, reportedReadable: false, state: 'NOT_READABLE', resolvable: false },
  { fieldKey: 'attribute:Brand', label: 'Brand', intendedValue: 'Hi-Power', reportedValue: 'Hi-Power', reportedReadable: true, state: 'ALIGNED', resolvable: false },
  { fieldKey: 'attribute:Warranty period', label: 'Warranty period', intendedValue: '12 months', reportedValue: null, reportedReadable: false, state: 'NOT_READABLE', resolvable: false },
];

function stubApi(
  permissions: readonly string[] = [
    'product.channel-listing.view',
    'product.channel-listing.manage',
    'product.channel-listing.publish',
    'product.channel-listing.sync',
  ],
  listing: ChannelListing = LISTING,
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
      if (url.includes('/comparison')) return json(COMPARISON);
      if (url.includes('/media')) {
        return json({ master: [], intended: [], reported: [], effective: [], effectiveIsFallback: true, reportedOrderReliable: true });
      }
      if (url.includes('/activity')) {
        return json({
          content: [
            { id: 'a1', entryKind: 'CHANNEL_EVENT', summary: 'Reported price changed', fieldKey: null, beforeValue: null, afterValue: null, source: 'CHANNEL', actorName: null, operationId: null, batchId: null, occurredAt: '2026-08-13T08:15:00Z' },
          ],
          page: 0,
          size: 3,
          totalElements: 1,
          totalPages: 1,
        });
      }
      return json(listing);
    }),
  );
}

function stubApiWithComparison(
  rows: readonly ComparisonRow[],
  listing: ChannelListing = LISTING,
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown): Response =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/me')) {
        return json({
          id: 'dev',
          username: 'devuser',
          fullName: 'Dev User',
          roles: [],
          permissions: ['product.channel-listing.view', 'product.channel-listing.manage'],
        });
      }
      if (url.includes('/comparison')) return json(rows);
      if (url.includes('/media')) {
        return json({ master: [], intended: [], reported: [], effective: [], effectiveIsFallback: true, reportedOrderReliable: true });
      }
      if (url.includes('/activity')) return json({ content: [], page: 0, size: 3, totalElements: 0, totalPages: 0 });
      return json(listing);
    }),
  );
}

function renderDetail(): void {
  render(
    <MemoryRouter initialEntries={[`/inventory/products/listings/${LISTING.id}`]}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/:id" element={<ChannelListingDetailPage />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // ⚠ The fixture is chosen from the URL, so it is cleared between tests.
  window.history.replaceState({}, '', '/');
});

describe('Frame 06 — Listing Detail', () => {
  it('renders the canonical page header with the Listing identity', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('channel-listing-detail')).toBeTruthy());
    const header = screen.getByTestId('page-header');
    expect(header.querySelector('h1')?.textContent).toBe('Hi-Power 22 Inch IPS Monitor');
    // Channel / Shop, external identity and SKU context.
    expect(header.textContent).toContain('Daraz account A');
    expect(header.textContent).toContain('DRZ-87720113');
    expect(header.textContent).toContain('ZT-MON-22IPS');
  });

  /** 🔴 An operator-facing surface never leads with an internal identifier. */
  it('does not render the internal listing UUID as an operator fact', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-section-overview')).toBeTruthy());
    expect(screen.getByTestId('channel-listing-detail').textContent).not.toContain(LISTING.id);
  });

  it('shows the mapped Sellable Product summary', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-mapping-summary')).toBeTruthy());
    const mapping = screen.getByTestId('detail-mapping-summary');
    expect(mapping.textContent).toContain('Hi-Power 22 IPS Monitor');
    expect(mapping.textContent).toContain('SP-003377');
    expect(screen.getByTestId('detail-change-mapping').textContent).toBe('Change mapping');
  });

  /** 🔴 UNMAPPED is a valid state, and offers the mapping entry rather than an error. */
  it('shows an unmapped listing truthfully with a mapping entry', async () => {
    stubApi(undefined, { ...LISTING, mappedSkuCount: 0, mappingState: 'UNMAPPED', mappedSellableSku: null, sellableName: null });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-mapping-summary')).toBeTruthy());
    expect(screen.getByTestId('detail-mapping-summary').textContent).toContain('UNMAPPED');
    expect(screen.getByTestId('detail-change-mapping').textContent).toBe('Map to Sellable Product');
  });

  /** 🔴 `INV-106.2` — a multi-SKU listing reports its true aggregate, not one mapping. */
  it('reports the true aggregate mapping for a multi-SKU listing', async () => {
    stubApi(undefined, { ...LISTING, skuCount: 4, mappedSkuCount: 3, mappingState: 'PARTIALLY_MAPPED' });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-mapping-summary')).toBeTruthy());
    const mapping = screen.getByTestId('detail-mapping-summary');
    expect(mapping.textContent).toContain('3 of 4 SKUs mapped');
    expect(mapping.textContent).toContain('1 unmapped SKU');
  });

  /** 🔴 `PRD-199` — Sale Price and Promotion Price, in BDT, with the reported side beside each. */
  it('shows Sale Price and Promotion Price with their reported counterparts', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-sale-price')).toBeTruthy());
    const sale = screen.getByTestId('detail-sale-price');
    expect(sale.textContent).toContain('Sale Price');
    expect(sale.textContent).toContain('৳ 11,200');
    expect(sale.textContent).toContain('৳ 10,900');
    // 🔴 The diverged figure takes the ink border.
    expect(sale.getAttribute('style')).toContain('1.5px solid var(--color-ink)');

    const promotion = screen.getByTestId('detail-promotion-price');
    // 🔴 SYS-034 — unreadable is said in words, never shown as zero or blank.
    expect(promotion.textContent).toContain('Not readable from this channel');
    // Superseded vocabulary must not reappear.
    const page = screen.getByTestId('channel-listing-detail').textContent ?? '';
    expect(page).not.toContain('Channel price');
    expect(page).not.toContain('Discount Price');
  });

  /** ⚠ A promotion equal to the Sale Price offers no reduction, and the page says so. */
  it('does not imply a reduction when the promotion equals the Sale Price', async () => {
    stubApi(undefined, { ...LISTING, promotionPrice: '11200.00' });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-promotion-price')).toBeTruthy());
    expect(screen.getByTestId('detail-promotion-price').textContent).toContain('no reduction offered');
  });

  /** ⚠ With nothing scheduled the card says so rather than showing an empty figure. */
  it('states plainly when no promotion is scheduled', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-promotion-price')).toBeTruthy());
    expect(screen.getByTestId('detail-promotion-price').textContent).toContain('no promotion scheduled');
  });

  /**
   * 🔴 `PRD-199.d` — SCHEDULED and RUNNING are different facts, decided by the SERVER from
   * the clock. The page reports which one it was told, and never re-decides it.
   */
  it('separates a scheduled promotion from a running one', async () => {
    const promo = {
      promotionPrice: '9900.00',
      promotionStartsAt: '2026-08-20T00:00:00Z',
      promotionEndsAt: '2026-08-31T23:59:00Z',
    };
    stubApi(undefined, { ...LISTING, ...promo, promotionActive: false });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-promotion-price')).toBeTruthy());
    expect(screen.getByTestId('detail-promotion-price').textContent).toContain('scheduled');
    expect(screen.getByTestId('detail-promotion-price').textContent).not.toContain('running');

    cleanup();
    vi.unstubAllGlobals();
    stubApi(undefined, { ...LISTING, ...promo, promotionActive: true });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-promotion-price')).toBeTruthy());
    expect(screen.getByTestId('detail-promotion-price').textContent).toContain('running');
  });

  /** 🔴 `PRD-199.f` — MRP is retired and no competing price label survives on the page. */
  it('never shows MRP, Regular Price or Discount Price', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-sale-price')).toBeTruthy());
    const text = screen.getByTestId('channel-listing-detail').textContent ?? '';
    for (const retired of ['MRP', 'Regular Price', 'Discount Price']) {
      expect(text).not.toContain(retired);
    }
  });

  /** 🔴 `PRD-193` — Listing stock is channel-facing and never relabelled as inventory. */
  it('labels Listing stock correctly and separates it from inventory', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-listing-stock')).toBeTruthy());
    expect(screen.getByTestId('detail-listing-stock').textContent).toContain('Listing stock');
    const body = screen.getByTestId('channel-listing-detail').textContent ?? '';
    expect(body).toContain('not derived from warehouse inventory');
    expect(body).not.toContain('Available Inventory');
    expect(body).not.toContain('Warehouse Available');
  });

  /** 🔴 `SYS-034` — an unreadable attribute stays unreadable, never an empty cell. */
  it('renders the attribute table with unreadable values named', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-attributes')).toBeTruthy());
    const attrs = screen.getByTestId('detail-attributes');
    expect(attrs.textContent).toContain('Brand');
    expect(attrs.textContent).toContain('Warranty period');
    expect(attrs.textContent).toContain('Not readable from this channel');
  });

  /** The comparison SUMMARY and its entry live here; Frame 07 owns the full surface. */
  it('summarises the diverged facts and marks the section as an exception', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-diverged-facts')).toBeTruthy());
    const facts = screen.getByTestId('detail-diverged-facts').textContent ?? '';
    expect(facts).toContain('Sale Price');
    /*
      🔴 `TEC-015` — the summary renders the same facts as the Frame 07 table beside it, so it
      renders them the SAME WAY. A raw "11200.00" here is not a smaller version of the money
      language; it is a different one, on one page, about one number.
    */
    expect(facts).toContain('৳ 11,200 → ৳ 10,900');
    expect(facts).not.toContain('11200.00');
    expect(facts).not.toContain('10900.00');
    // The SIDEBAR summary carries the exception emphasis; the full Frame 07 surface below
    // is a plain section that holds the per-fact detail.
    expect(screen.getByTestId('detail-section-comparison-summary').getAttribute('style'))
      .toContain('1.5px solid var(--color-ink)');
    expect(screen.getByTestId('detail-resolve')).toBeTruthy();
  });

  /**
   * 🔴 An absent adapter is stated honestly and does not blank the page.
   *
   * <p>🔴 REFRESH IS SHOWN AND DISABLED, NOT HIDDEN — amended for Frame 16. A hidden control
   * states no reason at all; a dimmed one names the unmet PRECONDITION and points at visible
   * text. Superseded: `detail-refresh` was omitted whenever the adapter was absent, which
   * left the operator with an action they could not find and no explanation of why.
   *
   * <p>⚠ This is the row-menu convention (`PASS 05`) applied to the same control on the
   * Detail page: an unmet PRECONDITION dims with a reason, an unmet AUTHORITY omits — see
   * the manage-only test below, where Refresh is still absent entirely.
   */
  it('states the missing adapter and dims Refresh with a reachable reason', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('listing-no-adapter')).toBeTruthy());
    expect(screen.getByTestId('listing-no-adapter').textContent).toContain('No marketplace adapter is configured');
    // Local data stays fully visible.
    expect(screen.getByTestId('detail-section-overview')).toBeTruthy();

    const refresh = screen.getByTestId('detail-refresh') as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
    // 🔴 The reason is VISIBLE text the control points at — never a mouse-only tooltip.
    const reason = screen.getByTestId('detail-refresh-reason');
    expect(reason.textContent).toContain('No marketplace adapter is configured');
    expect(refresh.getAttribute('aria-describedby')).toBe(reason.id);
  });

  /**
   * 🔴 "NO ADAPTER" AND "NOTHING READABLE" ARE DIFFERENT CAUSES WITH DIFFERENT REMEDIES
   * (`API-063`, `PRD-125`). An adapter that exists but declares it can read nothing must not
   * be described as a missing adapter — that sends the operator to look for an integration
   * that is already installed.
   */
  it('distinguishes an adapter that reports nothing readable from a missing adapter', async () => {
    stubApi(undefined, { ...LISTING, adapterAvailable: true, adapterReadsListings: false });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-refresh-reason')).toBeTruthy());
    const reason = screen.getByTestId('detail-refresh-reason').textContent ?? '';
    expect(reason).toContain('reports no readable Listing facts');
    expect(reason).not.toContain('No marketplace adapter is configured');
    expect((screen.getByTestId('detail-refresh') as HTMLButtonElement).disabled).toBe(true);
  });

  /** 🔴 `PRD-196.a` — manage never implies publish. */
  it('omits Push for a manage-only role', async () => {
    stubApi(['product.channel-listing.view', 'product.channel-listing.manage']);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('edit-channel-listing')).toBeTruthy());
    expect(screen.queryByTestId('detail-push')).toBeNull();
    expect(screen.queryByTestId('detail-refresh')).toBeNull();
  });

  /** 🔴 A view-only role gets no local mutation entry either. */
  it('omits Edit and mapping for a view-only role', async () => {
    stubApi(['product.channel-listing.view']);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('channel-listing-detail')).toBeTruthy());
    expect(screen.queryByTestId('edit-channel-listing')).toBeNull();
    expect(screen.queryByTestId('detail-change-mapping')).toBeNull();
    expect(screen.getByTestId('detail-back')).toBeTruthy();
  });

  it('offers the way back to Listings', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-back')).toBeTruthy());
    expect(screen.getByTestId('detail-back').getAttribute('href')).toBe('/inventory/products/listings');
  });

  /** The section strip is real navigation on this page, not a set of dead tabs. */
  it('renders every Frame 06 section and its strip entry', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-sections')).toBeTruthy());
    for (const id of ['overview', 'comparison', 'skus', 'media', 'category', 'activity']) {
      expect(screen.getByTestId(`detail-tab-${id}`)).toBeTruthy();
      expect(screen.getByTestId(`detail-section-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('detail-tab-overview').getAttribute('aria-selected')).toBe('true');
  });

  it('lists the orderable channel SKUs with their commercial values', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-sku-sku-1')).toBeTruthy());
    const sku = screen.getByTestId('detail-sku-sku-1');
    expect(sku.textContent).toContain('ZT-MON-22IPS');
    expect(sku.textContent).toContain('৳ 11,200');
    expect(sku.textContent).toContain('MAPPED');
  });

  /** 🔴 `PRD-188.b` — a never-published listing says so instead of showing a blank. */
  it('states an unpublished listing truthfully', async () => {
    stubApi(undefined, { ...LISTING, externalListingId: null, localLifecycle: 'DRAFT', listingStatus: null });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-section-overview')).toBeTruthy());
    const overview = screen.getByTestId('detail-section-overview');
    expect(overview.textContent).toContain('Not published');
    expect(overview.textContent).toContain('No status reported');
  });

  // ===================================================================================
  // Truthful comparison — UNREADABLE IS NOT EQUAL
  // ===================================================================================

  /**
   * 🔴 `SYS-034` — equality may only be concluded from facts the channel ACTUALLY returned.
   * With a readable difference present, the summary names it.
   */
  it('reports a readable difference as divergence', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-comparison-summary')).toBeTruthy());
    expect(screen.getByTestId('detail-comparison-summary').textContent)
      .toBe('1 fact differs from what the channel reports.');
    // The unreadable values are declared, not silently folded into the verdict.
    expect(screen.getByTestId('detail-comparison-unreadable').textContent)
      .toContain('2 values were not readable from this channel');
  });

  /**
   * 🔴 THE BUG THIS CORRECTION EXISTS FOR. With every reported value unreadable, the page
   * must NOT claim that nothing differs — that would infer equality from absence.
   */
  it('never claims nothing differs when no value was readable', async () => {
    vi.unstubAllGlobals();
    stubApiWithComparison([
      { fieldKey: 'sale_price', label: 'Sale Price', intendedValue: '11200.00', reportedValue: null, reportedReadable: false, state: 'NOT_READABLE', resolvable: false },
      { fieldKey: 'promotion_price', label: 'Promotion Price', intendedValue: null, reportedValue: null, reportedReadable: false, state: 'NOT_READABLE', resolvable: false },
    ]);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-comparison-summary')).toBeTruthy());
    const summary = screen.getByTestId('detail-comparison-summary').textContent ?? '';
    expect(summary).toBe('No channel values could be compared.');
    expect(summary).not.toContain('Nothing');
    expect(summary).not.toContain('match');
  });

  /** ✅ Genuinely equal READABLE facts may be reported as aligned. */
  it('reports aligned only when readable facts actually match', async () => {
    vi.unstubAllGlobals();
    stubApiWithComparison(
      [
        { fieldKey: 'sale_price', label: 'Sale Price', intendedValue: '11200.00', reportedValue: '11200.00', reportedReadable: true, state: 'ALIGNED', resolvable: false },
        { fieldKey: 'listing_stock', label: 'Listing stock', intendedValue: '31', reportedValue: '31', reportedReadable: true, state: 'ALIGNED', resolvable: false },
      ],
      { ...LISTING, syncState: 'SYNCED' },
    );
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-comparison-summary')).toBeTruthy());
    expect(screen.getByTestId('detail-comparison-summary').textContent)
      .toBe('All 2 compared channel values match ERP intent.');
    expect(screen.queryByTestId('detail-comparison-unreadable')).toBeNull();
    expect(screen.queryByTestId('detail-comparison-manual')).toBeNull();
  });

  /**
   * 🔴 `PRD-183.d` — a MANUAL_REQUIRED fact came back from the channel, so it is READABLE,
   * but it was never compared. Counting it as agreement would be the same lie as counting an
   * unreadable value as agreement, so the summary counts COMPARED facts and names the rest.
   */
  it('never counts a manual-comparison fact as agreement', async () => {
    vi.unstubAllGlobals();
    stubApiWithComparison(
      [
        { fieldKey: 'sale_price', label: 'Sale Price', intendedValue: '11200.00', reportedValue: '11200.00', reportedReadable: true, state: 'ALIGNED', resolvable: false },
        { fieldKey: 'media', label: 'Media order', intendedValue: '5 images', reportedValue: '5 images · order not reliably readable', reportedReadable: true, state: 'MANUAL_REQUIRED', resolvable: false },
      ],
      { ...LISTING, syncState: 'SYNCED' },
    );
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-comparison-summary')).toBeTruthy());
    expect(screen.getByTestId('detail-comparison-summary').textContent)
      .toBe('All 1 compared channel value matches ERP intent.');
    expect(screen.getByTestId('detail-comparison-manual').textContent)
      .toContain('1 fact cannot be compared automatically and needs a person.');
  });

  /**
   * 🔴 The listing-level sync state and the field comparison are SEPARATE facts. Where they
   * disagree both are stated, and no divergence is fabricated to reconcile them.
   */
  it('states the contradiction when DIVERGED has no readable field difference', async () => {
    vi.unstubAllGlobals();
    stubApiWithComparison([
      { fieldKey: 'sale_price', label: 'Sale Price', intendedValue: '11200.00', reportedValue: null, reportedReadable: false, state: 'NOT_READABLE', resolvable: false },
    ]);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-comparison-state-note')).toBeTruthy());
    expect(screen.getByTestId('detail-comparison-state-note').textContent)
      .toContain('no readable field difference is recorded');
    expect(screen.queryByTestId('detail-diverged-facts')).toBeNull();
  });

  // ===================================================================================
  // PRD-198 — Listing highlights
  // ===================================================================================

  /** 🔴 `PRD-198.b` — the AUTHORED order is rendered exactly, never merged or re-sorted. */
  it('renders Listing highlights as an ordered list in authored order', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-highlights')).toBeTruthy());
    const list = screen.getByTestId('detail-highlights');
    expect(list.tagName).toBe('OL');
    const items = [...list.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual([
      '4K UHD resolution',
      'Google TV with built-in streaming apps',
      'Three HDMI inputs',
    ]);
    // 🔴 Never merged into one paragraph.
    expect(list.querySelectorAll('li')).toHaveLength(3);
  });

  /** ✅ `PRD-198.c` — the effective set says whether it is the Listing own set or the fallback. */
  it('states whether highlights are the listing own set or the master fallback', async () => {
    stubApi();
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-section-highlights')).toBeTruthy());
    expect(screen.getByTestId('detail-section-highlights').textContent).toContain('Authored for this listing');
    cleanup();
    vi.unstubAllGlobals();

    stubApi(undefined, { ...LISTING, highlightsAreFallback: true });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-section-highlights')).toBeTruthy());
    expect(screen.getByTestId('detail-section-highlights').textContent)
      .toContain('From the Sellable Product master set');
  });

  /**
   * 🔴 `PRD-198.e` — an adapter that cannot carry highlights NEVER removes them. The listing
   * here has no adapter at all, and its authored highlights are still shown in full.
   */
  it('keeps intended highlights visible when no adapter supports them', async () => {
    stubApi(undefined, { ...LISTING, adapterAvailable: false });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-highlights')).toBeTruthy());
    expect(screen.getByTestId('detail-highlights').querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByTestId('listing-no-adapter')).toBeTruthy();
  });

  /** ⚠ Absence is stated plainly, and no editor appears — editing is Frame 10. */
  it('states truthfully when no highlights exist', async () => {
    stubApi(undefined, { ...LISTING, highlights: [], highlightsAreFallback: true });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-section-highlights')).toBeTruthy());
    expect(screen.getByTestId('detail-section-highlights').textContent)
      .toContain('No highlights have been authored');
    expect(screen.queryByTestId('detail-highlights')).toBeNull();
  });

  /** 🔴 Header actions carry semantic icons from the shared registry. */
  it('renders header actions with semantic icons', async () => {
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-back')).toBeTruthy());
    for (const testId of ['detail-back', 'edit-channel-listing', 'detail-push']) {
      expect(screen.getByTestId(testId).querySelector('svg')).toBeTruthy();
    }
  });

  // ===================================================================================
  // ⚠ DEVELOPMENT-ONLY comparison fixture — one page, one truth
  // ===================================================================================

  /**
   * 🔴 A fixture that stages only the comparison table made this page assert two
   * incompatible things about one fact: DIVERGED at ৳ 11,200 → ৳ 10,900 in the table, and
   * "Not readable from this channel" in the Price card directly above it. A development aid
   * that teaches an operator a contradiction is worse than no aid.
   */
  it('stages Sale Price coherently across every card that renders it', async () => {
    window.history.replaceState({}, '', '/?__devState=comparisonCases');
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('comparison-row-sale_price')).toBeTruthy());
    expect(screen.getByTestId('comparison-state-sale_price').textContent).toBe('DIVERGED');

    // The Price card must agree, and must not call the same fact unreadable.
    const price = screen.getByTestId('detail-sale-price').textContent ?? '';
    expect(price).toContain('৳ 11,200');
    expect(price).toContain('৳ 10,900');
    expect(price).not.toContain('Not readable from this channel');
  });

  /** 🔴 The unsent stock edit is staged on the record too, or the Overview contradicts it. */
  it('stages the unsent local change on the record as well as the row', async () => {
    window.history.replaceState({}, '', '/?__devState=comparisonCases');
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('comparison-row-listing_stock')).toBeTruthy());
    expect(screen.getByTestId('comparison-state-listing_stock').textContent).toContain('UNSENT');
    expect(screen.getByTestId('detail-section-overview').textContent)
      .toContain('Yes — not sent to the channel');
  });

  /**
   * 🔴 The media row counts what the Media panel is ACTUALLY showing. A fixture that claimed
   * five images beside a panel saying "No media is attached" would be the same defect in a
   * different card.
   */
  it('never claims media the page is not showing', async () => {
    window.history.replaceState({}, '', '/?__devState=comparisonCases');
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('comparison-row-media')).toBeTruthy());
    // The stub returns an empty media set, so the row must not invent a count.
    expect(screen.getByTestId('comparison-row-media').textContent).toContain('0 images');
    expect(screen.getByTestId('detail-section-media').textContent)
      .toContain('No media is attached to this listing.');
  });

  /** 🔴 The fixture never fabricates capability. Push stays honestly unavailable. */
  it('does not fake an adapter while staging the comparison', async () => {
    window.history.replaceState({}, '', '/?__devState=comparisonCases');
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('comparison-push-sale_price')).toBeTruthy());
    expect((screen.getByTestId('comparison-push-sale_price') as HTMLButtonElement).disabled).toBe(true);
    /*
      ⚠ THE REASON IS STATED ONCE, ABOVE THE TABLE, not beside every difference. It is one fact
      about the CHANNEL rather than about a row, and repeating it filled the resolution column
      with the same sentence down the page.
    */
    expect(screen.getByTestId('comparison-capability-note').textContent)
      .toContain('No marketplace adapter is configured');
    expect(screen.queryByTestId('comparison-capability-sale_price')).toBeNull();
  });

  /** 🔴 Frame 08 still opens from the staged row, with both values in the money language. */
  it('opens Accept Marketplace from the staged Sale Price row', async () => {
    window.history.replaceState({}, '', '/?__devState=comparisonCases');
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('comparison-accept-sale_price')).toBeTruthy());
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));

    const dialog = screen.getByTestId('accept-marketplace-dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const text = dialog.textContent ?? '';
    expect(text).toContain('Accept marketplace value for Sale Price?');
    expect(text).toContain('৳ 11,200');
    expect(text).toContain('৳ 10,900');
    expect(text).toContain('nothing is sent to the channel');
    expect(text).not.toContain('11200.00');
  });

  /**
   * 🔴 WITHOUT the parameter nothing is staged. The real record answers for every card, so
   * the fixture can never leak into how a Listing actually behaves.
   */
  it('renders the real record untouched when the fixture is not asked for', async () => {
    window.history.replaceState({}, '', '/');
    stubApi();
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-sale-price')).toBeTruthy());
    // LISTING reports the promotion as unreadable and holds no unsent change; both survive.
    expect(screen.getByTestId('detail-promotion-price').textContent)
      .toContain('Not readable from this channel');
    expect(screen.getByTestId('detail-section-overview').textContent).toContain('None');
    expect(screen.queryByTestId('comparison-row-media')).toBeNull();
  });
});

// =====================================================================================
// FRAME 11 + 12 — the unmapped state on Detail, and the mapping handoff
// =====================================================================================

describe('Frames 11 + 12 — mapping from the Listing', () => {
  /** 🔴 `PRD-178.d` — valid, not an error, with the one real consequence named once. */
  it('states UNMAPPED as valid and names only the push consequence', async () => {
    stubApi(undefined, { ...LISTING, mappingState: 'UNMAPPED', mappedSkuCount: 0, mappedSellableSku: null, sellableName: null });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-mapping-summary')).toBeTruthy());

    const said = screen.getByTestId('detail-mapping-summary').textContent ?? '';
    expect(said).toContain('UNMAPPED');
    expect(said).toContain('is valid');
    expect(said).toContain('cannot be pushed until a mapping exists');
    // 🔴 It is never dressed as a failure, a divergence or a sync problem (§37).
    expect(said).not.toMatch(/error|failed|diverged/i);
  });

  /** 🔴 §6 — Detail states the mapping and hands off; Frame 12 owns the interaction. */
  it('opens the Mapping modal rather than a second mapping editor', async () => {
    stubApi(undefined, { ...LISTING, mappingState: 'UNMAPPED', mappedSkuCount: 0, mappedSellableSku: null, sellableName: null });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-change-mapping')).toBeTruthy());
    expect(screen.getByTestId('detail-change-mapping').textContent).toBe('Map to Sellable Product');

    fireEvent.click(screen.getByTestId('detail-change-mapping'));
    await waitFor(() => expect(screen.getByTestId('mapping-modal')).toBeTruthy());
    // The Listing stays mounted underneath: no navigation, no lost position (§26).
    expect(screen.getByTestId('channel-listing-detail')).toBeTruthy();
  });

  it('offers Change mapping once a mapping exists', async () => {
    stubApi();
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-change-mapping')).toBeTruthy());
    expect(screen.getByTestId('detail-change-mapping').textContent).toBe('Change mapping');
  });

  /** 🔴 §24 — view authority may see the mapping but never change it. */
  it('offers no mapping action without manage authority', async () => {
    stubApi(['product.channel-listing.view']);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-mapping-summary')).toBeTruthy());
    expect(screen.queryByTestId('detail-change-mapping')).toBeNull();
  });
});

/**
 * FRAME 06 against a DISCOVERED listing — the production shape of 2026-08-18.
 *
 * 🔴 The claim is that a listing with NO intent and READABLE reported values still offers the
 * ratified resolution path. `PRD-181` compares intent against reported, and a null intent
 * beside a reported value DIFFERS — so `PRD-184.b` Accept Marketplace stays reachable and the
 * operator is never stranded with an empty record and no way to fill it.
 *
 * ⚠ The reported title is NON-ASCII and mixed-language, exactly as the real seller's is.
 */
describe('Frame 06 — a discovered Listing with nothing authored yet', () => {
  const DISCOVERED: ChannelListing = {
    ...LISTING,
    intendedTitle: null,
    intendedDescription: null,
    salePrice: null,
    listingStock: null,
    intendedChannelCategory: null,
    channelReportedTitle: 'ইন্টেল কোর i5 7500 Desktop PC',
    reportedTitleReadable: true,
    syncState: 'PENDING',
    hasUnsentLocalChanges: false,
    lastSuccessfulPushAt: null,
  };

  /** Every readable reported fact differs from a null intent, so all of them are resolvable. */
  const NULL_INTENT_ROWS: readonly ComparisonRow[] = [
    { fieldKey: 'title', label: 'Title', intendedValue: null, reportedValue: 'ইন্টেল কোর i5 7500 Desktop PC', reportedReadable: true, state: 'DIVERGED', resolvable: true },
    { fieldKey: 'sale_price', label: 'Sale Price', intendedValue: null, reportedValue: '49800.00', reportedReadable: true, state: 'DIVERGED', resolvable: true },
  ];

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  /**
   * 🔴 GATED ON THE LIVE COMPARISON, NOT ON THE STORED SYNC STATE. The listing reads PENDING —
   * discovery deliberately does not decide a sync state (`INV-107.4`, `GAP-134`) — and the
   * action must still appear, because a readable fact genuinely differs.
   */
  it('offers Resolve divergence even though the stored sync state is PENDING', async () => {
    stubApiWithComparison(NULL_INTENT_ROWS, DISCOVERED);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-resolve')).toBeTruthy());
    expect(screen.getByTestId('detail-resolve').textContent).toContain('Resolve divergence');
  });

  /**
   * 🔴 THE TITLE FALLBACK IS PINNED. With no intended title the provider's own reported title
   * is shown AS RECEIVED — non-ASCII, mixed-language and untranslated.
   *
   * ⚠ `name_en` is an ORDINARY reported attribute and is NEVER silently promoted to the title.
   * Mapping it would be a `DZC-026` / `PRD-202` decision that no rule has taken.
   */
  it('falls back to the provider reported title without substituting name_en', async () => {
    stubApiWithComparison(NULL_INTENT_ROWS, DISCOVERED);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-resolve')).toBeTruthy());
    const heading = document.body.textContent ?? '';
    expect(heading).toContain('ইন্টেল কোর i5 7500 Desktop PC');
    /* 🔴 Not "Untitled listing" — a reported title exists and is used. */
    expect(screen.queryByText('Untitled listing')).toBeNull();
  });

  /** ✅ The ERP side says plainly that nothing is authored, rather than showing a blank. */
  it('states that the intended title is not set locally', async () => {
    stubApiWithComparison(NULL_INTENT_ROWS, DISCOVERED);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-resolve')).toBeTruthy());
    expect(document.body.textContent).toContain('Not set locally');
  });
});

/**
 * PROVIDER MARKUP MADE READABLE — the production defect of 2026-08-19.
 *
 * 🔴 A Daraz `short_description` arrived as `<ul><li>Processor : Intel&reg; …</li></ul>` and
 * rendered as raw tag soup in the attribute table and the Intended-vs-Reported column, making
 * the page unreadable and one row taller than the rest of it.
 *
 * 🔴 THE FIX IS PRESENTATION ONLY. Nothing stored changes, and no markup is ever executed —
 * `dangerouslySetInnerHTML` appears nowhere in this codebase.
 */
describe('Frame 06 — provider markup is rendered as readable text', () => {
  const HTML_DESCRIPTION = '<ul style="margin:0"> <li>Processor : Intel&reg; Core&trade; i5-7500</li>'
    + ' <li>RAM : 8GB DDR4 Any Brands&nbsp;</li> </ul>';

  const WITH_MARKUP: ChannelListing = {
    ...LISTING,
    intendedTitle: null,
    intendedDescription: null,
    reportedDescription: HTML_DESCRIPTION,
    reportedDescriptionReadable: true,
    channelReportedTitle: 'Intel Core i5 7500 Desktop PC',
    reportedTitleReadable: true,
  };

  const MARKUP_ROWS: readonly ComparisonRow[] = [
    {
      fieldKey: 'attribute:short_description',
      label: 'short_description',
      intendedValue: null,
      reportedValue: HTML_DESCRIPTION,
      reportedReadable: true,
      state: 'DIVERGED',
      resolvable: true,
    },
  ];

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  /** 🔴 The attribute cell shows words, not tags. */
  it('renders a marketplace attribute as readable text', async () => {
    stubApiWithComparison(MARKUP_ROWS, WITH_MARKUP);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-attributes')).toBeTruthy());

    const cell = screen.getByTestId('attribute-reported-attribute:short_description');
    const text = cell.textContent ?? '';
    expect(text).toContain('Processor : Intel® Core™ i5-7500');
    expect(text).toContain('RAM : 8GB DDR4 Any Brands');
    expect(text).not.toContain('<li>');
    expect(text).not.toContain('&reg;');
    expect(text).not.toContain('&nbsp;');
    expect(text).not.toContain('margin:0');
  });

  /** 🔴 NOTHING IS EXECUTED — the value becomes text nodes, never elements. */
  it('never turns provider markup into live elements', async () => {
    stubApiWithComparison(MARKUP_ROWS, WITH_MARKUP);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-attributes')).toBeTruthy());

    const cell = screen.getByTestId('attribute-reported-attribute:short_description');
    expect(cell.querySelector('ul')).toBeNull();
    expect(cell.querySelector('li')).toBeNull();
    expect(cell.innerHTML).not.toContain('<ul');
  });

  /** ⚠ A long value is CONTAINED so the row keeps the height its neighbours have. */
  it('contains a long value instead of letting it set the row height', async () => {
    stubApiWithComparison(MARKUP_ROWS, WITH_MARKUP);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-attributes')).toBeTruthy());

    const style = screen.getByTestId('attribute-reported-attribute:short_description').getAttribute('style') ?? '';
    expect(style).toContain('max-height');
    expect(style).toContain('overflow-y: auto');
  });

  /** ✅ The description gets its own readable pair rather than a clipped one-line cell. */
  it('shows the reported description as a readable block', async () => {
    stubApiWithComparison(MARKUP_ROWS, WITH_MARKUP);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-reported-description')).toBeTruthy());

    const text = screen.getByTestId('detail-reported-description').textContent ?? '';
    expect(text).toContain('Processor : Intel® Core™ i5-7500');
    expect(text).not.toContain('<ul');
    expect(screen.getByTestId('detail-intended-description').textContent).toContain('Not set locally');
  });

  /**
   * 🔴 `DZC-026` — the channel's own title is shown as received, and `name_en` is NEVER
   * substituted for it. It remains an ordinary attribute.
   */
  it('shows the channel reported title without substituting an attribute', async () => {
    stubApiWithComparison(
      [
        ...MARKUP_ROWS,
        { fieldKey: 'attribute:name_en', label: 'name_en', intendedValue: null, reportedValue: 'English Name', reportedReadable: true, state: 'DIVERGED', resolvable: true },
      ],
      WITH_MARKUP,
    );
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('detail-attributes')).toBeTruthy());

    /* ✅ name_en appears in the attribute table, where it belongs. */
    expect(screen.getByTestId('attribute-reported-attribute:name_en').textContent).toContain('English Name');
    /* 🔴 And the page heading is not it. */
    expect(document.querySelector('h1')?.textContent ?? '').not.toContain('English Name');
  });
});
