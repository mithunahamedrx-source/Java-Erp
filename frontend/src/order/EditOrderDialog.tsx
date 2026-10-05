import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../ui/Overlay';
import { WARRANTY_TERMS, editOrder, fetchChannelOrder } from './orderApi';
import type { ChannelOrderDetail, ChannelOrderRow, EditOrderResult } from './orderApi';

/**
 * Edit an order before dispatch — `OM §7.9`, `BR-058`, `PRM-096`, `BR-190`.
 *
 * The form is the owner's (2026-10-05): ONE full-name box, the phone, ONE full-address box, the order
 * total, the advance received, and the PRODUCT LINES — each with its name, quantity and price (no SKU) —
 * and a note that is optional.
 *
 * 🔴 THE CONSEQUENCE IS STATED BEFORE THE ACT (`UX-184`, `RULE 3.19.b`): editing takes control of a
 * marketplace order permanently (`BR-169`, `BR-175`), the marketplace is not told, and a consignment
 * already booked is not updated.
 *
 * 🔴 MONEY STAYS A STRING (`TEC-015`, `OSC-043`). Amounts are shape-checked, never parsed with `Number`.
 * The one piece of arithmetic here — suggesting a new total when a quantity or price changes — is done
 * in whole minor units with `BigInt`, so it is exact, and the operator can overwrite the suggestion
 * (`INV-31.7`: the total is the order's own figure).
 */
const MONEY = /^\d+(\.\d{1,2})?$/;

type LineDraft = { id: string; name: string; quantity: string; price: string };

type Draft = {
  fullName: string;
  phone: string;
  address: string;
  total: string;
  advance: string;
  warranty: string;
  lines: LineDraft[];
};

/** `"1234.5"` → `123450n`; `null` where the text is not an amount. Exact — no floating point. */
function toMinor(value: string): bigint | null {
  const text = value.trim();
  if (!MONEY.test(text)) {
    return null;
  }
  const [whole = '0', fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function fromMinor(minor: bigint): string {
  const whole = minor / 100n;
  const cents = (minor % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${cents}`;
}

/** Σ quantity × price over the lines, or `null` if any line is not yet a valid price and quantity. */
function suggestedTotal(lines: readonly LineDraft[]): string | null {
  let sum = 0n;
  for (const line of lines) {
    const price = toMinor(line.price);
    const quantity = /^\d+$/.test(line.quantity.trim()) ? BigInt(line.quantity.trim()) : null;
    if (price === null || quantity === null) {
      return null;
    }
    sum += price * quantity;
  }
  return fromMinor(sum);
}

function joinAddress(detail: ChannelOrderDetail): string {
  const a = detail.shippingAddress;
  return [a?.address1, a?.address2, a?.address3, a?.address4, a?.address5, a?.city, a?.postCode]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(', ');
}

function draftOf(detail: ChannelOrderDetail): Draft {
  const a = detail.shippingAddress;
  const first = a?.firstName ?? detail.customerFirstName ?? '';
  const last = a?.lastName ?? detail.customerLastName ?? '';
  return {
    fullName: [first, last].map((part) => part.trim()).filter(Boolean).join(' '),
    phone: a?.phone ?? '',
    address: joinAddress(detail),
    total: detail.price ?? '',
    advance: detail.advanceReceived ?? '',
    warranty: detail.warrantyTerm ?? '',
    lines: detail.items.map((item) => ({
      id: item.id,
      name: item.name ?? '',
      quantity: String(item.quantity ?? 1),
      price: item.itemPrice ?? '',
    })),
  };
}

export default function EditOrderDialog({
  order,
  onClose,
  onSaved,
}: {
  readonly order: ChannelOrderRow;
  readonly onClose: () => void;
  readonly onSaved: (result: EditOrderResult) => void;
}): React.JSX.Element {
  const [initial, setInitial] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchChannelOrder(order.id)
      .then((detail) => {
        if (live) {
          const d = draftOf(detail);
          setInitial(d);
          setDraft(d);
        }
      })
      .catch((cause: unknown) => {
        if (live) {
          setLoadError(cause instanceof Error ? cause.message : 'The order could not be loaded.');
        }
      });
    return () => {
      live = false;
    };
  }, [order.id]);

  const changed = useMemo(
    () => (initial && draft ? JSON.stringify(initial) !== JSON.stringify(draft) : false),
    [initial, draft],
  );
  const problem = useMemo(() => {
    if (!draft) {
      return null;
    }
    if (draft.total.trim() && !MONEY.test(draft.total.trim())) {
      return 'The total must be an amount such as 1500 or 1500.50.';
    }
    if (draft.advance.trim() && !MONEY.test(draft.advance.trim())) {
      return 'The advance must be an amount such as 500 or 500.50.';
    }
    if (draft.lines.some((line) => line.price.trim() && !MONEY.test(line.price.trim()))) {
      return 'Every product price must be an amount such as 1500 or 1500.50.';
    }
    if (draft.lines.some((line) => !/^[1-9]\d*$/.test(line.quantity.trim()))) {
      return 'Every quantity must be a whole number, at least 1.';
    }
    return null;
  }, [draft]);

  // The note is OPTIONAL (owner, 2026-10-05): only "something changed" and "nothing malformed" gate Save.
  const disabledReason = !draft
    ? 'Loading the order.'
    : !changed && !note.trim()
      ? 'Nothing has been changed.'
      : problem ?? undefined;

  const reference = order.triolooInvoiceNumber ?? order.externalOrderId;
  const courierBooked = Boolean(order.courierConsignmentId);

  const submit = async (): Promise<void> => {
    if (!draft || !initial) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // The advance: unchanged → null (leave it); emptied → "0" (clear it); otherwise the new amount.
      const advanceChanged = draft.advance.trim() !== initial.advance.trim();
      const result = await editOrder(order.id, {
        reason: note.trim() || null,
        recipientName: draft.fullName,
        phone: draft.phone,
        address: draft.address,
        total: draft.total.trim() || null,
        advanceReceived: advanceChanged ? (draft.advance.trim() || '0') : null,
        // Unchanged -> null (leave it); cleared -> "NONE"; otherwise the chosen term (BR-197).
        warrantyTerm: draft.warranty === initial.warranty ? null : (draft.warranty || 'NONE'),
        lines: draft.lines.map((line) => ({
          id: line.id,
          name: line.name,
          quantity: Number.parseInt(line.quantity.trim(), 10),
          unitPrice: line.price.trim() || null,
        })),
      });
      onSaved(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The edit could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<Draft>): void => setDraft((d) => (d ? { ...d, ...patch } : d));
  // Changing a quantity or a price suggests the new total, exactly; the operator may overwrite it.
  const setLine = (id: string, patch: Partial<LineDraft>): void =>
    setDraft((d) => {
      if (!d) {
        return d;
      }
      const lines = d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
      const suggestion = 'quantity' in patch || 'price' in patch ? suggestedTotal(lines) : null;
      return { ...d, lines, total: suggestion ?? d.total };
    });

  return (
    <ConfirmDialog
      title={`Edit order ${reference}`}
      consequence={
        (order.ownership === 'API_MANAGED'
          ? 'Trioloo takes control of this marketplace order from now on, and marketplace updates will not overwrite it. That cannot be undone. '
          : '')
        + 'The marketplace is not told.'
        + (courierBooked
          ? ' This order is already booked with Steadfast, which keeps the old details — update the consignment in the Steadfast panel too.'
          : '')
      }
      confirmLabel="Save changes"
      cancelLabel="Close"
      busy={busy}
      error={error ?? loadError}
      width="640px"
      testId="edit-order-dialog"
      confirmDisabled={Boolean(disabledReason)}
      confirmDisabledReason={disabledReason}
      onConfirm={() => void submit()}
      onCancel={onClose}
    >
      {draft ? (
        <div style={{ display: 'grid', gap: 'var(--space-3)', maxHeight: '52vh', overflowY: 'auto', paddingRight: '4px' }}>
          <div style={gridTwo}>
            <Field label="Full name" value={draft.fullName} onChange={(v) => set({ fullName: v })} />
            <Field label="Phone" value={draft.phone} onChange={(v) => set({ phone: v })} />
          </div>
          <Field label="Full address" value={draft.address} onChange={(v) => set({ address: v })} />
          <div style={gridTwo}>
            <Field label="Order total" value={draft.total} onChange={(v) => set({ total: v })} mono />
            <Field label="Advance received" value={draft.advance} onChange={(v) => set({ advance: v })} mono placeholder="0 — none" />
          </div>
          <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px' }}>
            <span style={{ fontWeight: 600 }}>Warranty</span>
            <select
              value={draft.warranty}
              onChange={(event) => set({ warranty: event.target.value })}
              style={{ height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)', fontSize: '13px', fontFamily: 'inherit' }}
            >
              <option value="">No warranty term</option>
              {WARRANTY_TERMS.map((term) => (
                <option key={term.value} value={term.value}>{term.label}</option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: '12.5px', fontWeight: 700 }}>Product lines</div>
          {draft.lines.map((line, index) => (
            <div key={line.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 1.2fr)', gap: 'var(--space-3)' }}>
              <Field label={`Product ${index + 1}`} value={line.name} onChange={(v) => setLine(line.id, { name: v })} />
              <Field label="Qty" value={line.quantity} onChange={(v) => setLine(line.id, { quantity: v })} mono />
              <Field label="Price" value={line.price} onChange={(v) => setLine(line.id, { price: v })} mono />
            </div>
          ))}
          <Field label="Note (optional)" value={note} onChange={setNote} />
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {loadError ?? 'Loading the order…'}
        </div>
      )}
    </ConfirmDialog>
  );
}

const gridTwo: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 'var(--space-3)',
};

function Field({
  label,
  value,
  onChange,
  mono = false,
  placeholder,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly mono?: boolean;
  readonly placeholder?: string;
}): React.JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px', minWidth: 0 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={mono ? 'tabular-nums' : undefined}
        style={{
          height: '36px',
          borderRadius: '9px',
          padding: '0 12px',
          border: '1px solid var(--color-border-control)',
          fontSize: '13px',
          fontFamily: 'inherit',
          minWidth: 0,
        }}
      />
    </label>
  );
}
