import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UTILITY_ICON, UTILITY_ICON_SIZE, UTILITY_ICON_STROKE } from '../shell/icons';
import { fetchNotifications, fetchSummary, markViewed, timeAgo } from './notificationApi';
import type { NotificationItem, NotificationSummary } from './notificationApi';

/**
 * The header bell: an unread count and a short list, with the Notification Center one click away.
 *
 * <p>🔴 The bell is a DOORWAY, never the record (`NOT-001`): dismissing, history and conditions live in the Center. It
 * refreshes every 30 seconds while the ERP is open (V1 "live" is bounded by what the application can know, `SYS-100`).
 * A failed read shows nothing rather than a wrong number - and never breaks the header.
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

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    void (async () => {
      try {
        const list = await fetchNotifications(false, 6);
        setRecent(Array.isArray(list) ? list : []);
      } catch {
        setRecent([]);
      }
    })();
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
  }, [open]);

  const unread = summary?.unread ?? 0;
  const attention = (summary?.conditions ?? []).reduce((sum, c) => sum + c.count, 0);

  const openItem = (item: NotificationItem): void => {
    void markViewed(item.id).finally(() => void refresh());
    setOpen(false);
    if (item.orderId) navigate(`/sales/orders/${item.orderId}`);
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
              borderRadius: '999px', background: 'var(--color-ink)', color: 'var(--color-surface)',
              fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : attention > 0 ? (
          <span
            data-testid="notification-dot"
            aria-hidden="true"
            style={{ position: 'absolute', top: '-1px', right: '-1px', width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-ink)' }}
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          data-testid="notification-popover"
          style={{
            position: 'absolute', right: 0, top: '42px', width: '340px', zIndex: 50, background: 'var(--color-surface)',
            border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--elevation-card)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, borderBottom: '1px solid var(--color-border-card)' }}>
            Notifications{unread > 0 ? ` · ${unread} unread` : ''}
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: '18px 14px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }} data-testid="notification-empty">
              Nothing new.{attention > 0 ? ` ${attention} item${attention === 1 ? '' : 's'} need attention - open the Notification Center.` : ''}
            </div>
          ) : (
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  data-testid="notification-popover-item"
                  onClick={() => openItem(item)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                    borderBottom: '1px solid var(--color-border-card)', cursor: 'pointer', fontFamily: 'inherit',
                    background: item.viewedAt ? 'var(--color-surface)' : 'var(--color-status-neutral-bg)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: item.viewedAt ? 500 : 700, color: 'var(--color-text-primary)' }}>{item.title}</div>
                  {item.body ? <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{item.body}</div> : null}
                  <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', marginTop: '3px' }}>{timeAgo(item.createdAt)}</div>
                </button>
              ))}
            </div>
          )}
          <Link
            to="/notifications"
            data-testid="notification-open-center"
            onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '11px 14px', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'none', textAlign: 'center' }}
          >
            Open Notification Center
          </Link>
        </div>
      ) : null}
    </div>
  );
}
