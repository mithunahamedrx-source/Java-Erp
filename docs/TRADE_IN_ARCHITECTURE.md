# Trade-In Architecture

**Owner:** Trioloo Technology · **Module:** Trade-In · **Status:** Canonical
**Version:** 1.2.2 · **Ratified:** 2026-08-09 · **Rule prefix:** `TRD-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §26 Trade-In (`BD-388` – `BD-397`, complete), with prior coverage at `BD-108`, `BD-110`, `BD-111`, `BD-265`, `BD-275`, `BD-338`, `BD-352`, `BD-354`, `BD-360`, `BD-365`, `BD-376`, `BD-381`, `BD-382`.

**Reconciliation records consolidated:** [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) §25 (`SM-18`, `SM-19`, `SMA-067` – `SMA-073`) · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §23 (`SYS-102` – `SYS-104`) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-081` – `E-083`, `DM-075` – `DM-077`.

**References, never duplicated:** [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) `IVN-` · [`INVENTORY_COSTING_ARCHITECTURE.md`](INVENTORY_COSTING_ARCHITECTURE.md) `ICO-` · [`ACCOUNTING_ARCHITECTURE.md`](ACCOUNTING_ARCHITECTURE.md) `ACC-` · [`WAREHOUSE_ARCHITECTURE.md`](WAREHOUSE_ARCHITECTURE.md) `WHS-` · [`WARRANTY_REPAIR_ARCHITECTURE.md`](WARRANTY_REPAIR_ARCHITECTURE.md) `WAR-` · [`CUSTOMER_ARCHITECTURE.md`](CUSTOMER_ARCHITECTURE.md) `CUS-` · [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) `BR-` · [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) `PRD-` · [`PAYMENT_ARCHITECTURE.md`](PAYMENT_ARCHITECTURE.md) `PAY-` · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`DELIVERY_ARCHITECTURE.md`](DELIVERY_ARCHITECTURE.md) `DLV-` · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) `NOT-` · [`REPORTING_ARCHITECTURE.md`](REPORTING_ARCHITECTURE.md) `RPT-` · [`CHAT_ARCHITECTURE.md`](CHAT_ARCHITECTURE.md) `CHT-` · [`API_ARCHITECTURE.md`](API_ARCHITECTURE.md) `API-` · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) `AGV-` · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) `AUD-` · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **TRD-000 — This document answers *what happened to one customer's traded-in machine, from the moment they asked to the moment the business is done with it*. It answers nothing about what the components cost, what the credit is worth, what anything posts, or what is in stock.**

**This module is unusually narrow, and deliberately so.** Every financial and physical consequence of a trade-in was assigned to an existing owner **before this document existed**, and each of those assignments is retained unchanged.

| Question | Owner |
|---|---|
| **The case, its evaluation, the agreement, custody, component classification, and the decline path** | **`TRADE_IN_ARCHITECTURE.md`** — `TRD-` |
| **What each component cost** — allocation of the agreed value | `INVENTORY_COSTING_ARCHITECTURE.md` — `ICO-011` – `ICO-017` |
| **When components become stock** | `INVENTORY_ARCHITECTURE.md` — `IVN-030` – `IVN-032` |
| **Trade-In Credit as money** — `E-083`, the liability, and every posting | `ACCOUNTING_ARCHITECTURE.md` — `ACC-039`, `ACC-040` |
| **Physical holding of the customer's property** | `WAREHOUSE_ARCHITECTURE.md` — `WHS-069` |
| **Repairing a `Repair Required` component** | `WARRANTY_REPAIR_ARCHITECTURE.md` — `SM-15`, `WAR-035` |
| **Who the customer is** | `CUSTOMER_ARCHITECTURE.md` — `CUS-062` |
| **The sale the credit is spent on** | `ORDER_MANAGEMENT_ARCHITECTURE.md` · `PAYMENT_ARCHITECTURE.md` |
| **Shipping anything, in either direction** | `DELIVERY_ARCHITECTURE.md` |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` — `SM-18`, `SM-19`, `SMA-` |
| **Message transport** | `NOTIFICATION_ARCHITECTURE.md` |
| **Who may evaluate, approve or accept** | `PERMISSION_ARCHITECTURE.md` · `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| **Audit record structure and retention** | `AUDIT_ARCHITECTURE.md` |

> **TRD-001 — This module is not a second system of record for money or for stock.** It records **that** a value was agreed, **that** an allocation completed and **that** credit exists. **What those values are, and what they post to, belong to Costing and Accounting** (`ICO-015`, `ACC-039`, `SYS-015`).

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine, lifecycle, threshold, valuation method, expiry policy or automation is introduced. **No gap is resolved by assumption** — see §21.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To hold one question from beginning to end: **a customer offers the business their old machine — what happens next?**

Three facts shape the whole domain.

> **A trade-in begins as an evaluation, not an inventory transaction** (`BD-388`, `INV-81.1`). **The customer's product remains the customer's property until both parties agree**, and for a remote customer the business physically holds it long before that.

> **A traded-in desktop is not one item entering stock. It is a bundle of components with different fates** (`BD-388`, `E-082`). That operation — **one product resolving into many components** — is the inverse of assembly, and **the architecture does not have it** (`GAP-103`).

> **Trade-In Credit and inventory are created at different moments, and the gap is what makes the whole design affordable** (`SMA-067`). The customer buys their new machine and leaves; the components reach stock when the workshop finishes.

---

# 2. Scope

## 2.1 In scope

`E-081` Trade-In Case from request to closure · the two intake shapes and their evaluation paths · the provisional evaluation and its retention · physical inspection findings and renegotiation · the agreed value and the moment ownership transfers · **the custody overlay for customer property held before agreement** · `E-082` Trade-In Component and its classification · the decline path, the physical return and its cost-bearer decision · **unclaimed property** · the operational fact that credit was created.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **Allocation of the agreed value across components; acquisition cost** | `INVENTORY_COSTING_ARCHITECTURE.md` (`ICO-011` – `ICO-017`) |
| **Stock creation, quantity, the movement ledger** | `INVENTORY_ARCHITECTURE.md` (`IVN-030` – `IVN-032`) |
| **`E-083` Trade-In Credit — the liability, its balance, its treatment** | `ACCOUNTING_ARCHITECTURE.md` (`ACC-039`, `ACC-040`) |
| **Physical receipt, holding and handover** | `WAREHOUSE_ARCHITECTURE.md` (`WHS-069`) |
| **Repair of a `Repair Required` component** | `WARRANTY_REPAIR_ARCHITECTURE.md` (`SM-15`) |
| **Customer identity, profile and history** | `CUSTOMER_ARCHITECTURE.md` (`CUS-062`) |
| **The new sale, its lifecycle and its receivable** | `ORDER_MANAGEMENT_ARCHITECTURE.md` · `PAYMENT_ARCHITECTURE.md` |
| **Product catalogue, SKU structure and pricing** | `PRODUCT_ARCHITECTURE.md` |
| **Return and exchange lifecycles** | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| **Shipment in either direction** | `DELIVERY_ARCHITECTURE.md` |
| **Notification generation, transport, delivery evidence** | `NOTIFICATION_ARCHITECTURE.md` |
| **Report definitions and the semantic layer** | `REPORTING_ARCHITECTURE.md` |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` |
| Screen layout, density, interaction | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

---

# 3. Architectural Principles

## 3.1 P1 — Evaluation first, ownership later, inventory later still

> **TRD-002 — Three moments are distinct and must never be collapsed** (`BD-388`, `BD-391`, `INV-81.1`, `IVN-030`).

| Moment | What changes | Rule |
|---|---|---|
| **The customer hands the item over** | **Nothing** — it is still their property, held in custody | `INV-81.1`, `INV-81.4` |
| **The agreement is accepted** | **Ownership transfers**; the agreed value is fixed; credit exists | `INV-81.3`, `BD-392` |
| **Cost allocation completes** | **Inventory exists** | `BD-391`, `IVN-030` |

**The gap between the second and third may be days.** Collapsing any pair of these would break either the legal position or the costing discipline.

## 3.2 P2 — Immutability outranks availability

> **TRD-003 — Where making inventory available sooner competes with keeping its cost correct, correctness wins** (`BD-391`, `SYS-102`).

> **Inventory immutability is more important than early inventory availability** (`BD-391`).

**The business stated the priority rather than merely choosing an option**, which is why `SYS-102` records it at system level as a costing principle rather than a Trade-In rule (`DM-075`).

## 3.3 P3 — The ERP records the outcome, never the method

> **TRD-004 — Valuation method, allocation basis and cost-bearer decisions are recorded as results; the ERP prescribes none of them** (`ICO-015`, `SYS-104`, `BD-390`, `BD-395`).

**The same construction appears twice in this domain alone** — *"records the allocation results but does not prescribe the valuation methodology"* (`BD-390`) and *"records the outcome, not the decision methodology"* (`BD-395`). `SYS-104` records it as the business's standing idiom.

## 3.4 P4 — But arithmetic is enforced

> **TRD-005 — The allocation must sum to the agreed value, and that is enforced** (`BD-390`, `SMA-068`, `CP-8`).

**The method is judgement; the total is not.** An allocation distributing 50,000 when the agreed value was 45,000 **is not a different opinion — it is wrong**, and it would put money into inventory that was never paid. `CP-8`'s line falls exactly here.

## 3.5 P5 — Two valuations, both retained

> **TRD-006 — The provisional offer is a record, not a draft. It is retained alongside the final value and never overwritten by it** (`INV-81.2`, `DB-003`).

*"You quoted me this"* is precisely where a dispute arises. **A design that treats the provisional figure as a draft to be replaced destroys the evidence exactly when it matters.** Same instinct as `INV-69.1` and `PAY-002` — expected and actual both kept.

## 3.6 P6 — A stall the business will not resolve automatically is made visible instead

> **TRD-007 — Where this domain blocks, it pairs the block with visibility rather than weakening the rule** (`SMA-066`, `SMA-073`, `BD-391`, `BD-396`).

| What stalls | The mitigation |
|---|---|
| **Inventory blocked pending classification** | *"The ERP records the inspection progress"* (`BD-391`) |
| **A case open indefinitely on unclaimed property** | *"The ERP may remind responsible staff to follow up"* (`BD-396`) |

---

# 4. `E-081` Trade-In Case

> **TRD-008 — `E-081` Trade-In Case is a customer's request to exchange an owned product for value, and carries the `SM-18` lifecycle** (`E-081`, `SM-18`). **Its attributes are defined in `DOMAIN_MODEL.md` and are not restated here** (`DOC-005`, `DOC-006`).

> **TRD-009 — The case is the container for the whole episode** — evaluation, inspection, agreement or decline, the physical return and its cost (`BD-388`, `BD-395`). **No sales-return or warranty path is involved.**

> **TRD-010 — Trade-In Case is a member of the case family and requires no new parent concept** (`BD-354`, `BD-388`). `E-073` Business Case already links Trade-In cases, and a `Repair Required` component creates a natural link to a repair.

---

# 5. Initiation and eligibility

## 5.1 Direct sales only

> **TRD-011 — Trade-In is available only on direct business sales** — walk-in · direct website orders · Facebook · WhatsApp · phone (`BD-393`, `INV-83.4`).

> **TRD-012 — The exclusion is a capability condition, not a platform list** (`BD-393`, `DM-076`). Trade-In is **not supported where payment collection and settlement are controlled by the marketplace**, *unless that marketplace explicitly supports Trade-In*.

**The rule turns on the structural reason rather than the name Daraz, which makes it self-maintaining**: any future marketplace with the same property is excluded without amending the rule, and one that natively supports Trade-In is included without a special case.

> **The limitation is in the settlement flow, not in the ERP** (`BD-393`). On a marketplace the customer pays the platform in full and the platform remits net — **there is no moment at which a credit can reduce what the customer owes.** `DM-076` records Trade-In availability as the **eighth channel-capability dimension**.

> **TRD-013 — Marketplace orders continue as normal sales; Trade-In remains an independent direct-sales workflow** (`BD-393`). **A marketplace customer wanting a trade-in is served as a direct sale**, not as a marketplace order with a credit attached.

## 5.2 It begins as a request

> **TRD-014 — A Trade-In Case begins when a customer requests an evaluation, and the ERP records the case during evaluation** (`BD-388`). **It does not begin as an inventory transaction.**

---

# 6. The two intake shapes

> **TRD-015 — Intake takes two shapes, and they enter the lifecycle at different points** (`BD-388`, `SM-18`).

| Shape | Channels | What happens first | Enters at |
|---|---|---|---|
| **Remote** | Facebook · WhatsApp · website · phone | **Provisional evaluation** from photos, videos, specifications, age, condition and customer information — **subject to physical inspection** | `PROVISIONAL_EVALUATION` |
| **Walk-in** | In person | **Physical inspection may be performed immediately** | `PHYSICAL_INSPECTION` |

> **TRD-016 — The remote path holds the customer's property before any agreement exists** (`BD-388`, `INV-81.1`). The item is **shipped before agreement**, so the business physically holds goods that are the customer's, potentially for days — see §9.

> **TRD-017 — Where a request arrives through a conversation channel, the conversation is owned by `CHAT_ARCHITECTURE.md`** (`CHT-`, `BD-354`). This module records the case; it does not model the conversation.

---

# 7. Evaluation and valuation

## 7.1 Recoverable value, not whole-unit value

> **TRD-018 — Valuation considers the recoverable value of the product rather than valuing it as a whole unit** (`ICO-012`, `BD-388`).

**Evaluation may identify Reusable, Repairable and Scrap components. These contribute to the final value but do not create inventory until the trade-in is accepted** (`BD-388`).

## 7.2 The final value comes after inspection

> **TRD-019 — The final Trade-In value is determined only after physical inspection** (`BD-388`).

> **TRD-020 — Where inspected condition differs materially from the provisional evaluation, the business may renegotiate; the customer may accept the revised value or decline and receive the product back** (`BD-388`).

> **TRD-021 — *"Differs materially"* is a judgement, not a number. The ERP records the renegotiation and its reason; it does not compute whether a difference was material** (`BD-388`, `CP-8`).

**Consistent with `BD-108`, `BD-275`, `BD-110` and `BD-111`**, which all set *who decides* rather than *how much*.

## 7.3 The agreed value anchors everything after it

> **TRD-022 — The agreed value is fixed at acceptance** (`INV-81.3`, `ICO-011`, `BD-392`).

**The immutability chain is complete and each step anchors the next**: value fixed at agreement (`BD-392`) → allocated once (`BD-390`) → never restated (`BD-391`).

---

# 8. The agreement

> **TRD-023 — No inventory transaction occurs until the customer accepts the final Trade-In agreement** (`BD-388`, `INV-81.1`).

> **TRD-024 — Ownership transfers at acceptance** (`INV-81.1`, `BD-388`). Before it, the product is the customer's; after it, the business is the owner and component classification begins.

> **TRD-025 — Acceptance is the moment Trade-In Credit comes into existence** (`BD-392`, `SMA-067`). **What that credit is, and what it posts to, is Accounting's** — see §12.

---

# 9. Custody of customer property

> **TRD-026 — While the business physically holds a customer's product before agreement, that product is never inventory** (`INV-81.4`, `IVN-033`, `SYS-103`).

**The prohibition is absolute because the exposure is legal rather than accounting** — taking another party's property into inventory without transfer is **not an error that reverses** (`BD-360`, `CP-8` irreversibility axis). **`ICO-006` reinforces it structurally**: an item with no acquisition cost cannot enter inventory, and customer property has none.

> **TRD-027 — Custody is an overlay on the Trade-In Case, not a state of it** (`SMA-071`, `SMA-061` pattern). It **spans `AWAITING_ITEM_RECEIPT` through to `AGREEMENT_ACCEPTED` or `RETURNED`**, cutting across several states rather than being one.

> **TRD-028 — The custody state is carried by `E-081`; the physical holding is Warehouse's** (`WHS-069`, `DOC-058`). **The state that says Trioloo is holding someone else's property belongs to the case, not to Warehouse and not to Inventory.**

> **TRD-029 — The same custody shape arises in warranty repair, and the two share it rather than inventing parallel concepts** (`E-081` notes, `E-072`, `WAR-060`). **The state to model is: physically present, not owned, not inventory.**

---

# 10. `E-082` Trade-In Component and classification

> **TRD-030 — `E-082` Trade-In Component is one component of an accepted trade-in, individually classified, and carries the `SM-19` lifecycle** (`E-082`, `SM-19`).

> **TRD-031 — After acceptance every component is individually classified** (`BD-389`, `ICO-013`), into one of six: **Reusable · Repair Required · Refurbishable · Scrap · Recycle · Unknown** *(pending inspection)*.

> **TRD-032 — A component is a tracked thing with its own lifecycle, not a line on a form** (`BD-389`). **Identity within the ERP does not imply a manufacturer serial**, which remains optional and never mandatory (`BD-265`).

## 10.1 Two classifications are work, not storage

> **TRD-033 — `REPAIR_REQUIRED` and `REFURBISHABLE` both generate work before the component is saleable, and they are genuinely different activities** (`SMA-072`, `BD-389`). **Repairing a fault and restoring cosmetic condition have different costs.**

> **TRD-034 — A `REPAIR_REQUIRED` component delegates to `SM-15` Repair, owned by `WARRANTY_REPAIR_ARCHITECTURE.md`** (`SMA-072`, `SMA-044` as amended, `WAR-035`). ✅ **Registered 2026-08-09 as `SM-15`'s fourth entry point** — `SMA-072` always stated the delegation; only `SMA-044`'s enumeration was stale.

> **TRD-035 — Both generate `E-079` Action Queue Items with an owner** (`SMA-072`, `BD-382`) — **real work with an owner, not merely a status.** The Action Queue is `NOTIFICATION_ARCHITECTURE.md`'s.

## 10.2 Not everything becomes inventory

> **TRD-036 — Only components approved for inventory become inventory items. Scrap and Recycle do not automatically become saleable inventory** (`INV-82.1`, `IVN-032`, `BD-389`).

**The wording is careful and its narrowness is deliberate** — *not automatically saleable* leaves room for non-saleable inventory without asserting it. **Recorded as narrowed, not closed** (`BD-389`).

> **TRD-037 — Components that do not become inventory receive no inventory cost** (`INV-82.3`, `ICO-014`, `BD-390`). **The full agreed value is therefore borne by the components that survive.**

**If a 20,000 machine yields one reusable part, that part costs 20,000.** This is correct — the business paid for recoverable value and recovers it through what it can use — **and it makes over-valuation visible as inflated component cost rather than hiding it in an averaged pool** (`E-082` notes).

## 10.3 `UNKNOWN` blocks the whole case

> **TRD-038 — Every component must reach a final classification before allocation begins; a partially classified Trade-In cannot create partial inventory** (`BD-391`, `ICO-016`, `IVN-031`, `INV-82.2`).

> **TRD-039 — One unclassified component holds up the entire case, and the business chose that deliberately** (`SMA-073`, `BD-391`).

**The alternative would either give a later-classified component no cost or force retrospective restatement — both breaking `DB-003` and `DB-077`.** **This makes `UNKNOWN` expensive, which is healthy**: the incentive is to resolve it rather than leave it pending.

> **TRD-040 — The obvious optimisation is explicitly foreclosed** (`IVN-031`, `BD-391`): releasing the obviously-reusable RAM while the motherboard is still being tested. **It looks harmless and is not — the allocation basis is not yet known, so the released item would carry a cost that later changes.**

---

# 11. The allocation gate

> **TRD-041 — Three gates run in order, and inventory exists only after the third** (`SMA-068`, `IVN-030`, `BD-391`):

**`Trade-In Agreement Accepted` → `Component Classification Completed` → `Cost Allocation Completed` → inventory created**

> **TRD-042 — The allocation itself is owned by `INVENTORY_COSTING_ARCHITECTURE.md`; this module owns only the case state that gates it** (`ICO-011` – `ICO-017`, `DOC-005`). **Allocation is performed once and is never retrospectively restated** (`ICO-016`, `SYS-102`).

> **TRD-043 — Inventory creation is owned by `INVENTORY_ARCHITECTURE.md`** (`IVN-030` – `IVN-032`). **This module never creates, values or moves stock.**

---

# 12. Trade-In Credit — the financial boundary

> **TRD-044 — `E-083` Trade-In Credit is owned by `ACCOUNTING_ARCHITECTURE.md`, not by this module** (`E-083`, `ACC-039`, `ACC-040`). **This module records the operational fact that an accepted agreement created credit; it holds no balance, computes no amount and posts nothing.**

**What Accounting has already established, referenced and not restated:**

| Fact | Rule |
|---|---|
| **A payment source, never a product discount.** Revenue is recognised at the **full selling price**; the credit reduces the amount payable, never the price | `ACC-039`, `INV-83.1` |
| **A non-cash liability that discharges only through a sale.** Not redeemable for cash, not withdrawable | `ACC-040`, `INV-83.2` |
| **A dedicated credit type**, distinct from discounts, refunds, customer advances, gift vouchers, loyalty points and promotional credits | `INV-83.3` |
| **Balance derived from movements** — issued at agreement, consumed per sale | `E-083`, `DB-001` |
| **Four amounts recorded separately** — New Sale Value · Trade-In Credit Applied · Additional Customer Payment · Remaining Credit | `INV-83.5` |
| Available only on direct sales | `INV-83.4`, `TRD-011` |

> **TRD-045 — The credit and the components are two halves of one transaction, and the same agreed value appears on both sides** (`E-083` notes, `BD-390`, `BD-392`): **a liability owed to the customer** and **an asset acquired and allocated across components.** **Neither half makes sense alone** — which is what a discount treatment would have broken, leaving nothing to allocate.

> **TRD-046 — Discount policy does not apply to a trade-in** (`BD-392`, `BD-255`, `BD-275`, `PRM-052`). **A trade-in never routes through discount approval**, and no per-user discount limit question arises.

## 12.1 Credit outlives the case

> **TRD-047 — The new purchase is not a state of the Trade-In Case; the credit is a standing balance with its own movements** (`SM-18`, `BD-397`, `BD-394`, `DB-001`).

**If the case remained open until the credit was spent, a Trade-In Case would stay open for years** and could never close for a customer keeping a small balance. **The immediate purchase is a linked transaction; the case completes when the business's work is done** — consistent with `BD-352`, where completion is domain-local.

> **TRD-048 — Immediate use is the normal workflow, and partial or multiple future purchases are permitted by business policy** (`BD-392`, `BD-394`). **The permission is the business's; the balance is Accounting's.**

## 12.1a Credit application — confirmed, and owned elsewhere

> **TRD-081 — Trade-In Credit may be applied to a new order in full or in part, and in most cases the full available applicable credit is used** (`BD-431`, `BD-394`).

> **TRD-082 — Applying credit does not reduce or rewrite the Order Total or sale value; it reduces the remaining Amount Payable** (`BD-431`, `ACC-039`, `INV-83.1`).
>
> **`ACC-039` confirmed in the business's own terms, with a worked example**: Order Total 30,000 · Credit Applied 10,000 · **Remaining Payable 20,000**. **Revenue stands at the full selling price.**

> **TRD-087 — Credit is applied before dispatch; at dispatch the receivable is created gross and the applied credit clears part of it, leaving the cash amount the courier collects** (`BD-433`, `PAY-015`, `PAY-064`, `DLV-130`). **The courier never applies the credit.**
>
> ⚠ **None of this is owned here** (`TRD-001`, `TRD-044`). **Payment orchestrates the application** (`PAY-068`), **Accounting owns `E-083`, validates the balance and publishes the authoritative fact** — `EVT-101` (`ACC-048`, `ACC-050`) — and **Delivery owns the COD instruction.** **This module caused the credit to exist and nothing further** (`TRD-047`).

> **TRD-083 — Credit application and ordinary payment settlement are separate financial facts** (`BD-431`, `PAY-001`). **Three moments, never collapsed**: credit **created** at agreement (`TRD-025`, `SMA-067`) · credit **applied** to an order · payment **settled** when money actually arrives.

> **TRD-084 — Four things must be traceable: credit availability, amount applied, remaining balance, and the associated order** (`BD-431`). **The remaining balance is derived from movements, never a stored figure overwritten on each use** (`DB-001`, `E-083`).

⚠ **None of this is owned here.** `E-083` and its balance are **Accounting's** (`ACC-039`, `ACC-040`); the order is **Order Management's**; `TRD-001` and `TRD-044` hold — **this module holds no balance, computes no amount and posts nothing.** **`TRD-047` already establishes that credit outlives the Trade-In Case**, so the credit-to-order link is not the case's either.

## 12.2 ⚠ What this module does not know

> **TRD-049 — Credit expiry is deliberately unstated** (`BD-394`, `ACC-040`). *"Until fully used or otherwise resolved according to business policy"* leaves expiry open by intent. **Under `BD-338` nothing is deleted, so an unused balance persists indefinitely**, and `ACC-040` requires outstanding credit to be reportable as a standing liability. **No expiry rule is written here or anywhere, and none is invented.**

> **TRD-050 — What happens to Trade-In Credit when the sale it was spent on is later returned or cancelled is stated by no canonical source.** Recorded as a reconciliation point (§22); **no reversal, forfeiture or reinstatement behaviour is inferred** (`DOC-024`, `DM-001`).

---

# 12A. Customer communication

> **TRD-085 — Trade-In requires no automatic customer notification at any lifecycle transition** (`BD-432`). Communication is **handled manually by staff**.

**No automatic SMS, WhatsApp, email or in-app notification is required** for request received, valuation, agreement accepted, credit creation, decline, return or any other transition. **No Notification consumer or event exists for Trade-In**, and none is created (`DOC-024`).

> **A whole capability area removed by explicit answer, as `BD-335` removed loaner management from Warranty** (`CP-9`). **The tempting reading of a lifecycle with an offer, an acceptance and a decline is that each needs a message; the business says none does.**

> **TRD-086 — Recording communication and sending it are different, and only recording is required** (`BD-396`, `BD-432`). The ERP records **all customer communication and collection attempts** on unclaimed property and **may remind responsible staff to follow up** — **an internal Action Queue item, never an automatic customer notification** (`NOT §11.1`, `BD-381`).

⚠ **A broader automated messaging capability may be introduced later**, potentially alongside a future HR/Payroll/system phase (`BD-432`). **It is not a current Trade-In requirement, creates no reserved concept or dependency, and must not block specification** (`DOC-030`). `NOT-019` already defers external delivery channels past V1.

> **The sharpest contrast in the documentation set.** `BD-428` gave Warranty & Repair **eight customer-contact points, four of them determinate and two of them gating progress**. `BD-432` gives Trade-In **none**. **Two adjacent after-sales domains, opposite answers** — which is precisely why it was asked rather than inferred.

---

# 13. Decline, return and unclaimed property

## 13.1 Declining

> **TRD-051 — When a customer declines the revised offer, the product remains the customer's property and leaves the business through the Trade-In Case** (`BD-395`, `INV-81.1`).

> **TRD-052 — The physical return is a custody-out movement, not a sales return** (`BD-395`, `WHS §13.2`, `E-081` notes). **No return, exchange or warranty path is involved** — `RETURN_EXCHANGE_ARCHITECTURE.md` owns none of it.

## 13.1a Two return methods, determined separately

> **TRD-076 — A declined item returns by one of two methods, and the method is determined separately from the decline** (`BD-430`): **`CUSTOMER_PICKUP`** or **`COURIER_RETURN`**.

| Method | Delivery involvement |
|---|---|
| **`CUSTOMER_PICKUP`** | **None.** The customer collects; no Delivery/Courier workflow is required |
| **`COURIER_RETURN`** | The item returns through the **normal courier/delivery process** |

> **TRD-077 — `DECLINED` must never be taken to imply that a courier shipment exists** (`BD-430`). **`SM-18`'s `RETURN_IN_PROGRESS` does not mean a parcel is moving** — for a `CUSTOMER_PICKUP` return nothing has been dispatched and nothing will be.
>
> **The business stated this as a prohibition rather than leaving it to judgement**, in the same way `BD-429` forbade recreating an original order's COD. **Both are errors that pattern-matching produces and that nothing downstream would catch.**

> **TRD-078 — The return method is data on the case, not a state** (`BD-430`, `SMA-013`). **`SM-18` needs no new state to express it**, and none is created.

**Third independent instance of one structural rule** — the method determines whether a shipment exists at all: sales fulfilment (`SMA-013`), warranty handback (`DLV-123`), and now a declined trade-in.

> **TRD-079 — Return handling transfers no ownership and creates no inventory** (`BD-430`). **The item remains customer property throughout** — `INV-81.1`, `INV-81.4` and `SYS-103` confirmed for a third time, and `TRD-026`, `TRD-051` and `TRD-052` are unchanged.

## 13.2 Who pays to send it back

> **TRD-053 — The ERP records who bears return shipping and the business reason; it never determines who should pay** (`INV-81.5`, `BD-395`). The decision is made by **authorised business personnel according to the circumstances**.

> **TRD-054 — The cost bearer is an amount per party, not a flag** (`BD-395`). Named outcomes include **business bears · customer bears · shared by agreement · another business decision** — **and *"shared by agreement"* cannot be expressed by a two-valued field.** The simple cases are degenerate splits of the same structure.

> ✅ **`DOC-050` conflict RECONCILED BY SCOPE 2026-08-09 — no side chosen, no outcome invented.** `BD-430` states that return cost may be borne by either **`CUSTOMER`** or **`BUSINESS`**, and adds that **the default and most common bearer is `CUSTOMER`**.
>
> | | `BD-395` | `BD-430` |
> |---|---|---|
> | Outcomes | **Four**, including **shared by agreement** | **Two** |
> | Default | **None stated** | **`CUSTOMER`** |
>
> **The reconciliation turns on one word in `BD-395`: its four outcomes are introduced as *“Examples”*, not as an enumeration.** They were never an exhaustive set, so **`BD-430` cannot have narrowed one.** `BD-430` states which bearers are usual and **which one is the default; it excludes nothing.**
>
> **Therefore: the four outcomes remain possible, and `CUSTOMER` is the default.** **`TRD-053`, `TRD-054` and `TRD-080` are already consistent with that reading and are unchanged** — the ERP still records the outcome and never determines who should pay, and the cost bearer remains **an amount per party** so that *shared by agreement* stays expressible. **No outcome was added, removed or chosen.**

> **TRD-080 — The customary bearer of return shipping is the customer, and the business may bear or waive it when appropriate** (`BD-430`). **This is a default, never an enforcement** — `TRD-053` still forbids the ERP from determining who should pay.

## 13.3 Unclaimed property

> **TRD-055 — Where a customer declines and does not collect or accept return, the case enters `UNCLAIMED_PROPERTY`** (`BD-396`, `SM-18`).

> **TRD-056 — The product remains customer property until ownership is legally transferred, and never becomes business inventory** (`BD-396`, `INV-81.4`, `SYS-103`).

**Stated without qualification because it forecloses the obvious drift** — *"it has been six months, put it in stock."* **`BD-390`'s allocation gate reinforces it from the other side**: inventory requires an allocated acquisition cost, and unclaimed property has none.

> **TRD-057 — The ERP records all customer communication and collection attempts, and may remind responsible staff to follow up** (`BD-396`). **"May" rather than "must"** — consistent with `BD-381` making notification generation configurable.

> **TRD-058 — `UNCLAIMED_PROPERTY` is the first legitimately-open-forever state in the architecture** (`SMA-069`, `BD-396`). **All three of its exits require something outside the business's control** — the customer collecting, the customer changing their mind, or a legal process concluding.

**Cases will accumulate here by design and without limit. That is correct — a case must not close because it is inconvenient — but it means the state must be reportable, not merely permitted** (`SMA-069`).

> **TRD-059 — The business decides resolution according to applicable law and business policy; the ERP records the final resolution but does not prescribe it** (`BD-396`).

> **TRD-060 — A case closes only when the property has been returned to the customer, accepted into an agreed Trade-In, or otherwise legally resolved** (`BD-396`).

---

# 14. `SM-18` and `SM-19`

> **TRD-061 — `E-081` carries `SM-18` and `E-082` carries `SM-19`. Both are defined in `STATE_MACHINE_ARCHITECTURE.md` §25 and are not restated, redefined, merged, simplified or re-ratified here** (`DOC-005`, `SMA-067` – `SMA-073`).

| Machine | Entity | Authority | Initial | Terminal |
|---|---|---|---|---|
| **`SM-18`** Trade-In Case | `E-081` | **Mixed** — `UNCLAIMED_PROPERTY` is blocked by the customer | `REQUESTED` | `COMPLETED`, `RETURNED`, `LEGALLY_RESOLVED`, `CANCELLED` |
| **`SM-19`** Trade-In Component | `E-082` | — | `UNKNOWN` | `IN_INVENTORY`, `DISPOSED` |

> **TRD-062 — `SM-18` is not a forward march** (`SMA-070`). `UNCLAIMED_PROPERTY → AGREEMENT_ACCEPTED` implements *"accepted into an agreed Trade-In"* — **a customer who declined may still agree later.** `AWAITING_CUSTOMER_DECISION` is likewise re-entered on renegotiation.

> **TRD-063 — Three transitions are guarded and everything else is unguarded, because everything else is judgement** (`SMA-068`).

> **TRD-064 — `CANCELLED` and `DECLINED` are distinct, and merging them would put every abandoned enquiry through the return-shipping path** (`SM-18`, `BD-397`). **`DECLINED` follows a real offer and creates an obligation**; **`CANCELLED` is a withdrawal before any offer exists**, with nothing to return and no cost to assign.

> **TRD-065 — Component progress is an overlay, not a case state** (`SMA-071`). *"Three of five classified"* belongs to `SM-19`; **the case state reflects only whether all are final.** `COMPONENT_CLASSIFICATION` is one case state containing many component lifecycles.

---

# 15. Relationship to other lifecycles

> **TRD-066 — Trade-In is not a return, not an exchange and not a purchase from a supplier.**

| Confused with | Why it is different | Owner of the other |
|---|---|---|
| **Return / Exchange** | A return unwinds a sale Trioloo made. **A trade-in acquires goods Trioloo never sold**, and the decline path is a custody-out movement, **not a sales return** (`BD-395`) | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| **Supplier purchase** | Procurement buys **new goods from a supplier against a purchase order** (`PRC-`). **A trade-in acquires used goods from a customer against a credit**, with no supplier, no PO and no payable | `PROCUREMENT_ARCHITECTURE.md` |
| **Warranty / Repair** | A repair fixes a unit. **A `Repair Required` component may enter `SM-15`**, but the trade-in itself is an acquisition, not a service | `WARRANTY_REPAIR_ARCHITECTURE.md` |
| **A discount on the new sale** | **Explicitly not** — a payment source, so revenue stands at full price (`ACC-039`) | `ACCOUNTING_ARCHITECTURE.md` |

> **TRD-067 — Teardown — one product resolving into many components — is an operation the architecture does not have** (`GAP-103`, `E-082` notes, `ICO §4`).

| | Direction | Exists? |
|---|---|---|
| **`SM-12` Build Job** | **Many components → one product** | **Yes** |
| **Trade-In acceptance** | **One product → many components** | **No** |

⚠ **`PRD-009` separates assembly from bundling; neither describes teardown.** **This is a genuinely new operation, not a variation of an existing one**, and `GAP-103` is carried unresolved. **Nothing is designed here.**

---

# 16. Permissions and audit

> **TRD-068 — No role, authority level or scope dimension is created by this module** (`BD-395`, `BD-110`, `BD-111`, `PRM-`, `AGV-`). *"Authorised business personnel"* is the existing approval model.

> **TRD-069 — Every judgement in this domain is recorded with its reason** (`BD-388`, `BD-395`, `BD-396`, `AUD-042`): the renegotiation and its basis, the return-shipping cost-bearer decision, and the final resolution of unclaimed property. **Audit record structure and retention are `AUDIT_ARCHITECTURE.md`'s.**

> **TRD-070 — Trade-In records are retained permanently; nothing is deleted** (`BD-338`, `BD-341`).

---

# 17. Notification

> **TRD-071 — Two conditions in this domain generate work items, and message generation, transport and delivery evidence are owned by `NOTIFICATION_ARCHITECTURE.md`** (`NOT-`, `BD-382`).

| Condition | Treatment | Rule |
|---|---|---|
| **A component pending classification, blocking a case** | **Action Required** work item with an owner | `NOT-023`, `SMA-072`, `SMA-073` |
| **Property unclaimed** | The ERP **may** remind responsible staff to follow up | `BD-396`, `BD-381` |

---

# 18. Reporting

> **TRD-072 — No Trade-In report is registered in the confirmed V1 report set** (`RPT §`, `SYS-087`, `BD-314`). **This module defines no report and requests none** (`DOC-005`).

> **TRD-073 — Outstanding Trade-In Credit must be reportable as a standing liability, and that requirement is Accounting's** (`ACC-040`, `RPT §`). **`CUS-062` records that it is an Accounting obligation, not a Customer one** — and it is not this module's either.

> **TRD-074 — `UNCLAIMED_PROPERTY` must be reportable, because cases accumulate there without limit** (`SMA-069`). **The requirement is recorded; the report is not defined here.**

---

# 19. Entities and machines referenced

**No entity is defined here and no machine is defined or ratified here.** `DOMAIN_MODEL.md` and `STATE_MACHINE_ARCHITECTURE.md` are canonical (`DOC-005`).

| Entity | ID | Relationship |
|---|---|---|
| **Trade-In Case** | **`E-081`** | **Owned here** — `SM-18`; carries the custody overlay (`WHS-069`) |
| **Trade-In Component** | **`E-082`** | **Owned here** — `SM-19` |
| Trade-In Credit | `E-083` | **Owned by Accounting** (`ACC-039`, `ACC-040`). **Referenced, never held here** |
| Business Case | `E-073` | Links Trade-In cases (`BD-354`); documentation owned by `RETURN_EXCHANGE_ARCHITECTURE.md` (`DOC-054`) |
| Action Queue Item | `E-079` | Generated for blocking classification; owned by `NOTIFICATION_ARCHITECTURE.md` |
| Repair | `E-072` | A `REPAIR_REQUIRED` component may enter `SM-15`; owned by `WARRANTY_REPAIR_ARCHITECTURE.md` |
| Customer | `E-023` | Owned by `CUSTOMER_ARCHITECTURE.md` |

| Machine | Entity | Status |
|---|---|---|
| **`SM-18`** Trade-In Case | `E-081` | ✅ **Ratified** — `SMA §25.1`. **Referenced here, not defined** |
| **`SM-19`** Trade-In Component | `E-082` | ✅ **Ratified** — `SMA §25.2`. **Referenced here, not defined** |
| `SM-15` Repair | `E-072` | A `REPAIR_REQUIRED` component delegates into it (`SMA-072`) |
| `SM-12` Build Job | `E-065` | The **inverse** operation; teardown has no counterpart (`GAP-103`) |

> **TRD-075 — Neither `SM-18` nor `SM-19` is re-ratified, re-scoped, merged or simplified by this document.** Their authority, state sets, transitions and terminal semantics are exactly as `SMA §25` records them.

---

# 20. Cross-document dependencies

| Direction | Document | What crosses |
|---|---|---|
| **Reads** | `CUSTOMER_ARCHITECTURE.md` | Customer identity (`CUS-062`) |
| **Reads** | `PRODUCT_ARCHITECTURE.md` | Product and SKU structure the components will enter |
| **Reads** | `CHAT_ARCHITECTURE.md` | A conversation a request may arrive through |
| **Writes to** | `INVENTORY_COSTING_ARCHITECTURE.md` | The agreed value and completed classification, which gate allocation (`ICO-016`) |
| **Writes to** | `INVENTORY_ARCHITECTURE.md` | Completed allocation, which gates inventory creation (`IVN-030`) |
| **Writes to** | `ACCOUNTING_ARCHITECTURE.md` | The accepted agreement, which creates the credit liability (`ACC-039`) |
| **Writes to** | `WAREHOUSE_ARCHITECTURE.md` | The custody state consumed by physical holding (`WHS-069`) |
| **Writes to** | `WARRANTY_REPAIR_ARCHITECTURE.md` | A `REPAIR_REQUIRED` component entering `SM-15` — ✅ **its fourth registered entry point** (`SMA-044` as amended, `WAR-035`) |
| **Writes to** | `NOTIFICATION_ARCHITECTURE.md` | Blocking classification and unclaimed-property follow-up |
| **Writes to** | `DELIVERY_ARCHITECTURE.md` | Inbound and return shipment, where either is a shipment |
| **Peer** | `ORDER_MANAGEMENT_ARCHITECTURE.md` · `PAYMENT_ARCHITECTURE.md` | The linked new sale — ⚠ **Payment carries no Trade-In content, §22** |
| **Governed by** | `STATE_MACHINE_ARCHITECTURE.md` · `DOMAIN_MODEL.md` · `SYSTEM_ARCHITECTURE.md` · `AUDIT_ARCHITECTURE.md` · `PERMISSION_ARCHITECTURE.md` · `ACCESS_GOVERNANCE_ARCHITECTURE.md` · `REPORTING_ARCHITECTURE.md` · `DESIGN_CONSTITUTION.md` | Definitions, invariants, boundaries, audit, authority, reports, presentation |

---

# 21. Open gaps carried

**No gap is closed by this document existing** (`DOC-001`, `DOC-023`).

| Gap | Status | Why it is not closed here |
|---|---|---|
| **`GAP-103`** | 🔴 **STILL OPEN** | **Teardown does not exist in the architecture.** `TRD-067` states the absence precisely; **stating it is not designing it**, and the operation is `PRODUCT_ARCHITECTURE.md`'s and `INVENTORY_ARCHITECTURE.md`'s to define, not this module's |
| **`GAP-104`** | 🟡 **STILL OPEN** | **A salvaged component must not enter the same SKU as new stock** (`DM-077`) — WAC would blend salvage cost into new inventory. **SKU structure is `PRODUCT_ARCHITECTURE.md`'s**; recorded, not resolved |
| **`GAP-105`** | 🟢 **ACCEPTED EXPOSURE** | Valuation on legal transfer of abandoned property. `SYS-103` says such goods never become inventory; `SYS-102` requires a cost if they did. **Two readings, rare enough that the business recorded rather than resolved it** |
| **`GAP-106`** | 🟢 **STILL OPEN** | **Whether billable services exist is unestablished** (`BD-394`) — credit is spendable on *"products or services"*, and `E-072`'s chargeable repair makes services plausible, but no answer states that services are sold and priced. **Noted, not assumed** |
| **`GAP-089`** | 🟡 **STILL OPEN** | Current configuration after repair — reached from here via `TRD-034`; owned as recorded at `IVN §15.1` |
| **`GAP-024`** | 🟡 **STILL OPEN** | No state has a documented time expectation. **`UNCLAIMED_PROPERTY` is the domain's instance and is legitimately unbounded** (`SMA-069`), so **no threshold is appropriate here even when one is set elsewhere** |
| **`GAP-001`** | 🟢 **Satisfied for Trade-In** | The last unregistered owning module is registered. **Whether `GAP-001` closes overall is `GAP_ANALYSIS.md`'s determination**, not this document's |

---

# 22. Reconciliation points carried

**Recorded, not resolved.** Each is a real question no canonical source answers.

| # | Point | Where it sits |
|---|---|---|
| 1 | 🔴 **What happens to Trade-In Credit when the sale it was spent on is returned or cancelled is stated nowhere in the corpus.** Credit is a liability discharged by a sale (`ACC-040`); a return unwinds that sale (`RET-`); **no source says whether the credit is reinstated, forfeited or refunded — and it cannot be refunded, since `INV-83.2` forbids cash.** `TRD-050` records the absence | `ACCOUNTING_ARCHITECTURE.md` · `RETURN_EXCHANGE_ARCHITECTURE.md` |
| 2 | **Credit expiry is deliberately unstated** (`BD-394`). Recorded as ⚠ in `ACC §11.4`, `E-083` and `RPT §`, **but carries no gap number**. Under `BD-338` balances persist indefinitely | `ACCOUNTING_ARCHITECTURE.md` |
| 3 | **`PAYMENT_ARCHITECTURE.md` contains no Trade-In content at all.** `INV-83.5` records *Trade-In Credit Applied* as one of four amounts on a sale, and `ACC-039` owns the posting — **but whether applying credit is a collection mode, and how the receivable is affected, is stated by no `PAY-` rule** | `PAYMENT_ARCHITECTURE.md` |
| 4 | ✅ **RESOLVED 2026-08-09.** A `REPAIR_REQUIRED` component is now `SM-15`'s **fourth registered entry point** (`SMA-044` as amended, `WAR-035`, `TRD-034`). **`SMA-072` always stated the delegation — only the enumeration was stale.** No state, transition, authority or event changed | `STATE_MACHINE_ARCHITECTURE.md` · `WARRANTY_REPAIR_ARCHITECTURE.md` |
| 5 | **`BD-397`'s two judgement calls were flagged *"requires confirmation"* and were adopted into the ratified `SM-18` without a recorded business confirmation** — New Purchase excluded from the case, and `CANCELLED` distinct from `DECLINED`. **Both are carried as ratified** (`TRD-047`, `TRD-064`); **the absence of explicit confirmation is recorded, not treated as a defect** | `STATE_MACHINE_ARCHITECTURE.md` |
| 6 | **`DOMAIN_MODEL.md` §26's reconciliation narrative lists `E-083` under *"Trade-In"* while `E-083`'s own card records its owner as Accounting.** The entity card is canonical (`DOC-005`); the narrative line groups entities **by originating domain, not by owner**. **Recorded so the two are not read as competing claims** | `DOMAIN_MODEL.md` |
| 7 | ✅ **RESOLVED 2026-08-09.** `BUSINESS_DISCOVERY.md` §32 (`BD-430` – `BD-432`) established the missing cross-module reactions, and `EVENT_ARCHITECTURE.md` §21 registers **`EVT-096` – `EVT-100`** — agreement accepted, cost allocation completed, component classification blocked, property unclaimed, courier return required. **`EVA-026` records the occurrences that deliberately publish nothing**, including **every customer-facing moment** (`BD-432`). ⚠ **Two dependencies remain open**: **Inventory has no stock-creation event** (`EVU-15`) and **the credit-application producer is undetermined** (`EVU-16`). **No event is defined or owned here** (`DOC-005`) | `EVENT_ARCHITECTURE.md` |

---

# Appendix A — Rule traceability

**76 rules, `TRD-000` – `TRD-075`, contiguous.** Every rule traces to confirmed discovery or an already-ratified rule.

| Source | Rules |
|---|---|
| `BUSINESS_DISCOVERY.md` §26 (`BD-388` – `BD-397`) | `TRD-002`, `TRD-003`, `TRD-006`, `TRD-009`, `TRD-011` – `TRD-016`, `TRD-018` – `TRD-021`, `TRD-023`, `TRD-024`, `TRD-031` – `TRD-033`, `TRD-036` – `TRD-040`, `TRD-047`, `TRD-048`, `TRD-051` – `TRD-060`, `TRD-064`, `TRD-069`, `TRD-070` |
| `STATE_MACHINE_ARCHITECTURE.md` §25 (`SMA-067` – `SMA-073`) | `TRD-007`, `TRD-025`, `TRD-027`, `TRD-033` – `TRD-035`, `TRD-039`, `TRD-041`, `TRD-058`, `TRD-061` – `TRD-065`, `TRD-074`, `TRD-075` |
| `DOMAIN_MODEL.md` (`E-081` – `E-083`, `INV-81.*`, `INV-82.*`, `INV-83.*`, `DM-075` – `DM-077`) | `TRD-002`, `TRD-006`, `TRD-008`, `TRD-012`, `TRD-022`, `TRD-026`, `TRD-029`, `TRD-030`, `TRD-036`, `TRD-037`, `TRD-044` – `TRD-046`, `TRD-053`, `TRD-056` |
| `INVENTORY_COSTING_ARCHITECTURE.md` (`ICO-011` – `ICO-017`) | `TRD-004`, `TRD-018`, `TRD-022`, `TRD-031`, `TRD-037`, `TRD-038`, `TRD-042` |
| `INVENTORY_ARCHITECTURE.md` (`IVN-030` – `IVN-033`) | `TRD-026`, `TRD-036`, `TRD-038`, `TRD-040`, `TRD-041`, `TRD-043` |
| `ACCOUNTING_ARCHITECTURE.md` (`ACC-039`, `ACC-040`) | `TRD-001`, `TRD-025`, `TRD-044`, `TRD-049`, `TRD-073` |
| `WAREHOUSE_ARCHITECTURE.md` (`WHS-069`, `DOC-058`) · `WARRANTY_REPAIR_ARCHITECTURE.md` (`WAR-035`, `WAR-060`) | `TRD-028`, `TRD-029`, `TRD-034`, `TRD-052` |
| `SYSTEM_ARCHITECTURE.md` (`SYS-102` – `SYS-104`, `SYS-015`, `SYS-103`, `CP-8`) | `TRD-001`, `TRD-003` – `TRD-005`, `TRD-021`, `TRD-026`, `TRD-042`, `TRD-056` |
| Boundary and governance (`DOC-005`, `DOC-006`, `DOC-024`, `DB-001`, `DB-003`, `DM-001`, `AUD-042`, `NOT-023`, `RPT §`, `PRM-052`) | `TRD-000`, `TRD-010`, `TRD-017`, `TRD-046`, `TRD-050`, `TRD-066`, `TRD-068`, `TRD-071`, `TRD-072` |

**Introduced by this document: nothing.** No business rule, entity, state machine, lifecycle, threshold, valuation method, expiry policy, role or automation.

# Appendix B — Amendment Record

| Version | Date | Change |
|---|---|---|
| **1.2.2** | **2026-08-09** | **`TRD-087` updated for the `EVU-16` decision — no `TRD-` rule added or withdrawn.** The receivable is created **gross** and applied credit clears part of it (`PAY-015` preserved). **The ownership line is now explicit in this document's own text**: **Payment orchestrates, Accounting owns `E-083` and publishes `EVT-101`, Delivery owns the COD instruction, and this module owns none of it** — it caused the credit to exist and nothing further |
| **1.2.1** | **2026-08-09** | **`TRD-087` added — one cross-reference; nothing else changed.** `BD-433` confirms **credit is applied before dispatch** and that **the obligation and COD amount are already net**, with the courier never applying the credit. **None of it is owned here** (`TRD-001`, `TRD-044`) — recorded so this module's boundary stays visible from its own text |
| **1.2.0** | **2026-08-09** | **Dependency reconciliation — two findings closed, no rule added or withdrawn.** ✅ **The `DOC-050` cost-bearer conflict is RECONCILED BY SCOPE**: **`BD-395` introduces its four outcomes as *“Examples”*, not an enumeration**, so `BD-430` cannot have narrowed one — **the four remain possible and `CUSTOMER` is the default.** `TRD-053`, `TRD-054` and `TRD-080` were already consistent and are unchanged; **no outcome was added, removed or chosen.** ✅ **`TRD-034`'s caveat is withdrawn**: a `REPAIR_REQUIRED` component is now `SM-15`'s **fourth registered entry point** (`SMA-044` as amended) — **a stale enumeration corrected, not a business decision**, since `SMA-072` always stated the delegation. **No `TRD-` rule was added, amended or withdrawn**, and `TRD-000` – `TRD-086` stand as ratified |
| **1.1.1** | **2026-08-09** | **Reconciliation point 7 RESOLVED — no rule changed.** `SM-18` and `SM-19` now have registered events: **`EVT-096` – `EVT-100`** in `EVENT_ARCHITECTURE.md` §21, justified by §32 (`BD-430` – `BD-432`). **No event is defined, named or owned by this document** (`DOC-005`), and **`TRD-000` – `TRD-086` stand exactly as ratified.** ⚠ **Two event-contract dependencies remain open** — the Inventory stock-creation event (`EVU-15`) and the credit-application producer (`EVU-16`) — **and the `DOC-050` cost-bearer conflict, credit reversal and the `REPAIR_REQUIRED` → `SM-15` defect are all unchanged** |
| **1.1.0** | **2026-08-09** | **§32 discovery consolidated — `TRD-076` – `TRD-086` added; no existing rule amended or withdrawn.** **§13.1a** records `BD-430`'s **two return methods**, that **`DECLINED` must never imply a courier shipment exists**, that the method is **data not a state**, and that return handling **transfers no ownership and creates no inventory**. **§12.1a** records `BD-431`'s **full and partial credit application**, that applying credit **reduces Amount Payable without rewriting the Order Total**, that **application and settlement are separate financial facts**, and the **four-part traceability** requirement — all of it **owned by Accounting and Order Management, not here** (`TRD-001`, `TRD-044`). **§12A** records `BD-432`: **Trade-In requires no automatic customer notification at any transition**, removing a capability area as `BD-335` did for loaners. ⚠ **A `DOC-050` conflict is recorded and left open** — `BD-430` names two cost-bearer values with a `CUSTOMER` default against `BD-395`'s four including *shared by agreement*; **the default is adopted (`TRD-080`), the narrowing is not, and `TRD-053`/`TRD-054` stand unamended.** **Credit reversal remains explicitly unresolved** |
| **1.0.1** | **2026-08-09** | **Reconciliation point 7 updated — no rule changed.** `EVENT_ARCHITECTURE.md` §19 now records that **`SM-18` and `SM-19` have no registered event and no canonical evidence that one exists** (`EVA-020`), and that **`BD-385` forecloses inferring one from the Action Queue work `SMA-072`/`SMA-073` require** — Business Event → Action Queue Item is *zero, one or many*. **The point is carried, not resolved** |
| **1.0.0** | **2026-08-09** | **Initial ratification — closes the last module registration defect.** Consolidates `BUSINESS_DISCOVERY.md` §26 (`BD-388` – `BD-397`) with the reconciliations at `SMA §25`, `SYS §23` and `DOMAIN_MODEL.md` `E-081` – `E-083`. **76 rules (`TRD-000` – `TRD-075`), all traceable; no business rule, entity, state machine, lifecycle, valuation method or expiry policy introduced.** **`E-081` and `E-082` now have a registered owning module**; from `DOMAIN_MODEL.md` v3.7.0 (2026-08-08) until today their ownership line named a module that appeared in no register, held no prefix and had no document. **`E-083` Trade-In Credit stays with Accounting** (`ACC-039`, `ACC-040`) — `TRD-001` and `TRD-044` record that this module is **not a second system of record for money**, holding no balance and posting nothing. **`SM-18` and `SM-19` are referenced and neither re-ratified** (`TRD-075`). **The module is deliberately narrow**: allocation is Costing's, stock is Inventory's, custody-in-fact is Warehouse's, and the credit is Accounting's — **every one of those assignments predates this document and is retained unchanged.** **Seven gaps carried, none closed.** **Seven reconciliation points recorded**, the sharpest being that **no canonical source says what happens to Trade-In Credit when the sale it was spent on is returned** |

---

*This document specifies Trade-In business architecture only. It contains no UI specification, database design, SQL, API contract, or code.*
