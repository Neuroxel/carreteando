import { toChileDateString } from '../../event-extraction';
import { buildCandidate } from '../normalize';
import { SourceError, type Adapter, type AdapterResult, type EventCandidate } from '../types';
import { fechaHoraChile } from './jsonld';

/** Desdobla líneas (RFC 5545: una línea que empieza con espacio continúa la anterior). */
export function parseIcs(text: string): Record<string, { value: string; params: string }>[] {
  const lineas = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const eventos: Record<string, { value: string; params: string }>[] = [];
  let actual: Record<string, { value: string; params: string }> | null = null;
  for (const l of lineas) {
    if (l === 'BEGIN:VEVENT') actual = {};
    else if (l === 'END:VEVENT') {
      if (actual) eventos.push(actual);
      actual = null;
    } else if (actual) {
      const i = l.indexOf(':');
      if (i < 0) continue;
      const [nombre, ...params] = l.slice(0, i).split(';');
      actual[nombre.toUpperCase()] = { value: l.slice(i + 1), params: params.join(';') };
    }
  }
  return eventos;
}
const texto = (v = '') => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
/**
 * DTSTART a fecha y hora de Chile. Con "Z" es UTC real. Sin "Z" (con o sin
 * TZID) es la hora de pared del sitio: varios WordPress con The Events
 * Calendar escriben TZID=UTC aunque la hora es local, y un museo no abre a
 * las 7 de la mañana.
 */
export function dtstart(p: { value: string; params: string }): { date: string; time: string | null } | null {
  const m = p.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{0,2})?(Z)?/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || /VALUE=DATE(?!-)/.test(p.params)) return { date, time: null };
  if (m[6]) return fechaHoraChile(`${date}T${m[4]}:${m[5]}:00Z`);
  return { date, time: `${m[4]}:${m[5]}` };
}
/** Calendario público ICS/webcal: uno de los formatos más estables que existen. */
export const icsCalendar: Adapter = {
  id: 'ics-calendar',
  async run(source, fetcher): Promise<AdapterResult> {
    const r = await fetcher(source.config?.icsUrl || source.publicUrl);
    if (r.status !== 200) throw new SourceError(`HTTP_${r.status}`);
    if (!r.body.includes('BEGIN:VCALENDAR')) throw new SourceError('NO_ES_ICS');
    const today = toChileDateString();
    const eventos = parseIcs(r.body);
    const candidates: EventCandidate[] = [];
    let parseFailures = 0;
    for (const ev of eventos) {
      const cuando = ev.DTSTART ? dtstart(ev.DTSTART) : null;
      if (!cuando || !ev.SUMMARY) {
        parseFailures += 1;
        continue;
      }
      if (cuando.date < today) continue;
      const lugar = texto(ev.LOCATION?.value).split(',')[0] || source.venueName || null;
      const c = buildCandidate({
        sourceId: source.id,
        title: texto(ev.SUMMARY.value),
        date: cuando.date,
        time: cuando.time,
        venue: source.venueName || lugar,
        city: source.commune,
        detailUrl: texto(ev.URL?.value) || source.publicUrl,
        imageUrl: null,
        description: texto(ev.DESCRIPTION?.value).slice(0, 600),
        confidence: 'high',
        reasons: ['calendario ICS publicado por la fuente'],
      });
      if (!c) {
        parseFailures += 1;
        continue;
      }
      c.status = ev.STATUS?.value === 'CANCELLED' ? 'cancelled' : 'scheduled';
      candidates.push(c);
    }
    return { itemsFound: eventos.length, candidates, parseFailures };
  },
};
