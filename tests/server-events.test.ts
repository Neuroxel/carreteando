import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readEvents } from '../lib/server-events';
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
            date_text: '2026-09-19',
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
      return new Response(JSON.stringify([{ instagram_id: 'fin-real', title: 'Concierto', date_text: '2026-10-29', event_time: '18:00', event_end_time: '19:00', is_active: true, moderation_status: 'approved' }]));
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
