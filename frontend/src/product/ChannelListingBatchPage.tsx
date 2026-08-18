import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card, EmptyState, StatusPill, buttonStyle } from '../ui/primitives';
import { OPERATION_OUTCOME_ROLE, semanticRoleOf } from '../design/semanticRole';
import { OperationalRegion } from '../ui/OperationalRegion';
import { fetchBatch, fetchBatchMembers, retryBatch } from './channelListingApi';
import type { BatchView, OperationOutcome, OperationView } from './channelListingApi';

/**
 * FRAME 19 — Batch result and retry, per-listing outcomes.
 *
 * <p>⚠ THE FRAME IS NOT COMPLETE. Its inbound half reads real recorded batches; its OUTBOUND
 * half — a push result, a failed member, a retry that resends — cannot exist until an outbound
 * adapter and a documented Daraz write protocol do (`LSC-051`).
 *
 * <p>One operation batch and its per-listing results.
 *
 * 🔴 `INV-108.1` — A BATCH IS NOT ATOMIC ACROSS AN EXTERNAL PARTY. Partial success is the
 * NORMAL outcome, not an anomaly, and this screen is built to present it as such.
 *
 * 🔴 `INV-107.1` / `INV-107.2` — every member's outcome is shown individually. A failed
 * sibling never makes a succeeded record look failed, and nothing is collapsed into a single
 * batch verdict.
 *
 * 🔴 `INV-108.2` — the tally is DERIVED by the server from its members. No stored counter
 * exists to drift from them.
 */
export default function ChannelListingBatchPage(): React.JSX.Element {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayPublish = permissions.includes('product.channel-listing.publish');
  const maySync = permissions.includes('product.channel-listing.sync');

  const [batch, setBatch] = useState<BatchView | null>(null);
  const [members, setMembers] = useState<readonly OperationView[]>([]);
  const [outcome, setOutcome] = useState<OperationOutcome | ''>('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const size = 50;

  const load = useCallback(async () => {
    if (!batchId) return;
    try {
      const [batchResult, memberPage] = await Promise.all([
        fetchBatch(batchId),
        fetchBatchMembers(batchId, outcome, page, size),
      ]);
      setBatch(batchResult);
      setMembers(memberPage.content);
      setTotalPages(memberPage.totalPages);
      setTotalElements(memberPage.totalElements);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The batch could not be loaded.');
    }
  }, [batchId, outcome, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (): Promise<void> => {
    if (!batchId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await retryBatch(batchId);
      navigate(`/inventory/products/listings/batches/${result.batchId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The retry could not be requested.');
    } finally {
      setBusy(false);
    }
  };

  if (!batch) {
    return (
      <Card>
        <EmptyState title={error ? 'The batch could not be loaded' : 'Loading batch...'} guidance={error ?? 'Fetching the operation results.'} />
      </Card>
    );
  }

  const tiles = [
    ['requested', 'Requested', batch.requested],
    ['succeeded', 'Succeeded', batch.succeeded],
    ['failed', 'Failed', batch.failed],
    ['manual-required', 'Manual required', batch.manualRequired],
    ['diverged', 'Diverged', batch.diverged],
    ['in-flight', 'In flight', batch.inFlight],
  ] as const;

  return (
    <div data-testid="listing-batch" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      {error && <div style={noticeStyle}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: 'var(--space-5)' }}>
        {tiles.map(([key, label, value]) => (
          <div key={key} data-testid={`batch-${key}`} style={tile}>
            <div style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
            <div className="tabular-nums" style={{ fontSize: '19px', lineHeight: '24px', fontWeight: 800, color: 'var(--color-heading-ink)', marginTop: '1px' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
              {batch.operationKind}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {batch.scopeDescription ?? 'No scope description'} · requested by {batch.requestedByName ?? 'System'} at {batch.requestedAt}
            </div>
          </div>
          <select
            data-testid="batch-outcome-filter"
            aria-label="Filter members by outcome"
            value={outcome}
            onChange={(event) => {
              setPage(0);
              setOutcome(event.target.value as OperationOutcome | '');
            }}
            style={selectStyle}
          >
            {['', 'SUCCEEDED', 'FAILED', 'MANUAL_REQUIRED', 'DIVERGED', 'REQUESTED', 'IN_PROGRESS'].map((option) => (
              <option key={option} value={option}>
                {option === '' ? 'Outcome: all' : option}
              </option>
            ))}
          </select>
          {/*
            🔴 `PRD-186.d` — retry targets FAILED members only. MANUAL_REQUIRED and DIVERGED
            are deliberately excluded: a person must decide those outcomes before anything is
            sent again.
          */}
          {(mayPublish || maySync) && batch.failed > 0 && (
            <button type="button" data-testid="batch-retry-failed" disabled={busy} onClick={() => void retry()} style={buttonStyle('primary', 'row-action')}>
              Retry {batch.failed} failed
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ padding: '18px 22px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)', margin: '0 0 12px' }}>
            Per-listing results ({totalElements})
          </h2>
          {members.length === 0 ? (
            <EmptyState title="No members match this filter" guidance="Choose a different outcome to widen the result set." />
          ) : (
            <OperationalRegion>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {members.map((member) => (
                  <div key={member.id} className="operational-row" data-testid={`batch-member-${member.id}`} style={row}>
                    <div style={{ width: '130px', flexShrink: 0, ...cellText }}>{member.channelName ?? '-'}</div>
                    <div style={{ width: '140px', flexShrink: 0, ...cellText, fontFamily: 'var(--font-family-mono)' }}>
                      {member.externalListingId ?? 'Not published'}
                    </div>
                    <div style={{ flex: '1 1 0', minWidth: 0, ...cellText }}>{member.listingTitle ?? 'Untitled listing'}</div>
                    {/* 🔴 `RULE 3.14.a.b` — neutral carrier with a MANDATORY label. */}
                    {/* 🔴 `RULE 3.3.d.a` — the outcome is a real system state and takes its
                        canonical role: SUCCEEDED settles, FAILED is a failure, MANUAL_REQUIRED
                        and DIVERGED owe a person a decision (`SYS-025`, `SYS-026`). */}
                    <span data-testid={`member-outcome-${member.id}`}>
                      <StatusPill tone={semanticRoleOf(OPERATION_OUTCOME_ROLE, member.outcome)} dot>
                        {member.outcome}
                      </StatusPill>
                    </span>
                    {/*
                      🔴 `PRJ-200` — the reason is the operator's, in their language. It is
                      never a generic failure string, and it is never truncated away.
                    */}
                    <div style={{ flex: '1 1 0', minWidth: 0, ...cellText, color: 'var(--color-text-secondary)' }} title={member.detail ?? ''}>
                      {member.detail ?? '-'}
                    </div>
                    <Link
                      to={`/inventory/products/listings/${member.channelListingId}`}
                      style={{ ...buttonStyle('secondary', 'row-action'), padding: '0 12px', textDecoration: 'none', flexShrink: 0 }}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </OperationalRegion>
          )}

          {members.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {page * size + 1}-{Math.min((page + 1) * size, totalElements)} of {totalElements}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" data-testid="batch-page-prev" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={pageButton}>
                  ‹
                </button>
                <button type="button" data-testid="batch-page-next" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={pageButton}>
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div>
        <Link to="/inventory/products/listings" style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}>
          Back to Listings
        </Link>
      </div>
    </div>
  );
}

const tile: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--elevation-card)', padding: '12px 14px', minWidth: 0 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap', width: '100%', minWidth: 0, padding: '8px 4px' };
const cellText: React.CSSProperties = { fontSize: '12.5px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const selectStyle: React.CSSProperties = { height: 'var(--control-height-row-action)', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-control)', padding: '0 8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)', flexShrink: 0 };
const pageButton: React.CSSProperties = { width: '32px', height: '32px', borderRadius: '9px', border: '1px solid var(--color-border-control)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontFamily: 'inherit', cursor: 'pointer' };
const noticeStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--color-text-primary)', background: 'var(--color-status-neutral-bg)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', padding: '10px 14px' };
