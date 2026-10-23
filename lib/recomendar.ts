/**
 * "Te recomendamos": ranking determinista y explicable, sin popularidad ni
 * clicks. Orden:
 * 1. calce con la intención (el evento lo dice > calza por el lugar);
 * 2. estado temporal (próximo > sin hora > ya empezó; lo terminado no entra);
 * 3. distancia, si hay ubicación útil;
 * 4. misma zona que la persona;
 * 5. procedencia (oficial/organizador > ticketera > revisado > comunidad);
 * 6. precio conocido;
 * 7. diversidad: no repetir lugar (y en Sorpréndeme, tampoco el tipo de noche).
 * Las razones visibles son solo datos verificables.
 */
import { ORDEN_TEMPORAL, estadoTemporal, type AhoraChile } from './temporal';
import { eventDateLabel } from './events';
import { precioCorto } from './precio';
import { distanciaKm, textoDistancia, type Posicion } from './radar';
import type { ConfianzaPublica, Evento } from './types';

export interface Candidato {
  e: Evento;
  calce: 'exacto' | 'lugar';
  lugar: string | null;
  sector: string | null;
  pos: Posicion | null;
}
export interface Recomendado {
  e: Evento;
  razones: string[];
  km: number | null;
}
const PROCEDENCIA: Record<ConfianzaPublica, number> = { oficial: 0, organizador: 0, varias: 1, ticketera: 1, revisado: 2, comunidad: 3 };

export function recomendar(
  cands: Candidato[],
  ctx: { ahora: AhoraChile; today: string; madrugada?: boolean; yo?: Posicion | null; zonaPersona?: string | null; diverso?: boolean },
  max = 6,
): Recomendado[] {
  const conDatos = cands
    .map((c) => {
      const estado = estadoTemporal(c.e, ctx.ahora);
      const km = ctx.yo && c.pos ? distanciaKm(ctx.yo, c.pos) : null;
      return { ...c, estado, km };
    })
    .filter((c) => c.estado !== 'finalizado');
  const clave = (c: (typeof conDatos)[number]) => [
    c.calce === 'exacto' ? 0 : 1,
    ORDEN_TEMPORAL[c.estado],
    c.km ?? Number.POSITIVE_INFINITY,
    ctx.zonaPersona && c.sector === ctx.zonaPersona ? 0 : 1,
    PROCEDENCIA[c.e.confianza || 'comunidad'],
    c.e.precio_conocido ? 0 : 1,
  ];
  const orden = conDatos.slice().sort((a, b) => {
    const x = clave(a);
    const y = clave(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return a.e.fecha.localeCompare(b.e.fecha) || (a.e.hora || '99').localeCompare(b.e.hora || '99') || a.e.id.localeCompare(b.e.id);
  });
  // Diversidad: primero uno por lugar (y por tipo, si se pide), después se completa.
  const elegidos: typeof orden = [];
  const pasar = (ok: (c: (typeof orden)[number]) => boolean) => {
    for (const c of orden) if (elegidos.length < max && !elegidos.includes(c) && ok(c)) elegidos.push(c);
  };
  const lugarUsado = (c: (typeof orden)[number]) => elegidos.some((x) => (x.lugar || x.e.lugar) === (c.lugar || c.e.lugar));
  if (ctx.diverso) pasar((c) => !lugarUsado(c) && !elegidos.some((x) => x.e.tipo === c.e.tipo));
  pasar((c) => !lugarUsado(c));
  pasar((c) => elegidos.filter((x) => (x.lugar || x.e.lugar) === (c.lugar || c.e.lugar)).length < 2);
  return elegidos.map((c) => ({ e: c.e, km: c.km, razones: razonesDe(c.e, c.estado, c.km, ctx) }));
}

export function razonesDe(e: Evento, estado: string, km: number | null, ctx: { today: string; madrugada?: boolean }) {
  const r: string[] = [];
  if (km !== null) r.push(`A ${textoDistancia(km)}`);
  if (estado === 'iniciado') r.push('Ya empezó');
  else if (e.hora) r.push(`${e.fecha === ctx.today ? '' : `${eventDateLabel(e.fecha, ctx.today, ctx.madrugada)} · `}${e.hora} h`);
  else if (e.fecha !== ctx.today) r.push(eventDateLabel(e.fecha, ctx.today, ctx.madrugada));
  const p = precioCorto(e);
  if (p.tipo !== 'desconocido') r.push(p.texto);
  r.push(`En ${e.ciudad}`);
  if (e.confianza === 'oficial' || e.confianza === 'organizador') r.push('Fuente oficial');
  return r;
}
