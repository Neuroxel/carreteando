import { addDays, toChileDateString } from '../../event-extraction';
import { buildCandidate } from '../normalize';
import { fechaHoraChile } from '../rsc';
import { SourceError, type Adapter, type AdapterResult, type EventCandidate } from '../types';
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
    return leerCinzano(json, source);
  },
};
