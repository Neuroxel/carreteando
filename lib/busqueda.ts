import { normalizeText } from './event-extraction';
/**
 * Cómo habla la gente cuando busca dónde salir. Un mapa corto y explícito, no
 * un modelo: cada palabra de la búsqueda vale si aparece ella o uno de sus
 * equivalentes. Agregar uno es agregar una línea.
 */
export const SINONIMOS: Record<string, string[]> = {
  valpo: ['valparaiso'],
  vina: ['vina del mar'],
  electro: ['electronica', 'techno'],
  techno: ['electronica', 'tecno'],
  tecno: ['electronica', 'techno'],
  perreo: ['reggaeton', 'urbano'],
  reggaeton: ['perreo', 'urbano'],
  tocata: ['en vivo', 'banda', 'concierto'],
  tocatas: ['tocata', 'en vivo', 'banda', 'concierto'],
  carrete: ['fiesta'],
  fiesta: ['carrete', 'party'],
  chela: ['cerveza', 'cerveceria', 'schop', 'pub'],
  chelas: ['cerveza', 'cerveceria', 'schop', 'pub'],
  cerveza: ['cerveceria', 'schop', 'chela'],
  schop: ['cerveza', 'cerveceria'],
  disco: ['discoteca', 'club'],
  boliche: ['discoteca', 'club'],
  rooftop: ['terraza'],
  terraza: ['rooftop'],
  stand: ['stand up', 'comedia'],
  standup: ['stand up', 'comedia'],
  comedia: ['stand up'],
  drag: ['queer'],
  lgbt: ['queer', 'drag'],
  lgbtq: ['queer', 'drag'],
  queer: ['lgbt', 'drag'],
  vivo: ['en vivo', 'tocata', 'concierto'],
};
/** Todas las palabras tienen que aparecer, o alguno de sus equivalentes. */
export function coincideTexto(texto: string, busqueda: string) {
  const t = normalizeText(texto);
  return normalizeText(busqueda)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w) || (SINONIMOS[w] || []).some((s) => t.includes(s)));
}
