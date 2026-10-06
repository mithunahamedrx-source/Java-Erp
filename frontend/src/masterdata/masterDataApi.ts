import { apiRequest } from '../platform/api';

/**
 * The master-data client: Warehouses, Stock Locations (`warehouse` module) and Suppliers (`procurement`). Nothing is
 * ever deleted - archiving is a status change (`INV-4.3`, `PRC-011`) - so there is no delete call.
 */
export type RecordStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type Paged<T, K> = {
  readonly content: readonly T[];
  readonly totalElements: number;
  readonly page: number;
  readonly size: number;
  readonly totalPages: number;
  readonly kpis: K;
};

export type Warehouse = {
  readonly id: string; readonly identifier: string; readonly name: string; readonly address: string | null;
  readonly recordStatus: RecordStatus; readonly locations: number; readonly quarantineLocations: number;
  readonly updatedAt: string; readonly version: number;
};
export type WarehouseKpis = { readonly warehouses: number; readonly active: number; readonly archived: number; readonly locations: number; readonly quarantineLocations: number };

export type LocationType = 'STORAGE' | 'STAGING' | 'DESPATCH' | 'QUARANTINE' | 'SCRAP' | 'BUILD_STAGING';
export const LOCATION_TYPES: readonly (readonly [LocationType, string])[] = [
  ['STORAGE', 'Storage'], ['STAGING', 'Staging'], ['DESPATCH', 'Despatch'],
  ['QUARANTINE', 'Quarantine'], ['SCRAP', 'Scrap'], ['BUILD_STAGING', 'Build staging'],
];
export const locationTypeLabel = (type: string): string => LOCATION_TYPES.find(([v]) => v === type)?.[1] ?? type;

export type StockLocation = {
  readonly id: string; readonly warehouseId: string; readonly warehouseName: string; readonly identifier: string;
  readonly description: string | null; readonly locationType: LocationType; readonly sellable: boolean;
  readonly recordStatus: RecordStatus; readonly updatedAt: string; readonly version: number;
};
export type LocationKpis = { readonly locations: number; readonly storage: number; readonly quarantine: number; readonly buildStaging: number; readonly scrap: number };

export type Supplier = {
  readonly id: string; readonly name: string; readonly contactName: string | null; readonly phone: string | null;
  readonly email: string | null; readonly address: string | null; readonly currency: string; readonly externalReference: string | null;
  readonly activeFrom: string | null; readonly activeUntil: string | null; readonly recordStatus: RecordStatus;
  readonly createdAt: string; readonly updatedAt: string; readonly version: number;
  /** Derived from purchase orders (`PRC-009`); live orders only, in the supplier's currency. */
  readonly orders?: number; readonly totalPurchaseValue?: string;
};
export type SupplierKpis = { readonly suppliers: number; readonly active: number; readonly archived: number };

const query = (params: Record<string, string | number | undefined | null>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  return q.toString();
};

export const listWarehouses = (p: { search?: string; status?: string; page: number; size: number }) =>
  apiRequest<Paged<Warehouse, WarehouseKpis>>(`/api/warehouse/warehouses?${query(p)}`);
export const saveWarehouse = (id: string | null, body: Record<string, unknown>) =>
  id ? apiRequest<void>(`/api/warehouse/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(body) })
     : apiRequest<{ id: string }>('/api/warehouse/warehouses', { method: 'POST', body: JSON.stringify(body) });

export const listLocations = (p: { search?: string; warehouseId?: string; type?: string; sellable?: string; status?: string; page: number; size: number }) =>
  apiRequest<Paged<StockLocation, LocationKpis>>(`/api/warehouse/locations?${query(p)}`);
export const saveLocation = (id: string | null, body: Record<string, unknown>) =>
  id ? apiRequest<void>(`/api/warehouse/locations/${id}`, { method: 'PUT', body: JSON.stringify(body) })
     : apiRequest<{ id: string }>('/api/warehouse/locations', { method: 'POST', body: JSON.stringify(body) });

export const listSuppliers = (p: { search?: string; status?: string; page: number; size: number }) =>
  apiRequest<Paged<Supplier, SupplierKpis>>(`/api/procurement/suppliers?${query(p)}`);
export const saveSupplier = (id: string | null, body: Record<string, unknown>) =>
  id ? apiRequest<void>(`/api/procurement/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(body) })
     : apiRequest<{ id: string }>('/api/procurement/suppliers', { method: 'POST', body: JSON.stringify(body) });
