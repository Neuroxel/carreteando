import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbRowToEvento, filterEvents } from '../lib/events';
const row = {
  instagram_id: 'post1',
  title: 'Fiesta',
  date_text: '2026-09-12',
  is_active: true,
  moderation_status: 'approved',
};
test('public model rejects missing dates and moderation; never uses scraped_at', () => {
  for (const patch of [
    { date_text: null },
    { date_text: '2026-02-31' },
    { is_active: false },
    { moderation_status: 'pending' },
    { instagram_id: '../secret' },
  ])
    assert.equal(dbRowToEvento({ ...row, ...patch }), null);
  const e = dbRowToEvento(row)!;
  assert.equal(e.ciudad, 'Por confirmar');
  assert.equal(e.hora, null);
  assert.equal(e.precio_conocido, false);
  assert.equal(e.verificado, false);
});
test('all filters exclude expired and quarantined events, including weekend Sunday', () => {
  const events = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-18'].map(
    (date_text) => dbRowToEvento({ ...row, date_text })!,
  );
  assert.equal(filterEvents(events, { fecha: 'todos' }, '2026-09-12').length, 3);
  assert.equal(filterEvents(events, { fecha: 'finde' }, '2026-09-13').length, 1);
  assert.equal(filterEvents(events, { fecha: 'hoy' }, '2026-09-12').length, 1);
  assert.equal(filterEvents(events, { precio: 'gratis' }, '2026-09-12').length, 0);
});
