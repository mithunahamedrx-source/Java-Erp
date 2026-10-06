import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import StockControlPage from './StockControlPage';

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Stock Control', () => {
  it('lists each stock item with its derived position', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) return json({ id: 'u', username: 'm', fullName: 'M', roles: [], permissions: ['product.stock-item.view'] });
      if (url.includes('/summary')) return json({ totalStockItems: 2, physicalStockUnits: '5', availableUnits: '4' });
      if (url.includes('/api/product/stock-items')) return json({ content: [{ id: 'a', inventorySku: 'SKU-1', technicalName: 'SSD 512GB', inventoryCategory: 'SSD',
        physicalStock: '5', availableQuantity: '4', outOfStock: false, discontinued: false, recordStatus: 'ACTIVE' }], totalElements: 1, page: 0, size: 10, totalPages: 1 });
      return json({});
    }));
    render(<AuthProvider><PageActionsProvider><MemoryRouter initialEntries={['/inventory/stock']}><Routes>
      <Route path="/inventory/stock" element={<StockControlPage />} /></Routes></MemoryRouter></PageActionsProvider></AuthProvider>);
    expect(await screen.findByTestId('stock-card-SKU-1')).toBeTruthy();
    expect(screen.getByText('IN STOCK')).toBeTruthy();
  });
});
