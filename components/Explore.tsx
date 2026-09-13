import Link from 'next/link';
import { getPublicEvents } from '../lib/server-events';
import { eventDateLabel, filterEvents } from '../lib/events';
import { toChileDateString } from '../lib/event-extraction';
import { parseFilters } from '../lib/filters';
import { CATEGORIAS, CIUDADES } from '../lib/types';
import EventCard from './EventCard';
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
  const result = await getPublicEvents();
  const today = toChileDateString(result.checkedAt);
  const events = filterEvents(result.events, filters, today);
  const todayCount = filterEvents(result.events, { fecha: 'hoy' }, today).length;
  const path = home ? '/' : '/buscar';
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
      <section className={`hero container ${home ? '' : 'hero-small'}`}>
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> REGIÓN DE VALPARAÍSO{' '}
            <span className="hero-date">/ {dateLabel}</span>
          </p>
          <h1>
            {home ? (
              <>
                ¿Dónde se
                <br />
                carretea <em>hoy?</em>
              </>
            ) : (
              <>
                Tu próxima
                <br />
                <em>buena noche.</em>
              </>
            )}
          </h1>
          <p className="hero-description">
            Fiestas, tocatas y pistas de baile.
            <br />
            Encuentra tu plan. Revisa la fuente. Junta a tu gente.
          </p>
          <a href="#cartelera" className="hero-jump">
            Ver la cartelera <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="night-poster" aria-hidden="true">
          <span className="poster-edition">DE LOS CERROS A LA PISTA</span>
          <span className="poster-star">✳</span>
          <strong>
            LA NOCHE
            <br />
            ES LOCAL.
          </strong>
          <span className="poster-bottom">
            33° SUR <span>V REGIÓN ↗</span>
          </span>
        </div>
      </section>
      <section className="container discovery" id="cartelera" aria-label="Cartelera de eventos">
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
        </div>
        <div className="city-filters" aria-label="Filtrar por zona">
          <Link
            href={href('ciudad', 'todos')}
            className={filters.ciudad === 'todos' ? 'selected' : ''}
            aria-current={filters.ciudad === 'todos' ? 'true' : undefined}
          >
            Toda la costa
          </Link>
          {CIUDADES.map((c) => (
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
              <span className="eyebrow">LA NOCHE NO TERMINA AQUÍ</span>
              <h3>
                {result.events.length === 0
                  ? 'Estamos buscando los próximos planes.'
                  : 'No encontramos planes con estos filtros.'}
              </h3>
              <p>
                {result.events.length === 0
                  ? 'Por ahora no tenemos eventos revisados para mostrar. Preferimos una cartelera vacía a mandarte a un carrete que ya pasó.'
                  : 'Prueba otra zona, cambia de estilo o mira las próximas noches.'}
              </p>
              <div className="actions">
                <Link className="button button-primary" href="/buscar?fecha=futuro">
                  Ver próximas noches <span aria-hidden="true">↗</span>
                </Link>
                <Link className="button button-outline" href="/publicar">
                  Tengo un dato
                </Link>
              </div>
            </div>
            <span className="empty-symbol" aria-hidden="true">
              ✳
            </span>
          </div>
        ) : (
          <div className="event-grid">
            {events.map((e) => (
              <EventCard key={e.id} evento={e} today={today} />
            ))}
          </div>
        )}
        {result.status === 'ok' && result.events.length > 0 && (
          <p className="trust-note">
            La información puede cambiar. Cada plan incluye su fuente y fecha de revisión.{' '}
            <Link href="/confianza">Cómo revisamos los datos ↗</Link>
          </p>
        )}
        {result.status === 'ok' && events.length === 0 && result.events.length > 0 && (
          <div className="alternative-plans">
            <h3>Otras noches en la región</h3>
            {result.events.slice(0, 3).map((e) => (
              <Link href={`/evento/${e.id}`} key={e.id}>
                <span>{eventDateLabel(e.fecha, today)}</span>
                <strong>{e.nombre}</strong>
                <span>{e.ciudad} ↗</span>
              </Link>
            ))}
          </div>
        )}
      </section>
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
      <section className="container trust-strip">
        <div>
          <span>01 / ENCUENTRA</span>
          <p>Filtra por noche, zona y música.</p>
        </div>
        <div>
          <span>02 / CONFIRMA</span>
          <p>Mira la fuente, la hora y la entrada.</p>
        </div>
        <div>
          <span>03 / COMPARTE</span>
          <p>Manda el plan a tu grupo. Nos vemos allá.</p>
        </div>
      </section>
    </>
  );
}
