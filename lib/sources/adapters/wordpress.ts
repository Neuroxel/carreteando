import { toChileDateString } from '../../event-extraction';
import {
  buildCandidate,
  decodeEntities,
  parseCompactDate,
  parseIsoDateIn,
  parseSpanishDate,
  parseTime,
  stripTags,
} from '../normalize';
import { SourceError, type Adapter, type AdapterResult, type SourceDefinition } from '../types';
type WpMedia = {
  source_url?: string;
  media_details?: { sizes?: Record<string, { source_url?: string; width?: number }> };
};
type WpPost = {
  id?: number;
  slug?: string;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  meta?: Record<string, unknown>;
  date?: string;
  _embedded?: { 'wp:featuredmedia'?: WpMedia[] };
};
/**
 * El cartel oficial del evento, en un tamaño razonable para una tarjeta: bajar
 * el original de 4000px para mostrarlo a 300 es tirar el ancho de banda del
 * usuario. Algunos sitios ya publican la URL directa en un campo propio.
 */
function imagenOficial(post: WpPost): string | null {
  const meta = post.meta || {};
  for (const clave of ['imagen_evento', 'imagen', 'afiche']) {
    const valor = meta[clave];
    if (typeof valor === 'string' && /^https?:\/\//.test(valor)) return valor;
  }
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  if (!media) return null;
  const sizes = media.media_details?.sizes || {};
  const preferidos = ['medium_large', 'large', 'medium'];
  for (const nombre of preferidos) {
    const url = sizes[nombre]?.source_url;
    if (url) return url;
  }
  return media.source_url || null;
}
async function wpPosts(source: SourceDefinition, fetcher: Parameters<Adapter['run']>[1]) {
  const postType = source.config?.postType || 'posts';
  const perPage = source.config?.perPage || '30';
  // _embed trae la imagen destacada en la misma petición: una llamada por
  // fuente en vez de una por evento.
  const url = `${source.publicUrl.replace(/\/$/, '')}/wp-json/wp/v2/${postType}?per_page=${perPage}&orderby=date&order=desc&_embed=wp:featuredmedia`;
  const response = await fetcher(url);
  if (response.status !== 200) throw new SourceError(`HTTP_${response.status}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new SourceError('JSON_INVALIDO');
  }
  if (!Array.isArray(parsed)) throw new SourceError('RESPUESTA_INESPERADA');
  return parsed as WpPost[];
}
function titleOf(post: WpPost) {
  return decodeEntities(post.title?.rendered || '');
}
function textOf(post: WpPost) {
  return stripTags(`${post.excerpt?.rendered || ''} ${post.content?.rendered || ''}`);
}
/**
 * A WordPress custom post type that carries real event meta: a start date, an end
 * date and a time. This is the strongest shape a public site can give us, so it
 * is the only adapter allowed to claim high confidence.
 */
export const wpEventsList: Adapter = {
  id: 'wp-events-list',
  async run(source, fetcher): Promise<AdapterResult> {
    const posts = await wpPosts(source, fetcher);
    const today = toChileDateString();
    const candidates = [];
    let parseFailures = 0;
    for (const post of posts) {
      const meta = post.meta || {};
      const start = parseCompactDate(meta.fecha_de_inicio);
      const end = parseCompactDate(meta.fecha_de_termino) || start;
      const blurb = typeof meta.extracto_corto === 'string' ? meta.extracto_corto : '';
      if (!start) {
        parseFailures += 1;
        continue;
      }
      // A run that ended yesterday is not tonight's plan.
      const date = start >= today ? start : end && end >= today ? today : null;
      if (!date) continue;
      const time =
        parseTime(String(meta.hora_de_inicio || '')) || parseTime(blurb) || null;
      const detail =
        typeof meta.link_al_evento === 'string' && meta.link_al_evento
          ? meta.link_al_evento
          : post.link || source.publicUrl;
      const candidate = buildCandidate({
        sourceId: source.id,
        title: titleOf(post),
        date,
        time,
        venue: source.venueName || null,
        city: source.commune,
        detailUrl: detail,
        imageUrl: imagenOficial(post),
        description: blurb || textOf(post),
        confidence: 'high',
        reasons: ['fecha estructurada en la fuente oficial', 'lugar conocido'],
      });
      if (candidate) candidates.push(candidate);
      else parseFailures += 1;
    }
    return { itemsFound: posts.length, candidates, parseFailures };
  },
};
/**
 * A custom post type whose date lives in the slug or the title. Weaker than real
 * meta, strong enough to publish when the source speaks for a single venue.
 */
export const wpDatedSlug: Adapter = {
  id: 'wp-dated-slug',
  async run(source, fetcher): Promise<AdapterResult> {
    const posts = await wpPosts(source, fetcher);
    const today = toChileDateString();
    const candidates = [];
    let parseFailures = 0;
    for (const post of posts) {
      const title = titleOf(post);
      const fromSlug = parseIsoDateIn(post.slug || '');
      const fromTitle = parseSpanishDate(title, today);
      const date = fromSlug || fromTitle;
      if (!date) {
        parseFailures += 1;
        continue;
      }
      if (date < today) continue;
      const candidate = buildCandidate({
        sourceId: source.id,
        title,
        date,
        time: parseTime(textOf(post)),
        venue: source.venueName || null,
        city: source.commune,
        detailUrl: post.link || source.publicUrl,
        imageUrl: imagenOficial(post),
        description: textOf(post),
        // Two independent readings agreeing is what earns the extra confidence.
        confidence: fromSlug && fromTitle && fromSlug === fromTitle ? 'high' : 'medium',
        reasons: [
          fromSlug ? 'fecha en la dirección del evento' : 'fecha en el título',
          fromSlug && fromTitle && fromSlug === fromTitle ? 'título y enlace coinciden' : 'una sola lectura de fecha',
        ],
      });
      if (candidate) candidates.push(candidate);
      else parseFailures += 1;
    }
    return { itemsFound: posts.length, candidates, parseFailures };
  },
};
const NOCHE =
  /\b(fonda|ramada|fiesta|carrete|tocata|concierto|cumbia|cueca|karaoke|dj|noche|en vivo|bailable|peña|after)\b/i;
/**
 * Municipal news feeds are not calendars. They mention nightlife often enough to
 * be worth reading and are never precise enough to publish unreviewed.
 */
export const wpNewsScan: Adapter = {
  id: 'wp-news-scan',
  async run(source, fetcher): Promise<AdapterResult> {
    const posts = await wpPosts(source, fetcher);
    const today = toChileDateString();
    const candidates = [];
    let parseFailures = 0;
    for (const post of posts) {
      const title = titleOf(post);
      const body = textOf(post);
      const haystack = `${title} ${body}`;
      if (!NOCHE.test(haystack)) continue;
      const date = parseSpanishDate(haystack, today) || parseIsoDateIn(body);
      if (!date || date < today) {
        parseFailures += 1;
        continue;
      }
      const candidate = buildCandidate({
        sourceId: source.id,
        title,
        date,
        time: parseTime(haystack),
        venue: null,
        city: source.commune,
        detailUrl: post.link || source.publicUrl,
        imageUrl: imagenOficial(post),
        description: body,
        confidence: 'low',
        reasons: ['mención en comunicado municipal', 'fecha leída del texto, sin confirmar'],
      });
      if (candidate) candidates.push(candidate);
      else parseFailures += 1;
    }
    return { itemsFound: posts.length, candidates, parseFailures };
  },
};
