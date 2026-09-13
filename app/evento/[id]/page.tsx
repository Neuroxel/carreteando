import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicEvent } from '../../../lib/server-events';
import { eventDateLabel } from '../../../lib/events';
import { toChileDateString } from '../../../lib/event-extraction';
import { eventJsonLd, safeJsonLd } from '../../../lib/event-seo';
import EventImage from '../../../components/EventImage';
import ShareButton from '../../../components/ShareButton';
import ReportForm from '../../../components/ReportForm';
import { CATEGORIAS } from '../../../lib/types';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await getPublicEvent(id);
  const e = r.events[0];
  if (!e)
    return {
      title:
        r.status === 'error' ? 'Información temporalmente no disponible' : 'Evento no disponible',
      robots: { index: false, follow: true },
    };
  const description = `${e.fecha} · ${e.hora || 'Hora por confirmar'} · ${e.lugar || e.ciudad} · ${e.precio_texto || 'Precio por confirmar'}. Consulta la fuente original.`;
  return {
    title: e.nombre,
    description,
    alternates: { canonical: `/evento/${e.id}` },
    openGraph: {
      title: e.nombre,
      description,
      url: `/evento/${e.id}`,
      images: [{ url: `/evento/${e.id}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', images: [`/evento/${e.id}/opengraph-image`] },
  };
}
export default async function Detail({ params }: Props) {
  const { id } = await params;
  const r = await getPublicEvent(id);
  if (r.status === 'error') throw new Error('EVENT_BACKEND_UNAVAILABLE');
  const e = r.events[0];
  if (!e) notFound();
  const today = toChileDateString(r.checkedAt);
  const category = CATEGORIAS.find((c) => c.value === e.categoria)?.label;
  const maps = e.lugar
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.lugar, e.direccion, e.ciudad, 'Chile'].filter(Boolean).join(', '))}`
    : null;
  return (
    <article className="container page-section event-detail">
      <Link className="back-link" href="/buscar">
        ← Volver a la cartelera
      </Link>
      <div className="detail-grid">
        <div className="detail-poster">
          <EventImage src={e.imagen_url} title={e.nombre} category={e.categoria} priority />
        </div>
        <div className="detail-info">
          <p className="eyebrow">
            {category} / {e.ciudad}
          </p>
          <h1>{e.nombre}</h1>
          <span className="trust-badge">
            {e.verificado
              ? 'Organizador verificado'
              : e.fuente === 'manual'
                ? 'Comunidad · revisado'
                : 'Detectado · fuente revisada'}
          </span>
          <dl className="event-facts">
            <div>
              <dt>CUÁNDO</dt>
              <dd>
                <time dateTime={e.fecha}>
                  {eventDateLabel(e.fecha, today)} · {e.fecha.split('-').reverse().join('/')}
                </time>
                <small>{e.hora ? `${e.hora} h · hora de Chile` : 'Hora por confirmar'}</small>
              </dd>
            </div>
            <div>
              <dt>DÓNDE</dt>
              <dd>
                {e.lugar || 'Lugar por confirmar'}
                <small>
                  {e.direccion || 'Dirección por confirmar'} · {e.ciudad}
                </small>
              </dd>
            </div>
            <div>
              <dt>ENTRADA</dt>
              <dd>{e.precio_texto || 'Precio por confirmar'}</dd>
            </div>
            <div>
              <dt>ORGANIZA / PUBLICA</dt>
              <dd>{e.organizador || 'Por confirmar'}</dd>
            </div>
          </dl>
          <div className="actions">
            {e.fuente_url && (
              <a
                className="button button-primary"
                href={e.fuente_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver publicación original ↗
              </a>
            )}
            <ShareButton id={e.id} title={e.nombre} />
            {maps && (
              <a
                className="button button-outline"
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
              >
                Cómo llegar ↗
              </a>
            )}
          </div>
          <p className="trust-note">
            {e.ultima_revision
              ? `Fuente revisada el ${new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(e.ultima_revision))}.`
              : 'Fecha de última revisión no disponible.'}{' '}
            Confirma posibles cambios con el organizador.
          </p>
        </div>
      </div>
      <div className="detail-description prose">
        <h2>El dato completo</h2>
        <p className="preserve-lines">
          {e.descripcion || 'Consulta los detalles en la publicación original.'}
        </p>
        {e.publicado_en_fuente && (
          <p className="trust-note">
            Publicación de origen:{' '}
            {new Intl.DateTimeFormat('es-CL', {
              dateStyle: 'medium',
              timeZone: 'America/Santiago',
            }).format(new Date(e.publicado_en_fuente))}
            . Es la fecha del post, no la del evento.
          </p>
        )}
        <Link href="/confianza">Cómo revisamos la información ↗</Link>
        <ReportForm id={e.id} />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(eventJsonLd(e)) }}
      />
    </article>
  );
}
