# Shops & Channels — Screen Contract

**Status:** Ratified · **Version:** 2.0.1 · **Ratified:** 2026-08-15 · **Amended:** 2026-08-15 (`SCS-030.b` — Channel Type is selected from the `E-015` set, never free text) · **Rule prefix:** `SCS-`

> 🔴 **v2.0.0 IS A DELIBERATE SIMPLIFICATION OF v1.1.0, NOT AN EXTENSION OF IT.** **A re-audit against stronger canon found that v1.1.0 specified 6 surfaces and 42 rules for a module whose entire purpose is to register an operating account and authorise it.** ⚠ **Superseded wording is not reproduced inline; v1.1.0 remains in version control and `§8` records exactly what was removed and why** (`DOC-009`).

---

## Document Control

**Inherits:** [`UI_UX_ARCHITECTURE.md`](UI_UX_ARCHITECTURE.md) (`UX-024`, `UX-273`).
**References:** [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) `E-015`, `E-016`, `INV-16.1`–`INV-16.13`, `DM-084`, `DM-085` · [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) `SYS-024`, `SYS-108`–`SYS-111` · [`API_ARCHITECTURE.md`](API_ARCHITECTURE.md) `API-068`–`API-071` · [`PERMISSION_ARCHITECTURE.md`](PERMISSION_ARCHITECTURE.md) `PRM-090` · [`GAP_ANALYSIS.md`](GAP_ANALYSIS.md) `GAP-132`.

> 🔴 **THIS DOCUMENT SPECIFIES BEHAVIOUR, NOT APPEARANCE.** **It states goals, surfaces, facts, actions, states, authority and boundaries.** 🔴 **IT PRESCRIBES NO LAYOUT, SPACING, COLUMN, CARD, BADGE, ICON OR TYPOGRAPHY DECISION** — those are Design's, within [`DESIGN_CONSTITUTION.md`](DESIGN_CONSTITUTION.md).

> 🔴 **IT CREATES NO BUSINESS RULE.** **Every obligation is traceable to already-ratified canon.**

---

# 1. Goal

> **`SCS-001` — ✅ THE ONE FLOW THIS MODULE EXISTS TO COMPLETE.**
>
> **From no shop, to one verified connected shop that Listings can target:**
>
> **register the account → authorise it against the marketplace → verify which remote account was bound → make it usable by Listings.**
>
> **a.** ✅ **EVERY REQUIREMENT BELOW EARNS ITS PLACE BY SERVING THAT FLOW**, or by an independent canonical rule that would otherwise be violated.
> **b.** 🔴 **THIS IS NOT AN ADMINISTRATION PLATFORM.** ⚠ **Shop management at scale — suspension, archival, bulk work, reporting — is Stage 13 and is deliberately absent** (`SCS-080`).
> **c.** ✅ **THE SAME `E-016` MUST REMAIN THE ACCOUNT SCOPE** for Listings today and for Orders, Returns, Chat and Settlement later (`DM-085`), **without those domains existing now.**

> **`SCS-002` — ✅ THE MENTAL MODEL THE SURFACE MUST TEACH.**
>
> **A Channel Type has one or more INDEPENDENT Channel Instances; one visible shop record is one exact `E-016`.**
>
> **a.** 🔴 **NO "PROVIDER" ENTITY IS PRESENTED** (`DM-084.a`). ✅ *Daraz* is the displayed **Channel Type**.
> **b.** 🔴 **NO SINGLETON ASSUMPTION.** **Several Daraz shops must work with no structural change, and no control may act on "Daraz" as a whole** (`API-071`).

---

# 2. Surfaces and routes

> **`SCS-010` — ✅ THREE SURFACES. NO MORE.**
>
> | ID | Surface | Type | Route | Why it must exist |
> |---|---|---|---|---|
> | **`SC-W`** | Shops workspace | Full page | `/administration/shops` — **frozen by `UX-024`** | The navigation destination; the only place all accounts are visible |
> | **`SC-F`** | Shop form — **add and edit** | **Modal** | *(no route)* | Three operator inputs. ⚠ **A full page for three fields is disproportionate to every full-page precedent in this ERP** |
> | **`SC-D`** | Shop detail | Full page | `/administration/shops/:id` | The **deterministic landing place after external authorisation**, where the bound account is verified and `Connect` / `Activate` live |
>
> **a.** 🔴 **ADD AND EDIT ARE ONE SURFACE.** ⚠ **They differ only in whether the record exists; the mutable field set is nearly identical** (`SCS-030`), **and two full pages for that was v1.1.0's clearest over-design.**
> **b.** ✅ **`SC-D` IS JUSTIFIED BY THE OAUTH RETURN, NOT BY CONVENTION.** **The browser leaves the ERP and comes back; it must return somewhere unambiguous that can state WHICH ACCOUNT WAS BOUND** (`INV-16.6`). ⚠ **Returning to a list and hunting for a row is where an operator misreads which shop they just authorised.**
> **c.** 🔴 **THE AUTHORISATION RESULT IS A STATE OF `SC-D`, NOT A SURFACE** (`SCS-042`). **The callback route is Integration-owned and is never a business page** (`API-069`).
> **d.** 🔴 **NO CONFIRMATION-DIALOG SURFACE EXISTS**, because the actions that would need one are deferred (`SCS-080`).

---

# 3. `SC-W` — Workspace

> **`SCS-020` — ✅ WHAT THE WORKSPACE MUST DO.**
>
> **Show every registered account · make each one individually identifiable · show where each stands on BOTH dimensions · open one · add one.**
>
> **Required facts per record:** **shop display name · Channel Type · configuration state · connection state · external account identity, or an explicit statement that none is bound yet.**
>
> **Actions:** **Add Shop** (`manage`) · **open the shop** (`view`).
>
> **a.** ⚠ **MARKET AND INTERNAL CODE ARE NOT REQUIRED HERE.** **Both are stored facts** (`INV-16.4`, `INV-16.7`) **and belong on `SC-D`; neither helps distinguish one shop from another in a list** (`SCS-021`).
> **b.** 🔴 **NO SEARCH, FILTER OR PAGINATION IS REQUIRED.** ⚠ **A business operating a handful of accounts does not need to filter them.** ✅ **The QUERY CONTRACT REMAINS SERVER-PAGEABLE** so nothing has to change when it grows (`TEC-096`); **only the controls are deferred** (`SCS-080`).
> **c.** 🔴 **NO PER-ROW ACTION MENU IS REQUIRED.** **Every act belongs to `SC-D`, which the operator reaches by opening the shop.**

> **`SCS-021` — 🔴 A RECORD IS NEVER REDUCIBLE TO ITS CHANNEL TYPE.**
>
> **The shop's own name is the primary identity.** ⚠ **Multiple Daraz instances are canonical** (`DM-059`, `INV-16.11`), **so a record reading only "Daraz" identifies nothing.** 🔴 **Channel Type must never read as the account's identity.**

> **`SCS-022` — 🔴 CONFIGURATION AND CONNECTION ARE TWO FACTS AND ARE NEVER MERGED INTO ONE STATUS.**
>
> 🔴 **`ACTIVE` IS NOT `CONNECTED`** (`SYS-108`, `API-068`, `UX-273.e`). ⚠ **A shop may be configured and unauthorised, or authorised and not yet in use.** ✅ **How they are distinguished is Design's; THAT they are distinguishable is not negotiable** (`UX-038`, `UX-271.b`).

---

# 4. `SC-F` — Shop form

> **`SCS-030` — ✅ THE FIELD CONTRACT.**
>
> | Fact | On add | On edit | Authority |
> |---|---|---|---|
> | **Shop display name** | ✅ **OPERATOR INPUT, required** | ✅ **editable** | `E-016` |
> | **Channel Type** | ✅ **OPERATOR INPUT, required — 🔴 CHOSEN FROM THE ERP-SUPPLIED CLOSED SET OF `E-015` TYPES. FREE TEXT IS FORBIDDEN** (`SCS-030.b`) | 🔴 **immutable once in operational use** | `E-015`, `INV-16.9` |
> | **Market** | ✅ **OPERATOR INPUT, required** | 🔴 **immutable once identity is bound** | `INV-16.7`, `INV-16.9` |
> | **Internal code** | 🔴 **SYSTEM GENERATED** | 🔴 **never editable** | `INV-16.4`, `SCS-091` |
> | **External account identity** | 🔴 **REMOTE DERIVED — never typed** | 🔴 **never editable** | `INV-16.5`, `INV-16.6` |
> | **Configuration state** | 🔴 **SYSTEM — `DRAFT`** (`SCS-031`) | 🔴 **not a form field** | `SYS-108` |
> | **Connection state** | 🔴 **SYSTEM — `NOT_CONNECTED`** | 🔴 **never editable** | `API-068` |
> | **Credentials, App Key, App Secret, tokens, passwords** | 🔴 **ABSENT FROM EVERY BUSINESS SURFACE** | 🔴 **ABSENT** | `API-070`, `SCS-051` |
>
> 🔴 **THREE OPERATOR INPUTS. THAT IS THE WHOLE FORM.** ⚠ **The operator is never asked to type the remote account identity: `INV-16.5` binds it from authority, and a typed value would be an unverified claim that `INV-16.6` would later have to test against itself.**
>
> **a.** 🔴 **THE OPERATOR IS NEVER ASKED TO TYPE THE REMOTE ACCOUNT IDENTITY** — as above.
> **b.** 🔴 **CHANNEL TYPE IS SELECTED, NEVER TYPED. Added 2026-08-15.** **The operator chooses ONE RECOGNISED ERP-SUPPLIED Channel Type from the canonical `E-015` set; arbitrary text is not accepted.**
>
> ⚠ **THE REASON IS CONCRETE, NOT TIDINESS.** **`channel_instance` persists `channel_type` as a plain string, and adapter resolution is performed BY THAT STRING** (`ChannelAdapterRegistry`, `API-071.a`). 🔴 **A mistyped or invented value creates a Channel Instance that can never resolve its intended adapter — so `Connect` can never succeed, and the failure surfaces nowhere near the typo that caused it.**
>
> ✅ **`E-015` ALREADY PROVIDES THE SET**; 🔴 **no Channel Type entity, table, persistence or migration is created by this rule**, and ⚠ **how the choice is presented is Design's.**

> **`SCS-031` — ✅ A NEW SHOP IS CREATED `DRAFT`, AND `SC-D` IS THE EXIT.**
>
> **a.** ✅ **`DRAFT` means configuration exists and is being prepared, and permits connection preparation** (`SYS-108`) — **exactly the condition of a shop just named and never authorised.**
> **b.** 🔴 **`ACTIVE` WOULD BE UNTRUE AND HAS A REAL CONSEQUENCE:** **the implementation already refuses a new Listing on a non-active channel**, so creating shops `ACTIVE` would open them as Listing targets before anyone verified the account.
> **c.** ✅ **Saving exits to `SC-D`**, where `Connect` lives.

---

# 5. `SC-D` — Shop detail

> **`SCS-040` — ✅ WHAT THE DETAIL MUST CARRY.**
>
> **Facts:** shop display name · Channel Type · Market · internal code · **external account identity or an explicit *not yet bound*** · configuration state · connection state.
>
> **Actions:** **`Connect` / `Reauthorize`** (`authorize`) · **`Activate`** (`lifecycle`, per `SCS-043`) · **`Edit`** (`manage`, opens `SC-F`) · **`View Listings`** (`SCS-060`).
>
> **a.** 🔴 **NO TOKEN, SECRET, PROVIDER PAYLOAD, ENDPOINT, SCOPE LIST OR ERROR CODE APPEARS HERE** (`API-070`, `API-062`).
> **b.** 🔴 **NO PLACEHOLDER FOR A DOMAIN THAT DOES NOT EXIST.** ⚠ **No Orders, Returns, Chat or Settlement section, tab or count — and never "0 Orders", because zero is a business claim and an absent module is not zero** (`UX-006`, `SCS-061`).
> **c.** ✅ **Adding such a projection later must not require changing shop identity or connection presentation** (`DM-085`). **No structure here prevents it.**

> **`SCS-041` — ✅ THE CONNECTION DISPLAY CONTRACT.**
>
> **The four canonical states are `NOT_CONNECTED`, `CONNECTED`, `REAUTH_REQUIRED` and `ERROR`** (`API-068`). 🔴 **THE UI INVENTS NO STATE AND MERGES NONE**, but its obligation is narrow:
>
> **a.** ✅ **STATE WHETHER THE SHOP CAN BE USED AGAINST ITS MARKETPLACE, AND IF NOT, WHAT THE OPERATOR DOES NEXT.** **`NOT_CONNECTED` → `Connect`. The other three unusable cases → `Reauthorize`, with the reason in plain words.**
> **b.** 🔴 **NO FIFTH STATE. `TOKEN_EXPIRED` IS NOT INTRODUCED** — a token problem needing operator action is `REAUTH_REQUIRED`.
> **c.** 🔴 **`AUTHORIZING` IS NEVER PERSISTED** (`API-068.b`). ✅ **A transient in-page state while the operator is away is permitted; closing the browser leaves the shop in whatever state it genuinely held.** ⚠ **No fabricated progress: an external authorisation reports none.**
> **d.** 🔴 **A CONNECTION READ FAILURE MUST NOT REMOVE THE SHOP.** **The `E-016` record is System's and the connection is Integration's projection** (`API-069`); **the shop renders, and the connection alone reports that it could not be read.**
> **e.** 🔴 **PER-FIELD ADAPTER CAPABILITY IS NOT SHOWN.** **The `PRD-125` matrix is out of scope here** (`SCS-080`).

> **`SCS-042` — ✅ THE AUTHORISATION RESULT — THREE OUTCOMES, AS A STATE OF `SC-D`.**
>
> | Outcome | What it must say | Identity | Next |
> |---|---|---|---|
> | **Authorised** | The account is authorised, **naming the bound external account** | ✅ Bound on first success; unchanged on re-authorisation | `Activate` where `SCS-043` allows |
> | **Rejected — different account** | 🔴 **The authorised account is not this shop's account. Nothing was rebound.** | 🔴 **UNCHANGED** (`INV-16.6`) | ⚠ **Register a separate shop for the other account** |
> | **Not completed** | The attempt did not succeed, in plain words | 🔴 **UNCHANGED** | Retry |
>
> **a.** 🔴 **IDENTITY MISMATCH NEVER REBINDS.** ⚠ **Silently rebinding would reattribute every Listing and every future order of that shop to a different seller** (`INV-16.1`, `BR-002`).
> **b.** 🔴 **"CANCELLED BY THE OPERATOR" IS NOT A SEPARATE OUTCOME.** ⚠ **Nothing in the current Integration boundary can reliably distinguish an abandoned authorisation from a failed one, and a state the system cannot determine must not be displayed as fact** (`SYS-034`).
> **c.** 🔴 **NO PROVIDER ERROR CODE IS SHOWN OR INVENTED.**

> **`SCS-043` — ✅ `Activate` — THE ONE LIFECYCLE ACTION IN THIS RELEASE.**
>
> **a.** ✅ **`DRAFT → ACTIVE`, authority `system.channel-instance.lifecycle`.** 🔴 **No new permission code exists** (`PRM-090`).
> **b.** 🔴 **AUTHORISATION NEVER ACTIVATES.** **A successful `Connect` changes the connection and never the configuration.** ✅ **`DRAFT` + `CONNECTED` is a valid ordinary state** — **authenticating with a marketplace is a technical fact; approving a shop for business use is a person's decision, and that person may not be the one who authorised it.**
> **c.** ✅ **EXECUTABLE ONLY ONCE AN EXTERNAL ACCOUNT IDENTITY IS BOUND** (`INV-16.5`). ⚠ **`ACTIVE` means available as an operational target, and a shop with no verified account would be a target for work that cannot be attributed** (`INV-16.1`).
> **d.** 🔴 **`ACTIVE` IS NEVER INFERRED FROM CONNECTION STATE**, and `CONNECTED` is not made a universal prerequisite for all Channel Types.
> **e.** ⚠ **NO CONFIRMATION DIALOG.** **It grants availability rather than removing it.**

---

# 6. Authority, safety and boundaries

> **`SCS-050` — ✅ PERMISSION REQUIREMENTS.**
>
> | Authority | Grants |
> |---|---|
> | *(none)* | 🔴 **No access to the destination** |
> | **`system.channel-instance.view`** | `SC-W` and `SC-D`, read-only |
> | **`system.channel-instance.manage`** | `SC-F` — add and edit |
> | **`system.channel-instance.lifecycle`** | `Activate` |
> | **`integration.channel-connection.authorize`** | `Connect` / `Reauthorize` and its result |
>
> **a.** 🔴 **INDEPENDENT** (`PRM-090.a`). **Manage never implies lifecycle; neither implies authorize.**
> **b.** 🔴 **UNAUTHORISED → THE ACTION IS OMITTED. AUTHORISED BUT BLOCKED BY STATE → VISIBLE, UNAVAILABLE, WITH A REACHABLE REASON.** ⚠ **A disabled control still advertises authority the operator does not have.**
> **c.** ⚠ **NO DESIGN FRAME IS REQUIRED PER ROLE COMBINATION.** **The rule is stated once and applies everywhere** (`SCS-090`).
> **d.** 🔴 **FRONTEND OMISSION IS PRESENTATION ONLY; BACKEND ENFORCEMENT IS MANDATORY AND SEPARATE** (`PRM-004`, `UX-002`).

> **`SCS-051` — 🔴 NO SECRET APPEARS ON ANY SURFACE IN THIS CONTRACT.**
>
> **No App Secret, access token, refresh token, marketplace password or raw authorisation payload** (`API-070`). ⚠ **Nor a credentials reference rendered so as to leak implementation detail** (`INV-16.8`). ✅ **The connection state and the external account identity are safe, non-secret business facts.**

> **`SCS-052` — 🔴 FORBIDDEN ON EVERY SURFACE HERE.**
>
> **Delete** — no hard delete exists at any authority (`INV-16.10`, `SYS-024`) · **Listing Refresh, Push and channel-wide Sync** — Product's, and they do not move (`UX-273.b`) · **App-level provider configuration** — Integration's (`API-069`) · **invented business metrics** — no revenue, order, return, message or settlement figures.

> **`SCS-060` — ✅ THE LISTINGS RELATIONSHIP.**
>
> ✅ **`SC-D` OFFERS `View Listings`, navigating to the Listings workspace filtered to this exact Channel Instance.** **The filter already exists server-side, so this is navigation and not new capability.**
>
> **a.** 🔴 **NO LISTING COUNT IS REQUIRED** anywhere (`SCS-080`).
> **b.** 🔴 **PRODUCT REMAINS THE OWNER.** **No synchronisation moves here** (`SCS-052`).
> **c.** ✅ **One Listing belongs to exactly one Channel Instance** (`INV-16.3`); **shop identity is part of Listing identity and is not changed from here.**

> **`SCS-061` — ✅ THE CROSS-DOMAIN RULE, PRESERVED WITHOUT UI.**
>
> **This Channel Instance is the account scope Listings uses today and Orders, Returns, Chat and Settlement will reference later** (`INV-16.12`, `DM-085`). 🔴 **NO FUTURE-DOMAIN UI, TAB, COUNT OR PLACEHOLDER EXISTS NOW.** ✅ **Only `ACTIVE` instances become ordinary new operational targets; `CONNECTED` alone never grants business eligibility** (`SCS-043`).

> **`SCS-070` — ✅ STATES EVERY SURFACE OWES.**
>
> **Empty workspace** — explain that a record is one external operating shop or account; offer **Add Shop** under `manage`. 🔴 **Not presented as integration setup, and no App Key or Secret appears** · **Loading** — the shared treatment, no fabricated rows · **Retrieval failure** — stated plainly, retryable · **Shop not found** — stated plainly, never rendered as an empty shop · **Connection unreadable** — 🔴 **the shop still renders in full** (`SCS-041.d`).

> **`SCS-091` — ✅ THE INTERNAL CODE IS SYSTEM GENERATED.**
>
> **Assigned by the ERP at creation, unique and stable, read-only in ordinary business UI** (`INV-16.4`). 🔴 **The operator never types it and no code-edit workflow exists.** 🔴 **No generation algorithm, format or prefix is prescribed.**
>
> ⚠ **IT IS A `SC-D` FACT, NOT A LIST COLUMN** (`SCS-020.a`). **It is an internal identifier; letting a persistence column dictate visual prominence is how implementation leaks into business UI.**

---

# 7. Design frame plan

> **`SCS-090` — ✅ MINIMUM COVERAGE, GROUPED BY SURFACE. NAMES AND TYPES ONLY.**
>
> | Frame | Covers | Type |
> |---|---|---|
> | **01** | Workspace — populated with several accounts across both dimensions, **and** the empty / loading / failure states | Full page + states |
> | **02** | Shop form — add and edit, including the immutable fields | Modal |
> | **03** | Shop detail — the connection states, `Activate` available and unavailable-with-reason, and the three authorisation results | Full page + states |
>
> 🔴 **THREE FRAMES.** ⚠ **A frame per state is a frame per sentence; state variants belong to their surface.**

---

# 8. What v1.1.0 required and v2.0.0 does not

> **`SCS-080` — ✅ THE DEFERRAL REGISTER. Each entry is deferred, not forbidden.**
>
> | Removed from the contract | Why it was not needed for `SCS-001` |
> |---|---|
> | **Add and Edit as two full pages** | Three operator inputs. One modal serves both |
> | **A confirmation-dialog surface** | Its only users were `Suspend` and `Archive`, both deferred |
> | **`Suspend` · `Reactivate` · `Archive` actions** | Shop management at scale. ✅ **The STATES remain canonical** (`SYS-108`) **and must be displayed if present; only the operator CONTROLS are deferred** |
> | **The configuration × connection action matrix** | A matrix of actions that no longer all exist |
> | **Archived-record presentation rules** | Nothing can archive a shop in this release |
> | **Search and four filters** | A handful of accounts. ✅ **The query contract stays server-pageable** |
> | **Visible pagination** | Same. ⚠ **Backend scalability and a visible pager are different obligations** |
> | **Per-row action menu** | Every action lives on `SC-D` |
> | **Market and internal code as list columns** | Stored facts that do not distinguish one shop from another |
> | **Listing count** | A per-row count is a per-row query, and it serves no step of `SCS-001` |
> | **"Cancelled by the operator" result** | The Integration boundary cannot reliably report it (`SCS-042.b`) |
> | **Separate reauth-success result** | Indistinguishable to the operator from any other successful authorisation |
> | **Per-state connection tables and a transient-session rule block** | Collapsed into `SCS-041` |
> | **A PageHeader anatomy table** | Titles, context lines and action placement are Design's (`§23`) |
> | **Nine design frames** | Three |
>
> ⚠ **NOTHING CANONICAL WAS WEAKENED.** **Every `INV-16.*`, `SYS-108`–`SYS-111`, `API-068`–`API-071` and `PRM-090` obligation still has a home in this document** (`SCS-081`).

> **`SCS-081` — 🔴 THE LOCAL DESIGN EXPERIMENT IS NOT AUTHORITY.**
>
> **The Shops & Channels design pack and screenshots produced in the local scratchpad are DISCARDED EXPLORATION.** 🔴 **They are NOT approved, NOT visual authority and NOT an implementation reference**, and **must never be used as a design source.** ⚠ **They preceded this audit and encode requirements this version removes.**

---

# 9. Version History

| Version | Date | Change |
|---|---|---|
| **2.0.1** | **2026-08-15** | ✅ **`SCS-030` PATCHED — the single finding of the fresh post-cleanup audit, which matched v2.0.0 on every other blocking decision.** 🔴 **Channel Type is OPERATOR INPUT, REQUIRED and CHOSEN FROM THE ERP-SUPPLIED CLOSED SET OF `E-015` TYPES; FREE TEXT IS FORBIDDEN** (`SCS-030.b`). ⚠ **The reason is concrete: `channel_instance` persists `channel_type` as a plain string and adapter resolution is performed by that string, so a mistyped value yields a Channel Instance that can never resolve its adapter — `Connect` could never succeed and the failure would surface nowhere near its cause.** ✅ **`E-015` already supplies the set.** 🔴 **No Channel Type entity, table, persistence or migration is created; no canon document is amended; presentation remains Design's.** 🔴 **NOTHING ELSE CHANGED — still 3 production surfaces, 3 design frames, and every other v2.0.0 decision stands.** |
| **2.0.0** | **2026-08-15** | 🔴 **SIMPLIFICATION AFTER RE-AUDIT. 6 surfaces → 3; 42 rules → 21.** ✅ **Add and Edit collapsed into ONE MODAL — a full page for three inputs was disproportionate to every full-page precedent in this ERP.** ✅ **`SC-D` RETAINED, justified by the OAuth return needing a deterministic landing place that can state which account was bound, not by convention.** ✅ **`Suspend`, `Reactivate` and `Archive` CONTROLS DEFERRED — the states remain canonical and displayable; only the operator actions go. `Activate` retained, because it is the gate between registered and usable by Listings.** ✅ **Authorisation results 5 → 3: "cancelled" removed because the Integration boundary cannot reliably report it, and reauth-success is indistinguishable from success.** ✅ **Search, four filters, visible pagination, per-row menus, Listing count, Market and internal code as list columns, archived-record rules and the PageHeader anatomy table all deferred or handed to Design.** ✅ **Design frames 9 → 3.** 🔴 **NO CANONICAL OBLIGATION WEAKENED; `SCS-080` records every removal with its reason and `SCS-081` marks the local design experiment as discarded, non-authoritative exploration.** 🔴 **No business rule, entity, permission, endpoint, migration or visual decision created.** |
| **1.1.0** | **2026-08-15** | Final closure of v1.0.0 — the internal code resolved as system generated and `Activate` introduced, under v1.1.0's own `SCS-091` and `SCS-092`. ⚠ **Superseded in full by v2.0.0** (`DOC-009`): **the internal-code rule survives as `SCS-091`; `Activate` is now `SCS-043`, and `SCS-092` is not a live rule in this version.** |
| **1.0.0** | **2026-08-15** | Initial ratification — six surfaces, four routes, the configuration × connection matrix. ⚠ **Superseded by v2.0.0.** |
