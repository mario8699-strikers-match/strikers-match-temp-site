'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getConnectAccount,
  getOrganizerPayments,
  openConnectAccount,
  refundRegistrationPayment,
  type ConnectAccountStatus,
  type OrganizerPaymentSummary,
} from '@/services/paymentService';
import type { RegistrationPayment } from '@/types';

const EMPTY_SUMMARY: OrganizerPaymentSummary = {
  paid_count: 0,
  pending_count: 0,
  failed_count: 0,
  refunded_count: 0,
  gross_paid_cents: 0,
  platform_fees_cents: 0,
  refunded_cents: 0,
};

const STATUS_LABELS: Record<RegistrationPayment['payment_status'], string> = {
  unpaid: 'Sin pagar',
  pending: 'Pendiente',
  processing: 'Procesando',
  paid: 'Pagado',
  failed: 'Fallido',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial',
  disputed: 'En disputa',
};

function money(cents: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function OrganizerPaymentsPanel({ eventId }: { eventId?: string }) {
  const [account, setAccount] = useState<ConnectAccountStatus | null>(null);
  const [payments, setPayments] = useState<RegistrationPayment[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorActionUrl, setErrorActionUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [accountResult, paymentResult] = await Promise.all([
      getConnectAccount(),
      getOrganizerPayments(eventId),
    ]);
    setAccount(accountResult.data ?? null);
    if (paymentResult.data) {
      setPayments(paymentResult.data.payments);
      setSummary(paymentResult.data.summary);
    }
    setError(accountResult.error ?? paymentResult.error);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    let active = true;
    const shouldSync = new URLSearchParams(window.location.search).has('stripe');
    Promise.all([getConnectAccount(shouldSync), getOrganizerPayments(eventId)]).then(([accountResult, paymentResult]) => {
      if (!active) return;
      setAccount(accountResult.data ?? null);
      if (paymentResult.data) {
        setPayments(paymentResult.data.payments);
        setSummary(paymentResult.data.summary);
      }
      setError(accountResult.error ?? paymentResult.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [eventId]);

  const openStripe = async () => {
    setActing('stripe');
    setError(null);
    setErrorActionUrl(null);
    const result = await openConnectAccount(account?.onboarding_complete ? 'manage' : 'onboard');
    if (result.data) window.location.href = result.data;
    else {
      setError(result.error);
      setErrorActionUrl(result.actionUrl ?? null);
      setActing(null);
    }
  };

  const refund = async (payment: RegistrationPayment) => {
    if (!window.confirm(`¿Reembolsar ${money(payment.amount_cents - payment.amount_refunded_cents)} a ${payment.payer_display_name ?? 'este participante'}?`)) return;
    setActing(payment.id);
    setError(null);
    const result = await refundRegistrationPayment(payment.id);
    if (result.error) setError(result.error);
    else await load();
    setActing(null);
  };

  const netBeforeStripe = summary.gross_paid_cents - summary.platform_fees_cents - summary.refunded_cents;

  return (
    <section className="mb-10 border border-zinc-200 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#C0001E]">Ingresos por inscripciones del evento</p>
          <h2 className="mt-1 text-2xl font-black uppercase text-zinc-900">Pagos del organizador</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Los cobros llegan directamente a tu cuenta conectada de Stripe. Actualmente Strikers Match no aplica una comisión de plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openStripe()}
          disabled={acting === 'stripe'}
          className="min-h-11 bg-zinc-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {acting === 'stripe' ? 'Abriendo…' : account?.onboarding_complete ? 'Administrar en Stripe' : 'Conectar Stripe'}
        </button>
      </div>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          {errorActionUrl && (
            <a href={errorActionUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold underline">
              Activar Stripe Connect
            </a>
          )}
        </div>
      )}
      {loading ? (
        <p className="mt-5 text-sm text-zinc-400">Cargando pagos…</p>
      ) : (
        <>
          <div className={`mt-5 border p-4 ${account?.onboarding_complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className="text-sm font-bold text-zinc-900">
              {account?.onboarding_complete ? 'Cuenta lista para cobrar y recibir depósitos' : 'Stripe todavía no está listo para recibir pagos'}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {account?.account_display_name ?? 'Sin cuenta conectada'} · Cobros {account?.charges_enabled ? 'activos' : 'inactivos'} · Depósitos {account?.payouts_enabled ? 'activos' : 'inactivos'}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Cobrado" value={money(summary.gross_paid_cents)} />
            <Metric label="Comisión Strikers Match" value={money(summary.platform_fees_cents)} />
            <Metric label="Reembolsado" value={money(summary.refunded_cents)} />
            <Metric label="Neto antes de Stripe" value={money(netBeforeStripe)} />
          </div>
          <p className="mt-2 text-xs text-zinc-400">El neto mostrado no descuenta las comisiones de procesamiento cobradas por Stripe.</p>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">Actividad reciente</h3>
              <span className="text-xs text-zinc-500">{summary.paid_count} pagados · {summary.pending_count} pendientes</span>
            </div>
            {payments.length === 0 ? (
              <p className="mt-3 border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">Aún no hay pagos con Stripe.</p>
            ) : (
              <div className="mt-3 divide-y divide-zinc-100 border border-zinc-200">
                {payments.slice(0, 12).map((payment) => (
                  <article key={payment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-900">{payment.payer_display_name ?? 'Participante'}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{payment.events?.event_name ?? 'Evento'} · {new Date(payment.created_at).toLocaleDateString('es-MX')}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm font-black text-zinc-900">{money(payment.amount_cents)}</p>
                        <p className="text-xs text-zinc-500">{STATUS_LABELS[payment.payment_status]}</p>
                      </div>
                      {['paid', 'partially_refunded'].includes(payment.payment_status) && (
                        <button
                          type="button"
                          onClick={() => void refund(payment)}
                          disabled={acting === payment.id}
                          className="min-h-11 border border-red-200 px-3 py-2 text-xs font-bold uppercase text-red-700 disabled:opacity-50"
                        >
                          {acting === payment.id ? 'Enviando…' : 'Reembolsar'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-100 p-3">
      <p className="text-lg font-black text-zinc-900">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
