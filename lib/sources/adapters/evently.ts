import { addDays, toChileDateString } from '../../event-extraction';
import { hostEvently } from '../hosts';
import { buildCandidate, decodeEntities } from '../normalize';
import { fechaHoraChile, textoRsc, valorDesde } from '../rsc';
import { SourceError, esPlazoAgotado, type Adapter, type AdapterResult, type EventCandidate, type Fetcher } from '../types';
import { HORIZONTE_DIAS } from './vesti';

/** Por corrida: como mucho 4 fechas próximas, con ficha y tickets cada una (8 solicitudes + la agenda). */
export const EVENTLY_FICHAS = 4;
const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;

/** `https://wooclub.evently.cl/Sabawoo-x-Ley-C-Sale-17-10-2026` → fecha local escrita en la URL. */
export function fichasDeAgenda(html: string, host: string): { url: string; date: string }[] {
  const patron = new RegExp(`https://${host.replace(/\./g, '\\.')}/([A-Za-z0-9-]{3,160}?)-(\\d{2})-(\\d{2})-(20\\d{2})(?![\\w-])`, 'g');
  const vistas = new Map<string, string>();
  for (const fuente of [html, textoRsc(html)])
    for (const m of fuente.matchAll(patron)) vistas.set(m[0], `${m[4]}-${m[3]}-${m[2]}`);
  return [...vistas].map(([url, date]) => ({ url, date }));
}

type EventoLd = { '@type'?: unknown; name?: unknown; startDate?: unknown; image?: unknown; description?: unknown; location?: { address?: { streetAddress?: unknown } } };
export function eventoDeFicha(html: string): EventoLd | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]) as EventoLd;
      if (d && d['@type'] === 'Event') return d;
    } catch {
      /* otro bloque */
    }
  }
  return null;
}

type Ticket = { name?: unknown; price?: unknown; description?: unknown; isSoldOut?: unknown; hasAvailableStock?: unknown };
/**
 * Los tipos de ticket con su condición escrita por el local. Un ticket gratis
 * se dice con su condición ("válido hasta las 23:30…"), nunca "Gratis" a secas.
 */
export function precioDeTickets(html: string): { price: number | null; text: string; disponibilidad: 'disponible' | 'agotado' } | null {
  const texto = textoRsc(html);
  const tickets: Ticket[] = [];
  for (const m of texto.matchAll(/"ticketType":\{/g)) {
    const t = valorDesde(texto, m.index + '"ticketType":'.length);
    if (t && typeof t === 'object') tickets.push(t as Ticket);
  }
  const validos = tickets.filter((t) => typeof t.price === 'number' && Number.isInteger(t.price) && t.price >= 0 && t.price <= 500000);
  const vigentes = validos.filter((t) => t.isSoldOut !== true && t.hasAvailableStock !== false);
  // Todas publicadas y todas agotadas: se dice agotado, sin mostrar un precio que no se puede pagar.
  if (!vigentes.length) return validos.length ? { price: null, text: 'Agotado en Evently', disponibilidad: 'agotado' } : null;
  const limpio = (v: unknown) => (typeof v === 'string' ? decodeEntities(v).replace(/\s+/g, ' ').trim() : '');
  const partes = vigentes.map((t) => {
    const nombre = limpio(t.name);
    const condicion = limpio(t.description);
    const precio = t.price === 0 ? 'sin costo' : `${pesos(t.price as number)} + cargo`;
    return `${nombre} ${precio}${condicion ? ` (${condicion.replace(/\.$/, '')})` : ''}`;
  });
  const minimo = Math.min(...vigentes.map((t) => t.price as number));
  return { price: minimo, text: partes.join(' · ').slice(0, 500), disponibilidad: 'disponible' };
}

/**
 * Agenda propia de un local en Evently (`<local>.evently.cl`), solo para
 * subdominios exactos de `EVENTLY_HOSTS`. La agenda trae las URLs con la fecha
 * local; cada ficha confirma esa fecha con su `schema.org/Event` y la página de
 * tickets da precios y condiciones. Fechas pasadas o lejanas no se abren.
 */
export const eventlyAgenda: Adapter = {
  id: 'evently-agenda',
  async run(source, fetcher) {
    return leerEvently(source, fetcher);
  },
};
export async function leerEvently(
  source: { id: string; publicUrl: string; commune: string; venueName?: string | null },
  fetcher: Fetcher,
  today = toChileDateString(),
  tope = EVENTLY_FICHAS,
): Promise<AdapterResult> {
  const base = new URL(source.publicUrl);
  if (base.protocol !== 'https:' || !hostEvently(base.hostname) || base.pathname !== '/' || base.search)
    throw new SourceError('HOST_NO_PERMITIDO');
  const agenda = await fetcher(base.toString());
  if (agenda.status !== 200) throw new SourceError(`HTTP_${agenda.status}`);
  if (!agenda.body.includes('evently')) throw new SourceError('PAGINA_INESPERADA');
  const hasta = addDays(today, HORIZONTE_DIAS);
  const todas = fichasDeAgenda(agenda.body, base.hostname);
  const proximas = todas.filter((f) => f.date >= today && f.date <= hasta).sort((a, b) => a.date.localeCompare(b.date));
  const candidates: EventCandidate[] = [];
  const diagnosticos = new Map<string, number>();
  const anotar = (c: EventCandidate | null, code: string) => {
    c?.reasons.push(code);
    diagnosticos.set(code, (diagnosticos.get(code) || 0) + 1);
  };
  let parseFailures = 0;
  for (const [i, f] of proximas.entries()) {
    if (i >= tope) {
      anotar(null, 'DETAIL_BUDGET');
      continue;
    }
    let plazo = false;
    const ficha = await fetcher(f.url).catch((e) => {
      plazo = esPlazoAgotado(e);
      return null;
    });
    if (!ficha || ficha.status !== 200) {
      anotar(null, plazo ? 'DETAIL_DEADLINE' : ficha ? `DETAIL_HTTP_${ficha.status}` : 'DETAIL_NETWORK');
      continue;
    }
    const ld = eventoDeFicha(ficha.body);
    const cuando = ld && typeof ld.startDate === 'string' ? fechaHoraChile(ld.startDate) : null;
    if (!ld || typeof ld.name !== 'string' || !cuando) {
      parseFailures += 1;
      continue;
    }
    const coincide = cuando.date === f.date;
    const imagen = Array.isArray(ld.image) ? ld.image[0] : ld.image;
    const c = buildCandidate({
      sourceId: source.id,
      title: ld.name.replace(/\s+/g, ' ').trim(),
      date: cuando.date,
      time: cuando.time,
      venue: source.venueName || null,
      city: source.commune,
      detailUrl: f.url,
      imageUrl: typeof imagen === 'string' ? imagen : null,
      description: null,
      confidence: coincide ? 'high' : 'low',
      reasons: [
        'agenda propia del local en Evently',
        coincide ? 'la fecha de la URL coincide con schema.org/Event' : 'DATE_CONFLICT: la URL y la ficha no dicen el mismo día',
      ],
    });
    if (!c) {
      parseFailures += 1;
      continue;
    }
    let plazoTickets = false;
    const tickets = await fetcher(`${f.url}/tickets`).catch((e) => {
      plazoTickets = esPlazoAgotado(e);
      return null;
    });
    const precio = tickets && tickets.status === 200 ? precioDeTickets(tickets.body) : null;
    if (precio) {
      c.priceClp = precio.price;
      c.priceText = precio.text;
      c.disponibilidad = precio.disponibilidad;
    } else
      anotar(
        c,
        plazoTickets ? 'PRICE_DEADLINE' : tickets ? (tickets.status === 200 ? 'PRICE_NOT_FOUND' : `PRICE_HTTP_${tickets.status}`) : 'PRICE_NETWORK',
      );
    candidates.push(c);
  }
  return {
    itemsFound: todas.length,
    candidates,
    parseFailures,
    diagnostics: diagnosticos.size ? [...diagnosticos].map(([k, n]) => `${k}=${n}`) : undefined,
  };
}
