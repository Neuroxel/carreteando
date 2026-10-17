'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { diversifyByVenue, esBarato, filterEvents, nocheAntes, ordenarPorPrecio } from '../lib/events';
import { toChileDateString } from '../lib/event-extraction';
import { parseFilters } from '../lib/filters';
import { CIUDADES, type FiltrosEvento } from '../lib/types';
import { escenasConLugares, lugarEnEscena } from '../lib/escenas';
import { buscarLugares, buscarZonas, zonaSlug } from '../lib/venues';
import { normalizar, puntosDeMapa } from '../lib/map';
import type { PublicSnapshot } from '../lib/snapshot';
import { rememberEmptySearch } from '../lib/metrics';
import { ORDEN_TEMPORAL, ahoraEnChile, estadoTemporal, porEstadoTemporal } from '../lib/temporal';
import { CLAVE_GPS_NEGADO, OPCIONES_GPS, leerCapa, porCercania, textoDistancia, type Capa, type Posicion } from '../lib/radar';
import EventCard from './EventCard';
import VenueCard from './VenueCard';
import VenueRail from './VenueRail';
import VenueMap from './VenueMap';
import { LogoApilado } from './Logo';
import PosterDecor from './poster/PosterDecor';

const SHORT: Record<string, string> = { Valparaíso: 'Valpo', 'Viña del Mar': 'Viña' };
type Ver = 'todo' | 'eventos' | 'lugares';
type Vista = 'lista' | 'mapa';
type Orden = 'recomendados' | 'barato';
interface Estado {
  filtros: FiltrosEvento;
  ver: Ver;
  vista: Vista;
  orden: Orden;
  /** Solo en el mapa (Radar): carretes de hoy o todos los boliches. */
  capa: Capa;
}
type Cambio = Partial<FiltrosEvento> & { ver?: Ver; vista?: Vista; orden?: Orden; capa?: Capa };
type Gps = 'idle' | 'pidiendo' | 'ok' | 'negado' | 'error' | 'no';
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
    orden: p.get('orden') === 'barato' ? 'barato' : 'recomendados',
    capa: leerCapa(p.get('capa')),
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
  if (e.orden !== 'recomendados') p.set('orden', e.orden);
  if (e.vista === 'mapa' && e.capa !== 'hoy') p.set('capa', e.capa);
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
    (cambio: Cambio, reemplazar = false) => {
      setEstado((prev) => {
        const { ver, vista, orden, capa, ...filtros } = cambio;
        const next: Estado = {
          filtros: { ...prev.filtros, ...filtros },
          ver: ver ?? prev.ver,
          vista: vista ?? prev.vista,
          orden: orden ?? prev.orden,
          capa: capa ?? prev.capa,
        };
        const url = aUrl(next, path, defecto);
        if (reemplazar) history.replaceState(null, '', url);
        else history.pushState(null, '', url);
        return next;
      });
    },
    [path, defecto],
  );
  const enlace = (cambio: Cambio) => ({
    href: aUrl(
      {
        filtros: { ...estado.filtros, ...cambio },
        ver: cambio.ver ?? estado.ver,
        vista: cambio.vista ?? estado.vista,
        orden: cambio.orden ?? estado.orden,
        capa: cambio.capa ?? estado.capa,
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

  // Radar: la ubicación se pide solo cuando la persona abre el Radar, una vez,
  // y queda en este teléfono. Si dice que no, el mapa sigue igual y no se insiste.
  const [yo, setYo] = useState<Posicion | null>(null);
  const [gps, setGps] = useState<Gps>('idle');
  const ubicar = useCallback((manual: boolean) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return setGps('no');
    if (!manual) {
      try {
        if (localStorage.getItem(CLAVE_GPS_NEGADO)) return setGps('negado');
      } catch {
        /* sin almacenamiento: se pregunta como si fuera la primera vez */
      }
    }
    setGps('pidiendo');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setYo({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGps('ok');
        try {
          localStorage.removeItem(CLAVE_GPS_NEGADO);
        } catch {
          /* nada que limpiar */
        }
      },
      (err) => {
        if (err.code !== err.PERMISSION_DENIED) return setGps('error');
        setGps('negado');
        try {
          localStorage.setItem(CLAVE_GPS_NEGADO, '1');
        } catch {
          /* igual no se vuelve a preguntar en esta visita */
        }
      },
      OPCIONES_GPS,
    );
  }, []);
  useEffect(() => {
    // Tocar Radar en la barra es el gesto que autoriza preguntar.
    const abrir = () => ubicar(false);
    window.addEventListener('radar:abrir', abrir);
    // Desde otra página, la barra llega con ?ubicar=1; se consume y se borra.
    const p = new URLSearchParams(location.search);
    if (p.get('ubicar') === '1') {
      p.delete('ubicar');
      const q = p.toString();
      history.replaceState(null, '', q ? `${location.pathname}?${q}` : location.pathname);
      ubicar(false);
    }
    return () => window.removeEventListener('radar:abrir', abrir);
  }, [ubicar]);
  const { filtros, ver, vista, orden, capa } = estado;
  useEffect(() => {
    // Un mapa abierto por enlace solo usa la ubicación si ya estaba permitida: sin aviso nuevo.
    if (vista !== 'mapa' || gps !== 'idle' || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((r) => r.state === 'granted' && ubicar(false))
      .catch(() => undefined);
  }, [vista, gps, ubicar]);
  const todos = snap.events;
  // Reloj de Chile para "Ya empezó": se actualiza cada minuto en el teléfono, sin pedir nada.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const ahoraCL = useMemo(() => ahoraEnChile(new Date(ahora)), [ahora]);
  const events = useMemo(() => {
    const lista = diversifyByVenue(filterEvents(todos, filtros, today));
    // Lo que todavía no empieza va primero; lo iniciado sigue en la lista, después.
    return orden === 'barato' ? ordenarPorPrecio(lista) : porEstadoTemporal(nocheAntes(lista), ahoraCL);
  }, [todos, filtros, today, orden, ahoraCL]);
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
    // Una comuna con buenos lugares y sin eventos hoy sigue siendo un lugar donde salir.
    const lugaresPorCiudad = new Map<string, number>();
    for (const l of snap.venues) lugaresPorCiudad.set(l.ciudad, (lugaresPorCiudad.get(l.ciudad) || 0) + 1);
    const peso = (c: string) => (porCiudad.get(c) || 0) + (lugaresPorCiudad.get(c) || 0);
    return {
      conteoLugar,
      hoyPorLugar,
      lugaresZona,
      porCiudad,
      lugaresPorCiudad,
      ciudadesConOferta: CIUDADES.filter((c) => peso(c) > 0).sort((a, b) => peso(b) - peso(a)),
      escenas: escenasConLugares(
        filterEvents(todos, { ...filtros, escena: 'todos' }, today),
        filtros.ciudad === 'todos' ? snap.venues : snap.venues.filter((l) => l.ciudad === filtros.ciudad),
      ),
      todayCount: filterEvents(todos, { fecha: 'hoy' }, today).length,
      baratos: filterEvents(todos, { ...filtros, precio: 'todos', escena: 'todos' }, today).filter(esBarato).length,
      mananaCount: filterEvents(todos, { fecha: 'manana' }, today).length,
      busquedaEventos: filtros.busqueda ? filterEvents(todos, { fecha: 'futuro', busqueda: filtros.busqueda }, today).length : 0,
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
    const escena = filtros.escena && filtros.escena !== 'todos' ? filtros.escena : null;
    const refinar = [filtros.precio, filtros.tipo, filtros.categoria].some((v) => v && v !== 'todos');
    return derivados.lugaresZona.filter((l) => {
      const coincideLugar = !filtros.busqueda || derivados.lugaresHallados.some((x) => x.slug === l.slug);
      const tieneEvento = coincidencias.has(normalizar(l.nombre));
      // La escena sale primero de lo que el lugar es; un evento que calza también cuenta.
      const coincideEscena = !escena || lugarEnEscena(l, escena) || tieneEvento;
      return coincideLugar && coincideEscena && (!refinar || tieneEvento);
    });
  }, [events, filtros, derivados.lugaresZona, derivados.lugaresHallados]);
  const sinResultados = Boolean(filtros.busqueda) && derivados.busquedaEventos === 0 && derivados.lugaresHallados.length === 0 && derivados.zonasHalladas.length === 0;
  useEffect(() => {
    if (sinResultados) rememberEmptySearch(filtros.busqueda || null);
    else if (filtros.busqueda) rememberEmptySearch(null);
  }, [sinResultados, filtros.busqueda]);
  // Radar no usa las pestañas de fecha: siempre marca lo de hoy. "Carretes hoy"
  // muestra solo lugares con evento confirmado hoy; "Boliches", todos.
  const eventosHoy = useMemo(
    // Un evento con final publicado y ya pasado no es una recomendación activa.
    () =>
      vista === 'mapa'
        ? filterEvents(todos, { ...filtros, fecha: 'hoy' }, today).filter((e) => estadoTemporal(e, ahoraCL) !== 'finalizado')
        : [],
    [vista, todos, filtros, today, ahoraCL],
  );
  const lugaresMapa = useMemo(() => {
    if (vista !== 'mapa') return [];
    const escena = filtros.escena && filtros.escena !== 'todos' ? filtros.escena : null;
    const conEvento = new Set(eventosHoy.map((e) => normalizar(e.lugar || '')));
    return derivados.lugaresZona.filter((l) => {
      if (capa === 'hoy') return conEvento.has(normalizar(l.nombre));
      const coincideLugar = !filtros.busqueda || derivados.lugaresHallados.some((x) => x.slug === l.slug);
      return coincideLugar && (!escena || lugarEnEscena(l, escena) || conEvento.has(normalizar(l.nombre)));
    });
  }, [vista, capa, eventosHoy, filtros.busqueda, filtros.escena, derivados.lugaresZona, derivados.lugaresHallados]);
  const puntos = useMemo(
    () => (vista === 'mapa' ? puntosDeMapa(lugaresMapa, eventosHoy, today) : []),
    [vista, lugaresMapa, eventosHoy, today],
  );
  // Cercanía: primero lo que todavía no empieza, después lo ya iniciado y al final
  // los lugares sin evento hoy; dentro de cada grupo, por distancia.
  const cercanos = useMemo(() => {
    if (!yo || !puntos.length) return [];
    const orden = (p: (typeof puntos)[number]) =>
      p.estaNoche.length ? Math.min(...p.estaNoche.map((e) => ORDEN_TEMPORAL[estadoTemporal({ fecha: today, hora: e.hora }, ahoraCL)])) : 9;
    return porCercania(puntos, yo)
      .map((x) => ({ ...x, orden: orden(x.punto) }))
      .sort((a, b) => a.orden - b.orden || a.km - b.km)
      .slice(0, 6);
  }, [yo, puntos, today, ahoraCL]);
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
        <PosterDecor variant={home ? 'home' : 'small'} />
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> REGIÓN DE VALPARAÍSO <span className="hero-date">/ {dateLabel}</span>
          </p>
          <h1>
            {home ? (
              <>
                <LogoApilado className="hero-logo hero-logo-apilado" />
              </>
            ) : (
              vista === 'mapa' ? (
                <>
                  Radar <em>de carretes.</em>
                </>
              ) : ver === 'lugares' ? (
                <>
                  Boliches <em>para salir.</em>
                </>
              ) : (
                <>
                  Carretes <em>de la región.</em>
                </>
              )
            )}
          </h1>
          {home && <p className="hero-lead">¿Qué hay hoy? Eventos y lugares para salir en la Región de Valparaíso.</p>}
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
              Buscar lugar, fiesta, artista o zona
            </label>
            <span aria-hidden="true">⌕</span>
            <input
              id="q"
              name="q"
              type="search"
              maxLength={120}
              value={filtros.busqueda || ''}
              onChange={(e) => ir({ busqueda: e.target.value.slice(0, 120) }, true)}
              placeholder="Buscar lugar, fiesta, artista o zona"
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
          {/* Dónde estás es la primera pregunta. Selección manual; nunca se pide ubicación. */}
          <div className="lugar-selector" role="group" aria-label="Elegir ciudad">
            <a {...enlace({ ciudad: 'todos' })} className={filtros.ciudad === 'todos' ? 'activa' : ''} aria-current={filtros.ciudad === 'todos' ? 'true' : undefined}>
              Toda la región
            </a>
            {derivados.ciudadesConOferta.map((c) => (
              <a key={c} {...enlace({ ciudad: c })} className={filtros.ciudad === c ? 'activa' : ''} aria-current={filtros.ciudad === c ? 'true' : undefined}>
                {SHORT[c] || c}
                {(derivados.porCiudad.get(c) || 0) > 0 && <span>{derivados.porCiudad.get(c)}</span>}
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className={`container discovery ${home ? 'discovery-home' : ''}`} id="cartelera" aria-label="Cartelera">
        {vista === 'mapa' ? (
          <div className="radar-cabecera">
            <div className="segmented radar-capas" role="group" aria-label="Qué mostrar en el radar">
              <a {...enlace({ capa: 'hoy' })} className={capa === 'hoy' ? 'activa' : ''} aria-current={capa === 'hoy' ? 'true' : undefined}>
                <span className="radar-estrella" aria-hidden="true">✦</span> Carretes hoy
              </a>
              <a {...enlace({ capa: 'boliches' })} className={capa === 'boliches' ? 'activa' : ''} aria-current={capa === 'boliches' ? 'true' : undefined}>
                Boliches
              </a>
            </div>
            {gps === 'ok' ? (
              <p className="radar-gps">Ordenado por cercanía. Tu ubicación no sale de este teléfono.</p>
            ) : gps === 'pidiendo' ? (
              <p className="radar-gps" role="status">Buscando tu ubicación…</p>
            ) : gps === 'negado' ? (
              <p className="radar-gps">
                Sin tu ubicación el mapa funciona igual.{' '}
                <button type="button" className="radar-gps-boton" onClick={() => ubicar(true)}>
                  Volver a intentar
                </button>
              </p>
            ) : gps === 'no' ? null : (
              <button type="button" className="radar-gps-boton" onClick={() => ubicar(true)}>
                {gps === 'error' ? 'No pudimos ubicarte. Probar otra vez' : 'Ver qué hay cerca de mí'}
              </button>
            )}
          </div>
        ) : ver === 'lugares' ? null : (
        <div className="date-tabs" aria-label="Cuándo">
          {(
            [
              ['hoy', 'Hoy', derivados.todayCount],
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
        )}
        <details className="discovery-options"><summary>Filtros{(filtros.escena !== 'todos' || (filtros.precio && filtros.precio !== 'todos') || orden !== 'recomendados' || ver === 'eventos') ? ' · activos' : ''}</summary>
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
          </div>
        )}
        <div className="presupuesto" role="group" aria-label="Presupuesto por entrada">
          <span className="presupuesto-label">Presupuesto</span>
          {(
            [
              ['todos', 'Cualquiera'],
              ['gratis', 'Gratis'],
              ['5000', 'Hasta $5.000'],
              ['10000', 'Hasta $10.000'],
              ['15000', 'Hasta $15.000'],
            ] as const
          ).map(([v, label]) => {
            const activa = (filtros.precio || 'todos') === v || (v === 'todos' && filtros.precio === 'pago');
            return (
              <a key={v} {...enlace({ precio: v })} className={activa ? 'activa' : ''} aria-current={activa ? 'true' : undefined}>
                {label}
              </a>
            );
          })}
        </div>
        <p className="presupuesto-nota">Solo cuenta el precio publicado por la fuente; si no se sabe, no aparece como barato.</p>
        <div className="presupuesto" role="group" aria-label="Ordenar">
          <span className="presupuesto-label">Ordenar</span>
          {(
            [
              ['recomendados', 'Recomendados'],
              ['barato', 'Más barato'],
            ] as const
          ).map(([v, label]) => (
            <a key={v} {...enlace({ orden: v })} className={orden === v ? 'activa' : ''} aria-current={orden === v ? 'true' : undefined}>
              {label}
            </a>
          ))}
        </div>
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
        {vista === 'lista' && ver !== 'lugares' && derivados.baratos > 0 && (filtros.precio || 'todos') === 'todos' && (
          <a className="barato-atajo" {...enlace({ precio: '5000' })}>
            Barato {filtros.fecha === 'hoy' ? 'hoy' : 'en estas fechas'}: {derivados.baratos} gratis o hasta $5.000
          </a>
        )}
        {viejo && (
          <p className="trust-note" role="status">
            Estos datos tienen más de 6 horas. Siguen siendo útiles, pero confirma en la fuente antes de salir.
          </p>
        )}
        {vista === 'mapa' && (
          <>
            {puntos.length ? (
              <VenueMap puntos={puntos} yo={yo} />
            ) : capa === 'hoy' ? (
              <div className="empty-state">
                <h3>{eventosHoy.length ? 'Los carretes de hoy todavía no tienen ubicación verificada.' : 'No tenemos carretes confirmados para hoy acá.'}</h3>
                <div className="actions">
                  <a className="button button-primary" {...enlace({ capa: 'boliches' })}>
                    Ver todos los boliches
                  </a>
                </div>
              </div>
            ) : (
              <p className="empty-state">Ninguno de estos lugares tiene todavía una ubicación verificada.</p>
            )}
            {cercanos.length > 0 && (
              <div className="radar-cerca">
                <h3>
                  Más cerca de ti<span className="heading-period">.</span>
                </h3>
                <ol>
                  {cercanos.map(({ punto, km, orden }) => (
                    <li key={punto.slug}>
                      <Link prefetch={false} href={`/lugar/${punto.slug}`}>
                        <span className="radar-cerca-nombre">
                          {punto.estaNoche.length > 0 && <span className="radar-estrella" aria-label="Carrete hoy">✦ </span>}
                          {punto.nombre}
                        </span>
                        <span className="radar-cerca-dato">
                          {punto.estaNoche[0] ? `${punto.estaNoche[0].titulo}${punto.estaNoche[0].hora ? ` · ${punto.estaNoche[0].hora}` : ''}` : punto.tipoLabel}
                          {orden === ORDEN_TEMPORAL.iniciado ? ' · ya empezó' : ''}
                        </span>
                      </Link>
                      <span className="radar-cerca-km">{textoDistancia(km)}</span>
                    </li>
                  ))}
                </ol>
                <p className="trust-note">Distancia en línea recta, no a pie.</p>
              </div>
            )}
            <p className="trust-note">
              {capa === 'hoy'
                ? `✦ marca un evento confirmado para hoy (${eventosHoy.length} en total), no cuánta gente hay. `
                : ''}
              {puntos.length} de {lugaresMapa.length} lugares con ubicación verificada; preferimos no poner ninguno en la esquina equivocada.
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
                    ? 'Hoy'
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
            ) : events.length === 0 && sinResultados ? (
              <div className="empty-state">
                <h3>No encontramos «{filtros.busqueda}».</h3>
                <p>Revisa cómo se escribe o prueba con otra palabra: un barrio, un estilo o el nombre del lugar. Si es un lugar que falta, cuéntanos.</p>
                <div className="actions">
                  <a className="button button-primary" {...enlace({ busqueda: '' })}>
                    Borrar la búsqueda
                  </a>
                  <Link prefetch={false} className="button button-outline" href="/publicar?tipo=lugar#falta-un-lugar">
                    ¿Falta un lugar? ↗
                  </Link>
                </div>
              </div>
            ) : events.length === 0 && filtros.busqueda && derivados.busquedaEventos > 0 && filtros.fecha !== 'futuro' ? (
              <div className="empty-state">
                <h3>
                  Para esta fecha no hay nada con «{filtros.busqueda}».
                </h3>
                <p>
                  Hay {derivados.busquedaEventos} {derivados.busquedaEventos === 1 ? 'fecha anunciada' : 'fechas anunciadas'} más adelante.
                </p>
                <div className="actions">
                  <a className="button button-primary" {...enlace({ fecha: 'futuro' })}>
                    Ver más adelante
                  </a>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <h3>
                  {vigentes === 0
                    ? 'Todavía no tenemos planes confirmados.'
                    : filtros.fecha === 'hoy'
                      ? 'No tenemos nada confirmado para hoy acá.'
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
                  <EventCard key={e.id} evento={e} today={today} priority={i === 0} estado={estadoTemporal(e, ahoraCL)} />
                ))}
              </div>
            )}
            {events.length === 0 && derivados.sugerencias.length > 0 && (
              <div className="alternative-plans">
                <h3>Otras noches en la región</h3>
                <div className="event-grid">
                  {derivados.sugerencias.map((e) => (
                    <EventCard key={e.id} evento={e} today={today} estado={estadoTemporal(e, ahoraCL)} />
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
            {ver !== 'lugares' ? (
              <VenueRail
                lugares={lugaresVisibles}
                inicial={!filtros.ciudad || filtros.ciudad === 'todos' ? null : filtros.ciudad}
                conteo={derivados.conteoLugar}
                hoy={derivados.hoyPorLugar}
                verTodos={(c) => enlace({ ver: 'lugares', ciudad: c })}
              />
            ) : (
              <div className="venue-grid">
                {(ver === 'lugares' ? lugaresVisibles : lugaresVisibles.slice(0, 6)).map((l) => (
                  <VenueCard key={l.slug} lugar={l} proximos={derivados.conteoLugar.get(l.nombre) || 0} hoy={derivados.hoyPorLugar.get(l.nombre) || null} />
                ))}
              </div>
            )}
          </div>
        )}
        {snap.status === 'ok' && snap.freshness !== 'fresh' && snap.freshness !== 'editorial' && (
          <p className="trust-note" role="status">
            La búsqueda de nuevos planes está atrasada. Revisa siempre la publicación original.
          </p>
        )}
      </section>
      <section className="container contribution-strip">
        <div>
          <h2>¿Falta algo?</h2>
          <p>Mándanos un evento o un lugar que no esté, con su publicación o cuenta oficial. Lo revisamos antes de sumarlo.</p>
        </div>
        <div className="actions">
          <Link prefetch={false} href="/publicar" className="button button-light">
            Proponer un evento ↗
          </Link>
          <Link prefetch={false} href="/publicar?tipo=lugar#falta-un-lugar" className="button button-outline">
            ¿Falta un lugar? ↗
          </Link>
        </div>
      </section>
    </>
  );
}
