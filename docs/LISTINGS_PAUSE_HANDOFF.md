# Listings — Pause and Handoff Note

**Owner:** Trioloo Technology · **Kind:** 📌 **Status record — NOT canonical architecture**
**Version:** 1.0.0 · **Recorded:** 2026-08-22 · **Registered:** `DOC-093` · **Rule prefix:** **none — this document issues no rules**

> 🔴 **THIS DOCUMENT DECIDES NOTHING.** It records **where Listings was left** on 2026-08-22, when the
> product owner paused the Listing View visual redesign and the team moved to the Order module.
>
> 🔴 **IT CREATES NO BUSINESS RULE, ENTITY, PERMISSION, ENDPOINT, MIGRATION, DESIGN OR STATUS CHANGE.**
> Every fact below is transcribed from an owning document, from the repository, or from git history, and
> is cited. Where it appears to say something new, **the owning document wins** (`DOC-005`, `DOC-010`).
>
> ⚠ **IT CLOSES NO OPEN QUESTION AND REOPENS NONE.** `GAP-134`, `GAP-136`, `DZC-026`/`PRD-202`,
> `PRD-199` and `PRD-187` are exactly as their owners left them.

**Reads:** [`LISTINGS_SCREEN_CONTRACT.md`](LISTINGS_SCREEN_CONTRACT.md) v1.16.0 ·
[`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) v1.30.0 ·
[`DARAZ_PROVIDER_CONTRACT.md`](DARAZ_PROVIDER_CONTRACT.md) v1.10.0 ·
[`GAP_ANALYSIS.md`](GAP_ANALYSIS.md) v2.62.1 ·
[`PRODUCTION_DEPLOYMENT_RUNBOOK.md`](PRODUCTION_DEPLOYMENT_RUNBOOK.md) v1.5.0.

---

# 1. Completed — Listings

| Item | State | Source |
|---|---|---|
| **Daraz connection** | ✅ **Verified closed 2026-08-17** — one seller bound, credential encrypted at rest, shop `CONNECTED` | `LSC` §6 · `GAP-133` |
| **Daraz listing pull** | ✅ **First production pull ran 2026-08-18** — **9 Listings, 9 orderable SKUs, 85 attributes**, read-only | `LSC` §6 · `GAP-134` |
| **Per-listing discover records** | ✅ **Defect found and fixed 2026-08-18** — one `DISCOVER`/`INBOUND` operation per Listing, settled with actor and time, linked to the batch; **no migration needed** | `GAP-134` |
| **Price/stock WRITE protocol** | ✅ **Verified by one live call, 2026-08-21.** The `DZC-041` controlled same-value probe was **run once and accepted** (`code` `0`): `ItemId` + `SellerSku` addresses a SKU, a plain `<Quantity>` is accepted, and the success envelope carries **no `data` node** | `DZC-041`, `DZC-042` |
| **Backend price/stock push support** | ✅ **Implemented 2026-08-22** (`d54c27c`). `DarazChannelAdapter` **declares `sale_price` and `listing_stock` writable**; `pushUpdate` sends only what changed; promotion is never sent; a nothing-to-send payload is refused; a variation listing is refused; `901` is recorded as **needing another attempt, never a refusal**. `POST /operations` already routed `PUSH_UPDATE` with actor attribution — **no backend change was needed for the UI half** | `PRD-205`, `LSC-062`, `LSC-063` |
| **`PRD-204` View** | ✅ **Built 2026-08-20** — `FRAME 06` leads with the **marketplace** title, names a local change a **draft**, keeps mapping and stock first class, and moves the comparison one tab away; Accept All removed from this surface | `LSC-061.h` |
| **`PRD-204` Edit** | ✅ **Built 2026-08-20** — `FRAME 10` **opens on the marketplace current values** where no local draft exists; a local draft always wins; an unreadable value seeds nothing; **seeding is not writing** (a test asserts no PUT/POST on render); the control is named *Save draft* | `LSC-061.i` |
| **Push control on Edit** | ✅ **Built 2026-08-22** (`b974bfd`) — sits under *Save draft*, **generated from the channel's own declaration** rather than hardcoded, offered only where a draft holds a push-supported change, states the partial slice, confirms an **act** not a payload, and never reports success on the adapter's behalf. ⚠ **Committed, NOT deployed** — see §4 | `LSC-063` |

### Frame register at pause

| Frames | State |
|---|---|
| **`FRAME 01`–`17`, `20`, `21`, `22`** | ✅ **Complete** — each frame-tagged and test-covered (`LSC-003`, `LSC-010`) |
| **`FRAME 19` — inbound half** | 🟨 **Reconciled** against real recorded batches, 11 tests (`LSC-057`) |
| **`FRAME 19` — outbound half** | 🔴 **Blocked** — needs a push result to display, `FAILED`/`DIVERGED` members, and a resending retry |
| **`FRAME 18` — batch review** | 🔴 **Blocked, no component** (`LSC-051`) |

> ⚠ **`FRAME 18`/`19` were blocked on the outbound adapter half.** **That half now exists for two fields
> only** (`PRD-205`). 🔴 **Whether a two-field slice discharges either block is a `LSC-051` question that
> has NOT been asked or answered**, and this note does not answer it.

---

# 2. Paused — Listings

> 🔴 **THE PAUSE IS A PRODUCT-OWNER DECISION, RECORDED 2026-08-22.** ⚠ **It is a pause, not a
> cancellation, and it withdraws no ratified rule.**

**a.** 🔴 **THE EXACT VISUAL MATCH TO THE *Product Listing* DESIGN IS PAUSED.** The refinement authority
is the second Claude Design project — *AI page design refinement*, `Product Listing.dc.html`,
project `95232e3f-bf87-4922-9ac4-86c7be939cd1` — registered at `LSC-060` as a **composition** authority
that **supersedes nothing**. ⚠ **Repeated attempts did not reach the product owner's acceptance bar.**
✅ **`LSC-060` stands as written; nothing about it is withdrawn or amended by this pause.**

**b.** 🔴 **THE CURRENT VIEW IS NOT ACCEPTED AS FINAL.** ⚠ **`FRAME 06` is `✅ Complete` in the
`LSC-010` register against the Listings Feature Pack, and that acceptance is unchanged — it is the
*Product Listing* composition refinement that is unfinished.** 🔴 **The two must not be conflated: the
frame is built; the refinement is not accepted.**

**c.** ⚠ **THE EDIT/PUSH UI IS COMMITTED AND NOT DEPLOYED.** `b974bfd` is on `main` only; the deployed
build is `d54c27c` (§4). 🔴 **Until it ships, the production Edit form carries the previous wording and
no push control**, while the deployed **backend already declares two fields writable** — the exact
mismatch `b974bfd` was written to fix.

**d.** 🔴 **NO REAL PRICE OR STOCK PUSH HAS BEEN PERFORMED BY AN OPERATOR.** ⚠ **The only bytes Trioloo
has ever written to Daraz are the `DZC-041` probe's single same-value call, which changed nothing by
construction** (`DZC-042.f`). ✅ **`pushUpdate` is implemented and reachable server-side; the operator
control that drives it is undeployed.** 🔴 **The first real push therefore has NOT happened.**

---

# 3. Open decisions — all owned elsewhere, none decided here

| # | Question | Owner | State |
|---|---|---|---|
| **1** | **`GAP-134` sync state** — what `sync_state` a successfully read, still-`UNMAPPED` Listing carries. `PRD-181` decides divergence by comparing intent against reported, and an `UNMAPPED` Listing has no intent; neither `SYNCED` nor `DIVERGED` is stated to apply and `PENDING` is a default, not a decision | `PRD-186` / `INV-107` | 🔴 **OPEN.** ⚠ Its visible consequences — a discovered Listing showing no read time, and the workspace "Diverged" count reading stored state while detail computes live — are **deliberately not papered over** (`LSC-054.e`, `LSC-055.e`, `LSC-056.e`) |
| **2** | **`name_en` → title** — whether the Daraz `name_en` attribute may be promoted to a Listing title | `DZC-026` / `PRD-202` | 🔴 **OPEN.** ✅ **Corroborated, not decided:** `name_en` does **not appear in the write payload at all** (`GAP-136`). Display stays `intendedTitle` → `channelReportedTitle` → *Untitled listing* |
| **3** | **`price` / `special_price` semantics** | `PRD-199` | ✅ **RATIFIED and unchanged.** ⚠ Listed here only because it is repeatedly re-raised: the write side **corroborates** it (`<Price>` / `<SalePrice>` + window) and ratifies nothing new (`GAP-136`) |
| **4** | **Batch transformation operators** — percentage decrease, percentage increase, "rounded to nearest ৳ 10", title-suffix and media-append | `PRD-187` (and `DB-079` if a rounding step is admitted) | 🔴 **UNRATIFIED.** ✅ Shown in `FRAME 17` because the approved pack shows them, **disabled and inert** (`LSC-030.a`). **SET-TO-VALUE remains the only ratified batch operation** |
| **5** | **Remaining Daraz write fields** — title, description, highlights, attributes, channel category, media, orderable SKUs, publication state, deactivate, remove | `PRD-205` / `DZC-039` | 🔴 **BLOCKED, each by a named reason.** **Five of seven `DZC-039` unknowns remain open**: how `/product/update` targets an existing product · whether an omitted attribute is preserved or cleared · whether the `/image/upload` file is signed · the numeric limits behind `E204` and `901` · the timezone of a date-only promotion window. ⚠ **Deactivate and remove need `SkuId`, which Trioloo does not persist — a READ change, not a write one** (`DZC-037.b`) |
| **6** | **`V15` review migration** — whether `V15__channel_listing_review.sql` is applied in production | Deployment (`DEP-070`) | 🔴 **UNVERIFIED — see §4.** ⚠ **`GAP-136` records it unapplied as of 2026-08-21**, and `DEP-071` records that **starting the backend IS the migration**, while `V15` is present in the deployed commit's tree. 🔴 **The two cannot both be true and this note does not guess which is** |

---

# 4. Production state at pause

> 🔴 **EVERY FIGURE BELOW IS EITHER READ OUT OF THIS REPOSITORY OR MARKED AS A DISCOVERY ITEM.**
> ⚠ **Nothing here was observed on the origin during this task — no server was contacted.**

| Fact | Value | Basis |
|---|---|---|
| **Deployed commit** | **`d54c27c`** *Push sale price and listing stock to Daraz* — tracked by the branch **`release/v14n-no-v15`** | branch tip; corroborated by `b974bfd`'s own record that the **deployed** build had a backend declaring two fields writable and a frontend insisting none was |
| **`main` ahead by** | **1 commit — `b974bfd`**, the capability-driven push control on Edit. 🔴 **Not deployed** | `git log release/v14n-no-v15..main` |
| **Backend artifact** | `trioloo-erp-backend-0.1.0-SNAPSHOT.jar` — `pom.xml` `<version>0.1.0-SNAPSHOT</version>` | ⚠ **`DEP-030.a` — the jar name is DERIVED and a deployment resolves the real file rather than assuming this string** |
| **Frontend release** | `package.json` version **`0.1.0`**; served from `/var/www/trioloo-erp/releases/<UTC-timestamp>/` behind the `current` symlink | 🔴 **THE DEPLOYED TIMESTAMP IS NOT RECORDED IN THIS REPOSITORY — a discovery item** (`DEP-042.f`) |
| **Flyway — source** | `V1` … **`V15`** present in the tree, at `main` **and** at `d54c27c` | `backend/src/main/resources/db/migration/` |
| **Flyway — production** | 🔴 **UNVERIFIED. `V14` is the last version documented as applied; `GAP-136` (2026-08-21) states `V15` remains unapplied** | ⚠ **`DEP-070.b` — pending migrations are determined by reading production `flyway_schema_history` and are NEVER ASSUMED** |
| **`V15` applied?** | 🔴 **UNKNOWN, AND THE EVIDENCE CONFLICTS** — see below | — |
| **Listing counts** | **9 Listings · 9 orderable SKUs · 85 attributes**, from the 2026-08-18 first pull. ⚠ **No later count is recorded anywhere in this repository** | `GAP-134`, `LSC` §6 |

> **🔴 THE `V15` CONTRADICTION, STATED RATHER THAN RESOLVED.**
>
> **`V15__channel_listing_review.sql` IS PRESENT in the deployed commit's tree**, and `DEP-071` records
> that **migrations run in-process at backend startup**, so starting that artifact would apply it.
> **`GAP-136` records `V15` as unapplied in production**, and the release branch is named
> **`v14n-no-v15`**, which asserts the same intent. ⚠ **Nothing in this repository records how the
> deployed artifact was built, so the two cannot be reconciled from source.**
>
> 🔴 **RESOLUTION IS A ONE-LINE READ, NOT A DECISION:** `flyway_schema_history` on the production
> database (`DEP-031` step 7). ✅ **It must be read BEFORE the next backend deployment**, because that
> deployment will apply whatever is pending — including `V15` — as a side effect of starting.

---

# 5. Risk note — why the redesign stopped, and what a next attempt needs

**a.** 🔴 **DO NOT RESUME THE LISTING VIEW REDESIGN WITHOUT A TIGHTER VISUAL ACCEPTANCE PROCESS.**
⚠ **The failure was not a shortage of implementation attempts. It was that "matches the design" was
judged by eye, whole-page, after the fact** — so each attempt could be rejected without either side
being able to name which part failed, and the next attempt started from the same ambiguity.

**b.** ✅ **A NEXT ATTEMPT SHOULD CARRY AN ACCEPTANCE MECHANISM BEFORE IT CARRIES CODE.** Two shapes,
either acceptable:

> **b.i.** ✅ **A mechanical diff** — a screenshot or Playwright visual comparison against the rendered
> reference, so a mismatch is a **measured pixel or token delta** rather than an opinion.
> 🔴 **THIS ADDS A TEST DEPENDENCY AND A TOOL, AND THAT IS A `TEC-003` AMENDMENT, NOT AN
> IMPLEMENTATION DETAIL.** ⚠ **The frontend today runs Vitest + Testing Library + jsdom and has no
> browser-driving or image-comparison tooling of any kind** — **introducing one is a Technology
> Architecture decision and must be raised, not slipped in.**
>
> **b.ii.** ✅ **A smaller acceptance gate** — **ONE section of ONE frame per round**, accepted or
> rejected on its own, before the next section is touched. ⚠ **This needs no new dependency and can
> start immediately.**

**c.** 🔴 **NEITHER MECHANISM MAY BECOME A ROUTE TO CHANGING THE DESIGN.** **The Listings Feature Pack
remains the visual authority** (`LSC-002`) **and `Product Listing.dc.html` remains a composition
refinement that supersedes nothing** (`LSC-060`). ⚠ **A diff that disagrees with the pack is evidence
about the implementation, never a licence to amend the pack.**

**d.** ⚠ **THE UNDEPLOYED PUSH CONTROL IS A LIVE INCONSISTENCY WITH A SHORT SAFE LIFE.** **Production
currently tells operators that no field can be sent, while its own backend declares two writable.**
✅ **It is safe — the surface under-claims rather than over-claims, and nothing can be pushed by
accident.** 🔴 **It should not be left indefinitely**, and deploying it is a separate, explicitly
authorised act (`DEP-010.c`).

---

# 6. Unknowns (`DOC-018`)

**Recorded as unknown, deliberately not resolved by inference.**

**a.** 🔴 **Whether `V15` is applied in production** — §4. **Answerable only by reading
`flyway_schema_history`.**
**b.** 🔴 **The deployed frontend release timestamp** — not recorded in this repository (`DEP-042.f`).
**c.** ⚠ **Whether the production listing count is still 9** — no discovery run after 2026-08-18 is
recorded here.
**d.** ⚠ **Whether the two-field outbound slice affects the `FRAME 18`/`FRAME 19` blocks** — a
`LSC-051` question, not asked.
**e.** 🔴 **What the product owner's acceptance criteria for the *Product Listing* composition actually
are** — **the pause exists because they were never expressed in a form an implementation could be
tested against.** ⚠ **This is the single most load-bearing unknown in this document.**

---

# 7. Defects observed and NOT fixed here

> ⚠ **Reported under `CLAUDE.md` §4. This task changed no source code and no owning document.**

**a.** ⚠ **Stale Javadoc contradicting its own method.**
`backend/src/main/java/com/trioloo/erp/integration/infrastructure/daraz/DarazChannelAdapter.java:113`
still reads *"NOTHING IS WRITABLE, BECAUSE NOTHING IS WRITTEN"*, while `writable(…)` twenty lines
below returns `true` for `SALE_PRICE` and `LISTING_STOCK` (`PRD-205`). 🔴 **A comment, not behaviour —
the declaration itself is correct.**

**b.** ⚠ **`DEP-070.a` and `DEP-070.e` are stale** — they name `V1`–`V12` as applied history and `V12`
as the source ceiling, against a tree that now ends at `V15`. ✅ **`DEP-070.e`'s own escape clause
already governs this — *"unless disk inspection proves a later migration exists, in which case DISK
WINS"* — so no rule is breached**, but the figures are out of date.

**c.** ⚠ **The index status dashboard row 1 reads `current v1.61.8` while the index header reads
v1.63.1** — a pre-existing inconsistency, untouched by this note.

---

## Version history

| Version | Date | Change |
|---|---|---|
| **1.0.0** | **2026-08-22** | **Initial record** (`DOC-093`). ✅ **Registers the Listings pause and the state Listings was left in before the Order module begins.** **Records completed work** — Daraz connection, first pull, the accepted write probe, backend `sale_price`/`listing_stock` push support, the `PRD-204` View and Edit rebuilds, and the frame register. **Records paused work** — the *Product Listing* exact visual match, the View not accepted as final, the committed-but-undeployed Edit/push UI, and that **no operator push has ever run**. **Records six open decisions, every one owned elsewhere.** 🔴 **Records the production state, and states the `V15` contradiction rather than resolving it: the migration is in the deployed tree, `DEP-071` applies migrations at startup, and `GAP-136` says it is unapplied — resolvable only by reading `flyway_schema_history`.** ⚠ **Records why the redesign stopped and what a next attempt needs, noting that Playwright-style visual diffing is a `TEC-003` amendment and not an implementation detail.** 🔴 **No business rule, design, status, migration or source file changed.** |
