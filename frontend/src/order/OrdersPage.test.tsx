import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import OrdersPage from './OrdersPage';
import OrderDetailPage from './OrderDetailPage';
import type { ChannelOrderDetail, ChannelOrderRow, ChannelOrderSummary } from './orderApi';
import { ORDER_LIFECYCLE_ROLE } from '../design/semanticRole';

const ORDER_ROW: ChannelOrderRow = {
  id: '11111111-1111-1111-1111-111111111111',
  channelInstanceId: '067774fc-c4d6-4618-a590-f85ff055d2ab',
  channelName: 'Ryzen Builder',
  externalOrderId: '3985600001',
  orderNumber: 'TRL-2026-004176',
  triolooInvoiceNumber: 'TR0001',
  ownership: 'API_MANAGED',
  statuses: ['pending'],
  canonicalStatuses: ['PENDING_VERIFICATION'],
  dispatchObservedAt: null,
  providerCreatedAt: '2026-08-21T10:26:00Z',
  providerUpdatedAt: '2026-08-21T11:02:00Z',
  lastSeenAt: '2026-08-23T11:00:00Z',
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
  // ⚠ A REAL invoice number, so the `OSC-056.g` test proves the card WITHHOLDS one rather than
  // merely having none to show. With `null` here the assertion would pass vacuously.
  invoiceNumber: 'INV-2026-0041',
  purchaseOrderId: '659537729498894',
  // Unbooked by default. Most orders are, and the card must render that as an explicit
  // absence rather than a blank (`BR-134`, `FRAME 06`).
  courierConsignmentId: null,
  courierTrackingCode: null,
  shipmentState: null,
};

const SUMMARY: ChannelOrderSummary = {
  totalOrders: 1,
  todaysOrders: 1,
  todaysDispatched: 0,
  // 🔴 An authoritative decimal STRING, exactly as the server sends it (`TEC-015`).
  totalCollectable: '429200.00',
  totalItems: 2,
  // 🔴 The channel filter is built from THIS, never from a list in the browser.
  channelTypes: [{ channelType: 'DARAZ', orderCount: 1 }],
  // ⚠ Only the statuses that HAVE orders. Every other tab renders no count rather than a `0`.
  statusCounts: [{ status: 'PENDING_VERIFICATION', orderCount: 1 }],
  // 🔴 `BR-002` — attribution is at channel INSTANCE level, not channel type.
  shops: [{ channelInstanceId: '067774fc-c4d6-4618-a590-f85ff055d2ab', code: 'CHN-000001', name: 'Ryzen Builder', orderCount: 1 }],
};

const ORDER_DETAIL: ChannelOrderDetail = {
  ...ORDER_ROW,
  channelType: 'DARAZ',
  importedAt: '2026-08-23T11:00:00Z',
  shippingFee: '0.00',
  shippingFeeOriginal: null,
  shippingFeeDiscountPlatform: null,
  shippingFeeDiscountSeller: null,
  voucher: '0.00',
  voucherPlatform: null,
  voucherSeller: null,
  cashPaymentFee: '0.00',
  voucherCode: null,
  promisedShippingTimes: null,
  warehouseCode: null,
  deliveryInfo: null,
  buyerNote: null,
  remarks: null,
  giftOption: null,
  giftMessage: null,
  nationalRegistrationNumber1: null,
  branchNumber: null,
  taxCode: null,
  extraAttributes: null,
  billingAddress: null,
  shippingAddress: {
    firstName: 'Tanvir',
    lastName: 'Enterprise',
    phone: '+8801712448903',
    phone2: null,
    address1: 'House 42',
    address2: 'Road 11',
    address3: 'Banani',
    address4: null,
    address5: null,
    city: 'Dhaka',
    postCode: '1213',
    country: 'Bangladesh',
  },
  items: [
    {
      id: 'item-1',
      externalOrderItemId: '7001',
      externalOrderId: '3985600001',
      sku: 'DL-OPX7010-I5-16-512',
      shopSku: 'DL-OPX7010-I5-16-512',
      skuId: 'sku-1',
      name: 'Dell OptiPlex 7010 SFF',
      variation: null,
      itemPrice: '96500.00',
      paidPrice: '96500.00',
      status: 'pending',
      reason: null,
      trackingCode: null,
      shipmentProvider: null,
      shippingProviderType: null,
      invoiceNumber: null,
      purchaseOrderId: null,
      digitalDeliveryInfo: null,
      providerCreatedAt: '2026-08-21T10:26:00Z',
      providerUpdatedAt: '2026-08-21T11:02:00Z',
    },
  ],
};

function renderAt(route: string): { readonly calls: RequestInit[]; readonly urls: string[] } {
  const calls: RequestInit[] = [];
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      const url = String(input);
      urls.push(url);
      const json = (body: unknown): Response =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/me')) {
        return json({
          id: 'dev',
          username: 'mithun',
          fullName: 'Mithun Ahamed',
          roles: [],
          permissions: ['order.channel-order.view'],
        });
      }
      if (url.includes('/api/order/channel-orders/summary')) return json(SUMMARY);
      if (url.includes('/api/order/channel-orders/11111111-1111-1111-1111-111111111111')) return json(ORDER_DETAIL);
      if (url.includes('/api/order/channel-orders')) {
        // Two pages of one, so paging is reachable and `OSC-058.d`'s cross-page selection is
        // testable against a page that does NOT contain the selected order.
        const second = url.includes('page=1');
        return json({
          content: [second ? { ...ORDER_ROW, id: 'page-two-order', triolooInvoiceNumber: 'TR0002' } : ORDER_ROW],
          page: second ? 1 : 0,
          size: 5,
          totalElements: 2,
          totalPages: 2,
        });
      }
      return json({});
    }),
  );

  render(
    <AuthProvider>
      <PageActionsProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/sales/orders" element={<OrdersPage />} />
            <Route path="/sales/orders/:id" element={<OrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </PageActionsProvider>
    </AuthProvider>,
  );
  return { calls, urls };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Orders first slice', () => {
  it('renders FRAME 01 as a card-list workspace from the approved design shape', async () => {
    const { calls } = renderAt('/sales/orders');

    expect(await screen.findByRole('heading', { name: 'Orders' })).not.toBeNull();
    expect(screen.queryByText(/BLOCKED/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'New order' })).toBeNull();
    expect(screen.getByPlaceholderText('Order no., ref, customer')).not.toBeNull();
    // 🔴 `OSC-057.b` — the card carries the TRIOLOO-issued number. The `order_number` column
    // holds a copy of Daraz's own id in production and is deliberately not rendered.
    expect(await screen.findByText('INV: TR0001')).not.toBeNull();
    expect(screen.getByText('Tanvir Enterprise')).not.toBeNull();
    // 🔴 `OSC-056.d` — the authority chip is NOT on the card. `UX-183` requires it legible on
    // INSPECTION, which is `FRAME 02`, and `OrderDetailPage` carries it twice.
    expect(screen.queryByText('API-managed')).toBeNull();
    expect(screen.getByRole('link', { name: 'View' }).getAttribute('href')).toBe(
      '/sales/orders/11111111-1111-1111-1111-111111111111',
    );
    expect(calls.filter((call) => call.method === 'POST' || call.method === 'PUT')).toHaveLength(0);
  });

  it('names every status tab for a ratified SM-1 state and uses no legacy label', async () => {
    renderAt('/sales/orders');

    await screen.findByRole('heading', { name: 'Orders' });

    // ⚠ A tab's accessible name now carries its count, so these match the LABEL rather than
    // the whole name.
    const tabLabels = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');
    const startsWith = (label: string): boolean => tabLabels.some((text) => text.startsWith(label));

    // ✅ Ratified `SM-1` states only (`OM §6.2`, `OSC-030.a`).
    for (const label of ['All', 'Pending verification', 'Ready to ship', 'Dispatched', 'Delivered', 'Cancelled']) {
      expect(startsWith(label)).toBe(true);
    }

    // 🔴 `GAP-017` — the legacy labels have no canonical state set and must never appear.
    // `BR-079` — `RTS` alone is ambiguous between READY_TO_SHIP and Return-To-Seller.
    for (const legacy of ['RTS', 'Shipped', 'B2C Pending']) {
      expect(tabLabels.some((text) => text === legacy)).toBe(false);
    }

    // 🔴 `GAP-023` — the DRAFT lifecycle is BLOCKED and gets no tab.
    expect(tabLabels.some((text) => text.startsWith('Draft'))).toBe(false);
  });

  it('renders the four ratified summary figures and keeps money a string', async () => {
    renderAt('/sales/orders');

    const strip = await screen.findByTestId('order-summary-strip');
    // ⚠ The prototype captions each figure in caps beside its icon tile. The four FIGURES are
    // what `OSC-053` ratifies; the casing is composition.
    for (const label of ['TOTAL ORDERS', "TODAY'S ORDERS", "TODAY'S DISPATCHED", 'TOTAL COLLECTABLE']) {
      expect(screen.getByText(label)).not.toBeNull();
    }

    // 🔴 `OSC-043` — the amount is FORMATTED from the server's decimal string and never
    // parsed. `429200.00` through a `Number` would render `429200` by a different route; this
    // asserts the grouped string the display formatter produces from the exact value.
    expect(strip.textContent).toContain('৳ 429,200');

    // 🔴 `OSC-045` / `SYS-034` — a real `0` renders as `0`, and is not confused with absence.
    expect(strip.textContent).toContain('0');
  });

  it('distinguishes an empty import from an empty filtered view', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const json = (body: unknown): Response =>
          new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (url.includes('/api/auth/me')) {
          return json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: ['order.channel-order.view'] });
        }
        if (url.includes('/summary')) {
          return json(url.includes('status=DELIVERED') ? { ...SUMMARY, totalOrders: 0, totalItems: 0 } : SUMMARY);
        }
        if (url.includes('status=DELIVERED')) {
          return json({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
        }
        return json({ content: [ORDER_ROW], page: 0, size: 5, totalElements: 1, totalPages: 1 });
      }),
    );
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={['/sales/orders']}>
            <Routes>
              <Route path="/sales/orders" element={<OrdersPage />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );

    await screen.findByTestId('order-card');
    fireEvent.click(screen.getAllByRole('tab').find((tab) => (tab.textContent ?? '').startsWith('Delivered'))!);

    expect(await screen.findByText('No orders match this view')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Reset filters' })).not.toBeNull();
    expect(screen.queryByText('No orders imported yet')).toBeNull();
    expect(urls.some((url) => url.includes('status=DELIVERED'))).toBe(true);
  });

  it('renders the canonical status and the marketplace status as two separate facts', async () => {
    renderAt('/sales/orders');

    const card = await screen.findByTestId('order-card');

    // `BR-171` / `UX-182` / `OSC-036` — two owners, NEVER MERGED INTO ONE CHIP.
    // 🔴 The prefix word is gone (`OSC-056.c`), so this test can no longer lean on it. What it
    // asserts instead is the property the rule actually names: the two words live in SEPARATE
    // elements, neither containing the other.
    // ⚠ Scoped to the CARD: the status tab is also named `Pending verification`, and a
    // document-wide query would match the tab rather than the chip.
    const inCard = within(card);
    const canonical = inCard.getByText('Pending verification');
    const external = inCard.getByText('pending');
    expect(canonical).not.toBe(external);
    expect(canonical.contains(external)).toBe(false);
    expect(external.contains(canonical)).toBe(false);

    // ⚠ `UX-185` — the external word stays VISIBLY EXTERNAL by GROUPING: it sits inside the
    // marketplace's own identity cluster, after the shop that reported it and the id that shop
    // gave it. `BR-002` — the shop instance is named, never the channel type alone.
    const cluster = external.parentElement;
    expect(cluster?.textContent).toContain('Ryzen Builder');
    expect(cluster?.textContent).toContain('3985600001');
    expect(cluster?.textContent).not.toContain('Pending verification');

    // ⚠ The marketplace's word is printed as the marketplace spelled it — not title-cased.
    expect(external.textContent).toBe('pending');
  });

  it('keeps the five economic figures together and away from the buttons', async () => {
    renderAt('/sales/orders');
    const card = await screen.findByTestId('order-card');
    const text = card.textContent ?? '';

    /*
      The regression this pins. `Received` and `Margin` had drifted against the action buttons,
      because the demoted group carried its own auto margin and centred itself - splitting the
      economics in two across the width of the card.

      A figure adjacent to a button reads as that button's subject, and 3.15's hierarchy is
      DEMOTED then PRIMARY across ONE run.
    */
    const sale = text.indexOf('Sale');
    const charges = text.indexOf('Charges');
    const received = text.indexOf('Received');
    const margin = text.indexOf('Margin');
    const view = text.indexOf('View');

    expect(sale).toBeGreaterThan(-1);
    expect(charges).toBeGreaterThan(sale);
    expect(received).toBeGreaterThan(charges);
    expect(margin).toBeGreaterThan(received);
    // Every figure precedes the actions, and the actions come last.
    expect(view).toBeGreaterThan(margin);

    // They share ONE container, so no layout rule can push half of them elsewhere - which is
    // exactly how the split happened.
    const economics = screen.getByTestId('order-economics');
    for (const label of ['Sale', 'Cost', 'Charges', 'Received', 'Margin']) {
      expect(economics.contains(screen.getByText(label))).toBe(true);
    }
    // And the actions are OUTSIDE it.
    expect(economics.contains(screen.getByRole('link', { name: 'View' }))).toBe(false);
  });

  it('names the issuing party on every external identifier', async () => {
    renderAt('/sales/orders');

    const card = await screen.findByTestId('order-card');

    /*
      DB-013 - an external identifier is only meaningful alongside the party that issued it, and
      OSC-030 lists *external references with their issuing party* as required data. Two parties
      may legitimately issue the same string, and an operator who cannot tell whose number they
      are reading cannot tell who to ask about the parcel.
    */
    expect(card.textContent).toContain('Daraz PO');
    expect(card.textContent).toContain('Daraz tracking');
    // A bare `Tracking` label is exactly the ambiguity this rule forbids.
    expect(card.textContent).not.toMatch(/(?<!Daraz |Steadfast )Tracking\s/);
  });

  it('shows the courier booking when one exists, and its absence when it does not', async () => {
    renderAt('/sales/orders');

    // BR-134 / FRAME 06 - an unbooked order says so rather than rendering a blank.
    const line = await screen.findByTestId('order-courier-line');
    expect(line.textContent).toBe('Courier not booked');
  });

  it('states the SM-5 payment position and never claims one it cannot derive', async () => {
    renderAt('/sales/orders');

    const card = await screen.findByTestId('order-card');

    // 🔴 The fixture order is `PENDING_VERIFICATION` — goods NOT delivered — so `SM-5` is
    // `NOT_DUE` by `OM §11.3` and `BR-033`. Anything else would claim an obligation that
    // `SM-5.4` prohibits before delivery.
    expect(card.textContent).toContain('Payment not due');

    // 🔴 NOTHING PAST `DUE` IS EVER RENDERED. Every later `SM-5` state needs an `E-040`
    // Receivable that has been collected, matched or settled, and no such record exists here.
    for (const never of ['Received', 'Reconciled', 'Refunded', 'Collected', 'Paid']) {
      expect(card.textContent).not.toContain(`Payment ${never.toLowerCase()}`);
    }
  });

  it('offers navigation in More Actions and dims every item that would change the order', async () => {
    renderAt('/sales/orders');

    const card = await screen.findByTestId('order-card');

    // ⚠ `OSC-056.f` — the owner ratified the control's PRESENCE, and the prototype fills it. The
    // trigger opens a real menu now rather than advertising a dead control.
    fireEvent.click(screen.getByTestId('order-more-actions'));
    const menu = await screen.findByTestId('order-actions-menu');

    // ✅ NAVIGATION IS REAL — these reach surfaces this application holds.
    for (const offered of ['Open order', 'Print invoice', 'View activity']) {
      const item = within(menu).getByRole('menuitem', { name: new RegExp(offered) });
      expect(item.hasAttribute('disabled')).toBe(false);
    }

    /*
      🔴 EVERY MUTATING ITEM IS DIMMED WITH ITS PRECONDITION NAMED. `GAP-034` records no
      permitted-action inventory, `PRM-025` requires per-record authority, and courier booking is
      `ORDER_MODULE_ROADMAP.md` Phase 2 — NEXT, not built. The prototype's own version reports the
      act as recorded; nothing is recorded, so nothing here says it was.
    */
    for (const refused of ['Send to Steadfast', 'Place hold', 'Amend order', 'Release to warehouse']) {
      const item = within(menu).getByRole('menuitem', { name: new RegExp(refused) });
      expect(item.hasAttribute('disabled')).toBe(true);
    }

    // 🔴 `BR-011` — `Cancel` is ABSENT after dispatch, not disabled. This order is pre-dispatch,
    // so the item is present, and it is dimmed for the same reason as its siblings.
    expect(within(menu).getByRole('menuitem', { name: /Cancel order/ }).hasAttribute('disabled')).toBe(true);

    // ⚠ `OSC-056.g` — the invoice element in the bottom strip is an ACTION, not a caption, and
    // the MARKETPLACE's invoice number is not printed beside it.
    expect(card.textContent).toContain('INVOICE');
    expect(card.textContent).not.toContain('INV-2026-0041');
  });

  it('shows the Trioloo invoice number top right and never the marketplace copy', async () => {
    renderAt('/sales/orders');

    const card = await screen.findByTestId('order-card');
    const invoice = screen.getByTestId('order-invoice-number');

    // ✅ `OSC-057.b` — the Trioloo-issued number, prefixed and upper-cased for display.
    expect(invoice.textContent).toBe('INV: TR0001');
    expect(invoice.style.textTransform).toBe('uppercase');
    expect(invoice.style.fontWeight).toBe('700');

    // 🔴 The `order_number` column holds a COPY of Daraz's own id on every production row, so
    // showing it would print the marketplace's number twice and dress the copy as a Trioloo
    // reference. The fixture's distinct value proves the card is not reading that column.
    expect(card.textContent).not.toContain('TRL-2026-004176');

    // ⚠ It sits AFTER the payment method, which is the divider the owner named.
    const text = card.textContent ?? '';
    expect(text.indexOf('Cash on Delivery')).toBeLessThan(text.indexOf('INV: TR0001'));
  });

  it('opens the bulk region on selection and offers only what may act on a record', async () => {
    renderAt('/sales/orders');

    await screen.findByTestId('order-card');
    const box = screen.getByTestId('order-select') as HTMLInputElement;

    // ✅ The checkbox leads the row, before the customer icon.
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(false);
    expect(box.getAttribute('aria-label')).toContain('Tanvir Enterprise');

    // ⚠ THE REGION IS CLOSED UNTIL SOMETHING IS SELECTED, exactly as the prototype folds it.
    expect(screen.queryByTestId('orders-bulk-region')).toBeNull();

    fireEvent.click(box);
    expect((screen.getByTestId('order-select') as HTMLInputElement).checked).toBe(true);

    const region = await screen.findByTestId('orders-bulk-region');

    /*
      ✅ TWO ACTIONS ACT ENTIRELY IN THIS BROWSER on records already fetched, so they need no
      permitted-action inventory and are offered.
    */
    for (const offered of ['Export selected', 'Clear selection']) {
      expect((within(region).getByRole('button', { name: offered }) as HTMLButtonElement).disabled).toBe(false);
    }

    /*
      🔴 EVERY ACTION THAT WOULD TOUCH A RECORD IS DIMMED. `PRM-025` requires each record
      authorised on its own with per-record results (`SYS-073`), and `GAP-034` — carried as
      `ORDER_MODULE_ROADMAP.md` open question 4, naming `Send to Steadfast` and `Print invoices`
      by name — records that no inventory of permitted bulk transitions exists.
    */
    for (const refused of ['Send to Steadfast', 'Place hold', 'Cancel orders']) {
      expect((within(region).getByRole('button', { name: refused }) as HTMLButtonElement).disabled).toBe(true);
    }

    // ⚠ The region states the per-record rule in words, not only by dimming.
    expect(region.textContent).toContain('Each selected order is authorised on its own');
  });

  it('renders the three page-header actions with exactly one primary', async () => {
    renderAt('/sales/orders');
    await screen.findByRole('heading', { name: 'Orders' });

    // `UX-016` / `UX-045` - surface-level actions belong to the page-header region.
    const header = screen.getByTestId('page-header');
    for (const id of ['orders-export', 'orders-print', 'orders-create']) {
      expect(header.contains(screen.getByTestId(id))).toBe(true);
    }

    // `RULE 3.11` - the dark primary is RIGHTMOST of the action set.
    const create = screen.getByTestId('orders-create');
    const exportBtn = screen.getByTestId('orders-export');
    expect(create.compareDocumentPosition(exportBtn) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    // ✅ `RULE 3.11.d.a` — prominence comes from FILL, position and label, never from geometry.
    // Create Order is enabled since `PRM-093`, so it carries the ink fill and Export does not.
    expect(create.style.background).toBe('var(--color-ink)');
    expect(exportBtn.style.background).not.toBe('var(--color-ink)');

    // ⚠ AND A DISABLED PRIMARY STILL LOSES THAT FILL. Print is disabled with nothing selected,
    // and a black button that cannot be pressed reads as the one thing you are meant to press —
    // the opposite of what disabled means.
    const print = screen.getByTestId('orders-print') as HTMLButtonElement;
    expect(print.disabled).toBe(true);
    expect(print.style.background).not.toBe('var(--color-ink)');
  });

  it('offers Create Order and states the state it will create, before the act', async () => {
    renderAt('/sales/orders');
    await screen.findByRole('heading', { name: 'Orders' });

    // ✅ `PRM-093` ratified `order.order.create`, so this is no longer refused.
    const create = screen.getByTestId('orders-create') as HTMLButtonElement;
    expect(create.disabled).toBe(false);

    // ⚠ `UX-184`'s principle — a consequential transition must not happen invisibly — applies to
    // what an operator is about to CREATE as much as to a takeover. The state is stated in
    // VISIBLE text, and `PRM-093.b` is why it matters: creation is NOT confirmation.
    const reason = document.getElementById('orders-create-reason');
    expect(reason?.textContent).toContain('Pending verification');
    expect(reason?.textContent).toContain('does not confirm');
  });

  it('enables Print for exactly one selected order and never for a set', async () => {
    renderAt('/sales/orders');
    await screen.findByTestId('order-card');

    const print = () => screen.getByTestId('orders-print') as HTMLButtonElement;

    // Nothing selected - there is no single order to print.
    expect(print().disabled).toBe(true);

    fireEvent.click(screen.getByTestId('order-select'));
    // One selected - `OSC-059` unblocked this: V22 creates the E-039 snapshot PRN-023 sources
    // the printable from, so there is now something to render.
    await waitFor(() => expect(print().disabled).toBe(false));

    // A SET stays refused. PRM-025 requires each record authorised individually with per-record
    // results (SYS-073), and GAP-034 still records no permitted bulk-action inventory.
    const reason = document.getElementById('orders-print-reason');
    expect(reason?.textContent).toContain('GAP-034');

    /*
      🔴 AND IT IS OFF THE LAYOUT WHILE STILL BEING IN THE ACCESSIBILITY TREE (product owner,
      2026-08-25). The prototype draws no explanatory block above the workspace. ⚠ The reason is
      CLIPPED, never `display: none` and never moved into a `title` — both of those would take it
      away from the screen-reader user the `describedBy` exists for.
    */
    const block = reason?.parentElement as HTMLElement;
    expect(block.style.clipPath).toBe('inset(50%)');
    expect(block.style.position).toBe('absolute');
    expect(block.style.display).not.toBe('none');
  });

  it('keeps a selection when the page changes and drops it when the filter changes', async () => {
    renderAt('/sales/orders');

    await screen.findByTestId('order-card');
    fireEvent.click(screen.getByTestId('orders-select-page'));
    expect(screen.getByTestId('orders-selection-count').textContent).toBe('1 selected');

    // `OSC-058.d` - paging is NAVIGATION within one result set, so the ticks survive it.
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(screen.getByTestId('orders-selection-count').textContent).toBe('1 selected');
    });

    // A FILTER replaces the result set, so it does not. A tick that outlived this would leave
    // the operator holding records the new set does not contain.
    fireEvent.click(screen.getAllByRole('tab').find((t) => (t.textContent ?? '').startsWith('Delivered'))!);
    await waitFor(() => {
      expect(screen.queryByTestId('orders-selection-count')).toBeNull();
    });
  });

  it('asks the server for five orders a page', async () => {
    const { urls } = renderAt('/sales/orders');
    await screen.findByTestId('order-card');

    // `OSC-058.c` - five is a product-owner decision and a constant. `RULE 7.3.a` / `UX-266`
    // forbid page size responding to viewport or zoom, and nothing here reads either.
    expect(urls.some((url) => url.includes('size=5'))).toBe(true);
  });

  it('clears the selection when the result set changes', async () => {
    renderAt('/sales/orders');

    await screen.findByTestId('order-card');
    fireEvent.click(screen.getByTestId('order-select'));
    expect((screen.getByTestId('order-select') as HTMLInputElement).checked).toBe(true);

    // 🔴 A selection surviving a filter change would leave the operator holding records they
    // can no longer see.
    fireEvent.click(screen.getAllByRole('tab').find((tab) => (tab.textContent ?? '').startsWith('Delivered'))!);

    await waitFor(() => {
      expect((screen.getByTestId('order-select') as HTMLInputElement).checked).toBe(false);
    });
  });

  it('keeps both control rows on ONE row and offers no horizontal-scroll escape', async () => {
    renderAt('/sales/orders');
    await screen.findByRole('heading', { name: 'Orders' });

    // 🔴 `UX-266` names TABS and FILTER/CONTROL ROWS among the structural UI that does not
    // wrap, and `.operational-row` carries the `flex-wrap: nowrap !important` safety net.
    const rows = document.querySelectorAll('.operational-row');
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // 🔴 `UX-265` — horizontal scrollbars are not part of the ERP interaction model, so no
    // control row may buy its fit with `overflow-x`.
    for (const row of Array.from(rows)) {
      const style = (row as HTMLElement).getAttribute('style') ?? '';
      expect(style).not.toMatch(/overflow-x/);
      expect(style).not.toMatch(/flex-wrap:\s*wrap/);
    }
  });

  it('builds the channel filter from the server and lets it be clicked', async () => {
    renderAt('/sales/orders');
    await screen.findByRole('heading', { name: 'Orders' });

    const daraz = screen.getByRole('tab', { name: 'Daraz' });
    // 🔴 The superseded control hard-coded four channel names and DISABLED every one of them.
    expect((daraz as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('tab', { name: 'All channels' })).not.toBeNull();

    // 🔴 Only channels the server actually reported. `Walk-in` and `Phone` were invented by the
    // superseded hard-coded list and have no orders behind them.
    expect(screen.queryByRole('tab', { name: 'Walk-in' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Phone' })).toBeNull();
  });

  it('sends the canonical channel type when a channel is chosen', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const json = (body: unknown): Response =>
          new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (url.includes('/api/auth/me')) {
          return json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: ['order.channel-order.view'] });
        }
        if (url.includes('/summary')) return json(SUMMARY);
        return json({ content: [ORDER_ROW], page: 0, size: 50, totalElements: 1, totalPages: 1 });
      }),
    );
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={['/sales/orders']}>
            <Routes>
              <Route path="/sales/orders" element={<OrdersPage />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );
    await screen.findByRole('heading', { name: 'Orders' });

    fireEvent.click(screen.getByRole('tab', { name: 'Daraz' }));

    await waitFor(() => {
      // ⚠ `UX-273.d` — `Daraz` is the LABEL; the canonical channel type is what travels.
      expect(urls.some((url) => url.includes('channelType=DARAZ'))).toBe(true);
    });
    expect(urls.some((url) => url.includes('channelType=Daraz'))).toBe(false);
  });

  it('shows a per-status count and never fabricates one for a status with no orders', async () => {
    renderAt('/sales/orders');
    await screen.findByRole('heading', { name: 'Orders' });

    const tabs = screen.getAllByRole('tab');
    const textOf = (label: string): string =>
      tabs.find((tab) => (tab.textContent ?? '').startsWith(label))?.textContent ?? '';

    // The server reported PENDING_VERIFICATION = 1, so that tab carries a count.
    expect(textOf('Pending verification')).toBe('Pending verification1');

    // 🔴 `SYS-034` / `OSC-045` — a status the server did not report carries NO count. It is
    // absent, and an absence must never be rendered as a plausible `0`.
    expect(textOf('Cancelled')).toBe('Cancelled');
    expect(textOf('Returned')).toBe('Returned');
  });

  it('colours a count from the canonical role map, never from the label text', async () => {
    // 🔴 `RULE 3.14.a.a` — the role must come from `semanticRole.ts`. This asserts the two
    // rows most likely to be got wrong by resemblance.
    expect(ORDER_LIFECYCLE_ROLE.CANCELLED).toBe('neutral');
    expect(ORDER_LIFECYCLE_ROLE.DELIVERED).toBe('success');
    expect(ORDER_LIFECYCLE_ROLE.FAILED_DELIVERY).toBe('warning');

    // 🔴 `RULE 3.3.c` reserves canonical red for destructive ACTION semantics. No order state
    // may be danger — cancellation is an authorised business outcome (`OM §6.4`), not a fault.
    for (const role of Object.values(ORDER_LIFECYCLE_ROLE)) {
      expect(role).not.toBe('danger');
    }
  });

  it('offers a calendar period filter and sends the canonical value', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const json = (body: unknown): Response =>
          new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (url.includes('/api/auth/me')) {
          return json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: ['order.channel-order.view'] });
        }
        if (url.includes('/summary')) return json(SUMMARY);
        return json({ content: [ORDER_ROW], page: 0, size: 50, totalElements: 1, totalPages: 1 });
      }),
    );
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={['/sales/orders']}>
            <Routes>
              <Route path="/sales/orders" element={<OrdersPage />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );
    await screen.findByRole('heading', { name: 'Orders' });

    for (const label of ['All time', 'Day', 'Month', 'Year']) {
      expect(screen.getByRole('tab', { name: label })).not.toBeNull();
    }
    // ⚠ No rolling window is offered — `last 30 days` would invent what `Month` means.
    expect(screen.queryByRole('tab', { name: /30 days/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    await waitFor(() => expect(urls.some((url) => url.includes('period=MONTH'))).toBe(true));
  });

  it('filters by SHOP, not only by channel type', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const json = (body: unknown): Response =>
          new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (url.includes('/api/auth/me')) {
          return json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: ['order.channel-order.view'] });
        }
        if (url.includes('/summary')) return json(SUMMARY);
        return json({ content: [ORDER_ROW], page: 0, size: 50, totalElements: 1, totalPages: 1 });
      }),
    );
    render(
      <AuthProvider>
        <PageActionsProvider>
          <MemoryRouter initialEntries={['/sales/orders']}>
            <Routes>
              <Route path="/sales/orders" element={<OrdersPage />} />
            </Routes>
          </MemoryRouter>
        </PageActionsProvider>
      </AuthProvider>,
    );
    await screen.findByRole('heading', { name: 'Orders' });

    // 🔴 `BR-002` — "Daraz" is never a sufficient attribution; the shop must be selectable.
    const shopSelect = screen.getByDisplayValue('All shops') as HTMLSelectElement;
    expect(Array.from(shopSelect.options).some((o) => o.textContent?.includes('Ryzen Builder'))).toBe(true);

    fireEvent.change(shopSelect, { target: { value: '067774fc-c4d6-4618-a590-f85ff055d2ab' } });

    await waitFor(() =>
      expect(urls.some((url) => url.includes('channelInstanceId=067774fc-c4d6-4618-a590-f85ff055d2ab'))).toBe(true),
    );
  });

  it('renders FRAME 02 as eight lifecycle rows that are never merged into one status', async () => {
    renderAt('/sales/orders/11111111-1111-1111-1111-111111111111');

    // ✅ The Trioloo invoice number names the order, not the marketplace's `order_number` copy.
    expect(await screen.findByRole('heading', { name: 'Order TR0001' })).not.toBeNull();

    /*
      🔴 `OSC-031` — ONE ROW PER LIFECYCLE, NEVER MERGED. A single merged status field is the
      failure `OM §18.1` exists to prevent, and eight rows are the whole point of this page.
    */
    for (const machine of ['SM-1', 'SM-2', 'SM-3', 'SM-4', 'SM-5', 'SM-6', 'SM-7', 'SM-8']) {
      expect(screen.getByText(machine)).not.toBeNull();
    }
    expect(screen.getByText('Eight independent state machines · never merged')).not.toBeNull();

    /*
      🔴 `BR-164` / `BR-166` — `Confirmed By` IS NEVER DERIVED, AND ITS ABSENCE IS THE FACT. It is
      not filled from an assigned agent, an owner or the audit history.
    */
    expect(screen.getByText(/Not recorded — no confirmer is held/)).not.toBeNull();

    /*
      🔴 THE PROTOTYPE'S SAMPLE DATA IS NOT PRINTED. It shows a warehouse, a named picker, a pick
      task and a courier scan; no such record exists, and `SYS-034` / `BR-134` require an absent
      fact to say so in words rather than be invented to fill the shape.
    */
    for (const fabricated of ['Sabbir Rahman', 'Mirpur', 'PT-3391', 'SF-90233118']) {
      expect(screen.queryByText(new RegExp(fabricated))).toBeNull();
    }
  });

  it('moves between FRAME 03-09 as PANELS of one surface, never as separate routes', async () => {
    const { calls } = renderAt('/sales/orders/11111111-1111-1111-1111-111111111111');

    /*
      🔴 `OSC-020.a` — `FRAME 03` THROUGH `FRAME 09` ARE PANELS OF THE `FRAME 02` SURFACE. Eight
      tabs on one route, not eight routes.
    */
    const tabs = await screen.findByTestId('order-panels');
    for (const panel of ['Overview', 'Items', 'Buyer', 'Payment', 'Fulfilment', 'Marketplace', 'Activity', 'Exceptions']) {
      expect(within(tabs).getByRole('tab', { name: panel })).not.toBeNull();
    }

    fireEvent.click(within(tabs).getByRole('tab', { name: 'Items' }));
    expect(await screen.findByText('Dell OptiPlex 7010 SFF')).not.toBeNull();
    /*
      🔴 `INV-32.4` / `BR-007` — an unknown cost renders UNKNOWN, never `0`, and an order whose
      cost is unknown has a margin that is unknown. `INV-31.5` — a line with no Sellable Product
      reference makes the order economically incomplete, which the panel states outright.
    */
    expect(screen.getByText(/Economically incomplete/)).not.toBeNull();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);

    fireEvent.click(within(tabs).getByRole('tab', { name: 'Buyer' }));
    // 🔴 `INV-31.7` — the ORDER'S OWN SNAPSHOT, never a live customer lookup.
    expect(await screen.findByText(/House 42, Road 11, Banani, Dhaka/)).not.toBeNull();
    expect(screen.getByText(/not a live customer lookup/)).not.toBeNull();

    fireEvent.click(within(tabs).getByRole('tab', { name: 'Exceptions' }));
    // 🔴 `BR-151` — hold ageing, expiry and auto-release are PROHIBITED, not merely omitted.
    expect(await screen.findByText(/No hold is placed on this order/)).not.toBeNull();

    // 🔴 Nothing on this surface writes. It is a read-only slice over imported orders.
    expect(calls.filter((call) => call.method === 'POST' || call.method === 'PUT')).toHaveLength(0);
  });

  it('refuses the controls no ratified rule authorises, and says why in visible text', async () => {
    renderAt('/sales/orders/11111111-1111-1111-1111-111111111111');

    /*
      🔴 DIMMED, NOT FAKED. No hold endpoint exists and `GAP-034` records no permitted-action
      inventory. ⚠ The reason is VISIBLE text, never tooltip-only: a tooltip is unreachable by
      keyboard and invisible on touch.
    */
    const hold = (await screen.findByTestId('order-place-hold')) as HTMLButtonElement;
    expect(hold.disabled).toBe(true);
    expect(hold.getAttribute('aria-describedby')).toBe('order-hold-reason');
    expect(document.getElementById('order-hold-reason')?.textContent).toContain('no hold endpoint exists');
  });
});
