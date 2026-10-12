import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Cada archivo de prueba corre en su propio proceso: el flag no contamina las demás.
process.env.NEXT_PUBLIC_EXPERIMENT = '1';

test('la edición 3D no se rastrea ni anuncia sitemap', async () => {
  const { default: robots } = await import('../app/robots');
  const r = robots();
  assert.deepEqual(r.rules, { userAgent: '*', disallow: '/' });
  assert.equal(r.sitemap, undefined);
  const { default: sitemap } = await import('../app/sitemap');
  assert.deepEqual(await sitemap(), []);
});

test('la edición 3D no programa crons propios', () => {
  const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(cfg.crons, undefined);
});

test('los límites de profundidad respetan el encargo', async () => {
  const { RESOLUCION, UMBRAL } = await import('../components/poster/profile');
  assert.equal(RESOLUCION.FULL.dpr, 1.5);
  assert.equal(RESOLUCION.LITE.dpr, 1);
  assert.ok(UMBRAL.FULL_A_LITE < UMBRAL.LITE_A_STATIC);
});
