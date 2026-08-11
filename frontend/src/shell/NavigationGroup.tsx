import {
  CHEVRON_SIZE,
  CHEVRON_STROKE,
  DISCLOSURE_GLYPH,
  DISCLOSURE_ROTATION,
  MODULE_ICON,
  NAV_ICON_SIZE,
} from './icons';
import { moduleIconAppearance, topLevelRowStyle } from './navigationAppearance';
import NavigationDestination from './NavigationDestination';
import type { NavDestination } from './navigation';

/**
 * The ONE folding navigation group.
 *
 * <p>Every group in the sidebar — present and future — renders through this component. 🔴 No
 * module implements its own folding behaviour, its own chevron or its own active styling.
 *
 * <p>`UX-026.d` — the parent is a DISCLOSURE CONTROL, never a destination. It is a real
 * `<button>` carrying `aria-expanded`, so keyboard and assistive technology get the same
 * affordance the pointer does.
 *
 * <p>`UX-026.f` — disclosure belongs to the OPERATOR. First activation opens, the next closes,
 * including for the group that owns the current page. The active parent stays visually active
 * while collapsed, so the operator never loses which group owns the page they are on.
 */
export default function NavigationGroup({
  label,
  destinations,
  isActive,
  isExpanded,
  onToggle,
}: {
  readonly label: string;
  readonly destinations: readonly NavDestination[];
  /** True when the current route belongs to this group. */
  readonly isActive: boolean;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  const Icon = MODULE_ICON[label];

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        data-testid={`nav-group-${label}`}
        data-active={isActive ? 'true' : 'false'}
        style={{ ...topLevelRowStyle(isActive), border: 'none', cursor: 'pointer' }}
      >
        {Icon && (
          <Icon size={NAV_ICON_SIZE} {...moduleIconAppearance(isActive)} style={{ flexShrink: 0 }} aria-hidden="true" />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <DisclosureChevron expanded={isExpanded} />
      </button>

      {/*
        The disclosure region.

        Animated with grid-template-rows 0fr -> 1fr, which produces no layout jump and -
        unlike a transform - never resamples text, so labels stay sharp throughout
        (RULE 15.3 forbids transform-scaled text). Timing lives in ONE place: the
        `.nav-disclosure` rule in index.css.
      */}
      <div
        className="nav-disclosure"
        data-testid={`nav-disclosure-${label}`}
        data-expanded={isExpanded ? 'true' : 'false'}
        style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', opacity: isExpanded ? 1 : 0 }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {destinations.map((child) => (
            <NavigationDestination
              key={child.path}
              label={child.label}
              path={child.path}
              variant="child"
              focusable={isExpanded}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The ONE disclosure chevron.
 *
 * <p>A thin OUTLINE chevron from the same `lucide-react` family as the module icons — never a
 * filled triangle, never a heavy arrow, never a sideways chevron, and never a different glyph
 * per module. ONE glyph is ROTATED for state.
 *
 * <p>🔴 Business-approved direction: <b>CLOSED points DOWN</b>, <b>OPEN points UP</b>.
 *
 * <p>It sits at the far right of the parent row (`margin-left: auto`) and is deliberately
 * lighter than the module icon — smaller at `14px`, thin `1.5px` stroke, in the secondary nav
 * icon colour, and it does NOT take the ink active colour, so it can never compete with the
 * module icon for attention.
 */
function DisclosureChevron({ expanded }: { readonly expanded: boolean }): React.JSX.Element {
  const Glyph = DISCLOSURE_GLYPH;
  return (
    <Glyph
      size={CHEVRON_SIZE}
      strokeWidth={CHEVRON_STROKE}
      color="var(--color-icon-stroke-nav)"
      aria-hidden="true"
      data-testid="nav-chevron"
      data-direction={expanded ? 'up' : 'down'}
      className="nav-chevron"
      style={{
        marginLeft: 'auto',
        flexShrink: 0,
        transform: expanded ? DISCLOSURE_ROTATION.open : DISCLOSURE_ROTATION.closed,
      }}
    />
  );
}
