# UI / UX Architecture

**Owner:** Trioloo Technology · **Module:** Cross-cutting · **Status:** Canonical
**Version:** 1.5.0 · **Ratified:** 2026-08-10 · **Amended:** 2026-08-11 · **Rule prefix:** `UX-`

---

# 1. Purpose and Authority

> **UX-001 — This document owns INTERACTION ARCHITECTURE and PAGE COMPOSITION. It owns no visual token and no business rule.**

| Owns | Does **not** own |
|---|---|
| Interaction architecture · page composition · navigation behaviour · information and action hierarchy · screen archetypes · list and table interaction · viewport-pressure and overflow strategy · form interaction · feedback, loading, empty, error and forbidden presentation · modal/drawer/popover/toast usage · UI representation of canonical facts · responsive adaptation · keyboard and focus interaction · cross-domain navigation | **Business meaning, entities, calculations, permissions, workflows, states** → owning architecture · **technology** → `TECHNOLOGY_ARCHITECTURE.md` · **engineering discipline** → `PROJECT_CONSTITUTION.md` · **visual language, typography, colour, spacing, radius, shadow, geometry** → `DESIGN_CONSTITUTION.md` |

> **UX-002 — 🔴 This is not a second Design Constitution.** ⚠ **No exact token is duplicated here.** **Where a visual value is needed, the `DESIGN_CONSTITUTION.md` rule is cited.** **A duplicated token drifts.**

> **UX-003 — Precedence.** **Canonical business architecture → `DESIGN_CONSTITUTION.md` (visual) → this document (interaction) → implementation.**
>
> 🔴 **If a UI requirement conflicts with business architecture, business architecture wins.** 🔴 **If implementation convenience conflicts with canonical architecture, canonical architecture wins.**

---

# 2. Source and Precedence Model

**Visual foundation:** `DESIGN_CONSTITUTION.md` v2.1.1 and the five approved captures (`01-sidebar-navigation` · `02-orders-list` · `03-order-detail` · `04-page-header` · `05-pagination`).

> **UX-004 — The approved references are binding composition, not a starting point for redesign.**
>
> 🔴 **The ERP must look like the Trioloo design system, never like a framework's defaults.** **Prohibited visual languages: Material UI · Ant Design · Bootstrap · shadcn defaults · generic Tailwind dashboard aesthetics · any component library's spacing, radius or type system** (`TEC-091`, `PRJ-160`).

> **UX-005 — 🔴 The approved mockups PREDATE several ratified business facts.** **`Confirmed By`/`Confirmed At` (`BR-163`) and the `API_MANAGED`/`ERP_MANAGED` authority state (`BR-168`) are not drawn anywhere.** ✅ **This document solves their UI representation. It does not alter their business meaning.**

---

# 3. V1 UI Surface Inventory

**Derived from canonical ownership. A surface exists here only where an owning architecture supports it.**

| Surface | Owner | Authoritative entities | Archetype |
|---|---|---|---|
| **Dashboard** | Cross-domain | Computed views only | **A** |
| **Orders list** | Order Management | `E-031` | **B** |
| **Order detail** | Order Management | `E-031`, `E-033`, `E-035`, `E-037` | **C** |
| **Order verification** | Order Management | `E-033`, `SM-2` | **E** |
| **Products** | Product | Product entities | **B/C** |
| **Inventory** | Inventory · Inventory Costing | Stock movements | **B/F** |
| **Purchases · Vendors** | Procurement | PO, supplier, goods receipt | **B/C/D** |
| **Warehouse** | Warehouse | `E-035` Pick Task | **B/E** |
| **Delivery** | Delivery | `E-037` Shipment | **B/C** |
| **Returns / Exchange** | Return & Exchange | `SM-8`, `SM-9` | **B/C/E** |
| **Warranty · Repair** | Warranty & Repair | `SM-13`, `SM-15` | **B/C** |
| **Trade-In** | Trade-In | `SM-18`, `SM-19` | **B/C** |
| **Marketplace / API sync status** | API Integration | Adapter sync lifecycle, `DIVERGED`, `MANUAL_REQUIRED` | **B** |
| **Accounting** | Accounting | Postings, `E-089` | **B/F** |
| **Payments · Fund Transfer** | Payment | Movements, `SM-20` | **B/C** |
| **Advance Requisition** | Accounting | `E-086`–`E-088` | **C/F** |
| **Employee Loan** | Accounting | `E-098`, `E-099` | **C/F** |
| **Outstanding Salary Payable** | Accounting | Derived (`ACC-093`) | **F** |
| **Employee profile** | Permission + HR | `E-077` + `E-090` | **C** |
| **Attendance** | HR & Payroll | `E-091` | **B/C** |
| **Leave** | HR & Payroll | `E-102` | **B/E** |
| **Overtime approval** | HR & Payroll | `E-092` | **E** |
| **Payroll Run · Result** | HR & Payroll | `E-093`, `E-094` | **G** |
| **Salary Increment · Bonus · Commission** | HR & Payroll | `E-095`–`E-097` | **D/E** |
| **Final Settlement** | HR & Payroll | `E-100`, `E-101` | **F/E** |
| **Users · Roles · Permissions · Scope · Overrides** | Permission · Access Governance | `E-077`, `E-078`, `SM-17` | **B/C/I** |
| **Notifications** | Notification | Notification records | **B** |
| **Reports** | Reporting | Derived (`RPT-`) | **H** |
| **Document access** | Document | Per `PRN-023` | **J** |
| **Settings / Configuration** | Various | Versioned configuration (`SYS-021`) | **I** |
| **Chat — shared inbox** | Chat | Conversation, Channel Identity, Internal Note | **B/C** |
| **Customers** | Customer | Customer Profile, Address, Credit Limit, Blacklist | **B/C** |

> **UX-007 — 🔴 AMENDED 2026-08-11 — two canonical V1 modules were MISSING from this inventory.** **`SYSTEM_ARCHITECTURE.md` §11.1 registers Chat and Customer as V1 modules, `CHT-062` names Daraz Chat the V1 entry channel, and `CUSTOMER_ARCHITECTURE.md` owns profiles, credit limit and blacklist.** ✅ **Both are now listed.** ⚠ **v1.0.0's 30-row inventory is retained in the version history as the record of the omission.**
>
> ⚠ **A surface's presence here is INDEPENDENT of whether it is a sidebar destination.** **Navigation placement is governed by `UX-024`.** **Warehouse, Delivery and Marketplace-sync surfaces exist and are reachable, but are composed inside the Orders workspace rather than given sidebar rows** (`UX-187`).

> **UX-006 — 🔴 This inventory is not permission to invent screens.** **A surface with no owning architecture is not designed here.**

**Deferred, not designed:** **Quotation and Proforma Invoice** — 🔴 **`GAP-128` is open and `BD-134` is unanswered.** **No UI, no workflow, no entry point** (`PRN-024`).

---

# 4. Application Shell

> **UX-010 — The approved desktop shell is the baseline: fixed sidebar + scrolling content region.** **Geometry is `DESIGN_CONSTITUTION.md` §3.7 and §3.9.**

> **UX-011 — ✅ The approved surface classes carry NO separate global application header, and none is introduced for them.**
>
> 🔴 **SCOPE CORRECTED 2026-08-10.** **v1.0.0 stated this as `There is NO separate global application header` with no surface qualifier — an ERP-wide prohibition.** ⚠ **That was an over-generalisation from two reference screens, and the superseded wording is retained in this note rather than erased.**
>
> ✅ **The governing principle is REFERENCE FIDELITY BY SURFACE CLASSIFICATION** (`DESIGN_CONSTITUTION.md` `RULE 4.1.a`, `RULE 4.1.b`). **The approved set establishes the LIST PAGE and RECORD DETAIL classes only. Neither has a header bar, so neither is built with one.** 🔴 **The approved set contains no form, settings, report, wizard, document-preview or authentication screen — those classes inherit no prohibition from the absence of evidence in a DIFFERENT class.**
>
> ✅ **`RULE 4.1`'s token resolution is unchanged: `64px` is realised as the sidebar brand block.** ⚠ **The page header remains a content-region pattern that scrolls with content on every class the approved set covers.** 🔴 **Absence of evidence is not permission either** — **an unreferenced surface class does not acquire a header by preference. It goes through `DESIGN_CONSTITUTION.md` `§12.3`, and `Article XIV` item 14 records the question as OPEN.**

> **UX-012 — Navigation is two levels. Level 3 is prohibited** (`RULE 4.3.a`). **Parent and child both render active when a child is selected** (`RULE 4.3.b`). **Sections are labelled, not merely spaced.**

> **UX-013 — 🔴 The mockup's sidebar taxonomy is visual guidance, NOT the module register** (`RULE 4.3.d`).
>
> **Navigation groups are derived from the canonical module register**, and **a module's presence in the sidebar is a navigation decision, not an ownership claim.** ⚠ **Modules with no operational daily surface are reached contextually, not given a permanent sidebar row.**

> **UX-014 — Navigation is permission-aware, and permission-awareness is an affordance only** (`PRJ-120`). **A hidden nav item is convenience; the backend refuses regardless.**

> **UX-015 — The sidebar user block states identity AND acting role.** **The operator must be able to see which authority they are acting under** (`§3.7`).
>
> ✅ **COMPOSITION RATIFIED 2026-08-11.** **It is the FIXED bottom region of the sidebar shell** (`UX-018`) — **it never scrolls away with the navigation above it.** **Geometry is `DESIGN_CONSTITUTION.md` `§3.7`; none is restated here** (`UX-002`).
>
> **a.** **It consumes CANONICAL AUTHENTICATED-SESSION FACTS and nothing else** — avatar or initials, display name, and the operational role or title **where authoritative data for it is actually available.**
> **b.** 🔴 **A TITLE IS NEVER FABRICATED.** **Where the session exposes no designation, the line is ABSENT.** ⚠ **An implementation may present authoritative ROLE data in its place; it may not manufacture a job title to fill the space, and it may not carry a demonstration identity from a design capture into the product** (`§1.4`, `RULE 15.x`).
> **c.** 🔴 **This creates NO new identity semantic.** **Who the operator is, which roles they hold and which authority they act under are owned by `PERMISSION_ARCHITECTURE.md` and `ACCESS_GOVERNANCE_ARCHITECTURE.md`.**
> **d.** ⚠ **It is identity DISPLAY.** 🔴 **It does not compete with the header User/Profile utility** (`UX-017`), **which remains the account-interaction control.** **Two account menus in one shell is a defect.**

> **UX-018 — ✅ THE GLOBAL APPLICATION-SHELL FOUNDATION. Ratified 2026-08-11.**
>
> **There is ONE authenticated application shell. Every module renders INSIDE it and no module builds its own.**
>
> **a. SIDEBAR COMPOSITION — three regions, in this order:**
>
> ```
> SIDEBAR
> ├─ fixed brand region
> ├─ independently scrollable navigation region
> └─ fixed authenticated-user identity card
> ```
>
> 🔴 **ONLY the navigation region scrolls.** **The brand region and the identity card are FIXED and never scroll away** — an operator must not lose the brand or their own identity by scrolling a long navigation list. **Geometry is `DESIGN_CONSTITUTION.md` `§3.7`, its scroll chrome is `§3.20`, and neither is restated here** (`UX-002`).
>
> **b. ✅ THE FOUNDATION IS INHERITED BY CONSTRUCTION, NOT COPIED.** **The following are declared ONCE at the application foundation, and every future module — Inventory, Purchasing, Sales & Orders, Finance & Accounting, HR & Payroll, CRM, Reports, Administration and anything after them — receives them automatically by rendering inside the shell:**
>
> | Foundation concern | Governing rule |
> |---|---|
> | **Scroll surface treatment** | `DESIGN_CONSTITUTION.md` `RULE 3.20` |
> | **Routed page-content transition** | `UX-029`, `RULE 3.21.a` |
> | **Sidebar disclosure behaviour and motion** | `UX-026`, `RULE 3.21` |
> | **Disclosure chevron and its direction** | `RULE 3.17.b` |
> | **Navigation icon system and semantic mapping** | `RULE 3.17.a` |
> | **Active-parent versus selected-child hierarchy** | `RULE 3.7.a` |
> | **Brand presentation** | `RULE 3.7.b` |
> | **Header utility cluster** | `UX-017` |
> | **Sidebar user identity card** | `UX-015` |
> | **Reduced-motion behaviour** | `UX-233`, `RULE 3.21.b` |
>
> **c.** 🔴 **A MODULE DOES NOT REIMPLEMENT ANY OF THEM.** **Not a second sidebar, not a module-local scroll rule, not a page-specific transition, not a route-specific folding behaviour, not a second icon vocabulary, not a page-specific active-navigation style, not a duplicated header cluster.** ⚠ **Duplication is how a foundation silently forks: the copy stops receiving corrections made to the original.**
>
> **d.** ⚠ **MODULE-LEVEL DEVIATION REQUIRES GOVERNED AUTHORITY.** **A module that genuinely needs different behaviour states the case and amends the owning canonical document** (`DOC-005`, `DOC-079`). 🔴 **It does not fork the foundation locally and it does not decide at implementation time.**
>
> **e.** ⚠ **This rule owns COMPOSITION AND INHERITANCE only.** **It defines no visual token** (`UX-001`) **and no component API** (`UX-260`).

## 4.1 Global versus local actions

> **UX-016 — Global actions live in the page header's utility cluster; local actions live with the record they act on.** ⚠ **An action that affects one record never sits in a global position.**

> **UX-017 — ✅ THE UTILITY REGION CARRIES CHAT, NOTIFICATIONS AND USER/PROFILE. Ratified 2026-08-11 by business decision.**
>
> **It is the cluster to the RIGHT of the page header's vertical divider, exactly as `04-page-header.png`, `OD` and `ODT` already establish it** (`DESIGN_CONSTITUTION.md` `§3.8`). ✅ **The approved captures already contain notifications, chat and the avatar there — nothing is invented.**
>
> 🔴 **CHAT IS NOT A SIDEBAR DESTINATION.** **It is reached from the utility region.** ⚠ **This does not demote Chat as a module: `CHAT_ARCHITECTURE.md` owns it and the shared inbox is a full surface** (`§3`).
>
> 🔴 **This creates NO ERP-wide header rule.** **`RULE 4.1` still governs: the page header is a CONTENT-REGION pattern in the approved surface classes, and there is still no separate global application header.** **`RULE 4.1.a`/`RULE 4.1.b` continue to bound that finding to the classes an approved reference covers.**
>
> ✅ **SEMANTIC TREATMENT RATIFIED 2026-08-11 — ONE shared implementation for the whole application.**
>
> **a.** **Each utility carries the icon canonically assigned to it at `DESIGN_CONSTITUTION.md` `§3.17`** — **Chat a message/chat icon, Notifications a bell, User/Profile a profile icon.** ⚠ **The mapping itself is VISUAL and lives there; it is cited, never restated** (`UX-002`, `DOC-006`).
> **b.** 🔴 **NO FABRICATED STATE.** **No unread count, no badge, no dot and no notification or chat state is rendered until it is driven by canonical business data.** ⚠ **`NOTIFICATION_ARCHITECTURE.md` and `CHAT_ARCHITECTURE.md` own those facts; an indicator invented to make the header look alive is invented business meaning.**
> **c.** ✅ **These are ENTRY POINTS.** 🔴 **Ratifying the cluster builds no Chat module and no Notification module.**
> **d.** **Every icon-only control carries an accessible name** (`UX-231`).

---

# 5. Navigation Behaviour

> **UX-020 — List → detail → list preserves useful context.** **Returning from a detail restores the originating list's filters, sort, page and scroll position.**
>
> ⚠ **Losing filter state on return is the single most expensive interaction defect in an operational ERP** — it silently multiplies every verification and reconciliation task.

> **UX-021 — Cross-domain links are one-directional references to the owning surface, never embedded editors** (`SYS-006`, `PRJ-020`).
>
> **An order links to its customer, its shipment, its invoice. It does not edit them.**

> **UX-022 — Breadcrumbs express location, not history.** **`03-order-detail` fixes the pattern: `Orders / SO-10482`.**

> **UX-023 — A deep link is addressable.** **Every record detail, filtered list and payroll period is reachable by URL** so operators can share exactly what they are looking at.

> **UX-024 — ✅ THE RATIFIED V1 SIDEBAR. Business-approved 2026-08-11.** 🔴 **This register supersedes the mockup taxonomy** (`UX-013`, `RULE 4.3.d`) **and is the canonical navigation structure.**
>
> **MAIN**
>
> | Group | Children | Owning architecture of the children |
> |---|---|---|
> | **Dashboard** | *— direct destination, no children* | Cross-domain (computed views only) |
| **Inventory** | **Products · Stock · Warehouses** | Product · Inventory + Inventory Costing · Warehouse |
> | **Purchasing** | **Purchases · Suppliers** | Procurement |
> | **Sales & Orders** | **Orders · Returns & Exchange · Warranty & Repair · Trade-In** | Order Management · Return & Exchange · Warranty & Repair · Trade-In |
> | **Finance & Accounting** | **Payments · Journal · Advance Requisitions · Employee Loans · Salary Payable · Fund Transfers** | Payment · Accounting · Accounting · Accounting · Accounting · Payment |
> | **HR & Payroll** | **Employees · Attendance · Leave · Payroll** | Permission + HR & Payroll · HR & Payroll |
> | **CRM** | **Customers** | Customer |
> | **Reports** | *— direct destination, no children* | Reporting |
>
> **ADMIN**
>
> | Group | Children | Owning architecture |
> |---|---|---|
> | **Administration** | **Users · Roles & Permissions · Shops & Channels · Integrations · Settings** | Permission · Access Governance · API Integration · `SYS-021` |
>
> ⚠ **Two levels only. `RULE 4.3.a` still prohibits a third.** **`Dashboard` and `Reports` are direct destinations and never acquire children to match the others.**
>
> 🔴 **AMENDED 2026-08-11 — `Dashboard` was OMITTED from the v1.2.0 register.** **That was an omission, not a decision: `Dashboard` has always been the FIRST row of the `§3` V1 Surface Inventory and is archetype **A** in `UX-030`, so the surface was ratified while its navigation entry was not.** ✅ **It is placed FIRST under MAIN by business decision after reviewing the running application.** ⚠ **The v1.2.0 register listing is superseded, not erased** (`DOC-009`).
>
> ⚠ **No dashboard CONTENT is ratified by this.** **`UX-080`–`UX-082` still govern dashboard composition, and `GAP-004` keeps dashboard KPIs undefined** — **the destination exists; what it displays does not.**

> **UX-025 — 🔴 A NAVIGATION GROUP IS COMPOSITION. IT CREATES NO DOMAIN, MODULE, AGGREGATE, TRANSACTION BOUNDARY OR OWNERSHIP AUTHORITY.** **This is the load-bearing safeguard of `UX-024` and it is absolute.**
>
> **`Sales & Orders` contains capabilities owned by FOUR separate modules. `Finance & Accounting` contains Payment-owned AND Accounting-owned capabilities. `CRM` is a navigation label containing exactly one destination.**
>
> 🔴 **Therefore:** **no `Sales` module exists** · **no `Finance` module, ledger or aggregate exists** · **no `CRM` module exists, and NO additional CRM capability may be inferred from the label** · **Payment and Accounting keep separate ownership, separate records and separate authority** (`SYS-027`) · **Return & Exchange, Warranty & Repair and Trade-In keep their own lifecycles and documents.**
>
> ⚠ **A shared parent row is a place to click, nothing more.** **Ownership is `MASTER_DOCUMENTATION_INDEX.md` and `SYSTEM_ARCHITECTURE.md` §11.1, and a sidebar label never amends it** (`UX-013`, `DOC-005`).

> **UX-026 — ✅ FOLDING BEHAVIOUR.** **Every `UX-024` group is collapsible. `Reports` is not — it has no children.**
>
> **a. COLLAPSED** — children are hidden; the parent row remains a full nav row at its approved geometry (`§3.7`). 🔴 **Collapsing hides navigation, never capability.**
> **b. EXPANDED** — children render beneath the parent at the approved child geometry.
> **c. ACTIVE PARENT + ACTIVE CHILD** — when a child is the current destination, **BOTH render active simultaneously** (`RULE 4.3.b`). **On arriving at a destination the owning group OPENS so the active child is visible.**
>
> 🔴 **AMENDED 2026-08-11 by explicit business decision after reviewing the running application.** **v1.2.0 read:** ~~*"and the group is expanded so the active child is visible. An active child is never hidden inside a collapsed group."*~~ ⚠ **The superseded wording is retained here, not erased** (`DOC-009`).
>
> **What changed and why:** **the original rule made the active group PERMANENTLY expanded, so an operator could not collapse the module they were working in — the only way to close it was to navigate away.** ✅ **Disclosure now belongs to the operator** (`UX-026.f`).
> **d. PARENT ACTIVATION** — a group parent is a disclosure control, **not a destination.** **Activating it toggles the group; it never navigates.**
>
> **e. DISCLOSURE AFFORDANCE** — the indicator consumes the **ratified outline disclosure chevron, ONE glyph rotated for state** (`DESIGN_CONSTITUTION.md` `RULE 3.17.b`). ⚠ **No new visual token is defined here, and this document defines none** (`UX-001`).
>
> 🔴 **AMENDED 2026-08-11.** **v1.2.0 read:** ~~*"the indicator consumes the existing approved caret primitive (`DESIGN_CONSTITUTION.md` `§3.17`), rotated for state"*~~ — **written when the production icon set was still open and the only source affordance was a CSS triangle.** ⚠ **The superseded wording is retained here, not erased** (`DOC-009`).
>
> ✅ **DIRECTION IS CANONICAL AND IS OWNED BY THE DESIGN CONSTITUTION: FOLDED points UP, UNFOLDED points DOWN** (`RULE 3.17.b`). 🔴 **It is deliberately the inverse of the common convention, and it is not re-derived here** (`DOC-006`). **A destination with no children carries no chevron at all.**
>
> **f. ✅ DISCLOSURE IS OPERATOR-CONTROLLED, and an explicit collapse is never overridden.** **First activation of a parent OPENS; the next CLOSES — including the group that owns the current page.**
>
> **A route change may auto-open the newly active group, but it must not re-open a group the operator has just deliberately closed.** ⚠ **Requiring an operator to navigate elsewhere before the current module can be closed is the defect this rule removes.**
>
> ✅ **The active PARENT stays visually active while collapsed**, so the operator never loses which navigation group owns the page they are on — that is what `RULE 4.3.b`'s simultaneous active state protects, and it survives the collapse. 🔴 **An active child MAY therefore be hidden inside a collapsed group; re-opening the group reveals it, still marked active.**
>
> ✅ **CONFIRMED UNCHANGED BY THIS AMENDMENT, and none of it is weakened by operator-controlled folding:** **a group with zero visible children renders nothing** (`UX-027.b`) · **a single-child group stays a group and never auto-flattens** (`UX-027.c`) · **child visibility remains permission-aware and remains an AFFORDANCE ONLY, with the backend refusing regardless** (`UX-014`, `UX-027.a`, `PRJ-120`) · **the parent is still never a destination** (`UX-026.d`).
>
> **g. ✅ MOTION.** **Opening and closing are animated by the ratified sidebar-disclosure treatment — `160ms`, submenu and chevron on one clock, with a mandatory reduced-motion fallback** (`DESIGN_CONSTITUTION.md` `RULE 3.21`, `RULE 3.21.b`; `UX-233`). 🔴 **The duration is VISUAL and is not restated here** (`UX-002`). ⚠ **Motion never delays the state change: the group is open the moment it is activated.**
>
> **h.** 🔴 **ONE folding implementation serves every group** (`UX-018.c`). **A module never defines its own folding behaviour, and folding is never route-specific.**

> 🔴 **Folding a navigation GROUP is NOT collapsing the sidebar RAIL.** **Rail collapse to an icon strip remains `NOT DEFINED BY SOURCE`, and the sidebar retains its approved width** (`§28` finding 5, `DESIGN_CONSTITUTION.md` Article XIV item 5).

> **UX-027 — ✅ PERMISSION-SENSITIVE VISIBILITY, and what happens when a group empties.**
>
> **a.** **A child the user cannot reach is not rendered** — **an affordance decision only** (`UX-014`). 🔴 **Hiding is NEVER authorization; the backend refuses regardless** (`PRJ-120`).
> **b.** 🔴 **A group whose children are ALL hidden renders NOTHING — no empty parent, no disabled row.**
> **c.** ✅ **A group with exactly ONE permitted child still renders as a group with that one child.** ⚠ **It does NOT auto-flatten into a direct destination.** **Flattening would make one operator's sidebar structurally different from another's, so a label would move depending on who is looking — which destroys the muscle memory the structure exists to create.** **`CRM` already demonstrates the shape: one child is a legitimate group.**
> **d.** 🔴 **This rule invents NO permission.** **Which destinations a user may reach is decided entirely by `PERMISSION_ARCHITECTURE.md` and `ACCESS_GOVERNANCE_ARCHITECTURE.md`.** ⚠ **Administrator title implies no permission where canonical rules say otherwise, and payroll and accounting destinations respect separately-permissionable access.**

> **UX-028 — ✅ EXPANSION STATE PERSISTS PER USER, and it is CLIENT state.**
>
> **It survives navigation within a session and is restored on return, so an operator does not re-open the same group all day.** 🔴 **It is interaction state, never authoritative business state** (`UX-261`, `PRJ-170`) — **it is never a second database, never permission, and losing it must degrade to the `UX-026.c` default (the group holding the active destination is expanded) rather than to an error.**

> **UX-029 — ✅ THE ROUTED PAGE-CONTENT TRANSITION BOUNDARY. Ratified 2026-08-11.**
>
> **Navigating between destinations transitions the ROUTED CONTENT, and only the routed content.**
>
> **a.** ✅ **Declared ONCE at the application content boundary, so every routed module page inherits it** (`UX-018.b`). 🔴 **No page animates itself, and no module-specific or route-specific transition exists.**
> **b.** 🔴 **THE STABLE SHELL DOES NOT TRANSITION** — **not the sidebar, not the brand region, not the user identity card, not the header utilities.** ⚠ **A shell that re-animates on every navigation stops reading as stable.**
> **c.** 🔴 **NAVIGATION IS NEVER DELAYED.** **The transition decorates content that has already arrived; it never gates a route change, a request or a render.**
> **d.** 🔴 **IT AFFECTS NO DATA AND NO STATE.** **Not one record, request, filter, page size or permission decision depends on it** (`UX-261`, `RULE 7.3.a`).
> **e.** **Duration, easing and treatment are VISUAL and are owned by `DESIGN_CONSTITUTION.md` `RULE 3.21.a`** — **cited, never restated** (`UX-002`). **Reduced motion applies** (`UX-233`).

---

# 6. Page Archetypes

> **UX-030 — Ten archetypes. Consistency comes from shared composition rules, never from flattening distinct business surfaces.**

| | Archetype | Purpose | Composition |
|---|---|---|---|
| **A** | **Dashboard** | Orientation and pending work | Header → summary row → pending-work regions |
| **B** | **Operational List** | Find, scan, act on many records | Header → KPI row *(where meaningful)* → status tabs → filters → search → rows → pagination (`02-orders-list`) |
| **C** | **Record Detail** | Understand and act on one record | Breadcrumb → title + status → tabs → main column + right rail (`03-order-detail`) |
| **D** | **Create / Edit Form** | Capture or amend | Header → grouped sections → validation → save/cancel |
| **E** | **Review / Approval** | Decide on a candidate | Context first, decision second, consequence stated |
| **F** | **Financial Position / Statement** | As-of position over movements | As-of control → position summary → movement history |
| **G** | **Payroll Period / Result** | Period computation and its outcome | Period → run state → per-employee results → derivation |
| **H** | **Report** | Derived period/range output | Parameters → results → export |
| **I** | **Configuration** | Versioned settings | Grouped settings with effective-date awareness |
| **J** | **Document Access** | Reach a printable | Contextual action on its owning record |

> **UX-032 — ✅ THE OPERATIONAL WORKSPACE — a composition of archetype B, ratified 2026-08-11.** **Where business review consolidates several operational destinations behind ONE sidebar entry, that entry composes in this fixed order:**
>
> **1.** **Canonical lifecycle / status navigation** — the owning architecture's states, never invented ones.
> **2.** **Contextual operational stage navigation**, shown only where the selected lifecycle position makes it applicable.
> **3.** **Context-sensitive controls** — filters, search, exceptions, sort, print and bulk operations.
> **4.** **The operational records themselves.**
>
> 🔴 **A WORKSPACE IS A UI COMPOSITION. IT MERGES NO DOMAIN MODEL** (`UX-025`). **Records surfaced inside one keep their own entities, lifecycles, permissions, documents and transaction boundaries.** ⚠ **Stage navigation reflects canonical state; it never becomes a state machine of its own** (`SMA-`, `EVA-` govern that, and `UX-005` forbids inventing either).

> **UX-033 — ✅ THE PURCHASING WORKSPACE.** **`Purchases` is one workspace giving access to BOTH Purchase Orders and Goods Receipts, per `UX-032`. `Suppliers` is the other Purchasing destination.**
>
> 🔴 **Purchase Order and Goods Receipt remain CANONICALLY SEPARATE records with separate lifecycles under `PROCUREMENT_ARCHITECTURE.md`.** ⚠ **This is UI consolidation only — no combined entity, no combined document, no combined authority.**

> **UX-031 — Archetypes B, C and D are fixed by approved references and are not re-derived.**
>
> ✅ **AMENDED 2026-08-11.** **v1.0.0 named only B and C, because no approved form reference existed.** **`Form Design Language.dc.html` was approved 2026-08-11 and ratified at `DESIGN_CONSTITUTION.md` `§3.18`, so archetype D's CONTROL treatment and field composition are now fixed.**
>
> ⚠ **What is fixed is the CONTROL and FIELD language, not the column count.** **`RULE 3.18.g` records the reference's two-column grid as that surface's composition, not an ERP-wide mandate** — **so `UX-030`'s `Header → grouped sections → validation → save/cancel` still governs archetype D's page structure.**

---

> **UX-034 — ✅ THE AUTHENTICATION SURFACE PRESENTATION. Ratified 2026-08-11 by business decision.**
>
> **Primary copy:**
>
> > **Welcome To TrioLoo**
> > **Login to start work**
>
> **a.** **The brand spelling is `RULE 3.7.b`'s and is consumed from the single application-brand source, never retyped** (`DOC-006`).
> **b.** 🔴 **THE LAYOUT STAYS MINIMAL.** **No marketing slogan, no illustration, no hero panel, no promotional text, no gradient and no additional content.** ⚠ **An authentication screen is a gate, not a landing page.**
> **c.** ⚠ **This is AUTHENTICATION-SURFACE PRESENTATION ONLY.** 🔴 **It is not duplicated into any business or module architecture, and it creates no marketing, brand-voice or content system.**
> **d.** ⚠ **It creates no authentication BEHAVIOUR.** **Credentials, lifecycle, activation, lockout and session authority remain owned by `ACCESS_GOVERNANCE_ARCHITECTURE.md` and `PERMISSION_ARCHITECTURE.md`.**
> **e.** ⚠ **The authentication surface class still has NO approved visual reference** (`DESIGN_CONSTITUTION.md` Article XIV item 18). **This ratifies its COPY, and composes it from already-ratified primitives; it does not close that item.**

---

# 7. Information Hierarchy

> **UX-040 — Eight ranks, applied consistently across every operational surface.**

**1.** Record identity · **2.** business-critical status · **3.** monetary and quantitative facts · **4.** operational metadata · **5.** secondary metadata · **6.** primary actions · **7.** secondary/overflow actions · **8.** warnings and exceptions.

> **UX-041 — Density is a requirement, not a preference.** **Fast scanning · stable geometry · predictable placement · low unnecessary vertical growth · minimal visual noise** (`RULE 5.1`).
>
> 🔴 **No compact/comfortable mode and no density selector** — none is canonically required, and a density toggle silently creates two layouts to maintain.

> **UX-042 — Monetary hierarchy is preserved as approved:** **secondary figures demoted and divided from primary Sale/Margin** (`§3.15`). ⚠ **Tabular numerals and right alignment on every monetary column.**

---

# 8. Layout Stability and Browser Zoom

> **UX-050 — `DESIGN_CONSTITUTION.md` Article VII is consumed exactly and is load-bearing.**

**100% is canonical. 80% is a first-class desktop condition** (`RULE 7.2`).

> **UX-051 — 🔴 The three concepts remain separate** (`RULE 7.3`): **information EXISTENCE** (unchanged by zoom) · **VISIBILITY in the viewport** (naturally changes) · **structural LAYOUT** (stable).

> **UX-052 — 🔴 Zoom must never change** record count · server-side page size · fields · permissions · available actions · workflow · calculations · sorting · filtering · API behaviour (`RULE 7.3.a`).
>
> ⚠ **Zooming out lets the operator SEE more of the same page. It fetches nothing.** ⚠ **Zooming in shows less of it. It removes nothing.**
>
> 🔴 **No viewport-driven data fetching. No resize-triggered page-size change. Browser zoom is never suppressed** (`RULE 7.9`).

---

# 9. Operational Rows — the absolute rule

> **UX-060 — 🔴 A structured operational row preserves its horizontal composition under all viewport pressure** (`RULE 7.4`).

**Prohibited:**

```
Product | Amount | Delivery | Status | Actions
                 ↓ PROHIBITED
Product
Amount + Delivery
Status + Actions
```

**Preserved:** record identity · column order · amount placement · status placement · action placement · horizontal scan direction · the relationship between values.

> **UX-061 — 🔴 No global `flex-wrap: wrap` as a responsive solution** (`RULE 7.5.a`). 🔴 **And no global `white-space: nowrap`** (`RULE 7.7`).
>
> ⚠ **These are different concerns.** **Structural reflow changes geometry; content wrapping changes line breaks.** ✅ **Ordinary prose, descriptions and forms retain normal reflow.**

## 9.1 Surface classes — never generalise between them

> **UX-062 — Four classes, four behaviours** (`RULE 7.8.a`, `7.8.b`).

| Class | Under pressure |
|---|---|
| **Operational / data row** | 🔴 **Structure stable. Never wraps** |
| **Page title / meta / action region** | ✅ **May reflow** where its approved composition allows, preserving information, action identity and hierarchy |
| **General prose / form content** | ✅ **Reflows naturally** |
| **Dashboard / card region** | ✅ **Own rule — `UX-072`** |

🔴 **Behaviour is never generalised from one class to another.** ⚠ **"The detail page wraps" is not licence to wrap a record row.**

---

# 10. Width Pressure and Overflow Access

> **UX-070 — This resolves `RULE 7.5`, which deliberately left the mechanism to this document.**

**Priority order, applied in sequence:** **1.** preserve information · **2.** preserve operational structure · **3.** preserve scan direction · **4.** preserve action accessibility · **5.** then manage viewport pressure.

> **UX-071 — 🔴 No business-critical field is hidden to make a row fit.** 🔴 **And the page never becomes a globally horizontally scrolling canvas.**

| Surface | Pressure behaviour |
|---|---|
| **Operational list / card row** | ✅ **Horizontal overflow SCOPED TO THE ROW REGION.** The row scrolls within its own container; **page header, filters, tabs and pagination stay fixed and visible** |
| **Data table** | ✅ **Scoped horizontal overflow with the identity column pinned** so a scrolled row never loses which record it is |
| **Page title / meta / action region** | ✅ **Reflows** — actions may fall below the title |
| **Form** | ✅ **Reflows** — multi-column groups collapse to single column. 🔴 **Never horizontal scroll** |
| **Dashboard grid** | ✅ **Reduces columns** (4 → 2 → 1). 🔴 **Never horizontal scroll** |
| **Detail information region** | ✅ **Key/value grid collapses 2 → 1 column.** ✅ **The right rail wraps below the main column** (`RULE 4.2`) |
| **Report / financial statement / payroll table** | ✅ **Scoped horizontal overflow, identity column pinned**, header row sticky |
| **Document preview** | ✅ **Own scroll container**, fitted to width by default |

> **UX-072 — Dashboard cards reduce column count; they never scroll horizontally.** ⚠ **A summary the operator must scroll to find has failed at being a summary.**

> **UX-073 — Off-viewport content must be DISCOVERABLE, not merely reachable.**
>
> **A horizontally scrollable region shows a persistent affordance that more content exists** — the region is never visually indistinguishable from a complete one. ⚠ **Silent truncation is the failure mode this rule exists to prevent.**

> **UX-074 — 🔴 SUPPRESSING SCROLLBAR CHROME NEVER SUPPRESSES DISCOVERABILITY. Ratified 2026-08-11.**
>
> **`DESIGN_CONSTITUTION.md` `RULE 3.20` suppresses visible native scrollbar chrome on ERP-owned scroll surfaces, and that reaches horizontal operational and data regions too.**
>
> ### ✅ HIDDEN SCROLLBAR CHROME ≠ HIDDEN OVERFLOW DISCOVERABILITY.
>
> **a.** 🔴 **`UX-073` IS STRENGTHENED, NOT WEAKENED.** **The native scrollbar was itself a cue that more content existed. With it suppressed, the ratified affordance is MANDATORY — it is the discoverability mechanism, not a decoration beside one.**
> **b.** 🔴 **A region that hides its chrome and shows no affordance is SILENTLY TRUNCATED DATA**, which is precisely the failure `UX-073` exists to prevent. ⚠ **It is a defect, not a style.**
> **c.** ✅ **UNCHANGED AND EXPLICITLY PROTECTED:** **structured operational rows never wrap** (`UX-060`, `RULE 7.4`) · **the identity column stays pinned so a scrolled row never loses which record it is** (`UX-071`) · **overflow stays SCOPED to the row region — header, filters, tabs and pagination never scroll with the rows** (`UX-071`) · **every zoom rule in `§8`** · **page size and record count never depend on viewport or zoom** (`RULE 7.3.a`).
> **d.** 🔴 **No business-critical field is hidden to make a row fit, under any scrollbar treatment** (`UX-071`).

---

# 11. Dashboard Composition

> **UX-080 — The Dashboard presents only what canonical architecture already computes.**
>
> 🔴 **No KPI, metric, trend, forecast or analytic is invented.** ⚠ **A summary card is a computed view over authoritative records, never a new figure.**

> **UX-081 — Dashboard content is permission-scoped and scope-scoped** (`SYS-020`). **Two operators see different dashboards because they hold different authority, not because of a preference.**

> **UX-082 — The Dashboard prioritises PENDING WORK over totals.** ⚠ **An operational ERP dashboard exists to route people to what needs doing.**

---

# 12. Record Detail Composition

> **UX-090 — Detail composition follows `03-order-detail`: breadcrumb → title with inline status → tabs → main column + fixed right rail.**

> **UX-091 — 🔴 Multiple lifecycles are shown side by side, never merged into one status.**
>
> ✅ **The approved Status card is canonical**: Order · Verification · Payment · Shipment, **each with its own chip.** ⚠ **This directly reflects the corpus's independent state machines** (`SM-1`–`SM-5`) — **collapsing them would misrepresent the domain.**

> **UX-092 — Tabs partition one record's information; they never hide a state the operator must act on.**

---

# 13. Forms

> **UX-100 — Form architecture is defined without inventing a single business field.**

**Labels above inputs · required indication on the label · help text below · placeholders never replace labels** (`11.2.a` permits the compact exception only where the Constitution fixes it).

> **UX-101 — Field types map to canonical semantic types** (`TEC-051`, `PRJ-140`): **date → date control · local time → time control · instant → displayed with timezone context · money → decimal-safe text input** (`PRJ-045` — 🔴 **never a JS `Number`**).

> **UX-102 — 🔴 Validation and business refusal are DIFFERENT and are presented differently.**

| | Presentation |
|---|---|
| **Validation error** — *"Required field missing"* | **Inline, at the field, before submission** |
| **🔴 Business refusal** — *"Authorised recovery exceeds available settlement value"* | **A prominent, persistent message at the point of decision, stating the canonical reason** |

⚠ **A business refusal is a correct outcome of a correct rule** (`SYS-032`, `TEC-083`) — **it is never styled as a system malfunction, and its reason is never replaced with a generic message.**

> **UX-103 — Immutable and finalised values are rendered as read-only facts with NO edit affordance** (`UX-130`).

> **UX-104 — Unsaved changes are protected on navigation away.** **Submission state is visible and the primary action is idempotent-safe against double submission** (`PRJ-110`).

---

# 14. Action Hierarchy

> **UX-110 — One primary action per surface at most** (`§3.8`). **Secondary actions are outlined; tertiary and utility actions are ghost or overflow.**

> **UX-111 — 🔴 Visual prominence never implies authority the user does not hold.**
>
> **Permission controls actual availability; the backend is authoritative** (`PRJ-120`). ⚠ **Hidden buttons are not authorization.**

> **UX-112 — Unavailable actions: hide where the user lacks the permission entirely; DISABLE with a stated reason where the user holds the permission but the record's state forbids it.**
>
> ✅ **The distinction matters:** *"you cannot do this"* and *"this cannot be done right now"* are different facts, and conflating them makes an operator think their access is broken.

> **UX-113 — Destructive and irreversible actions require confirmation naming the specific consequence.**
>
> 🔴 **Finalisation actions — payroll finalisation, settlement finalisation, invoice cancellation — state their irreversibility** (`INV-93.1`, `INV-100.5`, `DB-012`).
>
> ⚠ **Confirmation is NOT an approval step.** **`PRM-086` establishes that finalisation approves nothing** — **the UI must not create an implied second authorisation the architecture does not have.**

---

# 15. Filters, Search, Sort, Pagination

> **UX-120 — Only canonically supported filtering, sorting and search capabilities are exposed.** 🔴 **A filter the architecture cannot serve is not drawn.**

> **UX-121 — Filters, sort and pagination are SERVER-SIDE** (`TEC-096`, `PRJ-190`). 🔴 **No whole-dataset browser fetch.**

> **UX-122 — 🔴 Page size is user behaviour, NEVER viewport behaviour** (`RULE 7.3.a`).
>
> 🔴 **No data-grid default that changes page size on resize may be used.** ⚠ **This disqualifies several common grid components; the constraint is a rule, not a preference.**

> **UX-123 — Active filters are visible and individually clearable, with a global reset** (`02-orders-list`).

> **UX-124 — Three distinct empty presentations:** **no data at all** (guidance toward creating the first record) · **filtered no-results** (which filters excluded everything, with a clear action) · **permission-scoped empty** (⚠ **stated as scope, never as absence**).

> **UX-125 — Row identity is stable; the whole row opens the record; explicit action controls stop propagation.** **Long text truncates with the full value available; identifiers stay monospaced, copyable and searchable** (`§Localization`).

---

# 16. Feedback and Status

> **UX-130 — Feedback container by permanence:**

| Container | Use |
|---|---|
| **Persistent inline state** | A condition of the record |
| **Status badge** | A lifecycle state (semantic tokens, `§3.3`) |
| **Alert** | A condition requiring attention while present |
| **Inline validation** | A field-level correction |
| **Confirmation message** | A completed action with consequence |
| **Toast** | 🔴 **Transient, non-authoritative feedback ONLY** |

> **UX-131 — 🔴 Colour is never the sole carrier of meaning.** **Every status pairs colour with a word** (`RULE 8.4`). 🔴 **No new business status is created for UI convenience.**

---

# 17. Loading, Empty, Error, Forbidden

> **UX-140 — Nine states, each distinct.**

| State | Presentation |
|---|---|
| **Initial load** | Structural placeholder preserving final geometry — ⚠ **no layout shift on arrival** |
| **Section load** | Local indicator; the rest of the page stays usable |
| **Empty dataset** | Guidance |
| **Filtered no-results** | Which filters excluded everything |
| **Recoverable technical error** | What failed, that it is retryable, a retry control |
| 🔴 **Business refusal** | **The canonical reason, verbatim in meaning** |
| 🔴 **Permission denied** | **Stated as authority, not as an error** |
| **Unavailable action** | Disabled with the state-based reason (`UX-112`) |
| **Stale external state** | ⚠ **`DIVERGED` and `MANUAL_REQUIRED` are surfaced as exceptions requiring resolution** (`SYS-025`, `SYS-026`) |

> **UX-141 — 🔴 Failures are never collapsed into *"Something went wrong."*** **Where the architecture supplies a deterministic reason, it is preserved.**
>
> 🔴 **No stack trace, raw exception or internal detail reaches a user** (`PRJ-200`).

---

# 18. Modal, Drawer, Popover, Toast

> **UX-150 — Usage architecture is defined here; visual tokens are not.**
>
> ✅ **FACTUAL CURRENCY CORRECTION 2026-08-11.** **v1.0.0 opened this rule with `These were NOT DEFINED BY SOURCE`, which was true when written and is now only PARTLY true.** ✅ **`Overlay & Destructive Design Language.dc.html` was approved 2026-08-11 and ratified at `DESIGN_CONSTITUTION.md` `§3.19`, so MODAL and the ANCHORED ACTION MENU now have visual treatment.** 🔴 **DRAWER, TOAST, TOOLTIP and popover classes other than the anchored action menu remain `NOT DEFINED BY SOURCE`.**
>
> ⚠ **The usage table below is UNCHANGED — no interaction rule was altered by that ratification, and this document still defines no visual token.**

| Container | Appropriate for | 🔴 Never |
|---|---|---|
| **Modal** | A blocking decision or bounded confirmation | **A complex primary workflow** |
| **Drawer** | Contextual secondary work beside retained context | A substitute for a page |
| **Popover** | Lightweight contextual controls, overflow menus, filter panels | Anything requiring validation |
| **Toast** | Transient, non-authoritative confirmation | 🔴 **The sole presentation of a business-critical failure** |

> **UX-151 — 🔴 A workflow needing more than a bounded decision gets a PAGE, not a modal.** ⚠ **Payroll finalisation, Final Settlement authorisation and Advance recovery decisions are pages** — they carry too much consequence and context for a dialog.

> **UX-152 — No container is introduced because a component library provides one** (`PRJ-180`).

---

# 19. Sensitive Information

> **UX-160 — Salary-bearing surfaces are a `PRM-011` sensitive class** (`PRM-083`, `AGV-012`, `RPT-059`).

**Covers:** salary · salary history · payroll result · deductions · bonus · commission · employee loan · outstanding salary payable · final settlement · financial statements · payment details.

> **UX-161 — 🔴 Viewing a payroll surface never implies authority over its documents or actions** (`PRM-080`).
>
> **View salary · prepare payroll · finalise payroll · pay salary · waive a deduction · authorise an increment, bonus or commission · loan authority · AR recovery decision · settlement recovery authorisation · settlement finalisation** are **separately permissioned** (`PRM-079`, `PRM-085`). ⚠ **UI composition must reflect that separation rather than gating a whole screen on one permission.**

> **UX-162 — Sensitive values are not rendered into logs, tooltips, exports or URLs** (`PRJ-210`).

---

# 20. Immutability and Historical Presentation

> **UX-170 — 🔴 An immutable record is never given an Edit affordance.**

| Presentation | Applies to |
|---|---|
| **Editable** | Drafts, unfinalised runs, configuration before effect |
| 🔴 **Immutable historical fact** | Finalised payroll (`INV-93.1`) · finalised settlement (`INV-100.5`) · posted transactions (`DB-002`) · attendance sessions (`INV-91.3`) · authorised pending decisions (`INV-95.3`) |
| **Correction** | A **new linked record**, presented as such |
| **Retired** | A cancelled invoice number — ⚠ **shown as retired, never reused** (`DB-012`) |

> **UX-171 — 🔴 A correction never looks like an in-place historical edit.** **The original remains visible and the correction links to it.**

> **UX-172 — Users navigate the chain: original → correction → resulting position.** ⚠ **The corpus's never-edit-always-relink discipline is only trustworthy if the chain is traversable in the UI.**

> **UX-173 — No generic correction workflow is invented** (`PRN-016`). **Each owning capability's correction mechanism is surfaced as that capability defines it.**

---

# 21. Order-Specific UI Architecture

> **UX-180 — 🔴 `Assigned Agent` and `Confirmed By` are presented as DIFFERENT facts and are never equated** (`BR-165`).
>
> | Fact | Means |
> |---|---|
> | **`Assigned Agent`** | **Who was RESPONSIBLE for the work** — allocation |
> | **`Confirmed By`** | **Who PERFORMED the successful confirmation** — attribution |
>
> ⚠ **They may legitimately differ.** 🔴 **No UI label, grouping, column heading or tooltip may imply one is the other.**

> **UX-181 — 🔴 An `AUTO_CONFIRMED` order shows NO human confirmer, and none is fabricated** (`BR-166`, `SYS-034`).
>
> ✅ **The confirmation is presented as automatic** — a system confirmation, distinguishable at a glance from a human one. 🔴 **The field is never filled with the assigned agent, an owner, an administrator or a shop owner.** ⚠ **Absence is the fact, and empty is not "unknown".**

> **UX-182 — External marketplace status and ERP operational status are presented as SEPARATE, SIMULTANEOUS facts** (`BR-171`).
>
> ✅ **`Marketplace: Cancelled` and `ERP: Confirmed` may legitimately coexist** — **they describe different systems.** 🔴 **They are never merged into one status chip.** ⚠ **A restored marketplace order is the case that proves it** (`BR-172`).

> **UX-183 — Order authority is presented in BUSINESS language, not internal terminology.**
>
> | State | User-facing meaning |
> |---|---|
> | **`API_MANAGED`** | **The marketplace still updates this order** |
> | **`ERP_MANAGED`** | **Trioloo now controls this order; marketplace updates will not overwrite it** |
>
> ✅ **The canonical fact is retained; only the vocabulary is made operational.** ⚠ **`BR-174`'s causing action, actor and timestamp are visible on inspection** — **an operator must be able to see who took the order over, when, and by doing what.**

> **UX-184 — The takeover moment is legible.** **A user amending an `API_MANAGED` order must understand — before or at the point of change — that the order becomes ERP-controlled** (`BR-169`). ⚠ **A one-way, irreversible authority transition must not happen invisibly.**

> **UX-185 — Locally amended values are distinguishable from synced values on an `ERP_MANAGED` order**, and **externally-authoritative facts that keep syncing** — external order ID, marketplace status, AWB, tracking, settlement — **are visibly external** (`BR-171`).

> **UX-186 — 🔴 No field-level sync conflict UI is built** (`BD-498` §13). **Authority is order-level; the UI reflects that and offers no per-field resolution.**

> **UX-187 — ✅ THE ORDERS WORKSPACE. Business-ratified 2026-08-11.** **`Orders` is a single unified operational workspace composed per `UX-032`:**
>
> **1.** **Canonical order lifecycle / status navigation** — from `SM-1`/`SM-2` and `ORDER_MANAGEMENT_ARCHITECTURE.md`, never invented statuses.
> **2.** **Contextual operational and fulfilment stages** where applicable — picking and packing (`E-035`, Warehouse) and shipment and delivery (`E-037`, Delivery).
> **3.** **Context-sensitive filters, search, SYNC EXCEPTIONS, print and bulk operations, and sorting.**
> **4.** **The operational order records.**
>
> 🔴 **THERE ARE NO SIDEBAR ENTRIES FOR `Pick & Pack`, `Shipments` OR `Marketplace Sync`.** ✅ **Their surfaces exist and are reachable inside this workspace** (`§3`).
>
> 🔴 **Picking, shipment and delivery remain CANONICALLY SEPARATE domain facts owned by Warehouse and Delivery.** **Composing their operational access inside Orders merges no domain model, no aggregate and no transaction boundary** (`UX-025`, `SYS-027`).
>
> ✅ **`DIVERGED` and `MANUAL_REQUIRED` remain exceptions requiring resolution** (`UX-140`, `SYS-025`, `SYS-026`) — **surfaced here as an exception control, not as a technical `API authority` page.** ⚠ **`API_MANAGED`/`ERP_MANAGED` remains an authority STATE presented in business language** (`BR-169`, `BR-174`), **never collapsed into ordinary order status** (`BR-171`).

---

# 22. Accounting and Position Presentation

> **UX-190 — 🔴 A derived position is never presented as an independently stored balance** (`DB-001`, `ACC-001`).
>
> **Advance, Employee Loan, Salary Payable, Final Settlement and receivables are presented as: an AS-OF position + the movements that produce it + the authorisations and settlements that changed it.** ✅ **The position is always traceable to its movements.**

> **UX-191 — 🔴 Final Settlement is never presented as owning a financial balance** (`INV-100.2`).
>
> **Direction is explicit — `Trioloo Payable to Employee` · `Settled` · `Employee Owes Trioloo`** (`RULE 7`, `RPT-061`). 🔴 **A negative sign alone is never the meaning.**
>
> 🔴 **A 7,000 loan and a 3,000 requisition may PRESENT as *employee owes 10,000*, but the UI must never imply a third consolidated receivable exists** (`RPT-062`). ✅ **The underlying positions remain individually visible and drillable.**

> **UX-192 — Draft and finalised settlements are visually and behaviourally distinct.** **A draft recomputes; a finalised one is an immutable snapshot as at its finalisation point** (`INV-100.5`).

---

# 23. HR, Payroll, Leave, Final Settlement

> **UX-200 — 🔴 Payroll finalised ≠ salary paid.**
>
> **`ACC-094` makes finalisation and payment separate facts.** 🔴 **No payslip, salary sheet or payroll surface may imply payment because a run is finalised.** ✅ **Payment status comes only from confirmed movements** (`PAY-091`); **`ACC-093`'s outstanding position is what remains.**

> **UX-201 — A Payroll Result exposes its DERIVATION, not just a net figure** (`HRP-029`, `RPT-058`).
>
> **The seven pre-finalisation figures are visible:** earnings · calculated attendance and LWP deductions · other authorised deductions · proposed AR recovery · expected loan instalment · actual loan recovery · resulting Net Salary. ⚠ **An operator who cannot see why net pay is what it is cannot verify payroll.**

> **UX-202 — Employee identity is ONE profile with an HR extension** (`E-077` + `E-090`, `HRP-003`). 🔴 **No duplicate employee master is presented.** ⚠ **Salary reference on the profile is a derived exposure of the effective value, not an editable source** (`INV-90.3`).

> **UX-203 — Leave: 🔴 partial approval preserves three distinct facts** (`INV-102.3`, `INV-102.5`).
>
> **Requested period · approved period · 🔴 the unapproved residue, which acquires NO status.** ⚠ **Requested-but-unapproved days are NOT shown as Absent, LWP or any other type.** **They are evaluated on whatever other authoritative facts exist for those dates.**
>
> 🔴 **Not invented:** entitlement · quota · accrual · leave balance · carry-forward · half-day · hourly leave · medical certificate workflow · sandwich rule · approval hierarchy.

> **UX-204 — Overtime shows potential and approved as separate quantities**, with **duration in exact time units, not rounded decimal hours** (`INV-92.2`). **Pending OT is visible and does not block finalisation** (`BD-465`).

> **UX-205 — Final Settlement presents the four stages per position** — **outstanding · authorised · applied · remaining** (`INV-101.1`) — **and the capacity constraint before finalisation** (`INV-101.3`). ⚠ **Where `Σ Authorised > Available`, the refusal states that the operator must reduce or remove amounts** — 🔴 **the system never chooses which** (`HRP-069`).

> **UX-206 — Finalisation is a COMMIT, not another approval** (`PRM-086`). **The UI states the consequence and does not invent a second authorisation step.**

---

# 24. Document and Printable Access

> **UX-210 — A document is reached as a contextual action on its owning record, never from a separate document module** (`PRN-022`).

> **UX-211 — 🔴 Rendering creates no business event** (`PRN-001`). **A print action never changes state.**

> **UX-212 — Document actions are separately permissioned** — view · generate · issue/finalise · reprint · cancel · export (`PRN-018`). ⚠ **Salary-bearing documents remain a sensitive class** (`PRN-019`).

> **UX-213 — 🔴 Not invented:** document numbering for the nine documents that have none (`PRN-015`) · print approval · reprint watermark · a mandatory Warranty Card (`PRN-028`).

> **UX-214 — 🔴 Quotation and Proforma Invoice have NO UI in V1.** **`GAP-128` is open and `BD-134` unanswered** — **no entry point, no action, no placeholder screen.**

---

# 25. Responsive and Viewport Architecture

> **UX-220 — Desktop is the primary environment. 100% is the baseline; 80% on a 19-inch monitor is first-class.**

| Surface | Narrower-desktop behaviour |
|---|---|
| **Sidebar** | ⚠ **Collapse behaviour is `NOT DEFINED BY SOURCE`.** Until designed, the sidebar retains its approved width |
| **Dashboard grid** | Reduces columns 4 → 2 → 1 (`UX-072`) |
| **Form** | Multi-column groups collapse to single column |
| **Detail page** | Key/value grid 2 → 1; right rail wraps below (`RULE 4.2`) |
| **Operational rows / tables / reports** | 🔴 **Scoped horizontal overflow. Never structural reflow** (`UX-060`) |

> **UX-221 — 🔴 No breakpoint pixel value is invented here** (`RULE 7.10`).
>
> ✅ **Exact breakpoint values are an implementation-level engineering choice with no business or design meaning, PROVIDED they honour `UX-060`, `UX-072` and `UX-052`.** **Those three rules constrain behaviour; the pixel at which it occurs does not carry architectural weight.**

> **UX-222 — Mobile and tablet ERP operation is NOT required by canonical business scope and is NOT designed** (`RULE 7.1`). 🔴 **No mobile navigation, no card transformation, no mobile application architecture.**

> **UX-223 — ⚠ Ordinary content must not inherit table behaviour.** **Prose, forms and narrative regions reflow normally and are never given the two-dimensional scrolling exception that structured operational data requires.**

---

# 26. Accessibility Interaction Requirements

> **UX-230 — 🔴 Visible keyboard focus is MANDATORY.**
>
> 🔴 **`DESIGN_CONSTITUTION.md` `RULE 6.0` records that focus indication is absent from the approved source — an outright AA gap.** ⚠ **Until a focus treatment is designed, the platform default must NOT be suppressed.** **This is a design-foundation task, not a UI implementation choice.**

> **UX-231 — Interaction requirements:** full keyboard navigation in logical order · semantic controls (a button is a `button`) · every input labelled and programmatically associated · **status never conveyed by colour alone** (`RULE 8.4`) · validation messages associated with their field · **accessible names on every icon-only action** · disabled distinguished from unavailable (`UX-112`) · **modal focus trapped and restored on close** · errors identified in text · content readable and operable under zoom.

> **UX-233 — ✅ REDUCED MOTION IS HONOURED, AND FUNCTIONALITY IS NEVER REDUCED WITH IT. Ratified 2026-08-11.**
>
> **Where the operator has expressed a reduced-motion preference, every ratified foundation motion treatment reduces or removes its animation** — **at minimum the sidebar disclosure, the chevron rotation and the routed page-content transition** (`DESIGN_CONSTITUTION.md` `RULE 3.21.b`).
>
> **a.** 🔴 **BEHAVIOUR IS IDENTICAL.** **Groups still open and close, routed pages still render, the chevron still points UP when closed and DOWN when open.** ⚠ **Only the animation goes. Nothing becomes unreachable, no control is removed and no state changes.**
> **b.** ✅ **A reduced-motion preference is a USER-PREFERENCE query, NOT a responsive breakpoint.** 🔴 **It creates, infers and implies no breakpoint, and `RULE 7.10` and `UX-221` are untouched by it.**
> **c.** ⚠ **Honouring it is not optional and not conditional on a component being "subtle enough".**

> **UX-232 — 🔴 Approved palette values are NEVER silently altered here.**
>
> ⚠ **Nine contrast pairs remain unmeasured** (`§8.3`), with **A11Y-01** (text-secondary at 11.5–13.5px), **A11Y-02** (faint and placeholder at 10–13px) and **A11Y-08** (light borders as UI boundaries) the highest risk. 🔴 **If a ratified pair fails when measured, that is a DESIGN-FOUNDATION correction, not a hidden UI override.**
>
> **Accessibility measurement is a required follow-up and remains open.**

---

# 27. Cross-Domain Navigation and Permission Behaviour

> **UX-240 — Cross-domain references navigate to the owning surface and never embed another module's editor** (`UX-021`).

> **UX-241 — Permission behaviour in the UI is an affordance layer over an authoritative backend** (`PRJ-120`).
>
> **Hide** where the permission is absent · **disable with a reason** where state forbids (`UX-112`) · **scope-filter** lists so an operator sees only their scope (`SYS-020`) · 🔴 **never rely on any of it as a control.**

> **UX-242 — Owner is not presented as an assignable role** (`AGV-037`, `AGV-039`). **Owner designation actions follow `AGV-038`: granted and revoked only by an existing Owner.**

---

# 28. UI/UX GAP Register

**Classified. No GAP is created where an existing one covers the issue, and none is created for thoroughness.**

| # | Finding | Class | Disposition |
|---|---|---|---|
| 1 | **Focus indication absent from approved source** | **D — missing design rule** | ✅ **Already `RULE 6.0`.** No new GAP |
| 2 | **Nine contrast pairs unmeasured** | **E — accessibility verification** | ✅ **Already `§8.3`.** No new GAP |
| 3 | **Modal, drawer, popover, toast had no source** | **B — UI/UX decision** | ✅ **RESOLVED here** (`UX-150`–`UX-152`) — usage only, no tokens |
| 4 | **Overflow access mechanism** | **B — UI/UX decision** | ✅ **RESOLVED here** (`UX-070`–`UX-073`), as `RULE 7.5` intended |
| 5 | **Sidebar collapse behaviour** | **D — missing design rule** | ⚠ **SPLIT 2026-08-11.** ✅ **Navigation GROUP folding is RESOLVED** (`UX-026`). 🔴 **Sidebar RAIL collapse to an icon strip remains `NOT DEFINED BY SOURCE`; the sidebar retains its approved width.** ⚠ **The two are different questions and were previously conflated** |
| 6 | **Quotation / Proforma** | **C — missing business rule** | 🔴 **`GAP-128` open.** No UI designed |
| 7 | **Breakpoint pixel values** | **G — implementation detail** | ✅ **Declared implementation-level** (`UX-221`) |
| 8 | **Production icon library** | **D — missing design rule** | ✅ **RESOLVED 2026-08-11** (`DESIGN_CONSTITUTION.md` `RULE 3.17.a`). **The Lucide outline icon set is ratified with a canonical semantic mapping; the binding geometry never changed.** ⚠ **Header glyph size and chevron size are recorded as IMPLEMENTATION SELECTIONS, not canonical geometry** (`RULE 3.17.c`) |
| 9 | **Mobile / tablet operation** | **F — future extension** | ⚠ Not required by canonical scope |
| 11 | **Authenticated LANDING DESTINATION — which surface an operator lands on after sign-in, and what `/` resolves to** | **B — UI/UX decision, NOT TAKEN** | 🔴 **OPEN. Requires an explicit business decision and is NOT resolved here.** ⚠ **`UX-030` archetype A describes the Dashboard's PURPOSE as orientation and pending work, and `UX-024` places it FIRST under MAIN — but neither states a default post-sign-in destination, and FIRST IN A SIDEBAR IS NOT A LANDING RULE.** 🔴 **Inferring one from navigation order would be exactly the invention `UX-006` forbids.** ⚠ **Reported because the running implementation currently resolves `/` to the Dashboard: that is an undecided area rather than a contradiction of any ratified rule, and it must not be read as ratification** (`DOC-080`) |
| 12 | **Global scrollbar chrome policy** | **D — missing design rule** | ✅ **RESOLVED 2026-08-11** (`DESIGN_CONSTITUTION.md` `§3.20`, `UX-074`). **Chrome suppressed, scrolling and discoverability both fully preserved** |
| 13 | **Foundation motion — sidebar disclosure and routed page content** | **D — missing design rule** | ⚠ **PARTIALLY RESOLVED 2026-08-11** (`DESIGN_CONSTITUTION.md` `§3.21`, `UX-029`, `UX-233`). 🔴 **Two named primitives only; every other motion class stays undefined and inherits nothing** |
| 10 | **Form and labelled-input visual patterns** | **D — missing design rule** | ✅ **RESOLVED 2026-08-11.** **`Form Design Language.dc.html` approved and ratified at `DESIGN_CONSTITUTION.md` `§3.18`.** **`UX-100`'s architecture — labels above inputs, required indication on the label, help text below, placeholders never replacing labels — is reproduced exactly by the approved reference; no interaction rule changed** |

> **UX-250 — 🔴 No new GAP is registered by this task.** **Every finding is either already registered, resolved here as a UI/UX decision, or an implementation detail.** ✅ **Finding 10 CLOSED 2026-08-11 — the approved form reference now fixes form VISUAL composition, and it matches `UX-100` without amendment.** ⚠ **Findings 5, 6 and 8 remain carried.**
>
> 🔴 **AMENDED 2026-08-11 by the global UI foundation ratification.** ✅ **Finding 8 is now CLOSED** — the production icon set is ratified. ✅ **Findings 12 and 13 are ADDED and immediately dispositioned** — the scrollbar policy resolved in full, foundation motion resolved for exactly two named primitives. 🔴 **Finding 11 is ADDED and left OPEN: the authenticated landing destination is a business decision that has not been taken, and it is recorded rather than inferred from navigation order.**
>
> ⚠ **Findings 5, 6 and 11 remain carried.** 🔴 **No entry in `GAP_ANALYSIS.md` is created, altered or closed by this amendment** (`DOC-078`) — **`GAP-004` in particular stays open and no dashboard KPI is authorised.**

---

# 29. Explicitly Not Invented

**Screens with no owning architecture · business rules, statuses, workflows, permissions, formulas · KPIs, metrics, trends, forecasts · Quotation/Proforma UI · document numbering · print approval · reprint watermark · mandatory Warranty Card · leave entitlement, quota, accrual, balance, carry-forward, half-day, hourly leave, certificates, sandwich rules, approval hierarchy · a density selector · compact/comfortable modes · breakpoint pixel values · mobile or tablet architecture · a field-level sync conflict UI · a generic correction workflow · a second authorisation step on finalisation · any visual token · any component library's design language.**

---

# 30. Implementation Boundary

> **UX-260 — This document defines component RESPONSIBILITIES conceptually and never becomes a component specification.**
>
> 🔴 **No React code, no CSS, no frontend folders, no component API, no state-management selection.** **React is selected by `TECHNOLOGY_ARCHITECTURE.md`; how it is written is `PROJECT_CONSTITUTION.md`'s.**

> **UX-261 — The server owns authoritative state; the client owns interaction state** (`PRJ-170`). 🔴 **Client state never becomes a second business database.**

---

# 31. Version History

| Version | Date | Change |
|---|---|---|
| **1.0.0** | **2026-08-10** | **Initial ratification. `UX-001` – `UX-261`.** **Owns interaction architecture and page composition ERP-wide; owns no visual token and no business rule.** ✅ **Resolves two deliberately-deferred design questions**: **the overflow access mechanism** (`RULE 7.5` left it here) **as per-surface-class behaviour with scoped horizontal overflow, pinned identity columns and a discoverability requirement**; and **modal/drawer/popover/toast usage** (`NOT DEFINED BY SOURCE`) **as usage discipline without inventing tokens.** ✅ **V1 surface inventory derived from canonical ownership** across 31 surfaces and ten archetypes. 🔴 **Solves the UI representation of ratified facts the approved mockups predate** — **`Assigned Agent` and `Confirmed By` kept distinct** (`UX-180`), **`AUTO_CONFIRMED` fabricating no human confirmer** (`UX-181`), **marketplace and ERP status as separate simultaneous facts** (`UX-182`), and **`API_MANAGED`/`ERP_MANAGED` expressed in business language with the takeover moment made legible** (`UX-183`, `UX-184`). 🔴 **Payroll finalisation is never presented as payment** (`UX-200`); **Final Settlement never presented as a consolidated receivable** (`UX-191`); **leave residue given no invented status** (`UX-203`). 🔴 **Zoom never changes information existence, page size or business behaviour; structured operational rows never structurally wrap; prose and forms never forced into nowrap.** ⚠ **Quotation and Proforma have no UI — `GAP-128` open.** ⚠ **Focus indication and nine contrast pairs reported, not silently fixed.** **No GAP registered; no business rule, status or design token created or altered.** |
| **1.0.1** | **2026-08-10** | 🔴 **`UX-011` SCOPE CORRECTED on design-foundation correction.** **v1.0.0 restated the design finding as an ERP-wide prohibition on any global application header; `DESIGN_CONSTITUTION.md` v2.2.0 establishes that this over-generalises from two reference screens.** ✅ **`UX-011` is now bounded to the APPROVED SURFACE CLASSES and defers to `RULE 4.1.a`/`RULE 4.1.b` REFERENCE FIDELITY BY SURFACE CLASSIFICATION** (`DOC-006` — reference, never restate). ⚠ **The superseded wording is retained inside the rule, not erased.** **The `64px` sidebar-brand-block resolution is unchanged, the page header remains a content-region pattern for every covered class, and an unreferenced class acquires nothing by preference.** **No other `UX-` rule altered. No surface added or removed. No business rule, visual token or GAP touched.** |
| **1.1.0** | **2026-08-11** | ✅ **FORM VISUAL AUTHORITY ARRIVED — minimal amendment only.** **`Form Design Language.dc.html` was approved 2026-08-11 and ratified into `DESIGN_CONSTITUTION.md` v2.5.0 `§3.18`.** ✅ **`UX-031` amended: archetype D (Create / Edit Form) joins B and C as fixed by an approved reference.** ✅ **UI/UX GAP finding 10 CLOSED — it was the one flagged as `worth watching`.** 🔴 **NO interaction rule changed. `UX-100`'s form architecture — labels above inputs, required indication on the label, help text below, placeholders never replacing labels — was already correct and the approved reference reproduces it exactly, which is why nothing in `§13` needed amending.** ⚠ **`RULE 3.18.g` keeps the reference's two-column grid a per-surface composition, so `UX-030`'s archetype-D page structure is untouched.** **No visual token defined here; no surface added or removed; no business rule or GAP touched.** |
| **1.1.1** | **2026-08-11** | ✅ **FACTUAL CURRENCY ONLY — no interaction or composition rule changed.** **`UX-150` opened with `These were NOT DEFINED BY SOURCE`, accurate when written and now only partly true: `DESIGN_CONSTITUTION.md` v2.6.0 `§3.19` ratifies the modal and the anchored action menu.** ✅ **The rule now states precisely which overlay classes have visual treatment and which do not — drawer, toast, tooltip and other popover classes remain undefined.** 🔴 **The `UX-150` usage table is untouched, no visual token is defined here, and `UX-113`'s business requirement that destructive and irreversible actions be confirmed remains BUSINESS-owned — the design reference supplies visual treatment and creates no confirmation requirement.** **No surface added or removed; no GAP touched.** |
| **1.2.0** | **2026-08-11** | ✅ **V1 SIDEBAR NAVIGATION RATIFIED from business decision — `UX-024`.** **Seven MAIN groups (Inventory, Purchasing, Sales & Orders, Finance & Accounting, HR & Payroll, CRM, Reports) and one ADMIN group, superseding the mockup taxonomy `UX-013` always declared non-canonical.** 🔴 **`UX-025` is the load-bearing safeguard: a navigation group creates NO domain, module, aggregate, transaction boundary or ownership authority — no `Sales` module, no `Finance` module or ledger, no `CRM` module, and no additional CRM capability may be inferred from the label; Payment and Accounting keep separate ownership.** ✅ **`UX-026` ratifies folding — collapsed and expanded states, simultaneous active parent and child, parent-as-disclosure-not-destination, and the disclosure affordance CONSUMING the existing approved caret with no new visual token. `UX-027` ratifies permission-sensitive child visibility, renders nothing for a fully-hidden group, and deliberately does NOT auto-flatten a single-child group — flattening would make the sidebar structurally different per operator. `UX-028` makes expansion state per-user CLIENT state that degrades to the active-group default.** 🔴 **Group folding is explicitly NOT sidebar RAIL collapse, which remains undefined; §28 finding 5 is split accordingly.** ✅ **`UX-032` defines the OPERATIONAL WORKSPACE composition and `UX-033` the Purchasing workspace — Purchases carries both Purchase Orders and Goods Receipts, which remain canonically separate records. `UX-187` defines the Orders workspace — lifecycle navigation, contextual fulfilment stages, sync exceptions and controls, then records — with NO sidebar entries for Pick & Pack, Shipments or Marketplace Sync, while picking, shipment and delivery remain Warehouse- and Delivery-owned facts.** ✅ **`UX-017` places Chat, Notifications and User/Profile in the page-header utility region exactly as the approved captures already show, creating no ERP-wide header rule and leaving `RULE 4.1` intact; Chat is NOT a sidebar destination.** 🔴 **`UX-007` corrects a real omission — the v1.0.0 30-row Surface Inventory was MISSING Chat and Customers, both canonical V1 modules; both are now listed and the original count is retained in history.** **No visual token defined. No business rule, permission, entity, state or GAP created or altered.** |
| **1.3.0** | **2026-08-11** | ✅ **FOLDING DISCLOSURE AMENDED on explicit business decision, after the running application was reviewed.** 🔴 **`UX-026.c` previously kept the ACTIVE group permanently expanded and stated that an active child is never hidden inside a collapsed group. In use that meant an operator could not collapse the module they were working in — the only way to close it was to navigate away, which is a defect rather than a protection.** ✅ **`UX-026.f` now gives disclosure to the operator: first activation opens, the next closes, including for the group owning the current page. A route change may auto-open the newly active group but must never re-open one the operator just deliberately closed.** ✅ **The protection that mattered is preserved differently — the active PARENT remains visually active while collapsed, so the owning navigation group is never lost, which is what `RULE 4.3.b`'s simultaneous active state exists to guarantee.** ⚠ **The superseded `UX-026.c` wording is retained verbatim inside the rule** (`DOC-009`). **No other `UX-` rule altered. No navigation destination, permission semantic, visual token, business rule or GAP touched — `DESIGN_CONSTITUTION.md` is NOT amended.** |
| **1.4.0** | **2026-08-11** | ✅ **`UX-024` AMENDED — `Dashboard` added as the FIRST direct destination under MAIN, on business decision after reviewing the running application.** 🔴 **Its absence from the v1.2.0 register was an OMISSION rather than a decision: `Dashboard` is the first row of the `§3` V1 Surface Inventory and archetype A in `UX-030`, so the surface was already ratified while its navigation entry was missing. The superseded register listing is retained** (`DOC-009`). ⚠ **This ratifies a DESTINATION only — no dashboard content, KPI, metric or figure is authorised; `GAP-004` remains open and `UX-080`–`UX-082` still govern composition.** **Like `Reports`, `Dashboard` takes no children and no disclosure control. No other destination, permission semantic, business rule, GAP or design token changed; `DESIGN_CONSTITUTION.md` NOT amended.** |
| **1.5.0** | **2026-08-11** | ✅ **GLOBAL UI FOUNDATION RATIFIED — one bounded post-freeze amendment** (`DOC-079`), **from explicit business decision after the running application was reviewed. Companion to `DESIGN_CONSTITUTION.md` v2.7.0, which owns every visual value; nothing visual is restated here** (`UX-002`, `DOC-006`). ✅ **NEW `UX-018` — THE GLOBAL APPLICATION-SHELL FOUNDATION. ONE shell: fixed brand region, independently scrollable navigation region, fixed authenticated-user identity card, with ONLY the navigation region scrolling. It enumerates the ten foundation concerns declared once and INHERITED BY CONSTRUCTION — scroll treatment, page transition, disclosure behaviour and motion, chevron, icon system, active-navigation hierarchy, brand, header utilities, identity card and reduced motion — and forbids a module reimplementing any of them. Module-level deviation requires governed authority, not an implementation-time decision.** ✅ **`UX-015` AMENDED — identity-card composition ratified: fixed bottom region, canonical session facts only, and 🔴 a title is NEVER fabricated. Where the session exposes no designation the line is ABSENT; authoritative role data may stand in its place; a demonstration identity from a design capture never reaches the product. It creates no identity semantic and never competes with the header User/Profile utility.** ✅ **`UX-017` AMENDED — header utility icon semantics ratified as ONE shared implementation, citing the `§3.17` mapping rather than restating it, with 🔴 NO fabricated unread count, badge, dot or state until canonical business data drives it. Ratifying the cluster builds no Chat and no Notification module.** ✅ **`UX-026` AMENDED — `e` now consumes the ratified outline chevron with its business-approved direction (FOLDED UP / UNFOLDED DOWN, owned by `RULE 3.17.b`); the superseded caret wording is retained verbatim** (`DOC-009`). **New `g` binds disclosure motion to `RULE 3.21` and states that motion never delays the state change; new `h` requires ONE folding implementation for every group. ✅ A confirmation clause records what operator-controlled folding does NOT weaken: zero-visible-child suppression, single-child groups staying grouped, permission-aware visibility as an affordance only with the backend refusing regardless, and the parent never becoming a destination. 🔴 The `d`/`e`/`f` sub-item ordering was also corrected — a v1.3.0 editing defect had placed `f` before `e`; no wording was removed.** ✅ **NEW `UX-029` — the routed page-content transition boundary: declared once so every module inherits it, 🔴 the stable shell never transitions, navigation is never delayed, and no data, request or state depends on it.** ✅ **NEW `UX-034` — the authentication surface presentation: `Welcome To TrioLoo` / `Login to start work`, brand consumed from the single source, layout kept minimal with no slogan, illustration, hero or gradient. ⚠ Copy only — it creates no authentication behaviour and does not close the open authentication-composition item.** ✅ **NEW `UX-074` — 🔴 HIDDEN SCROLLBAR CHROME ≠ HIDDEN OVERFLOW DISCOVERABILITY. `UX-073` is STRENGTHENED, not weakened: with the native scrollbar suppressed the affordance becomes MANDATORY, and row invariance, the pinned identity column, scoped overflow, zoom rules and page-size rules are explicitly protected.** ✅ **NEW `UX-233` — reduced motion honoured with functionality identical; 🔴 recorded as a USER-PREFERENCE query and NOT a breakpoint, leaving `RULE 7.10` and `UX-221` untouched.** ✅ **`§28` register: finding 8 CLOSED, findings 12 and 13 added and dispositioned.** 🔴 **Finding 11 ADDED and left OPEN — the authenticated landing destination is a business decision that has NOT been taken, and `UX-030`'s orientation archetype plus `UX-024`'s first position do NOT constitute one. First in a sidebar is not a landing rule, and the running implementation's `/` → Dashboard redirect is reported as undecided, not ratified.** ⚠ **No navigation destination added or removed — `UX-024` is unchanged and `Dashboard` was already ratified at v1.4.0. No business rule, entity, state machine, event, permission, posting, module ownership or `GAP_ANALYSIS.md` entry touched; `GAP-004` stays open and no dashboard KPI is authorised. No visual token defined here.** |

**Amendment procedure.** Proposals state the business problem, the affected rules, the change, alternatives considered and the operational impact. ⚠ **If a change touches business behaviour, visual language or technology, the owning document is amended first.**

---

*This document specifies UI/UX interaction and composition architecture only. It contains no business rule, entity, permission, visual token, code, schema or component implementation, and it never overrides canonical architecture.*
