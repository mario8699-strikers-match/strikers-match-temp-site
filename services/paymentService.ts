import { supabase } from '@/lib/supabaseClient';
import type {
  EventPaymentMethod,
  EventPaymentSettings,
  RegistrationPayment,
  RegistrationType,
  ServiceResponse,
} from '@/types';

export interface ConnectAccountStatus {
  account_display_name: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  updated_at: string;
}

export interface OrganizerPaymentSummary {
  paid_count: number;
  pending_count: number;
  failed_count: number;
  refunded_count: number;
  gross_paid_cents: number;
  platform_fees_cents: number;
  refunded_cents: number;
}

type PaymentServiceResponse<T> = ServiceResponse<T> & {
  actionUrl?: string | null;
};

async function accessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function authenticatedRequest<T>(url: string, init?: RequestInit): Promise<PaymentServiceResponse<T>> {
  try {
    const token = await accessToken();
    if (!token) return { data: null, error: 'Inicia sesión para continuar.' };
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
    const payload = await response.json().catch(() => ({})) as T & { error?: string; action_url?: string };
    if (!response.ok) {
      return {
        data: null,
        error: payload.error ?? 'La solicitud no pudo completarse.',
        actionUrl: payload.action_url ?? null,
      };
    }
    return { data: payload, error: null };
  } catch {
    return { data: null, error: 'No se pudo conectar con el servicio de pagos.' };
  }
}

export async function getConnectAccount(sync = false): Promise<ServiceResponse<ConnectAccountStatus | null>> {
  const result = await authenticatedRequest<{ account: ConnectAccountStatus | null }>(`/api/connect/account${sync ? '?sync=true' : ''}`);
  return { data: result.data?.account ?? null, error: result.error };
}

export async function openConnectAccount(
  action: 'onboard' | 'manage',
  returnPath?: string,
): Promise<PaymentServiceResponse<string>> {
  const result = await authenticatedRequest<{ url: string }>('/api/connect/account', {
    method: 'POST',
    body: JSON.stringify({ action, returnPath }),
  });
  return { data: result.data?.url ?? null, error: result.error, actionUrl: result.actionUrl };
}

export async function getEventPaymentSettings(eventId: string): Promise<ServiceResponse<EventPaymentSettings>> {
  try {
    const { data, error } = await supabase
      .from('event_payment_settings')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as EventPaymentSettings | null, error: null };
  } catch {
    return { data: null, error: 'No se pudo cargar la configuración de pago.' };
  }
}

export async function saveEventPaymentSettings(
  eventId: string,
  registrationType: RegistrationType,
  paymentMethod: EventPaymentMethod,
  feeCents: number,
): Promise<ServiceResponse<EventPaymentSettings>> {
  try {
    const { data, error } = await supabase.rpc('configure_event_payment_settings', {
      target_event_id: eventId,
      next_registration_type: registrationType,
      next_payment_method: paymentMethod,
      next_fee_cents: feeCents,
    });
    if (error) return { data: null, error: error.message };
    return { data: data as EventPaymentSettings, error: null };
  } catch {
    return { data: null, error: 'No se pudo guardar la configuración de pago.' };
  }
}

export async function startRegistrationCheckout(registrationId: string): Promise<ServiceResponse<string>> {
  const result = await authenticatedRequest<{ url: string }>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ registrationId }),
  });
  return { data: result.data?.url ?? null, error: result.error };
}

export async function getRegistrationPayment(registrationId: string): Promise<ServiceResponse<RegistrationPayment>> {
  try {
    const { data, error } = await supabase
      .from('registration_payments')
      .select('*')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as RegistrationPayment | null, error: null };
  } catch {
    return { data: null, error: 'No se pudo verificar el pago.' };
  }
}

export async function getOrganizerPayments(eventId?: string): Promise<ServiceResponse<{
  payments: RegistrationPayment[];
  summary: OrganizerPaymentSummary;
}>> {
  return authenticatedRequest(`/api/payments${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`);
}

export async function refundRegistrationPayment(paymentId: string): Promise<ServiceResponse<{
  refundId: string;
  status: string | null;
}>> {
  return authenticatedRequest('/api/payments/refund', {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  });
}
