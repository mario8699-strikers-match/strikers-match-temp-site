'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPromoterOrganizationMembers,
  getPromoterOrganizationInvitations,
  invitePromoterOrganizationMember,
  removePromoterOrganizationMember,
  revokePromoterOrganizationInvitation,
  type AssignablePromoterOrganizationRole,
} from '@/services/promoterTeamService';
import type {
  PromoterOrganizationContext,
  PromoterOrganizationInvitation,
  PromoterOrganizationMember,
} from '@/types';

const ASSIGNABLE_ROLES: AssignablePromoterOrganizationRole[] = [
  'organization_admin',
  'event_manager',
  'matchmaker',
  'operations',
  'media_producer',
  'finance',
  'read_only',
];

export function PromoterTeamPanel({ organization }: { organization: PromoterOrganizationContext }) {
  const { t } = useTranslation('promoters');
  const [members, setMembers] = useState<PromoterOrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<PromoterOrganizationInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignablePromoterOrganizationRole>('event_manager');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [memberResult, invitationResult] = await Promise.all([
      getPromoterOrganizationMembers(organization.organization_id),
      getPromoterOrganizationInvitations(organization.organization_id),
    ]);
    setMembers(memberResult.data ?? []);
    setInvitations(invitationResult.data ?? []);
    const nextError = memberResult.error ?? invitationResult.error;
    setError(nextError ? t(nextError) : null);
    setLoading(false);
  }, [organization.organization_id, t]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getPromoterOrganizationMembers(organization.organization_id),
      getPromoterOrganizationInvitations(organization.organization_id),
    ]).then(([memberResult, invitationResult]) => {
      if (!active) return;
      setMembers(memberResult.data ?? []);
      setInvitations(invitationResult.data ?? []);
      const nextError = memberResult.error ?? invitationResult.error;
      setError(nextError ? t(nextError) : null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [organization.organization_id, t]);

  async function addMember() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    setActing('add');
    setError(null);
    setMessage(null);
    const result = await invitePromoterOrganizationMember(
      organization.organization_id,
      normalizedEmail,
      role,
    );
    if (result.error) setError(t(result.error));
    else {
      setEmail('');
      setMessage(t(result.data === 'invitation_created'
        ? 'promoters.team.invitationSent'
        : 'promoters.team.memberSaved'));
      await reload();
    }
    setActing(null);
  }

  async function removeMember(member: PromoterOrganizationMember) {
    const label = member.full_name || member.email || t('promoters.team.member');
    if (!window.confirm(t('promoters.team.removeConfirm', { name: label }))) return;
    setActing(member.member_id);
    setError(null);
    setMessage(null);
    const result = await removePromoterOrganizationMember(member.member_id);
    if (result.error) setError(t(result.error));
    else {
      setMessage(t('promoters.team.memberRemoved'));
      await reload();
    }
    setActing(null);
  }

  async function revokeInvitation(invitation: PromoterOrganizationInvitation) {
    if (!window.confirm(t('promoters.team.revokeConfirm', { email: invitation.email }))) return;
    setActing(invitation.invitation_id);
    setError(null);
    setMessage(null);
    const result = await revokePromoterOrganizationInvitation(invitation.invitation_id);
    if (result.error) setError(t(result.error));
    else {
      setMessage(t('promoters.team.invitationRevoked'));
      await reload();
    }
    setActing(null);
  }

  return (
    <section className="mb-10 border border-zinc-200 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C0001E]">
            {t('promoters.team.eyebrow')}
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase text-zinc-900">
            {organization.organization_name}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            {t('promoters.team.description')}
          </p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
          {t('promoters.team.memberCount', { count: members.length })}
        </span>
      </div>

      {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_240px_auto]">
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">
            {t('promoters.team.accountEmail')}
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('promoters.team.emailPlaceholder')}
            className="min-h-11 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">
            {t('promoters.team.accessLevel')}
          </span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AssignablePromoterOrganizationRole)}
            className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            {ASSIGNABLE_ROLES.map((value) => (
              <option key={value} value={value}>{t(`promoters.team.roles.${value}.label`)}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void addMember()}
          disabled={!email.trim() || acting === 'add'}
          className="min-h-11 self-end bg-zinc-900 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white disabled:bg-zinc-300"
        >
          {acting === 'add' ? t('promoters.team.saving') : t('promoters.team.inviteOrAdd')}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{t(`promoters.team.roles.${role}.description`)}</p>
      <p className="mt-1 text-xs text-zinc-400">{t('promoters.team.invitationHelp')}</p>

      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="py-5 text-sm text-zinc-400">{t('promoters.team.loading')}</p>
        ) : members.length === 0 ? (
          <p className="border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
            {t('promoters.team.empty')}
          </p>
        ) : members.map((member) => (
          <article key={member.member_id} className="flex flex-col gap-3 border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-zinc-900">
                {member.full_name || member.email || t('promoters.team.member')}
              </p>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {member.email || t('promoters.team.noEmail')} · {t(`promoters.team.roles.${member.organization_role}.label`)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {t(`promoters.team.roles.${member.organization_role}.description`)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void removeMember(member)}
              disabled={acting === member.member_id}
              className="min-h-11 border border-red-200 px-4 py-2 text-xs font-bold uppercase text-red-700 disabled:opacity-50"
            >
              {acting === member.member_id ? t('promoters.team.removing') : t('promoters.team.remove')}
            </button>
          </article>
        ))}
      </div>

      {!loading && invitations.length > 0 && (
        <div className="mt-7 border-t border-zinc-200 pt-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-zinc-900">
            {t('promoters.team.pendingInvitations', { count: invitations.length })}
          </h3>
          <div className="mt-3 space-y-2">
            {invitations.map((invitation) => (
              <article key={invitation.invitation_id} className="flex flex-col gap-3 border border-dashed border-zinc-300 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-900">{invitation.email}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t(`promoters.team.roles.${invitation.organization_role}.label`)} · {t('promoters.team.expires', {
                      date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(invitation.expires_at)),
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revokeInvitation(invitation)}
                  disabled={acting === invitation.invitation_id}
                  className="min-h-11 border border-zinc-300 px-4 py-2 text-xs font-bold uppercase text-zinc-700 disabled:opacity-50"
                >
                  {acting === invitation.invitation_id ? t('promoters.team.revoking') : t('promoters.team.revoke')}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
