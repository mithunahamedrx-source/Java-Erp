import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { dismissNotification, fetchNotifications, fetchSummary, markAllViewed, markViewed, timeAgo } from './notificationApi';
import type { NotificationCondition, NotificationItem } from './notificationApi';

/**
 * The Notification Center - the primary operational notification workspace (`NOT-020`).
 *
 * <p>Two different things, kept apart: NOTIFICATIONS (what happened, per-person read / dismiss) and CONDITIONS (what is
 * still true right now - on hold, waiting, a connection needing attention). Nobody dismisses a condition; fixing the
 * state clears it (`NOT-013`). Dismissing a notification hides it for this person only and ends no work (`NOT-015`).
 */
const PRIORITY_TONE: Record<string, { bg: string; fg: string }> = {
  HIGH: { bg: 'var(--color-status-cancelled-bg)', fg: 'var(--color-status-cancelled-fg)' },
  NORMAL: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' },
  LOW: { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' },
};
const NORMAL_TONE = { bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' };

export default function NotificationCenterPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<readonly NotificationItem[]>([]);
  const [conditions, setConditions] = useState<readonly NotificationCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [list, summary] = await Promise.all([fetchNotifications(tab === 'unread', 100), fetchSummary()]);
      setItems(Array.isArray(list) ? list : []);
      setConditions(summary?.conditions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const open = async (item: NotificationItem): Promise<void> => {
    await markViewed(item.id).catch(() => undefined);
    if (item.orderId) navigate(`/sales/orders/${item.orderId}`);
    else void load();
  };

  const unreadCount = items.filter((i) => !i.viewedAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="What happened, and what still needs someone"
        actions={
          <Button variant="secondary" size="page-header" onClick={() => void markAllViewed().then(load)} disabled={unreadCount === 0} testId="mark-all-viewed">
            Mark all as read
          </Button>
        }
      />

      {conditions.length > 0 ? (
        <div data-testid="notification-conditions" style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>NEEDS ATTENTION NOW</div>
          {conditions.map((c) => {
            const tone = PRIORITY_TONE[c.priority] ?? NORMAL_TONE;
            return (
              <Card key={c.code}>
                <div data-testid={`condition-${c.code}`} style={{ padding: '14px 18px', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, minWidth: '32px', textAlign: 'center', padding: '4px 10px', borderRadius: '10px', background: tone.bg, color: tone.fg }}>{c.count}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{c.title}{c.mandatory ? ' · always shown' : ''}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                      {c.items.map((it, index) =>
                        it.orderId ? (
                          <Link key={`${it.reference}-${index}`} to={`/sales/orders/${it.orderId}`} style={{ color: 'inherit', fontWeight: 600 }}>{it.reference}</Link>
                        ) : (
                          <span key={`${it.reference}-${index}`} style={{ fontWeight: 600 }}>{it.reference}</span>
                        ),
                      )}
                      {c.count > c.items.length ? <span>+{c.count - c.items.length} more</span> : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }} role="tablist">
        {(['all', 'unread'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            data-testid={`notification-tab-${t}`}
            onClick={() => setTab(t)}
            style={{
              height: '34px', padding: '0 16px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '13px', fontWeight: 600,
              background: tab === t ? 'var(--color-surface)' : 'transparent',
              boxShadow: tab === t ? 'var(--elevation-card)' : 'none',
              color: 'var(--color-text-primary)',
            }}
          >
            {t === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><EmptyState title="Loading…" guidance="Fetching your notifications." /></Card>
      ) : error ? (
        <Card><EmptyState title="Notifications could not be loaded" guidance={error} /></Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={tab === 'unread' ? 'Nothing unread' : 'No notifications yet'}
            guidance="New orders, delivery problems and returns will appear here as they happen."
          />
        </Card>
      ) : (
        <div data-testid="notification-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.map((item) => {
            const tone = PRIORITY_TONE[item.priority] ?? NORMAL_TONE;
            return (
              <div
                key={item.id}
                data-testid="notification-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: '12px 16px',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border-card)',
                  borderRadius: 'var(--radius-card)', boxShadow: 'var(--elevation-card)',
                }}
              >
                <span aria-hidden="true" style={{ width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0, background: item.viewedAt ? 'transparent' : 'var(--color-ink)', border: item.viewedAt ? '1px solid var(--color-border-control)' : 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: item.viewedAt ? 500 : 700 }}>{item.title}</div>
                  {item.body ? <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{item.body}</div> : null}
                </div>
                {item.priority === 'HIGH' ? (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: tone.bg, color: tone.fg }}>High</span>
                ) : null}
                <span style={{ fontSize: '12px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}>{timeAgo(item.createdAt)}</span>
                {item.orderId ? (
                  <Button variant="secondary" size="row-action" onClick={() => void open(item)} testId="notification-open">Open order</Button>
                ) : null}
                {!item.viewedAt ? (
                  <Button variant="secondary" size="row-action" onClick={() => void markViewed(item.id).then(load)} testId="notification-read">Mark read</Button>
                ) : null}
                {!item.mandatory ? (
                  <Button variant="ghost" size="row-action" onClick={() => void dismissNotification(item.id).then(load)} testId="notification-dismiss">Dismiss</Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
