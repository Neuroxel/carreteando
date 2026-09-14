import { ImageResponse } from 'next/og';
import { getPublicEvent } from '../../../lib/server-events';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getPublicEvent(id);
  const e = r.events[0];
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        background: '#151614',
        color: '#f5f1e8',
        padding: 64,
      }}
    >
      <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, color: '#ff775c' }}>
        CARRETEANDO / LA NOCHE ES LOCAL
      </div>
      <div style={{ display: 'flex', fontSize: 68, fontWeight: 900, lineHeight: 1.1 }}>
        {e?.nombre.slice(0, 100) || 'Encuentra tu próxima noche.'}
      </div>
      <div style={{ display: 'flex', fontSize: 32 }}>
        {e
          ? `${e.fecha} · ${e.hora || 'Hora por confirmar'} · ${e.lugar || e.ciudad}`
          : 'Valpo, Viña y alrededores'}
      </div>
      <div style={{ display: 'flex', fontSize: 26, color: '#ff775c' }}>
        {e?.precio_texto || 'Consulta la cartelera y sus fuentes'} ↗
      </div>
    </div>,
    size,
  );
}
