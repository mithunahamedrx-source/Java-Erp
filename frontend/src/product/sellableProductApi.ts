import { apiRequest } from '../platform/api';
import type { RecordStatus } from './stockItemApi';

/**
 * The Sellable Products API client.
 *
 * <p>🔴 Quantities arrive as JSON STRINGS (`TEC-015`) and are never parsed into a JavaScript
 * `Number`. The client computes no availability of its own — every figure below is derived
 * server-side from the resolution target (`PRD-023`) and rendered as received.
 *
 * <p>🔴 `availableSaleUnits` is NULLABLE, and `null` means NOT RESOLVABLE — never zero
 * (`SYS-034`). *No ACTIVE Build Template version* and *nothing buildable* are different
 * statements with different remedies, and the rendering layer must keep them apart.
 *
 * <p>🔴 THERE IS NO PRICE, COST, MARGIN OR LISTING FIELD in any type here, and none may be
 * added. Channel price belongs to `E-059` (`PRD-029`); a listing count has no canonical
 * counting basis (`PRD-150`, `UX-037.f`).
 */

export type SellableNature = 'SIMPLE' | 'ASSEMBLED' | 'BUNDLE';
export type BuildTemplateStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'WITHDRAWN';

export type SellableProduct = {
  readonly id: string;
  readonly sellableSku: string;
  readonly name: string;
  readonly nature: SellableNature;
  readonly description: string | null;
  readonly sellableCategory: string | null;
  readonly warrantyPackage: string | null;
  readonly recordStatus: RecordStatus;

  /** SIMPLE resolution (`PRD-021`) — a reference to the Stock Item, never a copy of it. */
  readonly simpleTargetVariantId: string | null;
  readonly simpleTargetInventorySku: string | null;
  readonly simpleTargetTechnicalName: string | null;
  readonly simpleQuantityPerSaleUnit: string | null;

  /** ASSEMBLED resolution (`PRD-021`, `PRD-067`). */
  readonly assembledFinishedVariantId: string | null;
  readonly assembledFinishedInventorySku: string | null;
  readonly assembledFinishedTechnicalName: string | null;
  readonly activeBuildTemplateId: string | null;
  readonly activeBuildTemplateVersion: number | null;
  readonly buildTemplateRequiredLineCount: number | null;

  /** BUNDLE resolution (`PRD-021`, `PRD-047`). */
  readonly bundleMemberCount: number | null;

  /** 🔴 Derived, never stored. `null` = NOT RESOLVABLE, never zero. */
  readonly availableSaleUnits: string | null;
  readonly availabilityConstrainedBy: string | null;
  readonly availabilityUnresolvedReason: string | null;

  readonly updatedAt: string;
  readonly version: number;
};

export type SellableProductPage = {
  readonly content: readonly SellableProduct[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
};

export type SellableProductSummary = {
  readonly totalSellableProducts: number;
  readonly simpleCount: number;
  readonly assembledCount: number;
  readonly bundleCount: number;
  /** `record_status = ACTIVE` — the canonical `SYS §7.1` state, not an invented "live". */
  readonly activeSellableProducts: number;
};

export type SellableProductFilters = {
  search?: string;
  nature?: SellableNature | '';
  status?: RecordStatus | '';
  sellableCategory?: string;
};

export type BomLine = {
  readonly id: string;
  readonly productVariantId: string;
  readonly inventorySku: string | null;
  readonly technicalName: string | null;
  readonly unitOfMeasure: string | null;
  readonly quantityRequired: string;
  readonly componentRole: string | null;
  readonly optional: boolean;
  readonly substitutionGroup: string | null;
  readonly position: number;
};

export type BuildTemplate = {
  readonly id: string;
  readonly versionNumber: number;
  readonly status: BuildTemplateStatus;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly assemblyNotes: string | null;
  readonly activatedAt: string | null;
  readonly activatedBy: string | null;
  readonly lines: readonly BomLine[];
  readonly version: number;
};

export type BundleMember = {
  readonly id: string;
  readonly memberSellableId: string;
  readonly memberSellableSku: string | null;
  readonly memberName: string | null;
  readonly memberNature: SellableNature | null;
  readonly quantity: string;
  readonly optional: boolean;
  readonly priceAllocationBasis: string | null;
  readonly position: number;
};

const BASE = '/api/product/sellable-products';

/** Only non-empty filters are sent, so an untouched control never narrows the result. */
function query(filters: SellableProductFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.nature) params.set('nature', filters.nature);
  if (filters.status) params.set('status', filters.status);
  if (filters.sellableCategory) params.set('sellableCategory', filters.sellableCategory);
  return params.toString();
}

export async function listSellableProducts(
  filters: SellableProductFilters,
  page: number,
  size: number,
  sort: string,
  direction: 'ASC' | 'DESC',
): Promise<SellableProductPage> {
  const params = new URLSearchParams(query(filters));
  params.set('page', String(page));
  params.set('size', String(size));
  params.set('sort', sort);
  params.set('direction', direction);
  return apiRequest<SellableProductPage>(`${BASE}?${params.toString()}`);
}

/** 🔴 A separate call because the summary is pagination-independent (`UX-044.b`). */
export async function fetchSellableSummary(
  filters: SellableProductFilters,
): Promise<SellableProductSummary> {
  return apiRequest<SellableProductSummary>(`${BASE}/summary?${query(filters)}`);
}

export async function fetchSellableProduct(id: string): Promise<SellableProduct> {
  return apiRequest<SellableProduct>(`${BASE}/${id}`);
}

/** 🔴 Includes SUPERSEDED versions — they are retained permanently (`PRD-068`). */
export async function fetchBuildTemplates(id: string): Promise<readonly BuildTemplate[]> {
  return apiRequest<readonly BuildTemplate[]>(`${BASE}/${id}/build-templates`);
}

export async function fetchBundleMembers(id: string): Promise<readonly BundleMember[]> {
  return apiRequest<readonly BundleMember[]>(`${BASE}/${id}/members`);
}

export async function createSellableProduct(body: Record<string, unknown>): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(BASE, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateSellableProduct(id: string, body: Record<string, unknown>): Promise<void> {
  await apiRequest<void>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

/** 🔴 `PRD-069` — always a NEW version. There is no edit-the-active-one call. */
export async function createDraftTemplate(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`${BASE}/${id}/build-templates`, { method: 'POST', body: '{}' });
}

export async function addBomLine(
  templateId: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`${BASE}/build-templates/${templateId}/lines`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function removeBomLine(templateId: string, lineId: string): Promise<void> {
  await apiRequest<void>(`${BASE}/build-templates/${templateId}/lines/${lineId}`, { method: 'DELETE' });
}

/**
 * 🔴 A SEPARATE capability — `product.build-template.activate`, not `manage` (`PRD-155`).
 * Authoring a draft never carries authority to activate it.
 */
export async function activateTemplate(templateId: string): Promise<void> {
  await apiRequest<void>(`${BASE}/build-templates/${templateId}/activate`, {
    method: 'POST',
    body: '{}',
  });
}

export async function addBundleMember(
  id: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`${BASE}/${id}/members`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function removeBundleMember(id: string, memberId: string): Promise<void> {
  await apiRequest<void>(`${BASE}/${id}/members/${memberId}`, { method: 'DELETE' });
}

/** 🔴 Export follows the ACTIVE filters, never the visible page (`UX-044.b`). */
export function sellableExportUrl(filters: SellableProductFilters): string {
  return `${BASE}/export?${query(filters)}`;
}

export function sellableTemplateUrl(): string {
  return `${BASE}/import/template`;
}

export async function validateSellableImport(csv: string): Promise<import('./stockItemApi').ImportPlan> {
  return apiRequest(`${BASE}/import/validate`, { method: 'POST', body: JSON.stringify({ csv }) });
}

export async function confirmSellableImport(planId: string): Promise<import('./stockItemApi').ImportResult> {
  return apiRequest(`${BASE}/import/confirm`, { method: 'POST', body: JSON.stringify({ planId }) });
}
