import { toChileDateString } from '../../event-extraction';
import { buildCandidate, fechaVerificada, parseSpanishDate, parseTime, stripTags } from '../normalize';
import { SourceError, type Adapter, type AdapterResult, type EventCandidate, type Fetcher } from '../types';
import { ciudadDe } from './jsonld';
const CARD_SEPARATOR = 'class="album"';
const HREF = /href="(\/evento\/[A-Za-z0-9_-]+)"/;
const IMG = /src="(https:\/\/images\.portaldisc\.com\/[^"']+)"/;
const PARAGRAPH = /<p[^>]*>([\s\S]*?)<\/p>/g;
/**
 * El precio no viene en el listado: está en la ficha de cada evento, bajo
 * "TICKETS DISPONIBLES". Se toma el ticket individual más barato que siga a la
 * venta (los agotados y las promos de 2 o 3 entradas no cuentan) y un ticket
 * gratuito se dice tal cual, con su condición, nunca como "Gratis" a secas.
 */
export function precioDeFicha(html: string): { price: number; text: string } | null {
  const inicio = html.indexOf('TICKETS DISPONIBLES');
  if (inicio < 0) return null;
  const fin = html.indexOf('Fecha:', inicio);
  const bloque = stripTags(html.slice(inicio, fin > inicio ? fin : inicio + 4000))
    .replace(/[^\S\n]+/g, ' ');
  const gratis = /ticket gratis([^:]*):/i.exec(bloque);
  const pagados: { nombre: string; precio: number }[] = [];
  for (const m of bloque.matchAll(/([A-Za-zÁÉÍÓÚÑáéíóúñ0-9 +/]{2,40}?):\s*\$\s?([\d.]{3,9})\s*\+\s*Cargo\s*(AGOTAD[AO]|NO DISPONIBLE|QUEDAN? [^\n]{0,20})?/gi)) {
    const nombre = m[1].trim();
    if (/agotad|no disponible/i.test(m[3] || '')) continue;
    if (/doble|2\s*x\s*1|2x|3\s*por|promoci|disco|vip|\bmesa\b/i.test(nombre)) continue;
    const precio = Number(m[2].replace(/\./g, ''));
    if (Number.isInteger(precio) && precio > 0 && precio <= 500000) pagados.push({ nombre, precio });
  }
  const minimo = pagados.sort((a, b) => a.precio - b.precio)[0];
  const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;
  if (gratis) {
    const condicion = gratis[1].trim().toLowerCase();
    const base = condicion ? `Ticket gratis ${condicion}` : 'Ticket gratis en PortalTickets';
    return { price: 0, text: minimo ? `${base} · ${minimo.nombre} ${pesos(minimo.precio)} + cargo` : base };
  }
  if (!minimo) return null;
  return { price: minimo.precio, text: `Desde ${pesos(minimo.precio)} + cargo` };
}

/** Prioriza fechas cercanas; las 24 solicitudes incluyen reintentos del alias. */
async function conPrecio(candidatos: EventCandidate[], fetcher: Fetcher, tope = 24) {
  let solicitudes = 0;
  const counts = new Map<string, number>();
  const pendiente = (c: EventCandidate, code: string) => {
    c.reasons.push(code);
    counts.set(code, (counts.get(code) || 0) + 1);
  };
  for (const c of [...candidatos].sort((a, b) => a.date.localeCompare(b.date))) {
    if (c.priceClp !== null) continue;
    if (solicitudes >= tope) {
      pendiente(c, 'PRICE_BUDGET');
      continue;
    }
    solicitudes += 1;
    let r = await fetcher(c.detailUrl).catch(() => null);
    if (!r || r.status !== 200) {
      const url = new URL(c.detailUrl);
      // Solo el alias HTTPS del mismo proveedor: nunca cambiar la procedencia.
      if (url.protocol === 'https:' && url.hostname === 'www.portaldisc.com' && !url.port && !url.username && !url.password) {
        url.hostname = 'portaldisc.com';
        if (solicitudes < tope) {
          solicitudes += 1;
          r = await fetcher(url.toString()).catch(() => null);
        } else pendiente(c, 'PRICE_BUDGET');
      }
    }
    if (!r || r.status !== 200) {
      pendiente(c, r ? `PRICE_HTTP_${r.status}` : 'PRICE_NETWORK');
      continue;
    }
    const p = precioDeFicha(r.body);
    if (p) {
      c.priceClp = p.price;
      c.priceText = p.text;
    } else pendiente(c, 'PRICE_NOT_FOUND');
  }
  return { candidates: candidatos, diagnostics: [...counts].map(([code, n]) => `${code}=${n}`) };
}

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
    return { itemsFound: cards.length, ...await conPrecio(candidates, fetcher), parseFailures };
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
    return { itemsFound: chunks.length - 1 - fuera, ...await conPrecio(candidates, fetcher), parseFailures };
  },
};
