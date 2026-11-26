'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { PasswordInput } from '@/components/PasswordInput';
import { authService } from '@/services/authService';
import {
  acceptPromoterTeamInvitation,
  getPromoterTeamInvitation,
} from '@/services/promoterTeamService';
import type { Profile, PromoterOrganizationInvitationPreview, RegisterFormData } from '@/types';

export default function PromoterTeamInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { t } = useTranslation('auth');
  const { t: tPromoters } = useTranslation('promoters');
  const { t: tLegal } = useTranslation('legal');
  const [invitation, setInvitation] = useState<PromoterOrganizationInvitationPreview | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formData, setFormData] = useState<RegisterFormData>({
    full_name: '',
    email: '',
    password: '',
    role: 'spectator',
    promoter_federation_status: '',
    city: '',
    phone: '',
    date_of_birth: '',
    gym_name: '',
  });

  const invitationPath = useMemo(() => `/team/invite/${encodeURIComponent(token)}`, [token]);
  const loginHref = `/login?next=${encodeURIComponent(invitationPath)}`;

  useEffect(() => {
    let active = true;
    Promise.all([
      getPromoterTeamInvitation(token),
      authService.getSession(),
    ]).then(([invitationResult, sessionResult]) => {
      if (!active) return;
      if (!invitationResult.data) {
        setError(tPromoters(invitationResult.error ?? 'promoters.team.invitation.errors.invalid'));
        setLoading(false);
        return;
      }
      setInvitation(invitationResult.data);
      setFormData((current) => ({ ...current, email: invitationResult.data!.email }));
      setProfile(sessionResult.data?.profile ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [tPromoters, token]);

  async function acceptInvitation() {
    setActing(true);
    setError(null);
    const result = await acceptPromoterTeamInvitation(token);
    if (result.error) {
      setError(tPromoters(result.error));
      setActing(false);
      return;
    }
    window.location.href = '/promoter/dashboard';
  }

  async function registerAndAccept(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!formData.full_name.trim()) {
      setError(t('auth.errors.fullNameRequired'));
      return;
    }
    if (formData.password.length < 8) {
      setError(t('auth.errors.passwordMinLength'));
      return;
    }
    if (formData.password !== confirmPassword) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }
    if (!formData.date_of_birth) {
      setError(t('auth.errors.dobRequired'));
      return;
    }
    if (!acceptedTerms) {
      setError(tLegal('legal.register.termsRequired'));
      return;
    }

    setActing(true);
    const registration = await authService.register(formData, {
      emailRedirectTo: window.location.href,
    });
    if (registration.error) {
      setError(registration.error);
      setActing(false);
      return;
    }
    if (registration.data?.profile) {
      await acceptInvitation();
      return;
    }
    setConfirmationRequired(true);
    setActing(false);
  }

  async function switchAccount() {
    await authService.logout();
    window.location.href = loginHref;
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-zinc-500">{tPromoters('promoters.team.invitation.loading')}</p></div>;
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div>
        </main>
        <Footer />
      </div>
    );
  }

  const roleLabel = tPromoters(`promoters.team.roles.${invitation.role}.label`);
  const signedInWithMatchingEmail = profile?.email?.toLowerCase() === invitation.email.toLowerCase();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C0001E]">Strikers Match</p>
        <h1 className="mt-2 text-3xl font-black uppercase text-zinc-950">
          {tPromoters('promoters.team.invitation.title')}
        </h1>
        <div className="mt-6 border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{tPromoters('promoters.team.invitation.organization')}</p>
          <p className="mt-1 text-xl font-black text-zinc-950">{invitation.organizationName}</p>
          <p className="mt-3 text-sm text-zinc-600">
            {tPromoters('promoters.team.invitation.assignedRole')}: <strong>{roleLabel}</strong>
          </p>
          <p className="mt-1 text-xs text-zinc-500">{tPromoters(`promoters.team.roles.${invitation.role}.description`)}</p>
        </div>

        {error && <p className="mt-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {profile && signedInWithMatchingEmail && (
          <div className="mt-6">
            <p className="text-sm text-zinc-600">{tPromoters('promoters.team.invitation.signedInReady', { email: profile.email })}</p>
            <button
              type="button"
              onClick={() => void acceptInvitation()}
              disabled={acting}
              className="mt-4 w-full bg-[#C0001E] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {acting ? tPromoters('promoters.team.invitation.accepting') : tPromoters('promoters.team.invitation.accept')}
            </button>
          </div>
        )}

        {profile && !signedInWithMatchingEmail && (
          <div className="mt-6 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{tPromoters('promoters.team.invitation.wrongAccount', { email: invitation.email, currentEmail: profile.email })}</p>
            <button type="button" onClick={() => void switchAccount()} className="mt-3 font-bold underline">
              {tPromoters('promoters.team.invitation.switchAccount')}
            </button>
          </div>
        )}

        {!profile && invitation.accountExists && (
          <div className="mt-6">
            <p className="text-sm text-zinc-600">{tPromoters('promoters.team.invitation.existingAccount', { email: invitation.email })}</p>
            <a href={loginHref} className="mt-4 block bg-zinc-950 px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-white">
              {tPromoters('promoters.team.invitation.signIn')}
            </a>
          </div>
        )}

        {!profile && !invitation.accountExists && !confirmationRequired && (
          <form onSubmit={registerAndAccept} noValidate className="mt-7 space-y-5">
            <div>
              <label htmlFor="team_full_name" className="mb-1 block text-sm font-medium text-zinc-700">
                {t('auth.register.fullName')} <span className="text-[#C0001E]">*</span>
              </label>
              <input
                id="team_full_name"
                type="text"
                autoComplete="name"
                value={formData.full_name}
                onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
                placeholder={t('auth.register.fullNamePlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
              />
            </div>
            <div>
              <label htmlFor="team_email" className="mb-1 block text-sm font-medium text-zinc-700">{t('auth.register.email')}</label>
              <input id="team_email" type="email" value={invitation.email} readOnly className="w-full border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500" />
              <p className="mt-1 text-xs text-zinc-500">{tPromoters('promoters.team.invitation.emailLocked')}</p>
            </div>
            <div>
              <label htmlFor="team_password" className="mb-1 block text-sm font-medium text-zinc-700">
                {t('auth.register.password')} <span className="text-[#C0001E]">*</span>
              </label>
              <PasswordInput
                id="team_password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                placeholder={t('auth.register.passwordPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
              />
            </div>
            <div>
              <label htmlFor="team_password_confirm" className="mb-1 block text-sm font-medium text-zinc-700">
                {t('auth.register.confirmPassword')} <span className="text-[#C0001E]">*</span>
              </label>
              <PasswordInput
                id="team_password_confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t('auth.register.confirmPasswordPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="team_city" className="mb-1 block text-sm font-medium text-zinc-700">{t('auth.register.city')}</label>
                <input id="team_city" type="text" value={formData.city} onChange={(event) => setFormData({ ...formData, city: event.target.value })} placeholder={t('auth.register.cityPlaceholder')} className="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" />
              </div>
              <div>
                <label htmlFor="team_phone" className="mb-1 block text-sm font-medium text-zinc-700">{t('auth.register.phone')}</label>
                <input id="team_phone" type="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder={t('auth.register.phonePlaceholder')} className="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" />
              </div>
            </div>
            <div>
              <label htmlFor="team_dob" className="mb-1 block text-sm font-medium text-zinc-700">
                {t('auth.register.dateOfBirth')} <span className="text-[#C0001E]">*</span>
              </label>
              <input id="team_dob" type="date" value={formData.date_of_birth} onChange={(event) => setFormData({ ...formData, date_of_birth: event.target.value })} max={new Date().toISOString().split('T')[0]} className="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" />
            </div>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                {tLegal('legal.register.acceptTerms')}{' '}
                <a href="/terms" target="_blank" className="font-medium underline">{tLegal('legal.register.termsLink')}</a>{' '}
                {tLegal('legal.register.and')}{' '}
                <a href="/privacy-policy" target="_blank" className="font-medium underline">{tLegal('legal.register.privacyLink')}</a>
              </span>
            </label>
            <button type="submit" disabled={acting} className="w-full bg-[#C0001E] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50">
              {acting ? t('auth.register.submitting') : tPromoters('promoters.team.invitation.createAccount')}
            </button>
          </form>
        )}

        {confirmationRequired && (
          <div className="mt-6 border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <p className="font-bold">{tPromoters('promoters.team.invitation.confirmEmailTitle')}</p>
            <p className="mt-1">{tPromoters('promoters.team.invitation.confirmEmailDescription', { email: invitation.email })}</p>
            <a href={loginHref} className="mt-4 inline-block font-bold underline">{tPromoters('promoters.team.invitation.signInAfterConfirmation')}</a>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
