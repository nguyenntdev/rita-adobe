import './ActionButton.css';

/**
 * Props for {@link ActionButton}.
 *
 * Mirrors the `ActionButtonProps` interface defined in the design document.
 */
export interface ActionButtonProps {
  /** Text shown on the button. */
  label: string;
  /** Invoked when the (enabled) button is clicked. */
  onClick: () => void;
  /**
   * When true, the button renders a loading spinner and is disabled until the
   * in-flight operation completes.
   */
  loading?: boolean;
  /** When true, the button is disabled regardless of loading state. */
  disabled?: boolean;
  /** Visual style of the button. Defaults to `primary`. */
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * A button with built-in loading and disabled handling.
 *
 * The button is disabled whenever `loading` is true OR `disabled` is set, which
 * means a click handler cannot fire while a request is in progress. A spinner
 * is shown alongside the label while loading.
 */
export function ActionButton({
  label,
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
}: ActionButtonProps) {
  const isDisabled = loading || disabled;

  const className = [
    'action-button',
    `action-button--${variant}`,
    loading ? 'action-button--loading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      aria-disabled={isDisabled}
    >
      {loading && (
        <span
          className="action-button__spinner"
          role="status"
          aria-label="Loading"
          data-testid="action-button-spinner"
        />
      )}
      <span className="action-button__label">{label}</span>
    </button>
  );
}

export default ActionButton;
