import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from './Sidebar';
import HeaderUtilities from './HeaderUtilities';
import PageContentTransition from './PageContentTransition';
import { PageActionsProvider, usePublishedPageActions } from './PageActions';

/**
 * The authenticated application shell.
 *
 * <p>Composition is the approved one: fixed 216px sidebar + scrolling `<main>`
 * (`§4.2`, `UX-010`). 🔴 There is NO separate global application header — `RULE 4.1`
 * resolves the 64px token to the sidebar brand block, and the page header is a
 * content-region pattern that scrolls with content (`RULE 4.1.a`, `RULE 4.1.b`).
 */
export default function AppShell(): React.JSX.Element {
  const { session } = useAuth();
  const user = session.status === 'authenticated' ? session.user : null;

  return (
    <PageActionsProvider>
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--color-app-background)' }}>
      <Sidebar permissions={user?.permissions ?? []} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/*
          The scrolling content region. `erp-scroll` is the ONE shared scrollbar treatment -
          chrome hidden, scrolling entirely intact.

          PageContentTransition is the application content BOUNDARY: everything outside it -
          sidebar, brand, user card, header utilities - is stable shell and never animates.
        */}
        <main
          className="erp-scroll"
          data-testid="content-region"
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px var(--content-gutter) 64px' }}
        >
          <div
            data-testid="main-workspace"
            style={{
              width: '100%',
              minWidth: 'var(--workspace-min-width)',
              maxWidth: 'var(--content-max-width)',
              margin: '0 auto',
            }}
          >
            <PageContentTransition>
              <Outlet />
            </PageContentTransition>
          </div>
        </main>
      </div>
    </div>
    </PageActionsProvider>
  );
}

/**
 * The page header — title, subtitle, actions, and the utility cluster.
 *
 * <p>`UX-017` — the utility region carries Chat, Notifications and User/Profile, to the
 * RIGHT of the vertical divider, exactly as `04-page-header.png`, `OD` and `ODT` place them.
 * 🔴 Chat and Notifications are NOT sidebar destinations.
 *
 * <p>`RULE 7.8.a` — this is a page title/meta/action REGION, so it may reflow. That is
 * emphatically not licence to wrap an operational row (`RULE 7.8.b`).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  badge,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: React.ReactNode;
  /**
   * The trail above the title, on a surface reached FROM another one.
   *
   * <p>⚠ It is a slot rather than a `string[]`: a breadcrumb segment is a LINK on every
   * surface that has one, and a component that took strings would either drop the links or
   * invent a routing convention this shell does not own.
   */
  readonly breadcrumb?: React.ReactNode;
  /** An inline state badge beside the title — `RULE 7.8.a` permits it in the title REGION. */
  readonly badge?: React.ReactNode;
}): React.JSX.Element {
  // UX-016.b - a surface may pass actions directly, or publish them from a nested route via
  // usePageActions. The header renders whichever exists; it never learns which module sent it.
  const published = usePublishedPageActions();
  const pageActions = actions ?? published;

  return (
    <div
      data-testid="page-header"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-8)',
        // Page REGION - reflow is permitted here and only here.
        flexWrap: 'nowrap',
        marginBottom: 'var(--space-8)',
      }}
    >
      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        {breadcrumb && (
          <div
            data-testid="page-header-breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              marginBottom: '8px',
            }}
          >
            {breadcrumb}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0 }}>
          <h1
            style={{
              fontSize: '25px',
              lineHeight: '32px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--color-heading-ink)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <div style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            {subtitle}
          </div>
        )}
      </div>
      {/*
        §3.8 - `14px` between clusters, and the ratified `1px x 28px` separator sits BETWEEN
        ACTIONS AND UTILITY. 🔴 UX-016: two regions with two owners sharing one row. The
        separator is what keeps a module's buttons from reading as shell furniture.
      */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'nowrap', flexShrink: 0 }}>
        {pageActions && (
          <div
            data-testid="page-header-actions"
            // §3.8 - `10px` within a button pair. Never wraps: RULE 7.4 applies to the header
            // action group as much as to an operational row.
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap' }}
          >
            {pageActions}
          </div>
        )}
        <span
          data-testid="header-utility-divider"
          style={{ width: '1px', height: '28px', background: 'var(--color-divider-vertical)', flexShrink: 0 }}
        />
        <HeaderUtilities />
      </div>
    </div>
  );
}
