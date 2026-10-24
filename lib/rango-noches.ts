import { addDays } from './event-extraction';

const FMT = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const corta = (d: string) => FMT.format(new Date(`${d}T12:00:00Z`)).replace(/\.$/, '').replace('.', '');
/** "vie 24 oct" o "vie 24 oct → dom 26 oct": siempre noches (hasta las 05:00). */
export function etiquetaRango(desde: string, hasta: string) {
  return desde === hasta ? corta(desde) : `${corta(desde)} → ${corta(hasta)}`;
}
/** Semanas de lunes a domingo, desde la semana de `today`. */
export function semanasDesde(today: string, cuantas: number): string[][] {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const lunes = addDays(today, -((dow + 6) % 7));
  return Array.from({ length: cuantas }, (_, s) => Array.from({ length: 7 }, (_, d) => addDays(lunes, s * 7 + d)));
}
