import {
  addDays,
  extractEventDate,
  extractEventTime,
  extractPriceInfo,
  firstMeaningfulLine,
  inferCity,
  isCampaignUpdate,
  isLikelyEventPost,
  normalizeText,
  parseTimestamp,
  toChileDateString,
} from './event-extraction';
import { detectCategory } from './events';
import { safeImageUrl } from './safety';
// Explicit scope inherited from the known venue list; no collaborator, hashtag or parent expansion.
// Venue/city are source knowledge, not direct organizer confirmation. Every candidate needs review.
export const SOURCES: Record<string, { venue: string; city: string; identity: string }> = {
  'el.huevo': { venue: 'El Huevo', city: 'Valparaíso', identity: 'el-huevo' },
  barelhuevo: { venue: 'El Huevo', city: 'Valparaíso', identity: 'el-huevo' },
  trotamundosvalpo: {
    venue: 'Trotamundos Valparaíso',
    city: 'Valparaíso',
    identity: 'trota-valpo',
  },
  clubtrotaquilpue: { venue: 'Trotamundos Quilpué', city: 'Quilpué', identity: 'trota-quilpue' },
  club_segundo_piso: { venue: 'Club Segundo Piso', city: 'Valparaíso', identity: 'segundo-piso' },
  mascara_valparaiso: { venue: 'Máscara', city: 'Valparaíso', identity: 'mascara' },
  paganocl: { venue: 'Pagano', city: 'Valparaíso', identity: 'pagano' },
};
export type RawPost = Record<string, unknown>;
export function postOwner(item: RawPost): string | null {
  const owner =
    item.owner && typeof item.owner === 'object' ? (item.owner as RawPost).username : null;
  const direct = typeof item.ownerUsername === 'string' ? item.ownerUsername : owner;
  if (typeof direct !== 'string') return null;
  const handle = direct.toLowerCase().replace(/^@/, '');
  if (typeof owner === 'string' && owner.toLowerCase().replace(/^@/, '') !== handle) return null;
  return Object.hasOwn(SOURCES, handle) ? handle : null;
}
export function postCode(item: RawPost): string | null {
  if (typeof item.shortCode === 'string' && /^[\w-]{3,64}$/.test(item.shortCode))
    return item.shortCode;
  if (typeof item.url !== 'string') return null;
  try {
    const u = new URL(item.url);
    if (!['www.instagram.com', 'instagram.com'].includes(u.hostname)) return null;
    return u.pathname.match(/^\/(?:p|reel)\/([\w-]{3,64})\/?$/)?.[1] || null;
  } catch {
    return null;
  }
}
export type Rejection =
  | 'source_rejected'
  | 'malformed'
  | 'stale_post'
  | 'parse_failed'
  | 'expired'
  | 'classification_rejected'
  | 'campaign_suppressed'
  | 'location_ambiguous';
export function classifyPost(item: RawPost, now = new Date()) {
  const reject = (reason: Rejection) => ({ reason, row: null }) as const;
  const username = postOwner(item);
  if (!username) return reject('source_rejected');
  const meta = SOURCES[username];
  const code = postCode(item);
  const caption = typeof item.caption === 'string' ? item.caption.trim() : '';
  if (!code || !caption || caption.length > 10000) return reject('malformed');
  const published = parseTimestamp(
    item.timestamp ?? item.takenAt ?? item.takenAtIso ?? item.publishedAt,
  );
  if (!published) return reject('parse_failed');
  if (
    published.getTime() > now.getTime() + 5 * 60 * 1000 ||
    published.getTime() < now.getTime() - 7 * 86400000
  )
    return reject('stale_post');
  const date = extractEventDate(caption, published.toISOString());
  if (!date) return reject('parse_failed');
  const today = toChileDateString(now);
  if (date < today) return reject('expired');
  if (date > addDays(today, 120)) return reject('parse_failed');
  if (isCampaignUpdate(caption)) return reject('campaign_suppressed');
  if (!isLikelyEventPost(caption, date)) return reject('classification_rejected');
  const city = inferCity(caption);
  if (
    (city !== 'Por confirmar' && city !== meta.city) ||
    /\b(santiago|concepcion|antofagasta|la serena|rancagua|temuco)\b/.test(normalizeText(caption))
  )
    return reject('location_ambiguous');
  const price = extractPriceInfo(caption);
  return {
    reason: 'candidate' as const,
    row: {
      instagram_id: code,
      title: firstMeaningfulLine(caption, `Noche en ${meta.venue}`),
      description: caption.slice(0, 4000),
      date_text: date,
      location: `${meta.venue} · ${meta.city}`,
      venue: meta.venue,
      city: meta.city,
      address: null,
      event_time: extractEventTime(caption),
      price_clp: price.known ? price.price : null,
      price_text: price.text,
      category: detectCategory(caption),
      image_url: safeImageUrl(item.displayUrl ?? item.thumbnailUrl ?? item.imageUrl),
      instagram_url: `https://www.instagram.com/p/${code}/`,
      username,
      source: 'apify_instagram',
      source_published_at: published.toISOString(),
      scraped_at: now.toISOString(),
      moderation_status: 'pending',
      is_active: false,
      organizer_verified: false,
      event_key: `${meta.identity}|${date}`,
    },
  };
}
export function dedupeCandidates<T extends { event_key: string; instagram_id: string }>(
  rows: T[],
): { unique: T[]; duplicates: number } {
  const keys = new Set<string>(),
    posts = new Set<string>();
  const unique = rows.filter((r) => {
    if (keys.has(r.event_key) || posts.has(r.instagram_id)) return false;
    keys.add(r.event_key);
    posts.add(r.instagram_id);
    return true;
  });
  return { unique, duplicates: rows.length - unique.length };
}
export function boundedResultsLimit(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.min(5, Math.floor(n)) : 3;
}
