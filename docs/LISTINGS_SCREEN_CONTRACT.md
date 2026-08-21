# Listings — Screen Contract

**Status:** ✅ **Ratified** · **Version:** 1.14.0 · **Ratified:** 2026-08-18 · **Amended:** 2026-08-20 (`LSC-061` — operator surfaces drop intended-vs-reported as the mental model, per `PRD-204`) · **Amended:** 2026-08-19 (`LSC-060` — `FRAME 06` tabbed product view; refinement authority recorded) · **Amended:** 2026-08-19 (`LSC-059` — readable/editable/pushable separated; capability read from the adapter) · **Amended:** 2026-08-19 (`LSC-058` — provider markup normalised for display only) · **Amended:** 2026-08-18 (`LSC-057` — `FRAME 19` inbound half reconciled; frame still partial) · **Amended:** 2026-08-18 (`LSC-056` — `FRAME 20` implemented; four result figures unavailable) · **Amended:** 2026-08-18 (`LSC-055` — `FRAME 10` explains an unauthored Listing; no title or business rule changed) · **Amended:** 2026-08-18 (`LSC-054` — `FRAME 20`’s per-listing data source exists; frame still blocked) · **Amended:** 2026-08-18 (`LSC-052` — a read-only Daraz adapter exists) · **Amended:** 2026-08-18 (`LSC-040` test-coverage range corrected) · **Amended:** 2026-08-18 (`FRAME 22` implemented) · **Amended:** 2026-08-18 (`FRAME 21` implemented) · **Amended:** 2026-08-18 (`FRAME 17` accepted as implemented) · **Amended:** 2026-08-18 (`LSC-050.b` — the `FRAME 17` apply set) · **Rule prefix:** `LSC-`

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
| **19** | **Batch result and retry** — per-listing outcomes | `ChannelListingBatchPage.tsx` | 🟨 **Partial** — inbound half reconciled, 11 tests; outbound half blocked, see `LSC-057` |
| **20** | **Sync Now** modal + shared operation result | `ChannelListingSyncPage.tsx` | ✅ Complete — 19 tests; four result figures unavailable, see `LSC-056` |
| **21** | Activity history — activity and operation history | `ListingActivityPage.tsx` | ✅ Complete — 21 tests; channel-event outcome unavailable, see `LSC-011.c` |
| **22** | CSV import — upload, validate, review, apply locally | `ChannelListingImportPage.tsx` | ✅ Complete — 19 tests; three cells unavailable, see `LSC-011.d` |

> **`LSC-011` — 🔴 ONLY `FRAME 18` AND `FRAME 19` REMAIN, AND BOTH ARE BLOCKED** on the OUTBOUND half of a
> production `ChannelAdapterPort` (`LSC-051`). ⚠ **`FRAME 20` WAS THE THIRD AND IS NOW BUILT** — it is
> inbound-only, and the read half it needed was discharged on 2026-08-18 (`LSC-056`).
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

> **`LSC-051` — ⚠ AMENDED 2026-08-18. `FRAME 18` AND `FRAME 19` ARE BLOCKED until the OUTBOUND half of a
> production `ChannelAdapterPort` exists.** **Batch review and batch result/retry describe what happens when
> Trioloo SENDS to a marketplace, and nothing outbound exists.** ⚠ **Building their screens first would
> produce two more surfaces that can only ever render a refusal.**
>
> 🔴 **`FRAME 20` IS NO LONGER AMONG THEM.** **Sync Now is INBOUND ONLY; the read half shipped and ran
> against a real seller on 2026-08-18, so the frame was built against verified behaviour** (`LSC-056`).
> *Superseded wording retained under `DOC-009`.*
>
> **a.** 🔴 **`INV-108.1` — A BATCH IS NOT ATOMIC ACROSS AN EXTERNAL PARTY.** **Partial success is the NORMAL
> outcome. Per-listing outcomes are retained individually; one refusal never rolls back a sibling, and no
> batch verdict collapses them.**
> **b.** ✅ **The adapter is Integration-owned work, the natural successor to the connection gate closed on
> 2026-08-17.**

> **`LSC-054` — ⚠ ADDED 2026-08-18. `FRAME 20`'S PER-LISTING DATA SOURCE NOW EXISTS, AND `FRAME 20` IS STILL
> NOT BUILT.**
>
> **The first production Daraz discovery ran on 2026-08-18 and recorded 9 Listings with ZERO per-listing
> operation records** — a defect against `PRD-186.a`, registered and fixed as `GAP-134`. **A discover run now
> opens one `DISCOVER` / `INBOUND` operation per Listing, settles it with the requesting actor and time, and
> links it to the batch.**
>
> **a.** ✅ **WHAT THIS UNBLOCKS IS DATA, NOT THE SCREEN.** **The pack's "Channel read" per-listing table and
> its per-outcome tallies now have a real source.** 🔴 **`FRAME 20` REMAINS `⬜ Remains — blocked` AND IS NOT
> ACCEPTED AS IMPLEMENTED.** ⚠ **`ChannelListingSyncPage.tsx` is still a draft PAGE rather than the pack's
> modal-plus-result composition, and carries `0` tests.**
>
> **b.** 🔴 **FOUR RESULT FIGURES STILL HAVE NO SOURCE AND MUST NOT BE DERIVED.** **`Reported changes found`,
> `of which N are new divergences`, `Manual required` and `Errors` are not recorded by a discovery run.**
> ⚠ **Inventing them would fabricate a marketplace verdict, exactly as `LSC-034` and `LSC-011.c` forbid.**
>
> **c.** ⚠ **THE PACK'S "LAST READ" LINE DOES NOT RESOLVE FROM `last_sync_at`.** **Discovery deliberately does
> not write it** (`GAP-134`, `INV-107.4`) — **`last_seen_in_discovery_at` is the fact a discovery run records,
> and it is the only honest source for that line.**
>
> **d.** 🔴 **THE MONTHLY-AUTOMATIC SENTENCE HAS NO SOURCE.** **`PRD-189.a` ratifies the cadence but NO
> SCHEDULER EXISTS**, so a *"last automatic run was …"* time cannot be stated and must not be invented.
>
> **e.** 🔴 **A BUSINESS QUESTION REMAINS OPEN AND IS NOT THIS CONTRACT'S TO ANSWER** — what sync state a
> successfully read, still-`UNMAPPED` Listing carries (`GAP-134`, `PRD-186`/`INV-107`). ⚠ **Until it is
> settled, a discovered Listing reads `PENDING`, and no screen may present that as agreement or as failure.**

> **`LSC-055` — ✅ ADDED 2026-08-18. `FRAME 10` EXPLAINS AN UNAUTHORED LISTING INSTEAD OF SHOWING A
> SILENT BLANK FORM.**
>
> **A Listing that arrived through discovery has NO intended content** — `PRD-181.a` writes the REPORTED
> side only — **so the edit form is legitimately empty.** ⚠ **In production on 2026-08-18 that empty form
> was reported as broken, because nothing on screen said why it was empty.**
>
> **a.** ✅ **THE EMPTY STATE IS STATED, NOT IMPLIED.** **Where no intended content exists and the channel
> reported something, `FRAME 10` says so and links to the intended-versus-reported comparison**, which is
> where `PRD-184.b` *Accept Marketplace* is offered per field.
>
> **b.** 🔴 **REPORTED VALUES ARE SHOWN AS CONTEXT BENEATH THE FIELD AND ARE NEVER PLACED IN THE INPUT.**
> **Pre-filling would author intent by page load, and `PRD-184.a` requires a DELIBERATE operator act.**
> ✅ **Opening the page writes nothing.** ⚠ **The context is withdrawn as soon as the operator authors that
> field — from then on `FRAME 07` owns the comparison.**
>
> **c.** 🔴 **THE REPORTED VALUE IS SHOWN AS RECEIVED AND IS NEVER TRUNCATED.** **A long marketplace
> description is clamped VISUALLY and scrolls; a shortened copy would misstate what the channel said**
> (`DZC-031.h` applies the same principle to persistence).
>
> **d.** 🔴 **NO TITLE RULE IS CREATED OR CHANGED.** **Display remains `intendedTitle` → `channelReportedTitle`
> → *Untitled listing*, and the provider's title is rendered as received in whatever language it was
> written.** ⚠ **`name_en` stays an ORDINARY reported attribute and is NEVER promoted to the title** — that
> would be a `DZC-026` / `PRD-202` decision, and **none has been taken** (§6).
>
> **e.** 🔴 **NOTHING HERE TOUCHES THE WORKSPACE SUMMARY.** **The "Diverged" count still reads the stored
> `sync_state`, and the divergence a discovered Listing shows on its detail page is computed LIVE.** ⚠ **That
> inconsistency is REAL and is deliberately NOT papered over here: it resolves only when the open
> `GAP-134` question — what sync state a successfully read, still-`UNMAPPED` Listing carries — is decided.**

> **`LSC-056` — ✅ ADDED 2026-08-18. `FRAME 20` IS IMPLEMENTED, AND EVERY FIGURE ON IT IS ONE THE SERVER
> RECORDED.**
>
> **`ChannelListingSyncPage.tsx` was reconciled IN PLACE at its existing route** — the request surface and the
> shared operation result, built to the approved pack. **19 tests.** ⚠ **No new route, no duplicate page, and
> the workspace entry point is unchanged.**
>
> **a.** ✅ **THE REQUEST SURFACE CARRIES EVERY COMPONENT THE PACK DRAWS:** the channel selection with
> known-listing counts, the *"One channel per manual sync"* scope, the disabled state for an adapter that
> reports nothing readable, the three-line *"What sync does"* block with **"Sync never pushes ERP changes to a
> marketplace"**, the absence-is-not-deletion footnote, and Cancel / Start sync.
> 🔴 **`PRD-189.b` IS ENFORCED, NOT ONLY STATED** — the selection is a RADIO GROUP, and one run cannot span
> two channel instances.
>
> **b.** ✅ **THE RESULT IS READ BACK FROM THE SERVER, NEVER ASSEMBLED FROM THE REQUEST.** **Active listings
> discovered, existing refreshed and new unmapped imported come from the discovery outcome; Manual required
> and Errors come from the batch's own tally, DERIVED from its members at read time** (`INV-108.2`).
> ✅ **The *Channel read* table is one row per `E-107` operation** (`PRD-186.a`, `PRD-186.b`).
>
> **c.** 🔴 **FOUR FIGURES THE PACK DRAWS ARE NOT TRACKED, AND ARE RENDERED UNAVAILABLE RATHER THAN INVENTED**
> (`LSC-034`).
>
> | Pack figure | Why it has no source |
> |---|---|
> | **Reported changes found** | a discovery run performs no field-by-field comparison |
> | **of which N are new divergences** | nothing records which differences are NEW |
> | **Not returned this run** | `PRD-177` — a run reports what it RETURNED; absence alone means nothing |
> | **Retry incomplete channel** | `PRD-186.d` retries FAILED members, and a discovery run records none |
>
> **d.** 🔴 **THE MONTHLY-AUTOMATIC LAST-RUN TIME IS NOT FABRICATED.** **`PRD-189.a` ratifies the cadence but
> NO SCHEDULER EXISTS**, so the surface says no automatic run has been recorded rather than printing the
> pack's sample date.
>
> **e.** ⚠ **THE CHANNEL'S *last read* COMES FROM WHAT THE SERVER RECORDS, AND IT IS OFTEN ABSENT.**
> **Discovery deliberately does not write a Listing's sync time** (`INV-107.4`), **so a channel that has only
> ever been discovered shows *no read time recorded*.** 🔴 **This is a CONSEQUENCE of the open `GAP-134`
> question and is not worked around here.**
>
> **f.** 🔴 **NOTHING ON THIS SURFACE DECIDES A BUSINESS QUESTION.** **The workspace summary is untouched, no
> stored `sync_state` is written or overridden, the live comparison is not used to contradict the stored
> column, `name_en` is not mapped to a title, and the price mapping is unchanged.**

> **`LSC-057` — 🟨 ADDED 2026-08-18. `FRAME 19`'S INBOUND HALF IS RECONCILED AGAINST REAL RECORDED
> BATCHES. THE FRAME IS NOT COMPLETE.**
>
> **`ChannelListingBatchPage.tsx` was reconciled IN PLACE at its existing route and is now tagged
> `FRAME 19` (`LSC-003`).** **It reads a real batch and its real members: the subject with actor and
> both times, the server-derived summary strip, the aggregate note `INV-107.1` requires, outcome tabs
> carrying the server's counts, server-side filtering and paging, and one row per `E-107` operation.**
> **11 tests.**
>
> **a.** 🔴 **THE TITLE NAMES THE ACT THAT ACTUALLY RAN.** **The pack prints *"Push result"* because its
> example is a push; printing that over a `DISCOVER` run would describe an outbound act Trioloo has
> never performed.** ✅ **The record's own kind decides the words.**
>
> **b.** 🔴 **NO FAILURE IS FABRICATED, IN THE SCREEN OR IN ITS TESTS.** **Production has produced only
> `SUCCEEDED` members, so no fixture invents a `FAILED` or `DIVERGED` one** — ⚠ **a surface proven
> against imaginary outcomes proves nothing about the real ones.**
>
> **c.** 🔴 **TWO PACK ACTIONS ARE STATED AS UNAVAILABLE RATHER THAN RENDERED INERT.** **"Export result"
> has NO endpoint — nothing serialises a batch. "Retry N failed" appears ONLY where failed members
> exist (`PRD-186.d`), and an inbound run records none.**
>
> **d.** 🔴 **WHAT REMAINS IS THE OUTBOUND HALF, AND IT IS BLOCKED** (`LSC-051`): a push result to
> display, `FAILED`/`DIVERGED` members to filter, a retry that resends, and the per-row *Retry* /
> *Open* / *Compare* actions the pack draws beside them. ⚠ **All four need an outbound adapter and a
> DOCUMENTED Daraz write protocol; `DARAZ_PROVIDER_CONTRACT.md` covers the READ side only.**
>
> **e.** 🔴 **NOTHING HERE DECIDES A BUSINESS QUESTION.** **No `sync_state` written or overridden,
> `GAP-134` untouched, `name_en` not mapped to a title, price mapping unchanged, and `FRAME 18` still
> has no component.**

> **`LSC-058` — ✅ ADDED 2026-08-19. PROVIDER MARKUP IS NORMALISED FOR DISPLAY, AND ONLY FOR
> DISPLAY.**
>
> **A marketplace writes its description and attributes as HTML.** **The first live Daraz pull
> returned `short_description` as `<ul><li>Processor : Intel&reg; Core&trade; i5-7500</li>…`,
> and rendering it raw turned the Listing detail and `FRAME 07` into tag soup — one attribute
> made a comparison row taller than the rest of the page.**
>
> **a.** 🔴 **NOTHING STORED CHANGES.** **`PRD-181` keeps the reported side a MIRRORED EXTERNAL
> FACT and `DZC-031.h` governs how it is persisted.** ✅ **Normalisation is the last step before
> pixels: entities a provider actually writes are decoded, block and list tags become line
> breaks and bullets, inline `style` is dropped, and every remaining tag is stripped.**
>
> **b.** 🔴 **PROVIDER MARKUP IS NEVER EXECUTED.** **`dangerouslySetInnerHTML` appears nowhere in
> the frontend and must not be introduced.** ⚠ **A marketplace description is UNTRUSTED
> THIRD-PARTY INPUT; the normaliser is a pure string transform whose output is rendered as
> TEXT.** ✅ **Entities are decoded AFTER tags are stripped, so an escaped tag can never be
> reassembled into a live one.**
>
> **c.** 🔴 **NORMALISED TEXT IS FOR READING, NEVER FOR COMPARING OR SENDING.** **It is never
> written back, never pushed, and never used to decide whether two values differ** — **`PRD-181`
> compares what was stored.**
>
> **d.** ✅ **LONG VALUES ARE CONTAINED, NEVER TRUNCATED.** **A long description scrolls inside
> its own block so the whole value stays reachable and the row keeps the height its neighbours
> have.** ⚠ **A shortened copy would misstate what the channel said, exactly as `DZC-031.h`
> refuses to truncate on the way in.**
>
> **e.** ✅ **A CHANNEL FACT IS STATED ONCE, NOT PER ROW.** **The missing-adapter reason moved
> out of `FRAME 07`'s resolution column to a single line above the table** — **it describes the
> CHANNEL, and repeating it beside every difference filled a 240px column with one sentence
> over and over.** 🔴 **The push controls' disabled state is unchanged.**
>
> **f.** 🔴 **NO MAPPING OR BUSINESS RULE IS TOUCHED.** **`name_en` remains an ordinary reported
> attribute and is not promoted to a title (`DZC-026`), the price mapping is unchanged, no
> reported value is written into intent, and `GAP-134` stays open.**

> **`LSC-059` — 🔴 ADDED 2026-08-19. READABLE, EDITABLE AND PUSHABLE ARE THREE DIFFERENT THINGS,
> AND THE SURFACE NEVER CONFLATES THEM.**
>
> **a.** 🔴 **THE ADAPTER IS THE DECLARING AUTHORITY** (`API-063.a`, `PRD-125`), **and it is asked
> directly.** ⚠ **The channel view previously built its per-field capability list from
> `channel_adapter_capability` ALONE — a table NOTHING in this system writes.** **Every field
> therefore reported UNDECLARED, and the operator was told *"what it can read or write is
> unknown"* beside a channel whose adapter had just read nine real Listings.** ✅ **A stored row
> still WINS where one exists, so a per-instance override remains possible.**
>
> **b.** 🔴 **ABSENT IS STILL NO SUPPORT, NEVER ASSUMED SUPPORT** (`API-063`). **A channel with no
> adapter, or an adapter naming no field, declares nothing.**
>
> **c.** 🔴 **A FIELD IS NOT PUSHABLE BECAUSE IT IS READABLE.** **Daraz declares every listing
> field READABLE and NONE writable — no outbound write protocol is documented (`DARAZ_PROVIDER_
> CONTRACT.md` covers the READ side only) and `pushUpdate` refuses and contacts nothing.**
> ✅ **`FRAME 07`'s push control is gated on DECLARED WRITABILITY, not on adapter presence.**
>
> **d.** ✅ **THE TWO UNAVAILABILITIES KEEP SEPARATE SENTENCES**, because they send an operator to
> different places: *no adapter is configured* is waiting on Marketplace Integration; *the channel
> can be READ but declares no field writable* is a declared property of that connection.
>
> **e.** ✅ **LOCAL WORK IS NEVER BLOCKED BY AN OUTBOUND LIMITATION.** **Editing intent and
> *Accept Marketplace* change ERP values only and contact nothing** (`PRD-184.b`, `PRD-185`),
> **so neither is withdrawn when a channel declares nothing writable.**
>
> **f.** 🔴 **NO WRITE PROTOCOL IS INVENTED HERE.** **Until `DARAZ_PROVIDER_CONTRACT.md` documents
> the outbound endpoints, signing, bodies and errors, no field may be declared writable and no
> real push may be implemented.**

> **`LSC-060` — ✅ ADDED 2026-08-19. `FRAME 06` IS A TABBED PRODUCT VIEW, AND THE REFINEMENT
> AUTHORITY IS RECORDED.**
>
> **A second Claude Design project — *AI page design refinement*, `Product Listing.dc.html`
> (project `95232e3f-bf87-4922-9ac4-86c7be939cd1`) — refines HOW `FRAME 06` is composed.**
> 🔴 **IT REFINES COMPOSITION ONLY AND SUPERSEDES NOTHING.** **The Listings Feature Pack remains
> the visual authority for every frame** (`LSC-002`); **this project is consulted for the detail
> view's grouping and hierarchy, and it creates no business rule, field, action or mapping.**
>
> **a.** 🔴 **THE PAGE SELECTS A TAB; IT NO LONGER MOUNTS EVERY PANEL.** ⚠ **The strip existed
> before but SCROLLED, so overview, price, highlights, mapping, category, SKUs and the whole
> comparison table were all mounted at once** — which is what made a Listing read as a debug dump
> rather than a product view. ✅ **Only the active tab renders.**
>
> **b.** ✅ **THE GROUPING IS THE REFINEMENT PROJECT'S.** **Overview carries the listing's own
> facts, price and stock, highlights and mapping, with media and recent activity in an aside
> beside them; Orderable SKUs, Media, Category & attributes and Activity each own a tab.**
> ⚠ **The aside column exists ONLY on Overview**, so a full-width panel never sits beside an
> empty gutter.
>
> **c.** ✅ **INTENDED VS REPORTED KEEPS A TAB AND SITS LAST.** 🔴 **It is `FRAME 07`'s surface;
> the refinement project does not draw it, and it is kept reachable rather than deleted or left
> to dominate the view** (`LSC-011`).
>
> **d.** 🔴 **NOTHING WAS DROPPED — ONLY REGROUPED.** **Every panel that existed before is still
> reachable through a tab, and a test asserts that.**
>
> **e.** 🔴 **TRIOLOO'S HEADER, BUTTON AND ICON LANGUAGE IS PRESERVED, NOT COPIED FROM THE
> PROJECT.** **Button sizing, shape, spacing, icon treatment and the short operational wording
> stay Trioloo's own** (`LSC-030`). ✅ **The tab strip is TEXT ONLY — Trioloo puts icons on
> actions, not on navigation — and a test pins that no icon enters it.**
>
> **f.** ✅ **THE MEDIA PANEL DRAWS FOUR SLOTS.** **Unfilled positions are empty OUTLINES, never
> placeholder art** (`RULE 3.15.a`), **and they claim no image: the caption states what is
> actually on file.**
>
> **g.** ✅ **PROVIDER MARKUP IS ALREADY NORMALISED FOR DISPLAY ONLY** (`LSC-058`) **and long
> values are contained** — both unchanged by this refinement.
>
> **h.** 🔴 **NO BUSINESS RULE MOVED.** **`name_en` is still an attribute, the price mapping is
> unchanged, no reported value is written into intent, `GAP-134` stays open, and push remains
> unavailable.**

> **`LSC-061` — 🔴 ADDED 2026-08-20. THE OPERATOR SURFACES DROP *INTENDED VS REPORTED* AS THEIR
> MENTAL MODEL, PER `PRD-204`.**
>
> **The operator meets a pulled Daraz listing as THE LISTING.** ⚠ **The two-sided pair is retained
> in storage — it is what makes a push verifiable — but it is no longer the vocabulary or the flow.**
>
> **a.** ✅ **`FRAME 06` SHOWS THE MARKETPLACE CURRENT VALUES**, not an empty intended column.
> 🔴 **The intended-versus-reported comparison is NOT the primary view**; it stays a reachable
> surface (`FRAME 07`, `LSC-060.c`) and stops being where ordinary work happens.
>
> **b.** 🔴 ***ACCEPT MARKETPLACE* LEAVES THE ORDINARY PATH.** **It was the only route out of an
> empty form, which forced every operator through a divergence workflow to do ordinary editing**
> (`LSC-055` recorded the symptom). ✅ **`PRD-184.b` is retained for resolving a REAL divergence and
> must not be a primary control on a listing surface.**
>
> **c.** ✅ **`FRAME 10` OPENS ON THE MARKETPLACE CURRENT VALUES.** 🔴 **SEEDING IS NOT WRITING** —
> opening a page persists nothing (`PRD-204.c`), and a test pins that. **The operator's Save writes
> the local draft.**
>
> **d.** 🔴 **SAVE AND PUSH ARE NAMED APART** (`PRD-185`, `PRD-204.f`). **A save is local and
> contacts nothing; a push is separate and separately authorised.**
>
> **e.** 🔴 **A FIELD IS OFFERED FOR PUSH ONLY WHERE THE CHANNEL DECLARES IT WRITABLE**
> (`LSC-059`, `API-063.a`). ⚠ **Daraz declares NO listing field writable today, so every field is
> LOCAL-ONLY and says so in a short reason.** 🔴 **No fake push, and no per-field push control as the
> everyday path.**
>
> **f.** ⚠ **`LSC-055` IS NARROWED, NOT SUPERSEDED.** **Its unauthored-listing explanation was
> correct for a form that opened empty; once `FRAME 10` seeds from the marketplace current values
> the empty case is the exception rather than the rule.**
>
> **i.** ✅ **THE EDIT FORM IS BUILT, 2026-08-20.** **`FRAME 10` now opens on the MARKETPLACE
> CURRENT VALUES — title, description, sale price, promotion price and window, stock and channel
> category — wherever the listing holds no local draft of its own.** 🔴 **A LOCAL DRAFT ALWAYS
> WINS: the fallback applies only where the local side is genuinely absent, so an operator's
> unsent edit is never overwritten by what the channel reports.** ⚠ **AN UNREADABLE VALUE SEEDS
> NOTHING** (`SYS-034`) — **a field the channel could not report stays empty rather than being
> filled with a guess.**
>
> 🔴 **SEEDING IS NOT WRITING.** **Opening the page persists nothing; a test asserts that no PUT
> or POST leaves the page on render** (`PRD-204.c`, `PRD-181.a` untouched). ✅ **The operator's
> SAVE is the only act that records a local draft, and the control is now named *Save draft*.**
>
> 🔴 **PROVIDER MARKUP IS NORMALISED FOR EDITING ONLY** (`LSC-058`). **The description box holds
> readable text because an operator cannot edit tag soup; the STORED value is untouched.**
>
> 🔴 **THE ACCEPT MARKETPLACE ROUTE IS GONE FROM THIS FORM** (`PRD-204.d`) — **including the
> *Compare intended vs reported* link that was the only way out of the blank form.** ✅ **The
> empty-form notice is replaced by one that names where the values came from and states that
> nothing is saved yet.**
>
> 🔴 **PUSH IS STATED UNAVAILABLE** (`PRD-204.g`). **Daraz declares no listing field writable, so
> the form says a save is kept locally and cannot be sent — no control implies otherwise.**
>
> ⚠ **NO PERSISTENCE CHANGED.** **No column was renamed, no schema migrated; the local draft is
> still stored on the intended side exactly as before.**
>
> **h.** ✅ **THE VIEW IS BUILT, 2026-08-20.** **`FRAME 06` now leads with the MARKETPLACE title and
> names a local change a DRAFT; Description, Price and Promotion are separate boxes; mapping and
> stock stay first class; the comparison is NOT mounted on the main view and remains one tab away.**
> 🔴 **The Accept All control, its dialog and its handler are GONE from this surface** — `PRD-184.b`
> continues to live on the comparison surface. ⚠ **`FRAME 10` is NOT rebuilt yet; the edit form
> still opens on local values and that is the next gate.**
>
> **g.** 🔴 **NO BUSINESS SEMANTICS MOVE.** **`name_en` is still not a title, the `price`/
> `special_price` reading is unchanged, `GAP-134` stays OPEN, and nothing stored is deleted or
> reinterpreted.**

---

# 6. State of the world

| Fact | State |
|---|---|
| Daraz **connection** half | ✅ **Verified closed 2026-08-17** — one seller bound, credential encrypted at rest, shop `CONNECTED` |
| Daraz **listing/product pull** | ✅ **FIRST PULL RAN 2026-08-18** — 9 Listings, 9 SKUs, 85 attributes, read-only; per-listing operations fixed by `GAP-134` (`LSC-054`) |
| Production `ChannelAdapterPort` | ⚠ **Daraz READ half only, conditional on configuration** (`LSC-052`) — outbound still refuses |
| `FRAME 01`–`17` · `FRAME 20`–`22` | ✅ Complete — `src/product` + `src/design` 601/601, build clean |
| `FRAME 18` | 🔴 **Blocked** on the OUTBOUND half and on `PRD-187` — **no component** (`LSC-051`) |
| `FRAME 19` | 🟨 **Partial** — inbound reconciled (11 tests); outbound half blocked (`LSC-057`) |
| Channel-event outcome | ⚠ **Not persisted** — `FRAME 21` renders it unavailable rather than deriving one (`LSC-011.c`) |
| Batch transformation operators | 🔴 **UNRATIFIED and inert** — percentage change, nearest-৳ 10 rounding, title suffix, media append (`LSC-030.a`) |

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.14.0** | **2026-08-20** | ✅ **`LSC-061.i` — THE EDIT FORM IS BUILT.** **`FRAME 10` opens on the MARKETPLACE CURRENT VALUES — title, description, price, promotion and window, stock, category — wherever no local draft exists; a local draft always wins, and an unreadable value seeds nothing.** 🔴 **Seeding is not writing: opening the page persists nothing, and a test asserts no PUT or POST leaves the page on render.** ✅ **The save control is named *Save draft*; provider markup is normalised for editing only, with the stored value untouched.** 🔴 **The Accept Marketplace route — including the *Compare intended vs reported* link that was the only way out of the blank form — is gone, replaced by a notice naming where the values came from.** 🔴 **Push is stated unavailable: Daraz declares no listing field writable, so a save is local-only and no control implies otherwise.** ⚠ **No column renamed, no schema migrated — the draft still stores on the intended side.** ✅ **Frontend and docs only. `src/product` + `src/design` 686/686; build clean.** |
| **1.13.1** | **2026-08-20** | ✅ **`LSC-061.h` — THE VIEW IS BUILT.** **`FRAME 06` leads with the MARKETPLACE title and names a local change a DRAFT; Description, Price and Promotion are separate boxes; mapping and stock stay first class; the comparison is not mounted on the main view and remains one tab away.** 🔴 **The Accept All control, its dialog and its handler are removed from this surface — `PRD-184.b` continues on the comparison surface.** ⚠ **`FRAME 10` is NOT rebuilt yet — the edit form still opens on local values, and that is the next gate.** ✅ **Frontend only. `src/product` + `src/design` 683/683; build clean.** |
| **1.13.0** | **2026-08-20** | 🔴 **`LSC-061` ADDED — THE OPERATOR SURFACES DROP *INTENDED VS REPORTED* AS THEIR MENTAL MODEL, per the `PRD-204` business decision.** **The operator meets a pulled listing as THE LISTING: `FRAME 06` shows marketplace current values, and the comparison stops being the primary view while remaining reachable as `FRAME 07`.** 🔴 ***Accept Marketplace* leaves the ordinary path** — it was the only route out of an empty form, which forced every operator through a divergence workflow to do ordinary editing; **`PRD-184.b` is retained for resolving a REAL divergence.** ✅ **`FRAME 10` opens on the marketplace current values, and seeding is NOT writing — opening a page persists nothing.** 🔴 **Save and push stay named apart, and a field is offered for push only where the channel declares it writable — Daraz declares none today, so every field is LOCAL-ONLY with a short reason and there is no fake push.** ⚠ **`LSC-055` is narrowed, not superseded.** 🔴 **No business semantics move: `name_en` still not a title, price mapping unchanged, `GAP-134` OPEN, nothing stored deleted or reinterpreted.** ✅ **Documentation only in this change — UI follows.** |
| **1.12.0** | **2026-08-19** | ✅ **`LSC-060` ADDED — `FRAME 06` IS A TABBED PRODUCT VIEW.** **A second Claude Design project, *AI page design refinement* (`Product Listing.dc.html`), is recorded as the COMPOSITION refinement authority for the detail view; the Listings Feature Pack remains the visual authority for every frame and this supersedes nothing.** 🔴 **The page now SELECTS a tab instead of mounting every panel — the strip existed but scrolled, so overview, price, highlights, mapping, category, SKUs and the whole comparison table rendered at once, which is what made a Listing read as a debug dump.** ✅ **Overview carries facts, price, highlights and mapping with media and activity in an aside beside them; SKUs, Media, Category & attributes and Activity each own a tab; the aside exists only on Overview.** 🔴 **Intended vs reported keeps a tab and sits last — it is `FRAME 07`'s surface, kept reachable rather than dominating.** 🔴 **Nothing was dropped, only regrouped, and a test asserts every panel is still reachable.** 🔴 **Trioloo's header, button and icon language is preserved rather than copied from the project; the tab strip is text only and a test pins that no icon enters it.** ✅ **The media panel draws four slots with empty OUTLINES for unfilled positions, never placeholder art.** 🔴 **No business rule moved: `name_en` still an attribute, price mapping unchanged, no intent written, `GAP-134` open, push still unavailable.** ✅ **Frontend only. `src/product` + `src/design` 680/680; build clean.** |
| **1.11.0** | **2026-08-19** | 🔴 **`LSC-059` ADDED — READABLE, EDITABLE AND PUSHABLE ARE THREE DIFFERENT THINGS.** **The channel view built its per-field capability list from `channel_adapter_capability` alone — a table nothing writes — so every field reported UNDECLARED and the operator saw *"what it can read or write is unknown"* beside a channel whose adapter had just read nine real Listings.** ✅ **`API-063.a` makes the ADAPTER the declaring authority, so it is now asked directly; a stored row still wins where one exists, and absent still means NO support.** 🔴 **`FRAME 07`'s push control is gated on DECLARED WRITABILITY rather than adapter presence — Daraz declares every field readable and NONE writable, because no outbound write protocol is documented and `pushUpdate` refuses.** ✅ **The two unavailabilities keep separate sentences: a missing adapter is not the same as a read-only connection.** ✅ **Local work is untouched — editing intent and Accept Marketplace contact nothing and stay available.** 🔴 **No write protocol invented; no field declared writable.** ✅ **Backend `ChannelListingQueryService` only — no migration, no endpoint or response-shape change. Backend 613/613; `src/product` + `src/design` 663/663; build clean.** |
| **1.10.0** | **2026-08-19** | ✅ **`LSC-058` ADDED — PROVIDER MARKUP IS NORMALISED FOR DISPLAY, AND ONLY FOR DISPLAY.** **The first live Daraz pull returned `short_description` as an HTML fragment, and rendering it raw turned Listing detail and `FRAME 07` into tag soup — one attribute made a comparison row taller than the rest of the page.** ✅ **Entities a provider actually writes are decoded, block and list tags become line breaks and bullets, inline `style` is dropped, and remaining tags are stripped.** 🔴 **NOTHING STORED CHANGES — the reported side stays a mirrored external fact, and normalised text is never written back, pushed, or used to decide whether two values differ.** 🔴 **Provider markup is NEVER executed: `dangerouslySetInnerHTML` appears nowhere and entities are decoded AFTER tags are stripped, so an escaped tag cannot be reassembled into a live one.** ✅ **Long values are CONTAINED and scroll, never truncated.** ✅ **The missing-adapter reason moved out of the resolution column to one line above the table — it describes the channel, not a row.** 🔴 **No mapping or business rule touched: `name_en` stays an attribute, price mapping unchanged, no intent written, `GAP-134` open.** ✅ **Frontend only. `src/product` + `src/design` 656/656; build clean.** |
| **1.9.0** | **2026-08-18** | 🟨 **`LSC-057` ADDED — `FRAME 19`’S INBOUND HALF RECONCILED AGAINST REAL RECORDED BATCHES; THE FRAME IS NOT COMPLETE.** **`ChannelListingBatchPage.tsx` reconciled IN PLACE and tagged `FRAME 19`: subject with actor and both times, server-derived summary strip, the `INV-107.1` aggregate note, outcome tabs carrying the server’s counts, server-side filtering and paging, and one row per `E-107` operation. 11 tests.** 🔴 **The title names the act that actually ran — a `DISCOVER` run is a "Discovery result", never the pack’s "Push result".** 🔴 **No `FAILED` or `DIVERGED` member is fabricated in the screen or its fixtures.** 🔴 **"Export result" and "Retry N failed" are stated as unavailable — no export endpoint exists, and retry addresses failed members which an inbound run does not produce (`PRD-186.d`).** 🔴 **The OUTBOUND half remains BLOCKED on an adapter and a documented Daraz write protocol (`LSC-051`); `FRAME 18` still has no component.** ✅ **Also `LSC-003`: `FRAME 04`, `FRAME 11` and `FRAME 19` now named in their own source, with a traceability test.** 🔴 **No business question decided — `GAP-134` untouched, no `sync_state` written, `name_en` not mapped, price mapping unchanged.** ✅ **Frontend only. `src/product` + `src/design` 637/637; build clean.** |
| **1.8.0** | **2026-08-18** | ✅ **`FRAME 20` IMPLEMENTED — Sync Now and the shared operation result.** **`ChannelListingSyncPage.tsx` was reconciled IN PLACE at its existing route: the request surface carries the channel selection, the one-channel-per-sync scope enforced as a RADIO GROUP (`PRD-189.b`), the disabled state for an adapter reporting nothing readable, the "What sync does" block with "Sync never pushes", the absence-is-not-deletion footnote and Cancel / Start sync; the result surface carries the completion banner, the three real tallies, the batch-derived Manual required and Errors, and a per-`E-107` "Channel read" table.** 🔴 **FOUR FIGURES THE PACK DRAWS ARE RENDERED UNAVAILABLE RATHER THAN INVENTED — reported changes found, new divergences, not-returned-this-run and retry — because a discovery run tracks none of them** (`LSC-034`, `LSC-056.c`). 🔴 **The monthly-automatic last-run time is NOT fabricated: the cadence is ratified but no scheduler exists.** ⚠ **A channel’s "last read" is often absent because discovery does not write a sync time — a consequence of the OPEN `GAP-134` question, not worked around here.** 🔴 **`FRAME 18` and `FRAME 19` are UNCHANGED and remain blocked on the OUTBOUND half; `LSC-011` and `LSC-051` narrowed to those two.** 🔴 **No business question decided: workspace summary untouched, no stored `sync_state` written or overridden, `name_en` not mapped to a title, price mapping unchanged.** ✅ **Frontend only — no backend, endpoint or migration change. 19 tests; `src/product` + `src/design` 601/601; build clean.** |
| **1.7.0** | **2026-08-18** | ✅ **`LSC-055` ADDED — `FRAME 10` EXPLAINS AN UNAUTHORED LISTING INSTEAD OF A SILENT BLANK FORM.** **A discovered Listing has no intended content (`PRD-181.a`), so the edit form is legitimately empty; in production that read as a broken page.** ✅ **The page now states the condition and links to the intended-versus-reported comparison where `PRD-184.b` Accept Marketplace is offered per field.** 🔴 **Reported values appear as READ-ONLY CONTEXT BENEATH each field and NEVER in the input — pre-filling would author intent by page load, and opening the page writes nothing.** ⚠ **The context is withdrawn once the operator authors that field.** 🔴 **The reported value is shown AS RECEIVED and clamped visually rather than truncated.** 🔴 **NO TITLE RULE CHANGED — display stays `intendedTitle` → `channelReportedTitle` → *Untitled listing*, and `name_en` is NOT promoted to the title.** 🔴 **The workspace summary is untouched and `GAP-134` remains open and undecided.** ✅ **Frontend only — no backend, endpoint or migration change. `src/product` + `src/design` 582/582, build clean; backend 610/610.** |
| **1.6.0** | **2026-08-18** | ⚠ **`LSC-054` ADDED — `FRAME 20`’S PER-LISTING DATA SOURCE NOW EXISTS, AND THE FRAME IS STILL NOT BUILT.** **The first production Daraz discovery ran on 2026-08-18 and recorded 9 Listings with ZERO per-listing operation records** — a defect against `PRD-186.a`, which requires one record per Listing per requested remote act and names `discover` among its five kinds. ✅ **Registered and fixed as `GAP-134`: a discover run now opens one `DISCOVER`/`INBOUND` operation per Listing, settles it with the requesting actor and time, and links it to the batch; the channel event the read produces now names both.** 🔴 **`FRAME 20` REMAINS BLOCKED AND IS NOT ACCEPTED AS IMPLEMENTED** — `ChannelListingSyncPage.tsx` is still a draft PAGE rather than the pack’s modal-plus-result composition, and carries 0 tests. 🔴 **Four result figures still have NO source and must not be derived** — reported changes found, new divergences, manual required and errors (`LSC-034`). ⚠ **The pack’s “last read” line resolves from `last_seen_in_discovery_at`, not `last_sync_at`, which discovery deliberately does not write** (`INV-107.4`). 🔴 **NO migration, NO frontend change, and the unmapped-Listing sync-state question remains OPEN and undecided.** |
| **1.5.0** | **2026-08-18** | ⚠ **`LSC-052` AMENDED — `ChannelAdapterPort` NO LONGER HAS ZERO `src/main` IMPLEMENTATIONS.** **`DarazChannelAdapter` implements the READ half — `channelType`, `declareCapability` and `discoverActive` over `/products/get` — and registers ONLY where Daraz credentials are configured, so an unconfigured deployment still gets the honest "no marketplace adapter is configured" refusal.** 🔴 **`readListing` refuses because the content type is NOT PUBLISHED; `pushUpdate`, `publishCreate` and `withdraw` refuse and contact nothing; no field is declared writable.** 🔴 **`FRAME 18`–`20` REMAIN BLOCKED — they need the outbound half and their own surfaces, and neither exists.** ⚠ **No listing has been read from Daraz: the adapter is proven against a controlled double and production has not run it.** |
| **1.4.1** | **2026-08-18** | ✅ **`LSC-040` CORRECTED — A STALE COVERAGE RANGE, FOUND BY THE LOCAL-FRAMES CLOSURE AUDIT.** **It read "zero tests cover `FRAME 18`–`FRAME 22`", which stopped being true the moment `FRAME 22` shipped with 19 tests in v1.4.0.** ✅ **Now `FRAME 18`–`FRAME 20`, matching the two draft pages the rule already named.** 🔴 **Wording only — no rule, status, frame or decision changed, and `FRAME 18`–`20` remain BLOCKED on a production `ChannelAdapterPort`** (`LSC-051`). |
| **1.4.0** | **2026-08-18** | ✅ **`FRAME 22` IMPLEMENTED — local CSV import, and the LAST unblocked frame.** **`ChannelListingImportPage.tsx` was RECONCILED IN PLACE: it had been a 21-line delegation to the generic `ProductCsvImportPage`, which cannot express this frame.** **Route, endpoints and the shared component Stock and Sellable use are unchanged; only `readTextFile` moved to `platform/file.ts`.** **All four steps present — upload with the ratified column contract, validation tally and invalid-row table on `60px 1.3fr 1.3fr minmax(0,2.2fr) 130px` with paging and download, review with the consequence block, and the result step.** ⚠ **`LSC-011.d` records three unavailable cells (no unchanged tally, no listing reference on a row outcome, no per-field review breakdown), that the import is ALL-OR-NOTHING where the mock implies partial apply, and that the ratified column names are shown rather than the mock's caption.** 🔴 **Apply is functional ONLY on a clean file and refuses otherwise; "Review & Push" is present and inert because `FRAME 18` is blocked.** ✅ **No backend change, no endpoint, no migration.** **19 tests; `src/product` + `src/design` 573/573; build clean.** |
| **1.3.0** | **2026-08-18** | ✅ **`FRAME 21` IMPLEMENTED — local activity and operation history.** **`ListingActivityPage.tsx` is a new surface at `/inventory/products/listings/:id/activity`, entered from the `FRAME 06` detail aside that already named `FRAME 21` as the owner of the full history.** **Every component present: subject header, the four type filters, the six-column chronology on `112px 128px minmax(0,1fr) 150px 150px 120px`, server-side paging and the frame's footnote.** 🔴 **Type and Outcome are plain tracked text — the frame separates the three kinds BY THE TYPE COLUMN RATHER THAN BY COLOUR OR ICONOGRAPHY, so no row carries a pill, tone or glyph.** ⚠ **`LSC-011.c` records the one unavailable cell: a channel event has no persisted outcome, and none is fabricated.** ✅ **No backend change, no endpoint, no migration — `fetchActivity` already took a kind filter and a page.** 🔴 **`FRAME 18`–`20` remain BLOCKED, `FRAME 22` remains, and no Daraz call, product pull or publishing exists.** **21 tests; `src/product` + `src/design` 554/554; build clean.** |
| **1.2.0** | **2026-08-18** | ✅ **`FRAME 17` ACCEPTED AS IMPLEMENTED.** **`ChannelListingBatchEditPage.tsx` was reconciled in place to the approved pack — every component present: header, five-fact strip, `minmax(0,1fr) 320px` split, all seven field rows on `170px minmax(0,1fr) 200px`, capability badges and legend, per-channel sidebar and consequence footer — tagged `FRAME 17` and given a 23-test suite.** **`src/product` + `src/design` 533/533; `npm run build` clean.** ✅ **`LSC-010` extended to `FRAME 17`, the register row updated, `LSC-011` narrowed to `FRAME 18`–`22`, and `LSC-040` reduced to two draft pages.** 🔴 **NOTHING ELSE IS ACCEPTED BY THIS: `FRAME 18`–`20` remain BLOCKED on a production `ChannelAdapterPort`, `FRAME 21`–`22` remain, no Daraz synchronisation, product pull or publishing exists, and the percentage, nearest-৳ 10 rounding, suffix and media transforms remain UNRATIFIED and inert** (`LSC-030.a`, `LSC-051`–`LSC-053`). ✅ **Documentation only — no frontend, backend or migration change.** |
| **1.1.0** | **2026-08-18** | ✅ **`LSC-050.b` — THE `FRAME 17` APPLY SET IS PINNED.** **A Listing whose `mappingState` is `UNMAPPED` is excluded from a batch edit apply, because it holds no ERP intended values to change** — **the rule the approved pack states and the implementation follows.** 🔴 **It only ever NARROWS the apply set, leaves `PRD-187.c`/`INV-108.4` untouched, and authorises NOTHING else: not Daraz sync, not a product or listing pull, not publishing, and none of the unratified percentage, nearest-৳ 10 rounding, suffix or media transforms.** ⚠ **Records that the stated reason is strongest for SKU-attached fields (`INV-106.2`) and weaker for Listing-level fields, and that WIDENING the apply set would be a `PRD-187` decision, not this contract's** (`DOC-006`). ✅ **No frontend, backend, migration or other document changed.** |
| **1.0.0** | **2026-08-18** | **Initial ratification** (`DOC-092`). ✅ **Registers the Claude Design project as source authority and the tracked rendered pack as repo-local visual authority.** **Records the `FRAME 01`–`FRAME 22` register, `01`–`16` complete and `17`–`22` remaining, the three draft surfaces, and the implementation constraints `FRAME 01`–`16` established** — `LISTING_GRID`, tokens, `requireManager()` gating, money as strings, no mocked fields. 🔴 **Records that `ChannelAdapterPort` has no `src/main` implementation, that `FRAME 15`/`16` have moved no bytes to Daraz, that `17`/`21`/`22` are local-only, and that `18`/`19`/`20` are blocked.** ⚠ **`LSC-002` records why the `.dc.html` authoring source is not tracked: the MCP read cap truncates it at exactly 262,144 bytes and loses `FRAME 21`–`22`.** ✅ **The tracked rendered pack is proven to be the project's own file — byte-for-byte identical across the full capped read.** 🔴 **No design was created, altered or inferred.** |
