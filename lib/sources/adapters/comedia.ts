import { addDays, toChileDateString } from '../../event-extraction';
import { buildCandidate, decodeEntities, stripTags } from '../normalize';
import { SourceError, type Adapter, type AdapterResult, type EventCandidate, type Fetcher } from '../types';
import { ciudadDe, ciudadEnTexto } from './jsonld';
import { HORIZONTE_DIAS } from './vesti';

const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const plano = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Curauma y Placilla son Valparaíso; el resto, las comunas cubiertas escritas en el texto. */
function ciudadComedia(texto: string) {
  if (/\b(curauma|placilla)\b/.test(plano(texto))) return 'Valparaíso';
  return ciudadEnTexto(texto);
}

// ─── ComedyPass (WooCommerce Store API pública) ─────────────────────────────

export const COMEDYPASS_API = 'https://comedypass.online/wp-json/wc/store/v1/products?category=39&per_page=100';
type ProductoWoo = {
  name?: unknown;
  permalink?: unknown;
  short_description?: unknown;
  prices?: { price?: unknown; currency_minor_unit?: unknown };
  images?: { src?: unknown }[];
  is_purchasable?: unknown;
  is_in_stock?: unknown;
};
/**
 * "PAOLA MOLINA 17 OCTUBRE 20:00 HRS. BARBONES CURAUMA – VALPARAISO."
 * Fecha y hora vienen escritas en hora de Chile en el título; `date_gmt` del
 * producto es la fecha de publicación en UTC y NO la del show, así que nunca
 * se usa. Sin año escrito: la próxima vez que caiga esa fecha.
 */
export function leerTituloComedyPass(titulo: string, today: string) {
  const t = decodeEntities(titulo).replace(/\s+/g, ' ').trim();
  const m = new RegExp(`^(.*?)\\s+(\\d{1,2})\\s+(?:de\\s+)?(${MESES.join('|')})\\s+(\\d{1,2})[:.](\\d{2})\\s*(?:hrs?\\.?)?\\s*(.*)$`, 'i').exec(t);
  if (!m) return null;
  const mes = MESES.indexOf(plano(m[3])) + 1;
  const dia = Number(m[2]);
  let anio = Number(today.slice(0, 4));
  const iso = (y: number) => `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  // Un título de ayer todavía puede estar en la tienda: no se lo manda al año siguiente.
  if (iso(anio) < addDays(today, -1)) anio += 1;
  const hora = `${String(Number(m[4])).padStart(2, '0')}:${m[5]}`;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const resto = m[6].replace(/[.\s]+$/, '');
  const [lugar, ciudadTexto] = resto.split(/\s+[–-]\s*|\s*-(?=[A-ZÁÉÍÓÚÑ])/).map((x) => x.trim());
  return { artista: m[1].trim(), date: iso(anio), time: hora, lugar: lugar || null, ciudad: ciudadComedia(`${resto} ${ciudadTexto || ''}`) };
}
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

export function leerComedyPass(json: unknown, source: { id: string }, today = toChileDateString()): AdapterResult {
  if (!Array.isArray(json)) throw new SourceError('PAGINA_INESPERADA');
  const hasta = addDays(today, HORIZONTE_DIAS);
  const candidates: EventCandidate[] = [];
  let parseFailures = 0;
  for (const p of json as ProductoWoo[]) {
    const nombre = typeof p.name === 'string' ? p.name : '';
    const t = leerTituloComedyPass(nombre, today);
    if (!t || typeof p.permalink !== 'string') {
      parseFailures += 1;
      continue;
    }
    if (!t.ciudad || t.date < today || t.date > hasta) continue;
    const descripcion = typeof p.short_description === 'string' ? stripTags(p.short_description) : '';
    // La descripción suele repetir "La cita es el 17 de octubre a las 20:00": si calza, la fecha se leyó dos veces.
    const dosLecturas = new RegExp(`\\b${Number(t.date.slice(8))}\\s+de\\s+${MESES[Number(t.date.slice(5, 7)) - 1]}`, 'i').test(plano(descripcion)) && descripcion.includes(t.time);
    const imagen = typeof p.images?.[0]?.src === 'string' ? (p.images[0].src as string) : null;
    const c = buildCandidate({
      sourceId: source.id,
      // Solo el artista: fecha, hora y lugar van en sus campos, no en el título visible.
      title: titulo(t.artista),
      date: t.date,
      time: t.time,
      venue: t.lugar ? titulo(t.lugar) : null,
      city: t.ciudad,
      detailUrl: p.permalink,
      // La misma imagen sin el proxy de WordPress.com: archivo del propio sitio.
      imageUrl: imagen ? imagen.replace(/^https:\/\/i\d\.wp\.com\//, 'https://').replace(/\?.*$/, '') : null,
      description: descripcion.slice(0, 400) || null,
      confidence: dosLecturas ? 'high' : 'medium',
      reasons: ['ticketera de comedia (API pública de la tienda)', dosLecturas ? 'título y descripción dicen la misma fecha y hora' : 'fecha solo en el título, sin año'],
    });
    if (!c) {
      parseFailures += 1;
      continue;
    }
    const precio = Number(p.prices?.price);
    // Solo se muestra el precio si la tienda deja comprar: un producto "no comprable"
    // puede conservar el precio de una preventa ya cerrada.
    if (p.is_purchasable === true && p.is_in_stock === true && Number.isInteger(precio) && precio >= 0 && p.prices?.currency_minor_unit === 0) {
      c.priceClp = precio;
      c.priceText = `Desde ${pesos(precio)} en ComedyPass`;
      c.disponibilidad = 'disponible';
    } else c.reasons.push(p.is_in_stock === false ? 'SOLD_OUT_OR_CLOSED' : 'PRICE_NOT_PURCHASABLE');
    candidates.push(c);
  }
  return { itemsFound: json.length, candidates, parseFailures };
}

export const comedyPassStore: Adapter = {
  id: 'comedypass-store',
  async run(source, fetcher, ctx) {
    if (source.publicUrl !== COMEDYPASS_API) throw new SourceError('HOST_NO_PERMITIDO');
    const r = await fetcher(COMEDYPASS_API);
    if (r.status !== 200) throw new SourceError(`HTTP_${r.status}`);
    let json: unknown;
    try {
      json = JSON.parse(r.body);
    } catch {
      throw new SourceError('PAGINA_INESPERADA');
    }
    return leerComedyPass(json, source, ctx?.today);
  },
};

// ─── ComediaTicket (API JSON pública del frontend) ──────────────────────────

export const COMEDIATICKET_API = 'https://backend.comediaticket.cl/api/v1/shop/events';
type Ticket = { name?: unknown; price?: unknown; quantity?: unknown; sold?: unknown; reserved?: unknown };
type Presentacion = { timeInit?: unknown; statusSale?: unknown; status?: unknown; tickets_presentation?: Ticket[] };
type EventoCT = {
  title?: unknown;
  dateEventInit?: unknown;
  imageMain?: unknown;
  slug?: unknown;
  status?: unknown;
  Establishments?: { name?: unknown; address?: unknown; Communes?: { name?: unknown }; Regiones?: { name?: unknown } };
  event_presentation?: Presentacion[];
};

/**
 * Cada función ("presentación") es una ocurrencia propia con su hora: Don
 * Carter a las 20:00 y a las 22:00 son dos eventos. La disponibilidad se
 * calcula con cantidad y vendidos; una función con la venta cerrada
 * (`statusSale` ≠ 1) no muestra precio.
 */
export function leerComediaTicket(json: unknown, source: { id: string }, today = toChileDateString()): AdapterResult {
  const lista = (json as { data?: unknown })?.data;
  if (!Array.isArray(lista)) throw new SourceError('PAGINA_INESPERADA');
  const hasta = addDays(today, HORIZONTE_DIAS);
  const candidates: EventCandidate[] = [];
  let parseFailures = 0;
  for (const e of lista as EventoCT[]) {
    const est = e.Establishments || {};
    const region = typeof est.Regiones?.name === 'string' ? est.Regiones.name : '';
    if (!/valpara/i.test(plano(region))) continue;
    const comuna = typeof est.Communes?.name === 'string' ? est.Communes.name : '';
    const ciudad = ciudadDe(comuna) || ciudadComedia(`${String(est.address || '')} ${comuna}`);
    const fecha = typeof e.dateEventInit === 'string' ? e.dateEventInit : '';
    const slug = typeof e.slug === 'string' && /^[a-z0-9_-]{3,200}$/.test(e.slug) ? e.slug : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || typeof e.title !== 'string' || !slug) {
      parseFailures += 1;
      continue;
    }
    if (!ciudad || fecha < today || fecha > hasta) continue;
    for (const p of e.event_presentation || []) {
      if (p.status !== 1) continue;
      const hora = typeof p.timeInit === 'string' ? p.timeInit.slice(0, 5) : null;
      const c = buildCandidate({
        sourceId: source.id,
        title: e.title.replace(/\s+/g, ' ').trim(),
        date: fecha,
        time: hora,
        venue: typeof est.name === 'string' ? est.name.trim() : null,
        city: ciudad,
        detailUrl: `https://www.comediaticket.cl/details/events_details/${slug}`,
        imageUrl: typeof e.imageMain === 'string' ? e.imageMain : null,
        description: null,
        confidence: 'high',
        reasons: ['ticketera de comedia (API pública)', 'fecha y hora de la función estructuradas'],
      });
      if (!c) {
        parseFailures += 1;
        continue;
      }
      const tiers = (p.tickets_presentation || [])
        .map((t) => ({ nombre: String(t.name || '').trim(), precio: Number(t.price), cupos: Number(t.quantity) - Number(t.sold) - Number(t.reserved || 0) }))
        .filter((t) => Number.isInteger(t.precio) && t.precio >= 0 && Number.isFinite(t.cupos));
      c.tiers = tiers.map((t) => ({ nombre: t.nombre, precio: t.precio, agotado: t.cupos <= 0 }));
      const vigentes = tiers.filter((t) => t.cupos > 0).sort((a, b) => a.precio - b.precio);
      if (p.statusSale !== 1) {
        // Venta cerrada: si además no queda cupo, está agotado; si queda, no se inventa por qué cerró.
        c.priceClp = null;
        c.priceText = vigentes.length ? 'Venta cerrada en ComediaTicket' : 'Agotado en ComediaTicket';
        if (!vigentes.length) c.disponibilidad = 'agotado';
        c.reasons.push(`SALE_STATUS_${String(p.statusSale)}`);
      } else if (vigentes.length) {
        c.priceClp = vigentes[0].precio;
        c.priceText = `Desde ${pesos(vigentes[0].precio)} en ComediaTicket`;
        c.disponibilidad = 'disponible';
      } else if (tiers.length) {
        c.priceClp = null;
        c.priceText = 'Agotado en ComediaTicket';
        c.disponibilidad = 'agotado';
      } else c.reasons.push('PRICE_NOT_FOUND');
      candidates.push(c);
    }
  }
  return { itemsFound: lista.length, candidates, parseFailures };
}

/** Paginado de 40 en 40, con tope: la API pide la cabecera `Country: cl`. */
export async function pedirComediaTicket(fetcher: Fetcher, maxPaginas = 8) {
  const todos: unknown[] = [];
  for (let n = 0; n < maxPaginas; n++) {
    const r = await fetcher(`${COMEDIATICKET_API}?limit=40&offset=${n * 40}`, { headers: { Country: 'cl' } });
    if (r.status !== 200) throw new SourceError(`HTTP_${r.status}`);
    let pagina: unknown;
    try {
      pagina = JSON.parse(r.body);
    } catch {
      throw new SourceError('PAGINA_INESPERADA');
    }
    const datos = (pagina as { data?: unknown })?.data;
    if (!Array.isArray(datos)) throw new SourceError('PAGINA_INESPERADA');
    todos.push(...datos);
    if (datos.length < 40) break;
  }
  return { data: todos };
}

export const comediaTicketApi: Adapter = {
  id: 'comediaticket-api',
  async run(source, fetcher, ctx) {
    if (source.publicUrl !== COMEDIATICKET_API) throw new SourceError('HOST_NO_PERMITIDO');
    return leerComediaTicket(await pedirComediaTicket(fetcher), source, ctx?.today);
  },
};
