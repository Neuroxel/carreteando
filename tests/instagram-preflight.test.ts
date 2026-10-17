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

test('el piloto incremental pide sólo cuentas activas y persiste evidencia antes de avanzar la marca', async () => {
  const originalFetch = globalThis.fetch;
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'APIFY_API_TOKEN', 'CRON_SECRET'] as const;
  const previous = names.map((name) => process.env[name]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  process.env.APIFY_API_TOKEN = 'test-only';
  process.env.CRON_SECRET = 'test-only';
  const last = new Date(Date.now() - 7200000).toISOString();
  const posted = new Date(Date.now() - 3600000).toISOString();
  let evidenceSaved = false;
  let watermarkSaved = false;
  let postsReturned = 1;
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      let data: unknown = [];
      if (url.pathname.endsWith('/instagram_accounts') && method === 'GET')
        data = [{ username: 'mascara_valparaiso', status: 'active', kind: 'venue', venue_id: 82, last_post_at: last },
          { username: 'studiovalparaiso', status: 'candidate', kind: 'venue', venue_id: 21, last_post_at: null }];
      else if (url.pathname.endsWith('/automation_config')) data = [{ key: 'instagram_pilot' }];
      else if (url.pathname === '/v2/acts/apify~instagram-scraper/runs') {
        assert.deepEqual(body.directUrls, ['https://www.instagram.com/mascara_valparaiso/']);
        assert.equal(Date.parse(body.onlyPostsNewerThan), Date.parse(last) - 60000);
        assert.equal(url.searchParams.get('maxTotalChargeUsd'), '0.5');
        data = { data: { id: 'test-run', defaultDatasetId: 'test-dataset', status: 'SUCCEEDED', usageTotalUsd: 0.01 } };
      } else if (url.pathname === '/v2/datasets/test-dataset/items')
        data = Array.from({ length: postsReturned }, (_, i) => ({ ownerUsername: 'mascara_valparaiso', shortCode: `TEST123${i}`, timestamp: posted, caption: 'Fiesta este sábado a las 22:00' }));
      else if (url.pathname.endsWith('/venues')) data = [{ id: 82, name: 'Máscara', city: 'Valparaíso' }];
      else if (url.pathname.endsWith('/instagram_pilot_items')) {
        evidenceSaved = true;
        assert.equal(body[0].candidate.venue, 'Máscara');
      } else if (url.pathname.endsWith('/instagram_accounts') && method === 'PATCH') {
        assert.equal(evidenceSaved, true);
        assert.equal(body.last_post_at, postsReturned === 1 ? posted : undefined);
        watermarkSaved = true;
      } else assert.ok(url.pathname.endsWith('/instagram_pilot_runs'), `Unexpected write: ${url}`);
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    };
    const response = await GET(new Request('https://example.com/api/cron/piloto-instagram?cohorte=A', {
      headers: { authorization: 'Bearer test-only' },
    }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.accounts_requested, 1);
    assert.ok(result.accounts_skipped.includes('studiovalparaiso'));
    assert.equal(watermarkSaved, true);
    postsReturned = 3;
    const capped = await GET(new Request('https://example.com/api/cron/piloto-instagram?cohorte=A', {
      headers: { authorization: 'Bearer test-only' },
    }));
    assert.equal(capped.status, 200);
    assert.deepEqual((await capped.json()).accounts_at_limit, ['mascara_valparaiso']);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
});
