import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { createStockItem, fetchStockItem, updateStockItem } from './stockItemApi';
import type { StockItem } from './stockItemApi';
import { ApiError } from '../platform/api';

/**
 * Create, edit and view one Stock Item.
 *
 * <p>Archetype D control language (`§3.18`) — permanent labels above the control, the enabled
 * `oklch(0.65 0.006 290)` boundary, the mandatory error marker AND message (`RULE 3.18.f`).
 *
 * <p>🔴 The form carries ONLY canonical `E-020` fields. There is no quantity, valuation, cost,
 * price, supplier or reorder input — a client cannot ask this surface to write stock, because
 * it has nowhere to put it.
 *
 * <p>🔴 On edit the Inventory SKU is IMMUTABLE (`PRD-011`, `PRD-013`) and is rendered as a
 * read-only fact, not a disabled control — `RULE 3.18.e` records that disabled is NOT the same
 * class as immutable, and the two must not borrow one another's treatment.
 */
export default function StockItemFormPage({ mode }: { readonly mode: 'create' | 'edit' | 'detail' }): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<StockItem | null>(null);
  type FormState = {
    inventorySku: string; technicalName: string; brand: string; inventoryCategory: string;
    unitOfMeasure: string; barcode: string; serializationPolicy: string; componentClass: string;
    recordStatus: string;
  };
  const [form, setForm] = useState<FormState>({
    inventorySku: '', technicalName: '', brand: '', inventoryCategory: '',
    unitOfMeasure: '', barcode: '', serializationPolicy: 'NOT_SERIALIZED',
    componentClass: '', recordStatus: 'DRAFT',
  });
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (mode === 'create' || !id) return;
    setLoading(true);
    fetchStockItem(id)
      .then((loaded) => {
        setItem(loaded);
        setForm({
          inventorySku: loaded.inventorySku,
          technicalName: loaded.technicalName,
          brand: loaded.brand ?? '',
          inventoryCategory: loaded.inventoryCategory ?? '',
          unitOfMeasure: loaded.unitOfMeasure,
          barcode: loaded.barcode ?? '',
          serializationPolicy: loaded.serializationPolicy,
          componentClass: loaded.componentClass ?? '',
          recordStatus: loaded.recordStatus,
        });
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.isForbidden) setForbidden(true);
      })
      .finally(() => setLoading(false));
  }, [id, mode]);

  async function save(): Promise<void> {
    setSaving(true);
    setFieldError(null);
    try {
      const body: Record<string, unknown> = {
        technicalName: form.technicalName,
        brand: form.brand || null,
        inventoryCategory: form.inventoryCategory || null,
        unitOfMeasure: form.unitOfMeasure,
        barcode: form.barcode || null,
        serializationPolicy: form.serializationPolicy,
        componentClass: form.componentClass || null,
        recordStatus: form.recordStatus,
      };
      if (mode === 'create') {
        body.inventorySku = form.inventorySku;
        await createStockItem(body);
      } else if (id) {
        body.version = item?.version;
        await updateStockItem(id, body);
      }
      void navigate('/inventory/products/stock');
    } catch (cause) {
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        const payload = cause instanceof ApiError ? (cause.payload as { field?: string; message?: string } | null) : null;
        setFieldError({
          field: payload?.field ?? '',
          message: payload?.message ?? (cause instanceof Error ? cause.message : 'The Stock Item could not be saved.'),
        });
      }
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <Card>
        <EmptyState
          title="You do not have access to this action"
          guidance="This action requires a capability your account has not been granted."
        />
      </Card>
    );
  }
  if (loading) {
    return (
      <Card>
        <EmptyState title="Loading…" guidance="Fetching the Stock Item." />
      </Card>
    );
  }

  const readOnly = mode === 'detail';

  return (
    <>
      <PageHeader
        title={mode === 'create' ? 'Create Stock Item' : (item?.technicalName ?? 'Stock Item')}
        subtitle="Products · Stock Items"
      />

      <Card>
        <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
          {mode === 'create' ? (
            <Field label="Inventory SKU" testId="field-inventorySku" required value={form.inventorySku}
              onChange={(v) => setForm({ ...form, inventorySku: v })} error={fieldError} name="inventory_sku" />
          ) : (
            <ReadOnlyFact label="Inventory SKU" testId="fact-inventorySku" value={form.inventorySku}
              note="Immutable — a SKU is never reissued (PRD-013)." />
          )}

          <Field label="Technical name" testId="field-technicalName" required value={form.technicalName}
            onChange={(v) => setForm({ ...form, technicalName: v })} readOnly={readOnly}
            error={fieldError} name="technical_name" />
          <Field label="Unit of measure" testId="field-unitOfMeasure" required value={form.unitOfMeasure}
            onChange={(v) => setForm({ ...form, unitOfMeasure: v })} readOnly={readOnly}
            error={fieldError} name="unit_of_measure" />
          <Field label="Brand" testId="field-brand" value={form.brand}
            onChange={(v) => setForm({ ...form, brand: v })} readOnly={readOnly} />
          <Field label="Inventory category" testId="field-inventoryCategory" value={form.inventoryCategory}
            onChange={(v) => setForm({ ...form, inventoryCategory: v })} readOnly={readOnly} />
          <Field label="Barcode" testId="field-barcode" value={form.barcode}
            onChange={(v) => setForm({ ...form, barcode: v })} readOnly={readOnly} />
          <Field label="Component class" testId="field-componentClass" value={form.componentClass}
            onChange={(v) => setForm({ ...form, componentClass: v })} readOnly={readOnly} />

          {item && (
            <>
              <ReadOnlyFact label="Physical stock" testId="fact-physical" value={`${item.physicalStock} ${item.unitOfMeasure}`}
                note="Derived from inventory movements — never stored (DB-001)." />
              <ReadOnlyFact label="Available quantity" testId="fact-available" value={`${item.availableQuantity} ${item.unitOfMeasure}`}
                note={item.outOfStock ? 'Out of stock — available quantity is zero or below (IVN-055).' : undefined} />
              {item.stockValue != null && (
                <ReadOnlyFact label="Stock value" testId="fact-stock-value" value={item.stockValue}
                  note="Inventory valuation at weighted average cost (ICO-001). Not a selling price." />
              )}
            </>
          )}
        </div>

        {fieldError && (
          <div role="alert" data-testid="form-error"
            style={{ display: 'flex', gap: 'var(--space-2)', padding: '0 22px 18px', alignItems: 'center' }}>
            <span aria-hidden="true" style={{
              width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid var(--color-destructive)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px',
              fontWeight: 800, color: 'var(--color-destructive)', flexShrink: 0,
            }}>!</span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-destructive)' }}>
              {fieldError.message}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '0 22px 22px' }}>
          {!readOnly && (
            <button type="button" data-testid="save-stock-item" disabled={saving} onClick={() => void save()}
              style={{
                height: 'var(--control-height-button)', padding: '0 18px', background: 'var(--color-ink)',
                border: 'none', borderRadius: 'var(--radius-control)', color: 'var(--color-surface)',
                fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {mode === 'detail' && id && (
            <Link data-testid="edit-stock-item" to={`/inventory/products/stock/${id}/edit`}
              style={secondary}>Edit</Link>
          )}
          <Link to="/inventory/products/stock" style={secondary}>Back</Link>
        </div>
      </Card>
    </>
  );
}

const secondary: React.CSSProperties = {
  ...buttonStyle('secondary', 'button'),
  padding: '0 18px',
  textDecoration: 'none',
};

function Field({
  label, testId, value, onChange, required = false, readOnly = false, error = null, name = '',
}: {
  readonly label: string; readonly testId: string; readonly value: string;
  readonly onChange?: (value: string) => void; readonly required?: boolean; readonly readOnly?: boolean;
  readonly error?: { field: string; message: string } | null; readonly name?: string;
}): React.JSX.Element {
  const errored = error != null && name !== '' && error.field === name;
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
        {label}
        {required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
      </label>
      <input
        data-testid={testId}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', height: 'var(--control-height-form)',
          borderRadius: 'var(--radius-control)', padding: '0 12px', fontSize: '13px', fontFamily: 'inherit',
          color: 'var(--color-text-primary)', background: 'var(--color-surface)',
          border: `1px solid ${errored ? 'var(--color-destructive)' : 'var(--color-border-form-control)'}`,
        }}
      />
    </div>
  );
}

/** 🔴 An immutable or derived FACT, deliberately not a disabled control (`RULE 3.18.e`). */
function ReadOnlyFact({
  label, testId, value, note,
}: {
  readonly label: string; readonly testId: string; readonly value: string; readonly note?: string;
}): React.JSX.Element {
  return (
    <div>
      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
        {label}
      </div>
      <div data-testid={testId} className="tabular-nums"
        style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {value}
      </div>
      {note && <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>{note}</div>}
    </div>
  );
}
