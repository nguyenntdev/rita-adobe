import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLayout, DESKTOP_ONLY_MESSAGE } from './MainLayout';
import { APP_NAME } from '../Header';

/**
 * Component tests for the MainLayout.
 *
 * The app has no authentication gate, so the layout only enforces the
 * desktop-only viewport guard (Requirements 9.5, 9.6) and composes the shell
 * (Header + Sidebar + routed content).
 */

/** Set the jsdom viewport width and notify listeners. */
function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

function renderLayout(width = 1280) {
  setViewportWidth(width);

  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<div>Dashboard content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  setViewportWidth(1024);
});

describe('MainLayout', () => {
  it('renders Header, Sidebar, and content on desktop (Req 9.5)', () => {
    renderLayout();

    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('renders the desktop-only message below 1024px (Req 9.6)', () => {
    renderLayout(800);

    expect(screen.getByRole('alert')).toHaveTextContent(DESKTOP_ONLY_MESSAGE);
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
    expect(screen.queryByText(APP_NAME)).not.toBeInTheDocument();
  });

  it('renders the shell at exactly 1024px (Req 9.5)', () => {
    renderLayout(1024);

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('switches to the desktop-only message when the viewport shrinks (Req 9.6)', () => {
    renderLayout(1280);

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();

    act(() => {
      setViewportWidth(700);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(DESKTOP_ONLY_MESSAGE);
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });
});
