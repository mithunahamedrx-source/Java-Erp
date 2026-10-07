import { apiRequest } from '../platform/api';

/** The Supplier Ledger client (`PRC-052`). Money crosses as strings and is never parsed into a Number (`TEC-015`). */
export type LedgerEntry = {
  readonly date: string; readonly type: string; readonly reference: string; readonly documentId: string;
  readonly description: string; readonly status: string; readonly memo: boolean;
  readonly debit: string | null; readonly credit: string | null; readonly ordered: string;
};
export type Ledger = {
  readonly supplier: { readonly id: string; readonly name: string; readonly contactName: string | null; readonly phone: string | null;
    readonly email: string | null; readonly address: string | null; readonly currency: string };
  readonly from: string | null; readonly to: string | null; readonly entries: readonly LedgerEntry[];
  readonly totalOrdered: string; readonly orders: number; readonly outstandingBalance: string | null;
};

/** The seven transaction types of the ledger (`PRC-052`) plus the purchase-order memo; only the memo has entries so far. */
export const LEDGER_TYPES: readonly (readonly [string, string])[] = [
  ['', 'All types'], ['PURCHASE_ORDER', 'Purchase order (memo)'], ['PURCHASE', 'Purchase'], ['PAYMENT', 'Payment'],
  ['ADVANCE_PAYMENT', 'Advance payment'], ['SUPPLIER_RETURN', 'Supplier return'], ['EXCHANGE', 'Exchange'], ['CREDIT_NOTE', 'Credit note / adjustment'],
];

export const fetchSupplierLedger = (id: string, p: { from?: string; to?: string; type?: string }) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
  return apiRequest<Ledger>(`/api/procurement/suppliers/${id}/ledger${q.size ? `?${q.toString()}` : ''}`);
};
