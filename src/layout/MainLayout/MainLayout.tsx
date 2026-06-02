import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import { useAuth } from '../../context/AuthContext';
import { shouldRedirectToLogin } from '../../utils/routeGuard';
import { getSessionData } from '../../infrastructure/sessionStore';
import type { SessionData } from '../../types';
import './MainLayout.css';

/**
 * Main application shell.
 *
 * Composes the {@link Header}, {@link Sidebar}, and a content area, and guards
 * access to that shell:
 *
 *  - Route guard (Requirements 11.4, 11.5, 1.6): combines the AuthContext's
 *    `isAuthenticated` state with the pure {@link shouldRedirectToLogin}
 *    decision evaluated against the persisted session. When no usable,
 *    unexpired token exists the user is redirected to the login interface via
 *    react-router-dom v6's {@link Navigate}.
 *  - Viewport guard (Requirements 9.5, 9.6): the layout is desktop-optimized
 *    and renders without horizontal scrolling at >= 1024px; below that width a
 *    message advising the desktop minimum is shown instead of the shell.
 *
 * Nested routes are rendered through {@link Outlet}; an explicit `children`
 * prop is also supported (primarily for tests / non-router composition).
 */

/** Minimum viewport width (px) the application is optimized for (Req 9.5/9.6). */
export const DESKTOP_MIN_WIDTH = 1024;

/** Path of the login interface used by the route-guard redirect. */
const LOGIN_PATH = '/login';

/** Message shown when the viewport is narrower than {@link DESKTOP_MIN_WIDTH}. */
export const DESKTOP_ONLY_MESSAGE =
  'RITA Adobe is optimized for desktop screens with a minimum width of 1024 pixels. Please widen your window or switch to a larger display.';

/**
 * Tracks whether the current viewport is at least `minWidth` wide, updating on
 * window resize. Defaults to "desktop" when `window` is unavailable (SSR) so
 * the shell is not suppressed in non-browser environments.
 */
function useIsDesktopViewport(minWidth: number = DESKTOP_MIN_WIDTH): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= minWidth,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = (): void => {
      setIsDesktop(window.innerWidth >= minWidth);
    };

    // Sync immediately in case the width changed before the listener attached.
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minWidth]);

  return isDesktop;
}

/** Props for {@link MainLayout}. */
export interface MainLayoutProps {
  /**
   * Content to render in the content area. Defaults to the router
   * {@link Outlet} so nested routes render in place.
   */
  children?: ReactNode;
  /**
   * Reads the current persisted session for the route-guard decision. Defaults
   * to the session-store `getSessionData`; injectable for testing.
   */
  getSession?: () => SessionData | null;
  /**
   * Reference time (Unix ms) used to evaluate token expiry. Defaults to the
   * current time inside {@link shouldRedirectToLogin}; injectable for testing.
   */
  now?: number;
}

/**
 * The authenticated application shell with route and viewport guards.
 *
 * Must be rendered within an `AuthProvider` and a react-router `Router`.
 */
export function MainLayout({
  children,
  getSession = getSessionData,
  now,
}: MainLayoutProps) {
  const { isAuthenticated } = useAuth();
  const isDesktop = useIsDesktopViewport();

  // Route guard (Requirements 1.6, 11.4, 11.5): redirect when the context
  // reports no authenticated session OR the persisted session is missing /
  // tokenless / expired. Combining both means a token that expires while the
  // app is open (re-evaluated against `now`) still forces re-authentication.
  if (!isAuthenticated || shouldRedirectToLogin(getSession(), now)) {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  // Viewport guard (Requirements 9.5, 9.6): below the desktop minimum width,
  // show the advisory message instead of the (horizontally-scrolling) shell.
  if (!isDesktop) {
    return (
      <div className="main-layout__viewport-guard" role="alert">
        <p className="main-layout__viewport-guard-text">
          {DESKTOP_ONLY_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div className="main-layout">
      <Header />
      <div className="main-layout__body">
        <Sidebar />
        <main className="main-layout__content">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

export default MainLayout;
