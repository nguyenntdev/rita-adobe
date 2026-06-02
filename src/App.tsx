import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastContainer } from './components/ToastNotification';
import { DashboardPage } from './pages/DashboardPage';

/**
 * Root application component.
 *
 * A single Vietnamese-first dashboard (no login, no routing). Composition:
 * ThemeProvider → NotificationProvider, with the toast container mounted
 * alongside the dashboard. The layout is fully responsive across phone, tablet,
 * and desktop.
 */
function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ToastContainer />
        <DashboardPage />
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
