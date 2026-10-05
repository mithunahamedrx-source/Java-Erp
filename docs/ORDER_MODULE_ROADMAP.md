# Order Module — implementation roadmap

**Owner:** Trioloo Engineering · **Status:** 📌 **WORKING RECORD — NOT CANONICAL ARCHITECTURE**
**Version:** 1.2.0 · **Established:** 2026-08-24 · **Updated:** 2026-10-05 · **Rule prefix:** none, by design

> ⚠ **THIS DOCUMENT LEGISLATES NOTHING.** It sequences work already decided elsewhere and records
> where each phase stands. **It issues no rule, defines no business behaviour and closes no gap.**
> 🔴 **If it ever appears to conflict with a canonical document, the canonical document wins.**

---

## The per-phase discipline

**Product owner's instruction, 2026-08-24. Every phase runs in this order and none is skipped.**

| Step | What it means | Refused if |
|---|---|---|
| **1. Page contract** | Find the owning `OSC-` frame or screen-contract rule for the surface | No contract exists → **STOP and report** |
| **2. API check** | Prove the backend contract matches the page contract — field by field | Any mismatch → **fix the mismatch, never the contract** |
| **3. Design** | Repo reference if one exists; otherwise **Claude Design** | No reference and no Claude Design → **STOP, do not invent** |
| **4. Build** | Implement, test, run the gate | Gate red → **not done** |
| **5. Report** | State what shipped, what was refused and why | — |

🔴 **`CLAUDE.md` §5 still governs throughout: no business rule is invented at any step.**
⚠ **A phase is finished when its gate is green — not when its code compiles.**

---

## Phases

### ✅ Phase 1 — Capability codes · **DONE**

| | |
|---|---|
| **Page contract** | ⬜ **N/A** — no surface; this phase creates authority, not a screen |
| **API check** | ⬜ N/A |
| **Design** | ⬜ N/A |
| **Canonical basis** | `PRM-092`, `PRM-093`, `PRM-089` |

**Shipped.** `delivery.shipment.book` · `.track` · `.cancel` · `payment.courier-remittance.view` ·
`order.order.create`. Migration `V20` seeds them **with zero holders** — `PRM-003` denies what was
never granted and `PRM-081.b` forbids a deployment handing out authority.

🔴 **One correction to the owner's own proposal, derived from the docs:** the remittance code is
`payment.courier-remittance.view`, **not** `delivery.…`. **`PAY-022` and `DLV §23` both place
`E-042` with Payment, and `PRM-089.a` requires the owning module to name the code.**

✅ **This closes `GAP-138.g`** — `DLV §22` had required every dispatch to be permissioned and
attributable since ratification, with no code to enforce it.

---

### ✅ Phase 2 — Steadfast booking · **DONE** (single order and selected bulk, 2026-09-06; `V21`)

| | |
|---|---|
| **Page contract** | `OSC-` — the booking action's surface must be found before any UI |
| **API check** | `STF-010` fields against `E-037` Shipment and `DLV-023` address snapshot |
| **Design** | ⬜ Deferred — this phase is backend only |
| **Canonical basis** | `DLV-013`, `DLV-018`–`DLV-023`, `BR-023`, `SM-4`, `PRM-092` |

**Owner's decisions, 2026-08-24:**
- ✅ **`invoice` sent to the courier is the Trioloo invoice number** (`TR0001`, `OSC-057`).
- 🔴 **ONE INVOICE BOOKS EXACTLY ONCE.** ⚠ This is the ERP's own guarantee and must not depend on
  the provider honouring it — `STF-010.b` records that duplicate-`invoice` behaviour is unknown,
  and `BR-023` allows an order **at most one ACTIVE shipment**.
- ✅ **One controlled real booking is authorised**, to observe what `STF-010` and `STF-011` could
  not: the `delivery_status` vocabulary, the charge fields, and what a duplicate actually does.

⚠ **The booking is real, costs money and dispatches a rider.** ✅ **It is therefore ONE booking,
recorded, with its consignment id reported so it can be cancelled from the provider's panel.**

---

### ⬜ Phase 3 — `SM-4` status mapping

| | |
|---|---|
| **Blocked on** | Phase 2's observation — `STF-011` refuses to guess the vocabulary |
| **Canonical basis** | `SM-4`, `DLV-024`–`DLV-030`, `BR-005`, `OM §4.3` |

🔴 **The translation belongs to the ADAPTER**, exactly as the Daraz→`SM-1` translation does.
🔴 **An unknown courier status is never coerced** (`BR-007`, `SYS-034`).
🔴 **`LOST` is entered only on the courier's official confirmation — no elapsed-time threshold may
be invented** (`DLV-027`, `DLV-028`).

---

### ⬜ Phase 4 — Booking id on the order card

| | |
|---|---|
| **Page contract** | `OSC-055` / `OSC-056` — the Order Card |
| **Design** | ✅ **Repo reference exists** — `design-reference/Order Card DS.md` |
| **Owner's decision** | **A booked order shows its booking id on the card.** |

---

### ⬜ Phase 5 — Invoice document

| | |
|---|---|
| **Page contract** | ⚠ **None yet** — `OSC-` has no invoice frame; one must be added |
| **Design** | ✅ **Repo reference exists** — `design-reference/TrioLoo Invoice.html` |
| **Canonical basis** | `PRN-023`, `INV-39.1`, `INV-39.2`, `E-039`, `OSC-057` |

**Owner's decisions, 2026-08-24:**
- ✅ **The invoice carries VAT / tax.**
- ✅ **Reference numbers sit AFTER the main ERP invoice number** — the booking id and the
  Daraz/website order number are **references**, never the identity.

🔴 **`GAP-003` STILL SUPPLIES NO RATE, BIN, MUSHAK REQUIREMENT OR CALCULATION.** ✅ **`BD-307`
permits VAT to be DISPLAYED as an invoice field while the ERP maintains no VAT accounts** — ⚠ **so
the field is legitimate and the NUMBER in it is not yet derivable.** **This is an open question
for the owner, recorded rather than guessed.**

🔴 **`INV-39.2` requires the invoice's content SNAPSHOTTED so it stays reproducible years later.**
**No `E-039` record exists; creating one is this phase's real work.**

---

### ⬜ Phase 6 — Create Order

| | |
|---|---|
| **Page contract** | ⚠ **None** — `GAP-035` and `GAP-023` describe the legacy modal, not a contract |
| **Design** | 🔴 **NO REPO REFERENCE — Claude Design required** (owner's instruction) |
| **Canonical basis** | `PRM-093`, `OM §22`, `PRD-139`, `BR-145`, `BR-148`, `BR-168` |

**Owner's decision, 2026-08-24:** ✅ **A manual order starts at `PENDING_VERIFICATION`**, the same
state an imported order arrives in, so both enter one verification queue.

⚠ **Still open:** whether partial payment may be taken at creation (`GAP-035`, and `§11.3`'s
`NOT_DUE` says payment is not due before delivery), and the abandoned-form disposition (`GAP-023`).

---

### ✅ Phase 7 — Order flow simplification and the end-to-end core · **DONE 2026-10-03**

| | |
|---|---|
| **Page contract** | `OSC-062` · `OSC-030.a` (superseded) |
| **Canonical basis** | `OM §30` — `BR-184`, `BR-185` (added by the owner's decision) |
| **Migration** | `V26__order_auto_confirmation_and_effective_status.sql` |

**Owner's decisions, 2026-10-03:**
- ✅ **No human verification step.** Every order — imported or manual — is **confirmed automatically on arrival and the decision is recorded** (`AUTO_CONFIRMED`, reason `VERIFICATION_NOT_REQUIRED`); no person is named as confirmer.
- ✅ **`Pending verification`, `Released`, `In fulfilment` and `Courier booked` are not status tabs.** The states stay in `SM-1`; the strip groups them under the tab they lead to and the card shows the exact stage as a hover title.
- ✅ **Scope: the core flow first.**

**What the flow is now, end to end**
1. **Arrives** — Daraz pull (every 5 min as deployed) or manual `Create Order` → **Confirmed** automatically.
2. **Send to Steadfast** — single or selected bulk, once per invoice (`V21` unique indexes) → reads **Ready to ship** (courier booked).
3. **Tracking** — manual refresh per order, plus a **scheduled courier pull** (`trioloo.delivery.tracking.enabled`, off by default, `PT30M`) → **Delivered** when the courier reports `delivered`.
4. **Invoice** — `E-039` snapshot, 0% VAT for now.

**Shipped:** auto-confirmation record · derived effective status (tabs, counts, collectable, card, detail) · scheduled tracking · `Today's dispatched` stamped from courier states · tab strip and copy · `FRAME 02` confirmation facts.

🔴 **NOT BUILT, AND WHY (each needs an owner decision or a ratified rule — none is invented):**
| Item | Blocker |
|---|---|
| ~~**Cancel order** (pre-dispatch)~~ | ✅ **BUILT 2026-10-05** — `PRM-095`, `OM BR-186`, `OSC-063`, migration `V27`. One order at a time; refused while a courier shipment is live (`STF-016`) |
| **Restore order** | ✅ **BUILT 2026-10-05** — `OM BR-187`, `BR-172` |
| **Hold / release hold / release reserved quantity** | No capability ratified; `BR-149`–`BR-152` define behaviour but no code exists |
| **`Dispatched` for Steadfast parcels** | Only `in_review`, `delivered`, `cancelled` translate (`STF-011`); `pending` is refused. **Owner decision:** map `pending`, or ratify a hand-over act and its capability |
| **`Failed delivery` from Steadfast** | The courier publishes no failed-delivery word in its observed vocabulary (`GAP-140` is the sibling for partial delivery) |
| **Inventory reservation at confirmation** (`BR-096`) | Inventory side of orders not built in this slice |
| **Payments / remittance reconciliation, returns, exchange** | Later phases; `GAP-019`, `GAP-003`, `GAP-035` |

⚠ **Migration number:** `V26` was taken from the repository ceiling. **`DEP-031` pre-flight against production `flyway_schema_history` is still owed before deploying** (`OSC-060.f`, `DEP-070.b`).

---

## Open questions carried

| # | Question | Owning gap |
|---|---|---|
| 1 | **The VAT rate, and whether a BIN/Mushak field is required** | `GAP-003` |
| 2 | **Partial payment at order creation** — conflicts with `NOT_DUE` | `GAP-035` |
| 3 | **Abandoned capture form disposition** | `GAP-023` |
| 4 | **Bulk action inventory** — `Send to Steadfast`, `Print invoices` | `GAP-034` |
| 5 | **Courier rate structure** — no rate is exposed by the API | `GAP-138.e` |
| 6 | **Steadfast `pending` → which order state?** Or ratify a hand-over act | `OM §30.2.e` |
| 7 | **Hold capability** — code to ratify before hold / release hold can exist (cancel and restore are done) | `PRM-089.f` |

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.2.0** | **2026-10-05** | **Cancel and restore built** (`PRM-095`, `OM §31`, `V27`). Hold remains blocked on a capability code. |
| **1.1.0** | **2026-10-03** | **Phase 2 recorded DONE; Phase 7 added** — owner removed the verification step and the Released / In fulfilment / Courier booked tabs; core flow built (auto-confirmation, effective status, scheduled tracking). Cancel, hold and automatic Dispatched are listed as blocked with their reasons. |
| **1.0.0** | **2026-08-24** | **Initial record.** Sequences the Order module into six phases and fixes the per-phase discipline the product owner instructed: **page contract → API mismatch check → design → build → report**. ✅ **Phase 1 DONE.** 🔴 **Issues no rule and closes no gap; five open questions carried explicitly rather than resolved.** |
