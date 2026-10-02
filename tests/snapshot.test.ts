import assert from 'node:assert/strict';
import test from 'node:test';
import { versionOf } from '../lib/snapshot';
import { coincideBusqueda, dbRowToEvento, filterEvents } from '../lib/events';

const ev = dbRowToEvento({
  instagram_id: 'rock-1',
  title: 'Tributo a Pink Floyd',
  date_text: '2026-10-24',
  event_time: '21:00',
  venue: 'Club Segundo Piso',
  city: 'Valparaíso',
  category: 'rock',
  is_active: true,
  moderation_status: 'approved',
})!;

test('la versión del snapshot solo cambia si cambia el contenido', () => {
  assert.equal(versionOf({ a: [1, 2] }), versionOf({ a: [1, 2] }));
  assert.notEqual(versionOf({ a: [1, 2] }), versionOf({ a: [1, 3] }));
});

test('la búsqueda local ignora acentos y mayúsculas, busca en lugar, comuna, estilo y sinónimos', () => {
  assert.ok(coincideBusqueda(ev, 'ROCK'));
  assert.ok(coincideBusqueda(ev, 'segundo piso'));
  assert.ok(coincideBusqueda(ev, 'valparaíso'));
  assert.ok(coincideBusqueda(ev, 'valpo'), 'sinónimo');
  assert.ok(coincideBusqueda(ev, 'floyd valpo'), 'todas las palabras');
  assert.ok(!coincideBusqueda(ev, 'cumbia'));
});

test('un snapshot viejo nunca revive eventos pasados: la fecha la pone el teléfono', () => {
  assert.equal(filterEvents([ev], { fecha: 'futuro' }, '2026-10-20').length, 1);
  assert.equal(filterEvents([ev], { fecha: 'futuro' }, '2026-10-25').length, 0);
});
