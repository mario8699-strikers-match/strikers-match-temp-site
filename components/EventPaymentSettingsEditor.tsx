'use client';

import { useEffect, useState } from 'react';
import {
  getConnectAccount,
  getEventPaymentSettings,
  openConnectAccount,
  saveEventPaymentSettings,
  type ConnectAccountStatus,
} from '@/services/paymentService';
import type { EventPaymentMethod, RegistrationType } from '@/types';

export function EventPaymentSettingsEditor({
  eventId,
  eventStatus,
}: {
  eventId: string;
  eventStatus: string;
}) {
  const [registrationType, setRegistrationType] = useState<RegistrationType>('free');
  const [paymentMethod, setPaymentMethod] = useState<EventPaymentMethod>('manual');
  const [fee, setFee] = useState('');
  const [account, setAccount] = useState<ConnectAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorActionUrl, setErrorActionUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const paymentDraftKey = `strikersmatch:event-payment-settings:${eventId}`;

  useEffect(() => {
    let active = true;
    const shouldSync = new URLSearchParams(window.location.search).has('stripe');
    Promise.all([getEventPaymentSettings(eventId), getConnectAccount(shouldSync)]).then(([settingsResult, accountResult]) => {
      if (!active) return;
      if (settingsResult.data) {
        setRegistrationType(settingsResult.data.registration_type);
        setPaymentMethod(settingsResult.data.payment_method);
        setFee(settingsResult.data.registration_fee_cents > 0
          ? String(settingsResult.data.registration_fee_cents / 100)
          : '');
      }
      if (shouldSync) {
        try {
          const savedDraft = window.sessionStorage.getItem(paymentDraftKey);
          if (savedDraft) {
            const draft = JSON.parse(savedDraft) as {
              registrationType?: RegistrationType;
              paymentMethod?: EventPaymentMethod;
              fee?: string;
            };
            if (draft.registrationType === 'free' || draft.registrationType === 'paid') {
              setRegistrationType(draft.registrationType);
            }
            if (draft.paymentMethod === 'manual' || draft.paymentMethod === 'stripe') {
              setPaymentMethod(draft.paymentMethod);
            }
            if (typeof draft.fee === 'string') setFee(draft.fee);
          }
        } catch {
          window.sessionStorage.removeItem(paymentDraftKey);
        }
      }
      setAccount(accountResult.data ?? null);
      setError(settingsResult.error ?? accountResult.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [eventId, paymentDraftKey]);

  async function connect() {
    setActing('connect');
    setError(null);
    setErrorActionUrl(null);
    window.sessionStorage.setItem(paymentDraftKey, JSON.stringify({
      registrationType,
      paymentMethod,
      fee,
    }));
    const result = await openConnectAccount(
      account?.onboarding_complete ? 'manage' : 'onboard',
      `/events/${eventId}/manage/settings`,
    );
    if (result.data) window.location.href = result.data;
    else {
      setError(result.error);
      setErrorActionUrl(result.actionUrl ?? null);
      setActing(null);
    }
  }

  const save = async () => {
    const feeCents = registrationType === 'paid' ? Math.round(Number(fee || 0) * 100) : 0;
    if (registrationType === 'paid' && feeCents <= 0) {
      setError('Ingresa una cuota de inscripción válida.');
      return;
    }
    if (
      eventStatus === 'published' && registrationType === 'paid' && paymentMethod === 'stripe'
      && !account?.onboarding_complete
    ) {
      await connect();
      return;
    }

    setActing('save');
    setError(null);
    setMessage(null);
    const result = await saveEventPaymentSettings(eventId, registrationType, paymentMethod, feeCents);
    if (result.error) setError(result.error);
    else {
      window.sessionStorage.removeItem(paymentDraftKey);
      setMessage('Configuración de inscripción guardada.');
    }
    setActing(null);
  };

  return (
    <section className="border border-zinc-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black uppercase text-zinc-900">Registro y cobro</h2>
          <p className="mt-1 text-sm text-zinc-500">Define si el evento es gratuito o cobra la inscripción directamente en tu cuenta.</p>
        </div>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={acting === 'connect'}
          className="min-h-11 border border-zinc-300 px-4 py-3 text-xs font-bold uppercase text-zinc-800 disabled:opacity-50"
        >
          {acting === 'connect' ? 'Abriendo…' : account?.onboarding_complete ? 'Administrar Stripe' : 'Conectar Stripe'}
        </button>
      </div>

      {loading ? <p className="mt-5 text-sm text-zinc-400">Cargando…</p> : (
        <div className="mt-5 space-y-4">
          {error && (
            <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{error}</p>
              {errorActionUrl && (
                <a href={errorActionUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold underline">
                  Activar Stripe Connect
                </a>
              )}
            </div>
          )}
          {message && <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Choice
              active={registrationType === 'free'}
              title="Gratuito"
              description="No se solicita pago."
              onClick={() => { setRegistrationType('free'); setPaymentMethod('manual'); setFee(''); }}
            />
            <Choice
              active={registrationType === 'paid'}
              title="Con cuota"
              description="Se requiere pago para matchmaking."
              onClick={() => setRegistrationType('paid')}
            />
          </div>

          {registrationType === 'paid' && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Cuota de inscripción (MXN)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={fee}
                  onChange={(event) => {
                    const value = event.target.value.replace(',', '.');
                    if (/^\d*(?:\.\d{0,2})?$/.test(value)) setFee(value);
                  }}
                  placeholder="Ej. 500"
                  className="min-h-11 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Choice
                  active={paymentMethod === 'stripe'}
                  title="Stripe"
                  description="Cobro en línea verificado automáticamente."
                  onClick={() => setPaymentMethod('stripe')}
                />
                <Choice
                  active={paymentMethod === 'manual'}
                  title="Manual"
                  description="Transferencia o efectivo confirmado por ti."
                  onClick={() => setPaymentMethod('manual')}
                />
              </div>
              {paymentMethod === 'stripe' && (
                <div className={`border p-3 text-sm ${account?.onboarding_complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <p className="font-bold">{account?.onboarding_complete ? 'Stripe está listo para cobrar.' : 'Debes completar Stripe antes de publicar.'}</p>
                  <p className="mt-1 text-xs">Actualmente Strikers Match no aplica una comisión de plataforma a estas inscripciones.</p>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={acting === 'save'}
            className="min-h-11 bg-[#C0001E] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {acting === 'save' ? 'Guardando…' : 'Guardar registro y cobro'}
          </button>
        </div>
      )}
    </section>
  );
}

function Choice({ active, title, description, onClick }: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-20 border p-3 text-left ${active ? 'border-[#C0001E] bg-red-50' : 'border-zinc-300 bg-white'}`}
    >
      <span className="block text-sm font-black uppercase text-zinc-900">{title}</span>
      <span className="mt-1 block text-xs text-zinc-500">{description}</span>
    </button>
  );
}
