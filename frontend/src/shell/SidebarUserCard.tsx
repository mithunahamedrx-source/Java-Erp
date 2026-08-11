import { useAuth } from '../auth/AuthContext';

/**
 * The ONE authenticated identity card, fixed at the bottom of the sidebar.
 *
 * <p>§3.7 — padding `8px`, margin `0 8px 10px`, radius `10px`, gap `8px`, avatar `26px`. It is
 * `flex-shrink: 0` inside the sidebar's flex column, so it stays pinned while only the
 * navigation region above scrolls. It never scrolls away.
 *
 * <p>🔴 Every value shown comes from the authenticated session. NOTHING is hard-coded — there
 * is no `Rakib Ahmed`, no `Call Centre Agent` and no sample identity anywhere in this file.
 *
 * <p>🔴 The operational TITLE (designation) lives on `E-090`, the HR extension of `E-077`, and
 * is not exposed by the current session endpoint. Role codes are shown instead because they
 * ARE authoritative session data; a job title is never fabricated to fill the line. When the
 * session exposes no roles, the line is simply absent.
 *
 * <p>Identity DISPLAY only. Account interaction stays with the ratified header User/Profile
 * utility (`UX-017`), so the shell offers no competing account control.
 */
export default function SidebarUserCard(): React.JSX.Element {
  const { session } = useAuth();
  const user = session.status === 'authenticated' ? session.user : null;

  const roleLine = user && user.roles.length > 0 ? user.roles.join(' · ') : null;
  const initials = user?.fullName?.slice(0, 2).toUpperCase() ?? '··';

  return (
    <div
      data-testid="sidebar-user-card"
      style={{
        flexShrink: 0,
        padding: '8px',
        margin: '0 8px 10px',
        borderRadius: 'var(--radius-card-small)',
        background: 'var(--color-user-block)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'var(--color-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10.5px',
          fontWeight: 700,
          color: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          data-testid="sidebar-user-name"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user?.fullName ?? '—'}
        </div>
        {roleLine && (
          <div
            data-testid="sidebar-user-roles"
            style={{
              fontSize: '10.5px',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {roleLine}
          </div>
        )}
      </div>
    </div>
  );
}
