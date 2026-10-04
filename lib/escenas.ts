import type { Evento } from './types';
import type { Lugar } from './venues';
const plano = (v: string) =>
  ` ${v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')} `;
/**
 * Una escena es una forma de descubrir, no otra sección del producto: un
 * filtro transversal a estilos y tipos. Solo se muestra si hoy tiene oferta.
 */
export const ESCENAS: { slug: string; label: string; test: (e: Evento, t: string) => boolean }[] = [
  { slug: 'en-vivo', label: 'En vivo', test: (e) => ['concierto', 'live', 'tocata', 'festival', 'pena'].includes(e.tipo) },
  { slug: 'electronica', label: 'Electrónica', test: (e, t) => e.categoria === 'electronica' || / (techno|house|rave|dj) /.test(t) },
  { slug: 'under', label: 'Under', test: (e, t) => e.categoria === 'under' || e.tipo === 'tocata' || / (punk|hardcore|post punk|darkwave|autogestion) /.test(t) },
  { slug: 'universitario', label: 'Universitario', test: (e) => e.categoria === 'universitario' || e.tipo === 'fiesta_universitaria' },
  { slug: 'rock', label: 'Rock', test: (e, t) => e.categoria === 'rock' || / (rock|metal) /.test(t) },
  { slug: 'tropical', label: 'Tropical', test: (e, t) => e.categoria === 'cumbia' || / (cumbia|salsa|bachata|tropical|sapukai|chamame) /.test(t) },
  { slug: 'urbano', label: 'Urbano', test: (e, t) => e.categoria === 'reggaeton' || / (reggaeton|perreo|trap) /.test(t) },
  { slug: 'queer', label: 'Queer', test: (_e, t) => / (drag|queer|lgbt|disidencia|pride) /.test(t) },
  { slug: 'karaoke', label: 'Karaoke', test: (_e, t) => / karaoke /.test(t) },
  { slug: 'escena-cultural', label: 'Teatro y cultura', test: (e) => e.tipo === 'noche_cultural' },
];
export function enEscena(e: Evento, slug: string) {
  const escena = ESCENAS.find((x) => x.slug === slug);
  if (!escena) return true;
  return escena.test(e, plano(`${e.nombre} ${e.descripcion || ''} ${e.lugar || ''}`));
}
/**
 * Un lugar pertenece a una escena por lo que es (su tipo y sus etiquetas
 * revisadas), no solo por lo que tiene anunciado esta semana: un bar de rock
 * sigue siéndolo aunque hoy no tenga tocata.
 */
const ESCENA_LUGAR: Record<string, { tipos: string[]; tags: string[] }> = {
  'en-vivo': { tipos: ['sala-en-vivo'], tags: ['en-vivo', 'tocatas', 'jazz', 'rock'] },
  electronica: { tipos: ['club-electronico'], tags: ['electronica', 'techno', 'house', 'soundsystem'] },
  under: { tipos: ['under'], tags: ['under', 'alternativo', 'autogestion'] },
  universitario: { tipos: ['universitario'], tags: ['universitario'] },
  rock: { tipos: [], tags: ['rock', 'metal', 'punk'] },
  tropical: { tipos: [], tags: ['cumbia', 'salsa', 'tropical'] },
  urbano: { tipos: [], tags: ['reggaeton', 'urbano', 'trap'] },
  queer: { tipos: ['queer'], tags: ['queer', 'drag', 'lgbt'] },
  karaoke: { tipos: ['karaoke'], tags: ['karaoke'] },
  'escena-cultural': { tipos: ['teatro', 'centro-cultural'], tags: ['cultural', 'teatro'] },
};
export function lugarEnEscena(l: Pick<Lugar, 'tipo' | 'tags'>, slug: string) {
  const m = ESCENA_LUGAR[slug];
  if (!m) return false;
  return m.tipos.includes(l.tipo) || l.tags.some((t) => m.tags.includes(t.toLowerCase()));
}
/** Escenas con oferta: eventos de este conjunto o lugares que son de esa escena. */
export function escenasConLugares(eventos: Evento[], lugares: Pick<Lugar, 'tipo' | 'tags'>[]) {
  return ESCENAS.map((x) => ({
    ...x,
    n: eventos.filter((e) => enEscena(e, x.slug)).length + lugares.filter((l) => lugarEnEscena(l, x.slug)).length,
  })).filter((x) => x.n > 0);
}
/** Escenas con al menos un evento en este conjunto, con su cantidad. */
export function escenasConOferta(eventos: Evento[]) {
  return ESCENAS.map((x) => ({ ...x, n: eventos.filter((e) => enEscena(e, x.slug)).length })).filter((x) => x.n > 0);
}
