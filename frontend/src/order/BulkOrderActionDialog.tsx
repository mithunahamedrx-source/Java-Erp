import { useState } from 'react';
import { ConfirmDialog } from '../ui/Overlay';
import { Select } from '../ui/primitives';
import { CANCEL_REASONS, cancelOrder, holdOrder } from './orderApi';
import type { ChannelOrderRow } from './orderApi';

/**
 * Cancel orders / Place hold — for ONE order or for a SELECTION.
 *
 * Each order is acted on by its own call, so the server authorises and judges every record separately (`PRM-025`):
 * some may be done and others refused, and the result names each refusal. Nothing is all-or-nothing and nothing is
 * skipped silently. The consequence is stated before the act (`UX-184`).
 */
export type BulkKind = 'cancel' | 'hold';

const reference = (order: ChannelOrderRow): string => order.triolooInvoiceNumber ?? order.externalOrderId;

export default function BulkOrderActionDialog({
  kind,
  orders,
  onClose,
  onDone,
}: {
  readonly kind: BulkKind;
  readonly orders: readonly ChannelOrderRow[];
  readonly onClose: () => void;
  readonly onDone: (summary: string) => void;
}): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const many = orders.length > 1;
  const subject = many ? `${orders.length} orders` : `order ${reference(orders[0] as ChannelOrderRow)}`;
  const anyMarketplace = orders.some((o) => o.ownership === 'API_MANAGED');
  const anyBooked = orders.some((o) => Boolean(o.courierConsignmentId));

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const done: string[] = [];
    const refused: string[] = [];
    for (const order of orders) {
      try {
        if (kind === 'cancel') {
          await cancelOrder(order.id, reason, note);
        } else {
          await holdOrder(order.id, note);
        }
        done.push(reference(order));
      } catch (cause) {
        refused.push(`${reference(order)}: ${cause instanceof Error ? cause.message : 'refused'}`);
      }
    }
    setBusy(false);
    const verb = kind === 'cancel' ? 'cancelled' : 'put on hold';
    const head = `${done.length} order${done.length === 1 ? '' : 's'} ${verb}${refused.length ? `, ${refused.length} refused` : ''}.`;
    const detail = refused.length ? ` ${refused.slice(0, 4).join(' | ')}${refused.length > 4 ? ' …' : ''}` : '';
    if (done.length === 0) {
      setError(`${head}${detail}`);
      return;
    }
    onDone(`${head}${detail}`);
  };

  const consequence = kind === 'cancel'
    ? (anyMarketplace
        ? 'Trioloo takes control of each marketplace order and marketplace updates will not overwrite it. That cannot be undone. '
        : '')
      + 'A marketplace is not told — cancel Daraz orders in the seller panel too; a website order is cancelled on the site as well.'
      + (anyBooked ? ' A booked Steadfast consignment is NOT cancelled automatically — cancel it in the Steadfast panel too.' : '')
      + ' Orders already with the courier cannot be cancelled and will be refused.'
    : 'A held order is suspended: it cannot be sent to Steadfast until a person releases it, and it never releases itself. A booked order cannot be held.';

  return (
    <ConfirmDialog
      title={kind === 'cancel' ? `Cancel ${subject}` : `Place ${subject} on hold`}
      consequence={consequence}
      confirmLabel={kind === 'cancel' ? 'Cancel orders' : 'Place hold'}
      cancelLabel={kind === 'cancel' ? 'Keep orders' : 'Close'}
      destructive={kind === 'cancel'}
      busy={busy}
      error={error}
      confirmDisabled={kind === 'cancel' && !reason}
      confirmDisabledReason={kind === 'cancel' && !reason ? 'Choose a reason — every cancellation records one.' : undefined}
      testId={kind === 'cancel' ? 'bulk-cancel-dialog' : 'bulk-hold-dialog'}
      onConfirm={() => void submit()}
      onCancel={onClose}
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {kind === 'cancel' ? (
          <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px' }}>
            <span style={{ fontWeight: 600 }}>Reason</span>
            <Select value={reason} onChange={setReason}>
              <option value="">Choose a reason</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </label>
        ) : null}
        <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px' }}>
          <span style={{ fontWeight: 600 }}>Note (optional)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px' }}
          />
        </label>
      </div>
    </ConfirmDialog>
  );
}
