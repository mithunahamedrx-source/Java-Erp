# Order Module — page contract and design brief

**Owner:** Trioloo Engineering · **Status:** 📌 **WORKING RECORD — NOT CANONICAL ARCHITECTURE**
**Version:** 1.0.0 · **Established:** 2026-08-24 · **Rule prefix:** none, by design

> ⚠ **THIS DOCUMENT LEGISLATES NOTHING.** It consolidates what
> [`ORDERS_SCREEN_CONTRACT.md`](ORDERS_SCREEN_CONTRACT.md) already fixes across nine frame
> sections, a blocked register and eleven amendments, into a form a designer can build against.
>
> 🔴 **IT ISSUES NO RULE AND CLAIMS NO PREFIX.** **Every line below traces to an `OSC-`, `BR-`,
> `UX-`, `RULE` or `GAP-` that already exists.** 🔴 **If this file and `ORDERS_SCREEN_CONTRACT.md`
> ever appear to conflict, the CONTRACT WINS and this file is the defect.**

---

## 1. 🔴 The Order module is FOUR pages, not nine

**`OSC-020.a` — `FRAME 03` through `FRAME 09` are PANELS OF THE `FRAME 02` SURFACE, NOT SEPARATE
ROUTES.** ⚠ **Designing nine pages would build a structure the contract forbids.**

| # | Route | Frames | Built |
|---|---|---|---|
| **P1** | `/sales/orders` | `FRAME 01` | ✅ live |
| **P2** | `/sales/orders/:id` | `FRAME 02` + panels `03`–`09` | ⚠ live, panels thin |
| **P3** | `/sales/orders/new` | ⚠ **no frame exists** | ✅ live |
| **P4** | `/sales/orders/:id/invoice` | ⚠ **no frame** — `OSC-059` is its visual authority | ✅ live |

⚠ **P3 AND P4 HAVE NO `OSC-` FRAME NUMBER.** **They were built on ratified rules — `PRM-093` and
`UX-151` for capture, `PRN-023` and `OSC-059` for the printable — but the contract never numbered
them.** 🔴 **Recorded as owed. No frame number is invented here.**

---

## 2. The law that applies to EVERY page

**Break any of these and the page is wrong regardless of how it looks.**

### 2.1 Layout

| Rule | What it means |
|---|---|
| `RULE 7.4` · `UX-266` | **A structured operational row NEVER wraps.** Not the status tabs, not a card band, not a filter row. |
| `UX-265` | 🔴 **`overflow-x: auto` IS NOT THE ESCAPE.** A row that will not fit is redesigned, never given a scrollbar. |
| `RULE 7.3.a` | **Zoom changes scale and viewport visibility — NEVER information existence.** No control appears or disappears with width. |
| — | **Page size and record count never change because of zoom or viewport.** Five per page is five at every zoom. |
| `RULE 7.10` | 🔴 **No breakpoint is invented** until `UI_UX_ARCHITECTURE.md` ratifies one. |
| — | **Browser zoom is never disabled.** Stable at 80 / 90 / 100 / 110. |

### 2.2 Money, absence and unknown

| Rule | What it means |
|---|---|
| `TEC-015` · `DB-079` | 🔴 **Money crosses as a STRING and never touches `Number`.** No `parseFloat`, no arithmetic in the browser on an authoritative amount. |
| `INV-32.4` · `SYS-034` | 🔴 **UNKNOWN renders as the WORD, never as `0`.** A blank cell sums as zero; the word cannot. |
| `BR-134` | **Absent is not empty.** *"Contact not recorded"*, not a gap. |
| `RULE 3.3.c` | 🔴 **Red is reserved for DESTRUCTIVE ACTION**, never for a state. `CANCELLED` is neutral. |
| `RULE 3.14.a.a` | **A value takes the role its meaning deserves, never the one it resembles.** |

### 2.3 The two-owner rule, everywhere

🔴 **`BR-171` · `UX-182` — the MARKETPLACE's status and TRIOLOO's operational status are two facts
with two owners and are NEVER merged into one chip.** ✅ *Marketplace: Cancelled* beside
*ERP: Confirmed* is legitimate. ⚠ **`DB-013` — every external identifier shows its ISSUING PARTY,
because two parties may issue the same string.**

---

## 3. P1 — `/sales/orders` · Orders workspace · `FRAME 01`

**`OSC-030` — the collection is a CARD LIST and never a table.** 🔴 **`RULE 3.15` records the
traditional data table as `NOT USED`.** ⚠ **Date, time and lifecycle live INSIDE the card anatomy,
never as table columns.**

### MUST SHOW
- **Four summary figures** (`OSC-053`): Total orders · Today's orders · Today's dispatched ·
  Total collectable
- **Status tabs named for ratified `SM-1` states** (`OSC-054`, `OSC-030.a`), each with its count
- Per card: **Trioloo invoice number** (`OSC-057`, top right, bold, after the payment divider) ·
  customer name from the ORDER'S OWN SNAPSHOT (`INV-31.7`) · **channel type AND instance**
  (`BR-002`) · external references **with their issuing party** (`DB-013`) · line count ·
  demoted `Sale · Cost · Charges` divided from primary `Received · Margin` (`§3.15`) ·
  **one chip per lifecycle, never merged** (`BR-065`, `BR-066`) · a captured timestamp
- **`SM-5` payment position chip** (`OSC-056.b`) — only `Payment not due`, `Payment due`,
  `Payment unknown`
- **Courier booking id with its issuer**, or *Courier not booked* (`OSC-057`, `FRAME 06`)

### MAY DO
`View` · `More Actions` (row action, `UX-045` level 3) · `Export` · `Create Order` · `Print` ·
status-tab filtering · channel, shop, search and period filters · **select** (per card and per page)

### MUST NOT
| Refused | Why |
|---|---|
| **Bulk action bar** | `PRM-025` per-record authorisation · `GAP-034` no permitted-action inventory |
| **Ageing / SLA badges** | `GAP-024` — no residency threshold exists |
| **A `DRAFT` tab** | `GAP-023` — the lifecycle is blocked |
| **Legacy labels** — `RTS`, `Shipped`, `B2C Pending` | `GAP-017` · `BR-079` (`RTS` is ambiguous) |
| **`B2C` as a classification** | `GAP-022` — defined nowhere |
| **A `Not Released` chip** | `BR-080` WITHDREW the state |
| **Cost / Charges / Received / Margin as figures** | Unknown for an imported order (`BR-007`, `INV-32.4`) |
| **Margin painted green** | `RULE 3.14.a.a` — an unknown margin is not a gain |

### TODAY
✅ Cards, tabs with counts, four KPIs, filters, five per page, selection, Export.
⚠ **Thin:** `More Actions` has no actions behind it (`OSC-056.f`).

---

## 4. P2 — `/sales/orders/:id` · Order detail · `FRAME 02` + panels `03`–`09`

**`OSC-031` — 🔴 ONE ROW PER LIFECYCLE, NEVER MERGED.** ⚠ **A single merged status field is the
failure `OM §18.1` exists to prevent.**

**Tabs are the white-raised segmented control** (`RULE 3.13`) — ✅ **REUSED, never re-cut**
(`RULE 5.2`).

### 4.1 Overview — `FRAME 02`

**MUST SHOW** — breadcrumb · order number · inline status badge · **authority chip with the causing
action, actor and time where a takeover occurred** (`BR-174`) · capture channel and time ·
`Confirmed By` / `Confirmed At` (`BR-163`) · **the per-lifecycle rows — Order, Verification,
Fulfilment, Shipment, Payment, Inventory, Return, Exchange** · order summary.

**MAY DO** — tab switching · `Amend` where `OM §7.9` permits · `Release to warehouse` (`BR-081`,
manual, permissioned) · `Place hold` / `Release hold` · `Cancel order` **pre-dispatch only**.

**MUST NOT** — 🔴 `Cancel` is **ABSENT, not disabled**, after dispatch (`BR-011`) · no amendment
after dispatch · order notes (`GAP-066`) · **realised margin shown as settled before closure**
(`BR-067`).

🔴 **`Confirmed By` IS NEVER DERIVED** (`BR-164`) — not from `Assigned Agent`, not from the current
owner, not from audit history. **Its ABSENCE is the fact.** ⚠ An `AUTO_CONFIRMED` order shows **no
human confirmer** (`BR-166`, `UX-181`).

### 4.2 Items — `FRAME 03`

**MUST SHOW** — per line: catalogued flag · **Sellable Product reference, never a Product Variant
directly** (`INV-32.1`) or the free-text name · quantity · **unit price snapshot captured at line
creation** (`BR-145`, `INV-32.6`) · cost snapshot · line value · serials **where one exists**
(`BR-086`) · goods total and margin strip.

**MUST NOT** — line-level cancel (`GAP-025`) · 🔴 **an unknown cost as `0`** (`INV-32.4`) · a serial
affordance where none exists. ⚠ **An order with any non-catalogued line renders ECONOMICALLY
INCOMPLETE** (`INV-31.5`, `BR-007`).

🔴 **A later price change NEVER rewrites a rendered line** (`BR-146`) — the surface shows the
SNAPSHOT.

### 4.3 Buyer — `FRAME 04`

**MUST SHOW** — name, contact, delivery address **from the order's snapshot, never a live customer
lookup** (`INV-31.7`) · customer type · credit terms where approved · **the moment the snapshot was
taken**.

**MAY DO** — open the Customer record · change address or contact **pre-dispatch** — ⚠ **and doing
so transitions an `API_MANAGED` order to `ERP_MANAGED`** (`BR-169`).

🔴 **THE AUTHORITY CONSEQUENCE IS STATED BEFORE THE ACT, NOT AFTER** (`UX-184`). **The transition is
ONE-WAY in V1** (`BR-175`). ⚠ **No control at all after `COURIER_BOOKED`** (`BR-082`).

### 4.4 Payment — `FRAME 05`

**MUST SHOW** — collection mode · **`SM-5` state** · received to date · outstanding · **realised
margin only once closure settles it** (`BR-067`) · settlement period where the channel settles.

**MUST NOT** — 🔴 **`Mark reconciled`** (`GAP-019` residual — the transition mode is `UNDECIDED`) ·
per-portion receivable or refund (`BR-160`) · **a due receivable on an undelivered order**
(`BR-033`).

⚠ **An order may sit `DELIVERED` for weeks awaiting settlement and that is CORRECT** (`OM §18.4`).
🔴 **Never presented as a backlog or an exception.**

### 4.5 Fulfilment / Shipment — `FRAME 06`

**MUST SHOW** — `SM-3` state · warehouse · picker · pick discrepancies · **`SM-4` shipment state OR
an explicit "not created"** · courier · **tracking / AWB with its issuing party** (`DB-013`) ·
handover acknowledgement on self-pickup.

**MAY DO** — open the pick task · open the shipment · view tracking events.

**MUST NOT** — 🔴 **any split or partial shipment affordance** (`BR-158`, `BR-159` — one order is
one parcel per attempt) · cancel consequences (`GAP-020`) · **courier selection** — Steadfast only,
auto-assigned (`BR-076`).

🔴 **`BR-155`'s distinction must survive:** a hold for a **pick discrepancy** is correct; a hold for
**known unavailability** is not. ⚠ **Shortage renders as VISIBILITY and never gates progression.**

### 4.6 Marketplace reference — `FRAME 07`

**MUST SHOW** — channel type **and instance** · authority state with its causing action, actor and
time · external order id, shop identifier and AWB **each with its issuing party** (`DB-013`) ·
🔴 **the marketplace's own status as an EXTERNAL FACT, visibly distinct from the ERP's**.

**MUST NOT** — 🔴 **any push, resend or re-sync control** — no outbound Orders behaviour is ratified
· 🔴 **anything that lets an external `Cancelled` re-cancel an `ERP_MANAGED` order** (`BR-172`).

✅ **ERP authority NEVER deletes external history** (`BR-173`).

### 4.7 Activity — `FRAME 08`

**MUST SHOW** — chronological entries with **from-state, to-state, actor, timestamp and reason**
(`BR-058`) · the act in operator language · the machine it belongs to.

**MUST NOT** — ageing / SLA markers (`GAP-024`) · 🔴 **a second store** — the timeline is a
PROJECTION of the Activity Log (`INV-34.1`) and is complete by construction (`INV-34.2`).

⚠ **A bulk act renders ONE ENTRY PER ORDER** (`AUD-028`). ✅ **The Activity Log is not the Audit
Log** (`OM §15.2`).

### 4.8 Exceptions — `FRAME 09`

**MUST SHOW** — open exceptions with cause, raiser and time · hold reason and the actor who placed
it · **the reservation consequence of the hold** (`BR-149`) · the authority required for each
offered action.

**MAY DO** — `Release hold` · `Release reserved quantity` — **a specified quantity only**
(`BR-152`) · `Cancel order` pre-dispatch · `Amend`.

**MUST NOT** — 🔴 **hold duration, ageing, SLA, auto-cancellation or auto-release** (`BR-151`) —
**each explicitly PROHIBITED, not merely omitted** · `ON_HOLD` rendered as releasing a reservation
· a backorder waiting state (`BR-153`).

🔴 **`OSC-038` — AN EXCEPTION IS SURFACED FOR VISIBILITY AND NEVER GATES PROGRESSION.** ⚠ **The
discovery record states this NINE times, and it is the rule an operations screen is most likely to
break by adding a well-meant block.**

### TODAY
⚠ **The detail page is the weakest surface.** The eight lifecycle rows, the panels and the
timeline are thin or absent. **This is the page most in need of a prototype.**

---

## 5. P3 — `/sales/orders/new` · Manual capture

⚠ **No `OSC-` frame. Built on `PRM-093`, `OM §22` and `UX-151`.**

🔴 **IT IS A PAGE AND NOT A MODAL.** **`UX-151` — *a workflow needing more than a bounded decision
gets a PAGE, not a modal*.** ⚠ **The legacy New Sale MODAL is what `GAP-035` and `GAP-023`
describe, and both are open because of what it compresses.**

**MUST SHOW** — customer name, phone, address · **shop** (`BR-002`) · lines with description, SKU
and **staff-entered unit price** (`PRD-139`, `BR-145`) · order total · **the state it will
create, stated BEFORE the act**.

**MUST NOT** — 🔴 **anything presenting a low manual price as a DISCOUNT** (`BR-148` — the Ideal /
Recommended Selling Price is ADVISORY, never a floor and never an approval trigger) · a negative
price · an inventory effect (`GAP-016` — shortage never blocks an order) · `Confirmed By` /
`Confirmed At` (`BR-176`).

✅ **Creation ends at `PENDING_VERIFICATION` and STOPS** — creation is not confirmation
(`PRM-093.b`).

---

## 6. P4 — `/sales/orders/:id/invoice` · Sales Invoice printable

⚠ **No `OSC-` frame. `OSC-059` registers `TrioLoo Invoice` as its visual authority; the written
specification is [`design-reference/TrioLoo Invoice.md`](design-reference/TrioLoo%20Invoice.md).**

🔴 **IT RENDERS THE `E-039` SNAPSHOT AND COMPUTES NOTHING** (`PRN-022` — the rendering never becomes
the source). ⚠ **A renderer that re-read the order would reprint last year's invoice with this
year's address and prices.**

**MUST SHOW** — Trioloo identity and bank details · **`No.` = the Trioloo invoice number as the
IDENTITY**, then the Steadfast booking and the Daraz order number as **REFERENCES after it, each
with its issuer** (`DB-013`) · Bill To from the snapshot · line table · Subtotal, Delivery,
**VAT / Tax**, Balance Due.

**MUST NOT** — 🔴 **the design's `vatRate = 7.5`** — sample data beside sample Lenovo line items;
the ratified rate is **`0%` for now** and `GAP-003` still supplies no tax MODEL · `Collected
Advance` (`GAP-035`) · a `Due` date (no payment term is ratified) · the design's status enums
(**not `SM-4`, not `SM-5`**).

⚠ **This is the ONE surface not in Manrope.** `DESIGN_CONSTITUTION.md` fixes Manrope for the
APPLICATION UI; `DOCUMENT_ARCHITECTURE.md` §15 decides **no typography for printables at all**.

---

## 7. The Claude Design prompt

### 7.1 Master prompt — paste this with EVERY page

```text
Design a page for the Trioloo ERP — a Bangladeshi electronics retailer's internal operations
system. Produce a full, functional prototype in a single self-contained HTML file.

TYPOGRAPHY
- Manrope for everything. Weights 500/600/700.
- Tabular numerals on every figure and identifier.

COLOUR — use these exact values, and no others. Do not introduce a colour by eye.
  ink / primary button   oklch(0.2 0 0)
  page background        oklch(0.968 0.003 290)
  surface                #ffffff
  card border            oklch(0.93 0.006 290)
  text primary           oklch(0.24 0.02 290)
  text secondary         oklch(0.543 0.015 290)
  text muted             oklch(0.5 0.015 290)
  text demoted           oklch(0.568 0.012 290)
  strip / footer         oklch(0.98 0.002 290)
  positive               oklch(0.38 0.1 155)
- Red is RESERVED for destructive actions only. Never for a status.

SPACING — 4, 6, 10, 12, 14, 16, 20, 24px only.
RADIUS  — controls 8px, cards/panels 12px, pills 999px.
SHADOW  — one soft card elevation. No heavy or coloured shadows.

CONTROLS
- Buttons come in three heights: 32px in-row, 36px canonical and page-header, and nothing else.
- EXACTLY ONE dark primary button per page header, and it is RIGHTMOST.
- A page-header action is 36px tall, 0 13px padding, 9px radius, 13px label.
- Tabs are ONE segmented control: a single container, hidden overflow, width fit-content, and a
  permanently present dark filled active segment. NOT a row of separate pills.
- Forms are a two-column 1fr 1fr grid with 18px row gap and 32px column gap.

LAYOUT LAW — these are hard constraints, not preferences.
- A structured operational row NEVER wraps. Not tabs, not filters, not a card band.
- NEVER use overflow-x: auto to make something fit. Redesign it instead.
- Nothing appears or disappears with viewport width. No media queries, no breakpoints.
- The page must be stable and readable at 80%, 90%, 100% and 110% browser zoom.

HOW TO TREAT SAMPLE DATA — read this twice.
- Any number you invent is a VISUAL PATTERN, not a business fact. I will keep your composition
  and discard your figures.
- Where a value is genuinely unknown to the business, print the word "Unknown". Never print 0,
  and never leave it blank — a blank cell sums to zero in a reader's head.
- Where a value is absent, say so in words: "Contact not recorded", not an empty space.
- Never colour a figure green to suggest profit unless the number is definitely a gain.
- Money is always a string like "৳ 15,890". Never a bare number.

TWO-OWNER RULE
- A marketplace's status and Trioloo's own status are DIFFERENT FACTS. Show both, never merge
  them into one chip, and make it visible which system said which.
- Every external identifier must name who issued it: "Daraz tracking", "Steadfast booking" —
  never a bare "Tracking", because two companies can issue the same string.

Now design: [PASTE THE PAGE BLOCK FROM §7.2]
```

### 7.2 Per-page blocks

**P1 — Orders workspace**
```text
An orders list. Four summary figures across the top: Total orders, Today's orders,
Today's dispatched, Total collectable. Below them a single-row segmented control of status tabs,
each with a small superscript count: All, Pending verification, Confirmed, Released, In fulfilment,
Ready to ship, Courier booked, Dispatched, Delivered, Failed delivery, Returned, On hold,
Cancelled, Closed. Then a filter row: a narrow search box first, then channel, shop and period
selects, then Reset. Page header carries Export, Print and Create Order (Create Order is the one
dark primary, rightmost). Then a list of order CARDS — not a table — five per page.

Each card has three bands:
1. Selection checkbox, customer avatar and name, phone, time, then the shop name, the marketplace
   order id and the marketplace's own status word as a small outlined chip. On the right: the ERP
   lifecycle chip, a payment position chip, the payment method, and the Trioloo invoice number in
   bold caps, e.g. "INV: TR0158".
2. Product thumbnail and name with quantity; beneath it two small reference lines naming their
   issuer, and a courier booking line. Then, CENTRED in the remaining space, five economic figures
   as one group: demoted Sale, Cost, Charges — then a divider — then larger Received and Margin.
   Then a divider, then View and More Actions buttons at the far right.
3. A quiet strip: an INVOICE action, the delivery address, and a note on the right.

Show Cost, Charges, Received and Margin as "Unknown" — the business genuinely does not know them
for a marketplace order.
```

**P2 — Order detail** *(the page most in need of work)*
```text
An order detail page. Breadcrumb, order number, an inline status badge, and the capture channel
and time. A white-raised segmented control of tabs: Overview, Items, Buyer, Payment, Fulfilment,
Marketplace, Activity, Exceptions.

The Overview tab must show EIGHT INDEPENDENT LIFECYCLE ROWS in one card — Order, Verification,
Fulfilment, Shipment, Payment, Inventory, Return, Exchange — each with its own state chip. These
are eight separate state machines and must never be collapsed into a single "status" field. Beside
them: an authority chip reading "The marketplace still updates this order", and Confirmed By /
Confirmed At which may legitimately be empty.

Design all eight tab panels. Items shows per-line price and cost snapshots. Buyer shows an address
snapshot with the moment it was taken. Payment shows collection mode and amounts. Fulfilment shows
the shipment state or an explicit "not created", the courier and the tracking code. Marketplace
shows the channel, the external ids and the marketplace's own status as clearly external. Activity
is a chronological timeline with from-state, to-state, actor, time and reason. Exceptions lists
open exceptions and holds.

Do NOT draw: any ageing or "N days old" badge, any bulk action, a Cancel button on a dispatched
order, or a Mark reconciled control.
```

**P3 — New order**
```text
A manual order capture PAGE (not a modal). Page header: Cancel, and one dark primary "Create
order" rightmost. A short line under the header stating the order will be created in "Pending
verification" and that creating it does not confirm it.

Three panels: Customer (first name, last name, phone, shop select, delivery address, city) in a
two-column grid; Lines (repeating rows of description, SKU, unit price, with Add line and Remove);
and Payment and note, with the order total shown at the bottom right of the last panel.
```

**P4 — Sales invoice** *(the one page NOT in Manrope)*
```text
A printable A4 sales invoice, 794x1123px on a grey page background. This is a DOCUMENT, not an
application screen — use Hanken Grotesk for body and Space Grotesk for the word INVOICE, the
Balance Due block and the footer line.

Header: logo slot and Trioloo's address block on the left; on the right the word INVOICE and a
right-aligned reference list — "No." with the Trioloo invoice number in bold FIRST, then
"Steadfast booking" and "Daraz order" beneath it, then the date. Then Bill To beside Bank Details.
A line table with a black header row: Item Description, Qty, Unit Price, Total. Then a note block
on the left and, on the right, Subtotal, Delivery & Handling, VAT / Tax, and a dark filled
Balance Due block with the figure at 22px. A quiet footer.

Show VAT / Tax at 0%. Do not invent a tax rate.
```

---

## 8. Version history

| Version | Date | Change |
|---|---|---|
| **1.0.0** | **2026-08-24** | **Initial record.** Consolidates `ORDERS_SCREEN_CONTRACT.md` into a per-PAGE build sheet and supplies the Claude Design brief. 🔴 **The finding that changes what gets designed: `OSC-020.a` makes `FRAME 03`–`FRAME 09` PANELS of the `FRAME 02` surface, so the module is FOUR pages and not nine.** ⚠ **Two live surfaces have no frame number — manual capture and the invoice printable — recorded as owed rather than numbered here.** 🔴 **Issues no rule, claims no prefix, and yields to the contract on any conflict.** |
