'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { isMinor, hasValidConsent } from '@/services/consentService';
import type { LoginFormData } from '@/types';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { t: tNav } = useTranslation('navigation');

  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const { data, error } = await authService.login(formData);
    setLoading(false);
    if (error) {
      setServerError(t('auth.errors.invalidCredentials'));
    } else {
      const role = data?.profile?.role;
      if (role === 'admin')                          window.location.href = '/admin';
      else if (role === 'promoter')                      window.location.href = '/events';
      else if (role === 'manager')                        window.location.href = '/manager/dashboard';
      else if (role === 'fighter') {
        // Minor consent gate
        if (data?.profile && isMinor(data.profile.date_of_birth)) {
          const consented = await hasValidConsent(data.profile.id);
          if (!consented) { window.location.href = '/consent'; return; }
        }
        window.location.href = '/fighter/profile';
      }
      else if (role === 'sponsor')                        window.location.href = '/sponsor/dashboard';
      else                                           window.location.href = '/';
    }
  };

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
          <a href="/register" className="font-medium text-zinc-900 hover:underline">
            {t('auth.login.registerLink')}
          </a>
        </p>
      </main>

      <Footer />
    </div>
  );
}
