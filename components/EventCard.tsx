import Link from 'next/link';
import { Evento, CATEGORIAS } from '../lib/types';
import { eventDateLabel } from '../lib/events';
import EventImage from './EventImage';
import ShareButton from './ShareButton';
export default function EventCard({
  evento: e,
  today,
  priority = false,
}: {
  evento: Evento;
  today?: string;
  priority?: boolean;
}) {
  const category = CATEGORIAS.find((c) => c.value === e.categoria)?.label || 'Otras noches';
  return (
    <article className="event-card">
      <Link
        className="event-image-link"
        href={`/evento/${encodeURIComponent(e.id)}`}
        aria-label={`Ver ${e.nombre}`}
      >
        <EventImage
          src={e.imagen_url}
          title={e.nombre}
          category={e.categoria}
          priority={priority}
        />
        <span
          className={`date-badge ${eventDateLabel(e.fecha, today) === 'Hoy' ? 'is-today' : ''}`}
        >
          {eventDateLabel(e.fecha, today)}
        </span>
      </Link>
      <div className="event-card-body">
        <div className="eyebrow card-category">
          {category}
          <span>{e.hora ? `${e.hora} h` : 'Hora por confirmar'}</span>
        </div>
        <h3>
          <Link href={`/evento/${encodeURIComponent(e.id)}`}>{e.nombre}</Link>
        </h3>
        <p className="card-location">
          {e.lugar || 'Lugar por confirmar'}
          <span>{e.ciudad}</span>
        </p>
        <div className="card-bottom">
          <div>
            <strong>{e.precio_texto || 'Precio por confirmar'}</strong>
            <span className="provenance">
              {e.verificado
                ? 'Organizador verificado'
                : e.fuente === 'manual'
                  ? 'Comunidad · revisado'
                  : e.fuente === 'passline' || e.fuente === 'editorial'
                    ? 'Curaduría · fuente revisada'
                    : 'Detectado · fuente revisada'}
            </span>
          </div>
          <ShareButton
            id={e.id}
            title={e.nombre}
            details={`${eventDateLabel(e.fecha, today)} · ${e.lugar || e.ciudad}`}
            compact
          />
        </div>
      </div>
    </article>
  );
}
