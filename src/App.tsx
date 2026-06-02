import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/ToastNotification';
import { MainLayout } from './layout/MainLayout';
import { ROUTE_PATHS } from './layout/Sidebar/Sidebar';

import { DashboardPage } from './pages/DashboardPage';
import { AccountCheckPage } from './pages/AccountCheckPage';
import { Account12hPage } from './pages/Account12hPage';
import { VariablePage } from './pages/VariablePage';
import { ReinvitePage } from './pages/ReinvitePage';
import { OTPPage } from './pages/OTPPage';
import { MonitorPage } from './pages/MonitorPage';

/**
 * Root application component.
 *
 * Composition order (outer → inner): NotificationProvider → Router. The
 * {@link ToastContainer} sits inside the NotificationProvider so it can render
 * queued notifications, and outside the routed content so toasts persist across
 * navigation.
 *
 * There is no login gate: every page is reachable directly under
 * {@link MainLayout}, which renders the matched page through its `Outlet`.
 * Unknown paths fall back to the dashboard.
 */
function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <ToastContainer />
        <Routes>
          <Route element={<MainLayout />}>
            <Route path={ROUTE_PATHS.dashboard} element={<DashboardPage />} />
            <Route
              path={ROUTE_PATHS.accountCheck}
              element={<AccountCheckPage />}
            />
            <Route path={ROUTE_PATHS.account12h} element={<Account12hPage />} />
            <Route path={ROUTE_PATHS.variables} element={<VariablePage />} />
            <Route path={ROUTE_PATHS.reinvite} element={<ReinvitePage />} />
            <Route path={ROUTE_PATHS.otp} element={<OTPPage />} />
            <Route path={ROUTE_PATHS.monitor} element={<MonitorPage />} />
          </Route>

          <Route
            path="*"
            element={<Navigate to={ROUTE_PATHS.dashboard} replace />}
          />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
