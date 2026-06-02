import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar, NAV_SECTIONS, ROUTE_PATHS } from './Sidebar';

/**
 * Component tests for the Sidebar navigation.
 *
 * Covers Requirements:
 * - 9.1: every support function plus the Unified Dashboard is present
 * - 9.2: items are grouped into the three required sections
 * - 9.3: the active route's item is highlighted distinctly (active class +
 *   aria-current) using react-router-dom v6 NavLink
 */

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders every support function plus the Unified Dashboard (Req 9.1)', () => {
    renderAt('/');

    const expectedLabels = [
      'Unified Dashboard',
      'Account Status Check',
      'Account 12-Hour Data',
      'Variable Data',
      'Reinvite',
      'OTP Reading',
      'WebSocket Monitor',
    ];

    for (const label of expectedLabels) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }

    // Exactly these links, no extras.
    expect(screen.getAllByRole('link')).toHaveLength(expectedLabels.length);
  });

  it('groups items into the three required sections (Req 9.2)', () => {
    renderAt('/');

    const sectionTitles = NAV_SECTIONS.map((s) => s.title);
    expect(sectionTitles).toEqual([
      'Account Operations',
      'Authentication Tools',
      'Real-Time Monitoring',
    ]);

    // Account Operations contains exactly the four account functions.
    const accountHeading = screen.getByRole('heading', {
      name: 'Account Operations',
    });
    const accountSection = accountHeading.parentElement as HTMLElement;
    const accountLinks = within(accountSection)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(accountLinks).toEqual([
      'Account Status Check',
      'Account 12-Hour Data',
      'Variable Data',
      'Reinvite',
    ]);

    // Authentication Tools contains only OTP Reading.
    const authHeading = screen.getByRole('heading', {
      name: 'Authentication Tools',
    });
    const authSection = authHeading.parentElement as HTMLElement;
    const authLinks = within(authSection)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(authLinks).toEqual(['OTP Reading']);

    // Real-Time Monitoring contains only the WebSocket Monitor.
    const monitorHeading = screen.getByRole('heading', {
      name: 'Real-Time Monitoring',
    });
    const monitorSection = monitorHeading.parentElement as HTMLElement;
    const monitorLinks = within(monitorSection)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(monitorLinks).toEqual(['WebSocket Monitor']);
  });

  it('highlights the active route distinctly via NavLink (Req 9.3)', () => {
    renderAt(ROUTE_PATHS.accountCheck);

    const activeLink = screen.getByRole('link', {
      name: 'Account Status Check',
    });
    expect(activeLink).toHaveClass('sidebar__link--active');
    expect(activeLink).toHaveAttribute('aria-current', 'page');

    // A non-active link must not carry the active styling.
    const inactiveLink = screen.getByRole('link', { name: 'Variable Data' });
    expect(inactiveLink).not.toHaveClass('sidebar__link--active');
    expect(inactiveLink).not.toHaveAttribute('aria-current');
  });

  it('does not mark the Unified Dashboard active for non-root routes (Req 9.3)', () => {
    renderAt(ROUTE_PATHS.otp);

    const dashboardLink = screen.getByRole('link', {
      name: 'Unified Dashboard',
    });
    expect(dashboardLink).not.toHaveClass('sidebar__link--active');

    const otpLink = screen.getByRole('link', { name: 'OTP Reading' });
    expect(otpLink).toHaveClass('sidebar__link--active');
  });

  it('marks only the Unified Dashboard active at the root route (Req 9.3)', () => {
    renderAt(ROUTE_PATHS.dashboard);

    const dashboardLink = screen.getByRole('link', {
      name: 'Unified Dashboard',
    });
    expect(dashboardLink).toHaveClass('sidebar__link--active');

    const activeLinks = screen
      .getAllByRole('link')
      .filter((l) => l.classList.contains('sidebar__link--active'));
    expect(activeLinks).toHaveLength(1);
  });
});
