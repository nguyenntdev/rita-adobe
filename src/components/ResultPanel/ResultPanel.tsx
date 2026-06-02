import type { ReactNode } from 'react';
import './ResultPanel.css';

/**
 * Props for {@link ResultPanel}.
 *
 * Mirrors the `ResultPanelProps` interface defined in the design document.
 */
export interface ResultPanelProps {
  /** Heading shown at the top of the panel. */
  title: string;
  /** When true, the panel shows a loading indicator instead of its body. */
  loading?: boolean;
  /** When set (and not loading), the panel shows this error message. */
  error?: string;
  /** Success content rendered when the panel is neither loading nor errored. */
  children: ReactNode;
}

/**
 * Generic panel for displaying operation results.
 *
 * The panel always renders its {@link ResultPanelProps.title}. Below the title
 * it renders exactly one of three mutually exclusive states, in priority order:
 *
 * 1. **Loading** - when `loading` is true, a status indicator is shown. Loading
 *    takes precedence so a stale error or previous result is never shown while a
 *    new operation is in flight.
 * 2. **Error** - when `loading` is false and `error` is a non-empty string, the
 *    error message is shown with an alert role for assistive technologies.
 * 3. **Success** - otherwise the panel renders `children` (the operation result).
 *
 * Used by the account, 12-hour, variable, and dashboard panels to present
 * success results and API error messages (Requirements 2.3, 3.3, 4.3, 12.3, 12.4).
 */
export function ResultPanel({
  title,
  loading = false,
  error,
  children,
}: ResultPanelProps) {
  const hasError = !loading && typeof error === 'string' && error.length > 0;

  return (
    <section className="result-panel" aria-label={title}>
      <h2 className="result-panel__title">{title}</h2>
      <div className="result-panel__body">
        {loading ? (
          <div
            className="result-panel__loading"
            role="status"
            aria-live="polite"
          >
            <span className="result-panel__spinner" aria-hidden="true" />
            <span className="result-panel__loading-label">Đang tải…</span>
          </div>
        ) : hasError ? (
          <div className="result-panel__error" role="alert">
            {error}
          </div>
        ) : (
          <div className="result-panel__content">{children}</div>
        )}
      </div>
    </section>
  );
}

export default ResultPanel;
