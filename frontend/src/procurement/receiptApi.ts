import { apiRequest } from '../platform/api';
import type { Paged } from '../masterdata/masterDataApi';

/**
 * The Goods Receipt client. Money and quantities cross as STRINGS and are never parsed into a JavaScript Number (`TEC-015`);
 * the one piece of arithmetic here - a line's accepted value - is done in whole scaled integers with `BigInt`.
 */
export type GoodsReceipt = {
  readonly id: string; readonly receiptNumber: string; readonly supplierId: string; readonly supplierName: string;
  readonly purchaseOrderId: string | null; readonly poNumber: string | null; readonly receivedDate: string;
  readonly supplierInvoiceReference: string | null; readonly lines: number; readonly unitsReceived: string; readonly unitsAccepted: string;
  readonly hasIssues: boolean; readonly acceptedValue: string; readonly currency: string; readonly recordedBy: string | null;
  readonly acceptedBy: string | null; readonly recordedAt: string;
};
export type GoodsReceiptKpis = { readonly receipts: number; readonly lines: number; readonly unitsAccepted: string; readonly withIssues: number };
export type GoodsReceiptItem = {
  readonly id: string; readonly lineNumber: number; readonly productVariantId: string; readonly sku: string; readonly name: string;
  readonly poLineNumber: number | null; readonly quantityReceived: string; readonly quantityAccepted: string; readonly unitCost: string;
  readonly acceptedValue: string; readonly discrepancyType: string | null; readonly discrepancyNote: string | null;
};
export type GoodsReceiptDetail = { readonly receipt: GoodsReceipt; readonly warehouseName: string | null; readonly note: string | null; readonly items: readonly GoodsReceiptItem[] };
export type ReceivableOrder = { readonly id: string; readonly poNumber: string; readonly supplierId: string; readonly supplierName: string; readonly orderDate: string; readonly status: string };
export type OrderLine = {
  readonly purchaseOrderItemId: string; readonly lineNumber: number; readonly productVariantId: string; readonly sku: string; readonly name: string;
  readonly ordered: string; readonly accepted: string; readonly remaining: string; readonly unitCost: string;
};

export type ReceiptItemBody = {
  purchaseOrderItemId: string | null; productVariantId: string; quantityReceived: string; quantityAccepted: string; unitCost: string;
  discrepancyType: string | null; discrepancyNote: string | null;
};
export type ReceiptBody = {
  supplierId: string; purchaseOrderId: string | null; warehouseId: string | null; receivedDate: string | null;
  supplierInvoiceReference: string | null; note: string | null; items: ReceiptItemBody[];
};

/** The four discrepancy types (`PRC-038`). */
export const DISCREPANCIES: readonly (readonly [string, string])[] = [
  ['SHORTAGE', 'Shortage'], ['WRONG_ITEM', 'Wrong item'], ['DAMAGED', 'Damaged'], ['EXCESS', 'Excess'],
];
export const discrepancyLabel = (type: string | null): string => DISCREPANCIES.find(([v]) => v === type)?.[1] ?? type ?? '';

const query = (params: Record<string, string | number | undefined | null>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  return q.toString();
};

const base = '/api/procurement/goods-receipts';
export const listGoodsReceipts = (p: { search?: string; supplierId?: string; issues?: string; from?: string; to?: string; page: number; size: number }) =>
  apiRequest<Paged<GoodsReceipt, GoodsReceiptKpis>>(`${base}?${query(p)}`);
export const fetchGoodsReceipt = (id: string) => apiRequest<GoodsReceiptDetail>(`${base}/${id}`);
export const receivableOrders = (supplierId?: string) => apiRequest<ReceivableOrder[]>(`${base}/receivable-orders?${query({ supplierId })}`);
export const orderLines = (purchaseOrderId: string) => apiRequest<OrderLine[]>(`${base}/order-lines/${purchaseOrderId}`);
export const recordGoodsReceipt = (body: ReceiptBody) => apiRequest<{ id: string }>(base, { method: 'POST', body: JSON.stringify(body) });

/** The smaller of two non-negative decimal strings (quantities), exactly. */
export function minQuantity(a: string, b: string): string {
  const scale = (t: string): bigint | null => {
    const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(t.trim());
    return m ? BigInt((m[1] ?? '0') + (m[2] ?? '').padEnd(4, '0')) : null;
  };
  const x = scale(a);
  const y = scale(b);
  if (x === null) return b;
  if (y === null) return a;
  return x <= y ? a : b;
}

/** True when `accepted` is a valid quantity below `received` - the line then needs a discrepancy. */
export function isShort(received: string, accepted: string): boolean {
  const scale = (t: string): bigint | null => {
    const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(t.trim());
    return m ? BigInt((m[1] ?? '0') + (m[2] ?? '').padEnd(4, '0')) : null;
  };
  const r = scale(received);
  const a = scale(accepted);
  return r !== null && a !== null && a < r;
}
