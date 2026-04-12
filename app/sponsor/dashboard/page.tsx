'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { sponsorService } from '@/services/sponsorService';
import type { Profile, Fighter, SponsorshipOffer } from '@/types';

type FighterWithProfile = Fighter & { profiles: { full_name: string; city: string | null } };
type OfferWithFighter = SponsorshipOffer & {
  fighters?: { profiles?: { full_name: string; city: string | null }; weight_class: string | null; photo_url: string | null };
};

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

export default function SponsorDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [fighters, setFighters] = useState<FighterWithProfile[]>([]);
  const [offers, setOffers] = useState<OfferWithFighter[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedFighter, setSelectedFighter] = useState<FighterWithProfile | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      const p = data?.profile ?? null;
      setProfile(p);
      if (!p) { window.location.href = '/login'; return; }
      if (p.role !== 'sponsor') { window.location.href = '/'; return; }

      Promise.all([
        sponsorService.browseFighters(),
        sponsorService.getMyOffers(p.id),
      ]).then(([{ data: f }, { data: o }]) => {
        setFighters((f as FighterWithProfile[]) ?? []);
        setOffers((o as unknown as OfferWithFighter[]) ?? []);
        setLoading(false);
      });
    });
  }, []);

  const handleSendOffer = async () => {
    if (!profile || !selectedFighter) return;
    setSending(true);
    setSendError(null);
    const { error } = await sponsorService.sendOffer({
      sponsor_id: profile.id,
      fighter_id: selectedFighter.id,
      amount: offerAmount ? parseFloat(offerAmount) : null,
      message: offerMessage || null,
    });
    setSending(false);
    if (error) {
      setSendError('Error al enviar la oferta. Intenta de nuevo.');
    } else {
      setSendSuccess(true);
      setTimeout(() => {
        setSelectedFighter(null);
        setOfferAmount('');
        setOfferMessage('');
        setSendSuccess(false);
        // Refresh offers
        sponsorService.getMyOffers(profile.id).then(({ data: o }) => setOffers((o as unknown as OfferWithFighter[]) ?? []));
      }, 1500);
    }
  };

  if (profile === undefined) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color:'#9A9A9A' }}>...</p></div>;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage={null} />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#C0001E' }}>Panel del Patrocinador</p>
          <h1 className="text-3xl font-black uppercase" style={{ letterSpacing:'-1px' }}>{profile!.full_name}</h1>
          <p className="text-sm mt-1" style={{ color:'#5A5A5A' }}>{profile!.city ?? ''}</p>
        </div>

        {/* My Offers */}
        {offers.length > 0 && (
          <div className="mb-10">
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#C0001E' }}>Mis Ofertas</p>
            <div className="space-y-3">
              {offers.map(offer => {
                const s = STATUS_LABELS[offer.status] ?? { label: offer.status, cls: 'bg-zinc-100 text-zinc-500' };
                const f = offer.fighters;
                return (
                  <div key={offer.id} className="border border-zinc-200 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 overflow-hidden flex-shrink-0">
                        {f?.photo_url ? <Image src={f.photo_url} alt="" width={40} height={40} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{f?.profiles?.full_name ?? '—'}</p>
                        <p className="text-xs" style={{ color:'#5A5A5A' }}>
                          {f?.weight_class ? WEIGHT_LABELS[f.weight_class] ?? f.weight_class : '—'}
                          {offer.amount ? ` · $${offer.amount.toLocaleString()} MXN` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 flex-shrink-0 ${s.cls}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Browse fighters */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#C0001E' }}>Peleadores Disponibles</p>
          {loading ? (
            <p className="text-sm text-zinc-400">Cargando...</p>
          ) : fighters.length === 0 ? (
            <div className="border border-dashed border-zinc-200 py-12 text-center">
              <p className="text-sm text-zinc-400">No hay peleadores disponibles en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {fighters.map(f => (
                <div key={f.id} className="border border-zinc-200">
                  {/* Photo */}
                  <div className="h-36 bg-zinc-100 overflow-hidden cursor-pointer" onClick={() => router.push(`/fighters/${f.id}`)}>
                    {f.photo_url ? (
                      <Image src={f.photo_url} alt="" width={300} height={144} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-bold text-zinc-900">{f.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs mt-0.5 mb-3" style={{ color:'#5A5A5A' }}>
                      {f.weight_class ? WEIGHT_LABELS[f.weight_class] ?? f.weight_class : '—'} · {f.profiles?.city ?? '—'}
                    </p>
                    <div className="flex gap-1 mb-3">
                      <span className="text-xs font-bold text-zinc-600">{f.record_wins}V</span>
                      <span className="text-xs text-zinc-400">–</span>
                      <span className="text-xs font-bold text-zinc-600">{f.record_losses}D</span>
                      <span className="text-xs text-zinc-400">–</span>
                      <span className="text-xs font-bold text-zinc-600">{f.record_draws}E</span>
                    </div>
                    <button onClick={() => setSelectedFighter(f)}
                      className="w-full py-2 text-xs font-bold tracking-widest uppercase text-white transition-colors" style={{ background:'#C0001E' }}
                      onMouseOver={e=>(e.currentTarget.style.background='#9A0018')} onMouseOut={e=>(e.currentTarget.style.background='#C0001E')}>
                      Enviar oferta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Send Offer Modal */}
      {selectedFighter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white w-full max-w-md p-6">
            <h2 className="text-xl font-black uppercase mb-1" style={{ letterSpacing:'-0.5px' }}>Oferta de Patrocinio</h2>
            <p className="text-sm mb-6" style={{ color:'#5A5A5A' }}>Para: <span className="font-semibold text-zinc-900">{selectedFighter.profiles?.full_name}</span></p>
            {sendSuccess ? (
              <div className="py-8 text-center"><p className="text-sm font-semibold text-emerald-700">¡Oferta enviada con éxito!</p></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Monto (MXN)</label>
                  <input type="number" min="0" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="Ej. 5000"
                    className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>Mensaje (opcional)</label>
                  <textarea value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={4} placeholder="Detalles de la oferta..."
                    className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none" />
                </div>
                {sendError && <p className="text-xs text-red-600">{sendError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setSelectedFighter(null); setSendError(null); }} className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">Cancelar</button>
                  <button onClick={handleSendOffer} disabled={sending} className="px-5 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
                    {sending ? 'Enviando...' : 'Enviar oferta'}
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
