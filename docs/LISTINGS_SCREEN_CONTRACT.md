# Listings — Screen Contract

**Status:** ✅ **Ratified** · **Version:** 1.2.0 · **Ratified:** 2026-08-18 · **Amended:** 2026-08-18 (`FRAME 17` accepted as implemented) · **Amended:** 2026-08-18 (`LSC-050.b` — the `FRAME 17` apply set) · **Rule prefix:** `LSC-`

> 🔴 **THIS DOCUMENT CREATES NO DESIGN.** It records the **approved** Listings Feature Pack as the visual
> authority, fixes which frames are built and which are not, and states the implementation constraints that
> `FRAME 01`–`FRAME 16` already established so later frames extend them rather than replace them.
>
> 🔴 **IT CREATES NO BUSINESS RULE, ENTITY, PERMISSION, ENDPOINT, MIGRATION OR VISUAL DECISION.** Every
> behavioural obligation traces to `PRD-173`–`PRD-199`, `INV-106`–`INV-108`, `API-062`–`API-067` and
> `PRM-090`. Where this contract appears to add meaning, the owning architecture document wins.
>
> ⚠ **BEHAVIOUR AND STATE, NOT APPEARANCE.** Layout, spacing, geometry, typography and chip form remain the
> approved pack's.

---

## Document Control

**Source authority — the Claude Design project.** 🔴 **The approved design is the Claude Design MCP project, and
no other artefact supersedes it.**

| | |
|---|---|
| **Project** | *Listings — UI Design Pack Java Erp* |
| **Project ID** | `d6810daf-c8d2-4fb3-82a6-227079fa79c6` |
| **Project URL** | <https://claude.ai/design/p/d6810daf-c8d2-4fb3-82a6-227079fa79c6?file=Listings+Feature+Pack.dc.html> |
| **MCP endpoint** | `https://api.anthropic.com/v1/design/mcp` (authorise via `/design-login`) |
| **Authoring source file** | `Listings Feature Pack.dc.html` |
| **Runtime** | `support.js` — the generated dc-runtime |

**Repo-local visual authority — the tracked files.**

| File | Role |
|---|---|
| [`design-reference/Trioloo Listings Feature Pack.html`](design-reference/Trioloo%20Listings%20Feature%20Pack.html) | 🔴 **VISUAL AUTHORITY. Never edited by implementation.** The project's own rendered pack — self-contained, all 22 frames, 617,156 bytes. ✅ **Verified byte-for-byte identical to the project's `Trioloo Listings Feature Pack.html` across the full 262,144 bytes the MCP read returns** (SHA-256 of that span `68fae587d9fb9ebc…`) |
| [`design-reference/support.js`](design-reference/support.js) | ⚠ **Contributes no canonical visual value.** The generated dc-runtime, already tracked for Shops & Channels and **byte-identical** to this project's copy (SHA-256 `8fe7df74405f3c55…`). One copy serves both packs; it is not duplicated |

> **`LSC-002` — ⚠ THE `.dc.html` AUTHORING SOURCE IS NOT TRACKED, AND THE REASON IS RECORDED RATHER THAN
> HIDDEN.** **The MCP `get_file` read is capped at 256 KiB. `Listings Feature Pack.dc.html` returns
> EXACTLY 262,144 bytes — the cap, to the byte — truncated mid-attribute.** 🔴 **The truncated copy loses
> `FRAME 21` and `FRAME 22` entirely and part of `FRAME 20`, while its index still links `#f21` and `#f22`.**
> **Committing it would have enshrined a corrupt authority that silently omits two of the six unbuilt frames.**
>
> ✅ **THE TRACKED RENDERED PACK IS THE PROJECT'S OWN FILE, PROVEN.** **The project also holds
> `Trioloo Listings Feature Pack.html`, and the tracked copy is BYTE-FOR-BYTE IDENTICAL to it across the
> entire 262,144 bytes the capped read returns** (SHA-256 of that span `68fae587d9fb9ebc…`). 🔴 **That file is
> 617,156 bytes, so the API cannot return it whole either** — **the tracked copy supplies the remainder, and
> carries all 22 frames and a closing `</html>`.** ✅ **Its frame captions `01`–`20` also match the `.dc.html`
> exactly, and it additionally carries `21` and `22`.** ⚠ **It matches the convention already set by
> Shops & Channels, which tracks its rendered pack, not its `.dc.html`.**
>
> **a.** ✅ **To track the authoring source as well, export it from the project UI** — the same route that
> produced the rendered file — **and register it here.** 🔴 **Do not reconstruct it from the truncated read.**

**Inherits:** [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) (`RULE 3.3.d` semantic roles) ·
[`UI_UX_ARCHITECTURE.md`](UI_UX_ARCHITECTURE.md) (`UX-038.f`–`.j`).
**References:** `PRD-173`–`PRD-199` · `INV-106`–`INV-108` · `API-062`–`API-067` · `PRM-090` · `E-106`–`E-108` ·
`GAP-133`.
**Sibling:** [`SHOPS_CHANNELS_SCREEN_CONTRACT.md`](SHOPS_CHANNELS_SCREEN_CONTRACT.md) (`SCS-`), whose structure
this document follows.

---

# 1. Scope

> **`LSC-001` — ✅ THE PACK IS `FRAME 01` THROUGH `FRAME 22`.** 🔴 **Twenty-two frames, numbered, and the
> numbering is the contract's own vocabulary.** ⚠ **"Points" is not a term this project uses; work that names
> a surface must name its FRAME number.**

> **`LSC-003` — ✅ THE CODEBASE CARRIES THE FRAME NUMBERS.** **Each implemented component opens with a
> `FRAME NN` doc comment naming the frame it serves.** 🔴 **A surface built from this pack without that tag is
> not traceable to its design and is treated as a draft** (`LSC-040`).

---

# 2. Frame register

> **`LSC-010` — ✅ `FRAME 01`–`FRAME 17` ARE COMPLETE as of 2026-08-18**, each with a frame-tagged
> component and a dedicated test suite. **`src/product` and `src/design` run 533/533 green, and
> `npm run build` — `tsc --noEmit && vite build` — is clean.**
>
> **a.** ⚠ **`FRAME 17` IS COMPLETE AS A LOCAL SURFACE, WHICH IS THE WHOLE OF WHAT IT IS.** **Its ratified
> set-to-value operations apply locally and its 23-test suite proves the frame's components are all present.**
> 🔴 **Its acceptance says NOTHING about outbound integration** (`LSC-051`–`LSC-053`) **and ratifies none of
> the transformation operators the pack draws** (`LSC-030.a`).

| # | Frame | Implemented in | State |
|---|---|---|---|
| **01** | Listings Workspace — populated | `ChannelListingsPage.tsx` · `ChannelListingCard.tsx` | ✅ Complete |
| **02** | Listing card anatomy + representative states | `ChannelListingCard.tsx` | ✅ Complete |
| **03** | Workspace — loading, empty and operational conditions | `ChannelListingStates.tsx` | ✅ Complete |
| **04** | Selection scope — this page vs all matching filters | `ChannelListingsPage.tsx` | ✅ Complete |
| **05** | Row action menu + permission-restricted workspace | `ChannelListingsPage.tsx` · `ChannelListingCard.tsx` | ✅ Complete |
| **06** | Listing detail — overview, price, stock, mapping, category, SKUs | `ChannelListingDetailPage.tsx` | ✅ Complete |
| **07** | Intended vs reported — aligned, diverged, not readable, unsent | `ChannelListingComparison.tsx` | ✅ Complete |
| **08** | Shared dialogs — consequence always sits above the footer | `ChannelListingComparison.tsx` · `ui/Overlay.tsx` | ✅ Complete |
| **09** | Add Listing — ERP-first creation | `ChannelListingCreatePage.tsx` · `ListingAuthoringForm.tsx` | ✅ Complete |
| **10** | Edit Listing — editable intent, read-only reported, save is local | `ChannelListingEditPage.tsx` · `ListingAuthoringForm.tsx` | ✅ Complete |
| **11** | Unmapped listing detail + Create Sellable Product handoff | `ChannelListingDetailPage.tsx` | ✅ Complete |
| **12** | Mapping modal | `MappingModal.tsx` | ✅ Complete |
| **13** | Media — master, listing intended, marketplace reported | `ListingMediaPage.tsx` | ✅ Complete |
| **14** | Orderable channel SKUs — single and variation listings | `ListingSkuSection.tsx` | ✅ Complete |
| **15** | Single push — review, then result and readback | `PushReviewModal.tsx` | ✅ Complete as screen + refusal — see `LSC-053` |
| **16** | Refresh — reads the marketplace, never writes to it | `ListingRefreshState.tsx` | ✅ Complete as screen + refusal — see `LSC-053` |
| **17** | Batch edit — local intent only, capability-aware | `ChannelListingBatchEditPage.tsx` | ✅ Complete — 23 tests; unratified operators inert, see `LSC-030.a` |
| **18** | **Batch review** before Push Selected | *none* | ⬜ **Remains — blocked** |
| **19** | **Batch result and retry** — per-listing outcomes | `ChannelListingBatchPage.tsx` — **draft** | ⬜ **Remains — blocked** |
| **20** | **Sync Now** modal + shared operation result | `ChannelListingSyncPage.tsx` — **draft** | ⬜ **Remains — blocked** |
| **21** | **Activity history** — activity and operation history | *none* | ⬜ **Remains** |
| **22** | **CSV import** — upload, validate, review, apply locally | `ChannelListingImportPage.tsx` — generic delegation | ⬜ **Remains** |

> **`LSC-011` — 🔴 `FRAME 18`–`FRAME 22` REMAIN TO BE RECONCILED AND IMPLEMENTED AGAINST THE APPROVED PACK.**
> ⚠ **"Remains" is not "absent": three of the five have a routed page already** (`LSC-040`). **Every one of
> them is built to the approved pack or not at all.**
>
> **a.** 🔴 **`FRAME 18`, `FRAME 19` AND `FRAME 20` ARE ALSO BLOCKED**, not merely unbuilt (`LSC-051`).
> **b.** ✅ **`FRAME 21` AND `FRAME 22` REMAIN AND ARE UNBLOCKED** — both are local-only (`LSC-050`).

---

# 3. Draft surfaces

> **`LSC-040` — ⚠ TWO ROUTED PAGES REMAIN DRAFTS, NOT FINISHED WORK.**
> **`ChannelListingBatchPage.tsx` and `ChannelListingSyncPage.tsx` are reachable production code built from
> `PRD-`/`INV-` rules BEFORE the pack defined their visuals.**
> 🔴 **They carry NO frame tag and NO test suite — zero tests cover `FRAME 18`–`FRAME 22`.**
>
> **a.** ✅ **They are CORRECT against the rules they cite** and must not be deleted.
> **b.** 🔴 **They are UNVERIFIED against the approved pack** and must not be treated as satisfying it.
> **c.** ✅ **Reconciling one means: match the pack, add the `FRAME NN` tag, add the suite.**
> **d.** ⚠ **`ChannelListingImportPage.tsx` is a 21-line delegation to the generic `ProductCsvImportPage`
> shared with Stock and Sellable.** **Sensible reuse that predates `FRAME 22`'s specific four-step import.**
> **e.** ✅ **`ChannelListingBatchEditPage.tsx` LEFT THIS LIST ON 2026-08-18.** **It was reconciled in place
> rather than duplicated — matched to the pack, tagged `FRAME 17`, and given the suite it never had.**
> ⚠ **Its first tests immediately exposed a latent crash the draft had carried unseen: an unmapped semantic
> state reaching `semanticRoleOf`.** 🔴 **That is the case for `c` — a draft is not proven by being reachable.**

---

# 4. Implementation constraints

> **`LSC-030` — 🔴 THE STYLE ESTABLISHED BY `FRAME 01`–`FRAME 16` IS PRESERVED, NOT RE-DECIDED.** **Later
> frames extend the existing house pattern. A second pattern introduced alongside it is a defect.**
>
> **a.** 🔴 **THE PACK'S BATCH TRANSFORMATION OPERATORS ARE UNRATIFIED, AND ARE RENDERED INERT RATHER THAN
> OMITTED.** **`FRAME 17` draws four operations that NO canonical rule defines — percentage decrease, percentage
> increase, "rounded to nearest ৳ 10", and appending a title suffix or an image to intended media.**
> ⚠ **A percentage change is a monetary FORMULA, and `DB-079` — the ERP-wide owner of BDT rounding — grants
> no "nearest ৳ 10" step.** ✅ **`PRD-187.b` ratifies batch as "the same operations at different scope", and a
> single edit SETS a value; SET-TO-VALUE is therefore the only ratified batch operation.**
>
> **a.i.** ✅ **They are SHOWN, because the approved pack shows them and implementation does not silently edit
> the design.** 🔴 **They are DISABLED and cannot be applied.** ⚠ **Rendering one as functional would invent a
> business rule** (`DOC-003`).
> **a.ii.** 🔴 **RATIFYING THEM IS A `PRD-187` DECISION, NOT THIS CONTRACT'S**, and if percentage operators are
> admitted, whether `DB-079` gains a batch-repricing rounding clause is `DB-079`'s owner's call (`DOC-006`).

> **`LSC-031` — 🔴 `LISTING_GRID` AND THE DESIGN TOKENS ARE NOT CASUALLY REFACTORED.**
>
> **a.** **`LISTING_GRID`, exported from `ChannelListingCard.tsx`, is
> `26px 38px minmax(0, 2.4fr) 1.15fr 1.25fr 0.85fr 0.72fr 128px 30px` — character-for-character the pack's own
> grid, which the pack uses 23 times.** 🔴 **Every listing-row surface imports that constant.** ⚠ **Redeclaring
> the columns is how a batch screen silently stops matching the workspace.**
> **b.** 🔴 **Styling reads CSS custom properties from `design/tokens.css`.** **No raw hex in components, no
> CSS-in-JS library, no utility-class framework.**
> **c.** 🔴 **Semantic state resolves through `semanticRoleOf()` and the role maps in `design/semanticRole.ts`,
> and EVERY role carries a mandatory text label** (`RULE 3.3.d`). **No state is communicated by colour alone.**
> **d.** 🔴 **The invariants in `design/visualFoundation.test.ts` hold: three motion durations, two easings,
> three elevations, focus styling declared in exactly one place.**
> **e.** 🔴 **Structured operational rows do not wrap.** **New row surfaces carry the same `minWidth: 0` /
> `minmax(0, …)` / `nowrap` / `ellipsis` discipline that holds a long title inside its own box.**

> **`LSC-032` — 🔴 PERMISSION CHECKS FOLLOW THE ESTABLISHED APPLICATION-SERVICE PATTERN.**
> **Gates live in the application service as private `requireManager()` / `requireViewer()` helpers that throw
> `AccessDeniedByPermissionException`.** 🔴 **NOT `@PreAuthorize`. NOT a controller-level gate.**
>
> **a.** **The four permissions are `product.channel-listing.view`, `.manage`, `.publish`, `.sync`
> (`PRM-090`), and the frontend strings match the backend constants exactly.**
> **b.** 🔴 **Hiding a control in the browser is presentation. The server refuses independently.**

> **`LSC-033` — 🔴 MONEY CROSSES THE API BOUNDARY AS A STRING, never a JSON number** (`TEC-015`).
> **`salePrice`, `promotionPrice` and `effectiveSellingPrice` are `string | null` in the client types.**
> ⚠ **`effectiveSellingPrice` is DERIVED SERVER-SIDE from the clock** (`PRD-199.d`) **and is never computed in
> the browser.** 🔴 **No `Number` on any monetary path.**

> **`LSC-034` — 🔴 NO MOCKED LISTING FIELD IS INTRODUCED.** **There is no placeholder, stub or fabricated value
> anywhere in the Listings source, and none is added.**
>
> **a.** ✅ **The two deliberate absences are explicit and stay that way**: `UnconfiguredListingAiAuthoring`
> reports unavailable and never fabricates a candidate locally; the empty adapter registry names the missing
> capability and the channel and states the request was never sent.
> **b.** ⚠ **A field the marketplace has not reported is ABSENT or NOT READABLE. It never becomes a zero, an
> empty string or a plausible default.**

---

# 5. Sequencing

> **`LSC-052` — 🔴 `ChannelAdapterPort` HAS NO IMPLEMENTATION IN `src/main`.** **The only implementation is an
> anonymous one inside `ListingRefreshTest`.** **In production `ChannelAdapterRegistry.forChannelType()`
> returns `Optional.empty()` for EVERY channel type**, and every outbound or readback request ends in a
> refusal that names the missing capability and the channel.

> **`LSC-053` — ⚠ `FRAME 15` AND `FRAME 16` ARE COMPLETE AS SCREENS AND REFUSALS, AND HAVE NEVER MOVED A BYTE
> TO DARAZ.** **Push and Refresh are fully built, tested and correct in their refusal path — but no listing
> content has ever been sent to or read back from a marketplace.** 🔴 **Their completeness must not be read as
> proof that outbound integration works.**

> **`LSC-050` — ✅ `FRAME 17`, `FRAME 21` AND `FRAME 22` ARE LOCAL-ONLY AND MAY BE IMPLEMENTED BEFORE ANY
> DARAZ LISTING ADAPTER WORK.** **Batch edit stores intent in Trioloo only, activity history reads records
> Trioloo already holds, and CSV import changes ERP intended values and never contacts a marketplace.**
>
> **a.** 🔴 **`PRD-185` — SAVE IS NOT PUSH.** **Batch edit currently has NO push call at all, and that absence
> is the enforcement mechanism.** ⚠ **It survives any rework of that page: there is no "save and publish".**
>
> **b.** ✅ **`FRAME 17` APPLY SET — UNMAPPED LISTINGS ARE EXCLUDED.** **A Listing whose `mappingState` is
> `UNMAPPED` is not written to by a batch edit apply, because it holds no ERP intended values to change.**
> **The approved pack states this in the operator's own words — *"unmapped listings are excluded — they hold
> no ERP intended values to change"* — and reports the excluded count beside the applied one.**
>
> **b.i.** 🔴 **THIS IS A CONSERVATIVE SELECTION RULE FOR `FRAME 17`, AND IT ONLY EVER NARROWS.** **It removes
> members from the apply set and can never add one.** ⚠ **`PRD-187.c` and `INV-108.4` are untouched: the scope
> is still exactly the selection that arrived, and nothing fans an edit out to a sibling Listing on the
> strength of a shared Sellable Product.**
>
> **b.ii.** 🔴 **IT AUTHORISES NOTHING ELSE.** **It does NOT authorise Daraz synchronisation, a product or
> listing pull, or publishing** (`LSC-051`, `LSC-052`). **It does NOT authorise the percentage-change formulas,
> the "nearest ৳ 10" rounding, the title suffix transform or the media append transform** — those remain
> unratified and inert wherever the pack draws them (`LSC-030`, `LSC-033`).
>
> **b.iii.** ⚠ **THE STATED REASON IS STRONGEST WHERE THE FIELD ATTACHES TO AN ORDERABLE SKU.** **`INV-106.2`
> makes the orderable channel SKU the mapping unit that price and published stock attach to, so an unmapped
> Listing genuinely has nothing for those fields to reach.** **It is weaker for Listing-level fields such as
> title.** ✅ **Excluding them anyway is the SAFE direction and is what the approved pack specifies.**
> 🔴 **Admitting unmapped Listings for Listing-level fields would WIDEN what a batch writes, which is a
> business decision `PRD-187` owns — not this contract** (`DOC-006`).

> **`LSC-051` — 🔴 `FRAME 18`, `FRAME 19` AND `FRAME 20` ARE BLOCKED until a production `ChannelAdapterPort`
> implementation exists.** **Batch review, batch result/retry and Sync Now all describe what happens when
> Trioloo talks to a marketplace.** ⚠ **Building their screens first would produce three more surfaces that can
> only ever render a refusal.**
>
> **a.** 🔴 **`INV-108.1` — A BATCH IS NOT ATOMIC ACROSS AN EXTERNAL PARTY.** **Partial success is the NORMAL
> outcome. Per-listing outcomes are retained individually; one refusal never rolls back a sibling, and no
> batch verdict collapses them.**
> **b.** ✅ **The adapter is Integration-owned work, the natural successor to the connection gate closed on
> 2026-08-17.**

---

# 6. State of the world

| Fact | State |
|---|---|
| Daraz **connection** half | ✅ **Verified closed 2026-08-17** — one seller bound, credential encrypted at rest, shop `CONNECTED` |
| Daraz **listing/product pull** | 🔴 **NOT STARTED** |
| Production `ChannelAdapterPort` | 🔴 **None** (`LSC-052`) |
| `FRAME 01`–`17` | ✅ Complete — `src/product` + `src/design` 533/533, build clean |
| `FRAME 18`–`20` | 🔴 **Blocked** on a production `ChannelAdapterPort` (`LSC-051`) — **0 tests** |
| `FRAME 21`–`22` | ⬜ **Remains**, unblocked and local-only (`LSC-050`) — **0 tests** |
| Batch transformation operators | 🔴 **UNRATIFIED and inert** — percentage change, nearest-৳ 10 rounding, title suffix, media append (`LSC-030.a`) |

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.2.0** | **2026-08-18** | ✅ **`FRAME 17` ACCEPTED AS IMPLEMENTED.** **`ChannelListingBatchEditPage.tsx` was reconciled in place to the approved pack — every component present: header, five-fact strip, `minmax(0,1fr) 320px` split, all seven field rows on `170px minmax(0,1fr) 200px`, capability badges and legend, per-channel sidebar and consequence footer — tagged `FRAME 17` and given a 23-test suite.** **`src/product` + `src/design` 533/533; `npm run build` clean.** ✅ **`LSC-010` extended to `FRAME 17`, the register row updated, `LSC-011` narrowed to `FRAME 18`–`22`, and `LSC-040` reduced to two draft pages.** 🔴 **NOTHING ELSE IS ACCEPTED BY THIS: `FRAME 18`–`20` remain BLOCKED on a production `ChannelAdapterPort`, `FRAME 21`–`22` remain, no Daraz synchronisation, product pull or publishing exists, and the percentage, nearest-৳ 10 rounding, suffix and media transforms remain UNRATIFIED and inert** (`LSC-030.a`, `LSC-051`–`LSC-053`). ✅ **Documentation only — no frontend, backend or migration change.** |
| **1.1.0** | **2026-08-18** | ✅ **`LSC-050.b` — THE `FRAME 17` APPLY SET IS PINNED.** **A Listing whose `mappingState` is `UNMAPPED` is excluded from a batch edit apply, because it holds no ERP intended values to change** — **the rule the approved pack states and the implementation follows.** 🔴 **It only ever NARROWS the apply set, leaves `PRD-187.c`/`INV-108.4` untouched, and authorises NOTHING else: not Daraz sync, not a product or listing pull, not publishing, and none of the unratified percentage, nearest-৳ 10 rounding, suffix or media transforms.** ⚠ **Records that the stated reason is strongest for SKU-attached fields (`INV-106.2`) and weaker for Listing-level fields, and that WIDENING the apply set would be a `PRD-187` decision, not this contract's** (`DOC-006`). ✅ **No frontend, backend, migration or other document changed.** |
| **1.0.0** | **2026-08-18** | **Initial ratification** (`DOC-092`). ✅ **Registers the Claude Design project as source authority and the tracked rendered pack as repo-local visual authority.** **Records the `FRAME 01`–`FRAME 22` register, `01`–`16` complete and `17`–`22` remaining, the three draft surfaces, and the implementation constraints `FRAME 01`–`16` established** — `LISTING_GRID`, tokens, `requireManager()` gating, money as strings, no mocked fields. 🔴 **Records that `ChannelAdapterPort` has no `src/main` implementation, that `FRAME 15`/`16` have moved no bytes to Daraz, that `17`/`21`/`22` are local-only, and that `18`/`19`/`20` are blocked.** ⚠ **`LSC-002` records why the `.dc.html` authoring source is not tracked: the MCP read cap truncates it at exactly 262,144 bytes and loses `FRAME 21`–`22`.** ✅ **The tracked rendered pack is proven to be the project's own file — byte-for-byte identical across the full capped read.** 🔴 **No design was created, altered or inferred.** |
