import { toChileDateString } from '../../event-extraction';
import { buildCandidate, parseSpanishDate, parseTime, stripTags } from '../normalize';
import { SourceError, type Adapter, type AdapterResult } from '../types';
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
        confidence: 'medium',
        reasons: ['cartelera oficial del lugar en la ticketera', 'fecha escrita en texto'],
      });
      if (candidate) candidates.push(candidate);
      else parseFailures += 1;
    }
    return { itemsFound: cards.length, candidates, parseFailures };
  },
};
