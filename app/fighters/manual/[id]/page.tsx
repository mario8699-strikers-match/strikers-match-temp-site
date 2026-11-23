'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { FighterProfileHero } from '@/components/FighterProfileHero';
import { manualFighterService } from '@/services/manualFighterService';
import { eventService } from '@/services/eventService';
import { requestService } from '@/services/requestService';
import { authService } from '@/services/authService';
import { getPrimaryDiscipline, getPublicWeightDisplay } from '@/lib/fighterProfile';
import { manualFighterPublicPath } from '@/lib/publicUrls';
import { useTranslation } from 'react-i18next';
import type { ManualFighterWithCreator, Profile, Event } from '@/types';

export default function ManualFighterDetailPage() {
  const { t } = useTranslation('fighters');
  const { id } = useParams<{ id: string }>();

  const [fighter, setFighter] = useState<ManualFighterWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myEvents, setMyEvents] = useState<Event[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalEventId, setModalEventId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      manualFighterService.getById(id),
      authService.getSession(),
    ]).then(([{ data: fighterData }, { data: sessionData }]) => {
      const p = sessionData?.profile ?? null;
      setProfile(p);
      setFighter(fighterData);
      setLoading(false);
      if (fighterData?.slug && id !== fighterData.slug) {
        window.history.replaceState(null, '', `${manualFighterPublicPath(fighterData)}${window.location.search}${window.location.hash}`);
      }

      if (p && (p.role === 'promoter' || p.role === 'manager' || p.role === 'admin')) {
        eventService.getByPromoter(p.id).then(({ data: events }) => setMyEvents(events ?? []));
      }
    });
  }, [id]);

  const handleSendRequest = async () => {
    if (!profile || !fighter || !modalEventId) return;

    setSending(true);
    setSendError(null);
    const { error } = await requestService.create({
      event_id: modalEventId,
      fighter_id: null,
      manual_fighter_id: fighter.id,
      sender_id: profile.id,
      status: 'pending',
      message: modalMessage || null,
    });
    setSending(false);
    if (error) {
      setSendError(t('fighters.manualProfile.requestFailed'));
    } else {
      setSendSuccess(true);
      setTimeout(() => { setShowModal(false); setSendSuccess(false); setModalMessage(''); setModalEventId(''); }, 1500);
    }
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color:'#9A9A9A' }}>{t('fighters.manualProfile.loading')}</p></div>;

  if (!fighter) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar activePage="fighters" />
        <main className="flex-1 flex items-center justify-center"><p className="text-sm text-zinc-500">{t('fighters.manualProfile.notFound')}</p></main>
        <Footer />
      </div>
    );
  }

  const canSendRequest = profile && (profile.role === 'promoter' || profile.role === 'manager' || profile.role === 'admin');
  const creatorName = fighter.profiles?.full_name ?? '';
  const creatorRole = fighter.profiles?.role ?? 'manager';
  const nationalityCode = fighter.nationalities?.[0];
  const primaryDiscipline = getPrimaryDiscipline(fighter.disciplines, fighter.discipline);
  const weight = getPublicWeightDisplay(fighter.weight_class, fighter.exact_weight);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage="fighters" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/fighters"
          className="mb-8 inline-flex min-h-11 items-center border border-zinc-300 px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-700 transition-colors hover:border-zinc-950 hover:text-zinc-950"
        >
          ← {t('fighters.manualProfile.backToFighters')}
        </Link>

        <FighterProfileHero
          fullName={fighter.full_name}
          photoUrl={fighter.photo_url}
          nationalityCode={nationalityCode}
          countryCode={fighter.country_code}
          country={fighter.country}
          instagram={fighter.instagram}
          primaryDiscipline={primaryDiscipline}
          weight={weight}
          team={fighter.gym_name}
          wins={fighter.record_wins}
          losses={fighter.record_losses}
          draws={fighter.record_draws}
          experienceLevel={fighter.experience_level}
          roster
        />

        {/* Roster notice */}
        <div className="mb-6 mt-6 border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#92400E' }}>{t('fighters.manualProfile.accountlessTitle')}</p>
          <p className="text-sm" style={{ color:'#5A5A5A' }}>
            {t('fighters.manualProfile.noticeStart')} {t(`fighters.manualProfile.roles.${creatorRole}`, { defaultValue: t('fighters.manualProfile.roles.manager') })}
            {creatorName ? <> <span className="font-semibold text-zinc-900">{creatorName}</span></> : null}
            {t('fighters.manualProfile.noticeEnd')}
          </p>
        </div>

        {/* CTA */}
        {canSendRequest && (
          <div className="mt-6 flex justify-end">
            <button onClick={() => setShowModal(true)} className="px-6 py-3 text-sm font-bold tracking-widest uppercase text-white transition-colors"
              style={{ background:'#C0001E' }} onMouseOver={e=>(e.currentTarget.style.background='#9A0018')} onMouseOut={e=>(e.currentTarget.style.background='#C0001E')}>
              {t('fighters.manualProfile.contactRepresentative')}
            </button>
          </div>
        )}
        {!profile && (
          <div className="mt-6 border border-dashed border-zinc-200 p-6 text-center">
            <p className="text-sm text-zinc-500"><a href="/login" className="font-semibold" style={{ color:'#C0001E' }}>{t('fighters.manualProfile.signIn')}</a> {t('fighters.manualProfile.signInTail')}</p>
          </div>
        )}
      </main>

      {/* Fight Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white w-full max-w-md p-6">
            <h2 className="text-xl font-black uppercase mb-1" style={{ letterSpacing:'-0.5px' }}>{t('fighters.manualProfile.fightRequest')}</h2>
            <p className="text-sm mb-2" style={{ color:'#5A5A5A' }}>{t('fighters.manualProfile.to')}: <span className="font-semibold text-zinc-900">{fighter.full_name}</span></p>
            <p className="text-xs mb-6" style={{ color:'#92400E' }}>
              {t('fighters.manualProfile.requestRouting', { role: t(`fighters.manualProfile.roles.${creatorRole}`, { defaultValue: t('fighters.manualProfile.roles.manager') }) })}
            </p>
            {sendSuccess ? (
              <div className="py-8 text-center"><p className="text-sm font-semibold text-emerald-700">{t('fighters.manualProfile.requestSent')}</p></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.manualProfile.event')} *</label>
                  {myEvents.length === 0 ? (
                    <p className="text-sm text-zinc-400">{t('fighters.manualProfile.noEvents')} <Link href="/events/create" className="underline" style={{ color:'#C0001E' }}>{t('fighters.manualProfile.createOne')}</Link>.</p>
                  ) : (
                    <select value={modalEventId} onChange={e => setModalEventId(e.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                      <option value="">— {t('fighters.manualProfile.selectEvent')} —</option>
                      {myEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.event_name}{ev.event_date ? ` — ${ev.event_date}` : ''}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.manualProfile.messageOptional')}</label>
                  <textarea value={modalMessage} onChange={e => setModalMessage(e.target.value)} rows={4}
                    placeholder={t('fighters.manualProfile.messagePlaceholder')} className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none" />
                </div>
                {sendError && <p className="text-xs text-red-600">{sendError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowModal(false); setSendError(null); }} className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">{t('fighters.manualProfile.cancel')}</button>
                  <button onClick={handleSendRequest} disabled={sending || !modalEventId} className="px-5 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
                    {sending ? t('fighters.manualProfile.sending') : t('fighters.manualProfile.sendRequest')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
