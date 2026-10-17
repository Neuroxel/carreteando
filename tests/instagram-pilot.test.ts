import assert from 'node:assert/strict';
import test from 'node:test';
import { PILOT_1_ACCOUNTS, PILOT_COHORTS, PILOT_LIMITS, TOPE_USD, candidatoDesdeTexto, candidatoValido, cuentasCitadas, entradaActor, pilotItem } from '../lib/instagram-pilot';

test('el piloto 2 es acotado: dos cohortes de 15 cuentas sin repetir, 3 posts, 7 días, 1 USD por cohorte', () => {
  assert.equal(PILOT_1_ACCOUNTS.length, 15);
  assert.equal(PILOT_COHORTS.A.length, 15);
  assert.equal(PILOT_COHORTS.B.length, 15);
  assert.equal(new Set([...PILOT_COHORTS.A, ...PILOT_COHORTS.B]).size, 30);
  assert.equal(PILOT_LIMITS.postsPerAccount, 3);
  assert.equal(PILOT_LIMITS.newerThan, '7 days');
  assert.ok(PILOT_LIMITS.maxTotalChargeUsd <= 1);
});

test('una cohorte solo guarda posts de sus cuentas y descarta fijados viejos', () => {
  const ahora = Date.parse('2026-10-13T12:00:00Z');
  assert.equal(pilotItem({ ownerUsername: 'glasgowpub', shortCode: 'XYZ1', timestamp: '2026-10-12T00:00:00Z' }, PILOT_COHORTS.A, ahora), null);
  assert.ok(pilotItem({ ownerUsername: 'glasgowpub', shortCode: 'XYZ1', timestamp: '2026-10-12T00:00:00Z' }, PILOT_COHORTS.B, ahora));
  assert.equal(pilotItem({ ownerUsername: 'glasgowpub', shortCode: 'XYZ2', timestamp: '2025-01-01T00:00:00Z', isPinned: true }, PILOT_COHORTS.B, ahora), null);
});

test('solo guarda posts de las cuentas del piloto y sin datos de terceros', () => {
  const ok = pilotItem({ ownerUsername: 'terrazamiaw', shortCode: 'ABC123', timestamp: '2026-10-09T23:00:00.000Z', caption: 'Jueves de karaoke', latestComments: [{ text: 'x' }] });
  assert.equal(ok?.post_url, 'https://www.instagram.com/p/ABC123/');
  assert.ok(!('latestComments' in (ok || {})));
  assert.equal(pilotItem({ ownerUsername: 'otra_cuenta', shortCode: 'ABC123' }), null);
});

test('v2: menciones, etiquetas y coautores se normalizan; la cuenta propia no cuenta', () => {
  const it = pilotItem(
    {
      ownerUsername: 'trotamundosvalpo',
      shortCode: 'DdM_orCRJRG',
      timestamp: '2026-10-10T20:00:00Z',
      caption: 'Monstruos del metal con @yajaira_rock y @dorso_oficial. Tickets en passline.com',
      taggedUsers: [{ username: 'Nache_Banda' }],
      coauthorProducers: [{ username: 'trotamundosvalpo' }, { username: 'valpofest' }],
    },
    ['trotamundosvalpo'],
    Date.parse('2026-10-11T00:00:00Z'),
  );
  assert.ok(it);
  assert.deepEqual(it!.mentions.sort(), ['dorso_oficial', 'yajaira_rock']);
  assert.deepEqual(it!.tagged_users, ['nache_banda']);
  assert.deepEqual(it!.coauthors, ['valpofest']);
});

test('v2: el candidato resuelve "este viernes" contra la fecha del post y marca lo que falta', () => {
  const it = pilotItem(
    { ownerUsername: 'glasgowpub', shortCode: 'ABC123', timestamp: '2026-10-13T15:00:00Z', caption: 'Este viernes fiesta Halloween desde las 22:00 hrs. Entradas en https://vesti.cl/e/123' },
    ['glasgowpub'],
    Date.parse('2026-10-13T16:00:00Z'),
  )!;
  const c = candidatoDesdeTexto(it, { venue: 'Glasgow Pub', city: 'Viña del Mar' });
  assert.equal(c.start_date, '2026-10-16'); // martes 13 → viernes 16
  assert.equal(c.time, '22:00');
  assert.equal(c.ticket_url, 'https://vesti.cl/e/123');
  assert.equal(c.is_event, true);
  assert.equal(c.field_source.start_date, 'caption');
  assert.equal(c.field_source.venue, 'cuenta');
  assert.deepEqual(c.critical_missing_fields, []);
  assert.ok(candidatoValido(c));
  assert.equal(candidatoValido({ ...c, extra: 1 }), false);
});

test('v2: un post cancelado o sin fecha no se presenta como evento listo', () => {
  const it = pilotItem({ ownerUsername: 'glasgowpub', shortCode: 'ABC124', timestamp: '2026-10-13T15:00:00Z', caption: 'Se suspende la fiesta del sábado 17 de octubre' }, ['glasgowpub'])!;
  const c = candidatoDesdeTexto(it, null);
  assert.equal(c.cancelled, true);
  assert.ok(c.critical_missing_fields.includes('venue'));
  const sinTexto = candidatoDesdeTexto(pilotItem({ ownerUsername: 'glasgowpub', shortCode: 'ABC125', timestamp: '2026-10-13T15:00:00Z', caption: '🔥🔥' }, ['glasgowpub'])!, null);
  assert.equal(sinTexto.needs_vision, true);
});

test('v2: el descubrimiento produce candidatas con apariciones independientes, nunca activas', () => {
  const base = { posted_at: null, caption: '', post_type: null, location_name: null, tagged_users: [], coauthors: [], display_url_temp: null };
  const out = cuentasCitadas(
    [
      { ...base, account: 'a', post_url: 'https://www.instagram.com/p/AAA/', mentions: ['nueva', 'conocida'] },
      { ...base, account: 'b', post_url: 'https://www.instagram.com/p/BBB/', mentions: ['nueva'] },
      { ...base, account: 'a', post_url: 'https://www.instagram.com/p/CCC/', mentions: ['nueva'] },
    ],
    new Set(['conocida']),
  );
  assert.deepEqual(out, [{ username: 'nueva', origenes: ['a', 'b'], apariciones: 2 }]);
});

test('v2: cada actor recibe la misma ventana y límite; solo el post-scraper sabe saltar fijados', () => {
  const a = entradaActor('apify~instagram-scraper', ['x'], 3, '7 days') as Record<string, unknown>;
  const b = entradaActor('apify~instagram-post-scraper', ['x'], 3, '7 days') as Record<string, unknown>;
  assert.equal(a.resultsLimit, 3);
  assert.equal(b.resultsLimit, 3);
  assert.equal(a.onlyPostsNewerThan, b.onlyPostsNewerThan);
  assert.equal(b.skipPinnedPosts, true);
  assert.equal(TOPE_USD.BENCH * 2 + TOPE_USD.A + TOPE_USD.B, 1.5);
});
