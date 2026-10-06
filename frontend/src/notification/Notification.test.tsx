import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import NotificationBell from './NotificationBell';
import NotificationCenterPage from './NotificationCenterPage';
import { timeAgo } from './notificationApi';

/**
 * Notification - the bell and the Notification Center. Everything is the signed-in person's own; the fixtures exist
 * only inside this file and are served through a stubbed `fetch`.
 */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ITEM = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'n1', typeCode: 'NEW_ORDER', category: 'INFORMATION', priority: 'NORMAL', mandatory: false,
  title: 'New order TR0300', body: 'From Zeon Tech Website.', orderId: 'o1',
  createdAt: new Date().toISOString(), viewedAt: null, ...over,
});

const CONDITION = {
  code: 'ON_HOLD', title: 'On hold - waiting for someone to release it', priority: 'NORMAL', mandatory: false,
  count: 2, items: [{ orderId: 'o2', reference: 'TR0201' }, { orderId: 'o3', reference: 'TR0202' }],
};

function stub(summary: unknown, list: unknown[], calls: string[] = []): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/api/auth/me')) return json({ id: 'u', username: 'm', fullName: 'M', roles: [], permissions: [] });
    if (url.includes('/api/auth/csrf')) return new Response(null, { status: 204 });
    if (url.includes('/api/notifications/summary')) return json(summary);
    if (url.includes('/api/notifications')) return init?.method === 'POST' ? new Response(null, { status: 204 }) : json(list);
    return json({});
  }));
}

function renderBell(): void {
  render(
    <AuthProvider>
      <MemoryRouter>
        <NotificationBell buttonStyle={{}} />
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the bell', () => {
  it('shows the unread count as a badge, and nothing when there is nothing', async () => {
    stub({ unread: 3, conditions: [] }, []);
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-badge').textContent).toBe('3'));
    cleanup();

    stub({ unread: 0, conditions: [] }, []);
    renderBell();
    await waitFor(() => expect(screen.getByTestId('utility-notifications')).toBeTruthy());
    expect(screen.queryByTestId('notification-badge')).toBeNull();
    expect(screen.queryByTestId('notification-dot')).toBeNull();
  });

  it('shows a quiet dot, not a count, when only a condition needs attention', async () => {
    stub({ unread: 0, conditions: [CONDITION] }, []);
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-dot')).toBeTruthy());
    expect(screen.queryByTestId('notification-badge')).toBeNull();
  });

  it('keeps its accessible name and survives a failed read without a wrong number', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    renderBell();
    const bell = screen.getByTestId('utility-notifications');
    expect(bell.getAttribute('aria-label')).toBe('Notifications');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('notification-badge')).toBeNull();
  });

  it('opens a short list; choosing one marks it read, and the Center is one click away', async () => {
    const calls: string[] = [];
    stub({ unread: 1, conditions: [] }, [ITEM()], calls);
    renderBell();
    fireEvent.click(screen.getByTestId('utility-notifications'));
    await waitFor(() => expect(screen.getByTestId('notification-popover-item')).toBeTruthy());
    expect(screen.getByTestId('notification-popover').textContent).toContain('New order TR0300');
    expect(screen.getByTestId('notification-open-center').textContent).toBe('View all');
    expect(screen.getByTestId('notification-mark-read')).toBeTruthy();

    fireEvent.click(screen.getByTestId('notification-popover-item'));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/api/notifications/n1/view'))).toBe(true));
  });
});

describe('the Notification Center', () => {
  function renderCenter(): void {
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={['/notifications']}>
            <Routes>
              <Route path="/notifications" element={<NotificationCenterPage />} />
              <Route path="/sales/orders/:id" element={<div data-testid="order-page" />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );
  }

  it('lists notifications and keeps live conditions apart, with no dismiss on a condition', async () => {
    stub({ unread: 1, conditions: [CONDITION] }, [ITEM(), ITEM({ id: 'n2', title: 'Delivery failed - order TR0100', priority: 'HIGH', viewedAt: '2026-10-06T00:00:00Z' })]);
    renderCenter();
    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(2));
    const condition = screen.getByTestId('condition-ON_HOLD');
    expect(condition.textContent).toContain('2');
    expect(condition.textContent).toContain('TR0201');
    expect(condition.querySelector('button')).toBeNull(); // nobody dismisses a condition (NOT-013)
    expect(screen.getByTestId('notification-list').textContent).toContain('Delivery');
  });

  it('marks read, dismisses, and opens the order - each by its own call', async () => {
    const calls: string[] = [];
    stub({ unread: 1, conditions: [] }, [ITEM()], calls);
    renderCenter();
    await waitFor(() => expect(screen.getByTestId('notification-row')).toBeTruthy());

    fireEvent.click(screen.getByTestId('notification-read'));
    await waitFor(() => expect(calls).toContain('POST http://localhost:8080/api/notifications/n1/view'));
    fireEvent.click(screen.getByTestId('notification-dismiss'));
    await waitFor(() => expect(calls).toContain('POST http://localhost:8080/api/notifications/n1/dismiss'));
    fireEvent.click(screen.getByTestId('notification-open'));
    await waitFor(() => expect(screen.getByTestId('order-page')).toBeTruthy());
  });

  it('offers no dismiss on a mandatory notification', async () => {
    stub({ unread: 1, conditions: [] }, [ITEM({ mandatory: true })]);
    renderCenter();
    await waitFor(() => expect(screen.getByTestId('notification-row')).toBeTruthy());
    expect(screen.queryByTestId('notification-dismiss')).toBeNull();
  });

  it('draws four summary cards, filters and searches the list, and pages ten at a time', async () => {
    const many = Array.from({ length: 23 }, (_, i) => ITEM({
      id: 'n' + i, title: i === 5 ? 'Delivery failed - order TR0555' : 'New order TR' + (1000 + i),
      typeCode: i === 5 ? 'DELIVERY_FAILED' : 'NEW_ORDER', priority: i === 5 ? 'HIGH' : 'NORMAL',
      viewedAt: i % 2 === 0 ? '2026-10-06T00:00:00Z' : null,
    }));
    stub({ unread: 11, conditions: [CONDITION] }, many);
    renderCenter();
    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(10));
    expect(screen.getByTestId('notification-kpi-unread').textContent).toContain('11');
    expect(screen.getByTestId('notification-kpi-high').textContent).toContain('1');
    expect(screen.getByTestId('notification-pagination').textContent).toContain('1–10 of 23');

    fireEvent.click(screen.getByTestId('notification-page-3'));
    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(3));

    fireEvent.click(screen.getByTestId('notification-filter-high'));
    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(1));
    expect(screen.getByTestId('notification-list').textContent).toContain('TR0555');

    fireEvent.click(screen.getByTestId('notification-filter-all'));
    fireEvent.change(screen.getByTestId('notification-search'), { target: { value: 'tr1007' } });
    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(1));
  });

  it('says so, truthfully, when there is nothing', async () => {
    stub({ unread: 0, conditions: [] }, []);
    renderCenter();
    await waitFor(() => expect(screen.getByText('No notifications yet')).toBeTruthy());
  });
});

describe('timeAgo', () => {
  it('reads relative to now', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(timeAgo('2026-10-06T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-06T11:30:00Z', now)).toBe('30 min ago');
    expect(timeAgo('2026-10-06T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-10-04T12:00:00Z', now)).toBe('2 d ago');
  });
});
