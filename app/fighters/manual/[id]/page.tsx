'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { manualFighterService } from '@/services/manualFighterService';
import { eventService } from '@/services/eventService';
import { requestService } from '@/services/requestService';
import { authService } from '@/services/authService';
import { canPerformAction, recordRequestUsed } from '@/services/subscriptionService';
import { supabase } from '@/lib/supabaseClient';
import type { ManualFighterWithCreator, Profile, Event } from '@/types';

const WEIGHT_LABELS: Record<string, string> = {
  minimosca:'Minimosca',mosca:'Mosca',supermosca:'Supermosca',gallo:'Gallo',supergallo:'Supergallo',
  pluma:'Pluma',superpluma:'Superpluma',ligero:'Ligero',superligero:'Superligero',welter:'Welter',
  superwelter:'Superwelter',medio:'Medio',supermedio:'Supermedio',semipesado:'Semipesado',crucero:'Crucero',pesado:'Pesado',
};

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  promoter: 'Promotor',
  admin: 'Admin',
};

export default function ManualFighterDetailPage() {
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

  // Paywall
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');

  useEffect(() => {
    Promise.all([
      manualFighterService.getById(id),
      authService.getSession(),
    ]).then(([{ data: fighterData }, { data: sessionData }]) => {
      const p = sessionData?.profile ?? null;
      setProfile(p);
      setFighter(fighterData);
      setLoading(false);

      if (p && (p.role === 'promoter' || p.role === 'manager' || p.role === 'admin')) {
        eventService.getByPromoter(p.id).then(({ data: events }) => setMyEvents(events ?? []));
      }
    });
  }, [id]);

  const handleSendRequest = async () => {
    if (!profile || !fighter || !modalEventId) return;

    // Monetization check
    const subCheck = await canPerformAction(profile.id, profile.role, 'send_fight_request');
    if (!subCheck.allowed) {
      setPaywallReason(subCheck.reason);
      setShowPaywall(true);
      return;
    }

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
      setSendError('No se pudo enviar la solicitud.');
    } else {
      await recordRequestUsed(profile.id);
      setSendSuccess(true);
      setTimeout(() => { setShowModal(false); setSendSuccess(false); setModalMessage(''); setModalEventId(''); }, 1500);
    }
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color:'#9A9A9A' }}>Cargando...</p></div>;

  if (!fighter) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar activePage="fighters" />
        <main className="flex-1 flex items-center justify-center"><p className="text-sm text-zinc-500">Peleador no encontrado.</p></main>
        <Footer />
      </div>
    );
  }

  const canSendRequest = profile && (profile.role === 'promoter' || profile.role === 'manager' || profile.role === 'admin');
  const creatorName = fighter.profiles?.full_name ?? '';
  const creatorRole = fighter.profiles?.role ? (ROLE_LABELS[fighter.profiles.role] ?? fighter.profiles.role) : '';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage="fighters" />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10 w-full">

        {/* Header: photo + name */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-24 h-24 bg-zinc-100 flex-shrink-0 overflow-hidden">
            {fighter.photo_url ? (
              <Image src={fighter.photo_url} alt={fighter.full_name} width={96} height={96} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-10 h-10 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#C0001E' }}>Perfil del Peleador</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-black uppercase" style={{ letterSpacing:'-1px' }}>{fighter.full_name}</h1>
                  <span className={`text-xs font-bold px-2 py-1 uppercase tracking-widest ${fighter.experience_level === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    {fighter.experience_level === 'pro' ? 'Pro' : 'Amateur'}
                  </span>
                </div>
                {fighter.nickname && <p className="text-base font-semibold" style={{ color:'#C0001E' }}>&ldquo;{fighter.nickname}&rdquo;</p>}
                <p className="text-sm mt-1" style={{ color:'#5A5A5A' }}>{fighter.city ?? 'Sin ciudad'}</p>
              </div>
              <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 flex-shrink-0">
                Roster
              </span>
            </div>
          </div>
        </div>

        {/* Roster notice */}
        <div className="border border-amber-200 bg-amber-50/50 p-4 mb-6">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#92400E' }}>Peleador sin cuenta</p>
          <p className="text-sm" style={{ color:'#5A5A5A' }}>
            Este peleador no tiene cuenta. Toda solicitud se envía a su {creatorRole.toLowerCase() || 'manager'}
            {creatorName ? <> <span className="font-semibold text-zinc-900">{creatorName}</span></> : null}
            , quien gestionará el contacto dentro de la plataforma.
          </p>
        </div>

        {/* Record */}
        <div className="grid grid-cols-3 gap-4 border border-zinc-100 p-6 text-center mb-6">
          {[{label:'Victorias',value:fighter.record_wins},{label:'Derrotas',value:fighter.record_losses},{label:'Empates',value:fighter.record_draws}].map(({label,value}) => (
            <div key={label}>
              <p className="text-3xl font-black" style={{ fontFamily:'var(--font-barlow-condensed)', letterSpacing:'-1px' }}>{value}</p>
              <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color:'#5A5A5A' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Discipline pill */}
        {fighter.discipline && (
          <div className="border border-zinc-100 p-6 mb-6">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#9A9A9A' }}>Disciplina</p>
            <span className="text-xs font-bold px-3 py-1.5 uppercase tracking-wide bg-[#0A0A0A] text-white">{fighter.discipline}</span>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-zinc-100 p-6 mb-6">
          {[
            { label:'División', value: fighter.weight_class ? (WEIGHT_LABELS[fighter.weight_class] ?? fighter.weight_class) : '—' },
            { label:'Gimnasio', value: fighter.gym_name ?? '—' },
            { label:'Estado', value: fighter.state ?? '—' },
            { label:'Estatura', value: fighter.height_cm ? `${fighter.height_cm} cm` : '—' },
            { label:'Envergadura', value: fighter.reach_cm ? `${fighter.reach_cm} cm` : '—' },
          ].map(({label,value}) => (
            <div key={label}>
              <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{label}</p>
              <p className="text-sm font-semibold text-zinc-900">{value}</p>
            </div>
          ))}
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>Nivel</p>
            <span className={`text-xs font-bold px-2 py-1 uppercase tracking-widest ${fighter.experience_level === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
              {fighter.experience_level === 'pro' ? 'Pro' : 'Amateur'}
            </span>
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>Disponibilidad</p>
            <span className={`text-xs font-semibold px-2 py-1 ${fighter.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
              {fighter.is_available ? 'Disponible' : 'No disponible'}
            </span>
          </div>
        </div>

        {/* Bio */}
        {fighter.bio && (
          <div className="border border-zinc-100 p-6 mb-8">
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#9A9A9A' }}>Bio</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{fighter.bio}</p>
          </div>
        )}

        {/* CTA */}
        {canSendRequest && (
          <div className="flex justify-end">
            <button onClick={() => setShowModal(true)} className="px-6 py-3 text-sm font-bold tracking-widest uppercase text-white transition-colors"
              style={{ background:'#C0001E' }} onMouseOver={e=>(e.currentTarget.style.background='#9A0018')} onMouseOut={e=>(e.currentTarget.style.background='#C0001E')}>
              Contactar al manager
            </button>
          </div>
        )}
        {!profile && (
          <div className="border border-dashed border-zinc-200 p-6 text-center">
            <p className="text-sm text-zinc-500"><a href="/login" className="font-semibold" style={{ color:'#C0001E' }}>Inicia sesión</a> como promotor para enviar una solicitud.</p>
          </div>
        )}
      </main>

      {/* Fight Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white w-full max-w-md p-6">
            <h2 className="text-xl font-black uppercase mb-1" style={{ letterSpacing:'-0.5px' }}>Solicitud de Pelea</h2>
            <p className="text-sm mb-2" style={{ color:'#5A5A5A' }}>Para: <span className="font-semibold text-zinc-900">{fighter.full_name}</span></p>
            <p className="text-xs mb-6" style={{ color:'#92400E' }}>
              La solicitud se envía al {creatorRole.toLowerCase() || 'manager'} del peleador dentro de la plataforma.
            </p>
            {sendSuccess ? (
              <div className="py-8 text-center"><p className="text-sm font-semibold text-emerald-700">¡Solicitud enviada con éxito!</p></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Evento *</label>
                  {myEvents.length === 0 ? (
                    <p className="text-sm text-zinc-400">No tienes eventos. <a href="/events/create" className="underline" style={{ color:'#C0001E' }}>Crea uno</a>.</p>
                  ) : (
                    <select value={modalEventId} onChange={e => setModalEventId(e.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                      <option value="">— Selecciona un evento —</option>
                      {myEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.event_name}{ev.event_date ? ` — ${ev.event_date}` : ''}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Mensaje (opcional)</label>
                  <textarea value={modalMessage} onChange={e => setModalMessage(e.target.value)} rows={4}
                    placeholder="Escribe un mensaje..." className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none" />
                </div>
                {sendError && <p className="text-xs text-red-600">{sendError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowModal(false); setSendError(null); }} className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">Cancelar</button>
                  <button onClick={handleSendRequest} disabled={sending || !modalEventId} className="px-5 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
                    {sending ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl">
            <h2 className="text-base font-bold text-zinc-900 mb-2">Limite alcanzado</h2>
            <p className="text-sm text-zinc-500 mb-6">{paywallReason}</p>
            <div className="space-y-3 mb-6">
              <button
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) { window.location.href = '/login'; return; }
                  const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ plan: 'per_request' }),
                  });
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                }}
                className="w-full px-4 py-3 text-sm font-bold tracking-wide uppercase border-2 border-[#C0001E] text-[#C0001E] hover:bg-red-50 transition-colors"
              >
                Pago por solicitud — $49 MXN
              </button>
              <a
                href="/pricing"
                className="block w-full px-4 py-3 text-sm font-bold tracking-wide uppercase text-white text-center transition-colors"
                style={{ background: '#C0001E' }}
              >
                Ver planes mensuales
              </a>
            </div>
            <button onClick={() => setShowPaywall(false)} className="w-full text-center text-sm text-zinc-400 hover:text-zinc-700 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
