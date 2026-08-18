# Daraz Provider Contract — implementation reference

**Owner:** Trioloo Integration · **Module:** Integration · **Status:** ✅ **IMPLEMENTATION-READY TECHNICAL REFERENCE** · ⚠ **NOT CANONICAL ARCHITECTURE**
**Version:** 1.6.0 · **Established:** 2026-08-17 · **Amended:** 2026-08-18 (`DZC-031` — reported stock source) · **Amended:** 2026-08-18 (§9 clarified from first implementation) · **Amended:** 2026-08-18 (§9 — listing read, `DZC-020`–`DZC-030`) · **Amended:** 2026-08-17 (`DZC-010` local-seller branch) · **Source:** Daraz / Lazada Open Platform official documentation, plus one live production observation

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
| `attributes` | `attributes` object | ✅ Reported as name→value text. ⚠ Category-dependent; never validated against an invented schema |
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

## Version history

| Version | Date | Change |
|---|---|---|
| **1.6.0** | **2026-08-18** | ✅ **`DZC-031` ADDED — REPORTED STOCK IS SKU `quantity`, SETTLED FROM THE FIRST LIVE PROBE.** **The live response carried `quantity`, `Available`, `channelInventories`, `multiWarehouseInventories` and `fblWarehouseInventories` at SKU level; the last three appear ZERO times in the `/products/get` reference.** ✅ **`quantity` is confirmed by symmetry with the documented write API `/product/price_quantity/update`, which sets *price and quantity* — the same pair the read returns.** 🔴 **The three containers are NOT MAPPED, no warehouse aggregation is inferred, `Available` is not mapped, and the `options=1` extras are not requested.** ⚠ **Records that `quantity`'s meaning for a Global Plus or FBL listing is NOT PUBLISHED — which does not block reporting it, because `API-062.c` makes the adapter an observer and `PRD-112`/`PRD-126` keep Published Marketplace Stock a manually controlled ERP figure.** 🔴 **No provider value, token or secret is recorded — field names and node presence only.** ✅ **No code change: the mapper already reads `quantity` and already ignores the containers.** |
| **1.5.0** | **2026-08-18** | ✅ **§9 CLARIFIED BY THE FIRST IMPLEMENTATION — THREE POINTS THE PROTOCOL READING COULD NOT HAVE SETTLED ON PAPER.** 🔴 **`DZC-028.e` — the scroll value is written with `Z` rather than a numeric offset, because a literal `+` in a query value is decoded as a SPACE by many servers while the signature spans the raw value, producing a signature error that is not a signing defect.** ✅ **`DZC-028.f` — a full page that shares one update time, or carries none, cannot scroll and reports `complete=false` rather than looping or presenting a partial catalogue as complete.** ⚠ **`DZC-029.d`/`.e` — POST is no longer the obstacle for `readListing`; the unpublished CONTENT TYPE is, so it refuses rather than guessing a header, and refuses rather than returning empty, which would falsely tell the operator the channel did not return the listing.** 🔴 **No endpoint, parameter or response field was invented.** |
| **1.4.0** | **2026-08-18** | ✅ **§9 ADDED — THE LISTING READ CONTRACT, `DZC-020`–`DZC-030`, RECORDED BEFORE ANY ADAPTER CODE EXISTS.** **`GetProducts` → `/products/get` (`GET`) from Daraz's own migration guide, with parameters, envelope, product/SKU/attribute field lists and the published error codes including the `901` per-second QPS throttle; `/product/item/get` (`POST`, `item_id` required, `seller_sku` deprecated since 2023-11-15) for the single read.** ✅ **`DZC-026` maps every `ReportedListingSnapshot` and `ReportedSkuSnapshot` member to a documented source or an explicit `readable=false`** — **`SellerSku` is the channel SKU, `ShopSku`/`SkuId` are not, and `variationLabel` is NOT PUBLISHED.** 🔴 **`DZC-027` forbids writing intent, creating mappings, deciding divergence, or treating absence as zero.** ✅ **`DZC-028` scopes the first gate to `filter=live` with date scrolling, since `offset` is deprecated and capped at 10000.** ⚠ **`DZC-029` records that `readListing`'s endpoint is a `POST` while `DarazTransport` is `GET`-only.** ✅ **`DZC-030` sets the refresh contract and a conservative on-demand default; the safety margin remains a reviewer decision.** 🔴 **Four value formats recorded as NOT PUBLISHED rather than guessed. No secret or token value appears.** |
| **1.3.0** | **2026-08-17** | 🔴 **`DZC-010` AMENDED — THE CONTRACT DESCRIBED ONLY ONE OF TWO REAL RESPONSE SHAPES.** ⚠ **The documented `country_user_info[]` is what a CROSS-BORDER seller receives; a live Bangladesh LOCAL seller returned NO such array, one flat `user_info` object, and the venture named only at the top level — so every local seller was refused.** ✅ **§6.1 adds the local branch: `country_user_info[].seller_id` remains the documented cross-border path and still wins when present; `user_info.seller_id` is the observed local path, GUARDED BY the top-level `country` being Bangladesh.** 🔴 **The rejection of `account`/email as binding identity is preserved in full, and extended to `user_id`, `short_code`, `country`, `account_platform`, `code`, `request_id` and `_trace_id_`.** ⚠ **A populated cross-border array with no Bangladesh entry is NOT rescued by `user_info`.** 🔴 **Live evidence is recorded as FIELD NAMES ONLY — no secret or response value appears in this document.** |
| **1.2.0** | **2026-08-17** | 🔴 **`DZC-011` CORRECTED — IT WAS OVER-BROAD.** **v1.1.0 mapped ANY non-zero response from `/auth/token/refresh` to `REAUTH_REQUIRED`.** ⚠ **That would have told an operator to go and disturb a seller whose authorisation was perfectly healthy, merely because the refresh call was rate-limited, mis-signed, clock-skewed or hit a provider outage.** ✅ **`REAUTH_REQUIRED` now requires evidence about the CREDENTIAL itself — invalid, expired or revoked; everything else, including any unclassified non-zero code, is `ERROR`.** 🔴 **THE ENDPOINT INVOLVED PROVES NOTHING; ONLY EVIDENCE ABOUT THE CREDENTIAL DOES.** ⚠ **No new error code was invented to support this — the rule is a classification default, not a claim about Daraz’s catalogue.** |
| **1.1.0** | **2026-08-17** | ✅ **CONTRACT COMPLETED.** **Bangladesh REST base explicitly confirmed from the per-region Service Endpoints table; timestamp skew ±7200s; `sign_method=sha256` resolved from the official sample's branch rather than from digest length.** 🔴 **`DZC-010` DECIDES THE BINDING IDENTITY — the Bangladesh `country_user_info[].seller_id` from the token response — BECAUSE `/seller/get` PUBLISHES NO RESPONSE SCHEMA**, and guessing a field on the one fact every reauthorisation is tested against would mis-bind shops silently. 🔴 **`DZC-011` maps provider failures from DOCUMENTED TIME FACTS and defaults to `ERROR`, because Daraz publishes no auth error codes; `REAUTH_REQUIRED` is reached only on a documented condition.** ⚠ **Unpublished items are listed with fail-safe fallbacks to confirm at first live authorisation.** 🔴 **No secret value appears in this document.** |
| **1.0.0** | **2026-08-17** | **Initial record of the official Daraz protocol facts** — hosts, OAuth `code for token` flow with round-tripping `state`, `/auth/token/create` and `/auth/token/refresh`, independent token lifetimes, the HMAC-SHA256 canonical-string signing contract, `/seller/get`, and the response envelope. ⚠ **Records explicitly what is NOT yet established**, so implementation cannot mistake this for a complete contract. 🔴 **No secret value appears in this document.** |
