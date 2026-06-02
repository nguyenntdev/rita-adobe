import { useState } from 'react';
import { EmailInput } from '../../components/EmailInput';
import { ActionButton } from '../../components/ActionButton';
import { KeyValueDisplay } from '../../components/KeyValueDisplay';
import { ResultPanel } from '../../components/ResultPanel';
import { useNotifications } from '../../context/NotificationContext';
import { getVariables } from '../../services/accountService';
import './VariablePage.css';

/**
 * Variable data retrieval page (design "VariablePage", task 14.5).
 *
 * Wires {@link EmailInput} + {@link ActionButton} + {@link KeyValueDisplay}
 * inside a {@link ResultPanel} to the account service's `getVariables`
 * operation, surfacing user feedback through the NotificationContext.
 *
 * Behaviour (Requirements 4.1, 4.3, 4.4, 4.5):
 *   - 4.1: provides an email input field and a fetch action button.
 *   - 4.3: on success with data, renders the variable data in a structured
 *     key-value format.
 *   - 4.4: on success with no data / an empty result, renders a message
 *     indicating no variable data is available for the specified email.
 *   - 4.5: on failure, renders the failure reason returned by the endpoint.
 *
 * The fetch button is enabled if and only if the entered email is valid AND no
 * request is currently in progress (Requirement 8.4 / Property 6 enablement
 * invariant), preventing requests for invalid emails or while one is in flight.
 */

/** Operation name used in notification messages (Requirement 10.2/10.3). */
const OPERATION_LABEL = 'Get Variables';

/** Empty-result message shown in the panel (Requirement 4.4). */
const EMPTY_MESSAGE = 'No variable data is available for the specified email.';

/** One of the three result phases the panel can be in. */
type Phase = 'idle' | 'success';

export function VariablePage() {
  const [email, setEmail] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [phase, setPhase] = useState<Phase>('idle');

  const { showSuccess, showInfo, showError } = useNotifications();

  // Property 6 / Requirement 8.4: enabled iff email valid AND not loading.
  const canFetch = emailValid && !loading;

  const handleFetch = async () => {
    // Guard so a programmatic call cannot bypass the enablement invariant.
    if (!canFetch) {
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const result = await getVariables(email);

      if (result.success) {
        const record = result.data ?? {};
        setData(record);
        setPhase('success');

        if (Object.keys(record).length === 0) {
          // Success-empty: panel renders the empty message; nudge via info toast.
          showInfo(`${OPERATION_LABEL}: no data found for ${email}.`);
        } else {
          showSuccess(`${OPERATION_LABEL} completed.`);
        }
      } else {
        // Failure (Requirement 4.5): surface the endpoint's failure reason.
        const reason = result.error ?? 'Failed to fetch variable data.';
        setData({});
        setPhase('idle');
        setError(reason);
        showError(`${OPERATION_LABEL} failed: ${reason}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="variable-page">
      <h1 className="variable-page__heading">Variable Data</h1>

      <div className="variable-page__controls">
        <EmailInput
          value={email}
          onChange={setEmail}
          onValidationChange={setEmailValid}
          disabled={loading}
          placeholder="Enter an email to fetch variable data"
        />
        <ActionButton
          label="Fetch Variables"
          onClick={handleFetch}
          loading={loading}
          disabled={!canFetch}
        />
      </div>

      <ResultPanel title="Variable Data" loading={loading} error={error}>
        {phase === 'success' ? (
          <KeyValueDisplay
            data={data}
            emptyMessage={EMPTY_MESSAGE}
            label="Variable data"
          />
        ) : (
          <p className="variable-page__placeholder" data-testid="variable-placeholder">
            Enter an email address and fetch to view variable data.
          </p>
        )}
      </ResultPanel>
    </div>
  );
}

export default VariablePage;
