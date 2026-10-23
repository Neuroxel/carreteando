import type { Evento } from './types';

const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;
/** Un "gratis" con horario, cupo, inscripción, edad, género u otro precio no es gratis a secas. */
const CONDICION = /\$\s?[1-9]|hasta las|v[aá]lid|inscripci|cupos?\b|mayores de|condici|cortes[ií]a|mujeres|hombres|antes de|pase\b|lista\b/i;
/**
 * Precio corto para escanear la tarjeta junto a hora y lugar. Nunca inventa:
 * "Gratis" solo si es gratis sin condiciones; "Desde" solo cuando la fuente
 * lo publica así (los lectores ya descartan tramos agotados); agotado no se
 * muestra como precio comprable.
 */
export function precioCorto(e: Pick<Evento, 'precio' | 'precio_conocido' | 'precio_texto'>): { texto: string; tipo: 'gratis' | 'precio' | 'agotado' | 'desconocido' } {
  const t = e.precio_texto || '';
  if (/agotad|venta cerrada/i.test(t) && !e.precio_conocido) return { texto: 'Agotado', tipo: 'agotado' };
  if (!e.precio_conocido) return { texto: 'Precio por confirmar', tipo: 'desconocido' };
  if (e.precio === 0) return CONDICION.test(t) ? { texto: 'Gratis con condiciones', tipo: 'gratis' } : { texto: 'Gratis', tipo: 'gratis' };
  return { texto: `${/^\s*desde\b/i.test(t) ? 'Desde ' : ''}${pesos(e.precio)}`, tipo: 'precio' };
}
