# Documentation Gap Analysis

**Owner:** Trioloo Technology · **Type:** Documentation completeness audit · **Status:** Findings
**Version:** 2.63.0 · **Performed:** 2026-08-04 · **Pre-freeze reconciliation:** 2026-08-09 · **Reconciled:** 2026-08-08 against `BUSINESS_DISCOVERY.md` · **Auditor:** Automated documentation audit · **+ Warehouse & Assembly §17** · **+ Purchase & Supplier §18** · **+ revenue recognition `BD-304`** · **+ Accounting §19**

---

## Audit Control

### What this is

A **documentation completeness audit**. It identifies missing business rules, inconsistent definitions, duplicated concepts, conflicting workflows, undocumented states, and undocumented dependencies — before production development begins.

This is **not** a code audit and **not** a UI audit. No file was modified. Nothing was fixed. No business logic was invented.

### Sources examined

| Source | State | Basis of findings |
|---|---|---|
| [`MASTER_DOCUMENTATION_INDEX.md`](MASTER_DOCUMENTATION_INDEX.md) | ✅ Present | Read in full |
| [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) | ✅ Present, v1.1.0 | Read in full |
| [`design-reference/README.md`](design-reference/README.md) + 3 images | ✅ Present | Read in full; images examined |
| [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) | ✅ Present, 70 rules | Read in full |
| [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) | ✅ Present, 77 rules | Read in full |
| [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) | ✅ Present, 76 rules | Read in full |
| [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) | ✅ Present, 46 rules | Read in full |
| [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) | ✅ Present, 36 rules | Read in full |
| `BUSINESS_ARCHITECTURE.md` | ❌ **Absent** | Verified absent |
| `UI_ARCHITECTURE.md` | ❌ **Absent** | Verified absent |
| `UI_COMPONENT_LIBRARY.md` | ❌ **Absent** | Verified absent |
| `README.md` (docs and repo root) | ❌ **Absent** | Verified absent |
| 12 planned module documents | ❌ **Absent** | Verified absent |
| **Claude Design project (MCP)** | ❌ **Empty** | `list_projects` returned `[]` — queried twice |

### Two premises in the audit brief are false

> The brief instructs: *"Also read the Claude Design project through MCP. Treat BOTH documentation and Claude Design as the canonical sources."*
>
> **There is no Claude Design project.** The design-system project list is empty. This was verified twice during this audit and previously during document creation.
>
> Consequently, **every requested comparison between documentation and Claude Design could not be performed** — not because the comparison failed, but because one side of it does not exist. Audit Area 4 (UI Coverage) is therefore executed against the **frozen reference images** in `design-reference/`, which are the actual binding visual authority (`DESIGN_CONSTITUTION.md` RULE 0.1).
>
> Similarly, `UI_ARCHITECTURE.md` and `BUSINESS_ARCHITECTURE.md` are named as sources but do not exist. Their absence is reported as findings, not worked around.

### Evidence standard

Every finding below is supported by direct evidence from the documents — a verified absence, a counted occurrence, or a quoted conflict. **No finding is inferred.** Where the audit could not determine something, it says so rather than estimating.

Findings that would require reading a document that does not exist are reported as *coverage gaps*, not as *content defects* — the distinction matters, because the second implies something was done wrong and the first implies something has not been done yet.

---

## Summary Dashboard

> 🔴 **HISTORICAL SNAPSHOT — NOT the current authoritative status.** **The counts below are the ORIGINAL audit snapshot taken when this document was first written, covering 68 findings.** ⚠ **The live register has since grown to `GAP-001` – `GAP-128`, and many entries have been answered, closed, reclassified or superseded.**
>
> ✅ **The AUTHORITATIVE source for any gap's current state is its own `GAP-nnn` entry below, together with the Version History at the end of this document.** 🔴 **The Final V1 Architecture Audit (2026-08-11) classified the open set and found NO gap blocking architecture freeze.**
>
> ⚠ **These numbers are preserved, not recalculated.** **Re-deriving a severity distribution across 128 entries is not a deterministic correction, and inventing one would be worse than leaving the snapshot honestly labelled** (`DOC-009`).


| Severity | Count |
|---|---|
| 🔴 **Critical** | **17** |
| 🟠 **High** | **24** |
| 🟡 **Medium** | **21** |
| 🟢 **Low** | **6** |
| **Total** | **68** |

| Category | Count |
|---|---|
| Documentation | 12 |
| Business | 16 |
| Architecture | 8 |
| State | 9 |
| Workflow | 7 |
| UI | 7 |
| Naming | 5 |
| Component | 3 |
| Design | 4 |
| Scalability | 7 |

*(Categories overlap; a gap may carry a primary and secondary category.)*

---

# Area 1 — Business Coverage

## GAP-001

**Category:** Documentation · **Severity:** 🔴 Critical
**Source:** `MASTER_DOCUMENTATION_INDEX.md` §3.3 vs `/docs` directory listing

**Problem.** Sixteen architecture documents are registered as planned and none exist: Product, Customer, Inventory, Warehouse, Procurement, Delivery, Return & Exchange, Payment, Accounting, API, Notification, Reporting, plus `BUSINESS_ARCHITECTURE.md`, `UI_ARCHITECTURE.md`, `UI_COMPONENT_LIBRARY.md`, and `README.md`. Seven documents exist against twenty-three identified.

**Why it matters.** `DOC-015` prohibits writing code for a module whose architecture document does not exist. Taken literally, **development cannot begin on twelve of sixteen business modules.** Every remaining gap in this audit is downstream of this one.

**Suggested documentation.** Write the twelve module documents in the dependency order registered in `MASTER_DOCUMENTATION_INDEX.md` §3.1, each carrying the required sections from `DOC-044`. Resolve `SYS U-2` (Accounting native vs export) before writing Accounting.

---

## GAP-002

**Category:** Business · **Severity:** 🔴 Critical
**Source:** No accounting document; `ORDER_MANAGEMENT_ARCHITECTURE.md` §22.3 defers to it

**Problem.** The **entire accounting flow is undocumented.** No chart of accounts, no revenue recognition policy, no COGS treatment, no period close, no ledger structure, no journal sources. `ORDER_MANAGEMENT_ARCHITECTURE.md` §22.1 explicitly excludes "recognition policy, chart of accounts, and tax treatment" and assigns them to Accounting — which does not exist.

**Why it matters.** Revenue recognition is genuinely ambiguous in this business and cannot be inferred. `BR-010` says an order is not closed at delivery; `BR-037` says settlement is independent and arrives weeks later. **When is revenue recognised — at dispatch, at delivery, at collection, or at settlement reconciliation?** Four defensible answers, materially different financial statements, and no document decides. Developers will pick one silently.

**Suggested documentation.** `ACCOUNTING_ARCHITECTURE.md` defining recognition trigger points against the order and payment state machines, COGS timing against `BR-054` (deduction at dispatch), the treatment of marketplace deductions, and the journal sources for every financial event in `SYSTEM_ARCHITECTURE.md` §13.3.

---

## GAP-003

**Category:** Business · **Severity:** 🔴 Critical
**Source:** Grep across all documents: `tax` appears only as incidental mentions; `VAT` and `Mushak` appear zero times

**Problem.** **Taxation is entirely undocumented.** Tax appears only as a configuration example (`DATABASE_ARCHITECTURE.md` §5.1), a versioning consequence (§7.3), and a retention driver. There is no tax treatment on order lines, no tax point, no tax registration model, no VAT handling, and no reference to Bangladesh VAT/Mushak obligations.

**Why it matters.** Trioloo operates in Bangladesh selling high-value electronics. VAT is not optional and is not a reporting afterthought — it affects the order line, the invoice, the customer document, the marketplace settlement reconciliation, and the ledger. The observed system already generates invoices (`INV-0207`, `design-reference/02-orders-list.png`) and the New Sale modal states *"Invoice auto-generates on save"*, so tax-bearing documents are **already being produced** with no documented tax model behind them.

**Suggested documentation.** A tax section within `ACCOUNTING_ARCHITECTURE.md`, or a dedicated tax document, defining: tax registration scope, tax point, line-level vs order-level tax, tax on marketplace deductions, tax on returns and refunds, and invoice content obligations. Register the owner in `MASTER_DOCUMENTATION_INDEX.md` §4.2.

---

## GAP-004

**Category:** Business · **Severity:** 🔴 Critical
**Source:** `design-reference/02-orders-list.png` KPI row; no reporting document

**Problem.** The orders dashboard displays four KPIs — `Total Orders 193 / All channels`, `Confirmed Today 1 / Across all channels`, `Total Revenue ৳3,42,150 / This month`, `Total Margin ৳54,779 / This month` — and **none of the four has a documented definition.**

Specifically undefined: whether `Total Orders` includes cancelled orders (the same screen shows `Cancelled 173` of `All Orders 193`, implying it does); whether `Total Revenue` means order value, amount received, or amount recognised; what period boundary `This month` uses; and how `Total Margin` can be stated at all when `BR-011` derives margin from actual settlement that arrives weeks later.

**Why it matters.** These are the numbers management looks at. `Total Margin` is the most dangerous: `BR-007` establishes that uncosted lines produce margin that is *unknown, not zero*, and `SYS-034` forbids summing unknowns as zeros. A margin KPI computed over orders whose settlement has not arrived and whose cost may be unknown will be **confidently wrong in a way nobody can detect from the screen.**

**Suggested documentation.** `REPORTING_ARCHITECTURE.md` defining each KPI's population, filters, period basis, and — critically — its behaviour when inputs are unknown, including whether unsettled orders are excluded or estimated and how that is disclosed on the surface.

---

## GAP-005

**Category:** Business · **Severity:** 🔴 Critical
**Source:** No inventory document; `ORDER_MANAGEMENT_ARCHITECTURE.md` §14 covers only the order-side relationship

**Problem.** Inventory is documented **only as seen from Order Management**. `§14` specifies commitment stages, reservation, deduction timing, and the events Order raises — but the inventory module itself is absent: no valuation method, no stock ledger structure, no multi-warehouse allocation rules, no stock count process, no serial lifecycle ownership, no reorder logic.

**Why it matters.** `SYS-011` makes Trioloo permanently authoritative for inventory and cost on every channel. `DB-001` requires balances derived from movements. Neither can be implemented without the owning module's specification. Valuation method in particular (FIFO, weighted average, specific identification) is a decision with permanent financial consequences and is not recorded anywhere — and for serialized goods, specific identification may be the only defensible choice, but no document says so.

**Suggested documentation.** `INVENTORY_ARCHITECTURE.md` per its registered ownership in `MASTER_DOCUMENTATION_INDEX.md` §3.3, explicitly deciding valuation method and its interaction with serial tracking.

---

## GAP-006

**Category:** Business · **Severity:** 🔴 Critical
**Source:** No payment document; `ORDER_MANAGEMENT_ARCHITECTURE.md` §11 covers the order-side view

**Problem.** Payment is documented only from the order's perspective. The payment module is absent: no receipt entity, no remittance batch structure, no settlement report ingestion process, no dispute lifecycle, no refund execution process, no cash-in-transit ledger.

**Why it matters.** `BR-035` (collection ≠ settlement) and `BR-036` (unremitted COD tracked and aged per courier) are the module's most financially consequential rules, and they have no implementing specification. Money held by couriers is Trioloo's largest routine exposure and there is no documented process for tracking or ageing it.

**Suggested documentation.** `PAYMENT_ARCHITECTURE.md` covering receipts, remittance batches, settlement ingestion, reconciliation matching, variance and dispute lifecycle, and refund execution.

---

## GAP-007 · GAP-008 · GAP-009 · GAP-010 · GAP-011 · GAP-012

**Category:** Business · **Severity:** 🟠 High
**Source:** `MASTER_DOCUMENTATION_INDEX.md` §3.3 vs directory listing

**Problem.** Six further business domains have no documentation beyond a registered slot:

| Gap | Domain | Currently documented only as |
|---|---|---|
| GAP-007 | **Product / catalogue** | Referenced by Order for catalogued lines |
| GAP-008 | **Customer master** | Referenced by Order; actor described |
| GAP-009 | **Warehouse operations** | Order-side fulfillment steps in `§8` |
| GAP-010 | **Procurement / inbound supply** | Mentioned in the operational spine diagram only |
| GAP-011 | **Delivery / courier** | Order-side shipment view in `§9` |
| GAP-012 | **Notification** | Listed as an event subscriber |

**Why it matters.** Each is an owner in `SYS §5.4` for data other modules depend on. Procurement is the most exposed: it owns acquisition cost, and **cost is the input to every margin figure in the system**. Without it, `Cost ৳0` on the observed order line (`design-reference/02-orders-list.png`) has no documented path to ever becoming a real number.

**Suggested documentation.** The six registered documents, each with the required sections.

---

## GAP-013

**Category:** Business · **Severity:** 🟠 High
**Source:** `PERMISSION_ARCHITECTURE.md` §6.1 (roles) — no organisational model anywhere

**Problem.** Roles are defined but **departments, teams, and reporting lines are not.** There is no organisational entity, no team assignment, no supervisor relationship, and no concept of work queue ownership by team.

**Why it matters.** `PERMISSION_ARCHITECTURE.md` §5.7 routes escalations "to an actor holding sufficient authority" without specifying *which* actor. `PRM-034` requires escalation to identify a qualified approver, but with no reporting structure there is no documented way to determine who that is. Verification queue assignment (`ORDER_MANAGEMENT_ARCHITECTURE.md` §7.6 step 2) has the same problem.

**Suggested documentation.** An organisational section in `PERMISSION_ARCHITECTURE.md` or a dedicated document, defining teams, supervisory relationships, and how escalation targets and queue ownership are derived.

---

## GAP-014

**Category:** Business · **Severity:** 🟠 High
**Source:** `PERMISSION_ARCHITECTURE.md` §5.7, §17

**Problem.** Approval is documented as **single-step escalation only.** Multi-step approval chains are explicitly listed as a future extension (§17) and are not specified. There is no approval routing model, no delegation of approval within a chain, no parallel approval, and no timeout policy beyond `EXPIRED`.

**Why it matters.** Procurement above a threshold, credit-limit increases, and large write-offs conventionally require more than one approver. `PRM-006` forbids self-approval, so any single-approver design where only one person holds sufficient authority creates a deadlock with no documented resolution.

**Suggested documentation.** An approval-chain specification: routing rules, sequential vs parallel, timeout and escalation-of-escalation, and deadlock resolution.

---

## GAP-015 — ✅ **ANSWERED 2026-08-09 by `BD-435`** (pre-freeze blocker **A1**)

> ✅ **Price source follows the ORDER SOURCE.** **Daraz and Website orders arrive carrying their own actual selling price and the ERP uses it** (`PRD-137`, `PRD-138`) — **not a looked-up figure.** **Manual orders are priced by staff**, with an **Ideal / Recommended Selling Price of applicable product cost + 25%** that is **advisory only** (`PRD-139`, `PRD-140`, `CP-8`). **The Order Line price is captured at line creation and preserved** (`BR-145`, `BR-146`, `INV-32.6`). **No pricing engine, no price list beyond `E-022`, and no new authority** — `BR-092`, `BR-094`, `§7.9` and `PRM-052` stand unamended (`BR-147`, `BR-148`).
>
> ⚠ **One residual, registered as `GAP-112`**: which cost figure feeds the recommendation where **no weighted average exists**. **Advisory display only, so its absence blocks nothing.**

**Category:** Business · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §7.9 references discount authority; no pricing document

**Problem.** Pricing and discount policy are undocumented. `§7.9` grants authority to change price "within discount limit" and `PRM-008` bounds discounts, but **no document defines how price is determined in the first place** — price lists, channel-specific pricing, promotional pricing, marketplace price synchronisation, or price change propagation to open orders.

**Why it matters.** Marketplace listings and website prices must derive from something. `DB-023` snapshots agreed price at confirmation, but the source of that price is unspecified. Multi-channel pricing divergence is a common and expensive failure.

**Suggested documentation.** A pricing section in `PRODUCT_ARCHITECTURE.md` covering price list structure, channel pricing, promotional pricing, and the relationship to marketplace-side prices.

---

## GAP-016 — ✅ **CLOSED 2026-08-09 by `BD-441`** (pre-freeze blocker **A4**, the last one)

> ✅ **There is no backorder flow, which is why modelling one could never have closed this.** **Stock shortage never blocks, holds or cancels an Order** — processing continues regardless of physical stock, on every order source, and **negative actual stock is supported** (`BR-153`, `IVN-051`). **Shortage is a condition of the STOCK, not of the ORDER**, and the Order never learns about it.
>
> ✅ **This explains a long-standing puzzle.** `OM §8.2`'s release precondition carried an escape clause — *“or backorder explicitly authorised”* — with **no authorisation step, actor, reason vocabulary or waiting state ever specified.** **There was never anything to authorise.** The precondition is amended away.
>
> ⚠ **Six explicit prohibitions**: no `ON_HOLD` merely for unavailability, no backorder waiting state, no customer approval, no automatic cancellation, no procurement gating, and **no warning that gates** — shortage visibility is **permissive** (`BR-154`, `IVN-053`, `CP-8`).
>
> ⚠ **New discovery WAS required, and the record was searched first.** **`BD-280` settled the publishing half and explicitly deferred the order half to this gap**; **`BD-100` answered the opposite** — *the order is delayed* — now **scoped to the physical build** (`SM-12 WAITING_FOR_COMPONENTS`, `BR-156`) and **superseded as an Order state**; **`BD-180` and half of `BD-248` were raised and never asked.**

**Original text follows.**

## GAP-016

**Category:** Business · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §8.2, §8.4

**Problem.** **Backorder is referenced but never specified.** `§8.2` lists a release precondition as "Available for every catalogued line, **or backorder explicitly authorised**", and `§8.4` step 5 routes insufficient stock to `ON_HOLD`. No document defines what a backorder is, how it is authorised, how it is fulfilled when stock arrives, or how it interacts with procurement.

**Why it matters.** A named precondition with no definition is unimplementable. Developers will either omit backorder entirely or invent a model.

**Suggested documentation.** Backorder specification in `INVENTORY_ARCHITECTURE.md` or `ORDER_MANAGEMENT_ARCHITECTURE.md` amendment: definition, authorisation, allocation on receipt, customer communication, and cancellation.

---

# Area 2 — Order Lifecycle

## GAP-017

**Category:** Workflow · **Severity:** 🔴 Critical
**Source:** `design-reference/02-orders-list.png` tab bar vs `ORDER_MANAGEMENT_ARCHITECTURE.md` §6.2

**Problem.** **No document maps UI status labels to canonical order states.** The binding reference image shows tabs `All Orders · Pending · RTS · Shipped · Delivered · Failed Delivery · Returned · Cancelled · B2C Pending` and chips `PENDING · NOT RELEASED · COD`. The canonical states are `DRAFT · PENDING_VERIFICATION · CONFIRMED · RELEASED · IN_FULFILLMENT · READY_TO_SHIP · DISPATCHED · DELIVERED · PARTIALLY_DELIVERED · FAILED_DELIVERY · RETURNED · CANCELLED · CLOSED · ON_HOLD`.

Unmapped in both directions:

| UI label | Canonical state | Status |
|---|---|---|
| `Shipped` | `DISPATCHED`? | **Unmapped** |
| `RTS` | `READY_TO_SHIP` | Abbreviation only in glossary |
| `Pending` | `PENDING_VERIFICATION`? | **Unmapped** |
| `B2C Pending` | — | **Undefined** (GAP-022) |
| `NOT RELEASED` | Inverse of `RELEASED`? | **Unresolved** (GAP-021) |
| — | `CONFIRMED`, `RELEASED`, `IN_FULFILLMENT`, `ON_HOLD`, `CLOSED`, `DRAFT` | **No UI representation documented.** ⚠ **`PARTIALLY_DELIVERED` removed from this list 2026-08-09 — the state itself no longer exists** (`BD-442`, `BR-159`) |

**Why it matters.** Seven canonical states have no visible surface, and four UI labels have no canonical meaning. A developer implementing the orders list cannot determine which states each tab filters. `DESIGN_CONSTITUTION.md` freezes the tab bar, so the UI cannot be changed to match the model — the mapping must be documented instead.

**Suggested documentation.** A state-to-label mapping table in `ORDER_MANAGEMENT_ARCHITECTURE.md` §6.2 or `design-reference/README.md`, defining for each tab the exact set of canonical states it includes, and stating where states without a tab are surfaced.

---

## GAP-018 — ✅ **ANSWERED 2026-08-09 by `BD-436`, `BD-437`** (pre-freeze blocker **A2**)

> ✅ **`ON_HOLD` is reservation-neutral.** **A held order is *active*** for `BR-097`, so its commitment persists — **the reservation changes because of the act underneath the hold, never the state transition** (`BR-149`, `BR-150`, `IVN-047`). **Four branches**: shortage releases **only the unfulfillable quantity**; a **credit issue does not by itself make stock available to another customer**; substitution **keeps valid stock and does not reserve the substitute until the customer approves — silence is not approval**; staff/commercial **defaults to keeping it.**
>
> ✅ **Entry and exit were already buildable.** `EVT-010`/`EVT-011` fix hold placement as **manual, by an authorised actor, with reason and actor recorded**, and `OM §6.2` makes the exit owner the placer. **No reason vocabulary was needed** — because behaviour follows the *act* and never a reason code, **the hold reason does not have to be machine-readable.**
>
> ✅ **`BD-437` supplied the one missing mechanism** — explicit manual release: **permission-controlled, deliberately NOT owner-only**, escalating where the performer's authority is insufficient (`PRM-069`), **ten recorded facts** with **performer and approver separate even where one person is both** (`PRM-070`, `AUD-044`, `IVN-049`). **A released reservation is spent and never silently reactivates** (`IVN-050`, `SYS-032`).
>
> ⚠ **No duration, ageing, SLA, auto-cancellation or auto-release exists** — **each was explicitly prohibited by the business** (`BR-151`), not merely omitted.
>
> ⚠ **The rationale below argues from `BR-053`, which is superseded.** Reservation now begins at **confirmation** (`BR-096`), so the concern it names is **stronger**, not weaker — and it is what `BD-436`'s per-branch answer addresses.

**Category:** Workflow · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §6.2, §6.3

**Problem.** `ON_HOLD` has **no documented entry or exit rules.** The state exists in the lifecycle diagram with transitions from `PENDING_VERIFICATION`, `CONFIRMED`, and `IN_FULFILLMENT`, and §6.2 names its exit owner as "whoever placed the hold" — but nothing specifies who may place a hold, valid hold reasons, maximum duration, escalation on ageing, or whether a hold releases inventory reservations.

**Why it matters.** The reservation question is materially financial: an order held indefinitely while holding stock reservations starves other orders. `BR-053` reserves at release specifically to avoid stock being committed to orders that never complete — a hold after release reintroduces exactly that risk, unaddressed.

**Suggested documentation.** Hold specification: authorised placers, reason vocabulary, effect on reservations, maximum duration, ageing escalation, and automatic release conditions.

---

## GAP-019 — ✅ **A3 RESIDUAL ANSWERED 2026-08-09 by `BD-438` – `BD-440`**

> ✅ **The COD reconciliation residual is closed.** **`SM-5`'s `RECEIVED → RECONCILED` is `Manual`** — resolved by **discovery already ratified**, not new discovery: **matching is automatic where an API supplies data and manual otherwise** (`PAY-034`), while **marking reconciled is a human act** (`BD-061`, `BD-062`, `SMA-079`). **`SM-6`'s identical marker resolved on the same evidence.** **`SM-5`'s `COLLECTED_BY_INTERMEDIARY → RECEIVED` corrected from `Automatic` to `Manual`** — *“remittance arrives”* conflated the courier's statement with the money (`BD-438`).
>
> ⚠ **Four `UNDECIDED` markers remain and are NOT part of A3** — `CONFIRMED → RELEASED`, `FAILED_DELIVERY → RETURNED`, `any → CLOSED`, `— → AWAITING_RECEIPT`. **No evidence gathered for A3 bears on them.** *(Observation only: the narrowing table already records release as manual by `BR-081`, so `CONFIRMED → RELEASED`'s marker may itself be stale — untouched here.)*

**Category:** Workflow · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §6.3 and all state machines

**Problem.** **No transition is classified as manual, automatic, or externally triggered.** The state machines specify legal transitions but not what causes them. `§6.1` names stage owners, but not per-transition actors.

**Why it matters.** The audit brief asks for "every manual action, every automatic action, every API action" — this classification does not exist. Whether `CONFIRMED → RELEASED` requires a human click or occurs automatically when preconditions are met is undetermined, and it is a genuinely open commercial decision (`§8.2` implies deliberate authorisation; nothing states it is manual). Two developers will implement it differently.

**Suggested documentation.** A transition table per state machine with columns: from-state, to-state, trigger type (manual / automatic / external event), actor or system identity, and preconditions.

---

## GAP-020

**Category:** Workflow · **Severity:** 🟠 High
**Source:** `DATABASE_ARCHITECTURE.md` §8 vs `ORDER_MANAGEMENT_ARCHITECTURE.md` §6

**Problem.** **Rollback is defined at the data layer but not at the workflow layer.** `DB-002` and `DB-026` establish compensating entries for posted records. No document specifies what happens to a *process* when a stage is reversed: what unwinds when a released order is cancelled mid-pick, what happens to captured serials when a packed order is unpacked, or what reverses when a dispatch is voided.

**Why it matters.** `§6.4` says cancellation at `READY_TO_SHIP` requires "unpack, restock, void shipping label" — one sentence covering three module boundaries with no specification of ordering, failure handling, or partial completion.

**Suggested documentation.** Per-transition reversal specification: which events are emitted, which modules must compensate, in what order, and what happens if compensation partially fails.

---

## GAP-021

**Category:** Workflow · **Severity:** 🔴 Critical
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` Appendix C `Q-1`; `design-reference/02-orders-list.png`

**Problem.** **`NOT RELEASED` semantics are unresolved.** It appears as a chip on the observed order and as a filter (`FILTER: All | Not Released`). `Q-1` records that it was *modelled* as the inventory-commitment gate (`§8.2`) with the explicit caveat that if it is a marketplace readiness signal instead, `§8.2` requires revision.

**Why it matters.** This is a live, shipped UI element gating an unknown process. `§8.2` builds three rules (`BR-017`, `BR-018`, `BR-019`) on the assumption. If the assumption is wrong, the release gate — which controls when inventory is committed — is wrong.

**Suggested documentation.** Confirm the meaning with the business and record it in `ORDER_MANAGEMENT_ARCHITECTURE.md` §8.2, closing `Q-1`. **This is a question to answer, not a document to write.**

---

## GAP-022

**Category:** Workflow · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` Appendix C `Q-2`; grep confirms `B2C` is defined nowhere

**Problem.** `B2C Pending` is a shipped tab with a count of 5. The term **`B2C` appears in the documentation only inside the two open-question rows that ask what it means.** It is never defined.

**Why it matters.** It is unclear whether `B2C` is a channel classification, a customer type, an order type, or a filtered view. `Q-2` assumes a channel-scoped view; if it is an order type, `§6.2` needs a state and `§3` needs a classification axis. The presence of a `B2C` concept also implies a `B2B` concept, which `Q-10` records as "future capability" — suggesting the two may already be operationally distinguished.

**Suggested documentation.** Define `B2C` in the glossary and record its relationship to the channel classification axes in `§3.1`, closing `Q-2`.

---

## GAP-023

**Category:** Workflow · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §6.2, §6.3

**Problem.** `DRAFT` has no lifecycle beyond `submit` and `abandon`. No expiry, no ownership, no cleanup policy, and no rule on whether a draft holds anything.

**Why it matters.** The New Sale modal (`design-reference/03-new-sale-modal.png`) creates orders interactively; an abandoned modal's disposition is unspecified. Low individual impact, but accumulating indefinitely.

**Suggested documentation.** Draft expiry policy and ownership.

---

## GAP-024

**Category:** Workflow · **Severity:** 🟡 Medium
**Source:** All state machines

**Problem.** **No state has a documented time expectation.** No maximum residency, no ageing threshold, no SLA. `SYS-023` requires exceptions to be "visible, aggregated, and aged" but no document says when an order sitting in a state becomes an exception.

**Why it matters.** `G-2` requires that "no order can sit unattended without becoming visible as an exception." Without documented thresholds this goal is unimplementable. The verification queue in particular (§7.6) has priority inputs including "waiting time" with no threshold defined.

**Suggested documentation.** An ageing threshold table per state: expected duration, warning threshold, exception threshold, and escalation target.

---

## GAP-025

**Category:** Workflow · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §8.7

**Problem.** Split fulfillment is specified for shipments (`BR-023`–`BR-025`) but **partial cancellation is not.** Whether individual lines may be cancelled while others proceed is unspecified, though `§10.5` describes partial *delivery* and `§12.6` describes partial *returns*.

**Why it matters.** Verification amendment permits quantity decrease (`§7.9`), which is line-level modification — but after release the interaction with reservations and picking is undefined.

**Suggested documentation.** Line-level cancellation rules and their interaction with reservations, picking, and receivables.

---

# Area 3 — State Machines

## GAP-026

**Category:** State · **Severity:** 🔴 Critical
**Source:** All seven state machines in `ORDER_MANAGEMENT_ARCHITECTURE.md`; verified by extracting state names from every Mermaid block

**Problem.** **State names collide across independent state machines with no namespacing convention.** Verified collisions:

| State name | Appears in |
|---|---|
| `CONFIRMED` | **Order** (§6.2) and **Verification** (§7.4) — two different meanings |
| `CLOSED` | Order, Return, Exchange |
| `CANCELLED` | Order, Shipment, Exchange |
| `IN_TRANSIT` | Shipment, Inventory, Return |
| `RECEIVED` | Return, Payment, Exchange |
| `APPROVED` | Return, Exchange, Permission escalation |
| `REJECTED` | Verification, Return, Exchange, Permission |
| `EXPIRED` | Verification, Permission escalation, Return |
| `UNDER_QC` | Return, Exchange |
| `DELIVERED` | Order, Shipment |

**Why it matters.** `BR-065` and `BR-066` make these machines independent and forbid them sharing state. The phrase *"the order is CONFIRMED"* is therefore genuinely ambiguous — it may mean the order state or the verification state, which can differ. `SYS-027` forbids storing aggregates of another machine's state, making the ambiguity operationally significant: two developers reading the same sentence will implement different fields.

**Suggested documentation.** A state naming convention in `SYSTEM_ARCHITECTURE.md` §5.3 requiring machine-qualified references in all prose and specification (for example, *Order:CONFIRMED* vs *Verification:CONFIRMED*), plus a consolidated state register listing every state, its machine, and its meaning. **Do not rename states** — document the qualification convention.

---

## GAP-027 — ✅ **RESIDUAL CLOSED 2026-08-09; `SMU-10` closed with it**

> ✅ **Courier Remittance requires no state machine — proven, not defaulted** (`SMA-080`, `BD-439`, `BD-440`). **The business supplied the discriminator: *batch closure records completed resolutions and decides nothing*** — and **a batch whose closure decides nothing has no decisions to sequence.** Its condition is **derived from its consignment lines** (`DB-001`), and every underlying act already lives elsewhere under its own authority.
>
> ✅ **This gap's premise was a misreading.** It held that COD cash-in-transit had **no states to age against**. **It always had them** — `SM-5`'s `COLLECTED_BY_INTERMEDIARY` entry action reads *“add to cash-in-transit exposure per courier; **begin ageing**”*. **Ageing hangs off the receivable, not the batch**, and a batch that does not yet exist could never have aged anything.
>
> ⚠ **The ageing *threshold* is still undefined — `GAP-024`, unchanged and outside A3.**

**Original text follows.**

## GAP-027

**Category:** State · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §18.2 machine register

**Problem.** The audit brief requires independent state machines for eleven subjects. Seven are documented. **Four are absent:**

| Machine | Status |
|---|---|
| Order, Verification, Shipment, Payment, Return, Exchange, Inventory | ✅ Documented |
| **Refund** | ❌ Embedded in Payment (`REFUND_DUE → REFUNDED`); not independent |
| **Marketplace** | ❌ No machine for mirrored marketplace order status |
| **Courier remittance** | ❌ Described narratively in §11.5; no machine |
| **QC** | ❌ States embedded in Return and Exchange; no independent machine |
| **Approval** | ❌ Escalation lifecycle in `PERMISSION` §7.2; no general approval machine |

**Why it matters.** Each absence has a concrete consequence. Refund embedded in Payment cannot represent a refund that is approved but blocked pending goods receipt (`BR-041`). No marketplace machine means the mirror-divergence exception (`SYS-026`) has no states to diverge between. No remittance machine means the COD cash-in-transit exposure (`BR-036`) has no lifecycle to age against. No QC machine means inbound supplier QC has nowhere to live.

**Suggested documentation.** Either document the four missing machines in their owning modules, or record an explicit decision that each is a sub-state of its parent — with the reasoning. Silence is the problem, not the choice.

> ✅ **Update 2026-08-09 — the registration half is CLOSED; the gap stays open on its remainder.**
>
> **Closed:** `SM-3`, `SM-6`, `SM-10` and `SM-11` are specified in `STATE_MACHINE_ARCHITECTURE.md` **and registered in `OM §18.2`** (`BR-142`), discharging `SMA-001`, `SMA-011` and `SMU-11`. **Refund now has states for a blocked-but-approved refund** — the specific consequence this gap named. **Marketplace divergence** has `SM-14` Marketplace Claim and `SM-6`. **Inbound supplier QC has somewhere to live**, at the warehouse's discretion (`WHS-018`).
>
> **Still open:** **Courier Remittance has no machine** (`SMU-10`, `BD-059`) — the `BR-036` COD cash-in-transit exposure still has no lifecycle to age against, and `PAY §7` records it. **Approval was separately determined unnecessary** (`SMA-017`, `PRM-048`, `PRM-049`, `BD-378`), so its ❌ above is superseded rather than outstanding.

---

## GAP-028

**Category:** State · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §12.4, §13.5

**Problem.** The Return machine includes `LOST_IN_RETURN` and the Exchange machine includes `EXCHANGE_DENIED` and `CANCELLED_TO_REFUND` — **none of which appear in the state tables that precede the diagrams** (`§12.3` lists sixteen states; `LOST_IN_RETURN` is not among them).

**Why it matters.** A state appearing only in a diagram is undefined: no meaning, no owner, no exit rule. `DESIGN_CONSTITUTION.md`-equivalent rigour requires the table to govern.

**Suggested documentation.** Reconcile the state tables against the diagrams in `§12` and `§13`, adding the missing states with meanings and owners.

---

## GAP-029

**Category:** State · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §18.3 coupling contract

**Problem.** The coupling table specifies emitting machine, event, consuming machine, and effect — but **not what happens when a consuming machine cannot legally apply the effect.** `§9.7` addresses this for tracking events only ("recorded as exceptions rather than applied").

**Why it matters.** `SYS-054` says subscriber failure never blocks the publisher, and `SYS-032` says refusal is a normal outcome — but the coupling contract does not say which refusals are expected. If Inventory refuses a deduction because stock is already zero, the order is dispatched and stock is wrong, with no documented resolution.

**Suggested documentation.** Extend `§18.3` with a failure column: what the consuming machine does when the effect cannot be applied.

---

# Area 4 — UI Coverage

> **Executed against `design-reference/` — the Claude Design project does not exist (see Audit Control).**

## GAP-030

**Category:** UI · **Severity:** 🔴 Critical
**Source:** `design-reference/` contains 3 images

**Problem.** **Three screens are captured**: sidebar navigation, orders list, new-sale modal. The sidebar itself reveals at least six modules (Overview, Inventory, Sales & Orders, Accounting, HR Payroll, Tasks Management) with sub-navigation. **No screen inventory exists** and no document states how many screens the product has.

**Why it matters.** `DESIGN_CONSTITUTION.md` RULE 0.1 freezes existing layouts and RULE 0.2's precedence means the images govern — but only for what they show. Every uncaptured screen is simultaneously *frozen* (it exists in the product) and *unspecified* (it is not in the reference). A developer touching any other screen has no authority to work from.

**Suggested documentation.** A screen inventory listing every screen in the product with capture status, and captures for each frozen screen added to `design-reference/` per its documented process.

---

## GAP-031

**Category:** UI · **Severity:** 🟠 High
**Source:** `design-reference/01-sidebar-navigation.png`

**Problem.** The sidebar shows **`HR Payroll` and `Tasks Management`** as top-level modules. Neither appears in any architecture document. `SYSTEM_ARCHITECTURE.md` §2.2 explicitly places "Human resources and payroll" **out of scope for the system** — yet it is in the shipped navigation.

**Why it matters.** A direct contradiction between a binding reference image and a ratified architecture document. Per `SYS-001` precedence, the image outranks — meaning HR Payroll is in the product and out of the architecture simultaneously. `Tasks Management` is unmentioned anywhere.

**Suggested documentation.** Resolve the contradiction: either amend `SYSTEM_ARCHITECTURE.md` §2.2 to bring HR Payroll into scope with an owning document, or record why a navigation item exists for an out-of-scope module. Define `Tasks Management` and register its owner.

---

## GAP-032

**Category:** UI · **Severity:** 🟠 High
**Source:** `design-reference/README.md` §02 vs `02-orders-list.png`

**Problem.** The reference README describes the status tab bar as *"Horizontal, inline counts, underline on active. Counts color-coded per status family"* — but **does not transcribe the tab labels themselves.** The vocabulary (`All Orders`, `Pending`, `RTS`, `Shipped`, `Delivered`, `Failed Delivery`, `Returned`, `Cancelled`, `B2C Pending`) exists only inside the image.

**Why it matters.** Text in an image cannot be diffed, searched, or cited. GAP-017's mapping problem is undetectable by any automated check because one side of the comparison is pixels.

**Suggested documentation.** Transcribe all UI vocabulary from the binding images into `design-reference/README.md` — tab labels, chip labels, filter labels, column headers, and action labels.

---

## GAP-033

**Category:** UI · **Severity:** 🟠 High
**Source:** `design-reference/02-orders-list.png` filter row

**Problem.** Filter and search semantics are undocumented. The screen shows `Search by order no, ref, customer…`, a `Day/Week/Month/Year` segmented control, `Sources` and `Stores` dropdowns, and a `FILTER: All | Not Released` chip pair. **No document defines** what fields search covers, what the period control filters on (order date? dispatch date? delivery date?), what populates `Sources` and `Stores`, or how filters combine.

**Why it matters.** The period basis is materially ambiguous — filtering `Month` on order date versus delivery date produces different sets, and the KPIs above say `This month` (GAP-004). Two different month definitions on one screen is plausible and undetectable.

**Suggested documentation.** Filter specification: searchable fields, matching behaviour, period basis, filter source populations, and combination semantics.

---

## GAP-034

**Category:** UI · **Severity:** 🟡 Medium
**Source:** `design-reference/02-orders-list.png` bulk action bar

**Problem.** The bulk bar shows `Change status to…`, `Send to Steadfast`, `Print invoices`, `Export selected`, `Clear`. **No document specifies** which status transitions are permitted in bulk, what `Send to Steadfast` does to shipment state, or what `Print invoices` produces.

**Why it matters.** `PRM-025` requires per-record authorisation and `SYS-033` requires per-record rule enforcement in bulk. `Change status to…` implies arbitrary status setting, which would bypass the state machines entirely if implemented literally.

**Suggested documentation.** Bulk action inventory: permitted transitions, per-record rules, partial-failure reporting, and the shipment consequences of courier dispatch actions.

---

## GAP-035

**Category:** UI · **Severity:** 🟡 Medium
**Source:** `design-reference/03-new-sale-modal.png`

**Problem.** The New Sale modal states *"Invoice auto-generates on save"* and shows `PAID AMOUNT` / `OUTSTANDING`. **No document specifies** invoice numbering, invoice content, when a number is assigned, or whether partial payment at creation is permitted before delivery.

**Why it matters.** `SYS-031` requires stable, never-reused human identifiers and `DB-012` retires cancelled numbers. `INV-0207` is visible in the orders list, so numbering is live. Partial payment at order creation also conflicts with `§11.3`'s `NOT_DUE` state, which says payment is not due before delivery.

**Suggested documentation.** Invoice specification, and clarification of whether pre-delivery payment is permitted and how it maps to the payment state machine.

---

## GAP-036

**Category:** UI · **Severity:** 🟡 Medium
**Source:** `DESIGN_CONSTITUTION.md` §10.4 vs `design-reference/`

**Problem.** `DESIGN_CONSTITUTION.md` §10.4 mandates five states for every table (loading, empty, filtered-empty, error, paginating) and `10.7` extends this to order card lists. **No reference capture shows any of them.**

**Why it matters.** The mandate exists; the visual specification does not. `RULE 0.1` freezes what the images show, and they show only the populated state.

**Suggested documentation.** Reference captures for each mandated state, or an explicit note that they are governed by the Constitution's specification alone.

---

# Area 5 — Component Consistency

## GAP-037

**Category:** Component · **Severity:** 🟠 High
**Source:** `UI_COMPONENT_LIBRARY.md` verified absent

**Problem.** **No component library document exists.** `DESIGN_CONSTITUTION.md` specifies component *behaviour and appearance* (Articles IX–XIII) and `16.4` defines the component contract, but **no document enumerates which components exist**, their variants, their props, or their usage constraints.

**Why it matters.** `DOC-011`/`SYS-016` require single definition, and `16.1.a` requires exactly one implementation per pattern — but with no registry, a developer cannot determine whether a component already exists. The three-strike rule (`16.2`) is unenforceable without an inventory.

**Suggested documentation.** `UI_COMPONENT_LIBRARY.md` enumerating every component with variants, states, usage constraints, and — per `16.4.6` — the cases in which each must not be used.

---

## GAP-038

**Category:** Component · **Severity:** 🟡 Medium
**Source:** `DESIGN_CONSTITUTION.md` — searched for each component named in the audit brief

**Problem.** Several components required by the brief are specified nowhere:

| Component | Status |
|---|---|
| Cards, tables, forms, buttons, icons, sidebar, header, tabs, empty states, loading states | ✅ Specified |
| Status badges | ⚠️ Referenced as "chips" with colour semantics; **no vocabulary enumerated** |
| Pagination | ⚠️ Behaviour in `10.5`; **no component spec** |
| Dropdowns, search | ⚠️ Listed in `11.4` control inventory; **no component spec** |
| **Toast** | ❌ Referenced in `14.1` elevation table only |
| **Timeline** | ❌ **Not specified anywhere** |
| **Activity log (UI)** | ❌ Content specified in `ORDER_MANAGEMENT` §15; **no UI spec** |
| **Audit log (UI)** | ❌ Content specified in `AUDIT_ARCHITECTURE`; **no UI spec** |
| Dialogs | ⚠️ Modal composition frozen in reference; **no general dialog spec** |

**Why it matters.** Activity and audit history are central to the ERP (`SYS-057`, `AUD-001`) and are among the most-viewed surfaces in any ERP — with no documented presentation, each module will build its own.

**Suggested documentation.** Component specifications for the gaps above in `UI_COMPONENT_LIBRARY.md`, and a status badge vocabulary bound to the semantic colours in `DESIGN_CONSTITUTION.md` §2.4.

---

## GAP-039

**Category:** Component · **Severity:** 🟡 Medium
**Source:** `DESIGN_CONSTITUTION.md` §2.4 vs `design-reference/02-orders-list.png`

**Problem.** `§2.4` defines five semantic intents (success, warning, danger, info, neutral) and `2.4.b` requires every status to carry a text label. The observed screen shows chips `PENDING` (amber), `NOT RELEASED` (grey), `COD` (grey), and tab counts in green, red, orange, and grey. **No document maps business statuses to semantic intents.**

**Why it matters.** `RULE 2.4.a` forbids orange meaning "warning" since orange is the brand. Tab counts are already coloured orange (`B2C Pending 5`) — which per the Constitution must therefore mean "active/primary", not "caution". The mapping is undocumented and the current usage may already contradict the rule.

**Suggested documentation.** A status-to-intent mapping table covering every business status across every module.

---

# Area 6 — Design Consistency

## GAP-040

**Category:** Design · **Severity:** 🟡 Medium
**Source:** `DESIGN_CONSTITUTION.md` §4.2

**Problem.** Sidebar width is recorded as *"As built (≈200px in the reference capture). The shipped stylesheet value is authoritative — record it here once confirmed."* **The value has not been confirmed.**

**Why it matters.** `DESIGN_CONSTITUTION.md` mandates consistency and forbids arbitrary values (`4.3.1`), yet its own foundational dimension is an unconfirmed measurement taken from a screenshot. Every layout calculation depending on sidebar width inherits the uncertainty.

**Suggested documentation.** Confirm the shipped value and record it, closing the placeholder.

---

## GAP-041

**Category:** Design · **Severity:** 🟠 High
**Source:** `DESIGN_CONSTITUTION.md` Article XVII vs `design-reference/`

**Problem.** Article XVII specifies five breakpoints and detailed adaptation rules per element. **No responsive evidence exists** — all three captures are desktop. `17.4.4` requires testing at 1280, 1440, and 1920; no capture records any of them explicitly.

**Why it matters.** `RULE 0.1` freezes "layout" and "spacing" based on images that show one viewport. Responsive behaviour is therefore specified by the Constitution but unverified against the product, and it is unknown whether the shipped application matches Article XVII at all.

**Suggested documentation.** Reference captures at each breakpoint, or an explicit statement that responsive behaviour is specification-led because the product has not yet been verified at those widths.

---

## GAP-042

**Category:** Design · **Severity:** 🟡 Medium
**Source:** `DESIGN_CONSTITUTION.md` §18.6

**Problem.** The register of accepted deviations records two AA failures (`A11Y-01` orange nav label ≈2.5:1; `A11Y-02` decorative colours) and states the product must not claim unqualified WCAG 2.2 AA conformance.

**Why it matters.** This is correctly documented, not a documentation defect — but it is a **live commercial exposure** with no owner or review date. Enterprise procurement commonly contracts on AA conformance.

**Suggested documentation.** An owner and review date against each register entry, and a disclosure note wherever conformance is claimed externally.

---

# Area 7 — Naming Consistency

## GAP-043

**Category:** Naming · **Severity:** 🟠 High
**Source:** `design-reference/02-orders-list.png` vs `ORDER_MANAGEMENT_ARCHITECTURE.md` §6.2

**Problem.** The same concept carries different names across the UI and the architecture, with no documented equivalence:

| UI | Architecture | Also appears as |
|---|---|---|
| `Shipped` | `DISPATCHED` | `Order.Dispatched` (event, `SYS §13.5`) |
| `Pending` | `PENDING_VERIFICATION` | `PENDING` (verification state, §7.4) |
| `RTS` | `READY_TO_SHIP` | `RTS` (glossary) |
| `Failed Delivery` | `FAILED_DELIVERY` | `DELIVERY_ATTEMPTED` (shipment, §9.4) |
| `Returned` | `RETURNED` | `RETURNED_TO_WAREHOUSE` (shipment), `RETURNING` (inventory) |

**Why it matters.** Exactly the pattern the audit brief names. `DOC-012` requires canonical terminology with no module dialects. Staff, tickets, and code will use whichever term they encountered first.

**Suggested documentation.** An equivalence table mapping UI vocabulary to canonical vocabulary. **Do not rename** — the UI is frozen and the architecture is ratified; document the mapping.

---

## GAP-044

**Category:** Naming · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §9.4 vs §10.2

**Problem.** Delivery failure is represented three ways: shipment state `DELIVERY_ATTEMPTED` (§9.4), order state `FAILED_DELIVERY` (§6.2), and delivery outcome `FAILED_DELIVERY` (§10.2) — plus a distinct outcome `REFUSED` in §10.2 that has no corresponding state in either machine.

**Why it matters.** `REFUSED` appears in the outcomes table but nowhere in the state machines, making it an outcome with no state to record it.

**Suggested documentation.** Reconcile §10.2 outcomes against the order and shipment state machines; add or map `REFUSED`.

---

# Area 8 — Missing Definitions

## GAP-045

**Category:** Documentation · **Severity:** 🔴 Critical
**Source:** Grep across all documents — `QC` appears **62 times**; `quality control` appears **0 times**

**Problem.** **`QC` is used 62 times across the documentation and is never defined or expanded.** It is absent from the `ORDER_MANAGEMENT_ARCHITECTURE.md` glossary (20 terms, verified). It carries substantial process weight: `BR-046` routes all returned goods through it, `BR-047` makes serial verification at QC mandatory, and the Return and Exchange machines both contain `UNDER_QC`, `QC_PASSED`, `QC_FAILED`.

**Why it matters.** The single most-used undefined term in the documentation, controlling whether goods re-enter sellable stock and whether refunds are released. `§12.5` step 6 lists six inspection checks, but there is no definition of what QC *is*, who performs it, what qualifies an inspector, what tolerances apply, or how disputes over a QC outcome are resolved.

**Suggested documentation.** Define QC in the glossary and specify the QC process in `WAREHOUSE_ARCHITECTURE.md`: performer, qualification, checks, tolerances, outcome authority, and dispute path. Cover inbound supplier QC as well as return QC.

---

## GAP-046

**Category:** Documentation · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` Appendix A glossary (20 terms, extracted and verified)

**Problem.** Terms used substantively but **absent from the glossary**:

| Term | Used in | Status |
|---|---|---|
| **QC** | 62 occurrences | GAP-045 |
| **B2C** | UI tab | GAP-022 |
| **Verification** | Entire §7 | Defined by section, not glossary |
| **Exchange** | Entire §13 | Not in glossary |
| **Replacement** | §13 throughout | Undefined |
| **Own Delivery** | §8.8 | Table row only |
| **Warranty** | §8.5, §12.6, §14.7 | Never defined |
| **RMA** | §12, §14.7 | Used, never expanded |
| **Backorder** | §8.2 | GAP-016 |
| **Landed cost** | `MASTER_INDEX` §3.3 | Never defined |
| **Open-box / regrade** | §12.5, inventory machine `REGRADED` | Undefined |
| **Digibox** | `design-reference/README.md` | Undefined |
| **Dispute** | §10.6, §11.6 | Used as a state and a process; undefined |
| **Split shipment** | §8.7 | Described, not defined |

**Why it matters.** `DOC-012` and `SYS-016` require canonical terminology defined once. Each undefined term is a place where two readers form different models.

**Suggested documentation.** Extend the glossary, or move it to `SYSTEM_ARCHITECTURE.md` §5.3 as the system-wide vocabulary registry it already claims to be.

---

## GAP-047

**Category:** Documentation · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §12.5, §14.5, §18.5

**Problem.** **Condition grading is referenced but never specified.** The inventory machine contains a `REGRADED` state; `§12.5` step 7 lists dispositions including "Restock as open-box at adjusted value" and "Quarantine for regrade"; `BR-046` requires QC before sellable stock. **No document defines the grades**, their criteria, their pricing impact, or who assigns them.

**Why it matters.** For a returns-heavy electronics business this directly determines recoverable value. "Adjusted value" appears with no adjustment rule.

**Suggested documentation.** Condition grade vocabulary in `INVENTORY_ARCHITECTURE.md`: grades, criteria, valuation impact, sellability, and assigning authority.

---

## GAP-048

**Category:** Documentation · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §14.5, §14.6

**Problem.** `LOST`, `MISSING`, and `DAMAGED` are used as distinct inventory outcomes with distinct attributions, but their boundaries are undefined. `§14.5` lists `Lost` (shipment lost) and `Missing` (pick shortfall) as separate events; `§14.6` attributes them differently. **When a pick shortfall becomes a loss, and when a delayed shipment becomes lost, is unspecified.**

**Why it matters.** `BR-055` requires attribution for every loss and attribution drives claims against couriers. A shipment stuck in transit (`§9.8`) has no documented threshold for reclassification as `LOST`, so claims may never be raised.

**Suggested documentation.** Definitions and transition thresholds for lost, missing, and damaged, including the ageing threshold at which a stuck shipment becomes a loss.

---

# Area 9 — Cross References

## GAP-049

**Category:** Documentation · **Severity:** 🟡 Medium
**Source:** `DESIGN_CONSTITUTION.md`

**Problem.** `DESIGN_CONSTITUTION.md` references `design-reference/` but **does not reference `SYSTEM_ARCHITECTURE.md`, `MASTER_DOCUMENTATION_INDEX.md`, or any module document.** It is the only ratified document with no upward or lateral references.

**Why it matters.** `DOC-014` requires explicit linking. A reader arriving at the Constitution first — plausible for a frontend developer — has no documented path to the business architecture, and may not learn that `MASTER_DOCUMENTATION_INDEX.md` must be read first (`DOC-022`).

**Suggested documentation.** A reference block in `DESIGN_CONSTITUTION.md` pointing to the index and the system architecture.

---

## GAP-050

**Category:** Documentation · **Severity:** 🟡 Medium
**Source:** Repository root and `/docs` — both verified to contain no `README.md`

**Problem.** **No README exists at the repository root or in `/docs`.** A developer cloning the repository encounters a `docs/` folder with eight files and no entry signpost.

**Why it matters.** `DOC-022` requires reading `MASTER_DOCUMENTATION_INDEX.md` first, but nothing at the repository root says so. The instruction is only discoverable by someone who already found the document it lives in.

**Suggested documentation.** A root `README.md` stating what the project is and directing all readers to `docs/MASTER_DOCUMENTATION_INDEX.md` before anything else.

---

## GAP-051

**Category:** Documentation · **Severity:** 🟢 Low
**Source:** `MASTER_DOCUMENTATION_INDEX.md` §3.3

**Problem.** Planned documents are referenced with placeholder links (`[`INVENTORY_ARCHITECTURE.md`](.)`) that resolve to the directory rather than failing visibly.

**Why it matters.** Minor, but a link that silently resolves to the wrong target is worse than one that visibly breaks.

**Suggested documentation.** Render planned documents as plain text rather than links until they exist.

---

# Area 10 — Future Scalability

## GAP-052

**Category:** Scalability · **Severity:** 🔴 Critical
**Source:** Grep — no tax model anywhere (see GAP-003)

**Problem.** **Multiple tax systems are unsupported at the documentation level** because no tax system is documented at all. There is no tax jurisdiction concept, no tax registration per company, and no tax rule resolution.

**Why it matters.** `SYS-014` carries company scope precisely so multi-company activation requires no migration — but multi-company almost always implies multi-jurisdiction, and no tax dimension exists to scope. The one structural preparation the architecture makes for multi-entity growth has no tax counterpart.

**Suggested documentation.** A tax model with jurisdiction and registration as first-class dimensions, scoped to company from the outset — the same reasoning as `SYS-014`.

---

## GAP-053

**Category:** Scalability · **Severity:** 🟠 High
**Source:** `SYSTEM_ARCHITECTURE.md` `SYS-019`

**Problem.** `SYS-019` prohibits cross-company transactions "until inter-company accounting is specified" — and the document that would specify it does not exist.

**Why it matters.** Correctly flagged as a known limit rather than a hidden one. But multi-company is listed as a supported future scenario in `§18.2` with impact "No core change — except a specified Accounting amendment", and that amendment cannot be written until Accounting exists. **Multi-company is therefore blocked on GAP-002.**

**Suggested documentation.** Inter-company transaction rules within `ACCOUNTING_ARCHITECTURE.md`.

---

## GAP-054

**Category:** Scalability · **Severity:** 🟠 High
**Source:** `DATABASE_ARCHITECTURE.md` `DB-036`; `SYSTEM_ARCHITECTURE.md` §18.2

**Problem.** Multi-currency is prepared at the data layer (currency travels with every amount) but **no accounting treatment exists**: no functional currency, no translation method, no rate source, no rate date policy, no gain/loss treatment.

**Why it matters.** The data preparation is correct and valuable. But `§18.2` claims multi-currency requires "no core change — with an Accounting extension", and that extension has no home. Marketplace settlement in a foreign currency would be unprocessable.

**Suggested documentation.** Currency translation policy in `ACCOUNTING_ARCHITECTURE.md`.

---

## GAP-055

**Category:** Scalability · **Severity:** 🟠 High
**Source:** `SYSTEM_ARCHITECTURE.md` §12.3 lists payment providers as "future"

**Problem.** **No payment gateway abstraction is documented.** `§11.2` of Order Management lists collection modes including `PREPAID_DIRECT`, but no document defines a payment provider entity, authorisation/capture/settlement lifecycle, or provider-specific reconciliation.

**Why it matters.** Bangladesh e-commerce depends heavily on mobile financial services. `SYS-013` claims a new payment mode is configuration — untestable, since no payment mode is specified in enough detail to extend.

**Suggested documentation.** Payment provider model in `PAYMENT_ARCHITECTURE.md` with the same adapter discipline applied to channels and couriers (`SYS-009`).

---

## GAP-056

**Category:** Scalability · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §9.3, §9.6

**Problem.** Courier integration is well specified in principle (adapter responsibilities, three ingestion mechanisms, permanent manual fallback via `BR-029`) but **no courier contract document exists** — no canonical tracking event vocabulary, no rate structure model, no remittance file model.

**Why it matters.** `BR-028` claims adding a courier requires no lifecycle change. Without a canonical event vocabulary to translate *into*, each adapter will invent its own mapping — reintroducing per-courier variation in the core, which `SYS-009` prohibits.

**Suggested documentation.** Canonical courier event vocabulary and remittance model in `DELIVERY_ARCHITECTURE.md`.

---

## GAP-057

**Category:** Scalability · **Severity:** 🟡 Medium
**Source:** `SYSTEM_ARCHITECTURE.md` §5.6

**Problem.** The scope hierarchy defines Company → Business Unit → (Warehouse, Channel Instance, User). **Branch is not a modelled level**, though the audit brief lists "multiple branches" as a scalability target. `§18.2` maps retail stores onto warehouse + channel instance.

**Why it matters.** The mapping may be adequate, but it is asserted rather than examined — a branch typically has staff, stock, a cash position, and a P&L, and only the stock dimension is covered.

**Suggested documentation.** Confirm whether branch is representable as warehouse + channel instance, or introduce it explicitly.

---

## GAP-058

**Category:** Scalability · **Severity:** 🟢 Low
**Source:** `SYSTEM_ARCHITECTURE.md` §18.2

**Problem.** Multiple marketplaces and multiple websites are the best-covered scalability scenarios — `BR-001`, `BR-002`, `SYS-009` are specifically designed for them. **No gap in principle.** The only gap is that the claim is untested: no second marketplace adapter exists to validate that the channel attribute model is sufficient.

**Why it matters.** Low. Recorded for completeness because the brief asks.

**Suggested documentation.** None required. Validate when the second marketplace is added.

---

# Additional Findings

## GAP-059

**Category:** Architecture · **Severity:** 🟠 High
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §4.5, `BR-008`

**Problem.** `BR-008` states non-catalogued lines "carry an open mapping task" and that the unmapped count "should trend to zero". **No mapping process is documented** — no task entity, no owner, no workflow, no effect of mapping on already-closed orders.

**Why it matters.** The observed line shows `Cost ৳0` producing `Margin ৳0` — the exact condition `BR-007` flags as economically incomplete. Without a mapping process, orders permanently retain unknown margin, and `BR-008`'s "trend to zero" is unachievable.

**Suggested documentation.** Mapping workflow: task creation, ownership, resolution, and whether mapping retroactively corrects margin on closed orders (interacting with `DB-023` snapshots).

---

## GAP-060

**Category:** Architecture · **Severity:** 🟠 High
**Source:** `SYSTEM_ARCHITECTURE.md` §6.2, `SYS-022`, `SYS-023`

**Problem.** The Exception entity is defined with attributes and two rules, but **no exception type vocabulary exists.** Dozens of situations across the documentation say "raise an exception" with no controlled list, no severity criteria, no routing rules, and no resolution workflow.

**Why it matters.** `SYS-043` requires controlled vocabularies for reason codes; exception types are the largest uncontrolled vocabulary in the system. `SYS-022` requires every exception to have an owning role — undeterminable without a type registry.

**Suggested documentation.** Exception type registry: type, severity, owning role, routing, resolution path, and ageing threshold.

---

## GAP-061

**Category:** Architecture · **Severity:** 🟡 Medium
**Source:** `SYSTEM_ARCHITECTURE.md` §13.5

**Problem.** Event naming convention is specified (`<Domain>.<Subject><PastTenseVerb>`) and a taxonomy is listed by category, but **no event register exists** — no complete list of events, their payload requirements (`SYS-050` requires "sufficient content"), or their subscribers.

**Why it matters.** `SYS-050` is unverifiable without knowing what each event carries. Modules cannot be built against events that are described only by category.

**Suggested documentation.** An event register: name, publisher, content requirements, subscribers, ordering guarantees.

---

## GAP-062

**Category:** Architecture · **Severity:** 🟡 Medium
**Source:** `DATABASE_ARCHITECTURE.md` §13.1

**Problem.** Eight required reconciliations are listed with what each detects, and `DB-062` requires each to run on a defined cycle. **No cycle is defined** for any of them, and no owner is assigned.

**Why it matters.** `DB-060` makes eventual consistency acceptable *only because* reconciliations detect divergence. An undefined cycle means the safety mechanism the consistency model depends on has no specified existence.

**Suggested documentation.** Cycle, owner, and exception threshold for each of the eight reconciliations.

---

## GAP-063

**Category:** Business · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §7.7, `BR-015`

**Problem.** Verification attempt limits, retry intervals, and contact windows are correctly deferred to configuration (`BR-015`). But **no default values are recorded anywhere**, and no document states who sets them.

**Why it matters.** Correct architecturally. Operationally, the verification process cannot run without values, and `§2.3`'s verification-conversion metric cannot be interpreted without knowing the policy that produced it.

**Suggested documentation.** A configuration register recording current values, their owner, and change history — distinct from architecture.

---

## GAP-064

**Category:** Business · **Severity:** 🟡 Medium
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §12.5 step 2, §13.6 step 2

**Problem.** Return and exchange policy checks reference "within the return window" and "product eligible" — **neither is defined.** `§3.4` states marketplace policy governs on marketplace channels, but Trioloo's own policy for direct channels is unspecified.

**Why it matters.** The return window determines refund liability. `§12.6` references "outside window but goods faulty" routing to warranty, so both windows must exist and interact.

**Suggested documentation.** Return policy configuration: window by channel and category, eligibility rules, and the relationship to warranty.

---

## GAP-065

**Category:** Business · **Severity:** 🟢 Low
**Source:** `ORDER_MANAGEMENT_ARCHITECTURE.md` §5.1.1

**Problem.** Marketplace orders are described as arriving with "structurally complete" data, and `§7.8` auto-confirms them. **No document specifies what happens when a marketplace order arrives incomplete** — missing address, missing contact.

**Why it matters.** Low frequency, but auto-confirmation of an unfulfillable order would release stock against an undeliverable order.

**Suggested documentation.** Incompleteness handling for integrated channels.

---

## GAP-066

**Category:** Business · **Severity:** 🟢 Low
**Source:** `design-reference/02-orders-list.png` — `Note: Handle with care`

**Problem.** Order notes are visible in the reference image and `§8.6` step 5 requires transferring special instructions to the package and courier booking. **No document specifies** note types, who may add them, whether they are customer-visible, or their length.

**Why it matters.** Minor, but notes affecting physical handling of fragile televisions have operational consequence.

**Suggested documentation.** Note specification: types, authorship, visibility, propagation to courier.

---

## GAP-067

**Category:** Documentation · **Severity:** 🟢 Low
**Source:** `MASTER_DOCUMENTATION_INDEX.md` status dashboard

**Problem.** The dashboard records line counts for existing documents. These will drift as documents are amended, and no process refreshes them.

**Why it matters.** Minor. A stale count is misleading but not dangerous.

**Suggested documentation.** Remove line counts, or note that they are indicative only.

---

## GAP-068

**Category:** Documentation · **Severity:** 🟢 Low
**Source:** Audit brief vs `/docs`

**Problem.** The audit brief names `BUSINESS_ARCHITECTURE.md` as a source document. It does not exist, and it is **not registered as planned** in `MASTER_DOCUMENTATION_INDEX.md` §3.3 — unlike the other twelve absent documents, which have reserved slots.

**Why it matters.** Its role is ambiguous: `ORDER_MANAGEMENT_ARCHITECTURE.md` may already be what was meant by business architecture, or a separate cross-domain business document may be intended.

**Suggested documentation.** Decide whether `BUSINESS_ARCHITECTURE.md` is a distinct document or a synonym for the order document, and register or retire the name.

---

# Final Summary

## Severity totals

| Severity | Count | Meaning |
|---|---|---|
| 🔴 **Critical** | **17** | Blocks development or risks financially wrong behaviour |
| 🟠 **High** | **24** | Forces developers to assume; assumptions will diverge |
| 🟡 **Medium** | **21** | Causes rework or inconsistency |
| 🟢 **Low** | **6** | Should be corrected; no material risk |
| **Total** | **68** | |

## Critical findings

| Gap | Summary |
|---|---|
| GAP-001 | 16 documents absent; 12 modules cannot begin development (`DOC-015`) |
| GAP-002 | Accounting entirely undocumented. **Revenue recognition point DECIDED 2026-08-06 (`BD-304`) — at successful delivery.** The module itself remains unwritten |
| GAP-003 | Taxation entirely undocumented — invoices already being generated |
| GAP-004 | Dashboard KPIs undefined — margin figure risks being confidently wrong |
| GAP-005 | Inventory module absent — **valuation method undecided** |
| GAP-006 | Payment module absent — COD cash-in-transit untracked |
| GAP-017 | No UI-label to canonical-state mapping; 7 states have no surface |
| GAP-021 | `NOT RELEASED` semantics unresolved — the release gate may be modelled wrongly |
| GAP-026 | State names collide across independent machines with no namespacing |
| GAP-030 | Only 3 screens captured; every other screen frozen but unspecified |
| GAP-045 | **`QC` used 62 times, never defined** — controls restocking and refunds |
| GAP-052 | No tax model — blocks multi-jurisdiction growth |

## Coverage assessment

Percentages are **estimates with a stated basis**, not measurements. Each denominator is given so the figure can be recomputed and challenged.

| Measure | Score | Basis |
|---|---|---|
| **Overall documentation completion** | **30%** | 7 of 23 identified documents exist |
| **Business coverage** | **45%** | Of 22 business flows in the audit brief: 8 substantially documented, 5 partial (order-side view only), 9 absent |
| **Architecture coverage** | **35%** | Foundation layer complete (keystone, data, permission, audit) — 4 of 16 module documents |
| **UI coverage** | **25%** | 3 screens captured of an unknown total; sidebar alone implies 6+ modules with sub-navigation |
| **Design coverage** | **70%** | `DESIGN_CONSTITUTION.md` comprehensive across 21 articles; component library absent, responsive unverified |
| **Consistency score** | **75%** | Terminology largely canonical within documents; degraded by state collisions (GAP-026), UI/architecture naming divergence (GAP-043), 14 undefined terms (GAP-046) |
| **Production readiness** | **35%** | **Both decisions with permanent financial consequence are now made** — revenue recognition at delivery (`BD-304`, `GAP-002`) and Weighted Average Cost (`BD-298`, `GAP-005`). The Accounting module remains unwritten, which is now a *documentation* gap rather than an *undecided* one |

## Confidence level

| Aspect | Confidence | Reasoning |
|---|---|---|
| Findings against **existing** documents | **High** | All seven read in full; every finding verified by direct citation, occurrence count, or extracted state name |
| Findings of **absent** documents | **High** | Directory listing verified; MCP project list queried twice |
| **Completeness** of this gap list | **Medium** | Gaps *within* undocumented domains cannot be enumerated — you cannot audit the contents of a document that does not exist. Expect further gaps to surface as each of the 12 module documents is written |
| **Severity assignments** | **Medium-High** | Based on documented consequence and the observed operation. Business context could reasonably shift individual ratings |
| **Percentage estimates** | **Medium** | Denominators are stated and defensible, but "22 business flows" and "unknown screen total" are themselves judgments |

## Recommended sequence

Not a redesign — an ordering of the documentation work already registered.

| Priority | Action | Closes |
|---|---|---|
| **1** | Answer the two decisions, not documents: **revenue recognition point** and **inventory valuation method** | Unblocks GAP-002, GAP-005 |
| **2** | Confirm `NOT RELEASED` and `B2C Pending` with the business | GAP-021, GAP-022 |
| **3** | Write `INVENTORY`, `PAYMENT`, `ACCOUNTING` (including tax) | GAP-002, 003, 005, 006, 052–055 |
| **4** | Add the state naming convention and consolidated state register | GAP-026, 028, 043, 044 |
| **5** | Transcribe UI vocabulary and document the state-to-label mapping | GAP-017, 032, 033 |
| **6** | Extend the glossary; define QC | GAP-045, 046, 047, 048 |
| **7** | Write remaining module documents in registered dependency order | GAP-007–012 |
| **8** | Capture remaining screens; write the component library | GAP-030, 037, 038 |

---

# Discovery Reconciliation — 2026-08-06

Sales business discovery (`BUSINESS_DISCOVERY.md`, 116 answers) has closed nine gaps and opened four. **The original audit above is unchanged**; this section records what discovery settled.

## Gaps closed

| Gap | Was | Closed by | Answer |
|---|---|---|---|
| **GAP-021** 🔴 | `NOT RELEASED` semantics unresolved | `BD-039` | **The marker is being dropped.** Six explicit statuses replace it. The "release gate" reading was never the business's meaning (`BR-080`) |
| **GAP-031** | Employee ownership — HR in sidebar but out of scope in `SYS §2.2` | `BD-002` – `BD-005` | **HR and payroll are in scope.** The sidebar was right; the exclusion was an assumption (`SYS-078`) |
| **GAP-032** | Delivery failure causes undefined | `BD-073` | **Seven causes given.** Notably *"cannot pay COD"* is absent despite ~100% COD — `BD-217` |
| **GAP-035** | Payment-method vocabulary undefined | `BD-057`, `BD-066` | **Ten payment methods recorded** |
| **GAP-045** 🔴 | **`QC` used 62 times, never defined** | `BD-080`, `BD-082` | **Substantially closed.** Performer and qualification defined; serial verification and substitution checking confirmed as live practice. **Tolerances and dispute path still open** (`BD-225`, `BD-226`) |
| **GAP-063** | Verification attempt limits undefined | `BD-036` | **Three attempts, then a 7-day Callback window** (`BR-072`) |
| **GAP-064** | Return windows and eligibility undefined | `BD-077` | **14 days Daraz, 7 days elsewhere, assigned by channel** — not by category (`DM-030`) |
| **GAP-016** | Backorder handling unclear | `BD-100` | **Backorder is confirmed real practice**, though still unmodelled |
| **GAP-019** | Manual vs automatic transitions unstated | `BD-040` | **Partially closed — release is manual**, by a permissioned user (`BR-081`). Closure, reconciliation and RTO creation still unstated |

## Gaps opened

| Gap | Severity | Finding |
|---|---|---|
| ~~**GAP-069**~~ | ~~🔴 Critical~~ | **CLOSED 2026-08-06 by `BD-265`, `BD-266`, `BD-267`.** Policy defined: optional by default, never mandatory, no fixed rule; PCs not serialized; capture at any stage as **operational latitude**. All twelve rules resolved — `BR-022` **withdrawn**, `BR-021` **reclassified**, the remaining ten made **conditional**. See `BR-086` – `BR-091`, `DM-036`, `PRD-106` – `PRD-110`, `SMA-023` – `SMA-025`, `AUD-041` |
| **GAP-073** | 🟠 **High — accepted exposure** | **Component-substitution fraud on returned PCs is undetectable.** `PRD-036` was written on the reasoning that only component serials detect a returned case with a cheaper part fitted. `BD-265` states desktop PCs are not serialized and `BD-082` names no substitute check. **This is a deliberate business trade-off** — operational speed over the control — recorded so it stays visible and revisitable. `E-062` As-Built Record still detects a *different model*, not a *different unit of the same model*. **No action proposed; the business may record serials case by case on high-value builds** |
| **GAP-070** | ⬜ **OUT OF V1 SCOPE — 2026-08-10** | 🔴 **RECLASSIFIED, NOT CLOSED.** **The business has placed the legacy Laravel ERP outside the current architecture and implementation scope.** **The Java ERP is the canonical new system, designed from the canonical business/domain architecture rather than from the legacy schema.** ⚠ **Severity was 🔴 Critical while migration sat inside the V1 roadmap; it no longer does.** **If historical data migration is ever required it becomes a SEPARATE FUTURE PROJECT with its own discovery.** *Original registration retained below.* — ~~*This is a migration programme and migration is undocumented* (`BD-007`). An existing Laravel ERP holds live business data. No document in the set addresses data migration, cutover, parallel running, or reconciliation against the legacy system (`SYS-083`).~~ |
| **GAP-071** | 🟠 High | **Own-staff delivery creates a third settlement path with no model** (`BD-068`). Cash returns directly, with no courier remittance and no marketplace settlement. `OM §11` models two paths only (`BR-077`, `DMU-27`) |
| **GAP-072** | 🟠 High | **Installment sales are confirmed and modelled nowhere** (`BD-028`). No entity, no state machine, no receivable schedule (`DMU-26`) |

## Warehouse & Assembly reconciliation — 2026-08-06

**Closed by `BD-278` – `BD-292`:**

| Gap / unknown | Closed by |
|---|---|
| **`GAP-074`** Outbound QC context unmodelled | `BD-281` — build QC is an `SM-12` stage; return QC stays `SM-11` (`SMA-029`) |
| `PRDU-1` / `DMU-21` Build serial | `BD-283` — Build ID mandatory, marking optional (`PRD-116`) |
| `PRDU-2` / `DMU-22` Assembly labour in cost | `BD-286` — supported, optionally zero (`PRD-119`) |
| `PRDU-3` / `DMU-24` Compatibility validation | `BD-284` — advisory; warns, never blocks (`PRD-118`) |
| `DMU-20` Build Job state machine | `BD-281` — `SM-12`, eight stages (`SMA-026`) |
| `SMU-15` Quarantine holding state | `BD-289` — QC Pending **is** quarantine; `BR-046`/`INV-5.1` stand |
| `BD-227`, `BD-228`, `BD-245`, `BD-249`, `BD-250`, `BD-252`, `BD-253`, `BD-261` | Resolved in §17 |
| **Reservation point** (`BD-177`, `BD-178`) | `BD-278` — at order confirmation; `BR-052` amended (`BR-096`) |
| **`GAP-016`** Backorder unmodelled | **Partially** — `BD-280` and `BD-285` define the quantity model that makes backorder expressible; the flow itself is still unmodelled |

**Opened:**

| Gap | Severity | Finding |
|---|---|---|
| **GAP-075** | 🟡 Medium | **Repair lifecycle states are unspecified.** `BD-290` confirms performer, cost and cost bearer; *"repair status"* implies a tracked process whose states were not described. **Left open by ratified decision** — discovery deliberately not continued |
| **GAP-076** | 🟡 Medium | **Stock Count lifecycle unspecified.** `E-067` is registered at minimum level from `BD-292`; its states were not described. **Left open by ratified decision** |
| **GAP-077** | 🟢 Low | **Inventory-loss posting has no home.** `BD-291` requires scrap value to post as an inventory loss in Accounting — the first confirmed accounting posting from an inventory event. `ACCOUNTING_ARCHITECTURE.md` is `PLANNED` (`GAP-002`) |

**Reduced:** `GAP-073` — component-substitution fraud on returned PCs. The mandatory Build ID (`BD-283`) resolves a returned unit to its as-built record, detecting a *different model*. A *different unit of the same model* remains undetectable. Reduced, not closed.

## Purchase & Supplier reconciliation — 2026-08-06

**Closed by `BD-293` – `BD-303`:**

| Gap / unknown | Closed by |
|---|---|
| **`GAP-005`** 🔴 Inventory valuation method undecided | **`BD-298` — Weighted Average Cost.** One of the two decisions with permanent financial consequence |
| **`GAP-046`** Landed cost composition undefined | **`BD-297` — no landed cost.** Product cost is the supplier invoice price; freight, duty and clearing are period expenses. **Closed by removal** |
| `DMU-1`, `PRDU-11` | `BD-298` |
| `DMU-6`, `PRDU-12` | `BD-297` |

> **Production readiness moves.** This audit rated readiness at **20%** on the basis that *"two decisions with permanent financial consequence remain unmade: revenue recognition point (`GAP-002`) and inventory valuation method (`GAP-005`)."* **One is now made.** Only revenue recognition remains, and it belongs to Accounting.

**Opened:**

| Gap | Severity | Finding |
|---|---|---|
| **GAP-078** | 🟠 High | **Supplier prepayment has no representation.** `BD-299` creates the payable at acceptance; `BD-300` permits payment before goods arrive. Money paid against no liability. **The exact mirror of `SMU-14`** on the customer side — both must be resolved together, or the model will handle one direction and silently mis-record the other (`SMU-17`, `SMA-035`) |
| **GAP-079** | 🟡 Medium | **Per-supplier commercial terms are implied but unrecorded.** Three answers reference an agreement — `BD-288` *"unless another agreement exists"*, `BD-295`, `BD-300` *"depending on the agreement"*. **None states that terms are held in the ERP.** They may live outside it with only outcomes recorded, as approval does (`BD-109`). Not assumed either way |
| **GAP-080** | 🟢 Low | **Supplier settlement machines undecided.** Reuse `SM-8`–`SM-10` parameterised by counterparty, or separate machines? Reuse risks conflating two relationships; duplication risks two vocabularies (`SYS-016`). Deferred to the Return & Exchange module (`SMU-18`) |

**Cost transparency, recorded not flagged as a defect:** two ratified decisions place real costs outside product cost — additional build costs may be zero (`PRD-119`) and freight and duty are period expenses (`PRD-121`). Reported margin therefore **overstates**. `SYS-034` is **not** violated: these are classification decisions on known amounts, not unknowns recorded as zero (`PRD-123`).

## Accounting reconciliation — 2026-08-06

**Closed by `BD-304` – `BD-314`:**

| Gap / unknown | Closed by |
|---|---|
| **`GAP-002`** 🔴 Revenue recognition point undecided | **`BD-304` — at successful delivery**, uniform across all channels |
| **`GAP-078`** Supplier prepayment unrepresentable | **`BD-312` — advance balances**, symmetric on both sides |
| **`DMU-2`** Revenue recognition point | `BD-304` |
| **`DMU-16`** Charges as expense or contra-revenue | **`BD-306` — expense.** Revenue never netted |
| **`SMU-14`**, **`SMU-17`** Advance payment states | **`BD-312`.** It is a balance, not a payment state — `SM-5` unchanged, `SMA-035` withdrawn |
| **`BD-229`** 🔴 Refund gated on money received? | **`BD-310` — the gate is a definition, not a control.** A refund record follows the cash |

**Narrowed:**

| Gap | Now |
|---|---|
| **`GAP-003`** Taxation undocumented | **Deliberately out of scope** — VAT not charged, no returns filed, presentation only (`BD-307`). Re-entry touches line composition and reporting, not the core model |
| **`GAP-004`** Dashboard KPIs undefined | **Net Profit is now defined** by five components (`SYS-088`). What remains is period completeness — see `GAP-082` |

**Opened:**

| Gap | Severity | Finding |
|---|---|---|
| **GAP-081** | 🟡 Medium | **Refund recovery classification.** A marketplace refund arrives as a settlement deduction (`BR-126`), but a refund is not a fee for a service. Whether it belongs in `Marketplace Charges` or against revenue is not established |
| **GAP-082** | 🟠 High | **Net Profit completeness varies by period.** Revenue and COGS post at delivery; channel charges at settlement up to 7 days later, so **Today overstates by roughly the whole channel cost** — and the dashboard is specified to prioritise Today (`BD-313`, `SYS-089`). Accrue at delivery, or label the figure? **A business decision, not an architectural one.** Until settled, any Net Profit display must state its basis |
| **GAP-083** | 🟢 Low | **HR & Payroll is not registered as a planned document.** It is in scope (`SYS-078`) and deliberately deferred past V1 (`SYS-093`). A deferred module still belongs on the index, or the index understates eventual scope |
| **GAP-084** | 🟡 Medium | **Claim compensation classification** (`BD-324`). An approved marketplace claim brings money in from Daraz that is **not revenue**. Whether it is a recovery of a loss or other income is unstated. **Pairs with `GAP-081`** — same shape, opposite direction; resolving one likely resolves the other, and guessing either would misstate marketplace profitability |
| **GAP-085** | 🟡 Medium | **Completeness reconciliation is unbuilt and has no owner** (`BD-320`, `PRD-130`). Incremental sync answers *"what is new?"*; **an order that never arrived is invisible from inside the ERP** and only comparing against the marketplace's own list reveals it. Staff do this manually today. `PRD-075` idempotency already prevents duplicates; **absence has no equivalent protection** |
| **GAP-086** | 🟢 Low | **Distinguishing a *late* order from a *missing* one requires a threshold that does not exist.** A concrete instance of `GAP-024` / `SMU-5` rather than a new gap — recorded because marketplace sync is where it first has operational consequence |
| **GAP-087** | 🔴 High | **`BD-334`'s overdue-warranty requirement cannot be built as stated.** The business requires cases *"longer than expected"* to be highlighted, but **states no expectation** — no target duration, no per-stage limit, no basis for one. Deriving a threshold from historical averages would be **inventing business policy** (`DM-001`). Note the scope: **three of five duration factors are external** (supplier, service centre, manufacturer), so any internal expectation can only cover stages Trioloo controls — `SM-15.WAITING_FOR_PARTS` is the sole credible candidate (`SMA-046`) |
| **GAP-088** | 🟡 Medium | **A warranty repair needing a part is a purchase trigger absent from `BD-293`.** The five stated triggers are low stock, components short for confirmed orders, expected demand, management decision, and a customer order needing unavailable items. **A warranty repair is none of these** — the part may be needed for a unit sold years ago. **The purchase demand is real and currently unaccounted for** |
| **GAP-089** | 🟡 Medium | **Current configuration has no owner** (`BD-337`, `PRD-044` amended). After a repair, a unit's physical configuration is **neither the As-Built Record nor the repair history alone — it is the composition of both**. Whether the derived view is computed on demand or maintained is undecided |
| **GAP-090** | 🟢 Low | **A loaner is stock that is physically absent but still owned** (`BD-335`). `BR-104` covers three present-but-not-sellable conditions; this is the inverse. **An untracked loaner reads as missing stock at the next count** (`BD-292`) and gets investigated as a discrepancy that was never one. Low volume, real consequence |
| **GAP-091** | 🟡 Medium | **"Unusually frequent returns" has no threshold** (`BD-351`). The ERP *may highlight* such customers, but *unusually* is undefined — the same shape as `GAP-087`. **`BD-350` now supplies the pattern** (configurable period → named state → follow-up); **the value itself remains the business's to set** and is not assumed |
| **GAP-092** | 🟢 Low | **No allocation basis exists for components of an assembled product.** `PRD-053` defines one for bundles only. Component **refund** on an assembled PC is therefore not expressible; component replacement/exchange is unaffected. **Only becomes live if the business later requires component refunds** |
| **GAP-093** | 🟡 Medium | **Revenue recognition on a converted replacement is undecided** (`BD-350`). Converting an unreturned advance-exchange replacement into a normal sale means recognising revenue for a delivery that **already happened**. Recognising at the original delivery date reopens a closed period and conflicts with `DB-003`; recognising at conversion dates revenue after its own delivery. **`BD-311`'s precedent — bad debt does not reverse revenue because *the past does not move* — points to forward recognition**, but this is not stated and is not assumed. Rare, with a real consequence: guessing would misstate a period |
| **GAP-107** | 🟡 Medium | **Duplicate settlement detection is directional** (`BD-402`). The external-reference test protects only when **both** records carry the key. Bank credits rarely carry a marketplace settlement ID, so a manual entry typically has **no reference** — and an API import carrying one has nothing to match against, so **both post**. Closing it needs validation running the other way: an import checking for an unreferenced manual record with matching marketplace, amount and date. **The rule states the confirmation path as the fallback for *manual* capture; whether it applies to *automatic* is not said** |
| **GAP-108** | 🟢 Low | **`Cash → Cash` is absent from the supported matrix** (`BD-401`). Consistent with a single till today — but `PRM-064` makes **Branch** and **Warehouse** scope dimensions, and a second location means moving cash between them. **Flagged rather than assumed omitted**; `Bank → Bank` and `Wallet → Wallet` are both present |
| **GAP-109** | 🟢 Low | **Opening balances have no stated origin.** Under `DB-001` balances derive from movements, so **the first balance in every Financial Account must come from somewhere.** A setup concern rather than a business rule, and safely deferred — but it cannot be silently skipped |
| **GAP-110** | 🟢 Low | **Two Fund Transfer readings await confirmation** (`BD-403`): `Funds In Transit` as a **system-managed `E-068` instance**, and `Reversed` as an **overlay rather than a state**. Both are recorded as the reconciling readings that keep `DB-002`/`DB-003` intact; **neither is asserted as a business rule** |
| ~~**GAP-129**~~ | ✅ **RESOLVED 2026-08-11** | **Assembly of a configuration with no pre-existing reusable Sellable Product and Build Template had no canonical representation.** **`INV-32.3` + `INV-65.1` + `PRD-081` + `PRD-088` + `BR-006` together required a catalogued Sellable Product with an ACTIVE Build Template before ANY assembly, so a one-off configuration was unbuildable and the only workaround — auto-creating a product — would have polluted the catalogue.** ✅ **RESOLVED by business decision (Option C): `E-103` Order-Specific Build Configuration and `E-104` Configuration Line, Warehouse-owned (`DM-081`), carrying a staff-confirmed component plan for ONE order.** **`INV-65.1`, `INV-32.2`, `INV-62.2`, `PRD-088` and `BR-006` amended narrowly with superseded wording retained** (`DOC-009`); **`WHS-075`–`WHS-079`, `PRD-144`–`PRD-147`, `BR-177`, `IVN-054`, `DM-081` created.** ⚠ **Raised and resolved on the same date: it was found by the pre-amendment reconciliation, not carried from discovery** |
| ~~**GAP-130**~~ | ✅ **RESOLVED 2026-08-11** | **The authority to confirm an Order-Specific Build Configuration, and to promote one for reuse, was not canonically established.** ✅ **RESOLVED by business decision:** **`DRAFT → ACTIVE` confirmation requires WAREHOUSE SUPERVISOR authority or an explicitly granted equivalent capability (`WHS-081`), enforced as a PERMISSION through `AGV-018`'s four-part composition and NEVER as a role-name test; preparation authority never implies confirmation authority (`WHS-080`); Administrator receives nothing implicitly (`PRM-068`); scope bounds but never grants (`AGV-021`); the recommendation engine may never confirm (`WHS-081.f`).** ✅ **PROMOTION needs NO new capability — `§24`'s Product administrator WITH APPROVAL and `PRD-092`'s audit already govern exactly what promotion performs (`PRD-147.c`), and the two authorities are mutually non-transferring (`PRD-147.d`).** ✅ **Assembly-time substitution is untouched (`WHS-083`, `PRD-038`–`PRD-041`).** ⚠ **The LITERAL permission-code string remains undefined because no canonical vocabulary generates one** (`PRM-007`) — 🔴 **that is a naming artefact, not a missing business decision, so it opens no gap and implementation must not invent the code** |
| **GAP-103** | 🔴 High | **Teardown — the inverse of assembly — does not exist in the architecture** (`BD-388`, `E-082`). `SM-12` Build Job turns many components into one product; **Trade-In acceptance turns one product into many components**, plus some that never become inventory. `PRD-009` separates assembly from bundling; **neither describes disassembly.** This is a genuinely new operation, not a variation, and it is the largest structural finding in the domain |
| **GAP-104** | 🟡 Medium | **A salvaged component must not enter the same SKU as new stock** (`DM-077`). Weighted Average Cost averages across a SKU, and `PRD-121` makes product cost the supplier invoice price for new goods — **a used part entering the same SKU would blend salvage cost into new inventory.** Recorded as a consequence to test; **not stated by the business and not inferred** |
| **GAP-105** | 🟢 Low | **Valuation on legal transfer of abandoned property is undefined** (`SYS-103`). If ownership transfers, the item has **no acquisition cost** while `SYS-102` requires one. Two readings — it still never enters inventory, or a valuation is required at transfer. **Rare, recorded so it is not found during implementation** |
| **GAP-106** | 🟢 Low | **Whether billable services exist as a concept is unestablished** (`BD-394`). Trade-In Credit is spendable on *"products **or services**"*, and `E-072`'s chargeable repair makes services plausible — but no answer states that services are sold and priced. **Noted, not assumed** |
| ~~**GAP-101**~~ | ✅ **CLOSED 2026-08-08** | **`NOTIFICATION_ARCHITECTURE.md` v1.0.0 WRITTEN.** 38 rules (`NOT-001` – `NOT-038`), all traceable to confirmed decisions; no new business rule, entity or lifecycle introduced. Six cross-domain requirements accumulated since `BD-279` now have an owner. *Original finding:* **the content was specified, the owning document did not exist.** Three entities (`E-055`, `E-079`, `E-080`), four system rules (`SYS-098` – `SYS-101`), three categories, seven configuration dimensions, a four-level cardinality and a V1 delivery scope are all settled and currently live in `DOMAIN_MODEL.md` and `SYSTEM_ARCHITECTURE.md`. **The specification exists; the owning document does not** — `DOC-015` still bars development |
| **GAP-102** | 🟢 Low | **Notification Sound is listed both as a V1 delivery method and as a presentation property** (`BD-387`). **Sound is an attribute of a delivery, not a channel** — a notification cannot be delivered *only* as a sound with nothing to see. Recommend modelling it as presentation |
| **GAP-098** | 🔴 High | **Scope dimensions must be addable as configuration, not structure** (`BD-377`, `PRM-064`). Ten dimensions are declared, two marked *future*. Because the business chose **explicit per-channel dimensions** over a generic Channel Instance, **every new marketplace or messaging channel is a new *dimension*, not a new value** — and this business adds channels regularly. **A design enumerating the ten in fixed structure satisfies V1 and then forces an authorization-model change**, against the stated requirement of growth *"without changing the authorization model"* |
| ~~**GAP-099**~~ | ✅ **CLOSED 2026-08-08** | **`ACCESS_GOVERNANCE_ARCHITECTURE.md` v1.0.0 written; `AGV-035` registers the four surfaces as one administrative area.** *Original finding:* **the four access-governance surfaces have no single owner** (`PRM-058`, `PRM-059`, `PRM-063`, `PRM-067`). Permission derivation, override review queue, self-administration reporting and the access review dashboard share a subject, an audience and a data source. **Registered as one area; not yet assigned to a document.** Building them separately is how a seven-person business acquires four modules it did not need |
| **GAP-100** | 🟢 Low | **Dual-approval build scope undecided** (`BD-378`). `PRM-048`/`PRM-049` found approval-workflow machinery unnecessary — but for **business** approvals; this concerns **administrative** ones. Documented position: the policy must be expressible and the model must not preclude it, **but building the mechanism is not justified while one administrator exists**. Also open: whether `PRM-033`'s controlled-vocabulary requirement applies to override reasons, and whether `PRM-028`'s *override frequency by actor* signal survives |
| **GAP-097** | 🟢 Low | **The actor typology is implied but not enumerated** (`BD-369` rename, `BD-371`). The profile's components apply *"depending on the user type"*, and five actor types are named — Human, System, Integration, Automation, AI Service — but **whether system identities are formally one of those types is not stated**. Recorded as the reading that makes `PRM-005` and the seven-component profile consistent; **not asserted as a business rule** |
| **GAP-094** | 🟢 Low | **First Response SLA measurement is ambiguous** (`BD-364`). *"From the customer's **latest** unanswered message"* means each new inbound message **restarts the clock** — a customer who keeps writing would never appear `Overdue`, however long they have waited. The wording says *latest*; the intent (*how long has this customer been waiting?*) points to *first unanswered*. **Not inferred and not corrected** — a small definition with a real behavioural effect, worth settling deliberately rather than discovering in a dashboard that under-reports |
| **GAP-095** | 🟢 Low | **Which timestamp anchors the inactivity clock is unstated** (`BD-365`). Both `Last Customer Reply` and `Last Business Reply` are captured, so either computation is available; the business has not said which |
| **GAP-096** | 🟡 Medium | **Conversation-to-lifecycle linkage: direct or via the case?** `BD-358` links conversations directly to Warranty, Return and Exchange cases; `BD-354` implies routing through the Business Case. **Two paths to one relationship is what `CP-12` exists to prevent.** Plausible reconciliation — a case may not yet exist when the conversation is linked, making direct links an **early-binding artefact** rather than a parallel model — but this is **not stated and not assumed**. Cheap to decide now, expensive later |
| **GAP-026 ⬆** | 🟡 **Escalated** | **State-name collision now has a concrete instance requiring resolution, not merely notation.** `SM-13` Warranty Claim and `SM-15` Repair share **eight stage names** (`SMA-047`). They must not be merged — that would collapse repair's three entry points — so **machine-qualified state naming is now required rather than advisable** |

**Carried forward, unchanged:** the dispatched-but-undelivered cost position (`BD-305`) — goods out of stock but not yet COGS, with no established home. At ~100% COD and seven delivery-failure causes (`BD-073`), this population is not marginal.

> **Production readiness reassessed: 35% → 50%.** Both permanent-consequence decisions are made (`GAP-002`, `GAP-005`), the financial model is buildable, and the V1 report set is defined. What remains is **documentation** — `ACCOUNTING_ARCHITECTURE.md` and `REPORTING_ARCHITECTURE.md` are both `PLANNED`, and their confirmed content currently sits as interim placement in `SYSTEM_ARCHITECTURE.md` §11.1 and `ORDER_MANAGEMENT_ARCHITECTURE.md` §9.9A/§9.9B.

## Blocking questions — architecture cannot proceed without these

Ordered by how much they block. Each is already queued in `BUSINESS_DISCOVERY.md`.

| # | Question | Blocks | Why it blocks |
|---|---|---|---|
| ~~**1**~~ | ~~`BD-242` — When is a serial recorded?~~ | — | **✅ RESOLVED 2026-08-06** by `BD-265` – `BD-267`. `GAP-069` closed; 12 rules resolved. Residual exposure recorded as `GAP-073` (accepted) |
| ~~**2**~~ | ~~`BD-254` — Are completed orders and financial records edited in place?~~ | — | **✅ RESOLVED 2026-08-06. Corrected by linked adjustment records; originals never change; audit history immutable.** `DB-002`, `DM-008`, `AUD-006`, `BR-048`, `INV-50.3` all confirmed unchanged. `BD-230` closed with it. New rules `DB-077`, `DB-078`, `SYS-085`, `BR-085`, `DM-035` |
| ~~**3**~~ | ~~`BD-255` — Are discount limits enforced numerically, or judged case by case?~~ | — | **✅ RESOLVED 2026-08-06 by `BD-275`. Judged case by case — no numeric limits, and per-user limit capability must NOT be built.** `BD-052`/`BD-053` superseded; `PRMU-5` closed by removal; `PRM-047` resolved. New rules `PRM-052`, `PRM-053`, `BR-092` – `BR-095`, `DM-037`, `DM-038`, `AUD-042` |
| **4** | `BD-144` — **Retention vs a 12-year warranty** | `AUD-017`, `AUD-037`, `DB-052`, `INV-51.1` | A year-9 claim would find its evidence disposed of |
| ~~**5**~~ | ~~May published stock exceed derived availability?~~ | — | **✅ RESOLVED 2026-08-06 by `BD-280` — yes, deliberately. `PRD-073` amended, `PRD-079` WITHDRAWN (`PRD-112`)** |
| ~~**6**~~ | ~~Where does reservation actually occur?~~ | — | **✅ RESOLVED 2026-08-06 by `BD-278` — at order confirmation, both workflows. `BR-052` amended (`BR-096`)** |
| ~~**7**~~ | ~~How does build-to-stock combine with component-derived availability?~~ | — | **✅ RESOLVED 2026-08-06 by `BD-285` — Available = Ready-built + Buildable (`PRD-111`)** |
| **8** | `BD-244` — **What are the states of a warranty claim?** | `SMA-018`, `SMU-13` | A third inbound flow with no lifecycle |
| **9** | `BD-229` — **Is refund gated on money received, not only goods received?** | `BR-041` | At ~100% COD, refunding before settlement pays out money not yet collected |
| **10** | `BD-256`, `BD-257` — **Is a reason captured, and is the actor always the real approver?** | `AUD-039`, `PRMU-7` | Determines whether the sole remaining control is meaningful |

## Revised totals

| | Original audit | After discovery |
|---|---|---|
| Total gaps | 68 | **72** (9 closed, 4 opened, `GAP-068` retained) |
| Open gaps | 68 | **63** |
| Critical | 17 | **17** — `GAP-021` and `GAP-045` closed, `GAP-069` and `GAP-070` opened |

> **Discovery closed more than it opened, and what it opened is more precisely stated.** `GAP-069` and `GAP-070` are both consequences of learning something true rather than of documentation being absent — which is the intended outcome of discovery.

---

**No document was modified during the original audit.** No business logic was invented, no architecture rewritten, and nothing silently fixed. Every gap above is reported for a human decision. **The reconciliation section records changes made on 2026-08-06 from confirmed business answers, each cited to its `BD-` number.**

**Amendment record**

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-04 | Initial audit. 7 documents examined, 16 verified absent, Claude Design project verified empty. 68 findings |
| **1.1.0** | **2026-08-06** | **Sales discovery reconciliation.** 9 gaps closed (`GAP-016`, `019` partial, `021`, `031`, `032`, `035`, `045` substantial, `063`, `064`); 4 opened (`GAP-069` – `GAP-072`); 10 blocking questions listed. Source: [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md), 116 answers |
| **1.2.0** | **2026-08-06** | **Blocking question 2 resolved.** Immutability decision confirmed (`BD-254`, `BD-230`) — the architecture required no change; `DB-002`, `DM-008`, `AUD-006`, `BR-048`, `INV-50.3` all confirmed. **9 blockers remain**, `BD-242` (serial recording policy) still first |
| **1.3.0** | **2026-08-06** | **`GAP-069` CLOSED** by `BD-265` – `BD-267`; blocking question 1 resolved. **`GAP-073` opened** — component-substitution fraud undetectable on non-serialized PCs, recorded as an accepted business trade-off. **8 blockers remain** |
| **1.4.0** | **2026-08-06** | **Blocking question 3 resolved** — discount policy finalized (`BD-275`). `PRMU-5` closed by removal. **7 blockers remain**, `BD-144` (retention vs 12-year warranty) now first |
| **1.5.0** | **2026-08-06** | **Warehouse & Assembly reconciliation.** `GAP-074` closed; blocking questions 5, 6 and 7 resolved. **`GAP-075` – `GAP-077` opened**, two of them deliberately left open by ratified decision. `GAP-073` reduced by the mandatory Build ID. **4 blockers remain** |
| **1.6.0** | **2026-08-06** | **Purchase & Supplier reconciliation.** **`GAP-005` and `GAP-046` CLOSED** — one of the two permanent-financial-consequence decisions is now made. `GAP-078` – `GAP-080` opened. **Only `GAP-002` revenue recognition remains of the two** |
| **1.7.0** | **2026-08-06** | **`GAP-002` revenue recognition point DECIDED** (`BD-304`) — at successful delivery. **Both permanent-financial-consequence decisions are now made.** Production readiness reassessed 20% → 35%; the Accounting gap is now documentation, not indecision |
| **1.8.0** | **2026-08-06** | **Accounting reconciliation.** `GAP-002`, `GAP-078`, `DMU-2`, `DMU-16`, `SMU-14`, `SMU-17` and `BD-229` closed; `GAP-003` and `GAP-004` narrowed. `GAP-081` – `GAP-083` opened. **Production readiness 35% → 50%** — the financial model is buildable; what remains is documentation |
| **2.45.0** | **2026-08-11** | ✅ **`GAP-130` RESOLVED by business decision.** **Confirmation of an `E-103` requires Warehouse Supervisor authority or an explicitly granted equivalent capability, enforced as a permission and never as a role name; promotion is already fully governed by existing Product administration and needed no new capability.** 🔴 **NO NEW GAP OPENED.** **The literal permission-code string is undefined because no canonical vocabulary generates one — a naming artefact, not a missing business decision** (`PRM-007`, `§15` of the resolving task). 🔴 **No event was invented either: `EVA-019` states that a state transition is not evidence an event exists, and where the architecture confirms a transition without stating that anything is published, the transition stands and no event is written.** ⚠ **No other gap opened, closed, reclassified or renumbered.** | ✅ **`GAP-129` REGISTERED AND RESOLVED; `GAP-130` REGISTERED AND OPEN.** 🔴 **`GAP-129` was found by reconciliation before any amendment was written: five ratified rules together made a one-off build impossible, and the only workaround would have polluted the Sellable Product catalogue. It is recorded rather than quietly designed around** (`DOC-065`). ✅ **Resolved by explicit business decision (Option C) — `E-103`/`E-104`, Warehouse-owned.** ⚠ **`GAP-130` is the residue that decision did NOT answer: who may confirm a configuration, and who may promote one. No permission code exists in the corpus to bind, so it is left open rather than invented** (`PRM-007`, `DOC-024`). 🔴 **No other gap opened, closed, reclassified or renumbered. `GAP-103`, `GAP-047`, `GAP-003`, `GAP-059`, `GAP-089`, `GAP-104`, `GAP-109` and `GAP-112` all remain exactly as they were.** | 🔴 **DOCUMENTARY ONLY — no gap opened, closed, reclassified or renumbered.** **The §Summary Dashboard was still presenting the ORIGINAL 68-finding audit snapshot as though it were current, while the register holds `GAP-001` – `GAP-128`.** ✅ **It is now explicitly labelled a HISTORICAL SNAPSHOT, its numbers PRESERVED rather than recalculated, and readers are pointed to the individual `GAP-nnn` entries and the Version History as authoritative.** ⚠ **A severity distribution across 128 entries was NOT invented** (`DOC-009`). **Raised by the Final V1 Architecture Audit.** |
| **2.43.0** | **2026-08-10** | ⬜ **`GAP-070` RECLASSIFIED OUT OF V1 SCOPE — business decision at the opening of Technology Architecture.** **The legacy Laravel ERP is placed outside the current architecture and implementation scope; the Java ERP is the canonical new system.** **Out of the V1 roadmap: migration, coexistence, cutover, legacy import, compatibility layers, migration tooling, and any constraint on the Java architecture derived from the Laravel schema.** 🔴 **RECLASSIFIED, NOT CLOSED** — **the business has not said migration will never happen, only that it is not this project**; **if ever required it becomes a separate future project with its own discovery.** **Original registration retained under `DOC-009`.** ✅ **Consequence: the corpus's only 🔴 Critical open item leaves the V1 roadmap** — `GAP-070` was classified `B` and described as *an entire unwritten workstream, not a gap*. ✅ **Second consequence: the persistence model is freed** — **a migration requirement would have pulled the schema toward the legacy shape, and `DB-001`/`ACC-001`'s ban on stored balances plus `DB-002`/`DB-003`'s append-only history are far easier to honour in a clean schema.** ⚠ **`GAP-109` opening balances is NOT the same item and remains registered** — **a system with no migration still needs a defined day-one starting position for inventory, accounting and employee balances.** **`SYS-083` unchanged as a rule; `BD-007` and its follow-ups not reopened** |
| **2.42.0** | **2026-08-10** | ✅ **DOCUMENT / PRINTABLE ARCHITECTURE — `GAP-128` registered.** 🔴 **Quotation and Proforma Invoice cannot be architected: `BD-134` has been UNANSWERED since 2026-08-05**, and **`BD-006B` names both without any further discovery** — **nothing states when either is issued, what it contains, whether it is numbered, whether it binds a price, whether it expires, or what conversion to an order does.** ✅ **Class A but narrow — it blocks THOSE TWO DOCUMENTS ONLY, not the stage**, since every other V1 document is fully architected (`PRN-023`). ✅ **What IS settled is preserved: neither is a Sales Invoice** (`BD-443`) **and neither creates revenue, a receivable, a tax liability or a completed sale** (`BD-304`). ✅ **Warranty Card DETERMINED NOT REQUIRED** rather than left ambiguous — **`WAR-021` makes it an additional reference only, never primary proof, whose absence never refuses a claim, and `BD-339` does not state whether issuance is even recorded.** 🔴 **`ACC-057` REPAIRED** — it read *the authorised journal-entry mechanism DOES NOT EXIST*, **true on 2026-08-09 and false on 2026-08-10 when `GAP-117` was resolved by `E-089`**; **the propagation was missed then and is corrected now** (`DOC-021`) |
| **2.41.0** | **2026-08-10** | ✅ **FINAL SETTLEMENT ARCHITECTURE — `HRP-061` – `HRP-088`, `E-100`/`E-101`. `GAP-127` registered; no existing GAP reopened.** ✅ **No V1 blocker found.** **The `BD-491`/`BD-492` double-count question, the `BD-493` capacity question and the `BD-494` finalisation question were all already answered by discovery and needed only ratification.** 🔴 **`GAP-127` REGISTERED — an authorised earning nominated to a payroll period that will never run** has no payable position for Final Settlement to consume. **Two routes into it: a bonus authorised for a future period where the employee leaves first, and a commission becoming eligible because an Order delivers after departure** — **recorded at `BD-496` and `BD-497` as one family, registered here.** ✅ **Class B, not a blocker**: **the final payroll period is the natural nomination, an earning nominated to a period that runs IS included, and one nominated to a period that never runs is correctly not payable** — ⚠ **but nothing REQUIRES re-nomination, and inventing automatic re-nomination would be creating policy** (`DOC-023`). ✅ **`HRP-080` already routes post-finalisation facts through the correction discipline** |
| **2.40.0** | **2026-08-10** | ✅ **HR & PAYROLL ARCHITECTURE — `GAP-119`, `GAP-123` and `GAP-124` ALL CLOSED; `GAP-126` registered.** **`GAP-119`**: all six closure conditions met — **`ACC-093` salary payable, `HRP-042` recovery occurrence, `HRP-043` specific allocations, `E-087` counterpart unchanged, `HRP-045` reconciliation, `INV-94.4` no duplicate balance** — and **`ACC-097` records all five Advance settlement routes as specified**, ⚠ **with NO new mechanism required, exactly as `BD-479` §6 anticipated.** **`GAP-123`**: **Accounting owns Employee Loan** (`ACC-086`, `E-098`, `E-099`) — ⚠ **TESTED not assumed, by re-applying `ACC-060`'s own test: the position is an accounting position and the parts that are not already have owners** — **HR owns only the recovery occurrence, and split ownership of the POSITION was rejected under `DOC-005`.** **`GAP-124`**: **Accounting owns Outstanding Salary Payable** (`ACC-093`) — **`Finalised Net Salary − Confirmed Salary Payments`, derived and never editable, established by Payroll and settled by Payment.** ⬜ **`GAP-083` superseded in effect** — `SYS-093` amended, the module is V1 and written. 🔴 **`GAP-126` REGISTERED**: **six of `BD-005`'s twelve deduction types have no formula at all** — damage/loss, penalty, Tax, PF, other recurring, other one-time — **with `BD-128`/`BD-129` unanswered since 2026-08-05 and `SYS-092` keeping statutory reporting out of V1.** ✅ **Not a V1 blocker**: `HRP-040`'s three classes absorb a new deduction without structural change, and **`BD-481` §1's floor was written precisely to protect against deduction types that do not yet exist** |
| **2.39.0** | **2026-08-10** | ✅ **`GAP-125` REGISTERED AND CLOSED in the same pass — marketplace Order sync ownership. Source `BD-498`.** 🔴 **A live contradiction between ratified rules**: **`BR-003` prohibits local edits to mirrored fields *never a local override*; `§3.5` declared DIRECT-CHANNEL order content Trioloo-owned and NEVER declared who owns MARKETPLACE order content** — **which `API-005` forbids** — **while `§7.8`/`§7.9` give marketplace Orders full verification and let an agent amend address, quantity, product and price.** **A developer had no correct behaviour to write, with `BD-319` pulling one way and `BR-003` the other.** ⚠ **Verified before registering that no prior GAP covered it** — `GAP-085` is completeness reconciliation and `GAP-086` is late-versus-missing thresholds, **neither about ownership or overwrite.** ✅ **CLOSED by `BR-168` – `BR-176`, which remove the PRECONDITION rather than choosing a side**: **`BR-003`'s antecedent is *where an external party holds authority*, and the Order-level `API_MANAGED` → `ERP_MANAGED` transition means it no longer does after takeover** — **so `BR-003` stands unchanged, `§7.9` needed no change, `§3.5` gained its missing row, and `BR-171` keeps external facts syncing where authority genuinely remains external.** **Registered rather than skipped because `DOC-009` requires the finding to survive its own resolution** |
| **2.38.0** | **2026-08-10** | 🔴 **`GAP-124` REGISTERED — the outstanding-salary-payable position exists in DISCOVERY ONLY.** **Found while reconciling `BD-490` §4.** **`BD-476` describes salary earned but not yet paid; no ratified `ACC-` rule establishes it**, and ⚠ **verified before registering that `BD-476` had never been referenced in this document.** **Load-bearing because `BD-490` §4 makes it the FIRST named component of Final Settlement's positive side, while `BD-490` §2 requires Final Settlement to be a computed view over AUTHORITATIVE underlying positions** — **and for this component no authoritative position exists.** ⚠ **Distinct from `GAP-119`**, which is the salary-RECOVERY counterpart — the position a deduction moves value TO; **`GAP-124` is the opposite direction, what Trioloo OWES.** **Same defect class as `GAP-123`: a discovered position the architecture does not own** — **two now exist, both surfaced within Employee Loan and Final Settlement discovery.** ✅ **`GAP-123` is separately CONFIRMED BY THE BUSINESS** — `BD-490` §2 says Employee Loan retains its position *once its owning architecture is ratified* — ⚠ **so `GAP-123` now blocks TWO architectures: HR & Payroll, and Final Settlement.** **Neither blocks further discovery** |
| **2.37.0** | **2026-08-10** | 🔴 **`GAP-123` REGISTERED — Employee Loan has NO owning module and NO entity anywhere in the architecture.** **Found while reconciling `BD-488` §9.** **It appears in `ACCOUNTING_ARCHITECTURE.md`, `SYSTEM_ARCHITECTURE.md` and `DOMAIN_MODEL.md` in NONE of them** — existing only in `BUSINESS_DISCOVERY.md` §41 and in `PRM-075` – `PRM-078`. ⚠ **Load-bearing because `BD-488` §9 requires a write-off's accounting consequence to follow the existing architecture, and `BD-486` §8 names *the Employee Loan capability* as authoritative for the position — but NO document owns it** (`DOC-005`). 🔴 **It cannot be closed by inference**: **`ACC-060`/`ACC-061` assign Advance/Requisition to Accounting because the position it maintains is an accounting position**, with `E-086` – `E-088` carrying it, **and that reasoning would apply equally to a loan** — ⚠ **but applying it is exactly the pattern-matching `BD-488` §10 forbids.** ✅ **The business behaviour is extensively discovered** (`BD-477`, `BD-479` – `BD-481`, `BD-484`, `BD-486` – `BD-488`) **and two answers separately establish that the loan needs NO new accounting mechanism** — no income leg (`BD-487`) and `E-089` unmodified for write-off (`BD-488` §9). **Blocks HR & Payroll ARCHITECTURE, not further discovery** |
| **2.36.0** | **2026-08-10** | ✅ **`GAP-120`, `GAP-121` and `GAP-122` REGISTERED; the Owner-definition gap CLOSED. Owner designation, `BD-485`.** **The G2 finding from the read-only User/Profile/Owner audit is resolved**: **Owner is an authority designation on the Operational User Profile, granted and revoked only by an existing Owner, unreachable through role, scope or override** (`AGV-037` – `AGV-041`). ✅ **Three authority bindings that could not previously be evaluated now can** — write-off (`ACC-067`), payroll deduction waiver (`PRM-073`) and Employee Loan authorisation/pause (`PRM-076`, `PRM-077`) — **each binds to the Owner title, and *is this actor an Owner?* now has a defined answer.** 🔴 **Three items registered rather than inferred.** **`GAP-120` first-Owner bootstrap** — `AGV-038` assumes an Owner exists and `AGV-011` cannot create the first account; **a deployment concern, deliberately excluded by `BD-485` §10, and it does NOT block HR & Payroll** because the payroll authorities evaluate against an existing Owner. **`GAP-121` nothing constrains granting ANOTHER user an authority the grantor lacks** — `PRM-046` and `AGV-032` are **self-only** — **closed for Owner, open elsewhere**, though `PRM-003`/`PRM-004` still check the authority when exercised, so **the exposure is the grant act rather than the resulting action.** **`GAP-122` self-revocation is undefined and the LAST-OWNER case rests on that silence** — ⚠ **zero Owners is currently unreachable, but by silence rather than design; if self-revocation is later permitted the last Owner could remove themselves and `AGV-038` would make it UNRECOVERABLE.** **No last-Owner floor, minimum count, succession or Administrator fallback invented** (`DOC-023`) |
| **2.35.0** | **2026-08-10** | ✅ **`GAP-117` and `GAP-118` RESOLVED; `GAP-119` registered. Advance / Requisition architecture, `BD-448` – `BD-457`.** **`GAP-117`**: **`E-089` Authorised Accounting Adjustment posts from an authorised business decision and CANNOT EXIST WITHOUT ONE** — **that single constraint is what keeps it from being a free-form journal system**; no unrestricted ledger entry, no arbitrary debit/credit screen, no user-originated posting. **Fabricates no cash movement, immutable with corrections as new linked adjustments, permission held by the owning capability's own rule, creates no new account or category, and a Journal Voucher renders it but never creates it.** **Two of three confirmed needs fully served — accepted expense and write-off.** ⚠ **The third is deliberately incomplete: `ACC-084` states the salary-recovery counterpart needs HR & Payroll, and the route is NOT implemented** → **`GAP-119`**. **`GAP-118`**: **`PRM-006` amended to carry a narrow, capability-scoped exception**, universal wording retained under `DOC-009`; **not a general right, not self-grantable, and only Advance Requisition names it.** ⚠ **`INV-29.1` TESTED and STANDS UNCHANGED** — Procurement names no exception, so `PRM-006`'s default still binds Purchase Orders, and **changing that needs its own business decision.** **`PRM-012` untouched and now load-bearing** |
| **2.34.0** | **2026-08-09** | 🔴 **`GAP-118` registered — `BD-452`, Advance / Requisition discovery. Class B, must resolve pre-implementation. REPORTED, NOT RESOLVED.** **`BD-452` permits a person to request and authorise the same Advance Requisition** where they hold the permission, and **forbids a mandatory second-person rule.** **`PRM-006` says the opposite** — ***No actor approves their own request, override, or exception*** — a stated principle under `§4.6 P6`. ⚠ **`PRM-066`'s narrowing does not reach it**: that exempts *acting within authority one already holds — **no approval step involved*** — and **an Advance Requisition HAS an explicit approval step.** ⚠ **`PRM-050` does not settle it either** — it left `PRM-006` *“as written, enforceable as the team grows”* under `PRM-014`'s accepted-conflict route, whereas **`BD-452` states a permission model that must not be overridden at all.** **Different positions, not the same one.** ✅ **Discovery is not blocked** — the conflict is about **who may authorise**, not what the capability does, and **audit is unaffected** because `BD-452` keeps Requested By/At and Authorised By/At separate even when one person (`PRM-070`, `AUD-012`). ⚠ **`INV-29.1` (PO approver never the creator) rests on `PRM-006` and must be re-tested with it** — Procurement's to resolve, recorded here so it is not missed |
| **2.33.0** | **2026-08-09** | **`GAP-117` registered — `BD-447`, post-Freeze. Class B, pre-implementation dependency. No frozen rule contradicted and the Freeze is not reopened.** **`BD-447` records the Journal Voucher as the representation of an *authorised journal entry*, and NO SUCH MECHANISM EXISTS.** **`ACC-011` makes every posting event-driven by another module** — revenue at delivery, payable at acceptance, transfer legs, scrap, returns, reversals — **with no manual journal entry anywhere: no entity, state, event, permission or rule.** `ACC-008` keeps the chart flat with no posting rules per category, and the Financial Account assessment recorded ***“Nothing requires manual entry”***. ✅ **The architecture is SILENT, not wrong** — `ACC-003` still denies posting authority to any document, and **the V1 spine is unaffected because every posting it needs already has an originating event.** **A Journal Voucher cannot be built until the mechanism is decided**, which needs a business decision on what an authorised journal entry is, who may raise one and what it may touch — **explicitly prohibited from being inferred** |
| **2.32.0** | **2026-08-09** | ✅ **`GAP-116` CLOSED by `BD-442` — the final Architecture Freeze blocker. ARCHITECTURE FROZEN as `FREEZE-V1-2026-08-09`.** **One Order, one parcel for its current fulfilment attempt.** **`PARTIALLY_DELIVERED` removed from `SM-1`, `BR-025` withdrawn, `BR-023` amended to *at most one ACTIVE shipment*, `OM §8.7` and `§10.5` withdrawn** — all retained under `DOC-009`. ✅ **Nothing was invented: the delivery model already agreed.** **`BD-073`'s seven confirmed failed-delivery causes are ALL whole-parcel**, and **`OM §10.5`'s *customer accepts some items and refuses others* was the ONLY item-level acceptance in the corpus with no discovery behind it.** ✅ **`SM-3` PRESERVED on subject grounds** — `E-035` Pick Task has eleven states, none of them Order states; only `SMA-002`'s illustration was stale (`SMA-082`). ⚠ **Concurrency withdrawn, multiplicity kept** — an RTO'd parcel re-sent is a second shipment. **`GAP-111` – `GAP-115` and every category `B` – `F` item carried explicitly into the frozen baseline; none closed to make the Freeze look clean** |
| **2.31.0** | **2026-08-09** | ✅ **`GAP-016` CLOSED — pre-freeze blocker **A4** resolved by `BD-441`. ALL FOUR FREEZE BLOCKERS NOW CLEARED.** ✅ **The finding: there is no backorder flow, which is why modelling one could never have closed this.** **Stock shortage never blocks, holds or cancels an Order** — processing continues regardless of physical stock on **every** source, and **negative actual stock is supported**; **shortage is a condition of the STOCK, not of the ORDER**, and the Order never learns about it. ✅ **This explains a long-standing puzzle**: `OM §8.2`'s escape clause *“or backorder explicitly authorised”* **never had an authorisation step, actor, reason vocabulary or waiting state** — **there was never anything to authorise.** **Six explicit prohibitions**, and shortage visibility is **permissive** — `CP-8` for the ninth time. ⚠ **New discovery WAS required and the record was searched first**: `BD-280` settled the **publishing** half and **explicitly deferred the order half to this gap**; **`BD-100` answered the opposite** and is now **scoped to the physical build** (`SM-12`, `BR-156`); **`BD-180` and half of `BD-248` were never asked.** ✅ **`SYS-032` TESTED and STANDS UNAMENDED** — it is **permissive and never obliged a refusal**; its illustration is scoped, and **`IVN-041` is scoped to warranty replacement**, which is all `BD-426` answered. ⚠ **Four stale statements corrected**: **`BR-018` had contradicted `BR-096` since 2026-08-06** with only its `§14.3` citation struck; **`§8.2`'s *Release effects: inventory reserved*** was the **sixth** reserve-at-release statement; **`PRD-079` was withdrawn by `BD-280` and still read as live at `PRD §17.3`**; **`PG-6` *“Never oversell”* had never been amended.** **`GAP-115`** (weighted average cost across a negative balance) and **`GAP-116`** (split/partial shipment modelled but stated unsupported) **registered, not resolved** |
| **2.30.0** | **2026-08-09** | ✅ **`GAP-019` residual and `GAP-027`/`SMU-10` ANSWERED — pre-freeze blocker **A3** RESOLVED by `BD-438` – `BD-440`. One blocker remains: A4.** **THREE facts where the architecture had two** — `BR-035` separated collection from settlement, and the business inserts **the courier's own record of having remitted** between them; **the Steadfast panel says which consignments a remittance covers, the money arrives separately, and they can be days apart.** **Two prohibitions**: a bank credit alone never establishes **which orders** were settled; a courier statement alone is never proof of **receipt**. ✅ **Reconciliation completes PER RECEIVABLE** — 48 clean consignments reconcile immediately while a disputed sibling stays open — which **`SM-5` already permitted** and which **settles `BD-061`'s recorded aggregate-versus-per-order ambiguity.** ✅ **Variance authority SPLIT on an economic line**: accepting a legitimate deduction **corrects an expectation** — permissioned Accounts, **not owner-only, not a write-off**; an unrecoverable shortfall **abandons money** — **`BD-110` unchanged.** ✅ **`SMU-10` CLOSED as a PROVEN NEGATIVE** — **`SMA-080`: a batch whose closure *decides nothing* has no decisions to sequence**, so its condition **derives from its lines** (`DB-001`); **`SM-6` is a machine because its closure IS a decision**, which is why `BD-439` forbade copying it. ⚠ **`GAP-027`'s premise was a misreading** — COD ageing **always had states**: `SM-5`'s `COLLECTED_BY_INTERMEDIARY` entry action already *begins ageing* per courier. ✅ **Two `UNDECIDED` markers resolved from discovery already ratified** (`SMA-079`); **four others untouched and outside A3.** **`E-044` generalised to serve both paths; `E-042` gains four invariants.** **`GAP-114` registered** — `SMA §10.8`'s *Accounts Manager within bounds* is doubly unsupported, **but governs the marketplace path A3 had no mandate to ask about.** **`GAP-024` ageing threshold unchanged** |
| **2.29.0** | **2026-08-09** | ✅ **`GAP-018` ANSWERED — pre-freeze blocker **A2** RESOLVED by `BD-436`/`BD-437`. Two blockers remain: A3, A4. `SMU-4` CLOSED.** **`ON_HOLD` is reservation-NEUTRAL and that is what makes it simple** — **a held order is *active* for `BR-097`**, and a reservation changes because of **the act underneath the hold, never the state transition.** **Four branches, three of which already had their mechanism**: shortage releases **only the unfulfillable quantity** (`E-027` carries variant · warehouse · quantity); **a credit issue does not by itself make stock available to another customer**; substitution **keeps valid stock and does not reserve the substitute until the customer approves — silence is not approval** (`BD-282` already recorded approver and performer). ✅ **`BR-097`, `BD-279`, `SMA-031` and `DM-041` all stand UNAMENDED** — the question was only whether `ON_HOLD` fell inside *active*, and it does. ⚠ **The corpus said the opposite in FIVE places and every one was stale**, each dating from the superseded `BR-053` reserve-at-release model: **`E-027`'s lifecycle, `OM §14.5`, `OM §14.3`, `SMA §11.3` and `EVT-040`** — all corrected as propagation under `DOC-048`. ⚠ **An unsupported reservation-expiry behaviour was REMOVED** — `E-027`'s `expiry` attribute, `OM §14.3`'s *may be time-limited* and `SMA §11.5`'s *set reservation expiry*, **all contradicting `DM-041`/`SMA-031`/`BD-279`'s no-independent-lifecycle rule.** ✅ **`BD-437` supplied the one genuinely missing mechanism** — explicit manual release, **permission-controlled and explicitly NOT owner-only**, which **narrows `PRM-051` from rule to staffing**; **ten recorded facts**; **performer and approver separate even where one person is both** — the **first action to close the collapse case** `PRM-050` had accepted. **A released reservation is SPENT** (`SYS-032`). **No new entity — `E-028` already carried `Release reservation`.** **No hold duration, ageing, SLA, auto-cancellation, reason vocabulary or approval hierarchy — each explicitly prohibited.** **`GAP-113` registered**: `AUD §12.2` is cited by nine documents and does not exist |
| **2.28.0** | **2026-08-09** | ✅ **`GAP-015` ANSWERED — pre-freeze blocker **A1** RESOLVED by `BD-435`. Three blockers remain: A2, A3, A4.** **Price source follows the ORDER SOURCE, which is the first *source* rule in the set rather than another *policy* rule** — §6's eight pricing answers all described **how the business thinks about price**, never **where the number on a line comes from.** **Daraz and Website orders arrive carrying their own actual price and the ERP uses it** (`PRD-137`, `PRD-138`); **manual orders are priced by staff** with an **Ideal / Recommended Selling Price of applicable product cost + 25%, advisory only** (`PRD-139`, `PRD-140`, `CP-8`). ⚠ **This corrected an overstated model responsibility** — `E-022` was described as *determining the price snapshotted onto an order*, and **for channel orders it determines nothing**; `INV-22.3`/`INV-22.4` now separate an **offered** price from a **transacted** one, and **`DMU-7` is closed.** ⚠ **A snapshot-point difference carried since v1.0.0 is settled** — `DB-023`/`E-022`/`PRD §10.4` said *at confirmation*, `BD-046`'s table said *at order creation*; **a Daraz order arrives priced before verification**, so capture is at **Order Line creation** (`BR-145`, `INV-32.6`) and `DB-023` is satisfied *a fortiori*. ✅ **No pricing engine, no new price list, no new authority** — `BR-092`, `BR-094`, `§7.9`, `PRM-052` **all unamended**, and **`BR-148` forecloses the dangerous reading** that a manual price below the recommendation is a discount. **`GAP-112` registered** — the cost input for build-to-order, bundles and non-catalogued lines, **not chosen**; advisory display, so **nothing blocks** |
| **2.27.0** | **2026-08-09** | 🔴 **FINAL PRE-FREEZE TRIAGE — every surviving item classified A – F against one test; verdict NOT READY FOR ARCHITECTURE FREEZE.** **Four freeze blockers, and all four are business discovery, not architecture**: **`GAP-015`** — *no document defines how a price is determined*, though `OM §7.9` and `PRM-008` both presuppose one; **`GAP-018`** — **whether a hold releases the inventory reservation**, unanswerable yet required to build `SM-1`; **`GAP-019` residual with `SMU-10`** — `SM-5` `RECEIVED → RECONCILED` is recorded **`UNDECIDED`** and **Courier Remittance has no machine**, which **at ~100% COD is how the business gets paid**; **`GAP-016`** — **backorder is confirmed real practice and the flow is unmodelled.** **The line drawn: `A` is the core transactional spine every module depends on; a gap blocking one peripheral feature is `B`, sequenced behind an explicit boundary.** **12 items classified `B`**, led by **`GAP-070` migration — an entire unwritten workstream, not a gap**; **9 accepted exposure, 7 deferred**; **`SMU-1` – `SMU-12` and `EVU-1` – `EVU-12` add nothing new — each maps to a GAP already classified.** ✅ **Five stale documents reconciled** (§F): **`SMU-13` and `SMU-16` had been closed by `SMA §21.1`/`§21.2` and the register never said so**; **`PRODUCT_ARCHITECTURE.md` Appendix A carried five satisfied items under a footer declaring them unsettled**. **`GAP-111` registered** — `OM §4.5`/`§14` never amended to the three-layer Product model, substance ratified elsewhere. **No new contradiction between ratified rules found. Architecture Freeze NOT performed** |
| **2.26.0** | **2026-08-09** | 🔴➜✅ **BLOCKER 3 CLEARED — `SM-20` proven to require no event; every machine's position is now settled.** **`ACC-026` and `SYS-105` state the reason outright**: a Fund Transfer *moves value between Financial Accounts the business controls and **changes no balance outside them*** — **so there is no cross-module surface to have an event on.** Fund Transfer is **wholly Accounting's** (`DOC-056`); **Payment observes only**, **`ICO-034` states an explicit non-reaction**, and **Notification carries no entry.** **`EVA-020` and `EVU-13` both CLOSED** — the uncovered list went from **seven machines to zero**: five **covered by discovery**, three **proven unnecessary**, and **no event invented at any point.** ⚠ **One presentational risk found and corrected**: `SM-20`'s posting column is **cumulative**, and an incremental reading would have **double-posted the source leg** — `SMA-074`'s movement table already forecloses it, and the header now says so. **Idempotency examined and sound.** **No GAP closed; `GAP-084`, `GAP-096`, `GAP-016` and all others untouched. Event count stays 102** |
| **2.25.0** | **2026-08-09** | ✅ **`SM-16` Conversation PROVEN to require no event — Blocker 3 narrows from two uncovered machines to one.** **The second determination rather than discovery result**, and for a different reason than `SM-14`: every `SM-16` occurrence is **internal to Chat**, **forbidden by `CHT-009`**, or a **derived overlay displayed by its own owner.** 🔴 **A message event is forbidden, not merely unjustified** — `CHT-009` declines message-level structure and an event would introduce exactly what the ratified set omits (`DOC-024`). **The `Overdue`/`Inactive` overlays are refused for want of a consumer, not a threshold** — `SM-16` holds **the architecture's only real threshold** (10 minutes, `CHT-047`, `SMA-063`), yet `CHT-049`'s entire reaction is **highlighting in Chat's own inbox and dashboards**, never closure or escalation (`SMA-062`), and **no conversation appears among `NOT §11.1`'s Action Queue instances.** **`CUS-066` confirms Customer references conversations and owns none of them.** ⚠ **One asymmetry recorded, not corrected**: `SM-9`'s advance-exchange Action Queue work also publishes no event, which **`BD-385` permits.** ⚠ **`GAP-096` carried unchanged** — conversation-to-lifecycle linkage stays undecided, and **no event depends on it.** **No GAP closed, no event created, count stays 102** |
| **2.24.0** | **2026-08-09** | ✅ **`SM-14` Marketplace Claim PROVEN to require no event — Blocker 3 narrows from three uncovered machines to two.** **This is a determination, not a discovery result**: every `SM-14` occurrence was tested against `EVA-019` and **no module reacts to any of them.** **Submission is manual in the Daraz Seller Center** (`BD-324`) — not a system action; **post-submission states are mirrored** (`SMA-036`, `INV-69.2`); **`REJECTED` changes nothing automatically**, stated independently by **`BR-131`, `SMA-038` and `INV-69.3`**, all re-tested and all holding; **ageing is positively foreclosed** (`SMA-037`, `INV-69.4`) and therefore **does not belong under `GAP-024`**. **`EVA-029` settles the `SM-14` ↔ `SM-6` boundary — approval is not receipt**, and whichever route compensation takes is already carried by `EVT-056` or `EVT-054`. **`GAP-084` is untouched and remains open** — the compensation classification is precisely what is not decided. ⚠ **One observation recorded, not resolved**: `OM §11.6`'s seven deduction categories are all outbound and an inbound compensation has none. **No GAP closed, no event created, count stays 102** |
| **2.23.0** | **2026-08-09** | ✅ **`SM-12` COVERED and its ratification defect DISCHARGED — `EVU-14` CLOSED.** **`BR-054` is scoped, not weakened**: it governs ordinary finished and sellable goods, while **`BR-143` deducts build components at the physical assembly point** and **`BR-144` forbids a second deduction at dispatch.** **This discharges `PRD-046`**, outstanding since `PRODUCT_ARCHITECTURE.md` v1.0.0. **`EVT-102 Build.Completed` registered** — one event for a six-stage machine, its consumers branching on build mode. **`EVA-027` records that component consumption publishes nothing**: **`EVT-041` was tested and rejected as dispatch-specific**, and reusing it would have imported `BR-054`'s timing. **Build QC, shortage and rework publish nothing**; **no Action Queue behaviour invented** and **`GAP-016` backorder remains unresolved.** `GAP-061`'s count updated to **102 across 16**; **closure unchanged. No GAP closed** |
| **2.22.0** | **2026-08-09** | **§33 `BD-434` committed — the finished-build path; `EVU-14` narrowed, no GAP closed.** **Creating the finished unit and making it generally available are two distinct facts**: both build modes create the unit, and only availability differs — a **build-to-order** unit is allocated to its Order and **never general stock**, a **build-to-stock** unit becomes available inventory. Propagated to `INVENTORY` (`IVN-043` – `IVN-045`) and `WAREHOUSE` (`WHS-074`); **`IVN-029`'s reading that build completion always fans out Available is corrected — it held only for build-to-stock.** 🔴 **A ratification defect is recorded, not resolved**: **`BR-054` deducts stock at dispatch while `PRD-045` consumes components at assembly**, with `PRD-046`'s `OM §14.4` amendment outstanding since `PRODUCT_ARCHITECTURE.md` v1.0.0 — **and `EVT-041` encodes `BR-054`.** **This blocks the component-consumption event and is an architect's ratification act, not a business question.** ⚠ **`GAP-016` backorder unchanged**; what *allocated to the Order* means against `SMA-031` recorded, not inferred |
| **2.21.0** | **2026-08-09** | ✅ **`EVU-16` CLOSED by architecture decision — the last Trade-In event-contract dependency.** **Accounting publishes `EVT-101 Accounting.TradeInCreditApplied`** because it owns `E-083`; **Payment orchestrates by explicit request and may be refused** (`SYS-006`, `SYS-032`); **a request is not an event** (`EVA-002`), so **no request event was invented.** **`PAY-015`'s gross receivable is PRESERVED** — applied credit is a **third non-cash clearing component** beside cash and deductions, so **Order Total and Sales Revenue are never rewritten and Trade-In Credit is never a discount.** `GAP-061`'s count updated to **101 across 15**; **closure unchanged.** **No GAP closed by adding an event.** ⚠ **Credit reversal, credit expiry, `GAP-103` – `GAP-106` and abandonment authority all remain untouched** |
| **2.20.0** | **2026-08-09** | **`BD-433` committed — `EVU-16`'s business half resolved; its producer half remains.** Credit is applied **before dispatch**; the obligation created at dispatch and the COD instruction both carry **the remaining payable**; **the courier never applies the credit.** Propagated to `PAYMENT` (its **first** Trade-In rules, `PAY-064` – `PAY-066`), `DELIVERY` (`DLV-130`, `DLV-131`), `ACCOUNTING` (`ACC-047`) and `TRADE_IN` (`TRD-087`). 🔴 **`EVU-16` remains open on the producer only** — two entities change and no rule picks between their owners; **no event was created and no owner chosen.** ⚠ **A second architecture decision recorded, not taken**: `PAY-015` creates receivables **gross**, so net-creation versus gross-with-clearing is open — **the business requirement is satisfied either way and `PAY-015` is unamended.** **No GAP closed; credit reversal and expiry untouched** |
| **2.19.0** | **2026-08-09** | **Trade-In dependency reconciliation — four of five closed on evidence; no GAP closed by convenience.** ✅ **`REPAIR_REQUIRED` → `SM-15` RESOLVED as a stale enumeration** — `SMA-072` always stated the delegation, `SMA-044` now registers **four** entry points, and **no state, transition, authority or event changed.** ✅ **`EVU-15` classified as an ACCEPTED ABSENCE** — no module has a confirmed reaction to trade-in stock creation, and `EVA-019` does not require every authoritative fact to publish an event. ✅ **Failed courier return COVERED** by Delivery's existing RTO lifecycle plus `BD-396`'s already-modelled path; **no event created.** ✅ **Cost-bearer `DOC-050` conflict RECONCILED BY SCOPE** — `BD-395`'s four are *“Examples”*, `BD-430` adds a default and excludes nothing; **no side chosen.** 🔴 **`EVU-16` REMAINS and is sharpened**: `PAY-014`/`EVT-052` raise the receivable at dispatch while `BD-431` applies credit at the order, so **no receivable exists to reduce when credit is applied** — sequencing unstated, **no owner chosen.** **`GAP-103` – `GAP-106`, credit reversal, credit expiry and abandonment authority all untouched** |
| **2.18.0** | **2026-08-09** | **Trade-In events specified — Blocker 3 narrowed from five uncovered machines to three.** `SM-18` and `SM-19` are covered by **`EVT-096` – `EVT-100`** (`EVENT_ARCHITECTURE.md` §21), justified by §32 (`BD-430` – `BD-432`) — **closed by discovery, not cataloguing pressure.** `GAP-061`'s count updated to **100 events across 14 domains**; **its closure is unchanged.** **No GAP was closed by adding an event.** 🔴 **Two new event-contract dependencies opened**: **`EVU-15`** — Inventory stock creation from allocated Trade-In components has a producer and an occurrence but **no confirmed consumer**, so **no event was created**; and **`EVU-16`** — the **credit-application producer is undetermined**, with **no `Accounting.*` or `Payment.*` event invented to complete the surface.** **`GAP-103` – `GAP-106` unchanged**, and the **`DOC-050` cost-bearer conflict, credit reversal, credit expiry, abandonment authority and the `REPAIR_REQUIRED` → `SM-15` defect all remain open** |
| **2.17.0** | **2026-08-09** | **Trade-In §32 discovery reconciled — no gap closed, one conflict opened.** `BD-430` – `BD-432` confirmed the three occurrences the Trade-In event analysis found to have **no business behaviour at all**. ⚠ **A new `DOC-050` conflict is recorded**: `BD-430` names **two** return-cost-bearer values with a `CUSTOMER` default, against `BD-395`'s **four** outcomes including *shared by agreement*, on which `TRD-054` built *an amount per party, not a flag*. **The default is adopted; the narrowing is not; `TRD-053`/`TRD-054` stand unamended and the outcome set is left to the business.** **`BD-432` removes automatic Trade-In customer notification from scope entirely** — recorded as a scope reduction, not a gap. **`GAP-103` – `GAP-106` unchanged and uncloseD.** **Trade-In Credit reversal, `REPAIR_REQUIRED` → `SM-15` entry points, abandonment authority and credit expiry all remain explicitly open.** **A new open boundary is recorded**: which module publishes a Trade-In Credit application — Accounting owns `E-083` but publishes no events, and no `PAY-` rule mentions Trade-In |
| **2.16.0** | **2026-08-09** | **Warranty & Repair events specified — Blocker 3 narrowed from seven uncovered machines to five.** `SM-13` and `SM-15` are covered by **`EVT-089` – `EVT-095`** (`EVENT_ARCHITECTURE.md` §20), justified by `BUSINESS_DISCOVERY.md` §31 (`BD-426` – `BD-429`) — **closed by discovery, not by cataloguing pressure.** `GAP-061`'s count updated to **95 events across 13 domains**; **its closure is unchanged.** **No GAP was closed by adding an event**, and `GAP-087` remains open — it is precisely why **no significant-delay event could be specified** (`EVA-022`). **Nine open dependencies are carried at §20.3**, including the `PAY-049` refund conflict, the missing Payment contract for a chargeable repair, the unstated Accounting postings for supplier recovery, replacement cost and handback courier cost, the absent `SM-13` waiting state, and both procurement triggers. **No business rule, state machine, entity or ownership changed** |
| **2.15.0** | **2026-08-09** | 🔴➜🟡 **BLOCKER 3 WORKED — propagation discharged, event specification remains.** The corpus was searched for every admissible form of event evidence and **the blocker is materially re-characterised**. **What was propagatable was propagated**: `PRODUCT_ARCHITECTURE.md` §22's sixteen ratified `Product.*` events are registered as **`EVT-088`**, discharging an amendment its Appendix A had recorded as outstanding since v1.0.0 — **not one event name originates in the register.** **`SM-17` was already covered** (`Permission.OverridePerformed`, `EVT-085`); **`SM-12` is partly covered** (`Product.AsBuiltRecorded`); **`SM-15`'s inventory effect** is `EVT-041`. 🔴 **Seven machines have no event and no evidence that one exists** — `SM-13` – `SM-16`, `SM-18` – `SM-20` — recorded at `EVA-019`, `EVA-020`, `EVENT_ARCHITECTURE.md` §19, `EVU-13` and `EVU-14`. **`BD-385` forecloses inferring events from Action Queue work.** **Specifying them is authoring, not propagation, and is reserved to the architect.** ✅ **`SMA-011` recorded as fully discharged** — §16 is module-keyed and needed no amendment. **Three false claims withdrawn**; `GAP-061`'s count updated to 88/12 with **its closure unchanged**. **No gap closed by adding an event** |
| **2.14.0** | **2026-08-09** | 🔴➜✅ **BLOCKER 2 FULLY CLEARED — Trade-In registered and written. `GAP-001` CLOSED.** The readiness test covered twenty areas and **found none requiring invented business behaviour**: `TRADE_IN_ARCHITECTURE.md` v1.0.0, `DOC-063`, prefix `TRD-`, **76 rules (`TRD-000` – `TRD-075`)**, `SM-18` and `SM-19` referenced and **neither re-ratified** (`TRD-075`). **The module is deliberately narrow** — `TRD-001` records that it is not a second system of record for money or stock; allocation stays with `ICO-011` – `ICO-017`, inventory with `IVN-030` – `IVN-032`, custody-in-fact with `WHS-069`, and **`E-083` Trade-In Credit wholly with `ACC-039`/`ACC-040`**. **`GAP-001` CLOSES on verified evidence, not assumption**: every entity-ownership value in `DOMAIN_MODEL.md` was enumerated and each maps to a registered document; `E-006` is superseded (`DM-068`), and HR & Payroll is deferred with a business decision to cite (`DOC-061`). **`GAP-103` – `GAP-106` all carried, none closed** — teardown still does not exist (`GAP-103`), and stating its absence is not designing it. **Seven reconciliation points recorded**, the sharpest being that **no canonical source says what happens to Trade-In Credit when the sale it was spent on is returned**. **Downstream pointers corrected in four documents**, including an internal error where `ACCOUNTING_ARCHITECTURE.md` §2.2 disclaimed `E-083`, an entity it owns. ⚠ **Blocker 3 remains** — `EVENT_ARCHITECTURE.md` still carries no events for `SM-12` – `SM-20` |
| **2.13.0** | **2026-08-09** | 🔴➜🟡 **BLOCKER 2 HALF CLEARED — Warranty & Repair registered and written; Trade-In remains.** The readiness test covered fifteen areas and **found none requiring invented business behaviour**, so the module was written rather than deferred: `WARRANTY_REPAIR_ARCHITECTURE.md` v1.0.0, `DOC-062`, prefix `WAR-`, **78 rules (`WAR-000` – `WAR-077`)**, `SM-13` and `SM-15` referenced and **neither re-ratified** (`WAR-077`). **`GAP-001` narrows from two unregistered modules to one.** **No gap is closed by the document existing** — `GAP-087` (overdue threshold), `GAP-088` (repair as purchase trigger) and `GAP-089` (current configuration) are **carried STILL OPEN with reasons**; `GAP-090` (loaner inventory) stays **ACCEPTED EXPOSURE**; `GAP-026` is noted as having **its sharpest instance here** — `SM-13` and `SM-15` share eight stage names; `GAP-075` re-verified as already closed. **A genuine contradiction was found and corrected**: `CUS-059` and `RET-027` cited `PRODUCT_ARCHITECTURE.md` §32 as owning the warranty and repair lifecycles, **which it does not** — §32 reconciles warranty *policy*. **Seven reconciliation points recorded**, including that **no `ACC-` rule states the posting for any of `BD-290`'s three repair-cost treatments**. ⚠ **Trade-In and Blocker 3 untouched** |
| **2.12.0** | **2026-08-09** | 🔴➜✅ **BLOCKER 1 CLEARED — `SM-3`, `SM-6`, `SM-10` and `SM-11` RATIFIED.** `OM §18.2` amended by `BR-142`, discharging `SMA-001`, `SMA-011` and **closing `SMU-11`**. Each machine was verified independently against confirmed discovery and already-ratified architecture; **all four met the test and none required a state, transition or authority to be invented.** **`GAP-027` — registration half CLOSED, gap STAYS OPEN**: Courier Remittance still has no machine (`SMU-10`, `BD-059`), so `BR-036`'s COD cash-in-transit exposure still has no lifecycle to age against; Approval was separately determined unnecessary (`SMA-017`). **`GAP-045` and `GAP-047` are unchanged** — `SMA-014` bars `SM-11`'s implementation, not its registration. 🔶 **`RP-SM10-GATES` recorded**: `SM-10` was ratified on the eight business-confirmed stages only (`BD-349`) and `SMA §14.3` is superseded; **the two sets are not merged**, and at which stage a refund waits when a gate is open remains unstated by any ratified source. **Stale status references corrected in seven documents.** ⚠ **Blockers 2 and 3 are untouched and remain** — Warranty & Repair and Trade-In are still unregistered, and `EVENT_ARCHITECTURE.md` still has no events for `SM-12` – `SM-20` |
| **2.11.0** | **2026-08-09** | **PRE-FREEZE RECONCILIATION — all 110 GAPs classified.** **13 newly CLOSED** (`GAP-002`, `GAP-006` – `GAP-011`, `GAP-014`, `GAP-022`, `GAP-051`, `GAP-061`, `GAP-068`, `GAP-083`), each against a cited decision or rule and **none closed merely because a document now exists**. **20 NARROWED**, **8 ACCEPTED EXPOSURE**, **7 DEFERRED**, **50 STILL OPEN**. **`GAP-001` NARROWS rather than closes** — every *registered* document is written, but **Warranty & Repair and Trade-In were never registered**, and a document cannot be unwritten if it was never planned. **`GAP-083` closes as a registration defect only** — `DOC-061` registers HR & Payroll as DEFERRED POST-V1; the deferral decision itself (`SYS-093`) is unchanged. **The `SM-10` competing state sets resolve as documentary** — `SMA §22.3` is business-confirmed (`BD-349`), `SMA §14.3`'s proposed set is superseded. 🔴 **THREE BLOCKING FINDINGS recorded, none resolved.** **(1)** `SM-3`, `SM-6`, `SM-10`, `SM-11` remain proposed extensions under `SMA-001` while `OM §18.2` registers seven machines and three ratified module documents build on them (`SMA-011`). **(2)** **Warranty & Repair and Trade-In own four entities (`E-071`, `E-072`, `E-081`, `E-082`) and four *fully ratified* machines (`SM-13`, `SM-15`, `SM-18`, `SM-19`) but appear in no register, hold no prefix and have no document** — the last surviving instance of the defect class that `GAP-083` and the Chat finding each discharged. Unlike `GAP-083` **no deferral decision exists to cite**, so nothing was registered. **(3)** **`EVENT_ARCHITECTURE.md` is still v1.0.0 with no events for `SM-12` – `SM-20`** — its propagation was deferred *"until `SMA-018` is specified"*, and `SMA §21.1` has now specified it, so the `DOC-021` obligation is **due and unmet**. **All three require authoring or ratification reserved to the architect** |
| **2.10.0** | **2026-08-08** | **`ACCESS_GOVERNANCE_ARCHITECTURE.md` v1.0.0 written.** **`GAP-099` CLOSED** — the four access-governance surfaces now have an owning document and are registered as one area (`AGV-035`). `GAP-098`, `GAP-100`, `GAP-097`, `GAP-057`/`DMU-10` and `GAP-083` are now **referenced from an owning document**. **A `DOC-005` boundary was required and is recorded as `DOC-055`**: the access domain divides between the permission *model* (`PRM-`) and access *governance* (`AGV-`); `PERMISSION_ARCHITECTURE.md` is retained unchanged |
| **2.9.0** | **2026-08-08** | **`RETURN_EXCHANGE_ARCHITECTURE.md` v1.0.0 written.** **`GAP-001` reduced: ten planned documents → nine.** `GAP-093`, `GAP-092`, `GAP-091`, `GAP-081`, `GAP-073`, `GAP-064` and `GAP-026` are now **referenced from an owning document**, each against a specific section. Two items recorded at discovery are carried explicitly: **replacement versus exchange were never defined as terms** (`BD-347`), and **whether marketplace return approval precedes the goods** depends on sync capability (`BD-342`) |
| **2.8.0** | **2026-08-08** | **Architecture Documentation begins.** **`GAP-101` CLOSED** — `NOTIFICATION_ARCHITECTURE.md` v1.0.0 written. **`GAP-001` reduced: eleven planned documents → ten.** `GAP-102`, `GAP-087`, `GAP-091`, `GAP-096`, `GAP-026`, `GAP-098` and `GAP-099` are now **referenced from an owning document** rather than floating, which makes each actionable against a specific section |
| **2.7.0** | **2026-08-08** | **Fund Transfer reconciliation (§27) — FINAL DOMAIN. All nine domains reconciled.** **The parked Fund Transfer review CLOSES** — `SYS-105` establishes that the invariant was never broken; the MFS fee was a second transaction misattributed to the first. `GAP-107` – `GAP-110` opened. **Every domain listed for reconciliation is now complete**; `GAP-001` remains the dominant open item — the specifications exist, the module documents do not |
| **2.6.0** | **2026-08-08** | **Trade-In reconciliation (§26).** **The `BD-391` cross-domain check CLOSES** — §18 Purchase already forbids cost restatement, so the two domains agree and *never restated* is now `SYS-102` at system level. `GAP-103` – `GAP-106` opened. **`GAP-103` is the domain's largest structural finding: teardown, the inverse of assembly, has no counterpart in the architecture.** Trade-In was listed twice as a linked lifecycle and discovered zero times; **it is now fully specified** — three entities, two machines, ten answers |
| **2.5.0** | **2026-08-08** | **Notifications reconciliation (§25).** **`GAP-012` CLOSED** — the notification module is no longer undocumented; three entities, four system rules and a V1 delivery scope are specified. **`GAP-001` reduced by one document's content**, though `NOTIFICATION_ARCHITECTURE.md` itself remains unwritten. `GAP-101` – `GAP-102` opened |
| **2.4.0** | **2026-08-08** | **Roles & Permissions reconciliation (§24b).** **`SYS-016` Responsibility-vs-Role CLOSED** — Role *groups* Responsibilities; the gap was definitional, not a conflict. **`PRM-028`'s delegation clause WITHDRAWN as stale.** `GAP-098` – `GAP-100` opened. **`GAP-098` is the domain's most consequential**: ten explicit scope dimensions mean **every future channel is a new dimension**, so fixed scope structure satisfies V1 and then breaks |
 **`GAP-031` CLOSED** — `E-006` Employee ownership resolved by supersession into `E-077`. **`GAP-057`/`DMU-10` NARROWED** — branch confirmed as a real scope dimension from three independent signals; **branch-level P&L remains separate**, requiring `SYS §5.6` to be amended first. `PRMU-1`, `PRMU-6` closed. **`GAP-083` reinforced** — HR & Payroll now demonstrably *extends* a V1 record rather than owning it, so the missing document understates scope more than previously recorded. `GAP-097` opened |
 **`GAP-024` SUBSTANTIALLY CLOSED** — `BD-364` supplies the first ageing threshold with an actual value (10 minutes, configurable), completing the pattern begun at `BD-350`: *configurable default → named overlay → highlighted, never acted upon*. **`BD-327`'s identity problem RESOLVED** by `E-075` Channel Identity — modelling the uncertainty rather than solving matching. **`GAP-026` gains its second concrete instance** (`Overdue` on `SM-9` and `SM-16` mean different things). `GAP-094` – `GAP-096` opened |
 **`GAP-024` PARTIALLY ANSWERED** — `BD-350`'s configured overdue period is the **first stated time threshold in the architecture**, and supplies the pattern (*configuration → named state → follow-up, never an automatic decision*) that `GAP-087` and `GAP-091` could follow. **`BD-220` substantially answered** by `BR-136`. `GAP-091` – `GAP-093` opened. **`GAP-081` extended** to return-shipping recovery; the unreconciled charge vocabulary (`BD-190`, `BD-191`) now spans four concepts |
| **2.0.0** | **2026-08-08** | **Warranty reconciliation (§21).** **`GAP-075` CLOSED** — the repair lifecycle now exists (`SM-15`). **`AUD-037`, `DB-052`, `INV-51.1`, `BR-084` and `BD-144` all RESOLVED together** by `BD-338`: the retention-versus-warranty conflict **dissolved rather than being traded off**, because `BD-008`'s five years was always a minimum and never an expiry. `SMU-16` closed. **`GAP-026` ESCALATED** from notation to required resolution. `GAP-087` – `GAP-090` opened. **`GAP-087` is the domain's one high-severity finding: a stated requirement that cannot be built as given** |
| **1.9.0** | **2026-08-08** | **Marketplace reconciliation (§20).** **`BD-203` CLOSED** by structural necessity (`BR-129`) — per-order reconciliation is unavoidable given `BR-123`'s two-part clearing; the aggregate answer has no room in the architecture. `GAP-073` **confirmed unchanged** by `BD-325`. `GAP-084` – `GAP-086` opened. **`GAP-024` gains a concrete instance** rather than a new entry. Note: `BD-324` **forecloses claim ageing** — the absence of a duration expectation is a stated business fact, not a gap, and must not be recorded as one |

---

# Pre-Freeze Reconciliation — 2026-08-08

**Performed after all 28 registered documents were written.** Every open finding was classified against confirmed discovery and ratified architecture. **No gap is closed because a document now exists** — each closure cites the decision or rule that resolves it. **The historical record above is unchanged; nothing is deleted.**

## Totals

| Classification | Count |
|---|---|
| **A · CLOSED** | **25** |
| **B · NARROWED** | **20** |
| **C · ACCEPTED EXPOSURE** | **8** |
| **D · DEFERRED** | **7** |
| **E · STILL OPEN** | **50** |
| **Total** | **110** |

## A · CLOSED — 13 newly closed this pass

| GAP | Closed by |
|---|---|
| **`GAP-001`** | ✅ **CLOSED 2026-08-09.** **All registered documents are written**, and the two modules that were never *registered* — Warranty & Repair and Trade-In — are now registered and written (`DOC-062`, `DOC-063`). **Verified, not assumed**: every entity-ownership value in `DOMAIN_MODEL.md` was enumerated and each maps to a registered document. `E-006` Employee reads *Undetermined* but is **superseded by `E-077`** (`DM-068`), not a live owner. **`HR_PAYROLL_ARCHITECTURE.md` remains deliberately deferred with a business decision to cite** (`SYS-093`, `DOC-061`), which is why its absence does not reopen this. `DOC-015` no longer bars any module |
| **`GAP-002`** | `ACCOUNTING_ARCHITECTURE.md` v1.0.0; recognition at delivery (`BD-304`, `ACC-013`); COGS (`ACC-022` – `ACC-024`); period close (`ACC §12`) |
| **`GAP-006`** | `PAYMENT_ARCHITECTURE.md` v1.0.0 — receipts, remittance, settlement ingestion, matching, variance, dispute and refund execution all specified |
| **`GAP-007`** | `PRODUCT_ARCHITECTURE.md` ratified |
| **`GAP-008`** | `CUSTOMER_ARCHITECTURE.md` v1.0.0 · `BD-173`, `BD-169`, `BD-424` supplied the three missing decisions |
| **`GAP-009`** | `WAREHOUSE_ARCHITECTURE.md` v1.0.0 |
| **`GAP-010`** | `PROCUREMENT_ARCHITECTURE.md` v1.0.0 |
| **`GAP-011`** | `DELIVERY_ARCHITECTURE.md` v1.0.0 · §28 and §29 supplied the missing commercial and workflow decisions |
| **`GAP-014`** | **Closed by removal.** `PRM-048`/`PRM-049` found approval-workflow machinery unnecessary; `BD-378`/`AGV-031` replaced dual approval with transparency. Residual build scope is `GAP-100` |
| **`GAP-022`** | `BD-027` — `B2C Pending` is replaced by Pending Verification, filterable by customer type |
| **`GAP-051`** | **No planned documents remain**, so no placeholder `(.)` links remain. The last was corrected in `CHAT_ARCHITECTURE.md` on 2026-08-08 |
| **`GAP-061`** | `EVENT_ARCHITECTURE.md` — **102 events across 16 domains** (87 across 11 at closure; `EVT-088`, `EVT-089` – `EVT-095` and `EVT-096` – `EVT-100` added 2026-08-09). **The closure is unchanged** — `SYS-050` became verifiable when the register existed, not when it became exhaustive |
| **`GAP-068`** | `DOC-002` — `BUSINESS_ARCHITECTURE.md` confirmed absent, citations redirected |
| **`GAP-083`** | **Registration defect discharged by `DOC-061`** — HR & Payroll registered as **DEFERRED POST-V1**. The business decision (`SYS-078` in scope, `SYS-093` deferred) is unchanged |

**Previously closed and re-verified this pass, status unchanged:** `GAP-005` · `GAP-012` · `GAP-021` · `GAP-031` · `GAP-032` · `GAP-035` · `GAP-046` · `GAP-063` · `GAP-069` · `GAP-074` · `GAP-075` · `GAP-078` · `GAP-099` · `GAP-101`.

## B · NARROWED — a genuine residual remains

| GAP | Resolved | Residual |
|---|---|---|
| **`GAP-001`** | ✅ **CLOSED 2026-08-09 — see the CLOSED table.** Every registered document is written, and **both modules that were never registered now are** (`DOC-062`, `DOC-063`) | — |
| `GAP-003` | VAT deliberately out of scope (`BD-307`, `SYS-092`, `RPT-049`) | Re-entry touches line composition and reporting |
| `GAP-004` | **Net Profit defined by five components** (`SYS-088`) | **The four shipped orders-list KPIs remain undefined** |
| `GAP-016` | Quantity model exists (`BD-280`, `BD-285`) | **The backorder flow is unmodelled** |
| `GAP-017` | `NOT RELEASED` dropped (`BD-039`); `B2C Pending` replaced (`BD-027`) | **No full UI-label-to-state mapping exists** |
| `GAP-019` | Release manual (`BR-081`); `LOST` external (`DLV-027`) | **`SM-5` `RECEIVED → RECONCILED` remains `UNDECIDED`** |
| `GAP-024` | **First threshold with a value** — 10 minutes (`BD-364`, `SMA-063`) | Most states still carry none |
| `GAP-026` | **Machine-qualified naming ratified** (`DM-002`, `SMA-047`) | Application at implementation |
| `GAP-027` | Four machines specified **and registered in `OM §18.2`** (`BR-142`, 2026-08-09); Approval determined unnecessary (`SMA-017`) | **Courier Remittance still has no machine** (`SMU-10`, `BD-059`) |
| `GAP-034` | `PRD-131`, `SYS-033`, `AUD-028` govern bulk | No inventory of permitted bulk transitions |
| `GAP-045` | Performer and qualification defined (`DM-029`) | **Tolerances (`BD-225`) and dispute path (`BD-226`)** |
| `GAP-047` | Partial and Full Scrap given (`BD-071`) | Full condition-grade vocabulary absent |
| `GAP-048` | **`LOST`** (`BD-218`) and **`DAMAGED`** (`BD-074`) defined | **`MISSING` — pick shortfall — untouched** |
| `GAP-057` | Branch confirmed as a real scope dimension (`PRM-064`) | **`SYS §5.6` still does not define Branch as a level** |
| `GAP-064` | Windows defined — 14 days marketplace, 7 elsewhere (`BD-077`) | Bundle eligibility (`PRD-051`) |
| `GAP-071` | **Third settlement path described end to end** (`BD-211`) | Cash in staff custody is untracked |
| `GAP-073` | Reduced by the mandatory Build ID (`BD-283`) | Same-model substitution undetectable |
| `GAP-081` · `GAP-084` | **A classification principle exists for *fees*** (`BD-408`) | **Not extended to non-fee items** |
| `GAP-082` | **Label chosen over accrue for courier cost** (`BD-413`) | **The marketplace-charge half is untouched** |
| `GAP-096` | Both linkage forms recorded (`CHT-037`) | The choice is unmade |

## C · ACCEPTED EXPOSURE

`GAP-073` *"a deliberate business trade-off"* · `GAP-086` late-versus-missing threshold · `GAP-090` loaners not normally provided (`BD-335`) · `GAP-092` component refund *"only becomes live if the business later requires"* it · `GAP-100` dual approval *"not justified while one administrator exists"* · `GAP-105`, `GAP-106`, `GAP-108` rare edges recorded by explicit decision · **`CUS-054` blacklist reach across unlinked identities** — the mechanism is stated, its reach is not.

## D · DEFERRED — valid, intentionally outside V1

`GAP-083` **HR & Payroll** (`SYS-093`, `DOC-061`) · `GAP-052` multi-jurisdiction tax · `GAP-053` inter-company (`SYS-019` defers explicitly) · `GAP-054` multi-currency (`SYS §18.2`) · `GAP-055` payment gateway (`SYS §12.3` future) · `GAP-058` additional marketplaces · `GAP-109` opening balances.

## E · STILL OPEN

**Business-architecture (14):** `GAP-015` pricing determination · `GAP-018` `ON_HOLD` rules · `GAP-020` process rollback · `GAP-023` `DRAFT` lifecycle · `GAP-025` partial cancellation · `GAP-059` non-catalogued mapping process · `GAP-060` exception-type vocabulary · `GAP-062` reconciliation cycles · `GAP-065` incomplete marketplace data · `GAP-066` order notes · `GAP-072` installments · `GAP-079` per-supplier terms · `GAP-088` warranty repair as a purchase trigger · `GAP-093` revenue on a converted replacement.

**Cross-module (9):** `GAP-070` **migration architecture** · `GAP-080` supplier settlement machines · `GAP-085` completeness reconciliation · `GAP-087` warranty overdue expectation · `GAP-089` current configuration after repair · `GAP-098` scope-dimension extensibility · `GAP-103` **teardown** · `GAP-104` used-versus-new valuation pool · `GAP-107` directional duplicate detection.

**Low (5):** `GAP-091` · `GAP-094` · `GAP-095` · `GAP-102` · `GAP-110`.

**UI and documentation (13):** `GAP-029`, `GAP-030`, `GAP-033`, `GAP-036` – `GAP-044`, `GAP-049`, `GAP-050`, `GAP-067`. **None is a business-architecture blocker**; the UI items are governed by `DESIGN_CONSTITUTION.md`.

## GAP-111 — registered 2026-08-09

**Category:** Documentation · **Severity:** 🟢 Low
**Source:** `PRODUCT_ARCHITECTURE.md` Appendix A items 5 and 6, reconciled during the final pre-freeze triage

**Problem.** **`ORDER_MANAGEMENT_ARCHITECTURE.md` `§4.5` and `§14` were never amended to the three-layer Product model.** `§4.5` still describes an order line as *linked to a catalogue item*, and `§14` does not state that assembled lines reserve components.

**Why it is not a blocker.** **Both rules are ratified elsewhere and are reachable**: `INV-32.1` states that **a catalogued line references a Sellable Product, never a Product Variant directly**, and the component chain runs `SM-12` `COMPONENTS_RESERVED` → `IVN-014` → `EVT-039` → `BR-143`. **Nothing is unbuildable.**

**Why it is still a defect.** **Two documents describe the same thing at different vintages and `OM`'s is the vaguer**, so a reader who starts there gets a weaker model than the ratified one. **Documentation alignment, not an open architecture question.**

## Findings that block Architecture Freeze — **1 of 3 cleared**

### ✅ Blocker 1 — CLEARED 2026-08-09 · the state-machine register no longer contradicts itself

**As recorded on 2026-08-09, preserved:** *"`SMA-001` holds that `SM-3` Fulfillment, `SM-6` Marketplace Settlement, `SM-10` Refund and `SM-11` QC remain specification-ahead-of-ratification until `ORDER_MANAGEMENT_ARCHITECTURE.md` §18.2 and §18.3 are amended. `OM §18.2` still registers seven machines; `STATE_MACHINE_ARCHITECTURE.md` specifies twenty."*

**Resolved by ratification, not by rewording.** Each machine was verified independently against confirmed discovery and already-ratified architecture; **all four met the test, and the amendment `SMA-011` demanded was made.**

| Machine | Existence | States | Authority | Blocking business decision | Outcome |
|---|---|---|---|---|---|
| **`SM-3`** Fulfillment | `BR-023` — a split order runs two pick processes at once, so no single `Order` state can express it | 11, extracted from `OM §8`; `WHS-026` – `WHS-037` execute them | Internal · Warehouse (`WHS-003`) | **None** | ✅ **RATIFIED** |
| **`SM-6`** Marketplace Settlement | `OM §11.6` + `E-043` — a batch resolving many receivables cannot be a state of any one | 8, from `OM §11.6`'s deduction, variance and dispute vocabulary; `PAY-038`, `PAY-039` | **External** — the marketplace is system of record (`PAY-026`, `SYS-010`) | **None** | ✅ **RATIFIED** |
| **`SM-10`** Refund | **`BD-349` — the business enumerated a refund's own stage list**, distinct from Payment's | **8, business-confirmed** (`BD-349`, `SMA §22.3`, `RET-029`, `PAY-046`) | Internal · Payment executes, Return & Exchange decides entitlement (`E-045`, `PAY-049`) | **None to ratification.** `RP-SM10-GATES` remains open and is unaffected by it | ✅ **RATIFIED** |
| **`SM-11`** QC | `E-049` is a subject in its own right; **`SMA-045` designates Return QC a machine** because it decides an outcome rather than gating progress | 7, from `OM §12.5` steps 6–7; four dispositions confirmed at `BD-289` (`RET-018`) | Internal · Warehouse (`WHS-003`, `RET-019`) | **None to ratification.** `GAP-045`/`GAP-047` bar **implementation**, which `SMA-014` already says explicitly | ✅ **RATIFIED** |

**Two objections were tested and did not hold.**

**An `UNDECIDED` transition mode is not a bar** — `SM-6` carries one (`GAP-019`), but so do the already-ratified `SM-1` (three), `SM-5` and `SM-8`. **Ratification has never required every mode to be settled**, and applying a stricter test to these four than to the seven would be inventing a rule.

**`SMA-014` bars implementation, not registration** — it says *"this machine's states are specified; its process is not"* and that implementing `SM-11` needs `GAP-045` closed first. **Registration asserts that the machine exists and who owns it; it does not assert that the process is defined.** `GAP-045` and `GAP-047` stay open, unchanged.

**None of the four introduced new behaviour.** Each was extracted from states `ORDER_MANAGEMENT_ARCHITECTURE.md` had already ratified — `SM-3` from §8, `SM-6` from §11.6, `SM-10` from the `BR-040`/`BR-041` gates, `SM-11` from §12.5. `OM §18.1`'s combinatorial argument is applied four times further; **no commercial rule changed.**

**`GAP-027`'s condition was met the way it specified.** It required *"either document the four missing machines in their owning modules, or record an explicit decision that each is a sub-state of its parent."* The first was done in `STATE_MACHINE_ARCHITECTURE.md`, and the register now agrees.

⚠ **What this did NOT clear.** `OM §18.2` registers **eleven**, not twenty. **`SM-12` – `SM-20` remain unregistered there** — a separate item, tracked at Blocker 3, and `OM §18.2` now says so explicitly rather than implying those machines do not exist.

### ✅ Blocker 2 — CLEARED 2026-08-09 · both owning modules registered

> **`DOMAIN_MODEL.md` assigns four entities to two modules that appear in no register, have no document, and hold no rule prefix.**

| Module | Entities it is said to own | Ratified machines | Document | `SYS §11.1` | Index dashboard |
|---|---|---|---|---|---|
| ~~**Warranty & Repair**~~ ✅ | `E-071` Warranty Request · `E-072` Repair | **`SM-13`** (§21.1) · **`SM-15`** (§21.2) | ✅ **`WARRANTY_REPAIR_ARCHITECTURE.md` v1.0.0** | ✅ **§5.4 and §11.1** | ✅ **row 29** |
| ~~**Trade-In**~~ ✅ | `E-081` Trade-In Case · `E-082` Trade-In Component | **`SM-18`** (§25.1) · **`SM-19`** (§25.2) | ✅ **`TRADE_IN_ARCHITECTURE.md` v1.0.0** | ✅ **§5.4 and §11.1** | ✅ **row 30** |

**This is the same defect class as the Chat finding** — entities owned by a module the governance layer does not know exists — **but four times its size, and it reaches ratified state machines.** `SM-13`, `SM-15`, `SM-18` and `SM-19` carry **no ⚠**: unlike Blocker 1 they are **fully ratified**, specified across `SMA-039` – `SMA-073`, and depended upon by `RET-011` (`SM-15` shared with Return) and `BD-354` (`E-073` links Trade-In cases).

**Discovery is not the obstacle** — Warranty is discovered and reconciled (`BD-329`, `BD-334`, `SYS §21`) and Trade-In likewise (`BD-388` – `BD-397`, `SYS §23`). **`GAP-001` never covered these**, because a document can only be *unwritten* if it was first *planned*; these were never planned. `GAP-083` and the Chat defect were each caught and discharged, so **this is the last surviving instance of that class.**

⚠ **Registering a module, allocating its prefix and deciding whether it is V1 or deferred are ratification acts** (`DOC-035`, `§7.1`). **`GAP-083` was dischargeable because the business had already decided the deferral** (`SYS-093`); **here no such decision exists**, so nothing was registered and no prefix was allocated by the pre-freeze pass. **The architect must decide** whether Warranty & Repair and Trade-In are V1 modules requiring documents before freeze, or are deferred like HR & Payroll.

> ✅ **Warranty & Repair resolved 2026-08-09 — by writing, not by deferring.** The readiness test found **no area requiring invented business behaviour**: intake, eligibility, both lifecycles, inspection, upstream routing, parts, repair QC, handback, cost, custody, permissions and notification are all covered by confirmed discovery or ratified architecture. **`WARRANTY_REPAIR_ARCHITECTURE.md` v1.0.0 is written and registered** — `DOC-062`, prefix `WAR-`, 78 rules, `SM-13` and `SM-15` referenced and neither re-ratified. **No gap was closed by its existence.**
>
> ✅ **Trade-In resolved 2026-08-09 — also by writing, not by deferring.** The readiness test covered twenty areas and **found none requiring invented business behaviour**. **`TRADE_IN_ARCHITECTURE.md` v1.0.0 is written and registered** — `DOC-063`, prefix `TRD-`, 76 rules, `SM-18` and `SM-19` referenced and neither re-ratified. **The module is deliberately narrow**: allocation stays with Inventory Costing, stock with Inventory, physical holding with Warehouse, and **`E-083` Trade-In Credit with Accounting** — every one of those assignments predates the document and is retained. **No gap was closed by its existence.**
>
> ✅ **The defect class now has no surviving instance.** First found at Chat (`DOC-060`), tracked through `GAP-083`/`DOC-061` and `DOC-062`, and ended here. **Every entity-ownership value in `DOMAIN_MODEL.md` maps to a registered document**, verified entity by entity; `E-006` Employee is marked *Undetermined* but is superseded by `E-077` (`DM-068`) and is not a live owner.
>
> ⚠ **The registration defect had already produced a downstream error.** `CUS-059` and `RET-027` cited `PRODUCT_ARCHITECTURE.md` §32 as owning the warranty and repair lifecycles and repair execution — **§32 is a reconciliation of warranty *policy* and holds no lifecycle or execution content.** Both were written because no owning module existed to cite. **Corrected 2026-08-09**; recorded because it shows an unregistered owner does not stay a bookkeeping problem.

### ✅ Blocker 3 — CLEARED 2026-08-09 · every machine's event position is settled

> **`EVENT_ARCHITECTURE.md` is still v1.0.0, ratified 2026-08-04, and carries `EVT-001` – `EVT-087`. Nine state machines have been added since — `SM-12` through `SM-20` — and the document has no events for any of them.**

**This is not an oversight; it was a recorded decision that has since expired.** The index's propagation table states the reason verbatim: *"Events follow the machines. **Deferred until `SMA-018` (Warranty Claim) is specified**."* **`SMA-018` is now specified** — `SMA §21.1` closes it. **The condition the deferral depended on has been met, so the obligation under `DOC-021` is due.**

`SMA-011` names the same document independently: adopting the four proposed machines requires amending **`EVENT_ARCHITECTURE.md` §16**. **Two separate paths therefore arrive at the same unwritten amendment.**

⚠ **Writing events is architecture authoring, not documentary repair, so none was performed here.** The scope is Build Job, Warranty Claim, Marketplace Claim, Repair, Conversation, Permission Override, Trade-In Case, Trade-In Component and Fund Transfer — and it overlaps Blocker 2, since four of those nine machines belong to the two unregistered modules.

> ✅ **Worked 2026-08-09, and the finding is materially re-characterised.** The corpus was searched for every admissible form of event evidence. **The result changes what this blocker is.**
>
> **What was genuinely propagatable, and was propagated:** **`PRODUCT_ARCHITECTURE.md` §22 defines sixteen ratified `Product.*` events** — confirmed in their owning document since v1.0.0, with **its Appendix A item 8 recording the registration as an outstanding amendment**. They are now registered as **`EVT-088`** by delegation, the same convention `EVT-085` – `EVT-087` already use. **Not one event name, class or purpose originates in the register.** This partly covers **`SM-12` Build Job**, whose completion fact is `Product.AsBuiltRecorded`.
>
> **What was already covered and needed nothing:** **`SM-17` Permission Override** — `Permission.OverridePerformed` and the escalation events were registered at `EVT-085` all along. **`SM-15`'s inventory effect** is `EVT-041 Inventory.Deducted`.
>
> ✅ **Nothing remains. `SM-1` – `SM-20` are all resolved**, by two routes the register keeps distinct: **`SM-12`, `SM-13`, `SM-15`, `SM-18` and `SM-19` were covered by discovery** (§31 – §33, `EVT-089` – `EVT-102`), and **`SM-14`, `SM-16` and `SM-20` were proven to require no event at all** (`EVA-028`, `EVA-030`, `EVA-031`). **The list began at seven uncovered machines and reached zero without a single event being invented.**
>
> **So there was nothing to propagate for those seven.** Specifying them needs a producer, an occurrence point, consumers and each consumer's reaction — **none derivable from a state diagram**, and `SYS-050` requires an event to carry enough for a subscriber to act. **That is an authoring act reserved to the architect**, recorded at `EVA-019`, `EVA-020` and `EVENT_ARCHITECTURE.md` §19, and opened as `EVU-13` and `EVU-14`.
>
> ✅ **`SMA-011` is fully discharged** — §16 needed no amendment for `SM-3`, `SM-6`, `SM-10` or `SM-11`, because it is keyed by **module**, not by machine. **The two paths that appeared to converge on one unwritten amendment do not**: `SMA-011` is satisfied, and the remaining obligation is the seven machines' specification.
>
> ⚠ **Three false claims were withdrawn**, each deterministic: §16's claim to be *the complete inter-module coupling surface*; the `EVT-085`/`EVT-086` summary lists reading as exhaustive when Permission has eleven events and Audit eight; and a Document Control entity range of `E-001`–`E-057` when the model reaches `E-085`.

## Reconciliation points reviewed

| Point | Outcome |
|---|---|
| **`INV-23.1` mirror vs accumulating Customer Profile** | **STILL OPEN** — declined twice (`CHT-016`, `CUS-032`); no source states the Channel-Identity-as-mirror reading |
| **`E-023` ownership flag** | **STILL OPEN** — an attribute with no confirmed definition |
| **Blacklist reach across unlinked identities** | **ACCEPTED EXPOSURE** (`CUS-054`) |
| **`BR-026` after `BD-213`** | **STILL OPEN** — carried at `DLV §4.1` and `CUS §8` |
| **`E-032` delivery-charge representation** | **STILL OPEN** — a charge line referencing no product |
| **Subsidy vocabulary collision** | **STILL OPEN** — marketplace deduction vs Trioloo loss |
| **Release collision — three senses** | **STILL OPEN** — `WHS-028`, extended at `CHT §7` |
| **Pending Actual Courier Cost — state vs overlay** | **STILL OPEN** — reading recorded, not asserted |
| **`SM-5` `COLLECTED_BY_INTERMEDIARY` scope** | **STILL OPEN** — a Trioloo employee is not an intermediary |
| **Staff-held COD vs Funds In Transit** | **STILL OPEN** — same shape, different event |
| **`SM-10` competing state sets** | ✅ **RESOLVED** — `SM-10` was **ratified on the business-confirmed eight only** (`BD-349`, `SMA §22.3`, `RET-029`); `SMA §14.3`'s proposed set is marked superseded and **no state of it is registered**. **The two sets are not merged.** 🔶 **Residual point `RP-SM10-GATES`: no ratified source states at which of the eight stages a refund waits when a gate is open.** Recorded at `SMA §14.3` and `PAY §12.3`; no state invented to close it |
| **`OM §18.2` register vs `SMA`** | ✅ **CLEARED 2026-08-09** for `SM-3`, `SM-6`, `SM-10`, `SM-11` (`BR-142`). ⚠ `SM-12` – `SM-20` remain unregistered there — Blocker 3 |
| **`GAP-080` referral loop** | **STILL OPEN** — `SMA-032` and `RET §2.2` each referred the decision to the other |

## Entity, ownership and vocabulary findings

**Entity ownership is unambiguous.** Every entity carries exactly one data owner in `DOMAIN_MODEL.md`. Two superseded entities are correctly marked and not treated as current: **`E-006` Employee superseded by `E-077`** (`DM-068`) and **`E-064` Substitution Group narrowed to advisory** (`PRD-114`). Every `DOC-005` split that required an explicit boundary carries one — Inventory/Costing (`DOC-057`), Permission/Access Governance (`DOC-055`), Accounting/Payment (`DOC-056`), Chat/Customer (`DOC-060`).

**Vocabulary collisions remain, all registered, none silently resolved:** *subsidy* · *release* (three senses) · *Overdue* (`SM-9` vs `SM-16`) · *RTS* (Ready To Ship vs Return to Seller — `BD-214` unasked). **`SYS-016` requires one term one meaning; each is recorded rather than renamed, because `DOC-013` makes names permanent.**

**No duplicate rule prefix exists and no prefix remains reserved.** `INV-` correctly serves Domain Model invariants only; `IVN-` and `NOT-` supersede the reserved `INV-` and `NTF-` (recorded in the index §5.4 registry note). ⚠ **Two modules hold no prefix because they hold no registration** — see Blocker 2.

## Documentary repairs performed by this pass

**No business rule, entity, state machine, threshold or confirmed decision was changed.** Only the following, each an instance of a statement that had become false:

| Repair | Why it was a defect |
|---|---|
| **244 stale `⬜` markers removed** across 12 documents | Under `DOC-001` each asserted that a written document has no content. `HR_PAYROLL_ARCHITECTURE.md`'s markers are **retained** — that one is still true |
| **`(.)` placeholder link corrected** in `CHAT_ARCHITECTURE.md` | Resolved to the directory instead of failing visibly — the defect `GAP-051` names |
| **Index §12 status block** corrected to *30 sections, 272 of 272* | Understated completed discovery |
| **`DOC-061` added**; dashboard row 29 | HR & Payroll was in scope, deferred, and unregistered — `GAP-083` |
| **`SMA §14.3` marked superseded**; **`OM §18.2` annotated** | Two documents each stated something the other contradicted |
| **Three version records synced** in the index | `DOC-043` |

⚠ **In `BUSINESS_DISCOVERY.md` the `⬜` marker means *not yet asked* — a different symbol with a different meaning. Its 170 markers were deliberately left untouched.**


---

## GAP-112 — registered 2026-08-09

**Category:** Business · **Severity:** 🟢 Low
**Source:** `BD-435`, `PRD-141`, `PRD-142`, `ICO §11.1`. Raised by, not left over from, the answer that closed `GAP-015`

**Problem.** **`BD-435` requires an Ideal / Recommended Selling Price of *applicable product cost* + 25%.** **For a stocked item the cost input is canonical and nothing needs deciding** — `ICO-001` makes Weighted Average Cost the only method in the ERP. **It is not determined for every case the recommendation must serve:**

| Case | Why the cost input is undetermined |
|---|---|
| **Build-to-order PC** | **The primary mode under `SYS-080`.** Components **may not yet be purchased**, and **`ICO-018` defines the cost of a *finished* build, not an expected one** |
| **Bundle** | **`PRD-052` sets a bundle's price on the bundle, not computed from its members** — so a summed member cost is not an established basis |
| **Non-catalogued line** | **No product, therefore no cost** (`E-032` catalogued flag, `INV-32.2`) |

**Why it does not block.** **The recommendation is advisory and is never stored, reported, or consumed** (`PRD-140`, `PRD-143`). **The actual selling price is staff-entered in every one of these cases**, so a missing recommendation costs a convenience, not a decision. **`PRD-142` already governs the behaviour**: where no canonical cost exists, **no recommendation is displayed** — which is `INV-32.4` and `SYS-034` applied, not a new choice.

**Why it is still open.** **Choosing a forward cost estimate for an unbuilt PC is a business decision**, and no document makes it. **It must not be resolved in code** (`DOC-023`, `DOC-030`).

---

## GAP-113 — registered 2026-08-09

**Category:** Documentation · **Severity:** 🟢 Low
**Source:** found while registering `AUD-044` during the A2 propagation

**Problem.** **`AUD §12.2` is cited as *the register of auditable actions* by nine documents** — `PRODUCT_ARCHITECTURE.md` (`PRD-095`, `PRD-131`), `EVENT_ARCHITECTURE.md` (four events), `STATE_MACHINE_ARCHITECTURE.md`, `WAREHOUSE_ARCHITECTURE.md`, `REPORTING_ARCHITECTURE.md` (`RPT-047`), `API_ARCHITECTURE.md`, `BUSINESS_DISCOVERY.md`, and **`AUD-038` inside `AUDIT_ARCHITECTURE.md` itself** — **and that document has no §12.2.** §12 is a flat rule table with no subsections.

**Why it does not block.** **The register exists in substance**: `AUD-024` – `AUD-028`, `AUD-012`'s mandatory content, and `§22.2`'s alignment against `BD-107`'s eleven approval-gated decisions carry it between them. **No rule depends on the section number**, and every citing rule is independently sound.

**Why it is still a defect.** **Twenty-odd pointers resolve to nothing**, which is the same class of failure as the warranty mis-citation cascade found on 2026-08-08. **A reader following any of them finds no register.** Fixing it is a documentation pass — either the register is written at `§12.2` or every citation is redirected.

---

## GAP-114 — registered 2026-08-09

**Category:** Workflow · **Severity:** 🟡 Medium
**Source:** `SMA §10.8`, found while establishing courier variance authority under `BD-440`

**Problem.** **`SMA §10.8` states *“Accounts Manager accepts variances **within bounds** and above them escalates.”*** **Both halves are unsupported:**

- **No discovery answer anywhere establishes an *Accounts Manager* role.** `PRM-051` records authority as concentrated in owners and administrators, and `BD-437` narrowed even that to staffing rather than rule.
- **No numeric bound is enforced anywhere in the architecture.** `BD-108` and `BD-275` established that the business uses no fixed limits, and **`PRM-052` withdrew `PRM-008`'s magnitude rows.**

**Why it matters.** It is **the only existing statement of who may accept a settlement variance**, and it governs the **marketplace** path. **`BD-440` has now decided the courier path on a different basis** — permissioned Accounts for a legitimate deduction, `BD-110` owner/administrator for a genuine write-off — and **explicitly forbids inventing a fixed Accounts role or monetary threshold.** The two paths now rest on incompatible foundations, one of them evidenced and one not.

**Why it was not amended.** **Correcting it requires marketplace settlement discovery, which A3 had no mandate to perform** (`DOC-023`, `DOC-050`). **Recorded as a conflict, not resolved.** `BD-440`'s courier decision is unaffected.

---

## GAP-115 — registered 2026-08-09

**Category:** Costing · **Severity:** 🟡 Medium
**Source:** raised by `BD-441`'s negative-stock support, against `ICO-001`

**Problem.** **`ICO-001` makes Weighted Average Cost the only inventory costing method**, and `ICO-002` derives inventory value from cost movements. **`BD-441` now supports a negative physical balance** — goods dispatched before they were received. **How weighted average cost behaves across a negative balance is specified nowhere**: what cost a deduction takes when nothing is on hand, and what happens to the average when the replenishing receipt arrives at a different price.

**Why it does not block Architecture Freeze.** **No ratified rule is contradicted.** `DB-001` derives positions from movements, and `ICO-030`/`ICO-031` already forbid retrospective restatement and require forward-only correction by linked movement — **so the discipline exists even though the arithmetic is unstated.** **`ICO-009` already records that margin from `ICO-007` is knowably incomplete.**

**Why it is real.** **It is a genuine consequence of a decision just taken, not a pre-existing omission**, and **choosing a convention would be inventing an accounting rule** (`DOC-023`, `DOC-030`). **Must be resolved before inventory valuation is implemented.**

## GAP-116 — ✅ **CLOSED 2026-08-09 by `BD-442`** — the final Architecture Freeze blocker

> ✅ **One Order, one parcel.** **No split into multiple shipments in V1; partial shipment not supported; partial delivery is not an Order lifecycle outcome** (`BR-158` – `BR-162`). **`PARTIALLY_DELIVERED` removed from `SM-1`; `BR-025` withdrawn; `BR-023` amended to *at most one **active** shipment*.**
>
> ✅ **Nothing had to be invented, because the delivery model already agreed.** **`BD-073` confirms seven failed-delivery causes and every one is whole-parcel** — including *customer refuses the parcel* — and **`REFUSED` is a parcel-level outcome.** **`OM §10.5`'s *“customer accepts some items and refuses others”* was the only item-level acceptance anywhere in the corpus and no discovery supported it.** A refused parcel goes to **`FAILED_DELIVERY` → RTO**, already specified by `BR-117`, `DLV-044`, `DLV-050`.
>
> ✅ **`SM-3` PRESERVED, and not by concession.** `SMA-002`'s split illustration was withdrawn; **the rule was untouched and `SM-3` passes it on subject** — `E-035` Pick Task has **eleven states**, none of them Order states (`SMA-082`).
>
> ⚠ **Concurrency is withdrawn; multiplicity is not.** An RTO'd parcel re-sent **is** a second shipment.

**Original text follows.**

## GAP-116 — registered 2026-08-09

**Category:** Workflow · **Severity:** 🟡 Medium
**Source:** found while auditing backorder behaviour; recorded rather than resolved

**Problem.** **The business states that partial shipment and split Orders are not supported**, while the corpus models both: **`BR-023` permits an order to split across warehouses**, `SM-3` accommodates two pick-and-pack processes at once, **`OM §10.5` defines `PARTIALLY_DELIVERED`** with its own seven-step flow, and **`OM §9` names *“backorder of some lines with customer agreement to part-ship”* as a splitting trigger.**

**Why it surfaced here.** **That last trigger is a backorder mechanism**, and `BD-441` establishes there is no backorder flow — so **the trigger describes something that does not happen.**

**Why it was not resolved.** **Deciding whether split shipment and partial delivery are supported at all is a business decision A4 had no mandate to make** (`DOC-023`, `DOC-050`). ⚠ **Mitigating fact:** discovery records the brands as sharing **one warehouse and one inventory**, so the multi-warehouse trigger is **moot in current practice** regardless of how the rule reads. **`BD-441` is unaffected either way.**

---

## GAP-117 — ✅ **RESOLVED 2026-08-10** — `ACC-077` – `ACC-085`, `E-089`

> ✅ **The minimum mechanism, and deliberately nothing more.** **`E-089` Authorised Accounting Adjustment posts from an authorised business decision rather than from a movement of money, and cannot exist without that decision** (`ACC-077`, `ACC-078`, `INV-89.1`). **That single constraint is what keeps it from being a free-form journal system** — there is **no unrestricted ledger entry, no arbitrary debit/credit screen, and no user-originated posting.**
>
> **It fabricates no cash movement** (`ACC-079`), **is immutable with corrections as new linked adjustments** (`ACC-080`), **carries actor, time and reason with permission held by the owning capability's own rule rather than a generic posting right** (`ACC-081`), **creates no new account, category or hierarchy** (`ACC-083`), and **a Journal Voucher renders one but never creates one** (`ACC-082`).
>
> ✅ **Two of the three confirmed needs are fully served**: **advance → accepted company expense** and **advance → authorised write-off**.
>
> ⚠ **The third is deliberately incomplete and is not presented otherwise.** **`ACC-084`: the salary-recovery counterpart cannot be determined without HR & Payroll** (`SYS-093`). **The generic mechanism is ratified; the payroll-originating trigger is not**, and **`BD-450`'s reconciliation obligation is carried to that stage.** **The route is NOT implemented.**

**Original text follows.**

## GAP-117 — registered 2026-08-09

**Category:** Accounting · **Severity:** 🟡 Medium · **Class:** **B — pre-implementation dependency**
**Source:** `BD-447`, `ACC-057`. Found by testing for a mechanism before recording a document that depends on it

**Problem.** **`BD-447` records the Journal Voucher as the document representation of an *authorised journal entry* — a non-cash accounting adjustment or reclassification. No such mechanism exists in the frozen architecture.**

**Every posting is driven by a business event owned by another module.** **`ACC-011` — *the module that owns the business event owns the decision to post; Accounting owns what the posting is*** — and `ACC-003` creates the record when that event occurs. Revenue at delivery (`ACC-013`), payable at acceptance (`PRC-002`), transfer legs (`ACC-030`), scrap (`ACC-029`), returns by linked adjustment (`ACC-016`), reversals as new compensating transactions (`ACC-031`): **every one has an originating event outside Accounting.**

**There is no manual journal entry anywhere — no entity, no state, no event, no permission, no rule.** `ACC-008` keeps the chart of accounts flat with **no posting rules per category**, and the Financial Account assessment recorded the model's own summary: ***“Nothing requires manual entry”***.

**Why it does not reopen the Freeze.** **No frozen rule is contradicted** — the architecture is silent, not wrong, and **`ACC-003` continues to deny posting authority to any document.** **The V1 transactional spine is unaffected**: every posting it needs already has an originating event. **A Journal Voucher simply cannot be built until the mechanism behind it is decided.**

**What resolution requires.** A business decision on **what an authorised journal entry is, who may raise one, and what it may touch** — and then an architecture amendment under `DOC-066` – `DOC-070`. ⚠ **`BD-447` explicitly prohibits inferring adjustment categories, account-selection rules, approval hierarchy, thresholds, or creator/approver rules from it.** **Nothing here may be chosen in code** (`DOC-023`, `DOC-030`).

---

## GAP-118 — ✅ **RESOLVED 2026-08-10** — `PRM-006` amended, `PRM-071`, `PRM-072`

> ✅ **`PRM-006` now reads: *no actor approves their own request, override, or exception, **except where a specific business capability explicitly permits it and the actor holds the required permission***.** The universal wording is **retained under `DOC-009`**.
>
> ✅ **The exception is narrow by construction** — **not a general right, not self-grantable** (`PRM-046` untouched), **a capability must name it**, and **only Advance Requisition does** (`PRM-071`). **`Requested By` and `Authorised By` stay separate facts even when identical** (`PRM-072`, `INV-86.7`).
>
> ⚠ **`INV-29.1` — a Purchase Order's approver is never its creator — STANDS UNCHANGED.** It was tested: **Procurement names no exception, so `PRM-006`'s default still binds it.** **Changing that would need its own business decision, and none has been taken** (`DOC-023`).
>
> ✅ **`PRM-012` is untouched and now has real work**: **write-off is owner/administrator only** while **authorising and accepting are permission-controlled** (`ACC-068`).

**Original text follows.**

## GAP-118 — registered 2026-08-09

**Category:** Permission · **Severity:** 🟠 High · **Class:** **B — must resolve pre-implementation**
**Source:** `BD-452`, Advance / Requisition discovery. **Reported rather than resolved** (`DOC-050`)

**Problem.** **`BD-452` permits a person to request an Advance Requisition and authorise that same requisition themselves**, where they hold the permission, and **explicitly forbids introducing a mandatory second-person rule.**

**`PRM-006` says the opposite:** ***“No actor approves their own request, override, or exception”*** (`SYS-069`) — a stated architecture principle under `§4.6 P6 — Authority to act is not authority to approve.*

**Why the existing narrowing does not cover it.** **`PRM-066` narrowed `PRM-006`** to exempt *“acting within authority one already holds — **no approval step is involved**”*. ⚠ **An Advance Requisition has an explicit approval step** — request, then authorise — **so it is literally approving one's own request.**

**Why `PRM-050` does not settle it either.** `PRM-050` recorded that `PRM-006` and `PRM-012` are *“not violated in principle but are not observed in practice”* and **“remain as written and become enforceable as the team grows”**, with `PRM-014` accepting the conflict for a small team. ⚠ **`BD-452` states a different position**: not a staffing compromise awaiting growth, but **a permission model that must not be overridden by a mandatory second-person rule at all.**

**Why it does not block discovery.** **Advance / Requisition discovery continues** — the conflict is about **who may authorise**, not about what the capability does. **Audit is unaffected**: `BD-452` requires Requested By/At and Authorised By/At to stay **separately recorded even when one person**, which is `PRM-070` and `AUD-012` satisfied.

**What resolution requires.** A decision on whether `PRM-006` is **scoped** (to overrides and exceptions, not routine authorisation), **narrowed further**, or **carried as an accepted conflict under `PRM-014`** — then an amendment under `DOC-066` – `DOC-070`. **Not chosen here** (`DOC-023`, `DOC-030`).

⚠ **One adjacent rule must be re-tested with it.** **`INV-29.1` — *a Purchase Order's approver is never its creator*** — rests on `PRM-006`. **If `PRM-006` is narrowed, `INV-29.1` may rest on a rule that no longer says what it cites.** **Procurement's to resolve; recorded here so it is not missed.**

---

## GAP-119 — registered 2026-08-10

**Category:** Accounting · **Severity:** 🟡 Medium · **Class:** **B — must resolve with HR & Payroll**
**Source:** `ACC-084`, the one part of `GAP-117` that could not be closed

**Problem.** **Salary deduction is one of five Advance settlement routes** (`ACC-063`), and **its accounting counterpart cannot be specified without HR & Payroll.** `SYS-093` defers payroll processing past V1, so **the position a salary recovery moves value *to* does not exist yet.**

**What IS settled.** The **generic mechanism** is ratified — `E-089` and `ACC-077` – `ACC-085` — and the **allocation discipline** is ratified: **`BD-450` requires the payroll deduction and the Advance settlement allocations to reconcile to the same figure**, with **explicit per-requisition allocation and no automatic convention** (`ACC-064`, `ACC-065`).

**Why it does not block Advance / Requisition.** **Four of the five settlement routes are complete.** **`ACC-084` states plainly that the salary route is not implemented**, so **it cannot be mistaken for working behaviour** (`DOC-065`).

**What resolution requires.** The HR & Payroll stage: the deduction occurrence, its counterpart position, and the reconciliation contract with `E-087`. **Not chosen here** (`DOC-023`).

---


---

## GAP-120 — registered 2026-08-10 · ✅ **CLOSED 2026-08-16**

**Category:** Access Governance · **Severity:** 🟡 Medium · **Class:** **Deployment / bootstrap architecture**
**Source:** `BD-485` §10, deliberately excluded from the Owner-designation rule

**Problem.** **`AGV-038` grants Owner status only through an existing Owner, and `AGV-011`/`INV-77.5` create accounts only through an authorised Owner or Administrator.** ⚠ **Neither can produce the first one.** **The normal rule assumes at least one Owner already exists.**

**What IS settled.** **Everything after the first Owner.** `AGV-037` – `AGV-041` fully govern grant, revocation, representation and audit.

**Why it does not block HR & Payroll.** **The payroll authorities that depend on the Owner predicate** — waiver (`PRM-073`), Employee Loan (`PRM-076`, `PRM-077`) and write-off (`ACC-067`) — **evaluate against an existing Owner and are unaffected by how the first one came to be.**

**✅ CLOSED 2026-08-16 — `AGV-042`, AND THE PRODUCTION FIRST OWNER NOW EXISTS.** ⚠ **Both halves were required: a ratified mechanism is not a closed gap until the account it enables actually exists.** ✅ **Verified read-only against production, not from the command's own output.**

| Part | State |
|---|---|
| **Owner designation persisted** (`AGV-037`) | ✅ **COMPLETE** — `V13`, carried on `E-077`; never a role, override or scope grant |
| **Owner authority resolution** (`AGV-033`) | ✅ **COMPLETE** — intrinsic and DYNAMIC: the entire catalogue at resolution time, never a stored snapshot |
| **Bootstrap mechanism** | ✅ **COMPLETE** — server-side command, no HTTP surface, transactional, concurrency-safe, refuses once any Owner exists |
| **Truthful provenance** (`AGV-041`) | ✅ **COMPLETE** — `INITIAL_BOOTSTRAP` names no designating Owner; the database refuses a dishonest grant |
| **Production first Owner created** | ✅ **COMPLETE** — created 2026-08-16 by the operator, who entered the password directly at the server console. 🔴 **The password passed through no tooling, no argument, no environment file and no log.** ⚠ **The profile is `INVITED` with no `activated_at`, which is CORRECT: the canonical `INVITED → ACTIVE` transition belongs to the first successful sign-in** (`AGV-001`). |

**Production verification, 2026-08-16 — read-only.** **One profile: `TheMithun` / *Mithun Ahamed* · owner designation present · origin `INITIAL_BOOTSTRAP` · designated-by `NULL` · lifecycle `INVITED` · `activated_at` NULL.** **One credential, stored as a `{bcrypt}` hash; no unhashed credential exists.** ✅ **ZERO roles, ZERO role assignments, ZERO permission overrides and ZERO scope assignments** — **the authority comes from the designation alone** (`AGV-037`, `AGV-039`). ✅ **The repeat guard was exercised and REFUSED with `AGV-038`'s reason; the counts stayed 1/1/1 and the existing Owner was untouched.**

🔴 **NO DEFAULT CREDENTIAL, NO SEEDED ADMIN, NO PUBLIC SETUP ROUTE AND NO MANUAL SQL WAS USED OR INTRODUCED.** ⚠ **`GAP-121` and `GAP-122` are untouched by this closure.**

---

## GAP-121 — registered 2026-08-10

**Category:** Permission · **Severity:** 🟡 Medium · **Class:** **B — general authority-granting constraint**
**Source:** found during the `BD-485` reconciliation

**Problem.** **`PRM-046` prohibits an actor granting *themselves* authority they do not hold, and `AGV-032` covers only an administrator's *own* permissions.** ⚠ **No rule constrains granting ANOTHER user an authority the granting actor does not hold.** **The self-elevation door is closed; the grant-upward-to-someone-else door was never addressed.**

**What IS settled.** ✅ **Closed for the Owner predicate** — `AGV-038` reserves granting Owner to existing Owners and `AGV-039` makes it unreachable by override. **Bounded magnitude authority is separately governed** (`PRM-008`, `AGV-024`).

**Why it is not urgent.** **`PRM-003` denies by default and `PRM-004` enforces at every entry point**, so any granted authority is still checked when exercised. **The exposure is the grant act, not the resulting action.**

**What resolution requires.** A business decision on whether an actor may grant authority beyond their own. **No general rule invented** (`DOC-023`).

---

## GAP-122 — registered 2026-08-10

**Category:** Access Governance · **Severity:** 🟡 Medium · **Class:** **B — undiscovered business rule**
**Source:** `BD-485` §4, which addresses revoking *another* Owner only

**Problem.** **Self-revocation is undefined.** `AGV-038` says an Owner may revoke another Owner's status; **it does not say whether an Owner may revoke their own.**

**Why it matters.** ⚠ **Trace the floor.** With two Owners, A may revoke B, leaving one. **That last Owner can only be revoked by another Owner, and none exists — so zero Owners is currently unreachable and the system stays recoverable.** 🔴 **But it is safe by SILENCE, not by design.** **If self-revocation is later permitted, the last Owner could remove themselves, and `AGV-038` would make that unrecoverable** — **no Administrator could ever restore Owner authority** (`AGV-038`, `AGV-039`).

**What is NOT inferred.** **No last-Owner floor, minimum-Owner count, succession rule or Administrator fallback is created** (`BD-485` §9, `DOC-023`, `SYS-034`).

**What resolution requires.** One business answer: **may an Owner revoke their own Owner status, and if so what happens when they are the last one.**



---

## GAP-123 — registered 2026-08-10

**Category:** Domain / module ownership · **Severity:** 🔴 High · **Class:** **B — must resolve at HR & Payroll Architecture**
**Source:** found while reconciling `BD-488` §9

**Problem.** **Employee Loan has no owning module and no entity anywhere in the architecture.** **It appears in `ACCOUNTING_ARCHITECTURE.md`, `SYSTEM_ARCHITECTURE.md` and `DOMAIN_MODEL.md` — in none of them.** It exists only in [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §41 and in the authority rules `PRM-075` – `PRM-078`. **No `E-` entity, no module registration, no owning document** (`DOC-005`).

**Why it is load-bearing.** **`BD-488` §9 instructs that a write-off's accounting consequence *“follow the existing write-off/accounting architecture”*** — ⚠ **but there is no registered position for it to follow from.** **The same applies to `BD-486` §8's source-of-truth boundary**, which names *“the Employee Loan capability”* as authoritative for a position no document owns.

**Why it cannot be closed by inference.** ⚠ **`ACC-060`/`ACC-061` assign Advance / Requisition to Accounting** — *“not owned by HR & Payroll merely because the counterparty is an employee”*, **because the position it maintains is an accounting position** — with `E-086` – `E-088` carrying it. **That reasoning would apply equally to a loan.** 🔴 **Applying it is exactly the pattern-matching `BD-488` §10 forbids**: *Employee Loan and Advance Requisition remain separate capabilities even where they share the same write-off discipline.*

**What IS settled.** **The business behaviour is extensively discovered** — `BD-477`, `BD-479` – `BD-481`, `BD-484`, `BD-486` – `BD-488`: authority, schedule, shortfall, repayment routes, interest-free status, write-off, and the derived four-term balance. **The authority rules are ratified.** ✅ **Two answers have separately established that the loan needs no new accounting mechanism** — **no income leg** (`BD-487`) and **`E-089` unmodified for write-off** (`BD-488` §9).

**Why it does not block discovery.** **Remaining loan questions — schedule amendment, termination treatment — are business behaviour and can be answered without it.**

**What resolution requires.** A module-ownership decision at the HR & Payroll Architecture stage: **which document owns the Employee Loan position, and what entity carries it.** **Not chosen here** (`DOC-023`, `DOC-030`).



---

## GAP-124 — registered 2026-08-10

**Category:** Accounting / HR & Payroll · **Severity:** 🔴 High · **Class:** **B — must resolve at HR & Payroll Architecture**
**Source:** found while reconciling `BD-490` §4

**Problem.** **The outstanding-salary-payable position — salary earned but not yet paid — exists in discovery only.** **`BD-476` describes it; no ratified `ACC-` rule establishes it**, and **it appears nowhere in this document.** ⚠ **Verified before registering: `BD-476` had never been referenced in `GAP_ANALYSIS.md`.**

**Why it is load-bearing now.** **`BD-490` §4 makes earned-but-unpaid salary the FIRST named component of Final Settlement's positive side.** **`BD-490` §2 requires Final Settlement to be a computed view over *authoritative underlying positions*** — ⚠ **and for this component there is no authoritative position to compute from.**

**Distinct from `GAP-119`.** **`GAP-119` is the salary-RECOVERY counterpart** — the accounting position a salary deduction moves value *to* when settling an Advance. **`GAP-124` is the opposite direction**: **the position representing what Trioloo OWES the employee.** **Related, not the same.**

**Same defect class as `GAP-123`.** **A position the business has discovered, that the architecture does not own.** ⚠ **Two now exist, both surfaced within the Employee Loan and Final Settlement discovery.**

**What IS settled.** **The business behaviour** — `BD-476` establishes the position, and `BD-475` governs payroll finalisation and correction. **`BD-490` §9 specifies the traceability every included amount must carry.**

**Why it does not block discovery.** **Final Settlement discovery is about business behaviour and continues normally.** **It blocks HR & Payroll Architecture and Final Settlement Architecture.**

**What resolution requires.** A ratified accounting position for salary payable at the HR & Payroll Architecture stage. **Not chosen here** (`DOC-023`, `DOC-030`).



---

## GAP-125 — registered AND CLOSED 2026-08-10

**Category:** Order Management / Integration · **Severity:** 🔴 High · **Status:** ✅ **CLOSED on registration**
**Source:** found during the `BD-498` corpus inspection · **Resolved by:** `BD-498`, `BR-168` – `BR-176`

**Registered rather than skipped** because it was a live contradiction between ratified rules, and `DOC-009` requires the finding to survive its own resolution.

**The problem.** 🔴 **Three ratified positions could not all hold:**

| | |
|---|---|
| **`BR-003`** | *Local edits to mirrored fields are prohibited … **never a local override*** |
| **`§3.5`** | **Declared *direct-channel* order content Trioloo-owned** — ⚠ **and never declared who owns MARKETPLACE order content**, which **`API-005` forbids**: authority is *“declared rather than assumed”* |
| **`§7.8` / `§7.9`** | **Marketplace Orders receive full verification identical to website**, and **an agent may amend address, delivery timing, quantity, product and price** |

**So a developer implementing marketplace order amendment had no correct behaviour to write**: **`BD-319` (*the ERP is the primary operational system after import*) pulled one way and `BR-003` pulled the other.**

**No prior GAP covered it.** ⚠ **Verified before registering** — **`GAP-085` is completeness reconciliation (*did an order arrive?*) and `GAP-086` is late-versus-missing thresholds.** **Neither concerns ownership or overwrite behaviour.**

**Why it was a V1 blocker.** **Not because sync was unimplementable, but because §7.9 already AUTHORISED an operation the corpus elsewhere PROHIBITED.**

**Resolution.** ✅ **`BD-498` resolves it by removing the precondition rather than choosing a side.** **`BR-003`'s antecedent is *“where an external party holds authority”***, and **`BR-168`/`BR-169` make that a declared, one-way, attributable Order-level state** — so **after takeover the external party no longer holds authority over operational content.** ✅ **`BR-003` stands unchanged in text and force**, **`§7.9` needed no change**, and **`§3.5` gained the row it was missing.** **`BR-171` keeps externally-authoritative facts syncing throughout, so the mirror discipline is retained exactly where it still applies.**



---

# HR & Payroll Architecture — GAP dispositions, 2026-08-10

**Source:** [`HR_PAYROLL_ARCHITECTURE.md`](HR_PAYROLL_ARCHITECTURE.md) v1.0.0.

## ✅ `GAP-119` — CLOSED

**The Advance Requisition salary-recovery route.** **`ACC-084` recorded that the accounting counterpart could not be specified without HR & Payroll.** ✅ **All six conditions are now met** — authoritative finalised salary payable (`ACC-093`) · payroll-side recovery occurrence (`HRP-042`) · specific AR allocations (`HRP-043`) · Accounting-side counterpart (`E-087`, unchanged) · reconciliation to the same figure (`HRP-045`) · no duplicate advance balance in Payroll (`INV-94.4`).

✅ **`ACC-097` records that all five Advance settlement routes are now specified.** ⚠ **No new mechanism was required** — **`E-089` posts the non-cash recovery unmodified, exactly as `BD-479` §6 anticipated.**

## ✅ `GAP-123` — CLOSED

**Employee Loan had no owning module or entity.** ✅ **Accounting owns it** (`ACC-086`), **carried by `E-098` and `E-099`.**

⚠ **The ownership was TESTED, not assumed.** **The same test `ACC-060` applied to Advance / Requisition was applied again**: **the position it maintains is an accounting position — an employee receivable — and the parts that are not already have owners.** **HR & Payroll owns the recovery occurrence only** (`HRP-046`). 🔴 **Split ownership of the POSITION was rejected** under `DOC-005`; **the payroll occurrence is a different subject with a different owner, which `ACC-061` already established as the correct shape rather than a split.**

✅ **The counterparty being an employee did not make HR the owner** — **the test the business itself set at `BD-448`.**

## ✅ `GAP-124` — CLOSED

**Outstanding Salary Payable had no ratified position.** ✅ **Accounting owns it** (`ACC-093`): **`Finalised Net Salary − Confirmed Salary Payment movements`, derived and never editable.** **HR & Payroll establishes it** (`HRP-051`); **Payment settles it** (`PAY-091` – `PAY-093`). **Partial and split payment supported; the position is visible, not a trigger** (`ACC-095`).

## ⬜ `GAP-083` — superseded in effect

**Registered HR & Payroll as DEFERRED POST-V1** (`DOC-061`). ⚠ **`SYS-093` is amended and the module is now V1 and written.** **The registration defect it recorded was already discharged; the deferral it recorded no longer holds.**

## 🔴 `GAP-126` — registered 2026-08-10

**Category:** HR & Payroll · **Severity:** 🟡 Medium · **Class:** **Pre-implementation dependency**

**Problem.** **`BD-005` named twelve deduction types. Four have ratified formulas** — late, absence, early departure, LWP — **and two have ratified mechanics** — Advance Requisition recovery and Employee Loan instalment. 🔴 **Six do not exist at all**: **damage/loss · penalty/disciplinary · Tax · Provident Fund · other recurring · other one-time.**

**Why it is not a V1 blocker.** ✅ **`HRP-040`'s three deduction classes accommodate an additional established deduction without structural change**, and **`BD-481` §1's `Net Salary ≥ 0` floor was written precisely to protect against deduction types that do not yet exist.** **V1 payroll is implementable with the four attendance deductions and the two recoveries.**

**Why it is registered.** ⚠ **`BD-128` (Provident Fund) and `BD-129` (Tax) have been unanswered since 2026-08-05**, and **`SYS-092` keeps statutory reporting out of V1** — **so the absence is deliberate, but a payroll that later gains Tax or PF will need `HRP-040`'s classes re-tested against capacity.** **Not resolved by assumption** (`DOC-023`).



---

## GAP-127 — registered 2026-08-10

**Category:** HR & Payroll · **Severity:** 🟡 Medium · **Class:** **B — Future Extension / Configurable Policy**
**Source:** found while architecting Final Settlement (`HRP-064`, `HRP-080`)

**Problem.** **An authorised earning becomes PAYABLE only by being included in a payroll run** — **`BD-496` §5 and `BD-497` §9 nominate a payroll period, and `HRP-064` lets an authorised bonus or commission participate in Final Settlement.** 🔴 **An earning nominated to a period AFTER the employee's final payroll run has no run to be included in, and therefore no payable position for Final Settlement to consume.**

**Two concrete routes into it.** **A bonus authorised for a future period where the employee leaves first** (`BD-496` carried item), and **a commission becoming eligible because an Order delivers after departure** (`BD-497` §5). ✅ **Recorded at both points as one family; this registers it.**

**Why it is NOT a V1 blocker.** ✅ **The final payroll period is the natural nomination, and nothing prevents nominating to it.** **V1 is deterministically implementable**: an earning nominated to a period that runs is included; one nominated to a period that never runs is not payable, which is a correct outcome rather than an undefined one. ✅ **`HRP-080` already routes anything arising after finalisation through the correction discipline.**

**Why it is registered rather than assumed away.** ⚠ **Nothing REQUIRES re-nomination**, and **no rule states what happens to an earning stranded in a period that will never run.** ⚠ **Creating one — automatic re-nomination, or automatic inclusion in the final run — would be inventing policy** (`DOC-023`, `DOC-030`).

**Classification against the four classes.** **A. V1 blocker** — no. **B. Future extension** — ✅ **yes.** **C. Already handled by an owning capability** — partly, by `HRP-080`. **D. Reporting/UI only** — no.



---

## GAP-128 — registered 2026-08-10

**Category:** Document / Printable · **Severity:** 🟡 Medium · **Class:** **A — blocks TWO DOCUMENTS ONLY, not the stage**
**Source:** found during the Document / Printable Architecture corpus inspection

**Problem.** **`BD-006B` names Quotation and Proforma Invoice among the documents the business issues, and nothing further was ever discovered about either.** 🔴 **`BD-134` — *what makes a sale need a Quotation or a Proforma Invoice, rather than going straight to a Sales Invoice?* — has been open since 2026-08-05 and is still unanswered.**

**What is missing.** **When either is issued · what it contains · whether it is numbered · whether it binds a price · whether it expires · what happens when it converts to an order · whether either may be amended or cancelled.** ⚠ **Architecting them would be pure invention** (`DOC-023`, `DOC-030`).

**What IS settled and is preserved.** ✅ **Neither is a Sales Invoice** (`BD-443` establishes one canonical invoice), and **neither creates revenue, a receivable, a tax liability or a completed sale** — **`BD-304` recognises revenue at successful delivery, and nothing recognises it at quotation.**

**Why it does not block the stage.** ✅ **Every other V1 document is fully architected** (`PRN-023`). **`GAP-128` blocks the design of these two documents and nothing else.**

**What resolution requires.** One business answer: `BD-134`.



---

## GAP-132 — registered 2026-08-15

**Category:** Shops & Channels / Marketplace Integration · **Severity:** 🟠 High · **Class:** **A — blocks the marketplace live gate, not the architecture**
**Source:** found by the Shops & Channels contract extraction, 2026-08-15

**Problem.** **The ENTITY model is complete and the IMPLEMENTATION is a placeholder.** `E-016` has been canonical since the domain model was written, `DM-059` proved it sufficient for seven seller accounts, and `INV-16.4`–`INV-16.10`, `SYS-108`, `SYS-109`, `API-068`–`API-070`, `PRM-090` and `UX-273` now close every business decision the extraction raised. **What does not exist is any of it in the running system.**

**The debts, recorded exactly.** ⚠ **`channel_instance` persistence sits physically under a PRODUCT package while `E-016` is canonically SYSTEM-owned** (`DM-084.b`) · **Administration → Shops & Channels renders a placeholder** · **no write API exists — nothing in the codebase creates or updates a Channel Instance** · **the route carries no permission and the four `PRM-090` codes are unimplemented** · **no connection persistence or lifecycle exists** (`API-068`) · **no OAuth, callback or token storage exists** · **no Channel Type table exists — `channel_type` is a free-text column with no `E-015` behind it** · **six of `E-016`'s canonical attributes are unpersisted: business unit, market, external shop identifier, commission structure, settlement cycle, default warehouse, courier preference and the credentials reference.**

**Why it is registered rather than fixed.** ✅ **These are IMPLEMENTATION absences, not unresolved business meaning** — the distinction `DOC-080` depends on. **Every one of them now has a canonical answer to build against**; none requires a further business decision.

**Why it does not block the architecture.** ✅ **Nothing above changes an entity, an invariant or an ownership boundary.** **`DM-084.d` deliberately leaves WHERE the connection record lives as an Integration persistence question, which is an implementation design, not a business gap.**

**What resolution requires.** **Implementation of the minimum production gate as scoped by [`SHOPS_CHANNELS_SCREEN_CONTRACT.md`](SHOPS_CHANNELS_SCREEN_CONTRACT.md) v2.0.0** — workspace · add/edit shop · connection summary · external shop identity display · Connect / Reauthorize entry · **`Activate`** · permission enforcement — **plus the Integration-owned authorisation work behind it.** ⚠ **AMENDED 2026-08-15 — the superseded enumeration read "configuration lifecycle actions", which described v1.1.0's Suspend/Reactivate/Archive controls; those are now DEFERRED and only `Activate` is in the gate** (`SCS-080`, `DOC-009`). ⚠ **Deferred and NOT part of that gate:** commission structures · settlement cycle · default warehouse · courier preference · business unit · order counts · full capability matrix · operation and API logs.



---

## GAP-133 — registered 2026-08-15

**Category:** Shops & Channels · **Severity:** 🟠 High · **Class:** **A — blocks implementation of the approved design, not the architecture**
**Source:** reconciliation of the user-approved Shops & Channels Feature Pack against `V5` persistence

**Problem.** **The approved design displays facts the schema does not hold.** `channel_instance` persists exactly `id`, `code`, `name`, `channel_type`, `record_status`, `created_at`, `updated_at`. **Every one of the following is ratified by `SCS-040`–`SCS-042` and `INV-16.14`–`INV-16.16` and has NO column, NO projection and NO endpoint:**

> ✅ **IMPLEMENTED 2026-08-15 — `V11__shops_and_channels.sql` plus the `system` and `integration` modules.** ⚠ **The table below now records STATE, not only the original absence; the rows marked REMAINS are the ones that genuinely did not ship.**

| Ratified requirement | State |
|---|---|
| **External account identity** (`INV-16.5`) | ✅ **COMPLETE** — persisted, projected, and writable only by an authorisation outcome |
| **External link** (`INV-16.14`) | ✅ **COMPLETE** — persisted and projected as a SECOND fact, never the identity |
| **Bound-at / authorised-at** (`INV-16.15`) | ✅ **COMPLETE** — captured at the authoritative act; renewal does not move the binding date |
| **Activated-at / activated-by** (`INV-16.15`) | ✅ **COMPLETE** — captured by the transition, with the actor (`AGV-001`) |
| **Connection condition + last-observed** (`INV-16.16`, `API-068`) | ✅ **COMPLETE** — `channel_connection`, Integration-owned, read through a port; absence means never authorised |
| **Market** (`INV-16.7`) | ✅ **COMPLETE** — persisted, required on create, and validated against the CLOSED ratified set (`INV-16.7.a`–`INV-16.7.d`); enforced in the application AND by a `V12` database constraint |
| **Search over name, code, link** (`SCS-022`) | ✅ **COMPLETE** — server-resolved, and deliberately not widened |
| **Channel / connection / status filters** (`SCS-023`) | ✅ **COMPLETE** — server-resolved, combined as AND, with tokens and Clear |
| **Summary strip and attention counts** (`SCS-020`, `SCS-021`) | ✅ **COMPLETE** — DERIVED on read; no counter column exists |
| **Create / update / activate** | ✅ **COMPLETE** — `POST` / `PUT` / `POST …/activate`, each on its own capability |
| **Four `PRM-090` capability codes** | ✅ **COMPLETE** — seeded by `V11` and enforced in the application services |
| **Provider credential persistence and encryption** | ✅ **COMPLETE 2026-08-16** — `V14` `channel_credential`, AES-256-GCM with owner-bound AAD, one key version per row, key held only in deployment configuration (`TEC-119`, `DEP-123`) |
| **OAuth callback correlation** | ✅ **COMPLETE 2026-08-16** — `V14` `channel_authorisation_attempt`: hash-only, expiring, one-time, shop-bound (`TEC-120`) |
| **A provider authorisation adapter** (Daraz, Shopify, WooCommerce, Website) | 🔴 **REMAINS** — the PORT, the binding rules and all three `SCS-044` outcomes are built and tested; **no adapter, OAuth client or credential store exists**, so `Connect` is correctly offered as unavailable with its reason (`SCS-092.d`) |
| **Live marketplace verification** | 🔴 **REMAINS** — out of this task's scope and untouched |

**Why it was registered rather than fixed at the time.** ✅ **These were implementation absences with canonical answers already in place** — the distinction `DOC-080` rests on.

✅ **THE ONE OPEN BUSINESS QUESTION IS NOW CLOSED.** ⚠ **Implementation found that `INV-16.7` required a Market but ratified no value set, so the field first shipped as required free text — reported rather than decided.** ✅ **The set was ratified 2026-08-15** (`INV-16.7.a`–`INV-16.7.d`): **closed, ERP-supplied, current sole member `BANGLADESH` labelled *Bangladesh*.** **The implementation was corrected to a server-supplied selector with application and database validation** (`V12`). 🔴 **NO BUSINESS QUESTION REMAINS OPEN FOR THIS FEATURE.**

**The Channel Type question is CLOSED.** ✅ **`SCS-092` was resolved 2026-08-15 by refining `E-015`** (`INV-15.3`–`INV-15.5`): **`Shopify` and `WooCommerce` are recognised Channel Types, free text remains forbidden, and no Provider or Platform entity was created.** ⚠ **NO BUSINESS DECISION REMAINS OPEN FOR THIS FEATURE.** 🔴 **Model validity is not implementation: no Shopify, WooCommerce, Website or Daraz ADAPTER exists, and each remains an integration gap.**

**`V14` local verification, 2026-08-17 — PostgreSQL 18.6.** ✅ **Flyway applied `V1`–`V14` with ZERO failures against a real PostgreSQL 18.6 test database**, and the resulting schema was inspected directly: both tables, every column type and nullability, all four `channel_credential` CHECKs, the 32-byte state-hash CHECK, the window and consumed CHECKs, the UNIQUE state hash, and ✅ **all three foreign keys confirmed `NO ACTION` — no cascade.** ✅ **Indexes are the primary keys and the one UNIQUE only; no speculative index shipped.** ✅ **Both tables start EMPTY — the migration seeds nothing.**

✅ **THE FULL BACKEND SUITE PASSES: 390 tests, 0 failures, 0 errors, 0 skipped**, and `mvn package` succeeds without `-DskipTests`. **Proven against the real database rather than argued: cross-shop ciphertext substitution, `ACCESS`↔`REFRESH` column substitution and a rewritten `encryption_key_version` all FAIL authentication; rotation re-encrypts BOTH secrets and moves the row to the new key version; the database refuses a refresh expiry with no refresh token; disconnect deletes only the credential; and of eight concurrent callbacks consuming one state, EXACTLY ONE succeeds.** ⚠ **The schema tripwire in `ApplicationFoundationSmokeTest` caught the two new tables on its first run and the authorised list was extended deliberately — which is what that test exists to force.**

✅ **The application also starts normally with NO encryption key configured** (health `UP`, zero errors), confirming `DEP-123.e`: an environment with nothing to protect is not made unstartable, while USING the feature unconfigured still fails loudly. 🔴 **Nothing was applied to production, which remains on `V13`.**

**What remains.** 🔴 **THE INTEGRATION-OWNED PROVIDER PROTOCOL WORK ONLY, AND IT IS NOW THE READ SIDE** — **a production `ChannelAdapterPort` implementation for Daraz listings: the listing/product read that `FRAME 18`–`FRAME 20` and the first live pull depend on** (`LSC-051`, `LSC-052`). ⚠ **THE AUTHORISATION SIDE IS NO LONGER AMONG THEM** — the authorisation adapter and its OAuth client shipped and are verified in production; see below. ✅ **The credential store is no longer among them: `V14` shipped it on 2026-08-16** (`TEC-119`, `TEC-120`). ✅ **THE CONNECTION HALF IS VERIFIED CLOSED, 2026-08-17.** **Shipped and confirmed in production: the Daraz authorisation adapter · the OAuth client · the callback route · provider request signing · the official Daraz endpoints · production App Key and App Secret · live seller authorisation · the seller identity read.** ✅ **`ChannelAuthorisationPort` was split into `initiate` and `complete` as `API-069.a` required; the synchronous-`authorise(UUID)` defect noted below is DISCHARGED.** **One real Bangladesh seller is bound, its credential encrypted at rest under key version 1, and the shop `CONNECTED`.** 🔴 **STILL OPEN AND NOT STARTED: the listing/product read · the first live pull** — **and the Listings `ChannelAdapterPort` they need still has no `src/main` implementation** (`LSC-052`). ✅ **THE PROTOCOL FOR THAT READ IS NOW RECORDED: `DARAZ_PROVIDER_CONTRACT.md` §9, `DZC-020`–`DZC-030` — `/products/get`, `/product/item/get`, the full `ReportedListingSnapshot` mapping, discovery scope and the refresh contract.** ✅ **AND THE READ HALF IS NOW BUILT, 2026-08-18: signed POST transport, on-demand token refresh, and `DarazChannelAdapter` implementing `declareCapability` and `discoverActive` over `/products/get`** (`LSC-052`). 🔴 **BUILT IS NOT RUN. No listing has been read from Daraz — the adapter is proven against a controlled double, the bean registers only where credentials are configured, and nothing has been deployed.** ⚠ **`readListing` and the entire outbound half still refuse, so the first live pull REMAINS NOT STARTED.** ✅ **RESOLVED — `ChannelAuthorisationPort` now exposes `initiate` and `complete`, as `API-069.a` ratifies. The former synchronous `authorise(UUID)` defect no longer exists.** ⚠ **Live marketplace verification remains out of scope and untouched.** ✅ **Everything else in this gap shipped.** ⚠ **`GAP-132`'s deferrals are unchanged, and `SCS-080`'s remaining deferrals — visible pagination, per-row menus, Suspend/Reactivate/Archive controls, Listing counts, per-field adapter capability — are unchanged and were not built.**

---

## GAP-134 — registered and RESOLVED 2026-08-18

**Category:** Connected Listings · **Severity:** 🟠 High · **Class:** **A — implementation contradicted ratified architecture**
**Source:** post-first-pull audit of the 2026-08-18 production discovery run against `PRD-186`

**Problem.** 🔴 **`discover()` RECORDED NO PER-LISTING OPERATION, AND `PRD-186.a` REQUIRES ONE.** The rule reads *"ONE OPERATION RECORD PER LISTING PER REQUESTED REMOTE ACT"* and names **`discover`** among the five kinds; `PRD-189.d` repeats it — a sync run *"records per-listing results."* **The first live Daraz pull recorded 9 listings, 9 SKUs, 85 attributes, 1 batch and ZERO operations.**

⚠ **The batch alone is an aggregate, which is exactly what `PRD-186.b` forbids:** per-listing results are retained individually and never collapsed. **Code was the defect, not the canon** (`DOC-003`).

**What it also caused.**

| Consequence | Mechanism |
|---|---|
| **Discovery activity carried a NULL `batch_id`** | the batch link is attached only where an operation settles |
| **`FRAME 20`'s per-listing result had no source** | its "Channel read" table and outcome tallies read operation records |
| **"Which run reported this?" was unanswerable** | nothing tied an observation to the run that produced it |

**Resolution.** ✅ **Fixed in application code on 2026-08-18. NO MIGRATION — `channel_listing_operation` already held every required column.** Each listing a run processes now opens a `DISCOVER` / `INBOUND` operation carrying the requesting actor and time, settles it `SUCCEEDED` with a **count-only** detail and the adapter's channel type as provenance, and links it to the batch; the channel event the read produces now names both.

✅ **AND THE HISTORY NOW CARRIES DISCOVERY ITSELF.** ⚠ **The first fix recorded the operation but wrote no `OPERATION`-kind ACTIVITY entry, so `FRAME 21` still showed a Listing that had simply appeared, with no trace of the run that found it — while `PRD-186.f` lists DISCOVERY among the events the history must be able to carry.** **Each per-listing discover operation now also writes an `OPERATION` entry, built by the same helper the refresh and push paths already used, so the three inbound and outbound acts share one definition rather than drifting apart.**

> 🔴 **THE TWO KINDS ANSWER DIFFERENT QUESTIONS AND ARE NEVER MERGED** (`PRD-186.e`). **The `OPERATION` entry names the REQUESTING OPERATOR — a person asked for this act. The `CHANNEL_EVENT` beside it keeps its NULL actor because the MARKETPLACE acted.** ✅ **Both survive one run; neither replaces the other.** ⚠ **The summary is built from the operation's own kind, outcome and count-only detail, so no title, identifier, SKU, price or stock figure reaches it.**

⚠ **Refresh needed no change** — it already routed through the shared settle path and has always written its `OPERATION` entry.

> 🔴 **THE ATTEMPT IS NOT THE STANDING POSITION, AND THIS FIX DELIBERATELY DID NOT DECIDE ONE.** **`INV-107.4` keeps an operation's outcome and a Listing's sync state DIFFERENT FACTS.** The shared `settle(…)` path also writes `sync_state` and `last_sync_at`, so discovery deliberately does **not** use it: it calls the operation entity's own settle. ⚠ **`sync_state` remains `PENDING` and `last_sync_at` remains unset for a discovered Listing, exactly as before this fix.**

**Still open — a business question, not an implementation one.**

> **What sync state a successfully read, still-`UNMAPPED` Listing carries is NOT RATIFIED.** ⚠ **`PRD-181` decides divergence by comparing intent against reported, and an `UNMAPPED` Listing has NO intent to compare** (`PRD-178`). **Neither `SYNCED` nor `DIVERGED` is stated to apply, and `PENDING` is a default rather than a decision.** 🔴 **Owner: `PRD-186` / `INV-107`. Not decided here.**

**Registered alongside, not resolved here.** ⚠ **`GAP-133`'s read-side lines are now STALE** — they still read *"STILL OPEN AND NOT STARTED: the listing/product read · the first live pull"*, *"BUILT IS NOT RUN. No listing has been read from Daraz"* and *"Live marketplace verification remains out of scope and untouched."* **All three were falsified by the 2026-08-18 production pull.** 🔴 **Correcting them is a status reconciliation of `GAP-133`, not a consequence of this fix, and was deliberately not performed here.**

**Verification.** ✅ **`ListingDiscoveryTest` — 17 tests, the first coverage `discover()` has ever had.** ⚠ **The defect shipped because nothing tested the method at all:** the adapter's `discoverActive` was tested, the service method that consumes it was not. **Backend suite 605/605.**

---

## GAP-135 — registered 2026-08-20

**Category:** Connected Listings · **Severity:** 🟡 Medium · **Class:** **B — ratified architecture changed by business decision, implementation follows**
**Source:** product-owner decision on the operator-facing listing model, recorded as `PRD-204`

**Decision.** 🔴 **THE OPERATOR EDITS THE MARKETPLACE LISTING.** **The intended-versus-reported pair
is RETAINED AS PERSISTENCE — it is what makes a push verifiable (`PRD-186`) and what tells a
marketplace edit from an unsent local one — but it is withdrawn as the operator's vocabulary and
flow.** ⚠ ***Accept Marketplace* was the only way to fill an empty edit form, so ordinary editing
was routed through a divergence workflow.**

**What this closes.** ✅ **The empty-form problem recorded at `LSC-055`**: `FRAME 10` seeds from the
marketplace current values, so the blank-form case becomes the exception. 🔴 **Seeding is NOT
writing — `PRD-181.a` is untouched and opening a page persists nothing.**

**What remains open, and is NOT decided by this.**

| Item | State |
|---|---|
| **Outbound write protocol** | 🔴 **Documented for products (`DZC` §9/§10 read + review), NOT implemented.** `pushUpdate` refuses; Daraz declares no listing field writable, so every field is LOCAL-ONLY |
| **`GAP-134` sync state** | 🔴 **OPEN** — unchanged by this decision |
| **`name_en` → title** | 🔴 **OPEN** (`DZC-026` / `PRD-202`) |
| **`price` / `special_price` semantics** | 🔴 **OPEN** (`PRD-199`) |
| **Storage model** | ⚠ **UNCHANGED.** Changing the STORAGE would be a separate amendment; `PRD-204.i` says so explicitly |

**Implementation state.** ⚠ **Documentation recorded first, deliberately** — `FRAME 06` / `FRAME 10`
rebuild follows. 🔴 **No stored fact is deleted or reinterpreted, and no live Daraz call, Sync Now or
deployment is part of this decision.**


---

## GAP-136 — registered 2026-08-21

**Category:** Connected Listings · **Severity:** 🟡 Medium · **Class:** **C — third-party protocol documented; implementation blocked on named unknowns**
**Source:** Gate 4 documentation research against the official Daraz reference, recorded as `DZC-033`–`DZC-040`

**What changed.** ✅ **THE DARAZ WRITE PROTOCOL IS NO LONGER UNDOCUMENTED.** **Seven published write
paths are recorded with their body parameter, payload shape, response envelope and error table.**
🔴 **NOTHING WAS IMPLEMENTED AND NO SELLER API WAS CALLED.** ⚠ **`pushUpdate` still refuses and Daraz
still declares no listing field writable, so `PRD-204.g` and `LSC-061` remain accurate as written.**

**What this unblocks.** ✅ **A first push slice can now be PROPOSED on evidence rather than guessed:**
**`/product/price_quantity/update` restricted to price and stock** (`DZC-040`) — **addressable by the
`SellerSku` and `ItemId` Trioloo already holds, readable back so a push is verifiable, and free of
the whole-object hazard that makes `/product/update` unsafe.**

**What it does NOT decide.**

| Item | State |
|---|---|
| **Whether Trioloo pushes at all** | 🔴 **UNDECIDED — a business decision, not a protocol one** |
| **`PRD-199` price/`special_price`** | ✅ **CORROBORATED by `<Price>`/`<SalePrice>`, RATIFIED unchanged** |
| **`DZC-026` `name_en`** | ✅ **CORROBORATED — `name_en` does not appear in the write payload at all; rule unchanged** |
| **`GAP-134` sync state** | 🔴 **OPEN — untouched** |
| **Batch transformation operators** | 🔴 **UNRATIFIED — `PRD-187` untouched** |
| **Capturing Daraz `SkuId`** | ⚠ **A separate READ change; deactivate and remove are blocked on it, not on the write protocol** |

**Blocked on the provider, not on us.** 🔴 **Seven unknowns are gaps in Daraz's own published
documentation** (`DZC-039`) — **how `/product/update` targets an existing product, whether an omitted
attribute is preserved or cleared, whether a plain `<Quantity>` is accepted, whether the
`/image/upload` file is signed, whether `SellerSku` alone addresses a SKU, the numeric limits behind
`E204` and `901`, and the timezone of a `yyyy-MM-dd` promotion window.** ⚠ **Two of them gate even
the recommended slice and are answerable with ONE controlled call on ONE listing — which is a
separately-authorised act that has not been taken.**

**Implementation state.** ⚠ **Documentation only in Gate 4. No code, no migration, no deployment, no
seller call.** 🔴 **V15 remains unapplied in production and was not touched by this gate.**

**✅ UPDATE 2026-08-21 — PARTIALLY CLOSED.** **The controlled probe (`DZC-041`) was run once and
ACCEPTED, answering `DZC-039.b` and `DZC-039.e`** (`DZC-042`), **and the business ratified a first
writable slice of `sale_price` and `listing_stock`** (`PRD-205`), **which is now implemented.**
🔴 **THE GAP IS NOT CLOSED.** ⚠ **Five of the seven unknowns in `DZC-039` remain open — how
`/product/update` targets an existing product, whether an omitted attribute is preserved or cleared,
whether the `/image/upload` file is signed, the numeric limits behind `E204` and `901`, and the
timezone of a date-only promotion window.** 🔴 **Title, description, attributes, category, media,
orderable SKUs, publication state, deactivate and remove all remain BLOCKED**, **each by a named
reason and not by preference.** ⚠ **`GAP-134` stays open and `PRD-187` stays unratified.**


---

## GAP-137 — registered 2026-08-23

**Category:** Order Management · Marketplace Integration · **Severity:** 🟠 High · **Class:** **C — third-party protocol undocumented; implementation blocked on it**
**Source:** Daraz Order Pull requirements verification audit, 2026-08-23

**Problem.** 🔴 **THE ARCHITECTURE RATIFIES THAT ORDERS ARRIVE FROM DARAZ THROUGH THE API, AND NO DARAZ ORDER API IS DOCUMENTED ANYWHERE IN THE CORPUS.**

**`OM §4.3` routes `Daraz Shop A` and `Daraz Shop B` through a Channel Adapter into the canonical order; `OM §7.8` states that marketplace orders arrive through the Daraz API and land in `PENDING_VERIFICATION`; `EVT-002 Order.Imported` names the Channel Adapter as its source.** ⚠ **[`DARAZ_PROVIDER_CONTRACT.md`](DARAZ_PROVIDER_CONTRACT.md) covers service addresses, OAuth, tokens, signing, seller identity, the response envelope, `§9` listing read, `§10` product review and `§11` listing write — and NO Order API at all.**

✅ **THE DOCUMENT ITSELF ALREADY NOTICED THE OMISSION.** **`DZC-032` records, while ruling out other Seller Centre metrics, that *"order counts are derivable from the Order API only, and that is a different fact."*** 🔴 **That Order API was never documented, and no gap recorded its absence until now.**

**What is NOT in question, so the gap stays scoped.** ✅ **Four requirements are already fully ratified and this gap does not reopen them:** **API-based ingestion** (`OM §4.3`, `OM §7.8`, `EVT-002`, `BR-005`) · **inbound-first, mirror-then-owner** (`OM §3.5`, `BR-168`, `INV-31.8`) · **idempotency** (`SYS-045`, `API-024`, `EVA-016`, `OM §4.3`) · **no product, inventory or settlement side effect on import** (`EVT-002` data-affected list, `BR-096` reserve-at-confirmation, `OM §18.3` coupling matrix, `BR-004`).

**What the gap blocks.**

| Blocked | Why it cannot be guessed |
|---|---|
| **Order list / search endpoint** — path, method, required and optional parameters | A wrong path fails loudly; a wrong PARAMETER SEMANTIC silently pulls the wrong window |
| **Date/time window rules** | ⚠ **The review API taught this exact lesson** — `DZC-032` found 90-day retention and a 7-day maximum window that made a naive request impossible. **An order window may carry its own limits** |
| **Pagination — offset, cursor, page size, maximum** | Determines whether a backfill is one job or thousands of calls |
| **Status filter values and sort rules** | Determines whether an incremental poll can be expressed at all |
| **Retention limit, if published** | 🔴 **Decides whether a 3-month backfill is even POSSIBLE** |
| **Order detail and item endpoints — identifier, envelope, field lists** | The mapping surface for `E-031` and `E-032` |
| **Error codes for polling and backfill; throttling signals** | `DZC-038.e` already establishes that a throttle is not a refusal; the order-side codes are unread |

**What was attempted, and why it did not close.** ⚠ **RECORDED RATHER THAN HIDDEN, exactly as `LSC-002` recorded an MCP read cap and `DZC §8` records what the provider does not publish.**

> **Every official surface was requested on 2026-08-23 and every one returned a JavaScript shell with no documentation content:** `open.lazada.com/apps/doc/api?path=/orders/get` · `…?path=/orders/items/get` · `…?path=/order/get` · `open.lazada.com/apps/doc/doc?nodeId=10543&docId=108139` (the legacy-to-REST mapping) · `open.daraz.com/doc/api.htm` · `open.daraz.com/doc/doc.htm`. **`developer.alibaba.com` refused the connection.**
>
> 🔴 **UNREADABLE IS NOT UNPUBLISHED, AND THE TWO ARE NEVER MERGED** (`DZC §8`). **Daraz almost certainly publishes this protocol; this session could not render it.**
>
> 🔴 **NOTHING WAS WRITTEN FROM MEMORY.** ⚠ **A protocol section reconstructed from recollection would look compliant, contradict nothing visible, and diverge permanently from what the provider actually publishes** — **the precise failure `DOC-030` exists to prevent.** ✅ **`§9` and `§11` were each written from a rendered official reference before any code; this gap holds Orders to the same standard.**

**The one fact the official surfaces did yield.** ⚠ **The official reference's OWN documentation routing exposes three order paths — `/orders/get`, `/orders/items/get` and `/order/get`.** 🔴 **THIS IS EVIDENCE OF EXISTENCE ONLY.** **No method, parameter, window rule, page size, status value, field or error code is established by it, and none may be inferred from the path name.** ⚠ **NOT PUBLISHED — DO NOT MAP applies to every other aspect.**

**A second unverified link, recorded so it is not assumed.** ⚠ **`§9` could assert Daraz↔platform path equivalence for products because a DARAZ-PUBLISHED migration guide maps `GetProducts` to `/products/get`.** 🔴 **No equivalent mapping was readable for orders**, so **whether the Daraz Bangladesh venture exposes these same order paths is UNVERIFIED** and must be confirmed from a Daraz-published source before implementation.

**Business questions this gap does NOT decide.** 🔴 **Each is recorded and left to its owner** (`DOC-024`, `CLAUDE.md` §5).

| Question | State |
|---|---|
| **Whether one job fans out over all connected Daraz shops** | 🔴 **UNDECIDED.** `API-071.a`/`.d` require every pull to be scoped to ONE explicit channel instance and forbid an ambient current-shop context; ⚠ **`PRD-189.b` ratifies the OPPOSITE for Listings sync — one channel per manual run** |
| **Whether the initial backfill is exactly 3 months, or whatever the API permits** | 🔴 **UNDECIDED and currently unanswerable** — the retention limit is unread |
| **Whether the scheduler cadence is 5 minutes or another value** | 🔴 **UNDECIDED.** `BD-018` records ~5 minutes as LEGACY behaviour and `OM §7.8` restates it as arrival LATENCY carrying no rule number; 🔴 **`API-071.d` explicitly defers polling frequency, schedulers, cursors, webhooks, batching, checkpoints and retry to later contracts, and NO SCHEDULER EXISTS anywhere** (`LSC-054.d`) |
| **Whether Daraz notifications participate** | 🔴 **UNDECIDED — `BD-159` is UNANSWERED**: *"Does the notification trigger anything on its own, or is the 5-minute import the only way orders actually arrive?"* |
| **Retry behaviour after a failed import** | 🔴 **UNDECIDED — `BD-158` is UNANSWERED**: what happens if the automatic import fails or Daraz cannot be reached |

**What resolution requires.** ✅ **The `§9` and `§11` procedure, unchanged:** **render the official Daraz Order API reference, record paths, parameters, window rules, pagination, status values, retention, field lists, error codes and throttling as `DZC §12` BEFORE any adapter code**, **and confirm the Daraz-side path mapping from a Daraz-published source.** ⚠ **Then, and only then, the backfill window and cadence become a business decision taken on evidence rather than on recollection** — the sequence `GAP-136` describes as letting a first slice be *"PROPOSED on evidence rather than guessed."*

**Status.** 🔴 **OPEN — NOT ADDRESSED.** ⚠ **No protocol documentation was produced, so no part of this gap is discharged.** **`DARAZ_PROVIDER_CONTRACT.md` is UNCHANGED at v1.10.0 and gains no `§12`.**


---

# Legacy Laravel ERP — scope decision, 2026-08-10

**Business decision recorded at the opening of the Technology Architecture stage.**

> **The legacy Laravel ERP is OUTSIDE the current architecture and implementation scope.** **The Java ERP is designed and built as the canonical new system.**

**Explicitly out of the V1 roadmap:** Laravel-to-Java migration · coexistence with the Laravel ERP · cutover · legacy data import · compatibility layers · migration tooling · any constraint on the Java architecture derived from the Laravel database or schema.

> 🔴 **The Java ERP is designed cleanly from the canonical business/domain architecture, NOT from the structure of the old system.**

## Disposition

| Item | Status |
|---|---|
| **`GAP-070`** | ⬜ **OUT OF V1 SCOPE.** ⚠ **Reclassified, not closed** — the business has not said migration will never happen, only that it is not this project |
| **`SYS-083`** | ⚠ **Unchanged as a rule.** Its migration concern is simply not in V1 scope |
| **`BD-007`** and its unanswered follow-ups (`BD-137` onward) | ⬜ **Not reopened.** They belong to the future migration project if one is ever commissioned |

## ✅ What this changes for the architecture

**1. 🔴 The corpus's only 🔴 Critical open item leaves the V1 roadmap.** **`GAP-070` was classified `B — pre-implementation dependency` and described as *“an entire unwritten workstream, not a gap”*.** ✅ **V1 now has no Critical open item.**

**2. ✅ The persistence model is freed.** ⚠ **A migration requirement would have pulled the schema toward the legacy shape.** **With it out of scope, the data model derives purely from `DOMAIN_MODEL.md`** — **which matters because `DB-001`/`ACC-001` forbid stored balances and `DB-002`/`DB-003` require append-only history.** **Those are far easier to honour in a clean schema than in one shaped by an existing relational design.**

**3. ⚠ Opening balances remain a separate question.** **`GAP-109` opening balances is NOT the same item as `GAP-070`.** **A system with no migration still needs a defined starting position for inventory, accounting and employee balances on day one.** ✅ **Left registered and untouched; it is a business question, not a migration one.**


---

# Final Pre-Freeze Triage — 2026-08-09

**Every surviving unresolved item, classified against one test:** *could a competent Java implementation team build the V1 architecture without making an unauthorised business or architecture decision?* **If no — freeze blocker.**

> **Classification is not closure.** Nothing below is closed by being classified. **Four items are freeze blockers**, and each names the specific decision an implementer would otherwise be forced to invent.

## A · FREEZE BLOCKERS — 4

**The line drawn:** an item is a **freeze blocker** when it sits on the **core transactional spine** — order → confirm → fulfil → deliver → collect → post — which **every other module depends on**, and no ratified rule answers it. **A gap that blocks one peripheral feature is `B`, not `A`**, because that feature can be sequenced later behind an explicit boundary. **These four cannot be sequenced around: they are reached on the first order.**

| # | Item | Owner | The decision an implementer would be forced to invent | Discovery? | Reconciliation alone? |
|---|---|---|---|---|---|
| ~~**A1**~~ ✅ **RESOLVED 2026-08-09 — `BD-435`** | ~~`GAP-015` — price determination is undocumented~~ **Price source follows the order source**: Daraz and Website orders **arrive priced**; manual orders are **priced by staff** with an **advisory** cost + 25% recommendation. **Three blockers remain — A2, A3, A4** | Product / Order Management | **Where does a price come from?** `OM §7.9` grants authority to change price *within discount limit* and `PRM-008` bounds the discount — **both presuppose a base price that no document defines.** No price list, no channel pricing, no marketplace synchronisation, no propagation to open orders. **Every one of the 15 sales channels needs this on its first order** | 🔴 **YES** | ❌ No |
| ~~**A2**~~ ✅ **RESOLVED 2026-08-09 — `BD-436`, `BD-437`** | ~~`GAP-018` — `ON_HOLD` has no entry or exit rules~~ **`ON_HOLD` is reservation-neutral** — a held order is **active**, and reservations change through the **act underneath the hold**, never the transition. **Two blockers remain — A3, A4** | Order Management | **Does placing a hold release the inventory reservation?** `SM-1` carries `ON_HOLD` with transitions from three states and `§6.2` names the exit owner — **but who may hold, for what reason, for how long, and what happens to reserved stock are all unstated.** The reservation question is **materially financial** and `IVN-014` reserves at confirmation, so the implementer must answer it to build `SM-1` at all | 🔴 **YES** | ❌ No |
| ~~**A3**~~ ✅ **RESOLVED 2026-08-09 — `BD-438` – `BD-440`** | ~~`GAP-019` residual and `SMU-10`~~ **The marker was resolvable from ratified discovery** (`SMA-079`), and **Courier Remittance was proven to need no machine** (`SMA-080`) — its condition derives from its lines, because **closure records and never decides**. **One blocker remains — A4** | Delivery / Accounting | **How is COD cash reconciled against the courier?** Release was settled manual (`BR-081`) and `LOST` external (`DLV-027`), but **closure, reconciliation and RTO creation remain unstated**, and `BR-036`'s remittance ageing runs with **no lifecycle to age against**. **At ~100% COD this is not a peripheral flow — it is how the business gets paid** | 🔴 **YES** | ❌ No |
| ~~**A4**~~ ✅ **RESOLVED — `BD-441`** | ~~`GAP-016` — the backorder flow is unmodelled~~ **There is no backorder flow. Stock shortage never blocks, holds or cancels an Order; negative stock is supported. ALL FOUR BLOCKERS CLEARED** | Order Management / Inventory | **What happens when an order is confirmed and stock is insufficient?** `BD-100` confirms **backorder is real practice**, and `BD-280`/`BD-285` supply the quantity model that makes it *expressible* — **but no rule states the flow.** The implementer either invents it or silently omits it, **and no ratified rule excludes backorder from V1** | 🔴 **YES** | ❌ No |

> ⚠ **A1 – A4 share a shape**: each is a **question the business can answer in minutes and no document can answer at all.** **None is resolvable by reconciliation**, and **none may be resolved by an implementation choosing in code** — `SMA-016` and `EVA-018` forbid exactly that for A3's `UNDECIDED` marker.

## B · MUST RESOLVE PRE-IMPLEMENTATION — blocks a specific area, not the spine

| Item | Owner | Unsafe to implement | Discovery? |
|---|---|---|---|
| **`GAP-070` — migration is undocumented** 🔴 **Critical** | System | **Cutover, parallel running, legacy reconciliation** (`SYS-083`). An existing Laravel ERP holds live data (`BD-007`). **This is not a gap in the architecture — it is an entire unwritten workstream.** V1 can be *built* without it; it **cannot go live** | 🔴 YES |
| **`GAP-080` / `SMU-18` — supplier settlement machines** | Return & Exchange | Supplier claim settlement. ⚠ **A referral loop**: `SMA-032` deferred to Return & Exchange, `RET §2.2` referred it back. **Nobody owns the decision** | ❌ Architecture decision |
| **`GAP-103` — no teardown operation** | Inventory / Warehouse | **Trade-In component recovery.** `SM-19` allocates components; **no operation converts a traded unit into them** | 🔴 YES |
| **`GAP-104` — salvage SKU structure** | Product / Inventory | **Used-component stock.** A recovered component must not enter the same SKU as new; **the structure is undecided** | 🔴 YES |
| **`EVU-15` — stock creation from allocated Trade-In components** | Inventory | The **inbound half** of the same path. Recorded as **accepted absence**, not oversight | 🔴 YES |
| **Warranty-originated refund vs `PAY-049`** | Payment / Warranty | **Refund as a warranty outcome.** `WAR` names the outcome; **`PAY-049`'s refund model was written for returns** | 🔴 YES |
| **Chargeable repair collection** | Payment / Warranty | **Taking money for an out-of-warranty repair.** `BR-101` settles who bears the cost; **no mechanism collects it** | 🔴 YES |
| **Warranty accounting postings** | Accounting | **Recovery arrival, replacement cost, handback courier cost** — no postings ratified | 🔴 YES |
| **Trade-In credit reversal on return** | Payment / Return | **A returned order whose payment included Trade-In credit.** `EVU-16` settled application; **reversal is untouched** | 🔴 YES |
| **`GAP-081` / `GAP-084` residual — marketplace fee and claim classification** | Accounting | **Reported profitability per marketplace order.** Affects **7 of 15 channels** | 🔴 YES |
| **`GAP-089` — current configuration: computed or maintained?** | Product | Build configuration display and history | ❌ Architecture decision |
| **`GAP-085`, `GAP-087`, `GAP-098`, `GAP-107`** | Cross-module | Each named in place in §E | Mixed |

## C · ACCEPTED EXPOSURE — 9 · knowingly carried

`GAP-073` · `GAP-086` · `GAP-090` · `GAP-092` · `GAP-100` · `GAP-105` · `GAP-106` · `GAP-108` · `CUS-054`. **Each was examined and the exposure accepted by ratified decision — they are not oversights and do not block.**

## D · DEFERRED / POST-V1 — 7

`GAP-083` (HR & Payroll, `DOC-061`) · `GAP-052` – `GAP-055` · `GAP-058` · `GAP-109`. **Out of V1 scope by decision, and registered as such.**

## E · NON-BLOCKING OPEN — the largest group

**Business-architecture (10 remaining after A):** `GAP-020`, `GAP-023`, `GAP-025`, `GAP-059`, `GAP-060`, `GAP-062`, `GAP-065`, `GAP-066`, `GAP-072`, `GAP-079`, `GAP-088`, `GAP-093`.
**Cross-module:** `GAP-102`, `GAP-110`, `GAP-091`, `GAP-094`, `GAP-095`.
**UI / documentation (13):** `GAP-029`, `GAP-030`, `GAP-033`, `GAP-036` – `GAP-044`, `GAP-049`, `GAP-050`, `GAP-067`. **UI is not architecture** — these never blocked a freeze.
**`SMU-1` – `SMU-7`, `SMU-12`; `EVU-1` – `EVU-12`.** ✅ **Every one maps to a GAP already classified above** — they are views of the same items from the machine and event registers, **not additional unresolved matter.**

## F · DOCUMENTATION / RECONCILIATION DEFECTS — found and corrected this pass

| Defect | Correction |
|---|---|
| **`SMU-13` showed open** — *Warranty Claim machine, a third inbound flow with no lifecycle* | ✅ **Closed.** `SMA §21.1`'s own heading records that `SM-13` closes `SMA-018`, `SMU-13` and `BD-244`. **The document had closed it and the register never said so** |
| **`SMU-16` showed open** — *states remain unspecified by ratified decision* | ✅ **Closed.** `SMA §21.2` records that `SM-15` closes `GAP-075` and `SMU-16` — thirteen stages from `BD-333` |
| **`SMU-18` did not name its loop** | ✅ Now cites **`GAP-080`**; **still open**, and re-classified above as `B` |
| **`PRODUCT_ARCHITECTURE.md` Appendix A** — items **3, 4, 5, 6, 9** unmarked under a footer declaring the content *specification-ahead-of-ratification and not to be treated as settled* | ✅ **All five verified satisfied and marked; the footer was false and is corrected.** **5** by **`INV-32.1`** — *a catalogued line references a Sellable Product, never a Product Variant directly*; **6** by `SM-12`'s `COMPONENTS_RESERVED` with `IVN-014`, `EVT-039`, `BR-143` |
| **The `EVU` register had split into three tables** | ✅ Repaired — two stray blank lines |

> **`GAP-111` registered** — **`OM §4.5` and `§14` were never amended to the three-layer Product model.** Their substance is ratified elsewhere (`INV-32.1`, `SM-12`), so **nothing is unbuildable** — but **two documents describe the same thing at different vintages**, and `OM`'s is the vaguer. **Documentation alignment, not an open architecture question.**

## What this triage did **not** find

**No new contradiction between ratified rules.** Amendment registers, `TODO` markers and specification-ahead-of-ratification footers were swept across the whole set; **`PRODUCT_ARCHITECTURE.md`'s Appendix A was the only such register, and it is now clean.**

## Verdict

✅ **ALL FREEZE BLOCKERS CLEARED — 2026-08-09. ARCHITECTURE FROZEN, baseline `FREEZE-V1-2026-08-09`.**

> **`GAP-116` was raised by the Final Freeze Gate as a fifth blocker and closed by `BD-442`.**

> **A1 `BD-435` price determination · A2 `BD-436`/`BD-437` `ON_HOLD` and reservation · A3 `BD-438` – `BD-440` COD remittance · A4 `BD-441` stock shortage.** **Seven business answers, and not one invented rule.**
>
> ⚠ **This clears the blockers; it does not itself declare Architecture Freeze**, which is a separate act and has not been performed. **Categories `B` – `F` are unaffected** — **`GAP-070` migration** and the other **must-resolve-pre-implementation** items still stand, and **`GAP-111` – `GAP-116` were registered during the blocker work.**

> **The architecture itself is sound.** 102 events across 16 domains, 20 state machines with **every event position settled**, 281 of 281 discovery answers, and **no invented rule anywhere in the set**. **What blocks the freeze is not structural** — it is **four questions only the business can answer**, each of which an implementer would otherwise answer for it: **where a price comes from, what a hold does to reserved stock, how COD cash is reconciled against the courier, and what happens when stock is short.**
>
> **All four are reached on the first order.** **None can be resolved by reconciliation, and none may be resolved in code.**
