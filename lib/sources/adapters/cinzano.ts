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
  privateEvent?: unknown;
  image?: unknown;
  description?: unknown;
};

/**
 * Bar Cinzano dejó WordPress (tipo `cinzano_event`) por una API propia. Cada
 * evento trae fecha con su desfase, precio y cargo. La disponibilidad no se
 * inventa: si el sitio dice "few-tickets" pero el stock es 0 y no hay venta
 * habilitada, se anota el conflicto y la tarjeta no promete entradas.
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
      detailUrl: `https://cinzanooficial.cl/evento/${id}`,
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
    if (typeof e.price === 'number' && Number.isInteger(e.price) && e.price >= 0 && e.price <= 500000) {
      const cargo = typeof e.serviceFee === 'number' && e.serviceFee > 0 ? ` + ${pesos(e.serviceFee)} cargo` : '';
      c.priceClp = e.price;
      c.priceText = `${e.price === 0 ? 'Entrada sin costo' : `Entrada ${pesos(e.price)}${cargo}`}${venta ? '' : ' · sin venta en línea habilitada al revisar'}`;
    } else c.reasons.push('PRICE_NOT_FOUND');
    if (!venta && (e.status === 'available' || e.status === 'few-tickets'))
      c.reasons.push(`AVAILABILITY_CONFLICT: estado "${e.status}" con stock ${String(e.availableStock)} y venta ${e.hasSellableTickets === true ? 'habilitada' : 'no habilitada'}`);
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
