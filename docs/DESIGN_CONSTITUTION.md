# Design Constitution

**Status:** Ratified · **Version:** 2.15.0 · **Applies to:** All user-facing surfaces of the ERP platform
**Reconciled:** 2026-08-10 against the approved TrioLoo Design Language · **Amended:** 2026-08-10 (accessibility MEASURED — Article VIII; production visual fidelity — `RULE 4.1` scope corrected) · **Amended:** 2026-08-10 (`A11Y-08b` per-control-class ruling; adjacency correction) · **Amended:** 2026-08-11 (final ratification pass — `RULE 8.10` self-identifying content; grey text tiers resolved) · **Amended:** 2026-08-11 (**FORM DESIGN LANGUAGE RATIFIED** — §3.18; `A11Y-08b` CLOSED) · **Amended:** 2026-08-11 (**OVERLAY & DESTRUCTIVE RATIFIED** — §3.19; `RULE 3.6` and `RULE 3.3.b` amended) · **Amended:** 2026-08-11 (**GLOBAL UI FOUNDATION RATIFIED** — §3.20 scroll surfaces; §3.21 motion; §3.17 production icon set; the omitted nav-label token; `RULE 3.7.a`, `RULE 3.7.b`) · **Amended:** 2026-08-11 (**ENTITY-CLASS TABS resolved by REUSE** — `RULE 3.13.a`; status-carrier boundary `RULE 3.14.a`; thumbnail composition `RULE 3.15.a`) · **Amended:** 2026-08-12 (**FINAL GLOBAL UI FOUNDATION** — `RULE 3.11.c`, `RULE 3.22`) · **Amended:** 2026-08-12 (**FINAL GLOBAL UI DELTA** — `RULE 3.8.a`, `RULE 3.17.d`) · **Amended:** 2026-08-13 (**`RULE 3.15.a` image data model released to Product `§38`** — geometry and empty treatment unchanged) · **Amended:** 2026-08-15 (**GLOBAL VISUAL FOUNDATION CORRECTION** — `RULE 3.4.a` workspace ground; `RULE 3.6.c` ordinary elevation; `RULE 3.8.a.b` identity control; `RULE 6.0.c` neutral focus) · **Amended:** 2026-08-15 (**GLOBAL SHELL POLISH** — `RULE 3.8.a.c` account card; `RULE 3.11.d` compact header action; `RULE 3.7.c` brand hierarchy; `RULE 3.21.d`–`.f` motion scale; `RULE 3.17.b` direction corrected) · **Amended:** 2026-08-15 (**`RULE 3.6.d`** — editability is never a container treatment) · **Amended:** 2026-08-15 (**`RULE 3.3.d`** — the semantic role axis; `RULE 3.14.a.b` superseded)

---

## Preamble

This document is the permanent design authority for this project. It is not a style guide, a mood board, or a suggestion. It is the specification that every screen, component, and pull request is measured against.

> **🔴 v2.0.0 is a full visual replacement.** The 2026-08-04 direction — **Inter** typography and an **orange `#FF7A00`** accent — is **superseded in whole**. Its reference captures no longer exist. Every visual token below is derived from the approved Claude Design source. **Enduring governance principles from v1.x are retained; obsolete visual tokens are not.**

---

# Article I — Authority, Scope and Source Precedence

## 1.1 Purpose

This Constitution governs the **reusable visual language and interaction presentation** of the ERP. It exists so that thirty screens across twenty modules look and behave as one product.

## 1.2 Scope

**ERP-wide.** Dashboard · Sales & Orders · Products · Inventory · Procurement · Warehouse · Delivery · Returns & Exchange · Warranty · Trade-In · Accounting · Payment · HR & Payroll · Attendance · Leave · Employee Loan · Final Settlement · Users · Roles & Permissions · Notifications · Reports · Settings.

> **RULE 1.2 — Order Dashboard and Order Details are REFERENCE IMPLEMENTATIONS of the visual language, not the extent of it.** ⚠ **No module may invent its own visual language.** A module that needs a pattern this document does not have amends this document; it does not fork it.

## 1.3 Source precedence — visual questions only

| # | Source | Authority |
|---|---|---|
| **1** | **`Design Language.dc.html`** | **PRIMARY for exact tokens and explicit visual rules** |
| **2** | **`Order Dashboard.dc.html`** | **PRIMARY validation for list-page composition and real component usage** |
| **3** | **`Order Details.dc.html`** | **PRIMARY validation for detail-page composition and real component usage** |
| **3b** | **`Form Design Language.dc.html`** | ✅ **APPROVED 2026-08-11. PRIMARY authority for the FORM surface class** — labelled field, text input, select, and their rest / focus / filled / error / disabled states, demonstrated on BOTH `#FFFFFF` and the app background |
| **3c** | **`Overlay & Destructive Design Language.dc.html`** | ✅ **APPROVED 2026-08-11. PRIMARY authority for the OVERLAY surface class and DESTRUCTIVE ACTION treatment** — dialog scrim, overlay panel, overlay elevation, confirmation dialog, anchored action menu, destructive button and destructive menu row. ⚠ **It defines ONLY the surfaces it demonstrates** |
| **4** | **`docs/design-reference/*.png`** | **Visual verification references** |
| **5** | **This Constitution** | **Governance and reconciliation target** |

**Claude Design project:** `e56dcf10-69d0-4879-8fb8-6f8099bbdd3b`.

> **RULE 1.3.a — Where source states an exact value, that value is used verbatim.** ⚠ **Never approximated from a screenshot raster.** A PNG is a scaled capture; it confirms composition, not dimensions.
>
> **RULE 1.3.b — Where no approved source establishes a value, this document records `NOT DEFINED BY SOURCE` and states a governance principle only.** **Nothing is invented to fill a gap.**

## 1.4 🔴 Business-architecture boundary — absolute

> **RULE 1.4 — The design sources are authoritative for VISUAL DESIGN ONLY.**

**They are NOT authoritative for:** module ownership · business entities · workflows · state machines · permissions · accounting behaviour · order lifecycle · HR or payroll rules · financial rules · field ownership · API authority · domain terminology.

⚠ **Mockup sample data is not evidence of a business rule.** A navigation label, a status name or a field in a mockup that conflicts with canonical architecture is a **visual pattern to keep and a business claim to discard.** **Canonical architecture wins, silently and always.**

**Recorded conflicts and omissions are at Article XXVI.**

---

# Article II — Core Visual Philosophy

**Enduring principles. These survive any future reference replacement.**

1. **Neutral surfaces dominate.** The application is white cards on a near-white ground. Colour is earned, not applied.
2. **Dark carries action emphasis.** One near-black ink is the accent, the primary button, the active segment and the active page.
3. **Semantic colour is reserved for state meaning.** ⚠ Amber, green, blue and red mean *status*. They are never decoration.
4. **Typography and spacing establish hierarchy before colour does.**
5. **Borders are preferred over shadows.** Elevation is a whisper, not a device.
6. **Cards group information; they do not decorate empty space.**
7. **Operational screens stay dense but scannable.** This is a tool used for twelve-hour shifts, not a landing page.
8. **Monetary information requires deliberate hierarchy** — primary figures emphasised, secondary figures demoted.
9. **IDs and reference codes use monospace.** **Monetary values use tabular numerals.**
10. **One component language across every module.**
11. **Desktop operational efficiency is a first-class requirement.**

> **RULE 2.0 — Distinguish DESIGN PRINCIPLES from DESIGN TOKENS.** **Principles above are durable. Tokens in Article III are source-derived and replaceable.** A reference replacement changes tokens; it rarely changes principles.

---

# Article III — Design Token Matrix

**Every row is traceable. `DL` = `Design Language.dc.html` · `OD` = `Order Dashboard.dc.html` · `ODT` = `Order Details.dc.html`.**

**Legend:** ✅ **EXACT** = literal source value · ⚠ **COMPOSITION** = structural guidance verified in source/screenshot · 🔴 **UNDEFINED** = `NOT DEFINED BY SOURCE`.

## 3.1 Typography

| Token / Property | Exact Value | Source | Selector / Location | Scope | Notes |
|---|---|---|---|---|---|
| Font family | `'Manrope', system-ui, sans-serif` | ✅ DL, OD, ODT | root container `font-family` | Global | Google Fonts `family=Manrope:wght@400;500;600;700;800&display=swap` |
| Font weights | `400 · 500 · 600 · 700 · 800` | ✅ DL | `<link>` href | Global | No other weight is loaded or permitted |
| Monospace family | `ui-monospace, monospace` | ✅ DL | ID sample | IDs, SKUs, tracking, invoice no. | |
| Font smoothing | `-webkit-font-smoothing: antialiased` | ✅ DL, OD, ODT | `body` | Global | ODT/OD add `-moz-osx-font-smoothing: grayscale` |
| Page title | `25px / 800 / -0.02em`, line-height `32px` | ✅ DL + OD/ODT | `h1` | All pages | DL states 25/800/-0.02em; OD/ODT add line-height 32px |
| Design-language doc title | `32px / 800 / -0.02em` | ✅ DL | `h1` | Spec sheet only | ⚠ Not an app token |
| Card / section heading | `15.5px / 700` | ✅ DL, ODT | card header `h3` | Main-column cards | |
| Rail card heading | `14px / 700` | ✅ ODT | rail `h3` | Right-rail cards | Order summary uses `12.5px / 700` |
| Body | `14px / 400–500` | ✅ DL | body sample | Global | |
| Label / caption | `11.5–12px / 500`, muted | ✅ DL | label sample | Field labels, captions | |
| Monospace ID | `13px` | ✅ DL | ID sample | IDs and codes | |
| Subtitle (under title) | `13.5px` | ✅ OD, ODT | subtitle div | Page headers | |
| Detail field label | `11.5px` | ✅ ODT | grid label | Key/value grids | |
| Detail field value | `14px` | ✅ ODT | grid value | Key/value grids | |
| Rail row label | `13px` | ✅ ODT | Status/Financials rows | Right rail | |
| KPI label / qualifier | `10.5px` | ✅ OD | KPI card | KPI cards | ⚠ See A11Y-02 |
| KPI value | `19px / 800 / -0.02em`, line-height `24px` | ✅ OD | KPI value | KPI cards | tabular-nums |
| Sidebar section label | `10px / 700 / 0.07em`, uppercase | ✅ OD, ODT | `Main` / `Admin` | Sidebar | |
| Sidebar nav label | `12.5px / 500` inactive · `12.5px / 700` active | ✅ OD, ODT | nav row span | Sidebar | |
| Sidebar child label | `12px / 600` | ✅ OD, ODT | child row span | Sidebar | |
| Sidebar user name / role | `12px / 600` · `10.5px` | ✅ OD, ODT | user block | Sidebar | |
| Brand wordmark | `15px / 800 / -0.01em` | ✅ OD, ODT | brand span | Sidebar | |
| Button text — DL spec | `13px`, primary `700`, secondary `600`, ghost `400` | ✅ DL | button samples | Global | |
| Button text — page header | `13.5px`, secondary `600`, primary `700` | ✅ OD | header buttons | Page headers | ⚠ Header buttons are the larger variant |
| Status badge text | `12px / 600` | ✅ DL, OD, ODT | badge span | Global | |
| Segmented control text | `13px`, active `600`, inactive `500` | ✅ DL, OD | segment span | Global | |
| Status tab text (list) | `12px / 600` | ✅ OD | status tab | List pages | |
| Detail tab text | `13.5px / 600` | ✅ ODT | tab button | Detail pages | |
| Pagination text | `13px`; active page `700` | ✅ OD | pagination | List pages | |
| Numeric presentation | `font-variant-numeric: tabular-nums` | ✅ DL, OD, ODT | all money | Global | **Mandatory on every monetary value** |
| Line height (body) | 🔴 **NOT DEFINED BY SOURCE** | — | — | — | Only title line-heights are given |
| Letter spacing (body) | 🔴 **NOT DEFINED BY SOURCE** | — | — | — | Defined only for titles, brand, section labels |

## 3.2 Colors — core

| Token / Property | Exact Value | Source | Selector / Location | Scope | Notes |
|---|---|---|---|---|---|
| Ink / accent | `oklch(0.2 0 0)` | ✅ DL | swatch "Ink / accent" | Primary action, active states, links | **The single accent** |
| Surface | `#FFFFFF` | ✅ DL | swatch "Surface" | Cards, sidebar, inputs | |
| App background | **`oklch(0.968 0.003 290)`** = `#F4F4F6` | ✅ DL + **v2.12.0** | swatch "App background" | Page ground | 🔴 **AMENDED v2.12.0 — `RULE 3.4.a`.** ⚠ **Superseded: `oklch(0.985 0.004 290)` = `#FAFAFB`** |
| Border | `oklch(0.93 0.006 290)` | ✅ DL | swatch "Border" | Card and shell borders | |
| Text primary | `oklch(0.24 0.02 290)` | ✅ DL | swatch "Text primary" | Values, body | |
| Text secondary | **`oklch(0.543 0.015 290)`** | ✅ DL + **v2.12.0** | swatch "Text secondary" | Labels, captions | ⚠ See A11Y-01. 🔴 **DARKENED v2.12.0 to HOLD `A11Y-01b` against the deeper ground.** ⚠ **Superseded: `oklch(0.55 0.015 290)`** |
| Base text (root) | `oklch(0.22 0.02 290)` | ✅ DL, OD, ODT | root `color` | Inherited default | |
| Heading ink | `oklch(0.18 0.02 290)` | ✅ OD, ODT | `h1`, `h3` | Headings, KPI values | |
| Muted text | `oklch(0.5 0.015 290)` | ✅ OD, ODT | subtitles, rail labels | Secondary UI text | |
| Demoted text | **`oklch(0.568 0.012 290)`** | ✅ OD | list metric micro-labels | Demoted labels | 🔴 **AMENDED v2.4.0** (`RULE 8.14`). **Was `oklch(0.6 0.012 290)` = `3.96`; now `4.51`.** ✅ **Still lighter than Text secondary `0.55`, so the `§3.15` demotion survives** |
| Sidebar section label | `oklch(0.55 0.015 290)` | ✅ OD, ODT | `MAIN`, `ADMIN` | Sidebar | 🔴 **AMENDED v2.4.0.** **Source uses `oklch(0.65 0.01 290)` = `3.24`.** ✅ **Mapped to the EXISTING Text-secondary token — `OD`'s `FILTER` label is the same object and already uses it.** `4.87` |
| Sidebar user-block role | `oklch(0.5 0.015 290)` | ✅ OD, ODT | role line under the name | Sidebar | 🔴 **AMENDED v2.4.0.** **Source uses `oklch(0.6 0.012 290)` = `3.63` on the user block.** ✅ **Mapped to the EXISTING Muted token — it is a subtitle, and every page subtitle already uses Muted.** `5.52` |
| Placeholder | **`oklch(0.568 0.01 290)`** | ✅ OD, ODT | `::placeholder` | Inputs | 🔴 **AMENDED v2.4.0** (`RULE 8.14`). **Was `oklch(0.65 0.01 290)` = `3.24`; now `4.51`.** ⚠ **A separate token from Demoted text; they merely coincide at the AA floor for text on white** |
| Primary action hover | `oklch(0.28 0 0)` | ✅ OD | `style-hover` primary | Buttons | |
| Secondary border | `oklch(0.75 0 0)` | ✅ DL, OD, ODT | secondary button | Buttons, row actions | |
| Secondary text | `oklch(0.25 0 0)` | ✅ DL, OD, ODT | secondary button | Buttons | |
| Secondary hover | `oklch(0.94 0 0)` | ✅ OD, ODT | `style-hover` secondary | Buttons | |
| Input / control border | `oklch(0.9 0.006 290)` | ✅ DL, OD | inputs, selects, segments | Controls | |
| Inner divider | `oklch(0.95 0.004 290)` | ✅ OD, ODT | card header rule, brand rule | Cards, sidebar | |
| Light divider | `oklch(0.96 0.004 290)` | ✅ OD, ODT | list row rules, timeline | Rows | |
| Vertical divider | `oklch(0.91 0.006 290)` | ✅ OD, ODT | header separator | Header | |
| Nav hover | `oklch(0.97 0.004 290)` | ✅ OD, ODT | `style-hover` nav | Sidebar | |
| Sidebar nav label — inactive | **`oklch(0.4 0.015 290)`** | ✅ OD, ODT | nav row label span | Sidebar | 🔴 **RATIFIED v2.7.0 — a TRANSCRIPTION OMISSION, not a new value.** **`OD` sets it on every inactive nav row; `§3.1` already transcribed the SIZE and WEIGHT of that same span while its colour was dropped.** ✅ **Measured `9.25` on white · `8.85` on the app background · `8.47` on nav hover — AAA. No accessibility consequence** |
| Sidebar nav label — active | `oklch(0.2 0 0)` | ✅ OD, ODT | active nav row label span | Sidebar | ⚠ **NOT a new token — it is the Ink row above.** 🔴 **Recorded EXPLICITLY because it is a known implementation trap: Heading ink `oklch(0.18 0.02 290)` is a different token and is not the active nav label** |
| Nav active (parent) | `oklch(0.93 0 0)` | ✅ OD, ODT | active nav row | Sidebar | 🔴 **Neutral. The orange rail is gone.** **Semantic use fixed by `RULE 3.7.a`** |
| Nav active (child) | `oklch(0.95 0 0)` | ✅ OD, ODT | active child row | Sidebar | **Semantic use fixed by `RULE 3.7.a`** |
| User block surface | `oklch(0.97 0.004 290)` | ✅ OD, ODT | sidebar footer | Sidebar | |
| Tab container surface | `oklch(0.96 0.004 290)` | ✅ ODT | detail tab strip | Detail pages | |
| Zebra / footer strip | `oklch(0.98 0.002 290)` | ✅ OD, ODT | card footer, items total | Cards | |
| Icon stroke (nav) | `oklch(0.6 0.012 290)` | ✅ OD, ODT | nav icon border | Sidebar | ✅ **RETAINED UNCHANGED** (`RULE 8.14.a`). **Non-text: needs 3:1, measures `3.96`.** 🔴 **This value survives ONLY in its icon-stroke role — it is no longer a text colour** |
| Icon stroke (header) | `oklch(0.48 0.015 290)` | ✅ OD, ODT | utility icons | Header | |
| Positive / margin | `oklch(0.38 0.1 155)` | ✅ OD, ODT | margin values | Financial | Same as success fg |
| Notification dot | `oklch(0.55 0.22 25)` | ✅ OD, ODT | bell indicator | Header | |
| Avatar ring | `oklch(0.55 0 0)` | ✅ OD, ODT | `box-shadow 0 0 0 2px` | Header avatar | |
| Link | `oklch(0.2 0 0)` | ✅ DL, OD, ODT | `a` | Global | ⚠ DL underlines; OD/ODT do not — see 3.2.a |
| Link hover — app | `oklch(0.4 0.18 300)` + underline | ✅ OD, ODT | `a:hover` | App screens | **The only chromatic non-status colour** |
| Link hover — DL sheet | `oklch(0.4 0 0)` | ✅ DL | `a:hover` | Spec sheet only | ⚠ Differs from app |
| Inline action link | `oklch(0.42 0.14 250)` | ✅ OD | bulk-action links | Bulk bar | Same as info fg |

> **RULE 3.2.a — Link underline differs between sources.** **`DL` sets `text-decoration: underline` at rest; `OD`/`ODT` set `none` at rest and underline on hover.** ✅ **The screen files govern in-application links** (precedence 2–3 for composition): **no rest underline, underline on hover.** **DL's underline is a spec-sheet reading style.**

## 3.3 Colors — semantic status

**Soft background, darker foreground, pill shape. Verbatim from `DL`, confirmed identically in `OD` and `ODT`.**

| Status | Background | Foreground | Source | Applied to |
|---|---|---|---|---|
| **Pending — amber** | `oklch(0.95 0.06 85)` | `oklch(0.42 0.11 85)` | ✅ DL/OD/ODT | Pending verification · Held by courier · Collected by intermediary |
| **Confirmed / Delivered — green** | `oklch(0.94 0.05 155)` | `oklch(0.38 0.1 155)` | ✅ DL/OD/ODT | Confirmed · Delivered |
| **Dispatched — blue** | `oklch(0.94 0.04 250)` | `oklch(0.42 0.14 250)` | ✅ DL/OD/ODT | Dispatched · In transit |
| **Cancelled — red** | `oklch(0.95 0.04 25)` | `oklch(0.48 0.16 25)` | ✅ DL/OD/ODT | Cancelled |
| **Neutral — gray** | `oklch(0.95 0.004 290)` | `oklch(0.45 0.01 290)` | ✅ DL/OD/ODT | Fallback · Marketplace-owned |

| KPI accent | Value | Source | Notes |
|---|---|---|---|
| Info | `oklch(0.5 0.16 250)` | ✅ OD | Tile fill at `/ 0.12` |
| Warning | `oklch(0.55 0.13 85)` | ✅ OD | |
| Neutral | `oklch(0.2 0 0)` | ✅ OD | |
| Success | `oklch(0.45 0.12 155)` | ✅ OD | |
| Tile background | accent at `/ 0.12` alpha | ✅ OD | `k.color.replace(')', ' / 0.12)')` |
| Sparkline bar | accent, `opacity 0.75` | ✅ OD | |

> **RULE 3.3.a — The five status pairs are a closed set.** ⚠ **A new status maps to an existing pair or amends this Constitution. It does not introduce a sixth colour.**
>
> **RULE 3.3.b — Semantic colour never decorates.** **Amber means attention, green means settled, blue means in-flight, red means terminated.** ⚠ **Using any of them for emphasis, branding or chart variety is prohibited.**
>
> ✅ **AMENDED 2026-08-11 — the principle above is UNCHANGED and the original wording is retained verbatim.** **What is added is a NARROW, ENUMERATED exception.**

> **RULE 3.3.c — ✅ CANONICAL RED ALSO CARRIES DESTRUCTIVE ACTION SEMANTICS. This is not decoration.** 🔴 **`oklch(0.48 0.16 25)` is permitted in EXACTLY THREE placements, all demonstrated by the approved overlay reference, and NOWHERE ELSE:**
>
> **1.** **The FILL of a destructive confirmation action** — the button that commits the irreversible act.
> **2.** **The TEXT of a destructive row in an action menu**, with `oklch(0.95 0.04 25)` as that row's hover fill.
> **3.** **The OUTLINE MARKER beside a destructive dialog title.**
>
> 🔴 **PROHIBITED, without exception:** **a red panel · a red scrim · a red panel border · red body text · a red Cancel or decline action · red for emphasis, branding, chart variety or hierarchy · red on a warning that carries no canonical destructive meaning · red as an ordinary primary action.**
>
> ⚠ **The test is the ACTION'S semantics, not the designer's wish to draw attention.** **If the action does not destroy or irreversibly terminate something, it is not destructive and it is not red.** ✅ **`RULE 3.3.b` continues to govern the five STATUS pairs; this rule governs one ACTION treatment. They do not overlap.**
>
> **RULE 3.3.d — ✅ THE FIVE PAIRS CARRY A SEMANTIC ROLE AXIS, AND EVERY MEANINGFUL STATE AND MESSAGE USES IT. Ratified 2026-08-15.**
>
> **`RULE 3.3.b` already assigns these hues their meanings — amber attention, green settled, blue in-flight, red terminated.** ✅ **What was missing was a name for the ROLE rather than for the order status, and a rule obliging a surface to use it.** 🔴 **NO SIXTH PAIR, NO NEW HUE AND NO SECOND PALETTE IS CREATED** (`RULE 3.3.a`).
>
> | Role | Resolves to | Carries |
> |---|---|---|
> | **`success`** | the CONFIRMED pair | settled, healthy, connected, completed, authorised |
> | **`warning`** | the PENDING pair | needs attention, partial, suspended, reauthorisation required |
> | **`danger`** | the CANCELLED pair | failed, blocked, rejected, errored |
> | **`info`** | the DISPATCHED pair | informational emphasis where no success, warning or failure meaning exists |
> | **`neutral`** | the NEUTRAL pair | ordinary, unremarkable, draft, inactive, archived, not connected |
>
> **a.** ✅ **EVERY CHIP, BADGE OR PILL THAT REPRESENTS A MEANINGFUL BUSINESS OR SYSTEM STATE TAKES THE ROLE ITS MEANING DESERVES.** ⚠ **A state is chosen by what it MEANS, never by what it resembles** (`RULE 3.14.a.a`).
> **b.** ✅ **EVERY MEANINGFUL OPERATIONAL MESSAGE TAKES A ROLE TOO** — **a notice, callout, validation message, system feedback or piece of guidance the operator must understand or act on.** 🔴 **ORDINARY DESCRIPTIVE AND HELPER TEXT DOES NOT.** ⚠ **Colouring every paragraph would make the colour mean nothing.**
> **c.** 🔴 **A CONTROL THAT MERELY LOOKS LIKE A CHIP TAKES NO ROLE.** **A filter selector, a removable search token, a category selector or a navigational pill is NOT a state and stays neutral** — **assigning it a colour would announce a significance it does not have.**
> **d.** ✅ **`neutral` IS A REAL ANSWER, NOT THE ABSENCE OF ONE.** ⚠ **`DRAFT`, `Not connected` and `ARCHIVED` are neutral BECAUSE they are unremarkable; colouring them would misinform exactly as surely as coluring a failure green.**
> **e.** 🔴 **COLOUR REINFORCES MEANING AND NEVER DECORATES** (`RULE 3.3.b`, unchanged). **Using a role for emphasis, branding, chart variety or to distinguish categories from one another remains PROHIBITED.**
> **f.** 🔴 **RESTRAINT IS PART OF THE RULE.** **A soft tint, restrained coloured text, and a 1px boundary or dot where useful.** ⚠ **PROHIBITED: a fully saturated chip fill · a neon value · a large coloured panel · a gradient · a decorative rainbow status system.** ✅ **The product remains black and white dominant; these are SUPPORTING SIGNALS.**
> **g.** 🔴 **COLOUR IS NEVER THE SOLE CARRIER** (`RULE 8.4`, SC 1.4.1). **A chip always pairs its role with a WORD; a message always names its condition in words.** ⚠ **Every message must survive being read in monochrome.**
> **h.** 🔴 **ONE SHARED IMPLEMENTATION, NEVER A PAGE-LOCAL COLOUR.** **A surface names the ROLE and takes what the role resolves to.** ⚠ **A raw semantic colour hard-coded into a feature is a defect, because it silently forks the palette and cannot be corrected centrally.**
>
> ✅ **THIS BINDS FUTURE WORK.** **Every future Design feature pack and every implementation follows this rule: Design chooses the exact visual composition; implementation REUSES the shared semantic tokens and primitives and never invents a page-specific colour.**

> **RULE 3.3.c — OKLCH is the canonical form.** ⚠ **A hex approximation may be recorded as a convenience but never replaces the source token.**

## 3.4 Spacing

| Token | Exact Value | Source | Notes |
|---|---|---|---|
| Base unit | `4px` | ✅ DL | "Spacing unit: 4px base" |
| Common gaps | `4 · 6 · 10 · 12 · 14 · 16 · 20 · 24px` | ✅ DL | Stated scale |
| Observed additional | `1 · 2 · 8 · 9 · 18 · 22 · 26 · 32 · 48 · 56 · 64px` | ✅ OD/ODT/DL | Used in shell, cards and padding |

> **RULE 3.4 — The 4px base governs new work.** **Values outside the common set exist in source for specific components and are recorded in their component rows; they are not licence for arbitrary spacing.**

> **RULE 3.4.a — ✅ THE WORKSPACE GROUND IS ONE RESTRAINED STEP DEEPER THAN THE CONTENT SURFACE. Ratified 2026-08-15.**
>
> 🔴 **THE SEPARATION MECHANISM IS GROUND CONTRAST, NOT SHADOW.** **A white content surface is told apart from the page because the PAGE is darker, not because the surface is lifted.** ⚠ **At the superseded `oklch(0.985 0.004 290)` the two differed by `1.02` measured — effectively nothing — so every card, row and section relied on its `1px` border alone and the workspace read as one undifferentiated white field.**
>
> **a.** ✅ **The ground is `oklch(0.968 0.003 290)`, rendering `#F4F4F6`.** **Measured: a `#FFFFFF` surface separates from it by `1.10`, and the standard card border separates from it by `1.12`.**
> **b.** 🔴 **ORDINARY CONTENT SURFACES REMAIN `#FFFFFF` AND ARE NOT TINTED TO COMPENSATE.** **Cards, list rows, panels, form sections, detail sections, readiness and lifecycle cards, filter and search containers and table rows all stay white** (`§3.2`).
> **c.** 🔴 **THE GROUND IS NEVER DEEPENED FURTHER TO INCREASE SEPARATION.** ⚠ **This is a light, black-and-white-dominant, information-dense enterprise surface. A visibly grey workspace is a different product, and reaching for one would be a design decision through `§12.3`, never an implementation adjustment.**
> **d.** 🔴 **SEPARATION IS NEVER BOUGHT WITH SHADOW INSTEAD** (`RULE 3.6.a`, `RULE 3.6.c`). **Raising ordinary cards onto a visible elevation to make them stand out is prohibited: it produces floating dashboard tiles, and `RULE 3.6.b` already records that no shadow at any strength is component identification.**
> **e.** ⚠ **CONSEQUENCE MEASURED, NOT DISCOVERED LATER.** **Every text token was re-measured against the new ground. Exactly one pairing crossed a threshold — `A11Y-01b`, secondary text, `4.69 → 4.45` — and the TOKEN was darkened to restore it rather than the ground being reverted.** 🔴 **`A11Y-02`'s demoted text and placeholder were ALREADY below `4.5` on the superseded ground (`4.32` and `4.33`), are unchanged by this rule, and remain AA on `#FFFFFF` — the only surface either one appears on.**

## 3.5 Radius

| Tier | Exact Value | Source | Applies to |
|---|---|---|---|
| Controls | `7–9px` | ✅ DL | Segments `9px` · status tabs `7px` · detail tabs `9px` · buttons `9px` · inputs `9px` · pagination `9px` |
| Small cards | `10–12px` | ✅ DL | KPI card `12px` · status-tab container `10px` · user block `10px` · icon buttons `10px` |
| Panels | `14–16px` | ✅ DL | Order card `16px` · detail cards `16px` · Order summary `14px` |
| Pill | `999px` | ✅ DL/OD/ODT | Status badges only |
| Circle | `50%` | ✅ OD/ODT | Avatars |
| Header button | `10px` | ✅ OD/ODT | 40px page-header buttons |
| Brand mark | `8px` | ✅ OD/ODT | Sidebar logo |
| Thumbnail | `9px` list · `10px` detail | ✅ OD/ODT | Product thumbs |

## 3.6 Borders and shadows

| Token | Exact Value | Source | Notes |
|---|---|---|---|
| Standard border | `1px solid oklch(0.93 0.006 290)` | ✅ DL | Cards, sidebar edge |
| Control border | `1px solid oklch(0.9 0.006 290)` | ✅ DL/OD | Inputs, segments, pagination |
| Secondary button border | `1px solid oklch(0.75 0 0)` | ✅ DL/OD/ODT | Deliberately darker for affordance |
| Card shadow | `0 1px 2px oklch(0 0 0 / 0.03)` | ✅ DL/OD/ODT | The **only** card elevation |
| Active detail tab shadow | `0 1px 3px oklch(0 0 0 / 0.08)` | ✅ ODT | Raised segment |
| Avatar ring | `0 0 0 2px oklch(0.55 0 0)` | ✅ OD/ODT | |

> **RULE 3.6 — THREE elevations exist in the entire system, and no more.** ⚠ **No fourth elevation, no hover lift, no coloured shadow, no glow.**
>
> 🔴 **AMENDED 2026-08-11.** **Through v2.5.0 this rule read: `Two shadows exist in the entire system. ⚠ No third elevation, no hover lift, no coloured shadow, no glow.`** **That wording is SUPERSEDED and is retained here as the record.** ✅ **The two existing elevations are unchanged; a third is admitted for one strictly-scoped purpose.**

| # | Elevation | Value | Scope |
|---|---|---|---|
| **1** | **Card / contact** | `0 1px 2px oklch(0 0 0 / 0.03)` | Cards and panels sitting IN the page flow |
| **2** | **Active-detail / contact** | `0 1px 3px oklch(0 0 0 / 0.08)` | The white-raised active detail tab (§3.13) |
| **3** | ✅ **Detached overlay** — **NEW** | **`0 8px 24px oklch(0 0 0 / 0.1)`** | 🔴 **RATIFIED DETACHED OVERLAY SURFACES ONLY** — the confirmation dialog and the anchored action menu (§3.19) |

> **RULE 3.6.c — ✅ ORDINARY CARDS AND ROWS CARRY NO VISIBLE ELEVATION. Ratified 2026-08-15.** **A card, list row, panel, form section or summary tile is `#FFFFFF` + a `1px` neutral border + at most the contact elevation, on the deeper ground of `RULE 3.4.a`.** 🔴 **Increasing shadow to solve surface separation is prohibited** — **it produces floating SaaS tiles and stacked shadow cards, and `RULE 3.6.b` already records that no shadow is component identification.** ✅ **Shadow means *this surface is above the page*, which is true of a dropdown, row action menu, popover, dialog, profile menu and overlay, and false of a section.**

> **RULE 3.6.d — ✅ EDITABILITY IS NEVER A CONTAINER TREATMENT. Ratified 2026-08-15.**
>
> **A panel does not change its border, fill or elevation to say that its contents may be edited.** ⚠ **The defect this closes: a media-management surface drew its one editable column with a `1.5px` ink frame while its two read-only columns used the neutral border, so an ordinary capability was given the strongest treatment on the page.**
>
> **a.** 🔴 **ALL PEER PANELS SHARE THE SAME CONTAINER TREATMENT** — white surface, `1px` neutral border, no ordinary shadow — **whether their contents are editable, read-only or empty.**
> **b.** ✅ **EDITABILITY IS CARRIED BY WHAT THE OPERATOR READS AND USES:** **a section badge (`EDITABLE` / `READ ONLY`), helper text, and the PRESENCE OF CONTROLS.** ⚠ **A read-only panel has no controls at all, which is a stronger and more honest signal than a border.**
> **c.** 🔴 **THIS IS `RULE 3.6.c` AND `UX-269` APPLIED TO CAPABILITY RATHER THAN TO STATE.** **Neither business state NOR editability may claim the container; both live inside it.**

> **RULE 3.6.a — 🔴 The overlay elevation is STRICTLY SCOPED and is available to NOTHING ELSE.** **It must never be applied to cards, ordinary panels, dashboard widgets, form cards, list rows, page headers, KPI tiles, or any surface seeking visual emphasis.** ⚠ **Elevations 1 and 2 are CONTACT shadows at `1px` offset, for surfaces in the flow. Elevation 3 has offset and spread because it separates a surface that is NOT in the flow.**

> **RULE 3.6.b — 🔴 THE OVERLAY ELEVATION EXISTS FOR PERCEPTUAL DETACHMENT, NOT FOR ACCESSIBILITY. This is recorded precisely so it is never mis-cited.** ✅ **Measured: the card elevation peaks at `1.06` against white, the detail-tab elevation at `1.18`, and the overlay elevation at `1.23`.** 🔴 **NO shadow at any strength reaches 3:1, so a shadow is NEVER the visual information that identifies a component under SC 1.4.11** (`RULE 8.10`). **An overlay's identification comes from its scrim (dialog) or from its own content (menu) — never from its shadow.**
>
> 🔴 **DEFECT RECORDED 2026-08-10 — this table is INCOMPLETE.** **`Order Dashboard.dc.html`'s bulk-action-bar select declares `1px solid oklch(0.88 0.006 290)`, a THIRD control-boundary value that reconciliation missed.** ⚠ **It is recorded at `§8.4`, NOT silently added here and NOT normalised to `0.9`** — **whether the approved source intends two boundary values or three is a design question for `§12.3`.**

## 3.7 Sidebar

| Property | Exact Value | Source | Notes |
|---|---|---|---|
| Width | `216px`, `flex-shrink: 0` | ✅ OD/ODT + DL prose | 🔴 **216px is exact.** The PNG raster is a scaled capture |
| Surface | `#FFFFFF` | ✅ OD/ODT | |
| Right border | `1px solid oklch(0.93 0.006 290)` | ✅ OD/ODT | |
| Height | `100%`, column flex | ✅ OD/ODT | |
| Brand block height | `64px`, `flex-shrink: 0` | ✅ OD/ODT + DL | **This is the 64px the Design Language names** — see RULE 4.1 |
| Brand padding / gap | `0 16px` · `9px` | ✅ OD/ODT | |
| Brand bottom border | `1px solid oklch(0.95 0.004 290)` | ✅ OD/ODT | |
| Brand mark | `26 × 26px`, radius `8px`, `oklch(0.2 0 0)` | ✅ OD/ODT | |
| Nav padding | `10px 10px` | ✅ OD/ODT | Scrolls independently (`overflow-y:auto`) |
| Section label | `10px / 700 / 0.07em` upper, padding `0 8px`, margin `6px 0 5px` first / `14px 0 5px` after; colour **`oklch(0.55 0.015 290)`** | ✅ OD/ODT | 🔴 **Colour amended v2.4.0** (`RULE 8.14`) |
| Nav row | height `34px`, padding `0 8px`, radius `8px`, margin-bottom `1px`, gap `9px` | ✅ OD/ODT | |
| Nav icon | `15 × 15px`, `1.5px` stroke; active `2px` | ✅ OD/ODT | |
| Child row | height `28px`, `padding-left: 32px`, radius `7px`, margin `1px 0` | ✅ OD/ODT | No icon |
| Nesting depth | **Two levels** | ⚠ OD/ODT | Level 3 prohibited — see RULE 5.2 |
| User block | padding `8px`, margin `0 8px 10px`, radius `10px`, gap `8px`, avatar `26px`; name `oklch(0.2 0.02 290)`, role line **`oklch(0.5 0.015 290)`** | ✅ OD/ODT | Bottom-anchored by flex. 🔴 **Role colour amended v2.4.0** (`RULE 8.14`) |
| Sticky behaviour | Full-height flex column; nav scrolls, brand and user block fixed | ⚠ OD/ODT | Not `position: sticky` |
| Brand wordmark | **`TrioLoo`** — exact capitalisation | ✅ DL, OD, ODT | 🔴 **Added v2.7.0** — see `RULE 3.7.b` |
| Nav label colour | inactive `oklch(0.4 0.015 290)` · active `oklch(0.2 0 0)` | ✅ OD/ODT | 🔴 **Added v2.7.0.** Values live at `§3.2`; see `RULE 3.7.a` |
| Scroll regions | **The navigation region is the ONLY scrolling region** | ✅ OD/ODT | ⚠ **Its scrollbar CHROME is governed by `§3.20`.** Brand and user block never scroll |

> **RULE 3.7.a — ✅ THE ACTIVE GROUP AND THE SELECTED DESTINATION ARE DIFFERENT STATES AND NEVER RENDER ALIKE. Ratified 2026-08-11.**
>
> ⚠ **Both values already existed at `§3.2`. This rule ratifies their SEMANTIC USE; it creates no colour.**
>
> **a. ACTIVE PARENT GROUP** — fill `oklch(0.93 0 0)` · label `oklch(0.2 0 0)` at weight **700** · its module icon takes the `§3.17` ACTIVE treatment (ink at `2px`) · full `34px` row.
> **b. SELECTED CHILD DESTINATION** — fill `oklch(0.95 0 0)` · label `oklch(0.2 0 0)` at weight **600** · `28px` row indented to `32px` · 🔴 **no icon** (§3.7).
> **c. INACTIVE CHILD** — 🔴 **no background whatsoever.** **Label `oklch(0.4 0.015 290)` at weight 500.** ⚠ **A resting pill on every child destroys the selected state it is supposed to contrast with.**
>
> **d. 🔴 THE FILLS ALONE ARE NOT THE DISTINCTION, AND MUST NEVER BE RELIED ON AS ONE.** **Measured, the two fills differ by `1.062` and reach only `1.229` and `1.157` against white.** **Neither is a WCAG identification mechanism** — the same finding `RULE 3.6.b` records for shadows. ✅ **Identification is carried by WEIGHT, LABEL COLOUR, ROW HEIGHT, INDENTATION and ICON PRESENCE acting together, and the fill is reinforcement.**
>
> **e.** ⚠ **If a future surface needs a stronger COLOUR-level separation than `0.93` versus `0.95`, that is a new token and goes through `§12.3`.** 🔴 **It is not invented at implementation time.**

> **RULE 3.7.b — ✅ THE APPLICATION-DISPLAY BRAND IS `TrioLoo`. Ratified 2026-08-11 by business decision.**
>
> **Exact capitalisation — capital `T`, capital `L`.** 🔴 **`Trioloo`, `TRIOLOO` and `TrioLOO` are wrong wherever the shared application brand is presented**, which is the sidebar brand block, the authentication surface and the application title.
>
> ⚠ **This is PRESENTATION, and it governs nothing else.** 🔴 **It does not rewrite package identifiers, database or schema names, repository names, storage keys, historical records, or legal and company names that carry their own recorded spelling.**
>
> ✅ **One source, not many:** **the wordmark is stated once in the implementation and consumed everywhere.** ⚠ **A brand string retyped per surface is how a variant spelling reaches production.**

> **RULE 3.7.c — ✅ THE BRAND MARK IS SECONDARY TO THE OPERATOR WORKSPACE. Ratified 2026-08-15.**
>
> **The brand mark remains clearly identifiable but visually secondary to the operator workspace. Its rendered size is slightly reduced and its opacity softened, without decorative container or shadow.**
>
> **a.** ✅ **Sidebar `36px` rendered height, auth surface `45px` — roughly `10%` smaller.** ⚠ **Superseded: `40px` / `50px`** (`DOC-009`).
> **b.** ✅ **Opacity `0.86`.** 🔴 **HIERARCHY, NOT DISABLEMENT — lower values start to read as washed out or switched off, which is a different message entirely.**
> **c.** 🔴 **THE ARTWORK IS UNTOUCHED.** **Only rendered size and opacity change: the asset is not recreated, redrawn, cropped, recoloured or re-exported, and only `height` is declared so the `643 × 184` aspect ratio cannot be distorted.**
> **d.** 🔴 **NO DECORATIVE CONTAINER.** **No logo card, border, background panel, shadow, gradient or decorative line is added around the brand region** — **the existing hairline that separates the block from the navigation is kept and is not a container.**
> **e.** ✅ **GLOBAL.** **Both surfaces that show branding consume the one shared component; there is no page-specific logo styling anywhere.**

## 3.8 Page header

| Property | Exact Value | Source | Notes |
|---|---|---|---|
| Structure | **Inside `<main>`**, not a full-width bar | ⚠ OD/ODT | See RULE 4.1 |
| Layout | `flex`, `align-items: flex-start`, `justify-content: space-between`, gap `24px` | ✅ OD/ODT | OD `flex-wrap: nowrap`; ODT `wrap` |
| Bottom margin | `24px` (OD) | ✅ OD | ODT flows into tab strip at `26px` |
| Title | `25px / 800 / -0.02em`, line-height `32px` | ✅ OD/ODT | |
| Subtitle | `13.5px`, `oklch(0.5 0.015 290)`, `margin-top: 6px` | ✅ OD/ODT | |
| Action group gap | `14px` between clusters · `10px` within button pair · `6px` within utility | ✅ OD/ODT | |
| Header button | height `40px`, padding `0 18px`, radius `10px`, `13.5px` | ✅ OD/ODT | |
| Overflow icon button | `40 × 40px`, radius `10px`, border `oklch(0.9 0.006 290)` | ✅ ODT | |
| Utility icon button | `34 × 34px`, radius `10px`, no border, transparent | ✅ OD/ODT | Hover `oklch(0.96 0.004 290)` |
| Separator | `1px × 28px`, `oklch(0.91 0.006 290)` | ✅ OD/ODT | Between actions and utility |
| Avatar | `32 × 32px`, circle, `oklch(0.2 0 0)`, `11.5px / 700` white | ✅ OD/ODT | Ring `0 0 0 2px oklch(0.55 0 0)` |
| Notification dot | `7 × 7px`, `oklch(0.55 0.22 25)`, `1.5px` white border, `top 7px right 8px` | ✅ OD/ODT | |
| Global search | 🔴 **REMOVED** | ✅ DL | *"Search removed from header in the final direction — header now holds notifications + chat + avatar only."* |

> **RULE 3.8.a — ✅ FINAL HEADER UTILITY SURFACE. Ratified 2026-08-12. Amended 2026-08-12.**
>
> **Chat and Notifications use the compact white utility surface family:** `34 × 34px`, radius `10px`, `#FFFFFF` fill, no resting visible outer border and the existing card/contact elevation `0 1px 2px oklch(0 0 0 / 0.03)`. Their glyph remains inside that surface and every icon-only control keeps its accessible name. 🔴 **No unread badge, dot or count is created by this visual rule.**
>
> **User/Profile is deliberately NOT another white utility surface.** It is the authenticated identity control: **`36 × 36px`** *(🔴 **AMENDED v2.12.0**; ⚠ **superseded: `32 × 32px`**)*, circular, ink fill, white identity mark or initials, thin low-contrast visible resting border using the existing avatar-ring colour, and restrained contact elevation. 🔴 **No surrounding white pill, no white rectangular surface and no oversized container are introduced.** The resting border and the focus-visible indicator are different affordances; accessible focus remains mandatory and is never removed because the resting border exists.
>
> **RULE 3.8.a.c — ✅ THE ACCOUNT CARD IS THE GLOBAL IDENTITY TRIGGER. Ratified 2026-08-15. SUPERSEDES the avatar-only trigger.**
>
> **The header identity control is a COMPACT CARD: `[ avatar ] [ display name ] [ chevron ]`, on the white utility surface with the contact elevation, `999px` radius, `40px` tall.** ⚠ **Superseded: a bare `36px` avatar button with no name** (`DOC-009`).
>
> **a.** 🔴 **THE WHOLE CARD IS THE TRIGGER.** ⚠ **A `14px` chevron is not a hit target, and an operator reaching for their own account aims at their name.** **One button, `aria-haspopup="menu"` and `aria-expanded`.**
> **b.** 🔴 **THE DISPLAY NAME IS THE OPERATOR'S OWN NAME, NEVER AN IDENTIFIER.** **Full name where one exists, username as the fallback.** 🔴 **A UUID or internal database identity is NEVER rendered, and no name is ever hard-coded.**
> **c.** ⚠ **ONE LINE, AND IT TRUNCATES.** **The name ellipsises inside a `132px` maximum so the avatar and the chevron stay visible.** 🔴 **The header NEVER wraps because of who is signed in.**
> **d.** 🔴 **NO ROLE LINE IN THE TRIGGER.** **The card stays compact and single-line; identity context belongs in the opened menu, which already carries name and username.** ⚠ **No account field is invented to fill the card.**
> **e.** ✅ **The chevron is the shared disclosure glyph at the ratified rotation** (`RULE 3.17.b`) — **closed `0°`, open `180°` — turning on the SAME state as the menu, so the two can never disagree.** 🔴 **Never a text character.**
> **f.** ✅ **The avatar of `RULE 3.8.a.b` is CARRIED IN UNCHANGED** — `36 × 36px`, true circle, ink fill, white initials, thin neutral resting ring. 🔴 **It is not resized by this rule.**
> **g.** ⚠ **ONE SHARED IMPLEMENTATION for the whole ERP.** 🔴 **No module builds its own account trigger, and no avatar-only trigger survives anywhere.**

> **RULE 3.8.a.b — ✅ THE IDENTITY CONTROL IS `36 × 36px`. Ratified 2026-08-15.**
>
> **a.** ⚠ **The operator's own presence sat fractionally below two `34px` utility surfaces and read as the smallest thing in the row.** ✅ **`36px` restores the identity control as the largest of the three while staying compact inside the header.**
> **b.** 🔴 **CHAT AND NOTIFICATIONS ARE NOT ENLARGED TO MATCH and remain `34 × 34px`.** ⚠ **They are a different KIND of control — utility surfaces, not identity — and equalising the three would erase a deliberate distinction to satisfy a grid.**
> **c.** **The resting border stays `1px` of the existing avatar-ring neutral `oklch(0.55 0 0)`, measured `4.44` against the ground.** 🔴 **It is NEVER ink and is NEVER thickened into a ring; a heavy ring would read as permanent focus.**
> **d.** ⚠ **GEOMETRY ONLY. The profile menu, its open and dismiss behaviour and its focus handling are untouched by this rule.**

## 3.9 Content frame

| Property | Exact Value | Source | Notes |
|---|---|---|---|
| Main padding | `24px 32px 64px` | ✅ OD/ODT | **32px gutters · 24px top · 64px terminal** |
| Max width | `1560px`, `margin: 0 auto` | ✅ OD/ODT | Centred |
| Scroll | `<main>` scrolls; shell is `height:100vh; overflow:hidden` | ✅ OD/ODT | |

## 3.10 Cards

| Card | Exact Value | Source |
|---|---|---|
| **Standard panel** | `#FFFFFF`, `1px solid oklch(0.93 0.006 290)`, radius `16px`, shadow `0 1px 2px oklch(0 0 0 / 0.03)` | ✅ OD/ODT |
| **Card header row** | height `58px`, padding `0 22px`, border-bottom `1px solid oklch(0.95 0.004 290)`, `h3 15.5px/700` | ✅ ODT |
| **Card body (key/value)** | padding `22px`, `grid-template-columns: 1fr 1fr`, gap `18px 32px` | ✅ ODT |
| **KPI card** | radius `12px`, padding `12px 14px`, height `82px`, grid `repeat(4, minmax(0,1fr))`, gap `14px` | ✅ OD |
| **KPI tile / dot / bars** | `28×28` radius `8` · `11×11` radius `4` · bars `4px` wide, radius `2`, container `12px` tall, gap `2px` | ✅ OD |
| **Order card** | radius `16px`, `overflow: hidden`, list gap `14px` | ✅ OD |
| **Rail card** | radius `16px`, padding `20px` | ✅ ODT |
| **Order summary card** | radius `14px`, padding `14px 16px`, `h3 12.5px/700 margin 0 0 10px`, row gap `9px` | ✅ ODT |
| **Summary strip card** | padding `18px 22px`, flex space-between | ✅ ODT |
| **Section header height** | `56–58px` | ✅ DL prose, `58px` in ODT |
| Minimum heights | 🔴 **NOT DEFINED BY SOURCE** except KPI `82px` | — |

## 3.11 Buttons

| Variant | Height | Padding | Radius | Background | Border | Text | Source |
|---|---|---|---|---|---|---|---|
| **Primary (DL spec)** | `36px` | `0 16px` | `9px` | `oklch(0.2 0 0)` | none | `#FFFFFF` `13px/700` | ✅ DL |
| **Secondary (DL spec)** | `36px` | `0 16px` | `9px` | `#FFFFFF` | `1px oklch(0.75 0 0)` | `oklch(0.25 0 0)` `13px/600` | ✅ DL |
| **Ghost (DL spec)** | `36px` | `0 16px` | — | transparent | none | `oklch(0.5 0.015 290)` `13px` | ✅ DL |
| **Primary (page header)** | `40px` | `0 18px` | `10px` | `oklch(0.2 0 0)` | none | `#FFFFFF` `13.5px/700` | ✅ OD |
| **Secondary (page header)** | `40px` | `0 18px` | `10px` | `#FFFFFF` | `1px oklch(0.75 0 0)` | `oklch(0.25 0 0)` `13.5px/600` | ✅ OD/ODT |
| **Row action** | `32px` | `0 14px` View · `0 12px` More | `9px` | `#FFFFFF` | `1px oklch(0.75 0 0)` | `oklch(0.25 0 0)` `13px/600` | ✅ OD |
| Primary hover | `oklch(0.28 0 0)` | ✅ OD |
| Secondary hover | `oklch(0.94 0 0)` | ✅ OD/ODT |
| Ghost hover | 🔴 **NOT DEFINED BY SOURCE** | — |
| Disabled | 🔴 **NOT DEFINED BY SOURCE** | — |
| Focus | 🔴 **NOT DEFINED BY SOURCE** | — |
| **Destructive (confirmation action)** | `36px` · `0 16px` · `9px` · **`oklch(0.48 0.16 25)`** · none · `#FFFFFF` `13px/700` | ✅ **ODL** |
| Destructive hover | **`oklch(0.54 0.16 25)`** | ✅ **ODL** |

> **RULE 3.11 — Three button sizes exist: `36px` canonical, `40px` page-header, `32px` in-row.** ⚠ **Exactly one primary per header.** **The dark button is rightmost of an action pair.**

> **RULE 3.11.a — ✅ The DESTRUCTIVE button is a SEMANTIC VARIANT of the primary button, not a separate system.** **Identical height, padding, radius, weight and label size; only the fill changes from ink to canonical red** (`RULE 3.3.c`). 🔴 **No destructive geometry, no destructive size, no oversized dialog button.** ⚠ **It replaces the primary in a destructive confirmation — it never appears ALONGSIDE one, because `RULE 3.11`'s one-primary limit still holds.**
>
> **Measured: `#FFFFFF` label on the red fill `7.11`; on the hover fill `5.49`; the fill against a `#FFFFFF` panel `7.11` and against the dialog footer tint `6.71`.**

> **RULE 3.11.b — ⚠ `oklch(0.54 0.16 25)` is the REFERENCE-DEFINED destructive hover value.** 🔴 **Its authority is the approved reference, NOT a formula.** **That it sits near the primary hover's lightness step is PROVENANCE, not a reusable algorithm.** 🔴 **No future semantic colour derives its hover by adding a lightness constant. Every hover value is designed, captured and ratified.**

> **RULE 3.11.d — ✅ THE PAGE-HEADER ACTION IS COMPACT. Ratified 2026-08-15.**
>
> **`36px` tall, `0 13px` padding, `9px` radius, `13px` label, `15px` semantic icon with a `6px` gap.** ⚠ **Superseded: `40px` tall, `0 18px` padding, `10px` radius, `13.5px` label** (`DOC-009`).
>
> **a.** 🔴 **PROMINENCE COMES FROM FILL, POSITION AND LABEL — NEVER FROM GEOMETRY.** ⚠ **At `40px` the page-header action was the single largest control in the ERP, which bought emphasis with size rather than hierarchy.**
> **b.** ✅ **EXACTLY ONE DARK PRIMARY REMAINS where the page header carries one** (`RULE 3.11`), **at the same compact geometry.** 🔴 **Primary hierarchy is not weakened — the ink fill still does that work.**
> **c.** ⚠ **COMPACT IS NOT SMALL.** **`36px` is the shared button height, not a reduced one, and the label stays at a readable `13px`.** 🔴 **No tiny text and no sub-32px desktop target.**
> **d.** ✅ **GEOMETRY ONLY.** 🔴 **Action order, labels, icons, permissions, behaviour and destinations are untouched by this rule.**

> **RULE 3.11.c — ✅ FINAL CONTEXTUAL ACTION SURFACE. Ratified 2026-08-12.**
>
> **Neutral contextual actions** keep the existing secondary text weight and white fill, but their resting outer border is not visible; they use the existing card/contact elevation `0 1px 2px oklch(0 0 0 / 0.03)` for the compact enterprise control surface. **Primary contextual actions** keep the canonical ink fill and white text, also with no resting visible outer border and the same restrained contact elevation. 🔴 **This creates no fourth elevation** (`RULE 3.6`): it reuses the existing in-flow contact shadow. Focus-visible treatment remains mandatory and may use the existing focus ring.

## 3.12 Inputs and selects

| Property | Exact Value | Source |
|---|---|---|
| Search input | height `34px`, width `280px`, `max-width: 100%`, radius `9px`, padding `0 12px`, `13px`, border `1px oklch(0.9 0.006 290)`, `#FFFFFF` | ✅ OD |
| Select | height `32px`, radius `9px` (`8px` in bulk bar), padding `0 8px`, `13px`, border `1px oklch(0.9 0.006 290)` | ✅ OD |
| Placeholder | **`oklch(0.568 0.01 290)`** — 🔴 **v2.4.0**, was `oklch(0.65 0.01 290)` (`RULE 8.14`) | ✅ DL/OD/ODT |
| Checkbox | `16 × 16px`, `accent-color: oklch(0.2 0 0)` | ✅ OD |
| Radio · textarea · date/time picker · file input · toggle | 🔴 **STILL NOT DEFINED BY SOURCE** — deliberately excluded from the approved form reference | — |
| Input focus / error / disabled | ✅ **DEFINED — see §3.18** | ✅ FDL |
| Labelled-field layout | ✅ **DEFINED — see §3.18** | ✅ FDL |
| Input hover | 🔴 **NOT DEFINED BY SOURCE.** ⚠ **Focus does not depend on it: no hover treatment anywhere uses an ink boundary** | — |

⚠ **The `34px` form control and the `32px` list-page utility select are DIFFERENT surface classes and are not collapsed** (`RULE 3.18.d`).

## 3.18 ✅ Form controls — ratified 2026-08-11

**Source: `Form Design Language.dc.html` (`FDL`), approved 2026-08-11.** **This section is the canonical authority for enabled and inactive form controls ERP-wide.**

| Property | Exact value | State | Source |
|---|---|---|---|
| **Control height** | `34px` | all | ✅ FDL |
| **Control radius** | `9px` | all | ✅ FDL |
| **Horizontal padding** | `0 12px` input · `0 10px` select | all | ✅ FDL |
| **Control text** | `13px`; entered value `500` | all | ✅ FDL |
| **Fill — enabled** | `#FFFFFF` | rest, focus, filled, error | ✅ FDL |
| **🔴 Boundary — enabled** | **`1px solid oklch(0.65 0.006 290)`** | rest, filled | ✅ FDL |
| **Boundary — focus** | `1px solid oklch(0.2 0 0)` **+ halo `0 0 0 3px oklch(0.93 0 0)`** | focus | ✅ FDL |
| **Boundary — error** | `1px solid oklch(0.48 0.16 25)` | error | ✅ FDL |
| **Boundary — disabled** | `1px solid oklch(0.9 0.006 290)` | disabled | ✅ FDL |
| **Fill — disabled** | `oklch(0.96 0.004 290)` | disabled | ✅ FDL |
| **Text — disabled** | `oklch(0.5 0.015 290)` | disabled | ✅ FDL |
| **Field label** | `11.5px / 600` `oklch(0.55 0.015 290)`, `6px` above the control | all | ✅ FDL |
| **Entered value** | `13px / 500` `oklch(0.24 0.02 290)` | all | ✅ FDL |
| **Placeholder** | `13px / 400` `oklch(0.568 0.01 290)` | rest | ✅ FDL |
| **Helper text** | `11.5px / 400` `oklch(0.55 0.015 290)`, `6px` below | all | ✅ FDL |
| **Error text** | `11.5px / 600` `oklch(0.48 0.16 25)`, `6px` below | error | ✅ FDL |
| **Error marker** | `13px` circle, `1.5px` outline, `oklch(0.48 0.16 25)`, `6px` gap | error | ✅ FDL |
| **Required marker** | `*` `oklch(0.48 0.16 25)` on the LABEL | all | ✅ FDL |

> **RULE 3.18 — 🔴 `oklch(0.65 0.006 290)` is the ENABLED FORM CONTROL boundary and NOTHING ELSE.**
>
> **a.** ✅ **It exists because an enabled form control may be EMPTY, so its boundary is the only thing that identifies it** (`RULE 8.10`). **Measured `3.24` on `#FFFFFF` and `3.10` on the app background — both adjacencies** (`RULE 8.6.b`).
> **b.** 🔴 **It is NEVER generalised into an ERP-wide border.** **Card `oklch(0.93 0.006 290)`, control/utility `oklch(0.9 0.006 290)`, secondary action `oklch(0.75 0 0)`, inner divider `0.95`, light divider `0.96` are UNCHANGED.**
> **c.** 🔴 **It is not applied to grouped controls, pagination, icon buttons or the segmented container** — those are closed by self-identifying content (`§8.6`) **and darkening them would be a regression, not a fix.**
> **d.** ⚠ **The list-page utility select remains `32px` with the `oklch(0.9 0.006 290)` boundary.** **Form context and list-utility context are different surface classes** (`RULE 4.1.b`) **and are NOT collapsed for implementation convenience.**

> **RULE 3.18.e — ✅ DISABLED IS DELIBERATELY LIGHTER THAN ENABLED, and that is correct.** **SC 1.4.11 EXEMPTS inactive components, so the disabled control legitimately keeps the original `oklch(0.9 0.006 290)` hairline.** 🔴 **It is never darkened for symmetry.** **Its text stays readable at `5.36` on the disabled fill — never faded, never an opacity approximation** (`RULE 15.1.c`).
>
> 🔴 **DISABLED is NOT read-only, NOT permission-restricted, NOT hidden and NOT workflow-unavailable.** ⚠ **Those classes have NO ratified visual treatment and must not borrow this one.**

> **RULE 3.18.f — 🔴 THE ERROR MESSAGE AND MARKER ARE MANDATORY, NOT DECORATION.** **Measured: the error boundary differs from the rest boundary by only `2.19`.** ✅ **Each state satisfies SC 1.4.11 independently against its own adjacencies — error `7.11`/`6.80` — but the boundary CHANGE alone is NOT a sufficient signal.**
>
> **The error state is therefore ALWAYS carried by three things together: the red boundary, the outline marker, and the message.** 🔴 **A field must never be shown as errored by colour alone** (`RULE 8.4`, SC 1.4.1). ⚠ **A focused field that is also in error RETAINS its message — focus and error boundaries differ by only `2.55` and are told apart structurally, not chromatically.**

> **RULE 3.18.g — ✅ The two-column `1fr 1fr` grid at `18px 32px` is the REFERENCE COMPOSITION of this form surface, not an ERP-wide mandatory layout.** **Control geometry (`RULE 3.18`) is universal; column count is per-surface** (`RULE 4.1.b`, `RULE 7.8.b`). ⚠ **A form is not required to be two columns, and a surface needing one column does not amend this Constitution to get it.**

## 3.13 Segmented controls, tabs and filters

| Component | Exact Value | Source |
|---|---|---|
| **Segmented control (DL canonical)** | container `1px oklch(0.9 0.006 290)`, radius `9px`, `overflow: hidden`, `#FFFFFF`, `width: fit-content`; segment padding `6px 14px`, `13px`; **active** `oklch(0.2 0 0)` fill + `#FFFFFF` `600`; **inactive** transparent + `oklch(0.5 0.015 290)` | ✅ DL |
| **Channel filter** | Identical to canonical | ✅ OD |
| **Period filter** | Identical; segment padding `6px 12px`; `margin-left: 4px` | ✅ OD |
| **Status tabs (list)** | container padding `4px`, radius `10px`, gap `4px`, `#FFFFFF`, `1px oklch(0.93 0.006 290)`; tab height `28px`, padding `0 11px`, radius `7px`, `12px/600`; **active** `oklch(0.2 0 0)` + `#FFFFFF` | ✅ OD |
| **Detail tabs** | container padding `5px`, radius `12px`, gap `6px`, `oklch(0.96 0.004 290)`; tab height `36px`, padding `0 16px`, radius `9px`, `13.5px/600`; **active `#FFFFFF` + shadow `0 1px 3px oklch(0 0 0 / 0.08)`** | ✅ ODT |
| **FILTER label** | `11.5px / 700 / 0.03em`, `oklch(0.55 0.015 290)` | ✅ OD |
| **Reset action** | ghost, `13px`, `oklch(0.5 0.015 290)` | ✅ OD |

> **RULE 3.13 — Two active-segment treatments exist and both are correct.** **Dark-filled** on a light container (list status tabs, channel and period filters) and **white-raised** on a tinted container (detail tabs). ⚠ **The distinction is deliberate: dark for filtering a set, white-raised for switching a view.**

> **RULE 3.13.a — ✅ AN ENTITY-CLASS TAB REUSES THE WHITE-RAISED TREATMENT. NO NEW PRIMITIVE IS CREATED. Ratified 2026-08-11.**
>
> **An ENTITY-CLASS TAB switches between distinct canonical entity classes rather than filtering one collection** — the Products workspace's `Stock Items` · `Sellable Products` · `Listings` is the first instance (`UI_UX_ARCHITECTURE.md` `UX-035`).
>
> ✅ **`RULE 3.13`'s own distinction decides this deterministically and no judgement is added:** ***dark for filtering a set, white-raised for switching a view.*** **An entity-class tab switches the view — a different collection of a different entity appears — so it takes the WHITE-RAISED treatment already specified at `§3.13`:** **container padding `5px`, radius `12px`, gap `6px`, `oklch(0.96 0.004 290)`; tab height `36px`, padding `0 16px`, radius `9px`, `13.5px/600`; active `#FFFFFF` with `0 1px 3px oklch(0 0 0 / 0.08)`.**
>
> **a.** 🔴 **NO NEW TOKEN, NO NEW ACCENT, NO NEW GEOMETRY, NO GRADIENT.** **Every value above already existed.** ✅ **This rule ratifies a REUSE and the boundary of that reuse; it does not create a tab system.**
> **b.** 🔴 **THE DARK-FILLED TREATMENT IS PROHIBITED FOR ENTITY-CLASS TABS.** **Dark fill is the ratified language of STATUS FILTERING** (`§3.13`, `02-orders-list`). **Using it here would assert that the three entity classes are statuses of one collection — precisely the conflation `UX-035.a` and `UX-035.d` forbid.**
> **c.** ⚠ **The white-raised treatment was captured on a record-detail surface (`ODT`).** **It is applied here on function, not on page class, because `RULE 3.13` states the distinction in FUNCTIONAL terms** — filtering versus switching. 🔴 **`RULE 4.1.b` is not weakened: this is not a licence to move other detail-surface patterns onto list pages.**
> **d.** ⚠ **An entity-class tab strip and a status-tab strip may both exist on one surface** — the entity-class strip selects WHAT is listed, a status strip would filter WITHIN it. **Their treatments differ precisely so the two axes stay legible.**
> **e.** ✅ **`RULE 8.12` already ruled the white-raised active state sufficient without colour:** **the state change measures `3.13` between labels, both labels pass 1.4.3, and the raised white surface is a non-colour cue.** 🔴 **The same finding carries here — no accessibility question is reopened.**

## 3.14 Status badges

| Property | Exact Value | Source |
|---|---|---|
| Geometry | `display: inline-flex`, padding `3px 10px`, radius `999px` | ✅ DL/OD/ODT |
| Typography | `12px / 600` | ✅ DL/OD/ODT |
| Palette | The five pairs at §3.3 | ✅ DL |
| Detail-page inline badge | padding `4px 12px` beside `h1` | ✅ ODT |

> **RULE 3.14.a — 🔴 THE FIVE SEMANTIC PAIRS CARRY ORDER SEMANTICS AND DO NOT AUTOMATICALLY EXTEND TO INTEGRATION OR PUBLICATION STATES. Ratified 2026-08-11.**
>
> **`§3.3`'s pairs — pending, confirmed, dispatched, cancelled, neutral — were derived from the approved ORDER collection.** 🔴 **They do NOT come with a ratified mapping for:** **`SYNCED` · `PENDING` · `IN_PROGRESS` · `FAILED` · `MANUAL_REQUIRED` · `DIVERGED`** (`SYS §7.1`) **· listing `ACTIVE` / `SUSPENDED` / `REJECTED` · publication intent** (`PRD-128`).
>
> **a.** 🔴 **A STATE IS NEVER ASSIGNED A PAIR BECAUSE IT *FEELS* SIMILAR.** ⚠ **`MANUAL_REQUIRED` is a NORMAL state** (`SYS-025`) **and colouring it as a failure would misinform every operator who sees it.** **`DIVERGED` is always an exception** (`SYS-026`) **and colouring it neutral would hide one.**
> **b.** ✅ **UNTIL A MAPPING IS RATIFIED, THESE STATES USE THE NEUTRAL PAIR WITH AN EXPLICIT TEXT LABEL** — `oklch(0.95 0.004 290)` on `oklch(0.45 0.01 290)`. 🔴 **The label is mandatory; the state is never carried by colour alone** (`RULE 8.4`, SC 1.4.1) — **which is exactly why a neutral carrier loses no information.**
>
> ⚠ **SUPERSEDED 2026-08-15 by `RULE 3.3.d`; the wording above is retained** (`DOC-009`). **The mapping this clause waited for is now ratified: a state takes the SEMANTIC ROLE its meaning deserves.** ✅ **`.a`'s warning survives intact and is the reason the mapping is by MEANING and never by resemblance** — **`MANUAL_REQUIRED` remains a NORMAL state and is not `danger`; `DIVERGED` remains an exception and is not `neutral`.** 🔴 **The mandatory text label is unchanged** (`RULE 8.4`).
> **c.** ✅ **THIS BLOCKS NO COMPOSITION.** **A surface may be designed, reviewed and built with neutral labelled carriers; assigning semantic colour later changes a token, not a layout.**
> **d.** 🔴 **NO SIXTH PAIR IS CREATED HERE** (`RULE 3.3.a`) **and no new hue is introduced.** **Extending the semantic palette is a design decision through `§12.3`.**

## 3.15 Data presentation

| Property | Exact Value | Source |
|---|---|---|
| Order card identity row | padding `10px 16px`, gap `10px`, border-bottom `1px oklch(0.96 0.004 290)` | ✅ OD |
| Avatar circle | `28 × 28px`, `oklch(0.96 0.004 290)` | ✅ OD |
| Product row | padding `12px 16px`, gap `12px`; thumb `38 × 38px` radius `9px` | ✅ OD |
| Demoted metric group | label `10px` **`oklch(0.568 0.012 290)`** (🔴 v2.4.0, `RULE 8.14`); value `12px/600` `oklch(0.5 0.015 290)`; gap `10px`; `padding-right: 12px`; `border-right: 1px oklch(0.93 0.006 290)` | ✅ OD |
| Primary metric | label `11.5px` `oklch(0.55 0.015 290)`; value `15px/700` `oklch(0.24 0.02 290)` | ✅ OD |
| Margin value | `15px/700` `oklch(0.38 0.1 155)` | ✅ OD |
| Footer strip | padding `7px 16px`, `oklch(0.98 0.002 290)`, border-top `1px oklch(0.96 0.004 290)`; `INVOICE` marker `10.5px/700/0.04em` | ✅ OD |
| Invoice reference | `13px / 700`, monospace | ✅ OD |
| Detail items row | padding `16px 22px`, gap `16px`; thumb `48 × 48px` radius `10px` | ✅ ODT |
| Items total strip | padding `16px 22px`, `oklch(0.98 0.002 290)`, radius `0 0 16px 16px` | ✅ ODT |
| Timeline row | padding `12px 0`, gap `12px`; dot `8 × 8px` `oklch(0.2 0 0)`, `margin-top: 6px` | ✅ ODT |
| Bulk action bar | height `50px`, padding `0 16px`, radius `12px`, `oklch(0.93 0 0)`, border `1px oklch(0.75 0 0)`, gap `16px` | ✅ OD |
| **Traditional data table** | 🔴 **NOT USED.** The approved order collection is a **card list** | ⚠ OD |

> **RULE 3.15.a — ✅ THE PRODUCT THUMBNAIL: RATIFIED GEOMETRY, AND THE DATA MODEL NOW OWNED BY PRODUCT. Ratified 2026-08-11 · AMENDED 2026-08-13.**
>
> ✅ **The GEOMETRY is canonical, unchanged, and already above:** **`38 × 38px`, radius `9px`, in a `12px 16px` row at `12px` gap** (`OD` product row) · **`48 × 48px` radius `10px`** on the detail items row (`ODT`).
>
> ✅ **THE IMAGE DATA MODEL IS NOW CANONICAL AND IS NOT THIS DOCUMENT'S.** **`PRODUCT_ARCHITECTURE.md` `§38` decided it on 2026-08-13** — **primary-image selection (`PRD-168.a`–`.c`), image ordering (`PRD-168.d`), storage ownership (`PRD-167`, `E-105` Media Asset) and fallback behaviour (`PRD-170`).** 🔴 **The authoritative URL model REMAINS UNDEFINED** — **`TEC-105` keeps storage technology `NOT DEFINED BY SOURCE`.**
>
> 🔴 **THIS CHANGES NO VISUAL RULE.** ⚠ **The Constitution never owned the image data model and does not acquire it now; it consumes the owner's decision** (`DOC-005`, `DOC-006`). **Clauses `a` – `d` below are unchanged and remain in force.**
>
> *🔴 **Superseded wording retained under `DOC-009`:** "**THE IMAGE DATA MODEL IS NOT CANONICAL.** `PRODUCT_ARCHITECTURE.md` `PRD-018` establishes only that images are content Trioloo authors and pushes where the adapter declares field support (`PRD-125`). **Primary-image selection, image ordering, storage ownership, fallback behaviour and any authoritative URL model are UNDEFINED.**" **It was correct when written and governed until 2026-08-13.***
>
> **a.** ✅ **A thumbnail region MAY be composed and reviewed as VISUAL COMPOSITION.**
> **b.** 🔴 **ITS PRESENCE IS NEVER EVIDENCE THAT A FIELD EXISTS.** **No `primary_image_url`, no image table and no ordering column is authorised by drawing one** (`DOC-080` — a reference is not a schema). ⚠ **UNCHANGED BY THE 2026-08-13 AMENDMENT, AND THE DISTINCTION MATTERS: a media model now exists, but it is authorised by `PRD-167` – `PRD-170`, NEVER by this thumbnail.** 🔴 **Product's rules also do not authorise a `primary_image_url` column — `INV-105.6` puts role and order on the REFERENCE, not on the asset, and `TEC-105` selects no URL model.**
> **c.** 🔴 **THE THUMBNAIL NEVER CONTROLS ROW HEIGHT AND NEVER DOMINATES THE CARD.** **It is supporting identity beside the name, at the ratified geometry.** ⚠ **An ecommerce aspect-ratio tile, a large marketplace image or an image-led catalogue grid is prohibited** — **`§3.15` already records that the approved collection is a compact operational card list.**
> **d.** ✅ **A missing image is an ordinary case, not an error state.** **The `oklch(0.96 0.004 290)` block `OD` already uses is the ratified empty treatment** — **no placeholder illustration, no icon substitute, no "no image" text is introduced.** ✅ **CONFIRMED BY THE OWNER 2026-08-13: `PRD-168.b` makes media OPTIONAL — a Sellable Product may be created, remain `ACTIVE` and be sold with no media at all — so this clause describes the ORDINARY data condition, not a degraded one.** 🔴 **This clause is UNCHANGED and remains the authoritative empty treatment.**

## 3.16 Pagination and terminal region

| Property | Exact Value | Source |
|---|---|---|
| Container | `flex`, `justify-content: space-between`, `align-items: center`, `margin-top: 20px` | ✅ OD |
| Results count | `13px`, `oklch(0.5 0.015 290)`, **left** | ✅ OD |
| Right group gap | `12px` | ✅ OD |
| Page-size select | height `32px`, radius `9px`, padding `0 8px`, `13px`, border `1px oklch(0.9 0.006 290)`, `#FFFFFF` | ✅ OD |
| Page-size options | `50 / 25 / 100 / 200 per page` | ✅ OD |
| Button group gap | `4px` | ✅ OD |
| Prev / Next | `32 × 32px`, radius `9px`, border `1px oklch(0.9 0.006 290)`, `#FFFFFF`, `oklch(0.5 0.015 290)`, glyphs `‹` `›` | ✅ OD |
| Numbered page | `32 × 32px`, radius `9px`, border `1px oklch(0.9 0.006 290)`, `#FFFFFF`, `oklch(0.24 0.02 290)` | ✅ OD |
| **Active page** | `32 × 32px`, radius `9px`, **no border**, `oklch(0.2 0 0)`, `#FFFFFF`, `700` | ✅ OD |
| Surface | **None** — sits on page background, not in a card | ⚠ OD |
| Terminal spacing | `64px` bottom padding on `<main>` | ✅ OD/ODT |
| Ellipsis / jump-to-page / total-pages | 🔴 **NOT DEFINED BY SOURCE** | — |

> **RULE 3.16 — 🔴 There is NO persistent application footer.** **The approved shell ends at `<main>`'s 64px bottom padding.** ⚠ **Distinguish four different things and never conflate them: (1) application footer — does not exist; (2) page terminal spacing — 64px; (3) pagination terminal region — the row above; (4) document/printable footer — governed by `DOCUMENT_ARCHITECTURE.md`, not here.**

## 3.17 Iconography

| Property | Value | Source |
|---|---|---|
| Production icon set | ✅ **THE LUCIDE OUTLINE ICON SET** — ratified 2026-08-11 | 🔴 **Business decision.** Superseded: *"NOT DEFINED BY SOURCE"* |
| Library | ⚠ **SUPERSEDED v2.7.0.** ~~*"NONE. Icons are CSS-drawn primitives — `<span>` with border, radius and transform"*~~ | ⚠ OD/ODT — retained under `DOC-009` |
| Nav icon size | `15 × 15px` | ✅ OD/ODT |
| Nav stroke | `1.5px` inactive · `2px` active | ✅ OD/ODT |
| Nav icon colour | `oklch(0.6 0.012 290)` inactive · `oklch(0.2 0 0)` active | ✅ OD/ODT |
| Header stroke / colour | `1.5px`, `oklch(0.48 0.015 290)` | ✅ OD/ODT |
| Header icon size | ⚠ **`14 × 12px` bell · `16 × 13px` chat were the CSS-PRIMITIVE box dimensions** — **not a glyph size, and not transferable to a drawn icon set** | ✅ OD/ODT · see `RULE 3.17.c` |
| Style | **Outline only.** No filled icons anywhere | ⚠ OD/ODT |
| Caret | ⚠ **SUPERSEDED for the sidebar by `RULE 3.17.b`.** ~~*"`4px/4px/5px` CSS triangle, `oklch(0.25 0 0)`"*~~ **survives only where an approved source still draws one** — the `More actions ▾` button | ✅ OD |

**Ratified semantic mapping — the shell and navigation surfaces.**

| Destination | Icon | | Destination | Icon |
|---|---|---|---|---|
| **Dashboard** | `LayoutDashboard` | | **CRM** | `Contact` |
| **Inventory** | `Boxes` | | **Reports** | `ChartColumn` |
| **Purchasing** | `ShoppingCart` | | **Administration** | `ShieldCheck` |
| **Sales & Orders** | `ReceiptText` | | **Chat** *(header utility)* | `MessageSquare` |
| **Finance & Accounting** | `Wallet` | | **Notifications** *(header utility)* | `Bell` |
| **HR & Payroll** | `Users` | | **User / Profile** *(header utility)* | `User` |

> **RULE 3.17 — The CSS primitives are placeholders for geometry, not a mandated technique.** ✅ **What is binding: 15px nav icons, 1.5px stroke, outline-only, and the active-state stroke/colour change.** ⚠ **Selecting a production icon library is an open design decision.**
>
> 🔴 **AMENDED 2026-08-11 — the final sentence is SUPERSEDED by `RULE 3.17.a`. The rest stands unchanged, and the superseded sentence is retained above rather than erased** (`DOC-009`).

> **RULE 3.17.a — ✅ THE PRODUCTION ICON SET IS THE LUCIDE OUTLINE ICON SET. Ratified 2026-08-11 by business decision.**
>
> ✅ **This is a SELECTION INSIDE ALREADY-RATIFIED CONSTRAINTS, exactly as `RULE 14.1` classified it — not an invention.** **The binding geometry above is unchanged: `15px` nav icons, `1.5px` stroke, `2px` active, outline only, monochrome.**
>
> **What the ratification fixes:**
>
> **a.** 🔴 **ONE family, ERP-wide.** **No second icon library, anywhere, for any module.**
> **b.** 🔴 **Outline only · monochrome · uniform stroke and optical size.** **No filled or solid variants, no multicolour glyphs, no emoji, no decorative or mascot iconography.**
> **c.** ✅ **The mapping above is the canonical semantic assignment.** ⚠ **An icon DEPICTS what the navigation register already names** — it creates no module, no domain and no capability (`UX-025`).
> **d.** 🔴 **A future module does not choose its own icon vocabulary.** **A new destination takes its icon from this family and is added to the mapping by amendment.**
>
> ⚠ **NAMING BOUNDARY — `SYS-076` as amended by `TEC-000`.** **`Lucide` is ratified here as a VISUAL VOCABULARY, on exactly the footing this Constitution already names `Manrope`: a typeface and an icon set are design assets, not a language, framework, database or hosting model.** 🔴 **The software LIBRARY that delivers it is a TECHNOLOGY and is deliberately NOT named in this document; it is implementation evidence and belongs to `TECHNOLOGY_ARCHITECTURE.md` if it is ever recorded at all.**

> **RULE 3.17.b — ✅ THE SIDEBAR DISCLOSURE CHEVRON, AND ITS DIRECTION. Ratified 2026-08-11 by business decision.**
>
> **ONE thin outline chevron primitive from the ratified family, ROTATED for state — never a second glyph, never a filled triangle, never a heavy arrow, and never a different chevron per module.**
>
> 🔴 **DIRECTION — read this before "correcting" it:**
>
> | State | Chevron points |
> |---|---|
> | **FOLDED / CLOSED** | **DOWN** — `rotate(0deg)` |
> | **UNFOLDED / OPEN** | **UP** — `rotate(180deg)` |
>
> ⚠ **INVERTED 2026-08-15 by governed amendment** (`DOC-079`). **The superseded direction — closed UP, open DOWN — is retained here as the record** (`DOC-009`). 🔴 **This closes a KNOWN CONTRADICTION: the business decision to invert was taken on 2026-08-11 after reviewing the running application and was applied in code, but this rule was never amended, so architecture and implementation disagreed. Code was the correct behaviour and the document was the defect** (`DOC-080`).
> ✅ **The same glyph and the same rotation now serve the account card** (`RULE 3.8.a.c.e`) — **one disclosure convention for the whole ERP.**
>
> ⚠ **This is DELIBERATELY the inverse of the common right-then-down disclosure convention.** **It is a business decision, recorded here precisely so a future implementer does not "fix" it by habit.** 🔴 **A sideways/right-pointing chevron is not this primitive.**
>
> **a.** **The chevron sits at the FAR RIGHT of the parent row.**
> **b.** 🔴 **It is SECONDARY to the semantic module icon and must stay so** — smaller, thin-stroked, and in the nav icon-stroke colour. ⚠ **It does NOT take the ink active colour: a disclosure control must never compete with the module identity beside it.**
> **c.** **A destination with no children carries NO chevron** — there is nothing to disclose (`UX-026`).

> **RULE 3.17.c — ⚠ WHICH ICON GEOMETRY IS CANONICAL, AND WHICH IS AN IMPLEMENTATION SELECTION.** 🔴 **Recorded so code is never mistaken for ratification** (`DOC-080`).
>
> | Measurement | Status |
> |---|---|
> | **Nav icon `15px`, stroke `1.5px` / active `2px`, colours** | ✅ **CANONICAL** — `§3.17` from `OD`/`ODT`, unchanged since v2.0.0 |
> | **Header icon stroke `1.5px` and colour `oklch(0.48 0.015 290)`** | ✅ **CANONICAL** — `§3.17` from `OD`/`ODT` |
> | **Header icon GLYPH SIZE** | ⚠ **IMPLEMENTATION SELECTION.** **The source values were CSS-primitive box dimensions for hand-drawn shapes; a drawn icon set has one square optical size, so those two numbers cannot transfer** |
> | **Disclosure chevron SIZE** | ⚠ **IMPLEMENTATION SELECTION.** **The superseded source caret was a `4/4/5px` triangle, which is not a chevron measurement** |
>
> ✅ **Both selections are bounded, not free:** **the chevron must remain visibly lighter than the `15px` module icon** (`RULE 3.17.b.b`), **and header utility icons must sit inside the `34 × 34px` ghost button at `§3.8` and stay identifiable by stroke at their ratified colour** (`RULE 8.11`).

> **RULE 3.17.d — ✅ SEMANTIC ICONS IN CONTEXTUAL BUSINESS ACTIONS. Ratified 2026-08-12.**
>
> **A contextual business action may use a meaningful semantic icon where the icon materially improves immediate recognition.** The icon is semantic, never decorative; it precedes the concise visible label; the label remains visible; and a clear contextual action is not converted into an icon-only button. The icon comes from the existing Lucide outline vocabulary, uses consistent size, stroke, alignment and gap, and inherits the button foreground. 🔴 **Icons are not mechanically added to every action.** The Screen Contract / owning surface still owns exact domain action copy. Canonical examples: **`FileDown` Export**, **`Import` Import**, **`+` Add Item**.
>
> 🔴 **An implementation selection is NOT canonical geometry and confers no precedent.** **If either is to become binding, it is designed, captured and ratified through `§12.3` — not promoted because code contains a number.**

## 3.19 ✅ Overlay surfaces — ratified 2026-08-11

**Source: `Overlay & Destructive Design Language.dc.html` (`ODL`), approved 2026-08-11.** 🔴 **This section defines TWO overlay classes and no others.**

### Scrim — dialog backdrop only

| Property | Exact value | Source |
|---|---|---|
| **Dialog scrim** | **`oklch(0.2 0 0 / 0.48)`** | ✅ ODL |

> **RULE 3.19 — ✅ The scrim is the EXISTING ink at ONE declared alpha, and it backs DIALOGS ONLY.**
>
> **a.** **Measured: a `#FFFFFF` panel separates from the scrimmed field by `3.23` over white content and `3.34` over the app ground.** ✅ **The scrim — not the shadow — is what identifies a dialog** (`RULE 3.6.b`).
> **b.** 🔴 **This is NOT a general opacity rule.** **`RULE 15.1.c` still forbids approximating an opaque canonical token with alpha.** ⚠ **A scrim is a designed translucent surface; that is a different thing, and it is the ONLY one.**
> **c.** 🔴 **No other alpha variant of ink exists.** **`oklch(0.2 0 0 / 0.48)` is the whole permission.**
> **d.** 🔴 **MENUS NEVER CARRY A SCRIM.** **A scrim declares `the page is blocked`; an anchored menu blocks nothing.**
> **e.** ⚠ **No blur.** **The scrim darkens; it never defocuses** (`RULE 15.3.c`).

### Confirmation dialog

| Property | Exact value | Source |
|---|---|---|
| Panel width | `460px` | ✅ ODL |
| Panel surface / border / radius | `#FFFFFF` · `1px oklch(0.93 0.006 290)` · `16px` | ✅ ODL |
| Panel elevation | `0 8px 24px oklch(0 0 0 / 0.1)` (elevation 3) | ✅ ODL |
| Header padding | `20px 22px 0` | ✅ ODL |
| **Title** | **`15.5px / 700` `oklch(0.18 0.02 290)`** | ✅ ODL |
| Body text | `14px`, line-height `1.55`, `oklch(0.24 0.02 290)` | ✅ ODL |
| Consequence block | `oklch(0.98 0.002 290)` fill, `1px oklch(0.95 0.004 290)`, radius `10px`, padding `12px 14px` | ✅ ODL |
| Footer strip | padding `14px 22px`, `oklch(0.98 0.002 290)`, border-top `1px oklch(0.95 0.004 290)` | ✅ ODL |
| Footer actions | right-aligned, gap `10px`, `36px` buttons at radius `9px`, secondary then primary | ✅ ODL |
| Destructive marker | `22px` circle, `1.5px` outline `oklch(0.48 0.16 25)`, gap `12px` beside the title | ✅ ODL |

> **RULE 3.19.a — 🔴 THE DIALOG TITLE IS A CARD-HEADING, NOT A PAGE TITLE.** **`15.5px / 700` is the `§3.1` card-heading step and it is used deliberately: a dialog is a BOUNDED surface, and its prominence comes from the scrim, not from type size.** 🔴 **This value is NEVER promoted into a page-title rule** — **`25px / 800` remains the page title, and the three surface classes (page, card, dialog) stay distinct.**

> **RULE 3.19.b — ✅ THE CONSEQUENCE IS STATED BEFORE THE ACTION IS REACHABLE.** **A confirmation dialog names what will happen, in reading order, above its footer.** ⚠ **A dialog whose body says only `Are you sure?` is non-conforming.** 🔴 **This is a COMPOSITION rule. It creates no confirmation REQUIREMENT** — **which actions require confirmation is business architecture** (`UI_UX_ARCHITECTURE.md` `UX-113`) **and this Constitution never legislates it.**

### Anchored action menu

| Property | Exact value | Source |
|---|---|---|
| Panel width | `216px` | ✅ ODL |
| Panel surface / border / radius | `#FFFFFF` · `1px oklch(0.9 0.006 290)` · `10px` | ✅ ODL |
| Panel elevation | `0 8px 24px oklch(0 0 0 / 0.1)` (elevation 3) | ✅ ODL |
| Panel padding | `5px` | ✅ ODL |
| Row | `32px`, padding `0 10px`, radius `7px`, `13px / 500` `oklch(0.24 0.02 290)` | ✅ ODL |
| Row hover | `oklch(0.96 0.004 290)` | ✅ ODL |
| Separator | `1px oklch(0.95 0.004 290)`, margin `5px 0` | ✅ ODL |
| Destructive row | `13px / 600` `oklch(0.48 0.16 25)`, hover fill `oklch(0.95 0.04 25)` | ✅ ODL |
| Offset from trigger | `6px` | ✅ ODL |

> **RULE 3.19.c — 🔴 MENU AND DIALOG ARE SEPARATE SURFACE CLASSES AND ARE NEVER COLLAPSED INTO A GENERIC `OVERLAY COMPONENT`.**
>
> | | Menu | Dialog |
> |---|---|---|
> | **Anchoring** | To its trigger | Centred |
> | **Scrim** | 🔴 **Never** | ✅ Always |
> | **Radius / boundary** | `10px` · control boundary | `16px` · card boundary |
> | **Structure** | Rows only — **no title, no explanation** | Title · consequence · explicit confirm and cancel |
> | **Purpose** | Choose an action | Decide with consequence stated |
>
> ✅ **They legitimately SHARE the `#FFFFFF` surface, elevation 3, and the destructive vocabulary.** 🔴 **Shared vocabulary is not shared identity.**

> **RULE 3.19.d — ✅ NEITHER OVERLAY PANEL BOUNDARY IS LOAD-BEARING, and this is recorded so it is not `fixed` later.** **Measured: the menu boundary is `1.35` on white and the dialog boundary `2.62` against the scrimmed field — both below 3:1.**
>
> ✅ **Neither needs to pass.** **The dialog is identified by its SCRIM (`3.23`/`3.34`); the menu by its own CONTENT — rows of text at `16.51`, with the panel a grouping container** (`RULE 8.10`, `§8.4`). 🔴 **Darkening either boundary to chase a number that no criterion requires would be a regression** (`RULE 8.6`).

> **RULE 3.19.e — ✅ THE OVERLAY FAMILY CONSUMES THE EXISTING FOCUS ARCHITECTURE. It defines no new focus primitive.** **Menu row: ink ring `0 0 0 2px oklch(0.2 0 0)` (`16.11` against the hover fill). Outlined button: ink boundary + `0 0 0 3px oklch(0.93 0 0)` (`RULE 6.0.b`). Filled button, primary AND destructive: the two-part ring `0 0 0 2px #FFFFFF, 0 0 0 4px oklch(0.2 0 0)` (`RULE 6.0.a.b`).**
>
> 🔴 **FOCUS IS ALWAYS INK, NEVER RED.** **An ink ring measured DIRECTLY against the red fill is only `2.55`, which is exactly why the destructive button takes the two-part ring — the `#FFFFFF` separator measures `7.11` against red.** ✅ **Focus therefore reads identically on neutral, primary and destructive actions and can never be mistaken for destructive semantics.**

---

## 3.20 ✅ Scroll surfaces — ratified 2026-08-11

**Business decision, 2026-08-11.** 🔴 **VISIBLE NATIVE SCROLLBAR CHROME IS NOT PART OF THE ERP VISUAL LANGUAGE.**

> **RULE 3.20 — ✅ AN ERP-OWNED SCROLL SURFACE SCROLLS NORMALLY WHILE ITS NATIVE SCROLLBAR CHROME IS VISUALLY SUPPRESSED.**
>
> **The canonical principle, and both halves are binding:**
>
> ### ✅ SCROLLING REMAINS AVAILABLE. 🔴 VISIBLE SCROLLBAR CHROME IS NOT SHOWN.
>
> **a. WHAT IS SUPPRESSED** — **the visible track and thumb, and nothing else.**
>
> **b. 🔴 WHAT THIS RULE DOES NOT MEAN, ABSOLUTELY.** **It is NEVER:** **`overflow: hidden` where content must scroll** · **clipping** · **content made unreachable** · **disabled keyboard scrolling** · **disabled wheel or touchpad scrolling** · **disabled pointer or touch scrolling** · **disabled focus scrolling** · **disabled programmatic scrolling.** ⚠ **A surface that hides its scrollbar by removing its overflow has not applied this rule — it has broken the surface.**
>
> **c. 🔴 HIDDEN SCROLLBAR CHROME IS NOT HIDDEN CONTENT.** **Suppressing chrome is a PRESENTATION decision about an operating-system widget.** **Removing access to content is DATA LOSS.** **They are not the same act and are never traded for one another.**
>
> **d. SCOPE** — **application-owned scroll surfaces where scrolling is required.** ⚠ **It does not reach into user-agent-drawn surfaces the ERP does not own** — a native select popup, a print preview, a browser dialog.
>
> **e. ONE TREATMENT, DECLARED ONCE.** 🔴 **Browser-specific scrollbar styling is never restated per module, per page or per component.** **A module CONSUMES the shared treatment; it does not reimplement it** (`RULE 3.20.b`).
>
> **f.** ⚠ **No decorative scrollbar is drawn in its place.** **The chrome is suppressed, not replaced with a styled one — a custom scrollbar would be a new visual primitive and no approved source contains one.**

> **RULE 3.20.a — 🔴 SUPPRESSING CHROME NEVER SUPPRESSES OVERFLOW DISCOVERABILITY. Amended 2026-08-12.**
>
> **This visual rule suppresses scrollbar chrome only where a surface is otherwise authorised to scroll.** It does not authorise horizontal operational scrollers. `UI_UX_ARCHITECTURE.md` `UX-263`-`UX-266` now own the ordinary ERP workspace rule: guaranteed desktop fit, coherent workspace overflow above the guaranteed band and no component-level horizontal scrollbar.
>
> 🔴 **A component that clips content away from its own background is silently broken data. That is the exact failure `UX-073` exists to prevent.**
>
> ⚠ **Unaffected and unchanged:** **structured operational rows never wrap** (`RULE 7.4`) · **every zoom rule in Article VII** · **page size and record count, which never depend on viewport** (`RULE 7.3.a`).

> **RULE 3.20.b — ✅ THIS IS A FOUNDATION TREATMENT AND IS INHERITED, NOT REIMPLEMENTED.** **Every future module receives it by consuming the shared scroll surface.** 🔴 **A module-local scrollbar rule is a defect, not a customisation.**

## 3.21 ✅ Motion — partially ratified 2026-08-11

🔴 **Motion was `NOT DEFINED BY SOURCE` in every version through v2.6.0.** ✅ **TWO classes are now defined by business decision. EVERYTHING ELSE REMAINS UNDEFINED** — see `RULE 3.21.c`.

| Motion class | Duration | Applies to |
|---|---|---|
| **Sidebar disclosure** | **`160ms`** | Group submenu reveal / collapse **and** the chevron rotation that accompanies it |
| **Routed page content** | **`160ms`** ⚠ *(amended v2.13.0; superseded `150ms`)* | The routed-content boundary of the application shell |
| ✅ **State emphasis** — **NEW** | **`120ms`** | A surface changing emphasis IN PLACE: sidebar row, entity tab, account chevron |
| ✅ **Elevated arrival** — **NEW** | **`150ms`** | An anchored overlay appearing: account menu, action menu, popover |

> **RULE 3.21 — ✅ SIDEBAR DISCLOSURE MOTION. `160ms`.**
>
> **a.** **The submenu reveal/collapse and the chevron rotation share the SAME duration and the SAME easing**, so the two halves of one gesture move together rather than drifting apart.
> **b.** **Restrained operational easing.** 🔴 **No bounce. No spring. No overshoot. No elastic or anticipatory motion.**
> **c.** 🔴 **No `scale()` and no text scaling** — `RULE 15.3` forbids transform-scaled text, and a disclosure that resamples glyphs blurs them.
> **d.** 🔴 **No text blur at any point in the transition.**
> **e.** 🔴 **Navigation is NEVER delayed by it.** **Motion decorates a state change that has already happened; it never gates one.**
> **f.** **Scope: SIDEBAR DISCLOSURE.** 🔴 **This is GLOBAL for that primitive and for nothing else.**

> **RULE 3.21.a — ✅ ROUTED PAGE-CONTENT TRANSITION. `160ms`.** ⚠ **AMENDED v2.13.0; superseded `150ms`** (`DOC-009`).
>
> **a.** **An opacity transition with a VERY SMALL vertical entry movement.** 🔴 **No large slide, no `scale()`, no text blur, no navigation delay.**
> **b.** 🔴 **ROUTED CONTENT ONLY. The stable application shell does NOT transition** — **not the sidebar, not the brand region, not the user identity card, not the header utilities.**
>
> 🔴 **DEFECT RECORDED 2026-08-15 — THIS CLAUSE CONTRADICTS `RULE 4.1` AND IS NOT SATISFIABLE AS WRITTEN.** ⚠ **Measured in the running application: the sidebar brand region, the navigation and the user identity card ARE outside the animated boundary and stay stable across every navigation, exactly as this clause requires. THE HEADER UTILITIES ARE NOT** — **they sit inside `§3.8`'s page header, which `RULE 4.1`, `RULE 4.1.a` and `RULE 4.1.b` establish as a CONTENT-REGION pattern belonging to the routed surface, with NO separate global application header bar permitted.** 🔴 **Honouring this clause literally would require creating exactly the global header those rules forbid, so it is REPORTED rather than resolved by invention** (`RULE 6.1`, `DOC-024`). ✅ **Which of the two rules yields is a design decision for `§12.3`; until then `RULE 4.1` governs, because it is structural and this clause is a list.** ⚠ **A shell that re-animates on every navigation stops reading as stable, which is the opposite of what an operational ERP needs.**
> **c.** ✅ **Declared ONCE at the routed-content boundary, so every module inherits it** — Inventory, Purchasing, Sales & Orders, Finance & Accounting, HR & Payroll, CRM, Reports and Administration receive it without doing anything. 🔴 **A page-specific or module-specific entrance animation is a defect.**
> **d.** 🔴 **It touches no data, no request and no state.** **It is presentation over content that has already arrived.**
> **e.** 🔴 **IT REPLAYS ONLY ON A REAL NAVIGATION. Ratified 2026-08-15.** **The boundary is keyed on the route, so a data refresh, a keystroke, a validation change or any routine rerender does NOT restart it.** ⚠ **A page that re-fades every time a field is typed into is a flicker, not a transition.**

> **RULE 3.21.d — ✅ STATE EMPHASIS MOTION. `120ms`. Ratified 2026-08-15.**
>
> **A surface that changes EMPHASIS in place — a sidebar row becoming active, an entity tab becoming selected, the account chevron rotating — transitions its colour and transform.**
>
> **a.** 🔴 **COLOUR AND TRANSFORM ONLY.** **Nothing animates width, height, margin, padding or position, so a state change can never move the things around it.**
> **b.** 🔴 **NO SLIDING INDICATOR AND NO TRAVELLING UNDERLINE.** ⚠ **The emphasis arrives where the control already is; a marker crossing the tab strip is decoration and is prohibited.**
> **c.** ✅ **The whole row or tab transitions as one.** 🔴 **Items are never animated individually or in sequence.**

> **RULE 3.21.e — ✅ ELEVATED-SURFACE ARRIVAL MOTION. `150ms`. Ratified 2026-08-15.**
>
> **An anchored overlay — account menu, action menu, popover — enters with opacity `0 → 1` and a `4px` upward settle.**
>
> **a.** 🔴 **A SEPARATE SYSTEM FROM ROUTE MOTION, DELIBERATELY.** ⚠ **An overlay arrives ABOVE the page; routed content arrives IN it. One shared animation would say they were the same kind of event.** 🔴 **The routed-content treatment is NEVER applied to an overlay, and vice versa.**
> **b.** ⚠ **ENTER ONLY.** **A dismissed overlay unmounts immediately: an operator who has closed something should not have to watch it leave.**
> **c.** 🔴 **NO `scale()`.** ⚠ **A subtle `0.98` grow was drafted for the account menu and REMOVED: `RULE 15.3` forbids transform-scaled text because it resamples glyphs, and the panel is almost entirely text.**
> **d.** 🔴 **The dialog family is untouched** (`§3.19`) — **this rule governs ANCHORED overlays.**

> **RULE 3.21.f — ✅ ONE SHARED DURATION SCALE. Ratified 2026-08-15.**
>
> **`--motion-fast` `120ms` · `--motion-standard` `150ms` · `--motion-page` `160ms`, with `--ease-standard` and `--ease-out`.**
>
> **a.** 🔴 **A COMPONENT PICKS A SPEED; IT NEVER INVENTS ONE.** ⚠ **`127ms` in one place and `183ms` in another is how a system stops feeling like one product.**
> **b.** ✅ **Sidebar disclosure's ratified `160ms` is now an ALIAS of the page duration, not a fourth number.** 🔴 **`RULE 3.21` is unchanged in substance.**
> **c.** 🔴 **COMPOSITOR-FRIENDLY PROPERTIES ONLY — `opacity` and `transform`.** **Width, height, layout properties, large shadows and `filter: blur` are never animated.**

> **RULE 3.21.b — 🔴 REDUCED MOTION IS MANDATORY FOR EVERY RATIFIED MOTION TREATMENT.**
>
> **Where the operator has expressed a reduced-motion preference, the animation is removed or reduced.** 🔴 **FUNCTIONALITY IS PRESERVED EXACTLY — groups still open and close, routed pages still render, the chevron still points UP when closed and DOWN when open.** ⚠ **Only the animation goes. Nothing becomes unreachable and no state changes.**
>
> ✅ **A reduced-motion preference is a USER-PREFERENCE query, NOT a viewport breakpoint.** 🔴 **`RULE 7.10` is untouched by it and no breakpoint is created, inferred or implied.**

> **RULE 3.21.c — 🔴 MOTION IS NOT SOLVED ERP-WIDE, AND THESE TWO DURATIONS ARE NOT A MOTION SCALE.**
>
> 🔴 **`160ms` and `150ms` are the durations of TWO NAMED PRIMITIVES. They are not tokens, not a scale, and not a default.**
>
> 🔴 **NOTHING inherits them automatically — not dialogs, menus, buttons, tabs, toasts, drawers, tooltips, accordions, skeletons, charts or any future component.** ⚠ **Reaching for `160ms` because it is the one number written down is exactly the invention this rule forbids.**
>
> ⚠ **Every other motion class remains `NOT DEFINED BY SOURCE`** (Article VI, Article XIV item 10). ✅ **A new motion treatment is designed, captured and ratified through `§12.3` — never chosen at implementation time.**

---

# Article IV — Shell and Layout

## 4.1 🔴 The 64px header — a resolved source discrepancy

**`Design Language.dc.html` states:** *"Compact 216px white sidebar …, 64px white header with border, no header background/shadow tricks."*

⚠ **`Order Dashboard.dc.html` and `Order Details.dc.html` contain NO application header element.** The shell is `sidebar + main`. The title/action row lives **inside `<main>`**, scrolls with content, and has no full-width bar, background or border.

> **RULE 4.1 — Resolution by precedence.** **`64px` is the exact height token and it is realised as the SIDEBAR BRAND BLOCK**, which is `height: 64px` with a bottom border in both screen files. ✅ **In the approved surface classes there is no separate application header bar.** **The page header is a content-region pattern** (§3.8), **which is what `04-page-header.png` shows.**
>
> ⚠ **A future full-width header, if introduced, uses `64px` and a bottom border and no shadow — it is not part of the approved shell today.**
>
> 🔴 **SCOPE CORRECTED in v2.2.0.** **v2.0.0 stated this as `There is no separate application header bar` with no surface qualifier, and `UI_UX_ARCHITECTURE.md` `UX-011` then restated it as an ERP-wide prohibition.** **That wording is superseded by `RULE 4.1.a` and `RULE 4.1.b` below and is retained here as the record of what was said.** ⚠ **The token resolution itself — `64px` = sidebar brand block — is UNCHANGED and remains correct.**

> **RULE 4.1.a — 🔴 An element ABSENT from a reference is evidence about THAT reference, not an ERP-wide prohibition.** **`Order Dashboard.dc.html` and `Order Details.dc.html` establish two surface classes — list page and record detail. Neither contains a header bar, so neither may be built with one.** ⚠ **The approved set contains no form screen, no settings screen, no report screen, no wizard, no document-preview screen and no authentication screen.** 🔴 **Concluding from two screens that NO ERP surface may ever have an application header is an over-generalisation, and this Constitution does not make it.**
>
> ⚠ **The inverse is equally prohibited: absence of evidence is not permission either.** **A surface class with no approved reference does not acquire a header by preference, convenience or convention.**

> **RULE 4.1.b — ✅ REFERENCE FIDELITY BY SURFACE CLASSIFICATION — the governing principle.** **A surface reproduces the approved composition of ITS OWN surface class.** **Where an approved reference exists for that class, fidelity to it is mandatory and non-negotiable** (`RULE 1.3.a`). **Where no approved reference exists for that class, the composition is an OPEN DESIGN DECISION resolved through `§12.3` and `RULE 6.1` — designed, captured, added to the reference, then ratified here — in that order.**
>
> ⚠ **A rule derived from one surface class is never silently promoted to an ERP-wide rule.** **When this Constitution states an ERP-wide rule, it says so and names the evidence.** **`RULE 1.2` binds every module to ONE visual language; it does not bind every module to ONE composition.**

## 4.2 Layout rules

- Shell: `height: 100vh`, `display: flex`, `overflow: hidden`. Sidebar fixed, `<main>` scrolls.
- Content: `max-width: 1560px`, centred, `32px` gutters.
- Detail pages: main column `flex: 1; min-width: 420px` + right rail `320px; flex-shrink: 0`, gap `24px`, `flex-wrap: wrap`.
- Detail column internal gap `20px`; card grid gap `18px 32px`.

> **RULE 4.2 — The right rail is fixed at 320px and does not reflow on desktop.** **It wraps below the main column only when the container falls under roughly `420 + 320 + 24`px** — an implicit consequence of `flex-wrap` and `min-width`, **not a declared breakpoint.**

## 4.3 Navigation

> **RULE 4.3.a — Two levels only.** Parent → child. **Level 3 is prohibited.**
> **RULE 4.3.b — Both parent and child render active simultaneously** when a child is selected (`oklch(0.93 0 0)` and `oklch(0.95 0 0)`).
> **RULE 4.3.c — Sections are labelled, not merely spaced** (`MAIN`, `ADMIN`).
> **RULE 4.3.d — 🔴 The sidebar taxonomy in the mockup is VISUAL GUIDANCE ONLY.** ⚠ **It is not the ERP module register.** **Canonical modules are defined by `MASTER_DOCUMENTATION_INDEX.md` and `SYSTEM_ARCHITECTURE.md`.** **Deriving navigation structure is UI/UX Architecture work, not a design-foundation decision.**
> **RULE 4.3.e — The user block states name AND role.** The shell tells the operator which identity they are acting as.

---

# Article V — Component Governance

## 5.1 Density

**This is a dense operational product.** Nav rows `34px` · in-row actions `32px` · status tabs `28px` · card list gap `14px` · KPI cards `82px`.

> **RULE 5.1 — Whitespace that reduces scanning throughput is a defect, not restraint.** ⚠ **Equally, density that removes the 4px rhythm is a defect.**

## 5.2 Reuse

> **RULE 5.2 — A component that exists is reused, not re-cut.** The segmented control at §3.13 serves status filtering, channel filtering and period filtering **identically** — that is the standard every other component is held to.

## 5.3 Archetypes

| Archetype | Reference | Governs |
|---|---|---|
| **List page** | `02-orders-list.png` · `OD` | Page header → KPI row → status tabs → filter row → search → card list → pagination |
| **Record detail** | `03-order-detail.png` · `ODT` | Breadcrumb → title + status → tabs → main column + right rail |
| **Page header** | `04-page-header.png` | Title/subtitle/actions/utility |
| **Terminal region** | `05-pagination.png` | Count, page size, page controls |
| **Shell** | `01-sidebar-navigation.png` | Sidebar, sections, active states, user block |
| **Overlay** | `Overlay & Destructive Design Language.dc.html` | ✅ **APPROVED 2026-08-11.** Dialog scrim · confirmation dialog · anchored action menu · destructive action. ⚠ **Drawer, toast and tooltip are NOT part of this archetype** |
| **Form surface** | `Form Design Language.dc.html` | ✅ **APPROVED 2026-08-11.** Labelled field · input and select geometry · rest / focus / filled / error / disabled · label / value / placeholder / helper / error hierarchy |

⚠ **Every ERP module maps to one of these archetypes or amends this Constitution.**

---

# Article VI — States

| State | Status |
|---|---|
| **Hover — nav row** | ✅ `oklch(0.97 0.004 290)` |
| **Hover — primary button** | ✅ `oklch(0.28 0 0)` |
| **Hover — secondary button** | ✅ `oklch(0.94 0 0)` |
| **Hover — icon button** | ✅ `oklch(0.96 0.004 290)` |
| **Hover — link** | ✅ `oklch(0.4 0.18 300)` + underline |
| **Active — nav, tabs, segments, page** | ✅ §3.7, §3.13, §3.16 |
| **Selected — list row** | ✅ Checkbox `accent-color: oklch(0.2 0 0)`; bulk bar appears |
| **Focus / focus-visible** | ✅ **DEFINED for FORM CONTROLS** (`§3.18`, `RULE 6.0.b`) · ⚠ **interim floor `RULE 6.0.a` still governs every other interactive element** |
| **Disabled** | ✅ **DEFINED for FORM CONTROLS** (`§3.18`, `RULE 3.18.e`) · 🔴 **undefined for buttons and other controls** |
| **Pressed** | 🔴 **NOT DEFINED BY SOURCE** |
| **Loading / skeleton** | 🔴 **NOT DEFINED BY SOURCE** |
| **Empty state** | 🔴 **NOT DEFINED BY SOURCE** |
| **Error state** | ✅ **DEFINED for FORM FIELDS** (`§3.18`, `RULE 3.18.f`) · 🔴 **page-level and section-level error surfaces undefined** |
| **Validation** | ✅ **Field-level DEFINED** (`RULE 3.18.f`) · 🔴 **form-level validation summary undefined** |
| **Destructive action** | ✅ **DEFINED** (`RULE 3.3.c`, `RULE 3.11.a`, `§3.19`) — three enumerated placements, nowhere else |
| **Modal** | ✅ **DEFINED** (`§3.19`) — scrim, panel, elevation 3, consequence composition |
| **Drawer** | 🔴 **STILL NOT DEFINED BY SOURCE** — ⚠ **deliberately outside the approved overlay reference** |
| **Popover / menu** | ✅ **ANCHORED ACTION MENU DEFINED** (`§3.19`) — the `More actions ▾` surface now exists · 🔴 **other popover classes (filter panels, picker surfaces) remain UNDEFINED** |
| **Toast / notification surface** | 🔴 **STILL NOT DEFINED BY SOURCE** — ⚠ **deliberately outside the approved overlay reference** |
| **Motion / transition** | ✅ **PARTIALLY DEFINED 2026-08-11** (`§3.21`) — **sidebar disclosure `160ms` and routed page content `150ms`, both with a mandatory reduced-motion fallback** · 🔴 **EVERY OTHER MOTION CLASS REMAINS NOT DEFINED BY SOURCE, and the two ratified durations are NOT a motion scale** (`RULE 3.21.c`) |

> **RULE 6.0 — 🔴 Focus indication is undefined and this is the most serious gap in the approved source.** ⚠ **Removing focus indication is prohibited regardless.** **Until a focus treatment is designed, the platform default must not be suppressed.** **This is a design task, not an implementation choice.**
>
> **RULE 6.0.a — ✅ INTERIM ACCESSIBILITY FLOOR, using an EXISTING canonical colour.** ⚠ **This is a MINIMUM, not the designed focus treatment.** **It exists so the platform does not ship an outright WCAG 2.2 AA failure while `RULE 6.0` remains open.**
>
> **a.** **The focus indicator uses the EXISTING ink token `oklch(0.2 0 0)`.** 🔴 **No new accent, no new hue and no new token is created for focus.** **Measured against every canonical surface it can appear on: white `18.10` · app background `17.33` · active-nav fill `oklch(0.93 0 0)` `14.73` · card border `14.72` — all far above the 3:1 required by SC 1.4.11.**
> **b.** **Where the focused control's own fill IS ink** — primary button, active segment, active page control — **an ink ring would be invisible.** **There, a `#FFFFFF` separator sits between the control and the ink ring: measured `18.10` against ink.** ✅ **Both members of the pair are already canonical colours.**
> **c.** **The indicator is at least `2px` and is OFFSET from the control edge**, so it is never mistaken for the control border — which matters because `§8.4` makes that border load-bearing for identification.
> **d.** 🔴 **`outline: none` without an equally visible replacement is prohibited on every interactive element, without exception** (Article IX).
> **e.** ⚠ **Focus indication is NOT a hover state and must not be merged with one.** **Keyboard focus must be visible when the pointer never moves.**
>
> ⚠ **Article XIV item 1 REMAINS PARTIALLY OPEN.** **This floor removes the AA failure; it does not discharge the design task for non-form controls.**

> **RULE 6.0.b — ✅ THE DESIGNED FOCUS TREATMENT FOR FORM CONTROLS, ratified 2026-08-11 from `Form Design Language.dc.html`.** **The boundary becomes the existing ink `oklch(0.2 0 0)` and a solid `0 0 0 3px oklch(0.93 0 0)` halo is added.** 🔴 **No new colour, no alpha approximation, no unrelated accent** — **both values were already canonical.**
>
> ✅ **Measured distinctness, all computed:** **vs `#FFFFFF` `18.10` · vs app background `17.33` · vs the REST boundary `5.59`** — **focus is identifiable by its boundary alone.** **vs DISABLED, unmistakable (`18.10` against `1.29`).** **vs ERROR, `2.55` chromatically — told apart structurally by the halo and the error message** (`RULE 3.18.f`). ⚠ **No input hover state exists in any approved source, and focus does not depend on one: no hover treatment anywhere uses an ink boundary.**
>
> ✅ **`RULE 6.0.a` is REFINED for form controls by this rule and REMAINS IN FORCE unchanged for every other interactive element.** 🔴 **The two do not compete: `6.0.b` is the designed treatment where an approved reference exists; `6.0.a` is the floor where none does.**
>
> **RULE 6.0.c — ✅ THE FOCUS INDICATOR IS RESTRAINED NEUTRAL GREY. Ratified 2026-08-15. SUPERSEDES the ink ring of `RULE 6.0.a` and the ink boundary of `RULE 6.0.b`.**
>
> 🔴 **THE SUPERSEDED TREATMENT IS RETAINED AS THE RECORD** (`DOC-009`): **`RULE 6.0.a` set a `2px` ring of ink `oklch(0.2 0 0)` at `2px` offset, and `RULE 6.0.b` additionally turned a focused form control's BOUNDARY ink with a `0 0 0 3px oklch(0.93 0 0)` halo.** ⚠ **Both were accessibility-correct and visually wrong: measured `18.10` against white, an ink indicator is the strongest mark on the entire screen, applied to the most ordinary act in the ERP.**
>
> 🔴 **WHY IT READ AS A CLICK BEHAVIOUR, WHICH IS THE DEFECT ACTUALLY REPORTED.** **`:focus-visible` was believed to be keyboard-only. It is not: browsers match it on TEXT INPUTS for POINTER focus as well, because typing is expected there.** ⚠ **Clicking into any field therefore painted a near-black frame around it, while the rule believed the treatment was invisible to the mouse.**
>
> **a.** ✅ **The indicator is `2px` of the new neutral token `oklch(0.6 0 0)` = `#808080`, at `2px` offset.** 🔴 **Neutral by construction — zero chroma — so it can never be read as brand, as informational blue or as destructive red** (`RULE 3.3.b`).
> **b.** ✅ **SC 1.4.11 IS MET, NOT TRADED AWAY. Measured against every canonical surface it can appear on: `#FFFFFF` `3.95` · app ground `3.60` · strip `3.72` · active-nav fill `oklch(0.93 0 0)` `3.22` — all at or above the required `3.0`.** ⚠ **An earlier candidate at `oklch(0.62 0 0)` measured `2.97` on the active-nav fill and was rejected for that one figure.**
> **c.** 🔴 **A FOCUSED CONTROL'S OWN BOUNDARY NO LONGER CHANGES COLOUR.** **`RULE 6.0.b`'s ink boundary is WITHDRAWN: the ring alone carries focus and the control's resting border is left exactly as it is.** ✅ **This strengthens `§8.4`, where that border is load-bearing for identification — a boundary that changed meaning on focus was always in tension with it.**
> **d.** 🔴 **REMOVING FOCUS INDICATION REMAINS PROHIBITED ON EVERY INTERACTIVE ELEMENT, WITHOUT EXCEPTION.** **`outline: none` appears nowhere, and quieting the indicator is not a licence to suppress it.**
> **e.** ✅ **Where the control's own fill IS ink, the `#FFFFFF` separator of `RULE 6.0.a.b` is UNCHANGED and still required.**
> **f.** 🔴 **HOVER MUST NOT BORROW THIS TREATMENT** (`RULE 6.0.a.e`, unchanged). **Focus must be visible when the pointer never moves; a hover state painting the same ring would make the two indistinguishable.**
> **g.** ⚠ **ONE DECLARATION, GLOBALLY.** **The treatment lives in the single global base rule and is inherited by every module, dialog, menu and form.** 🔴 **A module re-declaring its own focus styling would win by specificity and silently exempt itself; that is prohibited.**

> **RULE 6.1 — An undefined state is not a licence to invent one.** **Design it, capture it, add it to the reference, and amend this Constitution — in that order.**

---

# Article VII — Layout Stability, Browser Zoom and Responsive Behaviour

**Amended 2026-08-10 by explicit business decision.** **v2.0.0 recorded this domain as wholly `NOT DEFINED BY SOURCE`.** ✅ **Desktop layout stability and browser-zoom behaviour are now DEFINED.** 🔴 **General breakpoint, adaptive and mobile behaviour remain UNDEFINED.**

## 7.1 What the approved source establishes

**Verified across all four source files: no `@media` query, no breakpoint, no min/max-width layout rule, no sidebar collapse, no grid reflow, no pagination adaptation.** The only `@media` in `support.js` is an unrelated print rule belonging to the runtime.

**What exists in source is implicit, not declared:**

| Mechanism | Source | Effect | Status under this Article |
|---|---|---|---|
| `flex-wrap: nowrap` on the list header and rows | ✅ OD | **Explicitly refuses to wrap** | ✅ **CONFIRMED INTENTIONAL** by §7.4 — no longer read as an implementation accident |
| `flex-wrap: wrap` + `min-width: 420px` on the detail main column | ✅ ODT | Right rail wraps below when space runs out | ✅ **PERMITTED** — a page-REGION behaviour, not a row (§7.6) |
| `flex-wrap: wrap` on the detail title block | ✅ ODT | Actions wrap under the title | ✅ **PERMITTED** — a page title/meta/action REGION, not an operational row (§7.8) |
| `max-width: 100%` on the search input | ✅ OD | Input shrinks | ✅ Permitted — a control, not a composition |

⚠ **A viewport meta tag is not responsive behaviour.** **Breakpoints must not be inferred from it.**

## 7.2 The canonical viewport

> **RULE 7.2 — 100% browser zoom is the canonical visual baseline.** **At 100% an approved page reproduces its reference composition, hierarchy, spacing and density.**
>
> **The application uses the available browser viewport cleanly** and **must not appear artificially narrow or unnecessarily compressed.**
>
> ✅ **80% zoom is a FIRST-CLASS desktop condition, not a degraded mode.** **The ERP is commonly operated near 80% on a 19-inch monitor**, and that condition must remain fully usable.

## 7.3 🔴 The three concepts that must never be conflated

> **RULE 7.3 — Browser zoom changes visual scale and viewport visibility. It NEVER changes information architecture, record set, field set or structural composition.**

| # | Concept | Behaviour under zoom |
|---|---|---|
| **1** | **Information EXISTENCE** | 🔴 **Unchanged.** The same page holds the same information at every zoom level |
| **2** | **Information VISIBILITY in the current viewport** | ✅ **Naturally changes.** A smaller rendered UI lets more of the same page fit at once |
| **3** | **Structural LAYOUT** | 🔴 **Stable** for structured desktop surfaces |

⚠ **“More information visible” is never “more information exists.”** **Zooming out exposes more of the SAME page; it does not load, add or introduce anything.** **Zooming in exposes less of it; it does not remove anything.**

> **RULE 7.3.a — Zoom is presentation only. It must NEVER affect** query result count · pagination page size · loaded records · permissions · available actions · fields · workflow · business state · calculations · sorting · filtering · API behaviour.
>
> ⚠ **Only an explicit, independent user action changes any of those.** **A zoom-driven change to any of them is a defect, not a feature.**

## 7.4 🔴 Structured operational rows do not wrap

> **RULE 7.4 — A structured operational row preserves its horizontal composition under viewport pressure.**

**Applies ERP-wide wherever a component is intentionally horizontal or table-like:** order rows and cards · table-like operational rows · financial rows · payroll rows · inventory rows · compact metadata rows · action and status rows · pagination and control rows.

**Prohibited — a row must not become this because zoom increased or width reduced:**

```
Product | Total Amount | Delivery | Status | Actions

                    ↓  PROHIBITED

Product | Total Amount
Delivery | Status
Actions
```

**Preserved under pressure:** column order · column relationships · amount placement · status placement · action placement · identifiers · row identity · scan direction.

⚠ **Wrapping a structured row destroys scanability**, which is the operational property these surfaces exist to provide.

## 7.5 🔴 Preserve composition before structural reflow

> **RULE 7.5 — When the minimum usable composition exceeds the available viewport, content may extend beyond the immediately visible area. Structural wrapping is not the answer.**
>
> ⚠ **This Article deliberately does NOT mandate that every affected component carries its own horizontal scrollbar.** **The architectural invariant is *preserve composition before structural reflow*.** ✅ **The access mechanism per surface — controlled container overflow, page-level overflow, or another composition-preserving technique — is a UI/UX Architecture decision, not a design-foundation one.**
>
> **What is forbidden is solving width pressure by arbitrary structural wrapping.**

> **RULE 7.5.a — No global `flex-wrap: wrap`, automatic card stacking, automatic metadata wrapping or arbitrary responsive column collapse for structured operational components.**

## 7.6 ✅ One technique does not fit every surface

> **RULE 7.6 — Desktop-first does not mean a fixed-width canvas.** **The shell and ordinary page surfaces still use available width intelligently.** **The requirement is responsiveness that does not destroy operational information structure.**

| Surface | Governed by |
|---|---|
| **Application shell** | Fixed sidebar, fluid main region (§4.2) |
| **Operational list rows and data tables** | 🔴 **RULE 7.4 — composition preserved** |
| **Dashboard grids** | ⚠ The KPI grid is `repeat(4, minmax(0,1fr))`; its behaviour under pressure is **NOT DEFINED BY SOURCE** |
| **Detail pages** | ✅ The `320px` rail may wrap below the main column — a **page-REGION** reflow, explicitly permitted |
| **Forms** | 🔴 **NOT DEFINED BY SOURCE** — no form screen is approved |
| **Reports** | 🔴 **NOT DEFINED BY SOURCE** |
| **Printable documents** | Governed by `DOCUMENT_ARCHITECTURE.md`, not here |

✅ **The detail rail and an operational row are different subjects.** **Reflowing a page column is a layout decision; reflowing a row destroys a record's readability.**

## 7.7 Text content is a separate concern

> **RULE 7.7 — This Article creates NO global `white-space: nowrap` rule.**

| | |
|---|---|
| **Structural wrapping** — changing the geometry or order of fields and columns | 🔴 **Prohibited by default for structured operational rows** |
| **Content wrapping** — long-form text wrapping inside an intentionally designed text region | ✅ **Permitted** — notes, remarks, descriptions, addresses where the component allows it, narrative content |

⚠ **Field-specific truncation, ellipsis, tooltip and expansion behaviour is UI/UX Architecture work and is NOT invented here.**

## 7.8 ✅ A surface-specific composition difference — not a conflict

**`Order Dashboard.dc.html` sets `flex-wrap: nowrap` on its page-header row. `Order Details.dc.html` sets `flex-wrap: wrap` on its title block.**

> **RULE 7.8 — This is a SURFACE-SPECIFIC COMPOSITION DIFFERENCE, not a business or design conflict.**

**Inspection of the wrapping element** — `ODT`, the flex container holding the title block — **confirms it is a page-level title/meta/action region, not an operational structured row:**

| Test | Result |
|---|---|
| **Is it a record row?** | ❌ **No.** It holds exactly two children — an identity group (`h1` + status badge + subtitle) and an action group (`Print invoice`, overflow, divider, utility icons, avatar) |
| **Is it repeated per record?** | ❌ **No.** It renders once per page |
| **Does it carry columns with a scan direction?** | ❌ **No.** There is no column relationship, no aligned amount, no per-record status or action |
| **Is it intentionally horizontal/table-like?** | ❌ **No.** It is a page header |

✅ **Therefore `RULE 7.4` does not reach it, and `ODT`'s `wrap` is permitted.**

> **RULE 7.8.a — Two surface classes, two behaviours.**
>
> | Surface class | Behaviour under pressure |
> |---|---|
> | **Operational / data rows** — intentionally horizontal, repeated per record, column relationships, scan direction | 🔴 **Must preserve horizontal structure. Must not structurally wrap** (`RULE 7.4`) |
> | **Page-level title / meta / action regions** | ✅ **May reflow where explicitly designed**, provided **business information, action identity and hierarchy are preserved** |
>
> 🔴 **RULE 7.8.b — Page-region reflow must NEVER be generalised to operational rows.** ⚠ **The permission granted above is exhausted at the page header.** **An implementer who reads “the detail page wraps” as licence to wrap a record row has made exactly the error `RULE 7.4` exists to prevent.**

⚠ **Which treatment the page header adopts ERP-wide remains a UI/UX Architecture decision.** **Both are permissible under this Article; consistency is a design choice, not a rule violation.** **Neither approved source file is altered by this Constitution.**

## 7.9 🔴 Accessibility — zoom must never be suppressed

> **RULE 7.9 — Browser zoom is a user right, not an unsupported action.**
>
> 🔴 **NEVER** disable browser zoom · manipulate viewport configuration to prevent it · force the user back to 100% · treat zoom as unsupported.
>
> ✅ **The interface must remain OPERABLE when zoomed.** **Horizontal movement to reach content is acceptable; preventing the user from zooming is not.**
>
> ⚠ **WCAG 2.2 SC 1.4.10 Reflow expects content to reflow at 400% without two-dimensional scrolling for most content, and explicitly EXCEPTS usages requiring two-dimensional layout — data tables among them.** **The structured operational rows this Article protects fall within that exception; ordinary prose and form content do not and must not be forced into horizontal scrolling.**

## 7.10 🔴 What remains undefined

| Undefined | Status |
|---|---|
| **Breakpoints** | 🔴 **NOT DEFINED BY SOURCE.** **None may be invented** |
| **Mobile and tablet operation** | 🔴 **NOT DESIGNED.** A future UI/UX decision; the corpus does not currently require mobile ERP operation |
| **Sidebar collapse behaviour** | 🔴 **NOT DEFINED BY SOURCE** |
| **Dashboard grid behaviour under pressure** | 🔴 **NOT DEFINED BY SOURCE** |
| **Form and report layout adaptation** | 🔴 **NOT DEFINED BY SOURCE** |
| **The per-surface overflow access mechanism** | ✅ **Deliberately left to UI/UX Architecture** (RULE 7.5) |
| **Minimum supported viewport width** | 🔴 **NOT DEFINED BY SOURCE** |

> **RULE 7.10 — No breakpoint may be invented, and this Article does not close the responsive question.** **It closes desktop layout stability under zoom and width pressure. Everything else stays open.**

## 7.11 Provenance note

⚠ **The business decision cites Daraz Seller Center captures at 80/90/100/110/125/150% as behavioural illustration.** **Those images were NOT supplied to this session, and nothing in this Article is derived from them** — **every rule above comes from the written business decision.** ✅ **Recorded so no future reader believes a visual source exists that does not.**

🔴 **Daraz is behavioural inspiration only.** **No Daraz branding, colour, typography, navigation or visual design enters this system.** **The TrioLoo Design Language remains visually authoritative in full.**

---


# Article VIII — Accessibility

## 8.1 Commitment

**WCAG 2.2 AA for normal operational text.** Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text, UI boundaries, state indicators and focus indication.

## 8.2 🔴 The old accessibility register is void

**v1.x carried `A11Y-01` (orange active label ≈2.5:1) and orange-specific rulings including `RULE 0.2`, `RULE 2.1.a`, `RULE 2.1.b` and `RULE 2.1.c`.** ✅ **All are obsolete — no orange interaction colour exists.** **The `--ink-on-accent` treatment is void with them.**

## 8.3 ✅ MEASURED against the approved palette — 2026-08-10

✅ **v2.0.0 recorded nine pairs as `NOT YET MEASURED` and refused to state ratios it had not computed. They are now COMPUTED.** **Twenty-one pairs were evaluated — the nine registered pairs plus every additional pair the token matrix actually produces.**

**Method (`RULE 8.5`):** each `oklch()` token is converted OKLCH → OKLab → linear sRGB → **gamut-clamped** sRGB → WCAG 2.x relative luminance `0.2126R + 0.7152G + 0.0722B` on linearised channels → ratio `(L1 + 0.05) / (L2 + 0.05)`. **The hex shown is the COMPUTED rendering of the OKLCH token, published for verification only.** ⚠ **It is not a second source of truth** (`RULE 15.1`).

| # | Pair | Computed | Ratio | Req | Verdict |
|---|---|---|---|---|---|
| **A11Y-01a** | Text secondary `oklch(0.55 0.015 290)` on `#FFFFFF` | `#71707A` | **4.87** | 4.5 | ✅ **PASS** |
| **A11Y-01b** | Text secondary `oklch(0.543 0.015 290)` on app bg `oklch(0.968 0.003 290)` | `#6E6D77` on `#F4F4F6` | **4.58** | 4.5 | ✅ **PASS — RE-MEASURED v2.12.0.** ⚠ **The superseded pair measured `4.66`; on the deeper ground alone it would have fallen to `4.45`, so the text token was darkened** (`RULE 3.4.a.e`) |
| **A11Y-02a** | Faint `oklch(0.6 0.012 290)` on `#FFFFFF` — **10px micro-labels** | `#807F87` | **3.96** | 4.5 | 🔴 **FAIL** |
| **A11Y-02b** | Placeholder `oklch(0.65 0.01 290)` on `#FFFFFF` — **13px** | `#8F8E95` | **3.24** | 4.5 | 🔴 **FAIL** |
| **A11Y-03a** | Amber badge fg on amber bg | `#684600` / `#FFECC1` | **7.30** | 4.5 | ✅ **PASS** |
| **A11Y-03b** | Green badge fg on green bg | `#005129` / `#D2F6DD` | **8.10** | 4.5 | ✅ **PASS** |
| **A11Y-03c** | Blue badge fg on blue bg | `#004E95` / `#D8EEFF` | **7.00** | 4.5 | ✅ **PASS** |
| **A11Y-03d** | Red badge fg on red bg | `#A5292B` / `#FFE5E1` | **5.93** | 4.5 | ✅ **PASS** |
| **A11Y-03e** | Gray badge fg on gray bg | `#55545B` / `#EEEEF1` | **6.44** | 4.5 | ✅ **PASS** |
| **A11Y-04** | `#FFFFFF` on ink `oklch(0.2 0 0)` — primary button, active segment, active page | `#FFFFFF` / `#161616` | **18.10** | 4.5 | ✅ **PASS** |
| **A11Y-05** | Secondary-button text `oklch(0.25 0 0)` on `#FFFFFF` | `#222222` | **16.00** | 4.5 | ✅ **PASS** |
| **A11Y-06** | Inactive segment `oklch(0.5 0.015 290)` on `#FFFFFF` — 13px | `#63626B` | **6.02** | 4.5 | ✅ **PASS** |
| **A11Y-07** | Active nav `oklch(0.2 0 0)` on `oklch(0.93 0 0)` | `#161616` / `#E8E8E8` | **14.73** | 4.5 | ✅ **PASS** |
| **A11Y-08a** | Card border `oklch(0.93 0.006 290)` on `#FFFFFF` | `#E8E7EC` | **1.23** | 3.0 | ⚠ **NOT APPLICABLE — §8.4** |
| **A11Y-08b** | Control border `oklch(0.9 0.006 290)` on `#FFFFFF` | `#DEDDE2` | **1.35** | 3.0 | 🔴 **FAIL — APPLICABLE** |
| **A11Y-08c** | Secondary-button border `oklch(0.75 0 0)` on `#FFFFFF` | `#AEAEAE` | **2.23** | 3.0 | 🔴 **FAIL — APPLICABLE** |
| **A11Y-08d** | Card border on app bg `oklch(0.985 0.004 290)` | `#E8E7EC` | **1.18** | 3.0 | ⚠ **NOT APPLICABLE — §8.4** |
| **A11Y-08e** | **Icon-only button border `oklch(0.9 0.006 290)` on app bg** — `ODT` `⋮` More actions | `#DEDDE2` | **1.29** | 3.0 | 🔴 **FAIL — APPLICABLE.** ⚠ **NEWLY FOUND in v2.3.0; never in the register** |
| **A11Y-08f** | **Detail-tab ACTIVE state `#FFFFFF` on container `oklch(0.96 0.004 290)`** | `#FFFFFF` / `#F2F1F4` | **1.12** | 3.0 | ⚠ **CONDITIONAL — §8.4.** ⚠ **NEWLY FOUND in v2.3.0** |
| **A11Y-09** | **Focus indication** — neutral ring `oklch(0.6 0 0)` on white / ground / strip / active-nav | `#808080` | **3.95 / 3.60 / 3.72 / 3.22** | 3.0 | ✅ **PASS — CLOSED v2.12.0 by `RULE 6.0.c`.** ⚠ **Superseded: interim ink floor `RULE 6.0.a`** |
| **A11Y-10** | Heading `oklch(0.18 0.02 290)` on `#FFFFFF` | `#11101A` | **18.85** | 4.5 | ✅ **PASS** |
| **A11Y-11** | Text primary `oklch(0.24 0.02 290)` on `#FFFFFF` — 14px body | `#1F1E28` | **16.51** | 4.5 | ✅ **PASS** |
| **A11Y-12** | Base text `oklch(0.22 0.02 290)` on app bg | `#1A1923` / `#FAFAFD` | **16.62** | 4.5 | ✅ **PASS** |
| **A11Y-13** | Margin green `oklch(0.38 0.1 155)` on `#FFFFFF` — 15px/700 money | `#005129` | **9.49** | 4.5 | ✅ **PASS** |

✅ **Fifteen text pairs PASS. Two text pairs FAIL. Two boundary pairs FAIL. Two boundary pairs are NOT APPLICABLE.**

> **RULE 8.5 — ✅ Contrast is COMPUTED, never estimated.** **A ratio in this Constitution is the output of the method above.** 🔴 **No ratio is ever asserted from appearance, from a screenshot, or from a design tool's on-canvas readout.** ⚠ **sRGB gamut clamping is part of the definition** — an OKLCH value outside sRGB renders clamped, and the clamped value is what a user sees and therefore what is measured.

> **RULE 8.5.a — 🔴 The pre-measurement risk assessment was WRONG and is retained as a record.** **v2.0.0 marked `A11Y-01` `HIGHEST RISK`; it PASSES at 4.87 and 4.66.** **The actual failures were `A11Y-02a`/`A11Y-02b` and the control boundaries.** ⚠ **This is exactly why `RULE 8.5` forbids estimation:** a plausible ranking by eye mis-identified both the failing pairs and the safe one.

## 8.4 🔴 Which boundaries SC 1.4.11 governs — ruled PER CONTROL CLASS

**SC 1.4.11 requires ≥ 3:1 for `visual information required to identify user interface components and states`.** ⚠ **It does not require 3:1 for every visible line.** **The test is whether the boundary IS the information that identifies a control or its state.**

> **RULE 8.6 — A boundary is measured against 3:1 only when it CARRIES IDENTIFICATION.** **Apply this test, in order:**
>
> **1.** Is the bounded element an interactive user interface component or a state indicator? **If no — the criterion does not apply.**
> **2.** If the boundary were removed, could the component still be identified as that component, and its state still be read, from its fill, its label, its position or another visual cue? **If yes — the criterion does not apply to the boundary.**
> **3.** Otherwise the boundary is the identifying information and **must reach 3:1.**
>
> 🔴 **A failing ratio on a boundary that fails test 1 or test 2 is not an accessibility defect, and darkening it to `pass` a criterion that does not apply would degrade the approved visual language for no accessibility benefit.**

> **RULE 8.6.b — 🔴 ADJACENCY: a control boundary has TWO adjacent colours and must meet 3:1 against BOTH.** **A bordered control separates its own `#FFFFFF` fill (inside) from the surface it sits on (outside).** ⚠ **In `OD` and `ODT` every control-bordered element sits directly in `<main>`, whose ground is the app background `oklch(0.985 0.004 290)` — NOT white.** **Row-action buttons sit inside a card and therefore on `#FFFFFF`.** 🔴 **The app background is DARKER than white, so it is the STRICTER adjacency, and a boundary must be designed against it.**
>
> 🔴 **v2.2.0's `§8.5` candidates were computed against WHITE ONLY and are INSUFFICIENT.** **`oklch(0.669 0.006 290)` measures `3.01` on white but only `2.87` on the app background — it FAILS where these controls actually live.** ✅ **The governing value is `oklch(0.658 0.006 290)`: `3.13` on white, `3.00` on the app background.** ⚠ **The v2.2.0 figure is superseded and retained below as the record of the error.**

> **RULE 8.6.c — ✅ PROVEN NEGATIVE: a GROUPED control whose active member carries the ink fill needs NO boundary remediation.** **The approved source renders the segmented control, the channel filter, the period filter and the list status tabs as a container holding exactly one permanently-present active member filled `oklch(0.2 0 0)`.** **Measured: `17.33` against the app background, `18.10` against a white container.**
>
> ✅ **The component and its state are therefore identified far above 3:1 by information that ALREADY EXISTS in the approved design.** 🔴 **The container boundary carries no identification and is not governed.**
>
> ⚠ **The approved source proves this is deliberate, not accidental: INACTIVE segments have NO individual boundary at all — not a failing one, none.** **The design's own position is that within a segmented group the filled active state is the identifier.** ✅ **Nothing is changed for these classes.**

| Control class | Approved treatment (source-verified) | Sits on | Boundary the sole cue? | Ruling |
|---|---|---|---|---|
| **Text input** — search | `OD` only. `34×280px`, radius `9px`, `#FFFFFF` fill, border `1px oklch(0.9 0.006 290)`. **No icon. No label. Placeholder only** | app bg | ✅ **YES** | 🔴 **FAIL.** **Text is excluded from 1.4.11, so the placeholder cannot rescue it.** **The W3C canonical example of this exact failure** |
| **Select** — page size | `OD`. Native `<select>`, radius `9px`, `#FFFFFF`, border `1px oklch(0.9 0.006 290)`. ⚠ **`appearance` is NOT suppressed — the user-agent dropdown indicator survives** | app bg | ⚠ **CONDITIONAL** | ⚠ **CONDITIONAL FAIL.** **SC 1.4.11 exempts appearance `determined by the user agent and not modified by the author`, and the indicator identifies it.** 🔴 **But the author already modified border, radius, padding and fill, and production commonly suppresses the indicator. The Constitution cannot guarantee it survives** |
| **Select** — bulk bar | `OD`. Border **`1px oklch(0.88 0.006 290)`** on the `oklch(0.93 0 0)` bulk-bar fill; white fill contrast `1.23` | bulk bar | ⚠ **CONDITIONAL** | ⚠ **Same ruling, plus a token defect — see below.** **Boundary `1.17` against its own bar** |
| **Segmented control** — channel and period filters | `DL`/`OD`. Container border `1px oklch(0.9 0.006 290)`, `#FFFFFF`; **permanent active segment filled `oklch(0.2 0 0)` with `#FFFFFF` text**; inactive segments have **no boundary at all** | app bg | 🔴 **NO** | ✅ **SATISFIED — NO CHANGE** (`RULE 8.6.c`). **17.33:1** |
| **Status tabs** — list | `OD`. Container border `1px oklch(0.93 0.006 290)` — **the CARD token, not the control token** — plus a permanent dark-filled active tab | app bg | 🔴 **NO** | ✅ **SATISFIED — NO CHANGE.** ⚠ **Not part of `A11Y-08b` at all** |
| **Detail tabs** | `ODT`. Container `oklch(0.96 0.004 290)` tinted fill with **NO border whatsoever**; active tab `#FFFFFF` + shadow `0 1px 3px oklch(0 0 0 / 0.08)`; active text `oklch(0.18 0.02 290)` vs inactive `oklch(0.5 0.015 290)` | white/app bg | — | ⚠ **CONDITIONAL — `A11Y-08f`.** **The active FILL is only `1.12`.** ✅ **But the state is also carried by text colour measuring `18.85` active vs `5.36` inactive, both compliant under 1.4.3.** 🔴 **NEWLY DISCOVERED and never previously measured — recorded, not closed** |
| **Pagination** — prev / next / numbered | `OD`. Each `32×32px`, radius `9px`, `#FFFFFF`, its OWN border `1px oklch(0.9 0.006 290)`; **active page `border: none` + `oklch(0.2 0 0)` fill** | app bg | ✅ **YES** | 🔴 **FAIL.** ⚠ **`RULE 8.6.c` does NOT rescue these: unlike segments, each button carries its own boundary and is a DISCRETE control whose hit area the boundary defines.** **Convention is not visual information** |
| **Icon-only button** — `⋮` More actions | `ODT`. `40×40px`, `#FFFFFF`, border `1px oklch(0.9 0.006 290)`, glyph `oklch(0.48 0.015 290)`. **No text label** | app bg | ✅ **YES, unambiguously** | 🔴 **FAIL — `A11Y-08e`, the SHARPEST case in the corpus.** **A white square on a near-white ground with a `1.29` outline and no label.** ⚠ **NEWLY DISCOVERED in v2.3.0** |
| **Secondary button** — text | `DL`/`OD`/`ODT`. `#FFFFFF` fill, border `1px oklch(0.75 0 0)`, text `oklch(0.25 0 0)` at `16.00` | app bg **and** white | ✅ **YES** | 🔴 **FAIL — `A11Y-08c`.** **The label is text under 1.4.3; the boundary is what makes it a button and defines its hit area** |
| **Ghost / utility icon buttons** — bell, chat | `OD`/`ODT`. `border: none`, transparent, hover fill only | app bg | — | ⚠ **OUT OF SCOPE of `A11Y-08b`.** **They have no boundary to measure.** 🔴 **Whether a boundary-less control satisfies 1.4.11 is a SEPARATE open question, recorded not resolved** |
| **Cards, panels, right rail, dividers** | `oklch(0.93 0.006 290)` / `0.95` / `0.96` | — | — | ✅ **NOT GOVERNED — UNCHANGED** (`§8.4`, v2.2.0). **Grouping containers, not components** |

> **RULE 8.10 — ✅ THE GOVERNING PRINCIPLE: SELF-IDENTIFYING CONTENT.** **A control that carries its own permanently-visible identifying content — a text label, a numeral, or an icon — that already meets its own contrast requirement IS identified by that content.** 🔴 **Its boundary is then SUPPLEMENTARY and is not governed by SC 1.4.11.** **A control whose interior is EMPTY by default, or holds only a transient hint, has nothing but its boundary to identify it — and that boundary MUST reach 3:1.**
>
> ✅ **This is not a convenience reading. The approved design language ITSELF ratifies the premise:** **`Design Language.dc.html` defines a GHOST button — `background: transparent; border: none` — identified by its label alone, and `OD`/`ODT` use ghost text actions (`Reset`, `Clear`, `View all`, `View items →`) and ghost icon actions (bell, chat) with NO boundary whatsoever.**
>
> 🔴 **The decisive consequence: if a boundary-LESS control is compliant because its content identifies it, then the SAME control with a faint boundary added cannot be LESS compliant.** **A supplementary hairline never converts a compliant control into a failing one.** ⚠ **The inverse is the real defect: an EMPTY control relying on a hairline.**

> **RULE 8.11 — ✅ ICON ACTION TAXONOMY, derived from approved composition, not invented.** **Both screen files place a `1px oklch(0.91 0.006 290)` vertical divider in the page-header action area, and the split is consistent across both:**
>
> **a. GHOST / UTILITY icon actions** — **right of the divider** (notifications, chat). **`border: none`, transparent, hover fill only.** ✅ **Identified by the icon stroke: measured `6.28` on the app background.** 🔴 **They require NO boundary and one must not be added.**
> **b. BORDERED icon actions** — **left of the divider, inside the action cluster** (`ODT`'s `⋮`). **`#FFFFFF` fill with the control boundary.** ✅ **Identified by the glyph: measured `6.56`.** **The boundary is supplementary** (`RULE 8.10`).
>
> ⚠ **The distinction is PAGE ACTION versus SHELL UTILITY, and the approved source draws it with a literal divider.** 🔴 **It is not a licence to give any icon a box: an icon action outside the page-header action cluster follows (a).**

> **RULE 8.12 — ✅ `A11Y-08f` CLOSED — the detail-tab active state is NOT a defect.** **The state is carried by three signals, and the low-contrast one is not load-bearing:**
>
> **a.** **Active label `oklch(0.18 0.02 290)` measures `18.85`; inactive label `oklch(0.5 0.015 290)` measures `5.36` on its own container. Both satisfy 1.4.3 independently.**
> **b.** **The two labels differ from EACH OTHER by `3.13` — the state change itself exceeds 3:1.**
> **c.** **The white raised surface is a non-colour, shape-based cue, so SC 1.4.1 is satisfied and colour is not the sole carrier.**
>
> 🔴 **The `1.12` fill contrast is therefore reinforcing decoration, not the information required to identify the state.** ✅ **The detail-tab system is NOT darkened. No token changes.**

> **RULE 8.13 — ✅ `oklch(0.88 0.006 290)` MAPS to the canonical control-boundary primitive. Disposition B.** **It occurs EXACTLY ONCE in the entire approved corpus — the bulk-action-bar select — measures `1.17` against its own bar, and `Design Language.dc.html` defines only ONE control border.** 🔴 **It carries no stated role, has no second occurrence, and no rule anywhere distinguishes `a select on a tinted surface`.** ⚠ **It is therefore a source one-off with no systemic meaning, and it is DOCUMENTED as mapping to `oklch(0.9 0.006 290)` — not silently added as a primitive, and not silently rewritten in the source.**

### 🔴 Source / token-matrix defect found during this inspection

**`Order Dashboard.dc.html`'s bulk-action-bar select declares `border: 1px solid oklch(0.88 0.006 290)`.** ⚠ **`oklch(0.88 0.006 290)` appears NOWHERE in Article III** — `§3.2`, `§3.6` and `§3.12` record only `oklch(0.9 0.006 290)` for control borders. 🔴 **This is a THIRD control-boundary value present in approved source and omitted from the reconciled token matrix.** **It is recorded here as a deterministic documentation defect** (`CLAUDE.md §13`). ⚠ **It is NOT silently added to Article III and NOT silently normalised to `0.9`** — **whether the source intends three boundary values or two is a design question, and `§12.3` owns it.**

## 8.5 🔴 Remediation strategies EVALUATED — `A11Y-08b` is NOT CLOSED

**`RULE 8.3` is not suspended and no Article III token is altered.** **Four strategies were evaluated and every candidate measured.**

### Corrected deterministic candidates

> **RULE 8.6.a — ✅ A remediation candidate preserves HUE and CHROMA and changes LIGHTNESS ONLY, and is the MINIMUM change that meets the threshold against EVERY adjacency it must survive** (`RULE 8.6.b`). 🔴 **No replacement is selected by eye, sampled from a raster, or picked from a palette generator.**

| Failure | Approved token | Ratio (white / app bg) | v2.2.0 candidate | 🔴 CORRECTED candidate | New ratio | ΔL |
|---|---|---|---|---|---|---|
| **A11Y-02a** faint / 10px micro-label | `oklch(0.6 0.012 290)` | 3.96 | ~~`oklch(0.568 0.012 290)`~~ **INSUFFICIENT** | 🔴 **`oklch(0.548 0.012 290)`** `#717078` | **4.85 white / 4.50 user block / 4.68 app bg** | **−0.052** |
| **A11Y-02b** placeholder / 13px | `oklch(0.65 0.01 290)` | 3.24 | `oklch(0.568 0.01 290)` | ✅ **CONFIRMED UNCHANGED** — source-verified: this token appears only inside a `#FFFFFF` input fill and on the `#FFFFFF` sidebar | **4.51** | −0.082 |

🔴 **`RULE 8.6.b` also corrects `A11Y-02a`.** **v2.2.0 assumed faint text sits on white. Source inspection shows it ALSO renders the sidebar user-block role line on `oklch(0.97 0.004 290)`, where the v2.2.0 candidate measures only `4.14`.** ✅ **The governing candidate across all three surfaces is `oklch(0.548 0.012 290)`.** ⚠ **ΔL −0.052 — still a minor change; `A11Y-02a` and `A11Y-02b` therefore NO LONGER converge on a single value, and the `L = 0.568` `single text-faint floor` claimed in v2.2.0 is WITHDRAWN.**
| **A11Y-08b** control boundary | `oklch(0.9 0.006 290)` | **1.35 / 1.29** | ~~`oklch(0.669 0.006 290)`~~ **INSUFFICIENT — 2.87 on app bg** | **`oklch(0.658 0.006 290)`** `#919195` | **3.13 / 3.00** | **−0.242** |
| **A11Y-08c** secondary-button boundary | `oklch(0.75 0 0)` | **2.23 / 2.13** | ~~`oklch(0.669 0 0)`~~ **INSUFFICIENT — 2.87 on app bg** | **`oklch(0.658 0 0)`** `#919191` | **3.14 / 3.00** | **−0.092** |

🔴 **The two boundaries CONVERGE at `L = 0.658` — mutual contrast `1.0002`, i.e. the same colour.** ⚠ **`§3.6` records the secondary-button border as `Deliberately darker for affordance`. That intentional hierarchy CANNOT survive remediation: both boundaries need exactly 3:1 and therefore land on the same lightness.** 🔴 **Preserving the hierarchy would require inventing a darker button value that no approved source supports.**

### Strategy evaluation

| # | Strategy | Measured result | Verdict |
|---|---|---|---|
| **A** | **Darken the boundary** to the deterministic minimum | `oklch(0.658 0.006 290)` — **3.13 / 3.00**. ΔL **−0.242** on every input, select, pagination button and icon button | ✅ **Accessible.** 🔴 **Not faithful** — a visible change to every control in the product, supported by NO approved reference |
| **B** | **Keep a light boundary, identify the control by its FILL instead** | 🔴 **ARITHMETICALLY DEAD.** A fill must reach `oklch(0.658 ...)` to identify at 3:1 — **a mid-grey input field.** **Every tinted fill in the approved language measures 1.12–1.23**: detail-tab container `1.12`, nav active `1.23`, bulk bar `1.18`, thumb placeholders `1.12` | 🔴 **REJECTED ON MEASUREMENT**, not on taste. **It is a LARGER visual change than A, not a smaller one** |
| **C** | **Reuse an already-approved canonical distinction** | ✅ **WORKS for GROUPED controls** — the permanent ink-filled active member measures **17.33 / 18.10** (`RULE 8.6.c`). 🔴 **No approved distinction exists for STANDALONE controls**: every canonical token that reaches 3:1 on both adjacencies is a TEXT or ICON-STROKE colour (`0.5`, `0.55`, `0.6`, `0.65`), none is a boundary treatment for a control | ✅ **ADOPTED for grouped controls.** 🔴 **Unavailable for standalone controls** |
| **D** | **Narrowly scoped combination** — C for grouped, A for standalone | ✅ **Removes segmented controls, both filters and the status tabs from scope with ZERO change.** 🔴 **Leaves the input, both selects, pagination buttons, the icon-only button and the secondary button needing A** | ✅ **The correct SHAPE of the answer.** 🔴 **Its standalone half still fails the fidelity test** |

> **RULE 8.9 — 🔴 `A11Y-08b` DISPOSITION: PARTIALLY RESOLVED, REMAINDER BLOCKED.**
>
> ✅ **RESOLVED WITH NO CHANGE — segmented control, channel filter, period filter, list status tabs.** **Proven by measurement under `RULE 8.6.c`. These classes leave `A11Y-08b` permanently.**
> ✅ **CONFIRMED UNCHANGED — cards, panels, right rail, dividers and every passive grouping container** (`§8.4`). 🔴 **The control remediation is NOT propagated to them, and control boundary and card boundary REMAIN SEPARATE TOKENS.**
> 🔴 **BLOCKED — text input, both selects, pagination buttons, icon-only button, secondary button.** **A compliant value exists and is computed above, but it satisfies only two of the four conditions this Constitution requires: it is ACCESSIBLE and introduces NO COMPETING SYSTEM, yet it is NOT REFERENCE-FAITHFUL** — **ΔL −0.242 visibly changes every control surface and no approved capture shows a control at that boundary weight** — **and it cannot preserve the deliberate `0.9` / `0.75` hierarchy that `§3.6` records.**
>
> ⚠ **There is no lighter compliant option. That is proven, not assumed.** 🔴 **The remaining choice is a VISUAL DESIGN DECISION and belongs to the business:** **(1) ratify `oklch(0.658 …)` and accept the darker control language; (2) redesign the affected controls so identification does not rest on a hairline — which `§12.3` requires be DESIGNED and CAPTURED first; or (3) record a ratified acceptance of a known AA failure.**
>
> 🔴 **This Constitution does not choose, and does not close `A11Y-08b` by changing a token to make the finding disappear** (`RULE 8.3`, `RULE 8.7`).

> **RULE 8.3 — 🔴 Where an approved source value fails AA, the failure is REPORTED, not silently corrected.** ⚠ **This Constitution never alters an approved token to make a ratio pass.** **The finding is recorded; the design decision belongs to the business.** ✅ **RETAINED UNCHANGED — §8.5 computes candidates, it does not apply them; no token in Article III was altered in v2.2.0.**
>
> **RULE 8.4 — Colour is never the sole carrier of meaning.** **Every status badge pairs colour with a word.** ✅ **The approved source already complies: every badge is labelled.**

## 8.6 ✅ FINAL RATIFICATION PASS — 2026-08-11

**Every open control finding was re-examined against `RULE 8.10`. The approved source files were read in full, not taken from the reconciliation record.**

| Finding | Class | Identifying content (measured) | Disposition |
|---|---|---|---|
| **A11Y-08b** | **Segmented control, channel and period filters, status tabs** | Active segment fill **18.10** · inactive segment label **6.02** | ✅ **CLOSED — no change** (`RULE 8.6.c`, `RULE 8.10`) |
| **A11Y-08b** | **Pagination — prev, next, numbered** | Numeral **16.51** · `‹`/`›` glyph **6.02** · active page fill **17.33** | ✅ **CLOSED — no change.** 🔴 **Supersedes the v2.3.0 `FAIL`: each button carries its own compliant glyph, so its boundary is supplementary** |
| **A11Y-08b** | **Select — page size and bulk bar** | Selected-value text **16.51**, always present; a select is NEVER empty | ✅ **CLOSED — no change.** 🔴 **Supersedes the v2.3.0 `CONDITIONAL FAIL`; the ruling no longer depends on the user-agent indicator surviving implementation** |
| **A11Y-08c** | **Secondary button** | Label **16.00** | ✅ **CLOSED — no change.** 🔴 **Supersedes v2.3.0. The approved GHOST button proves a label alone identifies a button** |
| **A11Y-08e** | **Bordered icon button `⋮`** | Glyph **6.56** | ✅ **CLOSED — no change** (`RULE 8.10`, `RULE 8.11`) |
| **—** | **Ghost / utility icon actions** | Icon stroke **6.28** | ✅ **CLOSED — no boundary required, none added** (`RULE 8.11`) |
| **A11Y-08f** | **Detail-tab active state** | Labels **18.85** / **5.36**, state-change **3.13** | ✅ **CLOSED — not a defect** (`RULE 8.12`) |
| **A11Y-08a/d** | **Cards, panels, rail, dividers** | Grouping containers, not components | ✅ **CONFIRMED UNCHANGED** |
| **0.88 token** | **Bulk-bar select boundary** | — | ✅ **RESOLVED — maps to the canonical control boundary** (`RULE 8.13`) |
| **A11Y-02a** | **Grey text tiers** | — | ✅ **RESOLVED** (`RULE 8.14`) |
| **A11Y-02b** | **Placeholder** | — | ✅ **RESOLVED** (`RULE 8.14`) |
| **A11Y-08b** | **TEXT INPUT** | **None — empty by default, so the boundary IS the identification** | ✅ **CLOSED 2026-08-11** (`RULE 8.17`) — **`RULE 8.15` DISCHARGED by the approved `Form Design Language.dc.html`** |

✅ **NO BOUNDARY TOKEN CHANGES. The entire approved boundary hierarchy survives intact:** **card `oklch(0.93 0.006 290)` · control `oklch(0.9 0.006 290)` · secondary action `oklch(0.75 0 0)` · inner divider `0.95` · light divider `0.96`.** 🔴 **Nothing was collapsed into a universal border token, and nothing was darkened for numerical symmetry.**

> **RULE 8.14 — ✅ THE GREY TEXT TIERS: two collapsed semantics, resolved onto EXISTING tokens.** **Source inspection shows reconciliation gave one value to two different jobs, twice.**
>
> **a. `oklch(0.6 0.012 290)` serves BOTH an ICON STROKE and a TEXT colour.** ✅ **As an icon stroke it needs 3:1 and measures `3.96` — it PASSES and is RETAINED UNCHANGED.** 🔴 **As text it needs 4.5 and fails on both surfaces it renders on (`3.96` on a white card, `3.63` on the sidebar user block).** ⚠ **These are two primitives, not one failing token.**
> **b. `oklch(0.65 0.01 290)` serves BOTH `::placeholder` AND the sidebar section labels (`MAIN`, `ADMIN`).** 🔴 **The section-label usage appears in NO Article III row — a second reconciliation omission.**
>
> **Resolution, derived from how the approved source already colours the SAME semantic role elsewhere:**
>
> | Usage | Was | Becomes | Measured | Justification from source |
> |---|---|---|---|---|
> | **Nav icon stroke** | `oklch(0.6 0.012 290)` | ✅ **UNCHANGED** | **3.96** vs 3.0 | Non-text; already compliant |
> | **Demoted metric micro-label** | `oklch(0.6 0.012 290)` | **`oklch(0.568 0.012 290)`** | **4.51** vs 4.5 | ΔL −0.032. ✅ **Still LIGHTER than the primary metric label `0.55`, so the `§3.15` demotion hierarchy is PRESERVED** |
> | **Sidebar user-block role line** | `oklch(0.6 0.012 290)` | ✅ **Muted `oklch(0.5 0.015 290)`** — an EXISTING token | **5.52** on the user block | **It is a subtitle, and `OD`/`ODT` already colour every page subtitle with Muted.** ✅ **No new token** |
> | **Sidebar section label** | `oklch(0.65 0.01 290)` | ✅ **Text secondary `oklch(0.55 0.015 290)`** — an EXISTING token | **4.87** on white | **`OD`'s `FILTER` label is the same object — uppercase, `700`, letter-spaced — and already uses Text secondary.** ✅ **No new token** |
> | **Placeholder** | `oklch(0.65 0.01 290)` | **`oklch(0.568 0.01 290)`** | **4.51** vs 4.5 | ΔL −0.082. **Renders only inside a `#FFFFFF` input fill** |
>
> ✅ **Two of the four text failures need NO new token at all — they map onto existing canonical colours already used for the identical semantic role.** ⚠ **The two remaining values coincide numerically at `L 0.568` because both are text-on-white at the AA floor; they remain SEPARATE tokens and the withdrawn v2.2.0 `single text-faint floor` claim is NOT reinstated.**

> **RULE 8.15 — 🔴 THE TEXT INPUT IS BLOCKED. A NEW APPROVED VISUAL REFERENCE IS REQUIRED.**
>
> **It is the ONLY component in the corpus that fails `RULE 8.10`, and it fails twice: its boundary measures `1.29` on the app background and `1.35` on a card, and its placeholder measures `3.24`.** 🔴 **An input is EMPTY by default. Placeholder text is a transient hint that disappears on typing, and it is not identifying content.** **This is the canonical WCAG failure case and there is no reading that closes it.**
>
> **The minimum compliant boundary is `oklch(0.658 0.006 290)` `#919195` — `3.13` on white, `3.00` on the app background, ΔL −`0.242`.** ⚠ **It is deterministic and there is nothing lighter that passes — proven, not assumed.**
>
> 🔴 **It is NOT ratified here, because it fails condition 2 of `§12.5`:**
> **a.** **NO approved capture contains a control boundary at that weight.** **Fidelity cannot be demonstrated against a reference that does not exist.**
> **b.** **The input belongs to a surface class with NO approved reference at all.** **The entire corpus contains ONE input — an unlabelled search box on a list page — and ZERO form screens** (`RULE 4.1.b`, `§3.12`).
> **c.** **`§3.12` already records labelled-field layout, input focus, input error and input disabled as `NOT DEFINED BY SOURCE`.** ✅ **One new reference resolves all of them together; ratifying a boundary number now would pre-commit the ERP's entire form language to a value chosen without ever having seen a form.**
>
> ✅ **REQUIRED: an approved reference showing a FORM SURFACE** — **labelled text input, select, and the input's rest, focus, error and disabled states** — **rendered on both `#FFFFFF` and the app background.**
> ⚠ **Until then the input remains at its approved `oklch(0.9 0.006 290)` and the failure stays OPEN and VISIBLE** (`RULE 8.7`, `RULE 8.8`). 🔴 **It is NOT hidden by a local correction and NOT closed by changing a token.**

## 8.7 ✅ `A11Y-08b` CLOSED — the form reference ratification, 2026-08-11

> **RULE 8.17 — ✅ `RULE 8.15` IS DISCHARGED. `A11Y-08b` IS CLOSED IN FULL.** **The new visual reference `RULE 8.15` demanded was produced, reviewed and APPROVED, and `§3.18` ratifies it.** 🔴 **`RULE 8.15` is RETAINED unaltered as the record of the blocker and of exactly what discharged it.**
>
> ✅ **The enabled form-control boundary `oklch(0.65 0.006 290)` measures `3.24` on `#FFFFFF` and `3.10` on the app background — recomputed here, not copied from the approval report.** ⚠ **Note it exceeds the `oklch(0.658 …)` bare minimum: a clean two-decimal value with headroom was chosen so rounding and rendering cannot drag it under 3:1.**

**Complete form accessibility result — every load-bearing pair, both adjacencies, computed by the `RULE 8.5` method:**

| State | Pair | Measured | Req | Verdict |
|---|---|---|---|---|
| **Rest** | Boundary vs `#FFFFFF` | **3.24** | 3.0 | ✅ |
| **Rest** | Boundary vs app background | **3.10** | 3.0 | ✅ |
| **Focus** | Ink boundary vs `#FFFFFF` | **18.10** | 3.0 | ✅ |
| **Focus** | Ink boundary vs app background | **17.33** | 3.0 | ✅ |
| **Focus** | State change vs REST boundary | **5.59** | 3.0 | ✅ **identifiable by boundary alone** |
| **Error** | Boundary vs `#FFFFFF` | **7.11** | 3.0 | ✅ |
| **Error** | Boundary vs app background | **6.80** | 3.0 | ✅ |
| **Error** | Message text vs `#FFFFFF` / app bg | **7.11** / **6.80** | 4.5 | ✅ |
| **Error** | Outline marker vs `#FFFFFF` | **7.11** | 3.0 | ✅ |
| ⚠ **Error** | **State change vs REST boundary** | **2.19** | 3.0 | 🔴 **INSUFFICIENT ALONE — see `RULE 3.18.f`** |
| **Disabled** | Value text vs disabled fill | **5.36** | 4.5 | ✅ |
| **Disabled** | Boundary vs app background | 1.29 | — | ✅ **INACTIVE-COMPONENT EXEMPT** — SC 1.4.11 does not apply |
| **Text** | Label vs `#FFFFFF` / app bg | **4.87** / **4.66** | 4.5 | ✅ |
| **Text** | Entered value vs white fill | **16.51** | 4.5 | ✅ |
| **Text** | Placeholder vs white fill | **4.51** | 4.5 | ✅ |
| **Text** | Helper vs `#FFFFFF` / app bg | **4.87** / **4.66** | 4.5 | ✅ |
| **Text** | Required `*` vs `#FFFFFF` | **7.11** | 4.5 | ✅ |

✅ **Every applicable threshold is met on BOTH real adjacencies.** 🔴 **The one sub-threshold figure is the error-vs-rest boundary DELTA, which no criterion requires and which `RULE 3.18.f` converts into a hard rule: the message and marker are mandatory.**

> **RULE 8.18 — ✅ TOKEN AUDIT OF THE APPROVED REFERENCE, verified programmatically.** **Thirty-one distinct `oklch()` values, `#FFFFFF`, and no `rgb`/`rgba`/`hsl`.** ✅ **Exactly ONE genuinely new canonical value: `oklch(0.65 0.006 290)`.** **Every other colour, font size, radius and spacing step already existed in Articles III and VII.**
>
> ✅ **Prohibited-effect audit CLEAN:** **zero `transform: scale`, zero filters, zero gradients, zero opacity approximations, zero `text-shadow`, zero `@media`, zero `appearance` suppression on selects** (`Article XV`). **Exactly three shadows — the approved card elevation, the approved avatar ring, and the focus halo, which is a RING and not a third ELEVATION** (`RULE 3.6` intact).
>
> ✅ **The reference deliberately uses the v2.4.0-ratified sidebar text mappings rather than reproducing the superseded values still present in `OD`/`ODT` markup.** 🔴 **This is CORRECT and is recorded as such: the Constitution supersedes those usages, and screenshot fidelity never resurrects an inaccessible value** (`RULE 8.8`).

> **RULE 8.16 — ✅ `RULE 8.3` WAS EXERCISED, NOT BYPASSED.** **`RULE 8.3` reserves token changes to the business.** **The v2.4.0 text-tier changes were made under an explicit business ratification instruction and against the four conditions of `§12.5`.** 🔴 **No boundary token was touched, and the one finding that could not meet those conditions was BLOCKED rather than ratified.**

## 12.5 🔴 The ratification standard for a visual change

> **RULE 12.5 — A visual change is ratifiable ONLY when all four hold. Any one failing means the finding stays OPEN.**
>
> **1. ACCESSIBILITY** — it satisfies the applicable criterion against the STRICTEST REAL approved adjacency (`RULE 8.6.b`).
> **2. REFERENCE FIDELITY** — it is demonstrable against an approved capture of the affected surface class.
> **3. SEMANTIC VISUAL HIERARCHY** — card, control, secondary action, grouping container and divider remain DISTINCT classes.
> **4. IMPLEMENTATION DETERMINISM** — the exact `oklch()` value is fixed here. 🔴 **`the implementer chooses later` is never acceptable for a load-bearing visual primitive.**


---

# Article IX — Prohibited Visual Patterns

| Prohibited | Because |
|---|---|
| **A module-specific accent colour** | One accent, ERP-wide (§3.2) |
| **Semantic status colours used as decoration** | RULE 3.3.b |
| **A sixth status colour** | RULE 3.3.a |
| **Two primary actions in one header** | RULE 3.11 |
| **A third elevation, hover lift, coloured shadow or glow** | RULE 3.6 |
| **Gradients** | Not present in any approved source |
| **Filled icons** | RULE 3.17 — outline only |
| **Level-3 navigation** | RULE 4.3.a |
| **Converting the order card list into a data table** | §3.15 |
| **Inventing a breakpoint** | RULE 7.10 |
| **Wrapping a structured operational row under width or zoom pressure** | RULE 7.4 |
| **A global `flex-wrap: wrap` for structured components** | RULE 7.5.a |
| **Letting browser zoom change records, page size, fields or actions** | RULE 7.3.a |
| **Suppressing or defeating browser zoom** | RULE 7.9 |
| **Inventing a focus, disabled or empty state** | RULE 6.1 |
| **A persistent application footer** | RULE 3.16 |
| **A global header search** | §3.8 — removed in the final direction |
| **Arbitrary radii or type sizes outside §3.1/§3.5** | Token discipline |
| **Unnecessary card nesting** | Principle 6 |
| **Whitespace that reduces operational density** | RULE 5.1 |
| **A separate design system per module** | RULE 1.2 |
| **Suppressing focus indication** | RULE 6.0 |
| **`outline: none` without an equally visible replacement** | RULE 6.0.a |
| **Generalising a one-surface-class finding into an ERP-wide rule** | RULE 4.1.a |
| **Building a surface class that has no approved reference** | RULE 4.1.b |
| **Hard-coding hex in place of an Article III `oklch()` token** | RULE 15.1 |
| **Approximating a token with opacity** | RULE 15.1 |
| **Shipping on a fallback font, or on synthetic bold** | RULE 15.2 |
| **`transform: scale()` on text, app-level zoom simulation, CSS filters on text** | RULE 15.3 |
| **A global integer-pixel snapping rule** | RULE 15.4 |
| **Correcting a contrast failure locally in production code** | RULE 8.7 |
| **A fourth elevation, or the overlay elevation on any non-overlay surface** | RULE 3.6, RULE 3.6.a |
| **Citing a shadow as WCAG component identification** | RULE 3.6.b |
| **Red on anything but the three enumerated destructive placements** | RULE 3.3.c |
| **A red Cancel or decline action** | RULE 3.3.c |
| **A scrim behind a menu, or any other alpha variant of ink** | RULE 3.19 |
| **Blurring the scrim** | RULE 3.19.e, RULE 15.3.c |
| **Collapsing menu and dialog into one overlay component** | RULE 3.19.c |
| **Promoting the dialog title into a page-title rule** | RULE 3.19.a |
| **Deriving a hover colour by formula instead of ratification** | RULE 3.11.b |
| **A destructive button with its own geometry** | RULE 3.11.a |
| **Hiding a scrollbar with `overflow: hidden` where content must scroll** | RULE 3.20.b |
| **Drawing a decorative replacement scrollbar** | RULE 3.20.f |
| **A module-local scrollbar rule** | RULE 3.20.b |
| **Hiding horizontal scroll chrome without the `UX-073` affordance** | RULE 3.20.a |
| **Applying a ratified motion duration to a component it does not name** | RULE 3.21.c |
| **Inventing a motion duration, easing or spring** | RULE 3.21.c |
| **Animating the shell on route change** | RULE 3.21.a.b |
| **A page-specific or module-specific entrance animation** | RULE 3.21.a.c |
| **Delaying navigation for an animation** | RULE 3.21.e |
| **A sideways or right-pointing sidebar disclosure chevron** | RULE 3.17.b |
| **A second icon family, a filled variant, or emoji as an icon** | RULE 3.17.a |
| **A resting background pill on inactive navigation children** | RULE 3.7.a.c |
| **Relying on the nav fills alone to tell active parent from selected child** | RULE 3.7.a.d |
| **Spelling the application brand any way but `TrioLoo`** | RULE 3.7.b |
| **Resting visible outer borders on Chat/Notification utilities or contextual action buttons** | RULE 3.8.a, RULE 3.11.c |
| **A white pill/rectangular surface around User/Profile** | RULE 3.8.a |
| **Removing User/Profile's focus-visible treatment because it has a resting border** | RULE 3.8.a |
| **Decorative or mechanically-added business-action icons** | RULE 3.17.d |
| **Replacing contextual business-action labels with icon-only buttons** | RULE 3.17.d |
| **A fourth shadow/elevation for header utilities or contextual actions** | RULE 3.6, RULE 3.11.c |
| **A dark-filled entity-class tab** | RULE 3.13.a.b |
| **A new tab system beyond the two ratified treatments** | RULE 3.13.a |
| **Colouring an integration or publication state from the order palette** | RULE 3.14.a |
| **An ecommerce image tile or image-led product grid** | RULE 3.15.a.c |
| **A thumbnail that controls row height** | RULE 3.15.a.c |
| **A placeholder illustration or "no image" text** | RULE 3.15.a.d |

---

# Article X — Localization and Financial Presentation

- **Currency: Bangladeshi Taka `৳`**, symbol-prefixed. Source implements `৳`.
- **South Asian lakh/crore grouping**, 2-2-3 from the right: `৳8,42,300`. ✅ Verified in source — `rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')`. ⚠ **Western thousands grouping is a defect.**
- **Negatives render in parentheses**: `৳(1,200)` — ✅ verified in source.
- **Date/time**: `03 Aug 2026, 14:22` on detail records; **relative** (`2h ago`) in list rows.
- **Tabular numerals mandatory** on every monetary value.
- **Marketplace identifiers are first-class** — SBID, parcel ID, tracking, invoice number remain **visible, copyable, searchable and monospaced**.

---

# Article XI — UX Principles

**Retained from v1.x. Not reference-dependent.**

1. **Speed is the primary feature.** Interaction feedback under 100ms; perceived load under 1s.
2. **The interface never lies about state.** A pending action looks pending.
3. **Destructive actions require confirmation** and name what will be destroyed.
4. **Errors state what happened, why, and what to do next.**
5. **Keyboard operation is not optional** in a data-entry product.
6. **The user's place is never lost** on refresh, navigation or error.
7. **Density serves the operator**, not the screenshot.

---

# Article XII — Governance and Amendment

## 12.1 Precedence

**Approved design sources → this Constitution → everything else**, for visual questions only. **Canonical business architecture outranks all of them for business behaviour** (RULE 1.4).

## 12.2 Amendment

> **RULE 12.2 — No visual pattern is introduced without amending this Constitution first**, not in a pull request that quietly diverges. **A changed rule is a changed contract with every screen already built.**

## 12.3 🔴 Reference replacement procedure

**Because references change, the procedure is fixed:**

1. **New approved reference supplied** by the business.
2. **Source assets inspected** — every file, not only the ones that look relevant.
3. **Exact tokens extracted**; anything unestablished marked `NOT DEFINED BY SOURCE`.
4. **This Constitution reconciled** — every affected rule classified **KEEP · REFINE · SUPERSEDE · REMOVE**.
5. **Conflicting old visual rules superseded**, with the supersession recorded.
6. **Enduring governance principles preserved** — a principle is not obsolete merely because its example was.
7. **`design-reference/README.md` and assets updated** so no retired capture is still cited.
8. **Accessibility re-evaluated** against the new palette from scratch.
9. **Implementation begins only after the foundation is reconciled.**

> **RULE 12.3 — 🔴 Old references and new rules must never coexist as competing authorities.** ⚠ **This is what v2.0.0 exists to correct.**

## 12.4 v1.x reconciliation — disposition

| Area | Disposition |
|---|---|
| **Inter typography (22 references)** | 🔴 **SUPERSEDED** → Manrope |
| **Orange `#FF7A00` accent, `--accent` ramp, `--accent-deep`, `--ink-on-accent`** | 🔴 **SUPERSEDED** → `oklch(0.2 0 0)` |
| **Orange active sidebar rail + tint + label + icon** | 🔴 **SUPERSEDED** → neutral pill, no rail |
| **Orange-filled active filter chips** | 🔴 **SUPERSEDED** → dark-filled |
| **Orange-outlined secondary button** | 🔴 **SUPERSEDED** → `oklch(0.75 0 0)` neutral border |
| **`RULE 0.2` / `2.1.a` / `2.1.b` / `2.1.c` — orange contrast carve-outs** | 🔴 **REMOVED** — no orange interaction colour exists |
| **`A11Y-01` orange active label ≈2.5:1** | 🔴 **REMOVED** — condition no longer exists |
| **Old sidebar taxonomy** (Overview · Accounting · HR Payroll · Tasks Management) | 🔴 **SUPERSEDED** — and now explicitly **not a module register** (RULE 4.3.d) |
| **Global header search** | 🔴 **REMOVED** — retired in the final direction |
| **`03-new-sale-modal.png` citations (3)** | 🔴 **REMOVED** — capture retired; modal is now `NOT DEFINED BY SOURCE` |
| **Underline-on-active tab treatment** | 🔴 **SUPERSEDED** → pill segments |
| **Old spacing, radius, control geometry** | 🔴 **SUPERSEDED** → §3.4–§3.16 |
| **Chart series palette anchored on orange** | 🔴 **REMOVED** — `NOT DEFINED BY SOURCE` |
| **Order card list as the collection archetype** | ✅ **KEEP** — reaffirmed by `OD` |
| **Two-level navigation, level 3 prohibited** | ✅ **KEEP** |
| **Taka symbol, lakh/crore grouping** | ✅ **KEEP** — verified in source code |
| **Marketplace identifiers first-class** | ✅ **KEEP** |
| **UX principles** | ✅ **KEEP** — Article XI |
| **Governance and amendment discipline** | ✅ **REFINE** — Article XII, now with a replacement procedure |
| **WCAG AA commitment** | ✅ **KEEP** — Article VIII, re-evaluation pending |
| **Reference images binding, layouts frozen** | ✅ **REFINE** — precedence now names the Design Language as primary for tokens |

---

# Article XIII — Reference Mapping

| Capture | Governs | Source validation |
|---|---|---|
| `01-sidebar-navigation.png` | Sidebar shell, section labels, nav density, active parent/child, user block | `OD` / `ODT` |
| `02-orders-list.png` | List composition, KPI cards, status tabs, filters, search, card structure, financial hierarchy | `OD` |
| `03-order-detail.png` | Detail composition, tabs, main/rail relationship, summary and status cards | `ODT` |
| `04-page-header.png` | Title/subtitle/action/utility pattern | `OD` / `ODT` |
| `05-pagination.png` | Count, page size, page controls, terminal region | `OD` |

---

# Article XIV — Open Design Decisions

**Recorded, not invented. Each blocks implementation of the component it names.**

1. ⚠ **Focus indication — SUBSTANTIALLY RESOLVED.** ✅ **`RULE 6.0.a` set an interim floor from the existing ink token (2026-08-10).** ✅ **DESIGNED and captured for FORM CONTROLS** (`RULE 6.0.b`, 2026-08-11) **and, by application of the same discipline, for BUTTONS and MENU ROWS** (`RULE 3.19.e`, 2026-08-11). ⚠ **Nav rows, tabs, pagination and links still rely on the `RULE 6.0.a` floor, which is deterministic — an implementer invents nothing.**
2. ⚠ **Loading, empty and form-level validation-summary states** — no source. ✅ **Disabled and field-level error RESOLVED for FORM CONTROLS 2026-08-11** (`§3.18`). 🔴 **Disabled remains undefined for buttons and other controls.**
3. ⚠ **Overlay surfaces — PARTIALLY RESOLVED 2026-08-11, classified precisely rather than closed wholesale** (`§3.19`).
   ✅ **MODAL / CONFIRMATION DIALOG — RESOLVED.** ✅ **ANCHORED ACTION MENU — RESOLVED**; the `More actions ▾` surface now exists. ✅ **SCRIM and OVERLAY ELEVATION — RESOLVED.**
   🔴 **DRAWER — STILL OPEN.** 🔴 **TOOLTIP — STILL OPEN.** 🔴 **OTHER POPOVER CLASSES — filter panels and picker surfaces — STILL OPEN**; ⚠ **the approved reference demonstrates ONE anchored menu, and `popover` is broader than that. They inherit the panel and elevation vocabulary but their composition is undefined.**
4. ✅ **Destructive action treatment — RESOLVED 2026-08-11** (`RULE 3.3.c`, `RULE 3.11.a`, `RULE 3.11.b`). **Canonical red carries destructive ACTION semantics in three enumerated placements and nowhere else; the destructive button is a semantic variant of the primary, not a new geometry.**
5. ⚠ **Responsive behaviour — PARTIALLY RESOLVED 2026-08-10.** ✅ **Desktop layout stability and browser-zoom behaviour are DEFINED** (Article VII). 🔴 **Breakpoints, mobile and tablet operation, sidebar collapse, dashboard-grid pressure, form and report adaptation, and minimum supported viewport width remain UNDEFINED.**
6. ✅ **Production icon set — RESOLVED 2026-08-11** (`RULE 3.17.a`). **The Lucide outline icon set is ratified as the production icon vocabulary, with the canonical semantic mapping at `§3.17` and the disclosure chevron and its direction at `RULE 3.17.b`.** ⚠ **A selection inside already-ratified constraints, exactly as `RULE 14.1` classified it — the binding geometry never changed.** ⚠ **Header glyph size and chevron size are recorded as IMPLEMENTATION SELECTIONS, not canonical geometry** (`RULE 3.17.c`).
7. ✅ **Form and labelled-input patterns — RESOLVED 2026-08-11.** **`Form Design Language.dc.html` approved; ratified at `§3.18`.**
8. 🔴 **Radio, textarea, date/time, file and toggle controls** — still no source; deliberately excluded from the approved form reference. ⚠ **They inherit `§3.18` boundary, radius, padding and type where shape permits, but their own geometry is undefined.**
9. ✅ **Accessibility measurement — RESOLVED 2026-08-10.** **Twenty-one pairs computed** (`§8.3`). **Fifteen text pairs pass; two text pairs and two control boundaries fail; two card boundaries are not governed by SC 1.4.11** (`§8.4`).
10. ⚠ **Motion and transition — PARTIALLY RESOLVED 2026-08-11** (`§3.21`). ✅ **TWO classes defined by business decision: sidebar disclosure `160ms` (`RULE 3.21`) and routed page content `150ms` (`RULE 3.21.a`), both carrying a mandatory reduced-motion fallback (`RULE 3.21.b`).** 🔴 **EVERY OTHER MOTION CLASS REMAINS OPEN — dialogs, menus, buttons, tabs, toasts, drawers, tooltips, accordions, skeletons and charts inherit NOTHING, and the two ratified durations are explicitly NOT a motion scale** (`RULE 3.21.c`).
11. 🔴 **Chart and data-visualisation palette** — the KPI sparkline is the only precedent.
12. 🔴 **Toast and notification surfaces** — the bell exists; the surface does not. ⚠ **Deliberately excluded from the approved overlay reference and NOT closed by it.**
13. ✅ **TEXT INPUT / FORM-FIELD CLASS — RESOLVED 2026-08-11** (`RULE 8.17`). **The required reference was produced and approved; `§3.18` ratifies the enabled boundary, focus, error, disabled and the full label/value/placeholder/helper hierarchy.** **`A11Y-08b` is CLOSED IN FULL.**
14. ✅ **DETAIL-TAB ACTIVE STATE — CLOSED 2026-08-11** (`RULE 8.12`). **Not a defect: the state change measures `3.13` between labels, both labels pass 1.4.3, and the raised white surface is a non-colour cue.**
15. ✅ **BOUNDARY-LESS CONTROLS — CLOSED 2026-08-11** (`RULE 8.11`). **Ghost and utility icon actions are identified by their icon stroke at `6.28`; no boundary is required and none is added.**
16. ✅ **`oklch(0.88 0.006 290)` — CLOSED 2026-08-11** (`RULE 8.13`). **A single-occurrence source one-off carrying no distinct role; it maps to the canonical control boundary. Documented, not silently normalised.**
17. ✅ **GREY TEXT TIERS — RATIFIED 2026-08-11** (`RULE 8.14`). **Two collapsed semantics resolved; two of the four failures needed no new token.**
18. 🔴 **Composition for the surface classes with NO approved reference** — **settings, report, wizard, document-preview and authentication screens** (`RULE 4.1.b`). ✅ **`form` LEAVES this list on 2026-08-11** — `Form Design Language.dc.html` is approved. ⚠ **Whether any remaining class carries an application header is an OPEN question, not a settled prohibition** (`RULE 4.1.a`).

---

## ✅ V1 freeze-readiness assessment — reassessed 2026-08-11

**The test** (`RULE 12.5`, condition 4): **would production implementation of an APPROVED V1 surface require an implementer to INVENT a load-bearing visual rule?** ⚠ **An undesigned future primitive is not a blocker; an undesigned primitive that an approved V1 surface actually needs is.**

🔴 **The previous assessment recorded TWO V1 blockers — the overlay surface family and destructive-action treatment. Both are DISCHARGED by `§3.19`, `RULE 3.3.c` and `RULE 3.11.a`.** **That assessment is superseded and retained in the version history.**

| Open item | Class | Verdict |
|---|---|---|
| **Drawer** | **C — not V1** | ✅ **`UX-151` sends every consequential workflow to a PAGE, not a drawer.** **No approved V1 surface requires one** |
| **Toast** | **C — not V1** | ✅ **`UX-150` forbids a toast being the sole presentation of a business-critical failure, and `UX-140` places every authoritative outcome inline.** **A toast is additive** |
| **Tooltip, command palette, mobile sheet** | **C — not V1** | ✅ Not required by any approved surface |
| **Other popover classes** (filter panel, picker) | **C/D** | ✅ **The approved list page filters with INLINE segmented controls, not popovers.** **A native picker is user-agent drawn** |
| **Loading, empty, validation summary** | **B — governed** | ✅ **`UX-140` fixes behaviour; visuals compose from ratified primitives — `oklch(0.96 0.004 290)` placeholder blocks, card, muted text** |
| **Focus on nav, tabs, pagination, links** | **B — governed** | ✅ **`RULE 6.0.a` is deterministic** |
| **Production icon set** | **D — selection** | ✅ **CLOSED 2026-08-11** (`RULE 3.17.a`). **The selection was made inside the ratified constraints, exactly as this row anticipated** |
| **Radio, textarea, date, file, toggle** | **B/D** | ✅ **A V1 form is buildable from input, select and checkbox — all ratified.** **Textarea and native date inherit `§3.18`** |
| **Motion** | **C** | ✅ Not load-bearing for correctness · ⚠ **two classes ratified 2026-08-11** (`§3.21`); **the rest stays open and stays non-blocking** |
| **Chart palette** | **C** | ✅ The KPI sparkline is the only V1 precedent and it exists |
| **Settings, report, wizard, document-preview, authentication composition** | **B** | ✅ **`UX-030` declares each archetype's composition and `§3.18`/`§3.19` supply their controls and overlays** |

> **RULE 14.1 — ✅ THE DESIGN FOUNDATION IS FREEZE-READY. NO V1 BLOCKER REMAINS.** 🔴 **AMENDED 2026-08-11; the superseding of the previous `NOT YET FREEZE-READY` finding is recorded in the version history and that finding is not erased.**
>
> ✅ **Every approved V1 surface class — shell, operational list, record detail, page header, terminal region, form, dialog and action menu — now has ratified controls, states, boundaries, elevation, focus and destructive treatment.**
>
> ⚠ **Items remaining in this register are future components, selections inside ratified constraints, or compositions already declared by `UI_UX_ARCHITECTURE.md`.** 🔴 **None of them would force an implementer to invent canonical visual language for a V1 surface.**
>
> 🔴 **Freeze-readiness of the DESIGN FOUNDATION is not freeze-readiness of the ARCHITECTURE.** **The Final Architecture Audit is a separate exercise and is NOT started by this rule.**

---

# Article XV — Production Visual Fidelity

**Added in v2.2.0.** **Articles III–XIV specify WHAT the product must look like. This Article governs whether the built product ACTUALLY looks like it.** 🔴 **A specification that is correct on paper and wrong on screen has failed.**

> **RULE 15.0 — ✅ VISUAL FIDELITY IS VERIFIED, NEVER ASSUMED.** 🔴 **`The CSS matches the token matrix` is not evidence of fidelity.** **A declaration can be correct while the rendered result is wrong — a font can fail to load, a colour can be clamped, a border can land on a subpixel, a weight can be synthesised.** ⚠ **Fidelity is established by looking at the rendered surface against its approved reference, not by reading the source that produced it.**

## 15.1 Colour fidelity

> **RULE 15.1 — ✅ The `oklch()` value in Article III is the ONLY source of truth for colour.**
>
> **a.** 🔴 **A colour is never eye-matched, sampled from a screenshot, or read off a design-tool canvas.** **A PNG is a scaled, colour-managed raster** (`RULE 1.3.a`).
> **b.** **A hex value anywhere in this Constitution is a COMPUTED rendering published for verification.** ⚠ **It is never a substitute token and never a licence to hard-code hex in place of the OKLCH value.**
> **c.** 🔴 **A token is never approximated with opacity.** **`ink at 55% alpha` is not `text-secondary`** — it composites differently over white, over the app background and over a card, and the measured ratios in `§8.3` then apply to none of them.
> **d.** **Where a token falls outside sRGB it renders gamut-clamped. The clamped result is what the user sees and what `§8.3` measured.** ⚠ **Fidelity is judged against the clamped rendering, not the mathematical value.**
> **e.** ⚠ **A colour that looks right is not evidence.** **Two colours a reviewer cannot distinguish can differ by more than a contrast threshold.**

## 15.2 Typography fidelity

> **RULE 15.2 — 🔴 A FALLBACK FONT RENDERING IS A FIDELITY FAILURE, NOT A SUCCESS.**
>
> **a.** **Manrope must ACTUALLY LOAD.** **Declaring it is not loading it.** **Verification inspects the RESOLVED family on rendered text, not the declaration.**
> **b.** **Every weight the token matrix uses must resolve to a REAL font file of that weight.** 🔴 **Synthetic / faux bold is prohibited** — the browser smearing a 400 face into a fake 700 changes stroke weight, advance width and therefore column widths, which then interacts with `RULE 7.4`.
> **c.** ⚠ **A silent fallback is the most dangerous fidelity defect** because nothing errors: the layout still `works`, every metric shifts, and the shift is invisible to anyone who has not seen the reference.
> **d.** **Type sizes, weights and line heights come from `§3.1` only.** **A size not in `§3.1` is a defect regardless of how it looks.**
> **e.** ⚠ **Font loading must not produce invisible text, and the fallback metric shift must not be mistaken for a layout bug in `§15.4`.**

## 15.3 Text sharpness and rendering

> **RULE 15.3 — ✅ Text is rendered by the browser at its native size. It is never transformed to fit.**
>
> **a.** 🔴 **`transform: scale()` on any text-bearing container is prohibited.** **It rasterises text at one size and resamples it to another — the result is soft, and no token change can fix it.**
> **b.** 🔴 **Application-level zoom simulation is prohibited.** **Zoom is the browser's** (`RULE 7.9`). **Re-implementing it in the application defeats the user's own accessibility setting.**
> **c.** 🔴 **CSS filters on text are prohibited** — blur, drop-shadow, opacity as a colour substitute, contrast adjustment. **They alter measured contrast unpredictably and invalidate `§8.3`.**
> **d.** **Native browser zoom stays native.** **At 80% and 100% the browser re-lays out and re-rasterises text at the target size; that is correct behaviour and produces sharp text** (`RULE 7.2`).
> **e.** ⚠ **This Constitution does NOT promise pixel-identical rasterisation across operating systems, browsers, rendering engines or display densities.** ✅ **Sub-pixel antialiasing differences between two machines are NOT a fidelity defect and are not raised as one.** **What is required is identical STRUCTURE, IDENTICAL TOKENS and IDENTICAL METRICS — not identical pixels.**

## 15.4 Geometry and boundary rendering

> **RULE 15.4 — ⚠ A boundary that renders inconsistently is INVESTIGATED, not papered over with a global rule.**
>
> **a.** **When a border, divider or edge renders at uneven thickness or disappears at some zoom levels, the CAUSE is identified** — fractional layout arithmetic, border placement relative to the box, a transform in an ancestor, or the display's device-pixel ratio.
> **b.** 🔴 **A blanket `snap everything to integer pixels` rule is PROHIBITED.** **It would break the `4px` spacing rhythm** (`RULE 5.1`), **fight the browser's own zoom arithmetic** (`RULE 7.2`) **and trade a cosmetic artefact for a structural defect.**
> **c.** ⚠ **A hairline that thins or thickens by a fraction of a pixel at a non-integer zoom level is a RENDERING ARTEFACT, not a design defect** — provided the boundary remains continuously visible and its measured colour is unchanged.
> **d.** 🔴 **A boundary that DISAPPEARS at a supported zoom level IS a defect**, because `§8.4` makes certain boundaries load-bearing for control identification.
> **e.** **Fixes are LOCAL to the element investigated and recorded here.** **No global geometry override is introduced.**

## 15.5 Zoom fidelity

> **RULE 15.5 — ✅ Fidelity is verified at BOTH canonical zoom levels.** **`100%` is the baseline and `80%` is a first-class desktop condition, not a degraded mode** (`RULE 7.2`). ⚠ **A surface that is faithful at 100% and broken at 80% has FAILED the gate.** **`RULE 7.3.a` still holds absolutely: zoom changes no record, no page size, no field, no action and no calculation.**

## 15.6 🔴 The reference → production verification gate

> **RULE 15.6 — ✅ A surface is NOT DONE until it has passed this gate against its approved reference of its OWN surface class** (`RULE 4.1.b`). ⚠ **A surface class with no approved reference cannot pass this gate and is not implemented** — **it goes to `§12.3` first.**
>
> ⚠ **This Constitution names no tool, library, framework or product for performing the verification** (`SYS-076`; technology selection belongs to `TECHNOLOGY_ARCHITECTURE.md`). **It states WHAT must be verified.**

| # | Checkpoint | Verified against |
|---|---|---|
| **1** | Sidebar width and the `64px` brand block with bottom border, no shadow | `§3.7`, `RULE 4.1`, `01-sidebar-navigation.png` |
| **2** | Two navigation levels only; parent and child both active | `RULE 4.3.a`, `RULE 4.3.b` |
| **3** | Navigation sections are labelled, not merely spaced | `RULE 4.3.c` |
| **4** | User block states name AND role | `RULE 4.3.e` |
| **5** | Page header renders INSIDE the content region and scrolls with it | `§3.8`, `RULE 4.1`, `04-page-header.png` |
| **6** | Content frame max-width, centring and gutters | `§3.9`, `RULE 4.2` |
| **7** | Detail layout: main column minimum, right-rail width, gap | `RULE 4.2` |
| **8** | The surface maps to a declared archetype | `§5.3` |
| **9** | Order lists render as a CARD LIST, never converted to a data table | `§3.15` |
| **10** | Segmented controls are IDENTICAL across status, channel and period | `RULE 5.2`, `§3.13` |
| **11** | Status badges pair colour WITH a word; exactly five status colours | `RULE 3.3.a`, `RULE 8.4` |
| **12** | Exactly one primary action per header | `RULE 3.11` |
| **13** | Icons are outline-only at the fixed geometry | `RULE 3.17` |
| **14** | Terminal region matches; no persistent application footer | `§3.16` |
| **15** | Every rendered colour traces to an Article III `oklch()` token | `RULE 15.1` |
| **16** | Manrope RESOLVED on rendered text; every weight a real face; no synthetic bold | `RULE 15.2` |
| **17** | Every type size, radius and spacing step exists in `§3.1`/`§3.4`/`§3.5` | Token discipline |
| **18** | Two elevations only; no gradient, glow or coloured shadow | `RULE 3.6` |
| **19** | Taka prefix, 2-2-3 lakh/crore grouping, negatives in parentheses | Article X |
| **20** | Tabular numerals on every monetary value; marketplace identifiers monospaced and copyable | Article X |
| **21** | At 100% AND 80%: no structured operational row wraps; column order and scan direction preserved | `RULE 7.4`, `RULE 15.5` |
| **22** | At 100% AND 80%: identical record count, page size, fields, actions and calculated values | `RULE 7.3.a` |
| **23** | A visible focus indicator on EVERY interactive element, reachable by keyboard alone, distinct from hover | `RULE 6.0`, `RULE 6.0.a` |
| **24** | Rendered contrast matches `§8.3` for every pair present; no locally-adjusted substitute value | `RULE 8.5`, `RULE 8.7` |

> **RULE 15.7 — ✅ A gate failure is RECORDED with its cause before it is fixed.** 🔴 **`Adjusted until it looked right` is not a remedy.** **If the cause is a specification defect, this Constitution is amended** (`§12.2`); **if the cause is an implementation defect, the implementation is corrected to the existing token.** ⚠ **The two are never confused, and an implementation defect is never resolved by changing the token.**

---

# Version History

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-04 | Initial ratification |
| 1.0.1 | 2026-08-04 | Added Taka symbol and lakh/crore grouping. Linked `design-reference/` baseline and its deviation catalogue |
| 1.1.0 | 2026-08-04 | Precedence inverted: reference images made binding and existing layouts frozen. Adopted the order card list, order-list archetype, orange active nav state, orange-outlined secondary button and multi-action modal footer |
| **2.0.0** | **2026-08-10** | 🔴 **FULL VISUAL REPLACEMENT, reconciled against the approved TrioLoo Design Language** (`Design Language.dc.html`, `Order Dashboard.dc.html`, `Order Details.dc.html`, `support.js`) **and the five current reference captures.** **Inter → Manrope; orange `#FF7A00` → `oklch(0.2 0 0)`; orange active rail → neutral pill; orange filters → dark-filled segments; underline tabs → pill segments; header search removed; retired modal citations removed.** ✅ **Complete source-derived Design Token Matrix added (Article III), every row traced to a file and marked EXACT / COMPOSITION / NOT DEFINED BY SOURCE.** 🔴 **Resolved the `64px header` discrepancy: the Design Language names 64px, the screen files have no header bar, and 64px is realised as the sidebar brand block** (RULE 4.1). 🔴 **Old orange accessibility register voided; nine pairs re-registered as requiring measurement, with focus indication recorded as an outright AA gap.** 🔴 **Responsive behaviour, twelve component states and the production icon set recorded as `NOT DEFINED BY SOURCE`** rather than invented (Article XIV). ✅ **Enduring principles retained** — UX principles, governance, two-level navigation, card-list archetype, Taka localisation, marketplace identifiers. ✅ **Scope made explicitly ERP-wide** (RULE 1.2) and **the mockup sidebar taxonomy declared visual guidance only, not a module register** (RULE 4.3.d). |
| **2.1.0** | **2026-08-10** | ✅ **DESKTOP LAYOUT STABILITY AND BROWSER ZOOM DEFINED — Article VII rewritten from explicit business decision.** **v2.0.0 recorded this domain as wholly `NOT DEFINED BY SOURCE`; it is now PARTIALLY RESOLVED.** **`RULE 7.2`: 100% is the canonical baseline and 80% is a FIRST-CLASS desktop condition, not a degraded mode.** 🔴 **`RULE 7.3` separates three concepts that must never be conflated — information EXISTENCE (unchanged by zoom), VISIBILITY in the viewport (naturally changes), and structural LAYOUT (stable)** — and **`RULE 7.3.a` forbids zoom affecting records, page size, permissions, actions, fields, workflow, calculations, sorting, filtering or API behaviour.** 🔴 **`RULE 7.4`: structured operational rows never wrap under width or zoom pressure**, preserving column order, amount, status and action placement and scan direction. **`RULE 7.5`: preserve composition before structural reflow** — ⚠ **deliberately NOT mandating a per-component scrollbar; the access mechanism is left to UI/UX Architecture.** **`RULE 7.7` keeps content wrapping separate from structural reflow.** ✅ **`OD`'s `flex-wrap: nowrap` is now CONFIRMED INTENTIONAL rather than read as an implementation accident.** ⚠ **`RULE 7.8` records a genuine conflict between the two approved files — `OD` page header is `nowrap`, `ODT` title block is `wrap` — resolved in principle by RULE 7.4 but left for UI/UX Architecture to apply, with neither source altered.** ✅ **`RULE 7.9` forbids suppressing browser zoom and cites WCAG 2.2 SC 1.4.10's explicit exception for content requiring two-dimensional layout.** ⚠ **`§7.11` records that the cited Daraz captures were NOT supplied to this session and nothing was derived from them.** **No token, palette, typography, geometry or approved composition changed. No business architecture touched.** |
| **2.1.1** | **2026-08-10** | ✅ **`§7.8` RECLASSIFIED on business correction — `SURFACE-SPECIFIC COMPOSITION DIFFERENCE`, not a conflict.** **v2.1.0 recorded the `OD` `nowrap` / `ODT` `wrap` page-header difference as a genuine conflict resolved in principle by `RULE 7.4`.** 🔴 **That classification was wrong: `RULE 7.4` governs intentionally horizontal operational/data rows, and a page title/meta/action region is a different surface class.** ✅ **Inspection confirms the wrapping element holds two children — an identity group and an action group — renders once per page, carries no column relationships and no scan direction, and is therefore NOT an operational row.** **`RULE 7.8.a` now states the two surface classes explicitly: operational rows must preserve horizontal structure; page-level title/meta/action regions may reflow where designed, provided business information, action identity and hierarchy survive.** 🔴 **`RULE 7.8.b` forbids generalising page-region reflow to operational rows.** **The v2.1.0 history row is retained unchanged as the record of the superseded classification.** **No other rule altered; no source HTML altered; no business architecture touched.** |
| **2.2.0** | **2026-08-10** | ✅ **ACCESSIBILITY MEASURED AND PRODUCTION VISUAL FIDELITY LOCKED.** 🔴 **`RULE 4.1` SCOPE CORRECTED:** v2.0.0's unqualified **`There is no separate application header bar`** — restated ERP-wide by `UI_UX_ARCHITECTURE.md` `UX-011` — **was an over-generalisation from two reference screens.** ✅ **`RULE 4.1.a` establishes that an element ABSENT from a reference is evidence about THAT reference, not an ERP-wide prohibition** — **and that absence of evidence is not permission either.** ✅ **`RULE 4.1.b` establishes REFERENCE FIDELITY BY SURFACE CLASSIFICATION as the governing principle.** ⚠ **The `64px` = sidebar brand block token resolution is UNCHANGED; the superseded wording is retained, not erased.** ✅ **§8.3 REPLACED `NOT YET MEASURED` with 21 COMPUTED pairs** (OKLCH → OKLab → linear sRGB → gamut-clamped → WCAG luminance → ratio). **Fifteen text pairs PASS — including `A11Y-01` at 4.87/4.66, which v2.0.0 had ranked `HIGHEST RISK`; `RULE 8.5.a` retains that wrong ranking as the record of why estimation is forbidden.** 🔴 **Four failures: `A11Y-02a` 3.96, `A11Y-02b` 3.24, `A11Y-08b` 1.35, `A11Y-08c` 2.23.** ✅ **§8.4 and `RULE 8.6` apply WCAG 2.2 SC 1.4.11's actual test rather than a naive 3:1 sweep: card borders (`A11Y-08a` 1.23, `A11Y-08d` 1.18) are NOT GOVERNED — a card is a grouping container, not a component identified by its boundary — while input/select/segment and secondary-button borders ARE, because those controls are white-filled on white surfaces and the boundary is the only thing identifying them.** ✅ **§8.5 and `RULE 8.6.a` compute DETERMINISTIC remediation candidates preserving hue and chroma, changing lightness only, at the MINIMUM change meeting threshold** — **`oklch(0.568 0.012 290)`, `oklch(0.568 0.01 290)`, `oklch(0.669 0.006 290)`, `oklch(0.669 0 0)`.** ⚠ **`RULE 8.3` is NOT suspended: no Article III token was altered.** **`RULE 8.7` forbids production resolving a contrast failure locally; `RULE 8.8` states accessibility outranks fidelity but wins only through `§12.2` amendment.** ✅ **`RULE 6.0.a` sets an INTERIM FOCUS FLOOR reusing the EXISTING ink token `oklch(0.2 0 0)` (18.10/17.33/14.73/14.72) with a `#FFFFFF` separator where the control's own fill is ink — no new colour invented; `RULE 6.0`'s design task stays OPEN.** ✅ **NEW Article XV — Production Visual Fidelity: colour fidelity (`RULE 15.1`), typography fidelity where a FALLBACK RENDERING IS A FAILURE and synthetic bold is prohibited (`RULE 15.2`), text sharpness forbidding `transform: scale()`, app-level zoom simulation and CSS filters on text while explicitly NOT promising pixel-identical rasterisation across machines (`RULE 15.3`), geometry investigated per-element with a global integer-pixel rule PROHIBITED (`RULE 15.4`), zoom fidelity at both 100% and 80% (`RULE 15.5`), and a 24-checkpoint reference→production GATE naming no tool (`RULE 15.6`, `SYS-076`).** ✅ **Ten prohibitions added to Article IX.** ✅ **Article XIV: item 1 partially resolved, item 9 RESOLVED, items 13 and 14 opened.** **No business architecture touched. No design token altered. No GAP created.** |
| **2.3.0** | **2026-08-10** | 🔴 **`A11Y-08b` RULED PER CONTROL CLASS — PARTIALLY RESOLVED, REMAINDER BLOCKED. NO TOKEN ALTERED.** ✅ **Every control class was inspected in approved SOURCE, not from the reconciled record: `Design Language.dc.html`, `Order Dashboard.dc.html` and `Order Details.dc.html` were re-read in full.** 🔴 **ADJACENCY CORRECTION (`RULE 8.6.b`): a control boundary separates its own `#FFFFFF` fill from the surface it sits on, and in both screen files every control-bordered element sits on the APP BACKGROUND, not white. v2.2.0's candidates were computed against white ONLY and are INSUFFICIENT — `oklch(0.669 0.006 290)` measures `2.87` on the app background. The governing values are `oklch(0.658 0.006 290)` and `oklch(0.658 0 0)`. The superseded figures are retained.** ✅ **`RULE 8.6.c` PROVEN NEGATIVE: segmented control, channel filter, period filter and list status tabs need NO remediation — each permanently renders one ink-filled active member measuring `17.33`/`18.10`, and the approved source gives INACTIVE segments no boundary at all, proving the filled active state is the intended identifier. These classes leave `A11Y-08b` with ZERO visual change.** 🔴 **Strategy B (identify the control by tinted FILL) is REJECTED ON MEASUREMENT, not taste: a fill must reach `L 0.658` to identify at 3:1, while every approved tinted fill measures `1.12`–`1.23`. It is a LARGER change than darkening the boundary.** 🔴 **TWO NEW FAILURES FOUND that the register never covered: `A11Y-08e` the `ODT` icon-only `⋮` button — a white square on near-white ground, `1.29` outline, NO text label, the sharpest case in the corpus — and `A11Y-08f` the detail-tab active state at `1.12`, conditional because the state also rides on compliant text colour.** 🔴 **SOURCE/TOKEN DEFECT RECORDED: `oklch(0.88 0.006 290)` exists in the bulk-bar select and appears NOWHERE in Article III; it is recorded, NOT silently added and NOT normalised.** 🔴 **`RULE 8.9`: the remaining classes are BLOCKED — the compliant minimum satisfies ACCESSIBILITY and NO-COMPETING-SYSTEM but fails REFERENCE FIDELITY at ΔL −0.242, and cannot preserve the `0.9`/`0.75` hierarchy `§3.6` records as deliberate, since both converge on `L 0.658`.** ⚠ **There is no lighter compliant option — proven, not assumed.** ✅ **Card, panel, rail and divider boundaries CONFIRMED UNCHANGED and kept as separate tokens.** 🔴 **`A11Y-02a` ALSO CORRECTED by the same adjacency error: faint text renders the sidebar user-block role line on `oklch(0.97 0.004 290)`, where the v2.2.0 candidate measures only `4.14`. Governing value `oklch(0.548 0.012 290)`; the claimed single `L 0.568 text-faint floor` is WITHDRAWN. `A11Y-02b` re-verified and CONFIRMED unchanged.** No business architecture touched. No GAP created.** |
| **2.4.0** | **2026-08-11** | ✅ **FINAL DESIGN RATIFICATION PASS. NO BOUNDARY TOKEN CHANGED; THE ENTIRE APPROVED BOUNDARY HIERARCHY SURVIVES INTACT.** ✅ **`RULE 8.10` establishes the governing principle — SELF-IDENTIFYING CONTENT: a control carrying permanently-visible compliant content (label, numeral, icon) IS identified by it, so its boundary is SUPPLEMENTARY and ungoverned by SC 1.4.11; a control EMPTY by default has nothing but its boundary.** 🔴 **The premise is ratified by the approved language itself — `Design Language.dc.html` defines a GHOST button with `border: none` identified by its label alone, and both screens use boundary-less ghost text and icon actions. The decisive consequence: adding a faint hairline to a control that is already self-identifying cannot make it LESS compliant.** ✅ **Five of the six v2.3.0-blocked classes CLOSED WITH NO CHANGE — pagination (numeral `16.51`, glyph `6.02`), selects (value text `16.51`, never empty), secondary button (label `16.00`), bordered icon button (glyph `6.56`), ghost/utility icon actions (stroke `6.28`).** ✅ **`RULE 8.11` records the ICON ACTION TAXONOMY the source draws with a literal `1px` header divider: SHELL UTILITY right of it carries no boundary, PAGE ACTION left of it carries the control boundary.** ✅ **`RULE 8.12` CLOSES `A11Y-08f` — the detail-tab active state is not a defect: labels measure `18.85`/`5.36`, the state change between them is `3.13`, and the raised white surface is a non-colour cue satisfying 1.4.1, so the `1.12` fill is reinforcing decoration, not load-bearing. The tab system is NOT darkened.** ✅ **`RULE 8.13` CLOSES `oklch(0.88 0.006 290)` as disposition B — a single-occurrence source one-off mapping to the canonical control boundary; documented, not silently added and not silently normalised.** ✅ **`RULE 8.14` resolves the GREY TEXT TIERS by proving reconciliation collapsed two semantics TWICE: `oklch(0.6 0.012 290)` served both an ICON STROKE (needs 3:1, measures `3.96`, RETAINED UNCHANGED) and a TEXT colour (needs 4.5, fails at `3.96`/`3.63`); `oklch(0.65 0.01 290)` served both `::placeholder` and the sidebar section labels — a usage absent from every Article III row. ✅ TWO of the four text failures needed NO NEW TOKEN: the user-block role line maps to the EXISTING Muted `oklch(0.5 0.015 290)` (`5.52`) because it is a subtitle and every page subtitle already uses Muted, and the sidebar section label maps to the EXISTING Text secondary `oklch(0.55 0.015 290)` (`4.87`) because `OD`'s `FILTER` label is the same object and already uses it. Demoted micro-label `0.6` → `oklch(0.568 0.012 290)` (`4.51`), still LIGHTER than `0.55` so the `§3.15` demotion hierarchy is preserved. Placeholder `0.65` → `oklch(0.568 0.01 290)` (`4.51`), a SEPARATE token that merely coincides at the AA floor.** 🔴 **`RULE 8.15` BLOCKS the TEXT INPUT — the only component failing `RULE 8.10`, and it fails twice (boundary `1.29`/`1.35`, placeholder `3.24`). An input is EMPTY by default and a placeholder is a transient hint, not identifying content. The compliant minimum `oklch(0.658 0.006 290)` is deterministic and nothing lighter passes, but NO approved capture shows a control at that weight, the corpus contains ONE input and ZERO form screens, and `§3.12` already records labelled-field layout, focus, error and disabled as undefined — so a single new reference resolves all of them, while ratifying a number now would pre-commit the ERP's entire form language sight-unseen. A NEW APPROVED VISUAL REFERENCE IS REQUIRED.** ✅ **`RULE 8.16` records that `RULE 8.3` was EXERCISED under explicit business ratification, not bypassed. `§12.5` / `RULE 12.5` fixes the four-condition ratification standard.** **No business architecture touched. No GAP created. No new document.** |
| **2.5.0** | **2026-08-11** | ✅ **FORM DESIGN LANGUAGE RATIFIED — `A11Y-08b` CLOSED IN FULL.** **`Form Design Language.dc.html` was approved 2026-08-11 and is registered at `§1.3` as PRIMARY authority for the FORM surface class, and at `§5.3` as an archetype.** ✅ **NEW `§3.18` ratifies the complete form-control token set: `34px` height, `9px` radius, `13px` text, `#FFFFFF` fill, and the states — rest, focus, filled, error, disabled.** 🔴 **ONE genuinely new canonical colour, verified by programmatic token audit of the approved file: `oklch(0.65 0.006 290)`, the ENABLED FORM CONTROL boundary, measuring `3.24` on `#FFFFFF` and `3.10` on the app background (recomputed, not copied).** 🔴 **`RULE 3.18.b`/`c`/`d` forbid generalising it: card `0.93`, control/utility `0.9`, secondary action `0.75` and both dividers are UNCHANGED, grouped controls and pagination stay closed by self-identifying content, and the `32px` list-page utility select is NOT collapsed into the `34px` form control.** ✅ **`RULE 3.18.e` ratifies DISABLED as deliberately LIGHTER than enabled — SC 1.4.11 exempts inactive components, so the original `oklch(0.9 0.006 290)` hairline is correct there and is never darkened for symmetry; text stays readable at `5.36`. DISABLED is explicitly NOT read-only, NOT permission-restricted and NOT workflow-unavailable, and those classes may not borrow its treatment.** 🔴 **`RULE 3.18.f` records a measured constraint: the error boundary differs from the rest boundary by only `2.19`, so although each state passes SC 1.4.11 independently (`7.11`/`6.80`), the boundary CHANGE alone is insufficient — the outline marker and the message are therefore MANDATORY, and a focused field in error retains its message because focus and error boundaries differ by only `2.55`.** ✅ **`RULE 3.18.g` records the two-column `1fr 1fr` grid as this surface's REFERENCE COMPOSITION, not an ERP-wide mandatory form layout.** ✅ **`RULE 6.0.b` ratifies the designed focus treatment — ink `oklch(0.2 0 0)` boundary plus a solid `oklch(0.93 0 0)` halo, both already canonical, no new colour and no alpha — measured `18.10`/`17.33`, and `5.59` against the rest boundary so focus is identifiable by its boundary alone. `RULE 6.0.a` remains in force UNCHANGED for every non-form control; the two do not compete.** ✅ **`RULE 8.18` records the audit: 31 `oklch` values, one new; zero `transform: scale`, filters, gradients, opacity approximations, `@media` or `appearance` suppression; exactly three shadows, the focus halo being a RING not a third ELEVATION, so `RULE 3.6` is intact.** ✅ **The reference's use of v2.4.0-ratified sidebar text mappings instead of the superseded `OD`/`ODT` values is recorded as CORRECT — screenshot fidelity never resurrects an inaccessible value.** **Article XIV items 7 and 13 closed, item 2 partially closed. No business architecture touched. No GAP created. No new document.** |
| **2.6.0** | **2026-08-11** | ✅ **OVERLAY & DESTRUCTIVE DESIGN LANGUAGE RATIFIED — THE LAST TWO V1 DESIGN BLOCKERS ARE DISCHARGED.** **`Overlay & Destructive Design Language.dc.html` approved 2026-08-11, registered at `§1.3` precedence 3c and `§5.3` as an archetype. Every value was re-extracted from the source markup and every ratio recomputed — not taken from the approval report.** 🔴 **`RULE 3.6` AMENDED from TWO elevations to THREE. The superseded two-elevation wording is retained verbatim inside the rule. The third — `0 8px 24px oklch(0 0 0 / 0.1)` — is STRICTLY scoped by `RULE 3.6.a` to ratified detached overlays and is forbidden on cards, panels, dashboard widgets, form cards, list rows, page headers and any surface seeking emphasis. `RULE 3.6.b` records WHY, so it is never mis-cited: elevations measure `1.06`, `1.18` and `1.23` against white, so NO shadow reaches 3:1 and a shadow is NEVER WCAG component identification — the overlay elevation exists for PERCEPTUAL DETACHMENT only.** 🔴 **`RULE 3.3.b` AMENDED by ADDITION, its original wording untouched: new `RULE 3.3.c` permits canonical red to carry DESTRUCTIVE ACTION semantics in EXACTLY THREE enumerated placements — the confirmation action fill, the destructive menu row with its red-tinted hover, and the outline marker beside a destructive title — and prohibits red panels, red scrims, red borders, red body text, red Cancel actions, and red for emphasis, branding or chart variety.** ✅ **`RULE 3.11.a` adds the destructive button as a SEMANTIC VARIANT of the primary — identical height, padding, radius, weight and label size, fill only — with no destructive geometry system. `RULE 3.11.b` ratifies `oklch(0.54 0.16 25)` as the REFERENCE-DEFINED hover and explicitly forbids treating its relationship to the primary hover as a reusable formula; that relationship is provenance, not an algorithm.** ✅ **NEW `§3.19` ratifies the scrim `oklch(0.2 0 0 / 0.48)` (`3.23` panel separation over white content, `3.34` over the app ground), the `460px` confirmation dialog, and the `216px` anchored action menu. `RULE 3.19` scopes the scrim to DIALOGS ONLY, forbids any other alpha variant of ink, forbids a scrim behind a menu and forbids blur. `RULE 3.19.a` keeps the `15.5px/700` dialog title a CARD-HEADING and forbids promoting it into a page-title rule. `RULE 3.19.b` requires the consequence to be stated before the action is reachable, and records that this creates NO confirmation requirement — which actions need confirming is business architecture. `RULE 3.19.c` keeps menu and dialog SEPARATE surface classes. `RULE 3.19.d` records that NEITHER overlay boundary is load-bearing — menu `1.35`, dialog `2.62` — because the dialog is identified by its scrim and the menu by its own content, so darkening them would be a regression. `RULE 3.19.e` records the overlay family as CONSUMING the existing focus architecture with no new primitive, and fixes that FOCUS IS ALWAYS INK, NEVER RED — an ink ring measures only `2.55` on the red fill, which is why the destructive button takes the two-part ring whose `#FFFFFF` separator measures `7.11`.** ✅ **Eleven prohibitions added to Article IX.** ✅ **Open-decision register updated PRECISELY, not wholesale: modal, anchored action menu, scrim, elevation and destructive treatment CLOSED; drawer, toast, tooltip and other popover classes DELIBERATELY RETAINED as open.** 🔴 **`RULE 14.1` AMENDED — the Design Foundation is now FREEZE-READY with no V1 blocker. The previous NOT-FREEZE-READY finding is superseded, not erased.** **No business rule, workflow, permission, entity, event, state or posting touched. No GAP created. No new document.** |
| **2.7.0** | **2026-08-11** | ✅ **GLOBAL UI FOUNDATION RATIFIED — one bounded post-freeze amendment** (`DOC-079`), **from explicit business decision after the running application was reviewed. No business rule, entity, state machine, event, permission, posting or module ownership is touched.** 🔴 **THE OMITTED NAV-LABEL TOKEN IS RATIFIED, NOT INVENTED: `oklch(0.4 0.015 290)` was verified present in `Order Dashboard.dc.html` on every inactive nav row, while `§3.1` had already transcribed the SIZE and WEIGHT of that same span — the colour was dropped in transcription. Measured `9.25` on white, `8.85` on the app background, `8.47` on nav hover; AAA, no accessibility consequence. The ACTIVE nav label is recorded explicitly as the existing Ink token because Heading ink is a known implementation trap.** ✅ **NEW `§3.20` SCROLL SURFACES: ERP-owned scroll surfaces scroll normally while native scrollbar CHROME is suppressed. `RULE 3.20.b` forbids achieving it with `overflow: hidden`, forbids clipping, and preserves keyboard, wheel, touchpad, pointer, focus and programmatic scrolling; `RULE 3.20.c` states that HIDDEN CHROME IS NOT HIDDEN CONTENT; `RULE 3.20.f` forbids drawing a decorative replacement. 🔴 `RULE 3.20.a` STRENGTHENS `UX-073` rather than weakening it — with the chrome gone the discoverability affordance becomes MANDATORY, and row invariance, the pinned identity column, scoped overflow and every zoom and page-size rule are explicitly untouched.** ✅ **NEW `§3.21` MOTION — the register moves from `NOT DEFINED BY SOURCE` to PARTIALLY defined. Exactly TWO classes: sidebar disclosure `160ms` (`RULE 3.21`, submenu and chevron on one clock) and routed page content `150ms` (`RULE 3.21.a`, routed content only — sidebar, brand, user card and header utilities never animate). `RULE 3.21.b` makes reduced motion mandatory with functionality preserved exactly, and records that a preference query is NOT a breakpoint so `RULE 7.10` is untouched.** 🔴 **`RULE 3.21.c` is the guard: these are TWO NAMED PRIMITIVES, not tokens, not a scale and not a default — dialogs, menus, buttons, tabs, toasts, drawers, tooltips, accordions, skeletons and charts inherit NOTHING.** ✅ **`§3.17` PRODUCTION ICON SET RATIFIED as the Lucide outline icon set with the canonical semantic mapping for nine destinations and three header utilities — the OPEN item `RULE 3.17` itself anticipated, closed as a selection inside unchanged ratified geometry. `RULE 3.17.b` fixes the ONE rotated outline chevron and its business-approved direction — CLOSED points UP, OPEN points DOWN, deliberately the inverse of the common convention and recorded so it is not "corrected" by habit — and keeps it secondary to the module icon. 🔴 `RULE 3.17.c` records WHICH geometry is canonical and which is an IMPLEMENTATION SELECTION: header glyph size and chevron size are selections, because the superseded source values were CSS-primitive box dimensions and a `4/4/5px` triangle, neither of which transfers to a drawn icon set. Code is never mistaken for ratification** (`DOC-080`). ✅ **`RULE 3.7.a` ratifies the SEMANTIC USE of two colours that already existed — active parent `oklch(0.93 0 0)` at weight 700 with an ink icon versus selected child `oklch(0.95 0 0)` at weight 600 on a shorter indented row with no icon, and inactive children carrying NO resting pill. 🔴 It records that the fills alone are NOT the distinction: measured, they differ by `1.062` and reach only `1.229` and `1.157` against white, so neither is a WCAG identification mechanism — the same finding `RULE 3.6.b` records for shadows — and a stronger colour separation would be a NEW TOKEN through `§12.3`, never invented at implementation time.** ✅ **`RULE 3.7.b` ratifies the application-display brand `TrioLoo` with exact capitalisation, bounded to presentation and explicitly not rewriting package, database, repository, storage, historical or legal identifiers.** ✅ **Fifteen prohibitions added to Article IX. Article VI and Article XIV items 6 and 10 updated PRECISELY rather than wholesale — motion is recorded as PARTIALLY resolved and is not falsely marked solved.** 🔴 **Superseded wording retained throughout, never erased** (`DOC-009`): **the `Library: NONE / CSS-drawn primitives` row, the source caret row, and `RULE 3.17`'s final sentence.** ⚠ **The `FREEZE-V1-2026-08-11` baseline remains valid; this document's frozen version is superseded by this governed amendment and implementation must conform to the amended baseline.** |
| **2.8.0** | **2026-08-11** | ✅ **PRODUCT WORKSPACE VISUAL QUESTIONS RESOLVED — three narrow rules, and the largest was answered by REUSE rather than invention.** 🔴 **The design extraction reported that no tab treatment existed for switching ENTITY CLASS.** ✅ **`RULE 3.13.a` finds the answer already present: `RULE 3.13`'s own distinction — *dark for filtering a set, white-raised for switching a view* — decides it deterministically, so an entity-class tab takes the EXISTING white-raised treatment at its existing geometry. No new token, accent, geometry or gradient is created, and `RULE 3.13.a.b` PROHIBITS the dark-filled treatment here because dark fill is the ratified language of status filtering and would assert that three entity classes are statuses of one collection.** ⚠ **`RULE 3.13.a.c` records that the treatment is applied on FUNCTION rather than page class, because `RULE 3.13` states the distinction functionally — and that `RULE 4.1.b` is not weakened into a licence to move other detail patterns onto list pages.** ✅ **`RULE 8.12`'s existing finding carries: the white-raised active state measures `3.13` between labels with both passing 1.4.3, so no accessibility question is reopened.** ✅ **`RULE 3.14.a` draws the status boundary honestly: `§3.3`'s five pairs carry ORDER semantics and do NOT extend automatically to `SYNCED`, `FAILED`, `MANUAL_REQUIRED`, `DIVERGED`, listing status or publication intent. 🔴 A state is never assigned a pair because it feels similar — `MANUAL_REQUIRED` is a NORMAL state and colouring it as failure would misinform, while `DIVERGED` is always an exception and colouring it neutral would hide one. Until a mapping is ratified these states use the NEUTRAL pair with a MANDATORY text label, which loses no information precisely because `RULE 8.4` already forbids colour-only state. No sixth pair is created** (`RULE 3.3.a`). ✅ **`RULE 3.15.a` separates ratified geometry from unratified data: the `38×38px` radius `9px` product thumbnail and the `48×48px` detail thumbnail are already canonical from `OD`/`ODT`, but `PRD-018` establishes only that images are Trioloo-authored and pushed where the adapter supports the field — primary-image selection, ordering, storage ownership, fallback and any URL model are UNDEFINED.** 🔴 **Drawing a thumbnail is therefore NEVER evidence that `primary_image_url` or any image field exists** (`DOC-080`), **the thumbnail never controls row height, and an ecommerce tile or image-led catalogue grid is prohibited. A missing image uses the existing `oklch(0.96 0.004 290)` block — no placeholder illustration, no icon substitute, no "no image" text.** ✅ **Six prohibitions added to Article IX.** ⚠ **No token, palette entry, elevation, radius, spacing or geometry created. No open Article XIV item closed — status colour for integration states is newly RECORDED as bounded, not solved. `PRODUCT_ARCHITECTURE.md` not amended; no business rule, entity or GAP touched.** |
| **2.15.0** | **2026-08-15** | ✅ **`RULE 3.3.d` ADDED — THE FIVE PAIRS CARRY A SEMANTIC ROLE AXIS, and every meaningful state and message uses it.** ✅ **`success` → confirmed · `warning` → pending · `danger` → cancelled · `info` → dispatched · `neutral` → neutral.** 🔴 **NO SIXTH PAIR, NO NEW HUE, NO SECOND PALETTE** (`RULE 3.3.a`): **`RULE 3.3.b` already gave these hues their meanings, and what was missing was a name for the ROLE plus an obligation to use it.** ✅ **Chips and badges that represent a meaningful business or system state take a role; so do meaningful operational messages — notices, callouts, validation and system feedback.** 🔴 **Ordinary helper text does NOT, and a control that merely LOOKS like a chip — a filter, a search token, a category selector — stays neutral, because colouring it would announce a significance it does not have.** ✅ **`neutral` is a REAL answer: `DRAFT`, `Not connected` and `ARCHIVED` are unremarkable and colouring them would misinform as surely as colouring a failure green.** 🔴 **Restraint is part of the rule — soft tint, restrained text, 1px boundary; saturated fills, neon, large coloured panels, gradients and rainbow status systems remain PROHIBITED, and the product stays black and white dominant.** 🔴 **Colour is never the sole carrier** (`RULE 8.4`): **a chip pairs its role with a word and a message names its condition.** 🔴 **One shared implementation — a page-local semantic colour is a defect.** ⚠ **`RULE 3.14.a.b` SUPERSEDED and retained** (`DOC-009`): **the mapping it waited for now exists, while `.a`'s warning survives — `MANUAL_REQUIRED` is not `danger` and `DIVERGED` is not `neutral`.** ✅ **Binds all future Design feature packs and implementations.** 🔴 **No token value, hue, geometry, spacing or typography is created or changed.** |
| **2.14.0** | **2026-08-15** | ✅ **`RULE 3.6.d` ADDED — EDITABILITY IS NEVER A CONTAINER TREATMENT, routed under `DOC-079` from a review finding on the implemented media surface.** ⚠ **The defect closed: a three-panel surface drew its one EDITABLE column with a `1.5px` ink frame while its two READ-ONLY columns used the neutral border — giving an ordinary capability the strongest treatment on the page.** ✅ **All peer panels now share one container treatment regardless of what their contents permit; editability is carried by the section badge, the helper text and the PRESENCE OF CONTROLS — a read-only panel having no controls at all is a stronger signal than a border.** 🔴 **This is `RULE 3.6.c` and `UX-269` extended from business STATE to CAPABILITY: neither may claim the container.** 🔴 **No token, geometry, colour, elevation, spacing or typography value is created or changed.** |
| **2.13.0** | **2026-08-15** | ✅ **GLOBAL SHELL POLISH — the account trigger, header action geometry, brand hierarchy and the motion scale, routed under `DOC-079` from explicit business decision after the running ERP was reviewed.** 🔴 **ADDITIVE ONLY: v2.12.0's ground, elevation, focus and state-carrier rules are UNCHANGED and none is weakened. No business rule, entity, permission, workflow, API, persistence or migration is touched.** ✅ **NEW `RULE 3.8.a.c` — THE ACCOUNT CARD SUPERSEDES THE AVATAR-ONLY TRIGGER: `[ avatar ] [ display name ] [ chevron ]` on the white utility surface, `40px` tall, `999px` radius, and THE WHOLE CARD IS THE TRIGGER because a `14px` chevron is not a hit target. 🔴 The display name is the operator's own name — full name, username as fallback — and a UUID or internal identity is NEVER rendered. ⚠ One line, ellipsised at `132px`, so the header never wraps because of who is signed in; no role line in the trigger; no account field invented. ✅ The `36px` avatar of `RULE 3.8.a.b` is CARRIED IN UNCHANGED, not resized.** ✅ **NEW `RULE 3.11.d` — the page-header action becomes `36px` tall, `0 13px` padding, `9px` radius, `13px` label (superseded: `40px`, `0 18px`, `10px`, `13.5px`). 🔴 Prominence comes from FILL, POSITION and LABEL, never geometry — at `40px` this was the largest control in the ERP. Exactly one dark primary remains and primary hierarchy is not weakened; action order, labels, icons, permissions, behaviour and destinations are untouched.** ✅ **NEW `RULE 3.7.c` — the brand mark is secondary to the operator workspace: sidebar `36px`, auth `45px` (~10% smaller), opacity `0.86`. 🔴 ARTWORK UNTOUCHED — only rendered size and opacity change, only `height` is declared so the `643 × 184` ratio cannot distort, and NO logo card, border, panel, shadow or gradient is introduced.** ✅ **`§3.21` MOTION EXTENDED from two classes to four, all on ONE scale: NEW `RULE 3.21.d` state emphasis `120ms` (colour and transform only, 🔴 no sliding indicator and no travelling underline); NEW `RULE 3.21.e` elevated arrival `150ms` for anchored overlays, 🔴 deliberately a SEPARATE system from route motion and enter-only; NEW `RULE 3.21.f` one shared duration scale — `--motion-fast` `120ms`, `--motion-standard` `150ms`, `--motion-page` `160ms` — so a component picks a speed but never invents one. ⚠ `RULE 3.21.a` amended `150ms → 160ms` and gains `.e`: the transition replays ONLY on real navigation, never on a data refresh, keystroke or routine rerender.** 🔴 **A `scale(0.98)` overlay grow was DRAFTED AND REMOVED: `RULE 15.3` forbids transform-scaled text because it resamples glyphs, and the panel is almost entirely text. `RULE 3.21.b` reduced motion extended to every new primitive with functionality preserved exactly.** ✅ **`RULE 3.17.b` DIRECTION CORRECTED to closed `0°`/DOWN, open `180°`/UP, closing a known contradiction: the business decision to invert was taken 2026-08-11 and applied in code, but this rule was never amended — the code was right and the document was the defect** (`DOC-080`). ⚠ **Superseded wording retained throughout** (`DOC-009`). |
| **2.12.0** | **2026-08-15** | ✅ **GLOBAL VISUAL FOUNDATION CORRECTION — four shared-system defects fixed at the TOKEN and BASE-STYLESHEET layer, routed under `DOC-079` from explicit business decision after the running ERP was reviewed.** 🔴 **NO BUSINESS RULE, ENTITY, PERMISSION, WORKFLOW, API, PERSISTENCE OR MIGRATION IS TOUCHED. No module is individually restyled; every module inherits.** ✅ **NEW `RULE 3.4.a` — THE WORKSPACE GROUND MOVES ONE RESTRAINED STEP DEEPER, `oklch(0.985 0.004 290)` → `oklch(0.968 0.003 290)` = `#F4F4F6`. Separation is created by GROUND CONTRAST, never by shadow: at the superseded value a white surface differed from the page by `1.02` measured — effectively nothing — so cards, rows and sections floated in one undifferentiated white field. Ordinary content surfaces REMAIN `#FFFFFF` and are never tinted to compensate; the ground is never deepened further; the ERP stays light, black-and-white dominant and information-dense.** ⚠ **CONSEQUENCE MEASURED RATHER THAN DISCOVERED: every text token was re-measured, exactly one pairing crossed a threshold — `A11Y-01b` secondary text `4.69 → 4.45` — and `--color-text-secondary` was DARKENED `oklch(0.55 0.015 290)` → `oklch(0.543 0.015 290)` to restore a measured `4.58` PASS rather than reverting the ground. `A11Y-02`'s demoted text and placeholder were ALREADY below `4.5` on the superseded ground (`4.32`, `4.33`), are unchanged, and remain AA on `#FFFFFF` — the only surface either appears on.** ✅ **NEW `RULE 3.6.c` — ORDINARY CARDS AND ROWS CARRY NO VISIBLE ELEVATION. Solving surface separation by raising shadows is prohibited; shadow means *above the page* and stays scoped to dropdowns, row action menus, popovers, dialogs, the profile menu and overlays. `RULE 3.6` remains THREE elevations — no fourth is created.** ✅ **NEW `RULE 3.8.a.b` — the identity control moves `32 × 32px` → `36 × 36px`, keeping the ink fill, white initials and the thin `1px` avatar-ring neutral (measured `4.44` on the ground). 🔴 Chat and Notifications are NOT enlarged to match and remain `34 × 34px`: they are a different KIND of control, and equalising the three would erase a deliberate distinction to satisfy a grid. Geometry only — the profile menu and its dismiss and focus behaviour are untouched.** 🔴 **NEW `RULE 6.0.c` SUPERSEDES the ink focus ring of `RULE 6.0.a` AND WITHDRAWS the ink focus BOUNDARY of `RULE 6.0.b`; both superseded treatments are retained verbatim** (`DOC-009`). **The indicator becomes `2px` of the new neutral `oklch(0.6 0 0)` = `#808080` at `2px` offset. ⚠ The root cause is recorded so it is never re-introduced: `:focus-visible` was believed keyboard-only, but browsers match it on TEXT INPUTS for POINTER focus too, so clicking any field painted a near-black frame while the rule believed it was invisible to the mouse. ✅ SC 1.4.11 IS MET, NOT TRADED AWAY — measured `3.95` on white, `3.60` on the ground, `3.72` on strip and `3.22` on the active-nav fill; a candidate at `oklch(0.62 0 0)` was REJECTED for measuring `2.97` on that last surface. A focused control's own boundary no longer changes colour, which strengthens `§8.4`. Removing focus indication remains prohibited without exception and `outline: none` appears nowhere.** ✅ **`A11Y-09` CLOSED — the interim floor of `RULE 6.0.a` is discharged by a designed, measured treatment.** ⚠ **`RULE 3.6`, `RULE 3.6.a`, `RULE 3.6.b`, `§3.19` overlay geometry, every radius, spacing, typography and viewport rule, and the `FREEZE-V1-2026-08-11` baseline are UNTOUCHED.** |
| **2.11.0** | **2026-08-13** | ✅ **`RULE 3.15.a` AMENDED — THE IMAGE DATA MODEL IS RELEASED TO ITS OWNER, routed under `DOC-079`.** 🔴 **NO VISUAL RULE CHANGED. NO TOKEN, GEOMETRY, COLOUR, TYPE OR SPACING VALUE IS TOUCHED.** **`RULE 3.15.a` declared the image data model NOT CANONICAL and named primary-image selection, image ordering, storage ownership, fallback behaviour and any authoritative URL model as UNDEFINED; `PRODUCT_ARCHITECTURE.md` `§38` has now decided the first four, so this rule CONSUMES the owner's decision instead of declaring it undefined** (`DOC-005`, `DOC-006`). 🔴 **The authoritative URL model REMAINS UNDEFINED** (`TEC-105`). ✅ **The `38 × 38px` radius `9px` list geometry and `48 × 48px` radius `10px` detail geometry are UNCHANGED.** 🔴 **`RULE 3.15.a.b` is UNCHANGED and its distinction sharpened: a media model now exists, but it is authorised by `PRD-167`–`PRD-170`, NEVER by drawing a thumbnail — and Product's rules authorise no `primary_image_url` either, because `INV-105.6` puts role and order on the REFERENCE.** 🔴 **`RULE 3.15.a.c` height and dominance constraints UNCHANGED. 🔴 `RULE 3.15.a.d` UNCHANGED and now CONFIRMED BY THE OWNER — `PRD-168.b` makes media optional, so the `oklch(0.96 0.004 290)` empty block describes an ordinary condition; no placeholder illustration, icon substitute or "no image" text is introduced.** ⚠ **Superseded wording retained** (`DOC-009`). 🔴 **No new visual design, component, uploader or gallery surface is created.** |
| **2.9.0** | **2026-08-12** | ✅ **FINAL GLOBAL UI FOUNDATION VISUAL STANDARD — `RULE 3.8.a` and `RULE 3.11.c`, routed under `DOC-079`.** ✅ **Header utilities and contextual action buttons now use white/ink no-resting-border surfaces with the existing in-flow contact elevation only; no fourth shadow, no gradient, no badge, no unread state and no new token are created.** 🔴 **Accessible focus remains mandatory and is not weakened.** |
| **2.10.0** | **2026-08-12** | ✅ **FINAL GLOBAL UI DELTA — `RULE 3.8.a` amended and `RULE 3.17.d` added, routed under `DOC-079` / `DOC-087`.** ✅ **Chat and Notifications retain the white elevated utility surface, while User/Profile is superseded back to the compact ink circular identity control with white mark, thin low-contrast resting border and restrained shadow.** ✅ **Contextual business actions may use meaningful semantic icons from the existing Lucide outline vocabulary where recognition improves; icons precede visible labels and are never decorative, mechanical or label-replacing.** 🔴 **No viewport, sidebar, Product business, permission, backend, API or migration rule changed.** |

**Amendment procedure.** Proposals state the business problem, the affected sections and rules, the proposed change, alternatives considered, and the operational impact. **Ratified amendments increment the version and are recorded here. Visual rules are never silently altered.**

---

*This document specifies visual design language and interaction presentation only. It contains no business rule, entity, workflow, permission or API specification, and it never overrides canonical business architecture.*
