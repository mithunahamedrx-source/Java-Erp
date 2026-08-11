import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * The ONE routed-content transition, applied at the application content boundary.
 *
 * <p>It wraps the router outlet inside `<main>`, so every routed module page inherits it
 * automatically and forever. 🔴 No page implements its own entrance animation, and no
 * route-specific or module-specific transition exists anywhere in the application.
 *
 * <p>Only the CONTENT changes. The stable shell — sidebar, brand block, user card, header
 * utilities — sits outside this boundary and never animates.
 *
 * <p>The `key` is the pathname, so React remounts the subtree on navigation and the CSS
 * animation replays. 🔴 Navigation itself is never delayed and no data, request or state
 * depends on the animation: it is presentation applied to content that has already arrived.
 *
 * <p>Timing and easing live in ONE place — `.page-content-transition` in `index.css`, which
 * also carries the `prefers-reduced-motion` fallback.
 */
export default function PageContentTransition({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-content-transition" data-testid="page-content-transition">
      {children}
    </div>
  );
}
