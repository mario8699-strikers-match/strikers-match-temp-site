import type { RegistrationEligibilityStatus } from '@/types';
import { useTranslation } from 'react-i18next';

const STATUS_STYLES: Record<RegistrationEligibilityStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  review_required: 'border-blue-200 bg-blue-50 text-blue-800',
  eligible: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ineligible: 'border-red-200 bg-red-50 text-red-800',
};

const STATUS_KEYS: Record<RegistrationEligibilityStatus, string> = {
  pending: 'pending',
  review_required: 'reviewRequired',
  eligible: 'eligible',
  ineligible: 'ineligible',
};

const NON_BLOCKING_REASONS = new Set(['ruleset_missing']);

interface EligibilityStatusProps {
  status?: RegistrationEligibilityStatus;
  reasons?: string[];
  showReasons?: boolean;
}

export function EligibilityStatus({
  status,
  reasons = [],
  showReasons = false,
}: EligibilityStatusProps) {
  const { t } = useTranslation('events');
  // Compatibility with registrations returned before the additive migration is
  // deployed. Existing payment UI must continue to render during rollout.
  if (!status) return null;

  const actionableReasons = reasons.filter((reason) => !NON_BLOCKING_REASONS.has(reason));
  const reviewSummary = status === 'review_required' && actionableReasons.length > 0
    ? actionableReasons.length === 1
      ? t('events.eligibility.reviewReason', { reason: t(`events.eligibility.reasons.${actionableReasons[0]}`, { defaultValue: actionableReasons[0].replaceAll('_', ' ') }) })
      : t('events.eligibility.reviewCount', { count: actionableReasons.length })
    : t(`events.eligibility.status.${STATUS_KEYS[status]}`);

  return (
    <div className="mt-2">
      <span className={`inline-block border px-2 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
        {reviewSummary}
      </span>
      {showReasons && actionableReasons.length > 0 && (
        <div className="mt-2 border-l-2 border-blue-300 bg-blue-50/60 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-900">
            {t('events.eligibility.requirementsTitle')}
          </p>
          <ul className="mt-2 space-y-2 text-xs text-zinc-700">
            {actionableReasons.map((reason) => (
              <li key={reason}>
                <span className="font-bold text-zinc-900">{t(`events.eligibility.reasons.${reason}`, { defaultValue: reason.replaceAll('_', ' ') })}.</span>{' '}
                {t(`events.eligibility.actions.${reason}`, { defaultValue: t('events.eligibility.defaultAction') })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
