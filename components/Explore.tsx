import Link from 'next/link';
import { getPublicEvents } from '../lib/server-events';
import { getSourceFreshness } from '../lib/server-freshness';
import { diversifyByVenue, esTemporadaDieciocho, filterEvents } from '../lib/events';
import { toChileDateString } from '../lib/event-extraction';
import { parseFilters } from '../lib/filters';
import { CATEGORIAS, CIUDADES_NUCLEO } from '../lib/types';
import EventCard from './EventCard';
import VenueCard from './VenueCard';
import { getPublicVenues } from '../lib/server-venues';
import { buscarLugares, buscarZonas, zonaSlug } from '../lib/venues';
import ZoneRail from './ZoneRail';
import VenueMap from './VenueMap';
import { puntosDeMapa } from '../lib/map';
const SHORT: Record<string, string> = { Valparaíso: 'Valpo', 'Viña del Mar': 'Viña' };
export default async function Explore({
  params,
  home = false,
}: {
  params: Record<string, string | string[] | undefined>;
  home?: boolean;
}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string') query.set(k, v);
  const filters = parseFilters(query, home ? 'hoy' : 'futuro');
  // Un solo lugar para explorar. El segmento y la vista son filtros más, no
  // páginas distintas, así que viajan en la misma URL que todo lo demás.
  const ver: 'todo' | 'eventos' | 'lugares' =
    params.ver === 'eventos' ? 'eventos' : params.ver === 'lugares' ? 'lugares' : 'todo';
  const vista: 'lista' | 'mapa' = params.vista === 'mapa' ? 'mapa' : 'lista';
  const [result, freshness, venues] = await Promise.all([
    getPublicEvents(),
    getSourceFreshness(),
    getPublicVenues(),
  ]);
  const today = toChileDateString(result.checkedAt);
  const events = diversifyByVenue(filterEvents(result.events, filters, today));
  const conteoLugar = new Map<string, number>();
  for (const e of result.events)
    if (e.lugar) conteoLugar.set(e.lugar, (conteoLugar.get(e.lugar) || 0) + 1);
  // Surface places that have something coming before the rest, so the block is
  // useful rather than alphabetical.
  const lugaresHallados = filters.busqueda ? buscarLugares(venues.lugares, filters.busqueda) : [];
  const zonasHalladas = filters.busqueda ? buscarZonas(venues.lugares, filters.busqueda) : [];
  const lugaresZona = (
    filters.ciudad === 'todos'
      ? venues.lugares
      : venues.lugares.filter((l) => l.ciudad === filters.ciudad)
  )
    .slice()
    .sort((a, b) => (conteoLugar.get(b.nombre) || 0) - (conteoLugar.get(a.nombre) || 0));
  const puntos = puntosDeMapa(lugaresZona, result.events, today);
  const suggestions = result.events
    .filter(
      (e, i, all) =>
        all.findIndex((other) => other.lugar === e.lugar && other.ciudad === e.ciudad) === i,
    )
    .slice(0, 3);
  const todayCount = filterEvents(result.events, { fecha: 'hoy' }, today).length;
  const dieciocho = esTemporadaDieciocho(today);
  const fondas = result.events.filter((e) => e.tipo === 'fonda');
  // El rango se lee de las fechas que hay, no de un texto escrito a mano: la
  // primera vez que una fonda se estiró un día más, el bloque quedó mintiendo.
  const diasFonda = [...new Set(fondas.map((e) => e.fecha))].sort();
  const diaCorto = (iso: string) => Number(iso.slice(8, 10));
  const rangoFondas = diasFonda.length
    ? diasFonda.length === 1
      ? `el ${diaCorto(diasFonda[0])} de septiembre`
      : `del ${diaCorto(diasFonda[0])} al ${diaCorto(diasFonda[diasFonda.length - 1])}`
    : '';

  const faltan = Math.round(
    (Date.parse(`${today.slice(0, 4)}-09-18T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86400000,
  );
  const cuenta =
    faltan > 1
      ? `Faltan ${faltan} días`
      : faltan === 1
        ? 'Es mañana'
        : faltan === 0
          ? 'Es hoy'
          : 'Sigue el finde largo';
  const path = home ? '/' : '/explorar';
  function href(key: string, value: string) {
    const p = new URLSearchParams(query);
    p.set(key, value);
    return `${path}?${p.toString()}#cartelera`;
  }
  const dateLabel = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Santiago',
  }).format(new Date(result.checkedAt));
  return (
    <>
      <section className={`hero container ${home ? 'hero-home' : 'hero-small'}`}>
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> REGIÓN DE VALPARAÍSO{' '}
            <span className="hero-date">/ {dateLabel}</span>
          </p>
          <h1>
            {home ? (
              <>
                ¿Dónde <em>salimos?</em>
              </>
            ) : (
              <>
                Explorar <em>la noche.</em>
              </>
            )}
          </h1>
          {home && (
            // La pregunta del producto va primero y se responde escribiendo, no
            // leyendo un párrafo de marca.
            <form action="/explorar" className="hero-search" role="search">
              <label htmlFor="q-home" className="sr-only">
                Buscar lugar, fiesta, zona o estilo
              </label>
              <span aria-hidden="true">⌕</span>
              <input
                id="q-home"
                name="q"
                type="search"
                maxLength={120}
                placeholder="Buscar lugar, fiesta, zona o estilo"
              />
              <button type="submit">Buscar</button>
            </form>
          )}
        </div>
      </section>
      {dieciocho && fondas.length > 0 && (
        <section className="container season-hero">
          <p className="eyebrow">🇨🇱 DIECIOCHO · {cuenta.toUpperCase()}</p>
          <h2>
            Dónde carretear el 18
            <span className="heading-period">.</span>
          </h2>
          <p>
            {fondas.length} fechas de fonda revisadas en {new Set(fondas.map((e) => e.ciudad)).size}{' '}
            comunas, {rangoFondas}. Con dirección, precio y fuente.
          </p>
          <div className="actions">
            <Link className="button button-primary" href={`${path}?tipo=fonda&fecha=futuro`}>
              Ver las fondas ↗
            </Link>
            <Link className="button button-outline" href={`${path}?fecha=hoy`}>
              Qué hay hoy
            </Link>
            <Link className="button button-outline" href="/explorar?ver=lugares">
              Lugares para salir
            </Link>
          </div>
        </section>
      )}
      <section className="container discovery" id="cartelera" aria-label="Cartelera de eventos">
        {!home && (
          <div className="explore-controls">
            <div className="segmented" role="group" aria-label="Qué mostrar">
              {(
                [
                  ['todo', 'Todo'],
                  ['eventos', 'Eventos'],
                  ['lugares', 'Lugares'],
                ] as const
              ).map(([v, label]) => (
                <Link
                  key={v}
                  href={href('ver', v)}
                  className={ver === v ? 'activa' : ''}
                  aria-current={ver === v ? 'true' : undefined}
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="segmented segmented-vista" role="group" aria-label="Cómo mostrarlo">
              {(
                [
                  ['lista', 'Lista'],
                  ['mapa', 'Mapa'],
                ] as const
              ).map(([v, label]) => (
                <Link
                  key={v}
                  href={href('vista', v)}
                  className={vista === v ? 'activa' : ''}
                  aria-current={vista === v ? 'true' : undefined}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="date-tabs" aria-label="Filtrar por fecha">
          {[
            ['hoy', 'Hoy'],
            ['finde', 'Este finde'],
            ['futuro', 'Próximas noches'],
          ].map(([v, label]) => (
            <Link
              key={v}
              className={filters.fecha === v ? 'selected' : ''}
              href={href('fecha', v)}
              aria-current={filters.fecha === v ? 'true' : undefined}
            >
              {label}
              {v === 'hoy' && result.status === 'ok' && <span>{todayCount}</span>}
            </Link>
          ))}
          {dieciocho && fondas.length > 0 && (
            <Link
              className={filters.tipo === 'fonda' ? 'selected' : ''}
              href={`${path}?tipo=fonda&fecha=futuro#cartelera`}
              aria-current={filters.tipo === 'fonda' ? 'true' : undefined}
            >
              Dieciocho 🇨🇱<span>{fondas.length}</span>
            </Link>
          )}
        </div>
        <div className="city-filters" aria-label="Filtrar por zona">
          <Link
            href={href('ciudad', 'todos')}
            className={filters.ciudad === 'todos' ? 'selected' : ''}
            aria-current={filters.ciudad === 'todos' ? 'true' : undefined}
          >
            Toda la costa
          </Link>
          {CIUDADES_NUCLEO.map((c) => (
            <Link
              key={c}
              href={href('ciudad', c)}
              className={filters.ciudad === c ? 'selected' : ''}
              aria-current={filters.ciudad === c ? 'true' : undefined}
            >
              {SHORT[c] || c}
            </Link>
          ))}
        </div>
        <details
          className="extra-filters"
          open={Boolean(
            filters.busqueda || filters.categoria !== 'todos' || filters.precio !== 'todos',
          )}
        >
          <summary>Buscar por nombre, música o precio</summary>
          <div className="filter-toolbar">
            <form action={path} className="search-form">
              <label htmlFor="q" className="sr-only">
                Buscar evento, lugar o estilo
              </label>
              <span aria-hidden="true">⌕</span>
              <input
                id="q"
                name="q"
                type="search"
                maxLength={120}
                defaultValue={filters.busqueda}
                placeholder="Un evento, un lugar, tu estilo…"
              />
              {Object.entries(filters)
                .filter(([k]) => k !== 'busqueda')
                .map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
              <button aria-label="Buscar eventos" type="submit">
                Buscar
              </button>
            </form>
            <Link
              href={href('precio', filters.precio === 'gratis' ? 'todos' : 'gratis')}
              className={`chip free-filter ${filters.precio === 'gratis' ? 'selected' : ''}`}
              aria-current={filters.precio === 'gratis' ? 'true' : undefined}
            >
              $ Entrada gratis
            </Link>
          </div>
          <div className="category-filters" aria-label="Filtrar por estilo">
            <Link
              href={href('categoria', 'todos')}
              className={`chip ${filters.categoria === 'todos' ? 'selected' : ''}`}
            >
              Todos los estilos
            </Link>
            {CATEGORIAS.filter((c) => c.value !== 'otro').map((c) => (
              <Link
                key={c.value}
                className={`chip ${filters.categoria === c.value ? 'selected' : ''}`}
                href={href('categoria', c.value)}
                aria-current={filters.categoria === c.value ? 'true' : undefined}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </details>
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
              {puntos.length} de {lugaresZona.length} lugares con coordenada verificada. Los demás
              siguen en la lista: preferimos no ponerlos en el mapa antes que dejarlos en la esquina
              equivocada.
            </p>
          </>
        )}
        {vista === 'lista' && ver !== 'lugares' && (
        <>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {filters.ciudad === 'todos' ? 'VALPO Y ALREDEDORES' : filters.ciudad}
            </p>
            <h2>
              {filters.fecha === 'hoy'
                ? 'Para esta noche'
                : filters.fecha === 'finde'
                  ? 'Se viene el finde'
                  : 'Lo que se viene'}
              <span className="heading-period">.</span>
            </h2>
          </div>
          {result.status === 'ok' && (
            <span className="result-count">
              {events.length} {events.length === 1 ? 'plan' : 'planes'}
            </span>
          )}
        </div>
        {result.status === 'error' ? (
          <div className="empty-state error-state" role="alert">
            <span className="empty-symbol" aria-hidden="true">
              ↻
            </span>
            <h3>No pudimos cargar la cartelera.</h3>
            <p>
              Hay un problema temporal de conexión. No podemos confirmar qué eventos están
              disponibles.
            </p>
            <Link className="button button-primary" href={path}>
              Volver a intentar
            </Link>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div>
              <h3>
                {result.events.length === 0
                  ? 'Estamos buscando los próximos planes.'
                  : filters.fecha === 'hoy'
                    ? 'Hoy aún sin planes revisados.'
                    : 'Sin planes con estos filtros.'}
              </h3>
              <p>
                {result.events.length === 0
                  ? 'Por ahora no tenemos eventos revisados para mostrar. Preferimos una cartelera vacía a mandarte a un carrete que ya pasó.'
                  : 'Mira las próximas opciones revisadas.'}
              </p>
              <div className="actions">
                <Link href="/explorar?fecha=futuro">Ver todas las próximas fechas ↗</Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="event-grid">
            {events.map((e, i) => (
              <EventCard key={e.id} evento={e} today={today} priority={i === 0} />
            ))}
          </div>
        )}
        {result.status === 'ok' && events.length === 0 && result.events.length > 0 && (
          <div className="alternative-plans">
            <h3>Otras noches en la región</h3>
            <div className="event-grid">
              {suggestions.map((e, i) => (
                <EventCard key={e.id} evento={e} today={today} priority={i === 0} />
              ))}
            </div>
          </div>
        )}
        </>
        )}
        {vista === 'lista' && filters.busqueda && (lugaresHallados.length > 0 || zonasHalladas.length > 0) && (
          <div className="alternative-plans">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TAMBIÉN ENCONTRAMOS</p>
                <h3>
                  Lugares y zonas
                  <span className="heading-period">.</span>
                </h3>
              </div>
              <span className="result-count">
                {lugaresHallados.length + zonasHalladas.length} resultados
              </span>
            </div>
            {zonasHalladas.length > 0 && (
              <div className="category-filters">
                {zonasHalladas.map((z) => (
                  <Link key={z.zona} className="chip" href={`/zonas/${zonaSlug(z.zona)}`}>
                    {z.zona} · {z.lugares.length}
                  </Link>
                ))}
              </div>
            )}
            <div className="venue-grid">
              {lugaresHallados.slice(0, 9).map((l) => (
                <VenueCard key={l.slug} lugar={l} proximos={conteoLugar.get(l.nombre) || 0} />
              ))}
            </div>
          </div>
        )}
        {vista === 'lista' && ver !== 'eventos' && venues.status === 'ok' && lugaresZona.length > 0 && (
          <div className={ver === 'lugares' ? '' : 'alternative-plans'}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {ver === 'lugares' ? 'ABIERTOS AUNQUE NO HAYA EVENTO' : 'AUNQUE NO HAYA EVENTO'}
                </p>
                <h3>
                  Lugares para salir
                  <span className="heading-period">.</span>
                </h3>
              </div>
              {ver === 'lugares' ? (
                <span className="result-count">
                  {lugaresZona.length} {lugaresZona.length === 1 ? 'lugar' : 'lugares'}
                </span>
              ) : (
                <Link className="result-count" href={href('ver', 'lugares')}>
                  Ver los {venues.lugares.length} ↗
                </Link>
              )}
            </div>
            <div className="venue-grid">
              {(ver === 'lugares' ? lugaresZona : lugaresZona.slice(0, 6)).map((l) => (
                <VenueCard key={l.slug} lugar={l} proximos={conteoLugar.get(l.nombre) || 0} />
              ))}
            </div>
          </div>
        )}
        {result.status === 'ok' && freshness !== 'fresh' && (
          <p className="trust-note" role="status">
            {freshness === 'editorial'
              ? 'Cartelera seleccionada a partir de fuentes públicas. Consulta la fecha de revisión de cada evento; la cobertura aún es parcial.'
              : freshness === 'delayed'
                ? 'La búsqueda de nuevos planes está atrasada. La cartelera puede estar incompleta; revisa siempre la publicación original.'
                : freshness === 'updating'
                  ? 'Estamos consultando las fuentes. Los nuevos planes pasan por revisión antes de aparecer.'
                  : 'No pudimos comprobar cuándo se consultaron las fuentes por última vez. La cartelera puede estar incompleta.'}
          </p>
        )}
        {result.status === 'ok' && result.events.length > 0 && (
          <p className="trust-note">
            La información puede cambiar. Cada plan incluye su fuente y fecha de revisión.{' '}
            <Link href="/confianza">Cómo revisamos los datos ↗</Link>
          </p>
        )}
      </section>
      {home && !filters.busqueda && (
        <ZoneRail lugares={venues.lugares} eventos={result.events} hoy={today} />
      )}
      <section className="container contribution-strip">
        <span className="strip-symbol" aria-hidden="true">
          ↗
        </span>
        <div>
          <p className="eyebrow">¿ORGANIZAS ALGO?</p>
          <h2>Que el dato no quede en el grupo.</h2>
          <p>Envíanos el evento y su publicación original. Lo revisamos antes de sumarlo.</p>
        </div>
        <Link href="/publicar" className="button button-light">
          Proponer un evento ↗
        </Link>
      </section>
    </>
  );
}
