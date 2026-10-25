/**
 * Física de la tarjeta de vidrio: el mismo modelo que la calculadora de
 * referencia (https://calculadora-3d-game.vercel.app/), reimplementado sobre
 * cannon-es (MIT) a partir de los parámetros observados en su JS público. No se
 * copia código de la demo (no declara licencia); se reproducen sus valores:
 *
 * - Mundo sin gravedad, solver de 10 iteraciones, sueño permitido, paso fijo
 *   1/60 con hasta 3 subpasos.
 * - Cuerpo caja de masa 1.5, angularDamping .15, linearDamping 1 y TRASLACIÓN
 *   BLOQUEADA (linearFactor 0): flota sólo girando, con inercia.
 * - Toque: impulso = dirección cámara→punto · intensidad · fuerza · .15,
 *   aplicado en el punto tocado (el giro depende de dónde se toca).
 * - Oscilación ambiental: torque sin(t·.8)·.03 / cos(t·.5)·.01 / cos(t·.7)·.02.
 * - Arrastre: suma velocidad angular como la demo (·.004 con pesos .8/1.5/1.2).
 * - Sensor: dx,dy ∈ [-1,1]; si cambia más de .01 suma velocidad angular
 *   (dy·k, dx·k, dx·k·.5) con k = sensibilidad·15, y tras sincronizar añade la
 *   inclinación directa (x: y·.8, z: −x·.8).
 *
 * Diferencias declaradas, propias de una tarjeta y no de un juego:
 * - Ejes: la demo mira la calculadora desde arriba (Y arriba); aquí la cámara
 *   mira la tarjeta de frente (Z hacia la cámara). La "Z" de la demo (giro de
 *   costado visto desde la cámara) corresponde a nuestra Y.
 * - La caja usa el ancho/alto de la tarjeta en pantalla (en unidades de mundo)
 *   y el grosor .15 de la demo.
 * - La inclinación directa del sensor se atenúa (×.35): .8 rad haría ilegible el texto.
 * - Se agrega un tope de giro (inclinación máxima) y un resorte suave hacia la
 *   pose neutra para que la tarjeta nunca quede de canto ni ilegible: la demo
 *   es un juego y puede quedar en cualquier ángulo; un botón no.
 */
import type * as CANNON_T from 'cannon-es';

type Cannon = typeof CANNON_T;
export const FISICA = {
  paso: 1 / 60,
  subpasos: 3,
  iteraciones: 10,
  masa: 1.5,
  angularDamping: 0.15,
  linearDamping: 1,
  grosor: 0.15,
  impulso: 0.15,
  intensidadBoton: 1,
  intensidadCuerpo: 0.8,
  arrastre: { factor: 0.004, x: 1.5, y: 0.8, z: 1.2 },
  /** `sensibilidad` no es visible en el JS de la demo: .1 es nuestra elección, ajustable en QA. */
  sensor: { umbral: 0.01, k: 15, inclinacion: 0.8, sensibilidad: 0.1, atenuacion: 0.35 },
  /** Propio de Dónde Salgo: el texto debe seguir legible. */
  giroMax: 0.55,
  resorte: 1.6,
} as const;

export interface Vidrio {
  mundo: CANNON_T.World;
  cuerpo: CANNON_T.Body;
  q0: CANNON_T.Quaternion;
}
export function crearVidrio(C: Cannon, ancho: number, alto: number): Vidrio {
  const mundo = new C.World({ gravity: new C.Vec3(0, 0, 0) });
  (mundo.solver as unknown as { iterations: number }).iterations = FISICA.iteraciones;
  mundo.allowSleep = true;
  const cuerpo = new C.Body({
    mass: FISICA.masa,
    shape: new C.Box(new C.Vec3(ancho / 2, alto / 2, FISICA.grosor / 2)),
    position: new C.Vec3(0, 0, 0),
    angularDamping: FISICA.angularDamping,
    linearDamping: FISICA.linearDamping,
  });
  cuerpo.linearFactor.set(0, 0, 0);
  mundo.addBody(cuerpo);
  return { mundo, cuerpo, q0: cuerpo.quaternion.clone() };
}

/** Toque en `punto` (relativo al centro, mundo) con dirección cámara→punto normalizada. */
export function empujar(C: Cannon, v: Vidrio, punto: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, intensidad: number = FISICA.intensidadBoton) {
  const n = intensidad * FISICA.impulso;
  v.cuerpo.wakeUp();
  v.cuerpo.applyImpulse(new C.Vec3(dir.x * n, dir.y * n, dir.z * n), new C.Vec3(punto.x, punto.y, punto.z));
}
/** Arrastre de puntero (px desde el último evento). Ejes según la demo, mapeados a tarjeta de frente. */
export function arrastrar(v: Vidrio, dx: number, dy: number) {
  const a = FISICA.arrastre;
  v.cuerpo.wakeUp();
  v.cuerpo.angularVelocity.y += dx * a.factor * a.y;
  v.cuerpo.angularVelocity.x += dy * a.factor * a.x;
  v.cuerpo.angularVelocity.z += dx * a.factor * a.z * 0.25;
}
/** Oscilación ambiental de la demo (torque por paso). */
export function ambiente(v: Vidrio, t: number) {
  v.cuerpo.torque.x += Math.sin(t * 0.8) * 0.03;
  v.cuerpo.torque.y += Math.cos(t * 0.7) * 0.02;
  v.cuerpo.torque.z += Math.cos(t * 0.5) * 0.01;
}
/** Cambio de sensor (ya normalizado/suavizado/calibrado, en [-1,1]). */
export function sentir(v: Vidrio, previo: { x: number; y: number }, actual: { x: number; y: number }, sensibilidad: number = FISICA.sensor.sensibilidad) {
  const dx = actual.x - previo.x;
  const dy = actual.y - previo.y;
  if (Math.abs(dx) <= FISICA.sensor.umbral && Math.abs(dy) <= FISICA.sensor.umbral) return false;
  const k = sensibilidad * FISICA.sensor.k;
  v.cuerpo.wakeUp();
  v.cuerpo.angularVelocity.x += dy * k;
  v.cuerpo.angularVelocity.y += dx * k;
  v.cuerpo.angularVelocity.z += dx * k * 0.5;
  return true;
}
/**
 * Un cuadro: resorte suave a la pose neutra (propio), paso fijo de la demo y
 * tope de giro. Devuelve los ángulos a aplicar a la malla (incluida la
 * inclinación directa del sensor, como la demo tras sincronizar).
 */
export function avanzarVidrio(C: Cannon, v: Vidrio, dt: number, t: number, sensor: { x: number; y: number } | null, ambienteOn = true) {
  if (ambienteOn) ambiente(v, t);
  const e = new C.Vec3();
  v.cuerpo.quaternion.toEuler(e);
  v.cuerpo.torque.x += -e.x * FISICA.resorte;
  v.cuerpo.torque.y += -e.y * FISICA.resorte;
  v.cuerpo.torque.z += -e.z * FISICA.resorte;
  v.mundo.step(FISICA.paso, dt, FISICA.subpasos);
  v.cuerpo.quaternion.toEuler(e);
  const tope = (a: number) => Math.max(-FISICA.giroMax, Math.min(FISICA.giroMax, a));
  if (Math.abs(e.x) > FISICA.giroMax || Math.abs(e.y) > FISICA.giroMax) {
    v.cuerpo.quaternion.setFromEuler(tope(e.x), tope(e.y), tope(e.z));
    // Al tocar el tope se pierde la velocidad hacia afuera: sin rebote violento.
    if (Math.abs(e.x) > FISICA.giroMax) v.cuerpo.angularVelocity.x *= -0.2;
    if (Math.abs(e.y) > FISICA.giroMax) v.cuerpo.angularVelocity.y *= -0.2;
    v.cuerpo.quaternion.toEuler(e);
  }
  const s = sensor ?? { x: 0, y: 0 };
  return { x: e.x + s.y * FISICA.sensor.inclinacion * FISICA.sensor.atenuacion, y: e.y + s.x * FISICA.sensor.inclinacion * FISICA.sensor.atenuacion, z: e.z };
}
export function reiniciar(v: Vidrio) {
  v.cuerpo.angularVelocity.set(0, 0, 0);
  v.cuerpo.velocity.set(0, 0, 0);
  v.cuerpo.quaternion.copy(v.q0);
  v.cuerpo.position.set(0, 0, 0);
}

/**
 * Sensor para la tarjeta: misma normalización que la demo (aceleración /10;
 * orientación gamma/45 y (beta−45)/45; tope [-1,1]) más lo que pide el dueño:
 * pose neutra calibrada en la primera lectura, suavizado exponencial y reset.
 */
export function crearFiltroSensor(alfa = 0.18) {
  let neutro: { x: number; y: number } | null = null;
  let suave = { x: 0, y: 0 };
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  return {
    leerOrientacion(beta: number, gamma: number) {
      return this.muestra(gamma / 45, (beta - 45) / 45);
    },
    leerAceleracion(x: number, y: number) {
      return this.muestra(x / 10, y / 10);
    },
    muestra(x: number, y: number) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return suave;
      if (!neutro) neutro = { x, y };
      const rx = clamp(x - neutro.x);
      const ry = clamp(y - neutro.y);
      suave = { x: suave.x + (rx - suave.x) * alfa, y: suave.y + (ry - suave.y) * alfa };
      return suave;
    },
    reset() {
      neutro = null;
      suave = { x: 0, y: 0 };
    },
    get valor() {
      return suave;
    },
  };
}
