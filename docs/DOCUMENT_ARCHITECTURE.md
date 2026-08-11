# Document / Printable — Business Architecture

**Owner:** Trioloo Technology · **Module:** Cross-cutting · **Status:** Canonical
**Version:** 1.0.1 · **Ratified:** 2026-08-10 · **Amended:** 2026-08-10 (`PRN-029` — Leave blocker resolved) · **Rule prefix:** `PRN-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) `BD-006B`, §39 Document Identity (`BD-443` – `BD-447`), and the document-bearing rules of each owning domain.

**Owns:** the classification scheme, the snapshot-versus-derivation test, reprint discipline, numbering policy, permission separation, and the canonical V1 catalogue.
**Does not own:** any document's *content*, which stays with its owning domain (`DOC-005`, `DOC-006`).

**Scope:** **Minimal V1, architecture only.** ⚠ **No typography, colour, layout, paper size, margin, QR, barcode, signature graphic or print CSS is decided here.**

---

# 1. Purpose and Boundary

> **PRN-000 — This document answers *what a printable IS, where its content comes from, and whether it may be reproduced*. It answers nothing about what any document looks like.**

> **PRN-001 — Rendering never creates the business event. THIS IS THE SPINE OF THE DOMAIN.**
>
> **The authoritative occurrence exists first; the document represents it** (`ACC-053`, `ACC-055`, `ACC-056`, `PAY-086`, `BD-446`, `BD-447`).
>
> ⚠ **Printing creates no financial event, no posting, no movement, no obligation and no state change.** ✅ **A document that could create the thing it depicts would make the depiction authoritative, which `DB-001` and `ACC-001` forbid throughout the corpus.**

> **PRN-002 — Each document's content is owned by its domain. This document adds no attribute to any record** (`DOC-005`, `DOC-006`).

> **PRN-003 — No generic Document entity is created, and the six classes are not collapsed into one** (`ACC-058`, `CP-9`).
>
> ⚠ **`ACC-058` already refused this for three vouchers alone.** **A single generic Document entity would erase exactly the distinctions the business spent `BD-443` – `BD-447` establishing.**

---

# 2. The Six Classes

> **PRN-004 — Every V1 output belongs to exactly one primary class.**

| Class | Meaning | Reproduction |
|---|---|---|
| **A — Immutable Business Document** | **A numbered, snapshotted artefact whose historical content must remain reproducible** | **Own snapshot** |
| **B — Transaction Evidence / Receipt** | **Evidence of an already-existing event or money movement** | **Renders immutable source** |
| **C — Internal Voucher / Rendering** | **A printable rendering of a financial record that already exists** | **Renders authoritative record** |
| **D — External Evidence** | **Originates outside Trioloo; stored and referenced** | **Retained exactly as received** |
| **E — Derived Statement / Ledger** | **A reproducible view over authoritative movements for a requested date or range** | **Live derivation** |
| **F — Periodic Report** | **A derived report over a period** | **Live derivation** |

---

# 3. Snapshot versus Live Derivation

> **PRN-005 — The test is whether the source can change after the document's authoritative point.**
>
> | Source | Requirement |
> |---|---|
> | **Source can still change** | \U0001F534 **The document must carry its OWN snapshot** |
> | **Source is already immutable** | ✅ **No own snapshot is needed — rendering it reproduces it** |
> | **Source is a movement history** | **Live derivation, with an explicit as-of or range** |

> **PRN-006 — A rendering of immutable data is reproducible WITHOUT snapshotting, and duplicating it would be a second copy of an existing figure** (`DB-001`, `CP-12`).
>
> ✅ **This is why `E-039` Invoice snapshots and a Payslip does not.** **An Order keeps changing after invoicing, so `INV-39.2` snapshots the invoice.** **A finalised `E-094` Payroll Result and a finalised `E-100` Final Settlement are already immutable** (`INV-93.1`, `INV-100.5`), **so their documents render rather than copy.**

> **PRN-007 — A live derived statement or report takes an explicit as-of date or range and derives from authoritative movements** (`DB-001`, `ACC-001`).
>
> ⚠ **No statement balance is ever stored** (`ACC-088`, `ACC-093`, `HRP-062`).

> **PRN-008 — A report is not snapshotted merely because it was printed** (`CP-12`).
>
> ⚠ **Distinguish a historical business document from a live report generated over immutable historical facts.** **The second needs no archive of its own; its inputs are already permanent.**

---

# 4. Reprinting

> **PRN-009 — Reprinting an immutable document reproduces its HISTORICAL content** (`INV-39.2`, `DB-003`, `AGV-002`).
>
> \U0001F534 **It is never silently regenerated using today's** address · salary · product description · user profile · price · tax configuration · policy · schedule **if those differed when the document was issued.**
>
> ✅ **The corpus already guarantees the inputs**: **`INV-90.2` salary history · `INV-98.5` loan schedule versions · `BR-163` `Confirmed By` · `INV-39.2` invoice snapshot · `INV-95.1` effective-dated increments.** **Reprint correctness is a consequence of those, not a new mechanism.**

> **PRN-010 — A reprint is not a business transaction. Print occurrence is operational metadata and never alters historical business content** (`PRN-001`).
>
> **Where retained, an Original/Reprint marker and a print timestamp are metadata about the act of printing.**

> **PRN-011 — No mandatory REPRINT watermark, print-count limit or reprint approval exists** (`DOC-023`).
>
> ⚠ **No business evidence requires any of them; none is invented.**

---

# 5. Numbering

> **PRN-012 — There is NO universal document numbering sequence** (`BD-443`, `CP-9`).
>
> ⚠ **`BD-443` explicitly prohibits creating numbering sequences merely because document names exist.**

> **PRN-013 — Sales Invoice numbering is preserved exactly** (`INV-39.1`, `DB-012`): **one sequence · never reused · a cancelled number is retired.**

> **PRN-014 — An internal entity reference is not a human-facing document number, and the two are never conflated** (`DB-006`).
>
> ✅ **Every authoritative record already has an identity.** ⚠ **A human-facing number is an additional business decision, required only where the business has stated one.**

> **PRN-015 — Where no numbering rule exists and identity does not require one, none is invented. The absence is reported** (`DOC-023`, `DOC-030`).
>
> **Undefined in V1:** **Delivery Challan · Money Receipt · Receipt Voucher · Payment Voucher · Journal Voucher · Purchase Order · Advance Requisition printable · Payslip · Final Settlement Statement.**
>
> ⚠ **`BD-446` and `BD-447` both close with an explicit prohibition on inferring numbering schemes.** ✅ **Each of these is identifiable by its authoritative record's reference; a human-facing number is a later business decision, not an architectural necessity.**

---

# 6. Correction and Cancellation

> **PRN-016 — Correction follows the OWNING domain's existing discipline. No generic Document Correction workflow is created** (`DOC-005`, `CP-9`).

| Document | Correction route |
|---|---|
| **Sales Invoice** | **Cancel and retire the number; credit** (`INV-39.1`, `E-039` lifecycle) |
| **Vouchers** | **The underlying posting is corrected by a new linked posting** (`ACC-003`, `DB-002`) |
| **Payslip / Salary Sheet** | **`HRP-028` — never reopen a finalised run; correct in a later run** |
| **Final Settlement Statement** | **`HRP-079` — a new linked correction record** |
| **Statements and reports** | **Nothing to correct — they re-derive** |

> **PRN-017 — An immutable document is never edited in place after its authoritative point** (`DB-002`, `DB-003`, `BD-475`, `BD-494`).

---

# 7. Permissions

> **PRN-018 — Six document actions are separately permissionable, and none is inferred from another** (`PRM-002`, `PRM-003`, `PRM-004`).
>
> **View · Generate · Issue/Finalise · Reprint · Cancel · Export/Download.**
>
> ⚠ **Issuing is the act that may carry a business consequence; the other five do not.** ✅ **Only where a document's issuance IS the authoritative act does issuing require the owning capability's authority** — **and `PRN-001` means that is rare by construction.**

> **PRN-019 — Every salary-bearing output is a `PRM-011` sensitive class** (`PRM-083`, `AGV-012`, `RPT-059`).
>
> \U0001F534 **Payslip · Salary Sheet · Payroll Deduction Statement · OT Statement · Bonus Statement · Commission Statement · Salary History · Final Settlement Statement.**
>
> ⚠ **A user who may VIEW payroll does not thereby may ISSUE a Salary Sheet or a Final Settlement Statement.** **`PRM-080` already establishes that processing payroll confers no authority beyond processing.**

> **PRN-020 — No elaborate print-permission hierarchy is created beyond `PRN-018`** (`CP-9`, `PRM-050`). **No print approval, no dual sign-off.**

---

# 8. External Evidence and Attachments

> **PRN-021 — External evidence uses `E-054` Attachment. No second document store is created** (`INV-54.1`, `BD-445`).
>
> **`E-054` already lists the needed types** — **proof of delivery · settlement report as received · supplier invoice · QC evidence · customer correspondence · courier claim documentation.**
>
> ✅ **`INV-54.1` retains external data exactly as received, unaltered.** ⚠ **`BD-445` explicitly forbids a document-management workflow, scanning state machine, mandatory upload, OCR or new attachment entity.**

---

# 9. Source Traceability

> **PRN-022 — Every printable has exactly one deterministic authoritative source, and the rendering never becomes that source** (`PRN-001`, `DOC-005`).

---

# 10. The Canonical V1 Catalogue

> **PRN-023 — The V1 document set is the following, and nothing outside it is architected here.**

## 10.1 Sales / Customer

| Output | Class | Source | Snapshot? | Notes |
|---|---|---|---|---|
| **Sales Invoice** | **A** | **`E-039`** (Accounting) | **SNAPSHOT** — `INV-39.2` | **One entity, one sequence** (`BD-443`). ⚠ **Tax detail stays undefined**; no VAT, BIN or Mushak field is inferred. **External shipping references may be shown as reference fields and change neither identity nor numbering** |
| **Delivery Challan** | **B** | **Order / handover acknowledgement** | **Renders** | \U0001F534 **CONDITIONAL, not universal** (`BD-444`). **Own-staff delivery and self-pickup only.** ⚠ **Never issued to duplicate courier proof** — for courier delivery the courier's own record is the evidence |
| **Money Receipt** | **B** | **Payment record** (`PAY-082` – `PAY-086`) | **Renders** | ⚠ **Never mandatory merely because a customer paid a courier** (`PAY-084`). **Evidences the customer's payment act; never substitutes for the Payment record** (`PAY-086`) |
| **Warranty Card** | ⬜ **NOT REQUIRED IN V1** | — | — | ✅ **Reported, not architected.** **`WAR-021`: where issued it is *an additional reference only*, never primary proof, and its absence never refuses a claim.** ⚠ **`BD-339` does not even state whether issuance is recorded** — **so no printable requirement exists to architect** |
| **Quotation** | \U0001F534 **CANNOT BE ARCHITECTED** | — | — | **See `PRN-024`** |
| **Proforma Invoice** | \U0001F534 **CANNOT BE ARCHITECTED** | — | — | **See `PRN-024`** |

## 10.2 Accounting vouchers

| Output | Class | Source | Snapshot? |
|---|---|---|---|
| **Receipt Voucher** | **C** | **The already-recorded receipt posting** (`ACC-052`, `ACC-053`) | **Renders** |
| **Payment Voucher** | **C** | **The already-recorded outgoing payment** (`ACC-055`) | **Renders** |
| **Journal Voucher** | **C** | **`E-089` Authorised Accounting Adjustment** (`ACC-056`, `ACC-077` – `ACC-085`) | **Renders** |

✅ **Three distinct identities, never collapsed** (`ACC-058`). ⚠ **None creates its posting** (`ACC-053`, `ACC-055`, `ACC-056`).

## 10.3 Procurement

| Output | Class | Source | Snapshot? |
|---|---|---|---|
| **Purchase Order** | **A** | **Purchase Order record** (Procurement) | **SNAPSHOT** — it is a commitment communicated externally and must reproduce what was sent |
| **Purchase Invoice** | **D** | **`E-054` Attachment, type *supplier invoice*** | **Retained as received** (`INV-54.1`) |

⚠ **No Trioloo Purchase Invoice entity is manufactured to mirror the Sales Invoice.** **The supplier's document is the supplier's.**

## 10.4 Advance and Employee Finance

| Output | Class | Source | Snapshot? |
|---|---|---|---|
| **Advance Requisition printable** | **C** | **`E-086`** (Accounting) | **Renders** — requisition reference · employee · purpose · **requested amount · authorised amount** · disbursement information · authority condition · actor and timestamp facts |
| **Employee Advance Statement** | **E** | **`E-086` + `E-087` movements** | **LIVE, as-of** — ⚠ **per-requisition traceability preserved** (`ACC-064`, `ACC-065`) |
| **Employee Loan Statement** | **E** | **`E-098` + `E-099` movements** | **LIVE, as-of** — original principal · schedule and expected instalments · payroll recoveries · outside-payroll repayments · write-offs · **derived outstanding** (`ACC-088`) |
| **Outstanding Salary Payable Statement** | **E** | **`ACC-093`** | **LIVE, as-of** |

> \U0001F534 **Advance and Loan are never merged into one anonymous employee debt statement.** **A combined view is permitted ONLY as a summary that drills through to the authoritative per-position figures** (`ACC-064`, `ACC-092`, `INV-99.1`). **A settlement is never applied to an anonymous employee total.**

## 10.5 HR & Payroll

| Output | Class | Source | Snapshot? |
|---|---|---|---|
| **Payslip** | **B** | **`E-094` Payroll Result** | **Renders** — **no own snapshot; `E-094` is already immutable** |
| **Salary Sheet** | **F** | **`E-093` run + `E-094` results** | **Renders the finalised run** — ⚠ **never creates or finalises payroll** |
| **Attendance Report** | **F** | **`E-091`** | **LIVE, period** |
| **Payroll Deduction Statement** | **F** | **`E-094` deduction lines** | **LIVE, period** |
| **OT Statement** | **F** | **`E-092`** | **LIVE, period** — ⚠ **earned period and nominated period may differ** (`INV-92.4`) |
| **General / Performance Bonus Statement** | **F** | **`E-096`** | **LIVE, period** |
| **Sales Commission Statement** | **F** | **`E-097`** | **LIVE, period** |
| **Salary History / Increment Statement** | **E** | **`E-095` + `E-090` history** | **LIVE, as-of** |

> **PRN-025 — Payslip and Salary Sheet expose the figures `HRP-029` and `RPT-058` require**: **Monthly Salary basis · earnings · OT · bonus · commission · attendance and LWP deductions · Advance Requisition recovery · Employee Loan expected instalment and actual recovery · other authorised deductions · Gross · Total Deductions · Net Salary · prior-period adjustments.**
>
> \U0001F534 **A Payslip must NOT imply *Paid* merely because payroll is finalised.** **`ACC-094` makes finalisation and payment separate facts**, and **`ACC-093` derives what remains outstanding.** ✅ **Where payment status is shown it comes from confirmed `PAY-091` movements, never from the run's state.**
>
> ⚠ **No undiscovered deduction formula is rendered.** **`GAP-126`'s six formula-less types have nothing to show.**

> **PRN-026 — The Sales Commission Statement consumes `E-097`: Order reference · `Confirmed By` attribution · delivered qualifying fact · authorised amount · nominated payroll period** (`INV-97.1` – `INV-97.3`).
>
> \U0001F534 **The employee is never inferred from `Assigned Agent`, the current order owner, `Last Updated By` or audit logs** (`BR-164`). ⚠ **An `AUTO_CONFIRMED` Order with no human confirmer has no commission recipient and none is fabricated** (`BR-166`).
>
> ✅ **General / Performance Bonus and Sales Commission remain separate statements** (`BD-465`, `BD-496` §1).

## 10.6 Final Settlement

| Output | Class | Source | Snapshot? |
|---|---|---|---|
| **Final Settlement Statement** | **B** | **`E-100` finalised** | **Renders** — **no own snapshot; `INV-100.5` is already immutable** |

> **PRN-027 — The statement renders the finalised snapshot and states DIRECTION explicitly** (`RPT-061`, `INV-100.7`, `BD-491` §7).
>
> **Trioloo Payable to Employee · Settled / Zero · Employee Owes Trioloo.** \U0001F534 **A negative sign alone is never the business meaning.**
>
> **It exposes:** employee · as-of and finalised point · amounts owed to employee · liabilities considered · **specific underlying Loan and AR references** · outstanding · authorised · applied · remaining · the resulting Position · recovery authorised by · finalised by · timestamps · correction references.
>
> \U0001F534 **The Position is never presented as a separate receivable or payable subledger** (`INV-100.2`, `RPT-062`). ⚠ **A 7,000 loan and a 3,000 requisition may present as *employee owes 10,000*, and the authoritative receivables remain 7,000 and 3,000.**

---

# 11. What Cannot Be Architected, and What Is Not Required

> **PRN-024 — Quotation and Proforma Invoice CANNOT be architected in V1, because `BD-134` is unanswered** (`DOC-023`, `DOC-030`).
>
> \U0001F534 **`BD-006B` names both as documents the business issues, and nothing further was ever discovered.** **`BD-134` — *what makes a sale need a Quotation or a Proforma Invoice, rather than going straight to a Sales Invoice?* — remains open since 2026-08-05.**
>
> **Nothing states when either is issued, what it contains, whether it is numbered, whether it binds a price, whether it expires, or what happens when it converts to an order.** ⚠ **Architecting them would be pure invention.**
>
> ✅ **What IS settled and is preserved:** **neither is a Sales Invoice**, and **neither creates revenue, a receivable, a tax liability or a completed sale** (`BD-304`, `ACC-` revenue rules). **Issuing one changes no financial position.**
>
> **Registered as `GAP-128`.** ⚠ **This blocks those two documents only. It blocks no other document and does not block the stage.**

> **PRN-028 — Warranty Card is not a required V1 printable, and this is a determination rather than an omission** (`WAR-021`, `BD-339`).
>
> **`WAR-021`: a warranty card, where issued, is an additional reference only — never primary proof, and its absence never refuses a claim.** ⚠ **`BD-339` does not state whether issuance is even recorded, and `WARRANTY_REPAIR_ARCHITECTURE.md` records that this *changes nothing either way*.** ✅ **A document that grants nothing, gates nothing and need not be recorded has no architectural requirement to satisfy.**

> **PRN-029 — Leave forms remain out of the V1 printable catalogue, and the UI blocker is now RESOLVED** (`BD-499`, `HRP-089` – `HRP-097`).
>
> ✅ **AMENDED 2026-08-10.** **The readiness pass recorded that no Leave entity existed; `E-102` Leave Request now does**, and **Minimal Leave Management discovery is complete.** ⚠ **No Leave PRINTABLE is required in V1** — **no business evidence asks for a leave form, certificate or approval slip**, and **`BD-499` §11 carries medical certificates and attachments as future extensions.** ✅ **The catalogue is unchanged; the UI blocker is closed.**
>
> *(Original, retained under `DOC-009`: “Leave forms are out of scope … Minimal Leave Management discovery is required before Leave UI is designed. It blocks no document in this catalogue.”)*

---

# 12. What was deliberately NOT invented

| Not created | Why |
|---|---|
| **A universal document numbering sequence** | **`BD-443`, `PRN-012`** |
| **Numbering for the nine documents that have none** | **`BD-446`/`BD-447` prohibit inferring schemes; `PRN-015`** |
| **A generic Document entity** | **`ACC-058`, `PRN-003`** |
| **A generic Document Correction workflow** | **`PRN-016` — owning domains already define correction** |
| **Quotation and Proforma behaviour** | **`BD-134` unanswered — `PRN-024`, `GAP-128`** |
| **A Warranty Card requirement** | **`WAR-021` — `PRN-028`** |
| **A Trioloo Purchase Invoice entity** | **External evidence via `E-054`** |
| **Tax fields, VAT rates, BIN or Mushak** | **`BD-443`'s explicit prohibition; `GAP-003` deferred** |
| **A second document store or scanning workflow** | **`BD-445`, `PRN-021`** |
| **Mandatory scanning of signed challans** | **`BD-445` — optional evidence, never a prerequisite** |
| **REPRINT watermarks, print counts, print approval** | **`PRN-011`, `PRN-020`** |
| **A state machine or event for any document** | **Rendering is not a business event** (`PRN-001`) |
| **Any visual design decision** | **§24 boundary — the later stage owns it** |

---

# 13. State Machines and Events

> **PRN-030 — No document defines a state machine and no document publishes an event.**
>
> ✅ **`PRN-001` settles both**: **a printable represents an occurrence that already happened, so it has no lifecycle of its own and nothing can react to its rendering.** ⚠ **`E-039` Invoice's *issued → cancelled/credited* lifecycle is the INVOICE's, owned by Accounting, and predates this document.**
>
> **Twenty-one machines and 102 events, both unchanged.** **The seventh proven negative.**

---

# 14. Version History

| Version | Date | Change |
|---|---|---|
| **1.0.0** | **2026-08-10** | **Initial ratification. `PRN-000` – `PRN-030`.** Consolidates `BD-006B` and §39 (`BD-443` – `BD-447`) with the document-bearing rules of Accounting, Payment, Delivery, Procurement, Warranty, HR & Payroll and Reporting. **No business rule, entity, numbering scheme or lifecycle is invented.** 🔴 **`GAP-128` registered — Quotation and Proforma cannot be architected while `BD-134` is unanswered.** ✅ **Warranty Card determined NOT required.** **No machine, no event.** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered.**

---

*This document specifies document and printable business architecture only. It contains no visual design, layout, template, code, schema or user interface specification.*
