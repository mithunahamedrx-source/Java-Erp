import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../ui/Overlay';
import { isLongProviderText, readableProviderText } from './providerText';
import { attributeDisplayLabel } from './listingAttributes';
import { formatMoneyForDisplay } from '../platform/money';
import { formatMoment } from '../platform/datetime';
import { acceptMarketplaceValue, requestOperation } from './channelListingApi';
import type { CapabilityView, ChannelListing, ComparisonRow } from './channelListingApi';

/**
 * FRAME 07 — Intended vs reported, and FRAME 08 — the resolution dialogs it launches.
 *
 * <p>🔴 THE ONE RULE THIS SURFACE EXISTS TO HOLD: **unreadable is not equal**. A value the
 * channel did not return proves nothing about whether it matches, so it is never compared,
 * never shown as blank, zero or a dash, and never counted as agreement (`SYS-034`,
 * `API-063.c`).
 *
 * <p>🔴 The five conditions stay visually distinct and are never five equal pills:
 *
 * <ul>
 *   <li>ALIGNED — readable and equal. Quiet: no rule, no container, no action.
 *   <li>DIVERGED — readable and different. The strongest carrier: ink left rule, tinted row,
 *       both values at display weight, both resolutions offered inline.
 *   <li>NOT READABLE — the channel returned nothing. An italic sentence, never a blank.
 *   <li>MANUAL REQUIRED — no trustworthy deterministic comparison exists.
 *   <li>UNSENT — the ERP edited after the last push. ⚠ NOT divergence: the reported value is
 *       still correct for what was last sent, so Accept Marketplace is deliberately absent.
 * </ul>
 */

/** Fields whose values are money and must be rendered through the string formatter. */
const MONEY_FIELDS = new Set(['sale_price', 'promotion_price']);

/**
 * How a comparison value is DISPLAYED, wherever it is displayed.
 *
 * <p>🔴 `TEC-015` — money crosses the API as a STRING and is formatted as a string. It is
 * never parsed into a JavaScript `Number`, so no rounding, no float and no precision loss can
 * enter through the display path.
 */
export function displayComparisonValue(
  fieldKey: string,
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }
  /*
    🔴 PRESENTATION ONLY — see `providerText.ts`. A marketplace writes its description and
    attributes as HTML, and rendering the raw fragment turns a comparison row into tag soup.
    ⚠ The STORED value is untouched, and every comparison the server makes still uses it.
  */
  return MONEY_FIELDS.has(fieldKey)
    ? formatMoneyForDisplay(value)
    : readableProviderText(value);
}

/**
 * A value shown at its natural size, or CONTAINED when it would otherwise set the row height.
 *
 * <p>🔴 CONTAINED, NEVER TRUNCATED. A long marketplace description scrolls inside its own box,
 * so the whole value stays available and the row keeps the height its neighbours have. ⚠ A
 * shortened copy would misstate what the channel said, exactly as `DZC-031.h` refuses to
 * truncate on the way in.
 */
export function ComparisonValue({
  value,
  emphasis,
  testId,
}: {
  readonly value: string | null;
  readonly emphasis?: boolean;
  readonly testId?: string;
}): React.JSX.Element {
  const long = isLongProviderText(value);
  return (
    <div
      data-testid={testId}
      data-long={long ? 'true' : undefined}
      style={{
        fontSize: emphasis ? '15px' : '12.5px',
        fontWeight: emphasis ? 800 : 600,
        color: 'var(--color-text-primary)',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
        ...(long
          ? { maxHeight: '132px', overflowY: 'auto', fontSize: '12px', fontWeight: 500, lineHeight: 1.55 }
          : null),
      }}
    >
      {value ?? '—'}
    </div>
  );
}

/**
 * Whether the CHANNEL declares this field WRITABLE — `API-063.a`, `PRD-125`.
 *
 * <p>🔴 THREE DIFFERENT THINGS, NEVER CONFLATED. A field can be READABLE FROM the channel,
 * EDITABLE LOCALLY in Trioloo, and PUSHABLE TO the channel. Reading nine listings proves the
 * first; it says nothing about the third.
 *
 * <p>⚠ An attribute row carries its attribute name (`attribute:Brand`), and capability is
 * declared for the ATTRIBUTES field as a whole — so the row resolves to that key.
 *
 * <p>🔴 ABSENT IS NO SUPPORT, NEVER ASSUMED SUPPORT (`API-063`). An undeclared field is not
 * pushable, and the control says so rather than offering an act that cannot happen.
 */
export function declaresWritable(
  capabilities: readonly CapabilityView[] | undefined,
  fieldKey: string,
): boolean {
  if (!capabilities || capabilities.length === 0) {
    return false;
  }
  const key = fieldKey.startsWith('attribute:') ? 'attributes' : fieldKey;
  return capabilities.find((c) => c.fieldKey === key)?.writable === true;
}

type Resolution = { readonly kind: 'accept' | 'push'; readonly row: ComparisonRow };

export function ChannelListingComparison({
  item,
  rows,
  capabilities,
  mayManage,
  mayPublish,
  onResolved,
  onCompareMedia,
}: {
  readonly item: ChannelListing;
  readonly rows: readonly ComparisonRow[];
  /** What this channel instance declares it can write, per field (`API-063.a`). */
  readonly capabilities?: readonly CapabilityView[];
  readonly mayManage: boolean;
  readonly mayPublish: boolean;
  readonly onResolved: () => Promise<void> | void;
  /** Moves to the Media surface, where the only honest media comparison happens. */
  readonly onCompareMedia: () => void;
}): React.JSX.Element {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const divergedCount = useMemo(() => rows.filter((r) => r.state === 'DIVERGED').length, [rows]);
  /*
    🔴 READABLE IS NOT PUSHABLE. A channel that reads nine listings perfectly may declare no
    field writable, which is exactly what Daraz declares today: no outbound write protocol is
    documented and `pushUpdate` refuses. The reason is stated once rather than per row.
  */
  const anyPushable = useMemo(
    () => item.adapterAvailable && rows.some((r) => declaresWritable(capabilities, r.fieldKey)),
    [item.adapterAvailable, rows, capabilities],
  );
  const shown = differencesOnly ? rows.filter((r) => r.state === 'DIVERGED') : rows;

  const display = (row: ComparisonRow, value: string | null): string | null =>
    displayComparisonValue(row.fieldKey, value);

  const confirm = async (): Promise<void> => {
    if (!resolution) return;
    setBusy(true);
    setError(null);
    try {
      if (resolution.kind === 'accept') {
        // 🔴 `PRD-183` — ONE field. The reported value becomes ERP intent and nothing else
        // is touched: no other field, no Sellable Product master data, and no channel.
        await acceptMarketplaceValue(item.id, resolution.row.fieldKey);
      } else {
        await requestOperation(
          item.externalListingId ? 'PUSH_UPDATE' : 'PUBLISH_CREATE',
          [item.id],
          `Push ${resolution.row.label} on one Listing`,
        );
      }
      setResolution(null);
      await onResolved();
    } catch (cause) {
      // 🔴 A failed resolution keeps the dialog open with a real reason. Nothing is claimed
      // to have happened.
      setError(cause instanceof Error ? cause.message : 'The resolution could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', minWidth: 0 }}>
          {item.channelName ?? item.channelInstance} ·{' '}
          {item.lastSyncAt
            ? `reported values read ${formatMoment(item.lastSyncAt)}`
            : 'the channel has not been read back yet'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button type="button" data-testid="comparison-filter-all" onClick={() => setDifferencesOnly(false)} style={filterChip(!differencesOnly)}>
            All facts
          </button>
          <button
            type="button"
            data-testid="comparison-filter-diff"
            onClick={() => setDifferencesOnly(true)}
            disabled={divergedCount === 0}
            style={{ ...filterChip(differencesOnly), opacity: divergedCount === 0 ? 0.5 : 1 }}
          >
            Differences only ({divergedCount})
          </button>
        </div>
      </div>

      {/*
        ⚠ ONE FACT ABOUT THE CHANNEL, STATED ONCE. It used to print beside every difference,
        which filled the resolution column with the same sentence repeated down the page. It
        belongs to the channel, not to any row.

        🔴 IT IS ALSO THE HONEST BOUNDARY. Outbound is not implemented: `pushUpdate` refuses and
        contacts nothing (`LSC-053`). Where no adapter is configured the push controls are
        disabled, and this says why once.
      */}
      {mayPublish && !anyPushable && (
        <div data-testid="comparison-capability-note" style={{ ...quietNote, marginTop: '12px' }}>
          {!item.adapterAvailable
            ? 'No marketplace adapter is configured for this channel, so nothing can be sent from here.'
            : `${item.channelName ?? 'This channel'} can be READ but declares no field writable, so no change can be sent yet. Reading and editing locally are unaffected.`}
          {' '}Accepting a marketplace value is unaffected — it changes ERP intent only.
        </div>
      )}

      <div style={{ ...gridRow, marginTop: '18px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border-card)' }}>
        <div style={columnLabel}>Fact</div>
        <div style={columnLabel}>ERP intended</div>
        <div style={columnLabel}>Marketplace reported</div>
        <div style={columnLabel}>Resolution</div>
      </div>

      {shown.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: 'var(--color-text-demoted)', margin: '14px 0 0' }}>
          {differencesOnly
            ? 'No readable field currently differs from what the channel reports.'
            : 'There are no comparable facts for this listing yet.'}
        </p>
      ) : (
        shown.map((row) => {
          const diverged = row.state === 'DIVERGED';
          const unsent = row.state === 'UNSENT';
          const readable = row.reportedReadable;
          return (
            <div
              key={row.fieldKey}
              data-testid={`comparison-row-${row.fieldKey}`}
              style={{
                ...gridRow,
                alignItems: 'center',
                padding: diverged ? '14px 12px 14px 14px' : '12px 0',
                marginLeft: diverged ? '-14px' : 0,
                borderBottom: '1px solid var(--color-divider-light)',
                // 🔴 The ink LEFT RULE is the exception marker. Only a readable, genuine
                // difference earns it — an unreadable field must never look like one.
                background: diverged ? 'var(--color-strip)' : 'transparent',
                boxShadow: diverged ? 'inset 3px 0 0 var(--color-ink)' : 'none',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: diverged ? 700 : 600, color: 'var(--color-text-primary)' }}>
                  {attributeDisplayLabel(row.fieldKey, row.label)}
                </div>
                {unsent ? (
                  // 🔴 `PRD-185.d` — a grey filled chip, deliberately NOT the ink rule.
                  <span data-testid={`comparison-state-${row.fieldKey}`} style={unsentChip}>
                    <span aria-hidden="true" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-ink)' }} />
                    UNSENT
                  </span>
                ) : (
                  <div
                    data-testid={`comparison-state-${row.fieldKey}`}
                    style={{
                      fontSize: '10px',
                      letterSpacing: '.06em',
                      fontWeight: diverged ? 800 : 700,
                      marginTop: '2px',
                      color: diverged
                        ? 'var(--color-heading-ink)'
                        : row.state === 'MANUAL_REQUIRED'
                          ? 'var(--color-text-secondary)'
                          : 'var(--color-placeholder)',
                    }}
                  >
                    {STATE_LABEL[row.state] ?? row.state}
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <ComparisonValue
                  value={display(row, row.intendedValue)}
                  emphasis={diverged}
                  testId={`comparison-intended-${row.fieldKey}`}
                />
                {unsent && item.lastSuccessfulPushAt && (
                  <div style={subNote}>Last pushed {formatMoment(item.lastSuccessfulPushAt)}</div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                {/*
                  🔴 `SYS-034` — an unreadable value is a SENTENCE, never a blank, a dash or a
                  zero. The channel did not return a value at all, which is a different fact
                  from returning an empty one.
                */}
                {readable ? (
                  <>
                    <ComparisonValue
                      value={display(row, row.reportedValue)}
                      emphasis={diverged}
                      testId={`comparison-reported-${row.fieldKey}`}
                    />
                    {unsent && (
                      <div style={subNote}>Consistent with the last push — not a divergence</div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '12.5px', color: 'var(--color-text-demoted)', fontStyle: 'italic' }}>
                    Not readable from this channel
                  </div>
                )}
              </div>

              <div style={resolutionCell}>
                {resolutionFor(row, { item, capabilities, mayManage, mayPublish, setResolution, onCompareMedia })}
              </div>
            </div>
          );
        })
      )}

      {/* ------------------------------------------------------------------ FRAME 08 */}
      {resolution?.kind === 'accept' && (
        <ConfirmDialog
          testId="accept-marketplace-dialog"
          width="520px"
          title={`Accept marketplace value for ${resolution.row.label}?`}
          consequence={
            'This marketplace value will replace the ERP listing intended value for this fact. '
            + 'Sellable Product master data will not be changed, and nothing is sent to the channel.'
          }
          confirmLabel="Accept Marketplace"
          busy={busy}
          error={error}
          onCancel={() => {
            setResolution(null);
            setError(null);
          }}
          onConfirm={() => void confirm()}
        >
          <BeforeAfter
            testId="accept-dialog-table"
            headings={['Fact', 'Current ERP', 'Becomes']}
            label={resolution.row.label}
            from={display(resolution.row, resolution.row.intendedValue)}
            to={display(resolution.row, resolution.row.reportedValue)}
          />
          <div style={dialogContext}>
            Listing: {item.intendedTitle ?? 'Untitled listing'} · {item.channelName ?? item.channelInstance}
          </div>
        </ConfirmDialog>
      )}

      {resolution?.kind === 'push' && (
        <ConfirmDialog
          testId="push-erp-dialog"
          width="520px"
          title={`Push ERP value to ${item.channelName ?? item.channelInstance}?`}
          consequence={
            `Trioloo will request ${item.channelName ?? 'the channel'} to replace the current `
            + 'marketplace value with the ERP intended value below. The marketplace listing will '
            + 'be modified.'
          }
          confirmLabel="Push ERP Version"
          busy={busy}
          error={error}
          onCancel={() => {
            setResolution(null);
            setError(null);
          }}
          onConfirm={() => void confirm()}
        >
          <BeforeAfter
            testId="push-dialog-table"
            headings={['Field', 'On the channel now', 'Will be sent']}
            label={resolution.row.label}
            from={
              resolution.row.reportedReadable
                ? display(resolution.row, resolution.row.reportedValue)
                : 'Not readable'
            }
            to={display(resolution.row, resolution.row.intendedValue)}
          />
          {/* 🔴 `PRD-187.b` — a push never reaches a sibling shop. */}
          <div style={dialogContext}>
            Listings in other shops sharing this Sellable Product are not affected.
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

/**
 * The per-row resolution controls.
 *
 * <p>🔴 AUTHORITY AND CAPABILITY ARE DIFFERENT REFUSALS. An action the operator is not
 * authorised for is OMITTED; an action the channel cannot currently carry is stated as a
 * reason. Neither is ever presented as the other.
 */
function resolutionFor(
  row: ComparisonRow,
  ctx: {
    readonly item: ChannelListing;
    readonly capabilities?: readonly CapabilityView[];
    readonly mayManage: boolean;
    readonly mayPublish: boolean;
    readonly setResolution: (r: Resolution) => void;
    readonly onCompareMedia: () => void;
  },
): React.ReactNode {
  const { item, capabilities, mayManage, mayPublish, setResolution, onCompareMedia } = ctx;
  /*
    🔴 PUSHABLE IS NOT THE SAME AS READABLE. Daraz declares every listing field READABLE and
    NONE writable, because no outbound write protocol is documented (`DZC` covers the read side
    only) and `pushUpdate` refuses. Offering a push here would promise an act this system
    cannot perform.
  */
  const pushable = item.adapterAvailable && declaresWritable(capabilities, row.fieldKey);
  const pushBlockedReason = !item.adapterAvailable
    ? 'No marketplace adapter is configured for this channel.'
    : 'This channel does not declare this field writable, so it cannot be sent.';

  if (row.state === 'ALIGNED') {
    return <span style={quietNote}>Nothing to resolve</span>;
  }

  if (row.state === 'NOT_READABLE') {
    // 🔴 There is nothing trustworthy to accept, so Accept Marketplace is not offered at all.
    return <span style={quietNote}>Comparison not possible. Pushing sends the ERP value.</span>;
  }

  if (row.state === 'MANUAL_REQUIRED') {
    /*
      🔴 `PRD-183.d` — no automatic resolution is offered, because none is trustworthy. What
      IS offered is the surface where a person can actually look, which is not the same thing
      as resolving it here.
    */
    return (
      <button
        type="button"
        data-testid={`comparison-manual-${row.fieldKey}`}
        onClick={onCompareMedia}
        style={actionSecondary}
      >
        Compare in Media
      </button>
    );
  }

  if (row.state === 'UNSENT') {
    // 🔴 Frame 07 Case D — the reported value is still correct for the last push, so
    // Accept Marketplace is deliberately absent. Only sending the edit makes sense.
    return mayPublish ? (
      <button
        type="button"
        data-testid={`comparison-push-${row.fieldKey}`}
        disabled={!pushable}
        title={pushable ? undefined : pushBlockedReason}
        onClick={() => setResolution({ kind: 'push', row })}
        style={{ ...actionPrimary, opacity: pushable ? 1 : 0.45 }}
      >
        Review &amp; Push
      </button>
    ) : (
      <span style={quietNote}>Sending this change requires publish authority.</span>
    );

  }

  // DIVERGED — both resolutions, where authority and capability allow.
  return (
    <>
      <div style={actionRow}>
        {mayManage && row.resolvable && (
          <button
            type="button"
            data-testid={`comparison-accept-${row.fieldKey}`}
            onClick={() => setResolution({ kind: 'accept', row })}
            style={actionSecondary}
          >
            Accept Marketplace
          </button>
        )}
        {mayPublish && (
          <button
            type="button"
            data-testid={`comparison-push-${row.fieldKey}`}
            disabled={!pushable}
            title={pushable ? undefined : pushBlockedReason}
            onClick={() => setResolution({ kind: 'push', row })}
            style={{ ...actionPrimary, opacity: pushable ? 1 : 0.45 }}
          >
            Push ERP
          </button>
        )}
      </div>
      {!mayManage && !mayPublish && <span style={quietNote}>You cannot resolve this difference.</span>}
      {/*
        ⚠ THE CAPABILITY REASON IS NOT REPEATED HERE. It is one fact about the CHANNEL, not
        about this row, and printing it beside every difference filled the resolution column
        with the same sentence over and over. It is stated ONCE above the table instead.
      */}
    </>
  );
}

/** The Frame 08 before/after table. Three columns, no more: what, from, to. */
function BeforeAfter({
  testId,
  headings,
  label,
  from,
  to,
}: {
  readonly testId: string;
  readonly headings: readonly [string, string, string];
  readonly label: string;
  readonly from: string | null;
  readonly to: string | null;
}): React.JSX.Element {
  return (
    <div data-testid={testId} style={{ border: '1px solid var(--color-divider-inner)', borderRadius: 'var(--radius-control)', marginTop: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', padding: '9px 12px', borderBottom: '1px solid var(--color-divider-light)', ...columnLabel }}>
        {headings.map((heading) => (
          <div key={heading}>{heading}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', padding: '9px 12px', fontSize: '12.5px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{label}</div>
        <div style={{ color: 'var(--color-text-muted)', overflowWrap: 'anywhere' }}>{from ?? '—'}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{to ?? '—'}</div>
      </div>
    </div>
  );
}

const STATE_LABEL: Record<string, string> = {
  ALIGNED: 'ALIGNED',
  DIVERGED: 'DIVERGED',
  NOT_READABLE: 'NOT READABLE',
  MANUAL_REQUIRED: 'MANUAL REQUIRED',
  UNSENT: 'UNSENT',
};

const gridRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '150px minmax(0, 1fr) minmax(0, 1fr) 240px',
  gap: '14px',
  minWidth: 0,
};
const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};
const resolutionCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '6px',
  minWidth: 0,
};
/** The action pair itself never wraps and never scrolls; only the cell stacks. */
const actionRow: React.CSSProperties = {
  display: 'flex',
  gap: '7px',
  flexWrap: 'nowrap',
  minWidth: 0,
};
const quietNote: React.CSSProperties = { fontSize: '11.5px', color: 'var(--color-text-demoted)', lineHeight: 1.5 };
const subNote: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-demoted)', marginTop: '2px' };
const actionBase: React.CSSProperties = {
  height: '30px',
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 11px',
  borderRadius: 'var(--radius-control-small)',
  fontSize: '12px',
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};
const actionSecondary: React.CSSProperties = {
  ...actionBase,
  border: '1px solid var(--color-border-control)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontWeight: 600,
};
const actionPrimary: React.CSSProperties = {
  ...actionBase,
  border: '1px solid var(--color-ink)',
  background: 'var(--color-ink)',
  color: 'var(--color-surface)',
  fontWeight: 700,
};
/** 🔴 `PRD-185.d` — a grey filled chip, deliberately NOT the ink rule an exception earns. */
const unsentChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  height: '17px',
  padding: '0 6px',
  marginTop: '3px',
  background: 'var(--color-divider-light)',
  borderRadius: '4px',
  fontSize: '9.5px',
  fontWeight: 700,
  letterSpacing: '.05em',
  color: 'var(--color-text-primary)',
  width: 'fit-content',
};
const dialogContext: React.CSSProperties = { fontSize: '11.5px', color: 'var(--color-text-demoted)', marginTop: '10px', lineHeight: 1.5 };

function filterChip(active: boolean): React.CSSProperties {
  return {
    height: '30px',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 11px',
    border: active ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-control)',
    borderRadius: 'var(--radius-control-small)',
    background: 'var(--color-surface)',
    fontSize: '12px',
    fontWeight: active ? 700 : 600,
    color: active ? 'var(--color-heading-ink)' : 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
