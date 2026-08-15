import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChannelListingComparison } from './ChannelListingComparison';
import type { ChannelListing, ComparisonRow } from './channelListingApi';
import { formatMoment } from '../platform/datetime';

/**
 * FRAME 07 — Intended vs reported, and FRAME 08 — the resolution dialogs it launches.
 *
 * <p>🔴 The claim under test throughout is that the five conditions stay APART. Unreadable is
 * never equal, MANUAL_REQUIRED is never a failure, and an unsent local edit is never a
 * divergence.
 */

const accept = vi.fn(async () => undefined);
const operation = vi.fn(async () => ({ batchId: 'batch-1' }));

vi.mock('./channelListingApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./channelListingApi')>()),
  acceptMarketplaceValue: (...args: unknown[]) => accept(...(args as [])),
  requestOperation: (...args: unknown[]) => operation(...(args as [])),
}));

const ITEM = {
  id: 'listing-1',
  channelInstance: 'DARAZ-A',
  channelName: 'Daraz account A',
  externalListingId: 'DRZ-87720113',
  adapterAvailable: true,
  intendedTitle: 'Hi-Power 22 Inch IPS Monitor',
  lastSyncAt: '2026-08-13T08:15:00Z',
  lastSuccessfulPushAt: '2026-07-28T16:04:00Z',
} as unknown as ChannelListing;

const ALIGNED: ComparisonRow = {
  fieldKey: 'title', label: 'Title',
  intendedValue: 'Hi-Power 22 Inch IPS Monitor',
  reportedValue: 'Hi-Power 22 Inch IPS Monitor',
  reportedReadable: true, state: 'ALIGNED', resolvable: false,
};
const DIVERGED: ComparisonRow = {
  fieldKey: 'sale_price', label: 'Sale Price',
  intendedValue: '11200.00', reportedValue: '10900.00',
  reportedReadable: true, state: 'DIVERGED', resolvable: true,
};
const NOT_READABLE: ComparisonRow = {
  fieldKey: 'attribute:Warranty period', label: 'Warranty period',
  intendedValue: '12 months', reportedValue: null,
  reportedReadable: false, state: 'NOT_READABLE', resolvable: false,
};
const MANUAL: ComparisonRow = {
  fieldKey: 'media', label: 'Media order',
  intendedValue: '5 images', reportedValue: '5 images · order not reliably readable',
  reportedReadable: true, state: 'MANUAL_REQUIRED', resolvable: false,
};
const UNSENT: ComparisonRow = {
  fieldKey: 'listing_stock', label: 'Listing stock',
  intendedValue: '31', reportedValue: '18',
  reportedReadable: true, state: 'UNSENT', resolvable: false,
};

const ALL = [ALIGNED, DIVERGED, NOT_READABLE, MANUAL, UNSENT];

const compareMedia = vi.fn();
const resolved = vi.fn(async () => undefined);

function renderComparison(options: {
  rows?: readonly ComparisonRow[];
  mayManage?: boolean;
  mayPublish?: boolean;
  item?: ChannelListing;
} = {}): ReturnType<typeof render> {
  return render(
    <ChannelListingComparison
      item={options.item ?? ITEM}
      rows={options.rows ?? ALL}
      mayManage={options.mayManage ?? true}
      mayPublish={options.mayPublish ?? true}
      onResolved={resolved}
      onCompareMedia={compareMedia}
    />,
  );
}

beforeEach(() => {
  accept.mockClear();
  operation.mockClear();
  compareMedia.mockClear();
  resolved.mockClear();
});

afterEach(cleanup);

// =====================================================================================
// FRAME 07 — the comparison surface
// =====================================================================================

describe('Frame 07 — Intended vs reported', () => {
  it('names the four columns in the canonical order', () => {
    renderComparison();
    const headings = ['Fact', 'ERP intended', 'Marketplace reported', 'Resolution'];
    headings.forEach((heading) => expect(screen.getAllByText(heading).length).toBeGreaterThan(0));
  });

  it('states which channel was read and when', () => {
    const { container } = renderComparison();
    expect(container.textContent)
      .toContain(`Daraz account A · reported values read ${formatMoment(ITEM.lastSyncAt)}`);
  });

  it('never claims a read that did not happen', () => {
    const { container } = renderComparison({ item: { ...ITEM, lastSyncAt: null } as ChannelListing });
    expect(container.textContent).toContain('the channel has not been read back yet');
    expect(container.textContent).not.toContain('reported values read');
  });

  /** ✅ CASE A — quiet. An aligned fact must not compete with an exception. */
  it('renders an aligned fact with no emphasis and no action', () => {
    renderComparison({ rows: [ALIGNED] });
    const row = screen.getByTestId('comparison-row-title');
    expect(row.getAttribute('style')).toContain('background: transparent');
    expect(row.getAttribute('style')).toContain('box-shadow: none');
    expect(screen.getByText('Nothing to resolve')).toBeTruthy();
    expect(screen.queryByTestId('comparison-accept-title')).toBeNull();
    expect(screen.queryByTestId('comparison-push-title')).toBeNull();
  });

  /** 🔴 CASE B — the ink left rule is the exception marker, and only divergence earns it. */
  it('marks a readable difference with the ink rule and a tinted row', () => {
    renderComparison({ rows: [DIVERGED] });
    const style = screen.getByTestId('comparison-row-sale_price').getAttribute('style') ?? '';
    expect(style).toContain('inset 3px 0 0 var(--color-ink)');
    expect(style).toContain('background: var(--color-strip)');
    expect(screen.getByTestId('comparison-state-sale_price').textContent).toBe('DIVERGED');
  });

  it('offers both resolutions on a diverged fact', () => {
    renderComparison({ rows: [DIVERGED] });
    expect(screen.getByTestId('comparison-accept-sale_price').textContent).toBe('Accept Marketplace');
    expect(screen.getByTestId('comparison-push-sale_price').textContent).toBe('Push ERP');
  });

  /**
   * 🔴 CASE C, `SYS-034` — the channel returned NOTHING. That is stated as a sentence and is
   * never a blank, a dash or a zero, because each of those asserts a value that was not read.
   */
  it('states an unreadable value as a sentence, never as an empty or zero value', () => {
    renderComparison({ rows: [NOT_READABLE] });
    const row = screen.getByTestId('comparison-row-attribute:Warranty period');
    expect(row.textContent).toContain('Not readable from this channel');
    expect(row.textContent).not.toContain('—');
    expect(row.textContent).not.toContain('0');
    expect(row.getAttribute('style')).toContain('box-shadow: none');
  });

  it('never offers Accept Marketplace for a value that was not read', () => {
    renderComparison({ rows: [NOT_READABLE] });
    expect(screen.queryByTestId('comparison-accept-attribute:Warranty period')).toBeNull();
    expect(screen.getByText('Comparison not possible. Pushing sends the ERP value.')).toBeTruthy();
  });

  /** 🔴 `PRD-183.e` — MANUAL_REQUIRED is a normal state: not a failure, and not agreement. */
  it('offers a person the media surface instead of an automatic resolution', () => {
    renderComparison({ rows: [MANUAL] });
    expect(screen.getByTestId('comparison-state-media').textContent).toBe('MANUAL REQUIRED');
    expect(screen.queryByTestId('comparison-accept-media')).toBeNull();
    expect(screen.queryByTestId('comparison-push-media')).toBeNull();
    fireEvent.click(screen.getByTestId('comparison-manual-media'));
    expect(compareMedia).toHaveBeenCalledTimes(1);
  });

  it('does not mark a manual-comparison fact as an exception', () => {
    renderComparison({ rows: [MANUAL] });
    expect(screen.getByTestId('comparison-row-media').getAttribute('style')).toContain('box-shadow: none');
  });

  /**
   * 🔴 CASE D, `PRD-185.d` — the reported value is still correct for what was last sent, so
   * this is an unsent local edit and NOT a divergence. Accept Marketplace is absent because
   * there is nothing to accept: the channel is not disagreeing.
   */
  it('treats an unsent local edit as unsent, not as divergence', () => {
    renderComparison({ rows: [UNSENT] });
    const row = screen.getByTestId('comparison-row-listing_stock');
    expect(screen.getByTestId('comparison-state-listing_stock').textContent).toContain('UNSENT');
    expect(row.getAttribute('style')).toContain('box-shadow: none');
    expect(row.textContent).toContain('Consistent with the last push — not a divergence');
    expect(screen.queryByTestId('comparison-accept-listing_stock')).toBeNull();
    expect(screen.getByTestId('comparison-push-listing_stock').textContent).toBe('Review & Push');
  });

  /** 🔴 `TEC-015` — money is formatted from the string. It is never parsed into a Number. */
  it('renders money through the string formatter', () => {
    renderComparison({ rows: [DIVERGED] });
    const row = screen.getByTestId('comparison-row-sale_price');
    expect(row.textContent).toContain('৳ 11,200');
    expect(row.textContent).toContain('৳ 10,900');
    expect(row.textContent).not.toContain('11200.00');
  });

  it('filters to the differences and states how many there are', () => {
    renderComparison();
    expect(screen.getByTestId('comparison-filter-diff').textContent).toBe('Differences only (1)');
    fireEvent.click(screen.getByTestId('comparison-filter-diff'));
    expect(screen.getByTestId('comparison-row-sale_price')).toBeTruthy();
    expect(screen.queryByTestId('comparison-row-title')).toBeNull();
    expect(screen.queryByTestId('comparison-row-media')).toBeNull();
  });

  it('cannot filter to differences when there are none', () => {
    renderComparison({ rows: [ALIGNED, NOT_READABLE] });
    const chip = screen.getByTestId('comparison-filter-diff') as HTMLButtonElement;
    expect(chip.textContent).toBe('Differences only (0)');
    expect(chip.disabled).toBe(true);
  });

  it('says nothing readable differs without claiming everything was compared', () => {
    renderComparison({ rows: [ALIGNED, NOT_READABLE] });
    fireEvent.click(screen.getByTestId('comparison-filter-all'));
    expect(screen.getByTestId('comparison-row-attribute:Warranty period')).toBeTruthy();
  });

  // ---------------------------------------------------------------- authority vs capability

  /** 🔴 Manage never implies Publish. */
  it('omits Push for a manage-only operator', () => {
    renderComparison({ rows: [DIVERGED, UNSENT], mayPublish: false });
    expect(screen.getByTestId('comparison-accept-sale_price')).toBeTruthy();
    expect(screen.queryByTestId('comparison-push-sale_price')).toBeNull();
    expect(screen.getByText('Sending this change requires publish authority.')).toBeTruthy();
  });

  it('omits Accept Marketplace for a publish-only operator', () => {
    renderComparison({ rows: [DIVERGED], mayManage: false });
    expect(screen.queryByTestId('comparison-accept-sale_price')).toBeNull();
    expect(screen.getByTestId('comparison-push-sale_price')).toBeTruthy();
  });

  it('states plainly when an operator may resolve nothing', () => {
    renderComparison({ rows: [DIVERGED], mayManage: false, mayPublish: false });
    expect(screen.getByText('You cannot resolve this difference.')).toBeTruthy();
  });

  /**
   * ⚠ A missing adapter is a CAPABILITY limit, not an authority refusal. The action stays
   * visible with its real reason rather than disappearing as though the operator lacked
   * permission — and it is never faked as a successful push.
   */
  it('separates a missing adapter from a missing permission', () => {
    renderComparison({ rows: [DIVERGED], item: { ...ITEM, adapterAvailable: false } as ChannelListing });
    const push = screen.getByTestId('comparison-push-sale_price') as HTMLButtonElement;
    expect(push.disabled).toBe(true);
    expect(screen.getByTestId('comparison-capability-sale_price').textContent)
      .toContain('No marketplace adapter is configured for this channel.');
  });

  /**
   * 🔴 The capability sentence is a full sentence in a 240px column. It must STACK beneath
   * the actions; as a `flex-basis: 100%` child of a nowrap row it did not wrap at all and
   * escaped the card to the right.
   */
  it('stacks the capability sentence under the actions instead of beside them', () => {
    renderComparison({ rows: [DIVERGED], item: { ...ITEM, adapterAvailable: false } as ChannelListing });
    const note = screen.getByTestId('comparison-capability-sale_price');
    expect(note.getAttribute('style')).not.toContain('flex-basis');
    const cell = note.parentElement as HTMLElement;
    expect(cell.getAttribute('style')).toContain('flex-direction: column');
    // The action pair itself still never wraps.
    const actions = screen.getByTestId('comparison-push-sale_price').parentElement as HTMLElement;
    expect(actions.getAttribute('style')).toContain('flex-wrap: nowrap');
  });

  /** 🔴 Structured operational rows do not wrap, and no row scrolls horizontally. */
  it('keeps structured rows non-wrapping with no horizontal scroll affordance', () => {
    renderComparison();
    ALL.forEach((row) => {
      const style = screen.getByTestId(`comparison-row-${row.fieldKey}`).getAttribute('style') ?? '';
      expect(style).toContain('grid-template-columns: 150px minmax(0, 1fr) minmax(0, 1fr) 240px');
      expect(style).not.toContain('overflow-x');
      expect(style).not.toContain('flex-wrap: wrap');
    });
  });
});

// =====================================================================================
// FRAME 08 — the resolution dialogs
// =====================================================================================

describe('Frame 08 — Resolution dialogs', () => {
  it('states the consequence before the action is reachable', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    const dialog = screen.getByTestId('accept-marketplace-dialog');
    const text = dialog.textContent ?? '';
    expect(text.indexOf('will replace the ERP listing intended value'))
      .toBeLessThan(text.indexOf('Accept Marketplace'));
  });

  /** 🔴 `PRD-184.c` — accepting never rewrites master content, and never contacts a channel. */
  it('states what Accept Marketplace does NOT change', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    const text = screen.getByTestId('accept-marketplace-dialog').textContent ?? '';
    expect(text).toContain('Sellable Product master data will not be changed');
    expect(text).toContain('nothing is sent to the channel');
  });

  it('shows the accept before/after with the fact named and money formatted', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    const table = screen.getByTestId('accept-dialog-table');
    ['Fact', 'Current ERP', 'Becomes'].forEach((h) => expect(table.textContent).toContain(h));
    expect(table.textContent).toContain('Sale Price');
    expect(table.textContent).toContain('৳ 11,200');
    expect(table.textContent).toContain('৳ 10,900');
  });

  it('names the listing the acceptance applies to', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    expect(screen.getByTestId('accept-marketplace-dialog').textContent)
      .toContain('Hi-Power 22 Inch IPS Monitor');
  });

  it('changes nothing when the operator cancels', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('accept-marketplace-dialog')).toBeNull();
    expect(accept).not.toHaveBeenCalled();
  });

  /** 🔴 `PRD-183` — ONE field. Accepting a price never sweeps up the rest of the listing. */
  it('accepts exactly the one field the row is about', async () => {
    renderComparison({ rows: [DIVERGED, ALIGNED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    fireEvent.click(within(screen.getByTestId('accept-marketplace-dialog')).getByText('Accept Marketplace'));
    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
    expect(accept).toHaveBeenCalledWith('listing-1', 'sale_price');
    await waitFor(() => expect(resolved).toHaveBeenCalled());
  });

  it('closes and reloads once the acceptance succeeds', async () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    fireEvent.click(within(screen.getByTestId('accept-marketplace-dialog')).getByText('Accept Marketplace'));
    await waitFor(() => expect(screen.queryByTestId('accept-marketplace-dialog')).toBeNull());
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  /** 🔴 A failure claims nothing. The dialog stays open with the real reason. */
  it('keeps the dialog open and states the real reason when acceptance fails', async () => {
    accept.mockRejectedValueOnce(new Error('MRP may not be below Sale Price.'));
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    fireEvent.click(within(screen.getByTestId('accept-marketplace-dialog')).getByText('Accept Marketplace'));
    await waitFor(() => expect(screen.getByTestId('dialog-error')).toBeTruthy());
    expect(screen.getByTestId('dialog-error').textContent).toBe('MRP may not be below Sale Price.');
    expect(screen.getByTestId('accept-marketplace-dialog')).toBeTruthy();
    expect(resolved).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------------ Push ERP Version

  it('names the channel the push will modify', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-push-sale_price'));
    const text = screen.getByTestId('push-erp-dialog').textContent ?? '';
    expect(text).toContain('Push ERP value to Daraz account A?');
    expect(text).toContain('The marketplace listing will be modified.');
  });

  it('shows the push before/after from the channel side to the ERP side', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-push-sale_price'));
    const table = screen.getByTestId('push-dialog-table');
    ['Field', 'On the channel now', 'Will be sent'].forEach((h) => expect(table.textContent).toContain(h));
    expect(table.textContent).toContain('৳ 10,900');
    expect(table.textContent).toContain('৳ 11,200');
  });

  /** 🔴 `PRD-187.b` — a push reaches ONE listing on ONE channel, never a sibling shop. */
  it('states that sibling listings are not affected', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-push-sale_price'));
    expect(screen.getByTestId('push-erp-dialog').textContent)
      .toContain('Listings in other shops sharing this Sellable Product are not affected.');
  });

  it('requests an update when the listing already exists on the channel', async () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-push-sale_price'));
    fireEvent.click(within(screen.getByTestId('push-erp-dialog')).getByText('Push ERP Version'));
    await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
    expect(operation).toHaveBeenCalledWith('PUSH_UPDATE', ['listing-1'], 'Push Sale Price on one Listing');
  });

  /** ⚠ An unpublished listing has nothing to update — the first push CREATES it. */
  it('requests a create when the listing does not exist on the channel yet', async () => {
    renderComparison({
      rows: [DIVERGED],
      item: { ...ITEM, externalListingId: null } as ChannelListing,
    });
    fireEvent.click(screen.getByTestId('comparison-push-sale_price'));
    fireEvent.click(within(screen.getByTestId('push-erp-dialog')).getByText('Push ERP Version'));
    await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
    expect(operation).toHaveBeenCalledWith('PUBLISH_CREATE', ['listing-1'], 'Push Sale Price on one Listing');
  });

  /** 🔴 An unreadable channel side is stated as unreadable in the dialog too, never as blank. */
  it('does not invent a current channel value it never read', () => {
    renderComparison({ rows: [NOT_READABLE], mayManage: false });
    // NOT_READABLE offers no inline action, so the only honest route is the listing-level
    // push. The row itself must never open an accept dialog.
    expect(screen.queryByTestId('comparison-accept-attribute:Warranty period')).toBeNull();
    expect(screen.queryByTestId('accept-marketplace-dialog')).toBeNull();
  });

  it('pushes an unsent local edit through the same stated consequence', async () => {
    renderComparison({ rows: [UNSENT] });
    fireEvent.click(screen.getByTestId('comparison-push-listing_stock'));
    const dialog = screen.getByTestId('push-erp-dialog');
    expect(dialog.textContent).toContain('Listing stock');
    fireEvent.click(within(screen.getByTestId('push-erp-dialog')).getByText('Push ERP Version'));
    await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
    expect(operation).toHaveBeenCalledWith('PUSH_UPDATE', ['listing-1'], 'Push Listing stock on one Listing');
  });

  it('dismisses on Escape', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('accept-marketplace-dialog')).toBeNull();
  });

  it('is a labelled modal dialog', () => {
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    const dialog = screen.getByTestId('accept-marketplace-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Accept marketplace value for Sale Price?');
  });

  /** 🔴 An operation in flight cannot be un-started, so nothing pretends it was cancelled. */
  it('blocks both footer actions while the operation is running', async () => {
    const gate: { release: () => void } = { release: () => undefined };
    accept.mockImplementationOnce(() => new Promise<undefined>((resolve) => {
      gate.release = () => resolve(undefined);
    }));
    renderComparison({ rows: [DIVERGED] });
    fireEvent.click(screen.getByTestId('comparison-accept-sale_price'));
    fireEvent.click(within(screen.getByTestId('accept-marketplace-dialog')).getByText('Accept Marketplace'));

    await waitFor(() => expect(screen.getByText('Working…')).toBeTruthy());
    expect((screen.getByText('Cancel') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('accept-marketplace-dialog')).toBeTruthy();

    gate.release();
    await waitFor(() => expect(screen.queryByTestId('accept-marketplace-dialog')).toBeNull());
  });
});
