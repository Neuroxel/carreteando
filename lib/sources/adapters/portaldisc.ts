import { toChileDateString } from '../../event-extraction';
import { buildCandidate, fechaVerificada, parseSpanishDate, parseTime, stripTags } from '../normalize';
import { SourceError, type Adapter, type AdapterResult } from '../types';
import { ciudadDe } from './jsonld';
const CARD_SEPARATOR = 'class="album"';
const HREF = /href="(\/evento\/[A-Za-z0-9_-]+)"/;
const IMG = /src="(https:\/\/images\.portaldisc\.com\/[^"']+)"/;
const PARAGRAPH = /<p[^>]*>([\s\S]*?)<\/p>/g;
/**
 * A ticket platform publishes one page per venue. It is a real calendar, but it
 * is somebody else's calendar: dates come from human-written Spanish, so these
 * land in the queue rather than straight on the page.
 */
export const portaldiscCartelera: Adapter = {
  id: 'portaldisc-cartelera',
  async run(source, fetcher): Promise<AdapterResult> {
    const response = await fetcher(source.publicUrl);
    if (response.status !== 200) throw new SourceError(`HTTP_${response.status}`);
    const body = response.body;
    if (!body.includes('PRÓXIMOS EVENTOS')) throw new SourceError('PAGINA_INESPERADA');
    const today = toChileDateString();
    // A lookahead-delimited regex silently dropped the last card on any page
    // with a single event, which is most venue pages most weeks.
    const cards = body.split(CARD_SEPARATOR).slice(1);
    const candidates = [];
    let parseFailures = 0;
    for (const card of cards) {
      const href = card.match(HREF);
      if (!href) continue;
      const lines: string[] = [];
      for (const match of card.matchAll(PARAGRAPH)) {
        const text = stripTags(match[1]);
        if (text) lines.push(text);
      }
      const [title, whenLine, whereLine] = lines;
      if (!title || !whenLine) {
        parseFailures += 1;
        continue;
      }
      const date = parseSpanishDate(whenLine, today);
      if (!date) {
        parseFailures += 1;
        continue;
      }
      if (date < today) continue;
      const verificada = fechaVerificada(whenLine, date);
      const candidate = buildCandidate({
        sourceId: source.id,
        title,
        date,
        time: parseTime(whenLine),
        venue: source.venueName || (whereLine ? whereLine.split(',')[0] : null),
        city: source.commune,
        detailUrl: new URL(href[1], 'https://www.portaldisc.com').toString(),
        imageUrl: card.match(IMG)?.[1] || null,
        description: [whenLine, whereLine].filter(Boolean).join(' · '),
        confidence: verificada ? 'high' : 'medium',
        reasons: [
          'cartelera oficial del lugar en la ticketera',
          verificada ? 'año escrito y día de la semana coinciden con la fecha' : 'fecha escrita en texto, sin año verificable',
        ],
      });
      if (candidate) candidates.push(candidate);
      else parseFailures += 1;
    }
    return { itemsFound: cards.length, candidates, parseFailures };
  },
};

/**
 * El listado regional de la ticketera (/tickets/R05): una sola página con todo
 * lo que vende en la región, incluidos locales que no tienen cartelera propia
 * registrada. La ciudad sale de la línea "Local, Ciudad" y lo que cae fuera de
 * las comunas cubiertas se descarta.
 */
export const portaldiscRegion: Adapter = {
  id: 'portaldisc-region',
  async run(source, fetcher): Promise<AdapterResult> {
    const response = await fetcher(source.publicUrl);
    if (response.status !== 200) throw new SourceError(`HTTP_${response.status}`);
    const chunks = response.body.split('class="info_responsivo"');
    if (chunks.length < 2) throw new SourceError('PAGINA_INESPERADA');
    const today = toChileDateString();
    const candidates = [];
    let parseFailures = 0;
    let fuera = 0;
    for (let i = 1; i < chunks.length; i++) {
      const card = chunks[i].slice(0, 2000);
      const href = card.match(/href="(?:https:\/\/www\.portaldisc\.com)?(\/evento\/[A-Za-z0-9_-]+)/);
      const lines = [...card.matchAll(PARAGRAPH)].map((m) => stripTags(m[1])).filter(Boolean);
      const [title, whenLine, whereLine] = lines;
      if (!href || !title || !whenLine || !whereLine) {
        parseFailures += 1;
        continue;
      }
      const date = parseSpanishDate(whenLine, today);
      if (!date) {
        parseFailures += 1;
        continue;
      }
      if (date < today) continue;
      const corte = whereLine.lastIndexOf(',');
      const venue = (corte > 0 ? whereLine.slice(0, corte) : whereLine).trim();
      const city = ciudadDe(corte > 0 ? whereLine.slice(corte + 1) : '');
      if (!city) {
        fuera += 1;
        continue;
      }
      const imgs = [...chunks[i - 1].matchAll(new RegExp(IMG.source, 'g'))];
      const verificada = fechaVerificada(whenLine, date);
      const candidate = buildCandidate({
        sourceId: source.id,
        title,
        date,
        time: parseTime(whenLine),
        venue,
        city,
        detailUrl: new URL(href[1], 'https://www.portaldisc.com').toString(),
        imageUrl: imgs.length ? imgs[imgs.length - 1][1] : null,
        description: [whenLine, whereLine].join(' · '),
        confidence: verificada ? 'high' : 'medium',
        reasons: [
          'listado regional de la ticketera',
          verificada ? 'año escrito y día de la semana coinciden con la fecha' : 'fecha escrita en texto, sin año verificable',
        ],
      });
      if (candidate) candidates.push(candidate);
      else parseFailures += 1;
    }
    return { itemsFound: chunks.length - 1 - fuera, candidates, parseFailures };
  },
};
