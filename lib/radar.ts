/**
 * Radar: cuentas de cercanía que corren solo en el teléfono. La posición de
 * quien mira nunca sale del navegador: no se manda, no se guarda, no se loguea.
 */
export interface Posicion {
  lat: number;
  lng: number;
}

/** Distancia en línea recta (haversine), en km. No es la distancia caminando. */
export function distanciaKm(a: Posicion, b: Posicion) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m" o "4,2 km": lo justo para decidir si se camina. */
export function textoDistancia(km: number) {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

/** Los más cercanos primero; no modifica la lista original. */
export function porCercania<T extends Posicion>(lista: T[], yo: Posicion) {
  return lista
    .map((p) => ({ punto: p, km: distanciaKm(yo, p) }))
    .sort((a, b) => a.km - b.km);
}

/**
 * ¿Centrar el mapa en la persona? Sí, cada vez que el mapa se arma con su
 * posición, salvo que ya lo haya movido con la mano, y solo si hay algo a
 * menos de 30 km (fuera de la región no sirve).
 */
export function debeCentrar(yo: Posicion | null, puntos: Posicion[], movidoPorPersona: boolean) {
  return Boolean(yo) && !movidoPorPersona && puntos.some((p) => distanciaKm(yo as Posicion, p) < 30);
}

export type Capa = 'hoy' | 'lugares';
/** El radar abre en "Carretes hoy"; "Lugares" muestra todos. `boliches` se acepta por enlaces viejos. */
export const leerCapa = (valor: string | null): Capa => (valor === 'lugares' || valor === 'boliches' ? 'lugares' : 'hoy');

/** Precisión gruesa a propósito: alcanza para ordenar por cercanía. */
export const OPCIONES_GPS: PositionOptions = { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 12_000 };
/** Si la persona dijo que no, no se vuelve a preguntar solo (solo con el botón). */
export const CLAVE_GPS_NEGADO = 'radar-ubicacion-negada';
