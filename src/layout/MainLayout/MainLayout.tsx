import { useEffect, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import './MainLayout.css';

/**
 * Main application shell.
 *
 * Composes the {@link Header}, {@link Sidebar}, and a content area.
 *
 *  - Viewport guard (Requirements 9.5, 9.6): the layout is desktop-optimized
 *    and renders without horizontal scrolling at >= 1024px; below that width a
 *    message advising the desktop minimum is shown instead of the shell.
 *
 * There is no authentication gate — every route is publicly reachable. Nested
 * routes are rendered through {@link Outlet}; an explicit `children` prop is
 * also supported (primarily for tests / non-router composition).
 */

/** Minimum viewport width (px) the application is optimized for (Req 9.5/9.6). */
export const DESKTOP_MIN_WIDTH = 1024;

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
}

/**
 * The application shell with the desktop-only viewport guard.
 *
 * Must be rendered within a react-router `Router`.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const isDesktop = useIsDesktopViewport();

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
