import ProductCsvImportPage from './ProductCsvImportPage';
import {
  channelListingTemplateUrl,
  confirmChannelListingImport,
  validateChannelListingImport,
} from './channelListingApi';

export default function ChannelListingImportPage(): React.JSX.Element {
  return (
    <ProductCsvImportPage
      title="Import Listings"
      subtitle="Validate the Listings CSV before confirming any write."
      templateHref={channelListingTemplateUrl()}
      backTo="/inventory/products/listings"
      backLabel="Back to Listings"
      onValidate={validateChannelListingImport}
      onConfirm={confirmChannelListingImport}
    />
  );
}
