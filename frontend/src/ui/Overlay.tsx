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
  busy = false,
  error,
  width = '460px',
  testId = 'confirm-dialog',
  children,
  footerLead,
  confirmDisabled = false,
  confirmDisabledReason,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly consequence: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  /** While an operation is running: actions are blocked and Escape no longer dismisses. */
  readonly busy?: boolean;
  /** A concise failure, shown in place rather than by closing the dialog. */
  readonly error?: string | null;
  readonly width?: string;
  readonly testId?: string;
  /** `RULE 3.19.b` — detail that belongs ABOVE the footer, e.g. a before/after table. */
  readonly children?: React.ReactNode;
  /**
   * An optional SIDEWAYS action, rendered at the footer's leading edge.
   *
   * ⚠ For a route OUT of the decision — "create the thing you could not find" — not a third
   * way to complete it. 🔴 The footer still carries exactly one primary; anything passed here
   * must read as tertiary, or the dialog stops having one obvious action.
   */
  readonly footerLead?: React.ReactNode;
  /**
   * The action EXISTS and the operator is authorised, but a precondition is not met.
   *
   * <p>🔴 Distinct from {@link busy}, which is temporary, and from a permission denial, which
   * OMITS the action entirely rather than advertising authority the operator lacks.
   */
  readonly confirmDisabled?: boolean;
  /**
   * 🔴 Why, in one sentence, rendered as VISIBLE TEXT in the footer and associated with the
   * action via `aria-describedby`. A `title` tooltip would be unreachable by keyboard and
   * unavailable to a screen reader that does not announce it.
   */
  readonly confirmDisabledReason?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const reasonId = `${testId}-disabled-reason`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 🔴 Focus is RESTORED to whatever opened the dialog, so the operator's place in a long
    // comparison is not lost when they cancel.
    restoreTo.current = document.activeElement as HTMLElement | null;
    // Initial focus lands on the confirm action — the last control in the footer.
    const actions = panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    actions?.[actions.length - 1]?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // ⚠ An operation already in flight cannot be un-started by closing the dialog, so
        // Escape is ignored while it runs rather than implying it was cancelled.
        if (!busy) {
          onCancel();
        }
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) {
        return;
      }
      // Focus trap: the background is inert while a modal is open.
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  return (
    <div
      data-testid="dialog-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        zIndex: 100,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        style={{
          width,
          maxWidth: '100%',
          // The dialog itself scrolls if the content is tall, so the footer is never clipped.
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-control)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--elevation-overlay)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 20px 14px', display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', overflowY: 'auto', minHeight: 0 }}>
          {/* RULE 3.3.c placement 3 - the outline marker beside a destructive title. */}
          {destructive && <ErrorMarker />}
          <div style={{ minWidth: 0, width: '100%' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-heading-ink)', margin: '0 0 8px' }}>
              {title}
            </h4>
            {/* 🔴 RULE 3.19.b - the consequence is stated before the action is reachable. */}
            <div style={{ fontSize: '12.5px', lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
              {consequence}
            </div>
            {children}
            {error && (
              <div data-testid="dialog-error" style={{ fontSize: '12px', color: 'var(--color-destructive)', marginTop: '10px', lineHeight: 1.5 }}>
                {error}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '13px 20px',
            background: 'var(--color-strip)',
            borderTop: '1px solid var(--color-divider-inner)',
            flexShrink: 0,
          }}
        >
          {/* ⚠ Holds the leading edge even when empty, so the actions never drift left. */}
          <div style={{ minWidth: 0 }}>
            {footerLead}
            {confirmDisabled && confirmDisabledReason && (
              <div
                id={reasonId}
                data-testid={`${testId}-disabled-reason`}
                style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}
              >
                {confirmDisabledReason}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '9px', flexShrink: 0 }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            describedBy={confirmDisabled && confirmDisabledReason ? reasonId : undefined}
            testId={`${testId}-confirm`}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
          </div>
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
  /**
   * 🔴 A DIMMED item — the operation exists and the operator may perform it, but a
   * precondition or a channel capability is not met. Always paired with {@link reason}.
   *
   * <p>⚠ This is NOT how a permission denial is presented: an unauthorised action is OMITTED
   * from the list entirely, because a disabled control still advertises authority the
   * operator does not have.
   */
  readonly disabled?: boolean;
  /** The one-line explanation shown under a dimmed item. */
  readonly reason?: string;
  /** The item the menu exists to offer, given the row's state. */
  readonly emphasis?: boolean;
  readonly testId?: string;
};

/**
 * Anchored action menu — `§3.19`.
 *
 * <p>`RULE 3.19.c` — menu and dialog are SEPARATE surface classes and are never collapsed
 * into a generic overlay component. A menu is anchored, compact, carries no title and no
 * explanation, and 🔴 NEVER carries a scrim.
 *
 * <p>Keyboard: Escape closes and returns focus to the trigger; Up/Down move between items;
 * Home/End jump to the ends. A dimmed item is skipped by arrow navigation and cannot be
 * activated.
 *
 * <p>The panel flips above the trigger when there is not enough room below, so a menu on the
 * last row is never clipped by the viewport.
 */
export function ActionMenu({
  label,
  actions,
  trigger = 'button',
  note,
  menuWidth = '216px',
  testId = 'action-menu',
  triggerTestId = 'action-menu-trigger',
  triggerAriaLabel,
}: {
  readonly label: string;
  readonly actions: readonly MenuAction[];
  /** `glyph` renders the compact ⋯ affordance a dense operational row uses. */
  readonly trigger?: 'button' | 'glyph';
  /** A trailing one-line note, e.g. why an operation is absent for this role. */
  readonly note?: string;
  readonly menuWidth?: string;
  readonly testId?: string;
  readonly triggerTestId?: string;
  readonly triggerAriaLabel?: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocumentClick = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /**
   * Collision handling. The panel's real height is MEASURED after it mounts rather than
   * estimated from the item count — reason lines and separators make an estimate run low,
   * and a menu that is merely flush with the fold is already too close.
   */
  useEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) {
      return;
    }
    const trigger = triggerRef.current.getBoundingClientRect();
    const height = menuRef.current.getBoundingClientRect().height;
    const MARGIN = 12;
    const roomBelow = window.innerHeight - trigger.bottom - MARGIN;
    const roomAbove = trigger.top - MARGIN;
    // Flip up when it does not fit below; if it fits neither way, take the roomier side.
    setFlipUp(height > roomBelow && roomAbove > roomBelow);
    menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open, actions.length, note]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []),
    ];
    if (items.length === 0) {
      return;
    }
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0, justifySelf: trigger === 'glyph' ? 'end' : undefined }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerAriaLabel ?? (trigger === 'glyph' ? label : undefined)}
        onClick={(event) => {
          // 🔴 Opening a row menu must never change the row's selection.
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        data-testid={triggerTestId}
        style={
          trigger === 'glyph'
            ? {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: 'var(--radius-control-small)',
                border: 'none',
                background: open ? 'var(--color-divider-light)' : 'transparent',
                color: 'var(--color-placeholder)',
                fontWeight: 700,
                fontSize: '15px',
                lineHeight: 1,
                fontFamily: 'inherit',
                cursor: 'pointer',
                padding: 0,
              }
            : {
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
              }
        }
      >
        {trigger === 'glyph' ? '⋯' : label}
        {trigger === 'button' && (
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
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          data-testid={testId}
          onKeyDown={moveFocus}
          style={{
            position: 'absolute',
            right: 0,
            // Anchored to the trigger, and never covering the row it belongs to.
            top: flipUp ? undefined : 'calc(100% + 6px)',
            bottom: flipUp ? 'calc(100% + 6px)' : undefined,
            width: menuWidth,
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
                <div style={{ height: '1px', background: 'var(--color-divider-inner)', margin: '5px 8px' }} />
              )}
              <button
                type="button"
                role="menuitem"
                data-testid={action.testId}
                disabled={action.disabled}
                aria-disabled={action.disabled}
                onClick={() => {
                  if (action.disabled) {
                    return;
                  }
                  setOpen(false);
                  action.onSelect();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-control-small)',
                  border: 'none',
                  // The item the menu exists to offer, given this row's state.
                  background: action.emphasis ? 'var(--color-nav-active-child)' : 'transparent',
                  fontSize: '12.5px',
                  // RULE 3.3.c placement 2 - a destructive menu row is weight 600 in
                  // canonical red. It is never a red-FILLED row; filling belongs to the
                  // confirmation action alone.
                  fontWeight: action.emphasis ? 700 : action.destructive ? 600 : 600,
                  color: action.disabled
                    ? 'var(--color-placeholder)'
                    : action.destructive
                      ? 'var(--color-destructive)'
                      : 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                  cursor: action.disabled ? 'default' : 'pointer',
                  textAlign: 'left',
                }}
              >
                {action.label}
              </button>
              {action.disabled && action.reason && (
                <div style={{ padding: '0 10px 8px', fontSize: '10.5px', color: 'var(--color-placeholder)', lineHeight: 1.4 }}>
                  {action.reason}
                </div>
              )}
            </div>
          ))}
          {note && (
            <div data-testid="action-menu-note" style={{ padding: '2px 10px 8px', fontSize: '10.5px', color: 'var(--color-placeholder)', lineHeight: 1.4 }}>
              {note}
            </div>
          )}
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
