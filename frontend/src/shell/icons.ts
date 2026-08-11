import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  ReceiptText,
  Wallet,
  Users,
  Contact,
  ChartColumn,
  ShieldCheck,
  ChevronDown,
  MessageSquare,
  Bell,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The ONE application icon system.
 *
 * <p>Library: `lucide-react` — a single outline family, monochrome, uniform optical size and
 * stroke. 🔴 There is no second icon library, no emoji, no filled/solid variant and no
 * multicolour glyph anywhere in the application. Every surface that needs an icon resolves it
 * from this module, so a module cannot introduce its own icon vocabulary later.
 *
 * <p>`RULE 3.17` fixes what is binding: 15px nav icons, 1.5px stroke, outline only, with an
 * active-state stroke and colour change. It records the production icon SET as an open design
 * decision, so choosing this family is a reportable engineering choice, not a ratified one.
 *
 * <p>🔴 An icon only depicts what the navigation register already names. It invents no module,
 * no domain and no business meaning (`UX-025`).
 */

/** Sidebar geometry, from `DESIGN_CONSTITUTION` §3.7. */
export const NAV_ICON_SIZE = 15;
export const NAV_ICON_STROKE = 1.5;
export const NAV_ICON_STROKE_ACTIVE = 2;

/** The disclosure chevron is deliberately smaller and lighter than the module icon. */
export const CHEVRON_SIZE = 14;
export const CHEVRON_STROKE = 1.5;

/** Header utility icons (`DESIGN_CONSTITUTION` §3.8 — 34px transparent ghost buttons). */
export const UTILITY_ICON_SIZE = 17;
export const UTILITY_ICON_STROKE = 1.5;

/**
 * Semantic module icons, keyed by the ratified navigation label.
 *
 * <p>Keys are the labels in `navigation.ts`. A label with no entry simply renders without an
 * icon rather than falling back to a generic square.
 */
export const MODULE_ICON: Readonly<Record<string, LucideIcon>> = {
  Dashboard: LayoutDashboard, // grid / dashboard
  Inventory: Boxes, // boxes / package
  Purchasing: ShoppingCart, // purchase / cart
  'Sales & Orders': ReceiptText, // order / receipt
  'Finance & Accounting': Wallet, // wallet / ledger
  'HR & Payroll': Users, // employees
  CRM: Contact, // customer contact
  Reports: ChartColumn, // report / chart
  Administration: ShieldCheck, // administration / settings authority
};

/**
 * Header utility icons (`UX-017`).
 *
 * <p>🔴 Entry points ONLY. Chat and Notification business modules are not implemented, and no
 * unread count, badge or state is shown because no canonical data exists.
 */
export const UTILITY_ICON = {
  chat: MessageSquare,
  notifications: Bell,
  profile: User,
} as const;

/**
 * The single disclosure glyph.
 *
 * <p>ONE glyph, rotated for state — never a second chevron and never a filled triangle.
 * `ChevronDown` is the base: open shows it as drawn (pointing DOWN), closed rotates it 180°
 * so it points UP. See `DISCLOSURE_ROTATION`.
 */
export const DISCLOSURE_GLYPH = ChevronDown;

/**
 * Chevron rotation by disclosure state.
 *
 * <p>🔴 Business-approved direction — recorded here so it cannot be flipped by habit:
 *
 * <ul>
 *   <li>FOLDED / CLOSED → chevron points <b>DOWN</b> (0°)</li>
 *   <li>UNFOLDED / OPEN → chevron points <b>UP</b> (180°)</li>
 * </ul>
 *
 * <p>⚠ INVERTED 2026-08-11 by business decision, after review of the running application. The
 * previous direction — closed UP, open DOWN — is superseded. 🔴 This currently CONTRADICTS
 * `DESIGN_CONSTITUTION.md` `RULE 3.17.b`, which still records the superseded direction; that
 * rule needs a governed amendment (`DOC-079`) so code and architecture agree again.
 */
export const DISCLOSURE_ROTATION = {
  closed: 'rotate(0deg)',
  open: 'rotate(180deg)',
} as const;
