# Trioloo ERP Final Design Reference — reading notes

**Status:** 📌 **WORKING RECORD — NOT CANONICAL ARCHITECTURE** · **Rule prefix:** none, by design
**Written:** 2026-10-03 · **Describes:** `Trioloo ERP Final Design Reference.dc.html` (794 KB, 8,416 lines, last modified 2026-09-06)

> ⚠ **THIS FILE LEGISLATES NOTHING.** It is a map of what the design file contains so a fresh session does
> not have to re-read 8,000 lines. It issues no rule and claims no `DOC-` number; registering it in
> `MASTER_DOCUMENTATION_INDEX.md` is a governance act for the owner.
>
> 🔴 **The design file is COMPOSITION AND VISUAL AUTHORITY ONLY.** The product owner has stated it is the
> **final design reference**. Per `ORDERS_SCREEN_CONTRACT.md` `OSC-010.b` and `CLAUDE.md` §9, *drawing a
> control neither ratifies the action nor authorises the field behind it*, and **its sample data is a visual
> pattern, never a business fact.** If it conflicts with business architecture, **business architecture wins**.

---

## 1. How to open and read it

| | |
|---|---|
| File | `docs/design-reference/Trioloo ERP Final Design Reference.dc.html` |
| Runtime | `support.js` beside it (generated `dc-runtime`; carries no design authority) |
| Open | in a browser — it is a self-contained interactive prototype with fake data |
| Format | `<x-dc>` markup (lines 1–2952, `sc-if` / `sc-for` templates) + one `<script type="text/x-dc">` class `Component extends DCLogic` (lines 2953–8414) |
| Navigation | `this.go("module:tab")` sets `state.view`; `renderVals()` (line 8180) dispatches on the prefix |
| README | `design-reference/README.md` names this the single approved design source; older screenshots, invoice mockups, feature packs and order prototypes were **removed** |

⚠ **Not in this file:** the printable invoice. The invoice mockups (`TrioLoo Invoice.html`, `unpacked_invoice.html`)
sit beside it untracked-or-stale; `OSC-059` is still the invoice's visual authority.

---

## 2. Global shell (every page)

| Element | Value |
|---|---|
| Font | **Manrope** 400–800 (Google Fonts), `font-variant-numeric: tabular-nums` |
| Page background | `oklch(0.968 0.003 290)` |
| Surface / card | `#FFFFFF`, border `oklch(0.93 0.006 290)`, shadow `0 1px 2px oklch(0 0 0 / 0.03)` |
| Ink / primary button | `oklch(0.2 0 0)` |
| Text | primary `oklch(0.18–0.24 0.02 290)` · secondary `0.45–0.55 0.015` · muted `0.568 0.012` |
| Sidebar | **216px** white, 64px logo row ("TrioLoo", 26px rounded mark), 34px group rows, 28px child rows (indent 32px) |
| Radius | controls 8–9px · cards 12–14px · pills 999px (or 7px for order chips) |
| Buttons | 32px in-row · 36px header/filter controls · dark-filled = primary/active |
| Tabs | one segmented container, dark-filled active segment (`tabStyle`: 32px, 8px radius, 12.5px) |
| Semantic pill pairs (bg / fg) | green `0.94 0.05 155 / 0.4 0.12 155` · amber `0.95 0.05 85 / 0.45 0.13 70` · blue `0.94 0.04 250 / 0.42 0.14 250` · red `0.95 0.05 25 / 0.47 0.17 25` · grey `0.95 0.01 290 / 0.45 0.015 290` |
| Motion | page change `pageInA/B` 260ms slide-in; menus `panelIn`; cards `cardIn` |
| Header chrome | breadcrumb trail · page title · optional sub-line · secondary actions (Export / Print…) · **one dark primary action, rightmost** · chat and notification icon buttons (34px) opening side panels |
| List archetype | **card list, never a table**; checkbox per card; "Select all on this page"; bulk-action bar when anything selected; pager "Showing a–b of N" with numbered buttons |
| Per-row menu | "More Actions" dropdown (`data-rowmenu`), closes on outside mousedown |

Tokens agree with `DESIGN_CONSTITUTION.md` / `frontend/src/design/tokens.css` (the Orders contract already records
that the earlier artboards used the same matrix).

---

## 3. Module map (sidebar → views)

`navModel()` at line 7719. **Two sections.**

**Main**
| Group | Children → view keys |
|---|---|
| Dashboard | `dashboard` |
| Inventory | Products `products:{stock,sellable,listings}` · Stock Control `positions/movements/reservations/adjustments/transfers/detail/form` · Purchasing `purchasing:{orders,receipts}` · Suppliers `suppliers:{directory,ledger}` · Warehouses `warehouses:{warehouses,locations}` |
| Sales & Orders | Orders `orders:<status>` · Returns & Exchange `returns:{cases,returns,exchanges,refunds}` · Warranty & Repair `warranty:{requests,repairs,cost}` · Trade-In `tradein:{cases,components,allocation}` |
| Finance & Accounting | Payments `payments:{receivables,remittances,settlements,variances}` · Journal `journal:{entries,accounts,expenses,categories}` · Advance Requisitions `advances:*` · Employee Loans `loans:{loans,settlements,recovery,writeoffs}` · Salary Payable `salary:{positions,payments,recoveries}` · Fund Transfers `transfers:{transfers,transit,reversals,fees}` |
| HR & Payroll | Employees `employees:{directory,employment,compensation,settlement}` · Attendance `attendance:{daily,sessions,overtime,deductions}` · Leave `leave:{requests,decisions,expectation}` · Payroll `payroll:{runs,payslips,earnings,recoveries}` |
| CRM | Customers `customers:{directory,addresses,standing,identities}` |
| Reports | `reports:<id>` |

**Admin:** Administration → Users · Roles & Permissions · Shops & Channels · Integrations · Settings (`admin:*`, each with a list and a detail view).

**Outside the sidebar:** Notifications (`notifications:*`, header bell + full page), Chat inbox and Shortcuts (`chat:*`, header icon).
**Not built in the prototype:** any group item with no function renders `stub:<label>` — *"<label> is not built yet"*.

Advance Requisitions tabs (`ADVANCE_TABS`): Requisitions · Approval Center · Money Release · Settlement · Employee Ledger · Outstanding · Claims · Write-Offs.

Reports registered (22): Sales · Profit · Collection · Supplier Ledger · Customer Due · Supplier Due · Cash & Bank Balance · Expense · Purchase · Inventory Value · Stock Movement · Employee Advance Ledger/Statement · Attendance · Salary Sheet · Payslip · Payroll Run · Overtime Statement · Deduction Statement · Salary History (+ others). Each shows *reads*, *owner*, *basis*, and unknown values as the word "Unknown".

Dashboard: Day/Month/Year period tabs; shortcuts (New order, Approve advances, Sync channels, Stock alerts); four KPIs (Sales, Collection, Orders, Attention); a five-bar flow chart (Sales, Collection, Purchase, Expense, Advance).

---

## 4. The Orders workspace (the part most relevant to current work)

Source: template lines 2339–~2500, data `ordersVals` lines 5659–5757.

**Header:** breadcrumb *Sales & Orders › Orders › All orders*; title **Orders**; sub-line *"All channels · operational workspace"*; secondary actions **Export**, **Print**; dark primary **Create Order**.

**Four KPI cards** (30px icon tile, 10.5px caps label, 22px/800 value, 11px note): **Total orders** · **Today's orders** (`Asia/Dhaka`) · **Today's dispatched** · **Total collectable**. Matches `OSC-053`.

**Status tabs** (one white container, dark active chip, superscript count):
`All · Pending verification · Confirmed · Released · In fulfilment · Ready to ship · Courier booked · Dispatched · …` (as DRAWN — the live strip is `All · Confirmed · Ready to ship · Dispatched · Delivered · Failed delivery · Returned · On hold · Cancelled · Closed`, `OSC-062`)

**Filter row:** search "Order no., ref, customer" (280px) · CHANNEL segment (All channels / Daraz) · SHOP select · PERIOD segment (All time / Day / Month / Year) · **More** · **Reset**.

**Order card — three bands**
1. *Header band:* checkbox · customer avatar+name · contact · placed time · shop · marketplace order id · payment chip (`unpaid/pending/paid/cod`) — **right side:** ERP state chip · payment-position chip (`Payment not due`, `Collectable`, `Payment received`, `Not collectable`) · payment method · divider · **`INV: TRxxxx`**.
2. *Item band (one per line):* 34px thumbnail · name (nowrap ellipsis) + two quiet lines (Daraz PO/tracking refs with issuer; courier line) · **Sale · Cost · Charges · Received · Margin** (Cost/Charges/Received/Margin print **"Unknown"** for imported orders) · **View** · **More Actions ▾**.
3. *Strip:* address and note (data fields `address`, `note`).

**More Actions menu in the design:** Open order · Verify order · Place hold · Send to Steadfast · Print invoice · Cancel order.
**Bulk bar in the design:** Export selected · Print invoices · Send to Steadfast · Place hold · Cancel orders, plus "Clear selection", with the note that each order is authorised individually and logged one entry per order.

Sample ids seen: `TR0173`…`TR0168`, shops *Zeon Tech*, *Trioloo Store*, *Ryzen Builder*, courier *Steadfast* (`SF-…` tracking).

### 4.1 Where the design and the canon DIFFER (do not copy blindly)

| Design shows | Canon says | Action |
|---|---|---|
| **`Courier booked` status tab** (and `Pending verification`, `Released`, `In fulfilment` — the design has no tab for those, but its tab list still carries `Courier booked`) | Owner decision 2026-10-03 (`OSC-062`): none of the four is a tab; stages are grouped and shown on the card | Do **not** restore any of them |
| **Bulk bar** with Place hold / Cancel orders / Print invoices | `PRM-025`, `GAP-034`: only **selected bulk Send to Steadfast** is ratified (v1.13.0) as a per-order loop with per-record results | Build only that action; others stay blocked |
| **Place hold, Cancel order, Verify order** in the menu | Behind permissions and `GAP-020` (cancel consequences) / hold rules `BR-149`–`BR-152` — not built, `OSC-051.b` withholds controls with nothing behind them | Do not draw as live controls until built |
| **Print / Print invoice** | Renderer not built; `Print` disabled with visible reason (`OSC-058.b`, `OSC-059.a`) | Keep disabled |
| **`Collectable` / `Payment received`** chip text | `OSC-056.b`: only `Payment not due`, `Payment due`, `Payment unknown` may be rendered (nothing past `DUE` without an `E-040` receivable) | Use the three canonical labels |
| Margin / Received **real figures** (e.g. ৳ 11,160) | `BR-007`, `INV-32.4`, `SYS-034`: render **Unknown** until costed and settled | Sample figures are patterns only |
| Failed delivery `Received ৳ 0` | Unknown is the **word**, never `0` | Render "Unknown" |
| Customer name `1344164920` (a phone-like value) | Snapshot is shown as stored; absence is explicit (`BR-134`) | Show as imported |

---

## 5. Other modules — what the design draws (all prototype data)

| Module | Layout notes |
|---|---|
| **Stock Control** | Positions card list (physical / reserved / available, "oversold" negative shown red); Movements ledger (`MV-0184xx`, route like `Available → Consumed`, +/− qty); Reservations (order, qty, order state); Adjustments (`ADJ-`, reason, Approved/Awaiting approval/Rejected); Transfers (`TRF-`); detail page; new-adjustment form. KPIs: stock lines, reserved units, awaiting QC, negative positions. |
| **Products** | Stock Items / Sellable Products / Listings tabs; quick filters, group-by toggle, density segments, thumbnail option, action pages. |
| **Purchasing / Suppliers / Warehouses** | PO + Goods Receipt tabs; supplier directory + ledger; warehouse + stock-location tabs. |
| **Returns & Exchange, Warranty & Repair, Trade-In** | Case/return/exchange/refund; request/repair/cost-responsibility; case/component/value-allocation tabs. |
| **Payments** | Receivables · Courier Remittances · Marketplace Settlements · Reconciliation Items. |
| **Journal / Fund Transfers / Salary Payable / Loans / Advances** | Financial accounts, expenses; funds in transit, compensating transfers, fees; payable positions; loan recovery schedule; advance approval/money-release/settlement/ledger/outstanding/claims/write-off, with a full-view detail page and "Authorise requisition" / "Record settlement" primary. |
| **HR** | Employee roster cards (facets by department/employment/state, alerts: confirmations due, on notice, user not linked, future-dated); attendance board (hours bar, legend); overtime (potential vs approved bar, rate shown as `৳ 217 × 120% = ৳ 260 per hour`); leave desk (queue, weekday, month); payroll run (meta, lines, totals, checks). |
| **CRM Customers** | Directory · Addresses · Standing · Linked Identities; full-customer view with **New order** primary. |
| **Administration** | Users (suspend/activate), Roles & Permissions (disable/enable), Shops & Channels (Sync now / Resume channel / Add shop), Integrations (Test connection), Settings (document numbering, notification templates). |
| **Chat / Notifications** | Chat inbox with channel / shop / read filters and an Order side tab; shortcut messages; notification centre with filters. |

---

## 6. Rules for using this reference in a future session

1. **Open the HTML in a browser** for visuals; use this note + `grep` on the HTML for detail. Do not paste the whole file into context (794 KB).
2. **Locate a view's data** by its `…Vals` method (list in §3) or by `grep -n "<view-key>"`. Template markup for each view is in the first 2,952 lines.
3. **Read before building any UI:** `CLAUDE.md` §9, `DESIGN_CONSTITUTION.md`, the owning screen contract (`ORDERS_SCREEN_CONTRACT.md` for Orders) — then compare against this file. The §4.1 table is the standing list of known differences.
4. **Take composition, refuse sample facts:** layout, spacing, chips, tab/segment style, card bands are authority; figures, ids, names, statuses and enabled controls are not.
5. **Anything drawn but not ratified** is `BLOCKED — MISSING CANONICAL BUSINESS RULE` (`CLAUDE.md` §5): report it, do not build it.
6. **Report new conflicts** by appending to §4.1 rather than silently resolving them.

---

## 7. Version history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-03 | Initial reading notes. Covers shell, navigation, module map, the Orders workspace in detail, and the design-vs-canon differences found. Other modules summarised from their `…Vals` data only; not exhaustively audited. |
