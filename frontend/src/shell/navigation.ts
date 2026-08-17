/**
 * The frozen V1 sidebar, exactly as ratified at `UI_UX_ARCHITECTURE.md` `UX-024`.
 *
 * 🔴 `UX-025` — a navigation group is COMPOSITION. It creates no domain, module,
 * aggregate, transaction boundary or ownership authority. There is no `Sales` module, no
 * `Finance` module or ledger and no `CRM` module; `Finance & Accounting` deliberately mixes
 * Payment-owned and Accounting-owned destinations, which stay separately owned under
 * `SYS-027`.
 *
 * 🔴 Absent by ratified decision, not oversight: `Chat` and `Notifications` are header
 * utilities (`UX-017`), and `Pick & Pack`, `Shipments` and `Marketplace Sync` are composed
 * inside the Orders workspace (`UX-187`).
 */

export type NavDestination = {
  readonly label: string;
  readonly path: string;
  /**
   * Permission code gating this destination, once its owning module defines one.
   *
   * `null` means "no canonical permission exists yet" — the owning module is not
   * implemented, and 🔴 inventing a business permission just to populate the sidebar is
   * prohibited (`UX-006`, `CLAUDE.md` §5). Such destinations render for any authenticated
   * user; the backend still refuses every request regardless (`PRJ-120`).
   */
  readonly permission: string | null;
};

export type NavGroup = {
  readonly label: string;
  readonly section: 'MAIN' | 'ADMIN';
  readonly children: readonly NavDestination[];
};

/** A destination with no children — `Reports` is the only one (`UX-024`). */
export type NavLeaf = {
  readonly label: string;
  readonly section: 'MAIN';
  readonly path: string;
  readonly permission: string | null;
};

export type NavItem = NavGroup | NavLeaf;

export function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}

/**
 * The register. Order is the ratified operating order and is not re-sorted.
 *
 * Every `permission` is `null` today because no business module has been implemented and
 * therefore no module has declared its permission codes.
 */
export const NAVIGATION: readonly NavItem[] = [
  // UX-024 amended 2026-08-11 - Dashboard is the first direct destination under MAIN.
  // 🔴 A DESTINATION only: GAP-004 keeps dashboard KPIs undefined, so it displays nothing.
  { label: 'Dashboard', section: 'MAIN', path: '/dashboard', permission: null },
  /*
    UX-024 amended 2026-08-12 - INVENTORY NAVIGATION TERMINOLOGY. `Stock Control` and
    `Purchasing` are labels only; `/inventory/stock` and `/purchasing/purchases` remain.
    The child ORDER below is the ratified operating order and is never re-sorted.

    🔴 UX-025 is the only reason this is permissible and NOTHING moved with the rows:
    PROCUREMENT_ARCHITECTURE.md remains the sole owner of Supplier, Purchase Order, Goods
    Receipt and every purchasing lifecycle, approval, document and accounting consequence.
    The `/purchasing/…` paths are kept deliberately — the URL keeps naming the OWNING module,
    so nothing in the address suggests Inventory acquired procurement.
  */
  {
    label: 'Inventory',
    section: 'MAIN',
    children: [
      // UX-035 - ONE destination carrying three entity-class tabs. It is NOT `Stock Control`.
      { label: 'Products', path: '/inventory/products', permission: null },
      // The Inventory-owned operational destination. 🔴 Never merged with `Products`: a
      // Stock Item card DISPLAYING a derived inventory figure transfers no ownership
      // (UX-036, IVN-000).
      { label: 'Stock Control', path: '/inventory/stock', permission: null },
      // UX-033 - one workspace exposing Purchase Orders and Goods Receipts, which remain
      // canonically separate records. Procurement-owned (UX-033.a).
      { label: 'Purchasing', path: '/purchasing/purchases', permission: null },
      { label: 'Suppliers', path: '/purchasing/suppliers', permission: null },
      { label: 'Warehouses', path: '/inventory/warehouses', permission: null },
    ],
  },
  {
    label: 'Sales & Orders',
    section: 'MAIN',
    children: [
      // UX-187 - Orders is the unified operational workspace. Picking, shipment and
      // marketplace sync are reached inside it, never as sidebar rows.
      { label: 'Orders', path: '/sales/orders', permission: null },
      { label: 'Returns & Exchange', path: '/sales/returns', permission: null },
      { label: 'Warranty & Repair', path: '/sales/warranty', permission: null },
      { label: 'Trade-In', path: '/sales/trade-in', permission: null },
    ],
  },
  {
    label: 'Finance & Accounting',
    section: 'MAIN',
    children: [
      { label: 'Payments', path: '/finance/payments', permission: null },
      { label: 'Journal', path: '/finance/journal', permission: null },
      { label: 'Advance Requisitions', path: '/finance/advance-requisitions', permission: null },
      { label: 'Employee Loans', path: '/finance/employee-loans', permission: null },
      { label: 'Salary Payable', path: '/finance/salary-payable', permission: null },
      { label: 'Fund Transfers', path: '/finance/fund-transfers', permission: null },
    ],
  },
  {
    label: 'HR & Payroll',
    section: 'MAIN',
    children: [
      { label: 'Employees', path: '/hr/employees', permission: null },
      { label: 'Attendance', path: '/hr/attendance', permission: null },
      { label: 'Leave', path: '/hr/leave', permission: null },
      { label: 'Payroll', path: '/hr/payroll', permission: null },
    ],
  },
  {
    label: 'CRM',
    section: 'MAIN',
    // UX-027.c - a single-child group stays a group. It does not auto-flatten, because a
    // label that moves depending on who is looking destroys operator muscle memory.
    children: [{ label: 'Customers', path: '/crm/customers', permission: null }],
  },
  // Reports is a direct destination and never acquires children to match the others.
  { label: 'Reports', section: 'MAIN', path: '/reports', permission: null },
  {
    label: 'Administration',
    section: 'ADMIN',
    children: [
      { label: 'Users', path: '/administration/users', permission: null },
      { label: 'Roles & Permissions', path: '/administration/roles', permission: null },
      /*
        `PRM-090` has now declared this destination's capability, so it is no longer `null`.
        🔴 `UX-014` / `PRJ-120` — hiding the row is an AFFORDANCE. The backend refuses every
        request without the capability regardless of what the sidebar shows.
      */
      { label: 'Shops & Channels', path: '/administration/shops', permission: 'system.channel-instance.view' },
      { label: 'Integrations', path: '/administration/integrations', permission: null },
      { label: 'Settings', path: '/administration/settings', permission: null },
    ],
  },
];

/**
 * Whether the current actor may see a destination.
 *
 * 🔴 An affordance only (`UX-014`, `PRJ-120`). Hiding a row is never authorization — the
 * backend refuses regardless. A destination with no canonical permission yet is visible;
 * it leads to a placeholder that holds no business data.
 */
export function canSee(destination: { readonly permission: string | null }, permissions: readonly string[]): boolean {
  return destination.permission === null || permissions.includes(destination.permission);
}

/** Children the actor may see. A group with none renders nothing at all (`UX-027.b`). */
export function visibleChildren(group: NavGroup, permissions: readonly string[]): readonly NavDestination[] {
  return group.children.filter((child) => canSee(child, permissions));
}

/** Every routable destination, for route registration. */
export function allDestinations(): readonly { label: string; path: string }[] {
  return NAVIGATION.flatMap((item) =>
    isGroup(item)
      ? item.children.map((c) => ({ label: c.label, path: c.path }))
      : [{ label: item.label, path: item.path }],
  );
}
