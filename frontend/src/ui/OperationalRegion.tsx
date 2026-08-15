import type { ReactNode } from 'react';

/**
 * The operational data region in the final workspace model.
 *
 * UX-263 through UX-266 supersede the older component-level horizontal scroller. The region
 * now participates in the one coherent main workspace canvas: it never owns overflow-x, never
 * measures the viewport, and never renders a horizontal-scroll affordance.
 */
export function OperationalRegion({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <div data-testid="operational-region" style={{ width: '100%', minWidth: 0 }}>
      <div data-testid="operational-canvas" style={{ width: '100%', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A structured operational row.
 *
 * UX-060 / RULE 7.4: the row preserves horizontal composition. Flexible identity/prose
 * regions may truncate; the structure does not wrap.
 */
export function OperationalRow({
  children,
  onClick,
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
}): React.JSX.Element {
  return (
    <div
      data-testid="operational-row"
      className="operational-row"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'nowrap',
        minWidth: 0,
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-divider-light)',
      }}
    >
      {children}
    </div>
  );
}

export function RowIdentity({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <div
      data-testid="row-identity"
      style={{
        minWidth: '140px',
        flex: '1 1 auto',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
      }}
    >
      {children}
    </div>
  );
}

/** A value cell. Numeric cells carry tabular figures (Article X). */
export function RowCell({
  children,
  align = 'left',
  numeric = false,
  width,
}: {
  readonly children: ReactNode;
  readonly align?: 'left' | 'right';
  readonly numeric?: boolean;
  readonly width?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        flexShrink: 0,
        textAlign: align,
        ...(width ? { width } : {}),
        fontSize: '13px',
        color: 'var(--color-text-primary)',
        ...(numeric ? { fontVariantNumeric: 'tabular-nums' } : {}),
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

/** Pushes trailing cells (status, actions) to the right without allowing a wrap. */
export function RowSpacer(): React.JSX.Element {
  return <div style={{ flex: 1, minWidth: 'var(--space-3)' }} />;
}
