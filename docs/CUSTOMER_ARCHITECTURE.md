# Customer Architecture

**Owner:** Trioloo Technology · **Module:** Customer · **Status:** Canonical
**Version:** 1.1.0 · **Ratified:** 2026-08-08 · **Rule prefix:** `CUS-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §4 Customer Types (`BD-025` – `BD-031`), §3 Order Sources (`BD-023`, `BD-024`) and **§30 Customer Identity, Credit and Blacklist** (`BD-173`, `BD-169`, `BD-424`), with §22 (`BD-351`) and §23 (`BD-357`).

**Reconciliation records consolidated:** [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-023`, `E-024` · [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) §7 (`BR-039`, `BR-140`) · [`CHAT_ARCHITECTURE.md`](CHAT_ARCHITECTURE.md) §5 (`CHT-010` – `CHT-016`, `DOC-060`).

**References, never duplicated:** [`CHAT_ARCHITECTURE.md`](CHAT_ARCHITECTURE.md) `CHT-` · [`DELIVERY_ARCHITECTURE.md`](DELIVERY_ARCHITECTURE.md) `DLV-` · [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) `PAY-` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) `PRD-` · [`API_ARCHITECTURE.md`](API_ARCHITECTURE.md) `API-` · [`REPORTING_ARCHITECTURE.md`](REPORTING_ARCHITECTURE.md) `RPT-` · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) `AGV-` · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **CUS-000 — This document answers *who the customer is, what the business knows about them, and what standing they hold*. It answers nothing about what they said, what they bought, what they owe, or where their goods went.**

| Question | Owner |
|---|---|
| **Who the customer is · what is known about them · what standing they hold** | **`CUSTOMER_ARCHITECTURE.md`** — `CUS-` |
| **What was communicated, on which channel — and `E-075` Channel Identity** | [`CHAT_ARCHITECTURE.md`](CHAT_ARCHITECTURE.md) — `CHT-` (`DOC-060`) |
| What they ordered, and the order lifecycle | `ORDER_MANAGEMENT_ARCHITECTURE.md` — `BR-` |
| **What they owe and whether it arrived** | `PAYMENT_ARCHITECTURE.md` — `PAY-` |
| **Every posting, and every customer-associated balance** | `ACCOUNTING_ARCHITECTURE.md` — `ACC-` |
| Where goods went, and who collected them | `DELIVERY_ARCHITECTURE.md` — `DLV-` |
| Return, exchange and warranty entitlement | `RETURN_EXCHANGE_ARCHITECTURE.md`, [`WARRANTY_REPAIR_ARCHITECTURE.md`](WARRANTY_REPAIR_ARCHITECTURE.md) |
| Who may read or change a customer record | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine, lifecycle, threshold, segmentation, tier, score, consent model or automation is introduced. **No gap or reconciliation point is resolved by assumption** — see §25.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To hold what the business knows about the people it sells to — **in a business where the buyer is frequently owned by someone else.**

Two facts shape the whole domain:

> **On a marketplace channel the customer belongs to the marketplace** (`INV-23.1`, `SYS-010`), yet **every marketplace order still produces a Customer Profile in the ERP** (`BD-173`), because the business needs its customers traceable for future order and history tracking.

> **You do not need to know who someone is in order to serve them** (`CHT-010`, `BD-357`). A **Channel Identity** always exists; a **Customer** may not. **Customer identity is a bonus that arrives with an order.**

**The module is therefore small and precise.** It owns two entities, no lifecycle of its own, and no financial figure — and its most important rules are the ones that stop it absorbing things it does not own.

---

# 2. Scope

## 2.1 In scope

Customer types · the Customer Profile and its confirmed contents · phone as the primary lookup key · profile creation through business transactions · marketplace Customer creation · Customer Address · customer history as decision support · the **Credit Limit** and its release behaviour · the **Blacklist** and its release behaviour · erasure and redaction · the boundary with Channel Identity.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **`E-075` Channel Identity, Conversations, Internal Notes** | `CHAT_ARCHITECTURE.md` (`DOC-060`, `CHT-010` – `CHT-016`) |
| **Order lifecycle, verification workflow, release authority** | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| **Receivables, collection, settlement, refunds** | `PAYMENT_ARCHITECTURE.md` (`PAY-000`) |
| **Every posting; Trade-In Credit as a liability; advances** | `ACCOUNTING_ARCHITECTURE.md` (`ACC-011`, `ACC-039`, `ACC-040`) |
| **Delivery address use, marketplace-assigned destinations, self-pickup handover** | `DELIVERY_ARCHITECTURE.md` |
| **Return, exchange and refund entitlement; return history policy** | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| **Warranty and repair lifecycles** | [`WARRANTY_REPAIR_ARCHITECTURE.md`](WARRANTY_REPAIR_ARCHITECTURE.md) `WAR-`, `SM-13`, `SM-15` |
| **Pricing, price lists, promotional pricing** | `PRODUCT_ARCHITECTURE.md`, `GAP-015` |
| **Marketplace buyer authority, adapters, sync** | `API_ARCHITECTURE.md`, `SYS-010` |
| **Authorisation, scope, sensitive-data classes, operational identity** | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| **Audit structure, evidence packages, retention and disposal authority** | `AUDIT_ARCHITECTURE.md`, `SYS-101` |
| Which reports exist; any figure shown | `REPORTING_ARCHITECTURE.md`, `DB-067` |
| Screen layout and presentation | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

## 2.3 Explicitly not built

> **CUS-001 — No customer segmentation, loyalty scheme, marketing consent model, KYC process, credit scoring, customer group, tier, CRM automation or public signup exists in the confirmed set, and none is specified here** (`DM-001`, `DOC-024`, `CP-9`).

**Three of these are stated negatives rather than mere absences:** `BD-351` and `BR-140` establish **no customer scoring**; `BD-424` establishes blacklisting as a **judged marker, not a computed one**; and `AGV-011` closed `PRMU-6` — **customer self-service access to the ERP is not in scope.**

---

# 3. Architectural Principles

## 3.1 P1 — A profile is created by doing business, never by signing up

> **CUS-002 — Customer records come into existence through operational transactions. There is no public ERP registration** (`BD-023`, `BD-029`, `BD-173`, `AGV-011`).

**`BD-370` and `AGV-011` establish the ERP as a closed system with administratively created accounts; `PRMU-6` closed as *not in scope*.** A customer never holds a login.

## 3.2 P2 — Relate, never collapse

> **CUS-003 — Identities that may belong to one person are linked, never merged, and both records are preserved** (`CHT-013`, `CHT-014`, `INV-75.3`, `BD-357`).

**`SYS §21` records this as one principle appearing four times** across marketplace decisions, mirrored data, channel identity and conversations.

## 3.3 P3 — History informs; it never decides

> **CUS-004 — Customer history is decision support. No score, tier or automatic approval or refusal is derived from it** (`BD-351`, `BR-140`, `RET §7.4`).

## 3.4 P4 — A marker warns and gates; it never blocks unconditionally

> **CUS-005 — Where a customer carries a standing marker that bears on a release, the ERP warns before release and permits the release to continue only with authorised approval. The approval never mutates the marker** (`BD-169`, `BD-424`).

**Two independently-asked questions produced the same seven-part shape** — see §9.3. **This is authority-gated, not judgement-deferred:** *"normal staff must not bypass the blacklist warning without the required approval"* (`BD-424`) is `PRM-004` and `PRM-008`, and it sits on `CP-8`'s refined axis (`BD-360`) because releasing goods on COD to a known-bad customer is not an error that reverses.

## 3.5 P5 — The commitment is snapshotted; the profile keeps moving

> **CUS-006 — Values participating in a commercial commitment are captured onto the order and never refreshed from the profile** (`INV-23.2`, `DB-023`, `SYS-017`).

## 3.6 P6 — Every change is attributable

> **CUS-007 — Every profile creation, amendment, credit-limit change, blacklist change and redaction is attributable to an Operational User Profile** (`AGV-001`, `AUD-004`, `PRM-005`).

---

# 4. Customer Types

> **CUS-008 — Three customer types are confirmed** (`BD-025`): **Individual (B2C) · Corporate (B2B) · Reseller.**

> **CUS-009 — Treatment differs by type, and every difference is case-by-case rather than schedule-driven** (`BD-026`).

| Type | Confirmed treatment |
|---|---|
| **Individual (B2C)** | Standard pricing. **No credit or installment facility by default**; any exception requires authorised approval (`BD-028`) |
| **Corporate (B2B)** | Pricing may differ; **may be offered credit payment terms subject to business approval** (`BD-026`, `BD-028`) |
| **Reseller** | Pricing may differ; **no separate credit terms and no mandatory purchase-order requirement**; handled by the normal sales process unless a specific arrangement is made (`BD-026`) |

> **CUS-010 — Standard B2C pricing may also be used for corporate customers and resellers where appropriate** (`BD-026`). **Type does not compel a price.**

> **CUS-011 — Pricing itself is owned by `PRODUCT_ARCHITECTURE.md`** (`SYS §5.4`). ⚠ **`GAP-015` records that pricing and promotional policy are undocumented**, including channel and promotional pricing. **Carried.**

⚠ **How a customer's type is determined is not established** — particularly on a marketplace order where the business may never have dealt with the buyer. **`BD-167` is queued and unanswered; no determination rule is specified here** (`DM-001`).

## 4.1 The verification queue and customer type

> **CUS-012 — The Pending Verification queue contains all newly created orders requiring verification regardless of type, and may be filtered by customer type** (`BD-027`).

⚠ **`BD-027` records a documentation conflict that remains live.** The binding reference image `design-reference/02-orders-list.png` shows a **`B2C Pending`** tab, and `DESIGN_CONSTITUTION.md` **RULE 0.1 freezes the orders-list tab bar**. `BD-027` states the tab *"will be replaced by Pending Verification"* in the new ERP. **Recorded at the time as a fact about the documentation, not a change** — and **carried here unchanged**; no design or architecture decision is made (`SYS-047`, `RULE 0.1`).

⚠ **What *"B2C Pending"* meant in the legacy system is unstated, and matters for migration** — `BD-170` queued and unanswered, under `GAP-070`.

---

# 5. The Customer Profile

> **CUS-013 — `E-023` Customer is the party who buys, and each customer has a dedicated profile** (`E-023`, `BD-029`).

> **CUS-014 — The profile holds the information the business confirmed and no more** (`BD-029`): **name · phone number · addresses · order history · payment history · warranty records · notes**, and other related information available.

**`E-023`'s ratified attribute list adds:** customer type · **ownership flag** (Trioloo-owned vs marketplace-owned) · **blacklist flag** · **credit limit and terms** · history references.

> **CUS-015 — `E-023` carries the master record lifecycle, not a state machine of its own** (`E-023`, `SYS §7.1`): `DRAFT → ACTIVE → SUSPENDED → ARCHIVED`. **No `SM-` machine exists for Customer and none is introduced** (`DOC-024`).

> **CUS-016 — A customer referenced by any historical transaction is archived, never deleted** (`SYS-024`, `DB-028`, `BD-338`).

⚠ **`E-023`'s *"ownership flag"* is an attribute no confirmed answer defines.** Whether it is stored or derived from the channel is **not stated and not inferred.** Carried — §25.

## 5.1 Primary lookup

> **CUS-017 — The phone number is the primary customer lookup key** (`BD-023`, `BD-029`, closing `BD-162`).

> **CUS-018 — On manual order entry, entering an existing customer's phone number retrieves the saved profile, and the Sales user may reuse or update the information before creating the order** (`BD-023`, `BD-029`).

**Manual entry applies to Facebook, WhatsApp, phone, walk-in, corporate orders, courier re-entry and marketplace sync failures** (`BD-023`). ⚠ **What *"courier re-entry"* is remains unstated** — `BD-165` queued and unanswered.

> **CUS-019 — Updating a profile never rewrites a historical order** (`CUS-006`, `INV-23.2`, `DB-023`). **Customer name and contact are snapshotted onto the order so invoices remain reproducible years later**, and the profile continues changing independently.

---

# 6. Marketplace Customer Creation

> **CUS-020 — Every marketplace order produces or has a Customer Profile in the ERP. Marketplace customers are never kept as Channel Identity alone** (`BD-173`).

> **CUS-021 — The stated purpose is future traceability** — *"so that the customer's order and activity can be tracked from the ERP"* (`BD-173`).

> **CUS-022 — Customer Profile creation and cross-channel identity merging are two different things** (`BD-173`). **Creating a profile is not linking; linking is not merging.**

| Confirmed | |
|---|---|
| **Marketplace Order → Customer Profile** | **YES** |
| **Marketplace Identity → Automatic Cross-Channel Merge** | **NO** |

> **CUS-023 — Marketplace-supplied customer information is recorded onto the profile, and the marketplace/channel identity is preserved as a separate record** (`BD-173`, `CHT-013`).

> **CUS-024 — Marketplace order information may be incorrect, incomplete or outdated, which is why every marketplace order is verified** (`BD-024`). Common issues include an incorrect or incomplete delivery address and an incorrect or unreachable phone number.

> **CUS-025 — The business contacts marketplace customers directly by phone for legitimate order-related purposes** — order verification, delivery coordination, and resolving customer issues (`BD-030`).

⚠ **`BD-030` records a documentation mismatch that remains live.** `OM §3.4` describes direct customer contact on marketplace channels as *"only within marketplace policy; often prohibited"*, and `OM §7.8` assumes marketplace orders are auto-confirmed **without** customer contact. **Recorded at the time as a fact about the documentation, not a change** — and **carried here unchanged.**

**`CHT-014` records the constructive consequence:** because verification produces a **verified phone number**, and phone is the lookup key, **the verification step performed for an entirely different reason is what makes identity linking possible.**

---

# 7. The Channel Identity Boundary

> **CUS-026 — `E-075` Channel Identity is owned by `CHAT_ARCHITECTURE.md` and is referenced here, never redefined** (`DOC-060`, `DOC-005`, `CHT-010`).

| Layer | Owner | Always exists? |
|---|---|---|
| **Channel Identity** — shop + channel-side username | **Chat** (`CHT-010`) | **Yes** |
| **Customer Profile** | **Customer** — this document | **No** — may be unknown before an order |

> **CUS-027 — A marketplace username alone is not a verified customer identity** (`CHT-011`, `INV-75.1`, `BD-357`).

> **CUS-028 — Linking a Channel Identity to a Customer never merges them; both are preserved** (`CHT-013`, `INV-75.3`).

> **CUS-029 — Cross-channel identities are never merged automatically. Reliable matching evidence is required: phone number · email address · order information · explicit customer confirmation** (`CHT-014`, `INV-75.4`, `BD-357`).

> **CUS-030 — Channel Identity is scoped to its issuing shop, not to the marketplace globally** (`CHT-012`, `INV-75.2`, `DB-013`). **Customer does not re-scope it.**

> **CUS-031 — Cross-channel matching assists staff and must never automatically merge uncertain identities** (`CHT-015`, `BD-357`). *"An unmatched identity costs convenience; a wrongly matched one costs trust."*

## 7.1 ⚠ The `INV-23.1` reconciliation point — carried unchanged

**`INV-23.1` states that on marketplace channels the customer belongs to the marketplace and Trioloo's record is *"a mirror, never locally edited"*** (`SYS-010`, `BR-003`). **`BD-173` establishes a Customer Profile that Trioloo creates and uses to accumulate future order and activity history.**

**A reading exists under which Channel Identity is the externally-owned mirror and the Customer Profile is Trioloo's own record.**

> **CUS-032 — No canonical source states that reading, and this document does not assert it** (`CHT-016`, `DM-001`, `DOC-023`).

**`E-075` is defined as *a channel-scoped customer identity*; `INV-75.2` cites `DB-013` — identifier storage, not mirror authority; and `INV-23.1` attaches the ownership flag to `E-023`.** **`CHT-016` already declined to assert it, and Customer declines it a second time.** **Recorded for `DOMAIN_MODEL.md`.**

---

# 8. Customer Address

> **CUS-033 — `E-024` Customer Address is a place goods are delivered to, and determines deliverability, courier coverage and delivery success** (`E-024`).

**Confirmed attributes** (`E-024`): recipient · address lines · area and district · landmark · contact number · **address type** · courier serviceability · delivery instructions. **Two address types are established:** residential/office and **marketplace collection point**.

> **CUS-034 — The delivery address is snapshotted at dispatch** (`INV-24.2`, `DB-023`).

> **CUS-035 — Addresses support Bengali script** (`INV-24.3`, `DB-043`).

> **CUS-036 — On a marketplace order the delivery destination may be assigned by the marketplace and is mirrored exactly as provided** (`DLV-010`, `BD-213`, `SYS-010`). **Trioloo does not choose it, and does not operate collection points as its own delivery method** (`DLV-011`).

> **CUS-037 — Address use at delivery is owned by `DELIVERY_ARCHITECTURE.md`** (`DLV-023`, `DLV-036`).

⚠ **No rule establishes address multiplicity, a default address, or address verification.** `BD-029` records that the profile stores *"addresses"* in the plural; **nothing further is confirmed, and nothing is invented** (`DM-001`).

⚠ **`INV-24.1` carries `BR-026`** — collection-point delivery completes Trioloo's obligation at the point. **`DLV §4.1` records that `BR-026`'s current application is in question after `BD-213`.** Carried, not resolved.

---

# 9. Customer Standing

## 9.1 History

> **CUS-038 — Customer history is decision support and produces no score, tier or automatic outcome** (`BD-351`, `BR-140`, `RET §7.4`).

> **CUS-039 — Repeat customers exist and may receive different pricing, priority service or other benefits, decided case by case and possibly requiring business approval** (`BD-031`).

⚠ **Whether repeat status is recorded as a flag or judged from history at the time is unstated** — `BD-174` queued and unanswered. **No tier or flag is specified.**

## 9.2 Credit position

> **CUS-040 — Approved Corporate/B2B customers may have a defined Credit Limit** (`BD-169`, `BD-026`).

> **CUS-041 — The Credit Limit is not permanently fixed. It is editable by an authorised person when the business decides the customer's approved credit exposure should change** (`BD-169`).

> **CUS-042 — Credit exposure is checked at order release, not at order capture** (`BR-039`, `INV-23.3`, `BD-169`).

> **CUS-043 — Where an order would exceed the currently approved Credit Limit, the ERP identifies the breach and the responsible user is notified or warned before release** (`BD-169`).

> **CUS-044 — Exceeding the Credit Limit does not create an unconditional permanent block. The order may continue to release only with authorised approval** (`BD-169`).

> **CUS-045 — An approval is an exception to the current limit for that release, and must not silently change the customer's stored Credit Limit. Changing the standing limit is a separate authorised action** (`BD-169`).

**Same discipline as `AGV-024`** — an override may control *whether* an action happens and may never carry a magnitude.

> **CUS-046 — Credit and installment facilities are available to selected approved customers, primarily approved corporate customers or others authorised by the business. Regular B2C customers receive neither by default, and any exception requires authorised approval** (`BD-028`).

⚠ **Who may approve a credit exception is not stated.** `BD-107` – `BD-113` established Owner/Administrator or a permissioned user with **no approval hierarchy** (`PRM-048`, `PRM-049`), so the standing-authority model applies — **but `BD-169` names no approver, and none is inferred.**

⚠ **No credit formula, exposure calculation or scoring model is confirmed, and none is specified** (`DM-001`).

⚠ **`PRMU-8` is carried** — whether `PRM-008`'s **per-actor** authority bounds are enforced numbers is unresolved. `CUS-040` establishes a **customer-level** limit and says nothing about how much any approver may authorise.

## 9.3 Blacklist

> **CUS-047 — The ERP may mark a customer as Blacklisted or Blocked when the business identifies a serious customer-related risk or problem** (`BD-424`).

> **CUS-048 — A blacklisted customer is not prevented from creating or generating a new order, and the order must still enter the ERP** (`BD-424`).

> **CUS-049 — The ERP must clearly warn staff that the customer is blacklisted, and the warning must be visible before the order is allowed to continue through release** (`BD-424`).

> **CUS-050 — The blacklist does not create an unconditional hard block. Release may continue only with authorised approval, and normal staff must not bypass the warning without it** (`BD-424`).

> **CUS-051 — Approval for a particular order does not remove the customer's blacklisted status. Removing or changing that status is a separate authorised action** (`BD-424`).

⚠ **The grounds for blacklisting beyond *"a serious customer-related risk or problem"* are not stated, and who may set or remove the status beyond *"a separate authorised action"* is not stated. Neither is inferred** (`DM-001`, `DOC-024`).

## 9.4 The two markers share one mechanism

> **CUS-052 — Credit Limit and Blacklist use the same seven-part warn-then-authorise mechanism, reached independently in two unrelated answers** (`BD-169`, `BD-424`).

| | Credit Limit | Blacklist |
|---|---|---|
| A marker on the customer | ✅ | ✅ |
| Order still enters the ERP | ✅ | ✅ |
| Warning before release | ✅ | ✅ |
| Unconditional hard block | ❌ | ❌ |
| Release only with authorised approval | ✅ | ✅ |
| **Approval does not mutate the customer record** | ✅ | ✅ |
| Changing the marker is a separate authorised act | ✅ | ✅ |

> **CUS-053 — Both are enforced at release through `Order:ON_HOLD`, whose ratified diagram already carries `CONFIRMED → ON_HOLD: stock or credit issue`** (`SM-1`, `BD-169`). **No new state and no new machine is required.**

⚠ **`GAP-018` is carried** — `ON_HOLD` has no documented entry or exit rules: *"nothing specifies who may place a hold, valid hold reasons, maximum duration, escalation on ageing, or whether a hold releases inventory reservations."*

## 9.5 ⚠ Blacklist reach across unlinked identities — an exposure

**The blacklist attaches to the Customer Profile.** `CUS-029` and `INV-75.4` forbid assuming two channel identities are the same person without reliable evidence.

> **CUS-054 — A blacklisted customer reappearing under a different channel identity is not detected unless the identities are linked. Person-versus-phone-number reach was not addressed by `BD-424` and is not inferred.**

**Recorded as an accepted exposure in the way `GAP-073` records component-substitution on non-serialized PCs** — the business stated the mechanism, not its reach. **No detection rule is invented.**

⚠ **Whether blacklist status affects returns is unanswered** — `BD-425` queued. **`RET §7.4` states there is no permanent refusal list and no automatic blocking for returns; `CUS-047` is order-side. The order blacklist is not extended into returns here** (`DOC-050`).

---

# 10. Relationships

## 10.1 Orders

> **CUS-055 — The order references the customer, and name and contact are snapshotted onto it** (`INV-23.2`, `DB-023`).

> **CUS-056 — Credit and blacklist checks occur at release** (`CUS-042`, `CUS-049`, `BR-039`). **Order lifecycle and release authority are `ORDER_MANAGEMENT_ARCHITECTURE.md`'s** (`BR-081`).

## 10.2 Delivery and Self Pickup

> **CUS-057 — The collector need not be the customer of record** (`DLV-104`, `BD-212`). Collection is permitted where the representative provides correct order information and the business is satisfied they are collecting on the customer's behalf.

> **CUS-058 — The Customer Profile does not become the handover identity record.** Handover verification, the signed copy and self-pickup execution are owned by `DELIVERY_ARCHITECTURE.md` (`DLV-100` – `DLV-103`) and `WAREHOUSE_ARCHITECTURE.md`.

**`CHT-014`'s evidence discipline and `DLV-104`'s permissiveness are consistent**, and `BD-402` explains why: **the system enforces where identity is deterministic and defers where it must infer** — identity at a counter is inferred.

## 10.3 Warranty

> **CUS-059 — Warranty records appear in the customer profile as history** (`BD-029`). **The warranty and repair lifecycles are owned elsewhere** — [`WARRANTY_REPAIR_ARCHITECTURE.md`](WARRANTY_REPAIR_ARCHITECTURE.md) `WAR-`, `SM-13`, `SM-15`.
>
> *Corrected 2026-08-09. This rule previously cited `PRODUCT_ARCHITECTURE.md` §32, which is a reconciliation of warranty **policy** and holds no lifecycle content; it was cited because no owning module was registered at the time (`DOC-062`). **`CUS-059`'s substance is unchanged** — the lifecycles are owned elsewhere, and now the pointer resolves.*

> **CUS-060 — Warranty intake channel is independent of the order channel** (`BD-329`). Customer does not constrain it.

## 10.4 Return and Exchange

> **CUS-061 — Customer return history is decision support; there is no return scoring, no blacklist, no permanent refusal list and no automatic blocking in the return domain** (`RET §7.4`, `BR-140`, `BD-351`).

⚠ **`GAP-091` is carried** — *"unusually frequent returns"* has no threshold, and **the value is the business's to set** (`RET §21`).

## 10.5 Trade-In

> **CUS-062 — A customer may hold Trade-In Credit, and it is customer-associated information referenced here, never owned here** (`ACC-039`, `ACC-040`).

**`ACC-039` makes it a payment source, never a product discount; `ACC-040` makes it a non-cash liability that discharges only through a sale, not redeemable for cash.** ⚠ **`ACC-040` records that unexpiring credit accumulates and must be reportable as a standing liability** — **an Accounting obligation, not a Customer one.**

## 10.6 Payment and receivables

> **CUS-063 — Customer owns no receivable and no posting** (`PAY-000`, `ACC-011`, `DB-067`).

> **CUS-064 — On a marketplace order the receivable counterparty is a specific seller account, not the customer** (`PAY-016`, `BR-119`, `BR-128`).

> **CUS-065 — No customer ledger is required, and the asymmetry with suppliers is justified rather than an oversight** (`SYS-090`, `BD-314`). At approximately 100% COD customers rarely carry a running balance, and **`BD-311` located genuine customer receivables in the B2B credit and installment population only.**

⚠ **`GAP-072` is carried** — installment sales are confirmed (`BD-028`) and **modelled nowhere**: no entity, no state machine, no receivable schedule. **Installment mechanics remain with Payment; none is specified here.** `BD-171` and `BD-172` are queued and unanswered.

## 10.7 Chat

> **CUS-066 — Conversations, Channel Identity and Internal Notes are Chat-owned. Customer references linked communication and owns none of it** (`DOC-060`, `CHT-008`).

⚠ **`GAP-096` is carried** — whether a conversation links to lifecycles directly or through the Business Case is undecided, and **`CHT-037` records both forms without choosing.**

## 10.8 API and marketplace identity

> **CUS-067 — Where an external party is the system of record for buyer identity, Trioloo's copy is mirrored and never locally edited** (`SYS-010`, `BR-003`, `INV-23.1`), **subject to the reconciliation point at `CUS-032`.**

> **CUS-068 — Adapter capability, sync, idempotency and provenance are owned by `API_ARCHITECTURE.md`** (`API-004`, `API-024`, `API-029`).

---

# 11. Permission, Scope, Sensitive Data and Audit

| Requirement | Rule |
|---|---|
| **Every profile change attributable** | `CUS-007`, `AGV-001`, `AUD-004` |
| **Credit-limit and blacklist changes are separate authorised actions** | `CUS-045`, `CUS-051` |
| **Release overrides recorded, and never mutating the marker** | `CUS-044`, `CUS-050`, `AGV-024` |
| **Master-data change history with before and after values** | `DB-068`, `SYS §5.7` — a credit limit is a commercially significant field |
| **Customer records archived, never deleted** | `CUS-016`, `SYS-024` |

> **CUS-069 — Customer data visibility is bounded by Roles, Permissions and Scope Assignments, enforced on read and on write** (`PRM-009`, `SYS-020`, `AGV-020`).

> **CUS-070 — Sensitive data classes are separately grantable, independently of record access** (`PRM-011`). **Cost and margin are named classes**; a customer record is otherwise widely readable, which is the reasoning `AGV-012` applies to salary.

⚠ **`BD-377` records that most users currently work across all channels** — the scope model is **designed for growth and deliberately not enforced today** (`PRM-051`, `AGV §10.3`).

---

# 12. Erasure and Redaction

> **CUS-071 — Where personal data must be removed but the transaction must be retained, the transaction is retained with the personal data redacted, never deleted** (`DB-057`, `INV-23.4`).

**`DB-057`'s reasoning is explicit:** *a right-to-erasure request cannot be allowed to destroy financial history. The reconciling approach is to sever the personal identity while preserving the transaction, its amounts, and its audit trail.*

> **CUS-072 — Audit records outlive the records they describe** (`DB-054`). Redacting a customer never removes the evidence that the customer existed and was redacted.

> **CUS-073 — Retention is governed by the longest obligation attached to the record** (`DB-052`, `SYS-044`). ⚠ **`BD-144` is carried** — retention against a 12-year warranty obligation.

⚠ **No jurisdiction-specific erasure obligation is confirmed.** `SYS U-3` records the statutory retention floor as unknown; `BD-008` gives five years as a **business preference, not a statutory finding.** **Nothing is inferred.**

---

# 13. Entity and State Machine References

| Entity | ID | Owner |
|---|---|---|
| **Customer** | **`E-023`** | **Customer** — this document |
| **Customer Address** | **`E-024`** | **Customer** |
| Channel Identity | `E-075` | **Chat** (`DOC-060`) |
| Conversation · Internal Note | `E-074` · `E-076` | **Chat** |
| Order · Order Item | `E-031` · `E-032` | Order Management |
| Receivable | `E-040` | Payment |
| Trade-In Credit | `E-083` | Accounting |
| Business Case | `E-073` | Data: System · Documentation: Return & Exchange |

**No entity is defined here.** `DOMAIN_MODEL.md` is canonical (`DOC-005`).

> **CUS-074 — Customer has no state machine. `E-023` carries the master record lifecycle of `SYS §7.1`, and none is invented** (`DOC-024`).

**Machines observed but not owned:** `SM-1` Order — `ON_HOLD` carries the credit and blacklist gates (`CUS-053`); `SM-16` Conversation — Chat's.

---

# 14. Cross-Domain Dependencies

| Domain | Interface |
|---|---|
| **Chat** | Channel Identity linking, under `CHT-010` – `CHT-016`; **Customer owns the Profile, Chat owns the Identity** |
| **Order Management** | Customer referenced and snapshotted; credit and blacklist gates at release |
| **Delivery** | Address use, marketplace-assigned destinations, collector-need-not-be-customer |
| **Payment** | Receivables and their counterparties; **no customer ledger** |
| **Accounting** | Trade-In Credit as a liability; every posting |
| **Return & Exchange** | History as decision support; **no scoring, no refusal list** |
| **Product** | Pricing and promotional policy (`GAP-015`); warranty terms |
| **API** | Marketplace buyer authority, adapter capability |
| **Permission / Access Governance** | Authorisation, scope, sensitive classes |
| **Audit** | Attribution, evidence, retention floors |
| **Reporting** | Customer Due reads receivables (`RPT-023`); **Customer owns no figure** (`DB-067`) |

---

# 15. Open GAPs, Follow-ups and Reconciliation Points

## 15.1 GAPs carried — none closed

| GAP | Severity | Bearing on Customer |
|---|---|---|
| **`GAP-008`** | 🟠 | **Customer master absent.** This document supplies the specification; **formal closure is `GAP_ANALYSIS.md`'s decision and is not made here** |
| **`GAP-072`** | 🟠 | **Installments modelled nowhere** — the population `BD-311` identified as the genuine customer-receivable case (§10.6) |
| **`GAP-018`** | 🟠 | **`ON_HOLD` has no entry or exit rules** — both customer gates land on it (§9.4) |
| **`GAP-015`** | 🟡 | **Pricing and promotional policy undocumented** — `CUS-009`'s differential treatment has no price model behind it |
| **`GAP-096`** | 🟡 | Conversation-to-lifecycle linkage undecided (§10.7) |
| **`GAP-091`** | 🟡 | *"Unusually frequent returns"* has no threshold (§10.4) |
| **`GAP-070`** | 🔴 | **Migration undocumented** — bears on `BD-170`'s legacy *"B2C Pending"* population |
| **`GAP-026`** | 🟡 | State-name collisions across machines |
| **`GAP-001`** | 🔴 | Module documents remain unwritten. **This document reduces the count by one** |
| **`PRMU-8`** | — | Whether `PRM-008`'s per-actor magnitude bounds are enforced numbers (§9.2) |
| **`BD-144`** | — | Retention against a 12-year warranty obligation (§12) |

## 15.2 Queued follow-ups — carried OPEN, none answered

| # | Question | Raised by |
|---|---|---|
| **`BD-165`** | What is *"courier re-entry"*, and when does it happen? | `BD-023` |
| **`BD-167`** | **How is customer type determined**, particularly on a marketplace order? | `BD-025` |
| **`BD-168`** | Is B2B/reseller pricing agreed per order, or held against the customer and reused? | `BD-026` |
| **`BD-170`** | What did *"B2C Pending"* mean in the legacy system, for migration? | `BD-027` |
| **`BD-171`** | What does an installment sale look like in practice? | `BD-028` |
| **`BD-172`** | If a customer stops paying installments, what does the business do? | `BD-028` |
| **`BD-174`** | Is repeat status flagged, or judged from history at the time? | `BD-031` |
| **`BD-425`** | **Does blacklist status affect returns, or only new orders?** | `BD-424` |

## 15.3 Reconciliation points carried

| # | Point | Owning document |
|---|---|---|
| 1 | **`INV-23.1`'s *"mirror, never locally edited"* against `BD-173`'s accumulating Customer Profile.** The Channel-Identity-as-mirror reading is **stated by no source**; declined at `CHT-016` and again at `CUS-032` | `DOMAIN_MODEL.md` |
| 2 | **`E-023`'s *ownership flag*** — stored or derived, undefined (§5) | `DOMAIN_MODEL.md` |
| 3 | **Blacklist reach across unlinked identities** — an accepted exposure (§9.5) | Business decision |
| 4 | **`BD-027` versus `RULE 0.1`** — the frozen *"B2C Pending"* tab against its stated replacement (§4.1) | `DESIGN_CONSTITUTION.md` |
| 5 | **`BD-030` versus `OM §3.4`/`§7.8`** — direct marketplace contact against *"often prohibited"* and auto-confirmation without contact (§6) | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| 6 | **`BR-026`'s application after `BD-213`** — carried on `INV-24.1` (§8) | `ORDER_MANAGEMENT_ARCHITECTURE.md` |

**No gap is closed by this document, no follow-up is answered, and no reconciliation point is resolved.**

---

# 16. Traceability

## 16.1 Business Decisions consumed

| BD | Contributes |
|---|---|
| `BD-023` | **Phone as the lookup key** · manual-entry situations · profile reuse and update |
| `BD-024` | Marketplace order data may be wrong, incomplete or fake |
| `BD-025` | **Three customer types** |
| `BD-026` | Differential pricing · corporate credit terms · resellers on the normal process |
| `BD-027` | Pending Verification replaces the B2C Pending tab · filter by type |
| `BD-028` | **Credit and installment for approved customers**; B2C neither by default |
| `BD-029` | **The customer profile and its contents** |
| `BD-030` | Direct marketplace customer contact for order purposes |
| `BD-031` | Repeat customers · case-by-case treatment |
| `BD-169` | **Credit Limit · editable · checked at release · warn · authorised approval · never mutates the limit** |
| `BD-173` | **Marketplace order → Customer Profile; no automatic cross-channel merge** |
| `BD-351` | **History is decision support; no scoring** |
| `BD-357` | **Channel Identity** · evidence-based linking · never auto-merge |
| `BD-424` | **Blacklist · warn before release · authorised approval · never removed by one approval** |

**Prior coverage consumed:** `BD-008`, `BD-107` – `BD-113`, `BD-144`, `BD-162`, `BD-212`, `BD-213`, `BD-311`, `BD-314`, `BD-329`, `BD-338`, `BD-370`, `BD-377`, `BD-402`.

## 16.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `E-023`, `E-024`, `E-031`, `E-032`, `E-073` – `E-076`, `E-083`, `INV-23.1` – `INV-23.4`, `INV-24.1` – `INV-24.3`, `INV-75.1` – `INV-75.4`, `DM-001` | `DOMAIN_MODEL.md` |
| `CHT-008`, `CHT-010` – `CHT-016`, `CHT-037` | `CHAT_ARCHITECTURE.md` |
| `BR-003`, `BR-026`, `BR-039`, `BR-081`, `BR-119`, `BR-128`, `BR-140`, `SM-1`, `OM §3.4`, `OM §7.8` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `DLV-010`, `DLV-011`, `DLV-023`, `DLV-036`, `DLV-100` – `DLV-104` | `DELIVERY_ARCHITECTURE.md` |
| `PAY-000`, `PAY-016` | `PAYMENT_ARCHITECTURE.md` |
| `ACC-011`, `ACC-039`, `ACC-040` | `ACCOUNTING_ARCHITECTURE.md` |
| `RET §7.4`, `RET §21` | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `SYS-010`, `SYS-017`, `SYS-020`, `SYS-024`, `SYS-044`, `SYS-047`, `SYS-090`, `SYS §5.7`, `SYS §7.1`, `CP-8`, `CP-9` | `SYSTEM_ARCHITECTURE.md` |
| `DB-013`, `DB-023`, `DB-028`, `DB-043`, `DB-052`, `DB-054`, `DB-057`, `DB-067`, `DB-068` | `DATABASE_ARCHITECTURE.md` |
| `PRM-004`, `PRM-005`, `PRM-008`, `PRM-009`, `PRM-011`, `PRM-048`, `PRM-049`, `PRM-051`, `AGV-001`, `AGV-011`, `AGV-012`, `AGV-020`, `AGV-024` | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `AUD-004` | `AUDIT_ARCHITECTURE.md` |
| `API-004`, `API-024`, `API-029` | `API_ARCHITECTURE.md` |
| `RPT-023` | `REPORTING_ARCHITECTURE.md` |
| `DOC-005`, `DOC-024`, `DOC-050`, `DOC-060` | `MASTER_DOCUMENTATION_INDEX.md` |

---

# 17. Version History

| Version | Date | Change |
|---|---|---|
| **1.1.0** | **2026-08-09** | **Stale citation corrected — no rule changed.** `CUS-059` pointed at `PRODUCT_ARCHITECTURE.md` §32 for the warranty and repair lifecycles; **§32 reconciles warranty *policy* and holds no lifecycle content.** It was cited because **no owning module was registered at the time**. The pointer now resolves to [`WARRANTY_REPAIR_ARCHITECTURE.md`](WARRANTY_REPAIR_ARCHITECTURE.md) (`DOC-062`). **`CUS-059`'s substance is unchanged** — warranty records appear in the profile as history, and the lifecycles are owned elsewhere. `CUS-060` untouched |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §4 (`BD-025` – `BD-031`), §3 (`BD-023`, `BD-024`) and **§30** (`BD-173`, `BD-169`, `BD-424`), with `BD-351`, `BD-357` and the reconciliations at `OM §7`, `CHAT §5` and `DOMAIN_MODEL.md` `E-023`/`E-024`. **75 rules (`CUS-000` – `CUS-074`), all traceable; no business rule, entity, state machine, lifecycle, threshold, segmentation, tier, score, consent model or automation introduced.** **`CUS-026` – `CUS-032` reference Chat-owned Channel Identity without re-owning it** (`DOC-060`); **`CUS-032` carries the `INV-23.1` reconciliation point unchanged and declines the mirror reading a second time.** **`CUS-052` records the two standing markers as one mechanism**; **`CUS-054` carries blacklist reach across unlinked identities as an accepted exposure.** **`CUS-074` records that Customer has no state machine.** Eleven gaps, eight queued follow-ups and six reconciliation points carried; **none closed, answered or resolved** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies customer business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
