import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { UTILITY_ICON, UTILITY_ICON_SIZE, UTILITY_ICON_STROKE } from './icons';

/**
 * The ONE header utility cluster — Chat · Notifications · User/Profile (`UX-017`).
 *
 * <p>`UX-017` places these to the RIGHT of the vertical divider in the page header, exactly as
 * `04-page-header.png`, `OD` and `ODT` do. 🔴 Chat and Notifications are header utilities and
 * are NEVER sidebar destinations.
 *
 * <p>`RULE 8.11.a` — ghost/utility icon actions carry no boundary and are identified by their
 * icon stroke. All three are `34 × 34px` transparent buttons with a `10px` radius (§3.8), and
 * every icon-only control carries an `aria-label`, so nothing is identified by shape alone.
 *
 * <p>🔴 ENTRY POINTS ONLY. The Chat and Notification modules are not implemented. No unread
 * count, badge, dot or state is rendered, because no canonical data exists and inventing one
 * would be fabricating business meaning.
 */
export default function HeaderUtilities(): React.JSX.Element {
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = session.status === 'authenticated' ? session.user : null;

  const ChatIcon = UTILITY_ICON.chat;
  const BellIcon = UTILITY_ICON.notifications;

  const ghostButton: React.CSSProperties = {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }} data-testid="utility-cluster">
      <button type="button" aria-label="Chat" title="Chat" style={ghostButton} data-testid="utility-chat">
        <ChatIcon
          size={UTILITY_ICON_SIZE}
          strokeWidth={UTILITY_ICON_STROKE}
          color="var(--color-icon-stroke-header)"
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        style={ghostButton}
        data-testid="utility-notifications"
      >
        <BellIcon
          size={UTILITY_ICON_SIZE}
          strokeWidth={UTILITY_ICON_STROKE}
          color="var(--color-icon-stroke-header)"
          aria-hidden="true"
        />
      </button>

      <div style={{ position: 'relative' }}>
        {/*
          §3.8 - the authenticated identity control is the 32px ink avatar with its ring, so
          the operator is identified rather than shown a generic person glyph. The coherent
          profile icon from the same family is used inside the menu.
        */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="User menu"
          data-testid="utility-profile"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--color-ink)',
            boxShadow: '0 0 0 2px var(--color-avatar-ring)',
            border: 'none',
            color: 'var(--color-surface)',
            fontSize: '11.5px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {user?.fullName?.slice(0, 2).toUpperCase() ?? '··'}
        </button>

        {menuOpen && (
          // §3.19 anchored action menu - no scrim, control boundary, overlay elevation.
          <div
            role="menu"
            data-testid="profile-menu"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              width: '216px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-control)',
              borderRadius: 'var(--radius-card-small)',
              boxShadow: 'var(--elevation-overlay)',
              padding: '5px',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '8px 10px' }}>
              <UTILITY_ICON.profile
                size={16}
                strokeWidth={UTILITY_ICON_STROKE}
                color="var(--color-icon-stroke-header)"
                aria-hidden="true"
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {user?.fullName}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>{user?.username}</div>
              </div>
            </div>
            <div style={{ height: '1px', background: 'var(--color-divider-inner)', margin: '5px 0' }} />
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              data-testid="sign-out"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: '32px',
                padding: '0 10px',
                borderRadius: 'var(--radius-control-small)',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'inherit',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
