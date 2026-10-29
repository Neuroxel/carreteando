import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { desdeCuenta, marcasNuevas, MAX_DIAS, SOLAPE_HORAS, ventanaActor } from '../lib/instagram-incremental';

const ahora = new Date('2026-10-23T18:00:00Z');
const hace = (h: number) => new Date(ahora.getTime() - h * 3_600_000).toISOString();

test('ventana: desde la marca más vieja menos el solape; sin marca, el máximo', () => {
  assert.equal(desdeCuenta(hace(30), ahora).toISOString(), hace(30 + SOLAPE_HORAS));
  assert.equal(desdeCuenta(null, ahora).toISOString(), hace(MAX_DIAS * 24));
  assert.equal(desdeCuenta(hace(24 * 40), ahora).toISOString(), hace(MAX_DIAS * 24), 'nunca más atrás que el máximo');
  const marcas = new Map([['a', hace(10)], ['b', hace(50)]]);
  assert.equal(ventanaActor(['a', 'b'], marcas, ahora), '3 days', '50 h + 12 h de solape → 3 días');
  assert.equal(ventanaActor(['a'], marcas, ahora), '1 days');
  assert.equal(ventanaActor(['a', 'nueva'], marcas, ahora), `${MAX_DIAS} days`, 'una cuenta sin marca pide todo');
});

test('marca de agua: avanza solo tras éxito, nunca en saturación', () => {
  const marcas = new Map<string, string | null>([['a', hace(30)], ['b', hace(30)]]);
  const posts = [
    { cuenta: 'a', publicado: hace(5) },
    { cuenta: 'a', publicado: hace(20) },
    { cuenta: 'b', publicado: hace(2) },
    { cuenta: 'b', publicado: hace(3) },
    { cuenta: 'b', publicado: hace(4) },
  ];
  const ok = marcasNuevas({ exito: true, marcas, posts, porCuenta: 3, totalMax: 40 });
  assert.equal(ok.get('a'), hace(5));
  assert.equal(ok.has('b'), false, 'b devolvió el tope de 3: pudo quedar algo sin leer');
  assert.equal(marcasNuevas({ exito: false, marcas, posts, porCuenta: 3, totalMax: 40 }).size, 0, 'falla: no avanza');
  assert.equal(marcasNuevas({ exito: true, marcas, posts, porCuenta: 3, totalMax: 5 }).size, 0, 'corrida saturada: no avanza nada');
  const viejo = marcasNuevas({ exito: true, marcas: new Map([['a', hace(1)]]), posts: [{ cuenta: 'a', publicado: hace(5) }], porCuenta: 3, totalMax: 40 });
  assert.equal(viejo.size, 0, 'nunca retrocede');
});

test('rutas: la ingesta y el piloto usan la ventana incremental (no "14 days" fijo)', () => {
  const scrape = readFileSync(new URL('../app/api/cron/scrape/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(scrape, /onlyPostsNewerThan: '14 days'/);
  assert.match(scrape, /onlyPostsNewerThan: ventana/);
  assert.match(scrape, /if \(saved\.error\) throw new IngestionError\('DB_FINISH'\);\s*\/\/ Solo tras una corrida exitosa/);
  const piloto = readFileSync(new URL('../app/api/cron/piloto-instagram/route.ts', import.meta.url), 'utf8');
  assert.match(piloto, /entradaActor\(actor, cuentas, PILOT_LIMITS\.postsPerAccount, ventana\)/);
  assert.match(piloto, /marcasNuevas\(/);
});

test('selección: solo cuentas de locales aprobados y coincidencia de URL; rota y limita', async () => {
  const { seleccionarCuentas } = await import('../lib/instagram-incremental');
  const venue = { id: 1, name: 'Local Uno', city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: 'https://www.instagram.com/localuno/' };
  const first = { username: 'localuno', venue_id: 1, city: 'Valparaíso', last_scraped_at: null, venues: venue };
  const later = { ...first, username: 'localdos', venue_id: 2, last_scraped_at: '2026-10-28T00:00:00Z', venues: { ...venue, id: 2, instagram_url: 'https://instagram.com/localdos/' } };
  const wrong = { ...first, username: 'impostor' };
  const inactive = { ...first, username: 'inactivo', venues: { ...venue, instagram_url: 'https://instagram.com/inactivo/', is_active: false } };
  const sources = seleccionarCuentas([later, wrong, inactive, first], 1);
  assert.deepEqual(Object.keys(sources), ['localuno']);
  assert.deepEqual(sources.localuno, { venue: 'Local Uno', city: 'Valparaíso', identity: 'venue-1' });
  const { postOwner, classifyPost } = await import('../lib/ingestion');
  assert.equal(postOwner({ ownerUsername: 'impostor' }, sources), null);
  assert.equal(postOwner({ ownerUsername: 'localuno' }, sources), 'localuno');
  assert.equal(classifyPost({ ownerUsername: 'localuno', shortCode: 'abc123', timestamp: '2026-10-23T12:00:00Z', caption: 'Concierto 24/10/2026 21:00' }, ahora, sources).row?.moderation_status, 'pending');
});


test('registro conserva claves históricas y unifica alias del mismo local', async () => {
  const { seleccionarCuentas } = await import('../lib/instagram-incremental');
  const { classifyPost } = await import('../lib/ingestion');
  const venue = { id: 7, name: 'El Huevo', city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: 'https://instagram.com/el.huevo/' };
  const row = { username: 'el.huevo', venue_id: 7, city: 'Valparaíso', last_scraped_at: null, venues: venue };
  const sources = seleccionarCuentas([row]);
  const post = { ownerUsername: 'el.huevo', shortCode: 'abc123', timestamp: '2026-10-23T12:00:00Z', caption: 'Concierto 24/10/2026 21:00' };
  assert.equal(classifyPost(post, ahora, sources).row?.event_key, classifyPost(post, ahora).row?.event_key);
  const alias = seleccionarCuentas([{ ...row, username: 'otro.alias', venues: { ...venue, instagram_url: 'https://instagram.com/otro.alias/' } }]);
  assert.equal(alias['otro.alias'].identity, 'el-huevo');
  assert.equal(classifyPost({ ...post, ownerUsername: 'otro.alias', shortCode: 'def456' }, ahora, alias).row?.event_key, classifyPost(post, ahora).row?.event_key);
  const equivocado = seleccionarCuentas([{ ...row, venues: { ...venue, name: 'Otro local' } }]);
  assert.equal(Object.keys(equivocado).length, 0);
});
