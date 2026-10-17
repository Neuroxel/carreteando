import { postCode, type RawPost } from './ingestion';
import {
  extractEventDate,
  extractEventTime,
  extractPriceInfo,
  inferCity,
  isCampaignUpdate,
  normalizeText,
  firstMeaningfulLine,
} from './event-extraction';
/**
 * Piloto controlado de Instagram (10-10-2026). Cuentas oficiales y públicas de
 * lugares cuya programación vive en Instagram y que ninguna ticketera cubre.
 * Lo que trae el piloto es PISTA: se guarda aparte y nunca crea eventos.
 */
/** Piloto 1 (10-10-2026): una corrida, 15 cuentas, ventana de 3 días. Se conserva como registro. */
export const PILOT_1_ACCOUNTS = [
  'el.huevo',
  'mascara_valparaiso',
  'terrazabellavista.cl',
  'studiovalparaiso',
  'barlamorada',
  'gatoenlaventanavalparaiso',
  'barelcanario',
  'terrazamiaw',
  'barindustrialvalparaiso',
  'baronrooftop',
  'ovovinadelmar',
  'hollywoodchile.cl',
  'psiquis.bar',
  'chicagobar.cl',
  'trotaquilpue',
] as const;
/**
 * Piloto 2 (13-10-2026): dos cohortes comparables, cada una una corrida aparte
 * con su propio tope de 1 USD. Cuentas oficiales verificadas a mano (existen y
 * son del lugar), sin otra fuente estructurada de programación. Se elige por
 * valor: rendimiento del piloto 1, programación frecuente y perfil nocturno.
 */
export const PILOT_COHORTS = {
  A: [
    // Valparaíso: los que rindieron en el piloto 1…
    'mascara_valparaiso',
    'studiovalparaiso',
    'el.huevo',
    'terrazabellavista.cl',
    'terrazamiaw',
    // …y discotecas/bares con programación propia que nunca se leyeron
    'wooclub_',
    'club.delirio.valparaiso',
    'paganocl',
    'klanurockbar',
    'barproa',
    'ukbarvalpo',
    'malezavalparaiso',
    'hotzenplotz_bar',
    'lamorada.bar',
    'bargatoenlaventana',
  ],
  B: [
    // Viña del Mar y Reñaca
    'manda.chile',
    'mandavina.cl',
    'hollywoodchile.cl',
    'psiquis.bar',
    'ovovinadelmar',
    'bloom_barcl',
    'glasgowpub',
    'conclave1929',
    'jarbarvina',
    'bargonocl',
    'clubgordos',
    'schoperia4ymedio',
    'pasajecoyotl',
    'lachinganadelbarrio',
    'barracentralrenaca',
  ],
  // Benchmark de actores: las mismas 5 cuentas, la misma ventana y el mismo límite para cada actor.
  BENCH: ['mascara_valparaiso', 'studiovalparaiso', 'psiquis.bar', 'manda.chile', 'glasgowpub'],
} as const;
export type Cohorte = keyof typeof PILOT_COHORTS;
/** Tope de gasto por corrida (USD). Benchmark: 0,25 por actor (0,50 en total). Piloto: 0,50 por cohorte (1,00 en total). */
export const TOPE_USD: Record<Cohorte, number> = { BENCH: 0.25, A: 0.5, B: 0.5 };
export const PILOT_ACCOUNTS = [...new Set([...PILOT_1_ACCOUNTS, ...PILOT_COHORTS.A, ...PILOT_COHORTS.B, ...PILOT_COHORTS.BENCH])];
export const PILOT_LIMITS = { postsPerAccount: 3, newerThan: '7 days', maxItems: 45, maxTotalChargeUsd: 1 } as const;
/** Ventana en ms, para descartar posts fijados viejos que el actor igual devuelve. */
const VENTANA_MS = 7 * 24 * 3600 * 1000;

/** Primera lectura: siete días. Después, solape de un minuto para no perder posts en el límite. */
export function inicioIncremental(lastPostAt: unknown, ahora = Date.now()): number {
  const last = typeof lastPostAt === 'string' ? Date.parse(lastPostAt) : NaN;
  return Number.isFinite(last) && last <= ahora
    ? Math.max(ahora - VENTANA_MS, last - 60000)
    : ahora - VENTANA_MS;
}

export interface PilotItem {
  account: string;
  post_url: string;
  posted_at: string | null;
  caption: string;
  post_type: string | null;
  location_name: string | null;
  /** Cuentas citadas en el post: menciones del texto, etiquetadas en la imagen y coautores. Son pistas de cuentas nuevas. */
  mentions: string[];
  tagged_users: string[];
  coauthors: string[];
  /** URL temporal de la imagen (vence en horas): solo por si hace falta leer el flyer. Nunca se publica. */
  display_url_temp: string | null;
}
const HANDLE = /^[a-z0-9._]{1,30}$/;
const limpio = (h: unknown) => (typeof h === 'string' ? h.toLowerCase().replace(/^@/, '').trim() : '');
function handles(v: unknown): string[] {
  const out = new Set<string>();
  for (const x of Array.isArray(v) ? v : []) {
    const h = limpio(typeof x === 'object' && x ? (x as RawPost).username ?? (x as RawPost).userName : x);
    if (HANDLE.test(h)) out.add(h);
  }
  return [...out];
}
/** Menciones escritas en el texto (@cuenta), por si el actor no las entrega aparte. */
export function mencionesDelTexto(caption: string): string[] {
  return [...new Set([...caption.matchAll(/(?<![\w@.])@([A-Za-z0-9._]{1,30})/g)].map((m) => m[1].toLowerCase().replace(/\.+$/, '')))].filter((h) => HANDLE.test(h));
}
/** Solo lo necesario para juzgar el post: nada de comentarios, seguidores ni perfiles. */
export function pilotItem(raw: RawPost, cuentas: readonly string[] = PILOT_ACCOUNTS, ahora = Date.now()): PilotItem | null {
  const owner = raw.owner && typeof raw.owner === 'object' ? (raw.owner as RawPost).username : null;
  const direct = typeof raw.ownerUsername === 'string' ? raw.ownerUsername : owner;
  const account = typeof direct === 'string' ? direct.toLowerCase().replace(/^@/, '') : null;
  if (typeof owner === 'string' && owner.toLowerCase().replace(/^@/, '') !== account) return null;
  const code = postCode(raw);
  if (!account || !code || !cuentas.includes(account)) return null;
  const ts = typeof raw.timestamp === 'string' && !Number.isNaN(Date.parse(raw.timestamp)) ? new Date(raw.timestamp).toISOString() : null;
  // Un post fijado viejo no es novedad: se descarta si cae fuera de la ventana.
  if (raw.isPinned === true && (!ts || ahora - Date.parse(ts) > VENTANA_MS)) return null;
  return {
    account,
    post_url: `https://www.instagram.com/p/${code}/`,
    posted_at: ts,
    caption: typeof raw.caption === 'string' ? raw.caption.slice(0, 4000) : '',
    post_type: typeof raw.type === 'string' ? raw.type.slice(0, 40) : null,
    location_name: typeof raw.locationName === 'string' ? raw.locationName.slice(0, 200) : null,
    mentions: [...new Set([...handles(raw.mentions), ...mencionesDelTexto(typeof raw.caption === 'string' ? raw.caption : '')])].filter((h) => h !== account),
    tagged_users: handles(raw.taggedUsers).filter((h) => h !== account),
    coauthors: handles(raw.coauthorProducers ?? raw.coauthors).filter((h) => h !== account),
    display_url_temp: typeof raw.displayUrl === 'string' && /^https:\/\//.test(raw.displayUrl) ? raw.displayUrl.slice(0, 2000) : null,
  };
}

/** Actores comparados. Mismo contrato de salida: ownerUsername, shortCode, timestamp, caption, mentions… */
export type Actor = 'apify~instagram-scraper' | 'apify~instagram-post-scraper';
export const ACTORES: readonly Actor[] = ['apify~instagram-scraper', 'apify~instagram-post-scraper'];
export function entradaActor(actor: Actor, cuentas: readonly string[], posts: number, newerThan: string) {
  if (actor === 'apify~instagram-post-scraper')
    return { username: [...cuentas], resultsLimit: posts, onlyPostsNewerThan: newerThan, skipPinnedPosts: true };
  return {
    directUrls: cuentas.map((h) => `https://www.instagram.com/${h}/`),
    resultsType: 'posts',
    resultsLimit: posts,
    onlyPostsNewerThan: newerThan,
    addParentData: false,
  };
}

/**
 * Candidato de evento sacado del texto del post. Es metadato de extracción:
 * NO publica ni rechaza. La autoridad sigue siendo el motor de 7 reglas.
 * Las fechas relativas ("hoy", "este viernes") se resuelven contra la fecha
 * del POST, en America/Santiago (extractEventDate).
 */
export interface Candidato {
  is_event: boolean;
  title: string | null;
  start_date: string | null;
  time: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  price: string | null;
  ticket_url: string | null;
  event_type: 'fiesta' | 'tocata' | 'otro' | null;
  field_source: Record<string, 'caption' | 'vision' | 'cuenta'>;
  critical_missing_fields: string[];
  cancelled: boolean;
  needs_vision: boolean;
  source_post_url: string;
}
const TICKETERAS = /https?:\/\/(?:www\.)?(?:passline\.com|portaldisc\.com|ticketplus\.cl|vesti\.cl|ecopass\.cl|toliv\.com|puntoticket\.com|[a-z0-9-]+\.evently\.cl)\/[^\s)]+/i;
export function candidatoDesdeTexto(item: PilotItem, cuentaLugar?: { venue: string; city: string } | null): Candidato {
  const cap = item.caption || '';
  const text = normalizeText(cap);
  const fuente: Candidato['field_source'] = {};
  const fecha = extractEventDate(cap, item.posted_at);
  if (fecha) fuente.start_date = 'caption';
  const hora = extractEventTime(cap);
  if (hora) fuente.time = 'caption';
  const precio = extractPriceInfo(cap);
  const precioTxt = precio.known && precio.text ? precio.text : null;
  if (precioTxt) fuente.price = 'caption';
  const ticket = cap.match(TICKETERAS)?.[0] ?? null;
  if (ticket) fuente.ticket_url = 'caption';
  let venue: string | null = null;
  let city: string | null = null;
  if (cuentaLugar) {
    venue = cuentaLugar.venue;
    city = cuentaLugar.city;
    fuente.venue = 'cuenta';
    fuente.city = 'cuenta';
  } else {
    const c = inferCity(cap);
    if (c !== 'Por confirmar') {
      city = c;
      fuente.city = 'caption';
    }
  }
  const cancelled = /\b(cancelad[oa]|suspendid[oa]|se suspende|reprogramad[oa]|postergad[oa])\b/.test(text);
  const pareceEvento =
    Boolean(fecha) &&
    !isCampaignUpdate(cap) &&
    /\b(fiesta|carrete|tocata|concierto|en vivo|dj|party|show|lanzamiento|halloween|karaoke|noche|entradas|preventa)\b/.test(text);
  const event_type: Candidato['event_type'] = !pareceEvento
    ? null
    : /\b(tocata|concierto|en vivo|banda|lanzamiento)\b/.test(text)
      ? 'tocata'
      : /\b(fiesta|carrete|dj|party|halloween)\b/.test(text)
        ? 'fiesta'
        : 'otro';
  const faltan = ['start_date', 'time', 'venue', 'city'].filter(
    (k) => !({ start_date: fecha, time: hora, venue, city } as Record<string, unknown>)[k],
  );
  return {
    is_event: pareceEvento,
    title: pareceEvento ? firstMeaningfulLine(cap, item.account) : null,
    start_date: fecha,
    time: hora,
    venue,
    address: null,
    city,
    price: precioTxt,
    ticket_url: ticket,
    event_type,
    field_source: fuente,
    critical_missing_fields: faltan,
    cancelled,
    // El flyer solo se lee si el texto no alcanza: post con pinta de evento pero sin fecha, o texto casi vacío.
    needs_vision: (!fecha && /\b(fiesta|tocata|dj|entradas|preventa|halloween|show)\b/.test(text)) || text.replace(/#\S+/g, '').trim().length < 25,
    source_post_url: item.post_url,
  };
}
/** Validación estricta: rechaza cualquier campo de más o de tipo incorrecto. */
export function candidatoValido(c: unknown): c is Candidato {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  const claves = ['is_event','title','start_date','time','venue','address','city','price','ticket_url','event_type','field_source','critical_missing_fields','cancelled','needs_vision','source_post_url'];
  if (Object.keys(o).sort().join() !== [...claves].sort().join()) return false;
  const strOrNull = (v: unknown) => v === null || typeof v === 'string';
  if (typeof o.is_event !== 'boolean' || typeof o.cancelled !== 'boolean' || typeof o.needs_vision !== 'boolean') return false;
  if (!['title','venue','address','city','price','ticket_url'].every((k) => strOrNull(o[k]))) return false;
  if (!(o.start_date === null || (typeof o.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.start_date)))) return false;
  if (!(o.time === null || (typeof o.time === 'string' && /^\d{2}:\d{2}$/.test(o.time)))) return false;
  if (!(o.event_type === null || ['fiesta','tocata','otro'].includes(String(o.event_type)))) return false;
  if (!Array.isArray(o.critical_missing_fields) || !o.critical_missing_fields.every((x) => typeof x === 'string')) return false;
  if (typeof o.field_source !== 'object' || !o.field_source) return false;
  if (!Object.values(o.field_source as object).every((v) => ['caption','vision','cuenta'].includes(String(v)))) return false;
  return typeof o.source_post_url === 'string' && o.source_post_url.startsWith('https://www.instagram.com/p/');
}

/**
 * Descubrimiento de cuentas: toda cuenta citada (mención, etiqueta, coautor)
 * que no está en el registro entra como CANDIDATA, nunca activa. Cuenta
 * apariciones independientes (cuántas cuentas distintas la citaron).
 */
export function cuentasCitadas(items: PilotItem[], conocidas: ReadonlySet<string>) {
  const porCuenta = new Map<string, Set<string>>();
  for (const it of items) {
    for (const h of new Set([...it.mentions, ...it.tagged_users, ...it.coauthors])) {
      if (conocidas.has(h) || h === it.account) continue;
      if (!porCuenta.has(h)) porCuenta.set(h, new Set());
      porCuenta.get(h)!.add(it.account);
    }
  }
  return [...porCuenta.entries()].map(([username, origen]) => ({ username, origenes: [...origen], apariciones: origen.size }));
}
