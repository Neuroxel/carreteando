import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ajustarPorCuadros, nivelInicial } from '../lib/capacidad';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('nivel según el dispositivo: un teléfono penca no recibe efectos', () => {
  assert.equal(nivelInicial({ nucleos: 8, memoriaGb: 8 }), 'alta');
  assert.equal(nivelInicial({ nucleos: 4, memoriaGb: 4 }), 'media');
  assert.equal(nivelInicial({ nucleos: 2, memoriaGb: 4 }), 'baja');
  assert.equal(nivelInicial({ nucleos: 8, memoriaGb: 2 }), 'baja');
  assert.equal(nivelInicial({ nucleos: 8, memoriaGb: 8, ahorroDatos: true }), 'baja', 'ahorro de datos');
  assert.equal(nivelInicial({ nucleos: 8, memoriaGb: 8, movimientoReducido: true }), 'baja', 'movimiento reducido');
  assert.equal(nivelInicial({}), 'media', 'sin datos: término medio');
});

test('medición real de cuadros: solo baja el nivel, nunca lo sube', () => {
  assert.equal(ajustarPorCuadros('alta', 16), 'alta');
  assert.equal(ajustarPorCuadros('alta', 28), 'media');
  assert.equal(ajustarPorCuadros('media', 28), 'baja');
  assert.equal(ajustarPorCuadros('alta', 60), 'baja');
  assert.equal(ajustarPorCuadros('baja', 8), 'baja', 'no sube');
  assert.equal(ajustarPorCuadros('alta', null), 'alta', 'pestaña congelada: no opina');
});

test('en "baja" y con movimiento reducido no se agrega ningún efecto; la función no depende de ellos', () => {
  const css = src('app/globals.css');
  const bloque = css.slice(css.indexOf('Bienvenida cine'));
  // Las capas existen pero solo se muestran en media/alta.
  assert.match(bloque, /\.bv-luz \{[^}]*display:none/);
  assert.match(bloque, /\.bv-cine \{[^}]*display:none/);
  assert.match(bloque, /\.bv-destello \{[^}]*display:none/);
  assert.match(bloque, /\.bv-canto \{[^}]*display:none/);
  assert.match(bloque, /\.bv-luz, \.bv-cine, \.bv-destello, \.bv-canto \{ display:none !important; \}/);
  // Nada de la capa de efectos recibe toques.
  assert.match(bloque, /\.bv-papel, \.bv-canto \{[^}]*pointer-events:none/);
  assert.match(bloque, /\.bv-luz \{[^}]*pointer-events:none/);
  for (const kf of bloque.match(/@keyframes [\w-]+ \{[\s\S]*?\}\s*\}/g) || []) assert.doesNotMatch(kf, /width|height|top:|left:|blur|filter/);
  const b = src('components/Bienvenida.tsx');
  assert.equal((b.match(/<Capas \/>/g) || []).length, 6, 'cada tipo de afiche tiene canto y papel');
  assert.match(b, /data-nivel=\{nivel\}/);
  assert.match(b, /useState<Nivel>\('baja'\)/, 'arranca sin efectos hasta saber qué aguanta');
});

test('la cinta adhesiva nunca ocupa una celda de la grilla del afiche', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.bv-afiche > :not\(\.bv-canto\):not\(\.bv-papel\):not\(\.bv-cinta\) \{ position:relative/);
  assert.match(css, /\.bv-afiche > \.bv-cinta \{ position:absolute/);
});
