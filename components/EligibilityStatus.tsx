import type { RegistrationEligibilityStatus } from '@/types';

const STATUS_STYLES: Record<RegistrationEligibilityStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  review_required: 'border-blue-200 bg-blue-50 text-blue-800',
  eligible: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ineligible: 'border-red-200 bg-red-50 text-red-800',
};

const STATUS_LABELS: Record<RegistrationEligibilityStatus, string> = {
  pending: 'Elegibilidad pendiente',
  review_required: 'Requiere revisión',
  eligible: 'Elegible',
  ineligible: 'No elegible',
};

const REASON_LABELS: Record<string, string> = {
  application_not_approved: 'La solicitud no fue aprobada',
  application_pending: 'La solicitud está pendiente',
  payment_not_confirmed: 'El pago no está confirmado',
  discipline_missing: 'Falta la disciplina',
  weight_class_missing: 'Falta la categoría de peso',
  weight_not_confirmed: 'El peso no está confirmado',
  availability_not_confirmed: 'La disponibilidad no está confirmada',
  date_of_birth_missing: 'Falta la fecha de nacimiento',
  minor_consent_missing: 'Falta el consentimiento para menor de edad',
};

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
  // Compatibility with registrations returned before the additive migration is
  // deployed. Existing payment UI must continue to render during rollout.
  if (!status) return null;

  return (
    <div className="mt-2">
      <span className={`inline-block border px-2 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
        {STATUS_LABELS[status]}
      </span>
      {showReasons && reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-zinc-600">
          {reasons.map((reason) => (
            <li key={reason}>{REASON_LABELS[reason] ?? reason.replaceAll('_', ' ')}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

