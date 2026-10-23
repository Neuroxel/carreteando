/**
 * Clasificación canónica de comedia (stand-up, show de humor). Solo señales
 * controladas, en este orden:
 * 1. la ticketera es de comedia (ComedyPass, ComediaTicket);
 * 2. el lugar es de comedia (nombre o única etiqueta revisada: comedia/humor);
 * 3. el título/descripción trae una frase inequívoca ("stand up", "comedia en
 *    vivo", "comedy", "show de humor"...).
 * "Comedia" suelta NO basta: una obra de teatro puede ser "comedia dramática".
 */
import type { Evento } from './types';
import type { Lugar } from './venues';

const plano = (v: string) => ` ${v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ')} `;
export const HOSTS_COMEDIA = ['comedypass.online', 'comediaticket.cl'];
const FRASES = [' stand up ', ' standup ', ' comedy ', ' comedia en vivo ', ' show de comedia ', ' show de humor ', ' noche de comedia ', ' open mic de comedia '];
export const TAGS_LUGAR_COMEDIA = ['comedia', 'humor'];

const hostDe = (u: string | null | undefined) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
};
const GENERICAS = ['bar', 'pub', 'cerveza'];
/** El lugar hace comedia (etiqueta revisada), aunque también tenga otras cosas. Sirve para listar lugares. */
export const lugarConComedia = (l: Pick<Lugar, 'tags'> | null | undefined) => Boolean(l?.tags.some((t) => TAGS_LUGAR_COMEDIA.includes(t.toLowerCase())));
/**
 * El lugar es DE comedia: se llama así ("Barbones Comedy") o su única actividad
 * etiquetada es comedia/humor. Solo entonces cualquier evento ahí cuenta como
 * comedia; un bar con comedia, karaoke y bandas no convierte todo en comedia.
 */
export const lugarDeComedia = (l: Pick<Lugar, 'tags' | 'nombre'> | null | undefined) =>
  Boolean(
    l &&
      (/\b(comedy|comedia)\b/i.test(l.nombre) ||
        (lugarConComedia(l) && l.tags.every((t) => TAGS_LUGAR_COMEDIA.includes(t.toLowerCase()) || GENERICAS.includes(t.toLowerCase())))),
  );

export function esComedia(e: Pick<Evento, 'nombre' | 'descripcion' | 'lugar' | 'fuente_url'>, lugar?: Pick<Lugar, 'tags' | 'nombre'> | null) {
  const host = hostDe(e.fuente_url);
  if (host && HOSTS_COMEDIA.some((h) => host === h || host.endsWith(`.${h}`))) return true;
  if (lugarDeComedia(lugar)) return true;
  const t = plano(`${e.nombre} ${e.descripcion || ''} ${e.lugar || ''}`);
  return FRASES.some((f) => t.includes(f));
}
