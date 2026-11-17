'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SignaturePad } from '@/components/SignaturePad';
import { useTranslation } from 'react-i18next';
import { authService } from '@/services/authService';
import { submitConsent, getConsent, WAIVER_TEXT } from '@/services/consentService';
import type { Profile } from '@/types';

const RELATIONSHIPS = ['Padre', 'Madre', 'Tutor Legal'] as const;

export default function ConsentPage() {
  const { t } = useTranslation('fighters');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyConsented, setAlreadyConsented] = useState(false);

  // Form state
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [relationship, setRelationship] = useState<'Padre' | 'Madre' | 'Tutor Legal'>('Padre');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acceptedWaiver, setAcceptedWaiver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authService.getSession().then(async ({ data }) => {
      const p = data?.profile ?? null;
      if (!p || p.role !== 'fighter') {
        window.location.href = '/login';
        return;
      }
      setProfile(p);

      // Check if consent already exists
      const { data: existing } = await getConsent(p.id);
      if (existing) {
        setAlreadyConsented(true);
      }
      setLoading(false);
    });
  }, []);

  const canSubmit =
    parentName.trim() &&
    parentEmail.trim() &&
    parentPhone.trim() &&
    signatureData &&
    acceptedWaiver &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !profile) return;

    setSubmitting(true);
    setError(null);

    const { error: err } = await submitConsent(
      profile.id,
      {
        parent_full_name: parentName.trim(),
        parent_email: parentEmail.trim(),
        parent_phone: parentPhone.trim(),
        relationship,
      },
      signatureData!,
      t('fighters.consent.waiverText')
    );

    setSubmitting(false);

    if (err) {
      setError(err);
    } else {
      window.location.href = '/fighter/profile';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">{t('fighters.consent.loading')}</p>
      </div>
    );
  }

  if (alreadyConsented) {
    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        <Navbar activePage={null} />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">{t('fighters.consent.registeredTitle')}</h2>
          <p className="text-zinc-500 text-sm mb-6">{t('fighters.consent.registeredBody')}</p>
          <a
            href="/fighter/profile"
            className="inline-block bg-brand-red text-white px-6 py-2.5 text-sm font-semibold hover:bg-brand-red-dark transition-colors"
          >
            {t('fighters.consent.goToProfile')}
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">{t('fighters.consent.title')}</h1>
          <p className="mt-2 text-zinc-500 text-sm">
            {t('fighters.consent.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Waiver text */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">{t('fighters.consent.waiverTitle')}</h2>
            <div className="border border-zinc-200 bg-zinc-50 p-4 max-h-64 overflow-y-auto text-xs text-zinc-700 leading-relaxed whitespace-pre-line">
              {t('fighters.consent.waiverText', { defaultValue: WAIVER_TEXT })}
            </div>
          </div>

          {/* Accept checkbox */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedWaiver}
              onChange={(e) => setAcceptedWaiver(e.target.checked)}
              className="mt-0.5 w-4 h-4 border-zinc-300 text-brand-red focus:ring-brand-red"
            />
            <span className="text-sm text-zinc-700">
              {t('fighters.consent.acceptWaiver')}
            </span>
          </label>

          {/* Parent info */}
          <div className="border-t border-zinc-200 pt-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">{t('fighters.consent.guardianDetails')}</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="parent_name" className="block text-sm font-medium text-zinc-700 mb-1">
                  {t('fighters.consent.fullName')}
                </label>
                <input
                  id="parent_name"
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder={t('fighters.consent.fullNamePlaceholder')}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="parent_email" className="block text-sm font-medium text-zinc-700 mb-1">
                    {t('fighters.consent.email')}
                  </label>
                  <input
                    id="parent_email"
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="parent_phone" className="block text-sm font-medium text-zinc-700 mb-1">
                    {t('fighters.consent.phone')}
                  </label>
                  <input
                    id="parent_phone"
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="+52 000 000 0000"
                    className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="relationship" className="block text-sm font-medium text-zinc-700 mb-1">
                  {t('fighters.consent.relationship')}
                </label>
                <select
                  id="relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as typeof relationship)}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white"
                >
                  {RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>{t(`fighters.consent.relationships.${r}`)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="border-t border-zinc-200 pt-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">{t('fighters.consent.digitalSignature')}</h2>
            <p className="text-xs text-zinc-500 mb-3">
              {t('fighters.consent.signatureHelp')}
            </p>
            <SignaturePad onSignatureChange={setSignatureData} height={150} />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-brand-red text-white py-2.5 text-sm font-semibold hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('fighters.consent.submitting') : t('fighters.consent.submit')}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
