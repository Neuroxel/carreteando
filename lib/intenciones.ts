/**
 * Intenciones: "¿qué quieres hacer?". Cada una es una regla explícita sobre
 * datos que ya tenemos (tipo y categoría del evento, escenas, tipo y etiquetas
 * revisadas del lugar), nunca una búsqueda de texto libre. Casi todos los
 * eventos vienen con categoría "otro", así que el lugar donde ocurren pesa.
 *
 * Una regla de evento devuelve:
 *  - 'exacto': el propio evento lo dice (tipo, categoría, escena, ticketera);
 *  - 'lugar':  calza por el lugar donde ocurre (más débil, rankea después);
 *  - false.
 */
import { enEscena } from './escenas';
import { esComedia, lugarConComedia, lugarDeComedia } from './comedia';
import type { Evento } from './types';
import type { Lugar } from './venues';

export type SlugIntencion = 'bailar' | 'tomar-algo' | 'musica-en-vivo' | 'karaoke' | 'comedia' | 'tranqui' | 'sorprendeme';
export type Calce = 'exacto' | 'lugar' | false;
type LugarMin = Pick<Lugar, 'tipo' | 'tags' | 'nombre'>;
export interface Intencion {
  slug: SlugIntencion;
  label: string;
  descripcion: string;
  icono: string;
  /** Palabras que, buscadas tal cual, apuntan sin duda a esta intención. */
  palabras: string[];
  evento: (e: Evento, l: LugarMin | null) => Calce;
  lugar: (l: LugarMin) => boolean;
}

const tieneTag = (l: LugarMin | null, tags: string[]) => Boolean(l?.tags.some((t) => tags.includes(t.toLowerCase())));
const esBaile = (e: Evento) =>
  ['electronica', 'cumbia', 'reggaeton', 'universitario'].includes(e.categoria) ||
  ['club', 'fiesta_universitaria', 'after', 'pre'].includes(e.tipo) ||
  ['electronica', 'tropical', 'urbano', 'universitario'].some((x) => enEscena(e, x));
// "festival" no basta (hay festivales de fotografía o cine): solo cuenta por un lugar de música en vivo.
const esVivo = (e: Evento) => ['concierto', 'live', 'tocata', 'pena'].includes(e.tipo);
const lugarBaile = (l: LugarMin) => ['club', 'discoteca', 'club-electronico'].includes(l.tipo) || tieneTag(l, ['discoteca', 'club', 'electronica', 'techno', 'reggaeton', 'cumbia']);
const lugarBar = (l: LugarMin) => ['bar', 'pub', 'terraza'].includes(l.tipo) || tieneTag(l, ['cerveza', 'cocteleria', 'vino', 'pub', 'terraza']);
const lugarVivo = (l: LugarMin) => !lugarDeComedia(l) && (l.tipo === 'sala-en-vivo' || tieneTag(l, ['en-vivo', 'jazz', 'rock', 'tocatas']));
const lugarKaraoke = (l: LugarMin) => l.tipo === 'karaoke' || tieneTag(l, ['karaoke']);
const lugarTranqui = (l: LugarMin) => ['terraza', 'teatro', 'centro-cultural'].includes(l.tipo) || tieneTag(l, ['vino', 'cocteleria', 'terraza']);

export const INTENCIONES: Intencion[] = [
  {
    slug: 'bailar',
    label: 'Bailar',
    descripcion: 'Fiestas, clubes y discotecas',
    icono: '🪩',
    palabras: ['bailar', 'baile', 'carrete', 'fiesta', 'perreo'],
    evento: (e, l) => (esComedia(e, l) || e.tipo === 'noche_cultural' ? false : esBaile(e) ? 'exacto' : l && lugarBaile(l) && !esVivo(e) ? 'lugar' : false),
    lugar: lugarBaile,
  },
  {
    slug: 'tomar-algo',
    label: 'Tomar algo',
    descripcion: 'Bares, pubs y terrazas',
    icono: '🍻',
    palabras: ['tomar algo', 'tomar', 'chela', 'chelas', 'cerveza', 'trago', 'tragos', 'bar', 'bares'],
    evento: (e, l) => (e.tipo === 'bar' ? 'exacto' : l && lugarBar(l) && !esComedia(e, l) && !esBaile(e) ? 'lugar' : false),
    lugar: lugarBar,
  },
  {
    slug: 'musica-en-vivo',
    label: 'Música en vivo',
    descripcion: 'Conciertos, tocatas y bandas',
    icono: '🎸',
    palabras: ['musica en vivo', 'en vivo', 'concierto', 'conciertos', 'tocata', 'tocatas', 'banda', 'bandas'],
    evento: (e, l) =>
      esComedia(e, l)
        ? false
        : esVivo(e)
          ? 'exacto'
          : l && lugarVivo(l) && e.tipo !== 'noche_cultural' && !esBaile(e) && (e.tipo !== 'festival' || l.tipo === 'sala-en-vivo')
            ? 'lugar'
            : false,
    lugar: lugarVivo,
  },
  {
    slug: 'karaoke',
    label: 'Karaoke',
    descripcion: 'Noches y bares de karaoke',
    icono: '🎤',
    palabras: ['karaoke'],
    // Solo lo que dice karaoke: un concierto en un bar con karaoke no es karaoke.
    evento: (e) => (enEscena(e, 'karaoke') ? 'exacto' : false),
    lugar: lugarKaraoke,
  },
  {
    slug: 'comedia',
    label: 'Comedia',
    descripcion: 'Stand-up y shows de humor',
    icono: '😂',
    palabras: ['comedia', 'stand up', 'standup', 'humor', 'humorista', 'comediante'],
    evento: (e, l) => (esComedia(e, l) ? 'exacto' : false),
    lugar: lugarConComedia,
  },
  {
    slug: 'tranqui',
    label: 'Algo tranqui',
    // Criterio editorial, no un hecho: cultura, teatro y terrazas, sin fiesta.
    descripcion: 'Teatro, cultura y terrazas',
    icono: '🌙',
    palabras: ['tranqui', 'tranquilo', 'relajado'],
    evento: (e, l) => (esBaile(e) ? false : e.tipo === 'noche_cultural' || enEscena(e, 'escena-cultural') ? 'exacto' : l && lugarTranqui(l) ? 'lugar' : false),
    lugar: lugarTranqui,
  },
  {
    slug: 'sorprendeme',
    label: 'Sorpréndeme',
    descripcion: 'Una mezcla variada de lo que hay',
    icono: '✨',
    palabras: ['sorprendeme'],
    evento: () => 'exacto',
    lugar: () => false,
  },
];

export const intencionPorSlug = (slug: string | null | undefined) => (slug ? INTENCIONES.find((i) => i.slug === slug) || null : null);
const plano = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** Una búsqueda que es exactamente una palabra de una intención (no una parte de un título). */
export function intencionDeBusqueda(q: string | null | undefined): Intencion | null {
  const t = plano(q || '');
  if (!t) return null;
  return INTENCIONES.find((i) => i.palabras.includes(t)) || null;
}

/** Eventos de una intención, con cómo calzan. */
export function eventosDeIntencion(i: Intencion, eventos: Evento[], lugarDe: (e: Evento) => LugarMin | null) {
  return eventos
    .map((e) => ({ e, calce: i.evento(e, lugarDe(e)) }))
    .filter((x): x is { e: Evento; calce: 'exacto' | 'lugar' } => Boolean(x.calce));
}
