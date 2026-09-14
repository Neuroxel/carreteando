import { normalizeText } from './event-extraction';
export function eventIdentity(title: string): string {
  return normalizeText(title)
    .replace(/\b(hoy|manana|recordatorio|ultima llamada|preventa|entradas|tickets)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
export function eventKey(venue: string, date: string, title: string): string {
  return `${venue}|${date}|${eventIdentity(title)}`;
}
