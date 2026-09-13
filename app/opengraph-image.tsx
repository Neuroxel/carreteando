import { ImageResponse } from 'next/og';
export const alt = 'Carreteando · ¿Dónde se carretea hoy? · Región de Valparaíso';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#151614',
          color: '#f5f1e8',
          padding: '65px',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 4 }}>
          CARRETEANDO / REGIÓN DE VALPARAÍSO
        </div>
        <div style={{ display: 'flex', fontSize: 100, fontWeight: 900, lineHeight: 1.05 }}>
          ¿Dónde se
          <br />
          carretea hoy?
        </div>
        <div style={{ display: 'flex', color: '#ff775c', fontSize: 30 }}>LA NOCHE ES LOCAL. ↗</div>
      </div>
    ),
    size,
  );
}
