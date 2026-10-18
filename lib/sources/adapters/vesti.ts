import { addDays, toChileDateString } from '../../event-extraction';
import { hostVesti } from '../hosts';
import { buildCandidate, fechaVerificada } from '../normalize';
import { arregloTrasClave, fechaHoraChile, textoRsc } from '../rsc';
import { SourceError, type Adapter, type AdapterResult, type EventCandidate } from '../types';

/** Horizonte de lectura: lo que una ticketera vende con más de dos meses no es la cartelera de esta semana. */
export const HORIZONTE_DIAS = 60;
const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;
type EventoVesti = {
  __typename?: string;
  name?: unknown;
  dateIni?: unknown;
  images?: unknown;
  slug?: unknown;
  lowestPrice?: unknown;
  isClosed?: unknown;
};

export function leerVesti(html: string, source: { id: string; commune: string; venueName?: string | null }, today = toChileDateString()): AdapterResult {
  const eventos = arregloTrasClave(textoRsc(html), 'events') as EventoVesti[] | null;
  if (!eventos) {
    if (html.includes('SIN FECHAS PUBLICADAS')) return { itemsFound: 0, candidates: [], parseFailures: 0 };
    throw new SourceError('PAGINA_INESPERADA');
  }
  const hasta = addDays(today, HORIZONTE_DIAS);
  const candidates: EventCandidate[] = [];
  let parseFailures = 0;
  for (const e of eventos) {
    const nombre = typeof e.name === 'string' ? e.name.replace(/\s+/g, ' ').trim() : '';
    const cuando = typeof e.dateIni === 'string' ? fechaHoraChile(e.dateIni) : null;
    const slug = typeof e.slug === 'string' && /^[a-z0-9-]{3,200}$/.test(e.slug) ? e.slug : null;
    if (e.__typename !== 'Event' || !nombre || !cuando || !slug) {
      parseFailures += 1;
      continue;
    }
    if (e.isClosed === true || cuando.date < today || cuando.date > hasta) continue;
    const imagen = Array.isArray(e.images) && typeof e.images[0] === 'string' ? e.images[0] : null;
    const verificada = fechaVerificada(nombre, cuando.date);
    const c = buildCandidate({
      sourceId: source.id,
      title: nombre.replace(/[.\s]+$/, ''),
      date: cuando.date,
      time: cuando.time,
      venue: source.venueName || null,
      city: source.commune,
      detailUrl: `https://vesti.cl/events/${slug}`,
      imageUrl: imagen,
      description: null,
      confidence: verificada ? 'high' : 'medium',
      reasons: [
        'perfil del local en Vesti',
        'fecha y hora estructuradas (UTC) convertidas a Chile',
        verificada ? 'el título escribe el mismo día y año' : 'el título no repite la fecha: revisar',
      ],
    });
    if (!c) {
      parseFailures += 1;
      continue;
    }
    // "Desde $0" en Vesti casi siempre es una invitación con horario o cupo:
    // el precio se guarda, la condición se manda a mirar en la ficha.
    if (typeof e.lowestPrice === 'number' && Number.isInteger(e.lowestPrice) && e.lowestPrice >= 0 && e.lowestPrice <= 500000) {
      c.priceClp = e.lowestPrice;
      c.priceText = `Desde ${pesos(e.lowestPrice)} en Vesti · revisa condiciones de acceso en la ficha`;
    } else c.reasons.push('PRICE_NOT_FOUND');
    candidates.push(c);
  }
  return { itemsFound: eventos.length, candidates, parseFailures };
}
/**
 * Perfil de empresa en Vesti (`vesti.cl/company/<local>`). La lista de
 * próximas fechas viaja en el HTML con su instante en UTC: el texto visible
 * del servidor dice "Dom 18 oct, 01:00" para un sábado a las 22:00 en Chile,
 * así que nunca se lee el texto, solo `dateIni`.
 *
 * Una sola solicitud por corrida: la ficha de Vesti no trae ni fecha ni
 * tickets sin JavaScript, así que abrirla no aportaría datos.
 */
export const vestiCompany: Adapter = {
  id: 'vesti-company',
  async run(source, fetcher, ctx) {
    const url = new URL(source.publicUrl);
    if (url.protocol !== 'https:' || !hostVesti(url.hostname) || !/^\/company\/[a-z0-9-]+\/?$/.test(url.pathname))
      throw new SourceError('HOST_NO_PERMITIDO');
    const r = await fetcher(url.toString());
    if (r.status !== 200) throw new SourceError(`HTTP_${r.status}`);
    return leerVesti(r.body, source, ctx?.today);
  },
};
