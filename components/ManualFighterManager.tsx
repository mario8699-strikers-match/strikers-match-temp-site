'use client';

import { useEffect, useState } from 'react';
import { manualFighterService } from '@/services/manualFighterService';
import type { ManualFighter } from '@/types';

const WEIGHT_CLASSES = [
  'minimosca','mosca','supermosca','gallo','supergallo','pluma','superpluma',
  'ligero','superligero','welter','superwelter','medio','supermedio','semipesado','crucero','pesado',
];
const WEIGHT_LABELS: Record<string, string> = {
  minimosca:'Minimosca',mosca:'Mosca',supermosca:'Supermosca',gallo:'Gallo',supergallo:'Supergallo',
  pluma:'Pluma',superpluma:'Superpluma',ligero:'Ligero',superligero:'Superligero',welter:'Welter',
  superwelter:'Superwelter',medio:'Medio',supermedio:'Supermedio',semipesado:'Semipesado',crucero:'Crucero',pesado:'Pesado',
};

interface Props {
  creatorId: string;
  // Label for the section (e.g. "Mis Peleadores" / "Roster del Promotor")
  sectionLabel?: string;
  // Description shown under the header
  description?: string;
}

export function ManualFighterManager({
  creatorId,
  sectionLabel = 'Mis Peleadores',
  description = 'Peleadores que no están registrados en la plataforma. Aparecerán públicamente con la etiqueta "Roster"; el contacto para peleas llegará a ti dentro de la app.',
}: Props) {
  const [manualFighters, setManualFighters] = useState<ManualFighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [weight, setWeight] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [wins, setWins] = useState('0');
  const [losses, setLosses] = useState('0');
  const [draws, setDraws] = useState('0');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setStateField] = useState('');
  const [gym, setGym] = useState('');
  const [level, setLevel] = useState<'amateur' | 'pro'>('amateur');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    manualFighterService.getByCreator(creatorId).then(({ data }) => {
      setManualFighters(data ?? []);
      setLoading(false);
    });
  }, [creatorId]);

  const resetForm = () => {
    setName(''); setNickname(''); setWeight(''); setDiscipline('');
    setWins('0'); setLosses('0'); setDraws('0');
    setPhone(''); setEmail(''); setCity(''); setStateField(''); setGym('');
    setLevel('amateur'); setNotes(''); setPhotoUrl(''); setBio('');
    setIsAvailable(true); setError(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setError(null);

    const { data, error: err } = await manualFighterService.add(creatorId, {
      full_name: name.trim(),
      nickname: nickname.trim() || null,
      weight_class: weight || null,
      discipline: discipline.trim() || null,
      record_wins: parseInt(wins) || 0,
      record_losses: parseInt(losses) || 0,
      record_draws: parseInt(draws) || 0,
      phone: phone.trim() || null,
      email: email.trim() || null,
      city: city.trim() || null,
      gym_name: gym.trim() || null,
      experience_level: level,
      notes: notes.trim() || null,
      photo_url: photoUrl.trim() || null,
      bio: bio.trim() || null,
      height_cm: null,
      reach_cm: null,
      state: state.trim() || null,
      is_available: isAvailable,
    });

    setSaving(false);
    if (err) {
      setError('Error al agregar. Intenta de nuevo.');
    } else if (data) {
      setManualFighters((prev) => [data, ...prev]);
      resetForm();
      setShowForm(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    await manualFighterService.remove(id);
    setManualFighters((prev) => prev.filter((f) => f.id !== id));
    setRemoving(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C0001E' }}>
          {sectionLabel} ({manualFighters.length})
        </p>
        <button
          onClick={() => { setShowForm(!showForm); resetForm(); }}
          className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-white transition-colors"
          style={{ background: showForm ? '#5A5A5A' : '#C0001E' }}
        >
          {showForm ? 'Cancelar' : 'Agregar peleador'}
        </button>
      </div>
      <p className="text-xs text-zinc-400 mb-4">{description}</p>

      {showForm && (
        <div className="border border-zinc-200 p-6 mb-6 space-y-4">
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#5A5A5A' }}>Nuevo Peleador</p>
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Nombre completo *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del peleador"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Apodo</label>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Apodo (opcional)"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>División</label>
              <select value={weight} onChange={(e) => setWeight(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                <option value="">Seleccionar...</option>
                {WEIGHT_CLASSES.map((w) => <option key={w} value={w}>{WEIGHT_LABELS[w]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Disciplina</label>
              <input type="text" value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="Boxeo, MMA, etc."
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Victorias</label>
              <input type="number" min="0" value={wins} onChange={(e) => setWins(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Derrotas</label>
              <input type="number" min="0" value={losses} onChange={(e) => setLosses(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Empates</label>
              <input type="number" min="0" value={draws} onChange={(e) => setDraws(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Teléfono (solo tú lo verás)</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+52 000 000 0000"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Correo (solo tú lo verás)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Ciudad</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Estado</label>
              <input type="text" value={state} onChange={(e) => setStateField(e.target.value)} placeholder="Estado"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Gimnasio</label>
              <input type="text" value={gym} onChange={(e) => setGym(e.target.value)} placeholder="Gimnasio"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Nivel</label>
              <select value={level} onChange={(e) => setLevel(e.target.value as 'amateur' | 'pro')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                <option value="amateur">Amateur</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Disponibilidad</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="w-4 h-4 accent-[#C0001E]" />
                <span className="text-sm text-zinc-700">Disponible para peleas</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>URL de foto</label>
            <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..."
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Bio pública</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Breve bio del peleador"
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Notas privadas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas adicionales (solo tú las verás)"
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
          </div>

          <div className="flex justify-end">
            <button onClick={handleAdd} disabled={saving}
              className="px-6 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50"
              style={{ background: saving ? '#9A9A9A' : '#C0001E' }}>
              {saving ? 'Guardando...' : 'Guardar peleador'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400">Cargando...</p>
      ) : manualFighters.length === 0 && !showForm ? (
        <div className="border border-dashed border-zinc-200 py-10 text-center">
          <p className="text-sm text-zinc-400 mb-3">No tienes peleadores agregados manualmente.</p>
        </div>
      ) : manualFighters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {manualFighters.map((f) => (
            <div key={f.id} className="border border-zinc-200 p-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/fighters/manual/${f.id}`} className="text-sm font-bold text-zinc-900 hover:text-[#C0001E] transition-colors">
                    {f.full_name}
                  </a>
                  {f.nickname && <span className="text-xs text-zinc-400">&ldquo;{f.nickname}&rdquo;</span>}
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5">Roster</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
                  {f.weight_class ? WEIGHT_LABELS[f.weight_class] ?? f.weight_class : '—'} · {f.city ?? '—'}
                </p>
                <div className="flex gap-1 mt-1">
                  <span className="text-xs font-bold text-zinc-600">{f.record_wins}V</span>
                  <span className="text-xs text-zinc-400">–</span>
                  <span className="text-xs font-bold text-zinc-600">{f.record_losses}D</span>
                  <span className="text-xs text-zinc-400">–</span>
                  <span className="text-xs font-bold text-zinc-600">{f.record_draws}E</span>
                </div>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs font-bold px-1.5 py-0.5 uppercase tracking-widest ${f.experience_level === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    {f.experience_level === 'pro' ? 'Pro' : 'Amateur'}
                  </span>
                  {f.discipline && <span className="text-xs font-bold px-1.5 py-0.5 uppercase tracking-wide bg-zinc-900 text-white">{f.discipline}</span>}
                  <span className={`text-xs font-semibold px-1.5 py-0.5 ${f.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {f.is_available ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
                {f.notes && <p className="text-xs text-zinc-400 mt-1 italic">{f.notes}</p>}
              </div>
              <button onClick={() => handleRemove(f.id)} disabled={removing === f.id}
                className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors flex-shrink-0 pt-1">
                {removing === f.id ? '...' : 'Quitar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
