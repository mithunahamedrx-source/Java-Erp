# HR & Payroll — Business Architecture

**Owner:** Trioloo Technology · **Module:** HR & Payroll · **Status:** Canonical
**Version:** 1.3.0 · **Ratified:** 2026-08-10 · **Amended:** 2026-08-10 (Leave Management — §19) · **Amended:** 2026-08-10 (Final Settlement — §18) · **Rule prefix:** `HRP-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §41 (`BD-457` – `BD-489`), §44 – §46 (`BD-495` – `BD-497`), and the HR-relevant parts of §40 and §43.

**Inherits:** [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) `SYS-078` (in scope), `SYS-093` **as amended 2026-08-10** (V1 scope).
**References:** [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-077`, `E-090` – `E-099` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) §8A, §8B, §8C · [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) §15C, §15D · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) `AGV-010` · [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §27.

**Scope:** **Minimal V1.** This document specifies business architecture only. It contains no code, schema, API contract or user interface specification.

---

# 1. Purpose and Boundary

> **HRP-000 — This document answers *what an employee is owed and what is recovered from them through payroll*. It answers nothing about who the employee is as an actor, and nothing about where money physically moves.**

## 1.1 What HR & Payroll owns

> **HRP-001 — HR & Payroll owns the payroll extension of the operational profile, attendance, payroll calculation, and the payroll occurrence of every earning and recovery** (`DOC-005`).

| Owned | Entity |
|---|---|
| The payroll extension of `E-077` | **`E-090` Employee Payroll Profile** |
| Attendance expectation, sessions, evaluation and waiver | **`E-091` Attendance Day** |
| Overtime approval | **`E-092` Overtime Approval** |
| The payroll run and its finalisation | **`E-093` Payroll Run** |
| One employee's finalised payroll outcome | **`E-094` Payroll Result** |
| Salary increment authorisation | **`E-095` Salary Increment** |
| General / Performance Bonus authorisation | **`E-096`** |
| Sales Commission authorisation | **`E-097`** |

## 1.2 What HR & Payroll does NOT own

> **HRP-002 — HR & Payroll owns no identity, no financial position, and no money movement.**

| Not owned | Owner | Rule |
|---|---|---|
| **The Operational User Profile** | **Permission / Access Governance** | `AGV-010`, `INV-77.6`, `DM-068` |
| **Advance Requisition position** | **Accounting** | `ACC-060`, `ACC-061` |
| **Employee Loan position** | **Accounting** | `ACC-086` (§8B) |
| **Outstanding Salary Payable position** | **Accounting** | `ACC-093` (§8C) |
| **Cash / Bank / MFS movements** | **Payment** | `PAY-087` – `PAY-097` |
| **`Confirmed By` / `Confirmed At`** | **Order Management** | `BR-163` – `BR-167` |
| **Final Settlement** | **A computed cross-domain view** | `BD-490` §2 — no subledger here |

> **HRP-003 — HR & Payroll EXTENDS `E-077`. It never duplicates, replaces or becomes authoritative for it, and no separate Employee master exists** (`AGV-010`, `BD-373`, `BD-473`, `INV-77.6`).
>
> ⚠ **`E-006` Employee is superseded by `E-077`** (`DM-068`) **and is not resurrected here.** **The correction recorded at `DOMAIN_MODEL.md` v3.17.1 stands.**

---

# 2. Employee Payroll Profile

> **HRP-004 — `E-090` carries the employee-specific payroll facts `E-077`'s Employment Information does not** (`BD-460`, `BD-463`, `BD-466`, `BD-473`).
>
> **Monthly Salary with effective-dated history · Working Days · Weekly Off Day(s) · Scheduled Start · Scheduled End · Scheduled Daily Working Hours · Scheduled Lunch / non-working interval · Attendance Grace Period · applicable Holiday Calendar reference · Attendance applicability / exemption.**
>
> ✅ **This discharges the shortfall recorded four times** — `BD-460`, `BD-463`, `BD-466`, consolidated at `BD-473`. **`E-077` continues to expose *salary reference* and *working hours*; `E-090` supplies the authoritative payroll detail.**

> **HRP-005 — Salary history is the correctness mechanism, not an audit convenience** (`BD-495` §5, §8, `AGV-002`, `DB-003`).
>
> **Historical payroll resolves against the Monthly Salary effective for that period.** ⚠ **`BD-458`'s six derived figures are explicitly not stored, and nothing retains the salary basis on a finalised run** — **so the effective-dated history is the only mechanism by which a historical run can be recomputed correctly.**
>
> **The profile exposes the currently effective Monthly Salary; it is not the source of truth** (`BD-495` §3, `DB-001`). **Editing a displayed salary field changes nothing** — **only an authorised `E-095` does.**

> **HRP-006 — A holiday calendar is a shared referenced entity, never attributes copied per employee** (`BD-473`, `PRD-132`, `SYS-021`, `DOC-006`, `CP-9`).
>
> **Many profiles may reference one calendar while each remains linked to its applicable one.** ⚠ **Sharing a reference is not hard-coding a rule** — **one profile could differ tomorrow without touching the others.**

> **HRP-007 — Attendance applicability is profile information, never a permission bypass** (`BD-460`, `BD-466`, `BD-473`).
>
> **An Owner may be attendance-exempt while still carrying full employment and payroll information**, and **multiple Owners are supported** (`AGV-030` as amended). ⚠ **Exemption is evaluated as applicability; it never suppresses a permission check** (`AGV-033`, `PRM-068`).

---

# 3. Attendance

> **HRP-008 — Attendance resolves through seven stages, and the stages are never collapsed** (`BD-473`).
>
> **Employee/Profile Schedule → Working Day / Weekly Off / Holiday → Approved Leave / LWP → Attendance Expectation → Raw Attendance Sessions → Attendance Evaluation → Approved Payroll Inputs → Payroll Calculation.**
>
> ✅ **Expectation and fact are separate stages, and evaluation is a third.** **`BR-038`'s discipline: retaining both is what makes the difference detectable.**

> **HRP-009 — A day may contain multiple IN/OUT sessions, and worked duration is derived from them** (`BD-461`, `BD-462`).
>
> **The normal case is one IN and one OUT; the architecture supports many.** **Session timestamps are server-recorded** (`AUD-004`). ⚠ **A gap between sessions is not automatically a break, and acquires no meaning it was not given** (`BD-462`, `SYS-034`).

> **HRP-010 — A missing punch is an exception, never a substituted value** (`SYS-034`, `API-008`).
>
> **The ERP holds *not available*, never a zero, an assumed time or a derived one.** **`BD-462`'s floor applies to what is known, not to what is missing.**

> **HRP-011 — An attendance correction retains the original session and links the correction to it** (`DB-002`, `DB-003`, `BD-475`).
>
> **Never edit in place. Preserve the original, the corrected value, the reason, the actor and the timestamp.** ✅ **Never-edit-always-relink, applied to attendance.**

> **HRP-012 — The scheduled lunch interval is EXCLUDED from worked duration, not deducted from pay** (`BD-463`).
>
> ⚠ **The distinction is load-bearing**: **exclusion changes the measurement; a deduction would change the money.** **Lunch never produces a deduction line.**

**Not created:** biometric capture · GPS · face recognition · geofencing · device binding. **None is a business rule; none is architected here.**

---

# 4. Attendance Evaluation and Deductions

> **HRP-013 — Late deduction = completed late hours × Hourly Rate** (`BD-467`).
> **HRP-014 — Early Departure deduction = completed early hours × Hourly Rate** (`BD-469`).
> **HRP-015 — Absence deduction = the Daily Rate** (`BD-468`).
> **HRP-016 — Leave Without Pay deduction = the Daily Rate** (`BD-472`).

> **HRP-017 — The same missing time is never charged twice** (`BD-469`, `BD-472`).
>
> | Prevented | Rule |
> |---|---|
> | **Early Departure charged again as short worked duration** | `BD-469` |
> | **LWP charged again as Absent** | `BD-472` |
>
> ⚠ **LWP and Absent deduct the same amount on the same basis and must never be collapsed** — **the reason is the record** (`BD-472`). **Identical money, distinct meaning.**

> **HRP-018 — A payroll deduction waiver is an Owner/Administrator decision, may be full or partial, and preserves three figures** (`BD-470`, `BD-471`, `PRM-073`, `PRM-074`).
>
> **`0 ≤ Waived ≤ Calculated`**, a deterministic enforced bound. **Calculated amount · waived amount · final amount are retained separately, never overwritten** (`BR-038`).
>
> ✅ **Self-waiver is permitted and the identity is retained** (`PRM-073`, `PRM-074`).
> \U0001F534 **Only Late, Absent and Early Departure are waivable** (`BD-471` §9). ⚠ **Advance Requisition recovery, Employee Loan instalment, damage/loss, tax and provident fund are NOT** — **waiving a recovery of money already received would be forgiving a debt, which is a write-off** (`ACC-067`, `ACC-090`), **not a payroll concession.** **No extension by pattern-matching.**

---

# 5. Overtime

> **HRP-019 — `Potential OT = MAX(0, actual eligible worked duration − Scheduled Daily Working Hours)`** (`BD-462`, `BD-463`).
> **HRP-020 — Potential OT is not payable OT. `0 ≤ Approved OT ≤ Potential OT`** (`BD-464`), a deterministic enforced bound.

> **HRP-021 — Overtime uses the ACTUAL approved duration proportionally, and is never truncated to whole hours** (`BD-483`).
>
> **9h40m against a scheduled 8h leaves 1 hour 40 minutes**, converted as **1 + 40/60** at full precision. ⚠ **Duration is preserved in exact time units — 100 minutes is the authoritative fact, not 1.67 hours** (`DB-001` applied to a non-monetary quantity).
>
> ⚠ **This deliberately differs from Late and Early Departure, which use completed hours** (`BD-483` §6). **Do not force symmetry between earnings and deductions.**

> **HRP-022 — Unapproved potential OT stays pending. It does not block payroll finalisation, does not expire, and may be approved in a later run while retaining its earned period** (`BD-465`).
>
> ⚠ **`E-092` therefore carries an earned period and a nominated payroll period, and they may differ.**

> **HRP-023 — `OT Rate = Hourly Rate × 120%`** (`BD-458`).

---

# 6. Rates and Rounding

> **HRP-024 — Every rate derives from that employee's own figures and none is stored** (`BD-458`, `BD-473`, `DB-001`, `ACC-001`).
>
> **`Daily Rate = Monthly Salary ÷ 30`** — a fixed 30-day basis regardless of calendar length. **`Hourly Rate = Daily Rate ÷ that employee's Scheduled Daily Working Hours`.**
>
> ⚠ **No globally hard-coded schedule or salary basis** (`BD-473`).

> **HRP-025 — Payroll money is 2 decimal places, HALF-UP, rounded at the line and never at the rate** (`BD-482`).
>
> **High-precision derived rate → calculate the payroll line → round the line to 2dp → sum the rounded lines → Gross, Total Deductions, Net Salary.** ⚠ **Never recalculate Net Salary independently from raw rates.**
>
> **Decimal arithmetic, never binary floating point** (`DB-037`, `INV-41.2`). ⚠ **Duration rounding is a separate rule from money rounding** (`BD-482` §8, `BD-483`).
>
> ✅ **AMENDED 2026-08-10 — the policy is now ERP-WIDE and Payroll CONSUMES it.** **`DB-079` is the canonical owner**; **Payroll states no rounding rule of its own** (`DOC-005`, `DOC-006`). ✅ **Payroll's treatment is unchanged in substance** — 2dp `HALF_UP`, rounded at the line, never at the rate — **it is simply no longer payroll-specific.**
>
> ⚠ *(Original, retained under `DOC-009`: “Scoped to Payroll. No ERP-wide monetary rounding policy is created here — that remains a Final Cross-Domain Reconciliation item.”)* ✅ **That Final Cross-Domain Reconciliation item is now CLOSED.**
>
> 🔴 **Duration rounding is untouched.** **`BD-483` overtime, `BD-467` late and `BD-469` early-departure completed-hour rules are NOT monetary lines and keep their own rules** (`DB-079` scope).

---

# 7. Payroll Run

> **HRP-026 — The payroll period is a calendar month, and salary is paid within the first seven days of the following month** (`BD-457`).

> **HRP-027 — The payroll run lifecycle is `PREPARATION / DRAFT → FINALISED`** (`BD-475`).
>
> ✅ **Two states, one forward transition.** ⚠ **No approval workflow, no multi-stage sign-off, no reopening.**

> **HRP-028 — A finalised run is never reopened or edited. Corrections are new linked adjustments carried into a later run** (`BD-475`, `DB-002`, `DB-003`).

> **HRP-029 — Before finalisation the preparer must see the complete calculation** (`BD-481` §10): earnings · calculated attendance and LWP deductions · other authorised deductions · **proposed AR recovery · expected loan instalment · actual loan recovery · resulting Net Salary.**
>
> ✅ **This is what makes the `HRP-035` choice possible at all**, and **it constrains what a payslip must be able to show.**

> **HRP-030 — `Net Salary ≥ 0` is a deterministic enforced constraint on the final payroll result** (`BD-481`, `BD-491` §8 as clarified).
>
> ⚠ **PAYROLL ONLY.** **`BD-491` clarified `BD-481`'s scope**: *the final payroll result* means the final result of a payroll calculation, **not every later calculation using payroll-derived amounts.** ✅ **Final Settlement may be positive, zero or negative and is governed separately.**
>
> ✅ **A Net Salary of exactly zero is a legitimate outcome** (`BD-481` §7, §9). **No protected minimum take-home exists.**

> **HRP-031 — A salary increment takes effect only from the start of a payroll period** (`BD-495` §4).
>
> **Because the period is a calendar month, the effective date is the first day of a month.** ⚠ **Mid-month effective increments are not supported in V1**, **which is what keeps `Monthly Salary ÷ 30` single-valued within any run.** ✅ **A future-dated increment is authorised now and takes effect later; the current salary applies until then** (`BD-495` §6).

---

# 8. Earnings

> **HRP-032 — Every discretionary earning becomes authoritative only on explicit Owner/Administrator authorisation** (`BD-496` §3, `BD-497` §6).
> **HRP-033 — Every authorised earning NOMINATES its payroll period. No date determines it** (`BD-496` §5, `BD-497` §9).
>
> ⚠ **Not the authorisation date, not the confirmation date, not the delivery date.** **Where the nominated period is already finalised, `HRP-028` applies.**

> **HRP-034 — A discretionary earning is separately identifiable and never merged into Monthly Salary** (`BD-496` §6).
>
> \U0001F534 **This prevents a real defect, not an untidiness.** **`HRP-024` derives every rate from Monthly Salary** — **so a 5,000 bonus merged into September's salary would raise that month's Daily Rate from 1,000 to 1,166.67 and move every late, early-departure, absence and LWP deduction and every OT payment with it.**

## 8.1 Sales Commission

> **HRP-035 — Sales Commission is a configurable fixed monetary amount per eligible delivered Order** (`BD-497` §2). ⚠ **Not a percentage, margin, target or tier. Configurable, never hard-coded.**

> **HRP-036 — Commission belongs to the Order's `Confirmed By` profile, consumed from Order Management and never re-derived** (`BD-497` §3, `BR-163` – `BR-165`).
>
> ⚠ **`Assigned Agent` is not a substitute** — **allocation is not attribution.**

> **HRP-037 — Delivery is the eligibility point; authorisation is the payable point** (`BD-497` §5, §6).
>
> **Confirmed ≠ Eligible · Delivered = Eligible · Eligible ≠ Authorised · Authorised = Authoritative.**
>
> ✅ **Eligibility coincides with revenue recognition** (`BD-304`) — **the business earns and the employee earns at the same event.**

> **HRP-038 — An `AUTO_CONFIRMED` Order generates no automatic human commission, and no confirmer is fabricated** (`BD-497` §4, `BR-166`, `SYS-034`).
>
> ⚠ **Not reassigned to `Assigned Agent`, Owner, Administrator, shop owner or channel owner.**

> **HRP-039 — A cancellation before delivery produces no commission and requires no reversal; a return after delivery creates no clawback in V1** (`BD-497` §7, §8).
>
> ✅ **Cancellation needs no reversal machinery because eligibility never arose.** ⚠ **The return case is a deliberate economic asymmetry, chosen knowingly**: **revenue reverses, the commission does not.** **Return-based reversal is a named future extension.**

---

# 9. Deductions and Recoveries

> **HRP-040 — Three deduction classes behave differently, and the difference is structural** (`BD-481`).
>
> | Class | Behaviour |
> |---|---|
> | **Attendance / LWP / established** | **Calculated from their own rules; never reduced to make room** |
> | **Advance Requisition recovery** | **Flexible — explicitly chosen per run to fit** |
> | **Employee Loan instalment** | **Residual — reduces when capacity is short** |

> **HRP-041 — The employee-debt capacity sequence is a boundary, not a priority engine** (`BD-481` §6).
>
> **A. earnings and established deductions → B. explicit AR recovery that fits → C. loan instalment up to remaining salary → D. `Net Salary ≥ 0`.**
>
> ⚠ **No FIFO, proportional allocation or ranking between AR and Loan.** ✅ **A defined sequence for one boundary, with an explicit refusal to generalise it.**

## 9.1 Advance Requisition recovery

> **HRP-042 — Payroll owns the recovery OCCURRENCE; Accounting owns the position. Payroll stores no advance balance** (`ACC-060`, `SYS-027`, `BD-478`).
> **HRP-043 — Each AR recovery is an explicit per-run human decision, allocated to a specific requisition** (`BD-478`, `ACC-064`, `ACC-065`). ⚠ **No FIFO, oldest-first, proportional allocation or anonymous employee total.**
> **HRP-044 — The chosen amount must satisfy both bounds: not exceeding the selected requisition's outstanding balance, and not driving Net Salary below zero** (`BD-481` §3). **An over-capacity recovery is deterministically refused, not warned** (`BD-481` §8).
> **HRP-045 — The payroll deduction and the Advance settlement allocations reconcile to the same figure** (`BD-450`, `ACC-064`).

## 9.2 Employee Loan recovery

> **HRP-046 — Payroll consumes the expected instalment from the Accounting-owned schedule and owns only the recovery occurrence** (`BD-479` §6, `ACC-086`, `SYS-027`).
> **HRP-047 — Expected instalment and actual recovery are retained separately, and the difference is the instrument** (`BD-479` §5, `BR-038`, `PAY-002`).
> **HRP-048 — Where capacity is short, only the available amount is recovered; the shortfall stays outstanding and never inflates the next instalment** (`BD-480` §2, §3).
> **HRP-049 — Recovery may never exceed the remaining outstanding balance** (`BD-486` §3). **At the end of a loan the final recovery truncates to what remains.**
> **HRP-050 — Two cases are distinguished and never collapsed: insufficient payroll capacity (a calculated constraint) and an authorised pause or reduction (a business decision)** (`BD-480` §6).
>
> ⚠ **Only the second has an accountable decision-maker.** **Collapsing them would make an authorised concession indistinguishable from an arithmetic outcome.**

---

# 10. Salary Payable — the obligation Payroll creates

> **HRP-051 — Finalising a payroll run establishes the salary obligation; paying it is a separate fact** (`BD-476`, `ACC-093`).
>
> **`Outstanding Salary Payable = Finalised Net Salary − Confirmed Salary Payment movements`.**
>
> ✅ **Derived, never stored and never editable** (`DB-001`, `ACC-001`). **Partial and split payment are supported** (`BD-476`). ⚠ **The position is Accounting-owned** (`ACC-093`); **Payroll establishes it and never maintains a competing balance** (`SYS-027`).

> **HRP-052 — A balance is visible, not a trigger.** **The outstanding position does not itself initiate payment** (`BD-476` §5, `BD-459`, `BD-465`). **Payment is an explicit act** (`PAY-091`).

---

# 11. Cross-Module Contracts

> **HRP-053 — Every cross-module relationship follows one shape: the owning capability holds the position, HR & Payroll holds the occurrence, and the two reconcile** (`SYS-004`, `SYS-005`, `SYS-027`, `DOC-005`).

| Position | Owner | HR & Payroll's part |
|---|---|---|
| **Advance Requisition outstanding** | **Accounting** `ACC-060` | **The recovery occurrence** `HRP-042` |
| **Employee Loan outstanding** | **Accounting** `ACC-086` | **The recovery occurrence** `HRP-046` |
| **Outstanding Salary Payable** | **Accounting** `ACC-093` | **The finalised run that establishes it** `HRP-051` |
| **Cash / Bank / MFS movements** | **Payment** `PAY-087` – `PAY-097` | **Consumes confirmation; records no movement** |
| **`Confirmed By` / `Confirmed At`** | **Order Management** `BR-163` | **Consumes for `HRP-036`; never re-derives** |
| **Operational identity** | **Permission** `AGV-010` | **Extends one component** `HRP-003` |

> **HRP-054 — HR & Payroll exposes the authoritative positions Final Settlement needs and builds no settlement subledger** (`BD-490` §2, `BD-492` §12).
>
> **Exposed:** finalised salary payable · authorised but unpaid OT, bonus, commission and adjustments · payroll deduction and recovery facts. ⚠ **Loan and AR balances are NOT duplicated into Final Settlement** — **it reads them from Accounting.**

---

# 12. Permissions

> **HRP-055 — Ten payroll actions are separately permissioned, and none is inferred from another** (`PRM-002`, `PRM-003`, `PRM-004`, `PRM-079` – `PRM-084`).

| Action | Authority |
|---|---|
| **View salary** | **Sensitive class** — separately grantable (`PRM-011`, `AGV-012`) |
| **Prepare / process payroll** | **Permission-controlled** (`BD-484` §5) |
| **Finalise payroll** | **Permission-controlled** |
| **Pay salary** | **Payment-side permission** |
| **Waive an attendance deduction** | **Owner / Administrator** (`BD-470`, `PRM-073`) |
| **Authorise a salary increment** | **Owner / Administrator** (`BD-495` §2) |
| **Authorise a General / Performance Bonus** | **Owner / Administrator** (`BD-496` §3) |
| **Authorise a Sales Commission** | **Owner / Administrator** (`BD-497` §6) |
| **Employee Loan authority** (authorise · pause/reduce · amend schedule · write off) | **Owner / Administrator** (`PRM-075` – `PRM-078`) |
| **Decide an AR recovery for a run** | **Permission-controlled** (`BD-478`) |

> **HRP-056 — Every material payroll decision records actor, timestamp and source** (`AUD-004`, `AUD-012`, `AGV-001`).
> **HRP-057 — Where one person performs two roles in one decision, both are recorded and never collapsed** (`PRM-070`, `PRM-072`, `PRM-074`, `PRM-078`).

---

# 13. State Machines and Events

> **HRP-058 — HR & Payroll defines NO state machine, and this is a determination rather than an omission** (`SMA-085`).
>
> | Candidate | Assessment |
> |---|---|
> | **`E-093` Payroll Run** | **Two states, one forward transition, no branching disposition and no prohibited transition to enforce beyond *do not reopen* (`HRP-028`).** **A lifecycle attribute, not a machine** |
> | **`E-091` Attendance Day** | **Evaluated, not transitioned.** **Its outcome is derived from sessions and schedule** |
> | **`E-092` Overtime Approval** | **`0 ≤ Approved ≤ Potential` is a bound, and pending is the absence of approval, not a state** (`BD-465`) |
> | **`E-095` – `E-097` authorisations** | **Authorised or not. A single act, not a lifecycle** |
> | **`E-098` Employee Loan** | **Completion is a computed condition over the derived balance, never a state** (`ACC-089`, `BD-479` §7, `BD-486` §4) |
>
> ✅ **The same test `SM-14`, `SM-16`, `SM-20` and `SM-21` were put to.** **Twenty-one machines remain; none is added.**

> **HRP-059 — HR & Payroll publishes NO event in V1** (`EVA-033`).
>
> **Tested against the three grounds:** **prohibited-transition enforcement** — none exists beyond `HRP-028`, enforced locally; **independent lifecycle ownership** — no consumer owns a lifecycle that payroll finalisation drives; **genuine cross-module reaction** — **Accounting and Payment are reached by explicit request under the `HRP-053` contracts, which `SYS-006` permits equally with events.**
>
> ⚠ **A state transition is not automatically an event, and no event is created for catalogue symmetry.** ✅ **The event count stays 102.** **The fifth proven negative.**

---

# 14. Reporting Requirements — recorded, not designed

> **HRP-060 — The architecture supports twelve reports, and no printable or document design is specified here** (`RPT-057`, `DOC-005`).

**Attendance · Salary Sheet · Payslip · Payroll Run · OT statement · Deduction statement · Salary history · Advance Requisition recovery · Employee Loan ledger/statement · Bonus and Commission statement · Outstanding Salary Payable · Final Settlement inputs.**

✅ **Each is computable from `E-090` – `E-099` plus the Accounting-owned positions.** ⚠ **`HRP-029`'s seven pre-finalisation figures are what a Payslip must be able to show.**

---


---

# 18. Final Settlement — Minimal V1

**Source:** `BD-490` – `BD-494`. **A cross-domain computed settlement view used when employment ends.**

## 18.1 Ownership — tested, not assumed

> **HRP-061 — Final Settlement is owned by HR & Payroll, and no new module or rule prefix is created** (`DOC-005`, `CP-9`, `ACC-061`'s precedent).

**The test the corpus uses for a cross-domain capability is `ACC-060`/`ACC-061`'s: *does it maintain an accounting position?***

| Candidate owner | Assessment |
|---|---|
| **Accounting** | 🔴 **The test does not select it.** **Final Settlement maintains NO position** — **that is its defining property** (`BD-492` §12). **The accounting-position argument that placed Advance Requisition, Employee Loan and Salary Payable in Accounting has nothing to attach to here** |
| **A new module** | ⚠ **Rejected.** **`ACC-061` already refused this move for a smaller capability** — *no new top-level module is created* — **and Final Settlement maintains even less** |
| **HR & Payroll** | ✅ **Selected.** **Employment ending is the triggering context, `HRP-054` already obliges this module to expose the positions the view needs, and what Final Settlement DOES maintain — recovery authorisation decisions and a settlement record — is an employment-lifecycle artefact** |

> ⚠ **This does not breach `HRP-002`.** **Final Settlement is not a financial position; it is a view plus a decision record.** ✅ **The shape is already established**: **`HRP-042` has Payroll deciding an Advance recovery against an Accounting-owned position every run.** **The occurrence is HR's, the position is Accounting's, the movement is the owning capability's.**

## 18.2 The computed view

> **HRP-062 — Final Settlement is a computed view over authoritative underlying positions and is never an independently maintained balance** (`BD-490` §2, `BD-492` §12, `SYS-027`, `DB-001`).
>
> **It answers one question: *what does Trioloo owe this employee, and what does this employee owe Trioloo, as at this settlement point?*** ⚠ **It never replaces the underlying positions**, and **must always be reproducible from them plus the movements committed at finalisation.**

> **HRP-063 — Two entities carry the capability: `E-100` Final Settlement and `E-101` Final Settlement Recovery Authorisation. Neither holds a balance.**

## 18.3 Participating positions

> **HRP-064 — The positive side participates AUTOMATICALLY, because each item has already passed its own authorisation gate** (`BD-492` §1).
>
> **Outstanding Salary Payable** (`ACC-093`) · **approved but unpaid overtime** (`E-092`) · **authorised payroll adjustments** (`BD-475`) · **authorised General / Performance Bonus** (`E-096`) · **authorised Sales Commission** (`E-097`).
>
> ⚠ **Final Settlement does not re-approve them; it consumes them.** 🔴 **Proposed, pending or unauthorised earnings do NOT participate**, and **no Bonus or Commission obligation is invented because a type exists** (`BD-496` §3, `BD-497` §6).

> **HRP-065 — The negative side is INVITED, never automatic** (`BD-492` §2, `BD-490` §3).
>
> **Outstanding liability ≠ authorised settlement recovery.** ⚠ **Employment ending provides no recovery authority.** **Potential participants: Employee Loan** (`ACC-086`) **and Advance Requisition** (`ACC-060`).

> ✅ **The asymmetry is principled, not arbitrary**: **an earned salary or approved OT has ALREADY been authorised, so re-approving it at settlement would be a second gate on a decision already made.** **A liability has passed no gate for THIS recovery.**

## 18.4 Recovery authorisation and application

> **HRP-066 — Recovery participation is authorised PER UNDERLYING POSITION, never generically** (`BD-492` §3).
>
> ⚠ **The system must never accept *“recover 20,000 from this employee”***. **It must identify Loan A 15,000 and AR B 5,000.** **No FIFO, oldest-first, proportional allocation or anonymous employee-level recovery** (`ACC-064`, `ACC-065`, `ACC-092`).

> **HRP-067 — Three figures are retained per position and none overwrites another** (`BD-492` §6, `BR-038`):
>
> **`0 ≤ Applied ≤ Authorised ≤ Outstanding`** — **a deterministic enforced three-level bound**, plus the **remaining underlying balance.**
>
> ⚠ **Partial authorisation is NOT a write-off** (`BD-492` §4). **Any unapplied amount remains in its original position** (`BD-493` §6) — **not written off, not transferred, not accelerated, not lost.**

> **HRP-068 — `Σ Authorised Settlement Recoveries ≤ Available Employee-Payable Value` before finalisation** (`BD-493` §1).
>
> **20,000 available permits 15,000 + 5,000, or 20,000 + 0.** ⚠ **It refuses 20,000 + 5,000.**

> **HRP-069 — The capacity rule is a correctness constraint, not a warning, and the system never chooses which recovery to reduce** (`BD-493` §5, `CP-8`).
>
> **Where `Σ Authorised > Available`, finalisation is refused and the Owner/Administrator must reduce or remove amounts.** ✅ **The constraint is enforced deterministically; the choice stays human.**
>
> ✅ **This is why no application-order rule exists**: **the authorisation must fit, so competing recoveries never arise.** ⚠ **No FIFO, proportional allocation, ranking, residual allocation or priority engine** (`BD-493` §2).

> **HRP-070 — If available payable value changes before finalisation, the settlement is recalculated and the authorisation adjusted. No liability is silently reduced** (`BD-493` §4).

## 18.5 The Final Settlement Position

> **HRP-071 — The Position REPRESENTS the unresolved underlying positions and creates nothing** (`BD-492` §8, §10, `BD-491` §4).
>
> | Result | What it does NOT create |
> |---|---|
> | **Trioloo owes 15,000** | 🔴 **No second 15,000 payable** |
> | **Employee owes 10,000** | 🔴 **No second 10,000 receivable** |
>
> **Loan remaining 7,000 plus AR remaining 3,000 may PRESENT as *employee owes 10,000*** — ⚠ **but there must never simultaneously be a 7,000 loan receivable, a 3,000 AR receivable AND a 10,000 settlement receivable.** **That would double-count one economic position** (`SYS-027`, `BD-469`, `BD-472`).
>
> ✅ **The authoritative receivables remain 7,000 and 3,000.**

> **HRP-072 — `Net Salary ≥ 0` does NOT apply to Final Settlement** (`BD-491` §1, `BD-481` as clarified at `BD-491` §8).
>
> **Payroll and Final Settlement are separate calculations.** **The final payroll period still enforces the floor** (`HRP-030`); **the settlement Position may be positive, zero or negative.**
>
> ⚠ **`BD-481`'s *“final payroll result”* means the final result of a PAYROLL calculation** — **not every later calculation using payroll-derived amounts.** ✅ **A negative Position and a satisfied payroll floor coexist on the same employee in the same month** — **which is only possible because the CALCULATIONS are separated, not the numbers.**
>
> ⚠ **A negative Position identifies a remaining amount owed. It creates no deduction, receipt, repayment, write-off or movement** (`BD-491` §4).

## 18.6 Finalisation

> **HRP-073 — Before finalisation the settlement is a preparation view. Nothing has been applied merely because it appears in the draft** (`BD-494` §1).

> **HRP-074 — Finalisation is the commit point and performs six acts in order** (`BD-494` §2, §3, §8):
>
> **1. validate every underlying position and every authorised bound, including `HRP-067` and `HRP-068` · 2. establish the settlement as-at point · 3. atomically apply the authorised recoveries THROUGH the owning capabilities · 4. preserve the links from each application to the underlying position and movement · 5. freeze the snapshot and its evidence · 6. record actor and timestamp.**
>
> ✅ **V1 needs no separate *Apply Settlement* stage.** **`DRAFT → FINALISATION → FINALIZED`** — **finalisation both validates and commits.**

> **HRP-075 — Finalisation is ATOMIC. It never partially succeeds** (`BD-494` §3).
>
> 🔴 **A loan recovery applied while an AR recovery failed, with the settlement still marked finalised, is prohibited.** **Either the complete authorised application succeeds, or finalisation fails and no movement is committed.**
>
> ⚠ **The atomicity requirement spans positions owned by another module.** ✅ **That is a stated architectural constraint, and the transaction boundary that satisfies it is an engineering deliverable** (`SYS-076`, `API-001`). **The corpus has the same shape at `INV-27.4`, `INV-65.2` and `PRD-026`, where a build reservation is all-or-nothing.**

> **HRP-076 — Final Settlement fabricates no financial movement. It triggers and coordinates the mechanisms owned by Accounting and Payment** (`BD-494` §2, `BD-492` §9, `E-089`).
>
> ⚠ **No artificial Cash, Bank, MFS or Payroll receipt, no fabricated repayment, AR settlement or write-off, to make the Position reach zero** (`BD-490` §8).

> **HRP-077 — A finalised settlement is an immutable snapshot, and *reproducible* means reproducible AS AT its finalisation point** (`BD-494` §4).
>
> ⚠ **It is never rewritten because a former employee later repays, an AR is later settled, or an underlying balance changes.** **The underlying positions continue to evolve through their own valid movements; the historical settlement does not.**

> **HRP-078 — Immutability creates no second subledger** (`BD-494` §5). **Preserve enough references to reconstruct why the result was what it was; duplicate no Loan, AR or salary balance.**

## 18.7 Correction and later-arising facts

> **HRP-079 — A finalised settlement is never edited. A correction is a new linked record** (`BD-494` §6, `BD-475`, `DB-002`, `DB-003`).
>
> **Retain the original · create an explicit linked correction · preserve reason, actor, timestamp and the relationship · route the actual financial consequences through the owning capabilities.**

> **HRP-080 — A fact that becomes authoritative after finalisation is never forced into the finalised settlement** (`BD-494` §4).
>
> **A commission becoming authoritative because an Order delivered later · a later correction creating an additional earning · an underlying position changing afterwards** — **all follow `HRP-079`.**
>
> ⚠ **No continuous settlement engine is built.** ✅ **`CP-9`.**

## 18.8 Employment ending

> **HRP-081 — Employment ending creates the settlement CONTEXT, not the AUTHORITY** (`BD-490` §7).
>
> **It never automatically writes off a Loan** (`ACC-090`, `BD-488` §3) **or an Advance Requisition** (`ACC-067`), **makes any debt immediately due, consumes salary, amends a loan schedule, deletes or suppresses a position, or fabricates a movement.**

> **HRP-082 — Identity and historical attribution survive suspension and archival** (`INV-77.2` – `INV-77.4`, `AGV-013` – `AGV-015`, `PRM-021`, `SYS-024`).
>
> **Payroll, attendance, loan, AR, payment, approval history and actor attribution are all retained.** **Archived prevents new use; it never removes the record.**

## 18.9 Payment and collection

> **HRP-083 — No Final Settlement money movement type exists** (`BD-492` §9, `BD-493` §6).
>
> | Result | Settled through |
> |---|---|
> | **Positive** | **Payment settles the underlying payable position(s)** — `ACC-093`, `PAY-091` – `PAY-093` |
> | **Negative** | **The former employee continues to owe the UNDERLYING receivables**, each governed by its owning capability — **Loan by `PAY-094` – `PAY-096`, Advance by `ACC-063`** |
>
> 🔴 **The negative view is never converted into a new consolidated receivable.**

## 18.10 Permissions

> **HRP-084 — Six settlement actions are separately permissioned** (`PRM-085`).
>
> **View settlement · prepare settlement · authorise recovery participation · finalise settlement · record the actual payment or receipt · correct a finalised settlement.**
>
> **Recovery authorisation is Owner/Administrator** (`BD-492` §5), **and it is never collapsed into loan authorisation, AR authorisation, schedule amendment, repayment recording, payroll preparation or write-off.**

> **HRP-085 — One actor may both authorise recoveries and finalise, and no dual approval is required** (`BD-494` §7, `PRM-050`).
>
> ✅ **`PRM-006` is NOT engaged, and the reason is precise: finalisation approves nothing.** **`BD-492` §5 and `BD-494` §7 make authorisation and finalisation DISTINCT ACTS ON DIFFERENT SUBJECTS** — **the recovery, and the settlement.** **There is one approval and one commit, not two approvals.** **`PRM-071`'s reasoning applies directly: *acting within authority one already holds is not self-approval — no approval step is involved.***
>
> ⚠ **This is stated as a rule rather than left as a reading**, **so that no implementation models finalisation as an approval step** — **which would engage `PRM-006`'s default and require an exception the business has not named** (`PRM-084`).
>
> **`Recovery Authorised By` and `Finalised By` are retained separately even when identical** (`PRM-070`, `PRM-072`, `PRM-078`).

## 18.11 State machine and event

> **HRP-086 — Final Settlement defines no state machine** (`SMA-086`).
>
> **`DRAFT → FINALISED`: two states, one forward transition, no branching disposition.** ⚠ **Atomicity is a transaction property, not a state.** **The only prohibition — never reopen — is a single edge enforced locally.** ✅ **The same determination `HRP-058` reached for the Payroll Run. Twenty-one machines; none added.**

> **HRP-087 — Final Settlement publishes no event** (`EVA-034`).
>
> **Prohibited-transition enforcement** — local. **Independent lifecycle ownership** — none; the owning capabilities are INVOKED by `HRP-074`, not notified. **Genuine cross-module reaction** — **`HRP-075`'s atomicity positively requires synchronous coordination, which an at-least-once asynchronous event cannot provide** (`SYS-051`, `API-035`).
>
> ✅ **The sixth proven negative, and the first where an event would have been actively WRONG rather than merely unnecessary.** **The count stays 102.**

## 18.12 Reporting and document support — data only

> **HRP-088 — The immutable snapshot exposes everything a later Final Settlement Statement needs, and no document is designed here** (`RPT-060`, `DOC-005`).
>
> **Employee · settlement reference · as-at point · every position considered with outstanding, authorised, applied and remaining · linked settlement movements · the computed Position with explicit direction · prepared by · recovery authorised by · finalised by · timestamps · correction references.**
>
> ⚠ **Direction is stated explicitly, never inferred from an arithmetic sign** (`BD-491` §7) — **Trioloo Payable to Employee · Fully Settled · Employee Receivable.**

## 18.13 What Final Settlement deliberately does NOT do

| Not built | Why |
|---|---|
| **A settlement subledger or consolidated receivable** | **`BD-490` §2, `BD-492` §12, `HRP-071`** |
| **A recovery priority engine, FIFO or proportional allocation** | **`BD-493` §2** |
| **An application-order rule** | **`HRP-069`** — the authorisation must fit, so nothing competes |
| **A `Net Salary ≥ 0` floor on the settlement** | **`BD-491` §1** |
| **Automatic collection of a negative Position** | **`BD-491` §9, `BD-492` §13** |
| **Settlement reopening or multi-stage approval** | **`BD-494` §10** |
| **A continuous settlement engine** | **`HRP-080`** |
| **A Final Settlement money movement type** | **`HRP-083`** |
| **A state machine or event** | **`HRP-086`, `HRP-087`** |
| **Statutory termination workflow, notice, gratuity** | **No business rule exists; `SYS-092` keeps statutory reporting out of V1** |



---

# 19. Leave Management — Minimal V1

**Source:** `BD-499`. **The single UI blocker identified by the V1 readiness pass, and the last capability `HRP-008`'s chain consumed without owning.**

> **HRP-089 — `E-102` Leave Request is HR & Payroll-owned. No employee identity, leave balance, entitlement or accrual entity is created** (`BD-499` §10, `CP-9`, `HRP-003`).

> **HRP-090 — A request covers a single day or CONSECUTIVE days, and carries one of two types: `PAID_LEAVE` or `LEAVE_WITHOUT_PAY`** (`BD-499` §1, §2).
>
> ⚠ **No half-day, hourly or non-consecutive request; no casual, sick, annual, earned, maternity, paternity, special or statutory category.**

> **HRP-091 — Approval requires the distinct Leave Approval permission** (`BD-499` §3, `PRM-087`).
>
> ⚠ **Never inferred from payroll access, attendance access, Reporting Manager status, HR record access, the Administrator role alone, or general employee-management access.** **Owners and Administrators may hold it; none inherits it.**

> **HRP-092 — The payroll effect does not change the authority model** (`BD-499` §4, `PRM-088`).
>
> **Leave Request → Leave Approval/Rejection → Attendance Expectation → Attendance Evaluation → Payroll Effect.** ⚠ **Payroll never decides whether Leave was valid** (`SYS-004`, `SYS-005`).
>
> ✅ **Leave approval sets an attendance expectation and the money DERIVES from it through `HRP-016`** — **which is why it is permission-bound while a deduction waiver, where the decision IS the amount, is title-bound** (`BD-470`, `PRM-088`).

> **HRP-093 — Partial approval is permitted, and the requested and approved periods are retained separately** (`BD-499` §5, `BR-038`, `INV-102.3`).
>
> **Approve the full period · reject the whole request · approve fewer days.** ⚠ **The request is never overwritten to make it appear the employee asked only for the approved days.** **A rejected request keeps its requested dates.**

> **HRP-094 — Requested days that were not approved acquire NO status** (`BD-499` §6, `SYS-034`, `INV-102.5`).
>
> 🔴 **They do not become Absent, LWP or another leave type.** **Attendance evaluates those dates on whatever other authoritative facts exist for them** — **schedule, weekly off, holiday, or actual sessions.**
>
> ✅ **Eighth residue the corpus refuses to give a default meaning**, after `BD-455`, `BD-462`, `BD-463`, `BD-466`, `BD-469`, `BD-480`, `BD-488`.

> **HRP-095 — Only an APPROVED request is an authoritative Attendance Expectation input, and it fills the slot `HRP-008` already defined** (`BD-499` §8).
>
> | Type | Attendance | Deduction |
> |---|---|---|
> | **`PAID_LEAVE`** | **Legitimate non-attendance; never Absent** | **None** |
> | **`LEAVE_WITHOUT_PAY`** | **Legitimate non-attendance; never Absent** | **`HRP-016` — the Daily Rate** |
>
> ⚠ **LWP and Absent never both charge one date** (`BD-472`, `INV-91.6`, `HRP-017`). ✅ **`HRP-008`'s chain is unchanged** — it already read *… → Approved Leave / LWP → Attendance Expectation → …* and this supplies the record that stage consumes.

> **HRP-096 — A historical Leave decision is never silently edited or deleted. A correction is a new linked record preserving actor and timestamp** (`BD-499` §9, `DB-002`, `DB-003`, `BD-475`).
>
> ✅ **Never-edit-always-relink, in its eleventh domain.**

> **HRP-097 — Leave requires NO state machine and publishes NO event** (`SMA-087`, `EVA-035`).
>
> ⚠ **This is the closest call the corpus has faced, because a Leave Request genuinely has a pending phase.** **It still fails every ground:**
>
> | Ground | Assessment |
> |---|---|
> | **Branching disposition** | ⚠ **Approve / reject / partially approve are VALUES of one decision, not a sequence of transitions.** **Pending is the absence of a decision**, exactly as `HRP-058` found for `E-092` Overtime Approval |
> | **Prohibited transitions across owners** | **None.** **No re-entry, no externally driven transition** — unlike `SM-17`, where `AGV-025` has a role change suspend an override into `Review Required` |
> | **Independent lifecycle ownership** | **None.** **Attendance consumes the approved fact by explicit request at evaluation time** (`HRP-008`) |
>
> ✅ **No event either**: **no consumer reacts to a leave decision** — **attendance reads it when it evaluates**, and `SYS-006` permits coupling by explicit request equally with events. **Twenty-one machines and 102 events, both unchanged. The eighth proven negative.**

**Carried as Future Extension, not built** (`BD-499` §11): leave quotas and entitlement · accrual · carry-forward · encashment · half-day and hourly leave · non-consecutive date selection · statutory categories · medical certificates and attachments · automatic approval · approval hierarchy · leave balances · holiday sandwich rules · replacement and coverage workflow.


# 15. What was deliberately NOT invented

| Not created | Why |
|---|---|
| **Interest, penalties, refinancing** | **`BD-487` — loans are interest-free, and `BD-487` §7 forbids building the machinery** |
| **Deduction priority engine** | **`BD-481` §6 — a capacity boundary, not a priority engine** |
| **Recovery prioritisation across positions** | **`BD-493` §2** |
| **Protected minimum take-home, statutory limits** | **`BD-481` §9 — only `Net Salary ≥ 0`** |
| **Tax, Provident Fund** | **`BD-128`, `BD-129` unanswered since 2026-08-05; `SYS-092` keeps statutory reporting out of V1** |
| **Damage/loss and penalty deductions** | **Named by `BD-005`; no formula discovered** |
| **Appraisal, KPI, grades, bands, targets, promotion** | **`BD-496` §10, `BD-495` §9** |
| **Recurring or festival bonus engines** | **`BD-496` §2** |
| **Commission tiers, campaigns, profit-sharing** | **`BD-497` §1** |
| **Mid-month salary proration** | **`BD-495` §4** |
| **Biometric / GPS / face recognition** | **No business rule requires any** |
| **Leave entitlement, accrual or balance policy** | **Leave Management exists (`BD-470`); entitlement mechanics are undiscovered** |
| **Final Settlement subledger** | **`BD-490` §2, `BD-492` §12 — a computed view** |
| **Any state machine or event** | **`HRP-058`, `HRP-059` — proven negatives** |

---

# 16. Carried — Future Extension / Configurable Policy

**Employee Loan:** payroll binding moment for the outstanding balance · outside-payroll over-payment residue · balance remaining after the scheduled term · repayment frequency values.
**Earnings:** commission *configurable* scope (global / per-employee / per-channel) · an earning becoming authoritative after departure.
**Salary:** downward salary revision.
**Payroll:** ERP-wide monetary rounding reconciliation.
**Attendance:** LWP waiver · partial-day leave · extended-lunch and internal short-work treatment · payroll overpayment recovery.

✅ **None blocks V1 implementation.** **Each is recorded rather than resolved by assumption** (`DOC-023`, `DOC-030`).

---

# 17. Version History

| Version | Date | Change |
|---|---|---|
| **1.2.0** | **2026-08-10** | ✅ **Leave Management — §19, `HRP-089` – `HRP-097`, `E-102`. Source `BD-499`. The last UI blocker, closed.** **Single or consecutive-day requests; two types; a DISTINCT Leave Approval permission never inferred from payroll, attendance, Reporting Manager status, HR access, the Administrator role alone or general employee management.** **Partial approval with requested and approved periods retained separately.** 🔴 **`HRP-094`: unapproved requested days acquire NO status** — **not Absent, not LWP, not another type** — **the eighth residue the corpus refuses to give a default meaning.** ✅ **`HRP-092` records the principle `BD-499` §4 supplied**: **leave approval sets an EXPECTATION and money DERIVES from it, which is why it is permission-bound while a waiver, where the decision IS the amount, is title-bound** — **`PRM-088` refines `PRM-082`'s test to DIRECTNESS and retroactively explains `BD-464`.** ✅ **`HRP-008`'s chain is UNCHANGED** — it already read *Approved Leave / LWP → Attendance Expectation*, and §19 supplies the record it consumed. ✅ **NO machine and NO event — the closest call yet, since a Leave Request genuinely has a pending phase, but approve/reject/partial are VALUES of one decision and pending is the absence of one; no re-entry, no external driver, no consumer reaction.** **The eighth proven negative.** |
| **1.1.0** | **2026-08-10** | ✅ **Final Settlement — §18, `HRP-061` – `HRP-088`. Source `BD-490` – `BD-494`.** 🔴 **Ownership TESTED**: **`ACC-060`/`ACC-061`'s accounting-position test does NOT select Accounting, because Final Settlement maintains NO position** — **its defining property** — **and `ACC-061` already refused a new module for a larger capability.** **HR & Payroll owns it: employment ending is the triggering context, `HRP-054` already obliges this module to expose the positions, and what it maintains is an employment-lifecycle artefact.** ✅ **No new prefix and no new module.** **`E-100` and `E-101` added, neither holding a balance.** **Positive side automatic, negative side invited; per-position authorisation; `0 ≤ Applied ≤ Authorised ≤ Outstanding`; `Σ Authorised ≤ Available` deterministically refused with the CHOICE left human.** **The Position REPRESENTS the underlying positions and creates no second payable or receivable.** **`Net Salary ≥ 0` does NOT apply.** **Finalisation is the atomic commit, fabricating no movement and coordinating the owning capabilities; the snapshot is immutable and reproducible AS AT finalisation.** ✅ **`PRM-006` RESOLVED NARROWLY, not reopened**: **finalisation approves nothing** — authorisation and finalisation are distinct acts on different subjects, **one approval and one commit** — **and `HRP-085` states it as a RULE so no implementation models finalisation as an approval step, which would engage `PRM-006`'s default and require an exception the business has not named.** ✅ **NO machine and NO event** — **`HRP-087` is the sixth proven negative and the first where an event would have been actively WRONG**, since **`HRP-075`'s atomicity requires synchronous coordination that at-least-once delivery cannot provide.** |
| **1.0.0** | **2026-08-10** | **Initial ratification. `HRP-000` – `HRP-060`.** Consolidates `BUSINESS_DISCOVERY.md` §41, §44 – §46 with `DOMAIN_MODEL.md` `E-090` – `E-099`, `ACCOUNTING_ARCHITECTURE.md` §8B/§8C, `PAYMENT_ARCHITECTURE.md` §15D and `PERMISSION_ARCHITECTURE.md` §13.7. **No new business rule, entity ownership or lifecycle is invented.** **`GAP-119`, `GAP-123` and `GAP-124` closed.** **No state machine and no event added — both are proven negatives.** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered.**

---

*This document specifies HR & Payroll business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
