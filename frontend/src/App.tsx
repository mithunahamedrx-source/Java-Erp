import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './auth/LoginPage';
import ProtectedRoute from './auth/ProtectedRoute';
import AppShell from './shell/AppShell';
import { allDestinations } from './shell/navigation';
import ModulePlaceholder from './pages/ModulePlaceholder';
import PrimitivesHarness from './dev/PrimitivesHarness';
import ProductWorkspace from './product/ProductWorkspace';
import StockItemsPage from './product/StockItemsPage';
import StockItemFormPage from './product/StockItemFormPage';
import StockItemImportPage from './product/StockItemImportPage';
import SellableProductsPage from './product/SellableProductsPage';
import SellableProductFormPage from './product/SellableProductFormPage';
import SellableProductDetailPage from './product/SellableProductDetailPage';
import SellableProductImportPage from './product/SellableProductImportPage';
import ChannelListingsPage from './product/ChannelListingsPage';
import ChannelListingCreatePage from './product/ChannelListingCreatePage';
import ChannelListingEditPage from './product/ChannelListingEditPage';
import ListingMediaPage from './product/ListingMediaPage';
import ListingActivityPage from './product/ListingActivityPage';
import ChannelListingDetailPage from './product/ChannelListingDetailPage';
import ChannelListingImportPage from './product/ChannelListingImportPage';
import ChannelListingBatchPage from './product/ChannelListingBatchPage';
import ChannelListingBatchEditPage from './product/ChannelListingBatchEditPage';
import ChannelListingSyncPage from './product/ChannelListingSyncPage';
import ShopsWorkspacePage from './system/ShopsWorkspacePage';
import ShopDetailPage from './system/ShopDetailPage';
import OrdersPage from './order/OrdersPage';
import OrderDetailPage from './order/OrderDetailPage';
import InvoicePage from './order/InvoicePage';
import NewOrderPage from './order/NewOrderPage';

/**
 * Application routes.
 *
 * <p>Every ratified destination is addressable by URL (`UX-023`), registered directly from
 * the frozen navigation register so the sidebar and the router can never drift apart.
 *
 * <p>🔴 Destination pages are placeholders. No business module is implemented.
 */
export default function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/*
        DEVELOPMENT-ONLY primitive harness. 🔴 Registered only when Vite is running in dev
        mode, so it cannot exist in a production build. It is not in the navigation
        register, is not a business route, and is removable without touching any module.
      */}
      {import.meta.env.DEV && <Route path="/__dev/primitives" element={<PrimitivesHarness />} />}

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/*
          The landing route is the FIRST destination in the navigation register.

          ⚠ No canonical rule governs the post-sign-in landing destination, so this is an
          ordinary engineering choice, reported rather than hidden. It deliberately no longer
          points at an Inventory route: Inventory is not started, and the neutral first
          destination carries no business content of any kind.
        */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/*
          The Products workspace - ONE sidebar destination carrying three entity-class tabs at
          path-addressable routes (`UX-035.f`). 🔴 Sellable Products and Listings are
          STRUCTURAL tabs only in Stage P1.

          `UX-035.f.i` - `/inventory/products` RENDERS the workspace with Stock Items active
          and KEEPS that URL. 🔴 It no longer redirects: a workspace entry that instantly
          renames itself after its first tab misstates what the operator opened.

          `/inventory/products/stock` REMAINS ratified and addressable (`UX-023`) and is what
          the tab control targets. Two addressable paths, ONE workspace implementation - the
          same `StockItemsPage`, never a second Products surface.
        */}
        <Route path="/inventory/products" element={<ProductWorkspace />}>
          <Route index element={<StockItemsPage />} />
          <Route path="stock" element={<StockItemsPage />} />
          {/* Stage P2 — Sellable Products is now the second FUNCTIONAL tab (`E-058`). */}
          <Route path="sellable" element={<SellableProductsPage />} />
          {/* Stage P3 - Listings is now the third functional Product tab (`E-059`). */}
          <Route path="listings" element={<ChannelListingsPage />} />
        </Route>
        <Route path="/inventory/products/stock/new" element={<StockItemFormPage mode="create" />} />
        <Route path="/inventory/products/stock/import" element={<StockItemImportPage />} />
        <Route path="/inventory/products/stock/:id" element={<StockItemFormPage mode="detail" />} />
        <Route path="/inventory/products/stock/:id/edit" element={<StockItemFormPage mode="edit" />} />

        <Route path="/inventory/products/sellable/new" element={<SellableProductFormPage mode="create" />} />
        <Route path="/inventory/products/sellable/import" element={<SellableProductImportPage />} />
        <Route path="/inventory/products/sellable/:id" element={<SellableProductDetailPage />} />
        <Route path="/inventory/products/sellable/:id/edit" element={<SellableProductFormPage mode="edit" />} />

        <Route path="/inventory/products/listings/new" element={<ChannelListingCreatePage />} />
        <Route path="/inventory/products/listings/import" element={<ChannelListingImportPage />} />
        {/*
          Stage P3 — the connected Listings surfaces. 🔴 `UX-151` — batch edit, batch review
          and channel sync are complex workflows and are therefore PAGES, never modals. The
          Drawer container remains undefined by source and is deliberately unused.

          ⚠ These routes are placed BEFORE `/:id` so that `sync`, `batch-edit` and `batches`
          are never captured as listing identifiers.
        */}
        <Route path="/inventory/products/listings/sync" element={<ChannelListingSyncPage />} />
        <Route path="/inventory/products/listings/batch-edit" element={<ChannelListingBatchEditPage />} />
        <Route path="/inventory/products/listings/batches/:batchId" element={<ChannelListingBatchPage />} />
        <Route path="/inventory/products/listings/:id" element={<ChannelListingDetailPage />} />
        <Route path="/inventory/products/listings/:id/edit" element={<ChannelListingEditPage />} />
        <Route path="/inventory/products/listings/:id/media" element={<ListingMediaPage />} />
        <Route path="/inventory/products/listings/:id/activity" element={<ListingActivityPage />} />

        {/*
          `SCS-010` — Shops & Channels. TWO surfaces are routed: the workspace and the shop
          detail page. 🔴 The Add/Edit form is a MODAL and deliberately has NO ROUTE, so no
          permanent `/new` or `/:id/edit` path exists for it here or anywhere.
        */}
        <Route path="/administration/shops" element={<ShopsWorkspacePage />} />
        <Route path="/administration/shops/:id" element={<ShopDetailPage />} />

        {/* `OSC-061` - Orders first slice: read-only FRAME 01 and FRAME 02 over API-managed channel orders. */}
        <Route path="/sales/orders" element={<OrdersPage />} />
        {/* `UX-151` - a workflow needing more than a bounded decision gets a PAGE, not a
            modal. Capturing a customer, an address and any number of priced lines is not a
            bounded decision. */}
        <Route path="/sales/orders/new" element={<NewOrderPage />} />
        <Route path="/sales/orders/:id" element={<OrderDetailPage />} />
        {/* The printable. A document, not a workspace - see InvoicePage for why its
            typography and geometry differ from the application shell. */}
        <Route path="/sales/orders/:id/invoice" element={<InvoicePage />} />

        {allDestinations()
          .filter(
            (destination) =>
              destination.path !== '/inventory/products' &&
              destination.path !== '/administration/shops' &&
              destination.path !== '/sales/orders',
          )
          .map((destination) => (
          <Route
            key={destination.path}
            path={destination.path}
            element={<ModulePlaceholder title={destination.label} />}
          />
        ))}
      </Route>

      {/* Unknown paths fall back to the landing route rather than a fabricated 404 screen. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
