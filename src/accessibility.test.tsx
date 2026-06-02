/// <reference path="./types/jest-axe.d.ts" />
import { cleanup, render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ConfirmDialog } from './components/ConfirmDialog';
import { EmailInput } from './components/EmailInput';

/**
 * Accessibility tests (task 18.3).
 *
 * Runs jest-axe against key components to catch WCAG violations, asserts ARIA
 * labelling on inputs (Req 9.1 — accessible navigation/forms), and verifies
 * focus management in the ConfirmDialog (Req 10.6 / design accessibility
 * requirements).
 *
 * Note: automated axe checks are necessary but not sufficient for full WCAG
 * conformance — manual testing with assistive technologies and expert review
 * are still required.
 */

expect.extend(toHaveNoViolations);

afterEach(cleanup);

describe('Accessibility - axe checks', () => {
  it('an open ConfirmDialog has no detectable accessibility violations', async () => {
    const { container } = render(
      <ConfirmDialog
        isOpen
        title="Confirm Reinvite"
        message="Send a reinvite to user@example.com?"
        confirmLabel="Send Reinvite"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('EmailInput exposes an accessible label for its input (Req 9.1)', () => {
    render(
      <EmailInput
        value=""
        onChange={jest.fn()}
        onValidationChange={jest.fn()}
      />,
    );

    // The input is reachable by its ARIA label, which screen readers announce.
    expect(
      screen.getByRole('textbox', { name: 'Email address' }),
    ).toBeInTheDocument();
  });
});

describe('Accessibility - ConfirmDialog focus management (Req 10.6)', () => {
  it('moves focus to the confirm button when opened', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Confirm Reinvite"
        message="Send a reinvite to user@example.com?"
        confirmLabel="Send Reinvite"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Send Reinvite' });
    expect(confirmButton).toHaveFocus();
  });

  it('exposes dialog semantics (role, modal, labelledby/describedby)', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Confirm Reinvite"
        message="Send a reinvite to user@example.com?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });
});
