import Link from 'next/link';
import { Lugar } from '../lib/venues';
export default function VenueCard({ lugar: l, proximos }: { lugar: Lugar; proximos?: number }) {
  return (
    <article className="venue-card">
      <Link href={`/lugar/${l.slug}`} className="venue-card-link">
        <p className="eyebrow venue-kind">
          {l.tipo_label}
          <span>{l.zona || l.ciudad}</span>
        </p>
        <h3>{l.nombre}</h3>
        <p className="venue-where">{l.direccion ? `${l.direccion} · ${l.ciudad}` : l.ciudad}</p>
        {l.descripcion && <p className="venue-note">{l.descripcion}</p>}
        <p className="venue-agenda">
          {proximos
            ? `${proximos} ${proximos === 1 ? 'fecha anunciada' : 'fechas anunciadas'}`
            : 'Sin fechas anunciadas ahora'}
          <span>
            {l.instagram_url ? 'Instagram' : ''} <span aria-hidden="true">↗</span>
          </span>
        </p>
      </Link>
    </article>
  );
}
