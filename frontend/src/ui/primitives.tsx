import type { ReactNode } from 'react';

/**
 * Global UI primitives, composed only from ratified Design Constitution values.
 *
 * <p>🔴 Deliberately small. This is the set the shell and future modules actually need —
 * not a component library. No business-specific component appears here.
 */

/* ------------------------------------------------------------------ Buttons (§3.11) */

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

/**
 * `RULE 3.11.a` — the destructive button is a SEMANTIC VARIANT of the primary: identical
 * height, padding, radius, weight and label size, fill only. There is no destructive
 * geometry system.
 *
 * <p>`RULE 3.3.c` — destructive red is permitted in exactly three placements. This is one
 * of them; it is never used for emphasis or for an ordinary primary action.
 */
export function Button({
  children,
  variant = 'secondary',
  onClick,
  type = 'button',
  disabled = false,
  size = 'button',
}: {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly size?: 'button' | 'row-action' | 'page-header';
}): React.JSX.Element {
  const height =
    size === 'row-action'
      ? 'var(--control-height-row-action)'
      : size === 'page-header'
        ? 'var(--control-height-page-header-button)'
        : 'var(--control-height-button)';

  const base: React.CSSProperties = {
    height,
    padding: size === 'page-header' ? '0 18px' : '0 16px',
    borderRadius: size === 'page-header' ? '10px' : 'var(--radius-control)',
    fontSize: size === 'page-header' ? '13.5px' : '13px',
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const byVariant: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: 'var(--color-ink)', border: 'none', color: 'var(--color-surface)', fontWeight: 700 },
    secondary: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-secondary-button)',
      color: 'var(--color-secondary-text)',
      fontWeight: 600,
    },
    destructive: {
      background: 'var(--color-destructive)',
      border: 'none',
      color: 'var(--color-surface)',
      fontWeight: 700,
    },
    ghost: { background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontWeight: 500 },
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...byVariant[variant] }}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------- Form controls (§3.18) */

/** `§3.18` — 34px, radius 9px, 13px text, and the ENABLED form boundary. */
export function TextInput({
  value,
  onChange,
  placeholder,
  invalid = false,
  disabled = false,
  id,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly id?: string;
}): React.JSX.Element {
  return (
    <input
      id={id}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      style={controlStyle(invalid, disabled)}
    />
  );
}

export function Select({
  value,
  onChange,
  children,
  invalid = false,
  disabled = false,
  id,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly id?: string;
}): React.JSX.Element {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={{ ...controlStyle(invalid, disabled), padding: '0 10px' }}
    >
      {children}
    </select>
  );
}

/**
 * `RULE 3.18.e` — DISABLED is deliberately LIGHTER than enabled, because SC 1.4.11 exempts
 * inactive components. It is never darkened for symmetry, and its text stays readable.
 */
function controlStyle(invalid: boolean, disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    height: 'var(--control-height-form)',
    borderRadius: 'var(--radius-control)',
    padding: '0 12px',
    fontSize: '13px',
    fontFamily: 'inherit',
    background: disabled ? 'var(--color-divider-light)' : 'var(--color-surface)',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    border: `1px solid ${
      disabled
        ? 'var(--color-border-control)'
        : invalid
          ? 'var(--color-destructive)'
          : 'var(--color-border-form-control)'
    }`,
  };
}

/**
 * Label · helper · error, in the ratified hierarchy.
 *
 * <p>🔴 `RULE 3.18.f` — the error MESSAGE and MARKER are mandatory, not decoration: the
 * boundary colour change alone measures only 2.19 against rest and is not a sufficient
 * signal. Colour is never the only cue.
 */
export function Field({
  label,
  htmlFor,
  required = false,
  helper,
  error,
  children,
}: {
  readonly label: string;
  readonly htmlFor?: string;
  readonly required?: boolean;
  readonly helper?: string;
  readonly error?: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          display: 'block',
          fontSize: '11.5px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-destructive)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error ? (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <ErrorMarker />
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-destructive)' }}>{error}</span>
        </div>
      ) : (
        helper && (
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            {helper}
          </div>
        )
      )}
    </div>
  );
}

/** Outline-only marker (`RULE 3.17` — no filled icons anywhere). */
export function ErrorMarker(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        width: '13px',
        height: '13px',
        borderRadius: '50%',
        border: '1.5px solid var(--color-destructive)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        lineHeight: 1,
        fontWeight: 800,
        color: 'var(--color-destructive)',
        flexShrink: 0,
      }}
    >
      !
    </span>
  );
}

/* -------------------------------------------------------------- Status (§3.3, §3.14) */

export type StatusTone = 'pending' | 'confirmed' | 'dispatched' | 'cancelled' | 'neutral';

/**
 * `RULE 8.4` — colour is never the sole carrier of meaning. A status pill always pairs its
 * colour with a WORD, and exactly five status colours exist (`RULE 3.3.a`).
 */
export function StatusPill({
  tone,
  children,
}: {
  readonly tone: StatusTone;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        fontSize: '12px',
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: '999px',
        whiteSpace: 'nowrap',
        background: `var(--color-status-${tone}-bg)`,
        color: `var(--color-status-${tone}-fg)`,
      }}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Surfaces (§3.10) */

export function Card({
  children,
  title,
  footer,
}: {
  readonly children: ReactNode;
  readonly title?: string;
  readonly footer?: ReactNode;
}): React.JSX.Element {
  return (
    <section
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-card)',
        overflow: 'hidden',
      }}
    >
      {title && (
        <div
          style={{
            height: '58px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 22px',
            borderBottom: '1px solid var(--color-divider-inner)',
          }}
        >
          <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-heading-ink)', margin: 0 }}>
            {title}
          </h3>
        </div>
      )}
      {children}
      {footer && (
        <div
          style={{
            padding: '14px 22px',
            background: 'var(--color-strip)',
            borderTop: '1px solid var(--color-divider-light)',
          }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------- Segmented control (§3.13) */

/**
 * `RULE 8.6.c` — the permanently-present ink-filled active segment is what identifies this
 * control and its state (17.33:1). Inactive segments deliberately carry no boundary, which
 * is why the container hairline needs no remediation.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        border: '1px solid var(--color-border-control)',
        borderRadius: 'var(--radius-control)',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        width: 'fit-content',
        flexShrink: 0,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: active ? 600 : 500,
              fontFamily: 'inherit',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: active ? 'var(--color-ink)' : 'transparent',
              color: active ? 'var(--color-surface)' : 'var(--color-text-muted)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- States */

/** `UX-140` — nine distinct states. These are the three the shell needs today. */
export function LoadingState({ label = 'Loading…' }: { readonly label?: string }): React.JSX.Element {
  return (
    <div style={{ padding: 'var(--space-8)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{label}</div>
  );
}

export function EmptyState({
  title,
  guidance,
}: {
  readonly title: string;
  readonly guidance: string;
}): React.JSX.Element {
  return (
    <div style={{ padding: '48px var(--space-8)', textAlign: 'center' }}>
      <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>{title}</div>
      {/* UX-140 - an empty dataset gets GUIDANCE, not a shrug. */}
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>{guidance}</div>
    </div>
  );
}

/**
 * `UX-141` — failures are never collapsed into "Something went wrong". Where the
 * architecture supplies a deterministic reason it is preserved, and 🔴 `UX-102`/`TEC-083`
 * make a business REFUSAL a correct outcome, never styled as a malfunction.
 */
export function RefusalState({
  reason,
  kind = 'error',
}: {
  readonly reason: string;
  readonly kind?: 'error' | 'refusal' | 'forbidden';
}): React.JSX.Element {
  const heading =
    kind === 'forbidden' ? 'You do not have authority for this' : kind === 'refusal' ? 'This is not permitted' : 'That did not complete';
  return (
    <div style={{ padding: 'var(--space-8)' }} role="alert">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <ErrorMarker />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-destructive)' }}>{heading}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', marginTop: 'var(--space-2)' }}>{reason}</div>
    </div>
  );
}
