const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};
export interface PriceInfo {
  price: number;
  known: boolean;
  text: string;
}
export const CHILE_TZ = 'America/Santiago';
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
export function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'string' && /^\d{10,13}$/.test(value)) value = Number(value);
  if (typeof value === 'number') value = value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value))
    return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}
export function toChileDateString(value: string | number | Date | null = new Date()): string {
  const date = parseTimestamp(value);
  if (!date) throw new Error('Invalid timestamp');
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function iso(year: number, month: number, day: number): string | null {
  const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return validIsoDate(value) ? value : null;
}
// One post may announce many dates. Such posts need a reviewer, not a guessed first date.
export function extractEventDate(
  caption: string,
  publishedAt?: string | number | null,
): string | null {
  const text = normalizeText(caption);
  const published = parseTimestamp(publishedAt);
  const base = published ? toChileDateString(published) : null;
  const year = base ? Number(base.slice(0, 4)) : null;
  if (
    /\b(todos? los|cada)\s+(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/.test(
      text,
    ) ||
    /\b\d{1,2}\s*(?:y|al|&)\s*\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/.test(
      text,
    )
  )
    return null;
  const dates: string[] = [];
  const numeric = /(?<![\d/:.])\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/g;
  const spanish = new RegExp(
    `\\b(\\d{1,2})(?:\\s+de)?\\s+(${Object.keys(MONTHS).join('|')})(?:\\s+(?:de\\s+)?(20\\d{2}))?\\b`,
    'g',
  );
  const weekdayPrefix = new RegExp(`\\b(${Object.keys(WEEKDAYS).join('|')})\\s*$`);
  for (const pattern of [numeric, spanish]) {
    for (const m of text.matchAll(pattern)) {
      const month = pattern === numeric ? Number(m[2]) : MONTHS[m[2]];
      const y = m[3] ? Number(m[3]) + (m[3].length === 2 ? 2000 : 0) : year;
      if (!y) return null;
      // Only Dec -> Jan is a safe implicit year rollover, anchored to publication.
      const adjusted = !m[3] && base?.slice(5, 7) === '12' && month === 1 ? y + 1 : y;
      const candidate = iso(adjusted, month, Number(m[1]));
      if (!candidate) return null;
      const prefix = text.slice(Math.max(0, m.index! - 20), m.index);
      const weekday = prefix.match(weekdayPrefix)?.[1];
      if (weekday && new Date(`${candidate}T12:00:00Z`).getUTCDay() !== WEEKDAYS[weekday])
        return null;
      dates.push(candidate);
    }
  }
  if (dates.length) return new Set(dates).size === 1 ? dates[0] : null;
  if (!base) return null;
  // An unparsed numeric date must never fall through to "hoy" or a weekday.
  if (/\b\d{1,2}[/.\-]\d{1,2}\b/.test(text)) return null;
  const withDay = text.match(
    new RegExp(`\\b(${Object.keys(WEEKDAYS).join('|')})\\s+(\\d{1,2})\\b`),
  );
  if (withDay) {
    const month = Number(base.slice(5, 7)),
      day = Number(withDay[2]);
    const candidate = iso(year!, month, day);
    // No automatic next-month promotion of a stale event.
    if (candidate && new Date(`${candidate}T12:00:00Z`).getUTCDay() === WEEKDAYS[withDay[1]])
      return candidate;
    return null;
  }
  if (/\bpasado manana\b/.test(text)) return addDays(base, 2);
  const hasToday = /\b(hoy|esta noche)\b/.test(text);
  const hasTomorrow = /\bmanana\b/.test(text) && !/\b(?:de la|por la) manana\b/.test(text);
  if (hasToday && hasTomorrow) return null;
  if (hasToday) return base;
  if (hasTomorrow) return addDays(base, 1);
  const weekdays = [
    ...text.matchAll(new RegExp(`\\b(${Object.keys(WEEKDAYS).join('|')})\\b`, 'g')),
  ].map((m) => WEEKDAYS[m[1]]);
  if (new Set(weekdays).size !== 1) return null;
  if (/\b(pasado|anterior)\b/.test(text)) return null;
  const dow = new Date(`${base}T12:00:00Z`).getUTCDay();
  return addDays(base, (weekdays[0] - dow + 7) % 7);
}
export function extractEventTime(value: string): string | null {
  const text = normalizeText(value);
  const m =
    text.match(/(?<![\d$])\b([01]?\d|2[0-3]):([0-5]\d)\b/) ||
    text.match(
      /\b(?:desde|a las|inicio|puertas(?: abren)?)\s+(?:a las\s+)?([01]?\d|2[0-3])[.]([0-5]\d)\s*(?:hrs?|horas)\b/,
    );
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const h = text.match(/\b(?:desde|a las|inicio|puertas)\s+([01]?\d|2[0-3])\s*(?:hrs?|horas)\b/);
  return h ? `${h[1].padStart(2, '0')}:00` : null;
}
export function extractPriceInfo(value: string): PriceInfo {
  const text = normalizeText(value);
  const unknown = { price: 0, known: false, text: 'Precio por confirmar' };
  const admission = text
    .split(/[\n;]+/)
    .filter((line) => /\b(entrada|preventa|puerta|ticket|cover|general)\b/.test(line));
  const amounts: number[] = [];
  for (const line of admission) {
    for (const m of line.matchAll(/\$\s*(\d{1,3}(?:\.\d{3})+|\d{1,6})(?![\d.])/g)) {
      const prefix = line.slice(Math.max(0, m.index! - 25), m.index);
      if (/\b(piscola|cerveza|trago|barra|promo|2x)\b/.test(prefix)) continue;
      const n = Number(m[1].replace(/\./g, ''));
      if (n >= 0 && n <= 500000) amounts.push(n);
    }
  }
  if (amounts.length) {
    const price = Math.min(...amounts);
    return {
      price,
      known: true,
      text: price === 0 ? 'Entrada liberada' : `Desde $${price.toLocaleString('es-CL')}`,
    };
  }
  const free = text.match(
    /\b(?:entrada|ingreso|acceso)\s+(?:liberad[ao]|gratis|gratuit[ao])\b[^\n.;]*/,
  )?.[0];
  if (free) {
    if (/\b(hasta|lista|con|antes|mujeres|primer[oa]s?|solo|solamente)\b/.test(free))
      return {
        ...unknown,
        text: value.slice(text.indexOf(free), text.indexOf(free) + free.length).slice(0, 160),
      };
    return { price: 0, known: true, text: 'Entrada liberada' };
  }
  if (/\b(aporte voluntario|al sobre)\b/.test(text))
    return { ...unknown, text: 'Aporte voluntario' };
  return unknown;
}
export function inferCity(value: string): string {
  const text = normalizeText(value);
  if (/\brenaca\b/.test(text)) return 'Reñaca';
  if (/\b(vina del mar|vina)\b/.test(text)) return 'Viña del Mar';
  if (/\bquilpue\b/.test(text)) return 'Quilpué';
  if (/\bvilla alemana\b/.test(text)) return 'Villa Alemana';
  if (/\bconcon\b/.test(text)) return 'Concón';
  if (/\b(valparaiso|valpo)\b/.test(text)) return 'Valparaíso';
  return 'Por confirmar';
}
export function isCampaignUpdate(caption: string): boolean {
  return /\b(artista[s]? confirmado[s]?|lineup revelado|line up revelado|recordatorio|ultima llamada|ultimas entradas|final call|ticket update|conoce (?:a|nuestro)|se suma|nuevo artista)\b/.test(
    normalizeText(caption),
  );
}
export function isLikelyEventPost(caption: string, eventDate: string | null): boolean {
  if (!eventDate) return false;
  const text = normalizeText(caption);
  if (
    /\b(gracias por|asi (?:fue|vivimos)|recuerdo[s]?|retrospectiva|cancelad[oa]|suspendid[oa]|reprogramad[oa]|taller|infantil|ninos|familiar|exposicion|teatro|conversatorio|convocatoria|postula)\b/.test(
      text,
    ) ||
    isCampaignUpdate(caption)
  )
    return false;
  return /\b(fiesta[s]?|carrete[s]?|rave[s]?|after[s]?|techno|reggaeton|perreo|mechoneo|tocata[s]?|dj set|party|discoteca|cumbia|concierto|rock en vivo)\b/.test(
    text,
  );
}
export function firstMeaningfulLine(caption: string, fallback: string): string {
  return (
    caption
      .split('\n')
      .map((s) => s.trim())
      .find((s) => s.length >= 4 && !s.startsWith('#')) || fallback
  )
    .replace(/\s+/g, ' ')
    .slice(0, 130);
}
