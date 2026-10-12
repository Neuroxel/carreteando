import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('los límites de profundidad respetan el encargo', async () => {
  const { RESOLUCION, UMBRAL } = await import('../components/poster/profile');
  assert.equal(RESOLUCION.FULL.dpr, 1.5);
  assert.equal(RESOLUCION.LITE.dpr, 1);
  assert.ok(UMBRAL.FULL_A_LITE < UMBRAL.LITE_A_STATIC);
});

test('el afiche 3D es la presentación por defecto, sin bandera de experimento', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.ok(!css.includes('data-edicion'));
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.ok(!layout.includes('EXPERIMENTO'));
  assert.ok(!layout.includes('noindex') && !/index:\s*false/.test(layout));
});

test('las macro-texturas nunca se repiten', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const cuerpo = css.slice(css.indexOf(':root body {'));
  const repeat = /background-repeat:([^;]+);/
    .exec(cuerpo)![1]
    .split(',')
    .map((s) => s.trim());
  // Solo la primera capa (fibra, micro) se repite; el resto es macro.
  assert.equal(repeat[0], 'repeat');
  assert.ok(repeat.slice(1).every((r) => r === 'no-repeat'));
});
