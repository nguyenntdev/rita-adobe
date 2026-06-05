import { useState } from 'react';

import { Icon } from '../Icon/Icon';
import { vi } from '../../i18n/vi';
import { formatDateTime, toAccountProfile } from '../../utils/displayFormat';
import './AccountStatusCard.css';

/**
 * Polished profile card for the account/check result.
 *
 * Renders the curated {@link toAccountProfile} view — avatar, email, status
 * badge, product/team, last-updated time, the Vietnamese handling note, and the
 * access link — deliberately omitting the noisy `parentMultiNote` (the same
 * note duplicated in 4 languages) and internal/empty fields.
 */
export interface AccountStatusCardProps {
  data: Record<string, unknown>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="acct-card__icon-btn"
      title={label}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Icon name="check" /> : <Icon name="copy" />}
    </button>
  );
}

export function AccountStatusCard({ data }: AccountStatusCardProps) {
  const p = toAccountProfile(data);
  const initial = (p.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="acct-card" data-testid="account-status-card">
      <div className="acct-card__head">
        <div className="acct-card__avatar" aria-hidden="true">
          {initial}
        </div>
        <div className="acct-card__identity">
          <div className="acct-card__email-row">
            <span className="acct-card__email" data-testid="account-email">
              {p.email ?? '—'}
            </span>
            {p.email && <CopyButton text={p.email} label={vi.profile.copyEmail} />}
          </div>
          {p.status && (
            <span
              className={`acct-card__status acct-card__status--${p.statusTone}`}
              data-testid="account-status-badge"
            >
              {p.statusText}
            </span>
          )}
        </div>
      </div>

      <dl className="acct-card__facts">
        {p.productName && (
          <div className="acct-card__fact">
            <dt>{vi.profile.product}</dt>
            <dd>{p.productName}</dd>
          </div>
        )}
        {p.teamName && (
          <div className="acct-card__fact">
            <dt>{vi.profile.team}</dt>
            <dd>{p.teamName}</dd>
          </div>
        )}
        {p.groupName && (
          <div className="acct-card__fact">
            <dt>{vi.profile.group}</dt>
            <dd>{p.groupName}</dd>
          </div>
        )}
        {p.updatedAt && (
          <div className="acct-card__fact">
            <dt>{vi.profile.updatedAt}</dt>
            <dd>{formatDateTime(p.updatedAt)}</dd>
          </div>
        )}
      </dl>

      {p.productAccessUrl && (
        <a
          className="acct-card__access"
          href={p.productAccessUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {vi.profile.openAccess} <Icon name="external" />
        </a>
      )}

      {p.note && (
        <div className="acct-card__note">
          <div className="acct-card__note-label">{vi.profile.note}</div>
          <p className="acct-card__note-body">{p.note}</p>
        </div>
      )}
    </div>
  );
}

export default AccountStatusCard;
