import { useTheme } from '../../context/ThemeContext';
import { Icon } from '../Icon/Icon';
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
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}

export default ThemeToggle;
