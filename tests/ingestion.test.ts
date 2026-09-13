import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPost, postOwner, dedupeCandidates, boundedResultsLimit } from '../lib/ingestion';
const now = new Date('2026-09-12T23:00:00Z');
const item = {
  shortCode: 'Abc123',
  ownerUsername: 'el.huevo',
  timestamp: '2026-09-12T20:00:00Z',
  caption: 'Fiesta techno sábado 19 de septiembre. Puertas 23:00. Preventa $5.000.',
};
test('only actual allowlisted owners pass; parent/collaborator do not grant access', () => {
  assert.equal(postOwner({ parentData: { username: 'el.huevo' }, username: 'el.huevo' }), null);
  assert.equal(
    postOwner({ ...item, ownerUsername: 'outsider', parentData: { username: 'el.huevo' } }),
    null,
  );
  assert.equal(postOwner({ ...item, owner: { username: 'outsider' } }), null);
  assert.equal(postOwner({ ...item, ownerUsername: '__proto__' }), null);
});
test('candidate is inactive, pending, with no invented verification', () => {
  const r = classifyPost(item, now);
  assert.equal(r.reason, 'candidate');
  assert.equal(r.row?.is_active, false);
  assert.equal(r.row?.moderation_status, 'pending');
  assert.equal(r.row?.organizer_verified, false);
  assert.equal(r.row?.date_text, '2026-09-19');
});
test('reject expired, ambiguous, external region, and campaign posts', () => {
  for (const [patch, reason] of [
    [{ caption: 'Fiesta 11/09. Techno' }, 'expired'],
    [{ timestamp: null }, 'parse_failed'],
    [{ caption: 'Fiesta techno hoy en Santiago' }, 'location_ambiguous'],
    [{ caption: 'ARTISTA CONFIRMADO fiesta techno 19/09' }, 'campaign_suppressed'],
    [{ caption: 'Taller cultural domingo' }, 'classification_rejected'],
    [{ timestamp: '2025-09-12T20:00:00Z' }, 'stale_post'],
  ] as const)
    assert.equal(classifyPost({ ...item, ...patch }, now).reason, reason);
});
test('different posts and venue aliases on same night do not multiply cards', () => {
  const a = classifyPost(item, now).row!;
  const b = classifyPost({ ...item, shortCode: 'Other123', ownerUsername: 'barelhuevo' }, now).row!;
  assert.equal(dedupeCandidates([a, b]).unique.length, 1);
});
test('cost limit input cannot become NaN, infinity or an excessive result count', () => {
  for (const v of ['oops', undefined, Infinity, 0, -1]) assert.equal(boundedResultsLimit(v), 3);
  assert.equal(boundedResultsLimit(999), 5);
});
