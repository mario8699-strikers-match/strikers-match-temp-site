'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { redirectAfterAuth } from '@/services/authRedirect';
import type { RegisterFormData, UserRole } from '@/types';
import { VENDOR_ROLES } from '@/types';

type AccountType = 'organizer' | 'athlete' | 'professional';
type Step = 1 | 2 | 3;

const ORGANIZER_ROLES: UserRole[] = ['promoter', 'manager', 'sponsor'];

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const { t: tNav } = useTranslation('navigation');
  const { t: tLegal } = useTranslation('legal');

  const [step, setStep] = useState<Step>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const [formData, setFormData] = useState<RegisterFormData>({
    full_name: '',
    email: '',
    password: '',
    role: '' as UserRole,
    city: '',
    phone: '',
    date_of_birth: '',
    gym_name: '',
    bio: '',
    instagram: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData | 'confirmPassword' | 'terms', string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isVendorRole = !!formData.role && VENDOR_ROLES.includes(formData.role);

  const pickAccountType = (type: AccountType) => {
    setAccountType(type);
    if (type === 'athlete') {
      setFormData((prev) => ({ ...prev, role: 'fighter' }));
      setStep(3);
    } else {
      setFormData((prev) => ({ ...prev, role: '' as UserRole }));
      setStep(2);
    }
  };

  const pickRole = (role: UserRole) => {
    setFormData((prev) => ({ ...prev, role }));
    setStep(3);
  };

  const goBack = () => {
    if (step === 3 && accountType === 'athlete') {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
      setAccountType(null);
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!formData.full_name.trim()) newErrors.full_name = t('auth.errors.fullNameRequired');
    if (!formData.email) newErrors.email = t('auth.errors.emailRequired');
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = t('auth.errors.emailInvalid');
    if (!formData.password) newErrors.password = t('auth.errors.passwordRequired');
    else if (formData.password.length < 8) newErrors.password = t('auth.errors.passwordMinLength');
    if (formData.password !== confirmPassword) newErrors.confirmPassword = t('auth.errors.passwordMismatch');
    if (!formData.role) newErrors.role = t('auth.errors.roleRequired');
    if (!acceptedTerms) newErrors.terms = tLegal('legal.register.termsRequired');
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = 'Fecha de nacimiento requerida';
    } else {
      const dob = new Date(formData.date_of_birth);
      if (isNaN(dob.getTime()) || dob > new Date()) {
        newErrors.date_of_birth = 'Fecha invalida';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError(null);
    setLoading(true);
    const { error } = await authService.register(formData);
    if (error) {
      setLoading(false);
      setServerError(error);
      return;
    }

    // Supabase may auto-create a session on signUp when email confirmation is
    // disabled. In that case the user is already authenticated, so route them
    // straight to their role landing page instead of showing a 'Sign in'
    // success card (which would contradict the navbar showing them as logged in).
    const { data: sessionData } = await authService.getSession();
    if (sessionData?.profile) {
      await redirectAfterAuth(sessionData.profile);
      return;
    }

    // No session yet (email confirmation flow): show the check-your-inbox card.
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white font-sans flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">{t('auth.register.successTitle')}</h2>
          <p className="text-zinc-500 text-sm mb-6">{t('auth.register.successMessage')}</p>
          <a
            href="/login"
            className="inline-block bg-brand-red text-white px-6 py-2.5 text-sm font-semibold hover:bg-brand-red-dark transition-colors"
          >
            {tNav('nav.login')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="register" />

      <main className="flex-1 max-w-lg mx-auto px-4 py-16 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">{t('auth.register.title')}</h1>
          <p className="mt-2 text-zinc-500 text-sm">{t('auth.register.subtitle')}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-zinc-500 tracking-wide uppercase">
            <span className={step === 1 ? 'text-zinc-900' : ''}>Paso 1</span>
            <span>·</span>
            <span className={step === 2 ? 'text-zinc-900' : ''}>Paso 2</span>
            <span>·</span>
            <span className={step === 3 ? 'text-zinc-900' : ''}>Paso 3</span>
          </div>
        </div>

        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            className="mb-4 text-sm text-zinc-500 hover:text-zinc-900"
          >
            ← Regresar
          </button>
        )}

        {/* STEP 1: Account type picker */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-700 mb-2">¿Qué tipo de cuenta quieres crear?</p>

            <button
              type="button"
              onClick={() => pickAccountType('organizer')}
              className="w-full text-left border border-zinc-300 hover:border-zinc-900 px-4 py-4 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Organizo eventos</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Promotor, Manager o Patrocinador</div>
                </div>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-zinc-900 text-white">
                  Plan de Organizador
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => pickAccountType('athlete')}
              className="w-full text-left border border-zinc-300 hover:border-zinc-900 px-4 py-4 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Soy atleta</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Perfil público en el directorio de atletas</div>
                </div>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Gratis
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => pickAccountType('professional')}
              className="w-full text-left border border-zinc-300 hover:border-zinc-900 px-4 py-4 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Ofrezco servicios para eventos</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Fotógrafo, cutman, juez, catering, venue y más</div>
                </div>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Gratis
                </span>
              </div>
            </button>
          </div>
        )}

        {/* STEP 2: Sub-role picker */}
        {step === 2 && accountType === 'organizer' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-700 mb-2">Selecciona tu rol como organizador</p>
            {ORGANIZER_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => pickRole(role)}
                className="w-full text-left border border-zinc-300 hover:border-zinc-900 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors"
              >
                {t(`auth.register.${role}`)}
              </button>
            ))}
          </div>
        )}

        {step === 2 && accountType === 'professional' && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-700 mb-2">Selecciona el servicio que ofreces</p>
            {VENDOR_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => pickRole(role)}
                className="w-full text-left border border-zinc-300 hover:border-zinc-900 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors"
              >
                {t(`auth.register.${role}`)}
              </button>
            ))}
          </div>
        )}

        {/* STEP 3: Profile form */}
        {step === 3 && (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {serverError}
            </div>
          )}

          <div className="text-xs text-zinc-500">
            Rol seleccionado:{' '}
            <span className="font-semibold text-zinc-900">{t(`auth.register.${formData.role}`)}</span>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-zinc-700 mb-1">
              {t('auth.register.fullName')}
            </label>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder={t('auth.register.fullNamePlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.full_name ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              {t('auth.register.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={t('auth.register.emailPlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.email ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
              {t('auth.register.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={t('auth.register.passwordPlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.password ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 mb-1">
              {t('auth.register.confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.confirmPassword ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
          </div>

          {/* City + Phone row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-zinc-700 mb-1">
                {t('auth.register.city')}
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder={t('auth.register.cityPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1">
                {t('auth.register.phone')}
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder={t('auth.register.phonePlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label htmlFor="date_of_birth" className="block text-sm font-medium text-zinc-700 mb-1">
              Fecha de Nacimiento
            </label>
            <input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full border px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.date_of_birth ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.date_of_birth && <p className="mt-1 text-xs text-red-500">{errors.date_of_birth}</p>}
          </div>

          {/* Gym Name — fighters only */}
          {formData.role === 'fighter' && (
            <div>
              <label htmlFor="gym_name" className="block text-sm font-medium text-zinc-700 mb-1">
                Gimnasio Actual
              </label>
              <input
                id="gym_name"
                type="text"
                value={formData.gym_name}
                onChange={(e) => setFormData({ ...formData, gym_name: e.target.value })}
                placeholder="Nombre del gimnasio donde entrenas"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
          )}

          {/* Bio + Instagram — professionals only */}
          {isVendorRole && (
            <>
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-zinc-700 mb-1">
                  Descripción <span className="text-zinc-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  value={formData.bio ?? ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Breve descripción de tu servicio y experiencia"
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
                />
              </div>
              <div>
                <label htmlFor="instagram" className="block text-sm font-medium text-zinc-700 mb-1">
                  Instagram <span className="text-zinc-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="instagram"
                  type="text"
                  value={formData.instagram ?? ''}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="@tu_usuario"
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
                />
              </div>
            </>
          )}

          {/* Terms & Privacy acceptance */}
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => { setAcceptedTerms(e.target.checked); setErrors((prev) => ({ ...prev, terms: undefined })); }}
                className="mt-0.5 w-4 h-4 border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span className="text-sm text-zinc-700">
                {tLegal('legal.register.acceptTerms')}{' '}
                <a href="/terms" target="_blank" className="font-medium text-zinc-900 underline hover:text-[#C0001E]">
                  {tLegal('legal.register.termsLink')}
                </a>{' '}
                {tLegal('legal.register.and')}{' '}
                <a href="/privacy-policy" target="_blank" className="font-medium text-zinc-900 underline hover:text-[#C0001E]">
                  {tLegal('legal.register.privacyLink')}
                </a>
                {tLegal('legal.register.andCookies')}{' '}
                <a href="/privacy-policy#cookies" target="_blank" className="font-medium text-zinc-900 underline hover:text-[#C0001E]">
                  {tLegal('legal.register.cookiesLink')}
                </a>
              </span>
            </label>
            {errors.terms && <p className="text-red-600 text-xs mt-1">{errors.terms}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red text-white py-2.5 text-sm font-semibold hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('auth.register.submitting') : t('auth.register.submit')}
          </button>
        </form>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t('auth.register.hasAccount')}{' '}
          <a href="/login" className="font-medium text-zinc-900 hover:underline">
            {t('auth.register.loginLink')}
          </a>
        </p>
      </main>

      <Footer />
    </div>
  );
}
