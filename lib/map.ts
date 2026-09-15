import type { Evento } from './types';
import type { Lugar } from './venues';
export type EstadoPunto = 'lugar' | 'evento' | 'fonda' | 'vivo';
export interface PuntoMapa {
  slug: string;
  nombre: string;
  ciudad: string;
  zona: string | null;
  tipo: string;
  tipoLabel: string;
  direccion: string | null;
  lat: number;
  lng: number;
  precision: 'exacta' | 'calle';
  instagram: string | null;
  estado: EstadoPunto;
  /** What is on tonight at this place, in the order a person would read it. */
  estaNoche: { titulo: string; hora: string | null; precio: string | null }[];
  proximos: number;
  vivo: string | null;
}
/**
 * Only places we can actually point at end up on the map. An event whose venue we
 * could not locate stays in the list rather than being dropped on the plaza.
 */
export function puntosDeMapa(
  lugares: Lugar[],
  eventos: Evento[],
  hoy: string,
  vivos: Record<string, string> = {},
): PuntoMapa[] {
  const porLugar = new Map<string, Evento[]>();
  for (const evento of eventos) {
    if (!evento.lugar) continue;
    const clave = normalizar(evento.lugar);
    const lista = porLugar.get(clave) || [];
    lista.push(evento);
    porLugar.set(clave, lista);
  }
  const puntos: PuntoMapa[] = [];
  for (const lugar of lugares) {
    if (lugar.lat === null || lugar.lng === null || !lugar.precision_mapa) continue;
    const suyos = (porLugar.get(normalizar(lugar.nombre)) || []).sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
    const estaNoche = suyos.filter((e) => e.fecha === hoy);
    const vivo = vivos[lugar.slug] || null;
    const hayFonda = estaNoche.some((e) => e.tipo === 'fonda');
    const estado: EstadoPunto = vivo
      ? 'vivo'
      : hayFonda
        ? 'fonda'
        : estaNoche.length
          ? 'evento'
          : 'lugar';
    puntos.push({
      slug: lugar.slug,
      nombre: lugar.nombre,
      ciudad: lugar.ciudad,
      zona: lugar.zona,
      tipo: lugar.tipo,
      tipoLabel: lugar.tipo_label,
      direccion: lugar.direccion,
      lat: lugar.lat,
      lng: lugar.lng,
      precision: lugar.precision_mapa,
      instagram: lugar.instagram_url,
      estado,
      estaNoche: estaNoche.slice(0, 3).map((e) => ({
        titulo: e.nombre,
        hora: e.hora || null,
        precio: e.precio_texto || null,
      })),
      proximos: suyos.filter((e) => e.fecha > hoy).length,
      vivo,
    });
  }
  return puntos;
}
export function normalizar(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
/** A bounding box that actually contains every point, with room to breathe. */
export function encuadre(puntos: PuntoMapa[]) {
  if (!puntos.length) return { lat: -33.045, lng: -71.62, zoom: 12 };
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    zoom: Math.max(...lats) - Math.min(...lats) > 0.2 ? 10 : 13,
  };
}
