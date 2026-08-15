import { LISTING_GRID } from './ChannelListingCard';

/**
 * FRAME 03 — the Listings workspace's loading, empty and operational conditions.
 *
 * <p>🔴 These are STATES OF THE WORKSPACE, not routes. The page header, Product tabs, summary
 * strip and filter row stay exactly as PASS 01 locked them; only the result region changes.
 *
 * <p>🔴 Monochrome, restrained, no illustration, no mascot, no gradient, no oversized icon
 * circle. `RULE 3.15.a`'s neutral block is the only "graphic" the workspace owns.
 */

const GRID_GAP = '14px';

/** Frame 03 skeleton bar. ⚠ No shimmer — the Design Constitution ratifies no such motion. */
function Bar({
  width,
  height,
  tone = 'strong',
}: {
  readonly width?: string;
  readonly height: string;
  readonly tone?: 'strong' | 'faint' | 'block';
}): React.JSX.Element {
  const background =
    tone === 'block'
      ? 'var(--color-nav-active-child)'
      : tone === 'faint'
        ? 'var(--color-strip)'
        : 'var(--color-divider-light)';
  return <div style={{ width: width ?? '100%', height, borderRadius: '3px', background }} />;
}

/**
 * The loading result region.
 *
 * <p>🔴 Frame 03 — "final geometry preserved". Each placeholder is a REAL 62px row on the
 * REAL column grid, so nothing shifts when the data arrives. A centred "Loading…" would
 * throw the whole list away and then rebuild it.
 */
export function ChannelListingSkeleton(): React.JSX.Element {
  // ⚠ Fixed widths, not random: a placeholder that changes on every render reads as motion.
  const rows = [
    { title: '72%', sub: '44%', channel: '76%', sellable: '82%' },
    { title: '58%', sub: '38%', channel: '66%', sellable: '74%' },
    { title: '65%', sub: '41%', channel: '70%', sellable: '78%' },
  ];
  return (
    <div
      data-testid="listing-skeleton"
      aria-busy="true"
      aria-label="Loading Listings"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-3)' }}
    >
      {rows.map((row, index) => (
        <div
          key={index}
          className="operational-row"
          data-testid="listing-skeleton-row"
          style={{
            display: 'grid',
            gridTemplateColumns: LISTING_GRID,
            gap: GRID_GAP,
            alignItems: 'center',
            width: '100%',
            minWidth: 0,
            padding: '11px 14px',
            // A quieter border than a real row, so a loading list never reads as content.
            border: '1px solid var(--color-divider-inner)',
            borderRadius: 'var(--radius-card-small)',
            background: 'var(--color-surface)',
            height: '62px',
          }}
        >
          <div style={{ width: '15px', height: '15px', borderRadius: '4px', background: 'var(--color-nav-active-child)' }} />
          <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-control)', background: 'var(--color-nav-active-child)' }} />
          <div style={{ minWidth: 0 }}>
            <Bar width={row.title} height="11px" />
            <div style={{ marginTop: '6px' }}>
              <Bar width={row.sub} height="9px" tone="faint" />
            </div>
          </div>
          <Bar width={row.channel} height="10px" />
          <Bar width={row.sellable} height="10px" />
          <Bar height="10px" />
          <Bar height="10px" />
          <Bar width="60%" height="10px" />
          <div />
        </div>
      ))}
    </div>
  );
}

/**
 * The Frame 03 empty / condition container.
 *
 * <p>🔴 One bordered panel, one title, one explanation, and only the actions the condition
 * actually supports. No icon is added merely because the region is empty.
 */
export function ListingsNotice({
  testId,
  title,
  body,
  actions,
  emphasis = false,
  quiet = false,
}: {
  readonly testId: string;
  readonly title: string;
  readonly body: string;
  readonly actions?: React.ReactNode;
  /** 🔴 The 1.5px ink border — reserved for a genuine failure, never for a capability gap. */
  readonly emphasis?: boolean;
  readonly quiet?: boolean;
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        border: emphasis ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-card-small)',
        background: quiet ? 'var(--color-strip)' : 'var(--color-surface)',
        padding: '26px 24px',
        minHeight: '150px',
        marginTop: 'var(--space-3)',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>{title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginTop: '6px', maxWidth: '78ch' }}>
        {body}
      </div>
      {actions && <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'nowrap' }}>{actions}</div>}
    </div>
  );
}

/**
 * An operational condition BANNER, above the list.
 *
 * <p>🔴 Frame 03 — "banner above the list, list stays usable". A remote failure must never
 * blank out local canonical data the ERP already holds.
 */
export function ListingsBanner({
  testId,
  title,
  body,
  action,
  emphasis = false,
}: {
  readonly testId: string;
  readonly title: string;
  readonly body: string;
  readonly action?: React.ReactNode;
  readonly emphasis?: boolean;
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        border: emphasis ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-control)',
        borderRadius: 'var(--radius-card-small)',
        background: emphasis ? 'var(--color-surface)' : 'var(--color-strip)',
        padding: '14px 16px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        marginTop: 'var(--space-3)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
          {body}
        </div>
      </div>
      {action}
    </div>
  );
}
