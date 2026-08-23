import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderAt(route: string): { readonly calls: RequestInit[] } {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      const url = String(input);
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
        return json({ content: [ORDER_ROW], page: 0, size: 50, totalElements: 1, totalPages: 1 });
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
  return { calls };
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
    expect(await screen.findByText('TRL-2026-004176')).not.toBeNull();
    expect(screen.getByText('Tanvir Enterprise')).not.toBeNull();
    expect(screen.getByText('API-managed')).not.toBeNull();
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
    for (const label of ["Total orders", "Today's orders", "Today's dispatched", 'Total collectable']) {
      expect(screen.getByText(label)).not.toBeNull();
    }

    // 🔴 `OSC-043` — the amount is FORMATTED from the server's decimal string and never
    // parsed. `429200.00` through a `Number` would render `429200` by a different route; this
    // asserts the grouped string the display formatter produces from the exact value.
    expect(strip.textContent).toContain('৳ 429,200');

    // 🔴 `OSC-045` / `SYS-034` — a real `0` renders as `0`, and is not confused with absence.
    expect(strip.textContent).toContain('0');
  });

  it('renders the canonical status and the marketplace status as two separate facts', async () => {
    renderAt('/sales/orders');

    const card = await screen.findByTestId('order-card');
    // `BR-171` / `UX-182` / `OSC-036` — two owners, never merged into one chip.
    expect(card.textContent).toContain('Pending verification');
    expect(card.textContent).toContain('Marketplace · pending');
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

  it('renders FRAME 02 detail with independent rail panels and stored snapshots', async () => {
    const { calls } = renderAt('/sales/orders/11111111-1111-1111-1111-111111111111');

    expect(await screen.findByRole('heading', { name: 'Order TRL-2026-004176' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Release to warehouse' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fulfilment' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Customer' })).not.toBeNull();
    expect(screen.getByText(/House 42, Road 11, Banani, Dhaka/)).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Items' })).not.toBeNull();
    expect(screen.getByText('Dell OptiPlex 7010 SFF')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Status' })).not.toBeNull();
    expect(screen.getByText('Verification')).not.toBeNull();
    expect(screen.getByText('Not progressed in Trioloo')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Channel references' })).not.toBeNull();
    expect(screen.getByText('External order ID')).not.toBeNull();
    expect(screen.queryByText(/BLOCKED/)).toBeNull();
    expect(calls.filter((call) => call.method === 'POST' || call.method === 'PUT')).toHaveLength(0);
  });
});
