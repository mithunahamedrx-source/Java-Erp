# Inventory Costing Architecture

**Owner:** Trioloo Technology · **Module:** Inventory · **Status:** Canonical
**Version:** 1.3.0 · **Ratified:** 2026-08-08 · **Rule prefix:** `ICO-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §17 Warehouse & Assembly, §18 Purchase & Supplier, §19 Accounting, §21 Warranty, §22 Return & Exchange, §26 Trade-In (`BD-388` – `BD-397`), with the reconciliation at [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) §29 – §32, [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §9.9, §9.10, [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §23, and [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) v3.7.0.

**References, never duplicated:** [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) `DB-001`, `DB-003`, `DB-077` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-022` – `ACC-025` · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) `SM-11`, `SM-12`, `SM-15`, `SM-18`, `SM-19` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md).

## ⚠ Ownership boundaries

> **ICO-000 — This document owns *what an inventory item cost and how that figure is derived*. It owns nothing about quantity, location, posting, or product definition.**

| | Owns | Does not own |
|---|---|---|
| **`INVENTORY_COSTING_ARCHITECTURE.md`** — `ICO-` | **Cost derivation · valuation method · acquisition cost by source · allocation boundaries · cost immutability · cost history** | Quantity, movement execution, posting |
| `INVENTORY_ARCHITECTURE.md` ✅ | **Stock quantity · commitment stages · serial records and unit history · the movement ledger · loss attribution** | **Valuation** — carved out here (`DOC-057`) |
| `ACCOUNTING_ARCHITECTURE.md` | **The posting model** — what a cost movement posts and to which account | The cost figure itself |
| `PRODUCT_ARCHITECTURE.md` | Product definition, BOM, serialization policy, **`PRD-121` – `PRD-124`** | — |
| `WAREHOUSE_ARCHITECTURE.md` ✅ | Goods receipt, QC execution, physical counts | Cost consequences of any of them |

**`PRD-121` – `PRD-124` remain ratified in `PRODUCT_ARCHITECTURE.md` and are referenced here, never restated.** `DOC-005` is satisfied: **this document answers *what did it cost*; those documents answer *what is it* and *what does it post*.**

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine or costing method is introduced. **No gap is resolved by assumption** — see §8 and §12.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Costing Philosophy

## 1.1 One method, and only one

> **ICO-001 — Weighted Average Cost is the only inventory costing method in the ERP** (`PRD-122`, `ACC-023`, closing `GAP-005`).

**`PRD §11.8` was settled against specific identification.** There is no FIFO, no LIFO, no lot costing and no per-unit cost tracking, **even where serials are recorded** — because `BD-298` established that weighted-average costing needs no serials at all.

**This is the second time the serial-optional decision proved more coherent than it first appeared**, the first being warranty eligibility (`PRD-134`).

## 1.2 Cost is derived from movements

> **ICO-002 — Inventory value is derived from cost movements and is never stored as a maintained figure** (`DB-001`).

**A stored valuation is a second copy of a figure that already exists**, and `CP-12` exists to prevent exactly that. The weighted average at any moment is **a computation over the acquisition movements that produced the current holding.**

## 1.3 Inventory value is never manually maintained

> **ICO-003 — No user sets an inventory value. Quantity corrections are made by stock adjustment with a reason and approval; they are never value edits** (`BD-111`, `BR-102`).

**Cost enters only through an acquisition event** (§2). It never enters through a screen.

## 1.4 Why one authoritative model

**Trioloo acquires inventory five different ways** (§2), assembles it into custom units, tears units down again, repairs them, and returns some to stock after inspection. **A per-source costing method would produce five figures for one warehouse** — and `CP-12` Single Source of Truth exists precisely to prevent a figure that could disagree with another.

> **One method, applied to every source, is what makes the warehouse's value a single answerable question.**

---

# 2. Inventory Acquisition Sources

> **ICO-004 — Every inventory item enters through one of five confirmed acquisition sources, and each supplies its cost basis at entry.**

| Source | Cost basis | Established |
|---|---|---|
| **Purchase** | **Supplier invoice price** | `PRD-121`, `BD-297` |
| **Trade-In acceptance** | **Allocated share of the agreed trade-in value** | `BD-390`, `BD-391` |
| **Return, after QC disposition `Sellable`** | **Its original cost basis** — no re-acquisition occurs | `BD-289`, `RET-018` |
| **Build completion** | **Sum of consumed component cost** | `SM-12`, §5 |
| **Trade-In teardown** | **Allocated share** — one unit resolving into many components | `E-082`, §4 |

**Warranty replacement is not an independent acquisition source.** A replacement component is drawn **from existing stock**, which was itself acquired through one of the five above; the warranty case consumes it (§6).

## 2.1 Ownership acquisition versus customer custody — the distinction that governs entry

> **ICO-005 — Goods physically present are not inventory until the business owns them** (`SYS-103`).

| State | Is it inventory? |
|---|---|
| Goods received on a purchase, accepted | **Yes** |
| A trade-in item **shipped before agreement** | **No — customer property** (`INV-81.1`) |
| A customer's unit **received for warranty repair** | **No — customer property** (`E-072`) |
| **Unclaimed property** after a declined trade-in | **No, and never** (`INV-81.4`) |

> **The state is: physically present, not owned, not inventory.**

**Two domains require it independently**, and `ICO-006` reinforces it from the costing side.

> **ICO-006 — An item with no acquisition cost cannot enter inventory** (`ACC-024`, `DB-001`). Customer property has none, which is why the prohibition in `SYS-103` is **structural as well as legal**: a movement with no value is not recordable.

**The prohibition is absolute because the exposure is legal rather than accounting** — taking another party's property into inventory without transfer is not an error that reverses.

---

# 3. Purchase Costing

## 3.1 Acquisition cost is the invoice price

> **ICO-007 — Product cost is the supplier invoice price. There is no landed cost allocation** (`PRD-121`, `ACC-022`, closing `GAP-046`, `PRDU-12`, `DMU-6`).

**Transport, freight, import duty and clearing are period business expenses, not capitalised into inventory.** There is **no allocation engine, no apportionment basis, and no revaluation of stock when a freight invoice arrives late.**

## 3.2 Cost enters at acceptance

> **ICO-008 — The goods receipt is the spine of the purchase flow, not the purchase order** (`BR-105`). `E-030` is mandatory and parentless-capable; `E-029` is optional.

**Cost therefore enters inventory at the receipt event, and the payable is created at acceptance** (`BR-109`, `ACC-003`) — **recognition follows the event, never the document.**

**A supplier invoice is evidence for reconciliation, never a posting source** (`BD-299`, `BR-121`).

## 3.3 Margin is knowably incomplete

> **ICO-009 — Because freight and duty are period expenses rather than capitalised cost, gross margin computed from `ICO-007` is knowably incomplete** (`PRD-123`).

**This is recorded, not corrected.** The business chose the simpler model deliberately; **the consequence is stated so that margin is never presented as fully loaded.**

---

# 4. Trade-In Costing

**Trioloo's distinctive acquisition path, and the one with the most costing structure.** `BD-388` – `BD-397` are carried in full.

## 4.1 A trade-in begins as an evaluation, not an acquisition

> **ICO-010 — The customer's product remains the customer's property until both parties accept the agreement. No inventory transaction occurs before acceptance** (`BD-388`, `INV-81.1`).

**The provisional offer is a record, not a draft** — retained alongside the final value and never overwritten by it (`INV-81.2`, `DB-003`).

## 4.2 The agreed value is the total, and it is fixed

> **ICO-011 — The agreed Trade-In value represents the total value accepted by the business, and is fixed at acceptance** (`BD-392`, `INV-81.3`).

**It anchors everything downstream** — the credit liability (`ACC-039`) and the component cost basis are **the same number seen from two directions**.

## 4.3 Recoverable value, not whole-unit value

> **ICO-012 — Trade-In valuation considers the recoverable value of the product rather than valuing it as a whole unit** (`BD-388`).

**A traded-in desktop is not one item entering stock.** It is a bundle resolving into several inventory items of different kinds, **plus some that never become inventory at all** (`E-082`).

⚠ **This requires a teardown operation the architecture does not have — `GAP-103`.**

| | Direction | Exists |
|---|---|---|
| **Build Job** (`SM-12`) | **Many components → one product** | Yes |
| **Trade-In acceptance** | **One product → many components** | **No** |

**`PRD-009` separates assembly from bundling; neither describes disassembly.** Carried, not solved.

## 4.4 Six classifications, and only some become inventory

> **ICO-013 — Every component is individually classified after acceptance** (`BD-389`, `SM-19`).

| Classification | Cost consequence |
|---|---|
| **Reusable** | Receives an allocated cost; enters inventory |
| **Repair Required** | Receives an allocated cost; enters `SM-15` before becoming saleable |
| **Refurbishable** | Receives an allocated cost; restoration work precedes sale |
| **Scrap** · **Recycle** | **Receives no inventory cost.** Not automatically saleable inventory |
| **Unknown** *(pending inspection)* | **Blocks allocation entirely** — see `ICO-016` |

> **ICO-014 — Components that do not become inventory receive no inventory cost** (`BD-390`, `INV-82.3`).

**The full agreed value is therefore borne by the components that do.** If a 20,000 machine yields one reusable part, **that part costs 20,000** — which is correct, because the business paid for recoverable value and recovers it through what it can use.

> **This makes over-valuation visible as inflated component cost rather than hiding it in an averaged pool.** Recorded as an observation, not a control.

## 4.5 Allocation records results, never methodology

> **ICO-015 — The ERP records the allocation results and does not prescribe the valuation methodology** (`BD-390`, `SYS-104`).

**The business valuation method determines the allocation process.** The ERP is a **recorder of decisions, not a calculator of them** — the most durable pattern in the discovery, and it now holds in a costing decision, **the place where a system is most tempted to impose a formula.**

> **But the sum is arithmetic, and `CP-8` enforces arithmetic.** An allocation distributing 50,000 across components when the agreed value was 45,000 is **not a different opinion — it is wrong**, and would put money into inventory that was never paid.

**The method is judgement; the total is enforced.**

## 4.6 Inventory is blocked until allocation completes

> **ICO-016 — Every component must reach a final classification before allocation is performed. A partially classified Trade-In cannot create partial inventory** (`BD-391`, `INV-82.2`).

**Three gates, in order:** `Trade-In Agreement Accepted` → **`Component Classification Completed`** → **`Cost Allocation Completed`** → inventory created (`SMA-068`).

**The alternative was rejected explicitly.** Allocating provisionally and revising would either give a later-classified component **no cost** or force **retrospective restatement** — both breaking `DB-003` and `DB-077`.

> **This makes `Unknown` expensive, which is healthy.** One unclassified component holds up an entire Trade-In, so the incentive is to resolve it. **The ERP records the inspection progress** so the blockage is visible (`SMA-073`) — the fourth instance of a hard gate paired with a visibility requirement.

## 4.7 The customer is never delayed

> **ICO-017 — Trade-In Credit is created at agreement; inventory is created at allocation. The costing delay is borne entirely by the business** (`SMA-067`).

| | Available at |
|---|---|
| **Trade-In Credit** — the customer's side | **Agreement Accepted** — immediately |
| **Inventory** — the business's side | **Cost Allocation completed** — possibly days later |

**This is why the strictness is affordable.** The customer buys their new machine and leaves; the components reach stock when the workshop finishes.

---

# 5. Custom Desktop Build Costing

## 5.1 Components are consumed; the build derives its cost

> **ICO-018 — A finished build's cost is derived from the components actually consumed** (`SM-12`, `PRD-046`, `BD-286`).

**Components are reserved at order confirmation and consumed at assembly** (`BR-052` as amended, `PRD-046`). **The consumed quantity is what costs**, not the planned BOM — which is why substitutions (`PRD-038`) change the build's cost without changing its template.

## 5.2 Labour is supported and may be zero

> **ICO-019 — Assembly labour is supported in the costing model and is optionally zero** (`BD-286`, `PRD-103` as corrected).

⚠ **This corrects an earlier reading of mine.** `BD-106` was recorded as suggesting labour *"appears excluded"* from costing. **`BD-286` established it is supported but optionally zero**, and `PRD-103` was corrected accordingly. **Carried here so the corrected reading travels with the costing model.**

## 5.3 Build history is immutable

> **ICO-020 — The As-Built Record captures what actually went into one specific unit, and is a build-time snapshot that is never updated** (`PRD-036`, `DB-003`).

**Components replaced later are recorded on the repair, never on the as-built record** (`INV-72.2`) — see §6.2.

## 5.4 Build Template versioning protects historical cost

> **ICO-021 — Editing a Build Template creates a new version and never edits the active one; a build references the version in force at its own date** (`PRD-069`, `PRD-071`, `DB-022`).

**`PRD-069`'s stated rationale is a costing rationale**: editing in place *"would silently rewrite what past units were built from, corrupting warranty attribution, support, and cost."*

---

# 6. Warranty & Repair Costing

## 6.1 A replacement component is consumed from stock

> **ICO-022 — A component fitted during repair is consumed from inventory at its weighted average cost** (`ICO-001`, `BD-290`).

**It is not a new acquisition** (`ICO-004`), and it does not alter the cost of the unit it is fitted into.

## 6.2 The original acquisition cost is never modified

> **ICO-023 — A repair records its own cost. It never modifies the acquisition cost of the unit repaired** (`DB-003`, `INV-72.2`).

**`PRD-044` was amended for exactly this reason.** After a repair, the physical unit differs from its as-built record:

| Record | Describes |
|---|---|
| `E-062` As-Built Record | **What went in at build** — correctly immutable |
| `E-072` Repair | **What was changed afterwards, and what it cost** |
| **Current configuration** | **Neither alone — the composition of both** |

⚠ **`GAP-089` — current configuration has no owner.** Whether the derived view is computed on demand or maintained is undecided. Carried.

## 6.3 Cost bearer is recorded even when nothing is charged

> **ICO-024 — Repair cost bearer is recorded whether or not the customer is charged** (`BD-290`), with four values: **Trioloo · Supplier · Manufacturer · Customer**.

**The purpose is that after-sales profitability stays visible.** `BD-336` adds **Warranty Cost Bearer** *(expected)* and **Final Cost Responsibility** *(actual)* as separate retained values — **they diverge when an upstream claim is rejected, and the difference is the information** (`INV-71.2`).

## 6.4 Warranty resolution does not restate inventory

> **ICO-025 — A claim result changes no inventory or accounting record automatically** (`BD-324`, `BR-131`). A rejected upstream claim routes to a **write-off** (`BD-110`) or **scrap** (`ICO-028`) as a **separate authorised decision**.

**The claim result is a fact; the accounting response is a decision.**

---

# 7. Return & Exchange Costing

## 7.1 QC disposition determines the cost outcome

> **ICO-026 — Returned goods take one of four QC dispositions, each with a distinct cost consequence** (`BD-289`, `RET-018`).

| Disposition | Cost consequence |
|---|---|
| **Sellable** | Re-enters stock **at its original cost basis** — no re-acquisition |
| **Repair Required** | Enters `SM-15`; repair cost recorded separately (`ICO-023`) |
| **Supplier Claim** | Routed upstream; **duration supplier-owned and unbounded** |
| **Scrap** | **Partial or full, with an accounting loss** (`ICO-028`) |

**Dispositions apply per line, not per return** (`RET-013`) — one item may be `Sellable` while another from the same return is `Scrap`.

## 7.2 Execution follows the commercial resolution

> **ICO-027 — The disposition is determined at inspection but executed only after the customer outcome is settled** (`RET-023`, `SMA-050`).

**Goods remain in QC Pending throughout**, and **QC Pending stock is present but not sellable** (`BR-104`). **Stock must not return to sellable inventory while a dispute is live**, or the same unit could be sold twice over.

## 7.3 Refund value is independent of inventory value

> **ICO-028 — A refund is recorded when money actually returns and is independent of the returned item's inventory valuation** (`DM-055`, `ACC-003`).

**The two figures answer different questions** — what the customer is owed, and what the goods are worth to the business. **A scrapped return still refunds in full if the business agreed to; a resaleable return refunds nothing if the claim was rejected.**

## 7.4 Scrap

> **ICO-029 — Scrap posts an accounting loss, partial or full** (`BD-291`, `ACC-025`).

## 7.5 Exchange inventory

**A replacement is reserved at exchange approval** (`RET-025`) and consumed at dispatch — **the same reservation pattern as an order** (`BD-278`). **The returned unit re-enters stock only through `ICO-026`.**

---

# 8. Used versus New Inventory

## 8.1 ⚠ This is an open gap, and it is carried as one

> **`GAP-104` — a salvaged component must not enter the same SKU as new stock.**

**The existing reconciliation records this as a *consequence to test*, explicitly marked *"not stated by the business and not inferred"*** (`DM-077`). **It is not a confirmed business rule, and this document does not make it one** — doing so would resolve a gap by assumption.

## 8.2 Why the concern is real

**`ICO-001` averages cost across a SKU.** `ICO-007` makes new stock cost the supplier invoice price; `ICO-014` makes a salvaged component's cost an allocated share of a trade-in value. **If both entered the same SKU, weighted average would blend salvage cost into new inventory** — and the resulting figure would describe neither.

**The exposure grows with trade-in volume**, because each teardown injects a differently-derived cost into the same pool.

## 8.3 What the architecture already provides, and what it does not

| Available today | |
|---|---|
| **Distinct SKUs** | `PRD-013` — SKUs are never reissued, and nothing prevents a *used* SKU existing alongside a new one |
| **Product Variant granularity** | `E-020`, `PRD-014` |
| **Condition recorded per component** | `E-082`'s six classifications |

**No mechanism currently separates the *valuation pools*, and none is invented here.** `GAP-104` remains the governing record, and **resolving it requires a business decision about whether used components are sold as a distinct product or blended deliberately.**

---

# 9. Cost Immutability

## 9.1 The rule

> **ICO-030 — Inventory acquisition cost is allocated once and is never retrospectively restated** (`SYS-102`, `BD-391`, `ACC-024`).

**Two independent domains reached this separately:**

| Domain | Rule |
|---|---|
| **Purchase** | **No revaluation of stock when a freight invoice arrives late** (`ICO-007`) |
| **Trade-In** | **Allocation performed once, never restated** (`ICO-016`) |

**The cross-domain check raised at `BD-391` closed in favour of consistency**, which is why `SYS-102` states it once at system level rather than twice.

## 9.2 The stated priority

> **Inventory immutability is more important than early inventory availability** (`BD-391`).

**This is a principle, not a rule about one process.** Wherever *"make it available sooner"* competes with *"keep the cost correct"*, **correctness wins** — and the business accepts the resulting delay explicitly.

## 9.3 Why correctness outranks availability

**A delayed inventory item is inconvenient and visible.** `SMA-073` makes the blockage explicit and the ERP records inspection progress, so **someone can act on it.**

**A restated cost is neither.** It changes figures that have already been reported, reconciled and closed — **silently, and after the fact.** `DB-003` exists because the alternative makes history unreliable rather than merely late.

| Rule | Contribution |
|---|---|
| **`DB-001`** | Cost is derived from movements — **so a restatement means fabricating or altering a movement** |
| **`DB-003`** | **The past does not move** |
| **`DB-077`** | **Immutability attaches at completion** — before allocation a figure may change; after it, only another record may answer it |

## 9.4 Forward-only correction

> **ICO-031 — A cost error is corrected by a new, linked movement — never by editing the original** (`DB-002`, `ACC-002`).

**The same construction used throughout the ERP**: a failed transfer posts a return leg (`ACC-030`), a return adjusts revenue forward (`ACC-016`), a bad debt posts an expense rather than reversing a sale (`ACC-017`). **In every case the model reaches forward, never backwards.**

## 9.5 Availability is not costing

> **ICO-032 — Available Quantity and inventory cost are computed independently and must not be conflated** (`PRD-023`, `BD-285`).

| Figure | Nature |
|---|---|
| **Physical Stock** | One, shared — derived from movements |
| **Available Quantity** | **Automatic** — ready-built plus buildable, recomputed on every movement |
| **Published Marketplace Stock** | **Manual, per shop** — may deliberately exceed available (`PRD-126`) |
| **Inventory cost** | **Derived from acquisition movements** — unaffected by all three |

**A component's availability changes constantly; its cost does not change at all.**

---

# 10. Accounting Integration

**All posting is owned by `ACCOUNTING_ARCHITECTURE.md`. This section states only the interface.**

> **ICO-033 — This document owns the cost figure. Accounting owns what that figure posts** (`ICO-000`, `ACC-011`).

| Event | Cost supplied by | Posting owned by |
|---|---|---|
| Goods accepted | `ICO-007` — invoice price | `ACC-011` — payable at acceptance |
| Build completed | `ICO-018` — consumed component cost | Accounting |
| Trade-In allocated | `ICO-015` — allocated share | `ACC-039` — the same value is the credit liability |
| Item sold and delivered | Weighted average at consumption | **COGS** — `ACCOUNTING_ARCHITECTURE.md` |
| Scrap | `ICO-029` | **Accounting loss** |
| Stock adjustment | `ICO-003` — quantity, with reason and approval | Accounting |

**Two facts about Fund Transfer, stated because the question was asked:**

> **ICO-034 — Fund Transfers do not affect inventory cost, and transfer fees are never capitalised into inventory** (`ACC-026`, `ACC-032`, `ICO-007`).

**A transfer moves value between Financial Accounts the business controls; it acquires nothing.** A transfer fee is a **period expense**, consistent with `ICO-007`'s treatment of freight and duty — **the ERP capitalises no incidental cost into inventory at all.**

---

# 11. Cross-module Dependencies

| Module | Interface |
|---|---|
| **`PRODUCT_ARCHITECTURE.md`** | `PRD-121` – `PRD-124` ratified cost rules · BOM · serialization policy · `PRD-044` as amended |
| **`ACCOUNTING_ARCHITECTURE.md`** | `ACC-022` – `ACC-025` · posting ownership · COGS · Trade-In Credit as the liability half |
| **`INVENTORY_ARCHITECTURE.md`** | Quantity, commitment stages, movement ledger, loss attribution — **valuation carved out here** |
| **`WAREHOUSE_ARCHITECTURE.md`** | Goods receipt · QC execution · physical counts · build execution |
| **`RETURN_EXCHANGE_ARCHITECTURE.md`** | QC dispositions · execution after commercial resolution · refund independence |
| **`STATE_MACHINE_ARCHITECTURE.md`** | `SM-11` QC · `SM-12` Build Job · `SM-15` Repair · `SM-18` Trade-In Case · `SM-19` Trade-In Component |
| **`SYSTEM_ARCHITECTURE.md`** | `SYS-102` allocate once · `SYS-103` goods held but not owned · `SYS-104` record the outcome |
| **`DOMAIN_MODEL.md`** | `E-020`, `E-021`, `E-026`, `E-062`, `E-065`, `E-067`, `E-072`, `E-081` – `E-083` |
| **`AUDIT_ARCHITECTURE.md`** | Reason capture on adjustments and write-offs (`AUD-042`) |

**No entity or state machine is defined in this document.**

---

## 11.1 Selling price is not this document's, and the boundary is now load-bearing

> **ICO-035 — This document supplies the cost figure a selling-price recommendation reads. It owns nothing about selling price** (`ICO-000`, `ICO-033`, `DOC-005`).

**`BD-435` introduced an Ideal / Recommended Selling Price of applicable product cost + 25%, owned by `PRODUCT_ARCHITECTURE.md` §33** (`PRD-139`). **The cost input is already canonical and needed no new rule** — `ICO-001` makes Weighted Average Cost the only method, `ICO-007` makes product cost the supplier invoice price.

> ⚠ **Two consequences follow directly from rules already here.**
>
> **`ICO-009` — margin computed from `ICO-007` is knowably incomplete**, because freight and duty are period expenses. **So cost + 25% is guidance over an incomplete cost, not a margin the business earns**, and `PRD-140` makes the figure advisory for exactly this kind of reason.
>
> **`ICO-006` refuses inventory entry without an acquisition cost**, and `INV-32.4`/`SYS-034` rule that **an unknown cost is unknown, not zero.** **`PRD-142` therefore shows no recommendation where no canonical cost exists** — a figure built on an assumed zero would violate a ratified rule.

> ⚠ **`GAP-112` — which cost figure feeds the recommendation where no weighted average exists is not determined here, and no basis is chosen.** **`ICO-018` defines the cost of a *finished* build, not an expected one**, and under `SYS-080` build-to-order is the primary mode with components that **may not yet be purchased**. **Nothing in this document may be read as supplying a forward estimate.**

---

# 12. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing |
|---|---|---|
| **`GAP-103`** | 🔴 High | **Teardown — the inverse of assembly — does not exist in the architecture** (§4.3). `SM-12` builds; nothing disassembles. **The largest structural finding in Trade-In costing** |
| **`GAP-104`** | 🟡 Medium | **Salvaged components must not share a SKU with new stock** (§8). **Recorded as a consequence to test, not a rule** — resolving it requires a business decision |
| **`GAP-112`** | 🟢 Low | **Which cost figure feeds the Ideal / Recommended Selling Price where no weighted average exists** (§11.1) — build-to-order, bundles, non-catalogued lines. **Advisory display only, so its absence blocks nothing** |
| **`GAP-089`** | 🟡 Medium | **Current configuration has no owner** (§6.2) — as-built plus repair history, derived or maintained undecided |
| **`GAP-105`** | 🟢 Low | **Valuation on legal transfer of abandoned property** — no acquisition cost exists while `ICO-006` requires one |
| **`GAP-092`** | 🟢 Low | **No allocation basis exists for components of an assembled product** — component *refund* is not expressible; `PRD-053` covers bundles only |
| **`GAP-073`** | 🟡 Medium | **A substituted component of the same model is undetectable** — an accepted exposure affecting what a returned unit actually contains |
| **`PRD-123`** | — | **Margin is knowably incomplete** (§3.3) — recorded, not corrected |

---

# 13. Traceability

## 13.1 Business Decisions consumed

| Domain | Decisions |
|---|---|
| **Trade-In** | `BD-388` – `BD-397` — **carried in full**; `BD-390` allocation records results · `BD-391` immutability over availability |
| **Purchase** | `BD-293` – `BD-303`, especially `BD-297` no landed cost · `BD-299` invoice as evidence |
| **Warehouse & Assembly** | `BD-278` – `BD-292`, especially `BD-285` derived availability · `BD-286` labour · `BD-290` repair cost bearer · `BD-291` scrap · `BD-292` counts |
| **Warranty** | `BD-324`, `BD-336`, `BD-337` |
| **Return & Exchange** | `BD-289`, `BD-346`, `BD-347` |
| **Accounting** | `BD-298`, `BD-304`, `BD-310`, `BD-311` |
| **Serial policy** | `BD-242`, `BD-265` — WAC needs no serials |

## 13.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `PRD-013`, `PRD-014`, `PRD-023`, `PRD-036`, `PRD-038`, `PRD-044`, `PRD-046`, `PRD-053`, `PRD-069`, `PRD-071`, `PRD-103`, `PRD-121` – `PRD-124`, `PRD-126` | `PRODUCT_ARCHITECTURE.md` |
| `ACC-002`, `ACC-003`, `ACC-011`, `ACC-016`, `ACC-017`, `ACC-022` – `ACC-025`, `ACC-026`, `ACC-030`, `ACC-032`, `ACC-039` | `ACCOUNTING_ARCHITECTURE.md` |
| `BR-052`, `BR-102`, `BR-104`, `BR-105`, `BR-109`, `BR-121`, `BR-131` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `DB-001` – `DB-003`, `DB-022`, `DB-077` | `DATABASE_ARCHITECTURE.md` |
| `SYS-102` – `SYS-104`, `CP-8`, `CP-12` | `SYSTEM_ARCHITECTURE.md` |
| `SMA-050`, `SMA-067`, `SMA-068`, `SMA-073` | `STATE_MACHINE_ARCHITECTURE.md` |
| `INV-71.2`, `INV-72.2`, `INV-81.1` – `INV-81.4`, `INV-82.2`, `INV-82.3`, `DM-077` | `DOMAIN_MODEL.md` |
| `RET-013`, `RET-018`, `RET-023`, `RET-025` | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `AUD-042` | `AUDIT_ARCHITECTURE.md` |

## 13.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`PRD-103` corrected** — assembly labour is **supported and optionally zero**, not excluded | `ICO-019` |
| **`PRD-044` amended** — warranty resolution needs as-built **plus repair history** | `ICO-023` |
| **`PRD-079` withdrawn**, `PRD-073` amended — availability model | `ICO-032` |
| **`SYS-102` cross-domain check closed** — Purchase and Trade-In agree; stated once at system level | `ICO-030` |
| **`GAP-005`, `GAP-046` closed** — Weighted Average Cost; no landed cost | `ICO-001`, `ICO-007` |

---

# 13A. Valuation Visibility Authority — ratified 2026-08-11

> **ICO-038 — ✅ `inventory-costing.valuation.view` IS THE CAPABILITY FOR COST-SENSITIVE VALUATION, AND IT IS READ-ONLY.**
>
> **Written to `PRM-089`'s convention and named by the owning module** (`PRM-007`, `ICO-000`).
>
> **It authorises viewing and exporting:** **item-level Stock Value** · **Total Stock Value** · **weighted average cost where the canonical contract permits it** (`PRD-149`, `PRD-153`).
>
> **a.** 🔴 **WITHOUT IT, THE VALUE IS ABSENT — NOT ZERO.** **No Total Stock Value, no item Stock Value and no restricted cost column is returned by any API, export or client state.** ⚠ **Rendering `0` would state a falsehood: permission denied is not a measured zero, and `SYS-034` forbids presenting an unavailable figure as zero.**
> **b.** 🔴 **IT GRANTS VIEW AUTHORITY ONLY.** **It confers no authority to mutate weighted average cost, a valuation or any costing fact.** ✅ **Cost remains DERIVED FROM MOVEMENTS and is never manually maintained** (`ICO-002`).
> **c.** ✅ **It is INDEPENDENT of Product capabilities** (`PRD-154.b`) — **`PRD-098` applied: a technician assembling a build needs the component list and needs no cost.**
> **d.** 🔴 **Administrator receives it implicitly no more than any other capability** (`PRM-068`, `PRM-003`).
> **e.** ⚠ **Backend enforcement is authoritative.** **Hiding a figure in the interface is a usability decision, never a security control** (`PRM-004`, `PRJ-120`).

---

# 14. Version History

| Version | Date | Change |
|---|---|---|
| **1.1.0** | **2026-08-09** | **§11.1 added — `ICO-035`, a boundary rule only. No cost rule changed.** `BD-435` introduced an **Ideal / Recommended Selling Price of applicable product cost + 25%**, owned by `PRODUCT_ARCHITECTURE.md` §33. **The cost input needed no new rule** — `ICO-001` already makes Weighted Average Cost the only method. **Two existing rules become load-bearing**: **`ICO-009` means cost + 25% is guidance over a knowably incomplete cost, not a margin earned**, and **`ICO-006` with `INV-32.4`/`SYS-034` means no recommendation is shown where no canonical cost exists** — unknown cost is **not zero**. ⚠ **`GAP-112` carried** — `ICO-018` costs a **finished** build, not an expected one, and under `SYS-080` build-to-order components **may not yet be purchased**; **nothing here supplies a forward estimate** |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates costing decisions across §17 Warehouse & Assembly, §18 Purchase, §19 Accounting, §21 Warranty, §22 Return & Exchange and §26 Trade-In, with `BD-388` – `BD-397` carried in full. **35 rules, all traceable; no business rule, entity, state machine or costing method introduced.** `ICO-000` records the valuation carve-out from `INVENTORY_ARCHITECTURE.md` ✅ (`DOC-057`). **`GAP-104` is carried as an open gap and explicitly not converted into a rule** (§8). Seven open items carried |

---

# Monetary rounding — consumed, not restated

> **ICO-036 — Inventory Costing applies the ERP-wide BDT monetary rounding policy at `DB-079`. It states no rounding rule of its own** (`DOC-005`, `DOC-006`).

🔴 **The distinction that matters here is PRECISION, not policy.**

| Figure | Treatment |
|---|---|
| **Weighted Average Cost — the unit cost itself** | 🔴 **HIGH PRECISION. It is a RATE, not a monetary line.** ⚠ **Never stored or carried at 2dp merely because final amounts are 2dp** |
| **A costed monetary amount** — cost of goods on a movement, a valuation line, a posting | ✅ **2dp `HALF_UP` under `DB-079`** |

> **ICO-037 — `ICO-001`'s Weighted Average Cost retains higher precision throughout, and rounding applies to the resulting monetary amount only.**
>
> **high-precision WAC × quantity → exact calculation → monetary line → 2dp `HALF_UP`.**
>
> ⚠ **Rounding the unit cost before multiplying would compound error across every subsequent movement** — the failure `DB-037` and `DB-079` exist to prevent.

| Version | Date | Change |
|---|---|---|
| **1.3.0** | **2026-08-11** | ✅ **`§13A`, `ICO-038` — `inventory-costing.valuation.view`, the READ-ONLY capability for cost-sensitive valuation, written to `PRM-089`'s convention.** 🔴 **Without it the value is ABSENT, NOT ZERO — no Total Stock Value, no item Stock Value, no restricted cost column in any API, export or client state, because `0` would state a falsehood and `SYS-034` forbids presenting an unavailable figure as zero.** 🔴 **VIEW ONLY — no authority to mutate WAC or any costing fact; cost stays derived from movements** (`ICO-002`). ✅ **Independent of Product capabilities, which is `PRD-098` applied; Administrator receives it implicitly no more than any other capability; backend enforcement is authoritative.** |
| **1.2.0** | **2026-08-10** | ✅ **`ICO-036`/`ICO-037` added. Inventory Costing CONSUMES `DB-079` and states no rounding rule of its own.** 🔴 **The distinction recorded is PRECISION, not policy: the Weighted Average unit cost is a RATE and stays HIGH PRECISION; only the resulting monetary amount rounds to 2dp `HALF_UP`.** ⚠ **Rounding the unit cost before multiplying would compound error across every subsequent movement.** **`ICO-001` unchanged** |


**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies inventory costing business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
