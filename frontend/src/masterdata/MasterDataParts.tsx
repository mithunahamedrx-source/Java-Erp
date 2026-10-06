import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../platform/api';
import { ActionMenu } from '../ui/Overlay';
import type { MenuAction } from '../ui/Overlay';

/**
 * The master-data workspace archetype, drawn from the owner's design reference (`warehouses:*`, `suppliers:*`): a strip of
 * summary cards, a search with filter dropdowns, a list of CARDS (never a table) - title and meta line, four labelled
 * columns, a state pill and a row menu - and a numbered pager. Shared by Warehouses, Stock Locations and Suppliers so
 * the three read as one family.
 *
 * <p>🔴 Rows never wrap structurally (`RULE 7.4`); only the title flexes and truncates. A figure that cannot be derived
 * yet is left out rather than shown as zero (`UX-080`).
 */

export type Kpi = { readonly key: string; readonly label: string; readonly value: string | number };

export function KpiStrip({ kpis }: { readonly kpis: readonly Kpi[] }): React.JSX.Element {
  return (
    <div
      data-testid="master-kpis"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(kpis.length, 1)}, minmax(0, 1fr))`, gap: '14px', marginBottom: '16px' }}
    >
      {kpis.map((k) => (
        <div
          key={k.key}
          data-testid={`master-kpi-${k.key}`}
          style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-card)', boxShadow: 'var(--elevation-card)', minWidth: 0 }}
        >
          <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>{k.label}</div>
          <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 850, lineHeight: '26px', marginTop: '4px' }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, testId }: {
  readonly value: string; readonly onChange: (v: string) => void; readonly placeholder: string; readonly testId: string;
}): React.JSX.Element {
  return (
    <input
      data-testid={testId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      style={{ height: '34px', width: '320px', flex: '1 1 200px', maxWidth: '42vw', borderRadius: '9px', padding: '0 12px', fontSize: '13px', border: '1px solid var(--color-border-control)', background: 'var(--color-surface)', fontFamily: 'inherit' }}
    />
  );
}

export function FilterSelect({ label, testId, value, onChange, options }: {
  readonly label: string; readonly testId: string; readonly value: string; readonly onChange: (v: string) => void;
  readonly options: readonly (readonly [string, string])[];
}): React.JSX.Element {
  return (
    <select
      data-testid={testId}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ height: '34px', borderRadius: '9px', border: '1px solid var(--color-border-control)', padding: '0 8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)' }}
    >
      <option value="">{label}: all</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Toolbar({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <div data-testid="master-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'nowrap' }}>{children}</div>;
}

const STATE_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  ACTIVE: { bg: 'var(--color-status-confirmed-bg)', fg: 'var(--color-status-confirmed-fg)', label: 'ACTIVE' },
  DRAFT: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)', label: 'DRAFT' },
  SUSPENDED: { bg: 'var(--color-status-pending-bg)', fg: 'var(--color-status-pending-fg)', label: 'SUSPENDED' },
  ARCHIVED: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)', label: 'ARCHIVED' },
  // Purchase-order lifecycle (E-029).
  AWAITING: { bg: 'var(--color-status-pending-bg)', fg: 'var(--color-status-pending-fg)', label: 'AWAITING APPROVAL' },
  APPROVED: { bg: 'var(--color-status-confirmed-bg)', fg: 'var(--color-status-confirmed-fg)', label: 'APPROVED' },
  SENT: { bg: 'var(--color-status-dispatched-bg)', fg: 'var(--color-status-dispatched-fg)', label: 'SENT' },
  PARTIALLY_RECEIVED: { bg: 'var(--color-status-dispatched-bg)', fg: 'var(--color-status-dispatched-fg)', label: 'PARTIALLY RECEIVED' },
  RECEIVED: { bg: 'var(--color-status-confirmed-bg)', fg: 'var(--color-status-confirmed-fg)', label: 'RECEIVED' },
  CLOSED: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)', label: 'CLOSED' },
  CANCELLED: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)', label: 'CANCELLED' },
};

export const stateTone = (state: string): { bg: string; fg: string; label: string } => STATE_TONE[state] ?? STATE_TONE['DRAFT']!;

export type Column = { readonly label: string; readonly value: React.ReactNode };

export function RecordCard({ testId, title, meta, columns, state, stateNote, actions, faded = false }: {
  readonly testId: string;
  readonly title: string;
  readonly meta?: string | null;
  readonly columns: readonly Column[];
  readonly state: string;
  readonly stateNote?: string;
  readonly actions?: readonly MenuAction[];
  /** An archived record stays on the list but is visibly set back; its state and menu stay at full strength. */
  readonly faded?: boolean;
}): React.JSX.Element {
  const tone = STATE_TONE[state] ?? STATE_TONE['DRAFT']!;
  const fade: React.CSSProperties = faded ? { opacity: 0.5 } : {};
  return (
    <div
      data-testid={testId}
      className="operational-row"
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'nowrap', width: '100%', minWidth: 0, boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--elevation-card)', padding: '12px 16px' }}
    >
      <div style={{ flex: '1 1 auto', minWidth: '160px', overflow: 'hidden', ...fade }}>
        <div data-testid="record-title" style={{ fontSize: '14px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {meta ? <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div> : null}
      </div>
      {columns.map((c) => (
        <div key={c.label} style={{ width: '150px', flexShrink: 0, minWidth: 0, ...fade }}>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-demoted)' }}>{c.label}</div>
          <div className="tabular-nums" style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
        </div>
      ))}
      <div style={{ width: '110px', flexShrink: 0, textAlign: 'right' }}>
        <span data-testid="record-state" style={{ display: 'inline-flex', fontSize: '11.5px', fontWeight: 650, padding: '3px 10px', borderRadius: '999px', background: tone.bg, color: tone.fg }}>{tone.label}</span>
        {stateNote ? <div style={{ fontSize: '10.5px', color: 'var(--color-text-demoted)', marginTop: '3px' }}>{stateNote}</div> : null}
      </div>
      {actions && actions.length > 0 ? (
        <ActionMenu label="Actions" trigger="glyph" compact menuWidth="190px" testId="record-menu" triggerTestId="record-actions" actions={actions} />
      ) : <span style={{ width: '34px', flexShrink: 0 }} />}
    </div>
  );
}

export function Pager({ page, totalPages, total, size, onPage }: {
  readonly page: number; readonly totalPages: number; readonly total: number; readonly size: number; readonly onPage: (p: number) => void;
}): React.JSX.Element | null {
  if (total === 0) return null;
  return (
    <div data-testid="master-pager" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px' }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
        Showing {page * size + 1}–{Math.min((page + 1) * size, total)} of {total}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {Array.from({ length: totalPages }, (_, i) => i).slice(0, 12).map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`master-page-${n + 1}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onPage(n)}
            style={{ width: '32px', height: '32px', borderRadius: '9px', fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--color-border-control)', background: n === page ? 'var(--color-ink)' : 'var(--color-surface)', color: n === page ? '#FFFFFF' : 'var(--color-text-muted)' }}
          >
            {n + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FormBox({ label, testId, value, onChange, wide = false, required = false, type = 'text', hint, children }: {
  readonly label: string; readonly testId: string; readonly value: string; readonly onChange: (v: string) => void;
  readonly wide?: boolean; readonly required?: boolean; readonly type?: string; readonly hint?: string; readonly children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px', gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={{ fontWeight: 600 }}>{label}{required ? <span style={{ color: 'var(--color-destructive)' }}> *</span> : null}</span>
      {children ?? (
        <input
          data-testid={testId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)', boxSizing: 'border-box', width: '100%' }}
        />
      )}
      {hint ? <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>{hint}</span> : null}
    </label>
  );
}

/** Reads a list endpoint and keeps its loading, refusal and error states apart (`UX-112`). */
export function useRemoteList<T>(load: () => Promise<T>, deps: readonly unknown[]): {
  readonly data: T | null; readonly loading: boolean; readonly error: string | null; readonly forbidden: boolean; readonly reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const loader = useRef(load);
  loader.current = load;

  const run = useCallback(async (): Promise<void> => {
    setError(null);
    setForbidden(false);
    try {
      setData(await loader.current());
    } catch (cause) {
      if (cause instanceof ApiError && cause.isForbidden) setForbidden(true);
      else setError(cause instanceof Error ? cause.message : 'The list could not be loaded.');
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, forbidden, reload: () => void run() };
}

/** A debounced copy of a typed value, so a search box does not call the server on every keystroke. */
export function useDebounced(value: string, ms = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function messageOf(cause: unknown, fallback: string): string {
  const payload = cause instanceof ApiError ? (cause.payload as { message?: string } | null) : null;
  return payload?.message ?? (cause instanceof Error ? cause.message : fallback);
}
