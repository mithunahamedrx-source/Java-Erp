import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, Select } from '../ui/primitives';
import { apiRequest } from '../platform/api';
import { fetchChannelOrderSummary } from './orderApi';
import type { ChannelOrderSummary } from './orderApi';

/**
 * Manual order capture — `PRM-093`, `OM §22`.
 *
 * 🔴 IT IS A PAGE AND NOT A MODAL, AND THAT IS THE RULE RATHER THAN A PREFERENCE. `UX-151` —
 * *"a workflow needing more than a bounded decision gets a PAGE, not a modal"*. Capturing a
 * customer, an address, and any number of priced lines is not a bounded decision. ⚠ The product
 * owner asked for a modal and the legacy system has one; `GAP-035` and `GAP-023` describe exactly
 * that modal, and both are open BECAUSE of what it compresses.
 *
 * ✅ THE FORM LANGUAGE IS THE REPO'S OWN. `RULE 3.18` ratifies it and `RULE 3.18.g` gives the
 * two-column `1fr 1fr` reference composition at `18px 32px`. 🔴 The Claude Design project holds no
 * Create Order design — it was checked and contains one unrelated scrap — so the ratified form
 * language governs rather than an invented one (`UX-260` — no component specification is invented).
 *
 * 🔴 THE ORDER ENDS AT `PENDING_VERIFICATION` AND STOPS. `PRM-093.b` — creation is not
 * confirmation, and nothing here writes `Confirmed By` or `Confirmed At` (`BR-176`).
 */
export default function NewOrderPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [shops, setShops] = useState<ChannelOrderSummary['shops']>([]);
  const [shopId, setShopId] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ name: '', sku: '', unitPrice: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const summary = await fetchChannelOrderSummary({});
        setShops(summary.shops ?? []);
      } catch {
        // ⚠ The shop list failing does not disable capture; the field simply has no options and
        // the server refuses without one (BR-002). A silent empty select is honest here.
        setShops([]);
      }
    })();
  }, []);

  /*
    🔴 THE TOTAL IS SUMMED FROM STRINGS AS STRINGS. `TEC-015` / `DB-079` — money is never a
    JavaScript number. A `reduce` over `Number(price)` would round 0.1 + 0.2 into an amount nobody
    typed, and this is the figure that becomes the order's price and the invoice's subtotal.
  */
  const total = useMemo(() => sumMinorUnits(lines.map((line) => line.unitPrice)), [lines]);

  const submit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await apiRequest<{ id: string; invoiceNumber: string }>('/api/order/orders', {
        method: 'POST',
        body: {
          channelInstanceId: shopId || null,
          customerFirstName,
          customerLastName,
          customerPhone,
          shippingAddress,
          shippingCity,
          paymentMethod,
          note,
          total,
          lines: lines.map((line, index) => ({
            lineNumber: index + 1,
            name: line.name,
            sku: line.sku || null,
            unitPrice: line.unitPrice || '0',
          })),
        },
      });
      navigate(`/sales/orders/${created.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The order could not be created.');
    } finally {
      setSaving(false);
    }
  }, [shopId, customerFirstName, customerLastName, customerPhone, shippingAddress,
      shippingCity, paymentMethod, note, lines, total, navigate]);

  return (
    <>
      <PageHeader
        title="New order"
        subtitle="Manual capture · direct channel"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" size="page-header" onClick={() => navigate('/sales/orders')}>
              Cancel
            </Button>
            {/* `RULE 3.11` — exactly one primary, and it is rightmost. */}
            <Button
              variant="primary"
              size="page-header"
              disabled={saving}
              onClick={() => void submit()}
              testId="new-order-submit"
            >
              {saving ? 'Creating…' : 'Create order'}
            </Button>
          </div>
        }
      />

      {error ? <p style={errorStyle} data-testid="new-order-error">{error}</p> : null}

      {/*
        ⚠ `PENDING_VERIFICATION` IS STATED BEFORE THE ACT, NOT AFTER IT. `UX-184`'s principle —
        a consequential transition must not happen invisibly — applies to what an operator is about
        to create as much as to a takeover.
      */}
      <p style={hintStyle}>
        The order is created in <strong>Pending verification</strong>, the same state an imported
        order arrives in. Creating it does not confirm it.
      </p>

      <form
        style={formStyle}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Customer</h2>
          <div style={gridStyle}>
            <Field label="First name">
              <input style={inputStyle} value={customerFirstName}
                     onChange={(e) => setCustomerFirstName(e.target.value)} />
            </Field>
            <Field label="Last name">
              <input style={inputStyle} value={customerLastName}
                     onChange={(e) => setCustomerLastName(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input style={inputStyle} value={customerPhone}
                     onChange={(e) => setCustomerPhone(e.target.value)} />
            </Field>
            <Field label="Shop">
              {/* 🔴 `BR-002` — channel type is never sufficient attribution; the INSTANCE is named. */}
              <Select value={shopId} onChange={setShopId}>
                <option value="">Choose a shop</option>
                {shops.map((shop) => (
                  <option key={shop.channelInstanceId} value={shop.channelInstanceId}>
                    {shop.name ?? shop.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Delivery address">
              <input style={inputStyle} value={shippingAddress}
                     onChange={(e) => setShippingAddress(e.target.value)} />
            </Field>
            <Field label="City">
              <input style={inputStyle} value={shippingCity}
                     onChange={(e) => setShippingCity(e.target.value)} />
            </Field>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Lines</h2>
          {/*
            ⚠ `PRD-139` / `BR-145` — on a manual order STAFF determine the price, and it is
            captured at LINE CREATION and preserved. 🔴 `BR-148` forecloses the dangerous reading:
            a manual price below the Ideal / Recommended Selling Price is NOT a discount, so no
            approval path, warning or comparison is drawn.
          */}
          {lines.map((line, index) => (
            <div key={index} style={lineRowStyle}>
              <input
                style={{ ...inputStyle, flex: 2 }}
                placeholder="Product description"
                value={line.name}
                onChange={(e) => updateLine(setLines, index, { name: e.target.value })}
                aria-label={`Line ${index + 1} description`}
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="SKU (optional)"
                value={line.sku}
                onChange={(e) => updateLine(setLines, index, { sku: e.target.value })}
                aria-label={`Line ${index + 1} SKU`}
              />
              <input
                style={{ ...inputStyle, width: '140px' }}
                placeholder="Unit price"
                inputMode="decimal"
                value={line.unitPrice}
                onChange={(e) => updateLine(setLines, index, { unitPrice: e.target.value })}
                aria-label={`Line ${index + 1} unit price`}
              />
              <button
                type="button"
                style={removeLineStyle}
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                aria-label={`Remove line ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            style={addLineStyle}
            onClick={() => setLines((current) => [...current, { name: '', sku: '', unitPrice: '' }])}
          >
            Add line
          </button>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Payment and note</h2>
          <div style={gridStyle}>
            <Field label="Payment method">
              <input style={inputStyle} value={paymentMethod}
                     onChange={(e) => setPaymentMethod(e.target.value)} />
            </Field>
            <Field label="Note">
              <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <div style={totalRowStyle}>
            <span>Order total</span>
            <strong className="tabular-nums" data-testid="new-order-total">৳ {total}</strong>
          </div>
        </section>
      </form>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function Field({ label, children }: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

type LineDraft = { name: string; sku: string; unitPrice: string };

function updateLine(
  setLines: React.Dispatch<React.SetStateAction<LineDraft[]>>,
  index: number,
  patch: Partial<LineDraft>,
): void {
  setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
}

/**
 * Sums decimal strings without ever becoming a float.
 *
 * 🔴 `TEC-015` / `DB-079` — money is never a JavaScript number. This works in minor units as
 * integers, so `0.1 + 0.2` stays `0.30` instead of becoming an amount nobody typed. ⚠ The result
 * is the figure that becomes the order's price and then the invoice's subtotal, so it is the last
 * place a rounding artefact could be introduced unnoticed.
 */
export function sumMinorUnits(values: readonly string[]): string {
  let minor = 0n;
  for (const raw of values) {
    const value = (raw ?? '').trim();
    if (!value || !/^\d+(\.\d{0,2})?$/.test(value)) {
      continue;
    }
    const [whole, fraction = ''] = value.split('.');
    minor += BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
  }
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ styles */

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-7)',
};

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  padding: 'var(--space-6)',
  boxShadow: 'var(--elevation-card)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 var(--space-5)',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
};

/** `RULE 3.18.g` — the two-column `1fr 1fr` reference composition at `18px 32px`. */
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  rowGap: '18px',
  columnGap: '32px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

const inputStyle: React.CSSProperties = {
  height: '38px',
  padding: '0 12px',
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--color-border-card)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  font: 'inherit',
  fontSize: '13px',
};

const lineRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'center',
  marginBottom: 'var(--space-3)',
};

const addLineStyle: React.CSSProperties = {
  background: 'none',
  border: '1px dashed var(--color-border-card)',
  borderRadius: 'var(--radius-control)',
  padding: '8px 14px',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-secondary-text)',
  cursor: 'pointer',
};

const removeLineStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  font: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-link)',
  cursor: 'pointer',
};

const totalRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 'var(--space-6)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--color-divider-light)',
  fontSize: '15px',
  color: 'var(--color-text-primary)',
};

const hintStyle: React.CSSProperties = {
  margin: '0 0 var(--space-6)',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
};

const errorStyle: React.CSSProperties = {
  margin: '0 0 var(--space-5)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-semantic-warning-bg)',
  color: 'var(--color-semantic-warning-fg)',
  fontSize: '13px',
};
