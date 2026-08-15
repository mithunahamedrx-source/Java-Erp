import { apiRequest } from '../platform/api';

export type ListingStatus = 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type SyncState = 'PENDING' | 'IN_PROGRESS' | 'SYNCED' | 'FAILED' | 'MANUAL_REQUIRED' | 'DIVERGED';
export type LocalLifecycle = 'DRAFT' | 'PENDING_PUBLICATION' | 'PUBLISHED' | 'WITHDRAWN';
export type MappingState = 'UNMAPPED' | 'PARTIALLY_MAPPED' | 'MAPPED';
export type OperationKind = 'DISCOVER' | 'REFRESH' | 'PUSH_UPDATE' | 'PUBLISH_CREATE' | 'WITHDRAW';
export type OperationOutcome =
  | 'REQUESTED'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'MANUAL_REQUIRED'
  | 'DIVERGED';
export type ActivityKind = 'FIELD_CHANGE' | 'CHANNEL_EVENT' | 'OPERATION';

/**
 * One orderable channel SKU — `E-106`.
 *
 * 🔴 `INV-106.2` — the ORDERABLE SKU is the mapping unit. Price and published stock attach
 * here, not to the listing.
 */
export type ChannelListingSku = {
  readonly id: string;
  readonly channelSku: string | null;
  readonly sellableProductId: string | null;
  readonly sellableSku: string | null;
  readonly sellableName: string | null;
  /** `PRD-199.a` — the NORMAL base selling price for this orderable SKU. */
  readonly salePrice: string | null;
  /** `PRD-199.b` — the optional temporary selling price. Never above `salePrice`. */
  readonly promotionPrice: string | null;
  readonly promotionStartsAt: string | null;
  readonly promotionEndsAt: string | null;
  /** 🔴 `PRD-199.d` — DERIVED server-side from the clock. Never computed in the browser. */
  readonly effectiveSellingPrice: string | null;
  readonly promotionActive: boolean;
  readonly listingStock: string | null;
  readonly reportedSalePrice: string | null;
  readonly reportedSalePriceReadable: boolean;
  readonly reportedPromotionPrice: string | null;
  readonly reportedPromotionPriceReadable: boolean;
  readonly reportedPromotionStartsAt: string | null;
  readonly reportedPromotionEndsAt: string | null;
  readonly reportedPromotionWindowReadable: boolean;
  readonly reportedStock: string | null;
  readonly reportedStockReadable: boolean;
  /**
   * 🔴 `PRD-201.c` — the package facts belong to the ORDERABLE unit, because that is what a
   * courier collects. Weight is KILOGRAMS, dimensions CENTIMETRES (`PRD-201.e`).
   *
   * 🔴 `PRD-201.f` — `null` is ABSENT, never zero.
   */
  readonly packageWeightKg: string | null;
  readonly packageLengthCm: string | null;
  readonly packageWidthCm: string | null;
  readonly packageHeightCm: string | null;
  readonly packageContent: string | null;
  readonly variationLabel: string | null;
  readonly position: number;
};

/**
 * 🔴 `INV-106.2` — an orderable SKU is mapped exactly when it resolves to one Sellable
 * Product. Derived from the identifier rather than read from a serialised flag, so the two
 * can never disagree.
 */
export function isSkuMapped(sku: ChannelListingSku): boolean {
  return sku.sellableProductId !== null;
}

/**
 * One Channel Listing.
 *
 * 🔴 Four INDEPENDENT state dimensions travel separately and are never merged into one
 * column (`UX-038`): the channel-owned `listingStatus`, the integration `syncState`,
 * Trioloo's `publicationIntent` and the DERIVED `hasUnsentLocalChanges`.
 *
 * 🔴 Money is a STRING (`TEC-015`). It is never parsed into a JavaScript `Number` for any
 * authoritative purpose — only formatted for display.
 */
export type ChannelListing = {
  readonly id: string;
  readonly channelInstanceId: string;
  readonly channelInstance: string;
  readonly channelName: string | null;
  readonly channelType: string | null;
  readonly adapterAvailable: boolean;
  /**
   * 🔴 Whether the adapter declares that ANY Listing fact can be READ for this channel
   * instance (`API-063`, `PRD-125`).
   *
   * ⚠ DISTINCT FROM `adapterAvailable`. An adapter that exists but reports nothing readable
   * blocks Refresh for a completely different reason, and the two are never collapsed.
   *
   * ⚠ Optional in the TYPE only: a response that does not state it is treated as "not
   * declared", which is the same as no support (`API-063`) — never as assumed support.
   */
  readonly adapterReadsListings?: boolean;
  /** `INV-59.2` — absent before first publication. */
  readonly externalListingId: string | null;
  readonly mappingState: MappingState;
  readonly skuCount: number;
  readonly mappedSkuCount: number;
  readonly sellableProductId: string | null;
  readonly mappedSellableSku: string | null;
  readonly sellableName: string | null;
  /** `PRD-202.a` — the ENGLISH content, and the primary authoring value. */
  readonly intendedTitle: string | null;
  readonly intendedDescription: string | null;
  /** `PRD-202.b` — the OPTIONAL Bangla overrides, exactly as authored. `null` = none written. */
  readonly intendedTitleBn: string | null;
  readonly intendedDescriptionBn: string | null;
  /**
   * 🔴 `PRD-202.c` — the EFFECTIVE Bangla, DERIVED server-side: the override where one
   * exists, otherwise the English content. Never stored (`PRD-202.d`).
   */
  readonly effectiveTitleBn: string | null;
  readonly effectiveDescriptionBn: string | null;
  /**
   * `PRD-199.a` — the NORMAL base selling price, from the SKU with the lowest effective one.
   *
   * 🔴 Money is a STRING (`TEC-015`). It is never parsed into a JavaScript `Number` for any
   * authoritative purpose — only formatted for display.
   */
  readonly salePrice: string | null;
  /** `PRD-199.b` — the optional promotion, from the SAME SKU the base price came from. */
  readonly promotionPrice: string | null;
  readonly promotionStartsAt: string | null;
  readonly promotionEndsAt: string | null;
  /**
   * 🔴 `PRD-199.d` — what a customer would pay RIGHT NOW: the promotion while its window is
   * open, the Sale Price otherwise. DERIVED SERVER-SIDE from the clock, because a browser
   * clock is not authority for what a shop is charging.
   */
  readonly effectiveSellingPrice: string | null;
  readonly promotionActive: boolean;
  /** True when the listing spans several SKUs, so the price shown is a "from" price. */
  readonly priceIsFrom: boolean;
  readonly listingStock: string | null;
  readonly publicationIntent: string | null;
  readonly intendedChannelCategory: string | null;
  readonly channelReportedTitle: string | null;
  readonly reportedTitleReadable: boolean;
  readonly reportedDescription: string | null;
  readonly reportedDescriptionReadable: boolean;
  readonly reportedSalePrice: string | null;
  readonly reportedSalePriceReadable: boolean;
  readonly reportedPromotionPrice: string | null;
  readonly reportedPromotionPriceReadable: boolean;
  readonly reportedPromotionStartsAt: string | null;
  readonly reportedPromotionEndsAt: string | null;
  readonly reportedPromotionWindowReadable: boolean;
  readonly reportedStock: string | null;
  readonly reportedStockReadable: boolean;
  readonly reportedChannelCategory: string | null;
  readonly reportedChannelCategoryReadable: boolean;
  readonly listingStatus: ListingStatus | null;
  readonly syncState: SyncState;
  readonly localLifecycle: LocalLifecycle;
  /** `PRD-185.c` — DERIVED by the server, never stored and never computed here. */
  readonly hasUnsentLocalChanges: boolean;
  readonly divergedFactCount: number;
  readonly primaryMediaReference: string | null;
  /**
   * `PRD-198.c` — the EFFECTIVE highlights in AUTHORED order: the Listing's own set where it
   * holds one, otherwise the mapped Sellable Product's master set.
   *
   * 🔴 Order is meaningful and is never re-sorted here.
   */
  readonly highlights: readonly string[];
  /** `PRD-198.c` — true when the effective set is the fallback rather than the Listing's own. */
  readonly highlightsAreFallback: boolean;
  /**
   * 🔴 `PRD-202.f` — ALL-OR-NOTHING. A Bangla set that exists is the effective Bangla set
   * entirely; where none exists the English set is used entirely. No per-line merge.
   */
  readonly highlightsBn: readonly string[];
  readonly effectiveHighlightsBn: readonly string[];
  readonly highlightsBnAreFallback: boolean;
  readonly lastSyncAt: string | null;
  readonly lastSeenInDiscoveryAt: string | null;
  readonly lastSuccessfulPushAt: string | null;
  readonly updatedAt: string;
  readonly version: number;
  readonly skus: readonly ChannelListingSku[];
};

export type Paged<T> = {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
};

export type ChannelListingPage = Paged<ChannelListing>;

/**
 * The five ratified summary facts.
 *
 * 🔴 Counted by the DATABASE over the authorised filtered set (`UX-044`). The browser never
 * counts a 3000+ corpus (`PRD-174.b`).
 */
export type ChannelListingSummary = {
  readonly totalListings: number;
  readonly unmappedListings: number;
  readonly divergedListings: number;
  readonly unsentChangeListings: number;
  readonly manualRequiredListings: number;
};

export type ChannelListingFilters = {
  search?: string;
  channelInstance?: string;
  listingStatus?: ListingStatus | '';
  syncState?: SyncState | '';
  lifecycle?: LocalLifecycle | '';
  publicationIntent?: string;
  sellableProductId?: string;
  /** null/undefined means "either"; false means at least one SKU is unmapped. */
  mapped?: boolean;
  divergedOnly?: boolean;
  unsentOnly?: boolean;
};

export type CapabilityView = {
  readonly fieldKey: string;
  readonly readable: boolean;
  readonly writable: boolean;
};

/** 🔴 `adapterAvailable` is reported honestly; where false the UI says why. */
export type ChannelView = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly channelType: string;
  readonly adapterAvailable: boolean;
  readonly knownListings: number;
  readonly lastSyncAt: string | null;
  readonly capabilities: readonly CapabilityView[];
};

export type MediaRole = 'PRIMARY' | 'GALLERY';

export type MediaView = {
  readonly id: string | null;
  readonly mediaAssetId: string | null;
  readonly storageReference: string;
  readonly role: MediaRole;
  readonly position: number;
  readonly source: 'LISTING_INTENDED' | 'SELLABLE_MASTER' | 'CHANNEL_REPORTED';
};

/**
 * `PRD-182` — the three media concepts a listing carries.
 *
 * 🔴 `effectiveIsFallback` is DERIVED (`PRD-170.a`): true when the listing holds no override
 * and the effective set therefore comes from the mapped Sellable Product. The fallback is
 * never materialised as listing-owned rows (`PRD-170.b`).
 */
export type MediaSetView = {
  readonly master: readonly MediaView[];
  readonly intended: readonly MediaView[];
  readonly reported: readonly MediaView[];
  readonly effective: readonly MediaView[];
  readonly effectiveIsFallback: boolean;
  readonly reportedOrderReliable: boolean;
};

/**
 * 🔴 `UNSENT` is NOT divergence (`PRD-185.d`). The reported value is still correct for the
 * last push, so Accept Marketplace is not offered for it.
 */
export type ComparisonRow = {
  readonly fieldKey: string;
  readonly label: string;
  readonly intendedValue: string | null;
  readonly reportedValue: string | null;
  readonly reportedReadable: boolean;
  readonly state: 'ALIGNED' | 'DIVERGED' | 'NOT_READABLE' | 'UNSENT' | 'MANUAL_REQUIRED';
  readonly resolvable: boolean;
};

export type OperationView = {
  readonly id: string;
  readonly channelListingId: string;
  readonly listingTitle: string | null;
  readonly externalListingId: string | null;
  readonly channelName: string | null;
  readonly batchId: string | null;
  readonly operationKind: OperationKind;
  readonly outcome: OperationOutcome;
  readonly detail: string | null;
  readonly adapterProvenance: string | null;
  readonly requestedByName: string | null;
  readonly requestedAt: string;
  readonly completedAt: string | null;
};

/**
 * 🔴 `PRD-186.d` — only a FAILED operation may be retried. `MANUAL_REQUIRED` and `DIVERGED`
 * are deliberately excluded: a person must decide those outcomes before anything is sent
 * again. Derived here rather than trusted from the wire, so the rule lives in one place.
 */
export function isOperationRetryable(operation: OperationView): boolean {
  return operation.outcome === 'FAILED';
}

/** 🔴 `INV-108.2` — every count is DERIVED from members by the server, never stored. */
export type BatchView = {
  readonly id: string;
  readonly operationKind: OperationKind;
  readonly scopeDescription: string | null;
  readonly requestedByName: string | null;
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly requested: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly manualRequired: number;
  readonly diverged: number;
  readonly inFlight: number;
};

export type ActivityView = {
  readonly id: string;
  readonly entryKind: ActivityKind;
  readonly summary: string;
  readonly fieldKey: string | null;
  readonly beforeValue: string | null;
  readonly afterValue: string | null;
  readonly source: string | null;
  /** Null means the marketplace or a scheduler acted, not a person. */
  readonly actorName: string | null;
  readonly operationId: string | null;
  readonly batchId: string | null;
  readonly occurredAt: string;
};

/** One channel's share of a filter-scoped selection, aggregated by the server. */
export type ChannelSelectionCount = {
  readonly channelName: string;
  readonly selected: number;
};

/**
 * 🔴 `UX-044` — resolved SERVER-SIDE. `byChannel` is aggregated over the SAME predicate that
 * produced `listingIds`, so the breakdown always sums to the selection it describes. The
 * browser never counts rows.
 */
export type SelectionScope = {
  readonly listingIds: readonly string[];
  readonly channelNames: readonly string[];
  readonly byChannel: readonly ChannelSelectionCount[];
};

export type DiscoveryOutcome = {
  readonly batchId: string;
  readonly listingsSeen: number;
  readonly listingsCreated: number;
  /** 🔴 `API-066.b` — a truncated run is never presented as a complete picture. */
  readonly complete: boolean;
  readonly incompleteReason: string | null;
};

const BASE = '/api/product/channel-listings';

/**
 * 🔴 `TEC-096` — every filter dimension is sent to the SERVER. The browser never filters,
 * sorts or counts the corpus itself (`PRD-174.b`).
 */
function query(filters: ChannelListingFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.channelInstance) params.set('channelInstance', filters.channelInstance);
  if (filters.listingStatus) params.set('listingStatus', filters.listingStatus);
  if (filters.syncState) params.set('syncState', filters.syncState);
  if (filters.lifecycle) params.set('lifecycle', filters.lifecycle);
  if (filters.publicationIntent) params.set('publicationIntent', filters.publicationIntent);
  if (filters.sellableProductId) params.set('sellableProductId', filters.sellableProductId);
  if (filters.mapped !== undefined) params.set('mapped', String(filters.mapped));
  if (filters.divergedOnly) params.set('divergedOnly', 'true');
  if (filters.unsentOnly) params.set('unsentOnly', 'true');
  return params.toString();
}

export async function listChannelListings(
  filters: ChannelListingFilters,
  page: number,
  size: number,
): Promise<ChannelListingPage> {
  const params = new URLSearchParams(query(filters));
  params.set('page', String(page));
  params.set('size', String(size));
  return apiRequest<ChannelListingPage>(`${BASE}?${params.toString()}`);
}

export async function fetchChannelListingSummary(
  filters: ChannelListingFilters,
): Promise<ChannelListingSummary> {
  return apiRequest<ChannelListingSummary>(`${BASE}/summary?${query(filters)}`);
}

export async function fetchChannelListing(id: string): Promise<ChannelListing> {
  return apiRequest<ChannelListing>(`${BASE}/${id}`);
}

export async function fetchChannels(): Promise<readonly ChannelView[]> {
  return apiRequest<readonly ChannelView[]>(`${BASE}/channels`);
}

/**
 * Resolves "select all matching" on the SERVER.
 *
 * 🔴 `UX-044` — the browser never enumerates a 3000+ corpus to build a batch.
 */
export async function fetchSelectionScope(
  filters: ChannelListingFilters,
): Promise<SelectionScope> {
  return apiRequest<SelectionScope>(`${BASE}/selection-scope?${query(filters)}`);
}

export async function fetchComparison(id: string): Promise<readonly ComparisonRow[]> {
  return apiRequest<readonly ComparisonRow[]>(`${BASE}/${id}/comparison`);
}

export async function fetchMedia(id: string): Promise<MediaSetView> {
  return apiRequest<MediaSetView>(`${BASE}/${id}/media`);
}

/** 🔴 `PRD-170` — an empty list CLEARS the override and restores the master set. */
export async function replaceMedia(
  id: string,
  items: readonly { mediaAssetId: string; primary: boolean }[],
): Promise<void> {
  await apiRequest<void>(`${BASE}/${id}/media`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function acceptReportedMedia(id: string): Promise<void> {
  await apiRequest<void>(`${BASE}/${id}/media/accept-marketplace`, { method: 'POST' });
}

/** 🔴 `PRD-183` — one field, one explicit operator decision. Never automatic. */
export async function acceptMarketplaceValue(id: string, field: string): Promise<void> {
  await apiRequest<void>(`${BASE}/${id}/accept-marketplace`, {
    method: 'POST',
    body: JSON.stringify({ field }),
  });
}

/** 🔴 `PRD-185` — a LOCAL save. This never contacts a channel. */
export async function createChannelListing(body: Record<string, unknown>): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(BASE, { method: 'POST', body: JSON.stringify(body) });
}

/** 🔴 `PRD-185` — a LOCAL save. This never contacts a channel. */
export async function updateChannelListing(
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  await apiRequest<void>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * An advisory mapping suggestion, `PRD-179`.
 *
 * 🔴 `basis` names the EVIDENCE in words ("Exact seller SKU match"). There is deliberately no
 * confidence score, percentage or rank (`PRD-179.d`), and nothing here becomes a mapping
 * without an explicit confirmation (`PRD-179.b`).
 */
export type MappingSuggestion = {
  readonly sellableProductId: string;
  readonly sellableSku: string;
  readonly sellableName: string;
  readonly basis: string;
  readonly exact: boolean;
};

/** 🔴 A READ. Asking for advice never changes a mapping. */
export async function fetchMappingSuggestions(
  skuId: string,
): Promise<readonly MappingSuggestion[]> {
  return apiRequest<readonly MappingSuggestion[]>(`${BASE}/skus/${skuId}/mapping-suggestions`);
}

export async function mapSku(
  skuId: string,
  mappedSellableSku: string,
  version: number | null,
): Promise<void> {
  await apiRequest<void>(`${BASE}/skus/${skuId}/mapping`, {
    method: 'PUT',
    body: JSON.stringify({ mappedSellableSku, version }),
  });
}

export async function unmapSku(skuId: string, version: number | null): Promise<void> {
  const suffix = version === null ? '' : `?version=${version}`;
  await apiRequest<void>(`${BASE}/skus/${skuId}/mapping${suffix}`, { method: 'DELETE' });
}

export async function updateSkuValues(
  skuId: string,
  body: {
    salePrice: string | null;
    promotionPrice: string | null;
    promotionStartsAt: string | null;
    promotionEndsAt: string | null;
    publishedMarketplaceStock: string | null;
    version: number | null;
  },
): Promise<void> {
  await apiRequest<void>(`${BASE}/skus/${skuId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * 🔴 Requests a REMOTE act. Separate from every save endpoint above, and separately
 * permissioned (`PRD-196.a`).
 */
export async function requestOperation(
  kind: OperationKind,
  listingIds: readonly string[],
  scopeDescription: string,
): Promise<{ batchId: string }> {
  return apiRequest<{ batchId: string }>(`${BASE}/operations`, {
    method: 'POST',
    body: JSON.stringify({ kind, listingIds, scopeDescription }),
  });
}

/** 🔴 `PRD-186.d` — retries FAILED members only. Manual-attention items are excluded. */
export async function retryBatch(batchId: string): Promise<{ batchId: string }> {
  return apiRequest<{ batchId: string }>(`${BASE}/operations/batches/${batchId}/retry`, {
    method: 'POST',
  });
}

export async function discoverChannel(channelInstanceId: string): Promise<DiscoveryOutcome> {
  return apiRequest<DiscoveryOutcome>(`${BASE}/discovery`, {
    method: 'POST',
    body: JSON.stringify({ channelInstanceId }),
  });
}

export async function fetchBatch(batchId: string): Promise<BatchView> {
  return apiRequest<BatchView>(`${BASE}/operations/batches/${batchId}`);
}

export async function fetchBatchMembers(
  batchId: string,
  outcome: OperationOutcome | '',
  page: number,
  size: number,
): Promise<Paged<OperationView>> {
  const params = new URLSearchParams();
  if (outcome) params.set('outcome', outcome);
  params.set('page', String(page));
  params.set('size', String(size));
  return apiRequest<Paged<OperationView>>(
    `${BASE}/operations/batches/${batchId}/members?${params.toString()}`,
  );
}

export async function fetchListingOperations(id: string): Promise<readonly OperationView[]> {
  return apiRequest<readonly OperationView[]>(`${BASE}/${id}/operations`);
}

export async function fetchActivity(
  id: string,
  kind: ActivityKind | '',
  page: number,
  size: number,
): Promise<Paged<ActivityView>> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  params.set('page', String(page));
  params.set('size', String(size));
  return apiRequest<Paged<ActivityView>>(`${BASE}/${id}/activity?${params.toString()}`);
}

export function channelListingExportUrl(filters: ChannelListingFilters): string {
  return `${BASE}/export?${query(filters)}`;
}

export function channelListingTemplateUrl(): string {
  return `${BASE}/import/template`;
}

export async function validateChannelListingImport(
  csv: string,
): Promise<import('./stockItemApi').ImportPlan> {
  return apiRequest(`${BASE}/import/validate`, { method: 'POST', body: JSON.stringify({ csv }) });
}

export async function confirmChannelListingImport(
  planId: string,
): Promise<import('./stockItemApi').ImportResult> {
  return apiRequest(`${BASE}/import/confirm`, { method: 'POST', body: JSON.stringify({ planId }) });
}

// =====================================================================================
// AI authoring — PRD-200
// =====================================================================================

/** ⚠ `PRD-200.a` — what may be asked for. Media generation is `PRD-203`'s and is not here. */
export type AiAuthoringKind = 'TITLE' | 'HIGHLIGHTS' | 'DESCRIPTION';

/**
 * 🔴 `PRD-200.r` — whether an assistant exists at all.
 *
 * ⚠ An unconfigured provider is an ORDINARY state, not an error. The panel opens and says so.
 */
export async function fetchAiStatus(): Promise<{ configured: boolean }> {
  return apiRequest<{ configured: boolean }>(`${BASE}/ai/status`);
}

/**
 * Asks for CANDIDATES. 🔴 This writes nothing (`PRD-200.a`): it returns text the operator
 * has not accepted, and acceptance only edits the form (`PRD-200.k`).
 *
 * 🔴 `PRD-200.g` — a blank fact is reported to the assistant as ABSENT, never dropped and
 * never guessed, so a missing warranty period cannot come back as an invented one.
 */
export async function generateAiCandidates(body: {
  kind: AiAuthoringKind;
  language: 'EN' | 'BN';
  instruction: string | null;
  facts: Record<string, string | null>;
  adapterConstraints: readonly string[];
}): Promise<{ candidates: Partial<Record<AiAuthoringKind, string>> }> {
  return apiRequest<{ candidates: Partial<Record<AiAuthoringKind, string>> }>(
    `${BASE}/ai/generate`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

// =====================================================================================
// Push Review — the local/remote boundary, `PRD-185` / `PRD-186`
// =====================================================================================

/**
 * One preflight finding, in exactly ONE dimension.
 *
 * 🔴 `UX-271.b` — the dimensions are never collapsed into a generic "not ready". Whether the
 * operator must type something, map something, or wait for an adapter that does not exist yet
 * are completely different remedies, and one badge could only ever name one of them.
 */
export type PreflightDimension =
  | 'LOCAL_VALIDATION'
  | 'MAPPING'
  | 'ADAPTER_CAPABILITY'
  | 'MARKETPLACE_SCHEMA';

export type PreflightItem = {
  readonly dimension: PreflightDimension;
  /** 🔴 A recommendation NEVER prevents an outbound act (`PRD-188.a`). */
  readonly blocking: boolean;
  readonly text: string;
};

/** 🔴 Decided by REMOTE IDENTITY, never by channel (`PRD-188` / `PRD-171`). */
export type OutboundMode = 'FIRST_PUBLICATION' | 'EXISTING_UPDATE';

/**
 * What would be sent for one Listing, and whether it can be sent right now.
 *
 * 🔴 Composed from PERSISTED intent only. An unsaved editor draft is not intent and never
 * reaches here, so the review always represents exactly what the ERP holds (`PRD-185.a`).
 *
 * 🔴 `API-062.d` — provider-neutral business facts. No marketplace field name, endpoint or
 * payload key appears in this shape; an adapter translates it into a request later.
 */
export type PushReview = {
  readonly listingId: string;
  /**
   * 🔴 The stale-review token. Carried back on confirmation so an outbound act can never be
   * dispatched from a review the operator read while the Listing changed underneath it.
   */
  readonly reviewVersion: number;
  readonly mode: OutboundMode;
  readonly listingTitle: string | null;
  readonly channelName: string | null;
  readonly channelType: string | null;
  /** 🔴 `PRD-188.b` — null in FIRST_PUBLICATION. The channel issues it on acceptance. */
  readonly externalListingId: string | null;
  readonly skuCount: number;
  readonly mappedSkuCount: number;
  readonly unsentLocalChanges: boolean;
  readonly divergedFieldCount: number;
  readonly publicationIntent: string | null;
  /** 🔴 `INV-106.2` — the orderable units own price and stock; no parent figure is sent. */
  readonly perSkuCommercials: boolean;
  readonly fields: readonly ComparisonRow[];
  readonly skus: readonly ChannelListingSku[];
  readonly effectiveMedia: readonly MediaView[];
  /** 🔴 `PRD-170` — true when the effective set is the mapped product's master media. */
  readonly mediaIsFallback: boolean;
  readonly highlights: readonly string[];
  readonly banglaOverridePresent: boolean;
  /** 🔴 `PRD-202.c` — a Bangla reader sees the English content. COMPLETE, not missing. */
  readonly banglaFallsBackToEnglish: boolean;
  readonly preflight: readonly PreflightItem[];
  readonly executable: boolean;
  readonly executionBlockedReason: string | null;
};

/**
 * 🔴 A READ. Composing a review contacts no marketplace, records no operation, writes no
 * activity and changes no state — including the derived unsent condition.
 */
export async function fetchPushReview(id: string): Promise<PushReview> {
  return apiRequest<PushReview>(`${BASE}/${id}/push-review`);
}

/**
 * Dispatches the reviewed outbound act, `PRD-186`.
 *
 * 🔴 `reviewVersion` is the version the operator actually read. A Listing that moved on since
 * is refused BEFORE dispatch rather than sent from a stale review.
 */
export async function confirmPushReview(
  id: string,
  reviewVersion: number,
): Promise<{ batchId: string }> {
  return apiRequest<{ batchId: string }>(`${BASE}/${id}/push-review/confirm`, {
    method: 'POST',
    body: JSON.stringify({ reviewVersion }),
  });
}

// =====================================================================================
// Refresh — the inbound boundary, `PRD-189.c` (FRAME 16)
// =====================================================================================

/** 🔴 The lifecycle of ONE Listing refresh. `IDLE` and `REFRESHING` are client-side. */
export type RefreshState =
  | 'IDLE'
  | 'REFRESHING'
  | 'COMPLETED_NO_CHANGE'
  | 'COMPLETED_CHANGED'
  | 'FAILED'
  | 'MANUAL_REQUIRED';

/**
 * What one inbound refresh achieved.
 *
 * 🔴 REFRESH READS THE MARKETPLACE AND NEVER WRITES TO IT. Everything here concerns the
 * REPORTED side and the comparison derived from it; no intended value, mapping, publication
 * intent or unsent condition is touched by the act it describes (`PRD-181.a`).
 *
 * 🔴 A SUCCESSFUL READ IS NOT AGREEMENT. `outcome` says the channel could be read;
 * `divergedFieldCount` says whether what it returned matches ERP intent (`§13`).
 */
export type RefreshResult = {
  readonly listingId: string;
  readonly operationId: string | null;
  readonly listingTitle: string | null;
  readonly channelName: string | null;
  readonly outcome: 'SUCCEEDED' | 'FAILED' | 'MANUAL_REQUIRED';
  readonly state: Exclude<RefreshState, 'IDLE' | 'REFRESHING'>;
  readonly detail: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  /** 🔴 Readable reported values that actually MOVED. Empty is a real answer. */
  readonly changedDomains: readonly string[];
  /** ⚠ `SYS-025` — a normal outcome, not a failure. A person must look. */
  readonly manualRequiredDomains: readonly string[];
  readonly notReadableFieldCount: number;
  readonly divergedFieldCount: number;
  /** 🔴 `PRD-185.c` — carried so the surface can show refresh did NOT clear it. */
  readonly unsentLocalChanges: boolean;
  readonly syncState: SyncState | null;
};

/**
 * Re-reads ONE Listing from its channel, `PRD-189.c`.
 *
 * 🔴 Refuses BEFORE recording anything when the Listing has no remote identity or the channel
 * has no adapter — an operation record for an attempt that never happened would be a lie.
 */
export async function refreshListing(id: string): Promise<RefreshResult> {
  return apiRequest<RefreshResult>(`${BASE}/${id}/refresh`, { method: 'POST' });
}
