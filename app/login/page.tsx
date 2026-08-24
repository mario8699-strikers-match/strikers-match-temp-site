'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AUTH_PROFILE_MISSING_ERROR, AUTH_PROFILE_UNAVAILABLE_ERROR, authService } from '@/services/authService';
import { getSafeAuthNextPath, redirectAfterAuth } from '@/services/authRedirect';
import type { LoginFormData } from '@/types';

const SESSION_TIMEOUT_MS = 8000;
const LOGIN_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function resolveLoginError(error: string | null | undefined, t: (key: string) => string): string {
  if (!error) return t('auth.errors.invalidCredentials');
  if (error === AUTH_PROFILE_MISSING_ERROR) return t('auth.errors.profileMissing');
  if (error === AUTH_PROFILE_UNAVAILABLE_ERROR) return t('auth.errors.profileUnavailable');

  const normalized = error.toLowerCase();
  if (normalized.includes('email not confirmed')) return t('auth.errors.emailNotConfirmed');
  if (normalized.includes('invalid login credentials')) return t('auth.errors.invalidCredentials');
  return error;
}

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const nextPath = typeof window === 'undefined'
    ? null
    : getSafeAuthNextPath(new URLSearchParams(window.location.search).get('next'));
  const registerHref = nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : '/register';

  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Guard: if a session already exists (e.g., user just registered or never
  // logged out), bounce to their role-based landing page instead of showing
  // a login form they don't need.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await withTimeout(
          authService.getSession(),
          SESSION_TIMEOUT_MS,
          'No se pudo verificar la sesión. Intenta iniciar sesión de nuevo.'
        );
        if (cancelled) return;
        if (data?.profile) {
          await redirectAfterAuth(data.profile, nextPath);
          return;
        }
      } catch (error) {
        if (cancelled) return;
        setServerError(error instanceof Error ? error.message : 'No se pudo verificar la sesión.');
      }
      setCheckingSession(false);
    })();
    return () => { cancelled = true; };
  }, [nextPath]);

  const validate = (): boolean => {
    const newErrors: Partial<LoginFormData> = {};
    if (!formData.email) newErrors.email = t('auth.errors.emailRequired');
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = t('auth.errors.emailInvalid');
    if (!formData.password) newErrors.password = t('auth.errors.passwordRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError(null);
    setLoading(true);
    try {
      const { data, error } = await withTimeout(
        authService.login(formData),
        LOGIN_TIMEOUT_MS,
        'El inicio de sesión tardó demasiado. Intenta de nuevo.'
      );
      if (error) {
        setServerError(resolveLoginError(error, t));
      } else {
        await redirectAfterAuth(data?.profile ?? null, nextPath);
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t('auth.errors.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-white font-sans flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-brand-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="login" />

      {/* Login Form */}
      <main className="flex-1 max-w-md mx-auto px-4 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">{t('auth.login.title')}</h1>
          <p className="mt-2 text-zinc-500 text-sm">{t('auth.login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Server error */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {serverError}
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              {t('auth.login.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={t('auth.login.emailPlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.email ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
              {t('auth.login.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={t('auth.login.passwordPlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.password ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          <div className="flex items-center justify-end">
            <a href="/forgot-password" className="text-sm text-zinc-500 hover:text-zinc-900">
              {t('auth.login.forgotPassword')}
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red text-white py-2.5 text-sm font-semibold hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t('auth.login.noAccount')}{' '}
          <a href={registerHref} className="font-medium text-zinc-900 hover:underline">
            {t('auth.login.registerLink')}
          </a>
        </p>
      </main>

      <Footer />
    </div>
  );
}
