import { apiRequest } from '../platform/api';

/**
 * The Notification client. Everything here is the signed-in person's OWN: the server binds every read and every
 * change to their recipient row, so the client never names a recipient (`PRM-009`).
 *
 * `category` / `priority` / `mandatory` are three independent axes (`NOT-014`); none is derived from another.
 */
export type NotificationItem = {
  readonly id: string;
  readonly typeCode: string;
  readonly category: 'INFORMATION' | 'ACTION_REQUIRED';
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH';
  readonly mandatory: boolean;
  readonly title: string;
  readonly body: string | null;
  readonly orderId: string | null;
  readonly createdAt: string;
  readonly viewedAt: string | null;
};

export type ConditionItem = { readonly orderId: string | null; readonly reference: string };

/** An Ongoing Condition - true right now, cleared by the state changing, never dismissed (`NOT-013`). */
export type NotificationCondition = {
  readonly code: string;
  readonly title: string;
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH';
  readonly mandatory: boolean;
  readonly count: number;
  readonly items: readonly ConditionItem[];
};

export type NotificationSummary = { readonly unread: number; readonly conditions: readonly NotificationCondition[] };

export const fetchSummary = (): Promise<NotificationSummary> => apiRequest<NotificationSummary>('/api/notifications/summary');

export const fetchNotifications = (unreadOnly: boolean, limit = 50): Promise<readonly NotificationItem[]> =>
  apiRequest<readonly NotificationItem[]>(`/api/notifications?unreadOnly=${unreadOnly}&limit=${limit}`);

export const markViewed = (id: string): Promise<void> =>
  apiRequest<void>(`/api/notifications/${encodeURIComponent(id)}/view`, { method: 'POST' });

export const markAllViewed = (): Promise<void> => apiRequest<void>('/api/notifications/view-all', { method: 'POST' });

export const dismissNotification = (id: string): Promise<void> =>
  apiRequest<void>(`/api/notifications/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });

/** "5 min ago" - relative to `now`, so a test can fix the clock. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}
