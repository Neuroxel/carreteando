'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { diversifyByVenue, sugerenciasPara, filterEvents, nocheAntes, ordenarPorPrecio } from '../lib/events';
import { addDays, fechaDeLaNoche } from '../lib/event-extraction';
import { parseFilters } from '../lib/filters';
import { CIUDADES, type Evento, type FiltrosEvento } from '../lib/types';
import { ESCENAS } from '../lib/escenas';
import { buscarLugares, buscarZonas, zonaSlug } from '../lib/venues';
import { puntosDeMapa } from '../lib/map';
import { indiceDeLugares } from '../lib/venue-match';
import type { PublicSnapshot } from '../lib/snapshot';
import { rememberEmptySearch } from '../lib/metrics';
import { ORDEN_TEMPORAL, ahoraEnChile, esMadrugada, estadoTemporal, nombreDia, porEstadoTemporal } from '../lib/temporal';
import { PRECISION_ZONA_M, fixUtil, RADIOS_KM, CLAVE_GPS_NEGADO_VIEJA, ubicarEnDosFases, type EstadoGps, type Fix, leerCapa, porCercania, textoDistancia, type Capa, type Posicion } from '../lib/radar';
import EventCard from './EventCard';
import VenueCard from './VenueCard';
import VenueRail from './VenueRail';
import VenueMap from './VenueMap';
import TituloSeccion from './TituloSeccion';
import BrandLink from './BrandLink';
import { LogoApilado } from './Logo';
import { cuantos, eventosLista, eventosRadar, lugaresLista, lugaresRadar, type Contexto, type Modo } from '../lib/resultados';
import { RUTA_GEOMETRIAS, sectorDeLugar, territorioDe, territorioPorSlug, zonaValida, zonasDeComuna, type TerritorioGeo } from '../lib/territorios';
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
  /** Solo en el mapa (Radar): carretes de hoy o todos los lugares. */
  capa: Capa;
}
type Cambio = Partial<FiltrosEvento> & { ver?: Ver; vista?: Vista; orden?: Orden; capa?: Capa };
/** Estado de la ubicación en palabras de quien mira: breve y sin tecnicismos. */
function EstadoUbicacion({ gps, yo, aqui, onUbicar }: { gps: EstadoGps; yo: Fix | null; aqui?: string | null; onUbicar: () => void }) {
  const boton = (texto: string) => (
    <button type="button" className="radar-gps-boton" onClick={onUbicar}>
      {texto}
    </button>
  );
  const m = Math.round((yo?.accuracy || 0) / 10) * 10;
  const donde = aqui ? (gps === 'precisa' ? ` Estás en ${aqui}.` : ` Estás cerca de ${aqui}.`) : '';
  if (gps === 'sin_soporte') return null;
  if (gps === 'buscando') return <p className="radar-gps" role="status">Buscando carretes cerca de tu posición…</p>;
  if (gps === 'precisa') return <p className="radar-gps" role="status">Ordenado por cercanía.{donde}</p>;
  if (gps === 'aproximada')
    return <p className="radar-gps" role="status">Tu ubicación es aproximada (±{m} m).{donde} {boton('Precisar ubicación')}</p>;
  if (gps === 'muy_aproximada')
    return (
      <p className="radar-gps" role="status">
        Tu ubicación es muy aproximada (±{m} m): las distancias son orientativas. {boton('Precisar ubicación')}
      </p>
    );
  if (gps === 'negado') return <p className="radar-gps">Sin permiso de ubicación. Puedes activarlo en los ajustes del navegador. {boton('Volver a intentar')}</p>;
  if (gps === 'timeout') return <p className="radar-gps">Tu ubicación tardó demasiado. {boton('Probar otra vez')}</p>;
  if (gps === 'no_disponible') return <p className="radar-gps">No pudimos ubicarte ahora. {boton('Probar otra vez')}</p>;
  return <p className="radar-gps">Usa tu ubicación para mostrarte qué hay cerca. {boton('Usar mi ubicación')}</p>;
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
    orden: p.get('orden') === 'barato' ? 'barato' : 'recomendados',
    capa: leerCapa(p.get('capa')),
  };
}
/** Cambiar de comuna suelta la zona, salvo que el cambio traiga una. */
const conZona = (prev: FiltrosEvento, cambio: Partial<FiltrosEvento>): FiltrosEvento => ({
  ...prev,
  ...cambio,
  ...(cambio.ciudad !== undefined && cambio.ciudad !== prev.ciudad && cambio.zona === undefined ? { zona: null } : {}),
});
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
  const zona = zonaValida(f.zona, f.ciudad);
  if (zona) p.set('zona', zona);
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
  const [ahora, setAhora] = useState(() => Date.parse(snapshot.generatedAt));
  // "Hoy" se calcula en el teléfono con el reloj que avanza: un snapshot viejo nunca
  // revive eventos pasados, y la noche del sábado sigue siendo "hoy" hasta las 05:00.
  const today = useMemo(() => fechaDeLaNoche(new Date(ahora)), [ahora]);

  useEffect(() => {
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
          filtros: conZona(prev.filtros, filtros),
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
        filtros: conZona(estado.filtros, cambio),
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

  // Radar: la ubicación se pide solo con un gesto (tocar Radar, "Usar mi ubicación")
  // o si el navegador ya la tiene permitida. Dos fases y se apaga sola; queda en este teléfono.
  const [yo, setYo] = useState<Fix | null>(null);
  const [gps, setGps] = useState<EstadoGps>('idle');
  const cortarGps = useRef<(() => void) | null>(null);
  // Una sola solicitud por gesto: la entrada por enlace no repite lo que ya pidió un toque.
  const solicitado = useRef(false);
  const enRadar = useRef(false);
  const ubicar = useCallback((origen: 'gesto' | 'enlace') => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return setGps('sin_soporte');
    if (origen === 'enlace' && solicitado.current) return;
    if (origen === 'gesto') solicitado.current = true;
    try {
      localStorage.removeItem(CLAVE_GPS_NEGADO_VIEJA);
    } catch {
      /* sin almacenamiento */
    }
    const empezar = () => {
      cortarGps.current?.();
      cortarGps.current = ubicarEnDosFases(
        navigator.geolocation,
        (estado, fix) => {
          setGps(estado);
          if (fix) setYo(fix);
        },
        undefined,
        () => enRadar.current,
      );
    };
    // El permiso real del navegador manda; no hay "prohibición eterna" propia.
    if (!navigator.permissions?.query) return origen === 'gesto' ? empezar() : undefined;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((r) => {
        if (r.state === 'granted') return empezar();
        if (r.state === 'denied') return setGps('negado');
        // `prompt`: solo con un gesto explícito; por enlace se ofrece el botón.
        if (origen === 'gesto') empezar();
      })
      .catch(() => origen === 'gesto' && empezar());
  }, []);
  useEffect(() => () => cortarGps.current?.(), []);
  useEffect(() => {
    // Tocar Radar en la barra es el gesto que autoriza preguntar.
    const abrir = () => ubicar('gesto');
    window.addEventListener('radar:abrir', abrir);
    // Desde otra página (o /radar), la barra llega con ?ubicar=1; se consume y se borra.
    const p = new URLSearchParams(location.search);
    if (p.get('ubicar') === '1') {
      p.delete('ubicar');
      const q = p.toString();
      history.replaceState(null, '', q ? `${location.pathname}?${q}` : location.pathname);
      ubicar('gesto');
    }
    return () => window.removeEventListener('radar:abrir', abrir);
  }, [ubicar]);
  const { filtros, ver, vista, orden, capa } = estado;
  useEffect(() => {
    // Un mapa abierto por enlace: ubica solo si ya estaba permitido; si no, ofrece el botón.
    enRadar.current = vista === 'mapa';
    if (vista === 'mapa' && gps === 'idle') ubicar('enlace');
  }, [vista, gps, ubicar]);
  /**
   * Abrir el Radar con un gesto: la barra (Radar), el botón Mapa y "Ver mapa y
   * carretes cerca de mí" llegan al mismo estado (comuna y zona se conservan,
   * el resto vuelve al inicio del Radar) y piden la ubicación una sola vez.
   */
  const estadoRadar = useCallback(
    (prev: Estado): Estado => {
      const base = leer('', defecto);
      return { ...base, filtros: { ...base.filtros, ciudad: prev.filtros.ciudad, zona: prev.filtros.zona }, vista: 'mapa', capa: 'hoy' };
    },
    [defecto],
  );
  const abrirRadar = (e?: MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
    e?.preventDefault();
    const next = estadoRadar(estado);
    const url = aUrl(next, path, defecto);
    if (url !== location.pathname + location.search) history.pushState(null, '', url);
    setEstado(next);
    ubicar('gesto');
    requestAnimationFrame(() => document.getElementById('cartelera')?.scrollIntoView({ block: 'start' }));
  };
  const urlRadar = aUrl(estadoRadar(estado), path, defecto);
  const todos = snap.events;
  // El lugar de cada evento: nombre, alias y misma ciudad; nunca un parecido.
  const lugarDe = useMemo(() => {
    const indice = indiceDeLugares(snap.venues);
    return (e: { lugar?: string | null; ciudad: string }) => indice(e.lugar, e.ciudad);
  }, [snap.venues]);
  // Reloj de Chile para "Ya empezó": se actualiza cada minuto en el teléfono, sin pedir nada.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const ahoraCL = useMemo(() => ahoraEnChile(new Date(ahora)), [ahora]);
  const madrugada = esMadrugada(ahoraCL);
  // Polígonos verificados: se cargan solo para el mapa o con ubicación, una vez.
  const [geos, setGeos] = useState<TerritorioGeo[] | null>(null);
  useEffect(() => {
    if (geos || (vista !== 'mapa' && !yo)) return;
    let vivo = true;
    fetch(RUTA_GEOMETRIAS)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: { features?: TerritorioGeo[] } | null) => vivo && g?.features && setGeos(g.features))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [geos, vista, yo]);
  // Con más de 500 m de error no se afirma zona ni se resalta en el mapa.
  const territorioActual = useMemo(() => (yo && geos && yo.accuracy <= PRECISION_ZONA_M ? territorioDe(yo, geos) : null), [yo, geos]);
  // Un solo contexto para listas y contadores (lib/resultados).
  const ctx = useMemo<Contexto>(
    () => ({ todos, lugares: snap.venues, today, ahora: ahoraCL, lugarDe, sectorDe: sectorDeLugar }),
    [todos, snap.venues, today, ahoraCL, lugarDe],
  );
  const modo: Modo = { vista, ver, capa };
  /** El número de un filtro: cuántos resultados aparecerán si se toca ahora. */
  const n = (cambio: Partial<FiltrosEvento>) => cuantos(ctx, conZona(filtros, cambio), modo);
  // Escenas: solo las que darían resultados al tocarlas (la activa siempre se ve).
  const escenasVisibles = ESCENAS.map((x) => ({ ...x, n: n({ escena: x.slug }) })).filter((x) => x.n > 0 || filtros.escena === x.slug);
  const baratos = vista === 'lista' ? n({ precio: '5000' }) : 0;
  const events = useMemo(() => {
    const lista = diversifyByVenue(eventosLista(ctx, filtros));
    // Lo que todavía no empieza va primero; lo iniciado sigue en la lista, después.
    return orden === 'barato' ? ordenarPorPrecio(lista) : porEstadoTemporal(nocheAntes(lista), ahoraCL);
  }, [ctx, filtros, orden, ahoraCL]);
  const derivados = useMemo(() => {
    const conteoLugar = new Map<string, number>();
    const hoyPorLugar = new Map<string, string>();
    for (const e of todos) {
      const slug = lugarDe(e);
      if (!slug || e.fecha < today) continue;
      conteoLugar.set(slug, (conteoLugar.get(slug) || 0) + 1);
      if (e.fecha === today && !hoyPorLugar.has(slug)) hoyPorLugar.set(slug, e.nombre);
    }
    const lugaresZona = (filtros.ciudad === 'todos' ? snap.venues : snap.venues.filter((l) => l.ciudad === filtros.ciudad))
      .filter((l) => !filtros.zona || sectorDeLugar(l.slug) === filtros.zona)
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

      busquedaEventos: filtros.busqueda ? filterEvents(todos, { fecha: 'futuro', busqueda: filtros.busqueda }, today).length : 0,
      lugaresHallados: filtros.busqueda ? buscarLugares(snap.venues, filtros.busqueda) : [],
      zonasHalladas: filtros.busqueda ? buscarZonas(snap.venues, filtros.busqueda) : [],
      sugerencias: sugerenciasPara(todos, filtros, today),
      // Chips de zona: solo sectores verificados con al menos un lugar ubicado en ellos.
      zonas:
        filtros.ciudad && filtros.ciudad !== 'todos'
          ? zonasDeComuna(filtros.ciudad)
              .map((t) => ({
                t,
                lugares: snap.venues.filter((l) => sectorDeLugar(l.slug) === t.slug).length,
                eventos: todos.filter((e) => e.fecha >= today && e.ciudad === filtros.ciudad && sectorDeLugar(lugarDe(e)) === t.slug).length,
              }))
              .filter((z) => z.lugares > 0)
              .sort((a, b) => b.eventos - a.eventos || a.t.nombre.localeCompare(b.t.nombre, 'es'))
          : [],
    };
  }, [todos, snap.venues, filtros, today, lugarDe]);
  const lugaresVisibles = useMemo(() => {
    const orden = new Map(derivados.lugaresZona.map((l, i) => [l.slug, i]));
    return lugaresLista(ctx, filtros).sort((x, y) => (orden.get(x.slug) ?? 0) - (orden.get(y.slug) ?? 0));
  }, [ctx, filtros, derivados.lugaresZona]);
  const sinResultados = Boolean(filtros.busqueda) && derivados.busquedaEventos === 0 && derivados.lugaresHallados.length === 0 && derivados.zonasHalladas.length === 0;
  useEffect(() => {
    if (sinResultados) rememberEmptySearch(filtros.busqueda || null);
    else if (filtros.busqueda) rememberEmptySearch(null);
  }, [sinResultados, filtros.busqueda]);
  // Radar no usa las pestañas de fecha: siempre marca lo de hoy. "Carretes hoy"
  // muestra solo lugares con evento confirmado hoy; "Lugares", todos.
  const eventosHoy = useMemo(
    // Un evento con final publicado y ya pasado no es una recomendación activa.
    () =>
      vista === 'mapa'
        ? eventosRadar(ctx, filtros)
        : [],
    [vista, ctx, filtros],
  );
  const lugaresMapa = useMemo(() => (vista === 'mapa' ? lugaresRadar(ctx, filtros, capa) : []), [vista, ctx, filtros, capa]);
  const puntos = useMemo(
    () => (vista === 'mapa' ? puntosDeMapa(lugaresMapa, eventosHoy, today, {}, lugarDe) : []),
    [vista, lugaresMapa, eventosHoy, today, lugarDe],
  );
  // Cercanía: primero lo que todavía no empieza, después lo ya iniciado y al final
  // los lugares sin evento hoy; dentro de cada grupo, por distancia.
  // "Cerca de mí": sin comuna elegida, un radio que se puede ampliar. Con comuna
  // elegida manda la comuna (los puntos ya vienen solo de ella).
  const [radio, setRadio] = useState<number | null>(RADIOS_KM[0]);
  const cercaDeMi = Boolean(yo) && (!filtros.ciudad || filtros.ciudad === 'todos');
  const cercanos = useMemo(() => {
    if (!yo || !puntos.length) return [];
    const orden = (p: (typeof puntos)[number]) =>
      p.estaNoche.length ? Math.min(...p.estaNoche.map((e) => ORDEN_TEMPORAL[estadoTemporal({ fecha: today, hora: e.hora }, ahoraCL)])) : 9;
    return porCercania(puntos, yo)
      .map((x) => ({ ...x, orden: orden(x.punto) }))
      .filter((x) => !cercaDeMi || radio === null || x.km <= radio)
      .sort((a, b) => a.orden - b.orden || a.km - b.km)
      .slice(0, 6);
  }, [yo, puntos, today, ahoraCL, cercaDeMi, radio]);
  const vigentes = todos.filter((e) => e.fecha >= today).length;
  const viejo = ahora - Date.parse(snap.generatedAt) > VIEJO_MS;
  const dateLabel = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Santiago',
  }).format(new Date(`${today}T15:00:00Z`));

  // Filtros secundarios (escena, presupuesto, orden, qué mostrar). Lista/Mapa y la ubicación van fuera.
  const filtrosUI = (
        <details className="discovery-options"><summary>Filtros{(filtros.escena !== 'todos' || (filtros.precio && filtros.precio !== 'todos') || orden !== 'recomendados' || ver === 'eventos') ? ' · activos' : ''}</summary>
        {escenasVisibles.length > 0 && (
          <div className="escenas" aria-label="Escenas">
            {escenasVisibles.map((x) => {
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
        </div>
        </details>
  );

  return (
    <>
      <section className={`hero container ${home ? 'hero-home' : 'hero-small'}`}>
        <PosterDecor variant={home ? 'home' : 'small'} />
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> REGIÓN DE VALPARAÍSO <span className="hero-date">/ {dateLabel}</span>
          </p>
          <TituloSeccion
            home={home}
            vista={vista}
            ver={ver}
            logo={
              // Todo el wordmark (DÓNDE SALGO y el "?") lleva al inicio limpio, igual que el logo del header.
              <BrandLink className="hero-logo-link">
                <LogoApilado className="hero-logo hero-logo-apilado" decorativo />
              </BrandLink>
            }
          />
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
                {n({ ciudad: c }) > 0 && <span>{n({ ciudad: c })}</span>}
              </a>
            ))}
          </div>
        </div>
        {derivados.zonas.length > 0 && (
          <div className="lugar-selector zona-selector" role="group" aria-label={`Zonas de ${filtros.ciudad}`}>
            <a {...enlace({ zona: null })} className={!filtros.zona ? 'activa' : ''} aria-current={!filtros.zona ? 'true' : undefined}>
              Todo {SHORT[filtros.ciudad || ''] || filtros.ciudad}
            </a>
            {derivados.zonas.map(({ t }) => (
              <a key={t.slug} {...enlace({ zona: t.slug })} className={filtros.zona === t.slug ? 'activa' : ''} aria-current={filtros.zona === t.slug ? 'true' : undefined}>
                {t.nombre}
                {n({ zona: t.slug }) > 0 && <span>{n({ zona: t.slug })}</span>}
              </a>
            ))}
          </div>
        )}
      </section>
      <section className={`container discovery ${home ? 'discovery-home' : ''}`} id="cartelera" aria-label="Cartelera">
        {vista === 'mapa' ? (
          <div className="radar-cabecera">
            <p className="eyebrow">RADAR</p>
            {home && <h2 className="radar-titulo">Carretes cerca de ti.</h2>}
            <div className="segmented radar-capas" role="group" aria-label="Qué mostrar en el radar">
              <a {...enlace({ capa: 'hoy' })} className={capa === 'hoy' ? 'activa' : ''} aria-current={capa === 'hoy' ? 'true' : undefined}>
                <span className="radar-estrella" aria-hidden="true">✦</span> Carretes hoy
              </a>
              <a {...enlace({ capa: 'lugares' })} className={capa === 'lugares' ? 'activa' : ''} aria-current={capa === 'lugares' ? 'true' : undefined}>
                Lugares
              </a>
            </div>
            <EstadoUbicacion gps={gps} yo={yo} aqui={territorioActual?.nombre} onUbicar={() => ubicar('gesto')} />
          </div>
        ) : ver === 'lugares' ? null : (
        <div className="date-tabs" aria-label="Cuándo">
          {(
            [
              ['hoy', madrugada ? 'Esta noche' : 'Hoy', n({ fecha: 'hoy' })],
              ['manana', madrugada ? nombreDia(addDays(today, 1)) : 'Mañana', n({ fecha: 'manana' })],
              ['finde', 'Este finde', n({ fecha: 'finde' })],
              ['futuro', 'Más adelante', n({ fecha: 'futuro' })],
            ] as const
          ).map(([v, label, n]) => (
            <a key={v} {...enlace({ fecha: v })} className={filtros.fecha === v ? 'selected' : ''} aria-current={filtros.fecha === v ? 'true' : undefined}>
              {label}
              {n > 0 && <span>{n}</span>}
            </a>
          ))}
        </div>
        )}
        <div className="vista-barra">
          <div className="segmented segmented-vista" role="group" aria-label="Cómo mostrarlo">
            <a {...enlace({ vista: 'lista' })} className={vista === 'lista' ? 'activa' : ''} aria-current={vista === 'lista' ? 'true' : undefined}>
              <span aria-hidden="true">☰</span> Lista
            </a>
            <a href={urlRadar} onClick={abrirRadar} className={vista === 'mapa' ? 'activa' : ''} aria-current={vista === 'mapa' ? 'true' : undefined}>
              <span aria-hidden="true">⌖</span> Mapa
            </a>
          </div>
          {vista === 'lista' && (
            <a className="radar-cta" href={urlRadar} onClick={abrirRadar}>
              <span aria-hidden="true">📍</span> Ver mapa y carretes cerca de mí
            </a>
          )}
        </div>
        {vista === 'lista' && filtrosUI}

        {vista === 'lista' && ver !== 'lugares' && baratos > 0 && (filtros.precio || 'todos') === 'todos' && (
          <a className="barato-atajo" {...enlace({ precio: '5000' })}>
            Barato {filtros.fecha === 'hoy' ? 'hoy' : 'en estas fechas'}: {baratos} gratis o hasta $5.000
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
              <VenueMap
                puntos={puntos}
                yo={yo}
                territorios={geos}
                aqui={territorioActual?.slug || null}
                zona={filtros.zona || null}
                conteoZona={(slug) => ({
                  eventos: eventosHoy.filter((e) => sectorDeLugar(lugarDe(e)) === slug).length,
                  lugares: snap.venues.filter((l) => sectorDeLugar(l.slug) === slug).length,
                })}
                fixValido={fixUtil(yo)}
                onPrecisar={() => ubicar('gesto')}
                urlZona={(t) => aUrl({ ...estado, filtros: { ...estado.filtros, ciudad: t.comuna, zona: t.slug } }, path, defecto)}
              />
            ) : capa === 'hoy' ? (
              <div className="empty-state">
                <h3>{eventosHoy.length ? 'Los carretes de hoy todavía no tienen ubicación verificada.' : 'No tenemos carretes confirmados para hoy acá.'}</h3>
                <div className="actions">
                  <a className="button button-primary" {...enlace({ capa: 'lugares' })}>
                    Ver todos los lugares
                  </a>
                </div>
              </div>
            ) : (
              <p className="empty-state">Ninguno de estos lugares tiene todavía una ubicación verificada.</p>
            )}
            {cercanos.length > 0 && (
              <div className="radar-cerca">
                <h3>
                  {cercaDeMi ? `Cerca de mí${radio ? ` · ${radio} km` : ' · toda la región'}` : `Más cerca de ti en ${filtros.ciudad}`}
                  {gps === 'muy_aproximada' ? ' (aprox.)' : ''}
                  <span className="heading-period">.</span>
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
                {cercaDeMi && radio !== null && (
                  <p className="radar-radio">
                    {RADIOS_KM.find((r) => r > radio) && (
                      <button type="button" className="radar-gps-boton" onClick={() => setRadio(RADIOS_KM.find((r) => r > radio) ?? null)}>
                        Ampliar radio
                      </button>
                    )}{' '}
                    <button type="button" className="radar-gps-boton" onClick={() => setRadio(null)}>
                      Toda la región
                    </button>
                  </p>
                )}
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
        {vista === 'mapa' && filtrosUI}
        {vista === 'lista' && ver !== 'lugares' && (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{filtros.ciudad === 'todos' ? 'VALPO Y ALREDEDORES' : filtros.ciudad}</p>
                <h2>
                  {filtros.fecha === 'hoy'
                    ? madrugada
                      ? 'Carretes esta noche'
                      : 'Carretes hoy'
                    : filtros.fecha === 'finde'
                      ? 'Este finde'
                      : filtros.fecha === 'manana'
                        ? madrugada
                          ? nombreDia(addDays(today, 1))
                          : 'Mañana'
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
                  <EventCard key={e.id} evento={e} today={today} priority={i === 0} estado={estadoTemporal(e, ahoraCL)} madrugada={madrugada} />
                ))}
              </div>
            )}
            {events.length === 0 && derivados.sugerencias.length > 0 && (
              <div className="alternative-plans">
                <h3>
                  {filtros.zona
                    ? `También en ${filtros.ciudad}, fuera de ${territorioPorSlug(filtros.zona)?.nombre || 'esta zona'}`
                    : filtros.ciudad && filtros.ciudad !== 'todos'
                      ? `Otras noches en ${filtros.ciudad}`
                      : 'Otras noches en la región'}
                </h3>
                <div className="event-grid">
                  {derivados.sugerencias.map((e) => (
                    <EventCard key={e.id} evento={e} today={today} estado={estadoTemporal(e, ahoraCL)} madrugada={madrugada} />
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
                <VenueCard key={l.slug} lugar={l} proximos={derivados.conteoLugar.get(l.slug) || 0} hoy={derivados.hoyPorLugar.get(l.slug) || null} />
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
                  <VenueCard key={l.slug} lugar={l} proximos={derivados.conteoLugar.get(l.slug) || 0} hoy={derivados.hoyPorLugar.get(l.slug) || null} />
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
