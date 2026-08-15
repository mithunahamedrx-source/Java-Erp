# API Architecture

**Owner:** Trioloo Technology · **Module:** Integration · **Status:** Canonical
**Version:** 1.7.0 · **Ratified:** 2026-08-08 · **Amended:** 2026-08-15 (`API-071` — per-instance remote execution scope) · **Amended:** 2026-08-15 (Channel connection `§23C`, `API-068`–`API-070`) · **Amended:** 2026-08-13 (Channel Listing operations `§23B`, `API-062`–`API-067`) · **Amended:** 2026-08-10 (`API-022` scope clarified — `BD-498`) · **Rule prefix:** `API-`

---

## Document Control

**Source of truth:** [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §4.4, §7.1, §12, §13, §20 – §22 (`SYS-009` – `SYS-013`, `SYS-025`, `SYS-026`, `SYS-045` – `SYS-056`, `SYS-094` – `SYS-100`, `SYS-107`) and [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §20 Marketplace Integration (`BD-317` – `BD-328`) and §23 Chat Integration (`BD-355` – `BD-368`).

**Reconciliation records consolidated:** [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §9.11 (`BR-128` – `BR-134`) · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) §31 (`PRD-125` – `PRD-131`) · [`EVENT_ARCHITECTURE.md`](EVENT_ARCHITECTURE.md) (`EVA-001` – `EVA-018`).

**References, never duplicated:** [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) `PRM-` · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) `AGV-` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) `PAY-` · [`PROCUREMENT_ARCHITECTURE.md`](PROCUREMENT_ARCHITECTURE.md) `PRC-` · [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) `WHS-` · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **API-000 — This document answers *how the system is reached and how external parties are absorbed*. It answers nothing about what any operation means, what any module decides, or what any wire contract looks like.**

| Question | Owner |
|---|---|
| **Adapter responsibilities, capability declaration, sync lifecycle, integration boundaries** | **`API_ARCHITECTURE.md`** — `API-` |
| **Which events exist and what each carries** | [`EVENT_ARCHITECTURE.md`](EVENT_ARCHITECTURE.md) — `EVT-`, `EVA-` |
| **Event principles, module boundaries, the external party register** | [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) — `SYS-` |
| **What any business operation means** | The owning module document |
| **Whether an actor may perform an action** | [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) |
| **What a screen looks like** | [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) |

## ⚠ The one boundary this document must not cross

> **API-001 — Endpoints, contracts, payloads, protocols, message schemas, serialisation and transport are engineering deliverables. This document specifies none of them** (`SYS §17`, `SYS-076`, `DOC-019`).

**`SYS §17` states the split explicitly:** *"API endpoints, contracts, payloads, protocols — `API_ARCHITECTURE.md` specifies **integration architecture**; wire contracts are an engineering deliverable."*

**`EVENT_ARCHITECTURE.md` states the same for events:** *"'Data affected' describes what a subscriber must be able to learn, in business terms — not payload structure, field names, serialisation, or transport."*

**Wire contracts are derived from and tested against this document; they are not contained in it.**

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine, lifecycle or interface contract is introduced. **No gap is resolved by assumption** — see §22.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To define how the ERP is reached, and how parties Trioloo does not control are absorbed without deforming the system that absorbs them.

Two ratified principles set the shape, and they pull in the same direction:

> **`CP-13` — API-Ready Architecture.** *Every capability is reachable through a defined interface, not only through a screen. Integration is a permanent architectural surface, not a feature — marketplaces, couriers and future partners consume the same operations staff do, subject to the same authorisation and audit* (`PRM-004`).

> **`SYS-009` — No core module contains logic conditional on the identity of an external party.** Behaviour derives from declared attributes, never from identity.

**The first makes integration a first-class surface; the second keeps it at the edge.** Everything below follows from holding both at once.

---

# 2. Scope

## 2.1 In scope

Adapter responsibilities · capability declaration across its ratified dimensions · minimum viable capability · the authority split by data domain · the integration sync lifecycle and `MANUAL_REQUIRED` · divergence handling · idempotency and duplicate absorption · provenance and evidence retention · the event interface, internal and external · internal interaction patterns and refusal · authentication and authorisation responsibilities at every entry point · manual equivalence · the external party register · absence versus emptiness · completeness reconciliation as an open gap.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Endpoints, payloads, protocols, schemas, transport** | **Engineering** (`API-001`, `SYS §17`, `SYS-076`) |
| **The event register — which events exist, what each carries** | `EVENT_ARCHITECTURE.md` |
| **Event principles and the module map** | `SYSTEM_ARCHITECTURE.md` §13, §5.1 |
| **What any business operation means** | The owning module document |
| **Authentication mechanisms, credential storage, encryption, session transport, MFA** | **Engineering** (`PRM §2.2`, `AGV §2.2`, `SYS-076`) |
| **The authorisation decision model** | `PERMISSION_ARCHITECTURE.md` |
| **Operational identity and attribution** | `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| **Channel Listing definition and publication intent** | `PRODUCT_ARCHITECTURE.md` (`PRD-125` – `PRD-131`) |
| **Settlement reconciliation and variance** | `PAYMENT_ARCHITECTURE.md` |
| Notification delivery | `NOTIFICATION_ARCHITECTURE.md` |
| User interface | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

## 2.3 What is deliberately not enumerated

> **API-002 — No integration is specified per external party, and no party-specific rule exists anywhere in the core** (`SYS-009`, `BR-001`, `BR-005`).

**Adding a channel, courier, warehouse, payment mode or role is a configuration action, not a development action** (`SYS-013`). A new channel *type* requires an adapter; a new channel *instance* requires nothing (`SYS §18.2`).

---

# 3. Architectural Principles

## 3.1 P1 — Variation lives at the edge

> **API-003 — All external variation is absorbed by adapters at the system boundary. The core never learns an external party's name** (`SYS-009`, `SYS §4.4`).

## 3.2 P2 — An adapter is a capability declaration, not only a translator

> **API-004 — An adapter declares what it can do at all, not merely how it translates** (`SYS-094`, `PRD-125`).

**`SYS-009` and `PRD-077` confine channel-specific logic to the adapter but assume adapters differ only in *how* they translate. They also differ in *what they can do at all* — and without a declaration the system cannot distinguish a genuine sync failure from an unsupported operation.** `SYS-025`'s `MANUAL_REQUIRED` depends on that distinction being determinate.

## 3.3 P3 — External authority is explicit and split by domain

> **API-005 — For each data domain, either Trioloo is authoritative or an external party is, and this is declared rather than assumed** (`SYS-010`, `SYS-011`, `BR-133`).

## 3.4 P4 — Every automated path has a manual equivalent

> **API-006 — No integration failure, provider outage, or partner API change may halt the business** (`SYS-012`, `BR-029`, `PRD-076`).

**Automation is an efficiency, never a dependency.**

## 3.5 P5 — Every entry point enforces the full rule set

> **API-007 — Authorisation and validation are enforced by the owning module on every entry point — interactive, bulk, integration and automated** (`PRM-004`, `SYS-035`).

**A module never relies on its callers having validated correctly.** An integration entry point is not a privileged one.

## 3.6 P6 — Absence is representable

> **API-008 — Where an external party supplies no data for a field, the ERP holds "not available", never a zero or an empty set** (`BR-134`, `DB-005`, `SYS-095`).

***"No tracking events"* and *"tracking events not supported"* look identical on a screen and mean opposite things.**

---

# 4. The Adapter

> **API-009 — An adapter is defined by its responsibilities, not by its technology** (`SYS §12.2`). **Eight responsibilities are established:**

| Responsibility | Description |
|---|---|
| **Acquisition** | Obtain data from the external party by whatever means it offers |
| **Translation** | Convert external vocabulary to canonical vocabulary |
| **Enrichment** | Attach channel instance, scope, and external references |
| **Validation** | Reject structurally invalid input at the boundary |
| **Idempotency** | Guarantee that receiving the same fact twice has the effect of receiving it once |
| **Publication** | Push Trioloo-side decisions outward where the party expects them |
| **Sync state** | Maintain the lifecycle in §6 and raise divergence exceptions |
| **Manual fallback** | Support the equivalent manual operation (`SYS-012`) |

> **API-010 — `Adapter Registration` is a system configuration entity** (`SYS §6.1`). It is configuration, and configuration is **versioned with effective dates** (`SYS-021`).

> **API-011 — Translation happens before publication, so no core module ever sees a marketplace's or courier's native vocabulary** (`EVA-013`, `BR-005`, `SYS-009`).

---

# 5. Capability Declaration

> **API-012 — Channel capability is declared across seven dimensions, and the capability model is the primary thing an adapter carries** (`SYS-096`).

| # | Dimension | Source |
|---|---|---|
| 1 | Per **operation** — which actions the API supports | `BD-319` |
| 2 | Per **direction** — inbound and outbound differ | `BD-319`, `BD-324` |
| 3 | Per **field** — which attributes are writable | `BD-321` |
| 4 | Per **event** — which changes the channel reports | `BD-322` |
| 5 | Per **data element** — which settlement detail is available | `BD-323` |
| 6 | **Chat itself** — walk-in and phone never carry it | `BD-326` |
| 7 | **Attachment type** — images yes, video no | `BD-361` |

**All seven come from the business; none is proposed** (`SYS-096`). The first three are also stated at `PRD-125`.

> **API-013 — A channel constrains what may pass through it, never what a business record may hold** (`SYS-097`, `BD-361`).

**This resolves what would otherwise contradict `BD-324`:** claim evidence includes video; Daraz chat carries no video. **Both hold — the constraint is on the conduit, not the record**, and `E-054` Attachment remains one generic concept serving both.

> **API-014 — An interface restriction on attachment type is an affordance, not a control** (`SYS-097`). Limiting types in the UI spares staff a doomed action; **the channel enforces its own limits regardless.** Distinguished deliberately, because `PRM-004` requires real controls to be enforced server-side on every entry point — **and this is not that kind of rule.**

---

# 6. Minimum Viable Capability and the Sync Lifecycle

## 6.1 The floor

> **API-015 — A channel is viable at the minimum capability its business function requires; everything beyond that is opportunistic** (`SYS-095`, `BR-133`, `BD-319`).

**For a sales marketplace the floor is order status synchronization.** Tracking, courier data, delivery updates and settlement detail are synchronized **where the API offers them**, and **their absence must not prevent normal operation**.

> **API-016 — The ERP never requires duplicate manual updates where the marketplace API supports synchronization; where it does not, the ERP records the action internally and allows manual completion on the marketplace** (`BD-319`, `SYS-025`).

## 6.2 The lifecycle

> **API-017 — Every adapter maintains the integration sync lifecycle** (`SYS §7.1`). **The states and transitions are owned by `SYSTEM_ARCHITECTURE.md` and are not restated here** (`DOC-005`, `SYS-016`):

`PENDING` · `IN_PROGRESS` · `SYNCED` · `FAILED` · `MANUAL_REQUIRED` · `DIVERGED`

> **API-018 — `MANUAL_REQUIRED` is a normal terminal-adjacent state, not a system failure** (`SYS-025`). It is the operational expression of `SYS-012`: **when automation cannot proceed, a human can.**

> **API-019 — `DIVERGED` is always an exception. A mirror that no longer matches its source is never silently corrected in either direction** (`SYS-026`).

⚠ **One nuance is recorded in the discovery and carried unchanged.** `BD-063` establishes that a marketplace's reported settlement status and the money actually received **routinely differ in timing** — a normal condition, not an error. **Whether this counts as divergence or as expected lag is a distinction the documentation does not currently draw** (`PAY §6`). Recorded, not resolved.

## 6.3 Liveness is bounded by knowledge

> **API-020 — The ERP cannot notify or act faster than it learns** (`SYS-100`, `NOT-032`).

| Event origin | Liveness |
|---|---|
| **Inside the ERP** | **Genuinely live** |
| **Externally sourced** | **As live as its integration allows** — for a marketplace order, **the sync cadence is the floor** |

**Real-time delivery and real-time awareness are different things, and only the first is within the ERP's control.**

---

# 7. Authority Split by Data Domain

> **API-021 — The ERP is the *operational* source of truth; authority is split by data domain, not held wholesale by either side** (`BR-133`, `BD-319`, `SYS-010`, `SYS-011`).

| Data | System of record | Direction |
|---|---|---|
| **Order fulfilment state** — picked, packed, shipped | **ERP** | **Push** |
| **Tracking / AWB, courier** | **ERP** | **Push** |
| Listing status — active, suspended, rejected | **Marketplace** (`PRD-030`) | **Mirror in** |
| Settlement and deduction amounts | **Marketplace** (`BR-125`, `ACC-020`) | **Mirror in** |
| Order existence and unilateral cancellation | **Marketplace** (`OM §6.5`) | **Mirror in** |
| Product definition, specification, cost | **Trioloo** (`PRD-007`) | **Push** |
| **Inventory, cost and margin** | **Trioloo, always, on every channel** (`SYS-011`) | — |

**Trioloo owns what it does; the marketplace owns what it decides.**

> **API-022 — Where an external party is the system of record, Trioloo's copy is a mirror and is never locally edited** (`SYS-010`).
>
> ⚠ **Scope clarified 2026-08-10 (`BD-498`).** **Unchanged in text and force.** **For Orders, `ORDER_MANAGEMENT_ARCHITECTURE.md` §28 declares authority as a state** — **`API_MANAGED` until a meaningful authorised manual action, `ERP_MANAGED` thereafter** — **which is `API-005` satisfied, not weakened: authority is declared rather than assumed, and a declaration may be a state rather than a constant.** ✅ **`BR-171` keeps externally-authoritative facts syncing throughout, so the mirror discipline is retained exactly where an external party still holds authority.**

> **API-023 — Publication intent and listing status are distinct states with distinct owners, and intent must never overwrite status** (`PRD-128`). Recorded in `PRODUCT_ARCHITECTURE.md` as **the domain's most dangerous misreading.**

---

# 8. Idempotency and Duplicate Absorption

> **API-024 — Every adapter is idempotent** (`SYS-045`). External parties **re-send, duplicate, and re-order** as normal behaviour, not as error. *"An adapter that is not idempotent will eventually create duplicate orders, duplicate stock movements, or duplicate payments."*

> **API-025 — Duplicate imports are absorbed silently and recorded, never reapplied** (`EVA-016`, `SYS §16.1`).

> **API-026 — Duplicate prevention is enforced on deterministic identity and deferred on inferred identity** (`SYS-107`, `ACC-036`, `PAY-061`, `BD-402`). An external reference where one exists; **business validation and user confirmation where none does.**

**This is the mechanism behind `CP-8`'s boundary — something is a *judgement call* precisely when the system lacks the information to decide.**

> **API-027 — Capture method is an attribute of the record, never an identity of the event** (`SYS-107`, `PAY-007`). Manual and API capture are **two ways of recording one business event**, and the recording method never changes the treatment.

> **API-028 — Out-of-sequence external events are recorded as exceptions rather than forced** (`EVA-017`, `OM §9.7`, `SYS §16.1`). An event whose transition is illegal for the current state is **retained as evidence and raised for resolution**, never applied by force.

---

# 9. Provenance and Evidence

> **API-029 — Every adapter records provenance — what was received, from whom, when, and in what form** (`SYS-046`).

**When a partner disputes a figure, the received evidence must be producible.**

> **API-030 — An external event retains the raw payload as received** (`EVA-014`, `AUD-009`). *When a marketplace disputes a deduction or a courier disputes a delivery, the defensible position is the original message.*

> **API-031 — A settlement report is retained exactly as received, unaltered** (`INV-43.2`, `PAY-027`, `SYS-046`).

> **API-032 — Every cross-module event and every external exchange is auditable** (`SYS-063`).

---

# 10. The Event Interface

## 10.1 Principles inherited, not restated

**`SYS-048` – `SYS-056` and `EVA-002` – `EVA-012` govern events and are owned by `SYSTEM_ARCHITECTURE.md` §13 and `EVENT_ARCHITECTURE.md`.** Not restated (`SYS-016`, `DOC-006`).

> **API-033 — The event register is `EVENT_ARCHITECTURE.md`, and this document adds no event** (`DOC-005`). **One hundred and two events across sixteen domains** are registered there. *Read “eighty-seven across eleven” until 2026-08-09, when `EVT-088` registered the `Product.*` catalogue and `EVT-089` – `EVT-095` the Warranty & Repair set.*

## 10.2 The external-event rules this module carries

> **API-034 — External origin does not imply an automatic trigger** (`EVA-015`, `BR-029`). **The same canonical event may arrive by push, by poll, or by a human reading a courier portal** — and `BR-030` requires event time and record time to be distinguished when it does.

> **API-035 — Event delivery is at-least-once and subscribers are idempotent** (`SYS-051`).

> **API-036 — A subscriber failure never blocks the publisher** (`SYS-054`). *If Notification cannot send, the order still dispatches.* Subscriber failure produces a retry and, if unresolved, an exception — **never a stalled business process.**

> **API-037 — A subscriber that cannot apply an event raises an exception; it never silently discards it** (`EVA-009`, `SYS-022`).

> **API-038 — Bulk operations publish one event per affected subject, never one aggregate event** (`EVA-011`, `SYS-033`, `AUD-028`).

> **API-039 — An event is never republished to correct it; a correction is a new event that supersedes** (`EVA-012`, `DB-002`, `BR-031`).

---

# 11. Internal Interaction Rules

> **API-040 — Inter-module coupling is by event and by explicit request only. Reaching into another module's data is prohibited regardless of how convenient the access is** (`SYS-006`).

| Pattern | Use | Semantics |
|---|---|---|
| **Event** | *"This happened"* | One publisher, many subscribers; the publisher does not know or care who listens |
| **Request** | *"Please do this"* | Directed at the owning module; **may be refused** |
| **Query** | *"What is the current value?"* | Read from the owner; **never cached as a second master** |

> **API-041 — Every cross-module request may be refused, and refusal is a normal outcome, not an error condition** (`SYS-032`). *When Order Management requests a stock reservation, Inventory may refuse.* **Modules are designed expecting refusal.**

> **API-042 — No module stores an aggregate of another module's state** (`SYS-027`). Aggregate views are computed for presentation and never stored as authoritative state.

> **API-043 — Bulk operations obey the same rules as single operations, are audited individually, and report partial success per record** (`SYS-033`, `SYS-073`, `PRD-131`).

**`PRD-131` states the reach concretely:** *a batch price push across seven shops is one action with the reach of hundreds* — and `PRM-004`, `AUD §12.2` and `PRD-095` apply to it unchanged.

---

# 12. Authentication and Authorisation Responsibilities

## 12.1 The boundary

> **API-044 — Authentication mechanisms, credential storage, encryption, session transport and MFA implementation are engineering deliverables. This document, `PERMISSION_ARCHITECTURE.md` and `ACCESS_GOVERNANCE_ARCHITECTURE.md` state requirements only** (`PRM §2.2`, `AGV §2.2`, `SYS-076`).

## 12.2 What is ratified

> **API-045 — Authorisation is enforced by the module that owns the action, on every entry point — interactive, bulk, integration and automated** (`PRM-004`, `SYS-035`).

**An integration is subject to the same authorisation and audit as a member of staff** (`CP-13`). **There is no integration bypass.**

> **API-046 — Every system, integration and automation process acts under a named identity with explicit, bounded permissions, and its actions are audited exactly as a human's are** (`PRM-005`, `AGV-001`, `SYS-070`).

***"The system did it" is not an acceptable answer to an auditor.***

> **API-047 — There is no public registration. All accounts are created internally by an authorised Owner or Administrator** (`BD-370`, `AGV-011`). **Customer self-service access is confirmed not in scope** — `PRMU-6` closed by `AGV-011`.

> **API-048 — Scope is enforced on read and on write** (`SYS-020`, `PRM-009`, `AGV-020`), including on integration entry points.

⚠ **`GAP-098` is carried and bears directly on this module.** Because the business chose **explicit per-channel scope dimensions** over a generic Channel Instance dimension, **every new marketplace or messaging channel is a new *dimension*, not a new value** — and this business adds channels regularly. **A design enumerating the ten in fixed structure satisfies V1 and then forces exactly the authorization-model change the requirement forbids** (`AGV §10.2`). **Not resolved here.**

---

# 13. Manual Equivalence

> **API-049 — Every automated path has a manual equivalent that a trained user can execute** (`SYS-012`).

> **API-050 — Manual sync is a permanent first-class capability, never a fallback to be removed** (`BR-029`, `PRD-076`, `BD-060`, `BD-319`).

**Three independent confirmations exist:** manual shipment update (`BR-029`), manual settlement reconciliation where no API exists (`BD-060`, `PAY-006`), and manual completion on the marketplace where an operation is unsupported (`BD-319`).

> **API-051 — Where an operation is unsupported by a channel, the ERP records the action internally and the operation is completed manually on the channel** (`BD-319`, `API-018`).

---

# 14. External Party Register

> **API-052 — The external party register is owned by `SYSTEM_ARCHITECTURE.md` §12.3 and is not duplicated here** (`DOC-005`, `DOC-006`).

| Party | Integration | Authority | Adapter |
|---|---|---|---|
| Daraz (per shop) | Order ingestion, status sync, settlement reports | Order existence, marketplace status, settlement | Channel |
| Websites (per site) | Order ingestion | Order content | Channel |
| Social and phone | Manual capture | **None — Trioloo authoritative** | **None** |
| Couriers | Booking, tracking, COD remittance | Shipment tracking | Courier |
| Payment providers *(future)* | Collection, settlement | Transaction status | Payment |
| Accounting systems *(future)* | Ledger export | None | Accounting |

**Reproduced from `SYS §12.3` for navigation only; that table governs.**

> **API-053 — Instance multiplication, not process complexity, is the dominant operational cost** (`SYS §20`, `BD-328`). Seven seller accounts turn seven workable processes into seven repetitions of each. **Consolidation across instances is worth more than feature richness** — and this is the ordering principle for integration work.

**Confirmed in three independent domains** (`SYS §21`): marketplace instance multiplication (`BD-328`), return coordination across processes (`BD-353`), chat switching across platforms (`BD-366`). ***Integration beats capability.***

---

# 15. Absence, Silence and Completeness

> **API-054 — Detecting absence and detecting silent alteration both require reading the channel, not only writing to it** (`PRD-130`).

## 15.1 ⚠ Completeness reconciliation is unbuilt and has no owner — `GAP-085`

**Incremental sync answers *"what is new?"*. It cannot answer *"what is missing?"*.**

> **An order that never arrived is invisible from inside the ERP**, and only comparing against the channel's own list reveals it. **Staff do this manually today** (`BD-320`).

**`PRD-075` idempotency already prevents duplicates; absence has no equivalent protection.**

⚠ **`GAP-085` is carried unchanged. No reconciliation mechanism is specified here, and no owner is assigned** (`DOC-023`, `DM-001`).

## 15.2 ⚠ Late versus missing has no threshold — `GAP-086`

**Distinguishing a *late* order from a *missing* one requires a threshold that does not exist.** Recorded as a concrete instance of `GAP-024` / `SMU-5` rather than a new gap — **noted because marketplace sync is where it first has operational consequence.**

⚠ **Carried unchanged.**

---

# 16. Ownership Boundaries — Consolidated

| This module supplies | The module owns |
|---|---|
| **Every module** — the boundary at which external variation is absorbed | Its own business rules, validation and authorisation (`API-045`) |
| **Event Architecture** — nothing; it owns the register | **Which events exist and what each carries** |
| **System Architecture** — nothing; it owns the principles | **Event principles, module map, external party register, sync lifecycle states** |
| **Product** — channel sync state on `E-059` | **Channel Listing definition, publication intent** (`PRD-128`) |
| **Payment** — settlement capture, manual and API | **Reconciliation, variance, dispute** (`PAY-000`) |
| **Order Management** — order ingestion and status push | **Order lifecycle and operational workflow** |
| **Permission / Access Governance** — integration entry points to enforce against | **The authorisation decision model and operational identity** |
| **Engineering** — the requirements every wire contract is tested against | **Endpoints, payloads, protocols, transport, authentication mechanisms** |

**This module owns no business rule, no figure, no lifecycle and no entity.**

---

# 17. Entity References

| Entity | Role here |
|---|---|
| **Adapter Registration** | A configured external integration — **system configuration** (`SYS §6.1`) |
| **Channel Type · Channel Instance** | The category and the operating account — **system configuration** (`SYS §6.1`) |
| **Event** | A published fact (`SYS §6.1`) |
| **Exception** | Divergence, out-of-sequence events, unresolved sync (`E-056`, `SYS §6.2`) |
| `E-059` Channel Listing | **Definition owned by Product; sync state by the channel adapter** |
| `E-054` Attachment | One generic concept across channels (`API-013`) |
| `E-075` Channel Identity | Models identity uncertainty across channels; **owned by Customer** |

**No entity is defined here.** `DOMAIN_MODEL.md` and `SYSTEM_ARCHITECTURE.md` §6.1 are canonical (`DOC-005`).

---

# 18. State Machine References

| Machine | Subject | Owner |
|---|---|---|
| **Integration sync lifecycle** | Any synchronized subject | **`SYSTEM_ARCHITECTURE.md` §7.1** — not a `SM-` machine |
| `SM-14` Marketplace Claim | `E-069` | `OM §9.11`; **externally authoritative from `SUBMITTED` onward** (`SMA-036`) |
| `SM-6` Marketplace Settlement | `E-043` | Payment; ✅ **ratified 2026-08-09** into `OM §18.2` (`BR-142`); previously a proposed extension (`SMA-001`) |

> **API-055 — Listing sync state, settlement differences and policy violations were each assessed and none requires a state machine** (`SMA §20`). **No machine is defined or ratified here.**

⚠ **`SMA-037` — `SM-14` has no time expectation and no transition may be triggered by elapsed time.** `BD-324` states positively that claim duration *"cannot be predicted by the business"* — **the first machine where the absence of a threshold is a stated business fact rather than a gap.**

---

# 19. Audit and Permission

| Requirement | Rule |
|---|---|
| **Every integration action attributable to a named identity** | `API-046`, `PRM-005`, `AGV-001` |
| **Provenance retained — what, from whom, when, in what form** | `API-029`, `SYS-046` |
| **Raw payloads and reports retained as received** | `API-030`, `API-031`, `AUD-009` |
| **Every external exchange auditable** | `API-032`, `SYS-063` |
| **Authorisation enforced on integration entry points** | `API-045`, `PRM-004` |
| **Bulk integration actions audited per record** | `API-043`, `AUD-028`, `PRD-131` |

---

# 20. Notification Integration

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.** This module raises these obligations against it:

| Obligation | Category | Source |
|---|---|---|
| **Sync exceptions requiring manual intervention** | **Action Required** | `BD-320`, `NOT §21.1` |
| **Listing issues routed to the responsible user** | **Action Required** | `BD-322`, `NOT §21.1` |
| **Marketplace Sync Failure** | **Mandatory, and *not* an Action Required item** | `NOT §22.2` |

⚠ **`NOT §22.2` records the distinction deliberately:** *Marketplace Sync Failure*, *Security Alerts* and *Critical System Alerts* are **mandatory but queue no work for a person**. **A design inferring *mandatory = Action Required* would leave every system alert silenceable.**

---

# 21. Future Extensibility

> **API-056 — Every growth scenario in `SYS §18.2` is absorbed by configuration and adapters, without change to module boundaries, ownership, or coupling** (`SYS-077`, `CP-10`).

| Scenario | Integration impact |
|---|---|
| Additional channel **instance** | **None** — configuration (`SYS-013`, `BR-069`) |
| Additional channel **type** | **A new adapter**; no core change |
| Additional courier | A courier adapter translating tracking and remittance vocabulary |
| Additional payment mode | Configuration; an adapter only if externally integrated |
| Mobile applications | **A client of the same integration surface** — no business architecture change |
| Partner / reseller APIs | A marketplace-shaped channel with Trioloo fulfilment |
| Third-party fulfilment | Mirrored fulfilment state, as courier state already is |

**`API-004`'s capability declaration is what makes this operational** — with `API-015` it gives a new channel **a known minimum bar rather than an open-ended integration** (`SYS-094`).

---

# 22. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing on integration |
|---|---|---|
| **`GAP-085`** | 🟡 Medium | **Completeness reconciliation is unbuilt and has no owner** (§15.1). Incremental sync cannot detect an order that never arrived; staff compare manually today |
| **`GAP-086`** | 🟢 Low | **Late versus missing requires a threshold that does not exist** (§15.2) |
| **`GAP-098`** | 🔴 High | **Scope dimensions must be addable as configuration, not structure** (§12.2). **Every future channel is a new dimension**, and this business adds channels regularly |
| **`GAP-070`** | 🔴 Critical | **This is a migration programme and migration is undocumented** (`SYS-083`, `BD-007`). An existing Laravel ERP holds live business data; **no document addresses migration, cutover, parallel running, or reconciliation against the legacy system** — and every one of those is an integration concern |
| **`GAP-055`** | 🟡 Medium | **No payment gateway model is documented**, though Online Payment Gateway is a listed method (`BD-057`, `PAY §21`) |
| **`GAP-024`** | 🟡 Medium | **No ageing threshold exists** for a stalled sync, a `MANUAL_REQUIRED` item, or a missing settlement line |
| **`GAP-019`** | 🟠 High | **Transition trigger classification is incomplete** — several transitions remain `UNDECIDED` (`EVA-001`, `SMA §4`) |
| **`GAP-026`** | 🟡 Medium | **State names collide across machines**; machine-qualified naming is required (`SMA-047`, `DM-002`) |
| **`GAP-001`** | 🔴 Critical | Module documents remain unwritten. **This document reduces the count by one** |

**One divergence-classification question is carried rather than resolved** (§6.2): whether routine settlement-status timing lag counts as `DIVERGED` under `SYS-026` or as expected lag. **The documentation does not currently draw the distinction** (`BD-063`).

---

# 23. Traceability

## 23.1 Business Decisions consumed

| BD | Contributes |
|---|---|
| `BD-319` | **Operational source of truth, scoped** · capability-dependent sync · manual completion where unsupported |
| `BD-320` | **Sync exceptions** · completeness reconciliation done manually today |
| `BD-321` | Per-field writability |
| `BD-322` | Per-event reporting · listing issues routed to a user |
| `BD-323` | Per-data-element settlement detail |
| `BD-324` | Claim evidence · **claim duration cannot be predicted** |
| `BD-326` | Chat capability — walk-in and phone never carry it |
| `BD-328` | **Instance multiplication as the dominant cost** |
| `BD-361` | **Attachment type as the seventh capability dimension** |
| `BD-366` | Switching across platforms as the dominant chat cost |
| `BD-370` | **No public registration** |
| `BD-402` | Capture method is an attribute, not an identity |

**Prior coverage consumed:** `BD-007`, `BD-057`, `BD-060`, `BD-063`, `BD-067`, `BD-101`, `BD-280`, `BD-318`, `BD-353`, `BD-377`.

## 23.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `SYS-006`, `SYS-009` – `SYS-013`, `SYS-018`, `SYS-020` – `SYS-022`, `SYS-025` – `SYS-027`, `SYS-032` – `SYS-035`, `SYS-045` – `SYS-056`, `SYS-063`, `SYS-070`, `SYS-073`, `SYS-076`, `SYS-077`, `SYS-083`, `SYS-094` – `SYS-100`, `SYS-107`, `CP-8`, `CP-10`, `CP-12`, `CP-13` | `SYSTEM_ARCHITECTURE.md` |
| `EVA-001` – `EVA-018`, `EVT-001` – `EVT-087` | `EVENT_ARCHITECTURE.md` |
| `BR-001`, `BR-005`, `BR-029` – `BR-031`, `BR-069`, `BR-125`, `BR-128` – `BR-134` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `PRD-007`, `PRD-030`, `PRD-075` – `PRD-077`, `PRD-095`, `PRD-125` – `PRD-131` | `PRODUCT_ARCHITECTURE.md` |
| `PRM-004`, `PRM-005`, `PRM-009`, `AGV-001`, `AGV-011`, `AGV-020` | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `ACC-020`, `ACC-036` | `ACCOUNTING_ARCHITECTURE.md` |
| `PAY-006`, `PAY-007`, `PAY-027`, `PAY-061` | `PAYMENT_ARCHITECTURE.md` |
| `SMA-001`, `SMA-036`, `SMA-037`, `SMA-047` | `STATE_MACHINE_ARCHITECTURE.md` |
| `E-054`, `E-056`, `E-059`, `E-069`, `E-075`, `INV-43.2`, `DM-001`, `DM-002` | `DOMAIN_MODEL.md` |
| `DB-002`, `DB-005`, `DB-011`, `DB-017`, `DB-018` | `DATABASE_ARCHITECTURE.md` |
| `AUD-009`, `AUD-028` | `AUDIT_ARCHITECTURE.md` |
| `NOT-032` | `NOTIFICATION_ARCHITECTURE.md` |
| `DOC-005`, `DOC-006`, `DOC-019` | `MASTER_DOCUMENTATION_INDEX.md` |

## 23.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`PRD-077` refined** — adapters declare capability per operation, direction and field | `API-004` |
| **`PRD-018` amended** — Trioloo authors listing content; the channel reports actual state; a difference is `DIVERGED` | `API-023` |
| **`SYS-082`** — courier selection is not modelled; a single courier is auto-assigned. **The adapter boundary remains correct and valuable; any *selection logic* is unused** | §14 |
| **`BR-022` withdrawn** — no integration step gates on serial capture | `SYS-086` |

---

---

# 23A. Bulk File Interchange — ratified 2026-08-11

> **API-057 — ✅ CSV IS THE ONLY BULK INTERCHANGE FORMAT IN V1.**
>
> 🔴 **`XLS`, `XLSX`, `XML`, bulk `JSON` and spreadsheet-service integrations are NOT included and are not added silently.** ⚠ **A spreadsheet workbook is never parsed as CSV.** ✅ **Future formats are separate decisions.**

> **API-058 — ✅ THE CSV SERIALISATION CONTRACT.**
>
> **a. ENCODING AND SHAPE** — **UTF-8** · **RFC 4180 quoting and escaping** · **a deterministic header order fixed by the contract** · **one header row** · **`LF` or `CRLF` accepted on import, one emitted on export.**
> **b. IDENTIFIERS** — 🔴 **serialised as TEXT so leading zeros survive.** ⚠ **An identifier silently converted to a number by a spreadsheet is a corrupted identifier** (`DB-011`).
> **c. MONEY** — 🔴 **plain decimal text, no thousands separators, no currency symbol, no locale formatting** — e.g. `32500.00`. **This is `TEC-015`'s discipline applied to a file boundary: money crosses as text, never as a machine float** (`TEC-010`, `PRJ-040`). 🔴 **The importer performs NO rounding — `DB-079` remains the sole rounding owner and precision is preserved exactly as written.**
> **d. DATE AND TIME** — **timestamps in the canonical API representation; business dates as calendar dates carrying `Asia/Dhaka` business-date semantics** (`TEC-050`). 🔴 **Ambiguous local forms such as `08/11/26` are prohibited in both directions.**
> **e.** 🔴 **EXPORTABLE DOES NOT IMPLY IMPORTABLE.** **A derived or system-owned field may be exported for information and is NEVER import authority unless its owning architecture explicitly declares it writable** — **derived stock positions, buildable availability, valuation, weighted average cost, sync state, last sync, channel-reported values, counts and audit timestamps are all READ-ONLY.**

> **API-059 — ✅ EXPORT SANITISATION AGAINST SPREADSHEET FORMULA EXECUTION.**
>
> **A user-controlled text value beginning with `=`, `+`, `-`, `@`, TAB or CR is executed as a formula by common spreadsheet applications.**
>
> **a.** ✅ **Export applies a REVERSIBLE neutralisation at SERIALISATION so the opened file cannot execute.**
> **b.** 🔴 **THE STORED VALUE IS NEVER MUTATED.** **Sanitisation belongs to the export representation, not to the record** — ⚠ **a product name is not rewritten in the database because a spreadsheet is dangerous.**
> **c.** ✅ **Import reverses the neutralisation**, so a round trip returns the original text unchanged.

> **API-060 — ✅ A CONFIRMED IMPORT COMMITS ATOMICALLY, AND REPORTS PER RECORD.**
>
> ⚠ **RECONCILED WITH `API-043`, `SYS-033` and `RPT-047`, which require bulk operations to enforce rules per record, audit per record, and report partial success per record rather than as an aggregate that hides which records failed.**
>
> ✅ **Those rules govern ENFORCEMENT, AUDIT and REPORTING GRANULARITY. They fix no transaction boundary, and none is stated anywhere for bulk operations.** 🔴 **Every one of their obligations is satisfied by this rule and none is weakened:**
>
> **a.** **Each row is validated and authorised INDIVIDUALLY** (`PRM-004`, `API-045`).
> **b.** **Each accepted write is audited INDIVIDUALLY** (`AUD §12.2`, `API-043`).
> **c.** **The result reports EVERY row's outcome by row number** — 🔴 **never an aggregate that hides which row failed** (`SYS-033`, `RPT-047`).
> **d.** ✅ **The confirmed job is the TRANSACTION BOUNDARY: if any confirmed write fails, the whole job fails and nothing is committed.** ⚠ **This is STRICTER than partial commit, chosen for operational safety** — **`IVN-004`/`SYS-102` already rank correctness above availability.**
> **e.** 🔴 **ACCIDENTAL PARTIAL SUCCESS IS PROHIBITED.** **A partial mode is not offered in V1; adding one later is an explicit decision, never a fallback.**
> **f.** 🔴 **VALIDATION NEVER WRITES.** **Upload, parse and validation mutate nothing** — **only explicit confirmation authorises a write.**

> **API-061 — ✅ IMPORT IDEMPOTENCY AND PROVENANCE.**
>
> **a.** ✅ **A confirmed import is one identified job**, and **re-submitting the same confirmed job must not create duplicates** (`SYS-045`, `PRD-075`).
> **b.** 🔴 **DUPLICATE IDENTITY IS DECIDED BY CANONICAL ROW IDENTIFIERS** (`PRD-152`), **never by filename.** ⚠ **A content hash is a legitimate engineering aid and is NEVER business identity** (`DB-011`).
> **c.** **Every accepted write is attributable to the acting Operational User Profile** (`AGV-001`, `AUD-004`), **and provenance is sufficient to reach the import job and the source row.** 🔴 **The actor is captured at write time, never reconstructed from logs** (`AGV-001`).
> **d.** ⚠ **NO FILE RETENTION IS REQUIRED and none is invented.** **No canonical rule obliges storing the uploaded file, and indefinite storage of business data is not created here** (`DOC-024`).
> **e.** ⚠ **Execution model, row limits and file-size bounds are ENGINEERING DELIVERABLES** (`API-001`, `TEC-081`). 🔴 **No queue or job infrastructure is invented for CSV, and no business row limit is written into architecture.**

---

# 23B. Channel Listing Operations — ratified 2026-08-13

*Routed under `DOC-079` for Product `§39`. **This section fixes the ADAPTER BOUNDARY for listing discovery, readback and outbound operations. It defines no endpoint, no channel and no payload** (`API-003`, `SYS-009`).*

> **API-062 — ✅ THE LISTING PORTS ARE CHANNEL-NEUTRAL AND BELONG TO THE CORE.**
>
> **Product defines the contracts through which an adapter reports channel facts and requests are made of it; the adapter implements them** (`PRD-194.b`).
>
> **a.** ✅ **INBOUND — an adapter REPORTS observed channel facts** for a listing or a page of listings: external identifier, orderable channel SKUs, title, description, media references, price, published stock, category, attributes, listing status.
> **b.** ✅ **OUTBOUND — the core REQUESTS an operation**: discover, refresh, push update, publish create, withdraw. **The adapter executes it and reports the outcome.**
> **c.** 🔴 **AN ADAPTER NEVER WRITES PRODUCT-OWNED INTENT** (`PRD-181.a`). **Inbound reporting lands on the REPORTED side only.** ⚠ **An adapter that "helpfully" corrected an intended value would destroy the operator's unsent edit and make `DIVERGED` undetectable.**
> **d.** 🔴 **NO CHANNEL NAME, ENDPOINT, FIELD NAME, ERROR CODE, PAGINATION TOKEN OR CREDENTIAL CROSSES THIS BOUNDARY INTO THE CORE** (`API-003`).

> **API-063 — ✅ FIELD SUPPORT IS DECLARED, NOT ASSUMED.**
>
> **a.** ✅ **`API-011`/`PRD-125` capability declaration governs every listing field, per operation and per direction.** **A rule that reads *"where the adapter supports it"* consults this declaration.**
> **b.** 🔴 **AN UNSUPPORTED FIELD IS `MANUAL_REQUIRED`, A NORMAL STATE — NEVER A FAILURE** (`SYS-025`).
> **c.** 🔴 **AN UNREADABLE FIELD HAS NO REPORTED VALUE, AND THAT IS NOT AN EMPTY VALUE** (`SYS-034`, `TEC-084`). ⚠ **Coalescing "the adapter cannot read this" into "the channel shows nothing" would manufacture a divergence on every listing.**

> **API-064 — ✅ A REMOTE OPERATION IS REQUESTED, NOT PERFORMED BY A SAVE.**
>
> **a.** 🔴 **NO LOCAL PERSISTENCE OPERATION EVER TRIGGERS AN OUTBOUND CALL IMPLICITLY** (`PRD-185`). **An outbound operation is an explicit request carrying its own authorisation** (`PRM-004`, `PRD-196.b`).
> **b.** ✅ **Every attempt is idempotent** (`API-024`, `SYS-045`, `PRD-075`). 🔴 **A retried publish must not create a second channel listing** — **deterministic external identity or an equivalent request key is required where the channel permits one** (`API-026`).
> **c.** ✅ **Provenance is recorded for every exchange** — what was sent or received, from whom, when, in what form (`API-029`, `SYS-046`).

> **API-065 — ✅ SINGLE AND BULK REMOTE OPERATIONS REPORT PER ITEM, AND BULK IS NOT ATOMIC.**
>
> **a.** 🔴 **A BULK REMOTE OPERATION IS NOT ASSUMED ATOMIC ACROSS THE EXTERNAL PARTY.** ⚠ **`API-060`'s atomic commit governs a LOCAL CSV import and does NOT extend to a remote batch** — **partial success is the normal outcome there** (`PRD-186.c`).
> **b.** ✅ **EVERY ITEM CARRIES ITS OWN OUTCOME**, retained individually (`API-043`, `SYS-033`, `RPT-047`, `PRD-186.b`). 🔴 **No aggregate may hide which items failed.**
> **c.** ✅ **Retry is targetable to failed or eligible items** and does not repeat successful work (`PRD-186.d`).
> **d.** ✅ **The core MAY orchestrate a bulk operation as many single-item calls.** ⚠ **Whether a channel offers a native batch endpoint is adapter capability and changes no business semantics** (`API-063`).

> **API-066 — ✅ DISCOVERY IS ENUMERATION, AND ITS MECHANICS ARE THE ADAPTER'S.**
>
> **a.** ✅ **Pagination, cursors, page size, rate limiting, backoff and chunking are ADAPTER concerns** (`PRD-175.c`). 🔴 **None appears in a business rule.**
> **b.** 🔴 **AN INCOMPLETE OR FAILED RUN IS REPORTED AS INCOMPLETE.** ⚠ **A truncated enumeration must never be presented to the core as a complete one** — `PRD-177` forbids concluding deletion from absence, and that guarantee depends on the adapter being honest about completeness (`API-053`, `SYS §15`).
> **c.** ✅ **Completeness reconciliation is a distinct operation from incremental sync** (`PRD-130`).

> **API-067 — 🔴 THE CORE NEVER LEARNS THE CHANNEL'S TAXONOMY.**
>
> **a.** ✅ **Channel category catalogue retrieval, browsing, translation and validation are adapter concerns** (`PRD-191.c`).
> **b.** ✅ **Channel-specific attribute schema, requiredness and validation are adapter concerns** (`PRD-192.d`).
> **c.** ✅ **The variation AXIS schema is an adapter concern** (`PRD-190.g`). **The core holds that a listing has orderable SKUs and what each maps to — never the marketplace's option system.**
> **d.** 🔴 **Marketplace-side validation failure is a reported OUTCOME, not a core business rule** (`SYS-032`, `TEC-083`).

---

# 23C. Channel Connection

*Added v1.6.0 — Shops & Channels ratification, 2026-08-15. **Nothing here creates an endpoint, a provider, a payload or a transport technology.***

> **API-068 — ✅ THE CHANNEL CONNECTION LIFECYCLE IS INTEGRATION-OWNED AND ASSOCIATED ONE-TO-ONE WITH A CHANNEL INSTANCE. Ratified 2026-08-15.**
>
> **The extraction found no ratified connection lifecycle anywhere in the corpus, while two unrelated lifecycles were being informally read as one.**
>
> | State | Meaning |
> |---|---|
> | **`NOT_CONNECTED`** | The Channel Instance exists; **no usable authorised connection currently exists.** |
> | **`CONNECTED`** | **A usable authorised connection exists for this EXACT Channel Instance.** |
> | **`REAUTH_REQUIRED`** | **The previous connection cannot continue without operator authorisation.** ⚠ Provider-specific causes are never encoded in the state name. |
> | **`ERROR`** | **A connection-level error that is not honestly `NOT_CONNECTED` or `REAUTH_REQUIRED`.** |
>
> **a.** 🔴 **IT IS NOT `record_status`** — that is the CONFIGURATION lifecycle and is System's (`SYS-108`). **It is not the `§7.1` sync lifecycle either, which describes one RECORD's agreement with a counterparty.** ⚠ **Three lifecycles, three questions: *may this shop be used?*, *is it authorised?*, *does this listing agree with the channel?***
> **b.** 🔴 **`AUTHORIZING` IS NOT A DURABLE BUSINESS STATE.** ✅ It may exist as a transient application or UI authorisation-session state. ⚠ **Persisting it would leave a shop stuck mid-handshake forever if the operator simply closed the tab.**
> **c.** 🔴 **`DISABLED` IS NOT A CONNECTION STATE.** **Disabling is configuration and belongs to `SUSPENDED`** (`SYS-108`).
> **d.** ✅ **ONE CONNECTION PER CHANNEL INSTANCE.** **`AGV-016` already requires per-shop actor isolation — seven Daraz adapters are seven scoped actors, not one actor holding seven credentials — so a connection shared across instances would break an access rule that already exists.**

> **API-069 — ✅ THE SHOPS & CHANNELS / INTEGRATION OWNERSHIP SPLIT. Ratified 2026-08-15.**
>
> **Both are ratified Administration destinations** (`UX-024`). 🔴 **They are NOT merged.**
>
> | **Shops & Channels owns** | **Integration owns** |
> |---|---|
> | The `E-016` business / configuration record | The provider connector or adapter implementation |
> | Internal shop name and internal code | **OAuth / authorisation EXECUTION** |
> | Channel Type and Market | **App Key and App Secret** |
> | Configuration lifecycle (`SYS-108`) | **Access and refresh tokens, their encryption and storage** |
> | **External shop identifier as BUSINESS identity** | Callback processing |
> | Business-facing connection SUMMARY | API transport, signing, authentication |
> | Business-facing seller / account identity display | Remote response parsing |
> | **The ENTRY POINT to Connect / Reauthorize** | Adapter capability declaration (`API-063`, `PRD-125`) |
> | Links to Listings scoped to the shop | Connection execution, errors and token-expiry mechanics |
>
> **a.** ✅ **THE BUSINESS SURFACE INITIATES; INTEGRATION EXECUTES.** **A user may start Connect or Reauthorize from the shop record, and the operation invoked is Integration's**: authorisation workflow → external authorisation → callback → **verify the remote account identity** (`INV-16.6`) → update the connection result → expose that result back to the business surface.
> **b.** 🔴 **THIS CHANGES NO EXISTING BOUNDARY.** **It applies `PRD-194` — which already assigns "seller authorisation, credentials, tokens, authentication" to Marketplace Integration — to the ADMINISTRATION SURFACES, which `PRD-194` did not address.**

> **API-070 — 🔴 NO SECRET LEAVES INTEGRATION. Ratified 2026-08-15.**
>
> **a.** 🔴 **NO App Secret, access token, refresh token, marketplace password or equivalent may be returned to the Shops & Channels frontend, the Listings frontend, an ordinary business API, browser storage, logs, Git or canonical documentation.**
> **b.** ✅ **App-level secret configuration is server-side Integration engineering; per-shop authorisation material belongs to Integration-owned secure persistence.** ⚠ **`API-044` already makes credential storage and encryption an ENGINEERING deliverable — this rule states the BOUNDARY, not the mechanism.**
> **c.** ✅ **`E-016`'s *credentials reference* is an OPAQUE POINTER and is not itself secret material** (`INV-16.8`). 🔴 **A reference that resolves to a secret in a business response is the same defect as returning the secret.**

> **API-071 — 🔴 ONE ADAPTER CLASS, MANY ACCOUNTS: EVERY REMOTE ACT EXECUTES IN AN EXPLICIT CHANNEL INSTANCE CONTEXT. Ratified 2026-08-15.**
>
> **`PRD-125` already declares capability per instance and `AGV-016` already isolates shop actors. This states the EXECUTION consequence, which is where a shared adapter class becomes dangerous.**
>
> **a.** ✅ **ONE ADAPTER IMPLEMENTATION MAY SERVE A CHANNEL TYPE.** 🔴 **EVERY SELLER-ACCOUNT-SPECIFIC OPERATION MUST CARRY AN EXPLICIT `channelInstanceId`**, which resolves that instance's own connection and authorisation material, communicates with that account only, and returns results scoped to it.
> **b.** 🔴 **NO SHARED, MUTABLE "CURRENT ACCOUNT" CONTEXT MAY EXIST.** ⚠ **An ambient current-shop variable is the exact mechanism by which Shop A's authorisation reads Shop B's data** — **which `AGV-016` forbids: the seven Daraz adapters are seven SCOPED ACTORS, not one actor holding seven credentials.**
> **c.** 🔴 **NO SIBLING INFERENCE, IN EITHER DIRECTION** (`PRD-125`, `API-063`). **A shared adapter class does NOT imply a shared live authorisation or a shared capability.** ✅ **Shop A may be `CONNECTED` while Shop B is `REAUTH_REQUIRED`; Shop A may declare a field readable while Shop B has no usable connection at all** (`API-068`). ⚠ **An absent declaration remains UNDECLARED, never assumed support.**
> **d.** ✅ **INGESTION IS INITIATED AND EXECUTED FOR ONE EXPLICIT CHANNEL INSTANCE SCOPE.** **Whatever a future domain pulls — listings, orders, returns, conversations, settlement — is pulled for one account, and each domain persists its OWN normalised business facts** (`SYS-110.b`). 🔴 **Polling frequency, schedulers, cursors, webhooks, batching, checkpoints and retry systems are NOT designed here** and belong to their own later contracts.
> **e.** ✅ **ONE AUTHORISED CONNECTION SERVES THAT ACCOUNT'S SUPPORTED OPERATIONS.** **A separate OAuth identity is NOT created merely because different business domains call different provider APIs** — subject to permission and to what the provider's capability actually allows. 🔴 **THIS IS SHARED ACCOUNT AUTHORISATION, NOT SHARED BUSINESS-DOMAIN OWNERSHIP** (`SYS-110.b`): **the connection is one, the owning domains stay several.**

# 24. Version History

| Version | Date | Change |
|---|---|---|
| **1.2.4** | **2026-08-09** | **`API-033`'s event count updated — no rule changed.** **One hundred and two events across sixteen domains** after `EVT-102 Build.Completed` |
| **1.2.3** | **2026-08-09** | **`API-033`'s event count updated — no rule changed.** **One hundred and one events across fifteen domains** after `EVT-101` registered the first `Accounting.*` event |
| **1.2.2** | **2026-08-09** | **`API-033`'s event count updated — no rule changed.** **One hundred events across fourteen domains** after `EVT-096` – `EVT-100` registered the Trade-In set |
| **1.2.1** | **2026-08-09** | **`API-033`'s event count updated — no rule changed.** **Ninety-five events across thirteen domains** after `EVT-089` – `EVT-095` registered the Warranty & Repair set. **`API-034` remains directly relevant**: `EVT-093` is externally originated — the supplier decides and Trioloo records — and external origin still does not imply an automatic trigger |
| **1.7.0** | **2026-08-15** | ✅ **`API-071` ADDED — ONE ADAPTER CLASS, MANY ACCOUNTS, routed under `DOC-079` as the execution consequence of `DM-085`.** 🔴 **Every seller-account-specific operation carries an explicit `channelInstanceId` that resolves that instance's own connection and authorisation and returns results scoped to it; NO shared mutable "current account" context may exist, because an ambient current-shop variable is precisely how Shop A's authorisation reads Shop B's data** (`AGV-016`). 🔴 **No sibling inference in either direction: a shared adapter class implies neither shared live authorisation nor shared capability — Shop A may be `CONNECTED` while Shop B is `REAUTH_REQUIRED`** (`PRD-125`, `API-063`, `API-068`). ✅ **Future ingestion is initiated and executed for ONE explicit Channel Instance scope, each domain persisting its own normalised facts; 🔴 polling, schedulers, cursors, webhooks, batching, checkpoints and retry are NOT designed here.** ✅ **One authorised connection serves that account's supported operations across future provider APIs — shared ACCOUNT AUTHORISATION, never shared business-domain ownership** (`SYS-110.b`). 🔴 **No endpoint, provider, payload, transport technology, entity, field, table, constraint or event is created; `API-062`–`API-070` unchanged.** |
| **1.6.0** | **2026-08-15** | ✅ **CHANNEL CONNECTION — `§23C`, `API-068`–`API-070`, routed under `DOC-079` from the Shops & Channels contract extraction.** ✅ **`API-068` ratifies the connection lifecycle as INTEGRATION-owned and one-to-one with a Channel Instance — `NOT_CONNECTED`, `CONNECTED`, `REAUTH_REQUIRED`, `ERROR` — and 🔴 keeps it distinct from `record_status` (configuration, `SYS-108`) and from the `§7.1` per-record sync lifecycle; `AUTHORIZING` is transient and never persisted, and `DISABLED` is configuration, not connection.** ✅ **`API-069` fixes the Shops & Channels / Integration ownership split without merging the two ratified Administration destinations: the business surface owns the `E-016` record, its identities, its configuration lifecycle and the ENTRY POINT to Connect; Integration owns OAuth execution, App Key/Secret, tokens, callback, transport, signing and capability.** ⚠ **This applies `PRD-194` to the administration surfaces it did not address; no existing boundary moves.** 🔴 **`API-070` states the secret boundary — no App Secret, token, password or equivalent reaches any frontend, ordinary business API, browser storage, log, Git or document, and `E-016`'s credentials reference is an opaque pointer, never secret material** (`INV-16.8`, `API-044`). 🔴 **No endpoint, provider, payload, transport technology, entity or event is created; `API-062`–`API-067` unchanged.** |
| **1.5.0** | **2026-08-13** | ✅ **CHANNEL LISTING OPERATIONS — `§23B`, `API-062`–`API-067`, routed under `DOC-079` for Product `§39`.** ✅ **`API-062` fixes the channel-neutral listing PORTS as the core's, with the adapter implementing them: 🔴 an adapter REPORTS onto the reported side and NEVER writes Product-owned intent, and 🔴 no channel name, endpoint, field name, error code, pagination token or credential crosses into the core.** ✅ **`API-063` makes field support DECLARED per operation and direction — 🔴 unsupported is `MANUAL_REQUIRED`, not failure, and 🔴 unreadable is NOT empty, because coalescing the two would manufacture a divergence on every listing.** 🔴 **`API-064` forbids any local save implicitly triggering an outbound call, requires idempotency on every attempt, and states that a retried publish must not create a second listing.** 🔴 **`API-065` records that a REMOTE bulk operation is NOT atomic — `API-060`'s atomic commit governs a LOCAL CSV import and does not extend across an external party — with per-item outcomes retained, no aggregate hiding failures, targetable retry, and native-batch availability treated as capability that changes no business semantics.** ✅ **`API-066` keeps pagination, cursors, rate limiting and chunking with the adapter and 🔴 requires an incomplete run to be reported as incomplete, because `PRD-177`'s absence-is-not-deletion guarantee depends on it.** 🔴 **`API-067` keeps channel taxonomy, attribute schema and the variation axis out of the core entirely.** 🔴 **No endpoint, channel, payload, transport technology or event is created; `API-003`, `API-024`–`API-029`, `API-043`, `API-057`–`API-061` unchanged.** |
| **1.4.0** | **2026-08-11** | ✅ **BULK FILE INTERCHANGE — `§23A`, `API-057`–`API-061`, routed under `DOC-079`.** ✅ **`API-057` fixes CSV as the ONLY V1 bulk format — `XLSX`, `XML`, bulk `JSON` and spreadsheet-service integrations are excluded and never added silently.** ✅ **`API-058` gives the serialisation contract: UTF-8, RFC 4180, deterministic header order, identifiers as TEXT so leading zeros survive, money as plain decimal text with NO rounding by the importer because `DB-079` remains the sole rounding owner, and canonical date/time with ambiguous local forms prohibited. 🔴 `API-058.e` states the general rule that EXPORTABLE DOES NOT IMPLY IMPORTABLE.** ✅ **`API-059` requires reversible export sanitisation against spreadsheet formula execution while 🔴 NEVER mutating the stored value — protection belongs to serialisation, not to the record.** ✅ **`API-060` RECONCILES atomic commit with `API-043`/`SYS-033`/`RPT-047`: those rules govern per-record ENFORCEMENT, AUDIT and REPORTING GRANULARITY and fix no transaction boundary, so a confirmed job commits atomically while still validating, authorising, auditing and reporting every row individually. 🔴 Accidental partial success is prohibited and validation never writes.** ✅ **`API-061` fixes idempotency by canonical row identifiers rather than filename, keeps a content hash an engineering aid and never business identity, requires write-time attribution, ⚠ invents NO file retention and ⚠ leaves execution model, row limits and file size as engineering deliverables — no queue invented for CSV.** **No endpoint, payload shape, entity, event or permission code created.** |
| **1.2.0** | **2026-08-09** | **`API-033`'s event count corrected — no rule changed.** It read *“eighty-seven events across eleven domains”*; `EVT-088` registered the `Product.*` catalogue on 2026-08-09, making it **eighty-eight across twelve**. **The rule's substance is unchanged** — the register is `EVENT_ARCHITECTURE.md` and this document still adds no event |
| **1.1.0** | **2026-08-09** | **Status reference corrected — no rule changed.** `SM-6` Marketplace Settlement was ratified into `OM §18.2` on 2026-08-09 (`BR-142`); its row no longer describes it as an unratified proposed extension. **`API-055` stands unchanged** — no machine is defined or ratified here |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `SYSTEM_ARCHITECTURE.md` §4.4, §7.1, §12, §13, §20 – §22 with `BUSINESS_DISCOVERY.md` §20 and §23, and the reconciliations at `OM §9.11`, `PRD §31` and `EVENT_ARCHITECTURE.md`. **57 rules (`API-000` – `API-056`), all traceable; no business rule, entity, state machine, lifecycle or interface contract introduced.** **`API-001` records the hard boundary this document must not cross — endpoints, payloads, protocols, schemas and transport are engineering deliverables** (`SYS §17`, `SYS-076`). `API-052` reproduces the external party register **for navigation only**; `SYS §12.3` governs. **The seven capability dimensions, the eight adapter responsibilities and the sync lifecycle are consolidated exactly as ratified and are not extended.** Nine open items carried; **`GAP-085`, `GAP-086`, `GAP-098` and `GAP-070` explicitly not converted into rules**, and the `DIVERGED`-versus-expected-lag question is recorded as carried |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies integration business architecture only. It contains no code, schema, API contract, endpoint, payload, protocol, or user interface specification, and assumes no technology.*
