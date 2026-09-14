import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import VenueCard from '../../../components/VenueCard';
import EventCard from '../../../components/EventCard';
import { getPublicVenues } from '../../../lib/server-venues';
import { getPublicEvents } from '../../../lib/server-events';
import { toChileDateString } from '../../../lib/event-extraction';
import { zonaSlug, zonasDe } from '../../../lib/venues';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
async function findZone(slug: string) {
  const venues = await getPublicVenues();
  return zonasDe(venues.lugares).find((z) => zonaSlug(z.zona) === slug) || null;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const z = await findZone(slug);
  if (!z) return { title: 'Zona no disponible', robots: { index: false, follow: true } };
  return {
    title: `Salir en ${z.zona}, ${z.ciudad}`,
    description: `${z.lugares.length} lugares revisados en ${z.zona}: bares, clubes y salas en vivo, con direcciones y próximas fechas.`,
    alternates: { canonical: `/zonas/${slug}` },
  };
}
export default async function Zone({ params }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const z = await findZone(slug);
  if (!z) notFound();
  const events = await getPublicEvents();
  const today = toChileDateString(new Date());
  const nombres = new Set(z.lugares.map((l) => l.nombre));
  const agenda = events.events.filter((e) => e.lugar && nombres.has(e.lugar));
  const conteo = new Map<string, number>();
  for (const e of agenda) if (e.lugar) conteo.set(e.lugar, (conteo.get(e.lugar) || 0) + 1);
  return (
    <section className="container page-section">
      <Link className="back-link" href="/zonas">
        ← Volver a las zonas
      </Link>
      <p className="eyebrow">{z.ciudad.toUpperCase()}</p>
      <h1>{z.zona}</h1>
      <p className="lead">
        {z.lugares.length} {z.lugares.length === 1 ? 'lugar revisado' : 'lugares revisados'} y{' '}
        {agenda.length} {agenda.length === 1 ? 'fecha anunciada' : 'fechas anunciadas'}.
      </p>
      {agenda.length > 0 && (
        <>
          <h2>
            Lo que se viene
            <span className="heading-period">.</span>
          </h2>
          <div className="event-grid">
            {agenda.slice(0, 6).map((e, i) => (
              <EventCard key={e.id} evento={e} today={today} priority={i === 0} />
            ))}
          </div>
        </>
      )}
      <h2>
        Dónde salir aquí
        <span className="heading-period">.</span>
      </h2>
      <div className="venue-grid">
        {z.lugares.map((l) => (
          <VenueCard key={l.slug} lugar={l} proximos={conteo.get(l.nombre) || 0} />
        ))}
      </div>
      <p className="trust-note">
        Las zonas se arman con la dirección publicada por cada lugar. Si falta un sitio de este
        sector, cuéntanos y lo revisamos.
      </p>
    </section>
  );
}
