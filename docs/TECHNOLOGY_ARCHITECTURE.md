# Technology Architecture

**Owner:** Trioloo Technology · **Module:** Cross-cutting · **Status:** Canonical
**Version:** 1.4.0 · **Ratified:** 2026-08-10 · **Amended:** 2026-08-16 (**`TEC-119` credential encryption at rest; `TEC-120` OAuth callback correlation**) · **Amended:** 2026-08-16 (§12.2 — `GAP-120` no longer listed as open) · **Amended:** 2026-08-16 (**`TEC-115` split — production hosting DEFINED, containers/orchestration/CI-CD NOT ADOPTED; `TEC-116`–`TEC-118`**) · **Amended:** 2026-08-13 (`TEC-104` evidence-store scope clarified; `TEC-105` commercial media storage undefined) · **Rule prefix:** `TEC-`

---

## Document Control

**Source of truth:** the locked V1 stack decision (2026-08-10) and the Technology Constraint Register derived from the canonical corpus.

**Inherits:** `SYS-076` **as amended 2026-08-10** — see `TEC-000`.
**References:** `DATABASE_ARCHITECTURE.md` · `SYSTEM_ARCHITECTURE.md` · `API_ARCHITECTURE.md` · `ACCOUNTING_ARCHITECTURE.md` · `PAYMENT_ARCHITECTURE.md` · `HR_PAYROLL_ARCHITECTURE.md` · `PERMISSION_ARCHITECTURE.md` · `EVENT_ARCHITECTURE.md` · `DOCUMENT_ARCHITECTURE.md` · `DESIGN_CONSTITUTION.md` v2.1.1.

---

# 0. Authority and the `SYS-076` boundary

> **TEC-000 — This is the ONLY document permitted to name a technology.** `SYS-076` requires that *"no architecture document names a technology … this documentation set must remain true across a change of language, framework, database, or hosting model."*
>
> ✅ **`SYS-076` is AMENDED with a single scoped exception rather than weakened.** **Every other document remains technology-free**, and **the business architecture stays portable**: a future change of stack rewrites this document and touches no other.
>
> 🔴 **Naming a technology anywhere else is a defect.** A domain rule that mentions Hibernate, React or PostgreSQL has bound business truth to an implementation.

> **TEC-001 — Where this document and a business rule appear to conflict, the business rule wins and this document is wrong.** Technology serves the architecture; it never reinterprets it.

---

# 1. The Locked Stack

## 1.1 Backend

| Element | Locked |
|---|---|
| Language | **Java 25 LTS** |
| Framework | **Spring Boot 4.1.x** |
| Build | **Maven** |
| Web | **Spring Web** |
| Persistence | **Spring Data JPA** with **Hibernate ORM as managed by Spring Boot** |
| Validation | **Jakarta Bean Validation** |
| Security | **Spring Security** |
| Schema evolution | **Flyway** |

## 1.2 Database

| Element | Locked |
|---|---|
| Engine | **PostgreSQL 18.x** — current supported 18.x patch release in deployment |
| Count | **One authoritative database** |

## 1.3 Frontend

| Element | Locked |
|---|---|
| Library | **React 19.x** |
| Language | **TypeScript** |
| Build | **Vite** |
| Transport | **REST / JSON to Spring Boot** |

## 1.4 Shape

> **TEC-002 — Modular Monolith. One deployable backend, one authoritative PostgreSQL database, hard internal module boundaries, no microservices in V1.**

✅ **This is not a compromise; it is the shape the architecture requires.** **`HRP-075` demands that Final Settlement finalisation apply recoveries atomically across positions owned by Accounting**, and **`EVA-034` records that asynchronous delivery cannot provide that.** ⚠ **A microservice split would put a network and an eventual-consistency boundary exactly where a ratified rule requires a transaction.**

## 1.5 Excluded until a proven requirement authorises otherwise

**Java 21 · Spring Boot 3.x · Gradle · Thymeleaf as the primary ERP frontend · MySQL · microservices · Kafka · RabbitMQ · Redis · Elasticsearch/OpenSearch · Kubernetes · Material UI · Ant Design · Bootstrap.**

> **TEC-003 — An excluded technology enters only on a proven requirement, recorded as an amendment.** ⚠ **"It would be convenient" is not a proven requirement.**

---

# 2. Monetary Correctness

> **TEC-010 — Java money is `BigDecimal`. PostgreSQL money is exact `NUMERIC`/`DECIMAL`.** (`DB-037`)
>
> 🔴 **`double`, `float`, `Double` or `Float` in any monetary path is a defect**, including DTOs, projections and test fixtures.

> **TEC-011 — The implementation applies the canonical ERP-wide BDT monetary rounding policy owned by `DB-079`: 2 decimal places, `HALF_UP`, line rounded before aggregation, totals summed from rounded lines.**
>
> ✅ **`DB-079` is the POLICY AUTHORITY. `TEC-011` is its implementation consequence and nothing more** (`DOC-005`, `DOC-006`). ⚠ **This document does not own monetary policy and must not be read as the source of it.**
>
> **Java `BigDecimal.setScale(2, RoundingMode.HALF_UP)` at the line; PostgreSQL `NUMERIC(_, 2)` for stored monetary amounts; higher scale for rate and cost columns** (`TEC-012`).
>
> **Consumed alongside** `ACC-098` (postings and settlements) · `ICO-036`/`ICO-037` (costing — 🔴 **the WAC unit cost is a RATE and stays high precision**) · `HRP-025` (payroll lines).
>
> ⚠ **Historical note:** **when this document was first ratified, `BD-482` §10 still scoped the policy to payroll and `TEC-011` recorded the extension as owed propagation.** ✅ **That propagation is complete: `DB-079` now owns it and this rule consumes it.**

> **TEC-012 — Intermediate rates and unit costs retain high precision. Only the monetary line result is rounded.** (`BD-482` §2, `HRP-025`, `ICO-001`)
>
> **High-precision derived rate → compute the line → round the line to 2dp → sum rounded lines → totals.** ⚠ **Never recalculate a total independently from raw rates** (`INV-94.1`).

> **TEC-013 — `BigDecimal` arithmetic must specify scale and `RoundingMode` explicitly at the rounding point.** ⚠ **`BigDecimal.divide` without a `MathContext` or scale throws on non-terminating decimals** — `Monthly ÷ 30 ÷ scheduled hours` (`HRP-024`) is exactly that case. **The division retains high precision; the line rounds.**

> **TEC-014 — `BigDecimal` equality uses `compareTo`, never `equals`.** ⚠ **`equals` compares scale**, so `2.50` and `2.5` are unequal — a silent defect in reconciliation checks such as `HRP-045` and `INV-99.1`'s exact-sum requirement.

> **TEC-015 — 🔴 Money crosses the REST boundary as a JSON STRING, never a JSON number.**
>
> 🔴 **This is the single most likely place for `DB-037` to be violated in practice.** **Jackson serialises `BigDecimal` as a JSON number by default; JavaScript parses every JSON number as IEEE-754 double.** ⚠ **A `৳8,42,300.55` round-trip through the React client would silently lose exactness** — precisely what `DB-037` exists to prevent.
>
> ✅ **The TypeScript client treats money as an opaque string and performs no arithmetic on it.** **Authoritative calculation is server-side** (`DB-001`, `ACC-001`, `HRP-024`).

> **TEC-016 — Rounding that materially affects a total is recorded, not merely applied** (`DB-039`). **It is data, not presentation.**

> **TEC-017 — Currency is carried with every monetary value** (`DB-036`, `SYS-029`). **BDT is the only V1 currency; the field is not omitted because there is one.**

---

# 3. Persistence Discipline

## 3.1 Schema ownership

> **TEC-020 — Flyway owns schema evolution. Hibernate must not mutate the production schema.**
>
> **`spring.jpa.hibernate.ddl-auto` is `validate` or `none` in every environment that holds real data.** 🔴 **`update`, `create` or `create-drop` against production is a defect.**

> **TEC-021 — Every migration is forward-only and additive where it touches historical data** (`DB-002`, `DB-003`).
>
> ⚠ **A migration that rewrites historical rows to fit a new shape violates the immutability discipline as surely as an application `UPDATE` would.** **Backfill by adding, never by editing.**

## 3.2 🔴 Immutability against an ORM's defaults

> **TEC-022 — Records the architecture declares immutable are insert-only in code, not merely by convention.**
>
> ⚠ **This is the sharpest friction between the stack and the corpus.** **JPA's default lifecycle is a mutable managed entity with dirty-checking that emits `UPDATE`.** **The architecture forbids that for historical facts** — `DB-002` (compensating record, never edit or delete) · `INV-93.1` (finalised payroll) · `INV-100.5` (finalised settlement) · `INV-91.3` (attendance corrections) · `BR-031` (tracking history) · `INV-95.3` (**even a pending decision**).
>
> ✅ **Immutable entities expose no setters, are constructed complete, and are annotated `@Immutable` where Hibernate supports it.** **A correction is a new row linked to the original.**

> **TEC-023 — Effective-dated and versioned facts are modelled as rows, never as overwritten columns** (`SYS-021`, `INV-90.2`, `INV-98.5`, `INV-95.1`).
>
> ✅ **`HRP-005` is the load-bearing case: salary history is the ONLY mechanism by which a historical payroll run can be recomputed correctly**, because `BD-458`'s figures are derived and unstored and no run retains its salary basis.

> **TEC-024 — Master and configuration records are archived, never deleted** (`SYS-024`, `PRM-021`). **No hard delete exists in the data model.**

## 3.3 🔴 Derived positions

> **TEC-025 — No column stores a balance the canonical architecture defines as derived.**
>
> **Prohibited:** Employee Loan outstanding (`ACC-088`) · Advance Requisition outstanding (`ACC-069`) · Outstanding Salary Payable (`ACC-093`) · Final Settlement Position (`INV-100.1`) · any employee aggregate debt (`INV-99.1`).
>
> ✅ **Each is computed from movement history at read time and must be reproducible as-of a date.**

> **TEC-026 — Position queries are expressed as aggregate projections, not by loading entity graphs.**
>
> ⚠ **JPA is weak at this and the temptation to cache a balance will be constant.** **Spring Data projections, JPQL aggregates or native queries are the correct instruments.** 🔴 **A `@Formula`, a materialised column or a denormalised balance table reintroduces exactly what `DB-001` forbids.**

> **TEC-027 — ⚠ The retention/derivation tension is a permanent characteristic, not a defect to optimise away.**
>
> **Retention is effectively unbounded** — `AUD-037` was superseded because **nothing is ever deleted**, so the 12-year warranty and the 5-year guideline are not in tension. **Combined with `TEC-025`, position queries scan a monotonically growing history.**
>
> ✅ **Permitted mitigations that preserve the invariant:** indexing · covering indexes on movement tables · **read-only reporting projections that are explicitly derived and rebuildable** · PostgreSQL partitioning by period. 🔴 **A cached balance treated as authoritative is not a mitigation; it is the prohibited thing.**

## 3.4 Identifiers

> **TEC-028 — Business identifiers are never reused, including after cancellation** (`DB-006`, `DB-012`). **A cancelled invoice number is retired, not recycled.**
>
> ⚠ **A plain PostgreSQL sequence leaves gaps on rollback.** **Gaps from retirement are required by `DB-012`; gaps from a failed transaction are a different thing.** **Whether the invoice sequence must be gapless beyond retirement is `NOT DEFINED BY SOURCE` and must not be assumed.**

> **TEC-029 — External identifiers are stored exactly as received, unnormalised** (`DB-046`, `INV-54.1`, `API-030`).

> **TEC-030 — Internal entity identity is never the human-facing document number** (`PRN-014`). **Two separate concerns, two separate fields.**

---

# 4. Transactions, Atomicity and Concurrency

> **TEC-040 — Final Settlement finalisation executes in a single synchronous database transaction.** (`HRP-074`, `HRP-075`, `INV-100.4`)
>
> 🔴 **`EVA-034` is preserved absolutely: asynchronous event delivery must NOT be used to implement the atomic settlement commit.** **At-least-once delivery cannot provide all-or-nothing coordination** (`SYS-051`, `API-035`).
>
> ⚠ **A loan recovery applied while an AR recovery failed, with the settlement marked `FINALIZED`, is the prohibited outcome.** **Either the complete authorised application commits, or finalisation fails and nothing is written.**

> **TEC-041 — Build and component reservation is atomic** (`INV-27.4`, `INV-65.2`, `PRD-026`).

> **TEC-042 — Cross-module calls inside a transaction are in-process explicit requests, never network calls.** ✅ **This is what `TEC-002`'s modular monolith exists to make possible** (`SYS-006`).

## 4.1 Concurrency invariants — the implementation must preserve these

> **TEC-043 — Lost-update prevention is mandatory wherever a bound is evaluated against a value another transaction may change.**

| # | Invariant | Evidence |
|---|---|---|
| 1 | **A payroll run finalises exactly once** | `INV-93.1` |
| 2 | **A settlement finalises exactly once, atomically** | `HRP-075` |
| 3 | **`0 ≤ Applied ≤ Authorised ≤ Outstanding` holds under concurrency** | `INV-101.1` |
| 4 | **`Σ Authorised ≤ Available` is evaluated against a consistent snapshot** | `INV-101.3` |
| 5 | **A write-off never exceeds outstanding *at the point applied*** | `INV-99.4` |
| 6 | **Loan recovery never exceeds remaining balance** | `HRP-049` |
| 7 | **Authority takeover is one-way; races produce one transition** | `BR-175` |
| 8 | **Inventory reservation is atomic** | `INV-27.4` |
| 9 | **An issued business identifier is never reused** | `DB-012` |

⚠ **Optimistic locking, pessimistic locking and isolation level are implementation choices.** **The invariants are not.**

> **TEC-044 — ✅ Employee Loan payroll recovery revalidates the current outstanding balance at payroll finalisation.**
>
> ✅ **This RESOLVES the gap reported at `BD-486`** — *nothing stated whether payroll binds the outstanding position at computation or at finalisation.* ⚠ **Binding at computation would have let `HRP-049`'s ceiling be evaluated against a stale figure**, which is the over-recovery the ceiling exists to prevent. **Finalisation-time revalidation closes it.**

---

# 5. Time, Date and Timezone

> **TEC-050 — The canonical business timezone is `Asia/Dhaka`.** ✅ **This RESOLVES the timezone policy recorded as `NOT DEFINED BY SOURCE`.**

> **TEC-051 — Real event timestamps preserve INSTANT semantics.**

| Kind | Java | PostgreSQL | Used for |
|---|---|---|---|
| **Instant** | `Instant` / `OffsetDateTime` | `timestamptz` | Actor timestamps · `Confirmed At` · attendance session capture · external and courier event times |
| **Business date** | `LocalDate` | `date` | Attendance date · leave start/end · effective dates · order date |
| **Local time of day** | `LocalTime` | `time` | Scheduled start/end · lunch interval · grace period |
| **Payroll period** | Year-month | `date` (first of month) or explicit period columns | Calendar month (`HRP-026`) |

> **TEC-052 — A business date is never derived from an instant without applying `Asia/Dhaka`.** ⚠ **A UTC-truncated timestamp near midnight lands attendance, orders and payroll on the wrong day.**

> **TEC-053 — External timestamps retain both event time and record time** (`BR-030`). **Provenance survives; they are not collapsed.**

---

# 6. Integration

> **TEC-060 — Every adapter is idempotent** (`SYS-045`, `API-024`). **External parties re-send, duplicate and re-order as normal behaviour, not as error.**
> **TEC-061 — Duplicate imports are absorbed and recorded, never reapplied** (`API-025`).
> **TEC-062 — Out-of-sequence external events are retained as exceptions, never forced** (`API-028`).
> **TEC-063 — Raw payloads and settlement reports are retained exactly as received** (`API-030`, `API-031`, `AUD-009`).

> **TEC-064 — 🔴 Order sync authority is decided by the authority STATE, never by recency.**
>
> **`BR-170` forbids last-write-wins and latest-timestamp-wins.** ⚠ **The conventional sync implementation — compare timestamps, newest wins — is explicitly prohibited.** **`API_MANAGED` → `ERP_MANAGED` is one-way, attributable and irreversible in V1** (`BR-168`, `BR-175`), and **externally-authoritative facts keep syncing in both states** (`BR-171`).

> **TEC-065 — No message broker exists in V1.** **Kafka, RabbitMQ and equivalents are excluded** (`TEC-003`). ✅ **The 102 registered events are in-process; the six proven negatives mean no new event may be invented to justify one.**

---

# 7. Security and Authorization

> **TEC-070 — Backend authorization is authoritative. The UI is never a security boundary.**
>
> **Enforced by the owning module at every entry point — interactive, bulk, integration and automated** (`PRM-004`, `SYS-035`, `API-007`). 🔴 **Hiding an action in React is an affordance, not a control.**

> **TEC-071 — Scope is enforced on read AND on write** (`SYS-020`, `PRM-009`, `AGV-020`). ⚠ **A read path that omits scope leaks data no write path would have allowed.**

> **TEC-072 — Deny by default** (`PRM-003`). **No `isAdmin → skip` branch exists** (`PRM-068`, `AGV-033`).

> **TEC-073 — `PRM-006`'s self-approval discipline is enforced in code with exactly four named exceptions** — Advance Requisition (`PRM-071`) · Payroll Deduction Waiver (`PRM-073`) · Employee Loan Authorisation and Loan Pause/Reduction (`PRM-077`). ⚠ **No fifth exception exists.** **`PRM-086` records that Final Settlement finalisation is not an approval and therefore engages nothing.**

> **TEC-074 — Salary and settlement data are a separately grantable sensitive class** (`PRM-011`, `PRM-083`, `AGV-012`). ⚠ **Payroll access does not imply salary visibility, and neither implies waiver or issuance authority** (`PRM-080`).

> **TEC-075 — Owner is not a role and is never assignable through role management** (`AGV-037`, `AGV-039`). **It is unreachable through role assignment, scope grant or permission override.**

---

# 8. API Design

> **TEC-080 — JPA entities are never public API contracts.** **Request and response models are explicit DTOs.**
>
> ⚠ **Exposing entities leaks the persistence model, couples the client to schema evolution Flyway owns, and makes `TEC-015`'s money-as-string discipline unenforceable.**

> **TEC-081 — The API surface is REST/JSON.** **Endpoints, payload shapes, versioning and error format are engineering deliverables** (`API-001`, `SYS-076`) **and are not specified by any architecture document.**

> **TEC-082 — Validation is enforced by the owning module, never by the caller** (`SYS-035`). **Jakarta Bean Validation on the DTO is the outer layer, not the authority.**

> **TEC-083 — Refusal is a normal outcome, not an error condition** (`SYS-032`, `API-041`). **A refused cross-module request is a designed result.**

> **TEC-084 — `absent` is distinguishable from zero, empty and false across the wire** (`DB-005`, `SYS-034`, `API-008`). ⚠ **A null coalesced to `0` in a DTO destroys `SYS-034`.**

---

# 9. Frontend

> **TEC-090 — React 19.x + TypeScript + Vite, communicating with Spring Boot over REST/JSON.**

> **TEC-091 — 🔴 No opinionated component library.** **Material UI, Ant Design and Bootstrap are excluded** (`TEC-003`).
>
> ✅ **This is a design-authority decision, not a taste one.** **`DESIGN_CONSTITUTION.md` v2.1.1 fixes exact tokens** — Manrope 400/500/600/700/800 · the OKLCH palette verbatim (`RULE 3.3.c`) · 216px sidebar · 1560px content · two shadows only · a 7–9/10–12/14–16px radius system. ⚠ **A library shipping its own type scale, radius set, colour ramp and responsive row-stacking is a competing design authority.**

> **TEC-092 — The frontend must reproduce the approved composition without substituting framework defaults for exact tokens.**

> **TEC-093 — Zoom and layout stability are implementation obligations** (`DESIGN_CONSTITUTION.md` Article VII):
>
> **100% canonical · 80% first-class** (`RULE 7.2`) · 🔴 **zoom never changes records, page size, fields, actions, workflow, calculations, sorting, filtering or API behaviour** (`RULE 7.3.a`) · **structured operational rows never structurally wrap** (`RULE 7.4`) · **no global `flex-wrap: wrap`** (`RULE 7.5.a`) · **no global `white-space: nowrap`** (`RULE 7.7`) · **page-level regions may reflow, rows never** (`RULE 7.8.a`, `7.8.b`) · **zoom never suppressed** (`RULE 7.9`).
>
> ⚠ **`RULE 7.3.a` forbids viewport-driven data fetching** — a pattern several data-grid components ship by default. **A component that changes page size on resize violates a ratified rule.**

> **TEC-094 — No breakpoint may be invented** (`RULE 7.10`). **Mobile and tablet behaviour remains undesigned.**

> **TEC-095 — The client never owns an authoritative calculation** (`DB-001`, `ACC-001`, `HRP-024`). **It renders server-computed figures.** ✅ **Consistent with `TEC-015`: money arrives as a string and is not arithmetic material.**

> **TEC-096 — Search, filter, sort and pagination are server-side.** ⚠ **Loading a dataset into the browser to filter it contradicts `TEC-095` and does not survive the corpus's unbounded retention.**

---

# 10. Documents and Attachments

> **TEC-100 — Rendering never creates a business event** (`PRN-001`). **A print endpoint has no side effect on business state.**
> **TEC-101 — A document snapshots only where its source can still change** (`PRN-005`, `PRN-006`). **Finalised payroll and settlement records are already immutable; their documents render.**
> **TEC-102 — A reprint reproduces historical content** (`PRN-009`). ✅ **Guaranteed by `TEC-023`'s effective-dated rows, not by a rendering trick.**
> **TEC-103 — Nine documents have no numbering rule and none may be invented** (`PRN-012`, `PRN-015`).
> **TEC-104 — `E-054` Attachment is the only evidence store** (`PRN-021`, `BD-445`). ⚠ **No second document store, scanning workflow, OCR or mandatory upload.** **Object-storage technology is `NOT DEFINED BY SOURCE`.**
>
> ✅ **SCOPE CLARIFIED 2026-08-13 (`DOC-079`) — the rule is UNCHANGED and is not weakened.** 🔴 **"Only evidence store" is a statement about EVIDENCE AND DOCUMENT STORAGE SEMANTICS, not about every file the business holds.** **`E-054` exists to retain what PROVES something about a record — proof of delivery, settlement reports as received, supplier invoices, QC evidence photographs, correspondence, claim documentation — under `INV-54.1`'s unaltered-as-received discipline.**
>
> ⚠ **PRODUCT COMMERCIAL MEDIA IS NOT EVIDENCE MERELY BECAUSE IT IS AN IMAGE.** **Authored marketing media answers *what does the business publish about what it sells*, proves nothing, and is reusable across records — none of which is true of evidence.** ✅ **It is `E-105` Media Asset, Product-owned** (`DM-082`, `PRD-167`).
>
> 🔴 **NOTHING HERE RELAXES `TEC-104`.** **No second EVIDENCE store is created, and the prohibition on a scanning workflow, OCR and mandatory upload is untouched.** 🔴 **No storage technology is selected by this clarification** — see `TEC-105`.

> **TEC-105 — 🔴 COMMERCIAL MEDIA STORAGE TECHNOLOGY IS `NOT DEFINED BY SOURCE`. Ratified 2026-08-13.**
>
> **`E-105` Media Asset may carry a storage/reference concept sufficient to IDENTIFY the media and nothing more** (`PRD-167.c`, `INV-105.5`).
>
> **a.** 🔴 **NO PROVIDER OR MECHANISM IS SELECTED.** **Not S3, not DigitalOcean Spaces, not MinIO, not local filesystem, not any CDN vendor, not any cloud provider, not a signed-URL scheme and not an upload framework.**
> **b.** 🔴 **A DATABASE REFERENCE FIELD IS NEVER PROOF OF A STORAGE TECHNOLOGY** — the `RULE 3.15.a.b` principle applied to persistence: *a reference is not a schema*, and a schema is not a hosting decision.
> **c.** ✅ **Any authoritative provider or hosting mechanism requires a LATER Technology Architecture amendment** under `TEC-003` and the normal governance process. ⚠ **Convenience is not a proven requirement.**
> **d.** ⚠ **Upload size limits, accepted image formats, resizing, compression and CDN behaviour are ALL undecided** and are not inferable from this rule (`PRD-172.f` records the parallel content-side openings).

---

# 11. Observability, Deployment and Recovery

> **TEC-110 — Attribution is a write-path obligation, not a logging concern** (`AGV-001`, `INV-77.1` — **"cannot be retrofitted"**). **Every write carries an actor from day one.**
> **TEC-111 — Adapters record provenance** — what was received, from whom, when, in what form (`SYS-046`, `API-029`).
> **TEC-112 — `MANUAL_REQUIRED` is a normal state; `DIVERGED` is always an exception, never silently corrected in either direction** (`SYS-025`, `SYS-026`).
> **TEC-113 — Monitoring, logging and tracing vendors are `NOT DEFINED BY SOURCE`.**
> **TEC-114 — Restore must not violate historical correctness** — it cannot resurrect a retired identifier (`DB-012`) or reopen a finalised run (`INV-93.1`).
> **TEC-115 — ⚠ AMENDED 2026-08-16. THE PRODUCTION HOSTING TOPOLOGY IS NOW DEFINED; CONTAINERS, ORCHESTRATION AND CI/CD REMAIN NOT ADOPTED.**
>
> ⚠ **Superseded wording retained** (`DOC-009`): *"Container, orchestration, cloud and CI/CD platforms are `NOT DEFINED BY SOURCE`. Kubernetes is excluded."* 🔴 **That sentence conflated two different things** — where the application actually runs, and whether it is containerised or automatically delivered. **The first is now a ratified user decision; the second is not adopted.**
>
> **a.** ✅ **DEFINED — THE CURRENT PRODUCTION HOSTING:** **a DigitalOcean Ubuntu virtual machine** · **Nginx** as web server and reverse proxy · **the Java backend as an OS-managed service bound to `127.0.0.1:8080`** · **the frontend as a static production build served by Nginx** · **PostgreSQL** as the production database (`TEC-001`) · **Flyway** as the schema authority (`PRJ-081`) · **Cloudflare** as DNS and proxy in front of `user.trioloo.com`. 🔴 **The operational origin is a fixed server address, recorded in `PRODUCTION_DEPLOYMENT_RUNBOOK.md` `DEP-001`, and is NOT the Cloudflare edge** (`TEC-117`).
>
> **b.** 🔴 **NOT ADOPTED, AND NOT REQUIRED:** **containers** · **container registries** · **orchestration — Kubernetes remains EXCLUDED** (`TEC-003`) · **CI/CD automation of any kind** · **infrastructure-as-code tooling.** ⚠ **THIS IS A RECORDED POSITION, NOT AN OVERSIGHT.** ✅ **Deployment is a documented MANUAL procedure** (`TEC-116`), **and no document may imply an automated pipeline exists.**
>
> **c.** ✅ **Adopting any item in b. remains a `TEC-003` amendment on a proven requirement.** ⚠ **"It would be convenient" is still not one.**

> **TEC-116 — ✅ DEPLOYMENT IS A DOCUMENTED MANUAL PROCEDURE, AND ITS AUTHORITY IS `PRODUCTION_DEPLOYMENT_RUNBOOK.md`. Ratified 2026-08-16.** 🔴 **No CI/CD system exists, and no repository automation deploys anything.** ✅ **The runbook owns the sequence, the gates and the stop conditions; this document owns only the technology choices behind them.**

> **TEC-117 — 🔴 THE PUBLIC EDGE ADDRESS IS NEVER THE ORIGIN SERVER. Ratified 2026-08-16.** **`user.trioloo.com` is Cloudflare-proxied, so DNS returns anycast EDGE addresses that belong to Cloudflare and not to Trioloo.** 🔴 **Operations target the origin recorded in `DEP-001` — never a resolved public address.** ⚠ **A Cloudflare `5xx` such as `521` reports the EDGE's view of the origin and is evidence to investigate, never a diagnosis** (`DEP-100`).

> **TEC-118 — ✅ SCHEMA MIGRATIONS EXECUTE IN-PROCESS AT BACKEND STARTUP. Ratified 2026-08-16.** **`spring.flyway.enabled` is `true` over `classpath:db/migration`, and NO standalone Flyway CLI is part of this project.** 🔴 **STARTING A NEW BACKEND ARTIFACT IS THEREFORE THE ACT THAT APPLIES PENDING MIGRATIONS**, and the two cannot be sequenced independently — which is why the database backup gate closes BEFORE the new artifact starts (`DEP-060`, `DEP-071`). ⚠ **`validate-on-migrate` is `true` and `baseline-on-migrate` is `false`: a checksum mismatch or an unbaselined non-empty database FAILS STARTUP BY DESIGN, and is investigated rather than bypassed.**

> **TEC-119 — 🔴 PROVIDER AUTHORISATION MATERIAL IS ENCRYPTED AT REST AND BOUND TO ITS OWNER. Ratified 2026-08-16.**
>
> **`API-070` states the boundary and leaves the mechanism to engineering (`API-044`). This is the mechanism.**
>
> **a.** ✅ **AES-256-GCM, 128-bit tag, a fresh 12-byte `SecureRandom` IV per encryption.** **Stored blob: `scheme_version(1) ‖ iv(12) ‖ ciphertext ‖ tag(16)`.**
> **b.** 🔴 **THE AUTHENTICATION TAG ALONE IS NOT ENOUGH, AND ASSUMING OTHERWISE IS A REAL DEFECT.** **It proves a ciphertext is intact under a key; it does NOT prove where that ciphertext belongs.** ⚠ **Every shop's material is protected by the SAME master key, so without contextual binding an attacker with database write access could copy shop A's blob into shop B's row — and shop B would then transact against shop A's marketplace account.**
> **c.** ✅ **THEREFORE EVERY SECRET IS BOUND TO ITS CONTEXT through 21 fixed-width bytes of additional authenticated data:** `aad_version(u8) ‖ scheme_version(u8) ‖ key_version(u16 BE) ‖ channel_instance_id(16, MSB first) ‖ token_kind(u8)`. **Fixed width throughout, so no two contexts can encode alike;** 🔴 **ambiguous string concatenation is forbidden.** ✅ **Token codes are explicit and permanent — `1 = ACCESS_TOKEN`, `2 = REFRESH_TOKEN`;** 🔴 **never a Java `ordinal()`, which an innocent reordering would silently invalidate every stored credential with.**
> **d.** ✅ **THE KEY VERSION IS BOUND TOO**, so rewriting the database column that selects the key fails authentication instead of selecting another key.
> **e.** 🔴 **ONE KEY VERSION PER CREDENTIAL ROW.** **Every present ciphertext in a row is encrypted under that row's `encryption_key_version`.** ✅ **Any mutation after the active key changes re-encrypts ALL present material and updates the version atomically**, so material migrates as it is used and no sweep opens every row at once. ⚠ **A mixed-version row would carry one version number describing two different keys and one of its tokens would become permanently unreadable.**
> **f.** 🔴 **THE KEY NEVER ENTERS THE DATABASE**, the repository or a log. **It arrives only from deployment environment configuration**, so a database dump alone contains nothing usable. **Variable NAMES are recorded in `PRODUCTION_DEPLOYMENT_RUNBOOK.md` (`DEP-123`); no value appears in any document.**
> **g.** ✅ **EXPIRY MAY BE UNKNOWN AT THE GENERIC LAYER.** **Storage asserts only that an access token exists and that an expiry cannot describe a token that does not** — **a refresh token whose expiry the provider never reported is legitimate** (`SYS-034`). 🔴 **PROVIDER-SPECIFIC REQUIREMENTS ARE THE ADAPTER'S:** **Daraz supplies both durations, so the Daraz adapter must reject a token response missing either.** ⚠ **Encoding one provider's habit as a database constraint would misdescribe every other provider.**
> **h.** ✅ **REMOTE IDENTITY IS NOT DUPLICATED INTO THE CREDENTIAL STORE.** **`channel_instance.external_account_identity` remains the single authority** (`INV-16.5`, `API-070.c`); ⚠ **a convenience copy would be a second seller identity able to disagree with the first.**
> **i.** ✅ **DISCONNECT DESTROYS THE MATERIAL.** **The credential row is DELETED; the Channel Instance, its bound identity, `bound_at` and `authorised_at` all survive** (`INV-16.10`). 🔴 **A revoked token has no business value and retaining it is pure liability.**
> **j.** ✅ **A SILENT TOKEN REFRESH IS NOT AN AUTHORISATION ACT.** **It moves the credential's own `refreshed_at` and NEVER `channel_instance.authorised_at`, which `INV-16.15` reserves for an authorisation the operator actually performed.**

> **TEC-120 — 🔴 OAUTH CALLBACK CORRELATION IS DATABASE-BACKED, ONE-TIME AND SHOP-BOUND. Ratified 2026-08-16.**
>
> **a.** ✅ **THE CALLBACK NEVER CHOOSES THE SHOP.** **The Channel Instance is recorded when the operator STARTS authorisation, and the returning callback can only resolve the shop bound at initiation.** 🔴 **There is no parameter through which a callback could name a shop.**
> **b.** ✅ **A high-entropy nonce is issued once; ONLY ITS SHA-256 IS PERSISTED**, so a stolen database backup yields nothing forgeable.
> **c.** ✅ **CONSUMPTION IS A SINGLE CONDITIONAL `UPDATE`** guarding unconsumed-ness and expiry together, so the DATABASE picks the winner of concurrent callbacks. ⚠ **Read-then-write would let two callbacks both observe an unconsumed attempt and both proceed.**
> **d.** ✅ **Unknown, expired and already-consumed are refused INDISTINGUISHABLY**, so a caller cannot probe which states exist.
> **e.** ⚠ **A SIGNED SELF-CONTAINED STATE WAS REJECTED**: it cannot refuse replay without server-side state anyway. ⚠ **THE HTTP SESSION WAS REJECTED** because sessions are lost on every deployment restart and would tie a security-critical flow to the `SameSite` cookie policy, which is deliberately unratified (`DEP-122.g`).

---

# 12. What this document resolves, and what it does not

## 12.1 ✅ Resolved by the locked decision

| Item | Resolution |
|---|---|
| **ERP-wide monetary rounding** — carried since `BD-482` | **`TEC-011`** — 2dp `HALF_UP` ERP-wide. ⚠ **Needs propagation to `ACCOUNTING_ARCHITECTURE.md` and `INVENTORY_COSTING_ARCHITECTURE.md`** |
| **Timezone policy** — `NOT DEFINED BY SOURCE` | **`TEC-050`** — `Asia/Dhaka` canonical, instant semantics preserved |
| **Payroll binding moment** — `BD-486` gap 1 | **`TEC-044`** — revalidated at finalisation |
| **Three stack decisions** | **`TEC-001`–`TEC-002`** |

## 12.2 🔴 Still open — technology must not invent these

**`GAP-109` opening balances** — ⚠ **a go-live business concern, not a technology decision and not a migration concern.** A clean system still needs day-one positions for inventory, accounting and employee balances.
~~**`GAP-120`** first-Owner bootstrap~~ — ✅ **CLOSED 2026-08-16** (`AGV-042`): **a ratified server-side one-time command, and the first production Owner exists.** ⚠ **Technology still invents no bootstrap.**
**`GAP-121`** granting another user an authority the grantor lacks · **`GAP-122`** Owner self-revocation and the last-Owner case · **`GAP-126`** six deduction types with no formula · **`GAP-127`** earning nominated to a period that never runs · **`GAP-128`** Quotation and Proforma (`BD-134`).
**Focus indication** (`RULE 6.0`) and **nine accessibility pairs** (`§8.3`) — a UI stage concern.
**Invoice sequence gaplessness beyond retirement** — `NOT DEFINED BY SOURCE` (`TEC-028`).

## 12.3 Future extensions that must not distort V1

Interest · deduction priority engines · mobile and tablet · leave entitlement and accrual · statutory tax and PF · Quotation and Proforma · return-based commission clawback · configurable recovery prioritisation · **legacy Laravel migration, explicitly out of V1 scope**.

---

# 13. Version History

| Version | Date | Change |
|---|---|---|
| **1.2.0** | **2026-08-13** | ✅ **`TEC-104` SCOPE CLARIFIED AND `TEC-105` ADDED — routed under `DOC-079` for Product `PRD-167`.** 🔴 **`TEC-104` IS UNCHANGED AND NOT WEAKENED: "only evidence store" is a statement about EVIDENCE AND DOCUMENT STORAGE SEMANTICS, and the prohibition on a second evidence store, scanning workflow, OCR and mandatory upload stands exactly as written.** ✅ **The clarification records that PRODUCT COMMERCIAL MEDIA IS NOT EVIDENCE MERELY BECAUSE IT IS AN IMAGE — authored marketing media proves nothing, is reusable across records and is `E-105` Media Asset, Product-owned** (`DM-082`). ✅ **`TEC-105` keeps commercial media storage `NOT DEFINED BY SOURCE`: 🔴 no S3, Spaces, MinIO, local filesystem, CDN vendor, cloud provider, signed-URL scheme or upload framework is selected, and a database reference field is never proof of a storage technology.** ⚠ **Upload size limits, accepted formats, resizing, compression and CDN behaviour remain undecided.** 🔴 **No stack element added, removed or changed; `TEC-003`'s amendment requirement governs any future provider selection.** |
| **1.0.1** | **2026-08-10** | ✅ **`TEC-011` now CONSUMES the canonical ERP-wide rounding policy at `DB-079` instead of being the sole authority for it.** **The propagation `TEC-011` flagged as owed is complete** — **`DB-079` created in `DATABASE_ARCHITECTURE.md` §10.1 as the canonical non-technology owner**, consumed by `ACC-098`, `ICO-036`/`ICO-037` and `HRP-025`. ✅ **No technology requirement removed** — `BigDecimal`, PostgreSQL `NUMERIC` and decimal-safe REST representation (`TEC-015`) all stand. ✅ **No stack change** |
| **1.4.0** | **2026-08-16** | ✅ **NEW `TEC-119` — provider authorisation material is encrypted at rest with AES-256-GCM and BOUND TO ITS OWNER through 21 fixed-width bytes of additional authenticated data.** 🔴 **REGISTERED BECAUSE THE OBVIOUS READING IS WRONG: the GCM tag proves integrity, NOT ownership, so under one master key a ciphertext could otherwise be copied between shops or between token columns and would decrypt cleanly.** ✅ **Also fixes one key version per row, the key's absence from the database, generic nullable expiry with provider-specific validation left to the adapter, no duplication of remote identity, deletion on disconnect, and that a silent refresh never moves `authorised_at`.** ✅ **NEW `TEC-120` — database-backed, one-time, shop-bound OAuth callback correlation, with the two rejected alternatives recorded.** ⚠ **No business rule changed; no key, token or secret value appears in this document.** |
| **1.3.0** | **2026-08-16** | ✅ **`TEC-115` AMENDED — the production hosting topology is DEFINED, and containers, orchestration and CI/CD are NOT ADOPTED.** ⚠ **The superseded sentence conflated two questions** (`DOC-009`): **where the application runs, and whether it is containerised or automatically delivered.** ✅ **DEFINED: DigitalOcean Ubuntu VM · Nginx · Java service on `127.0.0.1:8080` · static frontend build · PostgreSQL · Flyway · Cloudflare in front of `user.trioloo.com`.** 🔴 **NOT ADOPTED: containers, registries, orchestration (Kubernetes stays excluded), CI/CD, IaC.** ✅ **`TEC-116` names `PRODUCTION_DEPLOYMENT_RUNBOOK.md` (`DOC-091`) as the deployment authority; `TEC-117` separates the Cloudflare edge from the origin server; `TEC-118` records that Flyway runs IN-PROCESS at backend startup, so starting the artifact IS the migration.** 🔴 **This RATIFIES INFRASTRUCTURE THAT ALREADY EXISTED by user decision — no platform was chosen here, no stack item changed, and no business rule was touched.** |
| **1.0.0** | **2026-08-10** | **Initial ratification. `TEC-000` – `TEC-115`.** **Locks the V1 stack** — Java 25 LTS · Spring Boot 4.1.x · Maven · Spring Data JPA/Hibernate · Jakarta Bean Validation · Spring Security · Flyway · PostgreSQL 18.x · React 19.x · TypeScript · Vite · **modular monolith, one deployable backend, one authoritative database, no microservices.** 🔴 **`SYS-076` amended with a single scoped exception so this remains the only technology-naming document and the rest of the corpus stays portable.** ✅ **Resolves three carried items: ERP-wide rounding (`TEC-011`), timezone (`TEC-050`), payroll binding moment (`TEC-044`).** 🔴 **Records the sharpest stack/corpus frictions rather than glossing them** — **`TEC-015` money must cross REST as a string because Jackson+JavaScript would silently break `DB-037`**; **`TEC-022` JPA's dirty-checking default contradicts the immutability discipline**; **`TEC-026` derived positions resist ORM aggregation and the balance-caching temptation is permanent**; **`TEC-064` last-write-wins sync is explicitly prohibited**; **`TEC-093` viewport-driven data fetching violates `RULE 7.3.a`.** ✅ **`TEC-040` keeps `EVA-034` absolute: the settlement commit is synchronous and transactional, never event-driven.** **No business rule created, altered or reinterpreted.** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **A technology change rewrites this document and touches no other** — that is what `TEC-000` protects.

---

*This document specifies technology decisions and engineering constraints only. It creates no business rule, entity, workflow, permission or state machine, and it never overrides canonical business architecture.*
