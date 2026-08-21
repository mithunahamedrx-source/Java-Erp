# Daraz Provider Contract — implementation reference

**Owner:** Trioloo Integration · **Module:** Integration · **Status:** ✅ **IMPLEMENTATION-READY TECHNICAL REFERENCE** · ⚠ **NOT CANONICAL ARCHITECTURE**
**Version:** 1.9.0 · **Established:** 2026-08-17 · **Amended:** 2026-08-21 (`DZC-041` — the controlled same-value probe, built and NOT run) · **Amended:** 2026-08-21 (`DZC-033`–`DZC-040` — §11 listing WRITE protocol recorded from the official reference; nothing implemented) · **Amended:** 2026-08-19 (`DZC-032` — §10 product review protocol recorded from the official reference) · **Amended:** 2026-08-18 (`DZC-031.h` — bounded generic attributes) · **Amended:** 2026-08-18 (`DZC-031` — reported stock source) · **Amended:** 2026-08-18 (§9 clarified from first implementation) · **Amended:** 2026-08-18 (§9 — listing read, `DZC-020`–`DZC-030`) · **Amended:** 2026-08-17 (`DZC-010` local-seller branch) · **Source:** Daraz / Lazada Open Platform official documentation, plus one live production observation

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

## Version history

| Version | Date | Change |
|---|---|---|
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
