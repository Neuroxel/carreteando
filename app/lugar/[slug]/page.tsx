import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicVenue } from '../../../lib/server-venues';
import { getPublicEvents } from '../../../lib/server-events';
import { toChileDateString } from '../../../lib/event-extraction';
import { eventDateLabel } from '../../../lib/events';
import { FUENTES_LUGAR, zonaSlug } from '../../../lib/venues';
import ShareButton from '../../../components/ShareButton';
import LiveReport from '../../../components/LiveReport';
import { liveFor } from '../../../lib/server-live';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await getPublicVenue(slug);
  const l = r.lugares[0];
  if (!l)
    return {
      title:
        r.status === 'error' ? 'Información temporalmente no disponible' : 'Lugar no disponible',
      robots: { index: false, follow: true },
    };
  const description = `${l.tipo_label} en ${l.zona || l.ciudad}${l.direccion ? `, ${l.direccion}` : ''}. Próximas fechas y cómo llegar.`;
  return {
    title: `${l.nombre} · ${l.ciudad}`,
    description,
    alternates: { canonical: `/lugar/${l.slug}` },
    openGraph: { title: l.nombre, description, url: `/lugar/${l.slug}` },
  };
}
export default async function VenueDetail({ params }: Props) {
  const { slug } = await params;
  const r = await getPublicVenue(slug);
  if (r.status === 'error') throw new Error('VENUE_BACKEND_UNAVAILABLE');
  const l = r.lugares[0];
  if (!l) notFound();
  const [events, enVivo] = await Promise.all([getPublicEvents(), liveFor('venue', l.slug)]);
  const today = toChileDateString(new Date());
  const agenda = events.events.filter((e) => e.lugar === l.nombre);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [l.nombre, l.direccion, l.ciudad, 'Chile'].filter(Boolean).join(', '),
  )}`;
  return (
    <article className="container page-section venue-detail">
      <Link className="back-link" href="/explorar?ver=lugares">
        ← Volver a los lugares
      </Link>
      <p className="eyebrow">
        {l.tipo_label} / {l.zona || l.ciudad}
      </p>
      <h1>{l.nombre}</h1>
      <p className="lead">
        {l.direccion ? `${l.direccion} · ${l.ciudad}` : l.ciudad}
        {l.zona && (
          <>
            {' · '}
            <Link href={`/zonas/${zonaSlug(l.zona)}`}>{l.zona}</Link>
          </>
        )}
      </p>
      {l.descripcion && <p className="detail-description">{l.descripcion}</p>}
      {l.tags.length > 0 && (
        <p className="venue-tags">
          {l.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </p>
      )}
      <div className="actions venue-actions">
        {/* Small local venues live on Instagram: that link matters more than a website. */}
        {l.instagram_url && (
          <a
            className="button button-primary"
            href={l.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram ↗
          </a>
        )}
        {l.agenda_url && (
          <a
            className={`button ${l.instagram_url ? 'button-outline' : 'button-primary'}`}
            href={l.agenda_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Su cartelera ↗
          </a>
        )}
        {l.sitio_url && (
          <a
            className="button button-outline"
            href={l.sitio_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sitio web ↗
          </a>
        )}
        {l.facebook_url && (
          <a
            className="button button-outline"
            href={l.facebook_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook ↗
          </a>
        )}
        {l.tiktok_url && (
          <a
            className="button button-outline"
            href={l.tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            TikTok ↗
          </a>
        )}
        {l.contacto_url && (
          <a
            className="button button-outline"
            href={l.contacto_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contacto ↗
          </a>
        )}
        <a className="button button-outline" href={maps} target="_blank" rel="noopener noreferrer">
          Cómo llegar ↗
        </a>
        <ShareButton
          id={`lugar/${l.slug}`}
          title={l.nombre}
          details={`${l.tipo_label} · ${l.zona || l.ciudad}`}
        />
      </div>
      {!l.instagram_url && !l.sitio_url && !l.facebook_url && (
        <p className="trust-note">
          Todavía no tenemos su cuenta oficial confirmada. Si la conoces, cuéntanos y la sumamos.
        </p>
      )}
      <LiveReport tipo="venue" id={l.slug} resumen={enVivo} />
      <h2>
        Próximas fechas
        <span className="heading-period">.</span>
      </h2>
      {agenda.length ? (
        <ul className="venue-agenda-list">
          {agenda.map((e) => (
            <li key={e.id}>
              <Link href={`/evento/${encodeURIComponent(e.id)}`}>
                <strong>{eventDateLabel(e.fecha, today)}</strong>
                <span>{e.hora ? `${e.hora} h` : 'Hora por confirmar'}</span>
                {e.nombre}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No tenemos fechas anunciadas para este lugar ahora mismo. Eso no significa que esté
          cerrado: revisa su cartelera o cuéntanos su programación.
        </p>
      )}
      <p className="trust-note">
        {FUENTES_LUGAR[l.fuente_tipo] || 'Fuente pública revisada'}
        {l.ultima_revision
          ? ` · revisado el ${l.ultima_revision.slice(0, 10).split('-').reverse().join('-')}`
          : ''}
        .
        {l.fuente_url && (
          <>
            {' '}
            <a href={l.fuente_url} target="_blank" rel="noopener noreferrer">
              Ver la fuente ↗
            </a>
          </>
        )}
      </p>
      <div className="contribution-strip">
        <div>
          <p className="eyebrow">¿REPRESENTAS ESTE LUGAR?</p>
          <h2>Pásanos la programación.</h2>
          <p>Publicamos lo que podemos contrastar con una fuente. Revisamos antes de mostrarlo.</p>
        </div>
        <Link href="/publicar" className="button button-light">
          Enviar o corregir ↗
        </Link>
      </div>
    </article>
  );
}
