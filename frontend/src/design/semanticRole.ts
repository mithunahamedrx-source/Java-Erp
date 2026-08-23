import type { SemanticTone } from '../ui/primitives';

/**
 * THE ONE SOURCE OF SEMANTIC-ROLE TRUTH — `RULE 3.3.d`.
 *
 * 🔴 A CANONICAL BUSINESS STATE HAS ONE ROLE ACROSS THE WHOLE ERP. `SYNCED` cannot be success
 * on one screen and neutral on another, and no component may locally reinterpret a shared
 * state (`RULE 3.3.d.i`). That is the entire reason this file exists rather than a `tone`
 * prop chosen per surface.
 *
 * 🔴 EVERY MAPPING BELOW IS DERIVED FROM CANON AND CITES IT. `RULE 3.14.a.a` forbids assigning
 * a role because a state *feels* similar, and several of these are deliberately NOT the
 * intuitive answer — see `MANUAL_REQUIRED`, `UNSENT` and `MAPPED`.
 *
 * ⚠ NEUTRAL IS AN ANSWER, NOT A GAP (`RULE 3.3.d.d`). A state mapped to `neutral` has been
 * judged unremarkable. A state ABSENT from these maps is UNMAPPED, which is a different thing
 * entirely and is what {@link semanticRoleOf} refuses to guess at.
 */

/**
 * Sync state — `SYS §7.1`.
 *
 * 🔴 `SYS-025` — `MANUAL_REQUIRED` is a NORMAL state, not a system failure: "when automation
 * cannot proceed, a human can". It is therefore WARNING (a person is needed) and NEVER danger,
 * which would misinform every operator who sees it.
 *
 * 🔴 `SYS-026` — `DIVERGED` is ALWAYS an exception, never silently corrected, surfaced for
 * resolution. It is WARNING: recoverable, and it owes the operator a decision.
 *
 * ⚠ `PENDING` and `IN_PROGRESS` are in-flight with no success, warning or failure meaning yet
 * (`RULE 3.3.b` — blue means in-flight), so they are INFO.
 */
export const SYNC_STATE_ROLE = {
  SYNCED: 'success',
  PENDING: 'info',
  IN_PROGRESS: 'info',
  FAILED: 'danger',
  MANUAL_REQUIRED: 'warning',
  DIVERGED: 'warning',
} as const satisfies Record<string, SemanticTone>;

/**
 * Comparison row state — `PRD-181`.
 *
 * ✅ `ALIGNED` is settled agreement → success.
 *
 * 🔴 `NOT_READABLE` is the ABSENCE of an answer, not a defect (`API-063.c`, `SYS-034`). The
 * channel did not return the fact; nothing is wrong and nothing is owed. → NEUTRAL.
 *
 * 🔴 `UNSENT` is NEUTRAL, which is deliberately not the intuitive answer. `PRD-188.a` makes an
 * ERP-first draft legitimate, and `UX-038.g` forbids reading it as "an attempt is owed" —
 * that meaning belongs to `PENDING`. An unsent local edit is an ordinary condition of an
 * edited listing, so colouring it amber would demand attention nothing has asked for.
 */
export const COMPARISON_STATE_ROLE = {
  ALIGNED: 'success',
  DIVERGED: 'warning',
  MANUAL_REQUIRED: 'warning',
  NOT_READABLE: 'neutral',
  UNSENT: 'neutral',
} as const satisfies Record<string, SemanticTone>;

/**
 * Operation outcome — `E-107`.
 *
 * ⚠ Same reasoning as the sync states: a settled success, an in-flight request, a real
 * failure, and two conditions that owe a person a decision.
 */
export const OPERATION_OUTCOME_ROLE = {
  SUCCEEDED: 'success',
  REQUESTED: 'info',
  IN_PROGRESS: 'info',
  FAILED: 'danger',
  MANUAL_REQUIRED: 'warning',
  DIVERGED: 'warning',
} as const satisfies Record<string, SemanticTone>;

/**
 * Local batch-save outcome — `PRD-185`, `INV-107.2`, presented per `FRAME 17`.
 *
 * 🔴 `SAVED` IS NEUTRAL, AND THAT IS THE WHOLE POINT. A batch apply records ERP intent and
 * sends nothing. `PRD-185.a` names the dangerous misreading exactly — an operator who believes
 * a save reached Daraz will not push — and a green "success" pill is precisely how a screen
 * tells that lie. `COMPARISON_STATE_ROLE.UNSENT` already settled this: an unsent local edit is
 * an ordinary condition, not an achievement.
 *
 * 🔴 `EXCLUDED` is NEUTRAL for the same reason `MAPPING_STATE_ROLE.UNMAPPED` is: `PRD-178`
 * makes unmapped a first-class valid state, so a listing skipped for holding no ERP intended
 * values is not a fault and owes nobody a decision.
 *
 * ✅ Only `REFUSED` carries colour, because only it has consequence: that listing did NOT
 * save while its siblings did (`INV-107.2`), and the operator must see which.
 */
export const BATCH_SAVE_OUTCOME_ROLE = {
  SELECTED: 'neutral',
  SAVED: 'neutral',
  EXCLUDED: 'neutral',
  REFUSED: 'danger',
} as const satisfies Record<string, SemanticTone>;

/**
 * Channel-reported listing status — `PRD-177.b`.
 *
 * ✅ These describe what the MARKETPLACE says about the listing, so they carry real
 * consequence: `ACTIVE` is live and healthy, `SUSPENDED` needs attention, `REJECTED` is a
 * refusal by the channel.
 */
export const LISTING_STATUS_ROLE = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  REJECTED: 'danger',
} as const satisfies Record<string, SemanticTone>;

/**
 * Local lifecycle — `PRD-188`.
 *
 * 🔴 `DRAFT` is NEUTRAL because `PRD-188.a` makes a local draft a LEGITIMATE record, not an
 * unfinished one. `WITHDRAWN` is a deliberate, settled decision rather than a fault.
 *
 * ⚠ `PUBLISHED` is success: the listing exists remotely, which is the settled end state this
 * lifecycle is aiming at. `PENDING_PUBLICATION` is in-flight → info.
 */
export const LOCAL_LIFECYCLE_ROLE = {
  DRAFT: 'neutral',
  PENDING_PUBLICATION: 'info',
  PUBLISHED: 'success',
  WITHDRAWN: 'neutral',
} as const satisfies Record<string, SemanticTone>;

/**
 * Mapping state — `PRD-178`, `PRD-179`.
 *
 * 🔴 ALL THREE ARE NEUTRAL, AND THIS IS THE MOST DELIBERATE MAPPING IN THIS FILE.
 * `PRD-178` makes `UNMAPPED` a FIRST-CLASS VALID STATE, not an error — so it cannot be warning.
 * And if being unmapped is not a problem, then being mapped is not an achievement: `MAPPED` is
 * the ordinary condition of most listings, so coluring it green would be decoration at scale
 * (`RULE 3.3.d.e`) and would drain the colour of meaning everywhere else.
 *
 * ✅ The mapping dimension is carried entirely by its WORDS, which `RULE 8.4` already requires.
 */
export const MAPPING_STATE_ROLE = {
  UNMAPPED: 'neutral',
  PARTIALLY_MAPPED: 'neutral',
  MAPPED: 'neutral',
} as const satisfies Record<string, SemanticTone>;

/**
 * Connection condition — `API-068`, presented per `SCS-043`.
 *
 * ✅ `CONNECTED` is the settled working state → success. `ERROR` is a refusal by the channel
 * that stops work outright → danger.
 *
 * 🔴 `REAUTH_REQUIRED` is WARNING and deliberately NOT danger. `SCS-043` is explicit that the
 * shop, its Listings and its binding are all UNCHANGED — nothing was lost and nothing broke;
 * a person must renew the authorisation. That is exactly `RULE 3.3.b`'s amber.
 *
 * 🔴 `NOT_CONNECTED` is NEUTRAL, which is the least intuitive mapping here. `SCS-021.c` makes
 * it an ORDINARY condition of a shop nobody has connected yet — legitimately awaiting a step,
 * not a defect. Colouring it amber would demand attention from every newly registered shop
 * and drain the colour of meaning (`RULE 3.3.d.e`). ⚠ It still contributes to the "needs
 * attention" COUNT (`SCS-021.a`); a count and a colour are different carriers.
 */
export const CONNECTION_STATE_ROLE = {
  CONNECTED: 'success',
  REAUTH_REQUIRED: 'warning',
  ERROR: 'danger',
  NOT_CONNECTED: 'neutral',
} as const satisfies Record<string, SemanticTone>;

/**
 * Channel Instance configuration lifecycle — `SYS-108`, presented per `SCS-024.b`.
 *
 * 🔴 ALL FOUR ARE NEUTRAL, AND THAT IS A DECISION, NOT AN OMISSION. `SCS-024.b` renders
 * configuration as PLAIN UPPERCASE TEXT and connection as a chip, precisely so that
 * *suspended but connected* and *active but broken* both read correctly. Giving the
 * configuration column its own semantic colour would put two competing signals in one row and
 * destroy the distinction the contract is built on.
 *
 * ⚠ `ACTIVE` here is NOT `LISTING_STATUS_ROLE.ACTIVE`. That one is what a marketplace says
 * about a listing; this one is whether a shop has been approved for internal use. Same word,
 * different fact, different owner — mapping them alike would be exactly the `RULE 3.14.a.a`
 * resemblance error.
 */
export const CONFIGURATION_STATE_ROLE = {
  DRAFT: 'neutral',
  ACTIVE: 'neutral',
  SUSPENDED: 'neutral',
  ARCHIVED: 'neutral',
} as const satisfies Record<string, SemanticTone>;

/**
 * Order lifecycle — `SM-1`, `OM §6.2`, `SMA §5.2`.
 *
 * 🔴 EVERY ROW CITES THE MEANING `OM §6.2` GIVES THE STATE, NEVER WHAT THE WORD RESEMBLES
 * (`RULE 3.14.a.a`). This map REPLACES a substring matcher that coloured a state by testing
 * whether its name contained `cancel`, `fail`, `deliver` or `ship` — the exact resemblance
 * reasoning that rule prohibits.
 *
 * 🔴 `CANCELLED` IS NEUTRAL, AND IT IS THE MOST DELIBERATE ROW HERE. `RULE 3.3.c` reserves
 * canonical red for DESTRUCTIVE ACTION semantics in three enumerated placements — a
 * confirmation fill, a destructive menu row, an outline marker — and an order STATE is none of
 * them. Cancellation is also an ordinary, fully authorised business outcome with its own
 * authority table (`OM §6.4`), so it is a settled decision rather than a fault. Same reasoning
 * as `LOCAL_LIFECYCLE_ROLE.WITHDRAWN`.
 *
 * 🔴 THE FIVE MID-LIFECYCLE STATES ARE NEUTRAL BY DECISION, NOT BY OMISSION. `CONFIRMED`,
 * `RELEASED`, `IN_FULFILLMENT`, `READY_TO_SHIP` and `DISPATCHED` are ordinary forward progress:
 * none owes anyone a decision, and colouring five consecutive stages would be decoration at
 * scale (`RULE 3.3.d.e`) that drains the colour of meaning from the states that do.
 *
 * ⚠ `DELIVERED` IS SUCCESS AND DOES NOT MEAN PAID. `BR-010` — delivery does not close an order,
 * and `OM §11.1` states outright that an order marked paid at delivery is a false statement on
 * every channel Trioloo operates. The success role describes the FULFILMENT outcome; `CLOSED`
 * is the only clean terminal state and carries the commercial one.
 *
 * ⚠ `ON_HOLD` is warning because it will sit there until a person acts: `BR-151` explicitly
 * prohibits hold duration, ageing, SLA, auto-cancellation and auto-release, so nothing will
 * ever move it on its own.
 */
export const ORDER_LIFECYCLE_ROLE = {
  // "Awaiting the verification decision" — in-flight work that has just arrived (§7.8, §7.4).
  PENDING_VERIFICATION: 'info',
  CONFIRMED: 'neutral',
  RELEASED: 'neutral',
  IN_FULFILLMENT: 'neutral',
  READY_TO_SHIP: 'neutral',
  DISPATCHED: 'neutral',
  DELIVERED: 'success',
  // "Attempted and failed — not terminal". Recoverable: §10.4 re-attempts, so warning not danger.
  FAILED_DELIVERY: 'warning',
  // "Goods came back to Trioloo" — owes QC disposition and a refund decision.
  RETURNED: 'warning',
  ON_HOLD: 'warning',
  CANCELLED: 'neutral',
  // `BR-010` — the only clean terminal state, reached when every sub-machine is terminal.
  CLOSED: 'success',
} as const satisfies Record<string, SemanticTone>;

/**
 * Payment position — `SM-5`, `OM §11.3`.
 *
 * 🔴 THIS MAP HOLDS THREE KEYS BECAUSE THREE IS ALL THIS SLICE CAN HONESTLY DERIVE.
 * `SM-5` has eleven states, and every one past `DUE` requires an `E-040 Receivable` that has
 * been collected, remitted, matched or refunded. No receipt, remittance or settlement record
 * exists here, so no order can have advanced past `DUE` — the same fact `OSC-053` recorded when
 * `Total collectable` subtracts nothing.
 *
 * ⚠ `NOT_DUE` IS NEUTRAL because `OM §11.3` defines it as "goods not yet delivered", which is
 * the ordinary condition of most orders and owes nobody a decision (`RULE 3.3.d.e`).
 *
 * ⚠ `DUE` IS INFO, NOT WARNING. `OM §11.3` defines it as "delivered; payment expected" — an
 * obligation in flight, which is exactly `RULE 3.3.b`'s blue. It is not amber: nothing has gone
 * wrong and no person is being asked to act. 🔴 It is emphatically not success either, because
 * `OM §11.1` states outright that an order marked paid at delivery is a false statement on every
 * channel Trioloo operates.
 *
 * 🔴 `UNKNOWN` IS NEUTRAL AND IS A REAL ANSWER (`SYS-034`). It is not the absence of a mapping;
 * it is the position of an order whose payment state cannot be derived from what is held.
 */
export const PAYMENT_POSITION_ROLE = {
  NOT_DUE: 'neutral',
  DUE: 'info',
  UNKNOWN: 'neutral',
} as const satisfies Record<string, SemanticTone>;

/**
 * Resolves a canonical state to its role, refusing to guess.
 *
 * 🔴 An unknown value is NOT quietly rendered neutral (`RULE 3.3.d.e`): that would hide a
 * newly introduced state behind a plausible-looking chip. It throws in development so the
 * missing mapping is found while it is cheap, and degrades to neutral in production so a
 * single unmapped state can never blank an operational screen.
 */
export function semanticRoleOf(
  map: Record<string, SemanticTone>,
  state: string | null | undefined,
): SemanticTone {
  if (state && state in map) {
    return map[state] as SemanticTone;
  }
  if (import.meta.env.DEV && state) {
    throw new Error(
      `Unmapped semantic state "${state}". RULE 3.3.d requires an explicit semantic role; `
        + 'add it to src/design/semanticRole.ts with its canonical evidence rather than '
        + 'letting it fall through to neutral.',
    );
  }
  return 'neutral';
}
