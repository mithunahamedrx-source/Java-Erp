# CLAUDE.md — Operating Manual

**Trioloo Java ERP.** This file is **operational routing only**. It tells you what to read, check and do. It **legislates nothing**.

> 🔴 **It does not define business rules, technology choices, design tokens or engineering discipline.** Those live in their owning documents. **If this file and `docs/PROJECT_CONSTITUTION.md` ever appear to conflict, `PROJECT_CONSTITUTION.md` wins.**

---

## 1. Before anything — route the task

**No implementation begins until you have answered all five:**

1. **What subject owns the requested change?**
2. **Which canonical documents govern it?**
3. **Which technology / design / engineering rules also apply?**
4. **What files are actually in scope?**
5. **What must explicitly NOT be changed?**

⚠ **If you cannot answer #1, read `docs/MASTER_DOCUMENTATION_INDEX.md` first. Do not guess ownership.**

---

## 2. Authority routing

| Question | Authority |
|---|---|
| **Business / domain behaviour** | **The owning canonical architecture document** |
| **Technology, stack, technical construction** | **`docs/TECHNOLOGY_ARCHITECTURE.md`** |
| **Engineering implementation discipline** | **`docs/PROJECT_CONSTITUTION.md`** |
| **Visual / design language** | **`docs/DESIGN_CONSTITUTION.md`** |
| **UI composition / screen behaviour** | **`docs/UI_UX_ARCHITECTURE.md`** — *does not exist yet* |
| **Documentation, version, index governance** | **`docs/MASTER_DOCUMENTATION_INDEX.md` and its `DOC-` rules** |

---

## 3. Mandatory pre-task read

**Always:** this file · `docs/MASTER_DOCUMENTATION_INDEX.md` · `docs/PROJECT_CONSTITUTION.md`.

**Then the owning documents.** Select by ownership, not by habit — these are examples, not a fixed list:

| Work | Also read |
|---|---|
| **Order** | Order Management · Domain Model · Permission (if actions) · API (if marketplace/sync) |
| **Accounting** | Accounting · Payment (if money moves) · Database · Permission · Technology |
| **Payroll** | HR & Payroll · Accounting (if positions) · Payment (if settlement) · Permission · Database |
| **UI** | Design Constitution · UI/UX Architecture once it exists · the owning business architecture |

⚠ **The index lists 33 registered architecture documents besides itself. Read the ones that own your subject.**

---

## 4. Bounded task

**Implement only what was asked.**

🔴 **Do NOT:** refactor unrelated modules · rename unrelated concepts · modernise unrelated code · change unrelated schemas · add unrelated dependencies · **modify canonical architecture because implementation would be easier** · start the next roadmap stage automatically.

**Found another issue? REPORT IT.** ⚠ **Never expand scope silently.**

---

## 5. 🔴 No business invention

**If canonical architecture does not answer a required business question, STOP that part and report:**

> **BLOCKED — MISSING CANONICAL BUSINESS RULE**

**Never invent** a workflow · status · permission · formula · ownership · settlement rule · API authority · document behaviour.

✅ **Ordinary engineering choices that do not change business meaning are yours to make**, within Technology Architecture and Project Constitution.

---

## 6. 🔴 Code is not truth

**Existing code is implementation evidence, never business authority.**

⚠ **If code contradicts canonical architecture, the code is the defect.** **Report it. Do not change the architecture to match the code.**

---

## 7. Classify before editing

**A.** Documentation / architecture · **B.** Backend · **C.** Frontend · **D.** Database migration · **E.** Integration · **F.** Test / verification · **G.** Deployment / infrastructure.

**The classification determines which authorities apply and which files may be touched.**

---

## 8. Per-task checks

### Database
**Read** Database Architecture · Technology Architecture · Project Constitution · the owning domain doc.
**Flyway owns schema.** 🔴 Never edit an applied migration · never use Hibernate schema update · **never add a stored balance for a derived position.**

### Money
**Verify `DB-079`** plus the technology and Project Constitution monetary rules.
🔴 No authoritative `float`/`double` · **no JavaScript `Number` as authoritative money** · **no premature rate or weighted-average-cost rounding.**
⚠ **Formatting precision is not calculation precision.**

### Security
**Verify** required permission/authority · scope · sensitive-data class · self-approval rules where applicable · actor attribution.
🔴 **Frontend hiding is not authorization. Backend enforcement is required.**

### Integration
**Verify** idempotency · external identity preserved · ordering and exception rules · `API_MANAGED` / `ERP_MANAGED` authority.
🔴 **Never timestamp-newest-wins where prohibited.** ⚠ **A manual ERP takeover must survive later stale sync.**

### Transactions
**Determine whether the architecture requires a synchronous transaction, an event, or an independent reaction.**
🔴 **Do not invent events.** 🔴 **Final Settlement atomicity is never converted into async event coordination.**

### Attribution
🔴 **Capture first-class actor facts when the authoritative action occurs — never reconstruct them from logs.**
**Examples:** `Confirmed By` / `Confirmed At` · approval actor · finalisation actor · authority-takeover actor.

### Frontend zoom and layout
**Zoom changes scale and viewport visibility — never information existence.**
🔴 **Structured operational/data rows do not structurally wrap.** Page-level regions may reflow where permitted. **Page size and record count never change because of viewport or zoom.** **Browser zoom is never disabled.**
⚠ **Do not invent breakpoints** unless `UI_UX_ARCHITECTURE.md` later ratifies them.

---

## 9. Design

**For UI work, `docs/DESIGN_CONSTITUTION.md` is authoritative.**

**Preserve** Manrope · the canonical OKLCH palette · canonical spacing and radius geometry · layout-stability and zoom rules · structured-row non-wrap · approved composition.
🔴 **Never replace approved tokens with framework defaults.**

⚠ **Do not infer business rules from design mockups.** **If a visual reference conflicts with business architecture, business architecture wins.**

---

## 10. Technology

**The locked stack lives in `docs/TECHNOLOGY_ARCHITECTURE.md`. Do not change it silently.**

🔴 **Never silently** downgrade Java · change database · introduce microservices · replace the frontend framework · add infrastructure technologies.

**If a requested implementation appears incompatible with the stack, report the exact conflict.**

---

## 11. Engineering discipline

**`docs/PROJECT_CONSTITUTION.md` is mandatory and is not repeated here.**

**It governs** module boundaries · money precision · derived positions · immutability · Flyway · transactions · JPA boundaries · security · attribution · API rules · frontend state boundary · testing · forbidden shortcuts.

⚠ **Read it. Do not rely on this summary.**

---

## 12. Dependencies

**Before adding one, state why it is necessary.** ⚠ **Convenience is not a reason when the platform already solves the problem.** **Respect the Technology Architecture exclusions.**

---

## 13. Documentation changes

**Do not casually edit canonical documents during implementation.**

**If implementation exposes a deterministic documentation defect: report it.** **Modify canonical architecture only when the task explicitly authorises it** — and then follow the existing version, index and history governance.

---

## 14. Testing and failure

**Run the tests `PROJECT_CONSTITUTION.md` requires before declaring completion.**

**Report:** tests added/changed · tests executed · pass/fail · **tests not run and why**.
🔴 **Never claim success without running relevant verification when tooling is available.**

**When something fails:** inspect the real error · fix the bounded cause · rerun.
🔴 **Never hide failure by** deleting tests · weakening assertions · disabling validation · bypassing permissions · changing canonical behaviour · swallowing exceptions.

---

## 15. Completion report

**Every completed task reports:**

1. What was requested
2. Canonical documents read
3. Files changed
4. Files created
5. Business rules implemented or referenced
6. Permissions / security applied
7. Migrations created, if any
8. Tests added or updated
9. Tests run and result
10. Build / lint / type-check result where applicable
11. Any deviations
12. Any unresolved or blocking issue
13. Confirmation that unrelated scope was not changed

⚠ **Keep it factual. No padding, no self-congratulation.**

---

## 16. 🔴 Stop

**When the requested task is finished, STOP.**

**Do not automatically start** the next module · the next roadmap stage · refactoring · deployment · extra features.

**Wait for the next explicit task.**

---

## Current state — 2026-08-10

| | |
|---|---|
| **Business discovery** | ✅ Complete for V1 |
| **Architecture** | ✅ Complete through Document/Printable and Final Cross-Domain Reconciliation |
| **Design foundation** | ✅ `DESIGN_CONSTITUTION.md` v2.1.1 |
| **Technology** | ✅ `TECHNOLOGY_ARCHITECTURE.md` v1.1.0 — stack locked |
| **Engineering discipline** | ✅ `PROJECT_CONSTITUTION.md` v1.0.0 |
| **UI/UX Architecture** | ⬜ **Not started** |
| **Implementation** | ⬜ **Not started** |

⚠ **No application code exists yet.** **Legacy Laravel migration is explicitly out of V1 scope.**

**This file is an operational routing file, not a canonical architecture document, and carries no `DOC-` number by design** (`PRJ-280`).
