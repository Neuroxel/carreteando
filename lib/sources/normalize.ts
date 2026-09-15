import { extractPriceInfo, toChileDateString } from '../event-extraction';
import { safeImageUrl, safeWebUrl } from '../safety';
import type { EventCandidate } from './types';
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  nbsp: ' ',
};
export function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => codePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}
function codePoint(value: number) {
  // WordPress writes accents numerically often enough that leaving them encoded
  // put "B&#233;same macho" on the page.
  return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
}
export function stripTags(value: string) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
/** "Sábado 17 de octubre 2026" and "17 de octubre" both appear in the wild. */
export function parseSpanishDate(value: string, today = toChileDateString()): string | null {
  const text = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const match = text.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(\d{4}))?/,
  );
  if (!match) return null;
  const day = Number(match[1]);
  const monthName = match[2] === 'setiembre' ? 'septiembre' : match[2];
  const month = MESES.indexOf(monthName) + 1;
  if (!month || day < 1 || day > 31) return null;
  // No year printed means the next occurrence, never a date in the past.
  let year = match[3] ? Number(match[3]) : Number(today.slice(0, 4));
  const iso = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (!match[3] && iso(year) < today) year += 1;
  const result = iso(year);
  return validCalendarDate(result) ? result : null;
}
export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}
/** WordPress meta fields tend to arrive as YYYYMMDD. */
export function parseCompactDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return validCalendarDate(iso) ? iso : null;
}
export function parseIsoDateIn(value: string): string | null {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return validCalendarDate(match[0]) ? match[0] : null;
}
export function parseTime(value: string): string | null {
  const match = value.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}
/**
 * Two adapters describing the same night must produce the same key, and the key
 * must never collide across venues that happen to share a title.
 */
export function candidateKey(sourceId: string, date: string, title: string) {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `src-${sourceId}-${date}-${slug || 'evento'}`;
}
export function buildCandidate(input: {
  sourceId: string;
  title: string;
  date: string;
  time?: string | null;
  venue?: string | null;
  city: string;
  detailUrl: string;
  imageUrl?: string | null;
  description?: string | null;
  confidence: EventCandidate['confidence'];
  reasons: string[];
}): EventCandidate | null {
  const title = decodeEntities(input.title).slice(0, 180);
  const detailUrl = safeWebUrl(input.detailUrl);
  if (title.length < 4 || !detailUrl || !validCalendarDate(input.date)) return null;
  const priceSource = `${input.description || ''} ${title}`;
  const price = extractPriceInfo(priceSource);
  return {
    key: candidateKey(input.sourceId, input.date, title),
    title,
    date: input.date,
    time: input.time || null,
    venue: input.venue ? decodeEntities(input.venue).slice(0, 120) : null,
    city: input.city,
    detailUrl,
    imageUrl: safeImageUrl(input.imageUrl),
    description: input.description ? stripTags(input.description).slice(0, 600) : null,
    priceText: price.known ? price.text : null,
    priceClp: price.known ? price.price : null,
    confidence: input.confidence,
    reasons: input.reasons,
  };
}
