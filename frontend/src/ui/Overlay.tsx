import { useEffect, useRef, useState } from 'react';
import { Button, ErrorMarker } from './primitives';

/**
 * Confirmation dialog — `§3.19`.
 *
 * <p>`RULE 3.19` — the scrim backs DIALOGS ONLY, is the existing ink at one declared alpha,
 * and is never blurred. `RULE 3.19.a` — the title is a CARD-heading (15.5px/700), never
 * promoted to a page title; prominence comes from the scrim.
 *
 * <p>`RULE 3.19.b` — the consequence is stated before the action is reachable. 🔴 That is a
 * composition rule only: WHICH actions require confirmation is business architecture
 * (`UX-113`) and is not decided here.
 */
export function ConfirmDialog({
  title,
  consequence,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly consequence: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      data-testid="dialog-scrim"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="confirm-dialog"
        style={{
          width: '460px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-card)',
          borderRadius: 'var(--radius-panel)',
          boxShadow: 'var(--elevation-overlay)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 22px 0', display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
          {/* RULE 3.3.c placement 3 - the outline marker beside a destructive title. */}
          {destructive && <ErrorMarker />}
          <div style={{ minWidth: 0 }}>
            <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-heading-ink)', margin: '0 0 8px' }}>
              {title}
            </h4>
            <div style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--color-text-primary)' }}>{consequence}</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            padding: '14px 22px',
            marginTop: 'var(--space-7)',
            background: 'var(--color-strip)',
            borderTop: '1px solid var(--color-divider-inner)',
          }}
        >
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type MenuAction = {
  readonly label: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly separatorBefore?: boolean;
};

/**
 * Anchored action menu — `§3.19`.
 *
 * <p>`RULE 3.19.c` — menu and dialog are SEPARATE surface classes and are never collapsed
 * into a generic overlay component. A menu is anchored, compact, carries no title and no
 * explanation, and 🔴 NEVER carries a scrim.
 */
export function ActionMenu({
  label,
  actions,
}: {
  readonly label: string;
  readonly actions: readonly MenuAction[];
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocumentClick = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="action-menu-trigger"
        style={{
          height: 'var(--control-height-row-action)',
          padding: '0 12px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-secondary-button)',
          borderRadius: 'var(--radius-control)',
          color: 'var(--color-secondary-text)',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        <span
          aria-hidden="true"
          style={{
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '5px solid var(--color-secondary-text)',
            marginTop: '1px',
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="action-menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            width: '216px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-control)',
            borderRadius: 'var(--radius-card-small)',
            boxShadow: 'var(--elevation-overlay)',
            padding: '5px',
            zIndex: 50,
          }}
        >
          {actions.map((action) => (
            <div key={action.label}>
              {action.separatorBefore && (
                <div style={{ height: '1px', background: 'var(--color-divider-inner)', margin: '5px 0' }} />
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: 'var(--radius-control-small)',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  // RULE 3.3.c placement 2 - a destructive menu row is weight 600 in
                  // canonical red. It is never a red-FILLED row; filling belongs to the
                  // confirmation action alone.
                  fontWeight: action.destructive ? 600 : 500,
                  color: action.destructive ? 'var(--color-destructive)' : 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Terminal region — `§3.16`.
 *
 * <p>Count left, controls right, sitting on the page background rather than in a card.
 * 🔴 `RULE 7.3.a` — page size is business behaviour and never changes with viewport or
 * zoom, so nothing here reads the viewport.
 */
export function Pagination({
  total,
  page,
  pageSize,
  onPage,
}: {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly onPage: (page: number) => void;
}): React.JSX.Element {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const cell = (active: boolean): React.CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-control)',
    background: active ? 'var(--color-ink)' : 'var(--color-surface)',
    border: active ? 'none' : '1px solid var(--color-border-control)',
    color: active ? 'var(--color-surface)' : 'var(--color-text-primary)',
    fontWeight: active ? 700 : 400,
    fontFamily: 'inherit',
    cursor: 'pointer',
  });

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-7)' }}
    >
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
        {from}–{to} of {total}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <button type="button" style={cell(false)} onClick={() => onPage(Math.max(1, page - 1))} aria-label="Previous page">
          &#8249;
        </button>
        <button type="button" style={cell(true)} aria-current="page">
          {page}
        </button>
        <button
          type="button"
          style={cell(false)}
          onClick={() => onPage(Math.min(lastPage, page + 1))}
          aria-label="Next page"
        >
          &#8250;
        </button>
      </div>
    </div>
  );
}
