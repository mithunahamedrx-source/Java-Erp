import { apiRequest } from '../platform/api';

/**
 * The Stock Items API client.
 *
 * <p>🔴 Money and quantity arrive as JSON STRINGS (`TEC-015`) and are never parsed into a
 * JavaScript `Number` — an IEEE-754 double silently corrupts a taka figure. They are carried
 * as strings and rendered as strings; the client computes no monetary value at all
 * (`TEC-095`).
 *
 * <p>🔴 `stockValue`, `weightedAverageCost` and `totalStockValue` are OPTIONAL. An absent
 * field means WITHHELD for want of `inventory-costing.valuation.view` — never zero
 * (`ICO-038.a`). The rendering layer must distinguish the two.
 */

export type RecordStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type SerializationPolicy = 'NOT_SERIALIZED' | 'SERIALIZED';

export type StockItem = {
  readonly id: string;
  readonly inventorySku: string;
  readonly technicalName: string;
  readonly brand: string | null;
  readonly inventoryCategory: string | null;
  readonly unitOfMeasure: string;
  readonly barcode: string | null;
  readonly serializationPolicy: SerializationPolicy;
  readonly componentClass: string | null;
  readonly recordStatus: RecordStatus;
  /** Derived by Inventory, never stored (`DB-001`). */
  readonly physicalStock: string;
  readonly availableQuantity: string;
  /** `IVN-055` — `available_quantity <= 0`, evaluated server-side. */
  readonly outOfStock: boolean;
  readonly weightedAverageCost?: string | null;
  readonly stockValue?: string | null;
  readonly updatedAt: string;
  readonly version: number;
};

export type StockItemPage = {
  readonly content: readonly StockItem[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
};

export type StockItemSummary = {
  readonly totalStockItems: number;
  readonly physicalStockUnits: string;
  readonly availableUnits: string;
  readonly outOfStockItems: number;
  /** Absent when the actor lacks valuation authority. 🔴 Absent is NOT zero. */
  readonly totalStockValue?: string | null;
};

export type StockItemFilters = {
  search?: string;
  status?: RecordStatus | '';
  category?: string;
  brand?: string;
  serializationPolicy?: SerializationPolicy | '';
  componentClass?: string;
  outOfStockOnly?: boolean;
};

export type ImportOutcome = {
  readonly rowNumber: number;
  readonly result: 'VALID' | 'WARNING' | 'ERROR';
  readonly field: string | null;
  readonly message: string;
};

export type ImportPlan = {
  readonly planId: string;
  readonly validRows: number;
  readonly errorRows: number;
  readonly outcomes: readonly ImportOutcome[];
};

export type ImportResult = {
  readonly planId: string;
  readonly created: number;
  readonly updated: number;
  readonly outcomes: readonly ImportOutcome[];
};

/** Only non-empty filters are sent, so an untouched control never narrows the result. */
function query(filters: StockItemFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.serializationPolicy) params.set('serializationPolicy', filters.serializationPolicy);
  if (filters.componentClass) params.set('componentClass', filters.componentClass);
  if (filters.outOfStockOnly) params.set('outOfStockOnly', 'true');
  return params.toString();
}

export async function listStockItems(
  filters: StockItemFilters,
  page: number,
  size: number,
  sort: string,
  direction: 'ASC' | 'DESC',
): Promise<StockItemPage> {
  const params = new URLSearchParams(query(filters));
  params.set('page', String(page));
  params.set('size', String(size));
  params.set('sort', sort);
  params.set('direction', direction);
  return apiRequest<StockItemPage>(`/api/product/stock-items?${params.toString()}`);
}

/** 🔴 A separate call because the summary is pagination-independent (`UX-044.b`). */
export async function fetchSummary(filters: StockItemFilters): Promise<StockItemSummary> {
  return apiRequest<StockItemSummary>(`/api/product/stock-items/summary?${query(filters)}`);
}

export async function fetchStockItem(id: string): Promise<StockItem> {
  return apiRequest<StockItem>(`/api/product/stock-items/${id}`);
}

export async function createStockItem(body: Record<string, unknown>): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/api/product/stock-items', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateStockItem(id: string, body: Record<string, unknown>): Promise<void> {
  await apiRequest<void>(`/api/product/stock-items/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * 🔴 Export follows the ACTIVE filters, never the visible page (`UX-044.b`). The server
 * decides which columns the actor may receive; the client sends no column list.
 */
export function exportUrl(filters: StockItemFilters): string {
  return `/api/product/stock-items/export?${query(filters)}`;
}

export function templateUrl(): string {
  return '/api/product/stock-items/import/template';
}

/** 🔴 Validation writes nothing (`API-060.f`). */
export async function validateImport(csv: string): Promise<ImportPlan> {
  return apiRequest<ImportPlan>('/api/product/stock-items/import/validate', {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
}

export async function confirmImport(planId: string): Promise<ImportResult> {
  return apiRequest<ImportResult>('/api/product/stock-items/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
}
