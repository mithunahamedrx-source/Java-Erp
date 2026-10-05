import { useState } from 'react';
import { ConfirmDialog } from '../ui/Overlay';
import { ApiError } from '../platform/api';
import { displayMoney, updateStockItem } from './stockItemApi';
import type { StockItem } from './stockItemApi';

/**
 * Edit a Stock Item in a popup - the owner's instruction, 2026-10-05.
 *
 * The Inventory SKU is IMMUTABLE (`PRD-011`, `PRD-013`) and is shown as a fact, not an input. Reference cost
 * (`PRD-206`) travels as the STRING typed, never a JavaScript Number (`TEC-015`). Stock and weighted average
 * cost are derived and have no input here at all.
 */
const AMOUNT = /^\d+(\.\d{1,4})?$/;

export default function StockItemEditDialog({
  item,
  onClose,
  onSaved,
}: {
  readonly item: StockItem;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(item.technicalName);
  const [unit, setUnit] = useState(item.unitOfMeasure);
  const [brand, setBrand] = useState(item.brand ?? '');
  const [category, setCategory] = useState(item.inventoryCategory ?? '');
  const [barcode, setBarcode] = useState(item.barcode ?? '');
  const [componentClass, setComponentClass] = useState(item.componentClass ?? '');
  const [cost, setCost] = useState(displayMoney(item.referenceCost));
  const [status, setStatus] = useState<string>(item.recordStatus);
  const [discontinued, setDiscontinued] = useState(item.discontinued);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costProblem = cost.trim() !== '' && !AMOUNT.test(cost.trim())
    ? 'The reference cost must be an amount such as 2500 or 2500.50.'
    : null;

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        technicalName: name,
        unitOfMeasure: unit,
        brand: brand || null,
        inventoryCategory: category || null,
        barcode: barcode || null,
        serializationPolicy: item.serializationPolicy,
        componentClass: componentClass || null,
        recordStatus: status,
        discontinued,
        version: item.version,
      };
      if (cost.trim() !== '') {
        body.referenceCost = cost.trim();
      }
      await updateStockItem(item.id, body);
      onSaved();
    } catch (cause) {
      const payload = cause instanceof ApiError ? (cause.payload as { message?: string } | null) : null;
      setError(payload?.message ?? (cause instanceof Error ? cause.message : 'The Stock Item could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title={`Edit ${item.inventorySku}`}
      consequence="Stock and weighted average cost are never typed here - they come from purchases and stock movements."
      confirmLabel="Save"
      cancelLabel="Cancel"
      busy={busy}
      error={error}
      width="560px"
      testId="stock-edit-dialog"
      confirmDisabled={costProblem !== null || name.trim() === '' || unit.trim() === ''}
      confirmDisabledReason={costProblem ?? 'Name and unit are required.'}
      onConfirm={() => void save()}
      onCancel={onClose}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3) var(--space-4)' }}>
        <Box label="Technical name" testId="edit-name" value={name} onChange={setName} wide />
        <Box label="Unit of measure" testId="edit-unit" value={unit} onChange={setUnit} />
        <Box label="Reference cost (৳)" testId="edit-cost" value={cost} onChange={setCost} error={costProblem} />
        <Box label="Brand" testId="edit-brand" value={brand} onChange={setBrand} />
        <Box label="Inventory category" testId="edit-category" value={category} onChange={setCategory} />
        <Box label="Barcode" testId="edit-barcode" value={barcode} onChange={setBarcode} />
        <Box label="Component class" testId="edit-class" value={componentClass} onChange={setComponentClass} />
        <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px' }}>
          <span style={{ fontWeight: 600 }}>Status</span>
          <select data-testid="edit-status" value={status} onChange={(event) => setStatus(event.target.value)} style={control}>
            {['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'].map((s) => (
              <option key={s} value={s}>{s === 'SUSPENDED' ? 'SUSPENDED (inactive)' : s}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '13px', fontWeight: 600, gridColumn: '1 / -1' }}>
          <input type="checkbox" data-testid="edit-discontinued" checked={discontinued}
            onChange={(event) => setDiscontinued(event.target.checked)} />
          Discontinued item
        </label>
      </div>
    </ConfirmDialog>
  );
}

const control: React.CSSProperties = {
  height: '36px', borderRadius: '9px', padding: '0 12px', border: '1px solid var(--color-border-control)',
  fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)', boxSizing: 'border-box', width: '100%',
};

function Box({ label, testId, value, onChange, wide = false, error = null }: {
  readonly label: string; readonly testId: string; readonly value: string;
  readonly onChange: (value: string) => void; readonly wide?: boolean; readonly error?: string | null;
}): React.JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: '12.5px', gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)}
        style={{ ...control, borderColor: error ? 'var(--color-destructive)' : 'var(--color-border-control)' }} />
      {error ? <span style={{ color: 'var(--color-destructive)', fontSize: '11.5px', fontWeight: 600 }}>{error}</span> : null}
    </label>
  );
}
