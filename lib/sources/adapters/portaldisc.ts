import { toChileDateString } from '../../event-extraction';
import { buildCandidate, fechaVerificada, parseSpanishDate, parseTime, stripTags } from '../normalize';
import { SourceError, esPlazoAgotado, type AdapterContext, type Adapter, type AdapterResult, type EventCandidate, type Fetcher } from '../types';
import { ciudadDe } from './jsonld';
const CARD_SEPARATOR = 'class="album"';
const HREF = /href="(\/evento\/[A-Za-z0-9_-]+)"/;
const IMG = /src="(https:\/\/images\.portaldisc\.com\/[^"']+)"/;
const PARAGRAPH = /<p[^>]*>([\s\S]*?)<\/p>/g;
/**
 * Un tipo de entrada tal como lo publica la ficha. `agotado` solo si la ficha
 * lo dice (AGOTADA, NO DISPONIBLE, FINALIZADO); la ausencia de esa palabra no
 * garantiza stock, pero tampoco se inventa que esté agotado.
 */
export interface TierEntrada {
  nombre: string;
  precio: number;
  gratis: boolean;
  agotado: boolean;
  cargo: boolean;
  /** Precio por grupo (2x1, doble, 3 por…): no es el precio de una entrada. */
  grupal: boolean;
  /** Solo para niños o menores: no hace gratis la noche. */
  infantil: boolean;
  /** Entrada con algo más (disco, totebag, VIP, mesa): no es la base. */
  conExtra: boolean;
}
export interface PrecioFicha {
  price: number | null;
  text: string;
  /** `agotado`: todas las entradas individuales dicen agotado. */
  disponibilidad: 'disponible' | 'agotado';
  tiers: TierEntrada[];
}
const ACCIONES =
  /Comprar o Regalar|Agregar al Carro|Generar Ticket Gratuito|Al comprar este ticket, recibir[aá]s \d+ entradas individuales con su respectivo c[oó]digo QR\.?|Puedes generar un m[aá]ximo de \d+ tickets? gratuitos? con tu cuenta de PortalTickets\.?|QUEDAN? \d+|[ÚU]LTIMOS TICKETS/gi;

/** Los tipos de entrada del bloque "TICKETS DISPONIBLES". No exige "+ Cargo": algunas fichas no lo escriben. */
export function tiersDeFicha(html: string): TierEntrada[] | null {
  const inicio = html.indexOf('TICKETS DISPONIBLES');
  if (inicio < 0) return null;
  const fin = html.indexOf('Fecha:', inicio);
  const bloque = stripTags(html.slice(inicio + 'TICKETS DISPONIBLES'.length, fin > inicio ? fin : inicio + 6000))
    // Restos de atributos que quedan cuando un onclick lleva ">" dentro.
    .replace(/'\)"[^>]*?">/g, ' ')
    .replace(/^\s*:/, '')
    .replace(/[^\S\n]+/g, ' ');
  // Cada tipo empieza tras el anterior: las acciones y avisos sirven de separador.
  const limpio = bloque.replace(ACCIONES, ' ¦ ');
  const tiers: TierEntrada[] = [];
  const patron = /([^¦:\n$]{2,60}?):\s*(?:\$\s?([\d.]{1,9})(\s*\+\s*Cargo)?|(?=\s*¦)|(Entrada Liberada))\s*(AGOTAD[AO]|NO DISPONIBLE|FINALIZADO)?/gi;
  for (const m of limpio.matchAll(patron)) {
    const nombre = m[1].replace(/\s+/g, ' ').trim();
    if (!nombre || /^(fecha|lugar)$/i.test(nombre)) continue;
    const gratis = !m[2];
    const precio = gratis ? 0 : Number(m[2].replace(/\./g, ''));
    if (!Number.isInteger(precio) || precio < 0 || precio > 500000) continue;
    tiers.push({
      nombre,
      precio,
      gratis,
      agotado: Boolean(m[5]),
      cargo: Boolean(m[3]),
      grupal: /doble|2\s*x\s*1|\b\dx\b|\b\d\s*por\b|promoci|dos personas|para dos|pareja|grupal/i.test(nombre),
      infantil: /ni[ñn]o|menor|infantil/i.test(nombre),
      conExtra: /disco|totebag|polera|vip|\bmesa\b|\+/i.test(nombre),
    });
  }
  return tiers;
}

/**
 * El precio que se muestra es el de la entrada individual más barata que se
 * puede comprar ahora. Lo agotado no cuenta; lo grupal, infantil o con extras
 * tampoco. Una entrada gratis se dice con su condición. Si todas las entradas
 * individuales están agotadas, se dice "agotado" y no se muestra un precio.
 */
/**
 * La ficha cambia el botón de compra por "EVENTO CANCELADO" (con el aviso de
 * reembolso). Solo ese botón cuenta: el pie de página habla de cancelaciones
 * en general y no dice nada de este evento.
 */
export function canceladaEnFicha(html: string) {
  return /id="botonera"[\s\S]{0,800}?<a\b[^>]*class="buy"[^>]*>\s*EVENTO\s+CANCELADO\s*<\/a>/i.test(html);
}

export function precioDeFicha(html: string): PrecioFicha | null {
  const tiers = tiersDeFicha(html);
  if (!tiers || !tiers.length) return null;
  const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;
  const base = tiers.filter((t) => !t.grupal && !t.infantil && !t.conExtra);
  const elegibles = base.length ? base : tiers.filter((t) => !t.infantil);
  const vigentes = elegibles.filter((t) => !t.agotado);
  if (!vigentes.length) {
    return elegibles.length
      ? { price: null, text: 'Agotado en PortalTickets', disponibilidad: 'agotado', tiers }
      : null;
  }
  const pagados = vigentes.filter((t) => !t.gratis).sort((a, b) => a.precio - b.precio);
  const gratis = vigentes.find((t) => t.gratis);
  const conCargo = (t: TierEntrada) => `${pesos(t.precio)}${t.cargo ? ' + cargo' : ''}`;
  if (gratis) {
    const condicion = gratis.nombre.replace(/^ticket gratis\s*/i, '').trim().toLowerCase();
    const texto = /gratis|liberad/i.test(gratis.nombre) ? `Ticket gratis${condicion ? ` ${condicion}` : ''}` : `${gratis.nombre}: gratis`;
    return {
      price: 0,
      text: pagados[0] ? `${texto} · ${pagados[0].nombre} ${conCargo(pagados[0])}` : texto,
      disponibilidad: 'disponible',
      tiers,
    };
  }
  const minimo = pagados[0];
  return { price: minimo.precio, text: `Desde ${conCargo(minimo)}`, disponibilidad: 'disponible', tiers };
}

/** Prioriza fechas cercanas; las 24 solicitudes incluyen reintentos del alias. */
/**
 * Lee el precio en la ficha de cada evento, con tope de solicitudes. Primero las
 * fichas que la base todavía no tiene con precio y, con lo que sobre, las que
 * ya lo tienen (para notar un tramo agotado o un cambio).
 */
async function conPrecio(candidatos: EventCandidate[], fetcher: Fetcher, ctx: AdapterContext = {}, tope = 24) {
  let solicitudes = 0;
  const counts = new Map<string, number>();
  const pendiente = (c: EventCandidate, code: string) => {
    c.reasons.push(code);
    counts.set(code, (counts.get(code) || 0) + 1);
  };
  const yaTiene = (c: EventCandidate) => Number(Boolean(ctx.conPrecio?.has(c.detailUrl)));
  for (const c of [...candidatos].sort((a, b) => yaTiene(a) - yaTiene(b) || a.date.localeCompare(b.date))) {
    if (c.priceClp !== null) continue;
    if (solicitudes >= tope) {
      pendiente(c, 'PRICE_BUDGET');
      continue;
    }
    solicitudes += 1;
    let plazo = false;
    const pedir = (u: string) =>
      fetcher(u).catch((e) => {
        plazo ||= esPlazoAgotado(e);
        return null;
      });
    let r = await pedir(c.detailUrl);
    if (!plazo && (!r || r.status !== 200)) {
      const url = new URL(c.detailUrl);
      // Solo el alias HTTPS del mismo proveedor: nunca cambiar la procedencia.
      if (url.protocol === 'https:' && url.hostname === 'www.portaldisc.com' && !url.port && !url.username && !url.password) {
        url.hostname = 'portaldisc.com';
        if (solicitudes < tope) {
          solicitudes += 1;
          r = await pedir(url.toString());
        } else pendiente(c, 'PRICE_BUDGET');
      }
    }
    if (!r || r.status !== 200) {
      pendiente(c, plazo ? 'PRICE_DEADLINE' : r ? `PRICE_HTTP_${r.status}` : 'PRICE_NETWORK');
      continue;
    }
    if (canceladaEnFicha(r.body)) {
      c.status = 'cancelled';
      c.priceClp = null;
      c.priceText = null;
      pendiente(c, 'CANCELLED_ON_DETAIL');
      continue;
    }
    const p = precioDeFicha(r.body);
    if (p) {
      c.priceClp = p.price;
      c.priceText = p.text;
      c.disponibilidad = p.disponibilidad;
      c.tiers = p.tiers.map((t) => ({ nombre: t.nombre, precio: t.precio, agotado: t.agotado }));
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
  async run(source, fetcher, ctx): Promise<AdapterResult> {
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
    return { itemsFound: cards.length, ...await conPrecio(candidates, fetcher, ctx), parseFailures };
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
  async run(source, fetcher, ctx): Promise<AdapterResult> {
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
    return { itemsFound: chunks.length - 1 - fuera, ...await conPrecio(candidates, fetcher, ctx), parseFailures };
  },
};
