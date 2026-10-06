import type { NotificationItem } from './notificationApi';

/**
 * How a notification LOOKS, taken from the owner's design reference (`Trioloo ERP Final Design Reference.dc.html`,
 * `NotificationPanel` and `notifications:all`): a coloured dot, the title, a small module badge, the note, the time.
 * Colour is a story-teller (red = something went wrong, amber = something is coming back, blue = information), and only
 * the ratified status tokens are used - never a framework default.
 *
 * Presentation only: nothing here decides who is told or what is urgent; that is the server's, per type.
 */
export type Tone = { readonly dot: string; readonly bg: string; readonly fg: string };

const RED: Tone = { dot: 'var(--color-status-cancelled-fg)', bg: 'var(--color-status-cancelled-bg)', fg: 'var(--color-status-cancelled-fg)' };
const AMBER: Tone = { dot: 'var(--color-status-pending-fg)', bg: 'var(--color-status-pending-bg)', fg: 'var(--color-status-pending-fg)' };
const BLUE: Tone = { dot: 'var(--color-status-dispatched-fg)', bg: 'var(--color-status-dispatched-bg)', fg: 'var(--color-status-dispatched-fg)' };
const GREY: Tone = { dot: 'var(--color-status-neutral-fg)', bg: 'var(--color-status-neutral-bg)', fg: 'var(--color-status-neutral-fg)' };

export function toneFor(typeCode: string): Tone {
  switch (typeCode) {
    case 'DELIVERY_FAILED':
      return RED;
    case 'RETURN_ARRIVED':
    case 'PENDING_CANCELLATION':
    case 'ON_HOLD':
      return AMBER;
    case 'FAILED_DELIVERY':
    case 'CONNECTION_PROBLEM':
      return RED;
    case 'NEW_ORDER':
      return BLUE;
    default:
      return GREY;
  }
}

/** The small module badge: which part of the business the notification is about. */
export function moduleFor(typeCode: string): string {
  switch (typeCode) {
    case 'NEW_ORDER':
    case 'PENDING_CANCELLATION':
    case 'ON_HOLD':
      return 'Orders';
    case 'DELIVERY_FAILED':
    case 'RETURN_ARRIVED':
    case 'FAILED_DELIVERY':
      return 'Delivery';
    case 'CONNECTION_PROBLEM':
      return 'Integration';
    default:
      return 'System';
  }
}

export type CenterFilter = 'all' | 'unread' | 'high' | 'orders' | 'delivery';

export const CENTER_FILTERS: readonly { readonly id: CenterFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'high', label: 'High priority' },
  { id: 'orders', label: 'Orders' },
  { id: 'delivery', label: 'Delivery' },
];

export function matchesFilter(item: NotificationItem, filter: CenterFilter): boolean {
  switch (filter) {
    case 'unread':
      return !item.viewedAt;
    case 'high':
      return item.priority === 'HIGH';
    case 'orders':
      return moduleFor(item.typeCode) === 'Orders';
    case 'delivery':
      return moduleFor(item.typeCode) === 'Delivery';
    default:
      return true;
  }
}
