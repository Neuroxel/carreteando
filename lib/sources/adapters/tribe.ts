import { toChileDateString } from '../../event-extraction';
import { buildCandidate, decodeEntities, stripTags } from '../normalize';
import { SourceError, type Adapter, type AdapterResult } from '../types';
type TribeEvent = {
  url?: string;
  title?: string;
  description?: string;
  excerpt?: string;
  start_date?: string;
  end_date?: string;
  all_day?: boolean;
  cost?: string;
  categories?: { name?: string }[];
  venue?: { venue?: string; city?: string; province?: string; stateprovince?: string } | unknown[];
};
const FECHA_HORA = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/;
/**
 * The Events Calendar (Tribe) expone la misma API en cientos de sitios
 * culturales y universitarios: fecha y hora estructuradas, recinto y costo por
 * evento. Es un directorio de terceros, así que nada de aquí se publica solo,
 * y no tomamos su imagen: muchas veces es una captura de Instagram cuyo origen
 * no podemos acreditar.
 */
export const tribeEvents: Adapter = {
  id: 'tribe-events',
  async run(source, fetcher): Promise<AdapterResult> {
    const today = toChileDateString();
    const perPage = source.config?.perPage || '50';
    const url = `${source.publicUrl.replace(/\/$/, '')}/wp-json/tribe/events/v1/events?per_page=${perPage}&start_date=${today}`;
    const response = await fetcher(url);
    // Tribe responde 404 con un JSON cuando no hay eventos próximos: un
    // calendario vacío no es una fuente rota.
    if (response.status === 404 && !response.body.includes('rest_no_route'))
      return { itemsFound: 0, candidates: [], parseFailures: 0 };
    if (response.status !== 200) throw new SourceError(`HTTP_${response.status}`);
    let parsed: { events?: TribeEvent[] };
    try {
      parsed = JSON.parse(response.body);
    } catch {
      throw new SourceError('JSON_INVALIDO');
    }
    if (!parsed || !Array.isArray(parsed.events)) throw new SourceError('RESPUESTA_INESPERADA');
    const candidates = [];
    let parseFailures = 0;
    for (const event of parsed.events) {
      const start = (event.start_date || '').match(FECHA_HORA);
      if (!start || !event.title || !event.url) {
        parseFailures += 1;
        continue;
      }
      const end = (event.end_date || '').match(FECHA_HORA);
      // Una muestra de un mes no es "hoy": se toma el día de hoy solo si sigue abierta.
      const date = start[1] >= today ? start[1] : end && end[1] >= today ? today : null;
      if (!date) continue;
      const venue = event.venue && !Array.isArray(event.venue) ? event.venue : null;
      const categorias = (event.categories || []).map((c) => decodeEntities(c.name || '')).filter(Boolean);
      const titulo = decodeEntities(event.title);
      const candidate = buildCandidate({
        sourceId: source.id,
        title: titulo,
        date,
        // "Todo el día" no es una hora; tampoco la medianoche que Tribe rellena.
        time: event.all_day || start[2] === '00:00' ? null : start[2],
        venue: venue?.venue ? decodeEntities(venue.venue) : null,
        city: source.commune,
        detailUrl: event.url,
        imageUrl: null,
        description: [event.cost ? `Entrada: ${decodeEntities(event.cost)}` : '', stripTags(event.excerpt || event.description || '')]
          .filter(Boolean)
          .join(' · '),
        confidence: 'medium',
        reasons: ['fecha y hora estructuradas en un directorio cultural', 'recinto declarado por el directorio'],
      });
      if (!candidate) {
        parseFailures += 1;
        continue;
      }
      candidate.categories = categorias;
      candidate.endTime = end && end[1] === start[1] ? end[2] : null;
      candidates.push(candidate);
    }
    return { itemsFound: parsed.events.length, candidates, parseFailures };
  },
};
