import { Link, Outlet, useLocation } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';

/**
 * The Products workspace — ONE sidebar destination, three entity-class tabs (`UX-035`).
 *
 * <p>🔴 Three distinct canonical entity classes, never merged into one result feed:
 * `Stock Items` = `E-020`, `Sellable Products` = `E-058`, `Listings` = `E-059`. A Listing
 * never maps to a Stock Item directly — the chain runs through the Sellable Product
 * (`PRD-021`, `PRD-028`).
 *
 * <p>🔴 `RULE 3.13.a` — an entity-class tab REUSES the ratified WHITE-RAISED treatment,
 * because `RULE 3.13`'s own distinction is *dark for filtering a set, white-raised for
 * switching a view*, and these switch the view. The dark-filled treatment is prohibited here:
 * it is the language of status filtering and would assert that three entity classes are
 * statuses of one collection.
 */

/**
 * The workspace entry — `UX-035.f`'s fourth row.
 *
 * <p>🔴 `UX-035.f.i` — `/inventory/products` RENDERS the workspace with `Stock Items` active
 * and KEEPS that URL. It does not rewrite itself to `/inventory/products/stock`, which stays
 * ratified, addressable and the tab control's target.
 */
const WORKSPACE_PATH = '/inventory/products';

const TABS = [
  { label: 'Stock Items', path: '/inventory/products/stock' },
  { label: 'Sellable Products', path: '/inventory/products/sellable' },
  { label: 'Listings', path: '/inventory/products/listings' },
] as const;

export default function ProductWorkspace(): React.JSX.Element {
  const location = useLocation();

  /*
    Active tab is resolved HERE rather than by each link's own route match, because the
    workspace entry path carries no tab segment and no link would match it. 🔴 The default is
    `UX-035.f`'s ratified one — Stock Items — and it is a ROUTE decision only: viewport, zoom
    and device never change it (RULE 7.3.a).
  */
  const active =
    TABS.find((tab) => location.pathname.startsWith(tab.path)) ??
    (location.pathname.startsWith(WORKSPACE_PATH) ? TABS[0] : undefined);

  return (
    <>
      <PageHeader title="Products" subtitle={active ? active.label : undefined} />

      {/* §3.13 detail-tab geometry, applied on FUNCTION rather than page class (RULE 3.13.a.c). */}
      <div
        data-testid="product-entity-tabs"
        style={{
          display: 'flex',
          gap: '6px',
          padding: '5px',
          borderRadius: '12px',
          background: 'var(--color-tab-container)',
          width: 'fit-content',
          marginBottom: 'var(--space-7)',
          flexWrap: 'nowrap',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.label === active?.label;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              data-testid={`product-tab-${tab.label}`}
              /*
                🔴 `RULE 3.21.d` — the selected surface fades in place. ⚠ There is deliberately
                NO sliding indicator: the emphasis appears where the tab already is, so nothing
                travels across the control and no layout property is animated.
              */
              className="state-transition"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '36px',
                padding: '0 16px',
                borderRadius: '9px',
                fontSize: '13.5px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                // RULE 3.13.a — white-raised active, never dark-filled.
                background: isActive ? 'var(--color-surface)' : 'transparent',
                boxShadow: isActive ? 'var(--elevation-active-tab)' : 'none',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </>
  );
}

/**
 * Listings exists as a STRUCTURAL tab only until its own Product stage.
 *
 * <p>🔴 No `E-059` business logic, no fabricated record, no placeholder figure.
 * The surface states plainly that the module is not built rather than implying it is empty.
 */
export function ProductTabNotImplemented({ entity }: { readonly entity: string }): React.JSX.Element {
  return (
    <div
      data-testid="tab-not-implemented"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-card)',
        padding: '48px 28px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
        Not implemented in this stage
      </div>
      <div
        style={{
          fontSize: '12.5px',
          color: 'var(--color-text-secondary)',
          marginTop: 'var(--space-3)',
          maxWidth: '520px',
          margin: 'var(--space-3) auto 0',
        }}
      >
        {entity} has a ratified place in the Products workspace, but its module has not been built. Nothing is
        shown here because no business data exists.
      </div>
    </div>
  );
}
