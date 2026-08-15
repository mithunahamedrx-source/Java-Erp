import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MappingModal } from './MappingModal';
import type { ChannelListing, ChannelListingSku } from './channelListingApi';

/**
 * FRAMES 11 + 12 — the unmapped state and the Mapping modal.
 *
 * <p>🔴 The claim under test is that mapping is EXPLICIT, LOCAL and PER ORDERABLE SKU: nothing
 * maps without a confirmation (`PRD-179.b`), nothing reaches the marketplace (`PRD-185`), and
 * one SKU's decision never becomes another's (`INV-106.2`).
 */

const SKU: ChannelListingSku = {
  id: 'sku-1',
  channelSku: 'ZT-MON-22IPS',
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
  packageWeightKg: null,
  packageLengthCm: null,
  packageWidthCm: null,
  packageHeightCm: null,
  packageContent: null,
  variationLabel: null,
  position: 0,
};

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
  intendedDescription: null,
  intendedTitleBn: null,
  intendedDescriptionBn: null,
  effectiveTitleBn: null,
  effectiveDescriptionBn: null,
  salePrice: '11200.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: '11200.00',
  promotionActive: false,
  priceIsFrom: false,
  listingStock: '31',
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
  syncState: 'SYNCED',
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
  version: 3,
  skus: [SKU],
};

const MAPPED: ChannelListing = {
  ...LISTING,
  mappingState: 'MAPPED',
  mappedSkuCount: 1,
  mappedSellableSku: 'SP-000111',
  sellableName: 'Existing Product A',
  skus: [{ ...SKU, sellableProductId: 'sp-a', sellableSku: 'SP-000111', sellableName: 'Existing Product A' }],
};

const SKU_B: ChannelListingSku = { ...SKU, id: 'sku-2', channelSku: 'ZT-MON-22IPS-W', position: 1 };
const MULTI: ChannelListing = { ...LISTING, skuCount: 2, mappedSkuCount: 0, skus: [SKU, SKU_B] };

const PRODUCTS = [
  { id: 'sp-1', sellableSku: 'SP-004410', name: 'Gigasonic 19 FHD Monitor', nature: 'SIMPLE' },
  { id: 'sp-2', sellableSku: 'SP-004411', name: 'Gigasonic 19 HD Monitor', nature: 'BUNDLE' },
];

let calls: { url: string; method: string; body: unknown }[] = [];
let products: readonly unknown[] = PRODUCTS;
let suggestions: readonly unknown[] = [];
let mapFails: string | null = null;

function stubApi(): void {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET');
    const json = (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (method !== 'GET') {
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (mapFails) return json({ message: mapFails }, 409);
      return new Response(null, { status: 204 });
    }
    if (url.includes('/mapping-suggestions')) return json(suggestions);
    if (url.includes('/sellable-products')) {
      return json({ content: products, page: 0, size: 6, totalElements: products.length, totalPages: 1 });
    }
    return json({});
  }));
}

const onClose = vi.fn();
const onMapped = vi.fn();

function open(listing: ChannelListing = LISTING): void {
  render(
    <MemoryRouter>
      <MappingModal listing={listing} onClose={onClose} onMapped={onMapped} />
    </MemoryRouter>,
  );
}

async function opened(listing: ChannelListing = LISTING): Promise<void> {
  open(listing);
  await waitFor(() => expect(screen.getByTestId('mapping-result-0')).toBeTruthy());
}

/**
 * The ONE primary in the footer.
 *
 * ⚠ Found by position, not by label: "Remove mapping" also appears as an in-body link, and
 * matching on text picked that up instead — a helper that quietly clicked the wrong control.
 */
const confirmButton = (): HTMLButtonElement => {
  const buttons = [...screen.getByTestId('mapping-modal').querySelectorAll('button')];
  return buttons[buttons.length - 1] as HTMLButtonElement;
};

beforeEach(() => {
  products = PRODUCTS;
  suggestions = [];
  mapFails = null;
  onClose.mockClear();
  onMapped.mockClear();
  stubApi();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// =====================================================================================
// Nothing maps without a confirmation
// =====================================================================================

describe('Frame 12 — confirmation is the authority', () => {
  it('writes nothing merely by opening', async () => {
    await opened();
    expect(calls).toEqual([]);
  });

  it('writes nothing when a result is selected', async () => {
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    // 🔴 `PRD-179.b` — selection stages a decision; only the footer makes it authoritative.
    expect(calls).toEqual([]);
    expect(screen.getByTestId('mapping-selected')).toBeTruthy();
  });

  it('maps only on the explicit footer confirmation', async () => {
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]!.method).toBe('PUT');
    expect(calls[0]!.url).toContain('/skus/sku-1/mapping');
    expect((calls[0]!.body as { mappedSellableSku: string }).mappedSellableSku).toBe('SP-004410');
  });

  it('does nothing at all when confirmed with nothing chosen', async () => {
    await opened();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
    expect(calls).toEqual([]);
  });

  it('closes and asks the caller to re-read after success', async () => {
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onMapped).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});

// =====================================================================================
// Mapping is local — PRD-185
// =====================================================================================

describe('Frame 12 — mapping is local', () => {
  it('never pushes, publishes, refreshes or syncs', async () => {
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(calls.length).toBe(1));
    for (const forbidden of ['/operations', '/publish', '/refresh', '/sync']) {
      expect(calls.every((c) => !c.url.includes(forbidden))).toBe(true);
    }
  });

  it('works with no adapter configured', async () => {
    // ⚠ The fixture channel has `adapterAvailable: false`. Mapping is unaffected (§45).
    await opened({ ...LISTING, adapterAvailable: false });
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    expect(confirmButton().disabled).toBe(false);
  });

  it('states the real consequence, and what it does not do', async () => {
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    const said = screen.getByTestId('mapping-selected').textContent ?? '';
    expect(said).toContain('Nothing is sent to');
    expect(said).toContain('the Sellable Product is unchanged');
    expect(said).toContain('no other SKU or shop is affected');
  });

  it('touches exactly one SKU on a single-SKU listing', async () => {
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(calls.length).toBe(1));
    // 🔴 No sibling shop, no sibling SKU, no fan-out (§16).
    expect(calls.length).toBe(1);
  });
});

// =====================================================================================
// Suggestions — PRD-179
// =====================================================================================

describe('Frame 12 — suggestions are advisory', () => {
  it('shows nothing when there is no deterministic evidence', async () => {
    await opened();
    expect(screen.queryByTestId('mapping-suggestions')).toBeNull();
  });

  it('names the evidence in words and carries no score', async () => {
    suggestions = [{
      sellableProductId: 'sp-1', sellableSku: 'SP-004410',
      sellableName: 'Gigasonic 19 FHD Monitor', basis: 'Exact seller SKU match', exact: true,
    }];
    await opened();
    await waitFor(() => expect(screen.getByTestId('mapping-suggestions')).toBeTruthy());
    const panel = screen.getByTestId('mapping-suggestions').textContent ?? '';
    expect(panel).toContain('Exact seller SKU match');
    // 🔴 `PRD-179.d` / `PRD-146` — no confidence, percentage or rank is invented.
    expect(panel).not.toMatch(/\d+\s*%|confidence|score/i);
  });

  it('does not map a suggestion automatically, however exact', async () => {
    suggestions = [{
      sellableProductId: 'sp-1', sellableSku: 'SP-004410',
      sellableName: 'Gigasonic 19 FHD Monitor', basis: 'Exact seller SKU match', exact: true,
    }];
    await opened();
    await waitFor(() => expect(screen.getByTestId('mapping-suggestions')).toBeTruthy());
    expect(calls).toEqual([]);
    expect(screen.queryByTestId('mapping-selected')).toBeNull();
  });

  it('says plainly that a similar name is never enough', async () => {
    suggestions = [{
      sellableProductId: 'sp-1', sellableSku: 'SP-004410',
      sellableName: 'Gigasonic 19 FHD Monitor', basis: 'Exact seller SKU match', exact: true,
    }];
    await opened();
    await waitFor(() => expect(screen.getByTestId('mapping-suggestions')).toBeTruthy());
    expect(screen.getByTestId('mapping-suggestions').textContent)
      .toContain('never maps on a similar name');
  });
});

// =====================================================================================
// Search
// =====================================================================================

describe('Frame 12 — Sellable Product search', () => {
  it('shows product name, Sellable SKU and nature', async () => {
    await opened();
    const row = screen.getByTestId('mapping-result-0').textContent ?? '';
    expect(row).toContain('Gigasonic 19 FHD Monitor');
    expect(row).toContain('SP-004410');
    expect(row).toContain('SIMPLE');
  });

  it('asks the server for a bounded page, never the whole catalogue', async () => {
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    await opened();
    const searchUrl = fetchMock.mock.calls
      .map((c) => String(c[0])).find((u) => u.includes('/sellable-products'));
    expect(searchUrl).toContain('size=6');
    expect(searchUrl).toContain('page=0');
  });

  it('sends the typed term to the server', async () => {
    await opened();
    fireEvent.change(screen.getByTestId('mapping-search'), { target: { value: 'gigasonic' } });
    fireEvent.click(screen.getByTestId('mapping-search-run'));
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('search=gigasonic'))).toBe(true);
    });
  });

  it('offers a clean empty state that does not create anything', async () => {
    products = [];
    open();
    await waitFor(() => expect(screen.getByTestId('mapping-no-results')).toBeTruthy());
    expect(screen.getByTestId('mapping-no-results').textContent).toContain('No Sellable Products found');
    // 🔴 `PRD-180.a` — an empty search never creates a product by itself.
    expect(calls).toEqual([]);
  });
});

// =====================================================================================
// Multi-SKU — INV-106.2
// =====================================================================================

describe('Frame 12 — a variation listing maps per SKU', () => {
  it('lists every orderable SKU as its own decision', async () => {
    await opened(MULTI);
    expect(screen.getByTestId('mapping-sku-sku-1')).toBeTruthy();
    expect(screen.getByTestId('mapping-sku-sku-2')).toBeTruthy();
  });

  it('maps only the SKU that was chosen', async () => {
    await opened(MULTI);
    fireEvent.click(screen.getByTestId('mapping-sku-sku-1'));
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(calls.length).toBe(1));
    // 🔴 The sibling SKU is untouched — no parent-level mapping, no fan-out (§14).
    expect(calls[0]!.url).toContain('/skus/sku-1/mapping');
    expect(calls.some((c) => c.url.includes('sku-2'))).toBe(false);
  });

  it('maps two SKUs to two different products in one confirmation', async () => {
    await opened(MULTI);
    fireEvent.click(screen.getByTestId('mapping-sku-sku-1'));
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(screen.getByTestId('mapping-sku-sku-2'));
    fireEvent.click(screen.getByTestId('mapping-result-1'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(calls.length).toBe(2));
    expect((calls[0]!.body as { mappedSellableSku: string }).mappedSellableSku).toBe('SP-004410');
    expect((calls[1]!.body as { mappedSellableSku: string }).mappedSellableSku).toBe('SP-004411');
  });

  it('never assumes the second SKU wants the first SKU target', async () => {
    await opened(MULTI);
    fireEvent.click(screen.getByTestId('mapping-sku-sku-1'));
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(screen.getByTestId('mapping-sku-sku-2'));
    // ⚠ Switching SKU shows no staged choice for the one that has not been decided.
    expect(screen.queryByTestId('mapping-selected')).toBeNull();
  });

  it('labels the footer for several mappings', async () => {
    await opened(MULTI);
    expect(confirmButton().textContent).toContain('Save mappings');
  });

  it('says the untouched SKUs keep their mapping', async () => {
    await opened(MULTI);
    expect(screen.getByTestId('mapping-sku-list').textContent)
      .toContain('the others keep exactly the mapping they have');
  });
});

// =====================================================================================
// Change mapping and unmap
// =====================================================================================

describe('Frame 12 — changing an existing mapping', () => {
  it('shows what it is mapped to now', async () => {
    await opened(MAPPED);
    const current = screen.getByTestId('mapping-current').textContent ?? '';
    expect(current).toContain('Existing Product A');
    expect(current).toContain('SP-000111');
  });

  it('keeps the existing mapping until the change is confirmed', async () => {
    await opened(MAPPED);
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    // 🔴 Product A is still what is persisted; clicking a result changed nothing.
    expect(calls).toEqual([]);
    expect(screen.getByTestId('mapping-current').textContent).toContain('SP-000111');
  });

  it('replaces the mapping only on confirmation', async () => {
    await opened(MAPPED);
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(calls.length).toBe(1));
    expect((calls[0]!.body as { mappedSellableSku: string }).mappedSellableSku).toBe('SP-004410');
  });

  it('titles itself Change mapping when one already exists', async () => {
    await opened(MAPPED);
    expect(screen.getByTestId('mapping-modal').textContent).toContain('Change mapping');
  });

  it('stages an unmap rather than performing it on click', async () => {
    await opened(MAPPED);
    fireEvent.click(screen.getByTestId('mapping-remove'));
    expect(calls).toEqual([]);
    expect(screen.getByTestId('mapping-remove-consequence').textContent).toContain('returns to UNMAPPED');
  });

  it('unmaps through the same explicit confirmation', async () => {
    await opened(MAPPED);
    fireEvent.click(screen.getByTestId('mapping-remove'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]!.method).toBe('DELETE');
  });

  it('lets a staged unmap be taken back', async () => {
    await opened(MAPPED);
    fireEvent.click(screen.getByTestId('mapping-remove'));
    fireEvent.click(screen.getByTestId('mapping-remove'));
    expect(screen.queryByTestId('mapping-remove-consequence')).toBeNull();
  });
});

// =====================================================================================
// Failure and concurrency
// =====================================================================================

describe('Frame 12 — when saving fails', () => {
  it('stays open and keeps the selection', async () => {
    mapFails = 'This SKU was changed by someone else. Reload and try again.';
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByTestId('dialog-error')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
    // 🔴 The operator does not have to find the product again to retry (§30).
    expect(screen.getByTestId('mapping-selected').textContent).toContain('SP-004410');
  });

  it('surfaces the canonical conflict message rather than overwriting', async () => {
    mapFails = 'This SKU was changed by someone else. Reload and try again.';
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByTestId('dialog-error').textContent)
      .toContain('changed by someone else'));
  });

  it('never claims the mapping changed', async () => {
    mapFails = 'Nope.';
    await opened();
    fireEvent.click(screen.getByTestId('mapping-result-0'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByTestId('dialog-error')).toBeTruthy());
    // 🔴 Nothing persisted, so the caller is never told to re-read and the modal never closes.
    expect(onMapped).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// =====================================================================================
// Accessibility
// =====================================================================================

describe('Frame 12 — accessibility', () => {
  it('is a labelled modal dialog', async () => {
    await opened();
    const dialog = screen.getByTestId('mapping-modal');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Map to Sellable Product');
  });

  it('puts initial focus on search, because finding comes first', async () => {
    await opened();
    expect(document.activeElement).toBe(screen.getByTestId('mapping-search'));
  });

  it('closes on Escape', async () => {
    await opened();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('reports selection state on each choice', async () => {
    await opened();
    const row = screen.getByTestId('mapping-result-0');
    expect(row.getAttribute('role')).toBe('radio');
    expect(row.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(row);
    expect(screen.getByTestId('mapping-result-0').getAttribute('aria-checked')).toBe('true');
  });
});

// =====================================================================================
// Create Sellable Product handoff — PRD-180
// =====================================================================================

describe('Frame 12 — the Create Sellable Product handoff', () => {
  it('offers the handoff without creating anything', async () => {
    await opened();
    expect(screen.getByTestId('mapping-create-sellable').textContent)
      .toContain('Create Sellable Product instead');
    expect(calls).toEqual([]);
  });

  it('does not appear only because a search was empty', async () => {
    products = [];
    open();
    await waitFor(() => expect(screen.getByTestId('mapping-no-results')).toBeTruthy());
    // ⚠ It is a footer route out, present either way — never a consequence of no results.
    expect(screen.getByTestId('mapping-create-sellable')).toBeTruthy();
  });
});
