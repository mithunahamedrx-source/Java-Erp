import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { StatusPill, Card, EmptyState, buttonStyle } from '../ui/primitives';
import { BATCH_SAVE_OUTCOME_ROLE, semanticRoleOf } from '../design/semanticRole';
import { OperationalRegion } from '../ui/OperationalRegion';
import { fetchChannelListing, fetchChannels, updateChannelListing } from './channelListingApi';
import type { ChannelListing, ChannelView } from './channelListingApi';

type RowResult = {
  readonly listing: ChannelListing;
  readonly state: 'SELECTED' | 'SAVED' | 'EXCLUDED' | 'REFUSED';
  readonly message: string | null;
};

/**
 * FRAME 17 — Batch edit: local intent only, capability-aware.
 *
 * <p>🔴 `PRD-185` — every save here is LOCAL. Batch editing does NOT push, and there is no
 * "save and publish" path: pushing is a separate act requiring separate authority
 * (`PRD-196.a`). This is the rule most easily lost in a bulk screen, so it is enforced by
 * the page having no push call at all.
 *
 * <p>🔴 `INV-108.4` / `PRD-187.c` — the scope is exactly the selection that arrived. Nothing
 * expands it to sibling listings sharing a Sellable Product.
 *
 * <p>🔴 `INV-108.1` / `INV-107.2` — per-listing outcomes are retained individually. One
 * refusal never rolls back a sibling that saved, and the result region says which is which.
 *
 * <p>🔴 SET-TO-VALUE IS THE ONLY RATIFIED OPERATION, AND THE REST ARE PRESENT BUT INERT.
 * `PRD-187.b` ratifies batch as "the same operations at different scope" — a single edit
 * SETS a value, so batch-set is ratified. The approved pack also shows TRANSFORMATION
 * operators — decrease by a percentage, round to the nearest ৳10, append a title suffix —
 * and ⚠ NONE OF THEM EXISTS IN CANONICAL ARCHITECTURE. A percentage change is a monetary
 * FORMULA and "nearest ৳10" is a rounding rule that `DB-079`, the ERP-wide owner of BDT
 * rounding, does not grant. They are rendered because the design shows them and
 * {@link OPERATORS} marks them unratified, which disables them everywhere they appear and
 * blocks {@link ChannelListingBatchEditPage} from applying one.
 *
 * <p>🔴 NO MONEY ARITHMETIC HAPPENS HERE, WHICH IS WHY THE TRANSFORMS CANNOT SIMPLY BE
 * "IMPLEMENTED IN THE BROWSER" ({@code TEC-095}, {@code TEC-015}). Money arrives as a string
 * and is not arithmetic material; a set-to value is passed through exactly as typed.
 */

/** A field's editing vocabulary. 🔴 `ratified: false` means present-but-inert, never hidden. */
type Operator = {
  readonly value: string;
  readonly label: string;
  readonly ratified: boolean;
  /** Shown beside the control, exactly as the approved pack shows it. */
  readonly hint?: string;
};

const NO_CHANGE: Operator = { value: '', label: 'No change', ratified: true };

const OPERATORS = {
  set: { value: 'SET', label: 'Set to', ratified: true } as Operator,
  /* 🔴 UNRATIFIED — a monetary formula. No `PRD-` rule defines it and `DB-079` does not
     grant a "nearest ৳10" rounding step. Present because the pack shows it; inert. */
  decreasePercent: {
    value: 'DECREASE_PERCENT',
    label: 'Decrease by %',
    ratified: false,
    hint: 'rounded to nearest ৳ 10',
  } as Operator,
  increasePercent: {
    value: 'INCREASE_PERCENT',
    label: 'Increase by %',
    ratified: false,
    hint: 'rounded to nearest ৳ 10',
  } as Operator,
  /* 🔴 UNRATIFIED — a string transformation, not a value assignment. */
  appendSuffix: { value: 'APPEND_SUFFIX', label: 'Append suffix', ratified: false } as Operator,
  appendImage: {
    value: 'APPEND_IMAGE',
    label: 'Append image to intended media',
    ratified: false,
  } as Operator,
} as const;

/**
 * The seven rows of the approved frame, in its order.
 *
 * <p>`capabilityKey` matches {@code ListingFieldKey} so the badge and the "applies to" count
 * come from each channel's DECLARED capability ({@code PRD-125}), never from an assumption
 * that channels of one type behave alike.
 */
type FieldSpec = {
  readonly key: string;
  readonly label: string;
  readonly capabilityKey: string;
  readonly operators: readonly Operator[];
  readonly valuePlaceholder: string;
  readonly valueWidth: string;
  /** A standing note the pack prints under the "applies to" count. */
  readonly note?: string;
};

const BATCH_FIELDS: readonly FieldSpec[] = [
  {
    key: 'channel-price',
    label: 'Channel price',
    capabilityKey: 'sale_price',
    operators: [NO_CHANGE, OPERATORS.set, OPERATORS.decreasePercent, OPERATORS.increasePercent],
    valuePlaceholder: 'Amount',
    valueWidth: '110px',
  },
  {
    key: 'listing-stock',
    label: 'Listing stock',
    capabilityKey: 'listing_stock',
    operators: [NO_CHANGE, OPERATORS.set],
    valuePlaceholder: '0',
    valueWidth: '90px',
    note: 'per orderable SKU where the adapter accepts it',
  },
  {
    key: 'title',
    label: 'Title',
    capabilityKey: 'title',
    operators: [NO_CHANGE, OPERATORS.set, OPERATORS.appendSuffix],
    valuePlaceholder: 'Title',
    valueWidth: '100%',
    note: "Truncated to each channel's limit at push time",
  },
  {
    key: 'channel-category',
    label: 'Channel category',
    capabilityKey: 'channel_category',
    operators: [NO_CHANGE, OPERATORS.set],
    valuePlaceholder: 'Category',
    valueWidth: '100%',
  },
  {
    key: 'attributes',
    label: 'Attributes',
    capabilityKey: 'attributes',
    operators: [NO_CHANGE],
    valuePlaceholder: '',
    valueWidth: '100%',
  },
  {
    key: 'publication-intent',
    label: 'Publication intent',
    capabilityKey: 'publication_intent',
    operators: [NO_CHANGE, OPERATORS.set],
    valuePlaceholder: 'Intent',
    valueWidth: '100%',
  },
  {
    key: 'media',
    label: 'Media',
    capabilityKey: 'media',
    operators: [NO_CHANGE, OPERATORS.appendImage],
    valuePlaceholder: '',
    valueWidth: '100%',
  },
];

/** Frame 17's row geometry. 🔴 Field · Change to apply · Applies to, and it does not wrap. */
const FIELD_ROW = '170px minmax(0, 1fr) 200px';

export default function ChannelListingBatchEditPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = (params.get('ids') ?? '').split(',').filter((value) => value.length > 0);

  const [rows, setRows] = useState<readonly RowResult[]>([]);
  const [channels, setChannels] = useState<readonly ChannelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  /** Per-field operator and value. A field absent from these maps means "No change". */
  const [operator, setOperator] = useState<Record<string, string>>({});
  const [value, setValue] = useState<Record<string, string>>({});

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    Promise.all([Promise.all(ids.map((id) => fetchChannelListing(id))), fetchChannels()])
      .then(([listings, channelViews]) => {
        setRows(listings.map((listing) => ({ listing, state: 'SELECTED' as const, message: null })));
        setChannels(channelViews);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'The selected Listings could not be loaded.'),
      )
      .finally(() => setLoading(false));
    // ids is derived from the URL and is stable for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('ids')]);

  /**
   * Every summary fact, derived from the selection already loaded.
   *
   * <p>✅ Counting records the operator explicitly chose is not the browser owning a
   * calculation ({@code TEC-095}) — no money is involved and no dataset is filtered here;
   * the scope is exactly the ids that arrived ({@code PRD-187.c}).
   */
  const facts = useMemo(() => {
    const listings = rows.map((row) => row.listing);
    const unmapped = listings.filter((l) => l.mappingState === 'UNMAPPED').length;
    return {
      selected: listings.length,
      channels: new Set(listings.map((l) => l.channelInstanceId)).size,
      variation: listings.filter((l) => l.skuCount > 1).length,
      unmapped,
      /* ⚠ The pack states this exclusion: an unmapped listing holds no ERP intended values
         to change, so it is not written to. Excluding is the CONSERVATIVE direction. */
      willReceive: listings.length - unmapped,
    };
  }, [rows]);

  const capabilityById = useMemo(() => {
    const map = new Map<string, ChannelView>();
    channels.forEach((channel) => map.set(channel.id, channel));
    return map;
  }, [channels]);

  /**
   * How many of the selected Listings sit on a channel that DECLARES this field writable.
   *
   * <p>🔴 `PRD-125` — capability is declared per channel INSTANCE and per field. A channel
   * with no declaration at all is counted as NOT accepting the field, so the screen never
   * promises reach it cannot demonstrate.
   */
  const applicability = (field: FieldSpec): { readonly count: number; readonly channelsWithout: number } => {
    let count = 0;
    const without = new Set<string>();
    rows.forEach(({ listing }) => {
      const channel = capabilityById.get(listing.channelInstanceId);
      const writable = channel?.capabilities.some(
        (capability) => capability.fieldKey === field.capabilityKey && capability.writable,
      );
      if (writable) {
        count += 1;
      } else {
        without.add(listing.channelInstanceId);
      }
    });
    return { count, channelsWithout: without.size };
  };

  const selectionByChannel = useMemo(() => {
    const tally = new Map<string, { readonly name: string; count: number }>();
    rows.forEach(({ listing }) => {
      const entry = tally.get(listing.channelInstanceId);
      if (entry) {
        entry.count += 1;
      } else {
        tally.set(listing.channelInstanceId, { name: listing.channelInstance, count: 1 });
      }
    });
    return [...tally.entries()].map(([id, entry]) => ({ id, name: entry.name, count: entry.count }));
  }, [rows]);

  /** The largest channel TYPE in the selection, offered as a narrowing. */
  const dominantType = useMemo(() => {
    const tally = new Map<string, { count: number; ids: string[] }>();
    rows.forEach(({ listing }) => {
      const type = capabilityById.get(listing.channelInstanceId)?.channelType;
      if (!type) return;
      const entry = tally.get(type) ?? { count: 0, ids: [] };
      entry.count += 1;
      entry.ids.push(listing.id);
      tally.set(type, entry);
    });
    const sorted = [...tally.entries()].sort((a, b) => b[1].count - a[1].count);
    const largest = sorted[0];
    /* ⚠ Only offered when the selection actually spans more than one channel type — there is
       nothing to narrow to otherwise. */
    if (sorted.length < 2 || !largest) return null;
    return { type: largest[0], count: largest[1].count, ids: largest[1].ids };
  }, [rows, capabilityById]);

  const chosenOperator = (field: FieldSpec): Operator =>
    field.operators.find((candidate) => candidate.value === (operator[field.key] ?? '')) ?? NO_CHANGE;

  /** 🔴 An unratified operator can never reach {@link apply}. */
  const blockedField = BATCH_FIELDS.find((field) => !chosenOperator(field).ratified);

  const activeSets = BATCH_FIELDS.filter(
    (field) => chosenOperator(field).value === 'SET' && (value[field.key] ?? '') !== '',
  );

  /**
   * Applies only the fields the operator actually set.
   *
   * <p>⚠ A field left on "No change" means LEAVE THIS ALONE, never "set it to empty".
   * Treating it as a clear would silently wipe intent across the whole selection.
   */
  const apply = async (): Promise<void> => {
    if (blockedField || activeSets.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    const results: RowResult[] = [];
    const chosen = (key: string): string | null => {
      const field = BATCH_FIELDS.find((candidate) => candidate.key === key);
      if (!field || chosenOperator(field).value !== 'SET') return null;
      const raw = value[key] ?? '';
      return raw === '' ? null : raw;
    };

    for (const row of rows) {
      const listing = row.listing;
      /* 🔴 The pack excludes unmapped Listings from the write, and so does this. */
      if (listing.mappingState === 'UNMAPPED') {
        results.push({
          listing,
          state: 'EXCLUDED',
          message: 'An unmapped Listing holds no ERP intended values to change.',
        });
        continue;
      }
      const price = chosen('channel-price');
      const stock = chosen('listing-stock');
      const title = chosen('title');
      const category = chosen('channel-category');
      const intent = chosen('publication-intent');
      const body = {
        channelInstance: listing.channelInstance,
        externalListingId: listing.externalListingId,
        channelSku: null,
        mappedSellableSku: null,
        intendedTitle: title ?? listing.intendedTitle,
        intendedDescription: listing.intendedDescription,
        // 🔴 `TEC-015` — money travels as the STRING the operator typed. Nothing is computed.
        // ⚠ `PRD-199` — the PROMOTION is deliberately not batch-editable: one promotion price
        // with one window across many listings would schedule an offer nobody reviewed per
        // listing, and `PRD-199.c` makes the window part of the price.
        salePrice: price ?? listing.salePrice,
        promotionPrice: listing.promotionPrice,
        promotionStartsAt: listing.promotionStartsAt,
        promotionEndsAt: listing.promotionEndsAt,
        publishedMarketplaceStock: stock ?? listing.listingStock,
        publicationIntent: intent ?? listing.publicationIntent,
        intendedChannelCategory: category ?? listing.intendedChannelCategory,
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
        <EmptyState
          title="Nothing selected"
          guidance="Choose Listings in the workspace, then use Edit selected."
        />
      </Card>
    );
  }

  const savedCount = rows.filter((row) => row.state === 'SAVED').length;
  const refusedCount = rows.filter((row) => row.state === 'REFUSED').length;

  return (
    <div data-testid="listing-batch-edit" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      {error && <div style={noticeStyle}>{error}</div>}

      {/* ---------------------------------------------------------------- header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-5)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-heading-ink)', margin: 0, letterSpacing: '-0.01em' }}>
            Batch edit
          </h2>
          <p data-testid="batch-edit-scope" style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            {facts.selected} listings selected across {facts.channels}{' '}
            {facts.channels === 1 ? 'channel' : 'channels'} · applying changes stores them in Trioloo only
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexShrink: 0 }}>
          <Link to="/inventory/products/listings" style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}>
            Back to workspace
          </Link>
          {!applied && (
            <button
              type="button"
              data-testid="batch-edit-apply"
              disabled={busy || Boolean(blockedField) || activeSets.length === 0}
              onClick={() => void apply()}
              style={buttonStyle('primary', 'button')}
            >
              Apply to {facts.willReceive} listings
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------- five-fact summary strip */}
      <div
        data-testid="batch-edit-summary-strip"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 'var(--space-4)' }}
      >
        {([
          ['selected', 'Selected', facts.selected],
          ['channels', 'Channels', facts.channels],
          ['variation', 'Variation listings', facts.variation],
          ['unmapped', 'Unmapped', facts.unmapped],
          ['will-receive', 'Will receive changes', facts.willReceive],
        ] as const).map(([key, label, count]) => (
          <div
            key={key}
            data-testid={`batch-summary-${key}`}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-card)',
              borderRadius: 'var(--radius-card-small)',
              padding: '11px 13px',
              minWidth: 0,
            }}
          >
            <div style={{ ...columnLabel, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '3px', color: 'var(--color-heading-ink)', fontVariantNumeric: 'tabular-nums' }}>
              {count}
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------- main + 320px sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '24px', alignItems: 'start' }}>
        {/* ------------------------------------------------------- field rows */}
        <Card>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: FIELD_ROW, gap: '14px', paddingBottom: '4px', borderBottom: '1px solid var(--color-divider-light)' }}>
              <div style={columnLabel}>Field</div>
              <div style={columnLabel}>Change to apply</div>
              <div style={columnLabel}>Applies to</div>
            </div>

            {BATCH_FIELDS.map((field) => {
              const reach = applicability(field);
              const unsupportedCount = facts.selected - reach.count;
              const supported =
                reach.count === facts.selected
                  ? 'Supported for all'
                  : reach.count === 0
                    ? `Unsupported for ${facts.selected}`
                    : 'Supported for subset';
              const dimmed = reach.count === 0;
              const current = chosenOperator(field);
              const editable = field.operators.some((candidate) => candidate.ratified && candidate.value !== '');

              return (
                <div
                  key={field.key}
                  data-testid={`batch-field-${field.key}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: FIELD_ROW,
                    gap: '14px',
                    alignItems: 'center',
                    // Frame 17 dims a field no selected channel accepts, rather than hiding it.
                    opacity: dimmed ? 0.62 : 1,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {field.label}
                    </div>
                    <div data-testid={`batch-capability-${field.key}`} style={{ fontSize: '11px', color: 'var(--color-text-demoted)', marginTop: '2px' }}>
                      {supported}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                    {editable || field.operators.length > 1 ? (
                      <select
                        data-testid={`batch-operator-${field.key}`}
                        aria-label={`${field.label} — change to apply`}
                        value={operator[field.key] ?? ''}
                        disabled={dimmed || applied}
                        onChange={(event) =>
                          setOperator((previous) => ({ ...previous, [field.key]: event.target.value }))
                        }
                        style={{ ...controlStyle, width: '150px', flexShrink: 0, fontWeight: 600 }}
                      >
                        {field.operators.map((candidate) => (
                          <option
                            key={candidate.value || 'none'}
                            value={candidate.value}
                            /* 🔴 Present because the pack shows it, and NOT selectable
                               because no ratified rule defines what it would do. */
                            disabled={!candidate.ratified}
                          >
                            {candidate.ratified ? candidate.label : `${candidate.label} — unavailable`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ ...dashedControlStyle, flex: 1 }}>No change</div>
                    )}

                    {current.value === 'SET' && (
                      <input
                        data-testid={`batch-value-${field.key}`}
                        aria-label={`${field.label} — value`}
                        value={value[field.key] ?? ''}
                        disabled={dimmed || applied}
                        placeholder={field.valuePlaceholder}
                        onChange={(event) =>
                          setValue((previous) => ({ ...previous, [field.key]: event.target.value }))
                        }
                        style={{ ...controlStyle, width: field.valueWidth, minWidth: 0 }}
                      />
                    )}

                    {current.value === '' && field.operators.length > 1 && (
                      <span data-testid={`batch-unavailable-${field.key}`} style={hintStyle}>
                        {field.operators
                          .filter((candidate) => !candidate.ratified)
                          .map((candidate) => candidate.label)
                          .join(' · ')}
                        {field.operators.some((candidate) => !candidate.ratified)
                          ? ' is not available yet'
                          : ''}
                      </span>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div data-testid={`batch-reach-${field.key}`} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {reach.count} of {facts.selected}
                    </div>
                    {(field.note || unsupportedCount > 0) && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', marginTop: '2px' }}>
                        {unsupportedCount > 0
                          ? `${unsupportedCount} listings sit on channels that do not accept this field`
                          : field.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ------------------------------------------------------------ sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <Card>
            <div data-testid="batch-capability-legend" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={columnLabel}>Capability legend</div>
              {([
                ['Supported for all', 'Every selected channel accepts the field.'],
                ['Supported for subset', 'Editable, applied only where accepted. The count states where.'],
                ['Unsupported', 'Dimmed and not editable for the channels that reject it, rather than silently dropped later.'],
              ] as const).map(([term, meaning]) => (
                <div key={term}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{term}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', marginTop: '2px' }}>{meaning}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div data-testid="batch-selection-by-channel" style={{ padding: '14px 16px' }}>
              <div style={{ ...columnLabel, marginBottom: '10px' }}>Selection by channel</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {selectionByChannel.map((channel) => (
                  <div key={channel.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', minWidth: 0 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {channel.name}
                    </span>
                    <span style={{ fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{channel.count}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: '1px', background: 'var(--color-divider-light)', margin: '12px 0' }} />
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', lineHeight: 1.6 }}>
                Restrict this batch to one channel to unlock category and attributes.
              </div>
              {dominantType && !applied && (
                <button
                  type="button"
                  data-testid="batch-narrow-selection"
                  onClick={() =>
                    navigate(`/inventory/products/listings/batch-edit?ids=${dominantType.ids.join(',')}`)
                  }
                  style={{ ...buttonStyle('secondary', 'row-action'), marginTop: '10px' }}
                >
                  Narrow to {dominantType.type} channels ({dominantType.count})
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------- consequence footer */}
      <Card>
        <div data-testid="batch-edit-consequence" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
            Apply stores changes locally
          </div>
          {/* 🔴 `PRD-185.a` — the single most dangerous misreading of this screen is that a
              save reached the marketplace. It is denied here in the operator's own words. */}
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
            {facts.willReceive} listings will be marked with unsent local changes. Nothing is sent to
            any marketplace by this step. Pushing is a separate, reviewed action.
          </div>
          {facts.unmapped > 0 && (
            <div data-testid="batch-unmapped-excluded" style={{ fontSize: '12.5px', color: 'var(--color-text-demoted)' }}>
              {facts.unmapped} unmapped listings are excluded — they hold no ERP intended values to
              change.
            </div>
          )}
        </div>
      </Card>

      {/* -------------------------------------------------- per-listing outcome */}
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
                  {/* 🔴 `RULE 3.3.d.a` — the outcome carries its canonical role, and 🔴 SAVED is
                      deliberately NOT green: a local save has not reached the channel. */}
                  <StatusPill tone={semanticRoleOf(BATCH_SAVE_OUTCOME_ROLE, row.state)} dot>
                    {row.state}
                  </StatusPill>
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

const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};

const controlStyle: React.CSSProperties = {
  height: '34px',
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--color-border-control)',
  padding: '0 11px',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
};

/** Frame 17's "no change" treatment: a dashed, inert control rather than an empty cell. */
const dashedControlStyle: React.CSSProperties = {
  height: '34px',
  display: 'flex',
  alignItems: 'center',
  padding: '0 11px',
  border: '1px dashed var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  fontSize: '12.5px',
  color: 'var(--color-text-demoted)',
  minWidth: 0,
};

const hintStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-demoted)',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap', width: '100%', minWidth: 0, padding: '8px 4px' };
const cellText: React.CSSProperties = { fontSize: '12.5px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const noticeStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--color-text-primary)', background: 'var(--color-status-neutral-bg)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', padding: '10px 14px' };
