import type { Metadata } from 'next';
type Params = Record<string, string | string[] | undefined>;
/**
 * Cada combinación de filtros es una URL distinta con casi el mismo contenido.
 * Se siguen sus enlaces pero no se indexan: el canónico es la página limpia.
 */
export function filterRobots(params: Params): Pick<Metadata, 'robots'> {
  const filtrada = Object.values(params).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  return filtrada ? { robots: { index: false, follow: true } } : {};
}
