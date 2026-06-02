import { useCallback, useState } from 'react';

import ActionButton from '../../components/ActionButton';
import EmailInput from '../../components/EmailInput';
import KeyValueDisplay from '../../components/KeyValueDisplay';
import ResultPanel from '../../components/ResultPanel';
import { useNotifications } from '../../context/NotificationContext';
import { ERROR_MESSAGES } from '../../infrastructure/httpClient';
import { checkAccount } from '../../services/accountService';

/**
 * Account Status Check page (design "AccountCheckPage", task 14.3).
 *
 * Wires the shared {@link EmailInput}, {@link ActionButton}, {@link ResultPanel},
 * and {@link KeyValueDisplay} components to {@link checkAccount} from the account
 * service.
 *
 * Behaviour (Requirements 2.1, 2.3, 2.4, 2.6):
 *   - 2.1: an email input field (max 254 chars, enforced by `EmailInput`) drives
 *     the lookup.
 *   - 2.3: a successful check renders every field returned by the API in a
 *     labeled key-value format via `KeyValueDisplay`.
 *   - 2.4: a failed check renders the API failure reason in the result panel and
 *     raises an error toast naming the operation (Requirement 10.3).
 *   - 2.6: a timeout (the 30s HTTP client timeout surfaces
 *     {@link ERROR_MESSAGES.timeout}) shows the timeout message and an explicit
 *     Retry control that re-issues the request.
 *
 * The "Check Status" button is enabled iff the email is valid AND no request is
 * in progress (Requirements 8.4, 10.1 via `ActionButton` + `isEmailValid`).
 */
export function AccountCheckPage() {
  const { showSuccess, showError } = useNotifications();

  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  /**
   * Run the account status check for the current email. Used both by the
   * primary action button and the Retry control (Requirement 2.6).
   */
  const runCheck = useCallback(async () => {
    setLoading(true);
    // Clear any prior outcome so stale results/errors are never shown beside a
    // new in-flight request.
    setError(undefined);
    setResult(null);

    const outcome = await checkAccount(email);

    if (outcome.success) {
      setResult(outcome.data ?? {});
      setError(undefined);
      showSuccess('Account status check completed.');
    } else {
      const reason = outcome.error ?? ERROR_MESSAGES.generic;
      setResult(null);
      setError(reason);
      showError(`Account status check failed: ${reason}`);
    }

    setLoading(false);
  }, [email, showError, showSuccess]);

  // When the email changes, drop any prior result/error so the panel never
  // shows another account's data next to the new address.
  const handleEmailChange = useCallback((next: string) => {
    setEmail(next);
    setResult(null);
    setError(undefined);
  }, []);

  // Distinguish a timeout from other failures so we can surface an explicit
  // Retry affordance per Requirement 2.6 (other errors are also retryable, but
  // timeout is the one the requirement calls out).
  const isTimeout = error === ERROR_MESSAGES.timeout;
  const hasError = typeof error === 'string' && error.length > 0;

  return (
    <div className="account-check-page">
      <h1>Account Status Check</h1>

      <div className="account-check-page__controls">
        <EmailInput
          value={email}
          onChange={handleEmailChange}
          onValidationChange={setIsEmailValid}
          disabled={loading}
          placeholder="Enter account email"
        />
        <ActionButton
          label="Check Status"
          onClick={runCheck}
          loading={loading}
          disabled={!isEmailValid}
        />
      </div>

      <ResultPanel title="Account Status" loading={loading} error={error}>
        <KeyValueDisplay
          data={result}
          label="Account status fields"
          emptyMessage="No account status fields returned."
        />
      </ResultPanel>

      {hasError && !loading && (
        <div className="account-check-page__retry">
          {isTimeout && (
            <p className="account-check-page__timeout-hint" role="status">
              The request timed out. You can try again.
            </p>
          )}
          <ActionButton
            label="Retry"
            variant="secondary"
            onClick={runCheck}
            disabled={!isEmailValid}
          />
        </div>
      )}
    </div>
  );
}

export default AccountCheckPage;
