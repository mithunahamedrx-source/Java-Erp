# Listings — Screen Contract

**Status:** ✅ **Ratified** · **Version:** 1.5.0 · **Ratified:** 2026-08-18 · **Amended:** 2026-08-18 (`LSC-052` — a read-only Daraz adapter exists) · **Amended:** 2026-08-18 (`LSC-040` test-coverage range corrected) · **Amended:** 2026-08-18 (`FRAME 22` implemented) · **Amended:** 2026-08-18 (`FRAME 21` implemented) · **Amended:** 2026-08-18 (`FRAME 17` accepted as implemented) · **Amended:** 2026-08-18 (`LSC-050.b` — the `FRAME 17` apply set) · **Rule prefix:** `LSC-`

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

> **`LSC-010` — ✅ `FRAME 01`–`FRAME 17`, `FRAME 21` AND `FRAME 22` ARE COMPLETE as of 2026-08-18**, each
> with a frame-tagged component and a dedicated test suite. **`src/product` and `src/design` run 573/573
> green, and `npm run build` — `tsc --noEmit && vite build` — is clean.**
>
> **b.** ✅ **EVERY LOCAL-ONLY FRAME IS NOW BUILT.** 🔴 **What remains is blocked, not merely unstarted**
> (`LSC-051`).
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
| **21** | Activity history — activity and operation history | `ListingActivityPage.tsx` | ✅ Complete — 21 tests; channel-event outcome unavailable, see `LSC-011.c` |
| **22** | CSV import — upload, validate, review, apply locally | `ChannelListingImportPage.tsx` | ✅ Complete — 19 tests; three cells unavailable, see `LSC-011.d` |

> **`LSC-011` — 🔴 ONLY `FRAME 18`–`FRAME 20` REMAIN, AND ALL THREE ARE BLOCKED** on a production
> `ChannelAdapterPort` (`LSC-051`). ⚠ **Two of the three have a routed draft page already** (`LSC-040`).
> **Every one of them is built to the approved pack or not at all.**
>
> **a.** 🔴 **THEY ARE BLOCKED, NOT MERELY UNBUILT.** **Batch review, batch result/retry and Sync Now all
> describe what happens when Trioloo talks to a marketplace.**
> **b.** ✅ **`FRAME 22` WAS IMPLEMENTED ON 2026-08-18**, completing the local-only set.
>
> **c.** ⚠ **`FRAME 21` IS COMPLETE WITH ONE CELL DELIBERATELY UNAVAILABLE — A CHANNEL EVENT'S OUTCOME.**
> **`ActivityView` persists `entryKind`, `summary`, `fieldKey`, `beforeValue`, `afterValue`, `source`,
> `actorName`, `operationId`, `batchId` and `occurredAt` — and NO outcome.** ✅ **Two of the three kinds
> resolve honestly: a `FIELD_CHANGE` is `Local` by definition (`PRD-185.b`), and an `OPERATION` reads its real
> outcome from the operation record its `operationId` names (`E-107`).** 🔴 **A `CHANNEL_EVENT` has no such
> source, so the cell renders the unavailable marker.** ⚠ **The pack prints "DIVERGED" and "Resolved" there;
> deriving those would fabricate a marketplace verdict Trioloo never recorded** (`LSC-034`).
>
> **c.i.** ✅ **CLOSING IT IS A PERSISTENCE DECISION, NOT A SCREEN ONE** — whether a channel event carries a
> stored outcome belongs to `PRD-186`/`E-107`'s owner and would need a migration. 🔴 **Neither was taken here.**
>
> **d.** ⚠ **`FRAME 22` IS COMPLETE WITH THREE CELLS UNAVAILABLE AND ONE BEHAVIOUR NARROWER THAN THE MOCK.**
> **`/import/validate` returns `planId`, `validRows`, `errorRows` and per-row outcomes of
> `{rowNumber, result, field, message}` — and nothing else.**
>
> **d.i.** ⚠ **NO "UNCHANGED" TALLY EXISTS.** **The frame's third tile counts rows that would change nothing;
> the plan reports no such figure and the Listings importer never emits a `WARNING` outcome that could stand
> in for one.** 🔴 **The tile renders the unavailable marker.**
> **d.ii.** ⚠ **A ROW OUTCOME CARRIES NO LISTING REFERENCE.** **The frame's second column names the listing a
> bad row was aiming at; the outcome record holds a row number and a column, not an identity.**
> **d.iii.** ⚠ **THERE IS NO PER-FIELD REVIEW BREAKDOWN.** **The planned rows are not serialised, so no honest
> count of "how many rows change the price" exists.** 🔴 **Deriving one by re-parsing the CSV in the browser
> would second-guess the server's own plan and could disagree with what confirm actually writes** (`TEC-095`).
> **d.iv.** 🔴 **THE IMPORT IS ALL-OR-NOTHING, AND THE MOCK IMPLIES OTHERWISE.** **The controller returns an
> EMPTY `planId` whenever any row failed, so a file with refusals cannot be confirmed at all** — **while the
> frame shows "Apply 1,187 rows" beside "17 skipped".** ✅ **The screen follows the SERVER: apply is disabled
> and states that the file must be corrected and revalidated.** ⚠ **Whether an import may partially apply is
> a `PRD-195` business decision and was NOT taken here.**
> **d.v.** 🔴 **THE COLUMN NAMES SHOWN ARE THE RATIFIED ONES, NOT THE MOCK'S CAPTION.** **The pack lists
> `erp_listing_id`, `sellable_sku`, `intended_price` and `listing_stock`; the CSV contract calls those
> `listing_id`, `mapped_sellable_sku`, `sale_price` and `published_marketplace_stock`.** ⚠ **A design mock
> does not rename a ratified interface — printing its names would hand operators a template that fails on
> every row** (`DOC-003`).

---

# 3. Draft surfaces

> **`LSC-040` — ⚠ TWO ROUTED PAGES REMAIN DRAFTS, NOT FINISHED WORK.**
> **`ChannelListingBatchPage.tsx` and `ChannelListingSyncPage.tsx` are reachable production code built from
> `PRD-`/`INV-` rules BEFORE the pack defined their visuals.**
> 🔴 **They carry NO frame tag and NO test suite — zero tests cover `FRAME 18`–`FRAME 20`.**
>
> **a.** ✅ **They are CORRECT against the rules they cite** and must not be deleted.
> **b.** 🔴 **They are UNVERIFIED against the approved pack** and must not be treated as satisfying it.
> **c.** ✅ **Reconciling one means: match the pack, add the `FRAME NN` tag, add the suite.**
> **d.** ✅ **`ChannelListingImportPage.tsx` WAS A 21-LINE DELEGATION TO THE GENERIC `ProductCsvImportPage`
> AND WAS RECONCILED IN PLACE ON 2026-08-18.** ⚠ **The generic component could not express `FRAME 22` — the
> validation tally, the invalid-row table, the per-field review and the listing-specific consequence copy are
> Listings-only.** 🔴 **The route, the endpoints and the shared component that Stock and Sellable still use
> were left exactly as they were; only the file-reading helper moved to `platform/file.ts` so one
> implementation serves all three.**
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

> **`LSC-052` — ⚠ AMENDED 2026-08-18. A DARAZ ADAPTER NOW EXISTS IN `src/main`, AND IT IS READ-ONLY AND
> CONDITIONAL.** **`DarazChannelAdapter` implements `channelType`, `declareCapability` and `discoverActive`
> against `/products/get` (`DZC-020`–`DZC-028`).**
>
> **a.** 🔴 **IT REGISTERS ONLY WHERE DARAZ CREDENTIALS ARE CONFIGURED.** **An adapter with no App Key would
> resolve, declare capability, then fail every call — which reads as a BROKEN integration rather than an
> absent one.** ✅ **Where it is unconfigured, `ChannelAdapterRegistry` still returns `Optional.empty()` and
> the honest "no marketplace adapter is configured" refusal still stands.**
> **b.** 🔴 **`readListing` REFUSES — the content type `/product/item/get` expects is NOT PUBLISHED**
> (`DZC-029.d`).
> **c.** 🔴 **`pushUpdate`, `publishCreate` AND `withdraw` REFUSE AND CONTACT NOTHING.** ⚠ **No field is
> declared writable, because nothing is written.**
> **d.** 🔴 **NO LISTING HAS BEEN READ FROM DARAZ.** **The adapter is proven against a controlled double;
> production has not run it, and `GAP-133`'s first live pull remains NOT STARTED.**

> **`LSC-053` — ⚠ `FRAME 15` AND `FRAME 16` ARE COMPLETE AS SCREENS AND REFUSALS, AND HAVE NEVER MOVED A BYTE
> TO DARAZ.** **Push and Refresh are fully built, tested and correct in their refusal path — but no listing
> content has ever been sent to or read back from a marketplace.** 🔴 **Their completeness must not be read as
> proof that outbound integration works.**

> **`LSC-050` — ✅ `FRAME 17`, `FRAME 21` AND `FRAME 22` ARE LOCAL-ONLY AND MAY BE IMPLEMENTED BEFORE ANY
> DARAZ LISTING ADAPTER WORK.** ✅ **ALL THREE WERE BUILT ON THAT BASIS AND SHIPPED WITHOUT AN ADAPTER —
> `FRAME 17` and `FRAME 21` on 2026-08-18, `FRAME 22` the same day.** **Batch edit stores intent in Trioloo only, activity history reads records
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
| Production `ChannelAdapterPort` | ⚠ **Daraz READ half only, conditional on configuration** (`LSC-052`) — outbound still refuses |
| `FRAME 01`–`17` · `FRAME 21`–`22` | ✅ Complete — `src/product` + `src/design` 573/573, build clean |
| `FRAME 18`–`20` | 🔴 **Blocked** on a production `ChannelAdapterPort` (`LSC-051`) — **0 tests** |
| Channel-event outcome | ⚠ **Not persisted** — `FRAME 21` renders it unavailable rather than deriving one (`LSC-011.c`) |
| Batch transformation operators | 🔴 **UNRATIFIED and inert** — percentage change, nearest-৳ 10 rounding, title suffix, media append (`LSC-030.a`) |

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.5.0** | **2026-08-18** | ⚠ **`LSC-052` AMENDED — `ChannelAdapterPort` NO LONGER HAS ZERO `src/main` IMPLEMENTATIONS.** **`DarazChannelAdapter` implements the READ half — `channelType`, `declareCapability` and `discoverActive` over `/products/get` — and registers ONLY where Daraz credentials are configured, so an unconfigured deployment still gets the honest "no marketplace adapter is configured" refusal.** 🔴 **`readListing` refuses because the content type is NOT PUBLISHED; `pushUpdate`, `publishCreate` and `withdraw` refuse and contact nothing; no field is declared writable.** 🔴 **`FRAME 18`–`20` REMAIN BLOCKED — they need the outbound half and their own surfaces, and neither exists.** ⚠ **No listing has been read from Daraz: the adapter is proven against a controlled double and production has not run it.** |
| **1.4.1** | **2026-08-18** | ✅ **`LSC-040` CORRECTED — A STALE COVERAGE RANGE, FOUND BY THE LOCAL-FRAMES CLOSURE AUDIT.** **It read "zero tests cover `FRAME 18`–`FRAME 22`", which stopped being true the moment `FRAME 22` shipped with 19 tests in v1.4.0.** ✅ **Now `FRAME 18`–`FRAME 20`, matching the two draft pages the rule already named.** 🔴 **Wording only — no rule, status, frame or decision changed, and `FRAME 18`–`20` remain BLOCKED on a production `ChannelAdapterPort`** (`LSC-051`). |
| **1.4.0** | **2026-08-18** | ✅ **`FRAME 22` IMPLEMENTED — local CSV import, and the LAST unblocked frame.** **`ChannelListingImportPage.tsx` was RECONCILED IN PLACE: it had been a 21-line delegation to the generic `ProductCsvImportPage`, which cannot express this frame.** **Route, endpoints and the shared component Stock and Sellable use are unchanged; only `readTextFile` moved to `platform/file.ts`.** **All four steps present — upload with the ratified column contract, validation tally and invalid-row table on `60px 1.3fr 1.3fr minmax(0,2.2fr) 130px` with paging and download, review with the consequence block, and the result step.** ⚠ **`LSC-011.d` records three unavailable cells (no unchanged tally, no listing reference on a row outcome, no per-field review breakdown), that the import is ALL-OR-NOTHING where the mock implies partial apply, and that the ratified column names are shown rather than the mock's caption.** 🔴 **Apply is functional ONLY on a clean file and refuses otherwise; "Review & Push" is present and inert because `FRAME 18` is blocked.** ✅ **No backend change, no endpoint, no migration.** **19 tests; `src/product` + `src/design` 573/573; build clean.** |
| **1.3.0** | **2026-08-18** | ✅ **`FRAME 21` IMPLEMENTED — local activity and operation history.** **`ListingActivityPage.tsx` is a new surface at `/inventory/products/listings/:id/activity`, entered from the `FRAME 06` detail aside that already named `FRAME 21` as the owner of the full history.** **Every component present: subject header, the four type filters, the six-column chronology on `112px 128px minmax(0,1fr) 150px 150px 120px`, server-side paging and the frame's footnote.** 🔴 **Type and Outcome are plain tracked text — the frame separates the three kinds BY THE TYPE COLUMN RATHER THAN BY COLOUR OR ICONOGRAPHY, so no row carries a pill, tone or glyph.** ⚠ **`LSC-011.c` records the one unavailable cell: a channel event has no persisted outcome, and none is fabricated.** ✅ **No backend change, no endpoint, no migration — `fetchActivity` already took a kind filter and a page.** 🔴 **`FRAME 18`–`20` remain BLOCKED, `FRAME 22` remains, and no Daraz call, product pull or publishing exists.** **21 tests; `src/product` + `src/design` 554/554; build clean.** |
| **1.2.0** | **2026-08-18** | ✅ **`FRAME 17` ACCEPTED AS IMPLEMENTED.** **`ChannelListingBatchEditPage.tsx` was reconciled in place to the approved pack — every component present: header, five-fact strip, `minmax(0,1fr) 320px` split, all seven field rows on `170px minmax(0,1fr) 200px`, capability badges and legend, per-channel sidebar and consequence footer — tagged `FRAME 17` and given a 23-test suite.** **`src/product` + `src/design` 533/533; `npm run build` clean.** ✅ **`LSC-010` extended to `FRAME 17`, the register row updated, `LSC-011` narrowed to `FRAME 18`–`22`, and `LSC-040` reduced to two draft pages.** 🔴 **NOTHING ELSE IS ACCEPTED BY THIS: `FRAME 18`–`20` remain BLOCKED on a production `ChannelAdapterPort`, `FRAME 21`–`22` remain, no Daraz synchronisation, product pull or publishing exists, and the percentage, nearest-৳ 10 rounding, suffix and media transforms remain UNRATIFIED and inert** (`LSC-030.a`, `LSC-051`–`LSC-053`). ✅ **Documentation only — no frontend, backend or migration change.** |
| **1.1.0** | **2026-08-18** | ✅ **`LSC-050.b` — THE `FRAME 17` APPLY SET IS PINNED.** **A Listing whose `mappingState` is `UNMAPPED` is excluded from a batch edit apply, because it holds no ERP intended values to change** — **the rule the approved pack states and the implementation follows.** 🔴 **It only ever NARROWS the apply set, leaves `PRD-187.c`/`INV-108.4` untouched, and authorises NOTHING else: not Daraz sync, not a product or listing pull, not publishing, and none of the unratified percentage, nearest-৳ 10 rounding, suffix or media transforms.** ⚠ **Records that the stated reason is strongest for SKU-attached fields (`INV-106.2`) and weaker for Listing-level fields, and that WIDENING the apply set would be a `PRD-187` decision, not this contract's** (`DOC-006`). ✅ **No frontend, backend, migration or other document changed.** |
| **1.0.0** | **2026-08-18** | **Initial ratification** (`DOC-092`). ✅ **Registers the Claude Design project as source authority and the tracked rendered pack as repo-local visual authority.** **Records the `FRAME 01`–`FRAME 22` register, `01`–`16` complete and `17`–`22` remaining, the three draft surfaces, and the implementation constraints `FRAME 01`–`16` established** — `LISTING_GRID`, tokens, `requireManager()` gating, money as strings, no mocked fields. 🔴 **Records that `ChannelAdapterPort` has no `src/main` implementation, that `FRAME 15`/`16` have moved no bytes to Daraz, that `17`/`21`/`22` are local-only, and that `18`/`19`/`20` are blocked.** ⚠ **`LSC-002` records why the `.dc.html` authoring source is not tracked: the MCP read cap truncates it at exactly 262,144 bytes and loses `FRAME 21`–`22`.** ✅ **The tracked rendered pack is proven to be the project's own file — byte-for-byte identical across the full capped read.** 🔴 **No design was created, altered or inferred.** |
