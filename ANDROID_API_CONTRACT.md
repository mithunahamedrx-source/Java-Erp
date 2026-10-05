# ANDROID_API_CONTRACT.md

> **Status:** audit output, generated 2026-10-02 from the source in `backend/`. **Not a canonical architecture
> document** (no `DOC-` number). It describes what the code does today; it does not authorise new behaviour.
> Where the code and `docs/` disagree, the docs win (CLAUDE.md §6) and the code is the defect.
>
> **Evidence levels used below**
> - **VERIFIED** – the controller, DTO and service were read line by line for this document.
> - **MAPPED** – path/method taken from a read-only survey of the controller; DTO fields were not re-read. Re-read the
>   controller before coding against it.
> - **READY / PARTIAL / MISSING / UNVERIFIED** – Android-readiness tags (§14–§16).
>
> Nothing in the backend was modified. No secrets appear here.

---

## 1. Backend architecture summary

| Item | Value (source) |
|---|---|
| Language / runtime | Java 25 (`backend/pom.xml`) |
| Framework | Spring Boot 4.1.0, Spring MVC, Spring Security, Spring Data JPA + `JdbcTemplate` |
| Build | Maven |
| Database | PostgreSQL, Flyway owns schema (`ddl-auto: validate`), 25 migrations V1–V25 |
| Layout | `com.trioloo.erp.<module>.{api,application,domain,infrastructure}` |
| Modules with REST controllers | `access`, `order`, `delivery`, `accounting`, `system`, `integration`, `product` |
| Modules **without** any controller | `inventory`, `inventorycosting`, `platform` |
| Controllers | 12 (`*/api/*.java`) |
| Validation | Bean Validation only on `LoginRequest`; other validation is hand-written in services (`IllegalArgumentException`) |
| Authorization | Permission codes checked **inside application services** against `Authentication.getAuthorities()`; no `@PreAuthorize` on controllers |
| Swagger/OpenAPI | **None** (no `springdoc`/`swagger` in `pom.xml`) |
| Notifications / push / file upload | **None found** |
| Scheduling | Order pull scheduler (`ORDER_PULL_ENABLED`, default `false`) |

Android must talk to this REST API only. It must never connect to PostgreSQL.

## 2. Base URL / API version

- **No context path, no `/v1`, no version header.** Every route is `/api/<module>/<resource>`.
- Local default: `http://localhost:8080` (`server.port=${SERVER_PORT:8080}`). Android emulator reaches the host as
  `http://10.0.2.2:8080`.
- Production: per `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md` the web app and API share one origin
  (`https://user.trioloo.com`) behind Nginx, backend bound to `127.0.0.1:8080`. **UNVERIFIED** for a mobile-specific host.
- Plain HTTP works locally; production is expected to be HTTPS-only and the session cookie is `Secure` there (DEP-122).
  Android cleartext traffic must be allowed explicitly for local development only.
- Health: `GET /actuator/health` (unauthenticated, no details).

## 3. Authentication contract

**Mechanism: server-side session cookie + CSRF.** Not JWT, not OAuth, no bearer token, no API key.
(`SecurityConfig.java`, rationale in its Javadoc: suspended accounts must lose access immediately.)

### 3.1 Required handshake (every cold start)
1. `GET /api/auth/csrf` → **204**, no body. Sets cookie `XSRF-TOKEN` (non-HttpOnly).
2. `POST /api/auth/login` with header `X-XSRF-TOKEN: <value of XSRF-TOKEN cookie>` → **200** + `JSESSIONID` cookie
   (HttpOnly; session id is rotated on login).
3. For every later **POST/PUT/PATCH/DELETE**: send `X-XSRF-TOKEN` = current `XSRF-TOKEN` cookie value.
   The token is **not XOR-masked** (`CsrfTokenRequestAttributeHandler`), so the raw cookie value is correct.
4. GET requests need only the `JSESSIONID` cookie.

Android needs a persistent, thread-safe cookie jar (OkHttp `CookieJar`) holding both cookies, and an interceptor that
copies the `XSRF-TOKEN` cookie into `X-XSRF-TOKEN` for non-GET methods. A missing/invalid CSRF token yields **403**
before any controller runs (Spring default body, **UNVERIFIED** shape).

### 3.2 Login — VERIFIED (`AuthController.login`)
- `POST /api/auth/login`, `Content-Type: application/json`, auth not required, CSRF header required.
- Request: `{"username":"<string, not blank>","password":"<string, not blank>"}`.
- Success **200**:
```json
{
  "id": "6f1c2c1e-0000-0000-0000-000000000000",
  "username": "example.user",
  "fullName": "Example User",
  "roles": ["<role-code>"],
  "permissions": ["order.channel-order.view", "delivery.shipment.book"]
}
```
- Failure **401 with an empty body** for *every* cause (unknown user, wrong password, suspended/disabled/expired).
  Android must not try to distinguish them.
- Only `ACTIVE` and `INVITED` accounts can sign in; the first successful sign-in moves `INVITED → ACTIVE`.
- A blank/missing field: the controller does not declare `@Valid`, so bean-validation on the record is **UNVERIFIED**;
  treat any 4xx on login as failure.
- Token location: none. Session id travels in the `JSESSIONID` cookie.
- Token type / lifetime: server session; idle timeout is the Spring Boot/Tomcat default (30 min) — **UNVERIFIED**,
  no `server.servlet.session.timeout` is configured.

### 3.3 Refresh token — **MISSING API / BACKEND CHANGE REQUIRED**
Refresh-token functionality is not implemented. There is no refresh endpoint, no rotation, no expiry policy. Session
renewal is implicit (activity extends the server session). Android must call `GET /api/auth/me` to test whether a
restored cookie is still valid and fall back to the login screen on 401.

### 3.4 Logout — VERIFIED
`POST /api/auth/logout` (CSRF header required, session required) → **204**. The server session is invalidated, so the
cookie is dead immediately. Android should also clear its cookie jar.

## 4. Current-user contract — VERIFIED
`GET /api/auth/me` → **200** same `CurrentUserResponse` as login, or **401** empty body.
Fields: `id` (UUID), `username`, `fullName`, `roles` (set of role codes), `permissions` (set of permission codes).
**Not present:** email, phone, status, profile photo, branch/shop scope. Update-profile and change-password endpoints
do not exist (§16).

## 5. Roles and permissions

- Authorities are **permission codes only** (`AccessUserDetails.getAuthorities()` → `SimpleGrantedAuthority(code)`);
  there are no `ROLE_` authorities. Resolved once at login and stored in the session.
- **Role definitions are data, not code.** The `role` table exists (V2) but no migration seeds any role. Role names
  therefore cannot be listed from source — **UNVERIFIED**; they are created by an Owner/Administrator at runtime.
  There is **no REST endpoint to list roles, users or permissions**.
- Owner receives the whole permission catalogue; others get role-derived permissions plus overrides.
- Permission codes defined in source (`*Permissions.java`) and seeded by migrations (seeded with zero holders):

| Module | Codes |
|---|---|
| Order | `order.channel-order.view`, `order.channel-order.sync`, `order.order.create` |
| Delivery | `delivery.shipment.book`, `delivery.shipment.track`, `delivery.shipment.cancel` (no endpoint), `payment.courier-remittance.view` (no endpoint) |
| Accounting | `accounting.sales-invoice.view`, `accounting.sales-invoice.issue` |
| System | `system.channel-instance.view`, `.manage`, `.lifecycle` |
| Integration | `integration.channel-connection.authorize` |
| Product | `product.stock-item.view/manage`, `product.sellable-product.view/manage`, `product.build-template.activate`, `product.channel-listing.view/manage/publish/sync`, `inventory-costing.valuation.view` |

- Enforcement is **server-side** inside services (`PRM-004`). Android hiding a button is convenience only. Do **not**
  invent new permission codes; `docs/` forbids it (OSC-052, PRM-089.f).
- Permissions are global. **Per-shop scoping is not enforced in the Order query/detail path I read** (§17).

## 6. Standard headers

| Header | When | Value |
|---|---|---|
| `Accept` | always | `application/json` (CSV exports return `text/csv`) |
| `Content-Type` | requests with a body | `application/json` |
| `Cookie` | after csrf/login | `XSRF-TOKEN`, `JSESSIONID` (via CookieJar) |
| `X-XSRF-TOKEN` | POST/PUT/PATCH/DELETE | value of `XSRF-TOKEN` cookie |
| `Authorization` | — | **not used** |
| `Idempotency-Key`, `If-Match`, API version | — | **not supported** |

## 7. Error contract — **INCONSISTENT (PARTIALLY IMPLEMENTED)**

There is **no `@ControllerAdvice`**. Each controller has local `@ExceptionHandler`s. `server.error.include-message=never`
and no stack traces, so unhandled errors return Spring's default error JSON (shape **UNVERIFIED**).
No `timestamp`, `path`, `code`, `traceId` or correlation id is returned anywhere (`PRJ-151/PRJ-200` not met).

| Shape | Used by |
|---|---|
| `{"error":"FORBIDDEN","requiredPermission":"order.channel-order.view","message":"..."}` | ChannelOrder, Shop, ChannelConnection, Product controllers (403) |
| `{"error":"VALIDATION_FAILED","message":"..."}` / `{"error":"NOT_FOUND","message":"..."}` | ChannelOrderController (400 / 404) |
| `{"message":"..."}` only | ManualOrder, Shipment, SalesInvoice controllers |
| empty body | login 401, unauthenticated 401, invoice-not-issued 404 |

Status codes actually produced (VERIFIED for the controllers in §12 rows 1–15):

| Code | Meaning here |
|---|---|
| 400 | validation / business refusal (`IllegalArgumentException`, `IllegalStateException` in Shipment; import error in ChannelOrder) |
| 401 | no session (empty body) |
| 403 | missing permission (body above) **or** missing/invalid CSRF token (Spring default) |
| 404 | `ChannelOrderNotFoundException`; invoice not issued (empty) |
| 409 | shipment already booked; invoice already issued; `AUTHORISATION_UNSUPPORTED` (integration) |
| 422 | **not used** |
| 502 / 503 | Steadfast transport/protocol failure / Steadfast not configured or credential error |
| 500 | unhandled; known path: invoice issue for an unknown order id / missing invoice number — SalesInvoiceController has no `IllegalState/IllegalArgument` handler (**UNVERIFIED**, not run) |

**Android rule:** key on HTTP status; parse `message` defensively (may be absent, may be English free text, may cite
internal rule ids like `BR-023`); treat `error`/`requiredPermission` as optional.
**MISSING API / BACKEND CHANGE REQUIRED:** one uniform error envelope with a stable machine `code` and a request id.

## 8. Pagination / search / filter

- Type: **page/size**, **0-based**. Not offset, not cursor.
- Response (VERIFIED for orders; MAPPED for others):
```json
{ "content": [ ... ], "page": 0, "size": 50, "totalElements": 124, "totalPages": 3 }
```
  Shop list adds `totalRegistered`.
- `GET /api/order/channel-orders`: `page` (default 0, negatives → 0), `size` (default **50**, clamped to **1–200**).
- Filters (orders): `channelInstanceId` (UUID), `channelType`, `status` (canonical status), `search`,
  `period` = `DAY|MONTH|YEAR` (case-insensitive; calendar boundaries in `Asia/Dhaka`; unknown value = ignored).
- Sorting: **no sort parameter on orders** (order is server-fixed). Shops/stock items/products accept `sort`+`direction` (MAPPED).
- Facets (`/summary`): `channelTypes[]`, `statusCounts[]`, `shops[]` are computed ignoring their own active filter;
  an order can carry several canonical statuses so `statusCounts` need not sum to `totalOrders`.
- Android must not hard-code the page size to the web UI's 5.

## 9. Money / number / date-time contract

- **Money is a JSON string** (annotation `@MonetaryAmount`), plain decimal, e.g. `"1250.00"`. Java type `BigDecimal`.
  Parse into `BigDecimal`; **never** `Double`/`Float`; do no arithmetic, rounding or totalling on device — the server
  computes (TEC-095). Request money fields (`total`, `unitPrice`) are also strings.
  Policy server-side: 2 dp `HALF_UP` (DB-079). Currency is BDT but **no currency field is sent**.
- `taxRatePercent` (invoice) is a JSON **number** (BigDecimal, not `@MonetaryAmount`) and may be `null` (no rate configured).
  Configured rate currently `0` (`trioloo.invoice.tax-rate-percent`, key verified to match `application.yml`).
- Other numerics: counts are JSON numbers (`long`/`int`). `fail-on-null-for-primitives=true`: sending `null` for a primitive → 400.
- **Absent ≠ zero.** Many fields are nullable; show "Unknown", never `0`.
- Date/time: `Instant` serialised as ISO-8601 UTC (e.g. `"2026-10-02T06:15:30Z"`). Request `Instant` fields
  (`createdAfter`, `createdBefore`) must be ISO-8601 with `Z`/offset. JDBC pinned to UTC; JVM default zone forced to
  `Asia/Dhaka`; business "today/month/year" use `Asia/Dhaka`. Convert to device zone for display only.
- IDs: UUID strings. External ids (marketplace order id, consignment id) are strings, preserved exactly.

## 10. Duplicate submission / concurrency

| Operation | Protection | Retry outcome |
|---|---|---|
| Shipment booking | DB unique indexes (V21): one active shipment per order, unique invoice | 2nd call → **409** `{message}`. ⚠ Steadfast itself does not dedupe; a lost response may still have booked a parcel (docs `STEADFAST_PROVIDER_CONTRACT.md`) — **retry is not blindly safe** |
| Invoice issue | unique constraint + service check | 2nd call → **409** |
| Manual order create | **none** | retry creates a **second order** with a new `TR####` number — **MISSING API / BACKEND CHANGE REQUIRED** (idempotency key) |
| Edits (stock item / product update) | optimistic `version` field in request body (MAPPED) | stale version → conflict (code **UNVERIFIED**) |
| Payments, purchases | endpoints do not exist | n/a |

No `Idempotency-Key`, `ETag`, `If-Match` anywhere. Android must disable the submit button while a request is in
flight, never auto-retry non-idempotent POSTs, and on timeout re-read state (`GET`) before retrying.

## 11. Environment / profiles
`SPRING_PROFILES_ACTIVE=dev-authority` (local only) provisions a dev account whose credentials come from env vars
(`DEV_USERNAME`, `DEV_PASSWORD`) and grants every permission via ordinary overrides. It **refuses to run** when an active
profile contains `prod`, `production`, `live` or `staging` (`DevelopmentAuthorityBootstrap`). No staging profile or seed
data otherwise exists in the repo (§18).

---

## 12. Complete endpoint inventory

Legend: A = auth required, P = permission, CSRF = needs `X-XSRF-TOKEN`.

| # | Method | Path | A | P | Evidence | Android tag |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/auth/csrf` | no | – | VERIFIED | READY |
| 2 | POST | `/api/auth/login` | no (CSRF) | – | VERIFIED | READY |
| 3 | GET | `/api/auth/me` | yes | – | VERIFIED | READY |
| 4 | POST | `/api/auth/logout` | yes (CSRF) | – | VERIFIED | READY |
| 5 | GET | `/api/order/channel-orders` | yes | `order.channel-order.view` | VERIFIED | READY |
| 6 | GET | `/api/order/channel-orders/summary` | yes | view | VERIFIED | READY |
| 7 | GET | `/api/order/channel-orders/{id}` | yes | view | VERIFIED | READY |
| 8 | POST | `/api/order/channel-orders/pull-runs` | yes (CSRF) | `order.channel-order.sync` | VERIFIED | PARTIAL (operator tool) |
| 9 | GET | `/api/order/channel-orders/pull-state?channelInstanceId=` | yes | view | VERIFIED | PARTIAL |
| 10 | POST | `/api/order/channel-orders/imports` | yes (CSRF) | sync | VERIFIED | PARTIAL (admin tool) |
| 11 | POST | `/api/order/orders` | yes (CSRF) | `order.order.create` | VERIFIED | PARTIAL (no idempotency) |
| 12 | POST | `/api/delivery/orders/{orderId}/shipment-booking` | yes (CSRF) | `delivery.shipment.book` | VERIFIED | PARTIAL |
| 13 | POST | `/api/delivery/orders/{orderId}/tracking-refresh` | yes (CSRF) | `delivery.shipment.track` | VERIFIED | READY |
| 14 | GET | `/api/accounting/orders/{orderId}/invoice` | yes | `accounting.sales-invoice.view` | VERIFIED | READY |
| 15 | POST | `/api/accounting/orders/{orderId}/invoice` | yes (CSRF) | `accounting.sales-invoice.issue` | VERIFIED | PARTIAL (500 risk) |
| 16–23 | GET/POST/PUT | `/api/system/shops` (list, `/summary`, `/{id}`, POST create, PUT `/{id}`, POST `/{id}/activate`, `/channel-types`, `/markets`) | yes | `system.channel-instance.*` | MAPPED | UNVERIFIED |
| 24–25 | POST/GET | `/api/integration/channel-connections/{shopId}/authorize`; `/api/integration/daraz/callback` (public browser redirect) | mixed | `integration.channel-connection.authorize` | MAPPED | not for mobile |
| 26–35 | various | `/api/product/stock-items` (list, summary, get, create, update, export, import template/validate/confirm) | yes | `product.stock-item.*` | MAPPED | UNVERIFIED |
| 36–53 | various | `/api/product/sellable-products` (+ build-templates, members) | yes | `product.sellable-product.*` | MAPPED | UNVERIFIED |
| 54–85 | various | `/api/product/channel-listings` (+ media, push-review, ai, sku mapping, import/export) | yes | `product.channel-listing.*` | MAPPED | UNVERIFIED |
| 86–94 | various | `/api/product/channel-listings/operations*` (batches, retry, discovery, activity) | yes | listing perms | MAPPED | UNVERIFIED |

Counts: **15 endpoints VERIFIED** (rows 1–15); **~79 further endpoints MAPPED** (rows 16–94, from a controller survey;
exact total depends on re-reading those controllers). Product/shop endpoints serve the web back-office and are unlikely
to be needed by Android initially.

### Modules with NO endpoint — MISSING API / BACKEND CHANGE REQUIRED
Dashboard, inventory stock list/adjust/receive/movements, customers, purchase orders, goods receipt, suppliers/vendors,
bills, payments, ledger, expenses, requisitions, warranty, notifications (list/unread/mark-read/push registration),
profile update, change password, user/role/permission listing, shipment list/cancel, COD collection, proof of delivery,
order confirm/cancel/edit/status update/return/exchange. I grep-confirmed there are no controllers outside the 12 above.
Mention in `docs/` of several of these modules means *architecture*, not implemented code.

---

## 13. Detailed endpoint contracts (VERIFIED rows)

### 13.1 List channel orders — `GET /api/order/channel-orders`
Query: `channelInstanceId`, `channelType`, `status`, `search`, `period`, `page`, `size`. Permission `order.channel-order.view`.
Success **200** (`content[]` = `ChannelOrderRow`):
```json
{
  "content": [{
    "id": "UUID", "channelInstanceId": "UUID", "channelName": "Shop name",
    "externalOrderId": "string", "orderNumber": "string",
    "triolooInvoiceNumber": "TR0001", "ownership": "API_MANAGED | ERP_MANAGED",
    "statuses": ["marketplace-status"], "canonicalStatuses": ["PENDING_VERIFICATION"],
    "dispatchObservedAt": null, "providerCreatedAt": "2026-10-01T05:00:00Z",
    "providerUpdatedAt": "2026-10-01T05:10:00Z", "lastSeenAt": "2026-10-02T06:00:00Z",
    "price": "1250.00", "paymentMethod": "string|null", "itemsCount": 2,
    "customerFirstName": "string|null", "customerLastName": "string|null",
    "shippingPhone": "string|null", "shippingLine": "string|null", "buyerNote": "string|null",
    "itemName": "string|null", "trackingCode": "marketplace tracking|null",
    "invoiceNumber": "marketplace invoice|null", "purchaseOrderId": "string|null",
    "courierConsignmentId": "string|null", "courierTrackingCode": "string|null",
    "shipmentState": "BOOKED|null"
  }],
  "page": 0, "size": 50, "totalElements": 1, "totalPages": 1
}
```
Notes: `triolooInvoiceNumber` ≠ `invoiceNumber` (marketplace's) — never merge. `statuses` (marketplace) ≠ `canonicalStatuses`
(ERP) — never merge. Canonical values: PENDING_VERIFICATION, CONFIRMED, RELEASED, IN_FULFILLMENT, READY_TO_SHIP,
COURIER_BOOKED, DISPATCHED, DELIVERED, FAILED_DELIVERY, RETURNED, ON_HOLD, CANCELLED, CLOSED.
Errors: 401, 403 `{error:"FORBIDDEN",requiredPermission,message}`.

### 13.2 Summary — `GET /api/order/channel-orders/summary` (same filter params)
```json
{ "totalOrders": 0, "todaysOrders": 0, "todaysDispatched": 0, "totalCollectable": "0.00", "totalItems": 0,
  "channelTypes": [{"channelType":"DARAZ","orderCount":0}],
  "statusCounts": [{"status":"CONFIRMED","orderCount":0}],
  "shops": [{"channelInstanceId":"UUID","code":"string","name":"string","orderCount":0}] }
```

### 13.3 Detail — `GET /api/order/channel-orders/{id}`
`ChannelOrderDetail`: all fields of the row plus `channelType`, `importedAt`, `shippingFee*`, `voucher*`, `cashPaymentFee`
(money strings), `voucherCode`, `promisedShippingTimes`, `warehouseCode`, `deliveryInfo`, `remarks`, gift fields,
`billingAddress`/`shippingAddress` (`firstName,lastName,phone,phone2,address1..5,city,postCode,country`), and
`items[]` (`id, externalOrderItemId, sku, shopSku, name, variation, itemPrice, paidPrice, status, reason, trackingCode,
shipmentProvider, invoiceNumber, ...`). 404 `{error:"NOT_FOUND",message}` for unknown id.

### 13.4 Manual order — `POST /api/order/orders` (permission `order.order.create`)
Request:
```json
{ "channelInstanceId": "UUID", "customerFirstName": "string", "customerLastName": "string",
  "customerPhone": "string", "shippingAddress": "string", "shippingCity": "string",
  "paymentMethod": "string", "note": "string", "total": "1250.00",
  "lines": [{ "lineNumber": 1, "name": "string", "sku": "string|null", "unitPrice": "625.00" }] }
```
Rules: shop required; at least one of first/last name; ≥1 line; each line needs `name` and `unitPrice ≥ 0`.
`total` is stored as sent (not recomputed). No quantity field exists. Success **201**
`{"id":"UUID","invoiceNumber":"TR0002","canonicalStatus":"PENDING_VERIFICATION"}`. Errors: 400 `{message}`, 403 `{message}`.
Created as `ERP_MANAGED`. **Not idempotent.**

### 13.5 Book shipment — `POST /api/delivery/orders/{orderId}/shipment-booking`
No body. Permission `delivery.shipment.book`. Success **201**
`{"shipmentId":"UUID","consignmentId":"string","trackingCode":"string","providerStatusRaw":"string"}`.
Errors: 400 (order lacks invoice number / phone / address / COD amount), 403, 409 already booked, 502/503 provider
failure — all `{message}`. COD amount = order `price`.

### 13.6 Refresh tracking — `POST /api/delivery/orders/{orderId}/tracking-refresh`
No body. Permission `delivery.shipment.track`. Success **200**
`{"shipmentId":"UUID","state":"IN_TRANSIT","providerStatusRaw":"string","translated":true,"note":"string|null"}`.
`translated:false` means the courier status could not be mapped; state unchanged (still 200). 400 if no non-terminal shipment.
Shipment states: CREATED, BOOKED, AWAITING_PICKUP, PICKED_UP, IN_TRANSIT, AT_HUB, OUT_FOR_DELIVERY, DELIVERY_ATTEMPTED,
DELIVERED, RETURNING, RETURNED_TO_WAREHOUSE, LOST, DAMAGED, CANCELLED.

### 13.7 Invoice — `GET|POST /api/accounting/orders/{orderId}/invoice`
GET (view permission): **200**
```json
{ "invoiceNumber":"TR0001","issuedAt":"2026-10-02T06:00:00Z","customerName":"string","customerPhone":"string|null",
  "customerAddress":"string|null","externalOrderReference":"string","consignmentReference":"string|null",
  "subtotal":"0.00","deliveryCharge":"0.00","taxRatePercent":0,"taxAmount":"0.00","total":"0.00",
  "lines":[{"name":"string","sku":"string","quantity":1,"unitPrice":"0.00","lineTotal":"0.00"}] }
```
**404 with empty body** means "no invoice issued" (a normal answer, not an error). POST (issue permission) → **201**
`{id,invoiceNumber,subtotal,deliveryCharge,taxRatePercent,taxAmount,total}`; **409** `{message}` if already issued.
`taxRatePercent`/`taxAmount` may be `null`. Invoice lines have `quantity` fixed at 1 in the current service.

### 13.8 Pull/import (operator tools, not for end-user Android flows)
`POST /pull-runs {"channelInstanceId":"UUID"}` → `{kind, complete, imported, detail}`;
`GET /pull-state?channelInstanceId=` → ingestion position + recent runs;
`POST /imports {"channelInstanceId","createdAfter","createdBefore","pageSize"}` → `ImportOutcome`. 400 `VALIDATION_FAILED` on bad window.

---

## 14. Android feature mapping

| Android feature | Backend endpoint | Method | Auth | Permission | Status |
|---|---|---|---|---|---|
| Login | `/api/auth/login` (+ `/csrf`) | POST | CSRF | – | READY (cookie model) |
| Session restore | `/api/auth/me` | GET | cookie | – | READY |
| Logout | `/api/auth/logout` | POST | cookie+CSRF | – | READY |
| Token refresh | – | – | – | – | **MISSING** |
| Profile view | `/api/auth/me` | GET | cookie | – | PARTIAL (no email/phone) |
| Profile edit / password | – | – | – | – | **MISSING** |
| Dashboard | `/api/order/channel-orders/summary` only | GET | cookie | order view | PARTIAL (orders KPIs only) |
| Orders list/detail | `/api/order/channel-orders[/{id}]` | GET | cookie | order view | READY |
| Create order | `/api/order/orders` | POST | cookie+CSRF | order create | PARTIAL |
| Order status change/cancel | – | – | – | – | **MISSING** |
| Shipping / courier | `/api/delivery/orders/{id}/shipment-booking`, `/tracking-refresh` | POST | cookie+CSRF | book / track | PARTIAL |
| Invoices | `/api/accounting/orders/{id}/invoice` | GET/POST | cookie(+CSRF) | view / issue | PARTIAL |
| Products | `/api/product/stock-items`, `/sellable-products` | GET… | cookie | product perms | UNVERIFIED (MAPPED only) |
| Inventory stock/adjust | – | – | – | – | **MISSING** |
| Customers | – | – | – | – | **MISSING** |
| Purchases / goods receipt | – | – | – | – | **MISSING** |
| Vendors | – | – | – | – | **MISSING** |
| Payments / ledger | – | – | – | – | **MISSING** |
| Expenses / requisitions | – | – | – | – | **MISSING** |
| Warranty | – | – | – | – | **MISSING** |
| Notifications / push | – | – | – | – | **MISSING** |

## 15. Missing APIs
See §12 "Modules with NO endpoint", §3.3 (refresh token), §7 (uniform error envelope), §10 (idempotency key), plus:
mobile-friendly auth (token) if cookies are rejected, API versioning, OpenAPI document, user/role listing, shipment list.
Android cannot implement any of these today because there is no route to call.

## 16. Partial APIs
- Auth/me: no contact info, no shop scope.
- Orders: read-only plus manual create; no lifecycle actions, no quantity on manual lines.
- Delivery: only book + refresh; booking retry is unsafe.
- Invoice: possible 500 on unknown order id; quantity fixed at 1.
- Errors: five different shapes.
- Dashboard: order KPIs only.

## 17. Security findings relevant to Android

| Sev | Finding | Evidence |
|---|---|---|
| **HIGH** | No uniform error handling/correlation id; unhandled exceptions can surface as default 500 bodies | no `@ControllerAdvice`; `SalesInvoiceController` handlers |
| **HIGH** | Manual order create has no idempotency; mobile retries on flaky networks will create duplicate orders | `ManualOrderService.create` |
| **MEDIUM** | Permissions are global; no per-shop scope check seen on order list/detail/invoice/shipment by `{id}` (UUID guess requires a valid permission, but any holder can read any shop's order). `docs` mention per-shop scope as a live concern (API-071, AGV-016) | `ChannelOrderQueryService` (`requireViewer` only), `SalesInvoiceService.load` |
| **MEDIUM** | `SameSite` not configured on cookies; session-cookie model adds CSRF burden for native clients | `SecurityConfig`, DEP-122.g |
| **MEDIUM** | `GET /api/integration/daraz/callback` is unauthenticated by design; guarded only by one-time state | `SecurityConfig` |
| **LOW** | Login 401 never says why (good for enumeration, poor UX) | `AuthController.login` |
| **LOW** | `.env.example` ships `DEV_PASSWORD=placeholder`, `SPRING_PROFILES_ACTIVE=dev-authority`; bootstrap refuses prod/staging/live profile names but a mis-named profile bypasses that check | `DevelopmentAuthorityBootstrap` |
| **LOW** | CORS allows only `http://localhost:5173` by default; irrelevant to native clients | `SecurityConfig.corsConfigurationSource` |
| info | No SQL-injection pattern observed in the services read (parameterised `JdbcTemplate`/JPA); **UNVERIFIED** for the product module | – |
| info | Passwords hashed with `DelegatingPasswordEncoder`; hash never returned by any DTO read | `AuthController`, `CredentialEncodingConfiguration` |
| info | No debug/actuator endpoints beyond `health` | `application.yml` |

JWT validation/refresh-token security: **not applicable** (not implemented).

## 18. Test environment

- **Production:** do not test against it.
- **Staging:** none defined in the repo. **UNVERIFIED**.
- **Local development:** run the backend with PostgreSQL (`DB_*` env vars, see `backend/.env.example`), profile
  `dev-authority`, `TRIOLOO_DEV_IDENTITY_PROVISION=true`, and your own `DEV_USERNAME`/`DEV_PASSWORD` in a git-ignored `.env`.
  This creates one ACTIVE account holding every permission. Android emulator base URL `http://10.0.2.2:8080`.
- To test permission-denied paths, create a second profile/role through the DB or admin tooling (no REST user-admin exists);
  no seed roles or seed orders ship with the repo. Orders arrive via the Daraz pull (`ORDER_PULL_ENABLED`, needs real
  credentials — do not use live shops casually) or `POST /api/order/orders`.
- Steadfast booking hits a **real courier** when keys are configured; leave `STEADFAST_*` blank locally to get a 503
  instead of creating real parcels.

## 19. Swagger / OpenAPI
**Does not exist.** No dependency, no config, no `/v3/api-docs`. This file and `docs/ORDER_MODULE_PAGE_CONTRACT.md` /
`docs/ORDERS_SCREEN_CONTRACT.md` are the only contracts. Adding springdoc is a dependency decision (CLAUDE.md §12) and
was not made.

## 20. Recommended Android integration order
1. Networking: OkHttp + persistent CookieJar + CSRF interceptor; `BigDecimal` money adapter; ISO `Instant` adapter; tolerant error parser (§7).
2. Auth: `csrf → login → me → logout`; restore via `me`; handle 401 globally.
3. Orders: summary + list (page/size) + detail (read-only). Show "Unknown" for nulls; keep marketplace vs canonical status separate.
4. Invoice view (treat 404 as "not issued").
5. Shipment tracking refresh, then booking (confirm dialog, no auto-retry).
6. Manual order create — only after the backend adds an idempotency key (or accept duplicate risk knowingly).
7. Everything in §15 waits for backend work and, per `CLAUDE.md` §5, canonical business rules.

## Blockers before Android integration can be called safe
1. Decision on mobile authentication (cookie+CSRF vs a new token mechanism) — not ratified in `docs/`; needs an explicit decision.
2. Uniform error envelope.
3. Idempotency for order creation.
4. Per-shop authorisation review.
5. Almost all modules beyond Orders/Delivery/Invoice have no API.
