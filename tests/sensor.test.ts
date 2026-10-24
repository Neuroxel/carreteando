import { test } from 'node:test';
import assert from 'node:assert/strict';

// Ventana mínima: guarda los oyentes para disparar eventos sintéticos.
type Fn = (e: unknown) => void;
const oyentes: Record<string, Fn[]> = {};
let reloj = 0;
const g = globalThis as Record<string, unknown>;
g.window = {
  addEventListener: (t: string, f: Fn) => (oyentes[t] ??= []).push(f),
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  innerWidth: 400,
  innerHeight: 800,
};
g.screen = { orientation: { angle: 0 } };
const guardado: Record<string, string> = {};
g.localStorage = { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => (guardado[k] = v), removeItem: (k: string) => delete guardado[k] };
Object.defineProperty(globalThis, 'performance', { value: { now: () => reloj }, configurable: true });
const disparar = (t: string, e: unknown) => {
  reloj += 16;
  for (const f of oyentes[t] ?? []) f(e);
};
const gravedad = (betaGrados: number, gammaGrados: number, signo = 1) => {
  const b = (betaGrados * Math.PI) / 180;
  const gm = (gammaGrados * Math.PI) / 180;
  // Convención W3C: de pie y ≈ +9,8; inclinar a la derecha (gamma +) da x negativo.
  return { accelerationIncludingGravity: { x: -9.81 * Math.sin(gm) * signo, y: 9.81 * Math.sin(b) * Math.cos(gm) * signo, z: 9.81 * Math.cos(b) * Math.cos(gm) * signo } };
};

test('sin un toque explícito no se escucha ningún sensor (opt-in)', async () => {
  const s = await import('../components/poster/sensor');
  s.iniciarSensores();
  assert.equal(oyentes.devicemotion, undefined);
  assert.equal(oyentes.deviceorientation, undefined);
  assert.equal(s.movimientoPermitido(), false);
  // El toque de "Activar movimiento" es el consentimiento.
  guardado[s.CLAVE_MOVIMIENTO] = '1';
});

test('Android sin giroscopio: orientación nula, el acelerómetro toma el control y mide la inclinación', async () => {
  const s = await import('../components/poster/sensor');
  s.iniciarSensores();
  for (let i = 0; i < 6; i++) {
    disparar('deviceorientation', { beta: null, gamma: null });
    disparar('devicemotion', gravedad(50, 0));
  }
  let l = s.lectura();
  assert.equal(l.fuente, 'MOTION_ACCELEROMETER');
  assert.equal(l.estado, 'recibiendo');
  assert.ok(l.eventos.orientacionNula >= 6);
  assert.ok(Math.abs(l.beta! - 50) < 0.5);
  // Inclinar 10° a la derecha y SOSTENER: el desplazamiento se mantiene (no se recentra).
  for (let i = 0; i < 200; i++) disparar('devicemotion', gravedad(50, 10));
  l = s.lectura();
  assert.ok(l.tilt.x > 0.85, `tilt.x=${l.tilt.x}`);
  assert.ok(Math.abs(l.tilt.y) < 0.15, `tilt.y=${l.tilt.y}`);
  // Hacia la izquierda: signo opuesto.
  for (let i = 0; i < 200; i++) disparar('devicemotion', gravedad(50, -10));
  assert.ok(s.lectura().tilt.x < -0.85);
  // Recalibrar: la postura actual es el nuevo cero.
  s.recalibrar();
  for (let i = 0; i < 20; i++) disparar('devicemotion', gravedad(50, -10));
  assert.ok(Math.abs(s.lectura().tilt.x) < 0.1);
});

test('si llega orientación con números, se prefiere y se recalibra el cero', async () => {
  const s = await import('../components/poster/sensor');
  for (let i = 0; i < 6; i++) disparar('deviceorientation', { beta: 40, gamma: 0 });
  assert.equal(s.lectura().fuente, 'ORIENTATION');
  disparar('deviceorientation', { beta: 40, gamma: 10.8 });
  assert.equal(s.lectura().tilt.x, 1);
});

test('la simulación nunca se informa como sensor real', async () => {
  const s = await import('../components/poster/sensor');
  s.simular(0, 5);
  assert.equal(s.lectura().fuente, 'DEBUG_SIMULATION');
  assert.equal(s.esReal(s.lectura().fuente), false);
});
