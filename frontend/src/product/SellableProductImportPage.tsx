import ProductCsvImportPage from './ProductCsvImportPage';
import {
  confirmSellableImport,
  sellableTemplateUrl,
  validateSellableImport,
} from './sellableProductApi';

/**
 * Sellable Products CSV import — `PRD-150`.
 *
 * <p>The WORKFLOW is the shared `ProductCsvImportPage` (`UX-043`); this page supplies only the
 * contract-specific endpoints.
 *
 * <p>🔴 The contract carries NO Build Template, BOM or bundle-membership column, and the server
 * REFUSES a file that invents one (`PRD-150.b`, `PRD-150.c`). A versioned, approval-bearing
 * build definition is never authored through a spreadsheet cell, and bundle membership is a
 * structured relationship rather than text. Both are authored on the product's detail surface.
 *
 * <p>🔴 `nature` is CREATE-ONLY. An update attempting to change it is an ERROR reported against
 * its row, never a silent rewrite (`PRD-150.a`, `PRD-070`).
 */
export default function SellableProductImportPage(): React.JSX.Element {
  return (
    <ProductCsvImportPage
      title="Import Sellable Products"
      subtitle="Products · Sellable Products"
      templateHref={sellableTemplateUrl()}
      backTo="/inventory/products/sellable"
      backLabel="Back to Sellable Products"
      onValidate={validateSellableImport}
      onConfirm={confirmSellableImport}
    />
  );
}
