/**
 * Adaptador de entrada de inclinación: una sola fuente activa a la vez, y
 * siempre sabe de dónde vienen los datos.
 *
 * - ORIENTATION: `deviceorientation` con beta/gamma numéricos.
 * - MOTION_ACCELEROMETER: `devicemotion` → `accelerationIncludingGravity`
 *   (el vector de gravedad). Solo necesita acelerómetro: funciona en teléfonos
 *   Android sin giroscopio, donde Chrome entrega `deviceorientation` con
 *   beta/gamma nulos. Es el mismo camino que usa la calculadora 3D de Carlos.
 * - DEBUG_SIMULATION: los deslizadores de ?3ddebug=1.
 * - NONE.
 *
 * Se escuchan los dos eventos reales a la vez. Gana el primero que entrega
 * números; si ambos los entregan se prefiere la orientación (más suave). Si la
 * orientación deja de entregar números y el acelerómetro sí, se cambia sola.
 * Un permiso "concedido" sin muestras nunca se informa como activo.
 *
 * Calibración: la postura con que se toma el teléfono al llegar las primeras
 * muestras es el cero. No se recentra solo: una inclinación sostenida se
 * mantiene. `recalibrar()` fija un cero nuevo.
 */
export type Fuente = 'ORIENTATION' | 'MOTION_ACCELEROMETER' | 'DEBUG_SIMULATION' | 'NONE';
export type EstadoSensor = 'apagado' | 'esperando' | 'recibiendo' | 'sin-datos';
export type Lectura = {
  fuente: Fuente;
  estado: EstadoSensor;
  /** muestras válidas por segundo de la fuente activa */
  hz: number;
  /** aceleración con gravedad, m/s² (solo acelerómetro) */
  crudo: { x: number; y: number; z: number } | null;
  /** grados: medidos (orientación) o derivados del vector de gravedad */
  beta: number | null;
  gamma: number | null;
  /** inclinación normalizada respecto del cero, -1..1 */
  tilt: { x: number; y: number };
  eventos: { orientacion: number; orientacionNula: number; movimiento: number; movimientoNulo: number };
  permiso: 'no-aplica' | 'pendiente' | 'concedido' | 'denegado';
};

const ZONA_MUERTA = 0.8; // grados
const ESCALA = 10; // grados para el desplazamiento máximo: 10° se ve claro
const ESPERA_MUESTRAS = 1500; // ms sin números válidos → "sin-datos"
const SUAVIZADO = 0.25; // filtro de paso bajo del acelerómetro (ruido de la mano)

type Oyente = (l: Lectura) => void;

const L: Lectura = {
  fuente: 'NONE',
  estado: 'apagado',
  hz: 0,
  crudo: null,
  beta: null,
  gamma: null,
  tilt: { x: 0, y: 0 },
  eventos: { orientacion: 0, orientacionNula: 0, movimiento: 0, movimientoNulo: 0 },
  permiso: 'no-aplica',
};
const oyentes = new Set<Oyente>();
let escuchando = false;
let cero: { b: number; g: number } | null = null;
let acumulado: { b: number; g: number; n: number } | null = null;
const ultimaValida = { ORIENTATION: 0, MOTION_ACCELEROMETER: 0 };
let marcas: number[] = [];
let gravedad: { x: number; y: number; z: number } | null = null;
let invertir: boolean | null = null; // iOS entrega el vector de gravedad con el signo opuesto
let temporizador = 0;

const real = (f: Fuente) => f === 'ORIENTATION' || f === 'MOTION_ACCELEROMETER';

function emitir() {
  for (const o of oyentes) o(L);
}

const conZona = (v: number) => {
  const a = Math.abs(v);
  if (a < ZONA_MUERTA) return 0;
  return (Math.sign(v) * Math.min(a - ZONA_MUERTA, ESCALA)) / ESCALA;
};

/** Ajusta a la rotación de pantalla: "derecha" siempre es la derecha de quien mira. */
function aPantalla(beta: number, gamma: number): [number, number] {
  const angulo = (typeof screen !== 'undefined' && screen.orientation?.angle) || 0;
  if (angulo === 90) return [-gamma, beta];
  if (angulo === 270) return [gamma, -beta];
  return [beta, gamma];
}

function aplicar(fuente: 'ORIENTATION' | 'MOTION_ACCELEROMETER', beta: number, gamma: number) {
  const ahora = performance.now();
  ultimaValida[fuente] = ahora;
  // Elegir fuente: gana la orientación si entrega números; el acelerómetro
  // toma el control si es lo único que llega.
  if (L.fuente !== fuente) {
    const otraViva = ahora - ultimaValida[fuente === 'ORIENTATION' ? 'MOTION_ACCELEROMETER' : 'ORIENTATION'] < 400;
    const cambiar = fuente === 'ORIENTATION' || !real(L.fuente) || !otraViva;
    if (!cambiar) return;
    L.fuente = fuente;
    cero = null;
    acumulado = null;
    marcas = [];
  }
  marcas.push(ahora);
  while (marcas.length && ahora - marcas[0] > 1000) marcas.shift();
  L.hz = marcas.length;
  const [b, g] = aPantalla(beta, gamma);
  L.beta = Math.round(b * 10) / 10;
  L.gamma = Math.round(g * 10) / 10;
  // Cero: promedio de las primeras muestras (la postura natural de la mano).
  if (!cero) {
    acumulado = acumulado ? { b: acumulado.b + b, g: acumulado.g + g, n: acumulado.n + 1 } : { b, g, n: 1 };
    if (acumulado.n >= 5) cero = { b: acumulado.b / acumulado.n, g: acumulado.g / acumulado.n };
    else return;
  }
  L.tilt = { x: conZona(g - cero.g), y: conZona(b - cero.b) };
  if (L.estado !== 'recibiendo') {
    L.estado = 'recibiendo';
    if (L.permiso === 'pendiente') L.permiso = 'concedido';
  }
  emitir();
}

function alOrientar(e: DeviceOrientationEvent) {
  if (typeof e.beta !== 'number' || typeof e.gamma !== 'number' || Number.isNaN(e.beta) || Number.isNaN(e.gamma)) {
    L.eventos.orientacionNula++;
    return;
  }
  L.eventos.orientacion++;
  aplicar('ORIENTATION', e.beta, e.gamma);
}

function alMover(e: DeviceMotionEvent) {
  const a = e.accelerationIncludingGravity;
  if (!a || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.z !== 'number') {
    L.eventos.movimientoNulo++;
    return;
  }
  L.eventos.movimiento++;
  const v = { x: a.x, y: a.y, z: a.z };
  gravedad = gravedad
    ? {
        x: gravedad.x + (v.x - gravedad.x) * SUAVIZADO,
        y: gravedad.y + (v.y - gravedad.y) * SUAVIZADO,
        z: gravedad.z + (v.z - gravedad.z) * SUAVIZADO,
      }
    : v;
  L.crudo = { x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, z: Math.round(v.z * 100) / 100 };
  // Convención W3C: boca arriba z ≈ +9,8 y de pie y ≈ +9,8. iOS lo entrega al
  // revés; en cualquier postura normal de lectura y + z es positivo, así que
  // la primera lectura decide el signo.
  if (invertir === null) invertir = gravedad.y + gravedad.z < 0;
  const s = invertir ? -1 : 1;
  const x = gravedad.x * s;
  const y = gravedad.y * s;
  const z = gravedad.z * s;
  const beta = (Math.atan2(y, z) * 180) / Math.PI;
  const gamma = (Math.atan2(-x, Math.hypot(y, z)) * 180) / Math.PI;
  aplicar('MOTION_ACCELEROMETER', beta, gamma);
}

function vigilar() {
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => {
    if (L.estado === 'esperando') {
      L.estado = 'sin-datos';
      emitir();
    }
  }, ESPERA_MUESTRAS);
}

/**
 * Empieza a escuchar sensores reales, en silencio. Android entrega
 * `devicemotion` sin permiso; iOS no entrega nada hasta que se pide permiso, y
 * para un adorno no se interrumpe al usuario: ahí el afiche queda estático.
 */
/**
 * Movimiento con el teléfono: SOLO si la persona lo activó con un toque explícito
 * (pie de página, o el botón de ?3ddebug=1). Nunca se escucha en silencio y nunca
 * es requisito para buscar.
 */
export const CLAVE_MOVIMIENTO = 'dondesalgo-movimiento';
export function movimientoPermitido() {
  try {
    return localStorage.getItem(CLAVE_MOVIMIENTO) === '1';
  } catch {
    return false;
  }
}
export function apagarMovimiento() {
  try {
    localStorage.removeItem(CLAVE_MOVIMIENTO);
  } catch {
    /* sin almacenamiento */
  }
  if (typeof window !== 'undefined' && escuchando) {
    window.removeEventListener('deviceorientation', alOrientar);
    window.removeEventListener('devicemotion', alMover);
    escuchando = false;
  }
}
export function iniciarSensores() {
  if (typeof window === 'undefined' || !movimientoPermitido()) return;
  if (!escuchando) {
    escuchando = true;
    window.addEventListener('deviceorientation', alOrientar, { passive: true });
    window.addEventListener('devicemotion', alMover, { passive: true });
  }
  if (L.estado === 'apagado' || L.estado === 'sin-datos') {
    L.estado = 'esperando';
    vigilar();
  }
  emitir();
}

type ConPermiso = { requestPermission?: () => Promise<string> };
/** iOS pide permiso por separado para movimiento y orientación. */
export function requierePermiso() {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { DeviceMotionEvent?: ConPermiso; DeviceOrientationEvent?: ConPermiso };
  return typeof w.DeviceMotionEvent?.requestPermission === 'function' || typeof w.DeviceOrientationEvent?.requestPermission === 'function';
}

/**
 * Llamar directo dentro del toque (iOS exige el gesto). Pide movimiento y
 * orientación en el mismo gesto y empieza a escuchar pase lo que pase: lo que
 * cuenta es si llegan muestras, no lo que dice el permiso.
 */
export function pedirPermiso(): Promise<void> {
  // Este toque ES el consentimiento explícito.
  try {
    localStorage.setItem(CLAVE_MOVIMIENTO, '1');
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
  const w = window as unknown as { DeviceMotionEvent?: ConPermiso; DeviceOrientationEvent?: ConPermiso };
  const pedidos = [w.DeviceMotionEvent, w.DeviceOrientationEvent]
    .filter((c): c is ConPermiso & { requestPermission: () => Promise<string> } => typeof c?.requestPermission === 'function')
    .map((c) => c.requestPermission().catch(() => 'denied'));
  if (pedidos.length) L.permiso = 'pendiente';
  iniciarSensores();
  return Promise.all(pedidos).then((r) => {
    if (r.length) L.permiso = r.some((x) => x === 'granted') ? (L.estado === 'recibiendo' ? 'concedido' : 'pendiente') : 'denegado';
    if (L.permiso === 'denegado') {
      L.estado = 'sin-datos';
      window.clearTimeout(temporizador);
    } else if (L.estado !== 'recibiendo') vigilar();
    emitir();
  });
}

/** El cero pasa a ser la postura actual. */
export function recalibrar() {
  cero = null;
  acumulado = null;
  invertir = null;
  gravedad = null;
}

/** QA: inclinación sintética en grados. Nunca se informa como sensor real. */
export function simular(beta: number, gamma: number) {
  L.fuente = 'DEBUG_SIMULATION';
  L.beta = beta;
  L.gamma = gamma;
  L.tilt = { x: conZona(gamma), y: conZona(beta) };
  emitir();
}

export function lectura(): Lectura {
  return { ...L, tilt: { ...L.tilt }, eventos: { ...L.eventos }, crudo: L.crudo && { ...L.crudo } };
}

export function suscribir(o: Oyente) {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

export const esReal = real;
