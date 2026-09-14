'use client';
import Image from 'next/image';
import { useState } from 'react';
import { CATEGORIAS, TIPOS_EVENTO, TipoEvento } from '../lib/types';
// Fifteen identical tiles is not a fallback, it is a placeholder. The art has to
// carry the kind of night and where it is, so two cards never read the same.
const VARIANTES = ['art-v1', 'art-v2', 'art-v3', 'art-v4', 'art-v5'];
function hash(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
function variante(seed: string) {
  return VARIANTES[hash(seed) % VARIANTES.length];
}
export default function EventImage({
  src,
  title,
  category,
  tipo = 'main',
  lugar,
  ciudad,
  priority = false,
}: {
  src?: string | null;
  title: string;
  category: string;
  tipo?: TipoEvento;
  lugar?: string | null;
  ciudad?: string | null;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const kind = TIPOS_EVENTO.find((t) => t.value === tipo);
  const style = CATEGORIAS.find((c) => c.value === category && c.value !== 'otro');
  // A fonda is a kind of night, not a music genre. Unknown genre stays unsaid.
  const headline = (kind?.label || style?.label || 'Carrete').toUpperCase();
  const art = kind
    ? `art-${kind.value}`
    : style
      ? `art-${style.value}`
      : variante(`${title}${ciudad || ''}`);
  // Seventeen fondas sharing one palette is the same failure as one green tile.
  // The family stays, the geometry and tint shift per event.
  const tono = `tono-${(hash(`${title}${lugar || ''}`) % 4) + 1}`;
  return (
    <div className="event-art">
      {src && !failed ? (
        <Image
          src={src}
          alt={`Flyer de ${title}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={`flyer-fallback ${art} ${tono}`}>
          <span>{(ciudad || 'REGIÓN DE VALPARAÍSO').toUpperCase()}</span>
          <strong>{headline}</strong>
          <small>{lugar || 'Lugar por confirmar'}</small>
        </div>
      )}
    </div>
  );
}
