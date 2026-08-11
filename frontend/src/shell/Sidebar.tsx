import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NAVIGATION, isGroup, visibleChildren, canSee } from './navigation';
import type { NavItem } from './navigation';
import ApplicationBrand from './ApplicationBrand';
import NavigationGroup from './NavigationGroup';
import NavigationDestination from './NavigationDestination';
import SidebarUserCard from './SidebarUserCard';
import { sectionLabelStyle } from './navigationAppearance';

const EXPANSION_STORAGE_KEY = 'trioloo.nav.expanded';

function readPersistedExpansion(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(EXPANSION_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * The ONE application sidebar.
 *
 * <p>Composition, top to bottom (§3.7):
 *
 * <pre>
 *   SIDEBAR
 *   ├─ Fixed brand region        ApplicationBrand   - never scrolls
 *   ├─ Scrollable navigation     &lt;nav&gt;              - the ONLY scrolling region
 *   └─ Fixed user card           SidebarUserCard    - never scrolls away
 * </pre>
 *
 * <p>Brand and user card are `flex-shrink: 0`; the nav takes the remaining height and scrolls
 * inside itself. Its visible scrollbar chrome is hidden by the shared `.erp-scroll` treatment
 * — scrolling itself is completely intact.
 *
 * <p>This component owns only STRUCTURE and DISCLOSURE STATE. Row appearance lives in
 * `navigationAppearance`, group behaviour in `NavigationGroup`, destinations in
 * `NavigationDestination`, icons in `icons.ts`. 🔴 There is exactly one sidebar implementation
 * in the codebase and modules never build their own.
 */
export default function Sidebar({ permissions }: { readonly permissions: readonly string[] }): React.JSX.Element {
  const location = useLocation();

  const activeGroupLabel = useMemo(() => {
    const match = NAVIGATION.find(
      (item) => isGroup(item) && item.children.some((c) => location.pathname.startsWith(c.path)),
    );
    return match?.label ?? null;
  }, [location.pathname]);

  /**
   * Explicit disclosure state, per group.
   *
   * `UX-026.f` — disclosure belongs to the OPERATOR. This records what the operator chose;
   * active-route logic may only fill in a group it has no choice recorded for.
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => readPersistedExpansion());
  const previousActiveGroup = useRef<string | null>(null);

  /**
   * `UX-026.f` — a route change auto-opens the NEWLY active group, and only when it has
   * actually changed. 🔴 It never re-opens a group the operator just deliberately closed,
   * which is exactly the defect the amendment removed: without the ref guard, every re-render
   * would override the operator's collapse.
   */
  useEffect(() => {
    if (activeGroupLabel && activeGroupLabel !== previousActiveGroup.current) {
      setExpanded((current) => ({ ...current, [activeGroupLabel]: true }));
    }
    previousActiveGroup.current = activeGroupLabel;
  }, [activeGroupLabel]);

  // UX-028 - expansion is client view state, persisted for convenience only. It carries no
  // authority and losing it must never break navigation.
  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANSION_STORAGE_KEY, JSON.stringify(expanded));
    } catch {
      /* Persistence is a convenience. Failure is not an error. */
    }
  }, [expanded]);

  const toggle = useCallback((label: string) => {
    setExpanded((current) => ({ ...current, [label]: !current[label] }));
  }, []);

  const renderItem = (item: NavItem): React.JSX.Element | null => {
    if (isGroup(item)) {
      const children = visibleChildren(item, permissions);

      // UX-027.b - a group whose children are all hidden renders NOTHING at all.
      if (children.length === 0) {
        return null;
      }

      return (
        <NavigationGroup
          key={item.label}
          label={item.label}
          destinations={children}
          isActive={item.label === activeGroupLabel}
          isExpanded={expanded[item.label] === true}
          onToggle={() => toggle(item.label)}
        />
      );
    }

    if (!canSee(item, permissions)) {
      return null;
    }
    return <NavigationDestination key={item.path} label={item.label} path={item.path} variant="top-level" />;
  };

  const main = NAVIGATION.filter((i) => i.section === 'MAIN');
  const admin = NAVIGATION.filter((i) => i.section === 'ADMIN');

  return (
    <aside
      data-testid="sidebar"
      style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border-card)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <ApplicationBrand />

      {/* The ONLY scrolling region of the sidebar. */}
      <nav className="erp-scroll" data-testid="sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        <div style={sectionLabelStyle(true)}>Main</div>
        {main.map(renderItem)}
        <div style={sectionLabelStyle(false)}>Admin</div>
        {admin.map(renderItem)}
      </nav>

      <SidebarUserCard />
    </aside>
  );
}
