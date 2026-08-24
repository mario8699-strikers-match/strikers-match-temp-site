import type { ReactNode } from 'react';

type RecordPart = 'wins' | 'losses' | 'draws';

const RECORD_TEXT_COLOR: Record<RecordPart, string> = {
  wins: 'text-emerald-700',
  losses: 'text-red-700',
  draws: 'text-blue-700',
};

export function recordTextColor(part: RecordPart) {
  return RECORD_TEXT_COLOR[part];
}

export function methodTextColor(method?: string | null) {
  const normalized = method?.toLowerCase() ?? '';
  if (normalized.includes('decision') || normalized.includes('decisión')) {
    return 'text-blue-700';
  }
  return 'text-zinc-700';
}

export function RecordValue({
  part,
  value,
  className = '',
}: {
  part: RecordPart;
  value: ReactNode;
  className?: string;
}) {
  return <span className={`${RECORD_TEXT_COLOR[part]} ${className}`}>{value}</span>;
}

export function InlineCombatRecord({
  wins,
  losses,
  draws,
  winLabel = 'V',
  lossLabel = 'D',
  drawLabel = 'E',
  className = '',
}: {
  wins: number | null | undefined;
  losses: number | null | undefined;
  draws: number | null | undefined;
  winLabel?: string;
  lossLabel?: string;
  drawLabel?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <RecordValue part="wins" value={`${wins ?? 0}${winLabel}`} className="font-bold" />
      <span className="text-zinc-400">–</span>
      <RecordValue part="losses" value={`${losses ?? 0}${lossLabel}`} className="font-bold" />
      <span className="text-zinc-400">–</span>
      <RecordValue part="draws" value={`${draws ?? 0}${drawLabel}`} className="font-bold" />
    </span>
  );
}

export function BoutMethodText({
  value,
  empty = '—',
  className = '',
}: {
  value?: string | null;
  empty?: string;
  className?: string;
}) {
  if (!value) return <span className="text-zinc-400">{empty}</span>;
  return (
    <span className={`inline-block whitespace-nowrap font-bold uppercase tracking-wide ${methodTextColor(value)} ${className}`}>
      {value}
    </span>
  );
}
