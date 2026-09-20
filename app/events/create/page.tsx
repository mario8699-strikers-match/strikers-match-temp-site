'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { EventWeightCategorySelector } from '@/components/EventWeightCategorySelector';
import { DISCIPLINE_OPTIONS } from '@/lib/combatWeightCategories';
import { eventService } from '@/services/eventService';
import { authService } from '@/services/authService';
import { updateGuidedOnboarding } from '@/services/onboardingService';
import { getConnectAccount, openConnectAccount, type ConnectAccountStatus } from '@/services/paymentService';
import type { EventFormData, Profile } from '@/types';

const STATUSES: EventFormData['status'][] = ['draft', 'published', 'cancelled', 'completed'];
const PAYMENT_SETUP_DRAFT_KEY = 'strikersmatch:event-payment-setup-draft';

const EMPTY_FORM: EventFormData = {
  event_name: '',
  event_date: '',
  event_time: '',
  city: '',
  venue: '',
  weight_class_needed: '',
  weight_classes_needed: [],
  disciplines_needed: [],
  purse_amount: '',
  purse_enabled: false,
  signup_fee: '',
  registration_type: 'free',
  payment_method: 'manual',
  notes: '',
  status: 'draft',
};

export default function CreateEventPage() {
  const { t } = useTranslation('events');

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [formData, setFormData] = useState<EventFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerPreview, setFlyerPreview] = useState<string | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<ConnectAccountStatus | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [serverErrorActionUrl, setServerErrorActionUrl] = useState<string | null>(null);

  // Auth guard: must be promoter or manager
  useEffect(() => {
    const returnedFromStripe = new URLSearchParams(window.location.search).has('stripe');
    if (returnedFromStripe) {
      try {
        const saved = window.sessionStorage.getItem(PAYMENT_SETUP_DRAFT_KEY);
        if (saved) {
          const restored = { ...EMPTY_FORM, ...JSON.parse(saved) as EventFormData };
          Promise.resolve().then(() => setFormData(restored));
        }
      } catch {
        window.sessionStorage.removeItem(PAYMENT_SETUP_DRAFT_KEY);
      }
    }
    authService.getSession().then(({ data }) => {
      const p = data?.profile ?? null;
      setProfile(p);
      if (!p) {
        window.location.href = '/login';
      } else if (p.role !== 'promoter' && p.role !== 'manager' && p.role !== 'admin') {
        window.location.href = '/events';
      } else {
        void getConnectAccount(returnedFromStripe).then(({ data }) => setPaymentAccount(data ?? null));
      }
    });
  }, []);

  const set = (key: keyof EventFormData, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleFlyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFlyerFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setFlyerPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFlyerPreview(null);
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!formData.event_name.trim()) newErrors.event_name = t('events.errors.nameRequired');
    const feeCents = Math.round(Number(formData.signup_fee || 0) * 100);
    if (formData.registration_type === 'paid' && feeCents <= 0) {
      newErrors.signup_fee = 'Ingresa una cuota de inscripción válida.';
    }
    if (
      formData.status === 'published' && formData.registration_type === 'paid'
      && formData.payment_method === 'stripe' && !paymentAccount?.onboarding_complete
    ) {
      newErrors.payment_method = 'Completa la conexión con Stripe antes de publicar.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    setServerError(null);
    setServerErrorActionUrl(null);
    window.sessionStorage.setItem(PAYMENT_SETUP_DRAFT_KEY, JSON.stringify(formData));
    const result = await openConnectAccount(
      paymentAccount?.onboarding_complete ? 'manage' : 'onboard',
      '/events/create',
    );
    if (result.data) window.location.href = result.data;
    else {
      setServerError(result.error);
      setServerErrorActionUrl(result.actionUrl ?? null);
      setConnectingStripe(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError(null);
    setLoading(true);
    const promoterId = profile!.id;

    // Upload flyer first if selected
    let flyerUrl: string | null = null;
    if (flyerFile) {
      const { data: url, error: uploadError } = await eventService.uploadFlyer(flyerFile);
      if (uploadError) {
        setServerError('Failed to upload flyer. Please try again.');
        setLoading(false);
        return;
      }
      flyerUrl = url;
    }

    const { data, error } = await eventService.create(promoterId, formData, flyerUrl);
    setLoading(false);
    if (error) {
      setServerError(error);
    } else if (data) {
      window.sessionStorage.removeItem(PAYMENT_SETUP_DRAFT_KEY);
      const guided = profile?.role !== 'admin'
        && !profile?.onboarding_completed
        && !profile?.onboarding_dismissed;
      if (guided) {
        const onboardingResult = await updateGuidedOnboarding({
          step: 2,
          eventId: data.id,
          dismissed: false,
        });
        if (!onboardingResult.error) {
          window.location.href = `/events/${data.id}/manage/settings?guideStep=2`;
          return;
        }
      }
      window.location.href = `/events/${data.id}`;
    }
  };

  // Block render until auth is confirmed — covers: checking, unauthenticated, wrong role
  if (!profile || (profile.role !== 'promoter' && profile.role !== 'manager' && profile.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm">...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar activePage="events" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/events" className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('events.backToEvents')}
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">{t('events.createEvent')}</h1>
        </div>

        {/* Free posting reassurance banner */}
        <div className="mb-6 border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-bold text-emerald-900">{t('events.freeBanner.title')}</p>
            <p className="text-xs text-emerald-800 mt-0.5">{t('events.freeBanner.body')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              <p>{serverError}</p>
              {serverErrorActionUrl && (
                <a href={serverErrorActionUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold underline">
                  Activar Stripe Connect
                </a>
              )}
            </div>
          )}

          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t('events.fields.event_name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.event_name}
              onChange={(e) => set('event_name', e.target.value)}
              placeholder={t('events.fields.event_namePlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.event_name ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.event_name && <p className="mt-1 text-xs text-red-500">{errors.event_name}</p>}
          </div>

          {/* Date + Time + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.event_date')}
              </label>
              <input
                type="date"
                value={formData.event_date}
                onChange={(e) => set('event_date', e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Hora de inicio
              </label>
              <input
                type="time"
                value={formData.event_time}
                onChange={(e) => set('event_time', e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.status')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`events.status.${s}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* City + Venue row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.city')}
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder={t('events.fields.cityPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.venue')}
              </label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => set('venue', e.target.value)}
                placeholder={t('events.fields.venuePlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
          </div>

          {/* Disciplines needed */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>
              Disciplinas requeridas
            </label>
            <div className="flex flex-wrap gap-2">
              {DISCIPLINE_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      disciplines_needed: prev.disciplines_needed.includes(d)
                        ? prev.disciplines_needed.filter((x) => x !== d)
                        : [...prev.disciplines_needed, d],
                    }))
                  }
                  className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                    formData.disciplines_needed.includes(d)
                      ? 'bg-[#C0001E] text-white border-[#C0001E]'
                      : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Weight Classes multi-select */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>
              Categorías de Peso Requeridas
            </label>
            <EventWeightCategorySelector
              disciplines={formData.disciplines_needed}
              selected={formData.weight_classes_needed}
              onChange={(weightClasses) => setFormData((prev) => ({ ...prev, weight_classes_needed: weightClasses }))}
            />
          </div>

          {/* Purse */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-zinc-700">{t('events.fields.purse_amount')}</label>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, purse_enabled: !prev.purse_enabled, purse_amount: '' }))}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${formData.purse_enabled ? 'bg-[#C0001E]' : 'bg-zinc-300'}`}
                aria-label="Toggle purse"
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.purse_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            {formData.purse_enabled ? (
              <input
                type="number"
                min="0"
                value={formData.purse_amount}
                onChange={(e) => set('purse_amount', e.target.value)}
                placeholder={t('events.fields.purse_amountPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            ) : <p className="text-xs text-zinc-400">Sin bolsa (desactivado)</p>}
          </div>

          {/* Registration and payment */}
          <div className="border border-zinc-200 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#C0001E]">Registro y cobro</p>
            <p className="mt-1 text-sm text-zinc-500">El organizador cobra directamente las inscripciones del evento.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFormData((prev) => ({ ...prev, registration_type: 'free', payment_method: 'manual', signup_fee: '' }))}
                className={`border p-3 text-left ${formData.registration_type === 'free' ? 'border-[#C0001E] bg-red-50' : 'border-zinc-300'}`}>
                <span className="block text-sm font-black uppercase">Gratuito</span>
                <span className="mt-1 block text-xs text-zinc-500">Sin pago de inscripción.</span>
              </button>
              <button type="button" onClick={() => setFormData((prev) => ({ ...prev, registration_type: 'paid' }))}
                className={`border p-3 text-left ${formData.registration_type === 'paid' ? 'border-[#C0001E] bg-red-50' : 'border-zinc-300'}`}>
                <span className="block text-sm font-black uppercase">Con cuota</span>
                <span className="mt-1 block text-xs text-zinc-500">Pago requerido para matchmaking.</span>
              </button>
            </div>
            {formData.registration_type === 'paid' && (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">Cuota de inscripción (MXN)</span>
                  <input type="text" inputMode="decimal" autoComplete="off"
                    value={formData.signup_fee}
                    onChange={(e) => {
                      const value = e.target.value.replace(',', '.');
                      if (/^\d*(?:\.\d{0,2})?$/.test(value)) set('signup_fee', value);
                    }}
                    placeholder="Ej. 500"
                    className={`w-full border px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-900 ${errors.signup_fee ? 'border-red-400' : 'border-zinc-300'}`} />
                  {errors.signup_fee && <span className="mt-1 block text-xs text-red-600">{errors.signup_fee}</span>}
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setFormData((prev) => ({ ...prev, payment_method: 'stripe' }))}
                    className={`border p-3 text-left ${formData.payment_method === 'stripe' ? 'border-[#C0001E] bg-red-50' : 'border-zinc-300'}`}>
                    <span className="block text-sm font-black uppercase">Stripe</span>
                    <span className="mt-1 block text-xs text-zinc-500">Pago en línea verificado automáticamente.</span>
                  </button>
                  <button type="button" onClick={() => setFormData((prev) => ({ ...prev, payment_method: 'manual' }))}
                    className={`border p-3 text-left ${formData.payment_method === 'manual' ? 'border-[#C0001E] bg-red-50' : 'border-zinc-300'}`}>
                    <span className="block text-sm font-black uppercase">Manual</span>
                    <span className="mt-1 block text-xs text-zinc-500">Efectivo o transferencia confirmada por ti.</span>
                  </button>
                </div>
                {formData.payment_method === 'stripe' && (
                  <div className={`border p-3 ${paymentAccount?.onboarding_complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className="text-sm font-bold text-zinc-900">{paymentAccount?.onboarding_complete ? 'Stripe está listo para cobrar.' : 'Conecta Stripe antes de publicar este evento.'}</p>
                    <p className="mt-1 text-xs text-zinc-600">Actualmente Strikers Match no aplica una comisión de plataforma a estas inscripciones.</p>
                    <button type="button" onClick={() => void handleConnectStripe()} disabled={connectingStripe}
                      className="mt-3 min-h-11 border border-zinc-300 bg-white px-4 py-2 text-xs font-bold uppercase text-zinc-800 disabled:opacity-50">
                      {connectingStripe ? 'Abriendo…' : paymentAccount?.onboarding_complete ? 'Administrar Stripe' : 'Conectar Stripe'}
                    </button>
                    {errors.payment_method && <p className="mt-2 text-xs text-red-700">{errors.payment_method}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Flyer Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Flyer del evento
            </label>
            <div
              className="border-2 border-dashed border-zinc-300 p-6 text-center cursor-pointer hover:border-zinc-400 transition-colors"
              onClick={() => document.getElementById('flyer-input')?.click()}
            >
              {flyerPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flyerPreview} alt="Flyer preview" className="max-h-64 mx-auto object-contain" />
                  <p className="mt-2 text-xs text-zinc-400">Haz clic para cambiar</p>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto w-10 h-10 text-zinc-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-zinc-500">Sube el flyer del evento</p>
                  <p className="text-xs text-zinc-400 mt-1">PNG, JPG, WEBP · Máx. 5MB</p>
                </div>
              )}
            </div>
            <input
              id="flyer-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFlyerChange}
              className="hidden"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t('events.fields.notes')}
            </label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={t('events.fields.notesPlaceholder')}
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
            <Link
              href="/events"
              className="w-full sm:w-auto text-center px-4 py-3 sm:py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              {t('common.cancel', { ns: 'common' })}
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 sm:py-2 text-sm font-semibold text-white bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('events.creating') : t('events.createEvent')}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
