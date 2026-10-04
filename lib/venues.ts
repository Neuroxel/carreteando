import { coincideTexto } from './busqueda';
import { safeImageUrl, safeWebUrl } from './safety';
// A venue is a stable place to go out. It exists whether or not something is
// scheduled tonight, so it never carries a date.
export const TIPOS_LUGAR = [
  { value: 'bar', label: 'Bar' },
  { value: 'pub', label: 'Pub' },
  { value: 'club', label: 'Club' },
  { value: 'discoteca', label: 'Discoteca' },
  { value: 'sala-en-vivo', label: 'Sala en vivo' },
  { value: 'club-electronico', label: 'Club electrónico' },
  { value: 'under', label: 'Under' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'centro-cultural', label: 'Centro cultural' },
  { value: 'teatro', label: 'Teatro' },
  { value: 'universitario', label: 'Universitario' },
  { value: 'queer', label: 'Queer' },
  { value: 'terraza', label: 'Terraza' },
] as const;
export type TipoLugar = (typeof TIPOS_LUGAR)[number]['value'];
export const FUENTES_LUGAR: Record<string, string> = {
  'calendario-publico': 'Calendario público del lugar',
  'fuente-publica': 'Fuente pública revisada',
  ticketera: 'Ticketera',
  'instagram-oficial': 'Cuenta oficial del lugar',
  'sitio-oficial': 'Sitio oficial del lugar',
  'aporte-propietario': 'Registro editorial de Dónde Salgo?',
  comunidad: 'Enviado por la comunidad',
};
export interface Lugar {
  slug: string;
  nombre: string;
  ciudad: string;
  zona: string | null;
  direccion: string | null;
  tipo: TipoLugar;
  tipo_label: string;
  tags: string[];
  descripcion: string | null;
  sitio_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  contacto_url: string | null;
  agenda_url: string | null;
  estado: string;
  imagen_url: string | null;
  fuente_tipo: string;
  fuente_url: string | null;
  ultima_revision: string | null;
  /** Null unless a licensed geocoder resolved the address precisely enough. */
  lat: number | null;
  lng: number | null;
  precision_mapa: 'exacta' | 'calle' | null;
  /** Otros nombres con que aparece en carteleras y ticketeras. */
  alias: string[];
  /** Horario tal como lo publicó una fuente, con su fecha. Nunca se infiere "abierto ahora". */
  horario: { texto: string; fuente: string; verificado: string } | null;
  /** Nivel de precio ($–$$$$) solo con fuente y fecha; si no hay, no hay insignia. */
  precio: { nivel: 1 | 2 | 3 | 4; fuente: string; verificado: string } | null;
}
export const NIVEL_PRECIO = ['', '$', '$$', '$$$', '$$$$'] as const;
/** Fecha de verificación en formato local, sin hora: '2026-10-03' → '03-10-2026'. */
export function fechaCorta(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('-');
}
export type VenueRow = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
export function dbRowToLugar(row: VenueRow): Lugar | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  if (row.is_active !== true || row.moderation_status !== 'approved') return null;
  if (row.status === 'closed') return null;
  const slug = str(row.slug);
  const nombre = str(row.name);
  const ciudad = str(row.city);
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug) || !nombre || !ciudad) return null;
  const tipo = TIPOS_LUGAR.find((t) => t.value === row.venue_type) || TIPOS_LUGAR[0];
  return {
    slug,
    nombre,
    ciudad,
    zona: str(row.zone),
    direccion: str(row.address),
    tipo: tipo.value,
    tipo_label: tipo.label,
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : [],
    descripcion: str(row.description_short),
    sitio_url: safeWebUrl(row.official_url),
    instagram_url: safeWebUrl(row.instagram_url),
    facebook_url: safeWebUrl(row.facebook_url),
    tiktok_url: safeWebUrl(row.tiktok_url),
    contacto_url: safeWebUrl(row.contact_url),
    agenda_url: safeWebUrl(row.calendar_url),
    estado: str(row.status) || 'active',
    imagen_url: safeImageUrl(row.image_url),
    fuente_tipo: str(row.source_type) || 'fuente-publica',
    fuente_url: safeWebUrl(row.source_url),
    ultima_revision: str(row.last_verified_at),
    ...coordenada(row),
    alias: Array.isArray(row.aliases) ? row.aliases.filter((t): t is string => typeof t === 'string').slice(0, 8) : [],
    horario:
      str(row.hours_text) && str(row.hours_source) && str(row.hours_verified_at)
        ? { texto: str(row.hours_text)!, fuente: str(row.hours_source)!, verificado: str(row.hours_verified_at)! }
        : null,
    precio:
      [1, 2, 3, 4].includes(row.price_tier as number) && str(row.price_source) && str(row.price_verified_at)
        ? { nivel: row.price_tier as 1 | 2 | 3 | 4, fuente: str(row.price_source)!, verificado: str(row.price_verified_at)! }
        : null,
  };
}
// A point we are not sure about is worse than no point: it sends somebody to the
// wrong corner at one in the morning.
function coordenada(row: VenueRow) {
  const lat = typeof row.latitude === 'number' ? row.latitude : null;
  const lng = typeof row.longitude === 'number' ? row.longitude : null;
  const precision =
    row.geocode_accuracy === 'exacta' || row.geocode_accuracy === 'calle'
      ? (row.geocode_accuracy as 'exacta' | 'calle')
      : null;
  const dentroDeLaRegion =
    lat !== null && lng !== null && lat >= -34 && lat <= -32 && lng >= -72 && lng <= -70.5;
  return dentroDeLaRegion && precision
    ? { lat, lng, precision_mapa: precision }
    : { lat: null, lng: null, precision_mapa: null };
}
export function zonasDe(lugares: Lugar[]) {
  const map = new Map<string, { zona: string; ciudad: string; lugares: Lugar[] }>();
  for (const l of lugares) {
    if (!l.zona) continue;
    const entry = map.get(l.zona) || { zona: l.zona, ciudad: l.ciudad, lugares: [] };
    entry.lugares.push(l);
    map.set(l.zona, entry);
  }
  return [...map.values()].sort((a, b) => b.lugares.length - a.lugares.length);
}
export function zonaSlug(zona: string) {
  return zona
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
// Search has to cover the whole graph: a person types "bar cerro alegre" and
// means a place and a zone, not an event title.
export function buscarLugares(lugares: Lugar[], q: string): Lugar[] {
  const t = normalizar(q);
  if (!t) return [];
  return lugares.filter((l) =>
    coincideTexto([l.nombre, l.ciudad, l.zona, l.direccion, l.tipo_label, ...l.tags, ...(l.alias || [])].filter(Boolean).join(' '), t),
  );
}
export function buscarZonas(lugares: Lugar[], q: string) {
  const t = normalizar(q);
  if (!t) return [];
  return zonasDe(lugares).filter((z) => normalizar(`${z.zona} ${z.ciudad}`).includes(t));
}
export function normalizar(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
