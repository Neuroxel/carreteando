/**
 * Territorios: Región → Comuna → Sector → Barrio. Solo nombres y polígonos
 * verificados contra la fuente oficial (`data/territorios.json`, geometrías en
 * `public/territorios.geojson`). Hoy: cerros y sectores de Valparaíso (SIG
 * municipal). Todo el cálculo con la ubicación de quien mira corre en el
 * teléfono; nada se manda al servidor.
 */
import indice from '../data/territorios.json';
import lugares from '../data/lugares-territorio.json';
import type { Posicion } from './radar';

export type NivelTerritorio = 'comuna' | 'sector' | 'barrio';
export interface Territorio {
  id: string;
  slug: string;
  nombre: string;
  comuna: string;
  nivel: NivelTerritorio;
  parent: string | null;
  aliases: string[];
  centroide?: [number, number];
  source: string;
  source_type: string;
  source_url: string | null;
  verified_at: string;
}
type Anillo = [number, number][];
export type Geometria = { type: 'Polygon'; coordinates: Anillo[] } | { type: 'MultiPolygon'; coordinates: Anillo[][] };
export interface TerritorioGeo {
  type: 'Feature';
  properties: Territorio;
  geometry: Geometria;
}

export const TERRITORIOS = (indice as { territorios: Territorio[] }).territorios;
export const RUTA_GEOMETRIAS = '/territorios.geojson';
const PROFUNDIDAD: Record<NivelTerritorio, number> = { comuna: 0, sector: 1, barrio: 2 };

export const territorioPorSlug = (slug: string | null | undefined) => (slug ? TERRITORIOS.find((t) => t.slug === slug) || null : null);
/** Sectores y barrios verificados de una comuna, por nombre. */
export const zonasDeComuna = (comuna: string) =>
  TERRITORIOS.filter((t) => t.comuna === comuna && t.nivel !== 'comuna').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

/** Sector verificado de un lugar del catálogo, o null si no hay uno seguro. */
const SECTOR_LUGAR = (lugares as { lugares: Record<string, { sector: string }> }).lugares;
export const sectorDeLugar = (slug: string | null | undefined) => (slug ? SECTOR_LUGAR[slug]?.sector || null : null);

function enAnillo(x: number, y: number, r: Anillo) {
  let dentro = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
/** Punto (lng/lat) dentro de un polígono, respetando huecos. */
export function enGeometria(p: Posicion, g: Geometria) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.some((anillos) => enAnillo(p.lng, p.lat, anillos[0]) && !anillos.slice(1).some((h) => enAnillo(p.lng, p.lat, h)));
}
/** El territorio más específico que contiene el punto (barrio > sector > comuna). */
export function territorioDe(p: Posicion, geos: TerritorioGeo[]): Territorio | null {
  let mejor: Territorio | null = null;
  for (const f of geos)
    if (enGeometria(p, f.geometry) && (!mejor || PROFUNDIDAD[f.properties.nivel] > PROFUNDIDAD[mejor.nivel])) mejor = f.properties;
  return mejor;
}
/** Una zona en la URL vale solo si existe y es de la comuna elegida. */
export function zonaValida(zona: string | null | undefined, ciudad: string | null | undefined) {
  const t = territorioPorSlug(zona);
  return t && t.nivel !== 'comuna' && t.comuna === ciudad ? t.slug : null;
}
