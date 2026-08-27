import { ImageResponse } from 'next/og';

export const alt = 'Strikers Match — Comunidad de boxeo y MMA en México';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0A0A0A',
          color: '#FFFFFF',
          padding: '72px 80px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ color: '#C0001E', fontSize: 24, fontWeight: 800, letterSpacing: 7 }}>
          STRIKERS MATCH · MÉXICO
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 76, lineHeight: 0.95, fontWeight: 900, textTransform: 'uppercase' }}>
            Donde empieza el
          </div>
          <div style={{ color: '#C0001E', fontSize: 94, lineHeight: 0.95, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase' }}>
            siguiente combate.
          </div>
        </div>
        <div style={{ color: '#B8B8B8', fontSize: 28 }}>
          Boxeo y artes marciales mixtas en México.
        </div>
      </div>
    ),
    size
  );
}
