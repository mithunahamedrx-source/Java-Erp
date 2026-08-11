# Chat Architecture

**Owner:** Trioloo Technology · **Module:** Chat · **Status:** Canonical
**Version:** 1.2.0 · **Ratified:** 2026-08-08 · **Rule prefix:** `CHT-`

---

## Document Control

**Source of truth:** [`BUSINESS_DISCOVERY.md`](BUSINESS_DISCOVERY.md) §23 Chat Integration (`BD-355` – `BD-366`), with the two ratified concepts `BD-367` and `BD-368`, and prior coverage at `BD-317`, `BD-322`, `BD-326`, `BD-327`, `BD-329`, `BD-352`, `BD-354`, `BD-360`, `BD-361`.

**Reconciliation records consolidated:** [`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) §23.1 (`SM-16`, `SMA-058` – `SMA-063`) · [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-074` – `E-076`, `DM-065` – `DM-067` · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) §21 (`SYS-096`, `SYS-097`).

**References, never duplicated:** [`CUSTOMER_ARCHITECTURE.md`](CUSTOMER_ARCHITECTURE.md) · [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) · [`RETURN_EXCHANGE_ARCHITECTURE.md`](RETURN_EXCHANGE_ARCHITECTURE.md) `RET-` · [`NOTIFICATION_ARCHITECTURE.md`](NOTIFICATION_ARCHITECTURE.md) `NOT-` · [`API_ARCHITECTURE.md`](API_ARCHITECTURE.md) `API-` · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) · [`ACCESS_GOVERNANCE_ARCHITECTURE.md`](ACCESS_GOVERNANCE_ARCHITECTURE.md) `AGV-` · [`AUDIT_ARCHITECTURE.md`](AUDIT_ARCHITECTURE.md) · [`DELIVERY_ARCHITECTURE.md`](DELIVERY_ARCHITECTURE.md) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) for all presentation.

## ⚠ Ownership boundary

> **CHT-000 — This document answers *what was communicated with a customer, on which channel, by whom, and in what state that communication stands*. It answers nothing about who the customer is, what business process the communication concerns, how the channel is technically reached, or who is permitted to act.**

| Question | Owner |
|---|---|
| **The communication record, its channel identity, its ownership and its state** | **`CHAT_ARCHITECTURE.md`** — `CHT-` |
| **Who the customer is** — the Customer Profile, identity, contacts, credit, blacklist | [`CUSTOMER_ARCHITECTURE.md`](CUSTOMER_ARCHITECTURE.md) — `CUS-` |
| **What business issue the communication concerns** — the Business Case | `RETURN_EXCHANGE_ARCHITECTURE.md` (documentation, `DOC-054`) · System (data) |
| **How the channel is reached** — adapters, capability, sync, idempotency, provenance | `API_ARCHITECTURE.md` — `API-` |
| **System-initiated one-way messaging and the Action Queue** | `NOTIFICATION_ARCHITECTURE.md` — `NOT-` |
| **Order lifecycle and order-verification workflow** | `ORDER_MANAGEMENT_ARCHITECTURE.md` — `BR-` |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` — `SM-16`, `SMA-` |
| **Who may read, reply, reassign or close** | `PERMISSION_ARCHITECTURE.md` · `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| **Audit record structure, evidence packages, retention policy** | `AUDIT_ARCHITECTURE.md` · `SYS-101` |

> **This document consolidates confirmed decisions only.** No business rule, entity, state machine, lifecycle, threshold, template, automation or SLA is introduced. **No gap is resolved by assumption** — see §19.

> Contains no code, schema, API contract, or user interface specification.

---

# 1. Purpose

To hold the record of **two-way conversation with a customer**, across every channel that carries it, in a business whose dominant operational cost is coordination rather than difficulty.

`BD-366` states the problem in the business's own words:

> **The greatest cost is staff time spent switching between platforms, searching for customer information, and manually coordinating communication across different systems.**

**This is the third domain to report coordination as the dominant cost** — after marketplace instance multiplication (`BD-328`) and return coordination across processes (`BD-353`). `SYS §21` records the conclusion the three converge on: **integration beats capability.**

**The domain's hardest problem was identity, and it is solved by refusing to solve it.** `BD-327` recorded that cross-channel identity resolution was unsolved; `BD-357` makes the uncertainty **representable** instead — *you do not need to know who someone is in order to serve them.*

---

# 2. Scope

## 2.1 In scope

The Conversation record and its channel binding · **Channel Identity** and its relationship to the Customer · Internal Notes · the shared inbox and soft assignment · the reply lock · conversation-to-record linking and its confirm discipline · conversation state as applied · the two ageing overlays · attachment capability per channel · reopening and continuity · conversation history and its permanence.

## 2.2 Out of scope — owned elsewhere

| Topic | Owner |
|---|---|
| **The Customer Profile, identity linking policy, contacts, credit, blacklist** | `CUSTOMER_ARCHITECTURE.md` ✅ |
| **The Business Case — its definition, closure and classification** | `RETURN_EXCHANGE_ARCHITECTURE.md` (`DOC-054`), System (data) |
| **Adapter capability, sync lifecycle, idempotency, provenance, raw payload retention** | `API_ARCHITECTURE.md` |
| **System-initiated notification, the Action Queue, delivery evidence** | `NOTIFICATION_ARCHITECTURE.md` |
| **Order lifecycle, verification workflow, order-related phone contact** | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| **Return, exchange, warranty and repair lifecycles** | `RETURN_EXCHANGE_ARCHITECTURE.md`, [`WARRANTY_REPAIR_ARCHITECTURE.md`](WARRANTY_REPAIR_ARCHITECTURE.md) |
| **State and transition definitions** | `STATE_MACHINE_ARCHITECTURE.md` |
| **Authorisation, scope, operational identity** | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| **Audit architecture, evidence packages, disposal authority** | `AUDIT_ARCHITECTURE.md`, `SYS-101` |
| Screen layout, inbox presentation, density | `DESIGN_CONSTITUTION.md` (`SYS-047`) |

## 2.3 Explicitly excluded by the discovery itself

> **CHT-001 — AI and bot behaviour were excluded from §23 by instruction, and no rule is written for them here.**

§23's scope line states it directly: *"AI is excluded from this discovery. `BD-322` recorded a future AI capability with the guardrail that its output enters through the same approval path as human input. **It must not influence today's answers**."*

**`BD-322`'s guardrail is recorded, not extended:** any future AI output would enter through the same approval path as human input. **Nothing further is specified** (`DOC-024`).

---

# 3. Architectural Principles

## 3.1 P1 — Relate, never collapse

> **CHT-002 — Records that concern the same person or the same issue are linked, never merged** (`BD-357`, `INV-75.3`, `DM-067`).

**`SYS §21` records this as one principle appearing three times:** Daraz's decision versus Trioloo's inspection (`BD-325`), mirrored channel data (`SYS-010`), and channel identity versus customer (`BD-357`). **`BD-363` adds a fourth** — conversations on two channels are two records unified by a case, not one merged thread.

## 3.2 P2 — Channel binding is permanent

> **CHT-003 — A conversation retains its Channel Identity and Shop Identity throughout its lifecycle. It cannot be moved, merged into another channel's thread, or re-attributed** (`INV-74.1`, `BD-356`).

## 3.3 P3 — Suggest and confirm; never attach automatically

> **CHT-004 — Where the ERP identifies a probable related record it suggests it; a staff member confirms before the link is made** (`BD-358`).

**`PRD-056`'s pattern for the third time** — after non-catalogued line mapping and preferred supplier (`BD-295`). **The reasoning transfers exactly:** a wrong link attaches a conversation to **the wrong customer's order**, which is visible to the customer and hard to unwind.

## 3.4 P4 — Ageing produces visibility, never action

> **CHT-005 — An ageing threshold highlights a conversation; it never closes, escalates or acts on one** (`SMA-062`, `BD-364`, `BD-365`).

**Stated independently four times across the discovery** — warranty running long, advance exchange overdue, conversation SLA, and customer inactivity.

## 3.5 P5 — Communication is a business record, not an announcement

> **CHT-006 — A conversation is two-way and either-party-initiated; a notification is one-way and system-initiated. They interact and must never be conflated** (§23 boundary note, `NOT-001`).

## 3.6 P6 — Every communication act is attributable

> **CHT-007 — Every reply, assignment, reassignment, note, link and closure is attributable to an Operational User Profile** (`AGV-001`, `AUD-004`, `PRM-005`).

---

# 4. Entities Owned

> **CHT-008 — Chat owns three entities, all defined in `DOMAIN_MODEL.md` and none defined here** (`DOC-005`).

| Entity | Purpose |
|---|---|
| **`E-074` Conversation** | The durable communication thread for **one channel identity** — lifecycle `SM-16` |
| **`E-075` Channel Identity** | A **channel-scoped customer identity** — shop + channel-side username |
| **`E-076` Internal Note** | Staff-only content on a conversation |

## 4.1 ⚠ There is no Message entity, and none is invented

**`DOMAIN_MODEL.md` models communication at the *conversation* level.** `E-074` carries **Last Customer Reply** and **Last Business Reply** as attributes; `E-076` carries Internal Notes; `E-054` Attachment carries media. **No entity represents an individual customer-visible message.**

> **CHT-009 — Message-level structure is not modelled in the ratified set, and this document does not introduce it** (`DOC-024`, `DM-001`).

**Recorded as an observation for `DOMAIN_MODEL.md`, not as a defect to fix here.** Every behaviour §23 confirmed — assignment on first reply, the reply lock, reopening on a customer message, SLA measurement, inactivity — is expressed at conversation level and needs no message entity to state.

---

# 5. Channel Identity

> **CHT-010 — A conversation always has a Channel Identity; a Customer may be unknown** (`E-075`, `BD-357`).

| Layer | Always exists? | Scope |
|---|---|---|
| **Channel Identity** | **Yes** | **Shop + channel-side username** |
| **Customer** | **No** — may be unknown | The real person |
| **The link between them** | **Only when reliable evidence exists** | Opportunistic |

> **CHT-011 — A marketplace username alone is not a verified customer identity** (`INV-75.1`, `BD-357`).

> **CHT-012 — Channel Identity is scoped to its issuing shop, not to the marketplace globally** (`INV-75.2`). **`DB-013` applied to people** — external identifiers are stored with their issuing party, *"because a channel identity that dropped its shop scope would collide the day a second marketplace arrives."*

> **CHT-013 — Linking a Channel Identity to a Customer never merges them; both are preserved** (`INV-75.3`, `BD-357`).

> **CHT-014 — Cross-channel identities are never merged automatically. Reliable matching evidence is required: phone number · email address · order information · explicit customer confirmation** (`INV-75.4`, `BD-357`).

**The evidence list is the business's own and is not extended.** `BD-357` records email as *"a minor addition, not assumed to exist today"* — it appears as a matching signal and is not listed among `BD-029`'s profile contents.

> **CHT-015 — Cross-channel matching assists staff and must never automatically merge uncertain identities** (`BD-357`).

**`BD-357` records why this is correct rather than merely cautious:** *"an unmatched identity costs convenience; a wrongly matched one costs trust."* A wrong merge surfaces one customer's history inside another's thread — **a correctness failure and a privacy failure at once.**

## 5.1 ⚠ The reconciliation point is carried, not resolved

**`INV-23.1` states that on marketplace channels the Customer record is *"a mirror, never locally edited"*** (`SYS-010`, `BR-003`). **`BD-173` establishes that every marketplace order produces a Customer Profile that accumulates Trioloo's own order and activity history.**

**A reading exists under which Channel Identity is the externally-owned mirror and the Customer Profile is Trioloo's own record.** ⚠ **The canonical sources do not state it.** `E-075` is defined as *a channel-scoped customer identity*; **nothing describes it as the mirror**, and `INV-75.2` cites `DB-013` — identifier storage — not mirror authority. `INV-23.1` attaches mirror-ness to `E-023` Customer.

> **CHT-016 — This document does not assert that Channel Identity is the marketplace-owned mirror. The `INV-23.1` reconciliation point is carried unchanged** (`DM-001`, `DOC-023`, `DOC-050`).

**Recorded for `DOMAIN_MODEL.md`. Manufacturing the distinction because it would make the model cleaner is precisely what `DOC-030` forbids.**

---

# 6. The Conversation

> **CHT-017 — `E-074` Conversation is the durable communication thread for one channel identity, and it outlives every case that touches it** (`E-074`).

> **CHT-018 — Conversation history is permanent and continuous, and is never split or duplicated because of Business Case changes** (`INV-74.2`, `BD-368`).

**`E-074` records why both temptations are foreclosed:** splitting the thread per case destroys the continuity `BD-362` requires; **duplicating messages into each case violates `CP-12` directly**, because two copies eventually disagree. **The conversation is the single record; cases reference it.**

> **CHT-019 — Each communication channel is an independent conversation record** (`BD-363`). A Daraz Chat conversation and a WhatsApp conversation remain separate — *"each channel has its own identity, history, and technical limitations."*

> **CHT-020 — Multiple conversations may be linked to the same Business Case, and the ERP displays the relationship in both directions** (`BD-363`): from a case, every linked conversation regardless of channel; from a conversation, every other conversation on the same case.

**`DM-067` records the consequence: the Business Case unifies conversations across channels *without needing identity resolution*.** That is what makes `CHT-014`'s prohibition affordable.

---

# 7. Assignment and the Reply Lock

> **CHT-021 — Every conversation starts unassigned in a shared inbox** (`BD-355`, `BD-356`).

> **CHT-022 — Assignment is automatic on the first reply. There is no claim step** (`BD-356`).

**`E-074` records the reasoning as `CP-6` applied precisely:** *the act of helping the customer is the act of taking responsibility*, so nothing is added between intent and action.

> **CHT-023 — After assignment, only the assigned user may reply; any authorized user may read** (`INV-74.3`, `BD-356`).

> **CHT-024 — The reply lock is concurrency control, not confidentiality** (`INV-74.3`). Its stated purpose is *"preventing multiple staff from replying to the same active conversation"* — **it restricts writing only**, and is not a `PRM-011` sensitivity restriction.

> **CHT-025 — Ownership transfers by two routes** (`BD-355`, `BD-356`): **"Assign to Me"**, where the new owner pulls and the previous owner loses reply permission; and **authorized reassignment**, where a third party pushes.

> **CHT-026 — The assigned user is responsible until completion** (`BD-355`).

> **CHT-027 — Current owner, assignment history, assignment time and reassignment history are all recorded** (`BD-355`, `E-074`). **Three of the four are historical** — `DB-068` change history and `AUD-004` attribution already cover this; what is new is that **ownership is one of the things that must carry a history.**

> **CHT-028 — Internal notes make the reply lock workable** (`E-074`). A locked reply would otherwise force a colleague to seize the conversation to contribute; **a note contributes without taking ownership.**

## 7.1 The shared inbox

> **CHT-029 — The shared inbox spans every channel and every shop, and is where the pull happens** (`BD-355`, `BD-356`, `BD-326`, `BD-317`). Staff take work **from one place, not from seven** marketplace streams.

> **CHT-030 — Seven inbox filters are confirmed** (`BD-356`): **Marketplace/Channel · Shop/Seller Account · Assigned User · Unassigned Chats · Conversation Status · Customer · Date Range.**

**Inbox presentation is governed by `DESIGN_CONSTITUTION.md`** (`SYS-047`); this document states only which filters the business confirmed.

---

# 8. Linking to Business Records

> **CHT-031 — The ERP may suggest related records; staff review and confirm before the link is made** (`BD-358`, `CHT-004`).

> **CHT-032 — Five suggestion signals are confirmed** (`BD-358`): **Order Number · Phone Number · Marketplace Order ID · Customer Identity · Product Reference.**

> **CHT-033 — Six link targets are confirmed** (`BD-358`): **Customer · Order · Product · Warranty Case · Return Case · Exchange Case.**

> **CHT-034 — Where no reliable match is found, staff may manually attach the conversation to the appropriate business records** (`BD-358`).

> **CHT-035 — A conversation may be linked to multiple related business records, at any stage of its lifecycle** (`BD-358`, `BD-359`).

> **CHT-036 — All manual links and changes are recorded in the conversation history** (`BD-358`).

## 8.1 ⚠ Direct linkage versus linkage through the case — `GAP-096`

**Two shapes are described in the ratified set and neither has been chosen:**

| Reading | Shape | Source |
|---|---|---|
| **Direct** | Conversation → Warranty · Return · Exchange individually | **`BD-358`** |
| **Via the case** | Conversation → **Business Case** → those lifecycles | **`BD-354`**, `BD-367`, `BD-368`, `DM-067` |

**`CP-12` exists to prevent two paths to one relationship.** `GAP-096` records a plausible reconciliation — a case may not yet exist when a conversation is linked, making direct links an **early-binding artefact** rather than a parallel model — **but that is not stated and is not assumed.**

> **CHT-037 — Both linkage forms are recorded as confirmed by their sources, and the choice between them is not made here** (`GAP-096`, `DM-001`, `DOC-050`).

---

# 9. Conversation Lifecycle

> **CHT-038 — `SM-16` Conversation is owned by `STATE_MACHINE_ARCHITECTURE.md`. Its states and transitions are not restated here** (`DOC-005`, `SYS-016`).

`NEW` · `ASSIGNED` · `IN_PROGRESS` · `WAITING_FOR_CUSTOMER` · `WAITING_FOR_BUSINESS` · `RESOLVED` · `CLOSED`

> **CHT-039 — `SM-16` is ratified within `STATE_MACHINE_ARCHITECTURE.md` and is not one of the four proposed extensions** (`SMA-001`). It carries no ⚠ marker in the machine index, unlike `SM-3`, `SM-6`, `SM-10` and `SM-11`. **This document references it and does not ratify it.**
>
> *Update 2026-08-09 — those four were ratified into `OM §18.2` by `BR-142`, so the contrast this rule draws is now historical. `CHT-039`’s substance is unaffected: `SM-16` was never one of them, and this document still does not ratify any machine.*

✅ **Corrected 2026-08-09 in the owning document.** `OM §18.2` now registers **eleven** machines (`BR-142`) and states explicitly that `SM-12` – `SM-20` exist but are not yet registered there. **The observation this document recorded was acted on where it belonged**, not here.

> **CHT-040 — `SM-16` is the first cyclic machine in the architecture** (`SMA-058`). *"A conversation is a back-and-forth by nature, and a model forcing it forward only would misrepresent the commonest thing it does."*

> **CHT-041 — `CLOSED` is reversible, and reopening is automatic** (`SMA-059`, `BD-362`). A customer message after `RESOLVED` or `CLOSED` reopens the conversation; **history remains continuous.**

**`SMA-059` records why reopening is mechanical rather than a decision:** *a message arrived, so the conversation is active again.* **Which Business Case it belongs to is a judgement, and that one is left open.**

> **CHT-042 — Three things are orthogonal to `SM-16` and none is a state** (`SMA-060`): **linkage to business records · internal notes · the ageing flags.**

**`BD-359` lists *"Linked to Business Case"* sixth in its sequence and it is not a state** — *a thing that can happen at any point is not a sequential state.*

> **CHT-043 — Conversation Status is the operational state used by inbox filtering** (`BD-359`).

## 9.1 Resolved and Closed

> **CHT-044 — `RESOLVED` means the customer's issue has been answered or operational work is complete; `CLOSED` means no further communication or business action is expected** (`BD-359`, `BD-362`).

> **CHT-045 — Closure is a human act with a named actor.** `Closed By` and `Closed Date` are recorded (`BD-365`, `SMA-062`, `AUD-004`).

---

# 10. Ageing Overlays

> **CHT-046 — `Overdue` and `Inactive` are overlay flags, not states** (`SMA-061`, `E-074`).

**The business's own wording settles it:** a conversation *"**remains in** Waiting for Customer"* **and** is *"**marked as** Inactive"* — both at once, which no lifecycle state permits.

| Lifecycle state | Overlay | Whose silence | Threshold |
|---|---|---|---|
| `WAITING_FOR_BUSINESS` | **`Overdue`** | **Trioloo's** | **10 minutes**, configurable (`BD-364`) |
| `WAITING_FOR_CUSTOMER` | **`Inactive`** | The customer's | **Configurable period** (`BD-365`) |

> **CHT-047 — The First Response SLA default is 10 minutes and is configurable by authorized users in system settings, without changing the business workflow** (`BD-364`).

> **CHT-048 — First Response Time is measured from the customer's latest unanswered message until the first business reply** (`BD-364`).

⚠ **`GAP-094` is carried:** *"latest"* means each new inbound message **restarts the clock**, so a customer who keeps writing would never appear `Overdue`, however long they have waited. **The wording says *latest*; the intent points to *first unanswered*. Not inferred and not corrected.**

> **CHT-049 — Conversations exceeding the SLA are marked `Overdue` and highlighted in the inbox and dashboards. They are never automatically closed or escalated solely because the SLA is exceeded** (`BD-364`).

> **CHT-050 — `Inactive` is an informational status marking no customer response for the configured period. The conversation is not automatically closed; an authorized staff member may close it when no further action is expected** (`BD-365`).

⚠ **`GAP-095` is carried:** **which timestamp anchors the inactivity clock is unstated.** Both `Last Customer Reply` and `Last Business Reply` are captured, so either computation is available; **the business has not said which.**

> **CHT-051 — Five ageing-related fields are recorded** (`BD-365`, `E-074`): **Last Customer Reply · Last Business Reply · Inactive Since · Closed By · Closed Date.**

---

# 11. Internal Notes

> **CHT-052 — `E-076` Internal Note is staff-only content on a conversation, and customers can never see it** (`INV-74.4`, `BD-360`).

**`CP-8`'s irreversibility axis makes this absolute** — `BD-360` is one of the small number of rules the business stated as unconditional, because **disclosure cannot be undone**.

> **CHT-053 — Notes may be added at any stage and do not change the conversation lifecycle or customer-visible messages** (`BD-360`, `SMA-060`).

> **CHT-054 — A note may contain findings, investigation results, follow-up actions, instructions, or communication between staff members** (`BD-360`).

> **CHT-055 — Every note records Author, Date and Time, and Note History, and becomes part of the permanent conversation history for audit purposes** (`BD-360`, `E-076`).

---

# 12. Attachments and Channel Capability

> **CHT-056 — The business attachment model is generic; channel-specific limitations are enforced per channel capability** (`BD-361`).

> **CHT-057 — Attachment capabilities are defined per communication channel** (`BD-361`). *"Daraz Chat currently supports images but does not support video attachments; other channels may support additional types."*

**`SYS-096` registers attachment type as the seventh channel-capability dimension**, and `API-012` carries the capability model. **The declaration is `API_ARCHITECTURE.md`'s; the consequence for a conversation is stated here.**

> **CHT-058 — The conversation interface should only allow attachment types supported by the originating channel** (`BD-361`).

> **CHT-059 — This interface restriction is an affordance, not a control** (`SYS-097`, `API-014`). Limiting types spares staff a doomed action; **the channel enforces its own limits regardless.** Distinguished deliberately, because `PRM-004` requires real controls to be enforced server-side.

> **CHT-060 — A channel constrains what may pass through it, never what a business record may hold** (`SYS-097`, `BD-361`). **Attachments linked to business records remain independent of the originating communication channel** — which is why a warranty case may hold video evidence that simply cannot arrive *through Daraz chat*.

---

# 13. Channels and Manual Equivalence

> **CHT-061 — Chat is a channel capability, and walk-in and phone never carry it** (`BD-326`, `API-012` dimension 6).

**This is the clean boundary with order verification:** `BD-030` and `BD-036` establish **direct phone contact** for order verification, and a phone call is **not a conversation record** under this module. **Order-related phone contact is `ORDER_MANAGEMENT_ARCHITECTURE.md`'s.**

> **CHT-062 — Daraz Chat is the V1 entry channel; Website Chat, WhatsApp and Messenger are to follow** (`BD-326`).

> **CHT-063 — The business intends the ERP to become the single customer communication workspace, with conversations synchronized whenever channel APIs permit** (`BD-366`).

> **CHT-064 — Where a channel's API does not permit an operation, `SYS-012`'s manual equivalence applies** (`SYS-012`, `API-049`, `API-051`). **No chat-specific manual mechanism is specified here** — the universal rule governs, and inventing a chat-specific one would duplicate it.

⚠ **`SYS-100` and `API-020` bound this:** the ERP cannot synchronise faster than the channel permits, and **the absence of a capability must never be mistaken for the absence of data** (`API-008`, `BR-134`).

---

# 14. Ownership Boundaries — Consolidated

| Chat supplies | The module owns |
|---|---|
| **Customer** — the Channel Identity and its link, where evidence permits | **The Customer Profile, identity policy, contacts, credit, blacklist** |
| **Return & Exchange** — conversations linked to a case; **communication as a closure condition** (`BD-352`, `INV-73.4`) | **The Business Case, its definition and closure** (`BD-367`, `DM-065`) |
| **Order Management** — conversations linked to orders | **Order lifecycle, verification workflow, order-related phone contact** |
| **API** — nothing; it consumes capability | **Adapter capability, sync, idempotency, provenance, raw payload retention** |
| **Notification** — nothing; the two are distinct | **System-initiated one-way messaging, the Action Queue, delivery evidence** |
| **Permission / Access Governance** — the acts requiring authorisation | **The authorisation decision model, scope, operational identity** |
| **Audit** — attributable communication records | **Audit record structure, evidence packages, disposal authority** |

**Chat owns no customer record, no business case, no adapter, no notification and no figure.**

---

# 15. Permission, Scope and Audit

| Requirement | Rule |
|---|---|
| **Every reply, assignment, note, link and closure attributable** | `CHT-007`, `AGV-001`, `AUD-004` |
| **Reply restricted to the assigned user; read open to any authorized user** | `CHT-023`, `INV-74.3` |
| **Reassignment is the permissioned act** — taking work is unrestricted, taking it away is not | `CHT-025`, `PRM-002` |
| **Assignment and reassignment history recorded** | `CHT-027`, `DB-068` |
| **Internal notes never visible to customers** | `CHT-052`, `INV-74.4` |
| **Notes permanent, with author and timestamp** | `CHT-055` |
| **Closure records actor and date** | `CHT-045` |
| **Conversation history permanent** | `CHT-018`, `BD-338` |

**Scope.** `PRM-064` establishes **Marketplace Shop**, **Facebook Page**, **WhatsApp Account/Number** and **Sales Channel** among its dimensions, enforced on read and write (`PRM-009`, `AGV-020`). ⚠ `BD-377` records that **most users currently work across all channels** — the model is designed for growth and **deliberately not enforced today** (`PRM-051`).

⚠ **`GAP-098` bears directly on this module:** because the business chose **explicit per-channel scope dimensions**, **every new messaging channel is a new *dimension*, not a new value** — and Chat is the module that adds channels. **Carried, not resolved.**

> **CHT-065 — Notifications and internal notes are activity-log material, not audit-log postings** (`NOT-037`, `AUD-001`). **Audit record structure and evidence packages remain `AUDIT_ARCHITECTURE.md`'s.**

---

# 16. Notification Integration

**All delivery behaviour is owned by `NOTIFICATION_ARCHITECTURE.md`.**

> **CHT-066 — A conversation is not a notification** (`CHT-006`, `NOT-001`). They interact — a notification may arrive on a channel that also carries chat — **and must not be conflated.**

**Two ageing overlays this module produces are already registered against Notification** (`NOT §21.2`): **`Overdue`** at 10 minutes configurable, and **`Inactive`** at a configurable period.

⚠ **`NOT §21.2` records that `Overdue` names two different things** across `SM-9` Exchange and `SM-16` Conversation — **the second concrete instance under `GAP-026`.** Machine-qualified naming applies (`SMA-047`).

---

# 17. Entity and State Machine References

| Entity | ID | Owner |
|---|---|---|
| **Conversation** | **`E-074`** | **Chat** — `SM-16` |
| **Channel Identity** | **`E-075`** | **Chat** |
| **Internal Note** | **`E-076`** | **Chat** |
| Customer | `E-023` | **Customer** |
| Business Case | `E-073` | Data: System · Documentation: Return & Exchange (`DOC-054`) |
| Attachment | `E-054` | Generic, one concept across channels (`SYS-097`) |
| Operational User Profile | `E-077` | Access Governance |

| Machine | Subject | Status |
|---|---|---|
| **`SM-16`** Conversation | `E-074` | **Ratified in `STATE_MACHINE_ARCHITECTURE.md`**; **not ratified here** |

**No entity is defined here and no machine is ratified here.**

---

# 18. Cross-Domain Integration

| Domain | Interface |
|---|---|
| **Customer** | Channel Identity links to a Customer **where evidence permits** (`CHT-014`); the Profile itself is Customer's |
| **Return & Exchange** | Conversations link to a Business Case; **communication is a closure condition** (`INV-73.4`, `BD-352`) |
| **Order Management** | Conversations link to orders and products; **verification phone contact is not chat** (`CHT-061`) |
| **Warranty · Repair** | Warranty and repair cases are link targets (`CHT-033`); their lifecycles are owned elsewhere |
| **Trade-In** | `E-073` also links Trade-In cases (`BD-354`) |
| **API** | Channel capability per operation, direction, field, event, data element, **chat itself** and **attachment type** (`SYS-096`, `API-012`) |
| **Notification** | Distinct concept; two overlays registered (`NOT §21.2`) |
| **Delivery** | Delivery updates are order communication, not chat; `DLV-042`'s recovery contact is a phone call |

---

# 19. Open GAPs and Unconfirmed Areas

## 19.1 GAPs carried — none closed

| GAP | Severity | Bearing on Chat |
|---|---|---|
| **`GAP-096`** | 🟡 | **Conversation-to-lifecycle linkage: direct or via the case?** Two paths to one relationship, which `CP-12` exists to prevent (§8.1) |
| **`GAP-094`** | 🟢 | **First Response SLA measurement is ambiguous** — *latest* unanswered message restarts the clock (§10) |
| **`GAP-095`** | 🟢 | **Which timestamp anchors the inactivity clock is unstated** (§10) |
| **`GAP-026`** | 🟡 | **`Overdue` names two different things** across `SM-9` and `SM-16` |
| **`GAP-098`** | 🔴 | **Every new messaging channel is a new scope dimension**, and Chat is the module that adds channels (§15) |
| **`GAP-024`** | 🟡 | Ageing thresholds generally — **though `BD-364` supplies the first with an actual value** (`SMA-063`) |
| **`GAP-001`** | 🔴 | Module documents remain unwritten. **This document reduces the count by one** |

**No gap is closed by this document, and none is newly discovered.**

## 19.2 Reconciliation points carried

| # | Point | Owning document |
|---|---|---|
| 1 | **`INV-23.1`'s *mirror, never locally edited* against a Customer Profile that accumulates Trioloo's history.** The Channel-Identity-as-mirror reading is **not stated in any source** and is **not asserted here** (§5.1) | `DOMAIN_MODEL.md` |
| 2 | ✅ **RESOLVED 2026-08-09** — `OM §18.2` registered only seven machines against `STATE_MACHINE_ARCHITECTURE.md`'s twenty (§9). It now registers **eleven** (`BR-142`); `SM-12` – `SM-20` are named there as a separate outstanding item | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| 3 | **No Message entity exists**; communication is modelled at conversation level (§4.1) | `DOMAIN_MODEL.md` |

## 19.3 ⚠ Unconfirmed — no rule is written for any of these

**`DOC-024` and `DM-001` forbid filling these from common helpdesk or chat-system behaviour, and none is filled.**

| Area | Status |
|---|---|
| **Message-level edit or deletion policy** | **UNCONFIRMED.** Conversation history is permanent (`CHT-018`) and notes carry history (`CHT-055`); **individual message mutability is not addressed** |
| **Canned replies, templates, macros** | **UNCONFIRMED** — mentioned nowhere in §23 |
| **Unread / read status per user** | **UNCONFIRMED** — no answer establishes it |
| **Escalation** | **A stated negative** — *"never automatically closed or escalated"* (`BD-364`). No escalation mechanism is confirmed |
| **Automation, bots, AI** | **Explicitly excluded from §23** (`CHT-001`). `BD-322`'s approval-path guardrail is recorded, not extended |
| **Conversation-specific retention period** | **UNCONFIRMED specifically.** `BD-338` (no record ever deleted), `E-074` (*durable, effectively permanent*) and `SYS-101` (retention central, storage local) govern; **no chat-specific period exists** |
| **Outbound message delivery confirmation** | **UNCONFIRMED.** `NOT-034`'s delivery evidence covers **notifications**, not conversation replies |
| **Customer-visible conversation transcript or self-service view** | **UNCONFIRMED**, and `AGV-011` confirms there is **no customer self-service access** to the ERP |

---

# 20. Traceability

## 20.1 Business Decisions consumed

| BD | Contributes |
|---|---|
| `BD-355` | Shared inbox · ownership until completion · four recorded ownership fields |
| `BD-356` | **Soft assignment on first reply** · reply lock · *"Assign to Me"* · seven filters · **permanent channel binding** |
| `BD-357` | **Channel Identity** · never auto-merge · four evidence types · preserve originals |
| `BD-358` | **Suggest and confirm** · five signals · six link targets · multiple links · history |
| `BD-359` | **Seven lifecycle states** · linkage at any stage · Conversation Status |
| `BD-360` | **Internal Notes** — staff-only, any stage, no lifecycle effect, permanent |
| `BD-361` | **Attachment capability per channel** · generic business model · record independence |
| `BD-362` | **Automatic reopening** · continuous history · may span multiple cases |
| `BD-363` | **One conversation per channel** · unified through the Business Case, both directions |
| `BD-364` | **10-minute configurable First Response SLA** · `Overdue` · never auto-close or escalate |
| `BD-365` | **`Inactive`** · configurable period · authorized closure · five recorded fields |
| `BD-366` | Nine operational pain points · **single communication workspace** · sync where APIs permit |
| `BD-367` | **Business Case has exactly one meaning** — supersedes `BD-355`'s loose usage |
| `BD-368` | **Conversation and Business Case have independent lifecycles** |

**Prior coverage consumed:** `BD-023`, `BD-029`, `BD-030`, `BD-036`, `BD-173`, `BD-317`, `BD-322`, `BD-325`, `BD-326`, `BD-327`, `BD-329`, `BD-338`, `BD-352`, `BD-354`, `BD-377`.

## 20.2 Rules inherited, not restated

| Rule | Document |
|---|---|
| `SM-16`, `SMA-001`, `SMA-047`, `SMA-058` – `SMA-063` | `STATE_MACHINE_ARCHITECTURE.md` |
| `E-023`, `E-054`, `E-073` – `E-077`, `INV-23.1`, `INV-73.4`, `INV-74.1` – `INV-74.5`, `INV-75.1` – `INV-75.4`, `DM-001`, `DM-065` – `DM-067` | `DOMAIN_MODEL.md` |
| `SYS-010`, `SYS-012`, `SYS-016`, `SYS-047`, `SYS-096`, `SYS-097`, `SYS-100`, `SYS-101`, `CP-3`, `CP-6`, `CP-8`, `CP-12` | `SYSTEM_ARCHITECTURE.md` |
| `BR-003`, `BR-134`, `OM §18.2` | `ORDER_MANAGEMENT_ARCHITECTURE.md` |
| `API-008`, `API-012`, `API-014`, `API-020`, `API-049`, `API-051` | `API_ARCHITECTURE.md` |
| `NOT-001`, `NOT-034`, `NOT-037`, `NOT §21.2` | `NOTIFICATION_ARCHITECTURE.md` |
| `RET-004`, `BD-352` closure condition | `RETURN_EXCHANGE_ARCHITECTURE.md` |
| `PRM-002`, `PRM-004`, `PRM-005`, `PRM-009`, `PRM-011`, `PRM-051`, `PRM-064`, `AGV-001`, `AGV-011`, `AGV-020` | `PERMISSION_ARCHITECTURE.md`, `ACCESS_GOVERNANCE_ARCHITECTURE.md` |
| `AUD-001`, `AUD-004` | `AUDIT_ARCHITECTURE.md` |
| `DB-013`, `DB-068` | `DATABASE_ARCHITECTURE.md` |
| `PRD-056` | `PRODUCT_ARCHITECTURE.md` |
| `DOC-005`, `DOC-024`, `DOC-050`, `DOC-054` | `MASTER_DOCUMENTATION_INDEX.md` |

## 20.3 Corrections carried forward

| Correction | Record |
|---|---|
| **`BD-355`'s loose *"business case"* usage superseded by `BD-367`** (`DM-066`) — a conversation is **case-like**, not a Business Case | `CHT-017`, §8.1 |
| **`BD-356` refines `BD-355`** — assignment happens **on reply**, not by claiming | `CHT-022` |
| **`BD-354`'s *"parent"* means governs closure, not owns the record** (`DM-065`) | `CHT-018`, `CHT-020` |

---

# 21. Version History

| Version | Date | Change |
|---|---|---|
| **1.2.0** | **2026-08-09** | **Stale pointer corrected — no rule changed.** §2.2 routed the warranty and repair lifecycles to `PRODUCT_ARCHITECTURE.md` §32, which reconciles warranty *policy* and holds no lifecycle content; it now resolves to [`WARRANTY_REPAIR_ARCHITECTURE.md`](WARRANTY_REPAIR_ARCHITECTURE.md) (`DOC-062`). **The boundary is unchanged** — those lifecycles were always out of scope here |
| **1.1.0** | **2026-08-09** | **Recorded observation RESOLVED in the owning document — no rule changed.** §9 and §19 recorded that *"`OM §18.2` still registers seven state machines against `STATE_MACHINE_ARCHITECTURE.md`'s twenty."* **It now registers eleven** (`BR-142`, 2026-08-09) and names `SM-12` – `SM-20` explicitly as a separate outstanding item. **The observation was acted on where it belonged, not here.** `CHT-039` is annotated because the contrast it draws with the four proposed extensions is now historical; **its substance is unaffected** — `SM-16` was never one of them, and this document still ratifies no machine |
| **1.0.0** | **2026-08-08** | **Initial ratification.** Consolidates `BUSINESS_DISCOVERY.md` §23 (`BD-355` – `BD-366`) with the ratified concepts `BD-367` and `BD-368`, and the reconciliations at `SMA §23.1` (`SM-16`, `SMA-058` – `SMA-063`), `DOMAIN_MODEL.md` `E-074` – `E-076` / `DM-065` – `DM-067`, and `SYS §21` (`SYS-096`, `SYS-097`). **67 rules (`CHT-000` – `CHT-066`), all traceable; no business rule, entity, state machine, lifecycle, threshold, template, automation or SLA introduced.** **`CHT-016` carries the `INV-23.1` reconciliation point unchanged and explicitly declines to assert that Channel Identity is the marketplace-owned mirror**, because no canonical source states it. **`CHT-009` records that no Message entity exists and does not introduce one.** **`CHT-039` records `SM-16` as ratified in `STATE_MACHINE_ARCHITECTURE.md` and referenced, never ratified, here.** **`CHT-001` records AI as excluded from §23 by instruction.** Seven gaps, three reconciliation points and eight explicitly unconfirmed areas carried |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Business rules are never silently altered** — a changed rule is a changed contract with the operation.

---

*This document specifies chat and customer-communication business architecture only. It contains no code, schema, API contract, or user interface specification, and assumes no technology.*
