# Daraz Provider Contract — implementation reference

**Owner:** Trioloo Integration · **Module:** Integration · **Status:** ✅ **IMPLEMENTATION-READY TECHNICAL REFERENCE** · ⚠ **NOT CANONICAL ARCHITECTURE**
**Version:** 1.2.0 · **Established:** 2026-08-17 · **Amended:** 2026-08-17 (`DZC-011` corrected) · **Source:** Daraz / Lazada Open Platform official documentation

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

## 6. Seller identity — RESOLVED 2026-08-17

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

## 8. What remains unpublished — and why none of it blocks

| Fact | Status |
|---|---|
| **`/seller/get` response schema** | 🔴 **NOT PUBLISHED.** Does not block — identity comes from the documented token response instead (`DZC-010`) |
| **Runtime error codes** | 🔴 **NOT PUBLISHED.** Does not block — mapping is driven by documented time facts and defaults to `ERROR` (`DZC-011`) |
| **Rate-limit semantics** | ⚠ Unpublished — treated as `ERROR`, learn empirically |
| **Bangladesh REST base** | ✅ **CLOSED** — explicitly documented per region |
| **Timestamp skew window** | ✅ **CLOSED** — ±7200 seconds |
| **`sign_method` value** | ✅ **CLOSED** — `sha256` |

✅ **NOTHING REMAINING REQUIRES A GUESS AT IMPLEMENTATION TIME.** ⚠ **Every unpublished item has a
documented fallback that FAILS SAFE**, and each is recorded here so it gets confirmed against reality at the first
live authorisation rather than quietly assumed to be true.

## Sources

All read from the provider's rendered official documentation on 2026-08-17:

- [Daraz Open Platform — Getting Started](https://open.daraz.com/doc/doc.htm)
- [Daraz Open Platform — Seller authorization introduction](https://open.daraz.com/doc/doc.htm?#/?docId=490)
- [Daraz Open Platform — Configure seller authorization](https://open.daraz.com/doc/doc.htm?nodeId=27493&docId=118729#/?docId=491)
- [Daraz Open Platform — API Reference](https://open.daraz.com/doc/api.htm)
- [Lazada Open Platform — Signature algorithm](https://open.lazada.com/apps/doc/doc?nodeId=10450&docId=108068)

⚠ **The signature algorithm is published on the Lazada Open Platform documentation, to which Daraz's own API
reference links directly for signing details** — the two ventures share one platform contract.

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.2.0** | **2026-08-17** | 🔴 **`DZC-011` CORRECTED — IT WAS OVER-BROAD.** **v1.1.0 mapped ANY non-zero response from `/auth/token/refresh` to `REAUTH_REQUIRED`.** ⚠ **That would have told an operator to go and disturb a seller whose authorisation was perfectly healthy, merely because the refresh call was rate-limited, mis-signed, clock-skewed or hit a provider outage.** ✅ **`REAUTH_REQUIRED` now requires evidence about the CREDENTIAL itself — invalid, expired or revoked; everything else, including any unclassified non-zero code, is `ERROR`.** 🔴 **THE ENDPOINT INVOLVED PROVES NOTHING; ONLY EVIDENCE ABOUT THE CREDENTIAL DOES.** ⚠ **No new error code was invented to support this — the rule is a classification default, not a claim about Daraz’s catalogue.** |
| **1.1.0** | **2026-08-17** | ✅ **CONTRACT COMPLETED.** **Bangladesh REST base explicitly confirmed from the per-region Service Endpoints table; timestamp skew ±7200s; `sign_method=sha256` resolved from the official sample's branch rather than from digest length.** 🔴 **`DZC-010` DECIDES THE BINDING IDENTITY — the Bangladesh `country_user_info[].seller_id` from the token response — BECAUSE `/seller/get` PUBLISHES NO RESPONSE SCHEMA**, and guessing a field on the one fact every reauthorisation is tested against would mis-bind shops silently. 🔴 **`DZC-011` maps provider failures from DOCUMENTED TIME FACTS and defaults to `ERROR`, because Daraz publishes no auth error codes; `REAUTH_REQUIRED` is reached only on a documented condition.** ⚠ **Unpublished items are listed with fail-safe fallbacks to confirm at first live authorisation.** 🔴 **No secret value appears in this document.** |
| **1.0.0** | **2026-08-17** | **Initial record of the official Daraz protocol facts** — hosts, OAuth `code for token` flow with round-tripping `state`, `/auth/token/create` and `/auth/token/refresh`, independent token lifetimes, the HMAC-SHA256 canonical-string signing contract, `/seller/get`, and the response envelope. ⚠ **Records explicitly what is NOT yet established**, so implementation cannot mistake this for a complete contract. 🔴 **No secret value appears in this document.** |
