# Warehouse Architecture

**Owner:** Trioloo Technology · **Module:** Warehouse · **Status:** Canonical
**Version:** 1.6.0 · **Ratified:** 2026-08-08 · **Rule prefix:** `WHS-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §17 Warehouse & Assembly (`BD-278` – `BD-292`), with prior coverage at `BD-080` – `BD-082`, `BD-098` – `BD-106`, `BD-111`, `BD-265` – `BD-267`, and §18 Purchase (`BD-293` – `BD-303`), §22 Return & Exchange (`BD-342` – `BD-354`), §26 Trade-In (`BD-388` – `BD-397`).

**Reconciliation records consolidated:** [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §9.9 (`BR-096` – `BR-115`) · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) §29 (`PRD-114` – `PRD-124`) · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) §19.4 (`SMA-026` – `SMA-034`) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `DM-039` – `DM-044`.

**References, never duplicated:** [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §0, §5.4 · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **WHS-000 — This document answers *how a physical operation is performed, by whom, and in what sequence*. It answers nothing about what the stock record says, what the goods cost, what posts to the ledger, what the commercial workflow permits, what the product is, or what states a lifecycle has.**

| Question | Owner |
|---|---|
| **How is the movement physically executed, and by whom?** | **`WAREHOUSE_ARCHITECTURE.md`** — `WHS-` |
| What exists · who owns it · is it available · what moved it | [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) — `IVN-` |
| What did it cost? | [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) — `ICO-` (`DOC-057`) |
| What accounting entry posts? | [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) — `ACC-` |
| What is the product, and what goes into a build? | [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) — `PRD-` |
| What are the states, and what transitions are legal? | [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) — `SM-`, `SMA-` |
| What does the commercial workflow permit? | [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) — `BR-` |
| Who may perform or approve it? | [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) |

**`DOC-058` already registered two boundaries between this module and Inventory** — the **stock-count split** and the **custody boundary**. Both are consolidated here at §11 and §13; neither is restated as a new decision.

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine or lifecycle is introduced. **No gap is resolved by assumption** — see §20.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To define **the physical work** — receiving, inspecting, picking, assembling, packing, counting and handing over — such that every operation produces a record someone else owns, and no operation invents one.

The whole module rests on a single distinction the business drew for itself across four independent answers:

> **A physical act and the record of that act are different things.** The technician assembles; the Build Job records it. The picker picks; the movement records it. The counter counts; the adjustment records it. **The warehouse is where the world changes; it is never where the truth is kept.**

This is `CP-12` Single Source of Truth expressed operationally, and it is why this document owns a great deal of activity and almost no data.

---

# 2. Scope

## 2.1 In scope

Goods receipt execution and its verification checks · warehouse QC execution across both established contexts · picking execution and discrepancy handling · serial capture execution · packing and dispatch preparation · build execution and the Build Job operational flow · substitution execution · stock count execution · scrap and component-recovery execution · warehouse topology and location types · the custody boundary for goods the business does not own · the execution boundaries with every adjacent module.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Stock quantity, availability, the movement ledger, not-sellable conditions** | `INVENTORY_ARCHITECTURE.md` (`IVN-000`) |
| **Valuation, acquisition cost, cost immutability** | `INVENTORY_COSTING_ARCHITECTURE.md` (`ICO-000`) |
| **Every posting, including the scrap loss** | `ACCOUNTING_ARCHITECTURE.md` (`ACC-011`) |
| **Order lifecycle, release authority, amendment windows** | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| **Build Templates, BOM, compatibility attributes, serialization policy** | `PRODUCT_ARCHITECTURE.md` |
| **State and transition definitions for `SM-3`, `SM-11`, `SM-12`** | `STATE_MACHINE_ARCHITECTURE.md` |
| **Return and exchange lifecycles, QC disposition entitlement** | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| **Supplier master, purchase orders, payable** | `PROCUREMENT_ARCHITECTURE.md` ✅ |
| **Shipment, courier handover, tracking** | `DELIVERY_ARCHITECTURE.md` ✅ |
| Notification delivery | `NOTIFICATION_ARCHITECTURE.md` |
| Screen layout, density, interaction | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

## 2.3 Explicitly excluded by the discovery itself

> **WHS-001 — Multi-warehouse operation, bin locations and wave picking were excluded from §17 by the business at the point the domain was opened, and no rule is written for them here.**

§17 states its exclusions in its own scope line: *"multi-warehouse, bin locations, wave picking, and other advanced warehouse features."* **This is an absence of discovery, not an absence of capability** — `DOC-001` and `DM-001` both forbid reconstructing what was never asked. See §4.3.

---

# 3. Architectural Principles

## 3.1 P1 — Execution never owns the record it produces

> **WHS-002 — The warehouse performs the act; the owning module records the consequence** (`SYS-004`, `SYS-005`, `SYS-015`, `IVN-038`, `ICO-033`, `ACC-011`).

| The warehouse does | The record belongs to |
|---|---|
| Receives and verifies goods | **Inventory** — the movement · **Procurement** — the payable |
| Picks and packs | **Inventory** — the deduction · **Order Management** — the fulfilment state |
| Assembles | **Product** — the as-built structure · **Inventory Costing** — the build cost |
| Counts | **Inventory** — the adjustment (`DOC-058`) |
| Scraps | **Accounting** — the loss (`ACC-025`) |

**This is what keeps the module small.** Warehouse owns four entities and no financial figure whatsoever.

## 3.2 P2 — Lifecycle structure is consumed, never authored

> **WHS-003 — The warehouse executes the transitions of `SM-3`, `SM-11` and `SM-12`; it does not define their states** (`DOC-005`, `SMA-001`).

✅ **All three are ratified.** `SM-12` was ratified at `SMA-026`; **`SM-3` Fulfillment and `SM-11` QC were ratified on 2026-08-09** when `OM §18.2` was amended to register them (`BR-142`, discharging `SMA-011` and `SMU-11`). **Until that date this document correctly carried them as proposed extensions under `SMA-001`** and did not treat them as settled; that historical status is preserved at `SMA-001`.

**That status is carried here unchanged.** This document consolidates the execution that runs against those machines; **it does not ratify them**, and `SMA-011` still requires an `OM §18.2` and §18.3 amendment before they are settled.

## 3.3 P3 — Structural correctness gates; judgement advises

> **WHS-004 — A physical fact may gate an operation; a human judgement never does** (`CP-8`, `BD-284`, `BD-287`).

The business drew this line itself, and the two sides are unambiguous:

| Gates | Advises |
|---|---|
| **Goods are not sellable until received and verified** (`BR-098`) — an unverified delivery is *not yet stock*, so nothing is being prevented | **Component compatibility warns, never blocks** (`PRD-118`) |
| **Returned goods are not sellable until QC decides** (`BR-046`, `BR-100`) | **Serial capture is never mandatory and no step may refuse to proceed for want of one** (`SYS-086`) |

*"Whether goods have physically arrived and been checked is a fact about the world"* — `BD-287`. **A state has not been reached; a decision has not been overruled.**

## 3.4 P4 — Execution corrects forward

> **WHS-005 — No warehouse operation edits a quantity, a movement, or a completed record. Discrepancies are corrected by recorded adjustment** (`BD-292`, `IVN-005`, `IVN-019`, `BR-103`, `DB-003`).

The business stated this for stock in its own words — *"stock figures must never be changed directly without a recorded adjustment"* — the fourth of four independent statements of the same principle (`BD-254`, `BD-288`, `BD-291`, `BD-292`).

## 3.5 P5 — Every physical act is attributable

> **WHS-006 — Every warehouse operation is attributable to an Operational User Profile, including operations performed by system, integration and automation actors** (`AGV-001`, `AUD-004`, `PRM-005`).

---

# 4. Warehouse Topology

## 4.1 The warehouse

> **WHS-007 — `E-004` Warehouse is the unit at which availability, allocation, assembly and fulfilment are determined** (`E-004`, `INV-4.1`, `INV-4.2`).

**Stock exists only within a warehouse**, and **a build job executes at exactly one warehouse**. A warehouse referenced by any historical movement is **archived, never deleted** (`INV-4.3`, `SYS-024`).

## 4.2 Locations

> **WHS-008 — `E-005` Stock Location makes stock findable and distinguishes sellable from non-sellable positions. Six location types are established** (`E-005`).

| Location type | Sellable |
|---|---|
| **Storage** | Yes |
| Staging | — |
| Despatch | — |
| **Quarantine** | **Never** |
| Scrap | — |
| **Build staging** — components withdrawn for assembly | — |

**Quarantine is the physical expression of QC Pending** (`BR-046`, `BR-100`, `IVN-013`), and `OM`'s glossary defines it as *"a non-sellable stock location holding returned goods pending QC"* — which `BD-289` confirmed is the business's own *"QC Pending area"* under a different name.

> **The sellability flag on a location is a property of the position, not a stock state.** The three not-sellable *conditions* are owned by `IVN-012` and are derived from movements (`DB-001`); a location type is master data. **They must not be conflated** — `IVN-013` records that *damaged* and *quarantine* are not separate inventory states.

## 4.3 ⚠ Bin and shelf operation is undiscovered, not designed away

**`E-005` establishes that a location has an identifier, a warehouse, a type and a sellability flag. Nothing further about bin or shelf granularity is established anywhere in the ratified set.**

| Established | Not established |
|---|---|
| Location identity, type, sellability | Bin numbering · shelf addressing · put-away rules · location capacity · pick-path optimisation · wave or batch picking · multi-warehouse allocation |

> **WHS-009 — No put-away, addressing, capacity or pick-sequencing rule exists, and none is invented here** (`WHS-001`, `DM-001`, `DOC-024`).

**`E-035` Pick Task already carries *"lines with location and quantity"***, so the model can express a location on a pick line today. **What is absent is any rule about how that location is chosen or structured** — and the business excluded exactly that from §17. Recorded as an explicit scope boundary; **it is not a gap in the audit, because it was never asked.**

---

# 5. Goods Receipt Execution

## 5.1 The spine

> **WHS-010 — The goods receipt is the spine of the purchase flow, not the purchase order** (`BR-105`, `IVN-021`). `E-030` is mandatory and capable of existing without a parent; `E-029` Purchase Order is optional.

> **WHS-011 — Goods receipt requires no state machine** (`SMA-034`). `E-030` records **an acceptance decision per line**; it has no states and **none should be given to it**.

## 5.2 The four checks

> **WHS-012 — The receiver checks quantity, product/model, visible physical condition, and major defects or damage** (`BD-287`, `BR-098`).

> **WHS-013 — Inbound verification is visual and quantitative, never functional** (`BD-287`).

**Latent defects are not caught at receipt** and surface later as warranty claims, where recovery runs upstream to supplier, distributor or manufacturer (`BD-092`, `BD-093`, `BD-097`, `BR-113`). **No functional testing at inbound is implied by any answer, and none is specified.**

## 5.3 Who receives

> **WHS-014 — The receiver is the Owner, an Administrator, warehouse staff, or another authorised user** (`BD-287`, `BR-098`). Authority is bounded by `PRM-008` and scope by `PRM-064`'s **Warehouse** dimension.

## 5.4 Line-level acceptance

> **WHS-015 — Receiving is line-level, and partial receiving is mandatory** (`BR-098`, `BD-287`, `BD-288`).

| Outcome | Physical consequence |
|---|---|
| **Accepted** | Enters available stock **immediately** |
| **Issue found** | **Physically held, not sellable** — Pending supplier resolution until the supplier replaces, sends the missing quantity, or issues a credit |

**A goods receipt is never a document-level accept or reject.** One delivery splits into portions with different fates, which is why `E-066` Purchase Order Item exists (`BD-288`).

> **WHS-016 — Accepted quantity is what creates the payable; delivered quantity is not** (`BR-099`, `BR-109`, `ACC-011`). **The payable is Procurement's and Accounting's; the warehouse supplies only the acceptance fact.**

## 5.5 Discrepancy vocabulary

> **WHS-017 — Four discrepancy types are established, and they are controlled vocabulary** (`BD-288`, `BR-110`, `SYS-043`, `SYS-021`): **shortage · wrong item · damaged · excess**.

**Excess has two routes** (`BR-110`): the default is to accept only the ordered quantity; extra may be **accepted by agreement**, updating the still-open purchase order under `DB-077`, **or returned**. Payable follows the **finally accepted** quantity.

> **WHS-018 — Inbound goods may be inspected under `SM-11`.** The QC machine governs **returned goods and inbound supplier receipts** — it *"cannot be a state of Return when it also governs Goods Receipt"* (`SM-11` scope, `E-049` parents). **Whether a given receipt is inspected under `SM-11` or resolved by the four checks alone is an operational decision, not a rule** — no answer establishes a threshold, and none is invented.

---

# 6. Warehouse QC Execution

## 6.1 Two contexts, and they are genuinely different

> **WHS-019 — The warehouse executes two QC contexts and they are not one machine used twice** (`SMA-029`, `BD-281`, closing `GAP-074`).

| Context | Where it lives | Checks |
|---|---|---|
| **Build QC** | **`QC_INSPECTION`, a stage of `SM-12`** | A new build against its template |
| **Return QC** | **`SM-11`, an independent machine** | A returned unit against what was dispatched (`BD-080`, `BD-082`) |

**`SM-11` needs no change to serve both** — `GAP-074` was resolved by separating the contexts, not by generalising the machine.

## 6.2 The six checks of `SM-11`

> **WHS-020 — Every `SM-11` inspection covers six checks** (`SM-11` §15.4, `OM §12.5` step 6): **serial verification · completeness · physical condition · functional test · packaging · tampering**.

**Serial verification is mandatory for serialized products** (`INV-49.1`, `BR-047`) — and conditional in exactly the sense `SYS-086` established: it holds in full **wherever a serial exists**, and absence is normal.

## 6.3 The quarantine gate

> **WHS-021 — Goods remain in quarantine until QC decides, and are not sellable meanwhile** (`INV-49.2`, `BR-046`, `BR-100`, `IVN-024`).

## 6.4 Disposition

> **WHS-022 — Four dispositions are established, and they apply per line, not per return** (`BD-289`, `RET-013`, `IVN-024`, `IVN-025`): **Sellable · Repair Required · Supplier Claim · Scrap**.

**One returned item may be `Sellable` while another from the same return is `Scrap`.**

> **WHS-023 — The disposition is determined at inspection but executed only after the commercial resolution is settled** (`RET-023`, `ICO-027`, `IVN-026`, `SMA-050`).

**Goods stay in QC Pending throughout.** Stock must not return to sellable inventory while a dispute is live, *"or the same unit could be sold twice over."*

> **Dispositions are not QC outcomes.** `SM-11`'s outcome states — `PASSED`, `PASSED_WITH_CONDITION`, `FAILED`, `SERIAL_MISMATCH`, `ESCALATED` — determine **which** disposition applies. **Two layers, both needed** (`BD-289`).

## 6.5 Escalation

> **WHS-024 — An inspector never resolves their own escalation** (`INV-49.4`, `PRM-006`). A serial mismatch is treated as return fraud: escalate and withhold refund (`INV-49.3`).

## 6.6 ⚠ The QC *process* is still undefined

> **WHS-025 — The QC lifecycle is specified; the QC process is not, and it is not invented here** (`GAP-045`, `SMA-014`, `DM-001`).

`DM-029` records `GAP-045` as **substantially closed** — `BD-080` defined the performer and qualification for the first time. **Two elements remain open and are carried, not filled:**

| Open | Question queued at |
|---|---|
| **Tolerances** — what degree of wear or damage separates one outcome from the next | `BD-225` |
| **Dispute path** — how a contested outcome is resolved | `BD-226` |
| **Condition grades** — `PASSED_WITH_CONDITION` has no grade vocabulary to assign | `GAP-047` |

---

# 7. Picking Execution

> **WHS-026 — `E-035` Pick Task is the instruction to collect goods from storage, and it carries the `SM-3` Fulfillment lifecycle** (`E-035`, `SM-3`).

**One pick task exists per order per warehouse** (`SM-3` §7.1).

> **WHS-027 — A pick task is never created before order release** (`INV-35.1`, `BR-019`). Release is **manual**, by a permissioned user (`BD-040`, `BR-081`).

> **WHS-028 — Every pick discrepancy creates an inventory exception** (`INV-35.2`, `BR-020`, `SYS-022`). A discrepancy moves the task to `ON_HOLD`, whose exit owner is the **Warehouse Supervisor** (`SM-3` §7.2).

⚠ **A vocabulary collision the discovery flagged explicitly.** *"Release"* means two opposite things and they sit on opposite sides of the manual/automatic divide (`BD-279`):

| *Release* | Meaning | Mode |
|---|---|---|
| Order **release** to the warehouse | Authorising fulfilment to begin | **Manual** — a permissioned user decides |
| Reservation **release** on cancellation | Freeing committed stock | **Automatic** — no decision, no queue |

**Recorded so requirements written in business language are not mapped to the wrong mechanism.**

---

# 8. Serial Capture Execution

> **WHS-029 — Serial capture is an execution step and never a gate. No process step may refuse to proceed for want of a serial** (`SYS-086`, `BD-265` – `BD-267`, `PRD-106`, `SMA-030`).

**`BR-022` was withdrawn** precisely because *"a blocking gate is mandatory capture by another name"*, and **`BR-021` was reclassified** from a business rule to operational latitude.

> **WHS-030 — Four capture points are established, and they are operational latitude rather than a business rule** (`SYS-086`): **goods receipt · assembly · packing · warranty and service**.

**During PC assembly the business captures serials *"for important components if needed"*** — exercised by judgement (`BD-266`).

> **WHS-031 — Where serials are captured for a fulfilment, capture completes before packing completes** (`INV-35.3`, `BR-021` as reclassified). `SM-3` expresses this as `PICKED → SERIALS_CAPTURED → PACKING`, with `PICKED → PACKING` for non-serialized lines.

> **WHS-032 — Capture and marking method are unconstrained by architecture** (`BR-091`, `SYS-076`). Manual entry, scanning, and printing a Build ID as a QR code are input and labelling affordances, not architectural decisions.

⚠ **`GAP-073` is carried.** Desktop PCs are not serialized (`BD-265`), so as-built records detect **a different model, not a different unit of the same model**. Missing and wrong components are caught at QC; **swapped-for-identical is not.** An accepted business trade-off, reduced but not closed by the mandatory Build ID (`BD-283`).

---

# 9. Packing and Dispatch Preparation

> **WHS-033 — Packing and dispatch preparation are `SM-3` stages executed by the warehouse**: `PACKING → PACKED → READY_TO_SHIP`, where `PACKED` means **sealed, labelled and weighed** (`SM-3` §7.2).

> **WHS-034 — `READY_TO_SHIP` is the **RTS** state visible in the orders list** (`SM-3`, `design-reference/02-orders-list.png`). Presentation is governed by `DESIGN_CONSTITUTION.md` §10.7 (`SYS-047`).

> **WHS-035 — Warehouse execution ends at handover or collection** (`SM-3` terminals `HANDED_OVER`, `COLLECTED`). Beyond that point the shipment belongs to `SM-4` and `DELIVERY_ARCHITECTURE.md` ✅.

**Fulfilment method determines whether a Shipment machine instance exists at all** (`SM-3`/`SM-4` §7.9) — self pickup terminates at `COLLECTED` with no shipment.

> **WHS-036 — Stock is deducted at dispatch, not at delivery and not at order confirmation** (`BR-054`). **The movement is Inventory's** (`IVN-022`, `IVN-038`); the warehouse performs the act that triggers it.

> **WHS-037 — Cancellation after packing is executed as unpack and restock** (`SM-3` transitions `PACKED → CANCELLED`, `READY_TO_SHIP → CANCELLED`; `OM §6.4`).

⚠ **`GAP-020` is carried:** `OM §6.4` covers this reversal in one sentence spanning three module boundaries, **with no specification of ordering, failure handling, or partial completion.** Not resolved here.

---

# 10. Build Execution

## 10.1 Division of the build

> **WHS-038 — Three modules divide a build and none may absorb another's part** (`DOC-005`).

| | Owns |
|---|---|
| **`PRODUCT_ARCHITECTURE.md`** | **What should go in** — Build Template, BOM, compatibility attributes, substitution groups |
| **`STATE_MACHINE_ARCHITECTURE.md`** | **What states the build passes through** — `SM-12` |
| **`WAREHOUSE_ARCHITECTURE.md`** | **The physical act of building it** |
| `INVENTORY_COSTING_ARCHITECTURE.md` | **What the build cost** (`ICO-018`) |

**`PRD-006`'s founding distinction governs the whole section:** *a build template says what should go in; an as-built record says what did.*

## 10.2 The operational flow

> **WHS-039 — `E-065` Build Job passes through six stages with two conditional skips** (`SMA-026`, `BD-281`).

| Stage | Entered when |
|---|---|
| `WAITING_FOR_COMPONENTS` | A required component is unavailable — **skipped** when all are on hand |
| `COMPONENTS_RESERVED` | Normal entry point |
| `ASSEMBLY_IN_PROGRESS` | Build under way |
| `QC_INSPECTION` | Assembly complete, unit being checked |
| `REWORK_REQUIRED` | **Only on QC failure** |
| `READY_FOR_PACKING` | **Terminal** — hands off to fulfilment |

> **WHS-074 — What `READY_FOR_PACKING` hands over depends on why the unit was built** (`BD-434`, `SMA-027`).
>
> | | **Build-to-order** | **Build-to-stock** |
> |---|---|---|
> | Handed to | **Packing/fulfilment for the originating Order** | **Warehouse stock**, until allocated or sold |
> | Available stock | **No** — allocated to that Order | **Yes** |
>
> **The finished unit is created in both cases** (`IVN-043`). **A customer-specific build is never exposed as available stock, not even momentarily** (`IVN-044`), and **never passes from components to a packed parcel without a finished-unit record** (`IVN-045`).

> **WHS-040 — `SM-12` terminates at `READY_FOR_PACKING`** (`SMA-027`). The business also named *Packed* and *Ready to Ship*; those are steps `SM-3` and `SM-1` already own, and allocating them there avoids two vocabularies for one concept (`SYS-016`) and a name collision with the existing `READY_TO_SHIP` order state (`GAP-026`).

**Nothing is lost — the same physical steps are tracked, by the machine that owns them.**

> **WHS-041 — `REWORK_REQUIRED` returns to assembly and re-enters QC, and this loop is recorded as inferred rather than stated** (`SMA-028`). The business named the state, not its exit. **Carried exactly as `SMA-028` records it.**

## 10.3 Two pauses with different owners

> **WHS-042 — A build halts for two structurally different reasons, and they must not be merged** (`BD-281`, `BD-102`, `PRD §25`).

| Pause | Waits on | Owner |
|---|---|---|
| **`WAITING_FOR_COMPONENTS`** | **Stock** | `SM-12` — the build |
| **Substitution approval pause** | **The customer** | **`Order:ON_HOLD`** — the order |

**Different owners, different exits.** Where no substitution is acceptable, the order backorders (`BD-100`) — ⚠ and **`GAP-016` is carried: backorder is confirmed real practice and remains unmodelled.**

## 10.4 Component consumption

> **WHS-043 — Components are consumed from stock at assembly, not at dispatch** (`PRD-045`). The assembled unit is not itself stock until the build completes.

✅ **`PRD-046` was DISCHARGED on 2026-08-09.** `OM §14.4` now scopes **`BR-054` to ordinary finished and sellable goods** and adds **`BR-143`** — build components are deducted **at the physical assembly or install point** — with **`BR-144`** forbidding a second deduction at dispatch. **`WHS-043` is no longer specification-ahead-of-ratification.**

## 10.5 Substitution execution

> **WHS-044 — Every substitution requires approval, regardless of substitution group** (`PRD-038` as amended, `BD-282`). The technician autonomy previously described in `PRD §24` is **withdrawn**.

> **WHS-045 — A substitution records six values** (`PRD-115`, `BD-282`): originally planned component · actually installed component · reason · **approved by** · date and time · **person who performed the substitution**.

**Approver and performer are separate fields.** This is the third of three independent instances of the same two-actor separation — discounts (`BD-275`, `PRM-053`), stock adjustments (`BD-111`), substitutions (`BD-282`).

> **WHS-046 — The customer must be informed before any substitution that changes specification, performance, brand, or **value**, and lower-specification components are never substituted without explicit customer agreement** (`BD-282`, `PRD-041` as broadened).

**"Value" is a trigger in its own right** — a substitution leaving specification identical but changing what the item is worth still requires approval.

> **WHS-047 — `E-064` Substitution Group is advisory and grants no authority** (`PRD-114`, `BD-282`). It tells a technician what *could* substitute, never what they *may* substitute without asking.

## 10.6 Compatibility

> **WHS-048 — Component compatibility warns and never blocks; final responsibility rests with the technician** (`PRD-118`, `BD-284`, `PRD-089` resolved).

> **WHS-049 — `ASSEMBLY_IN_PROGRESS` carries no compatibility precondition** (`SMA-030`). A warning does not stop a transition.

**Five rule categories are established** (`BD-284`): processor↔motherboard socket/chipset · RAM type↔motherboard · power-supply capacity · storage interface · case form factor. **The rule set is versioned reference data owned by Product** (`SYS-021`), not a business-rule engine.

## 10.7 Build identity

> **WHS-050 — Every build carries a mandatory, Trioloo-issued Build ID (Job Number); physical marking is optional** (`PRD-116`, `DM-040`, `BD-283`).

| | |
|---|---|
| **Scope** | **`ASSEMBLED` products only** — mandatory **per build**, never per product. Televisions, monitors and accessories have no Build Job and no Build ID |
| **Audience** | **Internal.** Order and invoice numbers remain the customer-facing reference |
| **Tracks** | Build progress · QC history · substitutions · technician · completion date · future warranty and service history |

> **WHS-051 — A build job executes at exactly one warehouse** (`INV-4.2`).

> **WHS-052 — Builds are single-level. A BOM line resolves directly to a stockable Inventory Product and never to another Build Template** (`PRD-034`). ⚠ **`PRDU-6` remains open** — whether sub-assemblies are ever pre-built and stocked.

> **WHS-053 — The as-built record must reflect the components actually installed, not the planned configuration** (`BD-282`, `PRD-006`, `PRD-040`). `E-062` is owned by `PRODUCT_ARCHITECTURE.md` and is **immutable** (`DB-003`, `IVN §15.1`).

## 10.8 Build cost

> **WHS-054 — Total Build Cost = Component Cost + Additional Build Costs, and the additional terms may be zero by choice** (`PRD-119`, `ICO-019`, `BD-286`). Four categories: assembly labour · workshop/production · packaging · other optional production expenses.

**The cost figure is `INVENTORY_COSTING_ARCHITECTURE.md`'s** (`ICO-018`). The warehouse supplies the fact that a build completed and what went into it.

⚠ **`PRD-123` is carried: reported margin on assembled products is knowably incomplete**, because additional build costs may be zero and freight and duty are period expenses (`PRD-121`). **A chosen zero is not an unknown** and does not violate `SYS-034` (`BD-286`, `DB-005`).

---

# 11. Stock Count Execution

## 11.1 The split — `DOC-058`

> **WHS-055 — Warehouse owns performing the count; Inventory owns the adjustment records it produces** (`DOC-058`, `IVN-018`, `IVN §26.1`).

**Without this split a count would have two owners at the point where it changes a stock figure.**

## 11.2 Counting is event-driven

> **WHS-056 — There is no mandatory periodic stock count. Counting is triggered by circumstance** (`BR-103`, `BD-292`): a suspected mismatch · before purchasing · before large sales · at management review · at any time the business decides.

> **WHS-057 — Both full and partial counts are supported** (`BD-292`, `BR-103`).

> **WHS-058 — `E-067` Stock Count exists only when the business initiates a counting process. It is not created daily, not scheduled, and not maintained continuously** (`IVN-020`, `DM-039`, `BD-292`).

**Episodic, low-volume event data** — closer in shape to `E-049` QC Inspection than to `E-035` Pick Task. **Nothing polls it, nothing ages it, and its absence is the normal state.**

## 11.3 What a count produces

> **WHS-059 — A count difference is recorded through a stock adjustment carrying six values** (`BD-292`, `BD-111`, `IVN-018`): **actual quantity · system quantity · difference · reason · approved by · date and time**.

**Recording all three quantities means the pre-adjustment figure survives inside the correction** — `DB-026` expressed as fields rather than as a principle.

> **WHS-060 — Stock figures are never changed directly** (`BD-292`, `IVN-019`, `BR-103`, `WHS-005`).

## 11.4 ⚠ The count lifecycle is open

> **WHS-061 — `E-067`'s lifecycle is unspecified and is not invented here** (`GAP-076`, `DM-039`, `DM-001`).

The business described **what a count produces**, not the states it passes through. `DM-039` registers this as *"Unspecified — open by ratified decision."* **Carried.**

---

# 12. Scrap and Component Recovery Execution

> **WHS-062 — Partial Scrap and Full Scrap are different operations** (`BD-291`, `BR-102`).

| | Physical outcome |
|---|---|
| **Partial Scrap** | Only some components are unusable. **Reusable parts are recovered and returned to inventory if they pass inspection.** Only scrapped components are written off |
| **Full Scrap** | The entire unit is unusable. **Nothing returns to sellable inventory** |

> **WHS-063 — Recovered components re-enter stock through inspection, not directly** (`BD-291`). The recovery leg passes the **same QC Pending gate** as any returned goods — *recovered parts are not trusted straight back onto the shelf.* **No new mechanism is required; the existing quarantine path serves it.**

> **WHS-064 — Partial scrap of an assembled unit resolves its recoverable components through the As-Built Record** (`PRD-120`, `DM-043`, `BD-291`), reachable via the Build ID. **A fourth independent use of `E-062`**, unanticipated and supported without structural change.

> **WHS-065 — A scrap record carries five values** (`BD-291`): **scrap reason · approved by · date and time · estimated loss value · recoverable parts** (partial scrap only).

> **WHS-066 — Scrapped inventory must not simply disappear from stock** (`BD-291`, `BR-102`, `DB-001`). Scrap is a **recorded movement**, never a silent decrement.

> **WHS-067 — Scrap posts an accounting loss, partial or full** (`ACC-025`, `ICO-029`, `BR-102`). **The posting is Accounting's**; the warehouse supplies the physical fact and the estimated value.

> ⚠ **"Estimated" is the business's own word** (`BD-291`). An estimated value is a **known approximation, not an unknown**, and must not be recorded as zero (`BR-007`, `SYS-034`, `DB-005`).

---

# 13. Custody — Goods the Business Does Not Own

## 13.1 The absolute rule

> **WHS-068 — The warehouse may physically hold goods the business does not own, and such goods are never inventory, in any state** (`SYS-103`, `IVN-033`, `DOC-058`).

**Three cases are established, all independently:**

| Case | Established |
|---|---|
| A trade-in item **shipped before agreement** | `INV-81.1` |
| A customer's unit **received for warranty or repair** | `E-072`, `IVN §14.1` |
| **Unclaimed property** after a declined trade-in | `INV-81.4` — **and it never becomes inventory** |

> **The prohibition is absolute because the exposure is legal rather than accounting.** Taking another party's property into inventory without transfer is **not an error that reverses** — `CP-8`'s irreversibility axis. `ICO-006` reinforces it structurally: an item with no acquisition cost cannot enter inventory, and customer property has none.

## 13.2 Where the custody state lives

> **WHS-069 — The custody state belongs to the owning process, not to Warehouse and not to Inventory** (`DOC-058`, `SMA-071`).

> **WHS-073 — An authorised warranty replacement is picked, verified and handed over through the warehouse's existing controlled process** (`BD-426`, `EVT-091`). **No warranty-specific picking, QC or handover process exists or is created** — `WHS-026` – `WHS-037` already govern it, and `SM-11` QC applies where inspection is required.
>
> **What is warranty-specific is the trigger, not the process.** Inventory reserves the unit at authorisation (`IVN-040`, `EVT-039`) and deducts it at physical handover (`EVT-041`); **Warehouse performs the movement between those two points and owns neither figure** (`DOC-057`, `DOC-058`).

| Custody of | State carried by |
|---|---|
| A trade-in item | **`E-081` Trade-In Case** — an **overlay**, not a state (`SMA-071`); owned by [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) |
| A unit under repair or warranty | **`E-072` Repair** |

**The physical return of declined property is a custody-out movement, not a sales return** (`BD-395`).

## 13.3 ⚠ No dedicated location type is established

**`E-005`'s six location types do not include one for customer property.** Whether custody goods occupy Quarantine, a distinct position, or an unmodelled area **is not stated in any ratified source, and is not invented here** (`DM-001`).

⚠ **`GAP-090` is carried and is the inverse case:** a **loaner** is stock *owned but physically absent*. `IVN-012` covers three *present-but-not-sellable* conditions; this is the mirror image, and **an untracked loaner reads as missing stock at the next count** (`BD-292`) and is investigated as a discrepancy that was never one.

---

# 14. Warehouse Responsibilities versus Inventory Responsibilities

> **WHS-070 — The division is *the act* versus *the record of the act*** (`IVN §26`, `DOC-058`).

| Warehouse owns | Inventory owns |
|---|---|
| Location topology and location types | The **stock position** each operation produces |
| **Goods receipt execution** and its four checks | The movement that acceptance creates |
| **Pick and pack operations** | The deduction at dispatch |
| **QC execution** — inspector, checks, outcome | **Dispositions as inventory outcomes** |
| **Count execution** | **The adjustments a count produces** |
| **Serial capture execution** | Serial records and unit history |
| **Build execution** | The component consumption and finished-unit movements |
| **Physical custody of goods not owned** | The rule that such goods are never inventory |

**Neither module owns cost** (`ICO-000`) **or postings** (`ACC-011`).

---

# 15. Execution Boundaries with Adjacent Modules

| Module | The warehouse supplies | The module owns |
|---|---|---|
| **Order Management** | Fulfilment execution against a released order | Order lifecycle, release authority (`BR-081`), amendment window (`BR-082`), verification gate |
| **Inventory** | The physical event behind every movement | Quantity, availability, the movement ledger, not-sellable conditions (`IVN-012`) |
| **Inventory Costing** | The fact that a build completed and what was consumed | Cost derivation, WAC, cost immutability (`ICO-030`) |
| **Accounting** | The scrap fact and its estimated value | **Every posting** (`ACC-011`), including the inventory loss (`ACC-025`) |
| **Product** | Execution against a Build Template; the as-built content | Build Templates, BOM, compatibility attributes, `E-062`, serialization policy |
| **Procurement** | **Line-level acceptance** — the fact that drives the payable | Supplier master, purchase orders, payable, supplier resolution routes |
| **Return & Exchange** | QC execution and disposition **performance** | Return/exchange lifecycles, eligibility, **entitlement to a disposition** (`RET-018`, `RET-023`) |
| **Delivery** | Goods packed and ready at `READY_TO_SHIP` | Shipment, courier handover, tracking, delivery outcome |
| **State Machine Architecture** | Execution of transitions | **All state and transition definitions** (`SM-3`, `SM-11`, `SM-12`) |

---

# 16. Entity References

| Entity | ID | Role here |
|---|---|---|
| **Warehouse** | **`E-004`** | The unit at which availability, allocation, assembly and fulfilment are determined |
| **Stock Location** | **`E-005`** | Position and sellability; six established types |
| **Pick Task** | **`E-035`** | The fulfilment subject — `SM-3` |
| **QC Inspection** | **`E-049`** | The inspection subject — `SM-11` |
| **Build Job** | **`E-065`** | The assembly subject — `SM-12`; carries the Build ID |
| **Stock Count** | **`E-067`** | Episodic; produces adjustments |
| Goods Receipt | `E-030` | Line-level acceptance; **no lifecycle** (`SMA-034`) |
| Purchase Order Item | `E-066` | Line-level acceptance and pending status |
| As-Built Record | `E-062` | **Immutable**; owned by `PRODUCT_ARCHITECTURE.md` |
| Substitution Group | `E-064` | **Advisory only** (`PRD-114`) |
| Stock Reservation | `E-027` | **No lifecycle of its own** (`DM-041`, `SMA-031`) |
| Repair · Trade-In Case | `E-072` · `E-081` | Carry the custody state (`WHS-069`) |
| Exception | `E-056` | Pick discrepancies raise one (`WHS-028`) |

**No entity is defined here.** `DOMAIN_MODEL.md` is canonical (`DOC-005`).

**Warehouse's registered entity set** is `E-004`, `E-005`, `E-035`, `E-049`, `E-062`, `E-065` (`DOMAIN_MODEL.md` §18), with `E-067` added at `DM-039`.

---

# 17. State Machine References

| Machine | Subject | Status |
|---|---|---|
| **`SM-3`** Fulfillment | `E-035` | ✅ **Ratified 2026-08-09** into `OM §18.2` (`BR-142`); previously a proposed extension (`SMA-001`) |
| **`SM-11`** QC | `E-049` | ✅ **Ratified 2026-08-09** into `OM §18.2` (`BR-142`); previously a proposed extension (`SMA-001`) |
| **`SM-12`** Build Job | `E-065` | **Ratified** — twelfth machine (`SMA-026`) |
| `SM-7` Inventory | `E-021`, `E-026` | Observed; owned by Inventory |
| `SM-15` Repair | `E-072` | Observed; one entry point is a return QC disposition (`SMA-044`) |
| `SM-19` Trade-In Component | `E-082` | Observed; classification gates inventory creation — owned by [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) |

**No machine is defined here**, and **no machine was ratified here.** `SMA-011` required an `OM §18.2` and §18.3 amendment before `SM-3` and `SM-11` were settled; **that amendment was made on 2026-08-09 in `ORDER_MANAGEMENT_ARCHITECTURE.md`, not in this document.**

⚠ **`GAP-026` applies.** `RECEIVED`, `CANCELLED`, `ON_HOLD` and `READY_TO_SHIP`-family names recur across machines; **machine-qualified state naming is required, not merely advisable** (`SMA-047`, `DM-002`).

---

# 18. Audit and Permission

| Requirement | Rule |
|---|---|
| **Every warehouse operation attributable to an Operational User Profile** | `WHS-006`, `AGV-001`, `AUD-004` |
| **Stock adjustments carry a mandatory reason and approval** | `WHS-059`, `IVN-018`, `AUD-042` |
| **Scrap carries reason, approver, timestamp and estimated value** | `WHS-065`, `AUD §12.2` |
| **Substitutions record approver and performer separately** | `WHS-045`, `PRD-115` |
| **Build history is transition history, not merely current state** | `BD-281`, `AUD-013`, `AUD-014` |
| **An inspector never resolves their own escalation** | `WHS-024`, `PRM-006` |
| Movements are permanent and never edited | `IVN-016`, `WHS-005` |

> **WHS-071 — No Assembly Supervisor role is created** (`DM-039`, ratified simplification). Owner, Administrator, or an authorised technician may perform or approve the responsibility.

⚠ **`BD-284` named an *"assembly supervisor"* and `PRD §24` names a *"warehouse supervisor"*; whether they are the same role is not stated.** `DM-039` resolves this by **creating neither**. Recorded as consolidated, not as an open question.

> **WHS-072 — No new party entity is created for an external service provider** (`DM-039`). An authorised service centre is a **repair counterparty**; `E-025` Supplier serves where a formal relationship exists.

⚠ **`PRMU-8` is carried** — whether `PRM-008`'s magnitude bounds on stock adjustment and write-off are **enforced numbers** or follow the discount pattern of *who decides, not how much* (`PRM-052`).

**Scope.** `PRM-064` establishes **Warehouse** as a scope dimension; scope bounds who may see and act, and **does not divide the stock pool** (`IVN-023`, `AGV-021`). ⚠ `BD-377` records that most users currently work across all channels — the model is **designed for growth and deliberately not enforced today** (`PRM-051`).

---

# 19. Notification Integration

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.** This module raises these obligations against it:

| Obligation | Category | Source |
|---|---|---|
| **Receiving discrepancy awaiting supplier resolution** | **Action Required** | `BR-110`, `IVN §23` |
| A component pending classification, blocking a Trade-In | **Action Required** | `SMA-073`, `NOT-023` |
| **Low Stock** | **Ongoing Condition** — evaluated, not stored; restocking clears it | `NOT-013`, `IVN §23` |

**Low Stock is a query over current state, not an event** — it cannot be missed, because it is never delivered as a moment.

---

# 20. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing on warehouse execution |
|---|---|---|
| **`GAP-045`** | 🔴 Critical — **substantially closed** | **QC tolerances and dispute path remain open** (`BD-225`, `BD-226`). Performer and qualification are defined (`DM-029`); the rest is not (§6.6) |
| **`GAP-047`** | 🟡 Medium | **Condition grade vocabulary undefined** — `PASSED_WITH_CONDITION` has no grade to assign (§6.6) |
| **`GAP-076`** | 🟡 Medium | **`E-067` Stock Count lifecycle unspecified** — left open by ratified decision (§11.4) |
| **`GAP-016`** | 🟡 Medium | **Backorder is confirmed real practice and remains unmodelled** (§10.3) |
| **`GAP-026`** | 🟡 **Escalated** | **State-name collision** — machine-qualified naming now required (§17) |
| **`GAP-020`** | 🟠 High | **Process reversal is unspecified** — unpack, restock and void span three modules in one sentence (§9) |
| **`GAP-019`** | 🟠 High | **Transition trigger classification incomplete** — release is manual (`BR-081`); closure, reconciliation and RTO creation still unstated (§7) |
| **`GAP-024`** | 🟡 Medium | **No state has a documented ageing threshold** — including `ON_HOLD` on `SM-3` and `WAITING_FOR_COMPONENTS` on `SM-12` |
| **`GAP-073`** | 🟡 Medium | **A substituted component of the same model is undetectable** — accepted exposure, reduced by the Build ID (§8) |
| **`GAP-090`** | 🟢 Low | **Loaner treatment — owned but physically absent.** Reads as missing stock at the next count (§13.3) |
| **`GAP-103`** | 🔴 High | **Teardown has no counterpart to assembly.** `SM-12` builds many components into one product; **nothing disassembles.** The warehouse would perform the operation and has no lifecycle for it |
| **`GAP-077`** | 🟢 Low | **Inventory-loss posting home.** Recorded when Accounting was unwritten; `ACC-025` now states the posting. **Formal closure is a `GAP_ANALYSIS.md` decision and is not made here** |
| **`PRDU-6`** | — | Whether sub-assemblies are ever pre-built and stocked (§10.7) |
| **`PRMU-8`** | — | Whether stock-adjustment magnitude bounds are enforced numbers (§18) |
| **`GAP-001`** | 🔴 Critical | Module documents remain unwritten. **This document reduces the count by one** |

**No gap is closed by this document, and none is newly discovered.**

---

# 21. Traceability

## 21.1 Business Decisions consumed

| BD | Contributes |
|---|---|
| `BD-278` | Reservation at order confirmation · **two fulfilment paths, one order system** |
| `BD-279` | Automatic release on cancellation or expiry · reservation has no lifecycle |
| `BD-280` | Published stock may exceed physical — **must not be prevented** |
| `BD-281` | **`SM-12` eight business stages** · build QC distinct from return QC |
| `BD-282` | **Every substitution requires approval** · six recorded values · `E-064` narrowed |
| `BD-283` | **Mandatory Build ID**, internal, marking optional |
| `BD-284` | **Compatibility warns, never blocks** · five rule categories |
| `BD-285` | Available = Ready-built + Buildable |
| `BD-286` | **Total Build Cost = Component + Additional**, optionally zero |
| `BD-287` | **Line-level receiving** · four checks · pending-supplier condition |
| `BD-288` | Payable follows acceptance · three-value discrepancy vocabulary |
| `BD-289` | **QC Pending is quarantine** · four dispositions |
| `BD-290` | Repair performers · cost bearer · parts consumption |
| `BD-291` | **Partial and Full Scrap** · recovery through inspection · inventory loss |
| `BD-292` | **Event-driven counting** · full and partial · adjustment fields · `E-067` |

**Prior coverage consumed:** `BD-080` – `BD-082`, `BD-092`, `BD-093`, `BD-097`, `BD-098` – `BD-106`, `BD-111`, `BD-225`, `BD-226`, `BD-265` – `BD-267`, `BD-296`, `BD-299`, `BD-303`, `BD-325`, `BD-377`, `BD-388` – `BD-395`.

## 21.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `BR-019` – `BR-022`, `BR-046`, `BR-047`, `BR-054`, `BR-081`, `BR-082`, `BR-091`, `BR-096` – `BR-113` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `PRD-006`, `PRD-034`, `PRD-038`, `PRD-040` – `PRD-046`, `PRD-089`, `PRD-106`, `PRD-114` – `PRD-124` | `PRODUCT_ARCHITECTURE.md` |
| `IVN-004`, `IVN-005`, `IVN-012` – `IVN-026`, `IVN-033`, `IVN-038` | `INVENTORY_ARCHITECTURE.md` |
| `ICO-006`, `ICO-018`, `ICO-019`, `ICO-027`, `ICO-029`, `ICO-030`, `ICO-033` | `INVENTORY_COSTING_ARCHITECTURE.md` |
| `ACC-011`, `ACC-025` | `ACCOUNTING_ARCHITECTURE.md` |
| `RET-013`, `RET-018`, `RET-023`, `RET-025` | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `SM-3`, `SM-11`, `SM-12`, `SMA-001`, `SMA-011`, `SMA-014`, `SMA-026` – `SMA-034`, `SMA-047`, `SMA-050`, `SMA-071`, `SMA-073` | `STATE_MACHINE_ARCHITECTURE.md` |
| `E-004`, `E-005`, `E-035`, `E-049`, `E-062`, `E-064` – `E-067`, `INV-4.1` – `INV-4.3`, `INV-35.1` – `INV-35.3`, `INV-49.1` – `INV-49.4`, `INV-81.1`, `INV-81.4`, `DM-001`, `DM-002`, `DM-029`, `DM-039` – `DM-044` | `DOMAIN_MODEL.md` |
| `SYS-004`, `SYS-005`, `SYS-015`, `SYS-016`, `SYS-021`, `SYS-022`, `SYS-024`, `SYS-034`, `SYS-043`, `SYS-047`, `SYS-076`, `SYS-086`, `SYS-102`, `SYS-103`, `CP-3`, `CP-8`, `CP-12` | `SYSTEM_ARCHITECTURE.md` |
| `DB-001`, `DB-003`, `DB-005`, `DB-026`, `DB-028`, `DB-077` | `DATABASE_ARCHITECTURE.md` |
| `PRM-005`, `PRM-006`, `PRM-008`, `PRM-051`, `PRM-052`, `PRM-064`, `AGV-001`, `AGV-021` | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `AUD-004`, `AUD-013`, `AUD-014`, `AUD-042` | `AUDIT_ARCHITECTURE.md` |
| `NOT-013`, `NOT-023` | `NOTIFICATION_ARCHITECTURE.md` |
| `DOC-005`, `DOC-057`, `DOC-058` | `MASTER_DOCUMENTATION_INDEX.md` |

## 21.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`PRD-038` amended** — all substitutions require approval; `PRD §24` technician autonomy withdrawn | `WHS-044` |
| **`PRD-041` broadened** — *value* is a substitution-approval trigger | `WHS-046` |
| **`E-064` narrowed to advisory** | `WHS-047` |
| **`BR-022` withdrawn, `BR-021` reclassified** — no serial gate anywhere | `WHS-029` |
| **`BR-052` amended** — reservation at order confirmation, not release | `WHS-027` context |
| **Build ID mandatory only for custom-built desktop PCs** | `WHS-050` |
| **Stock Count is episodic**, not a daily operational entity | `WHS-058` |
| **No Assembly Supervisor role and no service-centre party entity created** | `WHS-071`, `WHS-072` |

---

---

# 21A. Order-Specific Build Configuration — ratified 2026-08-11

**Source:** business decision 2026-08-11 resolving **`GAP-129`** by **Option C**, routed under `DOC-079`. **Entities `E-103` and `E-104` are registered in `DOMAIN_MODEL.md` and are Warehouse-owned by `DM-081`.**

## 21A.1 What it is, and what it is not

> **WHS-075 — ✅ AN ORDER-SPECIFIC BUILD CONFIGURATION IS A BUILD SPECIFICATION THAT IS AUTHORITATIVE FOR ONE ORDER AND NOTHING ELSE.**
>
> **It exists so the business can assemble and fulfil a configuration for which no applicable reusable Build Template version exists** — **without creating a catalogue entry to make it possible.**
>
> | It IS | It is NOT |
> |---|---|
> | A confirmed component plan for **one** Order Item's build requirement | A `E-058` Sellable Product |
> | The specification an `E-065` Build Job may execute | A `E-059` Channel Listing |
> | Non-reusable by default | A reusable `E-060` Build Template |
> | Warehouse-owned (`DM-081`) | An `E-062` As-Built Record |
> | | An inventory movement, a stock balance or an accounting record |
>
> 🔴 **It creates no catalogue entry.** **Completing an assembled order NEVER adds a product to the Sellable Product catalogue** — that requires explicit promotion (`PRD-147`).

## 21A.2 The two specification sources

> **WHS-076 — ✅ A BUILD JOB EXECUTES EXACTLY ONE IMMUTABLE SPECIFICATION SOURCE, FIXED AT JOB CREATION** (`INV-65.1` as amended).
>
> | Source | Path |
> |---|---|
> | **A** — a fixed reusable **Build Template version** | Order Item → Sellable Product → ACTIVE Build Template version → Build Job |
> | **B** — a fixed confirmed **`E-103`** | Order Item → confirmed Order-Specific Build Configuration → Build Job |
>
> 🔴 **NEVER BOTH SIMULTANEOUSLY.** ✅ **Path A is unchanged and remains the normal path for a catalogued `ASSEMBLED` Sellable Product** — **path B is an ADDITIONAL legitimate source, not a replacement.**
>
> 🔴 **Fixing is absolute in both directions:** **a later Build Template version never reaches a job already bound to an earlier one** (`PRD-071`), **and a later configuration never reaches a job already bound to an earlier one** (`INV-103.5`). ⚠ **A recommendation changing after confirmation reaches nothing at all** — it was never authoritative (`WHS-077`).

## 21A.3 Draft, confirmation and authority

> **WHS-077 — 🔴 A DRAFT CONFIGURATION IS NOT AUTHORITATIVE. ONLY EXPLICIT CONFIRMATION MAKES IT SO.**
>
> **A draft — however it was produced, including by the recommendation engine (`PRD-146`) — reserves no stock, consumes no stock, authorises no assembly, binds no Build Job, creates no mapping and creates no product.**
>
> **a.** **Confirmation is the `DRAFT → ACTIVE` transition** (`INV-103.3`) **and is attributable to an Operational User Profile** (`AGV-001`, `AUD-004`).
> **b.** ✅ **Before confirming, staff may accept the draft, replace components, add or remove lines, start from a different reusable template, or construct the configuration manually** — **subject to the authority rules below and to compatibility guidance, which WARNS and never blocks** (`PRD-118`).
> **c.** 🔴 **A confirmed configuration is IMMUTABLE** (`INV-103.4`, `DB-003`). **A different plan is a NEW configuration and the earlier one becomes `SUPERSEDED`** — **the mechanism `PRD-069` already applies to templates, reused rather than duplicated.**
> **d.** ⚠ **AUTHORITY IS NOT FULLY DETERMINED BY CANON AND IS NOT INVENTED HERE.** **`PRD §24` establishes assembly-side component authority** — **substitution within a group: warehouse technician; substitution outside a group: warehouse supervisor, with a recorded reason** (`PRD-039`). 🔴 **Whether confirming an `E-103` requires the supervisor bound, and whether a separately grantable capability is required, is NOT canonically established** — **recorded as `GAP-130`, not decided** (`PRM-007`, `DOC-024`).

## 21A.4 Execution is unchanged

> **WHS-078 — ✅ ONCE A BUILD JOB IS BOUND, EVERY EXISTING WAREHOUSE, INVENTORY AND COSTING RULE APPLIES UNCHANGED.**
>
> **Component reservation stays atomic** (`INV-65.2`, `PRD-026`) · **components are consumed at assembly, not at dispatch** (`INV-65.3`, `PRD-045`, `BR-143`) · **substitution DURING execution remains governed by `PRD-038`–`PRD-041` and is recorded on the As-Built** · **the As-Built Record is produced per unit** (`INV-65.5`) **and accounts for every non-optional line of whichever source was executed** (`INV-62.2`, `PRD-088` as amended).
>
> 🔴 **NO NEW STOCK MECHANISM IS CREATED.** **No new movement type, no new ledger, no stored balance, no costing rule and no accounting entry** (`IVN-017` — *no movement type exists outside this set*, `DB-001`, `ICO-000`).

## 21A.5 As-Built remains historical truth

> **WHS-079 — 🔴 AN AS-BUILT RECORD IS NEVER REWRITTEN BY ANYTHING THAT HAPPENS AFTERWARDS.**
>
> **Not by a changed recommendation, not by a superseded configuration, not by a later Build Template version, not by a later listing mapping, not by a change to a Sellable Product, and not by promotion of the configuration to reusable form** (`INV-62.4`, `DM-008`, `DB-003`, `PRD-068`).
>
> ⚠ **This is why `INV-103.7` retains a superseded configuration permanently: it is the specification an As-Built was measured against, and discarding it would make a historical build unreproducible.**

---

## 21A.6 Authority — ratified 2026-08-11, resolving `GAP-130`

> **WHS-080 — ✅ FIVE CAPABILITIES, AND THEY ARE NOT AUTOMATICALLY THE SAME.**
>
> | | Capability | Governed by |
> |---|---|---|
> | **A** | **View recommendation evidence** | Access to the owning operational workspace — no separate capability |
> | **B** | **Prepare and edit a `DRAFT` `E-103`** | Authority to prepare the relevant order/build |
> | **C** | **Confirm `DRAFT → ACTIVE`** | **`WHS-081`** |
> | **D** | **Substitute components during assembly** | **`PRD-038`–`PRD-041`, unchanged** |
> | **E** | **Promote a configuration to reusable catalogue definition** | **`PRD-147`, Product administration** |
>
> 🔴 **Holding one confers none of the others.** ⚠ **A person who may confirm a configuration does NOT thereby receive unlimited execution-time substitution authority, and a person who may substitute during assembly does NOT thereby receive confirmation authority.**
>
> **a. VIEWING GRANTS NOTHING.** **A user with legitimate access to the owning workspace may see the recommendation evidence that work requires.** 🔴 **Viewing implies no authority to confirm, reserve, execute, substitute, create a Sellable Product or activate a Build Template version.** ⚠ **No standalone recommendation-viewer role exists and none is created.**
>
> **b. PREPARATION IS NOT APPROVAL.** **Operational staff authorised to prepare the relevant order or build may create and edit a `DRAFT`.** 🔴 **While `DRAFT` it is non-authoritative, reserves nothing, cannot become a Build Job source, cannot consume stock, cannot authorise assembly and posts nothing** (`INV-103.2`, `WHS-077`, `IVN-054.b`). ✅ **Recommendation output remains editable evidence throughout.**

> **WHS-081 — ✅ CONFIRMING AN ORDER-SPECIFIC BUILD CONFIGURATION REQUIRES WAREHOUSE SUPERVISOR AUTHORITY, OR AN EXPLICITLY GRANTED EQUIVALENT CAPABILITY. Ratified 2026-08-11 by business decision** (`GAP-130`).
>
> **`DRAFT → ACTIVE` is an authoritative operational approval, because an `ACTIVE` configuration may enter reservation and build execution** (`WHS-076`, `IVN-054`, `BR-177`).
>
> **a.** 🔴 **PREPARATION AUTHORITY NEVER IMPLIES CONFIRMATION AUTHORITY.** **A technician or order-preparation user does not acquire it by being able to edit the draft.** ⚠ **This is the same separation `PRD-039` already draws between substituting inside a group and substituting outside one** — **the person doing the work is not automatically the person approving its scope.**
>
> **b.** 🔴 **ENFORCEMENT IS A PERMISSION, NEVER A ROLE NAME.** **The unit of enforcement is a capability resolved through the four-part composition — Operational User Profile + Assigned Roles + Scope Assignments + Permission Overrides** (`AGV-018`, `PRM-057`). ⚠ **`Warehouse Supervisor` is a BASELINE ROLE that carries the capability by configuration; it is not the security rule.** 🔴 **A role-name test is prohibited** (`PRM-004` — authorisation is enforced by the module that owns the action, on every entry point).
>
> **c.** ✅ **The capability is grantable to another actor WITHOUT granting the whole role** — that is precisely what `AGV-023`'s grant direction exists for. ⚠ **And revocable the same way, which is what prevents role proliferation.**
>
> **d.** 🔴 **ADMINISTRATOR RECEIVES NOTHING IMPLICITLY.** **`PRM-068` — Administrator is a role holding permissions, never a mode that suspends checking.** **An Administrator confirms a configuration only where effective permissions actually grant the capability** (`AGV-018`, `PRM-003` — absence of a grant is a denial). **No hidden superuser, no title shortcut.**
>
> **e.** ⚠ **SCOPE BOUNDS; IT NEVER GRANTS** (`AGV-021` — *permissions define WHAT, scope defines WHERE*). 🔴 **A Warehouse scope assignment is not a substitute for the capability, and scope dimensions that `PRM-051`/`BD-377` record as not operationally enforced today are not activated by this rule.**
>
> **f.** 🔴 **THE RECOMMENDATION ENGINE MAY NEVER CONFIRM.** **It produces evidence and nothing else** (`PRD-146`). ⚠ **Automated actors ARE actors and carry identity, permissions and audit** (`AGV-001`, `PRM-005`) — **but no automated actor is granted this capability in V1, and autonomous confirmation is not introduced.** **Future automation would require separately granted canonical authority and is outside this amendment.**

> **WHS-082 — ✅ CONFIRMATION IS ATTRIBUTABLE, AND NO NEW AUDIT MECHANISM IS CREATED.**
>
> **The authoritative record preserves WHO confirmed and WHEN** — already required by `INV-103.3` and carried by the existing attribution architecture (`AGV-001`, `AUD-004`, and `E-103`'s confirmation actor and timestamp attributes).
>
> 🔴 **NO REASON IS REQUIRED FOR ORDINARY CONFIRMATION, AND NONE IS INVENTED HERE.** ⚠ **`PRD-039` requires a reason for substitution OUTSIDE an approved group and `IVN-018` requires one for a stock adjustment — those obligations are untouched and neither is extended to confirmation** (`DOC-024`).
>
> ✅ **No duplicate audit infrastructure, no activity log substituting for canonical audit facts** (`AUD-001`).

> **WHS-083 — 🔴 ASSEMBLY-TIME SUBSTITUTION AUTHORITY IS UNCHANGED BY THIS AMENDMENT.**
>
> **`PRD-038`–`PRD-041` stand exactly as written:** **within an approved substitution group, existing technician authority applies; outside one, warehouse supervisor authority plus a mandatory recorded reason applies** (`PRD-039`), **every substitution is recorded on the As-Built with intended and actual component** (`PRD-040`), **and a substitution changing the advertised specification still requires customer agreement before dispatch** (`PRD-041`).
>
> 🔴 **Confirming an `E-103` grants no broader substitution authority at execution time**, **and holding substitution authority grants no confirmation authority** (`WHS-080`).

---

# 22. Version History

| Version | Date | Change |
|---|---|---|
| **1.4.1** | **2026-08-09** | **`WHS-043`'s ratification caveat withdrawn — no rule changed.** `PRD-046` was discharged when `OM §14.4` was amended (`BR-143`, `BR-144`), so **consumption at assembly is now fully ratified** and `WHS-043` stands without qualification |
| **1.4.0** | **2026-08-09** | **`WHS-074` added — what `READY_FOR_PACKING` hands over, from `BD-434`.** The terminal stage hands a **build-to-order** unit to **packing for its originating Order** and a **build-to-stock** unit to **warehouse stock** — **the finished unit is created in both cases**, and only availability differs (`IVN-043`). **A customer-specific build is never exposed as available stock even momentarily** (`IVN-044`). **`WHS-039` – `WHS-045` are unchanged**, and no state, transition or QC boundary moved |
| **1.3.0** | **2026-08-09** | **One cross-reference added — `WHS-073`; no process, rule or boundary changed.** `EVT-091 Warranty.ReplacementAuthorised` names Warehouse as a consumer, whose confirmed reaction is *“the applicable controlled process for picking, required QC/verification, and handover or dispatch”* (`BD-426`). **That process already exists in full** at `WHS-026` – `WHS-037`, so **no warranty-specific process was created** — `WHS-073` records only that a warranty replacement enters the existing one, and that **the trigger is warranty-specific while the process is not.** Reservation and deduction remain Inventory's figures |
| **1.2.0** | **2026-08-09** | **Trade-In pointers corrected — no warehouse rule changed.** The `SM-19` register row and the `E-081` custody row now name [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) (`DOC-063`). **`WHS-069` is unchanged and is now reciprocated**: the custody state belongs to the owning process, and both owning processes — `E-072` Repair and `E-081` Trade-In Case — have registered documents that accept it (`WAR-060`, `TRD-028`) |
| **1.1.0** | **2026-08-09** | **`SM-3` and `SM-11` RATIFIED — status references corrected, no rule changed.** `OM §18.2` was amended to register them (`BR-142`), discharging `SMA-001`, `SMA-011` and `SMU-11`. **This document did not ratify them** and did not need to change to accommodate them: `WHS-003` and §15 carried the proposed status faithfully while it applied, and only the status wording is updated. **`SM-11`'s scope is confirmed as `SMA-045` drew it** — Return QC always, inbound supplier-receipt QC at the warehouse's discretion (`WHS-018`, *"an operational decision, not a rule"*). **No warehouse rule, state, transition or boundary changed** |
| **1.5.0** | **2026-08-11** | ✅ **ORDER-SPECIFIC BUILD CONFIGURATION — `§21A`, `WHS-075`–`WHS-079`. `GAP-129` resolved by business decision (Option C), routed under `DOC-079`.** ✅ **Warehouse becomes the owner of `E-103` and `E-104` by `DM-081`, because it already owns the WORK (`E-065`) and the EVIDENCE (`E-062`) that this specification sits between.** ✅ **`WHS-076` fixes exactly ONE immutable specification source per Build Job — a reusable Build Template version OR a confirmed configuration, never both — with the reusable path explicitly unchanged and the new path ADDITIONAL rather than a replacement.** 🔴 **`WHS-077` makes a draft non-authoritative in every respect and confirmation an attributable act; a confirmed configuration is immutable and is replaced by supersession, reusing `PRD-069`'s mechanism rather than inventing revision semantics.** ⚠ **`WHS-077.d` records that the exact confirmation AUTHORITY is not canonically established and registers `GAP-130` rather than inventing a permission.** ✅ **`WHS-078` keeps every execution rule unchanged and creates no stock mechanism; `WHS-079` restates As-Built immutability against six specific later events.** **No movement type, ledger, balance, costing rule, accounting entry, event or permission code created.** |
| **1.6.0** | **2026-08-11** | ✅ **`GAP-130` RESOLVED — confirmation authority for `E-103`. `§21A.6`, `WHS-080`–`WHS-083`, routed under `DOC-079`.** ✅ **`WHS-080` separates FIVE capabilities — viewing evidence, preparing a draft, confirming, substituting at assembly, and promoting to catalogue — and records that holding one confers none of the others.** ✅ **`WHS-081` makes `DRAFT → ACTIVE` require WAREHOUSE SUPERVISOR authority or an explicitly granted equivalent capability, because an `ACTIVE` configuration may enter reservation and build execution.** 🔴 **Enforcement is a PERMISSION resolved through `AGV-018`'s four-part composition, NEVER a role-name test — `Warehouse Supervisor` is a baseline role carrying the capability by configuration, not the security rule.** 🔴 **Administrator receives nothing implicitly** (`PRM-068`, `PRM-003`); **scope bounds but never grants** (`AGV-021`); **the recommendation engine may never confirm, and no automated actor is granted the capability in V1.** ✅ **`WHS-082` reuses existing attribution — who and when — and creates no audit mechanism; 🔴 NO reason is invented for ordinary confirmation, and `PRD-039`/`IVN-018`'s reason obligations are neither weakened nor extended.** 🔴 **`WHS-083` leaves `PRD-038`–`PRD-041` exactly as written: confirmation grants no execution-time substitution authority and substitution authority grants no confirmation authority.** ⚠ **The literal permission-code string remains UNDEFINED — no canonical vocabulary generates it, and implementation must not invent one** (`PRM-007`). **No entity, event, state, inventory rule, costing rule or accounting rule created or changed.** |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §17 Warehouse & Assembly (`BD-278` – `BD-292`) with the reconciliations at `OM §9.9`, `PRD §29`, `SMA §19.4` and `DOMAIN_MODEL.md` `DM-039` – `DM-044`. **73 rules (`WHS-000` – `WHS-072`), all traceable; no business rule, entity, state machine or lifecycle introduced.** `WHS-000` records the ownership boundary; **`DOC-058`'s stock-count split and custody boundary are consolidated at §11 and §13**. **`WHS-001` and `WHS-009` record that bin locations, wave picking and multi-warehouse operation were excluded from discovery by the business and are not reconstructed.** **`SM-3` and `SM-11` are carried as unratified proposed extensions** (`SMA-001`) — this document does not ratify them. Fifteen open items carried; `GAP-045`, `GAP-047`, `GAP-076`, `GAP-103` and `PRDU-6` explicitly not converted into rules |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies warehouse operational business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
