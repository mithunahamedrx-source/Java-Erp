# Project Constitution — Implementation Governance

**Owner:** Trioloo Technology · **Module:** Cross-cutting · **Status:** Canonical
**Version:** 1.0.0 · **Ratified:** 2026-08-10 · **Rule prefix:** `PRJ-`

---

## Document Control

**Answers one question:** *what rules must every developer and AI coding agent obey when implementing this ERP?*

**References** (never restates — `DOC-006`): `MASTER_DOCUMENTATION_INDEX.md` · `TECHNOLOGY_ARCHITECTURE.md` v1.1.0 · `DESIGN_CONSTITUTION.md` v2.1.1 · `DATABASE_ARCHITECTURE.md` · `SYSTEM_ARCHITECTURE.md` · every owning module architecture.

---

# 1. Ownership and Precedence

> **PRJ-001 — This document owns IMPLEMENTATION-WIDE ENGINEERING DISCIPLINE and nothing else.**

**It does NOT own** business truth · domain behaviour · entity ownership · permissions and business authority · design language · documentation governance · technology selection. **Each stays with its canonical owner** (`DOC-005`).

> **PRJ-002 — Authority precedence.**

| Question | Owner |
|---|---|
| **Business / domain** | **The owning architecture document** |
| **Technology** | **`TECHNOLOGY_ARCHITECTURE.md`** |
| **Visual / design** | **`DESIGN_CONSTITUTION.md`** |
| **Engineering implementation discipline** | **This document** |
| **Documentation, version, index governance** | **`DOC-` rules · `MASTER_DOCUMENTATION_INDEX.md`** |

> **PRJ-003 — 🔴 Where implementation convenience conflicts with canonical architecture, CANONICAL ARCHITECTURE WINS.**
>
> ⚠ **Code must never become a competing source of business truth.** **A behaviour that exists only in code and contradicts a ratified rule is a defect in the code, not an amendment to the rule.**

> **PRJ-004 — This document references canonical rules; it does not restate them.** ⚠ **A restated rule drifts.** **When this document needs a business fact, it cites the rule ID.**

---

# 2. Bounded-Task Discipline

> **PRJ-010 — Every implementation task is bounded to its stated scope.**

**A developer or agent must NOT** refactor unrelated modules · rename unrelated concepts · redesign architecture incidentally · change another module's schema without need · add unrelated dependencies · *"clean up"* canonical behaviour while implementing something else.

> **PRJ-011 — A deterministic defect discovered outside task scope is REPORTED, not fixed in passing** (`PRJ-260`).
>
> ⚠ **Silent scope expansion is the most common way an architecture erodes.** **Two correct changes in one commit are still one unreviewable change.**

---

# 3. Modular Monolith — Boundaries and Dependency Direction

> **PRJ-020 — Module boundaries are enforced in code, not by convention** (`TEC-002`, `SYS-006`).

**Prohibited across module boundaries:** direct manipulation of another module's persistence internals · repository reach-through · entity mutation · entity graphs crossing ownership · shared JPA relationships between modules.

**Required:** explicit application/module contracts — a published interface and a DTO, never an entity.

> **PRJ-021 — Dependency direction is inward. `api → application → domain`, with `infrastructure` depending inward and nothing depending on `infrastructure`.**
>
> **`domain` depends on nothing.** ⚠ **A domain class importing a Spring, Jakarta Persistence or Jackson type is a boundary violation.**

> **PRJ-022 — Cross-module calls are synchronous, in-process, explicit requests where the architecture requires them** (`SYS-006`, `TEC-042`).
>
> ✅ **Events only where `EVENT_ARCHITECTURE.md` defines them.** 🔴 **No event may be invented to reduce coupling** — the corpus holds **102 events and eight proven negatives**, and `EVA-034` records a case where an event would be **actively wrong**.

> **PRJ-023 — Do not create microservice-style boundaries inside one JVM** — no in-process message bus, no service-to-service HTTP, no per-module database.

> **PRJ-024 — Prefer compile-time-visible boundaries** (Java modules, package-private surfaces, build-enforced dependency rules) **over documentation and good intentions.**

---

# 4. Backend Layering

> **PRJ-030 — Four layers per module, with fixed responsibilities.**

| Layer | Owns | Never |
|---|---|---|
| **`domain`** | Business concepts, invariants, value objects, domain services | ⚠ **Framework persistence concerns, transactions, HTTP** |
| **`application`** | Use cases, orchestration, **transaction boundaries**, authorization invocation | Transport concerns, SQL |
| **`infrastructure`** | Persistence adapters, external adapters, framework integration | Business decisions |
| **`api`** | REST controllers, request/response DTOs, transport validation | 🔴 **Business logic** |

> **PRJ-031 — 🔴 No controller becomes the business-service layer. No repository contains business orchestration.**
>
> ⚠ **The two failure modes are symmetrical and both destroy the layering:** a controller that decides, and a repository that orchestrates.

---

# 5. Money and Decimal

> **PRJ-040 — 🔴 Authoritative money NEVER uses `float`, `double`, `Float` or `Double`** — Java `BigDecimal`, PostgreSQL `NUMERIC`/`DECIMAL` (`TEC-010`, `DB-037`). **This includes DTOs, projections, test fixtures and mappers.**

> **PRJ-041 — The canonical BDT monetary policy is owned by `DB-079` and applied, never reinterpreted** — 2dp `HALF_UP` · line rounded **before** aggregation · totals from already-rounded lines · intermediate rates, weighted-average costs and percentages at **higher precision**.

> **PRJ-042 — 🔴 Do not round a high-precision rate prematurely** (`TEC-012`, `ICO-037`). **The unit cost is a RATE, not a monetary line.**
>
> **high-precision rate × quantity → exact calculation → monetary line → 2dp `HALF_UP` → total from rounded lines.**

> **PRJ-043 — Numeric equality uses `compareTo`, never `equals`** (`TEC-014`). ⚠ **`BigDecimal.equals` compares scale: `2.50` and `2.5` are unequal** — a silent defect in exact-sum reconciliation (`HRP-045`, `INV-99.1`).

> **PRJ-044 — Division specifies scale and `RoundingMode` explicitly** (`TEC-013`). ⚠ **`BigDecimal.divide` without them throws on non-terminating decimals** — `Monthly ÷ 30 ÷ scheduled hours` is exactly that case.

> **PRJ-045 — 🔴 No JavaScript `Number` is ever authoritative for money** (`TEC-015`, `TEC-095`). **Money crosses REST as a string; the client renders it and performs no arithmetic on it.**

---

# 6. Derived Positions

> **PRJ-050 — 🔴 Never introduce a mutable stored balance for a position the architecture defines as derived** (`DB-001`, `ACC-001`, `TEC-025`).
>
> **Includes** Employee Loan outstanding (`ACC-088`) · Advance Requisition outstanding (`ACC-069`) · Outstanding Salary Payable (`ACC-093`) · Final Settlement Position (`INV-100.1`) · any employee aggregate debt (`INV-99.1`).
>
> ⚠ **"The query is slow" is not a justification.** **It is the exact reasoning `DB-001` exists to refuse.**

> **PRJ-051 — A read model or projection may optimise querying ONLY if it does not become a competing authoritative position, is explicitly derived, and is rebuildable from the movement history.**
>
> 🔴 **Any such optimisation requires explicit approval and an amendment.** **It is never introduced inside an unrelated feature task.**

---

# 7. Immutability and Correction

> **PRJ-060 — 🔴 A record the owning architecture declares immutable is never corrected by `UPDATE`.**
>
> **Prohibited:** `UPDATE historical_record SET value = new_value`. **Corrections are new linked records** (`DB-002`, `TEC-022`).

> **PRJ-061 — Do not make every entity immutable blindly.** **The owning architecture determines the boundary.**

| Mutable | Immutable |
|---|---|
| Drafts · configuration before effect · unfinalised runs · in-progress records | Finalised payroll (`INV-93.1`) · finalised settlement (`INV-100.5`) · posted transactions (`DB-002`) · attendance sessions (`INV-91.3`) · tracking history (`BR-031`) · **authorised pending decisions** (`INV-95.3`) |

> **PRJ-062 — Effective-dated facts are rows, never overwritten columns** (`TEC-023`, `SYS-021`).
>
> ✅ **`HRP-005` is the case that proves why: salary history is the ONLY mechanism by which a historical payroll run can be recomputed correctly.**

---

# 8. JPA / Hibernate Discipline

> **PRJ-070 — JPA is used deliberately, not by default.**

**Prohibited:** public API returning JPA entities (`TEC-080`) · uncontrolled bidirectional relationships · `EAGER`-by-default graph design · **Open Session in View used to hide query-design problems** · `CascadeType.ALL` applied indiscriminately · entity graphs crossing module ownership · **relying on dirty checking for immutable historical facts**.

**Required:** explicit repositories · query projections · DTO queries where appropriate · deliberate fetch strategy · **database-level constraints for deterministic invariants**.

> **PRJ-071 — Immutable historical entities are technically protected**, not merely documented — no setters, complete construction, `@Immutable` where supported (`TEC-022`).

---

# 9. Database Change Discipline

> **PRJ-080 — Flyway owns schema evolution** (`TEC-020`). 🔴 **Hibernate schema auto-update against any environment holding real data is prohibited** — `ddl-auto` is `validate` or `none`.

> **PRJ-081 — Every schema change is a migration. An already-applied production migration is NEVER modified** — corrections are new migrations.

> **PRJ-082 — Migrations preserve historical data semantics** (`TEC-021`). ⚠ **A migration that rewrites historical rows to fit a new shape violates immutability as surely as an application `UPDATE`.** **Backfill by adding.**

> **PRJ-083 — Destructive migrations are not written casually.** **Dropping a column that holds historical business meaning requires the same scrutiny as deleting the records** (`SYS-024` — archived, never deleted).

---

# 10. Transactions

> **PRJ-090 — The application layer owns business transaction boundaries. Repository methods do not define them.**

> **PRJ-091 — 🔴 Canonical atomicity is preserved exactly** — **Final Settlement finalisation** (`HRP-075`, `TEC-040`) · **inventory reservation and build** (`INV-27.4`, `INV-65.2`) · every other ratified atomic operation.
>
> 🔴 **Synchronous atomic correctness is NEVER replaced by eventual consistency.** **`EVA-034` is explicit: at-least-once asynchronous delivery cannot implement the settlement commit.**

> **PRJ-092 — Do not hold a database transaction across a long third-party HTTP call** unless the architecture explicitly requires it. ⚠ **Integration latency must not become lock duration.**

---

# 11. Concurrency

> **PRJ-100 — The mechanism may vary; the invariant may not** (`TEC-043`).

**Invariants the implementation must preserve:** finalise-once for payroll (`INV-93.1`) and settlement (`HRP-075`) · no double recovery · no over-write-off (`INV-99.4`) · `0 ≤ Applied ≤ Authorised ≤ Outstanding` under concurrency (`INV-101.1`) · `Σ Authorised ≤ Available` against a consistent snapshot (`INV-101.3`) · loan recovery within remaining balance (`HRP-049`) · atomic inventory reservation · **one-way `API_MANAGED` → `ERP_MANAGED`** (`BR-175`) · **business identifier non-reuse** (`DB-012`).

> **PRJ-101 — 🔴 Generic last-write-wins is prohibited for authoritative business conflicts** (`BR-170`, `TEC-064`).

---

# 12. Integration

> **PRJ-110 — External integrations are assumed retryable, duplicative and out-of-order** (`SYS-045`, `API-024`).

**Required:** idempotency · deterministic external identity where available (`API-026`) · **external identifiers preserved exactly as received** (`DB-046`) · duplicates absorbed and recorded without reapplying business effects (`API-025`) · out-of-sequence evidence retained as an exception (`API-028`).

> **PRJ-111 — 🔴 Timestamp-newest-wins is forbidden where `BR-170` forbids it. The authority STATE decides operational ownership.**
>
> 🔴 **A manual ERP takeover is never undone by later stale marketplace sync** (`BR-172`). ⚠ **This is the defect the authority model exists to prevent; an implementer who "helpfully" applies the newest payload has caused it.**

---

# 13. Security

> **PRJ-120 — Backend authorization is authoritative. Frontend hiding is an affordance, never a control** (`TEC-070`, `PRM-004`).

> **PRJ-121 — 🔴 No `if (isAdmin) bypassEverything()` branch exists** (`PRM-068`, `AGV-033`). **Administrator is a role holding permissions, never a mode that suspends checking.**

> **PRJ-122 — Owner is not an ordinary role and is never assignable through role management** (`AGV-037`, `AGV-039`).

> **PRJ-123 — Every entry point enforces authorization** — REST, batch, internal application call, integration, automated process (`SYS-035`, `API-007`). **Scope is enforced on read AND write** (`SYS-020`).

> **PRJ-124 — 🔴 Actor identity is NEVER trusted from the client.** **It comes from the authenticated security context or a named system identity** (`PRM-005`, `AGV-008`).

> **PRJ-125 — `PRM-006`'s self-approval discipline has exactly four named exceptions** (`PRM-071`, `PRM-073`, `PRM-077`). **No fifth is created in code.**

---

# 14. Attribution

> **PRJ-130 — 🔴 First-class business attribution is captured at WRITE TIME and is never reconstructed from logs.**
>
> **`INV-77.1` states attribution "cannot be retrofitted."** ⚠ **`Confirmed By` · `Approved By` · `Finalised By` · authority-takeover actor · decision actor are BUSINESS FIELDS, not log entries.**
>
> 🔴 **`BR-164` forbids deriving `Confirmed By` from `Assigned Agent`, current owner, `Last Updated By` or audit parsing.**

> **PRJ-131 — Audit logs and first-class business attribution are separate concerns** and are never substituted for one another.

> **PRJ-132 — Every authoritative write requiring an actor receives it through one standard mechanism**, not per-feature improvisation.

---

# 15. Time and Date

> **PRJ-140 — Canonical business timezone is `Asia/Dhaka`** (`TEC-050`).

| Fact | Type |
|---|---|
| Date-only business fact | **`LocalDate`** |
| Local schedule time | **`LocalTime`** |
| Payroll period | **`YearMonth`** where applicable |
| Actual event timestamp | **`Instant`** |

> **PRJ-141 — 🔴 Dates are never stored as strings, and a `LocalDate` is never widened into a fake midnight timestamp** (`TEC-052`). ⚠ **A UTC-truncated timestamp near midnight lands attendance, orders and payroll on the wrong day.**

> **PRJ-142 — External source timestamps are preserved where canonical integration rules require both event time and record time** (`BR-030`, `TEC-053`).

---

# 16. REST API

> **PRJ-150 — JPA entities are never exposed. DTOs always** (`TEC-080`).

> **PRJ-151 — Consistent implementation rules exist for** validation · error response shape · pagination · filtering · sorting · enum serialization · **money serialization as string** (`TEC-015`) · timestamp serialization · conflict/optimistic responses · idempotent requests where required.
>
> ⚠ **These are engineering deliverables** (`API-001`, `TEC-081`) — **defined once, applied everywhere, not per controller.**

> **PRJ-152 — 🔴 No business logic in controllers** (`PRJ-031`). **No GraphQL** — the transport is REST/JSON (`TEC-090`).

> **PRJ-153 — `absent` stays distinguishable from zero, empty and false across the wire** (`DB-005`, `SYS-034`, `TEC-084`). ⚠ **A null coalesced to `0` in a DTO destroys `SYS-034`.**

---

# 17. Frontend Engineering

> **PRJ-160 — React + TypeScript + Vite. `DESIGN_CONSTITUTION.md` remains the visual authority** (`TEC-090`, `TEC-091`).

**Prohibited:** Material UI · Ant Design · Bootstrap · replacing Manrope · approximating the canonical OKLCH tokens · **a second competing design-token system** · letting component-library defaults override canonical spacing, radius or type.

> **PRJ-161 — Structured operational rows obey the locked layout-stability rules** (`DESIGN_CONSTITUTION.md` Article VII) — **no structural wrapping under zoom or width pressure** (`RULE 7.4`) · no global `flex-wrap: wrap` (`RULE 7.5.a`) · no global `white-space: nowrap` (`RULE 7.7`) · zoom never suppressed (`RULE 7.9`).

> **PRJ-162 — 🔴 Viewport resize or zoom must NEVER change page size, record count, fields, actions, sorting, filtering or API behaviour** (`RULE 7.3.a`). ⚠ **Several data-grid components ship this behaviour by default; it is a rule violation here.**

---

# 18. Frontend State Boundary

> **PRJ-170 — The server owns authoritative state; the client owns interaction state.**

| Server owns | Client owns |
|---|---|
| Authoritative business state · permissions · **financial calculations** · lifecycle correctness · **derived positions** | Transient interaction state · open/closed UI state · local form drafts · presentation state |

> **PRJ-171 — 🔴 Client state never becomes a second business database.**

---

# 19. Dependencies

> **PRJ-180 — Every dependency needs a stated reason.** **Commonness is not a reason.**

**No automatic adoption of** Lombok · MapStruct · Redis · Kafka · RabbitMQ · Elasticsearch/OpenSearch · Kubernetes · large UI frameworks (`TEC-003`).

> **PRJ-181 — A dependency proposal states:** the problem solved · why the standard platform or existing library is insufficient · operational cost · replacement and removal implications.

---

# 20. Performance

> **PRJ-190 — Hard defaults:** server-side pagination · bounded queries · **no N+1** · no unbounded loading · no huge entity graphs · **no whole-table browser fetches** · indexed high-value lookup paths · **explicit aggregate queries for derived positions** · profiling before caching infrastructure.

> **PRJ-191 — 🔴 Do not denormalise a canonical financial position to make a query faster** (`PRJ-050`). **Do not add Redis or a search engine before evidence demonstrates need** (`TEC-003`).
>
> ⚠ **`TEC-027` records this as a permanent characteristic, not a defect to optimise away**: retention is unbounded and positions are derived, so position queries scan growing histories. **Indexing and partitioning are the permitted instruments.**

---

# 21. Error Handling

> **PRJ-200 — Errors are user-safe outward and structured inward.** No stack traces to end users · actionable validation messages · entered form data preserved where appropriate · correlation/request identity on every error.

> **PRJ-201 — 🔴 Exceptions are never swallowed, and execution never continues past a failed atomic operation** (`PRJ-091`). ⚠ **A partially applied settlement marked complete is the exact outcome `HRP-075` forbids.**

> **PRJ-202 — Refusal is a normal outcome, not an error** (`SYS-032`, `TEC-083`).

---

# 22. Logging and Observability

> **PRJ-210 — Operational logs are NOT audit or business records** (`PRJ-131`).

**Required:** structured logging · request/correlation IDs · useful operation context · server-side exception logging · health and diagnostic capability.
**Prohibited:** secrets in logs · **unnecessary payroll, salary or customer personal data** (`PRM-011`, `PRM-083`).

> **PRJ-211 — No vendor-specific observability platform is mandated** (`TEC-113`).

---

# 23. Testing

> **PRJ-220 — Testing is mandatory in proportion to change risk.**

**Backend baseline:** JUnit 5 · Spring Boot Test · **Testcontainers where real database or transaction behaviour matters.**

> **PRJ-221 — 🔴 These behaviours require strong tests and are not shipped on inspection alone:**
>
> **Monetary precision and rounding** (`DB-079`) · **derived positions** (`PRJ-050`) · **transaction atomicity** (`HRP-075`) · **immutable corrections** (`PRJ-060`) · **permissions and scope** (`PRJ-120`–`PRJ-125`) · **integration idempotency** (`PRJ-110`) · **`API_MANAGED` → `ERP_MANAGED`** (`BR-168`–`BR-176`) · **payroll and final settlement** · **invoice numbering invariants** (`DB-012`).

**Frontend:** TypeScript correctness · component/unit tests where valuable · browser/E2E for critical workflows when that stage is reached.

> **PRJ-222 — Do not write meaningless tests to inflate coverage.** ⚠ **A coverage number is not a correctness argument.**

---

# 24. Definition of Done

> **PRJ-230 — A bounded task is not complete until every applicable item is satisfied.**

**☐** Canonical owning documents read **☐** Business rule implemented **without reinterpretation** **☐** Permission enforcement added **☐** Validation added **☐** Migration added where schema changed **☐** Tests added or updated **☐** Relevant tests pass **☐** **No unrelated files changed** **☐** Module and layering boundaries respected **☐** Design conformance checked for UI work **☐** Documentation defect reported if discovered **☐** Implementation summary produced.

> **PRJ-231 — 🔴 A task is not complete because the UI works.** ⚠ **A screen that renders while bypassing authorization, storing a balance or rounding a rate early is not done — it is a defect with a demo.**

---

# 25. Forbidden Shortcuts

| 🔴 Prohibited | Rule |
|---|---|
| `TODO`-based business-rule placeholders in completed work | `PRJ-230` |
| Fake or mock authoritative calculations in production paths | `PRJ-003` |
| Hard-coded user, owner or actor IDs | `PRJ-124` |
| Hard-coded permissions | `PRJ-120` |
| Hard-coded production credentials | `PRJ-210` |
| Mutable financial balance shortcuts | `PRJ-050` |
| Silent exception swallowing | `PRJ-201` |
| Business logic in controllers | `PRJ-031` |
| Cross-module repository access | `PRJ-020` |
| Schema auto-update | `PRJ-080` |
| `float`/`double` money | `PRJ-040` |
| Frontend-only security | `PRJ-120` |
| Arbitrary responsive row wrapping | `PRJ-161` |
| Broad unrelated refactors | `PRJ-010` |
| Silent architecture changes | `PRJ-003` |

---

# 26. Code Style — deliberately minimal

> **PRJ-250 — Only style rules that reduce architectural drift belong here.** ⚠ **Formatting is a linter's job, not a constitution's.**

- **Names match canonical domain terminology.** ⚠ **If the architecture says *Advance Requisition*, the class is not `EmployeeAdvance`.**
- **No `Util`, `Manager` or `Helper` dumping grounds.**
- **No generic `CommonService` spanning unrelated domains.**
- **Avoid boolean flags that hide multiple business concepts** — `BD-472`'s LWP-versus-Absent distinction is exactly what a boolean would destroy.
- **Explicit domain types where correctness benefits** — a money type, a period type, an identifier type.

---

# 27. Relationship to Documentation

> **PRJ-260 — Implementation may reveal deterministic documentation defects. Report them; do not silently rewrite canonical architecture during an implementation task unless explicitly authorised.**

> **PRJ-261 — This document references canonical rules rather than restating them** (`DOC-006`). ⚠ **Where this document appears to state a business rule, the cited rule governs and this text is a pointer.**

---

# 28. Change Control

> **PRJ-270 — A change here must not silently alter business behaviour, technology selection or design language.**
>
> **If a proposed engineering rule would change one of those: amend the OWNING canonical document first, then reconcile this one.**

---

# 29. `CLAUDE.md` boundary — not created

> **PRJ-280 — `CLAUDE.md` is a SHORT AI-agent operating manual and is deliberately not written yet.**
>
> **When created it points to** `MASTER_DOCUMENTATION_INDEX.md` · the owning architecture documents · `TECHNOLOGY_ARCHITECTURE.md` · this document · `DESIGN_CONSTITUTION.md` · `UI_UX_ARCHITECTURE.md` when it exists.
>
> 🔴 **It must NOT duplicate this Constitution.** ⚠ **A duplicated rule is a rule that will drift.** **`CLAUDE.md` routes; it does not legislate.**

---

# 30. Version History

| Version | Date | Change |
|---|---|---|
| **1.0.0** | **2026-08-10** | **Initial ratification. `PRJ-001` – `PRJ-280`.** **Owns implementation-wide engineering discipline only**; business truth, design language, documentation governance and technology selection remain with their canonical owners (`PRJ-001`, `PRJ-002`). **Establishes** authority precedence with **canonical architecture winning over implementation convenience** · bounded-task discipline · modular-monolith boundaries with **inward dependency direction** · four-layer module structure · money and decimal discipline consuming `DB-079` · **the derived-position prohibition** · immutability and correction with an explicit mutable/immutable boundary · JPA discipline · Flyway ownership · transaction and concurrency invariants · integration idempotency with **last-write-wins prohibited** · security and **write-time attribution** · time and date typing · REST discipline · frontend engineering and state boundary · dependency justification · performance defaults · error handling · logging versus audit separation · a risk-proportional testing constitution · a twelve-point Definition of Done · fifteen forbidden shortcuts · minimal style rules. **No business rule, technology choice or design token created or altered.** |

**Amendment procedure.** Proposals state the problem, the affected rules, the change, alternatives considered and the operational impact. ⚠ **If the change touches business behaviour, technology or design, the owning document is amended first** (`PRJ-270`).

---

*This document specifies implementation engineering discipline only. It creates no business rule, entity, workflow, permission, state machine, technology selection or design token, and it never overrides canonical architecture.*
