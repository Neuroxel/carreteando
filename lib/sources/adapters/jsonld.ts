import { toChileDateString } from '../../event-extraction';
import { CIUDADES } from '../../types';
import { buildCandidate, decodeEntities, stripTags } from '../normalize';
import { SourceError, type Adapter, type AdapterResult, type EventCandidate, type Fetcher } from '../types';

type Ld = Record<string, unknown>;
const plano = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
/** Ciudad del registro a partir de addressLocality; null si no es de la región cubierta. */
export function ciudadDe(locality: string): string | null {
  const l = plano(locality);
  return CIUDADES.find((c) => plano(c) === l) || null;
}
/**
 * Sin addressLocality (Evently escribe todo en streetAddress), se busca el
 * nombre exacto de una comuna cubierta como palabra completa. Viña antes que
 * Valparaíso: "Viña del Mar, Región de Valparaíso" es Viña.
 */
/** Comunas de la región que hoy no cubrimos: si aparecen, el evento queda fuera. */
const FUERA = ['algarrobo', 'cartagena', 'san antonio', 'el quisco', 'el tabo', 'santo domingo', 'casablanca', 'la ligua', 'papudo', 'zapallar', 'cabildo', 'petorca', 'los andes', 'san felipe', 'llay llay', 'hijuelas', 'nogales', 'la cruz', 'isla de pascua', 'juan fernandez'];
export function ciudadEnTexto(texto: string): string | null {
  const t = ` ${plano(texto).replace(/[^a-z0-9 ]+/g, ' ')} `;
  if (FUERA.some((c) => t.includes(` ${c} `))) return null;
  const orden = [...CIUDADES].sort((a, b) => b.length - a.length).filter((c) => c !== 'Valparaíso');
  const otra = orden.find((c) => t.includes(` ${plano(c)} `));
  if (otra) return otra;
  // "Valparaíso" solo cuenta si no es el nombre de la región.
  return / valparaiso /.test(t.replace(/ region de valparaiso /g, ' ')) ? 'Valparaíso' : null;
}
/** Todos los objetos schema.org Event de una página, estén donde estén (@graph, listas, anidados). */
export function eventosLd(html: string): Ld[] {
  const out: Ld[] = [];
  const visitar = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(visitar);
    if (!o || typeof o !== 'object') return;
    const t = (o as Ld)['@type'];
    const tipos = Array.isArray(t) ? t.map(String) : [String(t || '')];
    if (tipos.some((x) => /Event$/.test(x))) out.push(o as Ld);
    else Object.values(o).forEach(visitar);
  };
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      visitar(JSON.parse(m[1]));
    } catch {
      /* un bloque roto no tumba la página */
    }
  }
  return out;
}
const str = (v: unknown) => (typeof v === 'string' ? decodeEntities(v).trim() : '');
/** Fecha y hora locales de Chile desde un ISO con desfase. Sin desfase, se toma como hora local. */
export function fechaHoraChile(iso: string): { date: string; time: string | null } | null {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!m) return null;
  if (!m[2]) return { date: m[1], time: null };
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) return { date: m[1], time: m[2] };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value || '';
  return { date: `${p('year')}-${p('month')}-${p('day')}`, time: `${p('hour')}:${p('minute')}` };
}
/** Un Event de schema.org como candidato. Solo lo que viene estructurado; nada se rellena. */
export function candidatoDeLd(ev: Ld, sourceId: string, pageUrl: string, today: string): EventCandidate | null | 'fuera' {
  const cuando = fechaHoraChile(str(ev.startDate));
  if (!cuando || !str(ev.name)) return null;
  if (cuando.date < today) return 'fuera';
  const loc = (ev.location && typeof ev.location === 'object' ? ev.location : {}) as Ld;
  const addr = (loc.address && typeof loc.address === 'object' ? loc.address : {}) as Ld;
  const ciudad = ciudadDe(str(addr.addressLocality)) || ciudadEnTexto(`${str(addr.streetAddress)} ${str(loc.name)}`);
  if (!ciudad) return 'fuera';
  const estado = str(ev.eventStatus);
  const offers = (Array.isArray(ev.offers) ? ev.offers[0] : ev.offers) as Ld | undefined;
  const precio = offers ? str(String(offers.lowPrice ?? offers.price ?? '')) : '';
  const imagen = Array.isArray(ev.image) ? str(ev.image[0]) : str(ev.image);
  const c = buildCandidate({
    sourceId,
    title: str(ev.name),
    date: cuando.date,
    time: cuando.time,
    venue: str(loc.name) || null,
    city: ciudad,
    detailUrl: str(ev.url) || pageUrl,
    imageUrl: imagen || null,
    description: [precio && /^\d+$/.test(precio) ? `Desde $${Number(precio).toLocaleString('es-CL')}` : '', stripTags(str(ev.description))]
      .filter(Boolean)
      .join(' · '),
    // Fecha con desfase de zona horaria escrita por la propia plataforma: es dato estructurado.
    confidence: 'high',
    reasons: ['schema.org Event estructurado en la página', `ciudad declarada: ${ciudad}`],
  });
  if (!c) return null;
  c.status = /Cancelled/.test(estado) ? 'cancelled' : /Postponed|Rescheduled/.test(estado) ? 'postponed' : 'scheduled';
  c.endTime = null;
  return c;
}

/** Fecha al final del slug (…-03-10-2026): si ya pasó, la ficha no se abre. */
export function fechaDeSlug(url: string): string | null {
  const m = url.match(/-(\d{2})-(\d{2})-(\d{4})\/?$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
const REGIONAL = /valpara|valpo|vina|quilpu|villa-alemana|concon|renaca|quillota|limache|olmue|la-calera|quintero|puchuncavi|maitencillo/i;
/** Enlaces a fichas desde páginas índice: vigentes, sin repetir, primero los que nombran la región. */
export function enlacesDeListas(htmls: string[], patron: RegExp, today: string, max: number) {
  const todos = new Set<string>();
  for (const h of htmls) for (const m of h.matchAll(/href="([^"]+)"/g)) if (patron.test(m[1])) todos.add(m[1]);
  return [...todos]
    .filter((u) => {
      const f = fechaDeSlug(u);
      return !f || f >= today;
    })
    .sort((a, b) => Number(REGIONAL.test(b)) - Number(REGIONAL.test(a)))
    .slice(0, max);
}

/**
 * Páginas que publican schema.org/Event. Tres modos:
 * - `sitemap`: lee el sitemap, toma las URLs cuyo slug coincide con `pattern`
 *   y abre como mucho `maxPages` por corrida (no se martilla a nadie).
 * - sin sitemap: lee `publicUrl` y extrae los Event que tenga.
 */
export const jsonldEvents: Adapter = {
  id: 'jsonld-events',
  async run(source, fetcher: Fetcher): Promise<AdapterResult> {
    const today = toChileDateString();
    let paginas = [source.publicUrl];
    if (source.config?.listUrls) {
      // - `listUrls`: páginas índice (portada, productoras); se siguen los
      //   enlaces que calzan con `linkPattern`.
      const htmls: string[] = [];
      for (const u of source.config.listUrls.split(',')) {
        const r = await fetcher(u.trim()).catch(() => null);
        if (r && r.status === 200) htmls.push(r.body);
      }
      if (!htmls.length) throw new SourceError('SIN_INDICE');
      paginas = enlacesDeListas(htmls, new RegExp(source.config.linkPattern || '.'), today, Number(source.config.maxPages || 25));
    } else if (source.config?.sitemap) {
      const sm = await fetcher(source.config.sitemap);
      if (sm.status !== 200) throw new SourceError(`HTTP_${sm.status}`);
      const patron = new RegExp(source.config.pattern || '.', 'i');
      paginas = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1])
        .filter((u) => patron.test(u))
        .slice(0, Number(source.config.maxPages || 20));
    }
    const candidates: EventCandidate[] = [];
    let itemsFound = 0;
    let parseFailures = 0;
    for (const url of paginas) {
      const r = await fetcher(url).catch(() => null);
      if (!r || r.status !== 200) {
        parseFailures += 1;
        continue;
      }
      for (const ev of eventosLd(r.body)) {
        itemsFound += 1;
        const c = candidatoDeLd(ev, source.id, url, today);
        if (c === null) parseFailures += 1;
        else if (c !== 'fuera') candidates.push(c);
      }
    }
    if (!itemsFound && paginas.length && parseFailures === paginas.length) throw new SourceError('SIN_PAGINAS');
    return { itemsFound, candidates, parseFailures };
  },
};
