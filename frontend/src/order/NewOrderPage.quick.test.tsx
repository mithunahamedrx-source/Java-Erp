import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import NewOrderPage from './NewOrderPage';

/**
 * The quick line — owner decision 2026-10-05. Filling the search line as free text plus a total
 * price is enough to create an order, with no item description rows; it is tagged WALK-IN.
 */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderPage(): { readonly posts: { url: string; body: Record<string, unknown> }[] } {
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return json({ id: 'dev', username: 'm', fullName: 'M', roles: [], permissions: [] });
      }
      if (url.includes('/capture-options')) {
        return json({
          shops: [{ id: 'shop-1', code: 'CHN-1', name: 'Trioloo Store', channelType: 'WEBSITE' }],
          users: [{ id: 'dev', fullName: 'M' }, { id: 'u2', fullName: 'Tania Sultana' }],
        });
      }
      if (url.includes('/api/order/orders') && init?.method === 'POST') {
        posts.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
        return json({ id: 'new-1', invoiceNumber: 'TR0001', canonicalStatus: 'PENDING_VERIFICATION' }, 201);
      }
      return json({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
    }),
  );
  render(
    <AuthProvider>
      <PageActionsProvider>
        <MemoryRouter initialEntries={['/sales/orders/new']}>
          <Routes>
            <Route path="/sales/orders/new" element={<NewOrderPage />} />
            <Route path="/sales/orders/:id" element={<div data-testid="landed" />} />
          </Routes>
        </MemoryRouter>
      </PageActionsProvider>
    </AuthProvider>,
  );
  return { posts };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('New order — the quick line', () => {
  it('creates a walk-in order from the quick line and a total price alone', async () => {
    const { posts } = renderPage();
    const shop = (await screen.findByRole('option', { name: 'Trioloo Store' })).parentElement as HTMLSelectElement;
    fireEvent.change(shop, { target: { value: 'shop-1' } });

    fireEvent.change(screen.getByTestId('new-order-search'), { target: { value: 'Keyboard and mouse' } });
    // The quick line alone is not enough: the total price is required.
    expect(screen.getByTestId('new-order-quick-hint').textContent).toContain('enter the total price');
    fireEvent.click(screen.getByTestId('new-order-submit'));
    expect(await screen.findByTestId('new-order-error')).not.toBeNull();
    expect(posts).toHaveLength(0);

    fireEvent.change(screen.getByTestId('new-order-quick-total'), { target: { value: '4500' } });
    expect(screen.getByTestId('new-order-quick-hint').textContent).toContain('tagged Walk-in');
    fireEvent.click(screen.getByTestId('new-order-submit'));

    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0]?.body as { walkIn: boolean; total: string; channelInstanceId: string; lines: { name: string; unitPrice: string }[] };
    expect(body.walkIn).toBe(true);
    expect(body.channelInstanceId).toBe('shop-1');
    // The total is the STRING the operator typed (TEC-015), and the quick line is the one item.
    expect(body.total).toBe('4500');
    expect(body.lines).toEqual([{ lineNumber: 1, name: 'Keyboard and mouse', sku: null, unitPrice: '4500' }]);
    expect(await screen.findByTestId('landed')).not.toBeNull();
  });

  it('keeps the ordinary path when an item description row is filled', async () => {
    const { posts } = renderPage();
    const shop = (await screen.findByRole('option', { name: 'Trioloo Store' })).parentElement as HTMLSelectElement;
    fireEvent.change(shop, { target: { value: 'shop-1' } });
    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Rifat Hasan' } });
    fireEvent.change(screen.getAllByPlaceholderText('Item description')[0] as HTMLElement, { target: { value: 'Monitor' } });
    fireEvent.click(screen.getByTestId('new-order-submit'));

    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0]?.body as { walkIn: boolean; lines: { name: string }[] };
    expect(body.walkIn).toBe(false);
    expect(body.lines[0]?.name).toBe('Monitor');
  });
});

describe('New order — customer type, shop and sold by', () => {
  it('puts the three on ONE row, lists the owner\'s three types, and defaults Sold by to the signed-in user', async () => {
    renderPage();
    const shop = (await screen.findByRole('option', { name: 'Trioloo Store' })).parentElement as HTMLSelectElement;
    const row = shop.closest('div[style*="repeat(3"]') as HTMLElement;
    // Customer type, Shop and Sold by are siblings in the same three-column row.
    expect(row).not.toBeNull();
    expect(row.textContent).toContain('Customer type');
    expect(row.textContent).toContain('Shop');
    expect(row.textContent).toContain('Sold by');

    for (const label of ['Walk-in order', 'Marketplace order', 'Website order']) {
      expect(screen.getByRole('option', { name: label })).not.toBeNull();
    }
    // The shop list comes from the register; the user list from active profiles.
    expect(screen.getByRole('option', { name: 'Tania Sultana' })).not.toBeNull();
    const soldBy = screen.getByRole('option', { name: 'Tania Sultana' }).parentElement as HTMLSelectElement;
    await waitFor(() => expect(soldBy.value).toBe('dev'));
  });

  it('sends the chosen type, the seller and the advance as typed (a string)', async () => {
    const { posts } = renderPage();
    const shop = (await screen.findByRole('option', { name: 'Trioloo Store' })).parentElement as HTMLSelectElement;
    fireEvent.change(shop, { target: { value: 'shop-1' } });
    fireEvent.change(screen.getByRole('option', { name: 'Marketplace order' }).parentElement as HTMLSelectElement, { target: { value: 'MARKETPLACE' } });
    fireEvent.change(screen.getByRole('option', { name: 'Tania Sultana' }).parentElement as HTMLSelectElement, { target: { value: 'u2' } });
    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Rifat Hasan' } });
    fireEvent.change(screen.getAllByPlaceholderText('Item description')[0] as HTMLElement, { target: { value: 'Monitor' } });
    fireEvent.change(screen.getByTestId('new-order-advance'), { target: { value: '500.50' } });
    fireEvent.change(screen.getByRole('option', { name: '1 year' }).parentElement as HTMLSelectElement, { target: { value: 'Y1' } });
    fireEvent.click(screen.getByTestId('new-order-submit'));

    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0]?.body as { orderType: string; soldBy: string; advanceReceived: string; warrantyTerm: string };
    expect(body.warrantyTerm).toBe('Y1');
    expect(body.orderType).toBe('MARKETPLACE');
    expect(body.soldBy).toBe('u2');
    expect(body.advanceReceived).toBe('500.50');
  });

  it('refuses a malformed advance before it leaves the browser', async () => {
    const { posts } = renderPage();
    const shop = (await screen.findByRole('option', { name: 'Trioloo Store' })).parentElement as HTMLSelectElement;
    fireEvent.change(shop, { target: { value: 'shop-1' } });
    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Rifat Hasan' } });
    fireEvent.change(screen.getAllByPlaceholderText('Item description')[0] as HTMLElement, { target: { value: 'Monitor' } });
    fireEvent.change(screen.getByTestId('new-order-advance'), { target: { value: '5,00x' } });
    fireEvent.click(screen.getByTestId('new-order-submit'));

    expect(await screen.findByTestId('new-order-error')).not.toBeNull();
    expect(posts).toHaveLength(0);
  });
});
