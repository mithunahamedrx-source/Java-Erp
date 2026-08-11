import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from './Sidebar';
import HeaderUtilities from './HeaderUtilities';
import PageContentTransition from './PageContentTransition';

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
          style={{ flex: 1, overflowY: 'auto', padding: '24px var(--content-gutter) 64px' }}
        >
          <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
            <PageContentTransition>
              <Outlet />
            </PageContentTransition>
          </div>
        </main>
      </div>
    </div>
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
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-8)',
        // Page REGION - reflow is permitted here and only here.
        flexWrap: 'wrap',
        marginBottom: 'var(--space-8)',
      }}
    >
      <div>
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
        {subtitle && (
          <div style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
        {actions}
        <span style={{ width: '1px', height: '28px', background: 'var(--color-divider-vertical)' }} />
        <HeaderUtilities />
      </div>
    </div>
  );
}
