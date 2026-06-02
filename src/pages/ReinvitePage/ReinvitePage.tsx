import { useState } from 'react';
import { EmailInput } from '../../components/EmailInput';
import { ActionButton } from '../../components/ActionButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotifications } from '../../context/NotificationContext';
import { reinvite } from '../../services/accountService';
import { validateEmail } from '../../utils/emailValidation';
import './ReinvitePage.css';

/**
 * Reinvite page (task 15.1).
 *
 * Lets support staff send a new invitation email to an account. The flow wires
 * together the shared {@link EmailInput}, {@link ActionButton},
 * {@link ConfirmDialog}, and the {@link useNotifications} toast API:
 *
 *   1. The staff member enters an email. {@link EmailInput} validates it and
 *      reports validity through `onValidationChange`; the reinvite button stays
 *      disabled until the email is valid (Requirements 5.1, 8.4).
 *   2. Triggering the reinvite action opens a {@link ConfirmDialog} whose
 *      message contains exactly the entered email so the operator can confirm
 *      the target (Requirement 5.2 / design Property 9). An invalid email never
 *      opens the dialog (Requirement 5.3).
 *   3. Confirming issues the reinvite request via {@link reinvite} and surfaces
 *      the API success or failure message as a toast (Requirements 5.4, 5.5,
 *      5.6).
 *   4. Cancelling closes the dialog without issuing any request and leaves the
 *      page state untouched (Requirement 5.7 / design Property 10).
 */
export function ReinvitePage() {
  const { showSuccess, showError } = useNotifications();

  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * Open the confirmation dialog for a valid email. Re-validating here (in
   * addition to the disabled button) guarantees an invalid email can never
   * open the dialog, satisfying Requirement 5.3 even if the click somehow
   * fires while the value is invalid.
   */
  const handleReinviteClick = () => {
    if (!validateEmail(email).isValid) {
      return;
    }
    setIsDialogOpen(true);
  };

  /**
   * Confirm path (Requirements 5.4, 5.5, 5.6): close the dialog, issue the
   * reinvite request, and report the outcome as a toast.
   */
  const handleConfirm = async () => {
    setIsDialogOpen(false);
    setLoading(true);
    try {
      const result = await reinvite(email);
      if (result.success) {
        showSuccess(result.message ?? `Reinvite sent to ${email}.`);
      } else {
        showError(result.error ?? 'Reinvite failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancel path (Requirement 5.7 / Property 10): close the dialog and abort.
   * No reinvite request is issued and no other state is modified, so the page
   * returns to exactly its pre-dialog state.
   */
  const handleCancel = () => {
    setIsDialogOpen(false);
  };

  return (
    <section className="reinvite-page" aria-label="Reinvite account">
      <h1 className="reinvite-page__title">Reinvite</h1>
      <p className="reinvite-page__description">
        Send a new invitation email to an account.
      </p>

      <div className="reinvite-page__form">
        <EmailInput
          value={email}
          onChange={setEmail}
          onValidationChange={setIsEmailValid}
          disabled={loading}
          placeholder="Account email"
        />
        <ActionButton
          label="Reinvite"
          onClick={handleReinviteClick}
          loading={loading}
          disabled={!isEmailValid}
        />
      </div>

      <ConfirmDialog
        isOpen={isDialogOpen}
        title="Reinvite account"
        message={`Send a new invitation to ${email}?`}
        confirmLabel="Send reinvite"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </section>
  );
}

export default ReinvitePage;
