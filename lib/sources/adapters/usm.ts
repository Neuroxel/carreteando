import { toChileDateString } from '../../event-extraction';
import { buildCandidate, decodeEntities, stripTags } from '../normalize';
import { SourceError, type Adapter, type AdapterResult } from '../types';
type UsmPost = {
  link?: string;
  title?: { rendered?: string };
  acf?: {
    datos_evento?: {
      titulo_evento?: string;
      fecha_evento?: string | null;
      fecha_termino?: string | null;
      hora_inicio_evento?: string | null;
      hora_termino_evento?: string | null;
      descripcion_actividad_2?: string | null;
    };
    datos_organizador?: { campus_sede?: string | null; modalidad?: string | null; direccion_unidad?: string | null };
  };
};
/** Solo los campus de la región: Casa Central (Valparaíso) y la sede de Viña. */
export function campusRegional(campus: string) {
  const c = campus.toLowerCase();
  if (c.includes('viña') || c.includes('vina')) return 'Viña del Mar';
  if (c.includes('casa central') || c.includes('valpara')) return 'Valparaíso';
  return null;
}
function fechaUnix(value: string | null | undefined) {
  if (!value || !/^\d{9,11}$/.test(value)) return null;
  // ACF guarda la medianoche UTC del día elegido: el día es el de UTC.
  return new Date(Number(value) * 1000).toISOString().slice(0, 10);
}
/**
 * El calendario de la USM es estructurado (ACF) pero casi todo es vida
 * académica: talleres a mediodía, seminarios, ceremonias, y la mitad ocurre en
 * Santiago. Se filtra por campus y luego pasa por el clasificador de
 * relevancia; lo que queda va a revisión, nunca directo.
 */
export const usmEventos: Adapter = {
  id: 'usm-eventos',
  async run(source, fetcher): Promise<AdapterResult> {
    const today = toChileDateString();
    const url = `${source.publicUrl.replace(/\/$/, '')}/wp-json/wp/v2/eventos?per_page=50&_fields=link,title,acf`;
    const response = await fetcher(url);
    if (response.status !== 200) throw new SourceError(`HTTP_${response.status}`);
    let posts: UsmPost[];
    try {
      posts = JSON.parse(response.body);
    } catch {
      throw new SourceError('JSON_INVALIDO');
    }
    if (!Array.isArray(posts)) throw new SourceError('RESPUESTA_INESPERADA');
    const candidates = [];
    let parseFailures = 0;
    for (const post of posts) {
      const datos = post.acf?.datos_evento;
      const org = post.acf?.datos_organizador;
      const date = fechaUnix(datos?.fecha_evento);
      if (!datos || !date) {
        parseFailures += 1;
        continue;
      }
      if (date < today) continue;
      const city = campusRegional(org?.campus_sede || '');
      if (!city) continue; // Santiago, Concepción, online: no es nuestra cartelera.
      if ((org?.modalidad || '').toLowerCase() === 'online') continue;
      const hora = (datos.hora_inicio_evento || '').slice(0, 5) || null;
      const candidate = buildCandidate({
        sourceId: source.id,
        title: decodeEntities(datos.titulo_evento || post.title?.rendered || ''),
        date,
        time: hora,
        venue: org?.campus_sede ? `USM ${org.campus_sede}` : 'Universidad Técnica Federico Santa María',
        city,
        detailUrl: post.link || source.publicUrl,
        imageUrl: null,
        description: stripTags(datos.descripcion_actividad_2 || ''),
        confidence: 'medium',
        reasons: ['calendario oficial de la universidad', `campus: ${org?.campus_sede}`],
      });
      if (!candidate) {
        parseFailures += 1;
        continue;
      }
      candidate.endTime = (datos.hora_termino_evento || '').slice(0, 5) || null;
      candidates.push(candidate);
    }
    return { itemsFound: posts.length, candidates, parseFailures };
  },
};
