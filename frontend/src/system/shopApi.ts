import { apiRequest } from '../platform/api';

/**
 * The Shops & Channels client.
 *
 * <p>🔴 `TEC-096` / `SCS-022.a` — SEARCH, FILTERING AND COUNTING ARE THE SERVER'S. Nothing in
 * this file filters, sorts or counts a result set; every control becomes a query parameter.
 *
 * <p>🔴 No shape here carries a token, secret, password or provider payload, and none may
 * gain one (`API-070`, `SCS-052`).
 */

/** `E-015` — the recognised set, as refined 2026-08-15 (`INV-15.4`). */
export type ChannelTypeCode =
  | 'DARAZ'
  | 'WEBSITE'
  | 'SHOPIFY'
  | 'WOOCOMMERCE'
  | 'FACEBOOK'
  | 'WHATSAPP'
  | 'PHONE'
  | 'WALKIN';

/** `SYS-108` — the CONFIGURATION lifecycle. 🔴 Not the connection condition. */
export type ConfigurationState = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

/**
 * `API-068` — the connection condition. 🔴 EXACTLY FOUR.
 *
 * <p>`SCS-043.a` — "unavailable" is not a member of this union, because it is not a
 * condition. It arrives as `connection: null`, which means *not known*.
 */
export type ConnectionState = 'CONNECTED' | 'NOT_CONNECTED' | 'REAUTH_REQUIRED' | 'ERROR';

export type ShopRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly channelType: ChannelTypeCode;
  readonly channelTypeLabel: string;
  readonly configuration: ConfigurationState;
  /** 🔴 `null` = Integration could not be read. NEVER read as `NOT_CONNECTED`. */
  readonly connection: ConnectionState | null;
  readonly externalLink: string | null;
  readonly bound: boolean;
};

export type Figure = { readonly key: string; readonly label: string; readonly count: number };

export type ShopSummary = {
  readonly allShops: {
    readonly channelTypeCount: number;
    readonly shopCount: number;
    readonly configurationSplit: readonly Figure[];
  };
  readonly channelTypes: readonly {
    readonly channelType: ChannelTypeCode;
    readonly label: string;
    readonly shopCount: number;
    /** 🔴 `SCS-021` — connection-derived. `null` when Integration was unreadable. */
    readonly attentionCount: number | null;
    readonly connectionSplit: readonly Figure[];
  }[];
  readonly connectionKnown: boolean;
};

export type ShopFilters = {
  readonly search?: string;
  readonly channelType?: ChannelTypeCode;
  readonly connection?: ConnectionState;
  readonly configuration?: ConfigurationState;
};

export type ShopPage = {
  readonly content: readonly ShopRow[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  /** `SCS-023.c` — the unfiltered corpus, so "Showing N of M" can be honest. */
  readonly totalRegistered: number;
};

export type ChannelTypeOption = { readonly code: ChannelTypeCode; readonly label: string };

/**
 * `INV-16.7` — the CLOSED, ERP-supplied Market set. Ratified 2026-08-15.
 *
 * <p>🔴 One member today, and that is the ratified set rather than a placeholder. A second
 * arrives by canonical amendment, never by a frontend edit.
 */
export type MarketCode = 'BANGLADESH';

export type MarketOption = { readonly code: MarketCode; readonly label: string };

/**
 * `SCS-040` — one shop in full.
 *
 * <p>🔴 `connectionKnown` distinguishes *the condition is X* from *Trioloo does not know it*.
 * A surface that read absence as `NOT_CONNECTED` would make a different and false claim.
 */
export type ShopDetail = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly channelType: ChannelTypeCode;
  readonly channelTypeLabel: string;
  readonly market: MarketCode | null;
  /** ⚠ What the surface renders. 🔴 `null` where no market was ever recorded. */
  readonly marketLabel: string | null;
  readonly configuration: ConfigurationState;
  readonly connectionKnown: boolean;
  readonly connection: ConnectionState | null;
  readonly connectionLastCheckedAt: string | null;
  /** 🔴 `SCS-041` — the binding identity. Never the link, never collapsed with it. */
  readonly externalAccountIdentity: string | null;
  readonly externalLink: string | null;
  readonly boundAt: string | null;
  readonly authorisedAt: string | null;
  readonly activatedAt: string | null;
  readonly activatedByName: string | null;
  readonly channelTypeChangeable: boolean;
  readonly marketChangeable: boolean;
  /** 🔴 A STATE fact. `SCS-050.b` keeps it separate from the permission decision. */
  readonly activatable: boolean;
  readonly activationBlockedReason: string | null;
  /** 🔴 `SCS-092.d` — membership of the recognised set implies no adapter. */
  readonly authorisationSupported: boolean;
  readonly authorisationUnsupportedReason: string | null;
};

/** The three operator inputs — 🔴 and nowhere to put anything else (`SCS-030.a`). */
export type ShopInput = {
  readonly name: string;
  readonly channelType: string;
  readonly market: string;
};

export async function fetchShop(id: string): Promise<ShopDetail> {
  return apiRequest<ShopDetail>(`/api/system/shops/${id}`);
}

/** 🔴 Registers a LOCAL record. It neither creates nor contacts the remote account. */
export async function createShop(input: ShopInput): Promise<string> {
  const created = await apiRequest<{ id: string }>('/api/system/shops', { method: 'POST', body: input });
  return created.id;
}

export async function updateShop(id: string, input: ShopInput): Promise<string> {
  await apiRequest<void>(`/api/system/shops/${id}`, { method: 'PUT', body: input });
  return id;
}

/**
 * `SCS-051` — `DRAFT → ACTIVE`.
 *
 * <p>🔴 A different capability from manage, and a different endpoint. The backend enforces
 * `system.channel-instance.lifecycle` regardless of what any surface renders.
 */
export async function activateShop(id: string): Promise<void> {
  await apiRequest<void>(`/api/system/shops/${id}/activate`, { method: 'POST' });
}

/** `SCS-044` — what an authorisation did. 🔴 A business outcome; never a provider payload. */
/**
 * What STARTING authorisation returns.
 *
 * 🔴 The destination and nothing else. Authorisation finishes on the provider's callback, not on
 * this response — the endpoint used to return an outcome only because the old backend contract
 * pretended a redirect flow completed synchronously.
 */
export type AuthorisationInitiation = {
  readonly authorizationUrl: string;
};

/**
 * What the authorisation TURNED OUT to be.
 *
 * ⚠ It now arrives on the callback redirect as query parameters, not as a response body.
 */
export type AuthorisationResult = {
  readonly outcome: 'AUTHORISED' | 'DIFFERENT_ACCOUNT' | 'CLAIMED_BY_ANOTHER_SHOP' | 'NOT_COMPLETED';
  readonly firstBinding: boolean;
  readonly boundAccount?: string;
  readonly attemptedAccount?: string;
};

/**
 * Connect and Reauthorize — 🔴 INTEGRATION'S endpoint, not System's (`API-069`,
 * `PRM-090.b`). The path names its owner deliberately.
 */
export async function authoriseShop(id: string): Promise<AuthorisationInitiation> {
  return apiRequest<AuthorisationInitiation>(`/api/integration/channel-connections/${id}/authorize`, {
    method: 'POST',
  });
}

function query(filters: ShopFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.channelType) params.set('channelType', filters.channelType);
  if (filters.connection) params.set('connection', filters.connection);
  if (filters.configuration) params.set('configuration', filters.configuration);
  return params.toString();
}

export async function listShops(filters: ShopFilters): Promise<ShopPage> {
  const q = query(filters);
  return apiRequest<ShopPage>(`/api/system/shops${q ? `?${q}` : ''}`);
}

export async function fetchShopSummary(filters: ShopFilters): Promise<ShopSummary> {
  const q = query(filters);
  return apiRequest<ShopSummary>(`/api/system/shops/summary${q ? `?${q}` : ''}`);
}

/**
 * 🔴 `SCS-030.b` — the selector's options come FROM THE SERVER. The browser never holds its
 * own copy of the closed set, so a surface can never offer a value the backend rejects and
 * free text has nowhere to enter.
 */
export async function fetchChannelTypeOptions(): Promise<readonly ChannelTypeOption[]> {
  return apiRequest<readonly ChannelTypeOption[]>('/api/system/shops/channel-types');
}

/**
 * 🔴 `INV-16.7` — the Market options come FROM THE SERVER, exactly as the channel types do.
 * The browser holds no copy of the closed set, so free text has nowhere to enter and the
 * form can never offer a value the backend would reject.
 */
export async function fetchMarketOptions(): Promise<readonly MarketOption[]> {
  return apiRequest<readonly MarketOption[]>('/api/system/shops/markets');
}
