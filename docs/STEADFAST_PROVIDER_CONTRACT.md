# Steadfast Provider Contract — implementation reference

**Owner:** Trioloo Integration · **Module:** Integration · **Status:** ✅ **IMPLEMENTATION-READY TECHNICAL REFERENCE** · ⚠ **NOT CANONICAL ARCHITECTURE**
**Version:** 1.0.0 · **Established:** 2026-08-24 · **Rule prefix:** `STF-` · **Source:** live read-only observation against the production merchant account on 2026-08-24, corroborated against the provider's published field list

> ⚠ **THIS DOCUMENT LEGISLATES NOTHING.** It records **third-party protocol facts** so that implementation does
> not guess them. Business rules remain with their owning canonical documents — **`DELIVERY_ARCHITECTURE.md`
> owns the courier**, `STATE_MACHINE_ARCHITECTURE.md` owns `SM-4`, `PAYMENT_ARCHITECTURE.md` owns remittance.
>
> 🔴 **IT DOES NOT CLOSE `GAP-138`.** Knowing the protocol is not implementing it.
>
> 🔴 **NO SECRET APPEARS HERE** — no API key, secret key or merchant credential. Only variable NAMES and
> protocol shapes (`DEP-021.b`, `DEP-021.d`).
>
> 🔴 **NOTHING WAS BOOKED, CANCELLED OR MODIFIED TO PRODUCE THIS DOCUMENT.** Every observation below came from
> a **read-only** request. `create_order` and `bulk-create` are recorded from the published field list and were
> **NOT CALLED**, because calling them would dispatch a real courier against a real merchant account.

---

## 1. Why this file exists

**`DLV-013` ratifies Steadfast as the default and primary courier** — *assigned automatically, with no courier
selection step* — and **`SYS §12.3` registers courier integration as booking, tracking and COD remittance.**
⚠ **The architecture has therefore assumed a protocol since ratification, and no document recorded one.**
**`GAP-138` registers that absence**; this file answers the protocol half of it.

✅ **This mirrors what `DARAZ_PROVIDER_CONTRACT.md` did for `GAP-137`**: record the third-party facts first, so
that the implementation slice argues about business rules rather than about field names.

---

## 2. Service address

> **`STF-001` — ✅ THE BASE IS `https://portal.packzy.com/api/v1`.**
>
> 🔴 **IT IS NOT `steadfast.com.bd`, AND THAT IS THE FIRST THING AN IMPLEMENTER GETS WRONG.** **The merchant
> brand and the API host are different domains** — `packzy.com` is the platform Steadfast operates on. ⚠ **A
> firewall allow-list, an egress rule or a certificate pin written against the brand domain will fail.**

| | |
|---|---|
| **Base** | `https://portal.packzy.com/api/v1` |
| **Transport** | HTTPS, JSON request and response bodies |
| **Observed** | 2026-08-24, production merchant account, read-only |

⚠ **The published documentation surface (`steadfast.com.bd/user/api-doc`) returned `HTTP 403` to a plain
fetch on 2026-08-24.** ✅ **That is a fetch restriction, not a missing document** — the same class of obstacle
`DZC §1` recorded for Daraz. 🔴 **Nothing here was written from a blog, an SDK, a tutorial or recollection:
every shape below was OBSERVED, and everything not observed is marked as such.**

---

## 3. Authentication

> **`STF-002` — ✅ TWO HTTP HEADERS. NO OAUTH, NO TOKEN, NO EXPIRY, NO REFRESH.**

| Header | Carries |
|---|---|
| `Api-Key` | the merchant's API key |
| `Secret-Key` | the merchant's secret key |

**Confirmed by a live `200` on `GET /get_balance` on 2026-08-24.**

> **`STF-003` — 🔴 THE CREDENTIAL IS STATIC AND LONG-LIVED, WHICH MAKES IT MORE DANGEROUS THAN DARAZ'S, NOT
> LESS.**
>
> **a.** ⚠ **There is no expiry and no refresh cycle** — a leaked key stays valid until a human rotates it in
> the Steadfast panel. **`DZC`'s Daraz tokens expire on their own; these do not.**
> **b.** 🔴 **IT IS SENT ON EVERY REQUEST AS A PLAIN HEADER**, so it must never enter a log line, an error
> message, a stack trace, an exception payload or a support export (`DEP-021.d`).
> **c.** ✅ **STORAGE FOLLOWS THE EXISTING RULE, NOT A NEW ONE** — `TEC-119`/`TEC-120` already govern
> integration credential persistence and `DEP-123` the encryption key. 🔴 **No new secret mechanism is
> invented for this provider.**
> **d.** 🔴 **THE CREDENTIAL IS PER MERCHANT ACCOUNT, NOT PER SHOP.** ⚠ **Trioloo operates four Daraz shops
> against ONE Steadfast merchant account**, so the courier credential does NOT hang off `channel_instance` the
> way a Daraz authorisation does. **Where it hangs is a business decision and is NOT decided here.**

---

## 4. The response envelope

> **`STF-004` — 🔴 THERE IS NO SINGLE ENVELOPE. THREE DIFFERENT `status` SHAPES WERE OBSERVED ON ONE
> ACCOUNT, IN ONE SESSION, MINUTES APART.**

| Endpoint | Observed `status` | Type |
|---|---|---|
| `GET /get_balance` | `200` | integer, mirrors the HTTP code |
| `GET /payments` | `1` | integer, a boolean-ish flag |
| `GET /police_stations` | `"success"` | string |

> **a.** 🔴 **A CLIENT MUST NOT BRANCH ON THE BODY'S `status` FIELD AS THOUGH IT HAD ONE MEANING.** ⚠ **Code
> that tests `body.status == 200` succeeds on balance and silently fails on payments; code that tests
> `body.status == 1` does the reverse.**
> **b.** ✅ **THE HTTP STATUS CODE IS THE ONE CONSISTENT SIGNAL OBSERVED** and is what the adapter should
> branch on, with the body read for detail only.
> **c.** ⚠ **`GET /payments` ALSO CARRIES `alertClass` AND `message`** — `"success"` and
> `"Fetched successfully!"` — **which are PRESENTATION fields leaking from the provider's own panel.**
> 🔴 **They carry no protocol meaning and must not be surfaced to a Trioloo operator** (`BR-005` — channel
> vocabulary stops at the adapter).

---

## 5. Endpoints observed

> **`STF-005` — ✅ THE READ-ONLY SURFACE, AS OBSERVED 2026-08-24.**

| Method | Path | HTTP | Result |
|---|---|---|---|
| `GET` | `/get_balance` | **200** | `{"status":200,"current_balance":<number>}` |
| `GET` | `/payments` | **200** | `{"status":1,"alertClass":…,"message":…,"payments":[…]}` |
| `GET` | `/police_stations` | **200** | `{"status":"success","data":[…]}` |
| `GET` | `/status_by_cid/{consignment_id}` | **401** | `Unauthorized Access` — see `STF-007` |
| `GET` | `/status_by_invoice/{invoice}` | **401** | `Unauthorized Access` — see `STF-007` |
| `GET` | `/status_by_trackingcode/{code}` | **401** | `Unauthorized Access` — see `STF-007` |

> **`STF-006` — ⚠ PATHS THAT DO NOT EXIST UNDER THESE NAMES.** **`/get_police_stations`,
> `/get_police_station`, `/return_request`, `/return_requests`, `/returns` and `/payment/{id}` each returned
> `HTTP 404` with the body `{"message":""}`.** 🔴 **RECORDED AS OBSERVED, NOT AS PROOF THE CAPABILITY IS
> ABSENT** — a return-request capability is described in third-party client libraries and may live at a path
> not guessed here. ✅ **The plural `/police_stations` works; the `get_`-prefixed spelling does not, even
> though `get_balance` does carry the prefix.** ⚠ **The naming is inconsistent and must be taken literally.**

> **`STF-007` — 🔴 `401 Unauthorized Access` DOES NOT MEAN THE CREDENTIAL IS BAD. THIS IS THE MOST
> DANGEROUS FACT IN THIS DOCUMENT.**
>
> **a.** ✅ **The same headers returned `200` on `/get_balance` and `/payments` in the same session, seconds
> apart.** **The credential was valid throughout.**
> **b.** 🔴 **`/status_by_cid/1` and `/status_by_invoice/NOT-A-REAL-INVOICE-ZZZ` BOTH returned `401`** — one
> a consignment belonging to another merchant, the other an invoice that exists nowhere. ⚠ **THE PROVIDER
> CONFLATES *not found*, *not yours* and *not authenticated* INTO ONE STATUS.**
> **c.** 🔴 **AN ADAPTER MUST NOT TREAT `401` FROM A STATUS READ AS AN AUTHENTICATION FAILURE.** ⚠ **Doing so
> would mark a healthy integration as broken, or — worse — trigger a credential-rotation or reauthorisation
> path because one parcel was untraceable.**
> **d.** ⚠ **THE RESPONSE BODY IS PLAIN TEXT, NOT JSON** — the literal string `Unauthorized Access`. **A
> client that assumes JSON on every response will throw a parse error and report the wrong cause.**
> **e.** ✅ **A GENUINE CREDENTIAL FAILURE IS THEREFORE DETECTED ON `/get_balance`, NOT ON A STATUS READ** —
> a cheap, side-effect-free call that returns `200` only when the credential really works.

---

## 6. COD remittance — `GET /payments`

> **`STF-008` — ✅ THE REMITTANCE FEED EXISTS AND CARRIES REAL HISTORY.** **Observed with live merchant data
> on 2026-08-24, paginated by a `page` query parameter.**

| Field | Observed | Meaning as published by the provider |
|---|---|---|
| `payment_id` | `SFC-…` | the provider's own remittance identifier |
| `amount` | number | gross collected |
| `method` | `Bank` | remittance channel |
| `due_bills` | number | outstanding |
| `paid_bills` | number | settled |
| `charges` | number | the courier's deduction |
| `total` | number | net remitted |
| `status_label` | `paid` | the provider's own word |
| `created_at` · `ready_at` · `paid_at` | timestamps | three distinct moments |

> **a.** 🔴 **THIS FEED IS WHY `BR-035` EXISTS, AND IT PROVES THE RULE RATHER THAN CHALLENGING IT.**
> **`BD-438`–`BD-440` recorded THREE facts where the architecture had two: the courier collects, the courier
> states it has remitted, and the money arrives — and they can be days apart.** ✅ **`created_at`, `ready_at`
> and `paid_at` are exactly those three moments, published separately.**
> **b.** 🔴 **`status_label: "paid"` IS THE COURIER'S CLAIM, NOT TRIOLOO'S RECEIPT.** ⚠ **`BR-035` — money
> held or reported by an intermediary is not money received by Trioloo — and `SM-5`'s
> `COLLECTED_BY_INTERMEDIARY → RECEIVED` is MANUAL precisely because *"a courier statement saying money was
> remitted is not the same fact as receipt"* (`PAY-070`, `PAY-072`, `SMA-079`).** 🔴 **AN ADAPTER MAY NEVER
> AUTO-ADVANCE `SM-5` FROM THIS FIELD.**
> **c.** ⚠ **`charges` IS A DEDUCTION AND ITS ACCEPTANCE IS PERMISSIONED ACCOUNTS WORK**, not an import
> decision (`SM-5` `SHORT_SETTLED → RECONCILED`, `PAY-078`, `BD-110`).
> **d.** 🔴 **WHICH CONSIGNMENTS A REMITTANCE COVERS IS NOT IN THE OBSERVED PAYMENT ROW.** **`BD-438` records
> that the Steadfast PANEL states this.** ⚠ **Whether the API exposes the per-consignment breakdown was NOT
> established, and no field is invented.** ✅ **`BD-439`'s prohibition stands: a bank credit alone never
> establishes WHICH orders were settled.**

---

## 7. Coverage — `GET /police_stations`

> **`STF-009` — ✅ COVERAGE REFERENCE DATA IS PUBLISHED AND IS DISTRICT → POLICE-STATION SHAPED.**

**`{"status":"success","data":[{ "id", "name", "policestations":[{ "id", "name", "hub_id", "district_id",
"ps_type", "big_parcel", "post_code", "address", "search_tags", "phone", … }]}]}`**

> **a.** ✅ **`big_parcel` IS A PER-STATION CAPABILITY FLAG**, which is the shape `E-036`'s *coverage* and
> *fragility handling* attributes anticipate (`DLV-012`).
> **b.** 🔴 **NO RATE, ZONE PRICE OR DELIVERY-TIME FIELD APPEARS IN THIS FEED.** ⚠ **`DLV §11`'s rate
> structure is NOT derivable from it, and none is inferred** (`§11.1` — the rate structure is versioned and
> owned by `E-036`).
> **c.** ⚠ **`post_code` AND `address` WERE OBSERVED NULL on the sampled rows.** **Absent is not empty**
> (`BR-134`): the field exists and the provider did not fill it.

---

## 8. Booking — `create_order` · NOT CALLED

> **`STF-010` — 🔴 RECORDED FROM THE PUBLISHED FIELD LIST AND DELIBERATELY NOT EXERCISED.** ⚠ **Calling it
> dispatches a real courier against a live merchant account and incurs a real charge.** ✅ **Every field below
> is marked with how it is known.**

| Field | Required | How known |
|---|---|---|
| `invoice` | ✅ | published field list — **merchant's own reference, echoed back on status reads** |
| `recipient_name` | ✅ | published field list |
| `recipient_phone` | ✅ | published field list |
| `recipient_address` | ✅ | published field list |
| `cod_amount` | ✅ | published field list |
| `alternative_phone` · `recipient_email` · `note` · `item_description` · `total_lot` · `delivery_type` | ⬜ optional | published field list |

**Response fields published:** `consignment_id` · `tracking_code` · `status` · `message`.
**Bulk endpoint published as `bulk-create`, maximum 500 orders per request.**

> **a.** 🔴 **UNVERIFIED UNTIL A CONTROLLED FIRST BOOKING IS RUN AND ACCEPTED**, exactly as `DZC-057` did for
> the first Daraz read and `DZC-041` for the controlled write probe. ⚠ **No implementation may treat this
> table as confirmed.**
> **b.** ✅ **`invoice` IS THE IDEMPOTENCY-SHAPED FIELD** — it is the merchant's own reference and
> `/status_by_invoice/{invoice}` reads by it. 🔴 **Whether Steadfast REJECTS a duplicate `invoice` or silently
> books a second parcel was NOT established, and it is the single most important unknown here**: `BR-023` as
> amended allows an order **at most ONE ACTIVE shipment**, and a double booking would violate it at the
> courier rather than in the ERP. ⚠ **This must be settled by a controlled probe before any booking path
> ships.**
> **c.** ✅ **`OSC-057`'s `TR0001` NUMBER IS THE OBVIOUS CANDIDATE FOR `invoice`** — it is Trioloo-issued,
> unique, immutable and never reused (`PRN-013`, `DB-012`). 🔴 **Whether it SHOULD be is a business decision
> and is not taken here.**
> **d.** 🔴 **`cod_amount` IS MONEY AND CROSSES AS A NUMBER IN THIS PROVIDER'S JSON.** ⚠ **`TEC-015`/`DB-079`
> govern the ERP's own boundary; the adapter must convert exactly once, at the edge, and never let a
> provider number become the authoritative amount.**
> **e.** ⚠ **NO WEBHOOK OR CALLBACK SPECIFICATION WAS OBSERVED OR PUBLISHED.** 🔴 **`DLV-031` requires push,
> pull and manual tracking to all be supported permanently; only PULL is evidenced here.** **Whether Steadfast
> pushes at all is NOT ESTABLISHED.**

---

## 9. Delivery status vocabulary

> **`STF-011` — 🔴 THE `delivery_status` VALUE SET WAS NOT OBSERVED AND IS NOT GUESSED.**
>
> **a.** ⚠ **Every status read available to this account returned `401`** (`STF-007`), **so no live
> `delivery_status` value was seen.**
> **b.** 🔴 **NO MAPPING TO `SM-4` IS WRITTEN HERE.** **`SM-4` has fourteen ratified states and `DLV-024`
> keeps them in `STATE_MACHINE_ARCHITECTURE.md`.** ✅ **The translation belongs to the ADAPTER** (`BR-005`,
> `OM §4.3`) — **the same rule that put the Daraz→`SM-1` translation in `DarazChannelOrderProvider`.**
> **c.** ⚠ **AN UNKNOWN COURIER STATUS MUST NOT BE COERCED**, exactly as `CanonicalOrderStatus.resolve`
> refuses to coerce an unknown Daraz status (`BR-007`, `SYS-034`, `INV-32.4`).
> **d.** ✅ **`DLV-025` ALREADY SETTLES THE AUTHORITY QUESTION** — `SM-4`'s authority is External and the
> courier is system of record for tracking and outcome. 🔴 **`DLV-027` is equally binding: `LOST` is entered
> only on the courier's official confirmation, and NO elapsed-time threshold may be invented.**

---

## 10. Operational observation

> **`STF-012` — ⚠ THE MERCHANT ACCOUNT'S `current_balance` WAS OBSERVED AT `1` ON 2026-08-24.**
>
> ✅ **Recorded because it is an operational readiness fact, not a defect.** ⚠ **Whether Steadfast refuses a
> booking on insufficient balance was NOT established** — the booking path was deliberately not exercised.
> 🔴 **If it does, the first real booking will fail for a reason that has nothing to do with the
> implementation, and an implementer should check the balance before concluding the adapter is broken.**

---

## 11. What this document does NOT establish

| Not established | Why it matters |
|---|---|
| **Duplicate-`invoice` behaviour** | `BR-023` — an order has at most ONE active shipment |
| **`delivery_status` value set** | the `SM-4` translation cannot be written without it |
| **Any webhook or push mechanism** | `DLV-031` requires push to be supported |
| **Per-consignment remittance breakdown** | `BD-438`/`BD-439` — which orders a payment covers |
| **Rate, zone price or delivery time** | `DLV §11` rate structure |
| **Return-request endpoints** | `DLV §10` return to origin |
| **Cancellation of a booked consignment** | `SM-4` `CANCELLED` |
| **Rate limits** | no limit is published; the cadence must be conservative by choice, as `BR-179.e` decided for Daraz |

🔴 **Each is an OPEN PROTOCOL QUESTION, not a business gap.** ✅ **The business gaps sit in `GAP-138`.**

---

## 12. Version history

| Version | Date | Change |
|---|---|---|
| **1.0.0** | **2026-08-24** | **Initial record. `STF-001`–`STF-012`.** ✅ **Establishes the base host `portal.packzy.com/api/v1` — NOT the brand domain — and the two static `Api-Key`/`Secret-Key` headers, confirmed by a live read-only `200`.** 🔴 **Records three protocol hazards an implementation would otherwise meet at runtime: the envelope has THREE different `status` shapes across three endpoints; `401 Unauthorized Access` conflates *not found*, *not yours* and *not authenticated* and arrives as PLAIN TEXT, so it must never be read as a credential failure; and the credential is static with no expiry, so a leak persists until a human rotates it.** ✅ **Records the COD remittance feed and shows it CORROBORATES `BR-035` and `SMA-079` — `created_at`/`ready_at`/`paid_at` are the three moments `BD-438` described, and `status_label: paid` is the courier's claim, never Trioloo's receipt, so no adapter may auto-advance `SM-5` from it.** 🔴 **`create_order` was NOT CALLED — booking dispatches a real courier — and its fields are recorded as PUBLISHED, not CONFIRMED. The duplicate-`invoice` behaviour is named as the single most important unknown, because a silent double booking would violate `BR-023` at the courier rather than in the ERP.** 🔴 **No `delivery_status` value was observed, so NO `SM-4` mapping is written and none is guessed. No business rule created, no gap closed, nothing implemented, no secret recorded.** |
