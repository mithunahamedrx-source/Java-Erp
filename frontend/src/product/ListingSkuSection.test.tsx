import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListingSkuSection } from './ListingSkuSection';
import type { ChannelListing, ChannelListingSku } from './channelListingApi';

/**
 * FRAME 14 — Variations / Channel SKUs.
 *
 * <p>🔴 The claim under test throughout is that the ORDERABLE UNIT owns its facts: no parent
 * value leaks into a SKU column, no sibling value leaks across, and no state dimension is
 * merged into another (`INV-106.2`, `UX-038`).
 */

const BASE_SKU: ChannelListingSku = {
  id: 'sku-a',
  channelSku: 'ZT-PC-I7-16-256',
  sellableProductId: 'sp-a',
  sellableSku: 'SP-000101',
  sellableName: 'i7 9th Gen PC 16/256',
  salePrice: '74900.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: '74900.00',
  promotionActive: false,
  listingStock: '8',
  reportedSalePrice: null,
  reportedSalePriceReadable: false,
  reportedPromotionPrice: null,
  reportedPromotionPriceReadable: false,
  reportedPromotionStartsAt: null,
  reportedPromotionEndsAt: null,
  reportedPromotionWindowReadable: false,
  reportedStock: null,
  reportedStockReadable: false,
  packageWeightKg: '8.500',
  packageLengthCm: '42',
  packageWidthCm: '12',
  packageHeightCm: '8',
  packageContent: '1 desktop, 1 power cable',
  variationLabel: '16GB RAM · 256GB SSD',
  position: 0,
};

const SKU_B: ChannelListingSku = {
  ...BASE_SKU,
  id: 'sku-b',
  channelSku: 'ZT-PC-I7-32-1TB',
  sellableProductId: null,
  sellableSku: null,
  sellableName: null,
  salePrice: '108000.00',
  effectiveSellingPrice: '108000.00',
  listingStock: '3',
  packageWeightKg: '11.000',
  packageLengthCm: '48',
  packageWidthCm: '14',
  packageHeightCm: '9',
  packageContent: '1 desktop, 1 power cable, 1 keyboard',
  variationLabel: '32GB RAM · 1TB SSD',
  position: 1,
};

const LISTING: ChannelListing = {
  id: 'L-1',
  channelInstanceId: 'ch-1',
  channelInstance: 'DARAZ-A',
  channelName: 'Daraz account A',
  channelType: 'DARAZ',
  adapterAvailable: false,
  externalListingId: 'DRZ-88390155',
  mappingState: 'PARTIALLY_MAPPED',
  skuCount: 2,
  mappedSkuCount: 1,
  sellableProductId: null,
  mappedSellableSku: null,
  sellableName: null,
  intendedTitle: 'Intel Core i7 9th Gen Custom Desktop Gaming PC',
  intendedDescription: null,
  intendedTitleBn: null,
  intendedDescriptionBn: null,
  effectiveTitleBn: null,
  effectiveDescriptionBn: null,
  /* 🔴 A LISTING-LEVEL price that must NEVER appear in a per-SKU column. */
  salePrice: '1.00',
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: '1.00',
  promotionActive: false,
  priceIsFrom: true,
  listingStock: '999',
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
  version: 3,
  skus: [BASE_SKU, SKU_B],
};

const onMapSku = vi.fn();

function show(listing: Partial<ChannelListing> = {}, mayManage = true): void {
  render(
    <MemoryRouter>
      <ListingSkuSection item={{ ...LISTING, ...listing }} mayManage={mayManage} onMapSku={onMapSku} />
    </MemoryRouter>,
  );
}

const single = (sku: Partial<ChannelListingSku> = {}): Partial<ChannelListing> => ({
  skuCount: 1, mappedSkuCount: 1, skus: [{ ...BASE_SKU, ...sku }],
});

afterEach(() => { cleanup(); onMapSku.mockClear(); });

// =====================================================================================
// Single SKU
// =====================================================================================

describe('Frame 14 — a single-SKU listing', () => {
  it('shows the orderable unit’s own facts', () => {
    show(single());
    const card = screen.getByTestId('detail-sku-sku-a').textContent ?? '';
    expect(card).toContain('ZT-PC-I7-16-256');
    expect(card).toContain('৳ 74,900');
    expect(card).toContain('8');
    expect(card).toContain('i7 9th Gen PC 16/256');
  });

  /** ⚠ Not a listing-level pseudo-SKU: the price comes from the `E-106` row. */
  it('never shows the listing-level price as the SKU price', () => {
    show(single());
    expect(screen.getByTestId('detail-sku-sku-a').textContent).not.toContain('৳ 1.00');
  });

  it('shows no variation controls', () => {
    show(single());
    expect(screen.queryByTestId('sku-variation-table')).toBeNull();
    expect(screen.queryByTestId('sku-totals')).toBeNull();
    expect(screen.getByTestId('sku-variation-note').textContent)
      .toContain('no variation controls are shown');
  });

  it('shows the parcel that belongs to that unit', () => {
    show(single());
    const parcel = screen.getByTestId('sku-parcel-sku-a').textContent ?? '';
    expect(parcel).toContain('8.500 kg');
    expect(parcel).toContain('42 × 12 × 8 cm');
    expect(parcel).toContain('1 desktop, 1 power cable');
  });

  /** 🔴 `PRD-201.f` — an unset measurement is ABSENT, never zero. */
  it('says a parcel is not measured rather than showing zero', () => {
    show(single({ packageWeightKg: null, packageLengthCm: null, packageWidthCm: null, packageHeightCm: null, packageContent: null }));
    const parcel = screen.getByTestId('sku-parcel-sku-a').textContent ?? '';
    expect(parcel).toContain('Not measured');
    expect(parcel).toContain('Not recorded');
    expect(parcel).not.toContain('0 kg');
  });
});

// =====================================================================================
// Multi-SKU — no leakage in any direction
// =====================================================================================

describe('Frame 14 — a variation listing', () => {
  it('renders every orderable SKU as its own row, in persisted order', () => {
    show();
    // ⚠ Anchored so the UNMAPPED chip's testid does not count as a row.
    const rows = screen.getAllByTestId(/^detail-sku-sku-[ab]$/);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('ZT-PC-I7-16-256');
    expect(rows[1]!.textContent).toContain('ZT-PC-I7-32-1TB');
  });

  /** 🔴 Price is per unit. The listing's own figure never fills a SKU cell. */
  it('keeps each SKU’s price its own, with no parent leakage', () => {
    show();
    expect(screen.getByTestId('detail-sku-sku-a').textContent).toContain('৳ 74,900');
    expect(screen.getByTestId('detail-sku-sku-b').textContent).toContain('৳ 108,000');
    for (const id of ['detail-sku-sku-a', 'detail-sku-sku-b']) {
      expect(screen.getByTestId(id).textContent).not.toContain('৳ 1.00');
    }
  });

  it('keeps each SKU’s listing stock its own', () => {
    show();
    expect(screen.getByTestId('detail-sku-sku-a').textContent).toContain('8');
    expect(screen.getByTestId('detail-sku-sku-b').textContent).toContain('3');
    // 🔴 The listing-level 999 is not a per-SKU truth.
    for (const id of ['detail-sku-sku-a', 'detail-sku-sku-b']) {
      expect(screen.getByTestId(id).textContent).not.toContain('999');
    }
  });

  /** 🔴 `PRD-201.c` — one parcel per orderable unit; no sibling leakage. */
  it('keeps each SKU’s parcel its own', () => {
    show();
    const a = screen.getByTestId('sku-parcel-sku-a').textContent ?? '';
    const b = screen.getByTestId('sku-parcel-sku-b').textContent ?? '';
    expect(a).toContain('8.500 kg');
    expect(a).not.toContain('11.000 kg');
    expect(b).toContain('11.000 kg');
    expect(b).toContain('1 keyboard');
    expect(a).not.toContain('1 keyboard');
  });

  /** 🔴 `INV-106.6` — the channel's OPAQUE label, never decomposed into axes. */
  it('shows the channel’s own variation label without inventing axes', () => {
    show();
    expect(screen.getByTestId('sku-variation-sku-a').textContent).toBe('16GB RAM · 256GB SSD');
    expect(screen.getByTestId('sku-variation-sku-b').textContent).toBe('32GB RAM · 1TB SSD');
    const table = screen.getByTestId('sku-variation-table').textContent ?? '';
    expect(table).not.toMatch(/\bColou?r:\s/);
    expect(table).not.toMatch(/\bSize:\s/);
  });

  it('says so when the channel reported no variation label', () => {
    show({ skus: [BASE_SKU, { ...SKU_B, variationLabel: null }] });
    expect(screen.getByTestId('sku-variation-sku-b').textContent).toBe('No variation label reported');
  });

  it('states totals as a sum for stock and a RANGE for price', () => {
    show();
    const totals = screen.getByTestId('sku-totals').textContent ?? '';
    expect(totals).toContain('11');                       // 8 + 3
    expect(totals).toContain('৳ 74,900 – ৳ 108,000');     // never an average
    expect(totals).toContain('1 of 2 mapped');
  });
});

// =====================================================================================
// Mapping — PASS 11/12 truth, per SKU
// =====================================================================================

describe('Frame 14 — mapping is per SKU', () => {
  it('shows one SKU mapped and its sibling unmapped', () => {
    show();
    expect(screen.getByTestId('detail-sku-sku-a').textContent).toContain('i7 9th Gen PC 16/256');
    expect(screen.getByTestId('sku-state-mapped-sku-a')).toBeTruthy();
    expect(screen.getByTestId('detail-sku-unmapped-sku-b')).toBeTruthy();
    // 🔴 A mapped sibling never makes the other mapped.
    expect(screen.queryByTestId('sku-state-mapped-sku-b')).toBeNull();
  });

  it('summarises the aggregate truthfully', () => {
    show();
    expect(screen.getByTestId('sku-totals').textContent).toContain('1 of 2 mapped');
  });

  /** 🔴 The PASS 12 modal, not a second implementation. */
  it('opens the shared Mapping Modal from the section', () => {
    show();
    fireEvent.click(screen.getByTestId('sku-map-unmapped'));
    expect(onMapSku).toHaveBeenCalledTimes(1);
  });

  it('offers no mapping action when every SKU is already mapped', () => {
    show({ skus: [BASE_SKU, { ...SKU_B, sellableProductId: 'sp-b', sellableSku: 'SP-000102', sellableName: 'Other' }] });
    expect(screen.queryByTestId('sku-map-unmapped')).toBeNull();
  });
});

// =====================================================================================
// State dimensions stay separate — UX-038
// =====================================================================================

describe('Frame 14 — state dimensions', () => {
  /** 🔴 `SYS-034` — unreadable is neither aligned nor diverged. */
  it('claims no comparison when the channel could not be read', () => {
    show();
    expect(screen.getByTestId('sku-state-unreadable-sku-a').textContent).toBe('NOT READABLE');
    expect(screen.queryByTestId('sku-state-aligned-sku-a')).toBeNull();
    expect(screen.queryByTestId('sku-state-diverged-sku-a')).toBeNull();
  });

  it('reports DIVERGED only from a readable difference', () => {
    show({ skus: [{ ...BASE_SKU, reportedSalePrice: '92000.00', reportedSalePriceReadable: true }] });
    expect(screen.getByTestId('sku-state-diverged-sku-a')).toBeTruthy();
    expect(screen.getByTestId('sku-reported-price-sku-a').textContent).toContain('৳ 92,000');
  });

  it('reports ALIGNED when the readable values agree', () => {
    show({ skus: [{ ...BASE_SKU, reportedSalePrice: '74900.00', reportedSalePriceReadable: true }] });
    expect(screen.getByTestId('sku-state-aligned-sku-a')).toBeTruthy();
    expect(screen.queryByTestId('sku-reported-price-sku-a')).toBeNull();
  });

  /** 🔴 `UX-038` — mapping and comparison coexist as separate carriers. */
  it('carries mapping and comparison state together, never merged', () => {
    show({ skus: [{ ...BASE_SKU, reportedSalePrice: '92000.00', reportedSalePriceReadable: true }] });
    expect(screen.getByTestId('sku-state-mapped-sku-a')).toBeTruthy();
    expect(screen.getByTestId('sku-state-diverged-sku-a')).toBeTruthy();
  });

  it('shows UNMAPPED and a comparison state on the same SKU', () => {
    show({ skus: [{ ...SKU_B, reportedSalePrice: '92000.00', reportedSalePriceReadable: true }] });
    expect(screen.getByTestId('detail-sku-unmapped-sku-b')).toBeTruthy();
    expect(screen.getByTestId('sku-state-diverged-sku-b')).toBeTruthy();
  });

  /** 🔴 `UX-269` — DIVERGED is a chip. It never frames the row in ink. */
  it('never frames a diverged SKU row in ink', () => {
    show({ skus: [{ ...BASE_SKU, reportedSalePrice: '92000.00', reportedSalePriceReadable: true }] });
    const row = screen.getByTestId('detail-sku-sku-a');
    expect(row.getAttribute('style') ?? '').not.toContain('var(--color-ink)');
    // The strength lives on the carrier instead.
    expect(screen.getByTestId('sku-state-diverged-sku-a').getAttribute('style'))
      .toContain('1.5px solid var(--color-ink)');
  });
});

// =====================================================================================
// Promotion and retired vocabulary
// =====================================================================================

describe('Frame 14 — promotion and price vocabulary', () => {
  it('distinguishes a running promotion from a scheduled one', () => {
    show(single({ promotionPrice: '69900.00', promotionActive: true, promotionStartsAt: '2026-08-01T00:00:00Z', promotionEndsAt: '2026-08-31T00:00:00Z' }));
    expect(screen.getByTestId('sku-promotion-sku-a').textContent).toContain('Promotion running');

    cleanup();
    show(single({ promotionPrice: '69900.00', promotionActive: false, promotionStartsAt: '2026-09-01T00:00:00Z', promotionEndsAt: '2026-09-30T00:00:00Z' }));
    expect(screen.getByTestId('sku-promotion-sku-a').textContent).toContain('Promotion scheduled');
  });

  it('shows no promotion line when none exists', () => {
    show(single());
    expect(screen.queryByTestId('sku-promotion-sku-a')).toBeNull();
  });

  /** 🔴 MRP is retired and appears nowhere. */
  it('never shows MRP, Regular Price or Discount Price', () => {
    show();
    const section = document.body.textContent ?? '';
    expect(section).not.toMatch(/\bMRP\b/);
    expect(section).not.toContain('Regular Price');
    expect(section).not.toContain('Discount Price');
  });

  /** ⚠ Listing stock is the channel's offered quantity, never warehouse inventory. */
  it('never labels listing stock as inventory', () => {
    show();
    const section = document.body.textContent ?? '';
    expect(section).toContain('Listing stock');
    expect(section).not.toMatch(/Available inventory|Warehouse stock/);
  });
});

// =====================================================================================
// Authority and read-only behaviour
// =====================================================================================

describe('Frame 14 — authority and read-only', () => {
  it('offers no actions to a view-only operator', () => {
    show({}, false);
    expect(screen.queryByTestId('sku-map-unmapped')).toBeNull();
    expect(screen.queryByTestId('sku-edit')).toBeNull();
    // The facts are still fully visible.
    expect(screen.getByTestId('sku-variation-table')).toBeTruthy();
  });

  it('hands editing off to the authoring form rather than editing here', () => {
    show();
    expect(screen.getByTestId('sku-edit').getAttribute('href'))
      .toBe('/inventory/products/listings/L-1/edit');
  });

  /** 🔴 §30 — no outbound or destructive per-SKU act exists on this section. */
  it('offers no push, sync, delete or duplicate action', () => {
    show();
    const labels = [...document.querySelectorAll('button, a')].map((e) => e.textContent ?? '');
    expect(labels.some((l) => /push|sync|delete|duplicate/i.test(l))).toBe(false);
  });

  /** ⚠ `INV-106.1` — an empty list is a read that lacked them, not a listing without units. */
  it('says so when no orderable SKU was returned', () => {
    show({ skus: [] });
    expect(screen.getByTestId('sku-none').textContent)
      .toContain('No orderable channel SKU was returned');
  });
});
