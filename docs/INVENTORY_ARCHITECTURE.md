# Inventory Architecture

**Owner:** Trioloo Technology · **Module:** Inventory · **Status:** Canonical
**Version:** 1.8.0 · **Ratified:** 2026-08-08 · **Amended:** 2026-08-12 (Stock Control UI boundary `IVN-056`) · **Rule prefix:** `IVN-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §17 Warehouse & Assembly, §18 Purchase & Supplier, §20 Marketplace, §21 Warranty, §22 Return & Exchange, §26 Trade-In, with the reconciliation at [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) §29 – §32, [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §9.9 – §9.12, [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §23, and [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md).

**References, never duplicated:** [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) `SM-7`, `SM-11`, `SM-12`, `SM-15`, `SM-19` · [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) `DB-001`, `DB-003` · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md).

## ⚠ Ownership boundary

> **IVN-000 — This document answers *what inventory exists, who owns it, where it is logically situated, whether it is available, and what movement changed it*. It answers nothing about cost, physical execution, posting, or product definition.**

| Question | Owner |
|---|---|
| **What exists · who owns it · is it available · what moved it** | **`INVENTORY_ARCHITECTURE.md`** — `IVN-` |
| **What did it cost?** | `INVENTORY_COSTING_ARCHITECTURE.md` — `ICO-` (`DOC-057`) |
| **How is the movement physically executed?** | `WAREHOUSE_ARCHITECTURE.md` ✅ |
| **What accounting entry posts?** | `ACCOUNTING_ARCHITECTURE.md` — `ACC-` |
| **What is the product?** | `PRODUCT_ARCHITECTURE.md` — `PRD-` |
| **What are the states?** | `STATE_MACHINE_ARCHITECTURE.md` — `SM-`, `SMA-` |

**Two boundaries required registration and are recorded as `DOC-058`** (§26.1): the **stock-count** split with Warehouse, and the **custody** boundary that determines what is *not* inventory.

> **This document consolidates confirmed decisions only.** No business rule, entity or state machine is introduced. **No gap is resolved by assumption** — see §30.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose and Scope

## 1.1 Purpose

To answer, at any moment, **what the business holds and whether it can be used or sold** — across seven marketplace seller accounts, seven websites, direct channels, an assembly workshop, a repair bench and a trade-in teardown flow, **from one pool of stock.**

**The hard part is not counting.** It is that the same physical component may be **reserved for an order, buildable into three different assembled products, published at different quantities on seven shops, and simultaneously not sellable because it is awaiting QC.** This document defines which of those statements is authoritative for which question.

## 1.2 In scope

The inventory ownership model · physical versus logical stock · availability derivation · the established not-sellable conditions · the movement model and its sources and destinations · adjustment boundaries · interaction with purchase, sales, marketplace publication, return, exchange, warranty, repair, build jobs and trade-in · the customer-property custody boundary · component and finished-unit behaviour · inventory history, visibility and invariants.

## 1.3 Out of scope

**Valuation and cost derivation** (`ICO-`) · **physical execution** — picking, packing, receiving, counting, QC performance (`WAREHOUSE_ARCHITECTURE.md` ✅) · **postings** (`ACC-`) · **product definition, BOM and As-Built structure** (`PRD-`) · **state definitions** (`SMA-`) · serialization policy (`PRD-106` – `PRD-110`).

---

# 2. Architectural Principles

## 2.1 P1 — One pool

> **IVN-001 — All channel instances draw on one shared physical inventory pool. Stock is never reserved to a marketplace shop** (`PRD-127`, `BD-318`, `CP-12`).

**The business states it in its own words:** *"one inventory source with multiple marketplace publication channels."*

**What this removes:** no channel inventory buckets, no per-shop allocation, no rebalancing between shops, no per-channel safety stock. **Channel-level inventory allocation is a standard ERP feature and is explicitly not required** (`CP-9`).

## 2.2 P2 — Quantity is derived from movements

> **IVN-002 — No stock figure is stored as a maintained value. Every quantity is derived from its movements** (`DB-001`).

**A stored quantity is a second copy of a figure that already exists.** `CP-12` exists to prevent exactly that.

## 2.3 P3 — Physical presence is not ownership

> **IVN-003 — Goods physically present are not inventory until the business owns them** (`SYS-103`).

**The state is: physically present, not owned, not inventory.** See §18.

## 2.4 P4 — Correctness outranks availability

> **IVN-004 — Where making stock available sooner competes with recording it correctly, correctness wins** (`BD-391`, `SYS-102`).

> **Inventory immutability is more important than early inventory availability.**

**The business accepts the resulting delay explicitly**, and the ERP makes the blockage visible rather than weakening the rule (`SMA-073`).

## 2.5 P5 — Correction is by adjustment, never by edit

> **IVN-005 — A stock discrepancy is corrected by a recorded adjustment carrying a reason and an approval. Historical movements are never edited** (`BD-111`, `BR-102`, `DB-003`).

---

# 3. Inventory Ownership Model

> **IVN-006 — Inventory is stock the business owns. Three ownership positions are established, and only one is inventory.**

| Position | Inventory? | Established |
|---|---|---|
| **Owned and held** | **Yes** | The ordinary case |
| **Held but not owned** — customer property in custody | **No** | `SYS-103`, §18 |
| **Owned but not held** — a unit temporarily with a customer | **⚠ Open — `GAP-090`** | §14.2 |

**Ownership is acquired at one of five confirmed events** — purchase acceptance, trade-in acceptance after allocation, return QC disposition, build completion, and trade-in teardown — **each enumerated in `ICO-004`.** This document does not restate them; **what it states is that ownership, not possession, is what makes something inventory.**

---

# 4. Physical Stock versus Logical Stock

> **IVN-007 — Three quantities exist, at two different scopes, and they answer different questions** (`BD-318`, `BD-280`, `BD-285`).

| Quantity | Scope | Nature |
|---|---|---|
| **Physical Stock** | **One, shared across all channels** | Derived from movements (`DB-001`) |
| **Available Quantity** | **One, shared** — ready-built **plus buildable** | **Derived. Recomputed automatically on every movement** |
| **Published Marketplace Stock** | **Per shop — seven independent values** | **Manual. A business decision** (`PRD-126`) |

## 4.1 The distinction that is easiest to misread

> **IVN-008 — *Automatically updated* applies to Available Quantity, never to Published Stock** (`BD-318`, `PRD-126`).

| Figure | Behaviour |
|---|---|
| Available Quantity | **Automatic** — recomputed on every stock movement |
| Published Marketplace Stock | **Manual** — set per shop, **may deliberately exceed physical** (`BD-280`, `PRD-112`) |

**A system that auto-clamped published stock to available would contradict `BD-280`'s deliberate over-publishing; one that never recomputed available would break `PRD-078`.** Both figures are correct — they answer different questions.

**Published stock is an attribute of `E-059` Channel Listing** (`PRD-126`), not of the product, and is owned by `PRODUCT_ARCHITECTURE.md`.

## 4.2 The over-publishing exposure compounds

⚠ **`BD-280` and `PRD-112` establish that published stock may deliberately exceed physical**, and `BD-101` linked the practice to out-of-stock cancellations.

**With one shared pool and seven independently published figures, that exposure multiplies rather than adds** — seven shops each publishing ten units against five available can attract up to seventy orders for five items.

**The decision is settled and deliberate; this is not a re-litigation.** It is recorded because **the three-quantity model makes the gap visible and measurable**, and with seven shops that visibility is worth considerably more than with one.

---

# 5. Stock Availability

> **IVN-009 — Available Quantity is derived, and for assembled products it is ready-built plus buildable** (`PRD-023` as extended, `BD-285`).

**`PRD-079` was withdrawn and `PRD-073` amended** during Warehouse reconciliation; this document carries the amended model and does not restate it.

## 5.1 Availability fans out

> **IVN-010 — A component stock movement changes the availability of every assembled product whose BOM contains it, across every channel it is listed on** (`PRD-078`).

**`PRD-078` warned this fan-out is *"inherent to the assembled model, not a design flaw"*, and the business described the same behaviour independently** (`BD-318`) — naming **build completion** as a stock-change trigger, which confirms `SM-12`'s terminal effect: a finished build raises ready-built stock, which raises Available, which propagates to all listings.

## 5.2 Availability is not costing

> **IVN-011 — Availability and cost are computed independently and must not be conflated** (`ICO-032`).

**A component's availability changes constantly; its cost does not change at all.**

---

# 6. Not-Sellable Conditions

> **IVN-012 — Three conditions are established in which stock is physically present but not sellable** (`BR-104`).

| Condition | Cause | Resolution |
|---|---|---|
| **Reserved** | Committed to a confirmed order or an approved exchange | Consumption at fulfilment, or release |
| **Pending supplier resolution** | A receiving discrepancy awaiting the supplier | Supplier Return, Exchange or Credit (`BR-112`) |
| **QC Pending** | Returned goods awaiting inspection and disposition | One of four dispositions (§13) |

> **IVN-055 — ✅ `OUT OF STOCK` IS A DERIVED DISPLAY AND QUERY PREDICATE. Ratified 2026-08-11 by business decision.**
>
> ### `available_quantity <= 0`
>
> **evaluated over the canonical Available Quantity of an Inventory Product** (`IVN-007`, `IVN-009`).
>
> **a.** 🔴 **IT IS NOT A FOURTH `IVN-012` CONDITION, AND `IVN-013` REMAINS INTACT.** ✅ **The not-sellable vocabulary is still exactly Reserved, Pending supplier resolution and QC Pending.** ⚠ **`Out of Stock` describes an availability OUTCOME; the three conditions describe WHY stock is unavailable. Different kinds of statement.**
> **b.** 🔴 **EVALUATED, NEVER PERSISTED.** **No `out_of_stock`, `is_out_of_stock` or `stock_status` column, flag or cached figure exists** (`IVN-002`, `DB-001`). ✅ **The posture `NOT-013` already takes with Low Stock — a query over current state, not a stored fact.**
> **c.** 🔴 **NOT A PRODUCT LIFECYCLE STATE AND NOT A MOVEMENT TYPE.** **`SYS §7.1` and `IVN-017`'s closed set are untouched.**
> **d.** 🔴 **PHYSICAL AND AVAILABLE REMAIN DISTINCT; THIS PREDICATE READS ONLY AVAILABLE.** **Physical `5`, fully reserved, gives Available `0` and `Out of Stock` TRUE** — ✅ **deliberately, because the operator cannot sell it, which is the question the predicate answers.**
> **e.** ✅ **`<=` rather than `=` is deliberate.** **`BD-441` confirms deliberate over-publication may drive availability negative** (`PRD-126`); **a negative availability is out of stock.** 🔴 **No negative-stock BEHAVIOUR is invented — the predicate is only evaluated.**
> **f.** 🔴 **ONE DEFINITION EVERYWHERE** — summary counts, the Out-of-Stock filter, backend queries, card presentation and tests. ⚠ **A second definition anywhere is a defect.**

> **IVN-013 — No further not-sellable condition is established.** *Damaged* and *quarantine* are **not separate inventory states in the ratified architecture** — damage is a **QC finding** (`BD-325`) resolving to a disposition, and quarantine is expressed as **QC Pending**. **Nothing is invented here to fill that vocabulary.**

## 6.1 Reservation follows commitment

> **IVN-014 — Stock is reserved at order confirmation, not at release** (`BR-052` as amended, `BD-278`).

> **IVN-054 — ✅ RESERVATION MAY FOLLOW A CONFIRMED ORDER-SPECIFIC BUILD CONFIGURATION. Ratified 2026-08-11** (`GAP-129`, Option C).
>
> **`PRD-025` reserves each component named in a Build Template. Where a Build Job's specification source is a confirmed `E-103` instead, reservation follows that configuration's `E-104` lines** (`WHS-076`, `BR-177`).
>
> **a.** ✅ **Reservation remains ATOMIC — either every component is reserved or none is** (`PRD-026`, `INV-65.2`). **Unchanged.**
> **b.** 🔴 **A DRAFT configuration RESERVES NOTHING** (`INV-103.2`). **A recommendation is not a commitment.**
> **c.** 🔴 **NO NEW MOVEMENT TYPE IS CREATED.** **`IVN-017`'s set is closed and this amendment adds nothing to it** — **components are consumed by a build exactly as before** (`SM-12`, `PRD-045`).
> **d.** 🔴 **NO STOCK FIGURE BECOMES STORED.** **Every quantity remains derived from movements** (`IVN-002`, `DB-001`).
> **e.** ⚠ **Costing is untouched** — **`ICO-` continues to own valuation and `IVN-011` keeps availability and cost independent.**

**Commitment reserves; fulfilment consumes.** The same pattern applies at exchange approval (`RET-025`).

---

# 7. Inventory Movement Model

> **IVN-015 — Every change to stock is a movement. The movement is the record; the quantity is the computation** (`DB-001`, `SM-7`).

**`SM-7` Inventory is the ratified machine** — initial `AVAILABLE`, terminal `CONSUMED`, `SCRAPPED`, `WRITTEN_OFF` — and is **owned by `STATE_MACHINE_ARCHITECTURE.md`**, not restated here.

## 7.1 Movement history is permanent

> **IVN-016 — Inventory movements are retained permanently and never deleted** (`BD-338`, `SYS-024`, `DB-028`). Archival for performance is permitted; **disposal is not.**

---

# 8. Movement Sources and Destinations

> **IVN-017 — Every movement has an identified source and destination, and both are confirmed by an established business event.**

| Movement | In / Out | Established |
|---|---|---|
| **Goods receipt accepted** | **In** | `BR-105`, `BR-109` |
| **Sale delivered** | **Out — consumed** | `BR-116`, `SM-7` |
| **Build consumes components** | **Out** | `SM-12`, `PRD-046` |
| **Build completes** | **In — a finished unit** | `SM-12`, `BD-318` |
| **Return received** | **Into QC Pending** — not sellable | `BD-289`, `RET-023` |
| **QC disposition executed** | **In (Sellable) · lateral (Repair) · Out (Scrap)** | `BD-289`, `BD-291` |
| **Exchange replacement** | **Reserved, then out** | `RET-025` |
| **Warranty replacement** | **Reserved, then out** | `BD-426`, `IVN-040` |
| **Repair consumes a component** | **Out** | `ICO-022`, `BD-290` |
| **Trade-In components created** | **In — only after allocation** | `BD-391`, §17, **`EVT-097`** |
| **Stock adjustment** | **In or Out, with reason and approval** | `BD-111`, `BR-102` |
| **Scrap** | **Out** | `BD-291` |

**No movement type exists outside this set in the ratified architecture, and none is added here.**

---

# 9. Adjustment Boundaries

> **IVN-018 — A stock adjustment requires a reason, an approval, and audit history** (`BD-111`, `AUD-042`).

> **IVN-019 — Correction of a stock discrepancy is by adjustment only** (`BR-102`). There is no direct edit of a quantity and no correction of a historical movement.

## 9.1 Stock counts are episodic, not operational

> **IVN-020 — `E-067` Stock Count exists only when the business initiates a counting process** (`BD-292`). **It is not created daily, not scheduled, and not maintained continuously.**

**Counting is triggered by a suspected mismatch, an impending purchase or large sale, management review, or a business decision to count.** There is **no mandatory periodic count**.

⚠ **Count *execution* is owned by `WAREHOUSE_ARCHITECTURE.md` ✅; the *adjustments a count produces* are owned here** (`DOC-058`, §26.1).

---

# 10. Purchase Receiving Interaction

> **IVN-021 — The goods receipt is the spine of the purchase flow, not the purchase order** (`BR-105`). `E-030` is mandatory and parentless-capable; `E-029` is optional.

**Stock enters at receipt; the payable is created at acceptance** (`BR-109`).

**Four discrepancy types are established** — including **excess as the fourth** (`BR-110`). Goods held against an unresolved discrepancy are **present but not sellable** (`IVN-012`).

**Partial receiving is supported** (`BR-096` – `BR-104`, §9.9).

---

# 11. Sales and Delivery Interaction

> **IVN-022 — Stock is reserved at order confirmation and consumed at delivery** (`IVN-014`, `BR-116`).

**An RTO never generated a receivable and never consumed stock permanently** — `BR-117` makes this automatic rather than an enforced rule: **goods never delivered created no revenue, so a failed delivery cannot leave a phantom position behind.**

**Which order events trigger which movements is owned by `ORDER_MANAGEMENT_ARCHITECTURE.md`.**

---

# 12. Marketplace Publication and Shared Stock

> **IVN-023 — Publication is a per-shop decision layered over one shared pool. It creates no separate physical stock** (`PRD-126`, `PRD-127`, `IVN-001`).

| Layer | Scope |
|---|---|
| Physical Stock · Available Quantity | **One, shared** |
| **Published Marketplace Stock** | **Per channel instance** — an attribute of `E-059` |

**Where a user may see or act on stock is bounded by scope** (§22), **but the pool itself is not divided by scope.** `BD-377`'s Marketplace Shop and Warehouse dimensions bound **visibility and authority**, not the stock figure.

---

# 13. Return & Exchange Interaction

> **IVN-024 — Returned goods enter QC Pending and take one of four dispositions, executed only after the commercial resolution is settled** (`BD-289`, `RET-018`, `RET-023`).

| Disposition | Inventory effect |
|---|---|
| **Sellable** | Re-enters available stock — **`E-026` accommodates returned units as sellable stock after QC** (`DM-033`) |
| **Repair Required** | Enters `SM-15`; **not saleable meanwhile** |
| **Supplier Claim** | Held; **duration supplier-owned and unbounded** |
| **Scrap** | **Out of inventory**, partial or full |

> **IVN-025 — Dispositions apply per line, not per return** (`RET-013`). One returned item may be `Sellable` while another from the same return is `Scrap`.

> **IVN-026 — Stock must not return to sellable inventory while a dispute is live** (`RET-023`, `SMA-050`) — otherwise the same unit could be sold twice over.

**Return and exchange lifecycles are owned by `RETURN_EXCHANGE_ARCHITECTURE.md`.**

---

# 14. Warranty Interaction

## 14.1 A customer's unit under warranty is not inventory

> **IVN-027 — A unit received for warranty service remains customer property and never enters inventory** (`SYS-103`, §18).

**A replacement component is consumed from existing stock** (`ICO-022`); **the warranty case is not an acquisition source** (`ICO-004`).

## 14.2 A warranty replacement reserves, then deducts — two facts, not one

> **IVN-040 — An authorised warranty replacement reserves normal sellable stock; the deduction happens later, at physical handover** (`BD-426`, `EVT-091`).

| Moment | Inventory effect | Fact |
|---|---|---|
| **Replacement authorised** (`EVT-091`) | **Reserve** the unit from available sellable stock **so it cannot be allocated to another sales order** | **`EVT-039 Inventory.Reserved`** |
| **Physical handover or dispatch** | **Deduct** | **`EVT-041 Inventory.Deducted`** |

**There is no separate warranty-replacement stock pool** (`BD-426`) — the replacement draws on the same shared pool `IVN-001` establishes. **This is the `RET-025` exchange pattern reached independently**, and it is why `EVT-039` needed a second trigger rather than a second event.

> **IVN-041 — Where no suitable sellable stock exists, no reservation is made and none is fabricated** (`BD-426`, `SYS-032`). ⚠ **Scope confirmed 2026-08-09: this governs *warranty replacement*, which is what `BD-426` answered. It does not govern a customer sales order** — see `IVN-052`. **`SYS-032` already makes refusal a normal outcome**; `BD-426` states the same thing from the business side — ***“the system must not create imaginary or negative replacement stock”***. **The replacement remains pending.**
>
> ⚠ **Where the pending replacement is represented is not Inventory's to decide.** `SM-13` has no state for it, and **replacement procurement is not one of `BD-293`'s five purchase triggers** — both carried open at `EVENT_ARCHITECTURE.md` §20.3. **Neither is invented here.**

> **IVN-042 — The defective unit does not return to sellable stock when a replacement is issued** (`BD-426`). It remains under warranty/repair custody, inspection and disposition — **and while it is customer property it is never inventory at all** (`IVN-027`, `SYS-103`).

## 14.2 ⚠ The loaner case is open — `GAP-090`

**`BD-335` establishes that the business does not normally provide loaners**, and that exceptional arrangements are **recorded as a business decision**.

> **What is not established is what happens to the stock figure.** `IVN-012` covers three *present-but-not-sellable* conditions; **a loaner is the inverse — physically absent but still owned.**

⚠ **`GAP-090` is carried, not resolved.** The consequence is concrete: **an untracked loaner reads as missing stock at the next count** (`BD-292`) and is investigated as a discrepancy that was never one. **Low volume, real consequence.**

---


# 14.3 Manual reservation release — the one thing a person may do to a reservation

> **IVN-047 — `ON_HOLD` releases nothing. A reservation persists while its order is active, and a held order is active** (`BD-436`, `BR-097`, `BR-149`).

**Reservation still has no lifecycle of its own** (`SMA-031`, `DM-041`) and **no independent expiry clock** (`BD-279`). Automatic release remains **cancellation only**.

> **IVN-048 — An authorised user may explicitly release a specified reservation quantity. This is the only way a person releases a reservation, and it is permission-controlled** (`BD-437`).

**It is deliberately not owner-only.** *"Other staff may perform the release if their role has been granted that authority"*, and **where the performer lacks sufficient authority, an authorised approval is required first** — which is **`PRM-033`/`PRM-034` escalation unchanged**, routed to an actor who **actually holds** the authority. **No new approval hierarchy, threshold or role is created** (`AGV-030`, `PRM-010`).

> ⚠ **This narrows `PRM-051`.** That rule recorded authority as *"concentrated in owners and administrators across every domain examined"*. **`BD-437` states plainly that the concentration is current staffing, not a rule** — the first time the business has declined the owner-only default outright.

> **IVN-049 — Every manual reservation release records ten facts** (`BD-437`):

| # | Recorded | Source |
|---|---|---|
| 1 – 4 | **Order · product/variant · warehouse or location where applicable · quantity released** | `E-028` existing attributes |
| 5 | **Reason for release** | The `BD-110`/`BD-111`/`BD-275` pattern — `AUD-042` confirms reason capture is the norm |
| 6, 7 | **Person who performed it · person who authorised it, where approval was required** | ⚠ **Separate facts *even where the same authorised person does both*** |
| 8 | **Date and time** | `AUD-012` |
| 9, 10 | **Previous reserved quantity · remaining reserved quantity after release** | `E-027` |

**No new entity is required.** **`E-028` Inventory Movement already records stock changing *commitment stage* and already carries `Release reservation` as a movement type**, with attribution, quantity, triggering document and business date. **The release is a movement, and `DB-001` derives the position from it.**

> ⚠ **The two-actor requirement is stronger here than anywhere else in the set.** `BD-110`, `BD-111`, `BD-275` and `BD-282` each separate authoriser from actor; **`BD-437` is the first to say they stay separate *even when one person is entitled to be both*.** **`PRM-050` already accepted that overlap as structural** — this makes it **visible in the record instead of erased by it** (`AUD-004`, `AUD-012`).

> **IVN-050 — Only the selected quantity is released, and a released reservation is spent** (`BD-437`).

- **The order is not cancelled and does not change state.** It may remain `ON_HOLD` (`BR-152`).
- **Other reservations on the same order are unchanged.** *"The system must not silently release additional products or quantities."*
- **Released stock returns to availability through the normal rules** — nothing special, `IVN-009` recomputes.
- ⚠ **If the order needs that stock again it goes through normal reservation, which may refuse.** **`SYS-032` already makes refusal a normal outcome** and `IVN-041` states the same posture for warranty replacement: **where no suitable stock exists, none is fabricated.** **The previous reservation never silently reactivates.**



# 14.4 Stock shortage never blocks an Order

> **IVN-051 — Physical stock may go negative, and negative stock is a supported condition rather than an error** (`BD-441`, `DB-001`).

**`DB-001` already permits it structurally** — a position is **derived from movements**, never a maintained figure, so a deduction exceeding what is on hand simply produces a negative derived balance. **No rule anywhere forbade it**; none is added. **When stock is subsequently received the balance adjusts naturally from negative toward zero and positive, through ordinary movements** (`BD-441`).

> **IVN-052 — A sales-order reservation is never refused merely because physical stock is insufficient** (`BD-441`).

| Situation | Behaviour | Rule |
|---|---|---|
| **Customer sales order, stock short** | **Reservation proceeds. The order progresses. Availability and physical stock may go negative** | **`IVN-051`, `IVN-052`, `BD-441`** |
| **Warranty replacement, no suitable stock** | **No reservation is made and none is fabricated** — the replacement stays pending | **`IVN-041`, `BD-426`** |

> ⚠ **These are not in conflict, and the difference is whose promise is at stake.** **A sales order is a commitment the business has already made to a customer who has paid or will pay on delivery** — `BD-441` says it proceeds. **A warranty replacement is a remedy being selected**, and `BD-426` says outright that *“the system must not create imaginary or negative replacement stock”*; the replacement **waits for suitable stock instead.** **`BD-426` answered warranty replacement and nothing wider.**

> **IVN-053 — A shortage may be surfaced as a warning, flag or notification for operational visibility, and that visibility never gates anything** (`BD-441`, `CP-8`).

**Permissive, not required** — *“the ERP **may** show”*. **No Action Queue entry, notification rule, threshold or SLA is created** (`NOT §11.1` unchanged, `DM-001`). **This is `CP-8` once more: a shortage warns; it never enforces.**

> ✅ **Procurement is not a gate.** **`PRC-013` already computes demand against the order book and requires no new mechanism** — components are reserved at confirmation and Available Stock nets reservations, so a shortfall against confirmed orders **is already computable**. **`BD-441` forbids making procurement completion a prerequisite for Order progression**; the demand figure informs buying, it does not hold orders.


# 15. Repair Interaction

> **IVN-028 — A repair consumes components from stock and does not create inventory** (`ICO-022`, `BD-290`).

**A repair may exist with no warranty claim behind it** — `SM-15` has **four entry points**, only one of which is warranty (`SMA-044` as amended).

## 15.1 ⚠ Current configuration is open — `GAP-089`

**After a repair the physical unit differs from its As-Built Record**, because replaced parts are recorded on the repair (`INV-72.2`) and **the As-Built Record is a build-time snapshot that must stay one** (`DB-003`).

| Record | Describes |
|---|---|
| `E-062` As-Built Record | **What went in at build** — immutable, owned by `PRODUCT_ARCHITECTURE.md` |
| `E-072` Repair | **What was changed afterwards** |
| **Current configuration** | **Neither alone — the composition of both** |

⚠ **`GAP-089` is carried.** Whether the derived view is computed on demand or maintained **is undecided, and is not decided here.**

---

# 16. Build Job / Assembly Interaction

> **IVN-029 — A Build Job consumes components and produces a finished unit; both are inventory movements** (`SM-12`, `PRD-046`, `BD-318`).

> **IVN-046 — Build components are deducted at the physical assembly or install point and are never deducted again at dispatch** (`BR-143`, `BR-144`, `WHS-043`). **`BR-054`'s deduction at dispatch governs ordinary finished and sellable goods; dispatch of a completed PC concerns that finished unit only.**
>
> ✅ **Ratified 2026-08-09.** This timing was `PRD-045`, **specification-ahead-of-ratification since `PRODUCT_ARCHITECTURE.md` v1.0.0** until `OM §14.4` was amended.
>
> **The movement is recorded without an event.** **No module has a confirmed reaction to component consumption beyond Inventory recording its own movement**, so none is invented (`EVA-019`, `EVA-027`). Where the act crosses a module boundary it is an **explicit request**, which `SYS-006` permits alongside events.

| Event | Movement |
|---|---|
| Components consumed at assembly | **Out** |
| Build completes | **In — a finished unit is created.** ⚠ **Whether Available rises depends on the build mode** — see `IVN-043` |

## 16.1 Creating the finished unit and making it available are two facts

> **IVN-043 — A completed build always creates a finished unit; whether that unit becomes generally available depends on why it was built** (`BD-434`, `SYS-080`, `IVN-009`).

| | **Build-to-order** | **Build-to-stock** |
|---|---|---|
| Finished unit created | **Yes** | **Yes** |
| **General available stock** | **No** | **Yes** |
| Allocated to the originating Order | **Yes** | **No** |
| Next operational step | **Packing/fulfilment for that Order** | **Warehouse stock until allocated or sold** |

**This is `IVN-009` reached from the business side.** Available Quantity is **derived and recomputed on every movement**, so **a finished unit can exist as an inventory-controlled unit while contributing nothing to Available** — exactly as reserved stock does. **The earlier reading that build completion always makes Available fan out held only for build-to-stock**; corrected 2026-08-09.

> **IVN-044 — A customer-specific completed build is never exposed as available stock, not even momentarily** (`BD-434`).
>
> **The obvious implementation creates the finished unit as stock and then reserves it — and for the moment between those two steps another order can take it.** A machine built to one customer's specification would be sold to someone else. **The business stated this as a prohibition rather than leaving it to judgement.**

> **IVN-045 — A build-to-order finished unit is inventory-controlled and traceable, never absent from the record** (`BD-434`). **It must not be modelled as passing from components to a packed parcel without a finished-unit inventory and traceability record**, and it stays traceable by **Build ID, component and serial history, Order and Customer**.

⚠ **What *allocated to the Order* means mechanically is not stated.** `SMA-031` makes `E-027` Stock Reservation a dependent of `SM-1` beginning at order confirmation, and the components were reserved then — **whether the finished unit inherits that reservation or carries a distinct allocation is stated by no source, and is not inferred here** (`DOC-024`).

**`SM-12` terminates at `READY_FOR_PACKING`** and is owned by `STATE_MACHINE_ARCHITECTURE.md`.

**Substitutions change what is consumed** and **all substitutions require approval** (`PRD-038` as amended). **Build ID is mandatory only for custom-built desktop PCs** (ratified simplification).

---

# 17. Trade-In Interaction

> **IVN-030 — A trade-in creates no inventory before acceptance, and no inventory before classification and cost allocation are complete** (`BD-388`, `BD-391`, `ICO-016`).

**Three gates, in order** (`SMA-068`):

`Trade-In Agreement Accepted` → **`Component Classification Completed`** → **`Cost Allocation Completed`** → **inventory created**

> **IVN-031 — A partially classified Trade-In cannot create partial inventory** (`BD-391`, `INV-82.2`).

**The obvious optimisation is explicitly foreclosed** — releasing the obviously-reusable RAM while the motherboard is still being tested. It looks harmless and is not: **the allocation basis is not yet known, so the released item would carry a cost that later changes.**

> **IVN-032 — Scrap and Recycle components do not automatically become saleable inventory** (`BD-389`, `INV-82.1`).

**This is `IVN-004` in its sharpest form** — one unclassified component holds up an entire trade-in, and the business chose that deliberately.

## 17.1 ⚠ Teardown has no counterpart — `GAP-103`

| | Direction | Exists |
|---|---|---|
| **Build Job** (`SM-12`) | **Many components → one product** | Yes |
| **Trade-In acceptance** | **One product → many components** | **No** |

**`PRD-009` separates assembly from bundling; neither describes disassembly.** ⚠ **`GAP-103` is carried, not solved** — it is the largest structural finding affecting inventory.

## 17.2 ⚠ Used versus new — `GAP-104`

**Whether a salvaged component may share a SKU with new stock is unresolved.** `DM-077` records it as **a consequence to test, not a rule**, explicitly *"not stated by the business and not inferred"*.

⚠ **Carried. The valuation question is `INVENTORY_COSTING_ARCHITECTURE.md` §8; the inventory-side consequence — whether the two are one stock position or two — depends on it and is not decided here.**

---

# 18. Customer-Property Custody Boundary

> **IVN-033 — Goods held but not owned are never inventory, in any state** (`SYS-103`).

**Two domains require this independently:**

| Case | Established |
|---|---|
| A trade-in item **shipped before agreement** | `INV-81.1` |
| A customer's unit **received for warranty or repair** | `E-072`, §14.1 |
| **Unclaimed property** after a declined trade-in | `INV-81.4` — **and never becomes inventory** |

**The prohibition is absolute because the exposure is legal rather than accounting** — taking another party's property into inventory without transfer is not an error that reverses (`CP-8` irreversibility axis).

> **`ICO-006` reinforces it structurally:** an item with no acquisition cost cannot enter inventory, and customer property has none. **A movement with no value is not recordable** (`DB-001`).

**Custody is an overlay on the Trade-In Case, not an inventory state** (`SMA-071`), and the physical return of declined property is a **custody-out movement, not a sales return** (`BD-395`).

---

# 19. Component-Level Inventory Behaviour

> **IVN-034 — A component is an inventory item in its own right** (`E-020` Product Variant as Inventory Product, `PRD-015`).

**Components are stocked, reserved, consumed by builds and repairs, produced by trade-in teardown, and returned.** `IVN-010`'s fan-out is the direct consequence: **one component movement changes the availability of every assembled product containing it.**

**Component identity within the ERP does not imply a manufacturer serial** — serial recording is **optional and never mandatory** (`BD-265`, `PRD-106`).

⚠ **`GAP-073` is carried:** as-built records detect **a different model, not a different unit of the same model**. Missing and wrong components are caught at QC; **swapped-for-identical is not** — an accepted exposure.

---

# 20. Finished-Unit Inventory Behaviour

> **IVN-035 — A finished assembled unit is stock in its own right, and its availability is *ready-built plus buildable*** (`PRD-023`, `BD-285`).

**Ready-built units exist as stock; buildable quantity is derived from component availability.** A sale may draw on either, and **build completion converts buildable into ready-built** (`IVN-029`).

**Composite warranty attaches per component, not to the unit** (`PRD-043`) — which is why `GAP-089`'s current-configuration question matters for warranty resolution as well as for stock.

---

# 21. Inventory History and Audit

> **IVN-036 — Every movement is attributable to an Operational User Profile** (`AGV-001`, `AUD-004`), including movements performed by system, integration and automation actors.

| Requirement | Rule |
|---|---|
| **Adjustments carry a mandatory reason** | `IVN-018`, `AUD-042` |
| **Scrap decisions are authorised and recorded** | `BD-291` |
| **Movements are permanent** | `IVN-016`, `BD-338` |
| **Historical movements are never edited** | `IVN-005`, `DB-003` |
| Activity narrative versus formal audit | `AUD-001` |

---

# 22. Permission and Scope Interaction

> **IVN-037 — Stock visibility and action are bounded by Roles, Permissions and Scope Assignments, enforced on read and on write** (`PRM-009`, `AGV-020`).

**`Warehouse` and `Marketplace Shop` are established scope dimensions** (`PRM-064`). **Scope bounds *who may see and act*; it does not divide the pool** (`IVN-023`, `AGV-021`).

⚠ **`BD-377` records that most users currently work across all channels** — the scope model is **designed for growth and deliberately not enforced today** (`PRM-051`).

**Stock adjustment, write-off and scrap are authority-bounded** per `PRM-008`; ⚠ **`PRMU-8` remains open** on whether those bounds are enforced numbers or follow the *who decides, not how much* pattern.

---

# 23. Notification Integration

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.** Inventory raises these obligations against it:

| Obligation | Category | Source |
|---|---|---|
| **Low Stock** | **Ongoing Condition** — evaluated, not stored; **restocking clears it** | `NOT-013` |
| A component pending classification, blocking a Trade-In | **Action Required** | `SMA-073`, `NOT-023` |
| Receiving discrepancy awaiting supplier resolution | Action Required | `BR-110` |

**Low Stock is the confirmed example of an Ongoing Condition** and is **a query over current state, not an event** — it cannot be missed, because it is never delivered as a moment.

---

# 24. Accounting Interface

**All postings are owned by `ACCOUNTING_ARCHITECTURE.md`.**

> **IVN-038 — Inventory owns the movement; Accounting owns what the movement posts** (`ACC-011`).

| Movement | Posting owner |
|---|---|
| Goods accepted | `ACC-011` — payable at acceptance |
| Sale delivered | Accounting — COGS |
| Scrap | `ACC-025` — accounting loss |
| Stock adjustment | Accounting |
| Trade-In components created | `ACC-039` — the credit liability is the same value |

---

# 25. Inventory-Costing Interface

> **IVN-039 — This document owns the quantity and the movement. `INVENTORY_COSTING_ARCHITECTURE.md` owns the cost of that movement** (`ICO-000`, `DOC-057`).

**A movement recorded here always has a cost basis determined there** — and `ICO-006` is the rule that connects them: **an item with no acquisition cost cannot enter inventory.**

**Valuation method (WAC), acquisition cost by source, allocation and cost immutability are not restated here.**

---

# 26. Warehouse Interface

**Physical execution is owned by `WAREHOUSE_ARCHITECTURE.md` ✅.**

| Warehouse owns | Inventory owns |
|---|---|
| Location topology · pick and pack operations · goods receipt execution · **QC execution** · **count execution** · serial capture execution | The **stock position** each of those produces · dispositions as inventory outcomes · **the adjustments a count produces** |

## 26.1 `DOC-058` — two boundaries registered

> **1 · Stock counts.** `E-067` Stock Count is **episodic** (`IVN-020`). **Warehouse owns performing the count; Inventory owns the adjustment records it produces** (`IVN-018`). Without this split, a count would have two owners at the point where it changes a stock figure.

> **2 · Custody.** **Warehouse may physically hold customer property; Inventory states that such goods are never inventory** (`IVN-033`, `SYS-103`). **The custody *state* belongs to the owning process** — `E-081` Trade-In Case or `E-072` Repair — **not to Inventory and not to Warehouse.**

---

# 26A. Stock Control UI Boundary

> **IVN-056 — `Stock Control` is the user-facing UI label for Inventory-owned operational stock work.**
>
> It covers the Inventory-owned concerns this document already owns: positions, movements, reservations, adjustments/reconciliation, and transfer or location movement where canon permits (`IVN-000`, `IVN-005`, `IVN-007`, `IVN-015`, `IVN-018`, `IVN-019`).
>
> **a.** **This is a boundary rule, not a new feature rule.** It creates no entity, movement type, stored balance, permission, screen, API, migration, warehouse operation, purchasing capability or costing rule.
>
> **b.** **Product `Stock Items` and Inventory `Stock Control` remain different workspaces.** Product owns SKU, technical identity, category, barcode, serialization policy, lifecycle/master status and Product-owned CSV operations; Inventory owns what exists, whether it is available and what moved it. Read-only display across that boundary transfers no ownership (`DOC-005`).
>
> **c.** **Warehouse and Inventory Costing boundaries are unchanged.** Warehouse owns physical location structure and execution; Inventory Costing owns valuation and WAC. Their facts may be referenced or projected only under their owning rules.

---

# 27. Cross-Domain Invariants

| # | Invariant | Source |
|---|---|---|
| 1 | **One pool. Stock is never allocated to a channel** | `IVN-001` |
| 2 | **Quantity is derived from movements; nothing is stored** | `IVN-002` |
| 3 | **Physical presence is not ownership** | `IVN-003` |
| 4 | **Available Quantity is automatic; Published Stock is manual** | `IVN-008` |
| 5 | **Correction is by adjustment; movements are never edited** | `IVN-005` |
| 6 | **No inventory without an acquisition cost** | `ICO-006` |
| 7 | **No partial inventory from an incomplete Trade-In** | `IVN-031` |
| 8 | **Returned stock is not sellable until its disposition executes, and execution follows the commercial resolution** | `IVN-026` |
| 9 | **Every movement is attributable** | `IVN-036` |
| 10 | **Movements are permanent** | `IVN-016` |

---

# 28. Entity and Relationship References

| Entity | ID | Role |
|---|---|---|
| Inventory Product | **`E-020`** Product Variant | The stockable item (`PRD-015`) |
| Stock entities of `SM-7` | **`E-021`, `E-026`** | `E-026` accommodates returned units as sellable stock after QC (`DM-033`) |
| Warehouse · Stock Location | `E-004`, `E-005` | Logical situation |
| **Stock Count** | **`E-067`** | **Episodic** (`IVN-020`) |
| QC | `E-049` | Four dispositions |
| Build Job | `E-065` | Consumes and produces |
| As-Built Record | `E-062` | **Immutable** — owned by `PRODUCT_ARCHITECTURE.md` |
| Repair | `E-072` | Consumes components |
| Trade-In Component | `E-082` | Created only after allocation; owned by [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) |
| Channel Listing | `E-059` | Carries Published Marketplace Stock |

**No entity is defined here.** `DOMAIN_MODEL.md` is canonical.

---

# 29. State Machine References

| Machine | Subject | Relevance |
|---|---|---|
| **`SM-7`** | **Inventory** | The movement machine — `AVAILABLE` → `CONSUMED` · `SCRAPPED` · `WRITTEN_OFF` |
| `SM-11` | QC | Four dispositions determine the inventory outcome |
| `SM-12` | Build Job | Consumes and produces |
| `SM-15` | Repair | Consumes components |
| `SM-19` | Trade-In Component | Classification gates inventory creation — owned by [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) |

**No machine is defined here.**

---

# 30. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing on inventory |
|---|---|---|
| **`GAP-103`** | 🔴 High | **Teardown has no counterpart to assembly** (§17.1). The largest structural finding affecting this module |
| **`GAP-104`** | 🟡 Medium | **Used versus new stock position** (§17.2) — depends on the valuation question, which is itself open |
| **`GAP-089`** | 🟡 Medium | **Current configuration after repair has no owner** (§15.1) |
| **`GAP-090`** | 🟢 Low | **Loaner treatment — owned but absent** (§14.2). Reads as missing stock at the next count |
| **`GAP-073`** | 🟡 Medium | **A substituted component of the same model is undetectable** (§19) — accepted exposure |
| **`GAP-064`** | 🟢 Low | Bundle return windows and eligibility undefined (`PRD-051`) |
| `PRMU-8` | — | Whether stock-adjustment magnitude bounds are enforced numbers (§22) |

**No gap is closed by this document and none is newly discovered.**

---

# 31. Traceability

## 31.1 Business Decisions consumed

**Warehouse & Assembly:** `BD-278` reservation · `BD-280` published stock · `BD-285` derived availability · `BD-286` build costing · `BD-287` receiving · `BD-288` discrepancies · `BD-289` **four QC dispositions** · `BD-290` repair · `BD-291` scrap · `BD-292` **episodic counts**.
**Purchase:** `BD-293` – `BD-303`, especially receiving and discrepancy handling.
**Marketplace:** `BD-318` **one shared pool**, `BD-280`, `BD-101`.
**Warranty:** `BD-335` loaners · `BD-337` current configuration.
**Return & Exchange:** `BD-289`, `BD-346`, `BD-347`.
**Trade-In:** `BD-388` – `BD-397`, especially `BD-389`, `BD-391`.
**Serial policy:** `BD-242`, `BD-265`.

## 31.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `PRD-009`, `PRD-015`, `PRD-023`, `PRD-038`, `PRD-043`, `PRD-046`, `PRD-051`, `PRD-078`, `PRD-106`, `PRD-112`, `PRD-126`, `PRD-127` | `PRODUCT_ARCHITECTURE.md` |
| `ICO-004`, `ICO-006`, `ICO-016`, `ICO-022`, `ICO-032` | `INVENTORY_COSTING_ARCHITECTURE.md` |
| `ACC-011`, `ACC-025`, `ACC-039` | `ACCOUNTING_ARCHITECTURE.md` |
| `BR-052`, `BR-096` – `BR-105`, `BR-109`, `BR-110`, `BR-112`, `BR-116`, `BR-117` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `RET-013`, `RET-018`, `RET-023`, `RET-025` | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `SM-7`, `SM-11`, `SM-12`, `SM-15`, `SM-19`, `SMA-044`, `SMA-050`, `SMA-068`, `SMA-071`, `SMA-073` | `STATE_MACHINE_ARCHITECTURE.md` |
| `SYS-024`, `SYS-102`, `SYS-103`, `CP-9`, `CP-12` | `SYSTEM_ARCHITECTURE.md` |
| `DB-001`, `DB-003`, `DB-028` | `DATABASE_ARCHITECTURE.md` |
| `INV-72.2`, `INV-81.1`, `INV-81.4`, `INV-82.1`, `INV-82.2`, `DM-033`, `DM-077` | `DOMAIN_MODEL.md` |
| `AGV-001`, `AGV-020`, `AGV-021`, `PRM-008`, `PRM-009`, `PRM-051`, `PRM-064` | `ACCESS_GOVERNANCE_ARCHITECTURE.md`, `PERMISSION_ARCHITECTURE.md` |
| `NOT-013`, `NOT-023` | `NOTIFICATION_ARCHITECTURE.md` |
| `AUD-001`, `AUD-004`, `AUD-042` | `AUDIT_ARCHITECTURE.md` |

## 31.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`PRD-079` withdrawn, `PRD-073` amended** — availability is ready-built plus buildable | `IVN-009` |
| **`BR-052` amended** — reservation at order confirmation, not release | `IVN-014` |
| **`PRD-038` amended** — all substitutions require approval | `IVN-029` |
| **Stock Count is episodic**, not a daily operational entity | `IVN-020` |
| **Build ID mandatory only for custom-built desktop PCs** | `IVN-029` |

---

# 32. Version History

| Version | Date | Change |
|---|---|---|
| **1.8.0** | **2026-08-12** | ✅ **`IVN-056` — Stock Control UI boundary.** **`Stock Control` is the user-facing label for Inventory-owned operational stock work: positions, movements, reservations, adjustments/reconciliation, and transfer or location movement where canon permits.** 🔴 **Boundary only: no entity, movement type, stored balance, permission, screen, API, migration, Warehouse operation, Purchasing capability or costing rule is created.** ✅ **Product `Stock Items` and Inventory `Stock Control` remain different workspaces; Product owns SKU/master facts and Product CSV, Inventory owns what exists, whether it is available and what moved it. Warehouse and Inventory Costing boundaries remain unchanged.** |
| **1.6.0** | **2026-08-11** | ✅ **`IVN-054` — reservation may follow a CONFIRMED Order-Specific Build Configuration.** **`GAP-129` resolved by business decision (Option C), routed under `DOC-079`.** ✅ **Where a Build Job's specification source is a confirmed `E-103` rather than a Build Template version, reservation follows that configuration's `E-104` lines; atomicity is unchanged (`PRD-026`).** 🔴 **A DRAFT configuration reserves nothing — a recommendation is not a commitment.** 🔴 **`IVN-017`'s movement-type set stays CLOSED and gains nothing; no stock figure becomes stored (`IVN-002`, `DB-001`); costing is untouched and `IVN-011` keeps availability and cost independent.** **No new ledger, mechanism, event or permission.** |
| **1.7.0** | **2026-08-11** | ✅ **`IVN-055` — `Out of Stock` ratified as a DERIVED display and query predicate, `available_quantity <= 0`.** 🔴 **NOT a fourth `IVN-012` condition and `IVN-013` REMAINS INTACT — it describes an availability OUTCOME while the three conditions describe WHY stock is unavailable.** 🔴 **Evaluated, never persisted — no `out_of_stock` or `stock_status` column, the posture `NOT-013` takes with Low Stock — and neither a lifecycle state nor a movement type.** ✅ **Physical and Available stay distinct: physical 5 fully reserved gives Available 0 and Out of Stock TRUE, deliberately.** ✅ **`<=` because `BD-441` confirms availability may go negative; no negative-stock behaviour invented.** 🔴 **One definition everywhere.** |
| **1.5.0** | **2026-08-09** | ✅ **`GAP-016` CLOSED — `BD-441`, pre-freeze blocker A4. §14.4 added, `IVN-051` – `IVN-053`; `IVN-041` SCOPED. No existing rule weakened.** **Physical stock may go NEGATIVE and that is a supported condition** — **`DB-001` already permitted it structurally**, since a position is derived from movements and never maintained, so **no rule had to be relaxed and none is added.** **When stock arrives the balance adjusts naturally from negative toward zero.** **`IVN-052`: a sales-order reservation is NEVER refused merely because stock is insufficient.** ⚠ **`IVN-041` is scoped, not weakened** — it says *no reservation is made and none is fabricated*, and **`BD-426` answered WARRANTY REPLACEMENT and nothing wider**, stating outright that the system *“must not create imaginary or negative replacement stock”*. **The difference is whose promise is at stake**: a **sales order is a commitment already made to a customer** and proceeds; a **warranty replacement is a remedy being selected** and waits. **`IVN-053`: shortage visibility is permissive and gates nothing** — *may show* — so **no Action Queue entry, notification rule, threshold or SLA is created.** ✅ **Procurement is not a gate** — `PRC-013`'s demand figure already exists and informs buying, never holds orders |
| **1.4.0** | **2026-08-09** | ✅ **`GAP-018` reservation half ANSWERED — `BD-436`/`BD-437`, pre-freeze blocker A2. `IVN-047` – `IVN-050` added; no existing rule amended.** **`ON_HOLD` releases nothing** — a held order **is active**, so `BR-097`, `BD-279`, `SMA-031` and `DM-041` all stand and **automatic release remains cancellation only.** **`IVN-048` adds the one thing a person may do to a reservation** — an **explicit, permission-controlled** release, **deliberately NOT owner-only**, with **escalation where the performer lacks authority** (`PRM-033`/`PRM-034` unchanged). ⚠ **This narrows `PRM-051`** — the owner/administrator concentration is **current staffing, not a rule**, stated outright for the first time. **`IVN-049` records ten facts**, and ⚠ **performer and approver stay separate *even when the same person is entitled to be both*** — stronger than `BD-110`, `BD-111`, `BD-275` or `BD-282`, and it makes `PRM-050`'s accepted overlap **visible rather than erased.** **No new entity** — `E-028` already records **commitment-stage** changes and already carries `Release reservation`. **`IVN-050`: only the selected quantity goes, other reservations are untouched, and a released reservation is SPENT** — re-reservation goes through the normal path and **may be refused** (`SYS-032`, `IVN-041`) |
| **1.3.1** | **2026-08-09** | **`IVN-046` added — build-component deduction timing now ratified.** Components are deducted **at assembly** and **never again at dispatch** (`BR-143`, `BR-144`); `BR-054` continues to govern ordinary finished and sellable goods. **This timing was specification-ahead-of-ratification from `PRODUCT_ARCHITECTURE.md` v1.0.0 until `OM §14.4` was amended today.** **The movement is recorded without an event** — no module has a confirmed reaction beyond Inventory recording its own movement (`EVA-027`) |
| **1.3.0** | **2026-08-09** | **`IVN-043` – `IVN-045` added and one reading corrected — from `BD-434`.** §16's table read *“Build completes → In — ready-built stock rises, and Available fans out”*; **that holds only for build-to-stock.** `BD-434` establishes that **creating the finished unit and making it generally available are two distinct facts**: **both modes always create the unit**, and they diverge only at availability — a build-to-order unit is **allocated to its Order and never general stock**. **`IVN-044` records the business's prohibition against exposing a customer-specific build as available even momentarily**, which the obvious create-then-reserve implementation would do. **`IVN-045` requires the finished unit to exist as an inventory-controlled, traceable record** rather than vanishing from components into a parcel. **`IVN-029` and `IVN-009` are unchanged** — this is `IVN-009`'s derived-availability model reached from the business side. ⚠ **What *allocated to the Order* means against `SMA-031` is recorded, not inferred** |
| **1.2.2** | **2026-08-09** | **Entry-point count corrected — no rule changed.** §15 read *three entry points* for `SM-15`; it is **four** since the Trade-In `REPAIR_REQUIRED` classification was registered (`SMA-044` as amended). ⚠ **`EVU-15` is now classified as an accepted absence** — **no Inventory event exists or is required for trade-in stock creation**, because no module has a confirmed reaction (`EVA-025`) |
| **1.2.1** | **2026-08-09** | **Event cross-reference added — no rule changed.** The Trade-In movement row now names **`EVT-097 TradeIn.CostAllocationCompleted`** as its trigger. `IVN-030` – `IVN-032` are untouched. ⚠ **Inventory has no event of its own for creating trade-in stock** — the occurrence and producer are established but **no module has a confirmed reaction**, so none was invented (`EVU-15`, `EVA-025`) |
| **1.2.0** | **2026-08-09** | **Warranty-replacement reservation propagated — `IVN-040` – `IVN-042` added; no existing rule changed.** `EVT-091 Warranty.ReplacementAuthorised` names Inventory as a consumer, and this document carried the exchange pattern (`RET-025`) but **not the warranty one**. §14.2 records the two-fact split — **reserve at authorisation (`EVT-039`), deduct at physical handover (`EVT-041`)** — and that **there is no separate warranty-replacement pool**; the shared pool of `IVN-001` serves. **`IVN-041` maps `BD-426`'s *no imaginary or negative stock* onto `SYS-032`, which already makes reservation refusal a normal outcome** — so nothing new was needed for the unavailable case. **`IVN-042` records that the defective unit does not become sellable stock.** The movement table gains one row beside the exchange row. **No stock is deducted at authorisation, and neither the missing `SM-13` waiting state nor the absent procurement trigger is invented** — both carried open |
| **1.1.0** | **2026-08-09** | **Trade-In pointers corrected — no inventory rule changed.** The `SM-19` and `E-082` register rows now name their owning document, [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) (`DOC-063`), rather than standing without one. **`IVN-030` – `IVN-032` are unchanged**: a trade-in still creates no inventory before acceptance, none before classification and allocation complete, and a partially classified trade-in still cannot create partial inventory |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates inventory decisions across §17 Warehouse & Assembly, §18 Purchase, §20 Marketplace, §21 Warranty, §22 Return & Exchange and §26 Trade-In. **40 rules, all traceable; no business rule, entity or state machine introduced.** `IVN-000` records the ownership boundary; **`DOC-058` registers the stock-count split with Warehouse and the custody boundary.** **`IVN-013` records that *damaged* and *quarantine* are not established inventory states** and none is invented. **Seven open items carried; `GAP-103`, `GAP-104`, `GAP-089` and `GAP-090` explicitly not converted into rules** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies inventory business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
