import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';
import { discoverChannel, fetchChannels } from './channelListingApi';
import type { ChannelView, DiscoveryOutcome } from './channelListingApi';

/**
 * Channel sync — what each channel can do, and running discovery against it.
 *
 * 🔴 `PRD-125` — capability is declared per channel INSTANCE, per field and per direction.
 * "All Daraz shops behave alike" is exactly the universal statement `PRD-125` refuses, so
 * nothing on this page is hardcoded per channel type.
 *
 * 🔴 `PRD-177` — discovery never deletes. A listing a run did not return is left exactly as
 * it was, and an INCOMPLETE run says so plainly (`API-066.b`).
 */
export default function ChannelListingSyncPage(): React.JSX.Element {
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const maySync = permissions.includes('product.channel-listing.sync');

  const [channels, setChannels] = useState<readonly ChannelView[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, DiscoveryOutcome>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels()
      .then(setChannels)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Channels could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const discover = async (channel: ChannelView): Promise<void> => {
    setBusy(channel.id);
    setError(null);
    try {
      const outcome = await discoverChannel(channel.id);
      setOutcomes((current) => ({ ...current, [channel.id]: outcome }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Discovery could not be run.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <EmptyState title="Loading channels..." guidance="Fetching registered Channel Instances." />
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <EmptyState title="No Channel Instances are registered" guidance="A Listing belongs to a registered Channel Instance. Register one before syncing." />
      </Card>
    );
  }

  return (
    <div data-testid="listing-sync" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      {error && <div style={noticeStyle}>{error}</div>}

      {channels.map((channel) => {
        const outcome = outcomes[channel.id];
        return (
          <Card key={channel.id}>
            <div data-testid={`sync-channel-${channel.code}`} style={{ padding: '18px 22px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {channel.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {channel.code} · {channel.channelType} · {channel.knownListings} known Listings
                    {channel.lastSyncAt ? ` · last sync ${channel.lastSyncAt}` : ''}
                  </div>
                </div>
                <span style={badge}>{channel.adapterAvailable ? 'Adapter available' : 'No adapter'}</span>
                {maySync && (
                  <button
                    type="button"
                    data-testid={`sync-discover-${channel.code}`}
                    disabled={busy !== null || !channel.adapterAvailable}
                    onClick={() => void discover(channel)}
                    style={buttonStyle('primary', 'row-action')}
                  >
                    Discover active listings
                  </button>
                )}
              </div>

              {/*
                🔴 The honest boundary. No adapter means nothing can be sent or read, and the
                page says so rather than offering an action that would fail on click.
              */}
              {!channel.adapterAvailable && (
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                  No marketplace adapter is configured for this channel type. Discovery,
                  refresh and push are unavailable until Marketplace Integration supplies one.
                  Listings for this channel can still be created, mapped and edited locally.
                </div>
              )}

              {outcome && (
                <div data-testid={`sync-outcome-${channel.code}`} style={noticeStyle}>
                  {/*
                    🔴 `API-066.b` — an incomplete run is reported as incomplete, because
                    `PRD-177`'s absence-is-not-deletion guarantee depends on the operator
                    knowing that this was not the full picture.
                  */}
                  {outcome.complete
                    ? `Discovery complete. ${outcome.listingsSeen} Listings returned, ${outcome.listingsCreated} newly recorded. Listings not returned by this run were left unchanged.`
                    : `Discovery INCOMPLETE — this is not the full picture of the channel. ${outcome.listingsSeen} Listings returned so far. ${outcome.incompleteReason ?? ''} Nothing was withdrawn or deleted.`}
                  {' '}
                  <Link to={`/inventory/products/listings/batches/${outcome.batchId}`}>View run</Link>
                </div>
              )}

              {channel.capabilities.length > 0 && (
                <OperationalRegion>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div className="operational-row" style={{ ...row, fontWeight: 700 }}>
                      <div style={{ width: '200px', flexShrink: 0, ...cellText }}>Field</div>
                      <div style={{ width: '120px', flexShrink: 0, ...cellText }}>Readable</div>
                      <div style={{ width: '120px', flexShrink: 0, ...cellText }}>Writable</div>
                      <div style={{ flex: '1 1 0', minWidth: 0 }} />
                    </div>
                    {channel.capabilities.map((capability) => (
                      <div key={capability.fieldKey} className="operational-row" data-testid={`capability-${channel.code}-${capability.fieldKey}`} style={row}>
                        <div style={{ width: '200px', flexShrink: 0, ...cellText }}>{capability.fieldKey}</div>
                        <div style={{ width: '120px', flexShrink: 0, ...cellText }}>{capability.readable ? 'Yes' : 'No'}</div>
                        <div style={{ width: '120px', flexShrink: 0, ...cellText }}>{capability.writable ? 'Yes' : 'No'}</div>
                        <div style={{ flex: '1 1 0', minWidth: 0 }} />
                      </div>
                    ))}
                  </div>
                </OperationalRegion>
              )}

              {channel.capabilities.length === 0 && (
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-demoted)' }}>
                  {/*
                    🔴 `PRD-125` — capability is DECLARED by the adapter per instance. With no
                    declaration the honest statement is that it is unknown, never a default
                    "everything works".
                  */}
                  No field capability has been declared for this channel instance, so what it
                  can read or write is unknown.
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <div>
        <Link to="/inventory/products/listings" style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}>
          Back to Listings
        </Link>
      </div>
    </div>
  );
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap', width: '100%', minWidth: 0, padding: '6px 4px' };
const cellText: React.CSSProperties = { fontSize: '12.5px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const badge: React.CSSProperties = { display: 'inline-flex', justifyContent: 'center', minWidth: '128px', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'var(--color-status-neutral-bg)', color: 'var(--color-status-neutral-fg)', whiteSpace: 'nowrap', flexShrink: 0 };
const noticeStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--color-text-primary)', background: 'var(--color-status-neutral-bg)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', padding: '10px 14px' };
