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

export function toneForStatus(status: string | null | undefined): BadgeTone {
  const normalized = (status ?? '').toLowerCase();
  if (normalized.includes('cancel') || normalized.includes('fail') || normalized.includes('return')) {
    return 'cancelled';
  }
  if (normalized.includes('deliver') || normalized.includes('confirm')) {
    return 'confirmed';
  }
  if (normalized.includes('ship') || normalized.includes('dispatch') || normalized.includes('ready')) {
    return 'dispatched';
  }
  if (normalized.includes('pending') || normalized.includes('hold') || normalized.includes('pack')) {
    return 'pending';
  }
  return 'neutral';
}

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
