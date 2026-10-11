import assert from 'node:assert/strict';
import test from 'node:test';
import { PILOT_ACCOUNTS, PILOT_LIMITS, pilotItem } from '../lib/instagram-pilot';

test('el piloto es acotado: 15 cuentas, 3 posts, 3 días, tope de 1 USD', () => {
  assert.equal(PILOT_ACCOUNTS.length, 15);
  assert.equal(PILOT_LIMITS.postsPerAccount, 3);
  assert.equal(PILOT_LIMITS.newerThan, '3 days');
  assert.ok(PILOT_LIMITS.maxTotalChargeUsd <= 1);
});

test('solo guarda posts de las cuentas del piloto y sin datos de terceros', () => {
  const ok = pilotItem({ ownerUsername: 'terrazamiaw', shortCode: 'ABC123', timestamp: '2026-10-09T23:00:00.000Z', caption: 'Jueves de karaoke', latestComments: [{ text: 'x' }] });
  assert.equal(ok?.post_url, 'https://www.instagram.com/p/ABC123/');
  assert.ok(!('latestComments' in (ok || {})));
  assert.equal(pilotItem({ ownerUsername: 'otra_cuenta', shortCode: 'ABC123' }), null);
});
