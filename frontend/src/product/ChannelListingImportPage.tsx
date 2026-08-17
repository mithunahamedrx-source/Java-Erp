import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, RefusalState, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';
import { formatShortMoment } from '../platform/datetime';
import { readTextFile } from '../platform/file';
import {
  channelListingTemplateUrl,
  confirmChannelListingImport,
  validateChannelListingImport,
} from './channelListingApi';
import type { ImportOutcome, ImportPlan, ImportResult } from './stockItemApi';

/**
 * FRAME 22 — CSV import: upload, validate, review, apply locally.
 *
 * <p>🔴 THIS IMPORT CHANGES ERP INTENDED VALUES ONLY AND NEVER CONTACTS A MARKETPLACE. The
 * frame says so in its own subtitle and again in its footnote, and the page has no push,
 * sync, discovery or publish call anywhere in it ({@code PRD-185}, {@code LSC-050}).
 *
 * <p>🔴 IT REPLACED A GENERIC DELEGATION, IT DID NOT ADD A ROUTE. This file used to hand
 * everything to {@code ProductCsvImportPage}, the component Stock and Sellable also use.
 * That component cannot express this frame — the validation tally, the invalid-row table,
 * the per-field review and the listing-specific consequence copy are all Listings-only — so
 * the surface was reconciled here while the route, the endpoints and the shared page for the
 * other two modules were left exactly as they were.
 *
 * <p>🔴 CHANNEL-REPORTED COLUMNS ARE REFUSED, NOT SILENTLY DROPPED ({@code PRD-181.a},
 * {@code API-062.c}). A spreadsheet can never author what the marketplace owns, so supplying
 * one of those columns fails the row rather than being quietly ignored.
 *
 * <p>⚠ THE COLUMN NAMES SHOWN ARE THE RATIFIED ONES, WHICH ARE NOT THE FRAME'S CAPTION. The
 * approved pack lists {@code erp_listing_id}, {@code sellable_sku}, {@code intended_price}
 * and {@code listing_stock}; the CSV contract in {@code ChannelListingCsvService} calls those
 * {@code listing_id}, {@code mapped_sellable_sku}, {@code sale_price} and
 * {@code published_marketplace_stock}. 🔴 A design mock does not rename a ratified interface
 * — printing the mock's names would hand operators a template that fails on every row.
 */

/** The frame's four steps, in its own words. */
const STEPS = ['Upload', 'Validate', 'Review', 'Result'] as const;

/**
 * The importable contract, in the server's order.
 *
 * <p>🔴 Mirrors {@code ChannelListingCsvService.HEADERS} minus {@code READ_ONLY_HEADERS}.
 * Only {@code channel_instance} is required ({@code PRD-195.b}): a Listing may exist before
 * the channel issues an identifier and while it is still unmapped, and demanding either would
 * force the operator to invent data the ERP does not own.
 */
const WRITABLE_COLUMNS = [
  'listing_id', 'channel_instance', 'external_listing_id', 'channel_sku',
  'mapped_sellable_sku', 'intended_title', 'intended_description', 'sale_price',
  'promotion_price', 'promotion_starts_at', 'promotion_ends_at',
  'published_marketplace_stock', 'publication_intent', 'intended_channel_category',
];

const READ_ONLY_COLUMNS = [
  'channel_reported_title', 'listing_status', 'sync_state', 'local_lifecycle', 'last_sync_at',
];

const INVALID_PAGE = 5;
const INVALID_GRID = '60px 1.3fr 1.3fr minmax(0, 2.2fr) 130px';
const REVIEW_GRID = '1.2fr 0.7fr minmax(0, 1.6fr)';

export default function ChannelListingImportPage(): React.JSX.Element {
  const [csv, setCsv] = useState('');
  const [file, setFile] = useState<{ readonly name: string; readonly bytes: number; readonly rows: number; readonly at: string } | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invalidPage, setInvalidPage] = useState(0);

  const step = result ? 4 : plan ? 3 : csv ? 2 : 1;

  const invalid = (plan?.outcomes ?? []).filter((outcome) => outcome.result === 'ERROR');
  /* 🔴 planId is empty when ANY row failed — the server refuses a partial apply. */
  const applicable = plan !== null && plan.errorRows === 0 && plan.planId !== '';

  async function readFile(chosen: File): Promise<void> {
    const text = await readTextFile(chosen);
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    setCsv(text);
    setPlan(null);
    setResult(null);
    setInvalidPage(0);
    setFile({
      name: chosen.name,
      bytes: chosen.size,
      /* Header row excluded. This counts lines in a file; it decides nothing. */
      rows: Math.max(0, lines.length - 1),
      at: new Date().toISOString(),
    });
  }

  async function validate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setPlan(await validateChannelListingImport(csv));
      setInvalidPage(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The file could not be validated.');
    } finally {
      setBusy(false);
    }
  }

  async function apply(): Promise<void> {
    if (!plan || !applicable) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await confirmChannelListingImport(plan.planId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  /** Re-serialises the refusals already on screen. 🔴 No new fact is produced. */
  function downloadInvalid(): void {
    const rows = [
      'row,column,reason,outcome',
      ...invalid.map((o) =>
        [o.rowNumber, o.field ?? '', `"${o.message.replace(/"/g, '""')}"`, outcomeWord(o)].join(','),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'invalid-rows.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const shown = invalid.slice(invalidPage * INVALID_PAGE, invalidPage * INVALID_PAGE + INVALID_PAGE);

  return (
    <div data-testid="listing-import" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      {/* ---------------------------------------------------------------- header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-5)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-heading-ink)', margin: 0, letterSpacing: '-0.01em' }}>
            Import listings
          </h2>
          {/* 🔴 `PRD-185.a` — stated before the operator uploads anything. */}
          <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            CSV import changes ERP intended values only. It never contacts a marketplace.
          </p>
        </div>
        <a
          data-testid="download-template"
          href={channelListingTemplateUrl()}
          style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none', flexShrink: 0 }}
        >
          Download template
        </a>
      </div>

      {/* ------------------------------------------------------------- the stepper */}
      <div data-testid="import-steps" style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {STEPS.map((label, index) => (
          <span
            key={label}
            data-testid={`import-step-${label}`}
            aria-current={index + 1 === step ? 'step' : undefined}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
              background: index + 1 <= step ? 'var(--color-nav-active-parent)' : 'transparent',
              color: index + 1 <= step ? 'var(--color-ink)' : 'var(--color-text-muted)',
            }}
          >
            {index + 1} {label}
          </span>
        ))}
      </div>

      {error && (
        <div role="alert" data-testid="import-error">
          <Card><RefusalState reason={error} /></Card>
        </div>
      )}

      {/* ============================================================ 1 · UPLOAD */}
      {!result && (
        <Card>
          <div data-testid="import-upload" style={{ padding: '20px 22px' }}>
            {file === null ? (
              <div
                style={{
                  border: '1px dashed var(--color-border-control)',
                  borderRadius: 'var(--radius-card)',
                  padding: '26px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                  Drop a CSV file, or choose one
                </div>
                <div data-testid="import-columns" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', lineHeight: 1.65 }}>
                  Columns: {WRITABLE_COLUMNS.join(', ')}. Only <code>channel_instance</code> is
                  required. Channel-reported columns — {READ_ONLY_COLUMNS.join(', ')} — are
                  rejected, not silently dropped.
                </div>
                <label style={{ ...buttonStyle('secondary', 'button'), cursor: 'pointer', marginTop: '4px' }}>
                  Choose file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    data-testid="import-file"
                    aria-label="CSV file"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const chosen = event.target.files?.[0];
                      if (chosen) void readFile(chosen);
                    }}
                  />
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                <div style={{ minWidth: 0 }}>
                  <div data-testid="import-filename" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div data-testid="import-file-meta" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.max(1, Math.round(file.bytes / 1024)).toLocaleString()} KB ·{' '}
                    {file.rows.toLocaleString()} rows · uploaded {formatShortMoment(file.at)}
                  </div>
                </div>
                <label style={{ ...buttonStyle('secondary', 'row-action'), cursor: 'pointer', flexShrink: 0 }}>
                  Replace
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    data-testid="import-replace"
                    aria-label="Replace CSV file"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const chosen = event.target.files?.[0];
                      if (chosen) void readFile(chosen);
                    }}
                  />
                </label>
              </div>
            )}

            {csv !== '' && plan === null && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
                <button type="button" data-testid="import-validate" disabled={busy} onClick={() => void validate()} style={buttonStyle('primary', 'button')}>
                  Validate
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ========================================================== 2 · VALIDATE */}
      {plan && !result && (
        <Card>
          <div data-testid="import-validate-step" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
              {([
                ['valid', 'Valid rows', plan.validRows.toLocaleString()],
                ['invalid', 'Invalid rows', plan.errorRows.toLocaleString()],
                /* ⚠ UNAVAILABLE — the plan reports no "unchanged" tally, and the listing
                   importer never emits a WARNING outcome that could stand in for one. */
                ['no-change', 'No change', '—'],
              ] as const).map(([key, label, value]) => (
                <div key={key} data-testid={`import-tally-${key}`} style={tileStyle}>
                  <div style={columnLabel}>{label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '3px', color: 'var(--color-heading-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <h3 style={sectionHeading}>Validation — invalid rows</h3>

            {invalid.length === 0 ? (
              <EmptyState
                title="Every row is valid"
                guidance="Nothing was rejected. Continue to review what will change locally."
              />
            ) : (
              <>
                <div data-testid="import-invalid-header" style={{ display: 'grid', gridTemplateColumns: INVALID_GRID, gap: '14px', padding: '0 4px 9px', borderBottom: '1px solid var(--color-border-card)' }}>
                  {['Row', 'Listing reference', 'Column', 'Reason', 'Outcome'].map((label) => (
                    <div key={label} style={columnLabel}>{label}</div>
                  ))}
                </div>
                <OperationalRegion>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    {shown.map((outcome) => (
                      <div
                        key={`${outcome.rowNumber}-${outcome.field ?? ''}-${outcome.message}`}
                        className="operational-row"
                        data-testid={`import-invalid-${outcome.rowNumber}`}
                        style={{ display: 'grid', gridTemplateColumns: INVALID_GRID, gap: '14px', alignItems: 'center', padding: '9px 4px' }}
                      >
                        <div style={{ ...cellText, fontVariantNumeric: 'tabular-nums' }}>{outcome.rowNumber}</div>
                        {/* ⚠ UNAVAILABLE — a row outcome carries no listing reference. */}
                        <div data-testid={`import-ref-${outcome.rowNumber}`} style={{ ...cellText, color: 'var(--color-text-demoted)' }}>—</div>
                        <div style={{ ...cellText, fontFamily: 'var(--font-family-mono)', fontSize: '11.5px' }}>{outcome.field ?? '—'}</div>
                        <div style={{ ...cellText, color: 'var(--color-text-primary)' }} title={outcome.message}>{outcome.message}</div>
                        <div style={outcomeCell}>{outcomeWord(outcome)}</div>
                      </div>
                    ))}
                  </div>
                </OperationalRegion>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-divider-light)' }}>
                  <div data-testid="import-invalid-range" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', fontVariantNumeric: 'tabular-nums' }}>
                    {invalidPage * INVALID_PAGE + 1}–{invalidPage * INVALID_PAGE + shown.length} of{' '}
                    {invalid.length} invalid rows
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button" data-testid="import-download-invalid" onClick={downloadInvalid} style={buttonStyle('secondary', 'row-action')}>
                      Download invalid rows
                    </button>
                    <button
                      type="button"
                      data-testid="import-invalid-next"
                      disabled={(invalidPage + 1) * INVALID_PAGE >= invalid.length}
                      onClick={() => setInvalidPage((current) => current + 1)}
                      style={buttonStyle('secondary', 'row-action')}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ============================================================ 3 · REVIEW */}
      {plan && !result && (
        <Card>
          <div data-testid="import-review-step" style={{ padding: '20px 22px' }}>
            <h3 style={{ ...sectionHeading, marginTop: 0 }}>Review — what will change locally</h3>

            <div data-testid="import-review-header" style={{ display: 'grid', gridTemplateColumns: REVIEW_GRID, gap: '14px', padding: '0 4px 9px', borderBottom: '1px solid var(--color-border-card)' }}>
              {['Field', 'Rows', 'Notes'].map((label) => (
                <div key={label} style={columnLabel}>{label}</div>
              ))}
            </div>
            {/*
              ⚠ UNAVAILABLE — the per-field breakdown has no source. `validate` returns
              planId, validRows, errorRows and per-row outcomes; the planned rows themselves
              are not serialised, so no honest count of "how many rows change the price"
              exists. 🔴 Deriving one from the raw CSV in the browser would second-guess the
              server's own plan and could disagree with what confirm actually writes.
            */}
            <div data-testid="import-review-unavailable" style={{ paddingTop: '10px' }}>
              <EmptyState
                title="A per-field breakdown is not available"
                guidance="Validation reports the row tallies and every refusal, but not which fields each accepted row changes. The totals below state what applying will do."
              />
            </div>

            {/* ------------------------------------------------- consequence */}
            <div data-testid="import-consequence" style={{ marginTop: 'var(--space-5)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                Apply {plan.validRows.toLocaleString()} rows to ERP intended data?
              </div>
              {/* 🔴 `PRD-185.a` — said again at the point of action. */}
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Accepted rows will be marked with unsent local changes. No marketplace is
                contacted by this step.
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-demoted)', lineHeight: 1.65 }}>
                Rows without a Sellable Product mapping are accepted and stay unmapped
                (<code>PRD-178</code>). Rows with no external listing ID are accepted as
                ERP-first drafts. A supplied mapping must resolve to exactly one Sellable
                Product for that channel SKU, and Trioloo never maps a row by matching titles.
              </div>

              {!applicable && (
                <div data-testid="import-apply-blocked" style={{ marginTop: '4px' }}>
                  <RefusalState
                    kind="refusal"
                    reason={`This file cannot be applied while ${plan.errorRows.toLocaleString()} rows are invalid. The import is all-or-nothing: correct the rejected rows and validate again.`}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: '6px' }}>
                <Link to="/inventory/products/listings" style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}>
                  Cancel
                </Link>
                <button
                  type="button"
                  data-testid="import-apply"
                  disabled={busy || !applicable}
                  onClick={() => void apply()}
                  style={buttonStyle('primary', 'button')}
                >
                  Apply changes
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================ 4 · RESULT */}
      {result && (
        <Card>
          <div data-testid="import-result" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ ...sectionHeading, marginTop: 0 }}>Result · import {result.planId}</h3>
            <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {(result.created + result.updated).toLocaleString()} rows applied ·{' '}
              {result.updated.toLocaleString()} listings now carry unsent local changes ·{' '}
              {result.created.toLocaleString()} drafts created without an external listing ID
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: '6px' }}>
              <Link data-testid="import-view-listings" to="/inventory/products/listings" style={{ ...buttonStyle('secondary', 'button'), textDecoration: 'none' }}>
                View affected listings
              </Link>
              {/*
                🔴 PRESENT AND INERT. The frame offers "Review & Push" here, but batch push
                review is FRAME 18 and is BLOCKED until a production ChannelAdapterPort
                exists (`LSC-051`). Rendering it as working would promise an outbound path
                this system does not have.
              */}
              <button type="button" data-testid="import-review-push" disabled style={buttonStyle('secondary', 'button')}>
                Review &amp; Push — unavailable
              </button>
            </div>
            <p data-testid="import-push-footnote" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', margin: '4px 0 0', lineHeight: 1.65 }}>
              Pushing to marketplaces stays a separate, reviewed action.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * The frame's two refusal words.
 *
 * <p>⚠ A read-only column is REJECTED — the file asked for something the contract forbids.
 * Anything else that fails validation is SKIPPED — the row was understood and could not be
 * used. Both come from the server's own outcome; neither is inferred from the message.
 */
function outcomeWord(outcome: ImportOutcome): string {
  return outcome.field !== null && READ_ONLY_COLUMNS.includes(outcome.field) ? 'REJECTED' : 'SKIPPED';
}

const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
  minWidth: 0,
};

const sectionHeading: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--color-heading-ink)',
  margin: 'var(--space-6) 0 12px',
};

const tileStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-card-small)',
  padding: '11px 13px',
  minWidth: 0,
};

const cellText: React.CSSProperties = {
  fontSize: '12.5px',
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
  minWidth: 0,
};
