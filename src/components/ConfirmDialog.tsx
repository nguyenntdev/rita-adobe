import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

/**
 * Props for the {@link ConfirmDialog} modal.
 *
 * Mirrors the `ConfirmDialogProps` interface in design.md.
 */
export interface ConfirmDialogProps {
  /** Whether the dialog is currently shown. When false, nothing is rendered. */
  isOpen: boolean;
  /** Heading text describing the action requiring confirmation. */
  title: string;
  /** Body text, typically identifying the subject of the action. */
  message: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Invoked when the user confirms the action. */
  onConfirm: () => void;
  /** Invoked when the user cancels (button, Escape key, or backdrop click). */
  onCancel: () => void;
}

/**
 * Returns all focusable elements inside a container, in document order.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Accessible modal dialog for confirming or cancelling an action.
 *
 * Implements focus management per the design's accessibility requirements:
 * - On open, focus moves to the confirm button.
 * - Tab / Shift+Tab are trapped within the dialog.
 * - Escape triggers {@link ConfirmDialogProps.onCancel}.
 * - On close, focus is restored to the element that was focused before opening.
 *
 * Requirements: 5.2 (confirmation dialog), 5.7 (cancel aborts the operation).
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  // Element focused immediately before the dialog opened, restored on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Manage focus capture on open and restoration on close.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Move focus into the dialog (confirm button) once mounted.
    confirmButtonRef.current?.focus();

    return () => {
      // Restore focus to the trigger element when the dialog closes.
      previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      // Trap focus within the dialog.
      const container = dialogRef.current;
      if (!container) {
        return;
      }

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onCancel],
  );

  if (!isOpen) {
    return null;
  }

  const titleId = 'confirm-dialog-title';
  const messageId = 'confirm-dialog-message';

  return (
    <div
      data-testid="confirm-dialog-backdrop"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={handleKeyDown}
        // Stop backdrop click handler firing when interacting with the dialog.
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          padding: '1.5rem',
          minWidth: 320,
          maxWidth: 480,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
        }}
      >
        <h2 id={titleId} style={{ marginTop: 0 }}>
          {title}
        </h2>
        <p id={messageId}>{message}</p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '1.5rem',
          }}
        >
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
