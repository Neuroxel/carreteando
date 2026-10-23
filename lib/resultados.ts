/**
 * Qué resultados muestra cada vista con unos filtros dados. Es la única fuente:
 * las listas y TODOS los contadores (comuna, zona, fecha, escena, barato) salen
 * de aquí, así que el número de un filtro es exactamente lo que aparece al
 * tocarlo. Nunca se suman entidades distintas (eventos + lugares).
 */
import { filterEvents } from './events';
import { lugarEnEscena } from './escenas';
import { buscarLugares, type Lugar } from './venues';
import { estadoTemporal, type AhoraChile } from './temporal';
import type { Evento, FiltrosEvento } from './types';
import { intencionPorSlug } from './intenciones';

export type Modo = { vista: 'lista' | 'mapa'; ver: 'todo' | 'eventos' | 'lugares'; capa: 'hoy' | 'lugares' };
export interface Contexto {
  todos: Evento[];
  lugares: Lugar[];
  today: string;
  ahora: AhoraChile;
  lugarDe: (e: Pick<Evento, 'lugar' | 'ciudad'>) => string | null;
  sectorDe: (slug: string | null) => string | null;
}

const porSlug = new WeakMap<Lugar[], Map<string, Lugar>>();
/** El lugar (objeto) de un evento, para las reglas de intención. */
export function lugarObjeto(c: Contexto, e: Evento) {
  let m = porSlug.get(c.lugares);
  if (!m) porSlug.set(c.lugares, (m = new Map(c.lugares.map((l) => [l.slug, l]))));
  const slug = c.lugarDe(e);
  return slug ? m.get(slug) || null : null;
}
const enZona = (c: Contexto, f: FiltrosEvento, lista: Evento[]) => {
  const i = intencionPorSlug(f.plan);
  const z = f.zona ? lista.filter((e) => c.sectorDe(c.lugarDe(e)) === f.zona) : lista;
  return i ? z.filter((e) => i.evento(e, lugarObjeto(c, e))) : z;
};
const lugarEnPlan = (f: FiltrosEvento, l: Lugar) => {
  const i = intencionPorSlug(f.plan);
  return !i || i.slug === 'sorprendeme' || i.lugar(l);
};
const lugaresBase = (c: Contexto, f: FiltrosEvento) =>
  c.lugares.filter(
    (l) => (!f.ciudad || f.ciudad === 'todos' || l.ciudad === f.ciudad) && (!f.zona || c.sectorDe(l.slug) === f.zona),
  );
const escenaDe = (f: FiltrosEvento) => (f.escena && f.escena !== 'todos' ? f.escena : null);

/** Carretes (lista): eventos con todos los filtros, incluida la zona. */
export const eventosLista = (c: Contexto, f: FiltrosEvento) => enZona(c, f, filterEvents(c.todos, f, c.today));

/** Lugares (lista): lo que es de la escena o tiene un evento que calza con los filtros. */
export function lugaresLista(c: Contexto, f: FiltrosEvento) {
  const conEvento = new Set(eventosLista(c, f).map(c.lugarDe));
  const escena = escenaDe(f);
  const refinar = [f.precio, f.tipo, f.categoria].some((v) => v && v !== 'todos');
  const hallados = f.busqueda ? new Set(buscarLugares(c.lugares, f.busqueda).map((l) => l.slug)) : null;
  return lugaresBase(c, f).filter((l) => {
    const tiene = conEvento.has(l.slug);
    return (!hallados || hallados.has(l.slug)) && (!escena || lugarEnEscena(l, escena) || tiene) && (!refinar || tiene) && (lugarEnPlan(f, l) || tiene);
  });
}

/** Radar · Carretes hoy: eventos de hoy (noche hasta las 05:00) que no terminaron. */
export const eventosRadar = (c: Contexto, f: FiltrosEvento) =>
  enZona(c, f, filterEvents(c.todos, { ...f, fecha: 'hoy' }, c.today)).filter((e) => estadoTemporal(e, c.ahora) !== 'finalizado');

/** Radar: lugares a dibujar. "Carretes hoy": solo los que tienen evento hoy. */
export function lugaresRadar(c: Contexto, f: FiltrosEvento, capa: Modo['capa']) {
  const conEvento = new Set(eventosRadar(c, f).map(c.lugarDe));
  if (capa === 'hoy') return lugaresBase(c, f).filter((l) => conEvento.has(l.slug));
  const escena = escenaDe(f);
  const hallados = f.busqueda ? new Set(buscarLugares(c.lugares, f.busqueda).map((l) => l.slug)) : null;
  return lugaresBase(c, f).filter(
    (l) => (!hallados || hallados.has(l.slug)) && (!escena || lugarEnEscena(l, escena) || conEvento.has(l.slug)) && (lugarEnPlan(f, l) || conEvento.has(l.slug)),
  );
}

/** Cuántos resultados verá la persona en este modo con estos filtros. */
export function cuantos(c: Contexto, f: FiltrosEvento, m: Modo) {
  if (m.vista === 'mapa') return m.capa === 'hoy' ? eventosRadar(c, f).length : lugaresRadar(c, f, 'lugares').length;
  return m.ver === 'lugares' ? lugaresLista(c, f).length : eventosLista(c, f).length;
}
