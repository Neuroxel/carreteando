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
  assert.match(scrape, /if \(saved\.error\) throw new IngestionError\('DB_FINISH'\);/);
  const piloto = readFileSync(new URL('../app/api/cron/piloto-instagram/route.ts', import.meta.url), 'utf8');
  assert.match(piloto, /entradaActor\(actor, cuentas, PILOT_LIMITS\.postsPerAccount, ventana\)/);
  assert.match(piloto, /marcasNuevas\(/);
});

test('selección: solo cuentas de locales aprobados y coincidencia de URL; rota y limita', async () => {
  const { seleccionarCuentas } = await import('../lib/instagram-incremental');
  const venue = { id: 1, name: 'Local Uno', city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: 'https://www.instagram.com/localuno/' };
  const first = { username: 'localuno', venue_id: 1, city: 'Valparaíso', last_checked_at: null, venues: venue };
  const later = { ...first, username: 'localdos', venue_id: 2, last_checked_at: '2026-10-28T00:00:00Z', venues: { ...venue, id: 2, instagram_url: 'https://instagram.com/localdos/' } };
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
  const row = { username: 'el.huevo', venue_id: 7, city: 'Valparaíso', last_checked_at: null, venues: venue };
  const sources = seleccionarCuentas([row]);
  const post = { ownerUsername: 'el.huevo', shortCode: 'abc123', timestamp: '2026-10-23T12:00:00Z', caption: 'Concierto 24/10/2026 21:00' };
  assert.equal(classifyPost(post, ahora, sources).row?.event_key, classifyPost(post, ahora).row?.event_key);
  const alias = seleccionarCuentas([{ ...row, username: 'otro.alias', venues: { ...venue, instagram_url: 'https://instagram.com/otro.alias/' } }]);
  assert.equal(alias['otro.alias'].identity, 'el-huevo');
  assert.equal(classifyPost({ ...post, ownerUsername: 'otro.alias', shortCode: 'def456' }, ahora, alias).row?.event_key, classifyPost(post, ahora).row?.event_key);
  const equivocado = seleccionarCuentas([{ ...row, venues: { ...venue, name: 'Otro local' } }]);
  assert.equal(Object.keys(equivocado).length, 0);
});

test('lectura: vacío, error, timestamps desconocidos o saturación no cuentan como completos', async () => {
  const { cuentasCompletas } = await import('../lib/instagram-incremental');
  const post = { cuenta: 'a', publicado: hace(5), error: false };
  assert.deepEqual(cuentasCompletas(['a', 'b'], [post], 3, 40), ['a']);
  assert.deepEqual(cuentasCompletas(['a'], [], 3, 40), []);
  assert.deepEqual(cuentasCompletas(['a'], [{ ...post, publicado: null }], 3, 40), []);
  assert.deepEqual(cuentasCompletas(['a'], [post, post, post], 3, 40), []);
  assert.deepEqual(cuentasCompletas(['a'], [post, { cuenta: null, publicado: null, error: true }], 3, 40), []);
  assert.deepEqual(cuentasCompletas(['a'], [post], 3, 1), []);
});

test('rotación de cinco cubre 61 cuentas en 13 corridas sin fallos', async () => {
  const { seleccionarCuentas } = await import('../lib/instagram-incremental');
  const rows = Array.from({ length: 61 }, (_, i) => {
    const username = `local${i}`;
    return { username, venue_id: i + 1, city: 'Valparaíso', last_checked_at: null as string | null, venues: { id: i + 1, name: `Local ${i}`, city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: `https://instagram.com/${username}/` } };
  });
  const visited = new Set<string>();
  for (let day = 0; day < 13; day++) {
    const names = Object.keys(seleccionarCuentas(rows));
    assert.ok(names.length <= 5);
    for (const row of rows) if (names.includes(row.username)) { visited.add(row.username); row.last_checked_at = new Date(Date.UTC(2026, 9, day + 1)).toISOString(); }
  }
  assert.equal(visited.size, 61);
});
