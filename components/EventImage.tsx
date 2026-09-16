'use client';
import Image from 'next/image';
import { useState } from 'react';
import { CATEGORIAS, TIPOS_EVENTO, TipoEvento, acentoDe } from '../lib/types';
// Cuarenta y cinco fondas sin flyer no pueden verse como cuarenta y cinco
// rectángulos iguales. No hay fotografías reales de estas fondas y no se
// inventan: lo que hay es un sistema gráfico que compone cada tarjeta a partir
// del tipo de noche, la ciudad y el título, y que se ve como un cartel.
const COMPOSICIONES = 6;
function hash(seed: string) {
  let h = 2166136261;
  for (const c of seed) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export default function EventImage({
  src,
  title,
  category,
  tipo = 'main',
  lugar,
  ciudad,
  zona,
  priority = false,
}: {
  src?: string | null;
  title: string;
  category: string;
  tipo?: TipoEvento;
  lugar?: string | null;
  ciudad?: string | null;
  zona?: string | null;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const kind = TIPOS_EVENTO.find((t) => t.value === tipo);
  const style = CATEGORIAS.find((c) => c.value === category && c.value !== 'otro');
  // Una fonda es un tipo de noche, no un género. Género desconocido no se dice.
  const headline = (kind?.label || style?.label || 'Carrete').toUpperCase();
  const familia = kind ? `art-${kind.value}` : style ? `art-${style.value}` : 'art-generico';
  const semilla = hash(`${title}|${lugar || ''}|${ciudad || ''}`);
  const composicion = `comp-${(semilla % COMPOSICIONES) + 1}`;
  const tono = `tono-${((semilla >> 8) % 4) + 1}`;
  const lugarTexto = ciudad ? [zona, ciudad].filter(Boolean).join(' · ') : 'REGIÓN DE VALPARAÍSO';
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
        <div
          className={`flyer-fallback ${familia} ${composicion} ${tono}`}
          style={{ ['--acento' as string]: acentoDe(ciudad || '') }}
          aria-hidden="true"
        >
          <span className="ff-lugar-alto">{lugarTexto.toUpperCase()}</span>
          <strong className="ff-tipo">{headline}</strong>
          <small className="ff-recinto">{lugar || 'Lugar por confirmar'}</small>
        </div>
      )}
    </div>
  );
}
