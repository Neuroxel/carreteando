import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validSession } from '../lib/admin-session';
import { parseFilters } from '../lib/filters';
import { editorialRows } from '../lib/editorial-feed';
import { dbRowToEvento, diversifyByVenue, esTemporadaDieciocho, filterEvents } from '../lib/events';
import { dbRowToLugar, zonaSlug, zonasDe } from '../lib/venues';
import { POST as measure } from '../app/api/medir/route';
import { ReviewInputError, reviewInput } from '../lib/review-input';
import { toChileDateString } from '../lib/event-extraction';
test('owner session rejects tampering, expiry, future lifetime and rotation', () => {
  const secret = 'a'.repeat(43),
    now = Date.parse('2026-09-14T12:00:00Z');
  const payload = `${now + 3600000}.${'a'.repeat(32)}`;
  const signature = createHmac('sha256', secret)
    .update(`admin-session-v1|${payload}`)
    .digest('base64url');
  const value = `${payload}.${signature}`;
  assert.equal(validSession(value, secret, now), true);
  assert.equal(validSession(value, secret, now + 3600000), false);
  assert.equal(validSession(value, 'b'.repeat(43), now), false);
  assert.equal(validSession(value.replace('aaaa', 'bbbb'), secret, now), false);
  assert.equal(validSession(value, secret, now - 7200000), false);
  assert.equal(validSession(value + '.extra', secret, now), false);
  assert.equal(validSession(value, null, now), false);
});
test('shared city slugs preserve filters without mutating caller parameters', () => {
  const query = new URLSearchParams('ciudad=vina-del-mar&fecha=finde&categoria=electronica');
  assert.equal(parseFilters(query).ciudad, 'Viña del Mar');
  assert.equal(parseFilters(query).fecha, 'finde');
  assert.equal(query.get('ciudad'), 'vina-del-mar');
  assert.equal(parseFilters(new URLSearchParams('ciudad=valparaiso')).ciudad, 'Valparaíso');
});
test('48 hours without a reviewer leaves uncertain private and approved upcoming visible', () => {
  const rows = editorialRows(new Date('2026-09-14T19:00:00Z'));
  const events = rows.map((r) => dbRowToEvento(r)).filter((e) => e !== null);
  assert.ok(
    events.some((e) => e.ciudad === 'Viña del Mar' && e.precio_conocido === false && !e.hora),
  );
  const future = filterEvents(events, { fecha: 'futuro' }, '2026-09-16');
  assert.ok(future.some((e) => e.id === 'curated-202609-antonio-rios-sushiweb'));
  assert.ok(
    filterEvents(events, { fecha: 'futuro' }, '2026-09-17').every(
      (e) => e.id !== 'curated-202609-antonio-rios-sushiweb',
    ),
  );
  assert.equal(dbRowToEvento({ ...rows[0], is_active: false, moderation_status: 'pending' }), null);
});
test('metrics reject cross-origin, personal payloads and unbounded bodies; honor privacy headers', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  process.env.CRON_SECRET = 'test';
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    return new Response(String(input).includes('operation_allowed') ? 'true' : 'null', {
      headers: { 'content-type': 'application/json' },
    });
  };
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('https://carreteando.vercel.app/api/medir', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://carreteando.vercel.app',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await measure(req({ name: 'share' }, { origin: 'https://evil.example' }))).status,
      403,
    );
    assert.equal((await measure(req({ name: 'share', email: 'private@example.com' }))).status, 400);
    assert.equal((await measure(req({ name: 'x'.repeat(300) }))).status, 413);
    assert.equal((await measure(req({ name: 'page_view' }, { dnt: '1' }))).status, 204);
    assert.equal(calls, 0);
    assert.equal((await measure(req({ name: 'share' }))).status, 204);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test('review actions travel as bound arguments and each rejection names its own cause', () => {
  const today = toChileDateString(new Date());
  const form = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    f.set('note', 'Revisé la fuente original y la fecha.');
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };
  const complete = {
    checked: 'yes',
    nombre: 'Fiesta de prueba',
    descripcion: 'Descripción suficientemente larga para pasar la validación.',
    fecha: today,
    hora: '22:00',
    lugar: 'Trotamundos',
    ciudad: 'Valparaíso',
    direccion: 'Blanco 1253',
    precio: '5000',
    precio_texto: '',
    categoria: 'rock',
    organizador: 'trotamundosvalpo',
    fuente_url: 'https://example.com/evento',
    imagen_url: '',
  };
  // The original defect: the submitting button's name/value never reached the
  // server action, so kind and action arrived empty and every cause read alike.
  const causes = (call: () => unknown) => {
    try {
      call();
      return 'ok';
    } catch (error) {
      return error instanceof ReviewInputError ? error.status : 'other';
    }
  };
  assert.equal(
    causes(() => reviewInput('event', 'null', 0, form())),
    'invalid',
  );
  assert.equal(
    causes(() => reviewInput('', 'withdraw', 0, form())),
    'invalid',
  );
  assert.equal(
    causes(() => reviewInput('event', 'withdraw', 1.5, form())),
    'invalid',
  );
  assert.equal(
    causes(() => reviewInput('event', 'withdraw', -1, form())),
    'invalid',
  );
  assert.equal(
    causes(() => reviewInput('event', 'withdraw', 0, form({ note: 'corta' }))),
    'invalid-note',
  );
  assert.equal(
    causes(() => reviewInput('event', 'approve', 0, form(complete))),
    'ok',
  );
  assert.equal(
    causes(() => reviewInput('event', 'approve', 0, form({ ...complete, checked: '' }))),
    'invalid-check',
  );
  assert.equal(
    causes(() => reviewInput('event', 'approve', 0, form({ ...complete, ciudad: '' }))),
    'invalid-fields',
  );
  assert.equal(
    causes(() => reviewInput('event', 'approve', 0, form({ ...complete, descripcion: 'corta' }))),
    'invalid-fields',
  );
  // Withdrawing must not demand the edit form: it is a retreat, not a publication.
  const withdraw = reviewInput('event', 'withdraw', 3, form());
  assert.deepEqual(withdraw.fields, {});
  assert.equal(withdraw.note, 'Revisé la fuente original y la fecha.');
  const approved = reviewInput('inbox', 'approve', 0, form(complete)) as {
    fields: Record<string, unknown>;
  };
  assert.equal(approved.fields.city, 'Valparaíso');
  assert.equal(approved.fields.price_text, '$5.000');
  assert.equal(approved.fields.event_time, '22:00');
  assert.ok(String(approved.fields.event_key).length > 0);
  const unknown = reviewInput(
    'event',
    'approve',
    0,
    form({ ...complete, precio: '', hora: '' }),
  ) as {
    fields: Record<string, unknown>;
  };
  assert.equal(unknown.fields.price_clp, null);
  assert.equal(unknown.fields.event_time, null);
  assert.equal(unknown.fields.price_text, 'Precio por confirmar');
});

test('a venue is a place, not a date, and never leaks an unapproved row', () => {
  const base = {
    slug: 'emporio-echaurren',
    name: 'Emporio Echaurren',
    city: 'Valparaíso',
    zone: 'Plan de Valparaíso',
    address: 'Clave 243',
    venue_type: 'club',
    tags: ['soundsystem', 'reggae'],
    source_type: 'calendario-publico',
    source_url: 'https://www.portaldisc.com/cartelera/emporioechaurren',
    is_active: true,
    moderation_status: 'approved',
  };
  const ok = dbRowToLugar(base);
  assert.equal(ok?.nombre, 'Emporio Echaurren');
  assert.equal(ok?.tipo_label, 'Club');
  assert.deepEqual(ok?.tags, ['soundsystem', 'reggae']);
  // Nothing uncertain becomes public, exactly as events behave.
  assert.equal(dbRowToLugar({ ...base, moderation_status: 'pending' }), null);
  assert.equal(dbRowToLugar({ ...base, is_active: false }), null);
  assert.equal(dbRowToLugar({ ...base, slug: '../escape' }), null);
  assert.equal(dbRowToLugar({ ...base, city: '' }), null);
  // An unknown type must not invent one.
  assert.equal(dbRowToLugar({ ...base, venue_type: 'restaurante' })?.tipo, 'bar');
  assert.equal(zonaSlug('Cerro Alegre'), 'cerro-alegre');
  assert.equal(zonaSlug('Viña Centro'), 'vina-centro');
  const zonas = zonasDe([
    dbRowToLugar(base)!,
    dbRowToLugar({ ...base, slug: 'otro', name: 'Otro', zone: 'Cerro Alegre' })!,
    dbRowToLugar({ ...base, slug: 'tercero', name: 'Tercero', zone: null })!,
  ]);
  assert.equal(zonas.length, 2);
  assert.ok(zonas.every((z) => z.lugares.length > 0));
});
test('one venue cannot take the whole first screen, and far dates never jump ahead', () => {
  const ev = (lugar: string, fecha: string) => ({ lugar, fecha, id: `${lugar}-${fecha}` });
  const many = [
    ev('Teatro Mauri SCD', '2026-09-24'),
    ev('Teatro Mauri SCD', '2026-09-25'),
    ev('Teatro Mauri SCD', '2026-09-26'),
    ev('Teatro Mauri SCD', '2026-10-02'),
    ev('Bar Vienés', '2026-10-03'),
    ev('Cassot Bar', '2026-12-17'),
  ];
  const out = diversifyByVenue(many);
  assert.equal(out.length, many.length, 'no se pierde ni se oculta ningún evento');
  assert.deepEqual(
    new Set(out.map((e) => e.id)),
    new Set(many.map((e) => e.id)),
    'son exactamente los mismos eventos',
  );
  assert.equal(out[0].fecha, '2026-09-24', 'la primera tarjeta sigue siendo la más próxima');
  // Even with four of six dates in one room, the opening rows show more than one place.
  assert.ok(
    new Set(out.slice(0, 4).map((e) => e.lugar)).size >= 2,
    `esperaba variedad, hubo ${out
      .slice(0, 4)
      .map((e) => e.lugar)
      .join(', ')}`,
  );
  // The December date must not be dragged to the top just to break a run.
  assert.ok(
    out.findIndex((e) => e.fecha === '2026-12-17') >= 3,
    'una fecha lejana se adelantó demasiado',
  );
  // A single-venue list must survive untouched rather than be reshuffled.
  const solo = [
    ev('Trotamundos Valparaíso', '2026-09-20'),
    ev('Trotamundos Valparaíso', '2026-09-21'),
    ev('Trotamundos Valparaíso', '2026-09-22'),
  ];
  assert.deepEqual(diversifyByVenue(solo), solo);
});

test('a fonda reads as a fonda, and the Dieciocho surface opens and closes by date', () => {
  const base = {
    instagram_id: 'fonda-2026-alejo-barrios-0918',
    title: 'Fonda Alejo Barrios',
    date_text: '2026-09-18',
    city: 'Valparaíso',
    venue: 'Parque Alejo Barrios',
    is_active: true,
    moderation_status: 'approved',
    price_clp: 0,
    price_text: 'Entrada liberada',
    category: 'otro',
  };
  const fonda = dbRowToEvento({ ...base, event_type: 'fonda' });
  assert.equal(fonda?.tipo, 'fonda');
  // An unknown or missing type must fall back, never crash or invent one.
  assert.equal(dbRowToEvento({ ...base, event_type: 'kermesse' })?.tipo, 'main');
  assert.equal(dbRowToEvento(base)?.tipo, 'main');
  const club = dbRowToEvento({ ...base, instagram_id: 'club-1', event_type: 'club' });
  const todos = [fonda, club].filter((e) => e !== null);
  assert.equal(filterEvents(todos, { tipo: 'fonda' }, '2026-09-18').length, 1);
  assert.equal(filterEvents(todos, { tipo: 'after' }, '2026-09-18').length, 0);
  assert.equal(filterEvents(todos, { tipo: 'todos' }, '2026-09-18').length, 2);
  // The seasonal surface is dated, not permanent.
  assert.equal(esTemporadaDieciocho('2026-09-18'), true);
  assert.equal(esTemporadaDieciocho('2026-09-14'), true);
  assert.equal(esTemporadaDieciocho('2026-09-21'), true);
  assert.equal(esTemporadaDieciocho('2026-09-22'), false);
  assert.equal(esTemporadaDieciocho('2026-09-13'), false);
  assert.equal(esTemporadaDieciocho('2027-03-01'), false);
});
