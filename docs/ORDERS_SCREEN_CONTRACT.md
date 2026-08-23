# Orders — Screen Contract

**Status:** ✅ **Ratified** · **Version:** 1.9.0 · **Amended:** 2026-08-24 (**`OSC-058` — the PAGE-HEADER ACTIONS, the page size and the selection. The owner asked for Export, Print and Create Order; ✅ EXPORT IS BUILT IN FULL and 🔴 THE OTHER TWO ARE BLOCKED — `Create Order` because `PRM-091` ratifies no Order-mutation capability and `PRM-089.b` is a spelling rule and not a generator, `Print` because `PRN-023` sources the printable from an `E-039` record that does not exist and `INV-39.2` requires its content snapshotted. Both are rendered disabled with the reason in VISIBLE text. Page size is five; `Select all` takes the current page and a selection now SURVIVES paging, amending `OSC-057.c.i`**) · **Amended:** 2026-08-24 (**`OSC-057` — the TRIOLOO-ISSUED INVOICE NUMBER. The product owner supplied the numbering rule `GAP-035` recorded as missing: ONE sequence, `TR0001` upward, oldest to newest, every order, never regenerated. `V19` backfills all 158 and enforces immutability with a TABLE TRIGGER rather than trusting the application. 🔴 REPORTED, NOT RESOLVED — the number is issued AHEAD of the document: `E-039`'s snapshotted content (`INV-39.2`) does not exist, and 117 of the 158 numbered orders are CANCELLED. `GAP-035` stays open on what an invoice CONTAINS and WHEN it is issued. Order cards gain a selection checkbox with NO bulk bar, because `GAP-034` still records no permitted-bulk-transition inventory**) · **Amended:** 2026-08-24 (**`OSC-056` — the ORDER CARD amended by the PRODUCT OWNER. The `SM-5` payment position is now a chip, and only three of its eleven states may ever be rendered because every state past `DUE` needs an `E-040` Receivable this slice does not hold. The marketplace's word loses its prefix and stays visibly external by GROUPING. The authority chip moves off the card — admissible only because `FRAME 02` already carries it, and `OSC-056.d.i` reports that `FRAME 02` states it in the internal terminology `UX-183` forbids. `More Actions` is rendered with the owner's ratification but NO action behind it, so it is `aria-disabled` and says so**) · **Amended:** 2026-08-24 (**`OSC-055` — the ORDER CARD visual authority registered and built. The Claude Design project was NOT readable (`HTTP 404`), so the owner supplied the bundle and the specification is transcribed from its markup, never imagined (`OSC-012`'s discipline). Every colour resolved to an existing token; the design's sample figures for Cost, Charges, Received and Margin are REFUSED as unknown, and its `Not Released` chip is not rendered because `BR-080` withdrew the state**) · **Ratified:** 2026-08-23 (`DOC-094`) · **Amended:** 2026-08-23 (**KPI ROW AND STATUS TABS RATIFIED** — `OSC-053` names the four summary figures the product owner chose, closing `GAP-004` for this workspace and WITHDRAWING the shipped `Total Revenue`/`Total Margin` pair; `OSC-054` records that the tabs are `SM-1` states filled by the §4.3 adapter translation, so `GAP-017`'s legacy-label mapping stays blocked without blocking the tab set; `OSC-030.a` gains `Returned`) · **Amended:** 2026-08-23 (`OSC-051.a`–`.c` — unresolved blocker placeholders and nonfunctional action chrome are removed from the live read-only Orders UI; the blocked register remains canonical) · **Amended:** 2026-08-23 (`FRAME 01`/`FRAME 02` read-only Orders UI implemented — `OrdersPage.tsx`, `OrderDetailPage.tsx`, 2 tests; no write path) · **Amended:** 2026-08-23 (`OSC-060.d`–`.f` — the `V15` position is RESOLVED and TAKEN by `DEP-125`, so the migration bar is lifted; still only after the `DEP-031` pre-flight) · **Amended:** 2026-08-23 (`OSC-052.c`–`.e` — the `order.*` codes are RATIFIED by `PRM-091`; gating was unblocked before the read-only UI slice) · **Rule prefix:** `OSC-`

> 🔴 **THIS DOCUMENT CREATES NO DESIGN.** It records the **approved** Orders visual authority, fixes which
> frames exist and which are built, and states the implementation constraints so later frames extend one
> house pattern rather than inventing a second.
>
> 🔴 **IT CREATES NO BUSINESS RULE, ENTITY, PERMISSION, ENDPOINT, MIGRATION OR VISUAL DECISION.** Every
> behavioural obligation traces to `BR-001`–`BR-176`, `E-031`–`E-034`, `SM-1`–`SM-11`, `EVT-001`–`EVT-023`,
> `UX-187` and the `DESIGN_CONSTITUTION.md` token matrix. **Where this contract appears to add meaning, the
> owning architecture document wins** (`DOC-005`, `DOC-010`).
>
> 🔴 **A SPACE IN THE DESIGN IS NOT A RATIFIED BEHAVIOUR.** ⚠ **Where the artboards draw a region the canon
> does not answer, this contract records it **BLOCKED — MISSING CANONICAL BUSINESS RULE** in the register and
> the live read-only UI withholds the unresolved figure, control or placeholder rather than filling it with an
> invented value** (`DOC-024`, `CLAUDE.md` §5, `OSC-051`).

**Inherits:** [`UI_UX_ARCHITECTURE.md`](UI_UX_ARCHITECTURE.md) (`UX-187` the Orders workspace · `UX-016`,
`UX-045` action levels · `UX-260` no component specification) ·
[`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) (Article III tokens · `RULE 3.3.d` semantic roles ·
`RULE 3.15` the card-list archetype).
**References:** [`ORDER_MANAGEMENT_ARCHITECTURE.md`](ORDER_MANAGEMENT_ARCHITECTURE.md) v1.20.0 ·
[`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-031`–`E-034` ·
[`STATE_MACHINE_ARCHITECTURE.md`](STATE_MACHINE_ARCHITECTURE.md) `SM-1`–`SM-11` ·
[`EVENT_ARCHITECTURE.md`](EVENT_ARCHITECTURE.md) `EVT-001`–`EVT-023` ·
[`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) `PRM-003`, `PRM-007`, `PRM-089` ·
[`GAP_ANALYSIS.md`](GAP_ANALYSIS.md) · [`LISTINGS_PAUSE_HANDOFF.md`](LISTINGS_PAUSE_HANDOFF.md) §4.

---

# 1. Authority and scope

> **`OSC-001` — ✅ THE PACK IS `FRAME 01` THROUGH `FRAME 09`.** 🔴 **Nine frames, numbered, and the numbering
> is this contract's own vocabulary.** ⚠ **Work that names an Orders surface names its `FRAME NN`.**

> **`OSC-002` — ✅ THE CODEBASE CARRIES THE FRAME NUMBERS.** **Each implemented component opens with a
> `FRAME NN` doc comment naming the frame it serves.** 🔴 **A surface built from this pack without that tag is
> not traceable to its design and is treated as a draft** — the discipline `LSC-003` established and proved.

> **`OSC-003` — 🔴 THIS CONTRACT IS A SURFACE AUTHORITY AND NOTHING ELSE.** **It decides composition, what a
> surface must show, and what it must refuse to invent.** 🔴 **It decides no lifecycle, no permission, no
> endpoint, no schema and no marketplace behaviour.**

---

# 2. Document Control — the approved visual authority

> **`OSC-010` — ✅ THE APPROVED ORDERS VISUAL AUTHORITY.**
>
> | | |
> |---|---|
> | **Artifact** | *Trioloo Orders Screens* |
> | **URL** | <https://claude.ai/code/artifact/94b3651f-3101-41d0-8563-7d3a7faeb16f> |
> | **Artboard — `Order Dashboard`** | `Main.dc.html` · 1440 × 1252 — the collection surface |
> | **Artboard — `Order Detail`** | `Detail.dc.html` · 1440 × 1580 — the record surface |
> | **Approved** | 2026-08-23, by the product owner, as the Orders visual authority |
> | **Token basis** | `DESIGN_CONSTITUTION.md` Article III, cross-checked against `frontend/src/design/tokens.css` |
>
> **a.** ✅ **THE ARTBOARDS CARRY NO INVENTED TOKEN.** **Manrope, the OKLCH palette, the `4px` spacing base,
> the ratified radius tiers, the `36px` button, the `216px` sidebar and the `24px 32px 64px` content frame are
> transcribed, not designed.**
> **b.** 🔴 **THE ARTBOARDS ARE COMPOSITION, NOT PERMISSION.** ⚠ **Drawing a control neither ratifies the
> action nor authorises the field behind it** (`DOC-080` — a reference is not a schema).

> **`OSC-011` — ⚠ THE PACK IS NOT YET TRACKED REPO-LOCALLY, AND BOTH PRECEDENTS ARE.**
>
> **`SHOPS_CHANNELS_SCREEN_CONTRACT.md` registers `design-reference/Trioloo Shops and Channels Feature
> Pack.html` and `LISTINGS_SCREEN_CONTRACT.md` registers `design-reference/Trioloo Listings Feature Pack.html`
> — each a rendered pack tracked in this repository.** 🔴 **No Orders equivalent is tracked.**
>
> **a.** ⚠ **UNTIL ONE IS, THE VISUAL AUTHORITY LIVES ONLY AT THE URL ABOVE**, and a reader without access to
> it cannot verify an implementation against it.
> **b.** ✅ **THIS IS AN OPEN ITEM, NOT A DEFECT IN THE DESIGN** — tracking a rendered export under
> [`design-reference/`](design-reference/README.md) discharges it and needs no decision from this contract.
> **c.** ⚠ **`design-reference/README.md` DOES NOT REGISTER EITHER EXISTING PACK EITHER**, though the index
> credits it with doing so. 🔴 **Recorded as an observation for that document's owner; not corrected here.**

> **`OSC-012` — 🔴 TWO HIGHER-PRECEDENCE ORDER FILES EXIST AND WERE NOT READABLE.**
>
> **`design-reference/README.md` places `Order Dashboard.dc.html` at precedence 2 and `Order Details.dc.html`
> at precedence 3 — ABOVE every tracked capture.** **Both live in Claude Design project
> `e56dcf10-69d0-4879-8fb8-6f8099bbdd3b`, which returned `HTTP 404 — project not found` on 2026-08-23.**
>
> **a.** 🔴 **THE `OSC-010` ARTBOARDS WERE NOT DERIVED FROM THEM AND DO NOT SUPERSEDE THEM.** ⚠ **They were
> built from the Constitution's token matrix and the two tracked PNG captures, because the higher-precedence
> files could not be read.** ✅ **Designing from a remembered impression of an unreadable file was refused.**
> **b.** ⚠ **IF THOSE FILES BECOME REACHABLE, THEY OUTRANK THIS PACK ON COMPOSITION** and a reconciliation is
> owed. 🔴 **That reconciliation is a `§12.3` design act, not an implementation adjustment.**

> **`OSC-013` — ✅ THE TWO TRACKED CAPTURES REMAIN BINDING AND ARE NOT SUPERSEDED.**
> **[`02-orders-list.png`](design-reference/02-orders-list.png) fixes the collection archetype — a CARD LIST,
> dark-filled active tabs, secondary figures demoted and divided from `Sale · Margin`, the footer strip.**
> **[`03-order-detail.png`](design-reference/03-order-detail.png) fixes the record hierarchy — breadcrumb,
> title with inline status, tabs, two-column main plus a fixed right rail that does not reflow, and 🔴 **one
> status row per lifecycle, never merged**.**

---

# 3. Frame register

> **`OSC-020` — ✅ FRAME 01 AND FRAME 02 ARE BUILT AS THE FIRST READ-ONLY SLICE.** **The Orders package,
> schema, import path, query API and frontend list/detail surfaces now exist.** 🔴 **Mutation, shipment,
> inventory movement, payment reconciliation, marketplace write and manual order capture remain outside this slice.**

| # | Frame | Artboard | Implemented in | State |
|---|---|---|---|---|
| **01** | **Order Dashboard / List** | `Order Dashboard` | `frontend/src/order/OrdersPage.tsx` | ✅ **Complete — read-only first slice** |
| **02** | **Order Detail — Overview** | `Order Detail` | `frontend/src/order/OrderDetailPage.tsx` | ✅ **Complete — read-only first slice** |
| **03** | **Items** | `Order Detail` | `OrderDetailPage.tsx` | ✅ **Complete — imported item snapshot rows** |
| **04** | **Buyer / Customer panel** | `Order Detail` | `OrderDetailPage.tsx` | ✅ **Complete — stored snapshot only** |
| **05** | **Payment summary** | `Order Detail` | `OrderDetailPage.tsx` | ✅ **Complete — read-only imported fields** |
| **06** | **Fulfilment / Shipment panel** | `Order Detail` | `OrderDetailPage.tsx` | ✅ **Complete — read-only imported fields** |
| **07** | **Marketplace / Channel reference panel** | `Order Detail` | `OrderDetailPage.tsx` | ✅ **Complete — external facts only** |
| **08** | **Activity / history timeline** | `Order Detail` | `OrderDetailPage.tsx` | ✅ **Complete — first imported-order projection** |
| **09** | **Exception / manual-action states** | both | — | ⬜ **Not built — unresolved controls withheld from live UI** |

> **a.** ⚠ **`FRAME 03`–`FRAME 09` ARE PANELS OF THE `FRAME 02` SURFACE, NOT SEPARATE ROUTES.** **`UX-187`
> composes fulfilment, shipment and sync access INSIDE the Orders workspace; 🔴 no sidebar row is created for
> any of them** (`UX-187`, `UX-025`).
> **b.** 🔴 **NO CAPTURE, CREATE OR AMEND FORM IS IN THIS PACK.** **`EVT-001` ratifies manual capture and the
> artboards draw a `New order` control, but no authoring surface is designed.** ⚠ **It is a later frame and is
> not numbered here — numbering it would imply a design that does not exist** (`OSC-001`).

---

# 4. Per-frame contracts

**Each frame states four things and no more: what must be VISIBLE, what may be DONE, what must be REFUSED,
and which rules govern. The fifth column is the coverage the frame owes when it is built.**

## 4.1 `FRAME 01` — Order Dashboard / List

> **`OSC-030` — ✅ THE COLLECTION IS A CARD LIST AND NEVER A TABLE.**
>
> 🔴 **`RULE 3.15` records the traditional data table as `NOT USED` by the approved source.** ⚠ **Date, time
> and lifecycle state are carried INSIDE the card anatomy, never as table columns.** **Re-cutting the
> collection as a column table is a `§12.3` design amendment, not an implementation choice.**

| | |
|---|---|
| **Required visible data** | Order number (`INV-31.6`, stable, never reused, monospace) · customer name from the ORDER'S OWN SNAPSHOT (`INV-31.7`) · channel type **and instance** (`BR-002`, `INV-31.4`) · external references with their issuing party (`DB-013`) · authority state `API_MANAGED` / `ERP_MANAGED` (`BR-168`, `INV-31.8`) · line count and quantity · demoted `Cost · Charges · Received`, divided from primary `Sale · Margin` (`§3.15`) · **one chip per lifecycle, never merged** (`BR-065`, `BR-066`) · a captured/most-relevant timestamp · invoice reference or an explicit absence |
| **Allowed actions** | `View` · `More` (row action, `UX-045` level 3) · `New order` (`EVT-001`) · `Export` (`API-057` CSV, the only V1 bulk format) · status-tab filtering · channel, search and captured-date filters (level 2) |
| **Unavailable / blocked** | ✅ **KPI row — RESOLVED (`OSC-053`)** · ✅ **status tabs — RESOLVED (`OSC-054`)**, though 🔴 **the legacy LABEL mapping stays BLOCKED (`GAP-017`)** · 🔴 **ageing or SLA badges — BLOCKED (`GAP-024`)** · ⚠ **bulk transitions are NOT drawn**: `PRM-025` requires each record authorised individually with per-record results (`SYS-073`), and no permitted-bulk-transition inventory exists (`GAP-034`) |
| **Canonical dependencies** | `BR-002` · `BR-065`/`BR-066` · `BR-168` · `E-031`, `E-032` · `INV-31.4`, `INV-31.6`, `INV-31.7`, `INV-31.8` · `SM-1` · `UX-187`, `UX-045` · `RULE 3.13`, `RULE 3.15`, `RULE 3.16` |
| **Coverage owed** | Frame-tag traceability · card renders every required datum · a missing invoice renders an explicit absence, never `—` standing for zero · the three lifecycle chips never collapse to one · tab set matches the ratified `SM-1` state names · blocked regions render their marker rather than a figure |

> **a.** 🔴 **THE STATUS TABS ARE NAMED FOR RATIFIED `SM-1` STATES.** ✅ **`All · Pending verification ·
> Confirmed · Released · In fulfilment · Ready to ship · Dispatched · Delivered · Failed delivery · Returned ·
> On hold · Cancelled · Closed`** — every one a state `OM §6.2` ratifies.
>
> ✅ **`Returned` ADDED 2026-08-23.** ⚠ **The v1.0.0 list omitted it, and the omission was an oversight rather than a
> decision: `OM §6.2` and `SMA §5.2` both ratify `RETURNED` as an `SM-1` state, `§6.3`'s own diagram draws
> `FAILED_DELIVERY → RETURNED` and `DELIVERED → RETURNED`, and the channel reports `returned` as one of its eight
> published values** (`DZC-045.c`). 🔴 **Nothing else is added: `DRAFT` stays out under `GAP-023`.**
> **b.** 🔴 **STILL BLOCKED, AND NARROWER THAN IT WAS.** **The shipped labels `Shipped`, `RTS`, `Pending`
> and `B2C Pending` have NO canonical state set** (`GAP-017`, 🔴 Critical). ⚠ **A mapping must not be guessed
> from resemblance; `RTS` alone is ambiguous between `READY_TO_SHIP` and Return-To-Seller** (`BR-079`).
> ✅ **`OSC-054` does NOT close this** — it makes the block irrelevant to the tab set by never using a legacy
> label, rather than by finally mapping one. 🔴 **The legacy labels remain unusable.**
> **c.** ✅ **RESOLVED 2026-08-23 — see `OSC-053`.** **The wording above is retained** (`DOC-009`) **because it
> was correct while the figures were undecided.** ⚠ **The four shipped KPI cards were never defined; they were
> WITHDRAWN and four different figures ratified in their place.**

## 4.2 `FRAME 02` — Order Detail, Overview

> **`OSC-031` — 🔴 THE STATUS CARD CARRIES ONE ROW PER LIFECYCLE AND NEVER MERGES THEM.**
>
> **`03-order-detail.png` fixes it visually and `BR-065`/`BR-066` fix it architecturally: the machines are
> independent, own their own terminal conditions, and communicate only by event.** ⚠ **A single merged status
> field is the failure `OM §18.1` exists to prevent — it re-emerges the moment one column tries to say
> everything.**

| | |
|---|---|
| **Required visible data** | Breadcrumb · order number · **inline** order status badge · authority chip with the causing action, actor and time where a takeover occurred (`BR-174`) · capture channel and time · `Confirmed By` / `Confirmed At` (`BR-163`) · the per-lifecycle status rows — Order, Verification, Fulfilment, Shipment, Payment, Inventory, Return, Exchange · order summary (goods value, discount, delivery charge, total, received, outstanding) |
| **Allowed actions** | Tab switching (white-raised, `RULE 3.13`) · `Amend` where `OM §7.9` permits · `Release to warehouse` (`BR-081`, manual, permissioned) · `Place hold` / `Release hold` (`EVT-010`, `EVT-011`) · `Cancel order` **pre-dispatch only** |
| **Unavailable / blocked** | 🔴 **`Cancel` is NOT OFFERED after dispatch** (`BR-011`) — the instrument is a return, and the control is absent rather than disabled · 🔴 **no amendment after dispatch** (`OM §7.9`) · 🔴 **order notes — BLOCKED (`GAP-066`)** · 🔴 **realised margin is not shown as settled before closure** (`BR-067`) |
| **Canonical dependencies** | `BR-010`, `BR-011`, `BR-065`–`BR-067`, `BR-081`, `BR-163`–`BR-167`, `BR-168`–`BR-176` · `E-031`, `E-033` · `SM-1`–`SM-11` · `SMA §5.4`, `§5.8` · `RULE 3.13` |
| **Coverage owed** | Every lifecycle row renders independently · an `AUTO_CONFIRMED` order shows **no human `Confirmed By`** and fabricates none (`BR-166`, `SYS-034`) · `Assigned Agent` and `Confirmed By` render as distinct facts and may differ (`BR-165`) · a dispatched order offers no cancel control at all · authority takeover renders its actor and time |

> **a.** 🔴 **`Confirmed By` IS NEVER DERIVED FOR DISPLAY** (`BR-164`). ⚠ **It is not inferred from
> `Assigned Agent`, the current owner, `Last Updated By` or audit history — where it was not recorded, its
> ABSENCE is the fact and the surface says so.**
> **b.** ✅ **AN EXTERNAL MARKETPLACE STATUS AND THE ERP OPERATIONAL STATUS MAY LEGITIMATELY DIFFER AND ARE
> SHOWN AS TWO FACTS** (`BR-171`, `INV-31.10`). 🔴 **The external status never re-drives the lifecycle and is
> never rendered as the order's state.**

## 4.3 `FRAME 03` — Items

> **`OSC-032` — 🔴 A LINE SHOWS WHAT WAS ACTUALLY SOLD, NOT WHAT THE CATALOGUE SAYS TODAY.** **Price, cost,
> customer and description are SNAPSHOTS** (`DB-023`, `INV-31.7`) — ⚠ **the surface renders the stored fact
> and never re-derives it from a current price list.**

| | |
|---|---|
| **Required visible data** | Per line: catalogued flag · Sellable Product reference (`INV-32.1` — never a Product Variant directly) or the free-text name for a non-catalogued line · quantity · **unit price snapshot captured at line creation** (`BR-145`, `INV-32.6`) · cost snapshot · line value · assigned serials **where one exists** (`BR-086`) · goods total and margin strip |
| **Allowed actions** | Open the Sellable Product · view a line's serials |
| **Unavailable / blocked** | 🔴 **line-level cancel — BLOCKED (`GAP-025`)**, undefined after release and its interaction with reservations and picking unspecified · 🔴 **an unknown cost renders UNKNOWN, never `0`** (`INV-32.4`, `SYS-034`) · 🔴 **an order with any non-catalogued line renders economically incomplete** (`INV-31.5`, `BR-007`) · ⚠ **no serial is implied**: recording is optional by default and never mandatory (`BR-086`) |
| **Canonical dependencies** | `BR-007`, `BR-086`, `BR-145`, `BR-146`, `BR-147` · `E-032` · `INV-32.1`, `INV-32.4`, `INV-32.5`, `INV-32.6` · `DB-023` · `RULE 3.15` |
| **Coverage owed** | An unknown cost renders as unknown and never as zero · a non-catalogued line flags the order economically incomplete · the price snapshot renders as stored and is never recomputed in the browser · a line with no serial renders no serial affordance · money never passes through a JavaScript `Number` |

> **a.** 🔴 **A LATER PRICE OR COST CHANGE NEVER REWRITES A RENDERED LINE** (`BR-146`). ⚠ **The surface shows
> the SNAPSHOT, which is a transactional fact, not a live lookup.**
> **b.** ⚠ **THE OBSERVED DEFECT THIS FRAME MUST NOT REPEAT** — `E-032`'s own note records a line rendering
> `Margin ৳0` when the margin was in fact UNKNOWN. 🔴 **Unknown is rendered as unknown.**

## 4.4 `FRAME 04` — Buyer / Customer panel

> **`OSC-033` — 🔴 THE PANEL RENDERS THE ORDER'S SNAPSHOT, NEVER A LIVE CUSTOMER LOOKUP** (`INV-31.7`).
> ⚠ **A customer who later changes their address has not changed where this order was sent, and a panel that
> resolved the current record would silently rewrite history on screen.**

| | |
|---|---|
| **Required visible data** | Customer name, contact and delivery address **from the order's snapshot, never a live customer lookup** (`INV-31.7`, `DB-023`) · customer type — individual, corporate or reseller · credit terms where approved (B2B) · the moment the snapshot was taken |
| **Allowed actions** | Open the Customer record · change delivery address or contact **pre-dispatch, under `OM §7.9`** — ⚠ **and doing so transitions an `API_MANAGED` order to `ERP_MANAGED`** (`BR-169`) |
| **Unavailable / blocked** | 🔴 **order notes — BLOCKED (`GAP-066`)** · 🔴 **no address change after dispatch** (`OM §7.9`, `BR-082` — changes end at `COURIER_BOOKED`) · ⚠ **`B2C` is NOT rendered as a customer classification — BLOCKED (`GAP-022`)**, the term is defined nowhere in the corpus |
| **Canonical dependencies** | `BR-082`, `BR-169`, `BR-170` · `E-023`, `E-031` · `INV-31.7`, `INV-31.9` · `DB-023` · `OM §7.9` |
| **Coverage owed** | The panel renders the snapshot and issues no customer lookup · an amendment surfaces the authority consequence before it is committed · no control appears after `COURIER_BOOKED` |

> **a.** 🔴 **THE AUTHORITY CONSEQUENCE IS STATED BEFORE THE ACT, NOT AFTER** (`BR-169`, `BR-174`). ⚠ **An
> operator changing an address on a marketplace order is taking authority for it permanently — the transition
> is one-way in V1** (`BR-175`) — **and the surface must say so plainly.**

## 4.5 `FRAME 05` — Payment summary

> **`OSC-034` — 🔴 THE OBLIGATION FOLLOWS DELIVERED GOODS, NEVER ORDERED GOODS** (`BR-033`, `INV-32.5`).
> ⚠ **An undelivered order has no due receivable, and rendering one would overstate what the business is
> owed on every open order in the workspace.**

| | |
|---|---|
| **Required visible data** | Collection mode — COD, prepaid, credit terms, marketplace settlement · payment state from `SM-5` · received to date · outstanding · **realised margin only once closure settles it** (`BR-067`) · settlement period where the channel settles (`SM-6`) |
| **Allowed actions** | Record a receipt · raise a dispute — **both Accounts-owned and permission-bounded** (`PRM-008`) |
| **Unavailable / blocked** | 🔴 **`Mark reconciled` — BLOCKED (`GAP-019` residual)**: whether `SM-5` `RECEIVED → RECONCILED` is manual or automatic is `UNDECIDED`, so **no control is offered** · 🔴 **no per-portion receivable and no per-portion refund exist** (`BR-160`) · 🔴 **payment obligation follows DELIVERED goods, never ordered goods** (`BR-033`, `INV-32.5`) — an undelivered order shows no due receivable |
| **Canonical dependencies** | `BR-033`, `BR-067`, `BR-160` · `SM-5`, `SM-6` · `INV-32.5` · `DB-079` and `TEC-015` money handling · `PRM-008` |
| **Coverage owed** | Money renders from a string and never touches `Number` · an undelivered order shows no due receivable · no reconcile control renders · realised margin renders as unsettled before closure · a short settlement renders as a dispute flag and does not close the order (`OM §18.3`) |

> **a.** ⚠ **AN ORDER MAY SIT `DELIVERED` FOR WEEKS AWAITING SETTLEMENT, AND THAT IS CORRECT** (`OM §18.4`).
> 🔴 **The surface never presents it as a backlog or an exception.**

## 4.6 `FRAME 06` — Fulfilment / Shipment panel

> **`OSC-035` — 🔴 ONE ORDER IS ONE PARCEL PER ATTEMPT, AND THE SURFACE OFFERS NO WAY TO SPLIT IT**
> (`BR-158`, `BR-159`). ⚠ **Partial shipment and partial delivery were WITHDRAWN, `PARTIALLY_DELIVERED` was
> removed from `SM-1`, and a control that implied otherwise would reopen a decision the business closed.**

| | |
|---|---|
| **Required visible data** | Fulfilment state (`SM-3`) · warehouse · picker · pick discrepancies where raised · shipment state (`SM-4`) or an explicit "not created" · courier · tracking / AWB with its issuing party (`DB-013`) · handover acknowledgement on self-pickup (`INV-35.4`) |
| **Allowed actions** | Open the pick task · open the shipment · view tracking events |
| **Unavailable / blocked** | 🔴 **NO SPLIT OR PARTIAL SHIPMENT AFFORDANCE EXISTS** (`BR-158`, `BR-159`) — one order is one parcel per attempt, and `PARTIALLY_DELIVERED` was removed · 🔴 **cancel consequences — BLOCKED (`GAP-020`)**: unpack, restock and void-label ordering and failure handling are unspecified, so a confirmation states no sequence · ⚠ **no courier selection** — Steadfast only, auto-assigned (`BR-076`) · 🔴 **stock shortage renders as VISIBILITY and never gates progression** (`BR-153`, `BR-154`) |
| **Canonical dependencies** | `BR-019`, `BR-020`, `BR-076`, `BR-153`–`BR-159` · `E-035`, `E-037` · `SM-3`, `SM-4` · `INV-35.1`, `INV-35.2`, `INV-35.4` |
| **Coverage owed** | A shortage renders without gating any control · a pick discrepancy renders its inventory exception (`BR-020` — silent short-picking is prohibited) · no partial-shipment control renders · no pick affordance renders before release (`INV-35.1`) |

> **a.** 🔴 **THE DISTINCTION THIS FRAME MUST CARRY IS `BR-155`'s.** **A hold for a PICK DISCREPANCY is
> correct; a hold for KNOWN UNAVAILABILITY is not.** ⚠ **One is an accuracy failure, the other is the business
> model working as designed — and the surface must not present them as one condition.**

## 4.7 `FRAME 07` — Marketplace / Channel reference panel

> **`OSC-036` — 🔴 TWO STATUSES, TWO OWNERS, AND THEY ARE NEVER RECONCILED INTO ONE** (`BR-171`,
> `INV-31.10`, `API-023`). ✅ **`Marketplace status = Cancelled` beside `ERP status = Confirmed` is a
> LEGITIMATE reading — they describe different systems.** ⚠ **Collapsing them into a single field would
> destroy the distinction the authority model exists to hold.**

| | |
|---|---|
| **Required visible data** | Channel type **and instance** (`BR-002`) · authority state and, where a takeover occurred, its causing action, actor and time (`BR-174`) · external order ID, shop identifier and AWB, each **with its issuing party** (`DB-013`) · **the marketplace's own reported status as an EXTERNAL FACT, visibly distinct from the ERP operational status** (`BR-171`) |
| **Allowed actions** | Open the channel instance · view the retained inbound history (`BR-173`) |
| **Unavailable / blocked** | 🔴 **NO PUSH, RESEND OR RE-SYNC CONTROL** — Orders has no outbound channel behaviour ratified, and none is drawn · 🔴 **an external `Cancelled` NEVER re-cancels an `ERP_MANAGED` order** (`BR-172`) and the surface offers no control that would · ⚠ **a direct-channel order renders explicit absences**, never blank fields |
| **Canonical dependencies** | `BR-002`, `BR-168`–`BR-176` · `INV-31.4`, `INV-31.8`, `INV-31.10` · `DB-013` · `API-005`, `API-021`, `API-023` |
| **Coverage owed** | The two statuses render as two distinct facts and are never reconciled into one · a stale external cancellation renders as retained evidence, not as authority · an identifier renders with its issuing party · a direct-channel order renders explicit absences |

> **a.** 🔴 **ERP AUTHORITY NEVER DELETES EXTERNAL HISTORY** (`BR-173`). ✅ **The original imported facts and
> every later update remain visible as evidence and never overwrite the operational order.**

## 4.8 `FRAME 08` — Activity / history timeline

> **`OSC-037` — 🔴 THE TIMELINE IS A PROJECTION, NEVER A SECOND STORE** (`INV-34.1`). ✅ **It is complete by
> construction because no state change occurs without an activity entry** (`INV-34.2`, `BR-058`). ⚠ **A
> bespoke timeline table would create a second source of truth and would drift from the first.**

| | |
|---|---|
| **Required visible data** | Chronological entries, each with **from-state, to-state, actor, timestamp and reason** (`BR-058`, `SMA-010`) · the act in operator language · the machine or domain it belongs to |
| **Allowed actions** | Filter by kind · page |
| **Unavailable / blocked** | 🔴 **ageing and SLA markers — BLOCKED (`GAP-024`)**: no residency threshold exists for these states, so no "aged N days" badge renders · 🔴 **NO SECOND STORE IS CREATED** (`INV-34.1`) — the timeline is a filtered projection of the Activity Log · ⚠ **an entry's outcome is never derived where none was recorded** |
| **Canonical dependencies** | `BR-058`, `BR-064` · `E-034` · `INV-34.1`, `INV-34.2` · `AUD §16` · `SMA-010` |
| **Coverage owed** | The timeline reads the activity projection and never a bespoke table · no ageing badge renders · a bulk act renders **one entry per order** (`AUD-028`, `EVA-011`) · completeness holds by construction — no state change without an entry (`INV-34.2`) |

> **a.** ✅ **THE ACTIVITY LOG AND THE AUDIT LOG ARE DIFFERENT THINGS AND THIS FRAME SHOWS THE FIRST**
> (`OM §15.2`). 🔴 **An operational narrative is not an audit record, and the surface must not present itself
> as one.**

## 4.9 `FRAME 09` — Exception / manual-action states

> **`OSC-038` — 🔴 AN EXCEPTION IS SURFACED FOR VISIBILITY AND NEVER GATES PROGRESSION** (`CP-8`, `BR-154`).
> ⚠ **This is the rule the discovery record states nine separate times, and it is the one an operations screen
> is most likely to break by adding a well-meant block.**

| | |
|---|---|
| **Required visible data** | Open exceptions with their cause, raiser and time · hold reason and the actor who placed it (`EVT-010`) · the reservation consequence of the hold (`BR-149`, `BR-150`) · the authority required for each offered action (`SMA §5.8`) |
| **Allowed actions** | `Release hold` · `Release reserved quantity` — **a specified quantity only** (`BR-152`, `IVN-048`) · `Cancel order` pre-dispatch · `Amend` under `OM §7.9` |
| **Unavailable / blocked** | 🔴 **NO HOLD DURATION, AGEING, SLA, AUTO-CANCELLATION OR AUTO-RELEASE EXISTS** (`BR-151`) — **each was explicitly prohibited by the business, not merely omitted; no countdown, expiry or escalation renders** · 🔴 **cancel consequences — BLOCKED (`GAP-020`)** · 🔴 **`ON_HOLD` never renders as releasing a reservation** (`BR-149`) · 🔴 **no backorder waiting state exists and none is drawn** (`BR-153`) |
| **Canonical dependencies** | `BR-149`–`BR-157` · `EVT-010`, `EVT-011` · `IVN-047`–`IVN-050` · `SMA §5.8` · `CP-8` |
| **Coverage owed** | Releasing a reservation releases **only the selected quantity** and never silently more (`BR-152`) · a held order renders as still committed (`BR-149`) · no expiry or auto-release renders · a shortage renders without blocking any control · a released reservation is never rendered as reclaimable — it is spent and never reactivates (`IVN-050`) |

> **a.** ⚠ **THE HOLD REASON DOES NOT NEED TO BE MACHINE-READABLE** (`OM §24.1`). **Every branch is driven by
> a separate explicit act, so no behaviour is derived from a reason code.** 🔴 **The surface must not build a
> reason vocabulary; none is ratified and none is required.**

---

# 5. Implementation constraints

> **`OSC-040` — 🔴 THE ORDERS CARD GEOMETRY IS DECLARED ONCE AND IMPORTED.** **The card and row column
> geometry is exported from one module and every Orders row surface imports that constant.** ⚠ **Redeclaring
> the columns is how a second surface silently stops matching the workspace** — the defect `LSC-031.a` records
> from live experience.

> **`OSC-041` — 🔴 STYLING READS CSS CUSTOM PROPERTIES FROM `design/tokens.css`.** **No raw hex in
> components, no CSS-in-JS library, no utility-class framework** (`TEC-` exclusions, `RULE 15.1`).

> **`OSC-042` — 🔴 SEMANTIC STATE RESOLVES THROUGH THE SHARED ROLE MAP AND EVERY ROLE CARRIES A MANDATORY
> TEXT LABEL** (`RULE 3.3.d`, `RULE 3.3.g`, `RULE 8.4`). **No state is communicated by colour alone.**
>
> **a.** 🔴 **A STATE TAKES THE ROLE ITS MEANING DESERVES, NEVER THE ROLE IT RESEMBLES** (`RULE 3.14.a.a`).
> ⚠ **A normal state is not `danger` because it needs attention, and an exception is not `neutral` because it
> is common.**
> **b.** 🔴 **CANONICAL RED IS RESERVED FOR DESTRUCTIVE ACTION SEMANTICS** (`RULE 3.3.c`) — **three
> enumerated placements and nowhere else.** ✅ **A BLOCKED marker is therefore NEUTRAL: a missing rule is not
> a destructive act, and colouring it red would misstate what it is.**

> **`OSC-043` — 🔴 MONEY CROSSES THE API BOUNDARY AS A STRING, never a JSON number** (`TEC-015`, `DB-079`).
> ⚠ **No `Number` on any monetary path, and no rounding in the browser.** ✅ **Formatting precision is not
> calculation precision.**

> **`OSC-044` — 🔴 PERMISSION GATES LIVE IN THE APPLICATION SERVICE**, as private `require…()` helpers that
> throw `AccessDeniedByPermissionException` — 🔴 **NOT `@PreAuthorize`, NOT a controller-level gate** — the
> pattern `LSC-032` established. **Hiding a control in the browser is presentation; the server refuses
> independently.**

> **`OSC-045` — 🔴 NO MOCKED ORDER FIELD IS INTRODUCED.** **A value the system does not hold is ABSENT or
> UNAVAILABLE and renders as such.** ⚠ **It never becomes a zero, an empty string or a plausible default**
> (`SYS-034`). ✅ **The two failures this rule exists to prevent are both on record: a margin rendered `৳0`
> when it was unknown, and a listing edit form that read as broken because nothing said why it was empty.**

> **`OSC-046` — 🔴 STRUCTURED OPERATIONAL ROWS DO NOT WRAP** (`RULE 7.4`). **Every Orders row surface carries
> the `minWidth: 0` / `minmax(0, …)` / `nowrap` / ellipsis discipline.** ⚠ **Zoom changes scale and viewport
> visibility — never information existence; page size and record count never change with viewport or zoom.**

> **`OSC-053` — ✅ THE FOUR SUMMARY FIGURES. Product-owner decision, 2026-08-23.**
>
> 🔴 **THE SHIPPED KPIs WERE NOT DEFINED — THEY WERE WITHDRAWN.** ⚠ **`GAP-004` asked what
> `Total Orders` / `Confirmed Today` / `Total Revenue` / `Total Margin` mean. The business answered by
> naming a DIFFERENT four**, and the capture's set carries no authority from this rule.
>
> | Figure | What it counts | Rule it rests on |
> |---|---|---|
> | **Total orders** | Every channel order matching the active filter. ⚠ **Cancelled orders are INCLUDED** — it states how many orders exist, not how many succeeded | — a count |
> | **Today's orders** | Orders whose ingestion timestamp falls on today's business date | 🔴 **`TEC-050`, `TEC-052` — `Asia/Dhaka`, never a UTC-truncated instant** |
> | **Today's dispatched** | Orders first observed as canonically `DISPATCHED` on today's business date | **`OSC-053.c`** |
> | **Total collectable** | Order value of orders whose canonical status is `DELIVERED` | 🔴 **`BR-033` — the obligation follows DELIVERED goods; `SM-5` `DUE` is *"Delivered; payment expected"*; `BR-035` — money is Trioloo's only once it ARRIVES** |
>
> **a.** ✅ **NO MARGIN OR REVENUE FIGURE IS RATIFIED, AND THAT IS THE POINT.** **`GAP-004` called margin
> *"the most dangerous"*: `BR-007` makes an uncosted line's margin UNKNOWN and `SYS-034` forbids summing
> unknowns as zeros, so a pre-settlement margin would be confidently wrong and undetectable from the screen**
> (`BR-011`, `BR-067`). 🔴 **Neither is drawn.**
> **b.** ⚠ **`Total collectable` SUBTRACTS NOTHING, BECAUSE NOTHING HAS BEEN RECEIVED.** **No receipt,
> remittance or settlement record exists, so the figure is the delivered-and-unsettled position in full.**
> 🔴 **When Payment lands it must become `delivered − received`; that is a restatement of a published number
> and belongs to Payment's amendment, never to an implementation tidy-up.**
> **c.** 🔴 **`Today's dispatched` COUNTS AN ERP OBSERVATION, NOT A MARKETPLACE FACT.** **`DZC-045.e` and
> `DZC-047.c` enumerate every field the provider publishes and NONE is a dispatch timestamp**, so when the
> carrier took the parcel is not readable. ✅ **What is recorded is the instant this system FIRST saw the order
> carrying `DISPATCHED` — written once, never rewritten, and never reconstructed afterwards from
> `provider_updated_at`, which moves for unrelated reasons.** ⚠ **ON THE FIRST BACKFILL THE FIGURE IS WRONG:**
> every already-shipped order is first observed on one day, so that day's count is the backlog. 🔴 **Stated,
> not designed around.**
> **d.** 🔴 **EVERY FIGURE HONOURS THE ACTIVE FILTER.** ⚠ **A card stating a different population from the
> cards beneath it on the same screen is the failure this clause exists to prevent.**
> **e.** 🔴 **A FIGURE THE SERVER CANNOT SUPPLY RENDERS AS AN EXPLICIT ABSENCE, NEVER AS `0`** (`OSC-045`,
> `SYS-034`). ✅ **A real zero and an unavailable figure must not look alike.**
> **f.** 🔴 **`Total collectable` CROSSES AS A STRING AND IS NEVER PARSED** (`OSC-043`, `TEC-015`).

> **`OSC-054` — ✅ THE STATUS TABS ARE FILLED BY THE ADAPTER'S TRANSLATION, NOT BY A UI MAPPING.**
>
> ✅ **`§4.3` makes translation an ADAPTER responsibility in its own words — *"Translation — Convert channel
> vocabulary into canonical vocabulary (status names, payment methods, address formats)"* — and `BR-005`
> forbids any downstream stage from carrying channel-conditional behaviour.** ✅ **`DZC-045.c.ii` says the same
> from the other side: *"Mapping it to `SM-1` is ADAPTER WORK and is not performed here."***
>
> **a.** 🔴 **THE SURFACE FILTERS ON THE CANONICAL MIRROR AND NEVER ON A CHANNEL'S OWN SPELLING.** ⚠ **A tab
> that matched the string `ready_to_ship` would put Daraz vocabulary into the Orders workspace, which is
> exactly what `BR-005` prohibits.**
> **b.** 🔴 **THE MIRROR AND THE RAW CHANNEL STATUS ARE BOTH RETAINED, AS TWO FACTS** (`BR-171`, `BR-173`,
> `UX-182`, `OSC-036`). ✅ **The card shows both, separately labelled.** 🔴 **They are never merged.**
> **c.** ⚠ **A CHANNEL VALUE THE ADAPTER CANNOT TRANSLATE IS OMITTED FROM THE MIRROR, NEVER APPROXIMATED**
> (`BR-134`, `SYS-034`). ✅ **The surface says the status was not translated rather than borrowing the
> marketplace's word and presenting it as a canonical state.**
> **d.** ⚠ **SEVERAL TABS CAN ONLY BE EMPTY IN THIS SLICE.** **`CONFIRMED`, `RELEASED`, `IN_FULFILLMENT`,
> `ON_HOLD` and `CLOSED` are reached by Trioloo's own acts, and this read-only slice performs none of them.**
> ✅ **An empty tab is an honest fact, not a defect, and no figure is invented to populate one.**
> **e.** 🔴 **THIS RATIFIES NO LIFECYCLE BEHAVIOUR.** **`§7.8` still places an imported order in
> `PENDING_VERIFICATION`, `BR-171` still forbids the external status re-driving the lifecycle, and nothing
> here creates a state, a transition or an event** (`OSC-003`).

> **`OSC-055` — ✅ THE ORDER CARD VISUAL AUTHORITY. Approved 2026-08-24.**
>
> | | |
> |---|---|
> | **Artifact** | *Order Card DS* — `Order Card DS.dc.html` |
> | **Source project** | Claude Design `63b1762f-7588-4c3f-bf32-afc766fb3351` |
> | **Tracked as** | [`design-reference/Order Card DS.md`](design-reference/Order%20Card%20DS.md) — the written specification |
> | **Implemented in** | `frontend/src/order/OrderCard.tsx` |
>
> **a.** 🔴 **THE PROJECT WAS NOT READABLE AND THE DESIGN WAS NOT IMAGINED.** **`DesignSync`
> returned `HTTP 404 — project not found` for both `get_project` and `list_files`** — ⚠ **the same
> condition `OSC-012` recorded for project `e56dcf10-…`.** ✅ **The product owner supplied the
> rendered bundle directly, and the specification is transcribed from its own markup rather than
> from a screenshot.**
> **b.** ✅ **THIS DISCHARGES `OSC-011` FOR THE CARD.** **`OSC-011` recorded that no Orders pack was
> tracked repo-locally and that the visual authority therefore lived only at a URL a reader might
> not reach.** **A written specification now sits under `design-reference/`, exactly as
> `SHOPS_CHANNELS_` and `LISTINGS_SCREEN_CONTRACT.md` do for their packs.** ⚠ **`OSC-011` remains
> open for the two `OSC-010` artboards, which are still URL-only.**
> **c.** ✅ **NOTHING WAS INVENTED, AND THAT IS A FINDING RATHER THAN AN ASSURANCE.** **Every
> `oklch(…)` value in the design resolves to an existing token in `frontend/src/design/tokens.css`,
> because the design was authored from the same matrix.** ⚠ **ONE value has no token — the
> `Received`/`Margin` label at `oklch(0.55 0.015 290)` against `--color-text-muted`'s
> `oklch(0.5 …)`.** 🔴 **The TOKEN is used; `RULE 15.1` forbids hard-coding the literal, and the
> one-step difference is recorded in the specification.**
> **d.** 🔴 **THE CARD TAKES THE DESIGN'S COMPOSITION AND REFUSES ITS SAMPLE DATA.** **`Not
> Released` is not rendered — `BR-080` withdrew the state outright; `Cost`, `Charges`, `Received`
> and `Margin` render UNKNOWN rather than the mock's figures (`INV-32.4`, `BR-033`, `BR-007`,
> `SYS-034`); `More Actions` is not drawn (`OSC-051.b`).** ✅ **`design-reference/README.md` states
> the governing principle: a mockup's sample data is a visual pattern to keep and a business claim
> to discard.**
> **e.** ⚠ **THE `Margin` FIGURE IS ALSO NOT PAINTED GREEN.** **`--color-positive` states a GAIN,
> and an unknown margin has not been shown to be one** (`RULE 3.14.a.a` — role by meaning, never by
> resemblance). 🔴 **`BR-007` uncosted lines and `SYS-034` unknown-is-not-zero are precisely why
> `OSC-053` WITHDREW the shipped `Total Margin` KPI; the card must not reintroduce the same claim in
> colour, and `E-032`'s own note already records the live defect of a line rendering a margin that
> was in fact unknown.**
> **f.** ⚠ **`support.js` CARRIES NO VISUAL AUTHORITY AND WAS NOT IMPLEMENTED.**
> **`design-reference/README.md` already records it as generated `dc-runtime` code with zero
> tokens, zero `oklch` values and zero `Manrope` references.**
> **g.** 🔴 **ALL THREE BANDS ARE STRUCTURED OPERATIONAL ROWS** (`RULE 7.4`, `UX-266`, `OSC-046`)
> **and none carries `overflow-x`** (`UX-265`).

> **`OSC-056` — ✅ THE ORDER CARD, AMENDED BY THE PRODUCT OWNER. 2026-08-24.**
>
> ⚠ **EVERY CLAUSE HERE IS THE OWNER'S DECISION, NOT A DESIGN FINDING.** **`OSC-055` built the card
> from the approved design; this rule records where the owner has since moved it, and the reasoning
> attached to each clause is the CANONICAL BASIS for implementing that decision — never a
> substitute for it.**
>
> **a.** ✅ **THE ECONOMIC ORDER STANDS: `Sale · Cost · Charges`, THEN `Received · Margin`.**
> 🔴 **`Margin` NO LONGER SITS AGAINST THE ACTION CONTROLS.** ⚠ **A button pressed against the last
> figure reads as a button acting ON it**; a vertical divider now states the boundary that spacing
> alone only implied. ✅ **All four demoted-and-primary values still render UNKNOWN** — `OSC-055.d`
> is untouched.
> **b.** 🔴 **THE `SM-5` PAYMENT POSITION IS SHOWN AS A CHIP BESIDE THE LIFECYCLE CHIP, AND ONLY
> THREE OF ITS ELEVEN STATES MAY EVER BE RENDERED.**
>
> | Rendered | When | Basis |
> |---|---|---|
> | **`Payment not due`** | any `SM-1` state before delivery | `OM §11.3` — `NOT_DUE` is *"goods not yet delivered"*; `SM-5.4` prohibits `NOT_DUE → RECEIVED` before delivery (`BR-033`) |
> | **`Payment due`** | `DELIVERED` | `SM-5`'s `NOT_DUE → DUE` is **Automatic — on delivery** (`EVT-013`); `OM §11.3` — *"delivered; payment expected"* |
> | **`Payment unknown`** | `RETURNED`, `CLOSED`, or an untranslated state | `SYS-034` |
>
> **b.i.** 🔴 **NOTHING PAST `DUE` IS EVER CLAIMED.** **`COLLECTED_BY_INTERMEDIARY`,
> `PARTIALLY_RECEIVED`, `RECEIVED`, `RECONCILED`, `SHORT_SETTLED`, `OVER_SETTLED`, `REFUND_DUE`,
> `REFUNDED` and `WRITTEN_OFF` each require an `E-040 Receivable` that has been collected, matched
> or settled**, ⚠ **and no receipt, remittance or settlement record exists in this slice** — the
> same absence `OSC-053` recorded when `Total collectable` subtracts nothing.
> **b.ii.** ⚠ **`Payment due` DOES NOT ASSERT THE BUYER HAS NOT PAID.** **`BR-035` — money held by
> a courier or a marketplace is not money received by Trioloo** — so a COD order settled on the
> doorstep is still legitimately `DUE`. 🔴 **This is also why the chip is INFO and never SUCCESS:
> `OM §11.1` states outright that an order marked paid at delivery is a false statement on every
> channel Trioloo operates.**
> **b.iii.** 🔴 **`RETURNED` AND `CLOSED` ARE `UNKNOWN`, NOT `NOT_DUE`, AND THIS IS THE CAREFUL
> CASE.** **`OM §6.2` defines `RETURNED` as *"goods came back to Trioloo"*, so they reached the
> buyer and a receivable may well have been raised; `SM-5` reaches `REFUND_DUE` only from
> `RECONCILED`, which cannot be evidenced here.** **`CLOSED` means *"all sub-processes terminal"*,
> so `SM-5` is at one of three terminals and nothing held says which.** ⚠ **Calling either *not
> due* would state a position the architecture does not support.**
> **c.** ✅ **THE MARKETPLACE'S OWN STATUS IS A BARE CHIP INSIDE THE MARKETPLACE'S OWN CLUSTER —
> shop name, external order id, then the word.** 🔴 **THE `Marketplace · ` PREFIX IS WITHDRAWN.**
> ⚠ **`UX-185` still requires the fact to be VISIBLY EXTERNAL, and it is — by GROUPING rather than
> by a prefix word: the chip sits between the shop that reported it and the id that shop gave it
> (`BR-002` names the instance, never the channel type alone).** 🔴 **`UX-182`'s prohibition is on
> MERGING the two into one chip, and they are not merged: the external chip is OUTLINED in muted
> ink and prints the marketplace's own spelling, the ERP's is FILLED and semantic, and they never
> touch.** ⚠ **The external word is not title-cased, mapped or tidied** — `BR-171` keeps it an
> external fact and `BR-005` puts vocabulary translation in the adapter, which has already produced
> the canonical chip.
> **d.** 🔴 **THE AUTHORITY CHIP IS REMOVED FROM THE CARD.** ✅ **The fact is NOT lost, and that is
> what makes the removal admissible: `UX-183` requires `BR-174`'s causing action, actor and
> timestamp to be *"visible on inspection"* — INSPECTION IS `FRAME 02` — and `OrderDetailPage.tsx`
> carries the authority in both its header badge and its fact list.** ⚠ **On a list where every
> imported order is `API_MANAGED`, the chip distinguished nothing** (`RULE 3.3.d.e`).
> **d.i.** 🔴 **A DEFECT IS REPORTED, NOT FIXED HERE.** **`ownershipLabel` renders `API-managed`
> and `ERP-managed` — INTERNAL TERMINOLOGY, which is exactly what `UX-183` forbids.** ⚠ **The
> ratified wording is *"The marketplace still updates this order"* / *"Trioloo now controls this
> order; marketplace updates will not overwrite it"*.** **Removing the chip from the card leaves
> `FRAME 02` as the sole carrier of a fact it states in the wrong vocabulary; the fix belongs to a
> `FRAME 02` task and is owed.**
> **e.** ✅ **THE `Not Released` SLOT NOW CARRIES THE PAYMENT POSITION.** **`OSC-055.d` withdrew the
> design's chip because `BR-080` withdrew the state; the slot now holds a fact the order really
> has.**
> **f.** ⚠ **`More Actions` IS RENDERED, AND `OSC-051.b` IS ONLY HALF SATISFIED — WHICH IS RECORDED
> RATHER THAN GLOSSED.** **That clause admits a withheld control when the owner ratifies the
> missing rule AND the slice can show a real permitted action.** ✅ **The owner has ratified the
> control.** 🔴 **NO ACTION EXISTS BEHIND IT** — amend, release, hold, cancel and push are each
> outside this read-only slice or blocked in `OSC-050`. ✅ **So it does not pretend: it carries
> `aria-disabled`, it opens no menu onto nothing, and its title states plainly that the actions are
> not built.** ⚠ **An operator who clicks it learns the truth instead of meeting silence.**
> 🔴 **THE ACTION SET IT WILL CARRY IS A BUSINESS DECISION AND IS NOT INVENTED HERE.**
> **g.** ✅ **THE INVOICE ELEMENT SHEDS ITS NUMBER AND BECOMES THE PRINTABLE-INVOICE ACTION SLOT.**
> ⚠ **An action does not caption itself with the identifier of the document it would produce**, and
> `not issued` on every imported order was a blank pretending to be information. 🔴 **The number is
> not lost — `FRAME 02` carries it as a fact of the order, which is where an identifier belongs.**
> ⚠ **The print action itself is NOT built and `DOCUMENT_PRINTABLE_ARCHITECTURE.md` owns it.**
> **h.** 🔴 **ALL THREE BANDS REMAIN STRUCTURED OPERATIONAL ROWS** (`RULE 7.4`, `UX-265`,
> `UX-266`). **Nothing added here wraps or introduces `overflow-x`.**

> **`OSC-057` — ✅ THE TRIOLOO-ISSUED INVOICE NUMBER, AND THE ORDER SELECTION. 2026-08-24.**
>
> ⚠ **THE PRODUCT OWNER SUPPLIED A BUSINESS RULE THAT `GAP-035` RECORDED AS MISSING.** **`GAP-035`
> stated that no document specified invoice numbering, invoice content, or when a number is
> assigned.** ✅ **The numbering half is now answered by the owner; the other two halves are NOT,
> and `GAP-035` stays open in a narrower place.**
>
> **a.** ✅ **ONE SEQUENCE, `TR0001` UPWARD, OLDEST TO NEWEST, EVERY ORDER, NEVER REGENERATED.**
>
> | | |
> |---|---|
> | **Shape** | `TR` + a zero-padded ordinal, minimum four digits — `TR0001` … `TR9999`, then `TR10000` |
> | **Displayed** | `INV: TR0001`, top right of the card, after the payment-method divider, bold and upper-cased |
> | **Stored** | `channel_order.trioloo_invoice_number` — the bare number, without the `INV: ` label |
> | **Backfill** | `V19`, ordered `provider_created_at`, then `imported_at`, then `external_order_id` |
> | **Issued** | in the import path, once, to an order that has none |
>
> **a.i.** ✅ **THIS IS NOT A SECOND SEQUENCE, WHICH MATTERS BECAUSE A SECOND ONE IS FORBIDDEN.**
> **`BD-443` and `INV-39.1` ratify exactly ONE Sales Invoice number sequence and prohibit creating
> another.** ⚠ **`V19` creates one sequence, and it is that one.**
> **a.ii.** 🔴 **THE `INV: ` PREFIX IS A LABEL, NOT PART OF THE IDENTIFIER.** **A colon and a space
> inside a stored business key would make every search, export and join carry them.** ✅ **The
> stored value is `TR0001`; the surface renders the prefix.** ⚠ **Upper-casing is `textTransform`,
> not an upper-cased VALUE — a surface that capitalised the data would make the displayed text
> differ from what a person types into search.**
> **a.iii.** 🔴 **IMMUTABILITY IS ENFORCED AT THE TABLE, NOT BY THE ISSUING CODE.** **`V19` adds a
> `BEFORE UPDATE` trigger that raises on any change to an issued number, including to `NULL`.**
> ⚠ **The owner said *no invoice will be regenerated*; an application-side guard is a weaker promise
> than that, because a repair script, a console session or a future `ON CONFLICT` clause would each
> slip past it.**
> **a.iv.** ⚠ **NUMBERS ARE ISSUE-ORDERED, NOT DATE-ORDERED, AFTER THE BACKFILL.** **An order
> imported later takes the next number even where the marketplace created it earlier.** 🔴 **The
> alternative is reissuing numbers to keep the sequence in date order, which `DB-012` forbids
> outright and the owner's instruction forbids again.**
> **a.v.** ⚠ **A GAP IN THE RUN IS NOT AN ORDER LEFT OUT.** **`DB-012` retires a number rather than
> recycling it, so `TR0007` may one day have no order.** ✅ **What the owner required is that no
> ORDER is skipped, and every order carries one.**
> **b.** ✅ **PLACEMENT — top right, after the `COD` / payment-method divider, bold and capital**,
> as the owner specified.
> **b.i.** 🔴 **THE `order_number` COLUMN IS NOT RENDERED, AND THE READ THAT SETTLED IT IS
> RECORDED.** **All 158 production rows satisfy `order_number = external_order_id`: the column
> holds a COPY of Daraz's own id, not a Trioloo reference.** ⚠ **Showing it would print the
> marketplace's number twice and dress the second copy as Trioloo's** (`PRN-014` — an internal
> reference is not a human-facing document number, and the two are never conflated). ✅ **This is
> the FIRST Trioloo-issued human-facing number these orders have ever carried.**
> **b.ii.** ✅ **THE NUMBER IS SEARCHABLE.** **It is the reference a person reads off the card, so
> it is the one they will type**; the list query matches it alongside the external id, the order
> number and the customer name.
> **c.** ✅ **EVERY ORDER CARD CARRIES A SELECTION CHECKBOX, LEADING THE ROW, BEFORE THE CUSTOMER
> ICON.** 🔴 **NO BULK BAR IS DRAWN AND NONE IS IMPLIED.** ⚠ **`PRM-025` requires every record to
> be authorised individually with per-record results (`SYS-073`), and `GAP-034` records that NO
> permitted-bulk-transition inventory exists** — **`GAP-034` names the exact controls that must not
> appear: `Change status to…`, `Send to Steadfast`, `Print invoices`, `Export selected`.** ✅ **The
> selection is a reading aid until the owner ratifies what may be done to a set.**
> **c.i.** 🔴 **THE SELECTION IS CLEARED WHENEVER THE RESULT SET CHANGES** — filter, tab, search or
> page. ⚠ **A selection that survived would leave the operator holding records they can no longer
> see, which is the class of mistake per-record authorisation exists to prevent.**
> **c.ii.** ✅ **THE CHECKBOX'S ACCESSIBLE NAME CARRIES THE INVOICE NUMBER AND THE CUSTOMER.**
> ⚠ **Fourteen checkboxes all named *"Select order"* tell a screen-reader user nothing.**
> **d.** 🔴 **REPORTED, NOT RESOLVED — THE NUMBER IS ISSUED AHEAD OF THE DOCUMENT.** **`E-039 Sales
> Invoice` is an ENTITY carrying an issue date, a customer snapshot, line detail and totals, and
> `INV-39.2` requires that content be snapshotted so the invoice stays reproducible years later.**
> ⚠ **None of that is created here.** **A number now exists for 158 orders — 117 of them
> `CANCELLED` and never delivered — with no invoice behind it.** ✅ **This is the owner's explicit
> instruction (*every existing and future order, none skipped*) and `DB-012` accommodates it: a
> cancelled number is retired, not recycled.** 🔴 **What `GAP-035` still leaves open is what an
> invoice CONTAINS and WHEN it is properly issued, and the owner is owed that question.**
> **e.** 🔴 **NO PRINT ACTION IS BUILT.** **`DOCUMENT_ARCHITECTURE.md` owns the printable, and
> `OSC-056.g`'s invoice slot remains an action with nothing behind it.**

> **`OSC-058` — ⚠ THE PAGE-HEADER ACTIONS, THE PAGE SIZE AND THE SELECTION. 2026-08-24.**
>
> **The product owner asked for three header actions — Export, Print, Create Order.** ✅ **ONE IS
> BUILT.** 🔴 **TWO ARE BLOCKED, and they are blocked on canonical grounds that no amount of
> implementation can remove.**
>
> **a.** 🔴 **`Create Order` — BLOCKED — MISSING CANONICAL BUSINESS RULE.**
> **`PRM-091` ratifies exactly two Order capability codes and states in terms that NEITHER grants
> Order mutation.** ⚠ **`PRM-089.b` is a SPELLING RULE AND NOT A GENERATOR — *a code exists only
> where a canonical capability does* — so a create permission cannot be minted to make a button
> work.** 🔴 **A write path with no ratified authority behind it is exactly what `CLAUDE.md` §8
> forbids: frontend hiding is not authorization, and backend enforcement needs a code to enforce.**
> ⚠ **Three further gaps sit under the same modal**: **`GAP-035`** — no document states what an
> invoice contains, when a number is assigned, or whether partial payment at creation is permitted
> (and `§11.3`'s `NOT_DUE` says payment is not due before delivery); **`GAP-023`** — an abandoned
> modal's disposition is unspecified; **`GAP-003`** — the modal produces a tax-bearing document
> with no tax model behind it.
> **a.i.** ⚠ **WHAT IS NOT IN DOUBT is that manual order capture is a real business capability**
> (`OM §22` — *"Owns | Manual order capture"*) **and that a manual line is priced by staff**
> (`PRD-139`, `BR-145`, `BR-148`). 🔴 **The capability existing is not the same as the authority,
> the states and the document being specified, and only the first is settled.**
> **b.** 🔴 **`Print` — BLOCKED — MISSING CANONICAL BUSINESS RULE.**
> **`PRN-023` sources the Sales Invoice printable from `E-039` (Accounting) and marks it
> `SNAPSHOT` — `INV-39.2` requires the content snapshotted so the invoice stays reproducible years
> later.** ⚠ **No `E-039` record exists. `OSC-057` issued the NUMBER; the DOCUMENT was not
> created, and a printable cannot render from a record that is not there** (`PRN-022` — every
> printable has exactly one deterministic authoritative source). 🔴 **`DOCUMENT_ARCHITECTURE.md`
> also decides NO layout, paper size, typography or print CSS by its own scope statement, and
> `GAP-003` leaves the tax detail undefined on a tax-bearing document.**
> **b.i.** ⚠ **BULK PRINTING WOULD ALSO NEED `GAP-034`.** **`Print invoices` is one of the four
> bulk controls `GAP-034` names as having no permitted-action inventory.**
> **c.** ✅ **BOTH ARE RENDERED, DISABLED, WITH THE REASON IN VISIBLE TEXT.** ⚠ **`OSC-051.b`
> would withhold them entirely; the owner asked for the header, so the compromise is the one
> `OSC-056.f` already set — the control appears, it does not pretend, and it says why.** 🔴 **The
> reason is VISIBLE TEXT bound by `aria-describedby`, never a `title` alone: a tooltip is
> unreachable by keyboard and invisible on touch, so a disabled action explained only by hover is
> explained to nobody.**
> **d.** ✅ **`Export` IS BUILT IN FULL.** **`RPT-046` already makes every business table
> exportable and `UX-045` names Export among the page actions.**
> **d.i.** 🔴 **SCOPE IS NEVER THE VISIBLE PAGE** (`UX-044.b` — *exporting only the visible page is
> a silent truncation*). ⚠ **At five rows a page that failure would be near-total.** ✅ **A
> SELECTION exports exactly what was ticked; NO selection exports the ACTIVE RESULT SET under the
> current search and filters** (`UX-044.a`), **fetched in full rather than read off the screen.**
> **d.ii.** ✅ **THE LABEL STATES THE SCOPE BEFORE THE CLICK — `Export 3` or `Export all`.**
> **`UX-044.c` permits an all-records export as a DELIBERATE choice and never as a silent
> default.**
> **d.iii.** 🔴 **A PARTIAL EXPORT IS REPORTED, NEVER WRITTEN.** **`RPT-047` and `SYS-073` require
> partial success reported per record and never hidden in an aggregate** — ⚠ **and a CSV that is
> quietly short is the purest form of that failure, because it looks complete.**
> **d.iv.** 🔴 **THE TWO STATUSES STAY TWO COLUMNS** (`BR-171`, `UX-182`, `UX-044.e`). ⚠ **A
> spreadsheet is where merging them would do the most damage: no chip, no tooltip, no page to
> correct the reader.**
> **d.v.** 🔴 **UNKNOWN IS WRITTEN AS THE WORD, NEVER AS AN EMPTY CELL** (`INV-32.4`, `SYS-034`).
> ⚠ **An empty cell SUMS AS ZERO — a reader totalling the `Margin` column would get a confident,
> wrong number with nothing on screen to warn them.** ✅ **Money is the exact authoritative string,
> ungrouped and unrounded** (`TEC-015`, `OSC-043`).
> **d.vi.** 🔴 **BUYER-SUPPLIED TEXT IS NEUTRALISED AGAINST SPREADSHEET FORMULA INJECTION.** **The
> buyer note, the customer name and the delivery address are typed by a stranger on a marketplace,
> and a cell beginning `=`, `+`, `-`, `@` or a control character is EXECUTED on open by Excel,
> Sheets and LibreOffice alike.** ⚠ **A leading apostrophe defuses it; the value is otherwise
> intact, because the operator still needs to read what the buyer wrote.**
> **e.** ✅ **THE PAGE SIZE IS FIVE**, a product-owner decision and a CONSTANT. 🔴 **It is not a
> viewport response: `RULE 7.3.a` and `UX-266` forbid page size, record count or information
> existence changing with zoom or width, and nothing here reads either.**
> **f.** ✅ **`Select all` SELECTS THE CURRENT PAGE, AND A SELECTION SURVIVES PAGING.** ⚠ **This
> AMENDS `OSC-057.c.i`, which cleared the selection on every result-set change including a page
> turn.** 🔴 **The distinction the owner drew is right and is now the rule: TURNING THE PAGE is
> navigation within one result set; CHANGING a filter, a tab or the search REPLACES the result
> set, and a tick that outlived that would leave the operator holding records the new set does not
> contain.**
> **f.i.** ⚠ **`Select all` NEVER MEANS ALL 158.** **A control that silently ticked records the
> operator has never seen would claim a review that did not happen** (`PRM-025` — per-record
> authorisation).
> **f.ii.** ✅ **THE SELECTION HOLDS WHOLE ROWS, NOT IDS.** **With five to a page, orders ticked on
> pages 1–3 are no longer loaded; keeping ids alone would force a refetch or — far worse — silently
> export only the rows the browser still happened to hold.**
> **f.iii.** ✅ **THE COUNT STATES THE WHOLE SELECTION**, including pages no longer on screen.
> 🔴 **STILL NO BULK BAR** (`GAP-034`, `OSC-057.c`).
> **g.** ⚠ **A DEFECT FIXED IN PASSING, REPORTED HERE.** **The two pager buttons carried no
> accessible name at all — their labels were bare chevron glyphs.** ✅ **They now carry
> `Previous page` and `Next page`.**

---

# 6. The blocked register

> **`OSC-050` — 🔴 EVERY BLOCKED ELEMENT, IN ONE PLACE. NONE IS DECIDED HERE.**

| Element | Frame | Marker | Owner |
|---|---|---|---|
| ~~**Four orders-list KPIs**~~ | `01` | ✅ **RESOLVED 2026-08-23 — the shipped four are WITHDRAWN and four different figures ratified** (`OSC-053`, `GAP-004` closed for this workspace) | Product owner |
| **Legacy UI-label → state mapping** | `01` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-017`, 🔴 Critical). ⚠ **Still blocked, and now irrelevant to the tab set: `OSC-054` uses `SM-1` names filled by the adapter and no legacy label at all** | `OM §6.2` |
| **`B2C` as a classification** | `01`, `04` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-022`) | `OM §3.1` |
| **`DRAFT` lifecycle** | `01` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-023`) | `OM §6.2` |
| **Ageing / SLA markers** | `01`, `08`, `09` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-024`) | `SYS-023` |
| **Line-level cancel** | `03` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-025`) | `OM §8.7` |
| **Cancel consequences and rollback ordering** | `02`, `06`, `09` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-020`) | `OM §6.4` |
| **Order notes** | `02`, `04` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-066`) | Order Management |
| **`Mark reconciled` control** | `05` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-019` residual) | Payment / `SM-5` |
| **Permitted bulk transitions** | `01` | **BLOCKED — MISSING CANONICAL BUSINESS RULE** (`GAP-034`) | `OM` / `PRM-025` |

> **`OSC-051` — ✅ A BLOCKED ELEMENT IS RECORDED IN CANON AND WITHHELD FROM THE LIVE READ-ONLY UI.** 🔴 **It
> is not filled, not acted on, and not presented as an operator control until the owning business rule exists.**
> ⚠ **The blocked register remains visible to implementers in `OSC-050`; the production page shows only real
> imported order facts, explicit absences and allowed read-only navigation.**
>
> **a.** ✅ **THIS SUPERSEDES THE ORIGINAL PLACEHOLDER RULE.** The previous v1.0.0 wording required every blocked
> region to keep geometry and render a neutral marker. That preserved design traceability, but in production it
> made unresolved documentation look like operator-facing product functionality.
> **b.** 🔴 **NO BLOCKED BADGE, DISABLED BULK ACTION, MANUAL-ACTION BUTTON OR FUTURE WRITE CONTROL IS RENDERED
> BY THE READ-ONLY MVP.** It may be restored only when the owner ratifies the missing rule and the implementing
> slice can show real data or a real permitted action.
>
> **b.i.** ✅ **AMENDED 2026-08-23 — THE KPI ROW AND THE STATUS TABS ARE NOW RENDERED, BY THIS CLAUSE'S OWN
> TEST.** **The original wording withheld them because they were unresolved documentation; `OSC-053` and
> `OSC-054` resolved them, and each now shows REAL DATA.** ⚠ **The superseded wording — *"NO KPI ROW, LEGACY
> STATUS TAB SET…"* — is retained here** (`DOC-009`) **because it was correct while they were unresolved.**
> 🔴 **NO LEGACY STATUS TAB SET IS RENDERED, THEN OR NOW** (`GAP-017`, `OSC-054`).
> **c.** ✅ **EMPTY DATA IS STILL EXPLICIT.** No order rows renders an empty state that says an approved Daraz order
> pull must run before channel orders appear. It does not fabricate sample cards and it does not imply a defect
> in the page.

> **`OSC-052` — 🔴 NO `order.*` PERMISSION CODE IS RATIFIED, AND IMPLEMENTATION MAY NOT COIN ONE.**
>
> **`PRM-089` fixes the SPELLING — `<owning-module>.<resource>.<action>` — and `PRM-089.b` states plainly
> that this is a spelling rule and NOT a generator.** 🔴 **`PRM-089.f`: a capability whose code is not yet
> ratified is not implementable, and `PRM-003` denies what is not granted.**
>
> **a.** ✅ **THE ARTBOARDS DRAW THE CONTROLS ANYWAY, DELIBERATELY** — **composition is settled now so that
> naming the codes later changes a gate, not a layout** (`RULE 3.14.a.c`, the same reasoning).
> **b.** 🔴 **THIS IS THE HARDEST BLOCKER ON ANY ORDERS BACKEND SLICE** and is named by the owning module
> under `PRM-007`, not by this contract and not by implementation.
>
> ✅ **DISCHARGED 2026-08-23 BY `PRM-091`. The wording above is retained** (`DOC-009`) **because it was
> correct when written and because it records WHY the codes could not simply be invented here.**
>
> **c.** ✅ **THE OWNING MODULE HAS NOW NAMED THEM:** **`order.channel-order.view`** — read-only dashboard
> and detail — **and `order.channel-order.sync`** — initiate an inbound channel-order pull. **Two codes, and
> `PRM-091.c` keeps probe, incremental poll and backfill on the one `sync` code rather than inventing a
> third.**
> **d.** 🔴 **NEITHER GRANTS ORDER MUTATION, INVENTORY MOVEMENT, PAYMENT OR SETTLEMENT ACTION, SHIPMENT
> ACTION, OR ANY MARKETPLACE WRITE** (`PRM-091.b`). ⚠ **The frames may now cite them; `OSC-044` still
> requires the gate to live in the application service.**
> **e.** ⚠ **THIS UNBLOCKED GATING BEFORE THE READ-ONLY UI SLICE.** **The superseded "no frame is built"
> wording is retained above and in history (`DOC-009`); the current frame state is now the `OSC-020`
> register: `FRAME 01`–`FRAME 08` are built read-only, `FRAME 09` is not built, and every entry in
> `OSC-050`'s blocked register still stands.**

---

# 7. Sequencing and the migration boundary

> **`OSC-060` — 🔴 NO MIGRATION NUMBER IS PROPOSED BY THIS CONTRACT, AND NONE MAY BE UNTIL PRODUCTION FLYWAY
> STATE IS READ.**
>
> ⚠ **THE `V15` CONTRADICTION IS UNRESOLVED** ([`LISTINGS_PAUSE_HANDOFF.md`](LISTINGS_PAUSE_HANDOFF.md) §4,
> §6.a). **`V15__channel_listing_review.sql` is present in the deployed commit's tree and `DEP-071` records
> that migrations run in-process at backend startup — so starting that artifact would apply it — while
> `GAP-136` records `V15` as unapplied in production and the release branch is named `v14n-no-v15`.**
> 🔴 **Nothing in the repository reconciles the two.**
>
> **a.** 🔴 **`DEP-070.b` — PENDING MIGRATIONS ARE DETERMINED BY READING PRODUCTION `flyway_schema_history`
> AND ARE NEVER ASSUMED.**
> **b.** ✅ **RESOLUTION IS A READ, NOT A DECISION**, and it is owed **BEFORE** the next backend deployment,
> because that deployment applies whatever is pending as a side effect of starting.
> **c.** 🔴 **AN ORDERS MIGRATION PROPOSED AGAINST AN ASSUMED CEILING WOULD BE A DEFECT**, and this contract
> therefore describes the migration SURFACE without numbering it.
>
> ✅ **RESOLVED 2026-08-23. The wording above is retained** (`DOC-009`) **because it records the position
> that was correct while the question was open.**
>
> **d.** ✅ **THE READ WAS PERFORMED.** **Production `flyway_schema_history` is at `V14`, `V15` is unapplied
> and `channel_listing_review` is absent — because the DEPLOYED jar carries `V1`–`V14` and no `V15`.**
> 🔴 **There was never a contradiction: `DEP-071` cannot apply a migration the deployed artifact does not
> contain.**
> **e.** ✅ **THE POSITION IS NOW A TAKEN DECISION** — **`DEP-125` applies `V15` deliberately on the next
> deployment, behind the backup gate, and discontinues V15-free release branches.**
> **f.** ✅ **THE BAR IS THEREFORE LIFTED AND AN ORDERS MIGRATION MAY BE NUMBERED.** 🔴 **Only after the
> `DEP-031` pre-flight read confirms the applied ceiling at the time** — **`DEP-070.b` is unchanged and a
> number is never taken from an assumed ceiling.**

> **`OSC-061` — ✅ THE RECOMMENDED FIRST IMPLEMENTATION SLICE.**
>
> **`FRAME 01` and `FRAME 02` READ-ONLY, `API_MANAGED` records only, with `FRAME 08` beside them.**
>
> **a.** ✅ **WHY THESE.** **They need no release gate, no reservation, no hold, no amendment, no push and no
> `SM-3`/`SM-4`/`SM-5` action.** **`FRAME 08` reads a projection that is complete by construction**
> (`INV-34.2`).
> **b.** ✅ **THE `GAP-017` TAB BLOCK DOES NOT STOP IT.** **The list ships as a single unfiltered collection
> with NO status tabs until the mapping is answered** — 🔴 **honest, and better than inventing a mapping that
> would silently mis-file every order.**
> **c.** 🔴 **IT IS STILL HARD-BLOCKED ON `OSC-052`.** **No endpoint can be permission-gated without a
> ratified code.** ⚠ **Ratifying the `order.*` codes is the first task, and it is a business decision, not an
> engineering one.**
> **d.** 🔴 **WHAT THE SLICE MUST NOT DO:** **no write path, no state transition, no bulk action, no invented
> KPI, no invented tab, no migration number.**

---

# 8. Expected test coverage

> **`OSC-070` — ✅ WHAT EVERY FRAME OWES WHEN IT IS BUILT.** ⚠ **Recorded now so coverage is designed with the
> surface rather than retrofitted.**
>
> **a.** ✅ **A frame-tag traceability test** — every component names its `FRAME NN` (`OSC-002`).
> **b.** ✅ **A no-write-on-render test** — opening a surface issues no `PUT` or `POST`. **The precedent is
> `LSC-061.i`, written after a page was reported broken for a reason no test had covered.**
> **c.** ✅ **A lifecycle-independence test** — the per-lifecycle rows never collapse into one (`OSC-031`).
> **d.** ✅ **A withheld-placeholder test** — unresolved blocked markers, disabled future controls and invented
> figures do not render in the live read-only UI (`OSC-045`, `OSC-051`).
> **e.** ✅ **An attribution test** — an `AUTO_CONFIRMED` order renders no human `Confirmed By` (`BR-166`).
> **f.** ✅ **A money-path test** — no monetary value passes through `Number` (`OSC-043`).
> **g.** ✅ **A permission-refusal test** — the server refuses independently of whether the control was hidden
> (`OSC-044`). 🔴 **Writable only once `OSC-052` is discharged.**
> **h.** ✅ **A no-wrap / layout-stability test** — structured rows do not wrap and record count does not
> change with viewport or zoom (`OSC-046`).
> **i.** 🔴 **NO TEST FABRICATES AN OUTCOME PRODUCTION HAS NEVER PRODUCED.** ⚠ **The `LSC-057.b` discipline:
> a surface proven against imaginary states proves nothing about the real ones.**

---

# 9. State of the world

| Fact | State |
|---|---|
| Order backend package / entity / service | ✅ **Exists** — import persistence, query API and read endpoints are implemented |
| Order frontend module / route / page | ✅ **Exists** — `/sales/orders` and `/sales/orders/:id` render read-only Orders surfaces |
| Order migration | ✅ **Exists** — `V16__channel_order_import.sql` in the codebase; deployment still applies pending migrations behind `DEP-125` |
| `FRAME 01`–`FRAME 09` | ✅ **FRAME 01–08 built as read-only first slice; FRAME 09 not built and its placeholders withheld** |
| Orders KPI row | ✅ **Ratified and rendered** — four figures (`OSC-053`); `Total Revenue` and `Total Margin` WITHDRAWN |
| Orders status tabs | ✅ **Ratified and rendered** — `SM-1` names filled by the adapter translation (`OSC-054`); no legacy label |
| Canonical status mirror | ✅ **Persisted beside the raw channel status, never instead of it** (`BR-171`, `BR-173`) |
| Dispatch observation | ⚠ **An ERP observation, not a marketplace fact** — the provider publishes no dispatch timestamp (`OSC-053.c`) |
| Approved visual authority | ✅ **`OSC-010`** — *Trioloo Orders Screens*, two artboards |
| Repo-local rendered pack | ⚠ **Partially tracked** — the Order Card carries a written specification (`OSC-055`); the two `OSC-010` artboards remain URL-only (`OSC-011`) |
| Order card visual authority | ✅ **`OSC-055`** — *Order Card DS*, specified at `design-reference/Order Card DS.md`, implemented in `OrderCard.tsx` |
| `Order Dashboard.dc.html` · `Order Details.dc.html` | 🔴 **Unreachable** — precedence 2–3, project `e56dcf10…` returns 404 (`OSC-012`) |
| `order.*` permission codes | ✅ **Ratified** — `order.channel-order.view`, `order.channel-order.sync` (`PRM-091`, `OSC-052.c`) |
| Managed ingestion | ✅ **LIVE IN PRODUCTION 2026-08-23** — `OM §29` (`BR-178`–`BR-183`); 109 orders across three shops, 0 failed runs (`DEP-126`) |
| Ingestion cadence | ⚠ **`PT5M` deployed as CONFIGURATION**; the ratified default remains `PT15M` (`BR-179.a`, `BR-179.e`) |
| Orders migration number | ✅ **Assignable** — the read was done and `DEP-125` took the position; still only after the `DEP-031` pre-flight (`OSC-060.d`–`.f`) |
| Capture / create / amend form | ⬜ **Not designed, deliberately unnumbered** (`OSC-020.b`) |

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.9.0** | **2026-08-24** | ⚠ **THE PAGE-HEADER ACTIONS — `OSC-058`. THE OWNER ASKED FOR THREE; ONE IS BUILT AND TWO ARE BLOCKED.** 🔴 **`Create Order` — BLOCKED: `PRM-091` ratifies exactly two Order capability codes and states that NEITHER grants Order mutation, and `PRM-089.b` is a spelling rule and not a generator, so no create permission may be minted to make a button work. `GAP-035`, `GAP-023` and `GAP-003` leave the modal's invoice content, abandonment and tax model unspecified.** 🔴 **`Print` — BLOCKED: `PRN-023` sources the Sales Invoice printable from an `E-039` record with content snapshotted per `INV-39.2`, and no such record exists — `OSC-057` issued the NUMBER, not the DOCUMENT. `DOCUMENT_ARCHITECTURE.md` decides no layout at all.** ✅ **Both render DISABLED with the reason in VISIBLE text bound by `aria-describedby`, never a tooltip — a `title` is unreachable by keyboard and invisible on touch.** ✅ **`Export` IS BUILT IN FULL: scope is the SELECTION, or the ACTIVE RESULT SET when nothing is ticked — never the visible page, which `UX-044.b` names a silent truncation and which at five rows a page would be near-total. The label states the scope before the click; a partial read is REPORTED, never written (`RPT-047`, `SYS-073`); the two statuses stay two columns; unknown is the WORD because an empty cell sums as zero; money is the exact string.** 🔴 **Buyer-supplied text is neutralised against spreadsheet formula injection — a marketplace buyer's delivery note beginning `=` is code that runs on an operator's machine.** ✅ **Page size is FIVE, a constant and not a viewport response (`RULE 7.3.a`, `UX-266`).** ✅ **`Select all` takes the CURRENT PAGE and a selection SURVIVES paging — amending `OSC-057.c.i`, because turning the page is navigation within one result set while a filter REPLACES it. The selection holds whole ROWS, so a cross-page export cannot silently shrink to what the browser still holds.** 🔴 **Still no bulk bar (`GAP-034`).** ⚠ **Defect fixed in passing: the pager buttons had no accessible name.** |
| **1.8.0** | **2026-08-24** | ✅ **THE TRIOLOO-ISSUED INVOICE NUMBER — `OSC-057`.** ⚠ **The product owner SUPPLIED a business rule `GAP-035` recorded as missing**: ONE sequence, `TR0001` upward, oldest to newest, every existing and future order, none skipped, none ever regenerated. ✅ **`V19` backfills all 158 rows in a total, reproducible order and enforces immutability with a TABLE TRIGGER** — 🔴 **not an application guard, because the owner's *never regenerated* must also survive a repair script, a console session and a future `ON CONFLICT` clause.** ✅ **`BD-443`/`INV-39.1` permit exactly ONE Sales Invoice sequence and prohibit a second; this is that one.** ⚠ **The number is issued by a GUARDED UPDATE, not a column `DEFAULT`: PostgreSQL evaluates a DEFAULT for the proposed row of an `INSERT … ON CONFLICT` before finding the conflict, so at the deployed `PT2M` cadence a DEFAULT would burn roughly 113,000 values a day and run the numbering away from `TR0001` within hours.** 🔴 **REPORTED, NOT RESOLVED — THE NUMBER IS ISSUED AHEAD OF THE DOCUMENT: `E-039`'s snapshotted, reproducible content (`INV-39.2`) does not exist, and 117 of the 158 numbered orders are `CANCELLED` and were never delivered. `GAP-035` stays open on what an invoice CONTAINS and WHEN it is properly issued.** ✅ **Placement: top right, after the payment-method divider, bold and upper-cased by `textTransform` — never by upper-casing the stored value.** 🔴 **The `order_number` column is NOT rendered: a production read proved `order_number = external_order_id` on all 158 rows, so it holds a COPY of Daraz's id and showing it would dress the marketplace's number as Trioloo's (`PRN-014`).** ✅ **Order cards gain a SELECTION CHECKBOX leading the row, cleared whenever the result set changes** — 🔴 **with NO bulk bar, because `PRM-025` requires per-record authorisation and `GAP-034` still records no permitted-bulk-transition inventory.** 🔴 **No print action built; `DOCUMENT_ARCHITECTURE.md` owns the printable.** |
| **1.7.0** | **2026-08-24** | ✅ **THE ORDER CARD, AMENDED BY THE PRODUCT OWNER — `OSC-056`.** 🔴 **THE `SM-5` PAYMENT POSITION IS NOW A CHIP, AND ONLY THREE OF ELEVEN STATES MAY EVER BE RENDERED**: `Payment not due` before delivery (`OM §11.3`, `BR-033`, and `SM-5.4` prohibits `NOT_DUE → RECEIVED` before delivery), `Payment due` on `DELIVERED` (`SM-5`'s automatic `EVT-013`), `Payment unknown` for `RETURNED`, `CLOSED` or an untranslated state. ⚠ **Everything past `DUE` needs an `E-040` Receivable that has been collected, matched or settled, and no such record exists — the same absence `OSC-053` recorded when `Total collectable` subtracts nothing.** ⚠ **`Payment due` does not assert the buyer has not paid (`BR-035`), and is INFO not SUCCESS because `OM §11.1` calls paid-at-delivery a false statement on every channel Trioloo operates.** ✅ **The marketplace's own word loses its `Marketplace · ` prefix and stays VISIBLY EXTERNAL by GROUPING** — it sits between the shop that reported it and the id that shop gave it; `UX-182` forbids MERGING the two chips, not placing them apart, and the external one is outlined and lower-case against the ERP's filled semantic chip. 🔴 **The authority chip leaves the card, admissible only because `FRAME 02` already carries it twice** — ⚠ **and `OSC-056.d.i` REPORTS that `FRAME 02` states it as `API-managed`, the internal terminology `UX-183` explicitly forbids; the fix is owed to a `FRAME 02` task and is not made here.** ⚠ **`More Actions` is rendered with the owner's ratification but NO action behind it, so `OSC-051.b` is only half satisfied: it is `aria-disabled`, opens no menu onto nothing, and its title says the actions are not built.** ✅ **The invoice element sheds its number and becomes the printable-invoice action slot; the number lives on `FRAME 02`, where an identifier belongs.** ✅ **`Margin` no longer sits against the action controls. All four economic figures still render UNKNOWN.** 🔴 **No lifecycle, permission, endpoint, event or migration created.** |
| **1.6.0** | **2026-08-24** | ✅ **THE ORDER CARD IS REGISTERED AND BUILT FROM ITS APPROVED DESIGN.** **`OSC-055`** registers *Order Card DS* as the visual authority for the Orders card and records [`design-reference/Order Card DS.md`](design-reference/Order%20Card%20DS.md) as its written specification, implemented in `OrderCard.tsx`. 🔴 **THE PROJECT WAS NOT READABLE — `DesignSync` returned `HTTP 404` for `get_project` and `list_files`, the same condition `OSC-012` recorded** — so the product owner supplied the rendered bundle and the specification is TRANSCRIBED FROM ITS OWN MARKUP, never imagined from a screenshot. ✅ **Every `oklch(…)` in the design resolved to an existing token**; ⚠ **the one value with no token (`oklch(0.55 0.015 290)`) is RECORDED and the nearest token used, because `RULE 15.1` forbids the literal.** 🔴 **THE DESIGN'S SAMPLE DATA IS REFUSED WHILE ITS COMPOSITION IS KEPT**: `Cost`, `Charges`, `Received` and `Margin` render UNKNOWN (`INV-32.4`, `BR-033`, `BR-007`, `SYS-034`), the `Not Released` chip is not drawn because `BR-080` WITHDREW the state, `More Actions` is not drawn (`OSC-051.b`), and the marketplace's own word is labelled `Marketplace · {reported}` (`BR-171`). ✅ **`design-reference/README.md` now REGISTERS its packs**, discharging the `OSC-011.c` observation; ⚠ **`OSC-011` stays open for the two URL-only `OSC-010` artboards.** 🔴 **No lifecycle, permission, endpoint or event created.** |
| **1.5.0** | **2026-08-23** | ✅ **THE KPI ROW AND THE STATUS TABS ARE RATIFIED AND BUILT.** **`OSC-053`** names the four summary figures the product owner chose — **Total orders · Today's orders · Today's dispatched · Total collectable** — closing `GAP-004` for this workspace. 🔴 **The shipped KPIs were not defined, they were WITHDRAWN: `Total Revenue` and `Total Margin` are gone, which is the substance of the resolution, because `BR-007` uncosted lines and `SYS-034` unknown-is-not-zero make a pre-settlement margin confidently wrong and undetectable from the screen.** **`OSC-054`** records that the tabs are `SM-1` state names filled by the §4.3 ADAPTER translation (`BR-005`, `DZC-045.c.ii`), so the surface never touches a channel's own vocabulary — ⚠ **`GAP-017` stays blocked and becomes irrelevant to the tab set rather than being closed.** ✅ **`OSC-030.a` gains `Returned`**, an `SM-1` state `OM §6.2`, `SMA §5.2` and `§6.3`'s own diagram all carry and the v1.0.0 list omitted by oversight. ✅ **`OSC-051.b.i`** amends the withhold rule by its own test: both regions now show real data. 🔴 **TWO LIMITATIONS RECORDED RATHER THAN DESIGNED AROUND** — `Total collectable` subtracts nothing because no receipt or settlement record exists, and `Today's dispatched` counts an ERP OBSERVATION because `DZC-045.e`/`DZC-047.c` prove the provider publishes no dispatch timestamp, so the first backfill's count is the backlog. 🔴 **No lifecycle, permission, endpoint or event created; `FRAME 09` still not built; every other entry in `OSC-050` stands.** |
| **1.4.0** | **2026-08-23** | ✅ **LIVE READ-ONLY UI CLEANUP.** Unresolved blocker placeholders, legacy status tabs, disabled future buttons and KPI shells are removed from the operator-facing Orders list/detail pages. `OSC-050` remains the canonical blocked register, but `OSC-051` now requires the MVP UI to withhold unresolved controls rather than render documentation as product chrome. Frontend only: no backend, no migration, no Daraz call. |
| **1.3.0** | **2026-08-23** | ✅ **FIRST READ-ONLY ORDERS UI SLICE.** `OrdersPage.tsx` implements `FRAME 01` as the card-list workspace; `OrderDetailPage.tsx` implements `FRAME 02` plus the read-only `FRAME 03`–`FRAME 08` panels. `FRAME 09` renders blocked markers only. 🔴 **No write path, no scheduler, no import trigger, no shipment/payment/inventory action, no marketplace write and no manual order capture.** Focused Orders test 2/2, full frontend 876/876 and build passed. |
| **1.2.0** | **2026-08-23** | ✅ **`OSC-060` RESOLVED — THE MIGRATION BAR IS LIFTED.** **The production read was performed: `flyway_schema_history` is at `V14`, `V15` unapplied and `channel_listing_review` absent, BECAUSE the deployed jar carries `V1`–`V14` and no `V15`.** 🔴 **There was never a contradiction — `DEP-071` cannot apply a migration the deployed artifact does not contain.** ✅ **`DEP-125` then TOOK the position: `V15` is applied deliberately on the next deployment behind the backup gate, and V15-free release branches are discontinued.** 🔴 **A number is still assigned only AFTER the `DEP-031` pre-flight confirms the applied ceiling — `DEP-070.b` is unchanged and a ceiling is never assumed.** ⚠ **The superseded wording is retained (`DOC-009`) because it was correct while the question was open.** ⚠ **THIS CHANGES NO FRAME: `FRAME 01`–`FRAME 09` remain ⬜ NOT BUILT and `OSC-050`'s blocked register is untouched.** |
| **1.1.0** | **2026-08-23** | ✅ **`OSC-052` DISCHARGED BY `PRM-091`.** **The owning module named `order.channel-order.view` and `order.channel-order.sync`; the superseded wording is retained (`DOC-009`) because it records WHY the codes could not be invented here.** 🔴 **Neither grants Order mutation, inventory movement, payment or settlement action, shipment action, or any marketplace write** (`PRM-091.b`). ✅ **`PRM-091.c` keeps probe, incremental poll and backfill on the one `sync` code rather than inventing a third.** ⚠ **THIS UNBLOCKS GATING, NOT THE FRAMES: `FRAME 01`–`FRAME 09` remain ⬜ NOT BUILT, every entry in `OSC-050`'s blocked register stands, and `OSC-060`'s migration bar is untouched.** ✅ **Documentation only in this contract — the first Orders code is a read-only diagnostic that creates no schema.** |
| **1.0.0** | **2026-08-23** | **Initial ratification** (`DOC-094`). ✅ **Registers the *Trioloo Orders Screens* artifact and its two artboards as the approved Orders visual authority (`OSC-010`), and records the `FRAME 01`–`FRAME 09` register with NONE built.** ✅ **Fixes per frame what must be visible, what may be done, what must be refused, which rules govern and what coverage is owed.** 🔴 **Records ten blocked elements in one register (`OSC-050`) and decides none of them** — KPIs, the legacy label mapping, `B2C`, the `DRAFT` lifecycle, ageing, line-level cancel, cancel consequences, notes, reconcile, bulk transitions. 🔴 **Records that NO `order.*` permission code is ratified and that implementation may never coin one (`OSC-052`).** 🔴 **Records that the collection is a CARD LIST and never a table (`OSC-030`, `RULE 3.15`), and that a BLOCKED marker is NEUTRAL because canonical red is reserved for destructive action (`OSC-042.b`).** ⚠ **Records honestly that the pack is not yet tracked repo-locally (`OSC-011`) and that two higher-precedence Order design files were unreachable and did not inform it (`OSC-012`).** 🔴 **Preserves the `V15` production contradiction and forbids proposing any migration number until `flyway_schema_history` is read (`OSC-060`).** ✅ **Recommends a read-only `FRAME 01`/`02`/`08` first slice, shipping without status tabs until `GAP-017` is answered (`OSC-061`).** 🔴 **No business rule, entity, permission, endpoint, migration or visual decision created.** |
