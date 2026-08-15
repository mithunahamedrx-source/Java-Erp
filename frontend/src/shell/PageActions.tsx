import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * The ONE page-header action mechanism (`UX-016.b`).
 *
 * <p>🔴 The routed surface OWNS its actions; the shell owns their PLACEMENT. A page declares
 * what it can do and knows nothing about where that renders; the header renders it and knows
 * nothing about the module. Neither side may reach into the other.
 *
 * <p>🔴 This exists so no page hard-codes its own header position and no module-specific
 * placement lands inside `AppShell`. There is no `StockItemsHeaderActions` special case
 * anywhere — every future surface consumes this same hook (`UX-018.c`).
 *
 * <p>⚠ It carries a slot, not a policy. Ordering, geometry and the separator are
 * `DESIGN_CONSTITUTION.md` `§3.8`'s and are applied by `PageHeader`.
 */

type PageActionsState = {
  readonly actions: ReactNode;
  readonly setActions: (actions: ReactNode) => void;
};

const PageActionsContext = createContext<PageActionsState | null>(null);

export function PageActionsProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [actions, setActions] = useState<ReactNode>(null);
  const value = useMemo(() => ({ actions, setActions }), [actions]);
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>;
}

/**
 * Publishes this surface's page-level actions to the header.
 *
 * <p>The caller supplies its own dependency list, exactly as `useEffect` does — the actions
 * are a rendered node, so an automatic comparison would either re-publish on every render or
 * silently miss a permission change.
 *
 * <p>🔴 The slot is cleared on unmount, so navigating away can never leave one page's actions
 * standing above another page's content.
 */
export function usePageActions(actions: ReactNode, deps: readonly unknown[]): void {
  const context = useContext(PageActionsContext);
  const setActions = context?.setActions;

  useEffect(() => {
    if (!setActions) {
      return;
    }
    setActions(actions);
    return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActions, ...deps]);
}

/** Read side, for `PageHeader`. Returns `null` when the surface published nothing. */
export function usePublishedPageActions(): ReactNode {
  return useContext(PageActionsContext)?.actions ?? null;
}
