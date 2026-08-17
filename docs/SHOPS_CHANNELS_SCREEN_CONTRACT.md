# Shops & Channels — Screen Contract

**Status:** Ratified · **Version:** 3.2.0 · **Ratified:** 2026-08-15 · **Amended:** 2026-08-15 (`SCS-030` — Market is a closed-set selection) · **Amended:** 2026-08-15 (implementation-state only — `SCS-042.d` and the `SCS-030.b` cross-reference) · **Amended:** 2026-08-15 (`SCS-092` resolved — the approved Channel Type selector is canonically valid) · **Rule prefix:** `SCS-`

> 🔴 **v3.0.0 RECONCILES THE USER-APPROVED FEATURE PACK.** **The approved design at [`docs/design-reference/`](design-reference/) — *Trioloo Shops and Channels Feature Pack.html* — carries controls and facts that v2.0.1 had DEFERRED. ⚠ Those deferrals are SUPERSEDED, not defended: an approved design is a requirement input, and a contract that contradicts it is the thing that is wrong** (`DOC-009`).
>
> ✅ **THE THREE-SURFACE MODEL SURVIVES UNCHANGED.** **The pack adds components, not screens.**

---

## Document Control

**Approved design reference:** [`design-reference/Trioloo Shops and Channels Feature Pack.html`](design-reference/Trioloo%20Shops%20and%20Channels%20Feature%20Pack.html) — 🔴 **VISUAL AUTHORITY. Never edited by implementation.** ⚠ `support.js` beside it is the generated dc-runtime and carries no requirement.
**Inherits:** [`UI_UX_ARCHITECTURE.md`](UI_UX_ARCHITECTURE.md) (`UX-024`, `UX-273`) · [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md) (`RULE 3.3.d` semantic roles).
**References:** `E-015`, `E-016`, `INV-16.1`–`INV-16.16`, `DM-084`, `DM-085` · `SYS-024`, `SYS-108`–`SYS-111` · `API-068`–`API-071` · `PRM-090` · `GAP-132`, `GAP-133`.

> 🔴 **BEHAVIOUR, NOT APPEARANCE.** **Layout, spacing, geometry, typography and chip form remain the approved pack's.** **This document fixes facts, actions, states, authority and boundaries so implementation invents no business meaning.**

---

# 1. Goal and model

> **`SCS-001` — ✅ THE FLOW THIS MODULE COMPLETES.** **From no shop, to one verified connected shop Listings can target: register → authorise → verify which account was bound → activate.**

> **`SCS-002` — ✅ ONE RECORD IS ONE EXACT `E-016`.** 🔴 **No "Provider" entity** (`DM-084.a`); *Daraz* is the displayed **Channel Type**. 🔴 **No singleton assumption — several accounts on one channel type are normal, and the pack shows four Daraz shops.**

---

# 2. Surfaces

> **`SCS-010` — ✅ THREE SURFACES, MATCHING THE APPROVED PACK.**
>
> | ID | Surface | Type | Route |
> |---|---|---|---|
> | **`SC-W`** | Workspace | Full page | `/administration/shops` — frozen (`UX-024`) |
> | **`SC-F`** | Shop form — add and edit | **Modal** | *(no route)* |
> | **`SC-D`** | Shop detail | Full page | `/administration/shops/:id` |
>
> **a.** 🔴 **THE AUTHORISATION RESULT IS A STATE OF `SC-D`, NEVER ITS OWN SCREEN** — the pack states this explicitly. **The callback route is Integration-owned** (`API-069`).
> **b.** 🔴 **MORE COMPONENTS DID NOT PRODUCE MORE SCREENS.**
> **c.** ⚠ **Page actions sit in the existing header band; the shell is drawn in the pack as CONTEXT ONLY and is not redesigned.**

---

# 3. `SC-W` — Workspace

> **`SCS-020` — ✅ THE SUMMARY STRIP. Ratified from the approved pack; supersedes v2.0.1's omission.**
>
> **One card per CHANNEL TYPE present, plus an ALL-SHOPS card.**
>
> | Card | Figures |
> |---|---|
> | **All shops** | the count of channel types · total shops · **the configuration split** — Active, Draft, Suspended |
> | **Per channel type** | **attention count** · shop count · **the connection split** — Connected, Reauthorization required, Not connected, Connection error |
>
> **a.** 🔴 **EVERY FIGURE IS DERIVED, NOT STORED** (`DB-001`). **All of them are computable from the shop records the rows already show; no counter column exists or is created.**
> **b.** ✅ **ONLY CONDITIONS THAT ACTUALLY OCCUR ARE LISTED IN A CARD** — the pack shows Daraz without a Connection-error line because none of its shops is in that condition.
> **c.** 🔴 **NO ORDER, RETURN, MESSAGE, SETTLEMENT OR LISTING FIGURE APPEARS.** ⚠ **Those domains are not built and a zero would be a business claim the system cannot make** (`SCS-061`).

> **`SCS-021` — ✅ "NEEDS ATTENTION" MEANS A SHOP WHOSE CONNECTION IS NOT `CONNECTED`.**
>
> **Derived from the pack's own arithmetic rather than from the label:** **Daraz shows 4 shops — Connected 2, Reauthorization required 1, Not connected 1 — and reports `2 need attention`. Website shows 2 shops — Connected 1, Connection error 1 — and reports `1 needs attention`.**
>
> **a.** ✅ **CONTRIBUTING CONDITIONS: `NOT_CONNECTED`, `REAUTH_REQUIRED`, `ERROR`** (`API-068`).
> **b.** 🔴 **CONFIGURATION LIFECYCLE CONTRIBUTES NOTHING.** ⚠ **A `DRAFT` shop is not "attention" — `SUSPENDED` appears in the configuration split and never in the attention figure.**
> **c.** ⚠ **It is an operational prompt, not a defect count: a shop nobody has connected yet is legitimately awaiting attention.**

> **`SCS-022` — ✅ SEARCH. Supersedes v2.0.1's deferral.**
>
> **Scope is exactly what the pack's placeholder states: `Search shop name, code or link`** — 🔴 **shop display name, internal code and external link. NOTHING ELSE.**
>
> **a.** 🔴 **SERVER-RESOLVED AND PAGEABLE** (`TEC-096`); no client-side filtering, no fuzzy or advanced search.
> **b.** ✅ **It combines with the filters as an AND.** ⚠ **An empty result is an ordinary outcome and says so; it is not an error state.**

> **`SCS-023` — ✅ FILTERS. Supersedes v2.0.1's deferral.**
>
> | Filter | Values |
> |---|---|
> | **Channel type** | the recognised types (`SCS-030.b`), plus *all* |
> | **Connection** | `CONNECTED` · `NOT_CONNECTED` · `REAUTH_REQUIRED` · `ERROR`, plus *all* |
> | **Status** | `DRAFT` · `ACTIVE` · `SUSPENDED` · `ARCHIVED`, plus *all* |
>
> **a.** ✅ **SINGLE-SELECT EACH, combined as AND, and server-resolved.**
> **b.** ✅ **ACTIVE FILTERS ARE VISIBLE AND INDIVIDUALLY REMOVABLE** — the pack shows a count (`1 filter`), a removable token (`Channel: Daraz ×`) and **`Clear`**, which returns every filter to *all* and leaves search untouched.
> **c.** ✅ **A RESULT COUNT IS SHOWN — `Showing 6 of 6 shops`:** matched against total registered.
> **d.** 🔴 **NO ADVANCED-FILTER DRAWER, NO DATE FILTER, NO SAVED VIEW.**

> **`SCS-024` — ✅ THE ROW.**
>
> **Columns, in the approved order: Shop · Channel type · Configuration · Connection · External link, and an affordance opening the shop.**
>
> **a.** 🔴 **THE SHOP'S OWN NAME IS THE PRIMARY IDENTITY** — a row reading only its channel type identifies nothing (`DM-059`, `INV-16.11`).
> **b.** 🔴 **CONFIGURATION AND CONNECTION ARE TWO COLUMNS WITH TWO DIFFERENT CARRIERS** — the pack renders configuration as plain uppercase text and connection as a chip. ⚠ **This is what lets *suspended but connected* and *active but broken* both read correctly, and both appear in the pack.**
> **c.** ✅ **EXTERNAL LINK shows the visit affordance where bound and states `Not yet bound` where not** (`SCS-041`).
> **d.** ✅ **OPENING A ROW ROUTES TO `SC-D`.** 🔴 **No per-row action menu exists — every act happens on the detail page.**
> **e.** ⚠ **Semantic colour follows the GLOBAL system** (`RULE 3.3.d`); **no Shops-local colour rule exists.**

> **`SCS-025` — ✅ WORKSPACE STATES.**
>
> **Populated · empty · loading · retrieval failure**, all four in the approved pack.
>
> **a.** ✅ **EMPTY explains what a shop IS** — one exact account on one marketplace or website, several on the same channel being normal — **and offers Add Shop.** 🔴 **Not presented as integration setup; no key or secret appears.**
> **b.** ✅ **LOADING PRESERVES ROW GEOMETRY AND GUESSES NO STATE TEXT.**
> **c.** ✅ **RETRIEVAL FAILURE states that nothing changed and that this is a READ failure rather than evidence that shops are missing, and offers `Try again`.**

---

# 4. `SC-F` — Shop form

> **`SCS-030` — ✅ THE FIELD CONTRACT.**
>
> | Fact | Add | Edit |
> |---|---|---|
> | **Shop display name** | ✅ **OPERATOR INPUT, required** | ✅ **editable** |
> | **Channel type** | ✅ **OPERATOR INPUT, required, CLOSED SET** | 🔴 **FIXED once in operational use, with the reason shown** |
> | **Market** | ✅ **OPERATOR SELECTED, required, CLOSED SET** | 🔴 **FIXED once an account is bound, with the reason shown** |
> | **Internal code** | 🔴 **ERP-ASSIGNED** — absent from the add form | 🔴 **READ-ONLY**, under *Assigned by Trioloo* |
> | **External link** | 🔴 **REMOTE-DERIVED** — absent from the add form | 🔴 **READ-ONLY**, under *Assigned by Trioloo* |
> | **External account identity** | 🔴 **REMOTE-DERIVED — never typed** | 🔴 **never editable** |
> | **Configuration / connection** | 🔴 **SYSTEM — `DRAFT` / `NOT_CONNECTED`** | 🔴 **not form fields** |
> | **Credentials, keys, tokens, passwords** | 🔴 **ABSENT — no credential field exists on this surface** | 🔴 **ABSENT** |
>
> **a.** ✅ **THREE OPERATOR INPUTS, exactly as the pack states.**
> **b.** 🔴 **CHANNEL TYPE IS SELECTED FROM THE SET TRIOLOO RECOGNISES AND CANNOT BE TYPED FREELY** — **it decides which adapter the shop will use** (`API-071.a`). ✅ **The approved set is RESOLVED in `SCS-092`; the closed-set rule itself was never in question.**
> **b.i** ✅ **MARKET IS SELECTED FROM THE CLOSED ERP-SUPPLIED SET, NOT TYPED** (`INV-16.7.a`). **The current set holds exactly one member — `BANGLADESH`, labelled *Bangladesh* — and that is the ratified set rather than a placeholder** (`INV-16.7.b`). 🔴 **FREE TEXT IS FORBIDDEN AND AN UNRECOGNISED VALUE IS REJECTED, NEVER NORMALISED.** ⚠ **The options are served by the SERVER, exactly as the channel types are, so the form can never offer a value the backend would refuse.** 🔴 **A further market is a canonical amendment, never a form edit.**
> **c.** ✅ **THE FORM STATES WHAT SAVE DOES:** created `DRAFT` and `NOT_CONNECTED`, internal code assigned by Trioloo, and the operator lands on the shop page where Connect binds the account.
> **d.** 🔴 **IT NEITHER CREATES NOR CONTACTS THE REMOTE ACCOUNT.**
> **e.** ✅ **VALIDATION sits under the field it belongs to.** ⚠ **The pack uses the black exception outline and NO colour here, which is `RULE 3.18.f`'s field treatment — not a `Notice`, and not a departure from `RULE 3.3.d`.**
> **f.** ✅ **EXITS: a created shop routes to its detail page; a saved edit returns to whichever surface opened the modal.**

---

# 5. `SC-D` — Shop detail

> **`SCS-040` — ✅ SECTIONS AND FACTS, as approved.**
>
> | Section | Contents |
> |---|---|
> | **Header** | breadcrumb · shop name · configuration · connection · a context line of channel type · market · internal code · the page actions |
> | **Identity** | shop display name · channel type · **market, as its canonical DISPLAY LABEL** (`INV-16.7.b`) · internal code · **external link** · **the bound account and when it was bound** |
> | **Configuration and connection** | each state with a plain sentence of what it means, and 🔴 **an explicit statement that they are TWO INDEPENDENT FACTS** |
> | **Listings** | states that Listings are managed in Products and that **synchronisation, refresh and push stay there** · **View Listings** |
> | **Authorisation** | when the shop was authorised · Connect or Reauthorize · 🔴 **an explicit assurance that passwords, keys and tokens are never shown or stored here** |
> | **Lifecycle** | **when it was activated and by whom** · `Activate` where applicable · ⚠ **a statement that suspending or archiving is not available in this release** |
>
> 🔴 **NO TOKEN, SECRET, PROVIDER PAYLOAD, ENDPOINT OR ERROR CODE APPEARS** (`API-070`).
> 🔴 **NO PLACEHOLDER FOR AN UNBUILT DOMAIN** — no Orders, Returns, Chat or Settlement section, and never a zero (`SCS-061`).

> **`SCS-041` — ✅ THE EXTERNAL LINK IS A SECOND, DISTINCT REMOTE FACT.**
>
> 🔴 **IT IS NOT THE ACCOUNT IDENTITY AND THE TWO ARE NEVER COLLAPSED.**
>
> | | External account identity | External link |
> |---|---|---|
> | **Purpose** | the authoritative binding identity (`INV-16.5`, `INV-16.6`) | an operator-facing way to open the shop on the channel |
> | **Source** | remote, on authorisation | remote-derived, on authorisation |
> | **Typed?** | 🔴 never | 🔴 never |
> | **Optional** | absent until bound | ⚠ **may be absent even when bound** — not every channel exposes one |
> | **Before binding** | *not yet bound* | *not yet bound* |
>
> **a.** 🔴 **THE LINK IS NEVER USED AS IDENTITY, FOR BINDING, OR FOR MISMATCH CHECKING** (`INV-16.6`).
> **b.** ✅ **It is a safe, non-secret business fact and may be shown wherever the pack shows it** — workspace column, form read-only block, detail identity.

> **`SCS-042` — ✅ THE OPERATIONAL AUDIT FACTS THE PACK SHOWS.**
>
> | Fact | Meaning | Source event |
> |---|---|---|
> | **bound at** | when this shop became bound to its CURRENT exact remote account | the first successful authorisation that bound it (`INV-16.5`) |
> | **authorised at** | when authorisation was last successfully established or renewed | any successful Connect or Reauthorize |
> | **activated at** | when `DRAFT → ACTIVE` succeeded | the `Activate` transition (`SCS-051`) |
> | **activated by** | the ERP actor who performed that transition | the same transition |
> | **connection last checked** | when the connection condition was last actually OBSERVED | the latest genuine connection observation |
>
> **a.** 🔴 **NONE OF THESE IS A PAGE-LOAD TIMESTAMP OR A RENDER-TIME GUESS.** ⚠ **"Last checked" must mean an observation actually happened; showing the current time because the page opened would be fabrication.**
> **b.** ✅ **`bound at` and `authorised at` are DIFFERENT.** **Reauthorising the same account renews the authorisation and does NOT re-bind** (`INV-16.6`), **so the bound date is stable across renewals — the pack shows a shop bound and authorised on the same date, which is the first-binding case.**
> **c.** 🔴 **WHERE A FACT IS UNKNOWN IT IS OMITTED, NEVER INVENTED** (`SYS-034`).
> **d.** ✅ **ALL FIVE ARE PERSISTED AND CAPTURED AT THE AUTHORITATIVE ACT** — implemented 2026-08-15 (`V11`, `GAP-133`). ⚠ **Superseded wording retained** (`DOC-009`): *"NONE IS PERSISTED TODAY"*.

> **`SCS-043` — ✅ CONNECTION PRESENTATION, ALL FOUR CONDITIONS PLUS UNREADABLE.**
>
> | Condition | What the page says | Action |
> |---|---|---|
> | **`CONNECTED`** | Trioloo can work against this account | Reauthorize |
> | **`NOT_CONNECTED`** | never authorised; Connect signs in to the account it represents and **the channel confirms which account was bound** | **Connect** |
> | **`REAUTH_REQUIRED`** | the channel no longer accepts the authorisation, so work will fail until renewed; 🔴 **the shop, its Listings and its binding are unchanged** | Reauthorize, as the SAME account |
> | **`ERROR`** | Trioloo cannot work against this account; the channel refused the last attempt | Reauthorize · **last checked** shown |
> | **UNREADABLE** *(not a durable state)* | 🔴 **the condition could not be read, so Trioloo does not claim one**; ✅ **everything else on the page is Trioloo's own record and is accurate** | **Try again** |
>
> **a.** 🔴 **UNREADABLE IS A PRESENTATION STATE, NOT A FIFTH CONNECTION STATE** (`API-068`). ⚠ **The shop still renders in full** (`API-069` — different owners).
> **b.** 🔴 **NO `TOKEN_EXPIRED`. NO PROVIDER ERROR CODE. NO OAUTH INTERNALS.**

> **`SCS-044` — ✅ THE THREE AUTHORISATION RESULTS, as approved.**
>
> | Result | What it says | Identity | Next |
> |---|---|---|---|
> | **Authorised** | names the bound account; ⚠ **and where the shop is still `DRAFT`, says Listings cannot target it yet and that activating is a SEPARATE decision not done for the operator** | bound on first success | **Activate** |
> | **Different account — rejected** | 🔴 **names BOTH accounts — the one signed in as, and the one this shop is bound to — and states nothing was rebound, so this shop's Listings and history stay attached to the account they were created under** | 🔴 **UNCHANGED** (`INV-16.6`) | ✅ **register the other account as its own shop** · retry as the correct account |
> | **Not completed** | the channel did not confirm an account, so nothing was bound and the shop is unchanged | 🔴 **UNCHANGED** | Connect |
>
> 🔴 **"CANCELLED" IS NOT A SEPARATE RESULT** — the pack folds an unfinished sign-in and a declined request into *not completed*, which is what the boundary can honestly distinguish.

> **`SCS-051` — ✅ `Activate` — THE ONLY LIFECYCLE ACTION IN THIS RELEASE.**
>
> **a.** ✅ **`DRAFT → ACTIVE`, authority `system.channel-instance.lifecycle`** (`PRM-090`).
> **b.** 🔴 **AUTHORISATION NEVER ACTIVATES.** ✅ **`DRAFT` + `CONNECTED` is the ordinary state the pack is built around and says so.**
> **c.** ✅ **AVAILABLE ONLY ONCE AN ACCOUNT IS BOUND.** ⚠ **Where it is not, `Activate` stays VISIBLE, greyed, with its reason beside it — *connect the account first; an active shop must have a verified account*.**
> **d.** ✅ **Activating makes the shop an ordinary target for new Listings and 🔴 leaves its connection unaffected.**
> **e.** ⚠ **Suspend, Reactivate and Archive remain unavailable in this release; the STATES stay canonical and displayable** (`SYS-108`, `SCS-080`).

---

# 6. Authority, boundaries and states

> **`SCS-050` — ✅ PERMISSIONS, and the pack's own demonstration of them.**
>
> | Authority | Grants |
> |---|---|
> | *(none)* | 🔴 no access to the destination |
> | **`system.channel-instance.view`** | `SC-W`, `SC-D`, read-only |
> | **`system.channel-instance.manage`** | `SC-F` — add and edit |
> | **`system.channel-instance.lifecycle`** | `Activate` |
> | **`integration.channel-connection.authorize`** | Connect / Reauthorize and its result |
>
> **a.** 🔴 **INDEPENDENT** (`PRM-090.a`). **The pack demonstrates an operator holding lifecycle but not authorize: Edit and Reauthorize are ABSENT ENTIRELY, and no reason text is offered — because there is nothing that operator can do about it here.**
> **b.** ✅ **UNAUTHORISED → OMITTED. AUTHORISED BUT BLOCKED BY STATE → VISIBLE, GREYED, REASON BESIDE IT.** ⚠ **The pack states the distinction in exactly those terms.**
> **c.** 🔴 **Frontend omission is presentation only; backend enforcement is mandatory and separate** (`PRM-004`, `UX-002`).

> **`SCS-052` — 🔴 NO SECRET ON ANY SURFACE.** **No App Secret, token, password or raw payload** (`API-070`). ✅ **The detail page states this to the operator in words.**

> **`SCS-053` — 🔴 FORBIDDEN HERE.** **Delete — no hard delete at any authority** (`INV-16.10`, `SYS-024`) · **Listing refresh, push and channel-wide sync — Product's, and the pack says so on the page** (`UX-273.b`) · **app-level provider configuration — Integration's** (`API-069`) · **invented business metrics.**

> **`SCS-060` — ✅ `View Listings` opens the Listings workspace filtered to THIS exact Channel Instance.** **The filter already exists server-side.** 🔴 **Product remains the owner; no synchronisation moves here.**

> **`SCS-061` — ✅ CROSS-DOMAIN SCOPE, PRESERVED WITHOUT UI.** **This instance is the account scope Listings uses today and Orders, Returns, Chat and Settlement will reference later** (`INV-16.12`, `DM-085`). 🔴 **No future-domain UI, count or placeholder — and never a zero.**

> **`SCS-091` — ✅ THE INTERNAL CODE IS ERP-ASSIGNED**, unique, stable and read-only (`INV-16.4`). 🔴 **Never typed; no code-edit workflow.** ⚠ **The pack renders it as `CHN-000114`; 🔴 no format is prescribed by this contract** (`INV-16.4`).

---

# 7. The Channel Type set

> **`SCS-092` — ✅ RESOLVED 2026-08-15: THE APPROVED SELECTOR IS CANONICALLY VALID.**
>
> **`E-015` is REFINED rather than contradicted** (`DOMAIN_MODEL` v3.35.0). **A Channel Type is the operational sales / integration channel KIND, which carries behaviour AND may identify a distinct adapter family** — **so `Website`, `Shopify` and `WooCommerce` are three valid Channel Types even though they behave alike, because their integration contracts differ** (`INV-15.5`).
>
> **a.** ✅ **THE ADD SHOP SELECTOR EXPOSES `Daraz · Website · Shopify · WooCommerce`, and all four are recognised canonical Channel Types.**
> **b.** ✅ **THE EXPOSED SUBSET NEED NOT EQUAL THE FULL SET** (`INV-15.4`). **The recognised set also holds Facebook, WhatsApp, Phone and Walk-in; the registry omits them because they carry no listings** (`PRD-028`).
> **c.** 🔴 **SELECTION ONLY. FREE TEXT REMAINS FORBIDDEN** (`INV-15.4`, `SCS-030.b`).
> **d.** ⚠ **MEMBERSHIP IMPLIES NO ADAPTER.** **Offering a type does not assert that an integration exists for it; adapter availability is a separate fact** (`API-068`, `GAP-133`).
> **e.** 🔴 **NO PROVIDER, PLATFORM, MARKETPLACE-ACCOUNT OR SELLER-ACCOUNT CONCEPT WAS CREATED** (`DM-084.a`). **`E-015` and `E-016` were sufficient.**
> **f.** ✅ **NOTHING WAS REMOVED FROM THE APPROVED DESIGN, AND THIS BLOCKS NOTHING.**

---

# 8. What v2.0.1 deferred and v3.0.0 requires

> **`SCS-080` — ✅ SUPERSEDED DEFERRALS.** **Each was deferred on the reasonable v2.0.1 judgement that a handful of accounts needs no tooling; the approved pack decides otherwise, and the design is the requirement.**
>
> | v2.0.1 | v3.0.0 |
> |---|---|
> | Summary strip omitted | ✅ **REQUIRED** — grouped by channel type (`SCS-020`) |
> | Attention semantics absent | ✅ **DEFINED** (`SCS-021`) |
> | Search deferred | ✅ **REQUIRED** — name, code, link (`SCS-022`) |
> | Four filters deferred | ✅ **REQUIRED** — channel, connection, status, with tokens and Clear (`SCS-023`) |
> | Result count absent | ✅ **REQUIRED** (`SCS-023.c`) |
> | External link absent | ✅ **REQUIRED** as a distinct remote fact (`SCS-041`) |
> | Audit timestamps absent | ✅ **REQUIRED** (`SCS-042`) |
> | Connection-unreadable as a bare rule | ✅ **A NAMED PAGE STATE with `Try again`** (`SCS-043`) |
>
> ⚠ **STILL DEFERRED AND UNCHANGED:** **visible pagination · per-row action menus · Suspend / Reactivate / Archive controls · Listing counts · per-field adapter capability · any future-domain figure.**

> **`SCS-081` — 🔴 THE APPROVED PACK IS THE VISUAL AUTHORITY.** **The earlier local exploration is discarded and must never be used as a design source.** ⚠ **The approved pack itself carries one stale sentence — a caption stating that no search, filter, pager or per-row menu exists — which the same frame contradicts by rendering search and three filters, and which its own preceding sentence overrides by noting they are present at the user's instruction.** ✅ **What is RENDERED governs; pagination and per-row menus remain genuinely absent.**

---

# 9. Version History

| Version | Date | Change |
|---|---|---|
| **3.2.0** | **2026-08-15** | ✅ **MARKET IS A CLOSED-SET SELECTION, not an operator's free text** (`SCS-030`, `SCS-030.b.i`). **`INV-16.7.a`–`INV-16.7.d` ratify the set** (`DOMAIN_MODEL` v3.36.0); **its current sole member is `BANGLADESH`, labelled *Bangladesh*, which is what the approved pack shows in Add Shop, in the Edit fixed state and on Shop Detail.** 🔴 **Free text is forbidden, an unrecognised value is REJECTED rather than normalised, and the options are server-supplied so the form cannot offer what the backend would refuse.** ✅ **Detail renders the canonical DISPLAY LABEL.** ⚠ **The mutability rule is UNCHANGED — selected at registration, changeable while unbound, FIXED once an account is bound.** 🔴 **This corrects an implementation that shipped Market as free text because no value set was ratified at the time; no other rule, surface, action or state changed.** |
| **3.1.1** | **2026-08-15** | ⚠ **IMPLEMENTATION STATE ONLY — NO RULE CHANGED.** ✅ **`SCS-042.d` updated: the five operational audit facts are now persisted and captured at the authoritative act** (`V11`, `GAP-133`); **the superseded wording is retained** (`DOC-009`). ✅ **`SCS-030.b`'s cross-reference corrected — it still called `SCS-092` an open conflict after v3.1.0 closed it.** 🔴 **No surface, fact, action, state, permission or boundary was altered.** |
| **3.1.0** | **2026-08-15** | ✅ **`SCS-092` RESOLVED — the last blocking decision is closed.** ✅ **`E-015` was REFINED rather than contradicted** (`DOMAIN_MODEL` v3.35.0): **a Channel Type is the channel KIND, carrying behaviour AND possibly identifying an adapter family, so `Website`, `Shopify` and `WooCommerce` are three valid types that behave alike but integrate differently** (`INV-15.5`). ✅ **The approved selector `Daraz · Website · Shopify · WooCommerce` is canonically valid; the exposed subset need not equal the recognised set** (`INV-15.4`). 🔴 **Free text remains forbidden, membership implies no adapter, and NO Provider, Platform, Marketplace-Account or Seller-Account concept was created** (`DM-084.a`). 🔴 **`INV-15.1` was SHARPENED, not weakened: Integration may route on Channel Type; domain code may not branch on it** (`INV-15.3`). ⚠ **No surface, fact, action or state changed — this closes a model question only.** |
| **3.0.0** | **2026-08-15** | ✅ **RECONCILED AGAINST THE USER-APPROVED FEATURE PACK, read frame by frame from `docs/design-reference/`.** ✅ **Summary strip grouped by channel type, attention semantics derived from the pack's own arithmetic, search over name/code/link, four filters with removable tokens and Clear, a result count, the external link as a SECOND remote fact distinct from account identity, and five operational audit facts — all RATIFIED, superseding v2.0.1's deferrals.** ✅ **Connection gains a named UNREADABLE page state with Try again; the three authorisation results keep their exact approved copy obligations.** 🔴 **THE THREE-SURFACE MODEL IS UNCHANGED — the pack adds components, not screens.** ⚠ **`SCS-092` REPORTS AN OPEN CONFLICT rather than resolving it: the approved selector offers Shopify and WooCommerce, which `E-015` does not list and `INV-15.1` strains, while the form and the adapter registry both treat Channel Type as the adapter key. Nothing is deleted from the design and no second concept is invented.** 🔴 **No secret, no future-domain figure, no per-row menu, no pagination. Persistence for the new facts does not exist and is registered as `GAP-133`.** |
| **2.0.1** | **2026-08-15** | `SCS-030` patched — Channel Type selected from a closed set. ⚠ **Superseded by v3.0.0.** |
| **2.0.0** | **2026-08-15** | Re-audit simplification to three surfaces. ⚠ **Superseded by v3.0.0.** |
| **1.1.0** / **1.0.0** | **2026-08-15** | Initial ratification and closure. ⚠ **Superseded.** |
