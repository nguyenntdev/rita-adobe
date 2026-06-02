import { useEffect, useState } from 'react';

import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastContainer } from './components/ToastNotification';
import { DashboardPage } from './pages/DashboardPage';
import { vi } from './i18n/vi';

/** Minimum viewport width (px) the dashboard is optimized for. */
const DESKTOP_MIN_WIDTH = 1024;

/**
 * Tracks whether the viewport is at least `minWidth` wide, updating on resize.
 * Defaults to desktop when `window` is unavailable (SSR/tests).
 */
function useIsDesktopViewport(minWidth = DESKTOP_MIN_WIDTH): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= minWidth,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const onResize = () => setIsDesktop(window.innerWidth >= minWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [minWidth]);

  return isDesktop;
}

/**
 * Root application component.
 *
 * A single Vietnamese-first dashboard (no login, no routing). Composition:
 * ThemeProvider → NotificationProvider, with the toast container mounted
 * alongside the dashboard. Below 1024px a desktop-only advisory is shown.
 */
function App() {
  const isDesktop = useIsDesktopViewport();

  return (
    <ThemeProvider>
      <NotificationProvider>
        <ToastContainer />
        {isDesktop ? (
          <DashboardPage />
        ) : (
          <div className="viewport-guard" role="alert">
            <p>{vi.viewport.desktopOnly}</p>
          </div>
        )}
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
