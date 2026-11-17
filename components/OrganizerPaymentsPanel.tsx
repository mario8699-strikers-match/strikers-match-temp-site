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
import { useTranslation } from 'react-i18next';
import { formatLocalizedCurrency, formatLocalizedDate } from '@/lib/locale';

const EMPTY_SUMMARY: OrganizerPaymentSummary = {
  paid_count: 0,
  pending_count: 0,
  failed_count: 0,
  refunded_count: 0,
  gross_paid_cents: 0,
  platform_fees_cents: 0,
  refunded_cents: 0,
};

export function OrganizerPaymentsPanel({ eventId }: { eventId?: string }) {
  const { t, i18n } = useTranslation('events');
  const money = (cents: number, currency = 'MXN') => (
    formatLocalizedCurrency(cents / 100, currency, i18n.resolvedLanguage)
  );
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
    if (!window.confirm(t('events.organizerPayments.refundConfirm', {
      amount: money(payment.amount_cents - payment.amount_refunded_cents),
      participant: payment.payer_display_name ?? t('events.organizerPayments.thisParticipant'),
    }))) return;
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
          <p className="text-xs font-bold uppercase tracking-widest text-[#C0001E]">{t('events.organizerPayments.eyebrow')}</p>
          <h2 className="mt-1 text-2xl font-black uppercase text-zinc-900">{t('events.organizerPayments.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            {t('events.organizerPayments.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openStripe()}
          disabled={acting === 'stripe'}
          className="min-h-11 bg-zinc-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {acting === 'stripe' ? t('events.paymentSettings.opening') : account?.onboarding_complete ? t('events.organizerPayments.manageStripe') : t('events.paymentSettings.connectStripe')}
        </button>
      </div>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          {errorActionUrl && (
            <a href={errorActionUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold underline">
              {t('events.paymentSettings.activateStripe')}
            </a>
          )}
        </div>
      )}
      {loading ? (
        <p className="mt-5 text-sm text-zinc-400">{t('events.organizerPayments.loading')}</p>
      ) : (
        <>
          <div className={`mt-5 border p-4 ${account?.onboarding_complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className="text-sm font-bold text-zinc-900">
              {account?.onboarding_complete ? t('events.organizerPayments.accountReady') : t('events.organizerPayments.accountNotReady')}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {account?.account_display_name ?? t('events.organizerPayments.noAccount')} · {t('events.organizerPayments.charges')} {account?.charges_enabled ? t('events.organizerPayments.active') : t('events.organizerPayments.inactive')} · {t('events.organizerPayments.payouts')} {account?.payouts_enabled ? t('events.organizerPayments.active') : t('events.organizerPayments.inactive')}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label={t('events.organizerPayments.collected')} value={money(summary.gross_paid_cents)} />
            <Metric label={t('events.organizerPayments.platformFee')} value={money(summary.platform_fees_cents)} />
            <Metric label={t('events.organizerPayments.refunded')} value={money(summary.refunded_cents)} />
            <Metric label={t('events.organizerPayments.netBeforeStripe')} value={money(netBeforeStripe)} />
          </div>
          <p className="mt-2 text-xs text-zinc-400">{t('events.organizerPayments.processingFeeNote')}</p>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">{t('events.organizerPayments.recentActivity')}</h3>
              <span className="text-xs text-zinc-500">{t('events.organizerPayments.paymentCounts', { paid: summary.paid_count, pending: summary.pending_count })}</span>
            </div>
            {payments.length === 0 ? (
              <p className="mt-3 border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">{t('events.organizerPayments.empty')}</p>
            ) : (
              <div className="mt-3 divide-y divide-zinc-100 border border-zinc-200">
                {payments.slice(0, 12).map((payment) => (
                  <article key={payment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-900">{payment.payer_display_name ?? t('events.organizerPayments.participant')}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{payment.events?.event_name ?? t('events.organizerPayments.event')} · {formatLocalizedDate(payment.created_at, i18n.resolvedLanguage)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm font-black text-zinc-900">{money(payment.amount_cents, payment.currency)}</p>
                        <p className="text-xs text-zinc-500">{t(`events.organizerPayments.status.${payment.payment_status}`)}</p>
                      </div>
                      {['paid', 'partially_refunded'].includes(payment.payment_status) && (
                        <button
                          type="button"
                          onClick={() => void refund(payment)}
                          disabled={acting === payment.id}
                          className="min-h-11 border border-red-200 px-3 py-2 text-xs font-bold uppercase text-red-700 disabled:opacity-50"
                        >
                          {acting === payment.id ? t('events.organizerPayments.sending') : t('events.organizerPayments.refund')}
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
