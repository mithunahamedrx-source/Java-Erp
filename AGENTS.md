# AGENTS.md - Codex Repository Governance

This file is execution governance for future Codex sessions. It is not an
architecture document, does not define business behaviour, and must not be used
to duplicate canonical rules.

Trioloo ERP is documentation-driven. A fresh agent must assume zero prior
conversation history and reconstruct authority from the current repository
state on disk.

## Source Of Truth Order

Use this precedence for implementation decisions:

1. Current canonical documentation on disk.
2. Current registered architecture owners and cross-references.
3. Current implementation only where architecture delegates engineering detail.
4. Current tests.
5. Current task prompt.

Chat history, old AI reports, handoff notes, and previous session memory are
never authoritative. A prior Claude or Codex report may be used only as a
navigation hint and must be verified against current files on disk.

## Mandatory Task Start Gate

Do not edit files until this gate is complete:

1. Read this file.
2. Read `CLAUDE.md`.
3. Read `docs/MASTER_DOCUMENTATION_INDEX.md`.
4. Read `docs/PROJECT_CONSTITUTION.md`.
5. Identify the canonical owner document or documents for the requested
   behaviour.
6. Read the current owner document versions from disk.
7. Read directly referenced cross-domain owners.
8. Inspect existing implementation.
9. Inspect relevant tests.
10. Run `git status --short`.
11. Run `git diff` or otherwise determine all pre-existing changes.

For UI or layout work, also read the current
`docs/DESIGN_CONSTITUTION.md` and `docs/UI_UX_ARCHITECTURE.md` before editing.

## What "Owner" Means

"Owner" means the architecture or domain that is canonical authority for a fact
or behaviour.

It does not mean:

- application user role
- company owner
- the DEV user's permissions

Examples:

- Product owns Product definition.
- Inventory owns stock movements and positions.
- Inventory Costing owns valuation.
- Warehouse owns warehouse facts.
- Permission and Access Governance own authority semantics.

Navigation grouping never changes domain ownership.

## Documentation And Amendment Discipline

The live documentation register, ownership map, freeze status, and amendment
history are in `docs/MASTER_DOCUMENTATION_INDEX.md`. Follow its `DOC-` rules,
especially:

- current state and existing documents: `DOC-001` and `DOC-002`
- code is not authority: `DOC-003`
- exclusive ownership and cross-reference discipline: `DOC-005` and `DOC-006`
- amendment propagation: `DOC-021`
- AI/developer no-invention rules: `DOC-022` through `DOC-033`
- post-freeze amendment discipline: the current freeze and amendment sections
  in the index

If requested behaviour conflicts with current frozen or post-freeze canon, do
not silently change code. Determine whether it is:

A. a code defect
B. a deterministic documentation defect
C. a genuinely missing business decision

If C, stop and report exactly:

BLOCKED — MISSING CANONICAL BUSINESS DECISION

If a material post-freeze business or UI rule must change, perform the governed
documentation amendment under the current amendment rules before implementation.
Do not amend documentation merely to justify convenient code.

## Business Context Discipline

This is Trioloo's real ERP. Never implement generic ERP assumptions merely
because they are common.

Do not invent entities, fields, statuses, permissions, financial rules, stock
balances, approval flows, routes, breakpoints, KPIs, filters, or actions unless
current canon or an explicit current user decision owns them.

If code conflicts with current canonical architecture, code is the defect.
Framework defaults, ORM behaviour, generated code, UI libraries, performance
optimisations, and existing implementation shortcuts may not redefine business
meaning.

## Bounded Task Rule

Work on one bounded capability per task. Do not complete future modules,
broad-refactor unrelated code, clean unrelated files, rename unrelated APIs,
redesign unrelated UI, or create speculative abstractions for future use.

Future-expandable architecture does not mean future features should be built
early.

## DEV User Principle

The designated local DEV identity must be able to review the entire implemented
application through the normal permission-resolution system and only with
currently canonically defined permissions.

Never achieve DEV review access with wildcard permission, `hasRole("ADMIN")`,
security disablement, frontend bypass, hidden superuser behaviour, or production
bootstrap shortcuts. Production authority remains strict.

## UI And Viewport Governance

For any UI or layout change, re-check current canonical rules for:

- 100% desktop condition
- 80% first-class desktop condition
- native browser zoom
- operational nowrap
- scoped overflow
- hidden scrollbar chrome
- action reachability
- page-header action region
- sidebar behaviour
- no `transform: scale`
- no JavaScript zoom simulation
- no viewport-driven record, page-size, or data changes
- no arbitrary breakpoint invention

A page-specific visual fix may not break global viewport rules.

## Security Governance

Never weaken deny-by-default authorization, `CurrentActor`, permission-based
enforcement, Administrator non-omnipotence, lifecycle login gating, CSRF, or
session fixation protection.

Do not use role-name shortcuts. Do not introduce JWT or `localStorage`
authentication unless canon is explicitly amended.

## Money, Stock, And History Safety

Never introduce:

- `float` or `double` for money
- stored derived stock balance
- stored derived availability
- stored valuation shortcut
- last-write-wins financial truth
- mutation of immutable historical records

Respect the current Database, Inventory, Inventory Costing, Accounting, and
Audit owners.

## Fresh-Session And Partial-Work Safety

If a task says "continue Claude's work", first reconstruct the real state from
`git diff`, files on disk, migrations, tests, and current docs. Do not trust the
handoff report until verified.

If another agent left partial work, do not restart the feature from scratch and
do not overwrite it blindly. First classify changed or new files as:

- verified complete
- partial but consistent
- conflicting
- unrelated pre-existing work

If current partial work conflicts with canon, report it before proceeding.

## Test And Diff Discipline

Before declaring success:

- run relevant targeted tests
- run required backend regression
- run frontend tests if frontend changed
- run `tsc --noEmit` if frontend changed
- run production build if frontend changed
- run documentation integrity checks if docs changed
- inspect final `git status --short`
- inspect final `git diff --stat`
- inspect final `git diff`

Never make tests pass by removing assertions or weakening guards unless canon
requires the test to change.

Confirm that all changes belong to scope, there are no debug or scratch files,
no accidental generated assets, no unrelated formatting churn, no duplicate
implementation, and no obsolete alternative path left behind.

Do not revert pre-existing user or agent work unless explicitly authorised.

## Git Discipline

Default:

- Do not commit.
- Do not push.

Only commit or push on explicit user instruction.

## Anti-Mozambik Rule

Never make a broad speculative correction because something "looks wrong".

Before every material edit, prove:

- what is wrong
- which canonical rule it violates
- which owner controls the correction
- why the proposed change is the minimum coherent fix

No proof, no edit. This repository must favour a correct stop over a confident
invented solution.

## Required Final Report

Every future implementation report must include:

1. task scope
2. canonical documents read
3. exact governing rule IDs
4. ownership map
5. repository state before work
6. files changed
7. database migrations
8. permission/security impact
9. viewport/UI rules checked if UI changed
10. tests run/results
11. build/typecheck result
12. docs impact
13. deviations from canon
14. unresolved blockers
15. final git status
16. confirmation no unrelated work performed
