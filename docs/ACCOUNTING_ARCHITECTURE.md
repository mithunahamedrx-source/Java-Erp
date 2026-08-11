# Accounting Architecture

**Owner:** Trioloo Technology · **Module:** Accounting · **Status:** Canonical
**Version:** 1.10.1 · **Ratified:** 2026-08-08 · **Rule prefix:** `ACC-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §19 (`BD-304` – `BD-315`) and §27 (`BD-398` – `BD-404`), with the reconciliation recorded at [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §9.9A, §9.9B, §9.10, §9.11 (`BR-105` – `BR-134`), [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) v2.8.0 – v3.8.0 (`DM-051` – `DM-058`, `DM-078`, `DM-079`), and [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §11.1, §23, §24.

**References, never duplicated:** `DOMAIN_MODEL.md` `E-068`, `E-083`, `E-084`, `E-085` · [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) `DB-001` – `DB-003`, `DB-022`, `DB-077` · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) `SM-5`, `SM-6`, `SM-10`, `SM-20` · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) `PRD-121` – `PRD-124` · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`EVENT_ARCHITECTURE.md`](EVENT_ARCHITECTURE.md).

## ⚠ Ownership boundary with `PAYMENT_ARCHITECTURE.md` ✅

> **ACC-000 — Accounting owns *what a business event posts*. Payment owns *how an obligation is operationally reconciled*.** The line is already drawn by a ratified rule:
>
> > **`BR-121` — A settlement statement is evidence, not a posting source. Documents evidence obligations; business events create them.**

| | `ACCOUNTING_ARCHITECTURE.md` — `ACC-` | `PAYMENT_ARCHITECTURE.md` ✅ |
|---|---|---|
| **Owns** | The **posting model** · recognition policy · Financial Accounts · ledger and derived balances · advances · Fund Transfer · period close · financial statements | **Operational reconciliation** — receivable lifecycle, collection modes, COD remittance matching, settlement statement matching, **variance and dispute handling**, refund execution |
| **Answers** | *"What does this event post, and to which account?"* | *"Did the money arrive, does it match, and what do we do when it does not?"* |

**`DOC-005` is satisfied because these are different questions.** This document states the **accounting consequence** of each payment event and **does not pre-empt** the operational reconciliation model. **No `BR-` rule is restated here; each is referenced.**

> **Fund Transfer ownership is assigned here** and was not previously registered. Recorded as `DOC-056`.

> **This document consolidates confirmed decisions only.** No business rule, entity or state machine is introduced. Nothing is reconciled by assumption. Unresolved items are carried in §16.

> Contains no code, schema, API contract, or user interface specification. Statutory statement formats, tax computation and filing remain **out of scope** (`SYS §11.1`).

---

# 1. Purpose

To define what the business's money did, in a form that stays true.

Two ratified decisions shape everything below, and both were reached because the alternative would have made history unreliable rather than merely inconvenient:

> **`DB-001` — Balances are derived from movements, never stored.**
> **`DB-003` — The past does not move.**

**Every rule in this document is downstream of those two.** Revenue is recognised at an event and never re-recognised; a write-off does not reverse a sale; an allocation is performed once and never restated; a failed transfer is a third movement rather than an undo. **In each case the design chose a forward-only correction over an edit**, and the accounting model is coherent because that choice was made consistently.

---

# 2. Scope

## 2.1 In scope

The posting model and double-entry discipline · Financial Accounts · derived balances · revenue recognition · receivables and their two-part clearing · payables · advances on both sides · expenses and their categories · write-offs and bad debt · inventory acquisition cost and its immutability · marketplace settlement accounting · Fund Transfers, Funds In Transit and transfer fees · Trade-In Credit as a liability · period close and financial reporting scope.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Operational reconciliation, variance, dispute, refund execution** | `PAYMENT_ARCHITECTURE.md` ✅ (`ACC-000`) |
| **Stock quantity, valuation method execution, movement ledger** | `INVENTORY_ARCHITECTURE.md` ✅ |
| **Order lifecycle and the events that trigger recognition** | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| **Supplier master, purchase orders, goods receipt** | `PROCUREMENT_ARCHITECTURE.md` ✅ |
| Return, exchange and refund **lifecycles** | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| Marketplace claim lifecycle | `OM §9.11`, `E-069`, `SM-14` |
| Trade-In case and component lifecycles | [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) — `SM-18`, `SM-19`, **`E-081` and `E-082`** |

*Corrected 2026-08-09. This row read ‘`E-081` – `E-083`’, **disclaiming `E-083` Trade-In Credit — which this document owns** (`ACC-039`, `ACC-040`, and `E-083`’s own ownership line). It also named machines and entities rather than a document, because **no owning module was registered at the time** (`DOC-063`). The scope boundary is otherwise unchanged.*
| **Payroll processing** | `HR_PAYROLL_ARCHITECTURE.md` ⬜ — deferred (`SYS-093`) |
| Report definitions and the semantic layer | `REPORTING_ARCHITECTURE.md` ✅ |
| Authorisation of financial actions | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |

---

# 3. Architectural Principles

## 3.1 P1 — Movements are the record; balances are computed

> **ACC-001 — No balance is stored. Every balance is derived from its movements** (`DB-001`).

This applies without exception to **Financial Accounts** (§4), **advance balances** (§8), **Trade-In Credit** (§11.4) and **receivables** (§6.2).

**A stored balance is a second copy of a figure that already exists**, and `CP-12` exists to prevent exactly that.

## 3.2 P2 — Posted records are immutable; corrections move forward

> **ACC-002 — A posted financial record is never edited. Corrections are made by linked adjustment or compensating entry** (`DB-002`, `DB-077`, `BR-118`).

**Immutability attaches at completion** (`DB-077`). Before posting a record may change; after posting it may only be answered by another record.

## 3.3 P3 — Recognition follows the event, never the intent

> **ACC-003 — A financial record is created when the business event occurs, not when it is requested, approved or documented** (`BR-116`, `BR-109`, `DM-055`).

**Three domains state the same rule independently:**

| Event | Recognition point |
|---|---|
| Revenue | **Successful delivery** (`BR-116`) |
| Payable | **Acceptance of goods** (`BR-109`) |
| Refund | **When money actually returns** (`DM-055`) |

**A refund can be requested, reviewed, approved and have its amount confirmed while remaining entirely absent from the accounts** — correct, because none of those acts moves money (`SMA-055`).

## 3.4 P4 — Documents evidence obligations; events create them

> **ACC-004 — A settlement statement or supplier invoice is evidence used for reconciliation. It is never a posting source** (`BR-121`, `BD-299`).

**On both sides of the business the same discipline holds.** This is the rule that makes `ACC-000`'s boundary workable.

## 3.5 P5 — The user states a business fact; the system computes the treatment

> **ACC-005 — Where a transaction's accounting treatment depends on its business nature, the user selects the business classification and the ERP derives the posting** (`BD-398`, `SYS-106`).

**The user is never asked an accounting question.** They state *"this is an owner drawing"*; the equity treatment follows.

**`CP-8` exactly: the method is judgement, the arithmetic is enforced.**

---

# 4. Financial Accounts

> **ACC-006 — `E-068` Financial Account holds real, named instances — not generic types** (`BD-315`, `DM-052` as corrected).

| Property | |
|---|---|
| **Instances** | Unlimited, named — *"City Bank Current"*, *"bKash Merchant"*, *"Shop Cash"* |
| **Type and designation** | **Orthogonal attributes** — a type does not imply a designation |
| **Lifecycle** | `SYS §7.1` master record |
| **Balance** | **Derived from movements** (`ACC-001`) |

## 4.1 Collection Source and Financial Account are independent

> **ACC-007 — Every collection and payment records two independent references: Collection Source and Financial Account** (`BD-315`, `DM-058`).

**Neither derives from the other**, and collapsing them would lose real information — *how the money was taken* is a different fact from *where it landed*.

**This is the same independence recorded three times elsewhere**: conversation channel versus order channel (`BD-327`), warranty intake channel versus order channel (`BD-329`), return method versus authorization source (`RET-010`).

## 4.2 No chart-of-accounts hierarchy

> **ACC-008 — Expense categories are versioned reference data. No chart-of-accounts hierarchy is required** (`BD-309`, `DM-057`, `SYS-021`, `CP-9`).

New categories are added **without structural change**. **`Marketplace Charges` and `Courier Charges` are ordinary categories, not a parallel mechanism** — one expense model serves both settlement deductions and directly paid bills.

**Versioning matters because `DB-022` requires configuration to be effective-dated:** a category renamed today must not rewrite how a past expense was classified.

## 4.3 Funds In Transit

> **ACC-009 — `E-085` Funds In Transit is a system-managed instance of `E-068`, not a new concept** (`BD-403`).

| | |
|---|---|
| **Operated by** | **Nobody** — the business does not transact against it |
| **Reached by** | **Only methods that can be delayed** (`SMA-077`) |
| **Balance** | Derived from movements, like any other Financial Account |

See §10.3 for why it earns its cost.

---

# 5. Ledger & Posting Model

## 5.1 Double entry

> **ACC-010 — Every posting balances. A movement that changes one account changes at least one other** (`DB-001`).

**This is why a delayed Fund Transfer requires `E-085`** (§10.3): the source debit and destination credit occur at different times, so the first needs a counterpart that is neither account.

## 5.2 Posting ownership

> **ACC-011 — The module that owns the business event owns the decision to post; Accounting owns what the posting is** (`SYS-004`, `SYS-005`, `SYS-015`).

| Event | Owned by | Posts |
|---|---|---|
| Successful delivery | Order Management | **Revenue and receivable, gross** |
| Goods accepted | Procurement | **Payable, at invoice price** |
| Money collected | Payment | Receivable reduced, Financial Account increased |
| Settlement received | Payment | Receivable cleared in **two parts** (§6.2) |
| Refund paid | Payment | **At `PAID`, never before** |
| Fund transfer | **Accounting** | Per Transfer Type (§10) |
| Trade-In accepted — **`EVT-096`** | Trade-In ([`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md)) | **Credit liability** (§11.4) **and component cost basis** ([`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) §4) |

*Corrected 2026-08-09: this row pointed both consequences at §11.4, **which covers Trade-In Credit only**. **Component cost is Inventory Costing's** (`ICO-011` – `ICO-017`). ⚠ **Whether the component cost basis posts at acceptance or at allocation completion is not settled** — `IVN-030` creates inventory only after allocation — and is recorded at `EVENT_ARCHITECTURE.md` `EVT-096`, not resolved here.*

**No module posts on behalf of another** (`SYS-015`).

## 5.3 Immutable financial history

> **ACC-012 — Financial history is retained permanently and never deleted, automatically or manually** (`BD-338`, `SYS-024`, `DB-028`).

**Archival for performance is permitted; disposal is not.** Archived records must remain **accessible and recoverable when required** — and **real-time searchability of archived data is expressly not a business rule** (`BD-338` as refined).

**`AUD-006` holds without qualification** — audit records are never edited or deleted by any actor at any authority level, because `BD-341` established there is no removal capability to bound.



---

# 5A. Authorised Accounting Adjustment — resolving `GAP-117`

**Source:** `BD-447`, `BD-455`, `BD-456`. **Post-Freeze amendment under `DOC-067`.** **This is the minimum mechanism the confirmed requirements need, and deliberately nothing more.**

## 5A.1 What was missing

**`GAP-117` recorded that every posting in this architecture is driven by a business event owned by another module** — **`ACC-011`** — and that **no mechanism existed for a posting with no cash movement and no physical trigger.** **Three confirmed needs depend on it**: **advance → accepted company expense**, **advance → salary recovery**, **advance → authorised write-off**. The **Journal Voucher** document identity (`ACC-056`) depends on it too.

## 5A.2 The contract

> **ACC-077 — `E-089` Authorised Accounting Adjustment is a posting that arises from an authorised business decision rather than from a movement of money. It cannot exist without that decision** (`BD-447`, `ACC-003`, `ACC-011`).

> **ACC-078 — Every adjustment is linked to the source business decision that authorised it. An adjustment with no source decision is not representable** (`ACC-011`, `AUD-004`).

⚠ **This is what keeps it from becoming a free-form journal system.** **There is no unrestricted manual ledger entry, no arbitrary debit/credit screen, and no adjustment that a user may originate on its own.** **The owning capability decides; Accounting posts** — exactly `ACC-011`, unchanged.

> **ACC-079 — An adjustment never fabricates a cash or bank movement. No Financial Account balance changes because an adjustment was made** (`ACC-003`, `PAY-003`, `ACC-001`).

> **ACC-080 — An adjustment is immutable. Corrections and reversals are new linked adjustments, never edits** (`ACC-002`, `ACC-031`, `DB-002`, `DB-077`, `PRC-006`).

> **ACC-081 — Every adjustment carries its authorising actor, timestamp and reason, and is auditable** (`AUD-012`, `AUD-042`, `PRM-004`). **Permission is held by the owning capability's rule, not by a generic “post a journal” right** — for advance write-off that is **owner or administrator** (`ACC-067`, `BD-110`); for accepted expense it is the **permissioned acceptance authority** (`ACC-066`, `BD-455`).

> **ACC-082 — Printing a Journal Voucher renders an adjustment that already exists. It never creates one** (`ACC-056`, `BR-121`, `ACC-003`).

## 5A.3 What it may post — and the one thing left open

> **ACC-083 — An adjustment moves value between positions the architecture already defines. It creates no new account, category or hierarchy** (`ACC-008`, `CP-9`).

| Confirmed need | From | To |
|---|---|---|
| **Accepted expense** | Employee advance position | **An existing expense category** — configurable reference data (`ACC-008`, `BD-309`) |
| **Write-off** | Employee advance position | **A loss**, on the same basis `ACC-029` recognises one for scrap |
| **Salary recovery** | Employee advance position | ⚠ **The payroll counterpart — not determinable until HR & Payroll exists** |

> ⚠ **ACC-084 — The salary-recovery route's accounting counterpart is deliberately NOT specified here.** **The generic mechanism above is sufficient and ratified; the payroll-originating trigger and its counterpart position are HR & Payroll's** (`SYS-093`, `BD-450`). **`BD-450`'s reconciliation obligation stands: the payroll deduction and the advance settlement allocations must reconcile to the same figure.** **The route is NOT implemented until that stage** and must not be presented as though it were.

> ⚠ **ACC-085 — `E-089` exists for adjustments the architecture has confirmed a need for. It is not a general licence to post.** **A new use requires its own business decision and its own rule** (`DOC-023`, `DOC-024`).

---

# 6. Revenue & Receivables

## 6.1 Revenue at delivery

> **ACC-013 — Revenue is recognised at successful delivery, uniformly across every channel. Cash receipt settles the receivable and never changes the recognition date** (`BR-116`, `BD-304`).

**Revenue is never recognised twice** (`BR-120`). A batch payment **reduces the receivable and increases cash or bank — it posts no revenue.**

> **`BR-117` — `BR-044` is a consequence, not an enforced rule.** Goods never delivered created no revenue and no receivable, so **a failed delivery cannot leave a phantom receivable behind.** The error it guarded against is unrepresentable.

## 6.2 The receivable clears in two parts

> **ACC-014 — The receivable is created gross and clears by cash received *plus* deductions recorded as expense — never by cash alone** (`BR-123`, `DM-054`).

**This is why reconciliation is per-order rather than aggregate** (`BR-129`): each deduction must be attributable to the order whose receivable it discharges. **Aggregate matching cannot clear individual receivables and would leave a residue on every marketplace order.** `INV-42.1`'s line-by-line requirement is **necessary, not aspirational.**

## 6.3 Counterparty

> **ACC-015 — The receivable counterparty varies by fulfilment path, and on a marketplace it is a *specific seller account*** (`BR-119`, `BR-128`).

**Seven marketplace seller accounts are seven independent counterparties**, each with its own settlement stream. Reconciliation is **at minimum per-shop**, because the statements arrive that way.

## 6.4 A return adjusts revenue forward

> **ACC-016 — A return reverses recognised revenue by linked adjustment, never by editing the original sale** (`BR-118`, `ACC-002`).

## 6.5 Write-off does not reverse revenue

> **ACC-017 — An uncollectable amount posts as Bad Debt Expense. The sale remains recognised** (`BD-311`, `DM-056`).

**Reversing the sale would make historical revenue move, violating `DB-003`.**

**This precedent is load-bearing beyond bad debt** — it is cited at `GAP-093` as pointing toward forward recognition when an advance-exchange replacement is converted into a sale.

---

# 7. Expenses

> **ACC-018 — Channel deductions are expenses. Revenue is never netted** (`BR-122`, `DM-054`).

> **ACC-019 — Deduction detail is captured; accounting is aggregated** (`BR-124`, `BD-306`). Commission, delivery charge, payment fee, campaign and other deductions are recorded from the official statement and combined into **`Marketplace Charges`** and **`Courier Charges`**.

> **ACC-020 — Revenue and deduction amounts have different authoritative sources** (`BR-125`). Trioloo is authoritative for what it sold; **the marketplace is authoritative for what it deducted**, mirrored under `SYS-010` and never computed locally.

---

# 8. Advances

> **ACC-021 — Advances are neither revenue nor expense, and never move a recognition point** (`BR-127`, `DM-053`, `BD-312`).

| Side | Held as | Applied at |
|---|---|---|
| **Customer advance** — money received before delivery | An advance balance | **Delivery** (`ACC-013`) |
| **Supplier advance** — money paid before goods arrive | An advance balance | **Acceptance** (`BR-109`) |

**A symmetric position on both sides**, closing `GAP-078`. Application is **automatic at the event that creates the obligation the advance prepaid** — it is not a judgement.

> **ACC-059 — Automatic application belongs to advances that prepay an *identified* obligation. It never fires on an advance that prepays none** (`BD-448`, `PAY-044`, `PAY-060`).
>
> **A customer advance prepays a specific order; a supplier advance prepays a specific acceptance.** ⚠ **An employee Advance Requisition prepays nothing** — `BD-448` states it directly: *the original purpose of the advance does not by itself determine the final settlement route.* **Its settlement is a judgement on every route** (`ACC-063`).
>
> ✅ **`PAY-044` and `PAY-060` are scoped, not weakened.** Customer and supplier behaviour is **unchanged**; their trigger simply has no counterpart on the employee side. **A third advance side now exists and it is not symmetric with the other two** — see §8A.



---

# 8A. Advance / Requisition — the employee side

**Source:** `BD-448` – `BD-457`, Advance / Requisition Business Discovery, complete 2026-08-09. **Post-Freeze amendment under `DOC-067`.**

## 8A.1 Ownership, tested rather than assumed

> **ACC-060 — Advance / Requisition is an Accounting-owned capability. It is not owned by HR & Payroll merely because the counterparty is an employee** (`BD-448`, `DOC-005`).

**Tested against `DOC-005` and the two boundary rules that already divide this space:**

| Owns | Module | Why |
|---|---|---|
| The requisition, its authorisation, the employee advance position, settlement allocation, accepted-expense and write-off settlement, the derived positions and the ledger | **Accounting** | **`ACC-021` already owns advances**; **`ACC-011` — the module owning the business event owns the decision to post**, and every decision here is a posting decision |
| **Actual cash / bank / MFS disbursement and return movements** | **Payment** | **`PAY-000` — Payment owns how an obligation is operationally reconciled**, and **`PAY-003`** creates the record when money moves |
| **Salary calculation and the salary-deduction occurrence** | **HR & Payroll** *(next stage)* | Payroll computes the deduction; **the allocation to specific requisitions stays here** (`BD-450`) |

> **ACC-061 — No new top-level module is created.** `CP-9`. The capability sits inside Accounting because **the position it maintains is an accounting position**, and the only parts that are not — the money movements and the payroll occurrence — **already have owners.**

## 8A.2 The model

> **ACC-062 — Three entities carry the capability** (`E-086`, `E-087`, `E-088`), **and no balance is stored** (`ACC-001`, `DB-001`).

| Entity | What it is |
|---|---|
| **`E-086` Advance Requisition** | The request and its authorisation — requested amount, authorised amount, purpose, requester, authoriser, timestamps |
| **`E-087` Advance Settlement** | **One settlement movement allocated to one requisition**, by method |
| **`E-088` Advance Expense Claim** | A submitted bill — **claimed, accepted and rejected amounts held separately** |

**Money movements are not new entities.** A disbursement and a returned amount are **`E-041` Payment Transactions** (§8A.5).

## 8A.3 The five settlement routes

> **ACC-063 — Five settlement routes exist, every one of them a judgement, and none automatic** (`BD-448`, `BD-456`).

| Route | Money moves? | Record |
|---|---|---|
| **Accepted expense** | **No** — reclassification | `E-088` accepted portion → `E-087` → **`E-089` adjustment** |
| **Cash returned** | **Yes** | `E-041` → `E-087` |
| **Bank / MFS returned** | **Yes** | `E-041` → `E-087` |
| **Salary deduction** | **No** | `E-087` → **`E-089`**, on a payroll occurrence — **HR & Payroll, next stage** |
| **Write-off** | **No** | `E-087` → **`E-089`**, owner/administrator only |

> **ACC-064 — Every settlement is allocated to a specific Advance Requisition. No settlement is applied to an anonymous employee total where the requisition can be identified** (`BD-449`, `BD-450`, `PAY-004`, `INV-42.1`).

> **ACC-065 — No FIFO, oldest-first, newest-first or proportional allocation exists. Where the requisition cannot be identified, the receipt remains identifiable for review and no requisition is silently changed** (`BD-449`, `BD-450`, `PAY-035`, `E-056`, `SYS-034`).

> **ACC-066 — A submitted bill may be fully accepted, partially accepted or rejected. The unaccepted amount remains outstanding and never becomes company expense** (`BD-455`, `ACC-021`).
>
> ✅ **`PRC-030` and `PRC-035` are the precedent** — receiving is line-level and *acceptance governs*; a supplier invoice for more than was accepted **does not raise the payable**. **A bill for more than was accepted does not raise the expense.**
>
> ⚠ **This is not a general expense-approval workflow.** **`BD-309` stands unamended** — it answered how ordinary expenses are recorded; **this decides whether money already given to an employee is recognised as expenditure.** Different subject (`BD-455`).

> **ACC-067 — Write-off is an explicit decision by an authorised owner or administrator, may be full or partial, and is never automatic** (`BD-456`, `BD-110`). **An outstanding advance never becomes an expense or loss because employment ended, recovery failed or time passed** (`ACC-021`).

> ⚠ **ACC-068 — The authority model inside this capability is deliberately asymmetric** (`BD-452`, `BD-455`, `BD-456`): **authorising a requisition and accepting a bill are permission-controlled and explicitly not owner-only**, while **write-off is owner or administrator only**. **The first two decide how company money is used; the third decides it is gone.**

## 8A.4 Derived positions — two, not one

> **ACC-069 — An Advance Requisition carries two independent derived positions, and neither is stored** (`BD-454`, `DB-001`, `ACC-001`):
>
> | Position | Derived from |
> |---|---|
> | **Employee Outstanding** | disbursements **less** settlements, per requisition |
> | **Remaining Drawable** | authorised amount **less** disbursed **less** any explicitly closed authority |

> **ACC-070 — Completion is a derived condition, not a state: a requisition is complete when Remaining Drawable is zero AND Employee Outstanding is zero** (`BD-454`, `SM-21`).

> **ACC-071 — The employee-level position is the sum of the per-requisition positions and is never independently editable** (`BD-448`, `BD-449`).

## 8A.5 The ceiling

> **ACC-072 — The Authorised Amount is a hard ceiling. Total disbursement under one requisition may never exceed it** (`BD-453`).

✅ **This is enforcement, not judgement, and `CP-8` supports it.** **`BD-402`'s test decides which side a rule falls on: the system enforces where identity is deterministic and defers where it must infer.** **The authorised amount and the sum of disbursements are both deterministic** — exceeding an authorisation is **wrong, not a matter of opinion.** **`BR-040` is the direct precedent**: a refund exceeding the amount received is a hard ceiling.

> **ACC-073 — An authorised amount is never increased after disbursement. Additional money requires a NEW requisition** (`BD-457`). **No amendment path is created for that case**, and historical Requested and Authorised amounts are never rewritten (`ACC-002`, `DB-002`).

## 8A.6 What is preserved and never overwritten

> **ACC-074 — Requested, Authorised and each Disbursement are distinct facts and are never collapsed or replaced by a cumulative figure** (`BD-451`, `BD-453`, `BR-038`, `DB-002`).

> **ACC-075 — A claim's submitted, accepted and rejected amounts are all retained, with the reviewing actor, time and a reason wherever an amount is rejected or only partly accepted** (`BD-455`, `AUD-012`, `AUD-042`).

> **ACC-076 — Evidence may be attached via `E-054` where available. It is supporting evidence, never a prerequisite** (`BD-455`, `BD-445`, `DLV-140`, `WAR-004`, `CP-8`).

---


---

# 8B. Employee Loan — 2026-08-10

**Source:** `BD-477`, `BD-479` – `BD-481`, `BD-484`, `BD-486` – `BD-489`. **Closes `GAP-123`.**

> **ACC-086 — Employee Loan is an Accounting-owned capability. It is not owned by HR & Payroll merely because the counterparty is an employee** (`DOC-005`, `BD-484` §1).
>
> ✅ **The same test `ACC-060` applied to Advance / Requisition, applied again and reaching the same answer**: **the position it maintains is an accounting position — an employee receivable** — **and the parts that are not already have owners.**
>
> | Part | Owner |
> |---|---|
> | **The receivable position and its repayment expectation** | **Accounting** — here |
> | **Cash / Bank / MFS movements** | **Payment** (`PAY-094` – `PAY-097`) |
> | **The payroll recovery occurrence** | **HR & Payroll** (`HRP-046`) |
>
> ⚠ **Employee Loan and Advance / Requisition remain SEPARATE capabilities** (`BD-484` §1, `BD-488` §10) **that share governance rules, not identity.** **Reusing Advance authorisation would have widened loan authority to every holder of that permission** — **`BD-452` permits Advance self-authorisation by any permissioned user, while `BD-484` §2 binds loans to Owner/Administrator.**

> **ACC-087 — Two entities carry the capability** — **`E-098` Employee Loan** and **`E-099` Employee Loan Settlement** — **and no balance is stored** (`ACC-001`, `DB-001`).

> **ACC-088 — The outstanding balance is derived from four terms and is never manually edited** (`BD-487` §3, `BD-488` §6):
>
> **Original Principal − Confirmed Payroll Recoveries − Confirmed Outside-Payroll Repayments − Confirmed Authorised Write-Offs.**
>
> ✅ **Interest-free** (`BD-487`) — **so there is no interest position, no principal-versus-interest allocation, and no income leg.** ⚠ **No interest ledger, schedule, accrual or allocation rule is created, and a fee or penalty is never read as interest by another name** (`BD-487` §7, §8).

> **ACC-089 — Completion is a computed condition over the derived balance, and the loan has no terminal state** (`BD-479` §7, `BD-486` §4, `ACC-070`'s discipline).
>
> ⚠ **Never marked settled because the schedule ended, nor left open at zero.**

> **ACC-090 — Loan write-off follows the same governance as `ACC-067` while the capabilities stay separate** (`BD-488` §2).
>
> **Owner or Administrator only · full or partial · explicit · attributable · never automatic.** ⚠ **Never triggered by employment ending, late or missed repayment, failed recovery, the schedule ending, age, or a belief that collection may be difficult** (`BD-488` §3, `ACC-021`'s discipline).
>
> 🔴 **A write-off never fabricates a cash movement** (`BD-488` §9). **`E-089` Authorised Accounting Adjustment serves it unmodified** — **no new mechanism is required.**

> **ACC-091 — A pause or reduction is not a waiver, and only the outstanding balance distinguishes them** (`BD-480`, `PRM-073`).
>
> **A waiver extinguishes; a pause leaves the balance fully outstanding and defers recovery.** ⚠ **The authority is identical for both, so authority does not tell them apart, and at the payroll line both appear as a recovery lower than expected.** ✅ **`BD-480` §5's retention of expected, actual and difference is what keeps a deferral from being recorded as a forgiveness.**

> **ACC-092 — Every settlement is allocated to a specific loan** (`BD-486` §5, `ACC-064`'s discipline). ⚠ **No FIFO, oldest-first, proportional distribution or anonymous employee-level balance**, and **split allocations sum exactly to the amount applied** (`DB-039`).

---

# 8C. Outstanding Salary Payable — 2026-08-10

**Source:** `BD-476`, `BD-482`, `BD-490` – `BD-492`. **Closes `GAP-124`.**

> **ACC-093 — Outstanding Salary Payable is an Accounting-owned position, established by payroll finalisation and settled by confirmed payment movements** (`DOC-005`, `BD-476`).
>
> **`Outstanding Salary Payable = Finalised Net Salary − Confirmed Salary Payment movements`.**
>
> ✅ **Derived, never stored, never editable** (`ACC-001`, `DB-001`). **The same three-party shape as `ACC-086`**: **Accounting holds the position, HR & Payroll establishes it** (`HRP-051`), **Payment moves the money** (`PAY-091` – `PAY-093`).

> **ACC-094 — Finalisation and payment are separate facts, and partial or split payment is supported** (`BD-476`).
>
> ⚠ **A finalised run creates an obligation, not a payment.** ✅ **`ACC-013`'s event-versus-cash separation, applied to salary.**

> **ACC-095 — The position is visible, not a trigger** (`BD-476`, `BD-459`, `BD-465`). **It initiates no payment; payment is an explicit act.**

> **ACC-096 — The position is available to Salary Payment, Final Settlement, reporting and later correction, and is duplicated by none of them** (`SYS-027`, `BD-490` §2, `BD-492` §12).

---

# 8D. `GAP-119` — the Advance salary-recovery route, CLOSED 2026-08-10

**`ACC-084` recorded that the salary-recovery counterpart of an Advance settlement could not be specified without HR & Payroll.** ✅ **It now can.**

| Condition | Satisfied by |
|---|---|
| **Authoritative finalised salary payable** | **`ACC-093`** |
| **Payroll-side AR recovery occurrence** | **`HRP-042`** |
| **Specific AR allocations** | **`HRP-043`, `ACC-064`, `ACC-065`** |
| **Accounting-side settlement counterpart** | **`E-087` Advance Settlement, unchanged** |
| **Cross-module reconciliation to the same amount** | **`HRP-045`, `BD-450`** |
| **No duplicate advance balance in Payroll** | **`HRP-042`, `INV-94.4`, `SYS-027`** |

> **ACC-097 — The salary-deduction settlement route is complete. All five Advance settlement routes are now specified** (`ACC-063`, `ACC-084` superseded in effect).
>
> ✅ **`E-089` posts the non-cash recovery against the requisition; the payroll deduction and the Advance allocation reconcile to the same figure.** ⚠ **No new mechanism was required** — **exactly as `BD-479` §6 anticipated.**


# 9. Inventory Cost

**Stock quantity and valuation execution are owned by `INVENTORY_ARCHITECTURE.md` ✅.** This section states the accounting facts they consume.

> **ACC-022 — Product cost is the supplier invoice price. There is no landed cost allocation** (`PRD-121`, `BD-297`). Transport, freight, import duty and clearing are **period business expenses, not capitalised into inventory.** There is no allocation engine, no apportionment basis, **and no revaluation of stock when a freight invoice arrives late.**

> **ACC-023 — Inventory is valued at Weighted Average Cost** (`PRD-122`, `GAP-005` closed).

> **ACC-024 — Inventory acquisition cost is allocated once and is never retrospectively restated** (`SYS-102`).

**Two independent domains reached this separately** — Purchase (`ACC-022`) and Trade-In (`BD-390`, `BD-391`) — and the business supplied the priority behind it:

> **Inventory immutability is more important than early inventory availability.**

**A principle, not a rule about one process:** wherever *"make it available sooner"* competes with *"keep the cost correct"*, **correctness wins**, and the business accepts the resulting delay explicitly.

> **ACC-025 — Scrap posts an accounting loss, partial or full** (`BD-291`).

---

# 10. Fund Transfer

## 10.1 The invariant

> **ACC-026 — A Fund Transfer moves value between Financial Accounts the business controls and changes no balance outside them. A fee is a separate expense that happens alongside it** (`SYS-105`, `BD-399`).

**The original invariant was never broken.** The parked review held that MFS cash-out fees contradicted *"total business funds never change"*. **They do not — the fee was a second transaction being read as part of the first.**

| | Effect on total funds |
|---|---|
| **The transfer** | **None** — at every instant, including mid-flight |
| **The fee** | **Reduces them, as an expense** |

**The attribution needed correcting, not the rule.**

## 10.2 Transfer Type drives posting

> **ACC-027 — All financial account movements may be initiated from one workspace; the selected Transfer Type determines the accounting treatment automatically** (`BD-398`, `SYS-106`).

| Operationally | Accounting treatment |
|---|---|
| One workflow | **Internal Transfer** |
| One workflow | **Equity Transaction** — owner contribution or drawing |
| One workflow | **Marketplace Receivable Settlement** |

**Operational workflow does not imply accounting equivalence.**

| Treatment | Correct posting | The error it prevents |
|---|---|---|
| **Owner drawing** | **Reduces equity** | **Not an expense** — recording it as one understates profit. The most common error in owner-operated businesses |
| **Owner contribution** | **Increases equity** | **Not income** |
| **Marketplace settlement** | **Converts a receivable into cash** | **Not income** — `ACC-013` recognised the revenue at delivery; treating remittance as income **double-counts revenue** |

> **ACC-028 — Transfer Type is a required controlled vocabulary expressed in business language** (`SYS-043`, `SYS-106`).
>
> ⚠ **Mis-selection is the only remaining way to get this wrong, and it is silent.** An owner drawing recorded as an internal transfer overstates business funds with nothing visibly amiss. **If the vocabulary says *"Equity Withdrawal"* it has merely relocated the accounting knowledge into a dropdown**, and the error returns. Under `ACC-002` the fix is a **correcting entry, never an edit**.

**Supported internal movements:** the complete 3 × 3 matrix across **Cash, Bank and Wallet except `Cash → Cash`** (`BD-401`, `GAP-108`).

## 10.3 Funds In Transit

> **ACC-029 — Posting follows the movement of funds, never the request** (`BD-403`, `SMA-074`).

**A delayed transfer is two movements at two times.** A BEFTN transfer debits the source immediately and credits the destination a day later, so under `DB-001` those are **two movements with two timestamps** — and the source debit needs a counterpart that is neither account.

| Moment | Movement |
|---|---|
| Funds leave the source | **Source − X** · **Funds In Transit + X** |
| Funds reach the destination | **Funds In Transit − X** · **Destination + X** |

**`ACC-026` then holds at every instant, including mid-flight** — money in transit is still the business's money. **Without it, an in-flight transfer would make total funds appear to drop and recover, which is not what happened.**

**Why it earns its cost.** The simpler alternative — post nothing until completion — is rejected because **the bank has already debited the account.** Under that model the ERP shows money the business does not have for as long as the transfer takes: **the silent-disagreement-with-the-bank-statement failure `BD-399` identified as the thing to avoid.**

## 10.4 Failure

> **ACC-030 — A failed transfer posts a third movement returning the funds. Nothing is edited and nothing is reversed in place** (`SMA-075`).

`Source − X → In Transit + X`, then `In Transit − X → Source + X`. **`DB-002`, `DB-003` and `DB-077` are satisfied by construction**, because the model never reaches backwards. **The trail shows what actually happened: the money left and came back.**

> **ACC-031 — `Reversed` is not a state of a Fund Transfer.** A transfer that **completed** and is reversed days later genuinely completed (`DB-003`). **A reversal is a new, linked compensating transaction**, with `Reversed` carried as an overlay (`SMA-076`).

| | What happened |
|---|---|
| **`FAILED`** | The transfer **never completed** — a state |
| **`Reversed`** | The transfer **completed and was later undone** — an overlay plus a new transaction |

## 10.5 Transfer fees

> **ACC-032 — The fee is independent of the transfer in both dimensions: of the *amount* and of the *outcome*** (`BD-399`, `BD-404`).

| Dimension | Rule |
|---|---|
| **Amount** | **Never deducted from the transfer amount.** The transfer amount is what the user moved; netting would turn *"I moved 50,000"* into *"I moved 49,075"* — **neither what happened nor what anyone would later ask about** |
| **Outcome** | **A failed transfer does not determine the fee's fate.** If refunded, the refund is recorded; if retained, the expense stands |

> **ACC-033 — The ERP never assumes or calculates transfer fees or fee reversals. It records the actual outcome reported by the provider** (`SYS-104`, `BD-399`, `BD-404`).

**This is not only philosophical consistency.** MFS tariffs vary by **provider, amount band and method**, and they change. **A built-in fee calculator would be wrong within months and would then silently disagree with the bank statement.**

**`BD-404` is the limiting case:** whether a provider refunds a fee on a failed transfer is **generated by a third party and does not exist inside the business at all.** No design could compute it.

> **ACC-034 — The fee requires no lifecycle.** It is charged, and may later be credited back — **two postings.** Under `DB-001` its state is derived from its movements.

**The decisive test: the model matches the statement.** Whatever the provider actually did appears as a line, and **the ERP records lines — so it cannot disagree with the bank.**

---

# 11. Settlement & Liabilities

## 11.1 Marketplace settlement

> **ACC-035 — A settlement difference never posts automatically** (`BR-130`, `BD-323`). The ERP **computes the comparison** — arithmetic — and records differences as **reconciliation exceptions for review** (`E-056`). Any correction is a **linked adjustment**, never an edit.

**This sits exactly on the `CP-8` boundary.** Computing the comparison is correctness; **deciding what a difference *means* — a legitimate deduction, a marketplace error, a missing order, a claim worth raising — is judgement, and stays with a person.**

> **ACC-036 — Settlement capture has two methods and one treatment** (`BD-402`, `SYS-107`). Manual and API capture are **two ways of recording one business event**; **the recording method never changes the accounting treatment.**
>
> **Duplicate posting is prevented on deterministic identity and deferred on inferred identity** — external settlement reference where one exists, **business validation and user confirmation where none does.**

## 11.2 Marketplace refunds

> **ACC-037 — A marketplace refund reaches Trioloo as a settlement deduction, not as a cash payment** (`BR-126`, `BD-310`). The marketplace refunds the customer and recovers from a future settlement.

**This connects the two return paths to the accounts:** the marketplace-governed path settles **by deduction**, the direct path **by cash**.

## 11.3 Supplier settlement

> **ACC-038 — Supplier settlement resolves as Return, Exchange or Credit, with exchange primary** (`BR-112`, `BD-301`).

**Fourth of four independent statements of one commercial instinct** — *keep the value in goods; move money only when goods cannot resolve it* (`SMA-043`).

## 11.4 Trade-In Credit

> **ACC-039 — Trade-In Credit is a payment source, never a product discount** (`BD-392`, `INV-83.1`).

**Revenue is recognised at the full selling price**; the credit **reduces the amount payable, never the price**. The ERP records **New Sale Value · Trade-In Credit Applied · Additional Customer Payment · Remaining Credit** separately.

> **ACC-040 — Trade-In Credit is a non-cash liability that discharges only through a sale** (`BD-394`, `INV-83.2`). Not redeemable for cash and not withdrawable.

> **ACC-044 — Credit may be applied to an order in full or in part, and applying it reduces the remaining Amount Payable without reducing or rewriting the Order Total** (`BD-431`, `ACC-039`, `INV-83.1`).
>
> **Worked example** — Order Total 30,000 · Credit Applied 10,000 · **Remaining Payable 20,000**. **Revenue stands at the full selling price**; a partial application of 4,000 against 10,000 available leaves a **6,000 remaining balance**.

> **ACC-047 — Credit is applied before dispatch; at dispatch the receivable is created GROSS and the applied credit clears part of it as a non-cash clearing component** (`BD-433`, `PAY-015`, `PAY-064`). **The Order Total is untouched and revenue stands at the full selling price** (`ACC-039`).
>
> **Amended 2026-08-09.** *This rule briefly read “the obligation created at dispatch reflects the remaining payable”, which implied a net receivable. **The architecture decision preserves the gross model**; the rule is amended, not withdrawn (`DOC-021`).*
>
> **Sales Revenue 30,000 · gross receivable 30,000 · credit clearing 10,000 · outstanding cash 20,000.** **Nothing is netted at recognition** — `ACC-014`'s two-part clearing simply gains a third non-cash component.

> **ACC-048 — Accounting is the authoritative ledger for Trade-In Credit and validates available balance before an application is recorded** (`E-083`, `ACC-046`, `PAY-068`).
>
> **This module owns**: `E-083` · available-balance validation · the **authoritative** balance movement and consumption · the remaining balance. **Payment owns the operational application** — selecting, committing, enforcing Amount Payable, and coordinating the clearing (`PAY-068`). **Trade-In owns neither** (`TRD-001`).

> **ACC-049 — An application arrives as an explicit cross-module request and may be refused** (`SYS-006`, `SYS-032`, `PAY-069`). **Insufficient available balance is a normal refusal, not an error**, and **a request is never an event** (`EVA-002`).

> **ACC-050 — Accounting publishes the authoritative applied fact** — **`EVT-101 Accounting.TradeInCreditApplied`** — **because it owns `E-083`.** **The same shape as `EVT-039 Inventory.Reserved`**: a module receives a request, decides, and publishes the fact it owns.
>
> **The order of facts is now fixed**: credit **created** at agreement (`SMA-067`) → credit **applied** to the order, **before dispatch** → obligation and COD instruction raised, **both already net** → cash **settled** when money arrives (`ACC-045`).

> **ACC-045 — Credit application and payment settlement are separate financial facts** (`BD-431`, `PAY-001`). **Three moments, never collapsed**: credit **created** at agreement (`SMA-067`) · credit **applied** to an order · payment **settled** when money actually arrives. **Applying credit is not a receipt.**

> **ACC-046 — Credit availability, amount applied, remaining balance and the associated order must all be traceable** (`BD-431`). **The balance is derived from movements, never a stored figure overwritten on each use** (`DB-001`, `E-083`).

⚠ **Which module publishes a credit application is not determined by any source.** `E-083` and its balance are owned here, **but this document publishes no events** — the register carries no `Accounting.*` events — and **no `PAY-` rule mentions Trade-In**, while `PAY-000` gives Payment *how an obligation is operationally reconciled*. **Recorded as an open boundary; it is emphatically not Trade-In's** (`TRD-001`, `TRD-044`).

⚠ **What happens to applied credit when the sale is later cancelled, returned, refunded or reversed remains explicitly unresolved** (`BD-431`). **`INV-83.2` forbids cash redemption**, which is what makes the question hard rather than obvious. **No reinstatement, forfeiture, refund or expiry is inferred** (`DOC-024`).

**It is backed by an asset, which distinguishes it from every other credit type** — the same agreed value appears as **the liability owed** and as **the inventory acquisition cost allocated across components** (`ACC-024`). **Neither half makes sense alone**, which is what a discount treatment would have broken.

⚠ **Unexpiring credit is a permanent liability.** Under `BD-338` an unused balance persists indefinitely, so **outstanding Trade-In Credit must be reportable as a standing liability, because it will accumulate.**

## 11.5 Owner equity

> **ACC-041 — Owner contributions and drawings run through the same business Financial Accounts as normal operations, and post as equity** (`BD-401`, `ACC-027`).

**A consequence worth recording:** the bank balance therefore **reflects owner activity as well as operations.** *"What does the business hold"* and *"what has the owner taken"* are different questions, and only the second is answerable because owner movements are distinguishable at posting.

---

# 12. Reporting Scope

**Report definitions and the semantic layer are owned by `REPORTING_ARCHITECTURE.md` ✅. No figure is owned by reporting** (`DB-067`).

> **ACC-042 — The confirmed V1 report register is `SYS-087` – `SYS-092`**, including the Net Profit definition, the Supplier Ledger, and the period vocabulary.

> **ACC-043 — Statutory financial statements are out of V1 scope** (`SYS §11.1`).

⚠ **`GAP-082` records Net Profit period completeness as a business decision**, carried unresolved.

---

# 13. Entity References

| Entity | ID | Canonical definition |
|---|---|---|
| **Financial Account** | **`E-068`** | `DOMAIN_MODEL.md` |
| **Trade-In Credit** | **`E-083`** | `DOMAIN_MODEL.md` |
| **Fund Transfer** | **`E-084`** | `DOMAIN_MODEL.md` |
| **Funds In Transit** | **`E-085`** | `DOMAIN_MODEL.md` — a system-managed `E-068` instance |
| Receivable | `E-041` | `DOMAIN_MODEL.md` |
| Refund | `E-045` | `DOMAIN_MODEL.md` |
| Exception | `E-056` | `DOMAIN_MODEL.md` — settlement differences are a **type**, not a new entity |

**No entity is defined here.**

---

# 14. State Machine References

| Machine | Subject | Documented |
|---|---|---|
| **`SM-20`** | **Fund Transfer** | `STATE_MACHINE_ARCHITECTURE.md` §26.1 — **accounting consequences stated in §10** |
| `SM-6` | Marketplace Settlement | `SMA` — **externally authoritative** |
| `SM-5` | Payment | `SMA` — operational ownership `PAYMENT_ARCHITECTURE.md` ✅ |
| `SM-10` | Refund | `SMA §22.3` — **the accounting entry is created at `PAID`** (`ACC-003`) |

**No machine is defined here.**

---

# 15. Audit & Permission

| Requirement | Rule |
|---|---|
| **Every posting attributable to an Operational User Profile** | `AGV-001`, `AUD-004` |
| **Write-offs and adjustments carry a mandatory reason** | `BD-110`, `BD-111`, `AUD-042` |
| **Settlement differences recorded with reviewer and decision** | `ACC-035` |
| **Financial history permanently retained** | `ACC-012` |
| **No numeric authority bound on discount** | `PRM-052` — **and an override may never carry one** (`AGV-024`) |
| Financial actions authorised per `PRM-008` magnitude model | `PERMISSION_ARCHITECTURE.md` |

⚠ **`PRMU-8` remains open** — whether `PRM-008`'s remaining magnitude bounds (refund, write-off, stock adjustment, purchase order, credit limit) exist as **enforced numbers** or follow the discount pattern of *who decides, not how much*. `BD-110` and `BD-111` suggest the same shape but were not asked in those terms.

---


## Courier remittance closure — 2026-08-09

> **ACC-051 — Closing a courier remittance batch posts nothing. It records resolutions already decided and authorised elsewhere** (`BD-440`, `PAY-080`, `PAY-081`).

**Batch closure may never write off money, approve a courier deduction, change an expected amount, or manufacture an accounting treatment.** This is **`ACC-035` seen from the batch side** — *a settlement difference never posts automatically; the ERP computes the comparison and records differences as reconciliation exceptions for review.*

| Underlying act | Where it is decided | What Accounting sees |
|---|---|---|
| **Legitimate deduction accepted** | Permissioned Accounts user (`PAY-078`) | A **corrected expectation**, not a loss |
| **Unrecoverable shortfall** | **Owner or administrator** (`BD-110`, `PAY-079`) | A **write-off**, posted as a loss |
| **Amount recovered** | Courier pays (`SM-5`) | Ordinary settlement |

> ✅ **`ACC-004` and `BR-121` are unchanged and now doubly load-bearing.** A courier remittance statement is **evidence used for reconciliation, never a posting source** — and `BD-438` states the same from the business side: **a courier statement saying money was remitted is not the same fact as Trioloo confirming receipt.** **`ACC-013` is untouched**: revenue is recognised at delivery, and cash receipt settles the receivable without changing the recognition date.



## Receipt Voucher — 2026-08-09

**Source:** `BD-446`, answering `BD-135`. **Post-Freeze amendment under `DOC-067`.**

> **ACC-052 — A Receipt Voucher is an internal Accounting document representing an already-recorded receipt. It is not the customer-facing receipt** (`BD-446`, `PAY-082`).

> **ACC-053 — A Receipt Voucher never creates a financial transaction. The posting exists first; the voucher renders it** (`BD-446`, `ACC-003`, `PAY-003`, `BR-121`).

✅ **This settles the most dangerous item on the Document Surface Map, and it settles it in the direction the frozen model already required.** **`ACC-003` creates a financial record when the business event occurs — *“not when it is requested, approved or **documented**”*** — so **a voucher that posted would contradict the accounting model outright.** **`BR-121` says the same in one line: *documents evidence obligations; business events create them.***

> **ACC-054 — The four cash occurrences are never collapsed into one** (`BD-446`): **the customer paid the courier** · **the courier remitted to Trioloo** · **own delivery staff collected cash** · **Accounts received and posted the cash.** Each is a distinct fact under `PAY-001`, `PAY-070`, `DLV-096` and `ACC-003`, and **no document may merge them.**

✅ ~~⚠ Payment Voucher and Journal Voucher are NOT settled here.~~ **SETTLED 2026-08-09 by `BD-447`** — see below.

> **ACC-055 — A Payment Voucher is an internal Accounting document representing an already-recorded outgoing payment. It never independently creates a second payment or a duplicate ledger posting** (`BD-447`, `ACC-003`, `PAY-059`, `PAY-051`).

**The authoritative record already exists.** **`PAY-059` makes supplier payment a movement stream with the outstanding balance derived** (`DB-001`); `PAY-051` governs refunds; `ACC-002` makes corrections linked adjustments. **The voucher renders those records and adds nothing.**

> **ACC-056 — A Journal Voucher is the document representation of an authorised journal entry — a non-cash accounting adjustment or reclassification. It is not a printable view of an unrelated cash transaction, and printing it still never creates the posting** (`BD-447`, `ACC-003`, `BR-121`).

> **ACC-057 — AMENDED 2026-08-10. The authorised journal-entry mechanism the Journal Voucher represents NOW EXISTS: `E-089` Authorised Accounting Adjustment** (`ACC-077` – `ACC-085`, `GAP-117` resolved 2026-08-10).
>
> **The Journal Voucher renders `E-089`, and `E-089` cannot exist without a source business decision** — **which is what keeps it from being a free-form journal system.** ⚠ **Printing still creates no posting** (`ACC-056`, `PRN-001`).
>
> 🔴 **ORIGINAL RETAINED UNDER `DOC-009`, and it was STALE**: ~~*The authorised journal-entry mechanism the Journal Voucher represents DOES NOT EXIST in the frozen architecture. The document identity is recorded; the mechanism is not invented*~~ (`BD-447`, `GAP-117`, `DOC-023`). **It was true when written on 2026-08-09 and became false on 2026-08-10 when `GAP-117` was resolved** — **the propagation was missed at that time and is corrected here** (`DOC-021`).
>
> **Every posting in this architecture is driven by a business event owned by another module.** **`ACC-011` — *the module that owns the business event owns the decision to post*** — and `ACC-003` creates the record when that event occurs. **Revenue at delivery** (`ACC-013`), **payable at acceptance** (`PRC-002`), **transfer legs** (`ACC-030`), **scrap loss** (`ACC-029`), **returns by linked adjustment** (`ACC-016`), **reversals as new compensating transactions** (`ACC-031`) — **every one has an originating event outside Accounting.**
>
> **There is no manual journal entry anywhere: no entity, no state, no event, no permission, no rule.** `ACC-008` keeps the chart of accounts flat with **no posting rules per category**, and the Financial Account assessment recorded the model's own summary — ***“Nothing requires manual entry”***. **Until `GAP-117` is resolved, a Journal Voucher in V1 would be a document with nothing behind it.**

> **ACC-058 — Receipt Voucher, Payment Voucher and Journal Voucher are three distinct internal document identities and are never collapsed into one generic Voucher** (`BD-447`).

| Voucher | What it represents | Prior authoritative act |
|---|---|---|
| **Receipt** | Incoming money already recorded | **A money movement** (`ACC-052`) |
| **Payment** | Outgoing money already recorded | **A money movement** (`ACC-055`) |
| **Journal** | A non-cash adjustment or reclassification | **An authorised journal entry** — 🔴 **mechanism missing, `GAP-117`** |

✅ **They differ in *what* precedes them, never in *whether* something must. In all three, printing creates nothing** — `ACC-003` and `BR-121` unchanged.

⚠ **No adjustment category, account-selection rule, debit/credit mechanic, approval hierarchy, threshold, creator or approver rule, numbering scheme, correction/reversal rule, printing mandate or layout is created** — each was **explicitly prohibited** by `BD-447`.

⚠ **No voucher approval rule, numbering scheme, mandatory printing rule, tax treatment or layout is created** — each was **explicitly prohibited** by `BD-446`.


# 16. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing |
|---|---|---|
| **`GAP-081`** | 🟡 Medium | **Refund recovery classification** — a marketplace refund arrives as a settlement deduction (`ACC-037`) but is not a fee for a service. `Marketplace Charges` or against revenue is unsettled. **Extends to return-shipping recovery** (`RET-032`) |
| **`GAP-084`** | 🟡 Medium | **Claim compensation classification** — an approved claim brings money in that is not revenue. **Same shape as `GAP-081`, opposite direction; resolving one likely resolves the other.** Guessing either misstates marketplace profitability |
| **`GAP-093`** | 🟡 Medium | **Revenue recognition on a converted replacement.** `ACC-017`'s precedent points forward but **is not stated and is not assumed** |
| **`GAP-107`** | 🟡 Medium | **Duplicate settlement detection is directional** (`ACC-036`). A manual entry typically carries no external reference, so an API import has nothing to match against |
| **`GAP-108`** | 🟢 Low | **`Cash → Cash` absent** from the supported matrix — consistent with one till, but branch and warehouse are scope dimensions |
| **`GAP-109`** | 🟢 Low | **Opening balances have no stated origin.** Under `ACC-001` balances derive from movements, so the first balance must come from somewhere |
| **`GAP-110`** | 🟢 Low | **Two readings await confirmation** — `E-085` as a system-managed `E-068` instance, and `Reversed` as an overlay. Both recorded as the readings that keep `DB-002`/`DB-003` intact; **neither asserted as a business rule** |
| **`GAP-082`** | 🟡 Medium | **Net Profit period completeness** (`ACC-042`) |
| **`GAP-105`** | 🟢 Low | **Valuation on legal transfer of abandoned property** — no acquisition cost exists while `ACC-024` requires one |
| **`GAP-003`, `GAP-004`** | — | Narrowed by the accounting reconciliation; carried |

---

# 17. Traceability

## 17.1 Business Decisions consumed

**§19 Accounting:** `BD-304` revenue at delivery · `BD-306` settlement model and deduction detail · `BD-308` balances at both levels · `BD-309` expense categories · `BD-310` refund when money returns · `BD-311` write-off does not reverse revenue · `BD-312` advances · `BD-314` eleven reports · `BD-315` **Financial Account architecture**.

**§27 Fund Transfers:** `BD-398` workflow versus classification · `BD-399` **fee independence** · `BD-400` workspace requirements *(deferred to UI Finalization)* · `BD-401` confirmed transfer types · `BD-402` capture methods · `BD-403` **lifecycle and Funds In Transit** · `BD-404` fee on failure.

**Supporting:** `BD-110`, `BD-111`, `BD-203`, `BD-254`, `BD-291`, `BD-297`, `BD-299`, `BD-301`, `BD-323`, `BD-338`, `BD-341`, `BD-390` – `BD-394`.

## 17.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `BR-105` – `BR-134` | `ORDER_MANAGEMENT_ARCHITECTURE.md` §9.9A, §9.9B, §9.10, §9.11 |
| `DM-051` – `DM-058`, `DM-078`, `DM-079`, `INV-83.1` – `INV-83.5`, `INV-84.1` – `INV-84.4`, `INV-85.1` – `INV-85.2` | `DOMAIN_MODEL.md` |
| `SYS-087` – `SYS-092`, `SYS-102`, `SYS-104` – `SYS-107`, `SYS-004`, `SYS-005`, `SYS-010`, `SYS-015`, `SYS-021`, `SYS-024`, `SYS-043`, `SYS-093` | `SYSTEM_ARCHITECTURE.md` |
| `DB-001` – `DB-003`, `DB-022`, `DB-028`, `DB-067`, `DB-077` | `DATABASE_ARCHITECTURE.md` |
| `PRD-121` – `PRD-124` | `PRODUCT_ARCHITECTURE.md` |
| `SMA-043`, `SMA-055`, `SMA-056`, `SMA-074` – `SMA-078` | `STATE_MACHINE_ARCHITECTURE.md` |
| `AUD-004`, `AUD-006`, `AUD-042` | `AUDIT_ARCHITECTURE.md` |
| `PRM-008`, `PRM-052` | `PERMISSION_ARCHITECTURE.md` |
| `AGV-001`, `AGV-024` | `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `RET-032` | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `CP-8`, `CP-9`, `CP-12` | `SYSTEM_ARCHITECTURE.md` §0 |

## 17.3 Corrections carried from reconciliation

| Correction | Record |
|---|---|
| **`DM-052` corrected** — Financial Accounts are real named instances, not generic types | `ACC-006` |
| **The fund-transfer invariant was never broken** — the MFS fee was a second transaction misattributed to the first | `ACC-026`, `SYS-105` |
| **The fee is not deducted from the transfer amount** — an earlier three-leg proposal had the destination receiving `X − f` | `ACC-032` |
| **A fee does not reclassify a transfer** — the *true transfers* versus *transfers with a fee* split was unnecessary | `ACC-032` |
| **`SYS-102` cross-domain check closed** — §18 Purchase already forbids restatement, so the two domains agree | `ACC-024` |
| **`BD-203` settled by structural necessity** — per-order reconciliation is unavoidable | `ACC-014` |

---

# 18. Version History

| Version | Date | Change |
|---|---|---|
| **1.8.0** | **2026-08-10** | ✅ **ADVANCE / REQUISITION ARCHITECTURE — `BD-448` – `BD-457`. §8A added (`ACC-059` – `ACC-076`) and §5A added (`ACC-077` – `ACC-085`), RESOLVING `GAP-117`. Post-Freeze amendment under `DOC-067`.** **Advance / Requisition is an ACCOUNTING-owned capability** — tested against `DOC-005`, **not assigned to HR merely because the counterparty is an employee**: `ACC-021` already owns advances and `ACC-011` gives the posting decision to the module owning the event, while **Payment keeps the actual money movements** (`PAY-000`, `PAY-003`) and **HR & Payroll later owns salary calculation and the deduction occurrence.** **No new top-level module** (`CP-9`). **Three entities — `E-086` Requisition, `E-087` Settlement, `E-088` Expense Claim — and no stored balance.** **Five settlement routes, every one a judgement** (`ACC-063`); **each allocated to a specific requisition** (`ACC-064`); **no FIFO or automatic allocation, and an unidentifiable receipt stays visible for review** (`ACC-065`). **`ACC-069`: TWO independent derived positions** — Employee Outstanding and Remaining Drawable — and **`ACC-070` makes completion a DERIVED CONDITION, not a state.** **`ACC-072`: the authorised amount is a HARD CEILING** — enforcement not judgement, by `BD-402`'s deterministic test, with **`BR-040` the direct precedent** — and **`ACC-073` forbids increasing it after disbursement; an excess raises a NEW requisition.** ⚠ **`ACC-068` records a deliberate authority asymmetry**: authorising and accepting are **permission-controlled, not owner-only**, while **write-off is owner/administrator only.** ✅ **`ACC-059` SCOPES `PAY-044`/`PAY-060` without weakening them** — automatic application belongs to advances prepaying an **identified** obligation, and **an employee advance prepays none.** ✅ **`GAP-117` RESOLVED minimally**: **`E-089` Authorised Accounting Adjustment posts only from an authorised business decision, cannot exist without one** (`ACC-077`, `ACC-078`), **fabricates no cash movement** (`ACC-079`), **is immutable with corrections as new linked adjustments** (`ACC-080`), **carries actor, time and reason with permission held by the owning capability's rule** (`ACC-081`), and **a Journal Voucher renders it, never creates it** (`ACC-082`). **`ACC-083` creates no new account, category or hierarchy.** ⚠ **`ACC-084`: the salary-recovery counterpart is deliberately NOT specified** — it needs HR & Payroll, `BD-450`'s reconciliation obligation stands, and **the route is not implemented until that stage.** ⚠ **`ACC-085`: `E-089` is not a general licence to post** |
| **1.7.0** | **2026-08-09** | ✅ **POST-FREEZE AMENDMENT under `DOC-067` — `BD-447` completes the voucher class. `ACC-055` – `ACC-058` added; no existing rule changed.** **`ACC-055`: a Payment Voucher renders an ALREADY-RECORDED outgoing payment** — `PAY-059`'s movement stream, `PAY-051` refunds and `ACC-002` adjustments already exist, **so it adds nothing.** **`ACC-056`: a Journal Voucher represents an authorised journal entry for a non-cash adjustment** — **not a printable view of an unrelated cash transaction** — **and printing still never creates the posting.** 🔴 **`ACC-057`: THE AUTHORISED JOURNAL-ENTRY MECHANISM DOES NOT EXIST in the frozen architecture, and is NOT invented here.** **`ACC-011` makes every posting event-driven by another module** — revenue at delivery, payable at acceptance, transfer legs, scrap, returns, reversals — **and there is no manual journal entry anywhere: no entity, state, event, permission or rule.** `ACC-008` keeps the chart flat with **no posting rules per category**, and the Financial Account assessment recorded ***“Nothing requires manual entry”***. **`GAP-117` registered as a pre-implementation dependency; until it is resolved a Journal Voucher would be a document with nothing behind it.** **`ACC-058`: three distinct identities, never one generic Voucher** — they differ in **what precedes them**, never in **whether something must**, and **in all three printing creates nothing** (`ACC-003`, `BR-121` unchanged) |
| **1.6.0** | **2026-08-09** | ✅ **POST-FREEZE AMENDMENT under `DOC-067` — `BD-446` answers `BD-135`. `ACC-052` – `ACC-054` added. No existing rule changed.** **A Receipt Voucher is an INTERNAL accounting document representing an ALREADY-RECORDED receipt — not the customer-facing receipt**, which is the Money Receipt (`PAY-082`). ✅ **`ACC-053` settles the most dangerous item on the Document Surface Map, in the direction the frozen model already required**: **the posting exists first and the voucher renders it.** **`ACC-003` creates a financial record when the business event occurs — *not when it is requested, approved or DOCUMENTED*** — so **a voucher that posted would contradict the accounting model outright**, and **`BR-121` says it in one line: documents evidence obligations; business events create them.** **`ACC-054` forbids collapsing the four cash occurrences** — customer paid the courier · courier remitted · own staff collected · Accounts posted — each distinct under `PAY-001`, `PAY-070`, `DLV-096`, `ACC-003`. ⚠ **Payment Voucher and Journal Voucher are NOT settled here** and remain in the same class; **nothing grants them posting authority and `ACC-003` continues to deny it.** ⚠ **No approval rule, numbering, printing mandate, tax treatment or layout created** |
| **1.5.0** | **2026-08-09** | ✅ **`ACC-051` added — `BD-440`, pre-freeze blocker A3. One rule; nothing amended.** **Closing a courier remittance batch POSTS NOTHING** — it records resolutions already decided and authorised elsewhere, and **may never write off money, approve a deduction, change an expected amount or manufacture an accounting treatment.** This is **`ACC-035` seen from the batch side.** **Three underlying acts, three treatments**: a **legitimate deduction accepted** by a permissioned Accounts user is a **corrected expectation, not a loss**; an **unrecoverable shortfall** is a **write-off under `BD-110`'s owner/administrator authority**; a **recovered amount** is ordinary settlement. ✅ **`ACC-004`/`BR-121` unchanged and now doubly load-bearing** — a courier statement is **evidence, never a posting source**, which `BD-438` states independently from the business side. **`ACC-013` untouched** |
| **1.4.0** | **2026-08-09** | **`EVU-16` resolved — `ACC-047` amended, `ACC-048` – `ACC-050` added.** **The receivable is created GROSS and applied Trade-In Credit clears part of it as a non-cash clearing component**; `ACC-014`'s two-part clearing gains a third component and **nothing is netted at recognition.** `ACC-047` is **amended, not withdrawn** (`DOC-021`) — it briefly implied a net obligation. **`ACC-048` states this module's ownership**: `E-083`, available-balance validation, the authoritative movement and the remaining balance — **while Payment orchestrates the application** (`PAY-068`). **`ACC-049` models the interaction as an explicit request that may be refused** (`SYS-006`, `SYS-032`). **`ACC-050` publishes `EVT-101 Accounting.TradeInCreditApplied`, this module's first event**, on the `EVT-039 Inventory.Reserved` precedent — **the authoritative fact comes from the owner of `E-083`.** **`ACC-039`, `ACC-040` and `ACC-044` – `ACC-046` unchanged; reversal and expiry remain unresolved** |
| **1.3.0** | **2026-08-09** | **`ACC-047` added — credit application timing fixed; no posting invented.** `BD-433` settles that **credit is applied before dispatch** and that **the obligation created at dispatch reflects the remaining payable**, while **the Order Total and recognised revenue stay at full value** (`ACC-039`). **The full order of facts is now fixed**: created at agreement → applied before dispatch → obligation raised net → cash settled. **`ACC-039`, `ACC-040` and `ACC-044` – `ACC-046` are unchanged**, and **credit reversal and expiry remain explicitly unresolved** |
| **1.2.1** | **2026-08-09** | **Event cross-reference added and one pointer corrected — no posting rule changed.** §6's Trade-In row now names **`EVT-096`** as its trigger. **The row previously pointed both the credit liability and the component cost basis at §11.4, which covers Trade-In Credit only** — component cost is `INVENTORY_COSTING_ARCHITECTURE.md` §4's (`ICO-011` – `ICO-017`), and the pointer is corrected. ⚠ **Whether the component cost basis posts at acceptance or at allocation completion is recorded as unsettled, not resolved** — `IVN-030` creates inventory only after allocation |
| **1.2.0** | **2026-08-09** | **Trade-In Credit application propagated — `ACC-044` – `ACC-046` added; `ACC-039` and `ACC-040` unchanged.** `BD-431` confirmed **full and partial application**, and that **applying credit reduces the remaining Amount Payable without reducing or rewriting the Order Total** — `ACC-039` restated by the business with a worked example. **`ACC-045` records credit application and payment settlement as separate financial facts**, keeping creation, application and settlement three distinct moments. **`ACC-046` requires four-part traceability**, with the balance derived from movements (`DB-001`). **Two open items recorded, not solved**: **which module publishes a credit application** — this document owns `E-083` but publishes no events, and no `PAY-` rule mentions Trade-In — and **credit reversal on a cancelled or returned sale**, which stays explicitly unresolved. **No posting was invented** |
| **1.1.0** | **2026-08-09** | **Trade-In pointers corrected — no posting rule changed.** §2.2's out-of-scope row read *‘Trade-In case and component lifecycles — `SM-18`, `SM-19`, `E-081` – `E-083`’*, which **disclaimed `E-083` Trade-In Credit — an entity this document owns** (`ACC-039`, `ACC-040`, and `E-083`'s own ownership line). **That was an internal error**, and the row named machines and entities rather than a document because **no owning module was registered**. Both halves corrected: the row now disclaims `E-081` and `E-082` only, and points at [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) (`DOC-063`). §6's posting-trigger row likewise resolves. **`ACC-039` and `ACC-040` are unchanged**, and Trade-In Credit remains wholly Accounting's |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §19 (`BD-304` – `BD-316`) and §27 (`BD-398` – `BD-404`) with the reconciliation at `OM §9.9A`, `§9.9B`, `§9.10`, `§9.11`, `DOMAIN_MODEL.md` v2.8.0 – v3.8.0 and `SYSTEM_ARCHITECTURE.md` §11.1, §23, §24. **43 rules, all traceable; no new business rule, entity or state machine introduced.** `E-068`, `E-083`, `E-084`, `E-085` and `SM-5`, `SM-6`, `SM-10`, `SM-20` referenced, none defined here. **`ACC-000` records the ownership boundary with `PAYMENT_ARCHITECTURE.md`; Fund Transfer ownership assigned here** (`DOC-056`). Ten open gaps carried |

---

# 8E. Monetary rounding — consumed, not restated

> **ACC-098 — Accounting applies the ERP-wide BDT monetary rounding policy at `DB-079`. It states no rounding rule of its own** (`DOC-005`, `DOC-006`).
>
> **Every posting amount, settlement amount, adjustment amount and receivable/payable figure is a monetary line: 2 decimal places, `HALF_UP`, rounded before aggregation, with totals summed from already-rounded lines.**
>
> ✅ **`ACC-001` and `DB-001` are untouched** — **a derived position is computed from rounded movement amounts; the position itself is still never stored** (`ACC-088`, `ACC-093`).
>
> ⚠ **`ACC-064`/`INV-44.1`'s exact-allocation requirement is satisfied at the same 2dp precision** — **an allocation set sums exactly to the amount applied, with no residue** (`DB-039`, `BD-482` §6).

| Version | Date | Change |
|---|---|---|
| **1.10.0** | **2026-08-10** | ✅ **`ACC-098` added — §8E. Accounting CONSUMES the ERP-wide BDT rounding policy at `DB-079` and states no rounding rule of its own** (`DOC-006` reference-never-restate). **Every posting, settlement, adjustment and receivable/payable figure is a 2dp `HALF_UP` monetary line, rounded before aggregation, with totals from rounded lines.** ✅ **`ACC-001`/`DB-001` untouched** — derived positions are still computed, never stored. ⚠ **`ACC-064`'s exact-allocation requirement is satisfied at the same precision.** **No existing accounting rule altered** |

| **1.10.1** | **2026-08-11** | 🔴 **FINAL ARCHITECTURE AUDIT — DOCUMENTARY CORRECTION ONLY. No rule, posting, formula or ownership changed.** **Document Control cited `BUSINESS_DISCOVERY.md` §19 as `BD-304` – `BD-316`. `BD-316` DOES NOT EXIST and never did:** **§19 is budgeted `BD-304` – `BD-314`, its closing entry is `BD-314` marked `§19 complete`, the section header reads `§19 Accounting complete — 11 of 11`, `BD-315` is an appended Financial-Account correction, and §20 opens at `BD-317`.** ✅ **Corrected to `BD-304` – `BD-315`, which is the true span of §19's accounting content.** ⚠ **The `1.0.0` history row below retains the original citation verbatim under `DOC-009` and is NOT edited.** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies accounting business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
