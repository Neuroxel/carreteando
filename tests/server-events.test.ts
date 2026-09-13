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
