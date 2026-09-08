import type { BoutGraphicPayload } from '@/types';

export function buildBoutGraphicSvg(payload: BoutGraphicPayload, format: 'screen' | 'social') {
  const width = format === 'screen' ? 1920 : 1080;
  const height = 1080;
  const { event, bout, theme } = payload;
  const red = bout.redCorner;
  const blue = bout.blueCorner;
  const titleY = format === 'screen' ? 410 : 330;
  const fontSize = format === 'screen' ? 92 : 68;
  const leftX = format === 'screen' ? 120 : 70;
  const rightX = width - leftX;
  const safe = escapeXml;
  const metadata = [bout.discipline, bout.weightClass, bout.ruleset].filter(Boolean).join(' · ');
  const eventMeta = [event.venue, event.city, event.date].filter(Boolean).join(' · ');
  const redRecord = `${red.record_wins ?? 0}-${red.record_losses ?? 0}-${red.record_draws ?? 0}`;
  const blueRecord = `${blue.record_wins ?? 0}-${blue.record_losses ?? 0}-${blue.record_draws ?? 0}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${safe(theme.primary)}"/><stop offset="1" stop-color="#000000"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="18" height="100%" fill="${safe(theme.accent)}"/>
  <g fill="${safe(theme.secondary)}" font-family="Arial, Helvetica, sans-serif">
    <text x="${leftX}" y="100" fill="${safe(theme.accent)}" font-size="24" font-weight="900" letter-spacing="8">STRIKERS MATCH</text>
    <text x="${leftX}" y="165" font-size="42" font-weight="900">${safe(event.name.toUpperCase())}</text>
    <text x="${leftX}" y="205" font-size="20" opacity=".7" letter-spacing="3">${safe(eventMeta.toUpperCase())}</text>
    <text x="${width / 2}" y="${titleY - 80}" text-anchor="middle" fill="${safe(theme.accent)}" font-size="25" font-weight="900" letter-spacing="5">${safe((bout.number ? `COMBATE ${bout.number}` : 'PRÓXIMO COMBATE') + (metadata ? ` · ${metadata}` : ''))}</text>
    <text x="${leftX}" y="${titleY}" font-size="${fontSize}" font-weight="900">${safe(shorten(red.name, format === 'screen' ? 22 : 16).toUpperCase())}</text>
    <text x="${rightX}" y="${titleY + 160}" text-anchor="end" font-size="${fontSize}" font-weight="900">${safe(shorten(blue.name, format === 'screen' ? 22 : 16).toUpperCase())}</text>
    <text x="${width / 2}" y="${titleY + 80}" text-anchor="middle" fill="${safe(theme.accent)}" font-size="72" font-weight="900" font-style="italic">VS</text>
    <text x="${leftX}" y="${titleY + 55}" font-size="25" font-weight="700">${safe(`${redRecord}${red.team ? ` · ${red.team}` : ''}`)}</text>
    <text x="${rightX}" y="${titleY + 215}" text-anchor="end" font-size="25" font-weight="700">${safe(`${blueRecord}${blue.team ? ` · ${blue.team}` : ''}`)}</text>
    <text x="${leftX}" y="995" font-size="22" opacity=".75" letter-spacing="3">${safe((bout.format ?? 'FORMATO POR CONFIRMAR').toUpperCase())}</text>
    <text x="${rightX}" y="995" text-anchor="end" font-size="22" opacity=".75" letter-spacing="3">DONDE EMPIEZA EL SIGUIENTE COMBATE</text>
  </g>
</svg>`;
}

export function downloadBoutGraphic(payload: BoutGraphicPayload, format: 'screen' | 'social') {
  const svg = buildBoutGraphicSvg(payload, format);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `combate-${payload.bout.number ?? payload.bout.id}-${format}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function shorten(value: string, maximum: number) { return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value; }
function escapeXml(value: unknown) { return String(value ?? '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character); }
