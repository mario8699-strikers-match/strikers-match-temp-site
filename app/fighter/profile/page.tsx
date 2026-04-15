'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { fighterService } from '@/services/fighterService';
import { requestService } from '@/services/requestService';
import { eventService } from '@/services/eventService';
import { isMinor, hasValidConsent } from '@/services/consentService';
import { supabase } from '@/lib/supabaseClient';
import type { Profile, Fighter, MatchRequest, EventApplication } from '@/types';

const WEIGHT_CLASSES = [
  'minimosca','mosca','supermosca','gallo','supergallo','pluma','superpluma',
  'ligero','superligero','welter','superwelter','medio','supermedio','semipesado','crucero','pesado',
];
const DISCIPLINES = [
  'Boxeo','Muay Thai','MMA','Kickboxing','Karate','Judo','Lucha Libre',
  'Lima Lama','Jiu-Jitsu','Point Fight','Bare Knuckle','K1',
  'Light Contact','Kick Light','Low Kick','Full Contact','Otro',
];
const WEIGHT_LABELS: Record<string, string> = {
  minimosca:'Minimosca',mosca:'Mosca',supermosca:'Supermosca',gallo:'Gallo',supergallo:'Supergallo',
  pluma:'Pluma',superpluma:'Superpluma',ligero:'Ligero',superligero:'Superligero',welter:'Welter',
  superwelter:'Superwelter',medio:'Medio',supermedio:'Supermedio',semipesado:'Semipesado',crucero:'Crucero',pesado:'Pesado',
};
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:  { label:'Pendiente',  cls:'bg-amber-50 text-amber-700' },
  accepted: { label:'Aceptada',   cls:'bg-emerald-50 text-emerald-700' },
  declined: { label:'Rechazada',  cls:'bg-red-50 text-red-700' },
  cancelled:{ label:'Cancelada',  cls:'bg-zinc-100 text-zinc-500' },
};

type RequestWithDetails = MatchRequest & {
  events?: { event_name: string; event_date: string | null; city: string | null };
  profiles?: { full_name: string };
};

export default function FighterProfilePage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [fighter, setFighter] = useState<Fighter | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [weightClass, setWeightClass] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [gymName, setGymName] = useState('');
  const [exactWeight, setExactWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [reachCm, setReachCm] = useState('');
  const [wins, setWins] = useState('0');
  const [losses, setLosses] = useState('0');
  const [draws, setDraws] = useState('0');
  const [isAvailable, setIsAvailable] = useState(true);
  const [shortNotice, setShortNotice] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<'amateur' | 'pro'>('amateur');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');

  // Representation
  const [hasManager, setHasManager] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [hasPromoter, setHasPromoter] = useState(false);
  const [promoterName, setPromoterName] = useState('');
  const [promoterEmail, setPromoterEmail] = useState('');
  const [promoterPhone, setPromoterPhone] = useState('');
  const [hasSponsor, setHasSponsor] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorPhone, setSponsorPhone] = useState('');

  // Photo
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Inbox (Realtime)
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // My event applications
  type AppWithEvent = EventApplication & { events: { event_name: string; event_date: string | null; city: string | null; promoter_id: string } };
  const [myApplications, setMyApplications] = useState<AppWithEvent[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const syncFormFromFighter = (f: Fighter) => {
    setNickname(f.nickname ?? '');
    setBio(f.bio ?? '');
    setWeightClass(f.weight_class ?? '');
    setDisciplines(f.disciplines ?? []);
    setGymName(f.gym_name ?? '');
    setExactWeight(f.exact_weight != null ? String(f.exact_weight) : '');
    setHeightCm(f.height_cm != null ? String(f.height_cm) : '');
    setReachCm(f.reach_cm != null ? String(f.reach_cm) : '');
    setWins(String(f.record_wins));
    setLosses(String(f.record_losses));
    setDraws(String(f.record_draws));
    setIsAvailable(f.is_available);
    setShortNotice(f.short_notice_ready);
    setExperienceLevel(f.experience_level ?? 'amateur');
    setAvailableFrom(f.available_from ?? '');
    setAvailableTo(f.available_to ?? '');
    setHasManager(f.has_manager ?? false);
    setManagerName(f.manager_name ?? '');
    setManagerEmail(f.manager_email ?? '');
    setManagerPhone(f.manager_phone ?? '');
    setHasPromoter(f.has_promoter ?? false);
    setPromoterName(f.promoter_name ?? '');
    setPromoterEmail(f.promoter_email ?? '');
    setPromoterPhone(f.promoter_phone ?? '');
    setHasSponsor(f.has_sponsor ?? false);
    setSponsorName(f.sponsor_name ?? '');
    setSponsorEmail(f.sponsor_email ?? '');
    setSponsorPhone(f.sponsor_phone ?? '');
  };

  useEffect(() => {
    authService.getSession().then(async ({ data }) => {
      const p = data?.profile ?? null;
      setProfile(p);
      if (!p) { window.location.href = '/login'; return; }
      if (p.role !== 'fighter') { window.location.href = '/'; return; }

      // Minor consent gate
      if (isMinor(p.date_of_birth)) {
        const consented = await hasValidConsent(p.id);
        if (!consented) { window.location.href = '/consent'; return; }
      }

      fighterService.getByProfileId(p.id).then(({ data: f }) => {
        setFighter(f ?? null);
        if (f) {
          syncFormFromFighter(f);

          // Load initial inbox
          setRequestsLoading(true);
          requestService.getByFighter(f.id).then(({ data: reqs }) => {
            setRequests((reqs as RequestWithDetails[]) ?? []);
            setRequestsLoading(false);
          });

          // Load my event applications
          setAppsLoading(true);
          eventService.getMyApplications(f.id).then(({ data: apps }) => {
            setMyApplications((apps ?? []) as AppWithEvent[]);
            setAppsLoading(false);
          });

          // Realtime subscription
          const channel = supabase
            .channel(`requests:fighter:${f.id}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'match_requests', filter: `fighter_id=eq.${f.id}` },
              (payload) => {
                setRequests((prev) => [payload.new as RequestWithDetails, ...prev]);
              }
            )
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'match_requests', filter: `fighter_id=eq.${f.id}` },
              (payload) => {
                setRequests((prev) =>
                  prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new } : r)
                );
              }
            )
            .subscribe();

          return () => { supabase.removeChannel(channel); };
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    let photoUrl: string | undefined;
    if (photoFile) {
      const { data: url, error: upErr } = await fighterService.uploadPhoto(photoFile);
      if (upErr) { setError('Error al subir la foto.'); setSaving(false); return; }
      photoUrl = url ?? undefined;
    }

    const payload = {
      nickname: nickname || undefined,
      bio: bio || undefined,
      weight_class: weightClass || undefined,
      disciplines: disciplines,
      gym_name: gymName || undefined,
      exact_weight: exactWeight ? parseFloat(exactWeight) : undefined,
      height_cm: heightCm ? parseFloat(heightCm) : undefined,
      reach_cm: reachCm ? parseFloat(reachCm) : undefined,
      record_wins: parseInt(wins) || 0,
      record_losses: parseInt(losses) || 0,
      record_draws: parseInt(draws) || 0,
      is_available: isAvailable,
      short_notice_ready: shortNotice,
      experience_level: experienceLevel,
      available_from: availableFrom || undefined,
      available_to: availableTo || undefined,
      has_manager: hasManager,
      manager_name: hasManager ? managerName || null : null,
      manager_email: hasManager ? managerEmail || null : null,
      manager_phone: hasManager ? managerPhone || null : null,
      has_promoter: hasPromoter,
      promoter_name: hasPromoter ? promoterName || null : null,
      promoter_email: hasPromoter ? promoterEmail || null : null,
      promoter_phone: hasPromoter ? promoterPhone || null : null,
      has_sponsor: hasSponsor,
      sponsor_name: hasSponsor ? sponsorName || null : null,
      sponsor_email: hasSponsor ? sponsorEmail || null : null,
      sponsor_phone: hasSponsor ? sponsorPhone || null : null,
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
    };

    const result = fighter
      ? await fighterService.update(fighter.id, payload)
      : await fighterService.create(profile.id, payload);

    setSaving(false);
    if (result.error) {
      setError('Error al guardar. Intenta de nuevo.');
    } else {
      setFighter(result.data);
      setPhotoFile(null);
      setPhotoPreview(null);
      setEditing(false);
    }
  };

  const handleRequestStatus = async (requestId: string, status: 'accepted' | 'declined') => {
    setUpdatingId(requestId);
    await requestService.updateStatus(requestId, status);
    setRequests((prev) =>
      prev.map((r) => r.id === requestId ? { ...r, status } as RequestWithDetails : r)
    );
    setUpdatingId(null);
  };

  const handleWithdrawApplication = async (applicationId: string) => {
    setWithdrawingId(applicationId);
    await eventService.withdrawApplication(applicationId);
    setMyApplications((prev) =>
      prev.map((a) => a.id === applicationId ? { ...a, status: 'withdrawn' as const } : a)
    );
    setWithdrawingId(null);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error: err } = await authService.deleteAccount();
    if (err) {
      setError(err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    } else {
      window.location.href = '/';
    }
  };

  if (profile === undefined || fighter === undefined) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color:'#9A9A9A' }}>...</p></div>;
  }

  const isSetup = !fighter;
  const displayPhoto = photoPreview ?? fighter?.photo_url ?? null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage={null} />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10 w-full">

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C0001E' }}>Perfil del Peleador</p>
        </div>
        <div className="flex items-start gap-6 mb-8">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 bg-zinc-100 overflow-hidden cursor-pointer" onClick={() => photoInputRef.current?.click()} title="Cambiar foto">
              {displayPhoto ? (
                <Image src={displayPhoto} alt="Foto de perfil" width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                </div>
              )}
            </div>
            <button onClick={() => photoInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-900 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#C0001E' }}>Perfil del Peleador</p>
                <h1 className="text-3xl font-black uppercase" style={{ letterSpacing:'-1px' }}>{profile!.full_name}</h1>
                {fighter?.nickname && <p className="text-base font-semibold" style={{ color:'#C0001E' }}>&ldquo;{fighter.nickname}&rdquo;</p>}
                <p className="text-sm mt-1" style={{ color:'#5A5A5A' }}>{profile!.city ?? 'Sin ciudad registrada'}</p>
              </div>
              {fighter?.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Verificado
                </span>
              )}
            </div>
            {photoFile && <p className="text-xs mt-2 text-amber-600">Foto seleccionada — guarda para aplicar.</p>}
          </div>
        </div>

        {isSetup && !editing && (
          <div className="border-l-4 border-[#C0001E] bg-zinc-50 px-4 py-4 mb-6">
            <p className="text-sm font-semibold text-zinc-900">Completa tu perfil de peleador</p>
            <p className="text-xs text-zinc-500 mt-1">Agrega tu división, disciplina y récord para aparecer en el directorio.</p>
            <button onClick={() => setEditing(true)} className="mt-3 px-4 py-2 text-xs font-bold tracking-widest uppercase text-white" style={{ background:'#C0001E' }}>Configurar perfil</button>
          </div>
        )}

        {error && <div className="mb-6 border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        {/* ── View Mode ── */}
        {!editing && fighter && (
          <div className="space-y-6">
            {/* Record */}
            <div className="grid grid-cols-3 gap-4 border border-zinc-100 p-6 text-center">
              {[{label:'Victorias',value:fighter.record_wins},{label:'Derrotas',value:fighter.record_losses},{label:'Empates',value:fighter.record_draws}].map(({label,value}) => (
                <div key={label}>
                  <p className="text-3xl font-black" style={{ fontFamily:'var(--font-barlow-condensed)', letterSpacing:'-1px' }}>{value}</p>
                  <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color:'#5A5A5A' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Disciplines pills */}
            {fighter.disciplines && fighter.disciplines.length > 0 && (
              <div className="border border-zinc-100 p-6 mb-4">
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#9A9A9A' }}>Disciplinas</p>
                <div className="flex flex-wrap gap-2">
                  {fighter.disciplines.map(d => (
                    <span key={d} className="text-xs font-bold px-3 py-1.5 uppercase tracking-wide bg-[#0A0A0A] text-white">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4 border border-zinc-100 p-6">
              {[
                { label:'División', value: fighter.weight_class ? (WEIGHT_LABELS[fighter.weight_class] ?? fighter.weight_class) : '—' },
                { label:'Gimnasio', value: fighter.gym_name ?? '—' },
                { label:'Peso exacto', value: fighter.exact_weight ? `${fighter.exact_weight} kg` : '—' },
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
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>Aviso corto</p>
                <span className={`text-xs font-semibold px-2 py-1 ${fighter.short_notice_ready ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {fighter.short_notice_ready ? 'Listo' : 'No'}
                </span>
              </div>
              {fighter.available_from && (
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>Disponible desde</p>
                  <p className="text-sm text-zinc-900">{fighter.available_from}</p>
                </div>
              )}
              {fighter.available_to && (
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>Disponible hasta</p>
                  <p className="text-sm text-zinc-900">{fighter.available_to}</p>
                </div>
              )}
            </div>

            {/* Bio */}
            {fighter.bio && (
              <div className="border border-zinc-100 p-6">
                <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#9A9A9A' }}>Bio</p>
                <p className="text-sm text-zinc-700 leading-relaxed">{fighter.bio}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">Editar perfil</button>
            </div>
          </div>
        )}

        {/* ── Edit / Setup Form ── */}
        {editing && (
          <div className="space-y-5">
            {/* Nickname */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Apodo (opcional)</label>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder='Ej. "El Tigre"'
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>

            {/* Weight class */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>División / Peso</label>
              <select value={weightClass} onChange={e => setWeightClass(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                <option value="">— Selecciona una división —</option>
                {WEIGHT_CLASSES.map(wc => <option key={wc} value={wc}>{WEIGHT_LABELS[wc]}</option>)}
              </select>
            </div>

            {/* Disciplines — multi-select checkboxes */}
            <div className="col-span-2">
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>Disciplinas</label>
              <div className="flex flex-wrap gap-2">
                {DISCIPLINES.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDisciplines(prev =>
                      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                    )}
                    className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                      disciplines.includes(d)
                        ? 'bg-[#C0001E] text-white border-[#C0001E]'
                        : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Gym */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Gimnasio</label>
              <input type="text" value={gymName} onChange={e => setGymName(e.target.value)} placeholder="Nombre del gimnasio"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>

            {/* Physical stats */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Estadísticas físicas</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:'Peso (kg)', val:exactWeight, set:setExactWeight, step:'0.1' },
                  { label:'Estatura (cm)', val:heightCm, set:setHeightCm, step:'1' },
                  { label:'Envergadura (cm)', val:reachCm, set:setReachCm, step:'1' },
                ].map(({ label, val, set: setter, step }) => (
                  <div key={label}>
                    <p className="text-xs text-zinc-400 mb-1">{label}</p>
                    <input type="number" min="0" step={step} value={val} onChange={e => setter(e.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm text-center focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                  </div>
                ))}
              </div>
            </div>

            {/* Record */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Récord (V – D – E)</label>
              <div className="grid grid-cols-3 gap-3">
                {[{label:'Victorias',val:wins,set:setWins},{label:'Derrotas',val:losses,set:setLosses},{label:'Empates',val:draws,set:setDraws}].map(({ label, val, set: setter }) => (
                  <div key={label}>
                    <p className="text-xs text-zinc-400 mb-1">{label}</p>
                    <input type="number" min="0" value={val} onChange={e => setter(e.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm text-center focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                  </div>
                ))}
              </div>
            </div>

            {/* Availability window */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Ventana de disponibilidad</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Desde</p>
                  <input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)}
                    className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Hasta</p>
                  <input type="date" value={availableTo} onChange={e => setAvailableTo(e.target.value)}
                    className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </div>
              </div>
            </div>

            {/* Availability toggle */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>Disponibilidad</label>
              <div className="flex gap-3">
                {[{label:'Disponible',value:true},{label:'No disponible',value:false}].map(({label,value}) => (
                  <button key={String(value)} type="button" onClick={() => setIsAvailable(value)}
                    className={`flex-1 py-2 text-sm font-semibold border transition-colors ${isAvailable===value ? 'border-[#C0001E] text-white bg-[#C0001E]' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Short notice toggle */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>Aviso Corto</label>
              <div className="flex gap-3">
                {[{label:'Listo',value:true},{label:'No',value:false}].map(({label,value}) => (
                  <button key={String(value)} type="button" onClick={() => setShortNotice(value)}
                    className={`flex-1 py-2 text-sm font-semibold border transition-colors ${shortNotice===value ? 'border-[#C0001E] text-white bg-[#C0001E]' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience level */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>Nivel</label>
              <div className="flex gap-3">
                {([{label:'Amateur',value:'amateur'},{label:'Pro',value:'pro'}] as const).map(({label,value}) => (
                  <button key={value} type="button" onClick={() => setExperienceLevel(value)}
                    className={`flex-1 py-2 text-sm font-bold uppercase tracking-widest border transition-colors ${experienceLevel===value ? 'border-[#C0001E] text-white bg-[#C0001E]' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Cuéntanos sobre ti..."
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none" />
            </div>

            {/* Representation */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#5A5A5A' }}>Representacion actual</label>
              <div className="space-y-4">
                {/* Manager */}
                <div className="border border-zinc-200 p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasManager} onChange={e => setHasManager(e.target.checked)}
                      className="w-4 h-4 border-zinc-300 text-[#C0001E] focus:ring-[#C0001E]" />
                    <span className="text-sm font-semibold text-zinc-900">Tengo Manager</span>
                  </label>
                  {hasManager && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Nombre</p>
                        <input type="text" value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Nombre completo"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Correo</p>
                        <input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="correo@ejemplo.com"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Telefono</p>
                        <input type="tel" value={managerPhone} onChange={e => setManagerPhone(e.target.value)} placeholder="+52 000 000 0000"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Promoter */}
                <div className="border border-zinc-200 p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasPromoter} onChange={e => setHasPromoter(e.target.checked)}
                      className="w-4 h-4 border-zinc-300 text-[#C0001E] focus:ring-[#C0001E]" />
                    <span className="text-sm font-semibold text-zinc-900">Tengo Promotor</span>
                  </label>
                  {hasPromoter && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Nombre</p>
                        <input type="text" value={promoterName} onChange={e => setPromoterName(e.target.value)} placeholder="Nombre completo"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Correo</p>
                        <input type="email" value={promoterEmail} onChange={e => setPromoterEmail(e.target.value)} placeholder="correo@ejemplo.com"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Telefono</p>
                        <input type="tel" value={promoterPhone} onChange={e => setPromoterPhone(e.target.value)} placeholder="+52 000 000 0000"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Sponsor */}
                <div className="border border-zinc-200 p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasSponsor} onChange={e => setHasSponsor(e.target.checked)}
                      className="w-4 h-4 border-zinc-300 text-[#C0001E] focus:ring-[#C0001E]" />
                    <span className="text-sm font-semibold text-zinc-900">Tengo Sponsor</span>
                  </label>
                  {hasSponsor && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Nombre</p>
                        <input type="text" value={sponsorName} onChange={e => setSponsorName(e.target.value)} placeholder="Nombre completo"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Correo</p>
                        <input type="email" value={sponsorEmail} onChange={e => setSponsorEmail(e.target.value)} placeholder="correo@ejemplo.com"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Telefono</p>
                        <input type="tel" value={sponsorPhone} onChange={e => setSponsorPhone(e.target.value)} placeholder="+52 000 000 0000"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {fighter && (
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">Cancelar</button>
              )}
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50 transition-colors"
                style={{ background: saving ? '#9A9A9A' : '#C0001E' }}>
                {saving ? 'Guardando...' : isSetup ? 'Crear perfil' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* ── Inbox: Fight Requests (Realtime) ── */}
        {fighter && (
          <div className="mt-10">
            <div className="border-t border-zinc-100 pt-8">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#C0001E' }}>Solicitudes de Pelea</p>
              {requestsLoading ? (
                <p className="text-sm text-zinc-400">Cargando...</p>
              ) : requests.length === 0 ? (
                <div className="border border-dashed border-zinc-200 py-8 text-center">
                  <p className="text-sm text-zinc-400">No tienes solicitudes de pelea aún.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => {
                    const s = STATUS_LABELS[req.status] ?? { label: req.status, cls: 'bg-zinc-100 text-zinc-500' };
                    return (
                      <div key={req.id} className="border border-zinc-200 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">{req.events?.event_name ?? 'Evento desconocido'}</p>
                            <p className="text-xs mt-0.5" style={{ color:'#5A5A5A' }}>
                              Promotor: {req.profiles?.full_name ?? '—'}
                              {req.events?.event_date ? ` · ${req.events.event_date}` : ''}
                              {req.events?.city ? ` · ${req.events.city}` : ''}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 flex-shrink-0 ${s.cls}`}>{s.label}</span>
                        </div>
                        {req.message && <p className="text-xs text-zinc-600 bg-zinc-50 px-3 py-2 mb-3">&ldquo;{req.message}&rdquo;</p>}
                        {req.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleRequestStatus(req.id,'declined')} disabled={updatingId===req.id}
                              className="px-3 py-1.5 text-xs font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                              Rechazar
                            </button>
                            <button onClick={() => handleRequestStatus(req.id,'accepted')} disabled={updatingId===req.id}
                              className="px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
                              {updatingId===req.id ? '...' : 'Aceptar'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Mis Aplicaciones a Eventos ── */}
        {fighter && (
          <div className="mt-10">
            <div className="border-t border-zinc-100 pt-8">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#C0001E' }}>Mis Aplicaciones a Eventos</p>
              {appsLoading ? (
                <p className="text-sm text-zinc-400">Cargando...</p>
              ) : myApplications.length === 0 ? (
                <div className="border border-dashed border-zinc-200 py-8 text-center">
                  <p className="text-sm text-zinc-400">No has aplicado a ningún evento aún.</p>
                  <a href="/events" className="mt-3 inline-block text-xs font-bold tracking-widest uppercase text-white px-4 py-2 transition-colors" style={{ background:'#C0001E' }}>
                    Ver eventos
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {myApplications.map((app) => {
                    const appStatuses: Record<string, { label: string; cls: string }> = {
                      pending:   { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700' },
                      accepted:  { label: 'Aceptado',   cls: 'bg-emerald-50 text-emerald-700' },
                      declined:  { label: 'Rechazado',  cls: 'bg-red-50 text-red-700' },
                      withdrawn: { label: 'Retirado',   cls: 'bg-zinc-100 text-zinc-500' },
                    };
                    const s = appStatuses[app.status] ?? { label: app.status, cls: 'bg-zinc-100 text-zinc-500' };
                    return (
                      <div key={app.id} className="border border-zinc-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">{app.events?.event_name ?? '—'}</p>
                            <p className="text-xs mt-0.5" style={{ color:'#5A5A5A' }}>
                              {app.events?.event_date ?? '—'}{app.events?.city ? ` · ${app.events.city}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`text-xs font-bold px-2 py-1 ${s.cls}`}>{s.label}</span>
                            {app.status === 'pending' && (
                              <button
                                onClick={() => handleWithdrawApplication(app.id)}
                                disabled={withdrawingId === app.id}
                                className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                                {withdrawingId === app.id ? '...' : 'Retirar'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Delete Account ── */}
        <div className="mt-12 border-t border-zinc-100 pt-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-2 text-red-600">Zona de peligro</p>
          <p className="text-sm text-zinc-500 mb-4">Eliminar tu cuenta es permanente. Se borrarán todos tus datos y no podrás recuperarlos.</p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            Eliminar cuenta
          </button>
        </div>

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white max-w-sm w-full p-6 shadow-lg">
              <h3 className="text-lg font-black uppercase mb-2">Eliminar cuenta</h3>
              <p className="text-sm text-zinc-600 mb-6">
                Esta acción es irreversible. Se eliminarán tu perfil, datos y toda la información asociada a tu cuenta. ¿Estás seguro?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
