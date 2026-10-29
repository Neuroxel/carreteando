import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from 'cannon-es';
import { FISICA, arrastrar, avanzarVidrio, crearFiltroSensor, crearVidrio, empujar, reiniciar, sentir } from '../lib/vidrio-fisica';

test('vidrio: mismos parámetros que la demo (sin gravedad, 10 iteraciones, masa 1.5, damping .15/1, traslación bloqueada)', () => {
  const v = crearVidrio(C, 2, 1.2);
  assert.deepEqual([v.mundo.gravity.x, v.mundo.gravity.y, v.mundo.gravity.z], [0, 0, 0]);
  assert.equal((v.mundo.solver as unknown as { iterations: number }).iterations, 10);
  assert.equal(v.mundo.allowSleep, true);
  assert.equal(v.cuerpo.mass, 1.5);
  assert.equal(v.cuerpo.angularDamping, 0.15);
  assert.equal(v.cuerpo.linearDamping, 1);
  assert.deepEqual([v.cuerpo.linearFactor.x, v.cuerpo.linearFactor.y, v.cuerpo.linearFactor.z], [0, 0, 0]);
  assert.equal(FISICA.paso, 1 / 60);
  assert.equal(FISICA.subpasos, 3);
});
test('vidrio: un toque fuera del centro hace girar (inercia), nunca traslada', () => {
  const v = crearVidrio(C, 2, 1.2);
  // Toque en la esquina superior derecha, empujando hacia el fondo (cámara → tarjeta).
  empujar(C, v, { x: 0.9, y: 0.5, z: 0.075 }, { x: 0, y: 0, z: -1 });
  for (let i = 0; i < 10; i++) avanzarVidrio(C, v, 1 / 60, i / 60, null, false);
  const w = v.cuerpo.angularVelocity;
  assert.ok(Math.abs(w.x) > 0.01 && Math.abs(w.y) > 0.01, `w=${w.x},${w.y}`);
  // Esquina derecha empujada al fondo: gira en +y negativo/positivo según la mano derecha; arriba: x negativo.
  assert.ok(w.x < 0, 'arriba hacia el fondo inclina la parte de arriba hacia atrás');
  assert.ok(w.y > 0, 'derecha hacia el fondo gira la derecha hacia atrás');
  assert.equal(v.cuerpo.position.length(), 0);
  // El mismo impulso en el centro no gira.
  const c = crearVidrio(C, 2, 1.2);
  empujar(C, c, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  assert.ok(c.cuerpo.angularVelocity.length() < 1e-9);
});
test('vidrio: amortigua y vuelve hacia la pose neutra; nunca pasa el tope de giro', () => {
  const v = crearVidrio(C, 2, 1.2);
  for (let i = 0; i < 8; i++) empujar(C, v, { x: 1, y: 0.6, z: 0.075 }, { x: 0, y: 0, z: -1 });
  // angularDamping .15 (el de la demo) amortigua lento: flota. Se exige que decaiga, no que se detenga ya.
  let max = 0;
  let ultimo = 0;
  for (let i = 0; i < 60 * 12; i++) {
    const r = avanzarVidrio(C, v, 1 / 60, i / 60, null, false);
    const a = Math.max(Math.abs(r.x), Math.abs(r.y));
    max = Math.max(max, a);
    if (i >= 60 * 11) ultimo = Math.max(ultimo, a);
  }
  assert.ok(max <= FISICA.giroMax + 1e-6, `max=${max}`);
  assert.ok(ultimo < max * 0.5, `último segundo ${ultimo} vs pico ${max}`);
});
test('vidrio: arrastre y sensor suman giro; reset deja todo en reposo', () => {
  const v = crearVidrio(C, 2, 1.2);
  arrastrar(v, 30, -10);
  assert.ok(v.cuerpo.angularVelocity.y > 0 && v.cuerpo.angularVelocity.x < 0);
  assert.equal(sentir(v, { x: 0, y: 0 }, { x: 0.005, y: 0.005 }), false, 'bajo el umbral .01 no hace nada');
  assert.equal(sentir(v, { x: 0, y: 0 }, { x: 0.2, y: 0 }), true);
  reiniciar(v);
  assert.equal(v.cuerpo.angularVelocity.length(), 0);
  assert.equal(v.cuerpo.quaternion.w, 1);
});
test('sensor: normaliza como la demo, calibra la pose neutra, limita a [-1,1] y suaviza; reset recalibra', () => {
  const f = crearFiltroSensor(1); // sin suavizado para medir
  assert.deepEqual(f.leerOrientacion(60, 10), { x: 0, y: 0 }, 'la primera lectura es la neutra');
  const a = f.leerOrientacion(60, 10 + 45);
  assert.equal(a.x, 1);
  const b = f.leerOrientacion(60 + 200, 10);
  assert.equal(b.y, 1, 'tope');
  f.reset();
  assert.deepEqual(f.leerOrientacion(10, -20), { x: 0, y: 0 });
  const s = crearFiltroSensor(0.2);
  s.muestra(0, 0);
  const p = s.muestra(1, 0);
  assert.ok(p.x > 0 && p.x < 0.5, 'suavizado');
  assert.deepEqual(s.muestra(NaN, 0), p, 'lecturas inválidas se ignoran');
});
