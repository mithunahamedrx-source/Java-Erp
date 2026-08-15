import { NavLink } from 'react-router-dom';
import { MODULE_ICON, NAV_ICON_SIZE } from './icons';
import { childRowStyle, moduleIconAppearance, topLevelRowStyle } from './navigationAppearance';

/**
 * The ONE navigation destination component.
 *
 * <p>Both shapes of destination render through here:
 *
 * <ul>
 *   <li><b>top-level</b> — a direct leaf under a section (`Dashboard`, `Reports`): full
 *       `34px` row with its semantic module icon and no disclosure control, because it has no
 *       children to disclose;</li>
 *   <li><b>child</b> — a destination inside a group: `28px`, indented, no icon (§3.7).</li>
 * </ul>
 *
 * <p>🔴 Active styling is resolved by `navigationAppearance`, never inline and never per
 * module. There is no route-specific navigation styling anywhere in the application.
 */
export default function NavigationDestination({
  label,
  path,
  variant,
  focusable = true,
}: {
  readonly label: string;
  readonly path: string;
  readonly variant: 'top-level' | 'child';
  /**
   * Children inside a collapsed group stay in the DOM so the disclosure can animate, but they
   * must not be reachable by keyboard while hidden.
   */
  readonly focusable?: boolean;
}): React.JSX.Element {
  const Icon = variant === 'top-level' ? MODULE_ICON[label] : undefined;

  return (
    <NavLink
      to={path}
      data-testid={variant === 'top-level' ? `nav-leaf-${label}` : `nav-child-${label}`}
      tabIndex={focusable ? undefined : -1}
      /*
        🔴 `RULE 3.21.d` — the shared state transition, so a row's emphasis ARRIVES rather
        than snapping. Colour only: nothing here animates size or position, so the nav list
        never moves while an operator is reading it.
      */
      className="state-transition"
      style={({ isActive }) => (variant === 'top-level' ? topLevelRowStyle(isActive) : childRowStyle(isActive))}
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          {Icon && (
            <Icon
              size={NAV_ICON_SIZE}
              {...moduleIconAppearance(isActive)}
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
