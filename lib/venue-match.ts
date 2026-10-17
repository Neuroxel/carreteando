import extra from '../data/venue-aliases.json';
import { normalizar } from './map';
import type { Lugar } from './venues';

/**
 * El lugar de un evento, sin parecidos: nombre exacto (normalizado), alias de
 * la base o alias explícito revisado (`data/venue-aliases.json`), y la MISMA
 * ciudad. Solo si el evento no trae ciudad se acepta un nombre único en todo
 * el catálogo. Dos "Manda" (Reñaca y Viña) no se confunden y un alias nunca
 * cruza de comuna.
 */
const EXTRA = (extra as { alias: Record<string, string[]> }).alias;
export function nombresDeLugar(l: Pick<Lugar, 'slug' | 'nombre' | 'alias'>) {
  return [...new Set([l.nombre, ...(l.alias || []), ...(EXTRA[l.slug] || [])].map(normalizar).filter(Boolean))];
}
export function indiceDeLugares(lugares: Pick<Lugar, 'slug' | 'nombre' | 'alias' | 'ciudad'>[]) {
  const porNombreCiudad = new Map<string, string>();
  const porNombre = new Map<string, Set<string>>();
  for (const l of lugares)
    for (const n of nombresDeLugar(l)) {
      porNombreCiudad.set(`${n}|${normalizar(l.ciudad)}`, l.slug);
      porNombre.set(n, new Set([...(porNombre.get(n) || []), l.slug]));
    }
  return (lugar: string | null | undefined, ciudad: string | null | undefined): string | null => {
    if (!lugar) return null;
    const n = normalizar(lugar);
    if (ciudad) return porNombreCiudad.get(`${n}|${normalizar(ciudad)}`) ?? null;
    const unicos = porNombre.get(n);
    return unicos && unicos.size === 1 ? [...unicos][0] : null;
  };
}
