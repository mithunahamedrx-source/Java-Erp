import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import OrdersPage from './OrdersPage';
import OrderDetailPage from './OrderDetailPage';
import type { ChannelOrderDetail, ChannelOrderRow, ChannelOrderSummary } from './orderApi';

const ORDER_ROW: ChannelOrderRow = {
  id: '11111111-1111-1111-1111-111111111111',
  channelInstanceId: '067774fc-c4d6-4618-a590-f85ff055d2ab',
  channelName: 'Ryzen Builder',
  externalOrderId: '3985600001',
  orderNumber: 'TRL-2026-004176',
  ownership: 'API_MANAGED',
  statuses: ['pending'],
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
  pendingOrders: 1,
  readyToShipOrders: 0,
  deliveredOrders: 0,
  totalItems: 2,
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
    expect(screen.getByTestId('orders-kpi-blocked').textContent).toContain('GAP-004');
    expect((screen.getByRole('button', { name: 'All' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Pending verification' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'New order' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByPlaceholderText('Order no., marketplace ref, customer')).not.toBeNull();
    expect(await screen.findByText('TRL-2026-004176')).not.toBeNull();
    expect(screen.getByText('Tanvir Enterprise')).not.toBeNull();
    expect(screen.getByText('API-managed')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'View' }).getAttribute('href')).toBe(
      '/sales/orders/11111111-1111-1111-1111-111111111111',
    );
    expect(calls.filter((call) => call.method === 'POST' || call.method === 'PUT')).toHaveLength(0);
  });

  it('renders FRAME 02 detail with independent rail panels and stored snapshots', async () => {
    const { calls } = renderAt('/sales/orders/11111111-1111-1111-1111-111111111111');

    expect(await screen.findByRole('heading', { name: 'Order TRL-2026-004176' })).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Release to warehouse' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Overview' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Fulfilment' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('heading', { name: 'Customer' })).not.toBeNull();
    expect(screen.getByText(/House 42, Road 11, Banani, Dhaka/)).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Items' })).not.toBeNull();
    expect(screen.getByText('Dell OptiPlex 7010 SFF')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Status' })).not.toBeNull();
    expect(screen.getByText('Verification')).not.toBeNull();
    expect(screen.getAllByText('Fulfilment').length).toBeGreaterThan(1);
    expect(screen.getByRole('heading', { name: 'Channel references' })).not.toBeNull();
    expect(screen.getByText('External order ID')).not.toBeNull();
    expect(screen.getAllByText('BLOCKED — MISSING CANONICAL BUSINESS RULE').length).toBeGreaterThan(0);
    expect(calls.filter((call) => call.method === 'POST' || call.method === 'PUT')).toHaveLength(0);
  });
});
