import Link from 'next/link';
import VenueCard from '../../components/VenueCard';
import VenueMap from '../../components/VenueMap';
import { puntosDeMapa } from '../../lib/map';
import { getChileTodayStr } from '../../lib/events';
import { getPublicVenues } from '../../lib/server-venues';
import { getPublicEvents } from '../../lib/server-events';
import { TIPOS_LUGAR } from '../../lib/venues';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Lugares para salir en Valpo, Viña y alrededores',
  description:
    'Bares, clubes, salas en vivo y espacios under de la Región de Valparaíso, con su zona, dirección y próximas fechas.',
  alternates: { canonical: '/lugares' },
};
export default async function Lugares({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tipo = typeof params.tipo === 'string' ? params.tipo : 'todos';
  const vista = params.vista === 'mapa' ? 'mapa' : 'lista';
  const [venues, events] = await Promise.all([getPublicVenues(), getPublicEvents()]);
  const conteo = new Map<string, number>();
  for (const e of events.events) if (e.lugar) conteo.set(e.lugar, (conteo.get(e.lugar) || 0) + 1);
  const disponibles = TIPOS_LUGAR.filter((t) => venues.lugares.some((l) => l.tipo === t.value));
  const lista = tipo === 'todos' ? venues.lugares : venues.lugares.filter((l) => l.tipo === tipo);
  const ciudades = [...new Set(lista.map((l) => l.ciudad))];
  const puntos = puntosDeMapa(lista, events.events, getChileTodayStr());
  const enlaceVista = (v: 'lista' | 'mapa') => {
    const q = new URLSearchParams();
    if (tipo !== 'todos') q.set('tipo', tipo);
    if (v === 'mapa') q.set('vista', 'mapa');
    const cadena = q.toString();
    return cadena ? `/lugares?${cadena}` : '/lugares';
  };
  return (
    <section className="container page-section">
      <p className="eyebrow">NO SÓLO EVENTOS</p>
      <h1>
        Lugares
        <br />
        <em>para salir.</em>
      </h1>
      <p className="lead">
        Sitios que existen aunque hoy no tengan un evento anunciado. Cada uno indica su zona, su
        dirección y cuándo lo revisamos por última vez.
      </p>
      {venues.status === 'error' && (
        <p role="alert" className="form-error">
          No pudimos consultar los lugares. Intenta más tarde.
        </p>
      )}
      <div className="category-filters" aria-label="Filtrar por tipo de lugar">
        <Link
          href="/lugares"
          className={`chip ${tipo === 'todos' ? 'selected' : ''}`}
          aria-current={tipo === 'todos' ? 'true' : undefined}
        >
          Todos ({venues.lugares.length})
        </Link>
        {disponibles.map((t) => (
          <Link
            key={t.value}
            href={`/lugares?tipo=${t.value}`}
            className={`chip ${tipo === t.value ? 'selected' : ''}`}
            aria-current={tipo === t.value ? 'true' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="vista-toggle" role="group" aria-label="Cómo ver los lugares">
        <Link
          href={enlaceVista('lista')}
          className={`vista-opcion ${vista === 'lista' ? 'activa' : ''}`}
          aria-current={vista === 'lista' ? 'true' : undefined}
        >
          Lista
        </Link>
        <Link
          href={enlaceVista('mapa')}
          className={`vista-opcion ${vista === 'mapa' ? 'activa' : ''}`}
          aria-current={vista === 'mapa' ? 'true' : undefined}
        >
          Mapa
        </Link>
      </div>
      {vista === 'mapa' && (
        <>
          {puntos.length ? (
            <VenueMap puntos={puntos} />
          ) : (
            <p className="empty-state">
              Ninguno de estos lugares tiene todavía una ubicación verificada.
            </p>
          )}
          <p className="trust-note">
            {puntos.length} de {lista.length} lugares con coordenada verificada. Los demás siguen en
            la lista: preferimos no ponerlos en el mapa antes que dejarlos en la esquina equivocada.
          </p>
        </>
      )}
      {vista === 'lista' &&
        ciudades.map((c) => (
        <div key={c} className="venue-block">
          <div className="section-heading">
            <h2>
              {c}
              <span className="heading-period">.</span>
            </h2>
            <span className="result-count">
              {lista.filter((l) => l.ciudad === c).length}{' '}
              {lista.filter((l) => l.ciudad === c).length === 1 ? 'lugar' : 'lugares'}
            </span>
          </div>
          <div className="venue-grid">
            {lista
              .filter((l) => l.ciudad === c)
              .map((l) => (
                <VenueCard key={l.slug} lugar={l} proximos={conteo.get(l.nombre) || 0} />
              ))}
          </div>
        </div>
      ))}
      {vista === 'lista' && venues.status === 'ok' && lista.length === 0 && (
        <div className="empty-state">
          <p>Todavía no tenemos lugares revisados con ese filtro.</p>
          <div className="actions">
            <Link className="button button-primary" href="/lugares">
              Ver todos los lugares
            </Link>
            <Link className="button button-outline" href="/publicar">
              Falta un lugar
            </Link>
          </div>
        </div>
      )}
      <p className="trust-note">
        La cobertura es parcial y crece con revisión. Si conoces un lugar que falta, cuéntanos y lo
        revisamos antes de publicarlo.
      </p>
    </section>
  );
}
