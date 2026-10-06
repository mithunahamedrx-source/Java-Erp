import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UTILITY_ICON, UTILITY_ICON_SIZE, UTILITY_ICON_STROKE } from '../shell/icons';
import { fetchNotifications, fetchSummary, markAllViewed, markViewed, timeAgo } from './notificationApi';
import type { NotificationItem, NotificationSummary } from './notificationApi';
import { toneFor } from './notificationPresentation';

/**
 * The header bell and its panel - drawn from the owner's design reference: a 380px panel under the bell, "Notifications"
 * with a dark "View all" and a light "Mark read", then rows of dot - title / note - time.
 *
 * <p>🔴 The bell is a DOORWAY, never the record (`NOT-001`): history, dismissal and live conditions live in the Center.
 * It refreshes every 30 seconds while the ERP is open (V1 "live" is bounded by what the application can know,
 * `SYS-100`). A failed read shows nothing rather than a wrong number, and never breaks the header.
 */
const POLL_MS = 30_000;

export default function NotificationBell({ buttonStyle }: { readonly buttonStyle: React.CSSProperties }): React.JSX.Element {
  const BellIcon = UTILITY_ICON.notifications;
  const navigate = useNavigate();
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [recent, setRecent] = useState<readonly NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await fetchSummary();
      if (typeof next?.unread === 'number') setSummary(next);
    } catch {
      /* A failed read must not change the header; the next poll tries again. */
    }
  }, []);

  const loadRecent = useCallback(async (): Promise<void> => {
    try {
      const list = await fetchNotifications(false, 6);
      setRecent(Array.isArray(list) ? list : []);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    void loadRecent();
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, loadRecent]);

  const unread = summary?.unread ?? 0;
  const attention = (summary?.conditions ?? []).reduce((sum, c) => sum + c.count, 0);

  const openItem = (item: NotificationItem): void => {
    void markViewed(item.id).finally(() => void refresh());
    setOpen(false);
    if (item.orderId) navigate(`/sales/orders/${item.orderId}`);
  };

  const readAll = (): void => {
    void markAllViewed().finally(() => {
      void refresh();
      void loadRecent();
    });
  };

  const small: React.CSSProperties = {
    height: '28px', padding: '0 9px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }} data-testid="notification-bell-root">
      <button
        type="button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Notifications"
        style={{ ...buttonStyle, position: 'relative' }}
        data-testid="utility-notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon size={UTILITY_ICON_SIZE} strokeWidth={UTILITY_ICON_STROKE} color="var(--color-icon-stroke-header)" aria-hidden="true" />
        {unread > 0 ? (
          <span
            data-testid="notification-badge"
            aria-hidden="true"
            style={{
              position: 'absolute', top: '-4px', right: '-4px', minWidth: '17px', height: '17px', padding: '0 4px',
              borderRadius: '999px', background: 'var(--color-destructive)', color: '#FFFFFF', border: '1.5px solid #FFFFFF',
              fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : attention > 0 ? (
          <span
            data-testid="notification-dot"
            aria-hidden="true"
            style={{ position: 'absolute', top: '7px', right: '8px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-destructive)', border: '1.5px solid #FFFFFF' }}
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          data-testid="notification-popover"
          style={{
            position: 'absolute', right: 0, top: '44px', width: '380px', zIndex: 50, background: '#FFFFFF', padding: '12px',
            border: '1px solid var(--color-border-card)', borderRadius: '12px', boxShadow: '0 18px 45px oklch(0 0 0 / 0.14)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 850 }}>Notifications{unread > 0 ? ` · ${unread} unread` : ''}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                data-testid="notification-open-center"
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                style={{ ...small, background: 'var(--color-ink)', border: 'none', color: '#FFFFFF' }}
              >
                View all
              </button>
              <button
                type="button"
                data-testid="notification-mark-read"
                onClick={readAll}
                disabled={unread === 0}
                style={{ ...small, background: '#FFFFFF', border: '1px solid var(--color-border-control)', color: 'var(--color-text-primary)', opacity: unread === 0 ? 0.5 : 1 }}
              >
                Mark read
              </button>
            </div>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: '14px 4px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }} data-testid="notification-empty">
              Nothing new.{attention > 0 ? ` ${attention} item${attention === 1 ? '' : 's'} need attention - open View all.` : ''}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
              {recent.map((item) => {
                const tone = toneFor(item.typeCode);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    data-testid="notification-popover-item"
                    onClick={() => openItem(item)}
                    style={{
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '10px', width: '100%', minHeight: '50px',
                      padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border-card)', textAlign: 'left', cursor: 'pointer',
                      fontFamily: 'inherit', background: item.viewedAt ? '#FFFFFF' : 'var(--color-status-neutral-bg)',
                    }}
                  >
                    <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: tone.dot }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '12.5px', fontWeight: item.viewedAt ? 600 : 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                      {item.body ? <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.body}</span> : null}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}>{timeAgo(item.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
