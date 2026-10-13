import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparLugares } from '../lib/admin-venues';

test('la cola de lugares cuenta solo los que necesitan evidencia, no los cerrados con moderación vieja', () => {
  const g = agruparLugares([
    { disposition: 'needs_evidence', moderation_status: 'pending' },
    { disposition: 'closed', moderation_status: 'pending' },
    { disposition: 'closed', moderation_status: 'approved' },
    { disposition: 'published', moderation_status: 'approved' },
    { disposition: 'rejected', moderation_status: 'rejected' },
  ]);
  assert.equal(g.porRevisar.length, 1);
  assert.equal(g.publicados.length, 1);
  assert.equal(g.archivados.length, 3);
});
