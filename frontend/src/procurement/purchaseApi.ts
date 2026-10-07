import { apiRequest } from '../platform/api';
import type { Paged } from '../masterdata/masterDataApi';

/**
 * The Purchase Order client. Money crosses as STRINGS and is never parsed into a JavaScript Number (`TEC-015`); the one
 * piece of arithmetic here - a line total and an order total, shown while typing - is done in whole scaled integers with
 * `BigInt`, so it is exact. The server recomputes and is authoritative.
 */
export type PurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';

export type PurchaseOrder = {
  readonly id: string; readonly poNumber: string; readonly supplierId: string; readonly supplierName: string;
  readonly orderDate: string; readonly expectedDate: string | null; readonly currency: string;
  readonly supplierOrderReference: string | null; readonly status: PurchaseOrderStatus; readonly lines: number; readonly total: string;
  readonly supplierShipped: boolean; readonly amendable: boolean; readonly createdBy: string | null; readonly approvedBy: string | null;
  readonly createdAt: string; readonly updatedAt: string; readonly version: number;
};
export type PurchaseOrderKpis = { readonly orders: number; readonly open: number; readonly awaitingApproval: number; readonly amendable: number; readonly cancelled: number };

export type PurchaseOrderItem = {
  readonly id: string; readonly lineNumber: number; readonly productVariantId: string; readonly sku: string; readonly name: string;
  readonly quantityOrdered: string | number; readonly quantityReceived: string | number; readonly unitCost: string; readonly lineTotal: string;
  readonly currency: string; readonly expectedDate: string | null;
};
export type HistoryEntry = { readonly action: string; readonly reason: string | null; readonly detail: string | null; readonly actedBy: string | null; readonly actedAt: string };
export type SupplierContact = { readonly name: string; readonly contactName: string | null; readonly phone: string | null; readonly email: string | null; readonly address: string | null };
export type PurchaseOrderDetail = { readonly order: PurchaseOrder; readonly items: readonly PurchaseOrderItem[]; readonly history: readonly HistoryEntry[]; readonly supplier: SupplierContact };

export type ItemBody = { productVariantId: string; quantity: string; unitCost: string; expectedDate?: string | null };
export type OrderBody = {
  supplierId: string; orderDate?: string | null; expectedDate?: string | null; currency?: string | null; supplierOrderReference?: string | null;
  items: ItemBody[]; reason?: string | null; supplierAgreed?: boolean | null; version?: number | null;
};

const query = (params: Record<string, string | number | undefined | null>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  return q.toString();
};

const base = '/api/procurement/purchase-orders';
export const listPurchaseOrders = (p: { search?: string; status?: string; supplierId?: string; shipped?: string; page: number; size: number }) =>
  apiRequest<Paged<PurchaseOrder, PurchaseOrderKpis>>(`${base}?${query(p)}`);
export const fetchPurchaseOrder = (id: string) => apiRequest<PurchaseOrderDetail>(`${base}/${id}`);
export const createPurchaseOrder = (body: OrderBody) => apiRequest<{ id: string }>(base, { method: 'POST', body: JSON.stringify(body) });
export const updatePurchaseOrder = (id: string, body: OrderBody) => apiRequest<void>(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const approvePurchaseOrder = (id: string) => apiRequest<void>(`${base}/${id}/approve`, { method: 'POST' });
export const sendPurchaseOrder = (id: string) => apiRequest<void>(`${base}/${id}/send`, { method: 'POST' });
export const recordSupplierShipment = (id: string) => apiRequest<void>(`${base}/${id}/supplier-shipped`, { method: 'POST' });
export const cancelPurchaseOrder = (id: string, body: { reason: string; supplierAgreed: boolean; version?: number }) =>
  apiRequest<void>(`${base}/${id}/cancel`, { method: 'POST', body: JSON.stringify(body) });

// ---------------------------------------------------------------------------------------------- exact arithmetic

const DECIMAL = /^\d+(\.\d+)?$/;

/** `"700.50"` -> `700500000n` at scale 8 (4 places of quantity x 4 of cost); `null` where the text is not a number. */
function scaled(text: string, places: number): bigint | null {
  const t = text.trim();
  if (!DECIMAL.test(t)) return null;
  const [whole = '0', fraction = ''] = t.split('.');
  if (fraction.length > places) return null;
  return BigInt(whole + fraction.padEnd(places, '0'));
}

/** quantity x unit cost as a plain decimal string (exact), or `null` while either is not yet a valid number. */
export function lineTotal(quantity: string, unitCost: string): string | null {
  const q = scaled(quantity, 4);
  const c = scaled(unitCost, 4);
  if (q === null || c === null) return null;
  return fromScaled(q * c, 8);
}

export function sumTotals(totals: readonly (string | null)[]): string | null {
  let sum = 0n;
  for (const t of totals) {
    if (t === null) return null;
    sum += scaled(t, 8) ?? 0n;
  }
  return fromScaled(sum, 8);
}

function fromScaled(value: bigint, places: number): string {
  const digits = value.toString().padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);
  const fraction = digits.slice(digits.length - places).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/** A quantity for display: no trailing zeros (`"4.0000"` -> `"4"`). */
export function displayQuantity(value: string | number): string {
  const text = String(value);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Awaiting approval', APPROVED: 'Approved', SENT: 'Sent to supplier', PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received', CLOSED: 'Closed', CANCELLED: 'Cancelled',
};
