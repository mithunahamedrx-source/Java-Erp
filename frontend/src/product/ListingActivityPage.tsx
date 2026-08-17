import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState, RefusalState, SegmentedControl, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';
import { formatShortMoment } from '../platform/datetime';
import { fetchActivity, fetchChannelListing, fetchListingOperations } from './channelListingApi';
import type { ActivityKind, ActivityView, ChannelListing, OperationView } from './channelListingApi';

/**
 * FRAME 21 — Activity and operation history.
 *
 * <p>🔴 THREE KINDS SHARE ONE CHRONOLOGY, AND THE TYPE COLUMN IS WHAT SEPARATES THEM. The
 * approved frame states this in its own footnote and adds the constraint that matters:
 * separated by the type column ⚠ RATHER THAN BY COLOUR OR ICONOGRAPHY. So no row here
 * carries a {@code StatusPill}, a tone or a glyph — Type and Outcome are plain tracked text
 * in one neutral ink. That is deliberately UNLIKE the rest of Listings, where a state does
 * take a semantic role, and it is the design's call, not an oversight.
 *
 * <p>🔴 FIELD CHANGES ARE LOCAL EDITS, CHANNEL EVENTS ORIGINATE AT THE MARKETPLACE, AND
 * OPERATIONS ARE TRIOLOO ACTIONS carrying their batch or operation reference. Reading them
 * on one timeline is the point: an operator asking "why does this listing look like this?"
 * needs the local edit and the channel's own change side by side.
 *
 * <p>🔴 THIS SURFACE READS. It contacts no marketplace, starts no pull and publishes nothing;
 * every row is a record Trioloo already holds ({@code LSC-050}).
 */

/** Frame 21's row geometry — Time · Type · What happened · Source · Actor · Outcome. */
const ACTIVITY_GRID = '112px 128px minmax(0, 1fr) 150px 150px 120px';

/** Nine, as the frame's own "1–9 of 64 entries" states. */
const PAGE_SIZE = 9;

const FILTERS: readonly { readonly value: string; readonly label: string }[] = [
  { value: '', label: 'All' },
  { value: 'FIELD_CHANGE', label: 'Field changes' },
  { value: 'CHANNEL_EVENT', label: 'Channel events' },
  { value: 'OPERATION', label: 'Operations' },
];

const TYPE_LABEL: Record<ActivityKind, string> = {
  FIELD_CHANGE: 'FIELD CHANGE',
  CHANNEL_EVENT: 'CHANNEL EVENT',
  OPERATION: 'OPERATION',
};

export default function ListingActivityPage(): React.JSX.Element {
  const { id } = useParams();

  const [listing, setListing] = useState<ChannelListing | null>(null);
  const [entries, setEntries] = useState<readonly ActivityView[]>([]);
  const [operations, setOperations] = useState<readonly OperationView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [item, activityPage, operationRows] = await Promise.all([
        fetchChannelListing(id),
        fetchActivity(id, kind as ActivityKind | '', page, PAGE_SIZE),
        fetchListingOperations(id),
      ]);
      setListing(item);
      setEntries(activityPage.content);
      setTotal(activityPage.totalElements);
      setTotalPages(activityPage.totalPages);
      setOperations(operationRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This activity history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id, kind, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * The Outcome cell, and 🔴 it is DERIVED OR ABSENT — never guessed.
   *
   * <p>✅ A FIELD CHANGE is local by definition ({@code PRD-185.b}): a saved intended value is
   * authoritative ERP intent the moment it is written, and it has reached no channel. That is
   * a fact about the record's kind, not an inference.
   *
   * <p>✅ An OPERATION carries {@code operationId}, so its real outcome is read from the
   * operation record itself ({@code E-107}).
   *
   * <p>🔴 A CHANNEL EVENT HAS NO STORED OUTCOME, and none is invented. The frame prints
   * "DIVERGED" and "Resolved" for such rows; no persisted field carries them, so this renders
   * the unavailable marker rather than fabricating a marketplace verdict ({@code LSC-034}).
   */
  const outcomeOf = (entry: ActivityView): string | null => {
    if (entry.entryKind === 'FIELD_CHANGE') {
      return 'Local';
    }
    if (entry.entryKind === 'OPERATION' && entry.operationId) {
      return operations.find((operation) => operation.id === entry.operationId)?.outcome ?? null;
    }
    return null;
  };

  /** The before → after pair the frame shows inline on a field change. */
  const describe = (entry: ActivityView): string => {
    if (entry.entryKind === 'FIELD_CHANGE' && entry.beforeValue !== null && entry.afterValue !== null) {
      return `${entry.summary} · ${entry.beforeValue} → ${entry.afterValue}`;
    }
    return entry.summary;
  };

  if (!id) {
    return (
      <Card>
        <RefusalState reason="No Listing was named, so there is no history to show." />
      </Card>
    );
  }

  if (loading && listing === null) {
    return (
      <Card>
        <EmptyState title="Loading activity..." guidance="Reading this Listing's recorded history." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <RefusalState reason={error} />
      </Card>
    );
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE + entries.length);

  return (
    <div data-testid="listing-activity" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      {/* ---------------------------------------------------------------- header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-5)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-heading-ink)', margin: 0, letterSpacing: '-0.01em' }}>
            Activity
          </h2>
          <p
            data-testid="activity-subject"
            style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {[
              listing?.intendedTitle ?? 'Untitled listing',
              listing?.channelInstance,
              listing?.externalListingId,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Link
          data-testid="activity-back"
          to={`/inventory/products/listings/${id}`}
          style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none', flexShrink: 0 }}
        >
          Back to Listing
        </Link>
      </div>

      {/* ------------------------------------------------------- the four filters */}
      <div data-testid="activity-filters">
        <SegmentedControl
          options={FILTERS}
          value={kind}
          onChange={(next) => {
            setKind(next);
            /* ⚠ A narrowed history starts at its own beginning; keeping the old offset would
               land the operator on an empty page of a shorter list. */
            setPage(0);
          }}
        />
      </div>

      {/* ------------------------------------------------------------ the chronology */}
      <Card>
        <div style={{ padding: '18px 22px' }}>
          <div
            data-testid="activity-header-row"
            style={{
              display: 'grid',
              gridTemplateColumns: ACTIVITY_GRID,
              gap: '14px',
              padding: '0 4px 9px',
              borderBottom: '1px solid var(--color-border-card)',
            }}
          >
            {['Time', 'Type', 'What happened', 'Source', 'Actor', 'Outcome'].map((label) => (
              <div key={label} style={columnLabel}>{label}</div>
            ))}
          </div>

          {entries.length === 0 ? (
            <div style={{ paddingTop: '10px' }}>
              <EmptyState
                title={kind === '' ? 'Nothing has happened to this listing yet' : 'No entries of this kind'}
                guidance={
                  kind === ''
                    ? 'Local edits, marketplace events and Trioloo operations will appear here as they occur.'
                    : 'Choose All to see this listing’s full chronology.'
                }
              />
            </div>
          ) : (
            <OperationalRegion>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {entries.map((entry) => {
                  const outcome = outcomeOf(entry);
                  return (
                    <div
                      key={entry.id}
                      className="operational-row"
                      data-testid={`activity-row-${entry.id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: ACTIVITY_GRID,
                        gap: '14px',
                        alignItems: 'center',
                        padding: '9px 4px',
                      }}
                    >
                      <div style={{ ...cellText, color: 'var(--color-text-demoted)' }}>
                        {formatShortMoment(entry.occurredAt) ?? '—'}
                      </div>
                      {/* 🔴 Plain tracked text. The frame forbids colour and iconography here. */}
                      <div data-testid={`activity-type-${entry.id}`} style={typeCell}>
                        {TYPE_LABEL[entry.entryKind]}
                      </div>
                      <div style={{ ...cellText, color: 'var(--color-text-primary)' }} title={describe(entry)}>
                        {describe(entry)}
                      </div>
                      <div style={{ ...cellText, color: 'var(--color-text-secondary)' }}>
                        {entry.source ?? '—'}
                      </div>
                      {/* ⚠ A null actor is CORRECT for a channel event: the marketplace acted. */}
                      <div style={{ ...cellText, color: 'var(--color-text-secondary)' }}>
                        {entry.actorName ?? 'Marketplace'}
                      </div>
                      <div data-testid={`activity-outcome-${entry.id}`} style={outcomeCell}>
                        {outcome ?? '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </OperationalRegion>
          )}

          {/* ------------------------------------------------------------ paging */}
          <div
            data-testid="activity-paging"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-4)',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-divider-light)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', fontVariantNumeric: 'tabular-nums' }}>
              {total === 0 ? 'No entries' : `${from}–${to} of ${total} entries`}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                data-testid="activity-prev"
                disabled={page === 0 || loading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                style={buttonStyle('secondary', 'row-action')}
              >
                Prev
              </button>
              <button
                type="button"
                data-testid="activity-next"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                style={buttonStyle('secondary', 'row-action')}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------- the frame's footnote */}
      <p data-testid="activity-footnote" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', lineHeight: 1.65, margin: 0, maxWidth: '92ch' }}>
        Three kinds share one chronology, separated by the type column rather than by colour or
        iconography. Field changes are local edits, channel events originate at the marketplace,
        operations are Trioloo actions and carry their batch or operation reference.
      </p>
    </div>
  );
}

const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
  minWidth: 0,
};

const cellText: React.CSSProperties = {
  fontSize: '12.5px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
};

/** 🔴 Type: tracked uppercase in ordinary ink — no tone, no pill, no glyph. */
const typeCell: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '.05em',
  color: 'var(--color-text-secondary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
};

const outcomeCell: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.05em',
  color: 'var(--color-text-secondary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
};
