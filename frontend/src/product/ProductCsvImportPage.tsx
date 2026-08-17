import { useState } from 'react';
import { readTextFile } from '../platform/file';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Card, EmptyState, buttonStyle as sharedButtonStyle } from '../ui/primitives';
import type { ImportPlan, ImportResult } from './stockItemApi';

/**
 * THE ONE Product CSV import workflow.
 *
 * <p>🔴 `UX-043` — a DEDICATED consequential workflow PAGE, never a modal, because `UX-151`
 * sends every consequential workflow to a page and a bulk write that can create or update many
 * records is exactly that.
 *
 * <p>Upload → validate → preview → confirm → result. 🔴 Nothing before explicit confirmation
 * mutates anything (`API-060.f`), and the confirmed job commits atomically (`API-060.d`) while
 * still reporting every row (`API-060.c`).
 *
 * <p>⚠ `VALID` / `WARNING` / `ERROR` are IMPORT WORKFLOW results, not Product lifecycle states
 * (`UX-043.b`).
 *
 * <p>🔴 ONE implementation serves every Product CSV contract. `PRD-148` fixes THREE separate
 * contracts — Stock Items, Sellable Products, Listings — but the WORKFLOW is identical for all
 * of them, and a second copy of it would be the place the two silently diverge. The contract
 * differs only in which endpoints are called, which is what this component takes as props.
 */
export default function ProductCsvImportPage({
  title,
  subtitle,
  templateHref,
  backTo,
  backLabel,
  onValidate,
  onConfirm,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly templateHref: string;
  readonly backTo: string;
  readonly backLabel: string;
  readonly onValidate: (csv: string) => Promise<ImportPlan>;
  readonly onConfirm: (planId: string) => Promise<ImportResult>;
}): React.JSX.Element {
  const navigate = useNavigate();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const step = result ? 5 : plan ? 3 : csv ? 2 : 1;

  async function validate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setPlan(await onValidate(csv));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The file could not be validated.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(): Promise<void> {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await onConfirm(plan.planId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <div data-testid="import-steps" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {['Upload', 'Validate', 'Preview', 'Confirm', 'Result'].map((label, index) => (
          <span
            key={label}
            data-testid={`import-step-${label}`}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
              background: index + 1 <= step ? 'var(--color-nav-active-parent)' : 'transparent',
              color: index + 1 <= step ? 'var(--color-ink)' : 'var(--color-text-muted)',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {error && (
        <div role="alert" data-testid="import-error" style={{ marginBottom: 'var(--space-5)' }}>
          <Card>
            <EmptyState title="The import could not continue" guidance={error} />
          </Card>
        </div>
      )}

      {!result && (
        <Card>
          <div style={{ padding: 'var(--space-6)' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
              Upload a CSV using the canonical contract.{' '}
              <a data-testid="download-template" href={templateHref}>
                Download the template
              </a>{' '}
              — it carries the headers only, with no example data.
            </div>

            <input
              type="file"
              accept=".csv,text/csv"
              data-testid="import-file"
              aria-label="CSV file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                setPlan(null);
                void readTextFile(file).then(setCsv);
              }}
            />
            {fileName && (
              <div data-testid="import-filename" style={{ fontSize: '12px', marginTop: 'var(--space-3)' }}>
                {fileName}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              <button
                type="button"
                data-testid="import-validate"
                disabled={!csv || busy}
                onClick={() => void validate()}
                style={buttonStyle(false)}
              >
                Validate
              </button>
              {plan && plan.errorRows === 0 && plan.validRows > 0 && (
                <button
                  type="button"
                  data-testid="import-confirm"
                  disabled={busy}
                  onClick={() => void confirm()}
                  style={buttonStyle(true)}
                >
                  Confirm import of {plan.validRows} row{plan.validRows === 1 ? '' : 's'}
                </button>
              )}
              <Link to={backTo} style={{ ...buttonStyle(false), textDecoration: 'none' }}>
                Cancel
              </Link>
            </div>
          </div>
        </Card>
      )}

      {plan && !result && (
        <div data-testid="import-preview" style={{ marginTop: 'var(--space-6)' }}>
          <Card>
            <div style={{ padding: 'var(--space-6)' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                {plan.validRows} valid · {plan.errorRows} with errors
              </div>
              {plan.errorRows > 0 && (
                <div style={{ fontSize: '12.5px', color: 'var(--color-destructive)', marginBottom: 'var(--space-4)' }}>
                  Nothing has been written. Correct every error and upload the file again.
                </div>
              )}
              <OutcomeList outcomes={plan.outcomes} />
            </div>
          </Card>
        </div>
      )}

      {result && (
        <div data-testid="import-result" style={{ marginTop: 'var(--space-6)' }}>
          <Card>
            <div style={{ padding: 'var(--space-6)' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                Import complete — {result.created} created, {result.updated} updated
              </div>
              <OutcomeList outcomes={result.outcomes} />
              <button
                type="button"
                data-testid="import-done"
                onClick={() => void navigate(backTo)}
                style={{ ...buttonStyle(true), marginTop: 'var(--space-6)' }}
              >
                {backLabel}
              </button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

/** 🔴 Every row is reported, including failures. No row is silently skipped (`UX-043.c`). */
function OutcomeList({ outcomes }: { readonly outcomes: readonly ImportPlan['outcomes'][number][] }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {outcomes.map((outcome) => (
        <div
          key={`${outcome.rowNumber}-${outcome.message}`}
          data-testid={`import-row-${outcome.rowNumber}`}
          className="operational-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'nowrap',
            fontSize: '12.5px',
            padding: '6px 0',
            borderBottom: '1px solid var(--color-divider-light)',
          }}
        >
          <span style={{ width: '64px', flexShrink: 0, color: 'var(--color-text-demoted)' }}>
            Row {outcome.rowNumber}
          </span>
          <span
            style={{
              width: '68px',
              flexShrink: 0,
              fontWeight: 700,
              color: outcome.result === 'ERROR' ? 'var(--color-destructive)' : 'var(--color-text-muted)',
            }}
          >
            {outcome.result}
          </span>
          {outcome.field && (
            <span style={{ width: '150px', flexShrink: 0, fontFamily: 'var(--font-family-mono)' }}>
              {outcome.field}
            </span>
          )}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{outcome.message}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Reads an uploaded file as text.
 *
 * <p>`Blob.text()` is the direct route, but it is absent in some environments; `FileReader` is
 * the universally available fallback. Reading is deliberately the ONLY thing that happens on
 * upload — nothing is sent and nothing is written until Validate is pressed.
 */
function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    ...sharedButtonStyle(primary ? 'primary' : 'secondary', 'button'),
  };
}
