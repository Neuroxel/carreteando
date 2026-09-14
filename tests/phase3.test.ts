import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validSession } from '../lib/admin-session';
import { parseFilters } from '../lib/filters';
import { editorialRows } from '../lib/editorial-feed';
import { dbRowToEvento, filterEvents } from '../lib/events';
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
