import ProductCsvImportPage from './ProductCsvImportPage';
import { confirmImport, templateUrl, validateImport } from './stockItemApi';

/**
 * Stock Items CSV import — `PRD-149`.
 *
 * <p>The WORKFLOW is the shared `ProductCsvImportPage` (`UX-043`); this page supplies only the
 * contract-specific endpoints. 🔴 One workflow implementation serves all three Product CSV
 * contracts, so the upload-never-writes and atomic-confirm guarantees cannot drift apart
 * between them.
 */
export default function StockItemImportPage(): React.JSX.Element {
  return (
    <ProductCsvImportPage
      title="Import Stock Items"
      subtitle="Products · Stock Items"
      templateHref={templateUrl()}
      backTo="/inventory/products/stock"
      backLabel="Back to Stock Items"
      onValidate={validateImport}
      onConfirm={confirmImport}
    />
  );
}
