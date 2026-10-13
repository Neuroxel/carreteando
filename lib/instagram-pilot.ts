import { postCode, type RawPost } from './ingestion';
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
} as const;
export type Cohorte = keyof typeof PILOT_COHORTS;
export const PILOT_ACCOUNTS = [...new Set([...PILOT_1_ACCOUNTS, ...PILOT_COHORTS.A, ...PILOT_COHORTS.B])];
export const PILOT_LIMITS = { postsPerAccount: 3, newerThan: '7 days', maxItems: 45, maxTotalChargeUsd: 1 } as const;
/** Ventana en ms, para descartar posts fijados viejos que el actor igual devuelve. */
const VENTANA_MS = 7 * 24 * 3600 * 1000;

export interface PilotItem {
  account: string;
  post_url: string;
  posted_at: string | null;
  caption: string;
  post_type: string | null;
  location_name: string | null;
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
  };
}
