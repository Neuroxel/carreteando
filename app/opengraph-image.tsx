import { ImageResponse } from 'next/og';
import { LOGO_VIEWBOX, Q, Q_MAIN, Q_SHADOW, WORD } from '../components/Logo';
export const alt = 'Dónde Salgo? · Eventos y lugares para salir hoy · Región de Valparaíso';
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
          background: '#100F0D',
          color: '#F1EADB',
          padding: '65px',
          justifyContent: 'space-between',
        }}
      >
        <svg width="640" height="138" viewBox={LOGO_VIEWBOX}>
          <path fill="#F1EADB" d={WORD} />
          <path fill="#D8B24C" transform={Q_SHADOW} d={Q} />
          <path fill="#FF5B36" transform={Q_MAIN} d={Q} />
        </svg>
        <div style={{ display: 'flex', fontSize: 100, fontWeight: 900, lineHeight: 1.05 }}>
          ¿Qué hay
          <br />
          hoy?
        </div>
        <div style={{ display: 'flex', color: '#FF5B36', fontSize: 30 }}>EVENTOS Y LUGARES PARA SALIR ↗</div>
      </div>
    ),
    size,
  );
}
