import { useState } from 'react';
import { Link } from 'react-router-dom';
import { refreshListing, type RefreshResult, type RefreshState } from './channelListingApi';

/**
 * FRAME 16 — Refresh states, `PRD-189.c` / `PRD-181`.
 *
 * <p>🔴 REFRESH READS THE MARKETPLACE AND NEVER WRITES TO IT. It updates the REPORTED side of
 * one Listing and nothing else: intended values, unsent changes, mappings and publication
 * intent are never altered by it (`PRD-181.a`, `PRD-185.c`).
 *
 * <p>🔴 INLINE, AND THE ROW STAYS IN PLACE. This is operation feedback attached to the Listing
 * it concerns — not a page, not a modal, not a drawer. Frame 20 owns Sync Now; this owns the
 * lifecycle of refreshing exactly ONE Listing on its own channel and shop.
 *
 * <p>🔴 A SUCCESSFUL READ IS NOT AGREEMENT (`§13`). "The channel could be read" and "Trioloo
 * and the channel agree" are different facts, and a refresh that succeeds may well discover
 * divergence. Nothing here labels a successful read `SYNCED`.
 *
 * <p>⚠ `UX-272` DOES NOT APPLY HERE. That rule keeps the OUTBOUND REVIEW reachable when
 * execution is not. Refresh IS the remote operation, so when it cannot be performed the action
 * itself is unavailable — with its reason stated, never hidden behind a hover.
 */
export function useListingRefresh(): {
  readonly state: RefreshState;
  readonly result: RefreshResult | null;
  readonly error: string | null;
  readonly refreshingId: string | null;
  /**
   * 🔴 The Listing this state BELONGS TO, held until dismissed.
   *
   * ⚠ Distinct from {@link refreshingId}, which is only set while the read runs. A REFUSED or
   * FAILED refresh has no result to read a Listing id from, and without this the failure
   * would have no row to appear beside — the operator would see nothing at all.
   */
  readonly targetId: string | null;
  readonly run: (listingId: string) => Promise<void>;
  readonly dismiss: () => void;
} {
  const [state, setState] = useState<RefreshState>('IDLE');
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const run = async (listingId: string): Promise<void> => {
    /*
      🔴 ONE AT A TIME, PER LISTING. Repeated clicks must not become two concurrent reads of
      the same Listing, whose results would land in an order nobody chose. The server refuses
      a duplicate as well; this simply means the operator never generates one.
    */
    if (refreshingId === listingId) {
      return;
    }
    setRefreshingId(listingId);
    setTargetId(listingId);
    setState('REFRESHING');
    setResult(null);
    setError(null);
    try {
      const outcome = await refreshListing(listingId);
      setResult(outcome);
      setState(outcome.state);
    } catch (cause) {
      /*
        🔴 AN OPERATION FAILURE IS ITS OWN CONCERN. It is never translated into DIVERGED,
        NOT READABLE or a lifecycle change, and it never wipes the reported facts the ERP
        already holds — those keep their earlier read.
      */
      setError(cause instanceof Error ? cause.message : 'The refresh could not be completed.');
      setState('FAILED');
    } finally {
      setRefreshingId(null);
    }
  };

  const dismiss = (): void => {
    setState('IDLE');
    setResult(null);
    setError(null);
    setTargetId(null);
  };

  return { state, result, error, refreshingId, targetId, run, dismiss };
}

/**
 * The inline state itself.
 *
 * <p>🔴 `RULE 8.4` — monochrome and restrained. No success card, no semantic rainbow, no
 * progress bar: a percentage would be invented, because a remote read reports no progress.
 */
export function ListingRefreshState({
  state,
  result,
  error,
  listingTitle,
  channelName,
  onDismiss,
  onRetry,
}: {
  readonly state: RefreshState;
  readonly result: RefreshResult | null;
  readonly error: string | null;
  readonly listingTitle: string;
  readonly channelName: string | null;
  readonly onDismiss: () => void;
  readonly onRetry?: () => void;
}): React.JSX.Element | null {
  if (state === 'IDLE') {
    return null;
  }

  return (
    <div
      data-testid="refresh-state"
      data-refresh-state={state}
      /*
        🔴 `A11Y` — a polite live region so the outcome is ANNOUNCED once, when it settles.
        ⚠ `aria-atomic` keeps it one sentence rather than a field-by-field reading.
      */
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={panel}
    >
      {state === 'REFRESHING' ? (
        <Refreshing listingTitle={listingTitle} channelName={channelName} />
      ) : (
        <Settled
          state={state}
          result={result}
          error={error}
          onDismiss={onDismiss}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

/**
 * 🔴 NO FAKE PROGRESS. A remote read reports no percentage, so none is drawn; the indicator
 * states that a read is running and nothing more.
 */
function Refreshing({
  listingTitle,
  channelName,
}: {
  readonly listingTitle: string;
  readonly channelName: string | null;
}): React.JSX.Element {
  return (
    <div style={line} data-testid="refresh-refreshing">
      <Spinner />
      <span style={{ minWidth: 0 }}>
        <strong style={strong}>{listingTitle}</strong>
        {/* 🔴 `UX-271.a` — the channel is named from the record, never hardcoded. */}
        <span style={muted}> · Reading from {channelName ?? 'the channel'}…</span>
      </span>
    </div>
  );
}

function Settled({
  state,
  result,
  error,
  onDismiss,
  onRetry,
}: {
  readonly state: RefreshState;
  readonly result: RefreshResult | null;
  readonly error: string | null;
  readonly onDismiss: () => void;
  readonly onRetry?: () => void;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
      <div style={{ ...line, justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
          <strong style={strong} data-testid="refresh-headline">
            {headline(state)}
          </strong>
          {/*
            🔴 `UX-038` / `§38` — the carriers stay SEPARATE. A refresh may complete while the
            Listing is unmapped and diverged and carries unsent changes; one merged "Status"
            badge could only ever name one of them.
          */}
          {result && result.divergedFieldCount > 0 && (
            <span style={strongChip} data-testid="refresh-diverged">
              DIVERGED · {result.divergedFieldCount}
            </span>
          )}
          {result?.unsentLocalChanges && (
            <span style={quietChip} data-testid="refresh-unsent">
              UNSENT LOCAL CHANGES
            </span>
          )}
          {result && result.manualRequiredDomains.length > 0 && (
            <span style={quietChip} data-testid="refresh-manual">
              MANUAL REQUIRED · {result.manualRequiredDomains.length}
            </span>
          )}
        </span>
        <span style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
          {state === 'FAILED' && onRetry && (
            <button type="button" style={action} onClick={onRetry} data-testid="refresh-retry">
              Retry refresh
            </button>
          )}
          <button type="button" style={action} onClick={onDismiss} data-testid="refresh-dismiss">
            Dismiss
          </button>
        </span>
      </div>

      <p style={detail} data-testid="refresh-detail">
        {detailText(state, result, error)}
      </p>

      {result && result.changedDomains.length > 0 && (
        /* ⚠ Named in BUSINESS terms, because that is what the operator will go and look at. */
        <p style={detail} data-testid="refresh-changed">
          Changed: {result.changedDomains.join(' · ')}
        </p>
      )}

      {result && result.manualRequiredDomains.length > 0 && (
        /*
          🔴 `SYS-025` / `PRD-183.d` — MANUAL_REQUIRED is a NORMAL outcome, not a failure and
          not agreement. It is reported beside the read, never folded into it.
        */
        <p style={detail} data-testid="refresh-manual-domains">
          Needs a person: {result.manualRequiredDomains.join(' · ')}
        </p>
      )}

      {result && result.divergedFieldCount > 0 && (
        /*
          🔴 `PRD-183.c` — refresh is NOT resolution. Adopting the marketplace value is an
          explicit, separate act on the comparison surface, and sending ERP intent is a
          separate act again. Neither happens automatically here.
        */
        <p style={detail} data-testid="refresh-not-resolution">
          The ERP values were not modified by this refresh.{' '}
          <Link to={`/inventory/products/listings/${result.listingId}#comparison`} style={link}>
            Open comparison
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * 🔴 `§13` — "the channel could be read" and "Trioloo and the channel agree" are different
 * facts. Nothing below announces `SYNCED` on the strength of a successful read.
 */
function headline(state: RefreshState): string {
  switch (state) {
    case 'COMPLETED_NO_CHANGE':
      return 'Refresh complete';
    case 'COMPLETED_CHANGED':
      return 'Refresh complete — marketplace changes found';
    case 'MANUAL_REQUIRED':
      return 'Refresh needs a person';
    case 'FAILED':
      return 'Refresh failed';
    default:
      return 'Refreshing';
  }
}

function detailText(
  state: RefreshState,
  result: RefreshResult | null,
  error: string | null,
): string {
  if (state === 'FAILED') {
    /*
      🔴 `§31` — THE LAST GOOD REPORTED STATE SURVIVES. A failed fetch must never turn known
      values into blanks, and the operator is told so explicitly: this is an operation
      failure, not a discovery about the marketplace.
    */
    return `${error ?? result?.detail ?? 'The channel could not be read.'} `
      + 'The values the ERP already held are unchanged and still carry their earlier read.';
  }
  if (state === 'COMPLETED_NO_CHANGE') {
    return 'The channel was read. No readable marketplace values had changed since the '
      + 'previous read, and nothing on the ERP side was modified.';
  }
  if (state === 'COMPLETED_CHANGED') {
    return 'The channel was read and the reported side was updated. ERP intent, mappings and '
      + 'unsent changes were not touched.';
  }
  return result?.detail
    ?? 'The channel accepted the read but the outcome is not readable, so a person must look.';
}

/** ⚠ A quiet, indeterminate indicator — `RULE 15.3` forbids transform-scaled text, not this. */
function Spinner(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-testid="refresh-spinner"
      style={{
        width: '11px',
        height: '11px',
        flexShrink: 0,
        borderRadius: '50%',
        border: '1.5px solid var(--color-divider-vertical)',
        borderTopColor: 'var(--color-heading-ink)',
        animation: 'refresh-spin 700ms linear infinite',
      }}
    />
  );
}

// =====================================================================================
// Style
// =====================================================================================

/** 🔴 `RULE 3.6.c` / `RULE 3.6.d` — the ordinary neutral container. No state frame. */
const panel: React.CSSProperties = {
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  padding: '9px 11px',
  marginTop: '10px',
};

const line: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: 0,
  fontSize: '12px',
};

const strong: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--color-heading-ink)',
};

const muted: React.CSSProperties = { color: 'var(--color-text-secondary)' };

const detail: React.CSSProperties = {
  margin: 0,
  fontSize: '11.5px',
  lineHeight: 1.6,
  color: 'var(--color-text-secondary)',
};

const link: React.CSSProperties = {
  color: 'var(--color-heading-ink)',
  fontWeight: 600,
  textUnderlineOffset: '2px',
};

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '18px',
  padding: '0 6px',
  borderRadius: 'var(--radius-control-small)',
  fontSize: '9.5px',
  fontWeight: 700,
  letterSpacing: '.05em',
  whiteSpace: 'nowrap',
};

const quietChip: React.CSSProperties = {
  ...chipBase,
  border: '1px solid var(--color-divider-inner)',
  color: 'var(--color-text-secondary)',
};

/** ⚠ A strong TYPE, not a strong container — `UX-269` keeps the panel border neutral. */
const strongChip: React.CSSProperties = {
  ...chipBase,
  border: '1.5px solid var(--color-ink)',
  color: 'var(--color-heading-ink)',
  fontWeight: 800,
};

const action: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '26px',
  padding: '0 9px',
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control-small)',
  background: 'var(--color-surface)',
  fontSize: '11.5px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--color-secondary-text)',
  cursor: 'pointer',
};
