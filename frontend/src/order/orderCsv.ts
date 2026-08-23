import type { ChannelOrderRow } from './orderApi';
import { canonicalStatus, canonicalStatusLabel, customerName, paymentPosition, primaryStatus } from './orderView';

/**
 * The Orders CSV export — `RPT-046`, `UX-044`.
 *
 * 🔴 EXPORT IS NOT A SCREENSHOT OF THE PAGE. `UX-044.b` — *pagination is presentation and never
 * defines export scope; exporting only the visible page is a silent truncation.* With the page
 * size at five that failure would be severe, so the caller resolves the scope before calling
 * here: an explicit SELECTION, or the ACTIVE RESULT SET under the current search and filters
 * (`UX-044.a`).
 *
 * 🔴 NO ENTITY CLASSES ARE MIXED (`UX-044.e`, `PRD-148`). One row is one Order. Order ITEMS are a
 * different class and are not flattened into these columns.
 *
 * 🔴 TWO STATUSES STAY TWO COLUMNS (`BR-171`, `UX-182`, `UX-038`). Merging Trioloo's operational
 * reading with the marketplace's own word into one `status` column is exactly the merge of
 * independently-owned states that `UX-044.e` forbids — and a spreadsheet is where that merge
 * would do the most damage, because the reader has no chip, no tooltip and no page to correct it.
 */
export const ORDER_CSV_COLUMNS = [
  'Invoice number',
  'Marketplace order id',
  'Shop',
  'Order date',
  'Customer',
  'Contact',
  'Delivery address',
  'ERP status',
  'Marketplace status',
  'Payment position',
  'Payment method',
  'Items',
  'Sale',
  'Cost',
  'Charges',
  'Received',
  'Margin',
  'Item',
  'Tracking',
  'Purchase order',
  'Buyer note',
] as const;

/**
 * ⚠ UNKNOWN IS WRITTEN AS THE WORD, NOT AS AN EMPTY CELL AND NEVER AS ZERO.
 *
 * 🔴 `INV-32.4` / `BR-007` / `SYS-034` — an unknown cost is unknown, not `0`. In a spreadsheet
 * this matters more than on the card, because an empty cell SUMS AS ZERO: a reader who totals the
 * `Margin` column of a blank export gets a confident, wrong number with nothing on screen to warn
 * them. The literal word refuses to participate in arithmetic.
 */
const UNKNOWN = 'Unknown';

export function buildOrderCsv(orders: readonly ChannelOrderRow[]): string {
  const header = ORDER_CSV_COLUMNS.map(escapeCell).join(',');
  const rows = orders.map((order) => {
    const canonical = canonicalStatus(order.canonicalStatuses);
    return [
      order.triolooInvoiceNumber ?? 'Not issued',
      order.externalOrderId,
      order.channelName ?? 'Shop not recorded',
      order.providerCreatedAt ?? 'Not recorded',
      customerName(order),
      order.shippingPhone ?? 'Not recorded',
      order.shippingLine ?? 'Not recorded',
      canonical ? canonicalStatusLabel(canonical) : 'Status not translated',
      primaryStatus(order.statuses),
      paymentPosition(canonical).label,
      order.paymentMethod ?? 'Not recorded',
      String(order.itemsCount ?? 0),
      /*
        🔴 `TEC-015` / `OSC-043` — the authoritative decimal STRING is written through untouched.
        There is no `Number(...)`, no `toFixed`, no locale grouping and no currency symbol: a
        money value that round-trips through a JavaScript number is no longer the exact amount,
        and a grouped `৳ 429,200` would not even parse back as a number in a spreadsheet.
      */
      order.price ?? UNKNOWN,
      UNKNOWN,
      UNKNOWN,
      UNKNOWN,
      UNKNOWN,
      order.itemName ?? 'Not recorded',
      order.trackingCode ?? 'Not recorded',
      order.purchaseOrderId ?? 'Not recorded',
      order.buyerNote ?? '',
    ].map(escapeCell).join(',');
  });
  // ⚠ CRLF is RFC 4180's line ending and the one Excel reads without a prompt.
  return [header, ...rows].join('\r\n');
}

/**
 * Escapes one cell for RFC 4180, and defuses spreadsheet formula injection.
 *
 * 🔴 THE LEADING-CHARACTER GUARD IS A SECURITY CONTROL, NOT TIDINESS. `Buyer note`, the customer
 * name and the delivery address are all BUYER-SUPPLIED text that arrives from the marketplace. A
 * cell beginning `=`, `+`, `-`, `@`, a tab or a carriage return is executed as a formula by Excel,
 * Sheets and LibreOffice on open — so a buyer who types `=HYPERLINK(...)` into a delivery note is
 * writing code that runs on an operator's machine when they open the export.
 *
 * ✅ A leading apostrophe neutralises it. The value is NOT stripped or altered otherwise: the
 * operator still sees exactly what the buyer wrote, which is the point of exporting it.
 */
function escapeCell(value: string): string {
  const neutralised = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(neutralised)) {
    return `"${neutralised.replace(/"/g, '""')}"`;
  }
  return neutralised;
}

/**
 * ⚠ The filename carries the scope, so an export cannot be mistaken for a different one later.
 * `orders-selected-3-2026-08-24.csv` and `orders-all-158-2026-08-24.csv` are not the same file
 * and must not look alike in a downloads folder.
 */
export function orderCsvFilename(scope: 'selected' | 'all', count: number, on: Date): string {
  const day = `${on.getFullYear()}-${pad(on.getMonth() + 1)}-${pad(on.getDate())}`;
  return `orders-${scope}-${count}-${day}.csv`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
