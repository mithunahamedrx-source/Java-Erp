import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * The operational data region — the one place horizontal overflow is permitted.
 *
 * <p>🔴 `UX-071` — overflow is SCOPED TO THE ROW REGION. The page header, filters, tabs and
 * pagination stay fixed and visible, and the page never becomes a globally horizontally
 * scrolling canvas. That is why this is a container the caller wraps *only* around rows,
 * never around a whole page.
 *
 * <p>`UX-073` — off-viewport content must be DISCOVERABLE, not merely reachable. A
 * persistent affordance appears when the region is actually scrollable, so a truncated row
 * is never visually indistinguishable from a complete one. Silent truncation is the exact
 * failure this rule exists to prevent.
 */
export function OperationalRegion({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) {
      return;
    }

    const measure = (): void => {
      const scrollable = element.scrollWidth > element.clientWidth + 1;
      setOverflowing(scrollable);
      setAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 1);
    };

    measure();
    element.addEventListener('scroll', measure);

    // ResizeObserver keeps the affordance honest when the viewport or zoom changes.
    // 🔴 It observes LAYOUT only. It never changes page size, record count or any request
    // (RULE 7.3.a forbids viewport-driven data behaviour).
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div style={{ position: 'relative' }} data-testid="operational-region">
      {/*
        The shared `erp-scroll` treatment hides the native horizontal scrollbar chrome here
        too - but overflow stays `auto`, so wheel, touchpad, keyboard, drag and programmatic
        scrolling are all intact and no column is clipped away.

        🔴 That is exactly why the UX-073 affordance below is NOT optional: with the
        chrome hidden, it is the discoverability mechanism. It is never removed.
      */}
      <div
        ref={scrollerRef}
        className="erp-scroll"
        data-testid="operational-scroller"
        data-overflowing={overflowing ? 'true' : 'false'}
        style={{ overflowX: 'auto', overflowY: 'hidden' }}
      >
        {children}
      </div>

      {/*
        UX-073 discoverability affordance. Rendered only while genuinely scrollable and not
        yet at the end, so it always means "there is more this way".
      */}
      {overflowing && !atEnd && (
        <div
          aria-hidden="true"
          data-testid="overflow-affordance"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '24px',
            pointerEvents: 'none',
            borderRight: '1px solid var(--color-border-card)',
          }}
        />
      )}
      {overflowing && (
        <div
          data-testid="overflow-notice"
          style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}
        >
          Scroll horizontally to see more columns
        </div>
      )}
    </div>
  );
}

/**
 * A structured operational row.
 *
 * <p>🔴 `UX-060` / `RULE 7.4` — the absolute rule. This row preserves its horizontal
 * composition under ALL viewport and zoom pressure. `Product | Amount | Delivery | Status |
 * Actions` never becomes a stack.
 *
 * <p>`flex-wrap: nowrap` is set HERE, on the row, deliberately and locally. `UX-061`
 * forbids a global `flex-wrap: wrap` responsive solution AND a global
 * `white-space: nowrap` — ordinary prose, descriptions and forms keep normal reflow, which
 * is why neither is applied at the document level anywhere in this codebase.
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
        // 🔴 The rule itself. Never change this to wrap.
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

/**
 * The identity cell — which record this row is.
 *
 * <p>`UX-071` — in a scrolled region the identity column is PINNED, so a horizontally
 * scrolled row never loses which record it belongs to.
 */
export function RowIdentity({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <div
      data-testid="row-identity"
      style={{
        position: 'sticky',
        left: 0,
        zIndex: 1,
        background: 'var(--color-surface)',
        paddingRight: 'var(--space-4)',
        minWidth: '180px',
        flexShrink: 0,
        // Content may ellipsis; the STRUCTURE does not move. These are different concerns
        // (UX-061) and this is the content one.
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
