# Daraz Provider Contract — implementation reference

**Owner:** Trioloo Integration · **Module:** Integration · **Status:** ✅ **IMPLEMENTATION-READY TECHNICAL REFERENCE** · ⚠ **NOT CANONICAL ARCHITECTURE**
**Version:** 1.13.0 · **Established:** 2026-08-17 · **Amended:** 2026-08-23 (`DZC-057` — the confirmed `/orders/get` read; `limit` accepted so `DZC-050.d` is SETTLED, `_trace_id_` widened to a general envelope field, and the documented order field set confirmed as a CEILING) · **Amended:** 2026-08-23 (`DZC-051`–`DZC-056` — §13 the ORDER NOTIFICATION protocol; a webhook exists and CANNOT replace the read, so periodic reconciliation remains necessary) · **Amended:** 2026-08-23 (`DZC-043`–`DZC-050` — §12 the ORDER READ protocol, rendered from the Daraz reference; nothing implemented, no seller API called) · **Amended:** 2026-08-21 (`DZC-042` — live probe accepted; `DZC-035.e` amended: `code` 0 is success with no `data`) · **Amended:** 2026-08-21 (`DZC-041` — the controlled same-value probe, built and NOT run) · **Amended:** 2026-08-21 (`DZC-033`–`DZC-040` — §11 listing WRITE protocol recorded from the official reference; nothing implemented) · **Amended:** 2026-08-19 (`DZC-032` — §10 product review protocol recorded from the official reference) · **Amended:** 2026-08-18 (`DZC-031.h` — bounded generic attributes) · **Amended:** 2026-08-18 (`DZC-031` — reported stock source) · **Amended:** 2026-08-18 (§9 clarified from first implementation) · **Amended:** 2026-08-18 (§9 — listing read, `DZC-020`–`DZC-030`) · **Amended:** 2026-08-17 (`DZC-010` local-seller branch) · **Source:** Daraz / Lazada Open Platform official documentation, plus one live production observation

> ⚠ **THIS DOCUMENT LEGISLATES NOTHING.** It records **third-party protocol facts** read from the provider's own
> documentation so that implementation does not guess them. Business rules remain with their owning canonical
> documents (`API-068`–`API-071`, `INV-16.5`–`INV-16.16`, `TEC-119`, `TEC-120`).
>
> 🔴 **IT DOES NOT CLOSE `GAP-133`.** Knowing the protocol is not implementing it.
>
> 🔴 **NO SECRET APPEARS HERE** — no App Key, App Secret, access token, refresh token, authorization code or
> seller credential. Only variable NAMES and protocol shapes.

---

## 1. Why this file exists

**Gate B stopped once before** because the protocol could not be read: the official documentation is a
JavaScript-rendered single-page application, and a plain fetch returns an empty shell. ⚠ **That is a rendering
problem, not an authentication one** — the pages are public and readable in a real browser without signing in.
✅ **Everything below was read from the provider's own rendered documentation**, never from a blog, an SDK, a
tutorial or recollection.

---

## 2. Service addresses

> **`DZC-001` — ✅ HOSTS ARE PER-COUNTRY. Bangladesh is `api.daraz.com.bd`.**

| Purpose | Bangladesh address |
|---|---|
| **Seller authorization** | `https://api.daraz.com.bd/oauth/authorize` |
| **REST gateway** (signed API calls) | `https://api.daraz.com.bd/rest` |

✅ **BOTH HOSTS ARE DOCUMENTED PER COUNTRY, EXPLICITLY.**

- **Authorization**, from the seller-authorization guide: PK `api.daraz.pk`, **BD `api.daraz.com.bd`**,
  LK `api.daraz.lk`, NP `api.daraz.com.np`, MM `api.shop.com.mm`.
- **REST gateway**, from the Service Endpoints table published on each API page (confirmed 2026-08-17 on
  `/seller/get`): **BD `https://api.daraz.com.bd/rest`**, PK `https://api.daraz.pk/rest`,
  LK `https://api.daraz.lk/rest`, NP `https://api.daraz.com.np/rest`, MM `https://api.shop.com.mm/rest`.

⚠ **THIS SUPERSEDES v1.0.0, WHICH RECORDED THE REST BASE AS PATTERN-INFERRED AND PENDING CONFIRMATION.** ✅ **It is
now read directly from a per-region endpoint table and needs no further confirmation.**

⚠ **THE TOKEN-API HOST IS THE ONE POINT WHERE OFFICIAL SOURCES DISAGREE, AND IT IS FLAGGED RATHER THAN GUESSED.**
**`/auth/token/create` and `/auth/token/refresh` are listed as ordinary System-category REST APIs, which implies
the regional base `https://api.daraz.com.bd/rest`.** ⚠ **BUT the authorization guide's own Java sample constructs
the client with the GENERIC `https://api.daraz.com/rest` for exactly these two calls.**

> ✅ **DECISION: use the Bangladesh regional base `https://api.daraz.com.bd/rest` for the token APIs**, because it
> is the base published in the per-API Service Endpoints table and it matches the venture the authorization was
> performed against. 🔴 **THIS IS THE ONE HOST FACT TO VERIFY AT THE FIRST LIVE TOKEN EXCHANGE.** ⚠ **The failure
> is unambiguous and harmless if wrong — the call is rejected, no shop is bound — so it fails safe.**

⚠ **The `oauth/authorize` host is a BROWSER destination for the seller, not a REST base.** **Here it is the same
hostname, but only the authorize URL is ever opened in a browser.**

⚠ **Some SDK samples use `https://api.daraz.com/rest`, which is NOT the Bangladesh venture host.** 🔴 **Do not
copy it out of the sample code.**

---

## 3. Authorization — OAuth 2.0 "code for token"

> **`DZC-002` — ✅ THE SELLER AUTHORIZES IN THEIR OWN BROWSER; THE ERP NEVER SEES SELLER CREDENTIALS.**

```
https://api.daraz.com.bd/oauth/authorize
    ?response_type=code
    &force_auth=true
    &redirect_uri=<the registered callback URL>
    &client_id=<App Key>
    &state=<opaque value>
```

| Parameter | Required | Meaning |
|---|---|---|
| `client_id` | **Yes** | The App Key |
| `redirect_uri` | **Yes** | 🔴 **Must be IDENTICAL to the callback URL registered on the App Console** |
| `response_type` | **Yes** | `code` |
| `force_auth` | No | Forces a fresh authorization session rather than reusing a browser cookie |
| **`state`** | No | ✅ **"Customizable… the same for input and response"** — it round-trips |
| `uuid` | No | Provider-side identity that protects the returned code |
| `country` | No | Restricts the country selector |

> **`DZC-003` — ✅ `state` ROUND-TRIPS, WHICH IS WHAT `TEC-120` DEPENDS ON.** ⚠ **This was the one protocol fact
> that could have invalidated the ratified correlation design**: the V14 attempt store issues a nonce, persists only
> its SHA-256, and resolves the Channel Instance from the returned `state`. **The provider echoes it back
> unchanged, so the design holds.** 🔴 **`state` is OPTIONAL to Daraz but MANDATORY here** — without it the
> callback carries nothing that identifies which shop was being authorised.

> **`DZC-004` — ⚠ THE AUTHORIZATION CODE EXPIRES IN 30 MINUTES** and is single-use in practice. **The
> `channel_authorisation_attempt` TTL must therefore be well under 30 minutes.**

---

## 4. Token exchange and refresh

| Operation | API name | Key parameter |
|---|---|---|
| **Create** | **`/auth/token/create`** | `code` |
| **Refresh** | **`/auth/token/refresh`** | `refresh_token` |

Both are listed under the **System** category of the API reference.

**Response shape** (field names only; values here are the provider's own illustrative sample, not real):

```
access_token, refresh_token, expires_in, refresh_expires_in,
account, account_platform, country,
country_user_info[] : { country, seller_id, user_id }
```

> **`DZC-005` — ✅ THE TWO LIFETIMES ARE INDEPENDENT, AND REFRESH TREATS THEM DIFFERENTLY.**
> **`expires_in` and `refresh_expires_in` are separate durations in SECONDS.** ✅ **On refresh, a NEW
> `access_token` AND a NEW `refresh_token` are returned, the access duration RESETS, and 🔴 the refresh duration
> does NOT.** **When the refresh token finally expires the seller must authorise again.**
> ⚠ **`refresh_expires_in = 0` MEANS THE TOKEN CANNOT BE REFRESHED AT ALL** — it is not "no expiry".
> ✅ The provider recommends refreshing ~30 minutes before expiry.

> **`DZC-006` — 🔴 THIS IS WHY THE DARAZ ADAPTER IS STRICTER THAN THE DATABASE.** **`channel_credential` permits a
> NULL expiry because it is provider-neutral (`TEC-119.g`). Daraz always supplies both durations, so the adapter
> MUST REJECT a token response missing either** and convert both to absolute instants via the business `Clock`.

---

## 5. Request signing

> **`DZC-007` — ✅ HMAC-SHA256 OVER A CANONICAL STRING THAT BEGINS WITH THE API NAME.**

1. **Sort** all request parameters — system and business — by parameter name in **ASCII order**,
   🔴 **excluding `sign` itself and any byte-array parameters**.
2. **Concatenate** each `key` immediately followed by its `value`, with **no separators**:
   `bar2foo1foo_bar3foobar4`.
3. **Prepend the API name**: `/test/apibar2foo1foo_bar3foobar4`.
4. **Append the request body** at the end, where there is one.
5. **HMAC-SHA256** of the UTF-8 bytes, keyed with the **App Secret**.
6. **Uppercase hexadecimal** digest.

⚠ **Step 3 is the step most easily missed** — the API name is part of the signed material, not merely the URL
path. **A signer that omits it produces a well-formed signature that the gateway always rejects.**

**Common parameters** carried on every signed call: `app_key`, `timestamp`, `sign_method`, `sign`, and
`access_token` for seller-scoped APIs.

> **`DZC-008` — ⚠ `sign_method` SELECTS THE ALGORITHM, AND THE TWO ARE NOT INTERCHANGEABLE.** **The official
> sample code branches on it: `sha256` → HMAC-SHA256, while the legacy `hmac` branch is a different digest.**
> **The narrative documentation specifies HMAC-SHA256, and the API Explorer's older worked example shows a
> 32-hex-character `sign` — which is NOT the 64 characters HMAC-SHA256 produces, i.e. that example is the legacy
> branch.** ✅ **RESOLVED: SEND `sign_method=sha256`.** **The Common Parameters table describes `sign_method` as “the HMAC hash algorithm you are using to calculate your signature”, the narrative specifies HMAC_SHA256, and the official sample code branches `SIGN_METHOD_SHA256` → HMAC-SHA256.** ⚠ **The 32-hex example is the legacy `hmac` branch and must not be copied.**

> **`DZC-009` — ✅ `timestamp` IS EPOCH MILLISECONDS, 13 DIGITS, AND THE SKEW WINDOW IS ±7200 SECONDS.** **Every API page's Common Parameters table states it: “with less than 7200s difference from UTC time”.** ⚠ **The comparison is against UTC, so a host with a drifting or mis-zoned clock fails every call with a signature-shaped error that looks nothing like a clock problem.**

---

## 6. Seller identity — RESOLVED 2026-08-17, AMENDED 2026-08-17 (local sellers)

> **`DZC-010` — 🔴 THE BINDING IDENTITY IS THE TOKEN RESPONSE'S BANGLADESH `seller_id`, NOT
> `/seller/get`.**

**`GET /seller/get` exists** (System category, *Get seller information by current seller ID*), served for
Bangladesh from `https://api.daraz.com.bd/rest`. 🔴 **BUT ITS RESPONSE SCHEMA IS NOT PUBLISHED.** **The
API reference lists its Response Parameters as exactly one row — `data | Object | Response data` — with
no field names at all, and its Error code table reads “No Data”.**

⚠ **BINDING TO AN UNPUBLISHED FIELD WOULD BE A GUESS ON THE ONE FACT `INV-16.6` TESTS EVERY REAUTHORISATION
AGAINST.** **A wrong choice does not fail loudly — it silently binds a shop to the wrong seller, or rejects a
legitimate reconnection forever.** **Discovering the schema by calling the API live was deliberately NOT done: it
needs a real seller token, which this gate forbids.**

✅ **THE TOKEN RESPONSE IS FULLY DOCUMENTED, AND IT IS A REMOTE API RESPONSE — NOT A PARSED TOKEN
STRING.** **`/auth/token/create` returns `country_user_info[]`, each entry carrying `country`, `seller_id` and
`user_id`, where the official authorization documentation defines `seller_id` as the seller ID of the store for
the corresponding country, and `user_id` as the authorized account ID for that country.**

> **DECISION — `external_account_identity` = the `seller_id` of the `country_user_info` entry whose
> `country` is Bangladesh.**
>
> **a.** ✅ **It is officially documented WITH A STATED SEMANTIC**, which nothing `/seller/get` publishes is.
> **b.** ✅ **It identifies the STORE**, which is exactly what `E-016` is — one Channel Instance is one
> external operating account (`INV-16.11`).
> **c.** 🔴 **`account` (an email) AND ANY DISPLAY NAME ARE REJECTED.** ⚠ **An email is a login that
> can be changed and can own several stores; a display name is operator text.** **Neither is a durable store
> identifier** (`INV-16.5`, `INV-16.14`).
> **d.** ✅ **It is remote-derived and cannot be forged locally**, satisfying the rule that binding identity
> comes only from the provider.
> **e.** ⚠ **A CROSS-BORDER TOKEN MAY RETURN SEVERAL `country_user_info` ENTRIES.** 🔴 **The
> Bangladesh entry must be selected EXPLICITLY — taking the first entry would bind a Bangladesh shop to
> another venture's store.** ✅ **If no Bangladesh entry is present, the authorisation is REFUSED rather than
> bound to whatever happened to be returned.**
>
> ⚠ **ONE ITEM LEFT OPEN, AND IT IS CHEAP TO CLOSE:** **whether `/seller/get` returns the same identifier is
> unverified.** ✅ **At the first real authorisation its response should be captured once and compared** —
> **if it agrees, `/seller/get` becomes a useful liveness probe. It does not become the identity.**

### 6.1 — The local Bangladesh seller branch (amended 2026-08-17)

> **`DZC-010` (amended) — 🔴 A LOCAL BANGLADESH SELLER RETURNS NO `country_user_info` AT ALL.
> ITS IDENTITY IS `user_info.seller_id`, GUARDED BY THE TOP-LEVEL `country`.**

⚠ **THE ORIGINAL RULE WAS WRITTEN FROM DOCUMENTATION THAT DESCRIBES ONLY ONE OF TWO REAL SHAPES.**
**`country_user_info[]` is what a CROSS-BORDER seller receives — one entry per venture. The provider's
documentation never mentions the other shape, and the implementation therefore refused every local
Bangladesh seller with `MISSING_COUNTRY_USER_INFO`.** 🔴 **The refusal was CORRECT: it declined to
guess, and it bound nothing. The contract, not the code, was incomplete.**

**Live evidence — one real Bangladesh seller, production, 2026-08-17. FIELD NAMES ONLY; no value from the
response is recorded here or anywhere in this document:**

| Observation | Value |
|---|---|
| **Top-level field names** | `access_token`, `country`, `refresh_token`, `user_info`, `account_platform`, `refresh_expires_in`, `expires_in`, `account`, `code`, `request_id`, `_trace_id_` |
| **`country_user_info`** | 🔴 **`ABSENT`** |
| **`user_info`** | `OBJECT` carrying `country`, `user_id`, `seller_id`, `short_code` |
| **`data`** | `ABSENT` — the payload is flat, not wrapped |

> **DECISION — `external_account_identity` is resolved in this order, and any failed condition REFUSES:**
>
> **1.** ✅ **`country_user_info` present and non-empty → UNCHANGED.** **The entry whose `country` is
> Bangladesh is selected explicitly, and its `seller_id` is the identity.** 🔴 **A populated array with no
> Bangladesh entry still REFUSES — it is not rescued by `user_info`.** ⚠ **Otherwise a cross-border token
> could be silently redirected to a different account than the one the array names.**
> **2.** ⚠ **Otherwise the top-level `country` MUST be Bangladesh.** 🔴 **THIS IS THE VENTURE GUARD, AND
> IT IS NOT OPTIONAL.** **On the documented path each entry names its own country, so Bangladesh can be
> picked out of several. Here the response names exactly ONE account and nothing inside `user_info`
> identifies its venture — the top-level field is the only thing standing between a Bangladesh shop and a
> seller from another venture.** **Absent is refused, not assumed.**
> **3.** ⚠ **Then `user_info` MUST be an object.** **A scalar, array or null cannot carry a store identity.**
> **4.** ⚠ **Then `user_info.seller_id` MUST be present and non-blank.**
> **5.** ✅ **That `seller_id` is `external_account_identity`.**
> **6.** 🔴 **ANY FAILED CONDITION REFUSES AND STORES NOTHING** — no credential, no binding, no
> connection. **The state is still consumed, so a refusal is not replayable.**
>
> 🔴 **THE REJECTIONS OF `DZC-010` ARE PRESERVED IN FULL AND EXTENDED TO THIS BRANCH:**
>
> **a.** 🔴 **`account` (an email) IS NEVER THE IDENTITY.** ⚠ **An email is a LOGIN that can be changed
> and can own several stores** (`INV-16.5`, `INV-16.14`). **It is present in the live local response and is
> deliberately ignored.**
> **b.** 🔴 **`user_id` IS NEVER THE IDENTITY.** ⚠ **The provider's own authorization documentation
> defines it as the authorized ACCOUNT id, not the store** — the same distinction that makes `seller_id`
> the right field on the documented path.
> **c.** 🔴 **`short_code` IS NEVER THE IDENTITY.** ⚠ **It is a display handle, and nothing published
> states that it is durable or unique.**
> **d.** 🔴 **`country`, `account_platform`, `code`, `request_id` and `_trace_id_` ARE NEVER THE
> IDENTITY.** **The first two describe the venture and platform; the last three describe THIS CALL and differ
> on every request.**
>
> ✅ **WHY `user_info.seller_id` IS SOUND AND NOT A GUESS:** **`seller_id` is the same field name, in the
> same protocol, that the official authorization documentation defines as *the seller ID of the store*. The
> local shape is not a different vocabulary — it is the same field without the per-venture wrapper, which is
> consistent with an account that belongs to exactly one venture.** 🔴 **It is remote-derived and cannot be
> forged locally**, satisfying the rule that binding identity comes only from the provider.
>
> ⚠ **`/seller/get` REMAINS UNUSED AND UNVERIFIED.** **Its response schema is still unpublished, and this
> amendment does not need it.** ✅ **The open item from §6 stands: capture it once and compare.**

## 7. Response envelope

```
{ "data": …, "code": "0", "request_id": "0be6fdce15200450346451004" }
```

✅ **`code: "0"` is success.** ⚠ **A non-zero `code` arrives with HTTP 200**, so transport status alone never
indicates success.

> **`DZC-011` — 🔴 DARAZ PUBLISHES NO ERROR CODES FOR THE AUTH APIS, SO THE MAPPING IS DRIVEN BY
> DOCUMENTED TIME FACTS AND DEFAULTS TO `ERROR`.**
>
> **The API reference's Error code table is EMPTY (“No Data”) for `/seller/get`, `/auth/token/create`
> and `/auth/token/refresh`.** ⚠ **There is therefore no published code meaning “the seller must
> authorise again”.**
>
> ✅ **WHAT IS DOCUMENTED IS DECISIVE ENOUGH, AND IT IS TIME-BASED:**
>
> | Provider condition | Official discriminator | Trioloo action |
> |---|---|---|
> | **`refresh_expires_in = 0`** | ✅ Documented: *the access token cannot be refreshed* | **`REAUTH_REQUIRED`** |
> | **Refresh token expired** | ✅ Documented: *after the refresh token expires, sellers need to re-authorize your application* | **`REAUTH_REQUIRED`** |
> | **Access token expired, refresh still usable** | `expires_in` elapsed while `refresh_token_expires_at` is future | 🔴 **NOT reauth — REFRESH and stay `CONNECTED`** |
> | **Refresh rejected because the CREDENTIAL is invalid / expired / revoked** | provider evidence identifies the refresh credential itself as unusable | **`REAUTH_REQUIRED`** — the only recovery path is genuinely gone |
> | **Refresh call fails for any OTHER reason** | non-zero `code` that does not identify the credential as unusable | 🔴 **`ERROR`** — see the correction below |
> | **Bad signature · bad `app_key` · timestamp outside ±7200s** | non-zero `code` | 🔴 **`ERROR`** — these are OUR defects; telling an operator to disturb a seller would be a lie |
> | **Rate limit · provider internal · transport failure** | non-zero `code`, or no response at all | **`ERROR`** |
> | **Any unrecognised failure** | — | **`ERROR`** (default) |
>
> 🔴 **CORRECTION, 2026-08-17 — v1.1.0 WAS TOO BROAD HERE.** **It said any non-zero response from
> `/auth/token/refresh` meant `REAUTH_REQUIRED`.** ⚠ **That is wrong: a rate-limited, mis-signed, clock-skewed or
> internally-failing refresh call would then tell an operator to go and disturb a seller whose authorisation is
> perfectly healthy.** 🔴 **THE ENDPOINT INVOLVED PROVES NOTHING. Only evidence about the CREDENTIAL does.**
>
> 🔴 **THE DEFAULT IS `ERROR`, NEVER `REAUTH_REQUIRED`.** ⚠ **`REAUTH_REQUIRED` sends an operator to
> disturb a seller, so it is reached ONLY on a documented condition and is never inferred from an unrecognised
> code.**
>
> ⚠ **THE RUNTIME CODE TABLE MUST BE LEARNED AT FIRST LIVE INTEGRATION** and folded back here. **Rate-limit
> semantics are likewise unpublished.**

## 9. Listing read — the product APIs

> 🔴 **THIS SECTION EXISTS SO THE ADAPTER GATE NEVER GUESSES A RESPONSE SHAPE.** ⚠ **The connection gate
> was delayed by exactly one unguessable fact — a local seller returns `user_info`, not `country_user_info`
> (§6.1). Everything below is recorded from official documentation BEFORE any adapter code exists.**

### 9.1 The endpoints

> **`DZC-020` — ✅ THE LISTING READ IS `/products/get`, AND IT IS THE `GetProducts` OF THE LEGACY API.**
>
> **Daraz's own migration guide maps the legacy Seller Center method `GetProducts` to the REST path
> `/products/get`.** ✅ **That mapping is a DARAZ-published source, and it is what ties the Lazada-hosted
> reference below to this venture** — **the same shared-platform relationship §5 already relies on for the
> signature algorithm.**
>
> **a.** ✅ **HTTP method: `GET`.** **The official sample sets `request.setHttpMethod("GET")`.**
> **b.** ✅ **Base: the Bangladesh regional gateway `https://api.daraz.com.bd/rest`** (`DZC-001`), **signed
> exactly as `DZC-008` specifies.** ⚠ **The reference page's own Service Endpoints table lists Lazada regions
> only and does NOT list Bangladesh; `DZC-001` already decided the Daraz regional base and is unchanged.**
> **c.** ✅ **Authorisation required. Common parameters are `app_key`, `timestamp`, `access_token`,
> `sign_method`, `sign`** — **the same five §5 documents, with `access_token` now REQUIRED.**

> **`DZC-021` — ✅ THE SINGLE-LISTING READ IS `/product/item/get`, AND IT IS A `POST`.**
>
> **Documented as *"Get single product by ItemId or SellerSku."***
>
> **a.** 🔴 **`item_id` (Number) is REQUIRED.** **The reference states plainly that Item Id must be selected
> as the request parameter.**
> **b.** 🔴 **`seller_sku` IS DEPRECATED and unsupported after 15 November 2023.** ⚠ **It must not be used
> as a lookup key.**
> **c.** 🔴 **THE METHOD IS `POST`, NOT `GET`, AND THAT IS AN IMPLEMENTATION CONSTRAINT TODAY.**
> **`DarazTransport` currently exposes `String get(URI)` and nothing else.** ✅ **`DarazRequestSigner` already
> accepts a body argument, so signing is ready; the TRANSPORT is what must gain a POST before `readListing`
> can use this endpoint.**

### 9.2 `/products/get` parameters

> **`DZC-022` — ✅ EVERY BUSINESS PARAMETER IS OPTIONAL, AND THE REFERENCE CONTRADICTS ITSELF ON ONE.**

| Parameter | Type | Required | Documented meaning |
|---|---|---|---|
| **`filter`** | String | **No** — ⚠ **but its own description ends "Mandatory."** | Status filter. Values: `all`, `live`, `inactive`, `deleted`, `pending`, `rejected`, `sold-out` |
| `create_after` / `create_before` | String | No | ISO 8601 creation-date bounds |
| `update_after` / `update_before` | String | No | ISO 8601 update-date bounds |
| `limit` | String | No | Page size. 🔴 **Maximum 50** |
| `offset` | String | No | 🔴 **DEPRECATED.** *"It is recommended to use date for scrolling query."* 🔴 **Maximum offset 10000.** ⚠ **NOT USED by the implementation** |
| `options` | String | No | `options=1` adds `ReservedStock`, `RtsStock`, `PendingStock`, `RealTimeStock`, `FulfillmentBySellable` |
| `sku_seller_list` | String | No | ⚠ **Description field is EMPTY in the reference — NOT PUBLISHED** |

> **a.** ⚠ **THE `filter` CONFLICT IS RECORDED, NOT RESOLVED.** **The Required column says No; the description
> says Mandatory.** ✅ **`DZC-025` sends it explicitly regardless, so the contradiction cannot bite.**
> **b.** 🔴 **`offset` IS DEPRECATED AND CAPPED AT 10000 — A SELLER WITH MORE LISTINGS CANNOT BE PAGED BY
> OFFSET AT ALL.** ✅ **Date scrolling on `create_after`/`update_after` is the documented replacement and is
> what `DiscoveryPage.nextCursor` must carry.**

### 9.3 Response envelope and shape

> **`DZC-023` — ✅ THE ENVELOPE IS §7'S, WITH THE PAYLOAD UNDER `data`.**
>
> **`{ "code": "0", "data": { "total_products": Number, "products": [ … ] }, "request_id": "…" }`**
>
> **a.** ✅ **`code` `"0"` is success**, per `DZC-007`; any non-zero is a refusal.
> **b.** ✅ **`total_products` is documented as ITEM level, not SKU level.**
> **c.** ✅ **`request_id` is present and is safe to log** (`DZC-011`).

**Product object — documented fields:** `item_id` · `primary_category` · `attributes` (Object) · `skus`
(Object[]) · `created_time` · `updated_time` · `images` · `marketImages` · `status` · `subStatus` ·
`hiddenStatus` · `hiddenReason` · `suspendedSkus` · `trialProduct` · `rejectReason[]`.

**SKU object — documented fields:** `SkuId` · `SellerSku` · `ShopSku` · `Status` · `quantity` · `Available`
· `price` · `special_price` · `special_from_time` · `special_to_time` · `special_to_date` · `Images[]` ·
`Url` · `package_width` / `package_height` / `package_length` / `package_weight` · `product_weight`.

**`attributes` object — fields seen in the official sample:** `name` · `description` · `short_description` ·
`brand` · `warranty_type` · `gift_wrapping` · `name_engravement` · `preorder` · `preorder_days`.
⚠ **THE ATTRIBUTE SET IS CATEGORY-DEPENDENT AND IS NOT AN EXHAUSTIVE PUBLISHED LIST.**

> **`DZC-024` — ⚠ FOUR SHAPE FACTS ARE NOT PUBLISHED AND MUST NOT BE ASSUMED.**
>
> **a.** ⚠ **`price` and `special_price` carry NO published currency, scale or type.** **The sample shows bare
> JSON numbers (`32`, `9`).** 🔴 **They are read as text and converted with exact decimal semantics; they are
> never parsed into a binary float** (`DB-037`, `TEC-010`).
> **b.** ⚠ **`images` and `marketImages` appear in the sample as a STRING containing a JSON array, while the
> SKU-level `Images` is a real array.** 🔴 **NOT PUBLISHED which is authoritative; an implementation must
> tolerate both and report `readable=false` when it can parse neither.**
> **c.** ⚠ **`created_time` / `updated_time` appear as epoch-millisecond STRINGS; `special_from_time` /
> `special_to_time` appear as `"2015-07-3100:00"`, which is not a documented format.** 🔴 **NOT PUBLISHED.**
> **d.** ⚠ **`status` and `subStatus` appear in the sample as COMMA-JOINED VALUE LISTS
> (`"Active,InActive,Pending QC,Suspended,Deleted"`), which is documentation shorthand for the possible
> values rather than a real field value.** 🔴 **The true per-product value is NOT PUBLISHED.**

### 9.4 Errors and limits

> **`DZC-025` — ✅ THE PUBLISHED ERROR CODES FOR `/products/get`.**

| Code | Meaning |
|---|---|
| `5` / `6` | Invalid request format · unexpected internal error |
| `14` / `17` / `19` | Invalid offset · invalid date format · invalid limit (≤ 50) |
| `36` | Invalid status filter |
| `70` | Corrupt data in the SKU seller list |
| `506` | Get product failed |
| `901` | 🔴 **Rate limited — "API level QPS limiting flow, please retry in the next second"** |
| `SellerNotVerified` | The seller's store-opening process is incomplete |

> **a.** 🔴 **`901` IS THE ONLY PUBLISHED RATE-LIMIT SIGNAL, AND IT IS PER-SECOND QPS.** ✅ **It maps to
> `ERROR`, never `REAUTH_REQUIRED`** (`DZC-011`) — **a throttle says nothing about the credential.**
> **b.** ⚠ **No published quota, daily cap or burst allowance. NOT PUBLISHED.**

### 9.5 Mapping to `ReportedListingSnapshot`

> **`DZC-026` — ✅ THE COMPLETE FIELD MAPPING. 🔴 EVERY MEMBER IS EITHER SOURCED OR EXPLICITLY
> `readable=false`; NONE IS INFERRED.**

| `ReportedListingSnapshot` | Daraz source | Rule |
|---|---|---|
| `externalListingId` | `item_id` | ✅ The product identifier `DZC-021` also looks up by |
| `title` / `titleReadable` | `attributes.name` | ✅ Readable when present |
| `description` / `descriptionReadable` | `attributes.description` | ✅ Readable when present. ⚠ `short_description` is a DIFFERENT field and is not substituted |
| `salePrice` / `salePriceReadable` | SKU `price` | ⚠ **SKU-level only — there is NO product-level price.** For a single-SKU product it is that SKU's `price`; 🔴 for a multi-SKU product `readable=false` at listing level, because no published rule says which SKU speaks for the listing |
| `promotionPrice` / `promotionPriceReadable` | SKU `special_price` | Same single-SKU rule |
| `promotionStartsAt` / `promotionEndsAt` / `promotionWindowReadable` | SKU `special_from_time` / `special_to_time` | 🔴 **`readable=false` unless the value parses** — the format is NOT PUBLISHED (`DZC-024.c`) |
| `stock` / `stockReadable` | SKU `quantity` | ⚠ `Available` is a DIFFERENT field and is not substituted. 🔴 Inventory CONTAINERS are not mapped — see `DZC-031` |
| `channelCategory` / `channelCategoryReadable` | `primary_category` | ⚠ **A numeric ID, not a name.** 🔴 No category-name lookup is in scope; the ID is reported as given |
| `listingStatus` | `status` | 🔴 **`readable` semantics do not apply — it is an enum.** ⚠ Per `DZC-024.d` the true value set is NOT PUBLISHED, so any unrecognised value maps to NO status change rather than a guess |
| `attributes` | `attributes` object | ✅ Reported as name→value text, MINUS `name` and `description`, which have dedicated columns. ⚠ Category-dependent; never validated against an invented schema. 🔴 Bounded by Trioloo persistence — see `DZC-031.h` |
| `mediaReferences` | `images`, else `marketImages` | ✅ Per `DZC-024.b`, tolerate array-or-string; empty when neither parses |
| `skus[]` | `skus[]` | See below |

| `ReportedSkuSnapshot` | Daraz source | Rule |
|---|---|---|
| `channelSku` | **`SellerSku`** | ✅ The seller's own SKU code, which is what `E-106` means by a channel SKU. ⚠ **`ShopSku` and `SkuId` are marketplace-side identifiers and are NOT the channel SKU** |
| `salePrice` / `promotionPrice` / window | `price` / `special_price` / `special_from_time` / `special_to_time` | As above, with `readable=false` on unparseable dates |
| `stock` / `stockReadable` | `quantity` | ✅ The field the documented WRITE API pairs with `price` — see `DZC-031` |
| `variationLabel` | — | 🔴 **NOT PUBLISHED as a field.** ⚠ The sample's `SellerSku` (`39817:01:01`) hints at encoded variation, and decoding it would be invention. **`null`** |

> **`DZC-027` — 🔴 WHAT THE ADAPTER MUST NEVER DO WITH THIS RESPONSE.**
>
> **a.** 🔴 **NEVER WRITE PRODUCT-OWNED INTENT** (`API-062.c`). **`attributes.name` becomes the REPORTED
> title, never the intended one.**
> **b.** 🔴 **NEVER CREATE A SELLABLE PRODUCT MAPPING.** **`SellerSku` may look like an ERP SKU; `PRD-179`
> requires confirmation and forbids matching by title.** ⚠ **A discovered listing stays `UNMAPPED`** (`PRD-178`).
> **c.** 🔴 **NEVER DECIDE `DIVERGED` OR `MANUAL_REQUIRED` IN THE ADAPTER.** **It reports observed values;
> `PRD-181` owns comparison** (`API-062.c`).
> **d.** 🔴 **NEVER TREAT ABSENCE AS ZERO.** **An unreadable price is `readable=false`, never `0`.**
> **e.** 🔴 **NEVER MAP `rejectReason`, `violationDetail`, `hiddenReason`, `suspendedSkus` OR `trialProduct`.**
> ⚠ **They are real published fields with no `E-106`/`E-107` home, and inventing one is a business decision.**

> **`DZC-031` — ✅ REPORTED STOCK IS SKU `quantity`, AND THE INVENTORY CONTAINERS ARE NOT MAPPED.**
> **Added 2026-08-18 from the first live `/products/get` probe.**
>
> **The live response carried four stock-bearing names at SKU level: `quantity`, `Available`,
> `channelInventories`, `multiWarehouseInventories` and `fblWarehouseInventories`.** ⚠ **Only the
> presence of those names is evidence; the probe reported no value from any of them.**
>
> **a.** ✅ **`quantity` IS THE REPORTED STOCK, AND THE DOCUMENTATION SUPPORTS IT BY SYMMETRY.**
> **`/products/get` returns `price` and `quantity` together at SKU level, and the documented write
> API `/product/price_quantity/update` (`UpdatePriceQuantity`) is described as updating *the price
> and quantity* — *"SKU prices and total inventory".*** ✅ **The field the platform's own write API
> sets is the field its read API returns.**
>
> **b.** 🔴 **`channelInventories`, `multiWarehouseInventories` AND `fblWarehouseInventories` ARE NOT
> PUBLISHED AND ARE NOT MAPPED.** **They appear ZERO times in the `/products/get` reference — not in
> its Response Parameters table, not in its sample.** ⚠ **They exist in the live response and
> nowhere in the contract.** ✅ **Their NAMES are retained as diagnostic evidence; their contents are
> not read, not summed and not interpreted.**
>
> **c.** 🔴 **NO WAREHOUSE AGGREGATION IS INFERRED.** **Nothing published says whether a container's
> entries are alternatives, partitions or overlapping views of the same units.** ⚠ **Adding them up,
> or taking a maximum, or preferring one over `quantity`, would each produce a different number and
> none of them is documented. A wrong stock figure does not fail loudly — it oversells.**
>
> **d.** 🔴 **`Available` IS NOT MAPPED.** **It sits beside `quantity` in the official sample and is
> defined nowhere.** ⚠ **Its name invites the assumption that it is sellable stock, which is exactly
> why it is left alone.**
>
> **e.** 🔴 **THE `options` EXTRAS ARE NOT REQUESTED.** **`options=1` is documented to add
> `ReservedStock`, `RtsStock`, `PendingStock`, `RealTimeStock` and `FulfillmentBySellable`.**
> ✅ **The parameter is not sent, so none of them arrives, and none is mapped.** ⚠ **Requesting them
> would gather facts this contract has no rule for.**
>
> **f.** ⚠ **ONE LIMIT IS RECORDED RATHER THAN RESOLVED.** **The documentation routes inventory for a
> *Global Plus* item through `UpdateSellableQuantity`/`AdjustSellableQuantity` instead, and
> distinguishes *total inventory* from *sellable inventory*.** 🔴 **What `quantity` MEANS for a
> Global-Plus or FBL listing is therefore NOT PUBLISHED.** ✅ **This does not block reporting it:
> `API-062.c` makes the adapter an observer, and the reported side records what the channel said,
> never what Trioloo should do.** ✅ **The ERP's own figure is untouched — `PRD-112`/`PRD-126` make
> Published Marketplace Stock a MANUALLY controlled business figure that is never derived from a
> channel read.**
>
> **h.** ⚠ **GENERIC ATTRIBUTE VALUES ARE BOUNDED BY TRIOLOO'S OWN PERSISTENCE, AND THE FIRST LIVE
> PULL PROVED IT THE HARD WAY.** **`channel_listing_attribute` stores `attribute_key varchar(160)`
> and `reported_value varchar(1024)`; Daraz publishes no limit on either.** 🔴 **The first
> discovery against a real seller failed with *value too long for type character varying(1024)* and
> rolled the whole catalogue back.**
>
> **h.i.** 🔴 **A FIELD WITH A DEDICATED HOME IS NOT DUPLICATED INTO THE GENERIC ATTRIBUTES.**
> **`attributes.name` is the reported title and `attributes.description` is the reported
> description, which is an UNBOUNDED `text` column.** ⚠ **Copying the description into the narrower
> generic table recorded the same fact twice, in the place that could not hold it.**
> **h.ii.** 🔴 **AN OVER-LONG VALUE IS REPORTED UNREADABLE, NEVER TRUNCATED.** **The attribute keeps
> its key and is stored with `reported_readable = false` and no value.** ⚠ **A truncated REPORTED
> value would misstate what the channel said, and `PRD-181` compares intent against reported — the
> listing would read DIVERGED forever, on a difference Trioloo invented.**
> **h.iii.** ⚠ **AN ATTRIBUTE WHOSE KEY WILL NOT FIT IS DROPPED ENTIRELY.** **The key is the
> attribute's identity; a truncated one would silently collide with another on the next read.**
> **h.iv.** ✅ **NO COLUMN WAS WIDENED AND NO MIGRATION WAS TAKEN.** ⚠ **Widening asks what a channel
> attribute IS — `intended_value` is bounded too — and that is a `DB-`/`PRD-` decision, not a
> mapping one.**
>
> **g.** ✅ **CLOSING `b` NEEDS DOCUMENTATION, NOT A DECISION.** **If the provider later publishes the
> container semantics, mapping them becomes an ordinary amendment.** 🔴 **Until then, a number
> nobody can define is worse than an absent one** (`DZC-027.d`).

### 9.6 Discovery and single-read semantics

> **`DZC-028` — ✅ THE FIRST GATE DISCOVERS `filter=live` ONLY.**
>
> **a.** ✅ **`discoverActive` means ACTIVE listings** (`PRD-175`), **and `live` is the documented value for that.**
> **b.** 🔴 **`inactive`, `deleted`, `pending`, `rejected` and `sold-out` ARE DOCUMENTED AND ARE NOT USED IN
> THE FIRST GATE.** ⚠ **Reading them would change what a discovery run MEANS, which `PRD-175`/`PRD-177` own.**
> **c.** 🔴 **ABSENCE IS NOT DELETION** (`API-066.b`, `PRD-177`). **A listing a run did not return is left
> exactly as it was.** ✅ **A run that stops early for ANY reason — `901`, a transport failure, the 10000 offset
> ceiling — sets `complete=false` with an `incompleteReason`.**
> **d.** ✅ **Paging uses `limit` ≤ 50 with date scrolling; `nextCursor` carries the scroll position.**
> 🔴 **`offset` is deprecated and capped, and is not the paging mechanism.**
>
> **e.** ⚠ **AMENDED 2026-08-18 — THE SCROLL VALUE IS WRITTEN WITH `Z`, NOT A NUMERIC OFFSET, AND THE REASON
> IS A TRANSMISSION HAZARD.** **The documented sample writes `+0800`; a literal `+` in a query value is
> decoded as a SPACE by many servers.** 🔴 **The signature spans the RAW value (`DZC-008`) while the
> provider would verify against the corrupted one, producing a signature error that looks like a signing
> defect and is not one.** ✅ **`Z` is valid ISO 8601 and cannot be misread.** ⚠ **Which spellings the
> parameter actually accepts is NOT PUBLISHED; if a live diagnostic shows `Z` is rejected, the fix is
> percent-encoding the offset form — never sending a bare `+`.**
>
> **f.** ✅ **A RUN THAT CANNOT SCROLL REPORTS ITSELF INCOMPLETE.** **A full page whose entries all share one
> update time, or which carries no update time at all, cannot yield a next cursor** — **so the run stops
> with `complete=false` and a reason rather than looping or presenting a partial catalogue as the whole one.**

> **`DZC-029` — ⚠ `readListing` HAS A DOCUMENTED ENDPOINT AND A TRANSPORT GAP.**
>
> **a.** ✅ **`/product/item/get` reads one product by `item_id`, which is exactly the
> `externalListingId` the port supplies.**
> **b.** 🔴 **IT IS A `POST`, AND `DarazTransport` HAS NO POST** (`DZC-021.c`). **Until the transport gains
> one, `readListing` cannot be implemented against it.**
> **c.** ⚠ **THE FALLBACK IS NOT A SUBSTITUTE AND IS RECORDED AS SUCH.** **A single listing could be located
> through paged `/products/get`, but that reads a seller's whole catalogue to find one row and cannot be
> called a targeted read.** ✅ **The transport gained POST on 2026-08-18, so the method is no longer the
> obstacle.**
>
> **d.** ⚠ **AMENDED 2026-08-18 — THE REMAINING OBSTACLE IS THE CONTENT TYPE, AND IT IS STILL NOT PUBLISHED.**
> **`DZC-021` records that the reference does not say which content type `/product/item/get` expects.**
> 🔴 **`DarazChannelAdapter.readListing` therefore REFUSES rather than guessing a header, and refuses
> rather than returning empty** — **an empty result means *the channel did not return this listing*, which
> the caller reports to the operator in exactly those words (`PRD-177`), and saying it would be false when
> nothing was asked.**
> **e.** ✅ **CLOSING IT NEEDS ONE SAFE LIVE DIAGNOSTIC, NOT A DECISION.** **One signed call against a
> connected shop, reporting field NAMES only, settles both the accepted content type and the response shape.**

### 9.7 Token refresh

> **`DZC-030` — 🔴 REFRESH IS NOT OPTIONAL POLISH; THE LIVE CREDENTIAL EXPIRES.**
>
> **`/auth/token/refresh` takes `refresh_token`** (§5) **and is documented alongside `/auth/token/create` under
> the System category.** ⚠ **Its response FIELD SET is not separately published; it is expected to mirror
> creation, and §6.1's shape lesson applies — the first refusal must report field NAMES safely rather than
> assume.**
>
> **a.** ✅ **OBSERVED LIFETIMES, from the live credential bound 2026-08-17** — **access token ≈ 30 days,
> refresh token ≈ 180 days.** 🔴 **No token value is recorded here or anywhere in this document.**
> **b.** ✅ **CONSERVATIVE DEFAULT, PROPOSED AND NOT REQUIRING A REVIEWER DECISION:** **refresh when the access
> token is expired or within a safety margin of expiry, immediately before an adapter call.**
> **c.** 🔴 **IF REFRESH FAILS, NO LISTING API IS CALLED.** **The operation refuses and reports; it never
> proceeds on a token believed dead.**
> **d.** ✅ **CLASSIFICATION IS `DZC-011`'S, UNCHANGED.** **`REAUTH_REQUIRED` only on evidence about the
> CREDENTIAL — invalid, expired or revoked. A `901` throttle or a transport failure is `ERROR`.**
> **e.** ✅ **A SUCCESSFUL REFRESH IS STORED VIA THE EXISTING `ChannelCredentialStore.putRefreshed`**, which
> already exists and is unused.
>
> ⚠ **ONE REVIEWER DECISION REMAINS: the safety margin, and whether refresh is also scheduled proactively
> rather than only on demand.** 🔴 **On-demand with a margin is safe and is what `b` proposes; a scheduler is
> a new operational behaviour and is NOT assumed.**

---

# §10 The product review protocol — `DZC-032`

> 🔴 **RECORDED FROM THE OFFICIAL REFERENCE BEFORE ANY ADAPTER CODE EXISTS**, exactly as §9 was.
> **Read from Daraz's own API Reference on 2026-08-19** — the *Product Review API* category, whose
> three endpoints and full parameter and response tables are reproduced below. 🔴 **No endpoint,
> parameter or field here is inferred; nothing was called against a live seller.**

> **`DZC-032` — ✅ DARAZ PUBLISHES A SELLER-SIDE REVIEW API, AND IT IS A TWO-STEP READ.**
>
> **a.** ✅ **THE CATEGORY EXISTS AND HAS EXACTLY THREE ENDPOINTS.**
>
> | API name | Path | Method |
> |---|---|---|
> | `GetHistoryReviewIdList` | `/review/seller/history/list` | `GET/POST` |
> | `GetReviewListByIdList` | `/review/seller/list/v2` | `GET` |
> | `SubmitSellerReply` | `/review/seller/reply/add` | `GET` |
>
> ⚠ **The Bangladesh base is the SAME as every other call** — `https://api.daraz.com.bd/rest` — and
> the common parameters are identical to §9: `app_key`, `timestamp`, `access_token`, `sign_method`,
> `sign`. ✅ **The signing already implemented for the read half applies unchanged.**
>
> **b.** 🔴 **IDS FIRST, DETAILS SECOND. THERE IS NO ONE-CALL READ.** The reference states it
> plainly: *"get review list by id list, need get id list first."*
>
> **c.** ✅ **`/review/seller/history/list` — REQUEST.**
>
> | Parameter | Type | Required | Meaning |
> |---|---|---|---|
> | `item_id` | String | **Yes** | Product Item ID |
> | `order_id` | Number | No | Order ID |
> | `start_time` | Number | **Yes** | ms timestamp; matches `create_time` in the detail response |
> | `end_time` | Number | **Yes** | ms timestamp |
> | `current` | Number | **Yes** | page number, default `1`, **max `50`** |
>
> 🔴 **`item_id` IS REQUIRED, SO EVERY READ IS PER LISTING.** ✅ **That is also the join: it is the
> same identifier `DZC-026` already maps to `external_listing_id`.**
>
> **d.** 🔴 **TWO HARD WINDOWS, BOTH DOCUMENTED AS ERRORS.**
>
> | Limit | Evidence |
> |---|---|
> | **Only 90 days of history exists at all** | *"reviews within 3 months can be get"*; `STARTTIME_OVER_LIMIT` — *"Only support checking 90 days of history data"* |
> | **Only 7 days may be asked for at once** | `TIMESPAN_ABOVE_LIMIT` — *"Only support checking 7days data at one time"* |
>
> 🔴 **THESE ARE THE DEFINING CONSTRAINT OF THE FEATURE, NOT A DETAIL.** ⚠ **A complete 90-day
> picture for ONE listing costs THIRTEEN windowed calls plus paging**, and a lifetime review total
> **cannot be obtained from this API at all**.
>
> **e.** ✅ **`/review/seller/list/v2` — REQUEST.** `id_list`, `Number[]`, required, **maxLength = 10**.
> ⚠ **Details are fetched ten at a time.**
>
> **f.** ✅ **`/review/seller/list/v2` — RESPONSE**, per the reference's own sample:
>
> `data.review_list[]` carries `id`, **`product_id`**, `review_content`, `create_time`,
> `submit_time`, `order_id`, `review_type`, `seller_reply`, `can_reply`, `review_images[]`,
> `review_videos[]`, and **`ratings`** — an object of `overall_rating`, `product_rating`,
> `seller_rating`, `logistics_rating`. **`data.outdated_reviews[]`** lists ids that returned nothing.
>
> 🔴 **`product_id` IS THE JOIN TO `channel_listing`**, and **`ratings.product_rating` is the star
> value for the product**. ⚠ **Every rating arrives as a STRING in the sample and is read as one**
> (`TEC-015`, `DB-079`) — no rating is parsed into a float on the way in.
>
> **g.** ✅ **DOCUMENTED ERRORS.** `PARAMS_VALIDATE_ERROR` with `NULL_SELLERID`, `NULL_ITEMID`,
> `NULL_CURRENT`, `NULL_STARTTIME_OR_ENDTIME`, `STARTTIME_OVER_LIMIT`, `TIMESPAN_ABOVE_LIMIT`,
> `CURRENT_ABOVE_LIMIT`, `NULL_ID`; and **`TRAFFIC_CONTROL`**. 🔴 **`TRAFFIC_CONTROL` is a REFUSAL,
> not a failure of the listing** — it is retried later, never recorded as "no reviews".
>
> **h.** 🔴 **WHAT THIS API CANNOT ANSWER, AND MUST NEVER BE MADE TO APPEAR TO ANSWER.**
>
> | Seller Centre row metric | Available? |
> |---|---|
> | ☆ **reviews / rating** | ✅ **Yes — within 90 days**, via the two-step read above |
> | 👁 **product views** | 🔴 **NO ENDPOINT EXISTS.** No Data, Analytics, Traffic, Report or Dashboard category exists anywhere in the reference |
> | ♡ **wishlist / favourite** | 🔴 **NO ENDPOINT EXISTS** |
> | 🛒 **cart** | 🔴 **NO ENDPOINT EXISTS**; order counts are derivable from the Order API only, and that is a different fact |
> | **daily breakdown of any of them** | 🔴 **NOT AVAILABLE** |
>
> ⚠ **`Seller API` DOES publish `GetSellerMetricsById` (`/seller/metrics/get`), and it is SELLER-LEVEL**,
> not per listing. 🔴 **It is not a substitute for a per-product metric and must not be displayed as one.**
>
> **i.** 🔴 **A REVIEW COUNT SHOWN IN TRIOLOO IS A 90-DAY COUNT, AND MUST SAY SO.** ⚠ **Daraz Seller
> Centre shows a LIFETIME total; this API cannot reproduce it.** **Labelling a 90-day figure as "reviews"
> beside a marketplace that means "all reviews" would state a number Trioloo cannot support** — the same
> refusal `SYS-034` makes for unreadable fields and `DZC-031.h` makes for unstorable values.
>
> **j.** 🔴 **NOTHING HERE IS IMPLEMENTED YET.** **This section records the protocol only.** ⚠ **No
> adapter method, no persistence, no schedule and no screen exists**, and the storage of reported review
> data is a `PRD-`/`DB-` decision that this contract does not take.


## 8. What remains unpublished — and why none of it blocks

| Fact | Status |
|---|---|
| **`/seller/get` response schema** | 🔴 **NOT PUBLISHED.** Does not block — identity comes from the documented token response instead (`DZC-010`) |
| **Runtime error codes** | 🔴 **NOT PUBLISHED.** Does not block — mapping is driven by documented time facts and defaults to `ERROR` (`DZC-011`) |
| **Rate-limit semantics** | ⚠ Unpublished — treated as `ERROR`, learn empirically |
| **`/products/get` value formats** | 🔴 **NOT PUBLISHED** — price scale/currency, image array-or-string, promotion date format, true `status` value set (`DZC-024`). Does not block: each is read defensively and reports `readable=false` rather than guessing |
| **`sku_seller_list` parameter** | 🔴 **NOT PUBLISHED** — the reference's description field is empty. Does not block: it is optional and unused |
| **`/auth/token/refresh` response fields** | ⚠ **NOT SEPARATELY PUBLISHED** — expected to mirror creation (`DZC-030`). Confirm at the first refresh with safe field-name diagnostics |
| **SKU inventory containers** | 🔴 **NOT PUBLISHED** — `channelInventories`, `multiWarehouseInventories`, `fblWarehouseInventories` appear in the live response and nowhere in the reference (`DZC-031.b`). Does not block: reported stock is `quantity`, and the containers are left unmapped |
| **`quantity` for Global Plus / FBL** | ⚠ **NOT PUBLISHED** — the docs route such inventory through `UpdateSellableQuantity` and distinguish total from sellable (`DZC-031.f`). Does not block: the adapter REPORTS the channel's own field and decides nothing |
| **Local-seller token shape** | 🔴 **NOT PUBLISHED — OBSERVED.** Resolved empirically at the first live authorisation and recorded in §6.1; the documentation describes only the cross-border shape |
| **Bangladesh REST base** | ✅ **CLOSED** — explicitly documented per region |
| **Timestamp skew window** | ✅ **CLOSED** — ±7200 seconds |
| **`sign_method` value** | ✅ **CLOSED** — `sha256` |

✅ **NOTHING REMAINING REQUIRES A GUESS AT IMPLEMENTATION TIME.** ⚠ **Every unpublished item has a
documented fallback that FAILS SAFE**, and each is recorded here so it gets confirmed against reality at the first
live authorisation rather than quietly assumed to be true.

## Sources

All read from the provider's rendered official documentation on 2026-08-17, except §6.1's response shape, which is a LIVE PRODUCTION OBSERVATION of one real Bangladesh seller on 2026-08-17 — recorded as field NAMES only:

- [Daraz Open Platform — Getting Started](https://open.daraz.com/doc/doc.htm)
- [Daraz Open Platform — Seller authorization introduction](https://open.daraz.com/doc/doc.htm?#/?docId=490)
- [Daraz Open Platform — Configure seller authorization](https://open.daraz.com/doc/doc.htm?nodeId=27493&docId=118729#/?docId=491)
- [Daraz Open Platform — API Reference](https://open.daraz.com/doc/api.htm)
- [Daraz Open Platform — Reconfigure existing app / legacy API name mapping](https://developer.alibaba.com/docs/doc.htm?articleId=120243&docType=1&source=search&treeId=754) — ✅ **the DARAZ-published source that maps `GetProducts` to `/products/get`**
- [Open Platform — `/products/get` reference](https://open.lazada.com/apps/doc/api?path=/products/get)
- [Open Platform — `/product/item/get` reference](https://open.lazada.com/apps/doc/api?path=/product/item/get)
- [Lazada Open Platform — Signature algorithm](https://open.lazada.com/apps/doc/doc?nodeId=10450&docId=108068)

⚠ **The signature algorithm is published on the Lazada Open Platform documentation, to which Daraz's own API
reference links directly for signing details** — the two ventures share one platform contract.

⚠ **§9'S PARAMETER AND RESPONSE DETAIL IS READ FROM THE SAME SHARED PLATFORM REFERENCE, AND THE LINK IS NOT AN ASSUMPTION:** **Daraz's own migration guide names `/products/get` as the REST successor to `GetProducts`.** 🔴 **The Daraz API-reference site renders its catalogue through client-side script and could not be enumerated as static text; the shared reference was used for field detail and every Daraz-specific decision — regional base, signing, envelope — remains §1–§8's.**


---

# §11 The listing write protocol — `DZC-033`–`DZC-039`

> ⚠ **READ FROM THE PROVIDER'S OWN REFERENCE, 2026-08-21**, at `https://open.daraz.com/doc/api.htm`
> (Product category, `cid=1`), including each endpoint's own parameter table, code sample and error
> table. 🔴 **NO SELLER API WAS CALLED TO PRODUCE THIS SECTION.** **It is documentation, not a probe.**
>
> 🔴 **THIS SECTION LEGISLATES NOTHING AND IMPLEMENTS NOTHING.** **It records what the provider
> publishes so that an implementation does not guess.** ⚠ **`pushUpdate`, `publishCreate` and
> `withdraw` still refuse, and Daraz still declares no listing field writable** (`PRD-204.g`).

---

## `DZC-033` — The write endpoints Daraz publishes

> ✅ **THE PRODUCT CATEGORY PUBLISHES EXACTLY THESE WRITE PATHS.** **Read from the API reference's
> own path list; no other product-write path is offered there.**
>
> | # | Path | Method | Body parameter | Purpose |
> |---|---|---|---|---|
> | 1 | `/product/price_quantity/update` | `POST` | **`payload`** (XML) | price, promotion price, promotion window, quantity |
> | 2 | `/product/update` | `POST` | **`payload`** (XML) | title, description, attributes, category, images, SKU fields |
> | 3 | `/product/create` | `POST` | **`payload`** (XML) | first publication of a new product |
> | 4 | `/product/deactivate` | `POST` | **`apiRequestBody`** (XML) | take SKUs off sale |
> | 5 | `/product/remove` | `POST` | **`sku_id_list`** (JSON array) | delete SKUs |
> | 6 | `/image/upload` | `POST` | **`image`** (multipart file) | upload one image file |
> | 7 | `/image/migrate` | `POST` | **`payload`** (XML) | pull an external image URL into Daraz media |
>
> 🔴 **THE BODY PARAMETER NAME IS NOT UNIFORM, AND THIS IS A TRAP.** ⚠ **Three different names appear
> across five endpoints — `payload`, `apiRequestBody`, `sku_id_list`.** **An implementation that
> assumes `payload` everywhere will send a well-formed request that the gateway rejects for a reason
> that names no parameter.**
>
> 🔴 **THERE IS NO `/product/activate`.** ⚠ **The Product category publishes `deactivate` and
> `remove` and NO counterpart to bring a SKU back on sale.** **Deactivation must therefore be treated
> as ONE-WAY until a documented reactivation path is found** (`DZC-038`).

---

## `DZC-034` — Transport, signing and the Bangladesh base

> ✅ **NOTHING ABOUT SIGNING CHANGES FOR A WRITE.** **The same scheme §2 records for reads applies:
> parameters sorted in ASCII order excluding `sign`, each name immediately followed by its value,
> the whole prefixed by the API path, HMAC-SHA256 with the App Secret, `sign_method=sha256`.**
>
> 🔴 **THE API PATH IS PART OF THE SIGNED STRING.** ⚠ **This is why `DZC-033`'s paths are recorded
> exactly: a path that differs by one character produces a perfectly well-formed signature that is
> rejected every time, with an error that says nothing about the path.**
>
> **a.** ✅ **BASE URL — BANGLADESH IS `https://api.daraz.com.bd/rest`.** **Confirmed again from the
> Service Endpoints table on the write pages themselves, unchanged from `DZC-001`.**
>
> **b.** ✅ **COMMON PARAMETERS ARE THE READ ONES.** **`app_key`, `timestamp`, `access_token`,
> `sign_method`, `sign`** — **the same table the read endpoints publish**, with `timestamp` in
> milliseconds and **less than 7200s from UTC**.
>
> **c.** 🔴 **THE XML BODY TRAVELS AS AN ORDINARY REQUEST PARAMETER, NOT AS THE HTTP BODY.** **The
> provider's own sample calls `request.addApiParameter("payload", "<Request>…")`.** ⚠ **It is
> therefore A SIGNED PARAMETER LIKE ANY OTHER** — **its exact string participates in the signature,
> so any re-serialisation, re-indentation or entity change between signing and sending breaks it.**
>
> **d.** ⚠ **`/image/upload` IS THE ONE EXCEPTION AND IS UNRESOLVED.** **Its sample uses
> `addFileParameter("image", new FileItem(…))`, a multipart file rather than an API parameter.**
> 🔴 **Whether the file participates in the signature is NOT stated on the page** — **it must be
> settled before any media write is attempted** (`DZC-039.d`).

---

## `DZC-035` — `/product/price_quantity/update`, and what it proves about price

> ✅ **THE PAYLOAD SHAPE, AS PUBLISHED:**
>
> ```xml
> <Request>
>   <Product>
>     <Skus>
>       <Sku>
>         <ItemId>234234234</ItemId>
>         <SkuId>234</SkuId>
>         <SellerSku>Apple-SG-Glod-64G</SellerSku>
>         <Price>1099.00</Price>
>         <SalePrice>900.00</SalePrice>
>         <SaleStartDate>2017-08-08</SaleStartDate>
>         <SaleEndDate>2017-08-31</SaleEndDate>
>         <MultiWarehouseInventories>
>           <MultiWarehouseInventory>
>             <WarehouseCode>warehouseTest1</WarehouseCode>
>             <Quantity>20</Quantity>
>           </MultiWarehouseInventory>
>         </MultiWarehouseInventories>
>       </Sku>
>     </Skus>
>   </Product>
> </Request>
> ```
>
> **a.** ✅ **THE WRITE SIDE CORROBORATES `PRD-199`, AND REINTERPRETS NOTHING.** **`<Price>` is the
> normal price and `<SalePrice>` is a SECOND selling price governed by `<SaleStartDate>` and
> `<SaleEndDate>`** — **exactly the reading `PRD-199.a`/`.b` already holds for `price` and
> `special_price` on the read side.** 🔴 **THIS DOES NOT RATIFY ANY CHANGE.** ⚠ **`PRD-199` and
> `GAP-134` are untouched by this observation; it is corroboration, not a decision.**
>
> **b.** ✅ **THE PROMOTION WINDOW IS WRITABLE EVEN THOUGH IT IS NOT READABLE.** 🔴 **`DZC-024.c`
> records that the read side returns no window Trioloo can parse; the WRITE side publishes
> `<SaleStartDate>`/`<SaleEndDate>` plainly.** ⚠ **A window can therefore be SENT and not READ BACK,
> which means a push of it cannot be verified by a subsequent pull** (`PRD-186`). **That asymmetry is
> a business question, not a protocol one.**
>
> **c.** ⚠ **DATE FORMAT IS `yyyy-MM-dd`, DATE-ONLY.** **No time and no zone is published.** 🔴 **A
> Trioloo promotion window is an INSTANT** — **narrowing an instant to a bare date is lossy, and the
> rule for doing so is not a protocol fact.**
>
> **d.** ⚠ **QUANTITY IS PUBLISHED ONLY IN ITS MULTI-WAREHOUSE FORM.** **The sample carries
> `<MultiWarehouseInventories>` with a `<WarehouseCode>`.** 🔴 **Whether a plain `<Quantity>` is
> accepted, and what warehouse code a Bangladesh seller uses, is NOT published** (`DZC-039.b`).
>
> **e.** ✅ **RESPONSE ENVELOPE:** `{"code":"0","data":{},"request_id":"…"}`. ⚠ **`data` IS EMPTY ON
> SUCCESS** — **the call confirms acceptance and returns no echo of what was stored, so a push cannot
> be verified from its own response.**

---

## `DZC-036` — `/product/update`, and why it is NOT the first slice

> ✅ **THE PAYLOAD SHAPE, AS PUBLISHED:**
>
> ```xml
> <Request>
>   <Product>
>     <PrimaryCategory>6614</PrimaryCategory>
>     <SPUId/>
>     <AssociatedSku/>
>     <Images><Image>https://…jpg</Image></Images>
>     <Attributes>
>       <name>…</name>
>       <short_description>…</short_description>
>       <brand>…</brand>
>       <model>…</model>
>     </Attributes>
>     <Skus>
>       <Sku>
>         <SellerSku>…</SellerSku>
>         <quantity>1</quantity>
>         <price>388.50</price>
>         <package_length>11</package_length>
>         <package_weight>33</package_weight>
>       </Sku>
>     </Skus>
>   </Product>
> </Request>
> ```
>
> **a.** ✅ **`<name>` IS THE TITLE AND `<short_description>` THE DESCRIPTION.** 🔴 **THE WRITE SIDE
> CORROBORATES `DZC-026`: the title is `name`.** ⚠ **`name_en` DOES NOT APPEAR IN THE WRITE PAYLOAD
> AT ALL** — **which is further evidence for, not a ratification of, the existing rule. `DZC-026`
> and `PRD-202` are untouched.**
>
> **b.** 🔴 **THE PUBLISHED SAMPLE CARRIES NO `<ItemId>`, SO HOW AN UPDATE TARGETS AN EXISTING
> PRODUCT IS NOT STATED.** ⚠ **The demo is create-shaped.** **Targeting is the FIRST thing an update
> must get right, and guessing it risks creating a product instead of updating one** (`DZC-039.a`).
>
> **c.** 🔴 **THE ATTRIBUTES BLOCK LOOKS WHOLE-OBJECT, AND THAT IS THE REAL DANGER.** ⚠ **Nothing
> published says whether omitting an attribute LEAVES it or CLEARS it.** **A title-only push that
> sends `<Attributes><name>…</name></Attributes>` could blank `brand`, `model` and every
> category attribute the seller has.** 🔴 **UNTIL THIS IS SETTLED, A CONTENT PUSH IS UNSAFE AT ANY
> SIZE** (`DZC-039.c`).
>
> **d.** ⚠ **`<PrimaryCategory>` AND ATTRIBUTES ARE COUPLED.** **Category attributes are defined per
> category (`/category/attributes/get`), so a category change and an attribute set cannot be reasoned
> about independently.**
>
> **e.** ⚠ **RESPONSE RETURNS A `variation` OBJECT**, not a simple acknowledgement — **its meaning
> for an update, as opposed to a create, is not documented.**

---

## `DZC-037` — Identity: the join keys, and the one Trioloo does not hold

> ✅ **DARAZ USES THREE SKU IDENTIFIERS.** **`SellerSku` (the seller's own), `SkuId` (marketplace,
> numeric) and `ShopSku` (marketplace, composite).** **`ItemId` identifies the product.**
>
> 🔴 **TRIOLOO PERSISTS `SellerSku` AND `ItemId` ONLY.** **`DarazListingMapper` reads `SellerSku` as
> the channel SKU and deliberately does not substitute `ShopSku` or `SkuId` for it** (`DZC-026`);
> **neither marketplace identifier is stored.**
>
> **a.** ✅ **PRICE AND QUANTITY CAN BE ADDRESSED BY WHAT TRIOLOO HOLDS.** **`/product/price_quantity/update`
> publishes `SellerSku` alongside `ItemId`/`SkuId` in one `<Sku>` element.** ⚠ **Whether `SellerSku`
> ALONE is sufficient is not stated and must be settled before implementation** (`DZC-039.e`).
>
> **b.** 🔴 **DEACTIVATE AND REMOVE CANNOT BE ADDRESSED AT ALL TODAY.** **`/product/deactivate`
> requires `<SkuId>` and `/product/remove` requires a `sku_id_list` of composite SkuId strings
> (`"SkuId_1269656765_5230534246"`).** ⚠ **Trioloo stores neither**, **so these are blocked on a READ
> change that captures them — not on the write protocol.**
>
> **c.** ⚠ **CAPTURING `SkuId` IS A SEPARATE, RATIFIABLE CHANGE.** **The read response already
> carries `SkuId` and `ShopSku`; persisting them is a schema and mapper decision that belongs to its
> owning documents, and this section decides nothing about it.**

---

## `DZC-038` — Lifecycle, errors and throttling

> **a.** 🔴 **DEACTIVATION IS ONE-WAY AS PUBLISHED.** **`/product/deactivate` exists; no
> `/product/activate` is published in the Product category.** ⚠ **An operator who deactivates through
> Trioloo could not be brought back through Trioloo** — **which makes it unsuitable for early
> implementation regardless of the identity blocker.**
>
> **b.** ✅ **`/product/deactivate` SHAPE:** `apiRequestBody` = `<Request><Product><ItemId>…</ItemId><Skus><SkuId>…</SkuId><SkuId>…</SkuId></Skus></Product></Request>`.
>
> **c.** ✅ **`/product/remove` SHAPE:** `sku_id_list` = a JSON array of strings, e.g.
> `["SkuId_1269656765_5230534246"]`. ⚠ **JSON, not XML, in an otherwise XML family.**
>
> **d.** ✅ **THE ERROR CODES THAT MATTER FOR A WRITE**, published on the endpoints themselves:
>
> | Code | Meaning | Why it matters |
> |---|---|---|
> | `0` | success | the only success value; `code` is a STRING (`DZC-010`) |
> | `1` | `E001: Parameter %s is mandatory` | names the parameter |
> | `5` | `E005: Invalid Request Format` | the shape was rejected |
> | `204` | `E204: Too many SKU in one request` | 🔴 **a per-request SKU limit exists; its NUMBER is not published** |
> | `501` | `E501: Update product failed` | price/stock update refused |
> | `901` | too frequent, or functionality disabled | 🔴 **the throttling signal — RETRY, never "no change"** |
> | `4104` | `BIZ_CHECK_PRICE_PRECISION_INVALID` | money precision refused |
> | `4105` | `BIZ_CHECK_SELLER_SKU_DUPLICATE` | SellerSku collision |
> | `4108` | `CHK_BASIC_REQUIRED` | a mandatory basic attribute was missing |
> | `4110` | `BIZ_CHECK_CAT_PROP_MANDATORY` | a mandatory category attribute was missing |
>
> **e.** 🔴 **NO NUMERIC RATE LIMIT IS PUBLISHED.** **Throttling is expressed ONLY as error `901`.**
> ⚠ **`901` MUST BE TREATED AS A RETRYABLE CONDITION AND NEVER AS AN OUTCOME** — **the same rule
> `DZC-032.f` records for reviews.**
>
> **f.** ⚠ **NO PERMISSION SCOPE IS PUBLISHED PER ENDPOINT.** **The reference states none; whether
> the existing app authorisation already covers product writes is unknown until a call is made.**

---

## `DZC-039` — What is NOT known, and must be settled before any implementation

> 🔴 **EACH ITEM BELOW IS A GAP IN THE PROVIDER'S PUBLISHED DOCUMENTATION, NOT A TRIOLOO DECISION.**
> ⚠ **NONE OF THEM CAN BE ANSWERED WITHOUT A CONTROLLED CALL AGAINST A REAL SELLER ACCOUNT**, which
> is a separately-authorised act and did not happen in this gate.
>
> **a.** 🔴 **HOW `/product/update` TARGETS AN EXISTING PRODUCT.** **No `<ItemId>` in the sample.**
> **The highest-risk unknown: a wrong guess may CREATE rather than update.**
>
> **b.** ⚠ **WHETHER A PLAIN `<Quantity>` IS ACCEPTED**, or a `<WarehouseCode>` is mandatory in
> Bangladesh, and which code a seller uses.
>
> **c.** 🔴 **WHETHER OMITTING AN ATTRIBUTE PRESERVES OR CLEARS IT** on `/product/update`.
>
> **d.** ⚠ **WHETHER THE `/image/upload` FILE PARTICIPATES IN THE SIGNATURE.**
>
> **e.** ⚠ **WHETHER `SellerSku` ALONE ADDRESSES A SKU** on `/product/price_quantity/update`.
>
> **f.** ⚠ **THE NUMERIC SKU LIMIT BEHIND `E204`**, and any numeric rate limit behind `901`.
>
> **g.** ⚠ **WHETHER A PROMOTION WINDOW SENT AS `yyyy-MM-dd` IS INTERPRETED IN SELLER LOCAL TIME.**

---

## `DZC-040` — The recommended first slice, and why it is that one

> ✅ **RECOMMENDATION — `/product/price_quantity/update`, RESTRICTED TO PRICE AND STOCK.**
> ⚠ **A RECOMMENDATION IS NOT A RATIFICATION.** **Implementation remains blocked until the owning
> business documents authorise a push at all.**
>
> **a.** ✅ **IT IS ADDRESSABLE BY WHAT TRIOLOO ALREADY HOLDS** — `SellerSku` and `ItemId`
> (`DZC-037.a`), **with no schema change.**
>
> **b.** ✅ **IT IS THE ONLY WRITE WHOSE FIELDS TRIOLOO ALSO READS BACK**, **so a push can be
> VERIFIED by a subsequent pull** (`PRD-186`) — **price and stock are both readable (`DZC-023`,
> `DZC-031`).**
>
> **c.** ✅ **IT CARRIES NO WHOLE-OBJECT HAZARD.** **A `<Sku>` element names its own fields; nothing
> published suggests omitting one clears another, unlike `/product/update`'s Attributes block.**
>
> **d.** 🔴 **EVEN THIS SLICE HAS TWO OPEN QUESTIONS FIRST** — **`DZC-039.b` (quantity form) and
> `DZC-039.e` (SellerSku alone).** ⚠ **Both are answerable with ONE controlled call on ONE listing.**
>
> **e.** 🔴 **PROMOTION IS EXCLUDED FROM THE FIRST SLICE** even though the same endpoint carries it,
> **because its window cannot be read back (`DZC-035.b`) and its date precision is lossy
> (`DZC-035.c`).** **A push that cannot be verified is not a first slice.**
>
> **f.** 🔴 **CONTENT, MEDIA, CATEGORY, ATTRIBUTES, DEACTIVATE AND REMOVE ARE ALL EXCLUDED** — **each
> is blocked by a named unknown in `DZC-039` or by the identity gap in `DZC-037.b`.**

---

## `DZC-041` — The controlled probe that settles `DZC-039.b` and `DZC-039.e`

> ✅ **BUILT 2026-08-21, NOT RUN.** **A server-side command sends ONE same-value price and quantity
> update for ONE listing, so the two questions gating `DZC-040`'s first slice can be answered by
> asking rather than by guessing.** 🔴 **IT HAS NOT BEEN RUN AGAINST DARAZ.**
>
> **a.** ✅ **SAME VALUE, THEREFORE NO BUSINESS CHANGE.** **The price and quantity sent are read
> from the STORED REPORTED side — what Daraz itself last said it is showing.** 🔴 **Both must be
> present AND readable or the probe refuses**: ⚠ **an unreadable figure would leave it inventing
> one, which is exactly the change it must never make.**
>
> **b.** 🔴 **IT IS GATED TWICE.** **A command name selects it and a separate
> `--daraz.confirm-same-value-write=true` authorises it.** ⚠ **One argument is enough for a READ
> probe and not for a WRITE: a command that only had to be named could be re-run from shell
> history.** ✅ **`--daraz.dry-run=true` prints the exact payload and contacts nothing.**
>
> **c.** 🔴 **IT IS NOT `pushUpdate` AND MUST NOT BECOME IT.** **It writes nothing to Trioloo,
> records no operation, and its scoped context names no bean that COULD mutate a listing, product or
> inventory row.** ⚠ **The adapter's outbound half still refuses and no field became writable
> (`PRD-204.g`).**
>
> **d.** 🔴 **PROMOTION IS ABSENT BY NAME.** **No `SalePrice`, no `SaleStartDate`, no `SaleEndDate`
> (`DZC-040.e`).** ✅ **`<Quantity>` is sent in its PLAIN form deliberately — that is the question.**
>
> **e.** ✅ **IT REPORTS METADATA ONLY** — **outcome, provider `code`, `type`, `request_id` and
> envelope field names.** 🔴 **Never a price, a quantity, a SellerSku, an item id, a token, a
> signature or the provider's own message**, ⚠ **which can echo a SellerSku back.**
>
> **f.** ⚠ **A TRANSPORT FAILURE IS REPORTED AS AN UNKNOWN OUTCOME, NOT AS A FAILURE TO WRITE.**
> **Whether Daraz applied the update cannot be known from a dropped connection; the report says so
> and directs a re-read.**
>
> **g.** 🔴 **THE ONLY PERMITTED PERSISTENT SIDE EFFECT IS A TOKEN REFRESH.**

---

## `DZC-042` — What the live probe settled, 2026-08-21

> ✅ **THE `DZC-041` PROBE WAS RUN ONCE AND ACCEPTED.** **One same-value price and quantity update
> for one Bangladesh listing returned `code` `0`.** ⚠ **Everything below is OBSERVED FACT from that
> single call, not a documented promise** — **the provider's own reference still says none of it.**
>
> **a.** ✅ **`ItemId` + `SellerSku` ADDRESSES A SKU FOR PRICE AND QUANTITY.** **`DZC-039.e` is
> answered YES.** 🔴 **No `SkuId` was sent and none was needed**, ⚠ **so price and stock are
> addressable with the two identifiers Trioloo already persists** (`DZC-037.a`), **with no schema
> change.** 🔴 **THIS SAYS NOTHING ABOUT DEACTIVATE OR REMOVE**, which name `SkuId` explicitly and
> stay blocked (`DZC-037.b`).
>
> **b.** ✅ **A PLAIN `<Quantity>` IS ACCEPTED.** **`DZC-039.b` is answered YES for this seller.**
> ⚠ **No `MultiWarehouseInventories` and no `WarehouseCode` were sent.** 🔴 **The published sample
> shows only the multi-warehouse form, so this is an observation about ONE account and not a general
> rule; a seller with real multi-warehouse configuration may behave differently.**
>
> **c.** 🔴 **THE SUCCESS ENVELOPE HAS NO `data` NODE, AND THIS AMENDS `DZC-035.e`.** **The observed
> success carried exactly `code`, `request_id` and `_trace_id_`.** ⚠ **`DZC-035.e` recorded
> `"data":{}` from the published sample; the live account returns NO `data` KEY AT ALL.**
> 🔴 **IMPLEMENTATION RULE — `code` `0` IS SUCCESS WHETHER OR NOT `data` IS PRESENT.** **A reader
> that requires `data` treats a success as a malformed response**, ⚠ **which is exactly what the
> READ path's envelope check does, correctly, for reads — the two must not share one check.**
>
> **d.** ✅ **`_trace_id_` IS AN UNDOCUMENTED EXTRA FIELD AND IS HARMLESS.** 🔴 **An envelope reader
> must tolerate unknown top-level fields rather than reject them.**
>
> ✅ **WIDENED 2026-08-23 BY `DZC-057`. `_trace_id_` IS A GENERAL ENVELOPE FIELD, NOT A WRITE-PATH
> QUIRK.** **It was observed again on a READ — the `/orders/get` confirmed read carried `data`, `code`,
> `request_id` and `_trace_id_`.** ⚠ **This clause was written from a WRITE response alone and could
> not then say which.** 🔴 **The obligation is unchanged and now applies to every path: tolerate
> unknown top-level fields, never reject on them, and never bind to them** (`DZC-042.d` original
> wording retained, `DOC-009`).
>
> **e.** ⚠ **NO `type` FIELD WAS PRESENT ON SUCCESS.** **Its absence is not an error.**
> ✅ **CORROBORATED 2026-08-23 on the read path — `type` was absent there too** (`DZC-057.b`).
>
> **f.** 🔴 **NOTHING CHANGED ON EITHER SIDE.** **The values sent were the ones Daraz itself last
> reported, and every Trioloo digest was byte-identical before and after.** ⚠ **The probe did not
> re-read the marketplace, so the Daraz-side no-change is REASONED from the same-value construction
> rather than measured.**
>
> **g.** 🔴 **ONE CALL, ONE ACCOUNT, ONE LISTING.** **No throttling was observed because nothing was
> repeated; `901` remains the documented signal and remains untested here** (`DZC-038.e`).

---

# §12 The order read protocol — `DZC-043`–`DZC-050`

> 🔴 **RECORDED FROM THE DARAZ-PUBLISHED REFERENCE ON 2026-08-23, BEFORE ANY ADAPTER CODE EXISTS.** **The
> same discipline as `§9` and `§11`.**
>
> 🔴 **NOTHING WAS IMPLEMENTED AND NO SELLER API WAS CALLED.** ⚠ **No credential, token or seller datum was
> used to produce this section.**
>
> 🔴 **IT RATIFIES NO BUSINESS DECISION.** **Backfill window, polling cadence, shop fan-out, notification
> participation and retry behaviour are recorded as OPEN at `GAP-137` and are decided by their owners, not
> here** (`DOC-024`, `CLAUDE.md` §5).

## `DZC-043` — How this section was obtained, and why the source matters

> ✅ **THE DARAZ REFERENCE WAS RENDERED, NOT INFERRED.** **`open.daraz.com/doc/api.htm` is a client-side
> application; a static fetch returns only a loading shell — which is why `GAP-137` was registered OPEN on
> 2026-08-23 rather than filled from recollection.** ✅ **It was then rendered in a headless browser and its
> `Order` category expanded, and every fact in `§12` is read from that rendering.**
>
> **a.** 🔴 **THE DARAZ TREE IS THE AUTHORITY, AND THE LAZADA TREE IS NOT THE SAME SET.** ⚠ **Lazada
> publishes `GetOVOOrders` and `OrderCancelValidate`, which **Daraz does not**; Daraz publishes
> `GetOrderLogisticDetail` and `GetOrderTrace`, which **Lazada does not**.** 🔴 **`§12` records the DARAZ
> set.** ✅ **Lazada pages were rendered as CORROBORATION only and are cited as such.**
>
> **b.** ✅ **THIS CLOSES THE EQUIVALENCE DOUBT `GAP-137` RAISED.** **`§9` could assert Daraz↔platform path
> equivalence for products only because a Daraz-published migration guide mapped `GetProducts` to
> `/products/get`.** ✅ **For orders no such inference is needed: the paths are read from Daraz's own
> reference.**
>
> **c.** ✅ **THE BANGLADESH ENDPOINT IS PRINTED ON EVERY ORDER PAGE** — **`https://api.daraz.com.bd/rest`**,
> in the per-region Service Endpoints table, confirming `DZC-001` and requiring no inference.
>
> **d.** ⚠ **THE API EXPLORER WAS NOT USED.** **It requires an App Console sign-in, and no credential was
> used** (`DZC-021` discipline, `API-070`).

## `DZC-044` — The order endpoints Daraz publishes

> **Read from the Daraz `Order` category, 2026-08-23.** 🔴 **Eight endpoints. `§12` documents the READ half
> and names the rest without specifying them.**

| API name | Method | Path | `§12` scope |
|---|---|---|---|
| **`GetOrders`** | `GET` | **`/orders/get`** | ✅ **Specified — `DZC-045`** |
| **`GetOrder`** | `GET/POST` | **`/order/get`** | ✅ **Specified — `DZC-046`** |
| **`GetOrderItems`** | `GET` | **`/order/items/get`** | ✅ **Specified — `DZC-047`** |
| **`GetMultipleOrderItems`** | `GET` | **`/orders/items/get`** | ✅ **Specified — `DZC-048`** |
| `GetOrderLogisticDetail` | `GET/POST` | `/order/logistic/get` | ⚠ **Named, NOT specified** |
| `GetOrderTrace` | `GET/POST` | `/logistic/order/trace` | ⚠ **Named, NOT specified** |
| `GetDocument` | `GET` | `/order/document/get` | ⚠ **Named, NOT specified** |
| **`SetInvoiceNumber`** | `POST` | `/order/invoice_number/set` | 🔴 **A WRITE. Out of scope and NOT authorised** |

> **a.** 🔴 **`SetInvoiceNumber` IS THE ONLY WRITE IN THE CATEGORY AND NOTHING HERE AUTHORISES IT.** ⚠ **An
> order write would need its own business ratification exactly as `PRD-205` was needed for listings.**
> **b.** ⚠ **THE THREE UNSPECIFIED READS ARE NAMED SO THEY ARE NOT REDISCOVERED AS MISSING.** **They serve
> logistics and document concerns that no ratified Order requirement currently needs.**

> **`DZC-044.c` — ✅ TRANSPORT, SIGNING AND THE ENVELOPE ARE UNCHANGED.** **The order APIs take the same five
> common parameters as every other REST call — `app_key`, `timestamp`, `access_token`, `sign_method`, `sign`,
> all REQUIRED — and the Bangladesh base of `DZC-001`.** ✅ **`§5`'s signing scheme and `§7`'s envelope govern
> unchanged; `DZC-042.c`'s amendment about a success carrying no `data` node was a WRITE observation and is
> not asserted of these reads.**

## `DZC-045` — `/orders/get` — the list read

> **`GetOrders` · `GET /orders/get` · Daraz description: *"Use this API to get the list of items for a range
> of orders"*. Last updated on the provider's page: 2023-07-20.**

**Parameters — every one is published OPTIONAL, with one conditional rule.**

| Name | Type | Published requirement | Meaning as published |
|---|---|---|---|
| `created_after` | String | No\* | ISO 8601. Limits to orders created after or on the date |
| `created_before` | String | No | ISO 8601. *"Optional."* |
| `update_after` | String | No\* | ISO 8601. Limits to orders updated after or on the date |
| `update_before` | String | No | ISO 8601. *"Optional."* |
| `status` | String | No | See `DZC-045.c` |
| `sort_by` | String | No | *"Possible values are `created_at` and `updated_at`."* |
| `sort_direction` | String | No | *"Possible values are `ASC` and `DESC`."* |
| `offset` | Number | No | *"Number of orders to skip at the beginning of the list."* |
| **`limt`** | Number | No | *"The maximum number of orders that can be returned. The supported maximum number is 100."* ⚠ **Spelling as published — `DZC-050.d`** |
| `mp3_Order` | Number | No | *"1 mp3 order; 2 non mp3 order"* — ⚠ **Daraz-only; absent from the Lazada page** |

> **a.** 🔴 **`\*` — ONE OF THE TWO AFTER-DATES IS MANDATORY IN PRACTICE.** **Both `update_after` and
> `created_after` carry the published sentence *"Either UpdatedAfter or CreatedAfter is mandatory."*** ⚠ **The
> requirement column says `No` for both, so the obligation is CONDITIONAL and lives in the description, not in
> the requirement flag.** 🔴 **An unbounded list read is therefore not offered.**
>
> **b.** ✅ **PAGINATION IS OFFSET-BASED, AND THE PAGE CEILING IS 100.** 🔴 **NO OPAQUE CURSOR, SCROLL TOKEN
> OR CONTINUATION HANDLE EXISTS** — ⚠ **unlike `/products/get`, which `DZC-028.e` records as scroll-based.**
> **Paging is `offset` plus page size, against `countTotal` / `count`.**
>
> **c.** ✅ **THE DARAZ STATUS SET, AS PUBLISHED:** **`unpaid`, `pending`, `canceled`, `ready_to_ship`,
> `delivered`, `returned`, `shipped`, `failed`.** ⚠ **The page adds: *"New Possible values are `topack` and
> `toship` for white list seller."*** 🔴 **WHITE-LIST MEMBERSHIP IS A SELLER PROPERTY THIS DOCUMENT CANNOT
> READ, so `topack`/`toship` are recorded as PUBLISHED POSSIBILITIES and never assumed available**
> (`DZC-050.f`). ⚠ **The Lazada page additionally lists `shipping` and `lost`; 🔴 DARAZ DOES NOT, and the
> Daraz set governs.**
> **c.i.** ⚠ **`canceled` IS SPELLED WITH ONE `l` IN THE PROVIDER'S OWN VOCABULARY.** **Recorded because a
> corrected spelling would not match.**
> **c.ii.** 🔴 **THIS IS THE CHANNEL'S VOCABULARY AND IT IS NOT TRIOLOO'S** (`BR-005`, `BR-171`). **Mapping it
> to `SM-1` is ADAPTER WORK and is not performed here.**
>
> **d.** ✅ **RESPONSE ENVELOPE:** **`data` → `{ countTotal, count, orders[] }`.** **`countTotal` is *"the
> complete number of all orders for the current filter set"*; `count` is the same figure *"(included offset and
> limit)"*.** ⚠ **The two descriptions are near-identical in the provider's text and the distinction is not
> stated more precisely; recorded as published.**
>
> **e.** ✅ **ORDER-LEVEL FIELDS, AS PUBLISHED.**
>
> | Group | Fields |
> |---|---|
> | **Identity** | `order_id` — *"Identifier of this order as assigned by the Seller Center"* · `order_number` — *"The human-readable order number"* |
> | **Time** | `created_at` · `updated_at` · `address_updated_at` |
> | **Money** | `price` — *"Total amount for this order"* · `voucher` · `voucher_platform` · `voucher_seller` · `voucher_code` · `cash_payment_fee` |
> | **Shipping money** | `shipping_fee` · `shipping_fee_original` · `shipping_fee_discount_seller` · `shipping_fee_discount_platform` |
> | **Payment** | `payment_method` |
> | **State** | `statuses[]` — *"An array of unique status of the items in the order"* |
> | **Content** | `items_count` · `promised_shipping_times` · `warehouse_code` · `delivery_info` |
> | **Operator text** | `remarks` · `buyer_note` · `gift_option` · `gift_message` |
> | **Buyer** | `customer_first_name` · `customer_last_name` — ⚠ published as *"Empty for now."* |
> | **Regional / other** | `national_registration_number1` · `branch_number` (TH only) · `tax_code` (TH and VN only) · `extra_attributes` |
>
> ✅ **CONFIRMED AGAINST A LIVE RESPONSE 2026-08-23** (`DZC-057.c`). **The order object returned by the
> confirmed read carried THIRTY-TWO fields and every one of them is in the table above — no undocumented
> order field appeared.** ⚠ **THE TABLE IS A CEILING, NOT A GUARANTEE: `address_updated_at` is documented
> here and was NOT returned.** 🔴 **A DOCUMENTED FIELD MAY BE ABSENT, so a mapper reads defensively and an
> absent field is ABSENT rather than empty** (`SYS-034`).
>
> **f.** ✅ **ADDRESS FIELDS — TWO NODES, IDENTICAL SHAPE:** **`address_billing` and `address_shipping`, each
> carrying `first_name`, `last_name`, `phone`, `phone2`, `address1`, `address2`, `address3`, `address4`,
> `address5`, `city`, `post_code`, `country`.** ⚠ **The provider annotates `address2` as *"Not used for now"*,
> `address3` as *"State name"*, `address4` as *"City name"* and `address5` as *"Third-level address"* —
> 🔴 **the numbering does NOT correspond to a simple two-line street address and must not be mapped as one.**
>
> **g.** ✅ **ERROR CODES, AS PUBLISHED:** **`14 E014` invalid offset · `17 E017` invalid date format ·
> `19 E019` invalid limit · `36 E036` invalid status filter · `74 E074` invalid sort direction ·
> `75 E075` invalid sort filter.** ⚠ **`E019`'s text names *"the limit parameter"* while the parameter table
> spells it `limt` — see `DZC-050.d`.**

## `DZC-046` — `/order/get` — one order

> **`GetOrder` · `GET/POST /order/get` · Daraz description: *"Use this API to get the list of items for a
> single order."***
>
> **a.** ✅ **ONE PARAMETER, AND IT IS REQUIRED:** **`order_id` (Number) — *"The identifier that was assigned
> to the order by the Seller Center."***
> **b.** ✅ **RETURNS THE ORDER-LEVEL FACTS OF `DZC-045.e` FOR A SINGLE ORDER**, including `address_shipping`,
> `payment_method`, `price`, `statuses`, `items_count` and both timestamps.
> **c.** ✅ **ERRORS:** **`16 E016` invalid order ID · `6 E006` system error.**
> **d.** ⚠ **THE PUBLISHED DESCRIPTION SAYS *"list of items"* WHILE THE RESPONSE IS ORDER-LEVEL.** 🔴 **The
> provider's own wording is inconsistent between `/order/get` and `/order/items/get`; recorded, not corrected.**

## `DZC-047` — `/order/items/get` — the items of one order

> **`GetOrderItems` · `GET /order/items/get` · Daraz description: *"Use this API to get the item information
> of an order."***
>
> **a.** ✅ **ONE PARAMETER, REQUIRED:** **`order_id` (Number).**
> **b.** ✅ **`data` IS AN ARRAY of item objects.**
>
> **c.** ✅ **ITEM AND SKU FIELDS, AS PUBLISHED.**
>
> | Group | Fields |
> |---|---|
> | **Identity** | `order_item_id` · `order_id` · `sku` — *"Product SKU"* · `shop_sku` — *"Product outer ID"* · `sku_id` · `product_id` |
> | **Content** | `name` · `variation` · `product_main_image` · `product_detail_url` · `is_digital` · `digital_delivery_info` |
> | **Money** | `item_price` · `paid_price` · `tax_amount` · `shipping_amount` · `shipping_service_cost` · `currency` — *"ISO 4217 compatible currency code"* · `voucher_amount` · `voucher_platform` · `voucher_seller` · `voucher_code_seller` · `voucher_code_platform` · `voucher_seller_lpi` · `voucher_platform_lpi` · `wallet_credits` |
> | **Shipping money** | `shipping_fee_original` · `shipping_fee_discount_seller` · `shipping_fee_discount_platform` |
> | **State** | `status` · `return_status` · `reason` · `reason_detail` · `cancel_return_initiator` · `stage_pay_status` |
> | **Fulfilment** | `tracking_code` · `shipment_provider` · `shipping_provider_type` · `shipping_type` · `package_id` · `warehouse_code` · `delivery_option_sof` · `is_fbl` · `is_reroute` · `promised_shipping_time` · `sla_time_stamp` · `fulfillment_sla` · `priority_fulfillment_tag` |
> | **Documents** | `invoice_number` · `purchase_order_id` · `purchase_order_number` |
> | **Classification** | `order_type` · `order_flag` |
> | **Other** | `buyer_id` · `shop_id` · `created_at` · `updated_at` · `extra_attributes` · `gift_wrapping` · `show_giftwrapping_tag` · `personalization` · `show_personalization_tag` |
>
> **d.** ✅ **PUBLISHED ENUMERATIONS, VERBATIM.** **`shipping_provider_type`: `EXPRESS`, `STANDARD`,
> `ECONOMY`, `INSTANT`, `SELLER_OWN_FLEET`, `PICKUP_IN_STORE`, `DIGITAL`.** **`cancel_return_initiator`:
> `cancellation-internal`, `cancellation-customer`, `cancellation-failed Delivery`, `cancellation-seller`,
> `return-customer`, `refund-internal`.** **`order_flag`: `GUARANTEE`, `NORMAL`, `GLOBAL_COLLECTION`.**
> **`order_type`: `Normal`, `PreSale`, `Coupon`, `O2O`, `InStoreO2O`.** **`shipping_type`: `Drop-shipping` or
> `Warehouse`.**
>
> **e.** ⚠ **`reason` IS DEFINED BY A PROVIDER-SIDE TABLE — *"defined in the table `sales_order_reason`"* —
> WHICH IS NOT PUBLISHED HERE.** 🔴 **NOT PUBLISHED — DO NOT ASSUME a reason vocabulary.**
> **f.** ⚠ **`shop_id` IS DESCRIBED AS *"Seller name"*.** 🔴 **The name and the description disagree; recorded,
> not reconciled.**
> **g.** ✅ **ERRORS:** **`16 E016` invalid order ID · `6 E006` system error.**

## `DZC-048` — `/orders/items/get` — items for many orders

> **`GetMultipleOrderItems` · `GET /orders/items/get` · Daraz description: *"Use this API to get the item
> information of one or more orders."***
>
> **a.** ✅ **ONE PARAMETER, REQUIRED:** **`order_ids` (`Number[]`) — *"Comma-separated list of order
> identifiers in square brackets."*** ✅ **`E056` confirms the literal form: *"Must use array format `[1,2]`"*.**
> **b.** ✅ **THE ITEM SHAPE IS `DZC-047.c`'s, GROUPED BY ORDER.**
> **c.** ✅ **ERRORS:** **`37 E037` one or more order ids incorrect · `38 E038` too many orders requested ·
> `39 E039` no orders found · `56 E056` invalid list format.**
> **d.** 🔴 **`E038` PROVES A BATCH CEILING EXISTS AND THE NUMBER IS NOT PUBLISHED** (`DZC-050.c`).
> **e.** ✅ **THIS IS THE ENDPOINT THAT MAKES A LARGE READ ECONOMIC** — ⚠ **one call per order would multiply
> a backfill by the order count, which is the shape of cost `DZC-032` recorded for reviews.**

## `DZC-049` — What the published protocol supports

> ✅ **STATED AS CAPABILITY, NOT AS A DECISION.** 🔴 **Each line says what the API PERMITS. None ratifies that
> Trioloo will do it.**
>
> **a.** ✅ **A REQUEST IS SCOPED TO ONE SELLER BY CONSTRUCTION.** **Every call carries `access_token` and
> `sign`, and one authorisation is one seller account** (`§3`, `§4`). ✅ **`API-071.a`'s explicit
> `channelInstanceId` scope is satisfied naturally, and `API-071.b`'s prohibition on an ambient current-shop
> context is what the adapter must preserve.**
>
> **b.** ✅ **`order_id` IS THE EXTERNAL IDEMPOTENCY KEY.** **It is the Seller-Center-assigned identifier and
> the ONLY identifier `/order/get`, `/order/items/get` and `/orders/items/get` accept.** 🔴 **`order_number`
> is published as the HUMAN-READABLE number and is a display fact, never the key.** ✅ **This is what
> `SYS-045`, `API-024` and `EVA-016` require an adapter to deduplicate on, and `DB-013` requires it stored
> with its issuing party.**
>
> **c.** ✅ **INCREMENTAL READING IS EXPRESSIBLE:** **`update_after` with `sort_by=updated_at` and a
> direction, paged by `offset` against a page size capped at 100.**
>
> **d.** 🔴 **THERE IS NO CURSOR, SO A CHECKPOINT CAN ONLY BE A TIMESTAMP WATERMARK.** ⚠ **A watermark is not
> a cursor: orders updated during a run, clock skew, and the unstated inclusivity of `update_after`
> (`DZC-050.e`) all mean a boundary read can miss or repeat.** ✅ **THE PROTOCOL-LEVEL CONSEQUENCE IS
> THEREFORE FIXED: any watermark must be OVERLAPPED and the overlap DEDUPLICATED BY `order_id`.** 🔴 **This is
> a property of the provider's API, not a scheduler design, and it does not ratify a cadence.**
>
> **e.** ⚠ **A HISTORICAL READ IS EXPRESSIBLE — `created_after` / `created_before` accept any ISO 8601
> window.** 🔴 **WHETHER A 3-MONTH WINDOW RETURNS DATA IS NOT ANSWERED, because no retention limit is
> published** (`DZC-050.a`). ⚠ **The Review API is the cautionary precedent: `DZC-032` found a 90-day
> retention and a 7-day maximum window that a naive request would have violated.**

## `DZC-050` — What is NOT published, and must not be assumed

> 🔴 **UNREADABLE OR UNSTATED IS NOT THE SAME AS ABSENT, AND NEITHER IS THE SAME AS PERMITTED.** ⚠ **Every
> item below was looked for on the rendered Daraz pages and was not there.**
>
> **a.** 🔴 **NO RETENTION OR HISTORY LIMIT IS PUBLISHED FOR ORDERS.** ⚠ **NOT PUBLISHED — DO NOT ASSUME
> either that history is unbounded or that it is 90 days.** 🔴 **This is the single fact a backfill decision
> most needs, and it is unknown.**
> **b.** 🔴 **NO RATE LIMIT, QPS, QUOTA OR THROTTLING SIGNAL IS PUBLISHED ON ANY ORDER PAGE.** ⚠ **No order
> equivalent of the listing side's `901` appears.** 🔴 **NOT PUBLISHED — DO NOT ASSUME a safe polling
> frequency.**
> **c.** 🔴 **`E038`'s BATCH MAXIMUM IS NOT PUBLISHED.** ✅ **The ceiling demonstrably exists; the number does
> not appear.**
> **d.** 🔴 **THE PAGE-SIZE PARAMETER SPELLING IS CONTRADICTORY IN THE PROVIDER'S OWN DOCUMENTATION.**
> **Daraz's parameter table prints **`limt`**; its own error text `E019` says *"the limit parameter"*; the
> corroborating Lazada page prints `limit`.** ⚠ **NOT PUBLISHED — DO NOT ASSUME which the gateway accepts.**
> ✅ **It is settleable by one controlled read, exactly as `DZC-039.b`/`.e` were settled by `DZC-041`.**
>
> ✅ **SETTLED 2026-08-23 BY `DZC-057`. The wording above is retained** (`DOC-009`) **because it records the
> contradiction that made the question worth asking.** **The gateway ACCEPTED `limit`: the confirmed read
> returned `code` `0` and NO `E019`.** 🔴 **`limt` IS TREATED AS A TYPO IN THE PROVIDER'S OWN PARAMETER
> TABLE, contradicted by the provider's own error text, unless future evidence says otherwise.** ⚠ **One
> account, one call — the `DZC-042.g` caveat applies unchanged.**
> **e.** 🔴 **`update_after` / `created_after` INCLUSIVITY AND TIMEZONE ARE NOT STATED.** **The text says
> *"after or on the specified date"*, which reads inclusive, but no timezone, offset handling or precision is
> published.** ⚠ **`DZC-039.g` records the same class of unknown for a date-only promotion window.**
> **f.** 🔴 **WHETHER THIS SELLER IS A WHITE-LIST SELLER IS NOT KNOWABLE FROM DOCUMENTATION**, so whether
> `topack` and `toship` are valid filters here is unknown (`DZC-045.c`).
> **g.** 🔴 **WEBHOOK AND NOTIFICATION BEHAVIOUR IS NOT DOCUMENTED IN `§12`.** ⚠ **A `Webhook` section EXISTS
> in the Daraz Developer Guide and was NOT rendered.** ✅ **It is the direct evidence path for `BD-159` —
> whether a notification triggers anything on its own — and reading it is a separate task.**
> **h.** 🔴 **`sales_order_reason` — the provider-side reason table — IS NOT PUBLISHED** (`DZC-047.e`).
> **i.** 🔴 **NOTHING ABOUT ORDER WRITES IS ESTABLISHED HERE.** **`SetInvoiceNumber` is named and unspecified,
> and no order write is authorised** (`DZC-044.a`).

> **`DZC-050.j` — 🔴 WHAT `§12` DELIBERATELY DOES NOT DECIDE.** **Recorded so no reader mistakes protocol
> knowledge for a business decision** (`CLAUDE.md` §5).
>
> | Question | State |
> |---|---|
> | **Whether the initial backfill is 3 months** | 🔴 **UNDECIDED** — and unanswerable while `.a` stands |
> | **Whether the poll cadence is ~5 minutes** | 🔴 **UNDECIDED.** `BD-018` records it as LEGACY behaviour and `OM §7.8` as arrival LATENCY; **`API-071.d` defers schedulers, cursors and checkpoints to their own contract, and no scheduler exists** |
> | **Whether one job fans out over all connected shops** | 🔴 **UNDECIDED.** `API-071.a` scopes a pull to ONE instance; ⚠ `PRD-189.b` ratifies one-channel-per-run for Listings sync |
> | **Whether Daraz notifications participate** | 🔴 **UNDECIDED — `BD-159` unanswered** (`.g`) |
> | **Retry behaviour after a failed import** | 🔴 **UNDECIDED — `BD-158` unanswered** |
> | **Any schema or migration** | 🔴 **NONE PROPOSED.** ⚠ **No migration number may be assigned while the `V15` production contradiction stands** ([`LISTINGS_PAUSE_HANDOFF.md`](LISTINGS_PAUSE_HANDOFF.md) §4, `OSC-060`, `DEP-070.b`) |

## `DZC-057` — What the confirmed read settled, 2026-08-23

> ⚠ **THE NUMBER IS OUT OF PHYSICAL SEQUENCE AND THAT IS CORRECT.** **This rule belongs to `§12` but was
> issued AFTER `§13` took `DZC-051`–`DZC-056`.** 🔴 **A rule number is permanent and never reused
> (`DOC-009`), so it is not renumbered to sit tidily.**
>
> ✅ **THE `/orders/get` READ WAS RUN ONCE AND ACCEPTED.** **One request for one connected Bangladesh
> shop, a 24-hour created-window, `offset` 0 and a page size of 10, returned `code` `0`.**
> ⚠ **Everything below is OBSERVED FACT from that single call, not a documented promise.**
>
> 🔴 **EXACTLY ONE REQUEST WAS MADE.** **No paging, no retry, no `/order/get`, no `/order/items/get`.**
> ✅ **NOTHING WAS IMPORTED OR WRITTEN — no order, listing, inventory, payment or operation row, and no
> migration.** ⚠ **A token refresh did not occur; the stored credential was still valid.**
>
> **a.** ✅ **`limit` IS THE PAGE-SIZE PARAMETER. `DZC-050.d` IS SETTLED.** **It was accepted with no
> `E019`.** 🔴 **`limt`, which the provider's own parameter table prints, is treated as a TYPO in that
> table — contradicted by the provider's own `E019` text — unless future evidence says otherwise.**
>
> **b.** ✅ **THE ENVELOPE CARRIED `data`, `code`, `request_id` AND `_trace_id_`.** 🔴 **`_trace_id_` IS
> THEREFORE A GENERAL ENVELOPE FIELD AND NOT A WRITE-PATH QUIRK** — **`DZC-042.d` observed it on a write
> and could not then say which; it is now seen on a read** (`DZC-042.d` widened). ⚠ **No `type` field was
> present on success here either, and its absence is not an error** (`DZC-042.e`). ✅ **`data` carried
> exactly `count`, `orders` and `countTotal`, as `DZC-045.d` records.**
>
> **c.** ✅ **THE DOCUMENTED ORDER FIELD SET IS CORRECT, AND IT IS A CEILING RATHER THAN A GUARANTEE.**
> **Thirty-two order fields came back and every one is in `DZC-045.e`; no undocumented field appeared.**
> 🔴 **`address_updated_at` IS DOCUMENTED AND WAS NOT RETURNED.** ⚠ **A mapper must therefore read
> defensively — a documented field may simply be absent, and absent is ABSENT, never an empty string or a
> zero** (`SYS-034`).
>
> **d.** ✅ **BOTH ADDRESS NODES WERE PRESENT** — `address_billing` and `address_shipping`, as `DZC-045.f`
> records.
>
> **e.** ⚠ **THE WINDOW RETURNED `countTotal` 1 AND `count` 1.** 🔴 **THIS SETTLES NOTHING ABOUT VOLUME,
> PAGING OR RETENTION.** **One order in one 24-hour window on one shop is a sample, and `DZC-050.a`'s
> unpublished retention limit is untouched by it.**
>
> **f.** 🔴 **NO SELLER VALUE WAS RECORDED, HERE OR IN THE PROBE'S OUTPUT.** **This clause carries
> outcomes, counts and field NAMES only** — **no order id, order number, buyer name, phone, address,
> price, SKU, token, signature or raw body** (`API-070`, `DZC-041` discipline).
>
> **g.** ⚠ **ONE CALL, ONE ACCOUNT, ONE SHOP, ONE WINDOW.** **The `DZC-042.g` caveat applies unchanged:
> this is an observation about a live account, not a documented promise, and a different seller or
> venture may behave differently.**
>
> **h.** 🔴 **NOTHING ELSE IS SETTLED AND NO BUSINESS DECISION IS TAKEN.** **The backfill window, the poll
> cadence, shop fan-out and retry remain OPEN at `GAP-137`; `DZC-050`'s other unpublished facts stand;
> and no migration number is proposed while the `V15` position is what
> [`LISTINGS_PAUSE_HANDOFF.md`](LISTINGS_PAUSE_HANDOFF.md) §4 and `OSC-060` describe.**

## Sources — §12

**Rendered in a headless browser on 2026-08-23. 🔴 No credential, token or seller datum was used, and no
seller API was called.**

- [Daraz Open Platform — API Reference](https://open.daraz.com/doc/api.htm) — 🔴 **THE AUTHORITY for `§12`.**
  **The `Order` category and each endpoint page** (`GetOrders`, `GetOrder`, `GetOrderItems`,
  `GetMultipleOrderItems`), **each printing the Bangladesh Service Endpoint.**
- [Daraz Open Platform — Getting Started / Developer Guide](https://open.daraz.com/doc/doc.htm) — **the
  documentation tree, in which a `Webhook` section exists and was not rendered** (`DZC-050.g`).
- [Open Platform — `/orders/get`](https://open.lazada.com/apps/doc/api?path=/orders/get) ·
  [`/order/get`](https://open.lazada.com/apps/doc/api?path=/order/get) ·
  [`/orders/items/get`](https://open.lazada.com/apps/doc/api?path=/orders/items/get) — ⚠ **CORROBORATION
  ONLY.** 🔴 **Where the two differ, DARAZ GOVERNS** (`DZC-043.a`).

⚠ **`open.daraz.com/apps/doc/api?path=…` RETURNS HTTP 404** — **Daraz does not mirror the platform's
per-API route, which is why the category had to be opened inside the Daraz reference itself.**

---

# §13 The order notification protocol — `DZC-051`–`DZC-056`

> 🔴 **RECORDED FROM THE DARAZ-PUBLISHED DEVELOPER GUIDE ON 2026-08-23, BEFORE ANY IMPLEMENTATION.**
> **Provider page last updated 2025-08-04.**
>
> 🔴 **NOTHING WAS IMPLEMENTED.** **No callback endpoint exists, no subscription was made, no App Console was
> opened, no credential or seller datum was used, and no seller API was called.**
>
> 🔴 **THIS IS A SEPARATE CONTRACT FROM `§12`, NOT AN EXTENSION OF IT.** ⚠ **`§12` is a REQUEST-RESPONSE read
> Trioloo initiates; `§13` is an INBOUND push Daraz initiates, with its own transport, authentication scheme,
> subscription flow and failure model.** ✅ **Kept apart for the same reason `§9` and `§11` are.**

## `DZC-051` — The mechanism, and that it is Daraz's own

> ✅ **DARAZ PUBLISHES A WEBHOOK, AND NAMES IT.** **The service is the *Dazop Message Service*; the feature is
> *Daraz Webhook*.** **Published definition:** *"Daraz webhook is a notification message that is sent
> automatically from the Daraz seller center to your desired interface such as an ISV or ERP system whenever a
> designated event occurs."*
>
> **a.** 🔴 **NO LAZADA DOCUMENT WAS USED FOR `§13`.** ⚠ **`§12` could take Lazada pages as corroboration
> because Daraz publishes the same REST catalogue; the webhook is named *Dazop*, and **Daraz nowhere states
> that it shares Lazada's push mechanism**.** ✅ **Corroboration was therefore withheld, not merely unavailable.**
> **b.** ✅ **THE GUIDE EXPOSES EXACTLY ONE WEBHOOK DOCUMENT** — *Daraz Webhook Onboarding*, the sole child of
> the `Webhook` node. 🔴 **There is no second page and no message-type reference** (`DZC-055.a`).

## `DZC-052` — Order messages, and the two kinds

> ✅ **ORDER EVENTS ARE CARRIED.** **Published:** *"Order msg have two types of messages : trade order message
> and reverse order message."*
>
> | Kind | Published trigger |
> |---|---|
> | **Trade order message** | *"triggered when trade order actions happens. trade order actions includes all you can do to a order except return and refund"* |
> | **Reverse order message** | *"When customer decide to return, refund, a reverse order message will be sent"* |
>
> **a.** 🔴 **THE BOUNDARY IS RETURN AND REFUND, AND IT MAPS TO NOTHING IN TRIOLOO AUTOMATICALLY.** ⚠ **A
> reverse order message is the CHANNEL's notion of return/refund; whether it corresponds to `SM-8`, `SM-9`,
> `SM-10` or to nothing is ADAPTER MAPPING and is not decided here** (`BR-005`, `BR-171`).
> **b.** 🔴 **WHETHER ORDER CREATION RAISES A TRADE ORDER MESSAGE IS NOT ESTABLISHED.** ⚠ **The phrase *"all
> you can do to a order"* does not plainly include bringing one into existence; the worked sample is a
> FULFILMENT update; and the guide's closing prose names *"the Order Fulfilment Update webhook"* specifically.**
> 🔴 **NOT PUBLISHED — DO NOT ASSUME that a webhook announces a new order** (`DZC-055.b`).

## `DZC-053` — The push: transport, payload and identity

> ✅ **AN HTTP `POST` OF JSON TO THE SELLER'S OWN CALLBACK URL**, `Content-Type: application/json`, with
> `Content-Length` and an `Authorization` header.
>
> **a.** ✅ **TOP-LEVEL FIELDS, AS PUBLISHED:** **`seller_id`** *(seller id)* · **`message_type`** *(numeric)* ·
> **`data`** *(object)* · **`timestamp`** *(timestamp of push)* · **`site`** *(site info; the sample carries
> `"daraz_pk"`)*.
>
> **b.** ✅ **`data` FIELDS IN THE PUBLISHED SAMPLE:** **`trade_order_id`** · **`buyer_id`** ·
> **`fulfillment_package_id`** · **`status`** *(sample `"DELIVERED"`, annotated "fulfilment status")* ·
> **`status_update_time`**.
> ⚠ **THIS IS ONE SAMPLE OF ONE MESSAGE TYPE, NOT A SCHEMA** (`DZC-055.d`).
>
> **c.** 🔴 **THE JOIN KEY IS ALREADY OURS.** **`trade_order_id` is annotated *"trade order id which mapping to
> the order_id in API"*.** ✅ **That is the SAME `order_id` `DZC-049.b` fixed as the external idempotency key
> — the Seller-Center-assigned identifier, and the only identifier `/order/get` and `/order/items/get`
> accept.** ⚠ **THIS IS THE SINGLE MOST LOAD-BEARING FACT IN `§13`:** **it is what lets a push-triggered read
> and a poll-triggered read be recognised as the same order rather than duplicated** (`SYS-045`, `API-024`,
> `EVA-016`).
>
> **d.** ⚠ **`fulfillment_package_id`'S MAPPING IS UNKNOWN BECAUSE THE PROVIDER'S SENTENCE IS UNFINISHED.**
> **The published annotation reads *"fulfilment id which maps to (NEED HELP HERE)"*.** 🔴 **Recorded as a
> DEFECT IN THE PROVIDER'S OWN DOCUMENTATION, not paraphrased into a guess** (`DZC-055.k`).

## `DZC-054` — Authentication, acknowledgement and retry

> **a.** ✅ **THE `Authorization` HEADER IS THE SIGNATURE, AND IT IS HEX-ENCODED HMAC-SHA256, LOWER-CASE.**
> **Published construction:** **`Base = {app_key} + {message_body_you_received}`**, **`Secret = {app_secret}`**,
> **`Authorization = HEX_ENCODE(HMAC-SHA256(Base, Secret))`**. **The provider's own helper lower-cases the hex
> output.**
> **a.i.** 🔴 **THE BASE IS THE RAW RECEIVED BODY, CONCATENATED AFTER THE APP KEY.** ⚠ **It is NOT the
> `§5` request-signing scheme, which sorts and concatenates parameters against an API path — the two must not
> be conflated.**
> **a.ii.** 🔴 **VERIFICATION IS THE ONLY ORIGIN CHECK OFFERED.** **Published FAQ:** *"Dazop recommends to use
> signature on authorization header to check the origin of pushes. No further supports on IPs from Dazop."*
> ✅ **IP ALLOW-LISTING IS EXPLICITLY UNSUPPORTED.**
>
> **b.** 🔴 **THE ACKNOWLEDGEMENT BUDGET IS 500 MILLISECONDS.** **Published:** *"You need to ack with Http
> status code 200 with in 500ms."* ⚠ **A receiver that does real work before answering will miss it.**
>
> **c.** ✅ **THE RETRY LADDER IS PUBLISHED IN FULL.** *"If you fail to do 1, server will retry sending the
> message after 30 mins. If retry fails again, server will retry in another 30 mins. If you fail more than 12
> times or you successfully do 1 before 12 times, server will stop retrying."*
> **c.i.** ⚠ **THE CONSEQUENCE IS A WORST-CASE DELIVERY TAIL OF ABOUT SIX HOURS, AND THEN SILENCE.** 🔴 **After
> the twelfth failure the message is ABANDONED and Daraz never sends it again.**
> **c.ii.** 🔴 **A WEBHOOK IS THEREFORE NOT A DELIVERY GUARANTEE.** ✅ **This is the protocol fact from which
> `DZC-056.c` follows.**
>
> **d.** 🔴 **PUSHES STOP WHEN THE SELLER AUTHORISATION LAPSES.** **Published FAQ:** *"Server will check the
> authorization between sellerId and appkey. If the auth is revoked or expired, server will abort the
> pushing."* ⚠ **A shop in `REAUTH_REQUIRED` silently stops producing notifications** — **the same
> authorisation state `§3`/`§4` and `SCS-`/`API-069` already govern.**

## `DZC-055` — Subscription, and what it requires of Trioloo

> ✅ **FOUR PUBLISHED STEPS.**
>
> **1.** ✅ **A CALLBACK URL WITH A REAL CERTIFICATE.** *"It must be a https with CA certs… Self-signed certs
> are not acceptable. Certs must be OV or EV. DV is not working."* 🔴 **A Let's-Encrypt-class DV certificate
> is explicitly rejected.** ⚠ **Trioloo's production origin terminates behind Cloudflare** (`DEP-001`,
> `DEP-020`); **whether the presented certificate satisfies OV/EV is a DEPLOYMENT question this document does
> not answer and must not assume.**
> **2.** ✅ **IMPLEMENT THE PUSH CONTRACT** — `DZC-053`, `DZC-054`.
> **3.** ✅ **VERIFY IN THE APP CONSOLE.** **Sign in at `open.daraz.com`, open the *Message Service* tab, enter
> the callback address and click *Verify*, which *"will automatically send a test message to the filled
> address"*.**
> **4.** ✅ **SELECT THE MESSAGE TYPES AND SAVE.** **Deliveries are then visible in the *API Push Log* tab.**
>
> 🔴 **SUBSCRIPTION IS A CONSOLE ACT BY A SIGNED-IN HUMAN, NOT AN API CALL.** ⚠ **It is therefore an
> operational, credentialed step outside anything this contract can perform, and it is per seller account.**
> ✅ **`API-071.a`'s one-instance scoping holds naturally: a subscription belongs to one seller's app
> authorisation.**

> **`DZC-055.z` — 🔴 WHAT IS NOT PUBLISHED. UNSTATED IS NOT THE SAME AS ABSENT, AND NEITHER IS PERMITTED.**
>
> **a.** 🔴 **THE `message_type` ENUMERATION IS NOT PUBLISHED ANYWHERE.** **The sample carries `14` and a code
> comment carries `0`; no list maps a number to a meaning.** ⚠ **The subscribable set is visible only inside
> the App Console, which requires a sign-in.** 🔴 **NOT PUBLISHED — DO NOT ASSUME a mapping.**
> **b.** 🔴 **WHICH MESSAGE TYPE, IF ANY, COVERS ORDER CREATION** (`DZC-052.b`).
> **c.** 🔴 **THE FULL `status` ENUMERATION.** **Only `DELIVERED` appears.** ⚠ **It is a FULFILMENT status and
> is not the `§12` order status set of `DZC-045.c`.**
> **d.** 🔴 **THE COMPLETE `data` SHAPE PER MESSAGE TYPE.** **One sample is published; no per-type schema is.**
> **e.** 🔴 **HOW A REVERSE ORDER PAYLOAD DIFFERS from a trade order payload.**
> **f.** 🔴 **ORDERING GUARANTEES.** **Nothing states that pushes arrive in the order events occurred.**
> **g.** 🔴 **DE-DUPLICATION GUARANTEES ACROSS PUSHES.** **Nothing states a message is delivered at most once.**
> ⚠ **The retry ladder makes REPEAT delivery an expected condition** (`DZC-054.c`).
> **h.** 🔴 **ANY LATENCY TARGET FOR A SUCCESSFUL PUSH.** **The 500 ms budget binds the RECEIVER, not Daraz.**
> **i.** 🔴 **ANY RATE, VOLUME OR BURST CEILING.**
> **j.** 🔴 **WHETHER THE WEBHOOK IS AVAILABLE ON THE BANGLADESH VENTURE.** ⚠ **The only published sample
> carries `"site": "daraz_pk"`, and no per-venture availability table appears** — **unlike `§12`, where every
> order page printed the Bangladesh endpoint.** 🔴 **This is a first-order unknown, not a detail.**
> **k.** 🔴 **`fulfillment_package_id`'S MAPPING** (`DZC-053.d`).

## `DZC-056` — What follows for implementation, and what does not

> ✅ **STATED AS CONSEQUENCE OF THE PROTOCOL. 🔴 NONE OF IT RATIFIES A BUSINESS DECISION.**
>
> **a.** 🔴 **A WEBHOOK CANNOT REPLACE THE ORDER READ, BECAUSE THE PAYLOAD IS NOT THE ORDER.** **The published
> sample carries identifiers, a fulfilment status and two timestamps — no lines, no buyer, no address, no
> money, no channel content.** ✅ **Anything acted on must still be read through `§12`.**
>
> **b.** ✅ **A PUSH IS A TRIGGER, AND THE READ IS THE TRUTH.** **A webhook-driven import calls `/order/get`
> and `/order/items/get`** (`DZC-046`, `DZC-047`) **for the `order_id` the push named** (`DZC-053.c`).
>
> **c.** 🔴 **PERIODIC RECONCILIATION REMAINS NECESSARY REGARDLESS.** ⚠ **Three published facts force it, and
> each alone would be enough:** **a message abandoned after twelve failures is never resent** (`DZC-054.c.i`) ·
> **pushes stop entirely while an authorisation is revoked or expired** (`DZC-054.d`) · **no ordering or
> at-most-once guarantee exists** (`DZC-055.z.f`, `.g`). 🔴 **"WEBHOOK INSTEAD OF POLLING" IS THEREFORE NOT
> AN AVAILABLE OPTION**, and `§12`'s incremental read stays the reconciling mechanism.
>
> **d.** 🔴 **BOTH PATHS MUST DEDUPLICATE ON `order_id`.** **A push-triggered read and a poll-triggered read
> can address the same order, and the retry ladder can deliver one message repeatedly.** ✅ **`DZC-049.b`'s key
> serves both, which is what `SYS-045`, `API-024` and `EVA-016` require.**
>
> **e.** 🔴 **THE WEBHOOK DOES NOT SETTLE THE CADENCE QUESTION, AND MUST NOT BE READ AS SETTLING IT.**
> ⚠ **Because `c` keeps a reconciling read necessary, discovering a webhook REMOVES no scheduler decision.**
> **`BD-018`'s ~5 minutes remains a LEGACY observation and `OM §7.8` remains an arrival-latency statement;
> `API-071.d` still defers schedulers, cursors and checkpoints to their own contract.**
>
> **f.** ⚠ **`BD-159` IS PARTIALLY ANSWERED ON THE PROVIDER SIDE, AND ONLY THERE.** ✅ **A notification
> mechanism genuinely exists and carries order messages, so the question's premise is sound.** 🔴 **Whether a
> push announces a NEW order is unestablished** (`DZC-052.b`), **and what the LEGACY Trioloo system actually
> does is a discovery question no provider document can answer.**

> **`DZC-056.g` — 🔴 WHAT `§13` DELIBERATELY DOES NOT DECIDE.**
>
> | Question | State |
> |---|---|
> | **Whether Trioloo subscribes to the webhook at all** | 🔴 **UNDECIDED — a business decision** |
> | **Which message types to subscribe** | 🔴 **UNDECIDED, and currently unknowable** (`DZC-055.z.a`) |
> | **Whether a callback endpoint is built** | 🔴 **NOT AUTHORISED. No endpoint, route or handler is created by this section** |
> | **The poll cadence** | 🔴 **UNDECIDED** (`.e`) |
> | **Backfill window · shop fan-out · retry-and-recovery policy** | 🔴 **UNDECIDED — `GAP-137`'s open list is unchanged** |
> | **Any schema or migration** | 🔴 **NONE PROPOSED.** ⚠ **No migration number may be assigned while the `V15` production contradiction stands** ([`LISTINGS_PAUSE_HANDOFF.md`](LISTINGS_PAUSE_HANDOFF.md) §4, `OSC-060`, `DEP-070.b`) |

## Sources — §13

**Rendered in a headless browser on 2026-08-23. 🔴 No credential, token, App Console session or seller datum
was used, and no seller API was called.**

- [Daraz Open Platform — Developer Guide](https://open.daraz.com/doc/doc.htm) → **Webhook** → **Daraz Webhook
  Onboarding** — 🔴 **THE SOLE AUTHORITY for `§13`.** **Provider page last updated 2025-08-04.** ✅ **It is the
  only webhook document the guide exposes.**

🔴 **NO LAZADA SOURCE WAS USED.** ⚠ **Daraz names its own service *Dazop Message Service* and does not state
that it shares Lazada's push mechanism, so the corroboration licence `DZC-043.a` grants for `§12` does NOT
extend to `§13`** (`DZC-051.a`).

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.13.0** | **2026-08-23** | ✅ **`DZC-057` ADDED — THE `/orders/get` READ WAS RUN ONCE AND ACCEPTED (`code` `0`).** **One request for one connected Bangladesh shop over a 24-hour created-window, `offset` 0, page size 10 — no paging, no retry, no `/order/get`, no `/order/items/get`, nothing imported and nothing written.** ✅ **`DZC-050.d` IS SETTLED: the gateway accepted `limit` with no `E019`, so `limt` — which the provider's OWN parameter table prints and its OWN `E019` text contradicts — is treated as a typo unless future evidence says otherwise.** 🔴 **`DZC-042.d` WIDENED: `_trace_id_` appeared on a READ as well as a write, so it is a GENERAL envelope field rather than a write-path quirk, and the tolerate-unknown-fields obligation applies on every path.** ✅ **`DZC-042.e` corroborated — no `type` field on success here either.** ✅ **`DZC-045.e` CONFIRMED AGAINST A LIVE RESPONSE: thirty-two order fields returned and every one is documented, with no undocumented field appearing.** 🔴 **THE FIELD TABLE IS A CEILING, NOT A GUARANTEE — `address_updated_at` is documented and was NOT returned, so a mapper reads defensively and absent stays ABSENT (`SYS-034`).** ⚠ **`countTotal` 1 and `count` 1 settle NOTHING about volume, paging or retention; `DZC-050.a`'s unpublished retention limit is untouched.** ⚠ **One call, one account, one shop, one window — the `DZC-042.g` caveat applies unchanged.** 🔴 **No seller value recorded anywhere: outcomes, counts and field NAMES only.** 🔴 **No business decision taken — backfill window, cadence, fan-out and retry stay OPEN at `GAP-137`, and no migration number is proposed.** ⚠ **The number is out of physical sequence because `§13` had already taken `DZC-051`–`DZC-056`; `DOC-009` forbids renumbering.** |
| **1.12.0** | **2026-08-23** | ✅ **§13 ADDED — `DZC-051`–`DZC-056`, THE ORDER NOTIFICATION PROTOCOL, RECORDED FROM THE DARAZ DEVELOPER GUIDE BEFORE ANY IMPLEMENTATION.** ✅ **Daraz publishes a webhook — the *Dazop Message Service* — carrying ORDER MESSAGES in two kinds: trade order (every order action except return and refund) and reverse order (return and refund).** ✅ **The push is a JSON `POST` to a seller-supplied HTTPS callback carrying `seller_id`, `message_type`, `data`, `timestamp` and `site`; authentication is a hex lower-case HMAC-SHA256 `Authorization` header over `app_key` + the raw body, and IP allow-listing is explicitly unsupported.** 🔴 **THE JOIN KEY IS ALREADY OURS: `trade_order_id` is published as mapping to the API's `order_id`, which `DZC-049.b` had already fixed as the external idempotency key — that is what lets a pushed and a polled read be recognised as the same order.** ✅ **Acknowledgement is HTTP 200 within 500 ms; retries are 30 minutes apart and STOP after more than twelve, so a message can be abandoned after a ~6-hour tail, and pushes abort entirely while a seller authorisation is revoked or expired.** ✅ **Subscription is a CONSOLE act by a signed-in human — an OV or EV certificate is required and DV is explicitly rejected.** 🔴 **THE DECISIVE CONSEQUENCE: the payload is NOT the order — no lines, buyer, address or money — so a webhook cannot replace `§12`'s read, and abandonment, authorisation lapse and the absence of ordering or at-most-once guarantees each independently force PERIODIC RECONCILIATION. "Webhook instead of polling" is not an available option, and the cadence question is therefore NOT settled by this discovery.** 🔴 **Eleven facts recorded NOT PUBLISHED, including the entire `message_type` enumeration, which type covers order CREATION, and whether the webhook is available on the BANGLADESH venture at all — the only published sample carries `daraz_pk`.** ⚠ **`BD-159` is partially answered on the provider side only: a mechanism exists, but the creation trigger is unestablished and legacy Trioloo behaviour is a discovery question no provider document can answer.** 🔴 **No Lazada source was used — Daraz names its own service and does not state that it shares Lazada's push mechanism, so `§12`'s corroboration licence does not extend here.** ⚠ **Documentation only — nothing implemented, no callback endpoint, no subscription, no App Console, no credential, no seller API call.** |
| **1.11.0** | **2026-08-23** | ✅ **§12 ADDED — `DZC-043`–`DZC-050`, THE ORDER READ PROTOCOL, RECORDED FROM THE DARAZ-PUBLISHED REFERENCE BEFORE ANY IMPLEMENTATION.** 🔴 **THE DARAZ TREE IS THE AUTHORITY AND IS NOT THE LAZADA SET** — **Lazada publishes `GetOVOOrders` and `OrderCancelValidate` which Daraz does not; Daraz publishes `GetOrderLogisticDetail` and `GetOrderTrace` which Lazada does not.** ✅ **This closes the equivalence doubt `GAP-137` raised: the order paths are read from Daraz's own reference, not inferred from a product migration guide, and every order page prints the Bangladesh endpoint.** ✅ **Eight endpoints registered; four READS specified — `/orders/get`, `/order/get`, `/order/items/get`, `/orders/items/get`.** 🔴 **`SetInvoiceNumber` is the category's only WRITE, is named and unspecified, and NOTHING here authorises an order write.** ✅ **`/orders/get` records the conditional rule that one of `update_after` / `created_after` is mandatory, offset paging capped at 100, `created_at`/`updated_at` sorting, the DARAZ status set (`unpaid, pending, canceled, ready_to_ship, delivered, returned, shipped, failed`, with `topack`/`toship` published for white-list sellers only), the Daraz-only `mp3_Order`, the `data{countTotal,count,orders[]}` envelope, the order, buyer, billing/shipping-address and payment fields, and six error codes.** ✅ **The item fields, five published enumerations and four batch error codes are recorded from `/order/items/get` and `/orders/items/get`.** ✅ **`DZC-049` records what the protocol SUPPORTS — per-shop scoping by construction, `order_id` as the external idempotency key, incremental reading by `update_after` + `updated_at`, and 🔴 that with NO opaque cursor a checkpoint can only be a timestamp watermark that must be OVERLAPPED and deduplicated by `order_id`.** 🔴 **`DZC-050` records NINE things NOT PUBLISHED — no retention limit, no rate limit or throttle signal, no `E038` batch maximum, the provider's own `limt`/`limit` contradiction, unstated `update_after` inclusivity and timezone, unknowable white-list membership, unrendered webhook behaviour, the unpublished `sales_order_reason` table, and nothing about order writes.** 🔴 **NO BUSINESS DECISION IS RATIFIED: backfill window, poll cadence, shop fan-out, notification participation and retry all stay OPEN, and no migration number is proposed while the `V15` contradiction stands.** ⚠ **Documentation only — no code, no seller API call, no credential, no seller data.** |
| **1.10.0** | **2026-08-21** | ✅ **`DZC-042` ADDED — THE LIVE PROBE WAS RUN ONCE AND ACCEPTED (`code` `0`).** ✅ **`ItemId` + `SellerSku` addresses a SKU for price and quantity — `DZC-039.e` answered YES, so price and stock need no `SkuId` and no schema change; deactivate and remove still do.** ✅ **A plain `<Quantity>` is accepted — `DZC-039.b` answered YES for this seller, with no `WarehouseCode`.** 🔴 **`DZC-035.e` AMENDED — the live success envelope carries `code`, `request_id` and `_trace_id_` and NO `data` node at all; `code` `0` is success whether or not `data` is present, and an envelope reader must tolerate unknown fields.** ⚠ **Observed from ONE call on ONE account, not a documented promise; `901` remains untested.** |
| **1.9.0** | **2026-08-21** | ✅ **`DZC-041` ADDED — THE CONTROLLED SAME-VALUE PROBE IS BUILT AND HAS NOT BEEN RUN.** **One server-side command sends one same-value price and quantity update for one listing, so `DZC-039.b` and `DZC-039.e` can be answered by asking.** 🔴 **Same value, therefore no business change — the figures come from the stored reported side, and an unreadable figure is a refusal rather than a guess.** 🔴 **Gated twice: a command name selects it and a separate confirmation authorises it; a dry run prints the payload and contacts nothing.** 🔴 **It is not `pushUpdate` — it writes nothing to Trioloo and its scoped context names no bean that could mutate a listing, product or inventory row.** 🔴 **Promotion is absent by name and `<Quantity>` is sent plain, because that is the question.** ✅ **It reports metadata only, never a value, a token, a signature or the provider's own message.** ⚠ **A transport failure is reported as an UNKNOWN outcome, never as a failure to write.** |
| **1.8.0** | **2026-08-21** | ✅ **§11 ADDED — `DZC-033`–`DZC-040`, THE LISTING WRITE PROTOCOL, RECORDED FROM THE OFFICIAL REFERENCE BEFORE ANY IMPLEMENTATION.** **Seven published write paths, with the Bangladesh base and the read signing scheme unchanged.** 🔴 **The body parameter name is NOT uniform — `payload`, `apiRequestBody`, `sku_id_list` across five endpoints — and the API path is part of the signed string.** 🔴 **There is no `/product/activate`: deactivation is one-way as published.** 🔴 **Trioloo persists `SellerSku` and `ItemId` only, so deactivate and remove — which need `SkuId` — are blocked on a READ change, not on the write protocol.** ✅ **The write side CORROBORATES `PRD-199` (`Price` vs `SalePrice` + window) and `DZC-026` (`name` is the title; `name_en` does not appear in the write payload at all) and RATIFIES neither.** 🔴 **`/product/update` publishes no `ItemId` in its sample and gives no rule for omitted attributes, so a content push is unsafe at any size.** ✅ **Recommended first slice: `/product/price_quantity/update` restricted to price and stock — addressable today, readable back, no whole-object hazard — with two questions answerable in one controlled call.** ⚠ **Documentation only. No seller API was called; `pushUpdate` still refuses and Daraz still declares no field writable.** |
| **1.7.0** | **2026-08-19** | ✅ **§10 ADDED — `DZC-032`, THE PRODUCT REVIEW PROTOCOL, RECORDED FROM THE OFFICIAL REFERENCE BEFORE ANY ADAPTER CODE EXISTS.** **Daraz publishes a seller-side Product Review API of exactly three endpoints — `/review/seller/history/list`, `/review/seller/list/v2` and `/review/seller/reply/add` — on the same Bangladesh base and the same signing as the read half.** 🔴 **It is a TWO-STEP read: ids first, details second, ten ids per call.** 🔴 **`item_id` is REQUIRED, so every read is per listing — and it is the same identifier `DZC-026` maps to `external_listing_id`; the detail response carries `product_id` and a `ratings` object as the join and the star value.** 🔴 **TWO HARD WINDOWS DEFINE THE FEATURE: only 90 days of review history exists, and only 7 days may be requested at once — so a full 90-day picture for ONE listing costs thirteen windowed calls, and a LIFETIME review total cannot be obtained from this API at all.** 🔴 **A review count shown in Trioloo is therefore a 90-DAY count and must say so, because Seller Centre shows a lifetime total.** 🔴 **PROVEN ABSENT: product views, wishlist/favourites and cart have NO endpoint anywhere in the reference — there is no Data, Analytics, Traffic, Report or Dashboard category — and no daily breakdown of any metric exists.** ⚠ **`GetSellerMetricsById` (`/seller/metrics/get`) is SELLER-level and is not a per-product substitute.** ✅ **Documentation only — nothing implemented, no adapter method, no persistence, no screen. No live seller API was called.** |
| **1.6.1** | **2026-08-18** | ⚠ **`DZC-031.h` ADDED — GENERIC ATTRIBUTE VALUES ARE BOUNDED BY TRIOLOO'S OWN PERSISTENCE, LEARNED FROM THE FIRST LIVE PULL.** **`channel_listing_attribute` stores `attribute_key varchar(160)` and `reported_value varchar(1024)`; the first discovery against a real seller failed with *value too long for type character varying(1024)* and rolled the whole catalogue back.** 🔴 **`name` and `description` are no longer duplicated into the generic attributes — they already own dedicated columns, and `reported_description` is unbounded `text`.** 🔴 **An over-long value keeps its key and is recorded `reported_readable = false` with NO value rather than truncated, because a truncated reported value would read as permanently DIVERGED under `PRD-181`.** ⚠ **An attribute whose KEY will not fit is dropped, since the key is its identity.** ✅ **No column widened, no migration taken — that is a `DB-`/`PRD-` decision, not a mapping one.** ✅ **Mapper-side fix only; no endpoint, parameter or response field changed.** |
| **1.6.0** | **2026-08-18** | ✅ **`DZC-031` ADDED — REPORTED STOCK IS SKU `quantity`, SETTLED FROM THE FIRST LIVE PROBE.** **The live response carried `quantity`, `Available`, `channelInventories`, `multiWarehouseInventories` and `fblWarehouseInventories` at SKU level; the last three appear ZERO times in the `/products/get` reference.** ✅ **`quantity` is confirmed by symmetry with the documented write API `/product/price_quantity/update`, which sets *price and quantity* — the same pair the read returns.** 🔴 **The three containers are NOT MAPPED, no warehouse aggregation is inferred, `Available` is not mapped, and the `options=1` extras are not requested.** ⚠ **Records that `quantity`'s meaning for a Global Plus or FBL listing is NOT PUBLISHED — which does not block reporting it, because `API-062.c` makes the adapter an observer and `PRD-112`/`PRD-126` keep Published Marketplace Stock a manually controlled ERP figure.** 🔴 **No provider value, token or secret is recorded — field names and node presence only.** ✅ **No code change: the mapper already reads `quantity` and already ignores the containers.** |
| **1.5.0** | **2026-08-18** | ✅ **§9 CLARIFIED BY THE FIRST IMPLEMENTATION — THREE POINTS THE PROTOCOL READING COULD NOT HAVE SETTLED ON PAPER.** 🔴 **`DZC-028.e` — the scroll value is written with `Z` rather than a numeric offset, because a literal `+` in a query value is decoded as a SPACE by many servers while the signature spans the raw value, producing a signature error that is not a signing defect.** ✅ **`DZC-028.f` — a full page that shares one update time, or carries none, cannot scroll and reports `complete=false` rather than looping or presenting a partial catalogue as complete.** ⚠ **`DZC-029.d`/`.e` — POST is no longer the obstacle for `readListing`; the unpublished CONTENT TYPE is, so it refuses rather than guessing a header, and refuses rather than returning empty, which would falsely tell the operator the channel did not return the listing.** 🔴 **No endpoint, parameter or response field was invented.** |
| **1.4.0** | **2026-08-18** | ✅ **§9 ADDED — THE LISTING READ CONTRACT, `DZC-020`–`DZC-030`, RECORDED BEFORE ANY ADAPTER CODE EXISTS.** **`GetProducts` → `/products/get` (`GET`) from Daraz's own migration guide, with parameters, envelope, product/SKU/attribute field lists and the published error codes including the `901` per-second QPS throttle; `/product/item/get` (`POST`, `item_id` required, `seller_sku` deprecated since 2023-11-15) for the single read.** ✅ **`DZC-026` maps every `ReportedListingSnapshot` and `ReportedSkuSnapshot` member to a documented source or an explicit `readable=false`** — **`SellerSku` is the channel SKU, `ShopSku`/`SkuId` are not, and `variationLabel` is NOT PUBLISHED.** 🔴 **`DZC-027` forbids writing intent, creating mappings, deciding divergence, or treating absence as zero.** ✅ **`DZC-028` scopes the first gate to `filter=live` with date scrolling, since `offset` is deprecated and capped at 10000.** ⚠ **`DZC-029` records that `readListing`'s endpoint is a `POST` while `DarazTransport` is `GET`-only.** ✅ **`DZC-030` sets the refresh contract and a conservative on-demand default; the safety margin remains a reviewer decision.** 🔴 **Four value formats recorded as NOT PUBLISHED rather than guessed. No secret or token value appears.** |
| **1.3.0** | **2026-08-17** | 🔴 **`DZC-010` AMENDED — THE CONTRACT DESCRIBED ONLY ONE OF TWO REAL RESPONSE SHAPES.** ⚠ **The documented `country_user_info[]` is what a CROSS-BORDER seller receives; a live Bangladesh LOCAL seller returned NO such array, one flat `user_info` object, and the venture named only at the top level — so every local seller was refused.** ✅ **§6.1 adds the local branch: `country_user_info[].seller_id` remains the documented cross-border path and still wins when present; `user_info.seller_id` is the observed local path, GUARDED BY the top-level `country` being Bangladesh.** 🔴 **The rejection of `account`/email as binding identity is preserved in full, and extended to `user_id`, `short_code`, `country`, `account_platform`, `code`, `request_id` and `_trace_id_`.** ⚠ **A populated cross-border array with no Bangladesh entry is NOT rescued by `user_info`.** 🔴 **Live evidence is recorded as FIELD NAMES ONLY — no secret or response value appears in this document.** |
| **1.2.0** | **2026-08-17** | 🔴 **`DZC-011` CORRECTED — IT WAS OVER-BROAD.** **v1.1.0 mapped ANY non-zero response from `/auth/token/refresh` to `REAUTH_REQUIRED`.** ⚠ **That would have told an operator to go and disturb a seller whose authorisation was perfectly healthy, merely because the refresh call was rate-limited, mis-signed, clock-skewed or hit a provider outage.** ✅ **`REAUTH_REQUIRED` now requires evidence about the CREDENTIAL itself — invalid, expired or revoked; everything else, including any unclassified non-zero code, is `ERROR`.** 🔴 **THE ENDPOINT INVOLVED PROVES NOTHING; ONLY EVIDENCE ABOUT THE CREDENTIAL DOES.** ⚠ **No new error code was invented to support this — the rule is a classification default, not a claim about Daraz’s catalogue.** |
| **1.1.0** | **2026-08-17** | ✅ **CONTRACT COMPLETED.** **Bangladesh REST base explicitly confirmed from the per-region Service Endpoints table; timestamp skew ±7200s; `sign_method=sha256` resolved from the official sample's branch rather than from digest length.** 🔴 **`DZC-010` DECIDES THE BINDING IDENTITY — the Bangladesh `country_user_info[].seller_id` from the token response — BECAUSE `/seller/get` PUBLISHES NO RESPONSE SCHEMA**, and guessing a field on the one fact every reauthorisation is tested against would mis-bind shops silently. 🔴 **`DZC-011` maps provider failures from DOCUMENTED TIME FACTS and defaults to `ERROR`, because Daraz publishes no auth error codes; `REAUTH_REQUIRED` is reached only on a documented condition.** ⚠ **Unpublished items are listed with fail-safe fallbacks to confirm at first live authorisation.** 🔴 **No secret value appears in this document.** |
| **1.0.0** | **2026-08-17** | **Initial record of the official Daraz protocol facts** — hosts, OAuth `code for token` flow with round-tripping `state`, `/auth/token/create` and `/auth/token/refresh`, independent token lifetimes, the HMAC-SHA256 canonical-string signing contract, `/seller/get`, and the response envelope. ⚠ **Records explicitly what is NOT yet established**, so implementation cannot mistake this for a complete contract. 🔴 **No secret value appears in this document.** |
