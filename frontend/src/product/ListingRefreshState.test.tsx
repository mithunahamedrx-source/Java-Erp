import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListingRefreshState, useListingRefresh } from './ListingRefreshState';
import type { RefreshResult } from './channelListingApi';

/**
 * FRAME 16 — Refresh states.
 *
 * <p>🔴 THE CLAIM UNDER TEST is that REFRESH READS THE MARKETPLACE AND NEVER WRITES TO IT, and
 * that its outcome never overstates itself: a successful read is not agreement, a failure is
 * not divergence, and neither ever clears the unsent condition.
 *
 * <p>🔴 The second claim is that the state dimensions stay APART (`§38`) — refresh status,
 * mapping, comparison, readability and UNSENT can all be true at once.
 */

const fetchMock = vi.fn();

const RESULT: RefreshResult = {
  listingId: 'L-1',
  operationId: 'op-1',
  listingTitle: 'Hi-Power 22 Inch IPS Monitor',
  channelName: 'Daraz account A',
  outcome: 'SUCCEEDED',
  state: 'COMPLETED_NO_CHANGE',
  detail: 'Channel values re-read.',
  startedAt: '2026-08-15T10:44:00Z',
  completedAt: '2026-08-15T10:44:02Z',
  changedDomains: [],
  manualRequiredDomains: [],
  notReadableFieldCount: 0,
  divergedFieldCount: 0,
  unsentLocalChanges: false,
  syncState: 'SYNCED',
};

function stub(result: Partial<RefreshResult> | { reject: string }): void {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (String(url).includes('/api/auth/csrf')) {
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    if ('reject' in result) {
      return Promise.resolve(new Response(JSON.stringify({ message: result.reject }), {
        status: 422, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ...RESULT, ...result }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  });
  vi.stubGlobal('fetch', fetchMock);
}

/** Every refresh POST the surface issued, so "one dispatch" is measured rather than assumed. */
function refreshPosts(): number {
  return fetchMock.mock.calls.filter(
    (c) => String(c[0]).includes('/refresh')
      && String((c[1] as RequestInit | undefined)?.method) === 'POST',
  ).length;
}

/**
 * Holds the refresh POST open so the REFRESHING state can be observed.
 *
 * ⚠ The CSRF handshake is answered IMMEDIATELY. Hanging it too would stall the client before
 * the POST was ever issued, and the test would then measure a request that never happened.
 */
function hangingRefresh(): () => void {
  let release: (r: Response) => void = () => {};
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (String(url).includes('/api/auth/csrf')) {
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return new Promise<Response>((r) => { release = r; });
  });
  vi.stubGlobal('fetch', fetchMock);
  return () => release(new Response(JSON.stringify(RESULT), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
}

/** A minimal host that exercises the real hook against the real component. */
function Host({ onRun }: { readonly onRun?: (run: (id: string) => Promise<void>) => void }): React.JSX.Element {
  const refresh = useListingRefresh();
  onRun?.(refresh.run);
  return (
    <MemoryRouter>
      <button type="button" data-testid="run" onClick={() => void refresh.run('L-1')}>
        Refresh
      </button>
      <span data-testid="target">{refresh.targetId ?? 'none'}</span>
      <ListingRefreshState
        state={refresh.state}
        result={refresh.result}
        error={refresh.error}
        listingTitle="Hi-Power 22 Inch IPS Monitor"
        channelName="Daraz account A"
        onDismiss={refresh.dismiss}
        onRetry={() => void refresh.run('L-1')}
      />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Frame 16 — Refresh states', () => {
  /** 🔴 §12.A — nothing is shown until a read is asked for. */
  it('shows nothing while idle', () => {
    stub({});
    render(<Host />);
    expect(screen.queryByTestId('refresh-state')).toBeNull();
  });

  // ===================================================================================
  // §25 · §60 — refreshing
  // ===================================================================================

  /**
   * 🔴 §25 — a compact inline state naming the Listing and its channel. ⚠ NO FAKE PROGRESS:
   * a remote read reports no percentage, so none is drawn.
   */
  it('shows a compact refreshing state with no invented progress', async () => {
    const resolve = hangingRefresh();

    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await screen.findByTestId('refresh-refreshing');
    const region = screen.getByTestId('refresh-state');
    expect(region.getAttribute('data-refresh-state')).toBe('REFRESHING');
    expect(region.textContent).toContain('Hi-Power 22 Inch IPS Monitor');
    expect(region.textContent).toContain('Reading from Daraz account A');
    // 🔴 No percentage, no bar, no fabricated estimate.
    expect(region.textContent).not.toMatch(/\d+\s*%/);
    expect(screen.getByTestId('refresh-spinner')).toBeTruthy();

    await act(async () => resolve());
  });

  /**
   * 🔴 §26 / §60 — repeated clicks on the SAME Listing must not become two concurrent reads,
   * whose results would land in an order nobody chose.
   */
  it('refuses a duplicate dispatch for the same Listing while one is running', async () => {
    const resolve = hangingRefresh();

    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));
    await screen.findByTestId('refresh-refreshing');
    fireEvent.click(screen.getByTestId('run'));
    fireEvent.click(screen.getByTestId('run'));

    expect(refreshPosts()).toBe(1);
    await act(async () => resolve());
  });

  // ===================================================================================
  // §27 · §28 · §29 — what a successful read says
  // ===================================================================================

  /** 🔴 §27 / §13 — "the channel was read" is reported; agreement is NOT claimed. */
  it('reports a no-change completion without claiming ALIGNED or SYNCED', async () => {
    stub({ state: 'COMPLETED_NO_CHANGE' });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-headline').textContent).toBe('Refresh complete'));
    const region = screen.getByTestId('refresh-state');
    expect(screen.getByTestId('refresh-detail').textContent).toContain('No readable marketplace values had changed');
    // 🔴 §13 — a successful read is not agreement, and never announces itself as one.
    expect(region.textContent).not.toContain('ALIGNED');
    expect(region.textContent).not.toContain('SYNCED');
    expect(screen.queryByTestId('refresh-diverged')).toBeNull();
  });

  /**
   * 🔴 §28 / §15 / §16 — changes are REPORTED, never resolved. Neither Accept Marketplace nor
   * Push happens automatically, and the ERP values are stated as untouched.
   */
  it('reports found changes and resolves nothing', async () => {
    stub({
      state: 'COMPLETED_CHANGED',
      changedDomains: ['Sale Price'],
      divergedFieldCount: 1,
    });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-changed')).toBeTruthy());
    expect(screen.getByTestId('refresh-headline').textContent).toContain('marketplace changes found');
    expect(screen.getByTestId('refresh-changed').textContent).toContain('Sale Price');
    expect(screen.getByTestId('refresh-diverged').textContent).toContain('DIVERGED · 1');
    expect(screen.getByTestId('refresh-not-resolution').textContent)
      .toContain('The ERP values were not modified by this refresh');
    // 🔴 Resolution belongs to Frame 08 and sending belongs to Frame 15. Neither is here.
    expect(screen.queryByText('Accept marketplace')).toBeNull();
    expect(screen.queryByText('Push')).toBeNull();
    expect(screen.getByText('Open comparison')).toBeTruthy();
  });

  /**
   * 🔴 §17 / §29 — REFRESH NEVER CLEARS UNSENT. Discovering that the channel happens to match
   * is not proof that Trioloo's outbound operation completed.
   */
  it('keeps UNSENT visible even when the read finds no difference', async () => {
    stub({ state: 'COMPLETED_NO_CHANGE', divergedFieldCount: 0, unsentLocalChanges: true });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-unsent')).toBeTruthy());
    expect(screen.getByTestId('refresh-unsent').textContent).toContain('UNSENT LOCAL CHANGES');
  });

  // ===================================================================================
  // §30 · §31 — failure
  // ===================================================================================

  /**
   * 🔴 §30 / §31 — THE CENTRAL FAILURE CLAIM. An operation failure is its own concern: it is
   * not divergence, not unreadability, and it explicitly does NOT wipe what the ERP knew.
   */
  it('states a failure as an operation problem and preserves the last good reported state', async () => {
    stub({ reject: 'The channel did not respond in time.' });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-headline').textContent).toBe('Refresh failed'));
    const detail = screen.getByTestId('refresh-detail').textContent ?? '';
    expect(detail).toContain('did not respond in time');
    expect(detail).toContain('unchanged and still carry their earlier read');
    // 🔴 A failed fetch is not a discovery about the marketplace.
    expect(screen.queryByTestId('refresh-diverged')).toBeNull();
    expect(screen.getByTestId('refresh-state').textContent).not.toContain('NOT READABLE');
    expect(screen.getByTestId('refresh-retry')).toBeTruthy();
  });

  /** ⚠ §31 — a FAILED state still belongs to its Listing, so it has a row to appear beside. */
  it('keeps the failed state attached to the Listing it concerns', async () => {
    stub({ reject: 'Nope.' });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-headline').textContent).toBe('Refresh failed'));
    expect(screen.getByTestId('target').textContent).toBe('L-1');
  });

  // ===================================================================================
  // §22 · §38 — partial readability and separate dimensions
  // ===================================================================================

  /**
   * 🔴 §22 — a domain that could not be read does NOT make the whole refresh a failure. ⚠
   * `SYS-025` — MANUAL_REQUIRED is a normal outcome, reported beside the read.
   */
  it('reports manual-required domains without calling the refresh failed', async () => {
    stub({
      state: 'COMPLETED_CHANGED',
      changedDomains: ['Sale Price'],
      manualRequiredDomains: ['Media order'],
      notReadableFieldCount: 2,
    });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-manual-domains')).toBeTruthy());
    expect(screen.getByTestId('refresh-manual-domains').textContent).toContain('Media order');
    expect(screen.getByTestId('refresh-manual').textContent).toContain('MANUAL REQUIRED · 1');
    expect(screen.getByTestId('refresh-headline').textContent).not.toContain('failed');
  });

  /**
   * 🔴 §38 / `UX-038` — the dimensions stay APART. A completed refresh, unsent local changes,
   * divergence and a manual domain may ALL be true, and one merged badge could name only one.
   */
  it('carries refresh status, DIVERGED, UNSENT and MANUAL as separate carriers', async () => {
    stub({
      state: 'COMPLETED_CHANGED',
      changedDomains: ['Sale Price'],
      manualRequiredDomains: ['Media order'],
      divergedFieldCount: 2,
      unsentLocalChanges: true,
    });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-diverged')).toBeTruthy());
    expect(screen.getByTestId('refresh-headline').textContent).toContain('Refresh complete');
    expect(screen.getByTestId('refresh-diverged').textContent).toContain('DIVERGED · 2');
    expect(screen.getByTestId('refresh-unsent').textContent).toContain('UNSENT');
    expect(screen.getByTestId('refresh-manual').textContent).toContain('MANUAL REQUIRED');
  });

  // ===================================================================================
  // §45 · §72 — not an editor, and reachable
  // ===================================================================================

  /** 🔴 §45 — Frame 16 is not an editor. Nothing here becomes editable. */
  it('exposes no editable control', async () => {
    stub({ state: 'COMPLETED_CHANGED', changedDomains: ['Sale Price'], divergedFieldCount: 1 });
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-state')).toBeTruthy());
    const region = screen.getByTestId('refresh-state');
    expect(region.querySelectorAll('input, textarea, select')).toHaveLength(0);
  });

  /** 🔴 §72 — the outcome is announced once, politely, as a single statement. */
  it('announces the outcome through a polite live region', async () => {
    stub({});
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-state')).toBeTruthy());
    const region = screen.getByTestId('refresh-state');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });

  /** ⚠ §37 — the result persists until dismissed; it never vanishes before it can be read. */
  it('holds the result until the operator dismisses it', async () => {
    stub({});
    render(<Host />);
    fireEvent.click(screen.getByTestId('run'));

    await waitFor(() => expect(screen.getByTestId('refresh-state')).toBeTruthy());
    fireEvent.click(screen.getByTestId('refresh-dismiss'));
    expect(screen.queryByTestId('refresh-state')).toBeNull();
    expect(screen.getByTestId('target').textContent).toBe('none');
  });
});
