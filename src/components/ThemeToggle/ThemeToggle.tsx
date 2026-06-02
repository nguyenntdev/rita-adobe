import { useTheme } from '../../context/ThemeContext';
import { vi } from '../../i18n/vi';

/**
 * Icon button that toggles between the light and dark themes.
 *
 * Shows a moon in light mode (switch to dark) and a sun in dark mode (switch to
 * light), with a Vietnamese accessible label describing the resulting theme.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? vi.theme.toLight : vi.theme.toDark}
      title={isDark ? vi.theme.toLight : vi.theme.toDark}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}

export default ThemeToggle;
