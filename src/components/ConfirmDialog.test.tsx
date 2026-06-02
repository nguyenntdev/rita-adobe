import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog', () => {
  it('renders title and message when open', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Reinvite account"
        message="Send a new invitation to user@example.com?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /reinvite account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/send a new invitation to user@example\.com/i),
    ).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Reinvite account"
        message="Send a new invitation?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses default confirm/cancel labels and exposes them as overrides', () => {
    const { rerender } = render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Confirm' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    rerender(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        confirmLabel="Send invite"
        cancelLabel="Abort"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Send invite' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
  });

  it('invokes onConfirm when the confirm button is clicked', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('invokes onCancel when the cancel button is clicked', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('invokes onCancel when the backdrop is clicked', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByTestId('confirm-dialog-backdrop'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onCancel when clicking inside the dialog body', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('dialog'));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('invokes onCancel when Escape is pressed', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the confirm button when opened', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
  });

  it('traps focus within the dialog when tabbing', async () => {
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    expect(confirmButton).toHaveFocus();

    // Tab from the last focusable element wraps back to the first.
    await user.tab();
    expect(cancelButton).toHaveFocus();

    // Shift+Tab from the first wraps to the last.
    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();
  });

  it('restores focus to the trigger element when closed', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <ConfirmDialog
            isOpen={open}
            title="Title"
            message="Message"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('exposes accessible dialog semantics', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Reinvite account"
        message="Send a new invitation?"
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
