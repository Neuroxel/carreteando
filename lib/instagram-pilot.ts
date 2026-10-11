import { postCode, type RawPost } from './ingestion';
/**
 * Piloto controlado de Instagram (10-10-2026). Cuentas oficiales y públicas de
 * lugares cuya programación vive en Instagram y que ninguna ticketera cubre.
 * Lo que trae el piloto es PISTA: se guarda aparte y nunca crea eventos.
 */
export const PILOT_ACCOUNTS = [
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
export const PILOT_LIMITS = { postsPerAccount: 3, newerThan: '3 days', maxItems: 45, maxTotalChargeUsd: 1 } as const;

export interface PilotItem {
  account: string;
  post_url: string;
  posted_at: string | null;
  caption: string;
  post_type: string | null;
  location_name: string | null;
}
/** Solo lo necesario para juzgar el post: nada de comentarios, seguidores ni perfiles. */
export function pilotItem(raw: RawPost): PilotItem | null {
  const owner = raw.owner && typeof raw.owner === 'object' ? (raw.owner as RawPost).username : null;
  const direct = typeof raw.ownerUsername === 'string' ? raw.ownerUsername : owner;
  const account = typeof direct === 'string' ? direct.toLowerCase().replace(/^@/, '') : null;
  if (typeof owner === 'string' && owner.toLowerCase().replace(/^@/, '') !== account) return null;
  const code = postCode(raw);
  if (!account || !code || !(PILOT_ACCOUNTS as readonly string[]).includes(account)) return null;
  const ts = typeof raw.timestamp === 'string' && !Number.isNaN(Date.parse(raw.timestamp)) ? new Date(raw.timestamp).toISOString() : null;
  return {
    account,
    post_url: `https://www.instagram.com/p/${code}/`,
    posted_at: ts,
    caption: typeof raw.caption === 'string' ? raw.caption.slice(0, 4000) : '',
    post_type: typeof raw.type === 'string' ? raw.type.slice(0, 40) : null,
    location_name: typeof raw.locationName === 'string' ? raw.locationName.slice(0, 200) : null,
  };
}
