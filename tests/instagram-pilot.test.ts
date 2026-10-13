import assert from 'node:assert/strict';
import test from 'node:test';
import { PILOT_1_ACCOUNTS, PILOT_COHORTS, PILOT_LIMITS, pilotItem } from '../lib/instagram-pilot';

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
