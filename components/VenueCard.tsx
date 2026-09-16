import Link from 'next/link';
import { Lugar } from '../lib/venues';
import { acentoDe } from '../lib/types';
/**
 * Una tarjeta de lugar no es una tarjeta de evento sin fecha. No lleva flyer,
 * lleva identidad: qué tipo de local es, en qué cerro está, y si esta noche
 * pasa algo. El Instagram va aquí, a un toque, no enterrado en la ficha.
 */
export default function VenueCard({
  lugar: l,
  proximos,
  hoy,
}: {
  lugar: Lugar;
  proximos?: number;
  hoy?: string | null;
}) {
  const comoLlegar =
    l.lat !== null && l.lng !== null
      ? `https://www.openstreetmap.org/directions?to=${l.lat}%2C${l.lng}`
      : null;
  return (
    <article className="venue-card" style={{ ['--ciudad' as string]: acentoDe(l.ciudad) }}>
      <Link href={`/lugar/${l.slug}`} className="venue-card-link">
        <p className="eyebrow venue-kind">
          <span className="venue-tipo">{l.tipo_label}</span>
          <span>{l.zona || l.ciudad}</span>
        </p>
        <h3>{l.nombre}</h3>
        <p className="venue-where">{l.direccion ? `${l.direccion} · ${l.ciudad}` : l.ciudad}</p>
        {hoy ? (
          <p className="venue-hoy">
            <span className="venue-hoy-punto" aria-hidden="true" />
            Hoy: {hoy}
          </p>
        ) : (
          <p className="venue-agenda">
            {proximos
              ? `${proximos} ${proximos === 1 ? 'fecha anunciada' : 'fechas anunciadas'}`
              : 'Sin fechas anunciadas ahora'}
          </p>
        )}
      </Link>
      {(l.instagram_url || comoLlegar) && (
        <div className="venue-acciones">
          {l.instagram_url && (
            <a href={l.instagram_url} target="_blank" rel="noopener noreferrer nofollow">
              Instagram <span aria-hidden="true">↗</span>
            </a>
          )}
          {comoLlegar && (
            <a href={comoLlegar} target="_blank" rel="noopener noreferrer nofollow">
              Cómo llegar <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}
    </article>
  );
}
