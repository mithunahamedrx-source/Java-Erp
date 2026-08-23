# Order Card DS — written specification

**Captured:** 2026-08-24 · **Source:** Claude Design project `63b1762f-7588-4c3f-bf32-afc766fb3351`,
file `Order Card DS.dc.html` · **Status:** **Binding visual reference for the Orders card**
**Registered at:** [`../ORDERS_SCREEN_CONTRACT.md`](../ORDERS_SCREEN_CONTRACT.md) `OSC-055`

---

> ⚠ **A SCREENSHOT WITHOUT A WRITTEN SPECIFICATION IS NOT A REFERENCE** (`design-reference/README.md`).
> This file records what the design **fixes** — the properties that bind — rather than merely what
> it shows.

## How it was obtained

🔴 **The `DesignSync` MCP could not read the project.** `get_project` and `list_files` both returned
`HTTP 404 — project not found`, and `list_projects` showed only one writable design-system project,
which does not contain this file. ⚠ **This is the same condition `OSC-012` recorded for project
`e56dcf10-…`, and the same discipline applied: designing from a remembered impression of an
unreadable file was refused.**

✅ **The product owner supplied the rendered bundle and a screenshot directly**, and the
specification below is transcribed from the bundle's own markup — not from the picture.

⚠ **`support.js` CARRIES NO VISUAL AUTHORITY.** `design-reference/README.md` already records it as
generated `dc-runtime` framework code with *zero `oklch` values, zero `Manrope` references, zero
design tokens*. It was not consulted and nothing in it is implemented.

## What this design fixes

**A three-band card.** The bands are the composition; they are not decorative.

| Band | Padding | Separation | Carries |
|---|---|---|---|
| **1 — Identity** | `10px 16px` | bottom `1px` divider-light | avatar · customer · contact · time · origin · state chips · payment · order number |
| **2 — Line** | `12px 16px` | — | thumbnail `38px`/`9px` · product · demoted economics · primary economics · actions |
| **3 — Document strip** | `7px 16px` | top `1px` divider-light, strip background | invoice · destination · note |

**Container:** `#FFFFFF`, `1px` card border, radius `16px`, `overflow: hidden`, card elevation.

**Type scale, as fixed:** customer `14px/700` · meta `12px/500` · demoted meta `11.5px/500` ·
sub-line `10px/500` · product `14px/600` · demoted value `12px/600` · primary label `11.5px/500` ·
primary value `15px/700` · order number `13px/700` monospace · invoice `10.5px/700`, tracking
`0.04em` · chip `12px/600`, radius `999px`, padding `4px 10px` · button `13px/600`, height `32px`,
radius `9px`.

**Economic hierarchy — the load-bearing part.** `Sale · Cost · Charges` are DEMOTED (smaller,
muted, grouped) and DIVIDED by a vertical rule from `Received · Margin`, which are PRIMARY (larger,
heavier, darker). ✅ This is the same hierarchy [`02-orders-list.png`](02-orders-list.png) already
fixes, and the two references agree.

## ✅ Colour: nothing was invented

🔴 **EVERY `oklch(…)` IN THE SOURCE RESOLVES TO AN EXISTING CANONICAL TOKEN.** The design was
authored from the same token matrix as `frontend/src/design/tokens.css`, so `RULE 15.1` cost
nothing to honour. Verified pairs include the app ground, card border, both dividers, the vertical
rule, ink, link, text primary / secondary / muted / demoted, both icon strokes, the strip
background, the pending and neutral status pairs, the positive green, the secondary-button border
and text, both radii and the card elevation.

⚠ **ONE VALUE HAS NO TOKEN.** The `Received` / `Margin` labels are `oklch(0.55 0.015 290)`; the
nearest ratified token is `--color-text-muted` at `oklch(0.5 0.015 290)`. 🔴 **The TOKEN is used and
the literal is not hard-coded** (`RULE 15.1`). The one-step difference is recorded here rather than
smuggled into a component.

## 🔴 What the implementation deliberately does NOT take

**A mockup's sample data is not evidence of a business rule** (`design-reference/README.md`).

| The design shows | Why it is not implemented |
|---|---|
| **`Not Released` chip** | 🔴 `BR-080` **WITHDREW** `NOT_RELEASED` — *"the state is not to be implemented"*. The slot carries the ORDER AUTHORITY instead (`BR-168`, `UX-183`), which is a fact the order holds |
| **`Cost ৳0`, `Charges 0`** | 🔴 `INV-32.4` — an unknown cost renders UNKNOWN, never zero |
| **`Received ৳41,490`** | 🔴 `BR-033` — the obligation follows DELIVERED goods, and no receipt or settlement record exists in this slice |
| **`Margin ৳41,490` in green** | 🔴 `BR-007` / `SYS-034` — a margin over an unknown cost is UNKNOWN. `E-032` records this exact defect from live experience: a line showing a margin figure that was in fact unknown. The positive token is also withheld: `RULE 3.14.a.a` — a value takes the role its meaning deserves, never the one it resembles |
| **`More Actions ▾`** | 🔴 Every action it would open is outside the read-only slice or blocked in `OSC-050`; `OSC-051.b` forbids rendering a future write control |
| **`Parcel {id}`** | ⚠ The stored field is Daraz's `purchase_order_id`; `DZC-047.c` names a SEPARATE `package_id` this slice does not import. `UX-271.a` — a visual reference never renames a canonical fact |
| **`Direct ERP · SBID …`** | ⚠ Sample origin. The card names the CHANNEL INSTANCE and the external order id, because `BR-002` makes channel type alone insufficient attribution |

## Layout obligations this card inherits

🔴 **ALL THREE BANDS ARE STRUCTURED OPERATIONAL ROWS AND DO NOT WRAP** (`RULE 7.4`, `UX-266`). Each
carries `.operational-row` and `minWidth: 0`, so a long name ellipsises rather than forcing the row
wider. 🔴 **No `overflow-x` anywhere** (`UX-265`).
