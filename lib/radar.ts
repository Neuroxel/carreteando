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

/**
 * Ubicación en dos fases, sin seguimiento permanente:
 * 1. un primer punto rápido (puede ser grueso) para mostrar algo al tiro;
 * 2. una ventana corta de alta precisión con watchPosition que acepta mejoras
 *    y se cierra sola al llegar a una precisión útil o al vencer el plazo.
 * Todo queda en el teléfono: nada de esto se manda al servidor.
 */
export const GPS_RAPIDO: PositionOptions = { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 };
export const GPS_PRECISO: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 };
/** Precisión suficiente para saber el sector o barrio, en metros. */
export const PRECISION_UTIL_M = 100;
/** Duración máxima de la ventana de alta precisión. */
export const VENTANA_PRECISA_MS = 18_000;
/** Radio inicial de "Cerca de mí", en km; se puede ampliar. */
export const RADIOS_KM = [10, 25] as const;

export interface Fix extends Posicion {
  accuracy: number;
  timestamp: number;
}
export type EstadoGps = 'idle' | 'buscando' | 'precisa' | 'aproximada' | 'negado' | 'no_disponible' | 'timeout' | 'sin_soporte';
type Geo = Pick<Geolocation, 'getCurrentPosition' | 'watchPosition' | 'clearWatch'>;

const fixDe = (p: GeolocationPosition): Fix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  timestamp: p.timestamp,
});
export const calidad = (f: Fix): 'precisa' | 'aproximada' => (f.accuracy <= PRECISION_UTIL_M ? 'precisa' : 'aproximada');
const errorAEstado = (e: GeolocationPositionError): EstadoGps =>
  e.code === 1 ? 'negado' : e.code === 3 ? 'timeout' : 'no_disponible';

/**
 * Ubica en dos fases. `aviso` recibe cada mejora (nunca una peor) y el estado.
 * Devuelve una función para cortar antes; siempre termina con clearWatch.
 */
export function ubicarEnDosFases(
  geo: Geo,
  aviso: (estado: EstadoGps, fix: Fix | null) => void,
  reloj: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = globalThis,
) {
  let mejor: Fix | null = null;
  let id: number | null = null;
  let plazo: ReturnType<typeof setTimeout> | null = null;
  let terminado = false;
  const cerrar = () => {
    if (terminado) return;
    terminado = true;
    if (id !== null) geo.clearWatch(id);
    if (plazo !== null) reloj.clearTimeout(plazo);
  };
  const aceptar = (f: Fix) => {
    if (terminado || (mejor && f.accuracy >= mejor.accuracy)) return;
    mejor = f;
    aviso(calidad(f), f);
    if (f.accuracy <= PRECISION_UTIL_M) cerrar();
  };
  aviso('buscando', null);
  geo.getCurrentPosition(
    (p) => aceptar(fixDe(p)),
    (e) => {
      // Sin permiso no tiene sentido abrir la ventana precisa.
      if (e.code === 1) {
        cerrar();
        aviso('negado', null);
      }
    },
    GPS_RAPIDO,
  );
  id = geo.watchPosition(
    (p) => aceptar(fixDe(p)),
    (e) => {
      if (terminado) return;
      if (e.code === 1 || !mejor) {
        cerrar();
        aviso(errorAEstado(e), null);
      }
    },
    GPS_PRECISO,
  );
  plazo = reloj.setTimeout(() => {
    if (terminado) return;
    cerrar();
    // Al vencer, se queda con lo mejor que llegó; sin nada, es un timeout.
    aviso(mejor ? calidad(mejor) : 'timeout', mejor);
  }, VENTANA_PRECISA_MS);
  return cerrar;
}

/** Clave vieja de una "negación propia": ya no se usa; manda el permiso real del navegador. */
export const CLAVE_GPS_NEGADO_VIEJA = 'radar-ubicacion-negada';
