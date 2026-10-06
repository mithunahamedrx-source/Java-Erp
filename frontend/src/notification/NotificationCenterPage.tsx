import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, Card, EmptyState } from '../ui/primitives';
import { dismissNotification, fetchNotifications, fetchSummary, markAllViewed, markViewed, timeAgo } from './notificationApi';
import type { NotificationCondition, NotificationItem } from './notificationApi';
import { CENTER_FILTERS, matchesFilter, moduleFor, toneFor } from './notificationPresentation';
import type { CenterFilter } from './notificationPresentation';

/**
 * The Notification Center - the primary operational notification workspace (`NOT-020`), laid out as the owner's design
 * reference draws `notifications:all`: four summary cards, a search and a segmented filter, a card list (dot - title,
 * module badge - note - time), a 320px column of "needs attention now" on the right, and a numbered pager.
 *
 * <p>Two different things, kept apart: NOTIFICATIONS (what happened, per-person read / dismiss) and CONDITIONS (what is
 * still true right now - on hold, waiting, a connection needing attention). Nobody dismisses a condition; fixing the state
 * clears it (`NOT-013`). Dismissing a notification hides it for this person only and ends no work (`NOT-015`).
 */
const PAGE_SIZE = 10;

export default function NotificationCenterPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [items, setItems] = useState<readonly NotificationItem[]>([]);
  const [conditions, setConditions] = useState<readonly NotificationCondition[]>([]);
  const [filter, setFilter] = useState<CenterFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [list, summary] = await Promise.all([fetchNotifications(false, 200), fetchSummary()]);
      setItems(Array.isArray(list) ? list : []);
      setConditions(summary?.conditions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => matchesFilter(item, filter)
      && (!q || `${item.title} ${item.body ?? ''} ${moduleFor(item.typeCode)}`.toLowerCase().includes(q)));
  }, [items, filter, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const unread = items.filter((i) => !i.viewedAt).length;
  const high = items.filter((i) => i.priority === 'HIGH').length;
  const attention = conditions.reduce((sum, c) => sum + c.count, 0);
  const today = items.filter((i) => new Date(i.createdAt).toDateString() === new Date().toDateString()).length;

  const open = async (item: NotificationItem): Promise<void> => {
    await markViewed(item.id).catch(() => undefined);
    if (item.orderId) navigate(`/sales/orders/${item.orderId}`);
    else void load();
  };

  const kpis: readonly { key: string; label: string; value: number; note: string; tone: string; go: () => void }[] = [
    { key: 'unread', label: 'UNREAD', value: unread, note: 'Not opened yet', tone: 'var(--color-status-dispatched-fg)', go: () => { setFilter('unread'); setPage(1); } },
    { key: 'attention', label: 'NEEDS ATTENTION', value: attention, note: 'True right now', tone: 'var(--color-status-pending-fg)', go: () => undefined },
    { key: 'high', label: 'HIGH PRIORITY', value: high, note: 'Delivery and returns', tone: 'var(--color-status-cancelled-fg)', go: () => { setFilter('high'); setPage(1); } },
    { key: 'today', label: 'TODAY', value: today, note: 'Arrived today', tone: 'var(--color-status-confirmed-fg)', go: () => { setFilter('all'); setPage(1); } },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <>
            <Button variant="secondary" size="page-header" onClick={() => void load()} testId="notification-refresh">Refresh</Button>
            <Button variant="primary" size="page-header" onClick={() => void markAllViewed().then(load)} disabled={unread === 0} testId="mark-all-viewed">
              Mark all read
            </Button>
          </>
        }
      />

      <div data-testid="notification-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '16px' }}>
        {kpis.map((k) => (
          <button
            key={k.key}
            type="button"
            data-testid={`notification-kpi-${k.key}`}
            onClick={k.go}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '11px', minHeight: '86px', padding: '13px 14px', borderRadius: '12px',
              background: '#FFFFFF', border: '1px solid var(--color-border-card)', boxShadow: 'var(--elevation-card)',
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span aria-hidden="true" style={{ width: '9px', height: '9px', borderRadius: '50%', background: k.tone, marginTop: '5px', flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>{k.label}</span>
              <span className="tabular-nums" style={{ display: 'block', fontSize: '22px', fontWeight: 850, lineHeight: '26px', marginTop: '4px' }}>{k.value}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>{k.note}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <input
          data-testid="notification-search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Search notification, module or reference"
          aria-label="Search notifications"
          style={{
            height: '34px', width: '360px', maxWidth: '42vw', borderRadius: '9px', padding: '0 12px', fontSize: '13px',
            border: '1px solid var(--color-border-control)', background: '#FFFFFF', fontFamily: 'inherit',
          }}
        />
        <div role="tablist" style={{ display: 'flex', gap: '3px', padding: '4px', borderRadius: '10px', background: '#FFFFFF', border: '1px solid var(--color-border-card)' }}>
          {CENTER_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              data-testid={`notification-filter-${f.id}`}
              onClick={() => { setFilter(f.id); setPage(1); }}
              style={{
                height: '28px', padding: '0 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '12.5px', fontWeight: 650,
                background: filter === f.id ? 'var(--color-ink)' : 'transparent',
                color: filter === f.id ? '#FFFFFF' : 'var(--color-text-primary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '16px', alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          {loading ? (
            <Card><EmptyState title="Loading…" guidance="Fetching your notifications." /></Card>
          ) : error ? (
            <Card><EmptyState title="Notifications could not be loaded" guidance={error} /></Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                title={items.length === 0 ? 'No notifications yet' : 'Nothing matches these filters'}
                guidance={items.length === 0
                  ? 'New orders, delivery problems and returns will appear here as they happen.'
                  : 'Clear the search or choose All to see everything.'}
              />
            </Card>
          ) : (
            <div data-testid="notification-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rows.map((item) => {
                const tone = toneFor(item.typeCode);
                return (
                  <div
                    key={item.id}
                    data-testid="notification-row"
                    style={{
                      display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '12px', alignItems: 'start', minHeight: '82px',
                      padding: '14px 16px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid var(--color-border-card)',
                      boxShadow: 'var(--elevation-card)',
                    }}
                  >
                    <span aria-hidden="true" style={{ width: '9px', height: '9px', borderRadius: '50%', background: tone.dot, marginTop: '6px', opacity: item.viewedAt ? 0.35 : 1 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: item.viewedAt ? 650 : 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: tone.bg, color: tone.fg, whiteSpace: 'nowrap' }}>{moduleFor(item.typeCode)}</span>
                      </div>
                      {item.body ? <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{item.body}</div> : null}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        {item.orderId ? <Button variant="secondary" size="row-action" onClick={() => void open(item)} testId="notification-open">Open order</Button> : null}
                        {!item.viewedAt ? <Button variant="secondary" size="row-action" onClick={() => void markViewed(item.id).then(load)} testId="notification-read">Mark read</Button> : null}
                        {!item.mandatory ? <Button variant="ghost" size="row-action" onClick={() => void dismissNotification(item.id).then(load)} testId="notification-dismiss">Dismiss</Button> : null}
                      </div>
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}>{timeAgo(item.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && rows.length > 0 ? (
            <div data-testid="notification-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, visible.length)} of {visible.length}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 12).map((n) => (
                  <button
                    key={n}
                    type="button"
                    data-testid={`notification-page-${n}`}
                    onClick={() => setPage(n)}
                    aria-current={n === current ? 'page' : undefined}
                    style={{
                      width: '32px', height: '32px', borderRadius: '9px', fontFamily: 'inherit', cursor: 'pointer',
                      border: '1px solid var(--color-border-control)',
                      background: n === current ? 'var(--color-ink)' : '#FFFFFF',
                      color: n === current ? '#FFFFFF' : 'var(--color-text-muted)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* The right-hand column: what is still true RIGHT NOW. Evaluated, never stored, never dismissed (NOT-013). */}
        <div data-testid="notification-conditions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>NEEDS ATTENTION NOW</div>
          {conditions.length === 0 ? (
            <div data-testid="notification-conditions-empty" style={{ padding: '14px 16px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid var(--color-border-card)', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
              Nothing is waiting on you right now.
            </div>
          ) : (
            conditions.map((c) => {
              const tone = toneFor(c.code);
              return (
                <div key={c.code} data-testid={`condition-${c.code}`} style={{ padding: '12px 14px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid var(--color-border-card)', boxShadow: 'var(--elevation-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="tabular-nums" style={{ fontSize: '16px', fontWeight: 850, minWidth: '28px', textAlign: 'center', padding: '3px 8px', borderRadius: '9px', background: tone.bg, color: tone.fg }}>{c.count}</span>
                    <span style={{ fontSize: '12.5px', fontWeight: 750 }}>{c.title}{c.mandatory ? ' · always shown' : ''}</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                    {c.items.map((it, index) =>
                      it.orderId ? (
                        <Link key={`${it.reference}-${index}`} to={`/sales/orders/${it.orderId}`} style={{ color: 'inherit', fontWeight: 650 }}>{it.reference}</Link>
                      ) : (
                        <span key={`${it.reference}-${index}`} style={{ fontWeight: 650 }}>{it.reference}</span>
                      ),
                    )}
                    {c.count > c.items.length ? <span>+{c.count - c.items.length} more</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
