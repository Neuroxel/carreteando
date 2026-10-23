import type { Evento } from './types';

const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;
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
  if (e.precio === 0) return /\$\s?\d/.test(t) ? { texto: 'Gratis con condiciones', tipo: 'gratis' } : { texto: 'Gratis', tipo: 'gratis' };
  return { texto: `${/^\s*desde\b/i.test(t) ? 'Desde ' : ''}${pesos(e.precio)}`, tipo: 'precio' };
}
