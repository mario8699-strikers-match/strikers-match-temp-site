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
  fighter_name_missing: 'Falta el nombre del peleador',
  discipline_missing: 'Falta la disciplina',
  weight_class_missing: 'Falta la categoría de peso',
  actual_or_requested_weight_missing: 'Falta el peso real o solicitado',
  weight_not_confirmed: 'El peso no está confirmado',
  availability_not_confirmed: 'La disponibilidad no está confirmada',
  experience_level_missing: 'Falta indicar amateur o profesional',
  gender_division_missing: 'Falta la división de género',
  gender_division_invalid: 'La división de género no es válida',
  ruleset_missing: 'Falta el reglamento',
  acceptable_weight_range_invalid: 'El rango de peso aceptable no es válido',
  outside_availability_window: 'La fecha del evento está fuera de la disponibilidad indicada',
  date_of_birth_missing: 'Falta la fecha de nacimiento',
  minor_consent_missing: 'Falta el consentimiento para menor de edad',
  representative_confirmation_missing: 'Falta confirmar la autorización del peleador o representante',
};

const REASON_ACTIONS: Record<string, string> = {
  application_not_approved: 'Aprueba la solicitud del peleador para continuar.',
  application_pending: 'Aprueba o rechaza la solicitud pendiente.',
  payment_not_confirmed: 'Confirma el pago o márcalo como exento.',
  fighter_name_missing: 'Agrega el nombre completo del peleador.',
  discipline_missing: 'Selecciona la disciplina en la que competirá.',
  weight_class_missing: 'Agrega fecha de nacimiento y peso para calcular la categoría automáticamente.',
  actual_or_requested_weight_missing: 'Ingresa el peso actual o el peso solicitado.',
  weight_not_confirmed: 'Activa la confirmación de peso del participante.',
  availability_not_confirmed: 'Confirma que el peleador está disponible para el evento.',
  experience_level_missing: 'Selecciona si compite como amateur o profesional.',
  gender_division_missing: 'Selecciona Masculino o Femenino antes de generar enfrentamientos.',
  gender_division_invalid: 'Corrige la división y selecciona Masculino o Femenino.',
  acceptable_weight_range_invalid: 'Corrige el rango para que el peso mínimo no exceda el máximo.',
  outside_availability_window: 'Ajusta las fechas de disponibilidad para incluir la fecha del evento.',
  date_of_birth_missing: 'Agrega la fecha de nacimiento para calcular la edad y categoría.',
  minor_consent_missing: 'Registra y verifica el consentimiento del padre, madre o tutor.',
  representative_confirmation_missing: 'Confirma que tienes autorización para registrar y gestionar al peleador.',
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
  // Compatibility with registrations returned before the additive migration is
  // deployed. Existing payment UI must continue to render during rollout.
  if (!status) return null;

  const actionableReasons = reasons.filter((reason) => !NON_BLOCKING_REASONS.has(reason));
  const reviewSummary = status === 'review_required' && actionableReasons.length > 0
    ? actionableReasons.length === 1
      ? `Requiere revisión: ${REASON_LABELS[actionableReasons[0]] ?? actionableReasons[0].replaceAll('_', ' ')}`
      : `Requiere revisión: ${actionableReasons.length} requisitos pendientes`
    : STATUS_LABELS[status];

  return (
    <div className="mt-2">
      <span className={`inline-block border px-2 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
        {reviewSummary}
      </span>
      {showReasons && actionableReasons.length > 0 && (
        <div className="mt-2 border-l-2 border-blue-300 bg-blue-50/60 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-900">
            Para habilitar el matchmaking automático
          </p>
          <ul className="mt-2 space-y-2 text-xs text-zinc-700">
            {actionableReasons.map((reason) => (
              <li key={reason}>
                <span className="font-bold text-zinc-900">{REASON_LABELS[reason] ?? reason.replaceAll('_', ' ')}.</span>{' '}
                {REASON_ACTIONS[reason] ?? 'Revisa y completa este dato en el participante.'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
