import Link from 'next/link';
import { Evento } from '../lib/types';
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
  return (
    <article className="event-card">
      <Link
        className="event-image-link"
        href={`/evento/${encodeURIComponent(e.id)}`}
        // Sin precarga: abrir una ficha pide su página, recorrer la lista no pide nada.
        prefetch={false}
        // El nombre accesible debe contener el texto visible del enlace. Cuando
        // la tarjeta usa arte generado, ese texto es el tipo de noche y el lugar,
        // y un aria-label que empezaba por "Ver" no lo contenía.
        tabIndex={-1}
        aria-hidden="true"
      >
        <EventImage
          src={e.imagen_url}
          title={e.nombre}
          category={e.categoria}
          tipo={e.tipo}
          lugar={e.lugar}
          ciudad={e.ciudad}
          zona={e.sector}
          priority={priority}
        />
      </Link>
      <div className="event-card-body">
        <div className="card-category">
          <time dateTime={e.fecha}>{eventDateLabel(e.fecha, today)}</time>
          <span>{e.hora ? `${e.hora} h` : 'Hora por confirmar'}</span>
        </div>
        <h3>
          <Link href={`/evento/${encodeURIComponent(e.id)}`} prefetch={false}>
            {e.nombre}
          </Link>
        </h3>
        <p className="card-location">
          {e.lugar || 'Lugar por confirmar'}
          <span>{e.ciudad}</span>
        </p>
        <div className="card-bottom">
          <div>
            {/* Lo esencial se lee en dos segundos: cuándo, qué, dónde, cuánto.
                La procedencia está en la ficha. */}
            <strong>{e.precio_texto || 'Precio por confirmar'}</strong>
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
