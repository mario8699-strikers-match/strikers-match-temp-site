'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { eventService } from '@/services/eventService';
import { authService } from '@/services/authService';
import type { EventFormData, Profile } from '@/types';

const WEIGHT_CLASSES = [
  'minimosca','mosca','supermosca','gallo','supergallo',
  'pluma','superpluma','ligero','superligero','welter',
  'superwelter','medio','supermedio','semipesado','crucero','pesado','multiple',
];

const BOXING_WEIGHT_GROUPS = [
  { group: 'Infantil 6–7 años', weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años', weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  { group: 'Adultos 18+', weights: ['48 kg — Mini mosca', '51 kg — Mosca', '54 kg — Gallo', '57 kg — Pluma', '60 kg — Ligero', '63.5 kg — Súper ligero', '67 kg — Welter', '71 kg — Súper welter', '75 kg — Medio', '80 kg — Semi pesado', '86 kg', '92 kg', '+92 kg — Pesado'] },
];

const MUAY_THAI_WEIGHT_GROUPS = [
  { group: 'Infantil 6–7 años', weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años', weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  { group: 'Adultos 18+', weights: ['48 kg', '51 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '81 kg', '86 kg', '91 kg', '+91 kg'] },
];

const MMA_WEIGHT_GROUPS = [
  { group: 'Infantil 6–7 años', weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años', weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  { group: 'Adultos 18+', weights: ['52 kg — Mosca', '56.7 kg — Gallo', '61.2 kg — Pluma', '65.8 kg — Ligero', '70.3 kg — Welter', '77.1 kg — Medio', '83.9 kg — Semi pesado', '93 kg — Pesado ligero', '120 kg — Pesado'] },
];

const BJJ_WEIGHT_GROUPS = [
  { group: 'Infantil 4–5 años', weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 6–7 años', weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 8–9 años', weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 10–11 años', weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 12 años', weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Juvenil 13–14 años', weights: ['-48 kg', '-52 kg', '-57 kg', '-63 kg', '-69 kg', '-75 kg', '-81 kg', '+81 kg'] },
  { group: 'Juvenil 15–17 años', weights: ['-48 kg', '-52 kg', '-57 kg', '-63 kg', '-69 kg', '-75 kg', '-81 kg', '+81 kg'] },
  { group: 'Adultos 18+ (GI / No-Gi)', weights: ['-57 kg — Gallo', '-64 kg — Pluma', '-70 kg — Ligero', '-76 kg — Medio', 'hasta 82.3 kg — Medio pesado', 'hasta 88.3 kg — Pesado', 'hasta 94.3 kg — Super pesado', 'hasta 100.5 kg — Pesadísimo', '+100.5 kg — Ultra pesado'] },
];

const K1_WEIGHT_GROUPS = [
  { group: 'Infantil 6–7 años', weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años', weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  { group: 'Adultos 18+', weights: ['51 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '81 kg', '86 kg', '91 kg', '+91 kg'] },
];

const STRIKING_DISCIPLINES = ['Boxeo', 'Kickboxing', 'Light Contact', 'Low Kick', 'Kick Light', 'Point Fight', 'Full Contact'];

const DISCIPLINES = [
  'Boxeo','Muay Thai','MMA','Kickboxing','Karate','Judo','Lucha Libre',
  'Lima Lama','Jiu-Jitsu','Point Fight','Bare Knuckle','K1',
  'Light Contact','Kick Light','Low Kick','Full Contact','Otro',
];

const STATUSES: EventFormData['status'][] = ['draft', 'published', 'cancelled', 'completed'];

const EMPTY_FORM: EventFormData = {
  event_name: '',
  event_date: '',
  event_time: '',
  city: '',
  venue: '',
  weight_class_needed: '',
  weight_classes_needed: [],
  disciplines_needed: [],
  purse_amount: '',
  purse_enabled: false,
  signup_fee: '',
  notes: '',
  status: 'draft',
};

export default function CreateEventPage() {
  const { t } = useTranslation('events');

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [formData, setFormData] = useState<EventFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerPreview, setFlyerPreview] = useState<string | null>(null);

  // Auth guard: must be promoter or manager
  useEffect(() => {
    authService.getSession().then(({ data }) => {
      const p = data?.profile ?? null;
      setProfile(p);
      if (!p) {
        window.location.href = '/login';
      } else if (p.role !== 'promoter' && p.role !== 'manager' && p.role !== 'admin') {
        window.location.href = '/events';
      }
    });
  }, []);

  const set = (key: keyof EventFormData, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleFlyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFlyerFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setFlyerPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFlyerPreview(null);
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!formData.event_name.trim()) newErrors.event_name = t('events.errors.nameRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError(null);
    setLoading(true);
    const promoterId = profile!.id;

    // Upload flyer first if selected
    let flyerUrl: string | null = null;
    if (flyerFile) {
      const { data: url, error: uploadError } = await eventService.uploadFlyer(flyerFile);
      if (uploadError) {
        setServerError('Failed to upload flyer. Please try again.');
        setLoading(false);
        return;
      }
      flyerUrl = url;
    }

    const { data, error } = await eventService.create(promoterId, formData, flyerUrl);
    setLoading(false);
    if (error) {
      setServerError(t('events.errors.generic'));
    } else if (data) {
      window.location.href = `/events/${data.id}`;
    }
  };

  // Block render until auth is confirmed — covers: checking, unauthenticated, wrong role
  if (!profile || (profile.role !== 'promoter' && profile.role !== 'manager' && profile.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm">...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar activePage="events" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6">
          <a href="/events" className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('events.backToEvents')}
          </a>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">{t('events.createEvent')}</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {serverError}
            </div>
          )}

          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t('events.fields.event_name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.event_name}
              onChange={(e) => set('event_name', e.target.value)}
              placeholder={t('events.fields.event_namePlaceholder')}
              className={`w-full border px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm ${
                errors.event_name ? 'border-red-400' : 'border-zinc-300'
              }`}
            />
            {errors.event_name && <p className="mt-1 text-xs text-red-500">{errors.event_name}</p>}
          </div>

          {/* Date + Time + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.event_date')}
              </label>
              <input
                type="date"
                value={formData.event_date}
                onChange={(e) => set('event_date', e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Hora de inicio
              </label>
              <input
                type="time"
                value={formData.event_time}
                onChange={(e) => set('event_time', e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.status')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm bg-white"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`events.status.${s}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* City + Venue row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.city')}
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder={t('events.fields.cityPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('events.fields.venue')}
              </label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => set('venue', e.target.value)}
                placeholder={t('events.fields.venuePlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
          </div>

          {/* Weight Classes multi-select */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>
              Categorías de Peso Requeridas
            </label>
            {formData.disciplines_needed.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Selecciona una disciplina para ver las categorías de peso disponibles</p>
            ) : (
              <div className="space-y-4">
                {/* Show Boxing groups if any striking discipline selected */}
                {formData.disciplines_needed.some(d => STRIKING_DISCIPLINES.includes(d)) && (
                  <div>
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest mb-2">Boxeo / Kickboxing / Point Fight</p>
                    {BOXING_WEIGHT_GROUPS.map((grp) => (
                      <div key={grp.group} className="mb-3">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{grp.group}</p>
                        <div className="flex flex-wrap gap-2">
                          {grp.weights.map((wc) => (
                            <button key={wc} type="button"
                              onClick={() => setFormData((prev) => ({
                                ...prev,
                                weight_classes_needed: prev.weight_classes_needed.includes(wc)
                                  ? prev.weight_classes_needed.filter((x) => x !== wc)
                                  : [...prev.weight_classes_needed, wc],
                              }))}
                              className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                formData.weight_classes_needed.includes(wc)
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
                )}

                {/* Show Muay Thai groups */}
                {formData.disciplines_needed.includes('Muay Thai') && (
                  <div>
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest mb-2">Muay Thai</p>
                    {MUAY_THAI_WEIGHT_GROUPS.map((grp) => (
                      <div key={grp.group} className="mb-3">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{grp.group}</p>
                        <div className="flex flex-wrap gap-2">
                          {grp.weights.map((wc) => (
                            <button key={`mt-${wc}`} type="button"
                              onClick={() => setFormData((prev) => ({
                                ...prev,
                                weight_classes_needed: prev.weight_classes_needed.includes(wc)
                                  ? prev.weight_classes_needed.filter((x) => x !== wc)
                                  : [...prev.weight_classes_needed, wc],
                              }))}
                              className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                formData.weight_classes_needed.includes(wc)
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
                )}

                {/* Show MMA groups */}
                {formData.disciplines_needed.includes('MMA') && (
                  <div>
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest mb-2">MMA</p>
                    {MMA_WEIGHT_GROUPS.map((grp) => (
                      <div key={grp.group} className="mb-3">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{grp.group}</p>
                        <div className="flex flex-wrap gap-2">
                          {grp.weights.map((wc) => (
                            <button key={`mma-${wc}`} type="button"
                              onClick={() => setFormData((prev) => ({
                                ...prev,
                                weight_classes_needed: prev.weight_classes_needed.includes(wc)
                                  ? prev.weight_classes_needed.filter((x) => x !== wc)
                                  : [...prev.weight_classes_needed, wc],
                              }))}
                              className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                formData.weight_classes_needed.includes(wc)
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
                )}

                {/* Show BJJ groups */}
                {formData.disciplines_needed.includes('Jiu-Jitsu') && (
                  <div>
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest mb-2">Jiu-Jitsu</p>
                    {BJJ_WEIGHT_GROUPS.map((grp) => (
                      <div key={grp.group} className="mb-3">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{grp.group}</p>
                        <div className="flex flex-wrap gap-2">
                          {grp.weights.map((wc) => (
                            <button key={`bjj-${wc}`} type="button"
                              onClick={() => setFormData((prev) => ({
                                ...prev,
                                weight_classes_needed: prev.weight_classes_needed.includes(wc)
                                  ? prev.weight_classes_needed.filter((x) => x !== wc)
                                  : [...prev.weight_classes_needed, wc],
                              }))}
                              className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                formData.weight_classes_needed.includes(wc)
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
                )}

                {/* Show K1 groups */}
                {formData.disciplines_needed.includes('K1') && (
                  <div>
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest mb-2">K1</p>
                    {K1_WEIGHT_GROUPS.map((grp) => (
                      <div key={grp.group} className="mb-3">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{grp.group}</p>
                        <div className="flex flex-wrap gap-2">
                          {grp.weights.map((wc) => (
                            <button key={`k1-${wc}`} type="button"
                              onClick={() => setFormData((prev) => ({
                                ...prev,
                                weight_classes_needed: prev.weight_classes_needed.includes(wc)
                                  ? prev.weight_classes_needed.filter((x) => x !== wc)
                                  : [...prev.weight_classes_needed, wc],
                              }))}
                              className={`px-3 py-1.5 text-xs font-bold tracking-wide border transition-colors ${
                                formData.weight_classes_needed.includes(wc)
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
                )}

                {/* Fallback for other disciplines */}
                {formData.disciplines_needed.some(d => !STRIKING_DISCIPLINES.includes(d) && !['Muay Thai', 'MMA', 'Jiu-Jitsu', 'K1'].includes(d)) && (
                  <div>
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest mb-2">Otras Disciplinas</p>
                    <div className="flex flex-wrap gap-2">
                      {WEIGHT_CLASSES.map((wc) => (
                        <button key={wc} type="button"
                          onClick={() => setFormData((prev) => ({
                            ...prev,
                            weight_classes_needed: prev.weight_classes_needed.includes(wc)
                              ? prev.weight_classes_needed.filter((x) => x !== wc)
                              : [...prev.weight_classes_needed, wc],
                          }))}
                          className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                            formData.weight_classes_needed.includes(wc)
                              ? 'bg-[#C0001E] text-white border-[#C0001E]'
                              : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                          }`}>
                          {t(`events.weightClasses.${wc}`, { defaultValue: wc })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Purse + Signup Fee row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {/* Purse with toggle */}
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-zinc-700">{t('events.fields.purse_amount')}</label>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, purse_enabled: !prev.purse_enabled, purse_amount: '' }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    formData.purse_enabled ? 'bg-[#C0001E]' : 'bg-zinc-300'
                  }`}
                  aria-label="Toggle purse"
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.purse_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {formData.purse_enabled && (
                <input
                  type="number"
                  min="0"
                  value={formData.purse_amount}
                  onChange={(e) => set('purse_amount', e.target.value)}
                  placeholder={t('events.fields.purse_amountPlaceholder')}
                  className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
                />
              )}
              {!formData.purse_enabled && (
                <p className="text-xs text-zinc-400">Sin bolsa (desactivado)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Cuota de inscripción <span className="text-zinc-400 font-normal">(opcional)</span></label>
              <input
                type="number"
                min="0"
                value={formData.signup_fee}
                onChange={(e) => set('signup_fee', e.target.value)}
                placeholder="Ej. 500 (MXN)"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
              <p className="text-xs text-zinc-400 mt-1">Dejar en blanco si la participación es gratuita</p>
            </div>
          </div>

          {/* Disciplines needed */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>
              Disciplinas requeridas
            </label>
            <div className="flex flex-wrap gap-2">
              {DISCIPLINES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      disciplines_needed: prev.disciplines_needed.includes(d)
                        ? prev.disciplines_needed.filter((x) => x !== d)
                        : [...prev.disciplines_needed, d],
                    }))
                  }
                  className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                    formData.disciplines_needed.includes(d)
                      ? 'bg-[#C0001E] text-white border-[#C0001E]'
                      : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Flyer Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Flyer del evento
            </label>
            <div
              className="border-2 border-dashed border-zinc-300 p-6 text-center cursor-pointer hover:border-zinc-400 transition-colors"
              onClick={() => document.getElementById('flyer-input')?.click()}
            >
              {flyerPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flyerPreview} alt="Flyer preview" className="max-h-64 mx-auto object-contain" />
                  <p className="mt-2 text-xs text-zinc-400">Haz clic para cambiar</p>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto w-10 h-10 text-zinc-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-zinc-500">Sube el flyer del evento</p>
                  <p className="text-xs text-zinc-400 mt-1">PNG, JPG, WEBP · Máx. 5MB</p>
                </div>
              )}
            </div>
            <input
              id="flyer-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFlyerChange}
              className="hidden"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t('events.fields.notes')}
            </label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={t('events.fields.notesPlaceholder')}
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <a
              href="/events"
              className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              {t('common.cancel', { ns: 'common' })}
            </a>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-semibold text-white bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('events.creating') : t('events.createEvent')}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
