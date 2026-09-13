import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as publish } from '../app/api/publicar/route';
import { GET as cron } from '../app/api/cron/scrape/route';
import { toChileDateString } from '../lib/event-extraction';
const originalFetch = globalThis.fetch;
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://carreteando.vercel.app/api/publicar', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const valid = {
  nombre: 'Fiesta de prueba',
  descripcion: 'Evento de prueba que nunca se guarda en producción.',
  fecha: toChileDateString(),
  hora: '23:00',
  lugar: 'Recinto de prueba',
  ciudad: 'Valparaíso',
  categoria: 'electronica',
  organizador: 'Pruebas',
  fuente_url: 'https://example.com/evento',
};
test('publication awaits private inbox, rejects invalid bodies/origin, and propagates failure without secrets', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  process.env.CRON_SECRET = 'test-only';
  let calls = 0;
  try {
    globalThis.fetch = async (input, init) => {
      calls++;
      assert.match(String(input), /rpc\/receive_community_item$/);
      const b = JSON.parse(String(init?.body));
      assert.equal(b.p_kind, 'submission');
      assert.equal(b.p_request_hash.length, 64);
      assert.equal(b.p_payload.is_active, undefined);
      return new Response(JSON.stringify('received'), {
        headers: { 'content-type': 'application/json' },
      });
    };
    const ok = await publish(request(valid));
    assert.equal(ok.status, 202);
    assert.equal((await ok.json()).status, 'pending');
    assert.equal(calls, 1);
    assert.equal((await publish(request(valid, { origin: 'https://evil.example' }))).status, 403);
    assert.equal((await publish(request({ ...valid, nombre: 'x'.repeat(20000) }))).status, 413);
    assert.equal((await publish(request(null))).status, 400);
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      new Response(JSON.stringify('rate_limited'), {
        headers: { 'content-type': 'application/json' },
      });
    assert.equal((await publish(request(valid))).status, 429);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'token=SECRET_SHOULD_NOT_LEAK' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    const fail = await publish(request(valid));
    assert.equal(fail.status, 503);
    assert.equal((await fail.text()).includes('SECRET_SHOULD_NOT_LEAK'), false);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.CRON_SECRET;
  }
});
test('cron fails closed in every environment and cooldown cannot incur Apify cost', async () => {
  let requests = 0;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await cron(new Request('https://example.com'))).status, 503);
    process.env.CRON_SECRET = 'test-only';
    assert.equal((await cron(new Request('https://example.com'))).status, 401);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
    process.env.APIFY_API_TOKEN = 'test-only';
    globalThis.fetch = async (input) => {
      requests++;
      assert.match(String(input), /rpc\/claim_ingestion_run$/);
      return new Response('null', { headers: { 'content-type': 'application/json' } });
    };
    const r = await cron(
      new Request('https://example.com', { headers: { authorization: 'Bearer test-only' } }),
    );
    assert.equal((await r.json()).skipped, 'cooldown');
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const k of [
      'CRON_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SECRET_KEY',
      'APIFY_API_TOKEN',
    ])
      delete process.env[k];
  }
});
