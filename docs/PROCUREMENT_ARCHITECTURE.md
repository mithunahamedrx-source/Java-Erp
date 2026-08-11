# Procurement Architecture

**Owner:** Trioloo Technology · **Module:** Procurement · **Status:** Canonical
**Version:** 1.1.0 · **Ratified:** 2026-08-08 · **Rule prefix:** `PRC-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §18 Purchase & Supplier (`BD-293` – `BD-303`), with prior coverage at `BD-093`, `BD-097`, `BD-106`–`BD-113`, `BD-286` – `BD-292`.

**Reconciliation records consolidated:** [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §9.9 (`BR-105` – `BR-115`) · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) §29 (`PRD-121` – `PRD-124`) · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) §19.5 (`SMA-032` – `SMA-034`, `SMA-036`) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `DM-045` – `DM-050`.

**References, never duplicated:** [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) `WHS-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §0, §5.4 · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **PRC-000 — This document answers *what was bought, from whom, on what commitment, what was accepted, and what is therefore owed*. It answers nothing about how goods are physically handled, what the stock position becomes, how cost is derived, what posts to the ledger, or what a product is.**

| Question | Owner |
|---|---|
| **What was bought, from whom, what was accepted, what is owed** | **`PROCUREMENT_ARCHITECTURE.md`** — `PRC-` |
| **How is the receipt physically performed and verified?** | [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) — `WHS-` |
| What exists · is it available · what moved it | [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) — `IVN-` |
| **What did it cost, and how is that figure derived?** | [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) — `ICO-` (`DOC-057`) |
| What accounting entry posts? | [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) — `ACC-` |
| What is the product being bought? | [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) — `PRD-` |
| What are the states and legal transitions? | [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) — `SM-`, `SMA-` |
| Who may approve a purchase or a payment? | [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) |

**The sharpest boundary in this document is with Warehouse**, and it runs through a single record: **Procurement owns `E-030` Goods Receipt; Warehouse owns the physical act of receiving** (`WHS-010` – `WHS-018`). See §8.4.

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine or lifecycle is introduced. **No gap is resolved by assumption** — see §20.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To define how goods enter the business: **what commitment was made, what actually arrived, what was accepted, and what is consequently owed.**

One event carries the whole domain, and the business placed it there itself:

> **Acceptance is the pivot.** Stock availability (`BD-287`), payable creation (`BD-299`), excess handling (`BD-296`) and cost entering the weighted average (`BD-298`) **all turn on the same moment.** A single physical decision drives the entire inbound model.

Everything else in this document is a consequence of that, and of one inversion of the conventional arrangement — **the goods receipt is the spine of purchasing, not the purchase order** (`BR-105`).

---

# 2. Scope

## 2.1 In scope

The supplier master and its non-binding nature · purchase demand and its two sources · the Purchase Order and Direct Purchase paths · the purchase-order amendment window and its external-authority boundary · the goods receipt record and line-level acceptance · the four-value discrepancy vocabulary and its resolution routes · supplier payable creation · supplier payment as a movement stream · post-acceptance supplier settlement — return, exchange, credit · supplier warranty claims · the acquisition-cost interface.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Physical receiving execution, the four checks, QC of inbound goods** | `WAREHOUSE_ARCHITECTURE.md` (`WHS-010` – `WHS-018`) |
| **Stock quantity, availability, the movement ledger, not-sellable conditions** | `INVENTORY_ARCHITECTURE.md` (`IVN-000`) |
| **Cost derivation, Weighted Average Cost, cost immutability** | `INVENTORY_COSTING_ARCHITECTURE.md` (`ICO-000`) |
| **Every posting, including the payable entry** | `ACCOUNTING_ARCHITECTURE.md` (`ACC-011`) |
| **Product definition, Product Variant, reorder level as an attribute** | `PRODUCT_ARCHITECTURE.md` |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` |
| **Customer-side return, exchange and refund lifecycles** | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| **Return QC disposition and entitlement** | `RETURN_EXCHANGE_ARCHITECTURE.md`, `WAREHOUSE_ARCHITECTURE.md` |
| Notification delivery | `NOTIFICATION_ARCHITECTURE.md` |
| Screen layout, density, interaction | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

## 2.3 Explicitly excluded by the discovery itself

> **PRC-001 — Multi-level approvals, tendering, RFQ comparison and supplier scoring were excluded from §18 by the business at the point the domain was opened, and no rule is written for them here.**

§18 states its exclusions in its own scope line. Three of the four are additionally excluded on the record:

| Excluded | Confirmed by |
|---|---|
| **Multi-level approval** | `BD-112`, `BD-113` — no two-person approval anywhere; authority is standing, not delegated. `PRM-048`, `PRM-049` found approval-workflow machinery unnecessary |
| **Supplier scoring, rating, ranking** | `BD-295` — the five selection factors are *decision inputs, not a scoring model* |
| **Tendering and RFQ comparison** | `CP-9` — declined machinery; no answer describes the practice |

**These are absences of discovery and of need, not designed-away capability** (`DOC-001`, `DM-001`).

---

# 3. Architectural Principles

## 3.1 P1 — Acceptance creates the obligation; documents evidence it

> **PRC-002 — The supplier payable is created at acceptance of goods. The supplier invoice is evidence, never the trigger** (`BR-109`, `DM-048`, `BD-299`, `ACC-004`).

**There is no invoice-posting process that brings a liability into existence, and no three-way-match gate standing between receipt and payable.** The invoice is attached as a reference and retained **as received, unaltered** (`AUD-009`).

**Both directions of the business now state one principle** (`ACC-003`):

| | Obligation arises from | The document |
|---|---|---|
| **Customer receivable** | **Successful delivery** (`BR-116`) | Evidences it |
| **Supplier payable** | **Acceptance of goods** (`BR-109`) | Evidences it |

## 3.2 P2 — The receipt is the spine, not the order

> **PRC-003 — `E-030` Goods Receipt is mandatory and capable of existing without a parent. `E-029` Purchase Order is optional** (`BR-105`, `IVN-021`, `BD-294`).

**The structural consequence is the reason the rule exists:** if receipts were modelled as children of purchase orders — the usual arrangement — **the direct-purchase path would be unrepresentable, and staff would create fictitious retrospective purchase orders to satisfy the model.** That is the failure this rule prevents.

## 3.3 P3 — Nothing about a supplier is binding

> **PRC-004 — There is no mandatory default supplier, no supplier–product sourcing relationship, and no supplier catalogue** (`BR-107`, `PRD-124`, `BD-295`).

**A suggestion is not a relationship.** The ERP may remember previously used or preferred suppliers **for convenience**; the user is **always free to select any supplier**. `PRD-056` is the established precedent — reuse is *"a suggestion requiring confirmation, never automatic."*

## 3.4 P4 — Judgement advises; correctness enforces

> **PRC-005 — Purchasing decisions are advised and never enforced; cost computation is enforced and never chosen** (`CP-8`, `BD-293`, `BD-298`).

The business drew this boundary itself, and §18 contains **both sides of it**:

| Advises | Enforces |
|---|---|
| *"The system **may recommend** purchases… the **final purchasing decision always belongs to the business**"* (`BD-293`) | *"The system **automatically** calculates the average unit cost… the business **does not manually choose**"* (`BD-298`) |
| Supplier selection — a commercial judgement (`BD-295`) | Which cost figure applies — **not a judgement at all** |

**`BD-298` is recorded in the discovery as the first clear counter-instance to advise-over-enforce, and as the answer that confirmed the framing rather than breaking it.**

## 3.5 P5 — Correction moves forward

> **PRC-006 — A supplier credit is a linked adjustment, never an edit to the original purchase order or goods receipt** (`BD-288`, `DB-002`, `DB-077`, `DM-035`, `ACC-002`).

**Immutability attaches at completion, not at creation** (`DB-077`). §7.3 records the one case where that boundary actually decides something.

## 3.6 P6 — Every procurement action is attributable

> **PRC-007 — Every purchase, acceptance, payment and amendment is attributable to an Operational User Profile** (`AGV-001`, `AUD-004`, `PRM-005`).

---

# 4. The Supplier

> **PRC-008 — `E-025` Supplier is a simple party record and is not extended with sourcing terms, per-product pricing, or a catalogue of what each supplier carries** (`BD-295`, `PRD-124`).

**`PRD-124` states the consequence for the product model exactly:** supplier sourcing places **no requirement** on it — no supplier–product relationship, no per-item sourcing record, no contracted price list, no supplier catalogue. `E-020` gains **reorder level** as an attribute (`BR-106`); nothing else.

> **PRC-009 — Supplier purchase history is a derived view, not an entity** (`BD-295`, `DB-001`, `DB-067`). `E-029` and `E-030` already carry supplier, date, items, quantities and prices. **History is a query over those records.**

> **PRC-010 — Creating a supplier and approving payment to that supplier are never held by one actor** (`INV-25.1`, `PRM-012`). **This pair guards against fabricated-supplier fraud** and is the one segregation constraint this domain carries unconditionally.

> **PRC-011 — A supplier referenced by any historical record is archived, never deleted** (`INV-25.2`, `SYS-024`, `BD-338`).

## 4.1 ⚠ Per-supplier commercial terms — `GAP-079`

**Three answers imply supplier-level terms and none states that they are recorded in the ERP:**

| Answer | Wording |
|---|---|
| `BD-288` | Payment on acceptance *"unless another agreement exists"* |
| `BD-295` | Left explicitly as an open thread |
| `BD-300` | Payment mode *"depending on the agreement"* |

**`E-025`'s attribute list names payment terms and lead times**, but whether the agreement lives in the ERP or outside it — with only its outcome recorded, as approval does at `BD-109` — **is not established and is not assumed** (`DM-001`).

⚠ **`GAP-079` is carried unchanged.**

---

# 5. Purchase Demand

> **PRC-012 — Purchase demand arises from two independent sources: stock position and the order book** (`BR-106`, `BD-293`).

| Source | Triggers |
|---|---|
| **Stock position** | Low physical stock · expected future demand · a management decision on trends or promotions |
| **Committed demand** | **Components insufficient for confirmed customer orders** · **a specific customer order** for unavailable items |

> **PRC-013 — Demand against the order book is already computable and requires no new mechanism** (`BD-293`, `PRD-024`, `BD-278`). Components are reserved at order confirmation and Available Stock already nets reservations, so a shortfall against confirmed orders is **negative available stock against committed demand**.

> **PRC-014 — A purchase recommendation is a derived view, not an entity, and has no lifecycle** (`BR-106`, `DB-001`, `DB-067`, `SMA-034`). It is computed from available stock versus reorder level. **No Purchase Recommendation entity exists and none is proposed.**

> **PRC-015 — Demand forecasting is not modelled** (`BD-293`). *"Expected future demand"* and *"sales trends or promotions"* are **human judgement inputs, not system capabilities**, and nothing implies a forecasting mechanism.

> **PRC-016 — The system may recommend; the business decides** (`BR-106`, `BD-293`, `CP-8`). The sixth of the recorded advise-over-enforce instances.

**The loop closes with published stock.** `BD-280` permits published marketplace stock to exceed physical on the strength of procurement capacity; those orders arrive; the resulting shortfall drives the actual purchase. **`BD-280` and `BD-293` describe one cycle from opposite ends** (`IVN §4.2`).

---

# 6. Two Purchase Paths

> **PRC-017 — Both a Purchase Order path and a Direct Purchase path are first-class, and every purchase is recorded in the ERP after goods are received** (`BD-294`).

| | Purchase Order path | **Direct Purchase path** |
|---|---|---|
| Purchase Order | Created first | **Does not exist** |
| Goods Receipt | Created on arrival | **Created on arrival** |
| Inventory, payable, accounting | Driven by receipt | **Driven by receipt** |

> **PRC-018 — *"A purchase order should normally be created first"* is a convention, not a gate** (`BD-294`). **Nothing blocks a purchase that lacks a purchase order.**

> **PRC-019 — Recording a direct purchase after the goods arrive is first capture, not correction** (`DB-077`, `BD-294`). It requires no adjustment mechanism — the same distinction the business drew unprompted for serials at `BD-266`.

> **PRC-020 — Purchase-order rules apply only where a purchase order exists** (`BD-294`). *"Stays open until resolved or officially closed"* is a rule about `E-029`. **Discrepancy handling attaches to the receipt**, so it survives on both paths.

---

# 7. The Purchase Order

## 7.1 Lifecycle and closure

> **PRC-021 — `E-029` Purchase Order stays open while any pending supplier issue is unresolved, and closes when all issues are resolved *or officially closed*** (`BD-288`).

**"Or officially closed" is a deliberate termination path for issues that will never resolve** — a supplier who never replaces the missing unit, a dispute abandoned as uneconomic. **Without it, purchase orders would accumulate open forever.**

⚠ **Whether that closure carries a reason and an approver is not stated.** The pattern across `BD-110`, `BD-111`, `BD-275` and `BD-282` suggests it would, but **the discovery records this explicitly as not asserted**, and it is not asserted here (`DM-001`).

> **PRC-022 — The purchase order number is stable and never reused** (`INV-29.3`, `SYS-031`).

## 7.2 Amendment is bounded by external authority

> **PRC-023 — A purchase order may be amended or cancelled only until the supplier ships or confirms shipment, and only with the supplier's agreement** (`BR-114`, `SMA-033`, `BD-303`).

**Where the supplier has shipped or does not agree, it is resolved by agreement — never cancelled unilaterally.** Owner or authorised Administrator decides; the discussion happens off-system and its outcome is recorded (`BD-109`).

> **PRC-024 — The supplier's shipment state is mirrored, never owned** (`SMA-033`, `SYS-010`, `SYS-026`). This is the **third external-authority relationship** the architecture models, after marketplaces (`PRD-030`) and couriers.

> **PRC-025 — The change window closes when goods move, symmetrically on both sides of the business** (`SMA-033`).

| | Freely amendable until |
|---|---|
| **Customer order** | `COURIER_BOOKED` (`BR-082`) |
| **Purchase order** | **Supplier ships or confirms shipment** (`BR-114`) |

**Neither boundary sits at agreement or at payment. Both sit at physical movement.**

## 7.3 Editable does not mean untracked

> **PRC-026 — A complete history of purchase-order amendments and cancellations is retained** (`BR-115`, `DB-068`, `BD-303`). **Permission to change and obligation to record the change are separate requirements.**

> **PRC-027 — Updating an open purchase order is permitted; the same change after closure requires a linked adjustment** (`DB-077`, `BD-296`).

**This is recorded in the discovery as the first case since `DB-077` was written where the immutability boundary actually decides something** — accepting excess onto an open purchase order is an in-progress edit, not a violation of `DB-002`.

## 7.4 Approval

> **PRC-028 — Purchase approval follows the standing-authority model, with no approval hierarchy** (`BD-112`, `BD-113`, `PRM-048`, `PRM-049`). Owner, Administrator, or a permissioned user.

> **PRC-029 — The approver of a purchase order is never its creator, and approval carries a magnitude bound beyond which escalation applies** (`INV-29.1`, `INV-29.2`, `PRM-006`, `PRM-008`).

⚠ **`PRMU-8` is carried** — whether `PRM-008`'s magnitude bound on purchase orders is an **enforced number** or follows the discount pattern of *who decides, not how much* (`PRM-052`) is unresolved.

---

# 8. Goods Receipt and Acceptance

## 8.1 Line-level acceptance

> **PRC-030 — Receiving is line-level, and partial receiving is mandatory** (`BR-098`, `BD-287`, `BD-288`). **A goods receipt is never a document-level accept or reject.**

| Outcome | Consequence |
|---|---|
| **Accepted** | Enters available stock immediately · **creates the payable** · **enters the weighted average** |
| **Issue found** | Physically held, **not sellable**, **no payable**, pending supplier resolution |

> **PRC-031 — `E-066` Purchase Order Item is the granularity at which goods are ordered, received and costed** (`E-066`, `BD-288`). Line-level acceptance, line-level payable and line-level pending status all require it.

> **PRC-032 — Procurement buys Product Variants, never Sellable Products** (`INV-66.1`). Physical things are purchased; commercial offerings are not.

> **PRC-033 — Unit cost carries its currency** (`INV-66.3`, `DB-036`, `SYS-029`).

## 8.2 Pending items carry no liability

> **PRC-034 — Rejected, damaged, missing and pending items create no payable until they are accepted or otherwise resolved** (`BR-109`, `BD-299`).

**This aligns the payable with the *pending supplier resolution* stock condition** (`BR-104`, `IVN-012`): goods held pending are **neither sellable stock nor a liability**. The two positions stay consistent, *"which is what prevents a balance sheet carrying obligations for goods the business has not agreed to keep."*

## 8.3 Where invoice and acceptance disagree

> **PRC-035 — Where the supplier invoice and the accepted quantity disagree, acceptance governs** (`DM-048`, `BD-299`). A supplier invoice for more than was accepted **does not raise the payable**; the difference is a variance resolved through the three routes at `PRC-037`.

## 8.4 ⚠ The Warehouse boundary — one record, two owners of different things

> **PRC-036 — Procurement owns the goods receipt *record* and the acceptance *decision*. Warehouse owns the physical act of receiving and verifying** (`DOC-005`, `WHS-002`, `WHS-010` – `WHS-018`).

| Warehouse owns | Procurement owns |
|---|---|
| The four checks — quantity, model, visible condition, major damage (`WHS-012`) | **What the acceptance decision means commercially** |
| That verification is **visual and quantitative, never functional** (`WHS-013`) | The payable that acceptance creates (`PRC-002`) |
| Who may physically receive (`WHS-014`) | The discrepancy vocabulary and its resolution routes (`PRC-037`) |
| Physical inspection under `SM-11` where performed (`WHS-018`) | The purchase-order relationship, where one exists |

**Neither owns the stock movement** (`IVN-038`) **or the cost** (`ICO-033`).

> **PRC-037 — Goods receipt requires no state machine** (`SMA-034`). `E-030` records an acceptance decision per line; **it has no states and none should be given to it.** The same holds for purchase recommendation (`PRC-014`) and supplier selection (`PRC-004`).

---

# 9. Discrepancies

> **PRC-038 — Four discrepancy types are established, and they are controlled vocabulary under `SYS-021` versioning** (`BD-288`, `BR-110`, `SYS-043`).

| Discrepancy | Resolution routes |
|---|---|
| **Shortage** | Replace · send missing quantity · credit |
| **Wrong item** | Replace · credit |
| **Damaged** | Replace · credit |
| **Excess** | **Accept by agreement · return** — **two routes, no credit path** |

> **PRC-039 — Excess is structurally simpler because nothing was owed for it** (`BD-296`). The other three concern goods Trioloo expected and did not properly get; excess concerns goods it never asked for. **There is no money to recover, only a decision whether to take them.**

> **PRC-040 — The default on excess is to accept only the ordered quantity** (`BR-110`, `BD-296`). Extra may be **accepted by agreement**, updating the still-open purchase order (`PRC-027`), **or returned**.

> **PRC-041 — Payable follows the *finally* accepted quantity** (`BR-110`, `BD-296`, `BD-288`). **Over-delivery does not create an obligation; accepting it does.**

> **PRC-042 — Rejected excess never enters stock, so no inventory movement occurs and no reversal is required** (`BD-296`). **This is structurally distinct from a post-acceptance supplier return** (§11), where goods *were* in stock and returning them removes them.

> **PRC-043 — *"Both parties agree"* is a supplier-side condition the ERP does not enforce** (`BD-296`). Whether the supplier consents happens outside the system; **the ERP records the outcome** — the same shape as `BD-109` and `SYS-104`.

---

# 10. Acquisition Cost — Interface Only

**Cost derivation is owned by [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md).** This section states only the procurement-side facts it consumes.

> **PRC-044 — Product cost is the supplier invoice price. There is no landed cost allocation** (`PRD-121`, `ICO-007`, `ACC-022`, `DM-047`, `BD-297`, closing `GAP-046`).

**Transport, freight, import duty and clearing are period business expenses**, not capitalised into inventory. **No allocation engine, no apportionment basis, no landed-cost adjustment on receipt, and no revaluation of stock when a freight invoice arrives late.**

> **PRC-045 — Component cost is Weighted Average Cost, and the business does not manually choose between purchase prices** (`PRD-122`, `ICO-001`, `ACC-023`, `DM-046`, `BD-298`, closing `GAP-005`).

**Specific identification is not used, coherently rather than by exclusion** — it requires serials, and `BD-265` established that components on desktop PCs are usually not serialized. **Weighted average is the only method that works without unit-level identity.**

> **PRC-046 — Acquisition cost is allocated once at acceptance and never retrospectively restated** (`SYS-102`, `ICO-030`, `ACC-024`).

**Two independent domains reached this separately** — Purchase and Trade-In — and the business supplied the priority: *inventory immutability is more important than early inventory availability.*

⚠ **`PRD-123` is carried: reported margin is knowably incomplete.** Product cost understates true acquisition cost by whatever freight and duty amount to, so gross margin **overstates**. **This is a classification decision on known amounts, not an unknown recorded as zero** — `SYS-034` and `BR-007` are not violated (`PRD-123`, `BD-297`).

---

# 11. Supplier Payable and Payment

## 11.1 The payable

> **PRC-047 — Only accepted quantities create a supplier payable, and the payable is a position derived from acceptance movements** (`BR-109`, `DM-048`, `DB-001`, `ACC-011`).

**The posting is Accounting's** (`ACC-011` — *payable at acceptance, at invoice price*). Procurement supplies the acceptance fact and the accepted quantity.

## 11.2 Payment is a movement stream

> **PRC-048 — Supplier payment is a movement stream, not a status** (`BR-111`, `DM-049`, `BD-300`). Advance payment, full payment after receipt, partial payment, and multiple payments to settlement are all supported.

| Figure | Nature |
|---|---|
| Total purchase amount | From accepted quantities (`PRC-047`) |
| Total paid | **Sum of payment movements** |
| **Outstanding balance** | **Derived — never a stored figure decremented in place** (`DB-001`) |

> **PRC-049 — Payment method vocabulary is shared with the customer side and is not duplicated** (`BD-057`, `SYS-016`, `BD-300`). Nothing indicates the supplier side uses a different set, and **inventing a second vocabulary would violate `SYS-016`.**

## 11.3 Advances

> **PRC-050 — A supplier advance is a balance, not a payment state** (`ACC-021`, `SMA-036`, `BD-312`, closing `GAP-078`).

**`SMU-14` and `SMU-17` closed with it, and the proposed `SMA-035` extension was withdrawn as unnecessary** — what was missing was *a balance for the payment to sit against, not a state for it to occupy*. **`SM-5` Payment requires no change.**

> **PRC-051 — A supplier advance is applied automatically at acceptance — the event that creates the obligation it prepaid** (`ACC-021`, `BR-109`, `SMA-036`). **Application is not a judgement.**

**The position is symmetric on both sides of the business** (`ACC-021`): a customer advance applies at delivery; a supplier advance applies at acceptance.

## 11.4 The Supplier Ledger

> **PRC-052 — The Supplier Ledger carries seven transaction types, and Outstanding Balance among them is derived, not stored** (`SYS-090`, `BD-314`): **Purchase · Payment · Advance Payment · Supplier Return · Exchange · Credit Note/Adjustment · Outstanding Balance.**

> **PRC-053 — No customer ledger is required, and the asymmetry is justified** (`SYS-090`). At approximately 100% COD customers rarely carry a running balance and the receivable sits with the marketplace or courier (`BR-119`); **suppliers always carry a running relationship. The ledger belongs where balances persist.**

**Report definitions are owned by `REPORTING_ARCHITECTURE.md` ✅; no figure is owned by reporting** (`DB-067`).

---

# 12. Post-Acceptance Supplier Settlement

> **PRC-054 — Goods accepted into stock may still be returned or exchanged with the supplier, through three mechanisms** (`BR-112`, `DM-050`, `BD-301`): **Supplier Return · Supplier Exchange · Supplier Credit/Refund.**

> **PRC-055 — Exchange is primary and cash refund is least preferred** (`BR-112`, `DM-050`, `ACC-038`, `BD-301`).

**This is the fourth of four independent statements of one commercial instinct** (`SMA-043`, `ACC-038`) — *keep the value in goods; move money only when goods cannot resolve it.* `BD-090` established the same preference downstream on the customer side.

| | Customer side | Supplier side |
|---|---|---|
| Mechanisms | Return · Exchange · Refund | **Supplier Return · Supplier Exchange · Supplier Credit** |
| Preferred | **Exchange** (`BD-090`) | **Replacement or exchange** |
| Least common | Refund | **Cash refund** |

> **PRC-056 — Inventory and supplier payable are updated according to the final settlement, by linked adjustment** (`BD-301`, `BD-288`, `PRC-006`). **No new immutability question arises** — the mechanism was settled at `BD-288` and applies unchanged.

> **PRC-057 — A post-acceptance supplier return is a real stock movement** (`BD-301`). The goods **were** in stock, so returning them removes them — the distinction from rejected excess (`PRC-042`) is load-bearing.

## 12.1 ⚠ The settlement machines are undecided — `GAP-080`

**`SMA-032` records the shape as identical to the customer triad and the machine choice as unsettled:**

> *"Whether these reuse `SM-8` – `SM-10` parameterised by counterparty, or take their own machines, is an architecture decision and is not settled here. Reuse risks conflating two commercial relationships in one lifecycle; duplication risks two vocabularies for one concept (`SYS-016`)."*

⚠ **`GAP-080` is carried unchanged, and one referral discrepancy is recorded rather than resolved:**

| Document | Says the decision belongs to |
|---|---|
| `SMA-032` | *"the Return & Exchange module when it is written"* |
| `RETURN_EXCHANGE_ARCHITECTURE.md` §2.2 | **Procurement** — *"Supplier return, exchange and credit — `PROCUREMENT_ARCHITECTURE.md` ✅ (`BD-301`)"* |

**Each document referred the decision to the other.** **This document does not settle it**, because doing so would be an architecture decision made by default rather than by ratification (`DOC-023`, `DM-001`). **Recorded so the loop is visible and can be closed deliberately.**

---

# 13. Supplier Warranty Claims

> **PRC-058 — A supplier warranty claim on goods already sold is the same mechanism as any post-acceptance supplier return** (`BR-113`, `BD-302`).

It is **entered from the return-QC `Supplier Claim` disposition** (`BR-100`, `WHS-022`) rather than from a purchasing decision, and requires **no distinct process, entity, or settlement route** — only that it records its **cost bearer** and links to the originating customer return.

> **PRC-059 — `BD-302` was closed by generalization rather than asked** (`BD-302`). Every element was already established: the Supplier Claim disposition (`BD-289`), the cost bearer including Supplier and Manufacturer (`BD-290`), the three upstream tiers (`BD-093`, `BD-097`), the settlement triad (`BD-301`), and warranty attribution via **Build ID → As-Built Record** (`PRD-117`).

> **PRC-060 — Cost bearer determines the financial treatment, and Procurement owns none of it** (`BD-290`, `ICO-024`). Trioloo · Supplier · Manufacturer · Customer. **`INVENTORY_COSTING_ARCHITECTURE.md` owns the recorded cost; `ACCOUNTING_ARCHITECTURE.md` owns what it posts.**

> **PRC-061 — No new party entity is created for an authorised service centre** (`DM-039`, `WHS-072`). It is a **repair counterparty**; `E-025` Supplier serves where a formal relationship exists.

## 13.1 The warranty-case entry path, and Procurement's reaction to it

**Added 2026-08-09** from `BUSINESS_DISCOVERY.md` §31 (`BD-427`), propagating the ratified contracts of **`EVT-092 Warranty.SupplierClaimSubmitted`** and **`EVT-093 Warranty.SupplierClaimOutcomeRecorded`**.

> **PRC-063 — A supplier or manufacturer warranty claim may also be raised from a warranty case, not only from a return-QC disposition** (`BD-427`, `WAR-050`). `PRC-058` describes the entry from `Supplier Claim` (`BD-289`); **a claim arising from `E-071` Warranty Request is a second entry path into the same mechanism.** **No distinct process, entity or settlement route is created** — `PRC-058` and `PRC-059` stand unchanged.

> **PRC-064 — Procurement makes a warranty claim visible against the supplier it was raised with, so that supplier's warranty/claim history accumulates** (`BD-427`, `EVT-092`). **This is Procurement's entire confirmed reaction to a claim being submitted.**

> **PRC-065 — Procurement records the claim outcome against the same supplier's history** (`BD-427`, `EVT-093`). ⚠ **The decision is the supplier's; Trioloo records it** — externally originated, never locally decided.

> **PRC-066 — Submitting a claim creates no payment, accounting posting, stock movement or inventory adjustment, and accepting one creates no assumed financial recovery** (`BD-427`).
>
> **Three facts, never collapsed** (`BD-427`): **claim submitted** → follow-up becomes visible and pending · **decision received** → outcome and cost responsibility recorded · **actual money, credit, goods or parts received** → **the module that owns that consequence records it.** **Procurement records the real thing only when it actually arrives**, through goods receipt (`EVT-050`) or the applicable existing route — never on the strength of an acceptance.

**What this does not create.** No supplier-claim state machine — the claim remains part of the warranty case lifecycle (`EVA-023`) and is **not `SM-14`**, which is Marketplace Claim. **No purchase, payable, receivable, posting, inventory movement, automatic recovery, supplier scoring or penalty behaviour** is introduced. `PRC-060` continues to hold: **cost bearer determines financial treatment and Procurement owns none of it.**

⚠ **`ACC-025` and `ICO-025` govern what happens when an upstream claim is rejected** — a write-off (`BD-110`) or scrap, **as a separate authorised decision.** *The claim result is a fact; the accounting response is a decision.*

---

# 14. Ownership Boundaries — Consolidated

| Procurement supplies | The module owns |
|---|---|
| **Warehouse** — the commercial meaning of acceptance | The physical act, the four checks, inbound inspection (`WHS-010` – `WHS-018`) |
| **Inventory** — the acceptance event behind the inbound movement | Quantity, availability, the movement ledger, the *pending supplier resolution* condition (`IVN-012`) |
| **Inventory Costing** — the supplier invoice price and the accepted quantity | Cost derivation, WAC, allocation, cost immutability (`ICO-001`, `ICO-007`, `ICO-030`) |
| **Accounting** — the acceptance fact and the accepted quantity | **The payable posting** (`ACC-011`), advances (`ACC-021`), supplier settlement treatment (`ACC-038`) |
| **Product** — nothing; sourcing places no requirement on the product model (`PRD-124`) | Product Variant, BOM, reorder level as an attribute |
| **Return & Exchange** — the supplier-side settlement counterpart | Customer return/exchange lifecycles; the `Supplier Claim` disposition that enters `PRC-058` |
| **Order Management** — nothing directly | The order book that drives committed demand (`PRC-012`) |
| **State Machine Architecture** — nothing | All state and transition definitions |

**Procurement owns no stock figure, no cost figure and no posting.**

---

# 15. Entity References

| Entity | ID | Role here |
|---|---|---|
| **Supplier** | **`E-025`** | The party from whom goods are acquired — a **simple party record** |
| **Purchase Order** | **`E-029`** | **Optional** commitment to buy (`PRC-003`) |
| **Purchase Order Item** | **`E-066`** | The granularity of ordering, receiving and costing |
| **Goods Receipt** | **`E-030`** | **Mandatory and parentless-capable**; no lifecycle (`SMA-034`) |
| Product Variant | `E-020` | What is bought; carries **reorder level** (`BR-106`) |
| Exception | `E-056` | Receiving discrepancies awaiting supplier resolution |

**No entity is defined here.** `DOMAIN_MODEL.md` is canonical (`DOC-005`).

⚠ **One stale attribute observed, not corrected.** `E-030`'s key-attribute list in `DOMAIN_MODEL.md` still includes *"landed cost components"*, which `PRD-121`, `DM-047` and `ACC-022` withdrew. **`DM-047` explicitly states `E-030` carries no cost-allocation apportionment.** Correcting the attribute list is a `DOMAIN_MODEL.md` amendment and is **not made here** (`DOC-005`, `DOC-021`).

---

# 16. State Machine References

| Machine | Relevance |
|---|---|
| **None owned** | **Procurement owns no state machine** |
| `SM-11` QC | Inbound receipts may be inspected under it; owned by Warehouse |
| `SM-5` Payment | Supplier advances require **no change to it** (`SMA-036`) |
| `SM-8` – `SM-10` | ⚠ **Whether supplier settlement reuses them is undecided** — `GAP-080`, §12.1 |

> **PRC-062 — Three procurement concepts were assessed and none requires a machine** (`SMA-034`): **goods receipt · purchase recommendation · supplier selection.** *"None of the three has states, and none should be given any."*

**`E-029` Purchase Order carries the lifecycle recorded in `DOMAIN_MODEL.md`** — draft → approved → sent → partially received → received → closed, or cancelled — **bounded by external authority** (`SMA-033`, `PRC-023`). **No machine is defined here.**

---

# 17. Audit and Permission

| Requirement | Rule |
|---|---|
| **Every purchase, acceptance, payment and amendment attributable** | `PRC-007`, `AGV-001`, `AUD-004` |
| **Complete purchase-order amendment and cancellation history, with before and after values** | `PRC-026`, `BR-115`, `DB-068` |
| **Supplier creation and payment approval never held by one actor** | `PRC-010`, `INV-25.1`, `PRM-012` |
| **Approver is never the creator** | `PRC-029`, `INV-29.1`, `PRM-006` |
| **The supplier invoice is retained as received, unaltered** | `PRC-002`, `AUD-009` |
| **Write-off of an unrecoverable pending item carries a reason** | `BD-110`, `AUD-042` |
| Purchase records retained permanently | `BD-338`, `SYS-024`, `ACC-012` |

**Scope.** `PRM-064` establishes **Warehouse** and **Branch** as scope dimensions; scope bounds who may see and act. ⚠ `BD-377` records that most users currently work across all channels — the model is **designed for growth and deliberately not enforced today** (`PRM-051`, `AGV-021`).

---

# 18. Notification Integration

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.** This module raises these obligations against it:

| Obligation | Category | Source |
|---|---|---|
| **Receiving discrepancy awaiting supplier resolution** | **Action Required** | `BR-110`, `IVN §23`, `WHS §19` |
| **Low Stock** | **Ongoing Condition** — evaluated, not stored; restocking clears it | `NOT-013`, `IVN §23` |

**Low Stock is a query over current state, not an event** — it cannot be missed, because it is never delivered as a moment. **It is the trigger behind `PRC-012`'s stock-position demand source.**

---

# 19. Reporting Requirements

**Report definitions are owned by `REPORTING_ARCHITECTURE.md` ✅; no figure is owned by reporting** (`DB-067`).

Three of the eleven confirmed V1 reports read procurement-owned facts (`SYS-087`, `BD-314`): **Supplier Ledger** (rank 4) · **Supplier Due** (rank 6) · **Purchase** — the last reading `E-029` and `E-030` under `BR-105`.

---

# 20. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing on procurement |
|---|---|---|
| **`GAP-080`** | 🟢 Low | **Supplier settlement machines undecided** (§12.1). **Both `SMA-032` and `RET §2.2` referred the decision to the other document.** Not settled here |
| **`GAP-079`** | 🟡 Medium | **Per-supplier commercial terms are implied by three answers and recorded nowhere** (§4.1). Whether `E-025` holds them or the agreement lives outside the ERP is not established |
| **`PRD-123`** | — | **Margin is knowably incomplete** — freight and duty are period expenses (§10) |
| **`GAP-016`** | 🟡 Medium | **Backorder is confirmed real practice and remains unmodelled**, though `PRC-012`'s committed-demand source is the trigger that would feed it |
| **`GAP-024`** | 🟡 Medium | **No ageing threshold exists** for a pending supplier issue, so *"officially closed"* has no prompt |
| **`GAP-088`** | 🟡 Medium | **A warranty repair needing a part is a purchase trigger absent from `BD-293`'s five.** The part may be needed for a unit sold years ago. **The purchase demand is real and currently unaccounted for** |
| **`GAP-104`** | 🟡 Medium | **A salvaged component must not enter the same SKU as new stock** — `PRC-045`'s weighted average would blend salvage cost into purchased stock. **A consequence to test, not a rule** (`DM-077`) |
| **`GAP-077`** | 🟢 Low | Inventory-loss posting home — `ACC-025` now states it; **formal closure is a `GAP_ANALYSIS.md` decision** |
| **`PRMU-8`** | — | Whether purchase-order magnitude bounds are enforced numbers (§7.4) |
| **`GAP-001`** | 🔴 Critical | Module documents remain unwritten. **This document reduces the count by one** |

**Closed elsewhere and recorded here for traceability only:** `GAP-005` (WAC, `BD-298`), `GAP-046` (no landed cost, `BD-297`), `GAP-078` (supplier prepayment, `BD-312`). **None is closed by this document.**

---

# 21. Traceability

## 21.1 Business Decisions consumed

| BD | Contributes |
|---|---|
| `BD-293` | **Two demand sources** · recommendation is derived · system recommends, business decides |
| `BD-294` | **Purchase Order and Direct Purchase both first-class** · receipt is the spine |
| `BD-295` | **No default supplier** · no sourcing relationship · no scoring · history is a query |
| `BD-296` | **Excess as a fourth discrepancy type** · two routes · finally-accepted quantity |
| `BD-297` | **No landed cost** — product cost is the supplier invoice price |
| `BD-298` | **Weighted Average Cost**, computed automatically, never chosen |
| `BD-299` | **Payable at acceptance** · invoice is evidence · acceptance governs |
| `BD-300` | **Payment as a movement stream** · derived outstanding balance · advances |
| `BD-301` | **Supplier Return · Exchange · Credit**, exchange primary |
| `BD-302` | **Supplier warranty claim needs no distinct mechanism** — closed by generalization |
| `BD-303` | **Supplier-controlled amendment window** · complete amendment history |

**Prior coverage consumed:** `BD-057`, `BD-090`, `BD-093`, `BD-097`, `BD-106` – `BD-113`, `BD-265`, `BD-278`, `BD-280`, `BD-286` – `BD-292`, `BD-312`, `BD-314`, `BD-338`, `BD-377`.

## 21.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `BR-098` – `BR-115`, `BR-119`, `BR-082`, `BR-100`, `BR-104`, `BR-116` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `PRD-030`, `PRD-056`, `PRD-117`, `PRD-121` – `PRD-124` | `PRODUCT_ARCHITECTURE.md` |
| `IVN-012`, `IVN-021`, `IVN-038` | `INVENTORY_ARCHITECTURE.md` |
| `ICO-001`, `ICO-007`, `ICO-024`, `ICO-025`, `ICO-030`, `ICO-033` | `INVENTORY_COSTING_ARCHITECTURE.md` |
| `ACC-002` – `ACC-004`, `ACC-011`, `ACC-012`, `ACC-021` – `ACC-025`, `ACC-038` | `ACCOUNTING_ARCHITECTURE.md` |
| `WHS-002`, `WHS-010` – `WHS-018`, `WHS-022`, `WHS-072` | `WAREHOUSE_ARCHITECTURE.md` |
| `SMA-032` – `SMA-034`, `SMA-036`, `SMA-043` | `STATE_MACHINE_ARCHITECTURE.md` |
| `E-020`, `E-025`, `E-029`, `E-030`, `E-066`, `INV-25.1`, `INV-25.2`, `INV-29.1` – `INV-29.3`, `INV-66.1` – `INV-66.3`, `DM-001`, `DM-035`, `DM-045` – `DM-050`, `DM-077` | `DOMAIN_MODEL.md` |
| `SYS-010`, `SYS-016`, `SYS-021`, `SYS-024`, `SYS-026`, `SYS-029`, `SYS-031`, `SYS-034`, `SYS-043`, `SYS-047`, `SYS-087`, `SYS-090`, `SYS-102`, `SYS-104`, `CP-8`, `CP-9` | `SYSTEM_ARCHITECTURE.md` |
| `DB-001` – `DB-003`, `DB-005`, `DB-036`, `DB-067`, `DB-068`, `DB-077` | `DATABASE_ARCHITECTURE.md` |
| `PRM-005`, `PRM-006`, `PRM-008`, `PRM-012`, `PRM-048`, `PRM-049`, `PRM-051`, `PRM-052`, `PRM-064`, `AGV-001`, `AGV-021` | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `AUD-004`, `AUD-009`, `AUD-042` | `AUDIT_ARCHITECTURE.md` |
| `NOT-013` | `NOTIFICATION_ARCHITECTURE.md` |
| `DOC-005`, `DOC-057` | `MASTER_DOCUMENTATION_INDEX.md` |

## 21.3 Corrections carried forward

| Correction | Record |
|---|---|
| **Landed cost withdrawn** — Procurement no longer owns landed cost build-up (`PRD-121`) | `PRC-044` |
| **`PRD-042`'s cost-component table amended** — landed cost removed | `PRC-044` |
| **`PRD §11.8` settled against specific identification** | `PRC-045` |
| **`SMA-035` withdrawn** — an advance is a balance, not a payment state | `PRC-050` |
| **`E-025` not extended** — no sourcing terms, per-product pricing, or catalogue | `PRC-008` |
| **`E-030` mandatory and parentless-capable; `E-029` optional** | `PRC-003` |

---

# 22. Version History

| Version | Date | Change |
|---|---|---|
| **1.1.0** | **2026-08-09** | **Warranty-claim consumer contracts propagated — `PRC-063` – `PRC-066` added; no existing rule changed.** §13 described the supplier warranty claim only as it enters from a **return-QC `Supplier Claim` disposition**. `BD-427` confirmed a **second entry path from a warranty case**, and a reaction this document did not carry: **Procurement makes the claim visible against the supplier and accumulates that supplier's warranty/claim history.** §13.1 records that, plus the three negatives — **submission moves no money, posting, stock or inventory; acceptance creates no assumed recovery; actual recovery is a separate later fact recorded by its owning module.** **`PRC-058` – `PRC-062` are untouched.** **No state machine, purchase, payable, receivable, posting, movement, scoring or penalty was created**, and the claim remains part of the warranty case — **not `SM-14`** (`EVA-023`) |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §18 Purchase & Supplier (`BD-293` – `BD-303`) with the reconciliations at `OM §9.9` (`BR-105` – `BR-115`), `PRD §29` (`PRD-121` – `PRD-124`), `SMA §19.5` (`SMA-032` – `SMA-034`, `SMA-036`) and `DOMAIN_MODEL.md` `DM-045` – `DM-050`. **63 rules (`PRC-000` – `PRC-062`), all traceable; no business rule, entity, state machine or lifecycle introduced.** `PRC-000` records the ownership boundary; **`PRC-036` records the goods-receipt split with Warehouse — Procurement owns the record and the acceptance decision, Warehouse owns the physical act.** **`PRC-001` records that multi-level approval, tendering, RFQ comparison and supplier scoring were excluded from §18 by the business and are not reconstructed.** **`GAP-080`'s referral loop between `SMA-032` and `RET §2.2` is recorded, not resolved.** Ten open items carried; none closed |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies procurement business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
