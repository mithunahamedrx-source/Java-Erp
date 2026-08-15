import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingCreatePage from './ChannelListingCreatePage';
import { highlightLines } from './ListingAuthoringForm';

/**
 * FRAME 09 — Add Listing, in its five-section product-entry workflow.
 *
 * <p>🔴 The claim under test throughout is that this surface creates LOCAL intent and nothing
 * else: no push, no external identifier, no sibling shop, and no fabricated channel schema,
 * category, warranty or package requirement.
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

const PRODUCTS = [
  { id: 'sp-1', sellableSku: 'SP-003377', name: 'Hi-Power 22 IPS Monitor', nature: 'SIMPLE' },
];

let posted: { url: string; body: unknown }[] = [];

function stubApi(permissions: readonly string[] = [
  'product.channel-listing.view',
  'product.channel-listing.manage',
], products: readonly unknown[] = PRODUCTS): void {
  posted = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (init?.method === 'POST') {
      posted.push({ url, body: JSON.parse(String(init.body)) });
      return json({ id: 'new-listing-1' }, 201);
    }
    if (url.includes('/api/auth/me')) {
      return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [], permissions });
    }
    if (url.includes('/channels')) return json(CHANNELS);
    if (url.includes('/sellable-products')) {
      return json({ content: products, page: 0, size: 6, totalElements: products.length, totalPages: 1 });
    }
    return json({});
  }));
}

function renderCreate(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings/new']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/new" element={<ChannelListingCreatePage />} />
            <Route path="/inventory/products/listings/:id" element={<div data-testid="landed-on-detail" />} />
            <Route path="/inventory/products/listings" element={<div data-testid="landed-on-workspace" />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Fills the minimum a save requires, so each test varies only what it is about. */
async function fillMinimum(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
  await waitFor(() =>
    expect((screen.getByTestId('field-channel-instance') as HTMLSelectElement).options.length).toBe(3));
  fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
  fireEvent.change(screen.getByTestId('field-intended-title'), { target: { value: 'Hi-Power 22 Inch IPS Monitor' } });
}

const openPromotion = (): void => { fireEvent.click(screen.getByTestId('add-promotion')); };
const setField = (testId: string, value: string): void => {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
};
const body = (): Record<string, unknown> => posted[0]?.body as Record<string, unknown>;
const readiness = (): string => screen.getByTestId('create-readiness').textContent ?? '';

async function chooseProduct(): Promise<void> {
  fireEvent.click(screen.getByTestId('sellable-search-run'));
  await waitFor(() => expect(screen.getByTestId('sellable-result-0')).toBeTruthy());
  fireEvent.click(screen.getByTestId('sellable-result-0'));
}

beforeEach(() => stubApi());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// =====================================================================================
// Structure
// =====================================================================================

describe('Frame 09 — structure', () => {
  it('renders the five operational sections in workflow order', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-section-basic')).toBeTruthy());
    const titles = ['basic', 'specification', 'commercial', 'description', 'shipping']
      .map((id) => screen.getByTestId(`create-section-${id}`).querySelector('h2')?.textContent);
    expect(titles).toEqual([
      'Basic information',
      'Product specification',
      'Price, stock and variants',
      'Product description',
      'Shipping and warranty',
    ]);
    expect(screen.getByTestId('create-readiness')).toBeTruthy();
  });

  it('renders the contextual page header and says it creates a draft', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('page-header')).toBeTruthy());
    expect(screen.getByTestId('page-header').textContent).toContain('Add Listing');
    expect(screen.getByTestId('page-header').textContent)
      .toContain('Draft · not on the marketplace · no external listing ID yet');
  });

  /** 🔴 Exactly one dark primary, and it is Save — never a "Publish now". */
  it('offers Discard and Save listing, and nothing that publishes', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-save-header')).toBeTruthy());
    const header = screen.getByTestId('page-header-actions');
    expect(header.textContent).toContain('Discard');
    expect(header.textContent).toContain('Save listing');
    expect(header.textContent).not.toContain('Publish');
    expect(header.textContent).not.toContain('Push');
  });

  /** 🔴 Structured rows never wrap and nothing scrolls sideways inside the form. */
  it('keeps the form free of horizontal scroll affordances', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-listing-form')).toBeTruthy());
    const html = screen.getByTestId('create-listing-form').innerHTML;
    expect(html).not.toContain('overflow-x: auto');
    expect(html).not.toContain('overflow-x: scroll');
    expect(screen.getByTestId('create-listing-form').getAttribute('style'))
      .toContain('grid-template-columns: minmax(0, 1fr) 320px');
  });

  /** 🔴 `PRD-199.f` — MRP is retired and no competing price label survives anywhere. */
  it('shows no MRP, Regular Price or Discount Price', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-listing-form')).toBeTruthy());
    expect(screen.queryByTestId('field-mrp')).toBeNull();
    const text = screen.getByTestId('create-listing-form').textContent ?? '';
    for (const retired of ['MRP', 'Regular Price', 'Discount Price']) {
      expect(text).not.toContain(retired);
    }
  });
});

// =====================================================================================
// A — Basic information
// =====================================================================================

describe('Frame 09 — basic information', () => {
  it('requires one channel and shop to be chosen explicitly', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('field-intended-title')).toBeTruthy());
    setField('field-intended-title', 'A title');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('error-channelInstance')).toBeTruthy());
    expect(posted.length).toBe(0);
  });

  /**
   * 🔴 ONE listing, ONE shop. Creating for Daraz account A must never quietly create for
   * Daraz account B — each shop's listing is its own intent.
   */
  it('never fans out to a sibling shop', async () => {
    renderCreate();
    await fillMinimum();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(posted.length).toBe(1);
    expect(body().channelInstance).toBe('DARAZ-A');
    expect(JSON.stringify(body())).not.toContain('DARAZ-B');
  });

  it('keeps the listing title the operator wrote', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-intended-title', 'A different channel title');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().intendedTitle).toBe('A different channel title');
  });

  /** 🔴 `PRD-178` — UNMAPPED is a first-class state, not a validation failure. */
  it('saves without a Sellable Product mapping', async () => {
    renderCreate();
    await fillMinimum();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().mappedSellableSku).toBeNull();
  });

  /** 🔴 `PRD-179.b` — chosen explicitly. Searching alone maps nothing. */
  it('maps only the Sellable Product the operator chose', async () => {
    renderCreate();
    await fillMinimum();
    fireEvent.click(screen.getByTestId('sellable-search-run'));
    await waitFor(() => expect(screen.getByTestId('sellable-result-0')).toBeTruthy());
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().mappedSellableSku).toBeNull();
  });

  it('shows the chosen product identity and allows changing it', async () => {
    renderCreate();
    await fillMinimum();
    await chooseProduct();
    const chosen = screen.getByTestId('chosen-sellable-product').textContent ?? '';
    expect(chosen).toContain('Hi-Power 22 IPS Monitor');
    expect(chosen).toContain('SP-003377');
    fireEvent.click(screen.getByTestId('change-sellable-product'));
    expect(screen.queryByTestId('chosen-sellable-product')).toBeNull();
  });

  it('states an empty search result rather than showing nothing', async () => {
    vi.unstubAllGlobals();
    stubApi(undefined, []);
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('sellable-search-run')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sellable-search-run'));
    await waitFor(() => expect(screen.getByTestId('sellable-no-results')).toBeTruthy());
    expect(screen.getByTestId('sellable-no-results').textContent)
      .toContain('No Sellable Products exist yet');
  });

  /**
   * 🔴 `API-067` — the category vocabulary belongs to the CHANNEL. Before one is chosen there
   * is no vocabulary at all, so the field shows no example path: a realistic category in a
   * grey field is indistinguishable from loaded channel data.
   */
  it('shows no marketplace category path before a channel is chosen', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('field-channel-category')).toBeTruthy());
    const field = screen.getByTestId('field-channel-category') as HTMLInputElement;
    expect(field.value).toBe('');
    expect(field.placeholder).toBe('');
    expect(field.disabled).toBe(true);
    expect(screen.getByTestId('create-section-basic').textContent).not.toContain('Electronics');
    expect(screen.getByTestId('create-category-note').textContent)
      .toBe('Choose a channel and shop to load supported channel categories.');
  });

  it('does not fabricate a channel category identifier from typed text', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-channel-category', 'Electronics › Monitors');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().intendedChannelCategory).toBe('Electronics › Monitors');
    expect(body().intendedChannelCategoryRef).toBeNull();
  });

  /** 🔴 `PRD-170` — the master fallback is never materialised; creation copies nothing. */
  it('describes listing images without copying a fallback set', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-media-note')).toBeTruthy());
    expect(screen.getByTestId('create-media-note').textContent)
      .toContain('there is no master media to inherit');
    expect(screen.getByTestId('create-media-placeholder')).toBeTruthy();
    expect(screen.getByTestId('create-section-basic').querySelectorAll('img').length).toBe(0);
  });
});

// =====================================================================================
// B — Product specification, and E — Shipping and warranty
// =====================================================================================

describe('Frame 09 — capability-driven sections', () => {
  /**
   * 🔴 `API-063` — an attribute schema is DECLARED by an adapter. No adapter means no schema,
   * and drawing controls for attributes nobody declared would teach the operator a
   * marketplace that does not exist here.
   */
  it('offers no specification controls and no invented attributes', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-section-specification')).toBeTruthy());
    const section = screen.getByTestId('create-section-specification');
    expect(section.querySelectorAll('input, select, textarea').length).toBe(0);
    for (const invented of ['Brand', 'Processor Type', 'Screen Size', 'Color Family']) {
      expect(section.textContent).not.toContain(invented);
    }
  });

  it('states the specification schema position honestly for each channel state', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-specification-note')).toBeTruthy());
    expect(screen.getByTestId('create-specification-note').textContent)
      .toContain('Choose a channel and shop, then a channel category');
    expect(screen.getByTestId('specification-meta').textContent).toBe('No schema available');

    await fillMinimum();
    expect(screen.getByTestId('create-specification-note').textContent)
      .toContain('No marketplace specification schema is available for this channel');
    expect(screen.getByTestId('create-specification-note').textContent)
      .toContain('does not block saving');
  });

  /**
   * 🔴 `PRD-201.b` — THE PACKAGE FACTS ARE AUTHORABLE UNCONDITIONALLY. A marketplace
   * requirement is a reason to SEND a parcel weight, never a precondition for writing it
   * down, so they are never hidden behind a channel selection.
   */
  it('exposes the package fields with no channel selected at all', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-section-shipping')).toBeTruthy());
    for (const field of ['field-package-weight', 'field-package-length', 'field-package-width',
      'field-package-height', 'field-package-content']) {
      expect(screen.getByTestId(field)).toBeTruthy();
      expect((screen.getByTestId(field) as HTMLInputElement).disabled).toBe(false);
    }
    expect(screen.getByTestId('create-shipping-note').textContent)
      .toContain('Choose a channel and category to load marketplace-specific');
  });

  /**
   * 🔴 The CHANNEL-SPECIFIC requirements are separate and adapter-declared. Their absence
   * must never hide the canonical package facts above them.
   */
  it('keeps package fields visible while the channel schema is unavailable', async () => {
    renderCreate();
    await fillMinimum();
    const section = screen.getByTestId('create-section-shipping');
    expect(screen.getByTestId('field-package-weight')).toBeTruthy();
    expect(screen.getByTestId('create-shipping-note').textContent)
      .toContain('No marketplace shipping/warranty schema is available for this channel');
    // 🔴 No adapter-owned requirement is fabricated beside them.
    for (const invented of ['Dangerous Goods', 'Warranty Type', 'Return Policy']) {
      expect(section.textContent).not.toContain(invented);
    }
  });

  /** ⚠ Capability is not authority, and neither blocks recording local intent. */
  it('separates a missing adapter from a missing permission, and still saves', async () => {
    renderCreate();
    await fillMinimum();
    expect(screen.getByTestId('create-no-adapter').textContent)
      .toContain('You can still create and keep this listing in Trioloo');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
  });
});

// =====================================================================================
// C — Price, stock and variants
// =====================================================================================

describe('Frame 09 — price, stock and variants', () => {
  /** ⚠ Most listings carry no promotion, so its controls are disclosed rather than shown. */
  it('discloses the promotion controls only when one is being added', async () => {
    renderCreate();
    await fillMinimum();
    expect(screen.queryByTestId('promotion-fields')).toBeNull();
    expect(screen.queryByTestId('field-promotion-price')).toBeNull();

    openPromotion();
    expect(screen.getByTestId('promotion-fields')).toBeTruthy();
    expect(screen.getByTestId('field-promotion-price')).toBeTruthy();
    expect(screen.getByTestId('field-promotion-starts')).toBeTruthy();
    expect(screen.getByTestId('field-promotion-ends')).toBeTruthy();
  });

  /** 🔴 Removing the promotion clears all three together — a stranded window means nothing. */
  it('clears the whole promotion when it is removed', async () => {
    renderCreate();
    await fillMinimum();
    openPromotion();
    setField('field-promotion-price', '1200');
    setField('field-promotion-starts', '2026-08-20T00:00');
    fireEvent.click(screen.getByTestId('remove-promotion'));

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().promotionPrice).toBeNull();
    expect(body().promotionStartsAt).toBeNull();
    expect(body().promotionEndsAt).toBeNull();
  });

  it('sends both prices as the exact strings that were typed', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1300.00');
    openPromotion();
    setField('field-promotion-price', '1200.50');
    setField('field-promotion-starts', '2026-08-20T00:00');
    setField('field-promotion-ends', '2026-08-31T23:59');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    // 🔴 `TEC-015` — strings, never Numbers. 1300.00 must not arrive as 1300.
    expect(body().salePrice).toBe('1300.00');
    expect(body().promotionPrice).toBe('1200.50');
    expect(String(body().promotionStartsAt)).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('saves with no promotion scheduled', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1300');
    expect(screen.getByTestId('create-price-preview').textContent)
      .toContain('৳ 1,300 at all times — no promotion scheduled');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().promotionPrice).toBeNull();
  });

  it('accepts a promotion below the Sale Price', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1300');
    openPromotion();
    setField('field-promotion-price', '1200');
    setField('field-promotion-starts', '2026-08-20T00:00');
    setField('field-promotion-ends', '2026-08-31T23:59');
    expect(screen.getByTestId('create-price-preview').textContent)
      .toContain('৳ 1,300 normally, ৳ 1,200 while the promotion runs');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
  });

  /** ✅ Equality is a promotion with no reduction, which is ordinary. */
  it('accepts a promotion equal to the Sale Price', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1200');
    openPromotion();
    setField('field-promotion-price', '1200.00');
    setField('field-promotion-starts', '2026-08-20T00:00');
    setField('field-promotion-ends', '2026-08-31T23:59');
    expect(screen.getByTestId('create-price-preview').textContent).toContain('no reduction');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
  });

  /** 🔴 Refused, never silently swapped — only the operator knows which was the typo. */
  it('rejects a promotion above the Sale Price without reordering the values', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1000');
    openPromotion();
    setField('field-promotion-price', '1200');
    expect(screen.getByTestId('create-price-preview').textContent)
      .toContain('That is not a promotion and cannot be saved');

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('error-promotionPrice')).toBeTruthy());
    expect(posted.length).toBe(0);
    expect(document.activeElement).toBe(screen.getByTestId('field-promotion-price'));
    expect((screen.getByTestId('field-sale-price') as HTMLInputElement).value).toBe('1000');
    expect((screen.getByTestId('field-promotion-price') as HTMLInputElement).value).toBe('1200');
  });

  /** 🔴 `PRD-199.c` — a promotion price REQUIRES both bounds. */
  it('refuses a promotion with no window', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1300');
    openPromotion();
    setField('field-promotion-price', '1200');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('error-promotionStartsAt')).toBeTruthy());
    expect(screen.getByTestId('error-promotionEndsAt')).toBeTruthy();
    expect(posted.length).toBe(0);
  });

  it('refuses a window that ends before it starts', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1300');
    openPromotion();
    setField('field-promotion-price', '1200');
    setField('field-promotion-starts', '2026-08-31T23:59');
    setField('field-promotion-ends', '2026-08-20T00:00');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('error-promotionEndsAt')).toBeTruthy());
    expect(screen.getByTestId('error-promotionEndsAt').textContent)
      .toContain('later than Promotion Starts');
    expect(posted.length).toBe(0);
  });

  /** 🔴 `PRD-193` — listing stock is held on the listing, never derived from Inventory. */
  it('states that listing stock is not warehouse inventory', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-stock-note')).toBeTruthy());
    const text = screen.getByTestId('create-section-commercial').textContent ?? '';
    expect(text).toContain('does not adjust it from warehouse inventory');
    for (const wrong of ['Warehouse Stock', 'Available Stock', 'Inventory Stock']) {
      expect(text).not.toContain(wrong);
    }
  });

  it('sends listing stock, Seller SKU and publication intent as entered', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-published-stock', '31');
    setField('field-channel-sku', 'ZT-MON-22IPS');
    setField('field-publication-intent', 'HOLD');
    expect(screen.getByTestId('sku-mode-single')).toBeTruthy();

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    // 🔴 `INV-106.1` — ONE orderable unit is created, and it is an `E-106` channel SKU.
    expect(body().publishedMarketplaceStock).toBe('31');
    expect(body().channelSku).toBe('ZT-MON-22IPS');
    expect(body().publicationIntent).toBe('HOLD');
    // 🔴 `PRD-128` — neither channel-owned state is submissible from this form.
    expect(body().listingStatus).toBeUndefined();
    expect(body().syncState).toBeUndefined();
  });
});

// =====================================================================================
// D — Product description and highlights
// =====================================================================================

describe('Frame 09 — description and highlights', () => {
  it('persists the description', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-intended-description', 'A 22 inch IPS monitor.');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().intendedDescription).toBe('A 22 inch IPS monitor.');
  });

  /**
   * 🔴 `PRD-198.b` — ONE PER LINE, and the line order IS the authored order. The textarea is
   * an input shape; each surviving line becomes one ordered canonical record.
   */
  it('turns each line into one ordered highlight', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-highlights', [
      '22-inch IPS panel with wide viewing angles',
      '1920 × 1080 Full HD resolution',
      'HDMI and VGA inputs',
      '12-month replacement warranty',
    ].join('\n'));

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().highlights).toEqual([
      '22-inch IPS panel with wide viewing angles',
      '1920 × 1080 Full HD resolution',
      'HDMI and VGA inputs',
      '12-month replacement warranty',
    ]);
  });

  /** ⚠ A blank line is not a highlight, and an operator pressing Enter twice authored none. */
  it('ignores blank lines and surrounding whitespace', () => {
    expect(highlightLines('  One  \n\n\n   \nTwo\n')).toEqual(['One', 'Two']);
    expect(highlightLines('')).toEqual([]);
    expect(highlightLines('\n \n')).toEqual([]);
  });

  /** 🔴 Reordering is editing the line order — nothing else is needed, or offered. */
  it('sends the authored line order and offers no row controls', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-highlights', 'Third\nFirst\nSecond');
    // ⚠ The rejected row-by-row affordances must be gone.
    expect(screen.queryByTestId('highlight-add')).toBeNull();
    expect(screen.queryByTestId('highlight-up-0')).toBeNull();
    expect(screen.queryByTestId('highlight-remove-0')).toBeNull();

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().highlights).toEqual(['Third', 'First', 'Second']);
  });

  it('is one multiline box, not a paragraph and not a row list', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('field-highlights')).toBeTruthy());
    expect(screen.getByTestId('field-highlights').tagName).toBe('TEXTAREA');
    expect(screen.getByTestId('create-section-description').textContent)
      .toContain('One highlight per line. Blank lines are ignored. Order is preserved.');
  });

  /** ⚠ `PRD-198.d` — highlights are OPTIONAL. */
  it('saves with no highlights at all', async () => {
    renderCreate();
    await fillMinimum();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().highlights).toEqual([]);
  });
});

// =====================================================================================
// F — Listing readiness
// =====================================================================================

describe('Frame 09 — listing readiness', () => {
  it('groups readiness by the section that owns each fact', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-readiness')).toBeTruthy());
    for (const group of ['Basic information', 'Product specification', 'Price, stock and variants',
      'Product description', 'Shipping and warranty']) {
      expect(readiness()).toContain(group);
    }
  });

  /** 🔴 The sentence is what the operator reads — an unmet requirement says so in words. */
  it('never words an unmet requirement as though it were done', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-readiness')).toBeTruthy());
    expect(readiness()).toContain('Channel and shop not selected');
    expect(readiness()).toContain('Listing title not entered');
    expect(readiness()).not.toContain('Channel and shop selected');
    expect(readiness()).not.toContain('Listing title ready');
  });

  it('follows the actual form state as it is filled', async () => {
    renderCreate();
    await fillMinimum();
    expect(readiness()).toContain('Channel and shop selected');
    expect(readiness()).toContain('Listing title ready');

    setField('field-sale-price', '1300');
    setField('field-published-stock', '31');
    setField('field-channel-sku', 'ZT-1');
    expect(readiness()).toContain('Sale Price set');
    expect(readiness()).toContain('Listing stock set');
    expect(readiness()).toContain('Seller SKU set');

    await chooseProduct();
    expect(readiness()).toContain('Mapped to SP-003377');
  });

  /**
   * 🔴 READINESS AND SAVE SHARE ONE ENGINE. What the sidebar reports as a REQUIRED failure is
   * exactly what Save refuses on — two engines would eventually disagree and one screen would
   * tell the operator two different things.
   */
  it('reports as outstanding exactly what Save refuses on', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1000');
    openPromotion();
    setField('field-promotion-price', '1200');

    // The sidebar marks the promotion outstanding...
    const outstanding = screen.getAllByTestId('readiness-outstanding').map((r) => r.textContent);
    expect(outstanding.some((t) => t?.includes('Promotion within the Sale Price'))).toBe(true);

    // ...and Save refuses on the same fact.
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('error-promotionPrice')).toBeTruthy());
    expect(posted.length).toBe(0);
  });

  /**
   * 🔴 A RECOMMENDATION NEVER BLOCKS A LOCAL DRAFT (`PRD-188.a`). Everything below is
   * reported and none of it prevents recording intent.
   */
  it('saves a draft while recommendations are still outstanding', async () => {
    renderCreate();
    await fillMinimum();
    // No mapping, no price, no stock, no SKU, no description, no highlights, no category.
    expect(readiness()).toContain('Not mapped');
    expect(readiness()).toContain('Sale Price not set');
    expect(readiness()).toContain('Description not written');
    expect(screen.queryAllByTestId('readiness-outstanding')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(screen.getByTestId('landed-on-detail')).toBeTruthy();
  });

  /** ⚠ Nothing is scored. A fabricated percentage is a number the channel would ignore. */
  it('reports no score and no fabricated marketplace completeness', async () => {
    renderCreate();
    await fillMinimum();
    expect(readiness()).not.toMatch(/\d+\s*%/);
    expect(readiness()).toContain('No specification schema is declared for this channel');
    expect(readiness()).toContain('No channel-specific shipping or warranty schema available');
  });

  /** 🔴 Monochrome — the panel gains no success or error colour. */
  it('distinguishes readiness states without colour badges', async () => {
    renderCreate();
    await fillMinimum();
    const html = screen.getByTestId('create-readiness').innerHTML;
    expect(screen.getAllByTestId('readiness-ready').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('readiness-note').length).toBeGreaterThan(0);
    expect(html).toContain('var(--color-ink)');
    expect(html).not.toContain('--color-destructive');
    expect(html).not.toContain('--color-success');
  });
});

// =====================================================================================
// PRD-201 — package publishing facts
// =====================================================================================

describe('Frame 09 — package information', () => {
  const fillPackage = (): void => {
    setField('field-package-weight', '1.25');
    setField('field-package-length', '40');
    setField('field-package-width', '30');
    setField('field-package-height', '12.5');
    setField('field-package-content', '1 x monitor\n1 x power cable\n1 x stand');
  };

  it('persists the package facts as the strings that were typed', async () => {
    renderCreate();
    await fillMinimum();
    fillPackage();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    // 🔴 `PRD-201.e` — kilograms and centimetres, exact decimals, never a float.
    expect(body().packageWeightKg).toBe('1.25');
    expect(body().packageLengthCm).toBe('40');
    expect(body().packageWidthCm).toBe('30');
    expect(body().packageHeightCm).toBe('12.5');
    expect(body().packageContent).toContain('1 x power cable');
  });

  /** 🔴 `PRD-201.b` — no adapter is needed to record them. */
  it('saves package information with no adapter configured', async () => {
    renderCreate();
    await fillMinimum();
    fillPackage();
    expect(screen.getByTestId('create-no-adapter')).toBeTruthy();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().packageWeightKg).toBe('1.25');
  });

  /** 🔴 `PRD-201.f` — ABSENT is fine; ZERO is not. */
  it('refuses a zero weight or dimension but accepts an empty one', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-package-weight', '0');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('error-packageWeightKg')).toBeTruthy());
    expect(screen.getByTestId('error-packageWeightKg').textContent)
      .toContain('greater than zero');
    expect(posted.length).toBe(0);

    // Cleared, it is simply absent — and the listing saves.
    setField('field-package-weight', '');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().packageWeightKg).toBeNull();
  });

  /** 🔴 `PRD-201.d` — the carton, not the product, and never Inventory. */
  it('never labels package data as product size or inventory', async () => {
    renderCreate();
    await fillMinimum();
    const text = screen.getByTestId('create-section-shipping').textContent ?? '';
    expect(text).toContain('shipping carton, not the product');
    expect(text).toContain('never derived from warehouse inventory');
    for (const wrong of ['Product dimensions', 'Inventory', 'Warehouse Stock']) {
      expect(text).not.toContain(wrong);
    }
  });

  /** 🔴 `PRD-201.c` — recorded against the single orderable SKU of this listing. */
  it('sends package facts alongside the one orderable SKU it creates', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-channel-sku', 'ZT-1');
    fillPackage();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().channelSku).toBe('ZT-1');
    expect(body().packageWeightKg).toBe('1.25');
  });

  it('reports package readiness without blocking a draft', async () => {
    renderCreate();
    await fillMinimum();
    expect(readiness()).toContain('Package weight not set');
    expect(readiness()).toContain('Package dimensions not set');
    expect(readiness()).toContain('Package content not set');
    // 🔴 All three are RECOMMENDED — nothing is outstanding, and the draft saves.
    expect(screen.queryAllByTestId('readiness-outstanding')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
  });

  /** ⚠ Two sides of a carton describe nothing a courier can use. */
  it('calls a partial set of dimensions incomplete', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-package-length', '40');
    setField('field-package-width', '30');
    expect(readiness()).toContain('Package dimensions incomplete');
    setField('field-package-height', '12');
    expect(readiness()).toContain('Package dimensions set');
  });
});

// =====================================================================================
// PRD-202 — English and Bangla
// =====================================================================================

describe('Frame 09 — English and Bangla content', () => {
  const switchToBangla = (): void => { fireEvent.click(screen.getByTestId('language-bn')); };

  /** ⚠ `PRD-202.a` — English is the primary authoring value, so the form opens in it. */
  it('opens in English and switches without showing two forms at once', async () => {
    renderCreate();
    await fillMinimum();
    expect(screen.getByTestId('field-highlights')).toBeTruthy();
    expect(screen.queryByTestId('field-highlights-bn')).toBeNull();

    switchToBangla();
    expect(screen.getByTestId('field-highlights-bn')).toBeTruthy();
    expect(screen.queryByTestId('field-highlights')).toBeNull();
    expect(screen.getByTestId('field-intended-title-bn')).toBeTruthy();
  });

  /** 🔴 `PRD-202.c` — a blank override falls back, and the form SAYS so. */
  it('states the English fallback while the Bangla fields are blank', async () => {
    renderCreate();
    await fillMinimum();
    switchToBangla();
    expect(screen.getByTestId('title-bn-fallback').textContent)
      .toBe('Blank — English content will be used.');
    expect(screen.getByTestId('description-bn-fallback').textContent)
      .toBe('Blank — English content will be used.');
    // 🔴 `PRD-202.f` — the highlight set falls back as a WHOLE.
    expect(screen.getByTestId('highlights-bn-fallback').textContent)
      .toContain('as a whole set');
  });

  /** 🔴 `PRD-202.d` — the English value is NEVER copied into Bangla persistence. */
  it('sends null for a blank Bangla override rather than the English text', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-intended-description', 'An English description.');
    setField('field-highlights', 'One\nTwo');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));

    expect(body().intendedTitleBn).toBeNull();
    expect(body().intendedDescriptionBn).toBeNull();
    expect(body().highlightsBn).toEqual([]);
    // The English values are intact and were not duplicated anywhere.
    expect(body().intendedDescription).toBe('An English description.');
    expect(body().highlights).toEqual(['One', 'Two']);
  });

  it('sends an explicit Bangla override when one is authored', async () => {
    renderCreate();
    await fillMinimum();
    switchToBangla();
    setField('field-intended-title-bn', 'হাই-পাওয়ার ২২ ইঞ্চি মনিটর');
    setField('field-intended-description-bn', 'বাংলা বিবরণ।');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().intendedTitleBn).toBe('হাই-পাওয়ার ২২ ইঞ্চি মনিটর');
    expect(body().intendedDescriptionBn).toBe('বাংলা বিবরণ।');
    // 🔴 The English side is untouched by authoring a Bangla override.
    expect(body().intendedTitle).toBe('Hi-Power 22 Inch IPS Monitor');
  });

  /** 🔴 `PRD-202.f` — one ordered set per language, one line each, order preserved. */
  it('keeps Bangla highlights ordered and separate from English', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-highlights', 'English one\nEnglish two');
    switchToBangla();
    setField('field-highlights-bn', 'প্রথম\n\nদ্বিতীয়\nতৃতীয়');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));

    expect(body().highlights).toEqual(['English one', 'English two']);
    // Blank lines ignored, order preserved, and the two sets never merge.
    expect(body().highlightsBn).toEqual(['প্রথম', 'দ্বিতীয়', 'তৃতীয়']);
  });

  it('keeps both languages in the draft while switching between them', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-highlights', 'English only');
    switchToBangla();
    setField('field-highlights-bn', 'বাংলা');
    fireEvent.click(screen.getByTestId('language-en'));
    // ⚠ Switching is a VIEW change — nothing typed is lost, and nothing is copied across.
    expect((screen.getByTestId('field-highlights') as HTMLTextAreaElement).value).toBe('English only');
    fireEvent.click(screen.getByTestId('language-bn'));
    expect((screen.getByTestId('field-highlights-bn') as HTMLTextAreaElement).value).toBe('বাংলা');
  });

  /** ⚠ A blank override is not an unfinished listing, so readiness never marks it owed. */
  it('reports the Bangla fallback as a note, never as outstanding work', async () => {
    renderCreate();
    await fillMinimum();
    expect(readiness()).toContain('Bangla content falls back to English');
    expect(screen.queryAllByTestId('readiness-outstanding')).toHaveLength(0);

    switchToBangla();
    setField('field-intended-title-bn', 'বাংলা');
    expect(readiness()).toContain('Bangla content authored');
  });
});

// =====================================================================================
// Save semantics and authority
// =====================================================================================

describe('Frame 09 — save semantics', () => {
  /** 🔴 `PRD-196.a` — creating local intent needs MANAGE. It never needs publish. */
  it('refuses the form without manage authority, and names the authority', async () => {
    vi.unstubAllGlobals();
    stubApi(['product.channel-listing.view', 'product.channel-listing.publish']);
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-listing-forbidden')).toBeTruthy());
    expect(screen.getByTestId('create-listing-forbidden').textContent)
      .toContain('product.channel-listing.manage');
    expect(screen.queryByTestId('create-listing-form')).toBeNull();
  });

  /** 🔴 `PRD-185` — one local write, and nothing else. */
  it('saves locally without pushing, syncing or publishing', async () => {
    renderCreate();
    await fillMinimum();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(posted[0]?.url).toContain('/api/product/channel-listings');
    expect(posted.some((p) => p.url.includes('/operations'))).toBe(false);
  });

  /** 🔴 `PRD-188.b` — the channel issues the identifier. It is never typed and never invented. */
  it('never fabricates an external listing ID', async () => {
    renderCreate();
    await fillMinimum();
    expect(screen.queryByTestId('field-external-listing-id')).toBeNull();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().externalListingId).toBeNull();
  });

  it('states the save consequence beside the button that does it', async () => {
    renderCreate();
    await fillMinimum();
    expect(screen.getByTestId('create-save-consequence').textContent)
      .toContain('Saving stores the listing in Trioloo only');
    expect(screen.getByTestId('create-save-consequence').textContent).toContain('Daraz account A');
  });

  it('lands on the new Listing after a successful save', async () => {
    renderCreate();
    await fillMinimum();
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('landed-on-detail')).toBeTruthy());
  });

  it('keeps the form and the entered values when the save is refused', async () => {
    renderCreate();
    await fillMinimum();
    setField('field-sale-price', '1200');
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ message: 'External listing id already exists.' }), { status: 400 })));

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('create-listing-error')).toBeTruthy());
    expect((screen.getByTestId('field-sale-price') as HTMLInputElement).value).toBe('1200');
    expect(screen.queryByTestId('landed-on-detail')).toBeNull();
  });

  it('returns to the workspace on Discard', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('create-discard')).toBeTruthy());
    fireEvent.click(screen.getByTestId('create-discard'));
    await waitFor(() => expect(screen.getByTestId('landed-on-workspace')).toBeTruthy());
    expect(posted.length).toBe(0);
  });

  it('clears a field message once that field is corrected', async () => {
    renderCreate();
    await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(screen.getByTestId('error-channelInstance')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    expect(screen.queryByTestId('error-channelInstance')).toBeNull();
    expect(screen.getByTestId('error-intendedTitle')).toBeTruthy();
  });
});
