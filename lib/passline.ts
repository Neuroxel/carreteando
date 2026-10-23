/**
 * Passline: fuente primaria que bloquea agentes (Cloudflare). No se evade.
 * Flujo sostenible: descubrimiento público → URL primaria de Passline → revisión
 * humana rápida ("Passline hoy") → publicación trazable por el feed editorial.
 * Una fila verificada no hay que reinventarla cada semana: queda versionada con
 * quién y cuándo la vio.
 */
import cola from '../data/passline-cola.json';
import { CIUDADES } from './types';

export type EstadoPassline = 'por_revisar' | 'verificado' | 'descartado';
export interface FilaPassline {
  id: string;
  fecha: string;
  hora: string | null;
  evento: string;
  recinto: string;
  venue_id: string | null;
  ciudad: string;
  url: string;
  descubierto_por: string;
  estado: EstadoPassline;
  /** Solo en 'verificado': quién y cuándo vio la URL primaria. */
  verificado_por?: string;
  verificado_en?: string;
  precio_clp?: number | null;
  precio_texto?: string | null;
  categoria?: string;
}
export const PASSLINE_COLA = (cola as { eventos: FilaPassline[] }).eventos;

const HOSTS = ['www.passline.com', 'passline.com'];
export function filaValida(f: FilaPassline) {
  try {
    const u = new URL(f.url);
    return HOSTS.includes(u.hostname) && u.protocol === 'https:' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && CIUDADES.includes(f.ciudad) && Boolean(f.evento && f.recinto);
  } catch {
    return false;
  }
}
/** La cola operativa de una fecha: lo que falta revisar primero. */
export function passlineDelDia(filas: FilaPassline[], fecha: string) {
  const orden: Record<EstadoPassline, number> = { por_revisar: 0, verificado: 1, descartado: 2 };
  return filas
    .filter((f) => f.fecha === fecha && filaValida(f))
    .sort((a, b) => orden[a.estado] - orden[b.estado] || (a.hora || '99').localeCompare(b.hora || '99'))
    .map(({ fecha: f, evento, recinto, url, estado, hora }) => ({ fecha: f, hora, evento, recinto, url, estado }));
}
/**
 * Filas verificadas → filas del feed editorial (mismo filtro de siempre: host
 * permitido, revisión de menos de 7 días, ciudad y categoría válidas).
 */
export function editorialesDePassline(filas: FilaPassline[] = PASSLINE_COLA) {
  return filas
    .filter((f) => f.estado === 'verificado' && f.verificado_por && f.verificado_en && filaValida(f))
    .map((f) => ({
      id: `curated-${f.id}`,
      title: f.evento,
      date: f.fecha,
      time: f.hora,
      venue: f.recinto,
      // Sin lugar del catálogo, la identidad usa el nombre del recinto (no inventa un id).
      venue_id: f.venue_id ?? f.recinto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      city: f.ciudad,
      address: null,
      price_clp: f.precio_clp ?? null,
      price_text: f.precio_texto ?? null,
      category: f.categoria || 'otro',
      source_url: f.url,
      image_url: null,
      organizer: null,
      description: null,
      reviewed_at: f.verificado_en as string,
      review_decision: 'approved',
      review_basis: `Passline verificado a mano por ${f.verificado_por} (cola "Passline hoy"); descubierto por ${f.descubierto_por}.`,
      moment: null,
    })) as unknown as typeof import('../data/editorial-events.json');
}
