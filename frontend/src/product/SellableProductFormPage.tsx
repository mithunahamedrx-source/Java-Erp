import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import {
  createSellableProduct,
  fetchSellableProduct,
  updateSellableProduct,
} from './sellableProductApi';
import type { SellableNature, SellableProduct } from './sellableProductApi';
import { ApiError } from '../platform/api';

/**
 * Create or edit one Sellable Product.
 *
 * <p>Archetype D control language (`§3.18`) — permanent labels above the control, the enabled
 * boundary, the mandatory error marker AND message (`RULE 3.18.f`).
 *
 * <p>🔴 NATURE IS CHOSEN ONCE AND NEVER CHANGED (`PRD-070`, `INV-58.3`). On create it is a
 * control; on edit it is a READ-ONLY FACT, not a disabled control — `RULE 3.18.e` records that
 * disabled is not the same class as immutable and the two must not borrow one another's
 * treatment.
 *
 * <p>🔴 THE FORM IS NATURE-CONDITIONAL (`PRD-021`). A `SIMPLE` product asks for its Stock Item
 * mapping; `ASSEMBLED` and `BUNDLE` do not, because their resolution targets are structured
 * relationships authored on the detail surface. A universal form exposing irrelevant fields for
 * every nature would invite exactly the inconsistent pairs `INV-58.2` forbids.
 *
 * <p>🔴 There is no price, cost, margin, stock or listing input anywhere on this form. A client
 * cannot ask this surface to write one, because it has nowhere to put it.
 */
export default function SellableProductFormPage({
  mode,
}: {
  readonly mode: 'create' | 'edit';
}): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<SellableProduct | null>(null);
  type FormState = {
    sellableSku: string;
    name: string;
    nature: SellableNature;
    description: string;
    sellableCategory: string;
    warrantyPackage: string;
    recordStatus: string;
    simpleTargetInventorySku: string;
    simpleQuantityPerSaleUnit: string;
    assembledFinishedInventorySku: string;
  };
  const [form, setForm] = useState<FormState>({
    sellableSku: '',
    name: '',
    nature: 'SIMPLE',
    description: '',
    sellableCategory: '',
    warrantyPackage: '',
    recordStatus: 'DRAFT',
    simpleTargetInventorySku: '',
    simpleQuantityPerSaleUnit: '1',
    assembledFinishedInventorySku: '',
  });
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (mode === 'create' || !id) return;
    setLoading(true);
    fetchSellableProduct(id)
      .then((loaded) => {
        setItem(loaded);
        setForm({
          sellableSku: loaded.sellableSku,
          name: loaded.name,
          nature: loaded.nature,
          description: loaded.description ?? '',
          sellableCategory: loaded.sellableCategory ?? '',
          warrantyPackage: loaded.warrantyPackage ?? '',
          recordStatus: loaded.recordStatus,
          simpleTargetInventorySku: loaded.simpleTargetInventorySku ?? '',
          simpleQuantityPerSaleUnit: loaded.simpleQuantityPerSaleUnit ?? '',
          assembledFinishedInventorySku: loaded.assembledFinishedInventorySku ?? '',
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
        name: form.name,
        description: form.description || null,
        sellableCategory: form.sellableCategory || null,
        warrantyPackage: form.warrantyPackage || null,
        recordStatus: form.recordStatus,
      };
      // 🔴 The SIMPLE resolution fields are sent ONLY for a SIMPLE product. Sending them for
      // an ASSEMBLED or BUNDLE product is refused server-side (PRD-021), and the form must not
      // manufacture that refusal by habit.
      if (form.nature === 'SIMPLE') {
        body.simpleTargetInventorySku = form.simpleTargetInventorySku || null;
        body.simpleQuantityPerSaleUnit = form.simpleQuantityPerSaleUnit || null;
      }
      if (form.nature === 'ASSEMBLED') {
        body.assembledFinishedInventorySku = form.assembledFinishedInventorySku || null;
      }
      if (mode === 'create') {
        body.sellableSku = form.sellableSku;
        body.nature = form.nature;
        const created = await createSellableProduct(body);
        void navigate(`/inventory/products/sellable/${created.id}`);
        return;
      }
      if (id) {
        // 🔴 `nature` is deliberately NOT sent on update. PRD-070 makes it immutable, and the
        // server refuses a change; omitting it means the form cannot even express the attempt.
        body.version = item?.version;
        await updateSellableProduct(id, body);
        void navigate(`/inventory/products/sellable/${id}`);
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        const payload = cause instanceof ApiError
          ? (cause.payload as { field?: string; message?: string } | null) : null;
        setFieldError({
          field: payload?.field ?? '',
          message: payload?.message
            ?? (cause instanceof Error ? cause.message : 'The Sellable Product could not be saved.'),
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
        <EmptyState title="Loading…" guidance="Fetching the Sellable Product." />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={mode === 'create' ? 'Create Sellable Product' : (item?.name ?? 'Sellable Product')}
        subtitle="Products · Sellable Products"
      />

      <Card>
        <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
          {mode === 'create' ? (
            <Field label="Sellable SKU" testId="field-sellableSku" required value={form.sellableSku}
              onChange={(v) => setForm({ ...form, sellableSku: v })} error={fieldError} name="sellable_sku" />
          ) : (
            <ReadOnlyFact label="Sellable SKU" testId="fact-sellableSku" value={form.sellableSku}
              note="Immutable — a separate identifier space from the Inventory SKU (PRD-011)." />
          )}

          {mode === 'create' ? (
            <div>
              <label style={labelStyle}>
                Nature<span style={{ color: 'var(--color-destructive)' }}> *</span>
              </label>
              <select
                data-testid="field-nature"
                aria-label="Nature"
                value={form.nature}
                onChange={(event) => setForm({ ...form, nature: event.target.value as SellableNature })}
                style={controlStyle(fieldError?.field === 'nature')}
              >
                <option value="SIMPLE">SIMPLE — resolves to one Stock Item</option>
                <option value="ASSEMBLED">ASSEMBLED — resolves to a finished Stock Item and Build Template</option>
                <option value="BUNDLE">BUNDLE — resolves to member Sellable Products</option>
              </select>
              <div style={noteStyle}>
                🔴 Chosen once. Nature is immutable (PRD-070) — a SIMPLE product never becomes
                ASSEMBLED; that is a new Sellable Product.
              </div>
            </div>
          ) : (
            <ReadOnlyFact label="Nature" testId="fact-nature" value={form.nature}
              note="Immutable (PRD-070). Cost basis, availability derivation, warranty model and return handling all follow from it." />
          )}

          <Field label="Name" testId="field-name" required value={form.name}
            onChange={(v) => setForm({ ...form, name: v })} error={fieldError} name="name" />
          <Field label="Sellable category" testId="field-sellableCategory" value={form.sellableCategory}
            onChange={(v) => setForm({ ...form, sellableCategory: v })} />
          <Field label="Description" testId="field-description" value={form.description}
            onChange={(v) => setForm({ ...form, description: v })} />
          <Field label="Warranty package" testId="field-warrantyPackage" value={form.warrantyPackage}
            onChange={(v) => setForm({ ...form, warrantyPackage: v })} />

          <div>
            <label style={labelStyle}>Record status</label>
            <select
              data-testid="field-recordStatus"
              aria-label="Record status"
              value={form.recordStatus}
              onChange={(event) => setForm({ ...form, recordStatus: event.target.value })}
              style={controlStyle(fieldError?.field === 'record_status')}
            >
              {['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 🔴 SIMPLE resolution only (PRD-021). Never rendered for the other two natures. */}
          {form.nature === 'SIMPLE' && (
            <>
              <Field label="Stock Item — Inventory SKU" testId="field-simpleTarget"
                required={mode === 'create'} value={form.simpleTargetInventorySku}
                onChange={(v) => setForm({ ...form, simpleTargetInventorySku: v })}
                error={fieldError} name="simple_target_inventory_sku" />
              <Field label="Quantity per sale unit" testId="field-simpleQuantity"
                required={mode === 'create'} value={form.simpleQuantityPerSaleUnit}
                onChange={(v) => setForm({ ...form, simpleQuantityPerSaleUnit: v })}
                error={fieldError} name="simple_quantity_per_sale_unit" />
              <div style={{ gridColumn: '1 / -1', ...noteStyle }}>
                🔴 The mapping is EXPLICIT. A name is never identity (PRD-056) — the Inventory SKU
                must resolve to an existing Stock Item, and no Stock Item is duplicated by this.
              </div>
            </>
          )}

          {form.nature === 'ASSEMBLED' && (
            <>
              {mode === 'create' ? (
                <Field label="Finished Stock Item — Inventory SKU" testId="field-assembledFinished"
                  required value={form.assembledFinishedInventorySku}
                  onChange={(v) => setForm({ ...form, assembledFinishedInventorySku: v })}
                  error={fieldError} name="assembled_finished_inventory_sku" />
              ) : (
                <ReadOnlyFact label="Finished Stock Item" testId="fact-assembledFinished"
                  value={form.assembledFinishedInventorySku || 'Not mapped'}
                  note="Immutable ready-built inventory identity (PRD-156, PRD-161)." />
              )}
              <div data-testid="assembled-note" style={{ gridColumn: '1 / -1', ...noteStyle }}>
                An ASSEMBLED Sellable Product resolves to its finished Stock Item for ready-built
                units and to its ACTIVE Build Template version (PRD-156, PRD-081). Templates and
                component lines are authored on the detail surface after creation.
              </div>
            </>
          )}

          {form.nature === 'BUNDLE' && (
            <div data-testid="bundle-note" style={{ gridColumn: '1 / -1', ...noteStyle }}>
              A BUNDLE resolves to member Sellable Products with quantities (PRD-021, PRD-047).
              Members are authored on this product's detail surface after it is created. Bundle
              nesting is limited to one level (PRD-048), and defining a bundle creates no
              physical inventory and no stock movement.
            </div>
          )}
        </div>

        {fieldError && (
          <div role="alert" data-testid="sellable-form-error"
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
          <button type="button" data-testid="save-sellable-product" disabled={saving}
            onClick={() => void save()}
            style={{
              height: 'var(--control-height-button)', padding: '0 18px', background: 'var(--color-ink)',
              border: 'none', borderRadius: 'var(--radius-control)', color: 'var(--color-surface)',
              fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link to="/inventory/products/sellable" style={secondary}>Back</Link>
        </div>
      </Card>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11.5px', fontWeight: 600,
  color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)',
};

const noteStyle: React.CSSProperties = {
  fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)',
};

function controlStyle(errored: boolean): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box', height: 'var(--control-height-form)',
    borderRadius: 'var(--radius-control)', padding: '0 12px', fontSize: '13px', fontFamily: 'inherit',
    color: 'var(--color-text-primary)', background: 'var(--color-surface)',
    border: `1px solid ${errored ? 'var(--color-destructive)' : 'var(--color-border-form-control)'}`,
  };
}

const secondary: React.CSSProperties = {
  ...buttonStyle('secondary', 'button'),
  padding: '0 18px',
  textDecoration: 'none',
};

function Field({
  label, testId, value, onChange, required = false, error = null, name = '',
}: {
  readonly label: string; readonly testId: string; readonly value: string;
  readonly onChange?: (value: string) => void; readonly required?: boolean;
  readonly error?: { field: string; message: string } | null; readonly name?: string;
}): React.JSX.Element {
  const errored = error != null && name !== '' && error.field === name;
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
      </label>
      <input
        data-testid={testId}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        style={controlStyle(errored)}
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
      <div style={labelStyle}>{label}</div>
      <div data-testid={testId} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {value}
      </div>
      {note && <div style={noteStyle}>{note}</div>}
    </div>
  );
}
