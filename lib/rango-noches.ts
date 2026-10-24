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
/** Mes de calendario `YYYY-MM` desplazado `n` meses. */
export function sumarMeses(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
/** Semanas (lunes a domingo) que cubren el mes completo; los días de otros meses quedan como relleno. */
export function semanasDelMes(mes: string): string[][] {
  const primero = `${mes}-01`;
  const ultimo = addDays(`${sumarMeses(mes, 1)}-01`, -1);
  const semanas = semanasDesde(primero, 6);
  return semanas.filter((s) => s[0] <= ultimo);
}
/** Cuántos meses hacia adelante se puede navegar desde el mes de hoy. */
export const MESES_ADELANTE = 12;
