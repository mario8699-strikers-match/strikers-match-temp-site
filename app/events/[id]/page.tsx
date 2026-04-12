'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { eventService } from '@/services/eventService';
import { authService } from '@/services/authService';
import { fighterService } from '@/services/fighterService';
import { supabase } from '@/lib/supabaseClient';
import { getRecommendedFighters } from '@/services/matchmakingService';
import { findEmergencyReplacements, sendQuickRequest } from '@/services/emergencyMatchService';
import { checkCanSendRequest, recordRequestUsed } from '@/services/subscriptionService';
import { registerForEvent, submitPayment, getFighterRegistration } from '@/services/registrationService';
import { requestService } from '@/services/requestService';
import type { Event, EventFormData, EventApplication, Profile, Fighter, MatchResult, EmergencyMatchResult, MatchRequest, EventRegistration } from '@/types';

const WEIGHT_CLASSES = [
  'minimosca','mosca','supermosca','gallo','supergallo',
  'pluma','superpluma','ligero','superligero','welter',
  'superwelter','medio','supermedio','semipesado','crucero','pesado','multiple',
];

const DISCIPLINES = [
  'Boxeo','Muay Thai','MMA','Kickboxing','Karate','Judo','Lucha Libre',
  'Lima Lama','Jiu-Jitsu','Point Fight','Bare Knuckle','K1',
  'Light Contact','Kick Light','Low Kick','Full Contact','Otro',
];

const STATUSES: EventFormData['status'][] = ['draft', 'published', 'cancelled', 'completed'];

const BOXING_WEIGHT_GROUPS = [
  {
    group: 'Infantil 6–7 años',
    weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'],
  },
  {
    group: 'Infantil 8–9 años',
    weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'],
  },
  {
    group: 'Infantil 10–11 años',
    weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'],
  },
  {
    group: 'Infantil 12 años',
    weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'],
  },
  {
    group: 'Juvenil 13–14 años (Junior)',
    weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'],
  },
  {
    group: 'Juvenil 15–17 años',
    weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'],
  },
  {
    group: 'Adultos 18+ años',
    weights: [
      '48 kg — Mini mosca', '51 kg — Mosca', '54 kg — Gallo', '57 kg — Pluma',
      '60 kg — Ligero', '63.5 kg — Súper ligero', '67 kg — Welter', '71 kg — Súper welter',
      '75 kg — Medio', '80 kg — Semi pesado', '86 kg', '92 kg', '+92 kg — Pesado',
    ],
  },
];

const MUAY_THAI_WEIGHT_GROUPS = [
  {
    group: 'Infantil 6–7 años',
    weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'],
  },
  {
    group: 'Infantil 8–9 años',
    weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'],
  },
  {
    group: 'Infantil 10–11 años',
    weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'],
  },
  {
    group: 'Infantil 12 años',
    weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'],
  },
  {
    group: 'Juvenil 13–14 años',
    weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'],
  },
  {
    group: 'Juvenil 15–17 años',
    weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'],
  },
  {
    group: 'Adultos 18+ años',
    weights: ['48 kg', '51 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '81 kg', '86 kg', '91 kg', '+91 kg'],
  },
];

const MMA_WEIGHT_GROUPS = [
  {
    group: 'Infantil 6–7 años',
    weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'],
  },
  {
    group: 'Infantil 8–9 años',
    weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'],
  },
  {
    group: 'Infantil 10–11 años',
    weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'],
  },
  {
    group: 'Infantil 12 años',
    weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'],
  },
  {
    group: 'Juvenil 13–14 años',
    weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'],
  },
  {
    group: 'Juvenil 15–17 años',
    weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'],
  },
  {
    group: 'Adultos 18+ años',
    weights: [
      '52 kg — Mosca', '56.7 kg — Gallo', '61.2 kg — Pluma', '65.8 kg — Ligero',
      '70.3 kg — Welter', '77.1 kg — Medio', '83.9 kg — Semi pesado',
      '93 kg — Pesado ligero', '120 kg — Pesado',
    ],
  },
];

const K1_WEIGHT_GROUPS = [
  {
    group: 'Infantil 6–7 años',
    weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'],
  },
  {
    group: 'Infantil 8–9 años',
    weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'],
  },
  {
    group: 'Infantil 10–11 años',
    weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'],
  },
  {
    group: 'Infantil 12 años',
    weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'],
  },
  {
    group: 'Juvenil 13–14 años',
    weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'],
  },
  {
    group: 'Juvenil 15–17 años',
    weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'],
  },
  {
    group: 'Adultos 18+ años',
    weights: ['51 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '81 kg', '86 kg', '91 kg', '+91 kg'],
  },
];

const BJJ_WEIGHT_GROUPS = [
  {
    group: 'Infantil 4–5 años',
    weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'],
  },
  {
    group: 'Infantil 6–7 años',
    weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'],
  },
  {
    group: 'Infantil 8–9 años',
    weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'],
  },
  {
    group: 'Infantil 10–11 años',
    weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'],
  },
  {
    group: 'Infantil 12 años',
    weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'],
  },
  {
    group: 'Juvenil 13–14 años',
    weights: ['-48 kg', '-52 kg', '-57 kg', '-63 kg', '-69 kg', '-75 kg', '-81 kg', '+81 kg'],
  },
  {
    group: 'Juvenil 15–17 años',
    weights: ['-48 kg', '-52 kg', '-57 kg', '-63 kg', '-69 kg', '-75 kg', '-81 kg', '+81 kg'],
  },
  {
    group: 'Adultos 18+ años (GI / No-Gi)',
    weights: [
      '-57 kg — Gallo', '-64 kg — Pluma', '-70 kg — Ligero', '-76 kg — Medio',
      'hasta 82.3 kg — Medio pesado', 'hasta 88.3 kg — Pesado',
      'hasta 94.3 kg — Super pesado', 'hasta 100.5 kg — Pesadísimo',
      '+100.5 kg — Ultra pesado / Absoluto',
    ],
  },
];

const BJJ_BELTS_ADULTS = ['Blanca', 'Azul', 'Morada', 'Cafe', 'Negra', 'Roja y Negra (Coral)', 'Roja y Blanca (Coral)', 'Roja'];

const BJJ_BELTS_KIDS = ['Blanca', 'Blanca/Gris', 'Blanca/Amarillo', 'Blanca/Naranja', 'Blanca/Verde', 'Gris', 'Amarilla', 'Naranja', 'Verde'];

const STATUS_COLORS: Record<Event['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  published: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  completed: 'bg-blue-50 text-blue-700',
};

const APP_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700' },
  accepted:  { label: 'Aceptado',   cls: 'bg-emerald-50 text-emerald-700' },
  declined:  { label: 'Rechazado',  cls: 'bg-red-50 text-red-700' },
  withdrawn: { label: 'Retirado',   cls: 'bg-zinc-100 text-zinc-500' },
};

type ApplicationWithFighter = EventApplication & {
  fighters: {
    profiles: { full_name: string; city: string | null };
    weight_class: string | null;
    disciplines: string[];
    photo_url: string | null;
  };
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('events');
  const { t: tCommon } = useTranslation('common');

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Auth
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myFighter, setMyFighter] = useState<Fighter | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<EventFormData | null>(null);
  const [editDisciplines, setEditDisciplines] = useState<string[]>([]);
  const [editWeightClasses, setEditWeightClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editFlyerFile, setEditFlyerFile] = useState<File | null>(null);
  const [editFlyerPreview, setEditFlyerPreview] = useState<string | null>(null);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fighter application
  const [myApplication, setMyApplication] = useState<EventApplication | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applyConfirmWeight, setApplyConfirmWeight] = useState(false);
  const [applyConfirmAvailability, setApplyConfirmAvailability] = useState(false);
  const [applyCornerName, setApplyCornerName] = useState('');
  const [applyWeightClass, setApplyWeightClass] = useState('');
  const [applyDiscipline, setApplyDiscipline] = useState('');
  const [applyBelt, setApplyBelt] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // Promoter applications list
  const [applications, setApplications] = useState<ApplicationWithFighter[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [updatingApp, setUpdatingApp] = useState<string | null>(null);

  // Recommended fighters (matchmaking)
  const [recommendations, setRecommendations] = useState<MatchResult[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  // Emergency replacement
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyResults, setEmergencyResults] = useState<EmergencyMatchResult[]>([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<Set<string>>(new Set());
  const [sendingEmergency, setSendingEmergency] = useState(false);
  const [emergencyConfirm, setEmergencyConfirm] = useState(false);
  const [emergencySentIds, setEmergencySentIds] = useState<Set<string>>(new Set());
  const [emergencyFeedback, setEmergencyFeedback] = useState<string | null>(null);

  // Realtime fight requests
  const [eventRequests, setEventRequests] = useState<MatchRequest[]>([]);

  // Monetization paywall
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');

  // Event registration (payment tracking)
  const [myRegistration, setMyRegistration] = useState<EventRegistration | null>(null);
  const [registering, setRegistering] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      eventService.getById(id),
      authService.getSession(),
    ]).then(async ([{ data: ev, error: evErr }, { data: session }]) => {
      if (evErr || !ev) { setLoadError(t('events.errors.loadFailed')); setLoading(false); return; }
      setEvent(ev);
      setLoading(false);

      const p = session?.profile ?? null;
      setProfile(p);

      if (p?.role === 'fighter') {
        // Get fighter record + existing application
        const { data: f } = await fighterService.getByProfileId(p.id);
        setMyFighter(f ?? null);
        if (f) {
          const { data: app } = await eventService.getMyApplicationForEvent(id, f.id);
          setMyApplication(app ?? null);

          // Check event registration (payment tracking)
          const { data: reg } = await getFighterRegistration(id, f.id);
          setMyRegistration(reg ?? null);
        }
      }

      if (p && (ev.promoter_id === p.id || p.role === 'admin')) {
        // Load applicants
        setAppsLoading(true);
        const { data: apps } = await eventService.getApplicationsForEvent(id);
        setApplications((apps ?? []) as ApplicationWithFighter[]);
        setAppsLoading(false);

        // Load recommended fighters
        setRecsLoading(true);
        const { data: recs } = await getRecommendedFighters(ev);
        setRecommendations(recs);
        setRecsLoading(false);

        // Load existing match requests for this event
        const { data: reqs } = await requestService.getByEvent(id);
        setEventRequests((reqs ?? []) as MatchRequest[]);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Supabase Realtime: fight request status updates ──
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`requests-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_requests', filter: `event_id=eq.${id}` },
        async () => {
          const { data: reqs } = await requestService.getByEvent(id);
          setEventRequests((reqs ?? []) as MatchRequest[]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Emergency replacement handler ──
  const handleFindEmergency = useCallback(async () => {
    if (!event) return;
    setEmergencyOpen(true);
    setEmergencyLoading(true);
    setEmergencyFeedback(null);
    const { data } = await findEmergencyReplacements(event);
    setEmergencyResults(data);
    setEmergencyLoading(false);
  }, [event]);

  const toggleEmergencySelect = (fighterId: string) => {
    setSelectedEmergency((prev) => {
      const next = new Set(prev);
      if (next.has(fighterId)) next.delete(fighterId);
      else next.add(fighterId);
      return next;
    });
  };

  const handleBatchEmergencySend = async () => {
    if (!profile || !event || selectedEmergency.size === 0) return;

    // Monetization check
    const subCheck = await checkCanSendRequest(profile.id);
    if (!subCheck.allowed) {
      setPaywallReason(subCheck.reason);
      setShowPaywall(true);
      return;
    }

    setSendingEmergency(true);
    let sentCount = 0;
    for (const fighterId of selectedEmergency) {
      if (emergencySentIds.has(fighterId)) continue;
      const { error } = await sendQuickRequest(fighterId, event.id, profile.id);
      if (!error) {
        sentCount++;
        setEmergencySentIds((prev) => new Set(prev).add(fighterId));
        await recordRequestUsed(profile.id);
      }
    }
    setSendingEmergency(false);
    setSelectedEmergency(new Set());
    setEmergencyConfirm(false);
    setEmergencyFeedback(`${sentCount} solicitud${sentCount !== 1 ? 'es' : ''} enviada${sentCount !== 1 ? 's' : ''} con exito.`);
  };

  // ── Monetized request send (for recommended fighters) ──
  const handleSendRecommendedRequest = async (fighterId: string) => {
    if (!profile || !event) return;

    const subCheck = await checkCanSendRequest(profile.id);
    if (!subCheck.allowed) {
      setPaywallReason(subCheck.reason);
      setShowPaywall(true);
      return;
    }

    const { error } = await sendQuickRequest(fighterId, event.id, profile.id);
    if (!error) {
      await recordRequestUsed(profile.id);
      // Refresh requests
      const { data: reqs } = await requestService.getByEvent(event.id);
      setEventRequests((reqs ?? []) as MatchRequest[]);
    }
  };

  const enterEdit = () => {
    if (!event) return;
    setFormData({
      event_name: event.event_name,
      event_date: event.event_date ?? '',
      event_time: event.event_time ?? '',
      city: event.city ?? '',
      venue: event.venue ?? '',
      weight_class_needed: event.weight_class_needed ?? '',
      weight_classes_needed: event.weight_classes_needed ?? [],
      disciplines_needed: event.disciplines_needed ?? [],
      purse_amount: event.purse_amount !== null ? String(event.purse_amount) : '',
      purse_enabled: event.purse_amount !== null,
      signup_fee: event.signup_fee !== null ? String(event.signup_fee) : '',
      notes: event.notes ?? '',
      status: event.status,
    });
    setEditDisciplines(event.disciplines_needed ?? []);
    setEditWeightClasses(event.weight_classes_needed ?? []);
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormData(null);
    setSaveError(null);
    setEditFlyerFile(null);
    setEditFlyerPreview(null);
  };

  const set = (key: keyof EventFormData, value: string) =>
    setFormData((prev) => prev ? { ...prev, [key]: value } : prev);

  const handleEditFlyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setEditFlyerFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEditFlyerPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setEditFlyerPreview(null);
    }
  };

  const handleSave = async () => {
    if (!formData || !id) return;
    if (!formData.event_name.trim()) { setSaveError(t('events.errors.nameRequired')); return; }
    setSaving(true);
    setSaveError(null);

    let flyerUrl: string | null | undefined = undefined;
    if (editFlyerFile) {
      const { data: url, error: uploadError } = await eventService.uploadFlyer(editFlyerFile);
      if (uploadError) { setSaveError('Failed to upload flyer.'); setSaving(false); return; }
      flyerUrl = url;
    }

    const payload = {
      ...formData,
      disciplines_needed: editDisciplines,
      weight_classes_needed: editWeightClasses,
      ...(flyerUrl !== undefined ? { flyer_url: flyerUrl } : {}),
    };

    const { data, error } = await eventService.update(id, payload);
    setSaving(false);
    if (error) {
      setSaveError(t('events.errors.generic'));
    } else if (data) {
      setEvent(data);
      setEditing(false);
      setFormData(null);
      setEditFlyerFile(null);
      setEditFlyerPreview(null);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    const { error } = await eventService.delete(id);
    setDeleting(false);
    if (error) { setShowDeleteConfirm(false); setSaveError(t('events.errors.deleteFailed')); }
    else window.location.href = '/events';
  };

  const handleApply = async () => {
    if (!myFighter || !id) return;
    setApplying(true);
    setApplyError(null);
    const { data, error } = await eventService.applyToEvent(id, myFighter.id, {
      message: applyMessage,
      fighter_discipline: applyDiscipline || undefined,
      fighter_weight_class: applyWeightClass || undefined,
      jiu_jitsu_belt: applyBelt || undefined,
      confirm_weight: applyConfirmWeight,
      confirm_availability: applyConfirmAvailability,
      corner_name: applyCornerName,
    });
    setApplying(false);
    if (error) { setApplyError('No se pudo enviar la solicitud. Intenta de nuevo.'); }
    else { setMyApplication(data); setApplyOpen(false); setApplyMessage(''); setApplyCornerName(''); setApplyConfirmWeight(false); setApplyConfirmAvailability(false); setApplyWeightClass(''); setApplyDiscipline(''); setApplyBelt(''); }
  };

  const handleWithdraw = async () => {
    if (!myApplication) return;
    setWithdrawing(true);
    await eventService.withdrawApplication(myApplication.id);
    setMyApplication((prev) => prev ? { ...prev, status: 'withdrawn' } : prev);
    setWithdrawing(false);
  };

  const handleAppStatus = async (appId: string, status: 'accepted' | 'declined') => {
    setUpdatingApp(appId);
    await eventService.updateApplicationStatus(appId, status);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
    setUpdatingApp(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('events.detail.notSpecified');
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const formatPurse = (amount: number | null) => {
    if (!amount) return t('events.detail.notSpecified');
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-zinc-400 text-sm">{tCommon('common.loading')}</p></div>;
  if (loadError || !event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-zinc-900 font-medium">{loadError ?? t('events.errors.loadFailed')}</p>
          <a href="/events" className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900 underline">{t('events.backToEvents')}</a>
        </div>
      </div>
    );
  }

  const isOwner = profile && (event.promoter_id === profile.id || profile.role === 'admin');
  const isFighter = profile?.role === 'fighter';

  // Discipline mismatch warning for fighters
  const eventDisciplines = event.disciplines_needed ?? [];
  const fighterDisciplines = myFighter?.disciplines ?? [];
  const hasMismatch = isFighter && myFighter && eventDisciplines.length > 0 &&
    !fighterDisciplines.some((d) => eventDisciplines.includes(d));

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="events" />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10 w-full">
        {/* Breadcrumb */}
        <div className="mb-6">
          <a href="/events" className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('events.backToEvents')}
          </a>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-900">{event.event_name}</h1>
            <span className={`px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status]}`}>
              {t(`events.status.${event.status}`)}
            </span>
          </div>
          {isOwner && !editing && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={enterEdit} className="px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 transition-colors">
                {t('events.editEvent')}
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                {t('events.deleteEvent')}
              </button>
            </div>
          )}
        </div>

        {saveError && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{saveError}</div>}

        {/* ── View Mode ── */}
        {!editing ? (
          <div className="space-y-6">
            {/* Flyer */}
            {event.flyer_url && (
              <div className="border border-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.flyer_url} alt={`Flyer — ${event.event_name}`} className="w-full object-contain max-h-[480px] bg-zinc-50" />
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-6 border border-zinc-100 p-6">
              <DetailRow label={t('events.detail.date')} value={formatDate(event.event_date)} />
              <DetailRow label="Hora de inicio" value={event.event_time ? event.event_time.slice(0, 5) + ' hrs' : t('events.detail.notSpecified')} />
              <DetailRow label={t('events.detail.city')} value={event.city ?? t('events.detail.notSpecified')} />
              <DetailRow label={t('events.detail.venue')} value={event.venue ?? t('events.detail.notSpecified')} />
              <DetailRow
                label="Cuota de inscripción"
                value={event.signup_fee ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(event.signup_fee) : 'Gratuito'}
              />
              {event.purse_amount !== null && (
                <DetailRow label={t('events.detail.purse')} value={formatPurse(event.purse_amount)} />
              )}
              <DetailRow label={t('events.fields.status')} value={t(`events.status.${event.status}`)} />
            </div>

            {/* Weight classes needed pills */}
            {(event.weight_classes_needed ?? []).length > 0 && (
              <div className="border border-zinc-100 p-6">
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9A9A9A' }}>Categorías de peso requeridas</p>
                <div className="flex flex-wrap gap-2">
                  {(event.weight_classes_needed ?? []).map((wc) => (
                    <span key={wc} className="text-xs font-bold px-3 py-1.5 uppercase tracking-wide bg-[#0A0A0A] text-white">
                      {t(`events.weightClasses.${wc}`, { defaultValue: wc })}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Disciplines needed pills */}
            {eventDisciplines.length > 0 && (
              <div className="border border-zinc-100 p-6">
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9A9A9A' }}>Disciplinas requeridas</p>
                <div className="flex flex-wrap gap-2">
                  {eventDisciplines.map((d) => (
                    <span key={d} className="text-xs font-bold px-3 py-1.5 uppercase tracking-wide bg-[#0A0A0A] text-white">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {event.notes && (
              <div className="border border-zinc-100 p-6">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">{t('events.detail.notes')}</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{event.notes}</p>
              </div>
            )}

            {/* ── Fighter: Apply CTA ── */}
            {isFighter && myFighter && event.status === 'published' && (
              <div className="border border-zinc-100 p-6">
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#C0001E' }}>Aplicar a este evento</p>

                {/* Discipline mismatch warning */}
                {hasMismatch && (
                  <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 px-4 py-3">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-amber-700">
                      <span className="font-bold">Disciplina no coincide.</span> Este evento requiere {eventDisciplines.join(', ')} pero tus disciplinas son {fighterDisciplines.length > 0 ? fighterDisciplines.join(', ') : 'no especificadas'}. Puedes aplicar de todas formas.
                    </p>
                  </div>
                )}

                {!myApplication || myApplication.status === 'withdrawn' ? (
                  applyOpen ? (
                    <div className="space-y-4">
                      {/* Signup fee notice */}
                      {event.signup_fee && (
                        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-4 py-3">
                          <svg className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-zinc-700">
                            <span className="font-bold">Cuota de inscripción:</span>{' '}
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(event.signup_fee)} — El promotor te contactará con instrucciones de pago.
                          </p>
                        </div>
                      )}

                      {/* Discipline selector */}
                      {(event.disciplines_needed ?? []).length > 0 && (
                        <div>
                          <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>
                            Disciplina con la que compites <span className="text-red-500">*</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {(event.disciplines_needed ?? []).map((d) => (
                              <button key={d} type="button"
                                onClick={() => { setApplyDiscipline(d); setApplyWeightClass(''); }}
                                className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                                  applyDiscipline === d
                                    ? 'bg-[#C0001E] text-white border-[#C0001E]'
                                    : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                                }`}>
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Weight class selector — discipline-aware */}
                      <div>
                        <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>
                          Categoría de peso <span className="text-red-500">*</span>
                        </label>

                        {['Boxeo', 'Kickboxing', 'Light Contact', 'Low Kick', 'Kick Light', 'Point Fight', 'Full Contact'].includes(applyDiscipline) || ['Muay Thai', 'MMA', 'Jiu-Jitsu', 'K1'].includes(applyDiscipline) ? (
                          /* Striking / grappling disciplines: grouped by age/division */
                          <div className="space-y-4">
                            {(applyDiscipline === 'Muay Thai'
                              ? MUAY_THAI_WEIGHT_GROUPS
                              : applyDiscipline === 'MMA'
                              ? MMA_WEIGHT_GROUPS
                              : applyDiscipline === 'K1'
                              ? K1_WEIGHT_GROUPS
                              : applyDiscipline === 'Jiu-Jitsu'
                              ? BJJ_WEIGHT_GROUPS
                              : BOXING_WEIGHT_GROUPS
                            ).map((grp) => (
                              <div key={grp.group}>
                                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{grp.group}</p>
                                <div className="flex flex-wrap gap-2">
                                  {grp.weights.map((wc) => (
                                    <button key={wc} type="button"
                                      onClick={() => setApplyWeightClass(wc)}
                                      className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                        applyWeightClass === wc
                                          ? 'bg-[#C0001E] text-white border-[#C0001E]'
                                          : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                                      }`}>
                                      {wc}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* All other disciplines: generic flat list */
                          <div className="flex flex-wrap gap-2">
                            {WEIGHT_CLASSES.map((wc) => (
                              <button key={wc} type="button"
                                onClick={() => setApplyWeightClass(wc)}
                                className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                                  applyWeightClass === wc
                                    ? 'bg-[#C0001E] text-white border-[#C0001E]'
                                    : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                                }`}>
                                {t(`events.weightClasses.${wc}`, { defaultValue: wc })}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* BJJ Belt selector — only when event requires Jiu-Jitsu */}
                      {(event.disciplines_needed ?? []).includes('Jiu-Jitsu') && (
                        <div>
                          <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>
                            Cinta de Jiu-Jitsu <span className="text-red-500">*</span>
                          </label>

                          {/* Adults */}
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Adultos (16+)</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {BJJ_BELTS_ADULTS.map((b) => {
                              const key = `adult-${b}`;
                              return (
                                <button key={key} type="button"
                                  onClick={() => setApplyBelt(applyBelt === key ? '' : key)}
                                  className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                    applyBelt === key ? 'bg-[#C0001E] text-white border-[#C0001E]' : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500'
                                  }`}>
                                  {b}
                                </button>
                              );
                            })}
                          </div>

                          {/* Kids */}
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Niños (4–15)</p>
                          <div className="flex flex-wrap gap-2">
                            {BJJ_BELTS_KIDS.map((b) => {
                              const key = `kids-${b}`;
                              return (
                                <button key={key} type="button"
                                  onClick={() => setApplyBelt(applyBelt === key ? '' : key)}
                                  className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                    applyBelt === key ? 'bg-[#C0001E] text-white border-[#C0001E]' : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500'
                                  }`}>
                                  {b}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Corner / Team name */}
                      <div>
                        <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Nombre del equipo / córner <span className="text-zinc-400 font-normal normal-case tracking-normal">(opcional)</span></label>
                        <input
                          type="text"
                          value={applyCornerName}
                          onChange={(e) => setApplyCornerName(e.target.value)}
                          placeholder="Ej. Team Tazmania, Azteca Boxing..."
                          className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      {/* Message */}
                      <div>
                        <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Mensaje al promotor <span className="text-zinc-400 font-normal normal-case tracking-normal">(opcional)</span></label>
                        <textarea
                          value={applyMessage}
                          onChange={(e) => setApplyMessage(e.target.value)}
                          rows={3}
                          placeholder="Preséntate, menciona tu experiencia..."
                          className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                        />
                      </div>

                      {/* Confirmations */}
                      <div className="space-y-2">
                        {(event.weight_classes_needed ?? []).length > 0 && (
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={applyConfirmWeight}
                              onChange={(e) => setApplyConfirmWeight(e.target.checked)}
                              className="mt-0.5 h-4 w-4 accent-[#C0001E] flex-shrink-0"
                            />
                            <span className="text-xs text-zinc-700">
                              Confirmo que puedo pelear en{' '}
                              {event.weight_classes_needed!.length === 1
                                ? <span className="font-bold">la categoría {event.weight_classes_needed![0]}</span>
                                : <span className="font-bold">alguna de las categorías: {event.weight_classes_needed!.join(', ')}</span>
                              }
                            </span>
                          </label>
                        )}
                        {event.event_date && (
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={applyConfirmAvailability}
                              onChange={(e) => setApplyConfirmAvailability(e.target.checked)}
                              className="mt-0.5 h-4 w-4 accent-[#C0001E] flex-shrink-0"
                            />
                            <span className="text-xs text-zinc-700">
                              Confirmo que estoy disponible el <span className="font-bold">{formatDate(event.event_date)}</span>
                            </span>
                          </label>
                        )}
                      </div>

                      {applyError && <p className="text-xs text-red-600">{applyError}</p>}
                      <div className="flex gap-3">
                        <button onClick={() => { setApplyOpen(false); setApplyError(null); }} className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">
                          Cancelar
                        </button>
                        <button onClick={handleApply} disabled={applying} className="px-5 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50 transition-colors" style={{ background: '#C0001E' }}>
                          {applying ? 'Enviando...' : 'Enviar solicitud'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setApplyOpen(true)} className="px-6 py-2.5 text-sm font-bold tracking-widest uppercase text-white transition-colors" style={{ background: '#C0001E' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#9A0018')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '#C0001E')}>
                      Aplicar a este evento
                    </button>
                  )
                ) : (
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-bold px-3 py-1.5 uppercase tracking-wide ${APP_STATUS_LABELS[myApplication.status]?.cls ?? 'bg-zinc-100 text-zinc-500'}`}>
                      {APP_STATUS_LABELS[myApplication.status]?.label ?? myApplication.status}
                    </span>
                    {myApplication.status === 'pending' && (
                      <button onClick={handleWithdraw} disabled={withdrawing} className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                        {withdrawing ? '...' : 'Retirar solicitud'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Fighter: Event Registration & Payment ── */}
            {profile?.role === 'fighter' && myFighter && event.status === 'published' && event.signup_fee && event.signup_fee > 0 && (
              <div className="border border-zinc-200 p-6 mt-6">
                <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C0001E' }}>Registro y Pago del Evento</p>

                {!myRegistration ? (
                  /* Step 1: Register */
                  <div>
                    <p className="text-sm text-zinc-600 mb-3">
                      Este evento requiere un pago de inscripción de <span className="font-bold text-zinc-900">${event.signup_fee} MXN</span>.
                      Regístrate para recibir las instrucciones de pago.
                    </p>
                    {regError && <p className="text-xs text-red-600 mb-2">{regError}</p>}
                    <button
                      onClick={async () => {
                        setRegistering(true);
                        setRegError(null);
                        const { data, error } = await registerForEvent(event.id, myFighter.id);
                        if (error) setRegError(error);
                        else setMyRegistration(data);
                        setRegistering(false);
                      }}
                      disabled={registering}
                      className="px-5 py-2.5 text-xs font-bold tracking-widest uppercase text-white transition-colors disabled:opacity-50"
                      style={{ background: '#C0001E' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#9A0018')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '#C0001E')}
                    >
                      {registering ? 'Registrando...' : 'Registrarme al Evento'}
                    </button>
                  </div>
                ) : myRegistration.payment_status === 'pending' ? (
                  /* Step 2: Show payment instructions + "I've Paid" button */
                  <div>
                    <div className="bg-zinc-50 border border-zinc-100 p-4 mb-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Instrucciones de Pago</p>
                      <p className="text-sm text-zinc-700 mb-2">
                        Realiza el pago de <span className="font-bold">${event.signup_fee} MXN</span> al promotor del evento.
                      </p>
                      <p className="text-sm text-zinc-500">Contacta al promotor para obtener los datos de pago (transferencia, efectivo, etc.)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-1 bg-amber-50 text-amber-700">PENDIENTE</span>
                      {regError && <p className="text-xs text-red-600">{regError}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        setSubmittingPayment(true);
                        setRegError(null);
                        const { data, error } = await submitPayment(myRegistration.id);
                        if (error) setRegError(error);
                        else setMyRegistration(data);
                        setSubmittingPayment(false);
                      }}
                      disabled={submittingPayment}
                      className="mt-3 px-5 py-2.5 text-xs font-bold tracking-widest uppercase text-white transition-colors disabled:opacity-50"
                      style={{ background: '#0A0A0A' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#333')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '#0A0A0A')}
                    >
                      {submittingPayment ? 'Enviando...' : 'Ya Pagué'}
                    </button>
                  </div>
                ) : myRegistration.payment_status === 'submitted' ? (
                  /* Step 3: Waiting for promoter confirmation */
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-700">PAGO ENVIADO</span>
                      <p className="text-sm text-zinc-500">Esperando confirmación del promotor...</p>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      Enviado: {new Date(myRegistration.submitted_at!).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  /* Step 4: Confirmed */
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-700">PAGO CONFIRMADO</span>
                      <p className="text-sm text-zinc-600">Tu pago ha sido verificado. Estás registrado oficialmente.</p>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      Confirmado: {new Date(myRegistration.confirmed_at!).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Prompt to log in */}
            {!profile && event.status === 'published' && (
              <div className="border border-dashed border-zinc-200 p-6 text-center">
                <p className="text-sm text-zinc-500">
                  <a href="/login" className="font-semibold" style={{ color: '#C0001E' }}>Inicia sesión</a> como peleador para aplicar a este evento.
                </p>
              </div>
            )}

            {/* ── Promoter: Applications ── */}
            {/* ── Promoter: Realtime Fight Requests ── */}
            {isOwner && eventRequests.length > 0 && (
              <div className="border-t border-zinc-100 pt-8">
                <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C0001E' }}>
                  Solicitudes de pelea ({eventRequests.length})
                </p>
                <div className="space-y-2">
                  {eventRequests.map((req) => {
                    const statusMap: Record<string, { label: string; cls: string }> = {
                      pending: { label: 'Esperando respuesta', cls: 'bg-amber-50 text-amber-700' },
                      accepted: { label: 'Aceptado', cls: 'bg-emerald-50 text-emerald-700' },
                      declined: { label: 'Rechazado', cls: 'bg-red-50 text-red-700' },
                      cancelled: { label: 'Cancelado', cls: 'bg-zinc-100 text-zinc-500' },
                    };
                    const s = statusMap[req.status] ?? { label: req.status, cls: 'bg-zinc-100 text-zinc-500' };
                    const fi = (req as unknown as { fighters?: { profiles?: { full_name?: string; city?: string } } }).fighters;
                    return (
                      <div key={req.id} className={`border p-3 flex items-center justify-between gap-3 ${req.status === 'accepted' ? 'border-emerald-300 bg-emerald-50/30' : 'border-zinc-200'}`}>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{fi?.profiles?.full_name ?? 'Peleador'}</p>
                          <p className="text-xs text-zinc-500">{fi?.profiles?.city ?? ''}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 flex-shrink-0 ${s.cls}`}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isOwner && (
              <div className="border-t border-zinc-100 pt-8">
                <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C0001E' }}>
                  Solicitudes ({applications.length})
                </p>
                {appsLoading ? (
                  <p className="text-sm text-zinc-400">Cargando...</p>
                ) : applications.length === 0 ? (
                  <div className="border border-dashed border-zinc-200 py-8 text-center">
                    <p className="text-sm text-zinc-400">No hay solicitudes para este evento aún.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => {
                      const s = APP_STATUS_LABELS[app.status] ?? { label: app.status, cls: 'bg-zinc-100 text-zinc-500' };
                      const f = app.fighters;
                      return (
                        <div key={app.id} className="border border-zinc-200 p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <p className="text-sm font-bold text-zinc-900">{f?.profiles?.full_name ?? '—'}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
                                {f?.weight_class ?? '—'} · {f?.profiles?.city ?? '—'}
                              </p>
                              {app.fighter_discipline && (
                                <p className="text-xs mt-1">
                                  <span className="font-bold text-zinc-700">Disciplina:</span>{' '}
                                  <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-zinc-900 text-white">{app.fighter_discipline}</span>
                                </p>
                              )}
                              {app.fighter_weight_class && (
                                <p className="text-xs mt-1">
                                  <span className="font-bold text-zinc-700">Pelea en:</span>{' '}
                                  <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-[#C0001E] text-white">{app.fighter_weight_class}</span>
                                </p>
                              )}
                              {app.jiu_jitsu_belt && (
                                <p className="text-xs mt-1">
                                  <span className="font-bold text-zinc-700">Cinta BJJ:</span>{' '}
                                  <span className="text-zinc-700">{app.jiu_jitsu_belt.replace('adult-', 'Adulto: ').replace('kids-', 'Niño: ')}</span>
                                </p>
                              )}
                              {f?.disciplines && f.disciplines.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {f.disciplines.map((d) => (
                                    <span key={d} className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-600 uppercase tracking-wide">{d}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 flex-shrink-0 ${s.cls}`}>{s.label}</span>
                          </div>
                          {app.message && <p className="text-xs text-zinc-600 bg-zinc-50 px-3 py-2 mb-3 italic">&ldquo;{app.message}&rdquo;</p>}
                          {app.status === 'pending' && (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleAppStatus(app.id, 'declined')} disabled={updatingApp === app.id}
                                className="px-3 py-1.5 text-xs font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                                Rechazar
                              </button>
                              <button onClick={() => handleAppStatus(app.id, 'accepted')} disabled={updatingApp === app.id}
                                className="px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors" style={{ background: '#C0001E' }}>
                                {updatingApp === app.id ? '...' : 'Aceptar'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Promoter: Recommended Fighters ── */}
            {isOwner && (
              <div className="border-t border-zinc-100 pt-8">
                <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C0001E' }}>
                  Peleadores Recomendados
                </p>
                {recsLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map((i) => (
                      <div key={i} className="border border-zinc-100 p-4 animate-pulse">
                        <div className="h-4 bg-zinc-100 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-zinc-50 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="border border-dashed border-zinc-200 py-8 text-center">
                    <p className="text-sm text-zinc-400">No se encontraron peleadores recomendados para este evento.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendations.map((rec) => {
                      const alreadySent = eventRequests.some((r) => r.fighter_id === rec.fighter.id);
                      const reqStatus = eventRequests.find((r) => r.fighter_id === rec.fighter.id)?.status;
                      return (
                        <div key={rec.fighter.id} className="border border-zinc-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-zinc-900">{rec.fighter.profiles?.full_name ?? '—'}</p>
                                <span className="text-xs font-bold px-2 py-0.5 bg-[#C0001E] text-white">
                                  {rec.match_score}%
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500">
                                {rec.fighter.weight_class ?? '—'} · {rec.fighter.profiles?.city ?? '—'} · {rec.fighter.record_wins}W-{rec.fighter.record_losses}L-{rec.fighter.record_draws}D
                              </p>
                              {rec.match_reasons.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {rec.match_reasons.map((reason, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 bg-zinc-50 text-zinc-600 border border-zinc-100">
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {alreadySent ? (
                                <span className={`text-xs font-bold px-3 py-1.5 ${
                                  reqStatus === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
                                  reqStatus === 'declined' ? 'bg-red-50 text-red-700' :
                                  'bg-amber-50 text-amber-700'
                                }`}>
                                  {reqStatus === 'accepted' ? 'Aceptado' : reqStatus === 'declined' ? 'Rechazado' : 'Enviado'}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSendRecommendedRequest(rec.fighter.id)}
                                  className="px-3 py-1.5 text-xs font-bold tracking-wide uppercase text-white transition-colors"
                                  style={{ background: '#C0001E' }}
                                >
                                  Enviar Solicitud
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Emergency Replacement Button */}
                <button
                  onClick={handleFindEmergency}
                  className="mt-6 w-full px-4 py-3 text-sm font-bold tracking-widest uppercase text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Encontrar Reemplazo de Ultimo Momento
                </button>
              </div>
            )}
          </div>

        ) : (
          /* ── Edit Mode ── */
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('events.fields.event_name')} <span className="text-red-500">*</span></label>
              <input type="text" value={formData!.event_name} onChange={(e) => set('event_name', e.target.value)}
                placeholder={t('events.fields.event_namePlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{t('events.fields.event_date')}</label>
                <input type="date" value={formData!.event_date} onChange={(e) => set('event_date', e.target.value)}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Hora de inicio</label>
                <input type="time" value={formData!.event_time} onChange={(e) => set('event_time', e.target.value)}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{t('events.fields.status')}</label>
                <select value={formData!.status} onChange={(e) => set('status', e.target.value)}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white">
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`events.status.${s}`)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{t('events.fields.city')}</label>
                <input type="text" value={formData!.city} onChange={(e) => set('city', e.target.value)}
                  placeholder={t('events.fields.cityPlaceholder')}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{t('events.fields.venue')}</label>
                <input type="text" value={formData!.venue} onChange={(e) => set('venue', e.target.value)}
                  placeholder={t('events.fields.venuePlaceholder')}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-zinc-700">{t('events.fields.purse_amount')}</label>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => prev ? { ...prev, purse_enabled: !prev.purse_enabled, purse_amount: '' } : prev)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      formData!.purse_enabled ? 'bg-[#C0001E]' : 'bg-zinc-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData!.purse_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                {formData!.purse_enabled ? (
                  <input type="number" min="0" value={formData!.purse_amount} onChange={(e) => set('purse_amount', e.target.value)}
                    placeholder={t('events.fields.purse_amountPlaceholder')}
                    className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm" />
                ) : (
                  <p className="text-xs text-zinc-400">Sin bolsa (desactivado)</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Cuota de inscripción <span className="text-zinc-400 font-normal">(opcional)</span></label>
                <input type="number" min="0" value={formData!.signup_fee} onChange={(e) => set('signup_fee', e.target.value)}
                  placeholder="Ej. 500 (MXN)"
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm" />
                <p className="text-xs text-zinc-400 mt-1">Dejar en blanco si es gratuito</p>
              </div>
            </div>

            {/* Weight classes multi-select */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>Categorías de Peso Requeridas</label>
              <div className="flex flex-wrap gap-2">
                {WEIGHT_CLASSES.map((wc) => (
                  <button key={wc} type="button"
                    onClick={() => setEditWeightClasses((prev) => prev.includes(wc) ? prev.filter((x) => x !== wc) : [...prev, wc])}
                    className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                      editWeightClasses.includes(wc) ? 'bg-[#C0001E] text-white border-[#C0001E]' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                    }`}>
                    {t(`events.weightClasses.${wc}`, { defaultValue: wc })}
                  </button>
                ))}
              </div>
            </div>

            {/* Disciplines multi-select */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>Disciplinas requeridas</label>
              <div className="flex flex-wrap gap-2">
                {DISCIPLINES.map((d) => (
                  <button key={d} type="button"
                    onClick={() => setEditDisciplines((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                    className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                      editDisciplines.includes(d) ? 'bg-[#C0001E] text-white border-[#C0001E]' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Flyer */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Flyer del evento</label>
              {(editFlyerPreview ?? event.flyer_url) && (
                <div className="mb-2 border border-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editFlyerPreview ?? event.flyer_url!} alt="Flyer" className="w-full max-h-48 object-contain bg-zinc-50" />
                  {editFlyerPreview && <p className="text-xs text-center text-zinc-400 py-1 border-t border-zinc-100">Nuevo flyer seleccionado</p>}
                </div>
              )}
              <div className="border-2 border-dashed border-zinc-300 p-4 text-center cursor-pointer hover:border-zinc-400 transition-colors"
                onClick={() => document.getElementById('edit-flyer-input')?.click()}>
                <p className="text-sm text-zinc-500">{event.flyer_url ? 'Haz clic para reemplazar el flyer' : 'Sube el flyer del evento'}</p>
                <p className="text-xs text-zinc-400 mt-1">PNG, JPG, WEBP · Máx. 5MB</p>
              </div>
              <input id="edit-flyer-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleEditFlyerChange} className="hidden" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('events.fields.notes')}</label>
              <textarea rows={4} value={formData!.notes} onChange={(e) => set('notes', e.target.value)}
                placeholder={t('events.fields.notesPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm resize-none" />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 transition-colors">
                {tCommon('common.cancel')}
              </button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {saving ? t('events.saving') : t('events.saveChanges')}
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* ── Emergency Replacement Modal ── */}
      {emergencyOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white max-w-lg w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Reemplazo de Ultimo Momento</h2>
                <p className="text-xs text-red-600 font-bold uppercase tracking-widest mt-1">Modo reemplazo de ultimo momento</p>
              </div>
              <button onClick={() => { setEmergencyOpen(false); setSelectedEmergency(new Set()); setEmergencyConfirm(false); setEmergencyFeedback(null); }}
                className="text-zinc-400 hover:text-zinc-700 text-lg">X</button>
            </div>

            {emergencyFeedback && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-medium">
                {emergencyFeedback}
              </div>
            )}

            {emergencyLoading ? (
              <div className="py-12 text-center">
                <div className="inline-block w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-400 mt-3">Buscando peleadores disponibles...</p>
              </div>
            ) : emergencyResults.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-zinc-200">
                <p className="text-sm text-zinc-400">No se encontraron peleadores disponibles de ultimo momento.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {emergencyResults.map((em) => {
                    const alreadySent = emergencySentIds.has(em.fighter.id) || eventRequests.some((r) => r.fighter_id === em.fighter.id);
                    const reqStatus = eventRequests.find((r) => r.fighter_id === em.fighter.id)?.status;
                    const isSelected = selectedEmergency.has(em.fighter.id);
                    return (
                      <div key={em.fighter.id}
                        className={`border p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                          reqStatus === 'accepted' ? 'border-emerald-300 bg-emerald-50/30' :
                          alreadySent ? 'border-zinc-200 bg-zinc-50 opacity-60' :
                          isSelected ? 'border-red-300 bg-red-50/30' : 'border-zinc-200 hover:border-zinc-400'
                        }`}
                        onClick={() => !alreadySent && toggleEmergencySelect(em.fighter.id)}
                      >
                        <input type="checkbox" checked={isSelected} readOnly disabled={alreadySent}
                          className="h-4 w-4 accent-red-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-900 truncate">{em.fighter.profiles?.full_name ?? '—'}</p>
                          <p className="text-xs text-zinc-500">
                            {em.fighter.weight_class ?? '—'} · {em.fighter.profiles?.city ?? '—'}
                            {em.fighter.short_notice_ready && <span className="ml-1 text-red-600 font-bold">· Corto aviso</span>}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700">{em.emergency_score}%</span>
                          {alreadySent && (
                            <span className={`text-xs font-bold px-2 py-0.5 ${
                              reqStatus === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
                              reqStatus === 'declined' ? 'bg-red-50 text-red-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {reqStatus === 'accepted' ? 'Aceptado' : reqStatus === 'declined' ? 'Rechazado' : 'Enviado'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Batch send controls */}
                {selectedEmergency.size > 0 && !emergencyConfirm && (
                  <button
                    onClick={() => setEmergencyConfirm(true)}
                    className="w-full px-4 py-2.5 text-sm font-bold tracking-wide uppercase text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    Enviar a {selectedEmergency.size} seleccionado{selectedEmergency.size !== 1 ? 's' : ''}
                  </button>
                )}
                {emergencyConfirm && (
                  <div className="border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700 font-medium mb-3">
                      Enviar solicitud urgente a {selectedEmergency.size} peleador{selectedEmergency.size !== 1 ? 'es' : ''}?
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setEmergencyConfirm(false)}
                        className="flex-1 px-3 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50">Cancelar</button>
                      <button onClick={handleBatchEmergencySend} disabled={sendingEmergency}
                        className="flex-1 px-3 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                        {sendingEmergency ? 'Enviando...' : 'Confirmar envío'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Paywall Modal ── */}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl">
            <h2 className="text-base font-semibold text-zinc-900 mb-2">{t('events.deleteEvent')}</h2>
            <p className="text-sm text-zinc-500 mb-6">{t('events.confirmDelete')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 transition-colors">
                {tCommon('common.cancel')}
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? t('events.deleting') : t('events.deleteEvent')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-zinc-900">{value}</p>
    </div>
  );
}
