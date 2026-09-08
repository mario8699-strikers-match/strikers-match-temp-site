'use client';

/* eslint-disable @next/next/no-img-element -- operator-supplied graphics must render arbitrary approved asset hosts */

import type { BoutGraphicPayload } from '@/types';

export function BoutGraphic({ payload, variant = 'screen', className = '' }: { payload: BoutGraphicPayload; variant?: 'screen' | 'social' | 'overlay'; className?: string }) {
  const { event, bout, theme } = payload;
  const overlay = variant === 'overlay';
  const square = variant === 'social';
  const red = bout.redCorner;
  const blue = bout.blueCorner;
  const record = (fighter: typeof red) => `${fighter.record_wins ?? 0}-${fighter.record_losses ?? 0}-${fighter.record_draws ?? 0}`;

  return (
    <div
      className={`relative isolate overflow-hidden ${square ? 'aspect-square' : 'aspect-video'} ${className}`}
      style={{ background: overlay ? 'transparent' : theme.primary, color: theme.secondary }}
      aria-label={`${red.name} versus ${blue.name}`}
    >
      {!overlay && event.backgroundUrl && <img src={event.backgroundUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />}
      {!overlay && <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/10 via-black/45 to-black/90" />}

      <div className={overlay ? 'absolute inset-x-[4%] bottom-[6%]' : 'flex h-full flex-col justify-between p-[5%]'}>
        {!overlay && (
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[clamp(8px,1.1vw,20px)] font-black uppercase tracking-[0.28em]" style={{ color: theme.accent }}>Strikers Match</p>
              <h2 className="mt-1 max-w-[70vw] text-[clamp(16px,2.6vw,48px)] font-black uppercase leading-none">{event.name}</h2>
              <p className="mt-2 text-[clamp(8px,1.1vw,18px)] uppercase tracking-wider opacity-75">{[event.venue, event.city, event.date].filter(Boolean).join(' · ')}</p>
            </div>
            {event.logoUrl && <img src={event.logoUrl} alt="Logo del evento" referrerPolicy="no-referrer" className="max-h-[10vh] max-w-[18vw] object-contain" />}
          </header>
        )}

        <div className={`${overlay ? 'border-l-[clamp(4px,0.7vw,12px)] bg-black/90 p-[2.5%] shadow-2xl backdrop-blur-sm' : ''}`} style={overlay ? { borderColor: theme.accent } : undefined}>
          <div className="mb-[2%] flex items-center justify-center gap-3 text-center text-[clamp(8px,1.25vw,20px)] font-black uppercase tracking-[0.18em]">
            <span style={{ color: theme.accent }}>{bout.number ? `Combate ${bout.number}` : 'Próximo combate'}</span>
            <span className="opacity-40">/</span>
            <span>{[bout.discipline, bout.weightClass, bout.ruleset].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[3%]">
            <Corner name={red.name} nickname={red.nickname} record={record(red)} team={red.team} side="left" accent={theme.accent} />
            <div className="text-[clamp(20px,5vw,92px)] font-black italic leading-none" style={{ color: theme.accent }}>VS</div>
            <Corner name={blue.name} nickname={blue.nickname} record={record(blue)} team={blue.team} side="right" accent={theme.accent} />
          </div>
        </div>

        {!overlay && (
          <footer className="flex items-end justify-between gap-4 text-[clamp(7px,1vw,16px)] uppercase tracking-[0.16em] opacity-75">
            <p>{bout.format ?? 'Formato por confirmar'}{bout.scheduledTime ? ` · ${new Date(bout.scheduledTime).toLocaleString('es-MX')}` : ''}</p>
            <div className="flex max-w-[45%] items-center justify-end gap-3">
              {event.sponsorLogoUrls.slice(0, 4).map((url) => <img key={url} src={url} alt="Patrocinador" referrerPolicy="no-referrer" className="max-h-[5vh] max-w-[9vw] object-contain" />)}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function Corner({ name, nickname, record, team, side, accent }: { name: string; nickname?: string | null; record: string; team?: string | null; side: 'left' | 'right'; accent: string }) {
  return <div className={side === 'right' ? 'text-right' : 'text-left'}><p className="text-[clamp(17px,4.2vw,78px)] font-black uppercase leading-[0.9] tracking-tight">{name}</p>{nickname && <p className="mt-[2%] text-[clamp(9px,1.6vw,26px)] font-bold uppercase" style={{ color: accent }}>&ldquo;{nickname}&rdquo;</p>}<p className="mt-[3%] text-[clamp(8px,1.35vw,22px)] font-bold uppercase tracking-widest">{record}{team ? ` · ${team}` : ''}</p></div>;
}
