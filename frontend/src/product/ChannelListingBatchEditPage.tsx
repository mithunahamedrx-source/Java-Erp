import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';
import { fetchChannelListing, updateChannelListing } from './channelListingApi';
import type { ChannelListing } from './channelListingApi';

type RowResult = {
  readonly listing: ChannelListing;
  readonly state: 'PENDING' | 'SAVED' | 'REFUSED';
  readonly message: string | null;
};

/**
 * Batch edit — a LOCAL change applied to an explicit selection.
 *
 * 🔴 `PRD-185` — every save here is LOCAL. Batch editing does NOT push, and there is no
 * "save and publish" path: pushing is a separate act requiring separate authority
 * (`PRD-196.a`). This is the rule most easily lost in a bulk screen, so it is enforced by
 * the page having no push call at all.
 *
 * 🔴 `INV-108.4` — the scope is exactly the selection that arrived. Nothing expands it to
 * sibling listings sharing a Sellable Product.
 *
 * 🔴 `INV-108.1` — per-listing outcomes are retained individually. One refusal never rolls
 * back a sibling that saved, and the result screen says exactly which is which.
 */
export default function ChannelListingBatchEditPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = (params.get('ids') ?? '').split(',').filter((value) => value.length > 0);

  const [rows, setRows] = useState<readonly RowResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  const [publicationIntent, setPublicationIntent] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [publishedStock, setPublishedStock] = useState('');
  const [channelCategory, setChannelCategory] = useState('');

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    Promise.all(ids.map((id) => fetchChannelListing(id)))
      .then((listings) =>
        setRows(listings.map((listing) => ({ listing, state: 'PENDING' as const, message: null }))),
      )
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'The selected Listings could not be loaded.'),
      )
      .finally(() => setLoading(false));
    // ids is derived from the URL and is stable for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('ids')]);

  /**
   * Applies only the fields the operator actually filled in.
   *
   * ⚠ A blank field means "leave this alone", never "set it to empty". Treating blank as a
   * clear would silently wipe intent across the whole selection.
   */
  const apply = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const results: RowResult[] = [];
    for (const row of rows) {
      const listing = row.listing;
      const body = {
        channelInstance: listing.channelInstance,
        externalListingId: listing.externalListingId,
        channelSku: null,
        mappedSellableSku: null,
        intendedTitle: listing.intendedTitle,
        intendedDescription: listing.intendedDescription,
        // 🔴 `TEC-015` — money travels as the STRING the operator typed.
        // PRD-199 - a batch may set the base price independently. ⚠ The PROMOTION is
        // deliberately NOT batch-editable: one promotion price with one window applied
        // across many listings would schedule an offer nobody reviewed per listing, and
        // PRD-199.c makes the window part of the price rather than a detail beside it.
        salePrice: salePrice !== '' ? salePrice : listing.salePrice,
        promotionPrice: listing.promotionPrice,
        promotionStartsAt: listing.promotionStartsAt,
        promotionEndsAt: listing.promotionEndsAt,
        publishedMarketplaceStock: publishedStock !== '' ? publishedStock : listing.listingStock,
        publicationIntent: publicationIntent !== '' ? publicationIntent : listing.publicationIntent,
        intendedChannelCategory:
          channelCategory !== '' ? channelCategory : listing.intendedChannelCategory,
        intendedChannelCategoryRef: null,
        version: listing.version,
      };
      try {
        await updateChannelListing(listing.id, body);
        results.push({ listing, state: 'SAVED', message: 'Saved locally. Not sent to the channel.' });
      } catch (cause) {
        // 🔴 `INV-107.2` — this refusal belongs to THIS listing. Siblings already saved stay
        // saved; the loop continues rather than abandoning the rest.
        results.push({
          listing,
          state: 'REFUSED',
          message: cause instanceof Error ? cause.message : 'This Listing could not be saved.',
        });
      }
    }
    setRows(results);
    setApplied(true);
    setBusy(false);
  };

  if (loading) {
    return (
      <Card>
        <EmptyState title="Loading selection..." guidance="Fetching the selected Listings." />
      </Card>
    );
  }

  if (ids.length === 0) {
    return (
      <Card>
        <EmptyState title="Nothing selected" guidance="Choose Listings in the workspace, then use Edit selected." />
      </Card>
    );
  }

  const savedCount = rows.filter((row) => row.state === 'SAVED').length;
  const refusedCount = rows.filter((row) => row.state === 'REFUSED').length;

  return (
    <div data-testid="listing-batch-edit" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      {error && <div style={noticeStyle}>{error}</div>}

      <Card>
        <div style={{ padding: '22px', display: 'grid', gap: '18px' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)', margin: 0 }}>
              Edit {rows.length} Listings
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              Leave a field blank to leave it unchanged. Saving records ERP intent only —
              nothing is sent to any channel.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '18px 24px' }}>
            <Field label="Publication intent" testId="batch-publication-intent" value={publicationIntent} onChange={setPublicationIntent} disabled={applied} />
            <Field label="Sale Price" testId="batch-sale-price" value={salePrice} onChange={setSalePrice} disabled={applied} />
            {/*
              ⚠ `PRD-199` — no promotion control here BY DESIGN. A promotion carries a window
              (`PRD-199.c`), and applying one window to a whole selection would schedule an
              offer nobody reviewed per listing. Promotions are set on the Listing.
            */}
            <Field label="Published marketplace stock" testId="batch-published-stock" value={publishedStock} onChange={setPublishedStock} disabled={applied} />
            <Field label="Channel category" testId="batch-channel-category" value={channelCategory} onChange={setChannelCategory} disabled={applied} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Link to="/inventory/products/listings" style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}>
              {applied ? 'Back to Listings' : 'Cancel'}
            </Link>
            {!applied && (
              <button type="button" data-testid="batch-edit-apply" disabled={busy} onClick={() => void apply()} style={buttonStyle('primary', 'button')}>
                Save {rows.length} Listings locally
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: '18px 22px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)', margin: '0 0 12px' }}>
            {applied ? `Result — ${savedCount} saved, ${refusedCount} refused` : 'Selection'}
          </h2>
          <OperationalRegion>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {rows.map((row) => (
                <div key={row.listing.id} className="operational-row" data-testid={`batch-edit-row-${row.listing.id}`} style={rowStyle}>
                  <div style={{ width: '130px', flexShrink: 0, ...cellText }}>{row.listing.channelInstance}</div>
                  <div style={{ width: '140px', flexShrink: 0, ...cellText, fontFamily: 'var(--font-family-mono)' }}>
                    {row.listing.externalListingId ?? 'Not published'}
                  </div>
                  <div style={{ flex: '1 1 0', minWidth: 0, ...cellText }}>
                    {row.listing.intendedTitle ?? 'Untitled listing'}
                  </div>
                  <span style={badge}>{row.state}</span>
                  <div style={{ flex: '1 1 0', minWidth: 0, ...cellText, color: 'var(--color-text-secondary)' }} title={row.message ?? ''}>
                    {row.message ?? ''}
                  </div>
                </div>
              ))}
            </div>
          </OperationalRegion>
        </div>
      </Card>

      {applied && savedCount > 0 && (
        <div data-testid="batch-edit-push-hint" style={noticeStyle}>
          These changes are local. To send them to the channels, select the Listings in the
          workspace and use Push updates — that is a separate act and requires publish
          authority.
          <button
            type="button"
            onClick={() => navigate('/inventory/products/listings')}
            style={{ ...buttonStyle('secondary', 'row-action'), marginLeft: 'var(--space-3)' }}
          >
            Go to Listings
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  testId,
  value,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly testId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
}): React.JSX.Element {
  return (
    <label style={{ display: 'grid', gap: '6px', minWidth: 0, fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
      {label}
      <input
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Unchanged"
        style={{ height: 'var(--control-height-form)', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-control)', padding: '0 12px', fontSize: '13px', fontFamily: 'inherit', background: disabled ? 'var(--color-control-disabled-bg)' : 'var(--color-surface)' }}
      />
    </label>
  );
}

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap', width: '100%', minWidth: 0, padding: '8px 4px' };
const cellText: React.CSSProperties = { fontSize: '12.5px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const badge: React.CSSProperties = { display: 'inline-flex', justifyContent: 'center', minWidth: '86px', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'var(--color-status-neutral-bg)', color: 'var(--color-status-neutral-fg)', whiteSpace: 'nowrap', flexShrink: 0 };
const noticeStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--color-text-primary)', background: 'var(--color-status-neutral-bg)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', padding: '10px 14px' };
