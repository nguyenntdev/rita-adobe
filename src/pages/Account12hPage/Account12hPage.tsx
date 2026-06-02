import { useState } from 'react';
import EmailInput from '../../components/EmailInput';
import ActionButton from '../../components/ActionButton';
import DataTable from '../../components/DataTable';
import ResultPanel from '../../components/ResultPanel';
import { getAccount12h } from '../../services/accountService';
import { useNotifications } from '../../context/NotificationContext';
import type { Account12hRecord } from '../../types';

/**
 * Account 12-Hour Data page (design "Account12hPage", task 14.4).
 *
 * Wires the shared {@link EmailInput} + {@link ActionButton} + {@link DataTable}
 * components to {@link getAccount12h}, presenting the outcome through a
 * {@link ResultPanel} and surfacing success/failure toasts via the
 * NotificationContext.
 *
 * Behaviour (Requirements 3.1, 3.3, 3.4, 3.5):
 *   - 3.1: renders an email input field and a retrieval action button.
 *   - 3.3: on success with data, renders a table whose headers identify each
 *     field (delegated to {@link DataTable}, which derives columns from the
 *     union of keys across records).
 *   - 3.4: on success with no records, renders the "no data" empty state.
 *   - 3.5: on failure, renders the API failure reason in the result panel and
 *     raises an error toast.
 *
 * The retrieval button is enabled iff the email is valid AND no request is in
 * flight (Requirement 8.4 / 10.1): `loading` disables it while a request runs,
 * and `disabled={!emailValid}` disables it for an invalid email.
 */

/** Operation label used in toast notifications (Requirements 10.2, 10.3). */
const OPERATION_LABEL = '12-Hour Data';

/** Empty-state message shown when the account has no 12-hour activity (Req 3.4). */
export const NO_DATA_MESSAGE =
  'No account activity found for the last 12 hours.';

export function Account12hPage() {
  const { showSuccess, showError } = useNotifications();

  const [email, setEmail] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  // `null` => no retrieval performed yet; an array (possibly empty) => a result.
  const [records, setRecords] = useState<Account12hRecord[] | null>(null);

  const handleRetrieve = async () => {
    // Guard against firing while disabled (e.g. programmatic calls).
    if (!emailValid || loading) {
      return;
    }

    setLoading(true);
    setError(undefined);

    const result = await getAccount12h(email);

    if (result.success) {
      const data = result.data ?? [];
      setRecords(data);
      setError(undefined);
      showSuccess(`${OPERATION_LABEL} retrieved for ${email}.`);
    } else {
      // Keep the previous table out of view; surface the API failure reason.
      setRecords(null);
      setError(result.error ?? 'Request failed. Please try again.');
      showError(`${OPERATION_LABEL} failed: ${result.error ?? 'Unknown error.'}`);
    }

    setLoading(false);
  };

  return (
    <section className="account-12h-page" aria-label="Account 12-Hour Data">
      <h1>Account 12-Hour Data</h1>

      <div className="account-12h-page__controls">
        <EmailInput
          value={email}
          onChange={setEmail}
          onValidationChange={setEmailValid}
          disabled={loading}
          placeholder="account@example.com"
        />
        <ActionButton
          label="View 12h Data"
          onClick={handleRetrieve}
          loading={loading}
          disabled={!emailValid}
        />
      </div>

      <ResultPanel title="12-Hour Data" loading={loading} error={error}>
        {records === null ? (
          <p
            className="account-12h-page__placeholder"
            data-testid="account-12h-placeholder"
          >
            Enter an email and retrieve to view 12-hour account data.
          </p>
        ) : (
          <DataTable
            records={records}
            emptyMessage={NO_DATA_MESSAGE}
            label="Account 12-hour data"
          />
        )}
      </ResultPanel>
    </section>
  );
}

export default Account12hPage;
