import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/cron/piloto-instagram/route';

test('sin registro privado no consume el armado ni inicia una corrida pagada', async () => {
  const originalFetch = globalThis.fetch;
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'APIFY_API_TOKEN', 'CRON_SECRET'] as const;
  const previous = names.map((name) => process.env[name]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  process.env.APIFY_API_TOKEN = 'test-only';
  process.env.CRON_SECRET = 'test-only';
  const calls: string[] = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      assert.match(url, /\/rest\/v1\/instagram_accounts\?/);
      assert.equal(init?.method || (input instanceof Request ? input.method : 'GET'), 'GET');
      return new Response(JSON.stringify({ code: 'PGRST205', message: 'private diagnostic' }), {
        status: 404, headers: { 'content-type': 'application/json' },
      });
    };
    const response = await GET(new Request('https://example.com/api/cron/piloto-instagram?cohorte=BENCH', {
      headers: { authorization: 'Bearer test-only' },
    }));
    assert.equal(response.status, 503);
    assert.equal(calls.length, 1);
    assert.doesNotMatch(await response.text(), /private diagnostic/);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
});
