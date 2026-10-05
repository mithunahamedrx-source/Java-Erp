import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../ui/Overlay';
import { fetchCaptureOptions, receiveReturn } from './orderApi';
import type { CaptureOptions, ChannelOrderRow } from './orderApi';

/**
 * Return Received — `BR-199`, `PRM-097`. The failed-delivery parcel is back: who received it and a note, then done.
 *
 * Received by defaults to the signed-in user and may be changed to any active user. The act records no refund,
 * no stock movement and no courier change; it only moves the order to Returned.
 */
export default function ReturnReceivedDialog({
  order,
  onClose,
  onDone,
}: {
  readonly order: ChannelOrderRow;
  readonly onClose: () => void;
  readonly onDone: () => void;
}): React.JSX.Element {
  const { session } = useAuth();
  const me = session.status === 'authenticated' ? session.user.id : '';
  const [users, setUsers] = useState<CaptureOptions['users']>([]);
  const [receivedBy, setReceivedBy] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchCaptureOptions()
      .then((options) => {
        if (live) {
          setUsers(options.users ?? []);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!receivedBy && me && users.some((user) => user.id === me)) {
      setReceivedBy(me);
    }
  }, [me, users, receivedBy]);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await receiveReturn(order.id, receivedBy || null, note);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The return could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title={`Return Received ${order.triolooInvoiceNumber ?? order.externalOrderId}`}
      consequence="The parcel is back with us. The order moves to Returned. No refund or stock movement is recorded."
      confirmLabel="Done"
      cancelLabel="Close"
      busy={busy}
      error={error}
      width="480px"
      testId="return-received-dialog"
      onConfirm={() => void submit()}
      onCancel={onClose}
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px' }}>
          <span style={{ fontWeight: 600 }}>Received by</span>
          <select
            value={receivedBy}
            onChange={(event) => setReceivedBy(event.target.value)}
            style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit' }}
          >
            <option value="">Me</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px' }}>
          <span style={{ fontWeight: 600 }}>Note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Condition of the parcel, courier receipt…"
            style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit' }}
          />
        </label>
      </div>
    </ConfirmDialog>
  );
}
