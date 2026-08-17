import type { ReactNode } from 'react';

/**
 * Global UI primitives, composed only from ratified Design Constitution values.
 *
 * <p>🔴 Deliberately small. This is the set the shell and future modules actually need —
 * not a component library. No business-specific component appears here.
 */

/* ------------------------------------------------------------------ Buttons (§3.11) */

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'button' | 'row-action' | 'page-header';

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
  describedBy,
  testId,
}: {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly size?: ButtonSize;
  /** ⚠ Points at VISIBLE text — a disabled action's reason is never tooltip-only. */
  readonly describedBy?: string;
  readonly testId?: string;
}): React.JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedBy}
      data-testid={testId}
      style={buttonStyle(variant, size, disabled)}
    >
      {children}
    </button>
  );
}

export function buttonStyle(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'button',
  disabled = false,
): React.CSSProperties {
  const height =
    size === 'row-action'
      ? 'var(--control-height-row-action)'
      : size === 'page-header'
        ? 'var(--control-height-page-header-button)'
        : 'var(--control-height-button)';

  const base: React.CSSProperties = {
    height,
    /*
      🔴 `RULE 3.11.d` v2.13.0 — COMPACT. The page-header action was the largest control in
      the ERP at 40px tall with 18px of side padding, which read as prominence bought with
      geometry. Prominence comes from FILL, POSITION and LABEL; the button is only its label's
      container. Superseded: height 40px, padding `0 18px`, font 13.5px.

      ⚠ Still a comfortable desktop target: 36px tall is the shared button height, not a
      shrunken one, and the label stays at a readable 13px.
    */
    padding: size === 'page-header' ? '0 13px' : '0 16px',
    borderRadius: size === 'page-header' ? '9px' : 'var(--radius-control)',
    fontSize: '13px',
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const byVariant: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'var(--color-ink)',
      border: 'none',
      boxShadow: 'var(--elevation-card)',
      color: 'var(--color-surface)',
      fontWeight: 700,
    },
    secondary: {
      background: 'var(--color-surface)',
      border: 'none',
      boxShadow: 'var(--elevation-card)',
      color: 'var(--color-secondary-text)',
      fontWeight: 600,
    },
    destructive: {
      background: 'var(--color-destructive)',
      border: 'none',
      color: 'var(--color-surface)',
      fontWeight: 700,
    },
    ghost: { background: 'transparent', border: 'none', boxShadow: 'none', color: 'var(--color-text-muted)', fontWeight: 500 },
  };

  /*
    🔴 A SOLID OR DARK FILL REPRESENTS AN EXECUTABLE ACTION. A disabled button therefore
    NEVER keeps its variant's fill: a black "Push unavailable" reads as the one thing on the
    surface the operator is meant to press, and the word "unavailable" is doing all the work
    of contradicting it.

    ✅ The treatment is the SHARED neutral disabled vocabulary the form controls already use
    — light neutral surface, restrained neutral border, muted text — so a disabled action and
    a disabled input are recognisably the same condition.

    ⚠ Elevation goes with the fill. A raised neutral button still reads as pressable.

    ⚠ `ghost` has no fill to remove and stays transparent; it is muted by its own variant.
  */
  const whenDisabled: React.CSSProperties = variant === 'ghost'
    ? { boxShadow: 'none' }
    : {
        background: 'var(--color-divider-light)',
        border: '1px solid var(--color-border-control)',
        boxShadow: 'none',
        color: 'var(--color-text-muted)',
      };

  return { ...base, ...byVariant[variant], ...(disabled ? whenDisabled : {}) };
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
 * The SEMANTIC ROLE vocabulary — `RULE 3.3.d`.
 *
 * <p>🔴 A ROLE, NOT A COLOUR. A caller names what a state MEANS and never which hue it wants;
 * the role resolves to an existing `§3.3` pair (`RULE 3.3.b`), so no feature ever hard-codes
 * a semantic colour and a future palette decision changes one token rather than every screen.
 *
 * <p>⚠ `neutral` IS A REAL ANSWER, not the absence of one. An ordinary state — `DRAFT`,
 * `Not connected`, `ARCHIVED` — is neutral BECAUSE it is unremarkable, and colouring it would
 * assert a significance it does not have (`RULE 3.3.d.d`).
 */
export type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * `RULE 8.4` — colour is never the sole carrier of meaning. A status pill always pairs its
 * colour with a WORD, and exactly five status colours exist (`RULE 3.3.a`).
 *
 * <p>✅ It accepts EITHER vocabulary: the `§3.3` order statuses, or a `RULE 3.3.d` semantic
 * role. ⚠ Both resolve to the same five pairs — the second is a name for the ROLE, not a
 * sixth colour.
 */
export function StatusPill({
  tone,
  children,
  dot = false,
}: {
  readonly tone: StatusTone | SemanticTone;
  readonly children: ReactNode;
  /** ⚠ An optional SUPPORTING cue. `RULE 8.4` keeps the word mandatory regardless. */
  readonly dot?: boolean;
}): React.JSX.Element {
  const semantic = SEMANTIC_TONES.includes(tone as SemanticTone);
  const family = semantic ? 'semantic' : 'status';
  return (
    <span
      data-tone={tone}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? '6px' : undefined,
        fontSize: '12px',
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: '999px',
        whiteSpace: 'nowrap',
        background: `var(--color-${family}-${tone}-bg)`,
        color: `var(--color-${family}-${tone}-fg)`,
        /*
          🔴 `RULE 3.3.d.f` — the restrained reference treatment is a SOFT TINT plus a 1px
          semantic boundary, never a saturated fill. ⚠ Only the semantic vocabulary takes the
          border; the `§3.3` order pills keep their approved borderless form unchanged.
        */
        border: semantic ? `1px solid var(--color-semantic-${tone}-border)` : undefined,
      }}
    >
      {dot && (
        /* ⚠ A SECOND non-textual cue, never the only one — the label is always present. */
        <span
          aria-hidden="true"
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

const SEMANTIC_TONES: readonly SemanticTone[] = ['success', 'warning', 'danger', 'info', 'neutral'];

/**
 * A meaningful operational message — `RULE 3.3.d.b`.
 *
 * <p>🔴 FOR MESSAGES THAT CARRY CONSEQUENCE: what succeeded, what needs attention, what
 * failed, what the operator should understand before acting. ⚠ ORDINARY DESCRIPTIVE OR HELPER
 * TEXT IS NOT A NOTICE and stays plain — colouring every paragraph would make the colour mean
 * nothing (`RULE 3.3.b`).
 *
 * <p>🔴 `RULE 8.4` — the tone is NEVER the only signal. A `title` is REQUIRED and names the
 * condition in words, so the message survives being read in monochrome, by a screen reader,
 * or by someone who cannot distinguish the hues.
 *
 * <p>⚠ Restrained by construction: a soft tint, a 1px boundary and coloured text. No filled
 * panel, no gradient, no icon-only signalling.
 */
export function Notice({
  tone,
  title,
  children,
  testId,
}: {
  readonly tone: SemanticTone;
  /** 🔴 REQUIRED. The condition in words — the non-colour carrier `RULE 8.4` demands. */
  readonly title: string;
  readonly children?: ReactNode;
  readonly testId?: string;
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      data-tone={tone}
      /*
        ⚠ `status` rather than `alert`: these report a condition the operator reads, they do
        not interrupt. An assertive live region would talk over the work that produced it.
      */
      role="status"
      style={{
        background: `var(--color-semantic-${tone}-bg)`,
        border: `1px solid var(--color-semantic-${tone}-border)`,
        borderRadius: 'var(--radius-card-small)',
        padding: '10px 13px',
        fontSize: '12.5px',
        lineHeight: 1.6,
        color: `var(--color-semantic-${tone}-fg)`,
      }}
    >
      <strong style={{ fontWeight: 700 }}>{title}</strong>
      {children && <div style={{ marginTop: '3px' }}>{children}</div>}
    </div>
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
