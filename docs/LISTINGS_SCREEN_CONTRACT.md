# Listings — Screen Contract

**Status:** ✅ **Ratified** · **Version:** 1.0.0 · **Ratified:** 2026-08-18 · **Rule prefix:** `LSC-`

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

> **`LSC-010` — ✅ `FRAME 01`–`FRAME 16` ARE COMPLETE as of the audit of 2026-08-18**, each with a
> frame-tagged component and a dedicated test suite. **434 Listings tests; `src/product` runs 493/493 green.**

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
| **17** | **Batch edit** — local intent only, capability-aware | `ChannelListingBatchEditPage.tsx` — **draft** | ⬜ **Remains** |
| **18** | **Batch review** before Push Selected | *none* | ⬜ **Remains — blocked** |
| **19** | **Batch result and retry** — per-listing outcomes | `ChannelListingBatchPage.tsx` — **draft** | ⬜ **Remains — blocked** |
| **20** | **Sync Now** modal + shared operation result | `ChannelListingSyncPage.tsx` — **draft** | ⬜ **Remains — blocked** |
| **21** | **Activity history** — activity and operation history | *none* | ⬜ **Remains** |
| **22** | **CSV import** — upload, validate, review, apply locally | `ChannelListingImportPage.tsx` — generic delegation | ⬜ **Remains** |

> **`LSC-011` — 🔴 `FRAME 17`–`FRAME 22` REMAIN TO BE RECONCILED AND IMPLEMENTED AGAINST THE APPROVED PACK.**
> ⚠ **"Remains" is not "absent": four of the six have a routed page already** (`LSC-040`). **Every one of them
> is built to the approved pack or not at all.**

---

# 3. Draft surfaces

> **`LSC-040` — ⚠ THREE ROUTED PAGES ARE DRAFTS, NOT FINISHED WORK.**
> **`ChannelListingBatchEditPage.tsx`, `ChannelListingBatchPage.tsx` and `ChannelListingSyncPage.tsx` are
> reachable production code built from `PRD-`/`INV-` rules BEFORE the pack defined their visuals.**
> 🔴 **They carry NO frame tag and NO test suite — zero tests cover `FRAME 17`–`FRAME 22`.**
>
> **a.** ✅ **They are CORRECT against the rules they cite** and must not be deleted.
> **b.** 🔴 **They are UNVERIFIED against the approved pack** and must not be treated as satisfying it.
> **c.** ✅ **Reconciling one means: match the pack, add the `FRAME NN` tag, add the suite.**
> **d.** ⚠ **`ChannelListingImportPage.tsx` is a 21-line delegation to the generic `ProductCsvImportPage`
> shared with Stock and Sellable.** **Sensible reuse that predates `FRAME 22`'s specific four-step import.**

---

# 4. Implementation constraints

> **`LSC-030` — 🔴 THE STYLE ESTABLISHED BY `FRAME 01`–`FRAME 16` IS PRESERVED, NOT RE-DECIDED.** **Later
> frames extend the existing house pattern. A second pattern introduced alongside it is a defect.**

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
| `FRAME 01`–`16` | ✅ Complete, 434 Listings tests, `src/product` 493/493 |
| `FRAME 17`–`22` | ⬜ Remains — **0 tests** |

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.0.0** | **2026-08-18** | **Initial ratification** (`DOC-092`). ✅ **Registers the Claude Design project as source authority and the tracked rendered pack as repo-local visual authority.** **Records the `FRAME 01`–`FRAME 22` register, `01`–`16` complete and `17`–`22` remaining, the three draft surfaces, and the implementation constraints `FRAME 01`–`16` established** — `LISTING_GRID`, tokens, `requireManager()` gating, money as strings, no mocked fields. 🔴 **Records that `ChannelAdapterPort` has no `src/main` implementation, that `FRAME 15`/`16` have moved no bytes to Daraz, that `17`/`21`/`22` are local-only, and that `18`/`19`/`20` are blocked.** ⚠ **`LSC-002` records why the `.dc.html` authoring source is not tracked: the MCP read cap truncates it at exactly 262,144 bytes and loses `FRAME 21`–`22`.** ✅ **The tracked rendered pack is proven to be the project's own file — byte-for-byte identical across the full capped read.** 🔴 **No design was created, altered or inferred.** |
