import { CONNECTION_STATE_ROLE, semanticRoleOf } from '../design/semanticRole';
import type { Figure, ShopSummary } from './shopApi';

/**
 * `SCS-020` — the summary strip: one card per channel type PRESENT, plus an all-shops card.
 *
 * <p>🔴 `SCS-020.a` — EVERY FIGURE IS DERIVED BY THE SERVER from the same shop records the
 * rows show. Nothing here counts anything, and no counter column exists to read.
 *
 * <p>🔴 `SCS-020.c` / `SCS-061` — NO ORDER, RETURN, MESSAGE, SETTLEMENT OR LISTING FIGURE
 * APPEARS, and never a zero for an unbuilt domain. Those numbers are not withheld for tidiness:
 * the system genuinely cannot make the claim.
 *
 * <p>🔴 `SCS-020.b` — a condition that does not occur produces NO LINE, not a zero. The server
 * omits it and this component renders what it is given.
 */
export function ShopSummaryStrip({ summary }: { readonly summary: ShopSummary }): React.JSX.Element {
  return (
    <div
      data-testid="shop-summary-strip"
      style={{
        display: 'grid',
        // ⚠ RULE 7.8.a — a page-level region, so it may reflow into fewer columns.
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        marginTop: '22px',
      }}
    >
      <SummaryCard
        title="All shops"
        aside={`${summary.allShops.channelTypeCount} ${
          summary.allShops.channelTypeCount === 1 ? 'channel type' : 'channel types'
        }`}
        figure={String(summary.allShops.shopCount)}
        lines={summary.allShops.configurationSplit.map((split) => ({
          ...split,
          /*
            🔴 CONFIGURATION IS NEUTRAL THROUGHOUT (`CONFIGURATION_STATE_ROLE`). The dot varies
            in WEIGHT, never in hue: `SCS-024.b` reserves semantic colour for connection, and
            two coloured dimensions in one strip would compete.
          */
          dot: split.key === 'ACTIVE' ? 'var(--color-text-secondary)' : 'var(--color-text-demoted)',
        }))}
      />

      {summary.channelTypes.map((card) => (
        <SummaryCard
          key={card.channelType}
          testId={`summary-card-${card.channelType}`}
          title={card.label}
          /*
            🔴 `SCS-021` — a shop whose connection is not CONNECTED. Configuration contributes
            nothing: DRAFT is not attention and SUSPENDED never enters this figure.
            ⚠ `null` means Integration was unreadable, so NO attention claim is made at all.
          */
          aside={
            card.attentionCount === null
              ? undefined
              : card.attentionCount === 0
                ? undefined
                : `${card.attentionCount} ${card.attentionCount === 1 ? 'needs' : 'need'} attention`
          }
          asideTone={card.attentionCount ? 'warning' : undefined}
          figure={String(card.shopCount)}
          figureSuffix={card.shopCount === 1 ? 'shop' : 'shops'}
          lines={card.connectionSplit.map((split) => ({
            ...split,
            dot: `var(--color-semantic-${semanticRoleOf(CONNECTION_STATE_ROLE, split.key)}-fg)`,
          }))}
          /*
            ⚠ `SYS-034` — when the condition could not be read the card says so in words
            instead of showing a split it does not have. It never counts unreadable as
            not-connected.
          */
          footnote={card.attentionCount === null ? 'Connection state not available just now.' : undefined}
        />
      ))}
    </div>
  );
}

type Line = Figure & { readonly dot: string };

function SummaryCard({
  title,
  aside,
  asideTone,
  figure,
  figureSuffix,
  lines,
  footnote,
  testId,
}: {
  readonly title: string;
  readonly aside?: string;
  readonly asideTone?: 'warning';
  readonly figure: string;
  readonly figureSuffix?: string;
  readonly lines: readonly Line[];
  readonly footnote?: string;
  readonly testId?: string;
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        border: '1px solid var(--color-divider-inner)',
        borderRadius: '10px',
        padding: '13px 15px',
        background: 'var(--color-surface)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <div
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            fontWeight: 700,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {aside && (
          <div
            data-testid="summary-aside"
            style={{
              fontSize: '11px',
              fontWeight: asideTone ? 700 : 400,
              whiteSpace: 'nowrap',
              // 🔴 The role, never a hue (`RULE 3.3.d`).
              color: asideTone ? `var(--color-semantic-${asideTone}-fg)` : 'var(--color-text-demoted)',
            }}
          >
            {aside}
          </div>
        )}
      </div>

      <div style={{ fontSize: '23px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '4px' }}>
        {figure}
        {figureSuffix && (
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-demoted)' }}>
            {' '}
            {figureSuffix}
          </span>
        )}
      </div>

      {lines.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            marginTop: '9px',
            paddingTop: '9px',
            borderTop: '1px solid var(--color-divider-light)',
          }}
        >
          {lines.map((line) => (
            <div key={line.key} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span
                aria-hidden="true"
                style={{ width: '5px', height: '5px', borderRadius: '50%', background: line.dot, flex: '0 0 5px' }}
              />
              {/* 🔴 RULE 8.4 — the label is the carrier; the dot only supports it. */}
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }}>
                {line.label}
              </span>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {line.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {footnote && (
        <div style={{ marginTop: '9px', fontSize: '11px', color: 'var(--color-text-muted)' }}>{footnote}</div>
      )}
    </div>
  );
}
