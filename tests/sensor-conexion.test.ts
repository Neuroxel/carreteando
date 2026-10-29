import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Ventana mínima con eventos reales (add/remove/dispatch), sin navegador.
type Fn = (e: unknown) => void;
const oyentes: Record<string, Fn[]> = {};
let reloj = 0;
const guardado: Record<string, string> = {};
const g = globalThis as Record<string, unknown>;
g.Event = class {
  constructor(public type: string) {}
};
g.window = {
  addEventListener: (t: string, f: Fn) => (oyentes[t] ??= []).push(f),
  removeEventListener: (t: string, f: Fn) => (oyentes[t] = (oyentes[t] ?? []).filter((x) => x !== f)),
  dispatchEvent: (e: { type: string }) => (oyentes[e.type] ?? []).slice().forEach((f) => f(e)),
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  innerWidth: 400,
  innerHeight: 800,
};
g.screen = { orientation: { angle: 0 } };
g.localStorage = { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => (guardado[k] = v), removeItem: (k: string) => delete guardado[k] };
Object.defineProperty(globalThis, 'performance', { value: { now: () => reloj }, configurable: true });
const disparar = (t: string, e: unknown) => {
  reloj += 16;
  for (const f of (oyentes[t] ?? []).slice()) f(e);
};
// Android sin giroscopio: orientación nula y el acelerómetro con la gravedad.
const gravedad = (beta: number, gamma: number) => {
  const b = (beta * Math.PI) / 180;
  const gm = (gamma * Math.PI) / 180;
  return { accelerationIncludingGravity: { x: -9.81 * Math.sin(gm), y: 9.81 * Math.sin(b) * Math.cos(gm), z: 9.81 * Math.cos(b) * Math.cos(gm) } };
};
const sacudir = (gamma: number) => {
  for (let i = 0; i < 40; i++) {
    disparar('deviceorientation', { beta: null, gamma: null });
    disparar('devicemotion', gravedad(50, i < 8 ? 0 : gamma));
  }
};

test('sensor: activar, desactivar y reactivar sin recargar; con respaldo por acelerómetro', async () => {
  const s = await import('../components/poster/sensor');
  const vistos: ({ x: number; y: number } | null)[] = [];
  const desconectar = s.conectarSensor((t) => vistos.push(t));

  // 1. Sin activar: nadie escucha el hardware.
  assert.equal(oyentes.devicemotion?.length ?? 0, 0);
  assert.equal(oyentes.deviceorientation?.length ?? 0, 0);

  // 2. Activar (el toque): el ya montado se conecta en el acto, sin recargar.
  await s.pedirPermiso();
  assert.equal(s.movimientoPermitido(), true);
  assert.ok((oyentes.devicemotion?.length ?? 0) > 0, 'escucha devicemotion (respaldo sin giroscopio)');
  sacudir(15);
  const reales = vistos.filter((v): v is { x: number; y: number } => v !== null);
  assert.ok(reales.length > 0, 'llegan inclinaciones desde el acelerómetro');
  assert.equal(s.lectura().fuente, 'MOTION_ACCELEROMETER');
  assert.ok(Math.abs(reales.at(-1)!.x) > 0.1, `inclinación ${reales.at(-1)!.x}`);

  // 3. Desactivar: se sueltan las escuchas y quien mira vuelve al reposo.
  s.apagarMovimiento();
  assert.equal(oyentes.devicemotion?.length ?? 0, 0);
  assert.equal(vistos.at(-1), null);

  // 4. Reactivar, otra vez sin recargar.
  const antes = vistos.length;
  await s.pedirPermiso();
  assert.ok((oyentes.devicemotion?.length ?? 0) > 0);
  sacudir(-15);
  assert.ok(vistos.slice(antes).some((v) => v && v.x < -0.1), 'responde de nuevo, hacia el otro lado');

  // 5. Desmontar: ningún aviso posterior llega a un componente que ya no está.
  desconectar();
  const n = vistos.length;
  sacudir(10);
  assert.equal(vistos.length, n);
});

test('escena y luz usan el adaptador común (sin listeners propios de deviceorientation)', () => {
  for (const f of ['../components/EscenaAfiches.tsx', '../components/Bienvenida.tsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(src, /conectarSensor\(/, f);
    assert.doesNotMatch(src, /addEventListener\('deviceorientation'/, f);
  }
  const sensor = readFileSync(new URL('../components/poster/sensor.ts', import.meta.url), 'utf8');
  const pedir = sensor.slice(sensor.indexOf('export function pedirPermiso'));
  assert.match(pedir, /window\.dispatchEvent\(new Event\(EVENTO_MOVIMIENTO\)\)/);
});
