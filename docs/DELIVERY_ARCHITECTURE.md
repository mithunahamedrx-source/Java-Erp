# Delivery Architecture

**Owner:** Trioloo Technology · **Module:** Delivery · **Status:** Canonical
**Version:** 1.8.0 · **Ratified:** 2026-08-08 · **Rule prefix:** `DLV-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §9 Delivery Rules (`BD-067` – `BD-075`), **§28 Courier Commercial Model** (`BD-405` – `BD-417`, `BD-190`, `BD-191`) and **§29 Delivery Workflow** (`BD-211`, `BD-212`, `BD-213`, `BD-216`, `BD-218`), with §8 Payment Rules (`BD-058` – `BD-060`, `BD-063`), §17 (`BD-291`), §19 (`BD-304` – `BD-314`) and §20 (`BD-319`, `BD-323`).

**Reconciliation records consolidated:** [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §9 – §11 (`BR-023` – `BR-044`, `BR-077`) · [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) §8 (`SM-4`), `SMA-013` · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §19.1 (`SYS-082`) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-036` – `E-038`.

**References, never duplicated:** [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) `PAY-` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) `WHS-` · [`PROCUREMENT_ARCHITECTURE.md`](PROCUREMENT_ARCHITECTURE.md) `PRC-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`API_ARCHITECTURE.md`](API_ARCHITECTURE.md) `API-` · [`REPORTING_ARCHITECTURE.md`](REPORTING_ARCHITECTURE.md) `RPT-` · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) `NOT-` · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **DLV-000 — This document answers *how goods physically reach the customer, who carried them, what that transport cost, and what the carrier reported*. It answers nothing about stock, postings, reconciliation, order lifecycle, physical handling, or what any report shows.**

| Question | Owner |
|---|---|
| **How goods reached the customer · what transport cost · what the carrier reported** | **`DELIVERY_ARCHITECTURE.md`** — `DLV-` |
| Order lifecycle, release, closure, operational workflow | [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) — `BR-` |
| **Did the money arrive, does it match, what now** | [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) — `PAY-` |
| **What posts, and to which account** | [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) — `ACC-` |
| Stock quantity, movements, dispositions | [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) — `IVN-` |
| **Physical picking, packing, QC, handover execution** | [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) — `WHS-` |
| Return and exchange lifecycles, QC disposition | [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) — `RET-` |
| State and transition definitions | [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) — `SM-`, `SMA-` |
| Adapter capability, idempotency, sync lifecycle | [`API_ARCHITECTURE.md`](API_ARCHITECTURE.md) — `API-` |
| Which reports exist and what each reads | [`REPORTING_ARCHITECTURE.md`](REPORTING_ARCHITECTURE.md) — `RPT-` |

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine, lifecycle or threshold is introduced. **No gap is resolved by assumption and no queued follow-up is answered** — see §27.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To record how goods physically reach a customer in a business where **the carrier is not Trioloo**, and where **approximately 100% of orders are Cash on Delivery** (`BD-058`).

Two facts shape everything below, and both are external:

> **The courier is the system of record for delivery outcome** (`SYS-010`, `SM-4` authority). Trioloo follows what the carrier reports; it does not decide whether a parcel was delivered.

> **On a marketplace order, Trioloo does not even choose the carrier** (`BD-059`, `BD-408`). Daraz Logistics carries it, Daraz prices it, and Daraz confirms it.

**The module therefore owns a great deal of fact and very little authority** — which is why its rules are mostly about recording faithfully what someone else decided.

---

# 2. Scope

## 2.1 In scope

Fulfilment methods and their selection · the courier master and its capability boundary · the shipment model and its relationship to the order · the shipment lifecycle as applied · tracking ingestion and provenance · failed-delivery recovery · return-to-origin as a delivery outcome · the **courier commercial model** — every confirmed charge type, estimated versus actual · the **Customer Delivery Charge** and its independence from courier cost · **Delivery Profit/Loss** as an analytical metric · the marketplace delivery boundary · COD collection across three paths · own-staff COD custody · self-pickup handover · courier claims.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Order lifecycle, release authority, closure** | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| **Receivable lifecycle, remittance reconciliation, settlement matching, variance, dispute** | `PAYMENT_ARCHITECTURE.md` (`PAY-000`) |
| **Every posting**, recognition, expense categories | `ACCOUNTING_ARCHITECTURE.md` (`ACC-011`) |
| **Stock movements, quantities, not-sellable conditions, dispositions** | `INVENTORY_ARCHITECTURE.md` (`IVN-000`) |
| **Picking, packing, dispatch preparation, QC execution, self-pickup physical handover** | `WAREHOUSE_ARCHITECTURE.md` (`WHS-000`) |
| **Return and exchange lifecycles, refund entitlement** | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| **Valuation and cost derivation of goods** | `INVENTORY_COSTING_ARCHITECTURE.md` (`ICO-000`) |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` |
| **Adapter capability declaration, idempotency, provenance mechanics** | `API_ARCHITECTURE.md` |
| **Which reports exist; any figure a report shows** | `REPORTING_ARCHITECTURE.md`, `DB-067` |
| Notification delivery | `NOTIFICATION_ARCHITECTURE.md` |
| Screen layout, density, interaction | `DESIGN_CONSTITUTION.md` (`SYS-047`) |
| **Commercial parameters — actual rates, percentages, windows** | **Configuration** (`SYS-013`, `SYS §17`) |

---

# 3. Architectural Principles

## 3.1 P1 — The carrier is authoritative for what it did

> **DLV-001 — Delivery outcome is reported by the carrier and mirrored, never locally decided** (`SYS-010`, `SM-4` authority, `BD-072`).

> **DLV-002 — Trioloo is authoritative for what it performed; the carrier is authoritative for what it carried** (`SYS-011`, `BR-133`, `BD-319`). *"Trioloo's role is customer communication and decision-making, not managing the courier's field operation"* (`BD-216`).

## 3.2 P2 — Record the outcome, never compute it

> **DLV-003 — The ERP never assumes, hardcodes or calculates a courier charge. It records the actual outcome from the courier's official records** (`SYS-104`, `BD-405`, `BD-406`).

**The reasoning is the business's own:** *"courier pricing policies may change over time"* (`BD-406`). **It is the same conclusion `ACC-033` reached about MFS transfer fees** — a built-in calculator *"would be wrong within months and would then silently disagree with the bank statement."*

## 3.3 P3 — Expected and actual are both retained

> **DLV-004 — Where an estimate and an actual may differ, both are recorded and the estimate is never overwritten** (`SYS-055`, `BR-038`, `BD-405`, `BD-190`).

## 3.4 P4 — Capability bounds behaviour

> **DLV-005 — Delivery behaviour is bounded by what the carrier's integration supplies, and the absence of a data element must never prevent normal operation** (`SYS-095`, `API-008`, `API-015`, `BR-134`).

***"No tracking events"* and *"tracking events not supported"* look identical on a screen and mean opposite things.**

## 3.5 P5 — Operational completion and financial settlement are different facts

> **DLV-006 — Delivery completion and money receipt are separate events and must never be merged** (`BR-035`, `PAY-001`, `BD-211`).

**The business required this explicitly and permanently**, and extended it further than the rule did — see §17.

## 3.6 P6 — Every delivery action is attributable

> **DLV-007 — Every dispatch, tracking entry, recovery decision and handover is attributable to an Operational User Profile** (`AGV-001`, `AUD-004`, `PRM-005`).

---

# 4. Fulfilment Methods

> **DLV-008 — Four fulfilment paths are confirmed in use, and the fulfilment method determines whether a shipment lifecycle exists at all** (`SMA-013`, `BD-067` – `BD-069`, `BD-059`).

| Path | Carrier | Shipment? | COD collected by | Confirmed by |
|---|---|---|---|---|
| **Courier delivery** | **Steadfast** | **Yes** — `SM-4` | Courier | `BD-067` |
| **Own-staff delivery** | **Trioloo staff** | **Yes** — but *"no courier, no consignment reference, and no courier remittance"* (`BR-077`) | **Trioloo's own person** | `BD-068`, `BD-211` |
| **Self Pickup** | — | **None** (`INV-37.5`) | At the counter | `BD-069`, `BD-191` |
| **Marketplace fulfilment** | **Daraz Logistics** or the provider Daraz assigns | Yes — **mirrored** | Marketplace or its courier | `BD-059`, `BD-408` |

> **DLV-009 — Own-staff delivery is a real fulfilment path, not a future capability** (`BR-077`, `BD-068`). Used for **local, urgent, and special customer requests** (`BD-068`).

⚠ **`OM §8.8` anticipated own delivery for *large televisions, high-value orders, and orders requiring installation or demonstration at handover*.** The business gave **local, urgent and special requests**. *"Local"* overlaps; the others are not mentioned. **Recorded as stated at `BD-068`, not reconciled.**

## 4.1 Digibox and pickup-point addresses

> **DLV-010 — A Digibox or marketplace pickup-point address is a marketplace-controlled destination, not a Trioloo-operated delivery method** (`BD-213`).

**The customer selects a collection point on Daraz; Daraz assigns the destination automatically; the order reaches Trioloo with that address already on it** (`BD-213`, `SYS-010`).

> **DLV-011 — Trioloo does not operate, manage or offer Digibox as one of its own delivery methods, and prepares such orders exactly as any other Daraz order** (`BD-213`).

**The entire Digibox operation — customer notification, locker allocation, customer collection and final delivery confirmation — is handled by Daraz Logistics** (`BD-213`).

> **`BD-213` resolved a registered conflict without a side being chosen** (`DOC-050` entry 4). The business statement and the binding reference image are **both true and describe different responsibilities.**

⚠ **`BR-026`'s current application is carried as an open reconciliation point** — see §26.

---

# 5. Courier Master

> **DLV-012 — `E-036` Courier is the carrier master record, holding coverage, COD capability, declared-value limit, fragility handling, rate structure *(versioned)*, remittance terms, performance history, integration mechanism and courier reference identifiers** (`E-036`).

> **DLV-013 — Steadfast is the default and primary courier for all courier deliveries, assigned automatically. There is no courier selection step** (`BD-067`, `SYS-082`).

> **DLV-014 — Courier *selection logic* is not modelled** (`SYS-082`). `OM §9.3` specifies a courier-assignment decision weighing coverage, channel constraint, COD capability, declared-value limit, fragility handling, cost and past performance — **none of which is exercised today, because no choice is being made.**

> **DLV-015 — The multi-courier assumption is withdrawn** (`SYS-082`, closing `OM Q-7` and `SYS U-4`). **`SYS-082` records the correction explicitly**, and this document does not reintroduce it.

> **DLV-016 — Courier assignment remains configuration-driven, and adding a courier requires no change to the shipment lifecycle** (`BR-028`). **`SYS-082` records that this rule *"stands and is now more valuable, not less"*** — it is what keeps a single-courier operation from hard-coding Steadfast into the shipment model.

**The distinction is deliberate and is not an invitation to build selection:** the **adapter boundary** is retained (`API-003`); the **selection decision** is not modelled.

## 5.1 Integration boundary

> **DLV-017 — The courier adapter's declared capability bounds what can be synchronised, per operation and per direction** (`API-004`, `API-012`, `SYS-094`).

**`SYS §12.3` registers courier integration as *booking, tracking, COD remittance*.**

⚠ **`BD-216` describes an outbound operation not in that register** — communicating a corrected address or a re-attempt request to the courier. **Whether it travels by API, panel or phone call is not stated** and is queued as `BD-423`. **No capability is asserted here.**

---

# 6. Shipment Model

> **DLV-018 — `E-037` Shipment is one physical movement of goods toward a customer, and is an entity in its own right, not an attribute of the order** (`BR-027`, `INV-37.1`).

> **DLV-019 — AMENDED 2026-08-09 (`BD-442`). An order has at most ONE ACTIVE shipment; a shipment belongs to exactly one order** (`BR-023` as amended, `INV-37.2`). ⚠ ~~*An order may have many shipments*~~ — **successive shipments across fulfilment attempts remain normal**; what is withdrawn is **concurrency**.

> **DLV-020 — Each shipment carries its own independent state** (`BR-024`, `INV-37.3`). **STANDS.** ⚠ ~~*One shipment delivered and another lost is a normal, representable situation.*~~ **Illustration WITHDRAWN 2026-08-09 (`BD-442`)** — an order has **at most one active shipment**, so the situation cannot arise. **Successive shipments across fulfilment attempts remain normal** — an RTO'd parcel re-sent is a second shipment.

> **DLV-021 — AMENDED 2026-08-09 (`BD-442`, `BR-159`): the order reaches `Order:DELIVERED` when its shipment is delivered. `Order:PARTIALLY_DELIVERED` is REMOVED** — a refused or undeliverable parcel reaches **`FAILED_DELIVERY`** and follows RTO (`BR-117`, `DLV-044`, `DLV-050`). ⚠ ~~*The order reaches `Order:DELIVERED` only when every shipment is delivered; otherwise `Order:PARTIALLY_DELIVERED`*~~ (`BR-025`, `INV-37.4`). **The order state is `ORDER_MANAGEMENT_ARCHITECTURE.md`'s; this document states only the shipment condition it depends on.**

> **DLV-022 — A `SELF_PICKUP` order has no shipment at all** (`INV-37.5`, `SMA-013`, `BD-069`, `BD-191`). Confirmed three times across discovery.

> **DLV-023 — The address on a shipment is a snapshot** (`E-037`, `SYS-017`, `DB-023`). *"The address at dispatch"* is named in `SYS-017` as a snapshotted value; changing a customer's address later never rewrites where a past parcel went.

---

# 7. Shipment Lifecycle

> **DLV-024 — `SM-4` Shipment is owned by `STATE_MACHINE_ARCHITECTURE.md`. Its states and transitions are not restated here** (`DOC-005`, `SYS-016`).

`CREATED` · `BOOKED` · `AWAITING_PICKUP` · `PICKED_UP` · `IN_TRANSIT` · `AT_HUB` · `OUT_FOR_DELIVERY` · `DELIVERY_ATTEMPTED` · `DELIVERED` · `RETURNING` · `RETURNED_TO_WAREHOUSE` · `LOST` · `DAMAGED` · `CANCELLED`

**Meanings in `OM §9.4`; the ratified diagram is `OM §9.5`.**

> **DLV-025 — `SM-4`'s authority is External — the courier is system of record for tracking and outcome** (`SM-4`, `SYS-010`).

> **DLV-026 — `DELIVERY_ATTEMPTED` is a recoverable state, not terminal** (`SMA §8.8`). §9 describes what exits it.

## 7.1 The `LOST` entry condition — `BD-218`

> **DLV-027 — A shipment becomes `LOST` only when the courier officially confirms it cannot be delivered and cannot be recovered. There is no elapsed-time threshold** (`BD-218`).

> **DLV-028 — A shipment that has stopped moving is treated as *delayed* until the courier completes its own investigation** (`BD-218`). **No fixed business rule such as 7 or 15 days exists**, and none is invented here.

> **DLV-029 — The absence of a `LOST` threshold is a stated business fact, not a gap** (`BD-218`, `SMA-037` pattern).

**`SMA-037` established this shape for `SM-14` Marketplace Claim** — *"no time expectation, and no transition may be triggered by elapsed time… the first machine where the absence of a threshold is a stated business fact rather than a gap."* **`BD-218` is the second instance**, and `SM-4`'s `LOST` entry is therefore **externally triggered**, consistent with its declared External authority.

> **DLV-030 — On a marketplace order the seller does not independently classify a shipment as `LOST`; the business follows the final status provided by the marketplace** (`BD-218`, `SYS-010`). An uncollected pickup-point or Digibox parcel *"is handled according to Daraz's own logistics process."*

---

# 8. Tracking

> **DLV-031 — Tracking events arrive by three mechanisms, and all three are supported permanently** (`OM §9.6`, `BD-075`): **push · pull · manual**.

> **DLV-032 — Manual shipment update is a permanent first-class capability, never a temporary workaround** (`BR-029`, `INV-38.3`). *"Any carrier without integration must still be fully usable."*

**All three are in live use today** (`BD-075`): the **Steadfast API** is primary, with manual portal checks and direct courier contact where API data is unavailable or verification is required.

> **DLV-033 — Every tracking event records its source — push, pull, or manual with the recording actor** (`BR-030`, `INV-38.2`). **Manual entries carry different evidential weight from carrier-reported events**, and provenance matters in disputes.

> **DLV-034 — Tracking history is append-only. A correction is a new superseding event, with both retained** (`BR-031`, `INV-38.1`, `EVA-012`).

> **DLV-035 — Every tracking event distinguishes event time from record time** (`BR-030`, `EVA-006`, `DB-017`). A courier event occurred at one moment and was received at another; both are retained.

> **DLV-036 — Out-of-sequence tracking events are recorded as exceptions rather than forced** (`OM §9.7`, `EVA-017`, `API-028`). An event whose transition is illegal for the current state is **retained as evidence and raised for resolution.**

> **DLV-037 — `E-038` Tracking Event retains the raw courier status as received** (`E-038`, `SYS-046`, `API-030`, `AUD-009`). *When a courier disputes a delivery, the defensible position is the original message.*

## 8.1 Tracking source varies by fulfilment path

> **DLV-038 — The party supplying tracking varies by path; the model does not** (`BD-059`, `BD-319`, `BR-077`).

| Path | Tracking supplied by |
|---|---|
| Daraz order, Daraz logistics | **Daraz** |
| Website / Facebook order, own courier | **Steadfast** (`BD-067`) |
| **Own delivery** | **None** (`BR-077`) |

**All of it is mirrored data** (`SYS-010`, `SYS-011`), never locally authoritative.

## 8.2 Visibility is capability-dependent

> **DLV-039 — The ERP cannot act faster than it learns** (`SYS-100`, `API-020`, `BD-216`). **Where no tracking update is received, the business may only become aware of a failure when the courier reports the return.**

---

# 9. Failed Delivery

> **DLV-040 — Trioloo performs active customer recovery whenever a failed attempt is visible; it does not simply wait for the parcel** (`BD-216`).

> **DLV-041 — Recovery is customer communication and decision-making. The courier remains the operational authority for physical delivery attempts** (`BD-216`, `BD-072`).

**The number of attempts is governed entirely by the courier's policy** (`BD-072`), and the ERP records the return **only after the courier confirms** that delivery failed and the return process started.

## 9.1 The recovery workflow, as confirmed

> **DLV-042 — On a visible failed attempt, responsible sales or customer-support staff contact the customer to determine the reason, confirm the address, verify availability, and where possible arrange another attempt** (`BD-216`).

> **DLV-043 — Where the issue is resolvable, the updated information is communicated to the courier and delivery continues under the courier's operational process** (`BD-216`).

> **DLV-044 — Where the customer cancels or the issue cannot be resolved, no further intervention is made and the parcel follows the courier's normal RTO process** (`BD-216`).

> **DLV-045 — Where the failure is not visible, intervention may not occur at all before the return** (`BD-216`, `DLV-039`). **This is a stated operational consequence, not a deficiency to be designed around.**

## 9.2 Failure causes

> **DLV-046 — Every failed delivery records a cause from a controlled vocabulary** (`BR-032`, `SYS-043`). **Seven causes are confirmed** (`BD-073`, closing `GAP-032`): customer does not answer calls · customer refuses the order · customer requests cancellation before delivery · address incorrect, incomplete or not locatable · customer unavailable at the location · customer requests a later delivery that cannot be completed · courier unable to complete due to operational or service-area limitations.

⚠ **`OM §10.4` additionally names *"customer cannot pay the COD amount"*, which `BD-073` did not.** It may be folded into *refuses to accept*, or may genuinely not occur. **Queued as `BD-217`, unasked and unanswered** (`BD-073`).

> **DLV-047 — A disputed delivery never auto-closes; it remains open until resolved by a human decision recorded with its reasoning** (`BR-034`).

⚠ **Whether the recovery *outcome* is captured against the order is not stated** — queued as `BD-422`.

⚠ **No threshold states how long recovery is attempted before the parcel is left to RTO** (`GAP-024`).

---

# 10. Return to Origin

> **DLV-048 — A failed delivery starts the courier's return process, and the goods return to the business** (`BD-071`, `BD-072`). **Typically 4–7 days, sometimes up to one month** (`BD-071`) — recorded as observed practice, **not as a threshold**.

> **DLV-049 — Returned goods are inspected on receipt and are never automatically restocked on arrival** (`BR-046`, `BR-100`, `BD-071`).

> **DLV-050 — RTO and customer returns are distinguished throughout** (`BR-044`). **`BR-117` makes the distinction automatic rather than enforced:** goods never delivered created no revenue and no receivable, so **a failed delivery cannot leave a phantom receivable behind** (`PAY-017`, `ACC-013`).

## 10.1 Boundaries — what Delivery does not own here

> **DLV-051 — Delivery owns the shipment outcome; it owns nothing about the goods once they are back** (`DOC-005`).

| Beyond the return | Owner |
|---|---|
| Physical receipt, inspection execution, QC | **`WAREHOUSE_ARCHITECTURE.md`** (`WHS-019` – `WHS-025`) |
| QC Pending as a not-sellable condition, dispositions, movements | **`INVENTORY_ARCHITECTURE.md`** (`IVN-012`, `IVN-024` – `IVN-026`) |
| Partial and Full Scrap, recovery through inspection | **`WHS-062` – `WHS-064`**, `IVN-`, `ICO-026` |
| Return and exchange lifecycles, refund entitlement | **`RETURN_EXCHANGE_ARCHITECTURE.md`** |
| Any posting arising | **`ACCOUNTING_ARCHITECTURE.md`** |

⚠ **"RTS" carries two meanings in the business's own vocabulary** — **Ready To Ship** (`BD-033`, `BD-039`, `BD-041`) and **Return to Seller** (`BD-071`) — *"opposite ends of the order lifecycle."* **The architecture uses `RTO` (Return to Origin) for the second.** `BD-214` asks how staff tell them apart today and **remains unasked**; **no state is renamed** (`OM`, `GAP-026`).

---

# 11. Courier Commercial Model

**Consolidated from §28. Rate values themselves are configuration** (`SYS-013`, `SYS §17`) and appear nowhere in this document.

## 11.1 Rate structure

> **DLV-052 — The courier delivery charge is not a single fixed amount. Five factors are confirmed** (`BD-405`): **delivery destination or courier-defined zone · parcel weight · parcel size or volumetric weight · courier service type · product category or special-handling requirements.**

> **DLV-053 — The declared value of the goods does not directly determine the delivery charge** (`BD-405`).

⚠ **`E-036` carries a *declared-value limit*.** That is a **limit**, not a pricing input — the two are distinct and `BD-405` settles only the pricing question.

> **DLV-054 — Courier rate structure is versioned. Historical shipments retain the rate version effective when the shipment was created; future rate changes apply only to new shipments** (`BD-405`, `SYS-021`, `DB-022`).

**`SYS-021` names *"courier tariff"* as its own worked example.** The business stated the rule back unprompted.

## 11.2 The confirmed charge types

> **DLV-055 — Courier cost is a set of typed charge lines, not a single figure. Each charge is stored as a separate expense line with its own type and amount** (`BD-414`).

| Charge type | Confirmed by |
|---|---|
| **Outbound Delivery Charge** | `BD-405`, `BD-414` |
| **Return (RTO) Charge** | `BD-414` |
| **COD Charge** | `BD-406`, `BD-414` |
| **Other Courier Charges** | `BD-414` — explicitly open-ended |

> **DLV-056 — The charge-type vocabulary is versioned configuration; values may be added and existing values are never repurposed** (`SYS-043`, `SYS-021`).

> **DLV-057 — If a particular charge does not exist for a shipment, no expense is created for that charge** (`BD-414`).

**The business chose the stronger form of `DB-005`: absence, not a zero.** That is `DB-001` in its purest form — *the movement is the record; no movement, no entry.*

## 11.3 COD charge

> **DLV-058 — The COD charge is a separate courier charge with a different pricing basis from the delivery charge, determined by the courier's own policy** (`BD-406`).

**It may be a percentage of the amount collected, a fixed charge per shipment, or another method the courier defines** (`BD-406`). **Where it is priced on the collected amount, it changes with order value; where fixed, it does not.**

> **DLV-059 — Value prices the COD charge but not the delivery charge, which is why the two can never be one field** (`BD-405`, `BD-406`).

## 11.4 Charges on a failed delivery

> **DLV-060 — The outbound attempt may still be chargeable even where the parcel was not delivered, and the return leg may carry a separate charge, both according to the courier's policy** (`BD-414`).

> **DLV-061 — Because no COD amount is collected, there is normally no COD collection charge on a failed delivery; where the courier applies a failed-COD fee, the actual amount reported is recorded rather than assumed** (`BD-414`).

⚠ **A failed delivery is therefore expense without revenue.** `BR-117` establishes no receivable arises. **This lands on the population `GAP_ANALYSIS.md` carries as `BD-305`'s dispatched-but-undelivered cost position** — *"goods out of stock but not yet COGS, with no established home."* **Carried, not resolved** — §27.

---

# 12. Estimated versus Actual Courier Cost

> **DLV-062 — Two values are recorded independently: Estimated Courier Cost and Actual Courier Cost** (`BD-405`, `SYS-055`).

> **DLV-063 — The actual courier cost, when supplied by the courier through its API, courier panel, invoice or settlement statement, is authoritative** (`BD-405`, `BD-413`).

**Four capture routes, one fact** — under `SYS-107` and `API-027` the **capture method is an attribute of the record, never an identity of the event.**

> **DLV-064 — The original estimate is never overwritten or deleted** (`BD-405`, `BD-413`, `DB-002`, `DB-003`, `DB-077`).

> **DLV-065 — The estimate never becomes authoritative automatically. Where an actual never arrives, the shipment remains provisional until the actual is received or the issue is manually resolved** (`BD-413`).

> **DLV-066 — The ERP never silently treats an estimate as the final business cost** (`BD-413`).

> **DLV-067 — Operational planning may use the estimate; profitability, accounting and reporting use the Actual Courier Cost once available** (`BD-405`).

> **DLV-068 — Reports distinguish Estimated from Actual, and any report including an estimate states that the figures are provisional** (`BD-413`, `RPT-006`).

**`RPT-006` was consolidated from `SYS-089` and `GAP-082`; `BD-413` confirmed it independently for a different figure**, widening it from a period-completeness rule to a general provisional-figure rule.

> **DLV-069 — Staff must be able to identify shipments still missing an Actual Courier Cost, and a periodic review surface lists them** (`BD-413`).

⚠ **This is a report requirement outside `SYS-087`'s confirmed eleven** — recorded against `RPT-008` and `RPT-035`, **not added to the register**, which is `SYS-087`'s to amend.

⚠ **A pending actual has no time bound** — queued as `BD-416`, and an instance of `GAP-024`.

⚠ **Whether *"Pending Actual Courier Cost"* is a state or an overlay is carried unresolved** — §26.

---

# 13. Customer Delivery Charge

> **DLV-070 — The Customer Delivery Charge and the Actual Courier Charge are two completely separate business values and are not required to be equal** (`BD-190`).

| | Determined by |
|---|---|
| **Customer Delivery Charge** | **Trioloo's pricing policy** — location, campaign, product category, channel, promotional offers (`BD-190`) |
| **Actual Courier Charge** | **The courier alone**, authoritative on receipt (`BD-190`, `DLV-063`) |

> **DLV-071 — The business may intentionally charge more, less, or exactly the same as the courier charge, depending on business policy** (`BD-190`).

> **DLV-072 — Delivery is charged separately from the product price** (`BD-048`), and on a direct-channel order **the customer pays a single invoice total of Product Amount + Delivery Charge**, with the delivery charge a **separate line item, never merged into the product price** (`BD-417`).

> **DLV-073 — Product Value and Delivery Charge are retained as two separate financial values** (`BD-417`).

> **DLV-074 — Historical orders always retain the Delivery Charge originally charged to the customer, even if courier pricing changes later** (`BD-190`, `DB-023`, `SYS-017`).

## 13.1 When delivery is not charged

> **DLV-075 — Delivery Charge is optional and depends on Trioloo's selling policy for that order. Three situations are confirmed** (`BD-191`): **Self Pickup · a Free Delivery Campaign or Promotional Offer · a staff waiver as a customer-service or sales decision.**

> **DLV-076 — A free delivery does not mean the courier delivered for free** (`BD-191`). The Customer Delivery Charge may be **zero** while the Actual Courier Charge is greater than zero, **both must still be recorded separately**, and **the absence of a customer charge never removes or modifies the actual courier expense.**

> **DLV-077 — Free delivery is a deliberate recorded zero; Self Pickup is an absence** (`BD-191`, `DB-005`, `SYS-034`).

| Situation | Customer charge | Courier charge | Delivery Profit/Loss |
|---|---|---|---|
| **Charged** | Value | Value | Income or subsidy |
| **Free delivery** | **Zero — deliberate and recorded** | **Exists** | **Delivery Subsidy, and it must still appear in reporting** |
| **Self Pickup** | **None** | **None** | **Not applicable — no delivery service occurred** |

**This is `DB-005` and `SYS-034` drawn by the business itself**, and the same discipline as `BD-286`: *a chosen zero is a decision, a missing value is an omission.*

⚠ **A staff waiver is a discretionary financial decision with no confirmed capture requirements** — queued as `BD-418`. **`BD-275` required six recorded values for a discount including reason, applier and approver; whether a delivery waiver carries the same is not stated.**

---

# 14. Delivery Profit/Loss

> **DLV-078 — Delivery Profit/Loss = Customer Delivery Charge − Actual Courier Charge** (`BD-190`, `BD-417`), producing **Delivery Income** where positive and **Delivery Subsidy** where negative.

> **DLV-079 — Delivery Profit/Loss is a derived management metric only. It must never create an accounting posting and must never become an additional Net Profit component** (`BD-417`).

> **DLV-080 — `SYS-088` stands unamended** (`BD-417`). Net Profit already contains both values: **the Customer Delivery Charge as business income inside Sales Revenue, and the Actual Courier Charge as expense inside Courier Charges.**

**`BD-190` raised this as a conflict against `SYS-088` and `BD-417` resolved it** — registered at `DOC-050` entry 5. **Assuming the alternative reading would have amended a correct rule and introduced a double-counted component.**

> **DLV-081 — The formula applies to direct-channel orders only. Marketplace orders follow the marketplace settlement model and do not use it** (`BD-417`).

> **DLV-082 — Free-delivery orders still appear in Delivery Profit/Loss reporting, as a subsidy equal to the whole courier charge; Self Pickup does not appear, because no delivery service occurred** (`BD-191`).

> **DLV-083 — Delivery Profit/Loss is presented by `REPORTING_ARCHITECTURE.md` and owned as a figure by no one but its components' owners** (`DB-067`, `RPT-001`, `RPT-039`). It is a subtraction over two figures Accounting already owns.

⚠ **The visibility dimensions the business named — by channel, courier, area/location, time period, and for subsidy additionally by campaign — are report requirements outside `SYS-087`'s eleven.** Recorded against `RPT-008`; **not registered here.**

⚠ **"Delivery Subsidy by Campaign" depends on campaign identity that does not exist** — `GAP-015` records pricing and promotional policy as undocumented, and `DOMAIN_MODEL.md` has no Campaign entity. **Carried, not invented.**

---

# 15. Marketplace Delivery Boundary

> **DLV-084 — On a Daraz order, Steadfast does not charge the business directly, because the shipment is handled by Daraz Logistics or the provider Daraz assigns** (`BD-408`).

> **DLV-085 — Daraz orders create no direct Steadfast courier expense for the shipment** (`BD-408`). **`DLV-062`'s Estimated/Actual model is therefore a direct-channel construct.**

> **DLV-086 — Any shipping or logistics deduction made by the marketplace is recorded exactly as it appears in the marketplace settlement, and is treated as `Marketplace Charges` rather than `Courier Charges`** (`BD-408`).

**The business's stated reason:** such deductions *"are part of the marketplace settlement and are deducted by the marketplace, not paid directly to an external courier by the business."*

> **DLV-087 — The ERP does not split or reinterpret marketplace deductions unless the marketplace explicitly itemizes them, and never assumes or reclassifies them** (`BD-408`, `SYS-010`, `ACC-020`, `PAY-026`).

> **DLV-088 — Where the marketplace provides a detailed breakdown, each deduction is recorded separately according to its official settlement statement** (`BD-408`, `ACC-019`, `BR-124`). **The level of detail is bounded by what the channel supplies** (`API-012` dimension 5, `BD-323`).

> **DLV-089 — The settlement statement is authoritative financial evidence, not a posting source** (`BR-121`, `ACC-004`). **The business used the word *evidence* unprompted** (`BD-408`).

**Consequence:** `SYS-088`'s **`Marketplace Charges`** and **`Courier Charges`** are **channel-partitioned and non-overlapping**, rather than potentially double-counting one delivery (`BD-408`).

⚠ **`GAP-081` and `GAP-084` are carried unchanged.** `BD-408` ruled on a **fee**; `GAP-081`'s objection is that *a refund is not a fee for a service*. **The principle is not extended here.**

---

# 16. COD Collection

> **DLV-090 — Approximately 100% of customer orders are Cash on Delivery** (`BD-058`). **On essentially every order the money is collected by someone other than Trioloo and reaches Trioloo later.**

> **DLV-091 — Three collection paths are confirmed, and they must not be conflated** (`BD-059`, `BD-068`, `BD-211`).

> **DLV-130 — The COD amount sent to a collector is the outstanding cash receivable, never the Order Total** (`BD-433`, `PAY-064`). Where Trade-In Credit has been applied, **the instruction carries the already-reduced figure** — ৳20,000 against a ৳30,000 order with ৳10,000 of credit applied.
>
> **The receivable itself is created gross** (`PAY-015`, `PAY-064`) and the credit clears part of it as a non-cash component. **Delivery never sees the gross figure** — it receives only what must actually be collected in cash.

> **DLV-131 — A collector never applies Trade-In Credit** (`BD-433`, `PAY-066`). **The courier receives one figure and collects it**, and **the credit is applied before dispatch** so that figure is correct when the shipment is created.

**This keeps a non-cash instrument off the parcel.** At ~100% COD (`DLV-090`) the alternative — sending the gross amount and reconciling a credit at the doorstep — would put a financial decision in a courier's hands.

| Path | Collector | Reaches the business by |
|---|---|---|
| **Courier-collected COD** | Steadfast | **Courier remittance** (`E-042`) |
| **Marketplace collection** | Daraz Logistics or its courier | **Marketplace settlement** (`E-043`) |
| **Own-staff COD** | **Trioloo's own delivery person** | **Direct handover to the office** (`BD-211`) |

> **DLV-092 — Settlement may be received by bank transfer or by cash withdrawal where the courier supports it** (`BD-060`).

> **DLV-093 — Collection is not settlement, on every path** (`BR-035`, `PAY-001`, `INV-40.1`). **Money held by a courier — or by a Trioloo employee — is not money received.**

**Reconciliation, ageing, variance and dispute are owned by `PAYMENT_ARCHITECTURE.md`** (`PAY-000`, `PAY §7`, `PAY §8`). **This document states only the collection fact.**

---

# 17. Own-Staff COD Custody

> **DLV-094 — On an own-staff delivery, the same delivery person who hands over the order also collects the cash** (`BD-211`).

> **DLV-095 — Cash is normally submitted to the office the same day after completing deliveries, or the next working day where that is not possible. It is not intended to stay with staff longer than operational necessity** (`BD-211`).

⚠ **`OM §11.2`'s `COD_OWN_DELIVERY` lag column reads *"Same day"*.** That column carries **indicative magnitudes rather than ratified constraints**, so `BD-211` **refines it rather than contradicting it.** ⚠ **No threshold exists for when late becomes an exception** (`GAP-024`).

> **DLV-096 — Delivery completion and cash receipt are two separate business events, and the business requires the separation preserved permanently** (`BD-211`).

| Event | Complete when |
|---|---|
| **Delivery** | The customer successfully receives the order |
| **Payment** | The collected cash is **handed over to the business and Accounts records the receipt** |

**`BR-035` was written about intermediaries. The business extended it to its own employee** — cash in a Trioloo staff member's hand is **not** received money. `PAY-001` holds without exception, on all three paths.

## 17.1 ⚠ The custody exposure, carried exactly as discovered

> **DLV-097 — While the staff member is carrying the cash there is currently no separate custody record. The money is considered "in transit" operationally and becomes officially received only on handover and recording by Accounts** (`BD-211`).

**This is business money in a named individual's personal possession, with nothing recording it.** **The business stated it plainly rather than describing a control that does not exist**, and **no control is invented here** (`DOC-023`, `DM-001`).

⚠ **`GAP-071` is substantially answered — the third settlement path is now described end to end. Formal closure remains `GAP_ANALYSIS.md`'s decision.**

⚠ **Two reconciliation points are carried** — the Funds-In-Transit parallel and the `COLLECTED_BY_INTERMEDIARY` scope question. See §26.

⚠ **How the business would notice cash not handed in is queued as `BD-419`, unanswered.**

---

# 18. Self Pickup

> **DLV-098 — Self Pickup creates no shipment, no courier charge and no customer delivery charge** (`BD-191`, `INV-37.5`, `SMA-013`).

> **DLV-099 — Self-collection is available once the order has been verified and is ready for handover** (`BD-069`).

> **DLV-100 — The order is verified at handover primarily on the customer's registered phone number and the order or invoice information; the invoice or order confirmation may also be used** (`BD-212`).

**`BD-023` established the registered phone number as the customer lookup key; `BD-212` confirms it as the verification key.** One identifier, two roles.

> **DLV-101 — Formal photo ID verification is not part of the normal business process** (`BD-212`).

> **DLV-102 — At handover the order is marked Collected and the customer signs the invoice or delivery copy as proof of receipt. No photo evidence is required as a standard process** (`BD-212`). **UNCHANGED.**
>
> ✅ **Scope confirmed 2026-08-09 (`BD-444`) — this rule governs *self-pickup*, and always did.** It sits in §18 and its `Collected` is `SM-3`'s self-pickup terminal (`DLV-098`, `SMA-013`). **`BD-444` chooses the *delivery copy* within the permission this rule already granted**, so **the permission set is unchanged and this is not an amendment** (`DOC-068`). See `DLV-134`.

> **DLV-103 — The signed handover is sufficient operational evidence of successful collection** (`BD-212`).

> **DLV-104 — Collection by someone other than the customer is permitted where the representative provides correct order information and the business is satisfied they are collecting on the customer's behalf. The ERP does not require the person collecting to be the same individual recorded as the customer** (`BD-212`).

**This fits `CP-8` rather than breaking it.** `BD-402` states the mechanism: *the system enforces where identity is deterministic and defers where it must infer.* **Identity at a counter is inferred** — the staff member can see the person; the system can see a phone number.

✅ **RESOLVED 2026-08-09 — `BD-445` closes `BD-420`.** **The ERP records that the acknowledgement was obtained, and that record is authoritative; the scan is optional supporting evidence.** See **§18B**.

> *Original note, retained whole under `DOC-009`:* ⚠ *“Whether the signed copy is captured into the ERP is not stated — queued as `BD-420`. `AUD-021` requires a coherent evidence package for any disputed subject, and `E-054` Attachment exists; **a paper signature is in neither**.”* — **`AUD-021` is now satisfied without amendment**: `AUD-012`'s actor, action, subject and time are all present on the acknowledgement record, and a scan joins the package when one was taken.
>
> ⚠ **This note was split in two by the §18A insertion earlier today and is restored whole here.** The trailing half had been left stranded at the end of §18A. **No rule was affected.**


---

# 18A. Delivery evidence by path — 2026-08-09

**Source:** `BD-444`, answering `BD-136`. **Post-Freeze amendment under `DOC-067`** — a recorded business decision authorises it. **`DLV-102` is unchanged.**

> **DLV-132 — On a courier delivery the courier's own delivery/consignment record is the delivery evidence. Trioloo requires no customer signature on a Trioloo document, and no Delivery Challan is created to duplicate courier proof** (`BD-444`).

✅ **This fills a silence rather than replacing a rule.** **No statement anywhere in the frozen corpus said what a customer signs on a courier delivery.** It is consistent with `E-037`'s existing **proof of delivery** attribute, with `INV-54.1` — **external data retained exactly as received** — and with `DLV-063`, which already makes the courier authoritative for what it reports.

> **DLV-133 — On an own-staff delivery a Delivery Challan may be issued and signed where physical handover acknowledgement is required. It is conditional, not mandatory** (`BD-444`).

⚠ **The Sales Invoice does not become the delivery-proof document merely because the same staff member also collects the cash.** **`DLV-094`** puts handover and collection in one person's hands and **`DLV-096`** keeps the two events permanently separate — **`DLV-133` keeps their *documents* separate for the same reason.**

> **DLV-134 — On self-pickup the acknowledgement belongs to the physical collection fact and may be taken on the Delivery Challan rather than the Sales Invoice** (`BD-444`, `DLV-102` unchanged).

> **DLV-135 — “Delivery Challan” and “Delivery Copy” are one document identity in V1** (`BD-444`). **`BD-006B` names the first and `BD-212` the second; no canonical evidence distinguishes them**, and the business set that exact condition.

> **DLV-136 — The Sales Invoice is the commercial sale document and is never required to serve as delivery proof on any path** (`BD-444`, `E-039`).

| Path | Delivery evidence | Trioloo document |
|---|---|---|
| **Courier** (`DLV-013` Steadfast primary) | **The courier's own record** | **None required** |
| **Own-staff** (`DLV-094`) | **A signed Delivery Challan, where acknowledgement is required** | **Conditional** |
| **Self-pickup** (`DLV-098` — no shipment) | **Acknowledgement at collection** (`DLV-102`, `DLV-103`) | **Delivery Challan, or the invoice as `DLV-102` already permits** |

> ⚠ **Nothing here mandates printing, prescribes a signature on a courier delivery, defines courier API behaviour, or creates numbering, sequences, copies, retention, fields or layouts.** All were **explicitly prohibited** by `BD-444`. **Which module *owns* the Delivery Challan as a document is not assigned here** — that belongs to Document / Printable Architecture, which is in discovery and not yet written.

⚠ **Physical handover execution is `WAREHOUSE_ARCHITECTURE.md`'s** (`WHS §9`). *"Warehouse staff may assist in physically bringing out the products, but the release decision belongs to the sales side"* (`BD-212`).

---

# 18A. Warranty & Repair Handback

**Added 2026-08-09** from `BUSINESS_DISCOVERY.md` §31 (`BD-429`), propagating the ratified consumer contract of **`EVT-095 Warranty.ReadyForHandback`**.

> **DLV-112 — A repaired or replacement unit returning to a customer moves through the normal Delivery/Courier process** (`BD-429`). **A courier shipment is created in the same controlled way as any other direct-channel shipment**, receives the available tracking or consignment information, and its status is tracked through the normal Delivery lifecycle.

> **DLV-113 — The shipment remains linked to the Warranty/Repair Case** (`BD-429`), so staff can see how the unit was returned to the customer. **Warranty & Repair owns *why* the unit is going back; Delivery owns *how* it moves** (`WAR-064`, `TRD-000` pattern).

> **DLV-114 — A warranty handback is not a sale and creates no new product sales revenue** (`BD-429`). **No order, no order line and no sales receivable arises from it.**

## 18A.1 COD on a handback

> **DLV-115 — A normal warranty handback carries no COD amount for the product** (`BD-429`).

> **DLV-116 — An authorised chargeable-repair amount, or another current confirmed amount, may be attached to the handback shipment for collection** (`BD-429`). **Any amount collected must relate only to the current confirmed charge, never to the original product sale.**

> **DLV-117 — The original order's COD is never recreated on a handback** (`BD-429`). **That obligation completed its own lifecycle**, and reproducing it would charge the customer twice for one product. ⚠ **At ~100% COD (`BD-058`) this is the error most likely to arise by pattern-matching**, which is why the business stated it as a prohibition.

⚠ **The obligation behind a chargeable-repair amount has no Payment contract.** `PAY-013` scopes `E-040` Receivable to **one order**, and `PAY-014` ties payment obligation to **delivered goods** — **neither describes a repair service charge.** Carried open at `EVENT_ARCHITECTURE.md` §20.3; **no receivable, collection mode or payment mechanism is invented here.**

## 18A.2 Courier cost is independent of COD

> **DLV-118 — Zero COD does not imply zero courier cost** (`BD-429`). The courier may charge Trioloo for transporting the unit **even where the customer owes nothing.**

> **DLV-119 — Who bears that transport cost follows the cost-responsibility decision already recorded on the warranty case** (`BD-429`, `BD-336`, `WAR-051`). **Delivery does not decide it and no new decision is created.**

⚠ **The accounting treatment of handback courier cost is unresolved and is not settled here.** `BD-413`'s label-versus-accrue treatment was confirmed for **sales** shipments; **whether it applies identically to a handback is stated by no source.** Carried open.

## 18A.3 Failed handback

> **DLV-120 — A failed handback follows the normal failed-delivery and return-to-origin process** (`BD-429`, `SM-4`). **No separate warranty failure path exists.**

> **DLV-121 — Dispatch is not handover.** A Warranty/Repair Case **must not be treated as successfully handed back merely because the unit was dispatched** (`BD-429`). **The same discipline as `BR-025`**, which requires every shipment delivered before an order is `DELIVERED`.

> **DLV-122 — A returned undelivered unit re-enters Trioloo's custody and the case remains unresolved for customer handback** (`BD-429`). **Another attempt is arranged through the applicable process rather than creating a new sale.** The custody state is the case's, not Delivery's (`WHS-069`, `WAR-060`).

## 18A.4 Self-pickup handback

> **DLV-123 — A self-pickup handback creates no courier shipment** (`BD-429`, `DLV-098`, `SMA-013`). The customer or authorised collector receives the unit through the applicable handover process, and **the collection is recorded against the Warranty/Repair Case.**

**`SMA-013`'s rule reappearing in a second domain** — the method determines whether a shipment exists at all.

---

# 18B. Declined Trade-In Return

**Added 2026-08-09** from `BUSINESS_DISCOVERY.md` §32 (`BD-430`).

> **DLV-124 — A declined trade-in returns by one of two methods, and only one involves Delivery** (`BD-430`, `TRD-076`).

| Method | Delivery |
|---|---|
| **`CUSTOMER_PICKUP`** | **No shipment, no courier workflow.** The customer collects |
| **`COURIER_RETURN`** | The item returns through the **normal courier/delivery process** |

> **DLV-125 — A declined trade-in must never be taken to imply that a courier shipment exists** (`BD-430`, `TRD-077`). **The return method is determined separately from the decline**, and Delivery is involved only where `COURIER_RETURN` is chosen.
>
> **Delivery acts on `EVT-100 TradeIn.CourierReturnRequired`**, whose occurrence point is **the method determination, never `DECLINED`**. **A `CUSTOMER_PICKUP` return publishes nothing.** Delivery then runs its own lifecycle, `EVT-031` – `EVT-038`.

> **DLV-126 — The item remains customer property throughout the return; the movement transfers no ownership and creates no inventory** (`BD-430`, `INV-81.1`, `INV-81.4`, `SYS-103`). **It is a custody-out movement, never a sales return** (`TRD-052`).

> **DLV-127 — Who bears the return shipping cost is recorded on the Trade-In Case, not decided by Delivery** (`BD-395`, `BD-430`, `TRD-053`, `TRD-080`). **The customary bearer is the customer; the business may bear or waive it.** ⚠ **The outcome set is an open `DOC-050` conflict** — `BD-395` names four outcomes including a split, `BD-430` names two. **Delivery adopts neither and decides nothing.**

## 18B.1 A failed trade-in return

> **DLV-128 — A failed trade-in courier return follows the normal failed-delivery and return-to-origin process** (`SM-4`, `EVT-036`). **No trade-in-specific failure path exists and none is created.**

> **DLV-129 — A parcel returning to Trioloo puts the item back in Trioloo's custody, and the Trade-In Case remains unresolved for return** (`INV-81.4`, `TRD-079`, `BD-396`). **The item never stopped being customer property**, so its arrival is a **custody fact and never an inventory one** — `SYS-103` is absolute.

**`BD-396` already models what follows**: a customer who *“does not collect or accept return”* leaves the case at `RETURN_IN_PROGRESS` or moves it to `UNCLAIMED_PROPERTY`, and **`SMA-070`'s `UNCLAIMED_PROPERTY → RETURN_IN_PROGRESS` already permits a further attempt.** **Nothing here is new behaviour** — it is Delivery's existing lifecycle meeting Trade-In's existing custody rules.

**Third instance of `SMA-013` in this document** — self pickup on a sale (`DLV-098`), self-pickup on a warranty handback (`DLV-123`), and now customer pickup on a declined trade-in. **The method determines whether a shipment exists at all.**



---

# 18B. Handover acknowledgement — 2026-08-09

**Source:** `BD-445`, answering `BD-420`. **Post-Freeze amendment under `DOC-067`.**

> **DLV-137 — Where a Delivery Challan is signed, the ERP records that the handover acknowledgement was obtained. The physical paper may be retained operationally and need not be digitised** (`BD-445`).

> **DLV-138 — The acknowledgement is linked to the Order and to its delivery or pickup record, and carries the responsible staff/actor and the handover date and time** (`BD-445`, `AUD-012`).

> **DLV-139 — The acknowledgement is recorded where the path already provides for it** (`BD-445`):

| Path | Where the acknowledgement lives |
|---|---|
| **Own-staff delivery** | **`E-037` Shipment's existing *proof of delivery* attribute** — **no model change was needed** |
| **Self-pickup** | **`E-035` Pick Task** — **`INV-37.5` gives a `SELF_PICKUP` order no shipment at all**, so `E-035` gained the minimum support (`INV-35.4`). It is the `SM-3` subject carrying the **`COLLECTED`** terminal |
| **Courier** | **Not applicable** — `DLV-132`: the courier's own record is the evidence |

> **DLV-140 — A scan or photo of the signed Challan may optionally attach via `E-054`, whose type list already includes *proof of delivery*. It is supporting evidence, never a prerequisite** (`BD-445`, `INV-54.1`).

> **DLV-141 — The absence of a scanned copy never blocks delivery completion, pickup completion or Order closure** (`BD-445`, `CP-8`, `BR-010`).

✅ **Nothing had to be un-built.** **No rule ever made an attachment a precondition**, so `DLV-141` **forecloses a gate rather than removing one** — the same posture as `PRD-140`, `IVN-053` and `WAR-004`: **evidence helps where it exists and never refuses where it does not.**

⚠ **No document-management workflow, scanning state machine, mandatory upload, OCR, approval process or new attachment entity is created** — each was **explicitly prohibited** by `BD-445`. **No layout, field list, numbering or retention period is defined here.**


---

# 19. Courier Claims

> **DLV-105 — Where damage or missing items are confirmed on a returned parcel, the business submits a claim to the courier with the required supporting information** (`BD-074`).

> **DLV-106 — Where a shipment is confirmed `LOST`, a formal claim is submitted according to the courier's claim procedure** (`BD-218`).

> **DLV-107 — Component-level checking is live practice — the business inspects returns for missing components, not merely whether the box came back** (`BD-074`). **This is the checking `BR-047` and `PRD-036` were written for.**

> **DLV-108 — Every inventory loss carries an attribution, and a claim against the courier is that attribution** (`BR-055`, `BD-074`). **It is what makes the loss recoverable rather than absorbed.**

> **DLV-109 — A claim outcome does not automatically rewrite inventory or accounting records** (`BD-218`, `ICO-025`, `BR-131`). **Accounting treatment, inventory loss recognition and write-off follow only after the business reaches a final outcome through the claim process** (`BD-218`).

**`ICO-025` states the same construction with the supplier in place of the courier:** *the claim result is a fact; the accounting response is a decision.*

> **DLV-110 — A disputed claim must be answerable with an evidence package** (`AUD-021`, `E-054`). Tracking provenance (`DLV-033`), raw courier status (`DLV-037`) and append-only history (`DLV-034`) are what make that possible.

⚠ **Detection of a stalled shipment is not systematic** (`BD-218`): *"the responsible operations staff monitors tracking whenever necessary"*, and *"if the customer contacts the business first, that also triggers an investigation."* **`SYS-023` requires exceptions to be visible, aggregated and aged; a stalled shipment currently has none of the three.** Carried, not solved.

---

# 20. Ownership Boundaries — Consolidated

| Delivery supplies | The module owns |
|---|---|
| **Order Management** — the delivery outcome that drives order state (`BR-025`) | Order lifecycle, release, amendment window, closure |
| **Payment** — the collection fact and the courier's remittance behaviour | **Receivable lifecycle, remittance and settlement reconciliation, variance, dispute** (`PAY-000`) |
| **Accounting** — courier charge facts and the delivery-charge fact | **Every posting** (`ACC-011`), recognition, expense categories |
| **Inventory** — the shipment outcome behind a movement | **Quantity, movements, not-sellable conditions, dispositions** (`IVN-000`) |
| **Warehouse** — nothing; it hands over to the carrier | **Picking, packing, dispatch preparation, QC, physical handover** (`WHS-000`) |
| **Return & Exchange** — the RTO fact | **Return and exchange lifecycles, refund entitlement** |
| **Reporting** — courier and delivery-charge facts | **Presentation only; no figure** (`DB-067`) |
| **API** — the courier integration surface | **Adapter capability, idempotency, provenance mechanics** |

**Delivery owns no stock figure, no posting, no receivable and no report.**

---

# 21. Notification and Exception Visibility

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.** This module raises these obligations against it:

| Obligation | Category | Source |
|---|---|---|
| **A failed delivery attempt becoming visible** | **Candidate — trigger for the whole recovery workflow** | `BD-216`, `DLV-040` |
| **A shipment pending an Actual Courier Cost** | Action Required | `BD-413`, `DLV-069` |
| **A stalled shipment under courier investigation** | ⚠ **No obligation was requested** | `BD-218`, `DLV-109` |

⚠ **The first is a seventh cross-domain notification requirement**, arriving from a domain not being asked about notification — six accumulated across five domains before `NOTIFICATION_ARCHITECTURE.md` existed (`NOT §21.1`). **Whether it is a notification or a screen is not stated**, so it is recorded as a **candidate obligation rather than asserted.**

⚠ **The asymmetry in the third row is recorded as found:** for pending courier costs the business asked for a review surface; **for stalled shipments it did not.**

> **DLV-111 — Every delivery exception has an owning role and a resolution path** (`SYS-022`). ⚠ **No ageing threshold exists for any of them** (`GAP-024`).

---

# 22. Permission, Scope and Audit

| Requirement | Rule |
|---|---|
| **Every dispatch, tracking entry, recovery decision and handover attributable** | `DLV-007`, `AGV-001`, `AUD-004` |
| **Every tracking event records its source and actor** | `DLV-033`, `BR-030` |
| **Tracking history append-only; corrections supersede** | `DLV-034`, `BR-031` |
| **Raw courier status retained as received** | `DLV-037`, `AUD-009`, `SYS-046` |
| **Failed delivery records a cause from a controlled vocabulary** | `DLV-046`, `BR-032` |
| **A disputed delivery never auto-closes; the human decision is recorded with its reasoning** | `DLV-047`, `BR-034` |
| **Claims answerable with an evidence package** | `DLV-110`, `AUD-021` |
| Delivery records retained permanently | `BD-338`, `SYS-024`, `ACC-012` |

**Scope.** `PRM-064` establishes **Branch**, **Warehouse** and **Sales Channel** as scope dimensions, enforced on read and write (`PRM-009`, `AGV-020`). ⚠ `BD-377` records that **most users currently work across all channels** — the model is designed for growth and deliberately not enforced today (`PRM-051`).

⚠ **`PRMU-8` is carried** — whether `PRM-008`'s magnitude bounds are enforced numbers or follow the *who decides, not how much* pattern (`PRM-052`).

---

# 23. Entity References

| Entity | ID | Role here |
|---|---|---|
| **Courier** | **`E-036`** | The carrier master — coverage, COD capability, rate structure *(versioned)*, remittance terms |
| **Shipment** | **`E-037`** | One physical movement — `SM-4` |
| **Tracking Event** | **`E-038`** | Append-only evidence base for disputes and claims |
| Remittance Batch | `E-042` | **Owned by Payment** — courier COD transfer |
| Marketplace Settlement | `E-043` | **Owned by Payment** |
| Order · Order Item | `E-031` · `E-032` | **Owned by Order Management** |
| Exception | `E-056` | Out-of-sequence events, stalled shipments |
| Attachment | `E-054` | Claim and dispute evidence |

**No entity is defined here.** `DOMAIN_MODEL.md` is canonical (`DOC-005`).

---

# 24. State Machine References

| Machine | Subject | Status |
|---|---|---|
| **`SM-4`** Shipment | `E-037` | **Ratified** — one of the original seven. **External authority** |
| `SM-3` Fulfillment | `E-035` | ✅ **Ratified 2026-08-09** into `OM §18.2` (`BR-142`); owned by Warehouse |
| `SM-1` Order | `E-031` | Observed — `Order:DELIVERED` requires every shipment delivered |
| `SM-5` Payment | `E-040` | Observed — owned by Payment |
| `SM-6` Marketplace Settlement | `E-043` | ✅ **Ratified 2026-08-09** into `OM §18.2` (`BR-142`); owned by Payment |

**No machine is defined or ratified here.** `SM-4`'s `LOST` entry condition is **supplied by `BD-218`, not defined by this document.**

⚠ **`GAP-026` applies** — `CANCELLED`, `DELIVERED` and `RECEIVED` recur across machines; **machine-qualified state naming is required** (`SMA-047`, `DM-002`).

---

# 25. Cross-Domain Integration

| Domain | Interface |
|---|---|
| **Order Management** | Delivery outcome drives `Order:DELIVERED` **or `FAILED_DELIVERY`** — ⚠ **amended 2026-08-09 (`BD-442`): `PARTIALLY_DELIVERED` removed and `BR-025` withdrawn**; RTO distinguished from customer return (`BR-044`) |
| **Payment** | Collection fact on three paths; remittance and settlement behaviour; **reconciliation is Payment's** (`PAY-000`) |
| **Accounting** | Courier charges as expense; delivery charge as income; **all postings are Accounting's** (`ACC-011`) |
| **Inventory** | Stock deducted at dispatch (`BR-054`); returned goods enter QC Pending (`IVN-024`) |
| **Warehouse** | Hands over to the carrier at `SM-3` terminal (`WHS-035`); receives and inspects returns (`WHS §6`) |
| **Return & Exchange** | RTO feeds the return path; **lifecycles and entitlement are `RET-`'s** |
| **Procurement** | None directly |
| **API** | Courier adapter capability, tracking ingestion, idempotency (`API-004`, `API-024`) |
| **Reporting** | Supplies courier and delivery-charge facts; **owns no figure** (`DB-067`) |
| **Notification** | Raises the obligations at §21 |

---

# 26. Reconciliation Points Carried

**Recorded, not solved. Each requires a decision by its owning document.**

| # | Point | Owning document |
|---|---|---|
| 1 | **"Pending Actual Courier Cost" — state or overlay?** `SM-4` tracks physical custody, and cost completeness is not custody. The ratified pattern (`ACC-031`, `SMA-071`, `IVN-013`, `ACC-034`) says **overlay**, derived under `DB-001`. **Recorded as a reading requiring confirmation, as `GAP-110` treated the Fund Transfer readings** | `STATE_MACHINE_ARCHITECTURE.md` |
| 2 | **`SM-5`'s `COLLECTED_BY_INTERMEDIARY` scope.** `OM §11.3` scopes it to a **courier or marketplace** collecting; a Trioloo employee is not an intermediary. **Whether own-staff collection occupies that state is not stated** | `PAYMENT_ARCHITECTURE.md`, `STATE_MACHINE_ARCHITECTURE.md` |
| 3 | **`E-032` delivery-charge representation.** A delivery charge is *"a separate line item on the order"* (`BD-417`) but references no product; `OM §4.5`'s catalogued/non-catalogued distinction concerns products, **not charges** | `DOMAIN_MODEL.md` |
| 4 | **`BR-026` applicability after `BD-213`.** `BR-026` cites the Digibox address as its worked example, but Digibox orders are handled *"exactly the same way as any other Daraz order"* and final confirmation is Daraz's. **Whether the rule has current application, or is retained against a future direct-channel collection point, is undecided** | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| 5 | **The *subsidy* vocabulary collision.** `BD-408` records *"shipping subsidy"* as a **marketplace deduction**; `BD-190` introduces *"Delivery Subsidy"* as **Trioloo bearing a loss**. Same word, opposite direction, two owners (`SYS-016`) | `SYSTEM_ARCHITECTURE.md` §5.3 |
| 6 | **The *release* vocabulary collision, now three senses** — order release (`BR-081`), reservation release (`BD-279`), releasing goods at the counter (`BD-212`). Recorded at `WHS-028` | `SYSTEM_ARCHITECTURE.md` §5.3 |
| 7 | **Formal closure of `GAP-071`, `GAP-048` and `GAP-082`** — each substantially addressed by discovery, **none closed here** | `GAP_ANALYSIS.md` |
| 8 | **The Funds-In-Transit parallel.** `ACC-009`/`E-085` exist for money that has left one place and not arrived at another; staff-held COD has the same shape but is a different event. **Not decided** | `ACCOUNTING_ARCHITECTURE.md` |

---

# 27. Open GAPs and Queued Decisions

## 27.1 GAPs carried — none closed

| GAP | Severity | Bearing on delivery |
|---|---|---|
| **`GAP-048`** | 🟡 | **`LOST` and `DAMAGED` boundaries now defined** (`BD-218`, `BD-074`); **`MISSING` — pick shortfall — untouched** and Warehouse territory. **Substantially addressed on the shipment half; formal closure is `GAP_ANALYSIS.md`'s** |
| **`GAP-071`** | 🟠 | **Own-staff settlement path now described end to end** (`BD-211`). **Substantially answered; not closed** |
| **`GAP-082`** | 🟠 | **Narrowed** — the business chose *label over accrue* for courier cost (`BD-413`); the marketplace-charge half is untouched |
| **`GAP-024`** | 🟡 | **No ageing threshold** for a stalled shipment, a pending actual cost, staff-held cash, or recovery effort |
| **`GAP-019`** | 🟠 | `SM-4`'s `LOST` entry is now classified **External**; other transitions remain `UNDECIDED` |
| **`GAP-081` · `GAP-084`** | 🟡 | Refund-recovery and claim-compensation classification — **`BD-408` ruled on a fee and was not extended** |
| **`GAP-072`** | 🟠 | Installments modelled nowhere; a listed payment method |
| **`GAP-015`** | 🟡 | **No Campaign entity** — *Delivery Subsidy by Campaign* has no identity to group by |
| **`GAP-026`** | 🟡 | State-name collisions across machines |
| **`GAP-032`** | ✅ | **Closed by `BD-073`** — seven delivery-failure causes. Recorded for traceability only |
| **`GAP-001`** | 🔴 | Module documents remain unwritten. **This document reduces the count by one** |

## 27.2 Queued follow-ups — carried OPEN, none answered

| # | Question | Raised by |
|---|---|---|
| **`BD-411`** | Is more than one Steadfast **service type** actually used today, or is that factor future-proofing? | `BD-405` |
| **`BD-412`** | Does any product Trioloo sells actually attract a **special-handling** charge today? | `BD-405` |
| **`BD-415`** | *"Shipping subsidy"* appears as a marketplace deduction category — a subsidy is money in, not a charge. How is it recorded? | `BD-408` |
| **`BD-416`** | How long before a **pending Actual Courier Cost** is treated as overdue rather than outstanding? | `BD-413` |
| **`BD-418`** | When staff **waive a delivery charge**, is a reason recorded, and are waiver and approval recorded separately? | `BD-191` |
| **`BD-419`** | If a staff member does not hand in collected cash when expected, **how would the business notice?** | `BD-211` |
| **`BD-420`** | Is the **signed invoice or delivery copy** captured into the ERP, or does it stay a paper record? | `BD-212` |
| **`BD-422`** | Is the **recovery outcome** — what was decided and by whom — recorded against the order? | `BD-216` |
| **`BD-423`** | How does a **corrected address or re-attempt request** reach Steadfast — API, panel, or phone call? | `BD-216` |

**Also queued and unasked, from §9:** `BD-210` *(Steadfast eligibility wording)* · **`BD-214`** *(the RTS name collision)* · `BD-215` *(answered in substance by `BD-291`)* · **`BD-217`** *(COD-inability as a distinct failure cause)* · `BD-219` *(push versus poll)*.

**No queued decision is answered by this document.**

---

# 28. Traceability

## 28.1 Business Decisions consumed

**§9 Delivery Rules:** `BD-067` single courier, auto-assigned · `BD-068` own-staff delivery · `BD-069` self-collection · `BD-070` Digibox · `BD-071` failed delivery and RTO timings · `BD-072` courier-governed attempts · `BD-073` seven failure causes · `BD-074` damage and missing-component claims · `BD-075` three tracking mechanisms.

**§28 Courier Commercial Model:** `BD-405` rate structure · `BD-406` COD charge · `BD-407` when charges become known · `BD-408` channel boundary · `BD-409` rate versioning · `BD-410` historical preservation · `BD-413` pending actuals · `BD-414` failed-delivery charges · `BD-417` where delivery income sits · `BD-190` charge versus cost · `BD-191` when delivery is not charged.

**§29 Delivery Workflow:** `BD-211` own-staff COD custody · `BD-212` self-pickup verification · `BD-213` Digibox · `BD-216` failed-delivery intervention · `BD-218` the `LOST` threshold.

**Supporting:** `BD-023`, `BD-033`, `BD-048`, `BD-058` – `BD-060`, `BD-063`, `BD-064`, `BD-275`, `BD-278`, `BD-286`, `BD-291`, `BD-304` – `BD-314`, `BD-319`, `BD-323`, `BD-338`, `BD-377`, `BD-402`.

## 28.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `BR-023` – `BR-035`, `BR-044`, `BR-046`, `BR-047`, `BR-054`, `BR-055`, `BR-077`, `BR-081`, `BR-100`, `BR-104`, `BR-116`, `BR-117`, `BR-121`, `BR-124`, `BR-131`, `BR-133`, `BR-134` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `SM-4`, `SMA-001`, `SMA-013`, `SMA-037`, `SMA-047`, `SMA-071` | `STATE_MACHINE_ARCHITECTURE.md` |
| `SYS-010` – `SYS-013`, `SYS-016`, `SYS-017`, `SYS-021` – `SYS-024`, `SYS-034`, `SYS-043`, `SYS-046`, `SYS-047`, `SYS-055`, `SYS-082`, `SYS-087` – `SYS-089`, `SYS-094`, `SYS-095`, `SYS-100`, `SYS-104`, `SYS-107`, `CP-8`, `CP-12` | `SYSTEM_ARCHITECTURE.md` |
| `E-031`, `E-032`, `E-036` – `E-038`, `E-042`, `E-043`, `E-054`, `E-056`, `INV-37.1` – `INV-37.5`, `INV-38.1` – `INV-38.4`, `INV-40.1`, `DM-001`, `DM-002` | `DOMAIN_MODEL.md` |
| `PAY-000`, `PAY-001`, `PAY-009`, `PAY-017`, `PAY-026` | `PAYMENT_ARCHITECTURE.md` |
| `ACC-004`, `ACC-009`, `ACC-011` – `ACC-013`, `ACC-019`, `ACC-020`, `ACC-025`, `ACC-031`, `ACC-033`, `ACC-034` | `ACCOUNTING_ARCHITECTURE.md` |
| `IVN-000`, `IVN-012`, `IVN-013`, `IVN-024` – `IVN-026` | `INVENTORY_ARCHITECTURE.md` |
| `ICO-025`, `ICO-026` | `INVENTORY_COSTING_ARCHITECTURE.md` |
| `WHS-000`, `WHS-019` – `WHS-025`, `WHS-028`, `WHS-035`, `WHS-062` – `WHS-064` | `WAREHOUSE_ARCHITECTURE.md` |
| `API-003`, `API-004`, `API-008`, `API-012`, `API-015`, `API-020`, `API-024`, `API-027`, `API-028`, `API-030` | `API_ARCHITECTURE.md` |
| `RPT-001`, `RPT-006`, `RPT-008`, `RPT-035`, `RPT-039` | `REPORTING_ARCHITECTURE.md` |
| `DB-001` – `DB-005`, `DB-017`, `DB-022`, `DB-023`, `DB-067`, `DB-077` | `DATABASE_ARCHITECTURE.md` |
| `PRM-005`, `PRM-008`, `PRM-009`, `PRM-051`, `PRM-052`, `PRM-064`, `AGV-001`, `AGV-020` | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `AUD-004`, `AUD-009`, `AUD-021` | `AUDIT_ARCHITECTURE.md` |
| `NOT §21.1` | `NOTIFICATION_ARCHITECTURE.md` |
| `EVA-006`, `EVA-012`, `EVA-017` | `EVENT_ARCHITECTURE.md` |
| `DOC-005`, `DOC-050` | `MASTER_DOCUMENTATION_INDEX.md` |

## 28.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`SYS-082`** — courier selection not modelled; the multi-courier assumption **withdrawn** | `DLV-014`, `DLV-015` |
| **`BR-028` retained and now more valuable** — adding a courier requires no lifecycle change | `DLV-016` |
| **`BR-052` amended as `BR-096`** — reservation at order confirmation (`DOC-050` entry 2) | Context only |
| **`SYS-088` confirmed unamended** (`DOC-050` entry 5) | `DLV-080` |
| **`BD-070` and the reference image both true** (`DOC-050` entry 4) | `DLV-010`, `DLV-011` |
| **`BD-072` and `OM §10.4` both stand** (`DOC-050` entry 6) | `DLV-040`, `DLV-041` |
| **`BR-117`** — a failed delivery leaves no phantom receivable, automatically | `DLV-050` |

---

# 29. Version History

| Version | Date | Change |
|---|---|---|
| **1.8.0** | **2026-08-09** | ✅ **POST-FREEZE AMENDMENT under `DOC-067` — `BD-445` answers `BD-420`. §18B added, `DLV-137` – `DLV-141`. A hole this document had flagged against itself is CLOSED.** §18 had recorded that **“a paper signature is in neither”** `E-054` nor the ERP; **`BD-445` splits the artefact from the fact** — **the ERP records that acknowledgement was obtained and that record is authoritative; the scan is optional.** **`DLV-139` puts the fact where each path already provides for it**: **own-staff on `E-037`'s existing *proof of delivery* attribute — no model change**; **self-pickup on `E-035`, because `INV-37.5` gives a `SELF_PICKUP` order no shipment at all**; **courier not applicable** (`DLV-132`). **`DLV-140` reuses `E-054`, whose types already include *proof of delivery*.** **`DLV-141`: absence of a scan never blocks completion**, and **nothing had to be un-built — no rule ever made an attachment a precondition**, so it **forecloses a gate rather than removing one** (`CP-8`). ✅ **`AUD-021` satisfied without amendment.** ⚠ **Repair in the same pass**: §18's `BD-420` note **had been split in two by yesterday's §18A insertion**, leaving its trailing half stranded at the end of §18A. **Restored whole under `DOC-009`; no rule was affected** |
| **1.7.0** | **2026-08-09** | ✅ **POST-FREEZE AMENDMENT under `DOC-067` — `BD-444` answers `BD-136`. §18A added, `DLV-132` – `DLV-136`. `DLV-102` UNCHANGED.** **Delivery Challan is CONDITIONAL, not required for every delivery**, and **three paths carry three evidence models**: **courier — the courier's own record IS the evidence, no Trioloo signature, and no Challan created to duplicate courier proof**; **own-staff — a Challan may be issued and signed where acknowledgement is required**; **self-pickup — acknowledgement belongs to the collection fact.** ✅ **`DLV-132` fills a silence rather than replacing a rule** — **nothing in the frozen corpus said what a customer signs on a courier delivery** — and it is consistent with `E-037`'s **proof of delivery** attribute, `INV-54.1` and `DLV-063`. ✅ **`DLV-102`'s scope confirmed, not amended**: it sits in §18 **Self Pickup**, its `Collected` is `SM-3`'s self-pickup terminal, and **`BD-444` chooses within the permission it already granted** — not an amendment under `DOC-068`. **`DLV-133` keeps the delivery document separate from the Sales Invoice for the same reason `DLV-096` keeps delivery separate from cash receipt.** **`DLV-135`: “Delivery Challan” and “Delivery Copy” are ONE identity** — no canonical evidence distinguishes them. **`DLV-136`: the Sales Invoice never serves as delivery proof.** ⚠ **No printing, signature mandate for courier, courier API behaviour, numbering, sequence, copy, retention, field or layout created** — all explicitly prohibited; **document ownership is left to Document Architecture** |
| **1.6.1** | **2026-08-09** | **`DLV-019` amended — residual from the `BD-442` sweep; no rule added.** It still read *“an order may have many shipments”*. **At most one ACTIVE shipment**; successive shipments across fulfilment attempts remain normal |
| **1.6.0** | **2026-08-09** | ✅ **`GAP-116` propagated — `BD-442`, the final Freeze blocker. `DLV-021` amended, `DLV-020`'s illustration withdrawn; no delivery state, cause or rule removed.** **`Order:PARTIALLY_DELIVERED` is REMOVED** — the order reaches `DELIVERED` when its shipment is delivered, and **a refused or undeliverable parcel reaches `FAILED_DELIVERY` and follows RTO**, already specified in full by `BR-117`, `DLV-044` and `DLV-050`. ✅ **This document needed almost no change, because it already agreed**: **`DLV-046`/`BD-073`'s seven confirmed failed-delivery causes are ALL whole-parcel** — including *customer refuses the parcel* — so **refusal was always modelled at the parcel and never at the item.** **`DLV-020` STANDS**; only its illustration *“one shipment delivered and another lost”* is withdrawn, since an order now has **at most one active shipment.** ⚠ **Successive shipments remain normal** — an RTO'd parcel re-sent **is** a second shipment; what is withdrawn is **concurrency, not multiplicity** |
| **1.5.1** | **2026-08-09** | **`DLV-130` clarified — no rule changed in substance.** The COD figure is the **outstanding cash receivable**. The architecture decision **preserves `PAY-015`'s gross receivable**, with applied credit clearing part of it as a non-cash component — so **Delivery never sees the gross figure** and receives only what must be collected in cash. `DLV-131` unchanged: **a collector never applies the credit** |
| **1.5.0** | **2026-08-09** | **COD amount confirmed as net — `DLV-130`, `DLV-131` added; no collection path changed.** `BD-433` confirms that **where Trade-In Credit has been applied, the COD instruction carries the already-reduced figure**, and that **a collector never applies the credit.** Credit is applied **before dispatch** so the figure is correct when the shipment is created. **This keeps a non-cash instrument off the parcel** — at ~100% COD the alternative would put a financial decision in a courier's hands. `DLV-090` and `DLV-091` are untouched |
| **1.4.0** | **2026-08-09** | **Failed trade-in return reconciled — §18B.1 and `DLV-128`, `DLV-129` added; no new behaviour.** `BD-430` did not cover a failed courier return, unlike `BD-429` for warranty. **It required no new business answer**: Delivery's normal failed-delivery/RTO lifecycle applies, **the item never stopped being customer property** so its return is a custody fact and never an inventory one (`SYS-103`), and **`BD-396` already models a customer who does not collect or accept return**, with `SMA-070` permitting a further attempt. **`TradeIn.ReturnFailed` was NOT created** — it would duplicate Delivery's lifecycle |
| **1.3.1** | **2026-08-09** | **Event cross-reference added — no rule changed.** `DLV-125` now names **`EVT-100 TradeIn.CourierReturnRequired`**, whose occurrence point is **the return-method determination, never `DECLINED`**, and records that a `CUSTOMER_PICKUP` return publishes nothing. Delivery's own lifecycle `EVT-031` – `EVT-038` is reused whole |
| **1.3.0** | **2026-08-09** | **Declined trade-in return propagated — §18B and `DLV-124` – `DLV-127` added; no existing rule changed.** `BD-430` confirmed **two return methods**, and Delivery is involved in only one. **`DLV-125` records the prohibition the business stated explicitly**: a decline must never be taken to imply a courier shipment exists — the method is determined separately. **`DLV-126` confirms the item stays customer property** with no ownership transfer and no inventory. **`DLV-127` records that the cost bearer lives on the Trade-In Case and that its outcome set is an open `DOC-050` conflict** — four outcomes in `BD-395` against two in `BD-430` — **which Delivery neither adopts nor resolves.** Third instance of `SMA-013` in this document |
| **1.2.0** | **2026-08-09** | **Warranty & Repair handback propagated — §18A and `DLV-112` – `DLV-123` added; no existing rule changed.** This document carried **no warranty content at all**, while `EVT-095 Warranty.ReadyForHandback` names Delivery as a consumer. §18A records `BD-429`'s confirmed facts: **the handback uses the normal courier process and stays linked to the case**, is **not a sale**, carries **no product COD** unless an authorised current charge exists, and **never recreates the original order's COD** — which at ~100% COD is the likeliest pattern-matching error. **`DLV-118` records that zero COD does not imply zero courier cost**, with the bearer following the case's existing cost-responsibility decision. **`DLV-121` states that dispatch is not handover** and `DLV-122` that a returned unit re-enters custody with the case unresolved. **Self-pickup creates no shipment** (`DLV-123`), consistent with `DLV-098` and `SMA-013`. **Two open items are recorded, not solved**: the missing Payment contract for a chargeable-repair amount, and the accounting treatment of handback courier cost |
| **1.1.0** | **2026-08-09** | **Status references corrected — no rule changed.** `SM-3` Fulfillment and `SM-6` Marketplace Settlement, both listed in §16 as observed machines owned elsewhere, were ratified into `OM §18.2` on 2026-08-09 (`BR-142`). **Their rows no longer describe them as unratified proposed extensions.** No delivery rule, state, transition or boundary changed |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §9 (`BD-067` – `BD-075`), **§28 Courier Commercial Model** (`BD-405` – `BD-417`, `BD-190`, `BD-191`) and **§29 Delivery Workflow** (`BD-211` – `BD-218`), with the reconciliations at `OM §9` – `§11`, `SMA §8` and `DOMAIN_MODEL.md` `E-036` – `E-038`. **112 rules (`DLV-000` – `DLV-111`), all traceable; no business rule, entity, state machine, lifecycle or threshold introduced.** `DLV-000` records the ownership boundary. **`DLV-027` – `DLV-029` record that `LOST` has no elapsed-time threshold by decision** — the second instance of `SMA-037`'s pattern. **`DLV-079` – `DLV-081` record Delivery Profit/Loss as analytical only, with `SYS-088` unamended.** **`DLV-097` carries the untracked staff-custody exposure exactly as discovered, with no control invented.** **Eight reconciliation points carried in §26 and nine queued follow-ups carried OPEN in §27.2; no gap closed and no queued decision answered** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies delivery business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
