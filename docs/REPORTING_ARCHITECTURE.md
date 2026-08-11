# Reporting Architecture

**Owner:** Trioloo Technology · **Module:** Reporting · **Status:** Canonical
**Version:** 1.4.0 · **Ratified:** 2026-08-08 · **Rule prefix:** `RPT-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §19 Accounting (`BD-313`, `BD-314`), with `BD-304` – `BD-312`, `BD-315`, `BD-352`.

**Reconciliation records consolidated:** [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §11.1 (`SYS-087` – `SYS-092`) · [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) (`BR-141`) · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) §12 (`ACC-042`, `ACC-043`) · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) §20 (`RET-033`).

**References, never duplicated:** [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) · [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) `PAY-` · [`PROCUREMENT_ARCHITECTURE.md`](PROCUREMENT_ARCHITECTURE.md) `PRC-` · [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) `PRD-` · [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) `WHS-` · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) `NOT-` · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) `AGV-` · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) `PRM-` · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) `AUD-` · [`EVENT_ARCHITECTURE.md`](EVENT_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary — the strictest in the documentation set

> **RPT-000 — This document answers *which reports exist, what each reads, and how reports behave as a class*. It owns no business figure whatsoever.**

**The rule that governs this module is not written here. It was ratified in `DATABASE_ARCHITECTURE.md`:**

> **`DB-067` — Reporting never becomes a second system of record.** *A figure that exists only in reporting, computed by logic that exists only in reporting, is unowned and unverifiable* (`SYS-015`).

| Question | Owner |
|---|---|
| **Which reports exist, what each reads, how reports behave as a class** | **`REPORTING_ARCHITECTURE.md`** — `RPT-` |
| **Every figure in every report** | **The module that owns the figure** (`DB-067`) |
| Revenue, COGS, margin, expenses, balances | `ACCOUNTING_ARCHITECTURE.md` — `ACC-` |
| Receivables, settlement, collection | `PAYMENT_ARCHITECTURE.md` — `PAY-` |
| Payables, supplier transactions | `PROCUREMENT_ARCHITECTURE.md` — `PRC-` |
| Stock quantity and movements | `INVENTORY_ARCHITECTURE.md` — `IVN-` |
| Inventory valuation | `INVENTORY_COSTING_ARCHITECTURE.md` — `ICO-` |
| **What a report looks like** | `DESIGN_CONSTITUTION.md` (`SYS-047`, `SYS-001`) |
| **Evidence packages for disputes** | `AUDIT_ARCHITECTURE.md` (`AUD-021`) |

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine, workflow or calculation is introduced. **No gap is resolved by assumption** — see §22.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To present what the business already knows, without ever becoming a second place where it is known.

Every other module in this set owns something. **This one deliberately owns nothing but the presentation contract** — and that restraint is the point. `SYS-087` states it in one line:

> **Every one of the eleven confirmed V1 reports is a view over records that already exist; none owns a figure.**

---

# 2. Scope

## 2.1 In scope

The confirmed V1 report register · the dashboard reporting requirement · the shared period vocabulary · the semantic-layer boundary · derived-metric composition where already ratified · snapshot-versus-live behaviour · basis disclosure · filtering, export and presentation obligations · report-level permission and scope · the statutory-scope boundary · the categories for which **no report is registered**.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Every business figure a report displays** | The owning module (`DB-067`, `RPT-000`) |
| **Any calculation not already ratified** | Not defined anywhere — **and not invented here** |
| **Report layout, density, chart form, table behaviour** | `DESIGN_CONSTITUTION.md` (`SYS-047`) |
| **Evidence packages and audit reconstruction** | `AUDIT_ARCHITECTURE.md` (`AUD-021`, `AUD-022`) |
| **The Notification Center and the Action Queue** | `NOTIFICATION_ARCHITECTURE.md` — **operational workspaces, not reports** (`NOT-001`) |
| **The four access governance surfaces** | `ACCESS_GOVERNANCE_ARCHITECTURE.md` (`AGV-035`) |
| **Technical monitoring** | Explicitly separate from business audit (`AUD-002`); not a reporting concern |
| Statutory financial statements | **Out of V1 scope** (`SYS-092`, `ACC-043`) |

---

# 3. Architectural Principles

## 3.1 P1 — Reporting owns no figure

> **RPT-001 — Every figure is owned by its source module. Reporting presents; it never computes business truth independently** (`DB-067`, `SYS-015`, `SYS-087`).

**`SYS-015` states the general form:** *"Reporting presents figures; it does not compute business truth independently of the owning module."*

## 3.2 P2 — Every report is a view over records that already exist

> **RPT-002 — No report requires a store of its own** (`SYS-087`, `BD-314`). Eleven reports were confirmed and **every one reads records already specified elsewhere.**

## 3.3 P3 — A derived figure must be reproducible from history

> **RPT-003 — Any figure a report presents must be explainable by enumerating the movements that produced it** (`SYS-008`, `DB-001`).

*"A number that cannot be explained is not trustworthy."*

> **RPT-004 — Where a derived value is stored for performance, it declares its source and remains reconcilable against it** (`DB-010`). **A cached balance that cannot be checked against its movements is an unverifiable number.**

## 3.4 P4 — Unknown is never zero

> **RPT-005 — A figure the system cannot compute is presented as unknown and excluded from aggregates, never silently substituted with zero** (`SYS-034`, `BR-007`, `DB-005`).

*"Summing unknowns as zeros is how an ERP produces confidently wrong management reports."*

## 3.5 P5 — A figure whose completeness varies must state its basis

> **RPT-006 — Where a figure's completeness depends on the period selected, the report states its basis wherever the figure appears** (`SYS-089`, `GAP-082`, `ACC-042`).

**This is a standing obligation, not a fix.** Whether to accrue estimated charges or to label the figure is **a business decision** (`DM-001`) and remains open — see §14.2.

## 3.6 P6 — One vocabulary, shared

> **RPT-007 — One period vocabulary serves every report; periods are not per-report options** (`SYS-091`, `SYS-016`, `BD-314`).

---

# 4. The Confirmed V1 Report Register

> **RPT-008 — Eleven reports constitute the confirmed V1 set** (`SYS-087`, `ACC-042`, `BD-314`). **The register is owned by `SYSTEM_ARCHITECTURE.md` §11.1 and is reproduced here for navigation; that section governs.**

| Report | Reads | Figure owned by | Most-used rank |
|---|---|---|---|
| **Sales** | Revenue at delivery (`BR-116`) | Accounting | **1** |
| **Profit** | Net Profit (`SYS-088`) | Accounting | **2** |
| **Collection** | Collection versus settlement (`OM §11.1`) | Payment | **3** |
| **Supplier Ledger** | Seven transaction types (`SYS-090`) | Procurement | **4** |
| **Customer Due** | Receivables (`BR-119`) | Payment | **5** |
| **Supplier Due** | Payables (`BR-109`) | Procurement | **6** |
| **Cash & Bank Balance** | `E-068` Financial Account | Accounting | **7** |
| Expense | Expense categories (`BD-309`, `ACC-008`) | Accounting | — |
| Purchase | `E-029`, `E-030` (`BR-105`) | Procurement | — |
| Inventory Value | Weighted average (`ICO-001`) | Inventory Costing | — |
| Stock Movement | Movements (`DB-001`) | Inventory | — |

> **RPT-009 — The business requested only the reports required to operate efficiently from day one** (`BD-314`, `CP-9`). **The set is deliberately minimal**, and nothing beyond it is registered.

> **RPT-010 — `SYS §11.1` records the register as *interim placement* because this document did not exist.** With ratification, `RPT-008` is its home; `SYS-087` – `SYS-092` remain the ratified rules and are **referenced, never restated** (`DOC-006`).

---

# 5. Dashboard Reporting

> **RPT-011 — The primary figure the business relies on is Net Profit** (`BD-313`).

> **RPT-012 — The dashboard prioritises today's and this month's profit** (`BD-313`).

> **RPT-013 — Dashboard priority is a business requirement; visual authority remains with `DESIGN_CONSTITUTION.md` and `design-reference/`** (`SYS-001`, `SYS-047`, `BD-313`). **`RULE 0.1`'s freeze on existing surfaces is untouched by this document.**

## 5.1 ⚠ The dashboard prioritises the least reliable period

**This is recorded in the discovery in the sharpest possible terms and is carried unchanged:**

| Component | Posts on |
|---|---|
| Revenue · COGS | **Delivery day** |
| **Marketplace Charges** | **Settlement day — up to 7 days later** (`BD-063`) |
| **Courier Charges** | **Remittance day** |

**Today's Net Profit carries today's full revenue and none of the channel cost that will attach to it** — overstating by roughly the whole channel cost on marketplace orders. **By month end the figure largely self-corrects**, which is why *this month* is far sounder than *today*.

> **The periods themselves are correct accrual behaviour.** The same order's revenue and channel cost simply fall in different ones. **`GAP-082` is carried; `RPT-006` is the standing mitigation until it is resolved.**

⚠ **The four KPIs visible on the shipped orders list** — `Total Orders`, `Confirmed Today`, `Total Revenue`, `Total Margin` — are the subject of **`GAP-004`**, which `SYS-088` **narrowed but did not close.** Their population, filters and period basis remain undefined. **Not defined here** (`DM-001`).

---

# 6. Period Vocabulary

> **RPT-014 — Six period values serve every report** (`SYS-091`, `BD-314`): **Today · Yesterday · This Week · This Month · Last Month · Custom Range.**

> **RPT-015 — Period boundaries follow recognition dates, not activity dates** (`BD-313`, `ACC-013`).

| Figure | Falls in the period of |
|---|---|
| Revenue · COGS | **Delivery** (`BR-116`) |
| Marketplace and Courier Charges | **Settlement** |
| Expenses | **Incurred** |

⚠ **`BD-313`'s period-completeness caveat applies to `Today` and `Yesterday` in particular** — both are in the standard vocabulary, and both are the least complete.

---

# 7. Financial Reports

**All figures are owned by `ACCOUNTING_ARCHITECTURE.md`. This section states only what each report reads.**

| Report | Reads | Rule |
|---|---|---|
| **Profit** | Net Profit, five components | `SYS-088`, §14.1 |
| **Expense** | Versioned expense categories | `ACC-008`, `DM-057`, `BD-309` |
| **Cash & Bank Balance** | `E-068` Financial Account balances, **derived from movements** | `ACC-001`, `ACC-006` |

> **RPT-016 — Financial Accounts are real named instances, and balances are derived from movements, never stored** (`ACC-006`, `ACC-001`). **A Cash & Bank Balance report is a computation over movements at read time.**

> **RPT-017 — Owner contributions and drawings run through the same Financial Accounts as operations and post as equity** (`ACC-041`). **A consequence for reporting, recorded in Accounting and carried here:** the bank balance **reflects owner activity as well as operations**, and only *"what has the owner taken"* is separately answerable because owner movements are distinguishable at posting.

⚠ **Outstanding Trade-In Credit must be reportable as a standing liability** (`ACC-040`). Unexpiring credit accumulates indefinitely under `BD-338`. **The obligation is recorded in Accounting; no report is registered for it in the V1 set.**

---

# 8. Sales Reports

> **RPT-018 — The Sales report reads revenue recognised at successful delivery, uniformly across every channel** (`BR-116`, `ACC-013`).

> **RPT-019 — Revenue is never netted; channel deductions are expenses** (`ACC-018`, `BR-122`, `DM-054`). **A Sales report presents gross revenue; the deductions appear as expense, not as a reduction of the sales figure.**

**`E-043`'s worked example states the consequence plainly:** *`Sale ৳48 · Charges ৳30 · Received ৳18`* — the customer paid 48, Trioloo received 18, **and only the third figure is revenue** after the charges are recognised as expense.

---

# 9. Collection and Settlement Reports

> **RPT-020 — The Collection report reads collection versus settlement, which are separate concepts and must never be conflated** (`OM §11.1`, `BR-035`, `PAY-001`).

**At ~100% COD this gap covers the entire business** (`BD-058`, `PAY §1`).

> **RPT-021 — Unremitted COD is aged per courier, and money held beyond terms is an exception, not a passive balance** (`BR-036`, `PAY-020`, `INV-42.2`).

> **RPT-022 — Settlement figures are reconciled per order, never in aggregate** (`INV-42.1`, `BR-129`, `PAY-004`). **A settlement report presenting only aggregate totals would conceal two orders wrong in opposite directions.**

⚠ **No dedicated marketplace or settlement report is registered in the V1 set** — see §13.

---

# 10. Customer Reports

> **RPT-023 — Customer Due reads receivables** (`BR-119`, `PAY-016`).

> **RPT-024 — No customer ledger is required, and the asymmetry with suppliers is justified rather than an oversight** (`SYS-090`, `BD-314`).

**At ~100% COD customers rarely carry a running balance** — they are discharged at the door and the receivable sits with the marketplace or courier (`BR-119`). **`BD-311` located genuine customer receivables in the B2B credit and installment population only.**

> **The ledger belongs where balances persist, and that is the supplier side.** Recorded in the discovery as coherent; **no customer ledger is proposed** (`SYS-090`).

⚠ **`GAP-072` bears on this:** installment sales are confirmed and modelled nowhere — no entity, no receivable schedule (`PAY §21`). **The population `BD-311` identified as the real customer-receivable case is the one with no model.** Carried unchanged.

> **RPT-025 — Customer return history is decision support, and no customer scoring exists** (`BR-140`, `RET §7.4`, `BD-351`). ⚠ **`GAP-091` is carried — *"unusually frequent returns"* has no threshold**, and the value is the business's to set.

---

# 11. Supplier and Purchase Reports

> **RPT-026 — The Supplier Ledger carries seven transaction types** (`SYS-090`, `PRC-052`, `BD-314`): **Purchase · Payment · Advance Payment · Supplier Return · Exchange · Credit Note/Adjustment · Outstanding Balance.**

> **RPT-027 — Outstanding Balance is derived, never stored** (`SYS-090`, `PRC-048`, `DB-001`).

> **RPT-028 — Supplier Due reads payables, which are created at acceptance** (`BR-109`, `PRC-002`, `PRC-047`).

> **RPT-029 — The Purchase report reads `E-029` and `E-030`, and the goods receipt is the spine** (`BR-105`, `PRC-003`). **A direct purchase has no purchase order**, so a Purchase report anchored on `E-029` alone would omit an entire first-class path.

> **RPT-030 — Supplier purchase history is a derived view, not an entity** (`PRC-009`, `DB-001`, `DB-067`, `BD-295`).

---

# 12. Inventory Reports

> **RPT-031 — Inventory Value reads Weighted Average Cost** (`ICO-001`, `ACC-023`, `BD-298`). **The figure is owned by `INVENTORY_COSTING_ARCHITECTURE.md`.**

> **RPT-032 — Stock Movement reads movements; no stock figure is stored** (`IVN-002`, `IVN-015`, `DB-001`).

> **RPT-033 — Three stock quantities exist and answer different questions; a report must state which it presents** (`IVN-007`, `IVN-008`, `PRD-126`).

| Quantity | Nature |
|---|---|
| **Physical Stock** | One, shared — derived from movements |
| **Available Quantity** | **Automatic** — ready-built plus buildable, recomputed on every movement |
| **Published Marketplace Stock** | **Manual, per shop** — may deliberately exceed physical |

**Conflating them would present a manual business decision as a derived fact.**

> **RPT-034 — Three conditions render stock present but not sellable and must not collapse into one figure** (`IVN-012`, `BR-104`): **Reserved · Pending supplier resolution · QC Pending.**

⚠ **Low Stock is an Ongoing Condition evaluated as a query over current state, not a report and not an event** (`NOT-013`, `IVN §23`). **It cannot be missed, because it is never delivered as a moment.**

---

# 13. Categories With No Registered Report

> **RPT-035 — The following reporting categories have no report in the confirmed V1 set. Their absence is recorded, and no report is invented for them** (`SYS-087`, `BD-314`, `DM-001`, `DOC-024`).

| Category | What is ratified | What is **not** registered |
|---|---|---|
| **Marketplace** | Settlement reconciliation figures (`PAY §8`), per-shop counterparties (`BR-128`), seven independent settlement streams | **No marketplace report** — no per-shop performance, commission, or channel-profitability report |
| **Settlement** | The Collection report reads collection versus settlement | **No dedicated settlement report** |
| **Warranty** | `SM-13` Warranty Claim, `SM-15` Repair, cost bearer (`ICO-024`), warranty package (`E-070`) | **No warranty report.** ⚠ `GAP-087` — overdue warranty cases *"cannot be built as stated"* because no expectation exists |
| **Return & Exchange** | **`RET-033` — a requirement *on* reports** (§16.2) | **No return or exchange report** |
| **Trade-In** | [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) — `SM-18`, `SM-19`; Trade-In Credit as a liability (`ACC-039`, `ACC-040`) | **No trade-in report**, though `ACC-040` records outstanding credit as needing to be reportable |
| **Audit** | **Evidence packages** (`AUD-021`, `AUD-022`), state reconstruction (`AUD-013`, `AUD-014`), control monitoring | **No audit *report*** — and evidence production is **owned by `AUDIT_ARCHITECTURE.md`**, not by this module |
| **Access governance** | **Four surfaces registered as one area** (`AGV-035`) | **Owned by `ACCESS_GOVERNANCE_ARCHITECTURE.md`**, not registered as reports |
| **Operational work queues** | The **Action Queue** is authoritative for outstanding work (`NOT-001`, `DM-072`) | **Not a report** — an operational workspace |

> **RPT-036 — An absent report is an absent business request, not an architectural omission** (`CP-9`, `BD-314`). *"The ERP should provide only the reports required to operate the business efficiently from day one."*

---

# 14. Derived Metrics

## 14.1 Net Profit

> **RPT-037 — Net Profit = Sales Revenue − COGS − Marketplace Charges − Courier Charges − Business Expenses** (`SYS-088`, `BD-313`).

**Five components, and no more:** **no VAT** (`BD-307`), **no landed cost** (`PRD-121`, `ACC-022`), **no depreciation or fixed assets** — excluded by scope. **The figure is deliberately simple, consistent with `CP-9`.**

> **RPT-038 — The business relies on Net Profit rather than gross margin** (`BD-313`) — *a more honest figure, because it carries the channel cost that gross profit omits entirely.*

> **RPT-039 — This document defines no calculation. `SYS-088` is the ratified definition and is referenced, never restated** (`DOC-006`, `RPT-001`).

## 14.2 ⚠ Completeness — `GAP-082`

**Carried unchanged.** Whether to accrue estimated charges at delivery or to label the figure as pre-settlement is **a business decision, not an architectural one** (`SYS-089`, `ACC-042`, `DM-001`). **Until it is settled, `RPT-006` applies: any Net Profit display must state its basis.**

## 14.3 Margin is knowably incomplete

> **RPT-040 — Reported margin understates true cost and therefore overstates margin, knowably rather than silently** (`PRD-123`, `ICO §12`, `PRC-044`).

**Two ratified decisions place real costs outside product cost:** additional build costs may be zero (`PRD-119`) and freight and duty are period expenses (`PRD-121`).

> **`SYS-034` is not violated** — these are **classification decisions on known amounts**, not unknowns recorded as zero (`PRD-123`). **The figure is knowably incomplete rather than confidently wrong**, and the distinction is what makes it acceptable.

---

# 15. Snapshot versus Live

> **RPT-041 — A report presents live derivation by default; snapshotted values are presented as at their commitment moment** (`DB-001`, `DB-023`, `SYS-017`).

| Value class | Behaviour |
|---|---|
| **Balances and positions** | **Derived from movements at read time** (`DB-001`) — stock, receivables, payables, Financial Accounts |
| **Committed values** | **Snapshotted at commitment and never refreshed** (`DB-023`, `SYS-017`) — agreed price, cost at dispatch, address at dispatch, commission rate at order date |
| **Configuration-dependent figures** | Resolve to the **version in force at the transaction's own date** (`SYS-021`, `INV-43.3`, `DB-022`) |

> **RPT-042 — Historical figures do not move** (`DB-003`). *"The past does not move."* A report over a closed period returns the same answer when re-run, because **no upstream mechanism restates history** — corrections are forward-only linked adjustments (`ACC-002`, `ICO-031`, `IVN-005`).

**This is why `SYS-021` matters to reporting:** renegotiating a courier rate or a commission **never rewrites the profitability of a past order**.

> **RPT-043 — Where a derived value is stored for performance, it is reconcilable to its source** (`DB-010`, `RPT-004`). **This document neither requires nor prohibits such storage** — it is an engineering decision bounded by `DB-010`.

---

# 16. Filtering, Export and Presentation

## 16.1 Presentation is not owned here

> **RPT-044 — Report layout, density, chart form, table behaviour, empty and error states are governed by `DESIGN_CONSTITUTION.md`** (`SYS-047`, `SYS-001`). **No architecture document may specify a screen** — where reporting behaviour has a user-facing consequence, this document states the **behaviour** only.

**The Constitution's ratified obligations that bear on reports** — referenced, not restated: every table implements **five states** (§10.4); tables carry a **totals row** where summable (§10.6.3); numbers are **right-aligned with tabular figures** (§3.3.a); currency follows **Taka lakh/crore grouping** (RULE 3.3.b); **infinite scroll is prohibited** in data tables because it breaks position memory, counts and printing (§10.5).

## 16.2 The Completed-versus-Closed disclosure

> **RPT-045 — Reports must state whether they count *not Completed* or *not Closed*** (`RET-033`, `BR-141`, `BD-352`).

| Question | Counts |
|---|---|
| *"What still needs operational work?"* | **Not Completed** |
| *"What is not finished commercially?"* | **Not Closed** |

**Reporting the second as the first shows a backlog nobody can act on** — the work is done and is waiting on a marketplace, a supplier, or a settlement.

> **`BR-141` generalises this to every operational lifecycle**, confirmed across seven (`SMA-057`). ⚠ **The index records this as the *open ambiguity* carried into this document** — it is a **disclosure obligation on every affected report**, and **which reports are affected is not enumerated in any ratified source.** Recorded, not enumerated (`DM-001`).

## 16.3 Export

> **RPT-046 — Every table representing business data is exportable, CSV as a minimum** (`DESIGN_CONSTITUTION.md` §10.6.6).

> **RPT-047 — Export is a bulk operation and obeys every rule that governs one** (`SYS-033`, `PRM-004`, `AUD §12.2`): authorisation per record, per-record rule enforcement, and **partial success reported per record, never as an aggregate that hides which records failed** (`SYS-073`).

## 16.4 Filtering

> **RPT-048 — All view state is in the URL** (`DESIGN_CONSTITUTION.md` RULE 8.2.a). Filters, sort, page, density and active tab are query parameters, **so any screen a user is looking at is reproducible by pasting the URL to a colleague.** *"This is a core ERP requirement — support and audit conversations depend on it."*

⚠ **`GAP-033` is carried:** filter and search semantics on the shipped orders list are undocumented — **what fields search covers, what the period control filters on (order date? dispatch date? delivery date?), what populates `Sources` and `Stores`, and how filters combine.** *"Two different month definitions on one screen is plausible and undetectable."* **Not defined here.**

---

# 17. Statutory Scope Boundary

> **RPT-049 — No statutory financial statements are in V1 scope** (`SYS-092`, `ACC-043`, `BD-314`). **No Trial Balance, General Ledger, Balance Sheet or formal Profit & Loss.**

**This is operational reporting, not statutory accounting**, consistent with `CP-9` and with VAT being out of scope (`BD-307`).

> **Recorded as a scope boundary, not a deficiency** — `SYS-092` exists so the decision is **revisited deliberately** rather than discovered.

⚠ **`GAP-003` is carried:** taxation is undocumented and **deliberately out of scope** — VAT not charged, no returns filed, presentation only (`BD-307`). **Re-entry would touch line composition and reporting**, not the core model.

---

# 18. Ownership Boundaries — Consolidated

| Reporting supplies | The module owns |
|---|---|
| **Accounting** — presentation of revenue, profit, expense, balances | **Every posting and every financial figure** (`ACC-011`, `ACC-001`) |
| **Payment** — presentation of collection, settlement, receivables | **Reconciliation, variance, dispute** (`PAY-000`) |
| **Procurement** — presentation of the Supplier Ledger, payables, purchases | **The payable and supplier transactions** (`PRC-002`) |
| **Inventory** — presentation of movements and quantities | **Quantity, availability, the movement ledger** (`IVN-000`) |
| **Inventory Costing** — presentation of inventory value | **The cost figure and its derivation** (`ICO-000`) |
| **Audit** — nothing | **Evidence packages and reconstruction** (`AUD-021`) |
| **Notification** — nothing | **The Action Queue as the record of outstanding work** (`NOT-001`) |
| **Access Governance** — nothing | **The four governance surfaces** (`AGV-035`) |
| **Design Constitution** — behaviour only | **All presentation** (`SYS-047`) |

**This module owns no figure, no entity, no state machine and no calculation.**

---

# 19. Entity and State Machine References

> **RPT-050 — This module introduces no entity and no state machine, and requires none** (`DOC-005`, `SYS-087`).

**Entities read, all defined in `DOMAIN_MODEL.md`:** `E-029`, `E-030` (purchase) · `E-040` – `E-045` (receivable, payment, remittance, settlement, settlement line, refund) · `E-046` (expense) · `E-068` (Financial Account) · `E-020`, `E-021`, `E-026` (stock) · `E-025` (supplier).

**No machine is observed, defined or ratified here.**

---

# 20. Permission, Scope and Audit

> **RPT-051 — Report visibility is bounded by Roles, Permissions and Scope Assignments, enforced on read** (`PRM-009`, `SYS-020`, `AGV-020`, `SYS-067`).

> **RPT-052 — Sensitive data classes are separately grantable, independently of record access** (`PRM-011`). **Cost, margin and salary are named sensitive classes** — and `AGV-012` records salary as **the strongest case yet** for that rule, since a user profile is otherwise widely readable.

**A report exposing cost or margin is therefore not automatically visible to a user who may read the underlying record.**

⚠ **`BD-377` records that most users currently work across all channels** — the scope model is **designed for growth and deliberately not enforced today** (`PRM-051`, `AGV §10.3`).

> **RPT-053 — Producing an evidence package is itself audited** (`AUD-022`). **Evidence production is owned by `AUDIT_ARCHITECTURE.md`; it is named here only to place the boundary.**

---

# 21. Notification Integration

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.**

> **RPT-054 — A report is not a notification, and a notification is not a report** (`NOT-001`). A notification is **authoritative for communication evidence only, never for business state**; the Action Queue holds outstanding work.

⚠ **Ageing overlays produce visibility, never action** — stated independently four times (`NOT §21.2`, `BD-334`, `BD-350`, `BD-364`, `BD-365`). **Two of the five ageing thresholds are undefined** (`GAP-087`, `GAP-091`), and **no report may invent one.**

---

# 22. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing on reporting |
|---|---|---|
| **`GAP-004`** | 🔴 Critical | **Dashboard KPIs undefined** — population, filters and period basis for the four shipped KPIs. **Narrowed by `SYS-088`, not closed** (§5.1) |
| **`GAP-082`** | 🟠 High | **Net Profit completeness varies by period, and the dashboard prioritises the least complete** (§14.2). A business decision |
| **`GAP-033`** | 🟠 High | **Filter and search semantics undocumented** — including which date the period control filters on (§16.4) |
| **`GAP-003`** | 🔴 Critical | **Taxation undocumented; deliberately out of scope.** Re-entry touches reporting (§17) |
| **`GAP-072`** | 🟠 High | **Installments modelled nowhere** — the population `BD-311` identified as the genuine customer-receivable case (§10) |
| **`GAP-087`** | 🔴 High | **Overdue warranty cases cannot be flagged** — no expectation exists to measure against (§13, §21) |
| **`GAP-091`** | 🟡 Medium | ***"Unusually frequent returns"* has no threshold** (§10) |
| **`GAP-081`** · **`GAP-084`** | 🟡 Medium | **Refund-recovery and claim-compensation classification** — both determine whether an amount appears in `Marketplace Charges` or against revenue, and therefore **change reported marketplace profitability** |
| **`GAP-024`** | 🟡 Medium | **No ageing thresholds** for unremitted COD, missing settlement lines, or stalled disputes |
| **`GAP-026`** | 🟡 Medium | **State names collide across machines** — a report filtering on a state name must qualify it (`SMA-047`, `DM-002`) |
| **`BR-141` disclosure scope** | — | **Which reports must carry the Completed/Closed disclosure is not enumerated** in any ratified source (§16.2) |
| **`GAP-001`** | 🔴 Critical | Module documents remain unwritten. **This document reduces the count by one** |

**No gap is closed by this document, and none is newly discovered.**

---

# 23. Traceability

## 23.1 Business Decisions consumed

| BD | Contributes |
|---|---|
| `BD-313` | **Net Profit as the primary figure** · five components · **dashboard prioritises Today and This Month** · period-completeness caveat |
| `BD-314` | **The eleven-report register** · most-used ranking · **Supplier Ledger's seven types** · six-value period vocabulary · **no statutory statements** · the customer/supplier asymmetry |
| `BD-352` | **Completed versus Closed** as a general principle |

**Prior coverage consumed:** `BD-058`, `BD-063`, `BD-295`, `BD-297` – `BD-301`, `BD-304` – `BD-312`, `BD-315`, `BD-338`, `BD-351`, `BD-377`.

## 23.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `SYS-008`, `SYS-015`, `SYS-016`, `SYS-017`, `SYS-020`, `SYS-021`, `SYS-033`, `SYS-034`, `SYS-047`, `SYS-067`, `SYS-073`, `SYS-087` – `SYS-092`, `CP-9`, `CP-12` | `SYSTEM_ARCHITECTURE.md` |
| `DB-001`, `DB-003`, `DB-005`, `DB-010`, `DB-022`, `DB-023`, `DB-067` | `DATABASE_ARCHITECTURE.md` |
| `ACC-001`, `ACC-002`, `ACC-006`, `ACC-008`, `ACC-013`, `ACC-018`, `ACC-023`, `ACC-039` – `ACC-043` | `ACCOUNTING_ARCHITECTURE.md` |
| `PAY-001`, `PAY-004`, `PAY-016`, `PAY-020` | `PAYMENT_ARCHITECTURE.md` |
| `PRC-002`, `PRC-003`, `PRC-009`, `PRC-044`, `PRC-047`, `PRC-048`, `PRC-052` | `PROCUREMENT_ARCHITECTURE.md` |
| `IVN-002`, `IVN-005`, `IVN-007`, `IVN-008`, `IVN-012`, `IVN-015` | `INVENTORY_ARCHITECTURE.md` |
| `ICO-001`, `ICO-031` | `INVENTORY_COSTING_ARCHITECTURE.md` |
| `PRD-119`, `PRD-121`, `PRD-123`, `PRD-126` | `PRODUCT_ARCHITECTURE.md` |
| `RET-033` | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `BR-007`, `BR-035`, `BR-036`, `BR-104`, `BR-105`, `BR-109`, `BR-116`, `BR-119`, `BR-122`, `BR-128`, `BR-129`, `BR-140`, `BR-141` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `NOT-001`, `NOT-013` | `NOTIFICATION_ARCHITECTURE.md` |
| `AGV-012`, `AGV-020`, `AGV-035` | `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `PRM-004`, `PRM-009`, `PRM-011`, `PRM-051` | `PERMISSION_ARCHITECTURE.md` |
| `AUD-002`, `AUD-013`, `AUD-014`, `AUD-021`, `AUD-022` | `AUDIT_ARCHITECTURE.md` |
| `SMA-047`, `SMA-057` | `STATE_MACHINE_ARCHITECTURE.md` |
| `E-020` – `E-068` references, `DM-001`, `DM-002`, `DM-054`, `DM-057`, `DM-072`, `INV-42.1`, `INV-42.2`, `INV-43.3` | `DOMAIN_MODEL.md` |
| §3.3, §8.2.a, §10.4 – §10.6 | `DESIGN_CONSTITUTION.md` |
| `DOC-005`, `DOC-006`, `DOC-024` | `MASTER_DOCUMENTATION_INDEX.md` |

## 23.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`SYS §11.1`'s interim placement resolved** — the report register now has its owning document | `RPT-010` |
| **`GAP-004` narrowed by `SYS-088`, not closed** — Net Profit is defined; the four shipped KPIs are not | §5.1 |
| **No customer ledger proposed** — the asymmetry is justified | `RPT-024` |
| **`BR-010` generalised to `BR-141`** — Completed vs Closed across every lifecycle | `RPT-045` |

---


# Employee Advance reporting — 2026-08-10

**Source:** `BD-448`, `BD-449`. **Post-Freeze amendment under `DOC-067`. Requirements only — no layout, no printable design.**

> **RPT-055 — The Employee Advance Ledger is a derived view over Advance Requisitions, disbursements, settlements and adjustments. It stores no balance** (`BD-448`, `DB-001`, `ACC-071`).

> **RPT-056 — Per-requisition traceability is preserved beneath the employee aggregate. The aggregate is the sum of the per-requisition positions and is never independently editable** (`BD-449`, `ACC-064`, `ACC-071`).

**Four requirements are recorded:** **Employee Advance Ledger** · **Employee Advance Statement** · **per-Advance-Requisition history** · **employee aggregate outstanding position**.

> ✅ **`SYS-090`'s Supplier Ledger is the structural precedent** — it already carries seven transaction types **including Advance Payment**, with a derived outstanding balance. **`RPT-024` supplies the justification test**: a ledger exists per party **where a running balance does**, which is why suppliers have one and customers do not. **An employee carrying an outstanding advance carries exactly such a balance.**

> ⚠ **Report priority is not set here.** It belongs with the confirmed V1 report register (`SYS §11.1`, `SYS-087` – `SYS-092`), and **inventing a priority number would be inventing a business decision.**

> ⚠ **Printable rendering is NOT in scope here.** The **Advance Requisition printable document**, the **Employee Advance Statement** and the **Employee Advance Ledger** as printed artefacts are **carried to Document / Printable Architecture**, which owns rendering (`BD-448`).


# 24. Version History

| Version | Date | Change |
|---|---|---|
| **1.2.0** | **2026-08-10** | ✅ **Employee Advance reporting requirements recorded — `BD-448`/`BD-449`, `RPT-055`/`RPT-056`. Post-Freeze amendment under `DOC-067`. Requirements only; no layout designed.** **The Employee Advance Ledger is a DERIVED VIEW over requisitions, disbursements, settlements and adjustments and stores no balance** (`DB-001`); **per-requisition traceability is preserved beneath the employee aggregate, which is never independently editable.** **Four requirements recorded**: ledger · statement · per-requisition history · aggregate outstanding position. ✅ **`SYS-090`'s Supplier Ledger is the structural precedent** — seven transaction types **including Advance Payment** with a derived outstanding — and **`RPT-024` supplies the test**: a ledger exists per party **where a running balance does**, which is why suppliers have one and customers do not. ⚠ **Report priority NOT set** — it belongs with the V1 report register, and inventing a number would be inventing a business decision. ⚠ **Printable rendering CARRIED to Document / Printable Architecture** |
| **1.1.0** | **2026-08-09** | **Trade-In pointer corrected — no report or rule changed.** The Trade-In domain row named `SM-18` and `SM-19` rather than an owning document, because **none was registered**; it now resolves to [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) (`DOC-063`). **The finding is unchanged — no trade-in report is registered in the confirmed V1 set**, and outstanding Trade-In Credit remains reportable as an **Accounting** obligation (`ACC-040`) |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §19 (`BD-313`, `BD-314`) with `SYSTEM_ARCHITECTURE.md` §11.1 (`SYS-087` – `SYS-092`), `ACC §12`, `RET §20` and `DB-067`. **55 rules (`RPT-000` – `RPT-054`), all traceable; no business rule, entity, state machine, workflow or calculation introduced.** **`RPT-000` records the strictest ownership boundary in the set — this module owns no figure**, and `RPT-039` records that **no calculation is defined here**; `SYS-088` remains the ratified Net Profit definition. **`RPT-010` resolves `SYS §11.1`'s interim placement of the report register.** **`RPT-035` records eight reporting categories for which no report is registered** — marketplace, settlement, warranty, return & exchange, trade-in, audit, access governance and work queues — **and invents none.** Twelve open items carried; **`GAP-004`, `GAP-082`, `GAP-033` and the `BR-141` disclosure scope explicitly not converted into rules** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies reporting business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology. It owns no business figure.*


---

## HR & Payroll reporting requirements — recorded 2026-08-10

> **RPT-057 — Twelve HR & Payroll reports are supported by the architecture, and none is designed here** (`HRP-060`, `DOC-005`, `DOC-023`).

**Attendance · Salary Sheet · Payslip · Payroll Run · Overtime statement · Deduction statement · Salary history · Advance Requisition recovery · Employee Loan ledger/statement · Bonus and Commission statement · Outstanding Salary Payable · Final Settlement inputs.**

✅ **Each is computable from `E-090` – `E-099` plus the Accounting-owned positions `ACC-086` and `ACC-093`.** ⚠ **No printable or document design is specified** — that is the Document/Printable stage.

> **RPT-058 — A payslip must be able to show `HRP-029`'s seven pre-finalisation figures** (`BD-481` §10).
>
> **Earnings · calculated attendance and LWP deductions · other authorised deductions · proposed AR recovery · expected loan instalment · actual loan recovery · resulting Net Salary.**

> **RPT-059 — Every salary-bearing report is a `PRM-011` sensitive class** (`PRM-083`, `AGV-012`). ⚠ **Report access does not bypass the sensitive-class grant.**

---

## Final Settlement reporting requirements — recorded 2026-08-10

> **RPT-060 — The immutable settlement snapshot exposes everything a later Final Settlement Statement needs, and no document is designed here** (`HRP-088`, `DOC-005`).

**Employee · settlement reference · as-at point · every position considered with outstanding, authorised, applied and remaining · linked settlement movements · the computed Position · prepared by · recovery authorised by · finalised by · timestamps · correction references · employee-wise settlement history.**

> **RPT-061 — Direction is reported explicitly and never inferred from an arithmetic sign** (`BD-491` §7, `INV-100.7`).
>
> **Trioloo Payable to Employee · Fully Settled · Employee Receivable.** ⚠ **A negative number must never be presented without its direction.**

> **RPT-062 — A settlement report shows the underlying positions, never a consolidated balance** (`INV-100.2`). ⚠ **Reporting must not present the Position in a way that implies a third receivable exists.**

