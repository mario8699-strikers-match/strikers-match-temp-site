'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { FighterProfileHero } from '@/components/FighterProfileHero';
import { fighterService } from '@/services/fighterService';
import { eventService } from '@/services/eventService';
import { requestService } from '@/services/requestService';
import { authService } from '@/services/authService';
import { fighterFollowService } from '@/services/fighterFollowService';
import { supabase } from '@/lib/supabaseClient';
import { getPrimaryDiscipline, getPublicWeightDisplay } from '@/lib/fighterProfile';
import type { Fighter, Profile, Event } from '@/types';

type FighterDetail = Fighter & {
  profiles: {
    full_name: string;
    city: string | null;
    country?: string | null;
    country_code?: string | null;
    instagram?: string | null;
    tiktok?: string | null;
    facebook?: string | null;
    youtube?: string | null;
    x_handle?: string | null;
  };
};

type Neighbor = { id: string; name: string };

export default function FighterDetailPage() {
  const { t } = useTranslation('spectator');
  const { t: tFighters } = useTranslation('fighters');
  const { id } = useParams<{ id: string }>();

  const [fighter, setFighter] = useState<FighterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [neighbors, setNeighbors] = useState<{ prev: Neighbor | null; next: Neighbor | null }>({ prev: null, next: null });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followSaving, setFollowSaving] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalEventId, setModalEventId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fighterService.getById(id),
      authService.getSession(),
    ]).then(([{ data: fighterData }, { data: sessionData }]) => {
      const p = sessionData?.profile ?? null;
      setProfile(p);

      const f = fighterData as FighterDetail;

      // Block access if fighter is hidden
      if (f?.is_hidden) {
        setFighter(null);
        setLoading(false);
        return;
      }

      setFighter(f);
      setLoading(false);

      if (p && (p.role === 'promoter' || p.role === 'manager' || p.role === 'admin')) {
        eventService.getByPromoter(p.id).then(({ data: events }) => setMyEvents(events ?? []));
      }
      if (p?.role === 'spectator' && f?.id) {
        fighterFollowService.isFollowing(p.id, f.id).then(({ data }) => setIsFollowing(!!data));
      }
    });
  }, [id]);

  // Compute prev/next neighbors from the visible (non-hidden) fighters list.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .from('fighters')
      .select('id, profiles(full_name)')
      .neq('is_hidden', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const list = data as unknown as Array<{ id: string; profiles: { full_name: string } | null }>;
        const idx = list.findIndex((f) => f.id === id);
        if (idx < 0) {
          setNeighbors({ prev: null, next: null });
          return;
        }
        const prev = idx > 0
          ? { id: list[idx - 1].id, name: list[idx - 1].profiles?.full_name ?? tFighters('fighters.manualProfile.previous') }
          : null;
        const next = idx < list.length - 1
          ? { id: list[idx + 1].id, name: list[idx + 1].profiles?.full_name ?? tFighters('fighters.manualProfile.next') }
          : null;
        setNeighbors({ prev, next });
      });
    return () => { cancelled = true; };
  }, [id, tFighters]);

  const handleSendRequest = async () => {
    if (!profile || !fighter || !modalEventId) return;

    setSending(true);
    setSendError(null);
    const { error } = await requestService.create({
      event_id: modalEventId,
      fighter_id: fighter.id,
      manual_fighter_id: null,
      sender_id: profile.id,
      status: 'pending',
      message: modalMessage || null,
    });
    setSending(false);
    if (error) {
      setSendError(tFighters('fighters.manualProfile.requestFailed'));
    } else {
      setSendSuccess(true);
      setTimeout(() => { setShowModal(false); setSendSuccess(false); setModalMessage(''); setModalEventId(''); }, 1500);
    }
  };

  const handleToggleFollow = async () => {
    if (!profile || !fighter || profile.role !== 'spectator') return;
    setFollowSaving(true);
    setFollowError(null);
    const { error } = isFollowing
      ? await fighterFollowService.unfollow(profile.id, fighter.id)
      : await fighterFollowService.follow(profile.id, fighter.id);
    setFollowSaving(false);
    if (error) {
      setFollowError(t('spectator.followError'));
      return;
    }
    setIsFollowing((value) => !value);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color:'#9A9A9A' }}>{tFighters('fighters.manualProfile.loading')}</p></div>;

  if (!fighter) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar activePage="fighters" />
        <main className="flex-1 flex items-center justify-center"><p className="text-sm text-zinc-500">{tFighters('fighters.manualProfile.notFound')}</p></main>
        <Footer />
      </div>
    );
  }

  const canSendRequest = profile && (profile.role === 'promoter' || profile.role === 'manager' || profile.role === 'admin');
  const nationalityCode = fighter.nationalities?.[0];
  const primaryDiscipline = getPrimaryDiscipline(fighter.disciplines);
  const weight = getPublicWeightDisplay(fighter.weight_class, fighter.exact_weight);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage="fighters" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">

        {/* Back to list */}
        <Link
          href="/fighters"
          className="inline-flex items-center gap-1.5 mb-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-[#C0001E] transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          {tFighters('fighters.manualProfile.backToFighters')}
        </Link>

        <FighterProfileHero
          fullName={fighter.profiles?.full_name ?? '—'}
          photoUrl={fighter.photo_url}
          nationalityCode={nationalityCode}
          countryCode={fighter.profiles?.country_code}
          country={fighter.profiles?.country}
          instagram={fighter.profiles?.instagram}
          primaryDiscipline={primaryDiscipline}
          weight={weight}
          team={fighter.gym_name}
          wins={fighter.record_wins}
          losses={fighter.record_losses}
          draws={fighter.record_draws}
          experienceLevel={fighter.experience_level}
          verified={fighter.verified}
        />

        {/* CTA */}
        {profile?.role === 'spectator' && (
          <div className="mb-6 mt-6 border border-zinc-200 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#C0001E]">
                  {t('spectator.followCard.eyebrow')}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {t('spectator.followCard.body')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={followSaving}
                className={`min-h-11 px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                  isFollowing
                    ? 'border border-zinc-300 text-zinc-800 hover:border-zinc-900'
                    : 'bg-[#C0001E] text-white hover:bg-[#9A0018]'
                }`}
              >
                {followSaving
                  ? t('spectator.followCard.saving')
                  : isFollowing
                    ? t('spectator.followCard.following')
                    : t('spectator.followCard.follow')}
              </button>
            </div>
            {followError && <p className="mt-3 text-xs text-red-600">{followError}</p>}
          </div>
        )}
        {canSendRequest && (
          <div className="mt-6 flex justify-end">
            <button onClick={() => setShowModal(true)} className="px-6 py-3 text-sm font-bold tracking-widest uppercase text-white transition-colors"
              style={{ background:'#C0001E' }} onMouseOver={e=>(e.currentTarget.style.background='#9A0018')} onMouseOut={e=>(e.currentTarget.style.background='#C0001E')}>
              {tFighters('fighters.manualProfile.sendFightRequest')}
            </button>
          </div>
        )}
        {!profile && (
          <div className="mt-6 border border-dashed border-zinc-200 p-6 text-center">
            <p className="text-sm text-zinc-500">
              <Link href={`/register?account=spectator&next=${encodeURIComponent(`/fighters/${fighter.id}`)}`} className="font-semibold" style={{ color:'#C0001E' }}>
                {t('spectator.createAccount')}
              </Link>{' '}
              {t('spectator.createAccountTail')}{' '}
              <Link href="/login" className="font-semibold" style={{ color:'#C0001E' }}>
                {t('spectator.signIn')}
              </Link>.
            </p>
          </div>
        )}

        {/* Prev / Next navigation */}
        {(neighbors.prev || neighbors.next) && (
          <nav className="mt-10 pt-6 border-t border-zinc-200 grid grid-cols-2 gap-3">
            {neighbors.prev ? (
              <Link
                href={`/fighters/${neighbors.prev.id}`}
                className="group flex flex-col items-start gap-1 p-4 border border-zinc-200 hover:border-[#C0001E] transition-colors"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-[#C0001E]">← {tFighters('fighters.manualProfile.previous')}</span>
                <span className="text-sm font-semibold text-zinc-900 truncate w-full">{neighbors.prev.name}</span>
              </Link>
            ) : <span />}
            {neighbors.next ? (
              <Link
                href={`/fighters/${neighbors.next.id}`}
                className="group flex flex-col items-end gap-1 p-4 border border-zinc-200 hover:border-[#C0001E] transition-colors text-right"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-[#C0001E]">{tFighters('fighters.manualProfile.next')} →</span>
                <span className="text-sm font-semibold text-zinc-900 truncate w-full">{neighbors.next.name}</span>
              </Link>
            ) : <span />}
          </nav>
        )}
      </main>

      {/* Fight Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white w-full max-w-md p-6">
            <h2 className="text-xl font-black uppercase mb-1" style={{ letterSpacing:'-0.5px' }}>{tFighters('fighters.manualProfile.fightRequest')}</h2>
            <p className="text-sm mb-6" style={{ color:'#5A5A5A' }}>{tFighters('fighters.manualProfile.to')}: <span className="font-semibold text-zinc-900">{fighter.profiles?.full_name}</span></p>
            {sendSuccess ? (
              <div className="py-8 text-center"><p className="text-sm font-semibold text-emerald-700">{tFighters('fighters.manualProfile.requestSent')}</p></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{tFighters('fighters.manualProfile.event')} *</label>
                  {myEvents.length === 0 ? (
                    <p className="text-sm text-zinc-400">{tFighters('fighters.manualProfile.noEvents')} <Link href="/events/create" className="underline" style={{ color:'#C0001E' }}>{tFighters('fighters.manualProfile.createOne')}</Link>.</p>
                  ) : (
                    <select value={modalEventId} onChange={e => setModalEventId(e.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                      <option value="">— {tFighters('fighters.manualProfile.selectEvent')} —</option>
                      {myEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.event_name}{ev.event_date ? ` — ${ev.event_date}` : ''}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{tFighters('fighters.manualProfile.messageOptional')}</label>
                  <textarea value={modalMessage} onChange={e => setModalMessage(e.target.value)} rows={4}
                    placeholder={tFighters('fighters.manualProfile.messagePlaceholder')} className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none" />
                </div>
                {sendError && <p className="text-xs text-red-600">{sendError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowModal(false); setSendError(null); }} className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">{tFighters('fighters.manualProfile.cancel')}</button>
                  <button onClick={handleSendRequest} disabled={sending || !modalEventId} className="px-5 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
                    {sending ? tFighters('fighters.manualProfile.sending') : tFighters('fighters.manualProfile.sendRequest')}
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
