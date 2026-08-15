import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingEditPage from './ChannelListingEditPage';
import type { ChannelListing, ChannelListingSku } from './channelListingApi';

/**
 * FRAME 10 — Edit Listing.
 *
 * <p>🔴 The central claim under test is that Frame 10 IS Frame 09, populated: the same five
 * sections, the same controls and the same readiness engine, differing only in what the draft
 * starts as, what identity is shown, and what the save does.
 *
 * <p>🔴 The second claim is that editing invents nothing. It does not push (`PRD-185`), does
 * not retype a channel-owned identifier (`PRD-188.c`), does not reassign the shop, does not
 * materialise a fallback as an override (`PRD-198.c`, `PRD-202.c`), and does not write a
 * listing-level price onto a variation listing (`INV-106.2`).
 */

const CHANNELS = [
  {
    id: 'ch-1', code: 'DARAZ-A', name: 'Daraz account A', channelType: 'DARAZ',
    adapterAvailable: false, knownListings: 12, lastSyncAt: null, capabilities: [],
  },
  {
    id: 'ch-2', code: 'DARAZ-B', name: 'Daraz account B', channelType: 'DARAZ',
    adapterAvailable: false, knownListings: 3, lastSyncAt: null, capabilities: [],
  },
];

const SKU: ChannelListingSku = {
  id: 'sku-1',
  channelSku: 'SLR-22IPS-BLK',
  sellableProductId: null,
  sellableSku: null,
  sellableName: null,
  salePrice: '11200.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: '11200.00',
  promotionActive: false,
  listingStock: '31',
  reportedSalePrice: null,
  reportedSalePriceReadable: true,
  reportedPromotionPrice: null,
  reportedPromotionPriceReadable: true,
  reportedPromotionStartsAt: null,
  reportedPromotionEndsAt: null,
  reportedPromotionWindowReadable: true,
  reportedStock: null,
  reportedStockReadable: true,
  packageWeightKg: '2.400',
  packageLengthCm: '55.0',
  packageWidthCm: '35.0',
  packageHeightCm: '12.0',
  packageContent: '1 monitor, 1 stand, 1 power cable',
  variationLabel: null,
  position: 0,
};

/** A published, single-SKU listing carrying its own English highlights. */
const LISTING: ChannelListing = {
  id: 'L-1',
  channelInstanceId: 'ch-1',
  channelInstance: 'DARAZ-A',
  channelName: 'Daraz account A',
  channelType: 'DARAZ',
  adapterAvailable: false,
  externalListingId: 'DRZ-87720113',
  mappingState: 'UNMAPPED',
  skuCount: 1,
  mappedSkuCount: 0,
  sellableProductId: null,
  mappedSellableSku: null,
  sellableName: null,
  intendedTitle: 'Hi-Power 22 Inch IPS Monitor',
  intendedDescription: 'A 22 inch IPS panel for everyday desk work.',
  intendedTitleBn: null,
  intendedDescriptionBn: null,
  effectiveTitleBn: 'Hi-Power 22 Inch IPS Monitor',
  effectiveDescriptionBn: 'A 22 inch IPS panel for everyday desk work.',
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
  channelReportedTitle: 'Hi-Power 22 IPS Monitor',
  reportedTitleReadable: true,
  reportedDescription: null,
  reportedDescriptionReadable: true,
  reportedSalePrice: '11500.00',
  reportedSalePriceReadable: true,
  reportedPromotionPrice: null,
  reportedPromotionPriceReadable: true,
  reportedPromotionStartsAt: null,
  reportedPromotionEndsAt: null,
  reportedPromotionWindowReadable: true,
  reportedStock: '29',
  reportedStockReadable: true,
  reportedChannelCategory: null,
  reportedChannelCategoryReadable: true,
  listingStatus: 'ACTIVE',
  syncState: 'DIVERGED',
  localLifecycle: 'PUBLISHED',
  hasUnsentLocalChanges: false,
  divergedFactCount: 2,
  primaryMediaReference: null,
  highlights: ['22 inch IPS panel', '75 Hz refresh rate'],
  highlightsAreFallback: false,
  highlightsBn: [],
  effectiveHighlightsBn: ['22 inch IPS panel', '75 Hz refresh rate'],
  highlightsBnAreFallback: true,
  lastSyncAt: '2026-08-14T02:41:21Z',
  lastSeenInDiscoveryAt: null,
  lastSuccessfulPushAt: '2026-08-14T02:41:21Z',
  updatedAt: '2026-08-14T02:41:21Z',
  version: 7,
  skus: [SKU],
};

/**
 * The same listing before the marketplace ever accepted it: no identifier, never pushed.
 *
 * 🔴 `PRD-188.b` — remote identity is what divides the two lifecycles, so this fixture differs
 * from LISTING in exactly that one fact and the state that follows from it.
 */
const UNPUBLISHED: ChannelListing = {
  ...LISTING,
  externalListingId: null,
  localLifecycle: 'DRAFT',
  syncState: 'PENDING',
  listingStatus: null,
  lastSuccessfulPushAt: null,
  reportedSalePrice: null,
  reportedStock: null,
  divergedFactCount: 0,
};

let sent: { url: string; method: string; body: unknown }[] = [];
let listingResponse: Partial<ChannelListing> | null = LISTING;
let listingStatus = 200;

function stubApi(permissions: readonly string[] = [
  'product.channel-listing.view',
  'product.channel-listing.manage',
]): void {
  sent = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (init?.method === 'PUT' || init?.method === 'POST') {
      sent.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 204 });
    }
    if (url.includes('/api/auth/me')) {
      return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions });
    }
    if (url.includes('/channels')) return json(CHANNELS);
    if (url.includes('/sellable-products')) {
      return json({ content: [], page: 0, size: 6, totalElements: 0, totalPages: 0 });
    }
    if (/\/channel-listings\/[^/]+$/.test(url)) {
      if (listingStatus !== 200) return json({ message: 'You cannot read this Listing.' }, listingStatus);
      return json(listingResponse);
    }
    return json({});
  }));
}

function renderEdit(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings/L-1/edit']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/:id/edit" element={<ChannelListingEditPage />} />
            <Route path="/inventory/products/listings/:id" element={<div data-testid="landed-on-detail" />} />
            <Route path="/inventory/products/listings" element={<div data-testid="landed-on-workspace" />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Renders and waits for the loaded form, so each test starts from populated content. */
async function loaded(): Promise<void> {
  renderEdit();
  await waitFor(() => expect(screen.getByTestId('create-section-basic')).toBeTruthy());
}

const setField = (testId: string, value: string): void => {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
};
const value = (testId: string): string => (screen.getByTestId(testId) as HTMLInputElement).value;
const body = (): Record<string, unknown> => sent[0]?.body as Record<string, unknown>;
const save = (): void => { fireEvent.click(screen.getByTestId('create-save-header')); };

beforeEach(() => {
  listingResponse = LISTING;
  listingStatus = 200;
  stubApi();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// =====================================================================================
// It is Frame 09, populated
// =====================================================================================

describe('Frame 10 — the same form as Frame 09', () => {
  it('renders the identical five sections in the identical order', async () => {
    await loaded();
    const titles = ['basic', 'specification', 'commercial', 'description', 'shipping']
      .map((id) => screen.getByTestId(`create-section-${id}`).querySelector('h2')?.textContent);
    expect(titles).toEqual([
      'Basic information',
      'Product specification',
      'Price, stock and variants',
      'Product description',
      'Shipping and warranty',
    ]);
  });

  it('keeps the same readiness sidebar rather than an edit-only variant', async () => {
    await loaded();
    expect(screen.getByTestId('create-readiness')).toBeTruthy();
  });

  it('titles the page Edit Listing', async () => {
    await loaded();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit Listing');
  });

  it('names the listing by shop, channel identifier and orderable unit — never the UUID', async () => {
    await loaded();
    const subtitle = document.body.textContent ?? '';
    expect(subtitle).toContain('Daraz account A');
    expect(subtitle).toContain('DRZ-87720113');
    expect(subtitle).toContain('SLR-22IPS-BLK');
  });
});

// =====================================================================================
// Prefill — the listing's OWN content, never a derived or effective one
// =====================================================================================

describe('Frame 10 — prefill', () => {
  it('populates the authored English content', async () => {
    await loaded();
    expect(value('field-intended-title')).toBe('Hi-Power 22 Inch IPS Monitor');
    expect(value('field-sale-price')).toBe('11200.00');
    expect(value('field-published-stock')).toBe('31');
    expect(value('field-channel-category')).toBe('Electronics > Monitors');
  });

  it('populates the parcel from the orderable SKU', async () => {
    await loaded();
    expect(value('field-package-weight')).toBe('2.400');
    expect(value('field-package-length')).toBe('55.0');
    expect(value('field-package-width')).toBe('35.0');
    expect(value('field-package-height')).toBe('12.0');
    expect(value('field-package-content')).toBe('1 monitor, 1 stand, 1 power cable');
  });

  it("prefills the listing's OWN highlights", async () => {
    await loaded();
    expect(value('field-highlights')).toBe('22 inch IPS panel\n75 Hz refresh rate');
  });

  it('leaves highlights EMPTY when the effective set is a fallback', async () => {
    listingResponse = { ...LISTING, highlights: ['from the master product'], highlightsAreFallback: true };
    await loaded();
    // 🔴 `PRD-198.c` — opening the page must not consume the fallback by materialising it.
    expect(value('field-highlights')).toBe('');
  });

  it('leaves the Bangla override EMPTY when only the derived Bangla exists', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('language-bn'));
    // 🔴 `PRD-202.c` — the effective Bangla is DERIVED. Prefilling it would freeze a
    //    fallback into an override that then stops following the English.
    expect(value('field-intended-title-bn')).toBe('');
  });

  it('prefills the Bangla override when the listing genuinely holds one', async () => {
    listingResponse = { ...LISTING, intendedTitleBn: 'হাই-পাওয়ার ২২ ইঞ্চি মনিটর' };
    await loaded();
    fireEvent.click(screen.getByTestId('language-bn'));
    expect(value('field-intended-title-bn')).toBe('হাই-পাওয়ার ২২ ইঞ্চি মনিটর');
  });

  it('opens the promotion block already expanded when a promotion exists', async () => {
    listingResponse = {
      ...LISTING,
      promotionPrice: '9990.00',
      promotionStartsAt: '2026-09-01T04:00:00Z',
      promotionEndsAt: '2026-09-07T04:00:00Z',
    };
    await loaded();
    expect(screen.getByTestId('promotion-fields')).toBeTruthy();
    expect(value('field-promotion-price')).toBe('9990.00');
  });
});

// =====================================================================================
// Identity — what edit may not change
// =====================================================================================

describe('Frame 10 — identity is not editable', () => {
  it('shows the channel as a fact, with no dropdown to reassign the shop', async () => {
    await loaded();
    expect(screen.getByTestId('edit-channel-readonly').textContent).toContain('Daraz account A');
    expect(screen.queryByTestId('field-channel-instance')).toBeNull();
  });

  it('shows the channel-issued identifier read-only', async () => {
    await loaded();
    const shown = screen.getByTestId('edit-external-id');
    expect(shown.textContent).toBe('DRZ-87720113');
    expect(shown.querySelector('input')).toBeNull();
  });

  it('says "Not published" rather than showing a blank identifier', async () => {
    listingResponse = { ...LISTING, externalListingId: null, localLifecycle: 'DRAFT' };
    await loaded();
    expect(screen.getByTestId('edit-external-id').textContent).toBe('Not published');
  });

  it('never sends an external listing id back', async () => {
    await loaded();
    setField('field-intended-title', 'Hi-Power 22 Inch IPS Monitor v2');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    expect(body().externalListingId).toBeNull();
  });

  it('shows the Seller SKU as a fact, not a control', async () => {
    await loaded();
    expect(screen.getByTestId('edit-channel-sku-readonly').textContent).toBe('SLR-22IPS-BLK');
    expect(screen.queryByTestId('field-channel-sku')).toBeNull();
  });

  it('hands mapping off instead of offering a picker', async () => {
    await loaded();
    expect(screen.queryByTestId('sellable-search-run')).toBeNull();
    expect(screen.getByTestId('edit-mapping-summary').textContent).toContain('Unmapped');
  });

  it('reports a partial mapping truthfully', async () => {
    listingResponse = { ...LISTING, skuCount: 3, mappedSkuCount: 2, mappingState: 'PARTIALLY_MAPPED' };
    await loaded();
    expect(screen.getByTestId('edit-mapping-summary').textContent).toContain('2 of 3 SKUs mapped');
  });
});

// =====================================================================================
// Dirty state and leaving
// =====================================================================================

describe('Frame 10 — unsaved changes', () => {
  it('disables Save changes until something actually changes', async () => {
    await loaded();
    expect((screen.getByTestId('create-save-header') as HTMLButtonElement).disabled).toBe(true);
    setField('field-intended-title', 'Hi-Power 22 Inch IPS Monitor v2');
    expect((screen.getByTestId('create-save-header') as HTMLButtonElement).disabled).toBe(false);
  });

  it('becomes clean again when an edit is typed back to its original value', async () => {
    await loaded();
    setField('field-sale-price', '11999.00');
    expect((screen.getByTestId('create-save-header') as HTMLButtonElement).disabled).toBe(false);
    setField('field-sale-price', '11200.00');
    expect((screen.getByTestId('create-save-header') as HTMLButtonElement).disabled).toBe(true);
  });

  it('leaves without asking when nothing has changed', async () => {
    const confirmed = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await loaded();
    fireEvent.click(screen.getByTestId('create-discard'));
    expect(confirmed).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('landed-on-detail')).toBeTruthy());
  });

  it('asks before leaving with unsaved changes, and stays when refused', async () => {
    const confirmed = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await loaded();
    setField('field-intended-title', 'Something else');
    fireEvent.click(screen.getByTestId('create-discard'));
    expect(confirmed).toHaveBeenCalled();
    expect(screen.queryByTestId('landed-on-detail')).toBeNull();
    expect(screen.getByTestId('create-section-basic')).toBeTruthy();
  });

  it('says nothing has changed yet, then names the consequence once it has', async () => {
    await loaded();
    expect(screen.getByTestId('edit-after-saving').textContent).toContain('Nothing on this page has been saved yet');
    setField('field-intended-title', 'Something else');
    expect(screen.getByTestId('edit-after-saving').textContent).toContain('unsent local changes');
  });

  it('never claims an edit will make the listing diverged', async () => {
    await loaded();
    setField('field-intended-title', 'Something else');
    const panel = screen.getByTestId('edit-after-saving').parentElement?.textContent ?? '';
    expect(panel).toContain('never marks the listing diverged');
  });
});

// =====================================================================================
// Saving is local — PRD-185
// =====================================================================================

describe('Frame 10 — save is not push', () => {
  it('sends exactly one local PUT and nothing else', async () => {
    await loaded();
    setField('field-intended-title', 'Hi-Power 22 Inch IPS Monitor v2');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    const only = sent[0]!;
    expect(only.method).toBe('PUT');
    expect(only.url).toContain('/channel-listings/L-1');
    expect(only.url).not.toContain('/operations');
    expect(only.url).not.toContain('/publish');
  });

  it('carries the loaded version so a concurrent edit is refused, not overwritten', async () => {
    await loaded();
    setField('field-intended-title', 'Hi-Power 22 Inch IPS Monitor v2');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    expect(body().version).toBe(7);
  });

  it('offers exactly one dark primary, labelled Save changes', async () => {
    await loaded();
    expect(screen.getByTestId('create-save-header').textContent).toContain('Save changes');
    expect(screen.queryByText(/Save & Push/i)).toBeNull();
    expect(screen.queryByText(/Publish Now/i)).toBeNull();
  });

  it('sends money as the exact strings typed, never as numbers', async () => {
    await loaded();
    setField('field-sale-price', '11200.50');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    expect(body().salePrice).toBe('11200.50');
    expect(typeof body().salePrice).toBe('string');
  });

  it('returns to the Listing after a successful save', async () => {
    await loaded();
    setField('field-intended-title', 'Hi-Power 22 Inch IPS Monitor v2');
    save();
    await waitFor(() => expect(screen.getByTestId('landed-on-detail')).toBeTruthy());
  });

  it('never sends a mapping, so an empty picker cannot unmap the listing', async () => {
    await loaded();
    setField('field-intended-title', 'Hi-Power 22 Inch IPS Monitor v2');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    expect(body().mappedSellableSku).toBeNull();
  });

  it('clears a Bangla override that is emptied, rather than falling back to English', async () => {
    listingResponse = { ...LISTING, intendedTitleBn: 'হাই-পাওয়ার' };
    await loaded();
    fireEvent.click(screen.getByTestId('language-bn'));
    setField('field-intended-title-bn', '');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    expect(body().intendedTitleBn).toBeNull();
    expect(body().intendedTitle).toBe('Hi-Power 22 Inch IPS Monitor');
  });
});

// =====================================================================================
// Variation listings — INV-106.2
// =====================================================================================

describe('Frame 10 — a variation listing', () => {
  const MULTI = {
    ...LISTING,
    skuCount: 2,
    priceIsFrom: true,
    skus: [SKU, { ...SKU, id: 'sku-2', channelSku: 'SLR-22IPS-WHT', position: 1 }],
  };

  it('says why price, stock and parcel are not edited here', async () => {
    listingResponse = MULTI;
    await loaded();
    const notice = screen.getByTestId('per-sku-only-notice').textContent ?? '';
    expect(notice).toContain('2 orderable SKUs');
    expect(notice).toContain('belong to each SKU separately');
  });

  it('disables the per-SKU figures rather than pretending one value fits both', async () => {
    listingResponse = MULTI;
    await loaded();
    for (const id of ['field-sale-price', 'field-published-stock', 'field-package-weight', 'field-package-content']) {
      expect((screen.getByTestId(id) as HTMLInputElement).disabled).toBe(true);
    }
    expect((screen.getByTestId('add-promotion') as HTMLButtonElement).disabled).toBe(true);
  });

  it('leaves the listing-wide content editable', async () => {
    listingResponse = MULTI;
    await loaded();
    expect((screen.getByTestId('field-intended-title') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByTestId('field-highlights') as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('reports the real SKU count instead of a create-mode chip', async () => {
    listingResponse = MULTI;
    await loaded();
    expect(screen.getByTestId('sku-mode-multiple').textContent).toBe('2 SKUs');
  });

  it('never ticks a listing-level figure it did not inspect', async () => {
    listingResponse = MULTI;
    await loaded();
    const panel = screen.getByTestId('create-readiness').textContent ?? '';
    // 🔴 Ticking "Sale Price set" here would report a figure as ready while the figures the
    //    channel will actually see live on each SKU and were never shown.
    expect(panel).not.toContain('Sale Price set');
    expect(panel).not.toContain('Listing stock set');
    expect(panel).not.toContain('Seller SKU set');
    expect(panel).toContain('held on each of the 2 orderable SKUs');
    expect(panel).toContain('Parcel facts are held on each of the 2 orderable SKUs');
  });

  it('greys the refused controls so a dead field never looks editable', async () => {
    listingResponse = MULTI;
    await loaded();
    const price = screen.getByTestId('field-sale-price') as HTMLInputElement;
    expect(price.disabled).toBe(true);
    expect(price.style.cursor).toBe('not-allowed');
    expect(price.style.background).toBe('var(--color-strip)');
  });

  it('narrates no single offer, because a variation listing has none', async () => {
    listingResponse = MULTI;
    await loaded();
    expect(screen.queryByTestId('create-price-preview')).toBeNull();
  });

  it('prefills no parcel, because a variation listing has no single carton', async () => {
    listingResponse = MULTI;
    await loaded();
    expect(value('field-package-weight')).toBe('');
    expect(value('field-package-content')).toBe('');
  });
});

// =====================================================================================
// Validation is the shared engine, not an edit-only copy
// =====================================================================================

describe('Frame 10 — validation', () => {
  it('refuses a promotion above the Sale Price', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('add-promotion'));
    setField('field-promotion-price', '99999.00');
    setField('field-promotion-starts', '2026-09-01T10:00');
    setField('field-promotion-ends', '2026-09-07T10:00');
    save();
    await waitFor(() => expect(screen.getByTestId('error-promotionPrice')).toBeTruthy());
    expect(sent.length).toBe(0);
  });

  it('refuses a promotion with no window', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('add-promotion'));
    setField('field-promotion-price', '9990.00');
    save();
    await waitFor(() => expect(screen.getByTestId('error-promotionStartsAt')).toBeTruthy());
    expect(screen.getByTestId('error-promotionEndsAt')).toBeTruthy();
    expect(sent.length).toBe(0);
  });
});

// =====================================================================================
// Authority and unreadable records
// =====================================================================================

describe('Frame 10 — authority and failure', () => {
  it('refuses the direct route without manage authority', async () => {
    stubApi(['product.channel-listing.view']);
    await waitFor(async () => { renderEdit(); });
    await waitFor(() => expect(screen.getByText(/cannot edit Listings/i)).toBeTruthy());
    expect(screen.queryByTestId('create-save-header')).toBeNull();
  });

  it('says the Listing could not be read rather than showing a blank form', async () => {
    listingStatus = 403;
    renderEdit();
    // 🔴 `SYS-034` — unreadable is not empty. A blank form here would invite an operator to
    //    author over content they were never shown.
    await waitFor(() => expect(screen.getByText(/could not be loaded/i)).toBeTruthy());
    expect(screen.queryByTestId('create-section-basic')).toBeNull();
  });
});

// =====================================================================================
// Lifecycle — an edit is not a creation
// =====================================================================================

describe('Frame 10 — lifecycle is context-aware', () => {
  it('never shows the first-publication path for a published listing', async () => {
    await loaded();
    // 🔴 The channel issued DRZ-87720113 long ago. Telling the operator it will "return the
    //    external listing ID" describes a transition that has already happened.
    expect(screen.queryByTestId('edit-lifecycle-first-publication')).toBeNull();
    const card = screen.getByTestId('edit-lifecycle-update').textContent ?? '';
    expect(card).not.toContain('DRAFT');
    expect(card).not.toContain('returns the external listing ID');
    expect(card).not.toContain('PENDING PUBLICATION');
  });

  it('shows the update path for a listing with remote identity', async () => {
    await loaded();
    const card = screen.getByTestId('edit-lifecycle-update').textContent ?? '';
    expect(card).toContain('Existing marketplace listing');
    expect(card).toContain('UNSENT LOCAL CHANGES');
    expect(card).toContain('Push update');
    expect(card).toContain('marketplace readback');
  });

  it('shows the first-publication path only when no identifier exists yet', async () => {
    listingResponse = UNPUBLISHED;
    await loaded();
    const card = screen.getByTestId('edit-lifecycle-first-publication').textContent ?? '';
    expect(card).toContain('DRAFT');
    expect(card).toContain('PENDING PUBLICATION');
    expect(card).toContain('the channel returns the external listing ID');
    expect(screen.queryByTestId('edit-lifecycle-update')).toBeNull();
  });

  it('reports the channel status separately from the local lifecycle', async () => {
    await loaded();
    // 🔴 `UX-038` — four independent dimensions. ACTIVE is the channel's; it is never folded
    //    into the local lifecycle flow.
    expect(screen.getByTestId('edit-channel-status').textContent).toContain('ACTIVE');
    expect(screen.getByTestId('edit-lifecycle-update').textContent).not.toContain('ACTIVE');
  });

  it('states no channel status when the channel has reported none', async () => {
    listingResponse = UNPUBLISHED;
    await loaded();
    expect(screen.queryByTestId('edit-channel-status')).toBeNull();
  });
});

// =====================================================================================
// After saving — truthful, and never a claim about the marketplace
// =====================================================================================

describe('Frame 10 — the after-saving card', () => {
  it('says nothing has been saved before anything is edited', async () => {
    await loaded();
    expect(screen.getByTestId('edit-after-saving').textContent)
      .toContain('Nothing on this page has been saved yet');
  });

  it('promises UNSENT, never a marketplace update, for a published listing', async () => {
    await loaded();
    setField('field-intended-title', 'Something else');
    const said = screen.getByTestId('edit-after-saving').textContent ?? '';
    expect(said).toContain('unsent local changes');
    expect(said).not.toMatch(/updated on|sent to|live on/i);
  });

  it('never says a save makes the listing diverged', async () => {
    await loaded();
    setField('field-intended-title', 'Something else');
    const card = screen.getByTestId('edit-after-saving').parentElement?.textContent ?? '';
    expect(card).toContain('never marks the listing diverged');
    expect(card).toContain('reporting something different');
  });

  it('says there is nothing to send when the listing is not on the marketplace', async () => {
    listingResponse = UNPUBLISHED;
    await loaded();
    setField('field-intended-title', 'Something else');
    expect(screen.getByTestId('edit-after-saving').textContent)
      .toContain('not on the marketplace yet, so there is nothing to send');
  });

  it('states plainly that no adapter means no push can run', async () => {
    await loaded();
    // 🔴 The fixture channel has no adapter. Implying a push could follow would be a claim
    //    about a capability that does not exist.
    expect(screen.getByTestId('edit-push-availability').textContent)
      .toContain('a push cannot run at all right now');
  });

  it('does not claim a push where one has never happened', async () => {
    listingResponse = UNPUBLISHED;
    await loaded();
    expect(screen.getByTestId('edit-last-push').textContent).toBe('Never pushed');
  });
});

// =====================================================================================
// Seller SKU — the ratified identity rule
// =====================================================================================

describe('Frame 10 — Seller SKU identity', () => {
  it('is read-only once the marketplace has issued an identity', async () => {
    await loaded();
    expect(screen.getByTestId('edit-channel-sku-readonly').textContent).toContain('SLR-22IPS-BLK');
    expect(screen.queryByTestId('field-channel-sku')).toBeNull();
  });

  it('is editable while the listing has never been published', async () => {
    listingResponse = UNPUBLISHED;
    await loaded();
    const field = screen.getByTestId('field-channel-sku') as HTMLInputElement;
    expect(field.value).toBe('SLR-22IPS-BLK');
    expect(field.disabled).toBe(false);
    expect(screen.queryByTestId('edit-channel-sku-readonly')).toBeNull();
  });

  it('sends a corrected Seller SKU for an unpublished listing', async () => {
    listingResponse = UNPUBLISHED;
    await loaded();
    setField('field-channel-sku', 'SLR-22IPS-V2');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    expect(body().channelSku).toBe('SLR-22IPS-V2');
  });

  it('round-trips the published SKU unchanged, so the save is a no-op for it', async () => {
    await loaded();
    setField('field-intended-title', 'Something else');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    expect(body().channelSku).toBe('SLR-22IPS-BLK');
  });

  it('is read-only on a variation listing whatever its publication state', async () => {
    listingResponse = { ...UNPUBLISHED, skuCount: 2, skus: [SKU, { ...SKU, id: 'sku-2', position: 1 }] };
    await loaded();
    expect(screen.getByTestId('edit-channel-sku-readonly').textContent).toContain('2 orderable units');
    expect(screen.queryByTestId('field-channel-sku')).toBeNull();
  });
});

// =====================================================================================
// FRAMES 11 + 12 — the Edit mapping handoff
// =====================================================================================

describe('Frame 10 + 12 — mapping from Edit', () => {
  it('opens the same Mapping modal from the compact handoff', async () => {
    await loaded();
    fireEvent.click(screen.getByTestId('edit-open-mapping'));
    await waitFor(() => expect(screen.getByTestId('mapping-modal')).toBeTruthy());
    // 🔴 §7 — a handoff, never a free Sellable Product dropdown inside the form.
    expect(screen.queryByTestId('sellable-search-run')).toBeNull();
  });

  /**
   * 🔴 §27 — THE UNSAVED FORM MUST SURVIVE. Mapping is a separately persisted relationship;
   * opening and closing its modal has nothing to do with what the operator has typed.
   */
  it('keeps unsaved Edit values across opening and closing the modal', async () => {
    await loaded();
    setField('field-intended-title', 'A title being written');
    setField('field-sale-price', '12345.67');

    fireEvent.click(screen.getByTestId('edit-open-mapping'));
    await waitFor(() => expect(screen.getByTestId('mapping-modal')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('mapping-modal')).toBeNull());

    expect(value('field-intended-title')).toBe('A title being written');
    expect(value('field-sale-price')).toBe('12345.67');
    expect((screen.getByTestId('create-save-header') as HTMLButtonElement).disabled).toBe(false);
  });

  /** 🔴 §28 — the transaction boundaries stay separate in both directions. */
  it('does not save the Edit form when the modal is opened', async () => {
    await loaded();
    setField('field-intended-title', 'Not saved yet');
    fireEvent.click(screen.getByTestId('edit-open-mapping'));
    await waitFor(() => expect(screen.getByTestId('mapping-modal')).toBeTruthy());
    expect(sent.filter((c) => c.method === 'PUT' && c.url.endsWith('/L-1'))).toEqual([]);
  });

  it('never sends a mapping when Save changes is used', async () => {
    await loaded();
    setField('field-intended-title', 'Something else');
    save();
    await waitFor(() => expect(sent.length).toBe(1));
    // 🔴 Save changes writes intended content only — it never touches the relationship.
    expect(sent[0]!.url).not.toContain('/mapping');
    expect(body().mappedSellableSku).toBeNull();
  });

  /**
   * 🔴 §38 — readiness reads the LISTING, not the hidden picker. Before this it reported
   * every edited listing as unmapped, because Edit never shows a Sellable Product picker.
   */
  it('reports the mapping honestly in Listing Readiness', async () => {
    listingResponse = {
      ...LISTING, mappedSkuCount: 1, mappingState: 'MAPPED', mappedSellableSku: 'SP-000111',
    };
    await loaded();
    const panel = screen.getByTestId('create-readiness').textContent ?? '';
    expect(panel).not.toContain('Not mapped');
  });

  it('states the real count for a partially mapped variation listing', async () => {
    listingResponse = {
      ...LISTING, skuCount: 2, mappedSkuCount: 1, mappingState: 'PARTIALLY_MAPPED',
      skus: [SKU, { ...SKU, id: 'sku-2', channelSku: 'SLR-22IPS-WHT', position: 1 }],
    };
    await loaded();
    expect(screen.getByTestId('create-readiness').textContent)
      .toContain('1 of 2 SKUs mapped');
  });

  it('offers no mapping handoff without manage authority', async () => {
    stubApi(['product.channel-listing.view']);
    renderEdit();
    await waitFor(() => expect(screen.getByText(/cannot edit Listings/i)).toBeTruthy());
    expect(screen.queryByTestId('edit-open-mapping')).toBeNull();
  });
});
