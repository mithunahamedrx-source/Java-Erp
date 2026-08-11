# Payment Architecture

**Owner:** Trioloo Technology · **Module:** Payment · **Status:** Canonical
**Version:** 1.8.1 · **Ratified:** 2026-08-08 · **Rule prefix:** `PAY-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §8 Payment Rules (`BD-057` – `BD-066`), with §19 Accounting (`BD-304` – `BD-315`), §20 Marketplace (`BD-323` – `BD-325`), §22 Return & Exchange (`BD-349` – `BD-352`) and §27 Fund Transfers (`BD-402`).

**Reconciliation records consolidated:** [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §11 and §9.9A–§9.11 (`BR-033` – `BR-044`, `BR-116` – `BR-134`) · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) §9, §10, §14, §22.3 (`SMA-036`, `SMA-055` – `SMA-057`) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `DM-051` – `DM-058`.

**References, never duplicated:** [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`PROCUREMENT_ARCHITECTURE.md`](PROCUREMENT_ARCHITECTURE.md) `PRC-` · [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) `WHS-` · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §0 · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary — already drawn by a ratified rule

> **PAY-000 — Payment owns *how an obligation is operationally reconciled*. Accounting owns *what a business event posts*.** The line is not drawn here; it was drawn by `ACC-000` and rests on `BR-121`:
>
> > **`BR-121` — A settlement statement is evidence, not a posting source. Documents evidence obligations; business events create them.**

| | **`PAYMENT_ARCHITECTURE.md`** — `PAY-` | `ACCOUNTING_ARCHITECTURE.md` — `ACC-` |
|---|---|---|
| **Owns** | **Operational reconciliation** — receivable lifecycle, collection modes, COD remittance matching, settlement statement matching, **variance and dispute**, **refund execution** | The **posting model** · recognition policy · Financial Accounts · derived balances · advances · Fund Transfer · period close |
| **Answers** | ***"Did the money arrive, does it match, and what do we do when it does not?"*** | *"What does this event post, and to which account?"* |

**`ACC-000` states that Accounting *"does not pre-empt the operational reconciliation model."* This document is that model, and it reciprocates: no posting rule is restated here.**

| Question | Owner |
|---|---|
| **Did the money arrive, does it match, what now** | **`PAYMENT_ARCHITECTURE.md`** — `PAY-` |
| What posts, and to which account | `ACCOUNTING_ARCHITECTURE.md` — `ACC-` |
| **Whether a refund is owed at all** | `RETURN_EXCHANGE_ARCHITECTURE.md` — `RET-` |
| **What is owed to a supplier, and why** | `PROCUREMENT_ARCHITECTURE.md` — `PRC-` |
| Stock movements | `INVENTORY_ARCHITECTURE.md` — `IVN-` |
| Order lifecycle and operational workflow | `ORDER_MANAGEMENT_ARCHITECTURE.md` — `BR-` |
| State and transition definitions | `STATE_MACHINE_ARCHITECTURE.md` — `SM-`, `SMA-` |

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine or lifecycle is introduced. **No gap is resolved by assumption** — see §21.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To answer one question for every order in the business: **did the money actually arrive, does it match what was owed, and what happens when it does not.**

One fact makes this module load-bearing rather than clerical:

> **Approximately 100% of customer orders are Cash on Delivery** (`BD-058`). On essentially **every** order the money is collected by a third party and reaches Trioloo later.

`OM §11.1` states that the gap between collection and settlement *"is where revenue leakage occurs."* **At ~100% COD, that gap covers the entire business** — which is why `BR-035` is the single most consequential rule this module enforces, and why the receivable is the only place the exposure is visible.

---

# 2. Scope

## 2.1 In scope

Collection modes · the receivable lifecycle and its ageing · the collection-versus-settlement separation · courier remittance reconciliation · marketplace settlement reconciliation · line-by-line matching · variance detection, dispute and closure · refund execution · write-off execution · supplier payment execution · the advance interface · duplicate-capture prevention.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Every posting, recognition policy, Financial Accounts, advances as balances, period close** | `ACCOUNTING_ARCHITECTURE.md` (`ACC-000`) |
| **Whether a refund is owed — entitlement, eligibility, return approval** | `RETURN_EXCHANGE_ARCHITECTURE.md` (`RET-018`, `RET-023`) |
| **What is owed to a supplier and why — acceptance, payable creation** | `PROCUREMENT_ARCHITECTURE.md` (`PRC-002`, `PRC-047`) |
| **Stock movements and dispositions** | `INVENTORY_ARCHITECTURE.md` |
| **Cost and valuation** | `INVENTORY_COSTING_ARCHITECTURE.md` |
| **Order lifecycle, delivery outcome, closure** | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| **Courier master, shipment, tracking, delivery confirmation** | `DELIVERY_ARCHITECTURE.md` ✅ |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` |
| Notification delivery | `NOTIFICATION_ARCHITECTURE.md` |
| Screen layout, density, interaction | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

---

# 3. Architectural Principles

## 3.1 P1 — Collection is not settlement

> **PAY-001 — Collection and settlement are separate concepts and must never be conflated. Money held by a courier is not money received** (`BR-035`, `INV-40.1`, `BD-058`, `BD-059`).

**An order marked "paid" at delivery would be a false statement** (`INV-40.1`). The customer has paid; Trioloo has not been paid.

## 3.2 P2 — Expected and actual are both retained

> **PAY-002 — Expected and actual settlement are both retained, and the difference is the variance** (`BR-038`, `INV-40.2`).

*"Overwriting the expectation with the actual destroys the ability to detect"* deduction errors. **The variance is the primary instrument of this module**, and it exists only because both sides are kept.

## 3.3 P3 — The record follows the cash

> **PAY-003 — A financial record is created when money actually moves, never when it is requested, approved or documented** (`DM-055`, `ACC-003`, `SMA-055`, `BD-310`).

**This is why no preventive control is required on refunds** (`DM-055`): the ERP cannot record a refund that has not happened, exactly as it cannot recognise revenue before delivery. *The gate is a definition, not a control.*

## 3.4 P4 — Reconciliation is per order, never in aggregate

> **PAY-004 — Settlements are matched line by line, never in aggregate** (`INV-42.1`, `BR-129`, `ACC-014`).

**`BR-129` settles this by structural necessity**, not by preference: `BR-123` creates the receivable **gross** and clears it by *cash received plus deductions recorded as expense*, so **each deduction must be attributable to the order whose receivable it discharges.** Aggregate matching **cannot clear individual receivables** and would leave a residue on every marketplace order.

**Two orders wrong in opposite directions produce a correct-looking total.** That is the failure line-by-line matching exists to catch.

## 3.5 P5 — Trioloo is authoritative for its own money position

> **PAY-005 — The ERP records the payment actually received, not the status an external party reports** (`SYS-011`, `BR-004`, `BD-063`).

**Daraz's reported settlement status and the money actually received routinely differ in timing** (`BD-063`). The ERP records the actual receipt and reconciles it against the statement.

## 3.6 P6 — The manual path is permanent

> **PAY-006 — Where no API exists, settlements are recorded and reconciled manually, and this is a permanent capability rather than a temporary workaround** (`SYS-012`, `BR-029`, `BD-060`).

> **PAY-007 — Capture method is an attribute of the record, never an identity of the event** (`SYS-107`, `ACC-036`, `BD-402`). Manual and API settlement capture are **two ways of recording one business event**, and **the recording method never changes the treatment.**

## 3.7 P7 — Every payment action is attributable

> **PAY-008 — Every collection, reconciliation, refund and write-off is attributable to an Operational User Profile** (`AGV-001`, `AUD-004`, `PRM-005`).

---

# 4. Collection Modes

> **PAY-009 — Seven collection modes are established, organised by *who collects the money and when it reaches Trioloo*** (`OM §11.2`).

| Mode | Collector | Settlement route | Lag |
|---|---|---|---|
| `COD_COURIER` | Courier | Courier remittance | Days |
| `COD_OWN_DELIVERY` | Trioloo staff | Direct to cash office | Same day |
| `MARKETPLACE_COD` | Marketplace or its courier | Marketplace settlement | Weeks |
| `MARKETPLACE_PREPAID` | Marketplace | Marketplace settlement | Weeks |
| `PREPAID_DIRECT` | Trioloo | Direct | Immediate |
| `COUNTER` | Trioloo counter | Direct | Immediate |
| `CREDIT_TERMS` | — | Customer payment on terms | Per agreement |

> **PAY-010 — Collection mode is a different dimension from payment method, and the two lists are not comparable** (`BD-057`, `OM §11.2`).

`BD-057` records **ten payment methods** spanning three dimensions — **instrument** (cash, bank transfer, mobile banking, card, cheque, online gateway), **collection arrangement** (COD), and **timing or structure** (installment, partial/advance, credit). **Collection modes organise by collector and lag; payment methods organise by instrument.** They describe different things.

> **PAY-011 — Payment method vocabulary is shared across both sides of the business and is not duplicated** (`BD-057`, `SYS-016`, `PRC-049`).

> **PAY-012 — Two settlement paths are confirmed, and they map to two distinct entities** (`BD-059`): **courier remittance** (`E-042`) and **marketplace settlement** (`E-043`).

On COD orders the collector is **the courier company** or **the marketplace logistics partner**, depending on channel and delivery method.

---

# 5. The Receivable

> **PAY-013 — `E-040` Receivable is what is owed for one order and whether it has arrived. It carries the `SM-5` Payment lifecycle** (`E-040`, `SM-5`).

> **PAY-014 — Payment obligation always follows delivered goods, never ordered goods** (`BR-033`, `INV-40.3`).

> **PAY-015 — The receivable is created gross and clears in two parts — cash received *plus* deductions recorded as expense — never by cash alone** (`BR-123`, `ACC-014`, `DM-054`).

> **PAY-064 — The receivable is created GROSS, and applied Trade-In Credit clears part of it as a non-cash clearing component** (`PAY-015` preserved, `BR-123`, `ACC-014`, `BD-433`).
>
> **Amended 2026-08-09.** *This rule was introduced hours earlier reading “the payment obligation created at dispatch reflects the remaining payable, not the Order Total” — which implied a net receivable. **The architecture decision preserves `PAY-015`'s gross model instead**, and the rule is amended rather than withdrawn (`DOC-021`).*

| Figure | Amount | Rule |
|---|---|---|
| **Order Total / Sales Revenue** | **30,000** | Untouched — **never rewritten, never a discount** (`ACC-039`, `INV-83.1`) |
| **Gross Receivable** | **30,000** | Created gross (`PAY-015`) |
| **Trade-In Credit clearing** | **10,000** | **Non-cash clearing component** |
| **Outstanding Cash Receivable** | **20,000** | What is actually collectible |
| **Courier COD** | **20,000** | `DLV-130` |

> **`PAY-015` said the receivable *“clears in two parts — cash received plus deductions recorded as expense, never by cash alone”*. Applied Trade-In Credit is a third non-cash clearing component of the same kind**, and the rule needed no amendment to accommodate it.

> **PAY-065 — Trade-In Credit is applied before dispatch, never at delivery** (`BD-433`). **The applied amount is committed to the Order before the shipment and COD instruction are created**, so the remaining cash amount is known when they are.

> **PAY-066 — The collector never applies Trade-In Credit** (`BD-433`). **The courier receives one figure and collects it.** At ~100% COD (`BD-058`, `PAY-009`) this keeps a **non-cash instrument off the parcel**, and `PAY-001`'s collection-versus-settlement discipline is untouched.

> **PAY-067 — Application before dispatch and clearing at receivable creation are two separate facts** (`BD-433`, `PAY-015`). **The customer commits the credit at the order; the receivable clears at dispatch.** Collapsing them would either rewrite the Order Total or delay the COD figure past the point the courier needs it.

## 12.5a Payment orchestrates; Accounting is the ledger authority

> **PAY-068 — Payment owns the operational application of Trade-In Credit to an order; Accounting owns the authoritative balance** (`ACC-000`, `PAY-000`, `E-083`).

| Payment owns | Accounting owns |
|---|---|
| Selecting and applying credit to an Order · enforcing the applied amount in Amount Payable · ensuring dispatch and COD use the remaining cash amount · coordinating the clearing when the receivable is created | **`E-083`** · available-balance validation · the **authoritative** balance movement and consumption · the remaining Trade-In Credit balance |

**Trade-In owns neither** (`TRD-001`, `TRD-044`). **It caused the credit to exist and nothing further.**

> **PAY-069 — Applying credit is an explicit cross-module request to Accounting, and Accounting may refuse it** (`SYS-006`, `SYS-032`). **A request is never an event** (`EVA-002`).
>
> **The same shape as a stock reservation** — `SYS-032` names it directly: *when Order Management requests a reservation, Inventory may refuse.* **Insufficient available balance is a normal refusal, not an error**, and Payment must be designed for it.

**The sequence, end to end:**

1. **Payment** commits an application against the Order — an **explicit request** (`SYS-006`).
2. **Accounting** validates the available `E-083` balance and **records the authoritative applied amount** — or refuses (`SYS-032`).
3. **Accounting** publishes the authoritative fact, **`EVT-101 Accounting.TradeInCreditApplied`**.
4. **Payment** uses the confirmed amount to determine **Remaining Amount Payable**.
5. **Delivery** receives the **net COD instruction** (`DLV-130`).
6. **At dispatch**, `PAY-015` creates the **gross** receivable and the applied credit **clears the corresponding portion**.
7. **The remaining receivable equals the cash collectible.**

⚠ **Trade-In Credit reversal after a returned sale, and credit expiry, remain explicitly unresolved** (`BD-431`, `ACC-040`). **Nothing here infers either.**

**Revenue is never netted** (`ACC-018`). This is the structural reason for `PAY-004`.

> **PAY-016 — The receivable counterparty varies by fulfilment path, and on a marketplace it is a *specific seller account*** (`BR-119`, `BR-128`, `ACC-015`).

**Seven marketplace seller accounts are seven independent counterparties**, each with its own settlement stream, so reconciliation is **at minimum per-shop** — because the statements arrive that way.

> **PAY-017 — An RTO never generated a receivable, and this is automatic rather than enforced** (`BR-117`, `ACC-013`). Goods never delivered created no revenue and no receivable, so **a failed delivery cannot leave a phantom receivable behind.** The error `BR-044` guarded against is unrepresentable.

> **PAY-018 — `SM-5` requires no change to represent an advance** (`SMA-036`, `ACC-021`). See §11.

## 5.1 States

**`SM-5`'s states are owned by `STATE_MACHINE_ARCHITECTURE.md` §9 and defined in `OM §11.3`. They are not restated here** (`DOC-005`, `SYS-016`):

`NOT_DUE` · `DUE` · `COLLECTED_BY_INTERMEDIARY` · `PARTIALLY_RECEIVED` · `RECEIVED` · `RECONCILED` · `SHORT_SETTLED` · `OVER_SETTLED` · `REFUND_DUE` · `REFUNDED` · `WRITTEN_OFF`

⚠ **`GAP-019` is carried:** the `RECEIVED → RECONCILED` transition is recorded in `SMA §9.3` as **`UNDECIDED`** — no ratified document states whether it is manual or automatic. **Not decided here.**

---

# 6. Collection versus Settlement

> **PAY-019 — Marketplace settlement is entirely independent of shipment and order state** (`BR-037`, `INV-43.1`). An order may be `DELIVERED` and complete for fulfilment purposes while its settlement remains outstanding for weeks — **and the order nevertheless does not reach `CLOSED` overall until settlement is reconciled.**

> **PAY-020 — Unremitted COD is tracked and aged per courier. Money held beyond agreed remittance terms is an exception requiring action, not a passive balance** (`BR-036`, `INV-40.4`, `INV-42.2`, `SYS-022`).

> **PAY-021 — Daraz statements are generated on a 7-day settlement cycle, with payment normally received within the following period** (`BD-063`). **This is the first and only concrete settlement timing figure in the discovery**, and it is the figure `BR-036` needs in order to age.

⚠ **A nuance recorded in the discovery and carried unchanged.** `SYS-026` states a mirror diverging from its source is **always an exception**. Here, the marketplace's reported payment status and the money actually received **routinely differ in timing** — a normal condition, not an error. **Whether this counts as divergence or as expected lag is a distinction the documentation does not currently draw** (`BD-063`). Recorded, not resolved.

---

# 7. Courier Remittance

> **PAY-022 — `E-042` Remittance Batch is a courier's transfer of collected COD cash covering many orders, and is the unit at which courier-held cash is reconciled** (`E-042`).

> **PAY-023 — A remittance batch is matched line by line, never in aggregate** (`INV-42.1`, `PAY-004`).

> **PAY-024 — Settlement may be received by bank transfer or by cash withdrawal where the courier supports it** (`BD-060`).

## 7.1 ⚠ Courier remittance has no state machine — `SMU-10`

**`GAP-027` identified Courier Remittance as a lifecycle that was never specified.** `SM-6` covers marketplace settlement; **no equivalent machine exists for courier remittance**, which leaves the COD cash-in-transit exposure of `BR-036` **with no states to age against.**

`BD-059` confirmed courier remittance is **a real and distinct process, not a variant of marketplace settlement**. `E-042`'s lifecycle is recorded in `DOMAIN_MODEL.md` as *received → matched → reconciled; or disputed* — **a description, not a ratified machine.**

⚠ **`SMU-10` remains open and is carried unchanged.** No machine is proposed here (`DOC-023`, `DM-001`).

---

# 8. Marketplace Settlement

> **PAY-025 — `E-043` Marketplace Settlement is a marketplace's periodic transfer, net of deductions, covering many orders — one per channel instance per period — and carries the `SM-6` lifecycle** (`E-043`, `SM-6`).

✅ **`SM-6` was ratified into `OM §18.2` on 2026-08-09** (`BR-142`, discharging `SMA-011`). **This document did not ratify it** — it carried the proposed status unchanged under `SMA-001` until the owning register was amended, which is why the amendment remained available to make.

> **PAY-026 — The marketplace is the system of record for settlement amounts; Trioloo's copy is a mirror** (`SM-6` authority, `SYS-010`, `ACC-020`).

**Trioloo is authoritative for what it sold; the marketplace is authoritative for what it deducted** (`ACC-020`, `BR-125`). Deductions are **never computed locally.**

> **PAY-027 — The settlement report is retained exactly as received, unaltered** (`INV-43.2`, `SYS-046`, `AUD-009`).

> **PAY-028 — `E-044` Settlement Line is one order's portion of a settlement with itemised deductions, and is the granularity at which variance is detected and disputed** (`E-044`).

> **PAY-029 — An order missing from a settlement is flagged and aged, never ignored** (`INV-44.2`).

> **PAY-030 — Apportioned rounding residue is explicitly allocated and the apportionment sums exactly** (`INV-44.1`, `DB-039`).

> **PAY-031 — Commission rates resolve to the version in force at order date** (`INV-43.3`, `DB-022`, `SYS-021`). **Renegotiating a rate never rewrites the profitability of a past order.**

## 8.1 Deduction categories

> **PAY-032 — Deduction detail is captured from the official statement; accounting is aggregated** (`BR-124`, `ACC-019`, `BD-064`).

**Five deduction categories are named by the business** (`BD-064`): marketplace commission · shipping and logistics charges · payment processing charges · promotional adjustments · other applicable marketplace fees.

⚠ **`OM §11.6` additionally documents penalty, return cost and prior-period adjustment**, which `BD-064` did not name separately. **Recorded as a mapping observation, not reconciled here.**

**Combination into `Marketplace Charges` and `Courier Charges` is an accounting treatment** owned by `ACC-019`; this module supplies the itemised detail.

---

# 9. Reconciliation and Variance

> **PAY-033 — Reconciliation compares each settlement against the corresponding customer orders, per order** (`BD-061`, `BR-129`, `PAY-004`).

⚠ **`BD-061` was recorded as ambiguous** between an aggregate and a per-order reading. **`BR-129` settled it by structural necessity, not by choosing a reading** — `BR-123`'s two-part clearing makes per-order reconciliation unavoidable. **`BD-203` is the question that closed it.**

> **PAY-034 — Where API integration exists the ERP matches automatically; where it does not, the settlement is reconciled manually before being marked complete** (`BD-060`, `BD-061`, `PAY-006`).

> **PAY-035 — A settlement difference never posts automatically** (`ACC-035`, `BR-130`, `BD-323`). The ERP **computes the comparison** — arithmetic — and records differences as **reconciliation exceptions for review** (`E-056`).

**This sits exactly on the `CP-8` boundary.** Computing the comparison is correctness; **deciding what a difference *means* — a legitimate deduction, a marketplace error, a missing order, a claim worth raising — is judgement, and stays with a person.**

> **PAY-036 — Any correction arising from a settlement difference is a linked adjustment, never an edit** (`ACC-035`, `ACC-002`, `DB-002`).

## 9.1 The variance path

> **PAY-037 — The investigate-then-contact sequence precedes marking a settlement reconciled** (`BD-062`, `OM §11.5` step 6).

Differences are investigated by reviewing the settlement report; where necessary the business contacts the courier or marketplace **before** the settlement is marked reconciled. **`SM-6` models the same path** — `VARIANCE_DETECTED → DISPUTED → RECONCILED` or `CLOSED_WITH_VARIANCE`.

> **PAY-038 — Matched orders reach `RECONCILED`; mismatches move to `SHORT_SETTLED` and are pursued** (`OM §11.5`, `SM-5`, `SM-6`).

---

# 10. Dispute

> **PAY-039 — A settlement dispute is raised with the external party and resolved by agreement or accepted as a variance** (`BD-065`, `SM-6`). `CLOSED_WITH_VARIANCE` is the sanctioned terminal state for a variance accepted or written off.

> **PAY-040 — A disputed deduction must be answerable with an evidence package** (`AUD-021`, `E-054`). The business's *"required supporting information"* is that.

⚠ **A difference in emphasis, recorded and not reconciled.** `OM §11.6` step 5 frames marketplace disputes as **financial** variances — a deduction higher than agreed, an unexpected category, a missing order, a penalty. `BD-065` states the most common claim trigger is **a returned product arriving damaged** — a physical-goods dispute with a financial consequence. **The documentation does not currently model damaged-return claims as a settlement dispute route.** Carried as recorded.

> **PAY-041 — A marketplace claim has its own lifecycle, owned elsewhere** (`SM-14`, `E-069`, `OM §9.11`). Post-submission states are **mirrored, never locally decided** (`SMA-036`), and **`SM-14` has no time expectation and may never be aged** (`SMA-037`) — the business stated positively that claim duration cannot be predicted.

---

# 11. Advances — Interface Only

**Advances are balances owned by `ACCOUNTING_ARCHITECTURE.md`.** This section states only the operational facts this module consumes.

> **PAY-042 — An advance is a balance, not a payment state, and `SM-5` requires no change to carry one** (`ACC-021`, `SMA-036`, `BD-312`).

**`SMU-14` and `SMU-17` closed with it, and the proposed `SMA-035` extension was withdrawn as unnecessary** — what was missing was *a balance for the payment to sit against, not a state for it to occupy*.

> **PAY-043 — Money received before delivery is recorded as Paid Amount with the remainder as Outstanding, and is applied automatically at delivery** (`BD-066`, `ACC-021`, `BR-127`).

**`BD-066` closed `GAP-035`** and named five situations in which money is taken before delivery: advance payment requested by the business · delivery charge collected in advance · partial payment before dispatch · installment purchases · corporate or approved arrangements.

> **PAY-044 — Advances never move a recognition point** (`BR-127`, `ACC-021`). Application is **automatic at the event that creates the obligation the advance prepaid** — it is not a judgement.

---

# 12. Refund Execution

## 12.1 The boundary

> **PAY-045 — Return & Exchange decides *entitlement*; Payment *executes*; Accounting *records*** (`SYS §11.2`, `E-045`, `RET §2.2`, `ACC-011`).

**`E-045` Refund states the split in its own ownership line:** *"Payment (execution); entitlement decided by Return & Exchange."*

## 12.2 The confirmed lifecycle

> **PAY-046 — `SM-10` Refund runs eight linear stages, confirmed by the business** (`SMA §22.3`, `RET-029`, `BD-349`):

`REQUESTED → REVIEW → APPROVED → AMOUNT_CONFIRMED → PAYMENT_PENDING → PAID → CONFIRMED → CLOSED`

> **PAY-047 — The accounting entry is created at `PAID`, never before** (`SMA-055`, `RET-029`, `ACC-003`, `BD-310`). Stages 1–5 are **operational only** — a refund can be requested, reviewed, approved and have its amount confirmed while remaining **entirely absent from the accounts**, because none of those acts moves money.

> **PAY-048 — `PAID` and `CONFIRMED` mirror collection and settlement in reverse** (`SMA-056`, `RET-030`). Money leaving Trioloo and money reaching the customer are **different events with a real gap between them** — and on the marketplace path the marketplace refunds the customer while Trioloo only sees it later in settlement (`BR-126`).

**Eight stages, linear, no join and no conditional branch — the shortest lifecycle in the architecture.** The only variation is **who pays**, which is data rather than a path.

> **PAY-049 — `SM-10` is never standalone; it attaches to a return or an exchange** (`RET §11.1`, `BD-349`).

## 12.3 The two gates

> **PAY-050 — A refund can never exceed the amount actually received for that order** (`BR-040`, `INV-45.1`).

> **PAY-051 — A refund is only initiated after the money has been received** (`BR-041`, `INV-45.2`). **Refunding money not yet settled creates real cash exposure on an unrecovered receivable** — the concrete risk at ~100% COD.

**`SMA §14.2` records these as two gates that clear in either order** — a **goods gate** (received and QC passed, `BR-046`, `BR-047`) and a **money gate** (`BR-041`).

✅ **The state-set divergence is resolved.** `SMA §14.3` — the earlier **proposed** set (`ENTITLED`, `BLOCKED_PENDING_GOODS`, `BLOCKED_PENDING_SETTLEMENT`, …) that predates `BD-349` — is **marked superseded in the owning document** (2026-08-09), and `SM-10` was ratified on the **eight confirmed stages only** (`SMA §22.3`, `RET-029`, `BR-142`). **The two sets are not merged.**

🔶 **What remains open, unchanged — `RP-SM10-GATES`.** **No ratified source states at which of the eight stages a refund waits when one gate is open.** The superseded set expressed this with two explicit blocking states; the confirmed set has none, because the business enumerated the stages a refund *passes through*, not the conditions under which it *waits*. **This is a business question. It is not resolved here, and ratification did not close it** (`DOC-005`, `DM-001`). `BR-040` and `BR-041` remain in force regardless.

## 12.4 Route and evidence

> **PAY-052 — Refunds follow the original collection route by default** (`BR-042`, `INV-45.3`) — marketplace refunds through the marketplace, direct payments through the original instrument.

> **PAY-053 — A marketplace refund reaches Trioloo as a settlement deduction, not as a cash payment** (`BR-126`, `ACC-037`, `BD-310`). The marketplace refunds the customer and recovers from a future settlement; **the ERP records it during reconciliation.**

> **PAY-054 — Every refund records its reason, its authorising actor, and its link to the triggering return, cancellation, or adjustment** (`BR-043`, `AUD-042`).

> **PAY-055 — Approving a return and issuing its refund are segregated** (`INV-45.4`, `PRM-012`).

---

# 13. Write-off

> **PAY-056 — An uncollectable amount is written off by an authorised decision, and the write-off does not reverse revenue** (`ACC-017`, `DM-056`, `BD-311`, `SM-5`).

**The sale remains recognised; the uncollectable amount posts as Bad Debt Expense** — *reversing the sale would make historical revenue move, violating `DB-003`.* **The posting is Accounting's** (`ACC-017`).

> **PAY-057 — A write-off carries a mandatory reason** (`BD-110`, `AUD-042`).

⚠ **`PRMU-8` is carried** — whether `PRM-008`'s magnitude bound on write-off is an **enforced number** or follows the discount pattern of *who decides, not how much* (`PRM-052`, `ACC §15`).

---

# 14. Supplier Payment Execution

> **PAY-058 — Procurement owns what is owed to a supplier; Payment executes the payment** (`PRC-002`, `PRC-047`, `PRC-048`, `DOC-005`).

| Procurement owns | Payment executes |
|---|---|
| **The payable, created at acceptance** (`PRC-002`) | The payment movements that settle it |
| The accepted quantity that sizes it | |
| Supplier settlement routes — return, exchange, credit (`PRC-054`) | |

> **PAY-059 — Supplier payment is a movement stream, and outstanding balance is a derived position** (`BR-111`, `PRC-048`, `DB-001`). Advance payment, full payment after receipt, partial payment, and multiple payments to settlement are all supported.

> **PAY-060 — A supplier advance is applied automatically at acceptance** (`PRC-051`, `ACC-021`) — the symmetric counterpart of `PAY-044`.

**The Supplier Ledger and its seven transaction types are recorded at `PRC-052` and `SYS-090`.** Not restated.

---

# 15. Duplicate Prevention

> **PAY-061 — Duplicate posting is prevented on deterministic identity and deferred on inferred identity** (`ACC-036`, `SYS-107`, `BD-402`). An external settlement reference where one exists; **business validation and user confirmation where none does.**

**This is the mechanism behind `CP-8`'s boundary** — something is a *judgement call* precisely when the system lacks the information to decide.

⚠ **`GAP-107` is carried unchanged: duplicate settlement detection is directional.** The external-reference test protects only when **both** records carry the key. **Bank credits rarely carry a marketplace settlement ID**, so a manual entry typically has no reference and an API import has nothing to match against — **and both post.** The rule states the confirmation path as the fallback for *manual* capture; **whether it applies to *automatic* is not said.** Not resolved here.

---


# 15A. Courier COD Remittance — 2026-08-09

**Source:** `BD-438` – `BD-440`, resolving pre-freeze blocker **A3** and answering `GAP-019`'s residual. **This document owns *how an obligation is operationally reconciled*** (`PAY-000`); **Accounting owns what it posts.** The three collection paths stay separate (`PAY-012`, `BD-059`, `DLV-094`).

## 15A.1 Three facts, where the architecture had two

> **PAY-070 — A courier remittance record existing, Trioloo actually receiving the money, and every consignment being reconciled are three separate facts and are never collapsed** (`BD-438`).

**`BR-035` already separated *collection* from *settlement*. `BD-438` inserts a third between them** — the courier's own record of having remitted — and states that **the record and the money can become available at different times.**

| Fact | Authority | Rule it rests on |
|---|---|---|
| **The courier says it remitted** | **Steadfast** | `BR-121`/`ACC-004` — **evidence, never a posting source** |
| **Trioloo received the money** | **Trioloo** | `SYS-011`/`BR-004` — **authoritative for its own money position** |
| **Every consignment is reconciled** | **Trioloo** | Per receivable (`PAY-075`) |

> **PAY-071 — Two prohibitions, stated by the business as prohibitions** (`BD-438`):
>
> - **A bank or MFS credit alone is never sufficient evidence of *which orders* were settled.**
> - **A courier panel statement alone is never proof that Trioloo *physically received* the money.**

> **PAY-072 — Money received is confirmed by Accounts, never inferred from a courier statement** (`BD-438`).

## 15A.2 What is retained, and how

> **PAY-073 — The courier-reported remittance record is retained as received and is never reconstructed from Order data** (`BD-438`, `SYS-010`, `SYS-046`). It holds the **remittance/batch reference**, the **consignments covered**, and **the amount Steadfast reported for each line where that information is available**.

> **PAY-074 — A remittance is retained at two levels: the batch, and the consignment lines underneath it** (`BD-438`, `INV-42.1`).

**This is what `INV-42.1`'s *line by line, never in aggregate* has always required and the model could not hold** — `E-042` carried *covered orders* as a bare attribute, and `E-044` Settlement Line belonged to the marketplace path alone.

> **PAY-075 — Remittance data is ingested automatically where the courier API supplies it, and entered or imported manually where it does not. API availability is never a precondition for reconciliation** (`BD-438`, `PAY-006`, `SYS-012`, `BR-029`, `ACC-036`).

> ⚠ **`BD-075` establishes the Steadfast API as primary and in live use — for *tracking and delivery status*. No document states whether it carries remittance or payment data at all**, which is why `BD-438` phrases ingestion conditionally. **Nothing here assumes it does.**

## 15A.3 Reconciliation completes per receivable

> **PAY-076 — Reconciliation completes at the individual consignment / receivable level. A clean consignment reconciles immediately and is never held open by an unrelated problem line in the same remittance** (`BD-439`).

**This is how `SM-5` already worked** — its subject is `E-040` Receivable, whose parent is one Order, and **no rule couples one receivable's transition to another's.** `BD-439` states the guarantee that was implicit.

> ✅ **This resolves `BD-061`'s recorded ambiguity.** That answer described **both** an aggregate comparison and a per-order one, and its commentary flagged the danger without resolving it — *two orders wrong in opposite directions produce a correct-looking total.* **The architecture had chosen per-order; `BD-439` confirms it.**

> **PAY-077 — Expected amount, courier-reported amount and actual matched amount remain distinguishable on every consignment line** (`BD-439`, `BR-038`). **A difference is never silently written off or automatically adjusted** (`PAY-035`, `ACC-035`, `BR-130`).

## 15A.4 Two acceptance acts, two authorities

> **PAY-078 — Accepting a legitimate courier deduction is a correction of expectation, not a write-off. It may be performed by a permissioned Accounts user and does not require owner or administrator authority** (`BD-440`).

**Permission is configurable through the existing model** (`PRM-069`, `PRM-004`, `AGV-030`) — **no fixed Accounts role, monetary threshold, approval hierarchy or job title is created.** The affected receivable then reconciles **using the corrected legitimate amount.**

**Recorded:** original expected amount · accepted amount or deduction · **reason** · **evidence/reference** · **performer** · **authoriser where separate approval is required** · timestamp.

> **PAY-079 — A genuine unrecoverable shortfall is a write-off, and `BD-110`'s owner or administrator authority applies unchanged** (`BD-440`). **`BD-110` is neither weakened nor replaced.**

> ✅ **`SM-5` already carried this distinction without its authority.** `SHORT_SETTLED → RECONCILED` fires on *“dispute resolved **or deduction accepted**”* and calls the acceptance *“itself an auditable financial decision”* — **but never said whose.** **The split is economic, not procedural: one corrects an expectation, the other abandons money.** `PRM-012`'s segregation — recording settlement and writing off a shortfall may not be one actor — **stands, and now has real work to do.**

## 15A.5 Batch closure records; it never decides

> **PAY-080 — A remittance batch closes only after every consignment has reached an authorised resolution. Closure records those completed resolutions and decides nothing** (`BD-440`).

**Permitted resolutions** — legitimate deduction / expectation correction (`PAY-078`) · recovered or paid amount · **authorised write-off** (`PAY-079`, `BD-110`) · or another resolution already supported by canonical architecture.

> **PAY-081 — Closing a batch with a recorded variance is never permission to bypass an unresolved receivable, and never itself writes off money, approves a deduction, changes an expected amount, or manufactures an accounting treatment** (`BD-440`, `ACC-035`, `BR-130`).

> ✅ **This is the sentence that settles the structure.** **A batch whose closure decides nothing has no decisions to sequence** — every underlying act already lives elsewhere under its own authority. **`SM-6`'s closure, by contrast, *is* a decision** performed at the batch with an actor, which is exactly why `BD-439` forbids copying its states. See `SMA-080`.



# 15B. Money Receipt — 2026-08-09

**Source:** `BD-446`, answering `BD-135`. **Post-Freeze amendment under `DOC-067`.** **Document ownership is not assigned here** — that belongs to Document / Printable Architecture, still in discovery.

> **PAY-082 — A Money Receipt is customer-facing proof that Trioloo has received money from the customer. It is a distinct document from the Receipt Voucher, which is internal** (`BD-446`, `ACC-052`).

> **PAY-083 — A Money Receipt may be issued where Trioloo itself receives customer money** (`BD-446`): **at the counter** · **direct bank/MFS or another supported direct method** · **own-staff cash collection, treated under the existing payment and custody rules**.

> **PAY-084 — A Money Receipt is never mandatory merely because the customer handed COD money to a courier. At that moment the courier's own collection and delivery evidence applies, and Trioloo has not received the money** (`BD-446`, `PAY-001`, `BR-035`, `DLV-132`).

> **PAY-085 — A courier remittance is Trioloo receiving settlement, and never a new customer payment** (`BD-446`, `PAY-070`). **The courier's record, Trioloo's receipt and reconciliation remain three separate facts.**

## 15B.1 What a Money Receipt evidences — and what it does not

> **PAY-086 — A Money Receipt evidences the customer's payment act. It never evidences, triggers or substitutes for the Payment record** (`BD-446`, `PAY-003`, `ACC-003`, `DLV-096`).

**This is the precision the own-staff path requires, and the frozen architecture already supplies both halves:**

| Fact | Complete when | Rule |
|---|---|---|
| **The customer has paid** | At the door or counter — **the customer is discharged** | **`BR-119`**, `BR-033` |
| **Trioloo has the money** | **When Accounts records the receipt** | **`DLV-096`**, `PAY-003`, `ACC-003` |

✅ **There is no conflict with the custody boundary, and none is created.** **`DLV-096` and `BR-035` keep cash in a staff member's hand outside *received money*, and `DLV-097`'s custody exposure — *no separate custody record while the money is carried* — is carried exactly as discovered.** A Money Receipt at the doorstep **acknowledges what the customer did**; **it says nothing about Trioloo's books.**

⚠ **No new payment state, posting rule, custody rule, numbering scheme, mandatory printing rule, tax treatment or layout is created** — each was **explicitly prohibited** by `BD-446`. **`PAY-009`'s seven collection modes are unchanged.**



# 15C. Employee advance money movements — 2026-08-10

**Source:** `BD-448` – `BD-457`. **Payment owns the money; Accounting owns the requisition and its positions** (`ACC-060`, `DOC-005`).

> **PAY-087 — An employee advance disbursement and a returned cash / bank / MFS amount are ordinary Payment Transactions. `E-041`'s parent set is generalised to include Advance Requisition; no second transaction entity exists** (`INV-41.2` unchanged, `CP-9`).

> **PAY-088 — A request or an authorisation never creates a Payment Transaction. Only actual disbursement and actual returned money do** (`BD-451`, `PAY-003`, `INV-41.3`).

> **PAY-089 — Accepted expense, salary recovery and write-off create no Payment Transaction. They are `E-089` adjustments and fabricate no money movement** (`ACC-079`, `INV-41.4`).

> **PAY-090 — Automatic advance application (`PAY-044`, `PAY-060`) does not fire for an employee advance, because it prepays no identified obligation** (`ACC-059`, `DM-080`). **Customer and supplier behaviour is unchanged.**

✅ **`ACC-007` already supplies what each disbursement must record** — **Collection Source and Financial Account** — with `AUD-012` giving actor and time. **No new attribute set is invented.**


# 16. Ownership Boundaries — Consolidated

| Payment supplies | The module owns |
|---|---|
| **Accounting** — the reconciled cash fact and the itemised deductions | **Every posting** (`ACC-011`), recognition (`ACC-013`), advances as balances (`ACC-021`), expense aggregation (`ACC-019`) |
| **Return & Exchange** — refund execution and its confirmation | **Entitlement**, eligibility, QC disposition, the return lifecycle |
| **Procurement** — supplier payment execution | **The payable and why it exists** (`PRC-002`) |
| **Order Management** — whether the money arrived, for order closure (`BR-037`) | Order lifecycle, delivery outcome, operational workflow |
| **Inventory** — nothing | Stock movements and positions |
| **Delivery** — the collection fact reported by the courier | Courier master, shipment, tracking, delivery confirmation |
| **Reporting** — receivable and settlement figures | Presentation only; **no figure is owned by reporting** (`DB-067`) |

**Payment owns no posting, no entitlement decision, no stock movement and no obligation.**

---

# 17. Entity References

| Entity | ID | Role here |
|---|---|---|
| **Receivable** | **`E-040`** | What is owed for one order — `SM-5` |
| **Payment Transaction** | **`E-041`** | An actual movement of money — **immutable** |
| **Remittance Batch** | **`E-042`** | Courier COD transfer covering many orders |
| **Marketplace Settlement** | **`E-043`** | Marketplace periodic net transfer — `SM-6` |
| **Settlement Line** | **`E-044`** | One order's portion — **where variance is detected** |
| **Refund** | **`E-045`** | Money returned — `SM-10`; **execution here, entitlement in Return & Exchange** |
| Invoice | `E-039` | **Owned by Accounting** |
| Financial Account | `E-068` | **Owned by Accounting** (`ACC-006`) |
| Marketplace Claim | `E-069` | `SM-14`, owned by `OM §9.11` |
| Exception | `E-056` | Settlement differences are a **type**, not a new entity (`ACC-035`) |
| Attachment | `E-054` | Dispute evidence (`AUD-021`) |

**No entity is defined here.** `DOMAIN_MODEL.md` is canonical (`DOC-005`).

> **PAY-062 — Every collection and payment records two independent references: Collection Source and Financial Account** (`DM-058`, `ACC-007`, `BD-315`). **Neither derives from the other** — *how the money was taken* is a different fact from *where it landed*.

> **PAY-063 — Payment transactions are immutable and use exact decimal representation** (`INV-41.1`, `INV-41.2`, `DB-037`). *Accumulated binary floating-point error will not reconcile.*

---

# 18. State Machine References

| Machine | Subject | Status |
|---|---|---|
| **`SM-5`** Payment | `E-040` | **Ratified** — one of the original seven |
| **`SM-6`** Marketplace Settlement | `E-043` | ✅ **Ratified 2026-08-09** into `OM §18.2` (`BR-142`); previously a proposed extension (`SMA-001`) |
| **`SM-10`** Refund | `E-045` | ✅ **Ratified 2026-08-09** into `OM §18.2` (`BR-142`) **on the eight states confirmed by the business** (`SMA §22.3`, `BD-349`); `SMA §14.3` is superseded |
| `SM-14` Marketplace Claim | `E-069` | Observed; owned by `OM §9.11` |
| `SM-20` Fund Transfer | `E-084` | Observed; **owned by Accounting** (`DOC-056`) |
| **Courier Remittance** | `E-042` | ⚠ **No machine exists** — `SMU-10`, §7.1 |

**No machine is defined here, and no machine was ratified here.** `SMA-011` required an `OM §18.2` and §18.3 amendment before `SM-6` and `SM-10` were settled; **that amendment was made on 2026-08-09 in `ORDER_MANAGEMENT_ARCHITECTURE.md`, not in this document.**

⚠ **`GAP-026` applies.** `RECEIVED`, `RECONCILED`, `APPROVED`, `CLOSED` and `CANCELLED` recur across machines; **machine-qualified state naming is required** (`SMA-047`, `DM-002`).

---

# 19. Audit and Permission

| Requirement | Rule |
|---|---|
| **Every collection, reconciliation, refund and write-off attributable** | `PAY-008`, `AGV-001`, `AUD-004` |
| **Settlement reports retained as received, unaltered** | `PAY-027`, `AUD-009`, `SYS-046` |
| **Refunds record reason, authorising actor and trigger link** | `PAY-054`, `BR-043`, `AUD-042` |
| **Write-offs carry a mandatory reason** | `PAY-057`, `BD-110`, `AUD-042` |
| **Approving a return and issuing its refund are segregated** | `PAY-055`, `PRM-012` |
| **A disputed deduction is answerable with an evidence package** | `PAY-040`, `AUD-021` |
| **Payment transactions are immutable; corrections are compensating** | `PAY-063`, `INV-41.1`, `DB-002` |
| Financial history retained permanently | `ACC-012`, `BD-338` |

**Financial actions are authorised per `PRM-008`'s magnitude model.** ⚠ `PRMU-8` remains open on whether refund and write-off bounds are enforced numbers (`ACC §15`).

---

# 20. Notification and Reporting

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.** This module raises these obligations against it:

| Obligation | Category | Source |
|---|---|---|
| **Unremitted COD aged beyond terms** | **Action Required** — an exception requiring action, not a passive balance | `BR-036`, `INV-42.2`, `SYS-023` |
| **Settlement variance awaiting review** | **Action Required** | `ACC-035`, `PAY-035` |
| **An order missing from a settlement** | **Action Required** — flagged and aged | `INV-44.2` |

**Report definitions are owned by `REPORTING_ARCHITECTURE.md`; no figure is owned by reporting** (`DB-067`). Three of the eleven confirmed V1 reports read payment-owned facts (`SYS-087`, `BD-314`): **Collection** (rank 3) · **Customer Due** (rank 5) · **Cash & Bank Balance** (rank 7).

⚠ **`SYS-090` records that no customer ledger is required**, and justifies the asymmetry: at ~100% COD customers rarely carry a running balance and the receivable sits with the marketplace or courier. **The ledger belongs where balances persist.**

---

# 21. Open GAP References

**Carried, not solved.**

| GAP | Severity | Bearing on payment |
|---|---|---|
| **`GAP-006`** | 🔴 Critical | **The payment module was recorded as absent** — receipts, remittance batches, settlement ingestion, reconciliation matching, variance and dispute, refund execution. **This document supplies the specification; formal closure is a `GAP_ANALYSIS.md` decision and is not made here** |
| **`SMU-10` / `GAP-027`** | 🟠 High | **Courier remittance has no state machine**, leaving `BR-036`'s cash-in-transit exposure with no states to age against (§7.1) |
| **`GAP-071`** | 🟠 High | **Own-staff delivery creates a third settlement path with no model** (`BD-068`). Cash returns directly, with no courier remittance and no marketplace settlement; `OM §11` models two paths (`BR-077`, `DMU-27`). **`COD_OWN_DELIVERY` exists as a collection mode; the settlement path does not** |
| **`GAP-072`** | 🟠 High | **Installment sales are confirmed and modelled nowhere** (`BD-028`). No entity, no state machine, no receivable schedule (`DMU-26`) — yet installment is a listed payment method (`BD-057`) |
| **`GAP-055`** | 🟡 Medium | **No payment gateway model is documented anywhere**, though Online Payment Gateway is a listed method (`BD-057`) |
| **`GAP-081`** | 🟡 Medium | **Refund recovery classification** — a marketplace refund arrives as a settlement deduction (`PAY-053`) but is not a fee for a service. `Marketplace Charges` or against revenue is unsettled. **Extends to return-shipping recovery** (`RET-032`) |
| **`GAP-084`** | 🟡 Medium | **Claim compensation classification** — an approved claim brings money in that is not revenue. **Same shape as `GAP-081`, opposite direction** |
| **`GAP-107`** | 🟡 Medium | **Duplicate settlement detection is directional** (§15) |
| **`GAP-019`** | 🟠 High | **`RECEIVED → RECONCILED` is `UNDECIDED`** — manual or automatic is unstated (§5.1) |
| **`GAP-024`** | 🟡 Medium | **No ageing threshold is defined** for unremitted COD, a missing settlement line, or a stalled dispute. `BD-063`'s 7-day cycle is a **fact about Daraz**, not a configured threshold |
| **`GAP-082`** | 🟠 High | **Net Profit completeness varies by period** — revenue and COGS post at delivery, channel charges at settlement up to 7 days later (`SYS-089`, `ACC-042`) |
| **`GAP-093`** | 🟡 Medium | **Revenue recognition on a converted replacement** (`RET §11.4`) |
| **`GAP-026`** | 🟡 Medium | **State names collide across machines** (§18) |
| **`PRMU-8`** | — | Whether refund and write-off magnitude bounds are enforced numbers (§19) |
| **`GAP-001`** | 🔴 Critical | Module documents remain unwritten. **This document reduces the count by one** |

**Closed elsewhere, recorded for traceability only:** `GAP-035` (`BD-066`), `GAP-078` / `SMU-14` / `SMU-17` (`BD-312`, `SMA-036`), `BD-229` (`BD-310`, `DM-055`), `BD-203` (`BR-129`). **None is closed by this document.**

> ⚠ **A chargeable repair is a confirmed customer obligation that this module has no mechanism for — recorded 2026-08-09, not solved.**
>
> `BD-428` confirms that where a customer must pay before work continues or before the product is released, **the amount and reason are communicated and the case waits**; `BD-429` confirms such an amount **may be collected on the handback shipment**. **`EVT-090` carries the decision; it never carries money.**
>
> **No existing mechanism here covers it.** `PAY-013` scopes `E-040` Receivable to **what is owed for one order**, and `PAY-014` ties payment obligation to **delivered goods** — **a repair service charge is neither.** **No receivable is created, no collection mode is extended and no payment state is invented** (`DOC-024`). Carried open at `EVENT_ARCHITECTURE.md` §20.3.
>
> **`PAY-049` and the warranty-refund conflict are untouched by this note.**

**Two observations were recorded at v1.0.0; one is now reconciled.** The `SM-10` proposed-versus-confirmed state divergence (§12.3) **is resolved** — `SMA §14.3` superseded, ratification taken on the confirmed eight (2026-08-09). The `BD-064` / `OM §11.6` deduction-category mapping (§8.1) **remains open**, as does the gate-to-stage mapping `RP-SM10-GATES`.

---

# 22. Traceability

## 22.1 Business Decisions consumed

| BD | Contributes |
|---|---|
| `BD-057` | Ten payment methods across three dimensions |
| `BD-058` | **~100% COD** — the defining property of this module |
| `BD-059` | **Two settlement paths** — courier and marketplace logistics |
| `BD-060` | Batch settlement · bank transfer or cash withdrawal · manual fallback |
| `BD-061` | Reconciliation against corresponding orders · API and manual paths |
| `BD-062` | **Investigate, contact, then mark reconciled** |
| `BD-063` | **7-day Daraz settlement cycle** · actual receipt over reported status |
| `BD-064` | **Five deduction categories** · record actual, never calculate |
| `BD-065` | Dispute via claim · damaged returns as the common trigger |
| `BD-066` | **Paid Amount and Outstanding** · five pre-delivery collection situations |
| `BD-310` | **A refund is recorded when money actually returns** |
| `BD-311` | **A write-off does not reverse revenue** |
| `BD-312` | **Advances are balances on both sides** |
| `BD-315` | Collection Source and Financial Account are independent |
| `BD-349` | **`SM-10`'s eight confirmed stages** · accounting at `PAID` |
| `BD-402` | Capture method is an attribute, not an identity |

**Prior coverage consumed:** `BD-028`, `BD-068`, `BD-110`, `BD-304`, `BD-306`, `BD-313`, `BD-314`, `BD-323` – `BD-325`, `BD-338`, `BD-352`.

## 22.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `BR-004`, `BR-029`, `BR-033` – `BR-044`, `BR-077`, `BR-116` – `BR-134` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `ACC-002` – `ACC-007`, `ACC-011` – `ACC-021`, `ACC-035` – `ACC-037`, `ACC-042` | `ACCOUNTING_ARCHITECTURE.md` |
| `RET-029` – `RET-032` | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `PRC-002`, `PRC-047` – `PRC-052`, `PRC-054` | `PROCUREMENT_ARCHITECTURE.md` |
| `SM-5`, `SM-6`, `SM-10`, `SM-14`, `SMA-001`, `SMA-011`, `SMA-036`, `SMA-037`, `SMA-047`, `SMA-055` – `SMA-057` | `STATE_MACHINE_ARCHITECTURE.md` |
| `E-039` – `E-045`, `E-054`, `E-056`, `E-068`, `E-069`, `INV-40.1` – `INV-40.4`, `INV-41.1`, `INV-41.2`, `INV-42.1`, `INV-42.2`, `INV-43.1` – `INV-43.3`, `INV-44.1`, `INV-44.2`, `INV-45.1` – `INV-45.4`, `DM-001`, `DM-002`, `DM-051` – `DM-058` | `DOMAIN_MODEL.md` |
| `SYS-010` – `SYS-012`, `SYS-016`, `SYS-021` – `SYS-023`, `SYS-026`, `SYS-046`, `SYS-047`, `SYS-087`, `SYS-089`, `SYS-090`, `SYS-107`, `CP-8`, `CP-12` | `SYSTEM_ARCHITECTURE.md` |
| `DB-001` – `DB-003`, `DB-005`, `DB-022`, `DB-037`, `DB-039`, `DB-067` | `DATABASE_ARCHITECTURE.md` |
| `PRM-005`, `PRM-008`, `PRM-012`, `PRM-052`, `AGV-001` | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `AUD-004`, `AUD-009`, `AUD-021`, `AUD-042` | `AUDIT_ARCHITECTURE.md` |
| `DOC-005`, `DOC-056` | `MASTER_DOCUMENTATION_INDEX.md` |

## 22.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`SMA-035` withdrawn** — an advance is a balance, not a payment state | `PAY-042` |
| **`BR-044` reclassified** — an RTO leaves no phantom receivable, automatically | `PAY-017` |
| **`BD-203` settled by structural necessity** — reconciliation is per-order | `PAY-004`, `PAY-033` |
| **`BD-061`'s aggregate reading superseded** by `BR-129` | `PAY-033` |
| **`SM-10` states confirmed by the business**, superseding the earlier proposal | `PAY-046`, §12.3 |

---


---

# 15D. Salary and Employee Loan movements — 2026-08-10

**Source:** `BD-476`, `BD-486`. **Payment owns the money; it owns no employee position.**

> **PAY-091 — A Salary Payment is a Payment-owned movement that settles the Accounting-held Outstanding Salary Payable** (`ACC-093`, `HRP-051`).
>
> **Cash, Bank Transfer and MFS are all valid routes** (`BD-476`). **Partial and split payment are supported** — **one finalised payroll result may be settled by several movements.**

> **PAY-092 — Finalisation and payment are separate facts, and a movement is recorded only on actual confirmed transfer of value** (`ACC-094`, `PAY-001`'s discipline).
>
> ⚠ **A finalised payroll run is not a payment.** **An intention, an instruction or a reference is not a movement.**

> **PAY-093 — Every salary payment is allocated to the specific employee and payroll period it settles** (`ACC-064`'s discipline). ⚠ **No anonymous employee-level salary balance.**

> **PAY-094 — An Employee Loan disbursement and an outside-payroll repayment are Payment-owned movements linked to a specific loan** (`BD-486`, `ACC-092`).
>
> **Cash, Bank Transfer and MFS are valid repayment routes, and payroll deduction is one route among them, not the only one** (`BD-486` §1).

> **PAY-095 — A repayment reduces the loan only on actual receipt plus recording/confirmation by an authorised user** (`BD-486` §2). ⚠ **Stating that payment was made, supplying a reference, or intending to pay reduces nothing.**

> **PAY-096 — Recording a loan repayment is a different authority from authorising the loan, amending its schedule, pausing an instalment or writing it off** (`BD-486` §6).
>
> ✅ **Permission-controlled, NOT Owner/Administrator-only merely because the underlying position is a loan.** ⚠ **Title-binding appears where a decision changes money the company will or will not RECEIVE; recording a repayment does the opposite.** **The money receipt still follows the applicable Cash/Bank/MFS controls and remains attributable to the recording actor.**

> **PAY-097 — A write-off is never recorded as a payment movement** (`BD-488` §9, `ACC-090`). ⚠ **No fabricated Cash, Bank, MFS or Payroll receipt to make a position reach zero.**


# 23. Version History

| Version | Date | Change |
|---|---|---|
| **1.7.0** | **2026-08-10** | ✅ **Employee advance money movements — `BD-448` – `BD-457`. §15C, `PAY-087` – `PAY-090`. Post-Freeze amendment under `DOC-067`.** **Payment owns the money; Accounting owns the requisition and its positions** (`ACC-060`). **`E-041`'s parent set is GENERALISED to include Advance Requisition rather than duplicated** — a disbursement and a returned amount are **real money movements that fitted none of the three original parents**, and a second transaction entity would split one concept (`CP-9`, `DOC-006`). **`PAY-088`: a request or authorisation NEVER creates a transaction** — only actual disbursement and actual returned money do. **`PAY-089`: accepted expense, salary recovery and write-off create NONE** — they are `E-089` adjustments that fabricate no movement. ✅ **`PAY-090` scopes `PAY-044`/`PAY-060` without weakening them**: automatic application does not fire for an employee advance because **it prepays no identified obligation**, and **customer and supplier behaviour is unchanged.** ✅ **`ACC-007` already supplies the per-disbursement record** — Collection Source and Financial Account — so **no new attribute set was invented** |
| **1.6.0** | **2026-08-09** | ✅ **POST-FREEZE AMENDMENT under `DOC-067` — `BD-446` answers `BD-135`. §15B added, `PAY-082` – `PAY-086`. No existing rule changed.** **A Money Receipt is CUSTOMER-FACING proof Trioloo received money, and is a DIFFERENT document from the internal Receipt Voucher** (`ACC-052`). It **may** be issued at the counter, on direct bank/MFS payment, or on own-staff cash collection under existing custody rules — and **`PAY-084`: it is NEVER mandatory merely because the customer handed COD money to a courier**, which is **`PAY-001`/`BR-035` stated from the document side.** **`PAY-085`: a courier remittance is Trioloo receiving settlement, never a new customer payment** (`PAY-070`'s three facts). ✅ **`PAY-086` is the precision the own-staff path needed, and both halves were already frozen**: **`BR-119` discharges the customer at the door** while **`DLV-096` completes Trioloo's receipt only when Accounts records it.** **A Money Receipt evidences the customer's act and never evidences, triggers or substitutes for the Payment record.** **`DLV-097`'s custody exposure is carried exactly as discovered; no conflict exists and none was created.** ⚠ **No payment state, posting rule, custody rule, numbering, printing mandate, tax treatment or layout created** — all explicitly prohibited; **`PAY-009`'s seven collection modes unchanged** |
| **1.5.0** | **2026-08-09** | ✅ **Courier COD remittance reconciled — `BD-438` – `BD-440`, pre-freeze blocker A3. §15A added, `PAY-070` – `PAY-081`. No existing rule amended.** **THREE facts where the architecture had two**: `BR-035` separated collection from settlement, and **the courier's own record of having remitted sits between them** — **record exists ≠ money received ≠ every consignment reconciled**, and they can arrive days apart. **`BR-121`/`ACC-004` fit the first exactly** (evidence, never a posting source), **`SYS-011`/`BR-004` the second.** **Two prohibitions stated as prohibitions**: a bank credit alone never establishes **which orders** were settled; a courier statement alone is never proof of **receipt**. **`PAY-073`/`PAY-074`: the courier record is kept as received, never reconstructed from Order data, and retained at BOTH batch and consignment-line level** — which is what **`INV-42.1` always required and the model could not hold.** **`PAY-075`: API optional** — `PAY-006` restated by the business unprompted; ⚠ **`BD-075`'s Steadfast API is confirmed for *tracking*, and no document says it carries remittance data.** ✅ **`PAY-076`: reconciliation completes PER RECEIVABLE** — already how `SM-5` worked, now guaranteed, and it **resolves `BD-061`'s recorded aggregate-versus-per-order ambiguity.** ✅ **`PAY-078`/`PAY-079` split variance acceptance on an ECONOMIC line**: correcting an expectation is **permissioned Accounts, not owner-only, not a write-off**; abandoning money is a write-off under **`BD-110` unchanged**. **`SM-5` already carried the distinction — *dispute resolved or deduction accepted* — without ever saying whose decision.** ✅ **`PAY-080`/`PAY-081`: batch closure RECORDS and never decides** — the sentence that settles the structure, and why `SM-6`'s states are not copied |
| **1.4.0** | **2026-08-09** | **`EVU-16` resolved by architecture decision — `PAY-064` amended, `PAY-067` – `PAY-069` added, `PAY-015` PRESERVED.** **The receivable is created GROSS and applied Trade-In Credit clears part of it as a non-cash clearing component** — `PAY-015` already provided for clearing *“never by cash alone”*, and credit is a third component of the same kind, so **`PAY-015` needed no amendment.** **`PAY-064` is amended, not withdrawn** (`DOC-021`): it briefly implied a net receivable. **Order Total and Sales Revenue are untouched and Trade-In Credit is never a discount.** **`PAY-068` draws the ownership line** — Payment orchestrates the application, **Accounting owns `E-083`, validation and the authoritative movement**, Trade-In owns neither. **`PAY-069` models the interaction as an explicit request that Accounting may refuse** (`SYS-006`, `SYS-032`) — **a request is never an event** (`EVA-002`), the same shape as a stock reservation. **Credit reversal and expiry remain unresolved** |
| **1.3.0** | **2026-08-09** | **First Trade-In rules — `PAY-064` – `PAY-066` added; `PAY-015` unamended.** This module had **no Trade-In content at all**. `BD-433` settles the sequencing that `EVU-16` turned on: **credit is applied before dispatch**, so **the obligation created at dispatch reflects the remaining payable** while **the Order Total and recognised revenue stay at full value.** **`PAY-066` records that the collector never applies the credit** — the courier receives one figure, which at ~100% COD keeps a non-cash instrument off the parcel. ⚠ **One architecture decision recorded, not taken**: `PAY-015` creates receivables **gross** and clears them in parts, so **whether the receivable is created net or created gross and partly cleared by the credit is open** — **the business requirement is satisfied either way and `PAY-015` is not contradicted.** ⚠ **`EVU-16`'s producer question remains** — two entities change and no rule picks between their owners |
| **1.2.0** | **2026-08-09** | **One open finding recorded — no rule added, amended or withdrawn.** `BD-428` and `BD-429` confirm a **chargeable repair as a real customer obligation**, potentially collected on a handback shipment. **This module has no mechanism for it**: `PAY-013` scopes a receivable to one **order** and `PAY-014` ties obligation to **delivered goods**, and a repair service charge is neither. **The interaction is recorded as OPEN rather than filled** — no receivable, collection mode or payment state was invented (`DOC-024`). **`PAY-049` and the warranty-refund conflict are untouched** |
| **1.1.0** | **2026-08-09** | **`SM-6` and `SM-10` RATIFIED — status references corrected, no rule changed.** `OM §18.2` was amended to register them (`BR-142`), discharging `SMA-001` and `SMA-011`. **`SM-10` was ratified on the eight business-confirmed stages only** (`BD-349`, `SMA §22.3`, `PAY-046`); **`SMA §14.3`'s proposed set is marked superseded and no state of it is registered — the two sets are not merged.** §12.3's first observation is therefore **resolved**. **The residual reconciliation point `RP-SM10-GATES` remains open and unchanged**: no ratified source states at which of the eight stages a refund waits when a gate is open. **`BR-040` and `BR-041` remain in force**; the `BD-064` / `OM §11.6` category mapping also remains open. **No payment rule changed** |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §8 (`BD-057` – `BD-066`) with §19, §20, §22 and §27, and the reconciliations at `OM §11`/`§9.9A`–`§9.11`, `SMA §9`, `§10`, `§14`, `§22.3` and `DOMAIN_MODEL.md` `DM-051` – `DM-058`. **64 rules (`PAY-000` – `PAY-063`), all traceable; no business rule, entity, state machine or lifecycle introduced.** `PAY-000` records the ownership boundary **already drawn by `ACC-000` and `BR-121`**, and reciprocates it — no posting rule is restated. **`SM-6` and `SM-10` are carried as unratified proposed extensions** (`SMA-001`); **courier remittance is carried as having no machine at all** (`SMU-10`). Fifteen open items carried; **`GAP-006` is supplied with its specification but not closed**, and the `SM-10` state divergence and `BD-064` category mapping are recorded as observations rather than reconciled |
| **1.8.1** | **2026-08-11** | 🔴 **FINAL ARCHITECTURE AUDIT — DOCUMENTARY CORRECTION ONLY. No rule, movement, reconciliation or ownership changed.** **Document Control cited `BUSINESS_DISCOVERY.md` §19 as `BD-304` – `BD-316`; `BD-316` does not exist — §19 closes at `BD-314` (`11 of 11`), `BD-315` is an appended correction and §20 opens at `BD-317`.** ✅ **Corrected to `BD-304` – `BD-315`.** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies payment business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
