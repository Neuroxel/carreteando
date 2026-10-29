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
  const later = { ...first, username: 'localdos', venue_id: 2, last_checked_at: '2026-10-28T00:00:00Z', last_scraped_at: '2026-10-28T00:00:00Z', venues: { ...venue, id: 2, instagram_url: 'https://instagram.com/localdos/' } };
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
    return { username, venue_id: i + 1, city: 'Valparaíso', last_checked_at: null as string | null, last_scraped_at: null as string | null, venues: { id: i + 1, name: `Local ${i}`, city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: `https://instagram.com/${username}/` } };
  });
  const visited = new Set<string>();
  for (let day = 0; day < 13; day++) {
    const names = Object.keys(seleccionarCuentas(rows));
    assert.ok(names.length <= 5);
    for (const row of rows) if (names.includes(row.username)) { visited.add(row.username); row.last_checked_at = row.last_scraped_at = new Date(Date.UTC(2026, 9, day + 1)).toISOString(); }
  }
  assert.equal(visited.size, 61);
});

test('una cuenta persistentemente vacía no impide avanzar: reintento acotado tras backoff', async () => {
  const { seleccionarCuentas, cuentasCompletas, REINTENTOS_POR_CORRIDA } = await import('../lib/instagram-incremental');
  const rows = Array.from({ length: 61 }, (_, i) => {
    const username = i === 0 ? 'vacia' : `local${i}`;
    return { username, venue_id: i + 1, city: 'Valparaíso', last_checked_at: null as string | null, last_scraped_at: null as string | null, venues: { id: i + 1, name: `Local ${i}`, city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: `https://instagram.com/${username}/` } };
  });
  const visited = new Set<string>();
  let intentosVacia = 0;
  // Una corrida cada 12 h (la cuenta "vacia" nunca entrega evidencia).
  for (let run = 0; run < 16; run++) {
    const t = new Date(Date.UTC(2026, 9, 1) + run * 12 * 3_600_000);
    const names = Object.keys(seleccionarCuentas(rows, 5, { ahora: t }));
    assert.ok(names.length <= 5);
    const fallidasElegidas = names.filter((n) => { const r = rows.find((x) => x.username === n)!; return r.last_checked_at && (!r.last_scraped_at || r.last_scraped_at < r.last_checked_at); });
    assert.ok(fallidasElegidas.length <= REINTENTOS_POR_CORRIDA, `run ${run}: ${fallidasElegidas}`);
    const completas = cuentasCompletas(names, names.filter((n) => n !== 'vacia').map((n) => ({ cuenta: n, publicado: t.toISOString(), error: false })), 3, 40);
    for (const row of rows) {
      if (!names.includes(row.username)) continue;
      visited.add(row.username);
      row.last_checked_at = t.toISOString(); // todo intento rota
      if (completas.includes(row.username)) row.last_scraped_at = t.toISOString(); // sólo lectura completa
    }
    if (names.includes('vacia')) intentosVacia++;
  }
  assert.equal(visited.size, 61, 'todas las cuentas se revisan pese a la vacía');
  // Nunca leída: no usa la plaza de reintento; vuelve por la rotación común (una vez por ciclo).
  assert.ok(intentosVacia >= 1 && intentosVacia <= 2, `la vacía se reintenta por rotación, acotado (${intentosVacia})`);
  assert.equal(rows.find((r) => r.username === 'vacia')!.last_scraped_at, null, 'nunca se finge una lectura');
});

test('reintento: no antes del backoff y a lo más una plaza aunque todas hayan fallado', async () => {
  const { seleccionarCuentas, BACKOFF_REINTENTO_HORAS } = await import('../lib/instagram-incremental');
  const mk = (username: string, i: number, checked: string | null, scraped: string | null) => ({ username, venue_id: i, city: 'Valparaíso', last_checked_at: checked, last_scraped_at: scraped, venues: { id: i, name: `Local ${username}`, city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: `https://instagram.com/${username}/` } });
  // Fallos recientes de cuentas que sí se habían leído (candidatas a reintento).
  const fallidas = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((u, i) => mk(u, i + 1, hace(BACKOFF_REINTENTO_HORAS + 1 + i), hace(BACKOFF_REINTENTO_HORAS + 24 + i)));
  const nuevas = ['n1', 'n2', 'n3', 'n4', 'n5'].map((u, i) => mk(u, i + 10, null, null));
  const elegidas = Object.keys(seleccionarCuentas([...fallidas, ...nuevas], 5, { ahora }));
  assert.equal(elegidas.filter((u) => u.startsWith('f')).length, 1, 'una sola plaza de reintento');
  assert.equal(elegidas[0], 'f6', 'la fallida más antigua');
  const recien = mk('r1', 20, hace(1), hace(10));
  assert.ok(!Object.keys(seleccionarCuentas([recien, ...nuevas.slice(0, 1)], 1, { ahora })).includes('r1'), 'antes del backoff no se reintenta');
});

test('cron: todo intento rota, sólo lo completo es lectura y el fallo queda registrado en la corrida', () => {
  const src = readFileSync(new URL('../app/api/cron/scrape/route.ts', import.meta.url), 'utf8');
  assert.match(src, /update\(\{ last_checked_at: now\.toISOString\(\) \}\)\.in\('username', cuentas\)/);
  assert.match(src, /update\(\{ last_scraped_at: now\.toISOString\(\) \}\)\.in\('username', completas\)/);
  assert.match(src, /metrics\.instagram_incompletas = cuentas\.filter/);
  assert.ok(src.indexOf('metrics.instagram_incompletas') < src.indexOf("status: 'succeeded',\n        completed_at"), 'se registra antes de guardar la corrida');
});

test('reintento: la rotación común nunca agrega otras fallidas ni las que siguen en backoff (aunque falten nuevas)', async () => {
  const { seleccionarCuentas, BACKOFF_REINTENTO_HORAS } = await import('../lib/instagram-incremental');
  const mk = (username: string, i: number, checked: string | null, scraped: string | null) => ({ username, venue_id: i, city: 'Valparaíso', last_checked_at: checked, last_scraped_at: scraped, venues: { id: i, name: `Local ${username}`, city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: `https://instagram.com/${username}/` } });
  // Seis fallos recientes (leídas antes, fallaron hace > 6 h) y otras dos dentro del backoff; ninguna nueva.
  const viejas = Array.from({ length: 6 }, (_, i) => mk(`f${i}`, i + 1, hace(BACKOFF_REINTENTO_HORAS + 1 + i), hace(BACKOFF_REINTENTO_HORAS + 30 + i)));
  const enBackoff = [mk('b1', 20, hace(1), hace(20)), mk('b2', 21, hace(2), hace(20))];
  const elegidas = Object.keys(seleccionarCuentas([...viejas, ...enBackoff], 5, { ahora }));
  assert.deepEqual(elegidas, ['f5'], 'sólo una fallida (la más antigua) y ninguna en backoff, aunque sobren plazas');
  // Con cuentas sanas, las fallidas siguen sin colarse por la rotación.
  const sanas = Array.from({ length: 6 }, (_, i) => mk(`s${i}`, i + 40, hace(48 + i), hace(48 + i)));
  const mezcla = Object.keys(seleccionarCuentas([...viejas, ...enBackoff, ...sanas], 5, { ahora }));
  assert.equal(mezcla.filter((u) => /^[fb]/.test(u)).length, 1);
  assert.ok(!mezcla.some((u) => u.startsWith('b')));
});

test('reintento acotado en el tiempo: un fallo viejo o una cuenta nunca leída vuelve a la rotación común', async () => {
  const { seleccionarCuentas, REINTENTO_MAX_DIAS } = await import('../lib/instagram-incremental');
  const mk = (username: string, i: number, checked: string | null, scraped: string | null) => ({ username, venue_id: i, city: 'Valparaíso', last_checked_at: checked, last_scraped_at: scraped, venues: { id: i, name: `Local ${username}`, city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: `https://instagram.com/${username}/` } });
  const nuncaLeida = mk('nunca', 1, hace(24 * 20), null); // la más antigua: entra por rotación común
  const falloViejo = mk('viejo', 2, hace(24 * 19), hace(24 * (19 + REINTENTO_MAX_DIAS + 1)));
  const sana = mk('sana', 3, hace(24), hace(24));
  assert.deepEqual(Object.keys(seleccionarCuentas([sana, falloViejo, nuncaLeida], 2, { ahora })), ['nunca', 'viejo']);
});

test('cobertura: 61 cuentas, 5 plazas, 1 corrida diaria caben en 14 días; con reintento diario no, y se declara', async () => {
  const { coberturaRotacion } = await import('../lib/instagram-incremental');
  const normal = coberturaRotacion({ validas: 61, plazas: 5, reintentos: 0 });
  assert.equal(normal.ciclo_dias, 13);
  assert.equal(normal.suficiente, true);
  const conReintento = coberturaRotacion({ validas: 61, plazas: 5, reintentos: 1 });
  assert.equal(conReintento.ciclo_dias, 16);
  assert.equal(conReintento.suficiente, false, 'no se promete una cobertura imposible');
  assert.ok(conReintento.plazas_necesarias >= 6, `plazas necesarias ${conReintento.plazas_necesarias}`);
});

test('61 cuentas con una vacía persistente: ciclo de 13 corridas, nadie queda fuera de la ventana de 14 días', async () => {
  const { seleccionarCuentas, cuentasCompletas, MAX_DIAS } = await import('../lib/instagram-incremental');
  const rows = Array.from({ length: 61 }, (_, i) => {
    const username = i === 0 ? 'vacia' : `local${i}`;
    return { username, venue_id: i + 1, city: 'Valparaíso', last_checked_at: null as string | null, last_scraped_at: null as string | null, venues: { id: i + 1, name: `Local ${i}`, city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: `https://instagram.com/${username}/` } };
  });
  const ultimaLectura = new Map<string, number>();
  let peorHueco = 0;
  for (let dia = 0; dia < 40; dia++) {
    const t = Date.UTC(2026, 9, 1, 18) + dia * 86_400_000;
    const names = Object.keys(seleccionarCuentas(rows, 5, { ahora: new Date(t) }));
    const completas = cuentasCompletas(names, names.filter((n) => n !== 'vacia').map((n) => ({ cuenta: n, publicado: new Date(t).toISOString(), error: false })), 3, 40);
    for (const row of rows) {
      if (!names.includes(row.username)) continue;
      row.last_checked_at = new Date(t).toISOString();
      if (completas.includes(row.username)) row.last_scraped_at = new Date(t).toISOString();
      if (dia >= 13 && row.username !== 'vacia') peorHueco = Math.max(peorHueco, (t - (ultimaLectura.get(row.username) ?? t)) / 86_400_000);
      ultimaLectura.set(row.username, t);
    }
  }
  assert.ok(peorHueco <= MAX_DIAS - 1, `hueco máximo entre lecturas ${peorHueco} días`);
});

test('backoff global: un único usuario vacío no se repite en corridas separadas por menos de 6 h', async () => {
  const { seleccionarCuentas, cuentasCompletas, BACKOFF_REINTENTO_HORAS } = await import('../lib/instagram-incremental');
  const row = { username: 'vacia', venue_id: 1, city: 'Valparaíso', last_checked_at: null as string | null, last_scraped_at: null as string | null, venues: { id: 1, name: 'Local vacía', city: 'Valparaíso', is_active: true, moderation_status: 'approved', instagram_url: 'https://instagram.com/vacia/' } };
  const t0 = Date.UTC(2026, 9, 29, 12);
  const corre = (h: number) => {
    const t = new Date(t0 + h * 3_600_000);
    const names = Object.keys(seleccionarCuentas([row], 5, { ahora: t }));
    if (names.length) {
      row.last_checked_at = t.toISOString();
      if (cuentasCompletas(names, [], 3, 40).includes('vacia')) row.last_scraped_at = t.toISOString();
    }
    return names;
  };
  assert.deepEqual(corre(0), ['vacia'], 'primera vez: nunca revisada');
  assert.deepEqual(corre(1), [], '1 h después: en backoff, aunque sobren plazas');
  assert.deepEqual(corre(BACKOFF_REINTENTO_HORAS - 0.5), [], 'antes de 6 h tampoco');
  assert.deepEqual(corre(BACKOFF_REINTENTO_HORAS + 0.5), ['vacia'], 'pasado el backoff vuelve (por rotación, nunca leída)');
  assert.equal(row.last_scraped_at, null, 'nunca se finge una lectura');
});
