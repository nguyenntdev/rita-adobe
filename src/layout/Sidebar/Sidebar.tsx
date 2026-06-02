import { NavLink } from 'react-router-dom';
import './Sidebar.css';

/**
 * Sidebar navigation.
 *
 * Implements the navigation structure described in the design document and
 * Requirements 9.1–9.3:
 *  - 9.1: exposes every support function (Account Status Check, Account
 *    12-Hour Data, Variable Data, Reinvite, OTP Reading, Real-Time Monitoring)
 *    plus the Unified Dashboard.
 *  - 9.2: groups the function links into three sections (Account Operations,
 *    Authentication Tools, Real-Time Monitoring). The Unified Dashboard sits
 *    above the grouped sections as a top-level entry point.
 *  - 9.3: highlights the active route distinctly via a dedicated active class
 *    driven by react-router-dom v6's NavLink `isActive` state.
 */

/** Canonical route paths used by the sidebar and (later) the router. */
export const ROUTE_PATHS = {
  dashboard: '/',
  accountCheck: '/account/check',
  account12h: '/account/12h',
  variables: '/account/variables',
  reinvite: '/account/reinvite',
  otp: '/otp',
  monitor: '/monitor',
} as const;

/** A single navigable destination in the sidebar. */
export interface NavItem {
  /** Human-readable label shown in the sidebar. */
  label: string;
  /** Route path the item navigates to. */
  path: string;
  /**
   * When true, the link is only active on an exact path match. Used for the
   * Unified Dashboard at "/" so it is not treated as active for every route.
   */
  end?: boolean;
}

/** A labelled group of navigation items. */
export interface NavSection {
  /** Heading displayed above the section's items. */
  title: string;
  /** Items belonging to this section. */
  items: NavItem[];
}

/**
 * Top-level entry that sits above the grouped sections (Requirement 9.1).
 */
export const DASHBOARD_ITEM: NavItem = {
  label: 'Unified Dashboard',
  path: ROUTE_PATHS.dashboard,
  end: true,
};

/**
 * The three navigation sections (Requirement 9.2). Order and membership match
 * the design document and acceptance criteria exactly.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Account Operations',
    items: [
      { label: 'Account Status Check', path: ROUTE_PATHS.accountCheck },
      { label: 'Account 12-Hour Data', path: ROUTE_PATHS.account12h },
      { label: 'Variable Data', path: ROUTE_PATHS.variables },
      { label: 'Reinvite', path: ROUTE_PATHS.reinvite },
    ],
  },
  {
    title: 'Authentication Tools',
    items: [{ label: 'OTP Reading', path: ROUTE_PATHS.otp }],
  },
  {
    title: 'Real-Time Monitoring',
    items: [{ label: 'WebSocket Monitor', path: ROUTE_PATHS.monitor }],
  },
];

/**
 * Builds the className for a nav link, applying the active modifier when the
 * route matches (Requirement 9.3). NavLink also sets `aria-current="page"` on
 * the active link automatically, which is asserted in tests.
 */
function linkClassName({ isActive }: { isActive: boolean }): string {
  return ['sidebar__link', isActive ? 'sidebar__link--active' : '']
    .filter(Boolean)
    .join(' ');
}

/**
 * The application sidebar. Renders the Unified Dashboard entry followed by the
 * three grouped sections, using NavLink for navigation and active highlighting.
 */
export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Primary navigation">
      <ul className="sidebar__list sidebar__list--top">
        <li>
          <NavLink
            to={DASHBOARD_ITEM.path}
            end={DASHBOARD_ITEM.end}
            className={linkClassName}
          >
            {DASHBOARD_ITEM.label}
          </NavLink>
        </li>
      </ul>

      {NAV_SECTIONS.map((section) => (
        <div className="sidebar__section" key={section.title}>
          <h2 className="sidebar__section-title">{section.title}</h2>
          <ul className="sidebar__list">
            {section.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  className={linkClassName}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default Sidebar;
