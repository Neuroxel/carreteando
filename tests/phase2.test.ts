import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPost, classifySourceItem, dedupeCandidates } from '../lib/ingestion';
import { splitDatedAgenda } from '../lib/agenda';
const now = new Date('2026-09-14T00:00:00Z');
const post = {
  shortCode: 'QA123',
  ownerUsername: 'trotamundosvalpo',
  timestamp: '2026-09-01T20:00:00Z',
  caption: 'Fiesta cumbia 19/09/2026. Puertas 23:00',
};
test('older announcement can describe a future event; old event stays expired', () => {
  assert.equal(classifyPost(post, now).reason, 'candidate');
  assert.equal(
    classifyPost({ ...post, caption: 'Fiesta cumbia 05/09/2026' }, now).reason,
    'expired',
  );
});
test('two independent events at one venue/date survive; exact reminders dedupe', () => {
  const a = classifyPost({ ...post, caption: 'Pascuala Ilabaca concierto 19/09/2026' }, now).row!;
  const b = classifyPost(
    { ...post, shortCode: 'QA456', caption: 'Pibes Chorros cumbia 19/09/2026' },
    now,
  ).row!;
  assert.equal(dedupeCandidates([a, b]).unique.length, 2);
  assert.equal(dedupeCandidates([a, { ...a, instagram_id: 'QA789' }]).unique.length, 1);
});
test('bounded dated agenda splits source evidence without sharing unknown fields', () => {
  const caption =
    'Viernes 18/09/2026 — Fiesta techno. Puertas 23:00\nSábado 19/09/2026 — Concierto rock. Entrada $5.000';
  const decisions = classifySourceItem({ ...post, caption }, now);
  assert.equal(decisions.length, 2);
  assert.equal(decisions[0].row?.date_text, '2026-09-18');
  assert.equal(decisions[1].row?.event_time, null);
  assert.equal(decisions[0].row?.price_clp, null);
  assert.notEqual(decisions[0].row?.instagram_id, decisions[1].row?.instagram_id);
  assert.equal(decisions[0].row?.instagram_url, decisions[1].row?.instagram_url);
  assert.equal(decisions[0].row?.is_active, false);
  assert.deepEqual(splitDatedAgenda('viernes fiesta\nsábado show', post.timestamp), []);
  assert.deepEqual(splitDatedAgenda(caption + '\nDomingo 31/02/2026 fiesta', post.timestamp), []);
});

import { dbRowToEvento } from '../lib/events';
import { editorialRows } from '../lib/editorial-feed';
test('reviewed unknown time and corrupt timestamps never become guessed hours or crash detail', () => {
  const e = dbRowToEvento({
    instagram_id: 'abc',
    title: 'Plan',
    date_text: '2026-09-19',
    is_active: true,
    moderation_status: 'approved',
    description: 'Acceso 20:00 o show 23:00',
    event_time: null,
    last_verified_at: 'bad',
    source_published_at: 'bad',
  });
  assert.equal(e?.hora, null);
  assert.equal(e?.ultima_revision, null);
  assert.equal(e?.publicado_en_fuente, null);
});
test('editorial adapter retains provenance, explicit approval and lifecycle boundaries', () => {
  const rows = editorialRows(new Date('2026-09-14T12:00:00Z'));
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map((r) => r.event_key)).size, 8);
  assert.ok(
    rows.every(
      (r) =>
        r.is_active &&
        r.moderation_status === 'approved' &&
        !r.organizer_verified &&
        r.source_published_at === null,
    ),
  );
  assert.equal(rows.find((r) => r.instagram_id.includes('pibes'))?.event_time, null);
  assert.deepEqual(editorialRows(new Date('2026-10-01T12:00:00Z')), []);
});
