import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'pending' | 'confirmed' | 'dispatched' | 'cancelled';

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
}): React.JSX.Element {
  const colors = {
    neutral: ['var(--color-status-neutral-bg)', 'var(--color-status-neutral-fg)'],
    pending: ['var(--color-status-pending-bg)', 'var(--color-status-pending-fg)'],
    confirmed: ['var(--color-status-confirmed-bg)', 'var(--color-status-confirmed-fg)'],
    dispatched: ['var(--color-status-dispatched-bg)', 'var(--color-status-dispatched-fg)'],
    cancelled: ['var(--color-status-cancelled-bg)', 'var(--color-status-cancelled-fg)'],
  } satisfies Record<BadgeTone, readonly [string, string]>;
  const [background, color] = colors[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '22px',
        padding: '0 10px',
        borderRadius: '999px',
        background,
        color,
        fontSize: '12px',
        fontWeight: 650,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/*
  🔴 `toneForStatus` REMOVED 2026-08-23. It resolved a colour by testing whether a status name
  CONTAINED `cancel`, `fail`, `deliver` or `ship` — resemblance matching, which `RULE 3.14.a.a`
  prohibits outright: "A STATE TAKES THE ROLE ITS MEANING DESERVES, NEVER THE ROLE IT
  RESEMBLES". It also coloured `CANCELLED` as a failure, against `RULE 3.3.c`, which reserves
  canonical red for destructive ACTION semantics in three enumerated placements — an order state
  is none of them, and cancellation is a fully authorised business outcome (`OM §6.4`).

  ✅ Replaced by `ORDER_LIFECYCLE_ROLE` in `src/design/semanticRole.ts`, the one source of
  semantic-role truth (`RULE 3.3.d`), where every state cites the meaning `OM §6.2` gives it.
*/

export function BlockedMarker({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '24px',
        padding: '0 11px',
        borderRadius: '999px',
        border: '1px dashed var(--color-text-demoted)',
        color: 'var(--color-text-muted)',
        background: 'var(--color-surface)',
        fontSize: '12px',
        fontWeight: 650,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
