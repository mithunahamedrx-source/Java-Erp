import type { ReactNode } from 'react';
import { CONNECTION_STATE_ROLE, semanticRoleOf } from '../design/semanticRole';
import type { SemanticTone } from '../ui/primitives';
import type { ConfigurationState, ConnectionState } from './shopApi';

/**
 * The two status carriers the approved pack uses in Shops & Channels.
 *
 * <p>🔴 `SCS-024.b` — CONFIGURATION AND CONNECTION USE TWO DIFFERENT CARRIERS ON PURPOSE:
 * configuration is plain uppercase text, connection is a chip. That is what lets *suspended
 * but connected* and *active but broken* both read correctly in one row. Rendering them alike
 * would collapse the distinction the whole contract is built on.
 *
 * <p>🔴 THE COLOURS ARE THE GLOBAL ONES. Every value below resolves through
 * `design/semanticRole.ts` to a `RULE 3.3.d` token. There is no Shops-local palette and no
 * hard-coded hue anywhere in this module (`SCS-024.e`).
 *
 * <p>⚠ THE GEOMETRY IS THE APPROVED PACK'S, WHICH IS WHY THIS IS NOT `StatusPill`. The pack's
 * connection chip is a 20px, 5px-radius, small-caps marker; the shared pill is a larger fully
 * rounded one. The Screen Contract's preamble leaves chip FORM to the approved design, so this
 * composes the pack's form from the global tokens rather than restyling a primitive that
 * Listings and every other module already depend on.
 */

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  CONNECTED: 'CONNECTED',
  REAUTH_REQUIRED: 'REAUTHORIZATION REQUIRED',
  NOT_CONNECTED: 'NOT CONNECTED',
  ERROR: 'CONNECTION ERROR',
};

/**
 * `SCS-043` — the four conditions, plus the unreadable presentation state.
 *
 * <p>🔴 `connection === null` IS NOT A FIFTH CONDITION. It says Integration had no answer, and
 * the chip says exactly that in the approved words rather than showing `NOT CONNECTED`, which
 * would be a different and false claim (`SYS-034`).
 */
export function ConnectionChip({ connection }: { readonly connection: ConnectionState | null }): React.JSX.Element {
  const unknown = connection === null;
  const tone: SemanticTone = unknown ? 'neutral' : semanticRoleOf(CONNECTION_STATE_ROLE, connection);
  const label = unknown ? 'CONNECTION UNAVAILABLE' : CONNECTION_LABEL[connection];

  return (
    <span
      data-testid="connection-chip"
      data-connection={connection ?? 'UNAVAILABLE'}
      data-tone={tone}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '20px',
        padding: '0 8px',
        borderRadius: '5px',
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        // 🔴 RULE 7.8.b — an operational row never wraps. The chip keeps its line.
        whiteSpace: 'nowrap',
        /*
          🔴 UNRESOLVED MUST NOT LOOK RESOLVED. `SCS-043.a` — "unavailable" is not a
          condition, it is the ABSENCE of one, so the approved design draws it UNFILLED with
          a DASHED boundary while every real condition is filled and solid. Rendering it as
          an ordinary neutral chip made it visually indistinguishable from NOT CONNECTED,
          which is a real state and a different claim.
          ⚠ Still the global neutral tokens — the difference is form, not a new colour.
        */
        background: unknown ? 'transparent' : `var(--color-semantic-${tone}-bg)`,
        border: `1px ${unknown ? 'dashed' : 'solid'} var(--color-semantic-${tone}-border)`,
        color: `var(--color-semantic-${tone}-fg)`,
      }}
    >
      {/* ⚠ RULE 8.4 — a SUPPORTING cue only. The word beside it is always present. */}
      <span
        aria-hidden="true"
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          /* ⚠ Hollow where nothing is known, filled where a condition actually is. */
          background: unknown ? 'transparent' : 'currentColor',
          border: unknown ? '1px solid currentColor' : undefined,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

/**
 * `SCS-024.b` — configuration as PLAIN UPPERCASE TEXT, with no container and no semantic
 * colour of its own.
 *
 * <p>🔴 Deliberately not a chip. See `CONFIGURATION_STATE_ROLE` for why all four states are
 * neutral: two coloured carriers in one row would compete, and the contract needs them not to.
 */
export function ConfigurationText({
  configuration,
}: {
  readonly configuration: ConfigurationState;
}): React.JSX.Element {
  return (
    <span
      data-testid="configuration-text"
      data-configuration={configuration}
      style={{
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      {configuration}
    </span>
  );
}

/**
 * `SCS-041` — the external link, which is a SECOND remote fact and never the identity.
 *
 * <p>🔴 NAVIGATION ONLY. It is never used for binding or for the mismatch test, and it may be
 * absent even on a bound shop, because not every channel exposes one.
 *
 * <p>⚠ `SCS-024.c` — where nothing is bound the cell states `Not yet bound` rather than
 * rendering an empty space, so absence is a fact the operator can read.
 */
export function ExternalLinkCell({
  externalLink,
  bound,
}: {
  readonly externalLink: string | null;
  readonly bound: boolean;
}): React.JSX.Element {
  if (!externalLink) {
    return (
      <span data-testid="external-link" style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
        {bound ? 'No link published' : 'Not yet bound'}
      </span>
    );
  }
  return (
    <a
      data-testid="external-link"
      href={externalLink}
      target="_blank"
      // Denies the opened page any handle on this one.
      rel="noreferrer noopener"
      onClick={(event) => event.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12.5px',
        fontWeight: 600,
        color: 'var(--color-heading-ink)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      Visit link
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M6 3h7v7M13 3 4 12" />
      </svg>
    </a>
  );
}

/** The column geometry, shared by the header and every row so they cannot drift apart. */
export const SHOP_ROW_COLUMNS = 'minmax(0,1.85fr) 1fr 0.85fr 200px minmax(0,1.3fr) 30px';

/** A column label — the pack's small-caps header treatment. */
export function ColumnLabel({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: '10.5px',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}
