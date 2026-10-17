import catalogo from '../data/catalogo-publico.json';
import { addDays } from './event-extraction';
import { SOURCES } from './sources/registry';
import type { SourceDefinition } from './sources/types';
import { RUTAS_LOCALES, type Acceso, type RutasLocal, type TipoRuta } from './venue-routes';

/**
 * Cobertura comprobable por local y día. No cuenta eventos: dice qué rutas de
 * cada local se revisaron, cuándo, con qué resultado y qué quedó bloqueado.
 * Un local solo queda "sin anuncio" si TODAS sus rutas se leyeron vacías; un
 * bloqueo o una revisión vencida lo deja pendiente, nunca "sin eventos".
 */
export type EstadoRuta = 'FOUND' | 'ROUTE_EMPTY' | 'BLOCKED' | 'ERROR' | 'PENDING';
export type EstadoLocal = 'FOUND' | 'NO_ANNOUNCEMENT_FOUND' | 'BLOCKED' | 'PENDING';
export interface EstadoFuente {
  revisadaEn: string | null;
  ok: boolean;
  error: string | null;
  /** Fechas anunciadas por la fuente (Chile), de cualquier estado del evento. */
  fechas: string[];
}
interface RutaCompleta {
  tipo: TipoRuta;
  url: string;
  acceso: Acceso;
  fuenteId: string | null;
  nota?: string;
}
export interface ChequeoRuta extends RutaCompleta {
  estado: EstadoRuta;
  motivo: string | null;
  revisadaEn: string | null;
  fechas: string[];
}
export interface CoberturaLocal {
  slug: string;
  nombre: string;
  comuna: string;
  estado: EstadoLocal;
  fechas: string[];
  rutas: ChequeoRuta[];
}
export interface ReporteCobertura {
  hoy: string;
  hasta: string;
  locales: CoberturaLocal[];
  porDia: Record<string, string[]>;
  resumen: Record<EstadoLocal, number> & { locales: number; sinRutas: number; rutas: number; rutasBloqueadas: number; rutasPendientes: number };
}

const TIPO_ADAPTADOR: Record<string, TipoRuta> = {
  'portaldisc-cartelera': 'portaldisc_cartelera',
  'vesti-company': 'vesti_company',
  'evently-agenda': 'evently_agenda',
};

/** Rutas del archivo más las fuentes del registro que hablan por un solo local. */
export function rutasPorLocal(fuentes: SourceDefinition[] = SOURCES, locales: RutasLocal[] = RUTAS_LOCALES) {
  const mapa = new Map<string, { nombre: string; comuna: string; rutas: RutaCompleta[] }>();
  const porUrl = new Map(fuentes.map((f) => [f.publicUrl, f]));
  const agregar = (slug: string, nombre: string, comuna: string, r: RutaCompleta) => {
    const l = mapa.get(slug) || { nombre, comuna, rutas: [] };
    if (!l.rutas.some((x) => x.url === r.url)) l.rutas.push(r);
    mapa.set(slug, l);
  };
  for (const l of locales)
    for (const r of l.rutas)
      agregar(l.slug, l.nombre, l.comuna, {
        tipo: r.tipo,
        url: r.url,
        acceso: r.acceso,
        fuenteId: r.acceso === 'auto' ? porUrl.get(r.url)?.id ?? null : null,
        nota: r.nota,
      });
  for (const f of fuentes)
    if (f.venueSlug)
      agregar(f.venueSlug, f.venueName || f.name, f.commune, {
        tipo: TIPO_ADAPTADOR[f.adapter] || 'sitio_oficial',
        url: f.publicUrl,
        acceso: f.accessMode === 'blocked' ? 'bloqueado' : f.accessMode === 'manual' ? 'manual' : 'auto',
        fuenteId: f.id,
      });
  return mapa;
}

export function reporteCobertura(
  estados: Map<string, EstadoFuente>,
  hoy: string,
  opciones: {
    dias?: number;
    vigenciaHoras?: number;
    ahora?: Date;
    fuentes?: SourceDefinition[];
    locales?: RutasLocal[];
    /** El universo a cubrir: un local sin rutas cuenta como pendiente, nunca se omite. */
    catalogo?: { slug: string; nombre: string; comuna: string }[];
  } = {},
): ReporteCobertura {
  const hasta = addDays(hoy, (opciones.dias ?? 7) - 1);
  const ahora = (opciones.ahora ?? new Date()).getTime();
  const vigencia = (opciones.vigenciaHoras ?? 48) * 3600_000;
  const locales: CoberturaLocal[] = [];
  const porDia: Record<string, string[]> = {};
  let rutas = 0;
  let rutasBloqueadas = 0;
  let rutasPendientes = 0;
  const conRutas = rutasPorLocal(opciones.fuentes, opciones.locales);
  for (const c of opciones.catalogo ?? catalogo.locales)
    if (!conRutas.has(c.slug)) conRutas.set(c.slug, { nombre: c.nombre, comuna: c.comuna, rutas: [] });
  for (const [slug, l] of conRutas) {
    const chequeos: ChequeoRuta[] = l.rutas.map((r) => {
      rutas += 1;
      if (r.acceso !== 'auto') {
        rutasBloqueadas += 1;
        return { ...r, estado: 'BLOCKED', motivo: r.nota || r.acceso, revisadaEn: null, fechas: [] };
      }
      const e = r.fuenteId ? estados.get(r.fuenteId) : undefined;
      if (!e || !e.revisadaEn || ahora - Date.parse(e.revisadaEn) > vigencia) {
        rutasPendientes += 1;
        return { ...r, estado: 'PENDING', motivo: e?.revisadaEn ? 'revisión vencida' : 'aún no revisada', revisadaEn: e?.revisadaEn ?? null, fechas: [] };
      }
      if (!e.ok) {
        rutasPendientes += 1;
        return { ...r, estado: 'ERROR', motivo: e.error || 'error', revisadaEn: e.revisadaEn, fechas: [] };
      }
      const fechas = e.fechas.filter((d) => d >= hoy && d <= hasta);
      return { ...r, estado: fechas.length ? 'FOUND' : 'ROUTE_EMPTY', motivo: null, revisadaEn: e.revisadaEn, fechas };
    });
    const fechas = [...new Set(chequeos.flatMap((c) => c.fechas))].sort();
    const estado: EstadoLocal = fechas.length
      ? 'FOUND'
      : !chequeos.length
        ? 'PENDING'
        : chequeos.every((c) => c.estado === 'ROUTE_EMPTY')
        ? 'NO_ANNOUNCEMENT_FOUND'
        : chequeos.every((c) => c.estado === 'ROUTE_EMPTY' || c.estado === 'BLOCKED')
          ? 'BLOCKED'
          : 'PENDING';
    for (const d of fechas) (porDia[d] ||= []).push(slug);
    locales.push({ slug, nombre: l.nombre, comuna: l.comuna, estado, fechas, rutas: chequeos });
  }
  locales.sort((a, b) => a.comuna.localeCompare(b.comuna) || a.slug.localeCompare(b.slug));
  const cuenta = (e: EstadoLocal) => locales.filter((l) => l.estado === e).length;
  return {
    hoy,
    hasta,
    locales,
    porDia,
    resumen: {
      locales: locales.length,
      sinRutas: locales.filter((l) => !l.rutas.length).length,
      rutas,
      rutasBloqueadas,
      rutasPendientes,
      FOUND: cuenta('FOUND'),
      NO_ANNOUNCEMENT_FOUND: cuenta('NO_ANNOUNCEMENT_FOUND'),
      BLOCKED: cuenta('BLOCKED'),
      PENDING: cuenta('PENDING'),
    },
  };
}

type Db = { from: (table: string) => any };
/**
 * Estado de cada fuente: lo leído en esta corrida manda; para las demás, la
 * última revisión registrada y las fechas de sus eventos en la base (todos
 * los estados). Solo lectura.
 */
export async function estadosDeFuentes(
  db: Db,
  hoy: string,
  dias: number,
  recientes: { sourceId: string; ok: boolean; error: string | null; fechas: string[] }[],
  ahora = new Date(),
) {
  const estados = new Map<string, EstadoFuente>();
  const { data: filas } = await db.from('event_sources').select('id,last_checked_at,last_error');
  const { data: eventos } = await db
    .from('events')
    .select('source_id,date_text')
    .not('source_id', 'is', null)
    .gte('date_text', hoy)
    .lte('date_text', addDays(hoy, dias - 1))
    .limit(5000);
  const fechas = new Map<string, Set<string>>();
  for (const e of (eventos || []) as { source_id: string; date_text: string }[]) {
    const s = fechas.get(e.source_id) || new Set<string>();
    s.add(e.date_text);
    fechas.set(e.source_id, s);
  }
  for (const f of (filas || []) as { id: string; last_checked_at: string | null; last_error: string | null }[])
    estados.set(f.id, { revisadaEn: f.last_checked_at, ok: !f.last_error, error: f.last_error, fechas: [...(fechas.get(f.id) || [])] });
  for (const r of recientes)
    estados.set(r.sourceId, {
      revisadaEn: ahora.toISOString(),
      ok: r.ok,
      error: r.error,
      fechas: [...new Set([...r.fechas, ...(fechas.get(r.sourceId) || [])])],
    });
  return estados;
}
