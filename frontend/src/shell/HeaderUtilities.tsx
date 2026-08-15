import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { CHEVRON_SIZE, CHEVRON_STROKE, DISCLOSURE_GLYPH, DISCLOSURE_ROTATION, UTILITY_ICON, UTILITY_ICON_SIZE, UTILITY_ICON_STROKE } from './icons';

/**
 * The ONE header utility cluster — Chat · Notifications · User/Profile (`UX-017`).
 *
 * <p>`UX-017` places these to the RIGHT of the vertical divider in the page header, exactly as
 * `04-page-header.png`, `OD` and `ODT` do. 🔴 Chat and Notifications are header utilities and
 * are NEVER sidebar destinations.
 *
 * <p>`RULE 3.8.a` keeps Chat and Notifications on the white utility surface while User/Profile
 * renders as the compact ink identity control. Every icon-only control carries an `aria-label`,
 * so nothing is identified by shape alone.
 *
 * <p>🔴 ENTRY POINTS ONLY. The Chat and Notification modules are not implemented. No unread
 * count, badge, dot or state is rendered, because no canonical data exists and inventing one
 * would be fabricating business meaning.
 */
export default function HeaderUtilities(): React.JSX.Element {
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRootRef = useRef<HTMLDivElement | null>(null);
  const user = session.status === 'authenticated' ? session.user : null;

  const ChatIcon = UTILITY_ICON.chat;
  const BellIcon = UTILITY_ICON.notifications;
  const Chevron = DISCLOSURE_GLYPH;

  /*
    🔴 THE OPERATOR'S OWN NAME, NEVER AN IDENTIFIER. The display name is what a person
    recognises as themselves; a username is a fallback and the UUID is never shown at all
    (`RULE 3.8.a.c.b`). Nothing here is hard-coded.
  */
  const displayName = user?.fullName?.trim() || user?.username?.trim() || 'Account';
  const initials = user?.fullName?.trim()
    ? user.fullName.trim().slice(0, 2).toUpperCase()
    : user?.username?.trim()?.slice(0, 2).toUpperCase() ?? '··';

  const utilityButton: React.CSSProperties = {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: 'none',
    background: 'var(--color-surface)',
    boxShadow: 'var(--elevation-card)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'var(--color-ink)',
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: 'inherit',
  };

  /*
    🔴 `RULE 3.8.a.c` v2.13.0 — THE ACCOUNT CARD. The whole card is the trigger, not the
    chevron: a 14px glyph is not a hit target, and an operator reaching for their own account
    aims at their name. Superseded: the avatar-only button.
  */
  const accountCard: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    height: '40px',
    padding: '0 8px 0 2px',
    borderRadius: '999px',
    border: 'none',
    background: 'var(--color-surface)',
    boxShadow: 'var(--elevation-card)',
    cursor: 'pointer',
    flexShrink: 0,
    minWidth: 0,
    fontFamily: 'inherit',
  };

  /*
    🔴 `RULE 3.8.a` — THE AVATAR IS UNCHANGED and is carried INTO the card, not replaced by
    it: 36px, true circle, ink fill, white initials, thin neutral ring. v2.12.0's geometry is
    preserved exactly; only what sits beside it is new.
  */
  const avatar: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '1px solid var(--color-avatar-ring)',
    background: 'var(--color-ink)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'var(--color-surface)',
    fontSize: '11.5px',
    fontWeight: 700,
  };

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const dismissOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && profileRootRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };

    const dismissOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', dismissOnOutsidePointer);
    document.addEventListener('keydown', dismissOnEscape);

    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePointer);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [menuOpen]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }} data-testid="utility-cluster">
      <button type="button" aria-label="Chat" title="Chat" style={utilityButton} data-testid="utility-chat">
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
        style={utilityButton}
        data-testid="utility-notifications"
      >
        <BellIcon
          size={UTILITY_ICON_SIZE}
          strokeWidth={UTILITY_ICON_STROKE}
          color="var(--color-icon-stroke-header)"
          aria-hidden="true"
        />
      </button>

      <div ref={profileRootRef} style={{ position: 'relative' }} data-testid="profile-control-root">
        {/*
          §3.8 - the authenticated identity control is the 36px ink avatar with its ring, so
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
          style={accountCard}
        >
          <span aria-hidden="true" data-testid="account-avatar" style={avatar}>{initials}</span>
          {/*
            ⚠ ONE LINE, AND IT TRUNCATES. A long name ellipsises inside its own maximum width
            so the avatar and the chevron stay visible and the header never wraps because of
            who is signed in (`RULE 3.8.a.c.c`).
          */}
          <span
            data-testid="account-name"
            style={{
              maxWidth: '132px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {displayName}
          </span>
          {/*
            🔴 ONE GLYPH, ROTATED — the shared disclosure convention, never a text caret.
            It turns on the SAME state as the menu, so the two can never disagree.
          */}
          <Chevron
            data-testid="account-chevron"
            className="state-transition"
            size={CHEVRON_SIZE}
            strokeWidth={CHEVRON_STROKE}
            color="var(--color-icon-stroke-header)"
            aria-hidden="true"
            style={{
              flexShrink: 0,
              transform: menuOpen ? DISCLOSURE_ROTATION.open : DISCLOSURE_ROTATION.closed,
            }}
          />
        </button>

        {menuOpen && (
          // §3.19 anchored action menu - no scrim, control boundary, overlay elevation.
          <div
            role="menu"
            data-testid="profile-menu"
            className="overlay-enter"
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
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
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
