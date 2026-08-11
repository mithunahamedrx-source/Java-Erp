# Event Architecture

**Owner:** Trioloo Technology · **Type:** Canonical business event register · **Status:** Canonical
**Version:** 1.17.0 · **Ratified:** 2026-08-04 · **Amended:** 2026-08-09 · **Event prefix:** `EVT-` · **Rule prefix:** `EVA-`

---

## Document Control

### Purpose in the documentation set

[`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §13 establishes that modules couple **only** through events (`SYS-006`) and defines the principles, naming convention, and category taxonomy. It does not enumerate the events themselves.

> **This document is that register.** It closes `GAP-061`, which recorded that `SYS-050` — *"events carry sufficient content for subscribers to act without querying back"* — is unverifiable while no event content is specified anywhere.

### What this document is not

> **No API contracts. No message schemas. No database design. No code.**
>
> "Data affected" describes what a subscriber must be able to learn, in business terms — not payload structure, field names, serialisation, or transport. Wire format is an engineering deliverable derived from and tested against this register (`SYS-076`, `DOC-019`).

### Consistency basis

| Document | Inherited |
|---|---|
| [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §13 | Event principles `SYS-048`–`SYS-056`, naming, taxonomy, delivery semantics |
| [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §18.3 | The coupling contract — the complete inter-machine surface |
| [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) | Entities `E-001`–`E-085` that events act upon. *Read `E-001`–`E-057` at v1.0.0; the model has since grown to `E-085` and the reference is corrected, not narrowed* |
| [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) | Temporality `DB-017`, immutability, movement-based truth `DB-001` |
| [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) | Actor attribution, authority, `PRM §13` security events |
| [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) | Audit obligations for every event |
| [`GAP_ANALYSIS.md`](GAP_ANALYSIS.md) | Known gaps, referenced rather than filled |

`UI_ARCHITECTURE.md` is cited in the brief but does not exist (`SYS U-8`, `GAP-068`). Where an event has a user-facing consequence, this document states the **behaviour**; presentation is governed by [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md).

### The non-invention rule

> **EVA-001 — This register documents events the existing documentation already implies. It does not decide undecided questions.**
>
> Where a trigger mode is genuinely undecided, the entry reads **`UNDECIDED`** and cites `GAP-019`. Filling those in would silently resolve an open commercial decision (`DM-001`, `DOC-024`).

### State reference convention

Per `DM-002`, states are written **`Machine:STATE`** because state names collide across independent machines (`GAP-026` — `CONFIRMED`, `CLOSED`, `CANCELLED`, `RECEIVED`, `APPROVED`, `REJECTED`, `EXPIRED`, `IN_TRANSIT`). This is a presentation convention of the documentation, not a ratified rename.

---

## Table of Contents

| § | Section |
|---|---|
| 1 | Purpose & Scope |
| 2 | Event Principles |
| 3 | Event Classification |
| 4 | Event Anatomy |
| 5 | Order events |
| 6 | Verification events |
| 7 | Fulfillment events |
| 8 | Shipment & Delivery events |
| 9 | Inventory events |
| 10 | Procurement events |
| 11 | Payment & Settlement events |
| 12 | Return events |
| 13 | Exchange events |
| 14 | Master Data & Configuration events |
| 15 | Platform events |
| 16 | Coupling Matrix |
| 17 | Ordering & Delivery Guarantees |
| 18 | Unknowns |
| 19 | **Machine coverage — `SM-1` – `SM-20`** |
| 20 | **Warranty & Repair events** |
| 21 | **Trade-In events** |
| 22 | **Accounting events** |
| 23 | **Build events** |

---

# 1. Purpose & Scope

## 1.1 Purpose

To define every business event that can occur in the Trioloo ERP: what happened, what caused it, what must be true beforehand, which module published it, which modules react, what changed, and what must be recorded.

Events are the **only** sanctioned coupling mechanism between modules (`SYS-006`). A module that cannot express what it did as an event cannot participate in the system.

## 1.2 What an event is

> **EVA-002 — An event is a statement that something has already happened. It is never a command, a request, or an intention** (`SYS-048`).

`Order.Dispatched` states a fact. It does not instruct Inventory to deduct stock; Inventory *chooses* to deduct stock because dispatch occurred. The distinction matters: the publisher must not know or care who reacts, and adding a subscriber must never require changing a publisher.

## 1.3 Scope

**In scope** — business events across all Trioloo operations: computer and smart TV sales through multiple websites, multiple Daraz shops, Facebook, WhatsApp, phone and walk-in; warehouse, courier, marketplace, inventory, accounts, return, exchange, and settlement.

**Out of scope** — technical telemetry, performance metrics, and diagnostic logging. These are engineering monitoring and are explicitly **not** business events (`AUD-002`).

---

# 2. Event Principles

Inherited from `SYSTEM_ARCHITECTURE.md` §13.2 and **not restated** (`SYS-016`): `SYS-048` (fact not command) · `SYS-049` (only the owner publishes) · `SYS-050` (sufficient content) · `SYS-051` (at-least-once, idempotent subscribers) · `SYS-052` (ordering within a subject only) · `SYS-053` (retained as history) · `SYS-054` (subscriber failure never blocks the publisher) · `SYS-055` (expected and actual both carried) · `SYS-056` (canonical vocabulary).

Event-specific rules established here:

| Rule | Statement |
|---|---|
| **EVA-003** | Every event names its publishing module, and only the owner of the affected data may publish it (`SYS-049`, `SYS-004`) |
| **EVA-004** | Every event carries the actor who caused it — a named user or a named system identity (`SYS-058`, `PRM-005`) |
| **EVA-005** | Every event carries company scope (`SYS-018`) |
| **EVA-006** | Every event carries both **event time** and **record time** where they may differ (`DB-017`) |
| **EVA-007** | An event is published only **after** the state change it describes is durable — never in anticipation |
| **EVA-008** | A subscriber never assumes it is the only subscriber, and never assumes ordering relative to other subscribers |
| **EVA-009** | A subscriber that cannot apply an event raises an exception; it never silently discards it (`SYS-022`) |
| **EVA-010** | An event describing a refused or failed action is still an event — refusal is a business fact (`SYS-032`) |
| **EVA-011** | Bulk operations publish one event per affected subject, never one aggregate event (`SYS-033`, `AUD-028`) |
| **EVA-012** | An event is never republished to correct it; a correction is a new event that supersedes (`DB-002`, `BR-031`) |

**On EVA-007.** Publishing before durability creates events describing state that does not exist. A subscriber acting on `Order.Dispatched` before dispatch is recorded will deduct stock for a dispatch that may not have happened.

**On EVA-011.** The orders list supports bulk status change and bulk courier dispatch (`design-reference/02-orders-list.png`). Fifty orders dispatched in bulk publish fifty `Order.Dispatched` events. One aggregate event would make per-order history incomplete and would break `AUD-028`.

**On EVA-012.** A courier that reports delivery and then corrects it publishes a second event; the first is retained. `BR-031` makes tracking history append-only for exactly this reason — the erroneous report is itself evidence in a dispute.

---

# 3. Event Classification

The brief lists five classifications. They are **two orthogonal axes**, not one list, and treating them as one loses precision.

## 3.1 Axis 1 — Origin

| Class | Definition | Authority |
|---|---|---|
| **Internal** | Published by a Trioloo module about its own domain | Trioloo is system of record |
| **External** | Originates outside Trioloo and enters through an adapter | An external party is system of record (`SYS-010`) |

> **EVA-013 — An external event is translated into canonical vocabulary by its adapter before publication** (`BR-005`, `SYS-009`). No core module ever sees a marketplace's or courier's native vocabulary.
>
> **EVA-014 — An external event retains the raw payload as received** (`SYS-046`, `AUD-009`). When a marketplace disputes a deduction or a courier disputes a delivery, the defensible position is the original message.

## 3.2 Axis 2 — Trigger

| Class | Definition | Example |
|---|---|---|
| **Manual** | A human deliberately performs the action | Verification agent confirms an order |
| **Automatic** | A consequence of another event, or of a condition becoming true | Reservation on release |
| **Scheduled** | Occurs on a time cycle | Reconciliation runs |
| **`UNDECIDED`** | Trigger mode not settled by any ratified document | Recorded, not guessed (`EVA-001`) |

## 3.3 The combinations

| | Manual | Automatic | Scheduled |
|---|---|---|---|
| **Internal** | Agent confirms verification | Stock reserved on release | Nightly reconciliation |
| **External** | Staff record a courier update by phone (`BR-029`) | Courier pushes a tracking event | Adapter polls a marketplace |

> **EVA-015 — External origin does not imply automatic trigger.** `BR-029` makes manual shipment update a **permanent first-class capability**, so the same canonical event may arrive by push, by poll, or by a human reading a courier portal. `BR-030` requires every tracking event to record which — because manual entries carry different evidential weight.

## 3.4 The undecided triggers

`GAP-019` records that **no document classifies state transitions as manual, automatic, or externally triggered**, and that this is a genuinely open commercial decision. The following events therefore carry `UNDECIDED`:

| Event | The open question |
|---|---|
| `Order.Released` | `OM §8.2` calls release "a distinct, deliberate authorisation", implying human action — but never states it, and its preconditions are all machine-evaluable |
| `Order.Closed` | Whether closure is evaluated continuously or on a cycle |
| `Payment.Reconciled` | Whether matching auto-confirms or requires acceptance |
| `Return.RTOCreated` | Whether attempt exhaustion auto-creates the return |

Each is marked in its entry. **Resolving them is a business decision, not a documentation exercise.**

---

# 4. Event Anatomy

## 4.1 Naming

`<Domain>.<Subject><PastTenseVerb>` per `SYS §13.5`. Domains: `Order` · `Verification` · `Fulfillment` · `Shipment` · `Inventory` · `Procurement` · `Payment` · `Return` · `Exchange` · **`Warranty`** · **`TradeIn`** · **`Accounting`** · **`Build`** · `Product` · `MasterData` · `Configuration` · `Permission` · `Audit` · `Notification` · `Integration` · `Data` · `Exception`. *`Warranty` added 2026-08-09 (§20); `Product` registered at `EVT-088`.*

## 4.2 Universal content

Carried by every event; not repeated per entry.

| Content | Source |
|---|---|
| Event identity | `DB-011` |
| Company scope | `EVA-005` |
| Subject reference | The entity acted upon |
| Actor and actor type | `EVA-004` |
| Authority or override under which the actor acted | `PRM-018` |
| Event time and record time | `EVA-006` |
| Business date | `DB-018` |
| Origin and trigger class | §3 |
| Correlation to the triggering event | `SYS §15.4` |

## 4.3 Entry format

Each entry states: class, source, targets, description, trigger, preconditions, state changes, data affected, business rules, notifications, audit, and future integration points.

> **Notifications.** `GAP-012` records the notification module as entirely undocumented — no triggers, templates, channel selection, preferences, or suppression. Entries state **whether a notification is required** by existing documentation and **to whom**; they do not invent templates, channels, or content.

---

# 5. Order Events

## EVT-001 · `Order.Created`

**Internal · Manual** — **Source** Order Management → **Targets** Customer, Audit

| | |
|---|---|
| Description | A staff member captures an order from a conversational or in-person channel |
| Trigger | Sales or call centre agent completes capture — Facebook, WhatsApp, phone, or walk-in (`OM §5.1.3`–`§5.1.5`) |
| Preconditions | Actor authorised to create orders; channel instance active; customer identified or created |
| State changes | Order enters `Order:DRAFT` or `Order:PENDING_VERIFICATION` on submit |
| Data affected | E-031 Order created; E-032 Order Items; E-023 Customer referenced or created |
| Business rules | `BR-002` records channel type **and** instance · `BR-006` non-catalogued lines cannot reserve stock · `BR-007` any non-catalogued line flags the order economically incomplete · `DB-023` price, customer, and description snapshotted |
| Notifications | None mandated at creation |
| Audit | `SYS-057` activity entry with source channel and capturing agent |
| Future integration | POS and B2B capture use this same event (`OM §6.6`, `§20.3`) |

> The shipped New Sale modal offers **"Marketplace item"** (typed manually) and **"Stock item"** (from catalogue) as separate blocks — the catalogued/non-catalogued distinction of `DM E-032` is established at this event.

---

## EVT-002 · `Order.Imported`

**External · Automatic** *(or Scheduled, if the adapter polls)* — **Source** Channel Adapter → **Targets** Order Management, Customer, Audit

| | |
|---|---|
| Description | An order arrives from an integrated channel — a Daraz shop or a website |
| Trigger | Marketplace or website transmits an order, or the adapter's poll cycle retrieves it |
| Preconditions | Channel instance configured and active; payload structurally valid; **not already imported** |
| State changes | Order enters `Order:PENDING_VERIFICATION` |
| Data affected | E-031 Order; E-032 Order Items; external references — marketplace order ID, shop identifier (SBID), stored with issuing party (`DB-013`) |
| Business rules | `SYS-045` **adapter idempotency — re-receiving the same order must not create a duplicate** · `BR-005` channel-specific logic confined to the adapter · `EVA-014` raw payload retained · `BR-002` instance-level attribution |
| Notifications | Internal only if import fails validation |
| Audit | Full inbound exchange auditable (`AUD §16`); raw payload retained as evidence |
| Future integration | Every future marketplace publishes this same canonical event — **no new event type** (`BR-069`) |

> **EVA-016 — Duplicate imports are absorbed silently and recorded, never reapplied.** External parties re-send and duplicate as normal behaviour, not as error.

---

## EVT-003 · `Order.Submitted`

**Internal · Manual** — **Source** Order Management → **Targets** Order Management (verification queue), Audit

| | |
|---|---|
| Description | A draft order becomes a commitment awaiting verification |
| Trigger | Capturing agent submits |
| Preconditions | Minimum required content present; actor authorised |
| State changes | `Order:DRAFT` → `Order:PENDING_VERIFICATION`; `Verification:PENDING` created |
| Data affected | E-031 Order; E-033 Verification created |
| Business rules | `BR-014` **every order receives a verification decision** — including "not required", which is itself recorded with a reason |
| Notifications | Order acknowledgement to customer where the channel supports it |
| Audit | Activity entry |
| Future integration | — |

---

## EVT-004 · `Order.Confirmed`

**Internal · Automatic** — **Source** Order Management → **Targets** Inventory *(availability check only)*, Notification, Audit

| | |
|---|---|
| Description | The order is commercially accepted; stock is **not** yet committed |
| Trigger | Verification reaches a successful terminal state (EVT-014, EVT-015, EVT-016) |
| Preconditions | `Verification` terminal and successful |
| State changes | `Order:PENDING_VERIFICATION` → `Order:CONFIRMED` |
| Data affected | E-031 Order; E-033 Verification outcome |
| Business rules | `BR-017` verification must complete before release · **confirmation is not release** — no reservation occurs here (`BR-018`) |
| Notifications | Confirmation to customer |
| Audit | Activity entry with the verification outcome and reason |
| Future integration | Pushed back to the originating marketplace where the channel expects it (`OM §7.6` step 8) |

> Confirmation and release are deliberately separate so an order can be commercially accepted while physically deferred — awaiting stock, awaiting B2B credit, or held during a stock count.

---

## EVT-005 · `Order.Released`

**Internal · `UNDECIDED`** *(`GAP-019`)* — **Source** Order Management → **Targets** Inventory, Warehouse, Audit

| | |
|---|---|
| Description | **The inventory-commitment gate.** Company stock is committed to this order |
| Trigger | Release authorised. `OM §8.2` calls this "a distinct, deliberate authorisation", implying human action — but no document states whether it may be automated when preconditions are met (`GAP-019`) |
| Preconditions | `OM §8.2`: verification terminal and successful · address present and serviceable · payment satisfied for prepaid; credit within limit for B2B (`BR-039`) · no active hold · source warehouse determined. ⚠ **Amended 2026-08-09 (`BD-441`, `BR-153`) — *stock available for every catalogued line or backorder authorised* REMOVED. Stock availability is not a release precondition; a shortage may be shown and never gates progression** |
| State changes | `Order:CONFIRMED` → `Order:RELEASED`; `Inventory:AVAILABLE` → `Inventory:RESERVED` for catalogued lines |
| Data affected | E-031 Order; E-027 Stock Reservation created; E-004 Warehouse assigned |
| Business rules | `BR-017` verification first · `BR-018` **release before reservation** · `BR-019` no warehouse queue entry before release · `BR-006` non-catalogued lines reserve nothing · `BR-053` reservation at release, not capture |
| Notifications | Internal to warehouse |
| Audit | Activity entry naming the releasing actor and authority |
| Future integration | May additionally depend on a marketplace readiness signal — **`GAP-021` records that `NOT RELEASED` semantics are unresolved** |

> **`BR-053` is the commercial reason for this design.** With 173 of 193 observed orders cancelled, reserving at capture would commit most stock to orders that never complete, starving orders that would.

---

## EVT-006 · `Order.Amended`

**Internal · Manual** — **Source** Order Management → **Targets** Inventory, Payment, Audit

| | |
|---|---|
| Description | Order content changes — address, quantity, product, price, or delivery preference |
| Trigger | Agent amends during verification, or a supervisor amends after release |
| Preconditions | Actor authority sufficient (`OM §7.9`); **amendment after dispatch is prohibited** (`BR-011`) |
| State changes | None to the Order machine; amended lines re-check stock availability |
| Data affected | E-031, E-032; reservation adjusted where quantity changed |
| Business rules | `OM §7.9` authority matrix — price beyond discount limit requires supervisor · `PRM-008` magnitude bounds · **`OM §3.4` amendment is generally not permitted on marketplace-owned channels**; the customer is directed to the marketplace |
| Notifications | Customer informed of the amendment |
| Audit | **Before and after values, reason, and authorising actor mandatory** (`DB-068`) |
| Future integration | Pushed to the channel where the channel accepts amendments |

---

## EVT-007 · `Order.Cancelled`

**Internal · Manual** — **Source** Order Management → **Targets** Inventory, Payment, Delivery, Notification, Audit

| | |
|---|---|
| Description | The order is terminated before delivery |
| Trigger | Customer declines, Trioloo rejects, verification expires, or staff cancel |
| Preconditions | Order not yet dispatched (`BR-011`) |
| State changes | → `Order:CANCELLED`; reservations released; pick or pack instructions recalled; packed goods unpacked and restocked |
| Data affected | E-031; E-027 reservation released; E-028 Inventory Movements for restock |
| Business rules | **`BR-016` every cancellation records a reason from a controlled vocabulary** · `BR-011` after dispatch the instrument is a return, not cancellation · `OM §6.4` cancellation authority by stage |
| Notifications | Customer notified with reason |
| Audit | Activity and audit entries; cancellation after dispatch is separately auditable (`AUD §12.2`) |
| Future integration | Pushed to the originating channel |

> **`BR-016` is disproportionately important here.** Cancellation is this operation's largest commercial loss; free-text reasons cannot be analysed, so the loss cannot be reduced.

---

## EVT-008 · `Order.ExternallyCancelled`

**External · Automatic** — **Source** Channel Adapter → **Targets** Order Management, Inventory, Payment, Audit

| | |
|---|---|
| Description | A marketplace cancels an order unilaterally |
| Trigger | Marketplace transmits a cancellation |
| Preconditions | None — **the marketplace may cancel at any time, without notice** (`OM §3.4`) |
| State changes | If **not yet dispatched**: → `Order:CANCELLED`, reservations released, packed goods restocked. If **already dispatched**: order is **not** cancelled — flagged externally-cancelled-in-transit and routed to the return workflow (`OM §6.5`) |
| Data affected | E-031; E-027; E-040 expected settlement voided or disputed |
| Business rules | `SYS-010` external authority is authoritative · **`OM §6.5` the dispatched case is a return, because goods are physically in the courier network** · `BR-003` mirrored data never locally overridden |
| Notifications | Internal to Accounts — expected settlement now void |
| Audit | External event recorded with its timestamp and raw payload |
| Future integration | Same handling for every future marketplace |

---

## EVT-009 · `Order.Restored`

**External · Automatic** — **Source** Channel Adapter → **Targets** Order Management, Inventory, Audit

| | |
|---|---|
| Description | A marketplace reinstates a previously cancelled order |
| Trigger | Marketplace transmits a restoration |
| Preconditions | Order was externally cancelled |
| State changes | **Order re-enters `Order:PENDING_VERIFICATION` — it never resumes at its prior stage** |
| Data affected | E-031; stock availability re-checked |
| Business rules | **`BR-012` a restored order re-enters verification and re-checks stock.** The reservation was released and the goods may since have been sold; the world changed while the order was cancelled · If stock is now unavailable, an exception is raised for commercial decision rather than auto-confirming |
| Notifications | Internal |
| Audit | Restoration recorded with the original cancellation reference |
| Future integration | Same for every marketplace supporting restoration |

---

## EVT-010 · `Order.PlacedOnHold` / `EVT-011 · Order.HoldReleased`

**Internal · Manual** — **Source** Order Management → **Targets** Warehouse, Inventory, Audit

| | |
|---|---|
| Description | Progress is deliberately suspended, then resumed |
| Trigger | Stock discrepancy, credit issue, or commercial decision |
| Preconditions | Order not dispatched |
| State changes | → `Order:ON_HOLD`; on release, returns to the prior stage |
| Data affected | E-031 |
| Business rules | `OM §6.2` the exit owner is whoever placed the hold |
| Notifications | Internal |
| Audit | Reason and actor recorded |
| Future integration | — |

> **`GAP-018` — hold has no documented entry or exit rules**: no authorised placers, reason vocabulary, maximum duration, ageing escalation, or **effect on reservations**. The reservation question is materially financial: a hold placed after release may reintroduce exactly the risk `BR-053` exists to avoid.

---

## EVT-012 · `Order.Dispatched`

**Internal · Automatic** — **Source** Order Management → **Targets** Inventory, Payment, Delivery, Notification, Accounting, Audit

| | |
|---|---|
| Description | Goods are handed to the carrier and leave Trioloo's control |
| Trigger | Carrier handover confirmed (EVT-030) |
| Preconditions | Shipment booked; **serials captured for every serialized line** (`BR-022`) |
| State changes | `Order:READY_TO_SHIP` → `Order:DISPATCHED`; `Inventory:PACKED` → `Inventory:IN_TRANSIT` with **stock deducted**; receivable expectation set |
| Data affected | E-031; E-028 deduction movement; E-040 Receivable created; E-021 serials bound to the shipment |
| Business rules | **`BR-054` stock is deducted at dispatch** — not at delivery, not at confirmation, because the goods have physically left · `SYS-055` expected receivable recorded alongside eventual actual · `DB-023` cost of goods snapshotted here, so margin does not move when replacement stock costs more |
| Notifications | Customer notified with tracking reference |
| Audit | Activity and audit entries; serials recorded against the order |
| Future integration | Dispatch confirmation pushed to the marketplace |

> This is the **single most consequential event in the system**: it moves stock, creates the receivable, fixes cost, and starts the delivery clock.

---

## EVT-013 · `Order.Delivered` / `Order.PartiallyDelivered`

**Internal · Automatic** — **Source** Order Management → **Targets** Payment, Inventory, Return & Exchange, Notification, Audit

| | |
|---|---|
| Description | The customer has received all, or some, of the goods |
| Trigger | Shipment delivered (EVT-034) |
| Preconditions | **The shipment delivered** — ⚠ **amended 2026-08-09 (`BD-442`): was *“at least one shipment delivered”*. An order has at most one active shipment** (`BR-023` as amended) |
| State changes | → `Order:DELIVERED` — ⚠ **amended 2026-08-09 (`BD-442`): `Order:PARTIALLY_DELIVERED` REMOVED**, and a failed or refused parcel goes to `Order:FAILED_DELIVERY` instead; `Inventory:IN_TRANSIT` → `Inventory:CONSUMED`; `Payment:NOT_DUE` → `Payment:DUE`; return window opens |
| Data affected | E-031; E-040 receivable due; E-021 serials bound to the customer for warranty; E-051 Warranty starts |
| Business rules | `BR-025` `Order:DELIVERED` requires every shipment delivered · **`BR-033` payment obligation follows delivered goods, never ordered goods** · `BR-010` **the order does not close here** · `BR-026` collection-point delivery completes Trioloo's obligation at the point, not at the customer's hands · `AUD-017` warranty retention starts from this date |
| Notifications | Delivery confirmation to customer |
| Audit | Proof of delivery retained as an attachment (`E-054`) |
| Future integration | Delivery status pushed to the marketplace |

---

## EVT-014 · `Order.Closed`

**Internal · `UNDECIDED`** *(`GAP-019`)* — **Source** Order Management → **Targets** Reporting, Accounting, Audit

| | |
|---|---|
| Description | Every obligation attached to the order is discharged |
| Trigger | All sub-machines reach terminal states. Whether evaluated continuously or on a cycle is undecided |
| Preconditions | `OM §18.4`: Verification terminal · every Shipment terminal · Payment `RECONCILED`, `REFUNDED`, or `WRITTEN_OFF` · no open Return or Exchange · all inventory movements settled |
| State changes | → `Order:CLOSED` |
| Data affected | E-031; realised margin finalised |
| Business rules | **`BR-010` `Order:CLOSED` requires every sub-machine terminal. Delivery does not close an order** · `BR-037` an order may sit delivered for weeks awaiting settlement — correct and expected, not a backlog |
| Notifications | None |
| Audit | Closure recorded with the terminal state of each machine |
| Future integration | Triggers period-close inclusion in Accounting |

---

# 6. Verification Events

## EVT-015 · `Verification.Queued` · EVT-016 · `Verification.Assigned`

**Internal · Automatic / Manual** — **Source** Order Management → **Targets** Order Management, Audit

| | |
|---|---|
| Description | An order enters the verification queue; an agent takes it |
| Trigger | Order submitted or imported; agent opens the order |
| Preconditions | Verification policy requires verification (`OM §7.2`) |
| State changes | `Verification:PENDING` → `Verification:IN_PROGRESS` |
| Data affected | E-033 Verification; agent assignment |
| Business rules | `OM §7.6` step 1 — priority derives from order value, channel policy, promised delivery date, and waiting time · **step 2 — the order is locked to prevent duplicate calling**; a customer called twice about one order is a service failure |
| Notifications | None |
| Audit | Assignment attributed |
| Future integration | Automated priority scoring; queue routing by team (`GAP-013` — no organisational model exists) |

---

## EVT-017 · `Verification.ContactAttempted`

**Internal · Manual** — **Source** Order Management → **Targets** Customer, Audit

| | |
|---|---|
| Description | An agent attempts to reach the customer |
| Trigger | Agent dials |
| Preconditions | Order in verification; attempts remaining under policy |
| State changes | Attempt counter increments; may lead to `Verification:UNREACHABLE` |
| Data affected | E-033 contact attempt record |
| Business rules | **`OM §7.6` step 4 — every attempt is logged including failures**, because failed attempts are the evidence base for the `UNREACHABLE` decision · `BR-015` attempt limits and intervals are per-channel configuration |
| Notifications | None |
| Audit | Timestamp, agent, number dialled, outcome |
| Future integration | Telephony integration could publish this automatically; **the manual path remains permanent** (`SYS-012`) |

---

## EVT-018 · `Verification.Confirmed` / `ConfirmedWithChanges`

**Internal · Manual** — **Source** Order Management → **Targets** Order Management, Notification, Audit

| | |
|---|---|
| Description | All five verification dimensions pass, with or without amendment |
| Trigger | Agent records the outcome |
| Preconditions | Customer, address, product, quantity, and delivery all confirmed (`OM §7.3`) |
| State changes | → `Verification:CONFIRMED` or `Verification:CONFIRMED_WITH_CHANGES`; triggers `Order.Confirmed` (EVT-004) |
| Data affected | E-033 with per-dimension outcomes; E-031 amended where changed |
| Business rules | `OM §7.3` **all five dimensions must pass** · dimension 3 carries elevated weight — desktop and TV variants differ by screen size, panel, processor, memory, and storage, where a small naming error yields a different product at materially different cost · dimension 5 carries elevated weight on COD: the payable amount must be stated and acknowledged, because a customer surprised at the door refuses the parcel |
| Notifications | Confirmation to customer |
| Audit | Per-dimension outcomes; amendments with before and after values |
| Future integration | — |

---

## EVT-019 · `Verification.AutoConfirmed`

**Internal · Automatic** — **Source** Order Management → **Targets** Order Management, Audit

| | |
|---|---|
| Description | Verification satisfied by policy without customer contact |
| Trigger | Channel policy permits — marketplace orders, walk-in |
| Preconditions | Policy exempts this order (`OM §7.2`) |
| State changes | → `Verification:AUTO_CONFIRMED` |
| Data affected | E-033 with the policy reason |
| Business rules | `BR-014` **"not required" is itself a decision, recorded with its reason** · `OM §7.8` marketplace orders arrive pre-validated and with contact restrictions · walk-in is auto-confirmed with reason `CUSTOMER_PRESENT` |
| Notifications | None |
| Audit | The exempting policy and its version recorded (`DB-022`) |
| Future integration | Trusted-pattern auto-confirmation for repeat customers (`OM §20.3`) — **manual equivalent retained** (`BR-070`) |

---

## EVT-020 · `Verification.CallbackScheduled` · EVT-021 · `Verification.CustomerCancelled` · EVT-022 · `Verification.Rejected` · EVT-023 · `Verification.Expired`

**Internal · Manual** *(EVT-023 Automatic)* — **Source** Order Management → **Targets** Order Management, Notification, Audit

| | |
|---|---|
| Description | Non-confirmation outcomes (`OM §7.7`) |
| Trigger | Customer requests a callback; customer declines; Trioloo declines; attempts exhausted |
| Preconditions | Order in verification |
| State changes | → `Verification:CALLBACK_SCHEDULED`, `CANCELLED_BY_CUSTOMER`, `REJECTED`, or `EXPIRED`; the last three cancel the order |
| Data affected | E-033; E-031 cancelled |
| Business rules | **`BR-016` reason from a controlled vocabulary** — price, delivery time, changed mind, ordered elsewhere, duplicate, mistake · `OM §7.7` rejection above a value threshold requires supervisor authority · `BR-015` retries spread across times of day, since a customer unreachable at one hour may be reachable at another |
| Notifications | Customer notified of cancellation with reason |
| Audit | Reason, actor, and attempt history |
| Future integration | Reason analysis feeds cancellation-rate reduction (`OM §2.3`) |

---

# 7. Fulfillment Events

## EVT-024 · `Fulfillment.PickTaskCreated` · EVT-025 · `Fulfillment.PickingStarted`

**Internal · Automatic / Manual** — **Source** Warehouse → **Targets** Order Management, Inventory, Audit

| | |
|---|---|
| Description | Pick work is generated and taken up |
| Trigger | Order released (EVT-005); picker takes the task |
| Preconditions | **Order released** (`BR-019`) |
| State changes | `Order:RELEASED` → `Order:IN_FULFILLMENT` |
| Data affected | E-035 Pick Task; picker assignment |
| Business rules | `BR-019` no warehouse queue entry before release · `OM §8.4` pick sequence ordered for an efficient path |
| Notifications | Internal |
| Audit | Task attributed to the picker |
| Future integration | Handheld scanning; automated pick sequencing |

---

## EVT-026 · `Fulfillment.PickConfirmed` · EVT-027 · `Fulfillment.PickDiscrepancyRaised`

**Internal · Manual** — **Source** Warehouse → **Targets** Inventory, Order Management, Audit

| | |
|---|---|
| Description | Lines are picked, or a discrepancy is found |
| Trigger | Picker confirms a line, or records a shortfall, damage, or wrong item |
| Preconditions | Pick task in progress |
| State changes | `Inventory:RESERVED` → `Inventory:PICKED`; on discrepancy → `Order:ON_HOLD` |
| Data affected | E-035; E-028 pick movement; E-056 Exception on discrepancy |
| Business rules | **`BR-020` a pick discrepancy always creates an inventory exception.** Silent substitution or short-picking is prohibited — stock accuracy depends on every discrepancy being visible · `OM §8.4` step 5 discrepancy handling |
| Notifications | Sales notified for customer decision on insufficient stock |
| Audit | Discrepancy with attribution |
| Future integration | Automated cycle-count triggering on discrepancy |

---

## EVT-028 · `Fulfillment.SerialsCaptured`

**Internal · Manual** — **Source** Warehouse → **Targets** Inventory, Order Management, Audit

| | |
|---|---|
| Description | The specific physical units leaving the building are recorded |
| Trigger | Warehouse captures serials during picking or packing |
| Preconditions | Product is serialized |
| State changes | Serials bound to the order and shipment |
| Data affected | E-021 Serial Numbers; E-031; E-037 |
| Business rules | **`BR-021` serials captured before packing completes** · **`BR-022` a serialized order cannot reach `Order:READY_TO_SHIP` until every required serial is captured** · `BR-056` this entry is part of the serial's permanent history |
| Notifications | None |
| Audit | Serial-to-order binding permanently retained |
| Future integration | Barcode and scanner capture |

> **Why this event is load-bearing.** It enables warranty enforcement, return authentication (`BR-047` — proving a returned unit is the unit dispatched, the principal return-fraud vector on desktops and televisions), defect traceability by batch, and dispute evidence.

---

## EVT-029 · `Fulfillment.PackingCompleted` · EVT-030 · `Fulfillment.ReadyToShip`

**Internal · Manual** — **Source** Warehouse → **Targets** Delivery, Order Management, Inventory, Audit

| | |
|---|---|
| Description | Goods are packed and awaiting carrier handover — the **RTS** state visible in the orders list |
| Trigger | Packer seals and labels the package |
| Preconditions | All lines picked; **all serials captured** (`BR-022`) |
| State changes | `Inventory:PICKED` → `Inventory:PACKED`; `Order:IN_FULFILLMENT` → `Order:READY_TO_SHIP` |
| Data affected | E-037 Shipment with weight and dimensions; handling instructions |
| Business rules | `OM §8.6` packaging appropriate to the goods — **televisions are large and fragile; desktops require anti-static and shock protection**; packaging choice is a documented decision, not individual discretion · weight and dimensions must be accurate because they determine courier charges and later charge reconciliation · special instructions transfer to the physical package and courier booking — the observed order carries *"Handle with care"* |
| Notifications | Internal |
| Audit | Package attributes and packer recorded |
| Future integration | Automated dimensioning and weighing |

---

# 8. Shipment & Delivery Events

## EVT-031 · `Shipment.Created` · EVT-032 · `Shipment.Booked`

**Internal · Automatic** *(booking may be External)* — **Source** Delivery → **Targets** Order Management, Audit

| | |
|---|---|
| Description | A shipment record is created and a carrier accepts it |
| Trigger | Order ready to ship; courier assignment; booking transmitted |
| Preconditions | Courier serves the destination; declared value within the carrier's limit |
| State changes | `Shipment:CREATED` → `Shipment:BOOKED`; tracking reference issued |
| Data affected | E-037 with tracking and consignment references (`DB-013`) |
| Business rules | `BR-027` **a shipment is an entity in its own right, not an attribute of the order** · `BR-028` courier assignment is configuration-driven · `OM §9.3` value limits are material for televisions and desktops · marketplace orders usually mandate the marketplace's courier (`OM §3.4`) |
| Notifications | Internal |
| Audit | Booking exchange retained |
| Future integration | Every future courier publishes this canonical event — **no lifecycle change** (`BR-028`) |

---

## EVT-033 · `Shipment.Dispatched`

**Internal · Manual** — **Source** Delivery → **Targets** Order Management, Inventory, Payment, Notification, Audit

| | |
|---|---|
| Description | The carrier takes possession |
| Trigger | Physical handover confirmed |
| Preconditions | Shipment booked; goods packed |
| State changes | `Shipment:AWAITING_PICKUP` → `Shipment:PICKED_UP`; triggers `Order.Dispatched` (EVT-012) |
| Data affected | E-037; COD amount fixed and communicated to the carrier |
| Business rules | `OM §11.5` step 1 — the COD amount to collect is fixed at dispatch |
| Notifications | Customer notified with tracking |
| Audit | Handover attributed |
| Future integration | Carrier manifest integration |

---

## EVT-034 · `Shipment.TrackingUpdated`

**External · Automatic, Scheduled, or Manual** — **Source** Courier Adapter → **Targets** Delivery, Order Management, Notification, Audit

| | |
|---|---|
| Description | A carrier reports movement |
| Trigger | **Three permanent mechanisms** (`OM §9.6`): carrier push · Trioloo poll · staff manual entry from a portal or phone call |
| Preconditions | Shipment active; tracking reference valid |
| State changes | Shipment machine advances — `IN_TRANSIT`, `AT_HUB`, `OUT_FOR_DELIVERY` |
| Data affected | E-038 Tracking Event appended |
| Business rules | **`BR-029` manual update is a permanent first-class capability, never a temporary workaround** — any carrier without integration must remain fully usable · **`BR-030` every event records its source**, because manual entries carry different evidential weight · **`BR-031` tracking history is append-only**; a correction is a new event, both retained · `OM §9.7` invalid or out-of-sequence transitions are recorded as exceptions, not applied — carrier feeds are not always ordered or correct |
| Notifications | Customer updates on significant milestones |
| Audit | Source and raw carrier status retained (`EVA-014`) |
| Future integration | New couriers translate into this same canonical event (`GAP-056` — **no canonical courier event vocabulary is yet documented**) |

---

## EVT-035 · `Shipment.Delivered`

**External · Automatic** — **Source** Courier Adapter → **Targets** Order Management, Payment, Inventory, Notification, Audit

| | |
|---|---|
| Description | The carrier reports successful delivery |
| Trigger | Carrier reports delivery, with proof where available |
| Preconditions | Shipment out for delivery |
| State changes | → `Shipment:DELIVERED`; triggers `Order.Delivered` (EVT-013); for COD, receivable → `Payment:COLLECTED_BY_INTERMEDIARY` — **not** received |
| Data affected | E-037 with proof of delivery; E-040 receivable; E-054 Attachment |
| Business rules | **`OM §10.3` step 3 — the collected amount moves the receivable to *collected by courier*, never to *received by Trioloo*** · `BR-026` collection-point delivery completes Trioloo's obligation at the point |
| Notifications | Delivery confirmation to customer |
| Audit | Proof of delivery retained as evidence |
| Future integration | Electronic proof-of-delivery capture |

---

## EVT-036 · `Shipment.DeliveryFailed`

**External · Automatic** — **Source** Courier Adapter → **Targets** Order Management, Notification, Audit

| | |
|---|---|
| Description | Delivery was attempted and did not complete |
| Trigger | Carrier reports failure with a reason |
| Preconditions | Delivery attempted |
| State changes | → `Shipment:DELIVERY_ATTEMPTED`; attempt counter increments; `Order:FAILED_DELIVERY`; order enters the call centre exception queue |
| Data affected | E-037; E-038; E-056 Exception |
| Business rules | **`BR-032` every failed delivery records a cause from a controlled vocabulary** — failed deliveries on high-value goods carry round-trip cost and handling risk, and causes must be analysable by area, courier, product, and channel · `OM §10.4` causes include customer unreachable, wrong address, unavailable, refused, **cannot pay the COD amount**, area inaccessible |
| Notifications | Call centre alerted; customer contacted |
| Audit | Cause and attempt count |
| Future integration | Failure-pattern analysis by area and courier |

---

## EVT-037 · `Shipment.Lost` · EVT-038 · `Shipment.Damaged`

**External · Automatic** — **Source** Courier Adapter → **Targets** Inventory, Payment, Order Management, Audit

| | |
|---|---|
| Description | The carrier cannot account for the goods, or damaged them |
| Trigger | Carrier reports, or a stuck-shipment threshold is reached |
| Preconditions | Shipment in the carrier network |
| State changes | → `Shipment:LOST` or `Shipment:DAMAGED`; `Inventory:IN_TRANSIT` → `Inventory:WRITTEN_OFF`; receivable voided; claim raised |
| Data affected | E-028 write-off with attribution; E-040; E-056 Exception |
| Business rules | **`BR-055` every inventory loss carries an attribution** — loss without attribution cannot be recovered, claimed, or prevented · `OM §9.8` customer offered replacement or refund |
| Notifications | Customer notified; claim raised with carrier |
| Audit | Write-off audited (`AUD §12.2`); attribution recorded |
| Future integration | Automated carrier claim submission |

> **`GAP-048` — no threshold is documented for when a stuck shipment becomes `LOST`**, so claims may never be raised.

---

# 9. Inventory Events

## EVT-039 · `Inventory.Reserved` · EVT-040 · `Inventory.ReservationReleased`

**Internal · Automatic** — **Source** Inventory → **Targets** Order Management, Warehouse, Audit

| | |
|---|---|
| Description | Stock is committed to an order, or the commitment is freed |
| Trigger | **Order confirmed** (`BR-096`, `IVN-014` — amended from *order released*); **order cancelled**, or an **explicit authorised manual release** (`IVN-048`). ⚠ **NOT `ON_HOLD`, and no reservation expiry exists** (`BD-436`, `BD-279`) |
| Preconditions | Stock available; **line is catalogued** |
| State changes | `Inventory:AVAILABLE` ↔ `Inventory:RESERVED` |
| Data affected | E-027 Stock Reservation; E-026 availability |
| Business rules | **`BR-052` reservation reduces availability without reducing stock** — failing to distinguish these produces either overselling or phantom shortages · `BR-006` non-catalogued lines cannot reserve · ~~`BR-053` reservation at release, not capture~~ **superseded by `BR-096`** · **`BR-149` `ON_HOLD` releases nothing; a held order is active** · **`IVN-049` a manual release records ten facts, performer and approver separate** · `SYS-032` **Inventory may refuse a reservation; refusal is a normal outcome** — **which is why a released reservation never silently reactivates** (`IVN-050`) |
| Notifications | Internal on refusal |
| Audit | Movement recorded |
| Future integration | Multi-warehouse allocation optimisation |

---

## EVT-041 · `Inventory.Deducted`

**Internal · Automatic** — **Source** Inventory → **Targets** Accounting, Order Management, Audit

| | |
|---|---|
| Description | Stock leaves Trioloo's control |
| Trigger | Order dispatched (EVT-012) |
| Preconditions | Goods packed and handed to the carrier |
| State changes | `Inventory:PACKED` → `Inventory:IN_TRANSIT`; **stock deducted** |
| Data affected | E-028 deduction movement; E-026 derived position; cost of goods snapshotted |
| Business rules | **`BR-054` stock is deducted at dispatch, not at delivery and not at confirmation.** At dispatch the goods have physically left; before that they are present and recoverable · `DB-001` position is derived from this movement, never adjusted in place |
| Notifications | None |
| Audit | Movement with attribution |
| Future integration | Triggers COGS recognition — **timing undecided** (`GAP-002`) |

---

## EVT-042 · `Inventory.Quarantined` · EVT-043 · `Inventory.Restocked` · EVT-044 · `Inventory.Regraded` · EVT-045 · `Inventory.Scrapped`

**Internal · Automatic / Manual** — **Source** Inventory → **Targets** Warehouse, Return & Exchange, Accounting, Audit

| | |
|---|---|
| Description | Returned goods enter quarantine, then are restocked, regraded, or scrapped |
| Trigger | Return received; QC outcome recorded |
| Preconditions | Goods physically received |
| State changes | `Inventory:RETURNING` → `Inventory:QUARANTINE` → `AVAILABLE`, `REGRADED`, or `SCRAPPED` |
| Data affected | E-028 movements; E-021 serial condition; E-026 |
| Business rules | **`BR-046` returned goods enter quarantine on receipt and never enter sellable stock before passing QC.** For high-value electronics this is essential: an unchecked faulty television returned directly to stock will be resold and returned again, at double cost and with reputational damage |
| Notifications | Internal |
| Audit | Disposition decision and actor recorded |
| Future integration | Refurbishment and open-box channels |

> **`GAP-047` — the condition grade vocabulary and its valuation impact are undefined**, though `REGRADED` is a state and "restock as open-box at adjusted value" is a specified disposition.

---

## EVT-046 · `Inventory.Adjusted` · EVT-047 · `Inventory.WrittenOff`

**Internal · Manual** — **Source** Inventory → **Targets** Accounting, Audit

| | |
|---|---|
| Description | Stock is corrected, or a loss is recognised |
| Trigger | Count discrepancy, damage, loss, or theft |
| Preconditions | **Actor holds adjustment authority within magnitude bounds** |
| State changes | Position corrected via a movement; never edited in place |
| Data affected | E-028 adjustment movement with attribution |
| Business rules | **`BR-055` every loss carries an attribution** — "missing" is a symptom, not a conclusion · `PRM-012` **receiving goods and adjusting stock are segregated**, to prevent concealed theft · `PRM-008` adjustments carry a magnitude bound; beyond it, escalation · `DB-002` correction by compensating movement, never edit |
| Notifications | Supervisor on adjustments above threshold |
| Audit | **Manual stock adjustment is explicitly auditable** (`AUD §12.2`) |
| Future integration | Cycle counting; automated variance detection |

---

## EVT-048 · `Inventory.CountCompleted`

**Internal · Scheduled** — **Source** Warehouse → **Targets** Inventory, Accounting, Audit

| | |
|---|---|
| Description | A physical stock count concludes |
| Trigger | Scheduled count cycle |
| Preconditions | Count authorised |
| State changes | Variances become adjustment movements (EVT-046) |
| Data affected | E-026; E-028 |
| Business rules | `DB §13.1` physical count versus system stock is a **required reconciliation**, detecting shrinkage, mis-picks, and unrecorded damage · `DB-062` **the reconciliation produces a result even when it finds nothing** — a reconciliation reporting only exceptions cannot be distinguished from one that has stopped running |
| Notifications | Variance report to management |
| Audit | Count and variances retained |
| Future integration | Perpetual cycle counting |

> **`GAP-062` — no reconciliation cycle is defined** for any of the eight required reconciliations.

---

# 10. Procurement Events

## EVT-049 · `Procurement.PurchaseOrderApproved`

**Internal · Manual** — **Source** Procurement → **Targets** Supplier, Accounting, Audit

| | |
|---|---|
| Description | A commitment to buy is authorised |
| Trigger | Approver authorises within magnitude bounds |
| Preconditions | **Approver is not the creator** (`PRM-006`) |
| State changes | Purchase order approved |
| Data affected | E-029 Purchase Order |
| Business rules | `PRM-008` approval carries a value bound; beyond it, escalation · `PRM-012` **creating a supplier and approving payment to that supplier are segregated** — this pair guards against fabricated-supplier fraud |
| Notifications | Supplier receives the order |
| Audit | Approval attributed with authority |
| Future integration | Supplier portal integration; **`GAP-014` multi-step approval chains are unspecified** |

---

## EVT-050 · `Procurement.GoodsReceived`

**Internal · Manual** — **Source** Procurement → **Targets** Inventory, Accounting, Warehouse, Audit

| | |
|---|---|
| Description | Purchased goods physically arrive and become Trioloo's stock |
| Trigger | Warehouse receives against a purchase order |
| Preconditions | Purchase order exists and is open |
| State changes | Stock enters `Inventory:AVAILABLE`; **serials recorded** |
| Data affected | E-030 Goods Receipt; E-028 movements; **E-021 Serial Numbers created** |
| Business rules | **`DB-014` serials are recorded on inbound — this is the origin of every serial's permanent history** · `DB-061` receipt-versus-invoice discrepancies raise exceptions, never silent correction · `PRM-012` receiving and adjusting are segregated |
| Notifications | Internal |
| Audit | Receipt and serials retained |
| Future integration | **Inbound QC has no documented process** (`GAP-045`) |

---

## EVT-051 · `Procurement.CostFinalised`

**Internal · Manual** — **Source** Procurement → **Targets** Inventory, Accounting, Audit

| | |
|---|---|
| Description | The acquisition cost of received goods is established |
| Trigger | Supplier invoice matched; landed cost components allocated |
| Preconditions | Goods received |
| State changes | Cost attaches to stock |
| Data affected | E-030; E-026 valuation |
| Business rules | `DB-039` allocated costs must sum exactly to the original, with rounding residue explicitly placed |
| Notifications | Internal |
| Audit | Cost basis retained |
| Future integration | — |

> **This event is the origin of every margin figure in the system.** `GAP-046` records that **landed cost is named but never defined**, and `GAP-005` that valuation method is undecided. The observed `Cost ৳0` on a live order line has no documented path to becoming a real number until both are resolved.

---

# 11. Payment & Settlement Events

## EVT-052 · `Payment.ReceivableRaised`

**Internal · Automatic** — **Source** Payment → **Targets** Accounting, Order Management, Audit

| | |
|---|---|
| Description | An expectation of money is recorded |
| Trigger | Order dispatched (EVT-012) |
| Preconditions | Goods dispatched |
| State changes | Receivable created in `Payment:NOT_DUE`, moving to `Payment:DUE` on delivery |
| Data affected | E-040 with **expected amount** |
| Business rules | `BR-033` obligation follows delivered goods · `SYS-055` expected recorded now, actual recorded later, **both retained** |
| Notifications | None |
| Audit | Expectation basis recorded |
| Future integration | Revenue recognition trigger — **timing undecided** (`GAP-002`) |

---

## EVT-053 · `Payment.CollectedByIntermediary`

**External · Automatic** — **Source** Courier or Channel Adapter → **Targets** Payment, Audit

| | |
|---|---|
| Description | The customer has paid, but the money is held by a courier or marketplace |
| Trigger | Delivery with COD collection reported |
| Preconditions | Goods delivered; collection mode is intermediated |
| State changes | `Payment:DUE` → `Payment:COLLECTED_BY_INTERMEDIARY` |
| Data affected | E-040; cash-in-transit exposure per courier |
| Business rules | **`BR-035` collection and settlement are separate and must never be conflated. This is not revenue received** · `BR-036` money held by a carrier is a **tracked exposure**, aged per courier |
| Notifications | None |
| Audit | Collection recorded with its source |
| Future integration | Courier cash-position reporting |

> **This event exists precisely to prevent the most damaging error available to this system**: marking an order "paid" at delivery. On every channel Trioloo operates, that would be a false statement.

---

## EVT-054 · `Payment.CashReceived`

**Internal · Manual** — **Source** Payment → **Targets** Accounting, Audit

| | |
|---|---|
| Description | Money reaches Trioloo directly — own delivery, counter sale, or direct transfer |
| Trigger | Cash office or counter records receipt |
| Preconditions | Actor authorised to record receipts |
| State changes | `Payment:DUE` → `Payment:RECEIVED` |
| Data affected | E-041 Payment Transaction |
| Business rules | `DB-037` exact decimal representation · **`AUD §12.2` manually recorded payment is explicitly auditable because it bypasses automated reconciliation** |
| Notifications | Receipt to customer where applicable |
| Audit | Actor and instrument recorded |
| Future integration | Payment gateway integration (`GAP-055` — **no gateway abstraction documented**) |

---

## EVT-055 · `Payment.RemittanceReceived`

**External · Automatic or Manual** — **Source** Courier Adapter → **Targets** Payment, Accounting, Audit

| | |
|---|---|
| Description | A courier transfers collected COD cash, covering many orders |
| Trigger | Remittance file or transfer received |
| Preconditions | Courier has collected COD |
| State changes | Covered receivables → `Payment:RECEIVED`, then `Payment:RECONCILED` on match |
| Data affected | E-042 Remittance Batch; E-041 transactions |
| Business rules | `OM §11.5` step 5 — matched line by line: coverage, per-order amount, deducted charges, **missing orders**, and ageing · **`BR-036` unremitted COD is tracked and aged per courier; money held beyond terms is an exception requiring action, not a passive balance** |
| Notifications | Accounts alerted to shortfalls |
| Audit | Remittance file retained as received (`EVA-014`) |
| Future integration | Automated remittance ingestion |

---

## EVT-056 · `Payment.SettlementReceived`

**External · Scheduled** — **Source** Channel Adapter → **Targets** Payment, Accounting, Reporting, Audit

| | |
|---|---|
| Description | A marketplace transfers its periodic settlement, **net of deductions** |
| Trigger | Settlement report published for a period |
| Preconditions | Settlement cycle elapsed for the channel instance |
| State changes | Covered receivables → `Payment:RECEIVED`, `RECONCILED`, or `SHORT_SETTLED` |
| Data affected | E-043 Marketplace Settlement; E-044 Settlement Lines with itemised deductions |
| Business rules | **`BR-037` settlement is entirely independent of shipment and order state** — an order may be delivered and operationally complete while settlement remains outstanding for weeks · **`BR-038` expected and actual both retained; the difference is the reconciliation variance, the primary instrument for detecting deduction errors.** Overwriting the expectation destroys the ability to detect the very errors reconciliation exists to find · `DB-022` commission rates versioned, so renegotiation never rewrites historical margin |
| Notifications | Accounts alerted to variances |
| Audit | Settlement report retained **as received** |
| Future integration | Every future marketplace publishes this canonical event |

> **Deduction categories** (`OM §11.6`): commission · voucher and promotion · shipping charge · payment fee · penalty · return cost · prior-period adjustment.
>
> The observed economics — `Sale ৳48 · Charges ৳30 · Received ৳18` — are this event made concrete. The customer paid 48; Trioloo received 18; the intermediary retained 30. **Only the third figure is revenue.**

---

## EVT-057 · `Payment.Reconciled` · EVT-058 · `Payment.ShortSettled` · EVT-059 · `Payment.Disputed`

**Internal · `UNDECIDED`** *(EVT-057; `GAP-019`)* **/ Automatic** — **Source** Payment → **Targets** Accounting, Reporting, Audit

| | |
|---|---|
| Description | Received money is matched to expectation, or a shortfall is detected and pursued |
| Trigger | Matching completes. Whether matching auto-confirms or requires human acceptance is undecided |
| Preconditions | Money received |
| State changes | → `Payment:RECONCILED`, `SHORT_SETTLED`, or dispute raised |
| Data affected | E-040 variance; E-044 |
| Business rules | `OM §11.6` step 5 variance handling — deduction higher than agreed → dispute; unexpected category → investigate; order missing from settlement → flag and age; penalty → record against its cause · **`AUD §12.2` accepting a settlement variance is an auditable financial action** |
| Notifications | Accounts and management on material variance |
| Audit | Acceptance of a shortfall is audited as a financial decision |
| Future integration | Automated dispute submission |

---

## EVT-060 · `Payment.RefundCompleted`

**Internal · Manual** — **Source** Payment → **Targets** Accounting, Return & Exchange, Notification, Audit

| | |
|---|---|
| Description | Money is returned to the customer |
| Trigger | Accounts executes an authorised refund |
| Preconditions | **Goods received and QC passed** where a return triggered it; **money actually received** |
| State changes | → `Payment:REFUNDED` |
| Data affected | E-045 Refund; E-041 outbound transaction |
| Business rules | **`BR-040` a refund can never exceed the amount actually received** · **`BR-041` a refund is initiated only after the money has been received** — refunding unsettled money creates real cash exposure on an unrecovered receivable · `BR-042` refunds follow the original collection route by default · `BR-043` reason, authorising actor, and trigger recorded · `PRM-012` **approving a return and issuing a refund are segregated** |
| Notifications | Customer notified |
| Audit | **Explicitly auditable — money leaving the business** (`AUD §12.2`) |
| Future integration | Automated refund through payment providers |

---

## EVT-061 · `Payment.WrittenOff`

**Internal · Manual** — **Source** Payment → **Targets** Accounting, Audit

| | |
|---|---|
| Description | A receivable is deemed unrecoverable |
| Trigger | Authorised write-off decision |
| Preconditions | **Actor holds write-off authority within magnitude bounds; not self-approved** |
| State changes | → `Payment:WRITTEN_OFF` |
| Data affected | E-040 |
| Business rules | `PRM-008` bounded authority · `PRM-006` no self-approval · `PRM-012` **recording settlement and writing off a shortfall are segregated**, preventing concealed misappropriation |
| Notifications | Management |
| Audit | **Loss recognition — explicitly auditable** |
| Future integration | — |

---

# 12. Return Events

## EVT-062 · `Return.Requested` · EVT-063 · `Return.RTOCreated`

**Internal · Manual / `UNDECIDED`** *(EVT-063; `GAP-019`)* — **Source** Return & Exchange → **Targets** Order Management, Warehouse, Audit

| | |
|---|---|
| Description | A customer requests a return, or a failed delivery generates a return to origin |
| Trigger | Customer request through any channel; or delivery attempts exhausted |
| Preconditions | For customer returns: within the return window and product eligible |
| State changes | `Return:REQUESTED` or `Return:AWAITING_RECEIPT` |
| Data affected | E-047 Return with **type** and reason |
| Business rules | **`BR-044` RTO and customer returns are distinguished throughout.** They share warehouse receipt and QC but differ entirely in payment, margin, and analysis: an RTO never generated a receivable, a customer return did. Merging them corrupts both the return-rate metric and the refund liability · **`BR-045` return reason and fault attribution are recorded separately** — "damaged" is a reason; whether the supplier, warehouse, courier, or customer is at fault drives who bears the cost |
| Notifications | Customer acknowledgement |
| Audit | Reason and type recorded |
| Future integration | Customer self-service returns |

> **`GAP-064` — return windows and product eligibility are undefined** for Trioloo-owned channels.

---

## EVT-064 · `Return.Approved` · EVT-065 · `Return.Rejected`

**Internal · Manual** — **Source** Return & Exchange → **Targets** Order Management, Notification, Audit

| | |
|---|---|
| Description | The return request is decided |
| Trigger | Authorised actor decides against policy |
| Preconditions | Policy check performed; **marketplace policy governs on marketplace channels** (`OM §3.4`) |
| State changes | `Return:APPROVED` → `AWAITING_RECEIPT`, or `Return:REJECTED` → `CLOSED` |
| Data affected | E-047 |
| Business rules | `PRM-008` approval bounded by value · `PRM-012` approving a return and issuing the refund are segregated · rejection requires a reason communicated to the customer |
| Notifications | Customer notified of the decision and reason |
| Audit | Decision, actor, and reason |
| Future integration | Policy-driven auto-approval |

---

## EVT-066 · `Return.GoodsReceived`

**Internal · Manual** — **Source** Warehouse → **Targets** Inventory, Return & Exchange, Audit

| | |
|---|---|
| Description | Returned goods physically arrive |
| Trigger | Warehouse receives the return |
| Preconditions | Return approved, or goods arrived as RTO |
| State changes | `Return:RECEIVED`; goods enter `Inventory:QUARANTINE` |
| Data affected | E-047; E-028 movement into quarantine |
| Business rules | **`BR-046` returned goods are received into quarantine and never enter sellable stock before passing QC** |
| Notifications | Internal |
| Audit | Receipt attributed |
| Future integration | Unidentified returns held in quarantine pending investigation (`OM §12.6`) |

---

## EVT-067 · `Return.QCPassed` · EVT-068 · `Return.QCFailed`

**Internal · Manual** — **Source** Warehouse → **Targets** Inventory, Payment, Return & Exchange, Audit

| | |
|---|---|
| Description | Inspection determines whether returned goods are acceptable |
| Trigger | Inspector records the outcome |
| Preconditions | Goods received and in quarantine |
| State changes | `Return:UNDER_QC` → `QC_PASSED` → `RESTOCKED`, or `QC_FAILED` → `QUARANTINED` → `SCRAPPED` |
| Data affected | E-049 QC Inspection; E-021 serial condition; E-028 disposition movement |
| Business rules | **`BR-047` serial verification at QC is mandatory for serialized products.** Without it a customer can return a different or older unit; on desktops and televisions this is the principal return-fraud vector · `OM §12.5` step 6 checks: serial, completeness, physical condition, functional test, packaging, tampering · step 7 — **a returned unit whose serial differs from the dispatched unit is return fraud: escalate and withhold refund pending investigation** · refund may be reduced for missing components |
| Notifications | Customer notified where the refund is adjusted |
| Audit | QC outcome, serial verification result, inspector |
| Future integration | Refurbishment routing |

> **`GAP-045` — `QC` is used 62 times across the documentation and never defined.** No document specifies who performs it, what qualifies an inspector, what tolerances apply, or how a disputed outcome is resolved. This event is documented structurally; **the process definition does not exist** (`EVA-001`).

---

# 13. Exchange Events

## EVT-069 · `Exchange.Requested` · EVT-070 · `Exchange.Approved`

**Internal · Manual** — **Source** Return & Exchange → **Targets** Inventory, Payment, Audit

| | |
|---|---|
| Description | A customer asks to replace delivered goods; the request is approved |
| Trigger | Customer request; authorised approval |
| Preconditions | Within policy; **replacement available** — an exchange is never approved against unavailable stock without the customer's agreement (`OM §13.6` step 3) |
| State changes | `Exchange:REQUESTED` → `APPROVED` → `AWAITING_ORIGINAL` or `REPLACEMENT_RESERVED` |
| Data affected | E-050 Exchange; value difference computed |
| Business rules | **`BR-048` an exchange is a single linked transaction, not a return plus a sale.** Modelling it as two loses the commercial link, restarts warranty incorrectly, moves full money rather than the difference, and miscounts it in analysis · **`BR-049` advance and simultaneous exchange require authority and a defined recovery path** — the original remains an open obligation, aged and escalated · customer informed of any payable or refundable difference **before** approval |
| Notifications | Customer informed of the difference |
| Audit | Approval, sequencing model, and authority |
| Future integration | — |

---

## EVT-071 · `Exchange.ReplacementShipped` · EVT-072 · `Exchange.Closed`

**Internal · Automatic** — **Source** Return & Exchange → **Targets** Order Management, Inventory, Delivery, Audit

| | |
|---|---|
| Description | The replacement dispatches and, on delivery, the exchange completes |
| Trigger | Replacement dispatched; replacement delivered |
| Preconditions | Difference settled where payable; original received and QC-passed for standard sequencing |
| State changes | `Exchange:REPLACEMENT_DISPATCHED` → `REPLACEMENT_DELIVERED` → `CLOSED` |
| Data affected | E-050; E-037 replacement Shipment; **E-021 new serials recorded**; E-051 Warranty |
| Business rules | **`BR-050` the original order is not closed by an exchange; it remains linked to it** — the customer's commercial history includes both what was sold and what they finally hold · `OM §13.6` step 10 — warranty continues the original term for a like-for-like fault replacement, or starts fresh for a different product |
| Notifications | Customer notified of dispatch and delivery |
| Audit | Replacement serials bound; exchange chain retained |
| Future integration | Repeated exchange failure escalation (`OM §13.7`) |

---

# 14. Master Data & Configuration Events

## EVT-073 · `MasterData.Created` · EVT-074 · `MasterData.Changed` · EVT-075 · `MasterData.Archived`

**Internal · Manual** — **Source** owning module → **Targets** all consumers, Audit

| | |
|---|---|
| Description | A product, variant, customer, supplier, warehouse, courier, or channel is created, amended, or withdrawn |
| Trigger | Authorised user action |
| Preconditions | Actor authorised; validation passed |
| State changes | Record lifecycle (`SYS §7.1`) |
| Data affected | The master entity; history retained for commercially significant fields |
| Business rules | **`SYS-024` archived, never deleted** — records referenced by history remain permanently resolvable · `DB-025` changes to commercially significant fields retained as history · **`SYS-024` existing references to an archived record remain valid; new references are refused** · `DB-023` snapshots on existing transactions are unaffected — **changing a product's price today never alters last month's margin** |
| Notifications | Internal to affected consumers |
| Audit | **Before and after values mandatory** (`DB-068`) |
| Future integration | Master data synchronisation to marketplaces |

---

## EVT-076 · `Configuration.VersionActivated`

**Internal · Manual** — **Source** System → **Targets** all modules, Audit

| | |
|---|---|
| Description | A new version of a configuration value takes effect — commission rate, courier tariff, verification policy, authority bound |
| Trigger | Authorised configuration change with an effective date |
| Preconditions | Administrator authority; effective period coherent |
| State changes | New Configuration Version becomes effective |
| Data affected | E-057 Configuration Version |
| Business rules | **`SYS-021`, `DB-022` transactions reference the version in force on their own business date** · **`DB-047` a controlled vocabulary value may be deprecated but never repurposed or deleted** — repurposing silently changes the meaning of every historical record referencing it |
| Notifications | Affected teams |
| Audit | Before and after, authorising actor, effective period |
| Future integration | — |

> **Why this event is load-bearing.** Without it, renegotiating a Daraz commission or a Steadfast tariff **silently rewrites the margin on every past order**, and filed tax returns cease to reconcile.

---

# 15. Platform Events

## EVT-077 · `Exception.Raised` · EVT-078 · `Exception.Assigned` · EVT-079 · `Exception.Resolved`

**Internal · Automatic / Manual** — **Source** any module → **Targets** Notification, Reporting, Audit

| | |
|---|---|
| Description | A condition requiring human resolution is detected, owned, and closed |
| Trigger | Any of the dozens of conditions across the documentation that specify "raise an exception" |
| Preconditions | None |
| State changes | Exception lifecycle (`SYS §6.2`) |
| Data affected | E-056 Exception |
| Business rules | **`SYS-022` every exception has an owning role and a resolution path** — one nobody owns is a defect in the specification · **`SYS-023` exceptions are visible, aggregated, and aged**; one existing only inside a record's history will not be acted on |
| Notifications | Owning role alerted |
| Audit | Raising, assignment, and resolution |
| Future integration | Automated triage |

> **`GAP-060` — no exception type vocabulary exists**: no controlled list, no severity criteria, no routing rules, making `SYS-022`'s owning-role requirement undeterminable.

---

## EVT-080 · `Integration.SyncFailed` · EVT-081 · `Integration.Diverged` · EVT-082 · `Integration.ManualRequired`

**External-facing · Automatic** — **Source** Adapter → **Targets** Exception, Notification, Audit

| | |
|---|---|
| Description | An external exchange fails, a mirror diverges from its source, or automation exhausts its retries |
| Trigger | Exchange failure; comparison detects divergence; retries exhausted |
| Preconditions | Integration configured |
| State changes | Integration sync lifecycle (`SYS §7.1`) |
| Data affected | Sync state; E-056 Exception |
| Business rules | **`SYS-026` a mirror that no longer matches its source is never silently corrected in either direction** — the divergence is surfaced · **`SYS-025` `MANUAL_REQUIRED` is a normal state, not a system failure** — the operational expression of `SYS-012` · `SYS-054` publisher unaffected by subscriber failure |
| Notifications | Operations alerted |
| Audit | Failure and raw exchange retained |
| Future integration | Every future integration inherits these events unchanged |

---

## EVT-083 · `Data.ReconciliationCompleted` · EVT-084 · `Data.DiscrepancyDetected`

**Internal · Scheduled** — **Source** owning module → **Targets** Exception, Reporting, Audit

| | |
|---|---|
| Description | A required reconciliation runs and reports its result |
| Trigger | Scheduled cycle |
| Preconditions | Cycle defined |
| State changes | Discrepancies become exceptions |
| Data affected | Reconciliation result; E-056 |
| Business rules | **`DB-062` every reconciliation produces a result, including when it finds nothing** — one reporting only exceptions cannot be distinguished from one that has stopped running · **`DB-060` eventual consistency is acceptable only because these detect divergence**; a gap without a detector is a silent data-loss channel |
| Notifications | Owning role on discrepancy |
| Audit | Run and result retained |
| Future integration | — |

> The eight required reconciliations are listed in `DB §13.1`. **`GAP-062` — no cycle is defined for any of them.**

---

## EVT-085 · Permission events · EVT-086 · Audit events · EVT-087 · Notification events

Defined in full in [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) §13 and [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) §17. **Not restated** (`SYS-016`, `DOC-006`).

| Group | Events |
|---|---|
| **Permission** | `RoleAssigned` · `RoleRevoked` · `OverridePerformed` · `EscalationRequested/Approved/Rejected` · `AccessDenied` · `SegregationConflictAccepted` · `AccessReviewCompleted` |
| **Audit** | `RecordSealed` · `CaptureFailed` · `IntegrityCheckCompleted` · **`IntegrityViolationDetected`** · `EvidencePackageProduced` · `PurgeExecuted` |
| **Notification** | `Sent` · `DeliveryFailed` · `Suppressed` — **structure undocumented** (`GAP-012`) |

> ⚠ **The three lists above are illustrative, not exhaustive.** The owning documents are canonical and carry more: `PERMISSION_ARCHITECTURE.md` §13 registers **eleven** `Permission.*` events (adding `UserCreated`/`UserDisabled`, `RoleDefinitionChanged`, `ScopeGranted`/`ScopeRevoked`, `AuthorityBoundChanged`, `DelegationGranted`/`Expired`), and `AUDIT_ARCHITECTURE.md` §17 registers **eight** `Audit.*` events (adding `RetentionExpired`, `SensitiveAccessRecorded`). **The delegation already covered them; only these summaries were short.** Corrected 2026-08-09.

## EVT-088 · Product events

Defined in full in [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) §22. **Not restated** (`SYS-016`, `DOC-006`) — same delegation convention as `EVT-085` – `EVT-087`.

| Group | Events |
|---|---|
| **Product** | `SellableCreated`/`Changed`/`Archived` · `InventoryProductCreated`/`Changed`/`Archived` · **`BuildTemplateVersionActivated`** · `BuildTemplateWithdrawn` · **`AsBuiltRecorded`** · `SubstitutionApplied` · `ListingCreated`/`Updated`/`Withdrawn` · `ListingSynced`/`SyncFailed`/`Diverged` · `AvailabilityRecomputed` · `MappingResolved` · `MappingFailed` |

**These extend the `MasterData` group** (`EVT-073` – `EVT-075`), as `PRODUCT_ARCHITECTURE.md` §22 states.

> **Registered 2026-08-09, discharging an amendment recorded since `PRODUCT_ARCHITECTURE.md` v1.0.0.** Its Appendix A item 8 required *"Register product events (§22)"* here and marked the content **specification-ahead-of-ratification** until done. **The events were confirmed in their owning document and had no entry in this register** — this is propagation, not invention: **not one event name, class or purpose originates here.**

> **`PRD-090` — `Product.AsBuiltRecorded` is the most consequential product event.** It fixes component cost, establishes warranty attribution, and creates the record on which return authentication depends. **It is also the completion fact of `SM-12` Build Job** — see §19.

> **`Product.ListingSynced` / `SyncFailed` / `Diverged` are External · Automatic** and must not be read as Trioloo causing the fact (`EVA-013`, `API-034`). **The channel reports; Trioloo ingests and records** (`PRD-018` as amended, `SYS-010`).

---

> **`AUD-035` — `Audit.IntegrityViolationDetected` is the highest-severity event the system can raise.** It means the record of what happened can no longer be trusted, invalidating every other assurance the system offers. It escalates immediately to management, never queued as routine work.

---

# 16. Coupling Matrix

Consolidates `ORDER_MANAGEMENT_ARCHITECTURE.md` §18.3 and extends it across all modules.

> ⚠ **This matrix is NOT the complete inter-module coupling surface, and the claim that it was has been withdrawn** (2026-08-09). **Warranty & Repair rows were added the same day** from §20. **Trade-In rows were added the same day** from §21. It still carries no rows for **Build Job, Conversation or Fund Transfer**, because **no event is registered for the machines those modules run** — see §19. **Every row below remains correct**; what was false was the word *complete*.

| Publisher | Event | Subscribers | Effect |
|---|---|---|---|
| Verification | Confirmed | Order | Eligible for release |
| Verification | Cancelled / Rejected / Expired | Order | Order cancelled |
| Order | Released | Inventory, Warehouse | Reserve stock; queue pick work |
| Order | Cancelled pre-dispatch | Inventory, Delivery | Release reservation; void booking |
| Order | Dispatched | Inventory, Payment, Delivery, Accounting | Deduct stock; set expectation; activate shipment; snapshot COGS |
| Shipment | Delivered | Order, Payment, Inventory | Order delivered; receivable due; transit consumed |
| Shipment | Delivery failed, exhausted | Return | RTO created |
| Shipment | Lost / Damaged | Inventory, Payment | Write off with attribution; void receivable; raise claim |
| Payment | Reconciled | Order, Accounting | Financial obligation satisfied |
| Payment | Short-settled | Order, Accounting | Dispute flag; order held open |
| Return | Received | Inventory | Quarantine |
| Return | QC passed / failed | Inventory, Payment | Restock, regrade, or scrap; release or withhold refund |
| Return | Refund completed | Payment, Accounting | Refund recorded |
| Exchange | Replacement reserved | Inventory | Reserve replacement |
| Exchange | Replacement delivered | Order | Exchange obligation satisfied |
| Procurement | Goods received | Inventory, Accounting | Stock available; serials created; cost attaches |
| External channel | Cancelled | Order | Cancel, or route to return if dispatched |
| External channel | Restored | Verification | Re-enter `Verification:PENDING` |
| External channel | Settlement received | Payment, Accounting, Reporting | Reconcile; compute realised margin |
| Configuration | Version activated | All | New values effective from their date |
| **Warranty & Repair** | **Unit received into custody** | **Notification** | **Confirm to the customer that Trioloo holds the product.** Inventory deliberately does not react (`IVN-033`) |
| **Warranty & Repair** | **Customer decision required** | **Notification** | **Contact the customer; the case waits and silence is never approval** |
| **Warranty & Repair** | **Replacement authorised** | **Inventory, Warehouse** | **Reserve the unit from sellable stock so it cannot be allocated to a sales order; picking and QC follow. No deduction, no posting, no revenue** |
| **Warranty & Repair** | **Supplier claim submitted** | **Procurement** | **Make the claim visible against the supplier; accumulate warranty/claim history.** No payment, posting, stock or inventory effect |
| **Warranty & Repair** | **Supplier claim outcome recorded** | **Procurement** | **Update supplier claim history.** ⚠ **Acceptance is not recovery** |
| **Warranty & Repair** | **Resolution decided** | **Notification** | **Inform the customer of the outcome** |
| **Warranty & Repair** | **Ready for handback** | **Notification, Delivery** | **Inform the customer** — required before the case is treatable as ready; **Delivery creates a shipment linked to the case where transport is required** |
| **Trade-In** | **Agreement accepted** | **Accounting** | **Create the Trade-In Credit liability; record the component cost basis.** Ownership transfers; **no inventory yet** |
| **Trade-In** | **Cost allocation completed** | **Inventory** | **Create the approved components as stock, each with its allocated acquisition cost** |
| **Trade-In** | **Component classification blocked** | **Notification** | **Action Queue item with an owner.** Internal only — **no customer notification** |
| **Trade-In** | **Property unclaimed** | **Notification** | **Staff follow-up reminder, configurable.** No disposal authority created |
| **Trade-In** | **Courier return required** | **Delivery** | **Start the normal courier-return process**, shipment linked to the case. **`CUSTOMER_PICKUP` produces nothing** |
| **Accounting** | **Trade-In Credit applied** | **Payment, Reporting** | **Payment determines Remaining Amount Payable and coordinates clearing at dispatch; outstanding credit stays reportable as a standing liability** |
| **Build** | **Build completed** | **Inventory, Warehouse** | **Create the finished unit** — **build-to-order: allocated to its Order, never general stock, hand to packing; build-to-stock: available sellable inventory** |
| Any module | Terminal state reached | Order | Evaluate closure eligibility |

---

# 17. Ordering & Delivery Guarantees

| Guarantee | Rule |
|---|---|
| **Delivery** | At-least-once; subscribers idempotent (`SYS-051`) |
| **Ordering** | Guaranteed **within a single subject only** (`SYS-052`) |
| **Isolation** | Subscriber failure never blocks the publisher (`SYS-054`) |
| **Retention** | Events retained as history, not discarded after delivery (`SYS-053`) |
| **Correction** | Never republish; publish a superseding event (`EVA-012`) |

**On ordering.** Two events about *the same order* have a defined order. Two events about *different orders* do not. Global ordering across a business this size creates a bottleneck for no business benefit; per-subject ordering is achievable and sufficient.

**On isolation.** If Notification cannot send, the order still dispatches. If Reporting is unavailable, the warehouse still picks. Failure produces a retry and, unresolved, an exception — never a stalled business process.

> **EVA-017 — Out-of-sequence external events are recorded as exceptions rather than forced.** Carrier and marketplace feeds are not always ordered or correct (`OM §9.7`). An event whose transition is illegal for the current state is retained as evidence and raised for resolution.

---

# 18. Unknowns

| # | Unknown | Affects | Recorded as |
|---|---|---|---|
| EVU-1 | **Trigger mode for release, closure, reconciliation, and RTO creation** | EVT-005, EVT-014, EVT-057, EVT-063 | `GAP-019` |
| EVU-2 | **Reconciliation cycles** — none defined for the eight required reconciliations | EVT-083, EVT-084 | `GAP-062` |
| EVU-3 | **Exception type vocabulary** | EVT-077–079 | `GAP-060` |
| EVU-4 | **Notification triggers, channels, templates, suppression** | All events with notification obligations | `GAP-012` |
| EVU-5 | **Canonical courier event vocabulary** | EVT-034 | `GAP-056` |
| EVU-6 | **Revenue recognition trigger** — which event recognises revenue | EVT-012, EVT-013, EVT-052, EVT-056 | `GAP-002` |
| EVU-7 | **COGS recognition timing** | EVT-041 | `GAP-002` |
| EVU-8 | **Stuck-shipment threshold** for `Shipment.Lost` | EVT-037 | `GAP-048` |
| EVU-9 | **QC process definition** | EVT-067, EVT-068 | `GAP-045` |
| EVU-10 | **Hold effect on reservations** | EVT-010, EVT-011 | `GAP-018` |
| EVU-11 | **Event payload content** — `SYS-050` requires "sufficient content"; per-event specification is an engineering deliverable derived from this register | All | — |
| EVU-12 | **State ageing thresholds** — no state has a documented time expectation | All | `GAP-024` |
| ~~**EVU-13**~~ | ~~Events for `SM-12` – `SM-20`~~ | — | ✅ **CLOSED 2026-08-09.** Narrowed five times from **seven** machines to zero: `SM-13`/`SM-15` (§31, §20), `SM-18`/`SM-19` (§32, §21), `SM-12` (§33, §23) **by discovery**; **`SM-14`, `SM-16` and `SM-20` by proof that none requires an event** (`EVA-028`, `EVA-030`, `EVA-031`) |
| ~~**EVU-14**~~ | ~~`SM-12` Build Job progression~~ | `SM-12` | ✅ **CLOSED 2026-08-09.** **`EVT-102`** registered from §33 (`BD-434`); **QC, shortage, rework and consumption confirmed as publishing nothing** (`EVA-027`); **the `BR-054`/`PRD-045` ratification defect discharged** by `BR-143`/`BR-144`. §23 |
| **EVU-15** | **Inventory stock creation from allocated Trade-In components** — producer and occurrence are established, **but no module has a confirmed reaction**, so no event is registered | Inventory, `SM-19` | §21.1, `EVA-025` |
| ~~**EVU-16**~~ | ~~Trade-In Credit application — which module publishes it~~ | — | ✅ **CLOSED 2026-08-09 by architecture decision.** **Accounting publishes** (`EVT-101`) because it owns `E-083`; **Payment orchestrates by explicit request** (`SYS-006`, `SYS-032`), which is **not an event** (`EVA-002`). §22 |

> **EVA-018 — An entry here is an open question, not a decision.** No implementation may resolve one by choosing an answer in code (`DOC-003`, `DOC-024`).

---

# 19. Machine Coverage — `SM-1` – `SM-20`

**Added 2026-08-09.** `STATE_MACHINE_ARCHITECTURE.md` specifies **twenty** machines. This register was written when eleven existed. **This section states, machine by machine, whether an event is registered for it — including where the honest answer is *no*.**

## 19.1 The test applied

> **EVA-019 — A state transition is not evidence that an event exists.** An event enters this register only on canonical evidence that the **event itself** is a business or system fact: a ratified `EVT-` entry, a ratified module rule requiring publication or consumption, a confirmed discovery answer describing it, a ratified integration rule requiring an inbound external event, or **an existing canonical event elsewhere that merely needs registration here**.
>
> **Where the architecture confirms a transition but never states that anything is published, the transition stands and no event is written** (`EVA-001`, `DOC-024`, `DM-001`). **Cataloguing pressure is not evidence.** A register that invents an event to look complete is worse than one that records the hole.

## 19.2 Coverage

| Machine | Owning module | Authority | Event coverage |
|---|---|---|---|
| `SM-1` – `SM-11` | Order Management · Warehouse · Delivery · Payment · Inventory · Return & Exchange | Mixed | ✅ **Covered** — `EVT-001` – `EVT-072` |
| **`SM-12`** Build Job | Warehouse | Internal | ✅ **Covered — `EVT-102 Build.Completed`** (§23), plus `Product.AsBuiltRecorded`, `SubstitutionApplied` and `BuildTemplateVersionActivated` at **`EVT-088`**, and `EVT-039` for reservation. **Build QC, shortage, rework and component consumption deliberately publish nothing** (`EVA-027`, §23.2) |
| **`SM-13`** Warranty Claim | Warranty & Repair | Internal | ✅ **Covered — `EVT-089` – `EVT-095`** (§20). Seven events from `BD-426` – `BD-429`; **the remaining transitions publish nothing, by test** (`EVA-021`, `EVA-022`) |
| **`SM-14`** Marketplace Claim | Order Management | **External from `SUBMITTED`** (`SMA-036`) | ✅ **No event required — determined, not merely absent** (`EVA-028`, §19.4a). Every occurrence tested; **no module reacts.** Submission is **manual in Seller Center**; post-submission states are **mirrored**; **`BR-131` makes the result change nothing automatically**; ageing is **positively foreclosed** (`SMA-037`) |
| **`SM-15`** Repair | Warranty & Repair | **Mixed** | ✅ **Covered — shares `EVT-089`, `EVT-090`, `EVT-095`** (§20); its *inventory* effect remains **`EVT-041 Inventory.Deducted`** (`IVN-028`). **Repair QC deliberately publishes nothing** (`SMA-045`, `EVA-022`) |
| **`SM-16`** Conversation | Chat | **Mixed** — reopening is customer-driven | ✅ **No event required — determined, not merely absent** (`EVA-030`, §19.4c). Every occurrence is **internal to Chat**, **forbidden by `CHT-009`** (no Message entity), or a **derived overlay displayed by its own owner**. ⚠ **The overlays are refused for want of a consumer, not a threshold** — `SM-16` has the architecture's only real one |
| **`SM-17`** Permission Override | Permission | Internal — administrator only | ✅ **Covered.** **`Permission.OverridePerformed`**, with `EscalationRequested`/`Approved`/`Rejected`, registered at **`EVT-085`** by delegation to `PERMISSION_ARCHITECTURE.md` §13 |
| **`SM-18`** Trade-In Case | Trade-In | **Mixed** — `UNCLAIMED_PROPERTY` is customer-blocked | ✅ **Covered — `EVT-096`, `EVT-097`, `EVT-099`, `EVT-100`** (§21). **All other transitions publish nothing, by test** (`EVA-024`, `EVA-026`) |
| **`SM-19`** Trade-In Component | Trade-In | Internal | ✅ **Covered — `EVT-098`**, and its outcome gates `EVT-097` (§21). ⚠ **Its *inventory* effect still has no event of its own** — `EVU-15`, §21.1 |
| **`SM-20`** Fund Transfer | Accounting | **Mixed** | ✅ **No event required — determined, not merely absent** (`EVA-031`, §19.4d). **`ACC-026`/`SYS-105`: a transfer changes no balance outside the Financial Accounts the business controls.** Wholly Accounting's (`DOC-056`); **Payment observes only**, `ICO-034` states an explicit non-reaction, and Notification carries no entry |

## 19.3 What this means, stated plainly

> **EVA-020 — Every machine's event position is now settled. `SM-1` – `SM-20` are resolved, and the register no longer carries an uncovered machine.**
>
> ✅ **Closed 2026-08-09.** The list began at **seven** uncovered machines and reached zero by **two different routes, which this register keeps distinct**:
>
> | Outcome | Machines | How |
> |---|---|---|
> | **Covered by discovery** | `SM-12`, `SM-13`, `SM-15`, `SM-18`, `SM-19` | §31, §32, §33 supplied the cross-module reactions, and §20, §21, §23 registered the events they justify |
> | **Proven to require none** | **`SM-14`, `SM-16`, `SM-20`** | `EVA-028`, `EVA-030`, `EVA-031` — every occurrence tested, **no consumer found** |
>
> **The rule's method is unchanged and is what produced both outcomes**: an event enters this register on evidence, and **the way out of the uncovered list was never cataloguing pressure.**
>
> ✅ **`SM-16` left this list on 2026-08-09, by the same route as `SM-14` and not the same as the rest.** `SM-13`/`SM-15`, `SM-18`/`SM-19` and `SM-12` left because **discovery supplied their reactions**. **`SM-14` and `SM-16` left because each was proven to need none** — `EVA-028` and `EVA-030`. **Three outcomes, and this register keeps them distinct: covered by discovery, proven unnecessary, and still unknown.**
>
> ✅ **`SM-14` left this list on 2026-08-09 by a different route from the others.** `SM-13`/`SM-15`, `SM-18`/`SM-19` and `SM-12` left because **discovery supplied their reactions**. **`SM-14` left because it was proven to need none** — `EVA-028`. **The two outcomes are not the same, and this register distinguishes them.**
>
> ✅ **Amended twice on 2026-08-09 — originally seven, then five, now three.** `SM-13` and `SM-15` were removed by `BUSINESS_DISCOVERY.md` §31 (`BD-426` – `BD-429`) and §20; **`SM-18` and `SM-19` by §32 (`BD-430` – `BD-432`) and §21.** **Both removals were by discovery, not by assumption.** **The rule's method is unchanged** — the way out of this list is confirmed business behaviour, never cataloguing pressure.
>
> **The corpus was searched for every form of evidence `EVA-019` admits**: no `<Domain>.<Verb>` name exists for Build-job progression, Warranty, Repair, Conversation, Trade-In, Marketplace Claim or Fund Transfer; no module rule requires publication; no discovery answer describes an event. **`BD-385` forecloses the tempting inference** — Business Event → Action Queue Item is *zero, one, or many*, so **the Action Queue work that `SMA-072` and `SMA-073` require is not evidence that an event was published.**
>
> ⚠ **Specifying those events is an authoring act for the architect, not a propagation act for this register.** It needs the producer, the occurrence point, the consumers and the reaction of each — **none of which is derivable from a state diagram** (`SYS-050` requires an event to carry enough for a subscriber to act). **This is recorded as an open obligation, not discharged.**

## 19.4 The deferral that expired

The documentation index deferred this work with a stated condition: *"Events follow the machines. **Deferred until `SMA-018` (Warranty Claim) is specified**."*

> **`SMA-018` is specified** — `SMA §21.1` closed it. **The condition has been met, so the deferral no longer holds**, and the work is due. **Meeting the condition did not create the events**; it removed the reason for postponing their specification.

## 19.4a `SM-14` Marketplace Claim requires no event, and that is a determination rather than a gap

> **EVA-028 — `SM-14` Marketplace Claim publishes nothing, and every one of its occurrences was tested against `EVA-019` and found to have no cross-module consumer.** **This is a positive result, not an absence of evidence.**

| Occurrence | Why no event |
|---|---|
| **`PREPARING`** | Internal. Trioloo decides whether a claim is worth raising (`BR-132`) — no consumer |
| **Submission** | **Claims are raised manually in the Daraz Seller Center** (`BD-324`). **It is not a system action at all** — not an event, and not even an adapter request |
| **`SUBMITTED`, `UNDER_REVIEW`** | **Externally decided and mirrored, never locally owned** (`SMA-036`, `INV-69.2`). **Trioloo raises and records; the marketplace decides** |
| **`APPROVED`** | *The compensation amount is **recorded** in the ERP* (`BD-324`). **Recording is not a cross-module reaction**, and ⚠ **what the amount means financially is `GAP-084`, open** |
| **`REJECTED`** | **`BR-131`, `SMA-038`, `INV-69.3` — a claim result changes nothing automatically.** Absorbing the loss is a **separate authorised decision** routing to write-off (`BD-110`) or scrap (`BD-291`) |
| **`WITHDRAWN`** | Internal abandonment before submission — no consumer |
| **Ageing or escalation** | **Positively foreclosed.** `INV-69.4` and `SMA-037` — the duration *cannot be predicted by the business* (`BD-324`). **`SMA-037` records this as the first machine where the absence of a threshold is a stated business fact rather than a gap**, so it does **not** belong under `GAP-024` |

**Consumers were tested individually and none reacts:** Payment (`PAY-041` observes only), Accounting (no claim posting exists; `GAP-084` open), Order Management (`BR-131` — nothing automatic), Inventory (`INV-69.3`), Delivery, Customer, Reporting (`GAP-081`/`GAP-084` affect **classification**, not an event contract), and **Notification — which has no claim entry in §11.1 or in its ageing overlays.**

> **The earlier negative findings were re-tested against the whole corpus and all three hold** — `SMA-038`, `INV-69.3` and the mirrored post-submission states. **`BR-131` states the same rule independently in `OM §9.11`**, so four ratified sources agree.

> ⚠ **`REJECTED` must not generate a compensating inventory or accounting action merely because rejection sounds financially important.** Three rules forbid it, and the business gave the reason: **the claim result is a fact; the accounting response is a decision.**

## 19.4b The `SM-14` ↔ `SM-6` boundary, and why it needs no new event

> **EVA-029 — An approved claim creates no confirmed financial fact. Money arriving does, and existing events already carry it.**
>
> **No canonical rule makes an approved claim a receivable, a recoverable, or a settlement component.** `BR-131` says the result changes nothing automatically, and **`GAP-084` records that even the *classification* of the compensation — recovery of a loss, or other income — is unresolved.** **Approval is emphatically not receipt.**
>
> ⚠ **By which route the compensation physically arrives is stated by no source.** **Either route is already served**: arriving inside a settlement report, **`EVT-056 Payment.SettlementReceived`** and `SM-6`'s line-by-line reconciliation carry it; arriving separately, **`EVT-054 Payment.CashReceived`** does. **The event surface is therefore complete under either answer**, which is why no gap is opened here — **but `OM §11.6`'s seven deduction categories are all *outbound*, and an inbound compensation has no category among them.** Recorded as an observation, paired with `GAP-084`, **and not resolved.**
>
> **`SM-14` and `SM-6` do not overlap in authority.** `SM-14` is the lifecycle of **one claim**; `SM-6` is a **batch settlement covering many orders**. **Neither posts on the other's behalf** (`SYS-015`).

## 19.4c `SM-16` Conversation requires no event, and the reason is different again

> **EVA-030 — `SM-16` Conversation publishes nothing. Every occurrence is either internal to Chat, forbidden by `CHT-009`, or a derived overlay displayed by its own owner.**

| Occurrence | Why no event |
|---|---|
| **`NEW` — a conversation begins** | It lands in **Chat's own shared inbox** (`CHT-029`). **Staff pull work from it; nothing outside Chat reacts** |
| **`ASSIGNED` — first staff reply** | **Assignment is automatic on the first reply and there is no claim step** (`CHT-022`). Internal |
| **`IN_PROGRESS` ⇄ `WAITING_FOR_CUSTOMER` ⇄ `WAITING_FOR_BUSINESS`** | **The cycle is the machine's nature** (`SMA-058`) — a back-and-forth, traversed many times. **No consumer** |
| **`RESOLVED` · `CLOSED`** | **Closure is a human act recording `Closed By` and `Closed Date`** (`CHT-045`). No module reacts |
| **Reopening** | **Automatic and mechanical** — a customer message reopens the conversation and history stays continuous (`SMA-059`, `CHT-041`). Internal |
| **A message sent or received** | 🔴 **`CHT-009` — message-level structure is not modelled in the ratified set.** A message event would **introduce the very structure the architecture declines to define** (`DOC-024`, `DM-001`). **Forbidden, not merely unjustified** |
| **Linkage to a business record** | **`CHT-035` — links may be made at any stage**, which is why `SMA-060` keeps linkage orthogonal to the lifecycle. **A link is not an event**, and no linked record has a confirmed reaction |
| **Internal notes** | **`CHT-053` — notes do not change the conversation lifecycle** and are staff-only (`CHT-052`) |
| **Attachments** | Channel capability (`CHT-056` – `CHT-060`); **the channel enforces its own limits regardless** |
| **`Overdue` · `Inactive`** | **Derived overlays, not states** (`SMA-061`, `CHT-046`) — see below |

**Every candidate consumer was tested and none reacts.** **Customer references conversations and owns none of them** (`CUS-066`); Order Management links to them but states no reaction, and **verification phone contact is explicitly not chat** (`CHT-061`); Notification is a **different concept entirely** (`CHT-006`, `CHT-066`, `NOT-001`); API owns transport, not business facts.

> ## The overlays are refused for a different reason than the warranty delay was
>
> **`SM-16` has the only real ageing threshold in the architecture** — **10 minutes, configurable** (`CHT-047`, `BD-364`), which `SMA-063` records as `GAP-024`'s worked example. **So unlike the warranty delay event, the occurrence here IS determinable.**
>
> **The event is refused for want of a consumer, not for want of a threshold.** `CHT-049` states the whole reaction: conversations exceeding the SLA are **marked `Overdue` and highlighted in the inbox and dashboards**, and are **never automatically closed or escalated**. **The inbox is Chat's own** (`CHT-029`); the flag is **derived from `Last Customer Reply` and the configured period** (`CHT-048`, `CHT-051`). **A condition becoming true and being displayed by its owner is not a published fact.** `CHT-050` says the same of `Inactive`.
>
> ⚠ **Neither is Action Queue work.** `NOT §11.1` registers eight confirmed Action Queue instances and **no conversation appears among them** — unlike a repair awaiting parts or an advance exchange past its period. **`SMA-062` is why: an ageing threshold produces visibility, never action.**

> ## An asymmetry recorded, not corrected
>
> **`NOT §11.1` lists *an advance exchange past its configured period* as Action Queue work, and `SM-9` publishes no event for it** — while the equivalent Trade-In and Warranty work items do (`EVT-090`, `EVT-098`, `EVT-099`). **`SM-9`'s events were ratified before the Action Queue concept existed** (`BD-382`, §25).
>
> **This is not a contradiction** — **`BD-385` makes Business Event → Action Queue Item *zero, one or many***, so an Action Queue item never implies an event. **Recorded because the asymmetry is real and someone will notice it**; `SM-9` is outside this task and its events are ratified.

## 19.4d `SM-20` Fund Transfer requires no event, because nothing outside Accounting changes

> **EVA-031 — `SM-20` Fund Transfer publishes nothing. `ACC-026` and `SYS-105` state the reason directly: a Fund Transfer *moves value between Financial Accounts the business controls and changes no balance outside them*.**

**Fund Transfer is wholly Accounting's.** `DOC-056` assigned it there — **`E-084`, `E-085`, `SM-20`, Transfer Type classification and transfer-fee independence** — and it was **not previously registered to any document**. `PAYMENT_ARCHITECTURE.md` records `SM-20` as **observed, owned by Accounting**.

| Occurrence | Why no event |
|---|---|
| **`REQUESTED`** | **Nothing is posted** (`SMA-074`) — *recorded, not gone yet*. No consumer |
| **`IN_TRANSIT`** | The **source leg** posts: `Source − X`, `Funds In Transit + X`. **Both accounts are Accounting's own** |
| **`COMPLETED`** | The **destination leg** posts. **Internal to the ledger that owns both sides** |
| **`FAILED`** | **A third movement, never an undo** (`SMA-075`) — the money left and came back, and the trail shows it |
| **`CANCELLED`** | **Nothing posted** — *we didn't do it* |
| **`Reversed`** | **Not a state** (`SMA-076`, `ACC-031`) — an **overlay plus a new linked compensating transaction** |
| **The fee** | **Needs no lifecycle** (`SMA-078`) — a charge and possibly a credit back, **two postings**, its state derived from them (`DB-001`) |

**Every candidate consumer was tested and none reacts:** **Payment observes only** (`SM-20` is listed there as owned by Accounting); **Inventory Costing states an explicit non-reaction** — **`ICO-034`: Fund Transfers do not affect inventory cost and transfer fees are never capitalised**; Inventory has no interest; **Notification has no fund-transfer entry** in `§11.1` or its ageing overlays; Reporting **reads** the *Cash & Bank Balance* figure, and **reading a derived balance is not reacting to an event**; Audit is universal and distinguishes nothing.

> **This is the cleanest of the three proven negatives.** `SM-14` publishes nothing because the material facts belong to Daraz; `SM-16` because they belong to Chat; **`SM-20` because a ratified rule states outright that no balance outside Accounting changes.** **There is no cross-module surface to have an event on.**

> ⚠ **Idempotency was examined and the model is sound.** `SMA-074`'s two-movement structure — **source leg on entering `IN_TRANSIT`, destination leg on reaching `COMPLETED`** — posts each leg **once**, and `SMA-075` makes failure a **third movement rather than an undo**, so `DB-002`, `DB-003` and `DB-077` are satisfied by construction. **One presentational risk was found and corrected in the owning document**: `SM-20`'s posting column reads *cumulatively*, and an incremental reading would have double-posted the source leg. **No rule changed.**

## 19.4e `SM-21` Advance Requisition requires no event — the fourth proven negative

> **EVA-032 — `SM-21` Advance Requisition publishes nothing. Every occurrence is internal to Accounting and Payment, and the one cross-module reaction belongs to a module that does not yet exist** (`BD-448` – `BD-457`, `EVA-019`).

| Occurrence | Why no event |
|---|---|
| **Requested · authorised · rejected · cancelled** | **Nothing financial happens** (`BD-451`, `ACC-003`). **No module reacts to an authorisation** |
| **Disbursement** | **Payment records the transaction and Accounting posts it** — both inside the boundary that owns the capability (`ACC-060`, `PAY-087`). **A request to Payment is an explicit request, not an event** (`EVA-002`, `SYS-006`) |
| **Accepted expense settlement** | **Accounting decides and Accounting posts** (`ACC-066`, `ACC-077`). Internal |
| **Write-off settlement** | **Accounting decides and Accounting posts** (`ACC-067`). Internal |
| **Authority closed · completion** | **Closure posts nothing** (`BD-454`); **completion is a derived condition, not an occurrence** (`ACC-070`, `SMA-084`) |
| **Salary recovery** | ⚠ **The only genuine cross-module reaction — and its counterparty is HR & Payroll, which `SYS-093` defers past V1.** **No consumer exists to publish to** |

> ✅ **This is the fourth proven negative, and it is proven the same way as the other three.** `SM-14` publishes nothing because the material facts belong to Daraz; `SM-16` because they belong to Chat; `SM-20` because no balance outside Accounting changes; **`SM-21` because the capability is Accounting's own and the single external reaction has no module to react in.**

> ⚠ **`BD-450`'s reconciliation obligation is carried, not implemented.** *The payroll deduction and the Advance settlement allocations must reconcile to the same figure.* **Whether that contract is an event or an explicit request is HR & Payroll's to determine when it exists** — **and `EVA-019` forbids registering one now on the strength of an anticipated consumer.**

## 19.5 What `SMA-011` required, and its status

`SMA-011` required amending `OM §18.2`, `OM §18.3`, `DOMAIN_MODEL.md` §17 and **`EVENT_ARCHITECTURE.md` §16** to adopt `SM-3`, `SM-6`, `SM-10` and `SM-11`.

> ✅ **Satisfied for those four, and no §16 amendment was needed.** §16 is keyed by **module**, not by machine, and every affected coupling already appears under its owning module. **Re-attributing a row between two machines of the same module leaves a module-keyed matrix unchanged** — recorded at `OM §18.3` on 2026-08-09. **`SMA-011` is fully discharged and is not what §19.3 records.**

---

# 20. Warranty & Repair Events

**Added 2026-08-09** from `BUSINESS_DISCOVERY.md` §31 (`BD-426` – `BD-429`), the first discovery conducted specifically to establish cross-module reactions. **Numbered §20 so that no existing section is renumbered** (`DOC-009`); the event catalogues are therefore §5 – §15 and §20.

> **EVA-021 — Seven events are registered for `SM-13` and `SM-15`, and the remaining transitions of both machines publish nothing.** Each of the seven exists because **a confirmed occurrence has a confirmed reaction in another module** — not because a state changed. **`SM-13` has ten states and `SM-15` thirteen; twenty-three transitions produce seven events**, and that ratio is the point (`EVA-019`).

**Domain name.** These events use the single domain **`Warranty`**, covering the Warranty & Repair module and both its entities. `BD-428` and `BD-429` describe *"the Warranty/Repair Case"* as one thing throughout, and **splitting the domain would manufacture a distinction the business does not make**. It does not merge the machines: `SM-13` and `SM-15` remain independent (`SMA-044`) and their shared state names remain machine-qualified (`SMA-047`).

---

## EVT-089 · `Warranty.UnitReceived`

**Internal · Manual** — **Source** Warranty & Repair → **Targets** Notification, Audit

| | |
|---|---|
| Description | A customer's unit has physically been received and a warranty or repair case is created or accepted. **This establishes that Trioloo has custody** |
| Trigger | `SM-13` `RECEIVED` or `SM-15` `RECEIVED` — whichever case is the entry point for that unit |
| Preconditions | The unit is physically present; a case exists |
| State changes | The **custody overlay** applies, carried by the case (`WHS-069`, `WAR-060`) |
| Data affected | `E-071` or `E-072`; intake channel (`WAR-014`) |
| Business rules | **`BD-428` ¶1 — the customer receives confirmation that the product is now with Trioloo** · `WAR-059` the unit is **never inventory** (`IVN-033`, `SYS-103`) · `WAR-013` goods-first intake may arrive with no prior contact |
| Notifications | **Required — to the customer.** Custody confirmation |
| Audit | Receipt and custody recorded |

> **Inventory is a deliberate non-consumer.** `IVN-033` and `SYS-103` make customer property **never** inventory, and `ICO-006` reinforces it: an item with no acquisition cost cannot enter stock. **The absence of an Inventory reaction is specified, not overlooked.**

> **Warehouse is not a consumer either.** Warehouse's physical holding is what *causes* this event; it is not a reaction to it (`WHS-069`).

---

## EVT-090 · `Warranty.CustomerDecisionRequired`

**Internal · Automatic** — **Source** Warranty & Repair → **Targets** Notification, Audit

| | |
|---|---|
| Description | The case cannot continue without the customer's decision or approval |
| Trigger | `SM-13` `AWAITING_CUSTOMER_APPROVAL` or `SM-15` `AWAITING_APPROVAL` |
| Preconditions | A decision genuinely blocks progress — a chargeable repair, a material change in the proposed resolution, or another case-specific decision requiring consent |
| State changes | The case waits |
| Data affected | `E-071` or `E-072`; the decision sought |
| Business rules | **`BD-428` ¶3 — the customer must be contacted, the case must remain waiting, and staff must not treat silence as approval** · `SMA-046` this is a wait on the customer — **chase, not control** |
| Notifications | **Required — to the customer** |
| Audit | The wait and its resolution recorded |

> **`Integration.ManualRequired` (`EVT-082`) is the naming precedent** for a `<Domain>.<Condition>Required` fact. This is a fact about the case, not a command to anyone (`EVA-002`).

> **Silence is never approval is a constraint on Warranty, not a consumer reaction.** No timer advances this event, and no threshold is defined for it.

---

## EVT-091 · `Warranty.ReplacementAuthorised`

**Internal · Manual** — **Source** Warranty & Repair → **Targets** Inventory, Warehouse, Audit

| | |
|---|---|
| Description | A warranty case is authorised or confirmed as resolved by **Replacement** |
| Trigger | `SM-13` resolution branch at `INSPECTION` decided as *Replaced* (`SMA-041`) |
| Preconditions | Warranty eligibility determined; the resolution decision made by an authorised representative (`WAR-028`) |
| State changes | **None in Inventory yet** |
| Data affected | `E-071`; the replacement unit's identity where one exists |
| Business rules | **`BD-426` — the replacement comes from normal available sellable stock; there is no separate warranty-replacement pool** · **the unit is reserved first so it cannot be allocated to another sales order** · **the decision does not deduct inventory** · **no new sale and no new sales revenue** · **serial/IMEI traceability to the case and the original customer/order where identity exists** |
| Notifications | None required by this event — the customer is informed by `EVT-094` |
| Audit | Authorisation, actor and the replacement unit recorded |

**Consumer reactions, exactly as confirmed:**

| Consumer | Reaction | Then publishes |
|---|---|---|
| **Inventory** | **Reserve the replacement unit from available sellable stock** so it cannot be allocated to another sales order | **`EVT-039 Inventory.Reserved`** — Inventory's own authoritative fact |
| **Warehouse** | Follow the applicable controlled process for picking, required QC/verification, and handover or dispatch | Its own facts |

> **The reservation is `EVT-039` reused, not duplicated.** `EVT-039`'s trigger was *order released*; a warranty replacement is a **second trigger for the same event**, exactly as `RET-025` reserves at exchange approval. **Inventory remains the authority for its own stock fact** (`SYS-015`).

> ✅ **Stock unavailable needs no new machinery.** `SYS-032` already states that **Inventory may refuse a reservation and that refusal is a normal outcome.** `BD-426`'s *"no imaginary or negative replacement stock; the replacement remains pending"* is that rule, reached independently.
>
> ⚠ **What is still missing is the representation of the wait.** `SM-13` has no state for an authorised replacement pending stock, and **replacement procurement is not one of `BD-293`'s five purchase triggers.** **Neither is invented here** — no state, no trigger, no procurement event. Carried at §20.1.

> ⚠ **No Accounting consumer.** `BD-426` states the negative — no new sale, no new sales revenue — and **no `ACC-` rule states what a warranty replacement posts.** The event therefore has no Accounting consumer (`§9` safety rule).

---

## EVT-092 · `Warranty.SupplierClaimSubmitted`

**Internal · Manual** — **Source** Warranty & Repair → **Targets** Procurement, Audit

| | |
|---|---|
| Description | A warranty claim is submitted upstream to a supplier or manufacturer |
| Trigger | The responsible person submits the claim according to that party's warranty policy (`WAR-050`) |
| Preconditions | Warranty responsibility determined from the product's Warranty Package (`WAR-048`, `E-070`) |
| State changes | The claim becomes pending on the case |
| Data affected | `E-071` — supplier or manufacturer, claim details, date, current status (`WAR-051`) |
| Business rules | **`BD-427` — submission itself creates no payment, accounting posting, stock movement or inventory adjustment** · **`BD-427` — Procurement/Supplier records must make the claim visible against the relevant supplier** · `BD-097` three upstream tiers |
| Notifications | None confirmed |
| Audit | Submission, destination and actor recorded |

**Consumer reaction, exactly as confirmed:**

| Consumer | Reaction |
|---|---|
| **Procurement** | **Make the claim visible against the relevant supplier, so that supplier's warranty/claim history accumulates** |

> **This is the only cross-module reaction submission produces, and it is visibility rather than money.** `BD-427` states the negatives explicitly: no payment, no posting, no stock movement, no inventory adjustment. **Accounting and Inventory are deliberate non-consumers.**

> **No existing Procurement event represents it.** `EVT-049` – `EVT-051` cover purchase-order approval, goods receipt and cost finalisation — **none is a claim against a supplier.** A new event is therefore required rather than a reuse.

---

## EVT-093 · `Warranty.SupplierClaimOutcomeRecorded`

**External · Manual** — **Source** Warranty & Repair *(recording an external decision)* → **Targets** Procurement, Audit

| | |
|---|---|
| Description | The supplier's or manufacturer's decision on a submitted claim is recorded against the case |
| Trigger | The upstream party responds, by phone, message or their own process (`BD-427`) |
| Authority | ⚠ **External — the supplier decides; Trioloo records.** The decision is not Trioloo's to make (`EVA-013`) |
| Preconditions | A claim was submitted (`EVT-092`) |
| Data affected | `E-071` — claim result, and on acceptance what the party actually provides or bears; on rejection the final cost responsibility (`WAR-051`, `WAR-052`) |
| Business rules | **`BD-427` — acceptance creates no assumed financial recovery** · **`BD-427` — rejection creates no automatic stock or accounting action** · **`BD-427` — actual recovery is a later, separate fact recorded by the module that owns it** · `INV-71.2` expected and actual cost responsibility are both retained |
| Notifications | None confirmed by this event |
| Audit | Outcome, date and final cost responsibility recorded |

**Consumer reaction, exactly as confirmed:**

| Consumer | Reaction |
|---|---|
| **Procurement** | **Update that supplier's warranty/claim history with the outcome** |

> 🔴 **This event is NOT a recovery.** `BD-427` states the prohibition directly: *"Do not treat claim submission, claim acceptance, and actual recovery as the same event."* **An accepted claim moves no money, no stock and no posting.**
>
> **When money, credit, replacement stock or parts actually arrive, the owning module records it and publishes its own fact** — `EVT-054 Payment.CashReceived`, `EVT-050 Procurement.GoodsReceived`, or the applicable Inventory event. **Warranty publishes none of those.**

> ⚠ **No Accounting consumer, and the reason is a stated gap.** `BD-290` classifies a supplier-borne cost as *a recoverable*, and **no `ACC-` rule states what a recoverable posts when it arrives.** `BD-427` removed the two earlier ambiguities — nothing posts at submission, nothing at acceptance — **but the arrival posting remains unstated and is not invented.**

---

## EVT-094 · `Warranty.ResolutionDecided`

**Internal · Manual** — **Source** Warranty & Repair → **Targets** Notification, Audit

| | |
|---|---|
| Description | The warranty outcome is materially decided — Repaired, Replaced, Rejected/not covered, Refund where applicable, or another confirmed final resolution |
| Trigger | The resolution branch at `SM-13` `INSPECTION` (`SMA-041`) |
| Preconditions | Eligibility determined; decision made by an authorised business representative (`WAR-028`, `BD-107`) |
| Data affected | `E-071` — the resolution **and its mandatory reason** (`INV-71.4`) |
| Business rules | **`BD-428` ¶6 — the customer must be informed of the outcome** · **`BD-428` ¶6 — where further action is still required, the case does not become complete merely because the customer was informed** · `SMA-043` refund is exceptional · `INV-71.4` the reason is mandatory |
| Notifications | **Required — to the customer** |
| Audit | Resolution, reason and authorising actor recorded (`AUD-042`) |

> **One event, not four.** Separate `Repaired` / `Replaced` / `Rejected` / `Refunded` events were tested and rejected: **no consumer reacts differently to the outcome value.** Notification informs the customer identically in every case, and **the outcome is data on the event, not a different event.**
>
> **Where an outcome does have its own distinct cross-module reaction, it already has its own fact**: *Replaced* publishes `EVT-091` because Inventory must reserve; *Repaired* delegates into `SM-15` (`SMA-044`).

> 🔴 **The refund outcome is carried, not enabled.** This event records that a refund was **decided**. **It does not execute one.** `PAY-049` holds that `SM-10` *"is never standalone; it attaches to a return or an exchange"*, and a warranty refund is neither — **an unresolved conflict between ratified documents, left exactly open** (`§20.1`). **No event routes around it.**

---

## EVT-095 · `Warranty.ReadyForHandback`

**Internal · Manual** — **Source** Warranty & Repair → **Targets** Notification, Delivery, Audit

| | |
|---|---|
| Description | The repaired or replacement unit is ready to be returned to or collected by the customer |
| Trigger | `SM-13` `READY_FOR_DELIVERY` or `SM-15` `READY_FOR_COLLECTION` |
| Preconditions | Repair QC passed where applicable (`SMA-045`); or the replacement unit picked and verified (`BD-426`) |
| Data affected | `E-071` or `E-072`; the handback method |
| Business rules | **`BD-428` ¶7 — the customer must be informed, and this notification is required BEFORE the case is treatable as ready for customer handover** · **`BD-429` — where handback requires transport it uses the normal Delivery/Courier process, and the case must remain linked to the shipment** · `SMA-013` the method determines whether a shipment exists at all |
| Notifications | **Required — to the customer.** Operational: the customer must now take or coordinate the next action |
| Audit | Readiness and the method recorded |

**Consumer reactions, exactly as confirmed:**

| Consumer | Reaction | Then publishes |
|---|---|---|
| **Notification** | Inform the customer that the unit is ready | Its own delivery records |
| **Delivery** | **Where handback requires transport** — create a courier shipment in the same controlled way as other direct-channel shipments, **linked to the case** | **`EVT-031 Shipment.Created`**, then its own lifecycle |

> ⚠ **The notification gates handover readiness — it is NOT a closure condition.** `BD-428` expressly declines to generalise `BD-352`'s return rule: *"Final case closure should continue to follow the applicable Warranty/Repair lifecycle and actual handover/resolution requirements rather than creating a new universal 'customer notified = closure' rule."* **Recorded exactly.**

> **Self-pickup produces no shipment and no second event.** `BD-429` confirms no courier shipment is created; the collection is recorded against the case. **`SMA-013`'s rule reappearing in a second domain.** No consumer has a confirmed reaction, so **no event is created for symmetry.**

> **Delivery owns everything after this point.** Booking, tracking, failure, return-to-origin and completion are `DELIVERY_ARCHITECTURE.md`'s, published as `EVT-031` – `EVT-038`. **Warranty publishes no shipment event and duplicates no part of that lifecycle.**

---

## 20.1 What Warranty & Repair consumes

**The module reacts to other modules' authoritative facts rather than republishing them** (`SYS-015`).

| Consumed | From | Warranty & Repair's reaction |
|---|---|---|
| **`EVT-039 Inventory.Reserved`** | Inventory | The replacement is committed; the case may proceed toward handback |
| **`EVT-041 Inventory.Deducted`** | Inventory | **The stock consequence of handover is Inventory's fact, not Warranty's.** Covers both a repair consuming components (`IVN-028`) and a replacement deducted at handover (`BD-426`) |
| **`EVT-035 Shipment.Delivered`** | Delivery | The handback completed |
| **`EVT-036 Shipment.DeliveryFailed`** | Delivery | ⚠ **Dispatch is not handover.** The case is **not** successfully handed back; if the parcel returns, **the unit returns to Trioloo's custody and the case remains unresolved for customer handback** (`BD-429`). Another attempt is arranged **rather than creating a new sale** |
| **`EVT-067` / `EVT-068 Return.QCPassed` / `QCFailed`** | Return & Exchange | A `Repair Required` disposition is one of `SM-15`'s four entry points (`RET-027`, `SMA-044` as amended) |

## 20.2 Transitions that deliberately publish nothing

> **EVA-022 — The following confirmed occurrences were each tested against `EVA-019` and produce no event.** Recording why is part of the register (`DOC-030`).

| Occurrence | Why no event |
|---|---|
| **Repair QC outcome** | `SMA-045` — it **gates progress and produces no branching disposition**. Pass returns the unit; fail returns it to `IN_PROGRESS`. **No cross-module consequence** |
| **A material diagnostic finding** | `BD-428` ¶2 requires contact on a *material* finding — **materiality is a judgement, not a determinable point** (`CP-8`). **Routine inspection progress explicitly requires no contact.** No deterministic occurrence, so no contract |
| **Customer payment required** | `BD-428` ¶4 confirms the requirement, but **`PAYMENT_ARCHITECTURE.md` carries no warranty content and no canonical reaction exists.** ⚠ **Recorded as a missing contract, not filled** — see §20.3 |
| **Significant external delay** | `BD-428` ¶5 confirms the requirement; **`GAP-087` leaves the threshold undefined and *"significant"* is a judgement.** **No deterministic occurrence point can be stated, so no event contract is possible.** No threshold is invented |
| **Replacement handed over / dispatched** | The stock fact is **`EVT-041 Inventory.Deducted`**, Inventory's own; the movement is `EVT-033`/`EVT-035`, Delivery's. **`BD-428` ¶8 confirms no further customer communication is needed.** No additional consumer |
| **Handback shipment created** | **`EVT-031 Shipment.Created`** is Delivery's authoritative fact. Warranty publishes `EVT-095`; **Delivery reacts and publishes its own event.** Ownership preserved |
| **Handback failed / returned** | **`EVT-036 Shipment.DeliveryFailed`** is Delivery's. **Warranty consumes it** (§20.1) and publishes nothing |
| **Self-pickup handback** | `BD-429` — no shipment exists and **no other module has a confirmed reaction.** No event for symmetry |
| **Final handover / completion** | `BD-428` ¶8 — **the customer needs no further communication merely because an internal status changed** |
| **Every other `SM-13` and `SM-15` transition** | Internal progression with no confirmed cross-module consequence |

## 20.3 Open dependencies carried, not solved

**None of these is resolved by an event, and no event routes around one** (`EVA-001`, `DOC-024`).

| # | Open item | Status |
|---|---|---|
| 1 | **Warranty-originated refund vs `PAY-049`** — `SM-10` *"is never standalone; it attaches to a return or an exchange"*, and a warranty refund is neither | 🔴 **Conflict between ratified documents. Untouched** |
| 2 | **`SM-13` has no state for an authorised replacement awaiting stock** | ⚠ Carried. **No state invented** |
| 3 | **Replacement procurement is not one of `BD-293`'s five purchase triggers** | ⚠ Carried, alongside `GAP-088`'s repair-parts trigger. **No trigger and no procurement event invented** |
| 4 | **Accounting posting when an upstream recovery actually arrives** | ⚠ `BD-427` removed the submission and acceptance ambiguities; **the arrival posting is stated by no `ACC-` rule** |
| 5 | **Accounting treatment of warranty replacement cost** | ⚠ `BD-426` gives the negative — no new sale, no new revenue. **What it does post is unstated** |
| 6 | **Accounting treatment of handback courier cost** | ⚠ `BD-429` — *"zero COD does not imply zero courier cost"*, and the bearer follows the case's cost-responsibility decision. **The posting is unstated** |
| 7 | **A canonical Payment contract for a chargeable-repair amount** | ⚠ `BD-428` ¶4 confirms the business requirement; **no `PAY-` rule exposes a mechanism.** `EVT-090` carries the *decision*, never the money |
| 8 | **`GAP-087`** — the overdue-warranty threshold | ⚠ Open. **Blocks a delay event, as §20.2 records** |
| 9 | **`REPAIR_REQUIRED` Trade-In component vs `SM-15`'s entry points** | ✅ **RESOLVED 2026-08-09** — registered as the **fourth** entry point (`SMA-044` as amended, `WAR-035`). **A stale enumeration, not a missing decision** |

## 20.4 Supplier and manufacturer warranty claims have no state machine

> **EVA-023 — The supplier/manufacturer warranty claim is not `SM-14`, and it has no machine of its own.**
>
> **`SM-14` is Marketplace Claim** — `E-069`, owned by Order Management, **externally authoritative from `SUBMITTED`** (`SMA-036`), and it concerns a dispute raised with a marketplace. **The word *claim* runs in three directions** (`WAR-009`, `BD-329`): a **warranty request** is customer → Trioloo, a **supplier claim** is Trioloo → supplier, and a **marketplace claim** is Trioloo → Daraz.
>
> **The upstream warranty claim is recorded as fields on `E-071`** — destination, result, expected cost bearer and final cost responsibility (`WAR-051`) — **with no lifecycle and no states.** `EVT-092` and `EVT-093` therefore attach to `SM-13`, **never to `SM-14`.**
>
> **This is recorded as a fact, not a defect. No machine is invented** (`DOC-024`).

---

# 21. Trade-In Events

**Added 2026-08-09** from `BUSINESS_DISCOVERY.md` §26 and §32 (`BD-430` – `BD-432`). **Numbered §21 so that no existing section is renumbered** (`DOC-009`); the event catalogues are §5 – §15, §20 and §21.

> **EVA-024 — Five events are registered for `SM-18` and `SM-19`, and every other transition of both machines publishes nothing.** `SM-18` has fourteen states and `SM-19` seven; **their transitions produce five events.** Each exists because a **confirmed occurrence has a confirmed reaction in another module** (`EVA-019`).

**Domain name.** These events use the single domain **`TradeIn`**, covering the module and both its entities — the same choice made for `Warranty` at §20, and for the same reason: `BD-430` – `BD-432` describe the case and its components as one workflow. **It does not merge the machines**; `SM-18` and `SM-19` remain independent, and `SMA-071` still keeps component progress an overlay on the case.

---

## EVT-096 · `TradeIn.AgreementAccepted`

**Internal · Manual** — **Source** Trade-In → **Targets** Accounting, Audit

| | |
|---|---|
| Description | The customer and the business accept the final Trade-In agreement |
| Trigger | `SM-18` `AWAITING_CUSTOMER_DECISION` → `AGREEMENT_ACCEPTED` |
| Preconditions | Physical inspection complete; the final value fixed (`SMA-068` guard) |
| State changes | **Ownership transfers to the business** (`INV-81.1`, `TRD-024`). **No inventory is created** (`IVN-030`) |
| Data affected | `E-081`; the agreed value, fixed here and anchoring everything after it (`INV-81.3`, `ICO-011`) |
| Business rules | **`BD-392` — every accepted Trade-In creates Trade-In Credit** · `ACC-039` a payment source, never a discount · `ACC-040` a non-cash liability discharging only through a sale · **`SMA-067` credit and inventory are created at different moments** |
| Notifications | **None.** `BD-432` confirms no automatic customer notification at any Trade-In transition (`NOT-044`) |
| Audit | Acceptance, agreed value and authorising actor recorded |

**Consumer reaction, exactly as confirmed:**

| Consumer | Reaction |
|---|---|
| **Accounting** | **Create the Trade-In Credit liability** and record the component cost basis. `ACC §6`'s posting-trigger table already carries this row — *Trade-In accepted → Trade-In → credit liability and component cost basis* |

> 🔴 **Three moments must not collapse, and this event is only the second of them** (`TRD-002`): **physical handover changes nothing** — the item is still customer property in custody; **acceptance transfers ownership and creates credit**; **allocation completion creates inventory**, possibly days later (`EVT-097`).
>
> **`SMA-067` records why the gap is affordable**: the customer buys their new machine and leaves, while the components reach stock when the workshop finishes. **The costing discipline is paid for entirely by the business.**

> ⚠ **An observation recorded, not resolved.** `ACC §6`'s row attributes **both** the credit liability **and** the component cost basis to this trigger, and points both at `ACC §11.4` — **but §11.4 covers Trade-In Credit only.** **Component cost is `INVENTORY_COSTING_ARCHITECTURE.md` §4's** (`ICO-011` – `ICO-017`), and the **allocation** across components does not complete until later. **The pointer is corrected; whether the cost basis posts at acceptance or at allocation is a question for Accounting and is not answered here.**

---

## EVT-097 · `TradeIn.CostAllocationCompleted`

**Internal · Manual** — **Source** Trade-In → **Targets** Inventory, Audit

| | |
|---|---|
| Description | Every component has reached a final classification and the agreed value has been allocated across those that will become inventory |
| Trigger | `SM-18` `COST_ALLOCATION` → `COMPLETED` |
| Preconditions | **Both `SMA-068` guards passed** — every component finally classified with no `UNKNOWN` remaining, **and the allocation sums to the agreed value** (`CP-8`, arithmetic enforced) |
| State changes | **Components approved for inventory become eligible to be created as stock** — not before (`IVN-030`) |
| Data affected | `E-082` per component; the allocated acquisition cost of each (`ICO-014`, `ICO-015`) |
| Business rules | **`BD-391` — a partially classified Trade-In cannot create partial inventory** (`IVN-031`, `INV-82.2`) · **`IVN-032` scrap and recycle do not automatically become saleable inventory** · **`ICO-016` allocation is performed once and never retrospectively restated** · `INV-82.3` components that do not become inventory receive no cost |
| Notifications | **None** (`BD-432`, `NOT-044`) |
| Audit | Allocation results and actor recorded |

**Consumer reaction, exactly as confirmed:**

| Consumer | Reaction |
|---|---|
| **Inventory** | **Create the approved components as stock, each carrying its allocated acquisition cost.** Inventory remains the authority for the resulting stock fact (`IVN-030`, `SYS-015`) |

> ⚠ **Inventory publishes no event of its own for this, and one was deliberately not created — see §21.1.**

> **The three gates in order** (`SMA-068`, `IVN-030`, `BD-391`): `AGREEMENT_ACCEPTED` → **classification complete** → **allocation complete** → inventory. **This event is the third gate opening, not the stock movement itself.**

---

## EVT-098 · `TradeIn.ComponentClassificationBlocked`

**Internal · Automatic** — **Source** Trade-In → **Targets** Notification, Audit

| | |
|---|---|
| Description | A component remains `UNKNOWN` pending inspection, and the whole case cannot advance |
| Trigger | `SM-19` `UNKNOWN` persisting where `SM-18` is at `COMPONENT_CLASSIFICATION` |
| Preconditions | The agreement is accepted; at least one component is unclassified |
| State changes | **None.** The case is held at `COMPONENT_CLASSIFICATION` |
| Data affected | `E-082`; the case's classification progress |
| Business rules | **`SMA-073` — `UNKNOWN` blocks the whole case, and the business chose that deliberately**: *inventory immutability is more important than early inventory availability* (`BD-391`, `TRD-003`) · **`SMA-072` `REPAIR_REQUIRED` and `REFURBISHABLE` are work, not storage**, and generate Action Queue Items with an owner |
| Notifications | **Internal only.** ⚠ **No customer notification** — `BD-432` forbids inferring one (`NOT-044`, `NOT-045`) |
| Audit | The block and its resolution recorded |

**Consumer reaction, exactly as confirmed:**

| Consumer | Reaction |
|---|---|
| **Notification / Action Queue** | **Create an Action Queue Item with an owner** — *a component pending classification, blocking a Trade-In* is a confirmed instance (`NOT §11.1`, `NOT-045`, `BD-382`) |

> **This makes `UNKNOWN` expensive, which is healthy** (`SMA-073`). One unclassified component holds up an entire Trade-In, **so the incentive is to resolve it rather than leave it pending** — the fourth instance of the stall-plus-visibility pairing (`SMA-066`).

> **A `REPAIR_REQUIRED` classification is not routed by this event, and needs no event of its own.** `SMA-072` delegates such a component into `SM-15` Repair, and **it is now `SM-15`'s fourth registered entry point** (`SMA-044` as amended 2026-08-09, `WAR-035`).
>
> ✅ **The defect was a stale enumeration, not a missing decision** — `SMA-072` always stated the delegation; `SMA-044`'s three-entry list predated §25 in its own document. **`SM-15` is unchanged, and no event amended its authority.** **The handoff has no confirmed occurrence point**, and `SM-13`'s own delegation into `SM-15` publishes nothing either.

---

## EVT-099 · `TradeIn.PropertyUnclaimed`

**Internal · Manual** — **Source** Trade-In → **Targets** Notification, Audit

| | |
|---|---|
| Description | A declining customer has not collected or accepted return of their property, and the case enters `UNCLAIMED_PROPERTY` |
| Trigger | `SM-18` `RETURN_IN_PROGRESS` → `UNCLAIMED_PROPERTY` |
| Preconditions | The offer was declined and the item has not gone back |
| State changes | The case enters a state that is **legitimately open forever** (`SMA-069`) |
| Data affected | `E-081`; customer communication and collection attempts, which the ERP records (`BD-396`, `TRD-057`) |
| Business rules | **`BD-396` — the product remains customer property until ownership is legally transferred and never becomes business inventory** (`INV-81.4`, `SYS-103`, `TRD-056`) · **`SMA-069` all three exits require something outside the business's control** · `BD-381` the reminder is configurable |
| Notifications | **Internal only** — *the ERP **may** remind responsible staff to follow up* (`BD-396`). ⚠ **No customer notification** (`BD-432`) |
| Audit | Entry, communication attempts and final resolution recorded |

**Consumer reaction, exactly as confirmed:**

| Consumer | Reaction |
|---|---|
| **Notification / Action Queue** | **Unclaimed customer property requiring follow-up** is a confirmed Action Queue instance (`NOT §11.1`, `NOT-045`). **"May remind" — configurable, never mandatory** (`BD-381`) |

> **Why this event is determinable when the warranty delay event was not.** `GAP-087` blocked a significant-delay event because **no state existed and no threshold was given.** Here **`UNCLAIMED_PROPERTY` is a ratified state of `SM-18`** — entering it is a determinable fact regardless of what prompts it. **The absence of an elapsed-time threshold does not prevent the event; it only means no timer may produce it.** **No threshold is invented** (`BD-396`).

> 🔴 **No disposal, abandonment or legal-transfer authority is created.** `BD-396` leaves resolution to *applicable law and business policy*, and `GAP-105` records that valuation on legal transfer is undefined. **Both carried unchanged.**

---

## EVT-100 · `TradeIn.CourierReturnRequired`

**Internal · Manual** — **Source** Trade-In → **Targets** Delivery, Audit

| | |
|---|---|
| Description | The return method for a declined item has been determined as `COURIER_RETURN` |
| Trigger | **The return-method determination**, which `BD-430` requires to be made **separately from the decline** |
| Preconditions | The customer declined; the method is `COURIER_RETURN` |
| State changes | None in Trade-In. The item **remains customer property** (`TRD-079`) |
| Data affected | `E-081`; the return method and the recorded cost bearer (`TRD-053`, `TRD-080`) |
| Business rules | **`BD-430` — `DECLINED` must never be taken to imply that a courier shipment exists** (`TRD-077`, `DLV-125`) · **`TRD-079` return handling transfers no ownership and creates no inventory** · **`TRD-052` a custody-out movement, never a sales return** |
| Notifications | **None** (`BD-432`) |
| Audit | Method, cost bearer and business reason recorded |

**Consumer reaction, exactly as confirmed:**

| Consumer | Reaction | Then publishes |
|---|---|---|
| **Delivery** | **Start the normal courier-return process** and create a shipment linked to the case (`DLV-124`, `DLV-126`) | **`EVT-031` – `EVT-038`**, Delivery's own lifecycle |

> 🔴 **The event boundary is the method, not the decline.** This is the whole point of the event. **`SM-18`'s `RETURN_IN_PROGRESS` does not mean a parcel is moving** — for a `CUSTOMER_PICKUP` return nothing has been dispatched and nothing will be. **A `CUSTOMER_PICKUP` return publishes nothing** and creates no shipment (`TRD-076`, `DLV-124`).
>
> **Third instance of `SMA-013`** — the method determines whether a shipment exists at all: sales fulfilment, warranty handback, and now a declined trade-in.

> ⚠ **Who bears the return cost is recorded on the case and decided by people** (`TRD-053`, `TRD-080`). **Delivery adopts nothing and decides nothing**, and **the outcome set remains an open `DOC-050` conflict** — `BD-395` names four outcomes including a split, `BD-430` names two. **Neither is chosen here.**

> ⚠ **What happens if the courier return itself fails is stated by no source.** `BD-429` covered this for a warranty handback; **`BD-430` does not**, and **no reaction to `EVT-036 Shipment.DeliveryFailed` is asserted for Trade-In.** Carried at §21.2.

---

## 21.1 The Inventory stock-creation event was NOT created

> **EVA-025 — Trade-In component stock creation has a confirmed producer and a confirmed occurrence, but no confirmed consumer, and no event is registered for it.**

**What is established.** Inventory is the authority for the resulting stock fact (`IVN-030`); the occurrence is determinate — components approved for inventory become stock **only after allocation completes** (`BD-391`, `ICO-016`, `INV-82.2`); the cost each carries is its allocated share (`ICO-014`, `ICO-015`).

**What is missing.** **No module has a confirmed reaction to trade-in stock being created.** `ACC §6`'s posting-trigger table names **only** *Trade-In accepted* — **there is no posting trigger for trade-in inventory creation**, and no other document states a reaction.

**Existing events were each tested and none fits** (`EVA-019`):

| Event | Why not |
|---|---|
| `EVT-042` – `EVT-045` | **Returns-specific** — trigger is *return received; QC outcome*, states run through `Inventory:RETURNING` |
| `EVT-046` `Inventory.Adjusted` | Trigger is **count discrepancy, damage, loss or theft** — not a costed acquisition |
| `EVT-050` `Procurement.GoodsReceived` | **Requires an open purchase order.** A trade-in has none |
| `EVT-039` / `EVT-041` | **Reserve and consume** — neither creates stock |

✅ **Classified 2026-08-09 as an accepted absence, not an open dependency** (`EVU-15`). **`EVA-019` does not require every authoritative fact to publish an event**, and **no module has a confirmed reaction to trade-in stock creation** — `ACC §6` names only *Trade-In accepted*, and the generic availability recomputation that follows any stock change is already `Product.AvailabilityRecomputed` (`PRD-078`, `EVT-088`). **An Inventory event here would be catalogue symmetry, which `EVA-019` exists to refuse.** **Creating an Inventory event with no consumer would be cataloguing pressure, which `EVA-019` exists to refuse.** **`EVT-097` already carries the cross-module fact that matters**: Trade-In tells Inventory the gates have passed.

## 21.2 Open dependencies carried, not solved

**No event resolves any of these, and none routes around one** (`EVA-001`, `DOC-024`).

| # | Open item | Status |
|---|---|---|
| 1 | **Trade-In Credit application** | ✅ **FULLY RESOLVED 2026-08-09.** Business half by `BD-433`; **producer by architecture decision** — **Accounting publishes `EVT-101 Accounting.TradeInCreditApplied` because it owns `E-083`** (`ACC-048`, `ACC-050`), **Payment orchestrates by explicit request and may be refused** (`PAY-068`, `PAY-069`, `SYS-006`, `SYS-032`), and **Trade-In owns neither.** **`PAY-015`'s gross receivable is preserved** — applied credit is a **third non-cash clearing component** alongside cash and deductions, so **nothing is netted at recognition.** ⚠ **Reversal and expiry remain unresolved** |
| 2 | **Trade-In Credit reversal** when the associated sale is cancelled, returned or refunded | 🔴 **Open** (`BD-431`). `INV-83.2` forbids cash redemption, which is what makes it hard |
| 3 | **Credit expiry** | ⚠ Open (`BD-394`, `ACC-040`) |
| 4 | **`REPAIR_REQUIRED` → `SM-15` registered entry points** | ✅ **RESOLVED 2026-08-09.** Registered as `SM-15`'s **fourth** entry point (`SMA-044` as amended, `WAR-035`, `TRD-034`). **`SMA-072` always stated the delegation — only the enumeration was stale.** No state, transition or authority changed; **no event created** |
| 5 | **Failed courier return** | ✅ **COVERED by existing contracts 2026-08-09** — no Trade-In event required. Delivery's normal failed-delivery/RTO lifecycle applies (`EVT-036`, `SM-4` `RETURNED_TO_WAREHOUSE`); **the item never stopped being customer property** (`INV-81.4`, `TRD-079`), so its return to Trioloo is a **custody fact, not an inventory one**; and **`BD-396` already models a customer who *“does not collect or accept return”*** — `SM-18` holds at `RETURN_IN_PROGRESS` or moves to `UNCLAIMED_PROPERTY`, with `UNCLAIMED_PROPERTY → RETURN_IN_PROGRESS` already permitting a further attempt (`SMA-069`, `SMA-070`). **`TradeIn.ReturnFailed` would duplicate Delivery's lifecycle and is not created** |
| 6 | **Cost-bearer outcome set** | ✅ **RECONCILED BY SCOPE 2026-08-09 — no side chosen, no outcome invented.** **`BD-395` labels its four as *“Examples”*, not an enumeration**, and **`BD-430` states a default without excluding any of them.** **The four outcomes remain possible; `CUSTOMER` is the default.** `TRD-053`, `TRD-054` and `TRD-080` are all already consistent with that reading and are unchanged |
| 7 | **Component cost basis at acceptance versus at allocation** | ⚠ Observation recorded at `EVT-096`; **for Accounting to settle** |
| 8 | **Inventory stock-creation event** | ⚠ `EVU-15`, §21.1 |
| 9 | `GAP-103` teardown · `GAP-104` salvage SKU · `GAP-105` valuation on legal transfer · `GAP-106` billable services · abandonment authority | ⚠ **All carried unchanged** |

## 21.3 Transitions that deliberately publish nothing

> **EVA-026 — The following were each tested against `EVA-019` and produce no event.**

| Occurrence | Why no event |
|---|---|
| **Provisional evaluation · inspection · renegotiation** | **Judgement-dependent and internal.** *"Differs materially"* is a judgement, not a determinable point (`TRD-021`, `CP-8`) |
| **Custody beginning** | Warehouse's holding and Inventory's **non**-reaction are settled by rules (`WHS-069`, `IVN-033`), and **no consumer reaction is confirmed.** Unlike warranty, where `BD-428` confirmed a customer notification |
| **`CUSTOMER_PICKUP` return** | **No shipment, no Delivery workflow, no confirmed cross-module reaction** (`BD-430`, `TRD-076`, `DLV-124`) |
| **Ordinary component classification progression** | Only the **blocking** case has a confirmed reaction (`EVT-098`) |
| **`COMPLETED` · `CANCELLED` · `RETURNED` · `LEGALLY_RESOLVED`** | Internal closure with no confirmed external consequence |
| **Any customer-facing moment** | **`BD-432` positively confirms no automatic customer notification is required at any Trade-In transition** (`NOT-044`) |

---

# 22. Accounting Events

**Added 2026-08-09.** **The first `Accounting.*` event.** Accounting has always consumed rather than published — `ACC §6`'s posting-trigger table lists other modules' facts — **but it owns `E-083` Trade-In Credit, and the applied fact is therefore its own to publish** (`ACC-050`, `DOC-005`).

## EVT-101 · `Accounting.TradeInCreditApplied`

**Internal · Manual** — **Source** Accounting → **Targets** Payment, Reporting, Audit

| | |
|---|---|
| Description | An amount of a customer's Trade-In Credit has been applied against an Order and the authoritative balance movement is recorded |
| Trigger | **An explicit request from Payment** (`PAY-069`, `SYS-006`), accepted after available-balance validation |
| Preconditions | Sufficient available balance on `E-083`. ⚠ **Accounting may refuse** — insufficient balance is a **normal outcome**, not an error (`SYS-032`, `ACC-049`) |
| State changes | The `E-083` balance is drawn down by a **movement**, never by overwriting a stored figure (`ACC-046`, `DB-001`) |
| Data affected | `E-083`; the applied amount; the associated Order; the remaining balance |
| Business rules | **`ACC-039` a payment source, never a discount — the Order Total is untouched and revenue stands at the full selling price** · **`ACC-040` non-cash, discharging only through a sale** · `ACC-044` full or partial application · **`ACC-047` the receivable is created gross and this clears part of it** · `ACC-048` Accounting is the authoritative ledger |
| Notifications | **None confirmed.** `BD-432` requires no automatic customer notification anywhere in the Trade-In flow |
| Audit | Applied amount, order, actor and resulting balance recorded |

**Consumer reactions, exactly as confirmed:**

| Consumer | Reaction |
|---|---|
| **Payment** | Use the **confirmed** applied amount to determine **Remaining Amount Payable**, and coordinate the clearing when the gross receivable is created at dispatch (`PAY-064`, `PAY-068`) |
| **Reporting** | Outstanding Trade-In Credit must be **reportable as a standing liability** (`ACC-040`) — unexpiring credit accumulates |

> **Why this is Accounting's event and not Payment's.** **Two entities change when credit is applied** — `E-083` and the order's payable — which is exactly why the producer was not derivable and `EVU-16` stayed open. **The architecture decision resolves it by ownership**: `E-083` is Accounting's, so **the authoritative applied fact is Accounting's.** **Payment orchestrates and may request; it never becomes the ledger authority** (`PAY-068`, `ACC-048`).

> **The request is deliberately not an event.** **`SYS-006` permits coupling by event and by explicit request**; **`EVA-002` forbids an event from being a command, a request or an intention.** **This is the `EVT-039 Inventory.Reserved` shape exactly** — Order Management requests a reservation, **Inventory may refuse** (`SYS-032`), and Inventory publishes the fact it owns. **No request event was invented.**

> ⚠ **Reversal and expiry are outside this event.** What happens to applied credit when the sale is later cancelled, returned or refunded remains **explicitly unresolved** (`BD-431`), as does expiry (`ACC-040`). **This event records an application and nothing else.**

---

# 23. Build Events

**Added 2026-08-09** from `BUSINESS_DISCOVERY.md` §33 (`BD-434`). **One event.** `SM-12` has six modelled stages and **produces a single event**, which is the point (`EVA-019`).

## EVT-102 · `Build.Completed`

**Internal · Manual** — **Source** Warehouse → **Targets** Inventory, Warehouse *(fulfilment)*, Audit

| | |
|---|---|
| Description | A build has passed QC, its As-Built record is captured, and the finished unit comes into existence |
| Trigger | `SM-12` → **`READY_FOR_PACKING`**, the machine's terminal stage (`SMA-027`) |
| Preconditions | QC passed (`QC_INSPECTION`, a **stage** — `SMA-029`, `SMA-045`); **As-Built recorded** (`Product.AsBuiltRecorded`, `EVT-088`) |
| State changes | **A finished inventory-controlled unit is created.** ⚠ **Whether it becomes generally available depends on the build mode** — `IVN-043` |
| Data affected | `E-065` Build Job; the finished unit; **Build ID, component and serial history, and for a build-to-order the Order and Customer** (`BD-434`) |
| Business rules | **`IVN-043` creation and availability are two facts** · **`IVN-044` a customer-specific build is never exposed as available stock, not even momentarily** · **`IVN-045` it is never modelled as passing from components to a packed parcel without a finished-unit record** · `WHS-074` what the handover carries · **`BR-144` components already deducted are never deducted again** |
| Notifications | **None confirmed.** No source states any build notification |
| Audit | Completion, QC outcome and the finished unit recorded |

**Consumer reactions, exactly as confirmed — and they differ by build mode:**

| Consumer | **Build-to-order** | **Build-to-stock** |
|---|---|---|
| **Inventory** | **Create the finished unit and allocate it to the originating Order. It never becomes general available stock** (`IVN-043`, `IVN-044`) | **Create the finished unit as normal available sellable inventory**, subject to the usual availability and reservation rules (`IVN-043`) |
| **Warehouse** *(fulfilment)* | **Hand the unit to the normal packing process for that Order** (`WHS-074`, `BD-434`) | **Hold as warehouse stock** until allocated or sold |

> **One event, not two.** The **build mode is data on the event**, not a different fact — the same occurrence with the same producer and the same consumers, which **branch on the mode**. `BD-434` presents it as one path diverging at availability, and **splitting it would fragment a single business fact.**

> ⚠ **This does not duplicate `Product.AsBuiltRecorded`.** They are **sequential and distinct** — `BD-434`'s order is **QC Pass → As-Built Recorded → Finished Unit created**. `PRD-090` records what the as-built fact does: **fix component cost, establish warranty attribution, and create the record return authentication depends on.** **This event is the inventory and handoff fact that follows it.**

> **Why a customer-specific build is never briefly available.** The obvious implementation **creates the finished unit as stock and then reserves it** — and for the moment between, another order can take it. **A machine built to one customer's specification would be sold to someone else.** `IVN-044` forbids it, and the consumer reaction above is written so the allocation is part of creation rather than a second step.

## 23.1 Component consumption publishes nothing

> **EVA-027 — Build component consumption is an inventory movement with no event.** **No module has a confirmed reaction beyond Inventory recording its own movement**, so **`EVA-019` refuses one.**
>
> **`EVT-041 Inventory.Deducted` was tested and is NOT reusable.** Its trigger is *Order dispatched*, its precondition *goods packed and handed to the carrier*, its state change `Inventory:PACKED → IN_TRANSIT`, and its business rule cites **`BR-054`** — **it is dispatch-specific in every field.** Build consumption happens at assembly under **`BR-143`**. **Reusing it would have imported the wrong timing.**
>
> **Where the act crosses a module boundary it is an explicit request**, which **`SYS-006` permits alongside events** — the same mechanism as a stock reservation (`SYS-032`). **The movement is recorded** (`IVN-029`, `IVN-046`); **only the event is refused.**

## 23.2 Transitions that deliberately publish nothing

| Occurrence | Why |
|---|---|
| **`QC_INSPECTION`, pass, `REWORK_REQUIRED`** | **Build QC is a stage that gates progress and produces no branching disposition** (`SMA-029`, `SMA-045`). **The same determination as Repair QC** (`EVA-022`) — and **no second QC machine exists** |
| **`WAITING_FOR_COMPONENTS`** | **No confirmed consumer.** `NOT §11.1` has no build entry, and **no Action Queue behaviour is invented.** ⚠ **`GAP-016` backorder remains unmodelled and unresolved** |
| **`COMPONENTS_RESERVED`** | Reservation is order-driven (`IVN-014`) and already published as **`EVT-039 Inventory.Reserved`** |
| **Substitution** | Already **`Product.SubstitutionApplied`** (`EVT-088`, `WHS-044`, `WHS-045`) |
| **As-Built recorded** | Already **`Product.AsBuiltRecorded`** (`EVT-088`, `PRD-090`) |
| **Component consumption** | §23.1 — `EVA-027` |

⚠ **`SM-12` has no cancellation state**, and none is invented here (`SMA-026`, `DOC-024`).

---

# Appendix A — Event Index by Class

| Class | Events |
|---|---|
| **Internal · Manual** | EVT-001, 003, 006, 007, 010, 011, 016, 017, 018, 020–022, 025–030, 033, 046, 047, 049, 050, 051, 054, 060, 061, 062, 064–070, 073–076 |
| **Internal · Automatic** | EVT-004, 012, 013, 015, 019, 023, 024, 031, 039–045, 052, 071, 072, 077–079 |
| **Internal · Scheduled** | EVT-048, 083, 084 |
| **External · Automatic** | EVT-002, 008, 009, 032, 035–038, 053, 055, 080–082 |
| **External · Scheduled** | EVT-056 |
| **External · Multi-mode** | EVT-034 *(push, poll, or manual — `BR-029`)* |
| **`UNDECIDED`** | EVT-005, 014, 057, 063 *(`GAP-019`)* |

# Appendix B — Rule Index

EVA-001 non-invention · EVA-002 fact not command · EVA-003–012 event rules · EVA-013–015 classification · EVA-016 duplicate absorption · EVA-017 out-of-sequence · EVA-018 unknowns · **EVA-019 event-existence test · EVA-020 machine coverage boundary · EVA-021 Warranty & Repair event set · EVA-022 transitions publishing nothing · EVA-023 supplier claim has no machine · EVA-024 Trade-In event set · EVA-025 Inventory stock-creation left open · EVA-026 Trade-In non-events · EVA-027 build consumption publishes nothing · EVA-028 `SM-14` requires no event · EVA-029 approval is not receipt · EVA-030 `SM-16` requires no event · EVA-031 `SM-20` requires no event · EVA-032 `SM-21` requires no event**.


---

## 19.4e `HR & Payroll` requires no event — the fifth proven negative

> **EVA-033 — HR & Payroll publishes no event in V1, and this is a determination rather than an omission** (`HRP-059`, `DOC-023`).

**Tested against the three grounds that justify an event:**

| Ground | Assessment |
|---|---|
| **Prohibited-transition enforcement** | ⚠ **The only prohibition is `HRP-028` — a finalised run is never reopened.** **Enforced locally by the owning module; no consumer needs to learn of it** |
| **Independent lifecycle ownership** | **No consumer owns a lifecycle that payroll finalisation drives.** **Accounting's salary payable position is DERIVED from the finalised run** (`ACC-093`), **not driven by a notification** |
| **Genuine cross-module reaction** | ⚠ **Accounting and Payment are reached by explicit request under the `HRP-053` contracts** — **`SYS-006` permits coupling by event AND by explicit request equally**, and **the request form is what the reconciliation contracts already require** |

> ✅ **`SM-14`, `SM-16`, `SM-20`, `SM-21` and now HR & Payroll** — **the fifth proven negative.** **A state transition is not automatically an event** (`EVA-` discipline), and **no event is created for catalogue symmetry.**
>
> ✅ **The event count stays 102** · `EVT-001` – `EVT-102` across sixteen domains.

⚠ **This is not permanent by fiat.** **If a later capability requires a genuine cross-module reaction to payroll finalisation — a notification to the employee, an automatic accounting posting — that capability names the event.** **None does today.**


# Appendix C — Amendment Record

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-04 | Initial ratification. 87 events across 11 domains. Closes `GAP-061`. 12 unknowns recorded, none filled |
| **1.14.0** | **2026-08-10** | ✅ **`SM-21` Advance Requisition DETERMINED to require no event — the FOURTH proven negative. `EVA-032`, §19.4e. No event created; count stays 102.** **Every occurrence is internal to Accounting and Payment**, which **own the capability between them** (`ACC-060`, `PAY-087`): request, authorisation, rejection and cancellation are **not financial events at all** (`ACC-003`); **disbursement is Payment recording a transaction on an explicit request, not an event** (`EVA-002`, `SYS-006`); **accepted expense and write-off are Accounting deciding and Accounting posting**; and **authority closure posts nothing while completion is a DERIVED CONDITION, not an occurrence** (`ACC-070`, `SMA-084`). ⚠ **One genuine cross-module reaction exists — salary recovery — and its counterparty is HR & Payroll, which `SYS-093` defers past V1. There is no consumer to publish to.** ✅ **Proven the same way as the other three**: `SM-14` because the facts belong to Daraz, `SM-16` to Chat, `SM-20` because no balance changes outside Accounting, **`SM-21` because the capability is Accounting's own.** ⚠ **`BD-450`'s reconciliation obligation is CARRIED, not implemented** — whether that contract is an event or an explicit request is **HR & Payroll's to determine when it exists**, and **`EVA-019` forbids registering one now on the strength of an anticipated consumer** |
| **1.13.0** | **2026-08-09** | ✅ **`EVT-013 Order.Delivered` reconciled — `BD-442`, the final Freeze blocker. No event created or removed; count stays 102.** **Its precondition read *“at least one shipment delivered”* and its state change *“→ `Order:DELIVERED` when **every** shipment is delivered, else `Order:PARTIALLY_DELIVERED`”*** — **both presuppose concurrent shipments, which `BD-442` withdraws.** **An order has at most one active shipment**, so the precondition is **the shipment delivered** and **`Order:PARTIALLY_DELIVERED` is removed**; a refused or undeliverable parcel goes to **`Order:FAILED_DELIVERY`** and follows RTO. ✅ **`EVT-013` was the ONLY event in the register whose contract depended on shipment multiplicity** — swept and confirmed. **Payment, Inventory and Accounting consumers are unaffected**: `Payment:NOT_DUE → DUE` and `Inventory:IN_TRANSIT → CONSUMED` are unchanged, and **`BR-033` already tied the obligation to delivered goods** |
| **1.12.0** | **2026-08-09** | ✅ **`EVT-005 Order.Released` preconditions amended — `BD-441`, pre-freeze blocker A4. No event created or removed; count stays 102.** **The stock precondition — *stock available for every catalogued line or backorder authorised* — is REMOVED.** **`BD-441` establishes that stock shortage never blocks Order progression** and **negative stock is supported**, so availability is **not a release gate**; a shortage **may be shown for visibility and never gates.** ✅ **The clause's own history is the finding**: *“or backorder explicitly authorised”* **never had an authorisation step, actor, reason vocabulary or waiting state specified** — **because there was never anything to authorise.** **`GAP-016` closed on that basis** |
| **1.11.0** | **2026-08-09** | ✅ **`EVT-040 Inventory.ReservationReleased` reconciled — `BD-436`/`BD-437`, pre-freeze blocker A2. No event created or removed; count stays 102.** **Its trigger read *“Order released (`EVT-005`); order cancelled, **held**, or reservation **expired**”* — three errors in one line.** **Reservation begins at *confirmation*** (`BR-096`, since 2026-08-06); **`ON_HOLD` releases nothing** — a held order is **active** (`BD-436`, `BR-149`); and **no reservation expiry exists at all**, `BD-279`/`SMA-031`/`DM-041` giving `E-027` no lifecycle of its own. **The trigger is now: confirmation reserves; cancellation or an explicit authorised manual release frees.** **Superseded `BR-053` marked; `BR-149`, `IVN-049` and `IVN-050` cited.** ⚠ **`SYS-032` becomes load-bearing** — it is why a released reservation **never silently reactivates**: re-reservation may simply be refused |
| **1.10.0** | **2026-08-09** | ✅ **`SM-20` Fund Transfer DETERMINED to require no event — the third proven negative, and the last uncovered machine. `EVA-020` and `EVU-13` both CLOSED. No event created; count stays 102.** **`ACC-026` and `SYS-105` state the reason outright: a Fund Transfer *moves value between Financial Accounts the business controls and changes no balance outside them*** — **so there is no cross-module surface to have an event on.** Fund Transfer is **wholly Accounting's** (`DOC-056`: `E-084`, `E-085`, `SM-20`, Transfer Type and fee independence), **Payment observes only**, **`ICO-034` states an explicit non-reaction**, and **Notification carries no entry.** `REQUESTED` and `CANCELLED` post nothing; `IN_TRANSIT` and `COMPLETED` post one leg each to accounts Accounting owns on both sides; **`FAILED` is a third movement, never an undo** (`SMA-075`); **`Reversed` is an overlay plus a new transaction** (`SMA-076`); **the fee needs no lifecycle** (`SMA-078`). ⚠ **Idempotency examined and sound** — each leg posts once by construction. **One presentational risk found and corrected in `STATE_MACHINE_ARCHITECTURE.md`**: `SM-20`'s posting column is **cumulative**, and an incremental reading would have **double-posted the source leg**. **`EVA-020` now records that every machine's event position is settled**, keeping *covered by discovery* and *proven unnecessary* distinct |
| **1.9.0** | **2026-08-09** | ✅ **`SM-16` Conversation DETERMINED to require no event — the second proven negative. No event created; count stays 102.** **`EVA-030`** records every occurrence tested: the **shared inbox is Chat's own** (`CHT-029`), **assignment is automatic with no claim step** (`CHT-022`), the **cycle is the machine's nature** (`SMA-058`), **reopening is mechanical** (`SMA-059`), **closure is a human act with no consumer** (`CHT-045`), **linkage is orthogonal and a link is not an event** (`SMA-060`, `CHT-035`), and **notes do not change the lifecycle** (`CHT-053`). 🔴 **A message event is forbidden, not merely unjustified** — **`CHT-009` declines message-level structure**, and an event would introduce exactly what the ratified set omits. **The `Overdue`/`Inactive` overlays are refused for a different reason than the warranty delay was**: `SM-16` has **the architecture's only real threshold** (10 minutes, `CHT-047`, `SMA-063`), so **the occurrence is determinable — but `CHT-049`'s whole reaction is highlighting in Chat's own inbox and dashboards**, never closure or escalation (`SMA-062`), and **no conversation appears among `NOT §11.1`'s eight Action Queue instances.** **Every candidate consumer tested; `CUS-066` confirms Customer references and owns none of it.** ⚠ **One asymmetry recorded, not corrected**: `SM-9`'s advance-exchange Action Queue work publishes no event either, which **`BD-385` permits** since Business Event → Action Queue is *zero, one or many*. **`EVA-020` narrows to `SM-20` alone; `EVU-13` narrowed** |
| **1.8.0** | **2026-08-09** | ✅ **`SM-14` Marketplace Claim DETERMINED to require no event — a proven negative, not an absence of evidence. No event created; count stays 102.** **`EVA-028`** records every occurrence tested against `EVA-019`: **submission is manual in the Daraz Seller Center and is not a system action at all**; **post-submission states are mirrored, never locally owned** (`SMA-036`, `INV-69.2`); **`APPROVED` records an amount whose meaning is `GAP-084`, open**; **`REJECTED` changes nothing automatically** — stated independently by **`BR-131`, `SMA-038` and `INV-69.3`**, all re-tested and all holding; and **ageing is positively foreclosed** (`SMA-037`, `INV-69.4`), which is why it does not belong under `GAP-024`. **Every candidate consumer was tested individually and none reacts** — including Notification, which has no claim entry in §11.1 or its ageing overlays. **`EVA-029` settles the `SM-14` ↔ `SM-6` boundary**: **approval is not receipt**, no rule makes an approved claim a receivable or settlement component, and **whichever route the money takes is already carried by `EVT-056` or `EVT-054`** — so the surface is complete under either answer. ⚠ **Recorded, not resolved**: `OM §11.6`'s seven deduction categories are all outbound and an inbound compensation has none, paired with `GAP-084`. **`EVA-020` narrowed to `SM-16` and `SM-20`; `EVU-13` narrowed** |
| **1.7.0** | **2026-08-09** | ✅ **`SM-12` COVERED — `EVT-102 Build.Completed` registered; `EVU-14` CLOSED.** §23 adds **one** event for a six-stage machine. **Its consumers branch on build mode**: **build-to-order — the finished unit is created and allocated to its Order, never general stock, and hands to packing; build-to-stock — it becomes available sellable inventory** (`IVN-043` – `IVN-045`, `WHS-074`). **One event, not two** — the mode is **data**, and splitting would fragment a single business fact. **It does not duplicate `Product.AsBuiltRecorded`**: `BD-434`'s order is **QC Pass → As-Built Recorded → Finished Unit created**, and this is the inventory and handoff fact that follows. **`EVA-027` records that component consumption publishes nothing** — **`EVT-041` was tested and is NOT reusable**, being dispatch-specific in trigger, precondition, state change and its citation of `BR-054`; **reusing it would have imported the wrong timing.** **Build QC, shortage and rework also publish nothing**, and **no Action Queue behaviour was invented for `WAITING_FOR_COMPONENTS`** — **`GAP-016` stays unresolved.** Domain `Build` added. **102 events across 16 domains** |
| **1.6.1** | **2026-08-09** | **`SM-12` coverage and `EVU-14` updated from §33 — no event created; count stays 101.** `BD-434` confirms the finished-build path, so **`EVU-14` narrows**: Build QC needs **no** event (`SMA-029`, `SMA-045`); shortage and rework have **no confirmed consumer**; substitution and the as-built record stay covered by `EVT-088`. **Build completion is now fully supported and awaiting specification** — `BD-434` confirms both consumers and their mode-dependent reactions (`IVN-043` – `IVN-045`, `WHS-074`). 🔴 **Component consumption remains blocked by a ratification defect, not a discovery gap**: **`EVT-041 Inventory.Deducted` encodes `BR-054`'s deduction at dispatch**, while `PRD-045` consumes at assembly and `PRD-046` records the `OM §14.4` amendment as outstanding since `PRODUCT_ARCHITECTURE.md` v1.0.0 |
| **1.6.0** | **2026-08-09** | ✅ **`EVU-16` CLOSED — `EVT-101 Accounting.TradeInCreditApplied` registered, the register's first `Accounting.*` event.** The producer question is resolved **by ownership**: **`E-083` is Accounting's, so the authoritative applied fact is Accounting's** (`ACC-050`). **Payment orchestrates by explicit request and may be refused** — **`SYS-006` permits coupling by event *and by explicit request*, and `EVA-002` forbids modelling a request as an event**, so **no request event was invented.** **This is the `EVT-039 Inventory.Reserved` shape exactly**: a module receives a request, may refuse (`SYS-032`), and publishes the fact it owns. **`PAY-015`'s gross receivable model is preserved** — applied credit becomes a **third non-cash clearing component** beside cash and deductions. Domain `Accounting` added; coupling matrix gains one row. ⚠ **Reversal and expiry remain explicitly unresolved.** **101 events across 15 domains** |
| **1.5.0** | **2026-08-09** | **`EVU-16` half-resolved — sequencing settled, producer still an architecture decision. No event created; count stays 100.** `BD-433` fixes the order of facts: **credit applied before dispatch → obligation and COD instruction raised already net → cash settled.** ⚠ **A useful negative finding**: **most consequences need no new event** — the net figures travel as **data** on `EVT-012 Order.Dispatched` and `EVT-031 Shipment.Created`, whose contracts are unchanged. **The only unserved fact is the credit-balance movement itself.** 🔴 **Its producer is not derivable**: two entities change — `E-083` (Accounting's) and the order's payable — and **no rule picks between their owners**, so **none was chosen** (`EVA-019`). A second open decision is recorded: **`PAY-015` creates receivables gross**, so net-creation versus gross-with-clearing is open, **with the business requirement satisfied either way and `PAY-015` unamended** |
| **1.4.0** | **2026-08-09** | **Trade-In dependency reconciliation — four of five closed, no event created or removed.** **`EVA-025`/`EVU-15` classified as an ACCEPTED ABSENCE**: no module has a confirmed reaction to trade-in stock creation, and **`EVA-019` does not require every authoritative fact to publish an event** — an Inventory event here would be catalogue symmetry. **The `REPAIR_REQUIRED` → `SM-15` defect RESOLVED** as a stale enumeration: `SMA-072` always stated the delegation, and `SM-15` now registers **four** entry points (`SMA-044` amended) — **no state, transition, authority or event changed.** **Failed courier return COVERED** by Delivery's existing `EVT-036`/`SM-4` RTO lifecycle plus `BD-396`'s already-modelled *does not collect or accept return* path — **`TradeIn.ReturnFailed` would duplicate Delivery and is not created.** **Cost-bearer conflict RECONCILED BY SCOPE** — `BD-395` labels its four outcomes *“Examples”*, `BD-430` adds a default without excluding any; **no side chosen, no outcome invented.** 🔴 **`EVU-16` remains and is sharpened**: `PAY-014` and `EVT-052` raise the receivable at dispatch, but credit is applied at the order — **no receivable exists to reduce at that moment**, and the sequencing is unstated. **No owner chosen.** **Event count unchanged at 100** |
| **1.3.0** | **2026-08-09** | **Trade-In events specified from §32 discovery — `SM-18` and `SM-19` now covered.** **§21 adds `EVT-096` – `EVT-100`**: `TradeIn.AgreementAccepted`, `CostAllocationCompleted`, `ComponentClassificationBlocked`, `PropertyUnclaimed`, `CourierReturnRequired`. **`EVA-024` records that twenty-one states across two machines produce five events**; **`EVA-026` lists the six occurrence groups that deliberately publish nothing**, including **every customer-facing moment**, because `BD-432` positively confirms no automatic Trade-In notification. **`EVT-100`'s boundary is the return-method determination, never `DECLINED`** — a `CUSTOMER_PICKUP` return publishes nothing and creates no shipment. **Delivery's existing `EVT-031` – `EVT-038` are reused whole.** 🔴 **`EVA-025` records that the Inventory stock-creation event was NOT created**: producer and occurrence are established, **but no module has a confirmed reaction** — `ACC §6` names only *Trade-In accepted* — so it is carried as **`EVU-15`** rather than invented. **`EVU-16` records that the credit-application producer is undetermined**, and **no `Accounting.*` or `Payment.*` event was invented to complete the surface.** **`EVA-020` narrowed from five uncovered machines to three; `EVU-13` narrowed.** **Nine open dependencies carried at §21.2**, including the `DOC-050` cost-bearer conflict, the `REPAIR_REQUIRED` → `SM-15` defect and credit reversal — **none solved by an event.** **100 events across 14 domains** |
| **1.2.0** | **2026-08-09** | **Warranty & Repair events specified from §31 discovery — `SM-13` and `SM-15` now covered.** **§20 adds `EVT-089` – `EVT-095`**, seven events justified by `BD-426` – `BD-429`: `Warranty.UnitReceived`, `CustomerDecisionRequired`, `ReplacementAuthorised`, `SupplierClaimSubmitted`, `SupplierClaimOutcomeRecorded`, `ResolutionDecided`, `ReadyForHandback`. **Each exists because a confirmed occurrence has a confirmed reaction in another module** — `EVA-021` records that **twenty-three transitions across the two machines produce seven events**, and **`EVA-022` lists the ten occurrences that deliberately publish nothing**, with reasons. **Reuse was preferred throughout**: the replacement reservation is `EVT-039` with a second trigger, the stock deduction stays `EVT-041`, and the whole handback shipment lifecycle stays `EVT-031` – `EVT-038` with Warranty **consuming** `Shipment.DeliveryFailed` rather than republishing it. **`EVA-020` amended from seven uncovered machines to five**, and **`EVU-13` narrowed** — both **by discovery, not assumption**. **`EVA-023` records that the supplier/manufacturer warranty claim has no state machine and is NOT `SM-14`**, which is Marketplace Claim. **§20.3 carries nine open dependencies unsolved**, including the `PAY-049` refund conflict, the missing Payment contract for a chargeable repair, and three unstated Accounting postings — **no event was used to hide one.** Coupling matrix gains seven Warranty rows. Domain `Warranty` added. **95 events across 13 domains** |
| **1.1.0** | **2026-08-09** | **Product events registered; machine coverage stated; three false claims withdrawn. No event invented.** **`EVT-088` registers the sixteen `Product.*` events** by delegation to `PRODUCT_ARCHITECTURE.md` §22 — **confirmed in their owning document since v1.0.0 and never registered here**, an amendment its Appendix A item 8 had recorded as outstanding. **Not one event name, class or purpose originates here.** **§19 added**: machine-by-machine coverage for `SM-1` – `SM-20`, with **`EVA-019`** stating the event-existence test and **`EVA-020`** recording that **seven machines run with no registered event and no evidence that one exists** — `SM-13` – `SM-16`, `SM-18` – `SM-20`. **`SM-17` was already covered** by `Permission.OverridePerformed` (`EVT-085`); **`SM-12` is partly covered** by `Product.AsBuiltRecorded`. **Three deterministic corrections**: §16's claim to be *the complete inter-module coupling surface* is **withdrawn as false**; the `EVT-085`/`EVT-086` summary lists are marked **illustrative, not exhaustive** (Permission has eleven events, Audit eight); the Document Control entity range `E-001`–`E-057` is corrected to `E-085`. **`EVU-13` and `EVU-14` opened.** **`SMA-011` recorded as fully discharged** — §16 needed no amendment for `SM-3`, `SM-6`, `SM-10` or `SM-11` because it is module-keyed. **88 events across 12 domains** |

---

*This document specifies business events only. It contains no API contract, message schema, database design, or code. Payload structure and transport are engineering deliverables derived from and tested against this register.*

---

## 19.4f Final Settlement requires no event — the sixth proven negative

> **EVA-034 — Final Settlement publishes no event** (`HRP-087`, `DOC-023`).

| Ground | Assessment |
|---|---|
| **Prohibited-transition enforcement** | **Only *never reopen*, enforced locally** (`HRP-079`) |
| **Independent lifecycle ownership** | ⚠ **None.** **The owning capabilities are INVOKED by `HRP-074` step 3, not notified** |
| **Genuine cross-module reaction** | 🔴 **An event would be actively WRONG here.** **`HRP-075` requires finalisation to be ATOMIC across positions owned by another module**, and **event delivery is at-least-once and asynchronous** (`SYS-051`, `API-035`, `API-024`) — **which cannot provide the synchronous all-or-nothing coordination the rule demands** |

> ✅ **The sixth proven negative** — after `SM-14`, `SM-16`, `SM-20`, `SM-21` and `EVA-033` — **and the first where an event is not merely unnecessary but would defeat a ratified constraint.**
>
> ✅ **`SYS-006` permits coupling by event AND by explicit request equally**, and **here the explicit-request form is the only one that satisfies `HRP-075`.** **The count stays 102** · `EVT-001` – `EVT-102`.

---

## 19.4g Leave requires no event — the eighth proven negative

> **EVA-035 — `E-102` Leave Request publishes no event** (`HRP-097`, `BD-499`, `DOC-023`).

| Ground | Assessment |
|---|---|
| **Prohibited-transition enforcement** | **None beyond `HRP-096`, enforced locally** |
| **Independent lifecycle ownership** | **None** |
| **Genuine cross-module reaction** | ⚠ **Nothing reacts to a leave decision.** **Attendance READS the approved fact when it evaluates a date** (`HRP-008`, `HRP-095`), **and `SYS-006` permits coupling by explicit request equally with events** |

> ✅ **The eighth proven negative** — after `SM-14`, `SM-16`, `SM-20`, `SM-21`, `EVA-033`, `EVA-034` and `PRN-030`. **The count stays 102** · `EVT-001` – `EVT-102`.
>
> ⚠ **Not permanent by fiat.** **If a later capability requires a genuine reaction to a leave decision — notifying the employee, or a coverage workflow — that capability names the event.** **None does today.**

