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

test('la profundidad es un adorno: sin WebGL y sin controles públicos', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies.three, undefined);
  const decor = readFileSync(new URL('../components/poster/Profundidad.tsx', import.meta.url), 'utf8');
  assert.ok(!decor.includes('Activar profundidad') && !decor.includes('Profundidad activa'));
});
