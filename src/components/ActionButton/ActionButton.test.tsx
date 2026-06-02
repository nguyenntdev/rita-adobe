import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionButton } from './ActionButton';

describe('ActionButton', () => {
  it('renders the provided label', () => {
    render(<ActionButton label="Check Status" onClick={() => {}} />);
    expect(
      screen.getByRole('button', { name: /check status/i }),
    ).toBeInTheDocument();
  });

  it('calls onClick when enabled and clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<ActionButton label="Submit" onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and shows a spinner while loading', () => {
    render(<ActionButton label="Submit" onClick={() => {}} loading />);

    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('action-button-spinner')).toBeInTheDocument();
  });

  it('does not call onClick while loading', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<ActionButton label="Submit" onClick={onClick} loading />);

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('is disabled when disabled prop is set', () => {
    render(<ActionButton label="Submit" onClick={() => {}} disabled />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<ActionButton label="Submit" onClick={onClick} disabled />);

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not render a spinner when not loading', () => {
    render(<ActionButton label="Submit" onClick={() => {}} />);
    expect(
      screen.queryByTestId('action-button-spinner'),
    ).not.toBeInTheDocument();
  });

  it('defaults to the primary variant', () => {
    render(<ActionButton label="Submit" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /submit/i })).toHaveClass(
      'action-button--primary',
    );
  });

  it.each(['primary', 'secondary', 'danger'] as const)(
    'applies the %s variant class',
    (variant) => {
      render(
        <ActionButton label="Submit" onClick={() => {}} variant={variant} />,
      );
      expect(screen.getByRole('button', { name: /submit/i })).toHaveClass(
        `action-button--${variant}`,
      );
    },
  );
});
