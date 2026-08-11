# Warranty & Repair Architecture

**Owner:** Trioloo Technology · **Module:** Warranty & Repair · **Status:** Canonical
**Version:** 1.1.0 · **Ratified:** 2026-08-09 · **Rule prefix:** `WAR-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §21 Warranty (`BD-329` – `BD-341`, 12 answers, complete), with §12 Warranty Rules (`BD-091` – `BD-097`) and prior coverage at `BD-029`, `BD-107`, `BD-144`, `BD-237`, `BD-238`, `BD-240`, `BD-241`, `BD-244`, `BD-265`, `BD-283`, `BD-289`, `BD-290`, `BD-292`, `BD-293`, `BD-324`, `BD-326`, `BD-327`, `BD-338`.

**Reconciliation records consolidated:** [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) §21 (`SM-13`, `SM-15`, `SMA-039` – `SMA-047`) · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) §32 (`PRD-132` – `PRD-136`) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-070` – `E-072` and their invariants.

**References, never duplicated:** [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) `PRD-` · [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) `WHS-` · [`PROCUREMENT_ARCHITECTURE.md`](PROCUREMENT_ARCHITECTURE.md) `PRC-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`CUSTOMER_ARCHITECTURE.md`](CUSTOMER_ARCHITECTURE.md) `CUS-` · [`CHAT_ARCHITECTURE.md`](CHAT_ARCHITECTURE.md) `CHT-` · [`DELIVERY_ARCHITECTURE.md`](DELIVERY_ARCHITECTURE.md) `DLV-` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) `PAY-` · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) `NOT-` · [`API_ARCHITECTURE.md`](API_ARCHITECTURE.md) `API-` · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) `AGV-` · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) `AUD-` · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **WAR-000 — This document answers *what happened to one customer's faulty unit, and who paid for it*. It answers nothing about what the warranty promises, what the stock position is, what anything posts, or who is permitted to act.**

| Question | Owner |
|---|---|
| **The warranty request, the repair job, their progress, their custody and their cost attribution** | **`WARRANTY_REPAIR_ARCHITECTURE.md`** — `WAR-` |
| **What the warranty promises** — duration, coverage, exclusions, responsible party, `E-070` Warranty Package | `PRODUCT_ARCHITECTURE.md` — `PRD-132`, `PRD-133` |
| **What a unit was built from** — `E-062` As-Built Record | `PRODUCT_ARCHITECTURE.md` — `PRD-036` |
| **Stock quantity and movement** of parts consumed | `INVENTORY_ARCHITECTURE.md` — `IVN-028` |
| **What a consumed part cost** | `INVENTORY_COSTING_ARCHITECTURE.md` — `ICO-022` – `ICO-024` |
| **Physical holding, benches, QC execution** | `WAREHOUSE_ARCHITECTURE.md` — `WHS-` |
| **Buying a part that is not in stock** | `PROCUREMENT_ARCHITECTURE.md` — `PRC-` |
| **Whether a *return* is owed a refund or exchange** | `RETURN_EXCHANGE_ARCHITECTURE.md` — `RET-` |
| **Who the customer is** | `CUSTOMER_ARCHITECTURE.md` — `CUS-` |
| **The conversation a request may arrive through** | `CHAT_ARCHITECTURE.md` — `CHT-` |
| **Shipping a unit anywhere** | `DELIVERY_ARCHITECTURE.md` — `DLV-` |
| **What any of it posts** | `ACCOUNTING_ARCHITECTURE.md` — `ACC-000` |
| **Executing a refund** | `PAYMENT_ARCHITECTURE.md` — `PAY-` |
| **Message transport and delivery evidence** | `NOTIFICATION_ARCHITECTURE.md` — `NOT-` |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` — `SM-13`, `SM-15`, `SMA-` |
| **Who may inspect, approve, resolve or close** | `PERMISSION_ARCHITECTURE.md` · `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| **Audit record structure and retention** | `AUDIT_ARCHITECTURE.md` — `AUD-` |

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine, lifecycle, threshold, policy, tolerance or automation is introduced. **No gap is resolved by assumption** — see §21.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To hold what happens after a sale goes wrong: **a customer reports a fault, the unit is examined, something is done about it, and somebody bears the cost.**

Two facts make this a module rather than a footnote on Product.

> **A warranty term reaches 12 years** (`BD-091`), and **records are retained permanently** (`BD-338`). A claim may arrive against a sale made a decade ago, and the evidence must still be there.

> **A repair can exist with no warranty claim behind it at all** (`SMA-044`, `INV-72.1`). **Three of its four entry points are not warranty.**

**The domain's hardest structural problem was solved before this document existed**, and is inherited rather than decided here: warranty and repair are **two lifecycles, not one**, because collapsing them would make two of repair's four entry points unreachable.

---

# 2. Scope

## 2.1 In scope

`E-071` Warranty Request and its progress · intake across eight channels and the recording of the intake channel · eligibility determination and its basis · the resolution decision and its reason · `E-072` Repair, its four entry points, performer and parts · the custody of customer property while it is held · upstream recovery routing and its result · warranty and repair cost attribution, expected and actual · handback · the warranty history of a unit.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **`E-070` Warranty Package** — duration, parts warranty, service warranty, coverage, exclusions, terms, responsible party, card issuance | `PRODUCT_ARCHITECTURE.md` (`PRD-132`) |
| **`E-062` As-Built Record** — what a unit was built from | `PRODUCT_ARCHITECTURE.md` (`PRD-036`) |
| **Stock quantity and the movement ledger** | `INVENTORY_ARCHITECTURE.md` |
| **Component cost and valuation** | `INVENTORY_COSTING_ARCHITECTURE.md` |
| **Physical execution — receiving, holding, QC performance** | `WAREHOUSE_ARCHITECTURE.md` |
| **Purchasing a part** — supplier, purchase order, receipt | `PROCUREMENT_ARCHITECTURE.md` |
| **Return and exchange entitlement, RTO, return QC disposition** | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| **Customer identity, contacts, history presentation** | `CUSTOMER_ARCHITECTURE.md` |
| **Conversations, Channel Identity, internal notes** | `CHAT_ARCHITECTURE.md` |
| **Shipment, courier, tracking, delivery outcome** | `DELIVERY_ARCHITECTURE.md` |
| **Every posting and recognition decision** | `ACCOUNTING_ARCHITECTURE.md` (`ACC-000`) |
| **Refund execution** | `PAYMENT_ARCHITECTURE.md` (`PAY-046` – `PAY-049`) |
| **Marketplace claims against Daraz** — `E-069`, `SM-14` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` |
| Screen layout, density, interaction | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

## 2.3 Explicitly removed from scope by the business

> **WAR-001 — Five capability areas were considered and removed by explicit business answer, not by omission** (`PRD §32.3`). **None is reconstructed here** (`DOC-001`, `CP-9`).

| Removed | Why | Source |
|---|---|---|
| **Loaner pool, loaner inventory category, allocation, return-chasing, condition grading on return** | The business does **not normally provide a loaner**; customers wait | `BD-335` |
| **Warranty SKU, warranty as a sellable product, attach rate, warranty revenue line** | It is **policy, not product** | `BD-340` |
| **Warranty card machinery** | The card **grants nothing and gates nothing** | `BD-339` |
| **Warranty restart, extension and recalculation logic** | The timeline is **immutable**; expiry is computed once | `BD-337` |
| **Automatic deletion or purge of any record** | No hard-delete policy exists | `BD-338`, `BD-341` |

**Loaner management is a standard field-service capability and is explicitly not required.** That is `CP-9` in practice: the exceptional case is handled by a recorded decision, not by machinery.

---

# 3. Architectural Principles

## 3.1 P1 — Warranty and repair are two lifecycles, not one

> **WAR-002 — `SM-13` Warranty Claim and `SM-15` Repair are independent machines; `SM-13` delegates into `SM-15` on the *Repaired* branch** (`SMA-044`, `SMA-002`).

**Eight of the thirteen repair stages share a name with a warranty stage** (`BD-331`, `BD-333`). That overlap is resolved by **machine-qualified naming, never by merging** (`SMA-047`, `GAP-026`) — `SM-13.RECEIVED` and `SM-15.RECEIVED` are different states of different entities.

## 3.2 P2 — Eligibility is proved by the sales record

> **WAR-003 — Warranty eligibility is proved by the ERP sales record. The serial authenticates; it does not qualify** (`INV-71.1`, `PRD-134`, `BD-330`).

Two questions were being conflated and they take different evidence — eligibility (*did this customer buy this from us, in term?*) and authentication (*is this the physical unit we sold?*, `BR-047`).

## 3.3 P3 — Absent paperwork routes to a person; it never refuses

> **WAR-004 — Missing documentation never auto-refuses a claim. It routes to manual review** (`INV-71.1`, `BD-330`, `BD-339`).

Stated twice independently: no sales record found routes to manual review; no warranty card is **not** grounds for refusal. `CP-8` applied to evidence rather than to authority.

## 3.4 P4 — The warranty timeline never moves

> **WAR-005 — Warranty does not restart on repair or replacement. The original period continues from the original delivery date** (`INV-71.3`, `BD-337`, `DB-003`).

## 3.5 P5 — Expected and actual cost are both retained

> **WAR-006 — Warranty cost bearer and final cost responsibility are separate retained values, and the difference is the information** (`INV-71.2`, `BD-336`).

**Same discipline as `INV-69.1`, `SYS-055` and `PAY-002`** — expected and actual are kept side by side wherever they can diverge.

## 3.6 P6 — Refund last

> **WAR-007 — Refund is an exceptional warranty resolution, not an equal third option** (`SMA-043`, `BD-332`).

**`SMA-043` records this as a stated business principle rather than a per-module preference**, confirmed in four unrelated contexts: customer returns (`BD-090`), supplier settlement (`BD-301`), refund timing (`BD-310`) and warranty resolution (`BD-332`). **Keep the value in goods; move money only when goods cannot resolve it.**

---

# 4. `E-071` Warranty Request

> **WAR-008 — `E-071` Warranty Request is a customer's warranty claim from first contact to closure, and carries the `SM-13` lifecycle** (`E-071`, `SM-13`). **Its attributes are defined in `DOMAIN_MODEL.md` and are not restated here** (`DOC-005`, `DOC-006`).

## 4.1 The vocabulary the business supplied

> **WAR-009 — The customer-facing case is a *warranty request*. *Supplier claim* and *marketplace claim* run the other direction and are different things** (`E-071` notes, `BD-329`).

| Term | Direction | Entity | Owner |
|---|---|---|---|
| **Warranty request** | **Customer → Trioloo** | **`E-071`** | **Here** |
| Supplier claim | **Trioloo → supplier** | A disposition and a recovery route (`BD-289`, `BD-097`) | Here (§12), Procurement for the commercial relationship |
| Marketplace claim | **Trioloo → Daraz** | `E-069`, `SM-14` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |

> **`SYS-016` forbids two vocabularies for one concept; one word for three concepts is the sharper failure.** The business supplied the disambiguation itself, so **nothing is invented by adopting it** — and the three are sequentially related: a warranty request may cause a supplier claim, and on a marketplace order a marketplace claim as well.

## 4.2 Every request is registered

> **WAR-010 — However a request arrives, it is registered and managed inside the ERP** (`BD-329`).

**This is `BD-328`'s single-workspace goal applied to warranty** — many ways in, one place to manage it, the same shape as the unified inbox (`CHT-000`).

---

# 5. Intake

## 5.1 Eight channels, two shapes

> **WAR-011 — A warranty request may begin on any of eight intake channels** (`BD-329`): phone · walk-in service · Facebook Messenger · WhatsApp · Daraz chat · website chat *(future)* · **courier return** · other marketplace communication channels.

> **WAR-012 — Intake has two structurally different shapes, and `SM-13`'s two initial states exist because of it** (`SMA-039`, `BD-329`).

| Shape | First event | What the business has | Enters at |
|---|---|---|---|
| **Conversation-first** | The customer makes contact | **A person to ask**, before any goods move | **`REPORTED`** |
| **Goods-first** | **A unit simply arrives** | **A physical object and no context** | **`RECEIVED`** |

> **WAR-013 — The goods-first case is identification work, not an exception path.** A returned unit arrives with no prior conversation and the business must establish **what it is, who sent it, and whether it is in term** from the object itself (`BD-329`). **`BD-283`'s Build ID earns its place here** — on an assembled PC it may be the only unit-level identity available, because component serials are usually not recorded (`BD-095`, `BD-265`).

**A claim that starts with a parcel is the same lifecycle entered one stage later** (`SMA-039`). It is not a second machine and not a special case.

## 5.2 Intake channel is its own attribute

> **WAR-014 — The intake channel is recorded on the request and is independent of the channel the sale came through** (`BD-329`, `CUS-060`).

**Third independent confirmation of one principle**, and neither attribute derives from the other:

| Arriving thing | Its own channel | Established by |
|---|---|---|
| Money | Collection Source | `BD-315` |
| Conversation | Chat channel | `BD-327` |
| **Warranty request** | **Intake channel** | **`BD-329`** |

## 5.3 Where a conversation-borne request comes from

> **WAR-015 — Where a request arrives through a chat channel, the conversation is owned by `CHAT_ARCHITECTURE.md` and the request links to it** (`BD-326`, `BD-327`, `CHT-037`). **Marketplace warranty inquiries arrive through chat** (`BD-326`).

⚠ **Whether that link is a conversation attribute or a warranty-request attribute is recorded at `CHT-037` as unresolved and is not decided here** (`GAP-096`).

---

# 6. Eligibility

## 6.1 What is searched, and what proves it

> **WAR-016 — Warranty is verified primarily against the ERP sales record, searched on any available information** (`BD-330`): customer phone number · customer name · invoice number · order number · product details · purchase date.

**`BD-023` is confirmed again** — phone number leads the search key list, as it does for customer lookup generally (`CUS-`).

> **WAR-017 — Where a matching sales record is found, the ERP determines eligibility automatically** (`BD-330`). Comparing a date against a term is **arithmetic and is computed**; deciding what to do about an unprovable or out-of-term case is **judgement and routes to a person** (`CP-8`, `WAR-004`).

## 6.2 The clock starts at delivery

> **WAR-018 — The warranty period runs from the product delivery date; where no delivery date exists, the completed sale date is used** (`BD-330`, `INV-51.1`, `AUD-017`).

**The sale-date fallback is not a data gap.** Where there is no delivery — **walk-in and self-collection** (`BD-022`, `BD-069`) — the sale *is* the handover. It also covers migrated records from the existing system (`BD-007`) that predate delivery capture.

## 6.3 On an assembled unit there is no single answer

> **WAR-019 — On an assembled product, warranty eligibility is per component, resolved via Build ID → As-Built Record** (`PRD-135`, `PRD-043`, `PRD-117`, `BD-092`, `BD-330`).

| Product | Eligibility |
|---|---|
| Television, monitor, accessory | **One term** — determinable from the sales record alone |
| **Assembled PC** | **Per component** — depends on which component failed |

> **WAR-020 — Eligibility on an assembled unit may therefore not be determinable until the fault is diagnosed** (`SMA-040`, `BD-330`). **A customer asking *"is my PC still under warranty?"* at intake often cannot be given a straight answer**, and `SM-13` determines eligibility at `INSPECTION` rather than at intake **so the lifecycle can say so honestly**.

## 6.4 The card proves nothing the record does not

> **WAR-021 — A warranty card, where issued, is an additional reference only. It is never the primary proof and its absence never refuses a claim** (`BD-339`).

⚠ **Whether card issuance is recorded is not stated in any source and is not assumed** (`BD-339`, `DOC-030`). It changes nothing either way, because the card is not consulted when verifying a claim.

## 6.5 What the warranty actually promises is Product's

> **WAR-022 — The terms eligibility is measured against are held in `E-070` Warranty Package, owned by `PRODUCT_ARCHITECTURE.md`** (`PRD-132`, `BD-340`). **This module reads the package; it does not define, version or assign one.**

> **WAR-023 — A request references the Warranty Package version in force at the time of sale, never the current one** (`INV-70.1`, `INV-70.2`, `PRD-133`, `DB-022`).

**`PRD-133` records why this matters more here than anywhere else:** a package edited in place would rewrite **live contractual obligations up to 12 years old** — the longest exposure of the three versioned configuration subjects.

---

# 7. `SM-13` — the warranty lifecycle

> **WAR-024 — `E-071` carries `SM-13`, whose states, transitions, diagram and terminal semantics are defined in `STATE_MACHINE_ARCHITECTURE.md` §21.1 and are not restated, redefined or extended here** (`DOC-005`, `SMA-039` – `SMA-043`).

**Authority is Internal — Trioloo runs the process.** Initial `REPORTED` **or** `RECEIVED`; terminal `CLOSED`.

## 7.1 The stages the business gave

> **WAR-025 — The business described ten stages and required conditional paths within a single lifecycle** (`BD-331`): Warranty Reported · Warranty Received · Inspection · Waiting for Customer Approval *(if required)* · Repair in Progress · Waiting for Parts *(if required)* · External Service Center *(if required)* · Ready for Delivery · Delivered · Closed.

> **WAR-026 — Those ten stages describe the *repair path specifically*, not the machine's only route** (`SMA-041`, `BD-332`). Replacement and refund branch at `INSPECTION` and do not pass through them.

## 7.2 Delivered is not Closed

> **WAR-027 — Handing the unit back does not end the case** (`SMA-042`, `BD-333`). **Upstream recovery may still be open and final cost responsibility unsettled** (`BD-336`, `BD-290`).

**The commercial process outlives the physical one** — the same separation as `BR-010` for orders and `BR-141` as generalised, now confirmed in a third lifecycle independently.

---

# 8. Resolution

## 8.1 The decision and who makes it

> **WAR-028 — The resolution is Repaired, Replaced, or Refunded, decided at `INSPECTION` by an authorised business representative following the business warranty policy** (`SMA-041`, `BD-332`).

> **WAR-029 — Five factors are weighed, and they are inputs a person judges rather than conditions a system evaluates** (`BD-332`): nature of the fault · warranty coverage · **repair feasibility** · **availability of replacement product or parts** · **manufacturer or supplier warranty policy**.

**Two of the five are partly system-knowable** — repair feasibility and parts availability — and the ERP holds the stock position that informs them. **The system informs; the representative decides.** `BD-332` records this as the twelfth instance of advise-over-enforce and consistent with `CP-8`: availability is a fact and is computed; whether to repair or replace is judgement.

> **WAR-030 — No new authority is created.** *"Authorised business representative"* matches the existing approval model — Owner, Administrator, or a permissioned user (`BD-107`) — and respects the ratified simplification that **no new roles are introduced** (`PRM-`, `AGV-`).

## 8.2 The reason is mandatory

> **WAR-031 — Both the resolution and the reason for it are recorded** (`INV-71.4`, `BD-332`).

**The sixth independent reason-capture context** (`AUD-042`), after write-off (`BD-110`), stock adjustment (`BD-111`), discount (`BD-275`), substitution (`BD-282`) and scrap (`BD-291`).

## 8.3 Where each branch goes

> **WAR-032 — Each resolution branch delegates to the lifecycle that owns it; none is executed inside `SM-13`.**

| Resolution | Delegates to | Owner |
|---|---|---|
| **Repaired** | **`SM-15` Repair** (§9) | **Here** |
| **Replaced** | The replacement unit reaches the customer as `SM-13` `READY_FOR_DELIVERY → DELIVERED` (`SMA` §21.1) | Here, with `DELIVERY_ARCHITECTURE.md` for any shipment |
| **Refunded** | **Execution** is `SM-10` Refund | `PAYMENT_ARCHITECTURE.md` (`PAY-046`) |

⚠ **`BD-332` recorded that whether replacement routes into `SM-9` Exchange and refund into `SM-10` is *"an architecture decision rather than a discovery gap"*.** **`SMA` §21.1 settled the replacement half by keeping it inside `SM-13`'s diagram**, and `PAY-049` settles the refund half — `SM-10` *"is never standalone; it attaches to a return or an exchange"* (`BD-349`). **Whether a warranty-originated refund satisfies that attachment condition is stated by no ratified source.** Recorded as a reconciliation point at §22; **no route is asserted here.**

## 8.4 Upstream policy constrains what can be offered

> **WAR-033 — What Trioloo can offer the customer is shaped by the tier behind it** (`BD-332`, `BD-093`). If a manufacturer only replaces, repair may not be available to offer.

**`BD-093`'s two-layer model holds** — the customer deals only with Trioloo, and routing happens behind — **but the layers are not fully independent.**

---

# 9. `E-072` Repair and `SM-15`

> **WAR-034 — `E-072` Repair is a repair job on a unit from receipt to return, and carries the `SM-15` lifecycle** (`E-072`, `SM-15`). **Its states, transitions and terminal semantics are defined in `STATE_MACHINE_ARCHITECTURE.md` §21.2 and are not restated or redefined here** (`DOC-005`).

**Authority is Mixed — internal, with externally-owned excursions.** Initial `RECEIVED`; terminal `CLOSED`.

## 9.1 Three entry points, one of which is warranty

> **WAR-035 — `SM-15` has four entry points and only one is warranty** (`SMA-044` as amended, `INV-72.1`, `RET-027`, `SMA-072`).

| Entry | Source | Warranty? | Referred from |
|---|---|---|---|
| A warranty claim resolved as *Repaired* | `BD-332` | **Yes** | **`SM-13`, §8.3** |
| A return QC disposition of **Repair Required** | `BD-289` | **No** — a returned unit, not a claim | `RET-027`, `SM-11` |
| A **chargeable** repair, cost bearer = Customer | `BD-290` | **No** — paid service | Direct |
| **A Trade-In component classified `REPAIR_REQUIRED`** | **`BD-389`, `SMA-072`** | **No** — a salvaged component | **`SM-19`**, [`TRADE_IN_ARCHITECTURE.md`](TRADE_IN_ARCHITECTURE.md) `TRD-034` |

> ✅ **Fourth entry added 2026-08-09 — a stale enumeration corrected.** **`SMA-072` always stated that `REPAIR_REQUIRED` delegates to `SM-15`**; `SMA-044`'s list predated the Trade-In reconciliation and was never revisited. **`SM-15` is unchanged** — same states, transitions, terminals and authority — and **this document ratifies no machine** (`WAR-077`).

> **WAR-036 — A repair may exist with no warranty request behind it, and that is why it is an independent lifecycle** (`INV-72.1`, `SMA-044`). **Modelling repair as a sub-path of `SM-13` would make three of its four entry points unreachable.**

## 9.2 The stages the business gave

> **WAR-037 — The business described thirteen stages and required a single repair lifecycle serving in-house, supplier and external service centre repairs** (`BD-333`): Repair Received · Inspection · Waiting for Approval · Repair in Progress · Waiting for Parts · Sent to Supplier · Sent to External Service Center · Returned from Supplier / Service Center · Repair Completed · Final Quality Check · Ready for Customer Collection · Delivered to Customer · Closed.

## 9.3 The performer is recorded

> **WAR-038 — Every repair records who performed it** (`BD-290`): **Trioloo's own technician · an authorised service centre · the supplier or manufacturer**.

> **WAR-039 — The physical round trip to an external party is tracked, not merely the commercial claim** (`BD-333`). `SENT_TO_SUPPLIER` and `SENT_TO_SERVICE_CENTRE` each have a matching `RETURNED_FROM_EXTERNAL` stage.

## 9.4 Where waiting is Trioloo's and where it is not

> **WAR-040 — `SM-15`'s three waiting states are not the same kind of wait, and only one is internally owned** (`SMA-046`).

| State | Waiting on | Trioloo can influence? |
|---|---|---|
| `AWAITING_APPROVAL` | **The customer** | Chase, not control |
| **`WAITING_FOR_PARTS`** | **Procurement** | **Yes — internal** |
| `SENT_TO_SUPPLIER` · `SENT_TO_SERVICE_CENTRE` | **A third party** | **No** |

**This determines where ageing could legitimately exist at all** (`SMA-046`, `NOT-` §, `GAP-087`) — see §17.

---

# 10. Repair QC

> **WAR-041 — Repair QC is a stage of `SM-15`, not a machine, and no second QC machine exists** (`SMA-045`, `WHS-019`, `BD-333`).

**`SMA-045` settled the general rule across all three contexts, and this module does not reopen it:**

| Context | Checks | Modelled as | Owner |
|---|---|---|---|
| Build QC | A new build against its template | **Stage** of `SM-12` | `WAREHOUSE_ARCHITECTURE.md` |
| Return QC | A returned unit against what was dispatched | **Machine** — `SM-11`, four dispositions | `RETURN_EXCHANGE_ARCHITECTURE.md` · `WAREHOUSE_ARCHITECTURE.md` |
| **Repair QC** | **A repaired unit against working order** | **Stage** of `SM-15` | **Here** |

> **QC is a stage where it gates progress, and a machine where it decides an outcome** (`SMA-045`). **Repair QC gates**: pass and the unit goes back to the customer, fail and it returns to `IN_PROGRESS`. **It produces no branching disposition, so it needs no machine.**

> **WAR-042 — Physical execution of the check is the warehouse's; the gate it opens is the repair's** (`WHS-003`, `DOC-058`). **Warehouse performs, `SM-15` progresses.**

---

# 11. Parts and inventory

## 11.1 A repair consumes stock and creates none

> **WAR-043 — A repair consumes components from stock and does not create inventory** (`IVN-028`, `ICO-022`, `BD-290`).

> **WAR-044 — A component fitted during repair is consumed at its weighted average cost** (`ICO-022`, `ICO-001`). **The valuation is Inventory Costing's; this module records only that the part was fitted.**

## 11.2 Parts are recorded on the repair, never on the build

> **WAR-045 — Parts replaced during a repair are recorded on `E-072`, never on the As-Built Record** (`INV-72.2`, `PRD-044` as amended). **`E-062` is a build-time snapshot and must stay one** (`DB-003`).

## 11.3 ⚠ Current configuration has no owner — `GAP-089`

> **WAR-046 — After a repair the physical unit differs from its As-Built Record, and the record describing what is *currently* inside is neither one alone** (`BD-337`, `PRD-044` amended, `IVN §15.1`).

| Record | Describes | Owner |
|---|---|---|
| `E-062` As-Built Record | **What went in at build** — immutable | `PRODUCT_ARCHITECTURE.md` |
| **`E-072` Repair** | **What was changed afterwards** | **Here** |
| **Current configuration** | **Neither alone — the composition of both** | ⚠ **None** |

⚠ **`GAP-089` is carried unresolved.** Whether the derived view is **computed on demand or maintained** is an architecture decision, is recorded as undecided at `IVN §15.1`, and **is not decided here.** **This module supplies one of the two inputs; it does not thereby own the composition.**

## 11.4 ⚠ A repair needing a part is an unlisted purchase trigger — `GAP-088`

> **WAR-047 — A warranty repair needing a part is a purchase trigger that `BD-293` does not list** (`E-072` notes, `GAP-088`).

`BD-293`'s five stated triggers are low stock, components short for confirmed orders, expected demand, management decision, and a customer order needing unavailable items. **A warranty repair is none of these** — the part may be needed for a unit sold years ago. **Recorded as a genuine omission, not assumed**; procurement of the part remains `PROCUREMENT_ARCHITECTURE.md`'s.

---

# 12. Upstream recovery

## 12.1 When the claim goes up, and when it does not

> **WAR-048 — Whether warranty is borne by Supplier, Manufacturer or Trioloo is determined by the product's warranty policy, not decided per case** (`BD-336`).

> **WAR-049 — Whether a covered claim is actually pursued remains a judgement** (`BD-336`) — the business may absorb the cost where **claiming is not commercially practical**.

**This is a deliberate hybrid and the split matters** (`BD-336`, `CP-8`):

| Question | How answered |
|---|---|
| **Who is responsible?** | **Policy** — a lookup against the Warranty Package. Deterministic, computable |
| **Do we actually pursue it?** | **Judgement** — a person's call on a low-value claim |

> **WAR-050 — Where an upstream party is responsible, the claim is submitted according to that party's warranty policy** (`BD-097`, `BD-336`). **Three upstream tiers exist** — supplier · distributor · manufacturer (`BD-093`, `BD-097`).

## 12.2 The four fields the business named

> **WAR-051 — Four values are recorded on a warranty request** (`BD-336`, `E-071`): **Warranty Cost Bearer** *(expected)* · **Warranty Claim Destination** *(if applicable)* · **Final Cost Responsibility** *(actual)* · **Claim Result** *(if a claim was submitted)*.

> **WAR-052 — Cost bearer and final cost responsibility are separate because a claim can fail** (`INV-71.2`, `BD-336`). They diverge when an upstream claim is **rejected or not pursued** and Trioloo absorbs. **The record then shows both what should have happened and what did.**

**Same two-record discipline as `INV-69.1`**, where a marketplace's decision and Trioloo's inspection are kept independently and must not overwrite each other.

## 12.3 Per component on an assembled unit

> **WAR-053 — On an assembled product the claim destination is per component, exactly as eligibility is** (`PRD-135`, `BD-336`). **One PC failure may be a manufacturer claim and another an absorbed cost, depending on which part failed.**

## 12.4 Warranty responsibility is policy data, held by Product

> **WAR-054 — The responsible party is an attribute of `E-070` Warranty Package** (`E-070`, `PRD-132`, `BD-336`). **This module reads it and records the routing outcome; it does not hold or maintain the policy.**

---

# 13. Cost

## 13.1 Recording is mandatory regardless of charging

> **WAR-055 — Repair cost is recorded whether or not the customer is charged** (`ICO-024`, `BD-290`) — *"mandatory for internal profitability and warranty tracking."*

> **WAR-056 — Cost bearer takes four values: Trioloo · Supplier · Manufacturer · Customer** (`ICO-024`, `BD-290`).

**`BD-336`'s warranty routing names only three** — *Customer* is absent there because that answer concerns warranty-covered cases. **A customer bears cost only on a chargeable repair, which is outside warranty.** Consistent, not contradictory.

## 13.2 A repair never restates what the unit cost

> **WAR-057 — A repair records its own cost and never modifies the acquisition cost of the unit repaired** (`ICO-023`, `DB-003`, `INV-72.2`).

## 13.3 What the cost becomes is Accounting's

> **WAR-058 — This module records the cost and its bearer. What that posts to is owned by `ACCOUNTING_ARCHITECTURE.md`** (`ACC-000`, `WAR-000`).

⚠ **`BD-290` describes three accounting treatments following from one field** — Trioloo as an **expense** reducing realised margin, supplier or manufacturer as a **recoverable**, customer as **revenue**. **No `ACC-` rule presently states the posting for any of the three.** Recorded as a reconciliation point at §22; **no posting rule is written here, because posting is not this module's to define.**

---

# 14. Custody of customer property

## 14.1 A unit under repair is never inventory

> **WAR-059 — A customer's unit received for warranty or repair is never inventory** (`IVN-033`, `SYS-103`, `WHS §13.1`).

**The prohibition is absolute because the exposure is legal rather than accounting** — taking another party's property into inventory without transfer is **not an error that reverses** (`CP-8` irreversibility axis, `BD-360`). **`ICO-006` reinforces it structurally**: an item with no acquisition cost cannot enter inventory, and customer property has none.

## 14.2 The custody state lives here

> **WAR-060 — The custody state of a unit held for warranty or repair is carried by `E-072` Repair** (`WHS-069`, `DOC-058`, `IVN-033`).

**This is a ratified assignment made before this document existed** — `DOC-058` registers that *"the custody state belongs to the owning process, not to Warehouse and not to Inventory"*, and names `E-072` as that process. **Warehouse may physically hold the goods; the state that says Trioloo is holding someone else's property belongs to the repair.**

> **WAR-061 — Warehouse owns the physical holding; this module owns the custody state** (`WHS-069`, `WHS §13.3`). ⚠ **`WHS §13.3` records that no dedicated location type is established for such goods; none is invented here.**

## 14.3 ⚠ The loaner case is the inverse, and is open — `GAP-090`

> **WAR-062 — The business does not normally provide a loaner; where an exceptional temporary replacement is given, the arrangement is recorded** (`BD-335`).

**The exceptional case needs no new authority** — `BD-107` covers *"any exceptional business decision outside the normal operating process"*, an authorised decision recorded with its reason.

⚠ **`GAP-090` is carried.** A loaner is **stock physically absent but still owned** — the inverse of `BR-104`'s three present-but-not-sellable conditions. **The business stated that the arrangement is recorded, not what happens to the stock figure**, and an untracked loaner reads as missing stock at the next count (`BD-292`). **Low volume, real consequence. Nothing is inferred.**

---

# 15. Handback and completion

> **WAR-063 — A repaired unit returns to the customer by collection or delivery, and both are terminal routes** (`BD-333`, `BD-069`). `SM-15` carries `READY_FOR_COLLECTION` and `DELIVERED_TO_CUSTOMER`.

> **WAR-064 — Where handback is a shipment, the shipment is owned by `DELIVERY_ARCHITECTURE.md`** (`DLV-`, `WAR-000`). **This module records that the unit went back; it does not model the movement.**

> **WAR-065 — `DELIVERED` and `CLOSED` are separate in both machines** (`SMA-042`, `BD-331`, `BD-333`, `BR-141`). The case closes when the commercial position is settled, not when the goods move.

---

# 16. The customer's view

> **WAR-066 — Warranty records appear in the customer profile as history; the profile is owned by `CUSTOMER_ARCHITECTURE.md`** (`CUS-059`, `BD-029`). **This module owns the records; Customer owns their presentation as history.**

> **WAR-067 — A unit's warranty history spans two record types and needs both** (`BD-337`): the **warranty request history** (`E-071`, `BD-329`) and the **repair records with parts replaced** (`E-072`, `BD-290`). **Together they are what makes `WAR-046`'s current-configuration view computable at all.**

## 16.1 A replaced component may carry its own second timeline

> **WAR-068 — A replacement component does not create a new full product warranty; a separate limited service warranty may be defined by the Warranty Package** (`BD-337`, `PRD-136`, `INV-71.3`).

| Layer | Runs from | Applies to |
|---|---|---|
| **Original product warranty** | **Delivery date** | Each original component (`PRD-043`) |
| **Service warranty** *(optional, per package)* | **Replacement date** | A component fitted during repair |

**Eligibility is therefore per component *and* per installation event** (`PRD-136`). **It remains bounded because the service warranty is optional and limited** — the expensive version of this rule, a full warranty restart, was **explicitly declined** (`BD-337`).

---

# 17. Notification

> **WAR-069 — The business keeps the customer informed on significant status change or unexpected delay; message transport, templates and delivery evidence are owned by `NOTIFICATION_ARCHITECTURE.md`** (`BD-334`, `NOT-`).

**`BD-334` is the fourth notification requirement and the first that faces the customer** — the three before it are staff alerts (`BD-279`, `BD-320`, `BD-322`). **That is a materially different thing**: it needs a channel the customer uses, content fit to send, and a record of what was told to whom.

## 17.1 ⚠ The overdue requirement cannot be built as stated — `GAP-087`

> **WAR-070 — A warranty case running long is required to be highlighted, and no threshold exists to highlight it against** (`BD-334`, `GAP-087`, `GAP-024`).

*"Longer than expected"* presupposes an expectation. **None is given** — no target duration, no per-stage limit, no basis for calculating one. **Deriving one from historical averages would be inventing business policy** (`DM-001`, `DOC-024`).

> **WAR-071 — Any internal expectation could only meaningfully cover the stages Trioloo controls** (`BD-334`, `SMA-046`). **Three of the five duration factors are external** — supplier, service centre, manufacturer. **`WAITING_FOR_PARTS` is the sole internally-owned candidate; `SENT_TO_SUPPLIER` is not.**

> **WAR-072 — The absence of an outward completion date is a stated commercial position, not an omission** (`BD-334`): *"the business focuses on keeping the customer informed rather than promising a fixed completion date that cannot always be controlled."* **A future feature presenting an estimated completion date to a customer would run against a stated business position, not merely fill a gap.**

⚠ **`BD-324`'s foreclosure is refined, not contradicted** (`BD-334`, `PRD §32.1`): **where duration is wholly external no expectation exists and none can be invented; where Trioloo runs the process an expectation exists and the business has simply not stated it.**

## 17.2 ⚠ Which transitions are customer-significant is undefined

> **WAR-073 — Which of the thirteen repair stages warrant telling a customer is not stated and is not assumed** (`BD-334`, `PRD §32.5`, `DOC-030`).

---

# 18. Permissions and audit

> **WAR-074 — No role, authority level or scope dimension is created by this module** (`BD-107`, `PRM-`, `AGV-`). Resolution authority is the existing approval model; **`PERMISSION_ARCHITECTURE.md` and `ACCESS_GOVERNANCE_ARCHITECTURE.md` govern who may act.**

> **WAR-075 — The resolution, its reason, the cost bearer and the final cost responsibility are audited** (`AUD-042`, `INV-71.2`, `INV-71.4`, `AUD-`). **Audit record structure and retention are `AUDIT_ARCHITECTURE.md`'s.**

> **WAR-076 — Warranty and repair records are retained permanently; the standard retention period is a minimum operational guideline, never an automatic deletion policy** (`BD-338`, `BD-341`).

**`BD-338` dissolved the retention conflict rather than trading it off** — a claim in year 9 against a 12-year warranty would have found its evidence disposed of under a 5-year policy. **The premise was wrong: nothing is deleted, and no hard-delete business policy exists** (`BD-341`). This is why `WAR-016`'s sales-record proof still works a decade later.

---

# 19. Entities and machines referenced

**No entity is defined here and no machine is defined or ratified here.** `DOMAIN_MODEL.md` and `STATE_MACHINE_ARCHITECTURE.md` are canonical (`DOC-005`).

| Entity | ID | Relationship |
|---|---|---|
| **Warranty Request** | **`E-071`** | **Owned here** — the customer-facing case, `SM-13` |
| **Repair** | **`E-072`** | **Owned here** — the repair job, `SM-15`; carries the custody state (`WHS-069`) |
| Warranty Package | `E-070` | **Read, never defined** — versioned policy owned by `PRODUCT_ARCHITECTURE.md` |
| As-Built Record | `E-062` | **Read, never modified** — immutable build snapshot (`PRD-036`) |
| Marketplace Claim | `E-069` | A different direction of "claim" — `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| Attachment | `E-054` | Evidence reuses it; no new attachment concept |
| Exception | `E-056` | Referenced where a case raises one (`SYS-022`) |

| Machine | Entity | Status |
|---|---|---|
| **`SM-13`** Warranty Claim | `E-071` | ✅ **Ratified** — `SMA §21.1`. **Referenced here, not defined** |
| **`SM-15`** Repair | `E-072` | ✅ **Ratified** — `SMA §21.2`. **Referenced here, not defined** |
| `SM-11` QC | `E-049` | One entry point into `SM-15` is a `Repair Required` disposition (`RET-027`) |
| `SM-10` Refund | `E-045` | The refund branch delegates to it; execution is `PAYMENT_ARCHITECTURE.md`'s |
| `SM-12` Build Job | `E-065` | Build QC is its stage, not `SM-11` and not this module's (`SMA-045`) |

> **WAR-077 — Neither `SM-13` nor `SM-15` is re-ratified, re-scoped or extended by this document.** Their authority, state sets, transitions and terminal semantics are exactly as `SMA §21` records them.

---

# 20. Cross-document dependencies

| Direction | Document | What crosses |
|---|---|---|
| **Reads** | `PRODUCT_ARCHITECTURE.md` | `E-070` Warranty Package and its version; `E-062` As-Built Record; composite warranty (`PRD-043`) |
| **Reads** | `INVENTORY_ARCHITECTURE.md` | Parts availability; consumption is `IVN-028` |
| **Reads** | `INVENTORY_COSTING_ARCHITECTURE.md` | Component cost at WAC (`ICO-022`); repair cost discipline (`ICO-023`, `ICO-024`) |
| **Reads** | `CUSTOMER_ARCHITECTURE.md` | Customer identity and the sales relationship |
| **Reads** | `CHAT_ARCHITECTURE.md` | The conversation a request may arrive through (`BD-326`) |
| **Reads** | `ORDER_MANAGEMENT_ARCHITECTURE.md` | The sales record that proves eligibility; delivery date (`WAR-018`) |
| **Writes to** | `WAREHOUSE_ARCHITECTURE.md` | Custody state consumed by physical holding (`WHS-069`) |
| **Writes to** | `PROCUREMENT_ARCHITECTURE.md` | A part needed for a repair — ⚠ **unlisted trigger, `GAP-088`** |
| **Writes to** | `PAYMENT_ARCHITECTURE.md` | The refund branch, where taken |
| **Writes to** | `ACCOUNTING_ARCHITECTURE.md` | Repair cost and its bearer — ⚠ **posting unspecified, §22** |
| **Writes to** | `NOTIFICATION_ARCHITECTURE.md` | Customer status updates (`BD-334`) |
| **Writes to** | `DELIVERY_ARCHITECTURE.md` | Handback where it is a shipment |
| **Peer** | `RETURN_EXCHANGE_ARCHITECTURE.md` | `Repair Required` disposition enters `SM-15` (`RET-027`); **entitlement stays there, execution comes here** |
| **Governed by** | `STATE_MACHINE_ARCHITECTURE.md` · `DOMAIN_MODEL.md` · `SYSTEM_ARCHITECTURE.md` · `AUDIT_ARCHITECTURE.md` · `PERMISSION_ARCHITECTURE.md` · `ACCESS_GOVERNANCE_ARCHITECTURE.md` · `DESIGN_CONSTITUTION.md` | Definitions, invariants, boundaries, audit, authority, presentation |

---

# 21. Open gaps carried

**No gap is closed by this document existing** (`DOC-001`, `DOC-023`). Each below is carried exactly as recorded.

| Gap | Status | Why it is not closed here |
|---|---|---|
| **`GAP-087`** | 🔴 **STILL OPEN** | The overdue threshold is a **business decision**. `WAR-070` – `WAR-072` state the requirement, the obstacle and the only internally-owned candidate stage; **none of that supplies a number** |
| **`GAP-088`** | 🟡 **STILL OPEN** | A repair's part requirement is a purchase trigger `BD-293` does not list. **Recording the omission is not closing it**; the trigger list is the business's |
| **`GAP-089`** | 🟡 **STILL OPEN** | Current configuration is the composition of two records. **This module owns one of them, which does not make it the owner of the composition**; computed-on-demand versus maintained is undecided (`IVN §15.1`) |
| **`GAP-090`** | 🟢 **ACCEPTED EXPOSURE** | The business stated the arrangement is recorded, **not** what happens to the stock figure. Carried as recorded; **the inventory treatment is not invented** |
| **`GAP-026`** | 🟡 **STILL OPEN, and this domain is its sharpest instance** | `SM-13` and `SM-15` share **eight stage names**. `SMA-047` requires machine-qualified naming; **application is at implementation** |
| **`GAP-073`** | 🟢 **ACCEPTED EXPOSURE** | Same-model substitution is undetectable without serials. `WAR-003` separates eligibility from authentication, which **narrows the concern but does not remove the exposure** |
| **`GAP-096`** | 🟡 **STILL OPEN** | Whether the conversation link is a conversation attribute or the linked record's is recorded at `CHT-037` and **unchanged** |
| **`GAP-024`** | 🟡 **STILL OPEN** | State ageing thresholds generally; `GAP-087` is this domain's instance |
| `GAP-075` | ✅ **Already closed** | Closed at `BD-333` when `SM-15` was specified — **re-verified, not re-closed** |

---

# 22. Reconciliation points carried

**Recorded, not resolved.** Each is a real question no ratified source answers.

| # | Point | Where it sits |
|---|---|---|
| 1 | **Does a warranty-originated refund satisfy `PAY-049`?** `SM-10` *"is never standalone; it attaches to a return or an exchange"* (`BD-349`). **A warranty resolution of *Refunded* is neither.** `BD-332` left the routing to architecture; **`SMA §21.1` kept replacement inside `SM-13` but said nothing about refund** | `PAYMENT_ARCHITECTURE.md` · `STATE_MACHINE_ARCHITECTURE.md` |
| 2 | **Repair cost has three described accounting treatments and no posting rule.** `BD-290` names expense, recoverable and revenue; **no `ACC-` rule states any of them** | `ACCOUNTING_ARCHITECTURE.md` |
| 3 | **`CUS-059` and `RET-027` cite `PRODUCT_ARCHITECTURE.md` §32 as owning the warranty and repair lifecycles and repair execution.** §32 is a **reconciliation record of warranty *policy*** and contains no lifecycle or execution content — the citations were written when no owning module existed. **Corrected in both documents on 2026-08-09**; recorded here because the mis-citation is the defect this module was created to fix | `CUSTOMER_ARCHITECTURE.md` · `RETURN_EXCHANGE_ARCHITECTURE.md` |
| 4 | **No dedicated location type exists for held customer property** (`WHS §13.3`). Recorded there, unchanged | `WAREHOUSE_ARCHITECTURE.md` |
| 5 | **Whether warranty card issuance is recorded** is not stated (`BD-339`). Changes nothing either way | — |
| 6 | **Which repair transitions are customer-significant** is not stated (`BD-334`) | `NOTIFICATION_ARCHITECTURE.md` |
| 7 | ✅ **RESOLVED 2026-08-09.** `SM-13` and `SM-15` had no registered event; **`BUSINESS_DISCOVERY.md` §31 (`BD-426` – `BD-429`) established their cross-module reactions**, and `EVENT_ARCHITECTURE.md` §20 registers **`EVT-089` – `EVT-095`** — unit received, customer decision required, replacement authorised, supplier claim submitted, supplier claim outcome recorded, resolution decided, ready for handback. **`EVA-022` records the ten occurrences that deliberately publish nothing**, including repair QC (`SMA-045`). **No event is defined or owned here** (`DOC-005`) | `EVENT_ARCHITECTURE.md` |

---

# Appendix A — Rule traceability

**78 rules, `WAR-000` – `WAR-077`, contiguous.** Every rule traces to confirmed discovery or an already-ratified rule.

| Source | Rules |
|---|---|
| `BUSINESS_DISCOVERY.md` §21 (`BD-329` – `BD-341`) | `WAR-001`, `WAR-003` – `WAR-005`, `WAR-010` – `WAR-014`, `WAR-016` – `WAR-021`, `WAR-025`, `WAR-028`, `WAR-029`, `WAR-031`, `WAR-033`, `WAR-037`, `WAR-048` – `WAR-053`, `WAR-062`, `WAR-063`, `WAR-068` – `WAR-073`, `WAR-076` |
| `BUSINESS_DISCOVERY.md` §12 and prior (`BD-091` – `BD-097`, `BD-107`, `BD-289`, `BD-290`, `BD-293`) | `WAR-029`, `WAR-030`, `WAR-035`, `WAR-038`, `WAR-047`, `WAR-050`, `WAR-055`, `WAR-056`, `WAR-062`, `WAR-074` |
| `STATE_MACHINE_ARCHITECTURE.md` §21 (`SMA-039` – `SMA-047`) | `WAR-002`, `WAR-007`, `WAR-012`, `WAR-020`, `WAR-024`, `WAR-026`, `WAR-027`, `WAR-032`, `WAR-034` – `WAR-036`, `WAR-040` – `WAR-042`, `WAR-065`, `WAR-077` |
| `DOMAIN_MODEL.md` (`E-070` – `E-072`, `INV-70.*`, `INV-71.*`, `INV-72.*`) | `WAR-005`, `WAR-006`, `WAR-008`, `WAR-009`, `WAR-023`, `WAR-031`, `WAR-036`, `WAR-045`, `WAR-052` |
| `PRODUCT_ARCHITECTURE.md` §32 (`PRD-132` – `PRD-136`) | `WAR-001`, `WAR-003`, `WAR-019`, `WAR-022`, `WAR-023`, `WAR-053`, `WAR-054`, `WAR-068` |
| `INVENTORY_*` (`IVN-028`, `IVN-033`, `ICO-022` – `ICO-024`) | `WAR-043`, `WAR-044`, `WAR-055`, `WAR-057`, `WAR-059` |
| `WAREHOUSE_ARCHITECTURE.md` (`WHS-019`, `WHS-069`, `DOC-058`) | `WAR-041`, `WAR-042`, `WAR-060`, `WAR-061` |
| `RETURN_EXCHANGE_ARCHITECTURE.md` (`RET-027`) · `CUSTOMER_ARCHITECTURE.md` (`CUS-059`, `CUS-060`) | `WAR-014`, `WAR-035`, `WAR-066` |
| Boundary and governance (`DOC-005`, `DOC-006`, `ACC-000`, `SYS-016`, `SYS-103`, `CP-8`, `CP-9`, `DB-003`) | `WAR-000`, `WAR-009`, `WAR-058`, `WAR-064`, `WAR-067`, `WAR-075` |

**Introduced by this document: nothing.** No business rule, entity, state machine, lifecycle, threshold, tolerance, policy, role or automation.

# Appendix B — Amendment Record

| Version | Date | Change |
|---|---|---|
| **1.1.0** | **2026-08-09** | **`WAR-035` amended — `SM-15` has four entry points, not three.** A **Trade-In component classified `REPAIR_REQUIRED`** is registered as the fourth (`BD-389`, `SMA-072`, `SMA-044` as amended). **This is a stale enumeration corrected, not a business decision**: `SMA-072` always stated that `REPAIR_REQUIRED` delegates to `SM-15`, and `SMA-044`'s three-entry list simply predated the Trade-In reconciliation in its own document. **`SM-15` is unchanged** — states, transitions, terminals and authority all identical — **no machine is ratified here** (`WAR-077`), and **no event was created.** The corresponding reconciliation point is closed |
| **1.0.2** | **2026-08-09** | **Reconciliation point 7 RESOLVED — no rule changed.** `SM-13` and `SM-15` now have registered events: **`EVT-089` – `EVT-095`** in `EVENT_ARCHITECTURE.md` §20, justified by `BUSINESS_DISCOVERY.md` §31 (`BD-426` – `BD-429`). **No event is defined, named or owned by this document** (`DOC-005`) — the register is canonical. **The module's rules are untouched**: nothing was added, amended or withdrawn, and `WAR-000` – `WAR-077` stand exactly as ratified. **The eight remaining open gaps and the other six reconciliation points are unchanged**, including the `PAY-049` refund conflict, which **no event resolves or routes around** |
| **1.0.1** | **2026-08-09** | **Reconciliation point 7 updated — no rule changed.** `EVENT_ARCHITECTURE.md` §19 now records machine-by-machine event coverage: **`SM-13` and `SM-15` have no registered event and no canonical evidence that one exists** (`EVA-020`), while **`SM-15`'s inventory effect is already covered** by `EVT-041 Inventory.Deducted` (`IVN-028`). **The point is carried, not resolved** — specifying those events is an authoring act |
| **1.0.0** | **2026-08-09** | **Initial ratification — closes the Warranty & Repair registration defect.** Consolidates `BUSINESS_DISCOVERY.md` §21 (`BD-329` – `BD-341`) and §12 (`BD-091` – `BD-097`) with the reconciliations at `SMA §21`, `PRODUCT_ARCHITECTURE.md` §32 and `DOMAIN_MODEL.md` `E-070` – `E-072`. **78 rules (`WAR-000` – `WAR-077`), all traceable; no business rule, entity, state machine, lifecycle or threshold introduced.** **`E-071` and `E-072` now have a registered owning module**; before this document their `DOMAIN_MODEL.md` ownership line named a module that appeared in no register, held no prefix and had no document — **the same defect class as the Chat finding and `GAP-083`, and the larger of the two remaining instances.** **`WAR-060` consolidates a ratified assignment made before this document existed** — `DOC-058` and `WHS-069` already placed the custody state on `E-072`. **`SM-13` and `SM-15` are referenced and neither is re-ratified** (`WAR-077`). **Eight gaps carried, none closed**; `GAP-075` re-verified as already closed. **Seven reconciliation points recorded**, including a genuine contradiction: `CUS-059` and `RET-027` cited `PRODUCT_ARCHITECTURE.md` §32 as owning the warranty and repair lifecycles, which it does not — corrected in both on the same date |

---

*This document specifies warranty and repair business architecture only. It contains no UI specification, database design, SQL, API contract, or code.*
