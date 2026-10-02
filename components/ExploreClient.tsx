'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { diversifyByVenue, filterEvents } from '../lib/events';
import { toChileDateString } from '../lib/event-extraction';
import { parseFilters } from '../lib/filters';
import { CIUDADES_NUCLEO, type FiltrosEvento } from '../lib/types';
import { escenasConOferta } from '../lib/escenas';
import { buscarLugares, buscarZonas, zonaSlug } from '../lib/venues';
import { normalizar, puntosDeMapa } from '../lib/map';
import type { PublicSnapshot } from '../lib/snapshot';
import EventCard from './EventCard';
import VenueCard from './VenueCard';
import ZoneRail from './ZoneRail';
import VenueMap from './VenueMap';

const SHORT: Record<string, string> = { Valparaíso: 'Valpo', 'Viña del Mar': 'Viña' };
type Ver = 'todo' | 'eventos' | 'lugares';
type Vista = 'lista' | 'mapa';
interface Estado {
  filtros: FiltrosEvento;
  ver: Ver;
  vista: Vista;
}
/** Un snapshot más viejo que esto se avisa, sin bloquear nada. */
const VIEJO_MS = 6 * 3600_000;
/** Al volver a la pestaña, si pasó esto, se pregunta (con ETag) si hay datos nuevos. */
const REVISAR_MS = 10 * 60_000;

function leer(search: string, defecto: string): Estado {
  const p = new URLSearchParams(search);
  return {
    filtros: parseFilters(p, defecto),
    ver: p.get('ver') === 'eventos' ? 'eventos' : p.get('ver') === 'lugares' ? 'lugares' : 'todo',
    vista: p.get('vista') === 'mapa' ? 'mapa' : 'lista',
  };
}
/** URL limpia: solo lo que difiere del valor por defecto. */
function aUrl(e: Estado, path: string, defecto: string) {
  const p = new URLSearchParams();
  const f = e.filtros;
  if (f.busqueda) p.set('q', f.busqueda);
  if (f.fecha && f.fecha !== defecto) p.set('fecha', f.fecha);
  for (const k of ['ciudad', 'escena', 'precio', 'tipo', 'categoria'] as const) {
    const v = f[k];
    if (v && v !== 'todos') p.set(k, v);
  }
  if (e.ver !== 'todo') p.set('ver', e.ver);
  if (e.vista !== 'lista') p.set('vista', e.vista);
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}

/**
 * Explorar corre en el teléfono. El servidor entrega una vez el snapshot
 * público (en el HTML) y desde ahí cada filtro, búsqueda, cambio a lugares o
 * al mapa es JavaScript local: cero peticiones al servidor. La URL se
 * actualiza igual, así que compartir, recargar y volver atrás funcionan.
 */
export default function ExploreClient({ snapshot, home = false }: { snapshot: PublicSnapshot; home?: boolean }) {
  const path = home ? '/' : '/explorar';
  const defecto = home ? 'hoy' : 'futuro';
  const [snap, setSnap] = useState(snapshot);
  const [estado, setEstado] = useState<Estado>(() => leer('', defecto));
  // "Hoy" se calcula en el teléfono: un snapshot viejo nunca revive eventos pasados.
  const [today, setToday] = useState(() => toChileDateString(new Date(snapshot.generatedAt)));
  const [ahora, setAhora] = useState(() => Date.parse(snapshot.generatedAt));

  useEffect(() => {
    setToday(toChileDateString(new Date()));
    setAhora(Date.now());
    setEstado(leer(location.search, defecto));
    const alVolver = () => setEstado(leer(location.search, defecto));
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [defecto]);

  // Datos nuevos sin interrumpir: solo al volver a la pestaña y con ETag (304 si no cambió).
  useEffect(() => {
    const revisar = async () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - Date.parse(snap.generatedAt) < REVISAR_MS) return;
      try {
        const r = await fetch('/api/snapshot', { headers: { 'If-None-Match': `"${snap.version}"` } });
        if (r.status === 200) {
          const nuevo = (await r.json()) as PublicSnapshot;
          if (nuevo.status === 'ok') setSnap(nuevo);
        }
        setToday(toChileDateString(new Date()));
        setAhora(Date.now());
      } catch {
        /* sin red: se sigue usando lo que hay */
      }
    };
    document.addEventListener('visibilitychange', revisar);
    return () => document.removeEventListener('visibilitychange', revisar);
  }, [snap]);

  const ir = useCallback(
    (cambio: Partial<FiltrosEvento> & { ver?: Ver; vista?: Vista }, reemplazar = false) => {
      setEstado((prev) => {
        const { ver, vista, ...filtros } = cambio;
        const next: Estado = {
          filtros: { ...prev.filtros, ...filtros },
          ver: ver ?? prev.ver,
          vista: vista ?? prev.vista,
        };
        const url = aUrl(next, path, defecto);
        if (reemplazar) history.replaceState(null, '', url);
        else history.pushState(null, '', url);
        return next;
      });
    },
    [path, defecto],
  );
  const enlace = (cambio: Partial<FiltrosEvento> & { ver?: Ver; vista?: Vista }) => ({
    href: aUrl(
      {
        filtros: { ...estado.filtros, ...cambio },
        ver: cambio.ver ?? estado.ver,
        vista: cambio.vista ?? estado.vista,
      },
      path,
      defecto,
    ),
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      ir(cambio);
    },
  });

  const { filtros, ver, vista } = estado;
  const todos = snap.events;
  const events = useMemo(() => diversifyByVenue(filterEvents(todos, filtros, today)), [todos, filtros, today]);
  const derivados = useMemo(() => {
    const conteoLugar = new Map<string, number>();
    const hoyPorLugar = new Map<string, string>();
    for (const e of todos) {
      if (!e.lugar || e.fecha < today) continue;
      conteoLugar.set(e.lugar, (conteoLugar.get(e.lugar) || 0) + 1);
      if (e.fecha === today && !hoyPorLugar.has(e.lugar)) hoyPorLugar.set(e.lugar, e.nombre);
    }
    const lugaresZona = (filtros.ciudad === 'todos' ? snap.venues : snap.venues.filter((l) => l.ciudad === filtros.ciudad))
      .slice()
      .sort((a, b) => (conteoLugar.get(b.nombre) || 0) - (conteoLugar.get(a.nombre) || 0));
    const porCiudad = new Map<string, number>();
    for (const e of todos) if (e.fecha >= today) porCiudad.set(e.ciudad, (porCiudad.get(e.ciudad) || 0) + 1);
    return {
      conteoLugar,
      hoyPorLugar,
      lugaresZona,
      porCiudad,
      ciudadesConOferta: CIUDADES_NUCLEO.filter((c) => (porCiudad.get(c) || 0) > 0),
      escenas: escenasConOferta(filterEvents(todos, { ...filtros, escena: 'todos' }, today)),
      todayCount: filterEvents(todos, { fecha: 'hoy' }, today).length,
      mananaCount: filterEvents(todos, { fecha: 'manana' }, today).length,
      lugaresHallados: filtros.busqueda ? buscarLugares(snap.venues, filtros.busqueda) : [],
      zonasHalladas: filtros.busqueda ? buscarZonas(snap.venues, filtros.busqueda) : [],
      sugerencias: todos
        .filter((e) => e.fecha >= today)
        .filter((e, i, all) => all.findIndex((o) => o.lugar === e.lugar && o.ciudad === e.ciudad) === i)
        .slice(0, 3),
    };
  }, [todos, snap.venues, filtros, today]);
  const lugaresVisibles = useMemo(() => {
    const coincidencias = new Set(events.map((e) => normalizar(e.lugar || '')));
    const refinar = [filtros.escena, filtros.precio, filtros.tipo, filtros.categoria].some((v) => v && v !== 'todos');
    return derivados.lugaresZona.filter((l) => {
      const coincideLugar = !filtros.busqueda || derivados.lugaresHallados.some((x) => x.slug === l.slug);
      return coincideLugar && (!refinar || coincidencias.has(normalizar(l.nombre)));
    });
  }, [events, filtros, derivados.lugaresZona, derivados.lugaresHallados]);
  const lugaresMapa = useMemo(() => {
    if (ver === 'lugares') return lugaresVisibles;
    const nombres = new Set(events.map((e) => normalizar(e.lugar || '')));
    const elegidos = new Set(lugaresVisibles.map((l) => l.slug));
    return derivados.lugaresZona.filter((l) => nombres.has(normalizar(l.nombre)) || (ver === 'todo' && elegidos.has(l.slug)));
  }, [ver, events, lugaresVisibles, derivados.lugaresZona]);
  const puntos = useMemo(
    () => vista === 'mapa' ? puntosDeMapa(lugaresMapa, events, today) : [],
    [vista, lugaresMapa, events, today],
  );
  const vigentes = todos.filter((e) => e.fecha >= today).length;
  const viejo = ahora - Date.parse(snap.generatedAt) > VIEJO_MS;
  const dateLabel = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Santiago',
  }).format(new Date(`${today}T15:00:00Z`));

  return (
    <>
      <section className={`hero container ${home ? 'hero-home' : 'hero-small'}`}>
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> REGIÓN DE VALPARAÍSO <span className="hero-date">/ {dateLabel}</span>
          </p>
          <h1>
            {home ? (
              <>
                ¿Dónde <em>salgo?</em>
              </>
            ) : (
              <>
                Explorar <em>la noche.</em>
              </>
            )}
          </h1>
          {/* Dónde estás es la primera pregunta. Selección manual; nunca se pide ubicación. */}
          <div className="lugar-selector" role="group" aria-label="Elegir ciudad">
            <a {...enlace({ ciudad: 'todos' })} className={filtros.ciudad === 'todos' ? 'activa' : ''} aria-current={filtros.ciudad === 'todos' ? 'true' : undefined}>
              Toda la región
            </a>
            {derivados.ciudadesConOferta.map((c) => (
              <a key={c} {...enlace({ ciudad: c })} className={filtros.ciudad === c ? 'activa' : ''} aria-current={filtros.ciudad === c ? 'true' : undefined}>
                {SHORT[c] || c}
                <span>{derivados.porCiudad.get(c)}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className={`container discovery ${home ? 'discovery-home' : ''}`} id="cartelera" aria-label="Cartelera">
        <form
          className="search-form"
          role="search"
          action={path}
          onSubmit={(e) => {
            e.preventDefault();
            ir({ busqueda: filtros.busqueda || '' });
          }}
        >
          <label htmlFor="q" className="sr-only">
            Buscar evento, lugar, artista o zona
          </label>
          <span aria-hidden="true">⌕</span>
          <input
            id="q"
            name="q"
            type="search"
            maxLength={120}
            value={filtros.busqueda || ''}
            onChange={(e) => ir({ busqueda: e.target.value.slice(0, 120) }, true)}
            placeholder="Buscar lugar, evento, artista o zona"
          />
          {filtros.busqueda ? (
            <button type="button" aria-label="Borrar búsqueda" onClick={() => ir({ busqueda: '' })}>
              ✕
            </button>
          ) : (
            <button aria-label="Buscar" type="submit">
              Buscar
            </button>
          )}
        </form>
        <div className="date-tabs" aria-label="Cuándo">
          {(
            [
              ['hoy', 'Esta noche', derivados.todayCount],
              ['manana', 'Mañana', derivados.mananaCount],
              ['finde', 'Este finde', 0],
              ['futuro', 'Más adelante', 0],
            ] as const
          ).map(([v, label, n]) => (
            <a key={v} {...enlace({ fecha: v })} className={filtros.fecha === v ? 'selected' : ''} aria-current={filtros.fecha === v ? 'true' : undefined}>
              {label}
              {n > 0 && <span>{n}</span>}
            </a>
          ))}
        </div>
        <details className="discovery-options" open={home ? undefined : true}><summary>Más opciones{(filtros.escena !== 'todos' || filtros.precio === 'gratis' || ver !== 'todo' || vista !== 'lista') ? ' · filtros activos' : ''}</summary>
        {derivados.escenas.length > 0 && (
          <div className="escenas" aria-label="Escenas">
            {derivados.escenas.map((x) => {
              const activa = filtros.escena === x.slug;
              return (
                <a key={x.slug} {...enlace({ escena: activa ? 'todos' : x.slug })} className={`chip ${activa ? 'selected' : ''}`} aria-current={activa ? 'true' : undefined}>
                  {x.label} <span className="chip-n">{x.n}</span>
                </a>
              );
            })}
            <a {...enlace({ precio: filtros.precio === 'gratis' ? 'todos' : 'gratis' })} className={`chip free-filter ${filtros.precio === 'gratis' ? 'selected' : ''}`} aria-current={filtros.precio === 'gratis' ? 'true' : undefined}>
              Gratis
            </a>
          </div>
        )}
        <div className="explore-controls">
          <div className="segmented" role="group" aria-label="Qué mostrar">
            {(
              [
                ['todo', 'Todo'],
                ['eventos', 'Eventos'],
                ['lugares', 'Lugares'],
              ] as const
            ).map(([v, label]) => (
              <a key={v} {...enlace({ ver: v })} className={ver === v ? 'activa' : ''} aria-current={ver === v ? 'true' : undefined}>
                {label}
              </a>
            ))}
          </div>
          <div className="segmented segmented-vista" role="group" aria-label="Cómo mostrarlo">
            {(
              [
                ['lista', 'Lista'],
                ['mapa', 'Mapa'],
              ] as const
            ).map(([v, label]) => (
              <a key={v} {...enlace({ vista: v })} className={vista === v ? 'activa' : ''} aria-current={vista === v ? 'true' : undefined}>
                {label}
              </a>
            ))}
          </div>
        </div>
        </details>
        {viejo && (
          <p className="trust-note" role="status">
            Estos datos tienen más de 6 horas. Siguen siendo útiles, pero confirma en la fuente antes de salir.
          </p>
        )}
        {vista === 'mapa' && (
          <>
            {puntos.length ? (
              <VenueMap puntos={puntos} />
            ) : (
              <p className="empty-state">Ninguno de estos lugares tiene todavía una ubicación verificada.</p>
            )}
            <p className="trust-note">
              {puntos.length} de {lugaresMapa.length} lugares con ubicación verificada. Los demás siguen en la
              lista: preferimos no ponerlos en la esquina equivocada.
            </p>
          </>
        )}
        {vista === 'lista' && ver !== 'lugares' && (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{filtros.ciudad === 'todos' ? 'VALPO Y ALREDEDORES' : filtros.ciudad}</p>
                <h2>
                  {filtros.fecha === 'hoy'
                    ? 'Esta noche'
                    : filtros.fecha === 'finde'
                      ? 'Este finde'
                      : filtros.fecha === 'manana'
                        ? 'Mañana'
                        : 'Lo que se viene'}
                  <span className="heading-period">.</span>
                </h2>
              </div>
              {snap.status === 'ok' && (
                <span className="result-count">
                  {events.length} {events.length === 1 ? 'plan' : 'planes'}
                </span>
              )}
            </div>
            {snap.status === 'error' && vigentes === 0 ? (
              <div className="empty-state error-state" role="alert">
                <h3>No pudimos cargar la cartelera.</h3>
                <p>Hay un problema temporal de conexión. No podemos confirmar qué eventos están disponibles.</p>
                <a className="button button-primary" href={path}>
                  Volver a intentar
                </a>
              </div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <h3>
                  {vigentes === 0
                    ? 'Todavía no tenemos planes confirmados.'
                    : filtros.fecha === 'hoy'
                      ? 'No tenemos nada confirmado para esta noche acá.'
                      : 'No encontramos nada con estos filtros.'}
                </h3>
                <p>Prueba otra noche u otra comuna, o revisa los lugares para salir.</p>
                <div className="actions">
                  <a className="button button-primary" {...enlace({ ver: 'lugares' })}>
                    Lugares para salir
                  </a>
                  <a className="button button-outline" {...enlace({ fecha: 'finde', escena: 'todos', busqueda: '' })}>
                    Ver este finde
                  </a>
                </div>
              </div>
            ) : (
              <div className="event-grid">
                {events.map((e, i) => (
                  <EventCard key={e.id} evento={e} today={today} priority={i === 0} />
                ))}
              </div>
            )}
            {events.length === 0 && derivados.sugerencias.length > 0 && (
              <div className="alternative-plans">
                <h3>Otras noches en la región</h3>
                <div className="event-grid">
                  {derivados.sugerencias.map((e) => (
                    <EventCard key={e.id} evento={e} today={today} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {vista === 'lista' && ver === 'todo' && filtros.busqueda && (derivados.lugaresHallados.length > 0 || derivados.zonasHalladas.length > 0) && (
          <div className="alternative-plans">
            <div className="section-heading">
              <h3>
                Lugares y zonas<span className="heading-period">.</span>
              </h3>
              <span className="result-count">{derivados.lugaresHallados.length + derivados.zonasHalladas.length} resultados</span>
            </div>
            {derivados.zonasHalladas.length > 0 && (
              <div className="category-filters">
                {derivados.zonasHalladas.map((z) => (
                  <Link prefetch={false} key={z.zona} className="chip" href={`/zonas/${zonaSlug(z.zona)}`}>
                    {z.zona} · {z.lugares.length}
                  </Link>
                ))}
              </div>
            )}
            <div className="venue-grid">
              {lugaresVisibles.slice(0, 9).map((l) => (
                <VenueCard key={l.slug} lugar={l} proximos={derivados.conteoLugar.get(l.nombre) || 0} hoy={derivados.hoyPorLugar.get(l.nombre) || null} />
              ))}
            </div>
          </div>
        )}
        {vista === 'lista' && ver !== 'eventos' && !(filtros.busqueda && ver !== 'lugares') && (
          <div className={ver === 'lugares' ? '' : 'alternative-plans'}>
            <div className="section-heading">
              <h3>
                Lugares para salir<span className="heading-period">.</span>
              </h3>
              {ver === 'lugares' ? (
                <span className="result-count">
                  {lugaresVisibles.length} {lugaresVisibles.length === 1 ? 'lugar' : 'lugares'}
                </span>
              ) : (
                <a className="result-count" {...enlace({ ver: 'lugares' })}>
                  Ver los {lugaresVisibles.length} ↗
                </a>
              )}
            </div>
            {lugaresVisibles.length === 0 && <div className="empty-state"><h3>No encontramos lugares con estos filtros.</h3><a className="button button-outline" {...enlace({ busqueda: '', escena: 'todos', precio: 'todos', ciudad: 'todos' })}>Ver otros lugares</a></div>}
            <div className="venue-grid">
              {(ver === 'lugares' ? lugaresVisibles : lugaresVisibles.slice(0, 6)).map((l) => (
                <VenueCard key={l.slug} lugar={l} proximos={derivados.conteoLugar.get(l.nombre) || 0} hoy={derivados.hoyPorLugar.get(l.nombre) || null} />
              ))}
            </div>
          </div>
        )}
        {snap.status === 'ok' && snap.freshness !== 'fresh' && snap.freshness !== 'editorial' && (
          <p className="trust-note" role="status">
            La búsqueda de nuevos planes está atrasada. Revisa siempre la publicación original.
          </p>
        )}
      </section>
      {home && !filtros.busqueda && vista === 'lista' && <ZoneRail lugares={snap.venues} eventos={todos} hoy={today} />}
      <section className="container contribution-strip">
        <div>
          <h2>¿Organizas algo?</h2>
          <p>Mándanos el evento y su publicación original. Lo revisamos antes de sumarlo.</p>
        </div>
        <Link prefetch={false} href="/publicar" className="button button-light">
          Proponer un evento ↗
        </Link>
      </section>
    </>
  );
}
