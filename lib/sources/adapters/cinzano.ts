import { addDays, toChileDateString } from '../../event-extraction';
import { buildCandidate } from '../normalize';
import { fechaHoraChile } from '../rsc';
import { SourceError, type Adapter, type AdapterResult, type EventCandidate, type Fetcher } from '../types';
import { HORIZONTE_DIAS } from './vesti';

const API = 'https://cinzanooficial.cl/cinzano-api/cinzano/v1/events';
const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;
type EventoCinzano = {
  id?: unknown;
  title?: unknown;
  date?: unknown;
  price?: unknown;
  serviceFee?: unknown;
  status?: unknown;
  availableStock?: unknown;
  hasSellableTickets?: unknown;
  externalTicketUrl?: unknown;
  privateEvent?: unknown;
  image?: unknown;
  description?: unknown;
};

/**
 * Ficha primaria de un evento. El `event_id` es la identidad: `/eventos/` sin él
 * es el listado, y `/evento/ID` (la ruta que se usó antes) no es la ficha.
 */
export const fichaCinzano = (id: string) => `https://cinzanooficial.cl/eventos/?event_id=${id}`;
/** Un enlace de compra externo publicado por el propio local, si es https. */
function ticketExterno(v: unknown) {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Bar Cinzano dejó WordPress (tipo `cinzano_event`) por una API propia. Cada
 * evento trae fecha con su desfase, precio y cargo. La disponibilidad no se
 * inventa: si el sitio dice "available"/"few-tickets" pero el stock es 0 y no
 * hay venta habilitada, es un conflicto: sin precio, confianza media y a revisión.
 */
export function leerCinzano(json: unknown, source: { id: string; commune: string; venueName?: string | null }, today = toChileDateString()): AdapterResult {
  if (!Array.isArray(json)) throw new SourceError('PAGINA_INESPERADA');
  const hasta = addDays(today, HORIZONTE_DIAS);
  const candidates: EventCandidate[] = [];
  let parseFailures = 0;
  for (const e of json as EventoCinzano[]) {
    const id = typeof e.id === 'string' || typeof e.id === 'number' ? String(e.id) : '';
    const cuando = typeof e.date === 'string' ? fechaHoraChile(e.date) : null;
    if (!/^\d{1,8}$/.test(id) || typeof e.title !== 'string' || !cuando) {
      parseFailures += 1;
      continue;
    }
    if (e.privateEvent === true || cuando.date < today || cuando.date > hasta) continue;
    const c = buildCandidate({
      sourceId: source.id,
      title: e.title,
      date: cuando.date,
      time: cuando.time,
      venue: source.venueName || null,
      city: source.commune,
      detailUrl: fichaCinzano(id),
      imageUrl: typeof e.image === 'string' ? e.image : null,
      description: typeof e.description === 'string' ? e.description : null,
      confidence: 'high',
      reasons: ['API oficial del local', 'fecha estructurada con desfase horario'],
    });
    if (!c) {
      parseFailures += 1;
      continue;
    }
    const venta = e.hasSellableTickets === true && typeof e.availableStock === 'number' && e.availableStock > 0;
    const externo = ticketExterno(e.externalTicketUrl);
    if (externo) c.reasons.push(`TICKET_URL: ${externo}`);
    const precioValido = typeof e.price === 'number' && Number.isInteger(e.price) && e.price >= 0 && e.price <= 500000;
    if (!venta && !externo && (e.status === 'available' || e.status === 'few-tickets')) {
      // La fuente se contradice: ni precio ni "quedan pocas"; decide una persona.
      c.reasons.push(`AVAILABILITY_CONFLICT: estado "${e.status}" con stock ${String(e.availableStock)} y venta ${e.hasSellableTickets === true ? 'habilitada' : 'no habilitada'}`);
      c.confidence = 'medium';
      c.disponibilidad = 'conflicto';
      c.priceClp = null;
      c.priceText = null;
    } else if (!venta && !externo && e.status === 'sold-out') {
      c.disponibilidad = 'agotado';
      c.priceClp = null;
      c.priceText = 'Agotado en Cinzano';
    } else if (precioValido) {
      const precio = e.price as number;
      const cargo = typeof e.serviceFee === 'number' && e.serviceFee > 0 ? ` + ${pesos(e.serviceFee)} cargo` : '';
      c.priceClp = precio;
      c.priceText = precio === 0 ? 'Entrada sin costo' : `Entrada ${pesos(precio)}${cargo}`;
      c.disponibilidad = 'disponible';
    } else c.reasons.push('PRICE_NOT_FOUND');
    candidates.push(c);
  }
  return { itemsFound: json.length, candidates, parseFailures };
}

type TicketCinzano = { id?: unknown; name?: unknown; kind?: unknown; price?: unknown; serviceFee?: unknown; stock?: unknown; status?: unknown; isSellable?: unknown; isVisible?: unknown };
/** "Orquesta Cinzano - Viernes 23 de octubre - Invitacion gratuita hasta las 23:00" → la condición del ticket. */
const condicion = (nombre: string) => nombre.split(/\s+-\s+/).pop()!.trim();

/**
 * Los tickets del evento son más específicos que el listado (el 23-oct el
 * listado dice $10.000 y el ticket vendible más barato es una invitación
 * gratuita hasta las 23:00). Manda el ticket vendible de menor precio; todos
 * agotados es "agotado"; sin tickets, no se promete precio.
 */
export function aplicarTickets(c: EventCandidate, json: unknown) {
  const lista = (json as { tickets?: unknown })?.tickets;
  if (!Array.isArray(lista)) return false;
  const tickets = (lista as TicketCinzano[])
    .filter((t) => t.isVisible !== false && typeof t.name === 'string' && typeof t.price === 'number' && Number.isInteger(t.price) && t.price >= 0 && t.price <= 500000)
    .map((t) => ({
      id: String(t.id ?? ''),
      nombre: condicion(t.name as string),
      precio: t.price as number,
      cargo: typeof t.serviceFee === 'number' && t.serviceFee > 0 ? t.serviceFee : 0,
      vendible: t.isSellable === true && t.status !== 'sold-out' && (typeof t.stock !== 'number' || t.stock > 0),
    }));
  c.reasons = c.reasons.filter((r) => !r.startsWith('AVAILABILITY_CONFLICT'));
  c.tiers = tickets.map((t) => ({ nombre: t.nombre, precio: t.precio, agotado: !t.vendible }));
  const vendibles = tickets.filter((t) => t.vendible).sort((a, b) => a.precio - b.precio);
  const texto = (t: (typeof tickets)[number]) => (t.precio === 0 ? t.nombre : `${t.nombre} ${pesos(t.precio)}${t.cargo ? ` + ${pesos(t.cargo)} cargo` : ''}`);
  if (vendibles.length) {
    c.priceClp = vendibles[0].precio;
    c.priceText = vendibles.slice(0, 2).map(texto).join(' · ');
    c.disponibilidad = 'disponible';
    c.confidence = 'high';
    c.reasons.push(`TICKETS: ${vendibles.map((t) => t.id).join(',')} vendibles`);
  } else if (tickets.length) {
    c.priceClp = null;
    c.priceText = 'Agotado en Cinzano';
    c.disponibilidad = 'agotado';
    c.reasons.push('TICKETS: todos agotados o sin venta');
  } else {
    c.priceClp = null;
    c.priceText = null;
    c.disponibilidad = 'conflicto';
    c.confidence = 'medium';
    c.reasons.push('AVAILABILITY_CONFLICT: el evento no publica tickets');
  }
  return true;
}

/** Lectura acotada de tickets: los más próximos primero, una solicitud por evento. */
export async function conTicketsCinzano(candidatos: EventCandidate[], fetcher: Fetcher, tope = 8) {
  const orden = [...candidatos].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, tope);
  for (const c of orden) {
    const id = new URL(c.detailUrl).searchParams.get('event_id');
    if (!id || !/^\d{1,8}$/.test(id)) continue;
    try {
      const r = await fetcher(`${API}/${id}/tickets`);
      if (r.status === 200) aplicarTickets(c, JSON.parse(r.body));
    } catch {
      // Sin tickets legibles queda lo que dijo el listado (con su conflicto, si lo hay).
    }
  }
}

export const cinzanoApi: Adapter = {
  id: 'cinzano-api',
  async run(source, fetcher) {
    if (source.publicUrl !== API) throw new SourceError('HOST_NO_PERMITIDO');
    const r = await fetcher(API);
    if (r.status !== 200) throw new SourceError(`HTTP_${r.status}`);
    let json: unknown;
    try {
      json = JSON.parse(r.body);
    } catch {
      throw new SourceError('PAGINA_INESPERADA');
    }
    const r2 = leerCinzano(json, source);
    await conTicketsCinzano(r2.candidates, fetcher);
    return r2;
  },
};
