import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../shell/AppShell';
import { Card, EmptyState, Notice, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';
import {
  discoverChannel,
  fetchBatch,
  fetchBatchMembers,
  fetchChannels,
} from './channelListingApi';
import type {
  BatchView,
  ChannelView,
  DiscoveryOutcome,
  OperationView,
} from './channelListingApi';

/**
 * FRAME 20 — Sync Now, and the shared operation result.
 *
 * <p>🔴 `PRD-189.b` — MANUAL SYNC IS CHANNEL-SCOPED AND READS ONE CHANNEL INSTANCE. The frame
 * states it in words — *"One channel per manual sync"* — and the control enforces it: the
 * selection is a radio group, never a multi-select.
 *
 * <p>🔴 `PRD-189.e` / `PRD-185` — SYNC NEVER PUSHES. It reads the marketplace and writes the
 * REPORTED side only (`PRD-181.a`). No outbound act is reachable from this surface.
 *
 * <p>🔴 `PRD-177` — ABSENCE IS NOT DELETION. A listing a run did not return is left exactly as
 * it was, and an INCOMPLETE run says so plainly rather than presenting a partial catalogue as
 * the whole one (`API-066.b`).
 *
 * <p>⚠ `LSC-034` — WHAT THE BACKEND DOES NOT TRACK IS RENDERED UNAVAILABLE, NEVER INVENTED.
 * The pack draws four result figures a discovery run does not record; each states that rather
 * than showing a fabricated number (see `unavailableTiles`).
 */
export default function ChannelListingSyncPage(): React.JSX.Element {
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const maySync = permissions.includes('product.channel-listing.sync');

  const [channels, setChannels] = useState<readonly ChannelView[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DiscoveryOutcome | null>(null);
  const [ranAgainst, setRanAgainst] = useState<ChannelView | null>(null);
  const [batch, setBatch] = useState<BatchView | null>(null);
  const [members, setMembers] = useState<readonly OperationView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels()
      .then(setChannels)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Channels could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  /**
   * 🔴 ONE CHANNEL, ONE RUN, ONE REQUEST. The button is disabled while a run is in flight, so
   * a second click cannot start a second read of the same seller's catalogue.
   */
  const start = async (): Promise<void> => {
    const channel = channels.find((c) => c.id === chosen);
    if (!channel || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await discoverChannel(channel.id);
      setOutcome(result);
      setRanAgainst(channel);
      /*
        ⚠ THE RESULT IS READ BACK FROM THE SERVER, not assembled from the request. The batch
        tallies are DERIVED from its members at read time (`INV-108.2`), so the screen shows
        what was actually recorded rather than what the caller hoped for.
      */
      const [recorded, page] = await Promise.all([
        fetchBatch(result.batchId),
        /* ⚠ No outcome filter — every member the run recorded, not a selected subset. */
        fetchBatchMembers(result.batchId, '', 0, 200),
      ]);
      setBatch(recorded);
      setMembers(page.content);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Discovery could not be run.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Sync now" subtitle="Products · Listings" />
        <Card>
          <EmptyState title="Loading channels…" guidance="Fetching registered Channel Instances." />
        </Card>
      </>
    );
  }

  if (channels.length === 0) {
    return (
      <>
        <PageHeader title="Sync now" subtitle="Products · Listings" />
        <Card>
          <EmptyState
            title="No Channel Instances are registered"
            guidance="A Listing belongs to a registered Channel Instance. Register one before syncing."
          />
        </Card>
      </>
    );
  }

  return (
    <div data-testid="listing-sync" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <PageHeader
        title={outcome ? 'Sync result' : 'Sync now'}
        subtitle="Products · Listings"
        actions={
          <Link
            data-testid="sync-back"
            to="/inventory/products/listings"
            style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}
          >
            Back to Listings
          </Link>
        }
      />

      {error && (
        <Notice tone="danger" title="The sync could not be run" testId="sync-error">
          {error}
        </Notice>
      )}

      {/* ============================================================ THE MODAL SURFACE */}
      {!outcome && (
        <Card>
          <div data-testid="sync-request" style={{ padding: '20px 22px', display: 'grid', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                Sync now
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Reads listings from the selected channel and updates the reported side in Trioloo.
              </div>
            </div>

            {/* ------------------------------------------------ channel selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                <div style={columnLabel}>Channel / Shop to read</div>
                {/* 🔴 `PRD-189.b` — the scope is one channel instance, stated and enforced. */}
                <div style={{ fontSize: '11px', color: 'var(--color-placeholder)' }}>
                  One channel per manual sync
                </div>
              </div>

              <OperationalRegion>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' }}>
                  {channels.map((channel) => {
                    /*
                      ⚠ CAPABILITY, NOT AUTHORITY. An adapter that declares nothing readable has
                      nothing to sync, and the frame says exactly that instead of offering a
                      control that could only fail on click.
                    */
                    const readable = channel.adapterAvailable;
                    return (
                      <label
                        key={channel.id}
                        data-testid={`sync-channel-${channel.code}`}
                        className="operational-row"
                        style={{
                          ...row,
                          cursor: readable ? 'pointer' : 'not-allowed',
                          opacity: readable ? 1 : 0.62,
                        }}
                      >
                        <input
                          type="radio"
                          name="sync-channel"
                          data-testid={`sync-choose-${channel.code}`}
                          disabled={!readable || busy}
                          checked={chosen === channel.id}
                          onChange={() => setChosen(channel.id)}
                          style={{ flexShrink: 0, accentColor: 'var(--color-ink)' }}
                        />
                        <div style={{ flex: '1 1 0', minWidth: 0 }}>
                          <div style={{ ...cellText, fontWeight: 600 }}>
                            {channel.name} · {channel.channelType}
                          </div>
                          <div style={{ ...cellText, fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                            {readable
                              ? `${channel.knownListings.toLocaleString()} known listings · ${lastRead(channel)}`
                              : 'This adapter reports no readable data — nothing to sync'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </OperationalRegion>

              <div data-testid="sync-scope-note" style={note}>
                Manual Sync Now reads one channel instance. It is separate from the monthly
                automatic sync, single-listing Refresh and Refresh Selected.
              </div>
            </div>

            {/* ------------------------------------------------ what sync does */}
            <div data-testid="sync-explainer" style={panel}>
              <div style={columnLabel}>What sync does</div>
              <ul style={{ margin: '7px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li style={bullet}>Discovers active listings that Trioloo has not seen before and adds them as unmapped.</li>
                <li style={bullet}>Updates reported values on listings it already knows.</li>
                <li style={bullet}>Leaves ERP intended values, unsent changes and mappings untouched.</li>
              </ul>
              {/* 🔴 `PRD-189.e` — a scheduled or manual read never publishes intent. */}
              <div data-testid="sync-never-pushes" style={{ ...bullet, fontWeight: 700, marginTop: '8px' }}>
                Sync never pushes ERP changes to a marketplace.
              </div>
            </div>

            {/* ------------------------------------------------ the footnote */}
            <div data-testid="sync-footnote" style={note}>
              {/* 🔴 `PRD-177` — absence alone is never a deletion or a status change. */}
              Listings not returned by this run retain their previously reported status. Absence
              alone is not treated as deletion or a status change.
              {' '}
              {/*
                ⚠ `PRD-189.a` RATIFIES A MONTHLY CADENCE BUT NO SCHEDULER EXISTS, so the pack's
                "the last automatic run was …" time has NO SOURCE and is not fabricated here.
              */}
              <span data-testid="sync-automatic-unavailable">
                Trioloo also syncs automatically once a month; no automatic run has been recorded
                yet, so the last one cannot be shown.
              </span>
            </div>

            {/* ------------------------------------------------ Cancel / Start */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
              <Link
                data-testid="sync-cancel"
                to="/inventory/products/listings"
                style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}
              >
                Cancel
              </Link>
              {maySync ? (
                <button
                  type="button"
                  data-testid="sync-start"
                  disabled={chosen === null || busy}
                  onClick={() => void start()}
                  style={buttonStyle('primary', 'button')}
                >
                  {busy ? 'Reading the channel…' : 'Start sync'}
                </button>
              ) : (
                /* 🔴 `PRD-196.a` — no authority, no control. A disabled button would advertise
                   an authority the operator does not have. */
                <span data-testid="sync-no-permission" style={note}>
                  You do not have authority to synchronise Listings.
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================ THE RESULT SURFACE */}
      {outcome && (
        <>
          <Card>
            <div data-testid="sync-result" style={{ padding: '20px 22px', display: 'grid', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                  Sync result — run {shortId(outcome.batchId)}
                </div>
                <div data-testid="sync-result-subtitle" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Manual sync · {ranAgainst?.name ?? 'this channel'} · requested{' '}
                  {batch ? when(batch.requestedAt) : '—'} · {batch?.completedAt ? `completed ${when(batch.completedAt)}` : 'not completed'}
                  {batch?.requestedByName ? ` · by ${batch.requestedByName}` : ''}
                </div>
              </div>

              {/* ------------------------------------------------ complete / partial */}
              {outcome.complete ? (
                <Notice tone="success" title="Completed" testId="sync-status-complete">
                  The channel returned {outcome.listingsSeen.toLocaleString()} listings.
                  Listings not returned by this run retain their previously reported status and
                  their previously reported values — absence alone is not treated as deletion or
                  a status change.
                </Notice>
              ) : (
                <Notice tone="warning" title="Completed partially" testId="sync-status-partial">
                  {/* 🔴 `API-066.b` — a truncated enumeration is never presented as complete. */}
                  This is not the full picture of the channel.
                  {outcome.incompleteReason ? ` ${outcome.incompleteReason}` : ''}
                  {' '}Nothing was withdrawn or deleted, and fields that could not be reliably
                  read were left as they were rather than written empty.
                </Notice>
              )}

              {/* ------------------------------------------------ the real tallies */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
                {([
                  ['discovered', 'Active listings discovered', outcome.listingsSeen.toLocaleString()],
                  ['refreshed', 'Existing listings refreshed', Math.max(outcome.listingsSeen - outcome.listingsCreated, 0).toLocaleString()],
                  ['imported', 'New unmapped imported', outcome.listingsCreated.toLocaleString()],
                ] as const).map(([key, label, value]) => (
                  <div key={key} data-testid={`sync-tile-${key}`} style={tile}>
                    <div style={columnLabel}>{label}</div>
                    <div style={tileValue}>{value}</div>
                  </div>
                ))}
              </div>

              {/* ------------------------------------------------ tracked vs untracked */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
                {([
                  /* ✅ REAL — derived from the batch's own members (`INV-108.2`). */
                  ['manual', 'Manual required', batch ? batch.manualRequired.toLocaleString() : '—', true],
                  ['errors', 'Errors', batch ? batch.failed.toLocaleString() : '—', true],
                  /*
                    ⚠ UNAVAILABLE — a discovery run records no per-field comparison, so neither
                    a "changes found" tally nor a "new divergences" count has a source.
                    🔴 `LSC-034` — deriving one would fabricate a marketplace verdict.
                  */
                  ['changes', 'Reported changes found', '—', false],
                  /*
                    ⚠ UNAVAILABLE — `PRD-177` makes absence meaningless on its own, and the run
                    reports what it RETURNED, not what it did not. Subtracting from a known count
                    would state a figure the server never computed.
                  */
                  ['not-returned', 'Not returned this run', '—', false],
                ] as const).map(([key, label, value, real]) => (
                  <div key={key} data-testid={`sync-tile-${key}`} style={tile}>
                    <div style={columnLabel}>{label}</div>
                    <div style={{ ...tileValue, color: real ? 'var(--color-heading-ink)' : 'var(--color-placeholder)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div data-testid="sync-unavailable-note" style={note}>
                <strong>Reported changes found</strong> and <strong>Not returned this run</strong>{' '}
                are not recorded by a discovery run. A run reports what the channel returned; it
                does not compare field by field, and it never concludes anything from a listing's
                absence. Open a Listing to compare intended against reported.
              </div>

              {/*
                ⚠ THE PACK OFFERS "Retry incomplete channel". `PRD-186.d` targets FAILED members
                only, and a discovery run records none — so the control is stated as unavailable
                rather than rendered as a button that can address nothing.
              */}
              {!outcome.complete && (
                <div data-testid="sync-retry-unavailable" style={note}>
                  A retry targets failed members of a run. This run recorded none, so there is
                  nothing to retry — start a new sync when the channel is reachable again.
                </div>
              )}
            </div>
          </Card>

          {/* ------------------------------------------------ Channel read */}
          <Card>
            <div style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                Channel read
              </div>
              <div style={note}>
                {/* 🔴 `PRD-186.a`/`.b` — one record per listing, retained individually and never
                    collapsed into an aggregate. */}
                One record per Listing this run processed.
              </div>

              {members.length === 0 ? (
                <div style={{ paddingTop: '10px' }}>
                  <EmptyState
                    title="This run recorded no per-Listing operations"
                    guidance="The channel returned nothing, or the run was refused before any Listing was read."
                  />
                </div>
              ) : (
                <OperationalRegion>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '10px' }}>
                    <div className="operational-row" style={{ ...row, fontWeight: 700 }}>
                      <div style={{ ...cellText, width: '260px', flexShrink: 0 }}>Listing</div>
                      <div style={{ ...cellText, width: '110px', flexShrink: 0 }}>Act</div>
                      <div style={{ ...cellText, width: '120px', flexShrink: 0 }}>Outcome</div>
                      <div style={{ ...cellText, flex: '1 1 0', minWidth: 0 }}>Detail</div>
                      <div style={{ ...cellText, width: '150px', flexShrink: 0 }}>Completed</div>
                    </div>
                    {members.map((member) => (
                      <div
                        key={member.id}
                        data-testid={`sync-member-${member.id}`}
                        className="operational-row"
                        style={row}
                      >
                        <div style={{ ...cellText, width: '260px', flexShrink: 0 }}>
                          {/*
                            ⚠ THE LISTING'S OWN IDENTITY, in the order the record holds it. A
                            Listing with no authored title falls back to its channel identifier;
                            no attribute is substituted for a title (`DZC-026`).
                          */}
                          <Link
                            to={`/inventory/products/listings/${member.channelListingId}`}
                            style={{ color: 'var(--color-link)' }}
                          >
                            {member.listingTitle ?? member.externalListingId ?? 'Untitled listing'}
                          </Link>
                        </div>
                        <div style={{ ...cellText, width: '110px', flexShrink: 0 }}>{member.operationKind}</div>
                        <div style={{ ...cellText, width: '120px', flexShrink: 0 }}>{member.outcome}</div>
                        <div style={{ ...cellText, flex: '1 1 0', minWidth: 0 }}>{member.detail ?? '—'}</div>
                        <div style={{ ...cellText, width: '150px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {member.completedAt ? when(member.completedAt) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </OperationalRegion>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * ⚠ `last read` COMES FROM WHAT THE SERVER ACTUALLY RECORDS. A discovery run deliberately does
 * not write a listing's sync time (`INV-107.4`, `GAP-134`), so a channel that has only ever been
 * discovered has none — and the frame says so rather than showing a date it does not have.
 */
function lastRead(channel: ChannelView): string {
  return channel.lastSyncAt === null ? 'no read time recorded' : `last read ${when(channel.lastSyncAt)}`;
}

function when(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '—' : at.toLocaleString();
}

/** ⚠ A short, non-authoritative label. The full identifier is never replaced by it. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'nowrap',
  width: '100%',
  minWidth: 0,
  padding: '7px 4px',
};

const cellText: React.CSSProperties = {
  fontSize: '12.5px',
  color: 'var(--color-text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
};

const note: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.6,
  marginTop: '6px',
};

const bullet: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-primary)',
  lineHeight: 1.55,
};

const panel: React.CSSProperties = {
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-card-small)',
  padding: '13px 15px',
};

const tile: React.CSSProperties = {
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-card-small)',
  padding: '12px 14px',
  minWidth: 0,
};

const tileValue: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 800,
  marginTop: '3px',
  color: 'var(--color-heading-ink)',
  fontVariantNumeric: 'tabular-nums',
};
