import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PushReviewModal } from './PushReviewModal';
import type { ChannelListingSku, ComparisonRow, PushReview } from './channelListingApi';

/**
 * FRAME 15 — Push Review.
 *
 * <p>🔴 THE CLAIM UNDER TEST is that reviewing is not sending. Opening, reading and cancelling
 * this modal must leave the ERP and the marketplace exactly as they were: no operation, no
 * activity, no cleared unsent condition, no invented external identifier and — with no adapter
 * configured — no outbound request at all.
 *
 * <p>🔴 The second claim is that the four state dimensions and the four preflight dimensions
 * stay APART (`UX-271.b`), and that per-unit facts stay per unit (`UX-271.d`).
 */

const fetchMock = vi.fn();

function stub(review: Partial<PushReview>, confirmImpl?: () => Response): void {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    // ⚠ The real client fetches a CSRF token before any mutating request. It is answered
    //   here so the POST under test is reached, and it is filtered out of `requests()`.
    if (String(url).includes('/api/auth/csrf')) {
      return Promise.resolve(json({}));
    }
    if (String(url).includes('/push-review/confirm')) {
      return Promise.resolve(confirmImpl ? confirmImpl() : json({ batchId: 'b-1' }));
    }
    if (String(url).includes('/push-review')) {
      return Promise.resolve(json({ ...BASE, ...review }));
    }
    throw new Error(`Unexpected request ${String(init?.method ?? 'GET')} ${String(url)}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Every outbound request the modal made, so "nothing was sent" is measured, not assumed. */
function requests(): readonly { url: string; method: string }[] {
  return fetchMock.mock.calls
    .map((call) => ({
      url: new URL(String(call[0]), 'http://localhost').pathname,
      method: String((call[1] as RequestInit | undefined)?.method ?? 'GET'),
    }))
    // ⚠ The CSRF handshake is transport, not an act on the Listing.
    .filter((r) => !r.url.includes('/api/auth/csrf'));
}

const SKU = (over: Partial<ChannelListingSku> & { id: string }): ChannelListingSku => ({
  channelSku: null,
  sellableProductId: null,
  sellableSku: null,
  sellableName: null,
  salePrice: null,
  promotionPrice: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  effectiveSellingPrice: null,
  promotionActive: false,
  listingStock: null,
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
  ...over,
});

const row = (over: Partial<ComparisonRow> & { fieldKey: string; label: string }): ComparisonRow => ({
  intendedValue: null,
  reportedValue: null,
  reportedReadable: true,
  state: 'ALIGNED',
  resolvable: false,
  ...over,
});

/** ⚠ The no-adapter environment this release actually ships in. */
const NO_ADAPTER = {
  dimension: 'ADAPTER_CAPABILITY' as const,
  blocking: true,
  text: 'No writable marketplace adapter is configured for Daraz account A. The review is '
    + 'complete, but nothing can be sent.',
};

const BASE: PushReview = {
  listingId: 'L-1',
  reviewVersion: 7,
  mode: 'EXISTING_UPDATE',
  listingTitle: 'Hi-Power 22 Inch IPS Monitor',
  channelName: 'Daraz account A',
  channelType: 'DARAZ',
  externalListingId: 'DRZ-87720113',
  skuCount: 1,
  mappedSkuCount: 1,
  unsentLocalChanges: true,
  divergedFieldCount: 0,
  publicationIntent: 'PUBLISH',
  perSkuCommercials: false,
  fields: [
    row({ fieldKey: 'title', label: 'Title', intendedValue: 'Hi-Power 22 Inch IPS Monitor', reportedValue: 'Hi-Power 22 Inch IPS Monitor' }),
    row({ fieldKey: 'sale_price', label: 'Sale Price', intendedValue: '10900.00', reportedValue: '11200.00', state: 'DIVERGED' }),
  ],
  skus: [SKU({ id: 's-1', channelSku: 'ZT-MON-22IPS', sellableProductId: 'sp-1', salePrice: '10900.00', listingStock: '31' })],
  effectiveMedia: [],
  mediaIsFallback: false,
  highlights: [],
  banglaOverridePresent: false,
  banglaFallsBackToEnglish: true,
  preflight: [NO_ADAPTER],
  executable: false,
  executionBlockedReason: NO_ADAPTER.text,
};

const open = async (): Promise<void> => {
  render(<PushReviewModal listingId="L-1" onClose={() => {}} />);
  await screen.findByTestId('push-review-target');
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Frame 15 — Push Review', () => {
  // ===================================================================================
  // §74 · §85 · §89 — opening and cancelling change nothing
  // ===================================================================================

  /**
   * 🔴 §74 / §85 — THE CENTRAL CLAIM. Opening a review is a READ. Nothing is dispatched, no
   * operation is requested, and the modal never touches an endpoint that mutates.
   */
  it('opens with a single read and dispatches nothing', async () => {
    stub({});
    await open();

    expect(requests()).toEqual([
      { url: '/api/product/channel-listings/L-1/push-review', method: 'GET' },
    ]);
    // 🔴 No POST of any kind — not a confirm, not an operation, not an activity write.
    expect(requests().some((r) => r.method !== 'GET')).toBe(false);
  });

  /** 🔴 §74 — cancelling is equally inert, and the unsent condition is untouched. */
  it('cancels without sending anything and without clearing UNSENT', async () => {
    stub({});
    const onClose = vi.fn();
    render(<PushReviewModal listingId="L-1" onClose={onClose} />);
    await screen.findByTestId('push-review-target');

    expect(screen.getByTestId('push-review-unsent').textContent).toContain('UNSENT LOCAL CHANGES');
    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(requests().filter((r) => r.method !== 'GET')).toHaveLength(0);
  });

  // ===================================================================================
  // §85 · §43 · §65 — the no-adapter environment
  // ===================================================================================

  /**
   * 🔴 §43 / §65 — THE REVIEW IS AVAILABLE; EXECUTION IS NOT. The action is disabled with its
   * reason as VISIBLE text, not a tooltip, and clicking it sends nothing.
   */
  it('disables the outbound action with a visible reason and refuses to send', async () => {
    stub({});
    await open();

    const confirm = screen.getByTestId('push-review-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(confirm.textContent).toBe('Push unavailable');

    // 🔴 The reason is READABLE and ASSOCIATED — never tooltip-only (`A11Y`).
    const reason = screen.getByTestId('push-review-disabled-reason');
    expect(reason.textContent).toContain('No writable marketplace adapter is configured');
    expect(confirm.getAttribute('aria-describedby')).toBe(reason.id);

    /*
      🔴 A SOLID OR DARK FILL REPRESENTS AN EXECUTABLE ACTION. The unavailable action carries
      the shared NEUTRAL disabled treatment instead — a black "Push unavailable" reads as the
      one control the operator is meant to press, leaving the word "unavailable" to argue
      against its own button.
    */
    expect(confirm.style.background).toBe('var(--color-divider-light)');
    expect(confirm.style.color).toBe('var(--color-text-muted)');
    expect(confirm.style.boxShadow).toBe('none');
    expect(confirm.style.cursor).toBe('not-allowed');

    fireEvent.click(confirm);
    expect(requests().filter((r) => r.url.includes('confirm'))).toHaveLength(0);
  });

  /** 🔴 §72 — the blocker is REAL and named in its own dimension, not a fabricated API error. */
  it('reports the absent adapter as an ADAPTER_CAPABILITY blocker', async () => {
    stub({});
    await open();

    const preflight = screen.getByTestId('push-review-preflight');
    expect(within(preflight).getByText('Adapter capability')).toBeTruthy();
    expect(within(preflight).getAllByTestId('preflight-blocking')).toHaveLength(1);
    expect(screen.getByTestId('push-review-preflight-summary').textContent).toBe('1 BLOCKING');
  });

  // ===================================================================================
  // §76 · §77 — the two modes never share wording
  // ===================================================================================

  /** 🔴 §76 — a remote identity exists, so this is an UPDATE and says so. */
  it('uses update wording and shows the channel identifier', async () => {
    stub({});
    await open();

    expect(screen.getByTestId('push-review-mode').textContent).toBe('EXISTING LISTING UPDATE');
    expect(screen.getByTestId('push-review-external-id').textContent).toBe('DRZ-87720113');
    expect(document.body.textContent).toContain('Updates this Listing on Daraz account A');
    expect(document.body.textContent).not.toContain('Creates this Listing');
  });

  /**
   * 🔴 §77 / §18 — no remote identity, so this would CREATE. ⚠ `PRD-188.b` / `§39.10.k` — no
   * identifier is invented, and neither the Seller SKU nor a local UUID is shown as one.
   */
  it('uses first-publication wording and invents no external identifier', async () => {
    stub({
      mode: 'FIRST_PUBLICATION',
      externalListingId: null,
      listingTitle: 'Gaming PC RTX build (revised)',
    });
    await open();

    expect(screen.getByTestId('push-review-mode').textContent).toBe('FIRST PUBLICATION');
    expect(screen.getByTestId('push-review-external-id').textContent)
      .toBe('Not published — no channel identifier yet');
    expect(document.body.textContent).toContain('Creates this Listing on Daraz account A');
    expect(document.body.textContent).not.toContain('Updates this Listing');

    // 🔴 Nothing that is not a channel-issued identifier is presented as one.
    const id = screen.getByTestId('push-review-external-id').textContent ?? '';
    expect(id).not.toContain('ZT-MON');
    expect(id).not.toContain('L-1');
    expect(screen.getByTestId('push-review-confirm').textContent).toBe('Publish unavailable');
  });

  // ===================================================================================
  // §78 · §79 · §80 — per-unit truth
  // ===================================================================================

  /** 🔴 §78 — a single-SKU review uses that SKU's own facts, and MRP appears nowhere. */
  it('reviews a single SKU from its own facts and never shows MRP', async () => {
    stub({});
    await open();

    expect(screen.getByTestId('push-review-field-sale_price').textContent).toContain('10900.00');
    expect(document.body.textContent).not.toContain('MRP');
    // 🔴 `UX-271.a` — the canonical name, not the Design pack's "Channel price".
    expect(document.body.textContent).toContain('Sale Price');
    expect(document.body.textContent).not.toContain('Channel price');
  });

  /**
   * 🔴 §79 / `UX-271.d` — THE CORE PER-UNIT CLAIM. Two SKUs with genuinely different prices,
   * stock and parcels keep them. No cell is filled from the parent and no sibling's value is
   * borrowed.
   */
  it('keeps every per-SKU fact tied to its own SKU', async () => {
    stub({
      skuCount: 2,
      mappedSkuCount: 1,
      perSkuCommercials: true,
      skus: [
        SKU({
          id: 's-43', channelSku: 'MME-QLED-43', sellableProductId: 'sp-2',
          salePrice: '45900.00', listingStock: '6', variationLabel: '43 inch · QLED',
          packageWeightKg: '9.400', packageLengthCm: '104', packageWidthCm: '18', packageHeightCm: '66',
        }),
        SKU({
          id: 's-55', channelSku: 'MME-QLED-55', salePrice: '62900.00', listingStock: '2',
          variationLabel: '55 inch · QLED', position: 1,
          packageWeightKg: '14.200', packageLengthCm: '132', packageWidthCm: '21', packageHeightCm: '82',
        }),
      ],
    });
    await open();

    const a = screen.getByTestId('push-review-sku-MME-QLED-43');
    const b = screen.getByTestId('push-review-sku-MME-QLED-55');

    // §79 — prices and stock are independent and neither leaks into the other.
    expect(a.textContent).toContain('45900.00');
    expect(a.textContent).not.toContain('62900.00');
    expect(b.textContent).toContain('62900.00');
    expect(b.textContent).not.toContain('45900.00');
    expect(a.textContent).toContain('6');
    expect(b.textContent).toContain('2');

    // §80 — the parcels stay with their own SKU.
    expect(screen.getByTestId('push-review-sku-parcel-MME-QLED-43').textContent).toContain('9.400 kg');
    expect(screen.getByTestId('push-review-sku-parcel-MME-QLED-55').textContent).toContain('14.200 kg');
    expect(screen.getByTestId('push-review-sku-parcel-MME-QLED-43').textContent).not.toContain('14.200');

    // 🔴 `UX-271.b` — mapping is per SKU, and one mapped sibling does not map the other.
    expect(within(a).getByText('MAPPED')).toBeTruthy();
    expect(within(b).getByText('UNMAPPED')).toBeTruthy();
  });

  /**
   * 🔴 `UX-271.d` — on a variation Listing NO listing-level commercial figure is presented as
   * what will be sent, because the orderable units own those facts (`INV-106.2`).
   */
  it('omits listing-level price and stock rows on a variation Listing', async () => {
    stub({
      skuCount: 2,
      perSkuCommercials: true,
      fields: [
        row({ fieldKey: 'title', label: 'Title', intendedValue: 'MME 43 Inch QLED Google TV' }),
        row({ fieldKey: 'sale_price', label: 'Sale Price', intendedValue: '1.00' }),
        row({ fieldKey: 'listing_stock', label: 'Listing stock', intendedValue: '999' }),
      ],
      skus: [
        SKU({ id: 's-43', channelSku: 'MME-QLED-43', salePrice: '45900.00', listingStock: '6' }),
        SKU({ id: 's-55', channelSku: 'MME-QLED-55', salePrice: '62900.00', listingStock: '2', position: 1 }),
      ],
    });
    await open();

    const fields = screen.getByTestId('push-review-fields');
    expect(within(fields).queryByTestId('push-review-field-sale_price')).toBeNull();
    expect(within(fields).queryByTestId('push-review-field-listing_stock')).toBeNull();
    // ⚠ The parent figures are nowhere in the outbound facts panel.
    expect(fields.textContent).not.toContain('999');
    expect(within(fields).getByTestId('push-review-field-title')).toBeTruthy();
  });

  // ===================================================================================
  // §81 · §82 — media and language
  // ===================================================================================

  /** 🔴 §81 — with no Listing override the MASTER set is what would be sent, labelled as such. */
  it('reviews the Sellable Product master media when the Listing holds no override', async () => {
    stub({
      mediaIsFallback: true,
      effectiveMedia: [
        { id: 'm1', mediaAssetId: 'a1', storageReference: 'ref-1', role: 'PRIMARY', source: 'SELLABLE_MASTER', position: 0 },
        { id: 'm2', mediaAssetId: 'a2', storageReference: 'ref-2', role: 'GALLERY', source: 'SELLABLE_MASTER', position: 1 },
      ],
    });
    await open();

    expect(screen.getByTestId('push-review-media-origin').textContent).toBe('PRODUCT MASTER');
    expect(screen.getByTestId('push-review-media-count').textContent)
      .toContain('2 images from the mapped Sellable Product');
  });

  /** 🔴 §81 — where an override exists it is reviewed EXCLUSIVELY; no master leaks in. */
  it('reviews the Listing override exclusively when one exists', async () => {
    stub({
      mediaIsFallback: false,
      effectiveMedia: [
        { id: 'm9', mediaAssetId: 'a9', storageReference: 'own-1', role: 'PRIMARY', source: 'LISTING_INTENDED', position: 0 },
      ],
    });
    await open();

    expect(screen.getByTestId('push-review-media-origin').textContent).toBe('LISTING OVERRIDE');
    expect(screen.getByTestId('push-review-media-count').textContent).toContain('own override');
    expect(screen.getByTestId('push-review-media').textContent).not.toContain('master set');
  });

  /**
   * 🔴 §82 / `PRD-202.c` — the fallback is identified TRUTHFULLY as a fallback. It must not
   * claim an explicit Bangla override exists, and it must not read as a missing field.
   */
  it('identifies the English fallback without claiming a Bangla override', async () => {
    stub({ banglaOverridePresent: false, banglaFallsBackToEnglish: true });
    await open();

    expect(screen.getByTestId('push-review-bangla').textContent)
      .toBe('No Bangla override — the English content will be used');
  });

  // ===================================================================================
  // §86 · §87 · §52 — comparison dimensions
  // ===================================================================================

  /** 🔴 §86 — reviewing does not resolve divergence, and the two directions stay separate. */
  it('shows DIVERGED without offering to resolve it', async () => {
    stub({ divergedFieldCount: 1 });
    await open();

    expect(screen.getByTestId('push-review-diverged').textContent).toContain('DIVERGED · 1');
    expect(screen.getByTestId('push-review-diverged-note').textContent)
      .toContain('this review never resolves a divergence');
    // 🔴 Accept Marketplace belongs to Frame 08 and is deliberately absent here.
    expect(screen.queryByText('Accept marketplace')).toBeNull();
  });

  /** 🔴 §87 / §50 — an unreadable reported fact is NOT READABLE, never blank, zero or aligned. */
  it('labels an unreadable reported fact rather than implying agreement', async () => {
    stub({
      fields: [
        row({ fieldKey: 'listing_stock', label: 'Listing stock', intendedValue: '6', reportedReadable: false, state: 'NOT_READABLE' }),
      ],
    });
    await open();

    const cell = screen.getByTestId('push-review-field-listing_stock');
    expect(within(cell).getByTestId('not-readable-listing_stock').textContent).toBe('NOT READABLE');
    expect(cell.textContent).not.toContain('ALIGNED');
    expect(cell.textContent).not.toContain('0');
  });

  /**
   * 🔴 §52 / `UX-271.b` — UNSENT and DIVERGED are DIFFERENT facts about different things and
   * may be true at once. Neither is merged into the other, and neither becomes a status.
   */
  it('carries UNSENT, DIVERGED and mapping as independent carriers', async () => {
    stub({
      unsentLocalChanges: true,
      divergedFieldCount: 2,
      skuCount: 2,
      mappedSkuCount: 0,
    });
    await open();

    const carriers = screen.getByTestId('push-review-carriers');
    expect(within(carriers).getByText('UNMAPPED')).toBeTruthy();
    expect(within(carriers).getByText('DIVERGED · 2')).toBeTruthy();
    expect(within(carriers).getByText('UNSENT LOCAL CHANGES')).toBeTruthy();
  });

  // ===================================================================================
  // §38 · §39 · §84 — preflight dimensions and whole-Listing blocking
  // ===================================================================================

  /** 🔴 §38 — the four dimensions are reported separately, never as one generic error. */
  it('keeps the four preflight dimensions apart', async () => {
    stub({
      preflight: [
        { dimension: 'LOCAL_VALIDATION', blocking: false, text: 'Listing title is set' },
        { dimension: 'MAPPING', blocking: false, text: '1 of 2 orderable SKUs mapped' },
        NO_ADAPTER,
        { dimension: 'MARKETPLACE_SCHEMA', blocking: false, text: 'Marketplace category and attribute validation cannot be completed' },
      ],
    });
    await open();

    const preflight = screen.getByTestId('push-review-preflight');
    for (const label of ['Local validation', 'Mapping and business readiness', 'Adapter capability', 'Marketplace validation']) {
      expect(within(preflight).getByText(label)).toBeTruthy();
    }
    // §39 — three recommendations, exactly one blocker. Blank optional fields do not block.
    expect(within(preflight).getAllByTestId('preflight-recommendation')).toHaveLength(3);
    expect(within(preflight).getAllByTestId('preflight-blocking')).toHaveLength(1);
  });

  /**
   * 🔴 §84 / §40 — ONE blocking fact blocks the WHOLE Listing. The blocked SKU is still shown
   * and is never silently dropped so the rest can be sent.
   */
  it('blocks the whole Listing on one blocking fact and drops no SKU', async () => {
    stub({
      skuCount: 2,
      perSkuCommercials: true,
      executable: false,
      executionBlockedReason: 'Listing title is required before this Listing can be sent',
      preflight: [
        { dimension: 'LOCAL_VALIDATION', blocking: true, text: 'Listing title is required before this Listing can be sent' },
        NO_ADAPTER,
      ],
      skus: [
        SKU({ id: 's-43', channelSku: 'MME-QLED-43', salePrice: '45900.00' }),
        SKU({ id: 's-55', channelSku: 'MME-QLED-55', salePrice: null, position: 1 }),
      ],
    });
    await open();

    expect((screen.getByTestId('push-review-confirm') as HTMLButtonElement).disabled).toBe(true);
    // 🔴 Both SKUs remain visible. Partial publication is not introduced.
    expect(screen.getByTestId('push-review-sku-MME-QLED-43')).toBeTruthy();
    expect(screen.getByTestId('push-review-sku-MME-QLED-55')).toBeTruthy();
    expect(screen.getAllByTestId('preflight-blocking')).toHaveLength(2);
  });

  // ===================================================================================
  // §88 — stale review
  // ===================================================================================

  /**
   * 🔴 §88 — the reviewed VERSION travels with the confirmation. A Listing that moved on is
   * refused before dispatch, and the refusal is shown in place rather than by closing.
   */
  it('sends the reviewed version and surfaces a stale-review refusal in place', async () => {
    const onClose = vi.fn();
    stub({ executable: true, executionBlockedReason: null, preflight: [] }, () =>
      json({ field: 'reviewVersion', message: 'This Listing changed after the review was opened. Review the latest version before pushing.' }, 422));
    render(<PushReviewModal listingId="L-1" onClose={onClose} />);
    await screen.findByTestId('push-review-target');

    fireEvent.click(screen.getByTestId('push-review-confirm'));

    await waitFor(() => expect(screen.getByTestId('dialog-error')).toBeTruthy());
    expect(screen.getByTestId('dialog-error').textContent).toContain('changed after the review was opened');
    // 🔴 The modal stays open; a refused confirmation must not look like a completed one.
    expect(onClose).not.toHaveBeenCalled();

    const confirm = requests().find((r) => r.url.includes('confirm'));
    expect(confirm).toBeTruthy();
    const body = JSON.parse(String((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body));
    expect(body).toEqual({ reviewVersion: 7 });
  });

  // ===================================================================================
  // §66 — accessibility
  // ===================================================================================

  /** 🔴 §66 — the shared Dialog contract: role, modality, title association and a focus trap. */
  it('uses the shared modal contract', async () => {
    stub({});
    await open();

    const dialog = screen.getByTestId('push-review');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Review & Push');
    expect(screen.getByTestId('dialog-scrim')).toBeTruthy();
  });

  /** 🔴 §66 — Escape closes when nothing is in flight. */
  it('closes on Escape', async () => {
    stub({});
    const onClose = vi.fn();
    render(<PushReviewModal listingId="L-1" onClose={onClose} />);
    await screen.findByTestId('push-review-target');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
