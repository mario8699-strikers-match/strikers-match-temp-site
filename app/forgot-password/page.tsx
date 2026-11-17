'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError(t('auth.recovery.emailRequired')); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError(t('auth.recovery.emailInvalid')); return; }

    setError(null);
    setLoading(true);
    const { error: resetError } = await authService.resetPassword(email.trim());
    setLoading(false);

    if (resetError) {
      setError(t('auth.recovery.sendFailed'));
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        <Navbar activePage={null} />
        <main className="flex-1 max-w-md mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">{t('auth.recovery.sentTitle')}</h2>
          <p className="text-sm text-zinc-500 mb-6">
            {t('auth.recovery.sentPrefix')} <span className="font-medium text-zinc-700">{email}</span>, {t('auth.recovery.sentSuffix')}
          </p>
          <a href="/login" className="text-sm font-medium text-zinc-900 hover:underline">
            {t('auth.recovery.backToLogin')}
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 max-w-md mx-auto px-4 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">{t('auth.recovery.title')}</h1>
          <p className="mt-2 text-zinc-500 text-sm">
            {t('auth.recovery.description')}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              {t('auth.recovery.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.recovery.emailPlaceholder')}
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red text-white py-2.5 text-sm font-semibold hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('auth.recovery.sending') : t('auth.recovery.send')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <a href="/login" className="font-medium text-zinc-900 hover:underline">
            {t('auth.recovery.backToLogin')}
          </a>
        </p>
      </main>

      <Footer />
    </div>
  );
}
