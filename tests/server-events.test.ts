import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readEvents } from '../lib/server-events';
import { fechaDeLaNoche } from '../lib/event-extraction';
const original = globalThis.fetch;
test('successful empty response stays canonical even after a populated request', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test';
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          null,
          42,
          'corrupted',
          [],
          {
            instagram_id: 'abc',
            title: 'Plan',
            date_text: fechaDeLaNoche(new Date()),
            is_active: true,
            moderation_status: 'approved',
          },
        ]),
      );
    assert.equal((await readEvents()).events.length, 1);
    globalThis.fetch = async () => new Response('[]');
    const empty = await readEvents();
    assert.equal(empty.status, 'ok');
    assert.deepEqual(empty.events, []);
    globalThis.fetch = async () => new Response('unavailable', { status: 503 });
    const error = await readEvents();
    assert.equal(error.status, 'error');
    assert.deepEqual(error.events, []);
    globalThis.fetch = async () => {
      throw new Error('network token=SECRET_SHOULD_NOT_LEAK');
    };
    assert.equal((await readEvents()).status, 'error');
  } finally {
    globalThis.fetch = original;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
});


test('hora de término confirmada viaja de la base a la cartelera', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test';
  try {
    globalThis.fetch = async (url) => {
      assert.match(String(url), /event_end_time/);
      return new Response(JSON.stringify([{ instagram_id: 'fin-real', title: 'Concierto', date_text: fechaDeLaNoche(new Date()), event_time: '18:00', event_end_time: '19:00', is_active: true, moderation_status: 'approved' }]));
    };
    const result = await readEvents();
    assert.equal(result.status, 'ok');
    assert.equal(result.events[0].fin, '19:00');
  } finally {
    globalThis.fetch = original;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
});

test('compatibilidad: si la base aún no tiene event_end_time, se lee con la consulta anterior (sin cartelera vacía)', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable';
  const pedidas: string[] = [];
  try {
    globalThis.fetch = async (url) => {
      pedidas.push(decodeURIComponent(String(url)));
      if (pedidas.length === 1)
        return new Response(JSON.stringify({ code: '42703', message: 'column events.event_end_time does not exist' }), { status: 400 });
      return new Response(JSON.stringify([{ instagram_id: 'legado', title: 'Plan', date_text: fechaDeLaNoche(new Date()), is_active: true, moderation_status: 'approved' }]));
    };
    const r = await readEvents();
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.events.map((e) => e.id), ['legado']);
    assert.equal(pedidas.length, 2);
    assert.doesNotMatch(pedidas[1], /event_end_time/);
    assert.match(pedidas[1], /date_text=gte\./);
    // Otro 400 (no por la columna) sigue siendo un error, sin reintentos a ciegas.
    pedidas.length = 0;
    globalThis.fetch = async (url) => {
      pedidas.push(String(url));
      return new Response(JSON.stringify({ code: 'PGRST100', message: 'otra cosa' }), { status: 400 });
    };
    assert.equal((await readEvents()).status, 'error');
    assert.equal(pedidas.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('cron: el vencimiento usa la RPC con la excepción (y si aún no existe, la ingesta sigue)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/api/cron/scrape/route.ts', import.meta.url), 'utf8');
  assert.match(src, /db\.rpc\('expire_stale_active_events'\)/);
  assert.doesNotMatch(src, /\.update\(\{ is_active: false \}\)[\s\S]{0,80}\.lt\('date_text'/);
  assert.match(src, /if \(expire\.error\)\s*metrics\.expire_error/);
});
