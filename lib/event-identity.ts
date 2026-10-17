import { sufijoHora } from './occurrence';
import { normalizeText } from './event-extraction';
export function eventIdentity(title: string): string {
  return normalizeText(title)
    .replace(/\b(hoy|manana|recordatorio|ultima llamada|preventa|entradas|tickets)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
/**
 * Clave canónica (índice único `events_canonical_key`). Con hora conocida se
 * agrega al final: dos funciones del mismo día son dos filas. Sin hora, igual
 * que antes, así las claves ya guardadas siguen valiendo.
 */
export function eventKey(venue: string, date: string, title: string, time: string | null = null): string {
  const base = `${venue}|${date}|${eventIdentity(title)}`;
  const hora = sufijoHora(time);
  return hora ? `${base}|${hora}` : base;
}
